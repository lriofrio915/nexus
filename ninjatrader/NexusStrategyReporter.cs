#region Using declarations
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Text;
using System.Threading;
#endregion

// NexusStrategyReporter — shared helper the 3 mirrored strategies call to
// report per-strategy trading events (open / stop moved / closed) to Nexus.
//
// NexusReporter.cs (the AddOn) reports at the account level: NT8's
// Account.ExecutionUpdate event carries no strategy identity, so it cannot
// tell which bot placed a given fill (documented in the nexus repo's
// 0009_nexus_biz_account_strategies migration). Each Strategy instance does
// know its own identity, so the report has to originate there instead — this
// class is the shared sending machinery every mirrored strategy calls into,
// so there is one flush loop and one retry queue for all of them rather than
// three independent ones.
//
// Install: copy this file next to the strategy files, in
//   Documents\NinjaTrader 8\bin\Custom\Strategies\NexusStrategyReporter.cs
// then compile together with them (F5 in NinjaScript Editor). Configure
// Endpoint and Token below — same values as NexusReporter.cs / NT_INGEST_TOKEN.
//
// Thread safety follows NexusReporter.cs: OnExecutionUpdate/OnOrderUpdate
// fire on NinjaTrader's own threads, so ReportEvent only ever queues under a
// lock. A single static timer flushes in the background; no HTTP call runs
// on a strategy event thread.
namespace NinjaTrader.NinjaScript.Strategies
{
	public static class NexusStrategyReporter
	{
		// ── Configuration ───────────────────────────────────────────────────────
		// Must match NexusReporter.cs: same server, same shared secret. The
		// server route accepts an optional "strategyEvents" section alongside
		// the account-level sections the AddOn already sends.

		private const string Endpoint = "https://nexus-ia.com.es/api/trading/events";
		private const string Token    = "REEMPLAZAR_CON_NT_INGEST_TOKEN";

		private const int FlushIntervalMs   = 5000;
		private const int MaxItemsPerBatch  = 200;
		private const int MaxQueuedBatches  = 200;

		private static readonly object sync = new object();
		private static readonly List<Dictionary<string, object>> pending = new List<Dictionary<string, object>>();
		private static readonly Queue<string> retryQueue = new Queue<string>();

		/// <summary>Last stop price reported per account|strategy|instrument, to
		/// dedupe a trailing stop (Momentum Apertura) that recalculates every bar
		/// without actually moving.</summary>
		private static readonly Dictionary<string, double> lastReportedStop = new Dictionary<string, double>();

		private static Timer flushTimer;
		private static readonly object timerInit = new object();

		private static void EnsureTimerStarted()
		{
			if (flushTimer != null) return;
			lock (timerInit)
			{
				if (flushTimer != null) return;
				flushTimer = new Timer(_ => Flush(), null, FlushIntervalMs, FlushIntervalMs);
			}
		}

		// ── Public API ──────────────────────────────────────────────────────────

		/// <summary>
		/// Reports a position opening. Call once, right after the entry fills
		/// (OnExecutionUpdate for the entry execution).
		/// </summary>
		public static void ReportOpened(string account, string strategy, string instrument,
			string direction, int quantity, double entryPrice, double stopPrice, DateTime timeUtc)
		{
			string key = StopKey(account, strategy, instrument);
			lock (sync) lastReportedStop[key] = stopPrice;

			Report(account, strategy, instrument, "opened", direction, quantity,
				entryPrice, stopPrice, timeUtc);
		}

		/// <summary>
		/// Reports a stop move, but only if the new price actually differs from
		/// the last one reported for this account+strategy+instrument. Momentum
		/// Apertura's SetTrailStop recalculates every bar; most of those calls
		/// are not an actual move and would otherwise flood WhatsApp.
		/// </summary>
		public static void ReportStopMoved(string account, string strategy, string instrument,
			string direction, int quantity, double stopPrice, DateTime timeUtc)
		{
			string key = StopKey(account, strategy, instrument);
			lock (sync)
			{
				double last;
				if (lastReportedStop.TryGetValue(key, out last) && last == stopPrice)
					return; // No real change — skip.
				lastReportedStop[key] = stopPrice;
			}

			Report(account, strategy, instrument, "stop_moved", direction, quantity,
				(double?)null, stopPrice, timeUtc);
		}

		/// <summary>Reports a position closing, with the exit price and realized P&amp;L.</summary>
		public static void ReportClosed(string account, string strategy, string instrument,
			string direction, int quantity, double exitPrice, double pnlCurrency, DateTime timeUtc)
		{
			string key = StopKey(account, strategy, instrument);
			lock (sync) lastReportedStop.Remove(key);

			Dictionary<string, object> row = BaseRow(account, strategy, instrument, "closed",
				direction, quantity, timeUtc);
			row["price"]       = exitPrice;
			row["stopPrice"]   = null;
			row["pnlCurrency"] = pnlCurrency;

			Enqueue(row);
		}

