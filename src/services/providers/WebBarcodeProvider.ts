import { BarcodeProvider, BarcodeScannerOptions } from '../IBarcodeProvider';
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from '@zxing/library';

/**
 * WebBarcodeProvider — Highly optimized @zxing/library edition.
 *
 * Scans efficiently by throttling frame rate checks (~4 FPS) and disabling
 * CPU-heavy hints like TRY_HARDER to prevent UI lagging.
 * Stop operations are made fully non-blocking to prevent UI lockups on close.
 */
export class WebBarcodeProvider implements BarcodeProvider {
  private reader: BrowserMultiFormatReader | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private stopped = false;

  // Mutex so concurrent scan() / stop() calls don't race
  private mutex: Promise<any> = Promise.resolve();
  private runLocked<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.mutex.then(fn);
    this.mutex = next.then(() => {}, () => {});
    return next;
  }

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  private activeStream: MediaStream | null = null;

  async scan(options?: BarcodeScannerOptions): Promise<string> {
    if (!options?.containerId) {
      throw new Error('WebBarcodeProvider: containerId is required.');
    }

    return this.runLocked(async () => {
      await this.teardown();

      return new Promise<string>(async (resolve, reject) => {
        this.stopped = false;

        const container = document.getElementById(options.containerId!);
        if (!container) {
          return reject(new Error('Scanner container not found.'));
        }

        // Keep a reference to reject so stop() can reject it immediately
        (this as any)._activeReject = reject;

        // Wait for container to have real dimensions (dialog animation)
        let tries = 0;
        while (tries++ < 40) {
          if (this.stopped) {
            delete (this as any)._activeReject;
            return reject(new Error('Scanner stopped.'));
          }
          const r = container.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) break;
          await new Promise(r => setTimeout(r, 75));
        }

        // --- Build the ZXing reader with barcode-optimised hints ---
        const hints = new Map<DecodeHintType, any>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ]);
        
        // Disabled TRY_HARDER to prevent CPU lagging and thermal throttling on mobile
        hints.set(DecodeHintType.TRY_HARDER, false);

        this.reader = new BrowserMultiFormatReader(hints);

        // --- Video element ---
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.style.cssText =
          'position:absolute;width:100%;height:100%;object-fit:cover;left:0;top:0;border-radius:inherit;';
        container.style.position = 'relative';
        container.innerHTML = '';
        container.appendChild(video);
        this.videoEl = video;

        let lastCode = '';
        let lastTime = 0;

        try {
          const constraints: MediaStreamConstraints = {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          };

          // Capture the stream to track and stop it when teardown is called
          const stream = await navigator.mediaDevices.getUserMedia(constraints).catch(() =>
            navigator.mediaDevices.getUserMedia({ video: true })
          );
          
          if (this.stopped) {
            stream.getTracks().forEach(t => t.stop());
            return reject(new Error('Scanner stopped.'));
          }
          
          this.activeStream = stream;
          video.srcObject = stream;
          await video.play().catch(() => {});

          // Throttle decode loops: only decode every ~250ms (4 FPS) to reduce CPU overhead
          let lastDecodeTime = 0;

          this.reader.decodeFromVideoElementContinuously(video, (result, error) => {
            if (this.stopped) return;

            const nowTime = Date.now();
            if (nowTime - lastDecodeTime < 250) {
              return;
            }
            lastDecodeTime = nowTime;

            if (result) {
              const text = result.getText().trim();
              const now = Date.now();

              // Debounce: skip same code within 1.5s
              if (text && !(text === lastCode && now - lastTime < 1500)) {
                lastCode = text;
                lastTime = now;
                if (options?.onScan) options.onScan(text);
                resolve(text);
              }
            }

            if (error && !(error instanceof NotFoundException)) {
              // Ignore routine NotFoundException frame errors
            }
          });
        } catch (err: any) {
          const n = err?.name ?? '';
          if (n === 'NotAllowedError' || n === 'PermissionDeniedError') {
            return reject(new Error('Camera permission denied. Please allow camera access and try again.'));
          }
          if (n === 'NotFoundError') {
            return reject(new Error('No camera found on this device.'));
          }
          if (n === 'NotReadableError') {
            return reject(new Error('Camera is in use by another app. Close it and try again.'));
          }
          return reject(new Error(`Camera error: ${err?.message ?? err}`));
        }
      });
    });
  }

  private async teardown(): Promise<void> {
    this.stopped = true;

    if ((this as any)._activeReject) {
      try {
        (this as any)._activeReject(new Error('Scanner stopped.'));
      } catch {}
      delete (this as any)._activeReject;
    }

    if (this.reader) {
      const activeReader = this.reader;
      this.reader = null;
      // Do reset asynchronously to prevent blocking the UI thread during teardown
      setTimeout(() => {
        try {
          activeReader.reset();
        } catch {}
      }, 0);
    }

    if (this.activeStream) {
      try {
        this.activeStream.getTracks().forEach(t => t.stop());
      } catch {}
      this.activeStream = null;
    }

    if (this.videoEl) {
      if (this.videoEl.srcObject) {
        try {
          const stream = this.videoEl.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
        } catch {}
        this.videoEl.srcObject = null;
      }
      this.videoEl.remove();
      this.videoEl = null;
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    // Execute immediately without awaiting the queue lock to avoid UI deadlocks
    this.teardown().catch(() => {});
    return Promise.resolve();
  }
}

export default WebBarcodeProvider;
