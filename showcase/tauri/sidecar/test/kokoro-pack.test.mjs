import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { KOKORO_ASSETS, verifyPack } from '../kokoro-pack.mjs';

const dir = await mkdtemp(path.join(os.tmpdir(), 'jarvis-pack-test-'));
try {
  const data = Buffer.from('public test asset');
  const asset = { name: 'asset', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  assert.equal(await verifyPack(dir, [asset]), false);
  await writeFile(path.join(dir, 'asset'), data);
  assert.equal(await verifyPack(dir, [asset]), true);
  assert.equal(await verifyPack(dir, [{ ...asset, bytes: data.length + 1 }]), false);
  assert.equal(await verifyPack(dir, [{ ...asset, sha256: '0'.repeat(64) }]), false);
  assert.equal(await verifyPack(dir, [{ ...asset, name: '../asset' }]), false);
  assert.equal(await verifyPack(dir, []), false);
  assert.equal(KOKORO_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0), 148782633);
} finally { await rm(dir, { recursive: true, force: true }); }
console.log('kokoro pack checks passed');
