import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBackModal } from '@/contexts/NavigationContext';
import { useInventory, useProductBatches, usePurchases, useSuppliers, useDispositions } from '@/contexts/GlobalProviders';
import { useStorageProvider } from '@/storage/StorageContext';
import { Product, ProductBatch, PurchaseInvoice, Supplier, DispositionReason, DispositionResolution, DispositionSettlementStatus, PaymentMethod, InventoryDisposition } from '@/types';
import { createInventoryDisposition, CreateInventoryDispositionInput } from '@/services/dispositionService';
import { toast } from 'sonner';

const settlementMethods: PaymentMethod[] = ['cash', 'bank', 'card', 'qr', 'split', 'credit'];
const settlementStatuses: DispositionSettlementStatus[] = ['pending', 'completed', 'cancelled'];

const reasons: DispositionReason[] = [
    'expired',
    'damaged',
    'defective',
    'supplier_recall',
    'wrong_item_supplied',
    'other',
];

const resolutions: DispositionResolution[] = [
    'return_to_supplier',
    'supplier_replacement',
    'supplier_credit',
    'supplier_refund',
    'write_off',
];

interface InventoryDispositionDialogProps {
    product: Product;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (disposition: InventoryDisposition) => void;
}

export function InventoryDispositionDialog({ product, open, onOpenChange, onCreated }: InventoryDispositionDialogProps) {
    const storage = useStorageProvider();
    const { items: batches } = useProductBatches();
    const { items: suppliers } = useSuppliers();
    const { items: purchases } = usePurchases();
    const { refresh: refreshInventory } = useInventory();
    const { refresh: refreshBatches } = useProductBatches();
    const { refresh: refreshDispositions } = useDispositions();

    const productBatches = useMemo(() => {
        return batches.filter(batch => batch.productId === product.id);
    }, [batches, product.id]);

    const productSuppliers = useMemo(() => {
        const ids = product.supplierIds?.length ? product.supplierIds : product.supplierId ? [product.supplierId] : [];
        return suppliers.filter(supplier => ids.includes(supplier.id));
    }, [product, suppliers]);

    const [selectedBatchId, setSelectedBatchId] = useState<string>(productBatches[0]?.id ?? '');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>(product.supplierId || productBatches[0]?.supplierId || '');
    const [selectedPurchaseInvoiceId, setSelectedPurchaseInvoiceId] = useState<string>('');
    const [reason, setReason] = useState<DispositionReason>(product.hasExpiry ? 'expired' : 'damaged');
    const [resolution, setResolution] = useState<DispositionResolution>('return_to_supplier');
    const [quantity, setQuantity] = useState<string>('');
    const [unitCost, setUnitCost] = useState<string>(String(product.purchaseRate ?? 0));
    const [referenceNumber, setReferenceNumber] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [settlementAmount, setSettlementAmount] = useState<string>('');
    const [settlementMethod, setSettlementMethod] = useState<PaymentMethod>('cash');
    const [settlementStatus, setSettlementStatus] = useState<DispositionSettlementStatus>('pending');
    const [settlementReference, setSettlementReference] = useState<string>('');
    const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [replacementBatchNumber, setReplacementBatchNumber] = useState<string>('');
    const [replacementManufacturingDate, setReplacementManufacturingDate] = useState<string>('');
    const [replacementExpiryMode, setReplacementExpiryMode] = useState<'months' | 'manual'>('months');
    const [replacementExpiryMonths, setReplacementExpiryMonths] = useState<string>('');
    const [replacementExpiryDate, setReplacementExpiryDate] = useState<string>('');
    const [replacementPurchaseRate, setReplacementPurchaseRate] = useState<string>(String(product.purchaseRate ?? 0));
    const [replacementNotes, setReplacementNotes] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    useBackModal(open, () => onOpenChange(false), 'inventory-disposition-dialog');

    useEffect(() => {
        if (!open) return;
        setSelectedBatchId(productBatches[0]?.id ?? '');
        setSelectedSupplierId(product.supplierId || productBatches[0]?.supplierId || '');
        setSelectedPurchaseInvoiceId(productBatches[0]?.purchaseInvoiceId ?? '');
        setReason(product.hasExpiry ? 'expired' : 'damaged');
        setResolution('return_to_supplier');
        setQuantity('');
        setUnitCost(String(product.purchaseRate ?? 0));
        setReferenceNumber('');
        setNotes('');
        setSettlementAmount('');
        setSettlementMethod('cash');
        setSettlementStatus('pending');
        setSettlementReference('');
        setSettlementDate(new Date().toISOString().slice(0, 10));
        setReplacementBatchNumber('');
        setReplacementManufacturingDate('');
        setReplacementExpiryMode('months');
        setReplacementExpiryMonths('');
        setReplacementExpiryDate('');
        setReplacementPurchaseRate(String(product.purchaseRate ?? 0));
        setReplacementNotes('');
    }, [open, product, productBatches]);

    const selectedBatch = useMemo(() => {
        return productBatches.find(batch => batch.id === selectedBatchId) ?? null;
    }, [productBatches, selectedBatchId]);

    const selectedPurchaseInvoice = useMemo(() => {
        return purchases.find(purchase => purchase.id === selectedPurchaseInvoiceId) ?? null;
    }, [purchases, selectedPurchaseInvoiceId]);

    const batchOptions = product.hasExpiry ? productBatches : [];
    const supplierOptions = productSuppliers.length > 0 ? productSuppliers : suppliers;

    const batchPurchaseInvoiceOptions = useMemo(() => {
        if (!selectedBatch) return [];
        return purchases.filter((purchase) => {
            if (selectedBatch.purchaseInvoiceId && purchase.id === selectedBatch.purchaseInvoiceId) {
                return true;
            }
            return purchase.items.some((item) => item.batchId === selectedBatch.id);
        });
    }, [purchases, selectedBatch]);

    const supplierPurchaseInvoiceOptions = useMemo(() => {
        const supplierId = selectedSupplierId || product.supplierId;
        if (!supplierId) return purchases;
        return purchases.filter((purchase) => purchase.supplierId === supplierId);
    }, [purchases, selectedSupplierId, product.supplierId]);

    const purchaseInvoiceOptions = selectedBatch ? batchPurchaseInvoiceOptions : supplierPurchaseInvoiceOptions;

    useEffect(() => {
        if (selectedBatch?.purchaseInvoiceId) {
            setSelectedPurchaseInvoiceId(selectedBatch.purchaseInvoiceId);
            return;
        }

        if (selectedPurchaseInvoiceId && !purchaseInvoiceOptions.some((invoice) => invoice.id === selectedPurchaseInvoiceId)) {
            setSelectedPurchaseInvoiceId('');
        }
    }, [selectedBatch, selectedPurchaseInvoiceId, purchaseInvoiceOptions]);

    const quantityValue = Number(quantity || 0);
    const batchAvailable = selectedBatch?.quantity ?? product.quantity;
    const canSubmit = quantityValue > 0 && quantityValue <= batchAvailable && (!product.hasExpiry || !!selectedBatchId) && (!product.supplierIds || product.supplierIds.length === 0 || !!selectedSupplierId);

    const showSettlementFields = resolution === 'supplier_credit' || resolution === 'supplier_refund';
    const showReplacementFields = resolution === 'supplier_replacement';

    const handleSubmit = async () => {
        if (!canSubmit) {
            toast.error('Please enter a valid disposition quantity and complete required fields.');
            return;
        }

        const input: CreateInventoryDispositionInput = {
            referenceNumber: referenceNumber.trim() || undefined,
            reason,
            resolution,
            productId: product.id,
            batchId: selectedBatchId || undefined,
            purchaseInvoiceId: selectedPurchaseInvoiceId || undefined,
            supplierId: selectedSupplierId || undefined,
            quantity: quantityValue,
            unitCost: Number(unitCost || selectedBatch?.purchaseRate || product.purchaseRate || 0),
            settlementAmount: showSettlementFields ? Number(settlementAmount || 0) : undefined,
            settlementMethod: showSettlementFields ? settlementMethod : undefined,
            settlementStatus: showSettlementFields ? settlementStatus : undefined,
            settlementReference: showSettlementFields ? settlementReference.trim() || undefined : undefined,
            settlementDate: showSettlementFields ? settlementDate || undefined : undefined,
            notes: notes.trim() || undefined,
            replacementDetails: showReplacementFields ? {
                batchNumber: replacementBatchNumber.trim() || undefined,
                manufacturingDate: replacementManufacturingDate || undefined,
                expiryMode: replacementExpiryMode,
                expiryMonths: replacementExpiryMode === 'months' ? Number(replacementExpiryMonths || 0) : null,
                expiryDate: replacementExpiryMode === 'manual' ? replacementExpiryDate || undefined : undefined,
                notes: replacementNotes.trim() || undefined,
                purchaseRate: Number(replacementPurchaseRate || 0),
            } : undefined,
        };

        setIsSaving(true);
        try {
            const disposition = await createInventoryDisposition(storage, input);
            refreshInventory();
            refreshBatches();
            refreshDispositions();
            toast.success('Inventory disposition recorded successfully.');
            onCreated?.(disposition);
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to create disposition', error);
            toast.error((error as Error).message || 'Failed to save disposition');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl mx-3 sm:mx-auto">
                <DialogHeader>
                    <DialogTitle>Inventory Disposition</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="disposition-product">Product</Label>
                            <Input id="disposition-product" value={product.name} readOnly />
                        </div>
                        <div>
                            <Label htmlFor="disposition-ref">Reference #</Label>
                            <Input
                                id="disposition-ref"
                                value={referenceNumber}
                                onChange={event => setReferenceNumber(event.target.value)}
                                placeholder="Auto generated"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="disposition-reason">Reason</Label>
                            <Select value={reason} onValueChange={(value) => setReason(value as DispositionReason)}>
                                <SelectTrigger id="disposition-reason">
                                    <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                    {reasons.map(item => (
                                        <SelectItem key={item} value={item}>{item.replace(/_/g, ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="disposition-resolution">Resolution</Label>
                            <Select value={resolution} onValueChange={(value) => setResolution(value as DispositionResolution)}>
                                <SelectTrigger id="disposition-resolution">
                                    <SelectValue placeholder="Select resolution" />
                                </SelectTrigger>
                                <SelectContent>
                                    {resolutions.map(item => (
                                        <SelectItem key={item} value={item}>{item.replace(/_/g, ' ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {product.hasExpiry && (
                        <div>
                            <Label htmlFor="disposition-batch">Batch</Label>
                            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                                <SelectTrigger id="disposition-batch">
                                    <SelectValue placeholder="Select batch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {batchOptions.length > 0 ? batchOptions.map(batch => (
                                        <SelectItem key={batch.id} value={batch.id}>
                                            {batch.batchNumber} — {batch.quantity} available
                                        </SelectItem>
                                    )) : (
                                        <SelectItem value="" disabled>No batches available</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {!batchOptions.length && (
                                <p className="text-xs text-muted-foreground mt-1">Create a batch first or use stock adjustment with expiry batches enabled.</p>
                            )}
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="disposition-quantity">Quantity</Label>
                            <Input
                                id="disposition-quantity"
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={(event) => setQuantity(event.target.value)}
                                placeholder="Enter quantity"
                            />
                        </div>
                        <div>
                            <Label htmlFor="disposition-unit-cost">Unit Cost</Label>
                            <Input
                                id="disposition-unit-cost"
                                type="number"
                                min={0}
                                step="0.01"
                                value={unitCost}
                                onChange={(event) => setUnitCost(event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="disposition-supplier">Supplier</Label>
                            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                                <SelectTrigger id="disposition-supplier">
                                    <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {supplierOptions.length > 0 ? supplierOptions.map(supplier => (
                                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                    )) : (
                                        <SelectItem value="" disabled>No supplier available</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="disposition-purchase">Purchase invoice</Label>
                            <Select value={selectedPurchaseInvoiceId} onValueChange={setSelectedPurchaseInvoiceId}>
                                <SelectTrigger id="disposition-purchase">
                                    <SelectValue placeholder="Optional invoice" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">None</SelectItem>
                                    {purchaseInvoiceOptions.length > 0 ? purchaseInvoiceOptions.map(purchase => (
                                        <SelectItem key={purchase.id} value={purchase.id}>
                                            {purchase.invoiceNumber} — {purchase.supplierName ?? 'Unknown'}
                                        </SelectItem>
                                    )) : (
                                        <SelectItem value="" disabled>No matching invoices available</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {selectedBatch && purchaseInvoiceOptions.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-1">No purchase invoice is linked to this batch. Use the batch invoice or create the matching purchase first.</p>
                            )}
                        </div>
                    </div>

                    {showSettlementFields && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <Label htmlFor="disposition-settlement-amount">Settlement amount</Label>
                                <Input
                                    id="disposition-settlement-amount"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={settlementAmount}
                                    onChange={(event) => setSettlementAmount(event.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="disposition-settlement-method">Method</Label>
                                <Select value={settlementMethod} onValueChange={(value) => setSettlementMethod(value as PaymentMethod)}>
                                    <SelectTrigger id="disposition-settlement-method">
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {settlementMethods.map(method => (
                                            <SelectItem key={method} value={method}>{method}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="disposition-settlement-status">Status</Label>
                                <Select value={settlementStatus} onValueChange={(value) => setSettlementStatus(value as DispositionSettlementStatus)}>
                                    <SelectTrigger id="disposition-settlement-status">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {settlementStatuses.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="disposition-settlement-reference">Reference</Label>
                                <Input
                                    id="disposition-settlement-reference"
                                    value={settlementReference}
                                    onChange={event => setSettlementReference(event.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="disposition-settlement-date">Date</Label>
                                <Input
                                    id="disposition-settlement-date"
                                    type="date"
                                    value={settlementDate}
                                    onChange={event => setSettlementDate(event.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {showReplacementFields && (
                        <div className="rounded-lg border border-muted/50 bg-muted/5 p-4">
                            <p className="text-sm font-semibold">Replacement stock details</p>
                            <div className="grid gap-3 sm:grid-cols-2 mt-3">
                                <div>
                                    <Label htmlFor="replacement-batch-number">Batch number</Label>
                                    <Input
                                        id="replacement-batch-number"
                                        value={replacementBatchNumber}
                                        onChange={event => setReplacementBatchNumber(event.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="replacement-manufacturing-date">Mfg date</Label>
                                    <Input
                                        id="replacement-manufacturing-date"
                                        type="date"
                                        value={replacementManufacturingDate}
                                        onChange={event => setReplacementManufacturingDate(event.target.value)}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Label htmlFor="replacement-expiry-mode">Expiry mode</Label>
                                    <Select value={replacementExpiryMode} onValueChange={(value) => setReplacementExpiryMode(value as 'months' | 'manual')}>
                                        <SelectTrigger id="replacement-expiry-mode">
                                            <SelectValue placeholder="Select expiry mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="months">Months</SelectItem>
                                            <SelectItem value="manual">Manual date</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {replacementExpiryMode === 'months' ? (
                                    <div>
                                        <Label htmlFor="replacement-expiry-months">Expiry months</Label>
                                        <Input
                                            id="replacement-expiry-months"
                                            type="number"
                                            min={0}
                                            step="1"
                                            value={replacementExpiryMonths}
                                            onChange={event => setReplacementExpiryMonths(event.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <Label htmlFor="replacement-expiry-date">Expiry date</Label>
                                        <Input
                                            id="replacement-expiry-date"
                                            type="date"
                                            value={replacementExpiryDate}
                                            onChange={event => setReplacementExpiryDate(event.target.value)}
                                        />
                                    </div>
                                )}
                                <div>
                                    <Label htmlFor="replacement-purchase-rate">Purchase rate</Label>
                                    <Input
                                        id="replacement-purchase-rate"
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={replacementPurchaseRate}
                                        onChange={event => setReplacementPurchaseRate(event.target.value)}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <Label htmlFor="replacement-notes">Notes</Label>
                                    <Textarea
                                        id="replacement-notes"
                                        value={replacementNotes}
                                        onChange={event => setReplacementNotes(event.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <Label htmlFor="disposition-notes">Notes</Label>
                        <Textarea
                            id="disposition-notes"
                            value={notes}
                            onChange={event => setNotes(event.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving || !canSubmit}>
                        {isSaving ? 'Saving…' : 'Save disposition'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
