export interface BarcodeScannerOptions {
  containerId?: string;
  onScan?: (text: string) => void;
  onError?: (err: string) => void;
  autoClose?: boolean;
  scanRegion?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export interface BarcodeProvider {
  scan(options?: BarcodeScannerOptions): Promise<string>;
  stop?(): Promise<void>;
  supported(): boolean;
}
