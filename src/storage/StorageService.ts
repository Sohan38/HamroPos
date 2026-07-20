import { StorageRecord } from '../types';

export class StorageService {
  private readonly KEY_PREFIX = 'sohan_';
  private readonly SCHEMA_VERSION = 1;

  private getFullKey(key: string): string {
    return `${this.KEY_PREFIX}${key}`;
  }

  get<T extends StorageRecord>(key: string): T[] {
    try {
      const data = localStorage.getItem(this.getFullKey(key));
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error);
      return [];
    }
  }

  set<T extends StorageRecord>(key: string, data: T[]): void {
    try {
      localStorage.setItem(this.getFullKey(key), JSON.stringify(data));
    } catch (error) {
      console.error(`Error writing ${key} to storage:`, error);
    }
  }

  getById<T extends StorageRecord>(key: string, id: string): T | null {
    const items = this.get<T>(key);
    return items.find((item) => item.id === id && !item.deletedAt) || null;
  }

  save<T extends StorageRecord>(key: string, record: T): T {
    const items = this.get<T>(key);
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
    
    this.set(key, items);
    return items[existingIndex >= 0 ? existingIndex : items.length - 1];
  }

  softDelete(key: string, id: string): void {
    const items = this.get<StorageRecord>(key);
    const existingIndex = items.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      items[existingIndex].deletedAt = new Date().toISOString();
      items[existingIndex].updatedAt = new Date().toISOString();
      items[existingIndex].version += 1;
      this.set(key, items);
    }
  }
  
  undoSoftDelete(key: string, id: string): void {
    const items = this.get<StorageRecord>(key);
    const existingIndex = items.findIndex((item) => item.id === id);
    if (existingIndex >= 0) {
      items[existingIndex].deletedAt = null;
      items[existingIndex].updatedAt = new Date().toISOString();
      items[existingIndex].version += 1;
      this.set(key, items);
    }
  }

  hardDelete(key: string, id: string): void {
    const items = this.get<StorageRecord>(key);
    this.set(key, items.filter(item => item.id !== id));
  }

  exportAll(): string {
    const data: Record<string, any> = {
      _meta: {
        version: this.SCHEMA_VERSION,
        exportedAt: new Date().toISOString()
      }
    };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.KEY_PREFIX)) {
        try {
          data[k] = JSON.parse(localStorage.getItem(k) || '[]');
        } catch {
          // Ignore unparseable
        }
      }
    }
    return JSON.stringify(data);
  }

  importAll(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data._meta || !data._meta.version) {
        throw new Error("Invalid backup file: Missing metadata");
      }
      
      // Clear existing first
      this.clearAll();
      
      for (const [k, v] of Object.entries(data)) {
        if (k !== '_meta' && k.startsWith(this.KEY_PREFIX)) {
          localStorage.setItem(k, JSON.stringify(v));
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to import data", error);
      return false;
    }
  }

  clearKey(key: string): void {
    localStorage.removeItem(this.getFullKey(key));
  }
  
  clearAll(): void {
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
  }
  
  getSettings(): any {
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
      language: 'en'
    };
    
    try {
      const raw = localStorage.getItem(`${this.KEY_PREFIX}settings`);
      if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
    } catch {
      // Ignore
    }
    return defaultSettings;
  }
  
  saveSettings(settings: any): void {
    localStorage.setItem(`${this.KEY_PREFIX}settings`, JSON.stringify(settings));
  }
}

export const storageService = new StorageService();
