import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
const fixture = fileURLToPath(new URL('./kineto-network-fixture.mjs', import.meta.url));
const sidekick = fileURLToPath(new URL('../sidekick.mjs', import.meta.url));
for (const [label, saved] of [['fresh', null], ['stale', { onboarded: true, setupVersion: 1, provider: 'openai', look: 'anime', voice: false }], ['incomplete', { onboarded: false, onboardStep: 3, provider: 'local', voice: false }], ['text choice', { onboarded: true, tts: 'kokoro', replies: 'text', voice: false }]]) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kineto-startup-'));
  if (saved) writeFileSync(path.join(tmp, 'sidekick.json'), JSON.stringify(saved));
  const child = spawn(process.execPath, ['--import', pathToFileURL(fixture).href, sidekick], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, HOME: tmp, USERPROFILE: tmp, APPDATA: tmp, LOCALAPPDATA: tmp, ROAMIES_DATA_DIR: tmp, ROAMIES_HANDS: '', ROAMIES_EXE: '', KINETO_TEST_NETWORK_LOG: path.join(tmp, 'network.log'), KINETO_TEST_OFFLINE: '1' } });
  const events = []; let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  createInterface({ input: child.stdout }).on('line', line => { try { events.push(JSON.parse(line)); } catch {} });
  const send = event => child.stdin.write(`${JSON.stringify(event)}\n`);
  const waitFor = async (predicate, what) => {
    const until = Date.now() + 12000;
    while (!predicate()) {
      if (child.exitCode !== null || Date.now() > until) throw new Error(`${label}: ${what}: ${stderr}`);
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  };
  try {
    await waitFor(() => events.some(e => e.type === 'menu'), 'startup');
    send({ type: 'ui_ready' }); send({ type: 'panel_open' });
    await waitFor(() => events.some(e => e.type === 'panel' && e.msg?.kind === 'state'), 'panel');
    const state = events.filter(e => e.type === 'panel' && e.msg?.kind === 'state').at(-1).msg.state;
    assert.equal(events.some(e => e.type === 'onboarding'), false, label);
    assert.ok(events.some(e => e.type === 'ui' && e.msg?.kind === 'look' && e.msg.look === 'jarvis'));
    assert.equal(state.look, 'jarvis'); assert.equal(state.tts, 'kokoro');
    assert.equal(state.replies, label === 'text choice' ? 'text' : 'voice');
    assert.equal(state.model.provider, 'local'); assert.match(state.model.id, /^local\/lmstudio\//);
    assert.match(state.localServers[0].note, /Start LM Studio/);
    assert.equal(state.actions, false); assert.equal(state.skipAllow, false);
    if (!saved) assert.ok(events.some(e => e.type === 'voice_config' && !e.enabled));
    send({ type: 'menu', id: 'setup' });
    await waitFor(() => events.some(e => e.type === 'onboarding'), 'optional setup');
    child.stdin.end(); await waitFor(() => child.exitCode !== null, 'shutdown');
    assert.equal(child.exitCode, 0, stderr);
  } finally { if (child.exitCode === null) child.kill(); rmSync(tmp, { recursive: true, force: true }); }
}
console.log('kineto startup: passed');
