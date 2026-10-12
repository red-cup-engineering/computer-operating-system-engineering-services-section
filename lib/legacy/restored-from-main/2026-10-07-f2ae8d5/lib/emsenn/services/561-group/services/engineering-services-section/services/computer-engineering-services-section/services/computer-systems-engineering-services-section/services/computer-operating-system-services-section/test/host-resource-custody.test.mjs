import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHostResourceCustody, assertProtectedHostCustody } from '../src/host-resource-custody.mjs';
import { createHostResourceExecutor, hostPressureRefusal } from '../src/host-resource-execution.mjs';

const physicalHost = 'windows-laptop';
const witness = () => ({ physicalHost, accepted:true, receipt:'physical-inventory:assay' });
const cost = {memoryBytes:64,readBytes:1,writeBytes:1,processes:1,cpuMillis:10};
const record = id => ({ request:{id,actor:'actor',session:'session',office:'office',subject:'original',operation:'read',input:{}},cost:{...cost},status:'reserved' });
const ctx = id => ({id,ioWindowMs:100});
const reserve = id => state => { state.effects[id]=record(id); return {kind:'reserved'}; };
const policy = {physicalHost,backingVolumes:['C:'],limits:{...cost,readBytes:10,writeBytes:10},maxObservationAgeMs:100,ioWindowMs:100,memoryReserveBytes:10,commitReserveBytes:10,diskReserveBytes:10,maxDiskQueueLength:1};
const wire = id => JSON.stringify(record(id).request);

test('physical admission requires Windows commit headroom as well as free RAM',()=>{
  const host={physicalHost,observedAt:1000,availableMemoryBytes:1000,volumes:[{id:'C:',freeBytes:1000}],diskQueueLength:0};
  assert.equal(hostPressureRefusal(host,cost,policy,1000),'physical-host-commit-pressure');
  assert.equal(hostPressureRefusal({...host,availableCommitBytes:70},cost,policy,1000),'physical-host-commit-pressure');
  assert.equal(hostPressureRefusal({...host,availableCommitBytes:1000},cost,policy,1000),undefined);
});

test('unknown or opposed physical reconciliation never starts a custody transaction',async()=>{
  const db=new DatabaseSync(':memory:');
  let testimony;
  const custody=createHostResourceCustody({database:db,physicalHost,observeReconciliation:()=>testimony});
  for(const value of [undefined,{...witness(),physicalHost:'guest'}, {...witness(),against:true}]){
    testimony=value;
    assert.equal((await custody.transact(reserve('one'),ctx('one'))).reason,'host-effects-not-reconciled');
    assert.equal(db.prepare('SELECT count(*) AS n FROM effects').get().n,0);
  }
  custody.close();
});

test('lost connections and reopen retain reservations; callbacks cannot free another effect',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'host-custody-assay-'));
  try{
    const file=path.join(dir,'custody.sqlite');
    let db=new DatabaseSync(file);
    let owner=createHostResourceCustody({database:db,physicalHost,observeReconciliation:witness,now:()=>1000});
    await owner.transact(reserve('one'),ctx('one'));
    owner.close();
    db=new DatabaseSync(file);
    owner=createHostResourceCustody({database:db,physicalHost,observeReconciliation:witness,now:()=>1000});
    await owner.transact(state=>{assert.equal(state.effects.one.status,'reserved');},ctx('one'));
    await assert.rejects(owner.transact(state=>{delete state.effects.one;},ctx('two')));
    await assert.rejects(owner.transact(state=>{state.effects.one.cost.processes=0;},ctx('two')));
    assert.equal(JSON.parse(db.prepare('SELECT record FROM effects WHERE id=?').get('one').record).cost.processes,1);
    owner.close();
  } finally {rmSync(dir,{recursive:true});}
});

