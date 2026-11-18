import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const side = src('../sidekick.mjs');
const panel = src('../../../panel/panel.js');

assert.match(side, /config\.replies === 'voice' \|\| config\.replies === 'voiceonly'/);
assert.match(side, /const SHOW_TEXT = \(\) => config\.replies !== 'voiceonly'/);
assert.match(side, /if \(!SHOW_TEXT\(\)\) return;/);
assert.match(side, /id === 'replies:voiceonly'\) setReplies\('voiceonly'\)/);
assert.match(side, /mode === 'voiceonly'\) speakLine\('Voice only/);
assert.match(panel, /\['voiceonly', 'Voice only'\]/);
assert.match(panel, /voiceonly: 'I talk only; no bubbles on screen\.'/);
console.log('replies voice-only tests: passed');
