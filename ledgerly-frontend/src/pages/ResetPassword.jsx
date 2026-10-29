import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { FormAlert } from "@/components/shared/FormAlert";
import { Icon } from "@/components/shared/Icon";
import { api } from "@/lib/api";
import { clearLinkFromAddressBar, readLinkValue } from "@/lib/linkToken";
import { applyFieldErrors } from "@/lib/forms";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer.")
      .regex(/[A-Z]/, "Include at least one capital letter.").regex(/[0-9]/, "Include at least one number."),
    confirm: z.string().min(1, "Confirm your password."),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don’t match." });

/** Opened from the link in the "Reset your Ledgerly password" email: /reset-password#token=... */
export default function ResetPassword() {
  const [token] = useState(() => readLinkValue("token"));
  useEffect(() => clearLinkFromAddressBar(), []);
  const [done, setDone] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is incomplete. Request a new one.");
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = async ({ password }) => {
    setError("");
    try {
      const data = await api("/auth/reset-password", { method: "POST", auth: false, body: { token, password } });
      setDone(data.message);
    } catch (err) {
      if (!applyFieldErrors(form, err)) setError(err.message);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <span className="w-12 h-12 rounded-xl bg-positive-soft text-positive-deep flex items-center justify-center"><Icon name="lock_reset" className="text-[24px]" /></span>
        <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Password changed</h1>
        <p className="font-body-regular text-body-regular text-text-secondary">{done} You’ve been logged out on every other device.</p>
        <Button asChild size="lg"><Link to="/login">Log in</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Choose a new password</h1>
        <p className="font-body-regular text-body-regular text-text-secondary">At least 8 characters, with a capital letter and a number.</p>
      </div>
      <FormAlert action={error && token && <Link to="/forgot-password" className="self-start font-body-sm-medium text-body-sm-medium text-primary underline underline-offset-4">Request a new link</Link>}>
        {error}
      </FormAlert>
      {token && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl><PasswordInput autoComplete="new-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="confirm" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl><PasswordInput autoComplete="new-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (<><Icon name="progress_activity" className="animate-spin" /> Saving…</>) : "Save new password"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
