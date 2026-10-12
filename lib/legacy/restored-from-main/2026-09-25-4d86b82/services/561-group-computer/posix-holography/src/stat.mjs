// stat — a file's statting: its POSIX attributes (type, size, mode, mtime, nlink) told as SignCells about
// the file — (path, attribute, value), each witnessed by "stat", the OS reporting it. `present` tells an
// arbitrary {key: value} attribute map about a subject the same way; every reading composes it.

import { statSync } from "node:fs";
import { cell, cellSet } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/cell";

// The scalar POSIX attributes read off stat. Each (key, value) becomes one cell about the file.
export function attributesOf(path) {
  const s = statSync(path);
  const type = s.isFile() ? "regular-file" : s.isDirectory() ? "directory"
    : s.isSymbolicLink() ? "symbolic-link" : s.isFIFO() ? "fifo" : s.isSocket() ? "socket"
    : s.isBlockDevice() ? "block-device" : s.isCharacterDevice() ? "character-device" : "unknown";
  return { type, size: s.size, mode: s.mode & 0o7777, mtime: Math.trunc(s.mtimeMs), nlink: s.nlink };
}

// present — tell a {key: value} attribute map about a subject: one cell (subject, key, value) per attribute,
// witnessed by `witness`.
export function present(subject, attributes, witness = "stat") {
  return cellSet(Object.entries(attributes).map(([key, value]) => cell(subject, key, value, { for: [witness] })));
}

// statting a path tells its POSIX attributes about it.
export default function stat(path) {
  return present(path, attributesOf(path));
}
