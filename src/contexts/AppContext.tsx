import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '../storage/StorageService';
import { AppSettings, AppUser } from '../types';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const defaultSettings: AppSettings = {
  businessName: 'Sohan Manager',
  businessLogoBase64: null,
  phone: '',
  address: '',
  vatNumber: '',
  currency: 'NPR',
  currencySymbol: 'Rs',
  taxRate: 13,
  lowStockThreshold: 10,
  theme: 'system',
  language: 'en'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(() => {
    return storageService.getSettings() || defaultSettings;
  });
  
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettingsState(updated);
    storageService.saveSettings(updated);
  };

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme });
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (settings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  return (
    <AppContext.Provider value={{ settings, updateSettings, currentUser, setCurrentUser, theme: settings.theme, setTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
