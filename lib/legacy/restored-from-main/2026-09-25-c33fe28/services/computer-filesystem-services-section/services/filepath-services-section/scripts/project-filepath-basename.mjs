#!/usr/bin/env node
import { once } from "node:events";
import { parseJavascriptArgv } from "@red-cup-engineering/javascript-node-services-section/argv";
import { basename } from "node:path";

export function projectFilepathBasename(path) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("path must be a nonempty string");
  return basename(path);
}

if (import.meta.main) {
  const parsed = parseJavascriptArgv({ type: "JavascriptArgvParsingRequest", version: 1, argumentVector: { type: "JavascriptArgumentVector", version: 1, arguments: process.argv }, options: {}, allowPositionals: true, strict: true });
  if (parsed.positionals.length !== 1) throw new TypeError("usage: project-filepath-basename PATH");
  const output = `${projectFilepathBasename(parsed.positionals[0])}\n`;
  if (!process.stdout.write(output)) await once(process.stdout, "drain");
}
