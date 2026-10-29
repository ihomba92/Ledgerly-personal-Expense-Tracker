import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Icon } from "@/components/shared/Icon";
import { api } from "@/lib/api";
import { clearLinkFromAddressBar, readLinkValue } from "@/lib/linkToken";
import { useAuth } from "@/store/Auth";

/**
 * Opened from the link in the "Confirm your email" message:
 *   /verify-email#token=...  (the token is read, then removed from the address bar)
 * Confirms the email, saves the login token and goes straight to the dashboard.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [token] = useState(() => readLinkValue("token"));
  const [state, setState] = useState(token ? "checking" : "invalid"); // checking | done | invalid | error
  const [message, setMessage] = useState("");
  const started = useRef(false); // React runs effects twice in development; the link only works once

  useEffect(() => clearLinkFromAddressBar(), []);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    api("/auth/verify-email", { method: "POST", body: { token }, auth: false })
      .then((data) => {
        applySession(data.access_token, data.user);
        setState("done");
        // ?setup=1 opens "Add your balance" on the dashboard for a brand-new ledger.
        setTimeout(() => navigate("/app/dashboard?setup=1", { replace: true }), 1200);
      })
      .catch((err) => {
        setMessage(err.message);
        setState(err.reason === "invalid_link" ? "invalid" : "error");
      });
  }, [token, navigate, applySession]);

  if (state === "checking") {
    return (
      <Status icon="progress_activity" spin title="Confirming your email…" body="This only takes a moment." />
    );
  }

  if (state === "done") {
    return (
      <Status icon="verified" tone="positive" title="Email confirmed" body="Welcome to Ledgerly. Opening your ledger…" />
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col gap-6">
        <Status icon="wifi_off" tone="negative" title="We couldn’t confirm your email" body={message} />
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  return <ResendLink message={message} />;
}

function Status({ icon, title, body, tone, spin }) {
  const toneCls = tone === "positive" ? "bg-positive-soft text-positive-deep" : tone === "negative" ? "bg-negative-soft text-negative-deep" : "bg-surface-subtle text-primary";
  return (
    <div className="flex flex-col items-start gap-4" role="status" aria-live="polite">
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${toneCls}`}>
        <Icon name={icon} className={`text-[24px] ${spin ? "animate-spin" : ""}`} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">{title}</h1>
        <p className="font-body-regular text-body-regular text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

const schema = z.object({ email: z.string().min(1, "Enter your email.").email("Enter a valid email address.") });

/** Shown when the link is used, expired or replaced by a newer one. */
function ResendLink({ message }) {
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async ({ email }) => {
    setError("");
    try {
      const data = await api("/auth/resend-verification", { method: "POST", body: { email }, auth: false });
      setSent(data.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Status
        icon="link_off"
        tone="negative"
        title="This link has expired"
        body={message || "Confirmation links work once, for 24 hours. Enter your email and we’ll send a new one."}
      />
      {sent ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-positive-soft text-positive-deep" role="status">
          <Icon name="mark_email_read" className="text-[18px] mt-px" />
          <span className="font-body-sm text-body-sm">{sent}</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" autoComplete="email" placeholder="you@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {error && <p className="font-body-sm text-body-sm text-negative-deep" role="alert">{error}</p>}
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Sending…" : "Send a new link"}
            </Button>
          </form>
        </Form>
      )}
      <p className="font-body-sm text-body-sm text-text-secondary">
        Already confirmed? <Link to="/login" className="text-primary font-medium hover:underline underline-offset-4">Log in</Link>
      </p>
    </div>
  );
}
