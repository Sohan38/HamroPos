import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCredit } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Banknote, Plus, Calendar, User } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function CreditList() {
  const [, setLocation] = useLocation();
  const { items, update } = useCredit();
  const { format } = useCurrency();

  const handleMarkPaid = (id: string) => {
    update(id, { 
      status: 'paid', 
      paidAt: new Date().toISOString() 
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Credit (Udharo)</h1>
          <p className="text-muted-foreground">Manage unpaid balances</p>
        </div>
        <Button onClick={() => setLocation('/credit/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> Add Credit
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-orange-500/10 border-orange-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-orange-800">Total Pending</p>
            <h2 className="text-2xl font-bold text-orange-600 mt-1">
              {format(items.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0))}
            </h2>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-200">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-green-800">Total Received</p>
            <h2 className="text-2xl font-bold text-green-600 mt-1">
              {format(items.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0))}
            </h2>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Banknote className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No credit records</h3>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((credit) => (
            <Card key={credit.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${credit.status === 'pending' ? 'bg-orange-500/10 text-orange-600' : 'bg-green-500/10 text-green-600'}`}>
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{credit.customerName}</div>
                    <div className="text-sm flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-muted-foreground mt-1">
                      <span>{credit.description}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(parseISO(credit.date), 'MMM d')}
                        {credit.dueDate && ` • Due: ${formatDate(parseISO(credit.dueDate), 'MMM d')}`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row md:flex-col justify-between items-center md:items-end w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border md:pl-6 gap-4">
                  <div className="text-right">
                    <div className={`font-bold text-lg ${credit.status === 'pending' ? 'text-orange-600' : 'text-green-600'}`}>
                      {format(credit.amount)}
                    </div>
                    {credit.status === 'paid' && (
                      <div className="text-xs text-muted-foreground">Paid {formatDate(parseISO(credit.paidAt!), 'MMM d')}</div>
                    )}
                  </div>
                  
                  {credit.status === 'pending' ? (
                    <Button size="sm" onClick={() => handleMarkPaid(credit.id)}>Mark Paid</Button>
                  ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Settled</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
