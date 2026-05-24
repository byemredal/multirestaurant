'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultTerminologyPresetId,
  getPreset,
  terminologyPresets,
  type Term,
  type TerminologyKey,
  type TerminologyPreset,
  type TerminologyPresetId,
} from './terminology.config';

const STORAGE_KEY = 'lz.admin.terminology';

type TerminologyContextValue = {
  presetId: TerminologyPresetId;
  preset: TerminologyPreset;
  setPresetId: (id: TerminologyPresetId) => void;
  /** Resolve a single domain term, e.g. `term('tenant', 'plural')` → "Tenants". */
  term: (key: TerminologyKey, form?: keyof Term) => string;
};

const TerminologyContext = createContext<TerminologyContextValue | null>(null);

export function TerminologyProvider({ children }: { children: ReactNode }) {
  const [presetId, setPresetIdState] = useState<TerminologyPresetId>(
    defaultTerminologyPresetId,
  );

  // Hydrate from localStorage after mount to keep SSR output deterministic.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored in terminologyPresets) {
      setPresetIdState(stored as TerminologyPresetId);
    }
  }, []);

  const setPresetId = useCallback((id: TerminologyPresetId) => {
    setPresetIdState(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const value = useMemo<TerminologyContextValue>(() => {
    const preset = getPreset(presetId);
    return {
      presetId,
      preset,
      setPresetId,
      term: (key, form = 'singular') => preset[key][form],
    };
  }, [presetId, setPresetId]);

  return (
    <TerminologyContext.Provider value={value}>
      {children}
    </TerminologyContext.Provider>
  );
}

export function useTerminology(): TerminologyContextValue {
  const ctx = useContext(TerminologyContext);
  if (!ctx) {
    throw new Error('useTerminology must be used inside <TerminologyProvider>.');
  }
  return ctx;
}
