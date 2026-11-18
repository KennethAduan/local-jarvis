// Public Kokoro pack pinned to the same revision and digests as Kineto Jarvis.
// This verifier does not read or change the other application's profile.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import path from 'node:path';

export const KOKORO_ASSETS = Object.freeze([
  { name: 'model.int8.onnx', bytes: 114202993, sha256: '75635ea3b85a32d00094dcdd61a258aba87c160f7c264c304a7b3ae9d734195e' },
  { name: 'voices.bin', bytes: 28200960, sha256: '1c5a5b983d3d50d8586d437a51f3faa2da7919ce76a013c081e65671a3447c29' },
  { name: 'lexicon-gb-en.txt', bytes: 6366635, sha256: 'c4cbb37316f62210dff52718a7afcaae24f50c032cc75ab47ae67b831d1049e7' },
  { name: 'tokens.txt', bytes: 687, sha256: '6ebb6bb288f20f3ae8d004d3c2ca27697da27c037d75e81a60e2a6a663f95425' },
  { name: 'LICENSE', bytes: 11358, sha256: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30' },
].map(Object.freeze));

// Returns false for missing, truncated, changed, or non-regular assets. Hash incrementally to avoid
// allocating the model in the Node process. Callers must still protect against changes after verification.
export async function verifyPack(directory, assets = KOKORO_ASSETS) {
  for (const asset of assets) {
    if (!asset || typeof asset.name !== 'string' || path.basename(asset.name) !== asset.name ||
        !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || !/^[0-9a-f]{64}$/.test(asset.sha256)) return false;
    try {
      const file = path.join(directory, asset.name), info = await lstat(file);
      if (!info.isFile() || info.size !== asset.bytes) return false;
      const hash = createHash('sha256'); let bytes = 0;
      for await (const chunk of createReadStream(file)) { bytes += chunk.length; if (bytes > asset.bytes) return false; hash.update(chunk); }
      if (bytes !== asset.bytes || hash.digest('hex') !== asset.sha256) return false;
    } catch { return false; }
  }
  return assets.length > 0;
}
