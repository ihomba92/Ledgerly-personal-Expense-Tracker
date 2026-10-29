import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Toast styled after the Stitch Approvals notification: ink background, bottom-right.
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, { tone = "success", action } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, tone, action, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed bottom-6 right-6 left-6 sm:left-auto z-[70] bg-text-primary text-on-primary px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all duration-300",
          toast ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
        )}
      >
        <span className={cn("material-symbols-outlined text-[20px]", toast?.tone === "info" ? "text-secondary-container" : "text-primary-fixed-dim")}>
          {toast?.tone === "info" ? "info" : "check_circle"}
        </span>
        <span className="font-body-sm-medium text-body-sm-medium flex-1">{toast?.message}</span>
        {toast?.action && (
          <button
            type="button"
            onClick={() => { toast.action.onClick(); setToast(null); }}
            className="font-body-sm-medium text-body-sm-medium text-primary-fixed-dim hover:underline underline-offset-4"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