test('two executor connections share one physical budget across distinct providers',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'host-custody-assay-'));
  let first,second;
  try{
    const file=path.join(dir,'custody.sqlite');
    first=createHostResourceCustody({database:new DatabaseSync(file),physicalHost,observeReconciliation:witness,now:()=>1000});
    second=createHostResourceCustody({database:new DatabaseSync(file),physicalHost,observeReconciliation:witness,now:()=>1000});
    let release,started=0;
    const joined=new Promise(resolve=>{release=resolve;});
    const common={operations:new Map([['read',{validate:()=>true,bound:()=>cost}]]),policy,now:()=>1000,
      observe:()=>({physicalHost,observedAt:1000,availableMemoryBytes:1000,availableCommitBytes:1000,volumes:[{id:'C:',freeBytes:1000}],diskQueueLength:0}),
      assayAuthority:()=>({accepted:true,receipt:'authority'}),assayConformance:()=>({accepted:true,receipt:'conformance'}),
      contain:({request})=>({physicalHost,bounded:true,receipt:{id:request.id},start(){started++;},join:()=>joined})};
    const a=createHostResourceExecutor({...common,transact:first.transact});
    const b=createHostResourceExecutor({...common,transact:second.transact});
    const running=a.execute(wire('codex'));
    for(let turns=0;started===0&&turns<10;turns++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(started,1);
    assert.equal((await b.execute(wire('claude'))).reason,'host-budget-full');
    const existing=await b.execute(wire('codex'));
    assert.equal(existing.kind,'host-resource.existing');
    assert.equal(existing.effect.status,'executing');
    assert.equal(started,1);
    release({terminated:true,id:'codex'});
    assert.equal((await running).kind,'host-resource.received');
    assert.equal((await b.execute(wire('codex'))).effect.status,'received');
    assert.equal(started,1);
  } finally {first?.close();second?.close();rmSync(dir,{recursive:true});}
});

test('received originals stay immutable and retain exact indexed recovery beyond the IO window',async()=>{
  const db=new DatabaseSync(':memory:');
  const custody=createHostResourceCustody({database:db,physicalHost,observeReconciliation:witness,now:()=>1000});
  await custody.transact(reserve('one'),ctx('one'));
  await custody.transact(state=>{Object.assign(state.effects.one,{status:'received',receivedAt:10,receipt:{terminated:true,id:'one'}});},ctx('one'));
  await custody.transact(state=>{assert.equal(state.effects.one.status,'received');assert.equal(Object.keys(state.effects).length,1);},ctx('one'));
  await assert.rejects(custody.transact(state=>{state.effects.one.status='reserved';},ctx('one')));
  await custody.transact(state=>{assert.equal(Object.keys(state.effects).length,0);},ctx('other'));
  const query=db.prepare("EXPLAIN QUERY PLAN SELECT id,status,received_at,cost FROM effects INDEXED BY effects_recent WHERE status='received' AND received_at >= ? LIMIT ?").all(900,257);
  assert.ok(query.some(row=>/SEARCH.*effects_recent/u.test(row.detail)),JSON.stringify(query));
  custody.close();
});

test('a busy owner refuses immediately without a polling lease loop',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'host-custody-assay-'));
  let a,b,owner;
  try{
    const file=path.join(dir,'custody.sqlite');a=new DatabaseSync(file);b=new DatabaseSync(file);
    createHostResourceCustody({database:a,physicalHost,observeReconciliation:witness});
    owner=createHostResourceCustody({database:b,physicalHost,observeReconciliation:witness});
    a.exec('BEGIN IMMEDIATE');
    assert.equal((await owner.transact(reserve('one'),ctx('one'))).reason,'host-custody-busy');
    a.exec('ROLLBACK');
    assert.equal((await owner.transact(reserve('one'),ctx('one'))).kind,'reserved');
  }finally{a?.close();owner?.close();rmSync(dir,{recursive:true});}
});

