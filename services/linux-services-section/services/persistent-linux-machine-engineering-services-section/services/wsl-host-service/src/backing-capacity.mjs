// Read-only physical capacity for the registered backing disk of this WSL root.
import assert from 'node:assert/strict';
import { readFileSync, statSync, realpathSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, resolve, win32 } from 'node:path';
import { release } from 'node:os';

const asset = new URL('../assets/observe-backing-capacity.ps1', import.meta.url);
const decimal = (v, name, positive = false) => {
  assert.equal(typeof v, 'string', `${name} must be a decimal string`);
  assert.match(v, /^(0|[1-9][0-9]*)$/, `${name} must be a nonnegative integer`);
  assert.ok(v.length <= 24 && (!positive || BigInt(v) > 0n), `${name} is out of range`);
  return v;
};
const text = (v, name) => { assert.ok(typeof v === 'string' && v.length > 0 && v.length <= 4096 && !v.includes('\0'), `${name} is invalid`); return v; };
const sameWindows = (a, b) => win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase();
const nearestDevice = path => {
  let p = path;
  for (;;) {
    try { const real = realpathSync(p); return { real, device: String(statSync(real, { bigint: true }).dev) }; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // A missing leaf may be materialized; an existing dangling redirect is unknown.
      try { if (lstatSync(p).isSymbolicLink()) throw new Error('dangling destination redirect has unknown backing volume'); }
      catch (inspect) { if (inspect.code !== 'ENOENT') throw inspect; }
      const parent = dirname(p); if (parent === p) throw error; p = parent;
    }
  }
};

export function validateBackingStorage(parameters) {
  assert.equal(parameters?.schema, 'wsl-host-parameters@1');
  const p = parameters?.windows?.backingStorage;
  assert.ok(p && typeof p === 'object' && !Array.isArray(p), 'windows.backingStorage is required');
  for (const k of ['distributionName', 'registryKey', 'basePath', 'vhdFileName', 'volumeId', 'powershell', 'wslpath', 'linuxMount']) text(p[k], k);
  assert.match(p.distributionName, /^[A-Za-z0-9._-]+$/, 'unsupported distribution name');
  assert.match(p.registryKey, /^HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss\\\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i, 'registry key must name one registered distribution');
  assert.ok(win32.isAbsolute(p.basePath) && !p.basePath.split(/[\\/]/).includes('..'), 'invalid VHD base path');
  assert.equal(win32.basename(p.vhdFileName), p.vhdFileName, 'VHD filename must be a basename');
  assert.match(p.vhdFileName, /^[^\\/:]+\.vhdx$/i, 'invalid VHD filename');
  assert.match(p.volumeId, /^\\\\\?\\Volume\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}\\$/i, 'stable Windows volume ID required');
  assert.ok(isAbsolute(p.powershell) && /\/powershell\.exe$/i.test(p.powershell), 'absolute Windows PowerShell executable required');
  assert.ok(isAbsolute(p.wslpath) && /\/wslpath$/.test(p.wslpath), 'absolute native wslpath required');
  assert.equal(p.linuxMount, '/', 'this bounded port supports only the current distribution root');
  assert.ok(Number.isSafeInteger(p.timeoutMs) && p.timeoutMs >= 100 && p.timeoutMs <= 10000, 'invalid probe timeout');
  assert.ok(Number.isSafeInteger(p.maxAgeMs) && p.maxAgeMs >= p.timeoutMs && p.maxAgeMs <= 30000, 'invalid freshness limit');
  const q = p.policy; assert.ok(q && typeof q === 'object', 'physical capacity policy required');
  for (const k of ['minFreeBytes', 'growthBytes', 'overheadBytes']) decimal(q[k], k);
  assert.ok(typeof q.minFreePercent === 'number' && Number.isFinite(q.minFreePercent) && q.minFreePercent >= 0 && q.minFreePercent < 100 && /^\d+(?:\.\d{1,6})?$/.test(String(q.minFreePercent)), 'invalid physical reserve percentage');
  text(q.basis, 'physical policy basis');
  return p;
}

/** Health only: no admission reservation and no effects when headroom is low. */
export function assessBackingVolumeHeadroom(capacity) {
  assert.equal(capacity?.type, 'WslBackingVolumeCapacity');
  return capacity.volumes.map(v => {
    const p = v.policy, percent = String(p.minFreePercent), digits = (percent.split('.')[1] ?? '').length;
    const denominator = 100n * 10n ** BigInt(digits), numerator = BigInt(percent.replace('.', ''));
    const proportional = (BigInt(v.totalBytes) * numerator + denominator - 1n) / denominator;
    const reserve = proportional > BigInt(p.minFreeBytes) ? proportional : BigInt(p.minFreeBytes);
    const required = reserve + BigInt(p.growthBytes) + BigInt(p.overheadBytes);
    return { id: v.id, availableBytes: v.availableBytes, requiredBytes: String(required), admitted: BigInt(v.availableBytes) >= required };
  });
}

