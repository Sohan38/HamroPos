import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// ─── Platform helper ───────────────────────────────────────────────────────────

/** Returns true only when running inside a Capacitor native shell (Android / iOS). */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// ─── Modal stack ──────────────────────────────────────────────────────────────

interface ModalHandler {
  id: string;
  onClose: () => void;
}

interface NavigationContextType {
  registerModal: (id: string, onClose: () => void) => () => void;
  goBack: (fallbackPath?: string) => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

// Map sub-routes to parent routes for intelligent back navigation
const PARENT_ROUTE_MAP: Array<{ pattern: RegExp; parent: string }> = [
  { pattern: /^\/inventory\/.+$/, parent: '/inventory' },
  { pattern: /^\/suppliers\/.+$/, parent: '/suppliers' },
  { pattern: /^\/sales\/.+$/, parent: '/sales' },
  { pattern: /^\/purchases\/.+$/, parent: '/purchases' },
  { pattern: /^\/expenses\/.+$/, parent: '/expenses' },
  { pattern: /^\/cash-book\/.+$/, parent: '/cash-book' },
  { pattern: /^\/credit\/.+$/, parent: '/credit' },
  { pattern: /^\/hotel\/rooms\/.+$/, parent: '/hotel' },
  { pattern: /^\/hotel\/billing\/.+$/, parent: '/hotel/billing' },
  { pattern: /^\/restaurant\/.+$/, parent: '/restaurant' },
  { pattern: /^\/(search|settings|reports)$/, parent: '/' },
];

export function getParentRoute(path: string): string | null {
  for (const item of PARENT_ROUTE_MAP) {
    if (item.pattern.test(path)) {
      return item.parent;
    }
  }
  return null;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const modalStackRef = useRef<ModalHandler[]>([]);
  const internalHistoryCountRef = useRef<number>(1);
  const locationRef = useRef(location);
  const programmaticPopsRef = useRef<number>(0);

  locationRef.current = location;

  // Track route changes in internal history stack count
  useEffect(() => {
    internalHistoryCountRef.current += 1;
    // Set initial history state tag if missing
    if (!window.history.state || typeof window.history.state !== 'object') {
      window.history.replaceState({ appDepth: internalHistoryCountRef.current, path: location }, '');
    }
  }, [location]);

  // ─── Browser popstate handler (web / desktop / browser back button) ──────
  //     Handles browser swipe-to-back and the browser's native back button.
  //     On Android Capacitor the backButton event below intercepts back
  //     BEFORE it ever reaches popstate, so these two handlers don't conflict.
  useEffect(() => {
    const handlePopState = (_e: PopStateEvent) => {
      if (programmaticPopsRef.current > 0) {
        programmaticPopsRef.current--;
        return;
      }

      // 1. If any modal/sheet/dialog is open, close the top one and stop.
      if (modalStackRef.current.length > 0) {
        const topModal = modalStackRef.current[modalStackRef.current.length - 1];
        topModal?.onClose();
        return;
      }

      // Decrement our internal route depth counter.
      internalHistoryCountRef.current = Math.max(1, internalHistoryCountRef.current - 1);

      const currentPath = locationRef.current;
      const parentPath = getParentRoute(currentPath);

      // 2. Sub-route launched cold (no prior history) — go to parent instead of exit.
      if (parentPath && internalHistoryCountRef.current <= 1) {
        setLocation(parentPath);
        return;
      }

      // 3. Root '/' with no history — web only guard.
      //    Re-push a sentinel so the browser SPA never loses its entry point.
      //    On native Capacitor this branch is never reached because the
      //    Capacitor backButton handler calls App.exitApp() first.
      if (currentPath === '/' && internalHistoryCountRef.current <= 1) {
        window.history.pushState({ appDepth: 1, path: '/' }, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setLocation]);

  // ─── Capacitor native back button handler (Android only) ─────────────────
  //
  //  Priority order — exactly one action is taken per back press:
  //
  //    1. Modal / dialog / sheet open
  //       → pop the dummy modal history entry which fires popstate
  //         → existing popstate handler closes the top modal. ✓
  //
  //    2. History depth > 1 (user has visited more than one page)
  //       → pop the real route history entry which fires popstate
  //         → Wouter updates the route. ✓
  //
  //    3. At the root "/" with no dialogs open
  //       → App.exitApp() — correct Android behavior. ✓
  //
  //  This effect runs once and cleans up the listener on unmount.
  //  Refs are stable across renders so the empty dep-array is intentional.
  useEffect(() => {
    if (!isNativePlatform()) return; // no-op on web / desktop / Windows

    const handleAndroidBack = async (_event: { canGoBack: boolean }) => {
      // We intentionally ignore the canGoBack flag from Capacitor because it
      // reflects WebView browser history depth which includes our dummy modal
      // entries. We use our own internalHistoryCountRef which only counts
      // real route navigations.

      // ── Priority 1: close top modal ──────────────────────────────────────
      if (modalStackRef.current.length > 0) {
        // Popping the dummy modal history entry triggers popstate, which
        // the existing handler uses to call topModal.onClose().
        window.history.back();
        return;
      }

      // ── Priority 2: navigate to previous page ────────────────────────────
      if (internalHistoryCountRef.current > 1) {
        window.history.back();
        return;
      }

      // ── Priority 3: exit app (dashboard with no dialogs) ─────────────────
      await App.exitApp();
    };

    // Register the listener using the official @capacitor/app SDK.
    // addListener returns a Promise<PluginListenerHandle> in Capacitor v4+.
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    App.addListener('backButton', handleAndroidBack).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── registerModal ────────────────────────────────────────────────────────

  const registerModal = (id: string, onClose: () => void) => {
    const handler: ModalHandler = { id, onClose };
    modalStackRef.current.push(handler);

    // Push dummy history entry for modal so mobile swipe back pops history state
    window.history.pushState({ isModal: true, modalId: id }, '');

    let unregistered = false;
    return () => {
      if (unregistered) return;
      unregistered = true;

      // Remove from stack
      modalStackRef.current = modalStackRef.current.filter(m => m !== handler);

      // Clean up browser history entry only if the modal was closed
      // programmatically (e.g. Cancel button) — not if back-navigation already
      // popped the entry (in which case window.history.state has already changed).
      if (
        window.history.state?.isModal &&
        window.history.state?.modalId === id
      ) {
        programmaticPopsRef.current++;
        setTimeout(() => window.history.back(), 0);
      }
    };
  };

  // ─── goBack (used by back-arrow buttons in page headers) ─────────────────

  const goBack = (fallbackPath?: string) => {
    // If a modal is open, close it first
    if (modalStackRef.current.length > 0) {
      window.history.back();
      return;
    }

    const parent = fallbackPath || getParentRoute(locationRef.current) || '/';

    // If browser history has previous entries in our app
    if (window.history.length > 1 && internalHistoryCountRef.current > 1) {
      window.history.back();
    } else {
      setLocation(parent);
    }
  };

  return (
    <NavigationContext.Provider value={{ registerModal, goBack }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

/**
 * Reusable hook to handle mobile back swipe for any modal, sheet, or inline form.
 */
export function useBackModal(isOpen: boolean, onClose: () => void, modalId: string = 'modal') {
  const context = useContext(NavigationContext);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || !context) return;

    const unregister = context.registerModal(modalId, () => onCloseRef.current());
    return () => {
      unregister();
    };
  }, [isOpen, modalId, context]);
}

/**
 * Reusable hook for smart back navigation (e.g. for header back arrows).
 */
export function useSmartBack(fallbackPath?: string) {
  const context = useContext(NavigationContext);
  const [, setLocation] = useLocation();

  if (!context) {
    return () => setLocation(fallbackPath || '/');
  }

  return () => context.goBack(fallbackPath);
}
