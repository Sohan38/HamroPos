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

  // Count of unique error fields — only surface after first submit attempt
  const errorCount = isSubmitted ? Object.keys(errors).length : 0;

  return (
    // Added negative margins (-mx-4, -mb-4) to break out of parent's padding
    <div className="sticky bottom-0 left-0 right-0 z-40 -mx-4 -mb-4 md:-mx-6 md:-mb-6 border-t bg-background/95 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.1)] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">

      {/* Container to align content properly on larger screens */}
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 md:flex-row md:items-center md:justify-end">

        {/* Error summary nudge — shows only after submit with errors */}
        {errorCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive animate-in slide-in-from-bottom-2 duration-200 md:mr-auto md:max-w-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {errorCount === 1
                ? 'Fix 1 field above to continue'
                : `Fix ${errorCount} fields above to continue`}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex w-full items-center gap-3 md:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 md:flex-initial"
            disabled={isSaving}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
          </Button>

          <Button
            type="submit"
            className={cn(
              'flex-1 transition-all md:flex-initial',
              errorCount > 0 && 'opacity-80'
            )}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? 'Saving...' : 'Save Product'}
          </Button>
        </div>
      </div>
    </div>
  );
});

SaveBar.displayName = 'SaveBar';