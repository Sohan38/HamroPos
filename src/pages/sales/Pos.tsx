import { useState, useMemo, useRef, lazy, Suspense, useEffect, useCallback } from 'react';
import { useInventory, useSales, useCustomers, useProductBatches } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { useApp } from '@/contexts/AppContext';
import { rankSearch } from '@/utils/search/rank';
import { useBackModal, useSmartBack } from '@/contexts/NavigationContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ShoppingCart, ArrowLeft, X, ChevronUp, Package } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod, ProductBatch, SaleInvoice } from '@/types';
import { BarcodeScanner } from '@/components/BarcodeScanner';
const SaleBillPrint = lazy(() => import('@/components/SaleBillPrint').then(m => ({ default: m.SaleBillPrint })));

import { useFeature } from '@/hooks/useFeature';
import { ProductCard } from '@/components/pos/ProductCard';
import { CartPanel } from '@/components/pos/CartPanel';
import { CartItem } from '@/types';

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
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState(0);
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

  useEffect(() => {
    const code = searchQuery.trim();

    if (!code) return;

    const product = barcodeMap.get(code);

    if (!product) return;

    addToCart(product);

    setSearchQuery('');
    setDebouncedSearch('');
  }, [searchQuery, barcodeMap]);

  const customerMap = useMemo(() => {
    const map = new Map<string, typeof customers[number]>();

    for (const customer of customers) {
      map.set(customer.id, customer);
    }

    return map;
  }, [customers]);

  const searchResults = useMemo(() => {
    const q = debouncedSearch.trim();

    // Barcode scans are handled separately
    if (/^\d{8,}$/.test(q)) return [];

    // Wait until user types at least 2 characters
    if (q.length < 2) return [];

    return rankSearch(availableProducts, q, 20);
  }, [availableProducts, debouncedSearch]);

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
    if (exact) {
      addToCart(exact);
      return;
    }

    const partial = inventory.find(
      p =>
        p.quantity > 0 &&
        (p.barcode?.includes(code) || code.includes(p.barcode ?? ''))
    );

    if (partial) {
      addToCart(partial);
      return;
    }

    setSearchQuery(code);
    setSearchOpen(true);
    toast.error("Product not found");
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
  const discount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.round(subtotal * (discountValue / 100) * 100) / 100;
    }
    return discountValue;
  }, [discountType, discountValue, subtotal]);
  const taxAmount = Math.round((subtotal - discount) * (taxPercent / 100) * 100) / 100;
  const grandTotal = Math.max(0, subtotal - discount + taxAmount);
  const change = paidAmount !== '' && Number(paidAmount) > grandTotal ? Number(paidAmount) - grandTotal : 0;
  const selectedCustomer = customerId ? customerMap.get(customerId) : undefined;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

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
      setCart([]); setDiscountValue(0); setDiscountType('flat'); setTaxPercent(0); setPaidAmount(''); setCustomerId('');
      setCartOpen(false);
    } catch (e) {
      toast.error('Checkout failed');
      console.error(e);
    }
  };

  /** Common props forwarded to CartPanel */
  const cartPanelProps = {
    cart,
    cartCount,
    discount,
    discountType,
    discountValue,
    taxPercent,
    taxAmount,
    subtotal,
    grandTotal,
    paidAmount,
    paymentMethod,
    customerId,
    showCustomer,
    selectedCustomerName: selectedCustomer?.name,
    change,
    isDiscountsEnabled,
    symbol,
    format,
    onSetDiscountType: setDiscountType,
    onSetDiscountValue: setDiscountValue,
    onSetTaxPercent: setTaxPercent,
    onSetPaymentMethod: setPaymentMethod,
    onSetPaidAmount: setPaidAmount,
    onSetCustomerId: setCustomerId,
    onToggleCustomer: () => setShowCustomer(v => !v),
    onCloseCustomer: () => setShowCustomer(false),
    onClearCart: () => setCart([]),
    onRemoveFromCart: removeFromCart,
    onUpdateCartQuantity: updateCartQuantity,
    onSetCartQuantity: setCartQuantity,
    onCheckout: handleCheckout,
  };

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
              <div className="flex flex-col items-center justify-center h-full px-6 text-center text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-20" />

                <h3 className="text-base font-semibold text-foreground">
                  Search Products
                </h3>

                <p className="text-sm mt-2 max-w-xs">
                  Type a product name, barcode, or scan an item to begin.
                </p>
              </div>
            ) : searchQuery.trim().length < 2 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Search className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Keep typing…</p>
                <p className="text-xs mt-1">
                  Enter at least 2 characters
                </p>
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
            <CartPanel {...cartPanelProps} inDrawer />
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

            <BarcodeScanner onScan={handleBarcodeScanned} autoClose={false} />
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
            <CartPanel {...cartPanelProps} />
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
