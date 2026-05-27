'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Logo } from '@lieferzonen/ui';
import { defaultPlatformMarkDataUrl } from '@lieferzonen/assets';
import { adminAppName } from '@/lib/config';
import { useBranding } from '@/lib/branding/BrandingProvider';
import { Icon } from '@/lib/icons';
import {
  isLiveNavItem,
  resolveItemLabel,
  resolveSectionLabel,
  visibleAdminNavSections,
} from '@/lib/admin-navigation';
import { canAccess, type AdminRole } from '@/lib/rbac/roles';
import { useTerminology } from '@/lib/terminology/TerminologyProvider';

export type SidebarBadgeMap = Record<string, number>;

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  role: AdminRole;
  badges?: SidebarBadgeMap;
  /** Closes the mobile drawer after navigation. */
  onNavigate?: () => void;
  user: { name: string; roleLabel: string; initials: string };
};

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
  role,
  badges,
  onNavigate,
  user,
}: SidebarProps) {
  const pathname = usePathname() ?? '';
  const { preset } = useTerminology();
  const branding = useBranding();
  const platformName = branding?.platformName?.trim() || adminAppName;
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});

  const sections = useMemo(
    () => visibleAdminNavSections.filter((section) => canAccess(role, section.access)),
    [role],
  );

  const toggleGroup = (id: string) =>
    setClosedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="app-sidebar__brand">
        <Logo
          src={branding?.logoUrl || undefined}
          fallbackSrc={defaultPlatformMarkDataUrl}
          fallbackText={platformName}
          alt={platformName}
          height={28}
        />
        {!collapsed && (
          <div className="app-sidebar__brand-text">
            <div className="app-sidebar__brand-name">{platformName}</div>
            <div className="app-sidebar__brand-meta">Operations Console</div>
          </div>
        )}
        <button
          type="button"
          className="app-sidebar__collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon.sidebar width={17} height={17} />
        </button>
      </div>

      <nav className="app-sidebar__nav">
        {sections.map((section) => {
          const open = !closedGroups[section.id];
          const hasActive = section.items.some((item) => item.matches(pathname));

          return (
            <div key={section.id} className="app-nav-group" data-open={open}>
              {collapsed ? (
                <div className="app-nav-group__divider" />
              ) : (
                <button
                  type="button"
                  className="app-nav-group__label"
                  onClick={() => toggleGroup(section.id)}
                >
                  <span>{resolveSectionLabel(section, preset)}</span>
                  <Icon.chevronDown
                    className="app-nav-group__chevron"
                    width={13}
                    height={13}
                  />
                </button>
              )}

              {(collapsed || open || hasActive) && (
                <div>
                  {section.items.map((item) => {
                    const ItemIcon = Icon[item.icon];
                    const isActive = item.matches(pathname);
                    const count = item.badgeKey
                      ? badges?.[item.badgeKey]
                      : undefined;
                    const label = resolveItemLabel(item, preset);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onNavigate}
                        title={collapsed ? label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={`app-nav-link${
                          isActive ? ' app-nav-link--active' : ''
                        }`}
                      >
                        <span className="app-nav-link__icon">
                          <ItemIcon width={17} height={17} />
                        </span>
                        <span className="app-nav-link__label">{label}</span>
                        {typeof count === 'number' && count > 0 && (
                          <span className="app-nav-link__count">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                        {item.comingSoon && !count && (
                          <span className="app-nav-link__soon">Soon</span>
                        )}
                        {!item.comingSoon && !count && !isLiveNavItem(item) && (
                          <span className="app-nav-link__soon">Demo</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="app-sidebar__footer">
        <div className="app-sidebar__user" style={{ cursor: 'default' }}>
          <span className="app-avatar">{user.initials}</span>
          <span className="app-sidebar__footer-text">
            <span className="app-sidebar__user-name">{user.name}</span>
            <span className="app-sidebar__user-role">{user.roleLabel}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
