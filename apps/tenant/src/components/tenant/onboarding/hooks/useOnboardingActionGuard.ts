'use client';

import { useCallback, useRef } from 'react';

export function useOnboardingActionGuard() {
  const actionRunningRef = useRef(false);

  return useCallback(async (action: () => Promise<void>) => {
    if (actionRunningRef.current) {
      return;
    }

    actionRunningRef.current = true;
    try {
      await action();
    } finally {
      actionRunningRef.current = false;
    }
  }, []);
}
