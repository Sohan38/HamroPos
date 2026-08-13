import { Product, SupplierProductRecord } from '@/types';

export const DEFAULT_LOCATION_ID = 'loc-default';

export function normalizeSupplierStockLocationId(locationId?: string | null): string {
    const candidate = (locationId ?? DEFAULT_LOCATION_ID).trim();
    return candidate || DEFAULT_LOCATION_ID;
}

export function normalizeLegacySupplierStocks(
    supplierStocks?: SupplierProductRecord[] | null,
    fallbackLocationId?: string | null,
): SupplierProductRecord[] {
    if (!supplierStocks || supplierStocks.length === 0) return [];

    const resolvedFallback = normalizeSupplierStockLocationId(fallbackLocationId ?? DEFAULT_LOCATION_ID);
    const merged = new Map<string, SupplierProductRecord>();

    for (const stock of supplierStocks) {
        const supplierId = stock?.supplierId ?? '';
        const locationId = normalizeSupplierStockLocationId(stock?.locationId ?? resolvedFallback);
        const key = `${supplierId}::${locationId}`;
        const nextStock = {
            ...stock,
            supplierId,
            locationId,
            stock: Number(stock?.stock ?? 0),
            cost: Number(stock?.cost ?? 0),
        } as SupplierProductRecord;

        const current = merged.get(key);
        if (current) {
            current.stock = Number(current.stock || 0) + Number(nextStock.stock || 0);
            current.cost = current.cost || nextStock.cost;
            if (!current.lastPurchaseDate && nextStock.lastPurchaseDate) current.lastPurchaseDate = nextStock.lastPurchaseDate;
        } else {
            merged.set(key, nextStock);
        }
    }

    return Array.from(merged.values());
}

export function getSupplierStockRecord(
    product: Product | null | undefined,
    supplierId?: string | null,
    locationId?: string | null,
): SupplierProductRecord | undefined {
    if (!product || !supplierId) return undefined;
    const effectiveLocationId = normalizeSupplierStockLocationId(locationId ?? DEFAULT_LOCATION_ID);
    const stocks = normalizeLegacySupplierStocks(product.supplierStocks, effectiveLocationId);
    return stocks.find((stock) => stock.supplierId === supplierId && stock.locationId === effectiveLocationId);
}

export function getSupplierStocksForSupplier(
    product: Product | null | undefined,
    supplierId?: string | null,
    locationId?: string | null,
): SupplierProductRecord[] {
    if (!product || !supplierId) return [];
    const stocks = normalizeLegacySupplierStocks(product.supplierStocks, locationId ?? DEFAULT_LOCATION_ID);
    const effectiveLocationId = normalizeSupplierStockLocationId(locationId ?? DEFAULT_LOCATION_ID);
    return stocks.filter((stock) => stock.supplierId === supplierId && (locationId ? stock.locationId === effectiveLocationId : true));
}

export function getSupplierStockTotal(
    product: Product | null | undefined,
    supplierId?: string | null,
    locationId?: string | null,
): number {
    return getSupplierStocksForSupplier(product, supplierId, locationId).reduce((sum, stock) => sum + Number(stock.stock || 0), 0);
}

export function getProductSupplierStockTotal(product: Product | null | undefined): number {
    if (!product) return 0;
    return normalizeLegacySupplierStocks(product.supplierStocks).reduce((sum, stock) => sum + Number(stock.stock || 0), 0);
}

export function resolveLegacySupplierStockRecord(
    product: Product | null | undefined,
    supplierId?: string | null,
    locationId?: string | null,
    fallbackStock = 0,
): SupplierProductRecord | undefined {
    const stock = getSupplierStockRecord(product, supplierId, locationId);
    if (stock) return stock;

    if (!product || !supplierId) return undefined;

    const resolvedLocationId = normalizeSupplierStockLocationId(locationId ?? DEFAULT_LOCATION_ID);
    const record: SupplierProductRecord = {
        supplierId,
        locationId: resolvedLocationId,
        stock: Number(fallbackStock || 0),
        cost: Number(product.purchaseRate || 0),
    };
    return record;
}
