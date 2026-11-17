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
// ---- wave 2 perks ----
Object.assign(PERK_DEFS, {
  backdoor: {
    name: 'BACKDOOR', code: 'BKD',
    roll: r => ({ amt: [1, 1, 1, 2, 2, 3][r] }),
    desc: (s, show) => (s.amt === 1 ? 'YOUR FIRST BUST EACH FIREWALL DOES NOT USE A ROLL.' : `YOUR FIRST ${_q(show, s.amt)} BUSTS EACH FIREWALL DO NOT USE A ROLL.`),
  },
  speedrun: {
    name: 'SPEEDRUN', code: 'SPD',
    roll: r => ({ left: 3, amt: [2, 3, 4, 5, 8, 12][r] }),
    desc: (s, show) => `BREACH A FIREWALL WITH ${s.left}+ ROLLS LEFT: +$${_q(show, s.amt)}.`,
  },
  loworbit: {
    name: 'LOW ORBIT', code: 'LOW',
    roll: r => ({ amt: [4, 6, 9, 12, 20, 30][r] }),
    desc: (s, show) => `EVERY DIE SHOWS 3 OR LESS: +${_q(show, s.amt)} MULT.`,
  },
  highroller: {
    name: 'HIGH ROLLER', code: 'HGH',
    roll: r => ({ amt: [20, 30, 45, 60, 100, 150][r] }),
    desc: (s, show) => `EVERY DIE SHOWS 4 OR MORE: +${_q(show, s.amt)} CHIPS.`,
  },
  cronjob: {
    name: 'CRON JOB', code: 'CRN',
    roll: r => ({ x: [2, 2.5, 3, 3.5, 5, 7][r] }),
    desc: (s, show) => `EVERY 4TH ROLL OF A FIREWALL SCORES X${_q(show, fmtMult(s.x))}.`,
  },
  patchtuesday: {
    name: 'PATCH TUESDAY', code: 'PTU',
    roll: r => ({ amt: [1, 1, 1, 2, 2, 3][r] }),
    desc: (s, show) => `PATCHES COST $${_q(show, s.amt)} LESS IN THE BLACK MARKET.`,
  },
  cachehit: {
    name: 'CACHE HIT', code: 'CCH',
    roll: r => ({ amt: [10, 15, 25, 40, 60, 100][r] }),
    desc: (s, show) => `YOUR MOST COMMON FACE MATCHES LAST ROLL'S: +${_q(show, s.amt)} CHIPS.`,
  },
  sidechannel: {
    name: 'SIDE CHANNEL', code: 'SDC',
    roll: r => ({ amt: [2, 3, 4, 6, 9, 14][r] }),
    desc: (s, show) => `TWO PAIR SCORES +${_q(show, s.amt)} MULT.`,
  },
  stackoverflow: {
    name: 'STACK OVERFLOW', code: 'STO',
    roll: r => ({ amt: [5, 8, 12, 18, 30, 45][r] }),
    desc: (s, show) => `DICE ADD UP TO 25 OR MORE: +${_q(show, s.amt)} MULT.`,
  },
  pipeline: {
    name: 'PIPELINE', code: 'PPL',
    roll: r => ({ amt: [5, 8, 10, 15, 25, 40][r] }),
    desc: (s, show) => `EVERY STRAIGHT YOU ROLL GIVES STRAIGHTS +${_q(show, s.amt)} CHIPS FOREVER.`,
  },
});
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

