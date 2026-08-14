import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { SaveBar } from '@/pages/inventory/Form/SaveBar';
import type { UseFormReturn } from 'react-hook-form';
import { ProductFormValues } from '@/pages/inventory/Form/types';

export function useInventoryFooter(
    activeStep: number,
    totalSteps: number,
    goBack: () => void,
    setActiveStep: (step: number) => void,
    stepErrorsWithUI: boolean[],
    form: UseFormReturn<ProductFormValues>,
    isMobile: boolean,
    onNext?: () => void
) {
    const anyStepHasErrors = stepErrorsWithUI.some(Boolean);

    if (isMobile) {
        if (activeStep !== totalSteps - 1) return null;
        return anyStepHasErrors ? null : <SaveBar onBack={goBack} form={form} />;
    }

    if (activeStep === totalSteps - 1 && !anyStepHasErrors) {
        return <SaveBar onBack={goBack} form={form} />;
    }

    return (
        <div className={cn(
            'sticky bottom-0 left-0 right-0 z-40 -mx-4 -mb-4 md:-mx-6 md:-mb-6',
            'border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80',
            'px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
            'shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.08)]'
        )}>
            <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
                <Button type="button" variant="outline" onClick={activeStep === 0 ? goBack : () => setActiveStep(activeStep - 1)} className="h-11 rounded-2xl border-border">
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <span className="text-sm font-medium text-muted-foreground">Step {activeStep + 1} of {totalSteps}</span>
                {activeStep < totalSteps - 1 ? (
                    <Button type="button" onClick={onNext || (() => setActiveStep(activeStep + 1))} className="h-11 rounded-2xl font-semibold">
                        Next <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Button>
                ) : (
                    <div className="w-10.5" />
                )}
            </div>
        </div>
    );
}