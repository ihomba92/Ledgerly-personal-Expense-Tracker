import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/shared/Icon";
import { useAppData } from "@/store/AppData";

const KINDS = {
  welcome: { icon: "waving_hand", tone: "bg-positive-soft text-positive-deep" },
  budget_near: { icon: "donut_small", tone: "bg-secondary-fixed/60 text-secondary" },
  budget_over: { icon: "warning", tone: "bg-negative-soft text-negative-deep" },
  low_balance: { icon: "account_balance_wallet", tone: "bg-negative-soft text-negative-deep" },
  security: { icon: "shield_lock", tone: "bg-surface-container text-text-primary" },
};

function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 172800) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The bell in the top bar: unread count, and a panel with the latest notifications. */
export function NotificationBell() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, deleteNotification, refreshNotifications } = useAppData();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    refreshNotifications();
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, refreshNotifications]);

  const openItem = (n) => {
    if (!n.read) markNotificationRead(n.id).catch(() => {});
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Icon name="notifications" className="text-[20px]" filled={open} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-negative-vibrant text-on-primary font-table-cell-mono text-[10px] font-semibold leading-[18px] text-center ring-2 ring-surface">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(380px,calc(100vw-2rem))] rounded-xl bg-surface-card border border-border-hairline shadow-[0_12px_32px_rgba(31,36,33,0.14)] overflow-hidden animate-fade-in z-50">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-subtle/60">
            <div className="flex items-center gap-2">
              <span className="font-title-card text-title-card text-text-primary">Notifications</span>
              {unreadCount > 0 && <span className="px-2 py-0.5 rounded-full bg-negative-soft text-negative-deep font-label-uppercase text-label-uppercase">{unreadCount} new</span>}
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markAllNotificationsRead().catch(() => {})}
                className="font-body-sm-medium text-body-sm-medium text-primary hover:underline underline-offset-4">
                Mark all as read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-2 px-6 py-10">
              <span className="w-10 h-10 rounded-xl bg-surface-subtle text-text-tertiary flex items-center justify-center"><Icon name="notifications_off" className="text-[20px]" /></span>
              <p className="font-title-card text-title-card text-text-primary">You’re all caught up</p>
              <p className="font-body-sm text-body-sm text-text-tertiary">Budget warnings, low balance alerts and security notices appear here.</p>
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto divide-y divide-border-hairline/70">
              {notifications.map((n) => {
                const kind = KINDS[n.kind] ?? KINDS.security;
                return (
                  <li key={n.id} className={cn("group relative", !n.read && "bg-positive-soft/40")}>
                    <button type="button" onClick={() => openItem(n)}
                      className="w-full text-left flex gap-3 px-4 py-3 pr-10 hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:bg-surface-container-low">
                      <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", kind.tone)}><Icon name={kind.icon} className="text-[18px]" /></span>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <span className={cn("font-body-sm-medium text-body-sm-medium text-text-primary", !n.read && "font-semibold")}>{n.title}</span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-negative-vibrant shrink-0" aria-label="Unread" />}
                        </span>
                        <span className="font-body-sm text-body-sm text-text-secondary">{n.body}</span>
                        <span className="font-table-cell-mono text-[11px] text-text-tertiary mt-0.5">{timeAgo(n.created_at)}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => deleteNotification(n.id).catch(() => {})} aria-label={`Remove “${n.title}”`} title="Remove"
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-container hover:text-text-primary transition-opacity">
                      <Icon name="close" className="text-[16px]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="px-4 py-2.5 border-t border-border-hairline flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-text-tertiary">Choose which alerts you get</span>
            <button type="button" onClick={() => { setOpen(false); navigate("/app/settings"); }}
              className="font-body-sm-medium text-body-sm-medium text-primary hover:underline underline-offset-4">Settings</button>
          </div>
        </div>
      )}
    </div>
  );
}
