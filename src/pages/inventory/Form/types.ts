import { UseFormReturn } from 'react-hook-form';
import * as z from 'zod';
import { ProductBatch, Supplier } from '@/types';

export const productSchema = z.object({
  name: z
    .string()
    .min(1, 'Product name is required')
    .min(2, 'Name needs at least 2 characters')
    .max(100, 'Keep the name under 100 characters'),

  barcode: z
    .string()
    .max(50, 'Barcode seems too long — max 50 characters')
    .optional(),

  category: z
    .string()
    .min(1, 'Pick or type a category — helps organise your inventory')
    .max(50, 'Category name is too long'),

  brand: z
    .string()
    .max(50, 'Brand name is too long')
    .optional(),

  supplierIds: z.array(z.string()).optional(),

  supplierStocks: z.array(z.object({
    supplierId: z.string(),
    supplierSku: z.string().optional(),
    cost: z.coerce.number().min(0).default(0),
    stock: z.coerce.number().min(0).default(0),
    reorderLevel: z.coerce.number().min(0).optional(),
    lastPurchaseDate: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),

  unit: z.string().min(1, 'Please select a unit'),

  quantity: z.coerce
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0, 'Stock cannot be negative')
    .max(999999, 'That quantity seems too large'),

  minimumStock: z.coerce
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0, 'Cannot be negative')
    .max(999999, 'That value seems too large'),

  purchaseRate: z.coerce
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0, 'Cannot be negative'),

  sellingRate: z.coerce
    .number({ invalid_type_error: 'Enter a valid number' })
    .min(0.01, 'Selling price must be greater than zero'),

  hasExpiry: z.boolean().optional(),
  hasVariants: z.boolean().optional(),

  variants: z
    .array(
      z.object({
        name: z.string().min(1, 'Give this variant a name (e.g. Red, XL)'),
        quantity: z.coerce.number().min(0, 'Cannot be negative'),
      })
    )
    .optional(),

  notes: z
    .string()
    .max(500, 'Notes are too long — keep it under 500 characters')
    .optional(),

  imageBase64: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export interface SectionProps {
  form: UseFormReturn<ProductFormValues>;
}
