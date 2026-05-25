'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getTenantOnboardingStepUrl,
  type TenantOnboardingWorkflowStepKey,
} from './onboarding-routing';

export function TenantContinuationBanner({
  stateToken,
  stepKey,
}: {
  stateToken: string;
  stepKey: TenantOnboardingWorkflowStepKey;
}) {
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!stateToken) {
      return;
    }

    setResumeUrl(`${window.location.origin}${getTenantOnboardingStepUrl(stateToken, stepKey)}`);
  }, [stateToken, stepKey]);

  useEffect(() => () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
  }, []);

  const copy = useCallback(async () => {
    if (!resumeUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopied(true);
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [resumeUrl]);

  if (!resumeUrl) {
    return null;
  }

  return (
    <div className="mb-6 flex justify-end">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-ink-200 bg-white px-3 text-[12px] font-medium text-ink-500 transition hover:border-primary-200 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {copied ? 'Link kopyalandı' : 'Devam linkini kopyala'}
      </button>
    </div>
  );
}
