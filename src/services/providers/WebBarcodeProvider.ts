import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';
import { Html5Qrcode } from 'html5-qrcode';

export class WebBarcodeProvider implements BarcodeProvider {
  private html5QrcodeScanner: any = null;

  supported(): boolean {
    return typeof window !== 'undefined' && !!navigator.mediaDevices;
  }

  async scan(options?: BarcodeScannerOptions): Promise<string> {
    if (!options || !options.containerId) {
      throw new Error('Container ID required for web barcode scanner.');
    }
    const containerId = options.containerId;

    return new Promise<string>(async (_resolve, reject) => {
      try {
        this.html5QrcodeScanner = new Html5Qrcode(containerId);

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 70 },
          aspectRatio: 1.777,
        };

        try {
          // Instantly start camera using facingMode constraint without enumerating devices
          await this.html5QrcodeScanner.start(
            { facingMode: 'environment' },
            config,
            (decodedText: string) => {
              if (options.onScan) options.onScan(decodedText);
            },
            () => {}
          );
        } catch (err) {
          // Fall back to enumerating cameras if facingMode: environment fails
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            reject(new Error('No camera found on this device.'));
            return;
          }
          const backCamera = cameras.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('rear') ||
            c.label.toLowerCase().includes('environment')
          ) || cameras[0];

          await this.html5QrcodeScanner.start(
            backCamera.id,
            config,
            (decodedText: string) => {
              if (options.onScan) options.onScan(decodedText);
            },
            () => {}
          );
        }
      } catch (err: any) {
        reject(err);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.html5QrcodeScanner) return;

    try {
      await this.html5QrcodeScanner.stop();
    } catch { }

    try {
      await this.html5QrcodeScanner.clear();
    } catch { }

    this.html5QrcodeScanner = null;
  }
}
export default WebBarcodeProvider;
