import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useInventory, useSuppliers, useProductBatches } from '@/contexts/GlobalProviders';
import { useSort } from '@/hooks/useSort';
import { useCurrency } from '@/hooks/useCurrency';
import { useUndoDelete } from '@/hooks/useUndoDelete';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Plus, MoreVertical, Edit, Trash2, Package, ShoppingCart, SlidersHorizontal, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { StockAdjustDialog } from '@/components/StockAdjustDialog';
import { ExpiryBadge, getBatchStatus } from '@/components/BatchFormDialog';
import { Product } from '@/types';
import { toast } from 'sonner';

export default function InventoryList() {
  const [, setLocation] = useLocation();
  const { items, remove, undoRemove, hardRemove, update } = useInventory();
  const { items: suppliers } = useSuppliers();
  const { items: batches } = useProductBatches();
  const { format } = useCurrency();
  const showUndoToast = useUndoDelete(undoRemove, hardRemove);

  const [nameQuery, setNameQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'expiring' | 'expired'>('all');
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(items.map(i => i.category))).filter(Boolean).sort(),
    [items]
  );

  // Map productId → worst expiry status across its batches
  const expiryStatusMap = useMemo(() => {
    const map: Record<string, 'expired' | 'expiring' | 'ok' | 'none'> = {};
    for (const b of batches) {
      const s = getBatchStatus(b.expiryDate);
      const prev = map[b.productId];
      if (!prev || s === 'expired' || (s === 'expiring' && prev !== 'expired')) {
        map[b.productId] = s;
      }
    }
    return map;
  }, [batches]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Name-only search
      if (nameQuery.trim() && !item.name.toLowerCase().includes(nameQuery.toLowerCase().trim())) return false;
      // Category filter
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      // Stock filter
      if (stockFilter === 'low' && (item.quantity === 0 || item.quantity > item.minimumStock)) return false;
      if (stockFilter === 'out' && item.quantity > 0) return false;
      if (stockFilter === 'expiring' && expiryStatusMap[item.id] !== 'expiring') return false;
      if (stockFilter === 'expired' && expiryStatusMap[item.id] !== 'expired') return false;
      return true;
    });
  }, [items, nameQuery, categoryFilter, stockFilter, expiryStatusMap]);

  const { sortedItems, requestSort, sortConfig } = useSort(filteredItems, { key: 'name', direction: 'asc' });

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete "${name}"? This can be undone.`)) {
      remove(id);
      showUndoToast(`Product "${name}"`, id);
    }
  };

  const handleStockAdjust = (productId: string, newQuantity: number, reason: string) => {
    const product = items.find(p => p.id === productId);
    if (!product) return;
    const diff = newQuantity - product.quantity;
    update(productId, { quantity: newQuantity });
    toast.success(`Stock ${diff > 0 ? `+${diff}` : diff} → ${newQuantity} ${product.unit}. ${reason}`);
  };

  const getSupplierName = (product: Product) => {
    const ids = product.supplierIds?.length ? product.supplierIds : product.supplierId ? [product.supplierId] : [];
    const names = ids.map(id => suppliers.find(s => s.id === id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : '—';
  };

  const lowStockCount = items.filter(i => i.quantity <= i.minimumStock && i.quantity > 0).length;
  const outOfStockCount = items.filter(i => i.quantity === 0).length;
  const expiredCount = Object.values(expiryStatusMap).filter(s => s === 'expired').length;
  const expiringCount = Object.values(expiryStatusMap).filter(s => s === 'expiring').length;

  const SortBtn = ({ field, label }: { field: keyof Product; label: string }) => (
    <button
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => requestSort(field)}
    >
      {label}
      {sortConfig?.key === field && <ArrowUpDown className="h-3 w-3" />}
    </button>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm flex flex-wrap gap-x-3">
            <span>{items.length} products</span>
            {lowStockCount > 0 && <span className="text-orange-500 font-medium">• {lowStockCount} low stock</span>}
            {outOfStockCount > 0 && <span className="text-destructive font-medium">• {outOfStockCount} out of stock</span>}
            {expiredCount > 0 && <span className="text-destructive font-medium">• {expiredCount} expired batch(es)</span>}
            {expiringCount > 0 && <span className="text-orange-500 font-medium">• {expiringCount} expiring soon</span>}
          </p>
        </div>
        <Button onClick={() => setLocation('/inventory/new')} size="lg" className="w-full md:w-auto shadow-sm">
          <Plus className="mr-2 h-5 w-5" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product name..."
            value={nameQuery}
            onChange={e => setNameQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] bg-card">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={(v: any) => setStockFilter(v)}>
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sort bar */}
      {sortedItems.length > 0 && (
        <div className="items-center gap-4 px-1 hidden md:flex">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Sort:</span>
          <SortBtn field="name" label="Name" />
          <SortBtn field="quantity" label="Quantity" />
          <SortBtn field="sellingRate" label="Sell Rate" />
          <SortBtn field="purchaseRate" label="Buy Rate" />
          <SortBtn field="category" label="Category" />
        </div>
      )}

      {sortedItems.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No products found</h3>
          <p className="text-muted-foreground mb-6">
            {nameQuery ? `No results for "${nameQuery}"` : 'Try adjusting your filters.'}
          </p>
          <Button onClick={() => setLocation('/inventory/new')} variant="outline">Add your first product</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedItems.map(item => {
            const isLowStock = item.quantity <= item.minimumStock && item.quantity > 0;
            const isOutOfStock = item.quantity === 0;
            const expiryStatus = expiryStatusMap[item.id] ?? 'none';
            const productBatches = batches.filter(b => b.productId === item.id);
            const nearestExpiry = productBatches
              .filter(b => b.expiryDate)
              .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))[0];

            return (
              <Card
                key={item.id}
                className={`overflow-hidden transition-colors ${
                  isOutOfStock ? 'border-destructive/40' :
                  expiryStatus === 'expired' ? 'border-destructive/40' :
                  isLowStock || expiryStatus === 'expiring' ? 'border-orange-300/60' :
                  'hover:border-primary/40'
                }`}
              >
                <CardContent className="p-0">
                  <div className="p-4 flex gap-3">
                    {item.imageBase64 ? (
                      <div
                        className="h-14 w-14 rounded-md bg-muted flex-shrink-0"
                        style={{ backgroundImage: `url(${item.imageBase64})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-lg">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm leading-tight truncate">{item.name}</div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mt-1">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAdjustProduct(item)}>
                              <SlidersHorizontal className="h-4 w-4 mr-2" /> Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation('/sales/new')}>
                              <ShoppingCart className="h-4 w-4 mr-2" /> Sell
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/inventory/${item.id}/edit`)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(item.id, item.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{item.brand || item.category}</div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-sm font-bold ${isOutOfStock ? 'text-destructive' : isLowStock ? 'text-orange-500' : 'text-foreground'}`}>
                          {item.quantity} {item.unit}
                        </span>
                        {isOutOfStock && <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Out of Stock</Badge>}
                        {isLowStock && !isOutOfStock && (
                          <Badge className="text-[10px] py-0 px-1.5 bg-orange-500/10 text-orange-600 border-orange-300">
                            <AlertTriangle className="h-2.5 w-2.5 mr-1" />Low
                          </Badge>
                        )}
                        {nearestExpiry && <ExpiryBadge expiryDate={nearestExpiry.expiryDate} />}
                      </div>
                    </div>
                  </div>

                  {/* Batch expiry info */}
                  {productBatches.length > 0 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1">
                      {productBatches
                        .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''))
                        .slice(0, 3)
                        .map(b => {
                          const sup = suppliers.find(s => s.id === b.supplierId);
                          return (
                            <span key={b.id} className="text-[10px] border rounded px-1.5 py-0.5 text-muted-foreground flex items-center gap-1">
                              {b.batchNumber}
                              {sup && <span className="text-[9px] opacity-70">· {sup.name.split(' ')[0]}</span>}
                              {b.expiryDate && (
                                <ExpiryBadge expiryDate={b.expiryDate} />
                              )}
                            </span>
                          );
                        })}
                      {productBatches.length > 3 && (
                        <span className="text-[10px] text-muted-foreground py-0.5">+{productBatches.length - 3} more</span>
                      )}
                    </div>
                  )}

                  {/* Rates + profit */}
                  <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-center border-t bg-muted/20 pt-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Buy</div>
                      <div className="text-sm font-semibold">{format(item.purchaseRate)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Sell</div>
                      <div className="text-sm font-semibold text-primary">{format(item.sellingRate)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Profit</div>
                      <div className={`text-sm font-semibold ${item.sellingRate - item.purchaseRate >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {format(item.sellingRate - item.purchaseRate)}
                      </div>
                    </div>
                  </div>

                  {/* Supplier + stock value */}
                  <div className="px-4 pb-3 flex justify-between items-center text-xs text-muted-foreground border-t pt-2">
                    <span className="truncate mr-2" title={getSupplierName(item)}>{getSupplierName(item)}</span>
                    <span className="font-medium shrink-0">Val: {format(item.purchaseRate * item.quantity)}</span>
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-3 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs"
                      onClick={() => setAdjustProduct(item)}>
                      <SlidersHorizontal className="h-3 w-3 mr-1" /> Adjust Stock
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => setLocation(`/inventory/${item.id}/edit`)}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <StockAdjustDialog
        product={adjustProduct}
        open={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onAdjust={handleStockAdjust}
      />
    </div>
  );
}
