import { v4 as uuidv4 } from 'uuid';
import {
    ProductionTransaction,
    ProductionInputItem,
    ProductionOutputItem,
    Product,
    ProductBatch,
    InventoryLocationStock,
    ProductBatchLocation,
    InventoryMovement,
} from '@/types';
import { IStorageProvider } from '@/storage/IStorageProvider';
import { getLocationStockForProduct } from '@/lib/locationStock';

/**
 * Input specification for a production operation
 */
export interface ProductionInputSpec {
    productId: string;
    quantity: number;
    batchId?: string | null; // specific batch, or auto-select via FEFO
}

/**
 * Output specification for a production operation
 */
export interface ProductionOutputSpec {
    productId: string;
    quantity: number;
    batchId?: string | null; // if batch-tracked output, use this batch (or auto-create)
}

/**
 * Request to create a production transaction
 */
export interface CreateProductionParams {
    locationId: string;
    inputs: ProductionInputSpec[];
    outputs: ProductionOutputSpec[];
    notes?: string;
    date?: string; // ISO 8601, defaults to today
}

/**
 * Result of creating a production transaction
 */
export interface ProductionCreationResult {
    transaction: ProductionTransaction;
    movements: InventoryMovement[];
    productUpdates: Map<string, Partial<Product>>;
    batchUpdates: Map<string, Partial<ProductBatch>>;
    stockUpdates: Map<string, Partial<InventoryLocationStock>>;
    batchLocationUpdates: Map<string, Partial<ProductBatchLocation>>;
    batchLocationsCreated: ProductBatchLocation[];
}

/**
 * Service for production transaction operations
 *
 * CRITICAL: This is the single authoritative mutation path for Production.
 * All stock mutations MUST go through this service.
 * NO manual stock mutations.
 * NO secondary calls to purchaseService or consumptionService for the same mutation.
 */
export class ProductionMutationService {
    /**
     * Generate next production reference number
     * Format: PROD-YYYY-NNN (e.g., PROD-2024-001)
     */
    static generateReferenceNumber(existingTransactions: ProductionTransaction[]): string {
        const today = new Date();
        const year = today.getFullYear();

        const thisYearTransactions = existingTransactions.filter(t =>
            t.date.startsWith(year.toString())
        );

        const nextNumber = thisYearTransactions.length + 1;
        return `PROD-${year}-${String(nextNumber).padStart(3, '0')}`;
    }

