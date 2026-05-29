'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@lieferzonen/ui';
import { defaultLogoDataUrl } from '@lieferzonen/assets';
import { useBranding } from '@/lib/branding/BrandingProvider';
import { adminDemoSurfacesEnabled, findNavItemByPath, isLiveNavItem } from '@/lib/admin-navigation';
import Sidebar, { type SidebarBadgeMap } from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';
import { adminRoles, type AdminRole } from '@/lib/rbac/roles';
import { bootstrapAdminSession, logoutAdmin } from '@/lib/admin-api/admin-auth-client';
import {
  broadcastAdminAuthEvent,
  subscribeAdminAuthEvents,
} from '@/lib/admin-api/auth-expiry';
import {
  clearAdminSession,
  readAdminSession,
  writeAdminSession,
  type StoredAdminSession,
} from '@/lib/storage/admin-session';

export type { SidebarBadgeMap };

const COLLAPSE_KEY = 'lz.admin.sidebar-collapsed';
const ROLE_KEY = 'lz.admin.view-role';

export default function AdminShell({
  title,
  description,
  children,
  badges,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  badges?: SidebarBadgeMap;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [session, setSession] = useState<StoredAdminSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [role, setRole] = useState<AdminRole>('super_admin');
  const branding = useBranding();
  const platformLabel = branding?.platformName?.trim() || 'Platform';

  // hydrate persisted shell preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === 'true');
    const storedRole = window.localStorage.getItem(ROLE_KEY);
    if (storedRole && storedRole in adminRoles) {
      setRole(storedRole as AdminRole);
    }
  }, []);

  // session bootstrap / guard
  useEffect(() => {
    const run = async () => {
      const stored = readAdminSession();
      if (!stored) {
        router.replace('/login');
        return;
      }
      try {
        const next = await bootstrapAdminSession(stored);
        writeAdminSession(next);
        setSession(next);
      } catch {
        clearAdminSession();
        router.replace('/login?reason=session_expired');
      } finally {
        setBooting(false);
      }
    };
    void run();
  }, [router]);

  // Cross-tab auth events: another tab logged out or saw a session expiry —
  // clear local state and bounce to login without re-broadcasting (the source
  // tab already broadcasted). Same-tab expiries go through window.location
  // inside the authedFetch wrapper, so this only runs for remote tabs.
  useEffect(() => {
    return subscribeAdminAuthEvents((event) => {
      clearAdminSession();
      setSession(null);
      router.replace(
        event.type === 'session_expired'
          ? '/login?reason=session_expired'
          : '/login',
      );
    });
  }, [router]);

  // ⌘K / Ctrl+K command palette
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCmdkOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSE_KEY, String(next));
      }
      return next;
    });
  }, []);

  const handleRoleChange = useCallback((next: AdminRole) => {
    setRole(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROLE_KEY, next);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    if (session) {
      try {
        await logoutAdmin(session);
      } catch {
        /* local clear is the safe fallback */
      }
    }
    clearAdminSession();
    broadcastAdminAuthEvent('manual_logout');
    router.replace('/login');
  }, [router, session]);

  if (booting) {
    return (
      <div className="app-shell" data-collapsed="false">
        <aside className="app-sidebar">
          <div className="app-sidebar__brand">
            <Logo
              src={branding?.logoUrl || undefined}
              fallbackSrc={defaultLogoDataUrl}
              fallbackText={platformLabel}
              alt={platformLabel}
              height={28}
            />
            <div className="app-sidebar__brand-text">
              <div className="app-sidebar__brand-name">{platformLabel}</div>
              <div className="app-sidebar__brand-meta">Operations Console</div>
            </div>
          </div>
          <div className="app-sidebar__nav" />
        </aside>
        <main className="app-main">
          <div className="app-topbar" />
          <div style={{ padding: 28, color: 'var(--muted)' }}>
            Loading admin session…
          </div>
        </main>
      </div>
    );
  }

  const firstName = session?.admin.firstName ?? '';
  const lastName = session?.admin.lastName ?? '';
  const displayName = `${firstName} ${lastName}`.trim() || 'Admin User';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'A';
  const roleLabel = adminRoles[role].label;

  const currentNavItem = findNavItemByPath(pathname);
  const isBlockedDemoSurface =
    currentNavItem ? !isLiveNavItem(currentNavItem) && !adminDemoSurfacesEnabled : false;
  const showMockBanner = currentNavItem ? !isLiveNavItem(currentNavItem) && adminDemoSurfacesEnabled : false;

  return (
    <div
      className="app-shell"
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
    >
      <div
        className="app-sidebar__scrim"
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        role={role}
        badges={badges}
        onNavigate={() => setMobileOpen(false)}
        user={{ name: displayName, roleLabel, initials }}
      />

      <main className="app-main">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onOpenCmdk={() => setCmdkOpen(true)}
          role={role}
          onRoleChange={handleRoleChange}
          user={{
            name: displayName,
            email: session?.admin.email ?? '',
            initials,
            roleLabel,
          }}
          onSignOut={handleSignOut}
        />

        <div className="admin-content">
          {showMockBanner && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 18,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--warning)',
                background: 'var(--warning-soft, rgba(245, 158, 11, 0.12))',
                color: 'var(--warning)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--warning)',
                  flexShrink: 0,
                }}
              />
              Demo görünüm — bu sayfa örnek veri gösterir. Üretim verisi henüz
              bağlı değil ve MVP kapsamı dışındadır.
            </div>
          )}
          {title && (
            <div className="admin-page-head" style={{ marginBottom: 18 }}>
              <div>
                <h1 className="admin-page-head__title">{title}</h1>
                {description && (
                  <p className="admin-page-head__desc">{description}</p>
                )}
              </div>
            </div>
          )}
          {isBlockedDemoSurface ? (
            <div role="status" className="admin-card">
              This demo-only operation surface is disabled in production.
            </div>
          ) : children}
        </div>
      </main>

      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
    </div>
  );
}
