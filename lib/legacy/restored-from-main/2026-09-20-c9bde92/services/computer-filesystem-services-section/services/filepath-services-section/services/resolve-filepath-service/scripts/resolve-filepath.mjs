#!/usr/bin/env node
import { projectJavascriptArgvTail } from "@red-cup-engineering/javascript-node-services-section/argv";
import { writeJavascriptNodeStandardOutputText } from "@red-cup-engineering/write-javascript-node-standard-output-text-service";
import { resolve } from "node:path";

export function resolveFilepath(segments) {
  if (!Array.isArray(segments) || segments.length === 0 || segments.some((segment) => typeof segment !== "string")) throw new TypeError("segments must be a nonempty array of strings");
  return resolve(...segments);
}

if (import.meta.main) {
  const tail = projectJavascriptArgvTail({ type: "JavascriptArgumentVector", version: 1, arguments: process.argv });
  await writeJavascriptNodeStandardOutputText({ type: "JavascriptNodeStandardOutputTextWriteRequest", version: 1, text: `${resolveFilepath(tail.arguments)}\n` }, { standardOutput: process.stdout });
}