// ---------- wildcards (joker-like, 5 slots, order matters) ----------
// rarity sets the card colour + shop odds; price is the base price (editions add to it).
const WILD_DEFS = {
  dealer:     { name: 'THE DEALER',        code: 'DLR', rarity: 0, price: 4, desc: () => '+4 MULT EVERY ROLL.' },
  ducky:      { name: 'RUBBER DUCKY',      code: 'DCK', rarity: 1, price: 5, desc: () => 'EVERY 1 YOU ROLL COUNTS AS A 6.' },
  mitm:       { name: 'MAN IN THE MIDDLE', code: 'MTM', rarity: 1, price: 5, desc: () => 'THE MIDDLE DIE ADDS ITS CHIPS TWICE. X1.5 MULT IF IT IS PART OF THE HAND.' },
  ransom:     { name: 'RANSOMWARE',        code: 'RNS', rarity: 2, price: 7, desc: () => 'X3 MULT. COSTS $1 EVERY ROLL. DELETES ITSELF IF YOU CAN\'T PAY.' },
  zeroday:    { name: 'ZERO DAY',          code: 'ZDY', rarity: 2, price: 6, desc: () => 'THE FIRST TIME EACH HAND SCORES IN A FIREWALL: X2 MULT.' },
  botnet:     { name: 'BOTNET',            code: 'BOT', rarity: 1, price: 5, desc: () => '+3 MULT FOR EACH WILDCARD YOU OWN.' },
  keylogger:  { name: 'KEYLOGGER',         code: 'KEY', rarity: 2, price: 6, desc: s => `GAINS X0.1 MULT FOREVER EACH TIME YOU REPEAT YOUR LAST HAND. NOW X${fmtMult(s.x)}.` },
  packetloss: { name: 'PACKET LOSS',       code: 'PKT', rarity: 2, price: 7, desc: () => 'YOUR LOWEST DIE IS DROPPED EVERY ROLL. HAND SCORES X2.' },
  phantom:    { name: 'PHANTOM DIE',       code: 'PHN', rarity: 2, price: 7, desc: () => 'ROLLS A GHOST 6TH DIE THAT CAN COMPLETE PAIRS AND KINDS (NOT STRAIGHTS).' },
  firewall:   { name: 'FIREWALL',          code: 'FWL', rarity: 3, price: 8, desc: () => 'ONCE: IF YOU FAIL A FIREWALL, IT COUNTS AS BREACHED. THEN THIS BURNS.' },
  overflow:   { name: 'OVERFLOW',          code: 'OVF', rarity: 0, price: 4, desc: () => 'DICE ADD UP TO 24 OR MORE: X2 MULT.' },
  parity:     { name: 'PARITY BIT',        code: 'PAR', rarity: 1, price: 5, desc: () => 'ALL DICE EVEN: +40 CHIPS. ALL DICE ODD: +8 MULT.' },
  cookiejar:  { name: 'COOKIE JAR',        code: 'CKJ', rarity: 0, price: 4, desc: s => `GAINS +3 CHIPS FOREVER FOR EVERY 1 YOU ROLL. NOW +${s.chips}.` },
  bruteforce: { name: 'BRUTE FORCE',       code: 'BRF', rarity: 0, price: 4, desc: () => '+1 MULT FOR EACH ROLL ALREADY USED THIS FIREWALL.' },
  mirror:     { name: 'MIRROR',            code: 'MIR', rarity: 3, price: 9, desc: () => 'COPIES THE SCORING OF THE WILDCARD TO ITS RIGHT.' },
  glitch:     { name: 'GLITCH',            code: 'GLT', rarity: 3, price: 8, desc: s => `EACH FIREWALL ONE FACE IS WILD AND BECOMES WHATEVER MAKES THE BEST HAND. WILD FACE: ${s.face}.` },
  miner:      { name: 'CRYPTO MINER',      code: 'MNR', rarity: 1, price: 5, desc: () => '+$1 FOR EVERY 6 YOU ROLL.' },
  deadman:    { name: "DEAD MAN'S SWITCH", code: 'DMS', rarity: 2, price: 6, desc: () => 'ON YOUR FINAL ROLL, IF THE TARGET ISN\'T HIT YET: X4 MULT.' },
  spoofer:    { name: 'SPOOFER',           code: 'SPF', rarity: 2, price: 7, desc: () => 'STRAIGHTS CAN SKIP ONE NUMBER (1-2-3-5-6 COUNTS).' },
};
// ---- wave 2 wildcards ----
Object.assign(WILD_DEFS, {
  hotpotato:   { name: 'HOT POTATO',     code: 'HOT', rarity: 2, price: 6, desc: () => 'X4 MULT. SLIDES ONE SLOT RIGHT EVERY ROLL AND BURNS UP OFF THE END.' },
  doubleagent: { name: 'DOUBLE AGENT',   code: 'DBL', rarity: 1, price: 5, desc: () => 'EVERY ROLL: COIN FLIP FOR X2 OR X0.5 MULT.' },
  captcha:     { name: 'CAPTCHA',        code: 'CAP', rarity: 2, price: 6, desc: () => 'DICE LAND IN ORDER, LOW TO HIGH, LEFT TO RIGHT: X3 MULT.' },
  sandcastle:  { name: 'SANDCASTLE',     code: 'SND', rarity: 0, price: 4, desc: s => `GAINS +10 CHIPS EVERY ROLL, CRUMBLES EACH FIREWALL. NOW +${(s.chips || 0) + 10}.` },
  snakeoil:    { name: 'SNAKE OIL',      code: 'OIL', rarity: 0, price: 4, desc: s => `DOES NOTHING. ITS SELL VALUE GOES UP $1 EVERY FIREWALL (+$${s.bonus || 0} SO FAR).` },
  deaddrop:    { name: 'DEAD DROP',      code: 'DRP', rarity: 1, price: 5, desc: () => 'AFTER EACH FIREWALL YOU BREACH, GET A RANDOM EXPLOIT (IF YOU HAVE ROOM).' },
  auditor:     { name: 'THE AUDITOR',    code: 'AUD', rarity: 2, price: 7, desc: () => '+X0.25 MULT FOR EACH DIFFERENT HAND YOU HAVE SCORED THIS FIREWALL.' },
  antivirus:   { name: 'ANTIVIRUS',      code: 'AV',  rarity: 2, price: 6, desc: () => 'QUARANTINES THE NEXT BOSS: ITS RULE IS CANCELLED. THEN IT DELETES ITSELF.' },
  ghost:       { name: 'GHOST PROTOCOL', code: 'GST', rarity: 1, price: 5, desc: () => 'A BUST SCORES HALF OF YOUR LAST SCORING HAND.' },
  hexeditor:   { name: 'HEX EDITOR',     code: 'HEX', rarity: 0, price: 4, desc: () => '1S ARE WORTH 6 CHIPS AND 6S ARE WORTH 1.' },
  latency:     { name: 'LATENCY',        code: 'LAT', rarity: 2, price: 6, desc: () => "YOUR PREVIOUS ROLL'S HAND SCORES ITS CHIPS AND MULT AGAIN." },
  quantum:     { name: 'QUANTUM',        code: 'QNT', rarity: 3, price: 8, desc: () => 'EVERY ROLL ONE RANDOM DIE BECOMES WHATEVER MAKES THE BEST HAND.' },
  sudo:        { name: 'SUDO',           code: 'SUD', rarity: 1, price: 5, desc: () => "THE LEFTMOST DIE'S CHIPS TRIGGER AGAIN." },
});
const WILD_IDS = Object.keys(WILD_DEFS);
const WILD_SLOTS = 5;

// editions: rolled when a wildcard is made. NEON +chips, HOLO +mult, GOLD +$ per breach, CORRUPTED X2 that flickers.
const EDITIONS = {
  neon:    { name: 'NEON',      col: '#2ce8f5', price: 2, weight: 7, text: '+20 CHIPS.' },
  holo:    { name: 'HOLO',      col: '#c27bff', price: 3, weight: 5, text: '+6 MULT.' },
  gold:    { name: 'GOLD',      col: '#feae34', price: 3, weight: 4, text: '+$2 EVERY FIREWALL YOU BREACH.' },
  corrupt: { name: 'CORRUPTED', col: '#ff3df2', price: 2, weight: 2, text: 'X2 MULT, BUT ONLY ON HALF YOUR ROLLS.' },
};
function rollEdition() {
  let r = Math.random() * 100;
  for (const [k, e] of Object.entries(EDITIONS)) if ((r -= e.weight) < 0) return k;
  return null;
}
function makeWild(id, edition = rollEdition()) {
  const state = {};
  if (id === 'keylogger') state.x = 1;
  if (id === 'cookiejar') state.chips = 0;
  if (id === 'glitch') state.face = _ri(1, 6);
  if (id === 'sandcastle') state.chips = 0;
  if (id === 'snakeoil') state.bonus = 0;
  return { kind: 'wild', id, uid: ++_uid, rarity: WILD_DEFS[id].rarity, edition, state, revealed: false };
}
const wildsOf = (run, id) => (run.wilds || []).filter(w => w.id === id);
const wildSell = w => Math.max(1, Math.floor(itemPrice(w) / 2)) + ((w.state && w.state.bonus) || 0);

