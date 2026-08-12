import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface ConfirmOptions {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'destructive';
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setOptions(opts);
            setOpen(true);
        });
    }, []);

    const handleConfirm = () => {
        resolverRef.current?.(true);
        setOpen(false);
    };

    const handleCancel = () => {
        resolverRef.current?.(false);
        setOpen(false);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogTitle>{options?.title}</AlertDialogTitle>
                    <AlertDialogDescription>{options?.description}</AlertDialogDescription>
                    <div className="flex justify-end gap-2 mt-4">
                        <AlertDialogCancel onClick={handleCancel}>
                            {options?.cancelLabel || 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirm}
                            className={options?.variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}
                        >
                            {options?.confirmLabel || 'Confirm'}
                        </AlertDialogAction>
                    </div>
                </AlertDialogContent>
            </AlertDialog>
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
    return ctx.confirm;
}