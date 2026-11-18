import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'kineto-dispatch-'));
const log = path.join(tmp, 'network.log');
const config = path.join(tmp, 'sidekick.json');
writeFileSync(config, JSON.stringify({ provider: 'openai', model: 'gpt-4', look: 'anime', tts: 'fish', onboarded: false, voice: false, replies: 'text', localServers: [{ id: 'evil', label: 'Evil', baseUrl: 'https://example.invalid/v1' }] }));
const fixture = fileURLToPath(new URL('./kineto-network-fixture.mjs', import.meta.url));
const sidekick = fileURLToPath(new URL('../sidekick.mjs', import.meta.url));
const child = spawn(process.execPath, ['--import', pathToFileURL(fixture).href, sidekick], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, HOME: tmp, USERPROFILE: tmp, APPDATA: tmp, LOCALAPPDATA: tmp, ROAMIES_DATA_DIR: tmp, ROAMIES_HANDS: '', ROAMIES_EXE: '', KINETO_TEST_NETWORK_LOG: log } });
let stderr = '', events = [];
child.stderr.on('data', chunk => { stderr += chunk; });
createInterface({ input: child.stdout }).on('line', line => { try { events.push(JSON.parse(line)); } catch {} });
const send = event => child.stdin.write(`${JSON.stringify(event)}\n`);
const waitFor = async (predicate, label) => {
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    if (predicate()) return;
    if (child.exitCode !== null) throw new Error(`sidecar exited ${child.exitCode}: ${stderr}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${label}: ${stderr}`);
};
const panelStates = () => events.filter(e => e.type === 'panel' && e.msg?.kind === 'state').map(e => e.msg.state);
try {
  await waitFor(() => events.some(e => e.type === 'menu'), 'sidecar startup');
  send({ type: 'ui_ready' });
  send({ type: 'ob_hello' });
  send({ type: 'panel_open' });
  await waitFor(() => panelStates().some(s => s.providers?.find(p => p.id === 'local')?.models?.length === 2), 'discovered local models');
  const initial = panelStates().at(-1);
  assert.equal(initial.look, 'jarvis');
  assert.equal(initial.tts, 'kokoro');
  assert.equal(initial.model.provider, 'local');
  assert.deepEqual(initial.providers.map(p => p.id), ['local']);
  assert.deepEqual(initial.localServers.map(s => s.id), ['lmstudio']);
  for (const event of [
    { type: 'menu', id: 'model:openai:gpt-4' },
    { type: 'menu', id: 'model:local:local/evil/model' },
    { type: 'menu', id: 'login:openai' },
    { type: 'menu', id: 'key:anthropic' },
    { type: 'menu', id: 'look:anime' },
    { type: 'menu', id: 'tts:fish' },
    { type: 'ob_login', provider: 'openai' },
    { type: 'ob_apikey', provider: 'anthropic', key: 'synthetic-key' },
    { type: 'ob_look', look: 'sarah' },
    { type: 'ob_tts', provider: 'gemini' },
    { type: 'panel_key', provider: 'openai', key: 'synthetic-key' },
    { type: 'panel_fishkey', key: 'synthetic-key' },
    { type: 'panel_local_add', label: 'Evil', baseUrl: 'https://example.invalid/v1' },
    { type: 'menu', id: 'local:connect:evil' },
  ]) send(event);
  send({ type: 'menu', id: 'replies:text' });
  send({ type: 'menu', id: 'model:local:local/lmstudio/qwen/qwen3-9b' });
  await waitFor(() => panelStates().some(s => s.model?.id === 'local/lmstudio/qwen/qwen3-9b'), 'selection of the discovered 9B model');
  const selected = panelStates().at(-1);
  assert.equal(selected.look, 'jarvis');
  assert.equal(selected.tts, 'kokoro');
  assert.equal(selected.model.provider, 'local');
  child.stdin.end();
  await waitFor(() => child.exitCode !== null, 'sidecar shutdown');
  assert.equal(child.exitCode, 0, stderr);
  const saved = JSON.parse(readFileSync(config, 'utf8'));
  assert.equal(saved.provider, 'local'); assert.equal(saved.model, 'local/lmstudio/qwen/qwen3-9b');
  assert.equal(saved.look, 'jarvis'); assert.equal(saved.tts, 'kokoro'); assert.equal(saved.replies, 'text'); assert.equal(saved.voice, false);
  const requests = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  assert.ok(requests.some(line => line === 'fetch http://127.0.0.1:1234/v1/models'));
  assert.deepEqual(requests.filter(line => !/^fetch http:\/\/127\.0\.0\.1:(1234)\//.test(line)), [], 'no cloud or remote network attempts');
  console.log('sidecar dispatch policy: passed');
} finally {
  if (child.exitCode === null) child.kill();
  rmSync(tmp, { recursive: true, force: true });
}
