export function normalizeDecimalInput(value: string, maxDecimals = 2): string {
    const sanitized = value.replace(/[^0-9.]/g, '');
    if (!sanitized) return '';

    const firstDotIndex = sanitized.indexOf('.');
    if (firstDotIndex === -1) {
        return sanitized;
    }

    const integerPart = sanitized.slice(0, firstDotIndex) || '0';
    const decimalPart = sanitized.slice(firstDotIndex + 1).replace(/\./g, '');
    return `${integerPart}.${decimalPart.slice(0, maxDecimals)}`;
}

export function parseDecimal(value: string): number {
    const normalized = value.trim();
    if (!normalized) return NaN;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
}
