import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useRoute } from 'wouter';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import {
  useProductionRecipes,
  useProductionRecipeItems,
  useInventory,
} from '@/contexts/GlobalProviders';
import { useStorageProvider } from '@/storage/StorageContext';
import { ProductionRecipe, ProductionRecipeItem, ProductUnit } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProductSearchPicker } from '@/components/ProductSearchPicker';

interface RecipeItemForm {
  id: string;
  inputProductId: string;
  quantityPerOutputUnit: string;
  unit: ProductUnit;
}

const PRODUCT_UNITS: ProductUnit[] = [
  'pcs',
  'packet',
  'box',
  'bottle',
  'kg',
  'gram',
  'litre',
  'ml',
  'plate',
  'cup',
  'glass',
  'meter',
  'roll',
  'dozen',
  'custom',
];

const makeItemRow = (): RecipeItemForm => ({
  id: uuidv4(),
  inputProductId: '',
  quantityPerOutputUnit: '1',
  unit: 'pcs',
});

export function RecipeForm() {
  const [, setLocation] = useLocation();
  const [isEdit, , params] = useRoute('/inventory/recipes/:id/edit');
  const isEditMode = isEdit && params?.id;

  const storage = useStorageProvider();
  const { items: recipes, add: addRecipe, update: updateRecipe } = useProductionRecipes();
  const { items: recipeItems, add: addRecipeItem, update: updateRecipeItem, delete: deleteRecipeItem } = useProductionRecipeItems();
  const { items: products } = useInventory();

  const [outputProductId, setOutputProductId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [items, setItems] = useState<RecipeItemForm[]>([makeItemRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editingRecipe = useMemo(() => {
    if (!isEditMode) return null;
    return recipes.find((r) => r.id === params?.id && !r.deletedAt);
  }, [isEditMode, params?.id, recipes]);

  // Load recipe and items if editing
  useEffect(() => {
    if (!editingRecipe) return;

    setOutputProductId(editingRecipe.outputProductId);
    setRecipeName(editingRecipe.name);
    setStatus(editingRecipe.status);

    const recipeItemsForRecipe = recipeItems.filter(
      (ri) => ri.recipeId === editingRecipe.id && !ri.deletedAt,
    );

    if (recipeItemsForRecipe.length > 0) {
      setItems(
        recipeItemsForRecipe.map((ri) => ({
          id: ri.id,
          inputProductId: ri.inputProductId,
          quantityPerOutputUnit: String(ri.quantityPerOutputUnit),
          unit: ri.unit,
        })),
      );
    }
  }, [editingRecipe, recipeItems]);

  const outputProduct = useMemo(
    () => products.find((p) => p.id === outputProductId && !p.deletedAt),
    [outputProductId, products],
  );

  const consumableProducts = useMemo(
    () => products.filter((p) => !p.deletedAt && p.id !== outputProductId),
    [products, outputProductId],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!outputProductId) errors.push('Output product is required.');
    if (!recipeName.trim()) errors.push('Recipe name is required.');
    if (items.length === 0) errors.push('At least one component is required.');

    const inputProductIds = new Set<string>();

    for (const item of items) {
      if (!item.inputProductId) {
        errors.push('Each component must have a product.');
        continue;
      }

      if (inputProductIds.has(item.inputProductId)) {
        errors.push('Duplicate component product.');
        continue;
      }

      inputProductIds.add(item.inputProductId);

      const qty = Number(item.quantityPerOutputUnit || 0);
      if (qty <= 0) {
        const product = products.find((p) => p.id === item.inputProductId);
        errors.push(`${product?.name || 'Component'}: quantity must be greater than 0.`);
      }
    }

    return errors;
  }, [outputProductId, recipeName, items, products]);

  const hasErrors = validationErrors.length > 0;

  const handleAddItem = () => {
    setItems((current) => [...current, makeItemRow()]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((current) => (current.length > 1 ? current.filter((i) => i.id !== itemId) : current));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<RecipeItemForm>) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    );
  };

  const handleSubmit = async () => {
    if (hasErrors) {
      toast.error('Please fix validation errors before saving.');
      return;
    }

    setIsSubmitting(true);

    try {
      let recipe: ProductionRecipe;

      if (isEditMode && editingRecipe) {
        // Update existing recipe
        recipe = {
          ...editingRecipe,
          outputProductId,
          name: recipeName.trim(),
          status,
          updatedAt: new Date().toISOString(),
          version: (editingRecipe.version ?? 0) + 1,
        };
        await updateRecipe(recipe);

        // Delete old recipe items and create new ones
        const oldItems = recipeItems.filter((ri) => ri.recipeId === editingRecipe.id && !ri.deletedAt);
        for (const oldItem of oldItems) {
          await deleteRecipeItem(oldItem.id);
        }

        // Add new items
        for (const formItem of items) {
          const now = new Date().toISOString();
          const newItem: ProductionRecipeItem = {
            id: formItem.id,
            recipeId: recipe.id,
            inputProductId: formItem.inputProductId,
            quantityPerOutputUnit: Number(formItem.quantityPerOutputUnit),
            unit: formItem.unit,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            version: 1,
          };
          await addRecipeItem(newItem);
        }

        toast.success(`Recipe "${recipe.name}" updated.`);
      } else {
        // Create new recipe
        const now = new Date().toISOString();
        recipe = {
          id: uuidv4(),
          outputProductId,
          name: recipeName.trim(),
          status,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          version: 1,
        };
        await addRecipe(recipe);

        // Add recipe items
        for (const formItem of items) {
          const newItem: ProductionRecipeItem = {
            id: formItem.id,
            recipeId: recipe.id,
            inputProductId: formItem.inputProductId,
            quantityPerOutputUnit: Number(formItem.quantityPerOutputUnit),
            unit: formItem.unit,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            version: 1,
          };
          await addRecipeItem(newItem);
        }

        toast.success(`Recipe "${recipe.name}" created.`);
      }

      setLocation('/inventory/recipes');
    } catch (error) {
      console.error('Submit failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save recipe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 pb-28 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setLocation('/inventory/recipes')}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Recipe</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditMode ? 'Edit Recipe' : 'Create Recipe'}
            </h1>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipe Details</CardTitle>
          <CardDescription>Define the bill of materials for production.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Output Product */}
          <div className="space-y-2">
            <Label htmlFor="output">Output Product</Label>
            <div className="flex gap-2">
              <ProductSearchPicker
                label="Select finished product"
                items={products
                  .filter((p) => !p.deletedAt && p.productionOutput)
                  .map((p) => ({
                    id: p.id,
                    name: p.name,
                    barcode: p.barcode,
                    category: p.category,
                    sublabel: p.category || 'Product',
                  }))}
                onSelect={setOutputProductId}
                emptyMessage="No products configured for production output."
              />
            </div>
            {outputProduct && (
              <p className="text-sm text-muted-foreground">Selected: {outputProduct.name}</p>
            )}
          </div>

          {/* Recipe Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Recipe Name</Label>
            <Input
              id="name"
              placeholder="e.g., Standard Cotton Shirt"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as 'active' | 'inactive')}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only one active recipe per product. Deactivate old recipes before creating new ones.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Components */}
      <Card>
        <CardHeader>
          <CardTitle>Components (Bill of Materials)</CardTitle>
          <CardDescription>Define raw materials needed per unit of output.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => {
            const inputProduct = products.find((p) => p.id === item.inputProductId && !p.deletedAt);
            return (
              <div key={item.id} className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Component {index + 1}</p>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* Product Selection */}
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <ProductSearchPicker
                      label="Select raw material"
                      items={consumableProducts.map((p) => ({
                        id: p.id,
                        name: p.name,
                        barcode: p.barcode,
                        category: p.category,
                        sublabel: p.category || 'Product',
                      }))}
                      onSelect={(productId) => handleUpdateItem(item.id, { inputProductId: productId })}
                      emptyMessage="No products available."
                    />
                    {inputProduct && (
                      <p className="text-xs text-muted-foreground">Unit: {inputProduct.unit}</p>
                    )}
                  </div>

                  {/* Quantity and Unit */}
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor={`qty-${item.id}`}>Quantity per Output Unit</Label>
                      <Input
                        id={`qty-${item.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1.5"
                        value={item.quantityPerOutputUnit}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { quantityPerOutputUnit: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`unit-${item.id}`}>Unit</Label>
                      <Select value={item.unit} onValueChange={(u) => handleUpdateItem(item.id, { unit: u as ProductUnit })}>
                        <SelectTrigger id={`unit-${item.id}`} className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" onClick={handleAddItem} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Component
          </Button>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="space-y-2 pt-6">
            {validationErrors.map((error, idx) => (
              <p key={idx} className="text-sm text-destructive">
                • {error}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setLocation('/inventory/recipes')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || hasErrors}>
          {isSubmitting ? 'Saving...' : isEditMode ? 'Update Recipe' : 'Create Recipe'}
        </Button>
      </div>
    </div>
  );
}
