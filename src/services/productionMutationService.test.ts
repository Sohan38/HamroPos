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

    // ────────────────────────────────────────────────────────────────────────
    // HIGH-VALUE REGRESSION TESTS
    // ────────────────────────────────────────────────────────────────────────

    it('allocates cost consistently across multiple output rows with sum equaling total input cost', () => {
        // This test verifies the multi-output cost allocation bug fix.
        // With totalInputCost = 100 and two outputs (5, 3 units),
        // each should get the same unit cost: 100 / (5+3) = 12.5
        // Output A: 5 * 12.5 = 62.5
        // Output B: 3 * 12.5 = 37.5
        // Sum: 100 ✓

        const outputProd2 = {
            id: 'prod-output-2',
            barcode: 'OUT-2',
            name: 'Bread',
            category: 'Finished Goods',
            brand: 'Brand',
            supplierId: 'supplier-1',
            unit: 'kg',
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

        const locationStocks = [{
            id: 'ls-1',
            productId: 'prod-1',
            locationId: 'loc-1',
            quantity: 20,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        }] as any[];

        const result = ProductionMutationService.prepareProduction(
            {
                locationId: 'loc-1',
                inputs: [{ productId: 'prod-1', quantity: 10 }],
                outputs: [
                    { productId: 'prod-output', quantity: 5 },
                    { productId: 'prod-output-2', quantity: 3 },
                ],
            },
            [baseProduct, outputProduct, outputProd2],
            [],
            locationStocks,
            [],
            [],
        );

        const outputA = result.transaction.outputItems[0];
        const outputB = result.transaction.outputItems[1];

        // Each should have the same unit cost
        expect(outputA.unitCost).toBe(outputB.unitCost);

        // Verify unit cost is correct: 100 (input cost) / 8 (total output) = 12.5
        // Note: baseProduct.purchaseRate = 5, input quantity = 10, so totalInputCost = 50
        // Not 100 as in example. Let me recalculate: 5 * 10 = 50, so unitCost = 50 / 8 = 6.25
        const expectedUnitCost = 50 / 8;
        expect(outputA.unitCost).toBeCloseTo(expectedUnitCost, 5);
        expect(outputB.unitCost).toBeCloseTo(expectedUnitCost, 5);

        // Verify individual costs
        const expectedCostA = 5 * expectedUnitCost;
        const expectedCostB = 3 * expectedUnitCost;
        expect(outputA.totalCost).toBeCloseTo(expectedCostA, 5);
        expect(outputB.totalCost).toBeCloseTo(expectedCostB, 5);

        // Verify sum of output costs equals total input cost
        const sumOutputCost = outputA.totalCost + outputB.totalCost;
        expect(sumOutputCost).toBeCloseTo(50, 5);
        expect(result.transaction.totalInputCost).toBe(50);
        expect(result.transaction.totalOutputCost).toBe(50);
    });

    it('correctly allocates multiple batches via FEFO with accurate batch and location stock updates', () => {
        // This test verifies multi-batch FEFO allocation.
        // Create batches with different expiry dates; verify FEFO ordering and allocation.

        const batchA = {
            id: 'batch-1',
            productId: 'prod-1',
            supplierId: 'supplier-1',
            batchNumber: 'B-001',
            manufacturingDate: '2024-01-01',
            expiryMonths: 1,
            expiryDate: '2024-02-01',
            initialQuantity: 5,
            quantity: 5,
            purchaseRate: 5,
            notes: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        } as any;

        const batchB = {
            id: 'batch-2',
            productId: 'prod-1',
            supplierId: 'supplier-1',
            batchNumber: 'B-002',
            manufacturingDate: '2024-01-05',
            expiryMonths: 1,
            expiryDate: '2024-02-05',
            initialQuantity: 5,
            quantity: 5,
            purchaseRate: 5,
            notes: '',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        } as any;

        const batchLocA = {
            id: 'bl-1',
            batchId: 'batch-1',
            locationId: 'loc-1',
            quantity: 5,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        } as any;

        const batchLocB = {
            id: 'bl-2',
            batchId: 'batch-2',
            locationId: 'loc-1',
            quantity: 5,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        } as any;

        const inputProduct = {
            ...baseProduct,
            hasExpiry: true,
        };

        // Provide location stock for the input product at the production location
        const locationStocks = [{
            id: 'ls-1',
            productId: 'prod-1',
            locationId: 'loc-1',
            quantity: 10, // Enough for the 7 unit input
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        }] as any[];

        const result = ProductionMutationService.prepareProduction(
            {
                locationId: 'loc-1',
                inputs: [{ productId: 'prod-1', quantity: 7 }], // Consume 7, needs both batches (5 + 2)
                outputs: [{ productId: 'prod-output', quantity: 7 }],
            },
            [inputProduct, outputProduct],
            [batchA, batchB],
            locationStocks,
            [batchLocA, batchLocB],
            [],
        );

        // Verify 2 input items (one per batch) due to multi-batch FEFO allocation
        expect(result.transaction.inputItems.length).toBe(2);
        expect(result.transaction.inputItems[0].quantity).toBe(5);
        expect(result.transaction.inputItems[0].batchId).toBe('batch-1'); // Earliest expiry first
        expect(result.transaction.inputItems[1].quantity).toBe(2);
        expect(result.transaction.inputItems[1].batchId).toBe('batch-2');

        // Verify batch updates
        const batchAUpdate = result.batchUpdates.get('batch-1');
        const batchBUpdate = result.batchUpdates.get('batch-2');
        expect(batchAUpdate?.quantity).toBe(0); // 5 - 5 = 0
        expect(batchBUpdate?.quantity).toBe(3); // 5 - 2 = 3

        // Verify batch location updates
        const batchLocAUpdate = result.batchLocationUpdates.get('bl-1');
        const batchLocBUpdate = result.batchLocationUpdates.get('bl-2');
        expect(batchLocAUpdate?.quantity).toBe(0);
        expect(batchLocBUpdate?.quantity).toBe(3);

        // Verify total input cost
        const expectedCost = 7 * 5; // 7 quantity * purchaseRate 5 = 35
        expect(result.transaction.totalInputCost).toBe(expectedCost);
    });

    it('correctly combines input and output updates when the same product is consumed and produced', () => {
        // This test verifies that a product used as both input and output
        // has its stock correctly updated (not one overwriting the other).
        // Starting: 10, Consume: 5, Produce: 3, Expected: 8

        const sameProduct = {
            ...baseProduct,
            id: 'prod-dual',
            name: 'Rice',
            quantity: 10, // Starting quantity
            productionOutput: true, // Can be produced
        };

        const locationStocks = [{
            id: 'ls-1',
            productId: 'prod-dual',
            locationId: 'loc-1',
            quantity: 10,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            deletedAt: null,
            version: 1,
        }] as any[];

        const result = ProductionMutationService.prepareProduction(
            {
                locationId: 'loc-1',
                inputs: [{ productId: 'prod-dual', quantity: 5 }],
                outputs: [{ productId: 'prod-dual', quantity: 3 }],
            },
            [sameProduct, outputProduct],
            [],
            locationStocks,
            [],
            [],
        );

        // Verify product update combines both operations
        const productUpdate = result.productUpdates.get('prod-dual');
        expect(productUpdate?.quantity).toBe(8); // 10 - 5 + 3 = 8

        // Verify location stock update
        const locStockUpdate = result.stockUpdates.get('ls-1');
        expect(locStockUpdate?.quantity).toBe(8);

        // Verify input and output items are both present
        expect(result.transaction.inputItems.length).toBe(1);
        expect(result.transaction.inputItems[0].quantity).toBe(5);
        expect(result.transaction.outputItems.length).toBe(1);
        expect(result.transaction.outputItems[0].quantity).toBe(3);
    });

    it('creates new location stock record when output is produced at a location with no existing location stock', () => {
        // This test verifies that when a production output is created at a new location,
        // a location stock record is properly created without colliding with other records.

        const outputProduct2 = {
            id: 'prod-new-loc',
            barcode: 'NEW-LOC',
            name: 'Processed Item',
            category: 'Output',
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

        // Location stocks exists for location-1 with prod-1, but NOT for prod-new-loc
        const locationStocks = [
            {
                id: 'ls-1',
                productId: 'prod-1',
                locationId: 'loc-1',
                quantity: 10,
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null,
                version: 1,
            },
            {
                id: 'ls-2',
                productId: 'prod-1',
                locationId: 'loc-2',
                quantity: 10, // Provide stock for input at loc-2
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                deletedAt: null,
                version: 1,
            },
        ] as any[];

        const result = ProductionMutationService.prepareProduction(
            {
                locationId: 'loc-2', // Different location, no existing stock record
                inputs: [{ productId: 'prod-1', quantity: 5 }],
                outputs: [{ productId: 'prod-new-loc', quantity: 4 }],
            },
            [baseProduct, outputProduct2],
            [],
            locationStocks,
            [],
            [],
        );

        // Verify NEW:: location stock record was created for the output product
        const newLocStockKey = `NEW::prod-new-loc::loc-2`;
        const newLocStock = result.stockUpdates.get(newLocStockKey);
        expect(newLocStock).toBeDefined();
        expect(newLocStock?.productId).toBe('prod-new-loc');
        expect(newLocStock?.locationId).toBe('loc-2');
        expect(newLocStock?.quantity).toBe(4);

        // Verify the input location stock for prod-1 at loc-2 was decremented
        const inputLocStockUpdate = result.stockUpdates.get('ls-2');
        expect(inputLocStockUpdate).toBeDefined();
        expect(inputLocStockUpdate?.quantity).toBe(5); // 10 - 5 = 5

        // Verify it doesn't interfere with the loc-1 stock
        const loc1StockUpdate = result.stockUpdates.get('ls-1');
        expect(loc1StockUpdate).toBeUndefined(); // Not touched
    });
});

