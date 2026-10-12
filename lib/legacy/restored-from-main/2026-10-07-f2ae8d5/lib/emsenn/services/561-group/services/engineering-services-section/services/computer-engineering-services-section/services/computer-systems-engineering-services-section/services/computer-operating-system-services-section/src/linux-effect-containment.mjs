/** Owning Linux effect containment; no service unit, timer or raw-launch fallback.
 * Install behind the physical host's admitted operations, under protected custody.
 * Windows interop, host credentials, cgroup controls and ambient filesystem/network
 * are absent from the worker namespace. Windows effects need a separate witnessed
 * containment capability and are not admitted by this Linux adapter.
 */
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rmdir, stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';

const read = path => readFile(path, 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const positive = n => Number.isSafeInteger(n) && n > 0;
const protectedDirectory = async path => {
  const s = await stat(path);
  if (!s.isDirectory() || s.uid !== 0 || (s.mode & 0o022))
    throw Error('host containment custody must be root-owned and not worker-writable');
};
const fields = text => Object.fromEntries(text.trim().split('\n').map(line => line.split(/\s+/)));

/** configuration is supplied by the host owner, never by a tool request.
 * plan is an already assayed owner's definition: fixed command, argument builder,
 * explicit read-only mounts, deadline and output bound. It is not a caller shell.
 * Every required controller and parent bound is verified before creating a child.
 */
export function createLinuxEffectContainment({ parent, physicalHost, devices,
  bwrap = '/usr/bin/bwrap', shell = '/usr/bin/dash' }) {
  if (!isAbsolute(parent) || !physicalHost || !Array.isArray(devices) || !devices.length
    || devices.some(d => !/^\d+:\d+$/.test(d))) throw Error('explicit owning kernel domain required');
  devices = Object.freeze([...devices]);
  return async ({ request, operation, cost, physicalHost: admittedHost }) => {
    if (process.getuid?.() !== 0 || admittedHost !== physicalHost)
      throw Error('owning Linux host custody unavailable');
    parent = await realpath(parent);
    if (!parent.startsWith('/sys/fs/cgroup/')) throw Error('not a kernel cgroup domain');
    await protectedDirectory(parent);
    const controllers = (await read(parent+'/cgroup.subtree_control')).trim().split(/\s+/);
    if (['cpu','io','memory','pids'].some(c => !controllers.includes(c)))
      throw Error('aggregate kernel domain does not delegate required controllers');
    const parentMemory = Number((await read(parent+'/memory.max')).trim());
    const parentPids = Number((await read(parent+'/pids.max')).trim());
    const cpu = (await read(parent+'/cpu.max')).trim().split(/\s+/).map(Number);
    const io = (await read(parent+'/io.max')).trim().split('\n');
    if (!positive(parentMemory) || !positive(parentPids) || !cpu.every(positive)
      || cpu[0] > cpu[1] || !positive(cost.memoryBytes) || cost.memoryBytes > parentMemory
      || !positive(cost.processes) || cost.processes > parentPids
      || (await read(parent+'/memory.swap.max')).trim() !== '0')
      throw Error('finite aggregate kernel bounds unavailable');
    const rates = devices.map(device => {
      const row = io.find(line => line.startsWith(device+' '));
      if (!row || ['rbps','wbps','riops','wiops'].some(k => !positive(Number(row.match(new RegExp(k+'=(\\d+)'))?.[1]))))
        throw Error('physical backing-device IO bounds unavailable');
      return row;
    });
    // Capture the owner's finite plan before awaits; concurrent mutation cannot
    // add a mount, change the executed arguments or enlarge the output budget.
    const plan = JSON.parse(JSON.stringify(operation.linux?.(request.input) ?? null));
    if (!plan || !isAbsolute(plan.command) || !Array.isArray(plan.args)
      || plan.args.length > 128 || plan.args.some(a => typeof a !== 'string' || a.includes('\0') || a.length > 4096)
      || !positive(plan.durationMs) || plan.durationMs > 60000
      || !positive(plan.outputBytes) || plan.outputBytes > 65536
      || !Array.isArray(plan.readOnlyMounts) || plan.readOnlyMounts.length > 16)
      throw Error('bounded owning Linux operation required');
    // Kernel pipe handlers run in the initial host namespace and ignore
    // RLIMIT_CORE. They can dump a worker's memory outside its namespace/IO
    // custody. Only the owner's actual no-dump kernel state admits execution;
    // reboot or another custodian changing it makes this path unavailable.
    if ((await read('/proc/sys/kernel/core_pattern')).trim() !== ''
      || (await read('/proc/sys/kernel/core_uses_pid')).trim() !== '0')
      throw Error('unbudgeted kernel crash output remains available');
    // WSL's observed registration resolves /init by path (P, not F). That path
    // and its interop socket are absent inside the mount/network namespaces.
    // A fixed/open binfmt interpreter would invalidate that exclusion.
    const interop = await read('/proc/sys/fs/binfmt_misc/WSLInterop').catch(e => {
      if (e.code === 'ENOENT') return ''; throw e;
    });
    if (interop && !/^flags:\s*P\s*$/m.test(interop))
      throw Error('WSL executable containment cannot be witnessed');
    const mounts = [];
    for (const { source, target } of plan.readOnlyMounts) {
      const path = await realpath(source);
      if (!/^\/input(?:\/[a-zA-Z0-9_.-]+)*$/.test(target)
        || path === '/' || path.startsWith('/mnt/') || path.startsWith('/sys/')
        || path.startsWith('/proc/') || path === '/home/emsenn/info'
        || path.startsWith('/home/emsenn/info/')) throw Error('ambient/live-root mount refused');
      mounts.push('--ro-bind',path,target);
    }
    // The plan's environment cannot expose credentials, WSL interop or a control socket.
    const args = ['--unshare-all','--unshare-user','--uid','65534','--gid','65534',
      '--disable-userns','--cap-drop','ALL','--clearenv',
      '--new-session','--die-with-parent','--ro-bind','/usr','/usr',
      '--ro-bind','/lib','/lib','--ro-bind-try','/lib64','/lib64',
      '--proc','/proc','--dev','/dev','--size','16777216','--tmpfs','/tmp',
      '--dir','/input',...mounts,'--chdir','/tmp','--',plan.command,...plan.args];
    const token = createHash('sha256').update(request.id).digest('hex');
    const group = parent+'/effect-'+token;
    await mkdir(group); // Never reuse a possibly live original effect after uncertainty.
    let child, output = [], outputBytes = 0, stoppedFor, deadline, joined, ended;
    const terminate = async reason => {
      stoppedFor ??= reason;
      await writeFile(group+'/cgroup.kill','1');
    };
    try {
      await Promise.all([
        writeFile(group+'/memory.max',String(cost.memoryBytes)),
        writeFile(group+'/memory.swap.max','0'),
        writeFile(group+'/memory.oom.group','1'),
        writeFile(group+'/pids.max',String(cost.processes)),
        writeFile(group+'/cpu.max',cpu.join(' ')),
        ...rates.map(row => writeFile(group+'/io.max',row)),
      ]);
      // The only pre-admission child instructions stop this trusted bootstrap.
      // Target execution and all its forks begin after verified cgroup membership.
      child = spawn(shell,['-c','kill -STOP $$; exec "$@"','host-effect',bwrap,...args],
        { stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin'},cwd:'/tmp' });
      ended = new Promise(resolve => {
        child.once('error',error => resolve({error:String(error)}));
        child.once('close',(code,signal) => resolve({code,signal}));
      });
      const until = Date.now()+5000;
      let stopped = false;
      while (Date.now() < until) {
        if (child.pid && /^State:\s+T/m.test(await read('/proc/'+child.pid+'/status').catch(()=>''))) { stopped=true; break; }
        await pause(20);
      }
      if (!stopped) throw Error('suspended preparation could not be witnessed');
      await writeFile(group+'/cgroup.procs',String(child.pid));
      if (!(await read(group+'/cgroup.procs')).trim().split('\n').includes(String(child.pid)))
        throw Error('kernel membership unavailable');
      const take = bytes => {
        outputBytes += bytes.length;
        if (outputBytes <= plan.outputBytes) output.push(Buffer.from(bytes));
        else { output=[]; void terminate('output-bound-exceeded').catch(()=>{}); }
      };
      child.stdout.on('data',take); child.stderr.on('data',take);
      let started=false;
      const receipt = Object.freeze({kind:'host-resource.linux-containment',id:request.id,
        physicalHost,group,devices,namespace:'no-ambient-host-or-Windows-interop',
        memoryBytes:cost.memoryBytes,processes:cost.processes,aggregateIO:rates});
      return Object.freeze({physicalHost,bounded:true,receipt,
        async start() {
          if (started || stoppedFor) throw Error('effect already started or cancelled');
          started=true;
          deadline=setTimeout(()=>void terminate('deadline-exceeded').catch(()=>{}),plan.durationMs);
          process.kill(child.pid,'SIGCONT');
        },
        async cancel() { await terminate('cancelled'); },
        async join() {
          if (!started && !stoppedFor) throw Error('effect is still suspended');
          joined ??= (async () => {
            const exit=await ended; clearTimeout(deadline);
            // Leader termination is insufficient; actual descendants must also end.
            if (fields(await read(group+'/cgroup.events')).populated === '1') await terminate('descendants-remained');
            const until=Date.now()+5000;
            while (fields(await read(group+'/cgroup.events')).populated === '1') {
              if (Date.now() >= until) return {id:request.id,terminated:false,reason:'kernel-effect-still-populated'};
              await pause(20);
            }
            const io=await read(group+'/io.stat'), cpu=await read(group+'/cpu.stat');
            const memory=await read(group+'/memory.events');
            await rmdir(group);
            return Object.freeze({id:request.id,terminated:true,exit,reason:stoppedFor,
              output:Buffer.concat(output).toString('utf8'),outputBytes,
              kernel:{io,cpu,memory},retired:true});
          })();
          return joined;
        },
      });
    } catch (error) {
      clearTimeout(deadline);
      // Before membership the trusted bootstrap can only be suspended, not target work.
      if (child?.pid) { try { process.kill(child.pid,'SIGKILL'); } catch {} }
      await writeFile(group+'/cgroup.kill','1').catch(()=>{});
      if (fields(await read(group+'/cgroup.events')).populated === '0') await rmdir(group);
      // If the kernel cannot establish termination the original group remains for reconciliation.
      throw error;
    }
  };
}
