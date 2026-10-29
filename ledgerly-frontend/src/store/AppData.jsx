import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, apiAll } from "@/lib/api";
import { categoryFromApi, categoryToApi, expenseFromApi, expenseToApi, topUpFromApi, topUpToApi } from "@/lib/mappers";
import { useAuth } from "@/store/Auth";

/**
 * The logged-in user's ledger, loaded from the Ledgerly API.
 *
 * Balance rule (also enforced by the server): balance = everything topped up − every expense marked as paid.
 * Drafts don't touch the balance until they're paid.
 *
 * Every action calls the API first and only updates the screen when the server agrees, so the app never
 * shows something the database refused. Actions throw an ApiError on failure; pages show its message.
 */
const AppDataContext = createContext(null);

export const isPaid = (e) => e.status === "paid";

export function AppDataProvider({ children }) {
  const { status: authStatus, user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [topUps, setTopUps] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadState, setLoadState] = useState("idle"); // idle | loading | ready | error
  const [loadError, setLoadError] = useState("");
  const [drawer, setDrawer] = useState({ open: false, expenseId: null });
  const [topUpDialog, setTopUpDialog] = useState({ open: false });

  // ---- Loading ----
  const refresh = useCallback(async () => {
    setLoadState((s) => (s === "ready" ? s : "loading"));
    try {
      const [cats, tops, exps] = await Promise.all([
        api("/categories").then((d) => d.categories.map(categoryFromApi)),
        apiAll("/top-ups", "top_ups").then((list) => list.map(topUpFromApi)),
        apiAll("/expenses", "expenses").then((list) => list.map(expenseFromApi)),
      ]);
      setCategories(cats);
      setTopUps(tops);
      setExpenses(exps);
      setLoadState("ready");
    } catch (err) {
      setLoadError(err.message);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      refresh();
    } else {
      setExpenses([]);
      setTopUps([]);
      setCategories([]);
      setLoadState("idle");
    }
  }, [authStatus, user?.id, refresh]);

  // ---- Balance ----
  const totals = useMemo(() => {
    const cents = (list) => Math.round(list.reduce((s, x) => s + x.amount * 100, 0));
    const toppedUp = cents(topUps) / 100;
    const spent = cents(expenses.filter(isPaid)) / 100;
    const drafts = cents(expenses.filter((e) => !isPaid(e))) / 100;
    return { toppedUp, spent, drafts, balance: Math.round((toppedUp - spent) * 100) / 100 };
  }, [expenses, topUps]);

  /** Money available for an expense, counting back what it already took if it's being edited. */
  const availableFor = useCallback(
    (expenseId) => {
      const existing = expenses.find((e) => e.id === expenseId);
      return totals.balance + (existing && isPaid(existing) ? existing.amount : 0);
    },
    [expenses, totals.balance]
  );

  // ---- Expenses ----
  const putExpense = (e) =>
    setExpenses((list) => (list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? e : x)) : [e, ...list]));

  /** Create (no id) or update (with id) an expense. Returns the saved expense. */
  const saveExpense = useCallback(async (data) => {
    const { id, ...fields } = data;
    const res = id
      ? await api(`/expenses/${id}`, { method: "PATCH", body: expenseToApi(fields) })
      : await api("/expenses", { method: "POST", body: expenseToApi(fields) });
    const saved = expenseFromApi(res.expense);
    putExpense(saved);
    return saved;
  }, []);

  /** Pay drafts from the balance (all or nothing). */
  const payExpenses = useCallback(async (ids) => {
    await api("/expenses/pay", { method: "POST", body: { ids } });
    setExpenses((list) => list.map((e) => (ids.includes(e.id) ? { ...e, status: "paid" } : e)));
  }, []);

  const deleteExpenses = useCallback(async (ids) => {
    const res = ids.length === 1
      ? await api(`/expenses/${ids[0]}`, { method: "DELETE" })
      : await api("/expenses/delete", { method: "POST", body: { ids } });
    setExpenses((list) => list.filter((e) => !ids.includes(e.id)));
    return res;
  }, []);

  /** Undo a deletion by recording the expenses again (receipt files can't be restored). */
  const restoreExpenses = useCallback(async (removed) => {
    for (const e of removed) {
      const res = await api("/expenses", { method: "POST", body: expenseToApi(e) });
      putExpense(expenseFromApi(res.expense));
    }
  }, []);

  // ---- Receipts ----
  const uploadReceipt = useCallback(async (expenseId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await api(`/expenses/${expenseId}/receipt`, { method: "POST", form });
    setExpenses((list) => list.map((e) => (e.id === expenseId ? { ...e, receipt: res.receipt.file_name, receiptInfo: res.receipt } : e)));
  }, []);

  const removeReceipt = useCallback(async (expenseId) => {
    await api(`/expenses/${expenseId}/receipt`, { method: "DELETE" });
    setExpenses((list) => list.map((e) => (e.id === expenseId ? { ...e, receipt: null, receiptInfo: null } : e)));
  }, []);

  /** Open the receipt in a new tab (the file needs the login token, so it's fetched first). */
  const openReceipt = useCallback(async (expenseId) => {
    const res = await api(`/expenses/${expenseId}/receipt`, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, []);

  // ---- Income / top-ups ----
  const addTopUp = useCallback(async (data) => {
    const res = await api("/top-ups", { method: "POST", body: topUpToApi(data) });
    const saved = topUpFromApi(res.top_up);
    setTopUps((list) => [saved, ...list]);
    return saved;
  }, []);

  const deleteTopUp = useCallback(async (id) => {
    await api(`/top-ups/${id}`, { method: "DELETE" });
    setTopUps((list) => list.filter((t) => t.id !== id));
  }, []);

  const restoreTopUp = useCallback((topUp) => addTopUp(topUp), [addTopUp]);

  // ---- Categories ----
  const categoryById = useCallback(
    (id) => categories.find((c) => c.id === id) ?? { id, label: "Uncategorised", icon: "help", budget: 0 },
    [categories]
  );

  const saveCategory = useCallback(async (data) => {
    const { id, ...fields } = data;
    const res = id
      ? await api(`/categories/${id}`, { method: "PATCH", body: categoryToApi(fields) })
      : await api("/categories", { method: "POST", body: categoryToApi(fields) });
    const saved = categoryFromApi(res.category);
    setCategories((list) => (list.some((c) => c.id === saved.id) ? list.map((c) => (c.id === saved.id ? saved : c)) : [...list, saved]));
    return saved;
  }, []);

  /** Deletes a category; the server moves its expenses to "Other". */
  const deleteCategory = useCallback(async (id) => {
    const res = await api(`/categories/${id}`, { method: "DELETE" });
    setExpenses((list) => list.map((e) => (e.category === id ? { ...e, category: res.moved_to } : e)));
    setCategories((list) => list.filter((c) => c.id !== id));
    return res;
  }, []);

  // ---- Panels ----
  const openExpenseDrawer = useCallback((expenseId = null) => setDrawer({ open: true, expenseId }), []);
  const closeExpenseDrawer = useCallback(() => setDrawer((d) => ({ ...d, open: false })), []);
  const openTopUp = useCallback(() => setTopUpDialog({ open: true }), []);
  const closeTopUp = useCallback(() => setTopUpDialog({ open: false }), []);

  const value = useMemo(
    () => ({
      loadState, loadError, refresh,
      expenses, saveExpense, payExpenses, deleteExpenses, restoreExpenses,
      uploadReceipt, removeReceipt, openReceipt,
      topUps, addTopUp, deleteTopUp, restoreTopUp,
      categories, categoryById, saveCategory, deleteCategory,
      ...totals, availableFor,
      drawer, openExpenseDrawer, closeExpenseDrawer,
      topUpDialog, openTopUp, closeTopUp,
    }),
    [loadState, loadError, refresh, expenses, saveExpense, payExpenses, deleteExpenses, restoreExpenses, uploadReceipt,
      removeReceipt, openReceipt, topUps, addTopUp, deleteTopUp, restoreTopUp, categories, categoryById, saveCategory,
      deleteCategory, totals, availableFor, drawer, openExpenseDrawer, closeExpenseDrawer, topUpDialog, openTopUp, closeTopUp]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside <AppDataProvider>");
  return ctx;
}
