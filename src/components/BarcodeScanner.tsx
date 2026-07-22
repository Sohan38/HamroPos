import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, Zap } from 'lucide-react';
import { useBackModal } from '@/contexts/NavigationContext';
import { BarcodeService } from '@/services/BarcodeService';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  className?: string;
}

export function BarcodeScanner({ onScan, className }: BarcodeScannerProps) {
  const startingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const containerId = 'barcode-scanner-container';

  const stopScanner = async () => {
    await BarcodeService.stop().catch(() => { });

    const el = document.getElementById(containerId);

    if (el) {
      el.innerHTML = "";
    }

    startingRef.current = false;
    setScanning(false);
  };
  const startScanner = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setError(null);
    setScanning(false);

    const activeProvider = BarcodeService.getActiveProviderName();

    if (activeProvider === 'capacitor') {
      try {
        const barcode = await BarcodeService.scan();

        if (barcode) {
          onScan(barcode);
          await handleClose();
        }

      } catch (err: any) {
        startingRef.current = false;
        console.warn('Native scanner not available, falling back to Web camera...', err);
        // Fall through to Web scanner
      } finally {
        startingRef.current = false;
      }
    }

    try {
      setScanning(true);
      const webProvider = BarcodeService.getProviderByName('web');
      await webProvider.scan({
        containerId,
        onScan: async (val) => {
          onScan(val);
          startingRef.current = false;
          await handleClose();
        },
        onError: (err) => {
          setError(err);
          setScanning(false);
        }
      });
    } catch (err: any) {
      startingRef.current = false;
      setError(err?.message || 'Scanning could not be initialized.');
      setScanning(false);
    }
  }, [onScan]);


  const handleClose = async () => {
    await stopScanner();
    setOpen(false);
    setError(null);
  };

  useBackModal(open, handleClose, 'barcode-scanner-dialog');

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setError(null);
    setOpen(true);
  };

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [open, startScanner]);

  useEffect(() => {
    return () => {
      BarcodeService.stop().catch(() => { });
    };
  }, []);


  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`shrink-0 border-primary/30 ${className ?? 'h-12 w-12'}`}
        title="Scan Barcode"
        onClick={handleOpen}
        data-testid="button-barcode-scanner"
      >
        <Camera className="h-5 w-5 text-primary" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setOpen(true);
          } else {
            handleClose();
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[92vw] max-w-[360px] p-0 overflow-hidden rounded-2xl"
        >
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    startingRef.current = false;
                    startScanner();
                  }}
                >
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
              id={containerId}
              className="mx-auto w-full max-w-[320px] aspect-video rounded-xl overflow-hidden bg-black"

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
