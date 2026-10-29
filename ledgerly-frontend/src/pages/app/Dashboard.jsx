import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn, formatCompact, formatMoney, formatWhole, monthKey, monthLabel, shiftMonth, todayISO } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Icon } from "@/components/shared/Icon";
import { CategoryTag, StatusBadge } from "@/components/shared/StatusBadge";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { isPaid, useAppData } from "@/store/AppData";
import { byCategory, sum } from "@/lib/ledger";
import { useAuth } from "@/store/Auth";
import { methodById } from "@/data/wallet";

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "Last 3 months" },
  { value: "year", label: "Last 12 months" },
];

const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { expenses, categoryById } = useAppData();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const month = monthKey(todayISO());
  const spentThisMonth = sum(expenses.filter((e) => isPaid(e) && monthKey(e.date) === month));

  return (
    <div className="flex flex-col w-full gap-7 pb-12">
      {/* Greeting & context strip */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pt-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label-uppercase text-label-uppercase text-text-tertiary tracking-wider uppercase">Personal Overview</span>
            <span className="w-1 h-1 rounded-full bg-border-subtle" />
            <span className="font-body-sm-medium text-body-sm-medium text-positive-deep flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-positive-vibrant animate-pulse" />
              {monthLabel(month)}
            </span>
          </div>
          <h1 className="font-display-hero-mobile text-display-hero-mobile md:font-display-hero md:text-display-hero text-text-primary tracking-tight">
            {greeting}, <span className="italic font-normal">{user?.name?.split(" ")[0]}</span>
          </h1>
          <p className="font-body-regular text-body-regular text-text-secondary">Here’s where your money stands today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BalanceBadge />
          <MetaBadge icon="payments" label={`Spent in ${monthLabel(month, { month: "long" })}`} value={formatWhole(spentThisMonth)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <ToDo />
        <RecentExpenses />
      </div>

      <QuickAccess />
      <Report categoryById={categoryById} expenses={expenses} />
    </div>
  );
}

function BalanceBadge() {
  const { balance, openTopUp } = useAppData();
  return (
    <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-lg bg-surface-card shadow-sm">
      <Link to="/app/wallet" className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <div className="w-7 h-7 rounded bg-primary text-on-primary flex items-center justify-center"><Icon name="account_balance_wallet" className="text-[16px]" /></div>
        <div className="flex flex-col">
          <span className="font-label-uppercase text-label-uppercase text-text-tertiary">Available Balance</span>
          <span className={cn("font-body-sm-medium text-body-sm-medium", balance < 0 ? "text-negative-deep" : "text-text-primary")}>{formatMoney(balance)}</span>
        </div>
      </Link>
      <button type="button" onClick={openTopUp}
        className="ml-1 px-2.5 py-1.5 rounded-md bg-positive-soft text-positive-deep hover:bg-primary hover:text-on-primary font-body-sm-medium text-body-sm-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        Top up
      </button>
    </div>
  );
}

function MetaBadge({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-surface-card shadow-sm">
      <div className="w-7 h-7 rounded bg-surface-subtle text-text-secondary flex items-center justify-center"><Icon name={icon} className="text-[16px]" /></div>
      <div className="flex flex-col">
        <span className="font-label-uppercase text-label-uppercase text-text-tertiary">{label}</span>
        <span className="font-body-sm-medium text-body-sm-medium text-text-primary">{value}</span>
      </div>
    </div>
  );
}

function ToDo() {
  const { expenses, categories, balance } = useAppData();
  const today = todayISO();
  const month = monthKey(today);
  const drafts = expenses.filter((e) => !isPaid(e));
  const missing = expenses.filter((e) => isPaid(e) && monthKey(e.date) === month && !e.receipt);
  const monthSpend = byCategory(expenses.filter((e) => isPaid(e) && monthKey(e.date) === month), (id) => ({ id }));
  const stretched = categories.filter((c) => c.budget > 0 && (monthSpend.find((x) => x.id === c.id)?.amount ?? 0) >= c.budget * 0.85);
  const last30 = sum(expenses.filter((e) => isPaid(e) && e.date > addDays(today, -30)));
  const perDay = last30 / 30;
  const days = perDay > 0 ? Math.floor(balance / perDay) : null;

  const tasks = [
    { to: "/app/expenses?status=draft", icon: "edit_note", iconClass: "text-secondary", title: "Drafts to pay",
      hint: drafts.length ? `${formatWhole(sum(drafts))} not yet taken from your balance` : "Nothing waiting", count: drafts.length, countClass: "bg-secondary-fixed/60 text-on-secondary-fixed" },
    { to: "/app/expenses?receipt=missing", icon: "receipt", iconClass: "text-negative-vibrant", title: "Receipts missing",
      hint: missing.length ? "Paid this month without a receipt" : "Every receipt is filed", count: missing.length, countClass: "bg-negative-soft text-negative-deep" },
    { to: "/app/categories", icon: "donut_small", iconClass: "text-positive-deep", title: "Budgets near the limit",
      hint: stretched.length ? stretched.slice(0, 2).map((c) => c.label).join(", ") + (stretched.length > 2 ? "…" : "") : "All categories on track", count: stretched.length, countClass: "bg-positive-soft text-positive-deep" },
  ];

  const actionItems = tasks.reduce((s, t) => s + (t.count ? 1 : 0), 0);

  return (
    <div className="lg:col-span-4 bg-surface-card rounded-xl p-6 shadow-sm flex flex-col justify-between gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-primary"><Icon name="checklist" className="text-[18px]" /></div>
          <div>
            <h2 className="font-title-card text-title-card text-text-primary">To do</h2>
            <p className="font-body-sm text-body-sm text-text-tertiary">Keep your ledger tidy</p>
          </div>
        </div>
        <span className={cn("px-2 py-0.5 rounded-full font-label-uppercase text-label-uppercase whitespace-nowrap", actionItems ? "bg-negative-soft text-negative-deep" : "bg-positive-soft text-positive-deep")}>
          {actionItems ? `${actionItems} to review` : "All clear"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <Link key={t.title} to={t.to}
            className="group flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-canvas hover:bg-surface-subtle transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn("w-8 h-8 rounded-full bg-surface-card shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform", t.iconClass)}><Icon name={t.icon} className="text-[18px]" /></div>
              <div className="flex flex-col min-w-0">
                <span className="font-body-medium text-body-medium text-text-primary group-hover:text-primary transition-colors">{t.title}</span>
                <span className="font-body-sm text-body-sm text-text-tertiary truncate">{t.hint}</span>
              </div>
            </div>
            <span className={cn("w-7 h-7 rounded-full flex items-center justify-center font-table-cell-mono text-table-cell-mono font-semibold shrink-0", t.count ? t.countClass : "bg-surface-container text-text-tertiary font-medium")}>{t.count}</span>
          </Link>
        ))}
        <Link to="/app/wallet"
          className="group flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-canvas hover:bg-surface-subtle transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("w-8 h-8 rounded-full bg-surface-card shadow-sm flex items-center justify-center shrink-0", days !== null && days < 7 ? "text-negative-vibrant" : "text-text-tertiary")}><Icon name="hourglass_top" className="text-[18px]" /></div>
            <div className="flex flex-col min-w-0">
              <span className="font-body-medium text-body-medium text-text-primary group-hover:text-primary transition-colors">Balance runway</span>
              <span className="font-body-sm text-body-sm text-text-tertiary truncate">At {formatWhole(perDay)} a day, your last 30 days’ average</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-surface-container text-text-secondary font-table-cell-mono text-table-cell-mono font-medium whitespace-nowrap">
            {days === null ? "No spend yet" : `${days} days`}
          </span>
        </Link>
      </div>

      <Link to="/app/expenses?status=draft"
        className="w-full mt-1 py-2.5 px-4 rounded-lg bg-surface-subtle hover:bg-surface-container text-text-primary font-body-sm-medium text-body-sm-medium flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <span>Review drafts</span>
        <Icon name="arrow_forward" className="text-[16px]" />
      </Link>
    </div>
  );
}

