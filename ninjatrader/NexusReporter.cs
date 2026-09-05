#region Using declarations
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using NinjaTrader.Cbi;
using NinjaTrader.NinjaScript;
#endregion

// NexusReporter — pushes NinjaTrader 8 account activity to the Nexus panel.
//
// Install: copy this file to
//   Documents\NinjaTrader 8\bin\Custom\AddOns\NexusReporter.cs
// then compile in NinjaTrader (New > NinjaScript Editor > F5).
//
// Configure Endpoint and Token below before compiling. The token must match
// NT_INGEST_TOKEN on the server.
//
// What it does: subscribes to every account NT8 knows about and reports
//   - account values (cash, realized/unrealized P&L, buying power)
//   - each fill, with its own execution id so retries never duplicate
//   - open positions, and their removal when flat
//   - closed trades, paired from the fills, with P&L in points and currency
//
// Events arrive on NinjaTrader's threads, so everything is queued under a lock
// and flushed by a single background timer. No HTTP call ever runs on an event
// thread: a slow network would otherwise stall order handling.

namespace NinjaTrader.NinjaScript.AddOns
{
	public class NexusReporter : NinjaTrader.NinjaScript.AddOnBase
	{
		// ── Configuration ───────────────────────────────────────────────────────

		private const string Endpoint = "https://nexus-ia.com.es/api/trading/events";
		private const string Token    = "REEMPLAZAR_CON_NT_INGEST_TOKEN";

		/// <summary>How often queued events are sent, in milliseconds.</summary>
		private const int FlushIntervalMs = 5000;

		/// <summary>Ceiling per section per batch; matches the server's limit.</summary>
		private const int MaxItemsPerSection = 500;

		/// <summary>
		/// Batches kept when the server is unreachable. Beyond this the oldest
		/// are dropped: a stale backlog is worth less than a live feed.
		/// </summary>
		private const int MaxQueuedBatches = 200;

		// ── State ───────────────────────────────────────────────────────────────

		private readonly object       sync     = new object();
		private readonly List<string> accounts = new List<string>();

		private readonly List<Dictionary<string, object>> pendingAccounts   = new List<Dictionary<string, object>>();
		private readonly List<Dictionary<string, object>> pendingExecutions = new List<Dictionary<string, object>>();
		private readonly List<Dictionary<string, object>> pendingPositions  = new List<Dictionary<string, object>>();
		private readonly List<Dictionary<string, object>> pendingTrades     = new List<Dictionary<string, object>>();

		/// <summary>Batches that failed to send, retried on the next flush.</summary>
		private readonly Queue<string> retryQueue = new Queue<string>();

		/// <summary>Open position being accumulated, keyed account|instrument.</summary>
		private readonly Dictionary<string, OpenTrade> openTrades = new Dictionary<string, OpenTrade>();

		private readonly List<Account> subscribed = new List<Account>();
		private Timer flushTimer;

		/// <summary>Fills of one position, kept until it returns to flat.</summary>
		private class OpenTrade
		{
			public string   Account;
			public string   Instrument;
			public string   Direction;      // Long or Short
			public int      Quantity;       // contracts currently open
			public double   EntryNotional;  // sum(price * qty) of entry fills
			public int      EntryQuantity;
			public double   ExitNotional;
			public int      ExitQuantity;
			public double   Commission;
			public double   PointValue;
			public DateTime EntryAt;
		}

		// ── Lifecycle ───────────────────────────────────────────────────────────

		protected override void OnStateChange()
		{
			if (State == State.SetDefaults)
			{
				Name        = "Nexus Reporter";
				Description = "Envía cuentas, posiciones y operaciones de NT8 al panel de Nexus.";
			}
			else if (State == State.Configure)
			{
				Subscribe();
				flushTimer = new Timer(_ => Flush(), null, FlushIntervalMs, FlushIntervalMs);
				Log("Nexus Reporter iniciado. Endpoint: " + Endpoint);
			}
			else if (State == State.Terminated)
			{
				if (flushTimer != null)
				{
					flushTimer.Dispose();
					flushTimer = null;
				}
				Unsubscribe();
				// Last chance to drain whatever is queued before shutdown.
				Flush();
				Log("Nexus Reporter detenido.");
			}
		}

		private void Subscribe()
		{
			// Account.All is mutated by NinjaTrader as connections come and go.
			lock (Account.All)
			{
				foreach (Account account in Account.All)
				{
					account.AccountItemUpdate += OnAccountItemUpdate;
					account.ExecutionUpdate   += OnExecutionUpdate;
					account.PositionUpdate    += OnPositionUpdate;
					subscribed.Add(account);

					lock (sync)
						if (!accounts.Contains(account.Name))
							accounts.Add(account.Name);

					QueueAccountSnapshot(account);
				}
			}
		}

