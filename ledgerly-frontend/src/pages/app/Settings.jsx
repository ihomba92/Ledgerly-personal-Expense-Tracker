import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/shared/Icon";
import { PageHeader } from "@/components/shared/PageHeader";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { FormAlert } from "@/components/shared/FormAlert";
import { applyFieldErrors } from "@/lib/forms";
import { useAuth } from "@/store/Auth";
import { useAppData } from "@/store/AppData";
import { UserAvatar } from "@/components/shared/UserAvatar";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(80, "Use 80 characters or fewer."),
  ledgerName: z.string().trim().min(2, "Give your ledger a name.").max(60, "Use 60 characters or fewer."),
  currency: z.string(),
  timezone: z.string(),
  notifyLowBalance: z.boolean(),
  notifyBudget: z.boolean(),
  weeklyDigest: z.boolean(),
});

// Settings form field -> API field
const API_NAMES = { fullName: "full_name", ledgerName: "ledger_name", currency: "currency", timezone: "timezone",
  notifyLowBalance: "notify_low_balance", notifyBudget: "notify_budget", weeklyDigest: "weekly_digest" };
const FORM_NAMES = Object.fromEntries(Object.entries(API_NAMES).map(([f, a]) => [a, f]));

const NOTIFICATIONS = [
  { name: "notifyLowBalance", label: "Low balance alerts", hint: "A notification when your balance drops below 10% of what you’ve added." },
  { name: "notifyBudget", label: "Budget warnings", hint: "A notification when a category reaches 85% of its monthly budget, and when it goes over." },
  { name: "weeklyDigest", label: "Weekly spending summary", hint: "A Monday summary of last week’s spending (coming soon)." },
];

