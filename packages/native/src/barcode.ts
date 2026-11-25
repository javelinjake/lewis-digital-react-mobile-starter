import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner'
import { errorMessage, isCancellation } from './errors'

/** Needs `capabilities.barcode` in app.meta.ts and `@capacitor/barcode-scanner` in the app's package.json. */

export type BarcodeFormat = 'qr' | 'ean13' | 'ean8' | 'upcA' | 'upcE' | 'code128' | 'code39' | 'dataMatrix' | 'pdf417' | 'aztec'

const formats: Record<BarcodeFormat, CapacitorBarcodeScannerTypeHint> = {
  qr: CapacitorBarcodeScannerTypeHint.QR_CODE,
  ean13: CapacitorBarcodeScannerTypeHint.EAN_13,
  ean8: CapacitorBarcodeScannerTypeHint.EAN_8,
  upcA: CapacitorBarcodeScannerTypeHint.UPC_A,
  upcE: CapacitorBarcodeScannerTypeHint.UPC_E,
  code128: CapacitorBarcodeScannerTypeHint.CODE_128,
  code39: CapacitorBarcodeScannerTypeHint.CODE_39,
  dataMatrix: CapacitorBarcodeScannerTypeHint.DATA_MATRIX,
  pdf417: CapacitorBarcodeScannerTypeHint.PDF_417,
  aztec: CapacitorBarcodeScannerTypeHint.AZTEC,
}

export type ScanResult =
  | { status: 'scanned', value: string }
  | { status: 'cancelled' }
  | { status: 'unavailable', reason: string }

export interface ScanOptions {
  /** One format scans faster and avoids misreads. Omit to accept any. */
  format?: BarcodeFormat
  /** Shown over the camera, e.g. "Point at the QR code on the box". */
  instructions?: string
}

/**
 * Opens a full-screen camera scanner and resolves with the first code read. Asks for camera permission the first
 * time. On the web it opens an in-page scanner (camera access needs https). Treat the value as untrusted input.
 * Never throws.
 */
export async function scanBarcode(options: ScanOptions = {}): Promise<ScanResult> {
  try {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: options.format ? formats[options.format] : CapacitorBarcodeScannerTypeHint.ALL,
      scanInstructions: options.instructions,
    })
    return result.ScanResult ? { status: 'scanned', value: result.ScanResult } : { status: 'cancelled' }
  }
  catch (error) {
    return isCancellation(error) ? { status: 'cancelled' } : { status: 'unavailable', reason: errorMessage(error) }
  }
}
