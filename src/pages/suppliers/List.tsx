import { useState } from 'react';
import { useLocation } from 'wouter';
import { useSuppliers, usePurchases, useInventory } from '@/contexts/GlobalProviders';
import { useBackModal } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Truck, Phone, MapPin, ChevronDown, ChevronUp, Package, ShoppingCart } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { useSort } from '@/hooks/useSort';
import { format as formatDate, parseISO } from 'date-fns';

export default function SupplierList() {
  const [, setLocation] = useLocation();
  const { items, add } = useSuppliers();
  const { items: purchases } = usePurchases();
  const { items: inventory } = useInventory();
  const { format } = useCurrency();

  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', email: '', vatPan: '', notes: '' });

  useBackModal(showAddForm, () => setShowAddForm(false), 'add-supplier-form');

  const { query, setQuery, filteredItems } = useSearch(items, ['name', 'phone', 'address', 'vatPan']);
  const { sortedItems } = useSort(filteredItems, { key: 'name', direction: 'asc' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    add(formData);
    setFormData({ name: '', phone: '', address: '', email: '', vatPan: '', notes: '' });
    setShowAddForm(false);
  };

  const getSupplierStats = (supplierId: string) => {
    const supplierPurchases = purchases.filter(p => p.supplierId === supplierId);
    const totalPurchased = supplierPurchases.reduce((s, p) => s + p.grandTotal, 0);
    const totalOrders = supplierPurchases.length;
    const lastOrder = supplierPurchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    // Products from this supplier
    const supplierProducts = inventory.filter(i =>
      (i.supplierIds ?? [i.supplierId]).includes(supplierId)
    );

    return { totalPurchased, totalOrders, lastOrder, supplierProducts, supplierPurchases };
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Suppliers</h1>
          <p className="text-muted-foreground text-sm">{items.length} suppliers</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => setLocation('/purchases/new')} variant="outline" size="lg" className="flex-1 md:flex-auto">
            <Truck className="mr-2 h-4 w-4" /> New Purchase
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)} size="lg" className="flex-1 md:flex-auto shadow-sm">
            <Plus className="mr-2 h-5 w-5" /> Add Supplier
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card className="border-primary/20">
          <CardContent className="p-4 md:p-6">
            <h3 className="font-semibold mb-3">Add New Supplier</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Company Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                <Input placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                <Input placeholder="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                <Input placeholder="VAT/PAN" value={formData.vatPan} onChange={e => setFormData({...formData, vatPan: e.target.value})} />
                <Input placeholder="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="md:col-span-2" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                <Button type="submit">Save Supplier</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      {sortedItems.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-dashed">
          <Truck className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No suppliers yet</h3>
          <p className="text-muted-foreground mb-4">Add your first supplier to get started.</p>
          <Button onClick={() => setShowAddForm(true)} variant="outline">Add Supplier</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedItems.map(supplier => {
            const stats = getSupplierStats(supplier.id);
            const isExpanded = expandedId === supplier.id;

            return (
              <Card key={supplier.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Main row */}
                  <div
                    className="p-4 flex flex-col md:flex-row gap-4 md:items-center cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : supplier.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 font-bold text-sm">
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{supplier.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                          {supplier.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</span>}
                          {supplier.address && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{supplier.address}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden md:block">
                        <div className="text-xs text-muted-foreground">Total Purchased</div>
                        <div className="font-bold text-primary">{format(stats.totalPurchased)}</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-xs text-muted-foreground">Orders</div>
                        <div className="font-bold">{stats.totalOrders}</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-xs text-muted-foreground">Products</div>
                        <div className="font-bold">{stats.supplierProducts.length}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {/* Mobile stats */}
                    <div className="flex gap-4 md:hidden text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Total: </span>
                        <span className="font-bold text-primary">{format(stats.totalPurchased)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Orders: </span>
                        <span className="font-bold">{stats.totalOrders}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t bg-muted/10 p-4 space-y-4">
                      {/* Supplier info */}
                      {(supplier.vatPan || supplier.email || supplier.notes) && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {supplier.vatPan && (
                            <div>
                              <p className="text-xs text-muted-foreground">VAT/PAN</p>
                              <p className="font-medium">{supplier.vatPan}</p>
                            </div>
                          )}
                          {supplier.email && (
                            <div>
                              <p className="text-xs text-muted-foreground">Email</p>
                              <p className="font-medium">{supplier.email}</p>
                            </div>
                          )}
                          {supplier.notes && (
                            <div className="md:col-span-2">
                              <p className="text-xs text-muted-foreground">Notes</p>
                              <p className="font-medium">{supplier.notes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Products from this supplier */}
                      {stats.supplierProducts.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                            <Package className="h-3 w-3" /> Products ({stats.supplierProducts.length})
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {stats.supplierProducts.map(p => (
                              <Badge
                                key={p.id}
                                variant="outline"
                                className={`text-xs cursor-pointer ${p.quantity <= p.minimumStock ? 'border-orange-300 text-orange-600' : ''}`}
                                onClick={() => setLocation('/inventory')}
                              >
                                {p.name}
                                <span className="ml-1 text-muted-foreground">({p.quantity} {p.unit})</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Purchase history */}
                      {stats.supplierPurchases.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" /> Purchase History
                          </h4>
                          <div className="divide-y rounded-lg border bg-card overflow-hidden">
                            {stats.supplierPurchases
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .slice(0, 5)
                              .map(purchase => (
                                <div key={purchase.id} className="flex justify-between items-center px-3 py-2 text-sm hover:bg-muted/30">
                                  <div>
                                    <div className="font-medium">{purchase.invoiceNumber || `#${purchase.id.slice(-6).toUpperCase()}`}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {purchase.items.length} items •{' '}
                                      {(() => {
                                        try { return formatDate(parseISO(purchase.date), 'dd MMM yyyy'); }
                                        catch { return formatDate(new Date(purchase.date), 'dd MMM yyyy'); }
                                      })()}
                                    </div>
                                  </div>
                                  <div className="font-bold text-primary">{format(purchase.grandTotal)}</div>
                                </div>
                              ))
                            }
                          </div>
                          {stats.supplierPurchases.length > 5 && (
                            <Button variant="ghost" size="sm" className="mt-2 text-xs h-7" onClick={() => setLocation('/purchases')}>
                              View all {stats.supplierPurchases.length} orders
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation('/purchases/new')}
                        >
                          <Truck className="h-4 w-4 mr-2" /> New Purchase from {supplier.name.split(' ')[0]}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
