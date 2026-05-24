'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Wizard state shared across the linear setup steps. It lives in the
 * `/setup` layout, which Next.js keeps mounted while the user moves between
 * steps — so no router state machine or persistence layer is needed.
 */
export interface SetupDraft {
  platformName: string;
  supportEmail: string;
  logoUrl: string;
  logoFileName: string;
  primaryCountry: string;
  adminEmail: string;
  adminPassword: string;
  bootstrapKey: string;
}

const EMPTY_DRAFT: SetupDraft = {
  platformName: '',
  supportEmail: '',
  logoUrl: '',
  logoFileName: '',
  primaryCountry: 'CH',
  adminEmail: '',
  adminPassword: '',
  bootstrapKey: '',
};

interface SetupContextValue {
  draft: SetupDraft;
  update: (patch: Partial<SetupDraft>) => void;
  reset: () => void;
}

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SetupDraft>(EMPTY_DRAFT);

  const value = useMemo<SetupContextValue>(
    () => ({
      draft,
      update: (patch) => setDraft((current) => ({ ...current, ...patch })),
      reset: () => setDraft(EMPTY_DRAFT),
    }),
    [draft],
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup(): SetupContextValue {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error('useSetup must be used within a SetupProvider.');
  }
  return context;
}
