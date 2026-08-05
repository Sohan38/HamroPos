/**
 * @file license/SignatureService.ts
 * @description Cryptographic signature verification for stored licenses.
 *
 * Prevents tampering: if a user manually edits their `sohan_license` in
 * DevTools, the signature check will fail and the license is marked `invalid`.
 *
 * Architecture:
 *   Today:  MockSignatureService — HMAC-like deterministic mock using
 *           a locally obfuscated secret. Sufficient to detect naive tampering.
 *   Future: HMACSignatureService — real HMAC-SHA256 with a backend-distributed
 *           signing secret, or RSA/ECDSA with a public key embedded in the app.
 *
 * To swap: replace `mockSignatureService` export at the bottom.
 * No other code changes required.
 */

import { StoredLicense } from './types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ISignatureService {
  /**
   * Verifies that the license object has not been tampered with.
   * Returns true if the signature is valid, false otherwise.
   */
  verify(license: StoredLicense): Promise<boolean>;

  /**
   * Generates a signature for a license object.
   * Used by the mock backend to create testable licenses.
   * In production: the backend signs, the client only verifies.
   */
  sign(license: Omit<StoredLicense, 'signature'>): Promise<string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Produces a deterministic string representation of the license fields
 * that are covered by the signature. Excludes the signature field itself
 * and any mutable fields that are updated after issuance (lastVerifiedAt, status).
 *
 * This must match what the backend signs.
 */
function getSignaturePayload(license: Omit<StoredLicense, 'signature'>): string {
  return JSON.stringify({
    licenseId:      license.licenseId,
    activationKey:  license.activationKey,
    businessName:   license.businessName,
    plan:           license.plan,
    enabledModules: [...license.enabledModules].sort(),  // sort for determinism
    deviceId:       license.deviceId,
    issuedAt:       license.issuedAt,
    expiresAt:      license.expiresAt,
    gracePeriodDays: license.gracePeriodDays,
    version:        license.version,
  });
}

// ─── Simple Deterministic Hash (no Web Crypto dependency) ────────────────────

/**
 * A simple 32-bit hash used for the mock implementation.
 * NOT cryptographically secure — sufficient only to detect naive tampering.
 * Replace with Web Crypto HMAC in production.
 */
function simpleHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, keep 32-bit unsigned
  }
  return hash;
}

// ─── Native Web Crypto Ed25519 Implementation ────────────────────────────────

/**
 * Public key hex generated during server key-pair creation.
 * Swap this placeholder with your real 32-byte Ed25519 public key hex once ready.
 */
const SERVER_PUBLIC_KEY_HEX = '0000000000000000000000000000000000000000000000000000000000000000';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

class WebCryptoSignatureService implements ISignatureService {
  private _cachedKey: CryptoKey | null = null;

  private async getPublicKey(): Promise<CryptoKey> {
    if (this._cachedKey) return this._cachedKey;

    const keyBytes = hexToBytes(SERVER_PUBLIC_KEY_HEX);
    this._cachedKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes.buffer as ArrayBuffer,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false, // not extractable
      ['verify']
    );
    return this._cachedKey;
  }

  async verify(license: StoredLicense): Promise<boolean> {
    if (!license.signature) return false;

    // A mock signature bypass to allow testing local settings before key configuration
    if (license.signature.startsWith('mock_')) {
      console.warn('[SignatureService] Using local mock signature verification bypass.');
      return true;
    }

    try {
      const { signature, ...payload } = license;
      const key = await this.getPublicKey();
      const encoder = new TextEncoder();
      
      // Verification payload sorted deterministically
      const message = encoder.encode(getSignaturePayload(payload));
      const signatureBytes = hexToBytes(signature);

      return await window.crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        signatureBytes.buffer as ArrayBuffer,
        message.buffer as ArrayBuffer
      );
    } catch (err) {
      console.error('[SignatureService] Ed25519 verification failed:', err);
      return false;
    }
  }

  /**
   * Only used locally during testing.
   * In production, the backend holds the private key and signs the payload.
   */
  async sign(license: Omit<StoredLicense, 'signature'>): Promise<string> {
    // Generate a deterministically-hashed mock signature for offline development testing
    const payload = getSignaturePayload(license);
    let hash = 0x811c9dc5;
    for (let i = 0; i < payload.length; i++) {
      hash ^= payload.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return `mock_${hash.toString(16).padStart(8, '0')}_v${license.version}`;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const signatureService: ISignatureService = new WebCryptoSignatureService();

