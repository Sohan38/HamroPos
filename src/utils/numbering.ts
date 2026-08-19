import { format } from 'date-fns';

type InvoiceLike = { invoiceNumber?: string | null; date?: string | null };
type BatchLike = { batchNumber?: string | null };
type BarcodeLike = { barcode?: string | null };

function slugify(value: string | null | undefined, maxLength = 4): string {
    const cleaned = (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    if (!cleaned) return 'GEN';

    const parts = cleaned.split('-').filter(Boolean);
    const compact = parts.join('').slice(0, maxLength);
    return compact.toUpperCase() || 'GEN';
}

function normalizeDate(value: Date | string): Date {
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getMonthCode(value: Date | string): string {
    const date = normalizeDate(value);
    return format(date, 'yyyyMM');
}

function getNextSequence(values: Array<string | null | undefined>, prefix: string): number {
    const sequences = values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map(value => value.trim())
        .filter(value => value.startsWith(prefix))
        .map(value => {
            const match = value.match(/(\d{4})$/);
            return match ? Number(match[1]) : null;
        })
        .filter((value): value is number => Number.isFinite(value));

    return sequences.length > 0 ? Math.max(...sequences) : 0;
}

export function generateProductBarcode(
    existingProducts: BarcodeLike[],
    length = 6,
): string {
    const requestedLength = Number.isFinite(length) ? Math.floor(length) : 6;
    const digitLength = Math.max(4, Math.min(12, requestedLength));
    const minimum = 10 ** (digitLength - 1);
    const maximum = (10 ** digitLength) - 1;
    const used = new Set(
        existingProducts
            .map(product => product.barcode?.trim())
            .filter((barcode): barcode is string => Boolean(barcode)),
    );
    const numericValues = existingProducts
        .map(product => product.barcode?.trim() ?? '')
        .filter(barcode => new RegExp(`^\\d{${digitLength}}$`).test(barcode))
        .map(Number)
        .filter(value => Number.isSafeInteger(value));
    const highestUsed = numericValues.length > 0 ? Math.max(...numericValues) : minimum - 1;
    const firstCandidate = highestUsed < maximum ? highestUsed + 1 : minimum;
    const candidateCount = maximum - minimum + 1;

    for (let offset = 0; offset < candidateCount; offset += 1) {
        const candidate = minimum + ((firstCandidate - minimum + offset) % candidateCount);
        const barcode = String(candidate);
        if (!used.has(barcode)) return barcode;
    }

    throw new Error(`No unused ${digitLength}-digit barcode is available.`);
}

export function generateSupplierInvoiceNumber(
    existingInvoices: InvoiceLike[],
    supplierName?: string | null,
    date: Date | string = new Date(),
): string {
    const supplierCode = slugify(supplierName, 4);
    const monthCode = getMonthCode(date);
    const prefix = `SINV-${supplierCode}-${monthCode}-`;
    const nextSequence = getNextSequence(existingInvoices.map(invoice => invoice.invoiceNumber), prefix) + 1;
    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

export function generateBatchNumber(
    existingBatches: BatchLike[],
    options: {
        productName?: string | null;
        supplierName?: string | null;
        date?: Date | string;
    } = {},
): string {
    const productCode = slugify(options.productName, 3);
    const supplierCode = slugify(options.supplierName, 3);
    const monthCode = getMonthCode(options.date ?? new Date());
    const prefix = `BAT-${productCode}-${supplierCode}-${monthCode}-`;
    const nextSequence = getNextSequence(existingBatches.map(batch => batch.batchNumber), prefix) + 1;
    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}
