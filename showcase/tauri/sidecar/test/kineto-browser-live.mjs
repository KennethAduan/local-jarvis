// Opt-in local-model + real Edge test, using only a disposable public-text fixture.
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { Agent } from '@kenkaiiii/gg-agent';
import { LOCAL_API_KEY_PLACEHOLDER, getModel } from '@kenkaiiii/gg-core';
import { LMSTUDIO, connectLocal } from '../local.mjs';
import { PREFERRED_MODEL, localSystem, localSketchTools, preferredLocalModel } from '../kineto.mjs';
import { createBrowserTools } from '../browser.mjs';
if (process.env.KINETO_LIVE_TEST !== '1') throw new Error('Set KINETO_LIVE_TEST=1.');
const available = await connectLocal({ getCredentials: async () => null }, LMSTUDIO);
const model = process.env.KINETO_TEST_MODEL || preferredLocalModel(available.models ?? [])?.id || PREFERRED_MODEL;
assert.ok(available.ok && getModel(model), 'Start LM Studio with a loaded model.');
let searched = false, text = ''; const trace = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  searched ||= url.pathname === '/search' && url.searchParams.get('q') === 'local assistants';
  res.setHeader('content-type', 'text/html');
  res.end(url.pathname === '/search' ? '<h1>Local assistants result verified</h1>'
    : '<h1>Browser test</h1><form action="/search" method="get"><label>Search <input type="search" name="q"></label><button>Search</button></form>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const root = await mkdtemp(path.join(os.tmpdir(), 'jarvis-model-browser-'));
const browser = createBrowserTools({ dataRoot: root, headless: true, allowActions: () => true,
  checkUrl: async url => ({ level: new URL(url).origin === origin ? 'safe' : 'block' }),
  ask: async () => { throw new Error('Fixture search should not request consequential-action approval.'); } });
try {
  const traced = browser.tools.map(tool => ({ ...tool, execute: async (args, ctx) => {
    const entry = { name: tool.name, args }; trace.push(entry);
    try { const result = await tool.execute(args, ctx); entry.result = result; return result; }
    catch (error) { entry.error = error.message; throw error; }
  } }));
  const tools = localSketchTools([...traced, { name: 'draw', execute: () => { throw new Error('Not requested'); } },
    { name: 'open', execute: () => { throw new Error('Use browser_open'); } }]);
  const agent = new Agent({ provider: 'local', model, baseUrl: LMSTUDIO.baseUrl,
    resolveCredentials: async () => ({ apiKey: LOCAL_API_KEY_PLACEHOLDER }),
    system: localSystem({ user: 'Example user', voice: false }), tools, maxTurns: 6, signal: AbortSignal.timeout(120_000) });
  for await (const e of agent.prompt(`Use browser_open to open ${origin}. Type exactly local assistants into the Search field with browser_act, then press Enter on its latest reference. Read the result heading and report it. Do not use browser_search: this is a local fixture.`)) {
    if (e.type === 'error') throw e.error;
    if (e.type === 'text_delta') text += e.text;
  }
  assert.ok(searched, `The model must complete a real typed GET search. ${JSON.stringify({ trace, text })}`);
  assert.match(text, /verified/i);
  console.log(`Local model ${model}: real Edge typed search and result read passed.`);
} finally {
  await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}
