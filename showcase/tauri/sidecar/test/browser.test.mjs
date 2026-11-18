import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBrowserTools } from '../browser.mjs';
const server = http.createServer((req, res) => res.end(req.url.startsWith('/result') ? '<h1>Result detail</h1><p>Useful data 42</p>' : req.url.startsWith('/search') ? '<h1>Search results</h1><a href="/result">Open result</a>' : '<h1>Fixture</h1><form action="/search"><label>Search <input type="search" name="q"></label><button>Search</button></form><label>Password <input type="password" value="secretpassword"></label><label>One time code <input value="secretotp" autocomplete="one-time-code"></label><form action="/submit" method="post"><button>Send message</button></form><a href="http://127.0.0.2/">Unsafe link</a>'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'roamies-browser-'));
let asked = 0;
const adapter = createBrowserTools({ dataRoot: dir, headless: true, allowActions: () => true, ask: async () => { asked++; return 'no'; }, checkUrl: async url => ({ level: new URL(url).origin === origin ? 'safe' : 'block', reason: 'test origin only' }) });
const call = (name, args = {}, ctx) => adapter.tools.find(t => t.name === name).execute(args, ctx);
const ref = (s, label) => { const line = s.split('\n').find(x => x.includes(label) && x.includes('[ref=')); assert.ok(line, `missing ${label}: ${s}`); return line.match(/\[ref=([^\]]+)\]/)[1]; };
try {
 await test('owned browser flow and safety', async () => {
  await assert.rejects(fs.stat(path.join(dir, 'browser-profile')), { code: 'ENOENT' });
  await assert.rejects(call('browser_open', { url: 'file:///etc/passwd' }), /Blocked/);
  let s = await call('browser_open', { url: origin });
  assert.match(s, /Fixture/); assert.doesNotMatch(s, /secretpassword|secretotp|One time code/);
  const stale = ref(s, 'Search'); s = await call('browser_read');
  await assert.rejects(call('browser_act', { action: 'type', ref: stale, text: 'query' }), /stale/);
  s = await call('browser_act', { action: 'type', ref: ref(s, 'Search'), text: 'hello' }); assert.doesNotMatch(s, /hello/);
  s = await call('browser_act', { action: 'press', ref: ref(s, 'Search'), key: 'Enter' }); assert.match(s, /Search results/);
  s = await call('browser_open', { url: origin });
  s = await call('browser_act', { action: 'type', ref: ref(s, 'searchbox'), text: 'hello' });
  s = await call('browser_act', { action: 'click', ref: ref(s, 'button "Search"') }); assert.match(s, /Search results/); assert.equal(asked, 0);
  s = await call('browser_act', { action: 'click', ref: ref(s, 'Open result') }); assert.match(s, /Useful data 42/);
  s = await call('browser_open', { url: origin });
  await assert.rejects(call('browser_act', { action: 'click', ref: ref(s, 'Send message') }), /declined/); assert.equal(asked, 1);
  await assert.rejects(call('browser_act', { action: 'click', ref: ref(s, 'Unsafe link') }), /Blocked/);
  await assert.rejects(call('browser_open', { url: 'http://127.0.0.2/' }), /Blocked/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(call('browser_open', { url: origin }, { signal: controller.signal }), /cancelled/);
 });
 await test('disabled actions and cancellation while approval is pending', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const other = createBrowserTools({ dataRoot: path.join(dir, 'other'), headless: true, allowActions: () => true, ask: () => pending, checkUrl: async url => ({ level: new URL(url).origin === origin ? 'safe' : 'block' }) });
  const exec = (name, args, ctx) => other.tools.find(t => t.name === name).execute(args, ctx);
  try {
   const page = await exec('browser_open', { url: origin });
   const controller = new AbortController();
   const operation = exec('browser_act', { action: 'click', ref: ref(page, 'Send message') }, { signal: controller.signal });
   await new Promise(resolve => setTimeout(resolve, 100)); controller.abort(); release('yes');
   await assert.rejects(operation, /cancelled/);
   const reopened = await exec('browser_open', { url: origin }); assert.match(reopened, /Fixture/);
  } finally { await other.close(); }
  const disabled = createBrowserTools({ dataRoot: path.join(dir, 'disabled'), allowActions: () => false });
  try { await assert.rejects(disabled.tools.find(t => t.name === 'browser_act').execute({ action: 'click', ref: 'fake' }), /disabled/); } finally { await disabled.close(); }
 });
} finally { await adapter.close(); server.close(); await fs.rm(dir, { recursive: true, force: true }); }
