/** Fixed native Windows observation; owning transport/binding are capabilities.
 * No shell, CIM, process, filesystem walk or fallback. Not an authority assay. */
import { types } from "node:util";
const fail = reason => Object.freeze({kind:"host-pressure.observation:obstruction",reason});
const guid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const volume=value=>typeof value==="string"&&value.length===49
 &&value.slice(0,11).toLowerCase()===String.fromCharCode(92,92,63,92)+"volume{"
 &&value.slice(47)===String.fromCharCode(125,92)&&guid.test(value.slice(11,47));
const uint=value=>Number.isSafeInteger(value)&&value>=0;
const exact=(v,keys)=>v!==null&&typeof v==="object"&&!Array.isArray(v)
 &&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function owner(binding) {
 if(!binding||types.isProxy(binding)||![null,Object.prototype].includes(Object.getPrototypeOf(binding)))
  throw new TypeError("received Windows sampler binding required");
 const d=Object.getOwnPropertyDescriptors(binding),keys=["physicalHost","epoch","volumes","receipt"];
 if(Reflect.ownKeys(d).length!==4||keys.some(k=>!Object.hasOwn(d[k]??{},"value")))
  throw new TypeError("finite data binding required");
 const b=Object.fromEntries(keys.map(k=>[k,d[k].value]));
 if(typeof b.physicalHost!=="string"||!b.physicalHost.startsWith("windows-machine:")||!guid.test(b.physicalHost.slice(16))
  ||b.physicalHost!==b.physicalHost.toLowerCase()||typeof b.epoch!=="string"||!/^[0-9a-f]{32}$/.test(b.epoch)
  ||typeof b.receipt!=="string"||!b.receipt||b.receipt.length>2048||types.isProxy(b.volumes)||!Array.isArray(b.volumes))
  throw new TypeError("received sampler identity and backing volumes required");
 const items=Object.getOwnPropertyDescriptors(b.volumes),n=items.length.value,volumes=[];
 if(n<1||n>8||Reflect.ownKeys(items).length!==n+1)throw new TypeError("finite backing volumes required");
 for(let i=0;i<n;i++){const item=items[i];if(!item||!Object.hasOwn(item,"value")||!volume(item.value))throw new TypeError("canonical volume GUID root required");volumes.push(item.value.toLowerCase());}
 if(new Set(volumes).size!==n)throw new TypeError("unique volumes required");
 return Object.freeze({...b,volumes:Object.freeze(volumes)});
}
function decode(wire,b,now,age) {
 if(typeof wire!=="string"||wire.length>8192||Buffer.byteLength(wire)>8192)return fail("windows-observation-wire-unavailable");
 let r;try{r=JSON.parse(wire);}catch{return fail("windows-observation-wire-invalid");}
 if(!exact(r,["kind","physicalHost","epoch","observedAt","sampleElapsedMs","availableMemoryBytes","availableCommitBytes","volumes","diskQueueLength","counterStatus"])||r.kind!=="windows.host-pressure")return fail("windows-observation-incomplete");
 if(r.physicalHost!==b.physicalHost||r.epoch!==b.epoch)return fail("windows-observation-owner-mismatch");
 if(!uint(now)||!uint(r.observedAt)||r.observedAt===0||now<r.observedAt||now-r.observedAt>age
  ||!uint(r.sampleElapsedMs)||r.sampleElapsedMs>age||r.observedAt+r.sampleElapsedMs>now)return fail("windows-observation-stale-or-incomplete");
 if(!uint(r.availableMemoryBytes)||!uint(r.availableCommitBytes))return fail("windows-memory-observation-incomplete");
 if(![0,1].includes(r.counterStatus)||!Number.isFinite(r.diskQueueLength)||r.diskQueueLength<0)return fail("windows-disk-counter-unwitnessed");
 if(!Array.isArray(r.volumes)||r.volumes.length!==b.volumes.length)return fail("windows-backing-volume-unwitnessed");
 const volumes=[];
 for(const v of r.volumes){if(!exact(v,["id","freeBytes"])||!volume(v.id)||!uint(v.freeBytes))return fail("windows-backing-volume-unwitnessed");volumes.push(Object.freeze({id:v.id.toLowerCase(),freeBytes:v.freeBytes}));}
 if(new Set(volumes.map(v=>v.id)).size!==volumes.length||b.volumes.some(id=>!volumes.some(v=>v.id===id)))return fail("windows-backing-volume-unwitnessed");
 return Object.freeze({physicalHost:b.physicalHost,observedAt:r.observedAt,availableMemoryBytes:r.availableMemoryBytes,
  availableCommitBytes:r.availableCommitBytes,volumes:Object.freeze(volumes),diskQueueLength:r.diskQueueLength,
  observationReceipt:b.receipt,samplerEpoch:b.epoch});
}
function lifetime(age){if(!Number.isSafeInteger(age)||age<1||age>1000)throw new TypeError("finite observation lifetime required");}
export function decodeWindowsHostPressure(wire,binding,now,maximumAgeMs){lifetime(maximumAgeMs);return decode(wire,owner(binding),now,maximumAgeMs);}
export function createWindowsHostObservation({sample,binding,now=Date.now,maximumAgeMs}){
 if(typeof sample!=="function"||typeof now!=="function")throw new TypeError("held native sampler and clock required");
 lifetime(maximumAgeMs);const b=owner(binding);
 return Object.freeze({async observe(){let wire;try{wire=await sample();}catch{return fail("windows-native-sampler-unavailable");}
  return decode(wire,b,now(),maximumAgeMs);}});
}
