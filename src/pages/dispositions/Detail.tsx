import { useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useDispositions, useInventory, useProductBatches, useSuppliers, usePurchases } from '@/contexts/GlobalProviders';
import { useCurrency } from '@/hooks/useCurrency';
import { useSmartBack } from '@/contexts/NavigationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarDays, FileText, Package, Truck, CreditCard, RefreshCcw } from 'lucide-react';
import { format as formatDate, parseISO } from 'date-fns';

export default function DispositionDetail() {
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const goBack = useSmartBack('/dispositions');
    const { items: dispositions } = useDispositions();
    const { items: inventory } = useInventory();
    const { items: batches } = useProductBatches();
    const { items: suppliers } = useSuppliers();
    const { items: purchases } = usePurchases();
    const { format } = useCurrency();

    const disposition = dispositions.find(item => item.id === id);

    const product = useMemo(() => inventory.find(item => item.id === disposition?.productId), [disposition, inventory]);
    const batch = useMemo(() => batches.find(item => item.id === disposition?.batchId), [disposition, batches]);
    const supplier = useMemo(() => suppliers.find(item => item.id === disposition?.supplierId), [disposition, suppliers]);
    const replacementPurchase = useMemo(() => purchases.find(item => item.id === disposition?.replacementPurchaseInvoiceId), [disposition, purchases]);
    const originalDisposition = useMemo(() => dispositions.find(item => item.id === disposition?.reversalOfId), [disposition, dispositions]);
    const reversalDisposition = useMemo(() => dispositions.find(item => item.reversalOfId === disposition?.id), [disposition, dispositions]);
    const purchaseInvoice = useMemo(() => purchases.find(item => item.id === disposition?.purchaseInvoiceId), [disposition, purchases]);

    if (!disposition) {
        return (
            <div className="p-6 text-center">
                <p className="text-muted-foreground">Disposition not found.</p>
                <Button variant="outline" className="mt-4" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dispositions
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8">
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold truncate">{disposition.referenceNumber}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{disposition.resolution.replace(/_/g, ' ')} · {disposition.status}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setLocation(`/dispositions`)}>
                        <RefreshCcw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Disposition summary</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <div className="grid gap-2">
                            <div className="flex justify-between"><span>Date</span><span className="text-foreground">{formatDate(parseISO(disposition.date), 'dd MMM yyyy')}</span></div>
                            <div className="flex justify-between"><span>Product</span><span className="text-foreground">{product?.name ?? disposition.productName}</span></div>
                            <div className="flex justify-between"><span>Batch</span><span className="text-foreground">{batch?.batchNumber ?? disposition.batchNumber ?? '—'}</span></div>
                            <div className="flex justify-between"><span>Quantity</span><span className="text-foreground">{disposition.quantity}</span></div>
                            <div className="flex justify-between"><span>Unit cost</span><span className="text-foreground">{format(disposition.unitCost)}</span></div>
                            <div className="flex justify-between"><span>Total value</span><span className="text-foreground">{format(disposition.totalValue)}</span></div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Supplier & settlement</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                        <div className="grid gap-2">
                            <div className="flex justify-between"><span>Supplier</span><span className="text-foreground">{supplier?.name ?? disposition.supplierName ?? '—'}</span></div>
                            <div className="flex justify-between"><span>Purchase invoice</span><span className="text-foreground">{purchaseInvoice?.invoiceNumber ?? disposition.purchaseInvoiceNumber ?? '—'}</span></div>
                            <div className="flex justify-between"><span>Settlement type</span><span className="text-foreground">{disposition.settlementType}</span></div>
                            <div className="flex justify-between"><span>Settlement status</span><span className="text-foreground">{disposition.settlementStatus ?? '—'}</span></div>
                            <div className="flex justify-between"><span>Settlement amount</span><span className="text-foreground">{format(disposition.settlementAmount)}</span></div>
                            <div className="flex justify-between"><span>Method</span><span className="text-foreground">{disposition.settlementMethod ?? '—'}</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Audit details</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex justify-between"><span>Performed by</span><span className="text-foreground">{disposition.performedByName ?? 'Unknown'}</span></div>
                        <div className="flex justify-between"><span>Reference</span><span className="text-foreground">{disposition.referenceNumber}</span></div>
                        <div className="flex justify-between"><span>Reversal of</span><span className="text-foreground">{originalDisposition?.referenceNumber ?? '—'}</span></div>
                        <div className="flex justify-between"><span>Reversed by</span><span className="text-foreground">{reversalDisposition?.referenceNumber ?? '—'}</span></div>
                        <div className="flex justify-between"><span>Replacement purchase</span><span className="text-foreground">{replacementPurchase?.invoiceNumber ?? '—'}</span></div>
                    </div>
                    {disposition.notes && (
                        <div>
                            <p className="text-sm font-medium text-foreground flex items-center gap-1"><FileText className="h-4 w-4" /> Notes</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{disposition.notes}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
