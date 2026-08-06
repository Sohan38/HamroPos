import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { ProductFormValues } from './types';
import { cn } from '@/lib/utils';

interface SaveBarProps {
  onBack: () => void;
  isSaving?: boolean;
  form: UseFormReturn<ProductFormValues>;
}

export const SaveBar = React.memo(({ onBack, isSaving = false, form }: SaveBarProps) => {
  const { formState: { errors, isSubmitted } } = form;
  const errorCount = isSubmitted ? Object.keys(errors).length : 0;

  return (
    <div className={cn(
      'sticky bottom-0 left-0 right-0 z-40 -mx-4 -mb-4 md:-mx-6 md:-mb-6',
      'border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
      'px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
      'shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.08)]'
    )}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2.5 md:flex-row md:items-center md:justify-end">

        {/* Error nudge */}
        {errorCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive animate-in slide-in-from-bottom-2 duration-200 md:mr-auto">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {errorCount === 1 ? 'Fix 1 issue above to save' : `Fix ${errorCount} issues above to save`}
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex w-full items-center gap-2.5 md:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 h-11 rounded-2xl md:flex-initial border-border"
            disabled={isSaving}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Cancel
          </Button>

          <Button
            type="submit"
            className={cn(
              'flex-[2] h-11 rounded-2xl font-semibold text-sm md:flex-initial md:min-w-[140px]',
              'bg-primary hover:bg-primary/90 transition-all',
              errorCount > 0 && 'opacity-80'
            )}
            disabled={isSaving}
          >
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save Product</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

SaveBar.displayName = 'SaveBar';