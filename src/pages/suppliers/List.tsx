import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useSuppliers, usePurchases, useInventory } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Plus,
  Truck,
  Phone,
  MapPin,
  Package,
  ChevronRight,
  Building2,
  X,
  ChevronDown,
  Users,
  ClipboardList,
  Coins,
} from 'lucide-react';
import { rankSearch } from '@/utils/search/rank';

type SupplierStatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 30;

const STATUS_FILTERS: Array<{ id: SupplierStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

// Chip component
interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function Chip({ active, onClick, children, className = '' }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors shrink-0',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted text-muted-foreground hover:bg-muted/80',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function SupplierList() {
  const [, setLocation] = useLocation();
  const { items: suppliers } = useSuppliers();
  const { items: purchases } = usePurchases();
  const { items: inventory } = useInventory();
  const { format } = useCurrency();

  // Debounced search
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>('all');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Debounce effect
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 200);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [debouncedQuery, statusFilter]);

  // Precompute supplier stats (O(n + m))
  const supplierStatsMap = useMemo(() => {
    const statsMap: Record<string, { totalPurchased: number; totalOrders: number; productCount: number }> = {};

    suppliers.forEach((supplier) => {
      statsMap[supplier.id] = { totalPurchased: 0, totalOrders: 0, productCount: 0 };
    });

    purchases.forEach((purchase) => {
      const sid = purchase.supplierId;
      if (sid && statsMap[sid]) {
        statsMap[sid].totalPurchased += purchase.grandTotal;
        statsMap[sid].totalOrders += 1;
      }
    });

    inventory.forEach((item) => {
      const supplierIds = item.supplierIds ?? (item.supplierId ? [item.supplierId] : []);
      supplierIds.forEach((sid) => {
        if (statsMap[sid]) {
          statsMap[sid].productCount += 1;
        }
      });
    });

    return statsMap;
  }, [suppliers, purchases, inventory]);

  // Summary metrics
  const summary = useMemo(() => {
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter((s) => (s.status ?? 'active') === 'active').length;
    const totalPurchasedValue = purchases.reduce((sum, p) => sum + p.grandTotal, 0);
    return { totalSuppliers, activeSuppliers, totalPurchasedValue };
  }, [suppliers, purchases]);

  // Main pipeline: enrich → search → status filter → sort
  const processedSuppliers = useMemo(() => {
    const enriched = suppliers.map((supplier) => ({
      ...supplier,
      searchText: [
        supplier.name,
        supplier.phone,
        supplier.address,
        supplier.vatPan,
        supplier.contactPerson,
      ].join(' '),
    }));

    let filtered = enriched;
    if (debouncedQuery.trim()) {
      filtered = rankSearch(filtered, debouncedQuery, filtered.length);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => (s.status ?? 'active') === statusFilter);
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, debouncedQuery, statusFilter]);

  // Pagination
  const visibleSuppliers = useMemo(
    () => processedSuppliers.slice(0, displayCount),
    [processedSuppliers, displayCount],
  );

  const hasMore = displayCount < processedSuppliers.length;
  const remaining = processedSuppliers.length - displayCount;

  const activeFilterCount = [debouncedQuery !== '', statusFilter !== 'all'].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setInputValue('');
    setStatusFilter('all');
  }, []);

  const loadMore = useCallback(() => {
    setDisplayCount((c) => c + PAGE_SIZE);
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {suppliers.length} total · {summary.activeSuppliers} active
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => setLocation('/purchases/new')}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Truck className="h-4 w-4 mr-1.5" />
            New Purchase
          </Button>
          <Button
            onClick={() => setLocation('/suppliers/new')}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
        {STATUS_FILTERS.map((s) => (
          <Chip key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search by name, phone, contact person…"
          className="pl-9 pr-9"
          aria-label="Search suppliers"
        />
        {inputValue && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setInputValue('')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Clear filters */}
      {activeFilterCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
            Clear filters
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
              {activeFilterCount}
            </Badge>
          </Button>
        </div>
      )}

      {/* Summary card */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Suppliers</p>
              <p className="font-bold text-lg leading-tight">{summary.totalSuppliers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="font-bold text-lg leading-tight">{summary.activeSuppliers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Purchased</p>
              <p className="font-bold text-lg leading-tight tabular-nums">{format(summary.totalPurchasedValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results / Empty states */}
      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">No suppliers yet</h3>
            <p className="text-muted-foreground text-sm">Add your first supplier to get started.</p>
            <Button onClick={() => setLocation('/suppliers/new')} className="mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
          </CardContent>
        </Card>
      ) : processedSuppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-base font-semibold">No matching suppliers</h3>
            <p className="text-muted-foreground text-sm">
              {activeFilterCount > 0
                ? 'Try a different status or search term.'
                : 'No suppliers found for your search.'}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
                <X className="h-3.5 w-3.5 mr-1.5" />
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            {visibleSuppliers.map((supplier, index) => {
              const stats = supplierStatsMap[supplier.id] ?? {
                totalPurchased: 0,
                totalOrders: 0,
                productCount: 0,
              };
              const isActive = (supplier.status ?? 'active') === 'active';

              return (
                <div
                  key={supplier.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLocation(`/suppliers/${supplier.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && setLocation(`/suppliers/${supplier.id}`)}
                  className={`
                    group flex items-center gap-3 rounded-xl border bg-card
                    px-3 py-3 sm:px-4 sm:py-3 cursor-pointer
                    hover:bg-muted/40 active:scale-[0.99]
                    transition-all duration-100 select-none
                    ${isActive ? '' : 'border-l-4 border-l-amber-500'}
                  `}
                >
                  {/* Serial number */}
                  <div className="text-xs text-muted-foreground tabular-nums w-5 sm:w-6 text-center shrink-0 font-medium">
                    {index + 1}
                  </div>

                  {/* Avatar */}
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {supplier.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate">{supplier.name}</span>
                      {!isActive && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                      {supplier.contactPerson && (
                        <span className="truncate">{supplier.contactPerson}</span>
                      )}
                      {supplier.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {supplier.phone}
                        </span>
                      )}
                      {supplier.address && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {supplier.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats (desktop) */}
                  <div className="hidden md:flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Purchased</p>
                      <p className="font-bold text-primary text-sm tabular-nums">
                        {format(stats.totalPurchased)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Orders</p>
                      <p className="font-bold text-sm">{stats.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Products</p>
                      <p className="font-bold text-sm">{stats.productCount}</p>
                    </div>
                  </div>

                  {/* Stats (mobile) – stacked vertically */}
                  <div className="flex md:hidden flex-col items-end gap-1 text-xs text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                      <p className="font-bold text-primary tabular-nums">{format(stats.totalPurchased)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Package className="h-2.5 w-2.5" />
                      </p>
                      <p className="font-bold">{stats.productCount}</p>
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex flex-col items-center gap-1 pt-2">
              <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={loadMore}>
                <ChevronDown className="h-4 w-4" />
                Load {Math.min(PAGE_SIZE, remaining)} more
                <span className="text-muted-foreground text-xs">({remaining} remaining)</span>
              </Button>
            </div>
          )}

          {/* End of list */}
          {!hasMore && processedSuppliers.length > PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground py-2">
              All {processedSuppliers.length} suppliers shown
            </p>
          )}
        </div>
      )}
    </div>
  );
}