import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, Zap } from 'lucide-react';

let Html5Qrcode: typeof import('html5-qrcode').Html5Qrcode | undefined;

async function loadHtml5Qrcode() {
  if (!Html5Qrcode) {
    const module = await import('html5-qrcode');
    Html5Qrcode = module.Html5Qrcode;
  }
  return Html5Qrcode;
}

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
}

export function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>('barcode-scanner-container');

  const startScanner = async () => {
    setError(null);
    setScanning(false);

    try {
      const Html5QrcodeClass = await loadHtml5Qrcode();
      const cameras = await Html5QrcodeClass.getCameras();
      if (!cameras || cameras.length === 0) {
        setError('No camera found on this device.');
        return;
      }

      // Prefer back camera
      const backCamera = cameras.find(c =>
        c.label.toLowerCase().includes('back') ||
        c.label.toLowerCase().includes('rear') ||
        c.label.toLowerCase().includes('environment')
      ) || cameras[cameras.length - 1];

      const scanner = new Html5QrcodeClass(containerRef.current);
      scannerRef.current = scanner;

      await scanner.start(
        backCamera.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777,
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
          setOpen(false);
        },
        (_errorMessage) => {
          // Scan error (no barcode in frame) — ignore
        }
      );
      setScanning(true);
    } catch (err: any) {
      setError(err?.message || 'Camera access denied. Please allow camera permissions.');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current && scanning) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    stopScanner();
    setOpen(false);
    setError(null);
  };

  useEffect(() => {
    if (open) {
      // Small delay to let DOM render the container
      const t = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(t);
    } else {
      stopScanner();
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
