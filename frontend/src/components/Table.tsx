import type { ReactNode } from 'react';
import styles from './Table.module.css';

export interface Column<T> {
    header: string;
    render: (row: T) => ReactNode;
}

interface Props<T> {
    columns: Column<T>[];
    rows: T[] | undefined;
    rowKey: (row: T) => string | number;
    emptyText?: string;
}

/**
 * Generic table. Each column says how to render a cell from a row, so the
 * same component serves accounts, the ledger, and later the experiment results.
 */
export function Table<T>({ columns, rows, rowKey, emptyText = 'No data yet.' }: Props<T>) {
    return (
        <table className={styles.table}>
            <thead>
            <tr>
                {columns.map((c) => (
                    <th key={c.header}>{c.header}</th>
                ))}
            </tr>
            </thead>
            <tbody>
            {rows && rows.length > 0 ? (
                rows.map((row) => (
                    <tr key={rowKey(row)}>
                        {columns.map((c) => (
                            <td key={c.header}>{c.render(row)}</td>
                        ))}
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={columns.length} className={styles.empty}>
                        {emptyText}
                    </td>
                </tr>
            )}
            </tbody>
        </table>
    );
}