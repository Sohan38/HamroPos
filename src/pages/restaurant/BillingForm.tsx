import { useState } from 'react';
import { useLocation } from 'wouter';
import { useRestaurantBills, useInventory } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function RestaurantBillingForm() {
  const goBack = useSmartBack('/restaurant');
  const [, setLocation] = useLocation();
  const { add } = useRestaurantBills();
  const { items: inventory } = useInventory();
  const { format } = useCurrency();

  const [tableNumber, setTableNumber] = useState('');
  const [items, setItems] = useState<{name: string, quantity: number, rate: number, total: number}[]>([]);
  const [discount, setDiscount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const grandTotal = subtotal - Number(discount);

  const addItem = (product?: any) => {
    if (product) {
      setItems([...items, { name: product.name, quantity: 1, rate: product.sellingRate, total: product.sellingRate }]);
      setSearchQuery('');
    } else {
      setItems([...items, { name: '', quantity: 1, rate: 0, total: 0 }]);
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];
    (item as any)[field] = value;
    
    if (field === 'quantity' || field === 'rate') {
      item.total = Number(item.quantity) * Number(item.rate);
    }
    
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber || items.length === 0) {
      toast.error('Table number and items are required');
      return;
    }

    add({
      billNumber: `REST-${Math.floor(Math.random()*10000)}`,
      tableNumber,
      date: new Date().toISOString(),
      items,
      discount: Number(discount),
      tax: 0,
      grandTotal,
      paidAmount: grandTotal,
      paymentMethod: 'cash',
      notes: ''
    });

    toast.success('Restaurant Bill generated');
    setLocation('/restaurant');
  };

  const searchResults = inventory.filter(i => 
    i.category.toLowerCase().includes('food') || 
    i.category.toLowerCase().includes('beverage') ||
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">New Restaurant Bill / KOT</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4 items-end mb-6">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Table Number *</label>
                  <Input 
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    placeholder="e.g. T1, T2"
                    required
                  />
                </div>
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search menu items..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-10">
                      {searchResults.map(p => (
                        <div 
                          key={p.id} 
                          className="p-2 hover:bg-muted cursor-pointer flex justify-between"
                          onClick={() => addItem(p)}
                        >
                          <span>{p.name}</span>
                          <span className="font-semibold">{format(p.sellingRate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Order Items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => addItem()}>
                    <Plus className="h-4 w-4 mr-1" /> Custom Item
                  </Button>
                </div>
                
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    No items added yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col md:flex-row gap-3 md:gap-2 bg-muted/30 p-3 md:p-2 rounded-lg border">
                        {/* Item Name */}
                        <Input 
                          placeholder="Item name" 
                          value={item.name}
                          onChange={e => updateItem(index, 'name', e.target.value)}
                          className="w-full md:flex-1 bg-transparent border-0 md:border font-semibold md:font-normal"
                        />
                        
                        {/* Qty & Rate wrapper */}
                        <div className="flex gap-2 w-full md:w-auto">
                          <div className="flex-1 md:flex-none">
                            <Input 
                              type="number" 
                              placeholder="Qty" 
                              value={item.quantity || ''}
                              onChange={e => updateItem(index, 'quantity', e.target.value)}
                              className="w-full md:w-16 bg-transparent"
                            />
                          </div>
                          <div className="flex-1 md:flex-none">
                            <Input 
                              type="number" 
                              placeholder="Rate" 
                              value={item.rate || ''}
                              onChange={e => updateItem(index, 'rate', e.target.value)}
                              className="w-full md:w-20 bg-transparent"
                            />
                          </div>
                          
                          {/* Total and Actions */}
                          <div className="flex items-center gap-2 pl-2 shrink-0">
                            <div className="w-20 font-semibold text-right pr-2 text-sm md:text-base">
                              {format(item.total)}
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== index))} className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-20">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-bold text-lg border-b pb-2">Summary</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{format(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <Input 
                    type="number" 
                    className="w-20 h-8 text-right" 
                    value={discount} 
                    onChange={e => setDiscount(e.target.value)} 
                  />
                </div>
                
                <div className="border-t pt-4 mt-2 flex justify-between items-center">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-2xl text-orange-600">{format(grandTotal)}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3 border-t">
                <Button type="button" variant="outline" className="w-full" onClick={() => window.print()}>
                  Print KOT
                </Button>
                <Button type="submit" size="lg" className="w-full">
                  <Save className="mr-2 h-5 w-5" /> Settle Bill
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
