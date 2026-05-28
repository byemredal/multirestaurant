'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Wizard state shared across the linear setup steps. It lives in the
 * `/setup` layout, which Next.js keeps mounted while the user moves between
 * steps.
 *
 * Low-risk fields are also mirrored to localStorage so a full-page refresh
 * mid-wizard does not wipe the user's progress. Secrets are deliberately NOT
 * persisted (see {@link PersistedDraft}) and must be re-entered after refresh.
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

/* ── Draft persistence (low-risk fields only) ──────────────────────────────
   adminPassword and bootstrapKey are secrets and are NEVER written to
   storage; they are re-entered after a refresh. The key is versioned so a
   schema change can invalidate old drafts, and drafts expire after a day. */

const DRAFT_STORAGE_KEY = 'setup-draft:v1';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type PersistedDraft = Pick<
  SetupDraft,
  | 'platformName'
  | 'supportEmail'
  | 'logoUrl'
  | 'logoFileName'
  | 'primaryCountry'
  | 'adminEmail'
>;

interface StoredEnvelope {
  v: 1;
  updatedAt: number;
  draft: PersistedDraft;
}

function pickPersisted(draft: SetupDraft): PersistedDraft {
  return {
    platformName: draft.platformName,
    supportEmail: draft.supportEmail,
    logoUrl: draft.logoUrl,
    logoFileName: draft.logoFileName,
    primaryCountry: draft.primaryCountry,
    adminEmail: draft.adminEmail,
  };
}

function clearStoredDraft(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

function readStoredDraft(): PersistedDraft | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredEnvelope;
    const fresh =
      parsed &&
      parsed.v === 1 &&
      typeof parsed.updatedAt === 'number' &&
      Date.now() - parsed.updatedAt <= DRAFT_TTL_MS &&
      parsed.draft &&
      typeof parsed.draft === 'object';
    if (!fresh) {
      clearStoredDraft();
      return null;
    }

    const d = parsed.draft;
    return {
      platformName: String(d.platformName ?? ''),
      supportEmail: String(d.supportEmail ?? ''),
      logoUrl: String(d.logoUrl ?? ''),
      logoFileName: String(d.logoFileName ?? ''),
      primaryCountry: String(d.primaryCountry ?? '') || EMPTY_DRAFT.primaryCountry,
      adminEmail: String(d.adminEmail ?? ''),
    };
  } catch {
    // Corrupt/unparseable draft must never break the wizard.
    clearStoredDraft();
    return null;
  }
}

function writeStoredDraft(draft: SetupDraft): void {
  try {
    if (typeof window === 'undefined') return;
    const envelope: StoredEnvelope = {
      v: 1,
      updatedAt: Date.now(),
      draft: pickPersisted(draft),
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
}

interface SetupContextValue {
  draft: SetupDraft;
  update: (patch: Partial<SetupDraft>) => void;
  reset: () => void;
  /** True once the persisted draft has been read on the client. */
  hydrated: boolean;
}

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SetupDraft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  // Avoid persisting before the stored draft has been merged in — otherwise an
  // early write could clobber a saved draft with the empty initial state.
  const canPersist = useRef(false);

  useEffect(() => {
    const stored = readStoredDraft();
    if (stored) {
      setDraft((current) => ({ ...current, ...stored }));
    }
    canPersist.current = true;
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<SetupDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (canPersist.current) {
        writeStoredDraft(next);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearStoredDraft();
    setDraft(EMPTY_DRAFT);
  }, []);

  const value = useMemo<SetupContextValue>(
    () => ({ draft, update, reset, hydrated }),
    [draft, update, reset, hydrated],
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
