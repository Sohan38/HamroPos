import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useRestaurantBills } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, UtensilsCrossed, Calendar } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function RestaurantBillingList() {
  const [, setLocation] = useLocation();
  const { items } = useRestaurantBills();
  const { format } = useCurrency();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Restaurant Bills</h1>
          <p className="text-muted-foreground">{items.length} records</p>
        </div>
        <Button onClick={() => setLocation('/restaurant/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> New KOT / Bill
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <UtensilsCrossed className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No bills found</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((bill) => (
            <Card key={bill.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-600 flex-shrink-0 font-bold">
                    T{bill.tableNumber}
                  </div>
                  <div>
                    <div className="font-semibold">{bill.items.length} items</div>
                    <div className="text-sm flex items-center gap-2 text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(parseISO(bill.date), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between md:flex-col items-end md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6">
                  <div className="font-bold text-lg">{format(bill.grandTotal)}</div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {bill.paymentMethod}
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
