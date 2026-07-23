import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

export class WebBarcodeProvider implements BarcodeProvider {
  private html5QrcodeScanner: Html5Qrcode | null = null;
  private transitionMutex: Promise<any> = Promise.resolve();
  private activeScanOptions: BarcodeScannerOptions | null = null;
  private activeResolve: ((val: string) => void) | null = null;
  private activeReject: ((err: any) => void) | null = null;

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  private async runLocked<T>(action: () => Promise<T>): Promise<T> {
    const next = this.transitionMutex.then(action);
    this.transitionMutex = next.then(
      () => {},
      () => {}
    );
    return next;
  }

  async scan(options?: BarcodeScannerOptions): Promise<string> {
    if (!options || !options.containerId) {
      throw new Error('Container ID required for web barcode scanner.');
    }
    const containerId = options.containerId;

    // 1. Stop any existing scan first (runs in lock).
    // This correctly rejects the PREVIOUS activeResolve/activeReject.
    await this.runLocked(async () => {
      if (this.html5QrcodeScanner) {
        try {
          const state = this.html5QrcodeScanner.getState();
          if (state === 2) { // SCANNING
            // Already scanning, we will reuse it.
            return;
          }
        } catch {
          // Proceed to clean restart if state check fails
        }
      }
      await this.stopInternal();
    });

    // 2. Now that the previous scan is completely cleaned up,
    // register the new options and create the new result promise.
    this.activeScanOptions = options;
    const scanResultPromise = new Promise<string>((resolve, reject) => {
      this.activeResolve = resolve;
      this.activeReject = reject;
    });

    // 3. Start the camera under the lock
    await this.runLocked(async () => {
      // Double check if another scan call already started it
      if (this.html5QrcodeScanner) {
        try {
          const state = this.html5QrcodeScanner.getState();
          if (state === 2) {
            return;
          }
        } catch {}
      }

      // Ensure the container element exists in the DOM
      const containerEl = document.getElementById(containerId);
      if (!containerEl) {
        const errorMsg = 'Scanner container not ready. Please close and try again.';
        if (this.activeReject) this.activeReject(new Error(errorMsg));
        throw new Error(errorMsg);
      }

      // Wait until the container has actual dimensions (dialog animation may still be running)
      let dimensionRetries = 0;
      while (dimensionRetries < 30) {
        const rect = containerEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) break;
        await new Promise(r => setTimeout(r, 100));
        dimensionRetries++;
      }

      // Probe camera access up-front to trigger permission dialog and catch specific errors
      try {
        const probeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        probeStream.getTracks().forEach(t => t.stop());
      } catch (probeErr: any) {
        const name = probeErr?.name || '';
        let errorMsg = `Camera error: ${probeErr?.message || probeErr}`;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          errorMsg = 'Camera permission was denied. Please allow camera access in settings and try again.';
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          errorMsg = 'No camera found on this device.';
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          errorMsg = 'Camera is already in use by another app. Please close other camera apps and try again.';
        } else if (name === 'OverconstrainedError') {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            fallbackStream.getTracks().forEach(t => t.stop());
          } catch {
            errorMsg = 'Could not access any camera on this device.';
            if (this.activeReject) this.activeReject(new Error(errorMsg));
            throw new Error(errorMsg);
          }
        }
        if (name !== 'OverconstrainedError') {
          if (this.activeReject) this.activeReject(new Error(errorMsg));
          throw new Error(errorMsg);
        }
      }

      // Fetch cameras first to choose the correct back/rear camera directly
      let cameras: Array<{ id: string; label: string }> = [];
      try {
        cameras = await Html5Qrcode.getCameras();
      } catch (camErr: any) {
        const errorMsg = 'Camera access denied. Please grant camera permission in settings and try again.';
        if (this.activeReject) this.activeReject(new Error(errorMsg));
        throw new Error(errorMsg);
      }

      if (!cameras || cameras.length === 0) {
        const errorMsg = 'No camera found on this device.';
        if (this.activeReject) this.activeReject(new Error(errorMsg));
        throw new Error(errorMsg);
      }

      const backCamera =
        cameras.find(
          c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('rear') ||
            c.label.toLowerCase().includes('environment') ||
            c.label.toLowerCase().includes('facing exterior')
        ) || cameras[0];

      // Clear any leftover content
      containerEl.innerHTML = '';

      const supportedFormats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ];

      this.html5QrcodeScanner = new Html5Qrcode(containerId, {
        formatsToSupport: supportedFormats,
        verbose: false,
      });

      const config = {
        fps: 24,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: true,
      };

      let lastCode = '';
      let lastTime = 0;

      const onSuccess = (decodedText: string) => {
        const trimmed = decodedText.trim();
        if (!trimmed) return;

        const now = Date.now();
        if (trimmed === lastCode && now - lastTime < 1500) {
          return;
        }
        
        lastCode = trimmed;
        lastTime = now;

        if (this.activeScanOptions?.onScan) {
          this.activeScanOptions.onScan(trimmed);
        }
        if (this.activeResolve) {
          this.activeResolve(trimmed);
        }
      };

      try {
        await this.html5QrcodeScanner.start(
          backCamera.id,
          config,
          onSuccess,
          () => {}
        );
      } catch (startErr: any) {
        console.error('[BarcodeScanner] Camera start failed:', startErr);
        const errorMsg = `Could not start camera "${backCamera.label || backCamera.id}": ${startErr?.message || startErr}`;
        if (this.activeReject) this.activeReject(new Error(errorMsg));
        throw new Error(errorMsg);
      }
    });

    return scanResultPromise;
  }

  private async stopInternal(): Promise<void> {
    if (this.activeReject) {
      this.activeReject(new Error('Scanner stopped.'));
    }

    if (!this.html5QrcodeScanner) return;

    try {
      const state = this.html5QrcodeScanner.getState();
      if (state === 2) { // SCANNING
        await this.html5QrcodeScanner.stop();
      }
    } catch (e) {
      console.warn('[BarcodeScanner] Error stopping scanner:', e);
    }

    try {
      this.html5QrcodeScanner.clear();
    } catch {}

    this.html5QrcodeScanner = null;
    this.activeResolve = null;
    this.activeReject = null;
  }

  async stop(): Promise<void> {
    return this.runLocked(async () => {
      await this.stopInternal();
    });
  }
}
export default WebBarcodeProvider;
