// term.ts — terms and their path-segment encoding. A TERM is any value that can be a node in the
// predicate category: a bare entity (a string), a predicate, or a whole cell {subject, predicate, object}
// (a compound term, the node a converse/projection edge points at). `termKey` is the canonical equality
// key (so equal terms address together regardless of identity — Yoneda). `segment` renders a term to ONE
// traversal-safe POSIX path segment via the repo's `~HH` byte-escape (SAFE = [A-Za-z0-9._-]); same scheme
// as the fs store, so a proof-path is a real, deterministic, collision-free address.
import type { Cell } from "@561-group/meme";

/** A term: any value that can be a node in the category (an entity, a predicate, or a whole cell). */
export type Term = unknown;

export type { Cell };

// canonical(value) — a stable, key-sorted clone, so JSON.stringify is order-independent (structure is
// identity). Primitives pass through; arrays map; objects emit their keys in sorted order.
const canonical = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = canonical((value as Record<string, unknown>)[key]);
  }
  return out;
};

/** The canonical equality key of a term: the string itself for a string, else stable canonical JSON. */
export const termKey = (term: Term): string =>
  typeof term === "string" ? term : JSON.stringify(canonical(term));

const ESC = "~";
const SAFE = /[A-Za-z0-9._-]/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const escapeByte = (byte: number): string => ESC + byte.toString(16).padStart(2, "0");

/** Escape a string to a traversal-safe path segment: SAFE bytes pass; every other byte becomes `~HH`.
 * Empty, ".", "..", and leading "." are escaped so arbitrary term parts cannot escape or hide inside a
 * POSIX coordinate. */
export function sanitizeSegment(value: string): string {
  if (value === "") return `${ESC}e`;
  if (value === ".") return `${ESC}2e`;
  if (value === "..") return `${ESC}2e${ESC}2e`;
  let out = "";
  let first = true;
  for (const ch of value) {
    if (ch === ESC) out += escapeByte(ch.charCodeAt(0));
    else if (first && ch === ".") out += escapeByte(ch.charCodeAt(0));
    else if (ch.length === 1 && ch.charCodeAt(0) < 128 && SAFE.test(ch)) out += ch;
    else for (const b of encoder.encode(ch)) out += escapeByte(b);
    first = false;
  }
  return out;
}

/** The inverse of `sanitizeSegment`: decode `~HH` escapes back to the original string. */
export function desanitizeSegment(segmentText: string): string {
  if (segmentText === `${ESC}e`) return "";
  const bytes: number[] = [];
  for (let i = 0; i < segmentText.length; ) {
    if (segmentText[i] === ESC) {
      bytes.push(parseInt(segmentText.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      for (const b of encoder.encode(segmentText[i]!)) bytes.push(b);
      i += 1;
    }
  }
  return decoder.decode(new Uint8Array(bytes));
}

/** Render a term to one path segment (the sanitized canonical key). A cell node round-trips through its
 * canonical JSON; a bare string term renders human-readably. */
export const segment = (term: Term): string => sanitizeSegment(termKey(term));

/** Build a cell node from its three coordinates (used by the converse generator's swap). */
export const cellOf = (subject: Term, predicate: Term, object: Term): Cell => ({ subject, predicate, object });
