/* PROVE UP! class board (The Prairie Herald).
   This tab IS the game: it runs the host and opens a PeerJS room students join. */
'use strict';
const BOARD_KEY = 'proveup-board';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newRoom = () => Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
const BASE = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
let DATA = Engine.DATA, game = null, fams = [], host = null, room = null, peer = null, takenTries = 0, resetting = false;
const net = { state: 'connecting' };
let offline = null;

Net.on('data', m => { DATA = m.data; });
Net.on('error', m => toast(m.msg));
Net.on('state', m => { game = m.game; fams = m.families; render(); });


function startLive(sv) {
  room = sv ? sv.room : newRoom();
  let t = null;
  const save = () => { if (!resetting) local.set(BOARD_KEY, { room, game: host.game }); };
  host = new GameHost({
    game: sv ? sv.game : Engine.newGame(),
    extra: () => ({ room, joinUrl: BASE + 'play.html?room=' + room, net: net.state }),
    onChange: () => { clearTimeout(t); t = setTimeout(save, 300); },
  });
  window.addEventListener('beforeunload', save);
  Net.start(() => ({ t: 'hello', role: 'board' }), LocalTransport(host, 'board', 'teacher board'));
  connectPeer();
}

function connectPeer() {
  if (typeof Peer !== 'function') { net.state = 'error'; return host.broadcast(); }
  peer = startPeerHost(room, host, st => {
    net.state = st;
    if (st === 'taken') {
      // after a reload the old room can take a few seconds to free up
      if (++takenTries < 8) setTimeout(() => { try { peer.destroy(); } catch (e) {} connectPeer(); }, 4000);
      else net.state = 'taken-final';
    }
    if (st === 'ready') takenTries = 0;
    host.broadcast();
  });
}

const NET_TEXT = {
  connecting: ['Opening the room...', false], ready: ['Room open: students can join', true],
  reconnecting: ['Reconnecting to the connection service...', false], taken: ['Re-opening your saved room...', false],
  'taken-final': ['This game is open in another tab. Close that tab, or press New Game.', false],
  error: ["Can't reach the connection service from this network. Try No-Connection Mode.", false],
};
function netPill() {
  if (offline) return;
  const [txt, ok] = NET_TEXT[net.state] || NET_TEXT.connecting;
  let n = $('#net'); if (!n) { n = document.createElement('div'); n.id = 'net'; document.body.appendChild(n); }
  n.textContent = txt; n.classList.toggle('off', !ok);
}

const famName = k => DATA.FAMILIES.find(f => f.key === k).name;
const teacher = () => game.mode === 'teacher';

function render() {
  if (!DATA || !game) return;
  const p = game.phase;
  $('#dl-mid').textContent = p === 'lobby' ? 'Now Accepting Homesteaders' : p === 'end' ? 'Final Edition' :
    p === 'running' ? 'Self-Paced Game' : p === 'setup' ? 'Spring 1884' : `${SEASON[p]} ${game.calYear} · Year ${game.year} of 5`;
  $('#dl-right').textContent = teacher() ? 'Teacher-Paced' : 'Self-Paced';
  $('#lead').innerHTML = lead();
  renderFams();
  renderControls();
  wire();
  netPill();
}

