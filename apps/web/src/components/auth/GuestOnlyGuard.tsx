'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { readAuthSession } from '@/lib/storage/auth-session';

/**
 * Guest-only guard for auth-flow pages (/login, /signup).
 *
 * Renders its children only when there is NO customer session. If the visitor
 * is already signed in, they are redirected to the home page — a logged-in
 * customer must never see the login/signup screens.
 */
export function GuestOnlyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (readAuthSession()) {
      router.replace('/');
      return;
    }
    setChecked(true);
  }, [router]);

  // Until the session check resolves, render nothing so the auth form is
  // never briefly shown to an already-authenticated customer.
  if (!checked) {
    return null;
  }

  return <>{children}</>;
}
