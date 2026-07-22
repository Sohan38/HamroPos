import { createContext, useContext } from 'react';
import { IStorageProvider } from './IStorageProvider';
import { localStorageProvider } from './StorageService';

/**
 * React context for dependency-injecting the storage provider.
 *
 * Default: LocalStorageProvider (offline / localStorage).
 * Future: swap via <StorageProvider value={cloudProvider}> in App.tsx.
 */
const StorageContext = createContext<IStorageProvider>(localStorageProvider);

export const StorageProvider = StorageContext.Provider;

export function useStorageProvider(): IStorageProvider {
  return useContext(StorageContext);
}