function lead() {
  const p = game.phase;
  if (p === 'lobby') {
    const [txt, ok] = NET_TEXT[net.state] || NET_TEXT.connecting;
    return `<div class="kicker">Free land in the West!</div><h2 class="small">Join the Game</h2>
      <div class="joinbox"><div class="qr" id="qr"></div><div style="display:grid;gap:1.2vh">
        <div style="font-size:2.4vh">Scan the code, or go to <b>${esc(BASE.replace(/^https?:\/\//, ''))}play.html</b> and type:</div>
        <div class="roomcode">${esc(game.room)}</div>
        <div style="font-size:2vh;color:${ok ? '#2f7d32' : '#8a3b2b'};font-weight:700">${esc(txt)}</div>
        <button class="linkbtn" data-offline="1">${ok ? 'Network trouble? Use No-Connection Mode instead' : 'Switch to No-Connection Mode'}</button>
      </div></div>
      <div class="modebtns">
        <button data-mode="teacher" class="${teacher() ? 'on' : ''}"><b>Teacher-Paced</b>I draw one chance card for the whole class and reveal each season.</button>
        <button data-mode="self" class="${teacher() ? '' : 'on'}"><b>Self-Paced</b>Each family draws its own cards and plays at its own speed.</button>
      </div>`;
  }
  if (p === 'setup') return article('Spring 1884', 'Families Set Up Their Homesteads',
    'Under the Homestead Act, any family can claim 160 acres of western land. Live on it for 5 years and it is yours. First, choose where to farm, what house to build, and which tools to buy. Every choice is a bet on what the Plains will throw at you.', sceneArt('setup'));
  if (p === 'spring') return article(`Year ${game.year} of 5`, `Spring ${game.calYear}: Time to Plant`,
    'Plant your fields. Wheat, corn, oats, or cattle? Nobody knows what this year will bring. Spread your bets, or go all in?', sceneArt('spring'));
  if (p === 'summer' && game.card) {
    const c = game.card;
    return `<div class="kicker">${esc(c.era)}</div><h2 class="card">${esc(c.headline)}</h2><img class="leadart card" src="${cardArt(c.id)}" alt=""><div class="body">${esc(c.text)}</div>
      ${c.why ? `<div class="why"><b>Think about it:</b> ${esc(c.why)}</div>` : ''}
      <div class="body" style="font-size:2.2vh;font-style:italic">Check your farm to see how your choices held up.</div>`;
  }
  if (p === 'fall') {
    const rows = fams.filter(f => f.harvest).sort((a, b) => b.harvest.profit - a.harvest.profit)
      .map(f => `<tr><td>${esc(f.group)}</td><td>${esc(famName(f.fam))}</td><td>${money(f.harvest.total)}</td><td>${money(f.harvest.profit)}</td></tr>`).join('');
    return `<div class="kicker">After ${esc(game.card ? headTitle(game.card.headline) : 'a long summer')}</div>
      <h2 class="small">Harvest Report, Fall ${game.calYear}</h2><img class="leadart short" src="${sceneArt('fall')}" alt="">
      <table class="harvest-table"><tr><th>Group</th><th>Family</th><th>Sold for</th><th>Profit</th></tr>${rows}</table>`;
  }
  if (p === 'winter') {
    const lines = fams.map(f => `<li>${esc(f.group)}: ${f.fate ? esc(DATA.FATES[f.fate].title) : f.paid ? 'paid the bank' : f.cash >= f.bill.total ? 'deciding...' : '<b>short of money!</b>'}</li>`).join('');
    return `<div class="kicker">Year ${game.year} of 5</div><h2 class="small">Winter ${game.calYear}: The Bank Comes Calling</h2><img class="leadart short" src="${sceneArt('winter')}" alt="">
      <div class="body" style="font-size:2.6vh">Every family owes the bank for food, fuel, and interest on their loan. Families who come up short must make hard choices.</div>
      <ul style="font-size:2.4vh;margin:0">${lines}</ul>`;
  }
  if (p === 'running') {
    const lines = fams.map(f => `<li><b>${esc(f.group)}</b> (${f.phase === 'end' ? 'finished' : f.phase === 'setup' ? 'setting up' : `${SEASON[f.phase]} ${f.calYear}`}): ${f.card ? esc(headTitle(f.card.headline)) : '...'}</li>`).join('');
    return `<div class="kicker">1884 to 1888</div><h2 class="small">The Homestead Years</h2><img class="leadart short" src="${sceneArt('selfpaced')}" alt="">
      <div class="body" style="font-size:2.5vh">Families are playing at their own pace, and every family draws its own chance cards. Watch the county map to see how everyone is doing.</div>
      <ul style="font-size:2.2vh;margin:0;display:grid;gap:.6vh">${lines}</ul>`;
  }
  if (p === 'end') {
    const n = k => fams.filter(f => f.fate === k).length;
    return `<div class="kicker">Final Edition</div><h2 class="small">Who Proved Up?</h2><img class="leadart short" src="${sceneArt('end')}" alt="">
      <div class="tallyboard">${['debtfree', 'proved', 'foreclosed', 'east'].map(k => `<div><b>${n(k)}</b><span>${esc(DATA.FATES[k].title)}</span></div>`).join('')}</div>
      <div class="why">In real life, fewer than half of all homestead claims were ever proved up.</div>
      <ol><li>What decision hurt your family the most?</li><li>Who made money even when farmers failed?</li><li>Who paid the cost of your family getting this land?</li></ol>`;
  }
  return '';
}
function article(kicker, head, body, art) {
  return `<div class="kicker">${esc(kicker)}</div><h2 class="small">${esc(head)}</h2>${art ? `<img class="leadart" src="${art}" alt="">` : ''}<div class="body">${esc(body)}</div>`;
}

