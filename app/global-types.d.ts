import '@tanstack/react-table'

declare const __BUILD_TIMESTAMP__: string

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    type?: string
  }
}
