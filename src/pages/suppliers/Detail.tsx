import { useMemo, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useSuppliers, usePurchases, useInventory } from '@/contexts/GlobalProviders';
import { useSmartBack } from '@/contexts/NavigationContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft, Edit, Truck, Phone, Mail, MapPin, Hash, FileText,
    Package, ShoppingCart, TrendingUp, Calendar, User, Plus,
    DollarSign, BarChart3,
} from 'lucide-react';
import { format as formatDate, parseISO, formatDistanceToNow } from 'date-fns';

export default function SupplierDetail() {
    const goBack = useSmartBack('/suppliers');
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const { items: suppliers } = useSuppliers();
    const { items: purchases } = usePurchases();
    const { items: inventory } = useInventory();
    const { format } = useCurrency();

    const supplier = useMemo(() => suppliers.find(s => s.id === id), [suppliers, id]);

    const stats = useMemo(() => {
        if (!id) return null;

        const supplierPurchases = purchases
            .filter(p => p.supplierId === id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const totalPurchased = supplierPurchases.reduce((s, p) => s + p.grandTotal, 0);
        const lastOrder = supplierPurchases[0] ?? null;

        const supplierProducts = inventory.filter(item =>
            (item.supplierIds ?? (item.supplierId ? [item.supplierId] : [])).includes(id)
        );

        // Per-product stock info from supplierStocks
        const productStockDetails = supplierProducts.map(product => {
            const record = product.supplierStocks?.find(ss => ss.supplierId === id && (ss.locationId || 'loc-default') === 'loc-default');
            const isMultiSupProduct = (product.supplierIds?.length ?? 0) >= 2;
            // For multi-supplier products use per-supplier stock; for single-supplier always use product.quantity
            const stock = isMultiSupProduct && record ? record.stock : product.quantity;
            const cost = record?.cost ?? product.purchaseRate;
            return { product, stock, cost, record };
        });

        const totalInventoryValue = productStockDetails.reduce(
            (sum, { stock, cost }) => sum + stock * cost,
            0
        );

        const totalStockUnits = productStockDetails.reduce((sum, { stock }) => sum + stock, 0);

        return {
            supplierPurchases,
            totalPurchased,
            lastOrder,
            supplierProducts,
            productStockDetails,
            totalInventoryValue,
            totalStockUnits,
        };
    }, [id, purchases, inventory]);

    if (!supplier) {
        return (
            <div className="p-6 text-center">
                <p className="text-muted-foreground">Supplier not found.</p>
                <Button variant="outline" className="mt-4" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
            </div>
        );
    }

    const initials = supplier.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const isActive = (supplier.status ?? 'active') === 'active';

    const fmtDate = (dateStr: string) => {
        try { return formatDate(parseISO(dateStr), 'dd MMM yyyy'); }
        catch { return formatDate(new Date(dateStr), 'dd MMM yyyy'); }
    };

    const fmtDatetime = (dateStr: string) => {
        try { return formatDate(parseISO(dateStr), 'dd MMM yyyy, h:mm a'); }
        catch { return formatDate(new Date(dateStr), 'dd MMM yyyy, h:mm a'); }
    };

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto pb-28 md:pb-8">

            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" onClick={goBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold truncate">{supplier.name}</h1>
                            <Badge
                                className={isActive
                                    ? 'bg-green-100 text-green-700 border-green-300 text-[10px]'
                                    : 'bg-muted text-muted-foreground text-[10px]'}
                            >
                                {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                        </div>
                        {supplier.contactPerson && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <User className="h-3 w-3" />{supplier.contactPerson}
                            </p>
                        )}
                    </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setLocation(`/suppliers/${id}/edit`)}>
                    <Edit className="h-4 w-4" /> Edit
                </Button>
            </div>

            {/* Profile card */}
            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1 space-y-1.5">
                            {supplier.phone && (
                                <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    {supplier.phone}
                                </a>
                            )}
                            {supplier.email && (
                                <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    {supplier.email}
                                </a>
                            )}
                            {supplier.address && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    {supplier.address}
                                </div>
                            )}
                            {supplier.vatPan && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Hash className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    PAN/VAT: {supplier.vatPan}
                                </div>
                            )}
                            {supplier.notes && (
                                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                                    {supplier.notes}
                                </div>
                            )}
                            {!supplier.phone && !supplier.email && !supplier.address && !supplier.vatPan && !supplier.notes && (
                                <p className="text-sm text-muted-foreground italic">No contact details added</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                            <TrendingUp className="h-3 w-3" /> Total Purchased
                        </p>
                        <p className="text-lg font-bold text-primary">{format(stats?.totalPurchased ?? 0)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                            <ShoppingCart className="h-3 w-3" /> Purchase Orders
                        </p>
                        <p className="text-lg font-bold">{stats?.supplierPurchases.length ?? 0}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                            <Package className="h-3 w-3" /> Products Supplied
                        </p>
                        <p className="text-lg font-bold">{stats?.supplierProducts.length ?? 0}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                            <DollarSign className="h-3 w-3" /> Inventory Value
                        </p>
                        <p className="text-lg font-bold">{format(stats?.totalInventoryValue ?? 0)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Last order info */}
            {stats?.lastOrder && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Last order{' '}
                    <span className="font-medium text-foreground">
                        {formatDistanceToNow(new Date(stats.lastOrder.date), { addSuffix: true })}
                    </span>
                    {' '}·{' '}
                    {fmtDate(stats.lastOrder.date)}
                </div>
            )}

            {/* Quick actions */}
            <div className="flex gap-3">
                <Button
                    className="flex-1 h-11 gap-2"
                    onClick={() => setLocation(`/purchases/new?supplierId=${id}`)}
                >
                    <Truck className="h-4 w-4" />
                    New Purchase
                </Button>
                <Button
                    variant="outline"
                    className="flex-1 h-11 gap-2"
                    onClick={() => setLocation(`/inventory/new?supplierId=${id}`)}
                >
                    <Plus className="h-4 w-4" />
                    Add Product
                </Button>
            </div>

            {/* Products supplied */}
            <Card>
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Products Supplied
                        {stats && stats.supplierProducts.length > 0 && (
                            <Badge variant="secondary" className="ml-auto font-normal">
                                {stats.supplierProducts.length}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {!stats || stats.supplierProducts.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                            <Package className="mx-auto h-8 w-8 mb-3 opacity-20" />
                            No products linked to this supplier yet.


                            <button
                                className="text-primary underline text-xs mt-2"
                                onClick={() => setLocation('/inventory/new')}
                            >
                                Add a product
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {stats.productStockDetails.map(({ product, stock, cost, record }) => {
                                const isLow = stock <= product.minimumStock && stock > 0;
                                const isOut = stock === 0;
                                return (
                                    <button
                                        key={product.id}
                                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted text-left transition-colors"
                                        onClick={() => setLocation(`/inventory/${product.id}`)}
                                    >
                                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                            {product.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{product.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {product.category}
                                                {record?.supplierSku && <span> · SKU: {record.supplierSku}</span>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 space-y-1">
                                            <div className={`text-sm font-bold ${isOut ? 'text-destructive' : isLow ? 'text-orange-500' : 'text-foreground'}`}>
                                                {stock} {product.unit}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{format(cost)} / {product.unit}</div>
                                        </div>
                                        {isOut && (
                                            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 ml-1">Out</Badge>
                                        )}
                                        {isLow && !isOut && (
                                            <Badge className="text-[10px] py-0 px-1.5 ml-1 bg-orange-100 text-orange-700 border-orange-300">Low</Badge>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Purchase history */}
            <Card>
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Purchase History
                        {stats && stats.supplierPurchases.length > 0 && (
                            <Badge variant="secondary" className="ml-auto font-normal">
                                {stats.supplierPurchases.length}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {!stats || stats.supplierPurchases.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                            <ShoppingCart className="mx-auto h-8 w-8 mb-3 opacity-20" />
                            No purchases recorded yet.


                            <button
                                className="text-primary underline text-xs mt-2"
                                onClick={() => setLocation('/purchases/new')}
                            >
                                Record a purchase
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {stats.supplierPurchases.slice(0, 10).map(purchase => (
                                <div
                                    key={purchase.id}
                                    className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium">
                                            {purchase.invoiceNumber || `#${purchase.id.slice(-6).toUpperCase()}`}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                                            <span>{fmtDatetime(purchase.date)}</span>
                                            <span>·</span>
                                            <span>{purchase.items.length} item{purchase.items.length !== 1 ? 's' : ''}</span>
                                            {purchase.paymentMethod && (
                                                <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize h-4">
                                                    {purchase.paymentMethod}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <span className="font-bold text-sm text-primary tabular-nums shrink-0">
                                        {format(purchase.grandTotal)}
                                    </span>
                                </div>
                            ))}
                            {stats.supplierPurchases.length > 10 && (
                                <div className="px-4 py-3 text-center">
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLocation('/purchases')}>
                                        View all {stats.supplierPurchases.length} orders →
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Inventory summary */}
            {stats && stats.supplierProducts.length > 0 && (
                <Card>
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Inventory Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground uppercase mb-1">Products</p>
                                <p className="font-bold text-sm">{stats.supplierProducts.length}</p>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground uppercase mb-1">Total Stock</p>
                                <p className="font-bold text-sm">{stats.totalStockUnits} units</p>
                            </div>
                            <div className="bg-primary/5 rounded-lg p-3">
                                <p className="text-[10px] text-muted-foreground uppercase mb-1">Value</p>
                                <p className="font-bold text-sm text-primary">{format(stats.totalInventoryValue)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
