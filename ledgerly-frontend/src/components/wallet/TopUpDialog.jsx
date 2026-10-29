import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn, currencySymbol, formatMoney, formatWhole, todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/shared/Icon";
import { useAppData } from "@/store/AppData";
import { FUNDING_SOURCES } from "@/data/wallet";
import { applyFieldErrors } from "@/lib/forms";
import { FormAlert } from "@/components/shared/FormAlert";
import { useState } from "react";

const schema = z.object({
  amount: z.coerce.number({ invalid_type_error: "Enter an amount." }).positive("Enter an amount greater than 0.").max(10_000_000, "That amount is too large."),
  source: z.string().min(1, "Choose where the money came from."),
  date: z.string().min(1, "Pick a date."),
  note: z.string().max(120, "Keep the note under 120 characters.").optional(),
});

const QUICK = [500, 1000, 5000, 10000];
const fieldCls = "border-transparent bg-surface-subtle shadow-xs focus-visible:bg-surface-card focus-visible:border-transparent";

/** "Add balance" the first time, "Top up" after that. Opened from anywhere via openTopUp(). */
export function TopUpDialog() {
  const { topUpDialog, closeTopUp, addTopUp, topUps, balance } = useAppData();
  const toast = useToast();
  const initial = topUps.length === 0;
  const symbol = currencySymbol();
  const [error, setError] = useState("");

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", source: "bank", date: todayISO(), note: "" },
  });

  useEffect(() => {
    if (topUpDialog.open) {
      form.reset({ amount: "", source: initial ? "bank" : "mpesa", date: todayISO(), note: "" });
      setError("");
    }
  }, [topUpDialog.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = Number(form.watch("amount")) || 0;

  const onSubmit = async (v) => {
    setError("");
    try {
      await addTopUp({ ...v, note: v.note || (initial ? "Starting balance" : "") });
      toast(initial ? `Starting balance of ${formatMoney(v.amount)} added` : `${formatMoney(v.amount)} added. New balance ${formatMoney(balance + v.amount)}`);
      closeTopUp();
    } catch (err) {
      if (!applyFieldErrors(form, err, { received_on: "date" })) setError(err.message);
    }
  };

  return (
    <Dialog open={topUpDialog.open} onOpenChange={(o) => !o && closeTopUp()}>
      <DialogContent className="max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <DialogHeader className="bg-surface-subtle/50">
              <div className="flex items-center gap-2">
                <Icon name={initial ? "account_balance_wallet" : "add_card"} className="text-positive-deep text-[20px]" />
                <DialogTitle>{initial ? "Add your balance" : "Top up balance"}</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <Icon name="close" className="text-[20px]" />
                </button>
              </DialogClose>
            </DialogHeader>
            <DialogDescription className="px-6 pt-4">
              {initial ? "Enter the money you have available right now. Every expense you record is taken from this balance." : "Add money to your balance. Expenses you record are taken from the new total."}
            </DialogDescription>

            <DialogBody className="space-y-5 pt-4">
              <FormAlert>{error}</FormAlert>
              <FormField control={form.control} name="amount" render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Amount <span className="text-negative-vibrant">*</span></FormLabel>
                  <div className={cn("flex items-center rounded-lg bg-surface-subtle shadow-xs focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-primary/15 overflow-hidden", fieldState.error && "ring-1 ring-negative-vibrant")}>
                    <span className="pl-4 pr-1 font-metric-md text-metric-md text-text-tertiary select-none">{symbol}</span>
                    <FormControl>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        autoFocus
                        className="flex-1 min-w-0 bg-transparent px-2 py-3 font-metric-lg-mobile text-metric-lg-mobile text-text-primary placeholder:text-text-tertiary focus:outline-none"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {QUICK.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => form.setValue("amount", (Number(form.getValues("amount")) || 0) + q, { shouldValidate: true })}
                        className="px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container text-text-secondary font-body-sm-medium text-body-sm-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        +{formatWhole(q)}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="source" render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FUNDING_SOURCES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" className={fieldCls} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="note" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl><Input className={fieldCls} placeholder={initial ? "e.g. Savings account" : "e.g. Salary, M-Pesa from Mum"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex items-center justify-between p-3.5 rounded-lg bg-positive-soft">
                <span className="font-body-medium text-body-medium text-text-secondary">{initial ? "Starting balance" : "New balance"}</span>
                <span className="font-metric-md text-metric-md text-positive-deep">{formatMoney(balance + amount)}</span>
              </div>
            </DialogBody>

            <DialogFooter className="bg-surface-subtle/50">
              <Button type="button" variant="soft" className="text-text-secondary shadow-xs" onClick={closeTopUp}>Cancel</Button>
              <Button type="submit" className="px-5 [&_.material-symbols-outlined]:text-[16px]" disabled={form.formState.isSubmitting}>
                <Icon name={form.formState.isSubmitting ? "progress_activity" : "check"} className={form.formState.isSubmitting ? "animate-spin" : undefined} />
                {form.formState.isSubmitting ? "Saving…" : initial ? "Set balance" : "Add to balance"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
