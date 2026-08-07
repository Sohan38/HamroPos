import { useState } from 'react';
import { useLocation } from 'wouter';
import { useInventory, useCustomers, useSuppliers, useCredit } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, Package, Users, Banknote, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { rankSearch } from '@/utils/search/rank';

export default function Search() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const { format } = useCurrency();

  const { items: inventory } = useInventory();
  const { items: customers } = useCustomers();
  const { items: suppliers } = useSuppliers();
  const { items: credits } = useCredit();

  const q = query.trim();

  // Search across multiple resources using rankSearch
  const results = q ? {
    products: rankSearch(inventory, q, 5),
    customers: rankSearch(customers, q, 3),
    suppliers: rankSearch(suppliers, q, 3),
    credits: rankSearch(credits.map(c => ({ ...c, name: c.customerName })), q, 3)
  } : { products: [], customers: [], suppliers: [], credits: [] };

  const hasResults = Object.values(results).some(arr => arr.length > 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto pb-24 md:pb-6">
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search products, customers, suppliers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 h-14 text-lg bg-card shadow-sm border-primary/20 rounded-xl focus-visible:ring-primary"
        />
      </div>

      {!q && (
        <div className="text-center py-20 text-muted-foreground">
          <SearchIcon className="mx-auto h-12 w-12 opacity-20 mb-4" />
          <p>Type to search across everything</p>
        </div>
      )}

      {q && !hasResults && (
        <div className="text-center py-20 text-muted-foreground">
          <p>No results found for "{query}"</p>
        </div>
      )}

      {q && hasResults && (
        <div className="space-y-6">
          {results.products.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Package className="h-4 w-4" /> Products
              </h3>
              {results.products.map(item => (
                <Card key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/inventory/${item.id}`)}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-sm text-muted-foreground">Stock: {item.quantity} • Barcode: {item.barcode}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {results.customers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4" /> Customers
              </h3>
              {results.customers.map(item => (
                <Card key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/customers/${item.id}`)}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.phone}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {results.credits.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Banknote className="h-4 w-4" /> Credit Records
              </h3>
              {results.credits.map(item => {
                const remaining = Math.max(0, item.amount - (item.paidAmount ?? 0));
                const statusLabel = item.status === 'paid' ? 'Settled' : item.status === 'partial' ? 'Partial' : 'Pending';
                const statusClass = item.status === 'paid'
                  ? 'bg-green-500/10 text-green-600 border-green-200'
                  : item.status === 'partial'
                    ? 'bg-blue-500/10 text-blue-600 border-blue-200'
                    : 'bg-orange-500/10 text-orange-600 border-orange-200';
                return (
                  <Card key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/credit/${item.id}`)}>
                    <CardContent className="p-4 flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{item.customerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.status !== 'paid' ? `Remaining: ${format(remaining)}` : `Settled: ${format(item.amount)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={statusClass}>{statusLabel}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
