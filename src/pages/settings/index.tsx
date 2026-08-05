import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStorageProvider } from '@/storage/StorageContext';
import { FeatureConfig } from '@/types';
import LicenseCard from './License';
import { useLicense } from '@/license/LicenseContext';
import { Save, Upload, Download, AlertTriangle, Monitor, Moon, Sun, Trash2, Database, Building, Globe, Key, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { seedDemoData } from '@/utils/seedHelper';

export default function Settings() {
  const { settings, updateSettings, theme, setTheme } = useApp();
  const { checkFeature } = useLicense();
  const storage = useStorageProvider();
  const [formData, setFormData] = useState(settings);
  const [activeTab, setActiveTab] = useState('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if settings are loaded/restored asynchronously
  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Check if settings have unsaved modifications
  const isDirty = JSON.stringify(formData) !== JSON.stringify(settings);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const data = await storage.exportAll();
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
      const success = await storage.importAll(pendingImportContent);
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
      await storage.clearAll();
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
      await seedDemoData(true);
      toast.success('Demo data restored successfully. App will reload.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error('Failed to seed demo data');
    } finally {
      setIsSeeding(false);
    }
  };

  if (!formData) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-4xl mx-auto pb-28 md:pb-6">
      {/* Header section optimized for scanning */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" /> Settings
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Configure default variables and device activations.
          </p>
        </div>
        {/* Desktop Save Button (hidden on mobile to prevent clutter) */}
        <div className="hidden sm:block">
          <Button onClick={handleSave} size="default" className="shadow-sm">
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        {/* Horizontal overflow scrollable tab bar for mobile viewports */}
        <div className="w-full overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="flex w-max sm:w-full border border-border bg-muted/40 p-1 rounded-lg gap-1 min-w-full">
            <TabsTrigger value="profile" className="flex-1 min-w-[80px] sm:min-w-0 flex items-center justify-center gap-1.5 text-xs py-2 px-3">
              <Building className="h-3.5 w-3.5" /> Profile
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex-1 min-w-[90px] sm:min-w-0 flex items-center justify-center gap-1.5 text-xs py-2 px-3">
              <Globe className="h-3.5 w-3.5" /> Preferences
            </TabsTrigger>
            <TabsTrigger value="license" className="flex-1 min-w-[80px] sm:min-w-0 flex items-center justify-center gap-1.5 text-xs py-2 px-3">
              <Key className="h-3.5 w-3.5" /> Activation
            </TabsTrigger>
            <TabsTrigger value="data" className="flex-1 min-w-[85px] sm:min-w-0 flex items-center justify-center gap-1.5 text-xs py-2 px-3">
              <Database className="h-3.5 w-3.5" /> Database
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Profile */}
        <TabsContent value="profile" className="outline-none space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Business Profile</CardTitle>
              <CardDescription className="text-xs">Receipt invoice billing info.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Business Name</label>
                <Input
                  className="h-10 sm:h-11 text-sm"
                  value={formData.businessName}
                  onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Phone Number</label>
                  <Input
                    type="tel"
                    className="h-10 sm:h-11 text-sm"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">VAT / PAN Number</label>
                  <Input
                    className="h-10 sm:h-11 text-sm"
                    value={formData.vatNumber}
                    onChange={e => setFormData({ ...formData, vatNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Address</label>
                <Input
                  className="h-10 sm:h-11 text-sm"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Preferences */}
        <TabsContent value="preferences" className="outline-none space-y-4">
          <Card className="border border-border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Defaults & Localization</CardTitle>
              <CardDescription className="text-xs">Manage system configurations and symbols.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Currency Symbol</label>
                  <Input
                    className="h-10 sm:h-11 text-sm"
                    value={formData.currencySymbol}
                    onChange={e => setFormData({ ...formData, currencySymbol: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Currency Code</label>
                  <Input
                    className="h-10 sm:h-11 text-sm"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Default VAT / Tax (%)</label>
                  <Input
                    type="number"
                    className="h-10 sm:h-11 text-sm"
                    value={formData.taxRate}
                    onChange={e => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Low Stock Threshold</label>
                  <Input
                    type="number"
                    className="h-10 sm:h-11 text-sm"
                    value={formData.lowStockThreshold}
                    onChange={e => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Theme</label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="h-10 sm:h-11">
                      <SelectValue placeholder="Select Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <span className="flex items-center gap-2"><Sun className="h-4 w-4 text-amber-500" /> Light</span>
                      </SelectItem>
                      <SelectItem value="dark">
                        <span className="flex items-center gap-2"><Moon className="h-4 w-4 text-blue-400" /> Dark</span>
                      </SelectItem>
                      <SelectItem value="system">
                        <span className="flex items-center gap-2"><Monitor className="h-4 w-4" /> System</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">System Language</label>
                  <Select value={formData.language} onValueChange={val => setFormData({ ...formData, language: val })}>
                    <SelectTrigger className="h-10 sm:h-11">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ne">Nepali</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Activation */}
        <TabsContent value="license" className="outline-none">
          <LicenseCard />
        </TabsContent>

        {/* Tab 4: Database Operations */}
        <TabsContent value="data" className="outline-none space-y-4">
          <Card className="border-orange-200 dark:border-orange-950/40">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-base sm:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" /> Data Backup & Recovery
              </CardTitle>
              <CardDescription className="text-xs">Export backups, restore previous databases, or run resets.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button variant="outline" onClick={handleExport} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full justify-start h-12 text-xs">
                  {isExporting ? <Spinner className="mr-3 h-4 w-4" /> : <Download className="mr-3 h-4 w-4" />}
                  {isExporting ? 'Exporting...' : 'Export Backup JSON'}
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImportFileChange}
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full justify-start h-12 text-xs">
                    {isImporting ? <Spinner className="mr-3 h-4 w-4" /> : <Upload className="mr-3 h-4 w-4" />}
                    {isImporting ? 'Restoring...' : 'Restore Backup File'}
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setShowSeedConfirm(true)} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full justify-start h-12 text-xs text-primary border-primary/20 hover:bg-primary/5">
                  {isSeeding ? <Spinner className="mr-3 h-4 w-4" /> : <Database className="mr-3 h-4 w-4" />}
                  {isSeeding ? 'Seeding...' : 'Load Demo Database'}
                </Button>
              </div>
              <div className="pt-4 border-t border-border mt-2">
                <Button variant="destructive" onClick={() => setShowResetConfirm(true)} disabled={isExporting || isImporting || isResetting || isSeeding} className="w-full h-11 text-xs">
                  {isResetting ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  {isResetting ? 'Resetting Database...' : 'Factory Reset Database'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating Bottom Sticky Action Bar for Mobile Screens (rendered above BottomNav) */}
      <div className="sm:hidden fixed bottom-16 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border p-3 flex justify-end z-30 shadow-md">
        <Button onClick={handleSave} size="default" className="w-full h-11 text-sm shadow-md font-medium flex items-center justify-center gap-2">
          <Save className="h-4 w-4" /> Save Changes
        </Button>
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
