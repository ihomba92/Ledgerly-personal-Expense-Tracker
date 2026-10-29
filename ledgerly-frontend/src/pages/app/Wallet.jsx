import { useMemo, useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/shared/Icon";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { isPaid, useAppData } from "@/store/AppData";
import { sourceById } from "@/data/wallet";

const PAGE_SIZE = 10;
const TABS = [
  { value: "all", label: "All activity" },
  { value: "in", label: "Top-ups" },
  { value: "out", label: "Expenses" },
];
const m = (v) => formatMoney(v);
const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function Wallet() {
  const { balance, toppedUp, spent, drafts, topUps, expenses, openTopUp, openExpenseDrawer, deleteTopUp, restoreTopUp, categoryById } = useAppData();
  const toast = useToast();
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);

  // Every paid expense and top-up in date order, with the balance after each one.
  const ledger = useMemo(() => {
    const items = [
      ...topUps.map((t) => ({ kind: "in", id: t.id, date: t.date, amount: t.amount, title: t.note || sourceById(t.source).label, meta: sourceById(t.source).label, icon: sourceById(t.source).icon, ref: t })),
      ...expenses.filter(isPaid).map((e) => ({ kind: "out", id: e.id, date: e.date, amount: e.amount, title: e.subject, meta: `${categoryById(e.category).label} · ${e.merchant}`, icon: categoryById(e.category).icon, ref: e })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "in" ? -1 : 1));
    let running = 0;
    items.forEach((i) => { running += i.kind === "in" ? i.amount : -i.amount; i.after = running; });
    return items.reverse();
  }, [topUps, expenses, categoryById]);

  const shown = tab === "all" ? ledger : ledger.filter((i) => i.kind === tab);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // This month = the month of the latest activity, so the demo data reads sensibly.
  const month = (ledger[0]?.date ?? new Date().toISOString()).slice(0, 7);
  const monthIn = ledger.filter((i) => i.kind === "in" && i.date.startsWith(month)).reduce((s, i) => s + i.amount, 0);
  const monthOut = ledger.filter((i) => i.kind === "out" && i.date.startsWith(month)).reduce((s, i) => s + i.amount, 0);
  const monthLabel = new Date(month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const usedPct = toppedUp > 0 ? Math.min(100, (spent / toppedUp) * 100) : 0;
  const low = toppedUp > 0 && balance < toppedUp * 0.1;

  const removeTopUp = async (t) => {
    if (balance - t.amount < 0) {
      toast(`Removing this top-up would leave your balance below zero.`, { tone: "info" });
      return;
    }
    try {
      await deleteTopUp(t.id);
    } catch (err) {
      return toast(err.message, { tone: "info" });
    }
    toast(`Top-up of ${m(t.amount)} removed`, { tone: "info", action: { label: "Undo", onClick: () => restoreTopUp(t).catch((e) => toast(e.message, { tone: "info" })) } });
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-positive-deep" />
            <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">Personal Ledger</span>
          </div>
          <h1 className="font-display-hero-mobile text-display-hero-mobile md:font-display-hero md:text-display-hero text-text-primary tracking-tight">Wallet</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" className="h-auto px-3 py-2" onClick={() => openExpenseDrawer()}>
            <Icon name="remove" /> <span>Record expense</span>
          </Button>
          <Button className="h-auto px-4 py-2" onClick={openTopUp}>
            <Icon name="add_card" /> <span>{topUps.length ? "Top up" : "Add balance"}</span>
          </Button>
        </div>
      </div>

      {topUps.length === 0 ? (
        <div className="bg-surface-card rounded-xl shadow-sm">
          <EmptyState
            icon="account_balance_wallet"
            title="Add your starting balance"
            description="Tell Ledgerly how much money you have. Each expense you record is then taken from it, so you always know what’s left."
            action={<Button onClick={openTopUp}><Icon name="add_card" /> Add balance</Button>}
          />
        </div>
      ) : (
        <>
          {/* Balance hero */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-7 relative overflow-hidden bg-primary rounded-xl p-6 sm:p-8 text-on-primary flex flex-col justify-between gap-8">
              <div aria-hidden="true" className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 36px)" }} />
              <div className="relative flex items-center justify-between gap-3">
                <span className="font-label-uppercase text-label-uppercase uppercase tracking-wider text-on-primary-container">Available balance</span>
                {low ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-negative-soft text-negative-deep font-label-uppercase text-label-uppercase"><span className="w-1.5 h-1.5 rounded-full bg-negative-vibrant" />Running low</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-card/15 text-primary-fixed font-label-uppercase text-label-uppercase"><span className="w-1.5 h-1.5 rounded-full bg-primary-fixed-dim" />Healthy</span>
                )}
              </div>
              <div className="relative">
                <p className={cn("font-display-hero-mobile text-display-hero-mobile sm:text-[56px] sm:leading-[60px] tracking-[-0.02em]", balance < 0 ? "text-secondary-fixed" : "text-surface-card")}>{m(balance)}</p>
                <p className="mt-2 font-body-regular text-body-regular text-on-primary-container">
                  {m(toppedUp)} added in {topUps.length} top-up{topUps.length === 1 ? "" : "s"}, {m(spent)} spent.
                </p>
              </div>
              <div className="relative flex flex-col gap-2">
                <div className="w-full bg-surface-card/15 rounded-full h-2 overflow-hidden" role="img" aria-label={`${Math.round(usedPct)}% of topped-up money spent`}>
                  <div className="bg-accent-sand h-full rounded-full transition-all duration-500" style={{ width: `${usedPct}%` }} />
                </div>
                <div className="flex justify-between font-body-sm text-body-sm text-on-primary-container">
                  <span>{Math.round(usedPct)}% of your money spent</span>
                  <span>{Math.round(100 - usedPct)}% left</span>
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MiniStat label={`In, ${monthLabel}`} icon="south_west" value={m(monthIn)} tone="positive" />
              <MiniStat label={`Out, ${monthLabel}`} icon="north_east" value={m(monthOut)} tone="negative" />
              <MiniStat label="Total topped up" icon="savings" value={m(toppedUp)} />
              <MiniStat
                label="Waiting as drafts"
                icon="pending"
                value={m(drafts)}
                hint={drafts > 0 ? (drafts > balance ? "More than your balance" : `Leaves ${m(balance - drafts)} if paid`) : "Nothing pending"}
                hintTone={drafts > balance ? "negative" : undefined}
              />
            </div>
          </div>

          {/* Activity */}
          <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-surface-subtle/50">
              <div className="flex items-center gap-2">
                <span className="font-title-card text-title-card text-text-primary">Balance history</span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container font-table-cell-mono text-table-cell-mono text-text-secondary">{shown.length} entries</span>
              </div>
              <SegmentedControl options={TABS} value={tab} onChange={(v) => { setTab(v); setPage(1); }} label="Show" />
            </div>

            {rows.length === 0 ? (
              <EmptyState icon="receipt_long" title={tab === "in" ? "No top-ups yet" : "No paid expenses yet"} description={tab === "in" ? "Top-ups you add appear here." : "Expenses saved as paid appear here with the balance after each one."} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4">Details</TableHead>
                    <TableHead className="px-4 hidden md:table-cell">Type</TableHead>
                    <TableHead className="px-4 text-right">Amount</TableHead>
                    <TableHead className="px-4 text-right hidden sm:table-cell">Balance after</TableHead>
                    <TableHead className="px-4 w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((i) => (
                    <TableRow
                      key={i.id}
                      onClick={i.kind === "out" ? () => openExpenseDrawer(i.id) : undefined}
                      className={cn(i.kind === "out" && "cursor-pointer")}
                    >
                      <TableCell className="px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", i.kind === "in" ? "bg-positive-soft text-positive-deep" : "bg-surface-subtle text-text-secondary group-hover:bg-surface-card")}>
                            <Icon name={i.icon} className="text-[18px]" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-body-medium text-body-medium text-text-primary block truncate">{i.title}</span>
                            <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary truncate block">{fmtDate(i.date)}<span className="md:hidden"> · {i.meta}</span></span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 hidden md:table-cell">
                        <span className="font-body-sm text-body-sm text-text-secondary">{i.kind === "in" ? `Top-up · ${i.meta}` : i.meta}</span>
                      </TableCell>
                      <TableCell className={cn("px-4 text-right font-table-cell-mono text-table-cell-mono font-semibold whitespace-nowrap", i.kind === "in" ? "text-positive-deep" : "text-text-primary")}>
                        {i.kind === "in" ? "+" : "−"}{m(i.amount)}
                      </TableCell>
                      <TableCell className="px-4 text-right font-table-cell-mono text-table-cell-mono text-text-secondary whitespace-nowrap hidden sm:table-cell">{m(i.after)}</TableCell>
                      <TableCell className="px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {i.kind === "in" ? (
                          <button type="button" onClick={() => removeTopUp(i.ref)} aria-label={`Remove top-up of ${m(i.amount)}`} title="Remove top-up"
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-text-tertiary hover:text-negative-deep hover:bg-negative-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        ) : (
                          <button type="button" onClick={() => openExpenseDrawer(i.id)} aria-label={`Edit ${i.title}`} title="Edit expense"
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                            <Icon name="edit" className="text-[18px]" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="px-4 py-3 bg-surface-subtle/30 flex items-center justify-between gap-3">
              <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">
                {shown.length ? `Showing ${(current - 1) * PAGE_SIZE + 1}-${(current - 1) * PAGE_SIZE + rows.length} of ${shown.length}` : "No entries"}
              </span>
              <Pagination page={current} pageCount={pageCount} onPage={setPage} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({ label, icon, value, tone, hint, hintTone }) {
  return (
    <div className="bg-surface-card p-4 rounded-xl shadow-sm flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2 text-text-tertiary">
        <span className="font-label-uppercase text-label-uppercase uppercase truncate">{label}</span>
        <span className={cn("w-7 h-7 rounded flex items-center justify-center shrink-0", tone === "positive" ? "bg-positive-soft text-positive-deep" : tone === "negative" ? "bg-negative-soft text-negative-deep" : "bg-surface-subtle text-text-secondary")}>
          <Icon name={icon} className="text-[16px]" />
        </span>
      </div>
      <div>
        <span className="font-metric-md text-metric-md text-text-primary">{value}</span>
        {hint && <p className={cn("font-body-sm text-body-sm mt-0.5", hintTone === "negative" ? "text-negative-deep" : "text-text-tertiary")}>{hint}</p>}
      </div>
    </div>
  );
}
