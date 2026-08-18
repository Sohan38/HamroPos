import { describe, expect, it } from 'vitest';
import { ProductionMutationService } from './productionMutationService';

describe('ProductionMutationService duplicate input safety', () => {
    const baseProduct = {
        id: 'prod-1',
        barcode: 'B-001',
        name: 'Flour',
        category: 'Raw Material',
        brand: 'Brand',
        supplierId: 'supplier-1',
        unit: 'kg',
        quantity: 100,
        minimumStock: 0,
        purchaseRate: 5,
        sellingRate: 0,
        profitPerUnit: 0,
        notes: '',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        deletedAt: null,
        version: 1,
    } as any;

    const outputProduct = {
        id: 'prod-output',
        barcode: 'OUT-1',
        name: 'Roti',
        category: 'Finished Goods',
        brand: 'Brand',
        supplierId: 'supplier-1',
        unit: 'pcs',
        quantity: 0,
        minimumStock: 0,
        purchaseRate: 0,
        sellingRate: 0,
        profitPerUnit: 0,
        notes: '',
        productionOutput: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        deletedAt: null,
        version: 1,
    } as any;

    it('allows duplicate rows within available stock and totals the deduction correctly', () => {
        const locationStocks = [{
            id: 'ls-1',
            productId: 'prod-1',
            locationId: 'loc-1',
            quantity: 5,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        }] as any[];

        const result = ProductionMutationService.prepareProduction(
            {
                locationId: 'loc-1',
                inputs: [
                    { productId: 'prod-1', quantity: 2 },
                    { productId: 'prod-1', quantity: 3 },
                ],
                outputs: [{ productId: 'prod-output', quantity: 1 }],
            },
            [baseProduct, outputProduct],
            [],
            locationStocks,
            [],
            [],
        );

        expect(result.transaction.inputItems.reduce((sum, item) => sum + item.quantity, 0)).toBe(5);
        expect(result.transaction.outputItems[0].quantity).toBe(1);
    });

    it('rejects duplicate rows exceeding available stock before persistence', () => {
        const locationStocks = [{
            id: 'ls-1',
            productId: 'prod-1',
            locationId: 'loc-1',
            quantity: 5,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        }] as any[];

        expect(() => ProductionMutationService.prepareProduction(
            {
                locationId: 'loc-1',
                inputs: [
                    { productId: 'prod-1', quantity: 2 },
                    { productId: 'prod-1', quantity: 4 },
                ],
                outputs: [{ productId: 'prod-output', quantity: 1 }],
            },
            [baseProduct, outputProduct],
            [],
            locationStocks,
            [],
            [],
        )).toThrow(/Insufficient stock/i);
    });

    it('keeps duplicate-row validation isolated per location for the same product', () => {
        const locationStocks = [
            {
                id: 'ls-1',
                productId: 'prod-1',
                locationId: 'loc-1',
                quantity: 5,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null,
                version: 1,
            },
            {
                id: 'ls-2',
                productId: 'prod-1',
                locationId: 'loc-2',
                quantity: 20,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null,
                version: 1,
            },
        ] as any[];

        const result = ProductionMutationService.prepareProduction(
            {
                locationId: 'loc-1',
                inputs: [
                    { productId: 'prod-1', quantity: 2 },
                    { productId: 'prod-1', quantity: 3 },
                ],
                outputs: [{ productId: 'prod-output', quantity: 1 }],
            },
            [baseProduct, outputProduct],
            [],
            locationStocks,
            [],
            [],
        );

        expect(result.transaction.inputItems.reduce((sum, item) => sum + item.quantity, 0)).toBe(5);
    });
});
