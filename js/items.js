// ============================================================
//  DOKER — collectibles: rarity, perks, patches, packs
//  Numbers come from docs/DESIGN.md (sections 3, 4, 5, 7).
// ============================================================

// ---------- rarity (index 0..5) ----------
const RARITY = {
  ids:     ['common', 'uncommon', 'rare', 'epic', 'legendary', 'corrupted'],
  name:    ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'CORRUPTED'],
  col:     ['#b8b8c8', '#4dff88', '#4f9bff', '#b46bff', '#feae34', '#ff3df2'],
  weights: [55, 25, 12, 6, 1.5, 0.5],
  price:   [3, 5, 7, 9, 12, 10],
  /** boost > 1 multiplies the odds of Rare and above (mega packs) */
  roll(boost = 1) {
    const w = this.weights.map((v, i) => (i >= 2 ? v * boost : v));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return i;
    return 0;
  },
};

const _ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const _pick = a => a[Math.floor(Math.random() * a.length)];
const _q = (show, v) => (show ? v : '??');
let _uid = 0;

// ---------- perks ----------
// roll(r) -> random stats for rarity r.  desc(stats, show) -> text ('??' while encrypted).
// Corrupted perks (r = 5) get stronger numbers plus a catch; Streak has its own catch.
const PERK_DEFS = {
  streak: {
    name: 'STREAK', code: 'STK',
    roll: r => ({ face: r === 4 ? 6 : _ri(1, 6), pct: [10, 15, 25, 35, 50, 80][r], keep: r === 4, shifty: r === 5, stacks: 0 }),
    desc: (s, show) => `ROLL A ${show && !s.shifty ? s.face : '?'} AND IT GETS +${_q(show, s.pct)}% LIKELIER NEXT ROLL. STACKS.` +
      (s.keep ? ' NEVER RESETS.' : ' RESETS ON A MISS.') + (s.shifty ? ' CATCH: THE FACE SECRETLY CHANGES EACH FIREWALL.' : ''),
  },
  loaded: {
    name: 'LOADED', code: 'LDD',
    roll: r => ({ face: _ri(1, 6), pct: [5, 8, 12, 18, 25, 40][r], choose: r === 4 }),
    desc: (s, show) => `FACE ${_q(show, s.face)} IS +${_q(show, s.pct)}% LIKELIER ON EVERY DIE.` + (s.choose ? ' YOU CHOOSE THE FACE.' : ''),
  },
  hothand: {
    name: 'HOT HAND', code: 'HOT',
    roll: r => ({ amt: [0.5, 1, 1.5, 2, 3, 5][r], survive: r >= 4 }),
    desc: (s, show) => `+${_q(show, fmtMult(s.amt))} MULT FOR EACH SCORING HAND IN A ROW. A BUST RESETS IT.` + (s.survive ? ' SURVIVES ONE BUST PER FIREWALL.' : ''),
  },
  pity: {
    name: 'PITY PROTOCOL', code: 'PTY',
    roll: r => ({ amt: [10, 20, 35, 50, 80, 130][r], x15: r >= 4 }),
    desc: (s, show) => `EACH BUST STORES +${_q(show, s.amt)} CHIPS FOR YOUR NEXT SCORING HAND.` + (s.x15 ? ' THAT HAND ALSO SCORES X1.5.' : ''),
  },
  bitflip: {
    name: 'BIT FLIP', code: 'BIT',
    roll: r => ({ pct: [4, 7, 10, 15, 22, 35][r] }),
    desc: (s, show) => `EACH DIE HAS A ${_q(show, s.pct)}% CHANCE TO FLIP TO ITS OPPOSITE FACE WHEN THAT MAKES A BETTER HAND.`,
  },
  overclock: {
    name: 'OVERCLOCK', code: 'OVC',
    roll: r => ({ x: [1.5, 2, 2.5, 3, 5, 8][r] }),
    desc: (s, show) => `THE FIRST ROLL OF EACH FIREWALL SCORES X${_q(show, fmtMult(s.x))}.`,
  },
  lastcall: {
    name: 'LAST CALL', code: 'LST',
    roll: r => ({ x: [2, 2.5, 3, 4, 6, 10][r] }),
    desc: (s, show) => `THE FINAL ROLL OF EACH FIREWALL SCORES X${_q(show, fmtMult(s.x))}.`,
  },
  inflation: {
    name: 'PIP INFLATION', code: 'PIP',
    roll: r => ({ face: _ri(1, 6), amt: [2, 4, 6, 9, 15, 24][r] }),
    desc: (s, show) => `EVERY ${_q(show, s.face)} YOU ROLL ADDS +${_q(show, s.amt)} EXTRA CHIPS.`,
  },
  socket: {
    name: 'EXTRA SOCKET', code: 'SKT',
    roll: r => ({ amt: [1, 1, 2, 2, 3, 4][r] }),
    desc: (s, show) => `+${_q(show, s.amt)} ROLL${s.amt === 1 && show ? '' : 'S'} EVERY FIREWALL.`,
  },
  lucky: {
    name: 'LUCKY NUMBER', code: 'LCK',
    roll: r => ({ target: _ri(10, 25), amt: [5, 8, 12, 18, 30, 48][r], visible: r >= 4 }),
    desc: (s, show) => `IF YOUR DICE ADD UP TO EXACTLY ${show && s.visible ? s.target : '??'}, +${_q(show, s.amt)} MULT.` + (s.visible ? '' : ' THE NUMBER STAYS SECRET.'),
  },
  snake: {
    name: 'SNAKE CHARMER', code: 'SNK',
    roll: r => ({ amt: [5, 10, 15, 25, 40, 64][r] }),
    desc: (s, show) => `EVERY 1 YOU ROLL ADDS +${_q(show, s.amt)} CHIPS.`,
  },
  echo: {
    name: 'ECHO', code: 'ECH',
    roll: r => ({ x: [1.5, 2, 2.5, 3, 4, 6][r] }),
    desc: (s, show) => `ROLL THE SAME HAND TWICE IN A ROW AND THE SECOND ONE SCORES X${_q(show, fmtMult(s.x))}.`,
  },
  interest: {
    name: 'COMPOUND INTEREST', code: 'INT',
    roll: r => ({ pct: [5, 8, 10, 12, 20, 30][r], cap: [3, 4, 6, 8, 15, 24][r] }),
    desc: (s, show) => `EARN ${_q(show, s.pct)}% INTEREST ON YOUR CREDITS AFTER EACH FIREWALL, UP TO $${_q(show, s.cap)}.`,
  },
  recursion: {
    name: 'RECURSION', code: 'RCR',
    roll: r => ({ pct: [5, 8, 12, 18, 30, 45][r] }),
    desc: (s, show) => `${_q(show, s.pct)}% CHANCE THAT A SCORING HAND SCORES TWICE.`,
  },
};
const PERK_IDS = Object.keys(PERK_DEFS);

