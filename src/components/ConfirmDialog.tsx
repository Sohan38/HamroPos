import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  requireTextInput?: string; // e.g., "RESET"
  placeholderText?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  requireTextInput,
  placeholderText
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');

  // Reset input when modal open state changes
  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (requireTextInput && inputValue !== requireTextInput) {
      return;
    }
    onConfirm();
    onClose();
  };

  const isConfirmDisabled = !!requireTextInput && inputValue !== requireTextInput;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="w-[95%] max-w-md rounded-lg sm:w-full">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireTextInput && (
          <div className="my-2">
            <Input
              type="text"
              placeholder={placeholderText || `Type "${requireTextInput}" to confirm`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full"
            />
          </div>
        )}
        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel onClick={onClose} className="w-full sm:w-auto">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`w-full sm:w-auto ${requireTextInput ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}`}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
