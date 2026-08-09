import { IStorageProvider } from '@/storage/IStorageProvider';
import { createPurchase } from './purchaseService';
import { generateSupplierInvoiceNumber } from '@/utils/numbering';
import { Product } from '@/types';

export type CreatePurchaseForStockOpts = {
    productId: string;
    quantity: number;
    supplierId?: string | null;
    supplierName?: string | null;
    purchaseRate?: number | null;
    date?: string | Date | null;
    invoiceNumber?: string | null;
    notes?: string | null;
    batchId?: string | null;
    batchNumber?: string | null;
    manufacturingDate?: string | null;
    expiryMonths?: number | null;
    expiryDate?: string | null;
};

export async function createPurchaseForStockIncrease(storage: IStorageProvider, opts: CreatePurchaseForStockOpts) {
    const qty = Number(opts.quantity || 0);
    if (qty <= 0) return null;

    const inventory = await storage.get<Product>('inventory');
    const purchases = await storage.get<any>('purchases');

    const product = inventory.find(p => p.id === opts.productId);
    const supplierId = opts.supplierId || product?.supplierId || product?.supplierIds?.[0] || '';
    if (!supplierId) return null;

    // Resolve supplier name from storage if not explicitly provided so numbering matches purchases form
    const suppliers = await storage.get<any>('suppliers');
    const resolvedSupplierName = opts.supplierName ?? suppliers.find((s: any) => s.id === supplierId)?.name ?? null;
    const invoice = (opts.invoiceNumber || '').trim() || generateSupplierInvoiceNumber(purchases, resolvedSupplierName ?? '', opts.date ?? new Date());
    const dateIso = opts.date ? (opts.date instanceof Date ? opts.date.toISOString() : new Date(opts.date).toISOString()) : new Date().toISOString();

    const rate = Number(opts.purchaseRate ?? product?.purchaseRate ?? 0) || 0;
    const subtotal = qty * rate;

    const item = {
        productId: opts.productId,
        productName: product?.name || 'Unknown',
        quantity: qty,
        purchaseRate: rate,
        subtotal,
        notes: opts.notes || '',
        batchId: opts.batchId ?? undefined,
        batchNumber: opts.batchNumber ?? undefined,
        manufacturingDate: opts.manufacturingDate ?? undefined,
        expiryMonths: opts.expiryMonths ?? undefined,
        expiryDate: opts.expiryDate ?? undefined,
    } as any;

    const payload = {
        invoiceNumber: invoice,
        supplierId,
        supplierName: resolvedSupplierName ?? null,
        date: dateIso,
        items: [item],
        discount: 0,
        tax: 0,
        grandTotal: subtotal,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
        paidAmount: 0,
        referenceNumber: undefined,
        notes: opts.notes || '',
        status: 'received' as const,
    };

    return createPurchase(storage, payload as any);
}

export type CreatePurchaseForNewItemOpts = {
    productId: string;
    quantity: number;
    supplierId?: string | null;
    supplierName?: string | null;
    purchaseRate?: number | null;
    date?: string | Date | null;
    invoiceNumber?: string | null;
    notes?: string | null;
    batchId?: string | null;
    batchNumber?: string | null;
    manufacturingDate?: string | null;
    expiryMonths?: number | null;
    expiryDate?: string | null;
};

async function buildPurchasePayloadsForNewItems(storage: IStorageProvider, optsList: CreatePurchaseForNewItemOpts[]) {
    const inventory = await storage.get<Product>('inventory');
    const purchases = await storage.get<any>('purchases');
    const suppliers = await storage.get<any>('suppliers');

    const payloads: Array<any> = [];

    for (const opts of optsList) {
        const qty = Number(opts.quantity || 0);
        if (qty <= 0) continue;

        const product = inventory.find((item: Product) => item.id === opts.productId);
        const supplierId = opts.supplierId ?? product?.supplierId ?? product?.supplierIds?.[0] ?? '';
        const resolvedSupplierName = opts.supplierName ?? suppliers.find((supplier: any) => supplier.id === supplierId)?.name ?? null;
        const invoice = (opts.invoiceNumber || '').trim() || generateSupplierInvoiceNumber(purchases, resolvedSupplierName ?? '', opts.date ?? new Date());
        const dateIso = opts.date ? (opts.date instanceof Date ? opts.date.toISOString() : new Date(opts.date).toISOString()) : new Date().toISOString();
        const rate = Number(opts.purchaseRate ?? product?.purchaseRate ?? 0) || 0;
        const subtotal = qty * rate;

        const item = {
            productId: opts.productId,
            productName: product?.name || 'Unknown',
            quantity: qty,
            purchaseRate: rate,
            subtotal,
            notes: opts.notes || '',
            batchId: opts.batchId ?? undefined,
            batchNumber: opts.batchNumber ?? undefined,
            manufacturingDate: opts.manufacturingDate ?? undefined,
            expiryMonths: opts.expiryMonths ?? undefined,
            expiryDate: opts.expiryDate ?? undefined,
        } as any;

        payloads.push({
            invoiceNumber: invoice,
            supplierId,
            supplierName: resolvedSupplierName ?? null,
            date: dateIso,
            items: [item],
            discount: 0,
            tax: 0,
            grandTotal: subtotal,
            paymentMethod: 'cash',
            paymentStatus: 'unpaid',
            paidAmount: 0,
            referenceNumber: undefined,
            notes: opts.notes || '',
            status: 'received' as const,
        });
    }

    return payloads;
}

export async function createPurchaseForNewItem(storage: IStorageProvider, opts: CreatePurchaseForNewItemOpts) {
    const [payload] = await buildPurchasePayloadsForNewItems(storage, [opts]);
    if (!payload) {
        return null;
    }

    return createPurchase(storage, payload as any);
}

export async function createPurchasesForNewItem(storage: IStorageProvider, optsList: CreatePurchaseForNewItemOpts[]) {
    const payloads = await buildPurchasePayloadsForNewItems(storage, optsList);
    const createdPurchases: Array<any> = [];

    for (const payload of payloads) {
        try {
            const created = await createPurchase(storage, payload as any);
            if (created) {
                createdPurchases.push(created);
            }
        } catch (error) {
            console.error('Failed to create purchase for new item:', error);
        }
    }

    return createdPurchases;
}
