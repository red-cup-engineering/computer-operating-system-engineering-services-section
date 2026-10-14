import {lstat,readdir,readlink,realpath,readFile} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,dirname,sep} from 'node:path';

const inside=(root,path)=>{const offset=relative(root,path);return !isAbsolute(offset)&&offset!=='..'&&!offset.startsWith('..'+sep);};

/** Check the complete producer-owned portable tree before compilation or
 * driver use. Every symlink must stay inside the admitted tree, including its
 * final target, and every carrier must be a regular file or directory.
 */
export async function confinePortableRuntime(path){
  const root=resolve(path);
  if(await realpath(root)!==root||!(await lstat(root)).isDirectory())throw new Error('portable runtime root is redirected');
  async function walk(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const file=join(directory,entry.name),stat=await lstat(file);
      if(stat.isSymbolicLink()){
        const link=await readlink(file);
        if(isAbsolute(link))throw new Error('portable link must remain relative when sealed');
        const target=resolve(dirname(file),link);
        if(!inside(root,target)||!inside(root,await realpath(file)))throw new Error('portable link leaves its admitted closure');
        const targetStat=await lstat(await realpath(file));
        if(!targetStat.isFile()&&!targetStat.isDirectory())throw new Error('portable link selects a nonregular carrier');
      }else if(stat.isDirectory())await walk(file);
      else if(!stat.isFile())throw new Error('portable runtime contains a nonregular carrier');
    }
  }
  await walk(root);
  return root;
}

/** Verify that the selected runtime contains exactly the canonical FeltOS
 * executable recorded by the received software source identities.
 */
export async function bindPortableDriver(runtime,sources){
  const root=await confinePortableRuntime(runtime);
  const matches=sources.packages.filter(row=>row.name==='@red-cup-engineering/feltos');
  if(matches.length!==1)throw new Error('shared software needs one selected FeltOS driver');
  const directory=resolve(root,matches[0].installationPath);
  if(!inside(root,directory)||directory===root||await realpath(directory)!==directory)throw new Error('shared driver location is not admitted');
  const manifest=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));
  if(manifest.name!==matches[0].name||manifest.bin?.feltos!=='feltos.mjs')throw new Error('shared software lacks the canonical FeltOS entry');
  const programme=join(directory,manifest.bin.feltos);
  if(await realpath(programme)!==programme||!(await lstat(programme)).isFile())throw new Error('shared driver programme is redirected or absent');
  await confinePortableRuntime(root);
}
