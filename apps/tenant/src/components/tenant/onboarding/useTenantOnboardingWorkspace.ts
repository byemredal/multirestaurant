'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import {
  completeTenantOnboardingStep,
  completeTenantOnboardingStepByStateToken,
  getTenantOnboardingWorkspace,
  patchTenantOnboardingStep,
  patchTenantOnboardingStepByStateToken,
  submitTenantOnboarding,
  submitTenantOnboardingByStateToken,
  uploadTenantOnboardingDocument,
  uploadTenantOnboardingDocumentByStateToken,
  type TenantBusinessInfoInput,
  type TenantLegalTaxInfoInput,
  type TenantOnboardingResolvedSession,
  type TenantOnboardingStepKey,
  type TenantOnboardingWorkspace,
  type TenantOperationsInfoInput,
  type TenantOwnerContactInfoInput,
  type UploadTenantOnboardingDocumentInput,
  getTenantOnboardingWorkspaceByStateToken,
  resolveTenantOnboardingSession,
} from '@/lib/tenant-onboarding-client';
import {
  getNextTenantOnboardingStepKey,
  getWorkflowStepForBackendStep,
} from './onboarding-routing';
import {
  clearOnboardingStateToken,
  writeOnboardingStateToken,
} from '@/lib/storage/tenant-session';

// Statuses where the application no longer accepts state-token writes;
// keeping the stale token in localStorage causes a 403 ping on the next
// landing visit. See onboarding-state-model.md → Risks (R5).
const TERMINAL_APPLICATION_STATUSES = new Set([
  'approved',
  'active',
  'suspended',
  'rejected',
]);

const workspaceCache = new Map<string, TenantOnboardingWorkspace>();

function getWorkspaceCacheKey(stateToken?: string, tenantId?: string) {
  if (stateToken) {
    return `state:${stateToken}`;
  }

  return tenantId ? `tenant:${tenantId}` : null;
}

/**
 * Onboarding workspace state. Authentication and lifecycle routing are owned by
 * `TenantAuthProvider` / `TenantGate`; this hook only loads and mutates the
 * onboarding application for the already-authenticated tenant. It re-fetches
 * whenever the backend pushes a status change over SSE (e.g. an admin requests
 * a revision), which replaces the old 12s polling loop.
 */
