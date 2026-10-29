import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-body-sm-medium text-body-sm-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 [&_.material-symbols-outlined]:text-[18px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-primary-container shadow-sm",
        secondary: "bg-surface-subtle text-on-surface hover:bg-surface-container-high",
        outline: "border border-border-subtle bg-surface-card text-text-primary hover:bg-surface-container-low",
        ghost: "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
        soft: "bg-surface-card text-text-primary shadow-sm hover:bg-surface-container",
        destructive: "bg-negative-soft text-negative-deep hover:bg-[#F6E1D8]",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-11 px-6 font-body-medium text-body-medium",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
