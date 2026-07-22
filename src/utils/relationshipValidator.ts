import { IStorageProvider } from '../storage/IStorageProvider';

/**
 * Validates whether an entity can be deleted based on active relationship constraints.
 * Returns an error message string if deletion is blocked, or null if it is safe to proceed.
 */
export async function validateDeletionConstraints(
  key: string,
  id: string,
  storage: IStorageProvider
): Promise<string | null> {
  try {
    if (key === 'inventory') {
      // Check sales
      const sales = await storage.get<any>('sales');
      for (const sale of sales) {
        if (sale.items?.some((item: any) => item.productId === id)) {
          return 'Cannot delete product: it is referenced in historical sales invoices.';
        }
      }

      // Check purchases
      const purchases = await storage.get<any>('purchases');
      for (const purchase of purchases) {
        if (purchase.items?.some((item: any) => item.productId === id)) {
          return 'Cannot delete product: it is referenced in historical purchase invoices.';
        }
      }
    }

    if (key === 'suppliers') {
      const purchases = await storage.get<any>('purchases');
      if (purchases.some((p: any) => p.supplierId === id)) {
        return 'Cannot delete supplier: they have associated purchase invoices.';
      }
    }

    if (key === 'customers') {
      const sales = await storage.get<any>('sales');
      if (sales.some((s: any) => s.customerId === id)) {
        return 'Cannot delete customer: they have associated sales invoices.';
      }

      const credit = await storage.get<any>('credit');
      if (credit.some((c: any) => c.customerId === id)) {
        return 'Cannot delete customer: they have associated credit records.';
      }
    }

    if (key === 'hotelRooms') {
      const room = await storage.getById<any>('hotelRooms', id);
      if (room && ['occupied', 'reserved'].includes(room.status)) {
        return `Cannot delete room: it is currently occupied or reserved.`;
      }
      
      const hotelBills = await storage.get<any>('hotelBills');
      if (hotelBills.some((b: any) => b.roomId === id)) {
        return 'Cannot delete room: it is referenced in historical hotel bills.';
      }
    }
  } catch (error) {
    console.error('Error validating deletion constraints:', error);
  }

  return null;
}
