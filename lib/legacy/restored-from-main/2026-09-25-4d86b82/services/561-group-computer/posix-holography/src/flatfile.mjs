// flatfile — the base byte primitives for the flat (text) branch: a whole-file text write and the
// articulating readings for the file → regular-file → flatfile spine. A flatfile is a NUL-free regular file
// (text); these are the byte-touch the deeper codecs (json/jsonl/eavt, text/markdown) compose.
//
// OP1/OP2 (real-computer-specification §1.5, Wave 0) — a WHOLE-FILE write is atomic: write the content to a
// sibling temp file, fsync it, then rename(temp → path). rename is atomic on the same filesystem, so a crash
// mid-write leaves either the old file intact or the new file complete — NEVER a half-written file a reader
// could see. (Single-row appends use O_APPEND + fsync in eavt.appendEavt; this is the whole-file dual.)
// The temp lives in the same directory as the target so the rename stays within one filesystem.
import { readFileSync, writeFileSync, mkdirSync, openSync, fsyncSync, closeSync, renameSync, rmSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { mergeCellSets } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/cell";
import stat, { present } from "./stat.mjs";
import sniff from "./sniff.mjs";

// writeFlatfile(path, content) — whole-file atomic text write. The base byte-writer every text codec delegates
// to (json/jsonl/eavt-overwrite, text/markdown, schema, yaml, scripts). Returns the path written.
export function writeFlatfile(path, content) {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  // unique-ish sibling temp; not the wall-clock as data — just a within-process scratch name (pid+counter).
  const tmp = join(dir, `.${basename(path)}.tmp-${process.pid}-${writeFlatfile._n = (writeFlatfile._n ?? 0) + 1}`);
  try {
    writeFileSync(tmp, content, "utf8");
    const fd = openSync(tmp, "r+");
    try { fsyncSync(fd); } finally { closeSync(fd); } // OP1: flush the new bytes before they become visible
    renameSync(tmp, path);                            // OP2: atomic swap — reader sees old-whole or new-whole
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* best-effort cleanup of the scratch file */ }
    throw err;
  }
  return path;
}

// readFile(path) — file/reading: the most general read, the file's POSIX attributes told about it.
export function readFile(path) {
  return stat(path);
}

// readRegularFile(path) — restrict file → regular-file: the file's attributes and its sniffed binarity
// ("flat" | "binary"), which distinguishes a flatfile from a binary file.
export function readRegularFile(path) {
  return mergeCellSets(readFile(path), present(path, { binarity: sniff(path) }, "sniff"));
}

// readFlatfile(path) — restrict regular-file → flatfile: the regular file's cells and its UTF-8 text.
export function readFlatfile(path) {
  return mergeCellSets(readRegularFile(path), present(path, { text: readFileSync(path, "utf8") }, "read"));
}
