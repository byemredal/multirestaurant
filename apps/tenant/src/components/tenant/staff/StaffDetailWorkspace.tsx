'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantAuth } from '@/lib/auth/tenant-auth-context';
import { listTenantStores } from '@/lib/tenant-client';
import {
  deactivateStaff,
  getStaff,
  resendStaffInvite,
  updateStaff,
  type StaffInvitePayload,
  type TenantStaff,
  type UpdateStaffInput,
} from '@/lib/tenant-staff-client';
import { ConfirmDialog } from './ConfirmDialog';
import { InviteTokenResult } from './InviteTokenResult';
import { StaffEditForm } from './StaffEditForm';
import { StaffTypeLabel, StatusBadge } from './StatusBadge';
import type { ScopePickerStore } from './StoreScopePicker';

/**
 * `/dashboard/staff/[staffId]` workspace. Combines:
 *   • staff summary header
 *   • edit form (profile + memberships)
 *   • deactivate action with confirmation modal
 *   • resend-invite action (only when the staff has not set a password yet)
 *
 * All actions return the canonical TenantStaff shape and the workspace
 * folds that into local state so the UI stays in sync without re-fetches.
 */
export default function StaffDetailWorkspace({ staffId }: { staffId: string }) {
  const { session } = useTenantAuth();
  const router = useRouter();
  const [staff, setStaff] = useState<TenantStaff | null>(null);
  const [stores, setStores] = useState<ScopePickerStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<StaffInvitePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session) return;
      setLoading(true);
      setError(null);
      try {
        const [staffRow, storeRows] = await Promise.all([
          getStaff(session, staffId),
          listTenantStores(session) as Promise<Array<{ id: string; name: string }>>,
        ]);
        if (!cancelled) {
          setStaff(staffRow);
          setStores(storeRows.map((row) => ({ id: row.id, name: row.name })));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Personel yüklenemedi');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session, staffId]);

  const onSave = useCallback(
    async (input: UpdateStaffInput) => {
      if (!session || !staff) return;
      setEditing(true);
      setEditError(null);
      setActionFeedback(null);
      try {
        const updated = await updateStaff(session, staff.id, input);
        setStaff(updated);
        setActionFeedback('Değişiklikler kaydedildi.');
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Kaydetme başarısız');
      } finally {
        setEditing(false);
      }
    },
    [session, staff],
  );

  const onDeactivate = useCallback(async () => {
    if (!session || !staff) return;
    setActionBusy(true);
    try {
      const updated = await deactivateStaff(session, staff.id);
      setStaff(updated);
      setConfirmDeactivate(false);
      setActionFeedback('Personel askıya alındı.');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Askıya alma başarısız');
    } finally {
      setActionBusy(false);
    }
  }, [session, staff]);

  const onResend = useCallback(async () => {
    if (!session || !staff) return;
    setActionBusy(true);
    try {
      const { invite } = await resendStaffInvite(session, staff.id);
      setResendResult(invite);
      setConfirmResend(false);
      setActionFeedback('Yeni davet bağlantısı oluşturuldu.');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Davet gönderilemedi');
    } finally {
      setActionBusy(false);
    }
  }, [session, staff]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-[260px] animate-pulse rounded-[18px] border border-slate-100 bg-slate-50" />
      </div>
    );
  }
  if (error || !staff) {
    return (
      <div className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-800">
          <div className="font-semibold">Personel yüklenemedi</div>
          <div className="mt-1 break-words">{error ?? 'Bilinmeyen hata'}</div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/staff')}
            className="mt-3 rounded-[10px] border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-50"
          >
            Personel listesine dön
          </button>
        </div>
      </div>
    );
  }

  const canResend = !staff.hasPassword;
  const canDeactivate = staff.isActive;

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/dashboard/staff"
          className="text-[12px] font-semibold text-slate-500 transition hover:text-slate-700"
        >
          ← Personel listesine dön
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.01em] text-slate-900 sm:text-[24px]">
              {staff.fullName}
            </h1>
            <div className="mt-1 text-[13px] text-slate-500">{staff.email}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge staff={staff} />
              <StaffTypeLabel staffType={staff.staffType} />
              <span className="text-[11.5px] text-slate-500">
                {staff.memberships.filter((m) => m.status === 'active').length} mağaza
              </span>
            </div>
          </div>
        </div>
      </header>

      {actionFeedback ? (
        <div className="rounded-[10px] bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">
          {actionFeedback}
        </div>
      ) : null}

      {resendResult ? <InviteTokenResult invite={resendResult} baseUrl={baseUrl} /> : null}

      <StaffEditForm
        staff={staff}
        stores={stores}
        submitting={editing}
        error={editError}
        onSubmit={onSave}
      />

      <section className="space-y-3 rounded-[18px] border border-slate-100 bg-white p-5 sm:p-6">
        <h2 className="text-[14px] font-semibold text-slate-900">İşlemler</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirmResend(true)}
            disabled={!canResend || actionBusy}
            className="rounded-[10px] border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Daveti yeniden gönder
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeactivate(true)}
            disabled={!canDeactivate || actionBusy}
            className="rounded-[10px] border border-red-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Personeli askıya al
          </button>
        </div>
        {!canResend ? (
          <p className="text-[11.5px] text-slate-500">
            Personel daveti zaten kabul etti — yeni davet bağlantısı oluşturulamaz.
          </p>
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmDeactivate}
        title="Personeli askıya almak istediğinize emin misiniz?"
        body={
          <p>
            Bu personel artık giriş yapamaz ve mağazalara erişimi anında kesilir.
            Geçmiş hareket kayıtları korunur.
          </p>
        }
        confirmLabel="Askıya al"
        tone="danger"
        busy={actionBusy}
        onConfirm={onDeactivate}
        onClose={() => setConfirmDeactivate(false)}
      />

      <ConfirmDialog
        open={confirmResend}
        title="Yeni davet bağlantısı oluştur?"
        body={
          <p>
            Önceki davet bağlantısı geçersiz kılınacak. Yeni bağlantı oluşturduktan sonra
            personele yalnızca bir kez gösterilecek.
          </p>
        }
        confirmLabel="Yeni davet oluştur"
        tone="neutral"
        busy={actionBusy}
        onConfirm={onResend}
        onClose={() => setConfirmResend(false)}
      />
    </div>
  );
}
