-- Drop nexus_biz_equity_daily.realized_pnl.
--
-- The column was written by /api/cron/equity, which copied
-- nexus_nt_accounts.realized_pnl into it. That value comes from NinjaTrader's
-- AccountItem.RealizedProfitLoss, which resets when the trading session opens.
-- The snapshot runs around 00:09 UTC, roughly two hours after the futures
-- session opens, so it never had anything but zero to copy.
--
-- The evidence is in the data it produced: Sim101's equity went from 100000.00
-- to 100157.00 between two snapshots -- a realized gain -- and realized_pnl was
-- recorded as 0.00 in both. Every row ever written held 0.00.
--
-- Daily P&L was never meant to live here anyway; it is derived from
-- nexus_nt_trades on read. A column that is structurally always zero is worse
-- than no column at all, because it reads like a figure rather than an absence.
--
-- Nothing else reads it: the panel's realized_pnl comes from nexus_nt_accounts,
-- which is untouched and still carries the live per-account value.

alter table public.nexus_biz_equity_daily
  drop column if exists realized_pnl;
