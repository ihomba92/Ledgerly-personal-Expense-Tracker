import { cn } from "@/lib/utils";

const STYLES = {
  paid: { pill: "bg-positive-soft text-positive-deep", dot: "bg-positive-vibrant", label: "Paid" },
  draft: { pill: "bg-surface-container text-text-secondary", dot: "bg-accent-sand", label: "Draft" },
  over: { pill: "bg-negative-soft text-negative-deep", dot: "bg-negative-vibrant", label: "Over budget" },
  near: { pill: "bg-secondary-fixed/50 text-secondary", dot: "bg-secondary", label: "Near limit" },
  ok: { pill: "bg-positive-soft text-positive-deep", dot: "bg-positive-vibrant", label: "On track" },
};

export function StatusBadge({ status, label, size = "md", className }) {
  const s = STYLES[status] ?? STYLES.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-label-uppercase text-label-uppercase whitespace-nowrap",
        size === "lg" ? "px-3 py-1.5" : size === "sm" ? "px-2.5 py-0.5" : "px-2.5 py-1",
        s.pill,
        className
      )}
    >
      <span className={cn("rounded-full", size === "lg" ? "w-2 h-2" : "w-1.5 h-1.5", s.dot)} />
      {label ?? s.label}
    </span>
  );
}

/** Coloured pill with a dot, for categories and payment methods. */
export function DotPill({ label, pill, dot, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-uppercase text-label-uppercase whitespace-nowrap", pill, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

/** Category label with its icon, used in tables. */
export function CategoryTag({ category, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-low font-body-sm text-body-sm text-text-secondary whitespace-nowrap", className)}>
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{category.icon}</span>
      {category.label}
    </span>
  );
}
