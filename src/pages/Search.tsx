import { useState } from 'react';
import { useLocation } from 'wouter';
import { useInventory, useCustomers, useSuppliers, useCredit, useSales } from '@/contexts/GlobalProviders';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, Package, Users, Truck, Banknote, ShoppingCart, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Search() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');

  const { items: inventory } = useInventory();
  const { items: customers } = useCustomers();
  const { items: suppliers } = useSuppliers();
  const { items: credits } = useCredit();

  const q = query.toLowerCase().trim();

  // Search across multiple resources
  const results = q ? {
    products: inventory.filter(i => i.name.toLowerCase().includes(q) || i.barcode.includes(q)).slice(0, 5),
    customers: customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 3),
    suppliers: suppliers.filter(s => s.name.toLowerCase().includes(q) || s.phone.includes(q)).slice(0, 3),
    credits: credits.filter(c => c.customerName.toLowerCase().includes(q)).slice(0, 3)
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
                <Card key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation('/customers')}>
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
              {results.credits.map(item => (
                <Card key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation('/credit')}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{item.customerName}</div>
                      <div className="text-sm text-muted-foreground">Amount: {item.amount} • {item.status}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
