// eavt — the eavt codec: restrict jsonl → eavt. Each row {e,a,v,t} tells a SignCell: e the subject, a the
// predicate, v the object, t the transaction — its witness. A row only ever tells for; against-evidence and
// contradiction come from the algebra over the cells, downstream.
//
// OP3 — TORN-LINE RECOVERY (real-computer-specification §1.5, Wave 0). A crash mid-append (durable append is
// O_APPEND + fsync; see appendEavt) can leave a partial FINAL line: bytes written but never fsynced, or the
// row half-formed. The read membrane MUST tolerate that — skip/repair the torn final line, NEVER propagate a
// parse throw (OP3). So readEavt does NOT delegate row-parsing to readJsonl, whose strict `JSON.parse` per
// line throws on a torn line; it parses the lines itself, tolerantly, and drops a final line that does not
// parse (the only line a crash mid-append can tear, since every prior line was a completed durable append). A
// torn line in the MIDDLE (every line after it parses) would mean a deeper corruption than a crash
// mid-append can cause; we still skip non-parsing lines rather than throw, so a read always yields the rows
// that ARE intact — the append-only log never loses a witness to one bad tail.
//
// OPERATIONAL SUBSTRATE for the durable single-row append (appendEavt):
//   OP1 — Durability. The single line is flushed to stable storage (fsync) before it returns.
//   OP2 — Write atomicity. The line is written with a single O_APPEND write, so two writers appending to the
//         same log never interleave a half-line. Within a process the appends are serialised through a
//         per-path queue (single-writer discipline).
//   OP4 — Canonical on-disk bytes (L8a). The row is persisted as its ONE canonical jcs form (RFC-8785), NOT
//         JSON.stringify, so the bytes on disk are the same bytes whose sha256 is the content identity.
//
import { openSync, writeSync, fsyncSync, closeSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { cell, cellSet } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/cell";
import { writeJson } from "./json.mjs";
import { canonical as jcs } from "@red-cup-engineering/json-services-section"; // OP4/L8a: the upstream JSON carrier is the ONE canonicalizer — the on-disk bytes ARE the identity bytes


// parseLinesTolerant — split a jsonl file into rows, skipping any line that does not parse (OP3). A crash
// mid-append can only tear the FINAL line (all earlier lines were completed durable appends), so dropping a
// non-parsing line recovers the intact prefix without a throw. Blank lines are ignored as before.
function parseLinesTolerant(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;          // blank / trailing newline
    try { rows.push(JSON.parse(line)); } // a complete row
    catch { /* torn/partial line from a crash mid-append (OP3) — skip, never throw */ }
  }
  return rows;
}

// readEavt(path) — read an eavt log to its rows' cells: each row (e, a, v, t) tells the cell (e, a, v), its
// transaction t the witness; rows of one cell join. Torn-line tolerant (OP3).
export function readEavt(path) {
  const rows = parseLinesTolerant(readFileSync(path, "utf8")); // OP3: torn-tolerant per-line parse
  return cellSet(rows.map(({ e, a, v, t }) => cell(e, a, v, { for: [t] })));
}

// writeEavt(path, rows) — restrict jsonl → eavt (write side): EAVT rows {e,a,v,t} are jsonl rows. Delegates
// to writeJson (which emits the array as ndjson). Append-only is the consumer's discipline.
export function writeEavt(path, rows) {
  return writeJson(path, rows);
}

// Per-path in-process append queue. writeSync is synchronous, so a single call runs to completion before the
// next; this set makes the single-writer discipline explicit. Cross-PROCESS serialisation is provided by
// O_APPEND atomicity, not this set.
const writing = new Set();

// appendEavt(path, row) — durable single-row append (OP1/OP2/OP4). Where writeEavt overwrites the whole log,
// this adds one fact: the append-only G-Set discipline by which an eavt log grows.
export function appendEavt(path, row) {
  mkdirSync(dirname(path), { recursive: true });
  const line = jcs(row) + "\n"; // OP4: canonical bytes, not JSON.stringify
  // OP2: 'a' = O_APPEND — the offset-advance and the write are one atomic OS step; concurrent appenders to
  // the same log cannot interleave a partial line. OP1: fsync before returning so the row is durable.
  writing.add(path);
  const fd = openSync(path, "a");
  try {
    writeSync(fd, line);   // single write of the whole line under O_APPEND
    fsyncSync(fd);         // OP1: flush to stable storage before reporting success
  } finally {
    closeSync(fd);
    writing.delete(path);
  }
  return path;
}

export default readEavt;
