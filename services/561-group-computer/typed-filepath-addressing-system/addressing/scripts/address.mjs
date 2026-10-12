// addressing — the typed-filepath addressing codec: resolve a term to a typed filepath, and back. A term is
// the coordinate of a thing in the term language; by the Curry–Howard / Yoneda reading the path IS the term,
// so "addressing" a term produces the posix coordinate where the thing lives: a directory <root>/<...segs>/,
// and within it a leaf file <leaf>.<type> carrying the thing's content of that TYPE. The type is the
// filepath's type, realized as the leaf's extension — that one parameter is what makes the filepath *typed*.
// This package does the codec and nothing else: it touches no disk, reads no bytes, knows no file format. A
// consumer that pins a type (e.g. "jsonl" for an EAVT log) gets a typed-term addressing scheme for free.
//
// THE MEMBRANE ACCESS CHECK (L13, Unit C): `address` is the `resolve` membrane entry (term -> typed-path
// handle, the capability), so it OPTIONALLY accepts the acting `{ principal }` (and a recognition `world`).
// When a principal is supplied it consults `can` at the membrane and, on refusal, RETURNS an f-faced L9b
// fault { condition, charge, witnesses } instead of the path string — never a throw, never a silent resolve.
// A ⊤ (contested capability) is HELD and surfaced (deny-but-surface), both witness sets conserved. With NO
// principal the codec is unchanged: a bare path string out (full back-compat). The access consult is the
// ONLY non-zero dependency, and it is READ-ONLY (the recognition read `can`); the path arithmetic is local.
import { join, sep } from "node:path";
import { guardAccess } from "./access.mjs";

// segmentsOf — a term is a slash-separated coordinate ("creatures/ada") or an array of segments; normalize to
// the trimmed, non-empty segment list. The thing is the directory <...segments>/; its leaf is the last segment.
const segmentsOf = (term) =>
  (Array.isArray(term) ? term : String(term).split("/")).map((s) => String(s).trim()).filter(Boolean);

// typeOf — normalize a type to a bare extension (no leading dot): "jsonl" and ".jsonl" both mean "jsonl".
const typeOf = (type) => {
  const t = String(type ?? "").trim().replace(/^\.+/, "");
  if (!t) throw new TypeError("addressing: a typed filepath needs a type");
  return t;
};

// address — the typed filepath for a term under root: <root>/<...segments>/<leaf>.<type>.
// opts: { principal?, world? }. With a principal the resolve is access-checked at the membrane (L13); on
// refusal the f-faced L9b fault { condition, charge, witnesses } is RETURNED in place of the path string.
// The empty term still THROWS — that is a shape contract (a term with no coordinate has no address), not a
// domain access condition. With no principal the result is the bare path string (back-compat).
export function address(root, term, type, opts = {}) {
  const segments = segmentsOf(term);
  if (segments.length === 0) throw new TypeError("addressing: the empty term has no address");
  const gate = guardAccess(opts.world, opts.principal, segments.join("/"), "resolve");
  if (gate && !gate.ok) return gate.fault; // f-faced fault — the term resolves to no handle for this actor
  const leaf = segments[segments.length - 1];
  return join(root, ...segments, leaf + "." + typeOf(type));
}

// termOf — the inverse: recover the term ("a/b/c") from a typed filepath under root. Type-agnostic by design —
// it drops the leaf file whatever its type, because the term lives in the directory coordinate, not the type.
export function termOf(root, path) {
  const rel = path.startsWith(root) ? path.slice(root.length) : path;
  const parts = rel.split(sep).filter(Boolean);
  parts.pop(); // drop "<leaf>.<type>"
  return parts.join("/");
}
