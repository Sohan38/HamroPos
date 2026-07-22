import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useStorageProvider } from '../storage/StorageContext';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { validateDeletionConstraints } from '../utils/relationshipValidator';

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
    const storage = useStorageProvider();
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(() => {
      storage.get<any>(key).then((data) => {
        setItems(data.filter((i: any) => !i.deletedAt));
        setLoading(false);
      });
    }, [storage]);

    useEffect(() => {
      refresh();
    }, [refresh]);

    const add = useCallback(async (item: any) => {
      const newItem = {
        id: uuidv4(),
        ...item,
      };
      await storage.save(key, newItem);
      refresh();
    }, [storage, refresh]);

    const update = useCallback(async (id: string, updates: Partial<T>) => {
      const current = await storage.getById<any>(key, id);
      if (current) {
        await storage.save(key, { ...current, ...updates });
        refresh();
      }
    }, [storage, refresh]);

    const remove = useCallback(async (id: string) => {
      const errorMsg = await validateDeletionConstraints(key, id, storage);
      if (errorMsg) {
        toast.error(errorMsg);
        return;
      }
      await storage.softDelete(key, id);
      
      // Cascade delete batches if product is deleted
      if (key === 'inventory') {
        try {
          const batches = await storage.get<any>('productBatches');
          const productBatches = batches.filter((b: any) => b.productId === id);
          for (const batch of productBatches) {
            await storage.hardDelete('productBatches', batch.id);
          }
        } catch (err) {
          console.error("Failed to cascade delete product batches:", err);
        }
      }
      
      refresh();
    }, [storage, refresh]);

    const undoRemove = useCallback(async (id: string) => {
      await storage.undoSoftDelete(key, id);
      refresh();
    }, [storage, refresh]);

    const hardRemove = useCallback(async (id: string) => {
      const errorMsg = await validateDeletionConstraints(key, id, storage);
      if (errorMsg) {
        toast.error(errorMsg);
        return;
      }
      await storage.hardDelete(key, id);
      
      // Cascade delete batches if product is deleted
      if (key === 'inventory') {
        try {
          const batches = await storage.get<any>('productBatches');
          const productBatches = batches.filter((b: any) => b.productId === id);
          for (const batch of productBatches) {
            await storage.hardDelete('productBatches', batch.id);
          }
        } catch (err) {
          console.error("Failed to cascade delete product batches:", err);
        }
      }
      
      refresh();
    }, [storage, refresh]);

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
