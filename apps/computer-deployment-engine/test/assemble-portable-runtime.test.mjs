import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm,cp,symlink,lstat,readdir,realpath,chmod} from 'node:fs/promises';
import {join,dirname,relative,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fixture} from './fixtures/portable-source-fixture.mjs';
import {assemblePortableRuntime} from '../scripts/assemble-portable-runtime.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(root,...args)=>execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-C',root,...args],{encoding:'utf8',env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}).trim();
async function composed(t,{bodyMutation=false,producerFailure=false}={}){
 const f=await fixture(t),payload=f.runtime;
 // These are explicit inert reader interfaces, not substitute production
 // providers. Separate source-bound qualification exercises the genuine readers.
 const readers={feltos:'import {resolve,dirname} from "node:path"; export async function readEnterpriseWeb(path,{readFile}) { const host=JSON.parse(await readFile(path,"utf8")); return {...host,instancePath:resolve(dirname(path),host.instance)}; }\n',metroplat:'export async function readInstanceDefinition(path,{readFile}) { return JSON.parse(await readFile(path,"utf8")); }\n'};
 for(const [name,path,exports] of [['feltos','driver',{'./package.json':'./package.json','./server/installed-web':'./src/server/installed-web.mjs'}],['metroplat','metroplat',{'./instance':'./src/instance.mjs'}]]){
  const file=name==='feltos'?'src/server/installed-web.mjs':'src/instance.mjs';await f.put(f.workspace,path+'/'+file,readers[name]);
  const manifest={name:'@red-cup-engineering/'+name,version:'0.19.0',type:'module',exports,...(name==='feltos'?{bin:{feltos:'feltos.mjs'}}:{})};await f.put(f.workspace,path+'/package.json',JSON.stringify(manifest));if(name==='metroplat')f.selection.importerIds.push(path);
 }
 const machine=JSON.parse(await readFile(join(f.snapshot,'machine.json')));machine.run.entries.push('@red-cup-engineering/metroplat');await f.put(f.snapshot,'machine.json',JSON.stringify(machine));
 await f.put(f.snapshot,'deployment/host.json',JSON.stringify({version:1,hostKind:'feltos.enterprise-host',instance:'instance.json',web:{}}));
 await f.put(f.snapshot,'deployment/instance.json',JSON.stringify({version:1,instanceOf:'@red-cup-engineering/metroplat',identity:{id:'test:portable-caller',title:'Portable caller'},operationSources:[],applications:[]}));
 await f.put(f.workspace,'index.mjs','throw new Error("application must not execute during source compilation");\n');
 git(f.workspace,'add','.');git(f.workspace,'commit','-qm','synthetic reader source');f.selection.commit=git(f.workspace,'rev-parse','HEAD');
 for(const id of f.selection.importerIds)f.selection.manifestHashes[id]=hash(await readFile(join(f.workspace,id,'package.json')));
 await cp(join(f.workspace,'index.mjs'),join(payload,'index.mjs'));
 await rm(join(payload,'node_modules'),{recursive:true,force:true});
 await mkdir(join(payload,'node_modules/.pnpm'),{recursive:true});
 for(const [name,path] of [['feltos','driver'],['metroplat','metroplat']]){
  const at=join(payload,'node_modules/.fixture-providers',name);await rm(at,{recursive:true,force:true});await cp(join(f.workspace,path),at,{recursive:true});
  const alias=join(payload,'node_modules/@red-cup-engineering',name);await mkdir(dirname(alias),{recursive:true});await rm(alias,{force:true});await symlink(relative(dirname(alias),at),alias);
 }
 if(bodyMutation)await f.put(payload,'index.mjs','// unreceived body\n');
 const executable=join(f.artifact,'pnpm-output-fixture');
 await writeFile(executable,'#!'+process.execPath+'\n'+`const fs=require('node:fs');const out=process.argv.at(-1);fs.cpSync(${JSON.stringify(payload)},out,{recursive:true,verbatimSymlinks:true});${producerFailure?'process.exit(7);':''}\n`);await chmod(executable,0o755);f.selection.executable=executable;
 const output=join(f.outer,'received');return {...f,output,entries:['index.mjs']};
}
test('actual Code command and compiler publish shared software without target envelope',async t=>{
 const f=await composed(t),result=await assemblePortableRuntime(f);assert.equal(result.closure,f.output);
 assert.equal(result.compilation.staticBindingsCompiled,true);assert.equal(result.compilation.applicationExecuted,false);assert.equal(result.compilation.scope,'packed-selected-packages');
 for(const name of ['.metadata','.controller','deployment','.storage-systemd'])await assert.rejects(lstat(join(f.output,name)),{code:'ENOENT'});
 assert.equal(await realpath(join(f.output,'app/feltos.mjs')),await realpath(join(f.output,'node_modules/@red-cup-engineering/feltos/feltos.mjs')));
 assert.equal((await readdir(f.outer)).filter(x=>x.startsWith('.portable-')).length,0);
 assert.match(result.command.produced.directory,/\.portable-.*\/runtime$/);await assert.rejects(lstat(result.command.produced.directory),{code:'ENOENT'});
 assert.equal(result.softwareIdentity.commit,f.selection.commit);
});
test('actual producer failure preserves destination absence and removes owned staging',async t=>{const f=await composed(t,{producerFailure:true});await assert.rejects(assemblePortableRuntime(f),/exited 7/);await assert.rejects(lstat(f.output),{code:'ENOENT'});assert.equal((await readdir(f.outer)).filter(x=>x.startsWith('.portable-')).length,0);});
test('compiled but unreceived runtime body cannot reach destination',async t=>{const f=await composed(t,{bodyMutation:true});await assert.rejects(assemblePortableRuntime(f),/portable payload differs from committed source/);await assert.rejects(lstat(f.output),{code:'ENOENT'});assert.equal((await readdir(f.outer)).filter(x=>x.startsWith('.portable-')).length,0);});
