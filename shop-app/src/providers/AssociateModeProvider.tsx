import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type AssociateModeContextValue = {
  isAssociateMode: boolean;
  isCheckingAssociateMode: boolean;
};

type AssociateModeResponse = {
  associateMode?: boolean;
};

const associateModeStorageKey = 'ccgAssociateMode';

const AssociateModeContext = createContext<AssociateModeContextValue>({
  isAssociateMode: false,
  isCheckingAssociateMode: false,
});

const readStoredAssociateMode = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(associateModeStorageKey) === '1';
};

const setStoredAssociateMode = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  if (enabled) window.localStorage.setItem(associateModeStorageKey, '1');
  else window.localStorage.removeItem(associateModeStorageKey);
};

const removeAssociateParam = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('associate')) return;
  url.searchParams.delete('associate');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
};

const AssociateModeProvider = ({ children }: { children: ReactNode }) => {
  const [isAssociateMode, setIsAssociateMode] = useState(readStoredAssociateMode);
  const [isCheckingAssociateMode, setIsCheckingAssociateMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('associate');

    const setMode = (enabled: boolean) => {
      if (cancelled) return;
      setStoredAssociateMode(enabled);
      setIsAssociateMode(enabled);
    };

    const validate = async () => {
      if (token) {
        removeAssociateParam();
      }

      if (token === '0' || token === 'false' || token === 'off') {
        setIsCheckingAssociateMode(true);
        try {
          await fetch('/api/shop/associate-mode', { method: 'DELETE' });
        } finally {
          setMode(false);
          if (!cancelled) setIsCheckingAssociateMode(false);
        }
        return;
      }

      if (token) {
        setIsCheckingAssociateMode(true);
        try {
          const response = await fetch('/api/shop/associate-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const data = (await response.json()) as AssociateModeResponse;
          setMode(response.ok && data.associateMode === true);
        } catch {
          setMode(false);
        } finally {
          if (!cancelled) setIsCheckingAssociateMode(false);
        }
        return;
      }

      if (readStoredAssociateMode()) {
        setIsCheckingAssociateMode(true);
        try {
          const response = await fetch('/api/shop/associate-mode');
          const data = (await response.json()) as AssociateModeResponse;
          setMode(response.ok && data.associateMode === true);
        } catch {
          setMode(false);
        } finally {
          if (!cancelled) setIsCheckingAssociateMode(false);
        }
      }
    };

    void validate();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ isAssociateMode, isCheckingAssociateMode }),
    [isAssociateMode, isCheckingAssociateMode],
  );

  return <AssociateModeContext.Provider value={value}>{children}</AssociateModeContext.Provider>;
};

export const useAssociateMode = () => useContext(AssociateModeContext);

export default AssociateModeProvider;
