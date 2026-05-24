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
  type TenantOnboardingStepKey,
  type TenantOnboardingWorkspace,
  type TenantOperationsInfoInput,
  type TenantOwnerContactInfoInput,
  type UploadTenantOnboardingDocumentInput,
  getTenantOnboardingWorkspaceByStateToken,
} from '@/lib/tenant-onboarding-client';
import {
  getNextTenantOnboardingStepKey,
  getWorkflowStepForBackendStep,
} from './onboarding-routing';
import { writeOnboardingStateToken } from '@/lib/storage/tenant-session';

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
export function useTenantOnboardingWorkspace(stateToken?: string) {
  const { session, onboardingStatus } = useTenantAuth();
  const initialCacheKey = getWorkspaceCacheKey(stateToken, session?.tenant.id);
  const initialWorkspace = initialCacheKey ? workspaceCache.get(initialCacheKey) ?? null : null;
  const [currentStateToken, setCurrentStateToken] = useState(stateToken);
  const currentStateTokenRef = useRef(stateToken);
  const [workspace, setWorkspace] = useState<TenantOnboardingWorkspace | null>(initialWorkspace);
  const [loading, setLoading] = useState(!initialWorkspace);
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

  const replaceWorkspace = useCallback(
    (nextWorkspace: TenantOnboardingWorkspace) => {
      const cacheKey = getWorkspaceCacheKey(
        nextWorkspace.stateToken,
        nextWorkspace.application.tenantAccountId,
      );

      if (cacheKey) {
        workspaceCache.set(cacheKey, nextWorkspace);
      }

      rememberStateToken(nextWorkspace.stateToken);
      setWorkspace(nextWorkspace);
      setLastCheckedAt(new Date());
    },
    [rememberStateToken],
  );

  const loadWorkspace = useCallback(async () => {
    if (!session && !currentStateToken) {
      return;
    }
    try {
      setError(null);
      const cacheKey = getWorkspaceCacheKey(currentStateToken, session?.tenant.id);
      const cachedWorkspace = cacheKey ? workspaceCache.get(cacheKey) : null;

      if (cachedWorkspace) {
        setWorkspace(cachedWorkspace);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const nextWorkspace = currentStateToken
        ? await getTenantOnboardingWorkspaceByStateToken(currentStateToken)
        : await getTenantOnboardingWorkspace(session!);
      const nextCacheKey = getWorkspaceCacheKey(nextWorkspace.stateToken, nextWorkspace.application.tenantAccountId);
      workspaceCache.set(nextCacheKey, nextWorkspace);
      setWorkspace(nextWorkspace);
      setLastCheckedAt(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Tenant onboarding state could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentStateToken, session]);

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
        const nextWorkspace = await getTenantOnboardingWorkspaceByStateToken(result.stateToken);
        workspaceCache.set(
          getWorkspaceCacheKey(result.stateToken, nextWorkspace.application.tenantAccountId)!,
          nextWorkspace,
        );
        setWorkspace(nextWorkspace);
        return nextWorkspace;
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : 'Onboarding step could not be saved.';
        setError(message);
        throw saveError;
      } finally {
        setSavingStep(null);
      }
    },
    [ensureSession, rememberStateToken, stateToken],
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
          const nextWorkspace = await getTenantOnboardingWorkspaceByStateToken(result.stateToken);
          rememberStateToken(result.stateToken);
          workspaceCache.set(
            getWorkspaceCacheKey(result.stateToken, nextWorkspace.application.tenantAccountId)!,
            nextWorkspace,
          );
          setWorkspace(nextWorkspace);
          return {
            ...result,
            nextStepKey: getWorkflowStepForBackendStep(result.nextStepKey),
            workspace: nextWorkspace,
          };
        }

        const result = await completeTenantOnboardingStep(ensureSession(), step);
        const nextWorkspace = result.workspace;
        workspaceCache.set(
          getWorkspaceCacheKey(nextWorkspace.stateToken, nextWorkspace.application.tenantAccountId)!,
          nextWorkspace,
        );
        setWorkspace(nextWorkspace);
        return {
          stepKey: result.stepKey,
          status: result.status,
          nextStepKey: getNextTenantOnboardingStepKey(
            getWorkflowStepForBackendStep(result.stepKey),
          ),
          stateToken: nextWorkspace.stateToken,
          workspace: nextWorkspace,
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
    [ensureSession, rememberStateToken, stateToken],
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
        workspaceCache.set(
          getWorkspaceCacheKey(result.workspace.stateToken, result.workspace.application.tenantAccountId)!,
          result.workspace,
        );
        setWorkspace(result.workspace);
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
    [ensureSession, stateToken],
  );

  const submitForReview = useCallback(async () => {
    setSavingStep('final_review');
    setError(null);

    try {
      const result = stateToken
        ? await submitTenantOnboardingByStateToken(currentStateTokenRef.current ?? stateToken)
        : await submitTenantOnboarding(ensureSession());
      workspaceCache.set(
        getWorkspaceCacheKey(result.workspace.stateToken, result.workspace.application.tenantAccountId)!,
        result.workspace,
      );
      setWorkspace(result.workspace);
      return result.workspace;
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Onboarding could not be submitted.';
      setError(message);
      throw submitError;
    } finally {
      setSavingStep(null);
    }
  }, [ensureSession, stateToken]);

  return {
    error,
    lastCheckedAt,
    loading,
    savingStep,
    session,
    workspace,
    completeStep,
    loadWorkspace,
    replaceWorkspace,
    saveDraft,
    submitForReview,
    uploadDocument,
  };
}
