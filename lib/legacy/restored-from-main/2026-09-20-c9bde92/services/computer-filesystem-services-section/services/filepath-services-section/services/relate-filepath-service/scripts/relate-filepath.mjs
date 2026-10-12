#!/usr/bin/env node
import { relative } from "node:path";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

/**
 * Projects the relative filepath spelling from one path to another, without observing the filesystem.
 * @param {object} request A record with from and to filepath spellings.
 * @returns {string} The relative path from from to to.
 * @throws {TypeError} When from or to is not a string.
 */
export function relateFilepath(request) {
  if (typeof request?.from !== "string" || typeof request?.to !== "string") throw new TypeError("from and to filepath strings are required");
  return relative(request.from, request.to);
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "relate-filepath", description: "Projects the relative filepath spelling from one path to another, without observing the filesystem.", operation: relateFilepath }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
