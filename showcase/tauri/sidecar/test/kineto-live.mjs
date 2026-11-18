// Opt-in public-prompt check. No screenshots, microphone, credentials, files or real desktop actions.
import assert from 'node:assert/strict';
import { Agent } from '@kenkaiiii/gg-agent';
import { LOCAL_API_KEY_PLACEHOLDER, getModel } from '@kenkaiiii/gg-core';
import { LMSTUDIO, connectLocal } from '../local.mjs';
import { PREFERRED_MODEL, localSketchTools, localSystem } from '../kineto.mjs';

if (process.env.KINETO_LIVE_TEST !== '1') throw new Error('Set KINETO_LIVE_TEST=1 to use the running local LM Studio.');
const result = await connectLocal({ getCredentials: async () => null }, LMSTUDIO);
assert.ok(result.ok && getModel(PREFERRED_MODEL), 'Load the preferred model and start LM Studio first');
let draws = 0, text = '';
const tools = localSketchTools([{ name: 'draw', execute: async () => { draws++; return 'The validated flow diagram was drawn in this test fixture.'; } }, { name: 'open', execute: async () => { throw new Error('Opening is disabled in this fixture.'); } }]);
const agent = new Agent({ provider: 'local', model: PREFERRED_MODEL, baseUrl: LMSTUDIO.baseUrl,
  resolveCredentials: async () => ({ apiKey: LOCAL_API_KEY_PLACEHOLDER }),
  system: localSystem({ user: 'Example user', voice: false }), tools, maxTurns: 3, signal: AbortSignal.timeout(90_000),
});
for await (const event of agent.prompt('Sketch how a REST API request works. Call the sketch tool with 3 or 4 nodes and connecting links, then explain it briefly.')) {
  if (event.type === 'error') throw event.error;
  if (event.type === 'text_delta') text += event.text;
}
assert.ok(draws > 0, 'The real local model must invoke a validated sketch, not just talk about drawing');
console.log(`Local Qwen → Roamies agent → validated original draw payload: ${draws} invocation(s); ${text.length} reply characters.`);
