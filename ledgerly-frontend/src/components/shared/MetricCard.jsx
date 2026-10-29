import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export function MetricCard({ label, value, hint, icon, trend, tone = "neutral", className }) {
  const toneCls = tone === "positive" ? "text-positive-deep" : tone === "negative" ? "text-negative-deep" : "text-text-secondary";
  return (
    <div className={cn("bg-surface-card rounded-xl shadow-sm p-5 flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between">
        <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">{label}</span>
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-surface-subtle text-primary flex items-center justify-center">
            <Icon name={icon} className="text-[18px]" />
          </span>
        )}
      </div>
      <span className="font-metric-lg-mobile text-metric-lg-mobile md:font-metric-lg md:text-metric-lg text-text-primary">{value}</span>
      {(hint || trend) && (
        <span className={cn("font-body-sm text-body-sm flex items-center gap-1", toneCls)}>
          {trend && <Icon name={trend === "up" ? "trending_up" : "trending_down"} className="text-[16px]" />}
          {hint}
        </span>
      )}
    </div>
  );
}
