'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Owns the per-step field-error map used by editable onboarding panels.
 * Resets automatically when the active step changes so a validation
 * error on `location` doesn't bleed into `business-details`.
 *
 * Replaces the inline `useState<Record<string, string>>({})` + the
 * `useEffect(() => setFieldErrors({}), [activeStep])` pair that used
 * to live in TenantOnboardingStepPanel.tsx. No global state, no
 * context — one hook instance per panel render.
 */
export function useFieldErrors(activeStep: string) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setErrors({});
  }, [activeStep]);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, setErrors, clearAll };
}
