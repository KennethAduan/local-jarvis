// Run only with Kineto JARVIS stopped: its memory is cached in the running sidecar.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function mergeProfile(memory, profile) {
  if (!memory || memory.version !== 1 || !Array.isArray(memory.commitments) || (memory.facts != null && !Array.isArray(memory.facts))) throw new Error('Unsupported memory format');
  if (memory.kinetoProfileImported) return memory;
  if (!profile || !profile.enabled) throw new Error('No enabled personal profile');
  const text = [profile.display_name, profile.content].filter(Boolean).join('\n').trim();
  if (!text) throw new Error('Personal profile is empty');
  const parts = text.split(/\n+/).flatMap(line => {
    const words = line.trim().split(/\s+/); const out = []; let part = '';
    for (const word of words) {
      if (word.length > 240) throw new Error('A profile word exceeds the memory limit');
      if (part && part.length + word.length + 1 > 240) { out.push(part); part = ''; }
      part += (part ? ' ' : '') + word;
    }
    if (part) out.push(part);
    return out;
  });
  const facts = [...(memory.facts ?? [])];
  const key = text => text.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const seen = new Set(facts.map(f => key(f.text)));
  const ids = new Set([...facts, ...memory.commitments].map(f => f.id));
  for (const text of parts) {
    if (seen.has(key(text))) continue;
    let id; do { id = `f${randomBytes(3).toString('hex')}`; } while (ids.has(id));
    ids.add(id); seen.add(key(text)); facts.push({ id, text, createdAt: Date.now() });
  }
  if (facts.length > 150) throw new Error('Not enough memory capacity; no facts were changed');
  return { ...memory, facts, kinetoProfileImported: true };
}

async function main() {
  if (!process.argv.includes('--app-stopped')) throw new Error('Quit Jarvis, then rerun with --app-stopped');
  const dbPath = process.argv[process.argv.indexOf('--db') + 1];
  if (!process.argv.includes('--db') || !dbPath) throw new Error('Supply --db followed by the original jarvis.db path');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  let profile; try { profile = db.prepare('SELECT display_name, content, enabled FROM personal_profile WHERE id=1').get(); } finally { db.close(); }
  const dir = path.join(process.env.ROAMIES_DATA_DIR || path.join(os.homedir(), '.kineto-roamies'), 'sidekick');
  const file = path.join(dir, 'memory.json');
  let memory; try { memory = JSON.parse(await readFile(file, 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    try { await readFile(`${file}.bak`); throw new Error('Memory backup exists; restore it before importing'); } catch (backupError) { if (backupError.code !== 'ENOENT') throw backupError; }
    memory = { version: 1, commitments: [], facts: [] };
  }
  const merged = mergeProfile(memory, profile);
  if (merged === memory) return console.log('Profile already imported; existing memory unchanged.');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(merged, null, 2), { mode: 0o600, flag: 'wx', flush: true });
  try { await copyFile(file, `${file}.bak`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await rename(tmp, file);
  console.log('Profile imported into local memory.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error(`Profile import failed: ${e.message}`); process.exitCode = 1; });