		private void Unsubscribe()
		{
			foreach (Account account in subscribed)
			{
				account.AccountItemUpdate -= OnAccountItemUpdate;
				account.ExecutionUpdate   -= OnExecutionUpdate;
				account.PositionUpdate    -= OnPositionUpdate;
			}
			subscribed.Clear();
		}

		// ── Event handlers ──────────────────────────────────────────────────────

		private void OnAccountItemUpdate(object sender, AccountItemEventArgs e)
		{
			try
			{
				if (e.Account != null)
					QueueAccountSnapshot(e.Account);
			}
			catch (Exception ex) { Log("OnAccountItemUpdate: " + ex.Message); }
		}

		private void OnExecutionUpdate(object sender, ExecutionEventArgs e)
		{
			try
			{
				Execution exec = e.Execution;
				if (exec == null || exec.Instrument == null || exec.Account == null)
					return;

				// Amendments and removals reuse an id we have already reported;
				// the server upserts on that id, so re-sending is harmless.
				string instrument = exec.Instrument.FullName;
				string action     = exec.Order != null ? exec.Order.OrderAction.ToString() : null;

				Dictionary<string, object> row = new Dictionary<string, object>
				{
					{ "id",             exec.ExecutionId },
					{ "account",        exec.Account.Name },
					{ "instrument",     instrument },
					{ "orderAction",    action },
					{ "marketPosition", exec.MarketPosition.ToString() },
					{ "quantity",       e.Quantity },
					{ "price",          e.Price },
					{ "commission",     exec.Commission },
					{ "orderId",        exec.Order != null ? exec.Order.OrderId : null },
					{ "executedAt",     Iso(exec.Time) }
				};

				lock (sync)
					pendingExecutions.Add(row);

				AccumulateTrade(exec, action, e.Quantity, e.Price);
			}
			catch (Exception ex) { Log("OnExecutionUpdate: " + ex.Message); }
		}

		private void OnPositionUpdate(object sender, PositionEventArgs e)
		{
			try
			{
				if (e.Position == null || e.Position.Instrument == null || e.Position.Account == null)
					return;

				// A removed position is flat, whatever MarketPosition still says.
				bool flat = e.Operation == Operation.Remove || e.MarketPosition == MarketPosition.Flat;

				Dictionary<string, object> row = new Dictionary<string, object>
				{
					{ "account",        e.Position.Account.Name },
					{ "instrument",     e.Position.Instrument.FullName },
					{ "marketPosition", flat ? "Flat" : e.MarketPosition.ToString() },
					{ "quantity",       flat ? 0 : e.Quantity },
					{ "averagePrice",   e.AveragePrice },
					{ "unrealizedPnl",  (object)null },
					{ "openedAt",       (object)null },
					{ "reportedAt",     Iso(DateTime.UtcNow) }
				};

				lock (sync)
					pendingPositions.Add(row);
			}
			catch (Exception ex) { Log("OnPositionUpdate: " + ex.Message); }
		}

		// ── Trade pairing ───────────────────────────────────────────────────────

		/// <summary>
		/// Builds closed trades out of fills. NT8's Account class exposes no
		/// Trades collection, so entries and exits are paired here: fills in the
		/// direction of the open position add to it, opposite fills reduce it,
		/// and reaching zero emits one trade.
		/// </summary>
		private void AccumulateTrade(Execution exec, string action, int quantity, double price)
		{
			string key        = exec.Account.Name + "|" + exec.Instrument.FullName;
			bool   isBuy      = action == "Buy" || action == "BuyToCover";
			double pointValue = exec.Instrument.MasterInstrument.PointValue;

			lock (sync)
			{
				OpenTrade open;
				if (!openTrades.TryGetValue(key, out open))
				{
					open = new OpenTrade
					{
						Account    = exec.Account.Name,
						Instrument = exec.Instrument.FullName,
						Direction  = isBuy ? "Long" : "Short",
						PointValue = pointValue,
						EntryAt    = exec.Time
					};
					openTrades[key] = open;
				}

				bool addsToPosition = (open.Direction == "Long" && isBuy)
				                   || (open.Direction == "Short" && !isBuy);

				open.Commission += exec.Commission;

				if (addsToPosition)
				{
					open.EntryNotional += price * quantity;
					open.EntryQuantity += quantity;
					open.Quantity      += quantity;
				}
				else
				{
					open.ExitNotional += price * quantity;
					open.ExitQuantity += quantity;
					open.Quantity     -= quantity;
				}

				if (open.Quantity > 0 || open.EntryQuantity == 0 || open.ExitQuantity == 0)
					return;

				double entryAvg = open.EntryNotional / open.EntryQuantity;
				double exitAvg  = open.ExitNotional / open.ExitQuantity;
				double points   = open.Direction == "Long" ? exitAvg - entryAvg : entryAvg - exitAvg;
				int    closed   = Math.Min(open.EntryQuantity, open.ExitQuantity);

				Dictionary<string, object> trade = new Dictionary<string, object>
				{
					{ "id",           key + "|" + Iso(exec.Time) },
					{ "account",      open.Account },
					{ "instrument",   open.Instrument },
					{ "direction",    open.Direction },
					{ "quantity",     closed },
					{ "entryPrice",   entryAvg },
					{ "exitPrice",    exitAvg },
					{ "pointValue",   open.PointValue },
					{ "pnlPoints",    points },
					{ "pnlCurrency",  points * closed * open.PointValue - open.Commission },
					{ "commission",   open.Commission },
					{ "entryAt",      Iso(open.EntryAt) },
					{ "exitAt",       Iso(exec.Time) }
				};

				pendingTrades.Add(trade);
				openTrades.Remove(key);
			}
		}

