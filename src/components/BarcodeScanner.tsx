import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, Zap } from 'lucide-react';
import { useBackModal } from '@/contexts/NavigationContext';
import { BarcodeService } from '@/services/BarcodeService';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  className?: string;
  autoClose?: boolean;
}

export function BarcodeScanner({ onScan, className, autoClose = true }: BarcodeScannerProps) {
  const startingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const containerId = 'barcode-scanner-container';
  
  // Track last scan to prevent rapid duplicate scanner triggers on same item
  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime); // Crisp, high confirm pitch
      
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12); // Short beep
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (err) {
      console.warn('Audio feedback failed:', err);
    }
  };

  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

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

    const processScan = async (barcode: string) => {
      const trimmed = barcode.trim();
      if (!trimmed) return;

      // Prevent immediate duplicate scans of the SAME barcode (1.5s cooldown)
      const now = Date.now();
      if (!autoClose && trimmed === lastCodeRef.current && now - lastTimeRef.current < 1500) {
        return;
      }
      
      lastCodeRef.current = trimmed;
      lastTimeRef.current = now;

      playBeep();
      onScanRef.current(trimmed);

      if (autoClose) {
        startingRef.current = false;
        await handleClose();
      }
    };

    // --- Capacitor native path ---
    if (activeProvider === 'capacitor') {
      try {
        const barcode = await BarcodeService.scan();

        if (barcode) {
          await processScan(barcode);
          // Successful native scan — don't fall through to web scanner
          return;
        }
      } catch (err: any) {
        console.warn('Native scanner not available, falling back to Web camera...', err);
        // Fall through to web scanner below
      }
      // Reset so web scanner path can proceed
      startingRef.current = false;
    }

    // --- Web camera path ---
    try {
      const webProvider = BarcodeService.getProviderByName('web');
      if (!webProvider.supported()) {
        throw new Error('Camera is not available on this device. Check browser permissions and try again.');
      }

      startingRef.current = true;
      setScanning(true);
      await webProvider.scan({
        containerId,
        onScan: async (val) => {
          await processScan(val);
        },
        onError: (err) => {
          setError(err);
          setScanning(false);
        }
      });
    } catch (err: any) {
      startingRef.current = false;
      const msg = err?.message || String(err);
      if (msg === 'Scanner stopped.') {
        return;
      }
      console.error('[BarcodeScanner] Web scanner error:', msg);
      setError(msg || 'Scanning could not be initialized.');
      setScanning(false);
    }
  }, [autoClose]);


  const handleClose = async () => {
    await stopScanner();
    setOpen(false);
    setError(null);
    lastCodeRef.current = '';
    lastTimeRef.current = 0;
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
      // Start immediately — no artificial delay
      startScanner();
    } else {
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
              className="mx-auto w-full max-w-[320px] aspect-square rounded-xl overflow-hidden bg-black"

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
