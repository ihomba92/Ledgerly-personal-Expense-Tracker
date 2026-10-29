// Default spending categories with monthly budgets in KES. Users can edit these on the Categories page.
export const seedCategories = [
  { id: "food", label: "Food & groceries", icon: "shopping_basket", budget: 15000 },
  { id: "transport", label: "Transport", icon: "directions_bus", budget: 6000 },
  { id: "rent", label: "Rent & housing", icon: "home", budget: 25000 },
  { id: "bills", label: "Bills & utilities", icon: "bolt", budget: 7000 },
  { id: "airtime", label: "Airtime & data", icon: "wifi", budget: 2500 },
  { id: "eating", label: "Eating out", icon: "restaurant", budget: 4000 },
  { id: "health", label: "Health", icon: "favorite", budget: 5000 },
  { id: "entertainment", label: "Entertainment", icon: "theaters", budget: 3000 },
  { id: "shopping", label: "Shopping", icon: "shopping_bag", budget: 5000 },
  { id: "other", label: "Other", icon: "more_horiz", budget: 2000 },
];

// Icons people can pick for a new category.
export const CATEGORY_ICONS = [
  "shopping_basket", "directions_bus", "home", "bolt", "wifi", "restaurant", "favorite", "theaters", "shopping_bag",
  "school", "child_care", "pets", "fitness_center", "local_gas_station", "volunteer_activism", "savings", "flight", "more_horiz",
];
