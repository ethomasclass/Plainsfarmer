/* PROVE UP! family console */
'use strict';
let DATA = null, me = null, game = null, joinInfo = null, brush = 'wheat', localPlots = null, lastFx = '';
let pickedFam = null;
const params = new URLSearchParams(location.search);
const ROOM = (params.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '');
const fidKey = 'proveup-fid-' + (ROOM || 'offline');
const OFF_PREFIX = 'proveup-offline-';
const offKey = code => OFF_PREFIX + (code || 'practice');
let OFFLINE_KEY = null;
// Remember which family this computer played, so a group gets straight back in another day.
const getFid = () => store.get(fidKey) || local.get(fidKey);
const setFid = id => { store.set(fidKey, id); local.set(fidKey, id); };
const clearFid = () => { store.del(fidKey); local.del(fidKey); };

Net.on('data', m => { DATA = m.data; });
Net.on('joininfo', m => { joinInfo = m; me = null; renderJoin(); });
Net.on('joined', m => { setFid(m.fid); const s = OFFLINE_KEY && local.get(OFFLINE_KEY); if (!ROOM && s) { s.fid = m.fid; local.set(OFFLINE_KEY, s); } });
Net.on('kicked', () => { clearFid(); me = null; toast('Your teacher started a new game. Join again.'); });
Net.on('error', m => toast(m.msg));
Net.on('netError', m => { if (!me && m.kind === 'noroom') renderConnecting(`We can't find a game with the code <b>${esc(ROOM)}</b> yet. Check the code on the board. We'll keep trying...`); else if (!me && m.kind === 'server') renderConnecting('Having trouble connecting. If this keeps happening, ask your teacher about No-Connection Mode.'); });
Net.on('state', m => { game = m.game; me = m.me; if (me) setFid(me.id); render(); });

const famData = () => DATA.FAMILIES.find(f => f.key === me.fam);
const selfPaced = () => game && game.mode === 'self';

function hideGame() {
  $('#app').style.gridTemplateRows = '1fr';
  $('#topbar').classList.add('hidden');
  $('#farmWrap').classList.add('hidden');
  $('#main').style.gridTemplateColumns = '1fr';
}
const titleBlock = `<img class="emblem" src="assets/brand/emblem.webp" alt=""><h2 style="font-size:clamp(20px,4vh,44px)">PROVE UP!</h2>
  <p style="font-size:1.2em">Farming the Great Plains, 1884 to 1888</p>`;

// ------------------------------------------------------------ start
if (ROOM) {
  renderConnecting('Connecting to your class game...');
  Net.start(() => ({ t: 'hello', role: 'player', fid: getFid() }), PeerClientTransport(ROOM));
} else renderStart();

function renderConnecting(msg) {
  hideGame();
  $('#panel').innerHTML = `<div class="join">${titleBlock}<div class="waiting">${msg}</div>
    <p style="font-size:.85em">Game code: <b>${esc(ROOM)}</b> · <a href="play.html">Use a different code</a></p></div>`;
}

function offlineSaves() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(OFF_PREFIX)) continue;
      const v = local.get(k);
      if (v && v.game && v.game.families.length && v.game.phase !== 'end') out.push(Object.assign({ key: k }, v));
    }
  } catch (e) {}
  return out;
}
function saveLabel(v) {
  const f = v.game.families.find(x => x.id === v.fid) || v.game.families[0];
  const fam = Engine.DATA.FAMILIES.find(x => x.key === f.fam);
  const when = f.phase === 'setup' ? 'setting up' : f.phase === 'end' ? 'finished' : `${SEASON[f.phase]} ${Engine.CONFIG.startYear + f.year - 1}`;
  return `${esc(f.group)} · ${esc(fam.name)}<br><small>${v.code ? 'Class code ' + esc(v.code) : 'Practice game'} · ${when}</small>`;
}

