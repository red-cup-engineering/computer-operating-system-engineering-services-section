import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeBackingVolumeCapacity, assessBackingVolumeHeadroom } from '../src/backing-capacity.mjs';

const now = Date.parse('2026-10-19T20:00:00.000Z');
function fixture() {
  const p = { schema: 'wsl-host-parameters@1', windows: { backingStorage: {
    distributionName: 'Example', registryKey: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss\\{11111111-1111-1111-1111-111111111111}',
    basePath: 'D:\\distros\\example', vhdFileName: 'ext4.vhdx', volumeId: '\\\\?\\Volume{22222222-2222-2222-2222-222222222222}\\',
    powershell: '/mnt/d/Windows/WindowsPowerShell/powershell.exe', wslpath: '/usr/bin/wslpath', linuxMount: '/', timeoutMs: 1000, maxAgeMs: 2000,
    policy: { minFreeBytes: '0', minFreePercent: 3, growthBytes: '2048', overheadBytes: '64', basis: 'Explicit estimated metadata allowance, not reservation' }
  } } };
  const expected = p.windows.backingStorage;
  const result = { requestNonce: '0a'.repeat(32), at: new Date(now).toISOString(), distribution: { name: 'Example', basePath: expected.basePath, vhdFileName: 'ext4.vhdx' },
    volume: { id: expected.volumeId, totalBytes: '100000', availableBytes: '1500', volumeFreeBytes: '1500', callerAvailableBytes: '2000', allocationUnitBytes: '4096' },
    vhd: { path: 'D:\\distros\\example\\ext4.vhdx', lengthBytes: '50000', attributes: 32, sparse: false } };
  const calls = [], ports = { now: () => now, monotonic: () => 100, nonce: () => '0a'.repeat(32), osRelease: () => 'microsoft-standard-WSL2', environment: { WSL_DISTRO_NAME: 'Example' },
    deviceOf: path => ({ real: path, device: '77' }), run: (program, args) => { calls.push({program,args}); return program === expected.wslpath ? '\\\\wsl.localhost\\Example\\\n' : JSON.stringify(result); } };
  return { p, result, calls, ports };
}
test('real root identity and registered VHDX join produce physical capacity independently of guest free space', () => {
  const f = fixture(), r = observeBackingVolumeCapacity(f.p, ['/gnu/store', '/var/tmp'], f.ports);
  assert.equal(r.type, 'WslBackingVolumeCapacity'); assert.equal(r.at, new Date(now).toISOString());
  assert.deepEqual(r.freshness, { requestNonce: '0a'.repeat(32), producerAt: new Date(now).toISOString(), elapsedMs: 0 });
  assert.equal(r.mappings.length, 2); assert.equal(r.volumes[0].availableBytes, '1500'); assert.equal(r.volumes[0].policy.minFreePercent, 3);
  assert.equal(r.admissionKind, 'snapshot-not-reservation'); assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0].args, ['-w', '/']); assert.deepEqual(f.calls[1].args.slice(0,4), ['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand']);
  const script = Buffer.from(f.calls[1].args[4], 'base64').toString('utf16le');
  assert.ok(script.indexOf('$ProgressPreference') < script.indexOf('ConvertFrom-Json'));
  assert.match(script, /requestNonce = \$expected\.requestNonce/);
  assert.match(script, /Get-Volume -FilePath/); assert.doesNotMatch(script, /wsl\.exe|compact vdisk|fstrim|Set-Item|Remove-Item|set-sparse/);
});
test('caller quota is independently limiting and cannot be replaced by larger volume free space',()=>{
  const f=fixture();f.result.volume.callerAvailableBytes='1000';f.result.volume.availableBytes='1000';
  assert.equal(observeBackingVolumeCapacity(f.p,['/'],f.ports).volumes[0].availableBytes,'1000');
  f.result.volume.availableBytes='1500';assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/limiting caller/);
});
test('health retains independent physical percentage, growth and estimated overhead and reports low capacity',()=>{
  const f=fixture(),v=observeBackingVolumeCapacity(f.p,['/'],f.ports);
  const [h]=assessBackingVolumeHeadroom(v);assert.equal(h.requiredBytes,'5112');assert.equal(h.availableBytes,'1500');assert.equal(h.admitted,false);
  v.volumes[0].availableBytes='5112';assert.equal(assessBackingVolumeHeadroom(v)[0].admitted,true);
});
test('unknown destination device refuses before invoking Windows or wslpath', () => {
  const f=fixture(); f.ports.deviceOf=path=>({real:path,device:path==='/mnt/d'?'88':'77'});
  assert.throws(()=>observeBackingVolumeCapacity(f.p,['/mnt/d'],f.ports),/unknown backing/); assert.equal(f.calls.length,0);
});
test('existing dangling ancestor redirects never borrow root capacity', () => {
  const dir=mkdtempSync(join(tmpdir(),'wsl-backing-link-'));try{
    symlinkSync(join(dir,'missing-volume'),join(dir,'redirect'));
    const f=fixture();delete f.ports.deviceOf;
    assert.throws(()=>observeBackingVolumeCapacity(f.p,[join(dir,'redirect','future')],f.ports),/dangling destination redirect/);
    assert.equal(f.calls.length,0);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('current environment and native root witness must both identify the registered distribution', () => {
  const f=fixture(); f.ports.environment.WSL_DISTRO_NAME='Other'; assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/current WSL/); assert.equal(f.calls.length,0);
  f.ports.environment.WSL_DISTRO_NAME='Example'; f.ports.run=()=> '\\\\wsl.localhost\\Other\\';
  assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/native WSL root identity/);
});
test('service-manager absence of distro environment still requires the native root identity',()=>{
  const f=fixture();f.ports.environment={};
  assert.equal(observeBackingVolumeCapacity(f.p,['/'],f.ports).type,'WslBackingVolumeCapacity');assert.equal(f.calls.length,2);
  f.ports.run=()=> '\\\\wsl.localhost\\Other\\';assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/native WSL root identity/);
});
test('registry, VHD path and volume identity changes each refuse', () => {
  for(const mutate of [f=>f.result.distribution.name='Other',f=>f.result.distribution.basePath='E:\\other',f=>f.result.distribution.vhdFileName='other.vhdx',f=>f.result.vhd.path='D:\\other.vhdx',f=>f.result.volume.id='\\\\?\\Volume{33333333-3333-3333-3333-333333333333}\\']){
    const f=fixture();mutate(f);assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/changed/);
  }
});
test('fresh bounded challenge responses retain foreign wall-clock offsets without treating them as age', () => {
  for(const delta of [-3600000,1002,3600000]){
    const f=fixture();f.result.at=new Date(now+delta).toISOString();
    const r=observeBackingVolumeCapacity(f.p,['/'],f.ports);
    assert.equal(r.at,new Date(now).toISOString());assert.equal(r.freshness.producerAt,f.result.at);
  }
});
test('missing, mismatched and replayed response challenges refuse',()=>{
  for(const nonce of [undefined,'0b'.repeat(32),'']){
    const f=fixture();f.result.requestNonce=nonce;
    assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/another request/);
  }
  const f=fixture();observeBackingVolumeCapacity(f.p,['/'],f.ports);
  f.ports.nonce=()=> '0b'.repeat(32);
  assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/another request/,'a prior valid response cannot satisfy a fresh request');
});
test('invalid request challenge refuses before invoking a native child',()=>{
  const f=fixture();f.ports.nonce=()=> 'not-a-request-challenge';
  assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/invalid capacity request challenge/);
  assert.equal(f.calls.length,0);
});
test('the whole local observation must remain within its monotonic freshness budget',()=>{
  for(const elapsed of [-1,2001,NaN,Infinity]){
    const f=fixture();let reads=0;f.ports.monotonic=()=> reads++?100+elapsed:100;
    assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/stale or unknown local/);
  }
  const f=fixture();let reads=0;f.ports.monotonic=()=> reads++?2100:100;
  assert.equal(observeBackingVolumeCapacity(f.p,['/'],f.ports).freshness.elapsedMs,2000);
  f.ports.monotonic=()=>NaN;assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/unknown local monotonic/);
});
test('late identity rechecks cannot extend the original observation age',()=>{
  const f=fixture();let elapsed=0,deviceReads=0;f.ports.monotonic=()=>elapsed;
  f.ports.deviceOf=path=>{if(++deviceReads>2)elapsed=2001;return{real:path,device:'77'};};
  assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/stale or unknown local/);
});
test('initial destination observation time is charged to the same freshness budget',()=>{
  const f=fixture();let elapsed=0;f.ports.monotonic=()=>elapsed;
  f.ports.deviceOf=path=>{elapsed=2001;return{real:path,device:'77'};};
  assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/stale or unknown local/);
});
test('native probe timeout cannot become a successful challenge response', () => {
  const f=fixture();f.ports.run=()=>{throw Object.assign(new Error('native timeout'),{code:'ETIMEDOUT'});};assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports),/native timeout/);
});
test('missing or malformed capacity, metadata and physical policy refuse rather than fabricate free space', () => {
  for(const mutate of [f=>delete f.result.at,f=>f.result.at='not a timestamp',f=>delete f.result.volume.availableBytes,f=>f.result.volume.availableBytes='100001',f=>f.result.volume.allocationUnitBytes='0',f=>f.result.vhd.sparse=true,f=>f.result.vhd.attributes=1040,f=>delete f.p.windows.backingStorage.policy.overheadBytes,f=>f.p.windows.backingStorage.policy.minFreePercent=-1]){
    const f=fixture();mutate(f);assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports));
  }
});
test('root or destination device drift during observation refuses', () => {
  const f=fixture();let changed=false;f.ports.deviceOf=path=>({real:path,device:changed?'99':'77'});const run=f.ports.run;f.ports.run=(...args)=>{const out=run(...args);if(args[0]===f.p.windows.backingStorage.powershell)changed=true;return out;};
  assert.throws(()=>observeBackingVolumeCapacity(f.p,['/gnu/store'],f.ports),/device changed/);
});
test('input paths, distro registry and limits are bounded before a native child', () => {
  for(const mutate of [f=>f.p.windows.backingStorage.registryKey='HKCU:\\Software',f=>f.p.windows.backingStorage.linuxMount='/mnt/other',f=>f.p.windows.backingStorage.timeoutMs=99999]){
    const f=fixture();mutate(f);assert.throws(()=>observeBackingVolumeCapacity(f.p,['/'],f.ports));assert.equal(f.calls.length,0);
  }
  const f=fixture();for(const paths of [[],['relative'],Array.from({length:33},(_,i)=>'/'+i),['/','/']])assert.throws(()=>observeBackingVolumeCapacity(f.p,paths,f.ports));assert.equal(f.calls.length,0);
});
test('existing capacity CLI refuses absent binding without rendering or writing host files', () => {
  const dir=mkdtempSync(join(tmpdir(),'wsl-capacity-'));try{const parameters=join(dir,'record.json');writeFileSync(parameters,JSON.stringify({schema:'wsl-host-parameters@1'}));
    const r=spawnSync(process.execPath,[new URL('../scripts/wsl-host.mjs',import.meta.url).pathname,'capacity','--parameters='+parameters],{encoding:'utf8'});
    assert.equal(r.status,2);assert.match(r.stderr,/backingStorage is required/);assert.equal(r.stdout,'');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
