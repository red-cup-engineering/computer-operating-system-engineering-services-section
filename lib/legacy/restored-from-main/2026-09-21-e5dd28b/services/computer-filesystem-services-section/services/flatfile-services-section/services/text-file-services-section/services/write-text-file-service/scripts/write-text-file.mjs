#!/usr/bin/env node
import { writeFileText } from "@red-cup-engineering/file-services/write-file";
import { runJavascriptNodeOperation } from "../../../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

export async function writeTextFile({ path, text } = {}) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("path must be a nonempty string");
  if (typeof text !== "string") throw new TypeError("text must be a string");
  const receipt = await writeFileText(path, text);
  return Object.freeze({ type: "TextFileWrite", path: receipt.path, bytes: receipt.bytes });
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "write-text-file", description: "writeTextFile — the write-text-file operation.", operation: writeTextFile }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
