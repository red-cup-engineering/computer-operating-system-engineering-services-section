#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

/**
 * Projects one file: URL spelling, such as a module's import.meta.url, to the platform filepath it names.
 * @param {string} url A file: URL string.
 * @returns {string} The platform filepath the URL names.
 * @throws {TypeError} When url is not a string beginning with file:.
 */
export function projectFileUrlFilepath(url) {
  if (typeof url !== "string" || !url.startsWith("file:")) throw new TypeError("a file: URL string is required");
  return fileURLToPath(url);
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "project-file-url-filepath", description: "Projects one file: URL spelling, such as a module's import.meta.url, to the platform filepath it names.", operation: projectFileUrlFilepath }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
