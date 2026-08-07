import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';

export class KeyboardBarcodeProvider implements BarcodeProvider {
  private static buffer = '';
  private static lastKeyTime = 0;
  private static listeners = new Set<(barcode: string) => void>();

  static initialize() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      // Ignore input when standard control elements are focused, unless we want to capture scanner output
      // Wedge scanners input characters extremely fast (typically < 30ms apart)
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const now = Date.now();
      const diff = now - KeyboardBarcodeProvider.lastKeyTime;
      KeyboardBarcodeProvider.lastKeyTime = now;

      if (e.key === 'Enter') {
        if (KeyboardBarcodeProvider.buffer.length >= 3 && diff < 50) {
          const barcode = KeyboardBarcodeProvider.buffer;
          KeyboardBarcodeProvider.buffer = '';
          e.preventDefault();
          e.stopPropagation();
          KeyboardBarcodeProvider.listeners.forEach(cb => cb(barcode));
        } else {
          KeyboardBarcodeProvider.buffer = '';
        }
      } else if (e.key && e.key.length === 1) {
        if (diff > 100) {
          KeyboardBarcodeProvider.buffer = e.key;
        } else {
          KeyboardBarcodeProvider.buffer += e.key;
        }
      }
    });
  }

  static addScanListener(cb: (barcode: string) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  supported(): boolean {
    return typeof window !== 'undefined';
  }

  async scan(options?: BarcodeScannerOptions): Promise<string> {
    return new Promise<string>((resolve) => {
      const remove = KeyboardBarcodeProvider.addScanListener((barcode) => {
        if (options?.onScan) options.onScan(barcode);
        resolve(barcode);
        remove();
      });
    });
  }
}

// Auto-initialize keyboard scan listener
KeyboardBarcodeProvider.initialize();

export default KeyboardBarcodeProvider;
