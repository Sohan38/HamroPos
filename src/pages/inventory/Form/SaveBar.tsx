import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';
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
    <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t px-4 py-3 md:relative md:border-none md:bg-transparent md:px-0 md:py-6 z-20">
      {/* Error summary nudge — shows only after submit with errors */}
      {errorCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-destructive mb-2 px-1 animate-in slide-in-from-bottom-2 duration-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {errorCount === 1
              ? 'Fix 1 field above to continue'
              : `Fix ${errorCount} fields above to continue`}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
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
            'flex-1 md:flex-initial transition-all',
            errorCount > 0 && 'opacity-70'
          )}
          disabled={isSaving}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Product'}
        </Button>
      </div>
    </div>
  );
});

SaveBar.displayName = 'SaveBar';
