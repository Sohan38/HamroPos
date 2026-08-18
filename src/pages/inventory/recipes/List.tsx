import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useProductionRecipes, useInventory } from '@/contexts/GlobalProviders';
import { useStorageProvider } from '@/storage/StorageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function RecipeList() {
  const [, setLocation] = useLocation();
  const { items: recipes, update: updateRecipe, delete: deleteRecipe } = useProductionRecipes();
  const { items: products } = useInventory();
  const storage = useStorageProvider();
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);

  const activeRecipes = useMemo(
    () => recipes.filter((r) => !r.deletedAt),
    [recipes],
  );

  const recipeRows = useMemo(
    () =>
      activeRecipes.map((recipe) => {
        const product = products.find((p) => p.id === recipe.outputProductId && !p.deletedAt);
        return {
          recipe,
          outputProduct: product,
        };
      }),
    [activeRecipes, products],
  );

  const handleDelete = async (recipeId: string) => {
    try {
      await deleteRecipe(recipeId);
      toast.success('Recipe deleted.');
      setDeletingRecipeId(null);
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete recipe.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-28 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setLocation('/inventory')}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Recipes</p>
            <h1 className="text-2xl font-bold tracking-tight">Production Recipes</h1>
          </div>
        </div>
        <Button onClick={() => setLocation('/inventory/recipes/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          New Recipe
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Recipes</CardTitle>
          <CardDescription>Manage production recipes and bill of materials.</CardDescription>
        </CardHeader>
        <CardContent>
          {recipeRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <p className="text-sm text-muted-foreground">No recipes yet.</p>
              <Button onClick={() => setLocation('/inventory/recipes/new')} variant="outline">
                Create your first recipe
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipe Name</TableHead>
                    <TableHead>Output Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipeRows.map(({ recipe, outputProduct }) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-medium">{recipe.name}</TableCell>
                      <TableCell>
                        {outputProduct ? (
                          <span>{outputProduct.name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            (deleted product)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={recipe.status === 'active' ? 'default' : 'secondary'}>
                          {recipe.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(`/inventory/recipes/${recipe.id}`)}
                            title="View recipe details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(`/inventory/recipes/${recipe.id}/edit`)}
                            title="Edit recipe"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingRecipeId(recipe.id)}
                            title="Delete recipe"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingRecipeId} onOpenChange={(open) => !open && setDeletingRecipeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The recipe will be deleted but past production transactions
              will retain their recipe history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRecipeId && handleDelete(deletingRecipeId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
