import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { useFeature } from '@/hooks/useFeature';
import { useStorageProvider } from '@/storage/StorageContext';
import {
    useInventory,
    useLocations,
    useProductBatches,
    useProductBatchLocations,
    useInventoryLocationStocks,
    useSuppliers,
    useProductionRecipes,
    useProductionRecipeItems,
} from '@/contexts/GlobalProviders';
import {
    getLocationStockForProduct,
    getProductBatchesAtLocation,
    getSuppliersForProductAtLocation,
    getAvailableStockForSelector,
} from '@/lib/locationStock';
import {
    getActiveRecipesForOutputProduct,
    getExpectedProductionIngredients,
    getProductionVarianceRows,
} from '@/lib/productionRecipe';
import { ProductionMutationService, persistProductionTransaction } from '@/services/productionMutationService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Factory, MapPin, Package, BarChart3, AlertCircle, Check, Info, FileText } from 'lucide-react';
import { ProductSearchPicker } from '@/components/ProductSearchPicker';
import { SupplierSearchPicker } from '@/components/SupplierSearchPicker';
import { TooltipProvider } from '@/components/ui/tooltip';

interface InputRow {
    id: string;
    productId: string;
    quantity: string;
    supplierId?: string;
    batchId?: string;
}

interface OutputRow {
    id: string;
    productId: string;
    quantity: string;
}

const makeInputRow = (): InputRow => ({
    id: crypto.randomUUID(),
    productId: '',
    quantity: '1',
    supplierId: '',
    batchId: '',
});

const makeOutputRow = (): OutputRow => ({
    id: crypto.randomUUID(),
    productId: '',
    quantity: '1',
});

