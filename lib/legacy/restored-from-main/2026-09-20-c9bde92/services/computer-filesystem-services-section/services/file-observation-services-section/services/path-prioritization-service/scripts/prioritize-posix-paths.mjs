#!/usr/bin/env node
import { prioritizePosixPaths } from "../src/prioritize-posix-paths.mjs";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

/** Read one JSON request from stdin and write its ordered path array as JSON. */
export async function runPrioritizePosixPaths(io = process) {
  let input = "";
  for await (const chunk of io.stdin) input += chunk;
  const result = prioritizePosixPaths(JSON.parse(input));
  io.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "prioritize-posix-paths", description: "Read one JSON request from stdin and write its ordered path array as JSON.", operation: runPrioritizePosixPaths }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