test('bounded observation refuses overflow; unprotected storage is not an installed owner',async()=>{
  const db=new DatabaseSync(':memory:');
  const custody=createHostResourceCustody({database:db,physicalHost,observeReconciliation:witness});
  const insert=db.prepare('INSERT INTO effects VALUES(?,?,?,?,?)');
  db.exec('BEGIN');for(let i=0;i<257;i++){const r=record('held-'+i);insert.run(r.request.id,r.status,null,JSON.stringify(r.cost),JSON.stringify(r));}db.exec('COMMIT');
  let called=false;
  assert.equal((await custody.transact(()=>{called=true;},ctx('new'))).reason,'host-custody-observation-full');
  assert.equal(called,false);
  assert.throws(()=>assertProtectedHostCustody('/tmp/worker-chosen-host-ledger'));
  custody.close();
});

test('a refused durable transition cannot start an effect or claim receiving',async()=>{
  for(const refusedTurn of [2,3]) {
    const db=new DatabaseSync(':memory:');
    const owner=createHostResourceCustody({database:db,physicalHost,observeReconciliation:witness,now:()=>1000});
    let turn=0,starts=0,cancels=0;
    const executor=createHostResourceExecutor({policy,now:()=>1000,
      operations:new Map([['read',{validate:()=>true,bound:()=>cost}]]),
      observe:()=>({physicalHost,observedAt:1000,availableMemoryBytes:1000,availableCommitBytes:1000,volumes:[{id:'C:',freeBytes:1000}],diskQueueLength:0}),
      assayAuthority:()=>({accepted:true,receipt:'authority'}),assayConformance:()=>({accepted:true,receipt:'conformance'}),
      transact:(change,context)=>++turn===refusedTurn?{kind:'host-resource.refused',reason:'host-custody-busy'}:owner.transact(change,context),
      contain:({request})=>({physicalHost,bounded:true,receipt:{id:request.id},start(){starts++;},cancel(){cancels++;},join:()=>({terminated:true,id:request.id})})});
    const outcome=await executor.execute(wire('one'));
    assert.equal(outcome.kind,'host-resource.pending');
    assert.equal(outcome.reason,'host-custody-busy');
    assert.equal(starts,refusedTurn===2?0:1);
    assert.equal(cancels,refusedTurn===2?1:0);
    assert.equal(JSON.parse(db.prepare('SELECT record FROM effects WHERE id=?').get('one').record).status,refusedTurn===2?'reserved':'executing');
    owner.close();
  }
});

test('another original cannot attest containment or termination of this effect',async()=>{
  for(const boundary of ['containment','termination']) {
    const db=new DatabaseSync(':memory:');
    const owner=createHostResourceCustody({database:db,physicalHost,observeReconciliation:witness,now:()=>1000});
    let starts=0;
    const executor=createHostResourceExecutor({policy,now:()=>1000,
      operations:new Map([['read',{validate:()=>true,bound:()=>cost}]]),
      observe:()=>({physicalHost,observedAt:1000,availableMemoryBytes:1000,availableCommitBytes:1000,volumes:[{id:'C:',freeBytes:1000}],diskQueueLength:0}),
      assayAuthority:()=>({accepted:true,receipt:'authority'}),assayConformance:()=>({accepted:true,receipt:'conformance'}),
      transact:owner.transact,
      contain:({request})=>({physicalHost,bounded:true,receipt:{id:boundary==='containment'?'other':request.id},
        start(){starts++;},join:()=>({terminated:true,id:boundary==='termination'?'other':request.id})})});
    const result=await executor.execute(wire('one'));
    assert.equal(result.kind,'host-resource.pending');
    assert.equal(starts,boundary==='containment'?0:1);
    assert.equal(JSON.parse(db.prepare('SELECT record FROM effects WHERE id=?').get('one').record).status,'uncertain');
    await assert.rejects(owner.transact(state=>{Object.assign(state.effects.one,{status:'received',receivedAt:1000,receipt:{terminated:true,id:'other'}});},ctx('one')));
    owner.close();
  }
});
