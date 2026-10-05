type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function flattenKeys(value: Json, prefix: string, out: string[]): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenKeys(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.push(prefix);
  }
}

/** Keys (as `namespace.path.to.key`) present in `source` but missing in `target`. */
export function findMissingKeys(
  source: Record<string, Json>,
  target: Record<string, Json>,
): string[] {
  const sourceKeys: string[] = [];
  const targetKeys: string[] = [];
  flattenKeys(source, '', sourceKeys);
  flattenKeys(target, '', targetKeys);
  const present = new Set(targetKeys);
  return sourceKeys.filter((key) => !present.has(key));
}