// ---------- exploits (single-use hacks, fired in the HACK WINDOW after the dice land) ----------
const EXPLOIT_DEFS = {
  nudge: { name: 'NUDGE', code: 'NDG', rarity: 0, price: 3, desc: 'MOVE ONE DIE UP OR DOWN BY 1.' },
  clone: { name: 'CLONE', code: 'CLN', rarity: 1, price: 4, desc: 'COPY ONE DIE ONTO ANOTHER.' },
  nuke:  { name: 'NUKE',  code: 'NUK', rarity: 2, price: 5, desc: "REROLL ALL FIVE DICE. DOESN'T COST A ROLL." },
  force: { name: 'FORCE', code: 'FRC', rarity: 3, price: 7, desc: 'SET ONE DIE TO ANY FACE YOU WANT.' },
  flip:      { name: 'FLIP',       code: 'FLP', rarity: 0, price: 3, desc: 'TURN ONE DIE TO ITS OPPOSITE FACE (1<>6, 2<>5, 3<>4).' },
  swap:      { name: 'SWAP',       code: 'SWP', rarity: 0, price: 3, desc: 'TWO DICE TRADE FACES.' },
  reroll1:   { name: 'REROLL ONE', code: 'RR1', rarity: 0, price: 2, desc: 'REROLL A SINGLE DIE.' },
  overwrite: { name: 'OVERWRITE',  code: 'OVW', rarity: 3, price: 8, desc: 'EVERY DIE SHOWING ONE FACE BECOMES ANOTHER FACE.' },
  inject:    { name: 'INJECT',     code: 'INJ', rarity: 0, price: 3, desc: '+50 CHIPS ON THIS ROLL.' },
  rollback:  { name: 'ROLLBACK',   code: 'RBK', rarity: 1, price: 4, desc: 'ON A BUST: CANCEL THE ROLL AND GET IT BACK.' },
  siphon:    { name: 'SIPHON',     code: 'SPH', rarity: 0, price: 3, desc: 'GAIN $ EQUAL TO YOUR DICE TOTAL / 5.' },
  ping:      { name: 'PING',       code: 'PNG', rarity: 1, price: 4, desc: '+1 LEVEL TO THE HAND YOU JUST ROLLED.' },
};
const EXPLOIT_IDS = Object.keys(EXPLOIT_DEFS);
const EXPLOIT_SLOTS = 2;
function makeExploit(id) { return { kind: 'exploit', id, uid: ++_uid, rarity: EXPLOIT_DEFS[id].rarity, revealed: false }; }

// ---------- die mods (a permanent upgrade bolted onto one of your five dice) ----------
// Effects fire when that die is part of the scoring hand (WEIGHTED changes how it rolls instead).
const DIEMOD_DEFS = {
  neon:     { name: 'NEON DIE',     code: 'NEO', rarity: 0, price: 4, desc: '+15 CHIPS WHEN THIS DIE SCORES.' },
  gold:     { name: 'GOLD DIE',     code: 'GLD', rarity: 1, price: 5, desc: '+$1 EVERY TIME THIS DIE SCORES.' },
  weighted: { name: 'WEIGHTED DIE', code: 'WGT', rarity: 1, price: 5, desc: 'THIS DIE ROLLS 4, 5 AND 6 MORE OFTEN.' },
  glass:    { name: 'GLASS DIE',    code: 'GLS', rarity: 2, price: 6, desc: 'X2 MULT WHEN THIS DIE SCORES. 1 IN 6 CHANCE TO SHATTER AFTER.' },
  chrome:   { name: 'CHROME DIE',   code: 'CHR', rarity: 1, price: 5, desc: "+3 MULT WHEN THIS DIE ISN'T PART OF THE HAND." },
  lucky:    { name: 'LUCKY DIE',    code: 'LKY', rarity: 1, price: 5, desc: 'WHEN IT SCORES: 1 IN 5 FOR +20 MULT, 1 IN 15 FOR +$10.' },
  stone:    { name: 'STONE DIE',    code: 'STN', rarity: 0, price: 4, desc: 'NO FACE. ALWAYS +50 CHIPS, BUT NEVER PART OF A HAND.' },
  wild:     { name: 'WILD DIE',     code: 'WLD', rarity: 3, price: 8, desc: 'COUNTS AS WHATEVER FACE MAKES THE BEST HAND.' },
  twin:     { name: 'TWIN DIE',     code: 'TWN', rarity: 4, price: 10, desc: 'COUNTS TWICE FOR PAIRS AND KINDS (NOT STRAIGHTS).' },
  rubber:   { name: 'RUBBER DIE',   code: 'RBR', rarity: 0, price: 3, desc: 'IF IT ROLLS A 1, IT BOUNCES AND REROLLS ONCE.' },
  prism:    { name: 'PRISM DIE',    code: 'PRS', rarity: 2, price: 6, desc: 'X1.5 MULT WHEN THIS DIE SCORES.' },
  ember:    { name: 'EMBER DIE',    code: 'EMB', rarity: 1, price: 5, desc: '+1 MULT FOR EACH SCORING HAND IN A ROW IT IS PART OF.' },
};
// stickers: a decal slapped onto a die; stacks with its mod (one sticker per die)
const STICKER_DEFS = {
  red:    { name: 'RED STICKER',    code: 'RED', rarity: 2, price: 6, col: '#e43b44', desc: "THIS DIE'S CHIPS TRIGGER TWICE." },
  blue:   { name: 'BLUE STICKER',   code: 'BLU', rarity: 1, price: 5, col: '#4f9bff', desc: '+1 ROLL WHEN THIS DIE IS PART OF A DOKER.' },
  purple: { name: 'PURPLE STICKER', code: 'PRP', rarity: 2, price: 6, col: '#b46bff', desc: 'SPAWNS AN EXPLOIT WHEN IT SCORES IN A FOUR OF A KIND OR BETTER.' },
};
const STICKER_IDS = Object.keys(STICKER_DEFS);
function makeSticker(id) { return { kind: 'sticker', id, uid: ++_uid, rarity: STICKER_DEFS[id].rarity, revealed: false }; }
const dieSticker = (run, i) => (run.dieStickers || [])[i] || null;
const DIEMOD_IDS = Object.keys(DIEMOD_DEFS);
const GLASS_BREAK = 1 / 6;
function makeDieMod(id) { return { kind: 'diemod', id, uid: ++_uid, rarity: DIEMOD_DEFS[id].rarity, revealed: false }; }
const dieMod = (run, i) => (run.dieMods || [])[i] || null;

