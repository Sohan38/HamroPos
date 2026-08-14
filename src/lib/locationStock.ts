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

    const legacyLocationStock = product.supplierStocks?.reduce((sum, stock) => {
        if ((stock.locationId || 'loc-default') === normalizedLocationId) {
            return sum + Number(stock.stock ?? 0);
        }
        return sum;
    }, 0);

    return Number(legacyLocationStock ?? 0);
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

    for (const stock of product.supplierStocks ?? []) {
        const locationId = normalizeLocationId(stock.locationId);
        const current = byLocation.get(locationId) ?? 0;
        byLocation.set(locationId, current + Number(stock.stock ?? 0));
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