function renderFams() {
  const el = $('#fams');
  el.classList.toggle('many', fams.length > 6);
  $('#countyTitle').textContent = `The County Map: ${fams.length} ${fams.length === 1 ? 'family' : 'families'}`;
  el.innerHTML = fams.map(f => {
    let flag;
    if (f.fate) flag = `<span class="flag ${f.fate === 'proved' || f.fate === 'debtfree' ? 'ready' : 'gone'}">${esc(DATA.FATES[f.fate].title)}</span>`;
    else if (game.phase === 'lobby') flag = `<span class="flag ${f.connected ? 'ready' : 'wait'}">${f.connected ? 'Joined' : 'Offline'}</span>`;
    else if (!teacher()) flag = `<span class="flag wait">${f.phase === 'setup' ? 'Setting up' : `${SEASON[f.phase]} ${f.calYear}`}</span>`;
    else flag = `<span class="flag ${f.ready ? 'ready' : 'wait'}">${f.ready ? 'Ready' : 'Working'}</span>`;
    return `<div class="fbox ${f.fate === 'foreclosed' || f.fate === 'east' ? 'out' : ''}">
      ${game.phase === 'lobby' || f.phase === 'setup' ? `<img class="cameo" src="${cameo(f.fam)}" alt="">` : `<div class="mini">${farmHTML(f, { mini: true, mult: f.phase === 'summer' ? f.mult : null, winter: f.phase === 'winter' })}</div>`}
      <div><div class="nm">${esc(f.group)}</div><div class="sub">${esc(famName(f.fam))}</div>
      <div class="cash">Cash ${money(f.cash)} · Owes ${money(f.loan)}</div>${flag}</div>
      ${game.phase === 'lobby' ? `<button class="x" data-remove="${f.id}">remove</button>` : ''}</div>`;
  }).join('') || '<div style="font-size:2.4vh;font-style:italic">No families yet.</div>';
}

function renderControls() {
  const p = game.phase, adv = $('#advBtn');
  const active = fams.filter(f => !f.fate);
  const ready = active.filter(f => f.ready).length;
  let label = '', status = '';
  if (p === 'lobby') { label = teacher() ? 'Start: Set Up Homesteads' : 'Start Self-Paced Game'; status = `${fams.length} families joined`; }
  else if (!teacher()) { status = p === 'end' ? 'Everyone has finished.' : `${fams.filter(f => f.phase === 'end').length} of ${fams.length} families finished`; }
  else {
    status = p === 'end' ? 'Game over.' : `${ready} of ${active.length} families ready`;
    label = { setup: 'Begin Spring 1884', spring: 'Draw a Chance Card', summer: 'Reveal the Harvest', fall: 'Winter Arrives',
      winter: game.year >= 5 ? 'Final Results' : `Begin Spring ${game.calYear + 1}` }[p] || '';
  }
  if (p !== 'lobby' && net.state !== 'ready') status += ' · ' + (NET_TEXT[net.state] || NET_TEXT.connecting)[0];
  $('#status').textContent = status;
  adv.textContent = label; adv.classList.toggle('hidden', !label);
  adv.disabled = p === 'lobby' && !fams.length;
}