		// ── Account snapshots ───────────────────────────────────────────────────

		private void QueueAccountSnapshot(Account account)
		{
			try
			{
				Currency ccy = account.Denomination;

				Dictionary<string, object> row = new Dictionary<string, object>
				{
					{ "name",           account.Name },
					{ "connection",     account.Connection != null ? account.Connection.Options.Name : null },
					{ "denomination",   ccy.ToString() },
					{ "cashValue",      SafeGet(account, AccountItem.CashValue, ccy) },
					{ "realizedPnl",    SafeGet(account, AccountItem.RealizedProfitLoss, ccy) },
					{ "unrealizedPnl",  SafeGet(account, AccountItem.UnrealizedProfitLoss, ccy) },
					{ "grossRealized",  SafeGet(account, AccountItem.GrossRealizedProfitLoss, ccy) },
					{ "buyingPower",    SafeGet(account, AccountItem.BuyingPower, ccy) },
					{ "netLiquidation", SafeGet(account, AccountItem.NetLiquidation, ccy) },
					{ "reportedAt",     Iso(DateTime.UtcNow) }
				};

				lock (sync)
				{
					// Only the newest snapshot per account is worth sending.
					pendingAccounts.RemoveAll(a => (string)a["name"] == account.Name);
					pendingAccounts.Add(row);
				}
			}
			catch (Exception ex) { Log("QueueAccountSnapshot: " + ex.Message); }
		}

		/// <summary>
		/// Reads one account item. Not every broker reports every item, and an
		/// unsupported one throws rather than returning zero, so a failure here
		/// means "unknown" and is sent as null.
		/// </summary>
		private object SafeGet(Account account, AccountItem item, Currency currency)
		{
			try { return account.Get(item, currency); }
			catch { return null; }
		}

		// ── Sending ─────────────────────────────────────────────────────────────

		private void Flush()
		{
			string batch = null;

			lock (sync)
			{
				bool hasNew = pendingAccounts.Count > 0 || pendingExecutions.Count > 0
				           || pendingPositions.Count > 0 || pendingTrades.Count > 0;

				if (hasNew)
				{
					batch = BuildJson();
					pendingAccounts.Clear();
					pendingExecutions.Clear();
					pendingPositions.Clear();
					pendingTrades.Clear();
				}
			}

			// Anything new goes to the back of the queue, so a backlog is sent in
			// the order it happened.
			if (batch != null)
				Enqueue(batch);

			while (true)
			{
				string next;
				lock (sync)
				{
					if (retryQueue.Count == 0) return;
					next = retryQueue.Peek();
				}

				if (!Send(next))
					return; // Still down. Keep it queued and try again next tick.

				lock (sync)
					if (retryQueue.Count > 0)
						retryQueue.Dequeue();
			}
		}

		private void Enqueue(string batch)
		{
			lock (sync)
			{
				while (retryQueue.Count >= MaxQueuedBatches)
					retryQueue.Dequeue();
				retryQueue.Enqueue(batch);
			}
		}

