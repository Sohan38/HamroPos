import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { SectionProps } from './types';
import { useWatch } from 'react-hook-form';
import { cn } from '@/lib/utils';

export const NotesSection = React.memo(({ form }: SectionProps) => {
  const notes = useWatch({ control: form.control, name: 'notes' }) ?? '';
  const notesError = form.formState.errors.notes?.message;

  return (
    <section className="px-4 py-4 space-y-3">
      <FormField control={form.control} name="notes" render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between mb-1.5">
            <FormLabel className="mb-0">
              Notes / Description{' '}
              <span className="text-muted-foreground font-normal text-[10px]">(optional)</span>
            </FormLabel>
            <span className={cn(
              'text-[10px] tabular-nums transition-colors',
              notes.length > 450 ? 'text-amber-500' : 'text-muted-foreground',
              notes.length > 490 ? 'text-destructive' : ''
            )}>
              {notes.length}/500
            </span>
          </div>
          <FormControl>
            <Textarea
              placeholder="Add product specifications, storage instructions, or internal notes..."
              className={cn(
                'resize-none min-h-[80px] transition-all',
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
