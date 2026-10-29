import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn, currencySymbol, formatMoney, todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/shared/Icon";
import { useAppData } from "@/store/AppData";
import { PAYMENT_METHODS } from "@/data/wallet";
import { applyFieldErrors } from "@/lib/forms";
import { FormAlert } from "@/components/shared/FormAlert";

const MAX_FILE = 15 * 1024 * 1024;

const schema = z.object({
  subject: z.string().trim().min(2, "Say what this expense was for."),
  merchant: z.string().trim().min(1, "Enter where you paid."),
  date: z.string().min(1, "Pick the date."),
  amount: z.coerce.number({ invalid_type_error: "Enter the amount." }).positive("Enter an amount greater than 0."),
  category: z.string().min(1, "Choose a category."),
  method: z.string().min(1, "Choose how you paid."),
  description: z.string().max(500, "Keep the note under 500 characters.").optional(),
});

// Stitch drawer fields sit on a sand fill with no border, lifting to white on focus.
const fieldCls = "border-transparent bg-surface-subtle shadow-xs focus-visible:bg-surface-card focus-visible:border-transparent";

const emptyValues = () => ({ subject: "", merchant: "", date: todayISO(), amount: "", category: "", method: "mpesa", description: "" });

/** The "New expense" side panel from the Stitch design, also used to edit an expense. */
export function ExpenseDrawer() {
  const { drawer, closeExpenseDrawer, expenses, saveExpense, availableFor, openTopUp, categories, uploadReceipt, removeReceipt, openReceipt } = useAppData();
  const toast = useToast();
  const editing = drawer.expenseId ? expenses.find((e) => e.id === drawer.expenseId) : null;
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [removedExisting, setRemovedExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [shortfall, setShortfall] = useState(null);
  const fileRef = useRef(null);
  const mode = useRef("paid");

  const form = useForm({ resolver: zodResolver(schema), defaultValues: emptyValues() });

  useEffect(() => {
    if (!drawer.open) return;
    setFileError("");
    setShortfall(null);
    form.reset(
      editing
        ? { subject: editing.subject, merchant: editing.merchant, date: editing.date, amount: editing.amount, category: editing.category, method: editing.method ?? "mpesa", description: editing.description ?? "" }
        : emptyValues()
    );
    setFile(editing?.receipt ? { name: editing.receipt, existing: true, size: editing.receiptInfo?.size_bytes } : null);
    setRemovedExisting(false);
    setSubmitError("");
  }, [drawer.open, drawer.expenseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = availableFor(editing?.id);
  const typed = Number(form.watch("amount")) || 0;
  useEffect(() => setShortfall(null), [typed]);

  const onSubmit = async (values) => {
    const status = mode.current;
    setSubmitError("");
    // Paid expenses come out of the balance, so they can't exceed it. Drafts can. (The server checks this too.)
    if (status === "paid" && values.amount > available) {
      setShortfall(values.amount - available);
      return;
    }
    setSaving(true);
    try {
      const saved = await saveExpense({ ...(editing ? { id: editing.id } : {}), ...values, status });

      // The receipt file is uploaded separately, once the expense exists.
      let receiptProblem = "";
      try {
        if (file instanceof File) await uploadReceipt(saved.id, file);
        else if (removedExisting && editing?.receipt) await removeReceipt(saved.id);
      } catch (err) {
        receiptProblem = ` The receipt wasn’t saved: ${err.message}`;
      }

      toast(
        (status === "paid"
          ? `${editing ? "Expense updated" : "Expense recorded"}. Balance now ${formatMoney(available - values.amount)}.`
          : "Saved as a draft. It won’t touch your balance until you pay it.") + receiptProblem,
        { tone: status === "paid" && !receiptProblem ? "success" : "info" }
      );
      closeExpenseDrawer();
    } catch (err) {
      if (err.reason === "insufficient_balance") setShortfall(Number(err.details.shortfall));
      else if (!applyFieldErrors(form, err, { spent_on: "date", category_id: "category", note: "description" })) setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitAs = (m) => {
    mode.current = m;
    form.handleSubmit(onSubmit)();
  };

  const pickFile = (f) => {
    if (!f) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) return setFileError("Upload a PDF, PNG or JPG file.");
    if (f.size > MAX_FILE) return setFileError("That file is over 15MB. Upload a smaller copy.");
    setFileError("");
    setFile(f);
  };

  return (
    <Sheet open={drawer.open} onOpenChange={(open) => !open && closeExpenseDrawer()}>
      <SheetContent>
        <div className="flex items-center justify-between px-6 py-5 bg-surface-subtle/50">
          <div className="flex items-center gap-2">
            <Icon name={editing ? "edit_note" : "add_circle"} className="text-positive-deep text-[20px]" />
            <SheetTitle>{editing ? "Edit expense" : "New expense"}</SheetTitle>
          </div>
          <SheetDescription>Record what you spent. Paid expenses are taken from your balance.</SheetDescription>
          <button type="button" onClick={closeExpenseDrawer} aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <Form {...form}>
          <form onSubmit={(e) => { e.preventDefault(); submitAs("paid"); }} noValidate className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
            <FormAlert>{submitError}</FormAlert>
            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem>
                <FormLabel>What was it for? <span className="text-negative-vibrant">*</span></FormLabel>
                <FormControl><Input className={fieldCls} placeholder="e.g. Weekly groceries" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="merchant" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid to <span className="text-negative-vibrant">*</span></FormLabel>
                  <FormControl><Input className={fieldCls} placeholder="e.g. Naivas" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date <span className="text-negative-vibrant">*</span></FormLabel>
                  <FormControl><Input type="date" className={fieldCls} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="amount" render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Amount <span className="text-negative-vibrant">*</span></FormLabel>
                <div className={cn("flex rounded-lg overflow-hidden shadow-xs bg-surface-subtle focus-within:ring-2 focus-within:ring-primary/15", fieldState.error && "ring-1 ring-negative-vibrant")}>
                  <span className="w-[72px] shrink-0 flex items-center justify-center bg-surface-container font-title-card text-title-card text-text-secondary select-none">{currencySymbol()}</span>
                  <FormControl>
                    <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                      className="flex-1 min-w-0 px-3.5 py-2 bg-surface-subtle text-text-primary font-metric-md text-metric-md placeholder:text-text-tertiary focus:outline-none focus:bg-surface-card"
                      {...field} />
                  </FormControl>
                </div>
                <FormMessage />
                <BalanceLine available={available} amount={typed} shortfall={shortfall} onTopUp={() => { closeExpenseDrawer(); openTopUp(); }} />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category <span className="text-negative-vibrant">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className={fieldCls}><SelectValue placeholder="Choose" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid with <span className="text-negative-vibrant">*</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Note</FormLabel>
                <FormControl><Textarea rows={2} className={cn(fieldCls, "min-h-0 resize-none")} placeholder="Anything you want to remember about it" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex flex-col gap-1.5">
              <Label>Receipt</Label>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              {file ? (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-positive-soft">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-surface-card text-positive-deep flex items-center justify-center shadow-xs shrink-0"><Icon name="description" className="text-[18px]" /></span>
                    <div className="min-w-0">
                      <p className="font-body-sm-medium text-body-sm-medium text-text-primary truncate">{file.name}</p>
                      {file.size ? <p className="font-table-cell-mono text-table-cell-mono text-text-tertiary">{(file.size / 1024).toFixed(0)} KB</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {file.existing && editing && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => openReceipt(editing.id).catch((e) => setFileError(e.message))}>View</Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={() => { if (file.existing) setRemovedExisting(true); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>Remove</Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
                  className="p-6 rounded-xl bg-surface-subtle/50 hover:bg-surface-subtle text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <span className="w-10 h-10 rounded-full bg-surface-card flex items-center justify-center text-text-secondary shadow-xs"><Icon name="upload_file" className="text-[20px]" /></span>
                  <span>
                    <span className="block font-body-sm-medium text-body-sm-medium text-text-primary">+ Upload a receipt</span>
                    <span className="block font-label-uppercase text-label-uppercase text-text-tertiary mt-0.5">PDF, PNG, JPG up to 15MB</span>
                  </span>
                </button>
              )}
              {fileError && <p className="font-body-sm text-body-sm text-negative-deep">{fileError}</p>}
            </div>
          </form>
        </Form>

        <div className="px-6 py-4 bg-surface-subtle/50 flex items-center justify-end gap-3">
          <Button type="button" variant="soft" className="text-text-secondary shadow-xs" onClick={() => submitAs("draft")} disabled={saving}>Save draft</Button>
          <Button type="button" className="px-5 [&_.material-symbols-outlined]:text-[16px]" onClick={() => submitAs("paid")} disabled={saving}>
            <Icon name={saving ? "progress_activity" : "check"} className={saving ? "animate-spin" : undefined} /> {saving ? "Saving…" : "Save as paid"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BalanceLine({ available, amount, shortfall, onTopUp }) {
  const after = available - amount;
  if (shortfall) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-negative-soft" role="alert">
        <span className="font-body-sm text-body-sm text-negative-deep">
          This is {formatMoney(shortfall)} more than your balance of {formatMoney(available)}. Top up, or save it as a draft.
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={onTopUp}><Icon name="add_card" /> Top up</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between font-body-sm text-body-sm text-text-tertiary pt-0.5">
      <span>Available {formatMoney(available)}</span>
      {amount > 0 && (
        <span className={cn("font-body-sm-medium text-body-sm-medium", after < 0 ? "text-negative-deep" : "text-positive-deep")}>
          Balance after: {formatMoney(after)}
        </span>
      )}
    </div>
  );
}
