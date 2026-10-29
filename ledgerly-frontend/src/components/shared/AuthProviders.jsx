import { useEffect, useState } from "react";
import { api, API_URL } from "@/lib/api";
import { cn } from "@/lib/utils";

const MARKS = {
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  ),
  microsoft: (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" /><path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" /><path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  ),
};

/**
 * "Continue with Google / Microsoft" buttons. Only providers the API has keys for are shown;
 * with none set up, nothing renders. Each button is a normal link: the browser goes to the API,
 * then to Google/Microsoft, and comes back to /auth/callback.
 */
export function AuthProviders({ remember = true, dividerText = "or with email" }) {
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    api("/auth/oauth/providers", { auth: false }).then((d) => setProviders(d.providers)).catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) return null;
  return (
    <>
      <div className={cn("grid gap-3", providers.length > 1 && "grid-cols-2")}>
        {providers.map((p) => (
          <a
            key={p.id}
            href={`${API_URL}/api/auth/oauth/${p.id}/start${remember ? "?remember=1" : ""}`}
            className="h-10 inline-flex items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface-card text-text-primary font-body-sm-medium text-body-sm-medium hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {MARKS[p.id]} {providers.length > 1 ? p.label : `Continue with ${p.label}`}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border-hairline" />
        <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase">{dividerText}</span>
        <span className="h-px flex-1 bg-border-hairline" />
      </div>
    </>
  );
}

/** Messages for failed Google/Microsoft sign-ins (sent back as /login#oauth_error=...). */
export const OAUTH_ERRORS = {
  cancelled: "Sign-in was cancelled. Choose an option below to try again.",
  expired: "That sign-in took too long or was started in another window. Please try again.",
  email_unverified: "That account hasn’t confirmed its email address with the provider, so we can’t use it to sign in. Sign up with your email and a password instead.",
  no_email: "That account didn’t share an email address, so we can’t use it to sign in.",
  failed: "We couldn’t complete that sign-in. Please try again.",
};
