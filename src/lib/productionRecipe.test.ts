import { describe, expect, it } from 'vitest';
import { getProductionVarianceRows } from './productionRecipe';

describe('getProductionVarianceRows', () => {
    it('calculates variance for matching units', () => {
        const expected = [
            {
                recipeId: 'recipe-1',
                recipeName: 'Standard Roti',
                inputProductId: 'flour',
                quantity: 10,
                unit: 'kg',
            },
        ];

        const actualRows = [
            { productId: 'flour', quantity: '9.7' },
            { productId: 'flour', quantity: '0.3' },
        ];

        const products = [{ id: 'flour', name: 'Flour', unit: 'kg' }];

        expect(getProductionVarianceRows(expected, actualRows as any, products as any)).toEqual([
            {
                recipeId: 'recipe-1',
                recipeName: 'Standard Roti',
                inputProductId: 'flour',
                productName: 'Flour',
                expectedQuantity: 10,
                actualQuantity: 10,
                variance: 0,
                unit: 'kg',
                compatible: true,
            },
        ]);
    });

    it('skips variance when units are incompatible', () => {
        const expected = [
            {
                recipeId: 'recipe-1',
                recipeName: 'Standard Roti',
                inputProductId: 'flour',
                quantity: 10,
                unit: 'kg',
            },
        ];

        const actualRows = [{ productId: 'flour', quantity: '1000' }];
        const products = [{ id: 'flour', name: 'Flour', unit: 'gram' }];

        expect(getProductionVarianceRows(expected, actualRows as any, products as any)).toEqual([
            {
                recipeId: 'recipe-1',
                recipeName: 'Standard Roti',
                inputProductId: 'flour',
                productName: 'Flour',
                expectedQuantity: 10,
                actualQuantity: 1000,
                variance: null,
                unit: 'kg',
                compatible: false,
            },
        ]);
    });
});
