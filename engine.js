(function () {
'use strict';
// =====================================================================
// PROVE UP! Farming the Great Plains  -  game engine
// All numbers you might want to tune live in CONFIG, FAMILIES, SETUP,
// CROPS and CARDS below.
// =====================================================================

const CONFIG = {
  years: 5,
  startYear: 1884,
  loan: 600,            // bank loan every family starts with (already in their cash)
  living: 300,          // winter living costs
  interestRate: 0.10,   // interest due every winter on the loan
  westCropMult: 0.85,   // crops earn less on the drier free claims
  extraLandCost: 100,
  mortgageCash: 200,    // cash you get when you mortgage animals and tools
  mortgageDebt: 250,    // what that adds to your loan
  maxMortgages: 2,
  bones: [120, 80, 40], // bison bone money, shrinks each time (the bones run out)
  ownedPlots: 16,
  extraPlots: 4,
  minPlantMoney: 300,
};

const CROPS = {
  wheat:  { name: 'Wheat',  cost: 20, base: 54 },
  corn:   { name: 'Corn',   cost: 20, base: 46 },
  oats:   { name: 'Oats',   cost: 20, base: 39 },
  cattle: { name: 'Cattle', cost: 30, base: 52 },
};

const FAMILIES = [
  {
    key: 'freeman', name: 'The Freeman Family', tag: 'Exodusters', cash: 650,
    story: 'Ruth and Isaac Freeman were born into slavery in Kentucky. After Reconstruction ended, they joined thousands of Black families heading to Kansas for land, safety, and a fresh start. They plan to farm near the all-Black town of Nicodemus.',
    trait: 'Strong community',
    traitText: 'Neighbors in Nicodemus help each other at harvest. You earn +10% on every harvest.',
  },
  {
    key: 'larsen', name: 'The Larsen Family', tag: 'Norwegian immigrants', cash: 750,
    story: 'The Larsens sailed from Norway after hearing about free land in America. They speak very little English, but they have grown wheat their whole lives.',
    trait: 'Wheat farmers',
    traitText: 'They know wheat. Your wheat earns +20%.',
  },
  {
    key: 'obrien', name: "The O'Brien Family", tag: 'Union Army veteran', cash: 800,
    story: "Michael O'Brien fought for the Union in the Civil War. Now he is moving his wife and four kids from Pennsylvania to claim land out West.",
    trait: "Veteran's credit",
    traitText: 'His years in the Army count toward the 5 years on the claim, so the bank trusts him. You pay half the normal interest.',
  },
  {
    key: 'moore', name: 'Hattie Moore', tag: 'Widow homesteader', cash: 700,
    story: 'After her husband died in Ohio, Hattie Moore took her two children west. The Homestead Act let a woman who was the head of her family claim land on her own.',
    trait: 'Egg and butter money',
    traitText: 'Hattie sells eggs and butter in town. You get +$75 every fall, no matter what happens to the crops.',
  },
];

const SETUP = {
  location: {
    west: { label: 'Free homestead claim', cost: 0,
      desc: 'Claim 160 free acres out west. Less rain falls here, so crops earn 15% less.' },
    east: { label: 'Railroad land', cost: 300,
      desc: 'Buy land near the tracks, farther east. More rain, but it costs $300.' },
  },
  house: {
    sod: { label: 'Sod house', cost: 0,
      desc: 'Walls made of blocks of prairie dirt and grass. Free, warm, and it will not burn. Uses 1 plot of land.' },
    lumber: { label: 'Lumber house', cost: 200,
      desc: 'Wood shipped in by railroad. Costs $200 and lets in the cold, but keeps all your land open.' },
  },
  extras: {
    dry: { label: 'Dry farming tools', cost: 150,
      desc: 'A deep plow and seed drill that plant seeds deep where the soil stays wet. Helps in a drought.' },
    windmill: { label: 'Windmill and well', cost: 150,
      desc: 'Pumps water up from deep underground for your family and animals.' },
    wire: { label: 'Barbed wire', cost: 100,
      desc: 'Fence in your own land and cattle. Invented by Joseph Glidden in 1874.' },
  },
};

const FATES = {
  debtfree:   { title: 'Proved Up and Debt-Free', text: 'You lived on the land for 5 years and paid off the bank. The farm is yours, free and clear. Very few families managed this.' },
  proved:     { title: 'Proved Up, but Still in Debt', text: 'You lived on the land for 5 years, so the claim is yours. But you still owe the bank, and one bad year could take it all away.' },
  foreclosed: { title: 'The Bank Took the Farm', text: 'You could not pay the bank. The bank took your land, your animals, and your tools. Many families ended up working land they did not own.' },
  east:       { title: 'Went Back East', text: 'You gave up on the claim and headed home. Some wagons came back with a sign: "In God we trusted, in Kansas we busted."' },
};

const BONES_NOTE = 'Hide hunters killed millions of bison in the 1870s and 1880s, many shot from trains. The Plains nations depended on these herds for food, clothing, and shelter. Settlers gathered the bones left behind and sold them by the ton to be ground into fertilizer.';

// ---------------------------------------------------------------- cards
function eff() {
  return { mult: { wheat: 1, corn: 1, oats: 1, cattle: 1 }, cost: 0, costLabel: '', sick: 0, interest: 0, notes: [] };
}
const count = (f, crop) => f.plots.filter(p => p === crop).length;
const hasCattle = f => count(f, 'cattle') > 0;
function setCrops(e, m) { e.mult.wheat = e.mult.corn = e.mult.oats = m; }
function houseCold(f, e, doctor) {
  if (f.setup.house === 'lumber') {
    e.sick = 3;
    e.notes.push(['bad', 'Your drafty lumber house could not keep out the cold. Your family got sick, so next spring you will have 3 fewer plots you can work.']);
    if (doctor) { e.cost += doctor; e.costLabel = 'Doctor bills'; e.notes.push(['bad', `Doctor bills cost $${doctor}.`]); }
  } else {
    e.notes.push(['good', 'Your thick sod walls kept your family warm and safe.']);
  }
}

const CARDS = [
  { id: 'rain', fx: 'rain', headline: 'GOOD RAINS BLESS THE PRAIRIE', era: 'A lucky year',
    text: 'Steady rains soak the Plains all spring and summer. For once, the "Great American Desert" looks like a garden.',
    effect() { const e = eff(); setCrops(e, 1.3); e.mult.cattle = 1.1; e.notes.push(['good', 'Plenty of rain. Every crop did well.']); return e; } },

  { id: 'drought', fx: 'sun', headline: 'DROUGHT GRIPS THE PLAINS', era: 'Based on the dry years that began in 1887',
    text: 'Weeks pass with no rain. The ground cracks open and the wheat turns brown in the field.',
    effect(f) {
      const e = eff(); let m = 0.55;
      if (f.setup.location === 'west') { m *= 0.75; e.notes.push(['bad', 'Out west, the drought hit even harder.']); }
      else e.notes.push(['ok', 'Farther east, a little more rain fell.']);
      if (f.setup.dry) { m += 0.25; e.notes.push(['good', 'Dry farming paid off. Your deep seeds found wet soil.']); }
      else e.notes.push(['bad', 'Without dry farming tools, your seeds dried out.']);
      setCrops(e, m);
      if (f.setup.windmill) e.notes.push(['good', 'Your windmill kept water flowing to your family and animals.']);
      else { e.mult.cattle = 0.7; if (hasCattle(f)) e.notes.push(['bad', 'With no well, your cattle went thirsty.']); }
      return e;
    } },

  { id: 'locusts', fx: 'bugs', headline: 'GRASSHOPPERS DEVOUR THE CROPS', era: 'Based on the locust years, 1874 to 1877',
    text: 'A cloud of grasshoppers blocks out the sun. They eat the crops, the laundry on the line, and even the wooden handles of tools.',
    effect(f) { const e = eff(); setCrops(e, 0.2); e.notes.push(['bad', 'Your fields were stripped bare.']);
      if (hasCattle(f)) e.notes.push(['good', 'The grasshoppers left your cattle alone.']); return e; } },

  { id: 'killingwinter', fx: 'snow', headline: 'KILLING WINTER ON THE RANGE', era: 'Based on the winter of 1886 to 1887',
    text: 'Blizzard after blizzard buries the Plains. Cattle freeze where they stand. The great cattle ranches lose most of their herds.',
    effect(f) { const e = eff();
      if (f.setup.wire) { e.mult.cattle = 0.6; if (hasCattle(f)) e.notes.push(['ok', 'Your fenced cattle stayed close to home, and some survived.']); }
      else { e.mult.cattle = 0.2; if (hasCattle(f)) e.notes.push(['bad', 'Your cattle wandered off in the storms and froze.']); }
      houseCold(f, e); return e; } },

  { id: 'childrensblizzard', fx: 'snow', headline: "THE CHILDREN'S BLIZZARD", era: 'Based on January 12, 1888',
    text: 'A warm morning turns deadly in minutes. A blizzard catches children walking home from school. More than 200 people die across the Plains.',
    effect(f) { const e = eff(); e.mult.cattle = 0.6;
      if (hasCattle(f)) e.notes.push(['bad', 'Some of your cattle died in the storm.']);
      houseCold(f, e, 50); return e; } },

  { id: 'fire', fx: 'fire', headline: 'PRAIRIE FIRE SWEEPS THE COUNTY', era: 'A constant danger on the Plains',
    text: 'Dry grass catches fire. The wind pushes a wall of flame across the prairie faster than a horse can run.',
    effect(f) { const e = eff(); setCrops(e, 0.7); e.mult.cattle = 0.9; e.notes.push(['bad', 'Part of your fields burned.']);
      if (f.setup.house === 'lumber') { e.cost += 150; e.costLabel = 'Rebuild burned house'; e.notes.push(['bad', 'Your lumber house burned down. Rebuilding costs $150.']); }
      else e.notes.push(['good', 'Dirt does not burn. Your sod house survived.']);
      return e; } },

  { id: 'wheatcrash', fx: 'none', headline: 'WHEAT PRICES CRASH', era: 'A problem all through the 1880s and 1890s',
    text: 'Farmers everywhere planted wheat, and now there is too much of it. Buyers in Chicago pay much less for every bushel.',
    effect(f) { const e = eff(); e.mult.wheat = 0.4;
      e.notes.push(count(f, 'wheat') ? ['bad', 'Your wheat sold for far less than you hoped.'] : ['good', 'You planted no wheat, so the crash did not hurt you.']);
      return e; } },

  { id: 'railroad', fx: 'none', headline: 'RAILROAD RAISES SHIPPING RATES', era: 'The top complaint of 1880s farmers',
    text: 'The railroad is the only way to get your crops to buyers back east, and the railroad knows it. Rates go up again.',
    effect() { const e = eff(); for (const k in e.mult) e.mult[k] = 0.75;
      e.notes.push(['bad', 'Shipping costs ate 25% of your harvest.']);
      e.notes.push(['ok', 'No upgrade could protect you. The railroad had no competition.']); return e; } },

  { id: 'cornboom', fx: 'none', headline: 'CORN PRICES SOAR', era: 'Hog farms back east need feed',
    text: 'Hog farmers back east need corn to feed their animals, and they are paying top dollar.',
    effect(f) { const e = eff(); e.mult.corn = 1.6;
      e.notes.push(count(f, 'corn') ? ['good', 'Your corn sold for a great price.'] : ['ok', 'You planted no corn this year.']); return e; } },

  { id: 'closedrange', fx: 'none', headline: 'BARBED WIRE CLOSES THE OPEN RANGE', era: 'Based on the fence fights of the 1880s',
    text: 'Your neighbors string barbed wire around their land. The open grass where everyone grazed their cattle is fenced off.',
    effect(f) { const e = eff();
      if (f.setup.wire) { e.mult.cattle = 1.2; if (hasCattle(f)) e.notes.push(['good', 'You fenced your own land, so your cattle still had grass.']); }
      else { e.mult.cattle = 0.4; if (hasCattle(f)) e.notes.push(['bad', 'Your cattle lost their grazing land.']); }
      if (!hasCattle(f)) e.notes.push(['ok', 'You had no cattle this year.']);
      return e; } },

  { id: 'hail', fx: 'hail', headline: 'HAILSTORM FLATTENS THE FIELDS', era: 'A summer danger on the Plains',
    text: 'Ice the size of eggs falls from a green sky and beats the grain flat.',
    effect() { const e = eff(); e.mult.wheat = 0.5; e.mult.oats = 0.5; e.mult.corn = 0.8;
      e.notes.push(['bad', 'Your wheat and oats were smashed. Corn held up a little better.']); return e; } },

  { id: 'bank', fx: 'none', headline: 'BANKS RAISE INTEREST RATES', era: 'Money was tight in the 1880s',
    text: 'Banks back east want more money for their loans, and your local bank passes the cost on to you.',
    effect() { const e = eff(); e.interest = 50; e.notes.push(['bad', 'Your winter bank bill will be $50 higher this year.']); return e; } },

  { id: 'land', fx: 'none', minYear: 3, choice: 'land',
    headline: '"SURPLUS" INDIAN LAND OPENED TO SETTLERS', era: 'Based on the Dawes Act (1887) and the land runs',
    text: 'The government is breaking reservations into small plots and selling the land left over to settlers. You can claim 40 more acres for a $100 filing fee.',
    why: 'This land was promised to Native nations by treaty. Under the Dawes Act, Native land holdings fell from about 138 million acres to about 48 million by 1934.',
    effect() { const e = eff(); e.notes.push(['ok', 'Decide below: claim the land, or pass.']); return e; } },
];
const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

// ---------------------------------------------------------------- helpers
function shuffle(a, rand = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function seededRand(seed) { let a = hashStr(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function newDeck(seed) { return shuffle(CARDS.map(c => c.id), seed ? seededRand('deck-' + seed) : Math.random); }
const UNLOCK_WORDS = ['PLOW', 'WHEAT', 'BARN', 'MULE', 'SEED', 'RAIN', 'WELL', 'HAY', 'OXEN', 'SOD', 'CROW', 'FROST', 'WAGON', 'FENCE', 'GRAIN', 'HOE', 'PRAIRIE', 'BISON', 'CLAIM', 'HARVEST'];
function unlockWord(code, year) { return UNLOCK_WORDS[hashStr('word-' + code + '-' + year) % UNLOCK_WORDS.length]; }
function drawCard(deck, year) {
  const i = deck.findIndex(id => !CARD_BY_ID[id].minYear || year >= CARD_BY_ID[id].minYear);
  return deck.splice(i, 1)[0];
}

function newGame(seed) {
  return { mode: 'teacher', phase: 'lobby', year: 1, deck: newDeck(seed), card: null, families: [], joinCount: 0 };
}

function newFamily(id, group, idx) {
  const fd = FAMILIES[idx % FAMILIES.length];
  return {
    id, group, fam: fd.key, phase: 'lobby', year: 1,
    cash: fd.cash, loan: CONFIG.loan, mortgages: 0, bonesSold: 0,
    setup: { location: 'west', house: 'sod', dry: false, windmill: false, wire: false },
    setupLocked: false, springLocked: false, paid: false,
    plots: Array(CONFIG.ownedPlots + CONFIG.extraPlots).fill(null),
    extraLand: false, landChoice: null, sick: 0, sickNext: 0, extraInterest: 0,
    card: null, effect: null, harvest: null, plantCost: 0,
    deck: newDeck(), fate: null, history: [], log: [],
  };
}

function setupCost(s) {
  let c = SETUP.location[s.location].cost + SETUP.house[s.house].cost;
  for (const k of Object.keys(SETUP.extras)) if (s[k]) c += SETUP.extras[k].cost;
  return c;
}

function tiles(f) {
  const owned = CONFIG.ownedPlots + (f.extraLand ? CONFIG.extraPlots : 0);
  const t = [];
  for (let i = 0; i < CONFIG.ownedPlots + CONFIG.extraPlots; i++) t.push(i < owned ? 'open' : 'locked');
  if (f.setup.house === 'sod') t[0] = 'sod';
  let sick = f.sick;
  for (let i = owned - 1; i >= 0 && sick > 0; i--) if (t[i] === 'open') { t[i] = 'sick'; sick--; }
  return t;
}

function plantCost(plots) { return plots.reduce((s, p) => s + (p ? CROPS[p].cost : 0), 0); }

function cleanPlots(f, plots) {
  const t = tiles(f);
  return t.map((s, i) => (s === 'open' && plots && CROPS[plots[i]]) ? plots[i] : null);
}

// ---------------------------------------------------------------- actions
function setSetup(f, s) {
  if (f.setupLocked) return 'Setup is already locked.';
  const n = {
    location: SETUP.location[s.location] ? s.location : 'west',
    house: SETUP.house[s.house] ? s.house : 'sod',
    dry: !!s.dry, windmill: !!s.windmill, wire: !!s.wire,
  };
  if (setupCost(n) > f.cash) return 'You cannot afford all of that.';
  f.setup = n; f.plots = cleanPlots(f, f.plots); return null;
}

function lockSetup(f) {
  if (f.setupLocked) return;
  if (setupCost(f.setup) > f.cash) f.setup = { location: 'west', house: 'sod', dry: false, windmill: false, wire: false };
  f.cash -= setupCost(f.setup);
  f.setupLocked = true;
  f.log.push(`Setup: ${SETUP.location[f.setup.location].label}, ${SETUP.house[f.setup.house].label}` +
    Object.keys(SETUP.extras).filter(k => f.setup[k]).map(k => ', ' + SETUP.extras[k].label).join(''));
}

function setPlots(f, plots) {
  if (f.springLocked) return 'Planting is already locked.';
  const p = cleanPlots(f, plots);
  if (plantCost(p) > f.cash) return 'You do not have enough money to plant all of that.';
  f.plots = p; return null;
}

function lockSpring(f) {
  if (f.springLocked) return;
  f.plots = cleanPlots(f, f.plots);
  while (plantCost(f.plots) > f.cash) { const i = f.plots.map((p, i) => p ? i : -1).filter(i => i >= 0).pop(); f.plots[i] = null; }
  f.plantCost = plantCost(f.plots);
  f.cash -= f.plantCost;
  f.springLocked = true;
}

function revealSummer(f, cardId) {
  f.card = cardId; f.landChoice = null;
  f.effect = CARD_BY_ID[cardId].effect(f);
}

function chooseLand(f, claim) {
  if (f.phase !== 'summer' && f.phase !== 'fall') return 'Too late to decide.';
  if (!f.card || CARD_BY_ID[f.card].choice !== 'land' || f.landChoice) return null;
  if (claim) {
    if (f.cash < CONFIG.extraLandCost) return 'You cannot afford the $100 filing fee.';
    f.cash -= CONFIG.extraLandCost; f.extraLand = true; f.landChoice = 'claim';
  } else f.landChoice = 'pass';
  return null;
}

function resolveFall(f) {
  if (f.card && CARD_BY_ID[f.card].choice === 'land' && !f.landChoice) f.landChoice = 'pass';
  const e = f.effect || eff();
  const lines = []; let total = 0;
  for (const k of Object.keys(CROPS)) {
    const n = count(f, k); if (!n) continue;
    let per = CROPS[k].base * e.mult[k];
    if (k !== 'cattle' && f.setup.location === 'west') per *= CONFIG.westCropMult;
    if (k === 'wheat' && f.fam === 'larsen') per *= 1.2;
    if (f.fam === 'freeman') per *= 1.1;
    per = Math.round(per);
    lines.push({ label: `${CROPS[k].name} (${n} plot${n > 1 ? 's' : ''} x $${per})`, total: per * n, crop: k });
    total += per * n;
  }
  if (f.fam === 'moore') { lines.push({ label: 'Egg and butter money', total: 75 }); total += 75; }
  if (e.cost) { lines.push({ label: e.costLabel || 'Extra costs', total: -e.cost }); total -= e.cost; }
  f.harvest = { lines, total, plantCost: f.plantCost, profit: total - f.plantCost };
  f.cash += total;
  f.sickNext = e.sick; f.extraInterest = e.interest;
}

function winterBill(f) {
  const interest = Math.round(f.loan * CONFIG.interestRate * (f.fam === 'obrien' ? 0.5 : 1));
  const extra = f.extraInterest || 0;
  return { living: CONFIG.living, interest, extra, total: CONFIG.living + interest + extra };
}

function winterOptions(f) {
  return {
    bones: f.bonesSold < CONFIG.bones.length ? CONFIG.bones[f.bonesSold] : 0,
    mortgage: f.mortgages < CONFIG.maxMortgages,
  };
}

function winterAction(f, which) {
  if (f.phase !== 'winter' || f.paid || f.fate) return 'Not now.';
  const o = winterOptions(f);
  if (which === 'pay') {
    const b = winterBill(f);
    if (f.cash < b.total) return 'You do not have enough money to pay.';
    f.cash -= b.total; f.paid = true; return null;
  }
  if (which === 'bones') {
    if (!o.bones) return 'There are no bones left to gather.';
    f.cash += o.bones; f.bonesSold++; f.log.push(`Year ${f.year}: sold bison bones for $${o.bones}`); return null;
  }
  if (which === 'mortgage') {
    if (!o.mortgage) return 'The bank will not lend you any more.';
    f.cash += CONFIG.mortgageCash; f.loan += CONFIG.mortgageDebt; f.mortgages++;
    f.log.push(`Year ${f.year}: mortgaged animals and tools`); return null;
  }
  if (which === 'giveup') { f.fate = 'east'; f.paid = true; f.phase = 'end'; return null; }
  if (which === 'lose') { f.fate = 'foreclosed'; f.paid = true; f.phase = 'end'; return null; }
  return 'Unknown choice.';
}

function autoWinter(f) {
  if (f.paid || f.fate) return;
  const b = winterBill(f);
  while (f.cash < b.total) {
    const o = winterOptions(f);
    if (o.bones) winterAction(f, 'bones');
    else if (o.mortgage) winterAction(f, 'mortgage');
    else { winterAction(f, 'lose'); return; }
  }
  winterAction(f, 'pay');
}

function finishYear(f) {
  f.history.push({ year: f.year, card: f.card, profit: f.harvest ? f.harvest.profit : 0, cash: f.cash });
  if (f.fate) return;
  if (f.year >= CONFIG.years) {
    if (f.cash >= f.loan) { f.cash -= f.loan; f.loan = 0; f.fate = 'debtfree'; }
    else f.fate = 'proved';
    f.phase = 'end'; return;
  }
  f.year++;
  f.sick = f.sickNext || 0; f.sickNext = 0; f.extraInterest = 0;
  f.springLocked = false; f.paid = false; f.card = null; f.effect = null; f.harvest = null; f.plantCost = 0;
  f.plots = cleanPlots(f, f.plots);       // keep last year's layout as a starting point
  f.phase = 'spring';
}

// Move one family forward one step. cardId is the shared card in teacher mode.
function advanceFamily(f, cardId) {
  if (f.fate) { f.phase = 'end'; return; }
  switch (f.phase) {
    case 'lobby': f.phase = 'setup'; break;
    case 'setup': lockSetup(f); f.phase = 'spring'; break;
    case 'spring': lockSpring(f); revealSummer(f, cardId || drawCard(f.deck, f.year)); f.phase = 'summer'; break;
    case 'summer': resolveFall(f); f.phase = 'fall'; break;
    case 'fall': f.phase = 'winter'; f.paid = false; break;
    case 'winter': autoWinter(f); finishYear(f); break;
  }
}

// Data the browser needs for one family
function familyView(f) {
  const card = f.card ? CARD_BY_ID[f.card] : null;
  return {
    id: f.id, group: f.group, fam: f.fam, phase: f.phase, year: f.year, calYear: CONFIG.startYear + f.year - 1,
    cash: f.cash, loan: f.loan, setup: f.setup, setupLocked: f.setupLocked, springLocked: f.springLocked,
    paid: f.paid, plots: f.plots, tiles: tiles(f), sick: f.sick, extraLand: f.extraLand, landChoice: f.landChoice,
    card: card ? { id: card.id, fx: card.fx, headline: card.headline, era: card.era, text: card.text, why: card.why || null, choice: card.choice || null } : null,
    notes: f.effect ? f.effect.notes : [], mult: f.effect ? f.effect.mult : null, harvest: f.harvest, plantCost: plantCost(f.plots),
    bill: winterBill(f), options: winterOptions(f), mortgages: f.mortgages, bonesSold: f.bonesSold,
    fate: f.fate, history: f.history, log: f.log,
  };
}

function publicGame(g, extra) {
  return Object.assign({ mode: g.mode, phase: g.phase, year: g.year, calYear: CONFIG.startYear + g.year - 1,
    card: g.card ? (({ effect, ...rest }) => rest)(CARD_BY_ID[g.card]) : null }, extra || {});
}

const DATA = { CONFIG, CROPS, FAMILIES, SETUP, FATES, BONES_NOTE,
  CARDS: CARDS.map(({ effect, ...rest }) => rest) };

const API = {
  CONFIG, DATA, CARD_BY_ID, unlockWord, newGame, newFamily, newDeck, drawCard, setSetup, lockSetup, setPlots, lockSpring,
  chooseLand, winterAction, advanceFamily, familyView, publicGame, setupCost,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API; else window.Engine = API;
})();
