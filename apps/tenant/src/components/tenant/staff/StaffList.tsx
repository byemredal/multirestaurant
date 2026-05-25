'use client';

import Link from 'next/link';
import type { TenantStaff } from '@/lib/tenant-staff-client';
import { StaffTypeLabel, StatusBadge } from './StatusBadge';

/**
 * Staff list. Loading/empty/error states are first-class — every list page in
 * the tenant app implements them as required by CUSTOMER_STOREFRONT_RULES and
 * the tenant dashboard conventions. Renders as a two-column grid on >= md,
 * one column on mobile.
 */
export function StaffList({
  staff,
  loading,
  error,
  onRetry,
}: {
  staff: TenantStaff[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  if (loading && staff.length === 0) {
    return (
      <ul className="grid gap-3 md:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, idx) => (
          <li
            key={idx}
            className="h-[120px] animate-pulse rounded-[16px] border border-slate-100 bg-slate-50"
          />
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div className="rounded-[16px] border border-red-200 bg-red-50 p-5 text-[13px] text-red-800">
        <div className="font-semibold">Personel listesi yüklenemedi</div>
        <div className="mt-1 break-words">{error}</div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-[10px] border border-red-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-red-700 transition hover:bg-red-50"
          >
            Tekrar dene
          </button>
        ) : null}
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="rounded-[18px] border border-slate-100 bg-white p-8 text-center">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
          Henüz personel yok
        </h3>
        <p className="mt-2 text-[13px] leading-5 text-slate-500">
          İşletmenize personel ekleyerek başlayın. Her personele istediğiniz
          mağazaları atayabilirsiniz.
        </p>
        <Link
          href="/dashboard/staff/new"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-[#09479A] px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#06366f]"
        >
          Personel davet et
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {staff.map((member) => (
        <li key={member.id}>
          <Link
            href={`/dashboard/staff/${member.id}`}
            className="block rounded-[16px] border border-slate-100 bg-white p-4 transition hover:border-slate-200 hover:shadow-[0_4px_18px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-slate-900">
                  {member.fullName}
                </div>
                <div className="mt-1 truncate text-[12px] text-slate-500">
                  {member.email}
                </div>
              </div>
              <StatusBadge staff={member} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StaffTypeLabel staffType={member.staffType} />
              <span className="text-[11.5px] text-slate-500">
                {member.memberships.filter((m) => m.status === 'active').length} mağaza
              </span>
              {member.lastLoginAt ? (
                <span className="text-[11.5px] text-slate-400">
                  · son giriş {new Date(member.lastLoginAt).toLocaleDateString('tr-TR')}
                </span>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