export function useTenantOnboardingWorkspace(stateToken?: string, requestedStep?: string) {
  const { session, onboardingStatus } = useTenantAuth();
  const initialCacheKey = getWorkspaceCacheKey(stateToken, session?.tenant.id);
  const initialWorkspace = initialCacheKey ? workspaceCache.get(initialCacheKey) ?? null : null;
  const [currentStateToken, setCurrentStateToken] = useState(stateToken);
  const currentStateTokenRef = useRef(stateToken);
  const workspaceRequestSeqRef = useRef(0);
  const latestAppliedWorkspaceSeqRef = useRef(0);
  const lastResolvedKeyRef = useRef<string | null>(null);
  const loadingRequestSeqRef = useRef(0);
  const hasAppliedWorkspaceRef = useRef(Boolean(initialWorkspace));
  const [workspace, setWorkspace] = useState<TenantOnboardingWorkspace | null>(initialWorkspace);
  const [resolvedSession, setResolvedSession] = useState<TenantOnboardingResolvedSession | null>(null);
  const [loading, setLoading] = useState(Boolean(requestedStep) || !initialWorkspace);
  const [error, setError] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState<TenantOnboardingStepKey | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentStateToken(stateToken);
    currentStateTokenRef.current = stateToken;
  }, [stateToken]);

  const rememberStateToken = useCallback((nextStateToken: string) => {
    currentStateTokenRef.current = nextStateToken;
    setCurrentStateToken(nextStateToken);
    writeOnboardingStateToken(nextStateToken);
  }, []);

  const keepRouteTokenInWorkspace = useCallback(
    (nextWorkspace: TenantOnboardingWorkspace) => {
      const routeToken = stateToken ? currentStateTokenRef.current ?? stateToken : null;
      if (!routeToken || nextWorkspace.stateToken === routeToken) {
        return nextWorkspace;
      }

      return {
        ...nextWorkspace,
        application: {
          ...nextWorkspace.application,
          stateToken: routeToken,
        },
        stateToken: routeToken,
      };
    },
    [stateToken],
  );

  const replaceWorkspace = useCallback(
    (
      nextWorkspace: TenantOnboardingWorkspace,
      requestSeq?: number,
      options?: { rememberToken?: boolean },
    ) => {
      const nextSeq = requestSeq ?? workspaceRequestSeqRef.current + 1;
      if (nextSeq < latestAppliedWorkspaceSeqRef.current) {
        return;
      }
      workspaceRequestSeqRef.current = Math.max(workspaceRequestSeqRef.current, nextSeq);
      latestAppliedWorkspaceSeqRef.current = nextSeq;

      const cacheKey = getWorkspaceCacheKey(
        nextWorkspace.stateToken,
        nextWorkspace.application.tenantAccountId,
      );

      if (cacheKey) {
        workspaceCache.set(cacheKey, nextWorkspace);
      }

      if (TERMINAL_APPLICATION_STATUSES.has(nextWorkspace.application.status)) {
        // Stale state token cannot do useful work after a terminal status —
        // drop it so the next landing visit goes through a fresh start/resume
        // instead of pinging the API with a 403-bound token.
        clearOnboardingStateToken();
      } else if (options?.rememberToken ?? true) {
        rememberStateToken(nextWorkspace.stateToken);
      }
      setWorkspace(nextWorkspace);
      hasAppliedWorkspaceRef.current = true;
      setLastCheckedAt(new Date());
    },
    [rememberStateToken],
  );

  // A V2 mutation response is already authoritative for displayed data, but
  // its freshly issued token belongs to the next URL. Keeping it out of the
  // current route dependency prevents resolving the just-completed old step.
  const applyMutationWorkspace = useCallback(
    (nextWorkspace: TenantOnboardingWorkspace) => {
      replaceWorkspace(keepRouteTokenInWorkspace(nextWorkspace), undefined, { rememberToken: false });
    },
    [keepRouteTokenInWorkspace, replaceWorkspace],
  );

  // Fire-and-forget workspace re-read. Callers (saveDraft / completeStep)
  // resolve immediately on the primary write response so navigation +
  // URL update can happen on the next React commit; the workspace
  // re-renders ~one roundtrip later when this lands.
  const refreshWorkspaceInBackground = useCallback(
    (token: string) => {
      const requestSeq = workspaceRequestSeqRef.current + 1;
      workspaceRequestSeqRef.current = requestSeq;
      void (async () => {
        try {
          const nextWorkspace = await getTenantOnboardingWorkspaceByStateToken(token);
          replaceWorkspace(nextWorkspace, requestSeq, { rememberToken: false });
        } catch {
          // best-effort — the primary action already succeeded
        }
      })();
    },
    [replaceWorkspace],
  );

  const loadWorkspace = useCallback(async () => {
    if (!session && !currentStateToken) {
      return;
    }
    let requestSeq: number | null = null;
    try {
      setError(null);
      const resolveKey = currentStateToken && requestedStep
        ? `${currentStateToken}:${requestedStep}`
        : null;
      if (resolveKey && lastResolvedKeyRef.current === resolveKey && hasAppliedWorkspaceRef.current) {
        setLoading(false);
        return;
      }

      const cacheKey = getWorkspaceCacheKey(currentStateToken, session?.tenant.id);
      const cachedWorkspace = cacheKey ? workspaceCache.get(cacheKey) : null;

      if (cachedWorkspace && !requestedStep) {
        setWorkspace(cachedWorkspace);
        setLoading(false);
      } else if (!lastResolvedKeyRef.current) {
        setLoading(true);
      }

      requestSeq = workspaceRequestSeqRef.current + 1;
      workspaceRequestSeqRef.current = requestSeq;
      loadingRequestSeqRef.current = requestSeq;
      if (currentStateToken && requestedStep) {
        const nextSession = await resolveTenantOnboardingSession(currentStateToken, requestedStep);
        if (requestSeq < loadingRequestSeqRef.current) {
          return;
        }
        lastResolvedKeyRef.current = resolveKey;
        const stableWorkspace = keepRouteTokenInWorkspace(nextSession.workspace);
        setResolvedSession({
          ...nextSession,
          stateToken: currentStateToken,
          workspace: stableWorkspace,
        });
        replaceWorkspace(stableWorkspace, requestSeq, { rememberToken: false });
      } else {
        const nextWorkspace = currentStateToken
          ? await getTenantOnboardingWorkspaceByStateToken(currentStateToken)
          : await getTenantOnboardingWorkspace(session!);
        if (requestSeq < loadingRequestSeqRef.current) {
          return;
        }
        lastResolvedKeyRef.current = null;
        setResolvedSession(null);
        replaceWorkspace(keepRouteTokenInWorkspace(nextWorkspace), requestSeq, { rememberToken: false });
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Tenant onboarding state could not be loaded.',
      );
    } finally {
      if (requestSeq === null || requestSeq >= loadingRequestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [currentStateToken, keepRouteTokenInWorkspace, replaceWorkspace, requestedStep, session]);

  // Initial load + SSE-driven refresh: `onboardingStatus` changes when the API
  // pushes a transition, so the workspace re-fetches without polling.
  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace, onboardingStatus]);

  const ensureSession = useCallback(() => {
    if (!session) {
      throw new Error('Tenant session is not available.');
    }
    return session;
  }, [session]);

  const saveDraft = useCallback(
    async (
      step: Exclude<TenantOnboardingStepKey, 'documents' | 'final_review'>,
      payload:
        | TenantBusinessInfoInput
        | TenantLegalTaxInfoInput
        | TenantOwnerContactInfoInput
        | TenantOperationsInfoInput,
    ) => {
      setSavingStep(step);
      setError(null);

      try {
        const result = stateToken
          ? await patchTenantOnboardingStepByStateToken(
              currentStateTokenRef.current ?? stateToken,
              step,
              payload,
            )
          : await patchTenantOnboardingStep(ensureSession(), step, payload);
        rememberStateToken(result.stateToken);
        // URL-sync optimization: refresh workspace in the background so the
        // caller (saveStepAndAdvance → completeStep) can proceed without
        // waiting on a second GET roundtrip.
        refreshWorkspaceInBackground(result.stateToken);
        return result;
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : 'Onboarding step could not be saved.';
        setError(message);
        throw saveError;
      } finally {
        setSavingStep(null);
      }
    },
    [ensureSession, refreshWorkspaceInBackground, rememberStateToken, stateToken],
  );

  const completeStep = useCallback(
    async (step: TenantOnboardingStepKey) => {
      setSavingStep(step);
      setError(null);

      try {
        if (stateToken) {
          const result = await completeTenantOnboardingStepByStateToken(
            currentStateTokenRef.current ?? stateToken,
            step,
          );
          rememberStateToken(result.stateToken);
          if (result.workspace) {
            replaceWorkspace(result.workspace);
          } else {
            refreshWorkspaceInBackground(result.stateToken);
          }
          return {
            ...result,
            nextStepKey: getWorkflowStepForBackendStep(result.nextStepKey),
          };
        }

        const result = await completeTenantOnboardingStep(ensureSession(), step);
        replaceWorkspace(result.workspace);
        return {
          stepKey: result.stepKey,
          status: result.status,
          nextStepKey: getNextTenantOnboardingStepKey(
            getWorkflowStepForBackendStep(result.stepKey),
          ),
          stateToken: result.workspace.stateToken,
        };
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : 'Onboarding step could not be completed.';
        setError(message);
        throw saveError;
      } finally {
        setSavingStep(null);
      }
    },
    [ensureSession, refreshWorkspaceInBackground, rememberStateToken, replaceWorkspace, stateToken],
  );

  const uploadDocument = useCallback(
    async (file: File, payload: UploadTenantOnboardingDocumentInput) => {
      setSavingStep('documents');
      setError(null);

      try {
        const result = stateToken
          ? await uploadTenantOnboardingDocumentByStateToken(
              currentStateTokenRef.current ?? stateToken,
              file,
              payload,
            )
          : await uploadTenantOnboardingDocument(ensureSession(), file, payload);
        replaceWorkspace(result.workspace);
        return result.workspace;
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : 'Document could not be saved.';
        setError(message);
        throw saveError;
      } finally {
        setSavingStep(null);
      }
    },
    [ensureSession, replaceWorkspace, stateToken],
  );

  const submitForReview = useCallback(async () => {
    setSavingStep('final_review');
    setError(null);

    try {
      const result = stateToken
        ? await submitTenantOnboardingByStateToken(currentStateTokenRef.current ?? stateToken)
        : await submitTenantOnboarding(ensureSession());
      replaceWorkspace(result.workspace);
      return result.workspace;
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Onboarding could not be submitted.';
      setError(message);
      throw submitError;
    } finally {
      setSavingStep(null);
    }
  }, [ensureSession, replaceWorkspace, stateToken]);

  return {
    error,
    lastCheckedAt,
    loading,
    resolvedSession,
    savingStep,
    session,
    workspace,
    completeStep,
    loadWorkspace,
    replaceWorkspace,
    applyMutationWorkspace,
    saveDraft,
    submitForReview,
    uploadDocument,
  };
}
