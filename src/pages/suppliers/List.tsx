import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useSuppliers, usePurchases, useInventory } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Truck, Phone, MapPin, Package, ChevronRight, Building2 } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { useSort } from '@/hooks/useSort';

export default function SupplierList() {
  const [, setLocation] = useLocation();
  const { items } = useSuppliers();
  const { items: purchases } = usePurchases();
  const { items: inventory } = useInventory();
  const { format } = useCurrency();
  const [_unused] = useState(false);

  const { query, setQuery, filteredItems } = useSearch(items, ['name', 'phone', 'address', 'vatPan', 'contactPerson']);
  const { sortedItems: baseSortedItems, sortConfig } = useSort(filteredItems, { key: 'name', direction: 'asc' });

  const sortedItems = useMemo(() => {
    if (query.trim() && sortConfig?.key === 'name') {
      return filteredItems;
    }
    return baseSortedItems;
  }, [query, sortConfig, filteredItems, baseSortedItems]);

  const getSupplierStats = (supplierId: string) => {
    const supplierPurchases = purchases.filter(p => p.supplierId === supplierId);
    const totalPurchased = supplierPurchases.reduce((s, p) => s + p.grandTotal, 0);
    const totalOrders = supplierPurchases.length;
    const supplierProducts = inventory.filter(i =>
      (i.supplierIds ?? (i.supplierId ? [i.supplierId] : [])).includes(supplierId)
    );
    return { totalPurchased, totalOrders, supplierProducts };
  };

  const activeCount = items.filter(s => (s.status ?? 'active') === 'active').length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto pb-28 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground text-sm">
            {items.length} total · {activeCount} active
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => setLocation('/purchases/new')} variant="outline" size="lg" className="flex-1 md:flex-auto">
            <Truck className="mr-2 h-4 w-4" /> New Purchase
          </Button>
          <Button onClick={() => setLocation('/suppliers/new')} size="lg" className="flex-1 md:flex-auto shadow-sm">
            <Plus className="mr-2 h-5 w-5" /> Add Supplier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, contact person..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      {/* List */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">
            {query ? `No results for "${query}"` : 'No suppliers yet'}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {query ? 'Try a different search term.' : 'Add your first supplier to get started.'}
          </p>
          {!query && (
            <Button onClick={() => setLocation('/suppliers/new')} variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedItems.map(supplier => {
            const stats = getSupplierStats(supplier.id);
            const isActive = (supplier.status ?? 'active') === 'active';

            return (
              <Card
                key={supplier.id}
                className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setLocation(`/suppliers/${supplier.id}`)}
              >
                <CardContent className="p-0">
                  <div className="p-4 flex items-center gap-3">
                    {/* Avatar */}
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {supplier.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{supplier.name}</span>
                        {!isActive && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Inactive</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                        {supplier.contactPerson && (
                          <span className="truncate">{supplier.contactPerson}</span>
                        )}
                        {supplier.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />{supplier.phone}
                          </span>
                        )}
                        {supplier.address && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />{supplier.address}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats (desktop) */}
                    <div className="hidden md:flex items-center gap-6 text-right shrink-0">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Purchased</div>
                        <div className="font-bold text-primary text-sm">{format(stats.totalPurchased)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Orders</div>
                        <div className="font-bold text-sm">{stats.totalOrders}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase">Products</div>
                        <div className="font-bold text-sm">{stats.supplierProducts.length}</div>
                      </div>
                    </div>

                    {/* Mobile stats */}
                    <div className="flex md:hidden items-center gap-3 text-xs text-right shrink-0">
                      <div>
                        <div className="text-[10px] text-muted-foreground">Total</div>
                        <div className="font-bold text-primary">{format(stats.totalPurchased)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Package className="h-2.5 w-2.5" />
                        </div>
                        <div className="font-bold">{stats.supplierProducts.length}</div>
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      <div className="fixed left-0 right-0 bottom-16 z-40 md:hidden border-t bg-card p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <Button
          onClick={() => setLocation('/suppliers/new')}
          className="w-full h-11 font-semibold shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" /> Add Supplier
        </Button>
      </div>
    </div>
  );
}
