// json — the json codec: read a JSON document as cells about its file, write a value back as JSON
// text (a single pretty document, or ndjson for an array — so the jsonl child writes through here too).
import { readFileSync } from "node:fs";
import { mergeCellSets } from "@red-cup-engineering/computer-data-engineering-services-section/signcell/cell";
import { readFlatfile, writeFlatfile } from "./flatfile.mjs";
import { present } from "./stat.mjs";

// readSerializationFile(path) — restrict flatfile → serialization-file: a flatfile whose text encodes a
// serialized value. The concrete format (json/yaml) and its parse live in the children.
export function readSerializationFile(path) {
  return mergeCellSets(readFlatfile(path), present(path, { format: "serialization-file" }, "read"));
}

// readJson(path) — restrict serialization-file → json: the text is one JSON document, told as the file's
// `json` attribute. ndjson (jsonl) has no single value, so its format is told as "json" with no value.
// The value must be semiotic JSON (safe-integer numbers) to be told as a cell term.
export function readJson(path) {
  let value;
  try { value = JSON.parse(readFileSync(path, "utf8")); } catch { value = undefined; } // ndjson → no single value
  return mergeCellSets(readSerializationFile(path), present(path, value === undefined ? { format: "json" } : { format: "json", json: value }, "parse"));
}

// writeJson(path, value) — serialize a value to JSON text and delegate to the base byte-writer. A single JSON
// document is pretty-printed; an array of values is written as line-delimited JSON (ndjson) — so the jsonl
// child writes through here too.
export function writeJson(path, value) {
  const text = Array.isArray(value)
    ? value.map((v) => JSON.stringify(v)).join("\n") + "\n"   // ndjson (jsonl): one value per line
    : JSON.stringify(value, null, 2) + "\n";                  // a single json document
  return writeFlatfile(path, text);
}
