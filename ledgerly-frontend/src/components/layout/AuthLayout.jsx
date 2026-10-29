import { Outlet } from "react-router-dom";
import { Icon } from "@/components/shared/Icon";
import { Logo } from "@/components/shared/Logo";
import { formatMoney } from "@/lib/utils";

/** Split-screen layout shared by the login and create-account pages. */
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-surface grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 sm:px-10 py-8">
        <Logo />
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-fade-in">
            <Outlet />
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-text-tertiary flex items-center gap-1.5">
          <Icon name="lock" className="text-[14px]" /> Your ledger is private to your account
        </p>
      </div>

      <aside className="hidden lg:flex relative overflow-hidden bg-primary m-3 rounded-xl flex-col justify-between p-10 xl:p-14 text-on-primary">
        {/* Fine ledger lines echo the product without decoration for its own sake */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 44px)" }}
        />
        <div className="relative flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-fixed-dim" />
          <span className="font-label-uppercase text-label-uppercase uppercase tracking-wider text-on-primary-container">Personal Expense Ledger</span>
        </div>

        <div className="relative flex flex-col gap-4 max-w-md">
          <h2 className="font-display-hero text-[44px] leading-[50px] tracking-[-0.02em] text-surface-card">
            Know what’s left before you spend it.
          </h2>
          <p className="font-body-regular text-[16px] leading-[26px] text-on-primary-container">
            Add your balance once. Every expense you record is taken off the total, and top-ups add to it.
          </p>
        </div>

        <div className="relative bg-surface-card/10 backdrop-blur-md rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-label-uppercase text-label-uppercase uppercase tracking-wider text-on-primary-container">Available balance</span>
            <span className="font-table-cell-mono text-table-cell-mono text-on-primary-container">Today</span>
          </div>
          <span className="font-metric-lg text-metric-lg text-surface-card">{formatMoney(48760)}</span>
          <div className="flex flex-col gap-2">
            {[
              ["Weekly groceries, Naivas", -4870, "shopping_basket"],
              ["Salary", 85000, "work"],
              ["Lunch, Mama Oliech", -800, "restaurant"],
            ].map(([label, amount, icon]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface-card/10">
                <span className="flex items-center gap-2.5 font-body-sm text-body-sm text-surface-card">
                  <Icon name={icon} className="text-[16px] text-primary-fixed-dim" /> {label}
                </span>
                <span className={amount > 0 ? "font-table-cell-mono text-table-cell-mono text-primary-fixed" : "font-table-cell-mono text-table-cell-mono text-surface-card"}>
                  {amount > 0 ? "+" : "−"}{formatMoney(Math.abs(amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
