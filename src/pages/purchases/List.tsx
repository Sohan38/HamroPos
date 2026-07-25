import { useState } from 'react';
import { useLocation } from 'wouter';
import { usePurchases, useSuppliers } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Plus, Truck, Calendar, Package, Filter } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function PurchaseList() {
  const [, setLocation] = useLocation();
  const { items } = usePurchases();
  const { items: suppliers } = useSuppliers();
  const { format } = useCurrency();
  const [query, setQuery] = useState('');

  const filteredItems = items
    .filter(invoice => {
      const supplier = suppliers.find(candidate => candidate.id === invoice.supplierId);
      const haystack = [
        invoice.invoiceNumber,
        invoice.referenceNumber,
        invoice.notes,
        supplier?.name,
        ...invoice.items.map(item => item.productName),
      ].join(' ').toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalValue = filteredItems
    .filter(invoice => (invoice.status ?? 'received') === 'received')
    .reduce((sum, invoice) => sum + invoice.grandTotal, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Purchases</h1>
          <p className="text-muted-foreground">{items.length} invoices · {format(totalValue)} received</p>
        </div>
        <Button onClick={() => setLocation('/purchases/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> New Purchase
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice, supplier, or product..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No purchases found</h3>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-dashed">
          <Filter className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="font-semibold">No matching purchases</h3>
          <p className="text-sm text-muted-foreground mt-1">Try a different invoice, supplier, or product name.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((invoice) => {
            const supplier = suppliers.find(candidate => candidate.id === invoice.supplierId);
            const status = invoice.status ?? 'received';
            return (
              <Card key={invoice.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setLocation(`/purchases/${invoice.id}`)}>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 flex-shrink-0">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {invoice.invoiceNumber || 'No Ref #'}
                        <Badge className={`capitalize text-[10px] ${status === 'received' ? 'bg-green-100 text-green-700 border-green-300' : status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>{status}</Badge>
                      </div>
                      <div className="text-sm flex items-center gap-2 text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(parseISO(invoice.date), 'MMM d, yyyy')} • {supplier?.name ?? invoice.supplierName ?? 'Unknown supplier'}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Package className="h-3 w-3" /> {invoice.items.length} product{invoice.items.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  <div className="flex justify-between md:flex-col items-end md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6">
                    <div className="font-bold text-lg text-green-600">{format(invoice.grandTotal)}</div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {invoice.paymentStatus ?? invoice.paymentMethod}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  );
}
