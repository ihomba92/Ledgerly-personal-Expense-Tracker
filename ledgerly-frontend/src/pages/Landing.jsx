import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Icon } from "@/components/shared/Icon";
import { LedgerShowcase } from "@/components/landing/LedgerShowcase";

// Swap this for a real photo later (e.g. /images/cover.jpg). Any wide image works; it's cropped to fit.
const COVER_IMAGE = "/images/cover.svg";

const m = (v) => formatMoney(v);
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const today = iso(new Date());
const prettyDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const CATEGORIES = {
  rent: { label: "Rent & housing", icon: "home" },
  food: { label: "Food & groceries", icon: "shopping_basket" },
  transport: { label: "Transport", icon: "directions_bus" },
  bills: { label: "Bills & utilities", icon: "bolt" },
  eating: { label: "Eating out", icon: "restaurant" },
  health: { label: "Health", icon: "favorite" },
};

const SAMPLE_EXPENSES = [
  { name: "Coffee at Java House", cat: "eating", amount: 450, paidWith: "Card" },
  { name: "Groceries at Naivas", cat: "food", amount: 3850, paidWith: "M-Pesa" },
  { name: "Matatu to town", cat: "transport", amount: 150, paidWith: "Cash" },
  { name: "KPLC tokens", cat: "bills", amount: 1500, paidWith: "M-Pesa" },
  { name: "Pharmacy", cat: "health", amount: 1200, paidWith: "M-Pesa" },
];

const initialDemo = () => ({
  topUps: [
    { id: 1, date: daysAgo(20), amount: 65000, from: "Salary", note: "Starting balance" },
    { id: 2, date: daysAgo(6), amount: 4000, from: "M-Pesa", note: "Side project payment" },
  ],
  expenses: [
    { id: 1, name: "Rent", cat: "rent", amount: 22000, paidWith: "Bank transfer", status: "paid", date: daysAgo(18) },
    { id: 2, name: "Home internet", cat: "bills", amount: 2999, paidWith: "M-Pesa", status: "paid", date: daysAgo(9) },
    { id: 3, name: "Groceries at Carrefour", cat: "food", amount: 4870, paidWith: "Card", status: "paid", date: daysAgo(3) },
    { id: 4, name: "Lunch with Wanjiru", cat: "eating", amount: 1350, paidWith: "M-Pesa", status: "paid", date: daysAgo(1) },
    { id: 5, name: "Matatu fare", cat: "transport", amount: 120, paidWith: "Cash", status: "paid", date: today },
    { id: 6, name: "Gym membership", cat: "health", amount: 3000, paidWith: "Card", status: "draft", date: today },
  ],
});

const PROPERTIES = [
  { icon: "flag", label: "Purpose", value: "Know your balance after every expense" },
  { icon: "group", label: "Made for", value: "Students, young professionals, households and freelancers" },
  { icon: "payments", label: "Works with", value: "M-Pesa, cash, card and bank transfers" },
  { icon: "currency_exchange", label: "Currency", value: "Kenyan shillings (Ksh)" },
  { icon: "lock", label: "Privacy", value: "One person, one ledger. Your records are yours alone" },
];

const BENEFITS = [
  { icon: "account_balance_wallet", title: "A balance that’s always current", body: "Every expense comes off your total the moment you record it, and every top-up adds to it. No spreadsheets, no end-of-month surprises." },
  { icon: "donut_small", title: "Budgets that speak up", body: "Give food, transport or rent a monthly limit. Ledgerly shows how much is left and flags a category before it runs over." },
  { icon: "receipt_long", title: "Every receipt in its place", body: "Attach a receipt to any expense and find a purchase in seconds by place, category, payment method or note." },
  { icon: "insights", title: "Patterns you can act on", body: "See where your money went this month, which days cost the most, and how long your balance will last at your current pace." },
];

const USES = [
  ["Students", "Stretch an allowance or HELB disbursement across the whole semester."],
  ["Young professionals", "See where each salary goes and what’s left before the next payday."],
  ["Households", "Keep rent, school fees, shopping and bills in one clear picture."],
  ["Freelancers", "Record irregular income and keep spending in step with it."],
];

const INDEX = [
  { href: "#balance", label: "Balance", icon: "account_balance" },
  { href: "#expenditure", label: "Expenditure", icon: "south" },
  { href: "#topups", label: "Top-ups", icon: "north" },
  { href: "#categories", label: "Categories of expenditure", icon: "category" },
];

