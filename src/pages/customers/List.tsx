import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCustomers } from '@/contexts/GlobalProviders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, User, Phone, MapPin } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { useSort } from '@/hooks/useSort';
import { v4 as uuidv4 } from 'uuid';

export default function CustomerList() {
  const [, setLocation] = useLocation();
  const { items, add, update, remove } = useCustomers();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', email: '', notes: '' });

  const { query, setQuery, filteredItems } = useSearch(items, ['name', 'phone', 'address']);
  const { sortedItems } = useSort(filteredItems, { key: 'name', direction: 'asc' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    add(formData);
    setFormData({ name: '', phone: '', address: '', email: '', notes: '' });
    setShowAddForm(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">{items.length} records</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> Add Customer
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-primary/20">
          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                <Input placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                <Input placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                <Input placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button type="submit">Save Customer</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search customers..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedItems.map(customer => (
          <Card key={customer.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="font-semibold text-lg">{customer.name}</div>
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {customer.phone || 'N/A'}</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {customer.address || 'N/A'}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
