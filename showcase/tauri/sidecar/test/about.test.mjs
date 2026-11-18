import assert from 'node:assert/strict';
import { aboutRoamies } from '../about.mjs';
import { readFileSync } from 'node:fs';

for (const options of [
  { mac: true, voice: true, hotkeys: true },
  { linux: true, voice: true, hotkeys: false },
  { mac: false, linux: false, voice: false },
]) {
  const text = aboutRoamies(options);
  for (const expected of [/Ken Kai/, /AGPL/, /KennethAduan\/local-jarvis/, /only appearance/, /127\.0\.0\.1:1234\/v1/, /Kokoro/, /2D sketches/, /web searches.*internet/, /updates are disabled/]) assert.match(text, expected);
  assert.doesNotMatch(text, /Fish Audio|Gemini|Ollama|API key|sign in|Another server|Anime Girl/i);
  assert.doesNotMatch(text, /undefined|\$\{/);
}
assert.match(aboutRoamies({ mac: true, voice: true, hotkeys: true }), /hold-to-talk/);
assert.doesNotMatch(aboutRoamies({ voice: false }), /Listening controls/);
const markup = readFileSync(new URL('../../../onboarding/index.html', import.meta.url), 'utf8');
assert.match(markup, /id="ai-lead">Start LM Studio/);
assert.doesNotMatch(markup, /Sign in with an AI account|Small models send broken drawings/);
assert.match(markup, /<div hidden aria-hidden="true">\s*<form class="inline" id="code-form"/);
assert.match(markup, /id="key-toggle" hidden/);
const panel = readFileSync(new URL('../../../panel/panel.js', import.meta.url), 'utf8');
assert.match(panel, /kokoro_preview/);
console.log('Jarvis about tests: passed');
