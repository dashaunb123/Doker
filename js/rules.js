// ============================================================
//  DOKER — run rules + hand table (see docs/DESIGN.md)
// ============================================================
const RULES = {
  ROUNDS: 8,
  ROLLS: 10,
  START_MONEY: 4,
  /** score needed to breach firewall r: 300, +60% per round, rounded to 10 */
  target(r) { return Math.round(300 * Math.pow(1.6, r - 1) / 10) * 10; },
  /** credits for breaching firewall r (unused rolls pay $1 each on top) */
  reward(r) { return 3 + Math.floor((r - 1) / 2); },
};

// Hand values follow the real odds of 5d6: rarer hand = bigger payout.
// chips/mult are level-1 values; pc/pm are added per extra level (patches).
const HANDS = {
  bust:     { name: 'BUST',            proto: 'NULL',        chips: 5,   mult: 1,  pc: 5,  pm: 0.5, tier: 0, col: '#8a7fc0' },
  pair:     { name: 'PAIR',            proto: 'PING',        chips: 10,  mult: 2,  pc: 10, pm: 1,   tier: 1, col: '#f4f4f4' },
  twopair:  { name: 'TWO PAIR',        proto: 'HANDSHAKE',   chips: 20,  mult: 3,  pc: 15, pm: 1,   tier: 2, col: '#7d9bff' },
  three:    { name: 'THREE OF A KIND', proto: 'TRIANGULATE', chips: 30,  mult: 4,  pc: 20, pm: 2,   tier: 3, col: '#4dff88' },
  full:     { name: 'FULL HOUSE',      proto: 'FULL STACK',  chips: 50,  mult: 6,  pc: 25, pm: 2,   tier: 4, col: '#2ce8f5' },
  straight: { name: 'STRAIGHT',        proto: 'PIPELINE',    chips: 60,  mult: 7,  pc: 30, pm: 3,   tier: 5, col: '#feae34' },
  four:     { name: 'FOUR OF A KIND',  proto: 'QUAD CORE',   chips: 80,  mult: 9,  pc: 35, pm: 3,   tier: 6, col: '#f77622' },
  doker:    { name: 'DOKER!!',         proto: 'ROOTKIT',     chips: 150, mult: 25, pc: 60, pm: 5,   tier: 7, col: '#ff3df2' },
};

function handValue(key, level = 1) {
  const h = HANDS[key];
  return { chips: h.chips + h.pc * (level - 1), mult: h.mult + h.pm * (level - 1) };
}

/** Which hand five dice make, and which dice are part of it. */
function evaluateDice(faces, opts = {}) {
  const cnt = {};
  faces.forEach(f => (cnt[f] = (cnt[f] || 0) + 1));
  const groups = Object.entries(cnt).map(([f, c]) => ({ f: +f, c })).sort((a, b) => b.c - a.c || b.f - a.f);
  const sorted = [...faces].sort((a, b) => a - b).join('');
  const sum = faces.reduce((a, b) => a + b, 0);
  const mark = fs => faces.map(f => fs.includes(f));
  const all = faces.map(() => true);
  const [a, b] = groups;
  let key, scoring;
  if (a.c === 5)                                     { key = 'doker';    scoring = all; }
  else if (a.c === 4)                                { key = 'four';     scoring = mark([a.f]); }
  else if (sorted === '12345' || sorted === '23456' || (opts.spoof && faces.length === 5 && a.c === 1))
                                                     { key = 'straight'; scoring = all; }
  else if (a.c === 3 && b && b.c === 2)              { key = 'full';     scoring = all; }
  else if (a.c === 3)                                { key = 'three';    scoring = mark([a.f]); }
  else if (a.c === 2 && b && b.c === 2)              { key = 'twopair';  scoring = mark([a.f, b.f]); }
  else if (a.c === 2)                                { key = 'pair';     scoring = mark([a.f]); }
  else                                               { key = 'bust';     scoring = faces.map(() => false); }
  return { key, scoring, sum };
}

const fmtNum = n => Math.round(n).toLocaleString('en-US');
const fmtMult = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));
