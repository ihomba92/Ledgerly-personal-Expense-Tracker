import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { CURRENCY, LOCALE } from "@/data/wallet";

// Teach tailwind-merge about the Stitch type scale so `text-body-sm` (size)
// and `text-text-primary` (colour) are never treated as conflicting classes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "metric-lg", "metric-lg-mobile", "metric-md", "headline-section", "display-hero",
            "display-hero-mobile", "body-medium", "body-sm-medium", "body-sm", "body-regular",
            "label-uppercase", "table-cell-mono", "title-card",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// The currency follows the logged-in user's setting (Settings → Currency). Ksh until they change it.
let activeCurrency = CURRENCY;
export const setActiveCurrency = (code) => {
  activeCurrency = code || CURRENCY;
};
export const getActiveCurrency = () => activeCurrency;

export function formatMoney(value, currency = activeCurrency) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
}

/** Whole-shilling amounts for headline figures, e.g. "Ksh 23,480". */
export function formatWhole(value, currency = activeCurrency) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

/** Short labels for chart axes, e.g. "Ksh 3.5K", "Ksh 1.3M". */
export function formatCompact(value, currency = activeCurrency) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

/** The currency symbol on its own, e.g. "Ksh". */
export const currencySymbol = (currency = activeCurrency) =>
  new Intl.NumberFormat(LOCALE, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;

// ---- Dates ----
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthKey = (iso) => iso.slice(0, 7);
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
export const monthLabel = (key, opts = { month: "long", year: "numeric" }) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", opts);
};
export const formatDate = (iso, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", opts);
