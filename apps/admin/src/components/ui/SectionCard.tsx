import type { ReactNode } from 'react';

/**
 * Bordered surface with an optional header row. `flush` removes body padding
 * for tables / list rows that draw their own edges.
 */
export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  flush = false,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`admin-card${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <div className="admin-card__header">
          <div>
            {title && <h3 className="admin-card__title">{title}</h3>}
            {subtitle && <p className="admin-card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="admin-row">{actions}</div>}
        </div>
      )}
      {flush ? children : <div className="admin-card__body">{children}</div>}
    </section>
  );
}
