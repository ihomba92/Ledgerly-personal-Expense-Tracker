import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn, currencySymbol, formatMoney, formatWhole, monthKey, monthLabel, shiftMonth, todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/shared/Icon";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { isPaid, useAppData } from "@/store/AppData";
import { sum } from "@/lib/ledger";
import { CATEGORY_ICONS } from "@/data/categories";
import { applyFieldErrors } from "@/lib/forms";

export default function Categories() {
  const { categories, expenses, saveCategory, deleteCategory } = useAppData();
  const toast = useToast();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [editing, setEditing] = useState(null); // null | "new" | category
  const [removing, setRemoving] = useState(null);
  const current = monthKey(todayISO());

  const rows = useMemo(() => {
    const paid = expenses.filter((e) => isPaid(e) && monthKey(e.date) === month);
    return categories.map((c) => {
      const spent = sum(paid.filter((e) => e.category === c.id));
      const pct = c.budget > 0 ? (spent / c.budget) * 100 : null;
      const status = c.budget <= 0 ? null : pct > 100 ? "over" : pct >= 85 ? "near" : "ok";
      return { ...c, spent, pct, status, count: paid.filter((e) => e.category === c.id).length };
    });
  }, [categories, expenses, month]);

  const budgeted = rows.filter((r) => r.budget > 0);
  const totalBudget = sum(budgeted.map((r) => ({ amount: r.budget })));
  const totalSpent = sum(rows.map((r) => ({ amount: r.spent })));
  const over = rows.filter((r) => r.status === "over");
  const unbudgeted = sum(rows.filter((r) => r.budget <= 0).map((r) => ({ amount: r.spent })));
  const usedPct = totalBudget ? (totalSpent / totalBudget) * 100 : 0;

  const updateBudget = async (c, value) => {
    const budget = Math.max(0, Math.round(Number(value) || 0));
    if (budget !== c.budget) {
      try {
        await saveCategory({ id: c.id, budget });
        toast(budget ? `${c.label} budget set to ${formatWhole(budget)} a month` : `${c.label} no longer has a budget`);
      } catch (err) {
        toast(err.message, { tone: "info" });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-positive-deep" />
            <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">Monthly Limits</span>
          </div>
          <h1 className="font-display-hero-mobile text-display-hero-mobile md:font-display-hero md:text-display-hero text-text-primary tracking-tight">Categories &amp; budgets</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-surface-subtle p-1 rounded-lg" aria-label="Choose month">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" className="w-8 h-8 rounded flex items-center justify-center text-text-secondary hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              <Icon name="chevron_left" className="text-[18px]" />
            </button>
            <span className="min-w-[132px] text-center font-body-sm-medium text-body-sm-medium text-text-primary" aria-live="polite">{monthLabel(month)}</span>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= current} aria-label="Next month" className="w-8 h-8 rounded flex items-center justify-center text-text-secondary hover:bg-surface-card disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
          <Button className="h-auto px-4 py-2" onClick={() => setEditing("new")}><Icon name="add" /> <span>New category</span></Button>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-surface-card rounded-xl shadow-sm p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6 items-center">
        <div className="flex flex-col gap-3">
          <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase tracking-wider">Budget used in {monthLabel(month, { month: "long" })}</span>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-metric-lg-mobile text-metric-lg-mobile sm:font-metric-lg sm:text-metric-lg text-text-primary">{formatWhole(totalSpent)}</span>
            <span className="font-body-regular text-body-regular text-text-secondary">of {formatWhole(totalBudget)} budgeted</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface-container overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(usedPct, 100))} aria-label="Budget used">
            <div className={cn("h-full rounded-full transition-all duration-500", usedPct > 100 ? "bg-negative-vibrant" : usedPct >= 85 ? "bg-secondary" : "bg-primary")} style={{ width: `${Math.min(usedPct, 100)}%` }} />
          </div>
          <span className="font-body-sm text-body-sm text-text-tertiary">
            {totalBudget ? (usedPct > 100 ? `${formatWhole(totalSpent - totalBudget)} over your total budget` : `${formatWhole(totalBudget - totalSpent)} left across all budgets`) : "Set a budget on any category to track it here."}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Mini label="Over budget" value={over.length} tone={over.length ? "negative" : undefined} />
          <Mini label="With a budget" value={`${budgeted.length}/${rows.length}`} />
          <Mini label="Unbudgeted spend" value={formatWhole(unbudgeted)} />
        </div>
      </div>

      <div className="bg-surface-card rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">Category</TableHead>
              <TableHead className="px-4 w-44">Monthly budget</TableHead>
              <TableHead className="px-4 text-right">Spent</TableHead>
              <TableHead className="px-4 hidden md:table-cell w-[28%]">Progress</TableHead>
              <TableHead className="px-4 hidden sm:table-cell">Status</TableHead>
              <TableHead className="px-4 w-24"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center text-secondary shrink-0"><Icon name={c.icon} className="text-[18px]" /></div>
                    <div className="min-w-0">
                      <span className="font-body-medium text-body-medium text-text-primary block truncate">{c.label}</span>
                      <span className="font-table-cell-mono text-table-cell-mono text-text-tertiary">{c.count} expense{c.count === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4">
                  <BudgetInput key={`${c.id}-${c.budget}`} value={c.budget} onCommit={(v) => updateBudget(c, v)} label={`Monthly budget for ${c.label}`} />
                </TableCell>
                <TableCell className="px-4 text-right whitespace-nowrap">
                  <span className="font-table-cell-mono text-table-cell-mono font-medium text-text-primary block">{formatMoney(c.spent)}</span>
                  {c.budget > 0 && (
                    <span className={cn("font-body-sm text-body-sm", c.spent > c.budget ? "text-negative-deep" : "text-text-tertiary")}>
                      {c.spent > c.budget ? `${formatWhole(c.spent - c.budget)} over` : `${formatWhole(c.budget - c.spent)} left`}
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-4 hidden md:table-cell">
                  {c.budget > 0 ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-surface-container overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", c.status === "over" ? "bg-negative-vibrant" : c.status === "near" ? "bg-secondary" : "bg-primary")} style={{ width: `${Math.min(c.pct, 100)}%` }} />
                      </div>
                      <span className="font-table-cell-mono text-table-cell-mono text-text-secondary w-10 text-right">{Math.round(c.pct)}%</span>
                    </div>
                  ) : (
                    <span className="font-body-sm text-body-sm text-text-tertiary">No budget set</span>
                  )}
                </TableCell>
                <TableCell className="px-4 hidden sm:table-cell">{c.status ? <StatusBadge status={c.status} /> : <span className="font-body-sm text-body-sm text-text-tertiary">Tracking only</span>}</TableCell>
                <TableCell className="px-4">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton icon="edit" label={`Edit ${c.label}`} onClick={() => setEditing(c)} />
                    {!c.isFallback && <IconButton icon="delete" label={`Delete ${c.label}`} danger onClick={() => setRemoving(c)} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-4 py-3 bg-surface-subtle/30 font-body-sm text-body-sm text-text-tertiary flex items-center gap-1.5">
          <Icon name="info" className="text-[16px]" /> Type a new budget and press Enter. Set 0 to track a category without a limit.
        </div>
      </div>

      <CategoryDialog
        category={editing === "new" ? null : editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={async (data) => {
          await saveCategory(data); // errors are shown in the dialog
          toast(data.id ? `${data.label} updated` : `${data.label} added`);
          setEditing(null);
        }}
        taken={categories.filter((c) => editing === "new" || c.id !== editing?.id).map((c) => c.label.toLowerCase())}
      />

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="max-w-md">
          {removing && (
            <>
              <DialogHeader><DialogTitle>Delete {removing.label}?</DialogTitle></DialogHeader>
              <DialogBody className="pt-0">
                <DialogDescription className="font-body-regular text-body-regular text-text-secondary">
                  {expenses.filter((e) => e.category === removing.id).length
                    ? `${expenses.filter((e) => e.category === removing.id).length} expenses will move to “Other”. Your balance doesn’t change.`
                    : "No expenses use this category, so nothing else changes."}
                </DialogDescription>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
                <Button variant="destructive" onClick={async () => {
                  try {
                    await deleteCategory(removing.id);
                    toast(`${removing.label} deleted`, { tone: "info" });
                  } catch (err) {
                    toast(err.message, { tone: "info" });
                  }
                  setRemoving(null);
                }}>
                  <Icon name="delete" /> Delete category
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Mini({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-surface-container-low p-3 flex flex-col gap-1">
      <span className="font-label-uppercase text-label-uppercase text-text-tertiary uppercase">{label}</span>
      <span className={cn("font-metric-md text-metric-md", tone === "negative" ? "text-negative-deep" : "text-text-primary")}>{value}</span>
    </div>
  );
}

function IconButton({ icon, label, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={cn("w-8 h-8 rounded-lg inline-flex items-center justify-center text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30", danger ? "hover:text-negative-deep hover:bg-negative-soft" : "hover:text-text-primary hover:bg-surface-subtle")}>
      <Icon name={icon} className="text-[18px]" />
    </button>
  );
}

function BudgetInput({ value, onCommit, label }) {
  const [v, setV] = useState(String(value || ""));
  return (
    <div className="flex items-center rounded-lg bg-surface-subtle shadow-xs focus-within:bg-surface-card focus-within:ring-2 focus-within:ring-primary/15 overflow-hidden w-40">
      <span className="pl-3 pr-1 font-body-sm text-body-sm text-text-tertiary select-none">{currencySymbol()}</span>
      <input
        aria-label={label}
        type="number"
        min="0"
        step="100"
        inputMode="numeric"
        placeholder="0"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onCommit(v)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setV(String(value || "")); } }}
        className="w-full bg-transparent px-1.5 py-1.5 font-table-cell-mono text-table-cell-mono text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
    </div>
  );
}

function CategoryDialog({ category, open, onClose, onSave, taken }) {
  const schema = z.object({
    label: z.string().trim().min(2, "Give the category a name.").max(30, "Keep the name under 30 characters.")
      .refine((v) => !taken.includes(v.trim().toLowerCase()), "You already have a category with this name."),
    budget: z.coerce.number({ invalid_type_error: "Enter a number." }).min(0, "Budgets can’t be negative."),
    icon: z.string(),
  });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { label: "", budget: 0, icon: "more_horiz" } });

  useEffect(() => {
    if (open) form.reset(category ? { label: category.label, budget: category.budget, icon: category.icon } : { label: "", budget: 0, icon: "school" });
  }, [open, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const icon = form.watch("icon");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(async (v) => {
            try {
              await onSave({ ...(category ? { id: category.id } : {}), label: v.label.trim(), budget: Math.round(v.budget), icon: v.icon });
            } catch (err) {
              if (!applyFieldErrors(form, err)) form.setError("label", { type: "server", message: err.message });
            }
          })} noValidate>
            <DialogHeader className="bg-surface-subtle/50">
              <div className="flex items-center gap-2">
                <Icon name={category ? "edit" : "add_circle"} className="text-positive-deep text-[20px]" />
                <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
              </div>
              <DialogClose asChild>
                <button type="button" aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
                  <Icon name="close" className="text-[20px]" />
                </button>
              </DialogClose>
            </DialogHeader>
            <DialogDescription className="sr-only">Name the category, choose an icon and set an optional monthly budget.</DialogDescription>
            <DialogBody className="space-y-5 pt-5">
              <FormField control={form.control} name="label" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="e.g. School fees" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="icon" render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <div className="grid grid-cols-9 gap-1.5" role="radiogroup" aria-label="Icon">
                    {CATEGORY_ICONS.map((ic) => (
                      <button key={ic} type="button" role="radio" aria-checked={field.value === ic} aria-label={ic.replace(/_/g, " ")} onClick={() => field.onChange(ic)}
                        className={cn("aspect-square rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                          field.value === ic ? "bg-primary text-on-primary" : "bg-surface-container-low text-text-secondary hover:bg-surface-container")}>
                        <Icon name={ic} className="text-[18px]" />
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />
              <FormField control={form.control} name="budget" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly budget</FormLabel>
                  <div className="flex items-center rounded-lg border border-border-subtle bg-surface-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 overflow-hidden">
                    <span className="pl-3 pr-1 font-body-regular text-body-regular text-text-tertiary">{currencySymbol()}</span>
                    <FormControl>
                      <input type="number" min="0" step="100" inputMode="numeric" className="w-full h-10 bg-transparent px-1.5 font-body-regular text-body-regular text-text-primary focus:outline-none" {...field} />
                    </FormControl>
                  </div>
                  <p className="font-body-sm text-body-sm text-text-tertiary">Leave at 0 to track spending without a limit.</p>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
                <span className="w-9 h-9 rounded-lg bg-surface-card text-secondary flex items-center justify-center shadow-xs"><Icon name={icon} className="text-[18px]" /></span>
                <span className="font-body-medium text-body-medium text-text-primary">{form.watch("label") || "Preview"}</span>
              </div>
            </DialogBody>
            <DialogFooter className="bg-surface-subtle/50">
              <Button type="button" variant="soft" className="text-text-secondary shadow-xs" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="px-5"><Icon name="check" /> {category ? "Save changes" : "Add category"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
