import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/types';
import { useBackModal } from '@/contexts/NavigationContext';
import { useInventory, useProductBatches } from '@/contexts/GlobalProviders';

interface StockAdjustDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdjust?: (productId: string, newQuantity: number, reason: string) => void;
}

export function StockAdjustDialog({ product, open, onClose, onAdjust }: StockAdjustDialogProps) {
  const { update: updateProduct } = useInventory();
  const { items: allBatches, update: updateBatch } = useProductBatches();

  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedVariantName, setSelectedVariantName] = useState('');

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Memoize batches to prevent recalculation on every keystroke
  const productBatches = useMemo(() => {
    return product ? allBatches.filter(b => b.productId === product.id) : [];
  }, [product, allBatches]);

  const hasExpiry = !!(product?.hasExpiry && productBatches.length > 0);
  const hasVariants = !!(product?.hasVariants && product?.variants && product.variants.length > 0);

  useBackModal(open, onClose, 'stock-adjust-dialog');

  // Reset selections and focus input when dialog opens

  useEffect(() => {
    if (!open || !product) return;

    setSelectedBatchId(productBatches[0]?.id || '');
    setSelectedVariantName(product.variants?.[0]?.name || '');
    setAmount('');
    setReason('');
    setMode('add');

    // Delay focus slightly to ensure modal animation has started
    const timer = setTimeout(() => amountInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open, product, productBatches]);
  if (!product) return null;

  const getSelectedCurrentQty = (): number => {
    if (hasVariants) {
      const variant = product.variants?.find(v => v.name === selectedVariantName);
      return variant ? variant.quantity : 0;
    }
    if (hasExpiry) {
      const batch = productBatches.find(b => b.id === selectedBatchId);
      return batch ? batch.quantity : 0;
    }
    return product.quantity;
  };

  const currentQty = getSelectedCurrentQty();
  const numericAmount = Number(amount) || 0;

  const computeNew = (): number => {
    if (mode === 'add') return currentQty + numericAmount;
    if (mode === 'remove') return Math.max(0, currentQty - numericAmount);
    return Math.max(0, numericAmount); // set
  };

  const newQty = computeNew();
  const diff = newQty - currentQty;

  // Validation logic
  const isInvalid = !amount || numericAmount < 0 || (mode === 'remove' && numericAmount > currentQty);

  const handleSave = () => {
    if (isInvalid) {
      if (!amount) toast.error('Enter an amount');
      else if (mode === 'remove' && numericAmount > currentQty) toast.error(`Cannot remove more than current stock (${currentQty})`);
      return;
    }

    const finalReason = reason || `Manual ${mode === 'add' ? 'increase' : mode === 'remove' ? 'decrease' : 'set'}`;

    if (hasVariants) {
      const updatedVariants = product.variants?.map(v =>
        v.name === selectedVariantName ? { ...v, quantity: newQty } : v
      ) || [];
      const newTotalQty = updatedVariants.reduce((sum, v) => sum + v.quantity, 0);

      updateProduct(product.id, {
        variants: updatedVariants,
        quantity: newTotalQty
      });
      toast.success(`Updated variant "${selectedVariantName}": ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
    } else if (hasExpiry) {
      updateBatch(selectedBatchId, { quantity: newQty });

      const updatedBatches = productBatches.map(b =>
        b.id === selectedBatchId ? { ...b, quantity: newQty } : b
      );
      const newTotalQty = updatedBatches.reduce((sum, b) => sum + b.quantity, 0);

      updateProduct(product.id, {
        quantity: newTotalQty
      });
      const batch = productBatches.find(b => b.id === selectedBatchId);
      toast.success(`Updated batch "${batch?.batchNumber}": ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
    } else {
      updateProduct(product.id, { quantity: newQty });
      if (onAdjust) {
        onAdjust(product.id, newQty, finalReason);
      } else {
        toast.success(`Updated product stock: ${diff > 0 ? `+${diff}` : diff} → ${newQty} ${product.unit}. ${finalReason}`);
      }
    }

    onClose();
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    onClose();
  };

  // Helper for quick amount buttons
  const handleQuickAmount = (val: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + val));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm w-[95vw]">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="contents">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="font-semibold truncate">{product.name}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Current Total: <span className="font-bold text-foreground">{product.quantity}</span> {product.unit}
              </div>
            </div>

            {/* Variant Selector */}
            {hasVariants && (
              <div className="space-y-1">
                <Label>Select Variant</Label>
                <Select value={selectedVariantName} onValueChange={setSelectedVariantName}>
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Select variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.variants?.map(v => (
                      <SelectItem key={v.name} value={v.name}>
                        {v.name} (Current: {v.quantity} {product.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Batch Selector */}
            {hasExpiry && (
              <div className="space-y-1">
                <Label>Select Batch</Label>
                <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {productBatches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.batchNumber} {b.expiryDate ? `(Exp: ${b.expiryDate})` : ''} - Current: {b.quantity} {product.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
              <div className="text-xs text-muted-foreground">Adjusting Current Stock:</div>
              <div className="text-lg font-bold text-primary">
                {currentQty} <span className="text-sm font-normal text-muted-foreground">{product.unit}</span>
              </div>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === 'add' ? 'default' : 'outline'}
                onClick={() => setMode('add')}
                className="gap-1"
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'remove' ? 'destructive' : 'outline'}
                onClick={() => setMode('remove')}
                className="gap-1"
              >
                <Minus className="h-3 w-3" /> Remove
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'set' ? 'secondary' : 'outline'}
                onClick={() => setMode('set')}
              >
                Set To
              </Button>
            </div>

            <div className="space-y-2">
              <Label>
                {mode === 'add' ? 'Add Quantity' : mode === 'remove' ? 'Remove Quantity' : 'Set New Quantity'}
              </Label>
              <div className="flex gap-2">
                <Input
                  ref={amountInputRef}
                  type="number"
                  min="0"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()} // Prevent scroll-wheel from changing numbers
                  className="h-12 text-lg font-bold flex-1"
                  data-testid="input-stock-amount"
                />
                <div className="flex gap-1">
                  {[1, 5, 10].map(val => (
                    <Button
                      key={val}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-12 px-3 text-xs"
                      onClick={() => handleQuickAmount(val)}
                    >
                      {mode === 'remove' ? `-${val}` : `+${val}`}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            {amount && (
              <div className={`flex justify-between items-center rounded-lg p-3 text-sm font-medium
                ${diff > 0 ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                  diff < 0 ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground'}`}>
                <span>New stock</span>
                <span className="font-bold text-base">
                  {diff > 0 ? '+' : ''}{diff !== 0 ? diff : ''} → {newQty} {product.unit}
                </span>
              </div>
            )}

            <div className="space-y-1">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Damaged goods, Physical count correction..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isInvalid} data-testid="button-save-stock-adjust">
              <Save className="h-4 w-4 mr-2" /> Save Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}