import { Product, ProductBatch, ProductBatchLocation, InventoryLocationStock, InventoryMovement } from '@/types';

export interface StorageContextMutations {
  inventory: { items: Product[]; update: (id: string, updates: Partial<Product>) => Promise<any> | void | any };
  locationStocks: {
    items: InventoryLocationStock[];
    update: (id: string, updates: Partial<InventoryLocationStock>) => Promise<any> | void | any;
    add: (item: Omit<InventoryLocationStock, keyof import('@/types').StorageRecord>) => Promise<any> | void | any;
  };
  batches: { items: ProductBatch[]; update: (id: string, updates: Partial<ProductBatch>) => Promise<any> | void | any };
  batchLocations: {
    items: ProductBatchLocation[];
    update: (id: string, updates: Partial<ProductBatchLocation>) => Promise<any> | void | any;
    add: (item: Omit<ProductBatchLocation, keyof import('@/types').StorageRecord>) => Promise<any> | void | any;
  };
  movements?: {
    add: (item: Omit<InventoryMovement, keyof import('@/types').StorageRecord>) => Promise<any> | void | any;
  };
}

export class InventoryLedgerService {
  /**
   * Adjusts stock for a product, updating the product total, batches, location stock, and batch location allocations.
   * Can be used for sales (negative delta), purchases (positive delta), dispositions, or consumptions.
   */
  static async adjustStock(
    productId: string,
    locationId: string,
    delta: number,
    mutations: StorageContextMutations,
    options: {
      batchId?: string;
      supplierId?: string;
      notes?: string;
    } = {}
  ): Promise<void> {
    const now = new Date().toISOString();
    const product = mutations.inventory.items.find(p => p.id === productId);
    if (!product) throw new Error(`Product not found: ${productId}`);

    // 1. Update Product Total
    await mutations.inventory.update(productId, {
      quantity: Math.max(0, (product.quantity ?? 0) + delta),
    });

    // 2. Update Location Stock
    const existingLocStock = mutations.locationStocks.items.find(
      s => s.productId === productId && s.locationId === locationId && !s.deletedAt
    );
    if (existingLocStock) {
      await mutations.locationStocks.update(existingLocStock.id, {
        quantity: Math.max(0, Number(existingLocStock.quantity ?? 0) + delta),
        lastMovementAt: now,
      });
    } else {
      await mutations.locationStocks.add({
        productId,
        locationId,
        quantity: Math.max(0, delta),
        lastMovementAt: now,
        notes: options.notes,
      });
    }

    // 3. Update Batch (if product tracks batch / expiry)
    if (options.batchId) {
      const batch = mutations.batches.items.find(b => b.id === options.batchId);
      if (batch) {
        await mutations.batches.update(options.batchId, {
          quantity: Math.max(0, (batch.quantity ?? 0) + delta),
        });

        const existingBatchLoc = mutations.batchLocations.items.find(
          bl => bl.batchId === options.batchId && bl.locationId === locationId && !bl.deletedAt
        );
        if (existingBatchLoc) {
          await mutations.batchLocations.update(existingBatchLoc.id, {
            quantity: Math.max(0, Number(existingBatchLoc.quantity ?? 0) + delta),
          });
        } else {
          await mutations.batchLocations.add({
            batchId: options.batchId,
            locationId,
            quantity: Math.max(0, delta),
          });
        }
      }
    }
  }

  /**
   * Moves stock atomically from a source location to a destination location.
   */
  static async moveStock(
    productId: string,
    sourceLocationId: string,
    destinationLocationId: string,
    quantity: number,
    mutations: StorageContextMutations,
    options: {
      batchId?: string;
      notes?: string;
    } = {}
  ): Promise<void> {
    const now = new Date().toISOString();

    // 1. Source stock decrement
    const sourceLocStock = mutations.locationStocks.items.find(
      s => s.productId === productId && s.locationId === sourceLocationId && !s.deletedAt
    );
    if (sourceLocStock) {
      await mutations.locationStocks.update(sourceLocStock.id, {
        quantity: Math.max(0, Number(sourceLocStock.quantity ?? 0) - quantity),
        lastMovementAt: now,
      });
    }

    // 2. Destination stock increment
    const destLocStock = mutations.locationStocks.items.find(
      s => s.productId === productId && s.locationId === destinationLocationId && !s.deletedAt
    );
    if (destLocStock) {
      await mutations.locationStocks.update(destLocStock.id, {
        quantity: Number(destLocStock.quantity ?? 0) + quantity,
        lastMovementAt: now,
      });
    } else {
      await mutations.locationStocks.add({
        productId,
        locationId: destinationLocationId,
        quantity,
        lastMovementAt: now,
        notes: options.notes,
      });
    }

    // 3. Batch Location Allocation moves
    if (options.batchId) {
      const sourceBatchLoc = mutations.batchLocations.items.find(
        bl => bl.batchId === options.batchId && bl.locationId === sourceLocationId && !bl.deletedAt
      );
      if (sourceBatchLoc) {
        await mutations.batchLocations.update(sourceBatchLoc.id, {
          quantity: Math.max(0, Number(sourceBatchLoc.quantity ?? 0) - quantity),
        });
      }

      const destBatchLoc = mutations.batchLocations.items.find(
        bl => bl.batchId === options.batchId && bl.locationId === destinationLocationId && !bl.deletedAt
      );
      if (destBatchLoc) {
        await mutations.batchLocations.update(destBatchLoc.id, {
          quantity: Number(destBatchLoc.quantity ?? 0) + quantity,
        });
      } else {
        await mutations.batchLocations.add({
          batchId: options.batchId,
          locationId: destinationLocationId,
          quantity,
        });
      }
    }
  }
}
