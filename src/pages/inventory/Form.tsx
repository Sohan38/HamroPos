import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Form } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useSmartBack } from '@/contexts/NavigationContext';
import { StepFormContainer } from '@/components/ui/StepFormContainer';
import { BatchFormDialog } from '@/components/BatchFormDialog';
import { SupplierFormDialog } from '@/components/SupplierFormDialog';
import { useInventoryForm } from './Form/hooks/useInventoryForm';
import { useInventoryFormSteps } from './Form/hooks/useInventoryFormSteps';
import { useInventoryFooter } from './Form/hooks/useInventoryFooter';
import { ProductFormValues } from './Form/types';

export default function InventoryForm() {
  const goBack = useSmartBack('/inventory');
  const [location, setLocation] = useLocation();
  const { id } = useParams();
  const isNew = !id || id === 'new';

  const query = typeof window !== 'undefined' && window.location.search
    ? window.location.search.slice(1)
    : '';
  const queryParams = new URLSearchParams(query);
  const supplierIdFromQuery = queryParams.get('supplierId');
  const returnTo = queryParams.get('returnTo');

  const existingProduct = null; // placeholder – you can derive this later if needed

  const {
    form,
    isNew: isNewFlag,
    existingProduct: existingProd,
    hasExpiry,
    hasVariants,
    isMultiSupplier,
    showPurchaseCreationSection,
    suppliers,
    purchases,
    watchedSupplierIds,
    existingCategories,
    existingBrands,
    existingProductNameLookup,
    averagePurchaseRate,
    totalBatchQuantity,
    totalVariantQuantity,
    totalSupplierStockQuantity,
    warnings,
    localBatches,
    batchDialogOpen,
    editingBatch,
    nextBatchNumber,
    handleToggleExpiry,
    handleToggleVariants,
    handleAddBatch,
    handleEditBatch,
    handleDeleteBatch,
    handleSaveBatch,
    setBatchDialogOpen,
    supplierPresetName,
    setSupplierPresetName,
    supplierDialogOpen,
    setSupplierDialogOpen,
    supplierPurchaseDrafts,
    updatePurchaseDraft,
    isBatchesEnabled,
    isExpiryEnabled,
    isVariantsEnabled,
    onSubmit,
  } = useInventoryForm(isNew, existingProduct, supplierIdFromQuery, returnTo);

  const [activeStep, setActiveStep] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const { stepsWithReview, stepErrorsWithUI } = useInventoryFormSteps(
    form,
    {
      isNew: isNewFlag,
      existingProduct: existingProd,
      existingCategories,
      existingBrands,
      existingProductNameLookup,
      isExpiryEnabled,
      isBatchesEnabled,
      hasExpiry,
      handleToggleExpiry,
      localBatches,
      handleAddBatch,
      handleEditBatch,
      handleDeleteBatch,
      isVariantsEnabled,
      hasVariants,
      handleToggleVariants,
      suppliers,
      purchases,
      watchedSupplierIds,
      averagePurchaseRate,
      isMultiSupplier,
      totalBatchQuantity,
      totalVariantQuantity,
      totalSupplierStockQuantity,
      showPurchaseCreationSection,
      purchaseSupplierIds: watchedSupplierIds.length > 0 ? watchedSupplierIds : (supplierIdFromQuery ? [supplierIdFromQuery] : []),
      supplierPurchaseDrafts,
      updatePurchaseDraft,
      setSupplierPresetName,
      setSupplierDialogOpen,
    },
    setActiveStep
  );

  const totalSteps = stepsWithReview.length;

  const footer = useInventoryFooter(
    activeStep,
    totalSteps,
    goBack,
    setActiveStep,
    stepErrorsWithUI,
    form,
    isMobile
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {isNew ? 'Add Product' : 'Edit Product'}
        </h1>
        <p className="text-muted-foreground">
          {isNew ? 'Create a new item in your inventory catalog' : 'Modify existing product specifications'}
        </p>
      </div>

      {warnings.length > 0 && (
        <Alert variant="default" className="border-orange-200 bg-orange-50/50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-950 font-medium">
            <ul className="list-disc pl-4 space-y-1 text-xs">
              {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <StepFormContainer
            steps={stepsWithReview}
            activeStep={activeStep}
            onStepChange={setActiveStep}
            footer={footer}
            stepErrors={stepErrorsWithUI}
            isMobile={isMobile}
          />
        </form>
      </Form>

      <BatchFormDialog
        open={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        onSave={handleSaveBatch}
        editBatch={editingBatch}
        isNew={isNewFlag}
        nextBatchNumber={nextBatchNumber}
        suppliers={suppliers}
        productId={existingProd?.id || ''}
        productName={form.getValues('name') || ''}
        existingBatches={localBatches}
        existingPurchases={purchases}
      />

      <SupplierFormDialog
        open={supplierDialogOpen}
        onClose={() => { setSupplierDialogOpen(false); setSupplierPresetName(''); }}
        defaultName={supplierPresetName}
        onSuccess={(newSupplierId) => {
          const currentIds = form.getValues('supplierIds') ?? [];
          if (!currentIds.includes(newSupplierId)) {
            const currentStocks = form.getValues('supplierStocks') ?? [];
            const newStocks = [...currentStocks, { supplierId: newSupplierId, cost: 0, stock: 0, supplierSku: '', reorderLevel: undefined, notes: '' }];
            form.setValue('supplierIds', [...currentIds, newSupplierId], { shouldDirty: true });
            form.setValue('supplierStocks', newStocks, { shouldDirty: true });
          }
          setSupplierDialogOpen(false);
        }}
      />
    </div>
  );
}