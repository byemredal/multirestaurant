'use client';

import { useState } from 'react';
import type {
  InviteStaffInput,
  InviteStoreAssignment,
  TenantStaff,
} from '@/lib/tenant-staff-client';
import { StoreScopePicker, type ScopePickerStore } from './StoreScopePicker';
import { staffTypeLabels } from './StatusBadge';

const STAFF_TYPE_KEYS = Object.keys(staffTypeLabels) as Array<TenantStaff['staffType']>;

/**
 * Controlled invite form. Owns local state for the fields, validates a
 * minimum store assignment on submit, and reports the assembled input to
 * the parent (which calls the API and shows the one-shot token result).
 *
 * Mobile: single-column layout (the parent constrains width). Submit
 * button stays full-width below `md`.
 */
export function InviteStaffForm({
  stores,
  onSubmit,
  submitting,
  error,
}: {
  stores: ScopePickerStore[];
  onSubmit: (input: InviteStaffInput) => void | Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [staffType, setStaffType] = useState<TenantStaff['staffType']>('cashier');
  const [storeAssignments, setStoreAssignments] = useState<InviteStoreAssignment[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (storeAssignments.length === 0) {
      setLocalError('En az bir mağaza seçmelisiniz.');
      return;
    }
    await onSubmit({
      email: email.trim(),
      fullName: fullName.trim(),
      staffType,
      phoneNumber: phoneNumber.trim() ? phoneNumber.trim() : undefined,
      stores: storeAssignments,
    });
  }

  const renderedError = localError ?? error;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[18px] border border-slate-100 bg-white p-5 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tam ad" required>
          <input
            type="text"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={submitting}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
          />
        </Field>
        <Field label="E-posta" required>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
          />
        </Field>
        <Field label="Telefon (opsiyonel)">
          <input
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            disabled={submitting}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-[14px] text-slate-900 focus:border-[#09479A] focus:outline-none focus:ring-2 focus:ring-[#09479A]/20"
          />
        </Field>
        <Field label="Rol" required>
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
      </div>

      <div>
        <div className="mb-2 text-[12px] font-semibold text-slate-700">
          Mağaza ataması <span className="text-red-500">*</span>
        </div>
        <StoreScopePicker
          stores={stores}
          value={storeAssignments}
          onChange={setStoreAssignments}
          disabled={submitting}
          defaultRole={staffType}
        />
      </div>

      {renderedError ? (
        <div className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {renderedError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || stores.length === 0}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#09479A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#06366f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? 'Davet ediliyor…' : 'Daveti gönder'}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
