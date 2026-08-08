import { format, isValid, parseISO } from 'date-fns';

export function parseDateTime(value?: string | null): Date | null {
    if (!value) return null;

    const date = typeof value === 'string' ? parseISO(value) : value;
    return isValid(date) ? date : null;
}

export function formatDateTime(value?: string | null): string {
    const date = parseDateTime(value);
    return date ? format(date, 'MMM d, yyyy · h:mm a') : '';
}

export function formatDateOnly(value?: string | null): string {
    const date = parseDateTime(value);
    return date ? format(date, 'MMM d, yyyy') : '';
}

export function formatTimeOnly(value?: string | null): string {
    const date = parseDateTime(value);
    return date ? format(date, 'h:mm a') : '';
}

type DateGetter<T> = (item: T) => string | null | undefined;

export function sortByLatestFirst<T>(
    items: T[],
    getPrimaryDate: DateGetter<T>,
    getSecondaryDate?: DateGetter<T>,
): T[] {
    return [...items].sort((a, b) => {
        const primaryA = parseDateTime(getPrimaryDate(a))?.getTime() ?? 0;
        const primaryB = parseDateTime(getPrimaryDate(b))?.getTime() ?? 0;
        if (primaryA !== primaryB) return primaryB - primaryA;

        if (!getSecondaryDate) return 0;
        const secondaryA = parseDateTime(getSecondaryDate(a))?.getTime() ?? 0;
        const secondaryB = parseDateTime(getSecondaryDate(b))?.getTime() ?? 0;
        return secondaryB - secondaryA;
    });
}