/** No shell, mutation, or generic command adapter. Test ports replace observations only. */
export function observeBackingVolumeCapacity(parameters, destinations, ports = {}) {
  const p = validateBackingStorage(parameters), now = ports.now ?? Date.now;
  assert.match((ports.osRelease ?? release)(), /microsoft/i, 'capacity requires the current WSL host');
  assert.equal((ports.environment ?? process.env).WSL_DISTRO_NAME, p.distributionName, 'current WSL distribution differs from host record');
  assert.ok(Array.isArray(destinations) && destinations.length > 0 && destinations.length <= 32, 'one to 32 destinations required');
  assert.equal(new Set(destinations).size, destinations.length, 'duplicate destinations');
  for (const path of destinations) assert.ok(typeof path === 'string' && isAbsolute(path) && path.length <= 4096 && !path.includes('\0'), 'invalid destination');
  const deviceOf = ports.deviceOf ?? nearestDevice, mount = deviceOf(p.linuxMount);
  const mappings = destinations.map(path => {
    const actual = deviceOf(resolve(path));
    assert.equal(actual.device, mount.device, `unknown backing volume for ${path}`);
    assert.ok(isAbsolute(actual.real), 'invalid observed destination');
    return { path, linuxMount: p.linuxMount, device: actual.device, volumeId: p.volumeId };
  });
  const run = ports.run ?? ((program, args) => execFileSync(program, args, { encoding: 'utf8', timeout: p.timeoutMs, killSignal: 'SIGKILL', maxBuffer: 32768, windowsHide: true }));
  const rootWindowsPath = run(p.wslpath, ['-w', mount.real]).trim();
  const expectedRoots = [`\\\\wsl.localhost\\${p.distributionName}\\`, `\\\\wsl$\\${p.distributionName}\\`];
  assert.ok(expectedRoots.some(x => sameWindows(rootWindowsPath, x)), 'native WSL root identity differs from registered distribution');
  const input = Buffer.from(JSON.stringify(p)).toString('base64');
  // Set progress policy before ConvertFrom-Json can trigger first-use module loading.
  const script = `$ProgressPreference = 'SilentlyContinue'\n$ErrorActionPreference = 'Stop'\n$expected = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${input}')) | ConvertFrom-Json\n` + readFileSync(asset, 'utf8');
  const result = JSON.parse(run(p.powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]).replace(/^\uFEFF/, ''));
  assert.ok(result && result.distribution && result.volume && result.vhd, 'incomplete Windows capacity observation');
  assert.equal(result.distribution.name, p.distributionName, 'registered distribution changed');
  assert.ok(sameWindows(result.distribution.basePath, p.basePath), 'registered VHD base path changed');
  assert.equal(result.distribution.vhdFileName, p.vhdFileName, 'registered VHD filename changed');
  assert.ok(sameWindows(result.vhd.path, win32.join(p.basePath, p.vhdFileName)), 'observed VHD path changed');
  assert.ok(sameWindows(result.volume.id, p.volumeId), 'actual backing volume changed');
  const observed = Date.parse(result.at), at = now();
  assert.ok(Number.isFinite(observed) && observed <= at + 1000 && at - observed <= p.maxAgeMs, 'stale or future Windows capacity observation');
  for (const k of ['totalBytes', 'availableBytes', 'allocationUnitBytes']) decimal(result.volume[k], k, k !== 'availableBytes');
  for (const k of ['volumeFreeBytes', 'callerAvailableBytes']) decimal(result.volume[k], k);
  assert.ok(BigInt(result.volume.availableBytes) <= BigInt(result.volume.totalBytes), 'invalid Windows free capacity');
  assert.equal(BigInt(result.volume.availableBytes), BigInt(result.volume.volumeFreeBytes) < BigInt(result.volume.callerAvailableBytes) ? BigInt(result.volume.volumeFreeBytes) : BigInt(result.volume.callerAvailableBytes), 'capacity must use the limiting caller/volume free space');
  decimal(result.vhd.lengthBytes, 'VHD length', true);
  assert.ok(Number.isSafeInteger(result.vhd.attributes) && result.vhd.attributes >= 0 && typeof result.vhd.sparse === 'boolean', 'invalid VHD attributes');
  assert.equal(result.vhd.sparse, (result.vhd.attributes & 512) !== 0, 'inconsistent sparse status');
  assert.ok((result.vhd.attributes & (16 | 1024)) === 0, 'VHD is a directory or reparse point');
  // Bind the destination mapping again after the Windows observation.
  assert.equal(deviceOf(p.linuxMount).device, mount.device, 'root device changed during probe');
  for (const mapping of mappings) assert.equal(deviceOf(resolve(mapping.path)).device, mapping.device, 'destination device changed during probe');
  return { type: 'WslBackingVolumeCapacity', version: 1, at: new Date(observed).toISOString(), rootWindowsPath, mappings,
    volumes: [{ ...result.volume, policy: { ...p.policy }, vhd: { ...result.vhd } }], admissionKind: 'snapshot-not-reservation' };
}
