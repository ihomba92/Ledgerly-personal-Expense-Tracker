// Sample ledger in Kenyan shillings, dated relative to today so "this month" always has data.
// Replace with the user's records from the backend later.
const day = (offset) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

export const seedTopUps = [
  { id: "TOP-1001", amount: 40000, source: "bank", date: day(62), note: "Starting balance", kind: "initial" },
  { id: "TOP-1002", amount: 85000, source: "salary", date: day(33), note: "Salary" },
  { id: "TOP-1003", amount: 6500, source: "business", date: day(19), note: "Design side project" },
  { id: "TOP-1004", amount: 85000, source: "salary", date: day(3), note: "Salary" },
];

let n = 1000;
const e = (offset, subject, merchant, category, amount, method = "mpesa", extra = {}) => ({
  id: `EXP-${++n}`,
  subject,
  merchant,
  category,
  amount,
  method,
  date: day(offset),
  status: "paid",
  receipt: extra.receipt ?? null,
  description: extra.description ?? "",
  ...extra,
});

export const seedExpenses = [
  // Two months ago
  e(60, "Rent", "Kilimani Heights", "rent", 25000, "bank", { receipt: "rent-receipt.pdf" }),
  e(58, "Electricity tokens", "KPLC", "bills", 2000),
  e(56, "Home internet", "Safaricom Home", "bills", 2999, "mpesa", { receipt: "home-fibre.pdf" }),
  e(54, "Weekly groceries", "Naivas", "food", 4650, "card", { receipt: "naivas-1.jpg" }),
  e(51, "Matatu fare", "Route 46", "transport", 200, "cash"),
  e(49, "Lunch", "Mama Oliech", "eating", 750),
  e(47, "Data bundles", "Safaricom", "airtime", 1000),
  e(45, "Weekly groceries", "Carrefour", "food", 3980, "card"),
  e(42, "Gym membership", "Zoezi Fitness", "health", 3000, "card", { receipt: "gym.pdf" }),
  e(40, "Movie night", "Century Cinemax", "entertainment", 1200, "card"),
  e(38, "Water bill", "Nairobi Water", "bills", 850),
  e(36, "Taxi home", "Bolt", "transport", 640),
  // Last month
  e(31, "Rent", "Kilimani Heights", "rent", 25000, "bank", { receipt: "rent-receipt.pdf" }),
  e(30, "Electricity tokens", "KPLC", "bills", 2500),
  e(28, "Home internet", "Safaricom Home", "bills", 2999, "mpesa", { receipt: "home-fibre.pdf" }),
  e(27, "Weekly groceries", "Naivas", "food", 5120, "card", { receipt: "naivas-2.jpg" }),
  e(25, "Data bundles", "Safaricom", "airtime", 1000),
  e(24, "Coffee with Amani", "Java House", "eating", 980, "card"),
  e(22, "Pharmacy", "Goodlife Pharmacy", "health", 1450, "mpesa", { receipt: "goodlife.jpg" }),
  e(20, "Running shoes", "Decathlon", "shopping", 6200, "card"),
  e(18, "Weekly groceries", "Quickmart", "food", 3760, "mpesa"),
  e(16, "Matatu fares", "Route 46", "transport", 1400, "cash"),
  e(14, "Streaming", "Netflix", "entertainment", 1100, "card"),
  e(12, "Weekly groceries", "Naivas", "food", 4380, "card"),
  e(10, "Lunch", "Artcaffé", "eating", 1350, "card"),
  e(8, "Fuel", "Rubis", "transport", 3000, "card", { receipt: "rubis.jpg" }),
  // This week
  e(4, "Airtime", "Safaricom", "airtime", 500),
  e(2, "Weekly groceries", "Carrefour", "food", 4870, "card", { receipt: "carrefour.jpg" }),
  e(1, "Lunch", "Mama Oliech", "eating", 800),
  e(0, "Matatu fare", "Route 46", "transport", 150, "cash"),
  // Drafts: recorded but not yet taken from the balance
  e(1, "Dentist check-up", "Smile Dental", "health", 4500, "card", { status: "draft" }),
  e(0, "Birthday gift", "Text Book Centre", "shopping", 3200, "mpesa", { status: "draft" }),
];
