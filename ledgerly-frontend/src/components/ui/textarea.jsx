import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[110px] w-full rounded-lg border border-border-subtle bg-surface-card px-3 py-2.5 font-body-regular text-body-regular text-text-primary placeholder:text-text-tertiary transition-colors resize-y",
      "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 aria-[invalid=true]:border-negative-vibrant",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
