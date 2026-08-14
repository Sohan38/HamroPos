import React from 'react';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { SectionProps } from './types';
import { useWatch } from 'react-hook-form';
import { Box, ShoppingCart, Utensils, Factory, Menu } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Product Capabilities Section
 * 
 * Allows configuration of what an individual product can be used for:
 * - Purchasable: Can be received via purchase invoices
 * - Available for POS: Can be sold in point-of-sale
 * - Consumable: Can be consumed internally
 * - Production Output: Can be created as output of production
 * - Available in Menu: Can appear as customer-facing menu item
 */
export const ProductCapabilitiesSection = React.memo(({ form }: SectionProps) => {
    const purchasable = useWatch({ control: form.control, name: 'purchasable' }) ?? true;
    const availableForPOS = useWatch({ control: form.control, name: 'availableForPOS' }) ?? true;
    const consumable = useWatch({ control: form.control, name: 'consumable' }) ?? false;
    const productionOutput = useWatch({ control: form.control, name: 'productionOutput' }) ?? false;
    const availableInMenu = useWatch({ control: form.control, name: 'availableInMenu' }) ?? false;

    return (
        <section className="px-4 py-4 space-y-4">
            <div>
                <h3 className="text-sm font-semibold mb-0.5">Product Capabilities</h3>
                <p className="text-xs text-muted-foreground">
                    Define what this product can be used for in your business.
                </p>
            </div>

            <div className="space-y-2.5">
                {/* Purchasable */}
                <FormField control={form.control} name="purchasable" render={({ field }) => (
                    <FormItem>
                        <Card className={`transition-colors ${purchasable ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'}`}>
                            <CardContent className="p-3.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                    <Box className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <FormLabel className="text-sm font-semibold cursor-pointer mb-0">
                                            Purchasable
                                        </FormLabel>
                                        <FormDescription className="text-xs leading-tight mt-0.5">
                                            Can be received via purchase invoices from suppliers
                                        </FormDescription>
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value ?? true}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </CardContent>
                        </Card>
                    </FormItem>
                )} />

                {/* Available for POS */}
                <FormField control={form.control} name="availableForPOS" render={({ field }) => (
                    <FormItem>
                        <Card className={`transition-colors ${availableForPOS ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'}`}>
                            <CardContent className="p-3.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                    <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <FormLabel className="text-sm font-semibold cursor-pointer mb-0">
                                            Available for POS
                                        </FormLabel>
                                        <FormDescription className="text-xs leading-tight mt-0.5">
                                            Can be sold in point-of-sale transactions
                                        </FormDescription>
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value ?? true}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </CardContent>
                        </Card>
                    </FormItem>
                )} />

                {/* Consumable */}
                <FormField control={form.control} name="consumable" render={({ field }) => (
                    <FormItem>
                        <Card className={`transition-colors ${consumable ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'}`}>
                            <CardContent className="p-3.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                    <Utensils className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <FormLabel className="text-sm font-semibold cursor-pointer mb-0">
                                            Consumable
                                        </FormLabel>
                                        <FormDescription className="text-xs leading-tight mt-0.5">
                                            Can be consumed internally without creating output
                                        </FormDescription>
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value ?? false}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </CardContent>
                        </Card>
                    </FormItem>
                )} />

                {/* Production Output */}
                <FormField control={form.control} name="productionOutput" render={({ field }) => (
                    <FormItem>
                        <Card className={`transition-colors ${productionOutput ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'}`}>
                            <CardContent className="p-3.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                    <Factory className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <FormLabel className="text-sm font-semibold cursor-pointer mb-0">
                                            Production Output
                                        </FormLabel>
                                        <FormDescription className="text-xs leading-tight mt-0.5">
                                            Can be created as output of production/transformation
                                        </FormDescription>
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value ?? false}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </CardContent>
                        </Card>
                    </FormItem>
                )} />

                {/* Available in Menu */}
                <FormField control={form.control} name="availableInMenu" render={({ field }) => (
                    <FormItem>
                        <Card className={`transition-colors ${availableInMenu ? 'border-primary/20 bg-primary/5' : 'bg-muted/30'}`}>
                            <CardContent className="p-3.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                    <Menu className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                        <FormLabel className="text-sm font-semibold cursor-pointer mb-0">
                                            Available in Menu
                                        </FormLabel>
                                        <FormDescription className="text-xs leading-tight mt-0.5">
                                            Can appear as customer-facing menu item
                                        </FormDescription>
                                    </div>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value ?? false}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </CardContent>
                        </Card>
                    </FormItem>
                )} />
            </div>
        </section>
    );
});

ProductCapabilitiesSection.displayName = 'ProductCapabilitiesSection';
