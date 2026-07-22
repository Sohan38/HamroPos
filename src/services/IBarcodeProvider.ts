export interface BarcodeScannerOptions {
  containerId?: string;
  onScan?: (text: string) => void;
  onError?: (err: string) => void;
}

export interface BarcodeProvider {
  scan(options?: BarcodeScannerOptions): Promise<string>;
  stop?(): Promise<void>;
  supported(): boolean;
}
