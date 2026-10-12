#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { confineExistingPath } from "@red-cup-engineering/filepath-services-section";
import { runMain } from "@red-cup-engineering/javascript-file-main-guard-service";

function kindOf(entry) {
  if (entry.isSymbolicLink()) return "symlink";
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  return "other";
}

/** Observe one level of an existing directory with caller-owned exclusions. */
export async function listDirectoryEntries({ root, path = "", excludes = [] } = {}) {
  if (!Array.isArray(excludes) || excludes.some((name) => typeof name !== "string")) {
    throw new TypeError("excludes must be an array of names");
  }
  const address = await confineExistingPath({ root, path });
  const entries = await readdir(address.path, { withFileTypes: true });
  const excluded = new Set(excludes);
  const observed = entries
    .filter((entry) => !excluded.has(entry.name))
    .map((entry) => Object.freeze({ name: entry.name, kind: kindOf(entry) }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return Object.freeze({
    type: "DirectoryEntryList",
    root: address.root,
    path: address.relativePath === "." ? "" : address.relativePath,
    entries: Object.freeze(observed),
    excluded: entries.length - observed.length,
  });
}

function parseArguments(argv) {
  const options = { path: "", excludes: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") options.root = argv[++index];
    else if (argument === "--path") options.path = argv[++index];
    else if (argument === "--exclude") options.excludes.push(argv[++index]);
    else throw new TypeError(`unrecognized argument: ${argument}`);
  }
  return options;
}

export async function runListDirectoryEntries(argv, io = process) {
  const result = await listDirectoryEntries(parseArguments(argv));
  io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

runMain(({ argv, stdout }) => runListDirectoryEntries(argv, { stdout }), {
  moduleUrl: import.meta.url,
  isEntry: (url, entry) => resolve(fileURLToPath(url)) === resolve(entry ?? ""),
  formatError: (error) => `list-directory-entries: ${error.message}\n`,
  exitCode: 64,
});
