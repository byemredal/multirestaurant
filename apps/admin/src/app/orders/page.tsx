'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  DataTable,
  EmptyState,
  FilterBar,
  MetricGrid,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  type BadgeTone,
  type Column,
  type FilterChip,
  type Metric,
} from '@/components/ui';
import { requireAdminSession } from '@/lib/admin-api/require-admin-session';
import { formatDateTime } from '@/lib/admin-api/admin-review-ui';
import {
  listAdminOrders,
  type AdminOrderRow,
} from '@/lib/admin-api/admin-operations-client';

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Ödeme Bekleniyor',
  payment_processing: 'Ödeme İşleniyor',
  payment_failed: 'Ödeme Başarısız',
  pending_confirmation: 'Onay Bekliyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  completed: 'Tamamlandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  pending_payment: 'warning',
  payment_processing: 'warning',
  payment_failed: 'danger',
  pending_confirmation: 'warning',
  confirmed: 'accent',
  preparing: 'accent',
  ready: 'success',
  completed: 'neutral',
  rejected: 'danger',
  cancelled: 'neutral',
};

const OPERATIONAL = ['pending_confirmation', 'confirmed', 'preparing', 'ready'];

const CHIP_DEFS: { id: string; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'pending_confirmation', label: 'Onay Bekliyor' },
  { id: 'confirmed', label: 'Onaylandı' },
  { id: 'preparing', label: 'Hazırlanıyor' },
  { id: 'ready', label: 'Hazır' },
  { id: 'completed', label: 'Tamamlandı' },
  { id: 'cancelled', label: 'İptal' },
];

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function OrdersPage() {
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await requireAdminSession();
        setRows(await listAdminOrders(session));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Siparişler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const chips: FilterChip[] = useMemo(
    () =>
      CHIP_DEFS.map((chip) => ({
        id: chip.id,
        label: chip.label,
        count:
          chip.id === 'all'
            ? rows.length
            : rows.filter((o) => o.status === chip.id).length,
      })),
    [rows],
  );

  const metrics: Metric[] = useMemo(() => {
    const operational = rows.filter((o) => OPERATIONAL.includes(o.status)).length;
    const completed = rows.filter((o) => o.status === 'completed').length;
    const today = rows.filter((o) => isToday(o.createdAt)).length;
    return [
      { label: 'Toplam sipariş', value: String(rows.length), icon: 'bag', tone: 'accent', foot: 'tüm zamanlar' },
      { label: 'Operasyonel', value: String(operational), icon: 'clock', tone: 'warning', foot: 'işlem bekleyen' },
      { label: 'Tamamlanan', value: String(completed), icon: 'check', tone: 'success', foot: 'tüm zamanlar' },
      { label: 'Bugün', value: String(today), icon: 'activity', tone: 'accent', foot: 'bugün oluşturulan' },
    ];
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (!q) return true;
      return `${order.id} ${order.customerSummary.fullName} ${order.customerSummary.email} ${order.storeName}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, status]);

  const columns: Column<AdminOrderRow>[] = [
    {
      key: 'order',
      header: 'Sipariş',
      render: (row) => (
        <div>
          <div className="admin-table__primary">#{row.id.slice(0, 8)}</div>
          <div className="admin-table__sub">{row.customerSummary.fullName || row.customerSummary.email}</div>
        </div>
      ),
    },
    { key: 'store', header: 'Mağaza', render: (row) => row.storeName },
    {
      key: 'service',
      header: 'Servis',
      render: (row) => (
        <span className="admin-tag">{row.serviceTypeSnapshot ?? '—'}</span>
      ),
    },
    {
      key: 'items',
      header: 'Ürün',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.itemCount}</span>,
    },
    {
      key: 'total',
      header: 'Tutar',
      align: 'right',
      render: (row) => (
        <span className="admin-table__num admin-table__primary">
          {row.totalAmount.toFixed(2)} {row.currencySnapshot}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      render: (row) => (
        <StatusBadge
          label={STATUS_LABEL[row.status] ?? row.status}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        />
      ),
    },
    {
      key: 'created',
      header: 'Oluşturulma',
      align: 'right',
      render: (row) => <span className="admin-muted">{formatDateTime(row.createdAt)}</span>,
    },
  ];

  return (
    <AdminShell>
      <div className="admin-stack">
        <PageHeader
          breadcrumb={[{ label: 'Operasyonlar' }, { label: 'Siparişler' }]}
          title="Siparişler"
          description="Platform genelindeki tüm siparişler — salt okunur operasyonel görünürlük."
        />

        {!loading && !error ? <MetricGrid metrics={metrics} /> : null}

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Sipariş no, müşteri veya mağaza ara…"
          chips={chips}
          activeChip={status}
          onChipChange={setStatus}
        />

        {loading ? <SkeletonTable /> : null}

        {error ? <div className="admin-state admin-state--error">{error}</div> : null}

        {!loading && !error && visible.length === 0 ? (
          <EmptyState
            title="Sipariş bulunamadı"
            description="Bu filtrelere uyan sipariş yok."
          />
        ) : null}

        {!loading && !error && visible.length > 0 ? (
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(row) => row.id}
            footer={<span>{visible.length} / {rows.length} sipariş</span>}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}
