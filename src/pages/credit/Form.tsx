import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCredit } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function CreditForm() {
  const goBack = useSmartBack('/credit');
  const [, setLocation] = useLocation();
  const { add } = useCredit();

  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    amount: '',
    description: '',
    dueDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.amount) {
      toast.error('Please fill required fields');
      return;
    }

    add({
      customerId: 'new', // Would connect to real customer in full app
      customerName: formData.customerName,
      phone: formData.phone,
      amount: Number(formData.amount),
      description: formData.description,
      date: new Date().toISOString(),
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      status: 'pending',
      paidAt: null,
      notes: ''
    });

    toast.success('Credit record added');
    setLocation('/credit');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Add Credit (Udharo)</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Name *</label>
              <Input 
                value={formData.customerName}
                onChange={e => setFormData({...formData, customerName: e.target.value})}
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Amount *</label>
              <Input 
                type="number"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="e.g. 5x Cement bags"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date (Optional)</label>
              <Input 
                type="date"
                value={formData.dueDate}
                onChange={e => setFormData({...formData, dueDate: e.target.value})}
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" size="lg" className="w-full md:w-auto">
                <Save className="mr-2 h-5 w-5" /> Save Record
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
