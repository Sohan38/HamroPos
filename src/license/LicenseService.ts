/**
 * @file license/LicenseService.ts
 * @description Central public API layer for all licensing operations.
 *
 * Design Decisions:
 * - Responsible for orchestrating activation, validation, local storage caching,
 *   periodic verification checks, and deactivation.
 * - Connects to the device, signature, and storage abstractions.
 * - Provides a mock implementation of backend responses which can be easily
 *   replaced with direct REST API requests in the future.
 */

import { StoredLicense, LicenseState, ActivationResponse, DeactivationResponse } from './types';
import { VERIFY_INTERVAL_DAYS } from './constants';
import { deviceService } from './DeviceService';
import { signatureService } from './SignatureService';
import { licenseStorage } from './LicenseStorage';
import { buildLicenseState, nowISO, needsServerVerification } from './LicenseValidator';
import { apiClient, ApiError } from '@/services/apiClient';

export class LicenseService {
  private _cachedState: LicenseState | null = null;
  private _isRefreshing = false;

  /**
   * Initializes the license system on app boot.
   * Checks for stored license, validates signature, ensures trial starts,
   * and builds the initial read-only state.
   */
  async initialize(): Promise<LicenseState> {
    if (this._cachedState) return this._cachedState;

    let license = licenseStorage.loadLicense();
    let trialStart = licenseStorage.getTrialStart();

    // Setup trial timestamp on first install
    if (!license && !trialStart) {
      trialStart = nowISO();
      licenseStorage.setTrialStart(trialStart);
    }

    let signatureValid = false;
    if (license) {
      try {
        signatureValid = await signatureService.verify(license);
      } catch (err) {
        console.error('[LicenseService] Signature check threw error:', err);
        signatureValid = false;
      }
    }

    const state = buildLicenseState(license, trialStart, signatureValid, false);
    this._cachedState = state;
    return state;
  }

  /**
   * Returns the current state.
   * Falls back to a default loading state if initialize() has not completed.
   */
  getState(): LicenseState {
    return this._cachedState || {
      status: 'none',
      license: null,
      trial: null,
      isLoading: true,
      isUsable: false,
      hasAnyLicense: false,
      expiresAt: null,
      daysUntilExpiry: null,
    };
  }

  /**
   * Triggers the activation flow.
   * Simulates a backend request, signs the returned license payload,
   * stores it locally, and updates runtime state cache.
   */
  async activate(key: string): Promise<ActivationResponse> {
    try {
      if (!key || key.trim().length === 0) {
        return { success: false, errorCode: 'INVALID_KEY' };
      }

      const deviceId = deviceService.getDeviceId();
      const platform = deviceService.getPlatform();
      const appVersion = '1.0.0';

      interface ServerActivationResponse {
        success: boolean;
        data?: {
          payload: {
            version: number;
            licenseId: string;
            businessName: string;
            plan: string;
            expiresAt: string | null;
            gracePeriodDays: number;
            entitlements: Record<string, boolean>;
            authorizedDevices: string[];
            issuedAt: string;
            metadata?: Record<string, unknown>;
          };
          signature: string;
        };
        error?: string;
        errorCode?: string;
      }

      const resData = await apiClient.post<ServerActivationResponse>('/license/activate', {
        activationKey: key.trim(),
        deviceId: deviceId,
        deviceMeta: {
          platform,
          appVersion,
        },
      });

      if (!resData.success || !resData.data) {
        return {
          success: false,
          errorCode: (resData.errorCode as any) || 'INVALID_KEY',
          error: resData.error
        };
      }

      const { payload, signature } = resData.data;
      if (!payload || !signature) {
        return { success: false, errorCode: 'SERVER_ERROR' };
      }

      const now = nowISO();

      // Map backend entitlements (object: { [featureId]: boolean }) to enabledModules (array: string[])
      const enabledModules = Object.keys(payload.entitlements || {}).filter(
        (modId) => payload.entitlements[modId] === true
      );

      const license: StoredLicense = {
        version: payload.version || 1,
        licenseId: payload.licenseId,
        activationKey: key.trim(),
        businessName: payload.businessName,
        plan: payload.plan || 'pro',
        enabledModules: enabledModules,
        deviceId: deviceId,
        activatedAt: now,
        issuedAt: payload.issuedAt || now,
        expiresAt: payload.expiresAt || null,
        gracePeriodDays: typeof payload.gracePeriodDays === 'number' ? payload.gracePeriodDays : 7,
        lastVerifiedAt: now,
        status: 'active',
        signature: signature,
        metadata: payload.metadata || {}
      };

      // Cache locally
      licenseStorage.saveLicense(license);

      // Re-hydrate state
      this._cachedState = buildLicenseState(license, licenseStorage.getTrialStart(), true, false);

      return { success: true, license };
    } catch (err) {
      console.error('[LicenseService] Activation error:', err);
      if (err instanceof ApiError) {
        return {
          success: false,
          errorCode: (err.errorCode as ActivationResponse['errorCode']) || 'SERVER_ERROR',
          error: err.message,
        };
      }
      return { success: false, errorCode: 'SERVER_ERROR' };
    }
  }

  /**
   * Deactivates the license, wiping local cache.
   * Falls back to trial window state.
   */
  async deactivate(): Promise<DeactivationResponse> {
    try {
      // Mock network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      licenseStorage.removeLicense();

      // Re-initialize state
      this._cachedState = null;
      await this.initialize();

      return { success: true };
    } catch (err) {
      console.error('[LicenseService] Deactivation error:', err);
      return { success: false, error: 'Failed to deactivate license.' };
    }
  }

  /**
   * Silent background validation.
   * Checks if we need to call the server to verify active status.
   */
  async refreshIfNeeded(): Promise<LicenseState | null> {
    if (this._isRefreshing) return null;
    const current = this.getState();
    if (!current.license || current.status !== 'active') return null;

    if (!needsServerVerification(current.license, VERIFY_INTERVAL_DAYS)) {
      return null;
    }

    this._isRefreshing = true;
    try {
      // Simulate silent network check
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In real backend: fetch status of current licenseId.
      // If still active, update verified timestamp
      const updated = licenseStorage.patchLicense({
        lastVerifiedAt: nowISO()
      });

      if (updated) {
        this._cachedState = buildLicenseState(updated, licenseStorage.getTrialStart(), true, false);
      }
    } catch (err) {
      console.warn('[LicenseService] Silent verification failed (offline?):', err);
    } finally {
      this._isRefreshing = false;
    }

    return this._cachedState;
  }
}

export const licenseService = new LicenseService();