// ---------- item helpers ----------
function itemName(it) {
  if (it.kind === 'sticker') return STICKER_DEFS[it.id].name;
  if (it.kind === 'diemod') return DIEMOD_DEFS[it.id].name;
  if (it.kind === 'wild') return WILD_DEFS[it.id].name;
  if (it.kind === 'exploit') return EXPLOIT_DEFS[it.id].name;
  return it.kind === 'perk' ? PERK_DEFS[it.id].name : HANDS[it.key].proto + ' PATCH';
}
function itemCode(it) {
  if (it.kind === 'sticker') return STICKER_DEFS[it.id].code;
  if (it.kind === 'diemod') return DIEMOD_DEFS[it.id].code;
  if (it.kind === 'wild') return WILD_DEFS[it.id].code;
  if (it.kind === 'exploit') return EXPLOIT_DEFS[it.id].code;
  return it.kind === 'perk' ? PERK_DEFS[it.id].code : PATCH_CODE[it.key];
}
function itemPrice(it) {
  if (it.kind === 'sticker') return STICKER_DEFS[it.id].price;
  if (it.kind === 'diemod') return DIEMOD_DEFS[it.id].price;
  if (it.kind === 'wild') return WILD_DEFS[it.id].price + (it.edition ? EDITIONS[it.edition].price : 0);
  if (it.kind === 'exploit') return EXPLOIT_DEFS[it.id].price;
  return RARITY.price[it.rarity];
}
/** Which CARD_ART icon an item uses. */
function artKey(it) { return it.kind === 'patch' ? it.key : it.kind === 'diemod' ? 'mod_' + it.id : it.kind === 'sticker' ? 'sticker_' + it.id : it.id; }
/** Short line under the art on a card. */
function itemShort(it) {
  if (it.kind === 'sticker') return it.target != null ? 'DIE ' + (it.target + 1) : 'STICKER';
  if (it.kind === 'diemod') return it.target != null ? 'DIE ' + (it.target + 1) : 'DIE MOD';
  if (it.kind === 'wild') return it.edition ? EDITIONS[it.edition].name : '';
  if (it.kind === 'exploit') return '1 USE';
  if (it.kind === 'patch') return '+' + PATCH_BOOST[it.rarity].lv + ' LV';
  return it.revealed ? 'OK' : perkShort(it);
}

/** Short headline number for a perk card face (e.g. X2.5, +20, 15%). */
function perkShort(it) {
  const s = it.stats;
  switch (it.id) {
    case 'overclock': case 'lastcall': case 'echo': case 'cronjob': return 'X' + fmtMult(s.x);
    case 'hothand': return '+' + fmtMult(s.amt);
    case 'loaded': return s.face + ':+' + s.pct + '%';
    case 'inflation': return s.face + ':+' + s.amt;
    case 'streak': case 'bitflip': case 'interest': case 'recursion': return (it.id === 'streak' ? '+' : '') + s.pct + '%';
    case 'speedrun': return '+$' + s.amt;
    case 'patchtuesday': return '-$' + s.amt;
    case 'backdoor': return s.amt + ' FREE';
    default:
      // any other perk: show whatever number it has (+amt, Xmult or %), never "undefined"
      if (s.amt != null) return '+' + s.amt;
      if (s.x != null) return 'X' + fmtMult(s.x);
      if (s.pct != null) return s.pct + '%';
      return '';
  }
}

