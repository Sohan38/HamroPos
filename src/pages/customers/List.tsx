import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useCustomers } from '@/contexts/GlobalProviders';
import { useBackModal } from '@/contexts/NavigationContext';
import { useAllCustomerStats } from '@/hooks/useCustomerStats';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Plus,
  User,
  Phone,
  MapPin,
  TrendingUp,
  X,
  ChevronRight,
  ChevronDown,
  Users,
  Wallet,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { rankSearch } from '@/utils/search/rank';

const PAGE_SIZE = 24;

export default function CustomerList() {
  const [, setLocation] = useLocation();
  const { items, add } = useCustomers();
  const allStats = useAllCustomerStats();
  const { format } = useCurrency();

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', email: '', notes: '' });

  useBackModal(showAddForm, () => setShowAddForm(false), 'add-customer-form');

  // Search state (debounced)
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(inputValue), 200);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Reset display count when search changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [debouncedQuery]);

  // Filter and sort customers
  const processedCustomers = useMemo(() => {
    let filtered = items;

    if (debouncedQuery.trim()) {
      filtered = rankSearch(
        filtered.map(c => ({
          ...c,
          searchText: [c.name, c.phone, c.address, c.email, c.notes].join(' '),
        })),
        debouncedQuery,
        filtered.length
      );
    }

    // Sort by name ascending
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, debouncedQuery]);

  // Enrich with stats
  const enrichedCustomers = useMemo(
    () => processedCustomers.map(c => ({ ...c, stats: allStats.get(c.id) })),
    [processedCustomers, allStats]
  );

  // Summary metrics
  const summary = useMemo(() => {
    const totalOutstanding = items.reduce((sum, c) => {
      const stats = allStats.get(c.id);
      return sum + (stats?.outstandingCredit ?? 0);
    }, 0);
    const totalLifetimeSpent = items.reduce((sum, c) => {
      const stats = allStats.get(c.id);
      return sum + (stats?.totalSpent ?? 0);
    }, 0);
    return {
      totalCustomers: items.length,
      totalOutstanding,
      totalLifetimeSpent,
    };
  }, [items, allStats]);

  // Pagination
  const visibleCustomers = useMemo(
    () => enrichedCustomers.slice(0, displayCount),
    [enrichedCustomers, displayCount]
  );

  const hasMore = displayCount < enrichedCustomers.length;
  const remaining = enrichedCustomers.length - displayCount;

  const activeFilterCount = debouncedQuery !== '' ? 1 : 0;

  const clearSearch = useCallback(() => {
    setInputValue('');
    setDebouncedQuery('');
  }, []);

  const loadMore = useCallback(() => {
    setDisplayCount(c => c + PAGE_SIZE);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    add({ name: formData.name.trim(), phone: formData.phone, address: formData.address, email: formData.email, notes: formData.notes });
    setFormData({ name: '', phone: '', address: '', email: '', notes: '' });
    setShowAddForm(false);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {items.length} total record{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(v => !v)}
          className="w-full sm:w-auto shrink-0"
        >
          {showAddForm ? <X className="h-4 w-4 mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
          {showAddForm ? 'Cancel' : 'Add Customer'}
        </Button>
      </div>

      {/* Add customer form */}
      {showAddForm && (
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-semibold text-base">New Customer</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Name *"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
                <Input
                  placeholder="Phone"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  inputMode="tel"
                />
                <Input
                  placeholder="Address"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  type="email"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!formData.name.trim()}>
                  Save Customer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search + clear */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, phone, address…"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search customers"
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
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
            Clear
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
              {activeFilterCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* Summary card – modern metric strip (fixed overflow) */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-xl px-3 py-2.5 shrink-0 sm:flex-1 sm:min-w-0">
              <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Customers
                </p>
                <p className="font-bold text-sm leading-tight tabular-nums break-all">
                  {summary.totalCustomers}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2.5 shrink-0 sm:flex-1 sm:min-w-0">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Lifetime Revenue
                </p>
                <p className="font-bold text-sm leading-tight tabular-nums break-all">
                  {format(summary.totalLifetimeSpent)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-xl px-3 py-2.5 shrink-0 sm:flex-1 sm:min-w-0">
              <div className="h-8 w-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  Outstanding
                </p>
                <p className="font-bold text-sm leading-tight tabular-nums break-all">
                  {format(summary.totalOutstanding)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {enrichedCustomers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <User className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold">
              {debouncedQuery ? 'No matching customers' : 'No customers yet'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {debouncedQuery ? 'Try a different search term.' : 'Add your first customer to get started.'}
            </p>
            {!debouncedQuery && (
              <Button onClick={() => setShowAddForm(true)} variant="outline" className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Add First Customer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleCustomers.map(customer => (
              <Card
                key={customer.id}
                className="shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40"
                onClick={() => setLocation(`/customers/${customer.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-base truncate">{customer.name}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{customer.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {customer.stats && customer.stats.visitCount > 0 ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                            <TrendingUp className="h-3 w-3" />
                            {format(customer.stats.totalSpent)}
                          </div>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {customer.stats.visitCount} {customer.stats.visitCount === 1 ? 'visit' : 'visits'}
                          </Badge>
                        </div>
                        {customer.stats.lastPurchaseDate && (
                          <div className="text-[11px] text-muted-foreground">
                            Last purchase {formatDistanceToNow(new Date(customer.stats.lastPurchaseDate), { addSuffix: true })}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">No purchases yet</div>
                    )}

                    {customer.stats?.outstandingCredit ? (
                      <div className="text-xs text-orange-500 font-medium">
                        Credit due: {format(customer.stats.outstandingCredit)}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
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
          {!hasMore && enrichedCustomers.length > PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground py-2">
              All {enrichedCustomers.length} customers shown
            </p>
          )}
        </div>
      )}
    </div>
  );
}