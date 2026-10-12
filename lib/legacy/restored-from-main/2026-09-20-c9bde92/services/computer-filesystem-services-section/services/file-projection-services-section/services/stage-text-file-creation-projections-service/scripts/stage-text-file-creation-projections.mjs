#!/usr/bin/env node
import { chmod, lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { immutableJsonValue } from "../../../../../../../../../../computer-data-engineering-services-section/services/serialized-computer-data-engineering-services-section/services/json-services-section/src/index.mjs";
import { readTextFileCreationStage } from "@red-cup-engineering/read-text-file-creation-stage-service";
import { admitTextFileCreationProjectionSet } from "@red-cup-engineering/text-file-creation-projection-set-admission-service";
import { runJavascriptNodeOperation } from "../../../../../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

function refusal(code, message, refusedPath = null) {
  return immutableJsonValue({ type: "TextFileCreationStagingRefusal", version: 1, code, message, path: refusedPath });
}

async function stage(request) {
  if (request === null || typeof request !== "object" || Array.isArray(request)) return refusal("INVALID_REQUEST", "input must be a TextFileCreationStagingRequest");
  if (Object.keys(request).sort().join(",") !== "files,filesDigest,parentDirectory,type,version") {
    return refusal("UNEXPECTED_FIELDS", "request must carry exactly files, filesDigest, parentDirectory, type, and version");
  }
  if (request.type !== "TextFileCreationStagingRequest" || request.version !== 1) return refusal("INVALID_REQUEST", "request type and version must be TextFileCreationStagingRequest@1");
  if (typeof request.parentDirectory !== "string" || !path.isAbsolute(request.parentDirectory) || path.resolve(request.parentDirectory) !== request.parentDirectory) {
    return refusal("INVALID_PARENT", "parentDirectory must be an absolute normalized path");
  }
  let parentStatus;
  try {
    parentStatus = await lstat(request.parentDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") return refusal("MISSING_PARENT", "parentDirectory does not exist", request.parentDirectory);
    throw error;
  }
  if (!parentStatus.isDirectory() || parentStatus.isSymbolicLink() || await realpath(request.parentDirectory) !== request.parentDirectory) {
    return refusal("INVALID_PARENT", "parentDirectory must be a canonical non-symbolic-link directory", request.parentDirectory);
  }
  const set = admitTextFileCreationProjectionSet({
    type: "TextFileCreationProjectionSet",
    version: 1,
    files: request.files,
    filesDigest: request.filesDigest,
  });
  if (set.type !== "TextFileCreationProjectionSet") return refusal(set.code, set.message, set.path);

  const stageDirectory = await mkdtemp(path.join(request.parentDirectory, ".text-file-creation-stage-"));
  try {
    for (const file of set.files) {
      const target = path.join(stageDirectory, ...file.path.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.text, { flag: "wx", mode: file.mode });
      await chmod(target, file.mode);
    }
    const read = await readTextFileCreationStage({
      type: "TextFileCreationStage",
      version: 1,
      stageDirectory,
      files: set.files,
      filesDigest: set.filesDigest,
    });
    if (read.type !== "TextFileCreationStageRead") {
      await rm(stageDirectory, { recursive: true, force: true });
      return refusal(read.code, read.message, read.path);
    }
    return read;
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true });
    return refusal("STAGING_FAILED", error.message, stageDirectory);
  }
}

/**
 * Exclusively writes admitted text-file projections into a new temporary directory and reads them back.
 *
 * @param {object} request A TextFileCreationStagingRequest.
 * @returns {Promise<object>} A proven TextFileCreationStageRead or a specific refusal record.
 */
export async function stageTextFileCreationProjections(request) {
  return stage(request);
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "stage-text-file-creation-projections", description: "Exclusively writes admitted text-file projections into a new temporary directory and reads them back.", operation: stageTextFileCreationProjections }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
