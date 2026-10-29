import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { FormAlert } from "@/components/shared/FormAlert";
import { Icon } from "@/components/shared/Icon";
import { api } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { useAuth } from "@/store/Auth";
import { AuthProviders, OAUTH_ERRORS } from "@/components/shared/AuthProviders";
import { clearLinkFromAddressBar, readLinkValue } from "@/lib/linkToken";

const schema = z.object({
  email: z.string().min(1, "Enter your email.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().default(true),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status } = useAuth();
  // A failed Google/Microsoft sign-in comes back as /login#oauth_error=<reason>
  const [error, setError] = useState(() => {
    const reason = readLinkValue("oauth_error");
    return reason ? { message: OAUTH_ERRORS[reason] ?? OAUTH_ERRORS.failed, unverified: false } : null;
  }); // { message, unverified }
  useEffect(() => clearLinkFromAddressBar(), []);
  const [resent, setResent] = useState("");
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "", remember: true } });
  const goTo = location.state?.from ?? "/app/dashboard";

  if (status === "authenticated") return <Navigate to={goTo} replace />;

  const onSubmit = async ({ email, password, remember }) => {
    setError(null);
    setResent("");
    try {
      await login(email, password, remember);
      navigate(goTo, { replace: true });
    } catch (err) {
      if (!applyFieldErrors(form, err)) setError({ message: err.message, unverified: err.reason === "email_not_verified" });
    }
  };

  const resend = async () => {
    try {
      const data = await api("/auth/resend-verification", { method: "POST", auth: false, body: { email: form.getValues("email") } });
      setResent(data.message);
    } catch (err) {
      setResent(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Welcome back</h1>
        <p className="font-body-regular text-body-regular text-text-secondary">Log in to see your balance and expenses.</p>
      </div>

      {error && (
        <FormAlert
          tone={error.unverified ? "info" : "error"}
          action={error.unverified && (resent
            ? <span className="font-body-sm-medium text-body-sm-medium text-positive-deep">{resent}</span>
            : <button type="button" onClick={resend} className="self-start font-body-sm-medium text-body-sm-medium text-primary underline underline-offset-4">Send a new confirmation link</button>)}
        >
          {error.message}
        </FormAlert>
      )}

      <AuthProviders />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" autoComplete="email" placeholder="you@example.com" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link to="/forgot-password" className="font-body-sm-medium text-body-sm-medium text-primary hover:underline underline-offset-4">Forgot password?</Link>
              </div>
              <FormControl><PasswordInput autoComplete="current-password" placeholder="Enter your password" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="remember" render={({ field }) => (
            <div className="flex items-center gap-2.5">
              <Checkbox id="remember" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              <Label htmlFor="remember" className="font-body-sm text-body-sm text-text-secondary cursor-pointer">Keep me signed in for 30 days</Label>
            </div>
          )} />
          <Button type="submit" size="lg" className="mt-2 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (<><Icon name="progress_activity" className="animate-spin" /> Logging in…</>) : "Log in"}
          </Button>
        </form>
      </Form>

      <p className="font-body-sm text-body-sm text-text-secondary text-center">
        New to Ledgerly?{" "}
        <Link to="/signup" className="font-body-sm-medium text-body-sm-medium text-primary hover:underline underline-offset-4">Create an account</Link>
      </p>
    </div>
  );
}
