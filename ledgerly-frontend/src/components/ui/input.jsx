import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-10 w-full rounded-lg border border-border-subtle bg-surface-card px-3 font-body-regular text-body-regular text-text-primary placeholder:text-text-tertiary transition-colors",
      "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
      "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-negative-vibrant aria-[invalid=true]:ring-negative-vibrant/15",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
