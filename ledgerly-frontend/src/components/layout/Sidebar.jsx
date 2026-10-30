import { NavLink } from "react-router-dom";
import { cn, formatWhole } from "@/lib/utils";
import { Icon } from "@/components/shared/Icon";
import { Logo } from "@/components/shared/Logo";
import { useAuth } from "@/store/Auth";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useAppData } from "@/store/AppData";

export const NAV_ITEMS = [
  { to: "/app/dashboard", label: "Home / Dashboard", icon: "grid_view" },
  { to: "/app/wallet", label: "Wallet", icon: "account_balance_wallet" },
  { to: "/app/expenses", label: "Expenses", icon: "receipt_long", badge: "drafts" },
  { to: "/app/income", label: "Income", icon: "savings" },
  { to: "/app/categories", label: "Categories & budgets", icon: "category" },
];
const SECONDARY = [
  { to: "/app/settings", label: "Settings", icon: "tune" },
  { to: "/app/support", label: "Support", icon: "help_outline" },
];

export function Sidebar({ open, onClose }) {
  const { expenses, balance } = useAppData();
  const { user } = useAuth();
  const badges = { drafts: expenses.filter((e) => e.status === "draft").length };

  const link = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-body-medium text-body-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          isActive ? "bg-positive-soft text-positive-deep font-semibold" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        )
      }
    >
      <Icon name={item.icon} className="text-[20px]" />
      <span className="flex-1">{item.label}</span>
      {item.badge && badges[item.badge] ? (
        <span title={`${badges[item.badge]} drafts to pay`} className="min-w-5 h-5 px-1.5 rounded-full bg-surface-container-high text-text-secondary font-table-cell-mono text-[11px] flex items-center justify-center">
          {badges[item.badge]}
        </span>
      ) : null}
    </NavLink>
  );

  return (
    <>
      <div onClick={onClose} aria-hidden="true"
        className={cn("fixed inset-0 z-40 bg-text-primary/30 backdrop-blur-[2px] transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")} />
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-surface-container-low z-50 flex flex-col justify-between py-6 px-4 shadow-shell overflow-y-auto",
          "transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        <div className="flex flex-col gap-6">
          <NavLink to="/app/settings" onClick={onClose}
            className="flex items-center gap-3 px-2 py-1.5 bg-surface-container rounded-lg hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <UserAvatar size="md" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-title-card text-title-card text-on-surface truncate">{user?.name}</span>
              <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase truncate">{user?.role}</span>
            </div>
            <Icon name="unfold_more" className="text-text-tertiary text-[18px]" />
          </NavLink>

          <div className="px-2"><span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">My ledger</span></div>
          <nav className="flex flex-col gap-1">{NAV_ITEMS.map(link)}</nav>

          <div className="px-2"><span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">Account</span></div>
          <nav className="flex flex-col gap-1" aria-label="Account">{SECONDARY.map(link)}</nav>
        </div>

        <div className="flex flex-col gap-4 px-2 pt-6">
          <NavLink to="/app/wallet" onClick={onClose}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-subtle hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", balance < 0 ? "bg-negative-vibrant" : "bg-positive-vibrant")} />
              <span className="font-label-uppercase text-label-uppercase text-text-secondary uppercase">Balance</span>
            </div>
            <span className={cn("font-table-cell-mono text-table-cell-mono font-semibold", balance < 0 ? "text-negative-deep" : "text-text-primary")}>{formatWhole(balance)}</span>
          </NavLink>
          <Logo to="/app/dashboard" className="px-2" />
        </div>
      </aside>
    </>
  );
}
