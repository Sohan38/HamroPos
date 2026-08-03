import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useCustomers } from '@/contexts/GlobalProviders';
import { useBackModal } from '@/contexts/NavigationContext';
import { useAllCustomerStats } from '@/hooks/useCustomerStats';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, User, Phone, MapPin, TrendingUp, X, ChevronRight } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { useSort } from '@/hooks/useSort';
import { formatDistanceToNow } from 'date-fns';

export default function CustomerList() {
  const [, setLocation] = useLocation();
  const { items, add } = useCustomers();
  const allStats = useAllCustomerStats();
  const { format } = useCurrency();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', email: '', notes: '' });

  useBackModal(showAddForm, () => setShowAddForm(false), 'add-customer-form');

  const { query, setQuery, filteredItems } = useSearch(items, ['name', 'phone', 'address']);
  const { sortedItems: baseSortedItems, sortConfig } = useSort(filteredItems, { key: 'name', direction: 'asc' });

  const sortedItems = useMemo(() => {
    if (query.trim() && sortConfig?.key === 'name') {
      return filteredItems;
    }
    return baseSortedItems;
  }, [query, sortConfig, filteredItems, baseSortedItems]);

  // Enrich sorted items with stats for display
  const enriched = useMemo(() =>
    sortedItems.map(c => ({ ...c, stats: allStats.get(c.id) })),
    [sortedItems, allStats]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    add({ name: formData.name.trim(), phone: formData.phone, address: formData.address, email: formData.email, notes: formData.notes });
    setFormData({ name: '', phone: '', address: '', email: '', notes: '' });
    setShowAddForm(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto pb-24 md:pb-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">{items.length} {items.length === 1 ? 'record' : 'records'}</p>
        </div>
        <Button
          onClick={() => setShowAddForm(v => !v)}
          size="lg"
          className="w-full md:w-auto shadow-sm"
        >
          {showAddForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showAddForm ? 'Cancel' : 'Add Customer'}
        </Button>
      </div>

      {/* ── Add form ────────────────────────────────────────────────────────── */}
      {showAddForm && (
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-semibold text-base">New Customer</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button type="submit" disabled={!formData.name.trim()}>Save Customer</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9 bg-card h-11"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {enriched.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <User className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold">
            {query ? 'No customers found' : 'No customers yet'}
          </h3>
          {!query && (
            <>
              <p className="text-muted-foreground text-sm mb-6">Add your first customer to get started.</p>
              <Button onClick={() => setShowAddForm(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Add First Customer
              </Button>
            </>
          )}
        </div>
      ) : (
        /* ── Customer grid ────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {enriched.map(customer => (
            <button
              key={customer.id}
              onClick={() => setLocation(`/customers/${customer.id}`)}
              className="text-left w-full"
            >
              <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.99]">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
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
                            <Phone className="h-3 w-3 shrink-0" />{customer.phone}
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

                  {/* Stats row */}
                  {customer.stats && customer.stats.visitCount > 0 && (
                    <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                        <TrendingUp className="h-3 w-3" />
                        {format(customer.stats.totalSpent)}
                      </div>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {customer.stats.visitCount} {customer.stats.visitCount === 1 ? 'visit' : 'visits'}
                      </Badge>
                      {customer.stats.lastPurchaseDate && (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(customer.stats.lastPurchaseDate), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  )}

                  {customer.stats?.outstandingCredit ? (
                    <div className="mt-2 text-xs text-orange-500 font-medium">
                      Credit due: {format(customer.stats.outstandingCredit)}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
