#!/usr/bin/env node
import { extname } from "node:path";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

/**
 * Projects one filepath spelling to its final extension, including the dot, or the empty string when it has none, without observing the filesystem.
 * @param {string} path A filepath spelling.
 * @returns {string} The extension including its dot, or the empty string.
 * @throws {TypeError} When path is not a string.
 */
export function projectFilepathExtension(path) {
  if (typeof path !== "string") throw new TypeError("a filepath string is required");
  return extname(path);
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "project-filepath-extension", description: "Projects one filepath spelling to its final extension, including the dot, or the empty string when it has none, without observing the filesystem.", operation: projectFilepathExtension }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
