import React from 'react';
import { Badge } from '@/components/ui/badge';
import { SectionProps } from './types';
import { Supplier } from '@/types';

interface SupplierSectionProps extends SectionProps {
  suppliers: Supplier[];
  onSupplierNew: () => void;
}

export const SupplierSection = React.memo(({ form, suppliers, onSupplierNew }: SupplierSectionProps) => {
  const selectedSupplierIds = form.watch('supplierIds') ?? [];

  const toggleSupplier = (sid: string) => {
    if (selectedSupplierIds.includes(sid)) {
      form.setValue('supplierIds', selectedSupplierIds.filter(s => s !== sid));
    } else {
      form.setValue('supplierIds', [...selectedSupplierIds, sid]);
    }
  };

  return (
    <section className="px-4 py-4 space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Suppliers</p>
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No suppliers yet.{' '}
          <button
            type="button"
            className="text-primary underline"
            onClick={onSupplierNew}
          >
            Add one
          </button>
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suppliers.map(s => {
            const isSelected = selectedSupplierIds.includes(s.id);
            return (
              <Badge
                key={s.id}
                variant={isSelected ? 'default' : 'outline'}
                className="cursor-pointer text-xs py-1 px-2.5 transition-all select-none active:scale-95"
                onClick={() => toggleSupplier(s.id)}
              >
                {s.name}
              </Badge>
            );
          })}
        </div>
      )}
    </section>
  );
});

SupplierSection.displayName = 'SupplierSection';