function wire() {
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => Net.send({ t: 'mode', mode: b.dataset.mode }));
  document.querySelectorAll('[data-offline]').forEach(b => b.onclick = goOffline);
  document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => Net.send({ t: 'remove', fid: b.dataset.remove }));
  const qr = $('#qr');
  if (qr) drawQR(qr, game.joinUrl);
}

$('#advBtn').onclick = () => {
  const b = $('#advBtn'); b.disabled = true; setTimeout(() => { b.disabled = false; }, 800);
  if (offline) offlineAdvance(); else Net.send({ t: 'advance' });
};
$('#resetBtn').onclick = () => {
  const b = $('#resetBtn');
  if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Click again to erase this game'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'New Game'; }, 4000); return; }
  resetting = true; local.del(BOARD_KEY);
  if (offline) local.set(BOARD_KEY, { offline: newOffline() });
  location.reload();
};

// =====================================================================
// NO-CONNECTION MODE
// Every group plays on its own computer with the same 4-digit class code, so
// everyone gets the same chance cards. The board reveals each year's card and an
// unlock word; groups type the word to see what happened to their farm.
// =====================================================================
function newOffline() {
  const code = String(1000 + Math.floor(Math.random() * 9000));
  return { code, phase: 'lobby', year: 1, deck: Engine.newDeck(code), card: null };
}
function goOffline() {
  resetting = true;
  local.set(BOARD_KEY, { offline: newOffline() });
  location.reload();
}
function goLive() { resetting = true; local.del(BOARD_KEY); location.reload(); }

function offlineAdvance() {
  const o = offline, E = Engine;
  if (o.phase === 'lobby') o.phase = 'setup';
  else if (o.phase === 'setup') o.phase = 'spring';
  else if (o.phase === 'spring') { o.card = E.drawCard(o.deck, o.year); o.phase = 'summer'; }
  else if (o.phase === 'summer') o.phase = 'fall';
  else if (o.phase === 'fall') o.phase = 'winter';
  else if (o.phase === 'winter') { o.card = null; if (o.year >= E.CONFIG.years) o.phase = 'end'; else { o.year++; o.phase = 'spring'; } }
  local.set(BOARD_KEY, { offline: o });
  renderOffline();
}

