import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

/** A message box above a form: errors (default), info or success. */
export function FormAlert({ tone = "error", children, action, className }) {
  if (!children) return null;
  const styles = {
    error: ["bg-negative-soft text-negative-deep", "error"],
    info: ["bg-surface-subtle text-text-secondary", "info"],
    success: ["bg-positive-soft text-positive-deep", "check_circle"],
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 p-3 rounded-lg", styles[0], className)}>
      <Icon name={styles[1]} className="text-[18px] mt-px shrink-0" />
      <div className="flex-1 flex flex-col gap-2 font-body-sm text-body-sm">
        <span>{children}</span>
        {action}
      </div>
    </div>
  );
}
