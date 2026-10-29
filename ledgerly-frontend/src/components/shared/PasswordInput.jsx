import { forwardRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Icon } from "./Icon";

export const PasswordInput = forwardRef((props, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className="pr-10" {...props} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Icon name={show ? "visibility_off" : "visibility"} className="text-[18px]" />
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
