import { ConsumptionTransaction, ConsumptionItem, Product, ProductBatch, InventoryLocationStock, InventoryMovement, ProductUnit } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration for creating a consumption transaction
 */
export interface CreateConsumptionParams {
    locationId: string;
    items: ConsumptionItemInput[];
    reason?: string;
    notes?: string;
    date?: string; // ISO 8601, defaults to today
}

/**
 * Item input for consumption - minimal user input
 */
export interface ConsumptionItemInput {
    productId: string;
    quantity: number;
    batchId?: string;
}

/**
 * Result of creating a consumption transaction
 */
export interface ConsumptionCreationResult {
    transaction: ConsumptionTransaction;
    movements: InventoryMovement[];
    stockUpdates: Map<string, Partial<InventoryLocationStock>>; // key: locStock.id
    batchUpdates: Map<string, Partial<ProductBatch>>; // key: batch.id
}

/**
 * Service for consumption transaction operations
 */
export class ConsumptionService {
    /**
     * Generate next consumption reference number
     * Format: CONS-YYYY-NNN (e.g., CONS-2024-001)
     */
    static generateReferenceNumber(existingTransactions: ConsumptionTransaction[]): string {
        const today = new Date();
        const year = today.getFullYear();

        // Filter transactions from current year
        const thisYearTransactions = existingTransactions.filter(t =>
            t.date.startsWith(year.toString())
        );

        // Get next sequence number
        const nextNumber = thisYearTransactions.length + 1;
        return `CONS-${year}-${String(nextNumber).padStart(3, '0')}`;
    }

    /**
     * Prepare consumption transaction for creation
     * Validates products exist, have consumable flag, stock available
     * Prepares all data but does NOT persist
     */
    static prepareConsumption(
        params: CreateConsumptionParams,
        products: Product[],
        batches: ProductBatch[],
        locationStocks: InventoryLocationStock[],
        existingTransactions: ConsumptionTransaction[]
    ): ConsumptionCreationResult {
        const date = params.date || new Date().toISOString().split('T')[0];
        const referenceNumber = this.generateReferenceNumber(existingTransactions);

        const items: ConsumptionItem[] = [];
        const movements: InventoryMovement[] = [];
        const stockUpdates = new Map<string, Partial<InventoryLocationStock>>();
        const batchUpdates = new Map<string, Partial<ProductBatch>>();
        let totalCost = 0;

        for (const input of params.items) {
            // Find product
            const product = products.find(p => p.id === input.productId);
            if (!product) {
                throw new Error(`Product ${input.productId} not found`);
            }

            // Ensure product is consumable
            if (!product.consumable) {
                throw new Error(`Product ${product.name} is not marked as consumable`);
            }

            // Get product's batches at this location
            const productBatches = batches.filter(b =>
                b.productId === input.productId && b.quantity > 0
            );

            // Determine which batch to consume from
            let selectedBatch: ProductBatch | undefined;
            if (input.batchId) {
                selectedBatch = productBatches.find(b => b.id === input.batchId);
                if (!selectedBatch) {
                    throw new Error(`Batch ${input.batchId} not found for product ${product.name}`);
                }
            } else if (productBatches.length > 0) {
                // Use FEFO: earliest expiry first
                productBatches.sort((a, b) => {
                    const aExpiry = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
                    const bExpiry = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
                    return aExpiry - bExpiry;
                });
                selectedBatch = productBatches[0];
            }

            if (!selectedBatch) {
                throw new Error(`No stock available for product ${product.name} at location ${params.locationId}`);
            }

            // Check available quantity
            if (selectedBatch.quantity < input.quantity) {
                throw new Error(
                    `Insufficient stock for ${product.name}. Available: ${selectedBatch.quantity} ${product.unit}, ` +
                    `Requested: ${input.quantity} ${product.unit}`
                );
            }

            // Get location stock for this product
            const locStock = locationStocks.find(
                ls => ls.productId === input.productId && ls.locationId === params.locationId
            );
            if (!locStock) {
                throw new Error(`No stock record for product ${product.name} at location ${params.locationId}`);
            }

            // Calculate cost from batch's purchase rate
            const unitCost = selectedBatch.purchaseRate;
            const itemTotalCost = input.quantity * unitCost;
            totalCost += itemTotalCost;

            // Create consumption item
            items.push({
                productId: input.productId,
                productName: product.name,
                quantity: input.quantity,
                unit: product.unit,
                batchId: selectedBatch.id,
                batchNumber: selectedBatch.batchNumber,
                unitCost,
                totalCost: itemTotalCost,
            });

            // Create audit movement
            movements.push({
                id: uuidv4(),
                productId: input.productId,
                productName: product.name,
                movementType: 'consumption',
                sourceLocationId: params.locationId,
                quantity: input.quantity,
                batchId: selectedBatch.id,
                referenceId: referenceNumber,
                notes: params.notes,
                status: 'completed',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deletedAt: null,
                version: 1,
            });

            // Prepare stock updates
            // Update batch quantity
            const batchUpdateData: Partial<ProductBatch> = {
                quantity: Math.max(0, selectedBatch.quantity - input.quantity),
                updatedAt: new Date().toISOString(),
                version: (selectedBatch.version || 0) + 1,
            };
            batchUpdates.set(selectedBatch.id, batchUpdateData);

            // Update location stock - use actual locStock.id as key
            const updatedLocStock: Partial<InventoryLocationStock> = {
                quantity: Math.max(0, locStock.quantity - input.quantity),
                lastMovementAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: (locStock.version || 0) + 1,
            };
            stockUpdates.set(locStock.id, updatedLocStock);
        }

        // Create transaction
        const transaction: ConsumptionTransaction = {
            id: uuidv4(),
            referenceNumber,
            date,
            locationId: params.locationId,
            items,
            totalCost,
            reason: params.reason,
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
            stockUpdates,
            batchUpdates,
        };
    }

    /**
     * Validate that a product can be consumed from a location
     */
    static validateConsumption(
        productId: string,
        quantity: number,
        locationId: string,
        products: Product[],
        batches: ProductBatch[],
        locationStocks: InventoryLocationStock[]
    ): { valid: boolean; error?: string } {
        // Find product
        const product = products.find(p => p.id === productId);
        if (!product) {
            return { valid: false, error: `Product not found` };
        }

        // Check consumable flag
        if (!product.consumable) {
            return { valid: false, error: `${product.name} is not marked as consumable` };
        }

        // Check location stock exists
        const locStock = locationStocks.find(
            ls => ls.productId === productId && ls.locationId === locationId
        );
        if (!locStock || locStock.quantity < quantity) {
            const available = locStock?.quantity ?? 0;
            return {
                valid: false,
                error: `Insufficient stock. Available: ${available} ${product.unit}, Needed: ${quantity} ${product.unit}`
            };
        }

        return { valid: true };
    }
}
