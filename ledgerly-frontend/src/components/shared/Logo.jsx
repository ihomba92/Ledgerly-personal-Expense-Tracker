import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export function Logo({ to = "/", inverted = false, className }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", className)}>
      <span className={cn("w-6 h-6 rounded flex items-center justify-center", inverted ? "bg-surface-card" : "bg-primary")}>
        <Icon name="account_balance" className={cn("text-[14px]", inverted ? "text-primary" : "text-on-primary")} />
      </span>
      <span className={cn("font-headline-section text-headline-section tracking-tight font-bold", inverted ? "text-surface-card" : "text-primary")}>
        Ledgerly
      </span>
    </Link>
  );
}
