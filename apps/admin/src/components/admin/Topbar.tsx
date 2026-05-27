'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Popover from '@/components/ui/Popover';
import { Icon } from '@/lib/icons';
import { mockNotifications } from '@/lib/mock/notifications';
import { adminDemoSurfacesEnabled } from '@/lib/admin-navigation';
import { adminRoleList, type AdminRole } from '@/lib/rbac/roles';
import {
  terminologyPresetList,
  type TerminologyPresetId,
} from '@/lib/terminology/terminology.config';
import { useTerminology } from '@/lib/terminology/TerminologyProvider';

const ENV = (process.env.NEXT_PUBLIC_ADMIN_ENV ?? 'production') as
  | 'production'
  | 'staging'
  | 'development';

const ENV_META: Record<
  string,
  { label: string; cls: string }
> = {
  production: { label: 'Ürün', cls: 'app-env--prod' },
  staging: { label: 'Staging', cls: 'app-env--staging' },
  development: { label: 'Geliştirme', cls: 'app-env--dev' },
};

type TopbarProps = {
  onMenuClick: () => void;
  onOpenCmdk: () => void;
  role: AdminRole;
  onRoleChange: (role: AdminRole) => void;
  user: { name: string; email: string; initials: string; roleLabel: string };
  onSignOut: () => void;
};

