'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { isPathAllowedForStatus, routeForStatus } from '@/lib/auth/tenant-status';

/**
 * The single routing authority for the tenant app. Routing depends purely on
 * the backend lifecycle status — never on URL structure. When the tenant is
 * on a path that does not match their state, the gate replaces the URL with
 * the correct clean route. Status changes pushed over SSE flow through here,
 * so an admin approval auto-redirects the tenant to the dashboard.
 */
export function TenantGate({ children }: { children: ReactNode }) {
  const { session, status, loading } = useTenantAuth();
  const router = useRouter();
  const pathname = usePathname();

  const authed = Boolean(session);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!isPathAllowedForStatus(status, authed, pathname)) {
      router.replace(routeForStatus(status, authed));
    }
  }, [loading, status, authed, pathname, router]);

  if (loading) {
    return <TenantRouteLoading />;
  }

  // While a corrective redirect is pending, avoid flashing the wrong screen.
  if (!isPathAllowedForStatus(status, authed, pathname)) {
    return <TenantRouteLoading />;
  }

  return <>{children}</>;
}

export function TenantRouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="ml-3 text-[14px] text-ink-500">Yükleniyor…</span>
    </div>
  );
}
