#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { argument } from "@red-cup-engineering/javascript-node-services-section/argv";

import {
  inventorySoftware,
  softwareInventoryJson,
  validateSoftwareInventoryJson,
} from "../src/software-inventory.mjs";

const CLASSIFICATIONS = new Set(["owned-source", "off-tree-owned", "vendor", "cache", "release", "archive", "recovery", "unclassified"]);

function usage() {
  return "usage: inventory-software --root PATH --source URI --owner URN --classification KIND [--systemd-host HOST] [--format json|dot]";
}

const KNOWN_FLAGS = Object.freeze(["--root", "--source", "--owner", "--classification", "--systemd-host", "--systemd-source", "--systemd-owner", "--systemd-classification", "--systemd-aliases", "--format"]);

export function parseOperatorArguments(argv) {
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined || !flag?.startsWith("--")) throw new TypeError(usage());
    if (!KNOWN_FLAGS.includes(flag)) throw new TypeError(`unknown option ${flag}\n${usage()}`);
  }
  const systemdAliases = argument("--systemd-aliases", argv);
  const options = {
    format: argument("--format", argv) ?? "json",
    root: argument("--root", argv),
    source: argument("--source", argv),
    owner: argument("--owner", argv),
    classification: argument("--classification", argv),
    systemdHost: argument("--systemd-host", argv),
    systemdSource: argument("--systemd-source", argv),
    systemdOwner: argument("--systemd-owner", argv),
    systemdClassification: argument("--systemd-classification", argv),
    ...(systemdAliases === undefined ? {} : { systemdAliases: systemdAliases.split(",").filter(Boolean) }),
  };
  for (const field of ["root", "source", "owner", "classification"]) if (typeof options[field] !== "string" || options[field].length === 0) throw new TypeError(usage());
  if (!CLASSIFICATIONS.has(options.classification)) throw new TypeError(`unknown classification ${options.classification}`);
  if (!["json", "dot"].includes(options.format)) throw new TypeError("format must be json or dot");
  const systemdBindingFields = [options.systemdSource, options.systemdOwner, options.systemdClassification];
  if (systemdBindingFields.some((value) => value !== undefined) && systemdBindingFields.some((value) => value === undefined)) throw new TypeError("systemd source, owner, and classification must be supplied together");
  if (options.systemdClassification !== undefined && !CLASSIFICATIONS.has(options.systemdClassification)) throw new TypeError(`unknown systemd classification ${options.systemdClassification}`);
  return Object.freeze(options);
}

function jsonCarrier(_key, value) {
  return value instanceof Uint8Array ? { base64: Buffer.from(value).toString("base64") } : value;
}

export async function runOperator(argv, io = process) {
  const options = parseOperatorArguments(argv);
  const result = await inventorySoftware({
    root: options.root,
    rootBinding: { source: options.source, owner: options.owner, classification: options.classification },
    ...(options.systemdHost === undefined ? {} : { systemdHost: options.systemdHost }),
    ...(options.systemdSource === undefined ? {} : { systemdSourceBinding: { source: options.systemdSource, owner: options.systemdOwner, classification: options.systemdClassification, aliases: options.systemdAliases ?? [] } }),
  });
  const receiver = softwareInventoryJson(result);
  const verdict = validateSoftwareInventoryJson(receiver);
  if (!verdict.ok) throw new TypeError(`software inventory output failed schema validation: ${JSON.stringify(verdict.errors)}`);
  io.stdout.write(options.format === "dot" ? result.chart.text : `${JSON.stringify(receiver, jsonCarrier, 2)}\n`);
  return result;
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runOperator(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
