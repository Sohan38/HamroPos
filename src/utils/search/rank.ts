import { getSearchScore, SearchableItem } from './score';

export function rankSearch<T extends SearchableItem>(
    items: T[],
    query: string,
    limit = 20
): T[] {
    if (!query.trim()) {
        return items.slice(0, limit);
    }

    return items
        .map(item => ({
            item,
            score: getSearchScore(item, query),
        }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(x => x.item);
}