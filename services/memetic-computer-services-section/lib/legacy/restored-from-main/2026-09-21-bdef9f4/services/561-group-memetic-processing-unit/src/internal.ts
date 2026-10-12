// internal.ts — shared primitives the word-algebra and the descent both need. Deterministic structural
// stringify (so cells, edges, and valuations key and dedup stably regardless of object identity) and the
// set-union over evidence carriers (concatenate, keep first occurrence, never discard a witness).

/** A deterministic structural key for any value: object keys are sorted, so equal structure ⇒ equal key. */
export function stringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return typeof value + ":" + String(value);
  if (Array.isArray(value)) return "[" + value.map(stringify).join(",") + "]";
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return "{" + entries.map(([k, v]) => k + ":" + stringify(v)).join(",") + "}";
}

/** Set-union of two witness lists: concatenate, keep the first occurrence of each, discard nothing. */
export function union(a: readonly unknown[], b: readonly unknown[]): unknown[] {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const w of [...a, ...b]) {
    const k = stringify(w);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(w);
    }
  }
  return out;
}
