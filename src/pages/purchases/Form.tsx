import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { usePurchases, useSuppliers, useInventory, useProductBatches } from '@/contexts/GlobalProviders';
import { useStorageProvider } from '@/storage/StorageContext';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Plus, Trash2, Search, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { PurchaseItem, PurchasePaymentStatus, PurchaseStatus } from '@/types';
import { createPurchase, updatePurchase } from '@/services/purchaseService';

type DraftItem = PurchaseItem & {
  manufacturingDate?: string | null;
  expiryDate?: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function PurchaseForm() {
  const goBack = useSmartBack('/purchases');
  const [location, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const storage = useStorageProvider();
  const { settings } = useApp();
  const { items: purchases, refresh: refreshPurchases } = usePurchases();
  const { items: suppliers } = useSuppliers();
  const { items: inventory, refresh: refreshInventory } = useInventory();
  const { refresh: refreshBatches } = useProductBatches();
  const { format } = useCurrency();

  const queryParams = new URLSearchParams(location.split('?')[1] || '');
  const supplierIdFromQuery = queryParams.get('supplierId') ?? '';
  const productIdFromQuery = queryParams.get('productId') ?? '';
  const isNew = !id || id === 'new';
  const existing = isNew ? null : purchases.find(purchase => purchase.id === id) ?? null;

  const [supplierId, setSupplierId] = useState(existing?.supplierId ?? supplierIdFromQuery);
  const [invoiceNumber, setInvoiceNumber] = useState(existing?.invoiceNumber ?? '');
  const [referenceNumber, setReferenceNumber] = useState(existing?.referenceNumber ?? '');
  const [purchaseDate, setPurchaseDate] = useState(existing?.date?.slice(0, 10) ?? today());
  const [status, setStatus] = useState<PurchaseStatus>(existing?.status ?? 'received');
  const [paymentMethod, setPaymentMethod] = useState(existing?.paymentMethod ?? 'cash');
  const [paymentStatus, setPaymentStatus] = useState<PurchasePaymentStatus>(existing?.paymentStatus ?? 'unpaid');
  const [paidAmount, setPaidAmount] = useState(String(existing?.paidAmount ?? 0));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [items, setItems] = useState<DraftItem[]>(existing?.items ?? []);
  const [discount, setDiscount] = useState(String(existing?.discount ?? 0));
  const [tax, setTax] = useState(String(existing?.tax ?? 0));
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (productIdFromQuery && !items.some(item => item.productId === productIdFromQuery)) {
      const product = inventory.find(candidate => candidate.id === productIdFromQuery);
      if (product) addItem(product);
    }
    // Query parameters are a one-time handoff from Add Product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdFromQuery, inventory]);

  const selectedSupplier = suppliers.find(supplier => supplier.id === supplierId);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0), [items]);
  const discountValue = Math.max(0, Number(discount) || 0);
  const taxValue = Math.max(0, Number(tax) || 0);
  const grandTotal = Math.max(0, subtotal - discountValue + taxValue);

  const searchResults = inventory
    .filter(product => {
      const query = searchQuery.trim().toLowerCase();
      return query && (
        product.name.toLowerCase().includes(query) ||
        product.barcode.toLowerCase().includes(query)
      );
    })
    .slice(0, 8);

  function addItem(product: typeof inventory[number]) {
    const existingIndex = items.findIndex(item => item.productId === product.id);
    if (existingIndex >= 0) {
      updateItem(existingIndex, 'quantity', Number(items[existingIndex].quantity) + 1);
    } else {
      const supplierCost = product.supplierStocks?.find(record => record.supplierId === supplierId)?.cost;
      const purchaseRate = supplierCost ?? product.purchaseRate ?? 0;
      setItems(current => [...current, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        purchaseRate,
        subtotal: purchaseRate,
        batchNumber: '',
        manufacturingDate: null,
        expiryDate: null,
        notes: '',
      }]);
    }
    setSearchQuery('');
  }

  function updateItem(index: number, field: keyof DraftItem, value: string | number | null) {
    setItems(current => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value };
      if (field === 'quantity' || field === 'purchaseRate') {
        next.subtotal = Math.max(0, Number(next.quantity) || 0) * Math.max(0, Number(next.purchaseRate) || 0);
      }
      return next;
    }));
  }

  function openAddProduct() {
    const returnTo = encodeURIComponent(`/purchases/new?supplierId=${encodeURIComponent(supplierId)}`);
    setLocation(`/inventory/new?supplierId=${encodeURIComponent(supplierId)}&returnTo=${returnTo}`);
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!supplierId) {
      toast.error('Select a supplier before saving.');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one product.');
      return;
    }
    if (items.some(item => Number(item.quantity) <= 0)) {
      toast.error('Every item must have a quantity greater than zero.');
      return;
    }
    if (items.some(item => Number(item.purchaseRate) < 0)) {
      toast.error('Purchase costs cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoiceNumber: invoiceNumber.trim(),
        supplierId,
        supplierName: selectedSupplier?.name ?? null,
        date: new Date(`${purchaseDate}T12:00:00`).toISOString(),
        items: items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          purchaseRate: Number(item.purchaseRate),
          subtotal: Number(item.quantity) * Number(item.purchaseRate),
        })),
        discount: discountValue,
        tax: taxValue,
        grandTotal,
        paymentMethod,
        paymentStatus,
        paidAmount: Math.max(0, Number(paidAmount) || 0),
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        status,
      } as any;

      if (isNew) await createPurchase(storage, payload);
      else if (existing) await updatePurchase(storage, existing.id, payload);
      refreshPurchases();
      refreshInventory();
      refreshBatches();
      toast.success(status === 'received' ? 'Purchase received and inventory updated' : 'Purchase saved as draft');
      setLocation('/purchases');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save purchase');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto pb-28 md:pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isNew ? 'New Purchase' : 'Edit Purchase'}</h1>
          <p className="text-sm text-muted-foreground">
            {isNew ? 'Receive stock from a supplier' : existing?.invoiceNumber || 'Update purchase details'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-2 text-sm font-medium">
                  Supplier *
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Purchase date
                  <Input type="date" value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Supplier invoice #
                  <Input value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} placeholder="e.g. SUP-2026-001" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Reference number
                  <Input value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} placeholder="Optional PO or delivery ref" />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Receiving status
                  <Select value={status} onValueChange={value => setStatus(value as PurchaseStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Received — update inventory</SelectItem>
                      <SelectItem value="draft">Draft — do not update inventory</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Products received</h2>
                  <p className="text-xs text-muted-foreground">Choose a product, then enter quantity and actual supplier cost.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={openAddProduct} disabled={!supplierId}>
                  <PackagePlus className="h-4 w-4 mr-1" /> Add product
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder={supplierId ? 'Search by product name or barcode...' : 'Select a supplier first'}
                  disabled={!supplierId}
                  className="pl-9"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-md border bg-card shadow-lg overflow-hidden">
                    {searchResults.map(product => (
                      <button type="button" key={product.id} className="w-full text-left flex items-center justify-between gap-3 p-3 hover:bg-muted" onClick={() => addItem(product)}>
                        <span>
                          <span className="block font-medium text-sm">{product.name}</span>
                          <span className="block text-xs text-muted-foreground">Stock {product.quantity} {product.unit}</span>
                        </span>
                        <span className="text-sm font-medium">{format(product.supplierStocks?.find(record => record.supplierId === supplierId)?.cost ?? product.purchaseRate)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                  Search for products or add a new product to begin.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const product = inventory.find(candidate => candidate.id === item.productId);
                    return (
                      <div key={`${item.productId}-${index}`} className="rounded-lg border p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-sm">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{product?.unit ?? 'unit'} · Current stock {product?.quantity ?? 0}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <label className="space-y-1 text-xs font-medium">Quantity
                            <Input type="number" min="0.01" step="any" value={item.quantity} onChange={event => updateItem(index, 'quantity', event.target.value)} />
                          </label>
                          <label className="space-y-1 text-xs font-medium">Unit cost
                            <Input type="number" min="0" step="0.01" value={item.purchaseRate} onChange={event => updateItem(index, 'purchaseRate', event.target.value)} />
                          </label>
                          <div className="col-span-2 flex items-end justify-end font-bold text-primary pb-2">{format(item.subtotal)}</div>
                        </div>
                        {product?.hasExpiry && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                            <label className="space-y-1 text-xs font-medium">Batch number
                              <Input value={item.batchNumber ?? ''} onChange={event => updateItem(index, 'batchNumber', event.target.value)} placeholder="Optional batch #" />
                            </label>
                            <label className="space-y-1 text-xs font-medium">Manufactured
                              <Input type="date" value={item.manufacturingDate ?? ''} onChange={event => updateItem(index, 'manufacturingDate', event.target.value || null)} />
                            </label>
                            <label className="space-y-1 text-xs font-medium">Expiry
                              <Input type="date" value={item.expiryDate ?? ''} onChange={event => updateItem(index, 'expiryDate', event.target.value || null)} />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6 space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Delivery notes, condition, or payment terms" rows={3} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="lg:sticky lg:top-20">
            <CardContent className="p-4 md:p-6 space-y-4">
              <h2 className="font-semibold border-b pb-3">Purchase summary</h2>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{format(subtotal)}</span></div>
              <label className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Discount</span><Input className="w-28 text-right" type="number" min="0" step="0.01" value={discount} onChange={event => setDiscount(event.target.value)} /></label>
              <label className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Tax</span><Input className="w-28 text-right" type="number" min="0" step="0.01" value={tax} onChange={event => setTax(event.target.value)} placeholder={String(settings.taxRate)} /></label>
              <div className="border-t pt-4 flex justify-between items-center"><span className="font-bold">Total</span><span className="text-2xl font-bold text-primary">{format(grandTotal)}</span></div>
              <div className="border-t pt-4 space-y-3">
                <label className="space-y-2 text-sm font-medium block">Payment method
                  <Select value={paymentMethod} onValueChange={value => setPaymentMethod(value as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['cash', 'qr', 'card', 'bank', 'split'].map(method => <SelectItem className="capitalize" key={method} value={method}>{method}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium block">Payment status
                  <Select value={paymentStatus} onValueChange={value => setPaymentStatus(value as PurchasePaymentStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="partial">Partially paid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                {paymentStatus === 'partial' && <label className="space-y-2 text-sm font-medium block">Paid amount
                  <Input type="number" min="0" step="0.01" value={paidAmount} onChange={event => setPaidAmount(event.target.value)} />
                </label>}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={saving}>
                <Save className="h-5 w-5 mr-2" /> {saving ? 'Saving…' : status === 'received' ? 'Save & receive stock' : 'Save draft'}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">Received purchases update stock, supplier stock, costs, and batches together.</p>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}