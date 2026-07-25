import { v4 as uuidv4 } from 'uuid';
import {
    Product,
    ProductBatch,
    PurchaseInvoice,
    PurchaseItem,
    PurchaseStatus,
} from '@/types';
import { IStorageProvider } from '@/storage/IStorageProvider';

/**
 * Purchase inventory transitions live here instead of in the form component.
 * This keeps receiving, editing, cancelling, and deleting a purchase on the
 * same path and prevents UI actions from applying stock twice.
 */

export type PurchaseInput = Omit<
    PurchaseInvoice,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'
> & { id?: string };

const received = (purchase?: PurchaseInvoice | null) =>
    (purchase?.status ?? 'received') === 'received';

const active = (purchase: PurchaseInvoice) => !purchase.deletedAt;

function now() {
    return new Date().toISOString();
}

function normalizeItem(item: PurchaseItem): PurchaseItem {
    const quantity = Number(item.quantity);
    const purchaseRate = Number(item.purchaseRate);
    return {
        ...item,
        quantity,
        purchaseRate,
        subtotal: quantity * purchaseRate,
    };
}

function getSupplierIds(product: Product) {
    return Array.from(new Set(
        (product.supplierIds?.length
            ? product.supplierIds
            : product.supplierId
                ? [product.supplierId]
                : []).filter(Boolean)
    ));
}

function ensureSupplierRecords(product: Product, supplierId: string, legacyPrimaryStock = product.quantity) {
    const ids = getSupplierIds(product);
    const supplierIds = ids.includes(supplierId) ? ids : [...ids, supplierId];
    const existing = product.supplierStocks ?? [];
    const records = [...existing];

    // Older products predate per-supplier stock. Preserve their current stock
    // against their primary supplier before adding a second supplier.
    if (records.length === 0 && ids[0]) {
        records.push({
            supplierId: ids[0],
            cost: product.purchaseRate,
            stock: legacyPrimaryStock,
        });
    }

    for (const id of supplierIds) {
        if (!records.some(record => record.supplierId === id)) {
            records.push({ supplierId: id, cost: product.purchaseRate, stock: 0 });
        }
    }

    return { supplierIds, records };
}

function getBatchForPurchase(
    batches: ProductBatch[],
    purchase: PurchaseInvoice,
    item: PurchaseItem,
    itemIndex: number,
) {
    if (item.batchId) return batches.find(batch => batch.id === item.batchId);
    const matching = batches.filter(batch =>
        batch.purchaseInvoiceId === purchase.id &&
        batch.productId === item.productId
    );
    return matching[itemIndex] ?? matching[0];
}

function revertPurchase(
    inventory: Product[],
    batches: ProductBatch[],
    purchase: PurchaseInvoice,
) {
    purchase.items.forEach((rawItem, index) => {
        const item = normalizeItem(rawItem);
        const product = inventory.find(candidate => candidate.id === item.productId && !candidate.deletedAt);
        if (!product) return;

        if (product.quantity < item.quantity) {
            throw new Error(`Cannot reverse ${purchase.invoiceNumber || 'this purchase'}: ${product.name} has already used some received stock.`);
        }

        product.quantity -= item.quantity;
        const supplierState = ensureSupplierRecords(product, purchase.supplierId);
        const supplierRecord = supplierState.records.find(record => record.supplierId === purchase.supplierId);
        if (supplierRecord) {
            if (supplierRecord.stock < item.quantity) {
                throw new Error(`Cannot reverse ${purchase.invoiceNumber || 'this purchase'}: supplier stock for ${product.name} is lower than the received quantity.`);
            }
            supplierRecord.stock -= item.quantity;
        }
        product.supplierIds = supplierState.supplierIds;
        product.supplierId = supplierState.supplierIds[0] ?? '';
        product.supplierStocks = supplierState.records;

        const batch = getBatchForPurchase(batches, purchase, item, index);
        if (batch) {
            if (batch.quantity !== batch.initialQuantity) {
                throw new Error(`Cannot change ${purchase.invoiceNumber || 'this purchase'}: batch ${batch.batchNumber} has already been partially sold or adjusted.`);
            }
            const batchIndex = batches.findIndex(candidate => candidate.id === batch.id);
            if (batchIndex >= 0) batches.splice(batchIndex, 1);
        }
    });
}

function applyPurchase(
    inventory: Product[],
    batches: ProductBatch[],
    purchase: PurchaseInvoice,
): PurchaseInvoice {
    const items = purchase.items.map(normalizeItem);

    items.forEach((item, index) => {
        if (item.quantity <= 0) throw new Error(`${item.productName} must have a quantity greater than zero.`);
        if (item.purchaseRate < 0) throw new Error(`${item.productName} cannot have a negative purchase cost.`);

        const product = inventory.find(candidate => candidate.id === item.productId && !candidate.deletedAt);
        if (!product) throw new Error(`Product "${item.productName}" no longer exists.`);

        const previousQuantity = product.quantity;
        const supplierState = ensureSupplierRecords(product, purchase.supplierId, previousQuantity);
        product.quantity += item.quantity;
        const supplierRecord = supplierState.records.find(record => record.supplierId === purchase.supplierId);
        if (!supplierRecord) throw new Error(`Supplier stock could not be initialized for ${product.name}.`);
        supplierRecord.stock += item.quantity;
        supplierRecord.cost = item.purchaseRate;
        supplierRecord.lastPurchaseDate = purchase.date;

        product.supplierIds = supplierState.supplierIds;
        product.supplierId = supplierState.supplierIds[0] ?? '';
        product.supplierStocks = supplierState.records;

        if (product.hasExpiry) {
            const batch: ProductBatch = {
                id: uuidv4(),
                productId: product.id,
                supplierId: purchase.supplierId,
                purchaseInvoiceId: purchase.id,
                batchNumber: item.batchNumber?.trim() || `B-${new Date(purchase.date).getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`,
                manufacturingDate: item.manufacturingDate ?? null,
                expiryMonths: item.expiryMonths ?? null,
                expiryDate: item.expiryDate ?? null,
                initialQuantity: item.quantity,
                quantity: item.quantity,
                purchaseRate: item.purchaseRate,
                notes: item.notes ?? '',
                createdAt: now(),
                updatedAt: now(),
                deletedAt: null,
                version: 1,
            };
            batches.push(batch);
            items[index] = { ...item, batchId: batch.id, batchNumber: batch.batchNumber };
        }
    });

    return { ...purchase, items };
}

