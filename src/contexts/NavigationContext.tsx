import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

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

  // Global popstate handler for swipe-to-back and hardware back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (programmaticPopsRef.current > 0) {
        programmaticPopsRef.current--;
        return;
      }

      // 1. If any modal/sheet/dialog/form is open, close it first and stop route change!
      if (modalStackRef.current.length > 0) {
        const topModal = modalStackRef.current[modalStackRef.current.length - 1];

        topModal?.onClose();

        return;
      }

      // Decrement history count
      internalHistoryCountRef.current = Math.max(1, internalHistoryCountRef.current - 1);

      const currentPath = locationRef.current;
      const parentPath = getParentRoute(currentPath);

      // 2. If user is on a sub-route/form and history is exhausted (e.g. app launched on form route)
      if (parentPath && internalHistoryCountRef.current <= 1) {
        // Prevent app exit by navigating to parent route
        setLocation(parentPath);
        return;
      }

      // 3. If user is on root '/' and popstate fires (attempting to exit app)
      if (currentPath === '/' && internalHistoryCountRef.current <= 1) {
        // Stay on '/' to prevent exiting app on accidental swipe back at root
        window.history.pushState({ appDepth: 1, path: '/' }, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setLocation]);

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

      // Clean up browser history entry if modal was closed programmatically (e.g. Cancel button)
      if (
        window.history.state?.isModal &&
        window.history.state?.modalId === id
      ) {
        programmaticPopsRef.current++;
        setTimeout(() => window.history.back(), 0);
      }
    };
  };

  const goBack = (fallbackPath?: string) => {
    // If a modal is open, close top modal
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
 * Reusable hook for smart back navigation (e.g. for header back arrows)
 */
export function useSmartBack(fallbackPath?: string) {
  const context = useContext(NavigationContext);
  const [, setLocation] = useLocation();

  if (!context) {
    return () => setLocation(fallbackPath || '/');
  }

  return () => context.goBack(fallbackPath);
}
