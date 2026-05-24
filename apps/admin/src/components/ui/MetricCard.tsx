import { Icon, type IconName } from '@/lib/icons';

export type MetricTone = 'accent' | 'success' | 'danger' | 'warning';
export type TrendDirection = 'up' | 'down' | 'flat';

export type Metric = {
  label: string;
  value: string;
  icon: IconName;
  tone?: MetricTone;
  trend?: { direction: TrendDirection; value: string };
  foot?: string;
};

const trendIcon: Record<TrendDirection, IconName> = {
  up: 'arrowUp',
  down: 'arrowDown',
  flat: 'activity',
};

/** Single KPI tile with an icon, headline value and optional trend. */
export function MetricCard({ label, value, icon, tone = 'accent', trend, foot }: Metric) {
  const MetricIcon = Icon[icon];
  const TrendIcon = trend ? Icon[trendIcon[trend.direction]] : null;
  return (
    <div className="admin-metric">
      <div className="admin-metric__top">
        <span className={`admin-metric__icon admin-metric__icon--${tone}`}>
          <MetricIcon width={17} height={17} />
        </span>
        <span className="admin-metric__label">{label}</span>
      </div>
      <div className="admin-metric__value">{value}</div>
      <div className="admin-metric__foot">
        {trend && TrendIcon && (
          <span className={`admin-trend admin-trend--${trend.direction}`}>
            <TrendIcon width={13} height={13} />
            {trend.value}
          </span>
        )}
        {foot && <span>{foot}</span>}
      </div>
    </div>
  );
}

/** Responsive grid wrapper for {@link MetricCard}. */
export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="admin-metric-grid">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}