function renderStart() {
  hideGame();
  const saves = offlineSaves();
  $('#panel').innerHTML = `<div class="join">${titleBlock}
    <p>Your group is a family moving west to claim land under the <b>Homestead Act</b>.
       Live on your claim for 5 years and the land is yours. Can your family make it?</p>
    <input id="code" maxlength="6" placeholder="Type the code on the board" autocomplete="off" style="text-transform:uppercase">
    <button class="bigbtn" id="goBtn">Join</button>
    ${saves.length ? `<p style="margin-top:1vh"><b>Pick up where you left off:</b></p>
      <div class="rejoin">${saves.map((v, i) => `<button data-resume="${i}">${saveLabel(v)}</button>`).join('')}</div>` : ''}
    <button class="bigbtn grey" id="soloBtn">Practice on My Own</button></div>`;
  const go = () => {
    const v = $('#code').value.trim().toUpperCase();
    if (/^[A-Z]{5}$/.test(v)) location.search = '?room=' + v;
    else if (/^\d{4}$/.test(v)) {
      const sv = local.get(offKey(v));
      if (sv && sv.game && sv.game.families.length && sv.game.phase !== 'end') { toast('Welcome back! Picking up where you left off.'); startOffline(v, sv); }
      else startOffline(v);
    }
    else toast('Codes are 5 letters (live game) or 4 numbers (no-connection game).');
  };
  $('#goBtn').onclick = go; $('#code').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#soloBtn').onclick = () => startOffline(null);
  document.querySelectorAll('[data-resume]').forEach(b => b.onclick = () => { const v = saves[+b.dataset.resume]; startOffline(v.code, v); });
  $('#code').focus();
}

// Offline: the whole game runs in this tab. A 4-digit code makes every group get the
// same chance cards as the board, unlocked with the word the teacher shows.
function startOffline(code, saved) {
  let game;
  OFFLINE_KEY = offKey(code);
  if (saved && saved.game) game = saved.game;
  else { local.del(OFFLINE_KEY); clearFid(); game = Engine.newGame(); game.mode = 'self'; game.phase = 'running'; }
  const host = new GameHost({ game, offline: { code }, onChange: g => { const s = local.get(OFFLINE_KEY) || {}; local.set(OFFLINE_KEY, { code, game: g, fid: s.fid }); } });
  if (saved && saved.fid) setFid(saved.fid);
  Net.start(() => ({ t: 'hello', role: 'player', fid: getFid() }), LocalTransport(host, 'me', code ? 'class code ' + code : 'practice mode'));
}

