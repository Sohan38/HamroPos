import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SupplierForm from '@/pages/suppliers/Form';
import { useBackModal } from '@/contexts/NavigationContext';

interface SupplierFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (supplierId: string) => void;
  defaultName?: string;
}

export function SupplierFormDialog({ open, onClose, onSuccess, defaultName }: SupplierFormDialogProps) {
  useBackModal(open, onClose, 'supplier-form-dialog');

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
        </DialogHeader>
        <SupplierForm isModal onSuccess={onSuccess} onCancel={onClose} defaultName={defaultName} />
      </DialogContent>
    </Dialog>
  );
}
