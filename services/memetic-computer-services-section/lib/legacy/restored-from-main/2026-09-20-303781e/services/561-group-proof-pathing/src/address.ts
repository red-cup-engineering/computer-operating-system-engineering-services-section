// address.ts — typed term coordinates.
//
// A term coordinate is a POSIX path whose directory is the term and whose leaf
// repeats the final segment with a type extension. This absorbs the pure part of
// the old typed-filepath-addressing-system and typed-term-memory-system
// addressing conventions. It does not touch disk.

import { join, sep } from "node:path";
import { sanitizeSegment, desanitizeSegment } from "./term.ts";

export type AddressTerm = string | readonly unknown[];

const segmentsOf = (term: AddressTerm): string[] => {
  if (Array.isArray(term)) return term.map((part) => String(part));
  return String(term).split("/").map((part) => part.trim()).filter(Boolean);
};

const typeOf = (type: unknown): string => {
  const t = String(type ?? "").trim().replace(/^\.+/, "");
  if (!t) throw new TypeError("address: a typed filepath needs a type");
  return t;
};

const addressOfSegments = (root: string, segments: readonly string[], type: unknown): string => {
  if (segments.length === 0) throw new TypeError("address: the empty term has no address");
  const leaf = segments[segments.length - 1]!;
  return join(root, ...segments, `${leaf}.${typeOf(type)}`);
};

/** Resolve a term to `<root>/<segments>/<leaf>.<type>`. String terms split on "/", array parts do not. */
export function address(root: string, term: AddressTerm, type: unknown): string {
  return addressOfSegments(root, segmentsOf(term).map(sanitizeSegment), type);
}

/** The EAVT log specialization of typed addressing: `<root>/<term>/<leaf>.jsonl`. */
export const logPath = (root: string, term: AddressTerm): string => address(root, term, "jsonl");

const termSegmentsOfPath = (root: string, path: string): string[] => {
  const rel = path.startsWith(root) ? path.slice(root.length) : path;
  const parts = rel.split(sep).filter(Boolean);
  parts.pop();
  return parts.map(desanitizeSegment);
};

/** Recover the slash-separated term from a typed filepath. The leaf type is intentionally ignored. */
export function termOf(root: string, path: string): string {
  return termSegmentsOfPath(root, path).join("/");
}

/** Resolve arbitrary untrusted parts as one segment each; "/" inside a part is content, not a path split. */
export function addressNested(root: string, parts: unknown | readonly unknown[], type: unknown): string {
  const list = Array.isArray(parts) ? parts : [parts];
  return addressOfSegments(root, list.map((part) => sanitizeSegment(String(part))), type);
}

/** Recover the original arbitrary parts from an address created by `addressNested`. */
export function termOfNested(root: string, path: string): string[] {
  return termSegmentsOfPath(root, path);
}

/** Compose a namespaced term from arbitrary parts. */
export function composeTerm(namespace: unknown, parts: unknown | readonly unknown[] = []): string {
  const list = Array.isArray(parts) ? parts : [parts];
  return [sanitizeSegment(String(namespace)), ...list.map((part) => sanitizeSegment(String(part)))].join("/");
}

/** Decompose a namespaced term created by `composeTerm`. */
export function decomposeTerm(term: unknown): Readonly<{ namespace: string; parts: readonly string[] }> {
  const atoms = String(term).split("/").filter(Boolean);
  if (atoms.length === 0) return Object.freeze({ namespace: "", parts: Object.freeze([]) });
  return Object.freeze({
    namespace: desanitizeSegment(atoms[0]!),
    parts: Object.freeze(atoms.slice(1).map(desanitizeSegment)),
  });
}

/** The leading namespace of a composed term, or "" for an empty term. */
export function namespaceOf(term: unknown): string {
  const head = String(term).split("/").filter(Boolean)[0];
  return head === undefined ? "" : desanitizeSegment(head);
}

/** Whether a term's leading atom is the sanitized namespace. */
export function withinNamespace(term: unknown, namespace: unknown): boolean {
  const head = String(term).split("/").filter(Boolean)[0];
  return head !== undefined && head === sanitizeSegment(String(namespace));
}
