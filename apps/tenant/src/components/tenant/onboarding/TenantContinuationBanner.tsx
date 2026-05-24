'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!stateToken) {
      return;
    }

    setResumeUrl(`${window.location.origin}${getTenantOnboardingStepUrl(stateToken, stepKey)}`);
  }, [stateToken, stepKey]);

  if (!resumeUrl) {
    return null;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mb-5 flex justify-end">
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 text-[12.5px] font-semibold text-primary-700 transition hover:border-primary-200 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
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
