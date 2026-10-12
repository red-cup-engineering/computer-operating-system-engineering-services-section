#!/usr/bin/env node
import { isAbsolute } from "node:path";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

/**
 * Reports whether one filepath spelling is absolute on this platform, without observing the filesystem.
 * @param {string} path A filepath spelling.
 * @returns {boolean} Whether the spelling is absolute.
 * @throws {TypeError} When path is not a string.
 */
export function isAbsoluteFilepath(path) {
  if (typeof path !== "string") throw new TypeError("a filepath string is required");
  return isAbsolute(path);
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "is-absolute-filepath", description: "Reports whether one filepath spelling is absolute on this platform, without observing the filesystem.", operation: isAbsoluteFilepath }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
