import { BarcodeProvider, BarcodeScannerOptions } from './IBarcodeProvider';
import { WebBarcodeProvider } from './providers/WebBarcodeProvider';
import { CapacitorBarcodeProvider } from './providers/CapacitorBarcodeProvider';
import { KeyboardBarcodeProvider } from './providers/KeyboardBarcodeProvider';

// Re-export types for consumers
export type { BarcodeScannerOptions, BarcodeProvider } from './IBarcodeProvider';

class ManualBarcodeProvider implements BarcodeProvider {
  supported() {
    return true;
  }
  async scan(): Promise<string> {
    throw new Error('Barcode scanning not available on this platform.');
  }
}

export class BarcodeService {
  private static providers: Record<string, BarcodeProvider> = {};
  private static activeProviderName = '';

  static register(name: string, provider: BarcodeProvider) {
    this.providers[name] = provider;
  }

  static getActiveProviderName(): string {
    if (this.activeProviderName) return this.activeProviderName;

    const isCapacitor =
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.();

    if (isCapacitor && this.providers['capacitor']?.supported()) {
      this.activeProviderName = 'capacitor';
    } else if (this.providers['web']?.supported()) {
      this.activeProviderName = 'web';
    } else {
      this.activeProviderName = 'manual';
    }
    return this.activeProviderName;
  }

  static getProviderByName(name: string): BarcodeProvider {
    return this.providers[name] || new ManualBarcodeProvider();
  }

  static getProvider(): BarcodeProvider {
    const name = this.getActiveProviderName();
    return this.getProviderByName(name);
  }

  static async scan(options?: BarcodeScannerOptions): Promise<string> {
    return this.getProvider().scan(options);
  }

  static async stop(): Promise<void> {
    for (const provider of Object.values(this.providers)) {
      if (provider.stop) {
        await provider.stop().catch(() => {});
      }
    }
  }
}

// Register all providers
BarcodeService.register('web', new WebBarcodeProvider());
BarcodeService.register('capacitor', new CapacitorBarcodeProvider());
BarcodeService.register('keyboard', new KeyboardBarcodeProvider());
