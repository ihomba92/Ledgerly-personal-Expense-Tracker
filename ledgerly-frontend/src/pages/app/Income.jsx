import { useMemo, useState } from "react";
import { cn, formatCompact, formatDate, formatMoney, formatWhole, monthKey, monthLabel, shiftMonth, todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/shared/Icon";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { isPaid, useAppData } from "@/store/AppData";
import { monthlyTotals, sum } from "@/lib/ledger";
import { FUNDING_SOURCES, sourceById } from "@/data/wallet";

const PAGE_SIZE = 10;
const COLORS = ["bg-primary", "bg-positive-vibrant", "bg-secondary", "bg-accent-sand", "bg-tertiary", "bg-outline"];

export default function Income() {
  const { topUps, expenses, balance, openTopUp, deleteTopUp, restoreTopUp } = useAppData();
  const toast = useToast();
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);

  const month = monthKey(todayISO());
  const inMonth = sum(topUps.filter((t) => monthKey(t.date) === month));
  const outMonth = sum(expenses.filter((e) => isPaid(e) && monthKey(e.date) === month));
  const lastMonth = sum(topUps.filter((t) => monthKey(t.date) === shiftMonth(month, -1)));
  const six = monthlyTotals(topUps, month, 6);
  const sixOut = monthlyTotals(expenses.filter(isPaid), month, 6);
  const activeMonths = six.filter((x) => x.amount > 0).length || 1;
  const avg = sum(six) / activeMonths;
  const saved = inMonth - outMonth;

  const bySource = useMemo(() => {
    const total = sum(topUps) || 1;
    return FUNDING_SOURCES.map((s) => ({ ...s, amount: sum(topUps.filter((t) => t.source === s.id)) }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((s) => ({ ...s, pct: (s.amount / total) * 100 }));
  }, [topUps]);

  const list = [...topUps].filter((t) => source === "all" || t.source === source).sort((a, b) => b.date.localeCompare(a.date));
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const remove = async (t) => {
    if (balance - t.amount < 0) return toast("Removing this would leave your balance below zero.", { tone: "info" });
    try {
      await deleteTopUp(t.id);
    } catch (err) {
      return toast(err.message, { tone: "info" });
    }
    toast(`${formatWhole(t.amount)} removed from your balance`, { tone: "info", action: { label: "Undo", onClick: () => restoreTopUp(t).catch((e) => toast(e.message, { tone: "info" })) } });
  };

  const max = Math.max(...six.map((x) => x.amount), ...sixOut.map((x) => x.amount), 1);

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-positive-deep" />
            <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">Money In</span>
          </div>
          <h1 className="font-display-hero-mobile text-display-hero-mobile md:font-display-hero md:text-display-hero text-text-primary tracking-tight">Income</h1>
        </div>
        <Button className="h-auto px-4 py-2 self-start md:self-auto" onClick={openTopUp}><Icon name="add_card" /> <span>Record income</span></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label={`In ${monthLabel(month, { month: "long" })}`} icon="south_west" value={formatWhole(inMonth)}
          note={lastMonth ? `${formatWhole(lastMonth)} last month` : "Nothing last month"} />
        <Stat label="Monthly average" icon="equalizer" value={formatWhole(avg)} note="Over the last 6 months" />
        <Stat label="Kept this month" icon="savings" value={formatWhole(saved)} note={saved >= 0 ? "Income minus spending" : "You’ve spent more than came in"} tone={saved < 0 ? "negative" : "positive"} />
        <Stat label="Main source" icon={bySource[0]?.icon ?? "help"} value={bySource[0]?.label ?? "None yet"} note={bySource[0] ? `${Math.round(bySource[0].pct)}% of all income` : "Record income to see this"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* In vs out */}
        <div className="lg:col-span-7 bg-surface-card rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-title-card text-title-card text-text-primary">In vs Out</h2>
              <p className="font-body-sm text-body-sm text-text-tertiary">Income and paid expenses for the last 6 months</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-primary" /><span className="font-label-uppercase text-label-uppercase text-text-secondary">In</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-accent-sand" /><span className="font-label-uppercase text-label-uppercase text-text-secondary">Out</span></span>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-3 h-52 items-end" role="img" aria-label="Income and spending for the last six months">
            {six.map((x, i) => (
              <div key={x.key} className="flex flex-col items-center justify-end gap-2 h-full">
                <div className="flex items-end gap-1 h-full w-full justify-center">
                  <div title={`In: ${formatMoney(x.amount)}`} className="w-1/3 max-w-5 rounded-t-md bg-primary transition-all duration-500" style={{ height: `${(x.amount / max) * 100}%` }} />
                  <div title={`Out: ${formatMoney(sixOut[i].amount)}`} className="w-1/3 max-w-5 rounded-t-md bg-accent-sand transition-all duration-500" style={{ height: `${(sixOut[i].amount / max) * 100}%` }} />
                </div>
                <span className={cn("font-label-uppercase text-label-uppercase uppercase", x.key === month ? "text-text-primary" : "text-text-tertiary")}>{monthLabel(x.key, { month: "short" })}</span>
              </div>
            ))}
          </div>
          <p className="pt-3 border-t border-surface-container font-body-sm text-body-sm text-text-tertiary">
            Highest month: {formatCompact(Math.max(...six.map((x) => x.amount)))} in. Bars show totals, not running balance.
          </p>
        </div>

        {/* By source */}
        <div className="lg:col-span-5 bg-surface-card rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <div>
            <h2 className="font-title-card text-title-card text-text-primary">By Source</h2>
            <p className="font-body-sm text-body-sm text-text-tertiary">Where your money comes from</p>
          </div>
          {bySource.length === 0 ? (
            <p className="py-10 text-center font-body-sm text-body-sm text-text-tertiary">No income recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {bySource.map((s, i) => (
                <button key={s.id} type="button" onClick={() => { setSource(source === s.id ? "all" : s.id); setPage(1); }}
                  className={cn("w-full text-left space-y-1 rounded-lg p-2 -m-2 transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", source === s.id && "bg-positive-soft hover:bg-positive-soft")}>
                  <span className="flex justify-between items-center font-body-sm text-body-sm">
                    <span className="flex items-center gap-2 text-text-primary font-medium"><Icon name={s.icon} className="text-[16px] text-text-tertiary" />{s.label}</span>
                    <span className="font-table-cell-mono text-table-cell-mono text-text-secondary">{s.pct.toFixed(1)}% · {formatWhole(s.amount)}</span>
                  </span>
                  <span className="block w-full h-2 rounded-full bg-surface-container overflow-hidden">
                    <span className={cn("block h-full rounded-full", COLORS[i % COLORS.length])} style={{ width: `${s.pct}%` }} />
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-auto pt-3 border-t border-surface-container font-body-sm text-body-sm text-text-tertiary">Select a source to filter the list below.</p>
        </div>
      </div>

      <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-surface-subtle/50">
          <div className="flex items-center gap-2">
            <span className="font-title-card text-title-card text-text-primary">All income</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container font-table-cell-mono text-table-cell-mono text-text-secondary">{list.length} entries</span>
            {source !== "all" && (
              <button type="button" onClick={() => setSource("all")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-positive-soft text-positive-deep font-body-sm-medium text-body-sm-medium">
                {sourceById(source).label} <Icon name="close" className="text-[14px]" />
              </button>
            )}
          </div>
          <span className="font-table-cell-mono text-table-cell-mono text-text-secondary">Total {formatWhole(sum(list))}</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="savings" title="No income yet" description="Record your salary, M-Pesa transfers or any money you receive. It’s added to your balance." action={<Button size="sm" onClick={openTopUp}><Icon name="add_card" /> Record income</Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Details</TableHead>
                <TableHead className="px-4 hidden md:table-cell">Source</TableHead>
                <TableHead className="px-4 text-right">Amount</TableHead>
                <TableHead className="px-4 w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => {
                const s = sourceById(t.source);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-positive-soft text-positive-deep flex items-center justify-center shrink-0"><Icon name={s.icon} className="text-[18px]" /></div>
                        <div className="min-w-0">
                          <span className="font-body-medium text-body-medium text-text-primary block truncate">{t.note || s.label}</span>
                          <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">{formatDate(t.date)}{t.kind === "initial" ? " · Starting balance" : ""}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 hidden md:table-cell font-body-sm text-body-sm text-text-secondary">{s.label}</TableCell>
                    <TableCell className="px-4 text-right font-table-cell-mono text-table-cell-mono font-semibold text-positive-deep whitespace-nowrap">+{formatMoney(t.amount)}</TableCell>
                    <TableCell className="px-4 text-center">
                      <button type="button" onClick={() => remove(t)} aria-label={`Remove ${t.note || s.label}`} title="Remove"
                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-text-tertiary hover:text-negative-deep hover:bg-negative-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="px-4 py-3 bg-surface-subtle/30 flex items-center justify-between gap-3">
          <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">{list.length ? `Showing ${(current - 1) * PAGE_SIZE + 1}-${(current - 1) * PAGE_SIZE + rows.length} of ${list.length}` : "No entries"}</span>
          <Pagination page={current} pageCount={pageCount} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, icon, value, note, tone }) {
  return (
    <div className="bg-surface-card p-4 rounded-xl shadow-sm flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2 text-text-tertiary">
        <span className="font-label-uppercase text-label-uppercase uppercase truncate">{label}</span>
        <Icon name={icon} className="text-[18px]" />
      </div>
      <div>
        <span className={cn("font-metric-md text-metric-md", tone === "negative" ? "text-negative-deep" : "text-text-primary")}>{value}</span>
        <p className="font-body-sm text-body-sm text-text-tertiary mt-0.5">{note}</p>
      </div>
    </div>
  );
}
