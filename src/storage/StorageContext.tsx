import { createContext, useContext } from 'react';
import { IStorageProvider } from './IStorageProvider';
import { dexieProvider } from './DexieProvider';

/**
 * React context for dependency-injecting the storage provider.
 *
 * Default: DexieProvider (Dexie v4 → IndexedDB — async, high-quota, non-blocking).
 *   - Web: native browser IndexedDB
 *   - Android Capacitor WebView: app-private IndexedDB, not subject to browser eviction
 *
 * Future: swap via <StorageProvider value={sqliteProvider}> in App.tsx
 *   when a native SQLite plugin is added. Zero UI changes required.
 *
 * Legacy LocalStorageProvider in StorageService.ts remains intact
 * and is still exported as `storageService` for any direct legacy access.
 */
const StorageContext = createContext<IStorageProvider>(dexieProvider);

export const StorageProvider = StorageContext.Provider;

export function useStorageProvider(): IStorageProvider {
  return useContext(StorageContext);
}
