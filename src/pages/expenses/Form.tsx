import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useExpenses } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Banknote,
  Droplets,
  FileText,
  Fuel,
  Landmark,
  Package,
  Plus,
  Save,
  ShoppingCart,
  Tag,
  Trash2,
  Utensils,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethodPicker, SettlePaymentMethod } from '@/components/PaymentMethodPicker';

// Predefined categories with icons
const CATEGORY_OPTIONS = [
  { value: 'salary', label: 'Salary', icon: Banknote },
  { value: 'electricity', label: 'Electricity', icon: Zap },
  { value: 'water', label: 'Water', icon: Droplets },
  { value: 'internet', label: 'Internet', icon: Wifi },
  { value: 'food', label: 'Food', icon: Utensils },
  { value: 'fuel', label: 'Fuel', icon: Fuel },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'tax', label: 'Tax', icon: Landmark },
  { value: 'purchase', label: 'Purchase', icon: ShoppingCart },
  { value: 'miscellaneous', label: 'Misc', icon: Package },
];

interface ExpenseFormData {
  amount: string;
  category: string; // can be predefined or 'other'
  description: string;
  paymentMethod: SettlePaymentMethod;
  notes: string;
}

export default function ExpenseForm() {
  const goBack = useSmartBack('/expenses');
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const { add, update, items, remove } = useExpenses();

  const isNew = !id || id === 'new';
  const existing = useMemo(
    () => (isNew ? null : items.find(e => e.id === id) ?? null),
    [isNew, items, id]
  );

  const [formData, setFormData] = useState<ExpenseFormData>({
    amount: '',
    category: 'miscellaneous',
    description: '',
    paymentMethod: 'cash',
    notes: '',
  });
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  // Load existing expense data for editing
  useEffect(() => {
    if (existing) {
      const isPredefined = CATEGORY_OPTIONS.some(c => c.value === existing.category);
      setFormData({
        amount: String(existing.amount ?? ''),
        category: isPredefined ? existing.category : 'other',
        description: existing.description ?? '',
        paymentMethod: (existing.paymentMethod as SettlePaymentMethod) ?? 'cash',
        notes: existing.notes ?? '',
      });
      if (!isPredefined) {
        setCustomCategory(existing.category);
        setShowCustomCategory(true);
      } else {
        setCustomCategory('');
        setShowCustomCategory(false);
      }
    }
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(formData.amount);

    // Determine final category
    let finalCategory = formData.category;
    if (formData.category === 'other') {
      finalCategory = customCategory.trim();
      if (!finalCategory) {
        toast.error('Please enter a custom category');
        return;
      }
    }

    if (!formData.amount || Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a positive amount');
      return;
    }

    const payload = {
      date: existing?.date ?? new Date().toISOString(),
      category: finalCategory,
      description: formData.description,
      amount: amountNum,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes,
    };

    try {
      if (isNew) {
        await add(payload as any);
        toast.success('Expense recorded');
      } else if (existing) {
        update(existing.id, payload as any);
        toast.success('Expense updated');
      }
      setLocation('/expenses');
    } catch (error) {
      toast.error('Failed to save expense');
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!confirm('Delete this expense?')) return;
    await remove(existing.id);
    toast.success('Expense deleted');
    setLocation('/expenses');
  };

  const handleCategorySelect = (categoryValue: string) => {
    setFormData(prev => ({ ...prev, category: categoryValue }));
    setShowCustomCategory(categoryValue === 'other');
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-24 md:pb-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isNew ? 'Add Expense' : 'Edit Expense'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                Amount *
              </label>
              <Input
                type="number"
                className="text-2xl h-14 font-semibold"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                required
                autoFocus
                min="0"
                step="0.01"
              />
            </div>

            {/* Category */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleCategorySelect(value)}
                    className={`
                      flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
                      transition-colors
                      ${formData.category === value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'}
                    `}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
                {/* Custom category option */}
                <button
                  type="button"
                  onClick={() => handleCategorySelect('other')}
                  className={`
                    flex items-center gap-2 rounded-lg border px-3 py-2 text-sm
                    transition-colors
                    ${formData.category === 'other'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'}
                  `}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Other</span>
                </button>
              </div>

              {showCustomCategory && (
                <Input
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category"
                  className="mt-2"
                />
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description
              </label>
              <Input
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Internet bill for May"
              />
            </div>

            {/* Payment Method - using PaymentMethodPicker */}
            <PaymentMethodPicker
              label="Payment method"
              selectedMethod={formData.paymentMethod}
              onSelect={method => setFormData(prev => ({ ...prev, paymentMethod: method }))}
              methods={['cash', 'qr', 'card', 'bank']}
            />

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Notes
              </label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes…"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {!isNew && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  type="button"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              )}
              <Button type="submit" size="lg" className="ml-auto w-full md:w-auto">
                <Save className="mr-2 h-5 w-5" />
                {isNew ? 'Record Expense' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}