function itemDesc(it, show, run) {
  if (it.kind === 'sticker') return STICKER_DEFS[it.id].desc + ' STACKS WITH A DIE MOD.' + (it.target != null ? ' ON DIE ' + (it.target + 1) + '.' : ' YOU PICK WHICH DIE.');
  if (it.kind === 'diemod') return DIEMOD_DEFS[it.id].desc + (it.target != null ? ' ON DIE ' + (it.target + 1) + '.' : ' YOU PICK WHICH DIE.');
  if (it.kind === 'exploit') return EXPLOIT_DEFS[it.id].desc + ' USE IT AFTER THE DICE LAND, BEFORE THEY SCORE.';
  if (it.kind === 'wild') {
    let d = WILD_DEFS[it.id].desc(it.state);
    if (it.edition) d += ` ${EDITIONS[it.edition].name}: ${EDITIONS[it.edition].text}`;
    return d;
  }
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
  if (it.kind === 'wild') { (run.wilds = run.wilds || []).push(it); return; }
  if (it.kind === 'exploit') { (run.exploits = run.exploits || []).push(it); return; }
  if (it.kind === 'diemod') { (run.dieMods = run.dieMods || [null, null, null, null, null])[it.target ?? 0] = it.id; return; }
  if (it.kind === 'sticker') { (run.dieStickers = run.dieStickers || [null, null, null, null, null])[it.target ?? 0] = it.id; return; }
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
  mystery:   { name: 'MYSTERY PAYLOAD',   lines: ['MYSTERY', 'PAYLOAD'],price: 6, show: 5, pick: 1, pool: ['perk', 'patch', 'wild', 'exploit', 'diemod', 'sticker'], col: '#c42fa8', boost: 1 },
  dicelab:   { name: 'DICE LAB',          lines: ['DICE', 'LAB'],       price: 5, show: 3, pick: 1, pool: ['diemod', 'diemod', 'sticker'], col: '#b87a1a', boost: 1 },
  exploit:   { name: 'EXPLOIT KIT',       lines: ['EXPLOIT', 'KIT'],    price: 4, show: 3, pick: 1, pool: ['exploit'],       col: '#c43f1e', boost: 1 },
  wild:      { name: 'WILDCARD DROP',     lines: ['WILD', 'DROP'],      price: 6, show: 3, pick: 1, pool: ['wild'],          col: '#1e8c4f', boost: 1 },
  megaperk:  { name: 'MEGA PERK CACHE',   lines: ['MEGA', 'PERKS'],     price: 8, show: 6, pick: 2, pool: ['perk'],          col: '#7a3bd4', boost: 2, mega: true },
  megapatch: { name: 'MEGA PATCH BUNDLE', lines: ['MEGA', 'PATCHES'],   price: 8, show: 6, pick: 2, pool: ['patch'],         col: '#2f5fd0', boost: 2, mega: true },
};
const PACK_WEIGHTS = [['perk', 22], ['patch', 22], ['wild', 18], ['exploit', 14], ['dicelab', 14], ['mystery', 12], ['megaperk', 5], ['megapatch', 5]];
const SKIP_REWARD = 2;

function rollPackType() {
  let r = Math.random() * PACK_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of PACK_WEIGHTS) if ((r -= w) < 0) return k;
  return 'perk';
}

