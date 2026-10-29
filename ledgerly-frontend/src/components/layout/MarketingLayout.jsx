import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared/Icon";
import { Logo } from "@/components/shared/Logo";
import { useAuth } from "@/store/Auth";

const LINKS = [
  { href: "/#balance", label: "Balance" },
  { href: "/#expenditure", label: "Expenditure" },
  { href: "/#topups", label: "Top-ups" },
  { href: "/#categories", label: "Categories" },
];

export function MarketingLayout() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { status } = useAuth();
  const signedIn = status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-40 h-16 transition-all",
          scrolled ? "bg-surface/85 backdrop-blur-xl shadow-shell" : "bg-transparent"
        )}
      >
        <div className="mx-auto max-w-6xl h-full px-4 sm:px-6 flex items-center justify-between gap-6">
          <Logo />
          <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="px-3 py-2 rounded-lg font-body-medium text-body-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-low transition-colors">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            {signedIn ? (
              <Button asChild><Link to="/app/dashboard">Open your ledger</Link></Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link to="/login">Log in</Link></Button>
                <Button asChild><Link to="/signup">Create account</Link></Button>
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={open}>
            <Icon name={open ? "close" : "menu"} className="text-[20px]" />
          </Button>
        </div>
        {open && (
          <div className="md:hidden bg-surface-card border-t border-border-hairline shadow-[0_12px_32px_rgba(31,36,33,0.08)] px-4 py-3 flex flex-col gap-1 animate-fade-in">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg font-body-medium text-body-medium text-text-secondary hover:bg-surface-container-low">
                {l.label}
              </a>
            ))}
            {signedIn ? (
              <Button asChild className="mt-2"><Link to="/app/dashboard">Open your ledger</Link></Button>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="secondary" asChild><Link to="/login">Log in</Link></Button>
                <Button asChild><Link to="/signup">Create account</Link></Button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-surface-container-low">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-3 max-w-xs">
            <Logo />
            <p className="font-body-sm text-body-sm text-text-secondary">
              A calm, personal ledger for everyday spending. Set your balance, record expenses, and always know what’s left.
            </p>
          </div>
          <FooterCol title="Ledger" items={["Balance", "Expenditure", "Top-ups", "Categories"]} />
          <FooterCol title="Account" items={["Create account", "Log in", "Settings", "Support"]} />
          <FooterCol title="Legal" items={["Privacy", "Terms", "Cookies", "Contact"]} />
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row gap-2 justify-between border-t border-border-hairline">
          <span className="font-body-sm text-body-sm text-text-tertiary">© {new Date().getFullYear()} Ledgerly. All rights reserved.</span>
          <span className="font-body-sm text-body-sm text-text-tertiary flex items-center gap-1.5">
            <Icon name="lock" className="text-[14px]" /> Your ledger is private to your account
          </span>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">{title}</span>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li key={i}>
            <a href="#" className="font-body-sm text-body-sm text-text-secondary hover:text-text-primary transition-colors">{i}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
