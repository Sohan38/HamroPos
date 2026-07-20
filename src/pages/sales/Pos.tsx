import { useState, useMemo, useRef, lazy, Suspense } from 'react';
import { useInventory, useSales, useCustomers, useProductBatches } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, QrCode, Banknote, User, SplitSquareHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod, ProductBatch, SaleInvoice } from '@/types';
const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner').then(module => ({ default: module.BarcodeScanner })));
const SaleBillPrint = lazy(() => import('@/components/SaleBillPrint').then(module => ({ default: module.SaleBillPrint })));


interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  sellingRate: number;
  maxQuantity: number;
  subtotal: number;
}


/**
 * FEFO deduction: given sorted batches (earliest expiry first),
 * deduct `needed` qty from them in order. Returns updated batch list.
 */
function fefoDeduct(
  batches: ProductBatch[],
  needed: number
): { id: string; quantity: number }[] {
  let remaining = needed;
  const updates: { id: string; quantity: number }[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;

    const deduction = Math.min(batch.quantity, remaining);

    updates.push({
      id: batch.id,
      quantity: batch.quantity - deduction,
    });

    remaining -= deduction;
  }

  return updates;
}

export default function SalesPos() {
  const { items: inventory, update: updateInventory } = useInventory();
  const { add: addSale } = useSales();
  const { items: customers } = useCustomers();
  const { items: batches, update: updateBatch } = useProductBatches();
  const { format, symbol } = useCurrency();
  const { settings } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [showCustomer, setShowCustomer] = useState(false);
  const [printSale, setPrintSale] = useState<SaleInvoice | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const availableProducts = useMemo(
    () => inventory.filter(product => product.quantity > 0),
    [inventory]
  );

  const inventoryById = useMemo(() => {
    const map = new Map<string, typeof inventory[number]>();

    for (const product of inventory) {
      map.set(product.id, product);
    }

    return map;
  }, [inventory]);

  // Name-only search for POS dropdown
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    if (!q) return [];

    return availableProducts
      .filter(product =>
        product.name.toLowerCase().includes(q) ||
        product.barcode?.toLowerCase().includes(q) ||
        product.category?.toLowerCase().includes(q) ||
        product.unit?.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        if (aName === q) return -1;
        if (bName === q) return 1;

        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return b.quantity - a.quantity;
      })
      .slice(0, 12);

  }, [availableProducts, searchQuery]);

  const addToCart = (product: typeof inventory[0]) => {
    setCart(current => {
      const existing = current.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} ${product.unit} in stock`);
          return current;
        }
        return current.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.sellingRate }
            : item
        );
      }
      return [...current, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        sellingRate: product.sellingRate,
        maxQuantity: product.quantity,
        subtotal: product.sellingRate,
      }];
    });
    setSearchQuery('');
    setShowResults(false);
    searchRef.current?.focus();
  };

  const handleBarcodeScanned = (barcode: string) => {
    const code = barcode.trim();

    const exact = inventory.find(
      p => p.barcode === code && p.quantity > 0
    );

    if (exact) {
      addToCart(exact);
      toast.success(`Added ${exact.name}`);
      return;
    }

    const partial = inventory.find(
      p =>
        p.quantity > 0 &&
        (
          p.barcode?.includes(code) ||
          code.includes(p.barcode ?? '')
        )
    );

    if (partial) {
      addToCart(partial);
      toast.success(`Added ${partial.name}`);
      return;
    }

    setSearchQuery(code);
    setShowResults(true);

    toast.error("Product not found");
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(current => current.map(item => {
      if (item.productId === productId) {
        const newQ = item.quantity + delta;
        if (newQ <= 0) return item;
        if (newQ > item.maxQuantity) { toast.error(`Only ${item.maxQuantity} in stock`); return item; }
        return { ...item, quantity: newQ, subtotal: newQ * item.sellingRate };
      }
      return item;
    }));
  };

  const setCartQuantity = (productId: string, qty: number) => {
    if (isNaN(qty) || qty < 1) return;
    setCart(current => current.map(item => {
      if (item.productId === productId) {
        if (qty > item.maxQuantity) {
          toast.error(`Only ${item.maxQuantity} in stock`);
          return { ...item, quantity: item.maxQuantity, subtotal: item.maxQuantity * item.sellingRate };
        }
        return { ...item, quantity: qty, subtotal: qty * item.sellingRate };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(current =>
      current.filter(item => item.productId !== productId)
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const taxAmount =
    Math.round((subtotal - discount) * (taxPercent / 100) * 100) / 100;

  const grandTotal = Math.max(
    0,
    subtotal - discount + taxAmount
  );

  const change =
    paidAmount !== '' && Number(paidAmount) > grandTotal
      ? Number(paidAmount) - grandTotal
      : 0;

  const batchesByProduct = useMemo(() => {
    const map = new Map<string, ProductBatch[]>();

    for (const batch of batches) {
      if (batch.quantity <= 0) continue;

      const list = map.get(batch.productId);

      if (list) {
        list.push(batch);
      } else {
        map.set(batch.productId, [batch]);
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return 0;
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;

        return a.expiryDate.localeCompare(b.expiryDate);
      });
    }

    return map;
  }, [batches]);

  const handleCheckout = () => {
    if (cart.length === 0) return;

    // Validate stock
    const stockErrors = cart
      .map(item => {
        const product = inventoryById.get(item.productId);

        if (!product) {
          return `${item.productName} no longer exists`;
        }

        if (product.quantity < item.quantity) {
          return `${item.productName} (available: ${product.quantity}, needed: ${item.quantity})`;
        }

        return null;
      })
      .filter(Boolean);

    if (stockErrors.length > 0) {
      toast.error(`Insufficient stock: ${stockErrors.join('; ')}`);
      return;
    }

    // Validate paid amount if entered (must cover total)
    if (paidAmount !== '' && Number(paidAmount) < grandTotal) {
      toast.error(`Paid amount (${format(Number(paidAmount))}) is less than total (${format(grandTotal)})`);
      return;
    }

    try {
      const saleRecord: Omit<SaleInvoice, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'> = {
        customerId: customerId || null,
        date: new Date().toISOString(),
        items: cart.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          sellingRate: i.sellingRate,
          subtotal: i.subtotal,
        })),
        discount,
        tax: taxAmount,
        grandTotal,
        paidAmount: paidAmount !== '' ? Number(paidAmount) : grandTotal,
        paymentMethod,
        notes: '',
      };




      // Save sale ONCE
      addSale(saleRecord);

      // Deduct stock (FEFO) and update inventory
      for (const item of cart) {
        const product = inventoryById.get(item.productId);

        if (!product) continue;

        const productBatches = batchesByProduct.get(item.productId) ?? [];

        if (productBatches.length > 0) {
          const updates = fefoDeduct(productBatches, item.quantity);

          for (const batch of updates) {
            updateBatch(batch.id, {
              quantity: batch.quantity,
            });
          }
        }

        updateInventory(product.id, {
          quantity: product.quantity - item.quantity,
        });
      }

      toast.success('Sale completed!');

      const tempSale: SaleInvoice = {
        ...saleRecord,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        version: 1,
      };
      setPrintSale(tempSale);

      setCart([]);
      setDiscount(0);
      setTaxPercent(0);
      setPaidAmount('');
      setCustomerId('');
      setSearchQuery('');
    } catch (error) {
      toast.error('Checkout failed');
      console.error(error);
    }
  };


  const selectedCustomer = customers.find(c => c.id === customerId);

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] md:h-screen bg-muted/20">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Left — Search & Products */}
        <div className="flex-1 flex flex-col p-3 lg:p-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-xl font-bold hidden md:block shrink-0">Point of Sale</h1>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                placeholder="Search product by name..."
                className="pl-10 h-12 text-base shadow-sm border-primary/20 focus-visible:ring-primary"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => { if (searchQuery) setShowResults(true); }}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
              />
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y">
                    {searchResults.map(product => (
                      <button
                        key={product.id}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted text-left transition-colors"
                        onMouseDown={() => addToCart(product)}
                      >
                        <div>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {product.barcode && <span className="mr-2">#{product.barcode}</span>}
                            <span className="text-green-600 font-medium">Stock: {product.quantity} {product.unit}</span>
                            {product.category && <span className="ml-2">• {product.category}</span>}
                          </div>
                        </div>
                        <div className="font-bold text-primary ml-2 shrink-0">{format(product.sellingRate)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showResults && searchQuery.trim() && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-xl z-50 p-4 text-center text-sm text-muted-foreground">
                  No products found for "{searchQuery}"
                </div>
              )}
            </div>
            <Suspense fallback={null}>
              <BarcodeScanner onScan={handleBarcodeScanned} />
            </Suspense>
          </div>

          {/* Quick Products Grid */}
          <div className="flex-1 overflow-y-auto hidden md:block">
            <h3 className="font-medium mb-3 text-muted-foreground text-sm">
              Quick Add — {availableProducts.length} in stock
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {availableProducts.slice(0, 16).map(product => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all active:scale-95"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3 text-center">
                    <div className="font-semibold truncate text-sm" title={product.name}>{product.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{product.quantity} {product.unit}</div>
                    <div className="text-primary font-bold text-sm mt-1">{format(product.sellingRate)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Cart & Checkout */}
        <div className="w-full lg:w-[380px] xl:w-[420px] bg-card border-l flex flex-col shadow-xl z-10">
          <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Order
              {cart.length > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
                onClick={() => setShowCustomer(!showCustomer)}>
                <User className="h-3.5 w-3.5" />
                {selectedCustomer ? selectedCustomer.name.split(' ')[0] : 'Customer'}
              </Button>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => setCart([])}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {showCustomer && (
            <div className="p-3 border-b bg-muted/10">
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select customer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Walk-in Customer</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.phone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground py-16">
                  <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs mt-1">Search or scan items</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.productId} className="flex flex-col gap-1.5 p-3 bg-muted/30 rounded-lg border">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-medium text-sm line-clamp-2 flex-1">{item.productName}</span>
                        <button onClick={() => removeFromCart(item.productId)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">{format(item.sellingRate)} each</span>
                        <div className="flex items-center gap-1">
                          <button
                            className="h-7 w-7 rounded border flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors"
                            onClick={() => {
                              if (item.quantity === 1) removeFromCart(item.productId);
                              else updateCartQuantity(item.productId, -1);
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <Input
                            type="number"
                            className="h-7 w-12 text-center text-sm p-0 font-semibold"
                            value={item.quantity}
                            onChange={e => setCartQuantity(item.productId, parseInt(e.target.value))}
                            min={1}
                            max={item.maxQuantity}
                          />
                          <button
                            className="h-7 w-7 rounded border flex items-center justify-center hover:bg-green-500/10 text-green-600 transition-colors"
                            onClick={() => updateCartQuantity(item.productId, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <span className="font-bold text-sm ml-2 w-20 text-right">{format(item.subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Checkout Panel */}
          <div className="p-3 border-t bg-muted/10 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Discount ({symbol})</label>
                <Input
                  type="number" placeholder="0" className="h-9 text-sm"
                  value={discount || ''}
                  min={0}
                  max={subtotal}
                  onChange={e => setDiscount(Math.max(0, Math.min(subtotal, Number(e.target.value))))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tax %</label>
                <Select value={taxPercent.toString()} onValueChange={v => setTaxPercent(Number(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No Tax</SelectItem>
                    <SelectItem value="13">13% VAT</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{format(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span><span>- {format(discount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({taxPercent}%)</span><span>{format(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t font-bold text-lg">
                <span>Total</span>
                <span className="text-primary text-xl">{format(grandTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(['cash', 'qr', 'card', 'bank'] as PaymentMethod[]).map(m => (
                <Button
                  key={m}
                  variant={paymentMethod === m ? 'default' : 'outline'}
                  className="flex-col h-14 gap-1 text-xs"
                  onClick={() => setPaymentMethod(m)}
                >
                  {m === 'cash' && <Banknote className="h-4 w-4" />}
                  {m === 'qr' && <QrCode className="h-4 w-4" />}
                  {m === 'card' && <CreditCard className="h-4 w-4" />}
                  {m === 'bank' && <SplitSquareHorizontal className="h-4 w-4" />}
                  <span className="capitalize">{m === 'bank' ? 'Bank' : m}</span>
                </Button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Paid Amount</label>
              <Input
                type="number"
                placeholder={`${format(grandTotal)} (exact)`}
                className={`h-11 text-base font-bold ${paidAmount !== '' && Number(paidAmount) < grandTotal ? 'border-destructive' : ''}`}
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value ? Number(e.target.value) : '')}
              />
              {paidAmount !== '' && Number(paidAmount) < grandTotal && (
                <p className="text-xs text-destructive">Amount is short by {format(grandTotal - Number(paidAmount))}</p>
              )}
              {change > 0 && (
                <div className="text-sm font-semibold text-green-600">Change: {format(change)}</div>
              )}
            </div>

            <Button
              size="lg"
              className="w-full h-13 text-base font-bold shadow-md"
              disabled={cart.length === 0 || (paidAmount !== '' && Number(paidAmount) < grandTotal)}
              onClick={handleCheckout}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Checkout • {format(grandTotal)}
            </Button>
          </div>
        </div>
      </div>

      {printSale && (
        <Suspense fallback={null}>
          <SaleBillPrint
            sale={printSale}
            settings={settings}
            customerName={selectedCustomer?.name}
            open={!!printSale}
            onClose={() => setPrintSale(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