/** n random items from the given pools, no repeats of the same perk or hand. */
function rollItems(n, pool, boost = 1) {
  const out = [], usedPerks = [], usedHands = [], usedWilds = [], usedMods = [], usedHacks = [], usedStickers = [];
  for (let i = 0; i < n; i++) {
    const kind = _pick(pool);
    const r = RARITY.roll(boost);
    if (kind === 'sticker') {
      const opts = STICKER_IDS.filter(e => !usedStickers.includes(e)).length ? STICKER_IDS.filter(e => !usedStickers.includes(e)) : STICKER_IDS;
      const id = _pick(opts);
      usedStickers.push(id);
      out.push(makeSticker(id));
    } else if (kind === 'diemod') {
      const opts = DIEMOD_IDS.filter(e => !usedMods.includes(e)).length ? DIEMOD_IDS.filter(e => !usedMods.includes(e)) : DIEMOD_IDS;
      let t = Math.random() * opts.reduce((a, e) => a + RARITY.weights[DIEMOD_DEFS[e].rarity] ** 0.5, 0), id = opts[0];
      for (const e of opts) if ((t -= RARITY.weights[DIEMOD_DEFS[e].rarity] ** 0.5) < 0) { id = e; break; }
      usedMods.push(id);
      out.push(makeDieMod(id));
    } else if (kind === 'exploit') {
      // cheaper hacks show up more often
      const opts = EXPLOIT_IDS.filter(e => !usedHacks.includes(e)).length ? EXPLOIT_IDS.filter(e => !usedHacks.includes(e)) : EXPLOIT_IDS;
      let t = Math.random() * opts.reduce((a, e) => a + RARITY.weights[EXPLOIT_DEFS[e].rarity] ** 0.5, 0), id = opts[0];
      for (const e of opts) if ((t -= RARITY.weights[EXPLOIT_DEFS[e].rarity] ** 0.5) < 0) { id = e; break; }
      usedHacks.push(id);
      out.push(makeExploit(id));
    } else if (kind === 'wild') {
      // rarer wildcards show up less: weight by rarity
      const fresh = WILD_IDS.filter(w => !usedWilds.includes(w));
      const opts = fresh.length ? fresh : WILD_IDS;
      let t = Math.random() * opts.reduce((a, w) => a + RARITY.weights[WILD_DEFS[w].rarity] ** 0.5, 0), id = opts[0];
      for (const w of opts) if ((t -= RARITY.weights[WILD_DEFS[w].rarity] ** 0.5) < 0) { id = w; break; }
      usedWilds.push(id);
      out.push(makeWild(id));
    } else if (kind === 'perk') {
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
//  RIGS (starting loadouts) + STAKES (difficulty ladder per rig)
// ============================================================
const RIGS = [
  { id: 'stock',        name: 'STOCK',         desc: 'THE STANDARD RIG. NO TRICKS, NO CATCHES.' },
  { id: 'burner',       name: 'BURNER',        desc: '+1 ROLL EVERY FIREWALL, BUT ONE FEWER WILDCARD SLOT.' },
  { id: 'whale',        name: 'WHALE',         desc: 'START WITH $20, BUT EVERYTHING IN THE SHOP COSTS $1 MORE.' },
  { id: 'scriptkiddie', name: 'SCRIPT KIDDIE', desc: 'START WITH A RANDOM PERK AND A RANDOM EXPLOIT.', needs: 'stock' },
  { id: 'goldbug',      name: 'GOLDBUG',       desc: 'ALL FIVE DICE START GOLD. DIE MODS COST $2 MORE.', needs: 'whale' },
  { id: 'glasscannon',  name: 'GLASS CANNON',  desc: 'ALL FIVE DICE START GLASS. HUGE MULT, THEY KEEP BREAKING.', needs: 'goldbug' },
  { id: 'botnet',       name: 'BOTNET',        desc: '6 WILDCARD SLOTS AND A FREE WILDCARD. PERKS COST $1 MORE.', needs: 'scriptkiddie' },
  { id: 'phantom',      name: 'PHANTOM',       desc: 'A PERMANENT GHOST 6TH DIE FOR PAIRS AND KINDS, BUT ONLY 8 ROLLS.', needs: 'botnet' },
  { id: 'root',         name: 'ROOT',          desc: '3 EXPLOIT SLOTS, AND YOU START HOLDING FORCE.', needs: 'stake4' },
];
const RIG = Object.fromEntries(RIGS.map(r => [r.id, r]));
// each stake keeps every rule below it
const STAKES = [
  { name: 'WHITE HAT',   col: '#f4f4f4', desc: 'THE NORMAL GAME.' },
  { name: 'GREY HAT',    col: '#a9a9bd', desc: 'AN EXTRA BOSS ON FIREWALL 6.' },
  { name: 'BLACK HAT',   col: '#5a5478', desc: 'TARGETS ARE 25% HIGHER.' },
  { name: 'ZERO DAY',    col: '#e43b44', desc: 'UNUSED ROLLS ONLY PAY HALF (ROUNDED DOWN).' },
  { name: 'ICE',         col: '#2ce8f5', desc: 'NORMAL FIREWALLS GET A SMALL ICE RULE.' },
  { name: 'HONEYNET',    col: '#feae34', desc: 'SHOP PRICES +$1. REROLLS START AT $3.' },
  { name: 'TRACE',       col: '#ff3df2', desc: 'EVERY 3RD BUST RAISES THE TARGET BY 10%.' },
  { name: 'SINGULARITY', col: '#4dff88', desc: '9 ROLLS. BOSSES ALSO BRING AN ICE RULE.' },
];
// small rules for ICE (stake 5+): normal firewalls, and bosses on SINGULARITY
const ICE = {
  cold:  { name: 'COLD BOOT', text: 'THE FIRST ROLL SCORES HALF.' },
  noise: { name: 'NOISE',     text: 'ONE FEWER ROLL.' },
  tax:   { name: 'TAX',       text: 'BREACH REWARD -$2.' },
};
const ICE_IDS = Object.keys(ICE);
const stakeOf = run => run.stake || 1;
// ZERO DAY (stake 4+) changes how unused rolls pay out at a breach: 'half' (current) | 'cap3' | 'none'.
// Balance sim (tools/balance), stake 4 win rate for the random bot: none 1.4%, half 5.5%, cap3 5.8%.
let ZERO_DAY_RULE = 'half';
function unusedRollPay(run) {
  const n = run.rollsLeft;
  if (n <= 0) return 0;
  if (stakeOf(run) < 4) return n;
  if (ZERO_DAY_RULE === 'half') return Math.floor(n / 2);
  if (ZERO_DAY_RULE === 'cap3') return Math.min(3, n);
  return 0;
}
const wildSlots = run => (run.rig === 'botnet' ? 6 : run.rig === 'burner' ? 4 : WILD_SLOTS);
const exploitSlots = run => (run.rig === 'root' ? 3 : EXPLOIT_SLOTS);
function targetFor(run, r) {
  const t = RULES.target(r) * (stakeOf(run) >= 3 ? 1.25 : 1);
  return Math.round(t / 10) * 10;
}

// ---- profile: best stake beaten per rig (drives unlocks) ----
const PROFILE_KEY = 'doker.profile';
function loadProfile() {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)); if (p && p.best) return p; } catch (e) { /* none yet */ }
  return { best: {} };
}
function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* storage blocked */ } }
function rigUnlocked(p, rig) {
  const r = RIG[rig];
  if (!r.needs) return true;
  if (r.needs === 'stake4') return Object.values(p.best).some(b => b >= 4);
  return (p.best[r.needs] || 0) >= 1;
}
const stakeUnlocked = (p, rig, st) => st === 1 || (p.best[rig] || 0) >= st - 1;
function unlockHint(rig) {
  const r = RIG[rig];
  return r.needs === 'stake4' ? 'WIN ANY RIG ON ZERO DAY' : 'WIN A RUN WITH ' + RIG[r.needs].name;
}
/** Record a win; returns what it unlocked (names). */
function recordWin(rig, stake) {
  const p = loadProfile(), before = RIGS.filter(r => rigUnlocked(p, r.id)).map(r => r.id);
  const hadStake = p.best[rig] || 0;
  p.best[rig] = Math.max(hadStake, stake);
  saveProfile(p);
  const out = RIGS.filter(r => rigUnlocked(p, r.id) && !before.includes(r.id)).map(r => 'RIG: ' + r.name);
  if (stake >= hadStake && stake < STAKES.length) out.push('STAKE: ' + STAKES[stake].name + ' FOR ' + RIG[rig].name);
  return out;
}

// ============================================================
//  BOSS FIREWALLS — rounds 4 and 8 bend one rule; shown one round early
// ============================================================
const BOSSES = {
  encryption: { name: 'ENCRYPTION', short: '6S COUNT FOR NOTHING', text: 'EVERY 6 IS ENCRYPTED AND COUNTS FOR NOTHING.' },
  lag:        { name: 'LAG',        short: 'ONLY 7 ROLLS', text: 'ONLY 7 ROLLS.' },
  sandbox:    { name: 'SANDBOX',    short: 'PERKS OFFLINE', text: 'YOUR PERKS ARE OFFLINE.' },
  ddos:       { name: 'DDOS',       short: 'ONE DIE STUCK ON 1', text: 'ONE DIE IS STUCK ON 1.' },
  honeypot:   { name: 'HONEYPOT',   short: 'PAIRS SCORE NEGATIVE', text: 'PAIRS SCORE NEGATIVE.' },
};
const BOSS_ROUNDS = [4, 8];
const BOSS_BOUNTY = 2;
function rollBosses(stake = 1) {
  const ids = Object.keys(BOSSES).sort(() => Math.random() - 0.5);
  const out = {};
  (stake >= 2 ? [4, 6, 8] : BOSS_ROUNDS).forEach((r, i) => (out[r] = ids[i]));
  return out;
}
const bossOf = (run, r = run.round) => (run.bosses || {})[r] || null;

