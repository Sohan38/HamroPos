import { InventoryLocationStock, Location, Product } from '@/types';

export function normalizeLocationId(locationId?: string | null): string {
    const trimmed = (locationId ?? 'loc-default').trim();
    return trimmed || 'loc-default';
}

export function getLocationStockForProduct(
    product: Product | null | undefined,
    locationId: string | null | undefined,
    locationStocks: InventoryLocationStock[] = [],
): number {
    if (!product) return 0;
    const normalizedLocationId = normalizeLocationId(locationId);
    const record = locationStocks.find(
        (stock) => stock.productId === product.id && stock.locationId === normalizedLocationId,
    );

    if (record) return Number(record.quantity ?? 0);

    return 0;
}

/**
 * Sum stock across ALL locations for a product.
 * Falls back to product.quantity only when no location-stock records exist
 * (i.e. the startup migration hasn't run yet for this product).
 */
export function getTotalStockAcrossLocations(
    product: Product | null | undefined,
    locationStocks: InventoryLocationStock[] = [],
): number {
    if (!product) return 0;
    const productRecords = locationStocks.filter(
        (s) => s.productId === product.id,
    );
    if (productRecords.length === 0) return Number(product.quantity ?? 0);
    return productRecords.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
}

export function getProductLocationStockSummary(
    product: Product | null | undefined,
    locations: Location[] = [],
    locationStocks: InventoryLocationStock[] = [],
): Array<{ locationId: string; locationName: string; quantity: number }> {
    if (!product) return [];

    const byLocation = new Map<string, number>();

    for (const stock of locationStocks) {
        if (stock.productId !== product.id) continue;
        const normalizedLocationId = normalizeLocationId(stock.locationId);
        byLocation.set(normalizedLocationId, Number(stock.quantity ?? 0));
    }

    const knownLocations = locations.length > 0 ? locations : [{ id: 'loc-default', name: 'Main Location' } as Location];

    return knownLocations
        .filter((location) => (location.status ?? 'active') !== 'inactive')
        .map((location) => ({
            locationId: location.id,
            locationName: location.name,
            quantity: byLocation.get(location.id) ?? 0,
        }))
        .filter((entry) => entry.quantity > 0 || entry.locationId === 'loc-default');
}

/**
 * Shared helper: Get active batches for a product at a specific location, optionally filtered by supplier.
 */
export function getProductBatchesAtLocation(
    productId: string,
    locationId: string | null | undefined,
    batches: any[],
    batchLocations: any[],
    supplierId?: string,
): Array<{ batch: any; available: number }> {
    if (!productId || !locationId) return [];
    const normalizedLocationId = normalizeLocationId(locationId);

    return batches
        .filter((batch) => {
            if (batch.productId !== productId || batch.deletedAt) return false;
            if (supplierId && batch.supplierId !== supplierId) return false;
            return true;
        })
        .map((batch) => {
            const locationAllocation = batchLocations.find(
                (bl) => bl.batchId === batch.id && bl.locationId === normalizedLocationId && !bl.deletedAt,
            );
            return {
                batch,
                available: Number(locationAllocation?.quantity ?? 0),
            };
        })
        .filter((entry) => entry.available > 0)
        .sort((a, b) => {
            const aExpiry = a.batch.expiryDate ? new Date(a.batch.expiryDate).getTime() : Infinity;
            const bExpiry = b.batch.expiryDate ? new Date(b.batch.expiryDate).getTime() : Infinity;
            return aExpiry - bExpiry;
        });
}

/**
 * Shared helper: Get list of suppliers that have stock for this product at a specific location.
 */
export function getSuppliersForProductAtLocation(
    productId: string,
    locationId: string | null | undefined,
    product: Product | null | undefined,
    suppliers: any[],
    batches: any[],
    batchLocations: any[],
): any[] {
    if (!productId || !locationId || !product) return [];
    const normalizedLocationId = normalizeLocationId(locationId);

    const ids = product.supplierIds?.length
        ? product.supplierIds
        : product.supplierId
        ? [product.supplierId]
        : [];
    const allProductSuppliers = suppliers.filter((supplier) => ids.includes(supplier.id));

    return allProductSuppliers.filter((supplier) => {
        const supplierBatches = batches.filter(
            (b) => b.productId === productId && b.supplierId === supplier.id && !b.deletedAt,
        );
        for (const batch of supplierBatches) {
            const batchLocationAlloc = batchLocations.find(
                (bl) => bl.batchId === batch.id && bl.locationId === normalizedLocationId && !bl.deletedAt,
            );
            if (batchLocationAlloc && Number(batchLocationAlloc.quantity ?? 0) > 0) {
                return true;
            }
        }
        return false;
    });
}

/**
 * Shared helper: Get available stock for a product at a location filtered by supplier and batch.
 */
export function getAvailableStockForSelector(
    productId: string,
    locationId: string | null | undefined,
    supplierId: string | undefined,
    batchId: string | undefined,
    product: Product | null | undefined,
    locationStocks: any[],
    batches: any[],
    batchLocations: any[],
): number {
    if (!productId || !locationId || !product) return 0;
    const normalizedLocationId = normalizeLocationId(locationId);

    if (batchId) {
        const batchLocationAlloc = batchLocations.find(
            (bl) => bl.batchId === batchId && bl.locationId === normalizedLocationId && !bl.deletedAt,
        );
        return Number(batchLocationAlloc?.quantity ?? 0);
    }

    if (supplierId) {
        const supplierBatches = batches.filter(
            (b) => b.productId === productId && b.supplierId === supplierId && !b.deletedAt,
        );
        let supplierStockAtLocation = 0;
        for (const batch of supplierBatches) {
            const batchLocationAlloc = batchLocations.find(
                (bl) => bl.batchId === batch.id && bl.locationId === normalizedLocationId && !bl.deletedAt,
            );
            supplierStockAtLocation += Number(batchLocationAlloc?.quantity ?? 0);
        }
        return supplierStockAtLocation;
    }

    return getLocationStockForProduct(product, normalizedLocationId, locationStocks);
}
