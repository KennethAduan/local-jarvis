import assert from 'node:assert/strict';
import { mergeProfile } from '../import-profile.mjs';

const old = { version: 1, commitments: [{ id: 'c1', text: 'Keep' }], facts: [{ id: 'f1', text: 'Existing edit', createdAt: 1 }] };
const profile = { enabled: 1, display_name: 'Example Person', content: 'Engineer\nExample City' };
const merged = mergeProfile(old, profile);
assert.deepEqual(merged.facts.slice(0, 1), old.facts);
assert.deepEqual(merged.commitments, old.commitments);
assert.equal(merged.facts.length, 4);
assert.equal(mergeProfile(merged, profile), merged);
assert.throws(() => mergeProfile(old, { ...profile, enabled: 0 }));
assert.throws(() => mergeProfile({ ...old, version: 2 }, profile));
assert.equal(old.facts.length, 1);
console.log('profile import tests: passed');
