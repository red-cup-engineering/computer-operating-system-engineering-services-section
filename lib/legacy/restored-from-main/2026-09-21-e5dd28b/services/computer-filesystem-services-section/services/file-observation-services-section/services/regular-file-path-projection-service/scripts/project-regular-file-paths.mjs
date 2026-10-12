#!/usr/bin/env node
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";


export function projectRegularFilePaths(walk) {
  if (!walk || walk.type !== "PosixPathWalk" || !Array.isArray(walk.files)) throw new TypeError("walk must be a PosixPathWalk observation");
  return Object.freeze(walk.files.filter(({ kind }) => kind === "file").map(({ path }) => path));
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "project-regular-file-paths", description: "projectRegularFilePaths — the project-regular-file-paths operation.", operation: projectRegularFilePaths }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
