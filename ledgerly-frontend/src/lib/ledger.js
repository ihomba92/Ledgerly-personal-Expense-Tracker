// Pure helpers for summarising the ledger. Shared by the dashboard, expenses, income and categories pages.
import { isPaid } from "@/store/AppData";
import { monthKey, shiftMonth, todayISO } from "@/lib/utils";

export const thisMonth = () => monthKey(todayISO());

export const paidIn = (expenses, key) => expenses.filter((e) => isPaid(e) && monthKey(e.date) === key);
export const sum = (list) => list.reduce((s, x) => s + x.amount, 0);

/** Spend per category for a list of paid expenses, largest first. */
export function byCategory(list, categoryById) {
  const map = new Map();
  list.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
  return [...map.entries()].map(([id, amount]) => ({ ...categoryById(id), id, amount })).sort((a, b) => b.amount - a.amount);
}

/** Totals for the last `count` months ending with `endKey`. */
export function monthlyTotals(items, endKey, count) {
  return Array.from({ length: count }, (_, i) => {
    const key = shiftMonth(endKey, i - count + 1);
    return { key, amount: sum(items.filter((x) => monthKey(x.date) === key)) };
  });
}
