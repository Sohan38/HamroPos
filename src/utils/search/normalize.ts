export function normalize(text?: string | null): string {
    if (!text) return '';

    return text
        .toLowerCase()
        .trim()
        .replace(/[-_]/g, ' ')      // - and _ become spaces
        .replace(/\s+/g, ' ')       // remove duplicate spaces
        .replace(/\s/g, '');        // remove all spaces
}