import { useState, useMemo, useRef, lazy, Suspense, useEffect, useCallback } from 'react';
import { useInventory, useSales, useCustomers, useProductBatches } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { useApp } from '@/contexts/AppContext';
import { useBackModal, useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, QrCode,
  Banknote, User, SplitSquareHorizontal, ArrowLeft, X, ChevronUp, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod, ProductBatch, SaleInvoice } from '@/types';
const BarcodeScanner = lazy(() => import('@/components/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })));
const SaleBillPrint = lazy(() => import('@/components/SaleBillPrint').then(m => ({ default: m.SaleBillPrint })));

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  sellingRate: number;
  maxQuantity: number;
  subtotal: number;
}

function fefoDeduct(batches: ProductBatch[], needed: number): { id: string; quantity: number }[] {
  let remaining = needed;
  const updates: { id: string; quantity: number }[] = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const deduction = Math.min(batch.quantity, remaining);
    updates.push({ id: batch.id, quantity: batch.quantity - deduction });
    remaining -= deduction;
  }
  return updates;
}

import { useFeature } from '@/hooks/useFeature';
import { ProductCard } from '@/components/pos/ProductCard';

export default function SalesPos() {
  const isDiscountsEnabled = useFeature('sales', 'discounts');
  const goBack = useSmartBack('/sales');
  const { items: inventory, update: updateInventory } = useInventory();
  const { add: addSale } = useSales();
  const { items: customers } = useCustomers();
  const { items: batches, update: updateBatch } = useProductBatches();
  const { format, symbol } = useCurrency();
  const { settings } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [showCustomer, setShowCustomer] = useState(false);
  const [printSale, setPrintSale] = useState<SaleInvoice | null>(null);

  // Mobile-specific state
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const overlaySearchRef = useRef<HTMLInputElement>(null);

  useBackModal(showCustomer, () => setShowCustomer(false), 'pos-customer-sheet');

  // When cart drawer opens/closes, prevent body scroll
  useEffect(() => {
    if (cartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [cartOpen]);

  // Focus overlay search input when search opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => overlaySearchRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 120);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  const availableProducts = useMemo(() => {
    return inventory
      .filter(p => p.quantity > 0)
      .map(product => ({
        ...product,
        _search:
          [
            product.name,
            product.barcode,
            product.category,
            product.unit,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
      }));
  }, [inventory]);

  const inventoryById = useMemo(() => {
    const map = new Map<string, typeof inventory[number]>();
    for (const p of inventory) map.set(p.id, p);
    return map;
  }, [inventory]);

  const barcodeMap = useMemo(() => {
    const map = new Map<string, typeof inventory[number]>();

    for (const product of inventory) {
      if (product.quantity > 0 && product.barcode) {
        map.set(product.barcode.trim(), product);
      }
    }


    return map;
  }, [inventory]);

  const customerMap = useMemo(() => {
    const map = new Map<string, typeof customers[number]>();

    for (const customer of customers) {
      map.set(customer.id, customer);
    }

    return map;
  }, [customers]);

  const searchResults = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [];
    return availableProducts
      .filter(p =>
        p._search.includes(q)
      )
      .sort((a, b) => {
        const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
        if (an === q) return -1;
        if (bn === q) return 1;
        if (an.startsWith(q) && !bn.startsWith(q)) return -1;
        if (!an.startsWith(q) && bn.startsWith(q)) return 1;
        return b.quantity - a.quantity;
      })
      .slice(0, 20);
  }, [availableProducts, searchQuery]);

  const addToCart = (product: typeof inventory[0]) => {
    setCart(cur => {
      const existing = cur.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} ${product.unit} in stock`);
          return cur;
        }
        return cur.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.sellingRate }
            : i
        );
      }
      return [...cur, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        sellingRate: product.sellingRate,
        maxQuantity: product.quantity,
        subtotal: product.sellingRate,
      }];
    });
    setSearchQuery('');
    closeSearch();
    toast.success(`Added ${product.name}`, { duration: 1200 });
  };

  const handleBarcodeScanned = (barcode: string) => {
    const code = barcode.trim();
    const exact = barcodeMap.get(code);
    if (exact) { addToCart(exact); toast.success(`Added ${exact.name}`); return; }
    const partial = inventory.find(p => p.quantity > 0 && (p.barcode?.includes(code) || code.includes(p.barcode ?? '')));
    if (partial) { addToCart(partial); toast.success(`Added ${partial.name}`); return; }
    setSearchQuery(code);
    setSearchOpen(true);
    toast.error('Product not found');
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(cur => cur.map(item => {
      if (item.productId !== productId) return item;
      const newQ = item.quantity + delta;
      if (newQ <= 0) return item;
      if (newQ > item.maxQuantity) { toast.error(`Only ${item.maxQuantity} in stock`); return item; }
      return { ...item, quantity: newQ, subtotal: newQ * item.sellingRate };
    }));
  };

  const setCartQuantity = (productId: string, qty: number) => {
    if (isNaN(qty) || qty < 1) return;
    setCart(cur => cur.map(item => {
      if (item.productId !== productId) return item;
      if (qty > item.maxQuantity) {
        toast.error(`Only ${item.maxQuantity} in stock`);
        return { ...item, quantity: item.maxQuantity, subtotal: item.maxQuantity * item.sellingRate };
      }
      return { ...item, quantity: qty, subtotal: qty * item.sellingRate };
    }));
  };

  const removeFromCart = (productId: string) => setCart(cur => cur.filter(i => i.productId !== productId));

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const taxAmount = Math.round((subtotal - discount) * (taxPercent / 100) * 100) / 100;
  const grandTotal = Math.max(0, subtotal - discount + taxAmount);
  const change = paidAmount !== '' && Number(paidAmount) > grandTotal ? Number(paidAmount) - grandTotal : 0;

  const batchesByProduct = useMemo(() => {
    const map = new Map<string, ProductBatch[]>();
    for (const batch of batches) {
      if (batch.quantity <= 0) continue;
      const list = map.get(batch.productId);
      if (list) list.push(batch);
      else map.set(batch.productId, [batch]);
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
    const stockErrors = cart.map(item => {
      const p = inventoryById.get(item.productId);
      if (!p) return `${item.productName} no longer exists`;
      if (p.quantity < item.quantity) return `${item.productName} (available: ${p.quantity}, needed: ${item.quantity})`;
      return null;
    }).filter(Boolean);
    if (stockErrors.length > 0) { toast.error(`Insufficient stock: ${stockErrors.join('; ')}`); return; }
    if (paidAmount !== '' && Number(paidAmount) < grandTotal) {
      toast.error(`Paid amount (${format(Number(paidAmount))}) is less than total (${format(grandTotal)})`);
      return;
    }
    try {
      const saleRecord: Omit<SaleInvoice, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'> = {
        customerId: customerId || null,
        customerName: customerId
          ? (customerMap.get(customerId)?.name ?? null)
          : null,
        date: new Date().toISOString(),
        items: cart.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          sellingRate: i.sellingRate,
          subtotal: i.subtotal,
        })),
        discount, tax: taxAmount, grandTotal,
        paidAmount: paidAmount !== '' ? Number(paidAmount) : grandTotal,
        paymentMethod, notes: '',
      };
      addSale(saleRecord);
      for (const item of cart) {
        const p = inventoryById.get(item.productId);
        if (!p) continue;
        const pb = batchesByProduct.get(item.productId) ?? [];
        if (pb.length > 0) {
          for (const b of fefoDeduct(pb, item.quantity)) updateBatch(b.id, { quantity: b.quantity });
        }
        updateInventory(p.id, { quantity: p.quantity - item.quantity });
      }
      toast.success('Sale completed!');
      setPrintSale({
        ...saleRecord,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        version: 1,
      });
      setCart([]); setDiscount(0); setTaxPercent(0); setPaidAmount(''); setCustomerId('');
      setCartOpen(false);
    } catch (e) {
      toast.error('Checkout failed');
      console.error(e);
    }
  };

  const selectedCustomer = customerId
    ? customerMap.get(customerId)
    : undefined;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // ─── Shared cart panel contents ───────────────────────────────────────────
  const CartPanel = ({ inDrawer = false }: { inDrawer?: boolean }) => (
    <div className={`flex flex-col ${inDrawer ? 'h-full' : 'flex-1'}`}>
      {/* Cart header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Order
          {cart.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
              {cartCount}
            </span>
          )}
        </h2>
        <div className="flex gap-1 items-center">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
            onClick={() => setShowCustomer(v => !v)}>
            <User className="h-3.5 w-3.5" />
            {selectedCustomer ? selectedCustomer.name.split(' ')[0] : 'Customer'}
          </Button>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive"
              onClick={() => setCart([])}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Customer picker */}
      {showCustomer && (
        <div className="px-4 py-2 border-b bg-muted/10 shrink-0">
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

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
              <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Search or tap a product to add</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.productId}
                  className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl border">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-sm line-clamp-2 flex-1">{item.productName}</span>
                    <button onClick={() => removeFromCart(item.productId)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1 -mr-1 -mt-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{format(item.sellingRate)} each</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors active:scale-95"
                        onClick={() => {
                          if (item.quantity === 1) removeFromCart(item.productId);
                          else updateCartQuantity(item.productId, -1);
                        }}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="h-8 w-12 text-center text-sm p-0 font-semibold"
                        value={item.quantity}
                        onChange={e => setCartQuantity(item.productId, parseInt(e.target.value))}
                        min={1}
                        max={item.maxQuantity}
                      />
                      <button
                        className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-green-500/10 text-green-600 transition-colors active:scale-95"
                        onClick={() => updateCartQuantity(item.productId, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-bold text-sm ml-1 w-20 text-right tabular-nums">{format(item.subtotal)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Checkout panel */}
      <div className="p-3 border-t bg-muted/10 space-y-3 shrink-0">
        <div className={isDiscountsEnabled ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1'}>
          {isDiscountsEnabled && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Discount ({symbol})</label>
              <Input
                type="number" inputMode="decimal" placeholder="0" className="h-9 text-sm"
                value={discount || ''}
                min={0} max={subtotal}
                onChange={e => setDiscount(Math.max(0, Math.min(subtotal, Number(e.target.value))))}
              />
            </div>
          )}
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
            <span>Subtotal</span><span className="tabular-nums">{format(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span><span className="tabular-nums">- {format(discount)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({taxPercent}%)</span><span className="tabular-nums">{format(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1.5 border-t font-bold text-lg">
            <span>Total</span>
            <span className="text-primary text-xl tabular-nums">{format(grandTotal)}</span>
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
            inputMode="decimal"
            placeholder={`${format(grandTotal)} (exact)`}
            className={`h-11 text-base font-bold ${paidAmount !== '' && Number(paidAmount) < grandTotal ? 'border-destructive' : ''}`}
            value={paidAmount}
            onChange={e => setPaidAmount(e.target.value ? Number(e.target.value) : '')}
          />
          {paidAmount !== '' && Number(paidAmount) < grandTotal && (
            <p className="text-xs text-destructive">Short by {format(grandTotal - Number(paidAmount))}</p>
          )}
          {change > 0 && (
            <div className="text-sm font-semibold text-green-600 tabular-nums">Change: {format(change)}</div>
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
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] md:h-screen bg-muted/20">

      {/* ── MOBILE SEARCH OVERLAY ──────────────────────────────────────────────
           Fixed fullscreen. Input at top → keyboard opens below → results stay
           visible in the space between input and keyboard. Never covered.     */}
      {searchOpen && (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col lg:hidden">
          {/* Search bar row */}
          <div className="flex items-center gap-2 px-3 py-3 border-b bg-background shrink-0">
            <button
              onClick={closeSearch}
              className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={overlaySearchRef}
                type="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                placeholder="Search product by name or barcode…"
                className="w-full h-11 pl-9 pr-9 rounded-lg border bg-muted/50 text-base outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Results — fills remaining space above keyboard */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {searchQuery.trim() === '' ? (
              /* All products when no query */
              <div>
                <p className="text-xs text-muted-foreground px-4 py-2 font-medium">
                  All products ({availableProducts.length} in stock)
                </p>
                {availableProducts.slice(0, 40).map(product => (
                  <button
                    key={product.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b hover:bg-muted active:bg-muted/80 text-left transition-colors"
                    onClick={() => addToCart(product)}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                        <span className="text-green-600 font-medium">{product.quantity} {product.unit}</span>
                        {product.category && <span>• {product.category}</span>}
                      </div>
                    </div>
                    <div className="font-bold text-primary shrink-0 text-sm tabular-nums">{format(product.sellingRate)}</div>
                  </button>
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div>
                <p className="text-xs text-muted-foreground px-4 py-2 font-medium">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b hover:bg-muted active:bg-muted/80 text-left transition-colors"
                    onClick={() => addToCart(product)}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        {product.barcode && <span>#{product.barcode}</span>}
                        <span className="text-green-600 font-medium">Stock: {product.quantity} {product.unit}</span>
                        {product.category && <span>• {product.category}</span>}
                      </div>
                    </div>
                    <div className="font-bold text-primary shrink-0 text-sm tabular-nums">{format(product.sellingRate)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Search className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No products found</p>
                <p className="text-xs mt-1">"{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MOBILE CART DRAWER ─────────────────────────────────────────────────
           Bottom sheet that slides up when cart bar is tapped.               */}
      {cartOpen && (
        <div className="fixed inset-0 z-[9998] lg:hidden flex flex-col justify-end">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCartOpen(false)}
          />
          {/* Drawer panel — 85dvh max, scrollable inside */}
          <div className="relative bg-background rounded-t-2xl flex flex-col"
            style={{ maxHeight: '85dvh' }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <CartPanel inDrawer />
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Left — Search & Products */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Header bar (always visible) */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
            <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0 h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-bold hidden md:block shrink-0">Point of Sale</h1>

            {/* Search trigger button (mobile) / real search input (desktop) */}
            <button
              className="flex-1 flex items-center gap-2 h-11 px-3 rounded-lg border bg-muted/50 text-muted-foreground text-sm hover:bg-muted transition-colors lg:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span>Search products…</span>
            </button>

            {/* Desktop: real input with inline dropdown */}
            <div className="hidden lg:flex flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                placeholder="Search product by name or barcode…"
                className="pl-9 h-11 text-base border-primary/20 focus-visible:ring-primary bg-background"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchQuery(searchQuery)}
              />
              {searchQuery.trim() && (
                <div className="absolute top-[46px] left-0 right-0 bg-card border rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 flex flex-col">
                  {searchResults.length > 0 ? (
                    <div className="overflow-y-auto divide-y flex-1">
                      {searchResults.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted text-left transition-colors active:bg-muted"
                          onClick={() => { addToCart(product); setSearchQuery(''); }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{product.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                              {product.barcode && <span>#{product.barcode}</span>}
                              <span className="text-green-600 font-medium">Stock: {product.quantity} {product.unit}</span>
                              {product.category && <span>• {product.category}</span>}
                            </div>
                          </div>
                          <div className="font-bold text-primary shrink-0 text-sm tabular-nums">{format(product.sellingRate)}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No products found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>

            <Suspense fallback={null}>
              <BarcodeScanner onScan={handleBarcodeScanned} />
            </Suspense>
          </div>

          {/* Product grid — visible on all sizes now on mobile too */}
          <div className="flex-1 overflow-y-auto p-3 pb-24">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              {availableProducts.length} products in stock — tap to add
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {availableProducts.slice(0, 16).map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  format={format}
                  onClick={() => addToCart(product)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right — Cart (desktop sidebar) */}
        <div className="hidden lg:flex w-[380px] xl:w-[420px] bg-card border-l flex-col shadow-xl z-10">
          <ScrollArea className="flex-1">
            <CartPanel />
          </ScrollArea>
        </div>
      </div>

      {/* ── MOBILE BOTTOM CART BAR ─────────────────────────────────────────── */}
      <div className="fixed left-0 right-0 bottom-16 z-50 lg:hidden border-t bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          className="w-full flex items-center justify-between px-4 py-3 active:bg-muted/50 transition-colors"
          onClick={() => setCartOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold">
                {cart.length === 0 ? 'Cart is empty' : `${cart.length} item${cart.length !== 1 ? 's' : ''}`}
              </div>
              {cart.length > 0 && (
                <div className="text-xs text-muted-foreground">Tap to review & checkout</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <span className="font-bold text-primary text-base tabular-nums">{format(grandTotal)}</span>
            )}
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
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
