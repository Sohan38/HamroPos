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

  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {}
  };

  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const stopScanner = async () => {
    await BarcodeService.stop().catch(() => {});
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
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

      const now = Date.now();
      if (!autoClose && trimmed === lastCodeRef.current && now - lastTimeRef.current < 1500) return;

      lastCodeRef.current = trimmed;
      lastTimeRef.current = now;

      playBeep();
      onScanRef.current(trimmed);

      if (autoClose) {
        startingRef.current = false;
        await handleClose();
      }
    };

    // --- Capacitor native path (MLKit) ---
    if (activeProvider === 'capacitor') {
      try {
        setScanning(true);
        const barcode = await BarcodeService.scan();
        if (barcode) {
          await processScan(barcode);
          return;
        }
      } catch (err: any) {
        setScanning(false);
        if (/cancel|stopped/i.test(err?.message ?? '')) {
          startingRef.current = false;
          return;
        }
        console.warn('Native scanner failed, falling back to web camera:', err);
        startingRef.current = false;
      }
    }

    // --- Web camera path (@zxing/library) ---
    try {
      const webProvider = BarcodeService.getProviderByName('web');
      if (!webProvider.supported()) {
        throw new Error('Camera is not available on this device.');
      }

      startingRef.current = true;
      setScanning(true);

      await webProvider.scan({
        containerId,
        onScan: async (val) => { await processScan(val); },
        onError: (err) => { setError(err); setScanning(false); },
      });
    } catch (err: any) {
      startingRef.current = false;
      const msg = err?.message || String(err);
      if (msg === 'Scanner stopped.') return;
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
    if (open) startScanner();
    else stopScanner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => { BarcodeService.stop().catch(() => {}); };
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
          if (nextOpen) setOpen(true);
          else handleClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="w-[95vw] max-w-[420px] p-0 overflow-hidden rounded-2xl"
        >
          <DialogHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-primary" /> Scan Barcode
            </DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="px-4 pb-4 space-y-3">
            {error ? (
              <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm text-center space-y-3">
                <p>{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { startingRef.current = false; startScanner(); }}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Hold barcode horizontally in the centre of the frame
              </p>
            )}

            {/* ── Scanner viewport with blur surround ── */}
            <div
              className={`relative w-full overflow-hidden rounded-xl ${
                BarcodeService.getActiveProviderName() === 'capacitor' ? 'bg-transparent' : 'bg-black'
              }`}
              style={{ aspectRatio: '4/3' }}
            >
              {/* Camera feed container — ZXing injects <video> here on Web/Desktop */}
              {BarcodeService.getActiveProviderName() !== 'capacitor' && (
                <div
                  id={containerId}
                  className="absolute inset-0 w-full h-full"
                />
              )}

              {/* Dark blur overlay — four strips leaving a clear centre window */}
              {scanning && (
                <>
                  {/* Top */}
                  <div className="absolute inset-x-0 top-0 h-[28%] bg-black/60 backdrop-blur-sm" />
                  {/* Bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-[28%] bg-black/60 backdrop-blur-sm" />
                  {/* Left */}
                  <div className="absolute top-[28%] bottom-[28%] left-0 w-[8%] bg-black/60 backdrop-blur-sm" />
                  {/* Right */}
                  <div className="absolute top-[28%] bottom-[28%] right-0 w-[8%] bg-black/60 backdrop-blur-sm" />

                  {/* ── Corner brackets ── */}
                  {/* Top-left */}
                  <div className="absolute" style={{ top: 'calc(28% - 1px)', left: 'calc(8% - 1px)' }}>
                    <div className="w-6 h-0.5 bg-primary" />
                    <div className="w-0.5 h-6 bg-primary" />
                  </div>
                  {/* Top-right */}
                  <div className="absolute flex flex-col items-end" style={{ top: 'calc(28% - 1px)', right: 'calc(8% - 1px)' }}>
                    <div className="w-6 h-0.5 bg-primary" />
                    <div className="w-0.5 h-6 bg-primary ml-auto" />
                  </div>
                  {/* Bottom-left */}
                  <div className="absolute flex flex-col-reverse" style={{ bottom: 'calc(28% - 1px)', left: 'calc(8% - 1px)' }}>
                    <div className="w-6 h-0.5 bg-primary" />
                    <div className="w-0.5 h-6 bg-primary" />
                  </div>
                  {/* Bottom-right */}
                  <div className="absolute flex flex-col-reverse items-end" style={{ bottom: 'calc(28% - 1px)', right: 'calc(8% - 1px)' }}>
                    <div className="w-6 h-0.5 bg-primary" />
                    <div className="w-0.5 h-6 bg-primary ml-auto" />
                  </div>

                  {/* ── Laser scan line ── */}
                  <div
                    className="absolute left-[8%] right-[8%] h-px"
                    style={{
                      top: '50%',
                      background: 'linear-gradient(90deg, transparent, hsl(197 71% 35%), hsl(197 71% 60%), hsl(197 71% 35%), transparent)',
                      boxShadow: '0 0 6px 1px hsl(197 71% 50% / 0.6)',
                      animation: 'laserSweep 1.8s ease-in-out infinite',
                    }}
                  />
                </>
              )}

              {/* Starting state */}
              {!scanning && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-xs text-white/60 animate-pulse">Starting camera…</p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              EAN-13 · Code-128 · UPC · Code-39 and more
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Laser sweep keyframe — injected once */}
      <style>{`
        @keyframes laserSweep {
          0%   { top: 30%; opacity: 0.5; }
          50%  { top: 70%; opacity: 1;   }
          100% { top: 30%; opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
