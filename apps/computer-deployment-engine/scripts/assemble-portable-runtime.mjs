import {readFile,mkdtemp,lstat,realpath,rename,rm,mkdir} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {runWorkspaceSelection,verifyWorkspaceSelection} from '@red-cup-engineering/node-runtime-release-promotion-service/install-workspace-selection';
import {compileNodeRuntime} from '@red-cup-engineering/node-runtime-release-promotion-service/compile-node-runtime';
import {confinePortableRuntime,bindPortableDriver} from '@red-cup-engineering/guix-machine-release-service/scripts/portable-runtime.mjs';
import {envelopeWorkspaceRuntime,receiveWorkspaceRuntime} from '@red-cup-engineering/guix-machine-release-service/scripts/envelope-workspace-runtime.mjs';
import {assembleWorkspaceCorpus} from '@red-cup-engineering/guix-machine-release-service/scripts/assemble-workspace-corpus.mjs';
import {isCliEntry} from '@red-cup-engineering/guix-machine-release-service/scripts/cli-entry.mjs';

/** Compose the existing selected deployment command, source compiler and
 * shared software under the caller's existing build lease. Target declarations
 * and corpus policy are received later against this identical software output.
 */
export async function assemblePortableRuntime({selection,snapshot,output,entries,importer}){
  const workspace=await verifyWorkspaceSelection(selection);
  const destination=resolve(output),parent=dirname(destination),offset=relative(workspace,destination);
  if(!isAbsolute(offset)&&offset!=='..'&&!offset.startsWith('../'))throw new Error('portable output must be outside the source checkout');
  if(await realpath(parent)!==parent)throw new Error('portable output parent is redirected');
  try{await lstat(destination);throw new Error('portable output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!Array.isArray(entries)||!entries.length||entries.some(path=>typeof path!=='string'||!path||isAbsolute(path)||/[\\\0]/u.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..')))
    throw new Error('portable compiler entries must be explicit canonical relative paths');
  if(!Array.isArray(selection.roots)||!selection.roots.includes(importer)||!selection.importerIds.includes(importer))throw new Error('portable software needs its explicitly selected entry owner');
  const manifest=JSON.parse(await readFile(join(workspace,importer,'package.json'),'utf8'));
  if(typeof manifest.name!=='string'||!manifest.name)throw new Error('portable entry owner needs its selected package name');
  const stage=await mkdtemp(join(parent,'.portable-')),runtime=join(stage,'runtime');
  try{
    const command=await runWorkspaceSelection({receipt:selection,deployOutput:runtime,deployImporter:importer,arguments:['--filter',manifest.name,'--config.ignore-scripts=true','--config.inject-workspace-packages=true','deploy','--prod',runtime]});
    await confinePortableRuntime(runtime);
    const compilation=await compileNodeRuntime({selection,runtime,entries:entries.map(path=>join(runtime,path))});
    const received=await receiveWorkspaceRuntime({selection,snapshot,runtime,compilation,command});
    await bindPortableDriver(runtime,received.sources);
    await confinePortableRuntime(runtime);
    await verifyWorkspaceSelection(selection);
    // Caller lease also owns this destination. No existing tree is replaced.
    try{await lstat(destination);throw new Error('portable output appeared during assembly');}catch(error){if(error.code!=='ENOENT')throw error;}
    await rename(runtime,destination);
    return {closure:destination,selection,compilation,command,softwareIdentity:received.projection.softwareIdentity,...received.payload};
  }finally{await rm(stage,{recursive:true,force:true});}
}

// The existing Guix build returns SOFTWARE for node-runtime-release. This phase
// adds only the separately authenticated target's receiver input; it never
// installs dependencies again or modifies that shared immutable output.
export async function assembleTargetEnvelope({selection,snapshot,target,software,compilation,command,output}){
  if(!software||!/^\/gnu\/store\/[^/]+$/u.test(software.storePath??'')||
      !/^[a-f0-9]{64}$/u.test(software.narSha256??'')||typeof software.root!=='string'||!software.root)
    throw new Error('target envelope needs the exact Guix software build receipt');
  const runtime=await realpath(join(software.storePath,'share/runtime'));
  if(!/^\/gnu\/store\/[^/]+$/u.test(runtime))throw new Error('shared runtime is not an immutable store-held input');
  const destination=resolve(output),parent=dirname(destination);
  if(await realpath(parent)!==parent)throw new Error('target output parent is redirected');
  if(target===undefined)throw new Error('target envelope needs its independent declaration identity');
  for(const source of [selection.workspace,runtime,resolve(target.snapshot)]){
    const offset=relative(source,destination);
    if(!isAbsolute(offset)&&offset!=='..'&&!offset.startsWith('../'))throw new Error('target output overlaps an admitted input');
  }
  try{await lstat(destination);throw new Error('target output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  const stage=await mkdtemp(join(parent,'.receiver-')),envelope=join(stage,'envelope');
  await mkdir(envelope);
  try{
    const receipt=await envelopeWorkspaceRuntime({selection,snapshot,target,runtime,envelope,software,compilation,command});
    const corpus=await assembleWorkspaceCorpus({selection,snapshot,target,runtime:envelope,softwareRoot:runtime,sourceWork:join(stage,'lspace-sources')});
    await confinePortableRuntime(envelope);await verifyWorkspaceSelection(selection);
    try{await lstat(destination);throw new Error('target output appeared during assembly');}catch(error){if(error.code!=='ENOENT')throw error;}
    await rename(envelope,destination);return {...receipt,closure:destination,corpus};
  }finally{await rm(stage,{recursive:true,force:true});}
}

export async function runPortableAssemblyCli(args){
  const values={},entries=[],targetPhase=args[0]==='target';
  if(targetPhase)args=args.slice(1);else args=[...args];
  const allowed=targetPhase?['--assembly','--software','--snapshot','--target-snapshot','--target-repository','--target-commit','--output']:['--selection','--snapshot','--output','--importer'];
  while(args.length){const key=args.shift(),value=args.shift();if(!value)throw new Error('missing portable assembly argument');
    if(key==='--entry'&&!targetPhase)entries.push(value);
    else if(allowed.includes(key)&&values[key]===undefined)values[key]=value;
    else throw new Error('unknown or repeated portable assembly argument');}
  if(Object.keys(values).length!==allowed.length)throw new Error('portable assembly lacks its explicit phase arguments');
  if(targetPhase){
    const assembly=JSON.parse(await readFile(values['--assembly'],'utf8'));
    const software=JSON.parse(await readFile(values['--software'],'utf8'));
    return assembleTargetEnvelope({selection:assembly.selection,snapshot:values['--snapshot'],
      target:{snapshot:values['--target-snapshot'],repository:values['--target-repository'],commit:values['--target-commit']},
      software,compilation:assembly.compilation,command:assembly.command,output:values['--output']});
  }
  const selection=JSON.parse(await readFile(values['--selection'],'utf8'));
  return assemblePortableRuntime({selection,snapshot:values['--snapshot'],output:values['--output'],entries,importer:values['--importer']});
}

if(isCliEntry(import.meta.url))process.stdout.write(JSON.stringify(await runPortableAssemblyCli(process.argv.slice(2)))+'\n');
