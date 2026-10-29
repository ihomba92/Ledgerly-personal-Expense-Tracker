/** The Stitch page header: eyebrow meta line, Newsreader display title, actions on the right. */
export function PageHeader({ eyebrow, meta, title, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        {(eyebrow || meta) && (
          <div className="flex items-center gap-2 mb-1">
            {eyebrow && <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">{eyebrow}</span>}
            {eyebrow && meta && <span className="w-1.5 h-1.5 rounded-full bg-accent-sand" />}
            {meta && <span className="font-table-cell-mono text-table-cell-mono text-text-secondary">{meta}</span>}
          </div>
        )}
        <h1 className="font-display-hero-mobile text-display-hero-mobile md:font-display-hero md:text-display-hero text-text-primary tracking-tight">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
