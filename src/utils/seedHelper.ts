import { storageService } from '@/storage/StorageService';
import {
  SEED_SUPPLIERS, SEED_PRODUCTS, SEED_CUSTOMERS,
  SEED_PURCHASES, SEED_SALES, SEED_EXPENSES, SEED_HOTEL_ROOMS, SEED_BATCHES,
} from '@/data/seedData';

// Bump this key whenever seed data shape changes — forces a fresh load
const SEED_KEY = 'sohan_seeded_v2';

export function hasSeedData(): boolean {
  return localStorage.getItem(SEED_KEY) === 'true';
}

export function seedDemoData(): void {
  if (hasSeedData()) return;

  // Clear existing data
  storageService.clearAll();

  const collections: Record<string, any[]> = {
    suppliers: SEED_SUPPLIERS,
    inventory: SEED_PRODUCTS,
    customers: SEED_CUSTOMERS,
    purchases: SEED_PURCHASES,
    sales: SEED_SALES,
    expenses: SEED_EXPENSES,
    hotelRooms: SEED_HOTEL_ROOMS,
    productBatches: SEED_BATCHES,
    hotelBills: [],
    restaurantBills: [],
    cashBook: [],
    credit: [],
  };

  for (const [key, data] of Object.entries(collections)) {
    localStorage.setItem(`sohan_${key}`, JSON.stringify(data));
  }

  localStorage.setItem(SEED_KEY, 'true');
}

export function clearSeedFlag(): void {
  localStorage.removeItem(SEED_KEY);
  // Also clear old v1 key so fresh seed runs
  localStorage.removeItem('sohan_seeded_v1');
}
