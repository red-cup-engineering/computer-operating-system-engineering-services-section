// eavt — the EAVT row algebra: the `jsonl` restriction whose every line is exactly {e,a,v,t}.
//
// A subject-predicate-object trace with provenance: `e` subject, `a` predicate (a gerund), `v`
// object (any JSON), `t` transaction/witness. A row is EXACTLY those four fields and nothing else —
// negative evidence is the CONVERSE predication on another row, never a polarity/op field, and a
// contested cell rises to ⊤ under the fold (history preserved, never erased). That ⊤-preserving,
// op-free discipline is what distinguishes eavt from its sibling `datom` (the Datomic-conformant
// assert/retract form): see ../datom. Identity is content: `rowId = sha256(jcs(row))`.
//
// Pure (no I/O); the bytes-on-disk side is posix-holography's regular-file read/write, which this
// resource's reading/writing morphisms compose.

import { canonicalJson as jcs } from "@red-cup-engineering/json-services-section/canonical";
import { sha256Bytes } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/portable-sha256";

// Re-export the single canonical-JSON so eavt consumers get identity + canonicalization from one import.
export { canonicalJson as jcs } from "@red-cup-engineering/json-services-section/canonical";

// The canonical id of a row: identical content -> identical id. This IS the row's identity.
export const rowId = (row) => sha256Bytes(new TextEncoder().encode(jcs(row)));

// A row is exactly {e,a,v,t}. Lenient on values; throws otherwise. (Stricter, domain-specific
// contracts — e.g. e a path string, t an RFC-3339 stamp — are the consumer's to add on top.)
export function assertRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new TypeError("eavt: row must be a JSON object");
  }
  for (const k of ["e", "a", "v", "t"]) {
    if (!(k in row)) throw new TypeError(`eavt: row missing "${k}"`);
  }
  if (Object.keys(row).length !== 4) {
    throw new TypeError(`eavt: row must be exactly {e,a,v,t}, got ${Object.keys(row).join(",")}`);
  }
  return row;
}

// Dedup rows by canonical id, first occurrence kept (G-Set semantics). Order-preserving.
export function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const id = rowId(row);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}
