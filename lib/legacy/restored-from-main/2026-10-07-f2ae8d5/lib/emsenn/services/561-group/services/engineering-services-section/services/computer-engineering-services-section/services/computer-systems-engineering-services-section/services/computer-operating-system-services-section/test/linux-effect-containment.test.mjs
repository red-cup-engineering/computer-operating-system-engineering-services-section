import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createLinuxEffectContainment } from '../src/linux-effect-containment.mjs';

// This assay must be explicitly run by the custodian in an already limited
// kernel domain. A mocked fs, successful source test or skipped assay proves
// no operating containment. It never creates a service, timer or parent domain.
const parent=process.env.HOST_CONTAINMENT_ASSAY_DOMAIN;
const available=process.getuid?.()===0 && Boolean(parent);
const cost={memoryBytes:67108864,readBytes:2097152,writeBytes:65536,processes:8,cpuMillis:1000};
const make=command => ({linux:()=>({command:'/usr/bin/dash',args:['-c',command],
  durationMs:1000,outputBytes:1024,readOnlyMounts:[]})});
const contain=()=>createLinuxEffectContainment({parent,physicalHost:'bare-cedar-fog',devices:['8:32','8:48']});
let sequence=0;
const prepare=operation=>contain()({request:{id:'kernel-assay-'+process.pid+'-'+(++sequence),input:{}},
  operation,cost,physicalHost:'bare-cedar-fog'});

test('real suspended effect enters the shared budget before target execution', {skip:!available},async()=>{
  const effect=await prepare(make('test ! -e /init && test ! -e /mnt/c && test ! -e /sys/fs/cgroup && test ! -e /run/WSL || exit 9; /usr/bin/grep "^NoNewPrivs:" /proc/self/status; printf contained'));
  const group=effect.receipt.group;
  assert.equal((await readFile(group+'/cgroup.events','utf8')).includes('populated 1'),true);
  assert.equal((await readFile(group+'/memory.max','utf8')).trim(),String(cost.memoryBytes));
  await effect.start(); const receipt=await effect.join();
  assert.equal(receipt.terminated,true); assert.equal(receipt.exit.code,0,receipt.output);
  assert.match(receipt.output,/NoNewPrivs:\s+1/); assert.match(receipt.output,/contained$/);
  assert.equal(receipt.retired,true); await assert.rejects(access(group));
  await assert.rejects(effect.start(),/already started/);
});

test('output overflow kills and receives the actual effect tree', {skip:!available},async()=>{
  const effect=await prepare(make('/usr/bin/head -c 8192 /dev/zero'));
  await effect.start(); const receipt=await effect.join();
  assert.equal(receipt.terminated,true); assert.equal(receipt.reason,'output-bound-exceeded');
  assert.equal(receipt.output,''); assert.ok(receipt.outputBytes>1024);
  await assert.rejects(access(effect.receipt.group));
});

test('deadline retains custody until all actual descendants terminate', {skip:!available},async()=>{
  const operation=make('/usr/bin/sleep 5 & wait');
  const plan=operation.linux(); operation.linux=()=>({...plan,durationMs:150});
  const effect=await prepare(operation); await effect.start(); const receipt=await effect.join();
  assert.equal(receipt.terminated,true); assert.equal(receipt.reason,'deadline-exceeded');
  assert.equal(receipt.retired,true); await assert.rejects(access(effect.receipt.group));
});

test('cancelled preparation never starts the target', {skip:!available},async()=>{
  const effect=await prepare(make('printf must-not-run'));
  await effect.cancel(); const receipt=await effect.join();
  assert.equal(receipt.terminated,true); assert.equal(receipt.reason,'cancelled');
  assert.equal(receipt.output,''); await assert.rejects(access(effect.receipt.group));
});

test('actual WSL MZ interpreter cannot escape to Windows', {skip:!available},async()=>{
  const registration=await readFile('/proc/sys/fs/binfmt_misc/WSLInterop','utf8');
  assert.match(registration,/interpreter \/init/); assert.match(registration,/flags:\s*P\s*$/m);
  const directory=await mkdtemp(tmpdir()+'/linux-effect-mz-');
  try {
    const source=directory+'/pe'; const bytes=Buffer.alloc(128); bytes.write('MZ');
    await writeFile(source,bytes,{mode:0o755});
    const operation={linux:()=>({command:'/usr/bin/env',args:['/input/pe'],
      durationMs:1000,outputBytes:1024,readOnlyMounts:[{source,target:'/input/pe'}]})};
    const effect=await prepare(operation); await effect.start(); const receipt=await effect.join();
    assert.equal(receipt.terminated,true); assert.equal(receipt.exit.code,127,receipt.output);
    assert.match(receipt.output,/No such file or directory/); assert.equal(receipt.retired,true);
  } finally {await rm(directory,{recursive:true,force:true});}
});
