import { ProductionRecipe, ProductionRecipeItem } from '@/types';

export interface ExpectedProductionIngredient {
    recipeId: string;
    recipeName: string;
    inputProductId: string;
    quantity: number;
    unit: ProductionRecipeItem['unit'];
}

export function getActiveRecipeForOutputProduct(
    outputProductId: string,
    recipes: ProductionRecipe[] = []
): ProductionRecipe | undefined {
    if (!outputProductId) return undefined;

    return recipes.find((recipe) => {
        if (recipe.deletedAt) return false;
        if (recipe.outputProductId !== outputProductId) return false;
        return recipe.status === 'active';
    });
}

export function getExpectedProductionIngredients(
    recipe: ProductionRecipe | null | undefined,
    recipeItems: ProductionRecipeItem[] = [],
    productionOutputQuantity: number
): ExpectedProductionIngredient[] {
    if (!recipe) return [];

    const quantity = Number(productionOutputQuantity || 0);
    if (quantity <= 0) return [];

    return recipeItems
        .filter((item) => !item.deletedAt && item.recipeId === recipe.id)
        .map((item) => ({
            recipeId: recipe.id,
            recipeName: recipe.name,
            inputProductId: item.inputProductId,
            quantity: Number(item.quantityPerOutputUnit || 0) * quantity,
            unit: item.unit,
        }));
}

export function getSelectedProductionRecipe(
    outputRows: Array<{ productId: string }>,
    recipes: ProductionRecipe[] = []
): ProductionRecipe | null {
    for (const row of outputRows) {
        const recipe = getActiveRecipeForOutputProduct(row.productId, recipes);
        if (recipe) {
            return recipe;
        }
    }

    return null;
}
