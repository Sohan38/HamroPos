import { useState } from 'react';
import { useLocation } from 'wouter';
import { useExpenses } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Plus, Calendar, Search } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';

export default function ExpenseList() {
  const [, setLocation] = useLocation();
  const { items } = useExpenses();
  const { format } = useCurrency();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground">{items.length} records</p>
        </div>
        <Button onClick={() => setLocation('/expenses/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> Add Expense
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Receipt className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No expenses recorded</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((expense) => (
            <Card key={expense.id} className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 flex-shrink-0">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{expense.description || expense.category}</div>
                    <div className="text-sm flex items-center gap-2 text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(parseISO(expense.date), 'MMM d, yyyy')} • <span className="capitalize">{expense.category}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between md:flex-col items-end md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6">
                  <div className="font-bold text-lg text-red-600">{format(expense.amount)}</div>
                  <Badge variant="outline" className="capitalize text-xs">
                    {expense.paymentMethod}
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
