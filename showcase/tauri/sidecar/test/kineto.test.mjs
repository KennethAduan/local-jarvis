import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { checkDraw, DrawArgs } from '../draw.mjs';
import { FORK_DEFAULTS, JARVIS_FOLLOW, PREFERRED_MODEL, allowedModel, normalizeForkConfig, localCredentials, forkSecrets, localBrowserIntent, localSketchTools, localSystem, runLocalBrowserIntent, sketchArgs, textLocalModel, withoutImages } from '../kineto.mjs';
import { localAppIntent, planWalkthrough, preferredLocalModel, settingsWalkthrough, wantsWalkthrough } from '../kineto.mjs';
import { usableByRoamies } from '../providers.mjs';
import { LMSTUDIO, connectLocal, contextNote } from '../local.mjs';

const walkthroughRequest = 'Hey Jarvis, highlight System and wait for my click. Then highlight Display and wait again.';
assert.equal(wantsWalkthrough(walkthroughRequest), true);
assert.equal(wantsWalkthrough('Show me how to export this video. Point to each button and wait for my click.'), true);
assert.equal(wantsWalkthrough('Show me how photosynthesis works'), false);
assert.equal(wantsWalkthrough('Open the browser and search for Display settings'), false);
const settingsWindow = { app: 'Settings', title: 'Home', labels: ['System', 'Bluetooth & devices'] };
const settingsGuide = settingsWalkthrough('Walkthrough me how to open Display setting in the Windows Settings.', 'win32');
assert.equal(settingsGuide.open, 'ms-settings:');
assert.equal(settingsGuide.app, 'Settings');
assert.equal(settingsWalkthrough('Open Display settings in Windows Settings.', 'win32'), null);
assert.equal(settingsWalkthrough('Walk me through opening Display settings in Windows Settings.', 'darwin'), null);
assert.equal(settingsWalkthrough('Show me how to find Displays in System Settings.', 'darwin').open, 'System Settings');
assert.deepEqual(localAppIntent('Open Display settings.', 'win32'), { target: 'ms-settings:display', label: 'Display settings' });
assert.deepEqual(localAppIntent('Jarvis, open Notepad.', 'win32'), { target: 'Notepad', label: 'Notepad' });
assert.deepEqual(localAppIntent('Open Notes.', 'darwin'), { target: 'Notes', label: 'Notes' });
assert.equal(localAppIntent('Open Chrome and search for display settings.', 'win32'), null);
const walkthrough = await planWalkthrough(walkthroughRequest, settingsWindow, async () => {
  assert.fail('Explicit labels should not be rewritten by the model');
});
assert.deepEqual(await planWalkthrough(settingsGuide.request, settingsWindow, async () => assert.fail('Known Windows Display route should not need a model')), walkthrough);
assert.deepEqual(checkDraw(DrawArgs.parse(walkthrough)), []);
assert.deepEqual(walkthrough.beats.map(({ wait, marks }) => [wait, marks[0].kind, marks[0].at.text]), [['click', 'target', 'System'], ['click', 'target', 'Display']]);
const goal = 'Show me how to get to Display settings on my screen';
assert.deepEqual(await planWalkthrough(goal, settingsWindow, async (messages) => {
  assert.deepEqual(JSON.parse(messages.at(-1).content), { request: goal, window: settingsWindow });
  return '```json\n{"steps":["System","Display"]}\n```';
}), walkthrough);
assert.deepEqual(await planWalkthrough(goal, settingsWindow, async () => '{"steps":[]}'), { beats: [] });
await assert.rejects(planWalkthrough(goal, settingsWindow, async () => '{"steps":["System"],"action":"click"}'));

