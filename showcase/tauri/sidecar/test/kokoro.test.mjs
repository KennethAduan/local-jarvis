import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { KokoroVoice, splitSpeech, reuseCached, installPack, kokoroStatus } from '../kokoro.mjs';
import { createSpeaker } from '../speaker.mjs';

const tick = () => new Promise(r => setTimeout(r, 10));
const children = [];
function spawnFake() {
  const c = new EventEmitter(); c.stdin = new PassThrough(); c.stdout = new PassThrough(); c.requests = []; c.killed = false;
  let buf = ''; c.stdin.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { c.requests.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  c.kill = () => { c.killed = true; }; children.push(c); return c;
}
const respond = (c, id, pcm = Buffer.from([1, 2])) => c.stdout.write(JSON.stringify({ id, rate: 24000, pcm: pcm.toString('base64'), end: true }) + '\n');
const make = (more = {}) => { const out = []; const v = new KokoroVoice({ executable: 'fake', dir: 'unused', spawnImpl: spawnFake, onAudio: x => out.push([...x]), onEnd: () => out.push('end'), onError: e => out.push(`error:${e.message}`), ...more }); v.open(); return { v, out, c: children.at(-1) }; };
assert.deepEqual(splitSpeech('  Hello [warm] world  '), ['Hello world']);
assert.ok(splitSpeech('word '.repeat(150)).every(s => [...s].length <= 240));
assert.deepEqual(splitSpeech('😀'.repeat(241)).map(s => [...s].length), [240, 1]);
{
 const { v, out, c } = make(); v.say('word '.repeat(100)); v.say('Last.'); v.end();
 assert.equal(c.requests.length, 1); for (let i = 1; i <= 4; i++) { assert.equal(c.requests.length, i); respond(c, String(i)); }
 assert.deepEqual(out, [[1,2],[1,2],[1,2],[1,2],'end']); assert.ok(c.killed);
}
{
 const { v, out, c } = make(); v.say('Stop.'); v.end(); v.abort(); respond(c, '1'); c.emit('exit', 0); assert.deepEqual(out, []); assert.ok(c.killed);
}
{
 const { v, out, c } = make(); v.say('Wrong id.'); respond(c, 'wrong'); assert.match(out[0], /^error:/); assert.ok(c.killed);
}
{
 const { v, out, c } = make(); v.say('Exit.'); c.emit('exit', 1); assert.match(out[0], /^error:/); respond(c, '1'); assert.equal(out.length, 1);
}
{
 const { v, out } = make({ timeout: 5 }); v.say('Timeout.'); await tick(); assert.match(out[0], /too long/);
}
{
 const out = [];
 class NativeFixture extends KokoroVoice { constructor(opts) { super({ ...opts, executable: 'fake', dir: 'unused', spawnImpl: spawnFake }); } }
 const speaker = createSpeaker({ emit: event => out.push(event), localId: 'kokoro', LocalVoiceImpl: NativeFixture, localStatus: async () => ({ ok: true }), beatPhrases: [], bundled: () => null });
 speaker.setProvider('kokoro'); speaker.setLocalVoice('21'); const reply = speaker.start(); reply.say('Hello.'); reply.end(); const c = children.at(-1);
 assert.equal(c.requests[0].sid, 21);
 respond(c, '1');
 assert.equal(speaker.provider, 'kokoro'); assert.ok(out.some(e => e.id === reply.id && e.rate === 24000 && e.pcm));
 assert.ok(out.some(e => e.id === reply.id && e.end));
 speaker.setLocalVoice('invalid'); const next = speaker.start(); next.say('Stop.'); const stopped = children.at(-1);
 assert.equal(stopped.requests[0].sid, undefined, 'the default works with the original helper protocol');
 speaker.stop(); const before = out.length; respond(stopped, '1');
 assert.equal(out.length, before); assert.ok(stopped.killed);
}
const dir = await mkdtemp(path.join(os.tmpdir(), 'kokoro-test-'));
try {
 const bytes = Buffer.from('asset'), assets = [{ name:'one', bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex') }];
 const source = path.join(dir, 'source'), dest = path.join(dir, 'dest'); await (await import('node:fs/promises')).mkdir(source); await writeFile(path.join(source, 'one'), bytes);
 assert.equal(await reuseCached({ source, dir:dest, assets }), true);
 assert.equal(await reuseCached({ source, dir:dest, assets }), true);
 const target = path.join(dir, 'download'); let calls = 0;
 await installPack({ dir:target, assets, base:'https://example.invalid/', fetchImpl:async () => { calls++; return { ok:true, url:'https://example.invalid/one', body:[bytes] }; } });
 assert.equal(calls, 1);
 await assert.rejects(installPack({ dir:path.join(dir,'bad'), assets, base:'https://example.invalid/', fetchImpl:async () => ({ ok:true, url:'https://example.invalid/one', body:[Buffer.from('bad')] }) }));
 assert.equal((await kokoroStatus({ platform:'linux' })).reason, 'unavailable');
 for (const platform of ['darwin', 'win32']) {
   const executable = path.join(source, 'one');
   assert.equal((await kokoroStatus({ platform, executable, reuse: async () => false })).reason, 'missing');
   assert.equal((await kokoroStatus({ platform, executable, reuse: async () => true })).ok, true);
 }
} finally { await rm(dir, { recursive:true, force:true }); }
console.log('Kokoro voice and pack passed');
