import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ExpenseDrawer } from "@/components/expenses/ExpenseDrawer";
import { TopUpDialog } from "@/components/wallet/TopUpDialog";
import { useAppData } from "@/store/AppData";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared/Icon";

/** Authenticated app shell: fixed sidebar + translucent top bar, as in the Stitch layout. */
export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { openTopUp, loadState, loadError, refresh, topUps } = useAppData();

  // A newly confirmed account lands on ?setup=1 and is asked for a starting balance,
  // but only once its ledger has loaded and only if it really is empty.
  useEffect(() => {
    if (params.get("setup") === "1" && loadState === "ready") {
      if (topUps.length === 0) openTopUp();
      navigate(pathname, { replace: true });
    }
  }, [params, pathname, navigate, openTopUp, loadState, topUps.length]);

  useEffect(() => {
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="bg-surface min-h-screen">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main className="relative pt-16 w-full flex-1 px-4 sm:px-6 lg:px-8 pb-12 bg-surface">
          <div key={pathname} className="flex flex-col w-full pt-6 animate-fade-in">
            {loadState === "error" ? (
              <div className="py-24 flex flex-col items-center gap-4 text-center" role="alert">
                <Icon name="cloud_off" className="text-[32px] text-text-tertiary" />
                <p className="font-title-card text-title-card text-text-primary">We couldn’t load your ledger</p>
                <p className="font-body-sm text-body-sm text-text-tertiary max-w-sm">{loadError}</p>
                <Button variant="secondary" onClick={refresh}><Icon name="refresh" /> Try again</Button>
              </div>
            ) : loadState !== "ready" ? (
              <div className="py-24 flex justify-center" role="status" aria-label="Loading your ledger">
                <span className="material-symbols-outlined animate-spin text-primary text-[28px]">progress_activity</span>
              </div>
            ) : (
              <Suspense fallback={<div className="py-24 flex justify-center"><span className="material-symbols-outlined animate-spin text-primary text-[28px]">progress_activity</span></div>}>
                <Outlet />
              </Suspense>
            )}
          </div>
        </main>
      </div>
      <ExpenseDrawer />
      <TopUpDialog />
    </div>
  );
}
