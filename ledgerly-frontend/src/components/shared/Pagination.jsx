import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export function Pagination({ page, pageCount, onPage, className }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-surface-card disabled:text-text-tertiary disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Icon name="chevron_left" className="text-[16px]" />
      </button>
      <span className="px-2 py-0.5 rounded bg-surface-card font-table-cell-mono text-table-cell-mono text-text-primary shadow-xs" aria-current="page">{page}</span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:bg-surface-card disabled:text-text-tertiary disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Icon name="chevron_right" className="text-[16px]" />
      </button>
    </div>
  );
}
