// Translate between the API's field names and the shapes the React pages use.
//
//   API                         React app
//   amount "450.50"         ->  amount 450.5
//   spent_on / received_on  ->  date
//   category_id             ->  category
//   note (expense)          ->  description
//   receipt {file_name...}  ->  receipt "file.pdf" (+ receiptInfo)
//   budget "15000.00"       ->  budget 15000

const num = (s) => Number(s ?? 0);

export const expenseFromApi = (e) => ({
  id: e.id,
  subject: e.subject,
  merchant: e.merchant,
  amount: num(e.amount),
  category: e.category_id,
  method: e.method,
  status: e.status,
  date: e.spent_on,
  description: e.note ?? "",
  receipt: e.receipt?.file_name ?? null,
  receiptInfo: e.receipt,
  paidAt: e.paid_at,
});

export const expenseToApi = (x) => {
  const body = {};
  if (x.subject !== undefined) body.subject = x.subject;
  if (x.merchant !== undefined) body.merchant = x.merchant;
  if (x.amount !== undefined) body.amount = Number(x.amount).toFixed(2);
  if (x.category !== undefined) body.category_id = x.category;
  if (x.method !== undefined) body.method = x.method;
  if (x.status !== undefined) body.status = x.status;
  if (x.date !== undefined) body.spent_on = x.date;
  if (x.description !== undefined) body.note = x.description || null;
  return body;
};

export const topUpFromApi = (t) => ({
  id: t.id,
  amount: num(t.amount),
  source: t.source,
  kind: t.kind,
  date: t.received_on,
  note: t.note ?? "",
});

export const topUpToApi = (x) => ({
  amount: Number(x.amount).toFixed(2),
  source: x.source,
  received_on: x.date,
  note: x.note || null,
});

export const categoryFromApi = (c) => ({
  id: c.id,
  label: c.label,
  icon: c.icon,
  budget: num(c.budget),
  isFallback: c.is_fallback,
});

export const categoryToApi = (x) => {
  const body = {};
  if (x.label !== undefined) body.label = x.label;
  if (x.icon !== undefined) body.icon = x.icon;
  if (x.budget !== undefined) body.budget = Number(x.budget).toFixed(2);
  return body;
};

export const initialsOf = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
