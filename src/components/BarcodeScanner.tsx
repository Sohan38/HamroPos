import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, Zap } from 'lucide-react';
import { useBackModal } from '@/contexts/NavigationContext';
import { BarcodeService } from '@/services/BarcodeService';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const containerRef = useRef<string>('barcode-scanner-container');

  useBackModal(open, () => setOpen(false), 'barcode-scanner-dialog');

  const startScanner = async () => {
    setError(null);
    setScanning(false);

    const activeProvider = BarcodeService.getActiveProviderName();
    
    if (activeProvider === 'capacitor') {
      try {
        const barcode = await BarcodeService.scan({
          onScan: (val) => {
            onScan(val);
            setOpen(false);
          }
        });
        onScan(barcode);
        setOpen(false);
        return;
      } catch (err: any) {
        console.warn('Native scanner not available, falling back to Web camera...', err);
        // Fall through to Web scanner
      }
    }

    try {
      setScanning(true);
      const webProvider = BarcodeService.getProviderByName('web');
      await webProvider.scan({
        containerId: containerRef.current,
        onScan: (val) => {
          onScan(val);
          setOpen(false);
        },
        onError: (err) => {
          setError(err);
          setScanning(false);
        }
      });
    } catch (err: any) {
      setError(err?.message || 'Scanning could not be initialized.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    BarcodeService.stop().catch(() => {});
    setScanning(false);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const handleClose = () => {
    stopScanner();
    setOpen(false);
    setError(null);
  };

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(t);
    } else {
      stopScanner();
      return undefined;
    }
  }, [open]);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-12 w-12 shrink-0 border-primary/30"
        title="Scan Barcode"
        onClick={handleOpen}
        data-testid="button-barcode-scanner"
      >
        <Camera className="h-5 w-5 text-primary" />
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm w-[95vw] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Scan Barcode
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="px-4 pb-4 space-y-3">
            {error ? (
              <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm text-center space-y-3">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={startScanner}>
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center mb-2">
                Point camera at a barcode or QR code
              </div>
            )}

            {/* Scanner renders into this div */}
            <div
              id={containerRef.current}
              className="w-full rounded-lg overflow-hidden bg-black"
              style={{ minHeight: 200 }}
            />

            {!scanning && !error && (
              <div className="text-center text-sm text-muted-foreground animate-pulse py-4">
                Starting camera...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
