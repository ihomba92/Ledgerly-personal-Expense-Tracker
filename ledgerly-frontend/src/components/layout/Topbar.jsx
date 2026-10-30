import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared/Icon";
import { useAuth } from "@/store/Auth";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { formatMoney } from "@/lib/utils";
import { useAppData } from "@/store/AppData";

export function Topbar({ onMenu }) {
  const { user, signOut } = useAuth();
  const { openExpenseDrawer, openTopUp, balance } = useAppData();
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // ⌘K / Ctrl+K focuses search, as hinted by the Stitch shortcut chip.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/85 backdrop-blur-xl z-30 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 shadow-shell">
      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-80">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenu} aria-label="Open navigation">
          <Icon name="menu" className="text-[20px]" />
        </Button>
        <label className="hidden sm:flex items-center gap-2 w-full px-3 py-1.5 rounded-lg bg-surface-container-low text-text-tertiary focus-within:text-on-surface focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-primary/10 transition-colors cursor-text">
          <Icon name="search" className="text-[18px]" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search expenses, merchants, notes..."
            className="bg-transparent w-full min-w-0 font-body-sm text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="ml-auto font-table-cell-mono text-table-cell-mono bg-surface-container px-1.5 py-0.5 rounded text-text-tertiary text-[10px]">⌘K</kbd>
        </label>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden md:flex items-center gap-1 pl-1 pr-1 py-1 rounded-lg bg-positive-soft text-positive-deep">
          <Link
            to="/app/wallet"
            title="Open wallet"
            className="flex items-center gap-2 px-1.5 py-0.5 rounded-md hover:bg-[#dde9e1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Icon name="account_balance_wallet" className="text-[16px]" />
            <span className="font-label-uppercase text-label-uppercase uppercase text-text-tertiary hidden xl:inline">Balance</span>
            <span className={balance < 0 ? "font-table-cell-mono text-table-cell-mono font-semibold text-negative-deep" : "font-table-cell-mono text-table-cell-mono font-semibold"}>{formatMoney(balance)}</span>
          </Link>
          <button
            type="button"
            onClick={openTopUp}
            aria-label="Top up balance"
            title="Top up"
            className="w-6 h-6 rounded-md bg-surface-card text-positive-deep flex items-center justify-center shadow-xs hover:bg-primary hover:text-on-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Icon name="add" className="text-[16px]" />
          </button>
        </div>
        <Button variant="secondary" size="sm" className="hidden 2xl:inline-flex [&_.material-symbols-outlined]:text-[16px]">
          <Icon name="cloud_download" />
          <span>Export</span>
        </Button>
        <Button size="sm" className="px-3.5 [&_.material-symbols-outlined]:text-[16px] hover:bg-positive-deep" onClick={() => openExpenseDrawer()}>
          <Icon name="add" />
          <span className="hidden sm:inline">New Expense</span>
        </Button>
        <div className="h-4 w-px bg-surface-container-high hidden sm:block" />
        <NotificationBell />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2"
          >
            <UserAvatar size="sm" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl bg-surface-card border border-border-hairline shadow-[0_12px_32px_rgba(31,36,33,0.12)] p-1.5 animate-fade-in">
              <div className="px-3 py-2.5">
                <p className="font-title-card text-title-card text-text-primary truncate">{user?.name}</p>
                <p className="font-body-sm text-body-sm text-text-tertiary truncate">{user?.email}</p>
              </div>
              <div className="h-px bg-border-hairline my-1" />
              <MenuLink to="/app/settings" icon="person" onClick={() => setMenuOpen(false)}>Profile &amp; settings</MenuLink>
              <MenuLink to="/app/support" icon="help_outline" onClick={() => setMenuOpen(false)}>Help &amp; support</MenuLink>
              <div className="h-px bg-border-hairline my-1" />
              <MenuLink to="/login" icon="logout" onClick={() => { setMenuOpen(false); signOut(); }}>Sign out</MenuLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuLink({ to, icon, children, onClick }) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg font-body-medium text-body-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-none focus-visible:bg-surface-container-low"
    >
      <Icon name={icon} className="text-[18px]" />
      {children}
    </Link>
  );
}
