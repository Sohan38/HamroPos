import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCashBook } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Plus, ArrowDownRight, ArrowUpRight, Save } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function CashBook() {
  const [, setLocation] = useLocation();
  const { items } = useCashBook();
  const { format } = useCurrency();
  const [date] = useState(new Date().toISOString().split('T')[0]);

  // Find today's entry
  const todayEntry = items.find(i => i.date === date);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Cash Book</h1>
          <p className="text-muted-foreground">{formatDate(parseISO(date), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Daily Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {todayEntry ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Opening Balance</span>
                    <span className="font-semibold">{format(todayEntry.openingCash)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b text-green-600">
                    <span className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4"/> Cash In</span>
                    <span className="font-semibold">+{format(todayEntry.cashIn)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b text-destructive">
                    <span className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4"/> Cash Out</span>
                    <span className="font-semibold">-{format(todayEntry.cashOut)}</span>
                  </div>
                  <div className="flex justify-between items-center py-4 bg-muted/30 rounded-lg px-3 mt-4">
                    <span className="font-bold">Closing Balance</span>
                    <span className="text-xl font-bold text-primary">{format(todayEntry.closingCash)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Wallet className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground mb-4">No entry for today yet.</p>
                  <Button onClick={() => setLocation('/cash-book/new')}>Start Day</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.slice(0, 5).map(entry => (
                  <div key={entry.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{formatDate(parseISO(entry.date), 'MMM d, yyyy')}</div>
                      <div className="text-sm text-muted-foreground">In: {format(entry.cashIn)} • Out: {format(entry.cashOut)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">Closing</div>
                      <div className="font-bold text-primary">{format(entry.closingCash)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground border-none">
            <CardContent className="p-6">
              <p className="text-sm font-medium opacity-80 mb-2">Current Cash in Drawer</p>
              <h2 className="text-4xl font-bold">
                {format(todayEntry ? todayEntry.closingCash : 0)}
              </h2>
            </CardContent>
          </Card>
          
          <Button size="lg" className="w-full" onClick={() => setLocation('/cash-book/entry/in')}>
            <ArrowUpRight className="mr-2 h-5 w-5" /> Add Cash In
          </Button>
          <Button size="lg" variant="outline" className="w-full text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => setLocation('/cash-book/entry/out')}>
            <ArrowDownRight className="mr-2 h-5 w-5" /> Add Cash Out
          </Button>
        </div>
      </div>
    </div>
  );
}
