#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

/**
 * Makes one directory and every missing ancestor, and reports the path made.
 * @param {object} request A record with the directory path.
 * @returns {Promise<object>} A DirectoryMade record.
 * @throws {TypeError} When path is not a non-empty string.
 */
export async function makeDirectory(request) {
  if (typeof request?.path !== "string" || request.path.length === 0) throw new TypeError("a non-empty path is required");
  await mkdir(request.path, { recursive: true });
  return { type: "DirectoryMade", path: request.path };
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "make-directory", description: "Makes one directory and every missing ancestor, and reports the path made.", operation: makeDirectory }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
