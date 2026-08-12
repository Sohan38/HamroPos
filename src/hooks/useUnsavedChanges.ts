import { useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';

interface UseUnsavedChangesOptions {
    /** Whether the form currently has unsaved modifications */
    isDirty: boolean;
    /** Custom async confirm function (e.g. from useConfirm) */
    customConfirm?: () => Promise<boolean>;
    /** Called when the user confirms they want to leave */
    onLeave: () => void;
}

export function useUnsavedChanges({
    isDirty,
    customConfirm,
    onLeave,
}: UseUnsavedChangesOptions) {
    const { registerModal } = useNavigation();
    const unregisterRef = useRef<(() => void) | null>(null);
    const isDirtyRef = useRef(isDirty);
    isDirtyRef.current = isDirty;

    // Stable async confirm that falls back to native window.confirm
    const confirmLeave = useCallback(async (): Promise<boolean> => {
        if (customConfirm) {
            return await customConfirm();
        }
        return window.confirm('You have unsaved changes. Are you sure you want to leave?');
    }, [customConfirm]);

    useEffect(() => {
        // If the form is clean, remove the guard (if any)
        if (!isDirty) {
            unregisterRef.current?.();
            unregisterRef.current = null;
            return;
        }

        // Already registered – nothing to do
        if (unregisterRef.current) return;

        // Register a fake modal that intercepts any back action
        const handleBackAttempt = async () => {
            const shouldLeave = await confirmLeave();
            if (shouldLeave) {
                // Unregister so the next back press goes through normally
                unregisterRef.current?.();
                unregisterRef.current = null;
                onLeave();
            }
            // If cancelled, the modal stays – next back press will try again
        };

        unregisterRef.current = registerModal('unsaved-changes', handleBackAttempt);

        return () => {
            unregisterRef.current?.();
            unregisterRef.current = null;
        };
    }, [isDirty, confirmLeave, registerModal, onLeave]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            unregisterRef.current?.();
        };
    }, []);
}