import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@/components/shared/Icon";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormAlert } from "@/components/shared/FormAlert";
import { api } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";

const TOPICS = [
  { icon: "receipt_long", title: "Recording expenses", body: "Drafts, receipts and editing entries." },
  { icon: "account_balance_wallet", title: "Balance & top-ups", body: "How your balance is worked out." },
  { icon: "donut_small", title: "Categories & budgets", body: "Monthly limits and warnings." },
  { icon: "lock", title: "Account & privacy", body: "Sign-in, email and your data." },
];

const FAQ = [
  ["How is my balance calculated?", "Your balance is everything you’ve added as income or top-ups, minus every expense saved as paid. Drafts aren’t included until you pay them."],
  ["What’s the difference between a draft and a paid expense?", "A paid expense is taken from your balance straight away. A draft is a note of something you plan to pay, such as a bill that’s due. It waits until you mark it as paid."],
  ["I recorded an expense by mistake. What happens to my balance?", "Delete it or edit the amount, and your balance corrects itself. You can undo a deletion from the message that appears."],
  ["Why can’t I save an expense as paid?", "A paid expense can’t be larger than your available balance. Top up first, or save it as a draft until the money comes in."],
  ["Can I track M-Pesa, cash and card spending separately?", "Yes. Choose how you paid on each expense, then filter the Expenses page by payment method."],
];

const schema = z.object({
  topic: z.string().min(1, "Choose a topic."),
  subject: z.string().trim().min(4, "Add a short subject."),
  message: z.string().trim().min(20, "Describe the issue in at least 20 characters."),
});

export default function Support() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { topic: "", subject: "", message: "" } });

  const onSubmit = async (values) => {
    setError("");
    try {
      await api("/support-requests", { method: "POST", body: values });
      setSent(true);
      form.reset();
    } catch (err) {
      if (!applyFieldErrors(form, err)) setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <PageHeader eyebrow="Help centre" meta="Replies within one working day" title="Support" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {TOPICS.map((t) => (
          <a key={t.title} href="#" className="bg-surface-card rounded-xl shadow-sm p-5 flex flex-col gap-3 hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <span className="w-9 h-9 rounded-lg bg-positive-soft text-positive-deep flex items-center justify-center"><Icon name={t.icon} className="text-[18px]" /></span>
            <span className="font-title-card text-title-card text-text-primary">{t.title}</span>
            <span className="font-body-sm text-body-sm text-text-secondary">{t.body}</span>
          </a>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <Card className="xl:col-span-6 p-5 sm:p-6 flex flex-col gap-2">
          <h2 className="font-title-card text-title-card text-text-primary mb-2">Common questions</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-lg bg-surface-container-low px-4 py-3 open:bg-surface-subtle">
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-body-medium text-body-medium text-text-primary [&::-webkit-details-marker]:hidden">
                {q}
                <Icon name="expand_more" className="text-[18px] text-text-tertiary transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 font-body-regular text-body-regular text-text-secondary">{a}</p>
            </details>
          ))}
        </Card>

        <Card className="xl:col-span-6 p-5 sm:p-6">
          <h2 className="font-title-card text-title-card text-text-primary">Contact the team</h2>
          <p className="font-body-sm text-body-sm text-text-tertiary mb-5">We’ll reply to the email on your account.</p>
          {sent ? (
            <div className="flex flex-col items-start gap-3 p-4 rounded-lg bg-positive-soft" role="status">
              <span className="flex items-center gap-2 font-title-card text-title-card text-positive-deep"><Icon name="mark_email_read" className="text-[20px]" /> Message sent</span>
              <p className="font-body-sm text-body-sm text-text-secondary">Thanks for getting in touch. Expect a reply within one working day.</p>
              <Button variant="secondary" size="sm" onClick={() => setSent(false)}>Send another message</Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <FormAlert>{error}</FormAlert>
                <FormField control={form.control} name="topic" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="What do you need help with?" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {TOPICS.map((t) => <SelectItem key={t.title} value={t.title}>{t.title}</SelectItem>)}
                        <SelectItem value="Other">Something else</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl><Input placeholder="e.g. My balance looks wrong" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl><Textarea placeholder="Tell us what happened and what you expected." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end">
                  <Button type="submit" disabled={form.formState.isSubmitting}><Icon name="send" /> {form.formState.isSubmitting ? "Sending…" : "Send message"}</Button>
                </div>
              </form>
            </Form>
          )}
        </Card>
      </div>
    </div>
  );
}