const secretCalls = [];
const isolatedSecrets = forkSecrets({ kind: 'test', get: name => secretCalls.push(['get', name]), set: (name, value) => secretCalls.push(['set', name, value]), delete: name => secretCalls.push(['delete', name]) });
isolatedSecrets.get('fish'); isolatedSecrets.set('fish', 'example'); isolatedSecrets.delete('fish');
assert.deepEqual(secretCalls, [['get', 'kineto-fish'], ['set', 'kineto-fish', 'example'], ['delete', 'kineto-fish']]);
assert.equal(FORK_DEFAULTS.look, 'jarvis');
assert.equal(FORK_DEFAULTS.allowActions, true);
assert.equal(FORK_DEFAULTS.skipAllow, true);
assert.equal(PREFERRED_MODEL, 'local/lmstudio/qwen/qwen3-4b-2507');
const migrated = normalizeForkConfig({ provider: 'openai', model: 'gpt-4', look: 'anime', tts: 'fish', sound: false });
assert.deepEqual(migrated, { provider: 'local', model: PREFERRED_MODEL, look: 'jarvis', tts: 'kokoro', sound: false, replies: 'voice', allowActions: true, skipAllow: true, jarvisFollow: JARVIS_FOLLOW });
assert.equal(normalizeForkConfig({ tts: 'kokoro', replies: 'text', voice: false }).replies, 'text');
assert.equal(normalizeForkConfig({ tts: 'kokoro', replies: 'voiceonly', voice: false }).replies, 'voiceonly');
assert.equal(normalizeForkConfig({ tts: 'voicestudio', replies: 'text', voice: false }).replies, 'voice');
assert.equal(normalizeForkConfig({ tts: 'voicestudio', voice: false }).voice, false);
const kept = normalizeForkConfig({ allowActions: false, skipAllow: false, jarvisFollow: JARVIS_FOLLOW, tts: 'kokoro', replies: 'text' });
assert.equal(kept.allowActions, false);
assert.equal(kept.skipAllow, false);
assert.deepEqual(localBrowserIntent('hey jarvis, can you please open the browser'), { kind: 'open', target: 'https://www.google.com' });
assert.deepEqual(localBrowserIntent('Jarvis. Open the web browser.'), { kind: 'open', target: 'https://www.google.com' });
assert.deepEqual(localBrowserIntent('please open browser and search for cats'), { kind: 'open', target: 'https://www.google.com/search?q=cats' });
assert.deepEqual(localBrowserIntent('Hey Jarvis, open Google Chrome browser, then search top ten Netflix movies of all time.'), {
  kind: 'open', target: 'https://www.google.com/search?q=top%20ten%20Netflix%20movies%20of%20all%20time',
});
assert.deepEqual(localBrowserIntent('Hey Jervis, open browser and search for top ten Netflix movies.'), {
  kind: 'open', target: 'https://www.google.com/search?q=top%20ten%20Netflix%20movies',
});
assert.deepEqual(localBrowserIntent('Okay, open web browser and search for top ten Netflix.'), {
  kind: 'open', target: 'https://www.google.com/search?q=top%20ten%20Netflix',
});
assert.deepEqual(localBrowserIntent('Can you open my web browser and search in the YouTube about the latest video of GT 6'), {
  kind: 'open', target: 'https://www.youtube.com/results?search_query=the%20latest%20video%20of%20GT%206',
});
assert.deepEqual(localBrowserIntent('open youtube and search gta 6'), {
  kind: 'open', target: 'https://www.youtube.com/results?search_query=gta%206',
});
assert.deepEqual(localBrowserIntent('open youtube.com and search about the latest gta 6 video'), {
  kind: 'open', target: 'https://www.youtube.com/results?search_query=the%20latest%20gta%206%20video',
});
assert.equal(localBrowserIntent('open youtube.com and search about the latest gta 6 video').target.includes('comandsearch'), false);
assert.deepEqual(localBrowserIntent('Can you open Google.com in my web browser?'), { kind: 'open', target: 'https://www.google.com' });
assert.deepEqual(localBrowserIntent('Can you open web browser google dot com?'), { kind: 'open', target: 'https://www.google.com' });
assert.deepEqual(localBrowserIntent('open brave'), { kind: 'open', target: 'brave' });
assert.deepEqual(localBrowserIntent('open facebook and search for Elon Musk'), {
  kind: 'open', target: 'https://www.facebook.com/search/top/?q=Elon%20Musk',
});
assert.deepEqual(localBrowserIntent('open amazon and search wireless earbuds'), {
  kind: 'open', target: 'https://www.amazon.com/s?k=wireless%20earbuds',
});
assert.deepEqual(localBrowserIntent('open shopeee and search for phone case'), {
  kind: 'open', target: 'https://shopee.ph/search?keyword=phone%20case',
});
assert.deepEqual(localBrowserIntent('open lazada and search for keyboard'), {
  kind: 'open', target: 'https://www.lazada.com.ph/catalog/?q=keyboard',
});
assert.deepEqual(localBrowserIntent('open facebook'), { kind: 'open', target: 'https://www.facebook.com' });
assert.deepEqual(localBrowserIntent('open shopee'), { kind: 'open', target: 'https://shopee.ph' });
const other = 'local/lmstudio/qwen/qwen3-9b';
assert.equal(normalizeForkConfig({ provider: 'local', model: other }).model, other);
assert.equal(localCredentials('local', other).baseUrl, 'http://127.0.0.1:1234/v1');
const overrideScript = `
  import assert from 'node:assert/strict';
  import { localCredentials } from ${JSON.stringify(new URL('../kineto.mjs', import.meta.url).href)};
  import { LMSTUDIO } from ${JSON.stringify(new URL('../local.mjs', import.meta.url).href)};
  assert.equal(LMSTUDIO.baseUrl, 'http://192.0.2.10:2345/v1');
  assert.deepEqual(localCredentials('local', ${JSON.stringify(other)}), { baseUrl: LMSTUDIO.baseUrl, accessToken: 'fixture-token' });
  assert.equal(process.env.JARVIS_LMSTUDIO_API_TOKEN, undefined);
`;
execFileSync(process.execPath, ['--input-type=module', '-e', overrideScript], {
  env: { ...process.env, JARVIS_LMSTUDIO_URL: 'http://192.0.2.10:2345/', JARVIS_LMSTUDIO_API_TOKEN: 'fixture-token' },
});
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
assert.deepEqual(tools.map(t => t.name), ['open', 'browser_search', 'browser_open', 'sketch', 'clear_sketch'], 'image, command and GUI-control tools are not offered to the text-only model');
const open = tools.find(t => t.name === 'open');
assert.equal(await open.execute({ target: 'https://example.com/path' }, context), 'Original open result');
assert.equal(await open.execute({ target: 'https://www.google.com/search?q=weather+today' }, context), 'Original open result');
assert.equal(await open.execute({ target: 'google chrome' }, context), 'Original open result');
assert.equal(await open.execute({ target: 'browser' }, context), 'Original open result');
assert.equal(await open.execute({ target: 'edge' }, context), 'Original open result');
assert.equal(await open.execute({ target: 'chrome' }, context), 'Original open result');
assert.deepEqual(openCalls, [
  { target: 'https://example.com/path' },
  { target: 'https://www.google.com/search?q=weather+today' },
  { target: 'Google Chrome' },
  { target: 'https://www.google.com' }, // open "browser" via alias → default-browser home URL
  { target: 'Microsoft Edge' },
  { target: 'Google Chrome' },
]);
for (const value of [{ target: 'javascript:alert(1)' }, { target: 'file:///tmp/a' }, { target: 'https://user:pass@example.com' }, { target: 'https://@example.com' }, { target: 'Unknown App' }, { target: 'C:/app.exe' }, { target: 'Notepad /x' }, { target: 'https://example.com', app: 'Firefox' }]) await assert.rejects(open.execute(value, context));
assert.equal(openCalls.length, 6);
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
assert.match(localSystem({ user: 'Example', voice: true }), /open with target "browser"/);
assert.match(localSystem({ user: 'Example', voice: true }), /google\.com\/search\?q=/);
assert.match(localSystem({ user: 'Example', voice: true }), /default browser/);
assert.match(localSystem({ user: 'Example', voice: true }), /Never ask for confirmation/);
assert.match(localSystem({ user: 'Example', voice: true, images: true }), /vision model/);
assert.doesNotMatch(localSystem({ user: 'Example', voice: true, images: true }), /TEXT-ONLY/);
assert.match(open.description, /target "browser"/);
assert.match(open.description, /google\.com\/search\?q=/);
assert.deepEqual(localBrowserIntent('open browser'), { kind: 'open', target: 'https://www.google.com' });
assert.deepEqual(localBrowserIntent('Open the browser!'), { kind: 'open', target: 'https://www.google.com' });
assert.deepEqual(localBrowserIntent('open my default browser'), { kind: 'open', target: 'https://www.google.com' });
assert.deepEqual(localBrowserIntent('open chrome'), { kind: 'open', target: 'chrome' });
assert.deepEqual(localBrowserIntent('open browser and search for top ten movies on Netflix'), { kind: 'open', target: 'https://www.google.com/search?q=top%20ten%20movies%20on%20Netflix' });
assert.deepEqual(localBrowserIntent('search for weather today'), { kind: 'open', target: 'https://www.google.com/search?q=weather%20today' });
assert.equal(localBrowserIntent('what is a browser'), null);
assert.equal(localBrowserIntent('remind me to open the browser later'), null);
const intentOpens = [];
assert.equal(await runLocalBrowserIntent('open browser', async (args) => { intentOpens.push(args); return 'ok'; }), 'Opened your browser.');
assert.equal(await runLocalBrowserIntent('open browser and search for cats', async (args) => { intentOpens.push(args); return 'ok'; }), 'Opened search in your browser.');
assert.deepEqual(intentOpens, [{ target: 'https://www.google.com' }, { target: 'https://www.google.com/search?q=cats' }]);
assert.equal(await runLocalBrowserIntent('tell me a joke', async () => 'no'), null);
const vl = { id: 'local/lmstudio/qwen2.5-vl-7b-instruct', name: 'Qwen2.5 VL 7B Instruct' };
assert.equal(preferredLocalModel([{ id: PREFERRED_MODEL }, vl]), vl);
assert.equal(preferredLocalModel([{ id: 'local/lmstudio/qwen2.5-vl-3b-instruct' }]), undefined);
const playwright = [], defaultOpens = [];
const compact = localSketchTools([
  { name: 'draw', execute: async () => 'draw' },
  { name: 'open', execute: async (args) => { defaultOpens.push(args); return 'opened'; } },
  { name: 'browser_open', execute: async () => { playwright.push('browser_open'); return 'playwright'; } },
  { name: 'browser_search', execute: async () => { playwright.push('browser_search'); return 'playwright'; } },
  { name: 'browser_read', execute: async () => { playwright.push('browser_read'); return 'playwright'; } },
  { name: 'browser_act', execute: async () => { playwright.push('browser_act'); return 'playwright'; } },
  { name: 'run_command' },
], 'win32');
assert.deepEqual(compact.map(t => t.name).filter(n => n.startsWith('browser_')), ['browser_search', 'browser_open']);
assert.ok(!compact.some(t => t.name === 'run_command' || t.name === 'browser_read' || t.name === 'browser_act'));
assert.equal(await compact.find(t => t.name === 'browser_search').execute({ query: 'top ten movies on Netflix' }, context), 'opened');
assert.equal(await compact.find(t => t.name === 'browser_open').execute({ url: 'https://www.netflix.com' }, context), 'opened');
assert.deepEqual(defaultOpens, [
  { target: 'https://www.google.com/search?q=top%20ten%20movies%20on%20Netflix' },
  { target: 'https://www.netflix.com' },
]);
assert.deepEqual(playwright, [], 'local mode must not launch the Playwright Edge browser');

await connectLocal({ getCredentials: async () => null }, LMSTUDIO, { probe: async () => ({ endpoint: LMSTUDIO, reachable: true, models: [
  { rawId: 'qwen/qwen3-4b-2507', endpointId: 'lmstudio', contextWindow: 8192, contextWindowKnown: true, supportsTools: true, supportsImages: false, supportsThinking: false },
] }) });
assert.equal(usableByRoamies('local', PREFERRED_MODEL), true, 'the text model survives registry conversion and remains selectable');
assert.equal(usableByRoamies('local', 'missing'), false);
console.log('Jarvis integration: passed');
