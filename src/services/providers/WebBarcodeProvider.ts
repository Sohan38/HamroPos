import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export class WebBarcodeProvider implements BarcodeProvider {
  private html5QrcodeScanner: Html5Qrcode | null = null;

  supported(): boolean {
    return typeof window !== 'undefined' && !!navigator.mediaDevices;
  }

  async scan(options?: BarcodeScannerOptions): Promise<string> {
    if (!options || !options.containerId) {
      throw new Error('Container ID required for web barcode scanner.');
    }
    const containerId = options.containerId;

    // Only decode formats we actually use — skipping the rest saves significant CPU per frame
    const supportedFormats = [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ];

    return new Promise<string>(async (_resolve, reject) => {
      try {
        this.html5QrcodeScanner = new Html5Qrcode(containerId, {
          formatsToSupport: supportedFormats,
          verbose: false,
        });

        // 24 FPS is the sweet spot: ultra responsive, but 20% less CPU utilization than 30 FPS
        const config = {
          fps: 24,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: true,
        };

        // Track scan timing to prevent rapid duplicates of the same code
        let lastCode = '';
        let lastTime = 0;

        const onSuccess = (decodedText: string) => {
          const trimmed = decodedText.trim();
          if (!trimmed) return;

          const now = Date.now();
          // Rate-limit consecutive identical scans (1.5s cooldown) to prevent spamming
          if (trimmed === lastCode && now - lastTime < 1500) {
            return;
          }
          
          lastCode = trimmed;
          lastTime = now;

          if (options.onScan) {
            options.onScan(trimmed);
          }
        };

        const videoConstraints = {
          facingMode: 'environment',
          // Bounding camera resolution to 1280x720 prevents high-res (e.g. 4K) lagging on mobile
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        };

        try {
          await this.html5QrcodeScanner.start(
            videoConstraints,
            config,
            onSuccess,
            () => {}
          );
        } catch (err) {
          // Fall back to enumerating cameras if facingMode fails
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
            onSuccess,
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
