import { useCallback } from 'react';
import { toast } from 'sonner';

export function useUndoDelete(
  undoAction: (id: string) => void,
  delayMs: number = 5000
) {
  const showUndoToast = useCallback((title: string, id: string) => {
    toast(`Deleted ${title}`, {
      action: {
        label: 'Undo',
        onClick: () => undoAction(id),
      },
      duration: delayMs
    });
  }, [undoAction, delayMs]);

  return showUndoToast;
}
