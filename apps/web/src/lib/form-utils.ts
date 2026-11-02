/** API rows use null for empty columns; form inputs want ''. */
export function toFormValues<T extends Record<string, any>>(row: T, keys: ReadonlyArray<string>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const key of keys) {
    const value = row[key]
    out[key] =
      value === null || value === undefined
        ? ''
        : typeof value === 'number' && key.startsWith('is')
          ? Boolean(value)
          : value
  }
  return out
}
