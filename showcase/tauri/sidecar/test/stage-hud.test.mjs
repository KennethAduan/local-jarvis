import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stageSrc = readFileSync(new URL('../../../roamies/stage.js', import.meta.url), 'utf8');
const ditherSrc = readFileSync(new URL('../../../roamies/10-dither.js', import.meta.url), 'utf8');

assert.match(stageSrc, /const godRays\s*=/, 'living core needs god-rays helper or ray paint');
assert.match(stageSrc, /const hub\s*=/, 'bright hub required');
assert.doesNotMatch(stageSrc, /helmet|iron.?man|jet\b|spacecraft/i, 'no helmet/jet art');
assert.match(stageSrc, /fillRect\(0,\s*0,\s*w,\s*h\)/, 'opaque full-canvas cover');
// Bound the staged branch by braces so a later `return` in the file cannot satisfy the check.
function blockAfter(src, re) {
  const m = re.exec(src);
  assert.ok(m, 'staged branch present');
  let depth = 0;
  for (let i = m.index + m[0].lastIndexOf('{'); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index + m[0].lastIndexOf('{') + 1, i);
    }
  }
  assert.fail('staged branch not closed');
}

const stagedBody = blockAfter(ditherSrc, /if\s*\(\s*staged\s*\)\s*\{/);
const paintAt = stagedBody.search(/Roamie\.stage\?\.paint/);
const overAt = stagedBody.search(/plug\?\.over/);
const returnAt = stagedBody.search(/\breturn\s*;/);
assert.ok(
  paintAt >= 0 && overAt > paintAt && returnAt > overAt,
  'staged: paint HUD, plug?.over, then return before LED blit',
);
assert.doesNotMatch(stagedBody, /drawImage|\bbloom\b/, 'staged branch does not blit the LED body');
assert.match(ditherSrc, /Math\.min\(env\.w,\s*env\.h\)\s*\*\s*0\.22/, 'staged core uses ~22% short-edge scale (not stretched)');
assert.doesNotMatch(ditherSrc, /\*\s*0\.58/, 'staged core must not use the old 58% stretch');

console.log('stage-hud source tests: passed');
