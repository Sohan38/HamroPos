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
import { getLocationStockForProduct } from '@/lib/locationStock';
import {
    getActiveRecipeForOutputProduct,
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
import { ArrowLeft, Plus, Trash2, Factory, MapPin, Package, BarChart3 } from 'lucide-react';
import { ProductSearchPicker } from '@/components/ProductSearchPicker';
import { SupplierSearchPicker } from '@/components/SupplierSearchPicker';

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

    const getProductBatchesAtLocation = (productId: string, supplierId?: string) => {
        if (!selectedLocationId) return [] as Array<{ batch: any; available: number }>;

        return batches
            .filter((batch) => {
                if (batch.productId !== productId || batch.quantity <= 0 || batch.deletedAt) return false;
                if (supplierId && batch.supplierId !== supplierId) return false;
                return true;
            })
            .map((batch) => {
                const locationAllocation = batchLocations.find(
                    (bl) => bl.batchId === batch.id && bl.locationId === selectedLocationId && !bl.deletedAt,
                );
                return {
                    batch,
                    available: Number(locationAllocation?.quantity ?? 0),
                };
            })
            .filter((entry) => entry.available > 0)
            .sort((a, b) => {
                const aExpiry = a.batch.expiryDate ? new Date(a.batch.expiryDate).getTime() : Infinity;
                const bExpiry = b.batch.expiryDate ? new Date(b.batch.expiryDate).getTime() : Infinity;
                return aExpiry - bExpiry;
            });
    };

    const getSupplierOptionsForInput = (productId: string) => {
        const product = products.find((p) => p.id === productId && !p.deletedAt);
        if (!product) return [];

        const ids = product.supplierIds?.length ? product.supplierIds : product.supplierId ? [product.supplierId] : [];
        const options = suppliers.filter((supplier) => ids.includes(supplier.id));

        if (product.hasExpiry || product.supplierIds?.length || product.supplierId) {
            return options.filter((supplier) => getProductBatchesAtLocation(productId, supplier.id).length > 0 || !product.hasExpiry);
        }

        return options;
    };

    const getAvailableForInputRow = (row: InputRow) => {
        if (!row.productId || !selectedLocationId) return 0;
        const product = products.find((p) => p.id === row.productId && !p.deletedAt);
        if (!product) return 0;

        if (product.hasExpiry || batches.some((b) => b.productId === product.id && !b.deletedAt)) {
            const batchOptions = getProductBatchesAtLocation(product.id, row.supplierId || undefined);
            if (row.batchId) {
                const selected = batchOptions.find((entry) => entry.batch.id === row.batchId);
                return selected?.available ?? 0;
            }
            if (row.supplierId) {
                return batchOptions.reduce((sum, entry) => sum + entry.available, 0);
            }
            return batchOptions.reduce((sum, entry) => sum + entry.available, 0);
        }

        return getLocationStockForProduct(product, selectedLocationId, locationStocks);
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
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle>Access Denied</CardTitle>
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
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-28 md:p-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="icon" onClick={() => setLocation('/inventory')} aria-label="Back">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Production</p>
                        <h1 className="text-2xl font-bold tracking-tight">Create Production</h1>
                    </div>
                </div>
                <div className="hidden items-center gap-2 rounded-full border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground md:flex">
                    <Factory className="h-4 w-4" />
                    <span>Stock-safe workflow</span>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Production Location
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="location">Production location</Label>
                        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                            <SelectTrigger id="location" className="w-full">
                                <SelectValue placeholder="Select production location" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeLocations.map((location) => (
                                    <SelectItem key={location.id} value={location.id}>
                                        {location.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.35fr_0.95fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Output and Recipe
                        </CardTitle>
                        <CardDescription>Start with what is being produced, then confirm the actual inputs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Recipe</Label>
                            {activeRecipesForSelectedOutput.length === 0 ? (
                                <div className="rounded-xl border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                                    No active recipe for this output.
                                </div>
                            ) : activeRecipesForSelectedOutput.length === 1 ? (
                                <div className="rounded-xl border bg-muted/20 px-3 py-2 text-sm font-medium">
                                    {activeRecipesForSelectedOutput[0].name}
                                </div>
                            ) : (
                                <Select value={selectedRecipeId || 'none'} onValueChange={(value) => setSelectedRecipeId(value === 'none' ? '' : value)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select a recipe" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {activeRecipesForSelectedOutput.map((recipe) => (
                                            <SelectItem key={recipe.id} value={recipe.id}>{recipe.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {!activeProductionRecipe && activeRecipesForSelectedOutput.length === 0 && (
                            <div className="rounded-xl border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                                Manual Production
                            </div>
                        )}

                        {activeProductionRecipe && expectedRecipeIngredients.length > 0 && (
                            <div className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold">Expected materials</p>
                                    <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        {activeProductionRecipe.name}
                                    </span>
                                </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                    {expectedRecipeIngredients.map((ingredient) => (
                                        <div key={`${ingredient.recipeId}-${ingredient.inputProductId}`} className="flex items-center justify-between gap-3">
                                            <span>{products.find((product) => product.id === ingredient.inputProductId)?.name ?? ingredient.inputProductId}</span>
                                            <span className="font-medium text-foreground">{Number(ingredient.quantity).toLocaleString()} {ingredient.unit}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-xl border bg-background/50 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold">Actual vs Expected Review</p>
                                        <span className="text-xs text-muted-foreground">Informational only</span>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Material</TableHead>
                                                <TableHead>Expected</TableHead>
                                                <TableHead>Actual</TableHead>
                                                <TableHead>Variance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {productionVarianceRows.map((row) => (
                                                <TableRow key={`${row.recipeId}-${row.inputProductId}`}>
                                                    <TableCell>{row.productName}</TableCell>
                                                    <TableCell>{row.expectedQuantity.toLocaleString()} {row.unit}</TableCell>
                                                    <TableCell>{row.actualQuantity.toLocaleString()} {row.unit}</TableCell>
                                                    <TableCell className={row.variance !== null && row.variance < 0 ? 'text-destructive' : row.variance !== null && row.variance > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                                                        {row.compatible && row.variance !== null ? `${row.variance.toLocaleString()} ${row.unit}` : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Raw Material Inputs
                        </CardTitle>
                        <CardDescription>Use the selected location stock as the source of truth. Actual quantities are submitted to production.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {inputRows.map((row, index) => {
                            const product = products.find((p) => p.id === row.productId && !p.deletedAt);
                            const available = getAvailableForInputRow(row);
                            const supplierOptions = product ? getSupplierOptionsForInput(product.id) : [];
                            const batchOptions = product ? getProductBatchesAtLocation(product.id, row.supplierId || undefined) : [];

                            return (
                                <div key={row.id} className="rounded-2xl border bg-muted/20 p-3 sm:p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold">Input {index + 1}</p>
                                        {inputRows.length > 1 && (
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeInputRow(row.id)} className="text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label>Material</Label>
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
                                        </div>

                                        {product && (
                                            <>
                                                {supplierOptions.length > 0 && (
                                                    <div className="space-y-2">
                                                        <Label>Supplier</Label>
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
                                                    <div className="space-y-2">
                                                        <Label>Batch</Label>
                                                        <Select value={row.batchId || 'auto'} onValueChange={(value) => updateInputRow(row.id, { batchId: value === 'auto' ? '' : value })}>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Select batch" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="auto">Auto-select by FEFO</SelectItem>
                                                                {batchOptions.map((entry) => (
                                                                    <SelectItem key={entry.batch.id} value={entry.batch.id}>
                                                                        {entry.batch.batchNumber || 'Batch'} · {entry.available} {product.unit} · {entry.batch.expiryDate ? new Date(entry.batch.expiryDate).toLocaleDateString() : 'No expiry'}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`qty-${row.id}`}>Quantity</Label>
                                                        <Input
                                                            id={`qty-${row.id}`}
                                                            type="number"
                                                            min="1"
                                                            max={available}
                                                            value={row.quantity}
                                                            onChange={(e) => {
                                                                const nextValue = Number(e.target.value || 0);
                                                                updateInputRow(row.id, { quantity: String(Math.max(0, nextValue)) });
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="rounded-xl border bg-background px-3 py-2 text-right sm:min-w-[140px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Available</div>
                                                        <div className="text-base font-bold text-foreground">{available}</div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        <Button type="button" variant="outline" onClick={addInputRow} className="w-full gap-2">
                            <Plus className="h-4 w-4" /> Add Input
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Finished Goods Output
                        </CardTitle>
                        <CardDescription>Resulting stock created at the selected production location.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {outputRows.map((row, index) => (
                            <div key={row.id} className="rounded-2xl border bg-muted/20 p-3 sm:p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold">Output {index + 1}</p>
                                    {outputRows.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOutputRow(row.id)} className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <Label>Output product</Label>
                                        <ProductSearchPicker
                                            label="Select output product"
                                            items={getOutputProductOptions.map((product) => ({
                                                id: product.id,
                                                name: product.name,
                                                barcode: product.barcode,
                                                category: product.category,
                                                sublabel: `${product.unit}`,
                                            }))}
                                            onSelect={(productId) => updateOutputRow(row.id, { productId })}
                                            emptyMessage="No finished-goods products available."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Quantity</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={row.quantity}
                                            onChange={(e) => updateOutputRow(row.id, { quantity: String(Math.max(0, Number(e.target.value || 0))) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <Button type="button" variant="outline" onClick={addOutputRow} className="w-full gap-2">
                            <Plus className="h-4 w-4" /> Add Output
                        </Button>

                        <div className="rounded-xl border bg-muted/20 p-3">
                            <Label htmlFor="production-notes">Notes</Label>
                            <textarea
                                id="production-notes"
                                className="mt-2 min-h-[90px] w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Optional production notes"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="pt-6">
                    {hasValidationErrors && (
                        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                            {Array.from(new Set([...inputValidationErrors, ...outputValidationErrors])).map((message) => (
                                <div key={message}>• {message}</div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={() => setLocation('/inventory')}>Cancel</Button>
                        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit Production'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
