import { cn, formatMoney } from "@/lib/utils";
import { Icon } from "@/components/shared/Icon";

/**
 * LedgerShowcase
 * Two columns of miniature Ledgerly screens that drift past each other in opposite directions,
 * fading out at the top and bottom edges. Hovering pauses the motion; people who prefer reduced
 * motion see the columns at rest.
 *
 * Self-contained: the keyframes live in the <style> tag below, so you only need this file.
 * Usage: <LedgerShowcase className="h-[560px]" />
 */
export function LedgerShowcase({ className }) {
  return (
    <div
      className={cn("ledgerly-showcase group relative grid grid-cols-2 gap-4 overflow-hidden select-none", className)}
      style={{
        maskImage: "linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)",
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes ledgerly-drift-up { from { transform: translateY(0); } to { transform: translateY(-50%); } }
        @keyframes ledgerly-drift-down { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        .ledgerly-showcase .ledgerly-col-up { animation: ledgerly-drift-up 42s linear infinite; }
        .ledgerly-showcase .ledgerly-col-down { animation: ledgerly-drift-down 48s linear infinite; }
        .ledgerly-showcase:hover .ledgerly-col-up,
        .ledgerly-showcase:hover .ledgerly-col-down { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .ledgerly-showcase .ledgerly-col-up,
          .ledgerly-showcase .ledgerly-col-down { animation: none; transform: none; }
        }
      `}</style>

      <Column cards={LEFT} direction="up" />
      <Column cards={RIGHT} direction="down" className="pt-10" />
    </div>
  );
}

/* Each column renders its cards twice so the loop is seamless: moving by -50% lands on an identical frame.
   Spacing is padding inside each item (not flex gap) so both halves are exactly the same height. */
function Column({ cards, direction, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("flex flex-col will-change-transform", direction === "up" ? "ledgerly-col-up" : "ledgerly-col-down")}>
        {[...cards, ...cards].map((Card, i) => (
          <div key={i} className="pb-4">
            <Card />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Card frame: a miniature notebook page ---------- */

function Page({ icon, title, children, className }) {
  return (
    <div className={cn("rounded-xl bg-surface-card border border-border-hairline/80 shadow-[0_1px_2px_rgba(31,36,33,0.05),0_10px_28px_-14px_rgba(31,36,33,0.22)] overflow-hidden", className)}>
      <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-subtle/70 border-b border-border-hairline/70">
        <span className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
        <span className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
        <span className="w-1.5 h-1.5 rounded-full bg-border-subtle" />
        <span className="ml-1.5 flex items-center gap-1 font-label-uppercase text-[9px] leading-3 tracking-wider uppercase text-text-tertiary">
          <Icon name={icon} className="text-[11px]" /> {title}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const Tiny = ({ className, children }) => <span className={cn("block font-body-sm text-[10px] leading-[14px]", className)}>{children}</span>;
const k = (v) => formatMoney(v).replace(/\.00$/, "");

/* ---------- The miniature screens ---------- */

function BalanceCard() {
  return (
    <Page icon="account_balance_wallet" title="Wallet">
      <div className="relative overflow-hidden rounded-lg bg-primary p-3 text-on-primary">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 16px)" }} />
        <Tiny className="relative uppercase tracking-wider text-on-primary-container text-[8.5px]">Available balance</Tiny>
        <span className="relative block mt-1 font-display-hero text-[24px] leading-7 text-surface-card">{k(48760)}</span>
        <div className="relative mt-3 h-1 rounded-full bg-surface-card/15 overflow-hidden"><div className="h-full w-[58%] rounded-full bg-accent-sand" /></div>
        <div className="relative mt-1.5 flex justify-between"><Tiny className="text-on-primary-container">58% spent</Tiny><Tiny className="text-on-primary-container">42% left</Tiny></div>
      </div>
    </Page>
  );
}

function ExpenseList() {
  const rows = [
    ["shopping_basket", "Groceries, Naivas", 4870],
    ["directions_bus", "Matatu fare", 150],
    ["bolt", "KPLC tokens", 1500],
    ["restaurant", "Lunch, Mama Oliech", 800],
  ];
  return (
    <Page icon="receipt_long" title="Expenses">
      <div className="flex flex-col divide-y divide-border-hairline/70">
        {rows.map(([icon, name, amt]) => (
          <div key={name} className="flex items-center gap-2 py-1.5">
            <span className="w-5 h-5 rounded bg-surface-subtle text-text-secondary flex items-center justify-center shrink-0"><Icon name={icon} className="text-[12px]" /></span>
            <Tiny className="flex-1 truncate text-text-primary font-medium">{name}</Tiny>
            <Tiny className="font-table-cell-mono text-text-primary">−{k(amt)}</Tiny>
          </div>
        ))}
      </div>
    </Page>
  );
}

function BudgetCard() {
  const rows = [
    ["Food & groceries", 72, "bg-primary"],
    ["Transport", 46, "bg-primary"],
    ["Eating out", 91, "bg-secondary"],
    ["Rent & housing", 100, "bg-negative-vibrant"],
  ];
  return (
    <Page icon="donut_small" title="Budgets">
      <Tiny className="text-text-tertiary uppercase tracking-wider text-[8.5px]">This month</Tiny>
      <div className="mt-2 flex flex-col gap-2">
        {rows.map(([name, pct, color]) => (
          <div key={name}>
            <div className="flex justify-between"><Tiny className="text-text-primary font-medium">{name}</Tiny><Tiny className="font-table-cell-mono text-text-secondary">{pct}%</Tiny></div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-container overflow-hidden"><div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} /></div>
          </div>
        ))}
      </div>
    </Page>
  );
}

function TrendCard() {
  const bars = [32, 54, 28, 70, 46, 88, 40, 62, 36, 74, 50, 30, 58, 44];
  return (
    <Page icon="bar_chart" title="Spending trend">
      <div className="flex items-baseline justify-between">
        <span className="font-display-hero text-[20px] leading-6 text-text-primary">{k(30940)}</span>
        <span className="px-1.5 py-0.5 rounded-full bg-positive-soft text-positive-deep font-label-uppercase text-[8.5px] leading-3">−6.2%</span>
      </div>
      <div className="mt-3 h-16 flex items-end gap-[3px]">
        {bars.map((h, i) => (
          <div key={i} className={cn("flex-1 rounded-t-[3px]", i === 5 ? "bg-primary" : "bg-primary-container/70")} style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between"><Tiny className="text-text-tertiary">1</Tiny><Tiny className="text-text-tertiary">8</Tiny><Tiny className="text-text-tertiary">15</Tiny></div>
    </Page>
  );
}

function ReceiptCard() {
  return (
    <Page icon="description" title="Receipt">
      <div className="rounded-md bg-surface-canvas border border-dashed border-border-subtle p-2.5">
        <Tiny className="text-center font-semibold text-text-primary tracking-wide">NAIVAS WESTLANDS</Tiny>
        <Tiny className="text-center text-text-tertiary">Till 0421 · 27 Oct</Tiny>
        <div className="my-2 border-t border-dashed border-border-subtle" />
        {[["Milk 1L × 2", 280], ["Bread", 75], ["Sukuma wiki", 60], ["Rice 2kg", 410]].map(([n, v]) => (
          <div key={n} className="flex justify-between"><Tiny className="text-text-secondary">{n}</Tiny><Tiny className="font-table-cell-mono text-text-secondary">{v}.00</Tiny></div>
        ))}
        <div className="my-2 border-t border-dashed border-border-subtle" />
        <div className="flex justify-between"><Tiny className="font-semibold text-text-primary">Total</Tiny><Tiny className="font-table-cell-mono font-semibold text-text-primary">{k(825)}</Tiny></div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-positive-deep"><Icon name="check_circle" className="text-[12px]" /><Tiny>Attached to “Groceries”</Tiny></div>
    </Page>
  );
}

function TopUpCard() {
  return (
    <Page icon="savings" title="Income">
      <div className="flex items-center gap-2.5 p-2 rounded-lg bg-positive-soft">
        <span className="w-7 h-7 rounded-md bg-surface-card text-positive-deep flex items-center justify-center shadow-xs"><Icon name="smartphone" className="text-[14px]" /></span>
        <div className="flex-1 min-w-0">
          <Tiny className="text-text-primary font-medium">M-Pesa top-up</Tiny>
          <Tiny className="text-text-tertiary">Today, 08:42</Tiny>
        </div>
        <Tiny className="font-table-cell-mono font-semibold text-positive-deep">+{k(2000)}</Tiny>
      </div>
      <div className="mt-2 flex items-center gap-2.5 p-2 rounded-lg bg-surface-container-low">
        <span className="w-7 h-7 rounded-md bg-surface-card text-text-secondary flex items-center justify-center shadow-xs"><Icon name="work" className="text-[14px]" /></span>
        <div className="flex-1 min-w-0">
          <Tiny className="text-text-primary font-medium">Salary</Tiny>
          <Tiny className="text-text-tertiary">25 Oct</Tiny>
        </div>
        <Tiny className="font-table-cell-mono font-semibold text-positive-deep">+{k(85000)}</Tiny>
      </div>
    </Page>
  );
}

function CategoriesCard() {
  const cats = [["home", "Rent"], ["shopping_basket", "Food"], ["directions_bus", "Transport"], ["bolt", "Bills"], ["wifi", "Data"], ["favorite", "Health"]];
  return (
    <Page icon="category" title="Categories">
      <div className="grid grid-cols-3 gap-1.5">
        {cats.map(([icon, name]) => (
          <div key={name} className="flex flex-col items-center gap-1 py-2 rounded-md bg-surface-container-low">
            <Icon name={icon} className="text-[14px] text-secondary" />
            <Tiny className="text-text-secondary">{name}</Tiny>
          </div>
        ))}
      </div>
    </Page>
  );
}

function DraftCard() {
  return (
    <Page icon="edit_note" title="Draft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Tiny className="text-text-primary font-medium text-[11px]">Dentist check-up</Tiny>
          <Tiny className="text-text-tertiary">Smile Dental · Card</Tiny>
        </div>
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface-container text-text-secondary font-label-uppercase text-[8.5px] leading-3">
          <span className="w-1 h-1 rounded-full bg-accent-sand" />Draft
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="font-display-hero text-[18px] leading-6 text-text-primary">{k(4500)}</span>
        <span className="px-2 py-1 rounded-md bg-primary text-on-primary font-body-sm-medium text-[10px] leading-3">Pay from balance</span>
      </div>
    </Page>
  );
}

const LEFT = [BalanceCard, ExpenseList, ReceiptCard, CategoriesCard];
const RIGHT = [BudgetCard, TopUpCard, TrendCard, DraftCard];
