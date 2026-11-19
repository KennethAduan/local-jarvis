import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { KOKORO_ASSETS, verifyPack } from './kokoro-pack.mjs';
import { DATA_ROOT } from './kineto.mjs';

const BASE = 'https://huggingface.co/csukuangfj/kokoro-int8-multi-lang-v1_0/resolve/57adb37fc0e8d4bd430cfc1b8f8c2294945b9af2/';
// Speaker IDs in the pinned v1.0 pack. The helper uses a British English lexicon.
export const DEFAULT_KOKORO_VOICE = '26';
export const KOKORO_VOICES = [
  { id: DEFAULT_KOKORO_VOICE, name: 'George' },
  { id: '20', name: 'Alice' },
  { id: '21', name: 'Emma' },
  { id: '22', name: 'Isabella' },
  { id: '23', name: 'Lily' },
  { id: '24', name: 'Daniel' },
  { id: '25', name: 'Fable' },
  { id: '27', name: 'Lewis' },
];
export const kokoroVoice = (id) => KOKORO_VOICES.find((voice) => voice.id === id);
export const modelDir = () => path.join(DATA_ROOT, 'voice', 'kokoro-int8-v1');
export const cachedDir = () => process.env.APPDATA ? path.join(process.env.APPDATA, 'com.kineto.jarvis', 'voice', 'kokoro-int8-v1') : null;
let installing = null;
let reusePending = null;

