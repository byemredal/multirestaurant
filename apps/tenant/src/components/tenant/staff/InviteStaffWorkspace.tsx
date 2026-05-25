'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { listTenantStores } from '@/lib/tenant-client';
import {
  inviteStaff,
  type InviteStaffInput,
  type StaffInvitePayload,
  type TenantStaff,
} from '@/lib/tenant-staff-client';
import { InviteStaffForm } from './InviteStaffForm';
import { InviteTokenResult } from './InviteTokenResult';
import type { ScopePickerStore } from './StoreScopePicker';

/**
 * `/dashboard/staff/new` workspace. Owns the two phases of the invite flow:
 *   1) Form — bound to the InviteStaffForm component.
 *   2) Result — one-shot token reveal with copy buttons; the form is
 *      replaced (not stacked) so the operator's flow remains linear.
 *
 * Switzerland MVP context: invite URL is built off `window.location.origin`
 * — when emails ship in a follow-up slice, swap this for a server-rendered
 * link inside the email body.
 */
export default function InviteStaffWorkspace() {
  const { session } = useTenantAuth();
  const router = useRouter();
  const [stores, setStores] = useState<ScopePickerStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] =
    useState<{ staff: TenantStaff; invite: StaffInvitePayload } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session) return;
      setStoresLoading(true);
      try {
        const rows = (await listTenantStores(session)) as Array<{
          id: string;
          name: string;
        }>;
        if (!cancelled) {
          setStores(rows.map((row) => ({ id: row.id, name: row.name })));
        }
      } catch {
        if (!cancelled) setStores([]);
      } finally {
        if (!cancelled) setStoresLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const submit = useCallback(
    async (input: InviteStaffInput) => {
      if (!session) return;
      setSubmitting(true);
      setError(null);
      try {
        const created = await inviteStaff(session, input);
        setResult(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Davet başarısız');
      } finally {
        setSubmitting(false);
      }
    },
    [session],
  );

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/dashboard/staff"
          className="text-[12px] font-semibold text-slate-500 transition hover:text-slate-700"
        >
          ← Personel listesine dön
        </Link>
        <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.01em] text-slate-900 sm:text-[24px]">
          Personel davet et
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Personel bilgilerini girin ve mağaza atamalarını yapın. Davet bağlantısı
          yalnızca bir kez gösterilecek.
        </p>
      </header>

      {result ? (
        <div className="space-y-4">
          <InviteTokenResult invite={result.invite} baseUrl={baseUrl} />
          <div className="rounded-[16px] border border-slate-100 bg-white p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Davet edilen personel
            </div>
            <div className="mt-2 text-[14px] font-semibold text-slate-900">
              {result.staff.fullName}
            </div>
            <div className="text-[12.5px] text-slate-500">{result.staff.email}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/staff/${result.staff.id}`}
                className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Personel detayını aç
              </Link>
              <button
                type="button"
                onClick={() => router.push('/dashboard/staff')}
                className="rounded-[10px] bg-[#09479A] px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#06366f]"
              >
                Listeye dön
              </button>
            </div>
          </div>
        </div>
      ) : storesLoading ? (
        <div className="h-[260px] animate-pulse rounded-[18px] border border-slate-100 bg-slate-50" />
      ) : (
        <InviteStaffForm
          stores={stores}
          submitting={submitting}
          error={error}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
