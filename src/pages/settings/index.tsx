import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { storageService } from '@/storage/StorageService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Upload, Download, AlertTriangle, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { settings, updateSettings, theme, setTheme } = useApp();
  const [formData, setFormData] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    updateSettings(formData);
    toast.success('Settings saved successfully');
  };

  const handleExport = () => {
    const data = storageService.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sohan_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exported successfully');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (confirm('Warning: This will overwrite ALL your current data. Are you sure?')) {
        const success = storageService.importAll(content);
        if (success) {
          toast.success('Data imported successfully. App will reload.');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error('Invalid backup file');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    const confirmText = prompt('This will permanently delete ALL data. Type "RESET" to confirm:');
    if (confirmText === 'RESET') {
      storageService.clearAll();
      toast.success('All data cleared. App will reload.');
      setTimeout(() => window.location.reload(), 1500);
    } else if (confirmText !== null) {
      toast.error('Reset cancelled. Incorrect confirmation word.');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Configure your business details and app preferences</p>
      </div>

      <div className="grid gap-6">
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
                onChange={e => setFormData({...formData, businessName: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input 
                  value={formData.phone} 
                  onChange={e => setFormData({...formData, phone: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">VAT / PAN Number</label>
                <Input 
                  value={formData.vatNumber} 
                  onChange={e => setFormData({...formData, vatNumber: e.target.value})} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
              />
            </div>
          </CardContent>
        </Card>

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
                  onChange={e => setFormData({...formData, currencySymbol: e.target.value})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Tax Rate (%)</label>
                <Input 
                  type="number" 
                  value={formData.taxRate} 
                  onChange={e => setFormData({...formData, taxRate: Number(e.target.value)})} 
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light"><div className="flex items-center gap-2"><Sun className="w-4 h-4"/> Light</div></SelectItem>
                    <SelectItem value="dark"><div className="flex items-center gap-2"><Moon className="w-4 h-4"/> Dark</div></SelectItem>
                    <SelectItem value="system"><div className="flex items-center gap-2"><Monitor className="w-4 h-4"/> System</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} className="w-full md:w-auto">
            <Save className="mr-2 h-5 w-5" /> Save Settings
          </Button>
        </div>

        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" /> Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button variant="outline" onClick={handleExport} className="w-full justify-start h-12">
                <Download className="mr-3 h-5 w-5" /> Export Backup
              </Button>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImport}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full justify-start h-12">
                  <Upload className="mr-3 h-5 w-5" /> Restore Backup
                </Button>
              </div>
            </div>
            <div className="pt-6 border-t">
              <Button variant="destructive" onClick={handleReset} className="w-full">
                <Trash2 className="mr-2 h-5 w-5" /> Factory Reset App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
