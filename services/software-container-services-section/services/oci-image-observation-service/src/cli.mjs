#!/usr/bin/env node
import { argument } from "@red-cup-engineering/javascript-node-services-section/argv";
import { createOciDistributionHttpReadAuthority, observeOciImage } from "./observe-oci-image.mjs";

function usage() {
  return "Usage: observe-oci-image --reference <registry/repository@sha256:digest> [--platform <os/architecture[/variant]>]\nAnonymous public-registry reads only; raw credential flags are intentionally unsupported.\n";
}

// Raw credential flags (e.g. --token) are intentionally unsupported: any
// argument outside this allowlist -- not just a missing value -- must fail
// closed, so no accidental credential surface is ever silently accepted.
const KNOWN_FLAGS = Object.freeze(["--help", "--reference", "--platform"]);

function argumentsFrom(argv) {
  for (const token of argv) {
    if (token.startsWith("--") && !KNOWN_FLAGS.includes(token)) throw new TypeError(`unknown or incomplete argument ${token}`);
  }
  if (argv.includes("--help")) return { help: true };
  const reference = argument("--reference", argv);
  if (reference === undefined) throw new TypeError("--reference is required");
  const platform = argument("--platform", argv);
  return platform === undefined ? { reference } : { reference, platform };
}

try {
  const args = argumentsFrom(process.argv.slice(2));
  if (args.help) process.stdout.write(usage());
  else {
    const at = args.reference.lastIndexOf("@"), slash = args.reference.indexOf("/");
    if (at < 0 || slash < 1 || slash > at) throw new TypeError("--reference must contain registry/repository@digest");
    const registry = args.reference.slice(0, slash), repository = args.reference.slice(slash + 1, at);
    const platformParts = args.platform?.split("/");
    if (platformParts !== undefined && ![2, 3].includes(platformParts.length)) throw new TypeError("--platform must be os/architecture[/variant]");
    const platform = platformParts === undefined ? undefined : { os: platformParts[0], architecture: platformParts[1], ...(platformParts.length === 3 ? { variant: platformParts[2] } : {}) };
    const registryReadAuthority = createOciDistributionHttpReadAuthority({ registry, repository, authMode: "anonymous" });
    const result = await observeOciImage({ reference: args.reference, ...(platform === undefined ? {} : { platform }) }, { registryReadAuthority });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === "refused") process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${usage()}`);
  process.exitCode = 2;
}
