import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useSales } from '@/contexts/GlobalProviders';
import { useSort } from '@/hooks/useSort';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Plus,
  Calendar,
  FileText,
  ArrowUpRight,
  Receipt,
} from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function SalesList() {
  const [, setLocation] = useLocation();
  const { items } = useSales();
  const { format } = useCurrency();

  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return items;

    return items.filter((sale) => {
      const searchableText = [
        sale.id,
        sale.paymentMethod,
        sale.notes ?? '',
        ...sale.items.map(item => item.productName),
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(q);
    });
  }, [items, query]);

  const { sortedItems } = useSort(filteredItems, {
    key: 'date',
    direction: 'desc',
  });

  const visibleSales = useMemo(
    () => sortedItems.slice(0, 100),
    [sortedItems]
  );

  const totalRevenue = useMemo(
    () =>
      sortedItems.reduce(
        (sum, sale) => sum + sale.grandTotal,
        0
      ),
    [sortedItems]
  );

  const getTotalQuantity = (sale: typeof items[0]) =>
    sale.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 pb-24 md:pb-6 space-y-5">

      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Sales History
          </h1>

          <p className="text-muted-foreground">
            {sortedItems.length} sale{sortedItems.length !== 1 ? 's' : ''}
          </p>
        </div>

        <Button
          size="lg"
          className="w-full md:w-auto"
          onClick={() => setLocation('/sales/new')}
        >
          <Plus className="mr-2 h-5 w-5" />
          New Sale
        </Button>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4">

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Sales
            </p>

            <p className="text-2xl font-bold">
              {sortedItems.length}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Revenue
            </p>

            <p className="text-2xl font-bold text-primary">
              {format(totalRevenue)}
            </p>
          </div>

        </CardContent>
      </Card>

      <div className="relative">

        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search invoice, payment or product..."
          className="pl-10"
        />

      </div>

      {sortedItems.length === 0 ? (

        <Card>

          <CardContent className="py-16 text-center">

            <FileText className="mx-auto h-12 w-12 text-muted-foreground/40" />

            <h3 className="mt-4 text-lg font-semibold">
              No Sales Found
            </h3>

            <p className="text-muted-foreground mt-2">
              Try another search or create a new sale.
            </p>

          </CardContent>

        </Card>


      ) : (

        <div className="space-y-3">


          {visibleSales.map((sale) => {

            const totalQty = getTotalQuantity(sale);

            return (

              <Card
                key={sale.id}
                onClick={() => setLocation(`/sales/${sale.id}`)}
                className="cursor-pointer active:scale-[0.99] transition-all hover:bg-muted/40"
              >

                <CardContent className="p-4">

                  <div className="flex justify-between gap-3">

                    <div className="flex gap-3 min-w-0">

                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>

                      <div className="min-w-0">

                        <div className="font-semibold truncate">
                          INV-{sale.id.slice(-6).toUpperCase()}
                        </div>

                        <div className="text-sm text-muted-foreground truncate">

                          {sale.items
                            .slice(0, 2)
                            .map((i) => i.productName)
                            .join(', ')}

                          {sale.items.length > 2 &&
                            ` +${sale.items.length - 2}`}

                        </div>

                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">

                          <Calendar className="h-3 w-3" />

                          {formatDate(
                            parseISO(sale.date),
                            'MMM d • h:mm a'
                          )}

                        </div>

                      </div>

                    </div>

                    <div className="text-right shrink-0">

                      <div className="font-bold text-lg">
                        {format(sale.grandTotal)}
                      </div>

                      <Badge
                        variant={
                          sale.paymentMethod === 'cash'
                            ? 'default'
                            : 'secondary'
                        }
                        className="capitalize mt-1"
                      >
                        {sale.paymentMethod}
                      </Badge>

                      <div className="text-xs text-muted-foreground mt-2">
                        {totalQty} item{totalQty !== 1 ? 's' : ''}
                      </div>

                    </div>

                  </div>

                </CardContent>

              </Card>

            );
          })}

        </div>

      )}

    </div>
  );
}