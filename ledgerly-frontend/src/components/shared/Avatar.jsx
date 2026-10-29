import { useState } from "react";
import { cn } from "@/lib/utils";

/** Photo avatar with an initials fallback (used when there is no photo or it fails to load). */
export function Avatar({ src, initials, alt = "", size = "md", className, fallbackClass = "bg-surface-container text-text-primary" }) {
  const [failed, setFailed] = useState(false);
  const sizes = { xs: "w-6 h-6 text-[11px]", sm: "w-8 h-8 text-[12px]", md: "w-9 h-9 text-[13px]", lg: "w-10 h-10 text-[14px]" };
  return (
    <div className={cn("relative rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-semibold", sizes[size], !src || failed ? fallbackClass : "bg-surface-container", className)}>
      {src && !failed ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden={!!alt}>{initials}</span>
      )}
    </div>
  );
}
