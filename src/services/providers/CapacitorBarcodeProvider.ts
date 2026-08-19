import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';

type NativeBarcode = {
  rawValue?: string | null;
  displayValue?: string | null;
  cornerPoints?: Array<[number, number]>;
};

function barcodeArea(barcode: NativeBarcode): number {
  const points = barcode.cornerPoints ?? [];
  if (points.length < 4) return 0;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

function barcodeCenter(barcode: NativeBarcode): [number, number] | null {
  const points = barcode.cornerPoints ?? [];
  if (points.length === 0) return null;

  return [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, y]) => sum + y, 0) / points.length,
  ];
}

function isInsideGuide(
  barcode: NativeBarcode,
  region?: BarcodeScannerOptions['scanRegion'],
): boolean {
  const center = barcodeCenter(barcode);
  if (!center) return true;
  if (!region) return true;

  return (
    center[0] >= region.left &&
    center[0] <= region.right &&
    center[1] >= region.top &&
    center[1] <= region.bottom
  );
}

function chooseBarcode(
  barcodes: NativeBarcode[],
  region?: BarcodeScannerOptions['scanRegion'],
): NativeBarcode | null {
  const readable = barcodes.filter(barcode => Boolean((barcode.rawValue || barcode.displayValue || '').trim()));
  const candidates = readable.filter(barcode => isInsideGuide(barcode, region));
  if (candidates.length === 0) return null;

  const target = region
    ? [(region.left + region.right) / 2, (region.top + region.bottom) / 2]
    : [640, 360];

  // Prefer the barcode closest to the centre guide, then the largest readable target.
  return [...candidates].sort((left, right) => {
    const leftCenter = barcodeCenter(left);
    const rightCenter = barcodeCenter(right);
    const leftDistance = leftCenter ? Math.hypot(leftCenter[0] - target[0], leftCenter[1] - target[1]) : Infinity;
    const rightDistance = rightCenter ? Math.hypot(rightCenter[0] - target[0], rightCenter[1] - target[1]) : Infinity;
    return leftDistance - rightDistance || barcodeArea(right) - barcodeArea(left);
  })[0] ?? null;
}

export class CapacitorBarcodeProvider implements BarcodeProvider {
  private activeCleanup: (() => Promise<void>) | null = null;
  private activeReject: ((reason?: unknown) => void) | null = null;

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.()
    );
  }

  async scan(options?: BarcodeScannerOptions): Promise<string> {
    if (!this.supported()) {
      throw new Error('Capacitor native platform not detected.');
    }

    try {
      const { BarcodeScanner, BarcodeFormat, LensFacing, Resolution } =
        await import('@capacitor-mlkit/barcode-scanning');

      // 1. Ensure camera permission
      let { camera } = await BarcodeScanner.checkPermissions();
      if (camera === 'prompt' || camera === 'prompt-with-rationale') {
        const result = await BarcodeScanner.requestPermissions();
        camera = result.camera;
      }
      if (camera !== 'granted') {
        throw new Error('Camera permission was denied. Please enable it in device Settings.');
      }

      // 2. Hide WebView backgrounds to show native camera view behind it
      document.body.classList.add('barcode-scanner-active');

      return new Promise<string>(async (resolve, reject) => {
        let listener: any = null;

        const cleanup = async () => {
          if (this.activeCleanup !== cleanup) return;
          this.activeCleanup = null;
          this.activeReject = null;
          document.body.classList.remove('barcode-scanner-active');
          if (listener) {
            await listener.remove().catch(() => { });
            listener = null;
          }
          await BarcodeScanner.stopScan().catch(() => { });
        };

        this.activeCleanup = cleanup;
        this.activeReject = reject;

        let lockedCode = '';
        let hasResolved = false;

        try {
          // Listen for detected barcodes
          listener = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
            const barcodes = (event.barcodes || []) as NativeBarcode[];
            const selected = chooseBarcode(barcodes, options?.scanRegion);
            const visibleCodes = new Set(
              barcodes.map(barcode => (barcode.rawValue || barcode.displayValue || '').trim()).filter(Boolean),
            );

            if (!selected) {
              lockedCode = '';
              return;
            }

            const val = (selected.rawValue || selected.displayValue || '').trim();
            if (options?.autoClose === false && lockedCode) {
              if (visibleCodes.has(lockedCode)) return;
              lockedCode = '';
            }
            if (!val || hasResolved || (options?.autoClose === false && val === lockedCode)) return;

            lockedCode = val;
            if (options?.onScan) {
              await options.onScan(val);
            }

            if (options?.autoClose !== false) {
              hasResolved = true;
              await cleanup();
              resolve(val);
            }
          });

          // Start scanning
          await BarcodeScanner.startScan({
            lensFacing: LensFacing.Back,
            resolution: Resolution['1280x720'],
            formats: [
              BarcodeFormat.Ean13,
              BarcodeFormat.Ean8,
              BarcodeFormat.Code128,
              BarcodeFormat.Code39,
              BarcodeFormat.Code93,
              BarcodeFormat.UpcA,
              BarcodeFormat.UpcE,
              BarcodeFormat.Itf,
            ],
          });
        } catch (err) {
          await cleanup();
          reject(err);
        }
      });
    } catch (err: any) {
      document.body.classList.remove('barcode-scanner-active');
      const msg: string = err?.message ?? String(err);
      if (/cancel|stopped/i.test(msg)) {
        throw new Error('Scan cancelled.');
      }
      throw err;
    }
  }

  async stop(): Promise<void> {
    const cleanup = this.activeCleanup;
    const reject = this.activeReject;
    if (cleanup) await cleanup().catch(() => { });
    if (reject) reject(new Error('Scanner stopped.'));

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      document.body.classList.remove('barcode-scanner-active');
      await BarcodeScanner.stopScan().catch(() => { });
    } catch { }
  }
}

export default CapacitorBarcodeProvider;