function makePerk(id, r) {
  const stats = PERK_DEFS[id].roll(r);
  if (r === 5 && id !== 'streak') stats.catchRoll = true;
  return { kind: 'perk', id, uid: ++_uid, rarity: r, stats, revealed: false };
}

// ---------- patches (hand upgrades) ----------
const PATCH_BOOST = [
  { lv: 1 }, { lv: 1, chips: 5 }, { lv: 2 }, { lv: 2, mult: 1 }, { lv: 3 }, { lv: 4, corrupt: true },
];
const PATCH_CODE = { bust: 'NUL', pair: 'PNG', twopair: 'HSK', three: 'TRI', full: 'FST', straight: 'PPL', four: 'QDC', doker: 'RKT' };
const PATCH_WEIGHTS = [['pair', 1], ['twopair', 1], ['three', 1], ['full', 1], ['straight', 1], ['four', 1], ['doker', 1], ['bust', 0.4]];

function rollPatchKey(exclude = []) {
  const opts = PATCH_WEIGHTS.filter(([k]) => !exclude.includes(k));
  let r = Math.random() * opts.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of opts) if ((r -= w) < 0) return k;
  return opts[0][0];
}
function makePatch(key, r) { return { kind: 'patch', key, uid: ++_uid, rarity: r, revealed: false, other: null }; }

// ---------- item helpers ----------
function itemName(it) { return it.kind === 'perk' ? PERK_DEFS[it.id].name : HANDS[it.key].proto + ' PATCH'; }
function itemCode(it) { return it.kind === 'perk' ? PERK_DEFS[it.id].code : PATCH_CODE[it.key]; }
function itemPrice(it) { return RARITY.price[it.rarity]; }

