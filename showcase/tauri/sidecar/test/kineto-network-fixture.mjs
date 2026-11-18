// Preloaded only by the sidecar integration test: record and block real network activity.
import fs from 'node:fs';
import net from 'node:net';

const log = (kind, value) => fs.appendFileSync(process.env.KINETO_TEST_NETWORK_LOG, `${kind} ${value}\n`);
globalThis.fetch = async (input) => {
  const url = String(input instanceof Request ? input.url : input);
  log('fetch', url);
  if (process.env.KINETO_TEST_OFFLINE === '1') throw new Error('LM Studio unavailable in test');
  if (url === 'http://127.0.0.1:1234/v1/models') return Response.json({ data: [{ id: 'qwen/qwen3-4b-2507' }, { id: 'qwen/qwen3-9b' }] });
  if (url === 'http://127.0.0.1:1234/api/v1/models') return Response.json({ models: [
    { key: 'qwen/qwen3-4b-2507', type: 'llm', loaded_instances: [{ id: 'qwen/qwen3-4b-2507', config: { context_length: 8192 } }] },
    { key: 'qwen/qwen3-9b', type: 'llm', loaded_instances: [{ id: 'qwen/qwen3-9b', config: { context_length: 16384 } }] },
  ] });
  throw new Error('Network blocked by integration test');
};
net.Socket.prototype.connect = function (...args) {
  const target = args[0];
  log('socket', typeof target === 'object' ? `${target.host ?? ''}:${target.port ?? ''}` : String(target));
  process.nextTick(() => this.emit('error', new Error('Network blocked by integration test')));
  return this;
};
