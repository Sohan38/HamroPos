export type ProductCapabilityProduct = {
    purchasable?: boolean;
    availableForPOS?: boolean;
    consumable?: boolean;
    productionOutput?: boolean;
    availableInMenu?: boolean;
};

export function isProductPurchasable(product?: ProductCapabilityProduct | null) {
    return !product || product.purchasable !== false;
}

export function isProductAvailableForPOS(product?: ProductCapabilityProduct | null) {
    return !product || product.availableForPOS !== false;
}

export function isProductConsumable(product?: ProductCapabilityProduct | null) {
    return !product || product.consumable !== false;
}

export function isProductAvailableInMenu(product?: ProductCapabilityProduct | null) {
    return !product || product.availableInMenu !== false;
}

/**
 * Production module is future work and intentionally not active yet.
 * Keep this flag available for later wiring, but don't enforce it in live flows.
 */
export function isProductProductionOutput(product?: ProductCapabilityProduct | null) {
    return !product || product.productionOutput === true;
}
