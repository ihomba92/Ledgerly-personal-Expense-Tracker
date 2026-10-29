import { Icon } from "./Icon";

export function EmptyState({ icon = "inbox", title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 px-6 py-12">
      <span className="w-11 h-11 rounded-xl bg-surface-subtle text-text-tertiary flex items-center justify-center mb-1">
        <Icon name={icon} className="text-[22px]" />
      </span>
      <p className="font-title-card text-title-card text-text-primary">{title}</p>
      {description && <p className="font-body-sm text-body-sm text-text-tertiary max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
