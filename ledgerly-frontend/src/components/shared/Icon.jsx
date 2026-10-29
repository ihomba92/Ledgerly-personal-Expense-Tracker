import { cn } from "@/lib/utils";

/** Material Symbols Outlined icon, as used throughout the Stitch design. */
export function Icon({ name, filled = false, className, style, ...props }) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined select-none", className)}
      style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24", ...style } : style}
      {...props}
    >
      {name}
    </span>
  );
}
