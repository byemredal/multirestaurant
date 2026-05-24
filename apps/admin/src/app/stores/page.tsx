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
  listAdminStores,
  type AdminStoreRow,
} from '@/lib/admin-api/admin-operations-client';
import { useTerminology } from '@/lib/terminology/TerminologyProvider';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  inactive: 'Pasif',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'warning',
  active: 'success',
  inactive: 'neutral',
};

const CHIP_DEFS: { id: string; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'active', label: 'Aktif' },
  { id: 'draft', label: 'Taslak' },
  { id: 'inactive', label: 'Pasif' },
];

export default function StoreListPage() {
  const { term } = useTerminology();
  const [rows, setRows] = useState<AdminStoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const storeWord = term('store', 'singular');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const session = await requireAdminSession();
        setRows(await listAdminStores(session));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mağazalar yüklenemedi.');
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
            : rows.filter((s) => s.status === chip.id).length,
      })),
    [rows],
  );

  const metrics: Metric[] = useMemo(() => {
    const active = rows.filter((s) => s.status === 'active').length;
    const draft = rows.filter((s) => s.status === 'draft').length;
    const inactive = rows.filter((s) => s.status === 'inactive').length;
    return [
      { label: 'Toplam mağaza', value: String(rows.length), icon: 'store', tone: 'accent', foot: 'tüm tenantler' },
      { label: 'Aktif', value: String(active), icon: 'check', tone: 'success', foot: 'sipariş kabul ediyor' },
      { label: 'Taslak', value: String(draft), icon: 'clock', tone: 'warning', foot: 'kurulum aşamasında' },
      { label: 'Pasif', value: String(inactive), icon: 'alert', tone: 'warning', foot: 'yayında değil' },
    ];
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((store) => {
      if (status !== 'all' && store.status !== status) return false;
      if (!q) return true;
      return `${store.name} ${store.ownerCompanyName ?? ''} ${store.city ?? ''} ${store.category}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, status]);

  const columns: Column<AdminStoreRow>[] = [
    {
      key: 'store',
      header: storeWord,
      render: (row) => (
        <div className="admin-identity">
          <span className="admin-identity__logo">
            {row.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="admin-table__primary">{row.name}</div>
            <div className="admin-table__sub">{row.category}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: term('tenant', 'singular'),
      render: (row) => row.ownerCompanyName ?? '—',
    },
    { key: 'city', header: 'Şehir', render: (row) => row.city ?? '—' },
    {
      key: 'menu',
      header: 'Menü ürünü',
      align: 'right',
      render: (row) => <span className="admin-table__num">{row.menuItemCount}</span>,
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
          breadcrumb={[{ label: term('tenant', 'plural') }, { label: `${storeWord} Listesi` }]}
          title={`${storeWord} Listesi`}
          description="Platform genelindeki tüm mağazalar — salt okunur operasyonel görünürlük."
        />

        {!loading && !error ? <MetricGrid metrics={metrics} /> : null}

        <FilterBar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Mağaza adı, tenant, şehir veya kategori ara…"
          chips={chips}
          activeChip={status}
          onChipChange={setStatus}
        />

        {loading ? <SkeletonTable /> : null}

        {error ? <div className="admin-state admin-state--error">{error}</div> : null}

        {!loading && !error && visible.length === 0 ? (
          <EmptyState
            title="Mağaza bulunamadı"
            description="Bu filtrelere uyan mağaza yok."
          />
        ) : null}

        {!loading && !error && visible.length > 0 ? (
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(row) => row.id}
            footer={<span>{visible.length} / {rows.length} mağaza</span>}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}
