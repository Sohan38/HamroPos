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

// ─── Mock Implementation (for development / offline use) ─────────────────────

class MockSignatureService implements ISignatureService {
  /**
   * Obfuscated local secret. In production this is replaced by a backend-
   * distributed key that is never stored client-side.
   *
   * The value here is deliberately split to make it harder to grep from
   * a compiled APK. A real HMAC key would be handled differently.
   */
  private readonly _s = ['sh', '0h', 'nb', 'iz', '2k', 'xq'].join('');

  async sign(license: Omit<StoredLicense, 'signature'>): Promise<string> {
    const payload = getSignaturePayload(license);
    const combined = payload + this._s;
    const hash = simpleHash(combined);
    // Produce a hex string that looks like a real HMAC
    return `mock_${hash.toString(16).padStart(8, '0')}_v${license.version}`;
  }

  async verify(license: StoredLicense): Promise<boolean> {
    if (!license.signature) return false;
    const { signature, ...rest } = license;
    const expected = await this.sign(rest);
    return signature === expected;
  }
}

// ─── Real HMAC Implementation (stub — activate when backend is ready) ─────────

/**
 * Uses the Web Crypto API for real HMAC-SHA256 verification.
 *
 * class HMACSignatureService implements ISignatureService {
 *   // The public signing key distributed by the backend.
 *   // In production: embedded at build time via env variable.
 *   private readonly SECRET = import.meta.env.VITE_LICENSE_HMAC_SECRET ?? '';
 *
 *   private async importKey(): Promise<CryptoKey> {
 *     const enc = new TextEncoder();
 *     return crypto.subtle.importKey(
 *       'raw', enc.encode(this.SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
 *     );
 *   }
 *
 *   async sign(license: Omit<StoredLicense, 'signature'>): Promise<string> {
 *     const key = await this.importKey();
 *     const enc = new TextEncoder();
 *     const buf = await crypto.subtle.sign('HMAC', key, enc.encode(getSignaturePayload(license)));
 *     return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
 *   }
 *
 *   async verify(license: StoredLicense): Promise<boolean> {
 *     if (!license.signature) return false;
 *     const { signature, ...rest } = license;
 *     const expected = await this.sign(rest);
 *     return signature === expected;
 *   }
 * }
 */

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * The active signature service instance.
 * Swap to HMACSignatureService (or RSASignatureService) when backend is ready.
 */
export const signatureService: ISignatureService = new MockSignatureService();
