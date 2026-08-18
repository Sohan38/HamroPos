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
    // MIGRATION CONTRACT: Legacy products without explicit locationId are treated as belonging to 'loc-default'.
    // This preserves backward compatibility with inventory created before location support.
    // Products must be explicitly assigned to other locations via InventoryLocationStock records.

    if (!product) return 0;
    const normalizedLocationId = normalizeLocationId(locationId);
    const record = locationStocks.find(
        (stock) => stock.productId === product.id && stock.locationId === normalizedLocationId,
    );

    if (record) return Number(record.quantity ?? 0);

    // Fallback: check legacy supplierStocks with explicit location assignment
    const legacyLocationStock = product.supplierStocks?.reduce((sum, stock) => {
        if ((stock.locationId || 'loc-default') === normalizedLocationId) {
            return sum + Number(stock.stock ?? 0);
        }
        return sum;
    }, 0);

    const legacy = Number(legacyLocationStock ?? 0);
    return Math.min(legacy, product.quantity);
}

export function getProductLocationStockSummary(
    product: Product | null | undefined,
    locations: Location[] = [],
    locationStocks: InventoryLocationStock[] = [],
): Array<{ locationId: string; locationName: string; quantity: number }> {
    if (!product) return [];

    const byLocation = new Map<string, number>();

    // Collect location IDs that have explicit InventoryLocationStock records
    const hasExplicitRecord = new Set<string>();

    for (const stock of locationStocks) {
        if (stock.productId !== product.id) continue;
        const normalizedLocationId = normalizeLocationId(stock.locationId);
        byLocation.set(normalizedLocationId, Number(stock.quantity ?? 0));
        hasExplicitRecord.add(normalizedLocationId);
    }

    // Only use supplierStocks as a FALLBACK for locations without an InventoryLocationStock record.
    // When both exist (e.g. after stock was moved between locations), the InventoryLocationStock
    // record is the source of truth and supplierStocks must not be added on top.
    for (const stock of product.supplierStocks ?? []) {
        const locationId = normalizeLocationId(stock.locationId);
        if (hasExplicitRecord.has(locationId)) continue; // already tracked — skip to avoid double-count
        const current = byLocation.get(locationId) ?? 0;
        byLocation.set(locationId, current + Number(stock.stock ?? 0));
    }

    // Cap legacy fallback totals to product.quantity.
    // When no InventoryLocationStock records exist, the sum of supplierStocks
    // may exceed the current product.quantity (sales/consumption only deducted
    // from product.quantity, not from supplierStocks).
    if (hasExplicitRecord.size === 0 && byLocation.size > 0) {
        const totalLegacy = Array.from(byLocation.values()).reduce((a, b) => a + b, 0);
        if (totalLegacy > product.quantity) {
            const ratio = product.quantity / totalLegacy;
            for (const [key, value] of byLocation) {
                byLocation.set(key, Math.round(value * ratio));
            }
        }
    }

    const knownLocations = locations.length > 0 ? locations : [{ id: 'loc-default', name: 'Main Location' } as Location];

    return knownLocations
        .filter((location) => (location.status ?? 'active') !== 'inactive')
        .map((location) => ({
            locationId: location.id,
            locationName: location.name,
            quantity: byLocation.get(location.id) ?? getLocationStockForProduct(product, location.id, locationStocks),
        }))
        .filter((entry) => entry.quantity > 0 || entry.locationId === 'loc-default' || byLocation.has(entry.locationId));
}
