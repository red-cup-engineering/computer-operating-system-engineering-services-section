import {readFile,mkdtemp,lstat,realpath,rename,rm} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {runWorkspaceSelection,verifyWorkspaceSelection} from '@red-cup-engineering/node-runtime-release-promotion-service/install-workspace-selection';
import {compileNodeRuntime} from '@red-cup-engineering/node-runtime-release-promotion-service/compile-node-runtime';
import {confinePortableRuntime} from '@red-cup-engineering/guix-machine-release-service/scripts/portable-runtime.mjs';
import {envelopeWorkspaceRuntime} from '@red-cup-engineering/guix-machine-release-service/scripts/envelope-workspace-runtime.mjs';
import {assembleWorkspaceCorpus} from '@red-cup-engineering/guix-machine-release-service/scripts/assemble-workspace-corpus.mjs';
import {isCliEntry} from '@red-cup-engineering/guix-machine-release-service/scripts/cli-entry.mjs';

/** Compose the existing selected deployment command, source compiler and
 * receiver envelope under the caller's existing build lease. The only published
 * output is the complete fresh tree; Guix sealing/receiving stays with its owner.
 */
export async function assemblePortableRuntime({selection,snapshot,output,entries}){
  const workspace=await verifyWorkspaceSelection(selection);
  const destination=resolve(output),parent=dirname(destination),offset=relative(workspace,destination);
  if(!isAbsolute(offset)&&offset!=='..'&&!offset.startsWith('../'))throw new Error('portable output must be outside the source checkout');
  if(await realpath(parent)!==parent)throw new Error('portable output parent is redirected');
  try{await lstat(destination);throw new Error('portable output already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!Array.isArray(entries)||!entries.length||entries.some(path=>typeof path!=='string'||!path||isAbsolute(path)||/[\\\0]/u.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..')))
    throw new Error('portable compiler entries must be explicit canonical relative paths');
  const manifest=JSON.parse(await readFile(join(workspace,'package.json'),'utf8'));
  if(typeof manifest.name!=='string'||!manifest.name)throw new Error('portable root needs its selected package name');
  const stage=await mkdtemp(join(parent,'.portable-')),runtime=join(stage,'runtime');
  try{
    const command=await runWorkspaceSelection({receipt:selection,deployOutput:runtime,arguments:['--filter',manifest.name,'--config.ignore-scripts=true','--config.inject-workspace-packages=true','deploy','--prod',runtime]});
    await confinePortableRuntime(runtime);
    const compilation=await compileNodeRuntime({selection,runtime,entries:entries.map(path=>join(runtime,path))});
    const receipt=await envelopeWorkspaceRuntime({selection,snapshot,runtime,compilation,command});
    const corpus=await assembleWorkspaceCorpus({selection,snapshot,runtime,sourceWork:join(stage,'lspace-sources')});
    await confinePortableRuntime(runtime);
    await verifyWorkspaceSelection(selection);
    // Caller lease also owns this destination. No existing tree is replaced.
    try{await lstat(destination);throw new Error('portable output appeared during assembly');}catch(error){if(error.code!=='ENOENT')throw error;}
    await rename(runtime,destination);
    return {...receipt,closure:destination,command,corpus};
  }finally{await rm(stage,{recursive:true,force:true});}
}

if(isCliEntry(import.meta.url)){
  const values={},entries=[],args=process.argv.slice(2);
  while(args.length){const key=args.shift(),value=args.shift();if(!value)throw new Error('missing portable assembly argument');
    if(key==='--entry')entries.push(value);
    else if(['--selection','--snapshot','--output'].includes(key)&&values[key]===undefined)values[key]=value;
    else throw new Error('unknown or repeated portable assembly argument');}
  if(Object.keys(values).length!==3)throw new Error('portable assembly needs selection, snapshot and output');
  const selection=JSON.parse(await readFile(values['--selection'],'utf8'));
  process.stdout.write(JSON.stringify(await assemblePortableRuntime({selection,snapshot:values['--snapshot'],output:values['--output'],entries}))+'\n');
}
