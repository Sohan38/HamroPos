import { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useCashBook } from '@/contexts/GlobalProviders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';

export default function CashBookForm() {
  const [, setLocation] = useLocation();
  const { type } = useParams<{ type: string }>(); // 'in' or 'out'
  const { items, add, update } = useCashBook();
  
  const isOut = type === 'out';
  const today = new Date().toISOString().split('T')[0];
  const todayEntry = items.find(i => i.date === today);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    
    if (!numAmount || numAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    if (todayEntry) {
      // Update existing today entry
      const newCashIn = todayEntry.cashIn + (!isOut ? numAmount : 0);
      const newCashOut = todayEntry.cashOut + (isOut ? numAmount : 0);
      
      update(todayEntry.id, {
        cashIn: newCashIn,
        cashOut: newCashOut,
        closingCash: todayEntry.openingCash + newCashIn - newCashOut,
        reason: todayEntry.reason ? `${todayEntry.reason}, ${reason}` : reason
      });
    } else {
      // Find last entry's closing to use as opening
      const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
      const lastClosing = sorted.length > 0 ? sorted[0].closingCash : 0;
      
      add({
        date: today,
        openingCash: lastClosing,
        cashIn: !isOut ? numAmount : 0,
        cashOut: isOut ? numAmount : 0,
        closingCash: lastClosing + (!isOut ? numAmount : -numAmount),
        reason,
        notes: ''
      });
    }

    toast.success(`Cash ${isOut ? 'out' : 'in'} recorded`);
    setLocation('/cash-book');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/cash-book')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Add Cash {isOut ? 'Out' : 'In'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className={`border-t-4 ${isOut ? 'border-t-destructive' : 'border-t-green-500'}`}>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-center mb-6">
              <div className={`p-4 rounded-full ${isOut ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'}`}>
                {isOut ? <ArrowDownRight className="h-10 w-10" /> : <ArrowUpRight className="h-10 w-10" />}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount *</label>
              <Input 
                type="number"
                className="text-2xl h-14"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason / Details</label>
              <Input 
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Change, Withdrawal, Owner"
              />
            </div>

            <div className="pt-4">
              <Button type="submit" size="lg" className="w-full" variant={isOut ? "destructive" : "default"}>
                <Save className="mr-2 h-5 w-5" /> Record Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