function renderOffline() {
  const o = offline, cal = Engine.CONFIG.startYear + o.year - 1, p = o.phase;
  $('#dl-mid').textContent = p === 'lobby' ? 'Now Accepting Homesteaders' : p === 'end' ? 'Final Edition' : p === 'setup' ? 'Spring 1884' : `${SEASON[p]} ${cal} · Year ${o.year} of 5`;
  $('#dl-right').textContent = 'No-Connection Mode';
  let lead = '';
  if (p === 'lobby') {
    lead = `<div class="kicker">Free land in the West!</div><h2 class="small">Join the Game</h2>
      <div class="joinbox"><div class="qr" id="qr"></div><div style="display:grid;gap:1.2vh">
        <div style="font-size:2.4vh">Scan the code, or go to <b>${esc(BASE.replace(/^https?:\/\//, ''))}play.html</b> and type the class code:</div>
        <div class="roomcode">${esc(o.code)}</div>
        <div style="font-size:2vh">Then pick your family and a group name.</div>
        <button class="linkbtn" data-live="1">Back to Live Mode</button></div></div>`;
  } else if (p === 'setup') lead = article('Spring 1884', 'Families Set Up Their Homesteads', 'Under the Homestead Act, any family can claim 160 acres of western land. Live on it for 5 years and it is yours. Choose where to farm, what house to build, and which tools to buy. Then lock in.', sceneArt('setup'));
  else if (p === 'spring') lead = article(`Year ${o.year} of 5`, `Spring ${cal}: Time to Plant`, 'Plant your fields and lock in. Then wait for the news from the Prairie Herald. Nobody knows what this year will bring.', sceneArt('spring'));
  else if (p === 'summer') {
    const c = Engine.CARD_BY_ID[o.card];
    lead = `<div class="kicker">${esc(c.era)}</div><h2 class="card">${esc(c.headline)}</h2><img class="leadart card" src="${cardArt(c.id)}" alt=""><div class="body">${esc(c.text)}</div>
      ${c.why ? `<div class="why"><b>Think about it:</b> ${esc(c.why)}</div>` : ''}
      <div class="unlockbox">Unlock word: <b>${esc(Engine.unlockWord(o.code, o.year))}</b></div>`;
  }
  else if (p === 'fall') lead = article(`Year ${o.year} of 5`, `Fall ${cal}: Harvest Time`, 'Haul your crops to the railroad and see what they sold for. Did your choices protect you this year?', sceneArt('fall'));
  else if (p === 'winter') lead = article(`Year ${o.year} of 5`, `Winter ${cal}: The Bank Comes Calling`, 'Every family owes the bank for food, fuel, and interest on their loan. Families who come up short must make hard choices. Pay up, then get ready for spring.', sceneArt('winter'));
  else if (p === 'end') lead = `<div class="kicker">Final Edition</div><h2 class="small">Who Proved Up?</h2><img class="leadart short" src="${sceneArt('end')}" alt="">
      <div class="body" style="font-size:2.6vh">Hold up your screen. Which stamp did your family get?</div>
      <div class="tallyboard">${['debtfree', 'proved', 'foreclosed', 'east'].map(k => `<div><span>${esc(DATA.FATES[k].title)}</span></div>`).join('')}</div>
      <div class="why">In real life, fewer than half of all homestead claims were ever proved up.</div>
      <ol><li>What decision hurt your family the most?</li><li>Who made money even when farmers failed?</li><li>Who paid the cost of your family getting this land?</li></ol>`;
  $('#lead').innerHTML = lead;
  $('#countyTitle').textContent = 'How This Works';
  $('#fams').className = 'howto';
  $('#fams').innerHTML = `<ol>
      <li>Each group plays on its own computer using class code <b>${esc(o.code)}</b>.</li>
      <li>Groups set up, plant, and <b>lock in</b>.</li>
      <li>You press <b>Draw a Chance Card</b>. Groups type the <b>unlock word</b> to see what happened to their farm.</li>
      <li>Groups finish their harvest and pay the bank on their own, then wait for next spring.</li>
    </ol><p>Everyone gets the same chance cards in the same order, so you can compare results out loud.</p>`;
  const label = { lobby: 'Start: Set Up Homesteads', setup: 'Begin Spring 1884', spring: 'Draw a Chance Card', summer: 'Harvest Time', fall: 'Winter Arrives',
    winter: o.year >= 5 ? 'Final Results' : `Begin Spring ${cal + 1}` }[p] || '';
  const adv = $('#advBtn'); adv.textContent = label; adv.classList.toggle('hidden', !label); adv.disabled = false;
  $('#status').textContent = 'No-Connection Mode · class code ' + o.code;
  const qr = $('#qr'); if (qr) drawQR(qr, BASE + 'play.html');
  document.querySelectorAll('[data-live]').forEach(b => b.onclick = goLive);
  const n = $('#net'); if (n) n.remove();
}

function drawQR(el, url) {
  if (typeof qrcode !== 'function') { el.textContent = 'QR unavailable'; return; }
  try { const q = qrcode(0, 'M'); q.addData(url); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  catch (e) { el.textContent = 'QR unavailable'; }
}

// ---------------------------------------------------------------- boot
Engine.DATA.CARDS.forEach(c => { const i = new Image(); i.src = cardArt(c.id); });
['setup', 'spring', 'fall', 'winter', 'end', 'selfpaced'].forEach(k => { const i = new Image(); i.src = sceneArt(k); });
const saved = local.get(BOARD_KEY);
if (saved && saved.offline) { offline = saved.offline; renderOffline(); }
else startLive(saved && saved.game && saved.game.phase !== 'end' ? saved : null);
