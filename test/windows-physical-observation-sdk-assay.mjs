import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { decodeWindowsHostPressure } from "../src/windows-physical-observation.mjs";

// One SDK-produced frame, read from an exact ephemeral assay file, never a host walk.
// Values identify this assay only; they do not certify production owner authority.
const path = process.argv[2];
assert.equal(typeof path, "string");
const size = statSync(path).size;
assert(size > 0 && size <= 8192);
const wire = readFileSync(path, "utf8");
assert(Buffer.byteLength(wire) <= 8192);
const frame = JSON.parse(wire);
const binding = {
 physicalHost: frame.physicalHost, epoch: frame.epoch,
 volumes: frame.volumes.map(v => v.id), receipt: "assay:ephemeral-windows-sdk-frame"
};
const now = frame.observedAt + frame.sampleElapsedMs;
const received = decodeWindowsHostPressure(wire, binding, now, 1000);
assert.equal(received.physicalHost, binding.physicalHost);
assert.equal(received.samplerEpoch, binding.epoch);
assert(Number.isSafeInteger(received.availableMemoryBytes));
assert(Number.isSafeInteger(received.availableCommitBytes));
assert.equal(received.volumes.length, 1);
assert(Number.isSafeInteger(received.volumes[0].freeBytes));
assert(Number.isFinite(received.diskQueueLength));
assert.equal(decodeWindowsHostPressure(wire, {...binding, epoch:"f".repeat(32)}, now, 1000).reason,
 "windows-observation-owner-mismatch");
assert.equal(decodeWindowsHostPressure(JSON.stringify({...frame, counterStatus:5}), binding, now, 1000).reason,
 "windows-disk-counter-unwitnessed");
assert.equal(decodeWindowsHostPressure(wire, binding, now + 1001, 1000).reason,
 "windows-observation-stale-or-incomplete");
console.log("SDK frame received; owner mismatch, invalid counter and stale frame refused. No production host qualification asserted.");
