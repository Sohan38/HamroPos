/**
 * @file license/LicenseContext.tsx
 * @description React Provider and hooks for consuming license state globally.
 *
 * Design Decisions:
 * - Boots the LicenseService asynchronously on mount.
 * - Exposes full license state (trial status, plan, expires, etc.).
 * - Offers callback methods for activating and deactivating.
 * - Incorporates feature module checks to determine if a feature is enabled.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LicenseState, ActivationResponse, DeactivationResponse } from './types';
import { licenseService } from './LicenseService';
import { isDomainFeatureAllowed } from './LicenseValidator';

interface LicenseContextType {
  state: LicenseState;
  activate: (key: string) => Promise<ActivationResponse>;
  deactivate: () => Promise<DeactivationResponse>;
  refresh: () => Promise<void>;
  checkFeature: (domain: string, flag: string) => boolean;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LicenseState>(licenseService.getState());

  const init = useCallback(async () => {
    const initializedState = await licenseService.initialize();
    setState(initializedState);
    
    // Attempt silent refresh check if initialized license needs it
    await licenseService.refreshIfNeeded().then((refreshedState) => {
      if (refreshedState) {
        setState(refreshedState);
      }
    });
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const activate = useCallback(async (key: string): Promise<ActivationResponse> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const result = await licenseService.activate(key);
    setState(licenseService.getState());
    return result;
  }, []);

  const deactivate = useCallback(async (): Promise<DeactivationResponse> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const result = await licenseService.deactivate();
    setState(licenseService.getState());
    return result;
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const refreshed = await licenseService.refreshIfNeeded();
    if (refreshed) {
      setState(refreshed);
    }
  }, []);

  const checkFeature = useCallback((domain: string, flag: string): boolean => {
    return isDomainFeatureAllowed(state.license, state.status, domain, flag);
  }, [state.license, state.status]);

  return (
    <LicenseContext.Provider value={{ state, activate, deactivate, refresh, checkFeature }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