export default function Landing() {
  const [demo, setDemo] = useState(initialDemo);
  const [sampleIx, setSampleIx] = useState(0);

  const toppedUp = demo.topUps.reduce((s, t) => s + t.amount, 0);
  const spent = demo.expenses.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const balance = toppedUp - spent;

  const addSample = () => {
    const s = SAMPLE_EXPENSES[sampleIx % SAMPLE_EXPENSES.length];
    setSampleIx((i) => i + 1);
    if (s.amount > balance) return;
    setDemo((d) => ({ ...d, expenses: [{ ...s, id: Date.now(), status: "paid", date: today }, ...d.expenses] }));
  };
  const addTopUp = () =>
    setDemo((d) => ({ ...d, topUps: [{ id: Date.now(), date: today, amount: 2000, from: "M-Pesa", note: "M-Pesa top-up" }, ...d.topUps] }));
  const payDraft = (id) =>
    setDemo((d) => ({ ...d, expenses: d.expenses.map((e) => (e.id === id && e.amount <= balance ? { ...e, status: "paid" } : e)) }));

  return (
    <div className="pt-16">
      {/* Cover */}
      <div className="relative h-[180px] sm:h-[240px] lg:h-[290px] overflow-hidden bg-primary">
        <img src={COVER_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Page icon + title, the way a notebook page opens */}
       

        {/* Title, description and details on the left; the moving preview on the right */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-10 xl:gap-14 items-start">
          <div className="min-w-0">
            <h1 className="mt-5 font-display-hero font-medium text-[38px] leading-[44px] sm:text-[52px] sm:leading-[58px] tracking-[-0.02em] text-text-primary">
              Personal Expense Ledger
            </h1>
            <p className="mt-4 max-w-2xl font-display-hero text-[21px] leading-[32px] text-text-secondary">
              A calm, private record of your everyday money. Set your balance once, note each expense as it happens, and Ledgerly keeps
              the running total for you, so you know what you can afford before you spend it.
            </p>

            {/* Page properties, the way a notebook page lists its details */}
            <dl className="mt-8 max-w-3xl flex flex-col">
              {PROPERTIES.map((p) => (
                <div key={p.label} className="grid grid-cols-[130px_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] gap-4 py-2.5 border-b border-border-hairline last:border-b-0">
                  <dt className="flex items-center gap-2 font-body-sm text-body-sm text-text-tertiary">
                    <Icon name={p.icon} className="text-[17px]" /> {p.label}
                  </dt>
                  <dd className="font-body-regular text-body-regular text-text-primary">{p.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <LedgerShowcase className="hidden lg:grid h-[470px] mt-2" />
        </div>

        {/* Benefits */}
        <div className="mt-12 grid sm:grid-cols-2 gap-x-12 gap-y-8 max-w-4xl">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex gap-4 pt-5 border-t border-secondary/40">
              <Icon name={b.icon} className="text-[22px] text-secondary mt-0.5" />
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display-hero font-medium text-[22px] leading-7 text-text-primary">{b.title}</h2>
                <p className="font-body-regular text-body-regular text-text-secondary">{b.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button size="lg" asChild><Link to="/signup">Start your ledger</Link></Button>
          <Button size="lg" variant="secondary" asChild><Link to="/login">Log in</Link></Button>
          <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-text-tertiary"><Icon name="verified" className="text-[16px] text-positive-vibrant" /> Free to use. Set up in about a minute.</span>
        </div>

        <div className="mt-12 grid lg:grid-cols-[250px_minmax(0,1fr)] gap-10 lg:gap-16 items-start">
          {/* Left column: page index */}
          <aside className="lg:sticky lg:top-24 flex flex-col gap-8">
            <div>
              <div className="h-px bg-secondary/50" />
              <p className="py-4 font-table-cell-mono text-[15px] leading-5 tracking-wide text-secondary">Your ledger</p>
              <div className="h-px bg-secondary/50" />
              <nav className="py-4 flex flex-col gap-2" aria-label="On this page">
                {INDEX.map((i) => (
                  <a key={i.href} href={i.href} className="group flex items-center gap-2.5 font-body-medium text-body-medium text-text-primary w-fit">
                    <Icon name={i.icon} className="text-[18px] text-secondary" />
                    <span className="underline decoration-border-subtle underline-offset-4 group-hover:decoration-secondary transition-colors">{i.label}</span>
                  </a>
                ))}
              </nav>
              <div className="h-px bg-secondary/50" />
            </div>

            <Toggle title="How it works" defaultOpen>
              <ol className="flex flex-col gap-3">
                {[
                  ["Add your balance", "Enter the money you have right now."],
                  ["Record each expense", "It’s taken off your balance straight away."],
                  ["Top up when you need to", "Salary, M-Pesa or savings all go in."],
                ].map(([t, b], i) => (
                  <li key={t} className="flex gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center font-body-sm-medium text-body-sm-medium">{i + 1}</span>
                    <span className="flex flex-col">
                      <span className="font-body-sm-medium text-body-sm-medium text-text-primary">{t}</span>
                      <span className="font-body-sm text-body-sm text-text-tertiary">{b}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Toggle>

            <Toggle title="Made for">
              <ul className="flex flex-col gap-3">
                {USES.map(([who, what]) => (
                  <li key={who} className="flex flex-col">
                    <span className="font-body-sm-medium text-body-sm-medium text-text-primary">{who}</span>
                    <span className="font-body-sm text-body-sm text-text-tertiary">{what}</span>
                  </li>
                ))}
              </ul>
            </Toggle>

            <Toggle title="Good to know">
              <ul className="flex flex-col gap-2.5 font-body-sm text-body-sm text-text-secondary">
                <li className="flex gap-2"><Icon name="edit_note" className="text-[16px] text-text-tertiary mt-px" /> Save an expense as a draft and it won’t touch your balance until you pay it.</li>
                <li className="flex gap-2"><Icon name="undo" className="text-[16px] text-text-tertiary mt-px" /> Edit or delete an expense and the balance corrects itself.</li>
                <li className="flex gap-2"><Icon name="lock" className="text-[16px] text-text-tertiary mt-px" /> Your ledger is private to your account.</li>
              </ul>
            </Toggle>

            <div className="rounded-xl bg-surface-card shadow-sm p-5 flex flex-col gap-3">
              <p className="font-title-card text-title-card text-text-primary">Start your own ledger</p>
              <p className="font-body-sm text-body-sm text-text-tertiary">Free to use. Add your balance and you’re ready.</p>
              <Button asChild className="w-full"><Link to="/signup">Create account</Link></Button>
              <Button asChild variant="secondary" className="w-full"><Link to="/login">Log in</Link></Button>
            </div>
          </aside>

          {/* Right column: the ledger itself */}
          <div className="flex flex-col gap-14 min-w-0 pb-20">
            <Section
              id="balance"
              icon="account_balance"
              title="Balance"
              tone="sand"
              lines={["Your money, after every expense.", "This preview is live. Try the buttons below; nothing is saved."]}
            >
              <BalancePreview balance={balance} toppedUp={toppedUp} spent={spent} onTopUp={addTopUp} onExpense={addSample} next={SAMPLE_EXPENSES[sampleIx % SAMPLE_EXPENSES.length]} />
            </Section>

            <Section
              id="expenditure"
              icon="south"
              title="Expenditure"
              tone="rose"
              lines={["See today, the whole month, or what’s still waiting.", "Drafts stay pending until you pay them from your balance."]}
            >
              <ExpenditureTable expenses={demo.expenses} balance={balance} onPay={payDraft} onAdd={addSample} />
            </Section>

            <Section
              id="topups"
              icon="north"
              title="Top-ups"
              tone="green"
              lines={["Every time money comes in.", "Each top-up raises your balance and is kept on record."]}
            >
              <TopUpTable topUps={demo.topUps} onAdd={addTopUp} />
            </Section>

            <Section
              id="categories"
              icon="category"
              title="Categories of expenditure"
              tone="sand"
              lines={["Where the money goes.", "Every expense is filed under a category, so the month adds up at a glance."]}
            >
              <CategoryGrid expenses={demo.expenses} />
            </Section>

            <div className="rounded-xl bg-primary px-6 py-10 sm:px-10 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div aria-hidden="true" className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 40px)" }} />
              <div className="relative">
                <h2 className="font-display-hero-mobile text-display-hero-mobile text-surface-card">Know what’s left before you spend it.</h2>
                <p className="mt-2 font-body-regular text-body-regular text-on-primary-container">Create an account, add your balance, and record your first expense.</p>
              </div>
              <div className="relative flex flex-wrap gap-3">
                <Button size="lg" className="bg-surface-card text-primary hover:bg-surface-subtle" asChild><Link to="/signup">Create account</Link></Button>
                <Button size="lg" className="bg-primary-container text-surface-card hover:bg-surface-tint shadow-none" asChild><Link to="/login">Log in</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page furniture ---------- */

function LedgerBookIcon() {
  return (
    <svg viewBox="0 0 104 104" className="w-full h-full drop-shadow-[0_8px_18px_rgba(31,36,33,0.22)]" aria-hidden="true">
      <rect x="22" y="10" width="68" height="86" rx="10" fill="#772e16" />
      <rect x="16" y="6" width="68" height="88" rx="10" fill="#97472c" />
      <rect x="16" y="6" width="14" height="88" rx="7" fill="#793017" />
      <rect x="38" y="26" width="36" height="18" rx="5" fill="#ffdbd0" />
      <rect x="44" y="33" width="24" height="4" rx="2" fill="#97472c" opacity=".55" />
      <rect x="38" y="56" width="36" height="3" rx="1.5" fill="#ffb59e" opacity=".55" />
      <rect x="38" y="64" width="28" height="3" rx="1.5" fill="#ffb59e" opacity=".45" />
      <rect x="84" y="14" width="6" height="74" rx="3" fill="#f4ead6" />
    </svg>
  );
}

function Toggle({ title, defaultOpen, children }) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-2 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <Icon name="play_arrow" filled className="text-[16px] text-text-primary transition-transform group-open:rotate-90" />
        <span className="font-display-hero font-medium text-[20px] leading-7 text-text-primary">[{title}]</span>
      </summary>
      <div className="pt-4 pl-6">{children}</div>
    </details>
  );
}

const TONES = {
  rose: "bg-negative-soft",
  green: "bg-positive-soft",
  sand: "bg-surface-subtle",
};

function Section({ id, icon, title, tone, lines, children }) {
  return (
    <section id={id} className="scroll-mt-24 flex flex-col gap-4">
      <div className={cn("rounded-xl px-5 py-6 sm:px-7", TONES[tone])}>
        <h2 className="flex items-center gap-3">
          <Icon name={icon} className="text-[22px] text-secondary" />
          <a href={`#${id}`} className="font-display-hero font-medium text-[30px] leading-9 text-secondary underline decoration-secondary/40 decoration-2 underline-offset-[6px] hover:decoration-secondary transition-colors">
            {title}
          </a>
        </h2>
        <div className="mt-4 ml-1 sm:ml-9 border-l-2 border-secondary/50 pl-5 flex flex-col gap-2">
          {lines.map((l) => (
            <p key={l} className="font-display-hero text-[17px] leading-7 text-secondary/90">{l}</p>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}

function ViewTabs({ tabs, value, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            value === t.value ? "bg-surface-container text-text-primary font-body-sm-medium text-body-sm-medium" : "text-text-secondary hover:bg-surface-container-low font-body-sm text-body-sm"
          )}
        >
          <Icon name={t.icon} className="text-[16px]" />
          {t.label}
          {t.count != null && <span className="ml-0.5 font-table-cell-mono text-[11px] text-text-tertiary">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

function HeadCell({ icon, children, className }) {
  return (
    <TableHead className={cn("px-3 bg-transparent normal-case tracking-normal font-body-sm text-body-sm font-normal text-text-tertiary", className)}>
      <span className={cn("inline-flex items-center gap-1.5", className?.includes("text-right") && "justify-end")}>
        <Icon name={icon} className="text-[16px]" />
        {children}
      </span>
    </TableHead>
  );
}

/* ---------- Live previews ---------- */

function BalancePreview({ balance, toppedUp, spent, onTopUp, onExpense, next }) {
  const pct = toppedUp ? Math.min(100, (spent / toppedUp) * 100) : 0;
  const cantAfford = next.amount > balance;
  return (
    <div className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
      <div className="relative overflow-hidden bg-primary rounded-xl p-6 text-on-primary flex flex-col gap-6">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 34px)" }} />
        <span className="relative font-label-uppercase text-label-uppercase uppercase tracking-wider text-on-primary-container">Available balance</span>
        <span key={balance} className="relative font-display-hero text-[38px] leading-[44px] sm:text-[44px] sm:leading-[48px] tracking-[-0.02em] text-surface-card animate-fade-in">{m(balance)}</span>
        <div className="relative flex flex-col gap-2">
          <div className="w-full bg-surface-card/15 rounded-full h-2 overflow-hidden">
            <div className="bg-accent-sand h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between font-body-sm text-body-sm text-on-primary-container">
            <span>{m(spent)} spent</span>
            <span>{m(toppedUp)} added</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onExpense}
          disabled={cantAfford}
          className="group flex items-center justify-between gap-3 p-4 rounded-xl bg-surface-card shadow-sm hover:bg-surface-subtle text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <span className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-negative-soft text-negative-deep flex items-center justify-center"><Icon name="remove" className="text-[20px]" /></span>
            <span className="flex flex-col">
              <span className="font-body-medium text-body-medium text-text-primary font-semibold">Record an expense</span>
              <span className="font-body-sm text-body-sm text-text-tertiary">{cantAfford ? "Not enough balance. Top up first." : `${next.name}, ${m(next.amount)}`}</span>
            </span>
          </span>
          <Icon name="chevron_right" className="text-[18px] text-text-tertiary group-hover:text-primary" />
        </button>
        <button
          type="button"
          onClick={onTopUp}
          className="group flex items-center justify-between gap-3 p-4 rounded-xl bg-surface-card shadow-sm hover:bg-surface-subtle text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <span className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-positive-soft text-positive-deep flex items-center justify-center"><Icon name="add" className="text-[20px]" /></span>
            <span className="flex flex-col">
              <span className="font-body-medium text-body-medium text-text-primary font-semibold">Top up balance</span>
              <span className="font-body-sm text-body-sm text-text-tertiary">Add {m(2000)} from M-Pesa</span>
            </span>
          </span>
          <Icon name="chevron_right" className="text-[18px] text-text-tertiary group-hover:text-primary" />
        </button>
        <p className="flex items-center gap-1.5 px-1 font-body-sm text-body-sm text-text-tertiary">
          <Icon name="info" className="text-[16px]" /> The balance updates as you click.
        </p>
      </div>
    </div>
  );
}

function ExpenditureTable({ expenses, balance, onPay, onAdd }) {
  const [view, setView] = useState("today");
  const [sortDesc, setSortDesc] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const groups = {
    today: expenses.filter((e) => e.date === today),
    monthly: expenses.filter((e) => e.date >= daysAgo(30)),
    pending: expenses.filter((e) => e.status === "draft"),
  };
  const rows = useMemo(() => {
    let list = groups[view].filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()));
    if (sortDesc) list = [...list].sort((a, b) => b.amount - a.amount);
    return list;
  }, [view, expenses, sortDesc, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    { value: "today", label: "Today", icon: "table_chart", count: groups.today.length },
    { value: "monthly", label: "Monthly", icon: "calendar_view_month", count: groups.monthly.length },
    { value: "pending", label: "Pending", icon: "schedule", count: groups.pending.length },
  ];

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <ViewTabs tabs={tabs} value={view} onChange={setView} />
        <div className="flex items-center gap-1 text-positive-deep">
          {searching && (
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => !query && setSearching(false)}
              placeholder="Search…"
              className="w-28 sm:w-40 px-2 py-1 rounded-md bg-surface-container-low font-body-sm text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          )}
          <button type="button" onClick={() => setSortDesc((v) => !v)} aria-pressed={sortDesc} aria-label="Sort by amount" title="Sort by amount"
            className={cn("w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-container-low", sortDesc && "bg-positive-soft")}>
            <Icon name="swap_vert" className="text-[18px]" />
          </button>
          <button type="button" onClick={() => setSearching((v) => !v)} aria-label="Search expenses" title="Search"
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-container-low">
            <Icon name="search" className="text-[18px]" />
          </button>
        </div>
      </div>

      <Table className="min-w-[640px]">
        <TableHeader className="bg-transparent">
          <TableRow className="hover:bg-transparent border-b border-border-hairline">
            <HeadCell icon="south">Expense</HeadCell>
            <HeadCell icon="category">Category</HeadCell>
            <HeadCell icon="payments" className="text-right">Amount</HeadCell>
            <HeadCell icon="north_east">Paid with</HeadCell>
            <HeadCell icon="progress_activity">Status</HeadCell>
            <HeadCell icon="calendar_today">Date</HeadCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id} className="border-b border-border-hairline/70 animate-fade-in">
              <TableCell className="px-3 py-3 font-body-medium text-body-medium text-text-primary">{e.name}</TableCell>
              <TableCell className="px-3 py-3">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-low font-body-sm text-body-sm text-text-secondary whitespace-nowrap">
                  <Icon name={CATEGORIES[e.cat].icon} className="text-[14px]" /> {CATEGORIES[e.cat].label}
                </span>
              </TableCell>
              <TableCell className="px-3 py-3 text-right font-table-cell-mono text-table-cell-mono font-medium text-text-primary whitespace-nowrap">−{m(e.amount)}</TableCell>
              <TableCell className="px-3 py-3 font-body-sm text-body-sm text-text-secondary whitespace-nowrap">{e.paidWith}</TableCell>
              <TableCell className="px-3 py-3">
                {e.status === "paid" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-positive-soft text-positive-deep font-label-uppercase text-label-uppercase"><span className="w-1.5 h-1.5 rounded-full bg-positive-vibrant" />Paid</span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-text-secondary font-label-uppercase text-label-uppercase"><span className="w-1.5 h-1.5 rounded-full bg-accent-sand" />Pending</span>
                    <button
                      type="button"
                      onClick={() => onPay(e.id)}
                      disabled={e.amount > balance}
                      title={e.amount > balance ? "Not enough balance" : "Pay from balance"}
                      className="font-body-sm-medium text-body-sm-medium text-primary underline underline-offset-2 hover:text-positive-deep disabled:text-text-tertiary disabled:no-underline"
                    >
                      Pay
                    </button>
                  </span>
                )}
              </TableCell>
              <TableCell className="px-3 py-3 font-table-cell-mono text-table-cell-mono text-text-tertiary whitespace-nowrap">{e.date === today ? "Today" : prettyDate(e.date)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="font-body-sm text-body-sm text-text-tertiary">{query ? "No expenses match your search." : view === "pending" ? "Nothing pending. Every expense is paid." : "No expenses here yet."}</p>
          {!query && view !== "pending" && (
            <button type="button" onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-border-subtle font-body-sm text-body-sm text-text-secondary hover:bg-surface-container-low">
              <Icon name="add" className="text-[16px]" /> Add a sample expense
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TopUpTable({ topUps, onAdd }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <ViewTabs tabs={[{ value: "all", label: "All top-ups", icon: "table_chart", count: topUps.length }]} value="all" onChange={() => {}} />
        <button type="button" onClick={onAdd} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-positive-deep hover:bg-positive-soft font-body-sm-medium text-body-sm-medium">
          <Icon name="add" className="text-[16px]" /> New
        </button>
      </div>
      <Table className="min-w-[520px]">
        <TableHeader className="bg-transparent">
          <TableRow className="hover:bg-transparent border-b border-border-hairline">
            <HeadCell icon="north">Top-up</HeadCell>
            <HeadCell icon="payments" className="text-right">Amount</HeadCell>
            <HeadCell icon="account_balance">From</HeadCell>
            <HeadCell icon="calendar_today">Date</HeadCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topUps.map((t) => (
            <TableRow key={t.id} className="border-b border-border-hairline/70 animate-fade-in">
              <TableCell className="px-3 py-3 font-body-medium text-body-medium text-text-primary">{t.note}</TableCell>
              <TableCell className="px-3 py-3 text-right font-table-cell-mono text-table-cell-mono font-semibold text-positive-deep whitespace-nowrap">+{m(t.amount)}</TableCell>
              <TableCell className="px-3 py-3 font-body-sm text-body-sm text-text-secondary">{t.from}</TableCell>
              <TableCell className="px-3 py-3 font-table-cell-mono text-table-cell-mono text-text-tertiary whitespace-nowrap">{t.date === today ? "Today" : prettyDate(t.date)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CategoryGrid({ expenses }) {
  const paid = expenses.filter((e) => e.status === "paid");
  const total = paid.reduce((s, e) => s + e.amount, 0) || 1;
  const byCat = Object.entries(CATEGORIES).map(([id, c]) => ({ id, ...c, amount: paid.filter((e) => e.cat === id).reduce((s, e) => s + e.amount, 0) }));
  byCat.sort((a, b) => b.amount - a.amount);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {byCat.map((c) => (
        <div key={c.id} className="bg-surface-card rounded-xl shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-surface-subtle text-secondary flex items-center justify-center shrink-0"><Icon name={c.icon} className="text-[18px]" /></span>
              <span className="font-title-card text-title-card text-text-primary truncate">{c.label}</span>
            </span>
            <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">{Math.round((c.amount / total) * 100)}%</span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <span className="font-metric-md text-metric-md text-text-primary">{m(c.amount)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-container overflow-hidden">
            <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${(c.amount / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
