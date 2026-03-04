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