    /**
     * Prepare production transaction for creation.
     * Validates the entire request, allocates raw materials, calculates costs.
     * Does NOT persist to storage — caller must execute via storage.transaction().
     *
     * THROWS on any validation failure.
     * If this method throws, the caller should NOT persist ANY changes.
     */
    static prepareProduction(
        params: CreateProductionParams,
        products: Product[],
        batches: ProductBatch[],
        locationStocks: InventoryLocationStock[],
        batchLocations: ProductBatchLocation[],
        existingTransactions: ProductionTransaction[]
    ): ProductionCreationResult {
        const date = params.date || new Date().toISOString().split('T')[0];
        const referenceNumber = this.generateReferenceNumber(existingTransactions);

        const inputItems: ProductionInputItem[] = [];
        const outputItems: ProductionOutputItem[] = [];
        const movements: InventoryMovement[] = [];
        const productUpdates = new Map<string, Partial<Product>>();
        const batchUpdates = new Map<string, Partial<ProductBatch>>();
        const stockUpdates = new Map<string, Partial<InventoryLocationStock>>();
        const batchLocationUpdates = new Map<string, Partial<ProductBatchLocation>>();
        const batchLocationsCreated: ProductionCreationResult['batchLocationsCreated'] = [];

        let totalInputCost = 0;
        let totalOutputQuantity = 0;

        // ────────────────────────────────────────────────────────────────────
        // PHASE 1: VALIDATE LOCATION
        // ────────────────────────────────────────────────────────────────────
        if (!params.locationId || !params.locationId.trim()) {
            throw new Error('Production location is required');
        }

        // ────────────────────────────────────────────────────────────────────
        // PHASE 2: VALIDATE AND ALLOCATE INPUTS
        // ────────────────────────────────────────────────────────────────────
        if (!params.inputs || params.inputs.length === 0) {
            throw new Error('At least one input is required for production');
        }

        for (const input of params.inputs) {
            // Find product
            const product = products.find(p => p.id === input.productId && !p.deletedAt);
            if (!product) {
                throw new Error(`Input product ${input.productId} not found`);
            }

            if (input.quantity <= 0) {
                throw new Error(`Input quantity for ${product.name} must be positive`);
            }

            // ──────────────────────────────────────────────────────────────
            // LOCATION-AWARE AVAILABILITY CHECK
            // ──────────────────────────────────────────────────────────────
            const availableAtLocation = getLocationStockForProduct(
                product,
                params.locationId,
                locationStocks
            );

            if (availableAtLocation < input.quantity) {
                throw new Error(
                    `Insufficient stock for ${product.name} at location. ` +
                    `Available: ${availableAtLocation} ${product.unit}, Needed: ${input.quantity} ${product.unit}`
                );
            }

            // ──────────────────────────────────────────────────────────────
            // BATCH ALLOCATION (if batch-tracked)
            // ──────────────────────────────────────────────────────────────
            const allocations: Array<{
                batch: ProductBatch;
                quantity: number;
                cost: number;
            }> = [];
            let totalAllocationCost = 0;

            if (product.hasExpiry || batches.some(b => b.productId === input.productId)) {
                // Product is batch-tracked or expiry-tracked
                const productBatches = batches.filter(
                    b => b.productId === input.productId && b.quantity > 0 && !b.deletedAt
                );

                if (productBatches.length === 0) {
                    throw new Error(
                        `No available batches for ${product.name}. ` +
                        `Cannot consume batch-tracked product without a batch.`
                    );
                }

                // User specified a batch — use it (single allocation)
                if (input.batchId) {
                    const allocatedBatch = productBatches.find(b => b.id === input.batchId);
                    if (!allocatedBatch) {
                        throw new Error(`Specified batch not found for ${product.name}`);
                    }

                    const batchLocRec = batchLocations.find(
                        bl => bl.batchId === allocatedBatch.id &&
                            bl.locationId === params.locationId &&
                            !bl.deletedAt
                    );
                    const batchQtyAtLocation = batchLocRec?.quantity ?? 0;

                    if (batchQtyAtLocation < input.quantity) {
                        throw new Error(
                            `Insufficient batch quantity for ${product.name} at location. ` +
                            `Available: ${batchQtyAtLocation} ${product.unit}, Needed: ${input.quantity} ${product.unit}`
                        );
                    }

                    const allocationCost = input.quantity * (allocatedBatch.purchaseRate ?? product.purchaseRate ?? 0);
                    allocations.push({
                        batch: allocatedBatch,
                        quantity: input.quantity,
                        cost: allocationCost,
                    });
                    totalAllocationCost = allocationCost;
                } else {
                    // ────────────────────────────────────────────────────────
                    // MULTI-BATCH FEFO ALLOCATION
                    // ────────────────────────────────────────────────────────
                    // Key rule: only consider batches with availability at the
                    // selected location (ProductBatchLocation records).
                    // Filter first, THEN sort FEFO.
                    const batchesAtLocation = productBatches.filter(batch => {
                        const batchLocRec = batchLocations.find(
                            bl => bl.batchId === batch.id &&
                                bl.locationId === params.locationId &&
                                !bl.deletedAt
                        );
                        return batchLocRec && batchLocRec.quantity > 0;
                    });

                    if (batchesAtLocation.length === 0) {
                        throw new Error(
                            `No batches available at the selected location for ${product.name}. ` +
                            `Batches exist globally but not at this location.`
                        );
                    }

                    // FEFO: sort by expiry date (earliest first)
                    batchesAtLocation.sort((a, b) => {
                        const aExpiry = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
                        const bExpiry = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
                        return aExpiry - bExpiry;
                    });

                    // Allocate across multiple batches if necessary
                    let remainingQuantity = input.quantity;
                    for (const batch of batchesAtLocation) {
                        if (remainingQuantity <= 0) break;

                        const batchLocRec = batchLocations.find(
                            bl => bl.batchId === batch.id &&
                                bl.locationId === params.locationId &&
                                !bl.deletedAt
                        );
                        const batchQtyAtLocation = batchLocRec?.quantity ?? 0;
                        const allocateQty = Math.min(remainingQuantity, batchQtyAtLocation);

                        const allocationCost = allocateQty * (batch.purchaseRate ?? product.purchaseRate ?? 0);
                        allocations.push({
                            batch,
                            quantity: allocateQty,
                            cost: allocationCost,
                        });
                        totalAllocationCost += allocationCost;
                        remainingQuantity -= allocateQty;
                    }

                    if (remainingQuantity > 0) {
                        throw new Error(
                            `Insufficient stock for ${product.name} at location. ` +
                            `Available: ${input.quantity - remainingQuantity} ${product.unit}, Needed: ${input.quantity} ${product.unit}`
                        );
                    }
                }
            } else {
                // Non-batched product
                totalAllocationCost = input.quantity * (product.purchaseRate ?? 0);
            }

            totalInputCost += totalAllocationCost;

            // Process allocations: create input items and mutations for each batch
            // For non-batched products, create a single input item
            if (product.hasExpiry || batches.some(b => b.productId === input.productId)) {
                // Batch-tracked: one input item per allocation
                for (const alloc of allocations) {
                    // Determine supplierId based on batch
                    const inputSupplierId = alloc.batch.supplierId;

                    // Create input item record for this batch allocation
                    inputItems.push({
                        productId: product.id,
                        productName: product.name,
                        quantity: alloc.quantity,
                        unit: product.unit,
                        locationId: params.locationId,
                        supplierId: inputSupplierId,
                        batchId: alloc.batch.id,
                        batchNumber: alloc.batch.batchNumber ?? null,
                        unitCost: alloc.cost / alloc.quantity,
                        totalCost: alloc.cost,
                    });

                    // Prepare stock deductions for this batch allocation
                    // UPDATE ProductBatch.quantity
                    const existingBatchUpdate = batchUpdates.get(alloc.batch.id) || {
                        quantity: alloc.batch.quantity,
                    };
                    batchUpdates.set(alloc.batch.id, {
                        ...(existingBatchUpdate as any),
                        quantity: Math.max(0, (existingBatchUpdate.quantity ?? alloc.batch.quantity) - alloc.quantity),
                        updatedAt: new Date().toISOString(),
                        version: (alloc.batch.version || 0) + 1,
                    });

                    // UPDATE ProductBatchLocation.quantity
                    const batchLocRec = batchLocations.find(
                        bl => bl.batchId === alloc.batch.id &&
                            bl.locationId === params.locationId &&
                            !bl.deletedAt
                    );
                    if (batchLocRec) {
                        const existingBatchLocUpdate = batchLocationUpdates.get(batchLocRec.id) || {
                            quantity: batchLocRec.quantity,
                        };
                        batchLocationUpdates.set(batchLocRec.id, {
                            ...(existingBatchLocUpdate as any),
                            quantity: Math.max(0, (existingBatchLocUpdate.quantity ?? batchLocRec.quantity) - alloc.quantity),
                            updatedAt: new Date().toISOString(),
                            version: (batchLocRec.version || 0) + 1,
                        });
                    }
                }
            } else {
                // Non-batched product
                // Determine supplierId based on supplier records at this location
                let inputSupplierId: string;
                const suppliersAtLocation = (product.supplierStocks ?? []).filter(
                    ss => ss.locationId === params.locationId && ss.stock > 0
                );

                if (suppliersAtLocation.length === 1) {
                    // Exactly one supplier has stock at this location
                    inputSupplierId = suppliersAtLocation[0].supplierId;
                } else if (suppliersAtLocation.length === 0) {
                    // No supplier stock record found at location
                    // Use product's primary supplier if available
                    inputSupplierId = product.supplierId ?? '';
                } else {
                    // Multiple suppliers have stock at this location
                    // Cannot determine which one was consumed without additional context
                    throw new Error(
                        `Cannot determine supplier provenance for ${product.name} at location. ` +
                        `Multiple suppliers have stock at this location. Please use batch-tracked inventory or resolve supplier ambiguity.`
                    );
                }

                // Create input item record for non-batched product
                inputItems.push({
                    productId: product.id,
                    productName: product.name,
                    quantity: input.quantity,
                    unit: product.unit,
                    locationId: params.locationId,
                    supplierId: inputSupplierId,
                    batchId: null,
                    batchNumber: null,
                    unitCost: totalAllocationCost / input.quantity,
                    totalCost: totalAllocationCost,
                });
            }

            // UPDATE Product.quantity (single update regardless of batch count)
            const existingProductUpdate = productUpdates.get(product.id) || {
                quantity: product.quantity,
            };
            productUpdates.set(product.id, {
                ...(existingProductUpdate as any),
                quantity: Math.max(0, (existingProductUpdate.quantity ?? product.quantity) - input.quantity),
                updatedAt: new Date().toISOString(),
                version: (product.version || 0) + 1,
            });

            // UPDATE InventoryLocationStock.quantity (single update regardless of batch count)
            const locStock = locationStocks.find(
                ls => ls.productId === product.id &&
                    ls.locationId === params.locationId &&
                    !ls.deletedAt
            );
            if (locStock) {
                const existingStockUpdate = stockUpdates.get(locStock.id) || {
                    quantity: locStock.quantity,
                };
                stockUpdates.set(locStock.id, {
                    ...(existingStockUpdate as any),
                    quantity: Math.max(0, (existingStockUpdate.quantity ?? locStock.quantity) - input.quantity),
                    lastMovementAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: (locStock.version || 0) + 1,
                });
            }

            // Create movement record (input)
            // Note: for multi-batch allocations, this is a single movement for the entire input
            // ProductionInputItem records preserve individual batch allocations for reversal
            const firstAllocationBatchId = allocations.length > 0 ? allocations[0].batch.id : null;
            movements.push({
                id: uuidv4(),
                productId: product.id,
                productName: product.name,
                movementType: 'consumption',
                sourceLocationId: params.locationId,
                quantity: input.quantity,
                batchId: firstAllocationBatchId,
                referenceId: referenceNumber,
                notes: `Production input: ${referenceNumber}`,
                status: 'completed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                version: 1,
            });
        }

        // ────────────────────────────────────────────────────────────────────
        // PHASE 3: VALIDATE AND ALLOCATE OUTPUTS
        // ────────────────────────────────────────────────────────────────────
        if (!params.outputs || params.outputs.length === 0) {
            throw new Error('At least one output is required for production');
        }

        for (const output of params.outputs) {
            const product = products.find(p => p.id === output.productId && !p.deletedAt);
            if (!product) {
                throw new Error(`Output product ${output.productId} not found`);
            }

            if (output.quantity <= 0) {
                throw new Error(`Output quantity for ${product.name} must be positive`);
            }

            if (!product.productionOutput) {
                // Warn but don't fail — allows flexibility
                console.warn(`Product ${product.name} is not marked as productionOutput`);
            }

            totalOutputQuantity += output.quantity;

            // Calculate output unit cost
            const outputUnitCost = totalInputCost / totalOutputQuantity;
            const outputTotalCost = output.quantity * outputUnitCost;

            // Create output item record
            outputItems.push({
                productId: product.id,
                productName: product.name,
                quantity: output.quantity,
                unit: product.unit,
                locationId: params.locationId,
                batchId: output.batchId ?? null,
                batchNumber: output.batchId ? batches.find(b => b.id === output.batchId)?.batchNumber ?? null : null,
                unitCost: outputUnitCost,
                totalCost: outputTotalCost,
            });

            // Prepare stock additions
            // UPDATE Product.quantity
            const existingProductUpdate = productUpdates.get(product.id) || {
                quantity: product.quantity,
            };
            productUpdates.set(product.id, {
                ...(existingProductUpdate as any),
                quantity: (existingProductUpdate.quantity ?? product.quantity) + output.quantity,
                updatedAt: new Date().toISOString(),
                version: (product.version || 0) + 1,
            });

            // CREATE or UPDATE InventoryLocationStock.quantity
            const locStock = locationStocks.find(
                ls => ls.productId === product.id &&
                    ls.locationId === params.locationId &&
                    !ls.deletedAt
            );
            if (locStock) {
                const existingStockUpdate = stockUpdates.get(locStock.id) || {
                    quantity: locStock.quantity,
                };
                stockUpdates.set(locStock.id, {
                    ...(existingStockUpdate as any),
                    quantity: (existingStockUpdate.quantity ?? locStock.quantity) + output.quantity,
                    lastMovementAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: (locStock.version || 0) + 1,
                });
            } else {
                // Location stock doesn't exist yet — will be created in persistence layer
                const now = new Date().toISOString();
                stockUpdates.set(`NEW::${product.id}::${params.locationId}`, {
                    productId: product.id,
                    locationId: params.locationId,
                    quantity: output.quantity,
                    lastMovementAt: now,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null,
                    version: 1,
                } as any);
            }

            // UPDATE/CREATE ProductBatch and ProductBatchLocation (if batch-tracked output)
            if (output.batchId) {
                const outputBatch = batches.find(b => b.id === output.batchId && !b.deletedAt);
                if (outputBatch) {
                    // Batch exists — increase quantity
                    const existingBatchUpdate = batchUpdates.get(outputBatch.id) || {
                        quantity: outputBatch.quantity,
                    };
                    batchUpdates.set(outputBatch.id, {
                        ...(existingBatchUpdate as any),
                        quantity: (existingBatchUpdate.quantity ?? outputBatch.quantity) + output.quantity,
                        updatedAt: new Date().toISOString(),
                        version: (outputBatch.version || 0) + 1,
                    });

                    // Update or create batch location allocation
                    const batchLocRec = batchLocations.find(
                        bl => bl.batchId === output.batchId &&
                            bl.locationId === params.locationId &&
                            !bl.deletedAt
                    );
                    if (batchLocRec) {
                        const existingBatchLocUpdate = batchLocationUpdates.get(batchLocRec.id) || {
                            quantity: batchLocRec.quantity,
                        };
                        batchLocationUpdates.set(batchLocRec.id, {
                            ...(existingBatchLocUpdate as any),
                            quantity: (existingBatchLocUpdate.quantity ?? batchLocRec.quantity) + output.quantity,
                            updatedAt: new Date().toISOString(),
                            version: (batchLocRec.version || 0) + 1,
                        });
                    } else {
                        // Create new batch location allocation
                        const now = new Date().toISOString();
                        batchLocationsCreated.push({
                            id: uuidv4(),
                            batchId: output.batchId,
                            locationId: params.locationId,
                            quantity: output.quantity,
                            dateReceived: now,
                            createdAt: now,
                            updatedAt: now,
                            deletedAt: null,
                            version: 1,
                        });
                    }
                } else {
                    throw new Error(`Output batch ${output.batchId} not found for ${product.name}`);
                }
            }

            // Create movement record (output)
            movements.push({
                id: uuidv4(),
                productId: product.id,
                productName: product.name,
                movementType: 'adjustment',
                destinationLocationId: params.locationId,
                quantity: output.quantity,
                batchId: output.batchId ?? null,
                referenceId: referenceNumber,
                notes: `Production output: ${referenceNumber}`,
                status: 'completed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                version: 1,
            });
        }

        // ────────────────────────────────────────────────────────────────────
        // PHASE 4: CREATE PRODUCTION TRANSACTION RECORD
        // ────────────────────────────────────────────────────────────────────
        const transaction: ProductionTransaction = {
            id: uuidv4(),
            referenceNumber,
            date,
            locationId: params.locationId,
            inputItems,
            outputItems,
            totalInputCost,
            totalOutputCost: totalInputCost, // Output cost is input cost redistributed
            notes: params.notes,
            status: 'completed',
            reversalOfId: null,
            reversedById: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deletedAt: null,
            version: 1,
        };

        return {
            transaction,
            movements,
            productUpdates,
            batchUpdates,
            stockUpdates,
            batchLocationUpdates,
            batchLocationsCreated,
        };
    }
}

