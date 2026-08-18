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
