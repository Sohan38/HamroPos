import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';

export class CapacitorBarcodeProvider implements BarcodeProvider {
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
      const { BarcodeScanner, BarcodeFormat } =
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

      // 2. Hide WebView background to show camera beneath
      document.body.classList.add('barcode-scanner-active');

      return new Promise<string>(async (resolve, reject) => {
        let listener: any = null;
        
        const cleanup = async () => {
          document.body.classList.remove('barcode-scanner-active');
          if (listener) {
            await listener.remove().catch(() => {});
          }
          await BarcodeScanner.stopScan().catch(() => {});
        };

        try {
          // Listen for detected barcodes (using 'barcodesScanned' for version compatibility)
          listener = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
            const barcodes = event.barcodes || [];
            if (barcodes.length > 0) {
              const firstBarcode = barcodes[0];
              const val = firstBarcode.rawValue || firstBarcode.displayValue || '';
              if (val) {
                await cleanup();
                if (options?.onScan) options.onScan(val);
                resolve(val);
              }
            }
          });

          // Start scanning
          await BarcodeScanner.startScan({
            formats: [
              BarcodeFormat.Ean13,
              BarcodeFormat.Ean8,
              BarcodeFormat.Code128,
              BarcodeFormat.Code39,
              BarcodeFormat.Code93,
              BarcodeFormat.UpcA,
              BarcodeFormat.UpcE,
              BarcodeFormat.Itf,
              BarcodeFormat.QrCode,
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
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      document.body.classList.remove('barcode-scanner-active');
      await BarcodeScanner.stopScan().catch(() => {});
    } catch {}
  }
}

export default CapacitorBarcodeProvider;
