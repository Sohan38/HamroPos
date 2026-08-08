import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useExpenses } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['salary', 'electricity', 'water', 'internet', 'food', 'fuel', 'maintenance', 'tax', 'purchase', 'miscellaneous'];

export default function ExpenseForm() {
  const goBack = useSmartBack('/expenses');
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { add, update, items, remove } = useExpenses();

  const isNew = !id || id === 'new';
  const existing = isNew ? null : items.find(e => e.id === id) ?? null;

  const [formData, setFormData] = useState({
    amount: '',
    category: 'miscellaneous',
    description: '',
    paymentMethod: 'cash'
  });

  useEffect(() => {
    if (existing) {
      setFormData({
        amount: String(existing.amount ?? ''),
        category: existing.category ?? 'miscellaneous',
        description: existing.description ?? '',
        paymentMethod: existing.paymentMethod ?? 'cash',
      });
    }
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(formData.amount);
    if (!formData.category || !formData.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a positive amount and category');
      return;
    }

    if (isNew) {
      await add({
        date: new Date().toISOString(),
        category: formData.category as any,
        description: formData.description,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod as any,
        notes: ''
      });
      toast.success('Expense recorded');
    } else if (existing) {
      await update(existing.id, {
        date: existing.date,
        category: formData.category as any,
        description: formData.description,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod as any,
        notes: existing.notes ?? ''
      } as any);
      toast.success('Expense updated');
    }

    setLocation('/expenses');
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm('Delete this expense?')) return;
    await remove(existing.id);
    toast.success('Expense deleted');
    setLocation('/expenses');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{isNew ? 'Add Expense' : 'Edit Expense'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount *</label>
              <Input
                type="number"
                className="text-xl h-12"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category *</label>
              <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Internet bill for May"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select value={formData.paymentMethod} onValueChange={v => setFormData({ ...formData, paymentMethod: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="qr">QR / Digital</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 flex justify-between items-center">
              {!isNew && (
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              )}
              <div className="flex-1" />
              <Button type="submit" size="lg" className="w-full md:w-auto">
                <Save className="mr-2 h-5 w-5" /> {isNew ? 'Record Expense' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