function itemDesc(it, show, run) {
  if (it.kind === 'perk') {
    let d = PERK_DEFS[it.id].desc(it.stats, show);
    if (it.stats.catchRoll) d += ' CATCH: -1 ROLL EVERY FIREWALL.';
    return d;
  }
  const b = PATCH_BOOST[it.rarity], h = HANDS[it.key];
  let d = `LEVELS UP ${h.name} BY +${b.lv}.`;
  if (b.chips) d += ` ALSO +${b.chips} CHIPS.`;
  if (b.mult) d += ` ALSO +${b.mult} MULT.`;
  if (run) {
    const now = handStats(run, it.key), lv = run.levels[it.key] ?? 1;
    const next = handValue(it.key, lv + b.lv);
    d += ` LV${lv} ${fmtNum(now.chips)}X${fmtMult(now.mult)} -> LV${lv + b.lv} ${fmtNum(next.chips + (b.chips || 0) + ((run.bonus[it.key] || {}).chips || 0))}X${fmtMult(next.mult + (b.mult || 0) + ((run.bonus[it.key] || {}).mult || 0))}.`;
  }
  if (b.corrupt) d += ` CATCH: ${it.other ? HANDS[it.other].name : 'A RANDOM OTHER HAND'} LOSES 1 LEVEL.`;
  return d;
}

/** Put a bought/picked item into the run. */
function applyItem(run, it) {
  it.revealed = true;
  if (it.kind === 'perk') { run.perks.push(it); return; }
  const b = PATCH_BOOST[it.rarity];
  run.levels[it.key] = (run.levels[it.key] ?? 1) + b.lv;
  const bonus = (run.bonus[it.key] = run.bonus[it.key] || { chips: 0, mult: 0 });
  bonus.chips += b.chips || 0;
  bonus.mult += b.mult || 0;
  if (b.corrupt) {
    it.other = _pick(Object.keys(HANDS).filter(k => k !== it.key));
    run.levels[it.other] = Math.max(0, (run.levels[it.other] ?? 1) - 1);
  }
}

// ---------- packs ----------
const PACKS = {
  perk:      { name: 'PERK CACHE',        lines: ['PERK', 'CACHE'],     price: 4, show: 3, pick: 1, pool: ['perk'],          col: '#7a3bd4', boost: 1 },
  patch:     { name: 'PATCH BUNDLE',      lines: ['PATCH', 'BUNDLE'],   price: 4, show: 4, pick: 1, pool: ['patch'],         col: '#2f5fd0', boost: 1 },
  mystery:   { name: 'MYSTERY PAYLOAD',   lines: ['MYSTERY', 'PAYLOAD'],price: 6, show: 5, pick: 1, pool: ['perk', 'patch'], col: '#c42fa8', boost: 1 },
  megaperk:  { name: 'MEGA PERK CACHE',   lines: ['MEGA', 'PERKS'],     price: 8, show: 6, pick: 2, pool: ['perk'],          col: '#7a3bd4', boost: 2, mega: true },
  megapatch: { name: 'MEGA PATCH BUNDLE', lines: ['MEGA', 'PATCHES'],   price: 8, show: 6, pick: 2, pool: ['patch'],         col: '#2f5fd0', boost: 2, mega: true },
};
const PACK_WEIGHTS = [['perk', 30], ['patch', 30], ['mystery', 20], ['megaperk', 10], ['megapatch', 10]];
const SKIP_REWARD = 2;

function rollPackType() {
  let r = Math.random() * PACK_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of PACK_WEIGHTS) if ((r -= w) < 0) return k;
  return 'perk';
}

/** n random items from the given pools, no repeats of the same perk or hand. */
function rollItems(n, pool, boost = 1) {
  const out = [], usedPerks = [], usedHands = [];
  for (let i = 0; i < n; i++) {
    const kind = _pick(pool);
    const r = RARITY.roll(boost);
    if (kind === 'perk') {
      const fresh = PERK_IDS.filter(p => !usedPerks.includes(p));
      const id = _pick(fresh.length ? fresh : PERK_IDS);
      usedPerks.push(id);
      out.push(makePerk(id, r));
    } else {
      const key = rollPatchKey(usedHands);
      usedHands.push(key);
      out.push(makePatch(key, r));
    }
  }
  return out;
}

// ============================================================
//  PERK ENGINE — dice odds, rolls per firewall, scoring hooks
// ============================================================
const perksOf = (run, id) => run.perks.filter(p => p.id === id);

function handStats(run, key) {
  const v = handValue(key, run.levels[key] ?? 1);
  const b = run.bonus[key] || {};
  return { chips: Math.max(1, v.chips + (b.chips || 0)), mult: Math.max(1, v.mult + (b.mult || 0)) };
}

function rollsPerRound(run) {
  let n = RULES.ROLLS;
  for (const p of run.perks) {
    if (p.id === 'socket') n += p.stats.amt;
    if (p.stats.catchRoll) n -= 1;
  }
  return Math.max(1, n);
}

