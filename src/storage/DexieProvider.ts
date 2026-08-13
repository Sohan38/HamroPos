import Dexie, { type Table } from 'dexie';
import { StorageRecord } from '../types';
import { IStorageProvider } from './IStorageProvider';

// ─── Database Schema ──────────────────────────────────────────────────────────

/**
 * All collection keys the app uses.
 * Each becomes its own IndexedDB object store with proper indexes.
 */
const COLLECTION_KEYS = [
  'inventory',
  'locations',
  'suppliers',
  'customers',
  'sales',
  'purchases',
  'expenses',
  'hotelRooms',
  'productBatches',
  'productBatchLocations',
  'hotelBills',
  'restaurantBills',
  'cashBook',
  'credit',
  'dispositions',
] as const;

type CollectionKey = typeof COLLECTION_KEYS[number];

interface SettingsRow {
  key: string; // primary key — always 'settings'
  value: any;
}

/**
 * Typed Dexie database.
 *
 * - Each collection gets its own object store keyed by `id`.
 * - Indexes on `deletedAt` and `updatedAt` are added for future query filtering.
 * - A dedicated settings store avoids mixing settings with collection arrays.
 */
class SohanDB extends Dexie {
  // Dynamically typed collection tables
  [key: string]: any;

  settings!: Table<SettingsRow, string>;

  constructor() {
    super('sohan_manager');

    const schema: Record<string, string> = {
      settings: 'key',
    };

    for (const key of COLLECTION_KEYS) {
      // id = primary key, deletedAt + updatedAt indexed for filtering & sync
      schema[key] = 'id, deletedAt, updatedAt';
    }

    this.version(1).stores(schema);
  }
}

const db = new SohanDB();

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Dexie-backed IndexedDB storage provider.
 *
 * On the web: uses native IndexedDB (async, high-quota, non-blocking).
 * On Android Capacitor WebView: uses the app's private IndexedDB — stored in
 *   /data/data/com.sohan.HamroPos/ and NOT subject to browser cache eviction.
 *
 * Future upgrade path: swap this provider with a native SQLite provider
 * (e.g. Capawesome SQLite) when needed — zero UI changes required.
 */
export class DexieProvider implements IStorageProvider {
  private readonly SCHEMA_VERSION = 1;

  /** Write-through memory cache — same zero-latency read pattern as before */
  private readonly memCache = new Map<string, StorageRecord[]>();

