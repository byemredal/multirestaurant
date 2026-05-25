'use client';

import { useState } from 'react';
import type {
  InviteStoreAssignment,
  TenantStaff,
  UpdateStaffInput,
} from '@/lib/tenant-staff-client';
import { StoreScopePicker, type ScopePickerStore } from './StoreScopePicker';
import { staffTypeLabels } from './StatusBadge';

const STAFF_TYPE_KEYS = Object.keys(staffTypeLabels) as Array<TenantStaff['staffType']>;

/**
 * Edit form for an existing staff member. Pre-fills from the current staff
 * record. The store picker is seeded from the staff's active memberships;
 * suspended memberships are not editable here — deactivate the whole staff
 * instead, which is the API contract.
 */
export function StaffEditForm({
  staff,
  stores,
  submitting,
  error,
  onSubmit,
}: {
  staff: TenantStaff;
  stores: ScopePickerStore[];
  submitting: boolean;
  error: string | null;
  onSubmit: (input: UpdateStaffInput) => void | Promise<void>;
}) {
  const [fullName, setFullName] = useState(staff.fullName);
  const [phoneNumber, setPhoneNumber] = useState(staff.phoneNumber ?? '');
  const [staffType, setStaffType] = useState<TenantStaff['staffType']>(staff.staffType);
  const [assignments, setAssignments] = useState<InviteStoreAssignment[]>(() =>
    staff.memberships
      .filter((membership) => membership.status === 'active')
      .map((membership) => ({
        storeId: membership.storeId,
        role: membership.role as TenantStaff['staffType'],
      })),
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : null,
      staffType,
      stores: assignments,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[18px] border border-slate-100 bg-white p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tam ad">
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={submitting}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
          />
        </Field>
        <Field label="Telefon">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            disabled={submitting}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
          />
        </Field>
        <Field label="Rol">
          <select
            value={staffType}
            onChange={(event) =>
              setStaffType(event.target.value as TenantStaff['staffType'])
            }
            disabled={submitting}
            className="w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
          >
            {STAFF_TYPE_KEYS.map((role) => (
              <option key={role} value={role}>
                {staffTypeLabels[role]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="E-posta (sabit)">
          <input
            type="email"
            value={staff.email}
            disabled
            className="w-full cursor-not-allowed rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-[14px] text-slate-500"
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold text-slate-700">
          Mağaza ataması
        </div>
        <StoreScopePicker
          stores={stores}
          value={assignments}
          onChange={setAssignments}
          disabled={submitting}
          defaultRole={staffType}
        />
        <p className="mt-2 text-[11.5px] text-slate-500">
          Mağazadan çıkarmak için seçimi kaldırın; yeni atamalar bir sonraki istekten itibaren geçerlidir.
        </p>
      </div>

      {error ? (
        <div className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#09479A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#06366f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
