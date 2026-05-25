import type { TenantStaff } from '@/lib/tenant-staff-client';

/**
 * Surfaces the staff lifecycle as a single chip. Three states for now:
 *   • Invited — invite sent, password not set yet (hasPassword=false).
 *   • Active — verified, logged in.
 *   • Suspended — deactivated by the tenant owner.
 * The visual treatment matches the dashboard chip vocabulary used
 * elsewhere in the tenant app (StoreStatusCard).
 */
export function StatusBadge({ staff }: { staff: Pick<TenantStaff, 'employmentStatus' | 'isActive' | 'hasPassword'> }) {
  if (!staff.isActive || staff.employmentStatus === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Askıda
      </span>
    );
  }
  if (staff.employmentStatus === 'invited' || !staff.hasPassword) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Davetli
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#09479A]/[0.08] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#09479A]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#09479A]" />
      Aktif
    </span>
  );
}

const STAFF_TYPE_LABELS: Record<TenantStaff['staffType'], string> = {
  cashier: 'Kasiyer',
  delivery_admin: 'Teslimat Yöneticisi',
  kitchen: 'Mutfak',
  manager: 'Yönetici',
  host: 'Host',
  other: 'Diğer',
};

export function StaffTypeLabel({ staffType }: { staffType: TenantStaff['staffType'] }) {
  return (
    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-600">
      {STAFF_TYPE_LABELS[staffType] ?? staffType}
    </span>
  );
}

export const staffTypeLabels = STAFF_TYPE_LABELS;