function syncTotals(inventory: Product[]) {
    for (const product of inventory) {
        if (product.deletedAt) continue;
        const records = product.supplierStocks ?? [];
        const ids = getSupplierIds(product);
        if (ids.length > 1 || records.length > 1) {
            product.quantity = records.reduce((total, record) => total + Math.max(0, Number(record.stock) || 0), 0);
        }
        product.profitPerUnit = product.sellingRate - product.purchaseRate;
    }
}

function syncLatestCosts(inventory: Product[], purchases: PurchaseInvoice[]) {
    const latest = new Map<string, { date: string; rate: number }>();
    const supplierLatest = new Map<string, { date: string; rate: number }>();

    for (const purchase of purchases.filter(active).filter(received)) {
        for (const item of purchase.items) {
            const key = item.productId;
            const current = latest.get(key);
            if (!current || purchase.date >= current.date) latest.set(key, { date: purchase.date, rate: item.purchaseRate });

            const supplierKey = `${purchase.supplierId}:${item.productId}`;
            const supplierCurrent = supplierLatest.get(supplierKey);
            if (!supplierCurrent || purchase.date >= supplierCurrent.date) {
                supplierLatest.set(supplierKey, { date: purchase.date, rate: item.purchaseRate });
            }
        }
    }

    for (const product of inventory) {
        if (product.deletedAt) continue;
        const latestProduct = latest.get(product.id);
        if (latestProduct) product.purchaseRate = latestProduct.rate;
        for (const record of product.supplierStocks ?? []) {
            const latestSupplier = supplierLatest.get(`${record.supplierId}:${product.id}`);
            if (latestSupplier) record.cost = latestSupplier.rate;
            product.profitPerUnit = product.sellingRate - product.purchaseRate;
        }
    }
}

function makePurchase(input: PurchaseInput, existing?: PurchaseInvoice): PurchaseInvoice {
    const timestamp = now();
    const items = input.items.map(normalizeItem);
    return {
        ...input,
        id: existing?.id ?? input.id ?? uuidv4(),
        items,
        status: input.status ?? 'received',
        paymentStatus: input.paymentStatus ?? 'unpaid',
        paidAmount: Number(input.paidAmount) || 0,
        discount: Number(input.discount) || 0,
        tax: Number(input.tax) || 0,
        grandTotal: Number(input.grandTotal) || 0,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        version: (existing?.version ?? 0) + 1,
    };
}

async function persistTransition(
    storage: IStorageProvider,
    previous: PurchaseInvoice | null,
    candidate: PurchaseInvoice,
    allPurchases: PurchaseInvoice[],
) {
    const inventory = await storage.get<Product>('inventory');
    const batches = await storage.get<ProductBatch>('productBatches');

    if (previous && active(previous) && received(previous)) {
        revertPurchase(inventory, batches, previous);
    }

    let saved = candidate;
    if (active(candidate) && received(candidate)) {
        saved = applyPurchase(inventory, batches, candidate);
    }

    const nextPurchases = allPurchases.filter(purchase => purchase.id !== candidate.id);
    nextPurchases.push(saved);
    syncTotals(inventory);
    syncLatestCosts(inventory, nextPurchases);

    await storage.set('inventory', inventory);
    await storage.set('productBatches', batches);
    await storage.set('purchases', nextPurchases);
    return saved;
}

export async function createPurchase(storage: IStorageProvider, input: PurchaseInput) {
    const purchases = await storage.get<PurchaseInvoice>('purchases');
    const candidate = makePurchase(input);
    return persistTransition(storage, null, candidate, purchases);
}

export async function updatePurchase(storage: IStorageProvider, id: string, input: PurchaseInput) {
    const purchases = await storage.get<PurchaseInvoice>('purchases');
    const previous = purchases.find(purchase => purchase.id === id && active(purchase));
    if (!previous) throw new Error('Purchase not found.');
    const candidate = makePurchase({ ...input, id }, previous);
    return persistTransition(storage, previous, candidate, purchases);
}

export async function deletePurchase(storage: IStorageProvider, id: string) {
    const purchases = await storage.get<PurchaseInvoice>('purchases');
    const previous = purchases.find(purchase => purchase.id === id && active(purchase));
    if (!previous) throw new Error('Purchase not found.');
    const candidate = {
        ...previous,
        status: 'cancelled' as PurchaseStatus,
        deletedAt: now(),
        updatedAt: now(),
        version: previous.version + 1,
    };
    return persistTransition(storage, previous, candidate, purchases);
}
