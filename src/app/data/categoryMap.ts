export const aiToInternal: Record<string, string> = {
  phone: "electronics",
  smartphone: "electronics",
  iphone: "electronics",
  wallet: "accessories",
  keys: "accessories",
  backpack: "bags",
  bag: "bags",
  bottle: "personal",
  jacket: "clothing",
  shirt: "clothing",
  shoes: "clothing",
  laptop: "electronics",
  charger: "electronics",
  other: "other",
};

export function mapCategory(aiLabel?: string): string | undefined {
  if (!aiLabel) return undefined;
  const key = aiLabel.toLowerCase().trim();
  if (aiToInternal[key]) return aiToInternal[key];
  if (key.includes("phone") || key.includes("iphone") || key.includes("samsung")) return "electronics";
  if (key.includes("wallet") || key.includes("card")) return "accessories";
  if (key.includes("backpack") || key.includes("bag")) return "bags";
  if (key.includes("bottle") || key.includes("water")) return "personal";
  if (key.includes("jacket") || key.includes("coat") || key.includes("shirt") || key.includes("shoe")) return "clothing";
  return undefined;
}
