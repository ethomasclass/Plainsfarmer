/* PROVE UP! shared browser code: connection, helpers, farm drawing */
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const ICON = { wheat: '🌾', corn: '🌽', oats: '🌿', cattle: '🐄' };
const headTitle = s => String(s || '').toLowerCase().replace(/(^|[\s"(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const SEASON = { lobby: 'Getting Ready', setup: 'Setting Up', spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter', end: 'The End', running: 'In Progress' };

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
};

function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

const PEER_PREFIX = 'prairie-herald-proveup-v1-';
const PEER_OPTS = { debug: 1 };

// Net: one message bus for every page. The transport decides where messages go.
const Net = (() => {
  const handlers = {}, queue = [];
  let hello = () => null, transport = null;
  function setStatus(on, text) {
    let n = $('#net'); if (!n) { n = document.createElement('div'); n.id = 'net'; document.body.appendChild(n); }
    n.textContent = text || (on ? 'connected' : 'reconnecting...'); n.classList.toggle('off', !on);
  }
  const deliver = m => (handlers[m.t] || (() => {}))(m);
  setInterval(() => { if (transport && transport.ready && !transport.local) transport.send({ t: 'ping' }); }, 25000);
  return {
    on(t, fn) { handlers[t] = fn; },
    start(h, t) {
      hello = h; transport = t;
      t.open({ deliver, status: setStatus, onOpen: () => { const x = hello(); if (x) t.send(x); queue.splice(0).forEach(m => t.send(m)); } });
    },
    send(obj) { if (transport && transport.ready) transport.send(obj); else queue.push(obj); },
  };
})();

const clone = o => JSON.parse(JSON.stringify(o));

// Talks to a GameHost running in this same tab (teacher board, or offline play).
function LocalTransport(host, id, label) {
  return {
    ready: false, local: true,
    open(cb) {
      host.connect(id, m => { const c = clone(m); setTimeout(() => cb.deliver(c), 0); });
      this.ready = true; cb.status(true, label || 'offline mode'); cb.onOpen();
    },
    send(o) { host.receive(id, clone(o)); },
  };
}

// Student side of a live game: connects to the teacher board through PeerJS.
function PeerClientTransport(room) {
  return {
    ready: false, peer: null, conn: null, cb: null, timer: null,
    open(cb) {
      this.cb = cb;
      cb.status(false, 'connecting...');
      this.peer = new Peer(undefined, PEER_OPTS);
      this.peer.on('open', () => this.dial());
      this.peer.on('error', e => {
        if (e.type === 'peer-unavailable') { cb.status(false, 'looking for the game...'); cb.deliver({ t: 'netError', kind: 'noroom' }); this.redial(3000); }
        else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(e.type)) { cb.status(false, 'connection problem'); cb.deliver({ t: 'netError', kind: 'server', detail: e.type }); }
      });
      this.peer.on('disconnected', () => setTimeout(() => { try { if (!this.peer.destroyed) this.peer.reconnect(); } catch (x) {} }, 1500));
    },
    redial(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.dial(), ms); },
    dial() {
      clearTimeout(this.timer);
      if (this.conn && this.conn.open) return;
      if (this.peer.disconnected) { try { this.peer.reconnect(); } catch (x) {} return this.redial(2000); }
      const c = this.peer.connect(PEER_PREFIX + room, { reliable: true, serialization: 'json' });
      this.conn = c;
      c.on('open', () => { if (this.conn !== c) return; clearTimeout(this.timer); this.ready = true; this.cb.status(true); this.cb.deliver({ t: 'netOk' }); this.cb.onOpen(); });
      c.on('data', d => this.cb.deliver(d));
      c.on('close', () => { if (this.conn !== c) return; this.ready = false; this.cb.status(false, 'reconnecting...'); this.redial(1500); });
      c.on('error', () => {});
      this.timer = setTimeout(() => { if (!c.open && this.conn === c) { try { c.close(); } catch (x) {} this.conn = null; this.dial(); } }, 9000);
    },
    send(o) { if (this.conn && this.conn.open) this.conn.send(o); },
  };
}

