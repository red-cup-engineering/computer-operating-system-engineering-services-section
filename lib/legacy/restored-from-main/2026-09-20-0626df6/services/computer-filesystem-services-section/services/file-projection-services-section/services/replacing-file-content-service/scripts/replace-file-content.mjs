#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMain } from "@red-cup-engineering/javascript-file-main-guard-service";

export async function replaceFileContent({ path, search, replacement, expectedCount, dryRun = false } = {}) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("path is required");
  if (typeof search !== "string" || search.length === 0) throw new TypeError("search is required");
  if (typeof replacement !== "string") throw new TypeError("replacement must be a string");
  if (expectedCount !== undefined && (!Number.isSafeInteger(expectedCount) || expectedCount < 0)) {
    throw new TypeError("expectedCount must be a non-negative integer");
  }

  const absolutePath = resolve(path);
  const content = await readFile(absolutePath, "utf8");
  const count = content.split(search).length - 1;
  if (expectedCount !== undefined && count !== expectedCount) {
    throw new Error(`expected ${expectedCount} matches in ${absolutePath}, found ${count}`);
  }
  const result = Object.freeze({ path: absolutePath, matches: count, changed: count > 0, dryRun });
  if (dryRun || count === 0) return result;

  const metadata = await stat(absolutePath);
  const temporaryPath = `${dirname(absolutePath)}/.${basename(absolutePath)}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content.split(search).join(replacement), { encoding: "utf8", mode: metadata.mode, flag: "wx" });
    await rename(temporaryPath, absolutePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  return result;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--file") options.path = argv[++index];
    else if (argument === "--search") options.search = argv[++index];
    else if (argument === "--replacement") options.replacement = argv[++index];
    else if (argument === "--expected-count") options.expectedCount = Number(argv[++index]);
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--help") options.help = true;
    else throw new TypeError(`unknown argument: ${argument}`);
  }
  return options;
}

async function main({ argv, stdout }) {
  const options = parseArgs(argv);
  if (options.help) {
    stdout.write("usage: replace-file-content --file <path> --search <text> --replacement <text> [--expected-count <number>] [--dry-run]\n");
    return;
  }
  stdout.write(`${JSON.stringify(await replaceFileContent(options))}\n`);
}

runMain(main, {
  moduleUrl: import.meta.url,
  isEntry: (url, entry) => resolve(fileURLToPath(url)) === resolve(entry ?? ""),
  formatError: (error) => `${error.message}\n`,
  exitCode: 1,
});