/** Relative weight of faces 1..6 (index 0 unused). */
function dieWeights(run) {
  const w = [0, 1, 1, 1, 1, 1, 1];
  for (const p of run.perks) {
    if (p.id === 'loaded') w[p.stats.face] *= 1 + p.stats.pct / 100;
    if (p.id === 'streak' && p.stats.stacks > 0) w[p.stats.face] *= 1 + (p.stats.pct * p.stats.stacks) / 100;
  }
  return w;
}
function rollFace(w) {
  let r = Math.random() * (w[1] + w[2] + w[3] + w[4] + w[5] + w[6]);
  for (let f = 1; f <= 6; f++) if ((r -= w[f]) < 0) return f;
  return 6;
}

const _handScore = (run, faces) => {
  const ev = evaluateDice(faces), hs = handStats(run, ev.key);
  return (hs.chips + ev.sum) * hs.mult;
};

/** BIT FLIP: returns the index -> new face map for dice that flip. */
function bitFlips(run, faces) {
  const flips = {};
  const ps = perksOf(run, 'bitflip');
  if (!ps.length) return flips;
  const cur = faces.slice();
  for (let i = 0; i < cur.length; i++) {
    if (!ps.some(p => Math.random() * 100 < p.stats.pct)) continue;
    const alt = cur.slice(); alt[i] = 7 - cur[i];
    if (_handScore(run, alt) > _handScore(run, cur)) { cur[i] = alt[i]; flips[i] = alt[i]; }
  }
  return flips;
}

/**
 * Score one roll. Returns the hand plus an ordered list of perk steps:
 * { p, kind: 'chips' | 'mult' | 'xmult', amt }.  ctx = { first, last, prevKey }.
 */
function scoreRoll(run, faces, ctx) {
  const ev = evaluateDice(faces);
  const base = handStats(run, ev.key);
  const steps = [];
  const scoring = ev.key !== 'bust';
  const each = (id, fn) => perksOf(run, id).forEach(fn);

  each('inflation', p => { const n = faces.filter(f => f === p.stats.face).length; if (n) steps.push({ p, kind: 'chips', amt: p.stats.amt * n }); });
  each('snake', p => { const n = faces.filter(f => f === 1).length; if (n) steps.push({ p, kind: 'chips', amt: p.stats.amt * n }); });
  const pity = perksOf(run, 'pity');
  if (scoring && run.pity > 0 && pity.length) {
    steps.push({ p: pity[0], kind: 'chips', amt: run.pity });
    const big = pity.find(p => p.stats.x15);
    if (big) steps.push({ p: big, kind: 'xmult', amt: 1.5 });
  }
  each('hothand', p => { if (scoring) steps.push({ p, kind: 'mult', amt: p.stats.amt * (run.hot + 1) }); });
  each('lucky', p => { if (ev.sum === p.stats.target) steps.push({ p, kind: 'mult', amt: p.stats.amt }); });
  each('echo', p => { if (ctx.prevKey === ev.key) steps.push({ p, kind: 'xmult', amt: p.stats.x }); });
  each('overclock', p => { if (ctx.first) steps.push({ p, kind: 'xmult', amt: p.stats.x }); });
  each('lastcall', p => { if (ctx.last) steps.push({ p, kind: 'xmult', amt: p.stats.x }); });
  each('recursion', p => { if (scoring && Math.random() * 100 < p.stats.pct) steps.push({ p, kind: 'xmult', amt: 2 }); });
  return { ...ev, base, steps };
}

/** Bookkeeping after a roll has scored (streaks, hot hand, pity). */
function afterRoll(run, key, faces) {
  if (key === 'bust') {
    const shield = perksOf(run, 'hothand').some(p => p.stats.survive);
    if (shield && !run.hotShieldUsed) run.hotShieldUsed = true;
    else run.hot = 0;
    run.pity += perksOf(run, 'pity').reduce((a, p) => a + p.stats.amt, 0);
  } else {
    run.hot++;
    run.pity = 0;
  }
  for (const p of perksOf(run, 'streak')) {
    if (faces.includes(p.stats.face)) p.stats.stacks++;
    else if (!p.stats.keep) p.stats.stacks = 0;
  }
  run.prevKey = key;
}

function onRoundStart(run) {
  run.hotShieldUsed = false;
  for (const p of perksOf(run, 'streak')) if (p.stats.shifty) { p.stats.face = _ri(1, 6); p.stats.stacks = 0; }
}

function interestFor(run) {
  return perksOf(run, 'interest').reduce((a, p) => a + Math.min(p.stats.cap, Math.floor(run.money * p.stats.pct / 100)), 0);
}

/** Wrap text to lines of at most n characters. */
function wrapText(str, n) {
  const out = [];
  let line = '';
  for (const w of String(str).split(' ')) {
    if (line && (line + ' ' + w).length > n) { out.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
}
