import { useState } from 'react';
import { useLocation } from 'wouter';
import { usePurchases, useSuppliers, useInventory } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { useFeature } from '@/hooks/useFeature';

export default function PurchaseForm() {
  const isDiscountsEnabled = useFeature('sales', 'discounts');
  const goBack = useSmartBack('/purchases');
  const [, setLocation] = useLocation();
  const { add } = usePurchases();
  const { items: suppliers } = useSuppliers();
  const { items: inventory, update: updateInventory } = useInventory();
  const { format } = useCurrency();

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [items, setItems] = useState<{productId: string, productName: string, quantity: number, purchaseRate: number, subtotal: number}[]>([]);
  const [discount, setDiscount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const grandTotal = subtotal - (isDiscountsEnabled ? Number(discount) || 0 : 0);

  const addItem = (product: any) => {
    setItems([...items, { 
      productId: product.id, 
      productName: product.name, 
      quantity: 1, 
      purchaseRate: product.purchaseRate, 
      subtotal: product.purchaseRate 
    }]);
    setSearchQuery('');
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];
    (item as any)[field] = value;
    
    if (field === 'quantity' || field === 'purchaseRate') {
      item.subtotal = Number(item.quantity) * Number(item.purchaseRate);
    }
    
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) {
      toast.error('Supplier and items are required');
      return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);
    add({
      invoiceNumber,
      supplierId,
      supplierName: supplier?.name || null,
      date: new Date().toISOString(),
      items,
      discount: isDiscountsEnabled ? Number(discount) || 0 : 0,
      tax: 0,
      grandTotal,
      paymentMethod: 'cash',
      notes: ''
    });

    // Update inventory stock and purchase rates automatically
    items.forEach(item => {
      const product = inventory.find(p => p.id === item.productId);
      if (product) {
        updateInventory(product.id, {
          quantity: product.quantity + Number(item.quantity),
          purchaseRate: Number(item.purchaseRate)
        });
      }
    });

    toast.success('Purchase invoice recorded');
    setLocation('/purchases');
  };

  const searchResults = inventory.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.barcode.includes(searchQuery)
  ).slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">New Purchase Invoice</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Supplier *</label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Invoice Number</label>
                  <Input 
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-12345"
                  />
                </div>
              </div>

              <div className="relative pt-4">
                <Search className="absolute left-3 top-1/2 mt-2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search products to add..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-10">
                    {searchResults.map(p => (
                      <div 
                        key={p.id} 
                        className="p-3 hover:bg-muted cursor-pointer flex justify-between"
                        onClick={() => addItem(p)}
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">Current Stock: {p.quantity}</div>
                        </div>
                        <span className="font-semibold text-muted-foreground">{format(p.purchaseRate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 border rounded-lg overflow-hidden">
                {/* Headers: only visible on desktop */}
                <div className="hidden md:grid grid-cols-12 gap-2 bg-muted p-2 text-xs font-semibold text-muted-foreground uppercase">
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Rate</div>
                  <div className="col-span-2">Total</div>
                  <div className="col-span-1"></div>
                </div>
                
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Search and add products to invoice
                  </div>
                ) : (
                  <div className="divide-y">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-2 p-3 md:p-2 items-start md:items-center">
                        {/* Product Title */}
                        <div className="w-full md:col-span-5 font-semibold md:font-medium truncate pr-2 text-sm md:text-base">
                          {item.productName}
                        </div>

                        {/* Inputs wrapper for mobile */}
                        <div className="w-full md:contents grid grid-cols-2 md:grid-cols-none gap-2">
                          <div className="flex flex-col md:col-span-2 gap-1 md:gap-0">
                            <span className="text-[10px] uppercase font-semibold text-muted-foreground md:hidden">Qty</span>
                            <Input 
                              type="number" 
                              className="h-8 w-full"
                              value={item.quantity || ''}
                              onChange={e => updateItem(index, 'quantity', e.target.value)}
                            />
                          </div>

                          <div className="flex flex-col md:col-span-2 gap-1 md:gap-0">
                            <span className="text-[10px] uppercase font-semibold text-muted-foreground md:hidden">Rate</span>
                            <Input 
                              type="number" 
                              className="h-8 w-full"
                              value={item.purchaseRate || ''}
                              onChange={e => updateItem(index, 'purchaseRate', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Total and Delete actions */}
                        <div className="w-full md:contents flex justify-between items-center mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                          <div className="md:col-span-2 font-semibold text-right pr-2">
                            <span className="text-xs text-muted-foreground font-normal md:hidden mr-2">Total:</span>
                            {format(item.subtotal)}
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="md:col-span-1 h-8 w-8 text-destructive" 
                            onClick={() => setItems(items.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
          <Card className="sticky top-20 bg-muted/10">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-bold text-lg border-b pb-2">Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{format(subtotal)}</span>
                </div>
                {isDiscountsEnabled && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Discount</span>
                    <Input 
                      type="number" 
                      className="w-24 h-8 text-right" 
                      value={discount} 
                      onChange={e => setDiscount(e.target.value)} 
                    />
                  </div>
                )}
                
                <div className="border-t pt-4 mt-2 flex justify-between items-center">
                  <span className="font-bold text-lg">Grand Total</span>
                  <span className="font-bold text-2xl text-green-600">{format(grandTotal)}</span>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3 border-t">
                <p className="text-xs text-muted-foreground text-center">Saving will automatically update inventory stock and purchase rates.</p>
                <Button type="submit" size="lg" className="w-full">
                  <Save className="mr-2 h-5 w-5" /> Save Purchase
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
