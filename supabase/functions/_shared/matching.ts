export const MATCH_THRESHOLD = 0.45;
export const MATCH_LIMIT = 5;

const parseCommaSeparatedValues = (value: unknown): string[] => {
  if (!value) return [];
  return String(value)
    .toLowerCase()
    .split(/[;,/|]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
};

const calculateListOverlapSimilarity = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const overlap = a.filter((item) => setB.has(item));
  return overlap.length / Math.max(a.length, b.length);
};

const calculateTextSimilarity = (text1: string, text2: string): number => {
  if (!text1 || !text2) return 0;
  const normalize = (str: string) => str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  const norm1 = normalize(text1);
  const norm2 = normalize(text2);
  if (norm1 === norm2) return 1;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter((word) => words2.includes(word) && word.length > 2);
  if (commonWords.length === 0) return 0;
  return commonWords.length / Math.max(words1.length, words2.length);
};

const calculateKeywordSimilarity = (desc1: string, desc2: string): number => {
  if (!desc1 || !desc2) return 0;
  const stop = new Set([
    "the","and","for","are","but","not","you","all","can","had","her","was","one","our","out","day","get","has","him","his","how","man","new","now","old","see","two","way","who","boy","did","its","let","put","say","she","too","use",
  ]);
  const extractKeywords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w));
  const keywords1 = extractKeywords(desc1);
  const keywords2 = extractKeywords(desc2);
  if (keywords1.length === 0 || keywords2.length === 0) return 0;
  const set2 = new Set(keywords2);
  const common = keywords1.filter((w) => set2.has(w));
  return common.length / Math.max(keywords1.length, keywords2.length);
};

export function calculateMatchScore(lostItem: any, foundItem: any): number {
  let score = 0;
  let totalWeights = 0;

  const categoryWeight = 0.4;
  totalWeights += categoryWeight;
  if (lostItem.category && foundItem.category) {
    if (String(lostItem.category).toLowerCase() === String(foundItem.category).toLowerCase()) {
      score += categoryWeight;
    }
  }

  const nameWeight = 0.3;
  totalWeights += nameWeight;
  if (lostItem.item_name && foundItem.item_name) {
    score += calculateTextSimilarity(String(lostItem.item_name), String(foundItem.item_name)) * nameWeight;
  }

  const colorWeight = 0.15;
  totalWeights += colorWeight;
  if (lostItem.color && foundItem.color) {
    const lostColors = parseCommaSeparatedValues(lostItem.color);
    const foundColors = parseCommaSeparatedValues(foundItem.color);
    score += calculateListOverlapSimilarity(lostColors, foundColors) * colorWeight;
  }

  const brandWeight = 0.15;
  totalWeights += brandWeight;
  if (lostItem.brand && foundItem.brand) {
    if (String(lostItem.brand).toLowerCase() === String(foundItem.brand).toLowerCase()) {
      score += brandWeight;
    }
  }

  const locationWeight = 0.1;
  totalWeights += locationWeight;
  if (lostItem.lost_location && foundItem.found_location) {
    score += calculateTextSimilarity(String(lostItem.lost_location), String(foundItem.found_location)) * locationWeight;
  }

  const descriptionWeight = 0.1;
  totalWeights += descriptionWeight;
  if (lostItem.description && foundItem.description) {
    score += calculateKeywordSimilarity(String(lostItem.description), String(foundItem.description)) * descriptionWeight;
  }

  return score / totalWeights;
}
