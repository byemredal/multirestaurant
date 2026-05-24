'use client';

export type TabItem = {
  id: string;
  label: string;
  count?: number;
};

/** Underline tab strip. Controlled — the page owns the active id. */
export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="admin-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`admin-tab${active === tab.id ? ' admin-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span className="admin-segment__count">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
