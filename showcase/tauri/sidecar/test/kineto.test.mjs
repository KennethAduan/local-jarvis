import assert from 'node:assert/strict';
import { checkDraw, DrawArgs } from '../draw.mjs';
import { FORK_DEFAULTS, PREFERRED_MODEL, allowedModel, normalizeForkConfig, localCredentials, forkSecrets, localSketchTools, localSystem, sketchArgs, textLocalModel, withoutImages } from '../kineto.mjs';
import { preferredLocalModel } from '../kineto.mjs';
import { usableByRoamies } from '../providers.mjs';
import { LMSTUDIO, connectLocal, contextNote } from '../local.mjs';

const secretCalls = [];
const isolatedSecrets = forkSecrets({ kind: 'test', get: name => secretCalls.push(['get', name]), set: (name, value) => secretCalls.push(['set', name, value]), delete: name => secretCalls.push(['delete', name]) });
isolatedSecrets.get('fish'); isolatedSecrets.set('fish', 'example'); isolatedSecrets.delete('fish');
assert.deepEqual(secretCalls, [['get', 'kineto-fish'], ['set', 'kineto-fish', 'example'], ['delete', 'kineto-fish']]);
assert.equal(FORK_DEFAULTS.look, 'jarvis');
assert.equal(PREFERRED_MODEL, 'local/lmstudio/qwen/qwen3-4b-2507');
const migrated = normalizeForkConfig({ provider: 'openai', model: 'gpt-4', look: 'anime', tts: 'fish', sound: false });
assert.deepEqual(migrated, { provider: 'local', model: PREFERRED_MODEL, look: 'jarvis', tts: 'kokoro', sound: false, replies: 'voice' });
assert.equal(normalizeForkConfig({ tts: 'kokoro', replies: 'text', voice: false }).replies, 'text');
assert.equal(normalizeForkConfig({ tts: 'kokoro', replies: 'voiceonly', voice: false }).replies, 'voiceonly');
assert.equal(normalizeForkConfig({ tts: 'voicestudio', replies: 'text', voice: false }).replies, 'voice');
assert.equal(normalizeForkConfig({ tts: 'voicestudio', voice: false }).voice, false);
const other = 'local/lmstudio/qwen/qwen3-9b';
assert.equal(normalizeForkConfig({ provider: 'local', model: other }).model, other);
assert.equal(localCredentials('local', other).baseUrl, 'http://127.0.0.1:1234/v1');
for (const [provider, id] of [['openai', other], ['local', 'local/ollama/qwen'], ['local', 'local/lmstudio/https://evil'], ['local', 'local/lmstudio/../evil'], ['local', 'qwen']]) {
  assert.equal(allowedModel(provider, id), false);
  assert.throws(() => localCredentials(provider, id));
}
assert.equal(contextNote(8192, LMSTUDIO, true, true), '');
assert.match(contextNote(4096, LMSTUDIO, true, true), /8k or more/);
assert.equal(textLocalModel('local', { supportsImages: false }), true);
assert.equal(textLocalModel('local', { supportsImages: true }), false);
assert.equal(textLocalModel('openai', { supportsImages: false }), false);

