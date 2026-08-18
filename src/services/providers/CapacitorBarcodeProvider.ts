import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';

/**
 * CapacitorBarcodeProvider — Capacitor 8 / MLKit edition.
 *
 * On Android it uses Google ML Kit (native, <100ms decode).
 * On iOS it uses Apple Vision Framework.
 *
 * Plugin: @capacitor-mlkit/barcode-scanning
 * Docs:   https://capawesome.io/plugins/mlkit/barcode-scanning/
 *
 * The plugin is imported via npm so TypeScript gets full types,
 * but it is resolved natively at runtime via Capacitor's bridge.
 */
export class CapacitorBarcodeProvider implements BarcodeProvider {
  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.()
    );
  }

  async scan(_options?: BarcodeScannerOptions): Promise<string> {
    if (!this.supported()) {
      throw new Error('Capacitor native platform not detected.');
    }

    try {
      // Dynamic import — only resolves inside the native Capacitor shell.
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

      // 2. Scan — opens native full-screen viewfinder
      const { barcodes } = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.Code93,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.Itf,
          BarcodeFormat.DataMatrix,
          BarcodeFormat.QrCode,
        ],
      });

      if (!barcodes || barcodes.length === 0) {
        throw new Error('No barcode detected.');
      }

      const value = barcodes[0].rawValue ?? barcodes[0].displayValue ?? '';
      if (!value) throw new Error('Barcode had no readable value.');

      if (_options?.onScan) _options.onScan(value);
      return value;
    } catch (err: any) {
      // If the user cancelled (back button), throw a clean message
      const msg: string = err?.message ?? String(err);
      if (/cancel|user dismiss/i.test(msg)) {
        throw new Error('Scan cancelled.');
      }
      console.warn('[CapacitorBarcodeProvider] scan failed:', msg);
      throw err;
    }
  }

  async stop(): Promise<void> {
    // Native viewfinder is self-managed; nothing to tear down from JS side.
  }
}

export default CapacitorBarcodeProvider;