// Teacher side of a live game: opens a PeerJS "room" and hands messages to the host.
function startPeerHost(room, host, onStatus) {
  const peer = new Peer(PEER_PREFIX + room, PEER_OPTS);
  peer.on('open', () => onStatus('ready'));
  peer.on('connection', conn => {
    const send = m => { try { conn.send(m); } catch (e) {} };
    conn.on('open', () => host.connect(conn.peer, send));
    conn.on('data', d => host.receive(conn.peer, d));
    conn.on('close', () => host.disconnect(conn.peer, send));
    conn.on('error', () => {});
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id') onStatus('taken');
    else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(e.type)) onStatus('error', e.type);
  });
  peer.on('disconnected', () => { onStatus('reconnecting'); setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (x) {} }, 2000); });
  window.addEventListener('beforeunload', () => { try { peer.destroy(); } catch (x) {} });
  return peer;
}

const local = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// Draw a farm grid. tiles = server tile status list, plots = crops.
function farmHTML(f, opts = {}) {
  return f.tiles.map((st, i) => {
    const crop = f.plots[i];
    let cls = st, label = '', icon = '';
    if (st === 'open' && crop) { cls = crop; icon = ICON[crop]; }
    else if (st === 'open') { label = opts.mini ? '' : (opts.paint ? 'Click to plant' : 'Empty'); }
    else if (st === 'sod') { icon = '🧱'; label = 'Cut sod for your house'; }
    else if (st === 'sick') { label = 'No one well enough to work this'; }
    else if (st === 'locked') { label = 'Not your land'; }
    let extra = '';
    if (opts.mult && crop && st === 'open') {
      const m = opts.mult[crop];
      if (m < 0.75) cls += ' damaged'; else if (m > 1.05) cls += ' boosted';
      if (Math.abs(m - 1) > 0.04 && !opts.mini) extra = `<span class="loss">${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%</span>`;
    }
    const paint = opts.paint && st === 'open' ? ' paintable' : '';
    return `<div class="tile ${cls}${paint}" data-i="${i}">${icon}${label ? `<small>${label}</small>` : ''}${extra}</div>`;
  }).join('');
}

function yardHTML(f, name) {
  const s = f.setup || {};
  const house = f.setupLocked || f.phase !== 'setup' ? (s.house === 'lumber' ? 'lumber-house' : 'sod-house') : (s.house === 'lumber' ? 'lumber-house' : 'sod-house');
  return `<div class="sprite ${house}" title="${s.house === 'lumber' ? 'Lumber house' : 'Sod house'}"></div>` +
    (s.windmill ? '<div class="sprite windmill" title="Windmill"><i></i></div>' : '') +
    `<div class="signpost">${esc(name)}<br>${s.location === 'east' ? 'Railroad land' : 'Free claim'}</div>`;
}

function fxHTML(kind) {
  if (!kind || kind === 'none' || kind === 'train') return { cls: '', html: '' };
  if (kind === 'sun' || kind === 'fire') return { cls: 'fx-' + kind, html: '' };
  const n = kind === 'bugs' ? 90 : 70;
  let h = '';
  for (let i = 0; i < n; i++) {
    const l = Math.random() * 100, d = (Math.random() * 2.5).toFixed(2), dur = (kind === 'snow' ? 3 + Math.random() * 3 : 0.6 + Math.random() * 0.5).toFixed(2);
    const top = kind === 'bugs' ? `top:${Math.random() * 95}%;` : '';
    h += `<i class="p" style="left:${l}%;${top}animation-delay:-${d}s;animation-duration:${kind === 'bugs' ? (0.6 + Math.random()).toFixed(2) : dur}s"></i>`;
  }
  return { cls: 'fx-' + kind, html: h };
}