		private bool Send(string json)
		{
			try
			{
				ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

				HttpWebRequest request = (HttpWebRequest)WebRequest.Create(Endpoint);
				request.Method      = "POST";
				request.ContentType = "application/json";
				request.Timeout     = 15000;
				request.Headers.Add("x-nexus-token", Token);

				byte[] body = Encoding.UTF8.GetBytes(json);
				request.ContentLength = body.Length;
				using (var stream = request.GetRequestStream())
					stream.Write(body, 0, body.Length);

				using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
					return (int)response.StatusCode >= 200 && (int)response.StatusCode < 300;
			}
			catch (WebException ex)
			{
				HttpWebResponse res = ex.Response as HttpWebResponse;
				if (res != null)
				{
					int code = (int)res.StatusCode;
					// 4xx means this batch will never be accepted; retrying it
					// forever would block everything behind it.
					if (code >= 400 && code < 500 && code != 429)
					{
						Log("Lote rechazado (" + code + "), descartado.");
						lock (sync)
							if (retryQueue.Count > 0)
								retryQueue.Dequeue();
						return false;
					}
				}
				Log("Envío fallido: " + ex.Message);
				return false;
			}
			catch (Exception ex)
			{
				Log("Envío fallido: " + ex.Message);
				return false;
			}
		}

		// ── JSON ────────────────────────────────────────────────────────────────
		// Hand-rolled so the AddOn has no dependency beyond the .NET framework
		// NinjaTrader already ships. Called with sync held.

		private string BuildJson()
		{
			StringBuilder sb = new StringBuilder(1024);
			sb.Append('{');
			bool first = true;

			AppendSection(sb, "accounts",   pendingAccounts,   ref first);
			AppendSection(sb, "executions", pendingExecutions, ref first);
			AppendSection(sb, "positions",  pendingPositions,  ref first);
			AppendSection(sb, "trades",     pendingTrades,     ref first);

			sb.Append('}');
			return sb.ToString();
		}

		private void AppendSection(StringBuilder sb, string name,
			List<Dictionary<string, object>> rows, ref bool first)
		{
			if (rows.Count == 0) return;

			if (!first) sb.Append(',');
			first = false;

			sb.Append('"').Append(name).Append("\":[");
			int count = Math.Min(rows.Count, MaxItemsPerSection);
			for (int i = 0; i < count; i++)
			{
				if (i > 0) sb.Append(',');
				AppendObject(sb, rows[i]);
			}
			sb.Append(']');
		}

		private void AppendObject(StringBuilder sb, Dictionary<string, object> row)
		{
			sb.Append('{');
			bool first = true;
			foreach (KeyValuePair<string, object> kv in row)
			{
				if (!first) sb.Append(',');
				first = false;
				sb.Append('"').Append(kv.Key).Append("\":");
				AppendValue(sb, kv.Value);
			}
			sb.Append('}');
		}

		private void AppendValue(StringBuilder sb, object value)
		{
			if (value == null)
			{
				sb.Append("null");
				return;
			}

			if (value is string)
			{
				AppendString(sb, (string)value);
				return;
			}

			if (value is int || value is long)
			{
				sb.Append(Convert.ToInt64(value).ToString(CultureInfo.InvariantCulture));
				return;
			}

			if (value is double || value is float || value is decimal)
			{
				double d = Convert.ToDouble(value, CultureInfo.InvariantCulture);
				// NaN and infinity are not valid JSON; report them as unknown.
				if (double.IsNaN(d) || double.IsInfinity(d)) sb.Append("null");
				else sb.Append(d.ToString("R", CultureInfo.InvariantCulture));
				return;
			}

			if (value is bool)
			{
				sb.Append((bool)value ? "true" : "false");
				return;
			}

			AppendString(sb, value.ToString());
		}

		private void AppendString(StringBuilder sb, string s)
		{
			sb.Append('"');
			foreach (char c in s)
			{
				switch (c)
				{
					case '"':  sb.Append("\\\""); break;
					case '\\': sb.Append("\\\\"); break;
					case '\b': sb.Append("\\b");  break;
					case '\f': sb.Append("\\f");  break;
					case '\n': sb.Append("\\n");  break;
					case '\r': sb.Append("\\r");  break;
					case '\t': sb.Append("\\t");  break;
					default:
						if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
						else sb.Append(c);
						break;
				}
			}
			sb.Append('"');
		}

		// ── Helpers ─────────────────────────────────────────────────────────────

		/// <summary>
		/// NinjaTrader reports times in the platform's local zone; the server
		/// stores timestamptz, so everything is converted to UTC here.
		/// </summary>
		private static string Iso(DateTime dt)
		{
			DateTime utc = dt.Kind == DateTimeKind.Utc ? dt : dt.ToUniversalTime();
			return utc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
		}

		private static void Log(string message)
		{
			NinjaTrader.Code.Output.Process("[NexusReporter] " + message, PrintTo.OutputTab1);
		}
	}
}