export function ProductionForm() {
    const [, setLocation] = useLocation();
    const productionEnabled = useFeature('production', 'enabled');
    const storage = useStorageProvider();

    const { items: products } = useInventory();
    const { items: locations } = useLocations();
    const { items: batches } = useProductBatches();
    const { items: batchLocations } = useProductBatchLocations();
    const { items: locationStocks } = useInventoryLocationStocks();
    const { items: suppliers } = useSuppliers();
    const { items: recipes } = useProductionRecipes();
    const { items: recipeItems } = useProductionRecipeItems();

    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [notes, setNotes] = useState('');
    const [inputRows, setInputRows] = useState<InputRow[]>([makeInputRow()]);
    const [outputRows, setOutputRows] = useState<OutputRow[]>([makeOutputRow()]);
    const [selectedRecipeId, setSelectedRecipeId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const activeLocations = useMemo(
        () => locations.filter((loc) => (loc.status ?? 'active') !== 'inactive'),
        [locations],
    );

    const locationProducts = useMemo(() => {
        if (!selectedLocationId) return [] as Array<{ product: any; stock: number }>;

        const productStockMap = new Map<string, number>();

        for (const stock of locationStocks) {
            if (stock.locationId === selectedLocationId && Number(stock.quantity ?? 0) > 0) {
                const product = products.find((p) => p.id === stock.productId && !p.deletedAt);
                if (product) {
                    productStockMap.set(product.id, Number(stock.quantity ?? 0));
                }
            }
        }

        for (const product of products) {
            if (product.deletedAt) continue;
            if (!productStockMap.has(product.id)) {
                const stock = getLocationStockForProduct(product, selectedLocationId, locationStocks);
                if (stock > 0) {
                    productStockMap.set(product.id, stock);
                }
            }
        }

        return Array.from(productStockMap.entries())
            .map(([id, stock]) => {
                const product = products.find((p) => p.id === id && !p.deletedAt);
                return product ? { product, stock } : null;
            })
            .filter((item): item is { product: any; stock: number } => item !== null);
    }, [products, selectedLocationId, locationStocks]);

    const getBatchesAtLocation = (productId: string, supplierId?: string) => {
        return getProductBatchesAtLocation(productId, selectedLocationId, batches, batchLocations, supplierId);
    };

    const getSupplierOptionsForInput = (productId: string) => {
        const product = products.find((p) => p.id === productId && !p.deletedAt);
        return getSuppliersForProductAtLocation(productId, selectedLocationId, product, suppliers, batches, batchLocations);
    };

    const getAvailableForInputRow = (row: InputRow) => {
        const product = products.find((p) => p.id === row.productId && !p.deletedAt);
        return getAvailableStockForSelector(row.productId, selectedLocationId, row.supplierId || undefined, row.batchId || undefined, product, locationStocks, batches, batchLocations);
    };

    const getOutputProductOptions = useMemo(() => {
        return products.filter((product) => !product.deletedAt && product.productionOutput);
    }, [products]);

    const selectedOutputProductId = useMemo(() => {
        return outputRows.find((row) => row.productId)?.productId ?? '';
    }, [outputRows]);

    const activeRecipesForSelectedOutput = useMemo(() => {
        if (!selectedOutputProductId) return [];
        return getActiveRecipesForOutputProduct(selectedOutputProductId, recipes);
    }, [selectedOutputProductId, recipes]);

    const activeProductionRecipe = useMemo(() => {
        if (!selectedRecipeId && activeRecipesForSelectedOutput.length === 1) {
            return activeRecipesForSelectedOutput[0];
        }

        if (!selectedRecipeId) return null;
        return activeRecipesForSelectedOutput.find((recipe) => recipe.id === selectedRecipeId) ?? null;
    }, [activeRecipesForSelectedOutput, selectedRecipeId]);

    const selectedOutputQuantity = useMemo(() => {
        const selectedOutput = outputRows.find((row) => row.productId === selectedOutputProductId);
        return Number(selectedOutput?.quantity || 0);
    }, [outputRows, selectedOutputProductId]);

    const expectedRecipeIngredients = useMemo(() => {
        return getExpectedProductionIngredients(
            activeProductionRecipe,
            recipeItems,
            selectedOutputQuantity,
        );
    }, [activeProductionRecipe, recipeItems, selectedOutputQuantity]);

    const productionVarianceRows = useMemo(() => {
        return getProductionVarianceRows(expectedRecipeIngredients, inputRows, products);
    }, [expectedRecipeIngredients, inputRows, products]);

    useEffect(() => {
        if (activeRecipesForSelectedOutput.length === 0) {
            setSelectedRecipeId('');
            return;
        }

        if (activeRecipesForSelectedOutput.length === 1) {
            setSelectedRecipeId(activeRecipesForSelectedOutput[0].id);
            return;
        }

        if (!selectedRecipeId || !activeRecipesForSelectedOutput.some((recipe) => recipe.id === selectedRecipeId)) {
            setSelectedRecipeId('');
        }
    }, [activeRecipesForSelectedOutput, selectedRecipeId]);

    useEffect(() => {
        if (!productionEnabled) return;
        if (!selectedLocationId && activeLocations[0]) {
            setSelectedLocationId(activeLocations[0].id);
        }
    }, [productionEnabled, selectedLocationId, activeLocations]);

    // AUTO-POPULATE Ingredients if recipe changes or output quantity changes
    useEffect(() => {
        if (expectedRecipeIngredients.length > 0 && selectedLocationId) {
            const mappedInputs = expectedRecipeIngredients.map((ingredient) => {
                const available = getLocationStockForProduct(
                    products.find(p => p.id === ingredient.inputProductId),
                    selectedLocationId,
                    locationStocks
                );
                const idealQty = Number(ingredient.quantity);
                const maxQty = Math.min(idealQty, available);
                
                return {
                    id: crypto.randomUUID(),
                    productId: ingredient.inputProductId,
                    quantity: String(maxQty || idealQty || 1),
                    supplierId: '',
                    batchId: '',
                };
            });
            setInputRows(mappedInputs);
        }
    }, [expectedRecipeIngredients, selectedLocationId]);

    const updateInputRow = (rowId: string, updates: Partial<InputRow>) => {
        setInputRows((current) =>
            current.map((row) => {
                if (row.id !== rowId) return row;
                const next = { ...row, ...updates };

                if (updates.productId !== undefined && updates.productId !== row.productId) {
                    next.supplierId = '';
                    next.batchId = '';
                }

                if (updates.supplierId !== undefined && updates.supplierId !== row.supplierId) {
                    next.batchId = '';
                }

                // If productId, supplierId, or batchId changed, check/cap quantity
                if (
                    updates.productId !== undefined ||
                    updates.supplierId !== undefined ||
                    updates.batchId !== undefined
                ) {
                    const available = getAvailableForInputRow(next);
                    const currentQty = Number(next.quantity || 0);
                    if (currentQty > available) {
                        next.quantity = String(available);
                    }
                }

                return next;
            }),
        );
    };

    const updateOutputRow = (rowId: string, updates: Partial<OutputRow>) => {
        setOutputRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
    };

    const addInputRow = () => setInputRows((current) => [...current, makeInputRow()]);
    const removeInputRow = (rowId: string) => {
        setInputRows((current) => (current.length > 1 ? current.filter((row) => row.id !== rowId) : current));
    };

    const addOutputRow = () => setOutputRows((current) => [...current, makeOutputRow()]);
    const removeOutputRow = (rowId: string) => {
        setOutputRows((current) => (current.length > 1 ? current.filter((row) => row.id !== rowId) : current));
    };

    const inputValidationErrors = useMemo(() => {
        const errors: string[] = [];
        if (!selectedLocationId) errors.push('Select a production location.');
        if (!inputRows.length) errors.push('At least one input is required.');

        for (const row of inputRows) {
            if (!row.productId) {
                errors.push('Each input must include a product.');
                continue;
            }

            const product = products.find((p) => p.id === row.productId && !p.deletedAt);
            if (!product) {
                errors.push('One or more input products are invalid.');
                continue;
            }

            const available = getAvailableForInputRow(row);
            const qty = Number(row.quantity || 0);
            if (qty <= 0) errors.push(`${product.name}: quantity must be greater than 0.`);
            if (qty > available) errors.push(`${product.name}: quantity exceeds available stock (${available}).`);
        }

        return errors;
    }, [selectedLocationId, inputRows, products, getAvailableForInputRow]);

    const outputValidationErrors = useMemo(() => {
        const errors: string[] = [];
        if (!outputRows.length) errors.push('At least one output is required.');

        for (const row of outputRows) {
            if (!row.productId) {
                errors.push('Each output must include a product.');
                continue;
            }
            const qty = Number(row.quantity || 0);
            if (qty <= 0) errors.push('Output quantity must be greater than 0.');
        }

        return errors;
    }, [outputRows]);

    const hasValidationErrors = useMemo(
        () => [...inputValidationErrors, ...outputValidationErrors].length > 0,
        [inputValidationErrors, outputValidationErrors],
    );

    const handleSubmit = async () => {
        if (!productionEnabled) {
            toast.error('Production feature is not enabled.');
            return;
        }

        if (hasValidationErrors) {
            toast.error('Please fix the validation errors before submitting.');
            return;
        }

        const normalizedInputs = inputRows.map((row) => {
            const product = products.find((p) => p.id === row.productId && !p.deletedAt);
            if (!product) throw new Error(`Input product not found: ${row.productId}`);

            return {
                productId: product.id,
                quantity: Number(row.quantity),
                ...(row.batchId ? { batchId: row.batchId } : {}),
            };
        });

        const normalizedOutputs = outputRows.map((row) => ({
            productId: row.productId,
            quantity: Number(row.quantity),
        }));

        const selectedRecipe = selectedRecipeId
            ? activeRecipesForSelectedOutput.find((recipe) => recipe.id === selectedRecipeId) ?? null
            : activeRecipesForSelectedOutput.length === 1
                ? activeRecipesForSelectedOutput[0]
                : null;

        setIsSubmitting(true);

        try {
            const allProducts = products.filter((p) => !p.deletedAt);
            const allBatches = batches.filter((b) => !b.deletedAt);
            const allLocationStocks = locationStocks.filter((stock) => !stock.deletedAt);
            const allBatchLocations = batchLocations.filter((loc) => !loc.deletedAt);
            const existingProductionTransactions = await storage.get<any>('productions');

            const prepared = ProductionMutationService.prepareProduction(
                {
                    locationId: selectedLocationId,
                    inputs: normalizedInputs,
                    outputs: normalizedOutputs,
                    recipeId: selectedRecipe?.id ?? null,
                    recipeName: selectedRecipe?.name ?? null,
                    notes,
                },
                allProducts,
                allBatches,
                allLocationStocks,
                allBatchLocations,
                existingProductionTransactions,
            );

            await persistProductionTransaction(
                storage,
                prepared,
                allProducts,
                allBatches,
                allLocationStocks,
                allBatchLocations,
                [],
            );

            toast.success(`Production ${prepared.transaction.referenceNumber} created successfully.`);
            setLocation('/inventory');
        } catch (error) {
            console.error('Production submission failed:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create production');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!productionEnabled) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <Card className="max-w-md w-full border-none shadow-xl bg-card/65 backdrop-blur-md">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />
                            Access Denied
                        </CardTitle>
                        <CardDescription>Production is not enabled in your current license configuration.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => setLocation('/dashboard')} className="w-full">Back to Dashboard</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="max-w-4xl mx-auto p-4 md:p-6 pb-28 md:pb-8 space-y-6">
                
                {/* Header Section */}
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setLocation('/inventory')}
                        aria-label="Back"
                        className="rounded-full hover:bg-muted shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Production</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">Record production batches, raw materials, and finished goods.</p>
                    </div>
                </div>

                {/* Primary Location Config */}
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                    <CardHeader className="pb-4 border-b border-muted-foreground/10 bg-muted/20">
                        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                            <MapPin className="h-4.5 w-4.5 text-primary" /> Location Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 sm:p-6">
                        <div className="space-y-2">
                            <Label htmlFor="location" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Source & Target Location
                            </Label>
                            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                                <SelectTrigger id="location" className="h-11 rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm">
                                    <SelectValue placeholder="Select production location" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {activeLocations.map((location) => (
                                        <SelectItem key={location.id} value={location.id} className="rounded-lg">
                                            {location.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Layout Grid (Stacks on Mobile, Grid on large screens) */}
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
                    
                    {/* Left Column: Target Finished Goods (lg:col-span-7) */}
                    <div className="space-y-6 lg:col-span-7">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                                    Finished Goods Output
                                </h2>
                            </div>
                            
                            {outputRows.map((row, index) => (
                                <Card key={row.id} className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden hover:border-primary/40 transition-colors">
                                    <CardHeader className="p-4 border-b border-muted-foreground/10 pb-3 bg-muted/20 flex flex-row items-center justify-between space-y-0">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary font-bold shrink-0">{index + 1}</span>
                                            <CardTitle className="text-sm font-bold">Target Output Item</CardTitle>
                                        </div>
                                        {outputRows.length > 1 && (
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => removeOutputRow(row.id)} 
                                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-12">
                                            <div className="space-y-1.5 sm:col-span-8">
                                                <Label className="text-xs text-muted-foreground">Product to Produce</Label>
                                                {row.productId ? (
                                                    (() => {
                                                        const targetProd = products.find(p => p.id === row.productId);
                                                        const currentStock = targetProd ? getLocationStockForProduct(targetProd, selectedLocationId, locationStocks) : 0;
                                                        return (
                                                            <div className="p-2.5 rounded-xl border border-primary/25 bg-primary/5 shadow-xs flex items-center justify-between">
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <Package className="h-5 w-5 text-primary shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-semibold truncate text-foreground">
                                                                            {targetProd?.name || 'Unknown Product'}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-[10px] text-muted-foreground">
                                                                                {targetProd?.category || 'General'}
                                                                            </span>
                                                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-1.5 py-0.5 flex items-center gap-1 shrink-0">
                                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                                Stock: {currentStock} {targetProd?.unit || 'pcs'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => updateOutputRow(row.id, { productId: '' })}
                                                                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    <ProductSearchPicker
                                                        label="Select output product"
                                                        items={getOutputProductOptions.map((product) => {
                                                            const stock = getLocationStockForProduct(product, selectedLocationId, locationStocks);
                                                            return {
                                                                id: product.id,
                                                                name: product.name,
                                                                barcode: product.barcode,
                                                                category: product.category,
                                                                sublabel: `Stock: ${stock} ${product.unit}`,
                                                            };
                                                        })}
                                                        onSelect={(productId) => updateOutputRow(row.id, { productId })}
                                                        emptyMessage="No finished-goods products available."
                                                    />
                                                )}
                                            </div>
 
                                            <div className="space-y-1.5 sm:col-span-4">
                                                <Label htmlFor={`output-qty-${row.id}`} className="text-xs text-muted-foreground">Target Quantity</Label>
                                                <Input
                                                    id={`output-qty-${row.id}`}
                                                    type="number"
                                                    min="1"
                                                    className="h-10 bg-background/50 rounded-xl"
                                                    value={row.quantity}
                                                    onChange={(e) => updateOutputRow(row.id, { quantity: String(Math.max(0, Number(e.target.value || 0))) })}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {outputRows.length < 3 && (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={addOutputRow} 
                                    className="w-full gap-2 border-dashed border-border/60 rounded-xl hover:border-primary/45 hover:text-primary transition-all h-11"
                                >
                                    <Plus className="h-4 w-4" /> Add Another Output
                                </Button>
                            )}
                        </div>

                        {/* Recipe Selector Block */}
                        <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                            <CardHeader className="p-4 border-b border-muted-foreground/10 pb-3 bg-muted/20">
                                <CardTitle className="text-sm font-bold flex items-center gap-1.5">Recipe Automation</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                {activeRecipesForSelectedOutput.length === 0 ? (
                                    <div className="rounded-xl border border-border/30 bg-muted/10 px-3.5 py-3 text-xs text-muted-foreground flex items-center gap-2">
                                        <Info className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                                        Select an output product that has an active recipe.
                                    </div>
                                ) : activeRecipesForSelectedOutput.length === 1 ? (
                                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm font-medium text-primary flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-xs md:text-sm">
                                            <Check className="h-4 w-4 shrink-0" />
                                            Active Recipe: {activeRecipesForSelectedOutput[0].name}
                                        </span>
                                        <span className="text-[10px] text-primary/80 font-normal shrink-0">Auto-filled</span>
                                    </div>
                                ) : (
                                    <Select value={selectedRecipeId || 'none'} onValueChange={(value) => setSelectedRecipeId(value === 'none' ? '' : value)}>
                                        <SelectTrigger className="w-full h-10 bg-background/50 border-border/40 rounded-xl">
                                            <SelectValue placeholder="Select a recipe" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="none" className="rounded-lg">None (Manual Production)</SelectItem>
                                            {activeRecipesForSelectedOutput.map((recipe) => (
                                                <SelectItem key={recipe.id} value={recipe.id} className="rounded-lg">{recipe.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recipe Blueprint Variance Review */}
                        {activeProductionRecipe && expectedRecipeIngredients.length > 0 && (
                            <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                                <CardHeader className="p-4 border-b border-muted-foreground/10 pb-3 bg-muted/20">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <CardTitle className="text-sm font-bold">Recipe Blueprint</CardTitle>
                                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                            {activeProductionRecipe.name}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="space-y-1.5 text-xs text-muted-foreground">
                                        {expectedRecipeIngredients.map((ingredient) => (
                                            <div key={`${ingredient.recipeId}-${ingredient.inputProductId}`} className="flex items-center justify-between gap-3 p-1 hover:bg-muted/10 rounded-lg">
                                                <span className="truncate">{products.find((product) => product.id === ingredient.inputProductId)?.name ?? ingredient.inputProductId}</span>
                                                <span className="font-semibold text-foreground shrink-0">{Number(ingredient.quantity).toLocaleString()} {ingredient.unit}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-3 border-t border-border/10 overflow-x-auto">
                                        <div className="mb-2 flex items-center justify-between">
                                            <p className="text-xs font-bold text-foreground">Variance Review</p>
                                        </div>
                                        <div className="rounded-xl border border-border/40 overflow-hidden bg-background/50 min-w-[320px]">
                                            <Table className="text-xs">
                                                <TableHeader className="bg-muted/10">
                                                    <TableRow>
                                                        <TableHead className="py-2 h-auto">Material</TableHead>
                                                        <TableHead className="py-2 h-auto text-right">Expected</TableHead>
                                                        <TableHead className="py-2 h-auto text-right">Actual</TableHead>
                                                        <TableHead className="py-2 h-auto text-right">Variance</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {productionVarianceRows.map((row) => (
                                                        <TableRow key={`${row.recipeId}-${row.inputProductId}`} className="hover:bg-muted/10">
                                                            <TableCell className="font-medium py-2 truncate max-w-[120px]">{row.productName}</TableCell>
                                                            <TableCell className="text-right py-2">{row.expectedQuantity.toLocaleString()} {row.unit}</TableCell>
                                                            <TableCell className="text-right py-2 font-semibold">{row.actualQuantity.toLocaleString()} {row.unit}</TableCell>
                                                            <TableCell className={`text-right py-2 font-bold ${row.variance !== null && row.variance < 0 ? 'text-destructive' : row.variance !== null && row.variance > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                                {row.compatible && row.variance !== null ? `${row.variance > 0 ? '+' : ''}${row.variance.toLocaleString()} ${row.unit}` : '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right Column: Dynamic Cards for Product Inputs (lg:col-span-5) */}
                    <div className="space-y-6 lg:col-span-5">
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary shrink-0" />
                                Raw Material Inputs
                            </h2>
                            
                            {inputRows.map((row, index) => {
                                const product = products.find((p) => p.id === row.productId && !p.deletedAt);
                                const available = getAvailableForInputRow(row);
                                const supplierOptions = product ? getSupplierOptionsForInput(product.id) : [];
                                const batchOptions = product ? getBatchesAtLocation(product.id, row.supplierId || undefined) : [];

                                return (
                                    <Card key={row.id} className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden hover:border-primary/40 transition-colors">
                                        <CardHeader className="p-4 border-b border-muted-foreground/10 pb-3 bg-muted/20 flex flex-row items-center justify-between space-y-0">
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary font-bold shrink-0">{index + 1}</span>
                                                <CardTitle className="text-sm font-bold">Input Material Row</CardTitle>
                                            </div>
                                            {inputRows.length > 1 && (
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => removeInputRow(row.id)} 
                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </CardHeader>
                                        <CardContent className="p-4 space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-muted-foreground">Select Material</Label>
                                                {row.productId ? (
                                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-primary/25 bg-primary/5 shadow-xs">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Package className="h-5 w-5 text-primary shrink-0" />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold truncate text-foreground">
                                                                    {products.find(p => p.id === row.productId)?.name || 'Unknown Material'}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground truncate">
                                                                    {products.find(p => p.id === row.productId)?.category || 'General'} · Barcode: {products.find(p => p.id === row.productId)?.barcode || 'N/A'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => updateInputRow(row.id, { productId: '' })}
                                                            className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <ProductSearchPicker
                                                        label="Select material"
                                                        items={locationProducts.map(({ product, stock }) => ({
                                                            id: product.id,
                                                            name: product.name,
                                                            barcode: product.barcode,
                                                            category: product.category,
                                                            sublabel: `Available: ${stock} ${product.unit}`,
                                                        }))}
                                                        onSelect={(productId) => updateInputRow(row.id, { productId })}
                                                        emptyMessage="No materials available at this location."
                                                    />
                                                )}
                                            </div>

                                            {product && (
                                                <div className="space-y-4">
                                                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                                                        {supplierOptions.length > 1 && (
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs text-muted-foreground">Supplier Filter</Label>
                                                                <SupplierSearchPicker
                                                                    suppliers={supplierOptions}
                                                                    selectedSupplierId={row.supplierId || ''}
                                                                    onSelect={(supplierId) => updateInputRow(row.id, { supplierId })}
                                                                    onRemove={() => updateInputRow(row.id, { supplierId: '', batchId: '' })}
                                                                    emptyMessage="No supplier stock found at this location."
                                                                />
                                                            </div>
                                                        )}

                                                        {batchOptions.length > 0 && (
                                                            <div className={`space-y-1.5 ${supplierOptions.length <= 1 ? 'sm:col-span-2' : ''}`}>
                                                                <Label className="text-xs text-muted-foreground">Select Batch</Label>
                                                                <Select value={row.batchId || 'auto'} onValueChange={(value) => updateInputRow(row.id, { batchId: value === 'auto' ? '' : value })}>
                                                                    <SelectTrigger className="w-full h-10 bg-background/50 border-border/40 rounded-xl">
                                                                        <SelectValue placeholder="Select batch" />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl">
                                                                        <SelectItem value="auto" className="rounded-lg">Auto FEFO</SelectItem>
                                                                        {batchOptions.map((entry) => (
                                                                            <SelectItem key={entry.batch.id} value={entry.batch.id} className="rounded-lg text-xs">
                                                                                {entry.batch.batchNumber || 'Batch'} · {entry.available} {product.unit}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1.5 pt-1">
                                                        <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                                                            <Label htmlFor={`qty-${row.id}`} className="text-xs text-muted-foreground font-medium">Quantity to Deduct</Label>
                                                            <span className="text-[10px] text-primary font-semibold bg-primary/10 rounded-md px-1.5 py-0.5">
                                                                Available: {available} {product.unit}
                                                            </span>
                                                        </div>
                                                        <Input
                                                            id={`qty-${row.id}`}
                                                            type="number"
                                                            min="1"
                                                            max={available}
                                                            className="h-10 bg-background/50 rounded-xl w-full"
                                                            value={row.quantity}
                                                            onChange={(e) => {
                                                                 const nextValue = Number(e.target.value || 0);
                                                                 if (nextValue > available) {
                                                                     toast.error(`Cannot select more than ${available}`);
                                                                     updateInputRow(row.id, { quantity: String(available) });
                                                                 } else {
                                                                     updateInputRow(row.id, { quantity: String(Math.max(0, nextValue)) });
                                                                 }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={addInputRow} 
                                className="w-full gap-2 border-dashed border-border/60 rounded-xl hover:border-primary/45 hover:text-primary transition-all h-11"
                            >
                                <Plus className="h-4 w-4" /> Add Input Material
                            </Button>
                        </div>

                        {/* Notes Section */}
                        <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                            <CardHeader className="p-4 border-b border-muted-foreground/10 pb-3 bg-muted/20">
                                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                                    <FileText className="h-4 w-4 text-muted-foreground" /> Production Notes / Remarks
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <textarea
                                    id="production-notes"
                                    className="min-h-[90px] w-full rounded-xl border border-border/40 bg-background/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60 resize-none"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add notes for this production batch..."
                                />
                            </CardContent>
                        </Card>
                    </div>

                </div>

                {/* Footer validation and action drawer */}
                <Card className="border border-muted-foreground/10 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden">
                    <CardContent className="p-4 md:p-6">
                        {hasValidationErrors && (
                            <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive space-y-1.5 flex gap-2">
                                <AlertCircle className="h-5 w-5 shrink-0 text-destructive/80" />
                                <div>
                                    <p className="font-bold text-destructive/90 mb-1">Please fix the following validation parameters:</p>
                                    {Array.from(new Set([...inputValidationErrors, ...outputValidationErrors])).map((message) => (
                                        <div key={message} className="flex items-center gap-1.5">
                                            <span className="h-1 w-1 rounded-full bg-destructive shrink-0" />
                                            {message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-muted-foreground text-xs text-center sm:text-left flex items-center gap-2">
                                <Info className="h-4 w-4 text-primary shrink-0" />
                                Submitting records atomic adjustments to Inventory Ledger.
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="rounded-xl h-11 px-6 bg-background/50 hover:bg-background transition-colors w-full sm:w-auto"
                                    onClick={() => setLocation('/inventory')}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    type="button" 
                                    className="rounded-xl h-11 px-8 font-bold shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-100 transition-all cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 w-full sm:w-auto"
                                    onClick={handleSubmit} 
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Processing Ledger...' : 'Submit Batch Production'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}
