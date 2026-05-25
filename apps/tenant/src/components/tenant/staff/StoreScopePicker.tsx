'use client';

import type { InviteStoreAssignment, TenantStaff } from '@/lib/tenant-staff-client';
import { staffTypeLabels } from './StatusBadge';

/** Shape of a store row this picker needs — kept minimal to stay decoupled. */
export type ScopePickerStore = {
  id: string;
  name: string;
};

const STAFF_TYPE_KEYS = Object.keys(staffTypeLabels) as Array<TenantStaff['staffType']>;

/**
 * Multi-store picker with a per-store role select. Controlled component —
 * parent owns the `value` array of { storeId, role }. Selecting/deselecting
 * a store toggles its row; the role select stays in sync.
 *
 * Mobile: rows stack vertically with a label-above-input pattern; the role
 * select shows the full Turkish label.
 */
export function StoreScopePicker({
  stores,
  value,
  onChange,
  disabled,
  defaultRole = 'cashier',
}: {
  stores: ScopePickerStore[];
  value: InviteStoreAssignment[];
  onChange: (next: InviteStoreAssignment[]) => void;
  disabled?: boolean;
  defaultRole?: TenantStaff['staffType'];
}) {
  const byId = new Map(value.map((entry) => [entry.storeId, entry] as const));

  function toggle(storeId: string) {
    if (byId.has(storeId)) {
      onChange(value.filter((entry) => entry.storeId !== storeId));
      return;
    }
    onChange([...value, { storeId, role: defaultRole }]);
  }

  function setRole(storeId: string, role: TenantStaff['staffType']) {
    onChange(value.map((entry) => (entry.storeId === storeId ? { ...entry, role } : entry)));
  }

  if (stores.length === 0) {
    return (
      <div className="rounded-[12px] border border-slate-100 bg-slate-50 p-3 text-[12px] text-slate-500">
        Önce en az bir mağaza oluşturmanız gerekiyor.
      </div>
    );
  }

  return (
    <ul className="grid gap-2">
      {stores.map((store) => {
        const assignment = byId.get(store.id);
        const selected = Boolean(assignment);
        return (
          <li
            key={store.id}
            className={`rounded-[12px] border p-3 transition ${
              selected ? 'border-[#09479A] bg-[#09479A]/[0.04]' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={disabled}
                  onChange={() => toggle(store.id)}
                  className="h-4 w-4 rounded border-slate-300 text-[#09479A] focus:ring-[#09479A]"
                />
                <span className="truncate">{store.name}</span>
              </label>

              {selected ? (
                <select
                  className="rounded-[8px] border border-slate-200 bg-white px-2 py-1 text-[12.5px] text-slate-700"
                  value={assignment!.role}
                  disabled={disabled}
                  onChange={(event) =>
                    setRole(store.id, event.target.value as TenantStaff['staffType'])
                  }
                >
                  {STAFF_TYPE_KEYS.map((role) => (
                    <option key={role} value={role}>
                      {staffTypeLabels[role]}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
