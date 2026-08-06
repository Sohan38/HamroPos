import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { SectionProps } from './types';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';

export const NotesSection = React.memo(({ form }: SectionProps) => {
  const notes     = useWatch({ control: form.control, name: 'notes' }) ?? '';
  const notesError = form.formState.errors.notes?.message;
  const nearLimit = notes.length > 450;
  const atLimit   = notes.length > 490;

  return (
    <section className="px-4 py-4 space-y-3">
      <FormField control={form.control} name="notes" render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between mb-1">
            <FormLabel className="mb-0 text-sm font-semibold">
              Notes{' '}
              <span className="text-muted-foreground font-normal text-[10px]">(optional)</span>
            </FormLabel>
            <span className={cn(
              'text-[10px] tabular-nums transition-colors',
              atLimit ? 'text-destructive font-semibold' : nearLimit ? 'text-amber-500' : 'text-muted-foreground'
            )}>
              {notes.length}/500
            </span>
          </div>
          <FormControl>
            <Textarea
              placeholder="Storage instructions, specifications, or internal notes..."
              className={cn(
                'resize-none min-h-[88px] text-sm transition-colors rounded-2xl',
                notesError && 'border-destructive focus-visible:ring-destructive/30'
              )}
              {...field}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )} />
    </section>
  );
});

NotesSection.displayName = 'NotesSection';
