import {lstat,readdir,readlink,realpath,readFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,dirname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

const inside=(root,path)=>{const offset=relative(root,path);return !isAbsolute(offset)&&offset!=='..'&&!offset.startsWith('..'+sep);};

/** Receive the native PNPM portable tree without importing application code.
 * Internal relative links are lawful; no link may select a carrier outside it.
 * This preserves the confinement algorithm from CE395 without its retired
 * selected-workspace receipt or assembly consumer.
 */
export async function confinePortableRuntime(path){
  const root=resolve(path);
  if(await realpath(root)!==root||!(await lstat(root)).isDirectory())throw new Error('portable runtime root is redirected');
  const pending=[root];
  while(pending.length){
    const directory=pending.pop();
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const file=join(directory,entry.name),stat=await lstat(file);
      if(stat.isSymbolicLink()){
        const link=await readlink(file);
        if(isAbsolute(link))throw new Error('portable link must remain relative when sealed');
        const target=resolve(dirname(file),link),actual=await realpath(file);
        if(!inside(root,target)||!inside(root,actual))throw new Error('portable link leaves its admitted closure');
        const targetStat=await lstat(actual);
        if(!targetStat.isFile()&&!targetStat.isDirectory())throw new Error('portable link selects a nonregular carrier');
      }else if(stat.isDirectory())pending.push(file);
      else if(!stat.isFile())throw new Error('portable runtime contains a nonregular carrier');
    }
  }
  return root;
}

/** Receive the actual installed canonical driver, including normal PNPM links.
 * Package identity comes from the runtime itself, not a second source inventory.
 */
export async function bindPortableDriver(runtime){
  const root=await confinePortableRuntime(runtime);
  const directory=await realpath(join(root,'node_modules/@red-cup-engineering/feltos'));
  if(!inside(root,directory)||directory===root||!(await lstat(directory)).isDirectory())throw new Error('shared driver location is not admitted');
  const manifestPath=join(directory,'package.json');
  if(await realpath(manifestPath)!==manifestPath||!(await lstat(manifestPath)).isFile())throw new Error('shared driver manifest is redirected or absent');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  if(manifest.name!=='@red-cup-engineering/feltos'||manifest.bin?.feltos!=='feltos.mjs')throw new Error('shared software lacks the canonical FeltOS entry');
  const programme=join(directory,'feltos.mjs');
  if(await realpath(programme)!==programme||!(await lstat(programme)).isFile())throw new Error('shared driver programme is redirected or absent');
  return root;
}

/** The generic constructor confines every application. Canonical driver
 * identity is required only when its authored entry selects that driver. */
export async function receivePortableRuntime(runtime,entry){
  if(typeof entry!=='string'||!entry.length||isAbsolute(entry)||entry.split('/').some(part=>!part||part==='.'||part==='..'))throw new TypeError('deployment entry must be a relative file path');
  if(entry==='node_modules/@red-cup-engineering/feltos/feltos.mjs')return bindPortableDriver(runtime);
  return confinePortableRuntime(runtime);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.length!==4)throw new TypeError('usage: portable-runtime RUNTIME ENTRY');
  await receivePortableRuntime(process.argv[2],process.argv[3]);
}
