import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PaymentMethod, PurchasePaymentStatus } from '@/types';

interface SupplierPurchaseDraft {
    invoiceNumber: string;
    purchaseDate: string;
    referenceNumber: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PurchasePaymentStatus;
    paidAmount: string;
    notes: string;
}

interface PurchaseCaptureSectionProps {
    purchaseSupplierIds: string[];
    supplierPurchaseDrafts: Record<string, SupplierPurchaseDraft>;
    suppliers: any[];
    updatePurchaseDraft: (supplierId: string, field: keyof SupplierPurchaseDraft, value: string) => void;
}

export const PurchaseCaptureSection = React.memo(({
    purchaseSupplierIds,
    supplierPurchaseDrafts,
    suppliers,
    updatePurchaseDraft,
}: PurchaseCaptureSectionProps) => (
    <div className="p-6 md:p-8 bg-muted/20">
        <div className="flex items-start justify-between gap-3 mb-4">
            <div>
                <h3 className="font-semibold">Purchase capture</h3>
                <p className="text-xs text-muted-foreground">
                    Create one purchase document per supplier for this item.
                </p>
            </div>
        </div>
        <div className="space-y-4">
            {purchaseSupplierIds.map(supplierId => {
                const draft = supplierPurchaseDrafts[supplierId];
                const supplier = suppliers.find(c => c.id === supplierId);
                if (!draft) return null;
                return (
                    <Card key={supplierId} className="border-dashed">
                        <CardContent className="p-4 md:p-5 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">{supplier?.name ?? 'Supplier'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Invoice, payment, and reference details
                                    </p>
                                </div>
                                <div className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {draft.paymentStatus}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="space-y-1 text-sm font-medium">
                                    Supplier invoice #
                                    <Input
                                        value={draft.invoiceNumber}
                                        onChange={e =>
                                            updatePurchaseDraft(supplierId, 'invoiceNumber', e.target.value)
                                        }
                                        placeholder="e.g. SUP-2026-001"
                                    />
                                </label>
                                <label className="space-y-1 text-sm font-medium">
                                    Purchase date
                                    <Input
                                        type="date"
                                        value={draft.purchaseDate}
                                        onChange={e =>
                                            updatePurchaseDraft(supplierId, 'purchaseDate', e.target.value)
                                        }
                                    />
                                </label>
                                <label className="space-y-1 text-sm font-medium">
                                    Reference number
                                    <Input
                                        value={draft.referenceNumber}
                                        onChange={e =>
                                            updatePurchaseDraft(supplierId, 'referenceNumber', e.target.value)
                                        }
                                        placeholder="Optional PO or delivery ref"
                                    />
                                </label>
                                <label className="space-y-1 text-sm font-medium">
                                    Payment method
                                    <Select
                                        value={draft.paymentMethod}
                                        onValueChange={val =>
                                            updatePurchaseDraft(supplierId, 'paymentMethod', val)
                                        }
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {(['cash', 'qr', 'card', 'bank', 'split'] as PaymentMethod[]).map(m => (
                                                <SelectItem className="capitalize" key={m} value={m}>
                                                    {m}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </label>
                                <label className="space-y-1 text-sm font-medium">
                                    Payment status
                                    <Select
                                        value={draft.paymentStatus}
                                        onValueChange={val =>
                                            updatePurchaseDraft(supplierId, 'paymentStatus', val)
                                        }
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unpaid">Unpaid</SelectItem>
                                            <SelectItem value="partial">Partially paid</SelectItem>
                                            <SelectItem value="paid">Paid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                                {draft.paymentStatus === 'partial' && (
                                    <label className="space-y-1 text-sm font-medium">
                                        Paid amount
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={draft.paidAmount}
                                            onChange={e =>
                                                updatePurchaseDraft(supplierId, 'paidAmount', e.target.value)
                                            }
                                        />
                                    </label>
                                )}
                            </div>
                            <label className="space-y-1 text-sm font-medium block">
                                Notes
                                <Textarea
                                    value={draft.notes}
                                    onChange={e =>
                                        updatePurchaseDraft(supplierId, 'notes', e.target.value)
                                    }
                                    placeholder="Delivery notes or payment terms"
                                    rows={2}
                                />
                            </label>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    </div>
));