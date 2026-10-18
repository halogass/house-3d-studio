// Realtime transport for "explore together" (multiplayer).
// Supabase Realtime (broadcast + presence) when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set;
// otherwise a BroadcastChannel between tabs of the same browser, for local testing.
//
// API: const t = await connect({ room, me });   me = { id, name, color }
//   t.send(event, payload)            fire-and-forget to everyone else in the room
//   t.on(event, (payload, fromId) => …)
//   t.onPeers((peers) => …)           peers: Map id → { id, name, color } (excluding me)
//   t.kind                            'supabase' | 'local'
//   t.leave()

// Imported statically: a lazy chunk breaks when a tab opened before a redeploy asks for a hash that no longer exists
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const transportKind = URL && KEY ? 'supabase' : 'local';

export async function connect({ room, me }) {
  const handlers = new Map();
  let peersCb = () => {};
  const emit = (event, payload, from) => (handlers.get(event) || []).forEach(h => h(payload, from));
  const api = {
    kind: transportKind,
    on(event, h) { if (!handlers.has(event)) handlers.set(event, []); handlers.get(event).push(h); },
    onPeers(cb) { peersCb = cb; },
  };

  if (transportKind === 'supabase') {
    const client = createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 30 } } });
    const ch = client.channel('h3s-' + (typeof __PROJECT_NAME__ !== 'undefined' ? __PROJECT_NAME__ : 'house') + '-' + room, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => {
      if (payload.to && payload.to !== me.id) return;
      emit(payload.e, payload.d, payload.f);
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const peers = new Map();
      for (const [id, metas] of Object.entries(state)) if (id !== me.id && metas[0]) peers.set(id, metas[0]);
      peersCb(peers);
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Realtime server unreachable / server realtime tidak tersambung')), 12000);
      // supabase-js retries CHANNEL_ERROR on its own, so only give up after a few failures
      let fails = 0;
      ch.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); await ch.track({ id: me.id, name: me.name, color: me.color }); resolve(); return; }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[multi] realtime', status, err);
          if (++fails < 3) return;
          clearTimeout(timer); client.removeChannel(ch);
          reject(new Error('Realtime connection failed (' + status + (err?.message ? ': ' + err.message : '') + '). Try without ad-blocker / VPN or another network.'));
        }
      });
    });
    api.send = (e, d, to) => ch.send({ type: 'broadcast', event: 'm', payload: { e, d, f: me.id, to } });
    api.leave = () => { ch.untrack(); client.removeChannel(ch); };
    return api;
  }

  // Local fallback: tabs in this browser share a BroadcastChannel; presence via heartbeats
  const bc = new BroadcastChannel('h3s-' + room);
  const peers = new Map(), seen = new Map();
  const announce = () => bc.postMessage({ e: '_hello', d: me, f: me.id });
  bc.onmessage = ({ data }) => {
    if (data.f === me.id || (data.to && data.to !== me.id)) return;
    if (data.e === '_hello' || data.e === '_bye') {
      const had = peers.has(data.f);
      if (data.e === '_bye') { peers.delete(data.f); seen.delete(data.f); peersCb(new Map(peers)); return; }
      peers.set(data.f, data.d); seen.set(data.f, performance.now());
      if (!had) { announce(); peersCb(new Map(peers)); }
      return;
    }
    emit(data.e, data.d, data.f);
  };
  const beat = setInterval(() => {
    announce();
    const now = performance.now();
    let changed = false;
    for (const [id, t] of seen) if (now - t > 5000) { peers.delete(id); seen.delete(id); changed = true; }
    if (changed) peersCb(new Map(peers));
  }, 1500);
  announce();
  api.send = (e, d, to) => bc.postMessage({ e, d, f: me.id, to });
  api.leave = () => { bc.postMessage({ e: '_bye', f: me.id }); clearInterval(beat); bc.close(); };
  addEventListener('beforeunload', api.leave);
  return api;
}
