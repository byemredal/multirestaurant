/** Single shimmer block. */
export function Skeleton({
  height = 16,
  width = '100%',
  radius = 8,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number;
}) {
  return (
    <div
      className="admin-skeleton"
      style={{ height, width, borderRadius: radius }}
    />
  );
}

/** Metric-row placeholder. */
export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="admin-metric-grid">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={104} radius={14} />
      ))}
    </div>
  );
}

/** Table placeholder used while page data loads. */
export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="admin-table-wrap" style={{ padding: 16 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Skeleton height={20} width="32%" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} height={40} />
        ))}
      </div>
    </div>
  );
}
