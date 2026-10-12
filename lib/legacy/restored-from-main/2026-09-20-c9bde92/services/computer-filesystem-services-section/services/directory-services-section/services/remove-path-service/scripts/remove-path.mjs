#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

/**
 * Removes one file or directory tree at a path, and reports the path removed; an absent path is not an error.
 * @param {object} request A record with the path to remove.
 * @returns {Promise<object>} A PathRemoved record.
 * @throws {TypeError} When path is not a non-empty string.
 */
export async function removePath(request) {
  if (typeof request?.path !== "string" || request.path.length === 0) throw new TypeError("a non-empty path is required");
  await rm(request.path, { recursive: true, force: true });
  return { type: "PathRemoved", path: request.path };
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "remove-path", description: "Removes one file or directory tree at a path, and reports the path removed; an absent path is not an error.", operation: removePath }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
