import type { ItemCategory } from "../../../shared/categoryLabels";
export type { ItemCategory } from "../../../shared/categoryLabels";
export { categoryLabels } from "../../../shared/categoryLabels";

export interface LostItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  color?: string;
  dateLost: string;
  locationLost: string;
  imageUrl?: string;
  status: 'searching' | 'matched' | 'claimed' | 'recovered';
  userId: string;
  createdAt: string;
}

export interface FoundItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  dateFound: string;
  imageUrl?: string;
  status: 'available' | 'claimed' | 'returned';
  officeId: string;
  officeName: string;
  officeLocation: string;
  foundLocation?: string;
  checkedInBy: string;
  createdAt: string;
  updatedAt?: string;
  color?: string;
  brand?: string;
  showInPublicCatalog?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ItemFormData {
  name: string;
  description: string;
  category: ItemCategory;
  imageUrl?: string;
  foundLocation?: string;
  color?: string;
  brand?: string;
  foundDate?: string;
}

export interface Office {
  id: string;
  name: string;
  location: string;
  description?: string;
}

export interface Match {
  id: string;
  lostItemId: string;
  foundItemId: string;
  confidence: number;
  foundItem: FoundItem;
}

export const categoryIcons: Record<ItemCategory, string> = {
  electronics: '📱',
  clothing: '👕',
  accessories: '⌚',
  documents: '📄',
  keys: '🔑',
  bags: '🎒',
  other: '📦',
};