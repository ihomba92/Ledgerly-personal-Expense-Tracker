import { cn } from "@/lib/utils";
import { useAuth } from "@/store/Auth";

const SIZES = {
  sm: "w-8 h-8 text-[12px]",
  md: "w-9 h-9 font-title-card text-title-card",
  lg: "w-16 h-16 font-metric-md text-metric-md",
};

/** The logged-in user's profile picture, or their initials on deep green when there isn't one. */
export function UserAvatar({ size = "md", className }) {
  const { user, avatarUrl } = useAuth();
  return (
    <span className={cn("rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-primary text-on-primary select-none", SIZES[size], className)}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden="true">{user?.initials}</span>
      )}
    </span>
  );
}