const fromUser = (u) => ({
  fullName: u.full_name, ledgerName: u.ledger_name, currency: u.currency, timezone: u.timezone,
  notifyLowBalance: u.notify_low_balance, notifyBudget: u.notify_budget, weeklyDigest: u.weekly_digest,
});

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [error, setError] = useState("");
  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: fromUser(user) });

  useEffect(() => form.reset(fromUser(user)), [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values) => {
    setError("");
    const dirty = Object.keys(form.formState.dirtyFields);
    const changes = Object.fromEntries(dirty.map((f) => [API_NAMES[f], values[f]]));
    try {
      await updateProfile(changes);
      toast("Settings saved");
    } catch (err) {
      if (!applyFieldErrors(form, err, FORM_NAMES)) setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <PageHeader eyebrow="Account" meta={user.email} title="Settings" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6 max-w-4xl">
          <Section title="Profile" description="Your name, and the name shown on your ledger.">
            <PhotoPicker />
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField form={form} name="fullName" label="Full name" />
              <TextField form={form} name="ledgerName" label="Ledger name" />
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <span className="font-body-sm-medium text-body-sm-medium text-text-primary">Email</span>
                <Input value={user.email} readOnly disabled />
                <span className="font-body-sm text-body-sm text-text-tertiary">Your sign-in email can’t be changed here yet.</span>
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <span className="font-body-sm-medium text-body-sm-medium text-text-primary mr-1">Sign-in methods:</span>
                {user.has_password && <MethodPill icon="password" label="Email & password" />}
                {user.providers.map((p) => <MethodPill key={p} icon="verified_user" label={p === "google" ? "Google" : "Microsoft"} />)}
              </div>
            </div>
          </Section>

          <Section title="Preferences" description="How amounts and dates are shown.">
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField form={form} name="currency" label="Currency" options={[["KES", "Ksh (Kenyan shilling)"], ["UGX", "USh (Ugandan shilling)"], ["TZS", "TSh (Tanzanian shilling)"], ["USD", "$ (US dollar)"], ["EUR", "€ (Euro)"]]} />
              <SelectField form={form} name="timezone" label="Time zone" options={[["Africa/Nairobi", "Nairobi (EAT)"], ["Africa/Kampala", "Kampala (EAT)"], ["Africa/Lagos", "Lagos (WAT)"], ["Europe/London", "London (GMT)"], ["America/New_York", "New York (ET)"]]} />
            </div>
            <p className="font-body-sm text-body-sm text-text-tertiary">Changing the currency changes the symbol shown. It doesn’t convert amounts you’ve already recorded.</p>
          </Section>

          <Section title="Notifications" description="Choose which alerts appear under the bell. Security notices are always shown.">
            <div className="flex flex-col gap-1">
              {NOTIFICATIONS.map((n) => (
                <FormField key={n.name} control={form.control} name={n.name} render={({ field }) => (
                  <FormItem className="flex-row items-start gap-3 p-3 rounded-lg hover:bg-surface-container-low transition-colors">
                    <FormControl>
                      <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <div className="flex flex-col gap-0.5">
                      <FormLabel className="cursor-pointer">{n.label}</FormLabel>
                      <FormDescription>{n.hint}</FormDescription>
                    </div>
                  </FormItem>
                )} />
              ))}
            </div>
          </Section>

          <FormAlert>{error}</FormAlert>
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" disabled={!form.formState.isDirty} onClick={() => form.reset()}>Discard</Button>
            <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex flex-col gap-6 max-w-4xl">
        <PasswordSection />
        <DangerSection />
      </div>
    </div>
  );
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX = 5 * 1024 * 1024;

/** Profile picture: upload, change or remove. The server crops it square, resizes it and strips hidden data. */
function PhotoPicker() {
  const { user, uploadAvatar, removeAvatar } = useAuth();
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError("");
    if (!PHOTO_TYPES.includes(file.type)) return setError("Choose a JPG, PNG or WebP image.");
    if (file.size > PHOTO_MAX) return setError("That image is over 5 MB. Choose a smaller one.");
    setBusy(true);
    try {
      await uploadAvatar(file);
      toast("Profile photo updated");
    } catch (err) {
      setError(err.fields?.file ?? err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await removeAvatar();
      toast("Profile photo removed", { tone: "info" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 mb-2">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative">
          <UserAvatar size="lg" />
          {busy && (
            <span className="absolute inset-0 rounded-full bg-text-primary/40 flex items-center justify-center">
              <Icon name="progress_activity" className="text-[22px] text-surface-card animate-spin" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="font-title-card text-title-card text-text-primary">{user.name}</span>
            <span className="font-body-sm text-body-sm text-text-tertiary">Member since {new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a profile photo" />
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Icon name="photo_camera" /> {user.has_avatar ? "Change photo" : "Upload photo"}
            </Button>
            {user.has_avatar && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={remove}>Remove</Button>
            )}
          </div>
        </div>
      </div>
      <p className="font-body-sm text-body-sm text-text-tertiary">JPG, PNG or WebP up to 5 MB. It’s cropped to a square, and location data is removed.</p>
      <FormAlert>{error}</FormAlert>
    </div>
  );
}

function MethodPill({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-positive-soft text-positive-deep font-body-sm-medium text-body-sm-medium">
      <Icon name={icon} className="text-[14px]" /> {label}
    </span>
  );
}

function Section({ title, description, children }) {
  return (
    <Card className="p-5 sm:p-6 grid md:grid-cols-[220px_minmax(0,1fr)] gap-5 md:gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-title-card text-title-card text-text-primary">{title}</h2>
        <p className="font-body-sm text-body-sm text-text-tertiary">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

function TextField({ form, name, label, type = "text", className }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className={className}>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input type={type} {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function SelectField({ form, name, label, options }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select onValueChange={field.onChange} value={field.value}>
          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
          <SelectContent>
            {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

const passwordSchema = z
  .object({
    current: z.string(),
    next: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer.")
      .regex(/[A-Z]/, "Include at least one capital letter.").regex(/[0-9]/, "Include at least one number."),
    confirm: z.string().min(1, "Confirm the new password."),
  })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "Passwords don’t match." });

function PasswordSection() {
  const { user, changePassword } = useAuth();
  const { refreshNotifications } = useAppData();
  const toast = useToast();
  const hasPassword = user.has_password;
  const form = useForm({ resolver: zodResolver(passwordSchema), defaultValues: { current: "", next: "", confirm: "" } });

  const onSubmit = async ({ current, next }) => {
    if (hasPassword && !current) {
      form.setError("current", { type: "manual", message: "Enter your current password." });
      return;
    }
    try {
      const data = await changePassword(hasPassword ? current : null, next);
      form.reset();
      refreshNotifications(); // shows the "Password changed" security notice under the bell
      toast(hasPassword ? "Password changed. Other devices have been logged out." : data.message);
    } catch (err) {
      if (!applyFieldErrors(form, err, { current_password: "current", new_password: "next" })) form.setError("current", { type: "server", message: err.message });
    }
  };

  return (
    <Section
      title="Password"
      description={hasPassword ? "Changing it logs you out on every other device." : "Add a password to also log in with your email, not only with Google or Microsoft."}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {hasPassword && (
            <FormField control={form.control} name="current" render={({ field }) => (
              <FormItem>
                <FormLabel>Current password</FormLabel>
                <FormControl><PasswordInput autoComplete="current-password" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="next" render={({ field }) => (
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
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : hasPassword ? "Change password" : "Set password"}
            </Button>
          </div>
        </form>
      </Form>
    </Section>
  );
}

function DangerSection() {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    setBusy(true);
    setError("");
    try {
      await deleteAccount(user.has_password ? { password } : { confirm_email: password });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Section title="Delete account" description="Permanently removes your ledger.">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-negative-soft/60">
        <p className="font-body-sm text-body-sm text-text-secondary">
          Deletes your account, categories, income, expenses and receipts. This can’t be undone.
        </p>
        <Button type="button" variant="destructive" size="sm" onClick={() => { setOpen(true); setPassword(""); setError(""); }}>
          <Icon name="delete_forever" /> Delete account
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete your account?</DialogTitle></DialogHeader>
          <DialogBody className="pt-0">
            <DialogDescription className="font-body-regular text-body-regular text-text-secondary">
              Everything in your ledger will be deleted for good.{" "}
              {user.has_password ? "Enter your password to confirm." : `Type your email (${user.email}) to confirm.`}
            </DialogDescription>
            {user.has_password ? (
              <PasswordInput autoComplete="current-password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
            ) : (
              <Input type="email" placeholder={user.email} value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
            <FormAlert>{error}</FormAlert>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!password || busy}>
              {busy ? "Deleting…" : "Delete everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
