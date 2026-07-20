import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storageService } from '../storage/StorageService';
import { v4 as uuidv4 } from 'uuid';

export function createStorageContext<T extends { id: string }>(key: string) {
  interface ContextType {
    items: T[];
    loading: boolean;
    add: (item: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deletedAt'>) => void;
    update: (id: string, item: Partial<T>) => void;
    remove: (id: string) => void;
    undoRemove: (id: string) => void;
    hardRemove: (id: string) => void;
    refresh: () => void;
  }

  const Context = createContext<ContextType | undefined>(undefined);

  function Provider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(() => {
      const data = storageService.get<any>(key);
      setItems(data.filter((i: any) => !i.deletedAt));
      setLoading(false);
    }, []);

    useEffect(() => {
      refresh();
    }, [refresh]);

    const add = useCallback((item: any) => {
      const newItem = {
        ...item,
        id: uuidv4(),
      };
      storageService.save(key, newItem);
      refresh();
    }, [refresh]);

    const update = useCallback((id: string, updates: Partial<T>) => {
      const current = storageService.getById<any>(key, id);
      if (current) {
        storageService.save(key, { ...current, ...updates });
        refresh();
      }
    }, [refresh]);

    const remove = useCallback((id: string) => {
      storageService.softDelete(key, id);
      refresh();
    }, [refresh]);

    const undoRemove = useCallback((id: string) => {
      storageService.undoSoftDelete(key, id);
      refresh();
    }, [refresh]);

    const hardRemove = useCallback((id: string) => {
      storageService.hardDelete(key, id);
      refresh();
    }, [refresh]);

    return (
      <Context.Provider value={{ items, loading, add, update, remove, undoRemove, hardRemove, refresh }}>
        {children}
      </Context.Provider>
    );
  }

  function useStorage() {
    const context = useContext(Context);
    if (context === undefined) {
      throw new Error(`use${key} must be used within its Provider`);
    }
    return context;
  }

  return { Provider, useStorage, Context };
}
