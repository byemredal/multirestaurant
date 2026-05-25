'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffAuth } from '@/lib/auth/staff-auth-context';

/**
 * The routing authority for `/staff/*` pages. Like TenantGate but for the
 * staff session. Public staff paths (login, accept-invite) skip the auth
 * requirement; everything else bounces an unauthenticated visitor to
 * /staff/login.
 *
 * The component must be mounted INSIDE StaffAuthProvider.
 */
const PUBLIC_STAFF_PATHS = new Set<string>([
  '/staff/login',
  '/staff/accept-invite',
]);

export function StaffSessionGate({
  children,
  requireAuth = true,
}: {
  children: ReactNode;
  requireAuth?: boolean;
}) {
  const { session, loading } = useStaffAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = PUBLIC_STAFF_PATHS.has(pathname);
  const authed = Boolean(session);

  useEffect(() => {
    if (loading) return;
    if (requireAuth && !isPublicPath && !authed) {
      router.replace('/staff/login');
      return;
    }
    if (isPublicPath && authed && pathname === '/staff/login') {
      router.replace('/staff/dashboard');
    }
  }, [loading, requireAuth, isPublicPath, authed, pathname, router]);

  if (loading) {
    return <StaffRouteLoading />;
  }
  if (requireAuth && !isPublicPath && !authed) {
    return <StaffRouteLoading />;
  }
  return <>{children}</>;
}

function StaffRouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="ml-3 text-[14px] text-ink-500">Yükleniyor…</span>
    </div>
  );
}