// ------------------------------------------------------------ join screen
function renderJoin() {
  hideGame();
  const fams = (joinInfo && joinInfo.families) || [];
  const famName = k => (DATA ? DATA.FAMILIES.find(f => f.key === k).name : k);
  const offline = joinInfo && joinInfo.offline;
  const picker = offline && DATA ? `<p><b>Which family is your group?</b> (Your teacher may assign one.)</p>
    <div class="choices">${DATA.FAMILIES.map(f => `<button class="opt withart${pickedFam === f.key ? ' on' : ''}" data-fam="${f.key}"><img class="optart round" src="${portrait(f.key, 'hopeful')}" alt=""><span class="opttext"><b>${esc(f.name)}</b>${esc(f.tag)}</span></button>`).join('')}</div>` : '';
  $('#panel').innerHTML = `
    <div class="join">${titleBlock}
      ${joinInfo && joinInfo.canJoin ? `${picker}
        <input id="group" maxlength="24" placeholder="Your group name (example: Table 3)">
        <button class="bigbtn" id="joinBtn" ${offline && !pickedFam ? 'disabled' : ''}>Join the Game</button>` :
        (fams.length ? `<div class="waiting">Welcome back! Your class game is already going.</div>` : `<div class="waiting">The game has already started.</div>`)}
      ${fams.length && !offline ? `<p style="margin-top:1vh"><b>Already joined?</b> Pick your family to get back in:</p>
        <div class="rejoin">${fams.map(f => `<button data-fid="${f.id}">${esc(f.group)}<br><small>${esc(famName(f.fam))}</small></button>`).join('')}</div>` : ''}
    </div>`;
  const btn = $('#joinBtn');
  if (btn) {
    const go = () => { if (btn.disabled) return; btn.disabled = true; Net.send({ t: 'join', group: $('#group').value, famKey: pickedFam }); };
    btn.onclick = go; $('#group').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  document.querySelectorAll('[data-fam]').forEach(b => b.onclick = () => {
    pickedFam = b.dataset.fam; const g = $('#group').value; renderJoin(); $('#group').value = g;
  });
  document.querySelectorAll('.rejoin button').forEach(b => b.onclick = () => Net.send({ t: 'join', fid: b.dataset.fid }));
}

// ------------------------------------------------------------ main render
function render() {
  if (!me || !DATA) return;
  $('#app').style.gridTemplateRows = '';
  $('#topbar').classList.remove('hidden');
  $('#farmWrap').classList.remove('hidden');
  $('#main').style.gridTemplateColumns = '';
  const fd = famData();
  $('#who').innerHTML = `<img class="avatar" src="${portrait(me.fam, moodOf(me))}" alt=""><span>${esc(fd.name)}<small>${esc(me.group)} · ${esc(fd.tag)}</small></span>`;
  const sIcon = { spring: 'spring', summer: 'summer', fall: 'fall', winter: 'winter' }[me.phase];
  $('#season').innerHTML = (sIcon ? icon(sIcon) : '') + (me.phase === 'lobby' || me.phase === 'setup' ? SEASON[me.phase] : me.phase === 'end' ? 'Game Over' : `${SEASON[me.phase]} ${me.calYear} · Year ${me.year} of 5`);
  $('#money').innerHTML = `<div class="coin">${icon('cash')}<b>${money(me.cash)}</b></div><div class="coin debt">${icon('debt')}<b>${money(me.loan)}</b></div>`;
  renderFarm();
  const P = { lobby: pLobby, setup: pSetup, spring: pSpring, summer: pSummer, fall: pFall, winter: pWinter, end: pEnd }[me.phase];
  $('#panel').innerHTML = P ? P() : '';
  wire();
}

function renderFarm() {
  const fd = famData();
  const wrap = $('#farmWrap');
  const bg = backdropFor(me), ending = me.phase === 'end';
  if (wrap.dataset.bg !== bg + ending) {
    wrap.style.backgroundImage = ending ? `url("${bg}")` : '';
    $('#yard').style.backgroundImage = ending ? 'none' : `url("${bg}")`;
    wrap.dataset.bg = bg + ending;
  }
  wrap.classList.toggle('ending', ending);
  const cid = me.card && me.card.id;
  wrap.dataset.ground = me.phase === 'winter' || (me.phase === 'summer' && (cid === 'killingwinter' || cid === 'childrensblizzard')) ? 'snow'
    : me.phase === 'fall' ? 'fall' : me.phase === 'summer' && (cid === 'drought' || cid === 'locusts') ? 'dry'
    : me.phase === 'summer' && cid === 'fire' ? 'burnt' : 'grass';
  $('#yard').innerHTML = yardHTML(me, fd.name);
  $('#fence').classList.toggle('hidden', !me.setup.wire);
  const painting = me.phase === 'spring' && !me.springLocked;
  if (!painting) localPlots = null;
  const view = painting && localPlots ? Object.assign({}, me, { plots: localPlots }) : me;
  const showMult = (me.phase === 'summer' || me.phase === 'fall') ? me.mult : null;
  $('#farm').innerHTML = farmHTML(view, { paint: painting, mult: showMult, winter: me.phase === 'winter' });
  const fxKind = me.phase === 'summer' && me.card ? me.card.fx : '';
  if (fxKind !== lastFx) {
    const fx = fxHTML(fxKind); const el = $('#fx');
    el.className = fx.cls; el.innerHTML = fx.html; lastFx = fxKind;
  }
  if (painting) $('#farm').querySelectorAll('.tile.paintable').forEach(t => t.onclick = () => paint(+t.dataset.i));
}

function paint(i) {
  const plots = (localPlots || me.plots).slice();
  plots[i] = brush === 'clear' ? null : (plots[i] === brush ? null : brush);
  const cost = plots.reduce((s, p) => s + (p ? DATA.CROPS[p].cost : 0), 0);
  if (cost > me.cash) return toast('Not enough money to plant that.');
  localPlots = plots;
  Net.send({ t: 'plots', plots });
  renderFarm(); updateTally();
}

const waitMsg = (txt, ic = 'wait') => `<div class="waiting">${icon(ic)}<span>${txt}</span></div>`;
const teacherWait = 'Locked in! Waiting for your teacher to move to the next season...';
const lockedWait = () => waitMsg(teacherWait, 'lock');

// ------------------------------------------------------------ phases
function pLobby() {
  const fd = famData();
  return `<h2>Meet Your Family</h2>${famCard(fd)}
    <div class="grow"></div>${waitMsg('Waiting for your teacher to start the game...')}`;
}
function famCard(fd) {
  return `<div class="famcard"><img class="famportrait" src="${portrait(fd.key, 'hopeful')}" alt=""><div class="tag">${esc(fd.tag.toUpperCase())}</div><h3>${esc(fd.name)}</h3>
    <p>${esc(fd.story)}</p><div class="trait"><b>${esc(fd.trait)}:</b> ${esc(fd.traitText)}</div>
    <p>Starting money: <b>${money(fd.cash)}</b>, including a <b>${money(DATA.CONFIG.loan)}</b> loan from the bank.</p></div>`;
}

function pSetup() {
  const S = DATA.SETUP, s = me.setup, fd = famData();
  const cost = setupCost(s), left = fd.cash - cost, locked = me.setupLocked;
  const OPT_ART = { west: 'sprites/sign-claim', east: 'icons/icon-train', sod: 'sprites/house-sod', lumber: 'sprites/house-lumber', dry: 'icons/icon-clear', windmill: 'sprites/windmill', wire: 'sprites/fence-wire' };
  const opt = (group, key, o, on) => `<button class="opt withart${on ? ' on' : ''}" data-set="${group}" data-val="${key}" ${locked ? 'disabled' : ''}>
      <img class="optart" src="${ART}console/${OPT_ART[key]}.webp" alt=""><span class="opttext"><span class="cost">${o.cost ? money(o.cost) : 'FREE'}</span><b>${esc(o.label)}</b>${esc(o.desc)}</span></button>`;
  return `<h2>Set Up Your Homestead</h2>
    <div class="choice-group"><div class="label">1. Where will you farm?</div><div class="choices">
      ${Object.entries(S.location).map(([k, o]) => opt('location', k, o, s.location === k)).join('')}</div></div>
    <div class="choice-group"><div class="label">2. What kind of house?</div><div class="choices">
      ${Object.entries(S.house).map(([k, o]) => opt('house', k, o, s.house === k)).join('')}</div></div>
    <div class="choice-group"><div class="label">3. Extras (pick any you can afford)</div><div class="choices three">
      ${Object.entries(S.extras).map(([k, o]) => opt('extra', k, o, !!s[k])).join('')}</div></div>
    <div class="tally"><span>Setup costs: ${money(cost)}</span><span>Left for planting: <span style="color:${left < DATA.CONFIG.minPlantMoney ? 'var(--bad)' : 'var(--good)'}">${money(left)}</span></span></div>
    ${left < DATA.CONFIG.minPlantMoney ? `<p style="color:var(--bad);font-weight:800">Careful! Save at least ${money(DATA.CONFIG.minPlantMoney)} so you can plant your fields.</p>` : ''}
    <div class="grow"></div>
    ${locked ? lockedWait() : `<button class="bigbtn" data-act="lock">Lock In My Homestead</button>`}`;
}
function setupCost(s) {
  const S = DATA.SETUP; let c = S.location[s.location].cost + S.house[s.house].cost;
  for (const k in S.extras) if (s[k]) c += S.extras[k].cost; return c;
}

function pSpring() {
  const C = DATA.CROPS, locked = me.springLocked;
  const b = (k, o) => `<button class="brush${brush === k ? ' on' : ''}" data-brush="${k}" ${locked ? 'disabled' : ''}>${icon(CROP_ICON[k])}${o.name}<br><small>${money(o.cost)} to plant</small></button>`;
  return `<h2>Spring ${me.calYear}: Plant Your Fields</h2>
    <p>Pick a crop, then click plots on your farm to plant it. Each plot is 10 acres. You pay to plant now and sell in the fall.</p>
    ${me.sick ? `<p style="color:var(--bad);font-weight:800">Your family is still sick from last winter, so ${me.sick} plots can't be worked this year.</p>` : ''}
    <div class="brushes">${Object.entries(C).map(([k, o]) => b(k, o)).join('')}
      <button class="brush${brush === 'clear' ? ' on' : ''}" data-brush="clear" ${locked ? 'disabled' : ''}>${icon('clear')}Clear<br><small>remove</small></button></div>
    <p style="font-size:.85em">Usual selling price per plot: ${Object.values(C).map(o => `${o.name} ${money(o.base)}`).join(', ')}. The weather and the market will change that.</p>
    <div class="tally" id="tally"></div>
    <div class="grow"></div>
    ${me.awaitUnlock ? unlockHTML() : locked ? (selfPaced() ? '' : lockedWait()) : `<button class="bigbtn" data-act="lock">Lock In My Planting</button>`}`;
}
function unlockHTML() {
  return `${waitMsg("Planting locked! Now look at the board. When your teacher shows this year's news, type the <b>unlock word</b>:", 'lock')}
    <div class="row"><input id="unlock" maxlength="12" autocomplete="off" placeholder="Unlock word" style="flex:1;font:inherit;font-size:1.2em;padding:1vh 1vw;border:3px solid #c9b089;border-radius:6px;text-transform:uppercase">
    <button class="bigbtn gold" id="unlockBtn">Reveal</button></div>`;
}
function updateTally() {
  const el = $('#tally'); if (!el) return;
  const plots = localPlots || me.plots;
  const open = me.tiles.filter(t => t === 'open').length, planted = plots.filter((p, i) => p && me.tiles[i] === 'open').length;
  const cost = me.springLocked ? 0 : plots.reduce((s, p) => s + (p ? DATA.CROPS[p].cost : 0), 0);
  el.innerHTML = `<span>Planted: ${planted} of ${open} plots</span><span>Cost: ${money(cost)}</span><span>Cash after: ${money(me.cash - cost)}</span>`;
}

function clipHTML(c) {
  return `<div class="clip"><img class="clipart" src="${cardArt(c.id)}" alt=""><div><div class="era">${esc(c.era)}</div><h3>${esc(c.headline)}</h3><p>${esc(c.text)}</p></div></div>
    ${c.why ? `<div class="why"><b>Think about it:</b> ${esc(c.why)}</div>` : ''}`;
}
function notesHTML(n) { return `<ul class="notes">${n.map(([k, t]) => `<li class="${k}">${esc(t)}</li>`).join('')}</ul>`; }
const lineIcon = l => l.crop ? icon(CROP_ICON[l.crop]) : /egg/i.test(l.label) ? icon('eggs') : /doctor/i.test(l.label) ? icon('doctor') : /burn/i.test(l.label) ? icon('fire') : icon('cash');

function pSummer() {
  const c = me.card;
  let land = '';
  if (c && c.choice === 'land') {
    land = me.landChoice ? `<div class="waiting">${me.landChoice === 'claim' ? 'You claimed the land. You will have 4 more plots next year.' : 'You passed on the land.'}</div>` :
      `<div class="row"><button class="bigbtn gold" data-land="1">Claim it ($100)</button><button class="bigbtn grey" data-land="0">Pass</button></div>`;
  }
  const needLand = c && c.choice === 'land' && !me.landChoice;
  return `<h2>Summer ${me.calYear}: News Arrives</h2>${clipHTML(c)}
    <h3>What it meant for your farm:</h3>${notesHTML(me.notes)}${land}
    <div class="grow"></div>${nextBtn(selfPaced() ? 'Bring In the Harvest' : 'Ready for Harvest', needLand)}`;
}

function pFall() {
  const h = me.harvest;
  const rows = h.lines.map(l => `<tr><td>${lineIcon(l)} ${esc(l.label)}</td><td class="${l.total < 0 ? 'neg' : ''}">${money(l.total)}</td></tr>`).join('');
  return `<h2>Fall ${me.calYear}: Harvest Time</h2>
    <p>You hauled your crops to the railroad and sold them. After <b>${esc(headTitle(me.card.headline))}</b>, here is what you earned:</p>
    <table class="ledger">${rows || '<tr><td>Nothing planted, nothing sold.</td><td>$0</td></tr>'}
      <tr class="total"><td>Money from the harvest</td><td>${money(h.total)}</td></tr>
      <tr><td>Minus what you spent planting this spring</td><td class="neg">${money(-h.plantCost)}</td></tr>
      <tr class="total"><td>Profit this year</td><td class="${h.profit < 0 ? 'neg' : 'pos'}">${money(h.profit)}</td></tr></table>
    <p>Cash in hand: <b>${money(me.cash)}</b>. Winter is coming, and the bank wants its money.</p>
    <div class="grow"></div>${nextBtn(selfPaced() ? 'On to Winter' : 'Ready for Winter')}`;
}

function pWinter() {
  const b = me.bill, o = me.options, last = me.year >= 5;
  const boneNote = me.log.some(l => l.startsWith(`Year ${me.year}: sold bison`)) ? `<div class="why bonesnote"><img src="${sceneArt('bones')}" alt=""><span><b>About the bones:</b> ${esc(DATA.BONES_NOTE)}</span></div>` : '';
  const table = `<table class="ledger">
      <tr><td>${icon('winter')} Food, fuel, and clothes for the winter</td><td>${money(b.living)}</td></tr>
      <tr><td>${icon('debt')} Interest on your ${money(me.loan)} loan${me.fam === 'obrien' ? " (half, veteran's credit)" : ''}</td><td>${money(b.interest)}</td></tr>
      ${b.extra ? `<tr><td>Higher interest this year</td><td>${money(b.extra)}</td></tr>` : ''}
      <tr class="total"><td>Total due</td><td>${money(b.total)}</td></tr></table>`;
  if (me.paid) {
    return `<h2>Winter ${me.calYear}: Bill Paid</h2>${table}
      <p>You paid the bank. Cash left: <b>${money(me.cash)}</b>.</p>${boneNote}
      ${last ? '<p>You have lived on your claim for 5 years. Time to see if you proved up!</p>' : ''}
      <div class="grow"></div>${nextBtn(selfPaced() ? (last ? 'See How It Ends' : `Start Spring ${me.calYear + 1}`) : 'Ready')}`;
  }
  const short = b.total - me.cash;
  let opts = '';
  if (short > 0) {
    opts = `<p style="color:var(--bad);font-weight:800">You are ${money(short)} short. What will your family do?</p><div class="choices">
      ${o.bones ? `<button class="opt withart" data-winter="bones">${icon('bones', 'optart')}<span class="opttext"><span class="cost">+${money(o.bones)}</span><b>Gather bison bones</b>Pick up bison bones on the prairie and sell them to a bone buyer.</span></button>` : ''}
      ${o.mortgage ? `<button class="opt withart" data-winter="mortgage">${icon('mortgage', 'optart')}<span class="opttext"><span class="cost">+${money(DATA.CONFIG.mortgageCash)}</span><b>Mortgage your animals and tools</b>Get ${money(DATA.CONFIG.mortgageCash)} now, but you will owe the bank ${money(DATA.CONFIG.mortgageDebt)} more.</span></button>` : ''}
      <button class="opt withart" data-winter="giveup">${icon('giveup', 'optart')}<span class="opttext"><b>Give up and go back east</b>Leave the claim behind and head home.</span></button>
      ${!o.bones && !o.mortgage ? `<button class="opt withart" data-winter="lose">${icon('lock', 'optart')}<span class="opttext"><b>Hand the farm to the bank</b>There is nothing left to sell.</span></button>` : ''}
    </div>${boneNote}`;
  }
  return `<h2>Winter ${me.calYear}: The Bank Comes Calling</h2>${table}
    <p>Cash in hand: <b>${money(me.cash)}</b></p>${opts}
    <div class="grow"></div><button class="bigbtn" data-winter="pay" ${short > 0 ? 'disabled' : ''}>Pay the Bank ${money(b.total)}</button>`;
}

function pEnd() {
  const F = DATA.FATES[me.fate] || DATA.FATES.proved;
  const tone = me.fate === 'debtfree' ? 'good' : me.fate === 'proved' ? 'mid' : 'bad';
  const hist = me.history.map(h => {
    const c = DATA.CARDS.find(x => x.id === h.card);
    return `<tr><td>${DATA.CONFIG.startYear + h.year - 1}: ${esc(c ? headTitle(c.headline) : '')}</td><td class="${h.profit < 0 ? 'neg' : 'pos'}">${money(h.profit)}</td></tr>`;
  }).join('');
  return `<div class="fate ${tone}"><div class="stampimg"><img src="${ART}console/stamps/stamp-${me.fate || 'proved'}.webp" alt=""><span>${esc(F.title)}</span></div><p>${esc(F.text)}</p>
    <table class="ledger" style="max-width:95%">${hist}<tr class="total"><td>Final cash / still owed to bank</td><td>${money(me.cash)} / ${money(me.loan)}</td></tr></table>
    ${ROOM || (me.gated) ? waitMsg('Look up at the board for the class results.') : ''}
    ${ROOM ? '' : `<button class="bigbtn grey" id="againBtn">Play Again</button>`}</div>`;
}

function nextBtn(label, disabled) {
  if (!selfPaced() && me.ready) return lockedWait();
  return `<button class="bigbtn" data-act="lock" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

// ------------------------------------------------------------ events
function wire() {
  const ag = $('#againBtn');
  if (ag) ag.onclick = () => { if (OFFLINE_KEY) local.del(OFFLINE_KEY); clearFid(); location.href = 'play.html'; };
  const ub = $('#unlockBtn');
  if (ub) { const u = () => Net.send({ t: 'unlock', word: $('#unlock').value }); ub.onclick = u; $('#unlock').onkeydown = e => { if (e.key === 'Enter') u(); }; }
  document.querySelectorAll('[data-act="lock"]').forEach(b => b.onclick = () => { b.disabled = true; Net.send({ t: 'lock' }); });
  document.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
    const s = Object.assign({}, me.setup), g = b.dataset.set, v = b.dataset.val;
    if (g === 'extra') s[v] = !s[v]; else s[g] = v;
    if (setupCost(s) > famData().cash) return toast('You cannot afford that. Drop something else first.');
    me.setup = s; render(); Net.send({ t: 'setup', setup: s });
  });
  document.querySelectorAll('[data-brush]').forEach(b => b.onclick = () => { brush = b.dataset.brush; render(); });
  document.querySelectorAll('[data-land]').forEach(b => b.onclick = () => Net.send({ t: 'land', claim: b.dataset.land === '1' }));
  document.querySelectorAll('[data-winter]').forEach(b => b.onclick = () => {
    const w = b.dataset.winter;
    if ((w === 'giveup' || w === 'lose') && !b.dataset.sure) { b.dataset.sure = 1; b.querySelector('b').textContent = 'Click again to confirm'; return; }
    Net.send({ t: 'winter', which: w });
  });
  updateTally();
}
