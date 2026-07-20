import { useState } from 'react';
import { useLocation } from 'wouter';
import { useHotelBills, useHotelRooms } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Calendar, ArrowUpRight } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function HotelBillingList() {
  const [, setLocation] = useLocation();
  const { items } = useHotelBills();
  const { format } = useCurrency();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Hotel Bills</h1>
          <p className="text-muted-foreground">{items.length} records</p>
        </div>
        <Button onClick={() => setLocation('/hotel/billing/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> New Check In / Bill
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No bills found</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((bill) => (
            <Card key={bill.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setLocation(`/hotel/billing/${bill.id}`)}>
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 font-bold">
                    {bill.roomNumber}
                  </div>
                  <div>
                    <div className="font-semibold">{bill.guestName}</div>
                    <div className="text-sm flex items-center gap-2 text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      In: {formatDate(parseISO(bill.checkIn), 'MMM d')} • Out: {formatDate(parseISO(bill.checkOut), 'MMM d')} ({bill.numberOfNights}N)
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between md:flex-col items-end md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6">
                  <div className="font-bold text-lg">{format(bill.grandTotal)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Paid: {format(bill.paidAmount)}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
