import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/shared/Icon";
import { api } from "@/lib/api";
import { clearLinkFromAddressBar, readLinkValue } from "@/lib/linkToken";
import { logger } from "@/lib/logger";
import { useAuth } from "@/store/Auth";

/**
 * Last step of "Continue with Google / Microsoft". The API sends the browser here with
 *   /auth/callback#code=<one-time code>
 * The code is read, removed from the address bar, and swapped for a login token with a POST
 * request, so no login token ever appears in a URL.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [code] = useState(() => readLinkValue("code"));
  const [error, setError] = useState(code ? "" : "This sign-in link is incomplete. Please try again.");
  const started = useRef(false); // React runs effects twice in development; the code only works once

  useEffect(() => clearLinkFromAddressBar(), []);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    api("/auth/oauth/exchange", { method: "POST", auth: false, body: { code } })
      .then((data) => {
        applySession(data.access_token, data.user);
        logger.info(`Signed in with ${data.user.providers.join(", ")}${data.is_new_user ? " (new account)" : ""}`);
        navigate(data.is_new_user ? "/app/dashboard?setup=1" : "/app/dashboard", { replace: true });
      })
      .catch((err) => setError(err.message));
  }, [code, navigate, applySession]);

  if (error) {
    return (
      <div className="flex flex-col gap-6" role="alert">
        <span className="w-12 h-12 rounded-xl bg-negative-soft text-negative-deep flex items-center justify-center"><Icon name="link_off" className="text-[24px]" /></span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Sign-in didn’t finish</h1>
          <p className="font-body-regular text-body-regular text-text-secondary">{error}</p>
        </div>
        <Button asChild size="lg"><Link to="/login">Back to log in</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4" role="status" aria-live="polite">
      <span className="w-12 h-12 rounded-xl bg-surface-subtle text-primary flex items-center justify-center">
        <Icon name="progress_activity" className="text-[24px] animate-spin" />
      </span>
      <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Signing you in…</h1>
      <p className="font-body-regular text-body-regular text-text-secondary">This only takes a moment.</p>
    </div>
  );
}
