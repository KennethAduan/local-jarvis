import assert from 'node:assert/strict';
import { normalizeWholeScreen, clearWholeScreenOnHide } from '../wholescreen.mjs';
import { aboutRoamies } from '../about.mjs';
import { readFileSync } from 'node:fs';

assert.equal(normalizeWholeScreen(true), true);
assert.equal(normalizeWholeScreen(false), false);
assert.equal(normalizeWholeScreen('yes'), false);
assert.equal(normalizeWholeScreen(undefined), false);

const cfg = { wholeScreen: true };
assert.equal(clearWholeScreenOnHide(cfg), true);
assert.equal(cfg.wholeScreen, false);
assert.equal(clearWholeScreenOnHide(cfg), false);

assert.match(aboutRoamies({ mac: true, voice: true, hotkeys: true }), /whole-screen/i);

const panel = readFileSync(new URL('../../../panel/panel.js', import.meta.url), 'utf8');
assert.match(panel, /wholescreen/);
assert.match(panel, /Whole screen/);

const host = readFileSync(new URL('../../../roamies/host.js', import.meta.url), 'utf8');
assert.match(host, /clearWholeScreen/, 'Esc/summon share a whole-screen clear helper');
assert.match(host, /if\s*\(\s*clearWholeScreen\(\)\s*\)\s*return/, 'Esc exits whole-screen before hide');
console.log('wholescreen tests: passed');
