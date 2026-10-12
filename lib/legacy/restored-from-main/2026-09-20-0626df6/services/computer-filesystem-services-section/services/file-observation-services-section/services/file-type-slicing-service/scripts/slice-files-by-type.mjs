#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runMain } from "@red-cup-engineering/javascript-file-main-guard-service";

function extensionOf(path) {
  const basename = path.slice(path.lastIndexOf("/") + 1);
  const extension = extname(basename);
  return extension ? extension.slice(1).toLowerCase() : "";
}

/** Group an already-observed file list by final, lowercased extension. */
export function sliceFilesByType({ files } = {}) {
  if (!Array.isArray(files)) throw new TypeError("files must be an array");
  const slices = {};
  let totalCount = 0;
  let totalBytes = 0;
  for (const file of files) {
    if (typeof file?.path !== "string" || typeof file?.bytes !== "number") {
      throw new TypeError("each file needs a string path and a numeric bytes");
    }
    const extension = extensionOf(file.path);
    const slice = slices[extension] ?? (slices[extension] = { count: 0, bytes: 0, paths: [] });
    slice.count += 1;
    slice.bytes += file.bytes;
    slice.paths.push(file.path);
    totalCount += 1;
    totalBytes += file.bytes;
  }
  for (const extension of Object.keys(slices)) {
    slices[extension].paths.sort((left, right) => left.localeCompare(right));
    slices[extension] = Object.freeze({ ...slices[extension], paths: Object.freeze(slices[extension].paths) });
  }
  return Object.freeze({
    type: "FileTypeSlice",
    slices: Object.freeze(slices),
    total: Object.freeze({ count: totalCount, bytes: totalBytes }),
  });
}

async function readInput(path, io) {
  if (path) return readFile(path, "utf8");
  io.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of io.stdin) input += chunk;
  return input;
}

export async function runSliceFilesByType(argv, io = process) {
  const index = argv.indexOf("--walk");
  if (argv.length > 0 && index < 0) throw new TypeError("usage: slice-files-by-type [--walk PATH]");
  const text = await readInput(index < 0 ? undefined : argv[index + 1], io);
  let walk;
  try { walk = JSON.parse(text); } catch (error) { throw new Error(`input is not valid JSON: ${error.message}`); }
  if (walk?.type !== "PosixPathWalk" || !Array.isArray(walk.files)) throw new Error("input is not a PosixPathWalk record");
  const result = sliceFilesByType({ files: walk.files });
  io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

runMain(
  ({ argv, stdout, stderr }) => runSliceFilesByType(argv, { stdin: process.stdin, stdout, stderr }),
  {
    moduleUrl: import.meta.url,
    isEntry: (url, entry) => resolve(fileURLToPath(url)) === resolve(entry ?? ""),
    formatError: (error) => `slice-files-by-type: ${error.message}\n`,
    exitCode: 64,
  },
);