// Build an entire verified pack in a sibling directory before replacing an invalid destination.
async function publish(dir, make, assets = KOKORO_ASSETS) {
  await fs.mkdir(path.dirname(dir), { recursive: true });
  const temp = `${dir}.tmp-${randomUUID()}`, old = `${dir}.old-${randomUUID()}`;
  let moved = false;
  try {
    await fs.mkdir(temp);
    await make(temp);
    if (!(await verifyPack(temp, assets))) throw new Error('Voice files did not pass their integrity check.');
    if (await verifyPack(dir, assets)) return;
    try { await fs.rename(dir, old); moved = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    try { await fs.rename(temp, dir); } catch (e) { if (moved) await fs.rename(old, dir).catch(() => {}); throw e; }
    if (moved) await fs.rm(old, { recursive: true, force: true });
  } finally { await fs.rm(temp, { recursive: true, force: true }).catch(() => {}); }
}
async function reuseCachedOnce({ dir = modelDir(), source = cachedDir(), assets = KOKORO_ASSETS } = {}) {
  if (await verifyPack(dir, assets)) return true;
  if (!source || !(await verifyPack(source, assets))) return false;
  await publish(dir, async temp => { for (const asset of assets) await fs.copyFile(path.join(source, asset.name), path.join(temp, asset.name)); }, assets);
  return true;
}
export async function reuseCached(options = {}) {
  // Startup, settings and install can ask concurrently; share only the ordinary default operation.
  if (Object.keys(options).every(k => k === 'dir' || (k === 'assets' && options.assets === KOKORO_ASSETS)) && (!options.dir || options.dir === modelDir())) {
    if (!reusePending) reusePending = reuseCachedOnce(options).finally(() => { reusePending = null; });
    return reusePending;
  }
  return reuseCachedOnce(options);
}
export async function installPack({ dir = modelDir(), assets = KOKORO_ASSETS, fetchImpl = fetch, base = BASE } = {}) {
  if (installing) return installing;
  installing = (async () => {
    if (await reuseCached({ dir, assets })) return;
    await publish(dir, async temp => {
      for (const a of assets) {
        const res = await fetchImpl(base + a.name, { signal: AbortSignal.timeout(120_000), redirect: 'follow' });
        if (!res.ok || !res.body || (res.url && !res.url.startsWith('https://'))) throw new Error('Voice download failed. Check your connection and try again.');
        const file = await fs.open(path.join(temp, a.name), 'wx'); let count = 0; const hash = createHash('sha256');
        try { for await (const chunk of res.body) { count += chunk.length; if (count > a.bytes) throw new Error('Voice download exceeded its expected size.'); hash.update(chunk); await file.writeFile(chunk); } }
        finally { await file.close(); }
        if (count !== a.bytes || hash.digest('hex') !== a.sha256) throw new Error('Voice download did not pass its integrity check.');
      }
    }, assets);
  })().finally(() => { installing = null; });
  return installing;
}
export async function kokoroStatus({ dir = modelDir(), executable = process.env.JARVIS_KOKORO, platform = process.platform, reuse = reuseCached } = {}) {
  if (platform !== 'win32') return { ok: false, reason: 'unavailable', message: 'Local spoken replies are available on Windows in this build.' };
  try { if (!executable || !(await fs.stat(executable)).isFile()) throw new Error(); }
  catch { return { ok: false, reason: 'unavailable', message: 'Local voice is unavailable. Reinstall Jarvis.' }; }
  try { if (await reuse({ dir })) return { ok: true, engine: 'Kokoro', voices: KOKORO_VOICES }; }
  catch { return { ok: false, reason: 'error', message: 'Could not prepare the local voice. Check disk space and try again.' }; }
  return { ok: false, reason: 'missing', message: 'Install the voice (149 MB) to hear spoken replies.' };
}

export function splitSpeech(value) {
  const text = String(value ?? '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = [...text], out = [];
  while (chars.length) {
    let n = Math.min(240, chars.length);
    if (n < chars.length) { let space = n; while (space > 0 && chars[space] !== ' ') space--; if (space > 0) n = space; }
    const part = chars.splice(0, n).join('').trim();
    while (chars[0] === ' ') chars.shift();
    if (part) out.push(part);
  }
  return out;
}
const MAX_RESPONSE = Math.ceil(24000 * 60 * 2 / 3) * 4 + 1024;
export class KokoroVoice {
  constructor({ onAudio, onEnd, onError, voice, executable = process.env.JARVIS_KOKORO, dir = modelDir(), spawnImpl = spawn, timeout = 90_000 }) {
    Object.assign(this, { onAudio, onEnd, onError, executable, dir, spawnImpl, timeout });
    this.voice = kokoroVoice(voice)?.id ?? DEFAULT_KOKORO_VOICE;
    this.queue = []; this.buffer = ''; this.state = 'new'; this.ending = false; this.busy = null; this.seq = 0; this.heard = false;
  }
  open() {
    if (this.state !== 'new') return this;
    this.state = 'open';
    try {
      this.child = this.spawnImpl(this.executable, ['--model-dir', this.dir], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
      this.exitHook = () => { try { this.child?.kill(); } catch {} }; process.once('exit', this.exitHook);
      this.child.on('error', () => this.fail('Local voice is unavailable. Reinstall Jarvis.'));
      this.child.on('exit', () => { if (this.state !== 'done') this.fail('Local voice stopped unexpectedly.'); });
      this.child.stdin.on('error', () => this.fail('Local voice stopped unexpectedly.'));
      this.child.stdout.on('data', data => this.receive(data));
      this.child.stdout.on('error', () => this.fail('Local voice stopped unexpectedly.'));
      this.child.stdout.on('end', () => { if (this.state !== 'done') this.fail('Local voice stopped unexpectedly.'); });
    } catch { queueMicrotask(() => this.fail('Local voice is unavailable. Reinstall Jarvis.')); }
    return this;
  }
  say(text) { if (this.state === 'done' || this.ending) return; this.queue.push(...splitSpeech(text)); if (this.state === 'new') this.open(); this.pump(); }
  end() { if (this.state === 'done' || this.ending) return; this.ending = true; if (this.state === 'new') return this.finish(); this.pump(); }
  pump() {
    if (this.state !== 'open' || this.busy) return;
    const text = this.queue.shift();
    if (!text) { if (this.ending) this.finish(); return; }
    const id = String(++this.seq); this.busy = id;
    this.timer = setTimeout(() => this.fail('Local voice took too long. Try again.'), this.timeout);
    const request = { id, text, speed: 1.15, volume: 1 };
    if (this.voice !== DEFAULT_KOKORO_VOICE) request.sid = Number(this.voice);
    try { this.child.stdin.write(JSON.stringify(request) + '\n'); } catch { this.fail('Local voice stopped unexpectedly.'); }
  }
  receive(data) {
    if (this.state === 'done') return;
    this.buffer += data.toString('utf8');
    if (this.buffer.length > MAX_RESPONSE) return this.fail('Local voice returned invalid audio.');
    let at; while ((at = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, at); this.buffer = this.buffer.slice(at + 1);
      let m; try { m = JSON.parse(line); } catch { return this.fail('Local voice returned an invalid response.'); }
      if (!this.busy || m.id !== this.busy) return this.fail('Local voice returned an invalid response.');
      if (typeof m.error === 'string') return this.fail('Local voice could not speak. Check its status in Speaking.');
      if (m.rate !== 24000 || m.end !== true || typeof m.pcm !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(m.pcm)) return this.fail('Local voice returned invalid audio.');
      const pcm = Buffer.from(m.pcm, 'base64');
      if (!pcm.length || pcm.length % 2 || pcm.length > 24000 * 60 * 2) return this.fail('Local voice returned invalid audio.');
      clearTimeout(this.timer); this.timer = null; this.busy = null; this.heard = true; this.onAudio?.(pcm, 24000);
      if (this.state === 'done') return;
      this.pump();
    }
  }
  close() { if (this.state === 'done') return; this.state = 'done'; if (this.exitHook) process.removeListener('exit', this.exitHook); clearTimeout(this.timer); this.queue.length = 0; try { this.child?.kill(); } catch {} }
  abort() { this.close(); }
  finish() { if (this.state === 'done') return; this.close(); this.onEnd?.(); }
  fail(message) { if (this.state === 'done') return; const heard = this.heard; this.close(); this.onError?.(Object.assign(new Error(message), { reason: 'error', heard })); }
}
