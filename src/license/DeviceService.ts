/**
 * @file license/DeviceService.ts
 * @description Device identification abstraction.
 *
 * Today: generates and persists a stable UUID in localStorage.
 * Future: swap `LocalDeviceService` for `CapacitorDeviceService` which uses
 *         the hardware device UUID via the Capacitor Device plugin.
 *
 * No callers need to change when the implementation is swapped.
 */

import { v4 as uuidv4 } from 'uuid';
import { DEVICE_ID_KEY } from './constants';

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Abstraction for device-specific information.
 * All methods are synchronous for simplicity; Capacitor equivalents are async
 * but the interface can be extended to return Promises when needed.
 */
export interface IDeviceService {
  /**
   * Returns a stable, unique identifier for this device/installation.
   * On first call, generates and persists the ID. Subsequent calls return
   * the same ID for the lifetime of the installation.
   */
  getDeviceId(): string;

  /**
   * Returns the current runtime platform identifier.
   * Used in the activation request payload for analytics and multi-platform support.
   */
  getPlatform(): 'android' | 'ios' | 'web' | 'desktop';

  /**
   * Returns a display-safe masked version of the device ID.
   * e.g. "a1b2c3d4-****-****-****-************" → shown in UI, not stored.
   */
  getMaskedDeviceId(): string;
}

// ─── Local (localStorage-based) Implementation ───────────────────────────────

class LocalDeviceService implements IDeviceService {
  private _cachedId: string | null = null;

  getDeviceId(): string {
    if (this._cachedId) return this._cachedId;

    try {
      const stored = localStorage.getItem(DEVICE_ID_KEY);
      if (stored) {
        this._cachedId = stored;
        return stored;
      }
    } catch {
      // localStorage may be unavailable in some environments
    }

    // Generate a new stable UUID for this installation
    const newId = uuidv4();
    try {
      localStorage.setItem(DEVICE_ID_KEY, newId);
    } catch {
      // Silently continue — ID won't persist but app won't break
    }
    this._cachedId = newId;
    return newId;
  }

  getPlatform(): 'android' | 'ios' | 'web' | 'desktop' {
    // Capacitor sets window.Capacitor when running as a native app
    const capacitor = (window as any).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      const platform = capacitor.getPlatform?.();
      if (platform === 'android') return 'android';
      if (platform === 'ios') return 'ios';
    }

    // Electron or similar desktop wrapper
    if (typeof (window as any).require === 'function') {
      return 'desktop';
    }

    return 'web';
  }

  getMaskedDeviceId(): string {
    const id = this.getDeviceId();
    // Show first 8 chars, mask the rest
    if (id.length <= 8) return id;
    return `${id.substring(0, 8)}-****-****-****-****`;
  }
}

// ─── Capacitor Implementation (stub for future use) ───────────────────────────

/**
 * Future drop-in replacement using Capacitor's Device plugin.
 *
 * import { Device } from '@capacitor/device';
 *
 * class CapacitorDeviceService implements IDeviceService {
 *   private _cachedId: string | null = null;
 *
 *   getDeviceId(): string {
 *     // NOTE: Capacitor Device.getId() is async.
 *     // When swapping, extend the interface to return Promise<string>
 *     // and update LicenseService.initialize() to await it.
 *     return this._cachedId ?? 'pending';
 *   }
 *
 *   async initAsync(): Promise<void> {
 *     const info = await Device.getId();
 *     this._cachedId = info.identifier;
 *   }
 *
 *   getPlatform(): 'android' | 'ios' | 'web' | 'desktop' {
 *     // Use Capacitor.getPlatform() here
 *     return 'android';
 *   }
 *
 *   getMaskedDeviceId(): string {
 *     const id = this._cachedId ?? 'unknown';
 *     return id.length > 8 ? `${id.substring(0, 8)}-****` : id;
 *   }
 * }
 */

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * The active device service instance.
 * To swap to Capacitor: replace `LocalDeviceService` with `CapacitorDeviceService`.
 */
export const deviceService: IDeviceService = new LocalDeviceService();
