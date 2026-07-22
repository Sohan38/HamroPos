import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';

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
    const { Html5Qrcode } = await import('html5-qrcode');

    return new Promise<string>(async (resolve, reject) => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          reject(new Error('No camera found on this device.'));
          return;
        }

        const backCamera = cameras.find(c =>
          c.label.toLowerCase().includes('back') ||
          c.label.toLowerCase().includes('rear') ||
          c.label.toLowerCase().includes('environment')
        ) || cameras[cameras.length - 1];

        this.html5QrcodeScanner = new Html5Qrcode(containerId);

        await this.html5QrcodeScanner.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777,
          },
          (decodedText: string) => {
            if (options.onScan) options.onScan(decodedText);
            resolve(decodedText);
            this.stop().catch(() => {});
          },
          (errorMessage: string) => {
            // Ignore scan errors (normal feed polling)
          }
        );
      } catch (err: any) {
        reject(err);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.html5QrcodeScanner && this.html5QrcodeScanner.isScanning) {
      await this.html5QrcodeScanner.stop();
      this.html5QrcodeScanner = null;
    }
  }
}
export default WebBarcodeProvider;
