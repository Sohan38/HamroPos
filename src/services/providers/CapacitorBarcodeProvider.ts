import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';

/**
 * Uses Capacitor's native plugin registry at runtime.
 * No npm dependency required — the plugin is resolved from
 * window.Capacitor.Plugins when running inside a native shell.
 */
export class CapacitorBarcodeProvider implements BarcodeProvider {
  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.()
    );
  }

  private getPlugin(): any {
    return (window as any).Capacitor?.Plugins?.BarcodeScanner ?? null;
  }

  async scan(options?: BarcodeScannerOptions): Promise<string> {
    const plugin = this.getPlugin();
    if (!plugin) {
      throw new Error('Capacitor BarcodeScanner plugin is not available.');
    }

    try {
      // Request camera permission robustly
      let status = await plugin.checkPermissions().catch(() => null);
      if (!status || status.camera !== 'granted') {
        status = await plugin.requestPermissions().catch(() => null);
        if (!status || status.camera !== 'granted') {
          status = await plugin.requestPermissions({ permissions: ['camera'] }).catch(() => null);
        }
      }

      if (status && status.camera !== 'granted') {
        throw new Error('Camera permission was not granted.');
      }

      const result = await plugin.scan();
      if (result?.barcodes?.length > 0) {
        const text = result.barcodes[0].displayValue;
        if (options?.onScan) options.onScan(text);
        return text;
      }
      throw new Error('No barcode detected.');
    } catch (e: any) {
      console.warn('Capacitor barcode scan failed:', e);
      throw e;
    }
  }
}
export default CapacitorBarcodeProvider;
