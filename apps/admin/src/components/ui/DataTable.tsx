import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
};

/**
 * Generic, horizontally-scrollable table. Keep cell rendering in the column
 * `render` functions so pages stay declarative.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  footer,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="admin-table-wrap">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    textAlign: column.align ?? 'left',
                    width: column.width,
                  }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="admin-state" style={{ border: 0 }}>
                    {empty ?? 'No records match the current filters.'}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  data-clickable={onRowClick ? 'true' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={{ textAlign: column.align ?? 'left' }}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="admin-table-foot">{footer}</div>}
    </div>
  );
}
