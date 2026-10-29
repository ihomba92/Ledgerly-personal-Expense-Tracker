import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Icon } from "@/components/shared/Icon";
import { FormAlert } from "@/components/shared/FormAlert";
import { applyFieldErrors } from "@/lib/forms";
import { api } from "@/lib/api";
import { useAuth } from "@/store/Auth";
import { AuthProviders } from "@/components/shared/AuthProviders";

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(80, "Use 80 characters or fewer."),
    email: z.string().min(1, "Enter your email.").email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Use 72 characters or fewer.")
      .regex(/[A-Z]/, "Include at least one capital letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirm: z.string().min(1, "Confirm your password."),
    terms: z.boolean().refine((v) => v, "Accept the terms to continue."),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don’t match." });

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return s;
}
const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];

export default function Signup() {
  const { register, status } = useAuth();
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", confirm: "", terms: false },
  });
  const pw = form.watch("password");
  const score = strength(pw);

  if (status === "authenticated") return <Navigate to="/app/dashboard" replace />;

  const onSubmit = async ({ fullName, email, password }) => {
    setError("");
    try {
      await register(fullName, email, password);
      setSentTo(email);
    } catch (err) {
      if (!applyFieldErrors(form, err, { full_name: "fullName" })) setError(err.message);
    }
  };

  if (sentTo) return <CheckInbox email={sentTo} />;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Create your ledger</h1>
        <p className="font-body-regular text-body-regular text-text-secondary">Free to use. Next, you’ll add your starting balance.</p>
      </div>

      <AuthProviders dividerText="or sign up with email" />

      <FormAlert>{error}</FormAlert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField control={form.control} name="fullName" render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl><Input autoComplete="name" placeholder="Janice Chandler" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" autoComplete="email" placeholder="you@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl><PasswordInput autoComplete="new-password" placeholder="At least 8 characters" {...field} /></FormControl>
              {pw && (
                <div className="flex items-center gap-3" aria-live="polite">
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={cn("h-1 rounded-full transition-colors", i < score ? (score <= 1 ? "bg-negative-vibrant" : score === 2 ? "bg-accent-sand" : "bg-positive-vibrant") : "bg-surface-container")} />
                    ))}
                  </div>
                  <span className="font-body-sm text-body-sm text-text-tertiary w-16 text-right">{STRENGTH[score]}</span>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="confirm" render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl><PasswordInput autoComplete="new-password" placeholder="Re-enter your password" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="terms" render={({ field }) => (
            <FormItem>
              <div className="flex items-start gap-2.5">
                <FormControl>
                  <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                </FormControl>
                <FormLabel className="font-body-sm text-body-sm text-text-secondary cursor-pointer">
                  I agree to the <a href="#" className="text-primary font-medium hover:underline underline-offset-4">Terms of Service</a> and{" "}
                  <a href="#" className="text-primary font-medium hover:underline underline-offset-4">Privacy Policy</a>.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )} />
          <Button type="submit" size="lg" className="mt-2 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (<><Icon name="progress_activity" className="animate-spin" /> Creating your ledger…</>) : "Create account"}
          </Button>
        </form>
      </Form>

      <p className="font-body-sm text-body-sm text-text-secondary text-center">
        Already have an account?{" "}
        <Link to="/login" className="font-body-sm-medium text-body-sm-medium text-primary hover:underline underline-offset-4">Log in</Link>
      </p>
    </div>
  );
}

/** Shown after sign-up: the account opens from the link in the email. */
function CheckInbox({ email }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    setBusy(true);
    try {
      const data = await api("/auth/resend-verification", { method: "POST", auth: false, body: { email } });
      setMessage(data.message);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <span className="w-12 h-12 rounded-xl bg-positive-soft text-positive-deep flex items-center justify-center">
        <Icon name="mark_email_unread" className="text-[24px]" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Check your inbox</h1>
        <p className="font-body-regular text-body-regular text-text-secondary">
          We’ve sent a confirmation link to <span className="font-semibold text-text-primary">{email}</span>. Open it and we’ll take you
          straight to your ledger. The link works for 24 hours.
        </p>
      </div>
      <FormAlert tone="info">Can’t find it? Check your spam or promotions folder.</FormAlert>
      {message ? (
        <FormAlert tone="success">{message}</FormAlert>
      ) : (
        <Button variant="secondary" onClick={resend} disabled={busy}>{busy ? "Sending…" : "Send the link again"}</Button>
      )}
      <p className="font-body-sm text-body-sm text-text-secondary">
        Wrong email? <Link to="/signup" reloadDocument className="text-primary font-medium hover:underline underline-offset-4">Start again</Link>
      </p>
    </div>
  );
}