// ============================================================
//  PERK ENGINE — dice odds, rolls per firewall, scoring hooks
// ============================================================
/** Perks that are working right now (SANDBOX switches them all off). */
const activePerks = run => (run.boss === 'sandbox' ? [] : run.perks);
const perksOf = (run, id) => activePerks(run).filter(p => p.id === id);

function handStats(run, key) {
  const v = handValue(key, run.levels[key] ?? 1);
  const b = run.bonus[key] || {};
  return { chips: Math.max(1, v.chips + (b.chips || 0)), mult: Math.max(1, v.mult + (b.mult || 0)) };
}

function rollsPerRound(run) {
  let n = run.rig === 'phantom' ? 8 : stakeOf(run) >= 8 ? 9 : RULES.ROLLS;
  if (run.rig === 'burner') n += 1;
  if (run.ice === 'noise') n -= 1;
  for (const p of activePerks(run)) {
    if (p.id === 'socket') n += p.stats.amt;
    if (p.stats.catchRoll) n -= 1;
  }
  if (run.boss === 'lag') n = Math.min(n, 7);   // LAG boss: hard cap
  return Math.max(1, n);
}

/** Relative weight of faces 1..6 (index 0 unused). */
function dieWeights(run) {
  const w = [0, 1, 1, 1, 1, 1, 1];
  for (const p of activePerks(run)) {
    if (p.id === 'loaded') w[p.stats.face] *= 1 + p.stats.pct / 100;
    if (p.id === 'streak' && p.stats.stacks > 0) w[p.stats.face] *= 1 + (p.stats.pct * p.stats.stacks) / 100;
  }
  return w;
}
/** Face weights for die i: the shared odds, plus WEIGHTED's lean toward 4-6. */
function dieWeightsFor(run, i, base) {
  const w = (base || dieWeights(run)).slice();
  if (dieMod(run, i) === 'weighted') { w[4] *= 1.6; w[5] *= 1.8; w[6] *= 2; }
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
 * Which hand the dice make once wildcards bend the rules:
 *  RUBBER DUCKY 1s count as 6s · PACKET LOSS drops the lowest die · GLITCH's wild face becomes anything
 *  PHANTOM DIE may stand in for one die (pairs/kinds only) · SPOOFER lets straights skip a number.
 * Returns { key, scoring[5], sum, vals[5] (chips per die, null = dropped), dropped, phantomUsed, notes[] }.
 */
function evalHand(run, faces, phantom = 0) {
  const has = id => wildsOf(run, id).length > 0;
  const spoof = has('spoofer'), ducky = has('ducky'), glitch = wildsOf(run, 'glitch')[0];
  const notes = [];
  const vals = faces.map(f => (ducky && f === 1 ? 6 : f));
  if (ducky) faces.forEach((f, i) => { if (f === 1) notes.push({ i, txt: '1=6' }); });
  // ENCRYPTION boss: 6s are scrambled and count for nothing
  const enc = faces.map((_, i) => run.boss === 'encryption' && vals[i] === 6);
  enc.forEach((e, i) => { if (e) notes.push({ i, txt: 'ENCRYPTED' }); });
  // STONE dice have no face: never part of a hand (they pay +50 chips in the dice phase instead)
  const stone = faces.map((_, i) => dieMod(run, i) === 'stone');
  let dropped = -1;
  if (has('packetloss')) {
    faces.forEach((_, i) => { if (!enc[i] && !stone[i] && (dropped < 0 || vals[i] < vals[dropped])) dropped = i; });
  }
  const live = faces.map((_, i) => i).filter(i => i !== dropped && !enc[i] && !stone[i]);
  // GLITCH's wild face and WILD dice become whatever makes the best hand
  const wildIdx = live.filter(i => (glitch && faces[i] === glitch.state.face) || dieMod(run, i) === 'wild' || (has('quantum') && run.quantumDie === i));
  const twinIdx = live.filter(i => dieMod(run, i) === 'twin');   // TWIN dice count twice for pairs/kinds

  let best = null;
  const consider = vv => {
    const base = live.map(i => vv[i]);
    const sumReal = base.reduce((a, b) => a + b, 0);
    const options = [{ dice: base, slot: -1 }];
    if (phantom) {
      if (base.length < 5) options.push({ dice: [...base, phantom], slot: 'extra' });
      else for (let j = 0; j < base.length; j++) { const d = base.slice(); d[j] = phantom; options.push({ dice: d, slot: j }); }
    }
    if (twinIdx.length) options.slice().forEach(o => options.push({ dice: [...o.dice, ...twinIdx.map(i => vv[i])], slot: o.slot, twin: true }));
    for (const o of options) {
      const ev = evaluateDice(o.dice, { spoof });
      if ((o.slot !== -1 || o.twin) && ev.key === 'straight') continue;   // phantom/twin copies never make straights
      const r = HANDS[ev.key].tier * 1000 + sumReal - (o.slot !== -1 ? 0.5 : 0);
      if (!best || r > best.r) best = { r, ev, vv: vv.slice(), slot: o.slot, twin: !!o.twin };
    }
  };
  if (wildIdx.length) {
    for (let m = 0, total = 6 ** wildIdx.length; m < total; m++) {
      const vv = vals.slice();
      let t = m;
      for (const i of wildIdx) { vv[i] = (t % 6) + 1; t = Math.floor(t / 6); }
      consider(vv);
    }
  } else consider(vals);

  const { ev, vv, slot } = best;
  const scoring = faces.map(() => false);
  live.forEach((i, j) => { if (slot !== j) scoring[i] = ev.scoring[j]; });
  const chipVals = faces.map((_, i) => (i === dropped || enc[i] || stone[i] ? null : vv[i]));
  for (const i of wildIdx) notes.push({ i, txt: 'WILD=' + vv[i] });
  if (best.twin) for (const i of twinIdx) if (scoring[i]) notes.push({ i, txt: 'TWIN' });
  return {
    key: ev.key, scoring, sum: chipVals.reduce((a, v) => a + (v || 0), 0), vals: chipVals,
    dropped, phantomUsed: slot !== -1, notes,
  };
}

/** The face showing most (ties: the higher face). */
function mostCommonFace(faces) {
  const c = {};
  faces.forEach(f => (c[f] = (c[f] || 0) + 1));
  return +Object.entries(c).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/** One wildcard's scoring step(s). w = the card whose effect applies, src = the slot it sits in (differs for MIRROR). */
function wildSteps(run, w, src, ev, faces, ctx, steps) {
  const scoring = ev.key !== 'bust';
  const add = (kind, amt) => steps.push({ p: src, kind, amt });
  const wilds = run.wilds || [];
  switch (w.id) {
    case 'dealer': add('mult', 4); break;
    case 'mitm':
      if (ev.vals[2] != null) add('chips', ev.vals[2]);
      if (ev.scoring[2]) add('xmult', 1.5);
      break;
    case 'ransom': add('xmult', 3); break;
    case 'zeroday': if (scoring && !(run.seenKeys || []).includes(ev.key)) add('xmult', 2); break;
    case 'botnet': add('mult', 3 * wilds.length); break;
    case 'keylogger': if (w.state.x > 1) add('xmult', w.state.x); break;
    case 'packetloss': add('xmult', 2); break;
    case 'overflow': if (ev.sum >= 24) add('xmult', 2); break;
    case 'parity': {
      const v = ev.vals.filter(x => x != null);
      if (v.every(x => x % 2 === 0)) add('chips', 40);
      else if (v.every(x => x % 2 === 1)) add('mult', 8);
      break;
    }
    case 'cookiejar': {
      const c = w.state.chips + 3 * faces.filter(f => f === 1).length;
      if (c > 0) add('chips', c);
      break;
    }
    case 'bruteforce': if ((ctx.rollsRound || 1) > 1) add('mult', ctx.rollsRound - 1); break;
    case 'deadman': if (ctx.last && (ctx.scoreBefore ?? 0) < run.target) add('xmult', 4); break;
    case 'hotpotato': add('xmult', 4); break;
    case 'doubleagent': add('xmult', Math.random() < 0.5 ? 2 : 0.5); break;
    case 'captcha': if (faces.every((f, k) => k === 0 || f >= faces[k - 1])) add('xmult', 3); break;
    case 'sandcastle': add('chips', (w.state.chips || 0) + 10); break;
    case 'auditor': {
      const n = new Set([...(run.seenKeys || []), ...(scoring ? [ev.key] : [])]).size;
      if (n) add('xmult', +(1 + 0.25 * n).toFixed(2));
      break;
    }
    case 'latency':
      if (run.prevKey && run.prevKey !== 'bust') { const hs = handStats(run, run.prevKey); add('chips', hs.chips); add('mult', hs.mult); }
      break;
    case 'sudo': if (ev.vals[0] != null) add('chips', ev.vals[0]); break;
  }
}

/**
 * Score one roll. Returns the hand plus an ordered list of perk steps:
 * { p, kind: 'chips' | 'mult' | 'xmult', amt }.  ctx = { first, last, prevKey }.
 */
function scoreRoll(run, faces, ctx) {
  const ev = evalHand(run, faces, ctx.phantom || 0);
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
  const shown = ev.vals.filter(v => v != null);
  each('loworbit', p => { if (shown.length && shown.every(v => v <= 3)) steps.push({ p, kind: 'mult', amt: p.stats.amt }); });
  each('highroller', p => { if (shown.length && shown.every(v => v >= 4)) steps.push({ p, kind: 'chips', amt: p.stats.amt }); });
  each('cronjob', p => { if ((ctx.rollsRound || 0) % 4 === 0) steps.push({ p, kind: 'xmult', amt: p.stats.x }); });
  const common = mostCommonFace(faces);
  each('cachehit', p => { if (run.lastCommon && common === run.lastCommon) steps.push({ p, kind: 'chips', amt: p.stats.amt }); });
  each('sidechannel', p => { if (ev.key === 'twopair') steps.push({ p, kind: 'mult', amt: p.stats.amt }); });
  each('stackoverflow', p => { if (ev.sum >= 25) steps.push({ p, kind: 'mult', amt: p.stats.amt }); });

  // wildcards, left to right (order matters for MIRROR)
  const wilds = run.wilds || [];
  wilds.forEach((src, i) => {
    let w = src;
    if (src.id === 'mirror') { const r = wilds[i + 1]; w = r && r.id !== 'mirror' ? r : null; }
    if (w) wildSteps(run, w, src, ev, faces, ctx, steps);
    if (src.edition === 'neon') steps.push({ p: src, kind: 'chips', amt: 20 });
    if (src.edition === 'holo') steps.push({ p: src, kind: 'mult', amt: 6 });
    if (src.edition === 'corrupt' && Math.random() < 0.5) steps.push({ p: src, kind: 'xmult', amt: 2 });
  });
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
  if (key !== 'bust' && key === run.prevKey) for (const w of wildsOf(run, 'keylogger')) w.state.x = +(w.state.x + 0.1).toFixed(1);
  const ones = faces.filter(f => f === 1).length;
  for (const w of wildsOf(run, 'cookiejar')) w.state.chips += 3 * ones;
  if (key !== 'bust') (run.seenKeys = run.seenKeys || []).push(key);
  for (const w of wildsOf(run, 'sandcastle')) w.state.chips = (w.state.chips || 0) + 10;
  if (key === 'straight') for (const p of perksOf(run, 'pipeline')) {
    const b = (run.bonus.straight = run.bonus.straight || { chips: 0, mult: 0 });
    b.chips += p.stats.amt;
  }
  run.lastCommon = mostCommonFace(faces);
  run.prevKey = key;
}

function onRoundStart(run) {
  run.hotShieldUsed = false;
  run.seenKeys = [];
  run.backdoorUsed = 0;
  for (const w of wildsOf(run, 'glitch')) w.state.face = _ri(1, 6);
  for (const w of wildsOf(run, 'sandcastle')) w.state.chips = 0;
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
