import test from "node:test";
import assert from "node:assert/strict";
import {decodeWindowsHostPressure,createWindowsHostObservation} from "../src/windows-physical-observation.mjs";
// Synthetic protocol examples; no physical host or transport is qualified here.
const binding = {"physicalHost":"windows-machine:01234567-89ab-cdef-0123-456789abcdef","epoch":"0123456789abcdef0123456789abcdef","volumes":["\\\\?\\Volume{01234567-89ab-cdef-0123-456789abcdef}\\"],"receipt":"fixture:received-backing-volume"};
const frame = {"kind":"windows.host-pressure","physicalHost":"windows-machine:01234567-89ab-cdef-0123-456789abcdef","epoch":"0123456789abcdef0123456789abcdef","observedAt":10000,"sampleElapsedMs":5,"availableMemoryBytes":4000000000,"availableCommitBytes":8000000000,"volumes":[{"id":"\\\\?\\Volume{01234567-89ab-cdef-0123-456789abcdef}\\","freeBytes":10000000000}],"diskQueueLength":0,"counterStatus":0};
const decode = r => decodeWindowsHostPressure(JSON.stringify(r),binding,10005,1000);
test("complete Windows frame includes shared commit and all backing volumes",()=>{
 const r=decode(frame);assert.equal(r.availableCommitBytes,8000000000);assert.equal(r.observationReceipt,binding.receipt);
 assert.equal(r.volumes[0].id,binding.volumes[0].toLowerCase());assert.equal(r.diskQueueLength,0);assert(Object.isFrozen(r.volumes));
});
for(const [name,change,reason] of [
 ["missing commit",{availableCommitBytes:null},"windows-memory-observation-incomplete"],
 ["failed PDH counter",{counterStatus:5,diskQueueLength:0},"windows-disk-counter-unwitnessed"],
 ["missing backing volume",{volumes:[]},"windows-backing-volume-unwitnessed"],
 ["another epoch",{epoch:"f".repeat(32)},"windows-observation-owner-mismatch"],
 ["old observation",{observedAt:8000},"windows-observation-stale-or-incomplete"],
 ["unfinished observation",{sampleElapsedMs:6},"windows-observation-stale-or-incomplete"],
 ["future observation",{observedAt:10006},"windows-observation-stale-or-incomplete"],
 ["unknown extra field",{permission:true},"windows-observation-incomplete"]
])test(name,()=>assert.equal(decode({...frame,...change}).reason,reason));
test("overlong and malformed transport never imply free capacity",()=>{
 assert.equal(decodeWindowsHostPressure("x".repeat(8193),binding,10005,1000).reason,"windows-observation-wire-unavailable");
 assert.equal(decodeWindowsHostPressure("{",binding,10005,1000).reason,"windows-observation-wire-invalid");
});
test("sampler failure has no shell or zero fallback",async()=>{
 const observation=createWindowsHostObservation({sample:async()=>{throw Error("missing resource");},binding,now:()=>10005,maximumAgeMs:1000});
 assert.equal((await observation.observe()).reason,"windows-native-sampler-unavailable");
});
test("held binding cannot be changed by a later request",async()=>{
 const b=structuredClone(binding),observation=createWindowsHostObservation({sample:async()=>JSON.stringify(frame),binding:b,now:()=>10005,maximumAgeMs:1000});
 b.epoch="f".repeat(32);b.volumes.length=0;assert.equal((await observation.observe()).samplerEpoch,binding.epoch);
});
test("proxy, accessors, duplicates and unbounded lifetime cannot define ownership",()=>{
 assert.throws(()=>decodeWindowsHostPressure("",new Proxy(binding,{}),10005,1000),TypeError);
 assert.throws(()=>decodeWindowsHostPressure("",{...binding,get epoch(){throw Error("untrusted");}},10005,1000),TypeError);
 assert.throws(()=>decodeWindowsHostPressure("",{...binding,volumes:[...binding.volumes,...binding.volumes]},10005,1000),TypeError);
 assert.throws(()=>decodeWindowsHostPressure("",binding,10005,1001),TypeError);
});
