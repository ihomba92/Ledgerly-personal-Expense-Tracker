import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col px-5 sm:px-10 py-8">
      <Logo />
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
        <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">Error 404</span>
        <h1 className="font-display-hero-mobile text-display-hero-mobile md:font-display-hero md:text-display-hero text-text-primary">This page isn’t in the ledger.</h1>
        <p className="font-body-regular text-body-regular text-text-secondary max-w-md">The link may be out of date, or the page has moved.</p>
        <div className="flex gap-3 pt-2">
          <Button asChild><Link to="/app/dashboard">Go to dashboard</Link></Button>
          <Button variant="secondary" asChild><Link to="/">Back to home</Link></Button>
        </div>
      </div>
    </div>
  );
}