function RecentExpenses() {
  const { expenses, categoryById, openExpenseDrawer } = useAppData();
  const month = monthKey(todayISO());
  const rows = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const monthCount = expenses.filter((e) => monthKey(e.date) === month).length;

  return (
    <div className="lg:col-span-8 bg-surface-card rounded-xl p-6 shadow-sm flex flex-col justify-between min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-positive-soft flex items-center justify-center text-positive-deep"><Icon name="receipt_long" className="text-[18px]" /></div>
          <div>
            <h2 className="font-title-card text-title-card text-text-primary">Recent Expenses</h2>
            <p className="font-body-sm text-body-sm text-text-tertiary">Your latest spending, newest first</p>
          </div>
        </div>
        <Link to="/app/expenses" className="px-2.5 py-1 rounded bg-surface-canvas hover:bg-surface-subtle text-primary font-body-sm-medium text-body-sm-medium flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <span>View All</span>
          <Icon name="arrow_outward" className="text-[14px]" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center font-body-sm text-body-sm text-text-tertiary">No expenses yet. Record your first one to see it here.</p>
      ) : (
        <Table>
          <TableHeader className="bg-transparent">
            <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
              <TableHead className="px-3.5 rounded-l-lg tracking-normal">Expense</TableHead>
              <TableHead className="px-3.5 tracking-normal hidden md:table-cell">Category</TableHead>
              <TableHead className="px-3.5 tracking-normal hidden sm:table-cell">Paid with</TableHead>
              <TableHead className="px-3.5 tracking-normal text-right rounded-r-lg">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
              const c = categoryById(e.category);
              return (
                <TableRow key={e.id} onClick={() => openExpenseDrawer(e.id)} className="cursor-pointer hover:bg-surface-subtle/80">
                  <TableCell className="py-3 px-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-text-secondary group-hover:bg-surface-card transition-colors shrink-0"><Icon name={c.icon} className="text-[16px]" /></div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-body-medium text-body-medium text-text-primary truncate">{e.subject}</span>
                        <span className="font-table-cell-mono text-[11px] text-text-tertiary">{e.merchant} · {new Date(e.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 px-3.5 hidden md:table-cell"><CategoryTag category={c} /></TableCell>
                  <TableCell className="py-3 px-3.5 hidden sm:table-cell font-body-sm text-body-sm text-text-secondary whitespace-nowrap">{methodById(e.method).label}</TableCell>
                  <TableCell className="py-3 px-3.5 text-right whitespace-nowrap">
                    <span className="font-table-cell-mono text-table-cell-mono font-medium text-text-primary">{formatMoney(e.amount)}</span>
                    {!isPaid(e) && <StatusBadge status="draft" size="sm" className="ml-2" />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-text-tertiary font-body-sm text-body-sm">
        <span>Showing latest {rows.length} of {monthCount} recorded this month</span>
        <span className="font-table-cell-mono text-table-cell-mono text-text-secondary font-medium">Subtotal: {formatMoney(sum(rows))}</span>
      </div>
    </div>
  );
}

function QuickAccess() {
  const { openExpenseDrawer, openTopUp } = useAppData();
  const navigate = useNavigate();
  const cards = [
    { icon: "add", title: "+ New expense", hint: "Taken from your balance", iconClass: "bg-primary text-on-primary", hover: "group-hover:text-primary", onClick: () => openExpenseDrawer() },
    { icon: "add_card", title: "+ Top up balance", hint: "Salary, M-Pesa or savings", iconClass: "bg-positive-soft text-positive-deep", hover: "group-hover:text-positive-deep", onClick: openTopUp },
    { icon: "document_scanner", title: "+ Add receipt", hint: "Attach it to an expense", iconClass: "bg-secondary-fixed text-on-secondary-fixed", hover: "group-hover:text-secondary", onClick: () => openExpenseDrawer() },
    { icon: "donut_small", title: "Set budgets", hint: "Monthly limits per category", iconClass: "bg-surface-container-high text-on-surface-variant", hover: "group-hover:text-on-surface-variant", onClick: () => navigate("/app/categories") },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">Shortcuts</span>
          <span className="w-1 h-1 rounded-full bg-border-subtle" />
          <span className="font-title-card text-title-card text-text-primary">Quick Access</span>
        </div>
        <span className="font-body-sm text-body-sm text-text-tertiary">The things you do most</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <button key={c.title} type="button" onClick={c.onClick}
            className="group bg-surface-card hover:bg-surface-subtle p-4 rounded-xl shadow-sm text-left transition-all duration-200 flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <div className="flex items-center gap-3.5">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm", c.iconClass)}><Icon name={c.icon} className="text-[20px]" /></div>
              <div className="flex flex-col">
                <span className={cn("font-body-medium text-body-medium text-text-primary font-semibold transition-colors", c.hover)}>{c.title}</span>
                <span className="font-body-sm text-body-sm text-text-tertiary">{c.hint}</span>
              </div>
            </div>
            <Icon name="chevron_right" className={cn("text-text-tertiary transition-colors text-[18px]", c.hover)} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Builds chart buckets for the chosen period, plus the matching earlier period for comparison. */
function usePeriod(expenses, period) {
  return useMemo(() => {
    const paid = expenses.filter(isPaid);
    const today = todayISO();
    const inRange = (from, to) => paid.filter((e) => e.date >= from && e.date <= to);

    if (period === "month") {
      const key = monthKey(today);
      const [y, m] = key.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const dayNum = Number(today.slice(8, 10));
      const from = `${key}-01`;
      const list = inRange(from, today);
      const buckets = Array.from({ length: daysInMonth }, (_, i) => {
        const d = `${key}-${String(i + 1).padStart(2, "0")}`;
        return { label: String(i + 1), amount: sum(list.filter((e) => e.date === d)), future: i + 1 > dayNum, tick: [1, 8, 15, 22, 29].includes(i + 1) };
      });
      const prevKey = shiftMonth(key, -1);
      const prev = inRange(`${prevKey}-01`, `${prevKey}-${String(dayNum).padStart(2, "0")}`);
      return { list, buckets, total: sum(list), prevTotal: sum(prev), compare: `vs same days in ${monthLabel(prevKey, { month: "short" })}`, title: monthLabel(key), budgetable: true };
    }

    if (period === "quarter") {
      const weeks = 13;
      const start = addDays(today, -(weeks * 7) + 1);
      const list = inRange(start, today);
      const buckets = Array.from({ length: weeks }, (_, i) => {
        const a = addDays(start, i * 7), b = addDays(start, i * 7 + 6);
        return { label: new Date(a + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }), amount: sum(list.filter((e) => e.date >= a && e.date <= b)), tick: i % 3 === 0 };
      });
      const prev = inRange(addDays(start, -weeks * 7), addDays(start, -1));
      return { list, buckets, total: sum(list), prevTotal: sum(prev), compare: "vs the 3 months before", title: "the last 3 months" };
    }

    const key = monthKey(today);
    const keys = Array.from({ length: 12 }, (_, i) => shiftMonth(key, i - 11));
    const list = paid.filter((e) => keys.includes(monthKey(e.date)));
    const buckets = keys.map((k) => ({ label: monthLabel(k, { month: "short" }), amount: sum(list.filter((e) => monthKey(e.date) === k)), tick: true }));
    const prevKeys = keys.map((k) => shiftMonth(k, -12));
    const prev = paid.filter((e) => prevKeys.includes(monthKey(e.date)));
    return { list, buckets, total: sum(list), prevTotal: sum(prev), compare: "vs the 12 months before", title: "the last 12 months" };
  }, [expenses, period]);
}

function Report({ expenses, categoryById }) {
  const [period, setPeriod] = useState("month");
  const data = usePeriod(expenses, period);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-title-card text-title-card text-text-primary">Spending Report</h2>
          <p className="font-body-sm text-body-sm text-text-tertiary">Where your money went in {data.title}</p>
        </div>
        <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} label="Report period" className="bg-surface-container p-0.5" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <SpendingTrend data={data} />
        <CategoryBreakdown data={data} categoryById={categoryById} />
      </div>
    </div>
  );
}

function SpendingTrend({ data }) {
  const max = Math.max(...data.buckets.map((b) => b.amount), 1);
  const ceiling = niceCeiling(max);
  const W = 520, H = 180, base = 150, plot = 130, right = 56;
  const step = (W - right) / data.buckets.length;
  const barW = Math.max(4, Math.min(26, step * 0.62));
  const ticks = [1, 0.66, 0.33].map((f) => ({ y: base - plot * f, v: ceiling * f }));
  const change = data.prevTotal ? ((data.total - data.prevTotal) / data.prevTotal) * 100 : null;
  const peak = data.buckets.reduce((a, b) => (b.amount > a.amount ? b : a), data.buckets[0]);
  const active = data.buckets.filter((b) => !b.future);
  const avg = active.length ? data.total / active.length : 0;

  return (
    <div className="lg:col-span-7 bg-surface-card rounded-xl p-6 shadow-sm flex flex-col justify-between min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-title-card text-title-card text-text-primary">Spending Trend</h3>
          <p className="font-body-sm text-body-sm text-text-tertiary">Paid expenses {data.buckets.length > 20 ? "per day" : data.buckets.length > 12 ? "per week" : "per month"}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-primary" />
          <span className="font-label-uppercase text-label-uppercase text-text-secondary">Spent</span>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-3 mb-4">
        <span className="font-metric-lg-mobile text-metric-lg-mobile sm:font-metric-lg sm:text-metric-lg text-text-primary">{formatMoney(data.total)}</span>
        {change !== null && (
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full font-label-uppercase text-label-uppercase", change <= 0 ? "bg-positive-soft text-positive-deep" : "bg-negative-soft text-negative-deep")}>
            <Icon name={change <= 0 ? "trending_down" : "trending_up"} className="text-[12px] mr-0.5" />
            {Math.abs(change).toFixed(1)}% {data.compare}
          </span>
        )}
      </div>

      <div className="w-full">
        <svg className="w-full h-48 overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Spending trend for ${data.title}`}>
          {ticks.map((t) => (
            <g key={t.y}>
              <line stroke="#EFECE6" strokeDasharray="3 3" x1="0" x2={W - right + 6} y1={t.y} y2={t.y} />
              <text fill="#8A8F8A" fontFamily="Plus Jakarta Sans" fontSize="9" textAnchor="end" x={W} y={t.y + 3}>{formatCompact(t.v)}</text>
            </g>
          ))}
          <line stroke="#E5E0D8" x1="0" x2={W - right + 6} y1={base} y2={base} />
          {data.buckets.map((b, i) => {
            const h = b.amount > 0 ? Math.max(2, (b.amount / ceiling) * plot) : 0;
            const x = i * step + (step - barW) / 2;
            return (
              <g key={i}>
                <title>{`${b.label}: ${formatMoney(b.amount)}`}</title>
                {b.future ? (
                  <rect x={x} y={base - 2} width={barW} height={2} rx="1" fill="#EFECE6" />
                ) : (
                  <rect x={x} y={base - h} width={barW} height={h} rx="3" fill={b === peak && b.amount > 0 ? "#14422d" : "#2d5a43"} opacity={b === peak ? 1 : 0.78} className="transition-all duration-500 hover:opacity-100" />
                )}
                {b.tick && <text x={x + barW / 2} y={H - 8} textAnchor="middle" fill="#575C57" fontFamily="Plus Jakarta Sans" fontSize="9">{b.label}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="pt-4 mt-2 flex flex-wrap items-center justify-between gap-2 text-text-tertiary font-body-sm text-body-sm border-t border-surface-container">
        <span className="flex items-center gap-1.5">
          <Icon name="speed" className="text-[16px] text-positive-deep" />
          Average {formatWhole(avg)} {data.buckets.length > 20 ? "a day" : data.buckets.length > 12 ? "a week" : "a month"}
        </span>
        {peak?.amount > 0 && <span className="font-table-cell-mono text-table-cell-mono text-text-secondary">Highest: {peak.label} ({formatWhole(peak.amount)})</span>}
      </div>
    </div>
  );
}

const PALETTE = ["bg-primary", "bg-positive-vibrant", "bg-secondary", "bg-accent-sand", "bg-tertiary", "bg-outline"];

function CategoryBreakdown({ data, categoryById }) {
  const { categories } = useAppData();
  const cats = byCategory(data.list, categoryById);
  const top = cats.slice(0, 5);
  const rest = cats.slice(5);
  if (rest.length) top.push({ id: "_rest", label: `${rest.length} more`, amount: sum(rest), budget: 0 });
  const total = data.total || 1;
  const pct = (v) => ((v / total) * 100).toFixed(1);
  const budgetTotal = data.budgetable ? categories.reduce((s, c) => s + (c.budget || 0), 0) : 0;
  const lead = cats[0];

  return (
    <div className="lg:col-span-5 bg-surface-card rounded-xl p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-title-card text-title-card text-text-primary">By Category</h3>
          <p className="font-body-sm text-body-sm text-text-tertiary">Share of your spending</p>
        </div>
        <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">100%</span>
      </div>

      {lead ? (
        <>
          <div className="flex items-center justify-between gap-3 py-2">
            <div className="flex flex-col">
              <span className="font-metric-md text-metric-md text-text-primary">{formatMoney(lead.amount)}</span>
              <span className="font-body-sm text-body-sm text-text-tertiary">{lead.label} leads</span>
            </div>
            <span className="px-2.5 py-1 rounded bg-surface-subtle text-text-primary font-table-cell-mono text-table-cell-mono font-medium whitespace-nowrap">{pct(lead.amount)}% Top Share</span>
          </div>
          <div className="space-y-3.5 my-2">
            {top.map((c, i) => (
              <div key={c.id} className="space-y-1">
                <div className="flex justify-between items-center font-body-sm text-body-sm">
                  <span className="flex items-center gap-2 text-text-primary font-medium"><span className={cn("w-2 h-2 rounded-full", PALETTE[i])} />{c.label}</span>
                  <span className="font-table-cell-mono text-table-cell-mono text-text-secondary">{pct(c.amount)}% · {formatWhole(c.amount)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all duration-500", PALETTE[i])} style={{ width: `${pct(c.amount)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="py-10 text-center font-body-sm text-body-sm text-text-tertiary">No paid expenses in this period yet.</p>
      )}

      <div className="pt-4 flex items-center justify-between gap-2 text-text-tertiary font-body-sm text-body-sm border-t border-surface-container">
        {data.budgetable && budgetTotal > 0 ? (
          <>
            <span>{Math.round((data.total / budgetTotal) * 100)}% of this month’s budgets used</span>
            <Link to="/app/categories" className="text-primary font-body-sm-medium text-body-sm-medium flex items-center gap-1 hover:underline underline-offset-4">Budgets <Icon name="arrow_forward" className="text-[14px]" /></Link>
          </>
        ) : (
          <span>{cats.length} categories with spending</span>
        )}
      </div>
    </div>
  );
}

function niceCeiling(v) {
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}
