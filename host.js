/* PROVE UP! game host.
   Runs the whole game inside a browser tab (the teacher board, or a student's
   own tab in offline mode). Transports call connect / receive / disconnect. */
'use strict';
const MAX_FAMILIES = 12;

class GameHost {
  constructor(opts = {}) {
    this.E = window.Engine;
    this.game = opts.game || this.E.newGame();
    this.clients = new Map();          // id -> { send, role, fid }
    this.onChange = opts.onChange || (() => {});
    this.extra = opts.extra || (() => ({}));
    this.offline = opts.offline || null; // { code } for offline class games
  }

  connect(id, send) { this.clients.set(id, { send, role: null, fid: null }); }
  disconnect(id, send) {
    const c = this.clients.get(id);
    if (c && (!send || c.send === send)) { this.clients.delete(id); this.broadcast(); }
  }
  fam(id) { return this.game.families.find(f => f.id === id); }

  readyOf(f) {
    if (f.fate) return true;
    switch (f.phase) {
      case 'setup': return f.setupLocked;
      case 'spring': return f.springLocked;
      case 'summer': case 'fall': return !!f.ready;
      case 'winter': return f.paid;
      default: return false;
    }
  }

  view(f) {
    return Object.assign(this.E.familyView(f), {
      ready: this.readyOf(f), awaitUnlock: !!f.awaitUnlock, gated: !!f.gated,
      connected: [...this.clients.values()].some(c => c.fid === f.id),
    });
  }

  broadcast() {
    const pub = this.E.publicGame(this.game, this.extra());
    let all = null;
    for (const [, c] of this.clients) {
      if (c.role === 'board') { all = all || this.game.families.map(f => this.view(f)); c.send({ t: 'state', game: pub, families: all }); }
      else if (c.role === 'player' && c.fid) {
        const f = this.fam(c.fid);
        if (f) c.send({ t: 'state', game: pub, me: this.view(f) });
        else { c.fid = null; c.send({ t: 'kicked' }); this.sendJoinInfo(c); }
      }
    }
    this.onChange(this.game);
  }

  canJoinNew() {
    const g = this.game;
    return (g.phase === 'lobby' || g.phase === 'setup' || (g.mode === 'self' && g.phase === 'running')) && g.families.length < MAX_FAMILIES;
  }
  sendJoinInfo(c) {
    c.send({ t: 'joininfo', canJoin: this.canJoinNew(), offline: !!this.offline,
      families: this.game.families.map(f => ({ id: f.id, group: f.group, fam: f.fam })) });
  }

  advanceAll() {
    const g = this.game, E = this.E, p = g.phase;
    if (p === 'lobby') {
      g.phase = g.mode === 'self' ? 'running' : 'setup';
      g.families.forEach(f => { f.phase = 'setup'; });
      return;
    }
    if (g.mode === 'self') return;
    let card = null;
    if (p === 'spring') { card = E.drawCard(g.deck, g.year); g.card = card; }
    for (const f of g.families) if (!f.fate) { E.advanceFamily(f, card); f.ready = false; }
    if (p === 'setup') g.phase = 'spring';
    else if (p === 'spring') g.phase = 'summer';
    else if (p === 'summer') g.phase = 'fall';
    else if (p === 'fall') g.phase = 'winter';
    else if (p === 'winter') {
      g.card = null;
      if (g.year >= E.CONFIG.years || !g.families.some(f => !f.fate)) { g.phase = 'end'; g.families.forEach(f => { f.phase = 'end'; }); }
      else { g.year++; g.phase = 'spring'; }
    }
  }

  checkSelfEnd() {
    const g = this.game;
    if (g.mode === 'self' && g.phase === 'running' && g.families.length && g.families.every(f => f.phase === 'end')) g.phase = 'end';
  }

  newId() { return Math.random().toString(36).slice(2, 10); }

  receive(id, m) {
    const c = this.clients.get(id); if (!c || !m || typeof m !== 'object') return;
    const E = this.E, g = this.game;
    if (m.t === 'ping') return c.send({ t: 'pong' });

    if (m.t === 'hello') {
      c.send({ t: 'data', data: E.DATA });
      if (m.role === 'board' && id === 'board') { c.role = 'board'; return this.broadcast(); }
      c.role = 'player';
      if (m.fid && this.fam(m.fid)) { c.fid = m.fid; return this.broadcast(); }
      return this.sendJoinInfo(c);
    }

    if (c.role === 'board') {
      if (m.t === 'mode' && g.phase === 'lobby') g.mode = m.mode === 'self' ? 'self' : 'teacher';
      else if (m.t === 'advance') this.advanceAll();
      else if (m.t === 'remove') g.families = g.families.filter(f => f.id !== m.fid);
      this.checkSelfEnd();
      return this.broadcast();
    }
    if (c.role !== 'player') return;

    if (m.t === 'join') {
      if (m.fid && this.fam(m.fid)) { c.fid = m.fid; return this.broadcast(); }
      if (!this.canJoinNew()) return c.send({ t: 'error', msg: 'The game has already started. Pick your family from the list to rejoin.' });
      const group = String(m.group || '').trim().slice(0, 24) || `Group ${g.families.length + 1}`;
      let idx = g.joinCount++;
      if (m.famKey) { const k = E.DATA.FAMILIES.findIndex(x => x.key === m.famKey); if (k >= 0) idx = k; }
      const f = E.newFamily(this.newId(), group, idx);
      if (g.phase !== 'lobby') f.phase = 'setup';
      if (this.offline) { f.gated = !!this.offline.code; if (this.offline.code) f.deck = E.newDeck(this.offline.code); }
      g.families.push(f); c.fid = f.id;
      c.send({ t: 'joined', fid: f.id });
      return this.broadcast();
    }

    const f = this.fam(c.fid); if (!f) return;
    let err = null;
    const self = g.mode === 'self';
    switch (m.t) {
      case 'setup': err = E.setSetup(f, m.setup || {}); break;
      case 'plots': err = E.setPlots(f, m.plots || []); break;
      case 'land': err = E.chooseLand(f, !!m.claim); break;
      case 'winter': err = E.winterAction(f, m.which); break;
      case 'unlock':
        if (f.phase === 'spring' && f.awaitUnlock) {
          const want = E.unlockWord(this.offline.code, f.year);
          if (String(m.word || '').trim().toUpperCase() === want) { f.awaitUnlock = false; E.advanceFamily(f); }
          else err = 'That is not the word on the board. Check the spelling and try again.';
        }
        break;
      case 'lock':
        if (f.phase === 'setup') { E.lockSetup(f); if (self) E.advanceFamily(f); }
        else if (f.phase === 'spring') {
          E.lockSpring(f);
          if (f.gated) f.awaitUnlock = true; else if (self) E.advanceFamily(f);
        }
        else if (f.phase === 'summer' || f.phase === 'fall') { if (self) E.advanceFamily(f); else f.ready = true; }
        else if (f.phase === 'winter') { if (!f.paid && !f.fate) err = 'Pay the bank first.'; else if (self) E.advanceFamily(f); }
        break;
    }
    if (err) c.send({ t: 'error', msg: err });
    this.checkSelfEnd();
    this.broadcast();
  }
}
window.GameHost = GameHost;
