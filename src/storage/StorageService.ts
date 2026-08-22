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
    if (key === 'inventoryLocationStocks') {
      this.ensureDefaultLocationStocks();
    }
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
    this.ensureDefaultLocation();
    this.ensureDefaultBatchAllocations();
    this.ensureDefaultLocationStocks();

    const backup = {
      schemaVersion: this.SCHEMA_VERSION,
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {} as Record<string, any>
    };

    const allKeys = [
      'inventory', 'locations', 'settings', 'suppliers', 'customers', 'sales',
      'purchases', 'expenses', 'hotelRooms', 'productBatches', 'productBatchLocations',
      'inventoryLocationStocks', 'inventoryMovements', 'consumptions', 'productions',
      'hotelBills', 'restaurantBills', 'cashBook', 'credit', 'dispositions',
      'financialAccounts', 'financialTransactions', 'financialMovements'
    ];

    for (const key of allKeys) {
      const fullKey = this.getFullKey(key);
      // Read through the memory cache so deferred localStorage writes cannot
      // leave a freshly changed record out of the backup.
      if (key === 'settings') {
        backup.data[fullKey] = await this.getSettings();
      } else {
        backup.data[fullKey] = await this.get(key);
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
        'inventory', 'locations', 'settings', 'suppliers', 'customers', 'sales',
        'purchases', 'expenses', 'hotelRooms', 'productBatches', 'consumptions', 'productions',
        'hotelBills', 'restaurantBills', 'cashBook', 'credit', 'dispositions',
        'financialAccounts', 'financialTransactions', 'financialMovements'
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

  async transaction<T>(storeKeys: string[], mode: 'rw' | 'r', callback: () => Promise<T>): Promise<T> {
    const backups = new Map<string, StorageRecord[]>();
    for (const key of storeKeys) {
      const items = await this.get<StorageRecord>(key);
      backups.set(key, items.map((item) => ({ ...item })));
    }

    try {
      return await callback();
    } catch (error) {
      for (const [key, items] of backups) {
        await this.set(key, items as any);
      }
      throw error;
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

  private ensureDefaultLocation(): void {
    const raw = localStorage.getItem(`${this.KEY_PREFIX}locations`);
    const rows = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(rows) ? rows : [];
    const existing = list.find((location: any) => location.isDefault || location.id === 'loc-default');

    if (existing) {
      if (!existing.isDefault) {
        existing.isDefault = true;
        localStorage.setItem(`${this.KEY_PREFIX}locations`, JSON.stringify(list));
      }
      return;
    }

    const now = new Date().toISOString();
    const defaultLocation = {
      id: 'loc-default',
      name: 'Main Location',
      code: 'MAIN',
      isDefault: true,
      notes: 'Default location for pre-existing inventory data',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    };

    localStorage.setItem(`${this.KEY_PREFIX}locations`, JSON.stringify([...list, defaultLocation]));
  }

  private ensureDefaultBatchAllocations(): void {
    const locationRows = JSON.parse(localStorage.getItem(`${this.KEY_PREFIX}locations`) || '[]');
    const defaultLocation = Array.isArray(locationRows)
      ? locationRows.find((location: any) => location.isDefault || location.id === 'loc-default')
      : null;

    if (!defaultLocation) {
      this.ensureDefaultLocation();
      return;
    }

    const allocationRows = JSON.parse(localStorage.getItem(`${this.KEY_PREFIX}productBatchLocations`) || '[]');
    const allocations = Array.isArray(allocationRows) ? allocationRows : [];
    const batches = JSON.parse(localStorage.getItem(`${this.KEY_PREFIX}productBatches`) || '[]');
    const batchList = Array.isArray(batches) ? batches : [];
    const used = new Set(allocations.filter((item: any) => item.batchId).map((item: any) => `${item.batchId}::${item.locationId}`));

    for (const batch of batchList) {
      if (batch.deletedAt) continue;
      const key = `${batch.id}::${defaultLocation.id}`;
      if (used.has(key)) continue;

      const hasAny = allocations.some((item: any) => item.batchId === batch.id);
      if (hasAny) continue;

      const createdAt = new Date().toISOString();
      allocations.push({
        id: `pbl-${batch.id}`,
        batchId: batch.id,
        locationId: defaultLocation.id,
        quantity: Number(batch.quantity ?? 0),
        dateReceived: batch.createdAt ?? createdAt,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        version: 1,
      });
      used.add(key);
    }

    localStorage.setItem(`${this.KEY_PREFIX}productBatchLocations`, JSON.stringify(allocations));
  }

  private ensureDefaultLocationStocks(): void {
    const locationRows = JSON.parse(localStorage.getItem(`${this.KEY_PREFIX}locations`) || '[]');
    const defaultLocation = Array.isArray(locationRows)
      ? locationRows.find((location: any) => location.isDefault || location.id === 'loc-default')
      : null;

    if (!defaultLocation) {
      this.ensureDefaultLocation();
      return;
    }

    const stockRows = JSON.parse(localStorage.getItem(`${this.KEY_PREFIX}inventoryLocationStocks`) || '[]');
    let stocks = Array.isArray(stockRows) ? stockRows : [];
    const products = JSON.parse(localStorage.getItem(`${this.KEY_PREFIX}inventory`) || '[]');
    const productList = Array.isArray(products) ? products : [];

    let changed = false;
    const now = new Date().toISOString();

    for (const product of productList) {
      if (product.deletedAt) continue;

      let productStocks = stocks.filter((s: any) => s.productId === product.id && !s.deletedAt);

      // 1. Clean up duplicate default location records first if they exist
      const defaultRecords = productStocks.filter((s: any) => s.locationId === defaultLocation.id);
      if (defaultRecords.length > 1) {
        const keepRecord = defaultRecords[0];
        const sumDefaultQty = defaultRecords.reduce((sum: number, s: any) => sum + Number(s.quantity ?? 0), 0);

        // Consolidate quantity into the first record
        const keepIdx = stocks.findIndex((s: any) => s.id === keepRecord.id);
        if (keepIdx >= 0) {
          stocks[keepIdx].quantity = sumDefaultQty;
          stocks[keepIdx].updatedAt = now;
          stocks[keepIdx].version = (stocks[keepIdx].version || 1) + 1;
        }

        // Mark the other duplicates as deleted
        for (let i = 1; i < defaultRecords.length; i++) {
          const extraIdx = stocks.findIndex((s: any) => s.id === defaultRecords[i].id);
          if (extraIdx >= 0) {
            stocks[extraIdx].deletedAt = now;
            stocks[extraIdx].updatedAt = now;
          }
        }
        changed = true;
        // Refresh productStocks list after cleanup
        productStocks = stocks.filter((s: any) => s.productId === product.id && !s.deletedAt);
      }

      // 2. Perform drift reconciliation
      if (productStocks.length === 0) {
        stocks.push({
          id: `ils-${product.id}`,
          productId: product.id,
          locationId: defaultLocation.id,
          quantity: Number(product.quantity ?? 0),
          lastMovementAt: now,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          version: 1,
        });
        changed = true;
      } else {
        const totalLocationQty = productStocks.reduce((sum: number, s: any) => sum + Number(s.quantity ?? 0), 0);
        const expectedQty = Number(product.quantity ?? 0);
        const drift = expectedQty - totalLocationQty;

        if (drift !== 0) {
          const defaultRecord = productStocks.find((s: any) => s.locationId === defaultLocation.id);
          if (defaultRecord) {
            const idx = stocks.findIndex((s: any) => s.id === defaultRecord.id);
            if (idx >= 0) {
              stocks[idx].quantity = Math.max(0, Number(stocks[idx].quantity ?? 0) + drift);
              stocks[idx].updatedAt = now;
              stocks[idx].version = (stocks[idx].version || 1) + 1;
              changed = true;
            }
          } else {
            // Main Location record is missing, but other locations exist. Create it with the drift amount.
            stocks.push({
              id: `ils-${product.id}`,
              productId: product.id,
              locationId: defaultLocation.id,
              quantity: Math.max(0, drift),
              lastMovementAt: now,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              version: 1,
            });
            changed = true;
          }
        }
      }
    }

    if (changed) {
      localStorage.setItem(`${this.KEY_PREFIX}inventoryLocationStocks`, JSON.stringify(stocks));
    }
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
      defaultLocationId: 'loc-default',
      theme: 'system',
      language: 'en',
      features: defaultFeatures
    };

    try {
      const raw = localStorage.getItem(`${this.KEY_PREFIX}settings`);
      if (raw) {
        const parsed = JSON.parse(raw);
        const mergedFeatures = { ...defaultFeatures, ...parsed.features };
        const merged = { ...defaultSettings, ...parsed, features: mergedFeatures };
        if (!merged.defaultLocationId) {
          merged.defaultLocationId = 'loc-default';
        }
        return merged;
      }
    } catch {
      // Ignore
    }
    this.ensureDefaultLocation();
    return defaultSettings;
  }

  async saveSettings(settings: any): Promise<void> {
    const normalized = settings && typeof settings === 'object' ? settings : {};
    if (!normalized.defaultLocationId) normalized.defaultLocationId = 'loc-default';
    localStorage.setItem(`${this.KEY_PREFIX}settings`, JSON.stringify(normalized));
  }
}

/** Default offline provider — singleton used throughout the app */
export const localStorageProvider = new LocalStorageProvider();

// Backwards-compatible alias so existing imports don't break during migration
export const storageService = localStorageProvider;
