import type { StaffMeResponse } from '@/lib/auth/staff-client';
import { StaffTypeLabel, StatusBadge } from './StatusBadge';

/**
 * Identity card for the signed-in staff. Read-only — staff cannot edit
 * their own profile in this slice; the tenant owner does it through
 * /dashboard/staff/[staffId].
 */
export function StaffProfileCard({ me }: { me: StaffMeResponse }) {
  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Hesabınız
          </div>
          <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-slate-900">
            {me.fullName}
          </h2>
          <div className="mt-0.5 text-[13px] text-slate-500">{me.email}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            staff={{
              employmentStatus: me.employmentStatus as 'active' | 'invited' | 'suspended',
              isActive: me.isActive,
              hasPassword: true,
            }}
          />
          <StaffTypeLabel
            staffType={me.staffType as Parameters<typeof StaffTypeLabel>[0]['staffType']}
          />
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Telefon
          </dt>
          <dd className="mt-0.5 text-[13px] text-slate-700">{me.phoneNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Son giriş
          </dt>
          <dd className="mt-0.5 text-[13px] text-slate-700">
            {me.lastLoginAt
              ? new Date(me.lastLoginAt).toLocaleString('tr-TR')
              : 'Daha önce giriş yapılmadı'}
          </dd>
        </div>
      </dl>
    </section>
  );
}
