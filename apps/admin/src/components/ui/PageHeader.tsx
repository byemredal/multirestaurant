import { Fragment, type ReactNode } from 'react';

export type Crumb = { label: string };

/**
 * Standard page header: breadcrumb, title, supporting copy and a slot for
 * primary/secondary actions. Used at the top of every workspace page.
 */
export default function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="admin-breadcrumb">
            {breadcrumb.map((crumb, index) => (
              <Fragment key={crumb.label}>
                {index > 0 && (
                  <span className="admin-breadcrumb__sep">/</span>
                )}
                <span>{crumb.label}</span>
              </Fragment>
            ))}
          </div>
        )}
        <h1 className="admin-page-head__title">{title}</h1>
        {description && <p className="admin-page-head__desc">{description}</p>}
      </div>
      {actions && <div className="admin-page-head__actions">{actions}</div>}
    </div>
  );
}
