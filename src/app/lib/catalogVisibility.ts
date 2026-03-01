import type { ItemCategory } from "@/types";

// Categories that default to hidden (not shown in public catalog) when adding items
const CATEGORIES_DEFAULT_HIDDEN: ItemCategory[] = [
  "accessories",
  "bags",
  "documents",
  "keys",
];

// For electronics: only default to hidden when name/description contains these keywords
const EXPENSIVE_ELECTRONICS_KEYWORDS = [
  "laptop",
  "laptops",
  "airpods",
  "air pods",
  "ipad",
  "ipads",
  "phone",
  "iphone",
  "smartphone",
  "smart phone",
  "macbook",
  "computer",
  "tablet",
  "watch", // Apple Watch etc.
  "headphones",
  "earbuds",
  "ear buds",
];

/**
 * Returns true if the item should default to hidden (show_in_public_catalog = false)
 * based on category and optional name/description.
 */
export function shouldDefaultHidden(
  category: ItemCategory,
  name?: string,
  description?: string
): boolean {
  const text = [name ?? "", description ?? ""].join(" ").toLowerCase();

  // Non-electronics: category alone determines default
  if (CATEGORIES_DEFAULT_HIDDEN.includes(category)) {
    return true;
  }

  // Electronics: category + keywords
  if (category === "electronics") {
    return EXPENSIVE_ELECTRONICS_KEYWORDS.some((kw) => text.includes(kw));
  }

  return false;
}
