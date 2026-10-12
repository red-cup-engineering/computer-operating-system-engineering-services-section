#!/usr/bin/env node
import { lstat, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMain } from "@red-cup-engineering/javascript-file-main-guard-service";

export async function relocateDirectory({ source, destination, apply = false } = {}) {
  if (typeof source !== "string" || source.length === 0) throw new TypeError("source is required");
  if (typeof destination !== "string" || destination.length === 0) throw new TypeError("destination is required");
  const absoluteSource = resolve(source);
  const absoluteDestination = resolve(destination);
  if (absoluteSource === absoluteDestination) throw new Error("source and destination are the same directory");
  const sourceStat = await lstat(absoluteSource).catch(() => null);
  if (!sourceStat?.isDirectory()) throw new Error(`source is not a directory: ${absoluteSource}`);
  if (await lstat(absoluteDestination).then(() => true, () => false)) {
    throw new Error(`destination already exists: ${absoluteDestination}`);
  }

  const result = { source: absoluteSource, destination: absoluteDestination, apply };
  if (!apply) return Object.freeze(result);
  await mkdir(dirname(absoluteDestination), { recursive: true });
  try {
    await rename(absoluteSource, absoluteDestination);
  } catch (error) {
    if (error.code === "EXDEV") throw new Error("source and destination are on different filesystems; refusing a non-atomic copy/delete move");
    throw error;
  }
  return Object.freeze({ ...result, completed: true });
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source") options.source = argv[++index];
    else if (argument === "--destination") options.destination = argv[++index];
    else if (argument === "--apply") options.apply = true;
    else if (argument === "--help") options.help = true;
    else throw new TypeError(`unknown argument: ${argument}`);
  }
  return options;
}

async function main({ argv, stdout }) {
  const options = parseArgs(argv);
  if (options.help) {
    stdout.write("usage: relocate-directory --source <directory> --destination <directory> [--apply]\n");
    return;
  }
  stdout.write(`${JSON.stringify(await relocateDirectory(options))}\n`);
}

runMain(main, {
  moduleUrl: import.meta.url,
  isEntry: (url, entry) => resolve(fileURLToPath(url)) === resolve(entry ?? ""),
  formatError: (error) => `${error.message}\n`,
  exitCode: 1,
});