export default function Topbar({
  onMenuClick,
  onOpenCmdk,
  role,
  onRoleChange,
  user,
  onSignOut,
}: TopbarProps) {
  const router = useRouter();
  const { presetId, setPresetId } = useTerminology();
  const [readIds, setReadIds] = useState<string[]>([]);

  // Admin operational context — what scope this session is acting on. Today
  // we ship a single placeholder scope; multi-region/tenant scoping is a
  // future feature. The platform brand must never appear in this list — it
  // would conflate "what we are" with "what we manage".
  const adminContextScopes = [
    {
      id: 'platform-wide',
      label: 'Platform Yönetimi',
      meta: 'Tüm operasyon kapsamı',
      initials: 'PY',
    },
    {
      id: 'northern-region',
      label: 'Northern Region',
      meta: 'Bölge kapsamı (demo)',
      initials: 'NR',
    },
    {
      id: 'demo-sandbox',
      label: 'Demo Sandbox',
      meta: 'Test ortamı',
      initials: 'DS',
    },
  ].filter((scope) => adminDemoSurfacesEnabled || scope.id === 'platform-wide');
  const activeContextScope = adminContextScopes[0]!;

  const notifications = adminDemoSurfacesEnabled ? mockNotifications : [];
  const unread = notifications.filter(
    (n) => !n.read && !readIds.includes(n.id),
  ).length;
  const env = ENV_META[ENV] ?? ENV_META.production;

  const navTo = (href: string, close: () => void) => {
    close();
    router.push(href);
  };

  return (
    <header className="app-topbar">
      <button
        type="button"
        className="app-iconbtn app-topbar__menu"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Icon.dots width={18} height={18} />
      </button>

      <button type="button" className="app-search" onClick={onOpenCmdk}>
        <Icon.search width={16} height={16} />
        <span className="app-search__text">Arama veya atla…</span>
        <span className="app-search__kbd">
          <span className="app-kbd">⌘</span>
          <span className="app-kbd">K</span>
        </span>
      </button>

      {/* Admin context / scope switcher — NOT the platform brand. The label
          + dropdown items describe the operational kapsam the session is
          acting on; the platform name (e.g. "Yemekmarketi") belongs in the
          sidebar mark, not as a workspace entry. */}
      <Popover
        align="left"
        trigger={() => (
          <button type="button" className="app-switcher" aria-label="Yönetim kapsamı">
            <span className="app-switcher__logo" aria-hidden>
              {activeContextScope.initials}
            </span>
            <span className="app-switcher__text">
              <span className="app-switcher__name">{activeContextScope.label}</span>
              <span className="app-switcher__meta">{activeContextScope.meta}</span>
            </span>
            <Icon.chevronDown width={14} height={14} />
          </button>
        )}
      >
        {(close) => (
          <>
            <div className="app-menu__head">
              <div className="app-menu__title">Yönetim kapsamı</div>
              <div className="app-menu__meta">
                Her sayfa için aktif operasyon kapsamını seçin.
              </div>
            </div>
            <div className="app-menu__sep" />
            <div className="app-menu__label">Kapsam</div>
            {adminContextScopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                className="app-menu__item"
                onClick={close}
              >
                <span className="app-switcher__logo" aria-hidden>
                  {scope.initials}
                </span>
                <span>{scope.label}</span>
                {scope.id === activeContextScope.id && (
                  <Icon.check
                    className="app-menu__item-check"
                    width={16}
                    height={16}
                  />
                )}
              </button>
            ))}
            <div className="app-menu__sep" />
            <button type="button" className="app-menu__item" onClick={close}>
              <span className="app-menu__item-icon">
                <Icon.plus width={16} height={16} />
              </span>
              Yeni kapsam oluştur
            </button>
          </>
        )}
      </Popover>

      <div className="app-topbar__spacer" />

      <div className={`app-env ${env.cls}`} title="Current environment">
        {env.label}
      </div>

      <div className="app-topbar__sep" />

      <div className="app-topbar__actions">
        {/* Quick actions */}
        <Popover
          trigger={() => (
            <button
              type="button"
              className="app-iconbtn"
              aria-label="Quick actions"
              title="Quick actions"
            >
              <Icon.plus width={19} height={19} />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="app-menu__label">Quick actions</div>
              {[
                { label: 'Review application', icon: 'inbox', href: '/tenant-applications' },
                { label: 'Add a store', icon: 'store', href: '/stores' },
                { label: 'Create campaign', icon: 'megaphone', href: '/campaigns' },
                { label: 'Issue refund', icon: 'refund', href: '/finance/refunds' },
                { label: 'New feature flag', icon: 'flag', href: '/platform/feature-flags' },
              ].map((action) => {
                const ActionIcon = Icon[action.icon as keyof typeof Icon];
                return (
                  <button
                    key={action.label}
                    type="button"
                    className="app-menu__item"
                    onClick={() => navTo(action.href, close)}
                  >
                    <span className="app-menu__item-icon">
                      <ActionIcon width={16} height={16} />
                    </span>
                    {action.label}
                  </button>
                );
              })}
            </>
          )}
        </Popover>

        {/* Notifications */}
        <Popover
          trigger={() => (
            <button
              type="button"
              className="app-iconbtn"
              aria-label="Notifications"
              title="Notifications"
            >
              <Icon.bell width={19} height={19} />
              {unread > 0 && <span className="app-iconbtn__dot">{unread}</span>}
            </button>
          )}
        >
          {(close) => (
            <div style={{ width: 320 }}>
              <div className="app-menu__head">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div className="app-menu__title">Notifications</div>
                  <button
                    type="button"
                    className="admin-link"
                    style={{ fontSize: 12, background: 'none', border: 0, cursor: 'pointer' }}
                    onClick={() =>
                      setReadIds(notifications.map((n) => n.id))
                    }
                  >
                    Mark all read
                  </button>
                </div>
              </div>
              <div className="app-menu__sep" />
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifications.map((n) => {
                  const NIcon = Icon[n.icon];
                  const isRead = n.read || readIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className="app-noti"
                      style={{ width: '100%', border: 0, textAlign: 'left' }}
                      onClick={() => navTo(n.href, close)}
                    >
                      <span
                        className={`app-noti__dot${
                          isRead ? ' app-noti__dot--read' : ''
                        }`}
                      />
                      <span style={{ flex: 1 }}>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                          }}
                        >
                          <NIcon
                            width={14}
                            height={14}
                            style={{ color: 'var(--muted)' }}
                          />
                          <span className="app-noti__title">{n.title}</span>
                        </span>
                        <span className="app-noti__meta">{n.meta}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="app-menu__sep" />
              <button
                type="button"
                className="app-menu__item"
                onClick={() => navTo('/alerts', close)}
              >
                <span className="app-menu__item-icon">
                  <Icon.external width={16} height={16} />
                </span>
                View all alerts &amp; incidents
              </button>
            </div>
          )}
        </Popover>

        <div className="app-topbar__sep" />

        {/* User profile dropdown */}
        <Popover
          trigger={() => (
            <button
              type="button"
              className="app-iconbtn"
              style={{ width: 'auto', padding: '0 4px', gap: 6 }}
              aria-label="Account menu"
            >
              <span className="app-avatar" style={{ width: 30, height: 30 }}>
                {user.initials}
              </span>
              <Icon.chevronDown width={14} height={14} />
            </button>
          )}
        >
          {(close) => (
            <div style={{ width: 268 }}>
              <div className="app-menu__head">
                <div className="app-menu__title">{user.name}</div>
                <div className="app-menu__meta">{user.email}</div>
              </div>
              <div className="app-menu__sep" />

              <div className="app-menu__label">View as role</div>
              {adminRoleList.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="app-menu__item"
                  onClick={() => {
                    onRoleChange(r.id);
                    close();
                  }}
                >
                  <span className="app-menu__item-icon">
                    <Icon.shield width={16} height={16} />
                  </span>
                  {r.label}
                  {role === r.id && (
                    <Icon.check
                      className="app-menu__item-check"
                      width={16}
                      height={16}
                    />
                  )}
                </button>
              ))}

              <div className="app-menu__sep" />
              <div className="app-menu__label">Terminology</div>
              {terminologyPresetList.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="app-menu__item"
                  onClick={() => {
                    setPresetId(p.id as TerminologyPresetId);
                    close();
                  }}
                >
                  <span className="app-menu__item-icon">
                    <Icon.globe width={16} height={16} />
                  </span>
                  {p.label}
                  {presetId === p.id && (
                    <Icon.check
                      className="app-menu__item-check"
                      width={16}
                      height={16}
                    />
                  )}
                </button>
              ))}

              <div className="app-menu__sep" />
              <button
                type="button"
                className="app-menu__item"
                onClick={() => navTo('/system/configuration', close)}
              >
                <span className="app-menu__item-icon">
                  <Icon.settings width={16} height={16} />
                </span>
                System configuration
              </button>
              <button
                type="button"
                className="app-menu__item app-menu__item--danger"
                onClick={() => {
                  close();
                  onSignOut();
                }}
              >
                <span className="app-menu__item-icon">
                  <Icon.signout width={16} height={16} />
                </span>
                Sign out
              </button>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}