  private notifyStorageChanged(key?: string) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('sohan-storage-changed', { detail: { key } }));
  }

  private table(key: string): Table<StorageRecord, string> {
    return (db as any)[key] as Table<StorageRecord, string>;
  }

  // ── Collection CRUD ─────────────────────────────────────────────────────────

  async set<T extends StorageRecord>(key: string, data: T[]): Promise<void> {
    this.memCache.set(key, data as StorageRecord[]);
    try {
      await db.transaction('rw', this.table(key), async () => {
        await this.table(key).clear();
        if (data.length > 0) {
          await this.table(key).bulkPut(data as StorageRecord[]);
        }
      });
      this.notifyStorageChanged(key);
    } catch (error) {
      console.error(`[DexieProvider] set("${key}") failed:`, error);
    }
  }

  async getById<T extends StorageRecord>(key: string, id: string): Promise<T | null> {
    try {
      const record = await this.table(key).get(id);
      if (!record || record.deletedAt) return null;
      return record as T;
    } catch (error) {
      console.error(`[DexieProvider] getById("${key}", "${id}") failed:`, error);
      return null;
    }
  }

  async save<T extends StorageRecord>(key: string, record: T): Promise<T> {
    const now = new Date().toISOString();
    let saved: T;

    try {
      const existing = await this.table(key).get(record.id);
      if (existing) {
        saved = {
          ...record,
          updatedAt: now,
          version: (existing.version ?? 0) + 1,
        };
      } else {
        saved = {
          ...record,
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
      }
      await this.table(key).put(saved as StorageRecord);

      // Update cache entry in-place without full reload
      if (this.memCache.has(key)) {
        const cached = this.memCache.get(key)!;
        const idx = cached.findIndex((r) => r.id === saved.id);
        if (idx >= 0) {
          cached[idx] = saved as StorageRecord;
        } else {
          cached.push(saved as StorageRecord);
        }
      }

      this.notifyStorageChanged(key);
      return saved;
    } catch (error) {
      console.error(`[DexieProvider] save("${key}") failed:`, error);
      throw error;
    }
  }

  async transaction<T>(storeKeys: string[], mode: 'rw' | 'r', callback: () => Promise<T>): Promise<T> {
    if (storeKeys.length === 0) return callback();
    const tables = storeKeys.map((key) => this.table(key));
    return db.transaction(mode, tables, callback);
  }

  async softDelete(key: string, id: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      await this.table(key).update(id, {
        deletedAt: now,
        updatedAt: now,
      });
      // Patch cache
      if (this.memCache.has(key)) {
        const cached = this.memCache.get(key)!;
        const record = cached.find((r) => r.id === id);
        if (record) {
          record.deletedAt = now;
          record.updatedAt = now;
        }
      }
      this.notifyStorageChanged(key);
    } catch (error) {
      console.error(`[DexieProvider] softDelete("${key}", "${id}") failed:`, error);
    }
  }

  async undoSoftDelete(key: string, id: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      await this.table(key).update(id, {
        deletedAt: null,
        updatedAt: now,
      });
      if (this.memCache.has(key)) {
        const cached = this.memCache.get(key)!;
        const record = cached.find((r) => r.id === id);
        if (record) {
          record.deletedAt = null;
          record.updatedAt = now;
        }
      }
      this.notifyStorageChanged(key);
    } catch (error) {
      console.error(`[DexieProvider] undoSoftDelete("${key}", "${id}") failed:`, error);
    }
  }

  async hardDelete(key: string, id: string): Promise<void> {
    try {
      await this.table(key).delete(id);
      if (this.memCache.has(key)) {
        const cached = this.memCache.get(key)!;
        const idx = cached.findIndex((r) => r.id === id);
        if (idx >= 0) cached.splice(idx, 1);
      }
      this.notifyStorageChanged(key);
    } catch (error) {
      console.error(`[DexieProvider] hardDelete("${key}", "${id}") failed:`, error);
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────────

  private get defaultSettings() {
    return {
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
      features: {
        inventory: {
          batches: true, expiry: true, variants: true,
          serialNumbers: true, barcodeSupport: true, multiUnits: true,
        },
        sales: {
          returns: true, creditSales: true, discounts: true,
          layaway: true, quotations: true,
        },
        customers: { loyalty: true, membership: true },
        hospitality: { hotelGrid: true, restaurantBilling: true },
      },
    };
  }

  private async ensureDefaultLocation(): Promise<void> {
    try {
      const rows = await this.get<any>('locations');
      const defaultLocation = rows.find((location) => location.isDefault || location.id === 'loc-default');

      if (defaultLocation) {
        if (!defaultLocation.isDefault) {
          defaultLocation.isDefault = true;
          await this.save('locations', defaultLocation);
        }
        return;
      }

      const createdAt = new Date().toISOString();
      const defaultLocationRecord = {
        id: 'loc-default',
        name: 'Main Location',
        code: 'MAIN',
        isDefault: true,
        notes: 'Default location for pre-existing inventory data',
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        version: 1,
      };

      await this.save('locations', defaultLocationRecord as any);
    } catch (error) {
      console.error('[DexieProvider] ensureDefaultLocation failed:', error);
    }
  }

  private async ensureDefaultBatchAllocations(): Promise<void> {
    try {
      const defaultLocation = (await this.get<any>('locations')).find((location) => location.isDefault || location.id === 'loc-default');
      if (!defaultLocation) {
        await this.ensureDefaultLocation();
        return;
      }

      const allocations = await this.get<any>('productBatchLocations');
      const batches = await this.get<any>('productBatches');
      const used = new Set(allocations.filter((item) => item.batchId).map((item) => `${item.batchId}::${item.locationId}`));

      for (const batch of batches) {
        if (batch.deletedAt) continue;
        const allocationKey = `${batch.id}::${defaultLocation.id}`;
        if (used.has(allocationKey)) continue;

        const hasAnyAllocationForBatch = allocations.some((item) => item.batchId === batch.id);
        if (hasAnyAllocationForBatch) continue;

        const createdAt = new Date().toISOString();
        const defaultAllocation = {
          id: `pbl-${batch.id}`,
          batchId: batch.id,
          locationId: defaultLocation.id,
          quantity: Number(batch.quantity ?? 0),
          dateReceived: batch.createdAt ?? createdAt,
          createdAt,
          updatedAt: createdAt,
          deletedAt: null,
          version: 1,
        };

        await this.save('productBatchLocations', defaultAllocation as any);
        used.add(allocationKey);
      }
    } catch (error) {
      console.error('[DexieProvider] ensureDefaultBatchAllocations failed:', error);
    }
  }

  async get<T extends StorageRecord>(key: string): Promise<T[]> {
    if (key === 'productBatchLocations') {
      await this.ensureDefaultBatchAllocations();
    }
    if (this.memCache.has(key)) {
      return this.memCache.get(key) as T[];
    }
    try {
      const rows = await this.table(key).toArray();
      this.memCache.set(key, rows);
      return rows as T[];
    } catch (error) {
      console.error(`[DexieProvider] get("${key}") failed:`, error);
      return [];
    }
  }

  async getSettings(): Promise<any> {
    try {
      const row = await db.settings.get('settings');
      if (row?.value && typeof row.value === 'object') {
        const defaults = this.defaultSettings;
        const settings = {
          ...defaults,
          ...row.value,
          features: { ...defaults.features, ...row.value.features },
        };
        if (!settings.defaultLocationId) {
          settings.defaultLocationId = defaults.defaultLocationId;
        }
        return settings;
      }
    } catch (error) {
      console.error('[DexieProvider] getSettings failed:', error);
    }
    const settings = { ...this.defaultSettings };
    await this.ensureDefaultLocation();
    return settings;
  }

  async saveSettings(settings: any): Promise<void> {
    try {
      await db.settings.put({ key: 'settings', value: settings });
    } catch (error) {
      console.error('[DexieProvider] saveSettings failed:', error);
    }
  }

  // ── Bulk Operations ───────────────────────────────────────────────────────────

  async exportAll(): Promise<string> {
    await this.ensureDefaultLocation();
    await this.ensureDefaultBatchAllocations();

    const backup: Record<string, any> = {
      schemaVersion: this.SCHEMA_VERSION,
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {} as Record<string, any>,
    };

    for (const key of COLLECTION_KEYS) {
      try {
        backup.data[`sohan_${key}`] = await this.table(key).toArray();
      } catch {
        backup.data[`sohan_${key}`] = [];
      }
    }

    backup.data['sohan_settings'] = await this.getSettings();
    return JSON.stringify(backup);
  }

  async importAll(json: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid backup file: not a valid JSON object');
      }

      const schemaVersion = parsed.schemaVersion ?? parsed._meta?.version;
      if (!schemaVersion) throw new Error('Invalid backup file: missing schema version');
      if (schemaVersion !== this.SCHEMA_VERSION) {
        throw new Error(`Incompatible schema version: expected ${this.SCHEMA_VERSION}, got ${schemaVersion}`);
      }

      let collections: Record<string, any> = {};
      if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
        collections = parsed.data;
      } else {
        for (const [k, v] of Object.entries(parsed)) {
          if (k !== '_meta' && k.startsWith('sohan_')) collections[k] = v;
        }
      }

      // Validate all required collection types
      for (const key of COLLECTION_KEYS) {
        const fullKey = `sohan_${key}`;
        if (fullKey in collections) {
          if (!Array.isArray(collections[fullKey])) {
            throw new Error(`Invalid backup: "${key}" must be an array`);
          }
        } else {
          collections[fullKey] = [];
        }
      }

      if ('sohan_settings' in collections) {
        if (typeof collections['sohan_settings'] !== 'object' || collections['sohan_settings'] === null) {
          throw new Error('Invalid backup: settings must be an object');
        }
      }

      // Clear then restore — all in one Dexie transaction per table
      await this.clearAll();

      for (const key of COLLECTION_KEYS) {
        const rows = collections[`sohan_${key}`] ?? [];
        if (rows.length > 0) {
          await this.table(key).bulkPut(rows);
        }
      }

      if (!collections['sohan_locations'] || !Array.isArray(collections['sohan_locations']) || collections['sohan_locations'].length === 0) {
        await this.ensureDefaultLocation();
      }
      await this.ensureDefaultBatchAllocations();

      if (collections['sohan_settings']) {
        await this.saveSettings(collections['sohan_settings']);
      }

      return true;
    } catch (error) {
      console.error('[DexieProvider] importAll failed:', error);
      return false;
    }
  }

  async clearKey(key: string): Promise<void> {
    try {
      await this.table(key).clear();
      this.memCache.delete(key);
    } catch (error) {
      console.error(`[DexieProvider] clearKey("${key}") failed:`, error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const tables = COLLECTION_KEYS.map((k) => (db as any)[k]) as any[];
      await db.transaction('rw', [db.settings, ...tables], async () => {
        for (const key of COLLECTION_KEYS) {
          await (db as any)[key].clear();
        }
        await db.settings.clear();
      });
      this.memCache.clear();
      const { clearSeedFlag } = await import('@/utils/seedHelper');
      clearSeedFlag();
    } catch (error) {
      console.error('[DexieProvider] clearAll failed:', error);
    }
  }
}

/** Singleton Dexie-backed provider */
export const dexieProvider = new DexieProvider();
