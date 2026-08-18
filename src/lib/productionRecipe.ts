import { Product, ProductionRecipe, ProductionRecipeItem } from '@/types';

export interface ExpectedProductionIngredient {
    recipeId: string;
    recipeName: string;
    inputProductId: string;
    quantity: number;
    unit: ProductionRecipeItem['unit'];
}

export interface ProductionVarianceRow {
    recipeId: string;
    recipeName: string;
    inputProductId: string;
    productName: string;
    expectedQuantity: number;
    actualQuantity: number;
    variance: number | null;
    unit: ProductionRecipeItem['unit'];
    compatible: boolean;
}

export function getActiveRecipesForOutputProduct(
    outputProductId: string,
    recipes: ProductionRecipe[] = []
): ProductionRecipe[] {
    if (!outputProductId) return [];

    return recipes.filter((recipe) => {
        if (recipe.deletedAt) return false;
        if (recipe.outputProductId !== outputProductId) return false;
        return recipe.status === 'active';
    });
}

export function getActiveRecipeForOutputProduct(
    outputProductId: string,
    recipes: ProductionRecipe[] = []
): ProductionRecipe | undefined {
    return getActiveRecipesForOutputProduct(outputProductId, recipes)[0];
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

export function getProductionVarianceRows(
    expectedIngredients: ExpectedProductionIngredient[] = [],
    actualRows: Array<{ productId: string; quantity: number | string }> = [],
    products: Array<Pick<Product, 'id' | 'name' | 'unit'>> = []
): ProductionVarianceRow[] {
    return expectedIngredients.map((ingredient) => {
        const product = products.find((candidate) => candidate.id === ingredient.inputProductId);
        const actualQuantity = actualRows
            .filter((row) => row.productId === ingredient.inputProductId)
            .reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        const compatible = product ? product.unit === ingredient.unit : true;
        const variance = compatible
            ? Number((actualQuantity - ingredient.quantity).toFixed(6))
            : null;

        return {
            recipeId: ingredient.recipeId,
            recipeName: ingredient.recipeName,
            inputProductId: ingredient.inputProductId,
            productName: product?.name ?? ingredient.inputProductId,
            expectedQuantity: Number(ingredient.quantity || 0),
            actualQuantity: Number(actualQuantity || 0),
            variance,
            unit: ingredient.unit,
            compatible,
        };
    });
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
