export interface LostItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  dateLost: string;
  locationLost: string;
  imageUrl?: string;
  status: 'searching' | 'matched' | 'claimed';
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
  status: 'available' | 'claimed' | 'cancelled';
  officeId: string;
  officeName: string;
  officeLocation: string;
  checkedInBy: string;
  createdAt: string;
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

export type ItemCategory = 
  | 'electronics'
  | 'clothing'
  | 'accessories'
  | 'documents'
  | 'keys'
  | 'bags'
  | 'other';

export const categoryLabels: Record<ItemCategory, string> = {
  electronics: 'Electronics',
  clothing: 'Clothing',
  accessories: 'Accessories',
  documents: 'Documents',
  keys: 'Keys',
  bags: 'Bags & Luggage',
  other: 'Other',
};

export const categoryIcons: Record<ItemCategory, string> = {
  electronics: '📱',
  clothing: '👕',
  accessories: '⌚',
  documents: '📄',
  keys: '🔑',
  bags: '🎒',
  other: '📦',
};
