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

/**
 * Seeds the application with demo data.
 *
 * This is a DEVELOPMENT UTILITY ONLY and must never be called automatically
 * in production. It is exposed via the Settings page in dev mode.
 *
 * @param force - If true, re-seeds even if seed data was previously loaded.
 */
export function seedDemoData(force = false): void {
  if (!force && hasSeedData()) return;

  // Clear existing app data synchronously so seed is clean
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sohan_')) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) {
    localStorage.removeItem(k);
  }

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

/**
 * Clears the seed flag so that if seedDemoData is called again it will work.
 * Also clears old versioned keys.
 */
export function clearSeedFlag(): void {
  localStorage.removeItem(SEED_KEY);
  localStorage.removeItem('sohan_seeded_v1');
}
