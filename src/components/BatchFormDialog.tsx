import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, FlaskConical, Save, Wand2 } from 'lucide-react';
import { ProductBatch, Supplier } from '@/types';
import { addMonths, format as fmtDate, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

// ─── Schema ───────────────────────────────────────────────────────────────────
const batchSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  manufacturingDate: z.string().min(1, 'Manufacturing date is required'),
  expiryMode: z.enum(['months', 'manual']),
  expiryMonths: z.coerce.number().min(1, 'Must be at least 1 month').optional(),
  expiryDate: z.string().optional(),
  initialQuantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  purchaseRate: z.coerce.number().min(0, 'Purchase rate cannot be negative'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  const today = startOfDay(new Date());
  const mfgDate = parseISO(data.manufacturingDate);

  if (isAfter(mfgDate, today)) {
    ctx.addIssue({ code: 'custom', path: ['manufacturingDate'], message: 'Manufacturing date cannot be in the future' });
  }

  if (data.expiryMode === 'months') {
    if (!data.expiryMonths || data.expiryMonths < 1) {
      ctx.addIssue({ code: 'custom', path: ['expiryMonths'], message: 'Enter a valid shelf life in months' });
    }
  }

  if (data.expiryMode === 'manual') {
    if (!data.expiryDate) {
      ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Expiry date is required' });
    } else {
      const expDate = parseISO(data.expiryDate);
      if (!isAfter(expDate, mfgDate)) {
        ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Expiry date must be after manufacturing date' });
      }
    }
  }
});

type BatchFormValues = z.infer<typeof batchSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function computeExpiryDate(mfgDate: string, months: number): string {
  return addMonths(parseISO(mfgDate), months).toISOString().split('T')[0];
}

export function getBatchStatus(expiryDate: string | null): 'expired' | 'expiring' | 'ok' | 'none' {
  if (!expiryDate) return 'none';
  const today = startOfDay(new Date());
  const exp = startOfDay(parseISO(expiryDate));
  if (isBefore(exp, today)) return 'expired';
  const warn = addMonths(today, 1); // expiring within 30 days
  if (isBefore(exp, warn)) return 'expiring';
  return 'ok';
}

export function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const status = getBatchStatus(expiryDate);
  if (status === 'none') return null;
  if (status === 'expired') return <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Expired</Badge>;
  if (status === 'expiring') return <Badge className="text-[10px] py-0 px-1.5 bg-orange-500/10 text-orange-600 border-orange-300">Expiring Soon</Badge>;
  return <Badge className="text-[10px] py-0 px-1.5 bg-green-500/10 text-green-700 border-green-300">Good</Badge>;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface BatchFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (batch: Omit<ProductBatch, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>) => void;
  suppliers: Supplier[];
  productId: string;
  editBatch?: ProductBatch | null;
  nextBatchNumber: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function BatchFormDialog({
  open, onClose, onSave, suppliers, productId, editBatch, nextBatchNumber,
}: BatchFormDialogProps) {
  const [previewExpiry, setPreviewExpiry] = useState<string | null>(null);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      supplierId: editBatch?.supplierId ?? '',
      batchNumber: editBatch?.batchNumber ?? nextBatchNumber,
      manufacturingDate: editBatch?.manufacturingDate?.split('T')[0] ?? '',
      expiryMode: editBatch?.expiryMonths ? 'months' : 'manual',
      expiryMonths: editBatch?.expiryMonths ?? undefined,
      expiryDate: editBatch?.expiryDate?.split('T')[0] ?? '',
      initialQuantity: editBatch?.initialQuantity ?? 1,
      purchaseRate: editBatch?.purchaseRate ?? 0,
      notes: editBatch?.notes ?? '',
    },
  });

  const expiryMode = form.watch('expiryMode');
  const mfgDate = form.watch('manufacturingDate');
  const expiryMonths = form.watch('expiryMonths');

  // Auto-compute expiry date preview when using months mode
  useEffect(() => {
    if (expiryMode === 'months' && mfgDate && expiryMonths && expiryMonths > 0) {
      try {
        setPreviewExpiry(computeExpiryDate(mfgDate, Number(expiryMonths)));
      } catch {
        setPreviewExpiry(null);
      }
    } else {
      setPreviewExpiry(null);
    }
  }, [expiryMode, mfgDate, expiryMonths]);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      form.reset({
        supplierId: editBatch?.supplierId ?? '',
        batchNumber: editBatch?.batchNumber ?? nextBatchNumber,
        manufacturingDate: editBatch?.manufacturingDate?.split('T')[0] ?? '',
        expiryMode: editBatch?.expiryMonths ? 'months' : 'manual',
        expiryMonths: editBatch?.expiryMonths ?? undefined,
        expiryDate: editBatch?.expiryDate?.split('T')[0] ?? '',
        initialQuantity: editBatch?.initialQuantity ?? 1,
        purchaseRate: editBatch?.purchaseRate ?? 0,
        notes: editBatch?.notes ?? '',
      });
    }
  }, [open, editBatch, nextBatchNumber]); // eslint-disable-line

  const onSubmit = (data: BatchFormValues) => {
    let finalExpiryDate: string | null = null;
    let finalExpiryMonths: number | null = null;

    if (data.expiryMode === 'months' && data.expiryMonths && mfgDate) {
      finalExpiryMonths = data.expiryMonths;
      finalExpiryDate = computeExpiryDate(mfgDate, data.expiryMonths);
    } else if (data.expiryMode === 'manual' && data.expiryDate) {
      finalExpiryDate = data.expiryDate;
      finalExpiryMonths = null;
    }

    onSave({
      productId,
      supplierId: data.supplierId,
      batchNumber: data.batchNumber,
      manufacturingDate: data.manufacturingDate,
      expiryMonths: finalExpiryMonths,
      expiryDate: finalExpiryDate,
      initialQuantity: data.initialQuantity,
      quantity: editBatch ? editBatch.quantity : data.initialQuantity,
      purchaseRate: data.purchaseRate,
      notes: data.notes ?? '',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            {editBatch ? 'Edit Batch' : 'Add New Batch'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Supplier + Batch number */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="batchNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch No. *</FormLabel>
                  <FormControl>
                    <Input placeholder="B-2024-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Manufacturing date */}
            <FormField control={form.control} name="manufacturingDate" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Manufacturing Date *</FormLabel>
                <FormControl>
                  <Input type="date" max={new Date().toISOString().split('T')[0]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Expiry mode toggle */}
            <div>
              <label className="text-sm font-medium mb-2 block">Expiry Date Mode</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue('expiryMode', 'months')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    expiryMode === 'months'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <Wand2 className="h-3.5 w-3.5" /> Auto (months)
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue('expiryMode', 'manual')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    expiryMode === 'manual'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> Manual date
                </button>
              </div>
            </div>

            {expiryMode === 'months' ? (
              <FormField control={form.control} name="expiryMonths" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shelf Life (months after manufacturing) *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={120} placeholder="e.g. 12" {...field} />
                  </FormControl>
                  {previewExpiry && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      Expiry: <span className="font-semibold text-foreground ml-1">
                        {fmtDate(parseISO(previewExpiry), 'dd MMM yyyy')}
                      </span>
                      <ExpiryBadge expiryDate={previewExpiry} />
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            ) : (
              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  {field.value && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <ExpiryBadge expiryDate={field.value} />
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Qty + purchase rate */}
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="initialQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="purchaseRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Rate</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any notes about this batch..." rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit"><Save className="h-4 w-4 mr-1" /> Save Batch</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