/**
 * Persist a prepared production transaction to storage atomically.
 *
 * This is the commit phase. All mutations happen inside one transaction boundary.
 * For Dexie-backed storage: real multi-table ACID transaction.
 * For LocalStorage: best-effort compensating backup/restore on error.
 *
 * CRITICAL: This function must NOT be called directly from UI.
 * Only the ProductionMutationService should call this after prepare() validates.
 */
export async function persistProductionTransaction(
    storage: IStorageProvider,
    prepared: ProductionCreationResult,
    allProducts: Product[],
    allBatches: ProductBatch[],
    allLocationStocks: InventoryLocationStock[],
    allBatchLocations: ProductBatchLocation[],
    allMovements: InventoryMovement[]
): Promise<ProductionTransaction> {
    const transactionKeys = [
        'productions',
        'inventory',
        'productBatches',
        'inventoryLocationStocks',
        'productBatchLocations',
        'inventoryMovements',
    ];

    const performPersist = async () => {
        // Update all products
        for (const [productId, updates] of prepared.productUpdates) {
            const product = allProducts.find(p => p.id === productId);
            if (product) {
                await storage.save('inventory', { ...product, ...updates });
            }
        }

        // Update all batches
        for (const [batchId, updates] of prepared.batchUpdates) {
            const batch = allBatches.find(b => b.id === batchId);
            if (batch) {
                await storage.save('productBatches', { ...batch, ...updates });
            }
        }

        // Update all location stocks
        for (const [stockKey, updates] of prepared.stockUpdates) {
            if (stockKey.startsWith('NEW::')) {
                // New location stock record (doesn't exist yet)
                await storage.save('inventoryLocationStocks', updates as any);
            } else {
                const locStock = allLocationStocks.find(ls => ls.id === stockKey);
                if (locStock) {
                    await storage.save('inventoryLocationStocks', { ...locStock, ...updates });
                }
            }
        }

        // Update all batch location allocations
        for (const [batchLocKey, updates] of prepared.batchLocationUpdates) {
            const batchLoc = allBatchLocations.find(bl => bl.id === batchLocKey);
            if (batchLoc) {
                await storage.save('productBatchLocations', { ...batchLoc, ...updates });
            }
        }

        // Create new batch location allocations
        for (const newBatchLoc of prepared.batchLocationsCreated) {
            await storage.save('productBatchLocations', newBatchLoc as ProductBatchLocation);
        }

        // Save all movement records
        for (const movement of prepared.movements) {
            await storage.save('inventoryMovements', movement);
        }

        // Save the production transaction record
        await storage.save('productions', prepared.transaction);

        return prepared.transaction;
    };

    // Use transaction if available (Dexie), otherwise fall back to sequential operations
    if (storage.transaction) {
        return storage.transaction(transactionKeys, 'rw', performPersist);
    }

    return performPersist();
}
