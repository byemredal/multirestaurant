export type BarPoint = { label: string; value: number };

/**
 * Minimal CSS bar chart for trend visualisations — no charting dependency.
 * The tallest bar is highlighted.
 */
export default function BarChart({
  data,
  height = 160,
  valueFormatter,
}: {
  data: BarPoint[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const max = Math.max(...data.map((point) => point.value), 1);
  return (
    <div className="admin-bar-chart" style={{ height }}>
      {data.map((point) => {
        const pct = Math.round((point.value / max) * 100);
        const isPeak = point.value === max;
        return (
          <div key={point.label} className="admin-bar-chart__col">
            <div
              className={`admin-bar-chart__bar${
                isPeak ? '' : ' admin-bar-chart__bar--muted'
              }`}
              style={{ height: `${Math.max(pct, 4)}%` }}
              title={
                valueFormatter
                  ? valueFormatter(point.value)
                  : String(point.value)
              }
            />
            <span className="admin-bar-chart__label">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}
