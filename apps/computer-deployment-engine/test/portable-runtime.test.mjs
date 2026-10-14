import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {confinePortableRuntime,bindPortableDriver,receivePortableRuntime} from '../scripts/portable-runtime.mjs';

async function fixture(t){
 const base=await mkdtemp(join(tmpdir(),'lagoon-native-'));t.after(()=>rm(base,{recursive:true,force:true}));
 const root=join(base,'runtime'),driver=join(root,'node_modules/.pnpm/feltos/node_modules/@red-cup-engineering/feltos');
 await mkdir(driver,{recursive:true});await mkdir(join(root,'node_modules/@red-cup-engineering'),{recursive:true});
 await symlink('../.pnpm/feltos/node_modules/@red-cup-engineering/feltos',join(root,'node_modules/@red-cup-engineering/feltos'));
 await writeFile(join(driver,'package.json'),JSON.stringify({name:'@red-cup-engineering/feltos',bin:{feltos:'feltos.mjs'}}));
 await writeFile(join(driver,'feltos.mjs'),"throw Error('application must not execute');\n");
 return {root,base,driver};
}
test('native PNPM linked driver is received without execution',async t=>{const {root}=await fixture(t);assert.equal(await bindPortableDriver(root),root);});
test('root redirection refuses',async t=>{const {base,root}=await fixture(t);const link=join(base,'alias');await symlink(root,link);await assert.rejects(bindPortableDriver(link),/redirected/);});
test('absolute internal link refuses',async t=>{const {root,driver}=await fixture(t);await symlink(driver,join(root,'absolute'));await assert.rejects(confinePortableRuntime(root),/relative/);});
test('relative escape refuses',async t=>{const {root,base}=await fixture(t);await writeFile(join(base,'outside'),'x');await symlink('../outside',join(root,'escape'));await assert.rejects(confinePortableRuntime(root),/closure/);});
test('dangling and cyclic links refuse',async t=>{const {root}=await fixture(t);await symlink('absent',join(root,'broken'));await assert.rejects(confinePortableRuntime(root));await rm(join(root,'broken'));await symlink('cycle',join(root,'cycle'));await assert.rejects(confinePortableRuntime(root));});
test('manifest identity and canonical bin are required',async t=>{const {root,driver}=await fixture(t);for(const manifest of [{name:'wrong',bin:{feltos:'feltos.mjs'}},{name:'@red-cup-engineering/feltos',bin:{feltos:'other.mjs'}}]){await writeFile(join(driver,'package.json'),JSON.stringify(manifest));await assert.rejects(bindPortableDriver(root),/canonical/);}});
test('redirected driver programme refuses even inside tree',async t=>{const {root,driver}=await fixture(t);await rm(join(driver,'feltos.mjs'));await writeFile(join(driver,'other.mjs'),'');await symlink('other.mjs',join(driver,'feltos.mjs'));await assert.rejects(bindPortableDriver(root),/redirected/);});
test('special carrier refuses',async t=>{const {root}=await fixture(t);const r=spawnSync('mkfifo',[join(root,'pipe')]);assert.equal(r.status,0);await assert.rejects(confinePortableRuntime(root),/nonregular/);});
test('relative directory alias within tree remains lawful',async t=>{const {root}=await fixture(t);await symlink('node_modules',join(root,'modules'));assert.equal(await bindPortableDriver(root),root);});

test('generic application does not require FeltOS',async t=>{const {root}=await fixture(t);await rm(join(root,'node_modules'),{recursive:true});await writeFile(join(root,'app.mjs'),"throw Error('never execute')");assert.equal(await receivePortableRuntime(root,'app.mjs'),root);await assert.rejects(receivePortableRuntime(root,'node_modules/@red-cup-engineering/feltos/feltos.mjs'));});
test('entry uses authored relative coordinates',async t=>{const {root}=await fixture(t);for(const entry of ['', '/app.mjs','../app.mjs','a//b','./app.mjs'])await assert.rejects(receivePortableRuntime(root,entry),/relative/);});
