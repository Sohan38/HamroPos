import { normalize } from './normalize';

export interface SearchableItem {
    name: string;
    barcode?: string | null;
    category?: string | null;
    phone?: string | null;
}

export function getSearchScore<T extends SearchableItem>(
    item: T,
    query: string
): number {
    if (!query.trim()) return 0;

    const q = normalize(query);

    const rawName = item.name.toLowerCase().trim();
    const normalizedName = normalize(item.name);

    const barcode = normalize(item.barcode);
    const category = normalize(item.category);
    const phone = normalize(item.phone);

    // Highest priority: exact barcode or phone
    if (barcode === q || (phone && phone === q)) return 100;

    // Exact product name
    if (normalizedName === q) return 95;

    // Product name starts with query
    if (normalizedName.startsWith(q)) return 90;

    // Any word starts with query
    const words = rawName
        .replace(/[-_]/g, ' ')
        .split(/\s+/);

    if (words.some(word => normalize(word).startsWith(q))) {
        return 80;
    }

    // Only allow "contains" after 3+ characters
    if (q.length >= 3 && normalizedName.includes(q)) {
        return 60;
    }

    if (q.length >= 3 && phone && phone.includes(q)) {
        return 50;
    }

    if (q.length >= 3 && category.startsWith(q)) {
        return 30;
    }

    if (q.length >= 3 && category.includes(q)) {
        return 20;
    }

    if (q.length >= 3 && barcode.includes(q)) {
        return 10;
    }

    return 0;
}