		private static void Report(string account, string strategy, string instrument,
			string eventType, string direction, int quantity, double? price, double stopPrice,
			DateTime timeUtc)
		{
			Dictionary<string, object> row = BaseRow(account, strategy, instrument, eventType,
				direction, quantity, timeUtc);
			row["price"]     = price;
			row["stopPrice"] = stopPrice;

			Enqueue(row);
		}

		private static Dictionary<string, object> BaseRow(string account, string strategy,
			string instrument, string eventType, string direction, int quantity, DateTime timeUtc)
		{
			string occurredAt = Iso(timeUtc);
			return new Dictionary<string, object>
			{
				// Idempotency key: same shape as NexusReporter's trade id — deriving
				// it from the event's own fields means a retried batch after a
				// network failure upserts instead of duplicating.
				{ "id",          account + "|" + strategy + "|" + instrument + "|" + eventType + "|" + occurredAt },
				{ "account",     account },
				{ "strategy",    strategy },
				{ "instrument",  instrument },
				{ "eventType",   eventType },
				{ "direction",   direction },
				{ "quantity",    quantity },
				{ "occurredAt",  occurredAt }
			};
		}

		private static string StopKey(string account, string strategy, string instrument)
		{
			return account + "|" + strategy + "|" + instrument;
		}

		private static void Enqueue(Dictionary<string, object> row)
		{
			EnsureTimerStarted();
			lock (sync)
				pending.Add(row);
		}

		// ── Sending ─────────────────────────────────────────────────────────────
		// Identical pattern to NexusReporter.cs: batch under lock, flush on a
		// timer, retry with a capped queue, drop 4xx batches instead of retrying
		// forever.

		private static void Flush()
		{
			string batch = null;

			lock (sync)
			{
				if (pending.Count > 0)
				{
					batch = BuildJson();
					pending.Clear();
				}
			}

			if (batch != null)
				EnqueueBatch(batch);

			while (true)
			{
				string next;
				lock (sync)
				{
					if (retryQueue.Count == 0) return;
					next = retryQueue.Peek();
				}

				if (!Send(next))
					return;

				lock (sync)
					if (retryQueue.Count > 0)
						retryQueue.Dequeue();
			}
		}

		private static void EnqueueBatch(string batch)
		{
			lock (sync)
			{
				while (retryQueue.Count >= MaxQueuedBatches)
					retryQueue.Dequeue();
				retryQueue.Enqueue(batch);
			}
		}

		private static bool Send(string json)
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
		// Hand-rolled, same as NexusReporter.cs — no dependency beyond the .NET
		// framework NinjaTrader already ships.

		private static string BuildJson()
		{
			StringBuilder sb = new StringBuilder(512);
			sb.Append("{\"strategyEvents\":[");
			int count = Math.Min(pending.Count, MaxItemsPerBatch);
			for (int i = 0; i < count; i++)
			{
				if (i > 0) sb.Append(',');
				AppendObject(sb, pending[i]);
			}
			sb.Append("]}");
			return sb.ToString();
		}

		private static void AppendObject(StringBuilder sb, Dictionary<string, object> row)
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

		private static void AppendValue(StringBuilder sb, object value)
		{
			if (value == null) { sb.Append("null"); return; }

			if (value is string) { AppendString(sb, (string)value); return; }

			if (value is int || value is long)
			{
				sb.Append(Convert.ToInt64(value).ToString(CultureInfo.InvariantCulture));
				return;
			}

			if (value is double || value is float || value is decimal)
			{
				double d = Convert.ToDouble(value, CultureInfo.InvariantCulture);
				if (double.IsNaN(d) || double.IsInfinity(d)) sb.Append("null");
				else sb.Append(d.ToString("R", CultureInfo.InvariantCulture));
				return;
			}

			if (value is bool) { sb.Append((bool)value ? "true" : "false"); return; }

			AppendString(sb, value.ToString());
		}

		private static void AppendString(StringBuilder sb, string s)
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

		private static string Iso(DateTime dt)
		{
			DateTime utc = dt.Kind == DateTimeKind.Utc ? dt : dt.ToUniversalTime();
			return utc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
		}

		private static void Log(string message)
		{
			NinjaTrader.Code.Output.Process("[NexusStrategyReporter] " + message, PrintTo.OutputTab1);
		}
	}
}
