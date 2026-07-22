import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/types';
import { useBackModal } from '@/contexts/NavigationContext';

interface StockAdjustDialogProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdjust: (productId: string, newQuantity: number, reason: string) => void;
}

export function StockAdjustDialog({ product, open, onClose, onAdjust }: StockAdjustDialogProps) {
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useBackModal(open, onClose, 'stock-adjust-dialog');

  if (!product) return null;

  const currentQty = product.quantity;

  const computeNew = (): number => {
    const val = Number(amount) || 0;
    if (mode === 'add') return currentQty + val;
    if (mode === 'remove') return Math.max(0, currentQty - val);
    return Math.max(0, val); // set
  };

  const newQty = computeNew();
  const diff = newQty - currentQty;

  const handleSave = () => {
    if (!amount) { toast.error('Enter an amount'); return; }
    if (mode === 'remove' && Number(amount) > currentQty) {
      toast.error(`Cannot remove more than current stock (${currentQty})`);
      return;
    }
    onAdjust(product.id, newQty, reason || `Manual ${mode === 'add' ? 'increase' : mode === 'remove' ? 'decrease' : 'set'}`);
    setAmount('');
    setReason('');
    onClose();
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="font-semibold truncate">{product.name}</div>
            <div className="text-sm text-muted-foreground">
              Current: <span className="font-bold text-foreground">{currentQty}</span> {product.unit}
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

          <div className="space-y-1">
            <Label>
              {mode === 'add' ? 'Add Quantity' : mode === 'remove' ? 'Remove Quantity' : 'Set New Quantity'}
            </Label>
            <Input
              type="number"
              min="0"
              placeholder="Enter amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="h-12 text-lg font-bold"
              data-testid="input-stock-amount"
            />
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
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-stock-adjust">
            <Save className="h-4 w-4 mr-2" /> Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
