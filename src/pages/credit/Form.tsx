import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useCredit, useCustomers } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Search, Save, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { rankSearch } from '@/utils/search/rank';
import { Customer } from '@/types';

export default function CreditForm() {
  const goBack = useSmartBack('/credit');
  const [, setLocation] = useLocation();
  const { add } = useCredit();
  const { items: customers } = useCustomers();

  const [formData, setFormData] = useState({
    customerId: '',
    amount: '',
    description: '',
    dueDate: '',
  });
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerError, setCustomerError] = useState('');

  const selectedCustomer = useMemo(
    () => customers.find(customer => customer.id === formData.customerId),
    [customers, formData.customerId],
  );

  const customerResults = useMemo(() => {
    if (!customerQuery.trim()) return customers.slice(0, 8);
    return rankSearch(customers, customerQuery, 8);
  }, [customers, customerQuery]);

  const selectCustomer = (customer: Customer) => {
    setFormData(current => ({ ...current, customerId: customer.id }));
    setCustomerQuery('');
    setCustomerError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId) {
      setCustomerError('Select a customer before saving credit.');
      toast.error('A customer is required for credit');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Enter a credit amount greater than zero');
      return;
    }

    add({
      customerId: formData.customerId,
      customerName: selectedCustomer!.name,
      phone: selectedCustomer!.phone,
      amount: Number(formData.amount),
      paidAmount: 0,
      description: formData.description || 'Credit sale',
      date: new Date().toISOString(),
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      status: 'pending',
      paidAt: null,
      notes: '',
      payments: [],
    });

    toast.success('Credit record added');
    setLocation('/credit');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Add Credit</h1>
          <p className="text-sm text-muted-foreground">Record an udharo against a customer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-4 md:p-6 space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Customer *</label>
                <span className="text-[11px] text-muted-foreground">Search name or phone</span>
              </div>
              {selectedCustomer ? (
                <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                  <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedCustomer.phone || 'No phone number'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(current => ({ ...current, customerId: '' }))}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
                    aria-label="Change customer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={customerQuery}
                      onChange={e => { setCustomerQuery(e.target.value); setCustomerError(''); }}
                      placeholder="Search customers..."
                      className="h-11 pl-9 pr-9 text-base"
                      autoComplete="off"
                    />
                    {customerQuery && (
                      <button type="button" onClick={() => setCustomerQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {customerResults.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {customerResults.map(customer => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => selectCustomer(customer)}
                          className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-2 text-left shrink-0 hover:border-primary/50 hover:bg-primary/5 active:scale-[.98] transition-all"
                        >
                          <span className="h-6 w-6 rounded-full bg-background flex items-center justify-center text-[10px] font-bold text-primary">
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="max-w-32 truncate text-xs font-medium">{customer.name}</span>
                          <Check className="h-3.5 w-3.5 text-transparent" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed py-5 text-center">
                      <UserRound className="h-6 w-6 mx-auto mb-1 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">No matching customers</p>
                    </div>
                  )}
                </>
              )}
              {customerError && <p className="text-xs text-destructive">{customerError}</p>}
              {customers.length === 0 && !selectedCustomer && (
                <p className="text-xs text-muted-foreground">Add a customer first from Customers, then record their credit here.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount *</label>
              <Input
                type="number"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                min="0.01"
                inputMode="decimal"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. 5x Cement bags"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date (Optional)</label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" size="lg" className="w-full md:w-auto" disabled={customers.length === 0}>
                <Save className="mr-2 h-5 w-5" /> Save Record
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
