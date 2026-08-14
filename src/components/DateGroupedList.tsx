import { useMemo, ReactNode } from 'react';
import { format as formatDate, parseISO, subDays } from 'date-fns';

interface DateGroupedListProps<T> {
    items: T[];
    getDate: (item: T) => string;
    getId: (item: T) => string | number;
    renderItem: (item: T, index: number) => ReactNode;
    getAmount?: (item: T) => number;
    formatTotal?: (total: number) => string;
    formatDayLabel?: (dateStr: string) => string;
    itemLabel?: string;
    className?: string;
}

export function DateGroupedList<T>({
    items,
    getDate,
    getId,
    renderItem,
    getAmount,
    formatTotal,
    formatDayLabel,
    itemLabel = 'item',
    className = '',
}: DateGroupedListProps<T>) {
    const groups = useMemo(() => {
        const map = new Map<string, T[]>();
        items.forEach((item) => {
            const dateStr = getDate(item).slice(0, 10);
            if (!map.has(dateStr)) map.set(dateStr, []);
            map.get(dateStr)!.push(item);
        });
        // Preserve order of items (map insertion order is fine)
        return Array.from(map.entries());
    }, [items, getDate]);

    const defaultDayLabel = (dateStr: string) => {
        const now = new Date();
        const todayStr = formatDate(now, 'yyyy-MM-dd');
        const yesterdayStr = formatDate(subDays(now, 1), 'yyyy-MM-dd');
        if (dateStr === todayStr) return 'Today';
        if (dateStr === yesterdayStr) return 'Yesterday';
        try {
            return formatDate(parseISO(dateStr), 'eeee, dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {groups.map(([dayStr, dayItems]) => {
                const dayTotal = getAmount
                    ? dayItems.reduce((sum, item) => sum + getAmount(item), 0)
                    : undefined;
                const label = formatDayLabel ? formatDayLabel(dayStr) : defaultDayLabel(dayStr);

                return (
                    <div key={dayStr} className="space-y-2.5">
                        {/* Sticky Day Header */}
                        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur flex items-center justify-between border-y border-border/40 text-xs font-semibold text-muted-foreground select-none">
                            <span>{label}</span>
                            <span className="font-medium text-[10px] bg-muted px-2 py-0.5 rounded-full">
                                {dayItems.length} {itemLabel}{dayItems.length !== 1 ? 's' : ''}
                                {dayTotal !== undefined && (
                                    <>
                                        {' '}
                                        &middot;{' '}
                                        {formatTotal ? formatTotal(dayTotal) : dayTotal.toLocaleString()}
                                    </>
                                )}

                            </span>
                        </div>

                        <div className="space-y-2">
                            {dayItems.map((item, index) => (
                                <div key={getId(item)}>
                                    {renderItem(item, index)}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}