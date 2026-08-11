import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, XCircle } from 'lucide-react'; // added XCircle

export interface Step {
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
    completed?: boolean;
    fields?: string[]; // NEW: form field names for validation error mapping
}

interface StepFormContainerProps {
    steps: Step[];
    activeStep: number;
    onStepChange: (index: number) => void;
    footer?: React.ReactNode;
    stepErrors?: boolean[]; // NEW
    isMobile?: boolean;
}

export function StepFormContainer({
    steps,
    activeStep,
    onStepChange,
    footer,
    stepErrors = [], // default empty
    isMobile = false,
}: StepFormContainerProps) {
    const totalSteps = steps.length;
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll active step into view on mobile
    useEffect(() => {
        if (scrollRef.current) {
            const activeElement = scrollRef.current.children[activeStep] as HTMLElement;
            if (activeElement) {
                activeElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center',
                });
            }
        }
    }, [activeStep]);

    return (
        <div className="w-full">
            {/* Desktop stepper */}
            <div className="hidden md:flex items-center justify-between mb-8">
                {steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                        <button
                            type="button"
                            onClick={() => onStepChange(idx)}
                            className={cn(
                                'flex flex-col items-center gap-2 text-sm font-medium transition-colors',
                                idx <= activeStep ? 'text-primary' : 'text-muted-foreground'
                            )}
                        >
                            <span
                                className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                                    idx < activeStep
                                        ? stepErrors?.[idx]
                                            ? 'border-destructive bg-destructive text-destructive-foreground'
                                            : 'border-primary bg-primary text-primary-foreground'
                                        : idx === activeStep
                                            ? 'border-primary bg-background text-primary'
                                            : 'border-muted-foreground/30 bg-background text-muted-foreground'
                                )}
                            >
                                {idx < activeStep ? (
                                    stepErrors?.[idx] ? (
                                        <XCircle className="h-4 w-4" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )
                                ) : (
                                    idx + 1
                                )}
                            </span>
                            <span className="text-xs">{step.label}</span>
                        </button>
                        {idx < totalSteps - 1 && (
                            <div
                                className={cn(
                                    'h-0.5 flex-1 mx-2 transition-colors',
                                    idx < activeStep ? 'bg-primary' : 'bg-muted-foreground/20'
                                )}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Mobile swipeable stepper */}
            <div
                ref={scrollRef}
                className="md:hidden flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {steps.map((step, idx) => (
                    <button
                        key={step.id}
                        type="button"
                        onClick={() => onStepChange(idx)}
                        className={cn(
                            'snap-center flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[72px]',
                            idx === activeStep
                                ? 'bg-primary/10 text-primary scale-105 shadow-sm'
                                : 'text-muted-foreground hover:bg-muted/50'
                        )}
                    >
                        <span
                            className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                                idx < activeStep
                                    ? stepErrors?.[idx]
                                        ? 'bg-destructive text-destructive-foreground'
                                        : 'bg-primary text-primary-foreground'
                                    : idx === activeStep
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                            )}
                        >
                            {idx < activeStep ? (
                                stepErrors?.[idx] ? (
                                    <XCircle className="h-3.5 w-3.5" />
                                ) : (
                                    <Check className="h-3.5 w-3.5" />
                                )
                            ) : (
                                idx + 1
                            )}
                        </span>
                        <span className="text-[11px] font-medium leading-tight text-center whitespace-nowrap">
                            {step.label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Step Content – all steps mounted, only active visible */}
            <div className="md:rounded-2xl md:border md:bg-card md:overflow-hidden md:shadow-sm">
                {steps.map((step, idx) => (
                    <div
                        key={step.id}
                        style={{ display: idx === activeStep ? 'block' : 'none' }}
                        aria-hidden={idx !== activeStep}
                    >
                        {step.content}
                    </div>
                ))}
            </div>

            {/* Footer */}
            {footer && <div className="mt-6">{footer}</div>}
        </div>
    );
}