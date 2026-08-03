import { StorageRecord } from '../types';
import { IStorageProvider } from './IStorageProvider';

/**
 * Offline storage provider — persists all data to localStorage.
 *
 * Implements IStorageProvider so it can be swapped with a cloud
 * or hybrid provider in the future without touching UI or business logic.
 */
export class LocalStorageProvider implements IStorageProvider {
  private readonly KEY_PREFIX = 'sohan_';
  private readonly SCHEMA_VERSION = 1;

  /** In-memory write-through cache — keyed by storage key (without prefix). */
  private readonly memCache = new Map<string, StorageRecord[]>();

  /** Keys currently waiting for their deferred disk flush. */
  private readonly pendingFlush = new Set<string>();

  private getFullKey(key: string): string {
    return `${this.KEY_PREFIX}${key}`;
  }

  /**
   * Read from in-memory cache; hydrate cache from disk on the first access
   * only — subsequent reads within the same session cost zero disk I/O.
   */
  async get<T extends StorageRecord>(key: string): Promise<T[]> {
    if (this.memCache.has(key)) {
      return this.memCache.get(key) as T[];
    }
    try {
      const raw = localStorage.getItem(this.getFullKey(key));
      if (!raw) {
        this.memCache.set(key, []);
        return [];
      }
      const parsed = JSON.parse(raw);
      const data: StorageRecord[] = Array.isArray(parsed) ? parsed : [];
      this.memCache.set(key, data);
      return data as T[];
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error);
      return [];
    }
  }

  /**
   * Update cache immediately, then schedule a single deferred flush to
   * localStorage per key per event-loop tick — multiple rapid writes to
   * the same key produce only one JSON.stringify + disk write.
   */
  async set<T extends StorageRecord>(key: string, data: T[]): Promise<void> {
    this.memCache.set(key, data as StorageRecord[]);
    if (!this.pendingFlush.has(key)) {
      this.pendingFlush.add(key);
      queueMicrotask(() => {
        try {
          const cached = this.memCache.get(key);
          if (cached !== undefined) {
            localStorage.setItem(this.getFullKey(key), JSON.stringify(cached));
          }
        } catch (error) {
          console.error(`Error writing ${key} to storage:`, error);
        } finally {
          this.pendingFlush.delete(key);
        }
      });
    }
  }

  async getById<T extends StorageRecord>(key: string, id: string): Promise<T | null> {
    const items = await this.get<T>(key);
    return items.find((item) => item.id === id && !item.deletedAt) || null;
  }

  async save<T extends StorageRecord>(key: string, record: T): Promise<T> {
    const items = await this.get<T>(key);
    const existingIndex = items.findIndex((item) => item.id === record.id);
    
    const now = new Date().toISOString();
    
    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...record,
        updatedAt: now,
        version: items[existingIndex].version + 1,
      };
    } else {
      items.push({
        ...record,
        createdAt: now,
        updatedAt: now,
        version: 1,
      });
    }
    
    await this.set(key, items);
    return items[existingIndex >= 0 ? existingIndex : items.length - 1];
  }

  async softDelete(key: string, id: string): Promise<void> {
    const items = await this.get<StorageRecord>(key);
    const existingIndex = items.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      items[existingIndex].deletedAt = new Date().toISOString();
      items[existingIndex].updatedAt = new Date().toISOString();
      items[existingIndex].version += 1;
      await this.set(key, items);
    }
  }
  
  async undoSoftDelete(key: string, id: string): Promise<void> {
    const items = await this.get<StorageRecord>(key);
    const existingIndex = items.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      items[existingIndex].deletedAt = null;
      items[existingIndex].updatedAt = new Date().toISOString();
      items[existingIndex].version += 1;
      await this.set(key, items);
    }
  }

  async hardDelete(key: string, id: string): Promise<void> {
    const items = await this.get<StorageRecord>(key);
    await this.set(key, items.filter(item => item.id !== id));
  }

  async exportAll(): Promise<string> {
    const backup = {
      schemaVersion: this.SCHEMA_VERSION,
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {} as Record<string, any>
    };

    const allKeys = [
      'inventory', 'settings', 'suppliers', 'customers', 'sales',
      'purchases', 'expenses', 'hotelRooms', 'productBatches',
      'hotelBills', 'restaurantBills', 'cashBook', 'credit'
    ];

    for (const key of allKeys) {
      const fullKey = this.getFullKey(key);
      const val = localStorage.getItem(fullKey);
      if (val) {
        try {
          backup.data[fullKey] = JSON.parse(val);
        } catch {
          backup.data[fullKey] = key === 'settings' ? await this.getSettings() : [];
        }
      } else {
        backup.data[fullKey] = key === 'settings' ? await this.getSettings() : [];
      }
    }

    // Export any other custom keys prefixed with sohan_ (e.g. legacy/additional keys)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.KEY_PREFIX) && !backup.data[k]) {
        try {
          backup.data[k] = JSON.parse(localStorage.getItem(k) || '[]');
        } catch {
          // Ignore
        }
      }
    }
    return JSON.stringify(backup);
  }

  async importAll(json: string): Promise<boolean> {
    try {
      // 1. Validate JSON format
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error("Invalid backup file: Payload is not a valid JSON object");
      }

      // 2. Validate metadata / schema version (support old format with _meta too)
      const schemaVersion = parsed.schemaVersion ?? parsed._meta?.version;
      if (!schemaVersion) {
        throw new Error("Invalid backup file: Missing schema version");
      }
      if (schemaVersion !== this.SCHEMA_VERSION) {
        throw new Error(`Incompatible schema version: expected ${this.SCHEMA_VERSION}, got ${schemaVersion}`);
      }

      // 3. Extract and normalize collections
      let collections: Record<string, any> = {};
      if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
        collections = parsed.data;
      } else {
        // Fallback: Support old format where collections are on the root level
        for (const [k, v] of Object.entries(parsed)) {
          if (k !== '_meta' && k.startsWith(this.KEY_PREFIX)) {
            collections[k] = v;
          }
        }
      }

      // 4. Validate collections structure and populate missing ones with defaults
      const allKeys = [
        'inventory', 'settings', 'suppliers', 'customers', 'sales',
        'purchases', 'expenses', 'hotelRooms', 'productBatches',
        'hotelBills', 'restaurantBills', 'cashBook', 'credit'
      ];
      for (const key of allKeys) {
        const fullKey = this.getFullKey(key);
        if (fullKey in collections) {
          const val = collections[fullKey];
          if (key === 'settings') {
            if (typeof val !== 'object' || val === null) {
              throw new Error("Invalid backup file: Settings collection is not a valid object");
            }
          } else {
            if (!Array.isArray(val)) {
              throw new Error(`Invalid backup file: Collection "${key}" is not a valid array`);
            }
          }
        } else {
          // Initialize with default empty state if missing in backup
          collections[fullKey] = key === 'settings' ? await this.getSettings() : [];
        }
      }

      // 5. Overwrite only after every validation succeeds
      await this.clearAll(); // also clears in-memory cache
      
      for (const [k, v] of Object.entries(collections)) {
        if (k.startsWith(this.KEY_PREFIX)) {
          localStorage.setItem(k, JSON.stringify(v));
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to import data:", error);
      return false;
    }
  }

  async clearKey(key: string): Promise<void> {
    localStorage.removeItem(this.getFullKey(key));
    this.memCache.delete(key);
  }
  
  async clearAll(): Promise<void> {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.KEY_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
    // Wipe the entire in-memory cache so nothing stale survives after a reset.
    this.memCache.clear();
    this.pendingFlush.clear();
    // Also clear the seed flag so demo data is not re-injected on reload
    const { clearSeedFlag } = await import('@/utils/seedHelper');
    clearSeedFlag();
  }
  
  async getSettings(): Promise<any> {
    const defaultFeatures = {
      inventory: {
        batches: true,
        expiry: true,
        variants: true,
        serialNumbers: true,
        barcodeSupport: true,
        multiUnits: true,
      },
      sales: {
        returns: true,
        creditSales: true,
        discounts: true,
        layaway: true,
        quotations: true,
      },
      customers: {
        loyalty: true,
        membership: true,
      },
      hospitality: {
        hotelGrid: true,
        restaurantBilling: true,
      },
    };

    const defaultSettings = {
      businessName: 'My Business',
      businessLogoBase64: null,
      phone: '',
      address: '',
      vatNumber: '',
      currency: 'NPR',
      currencySymbol: 'Rs.',
      taxRate: 13,
      lowStockThreshold: 10,
      theme: 'system',
      language: 'en',
      features: defaultFeatures
    };
    
    try {
      const raw = localStorage.getItem(`${this.KEY_PREFIX}settings`);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Ensure features key is deeply merged or exists
        const mergedFeatures = { ...defaultFeatures, ...parsed.features };
        return { ...defaultSettings, ...parsed, features: mergedFeatures };
      }
    } catch {
      // Ignore
    }
    return defaultSettings;
  }
  
  async saveSettings(settings: any): Promise<void> {
    localStorage.setItem(`${this.KEY_PREFIX}settings`, JSON.stringify(settings));
  }
}

/** Default offline provider — singleton used throughout the app */
export const localStorageProvider = new LocalStorageProvider();

// Backwards-compatible alias so existing imports don't break during migration
export const storageService = localStorageProvider;
