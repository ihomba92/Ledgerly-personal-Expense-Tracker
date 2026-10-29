import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormAlert } from "@/components/shared/FormAlert";
import { Icon } from "@/components/shared/Icon";
import { api } from "@/lib/api";

const schema = z.object({ email: z.string().min(1, "Enter your email.").email("Enter a valid email address.") });

export default function ForgotPassword() {
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const onSubmit = async ({ email }) => {
    setError("");
    try {
      const data = await api("/auth/forgot-password", { method: "POST", auth: false, body: { email } });
      setSent(data.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="font-display-hero-mobile text-display-hero-mobile text-text-primary tracking-tight">Forgot your password?</h1>
        <p className="font-body-regular text-body-regular text-text-secondary">Enter your email and we’ll send a link to choose a new one.</p>
      </div>
      {sent ? (
        <FormAlert tone="success">{sent} The link works once, for 30 minutes.</FormAlert>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <FormAlert>{error}</FormAlert>
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" autoComplete="email" placeholder="you@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (<><Icon name="progress_activity" className="animate-spin" /> Sending…</>) : "Send reset link"}
            </Button>
          </form>
        </Form>
      )}
      <p className="font-body-sm text-body-sm text-text-secondary text-center">
        Remembered it? <Link to="/login" className="font-body-sm-medium text-body-sm-medium text-primary hover:underline underline-offset-4">Back to log in</Link>
      </p>
    </div>
  );
}
