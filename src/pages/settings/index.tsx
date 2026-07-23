import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { storageService } from '@/storage/StorageService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Save, Upload, Download, AlertTriangle, Monitor, Moon, Sun, Trash2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { seedDemoData } from '@/utils/seedHelper';

import { FeatureConfig } from '@/types';

export default function Settings() {
  const { settings, updateSettings, theme, setTheme } = useApp();
  const [formData, setFormData] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if settings are loaded/restored asynchronously
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Loading & Dialog States
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [pendingImportContent, setPendingImportContent] = useState<string | null>(null);

  const handleSave = () => {
    updateSettings(formData);
    toast.success('Settings saved successfully');
  };

  const handleFeatureToggle = (domain: keyof FeatureConfig, feature: string, checked: boolean) => {
    setFormData(prev => {
      const domainKey = domain as keyof FeatureConfig;
      const domainFeatures = prev.features[domainKey] as Record<string, boolean>;
      const updated = { ...domainFeatures, [feature]: checked };

      // Mutual exclusion: variants ↔ batches/expiry
      if (domainKey === 'inventory' && checked) {
        if (feature === 'variants') {
          updated['batches'] = false;
          updated['expiry'] = false;
        } else if (feature === 'batches' || feature === 'expiry') {
          updated['variants'] = false;
        }
      }

      return {
        ...prev,
        features: {
          ...prev.features,
          [domainKey]: updated
        }
      };
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const data = await storageService.exportAll();
      const filename = `sohan_backup_${new Date().toISOString().split('T')[0]}.json`;
      const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

      if (isNative) {
        try {
          const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
          const result = await Filesystem.writeFile({
            path: filename,
            data: data,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
          });

          toast.success(`Backup saved! File: ${filename}`);

          try {
            const { Share } = await import('@capacitor/share');
            await Share.share({
              title: 'Sohan Backup',
              url: result.uri,
              dialogTitle: 'Share or save backup'
            });
          } catch (_) {}
          return;
        } catch (err) {
          console.error('Native filesystem export failed:', err);
          toast.error('Export failed — storage permission may be needed');
        }
      } else {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Backup exported successfully');
      }
    } catch (err) {
      toast.error('Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPendingImportContent(content);
      setShowImportConfirm(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeImport = async () => {
    if (!pendingImportContent) return;
    setIsImporting(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      const success = await storageService.importAll(pendingImportContent);
      if (success) {
        toast.success('Data imported successfully. App will reload.');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error('Invalid backup file');
      }
    } catch (err) {
      toast.error('Import failed');
    } finally {
      setIsImporting(false);
      setPendingImportContent(null);
    }
  };

  const executeReset = async () => {
    setIsResetting(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      await storageService.clearAll();
      toast.success('All data cleared. App will reload.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Failed to reset data');
    } finally {
      setIsResetting(false);
    }
  };

  const executeSeedDemo = async () => {
    setIsSeeding(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      seedDemoData(true);
      toast.success('Demo data restored successfully. App will reload.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Failed to seed demo data');
    } finally {
      setIsSeeding(false);
    }
  };

  if (!formData || !formData.features) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Configure your business details and app preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Business Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
            <CardDescription>This information appears on invoices and reports.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Business Name</label>
              <Input
                value={formData.businessName}
                onChange={e => setFormData({ ...formData, businessName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">VAT / PAN Number</label>
                <Input
                  value={formData.vatNumber}
                  onChange={e => setFormData({ ...formData, vatNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Localization & Theme */}
        <Card>
          <CardHeader>
            <CardTitle>Localization & Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency Symbol</label>
                <Input
                  value={formData.currencySymbol}
                  onChange={e => setFormData({ ...formData, currencySymbol: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Tax Rate (%)</label>
                <Input
                  type="number"
                  value={formData.taxRate}
                  onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="w-4 h-4" /> Light</div></SelectItem>
                    <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="w-4 h-4" /> Dark</div></SelectItem>
                    <SelectItem value="system"><div className="flex items-center gap-2"><Monitor className="w-4 h-4" /> System</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Toggles */}
        <Card>
          <CardHeader>
            <CardTitle>Enabled Features</CardTitle>
            <CardDescription>Enable or disable functional domains across the application.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Inventory Domain */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Inventory Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Batches Tracking</label>
                    <p className="text-xs text-muted-foreground">Track inventory items in batches</p>
                  </div>
                  <Switch
                    checked={formData.features.inventory.batches}
                    onCheckedChange={c => handleFeatureToggle('inventory', 'batches', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Expiry Dates</label>
                    <p className="text-xs text-muted-foreground">Enforce FEFO based batch expiry</p>
                  </div>
                  <Switch
                    checked={formData.features.inventory.expiry}
                    onCheckedChange={c => handleFeatureToggle('inventory', 'expiry', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Variants</label>
                    <p className="text-xs text-muted-foreground">Manage variable sizes or colors</p>
                  </div>
                  <Switch
                    checked={formData.features.inventory.variants}
                    onCheckedChange={c => handleFeatureToggle('inventory', 'variants', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Serial Numbers</label>
                    <p className="text-xs text-muted-foreground">Track items by unique serials</p>
                  </div>
                  <Switch
                    checked={formData.features.inventory.serialNumbers}
                    onCheckedChange={c => handleFeatureToggle('inventory', 'serialNumbers', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Barcode Support</label>
                    <p className="text-xs text-muted-foreground">Scan item codes during lookup</p>
                  </div>
                  <Switch
                    checked={formData.features.inventory.barcodeSupport}
                    onCheckedChange={c => handleFeatureToggle('inventory', 'barcodeSupport', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Multiple Units</label>
                    <p className="text-xs text-muted-foreground">Enable units of measure configurations</p>
                  </div>
                  <Switch
                    checked={formData.features.inventory.multiUnits}
                    onCheckedChange={c => handleFeatureToggle('inventory', 'multiUnits', c)}
                  />
                </div>
              </div>
            </div>

            {/* Sales Domain */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Sales Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Returns</label>
                    <p className="text-xs text-muted-foreground">Process invoice return receipts</p>
                  </div>
                  <Switch
                    checked={formData.features.sales.returns}
                    onCheckedChange={c => handleFeatureToggle('sales', 'returns', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Credit Sales</label>
                    <p className="text-xs text-muted-foreground">Allow ledger billing for credit balances</p>
                  </div>
                  <Switch
                    checked={formData.features.sales.creditSales}
                    onCheckedChange={c => handleFeatureToggle('sales', 'creditSales', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Discounts</label>
                    <p className="text-xs text-muted-foreground">Allow custom discounts on POS checkout</p>
                  </div>
                  <Switch
                    checked={formData.features.sales.discounts}
                    onCheckedChange={c => handleFeatureToggle('sales', 'discounts', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Layaway</label>
                    <p className="text-xs text-muted-foreground">Support deferred payment holds</p>
                  </div>
                  <Switch
                    checked={formData.features.sales.layaway}
                    onCheckedChange={c => handleFeatureToggle('sales', 'layaway', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Quotations</label>
                    <p className="text-xs text-muted-foreground">Generate pricing quotations sheets</p>
                  </div>
                  <Switch
                    checked={formData.features.sales.quotations}
                    onCheckedChange={c => handleFeatureToggle('sales', 'quotations', c)}
                  />
                </div>
              </div>
            </div>

            {/* Customers Domain */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Customer Accounts</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Loyalty System</label>
                    <p className="text-xs text-muted-foreground">Accrue customer loyalty score points</p>
                  </div>
                  <Switch
                    checked={formData.features.customers.loyalty}
                    onCheckedChange={c => handleFeatureToggle('customers', 'loyalty', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Memberships</label>
                    <p className="text-xs text-muted-foreground">Manage active user tier levels</p>
                  </div>
                  <Switch
                    checked={formData.features.customers.membership}
                    onCheckedChange={c => handleFeatureToggle('customers', 'membership', c)}
                  />
                </div>
              </div>
            </div>

            {/* Hospitality Domain */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Hospitality Modules</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Hotel Booking Grid</label>
                    <p className="text-xs text-muted-foreground">Enable room grids booking menus</p>
                  </div>
                  <Switch
                    checked={formData.features.hospitality.hotelGrid}
                    onCheckedChange={c => handleFeatureToggle('hospitality', 'hotelGrid', c)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Restaurant Billing</label>
                    <p className="text-xs text-muted-foreground">Enable table ordering POS layout</p>
                  </div>
                  <Switch
                    checked={formData.features.hospitality.restaurantBilling}
                    onCheckedChange={c => handleFeatureToggle('hospitality', 'restaurantBilling', c)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} className="w-full md:w-auto">
            <Save className="mr-2 h-5 w-5" /> Save Settings
          </Button>
        </div>

        {/* Data Management */}
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" /> Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" onClick={handleExport} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full justify-start h-12">
                {isExporting ? <Spinner className="mr-3 h-5 w-5" /> : <Download className="mr-3 h-5 w-5" />}
                {isExporting ? 'Exporting...' : 'Export Backup'}
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImportFileChange}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full justify-start h-12">
                  {isImporting ? <Spinner className="mr-3 h-5 w-5" /> : <Upload className="mr-3 h-5 w-5" />}
                  {isImporting ? 'Restoring...' : 'Restore Backup'}
                </Button>
              </div>
              <Button variant="outline" onClick={() => setShowSeedConfirm(true)} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full justify-start h-12 text-primary border-primary/30 hover:bg-primary/5">
                {isSeeding ? <Spinner className="mr-3 h-5 w-5" /> : <Database className="mr-3 h-5 w-5" />}
                {isSeeding ? 'Seeding...' : 'Restore Demo Data'}
              </Button>
            </div>
            <div className="pt-6 border-t">
              <Button variant="destructive" onClick={() => setShowResetConfirm(true)} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full">
                {isResetting ? <Spinner className="mr-2 h-5 w-5" /> : <Trash2 className="mr-2 h-5 w-5" />}
                {isResetting ? 'Resetting...' : 'Factory Reset App'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => {
          setShowImportConfirm(false);
          setPendingImportContent(null);
        }}
        onConfirm={executeImport}
        title="Restore Backup"
        description="Warning: This will overwrite ALL your current data. Are you sure you want to proceed?"
        confirmText="Restore"
      />

      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={executeReset}
        title="Factory Reset App"
        description="This will permanently delete ALL data. Type 'RESET' to confirm:"
        confirmText="Reset"
        requireTextInput="RESET"
      />

      <ConfirmDialog
        isOpen={showSeedConfirm}
        onClose={() => setShowSeedConfirm(false)}
        onConfirm={executeSeedDemo}
        title="Restore Demo Data"
        description="This will clear your current database and load standard demo records (products, sales, customers). Are you sure?"
        confirmText="Load Demo"
      />
    </div>
  );
}