const calls = [], openCalls = [], context = { signal: new AbortController().signal };
const tools = localSketchTools([
  { name: 'draw', execute: async (args, ctx) => { assert.equal(ctx, context); calls.push(DrawArgs.parse(args)); assert.deepEqual(checkDraw(args), []); return 'Original draw result'; } },
  { name: 'open', execute: async (args, ctx) => { assert.equal(ctx, context); openCalls.push(args); return 'Original open result'; } },
  ...['take_screenshot', 'read_window', 'act_in_app', 'run_command', 'read_file', 'see_photo', 'launch_agent'].map(name => ({ name })),
], 'win32');
assert.deepEqual(tools.map(t => t.name), ['open', 'sketch', 'clear_sketch'], 'image, command and GUI-control tools are not offered to the text-only model');
const open = tools.find(t => t.name === 'open');
assert.equal(await open.execute({ target: 'https://example.com/path' }, context), 'Original open result');
assert.equal(await open.execute({ target: 'google chrome' }, context), 'Original open result');
assert.deepEqual(openCalls, [{ target: 'https://example.com/path' }, { target: 'Google Chrome' }]);
for (const value of [{ target: 'javascript:alert(1)' }, { target: 'file:///tmp/a' }, { target: 'https://user:pass@example.com' }, { target: 'https://@example.com' }, { target: 'Unknown App' }, { target: 'C:/app.exe' }, { target: 'Notepad /x' }, { target: 'https://example.com', app: 'Firefox' }]) await assert.rejects(open.execute(value, context));
assert.equal(openCalls.length, 2);
const diagram = { title: 'API request', narration: 'A client sends a request to a server.',
  nodes: [{ id: 'client', text: 'Client', shape: 'box' }, { id: 'api', text: 'API', shape: 'round' }],
  links: [{ from: 'client', to: 'api', label: 'request' }],
};
assert.equal(await tools.find(t => t.name === 'sketch').execute(diagram, context), 'Original draw result');
assert.equal(calls[0].beats[0].marks[0].kind, 'flow');
assert.equal(calls[0].beats[0].marks[0].animate, true);
await tools.find(t => t.name === 'clear_sketch').execute({}, context);
assert.deepEqual(calls[1], { edit: [{ do: 'clear' }] });
for (const bad of [
  { ...diagram, script: 'execute something' },
  { ...diagram, nodes: [...diagram.nodes, diagram.nodes[0]] },
  { ...diagram, links: [{ from: 'client', to: 'missing', label: '' }] },
  { ...diagram, links: [{ from: 'client', to: 'client', label: '' }] },
  { ...diagram, nodes: [{ id: 'a', text: 'A', shape: 'model' }] },
]) assert.throws(() => sketchArgs(bad));
await assert.rejects(tools.find(t => t.name === 'clear_sketch').execute({ command: 'anything' }, context));
assert.equal(calls.length, 2, 'invalid arguments never reach the original drawing tool');

const original = [{ role: 'user', content: [{ type: 'text', text: 'Question' }, { type: 'image', data: 'private-image' }] },
  { role: 'tool', content: [{ content: [{ type: 'image', data: 'private-image' }] }] }];
const cleaned = withoutImages(original);
assert.doesNotMatch(JSON.stringify(cleaned), /private-image/);
assert.match(JSON.stringify(original), /private-image/, 'existing saved history is not mutated');
assert.match(localSystem({ user: 'Example', voice: true }), /cannot inspect images or screenshots/);
assert.match(localSystem({ user: 'Example', voice: true }), /2D sketches/);
assert.match(localSystem({ user: 'Example', voice: true, images: true }), /vision model/);
assert.doesNotMatch(localSystem({ user: 'Example', voice: true, images: true }), /TEXT-ONLY/);
const vl = { id: 'local/lmstudio/qwen2.5-vl-7b-instruct', name: 'Qwen2.5 VL 7B Instruct' };
assert.equal(preferredLocalModel([{ id: PREFERRED_MODEL }, vl]), vl);
assert.equal(preferredLocalModel([{ id: 'local/lmstudio/qwen2.5-vl-3b-instruct' }]), undefined);
const browserNames = ['browser_open', 'browser_search', 'browser_read', 'browser_act'];
const compact = localSketchTools([{ name: 'draw' }, { name: 'open' }, ...browserNames.map(name => ({ name })), { name: 'run_command' }]);
for (const name of browserNames) assert.ok(compact.some(t => t.name === name));
assert.ok(!compact.some(t => t.name === 'run_command'));

await connectLocal({ getCredentials: async () => null }, LMSTUDIO, { probe: async () => ({ endpoint: LMSTUDIO, reachable: true, models: [
  { rawId: 'qwen/qwen3-4b-2507', endpointId: 'lmstudio', contextWindow: 8192, contextWindowKnown: true, supportsTools: true, supportsImages: false, supportsThinking: false },
] }) });
assert.equal(usableByRoamies('local', PREFERRED_MODEL), true, 'the text model survives registry conversion and remains selectable');
assert.equal(usableByRoamies('local', 'missing'), false);
console.log('Jarvis integration: passed');
