import { cn } from "@/lib/utils";

/** The pill-style tab switcher from the Stitch Trips header. */
export function SegmentedControl({ options, value, onChange, className, label = "Filter" }) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex items-center bg-surface-container-low rounded-lg p-1 overflow-x-auto", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              active
                ? "bg-surface-card text-on-surface shadow-sm font-body-sm-medium text-body-sm-medium"
                : "text-text-secondary hover:text-on-surface font-body-sm text-body-sm"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
