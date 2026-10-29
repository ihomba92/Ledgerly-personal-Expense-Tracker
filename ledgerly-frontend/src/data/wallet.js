// Money settings. Change these two lines to switch the whole app to another currency.
// The symbol comes from the locale: en-KE shows KES as "Ksh".
export const CURRENCY = "KES";
export const LOCALE = "en-KE";

// Where top-ups come from.
export const FUNDING_SOURCES = [
  { id: "salary", label: "Salary", icon: "work" },
  { id: "mpesa", label: "M-Pesa", icon: "smartphone" },
  { id: "bank", label: "Bank transfer", icon: "account_balance" },
  { id: "business", label: "Business income", icon: "storefront" },
  { id: "cash", label: "Cash deposit", icon: "payments" },
  { id: "other", label: "Other", icon: "more_horiz" },
];
export const sourceById = (id) => FUNDING_SOURCES.find((s) => s.id === id) ?? FUNDING_SOURCES.at(-1);

// How an expense was paid.
export const PAYMENT_METHODS = [
  { id: "mpesa", label: "M-Pesa", icon: "smartphone" },
  { id: "cash", label: "Cash", icon: "payments" },
  { id: "card", label: "Card", icon: "credit_card" },
  { id: "bank", label: "Bank transfer", icon: "account_balance" },
];
export const methodById = (id) => PAYMENT_METHODS.find((p) => p.id === id) ?? PAYMENT_METHODS[0];
