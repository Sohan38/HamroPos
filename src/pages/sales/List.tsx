import { useState } from 'react';
import { useLocation } from 'wouter';
import { useSales } from '@/contexts/GlobalProviders';
import { useSearch } from '@/hooks/useSearch';
import { useSort } from '@/hooks/useSort';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Calendar, FileText, ArrowUpRight } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function SalesList() {
  const [, setLocation] = useLocation();
  const { items } = useSales();
  const { format } = useCurrency();

  const { query, setQuery, filteredItems } = useSearch(
    items, 
    ['id', 'paymentMethod', 'notes'] // 'date' is tricky to text search, better handled by date filter
  );

  const { sortedItems } = useSort(filteredItems, { key: 'date', direction: 'desc' });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Sales History</h1>
          <p className="text-muted-foreground">{items.length} records</p>
        </div>
        <Button onClick={() => setLocation('/sales/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> New Sale
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search sales..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      {sortedItems.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No sales found</h3>
          <p className="text-muted-foreground mb-6">Start making sales in the POS to see them here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedItems.map((sale) => (
            <Card key={sale.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setLocation(`/sales/${sale.id}`)}>
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">
                      {sale.items.length} items
                      <span className="text-muted-foreground font-normal ml-2">
                        ({sale.items.slice(0, 2).map(i => i.productName).join(', ')}{sale.items.length > 2 ? '...' : ''})
                      </span>
                    </div>
                    <div className="text-sm flex items-center gap-2 text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(parseISO(sale.date), 'MMM d, yyyy • h:mm a')}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between md:flex-col items-end md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6">
                  <div className="font-bold text-lg">{format(sale.grandTotal)}</div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {sale.paymentMethod}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
