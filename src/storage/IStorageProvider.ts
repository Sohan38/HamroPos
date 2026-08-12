import { StorageRecord } from '../types';

/**
 * Storage provider interface — the single abstraction between the app and its data backend.
 *
 * Today: LocalStorageProvider (localStorage)
 * Future: CloudStorageProvider, HybridStorageProvider, etc.
 *
 * Swap the provider in App.tsx to change where data lives.
 * No UI or business logic changes required.
 */
export interface IStorageProvider {
  /* ── Collection CRUD ─────────────────────────────────────────────── */
  get<T extends StorageRecord>(key: string): Promise<T[]>;
  set<T extends StorageRecord>(key: string, data: T[]): Promise<void>;
  getById<T extends StorageRecord>(key: string, id: string): Promise<T | null>;
  save<T extends StorageRecord>(key: string, record: T): Promise<T>;
  softDelete(key: string, id: string): Promise<void>;
  undoSoftDelete(key: string, id: string): Promise<void>;
  hardDelete(key: string, id: string): Promise<void>; transaction?<T>(storeKeys: string[], mode: 'rw' | 'r', callback: () => Promise<T>): Promise<T>;
  /* ── Settings ────────────────────────────────────────────────────── */
  getSettings(): Promise<any>;
  saveSettings(settings: any): Promise<void>;

  /* ── Bulk operations ─────────────────────────────────────────────── */
  exportAll(): Promise<string>;
  importAll(json: string): Promise<boolean>;
  clearKey(key: string): Promise<void>;
  clearAll(): Promise<void>;
}
