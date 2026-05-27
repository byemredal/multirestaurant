'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@/lib/icons';
import { resolveItemLabel, visibleAdminNavSections } from '@/lib/admin-navigation';
import { useTerminology } from '@/lib/terminology/TerminologyProvider';

type Command = {
  id: string;
  label: string;
  group: string;
  icon: IconName;
  href: string;
  keywords?: string;
};

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { preset } = useTerminology();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const navCommands = visibleAdminNavSections.flatMap((section) =>
      section.items.map((item) => ({
        id: item.id,
        label: resolveItemLabel(item, preset),
        group: section.label,
        icon: item.icon,
        href: item.href,
        keywords: item.comingSoon ? 'coming soon planned' : '',
      })),
    );
    const quickActions: Command[] = [
      {
        id: 'qa-new-tenant',
        label: 'Review next application',
        group: 'Quick actions',
        icon: 'inbox',
        href: '/tenant-applications',
      },
    ];
    return [...quickActions, ...navCommands];
  }, [preset]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((cmd) =>
      `${cmd.label} ${cmd.group} ${cmd.keywords ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // focus after the mount animation tick
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const go = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    router.push(cmd.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[activeIndex]);
    }
  };

  // group results while preserving order
  const grouped: { group: string; items: Command[] }[] = [];
  results.forEach((cmd) => {
    const last = grouped[grouped.length - 1];
    if (last && last.group === cmd.group) last.items.push(cmd);
    else grouped.push({ group: cmd.group, items: [cmd] });
  });

  let flatIndex = -1;

  return (
    <div
      className="app-cmdk-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="app-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="app-cmdk__search">
          <Icon.search width={18} height={18} style={{ color: 'var(--muted)' }} />
          <input
            ref={inputRef}
            className="app-cmdk__input"
            placeholder="Search pages, actions and operational areas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="app-kbd">ESC</span>
        </div>

        <div className="app-cmdk__list">
          {results.length === 0 ? (
            <div className="app-cmdk__empty">
              No results for “{query}”.
            </div>
          ) : (
            grouped.map((section) => (
              <div key={section.group}>
                <div className="app-cmdk__group-label">{section.group}</div>
                {section.items.map((cmd) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const CmdIcon = Icon[cmd.icon];
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      className={`app-cmdk__item${
                        index === activeIndex ? ' app-cmdk__item--active' : ''
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(cmd)}
                    >
                      <span className="app-cmdk__item-icon">
                        <CmdIcon width={17} height={17} />
                      </span>
                      <span>{cmd.label}</span>
                      <span className="app-cmdk__item-group">{cmd.group}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="app-cmdk__footer">
          <span className="app-cmdk__hint">
            <span className="app-kbd">↑</span>
            <span className="app-kbd">↓</span> navigate
          </span>
          <span className="app-cmdk__hint">
            <span className="app-kbd">↵</span> open
          </span>
          <span className="app-cmdk__hint" style={{ marginLeft: 'auto' }}>
            {results.length} result{results.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}
