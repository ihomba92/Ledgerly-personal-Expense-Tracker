import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn, formatDate, formatMoney, formatWhole, monthKey, monthLabel, shiftMonth, todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/shared/Icon";
import { CategoryTag, StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { isPaid, useAppData } from "@/store/AppData";
import { sum } from "@/lib/ledger";
import { PAYMENT_METHODS, methodById } from "@/data/wallet";

const PAGE_SIZE = 10;
const SORTS = [
  { id: "date-desc", label: "Newest first" },
  { id: "date-asc", label: "Oldest first" },
  { id: "amount-desc", label: "Highest amount" },
  { id: "amount-asc", label: "Lowest amount" },
];

export default function Expenses() {
  const { expenses, categories, categoryById, payExpenses, deleteExpenses, restoreExpenses, openExpenseDrawer, openTopUp, balance } = useAppData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [view, setView] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [method, setMethod] = useState("all");
  const [receipt, setReceipt] = useState("all");
  const [month, setMonth] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

  // Deep links from the dashboard: ?status=draft, ?receipt=missing
  useEffect(() => {
    const s = params.get("status"), r = params.get("receipt");
    if (s || r) {
      if (s) setStatus(s);
      if (r) { setReceipt(r); setMonth(monthKey(todayISO())); setStatus("paid"); }
      setShowFilters(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const months = useMemo(() => [...new Set(expenses.map((e) => monthKey(e.date)))].sort().reverse(), [expenses]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = expenses.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (category !== "all" && e.category !== category) return false;
      if (method !== "all" && e.method !== method) return false;
      if (receipt === "missing" && e.receipt) return false;
      if (receipt === "attached" && !e.receipt) return false;
      if (month !== "all" && monthKey(e.date) !== month) return false;
      if (q && ![e.subject, e.merchant, e.description ?? "", categoryById(e.category).label].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
    const [key, dir] = sort.split("-");
    return list.sort((a, b) => {
      const r = key === "amount" ? a.amount - b.amount : a.date.localeCompare(b.date);
      return dir === "asc" ? r : -r;
    });
  }, [expenses, status, category, method, receipt, month, query, sort, categoryById]);

  useEffect(() => setPage(1), [status, category, method, receipt, month, query, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Stat cards
  const thisMonth = monthKey(todayISO());
  const spentNow = sum(expenses.filter((e) => isPaid(e) && monthKey(e.date) === thisMonth));
  const dayNum = Number(todayISO().slice(8, 10));
  const prevKey = shiftMonth(thisMonth, -1);
  const spentPrevSameDays = sum(expenses.filter((e) => isPaid(e) && monthKey(e.date) === prevKey && Number(e.date.slice(8, 10)) <= dayNum));
  const change = spentPrevSameDays ? ((spentNow - spentPrevSameDays) / spentPrevSameDays) * 100 : null;
  const drafts = expenses.filter((e) => !isPaid(e));

  const activeFilters = [status, category, method, receipt, month].filter((v) => v !== "all").length;
  const clearFilters = () => { setStatus("all"); setCategory("all"); setMethod("all"); setReceipt("all"); setMonth("all"); setQuery(""); };

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPage = rows.some((r) => selected.has(r.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePage = () => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; });

  const remove = async (list) => {
    try {
      await deleteExpenses(list.map((e) => e.id));
    } catch (err) {
      return toast(err.message, { tone: "info" });
    }
    setSelected(new Set());
    const refunded = sum(list.filter(isPaid));
    // Undo records the expenses again. Receipt files can't come back, so there's no undo when one was attached.
    const canUndo = list.every((e) => !e.receipt);
    toast(
      `${list.length === 1 ? list[0].subject : `${list.length} expenses`} deleted${refunded ? `. ${formatWhole(refunded)} back in your balance` : ""}`,
      { tone: "info", action: canUndo ? { label: "Undo", onClick: () => restoreExpenses(list).catch((e) => toast(e.message, { tone: "info" })) } : undefined }
    );
  };

  // Paying drafts takes them from the balance, so it's blocked if there isn't enough.
  const markPaid = async (list) => {
    const toPay = list.filter((e) => !isPaid(e));
    const total = sum(toPay);
    if (!toPay.length) return toast("Those expenses are already paid", { tone: "info" });
    if (total > balance) {
      return toast(`You need ${formatMoney(total - balance)} more to pay ${toPay.length === 1 ? "this" : "these"}. Top up first.`, {
        tone: "info", action: { label: "Top up", onClick: openTopUp },
      });
    }
    try {
      await payExpenses(toPay.map((e) => e.id));
    } catch (err) {
      return toast(err.message, { tone: "info", action: err.reason === "insufficient_balance" ? { label: "Top up", onClick: openTopUp } : undefined });
    }
    setSelected(new Set());
    toast(`${toPay.length} expense${toPay.length === 1 ? "" : "s"} paid. Balance now ${formatMoney(balance - total)}`);
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
          <h1 className="font-display-hero-mobile text-display-hero-mobile md:font-display-hero md:text-display-hero text-text-primary tracking-tight">Expenses</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-surface-subtle p-1 rounded-lg" role="tablist" aria-label="Layout">
            {[["list", "view_list", "List"], ["cards", "view_column", "Cards"]].map(([id, icon, label]) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
                className={cn("px-2.5 py-1.5 rounded font-body-sm-medium text-body-sm-medium flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  view === id ? "bg-surface-card shadow-sm text-text-primary" : "text-text-tertiary hover:text-text-primary")}>
                <Icon name={icon} className="text-[16px]" /><span>{label}</span>
              </button>
            ))}
          </div>
          <Button variant="secondary" className={cn("h-auto px-3 py-2 text-text-secondary", showFilters && "bg-surface-container-high text-text-primary")} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <Icon name="tune" /><span>Filter</span>
            {activeFilters > 0 && <span className="ml-0.5 min-w-5 h-5 px-1.5 rounded-full bg-primary text-on-primary font-table-cell-mono text-[11px] flex items-center justify-center">{activeFilters}</span>}
          </Button>
          <Button className="h-auto px-4 py-2" onClick={() => openExpenseDrawer()}><Icon name="add" /><span>+ New expense</span></Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label={`Spent in ${monthLabel(thisMonth, { month: "long" })}`} icon="payments" value={formatWhole(spentNow)}
          pill={change === null ? null : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`} pillClass={change > 0 ? "bg-negative-soft text-negative-deep" : "bg-positive-soft text-positive-deep"} />
        <Stat label="Drafts to pay" icon="edit_note" value={formatWhole(sum(drafts))} pill={`${drafts.length} item${drafts.length === 1 ? "" : "s"}`} pillClass="bg-secondary-fixed/60 text-on-secondary-fixed" />
        <Stat label="Available Balance" icon="account_balance_wallet" value={formatWhole(balance)} note={balance < 0 ? "Overdrawn" : "After paid expenses"} />
        <Stat label="Daily average" icon="speed" value={formatWhole(dayNum ? spentNow / dayNum : 0)} note={`Over ${dayNum} day${dayNum === 1 ? "" : "s"} this month`} />
      </div>

      {/* Ledger */}
      <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-surface-subtle/50">
          <div className="flex items-center gap-2">
            <span className="font-title-card text-title-card text-text-primary">Ledger Records</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container font-table-cell-mono text-table-cell-mono text-text-secondary">{filtered.length} found</span>
          </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
            <label className="relative flex-1 sm:flex-none">
              <span className="sr-only">Search expenses</span>
              <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-text-tertiary pointer-events-none" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} type="text" placeholder="Search expense, place, note..."
                className="w-full sm:w-60 pl-8 pr-3 py-1.5 rounded-lg bg-surface-card text-text-primary placeholder:text-text-tertiary font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/15 shadow-xs" />
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Sort" className="p-1.5 rounded-lg bg-surface-card hover:bg-surface-container text-text-secondary shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <Icon name="sort" className="text-[18px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {SORTS.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => setSort(s.id)} className={cn(sort === s.id && "text-primary font-semibold")}>
                    <Icon name="check" className={cn(sort !== s.id && "opacity-0")} /> {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {showFilters && (
          <div className="px-4 py-3 flex flex-wrap items-center gap-3 bg-surface-subtle/30 animate-fade-in">
            <FilterSelect label="Status" value={status} onChange={setStatus} options={[["all", "All statuses"], ["paid", "Paid"], ["draft", "Draft"]]} />
            <FilterSelect label="Category" value={category} onChange={setCategory} options={[["all", "All categories"], ...categories.map((c) => [c.id, c.label])]} />
            <FilterSelect label="Paid with" value={method} onChange={setMethod} options={[["all", "Any payment method"], ...PAYMENT_METHODS.map((p) => [p.id, p.label])]} />
            <FilterSelect label="Receipt" value={receipt} onChange={setReceipt} options={[["all", "Any receipt"], ["attached", "Receipt attached"], ["missing", "Receipt missing"]]} />
            <FilterSelect label="Month" value={month} onChange={setMonth} options={[["all", "All months"], ...months.map((k) => [k, monthLabel(k)])]} />
            {activeFilters > 0 && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
          </div>
        )}

        {selected.size > 0 && (
          <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-positive-soft animate-fade-in">
            <span className="font-body-sm-medium text-body-sm-medium text-positive-deep">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
              <Button variant="destructive" size="sm" onClick={() => remove(expenses.filter((e) => selected.has(e.id)))}><Icon name="delete" /> Delete</Button>
              <Button size="sm" onClick={() => markPaid(expenses.filter((e) => selected.has(e.id)))}><Icon name="payments" /> Mark as paid</Button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title={expenses.length ? "No expenses match these filters" : "No expenses yet"}
            description={expenses.length ? "Try a different search, or clear the filters." : "Record your first expense and it’ll be taken from your balance."}
            action={expenses.length ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : <Button size="sm" onClick={() => openExpenseDrawer()}><Icon name="add" /> New expense</Button>}
          />
        ) : view === "list" ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent select-none">
                <TableHead className="w-10 px-4 text-center">
                  <Checkbox aria-label="Select all on this page" checked={allOnPage ? true : someOnPage ? "indeterminate" : false} onCheckedChange={togglePage} className="align-middle" />
                </TableHead>
                <TableHead className="px-4 font-semibold tracking-normal">Details</TableHead>
                <TableHead className="px-4 font-semibold tracking-normal hidden md:table-cell">Paid to</TableHead>
                <TableHead className="px-4 font-semibold tracking-normal hidden lg:table-cell">Category</TableHead>
                <TableHead className="px-4 font-semibold tracking-normal hidden xl:table-cell">Paid with</TableHead>
                <TableHead className="px-4 font-semibold tracking-normal text-right">Amount</TableHead>
                <TableHead className="px-4 font-semibold tracking-normal hidden sm:table-cell">Status</TableHead>
                <TableHead className="px-4 w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const c = categoryById(e.category);
                const isSel = selected.has(e.id);
                return (
                  <TableRow key={e.id} onClick={() => openExpenseDrawer(e.id)} className={cn("cursor-pointer hover:bg-surface-subtle", isSel && "bg-surface-subtle/60")}>
                    <TableCell className="py-3.5 px-4 text-center" onClick={(ev) => ev.stopPropagation()}>
                      <Checkbox aria-label={`Select ${e.subject}`} checked={isSel} onCheckedChange={() => toggle(e.id)} className="align-middle" />
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-text-secondary group-hover:bg-surface-card shrink-0"><Icon name={c.icon} className="text-[18px]" /></div>
                        <div className="min-w-0">
                          <span className="font-body-medium text-body-medium text-text-primary flex items-center gap-1.5">
                            <span className="truncate">{e.subject}</span>
                            {e.receipt && <Icon name="attach_file" className="text-[14px] text-text-tertiary" title="Receipt attached" />}
                          </span>
                          <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">{formatDate(e.date)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 font-body-medium text-body-medium text-text-secondary hidden md:table-cell">{e.merchant}</TableCell>
                    <TableCell className="py-3.5 px-4 hidden lg:table-cell"><CategoryTag category={c} /></TableCell>
                    <TableCell className="py-3.5 px-4 font-body-sm text-body-sm text-text-secondary hidden xl:table-cell whitespace-nowrap">{methodById(e.method).label}</TableCell>
                    <TableCell className="py-3.5 px-4 font-table-cell-mono text-table-cell-mono text-right font-medium text-text-primary whitespace-nowrap">{formatMoney(e.amount)}</TableCell>
                    <TableCell className="py-3.5 px-4 hidden sm:table-cell"><StatusBadge status={e.status} /></TableCell>
                    <TableCell className="py-3.5 px-4 text-center" onClick={(ev) => ev.stopPropagation()}>
                      <RowMenu expense={e} onEdit={() => openExpenseDrawer(e.id)} onPay={() => markPaid([e])} onDelete={() => remove([e])} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((e) => {
              const c = categoryById(e.category);
              return (
                <div key={e.id} role="button" tabIndex={0} onClick={() => openExpenseDrawer(e.id)} onKeyDown={(ev) => ev.key === "Enter" && openExpenseDrawer(e.id)}
                  className="group rounded-xl bg-surface-canvas hover:bg-surface-subtle p-4 flex flex-col gap-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-surface-card shadow-xs flex items-center justify-center text-text-secondary shrink-0"><Icon name={c.icon} className="text-[18px]" /></div>
                      <div className="min-w-0">
                        <p className="font-title-card text-title-card text-text-primary truncate">{e.subject}</p>
                        <p className="font-body-sm text-body-sm text-text-tertiary truncate">{e.merchant} · {methodById(e.method).label}</p>
                      </div>
                    </div>
                    <div onClick={(ev) => ev.stopPropagation()}>
                      <RowMenu expense={e} onEdit={() => openExpenseDrawer(e.id)} onPay={() => markPaid([e])} onDelete={() => remove([e])} />
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-metric-md text-metric-md text-text-primary">{formatMoney(e.amount)}</span>
                      <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">{formatDate(e.date)} · {c.label}</span>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="px-4 py-3 bg-surface-subtle/30 flex flex-wrap items-center justify-between gap-3">
          <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">
            {filtered.length ? `Showing ${(current - 1) * PAGE_SIZE + 1}-${(current - 1) * PAGE_SIZE + rows.length} of ${filtered.length}, totalling ${formatWhole(sum(filtered))}` : "No expenses"}
          </span>
          <Pagination page={current} pageCount={pageCount} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, icon, value, pill, pillClass, note }) {
  return (
    <div className="bg-surface-card p-4 rounded-xl shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 text-text-tertiary">
        <span className="font-label-uppercase text-label-uppercase uppercase truncate">{label}</span>
        <Icon name={icon} className="text-[18px]" />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span className="font-metric-lg-mobile text-metric-lg-mobile 2xl:font-metric-lg 2xl:text-metric-lg text-text-primary">{value}</span>
        {pill && <span className={cn("px-2 py-0.5 rounded-full font-label-uppercase text-label-uppercase", pillClass)}>{pill}</span>}
        {note && <span className="text-text-tertiary font-body-sm text-body-sm">{note}</span>}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn("h-8 w-auto min-w-[150px] border-transparent bg-surface-card shadow-xs font-body-sm text-body-sm", value !== "all" && "text-primary font-semibold")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function RowMenu({ expense, onEdit, onPay, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${expense.subject}`} className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <Icon name="more_vert" className="text-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}><Icon name="edit" /> Edit</DropdownMenuItem>
        {!isPaid(expense) && <DropdownMenuItem onSelect={onPay}><Icon name="payments" /> Pay from balance</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}><Icon name="delete" /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
