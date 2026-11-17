// ============================================================
//  DOKER — tutorial: a scripted 3-firewall run with rigged dice, coached by the Dealer.
//  PLAY runs the game as normal (run.tutorial = true); this file decides the dice, the shop
//  stock and the targets, draws the coach box + highlights, and only lets through the clicks
//  the current step asks for. Offered on your first PLAY; replay from OPTIONS.
// ============================================================
const TUT = (() => {
const ROUNDS = 3;
// rigged dice, per firewall, per roll
const FACES = {
  1: [[4, 4, 1, 3, 6], [6, 2, 4, 1, 5], [5, 5, 5, 2, 6]],   // pair, bust, three of a kind (breach)
  2: [[6, 6, 6, 2, 3]],                                      // three 6s -> FORCE the 2 into a 6
  3: [[5, 5, 5, 5, 6]],                                      // DDOS jams the last die on 1: still four 5s
};
const TARGETS = { 1: 150, 2: 300, 3: 400 };

const M = () => PLAY.mode, R = () => PLAY.run, U = () => PLAY.ui, S = () => SHOP.ui;
const anim = () => ['rolling', 'scoring', 'bossintro', 'intro'].includes(M());
const rolled = n => () => R().rollsRound >= n && (M() === 'ready' || M() === 'cleared');
const breachShown = () => M() === 'cleared' && !!U().btn('BLACK');

// ---------- the script ----------
// text, at: coach box 'top' | 'mid' | 'bottom', hl: what to point at, wait: 'next' or a condition,
// show: only appear once true, keys: SPACE/ENTER pass through, free: any click passes, panel: special box.
const STEPS = [
  // ---- FIREWALL 1: rolling + scoring
  { at: 'mid', wait: 'next', text: "WELCOME TO DOKER, FRIEND. I'M THE DEALER. THE JOB: BREACH 8 FIREWALLS IN A ROW WITH FIVE DICE. LET ME SHOW YOU HOW." },
  { at: 'mid', hl: () => U().target, wait: 'next', text: 'EVERY FIREWALL HAS A TARGET. SCORE THAT MUCH BEFORE YOU RUN OUT OF ROLLS AND IT FALLS.' },
  { at: 'mid', hl: () => U().rolls, wait: 'next', text: 'YOU GET 10 ROLLS PER FIREWALL. YOUR CASH LIVES DOWN HERE TOO. YOU SPEND IT IN MY BLACK MARKET.' },
  { at: 'bottom', hl: () => U().dice, keys: true, wait: rolled(1), hint: 'CLICK A DIE OR PRESS SPACE',
    text: 'EACH ROLL THROWS ALL FIVE DICE AND SCORES THE BEST POKER HAND IN THEM. GO ON, ROLL.' },
  { at: 'mid', hl: () => U().hand, wait: 'next', text: 'A PAIR. EVERY HAND HAS CHIPS (BLUE) AND MULT (RED). THE DICE IN THE HAND ADD THEIR PIPS AS CHIPS. CHIPS X MULT = POINTS.' },
  { at: 'mid', hl: () => U().score, wait: 'next', text: 'THE POINTS GO ON YOUR SCORE. EVERY ROLL ADDS UP UNTIL YOU HIT THE TARGET.' },
  { at: 'bottom', hl: () => U().dice, keys: true, wait: rolled(2), hint: 'ROLL AGAIN', text: 'ROLL AGAIN.' },
  { at: 'mid', hl: () => U().hand, wait: 'next', text: "A BUST: NO HAND AT ALL. IT STILL SCORES A LITTLE, BUT YOU WANT BIG HANDS. HERE'S THE LADDER..." },
  { panel: 'hands', wait: 'next', text: '' },
  { at: 'bottom', hl: () => U().dice, keys: true, wait: () => R().rollsRound >= 3 && M() === 'cleared', hint: 'ROLL AGAIN', text: 'ONE MORE. FEELING LUCKY?' },
  { at: 'bottom', show: breachShown, hl: () => U().overlay, wait: 'next',
    text: "BREACHED! YOU GET PAID FOR THE FIREWALL, PLUS $1 FOR EVERY ROLL YOU DIDN'T NEED." },
  { at: 'bottom', hl: () => U().btn('BLACK'), wait: () => M() === 'shop', hint: 'CLICK BLACK MARKET', text: 'NOW, SHOPPING. STEP INTO MY OFFICE.' },

  // ---- BLACK MARKET 1: perks, wildcards, packs, reroll, exploits
  { at: 'bottom', wait: 'next', text: 'MY BLACK MARKET. BETWEEN FIREWALLS YOU SPEND YOUR CASH HERE ON UPGRADES THAT STACK UP INTO A BUILD.' },
  { at: 'top', hl: () => S().slot(0), wait: () => R().perks.length >= 1 && !SHOP.busy(), hint: 'CLICK THE PERK',
    text: 'PERKS ARE PASSIVE UPGRADES. THIS ONE ADDS CHIPS FOR EVERY 6 YOU ROLL. CLICK TO BUY.' },
  { at: 'top', hl: () => S().slot(1), wait: () => R().wilds.length >= 1 && !SHOP.busy(), hint: 'CLICK THE WILDCARD',
    text: "WILDCARDS HIT HARDER. THIS ONE'S ME: THE DEALER, +4 MULT ON EVERY ROLL." },
  { at: 'bottom', hl: () => S().wilds(), wait: 'next',
    text: 'WILDCARDS SIT ON THE TABLE AND FIRE LEFT TO RIGHT, AFTER YOUR PERKS. CLICK ONE ANY TIME TO SELL IT OR MOVE IT.' },
  { at: 'bottom', hl: () => [S().slot(2), S().slot(3)], wait: 'next',
    text: 'PACKS: PAY ONCE, PICK 1 FROM A HANDFUL OF RANDOM CARDS. PATCHES LEVEL UP A HAND. DIE MODS UPGRADE ONE DIE.' },
  { at: 'top', hl: () => S().reroll, wait: 'next', text: "DON'T LIKE THE STOCK? REROLL FOR NEW ITEMS AND PACKS. IT COSTS A LITTLE MORE EACH TIME." },
  { at: 'top', wait: 'next', enter: () => { if (!R().exploits.length) applyItem(R(), makeExploit('force')); },
    text: "AND A FREEBIE, ON THE HOUSE: FORCE. EXPLOITS ARE ONE-SHOT HACKS YOU FIRE AFTER THE DICE LAND, BEFORE THEY SCORE." },
  { at: 'top', hl: () => S().leave, wait: () => M() !== 'shop', hint: 'CLICK JACK OUT', text: "THAT'S ENOUGH SHOPPING. JACK OUT TO THE NEXT FIREWALL." },

  // ---- FIREWALL 2: the hack window
  { at: 'mid', hl: () => U().topbar, wait: 'next', text: 'SEE THE TOP BAR? THE NEXT FIREWALL IS GUARDED BY A BOSS. YOU ALWAYS GET ONE FIREWALL OF WARNING.' },
  { at: 'bottom', hl: () => U().dice, keys: true, wait: () => M() === 'hack', hint: 'ROLL', text: "LET'S SEE THAT BUILD WORK. ROLL." },
  { at: 'bottom', hl: () => U().dice, wait: 'next', text: "THREE 6S. NICE... BUT YOU'VE GOT AN EXPLOIT, SO THE HACK WINDOW OPENED. THE DICE HAVEN'T SCORED YET." },
  { at: 'bottom', hl: () => U().exploit(0), wait: () => PLAY.dbg.hack && PLAY.dbg.hack.sel >= 0, hint: 'CLICK FORCE', text: 'CLICK YOUR FORCE EXPLOIT.' },
  { at: 'bottom', hl: () => U().die(3), wait: () => PLAY.dbg.hack && PLAY.dbg.hack.die === 3, hint: 'CLICK THE 2', text: 'NOW PICK THE DIE TO REWRITE: THAT LONELY 2.' },
  { at: 'bottom', hl: () => U().faces, wait: () => !R().exploits.length, hint: 'PICK A FACE', text: 'MAKE IT A 6. FOUR OF A KIND.' },
  { at: 'mid', show: breachShown, hl: () => U().hand, wait: 'next',
    text: 'SEE THAT? THE DICE SCORED, THEN YOUR PERK ADDED CHIPS FOR THE 6S, THEN THE DEALER ADDED MULT. THAT ORDER IS EVERYTHING.' },
  { at: 'bottom', hl: () => U().btn('BLACK'), wait: () => M() === 'shop', hint: 'CLICK BLACK MARKET', text: 'BACK TO THE SHOP.' },

  // ---- BLACK MARKET 2: a pack + die mods
  { at: 'bottom', hl: () => S().slot(2), wait: () => SHOP.isOpen(), hint: 'BUY THE PACK',
    text: "THIS TIME, A PACK. THE DICE LAB HOLDS DIE MODS: UPGRADES BOLTED ONTO ONE OF YOUR DICE. YOU CAN AFFORD IT." },
  { at: 'top', free: true, dim: false, wait: () => R().dieMods.some(Boolean) || R().dieStickers.some(Boolean), hint: 'PICK A CARD, THEN A DIE',
    text: 'PICK ONE CARD, THEN CHOOSE WHICH DIE GETS IT. THAT DIE KEEPS IT FOR THE WHOLE RUN.' },
  { at: 'top', show: () => !SHOP.busy(), hl: () => S().leave, wait: () => M() !== 'shop', hint: 'CLICK JACK OUT', text: 'NOW, ABOUT THAT BOSS. JACK OUT... IF YOU DARE.' },

  // ---- FIREWALL 3: a boss
  { at: 'mid', hl: () => U().topbar, wait: 'next',
    text: 'A BOSS FIREWALL. EVERY BOSS BENDS ONE RULE, AND WATCHES YOU DO IT. THIS ONE, DDOS, JAMS ONE OF YOUR DICE ON A 1.' },
  { at: 'bottom', hl: () => U().dice, keys: true, wait: () => M() === 'cleared', hint: 'ROLL', text: 'PLAY AROUND IT. ROLL.' },
  { at: 'bottom', show: breachShown, hl: () => U().overlay, wait: 'next', text: 'FOUR 5S, EVEN WITH A DEAD DIE. BOSS DOWN. BOSSES ALSO PAY A $2 BOUNTY.' },
  { at: 'mid', wait: 'next',
    text: 'A REAL RUN IS 8 FIREWALLS. A BOSS GUARDS FIREWALL 4. FIREWALL 8 IS THE FINALE: THE HOUSE. THAT IS... ME. PLAYING TWO BOSS RULES AT ONCE.' },
  { at: 'mid', wait: 'next',
    text: 'BEAT A RUN TO UNLOCK NEW RIGS (STARTING LOADOUTS) AND HARDER STAKES. MISS A TARGET AND THE RUN IS OVER, SO BUILD SMART.' },
  { at: 'mid', wait: 'next',
    text: 'LAST TIPS: ESC SAVES YOUR RUN AND QUITS. OPTIONS HAS GAME SPEED, VOLUME, AND THIS TUTORIAL IF YOU EVER WANT IT AGAIN.' },
  { panel: 'end', wait: 'end', text: '' },
];

// ---------- state ----------
let on = false, i = 0, t = 0, typed = 0, doneT = -1, shown = false;
const step = () => STEPS[i];
function start() { on = true; i = 0; enterStep(); }
function stop() { on = false; }
function enterStep() { t = 0; typed = 0; doneT = -1; shown = false; const s = step(); if (s && s.enter) s.enter(); }
function next() { i++; if (i >= STEPS.length) { stop(); return; } enterStep(); }

function finish(real) {
  SET.tutorialDone = true; SET.tutorialOffered = true; saveSettings();
  stop();
  SFX.select();
  if (real) PLAY.newGame(); else G.goTo('menu');
}

/** Scripted dice for the roll about to be thrown. */
function faces() { const q = FACES[R().round] || []; return (q[R().rollsRound - 1] || q[q.length - 1] || [3, 3, 3, 1, 2]).slice(); }
/** Shop stock for the Black Market after firewall r (prices match exactly what you have). */
function shop(run) {
  if (run.round === 1) {
    const perk = makePerk('inflation', 1); perk.stats.face = 6;
    const wild = makeWild('dealer', null);
    run.money = Math.max(run.money, itemPrice(perk) + itemPrice(wild));   // never less than you earned
    return { items: [perk, wild], packs: [{ type: 'perk', sold: false }, { type: 'patch', sold: false }], rerollCost: 2 };
  }
  run.money = Math.max(run.money, PACKS.dicelab.price);
  return { items: [null, null], packs: [{ type: 'dicelab', sold: false }, { type: 'mystery', sold: true }], rerollCost: 2 };
}

// ---------- per frame ----------
function visible() {
  const s = step();
  if (!s) return false;
  if (s.panel) return true;
  if (M() !== 'shop' && anim()) return false;
  return s.show ? s.show() : true;
}
function update(dt) {
  if (!on) return;
  const s = step();
  if (!s) return;
  shown = visible();
  if (!shown) return;
  t += dt;
  typed = Math.min(s.text.length, typed + dt * 90);
  if (typeof s.wait === 'function' && s.wait()) {
    if (doneT < 0) doneT = 0;
    if ((doneT += dt) > 0.35) next();
  }
}

// ---------- input: returns true if the tutorial ate it ----------
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const rects = s => { const h = s.hl ? s.hl() : null; return !h ? [] : Array.isArray(h) ? h.filter(Boolean) : [h]; };
const END_BTN = { real: { x: 120, y: 150, w: 70, h: 15 }, menu: { x: 196, y: 150, w: 70, h: 15 } };   // placed in drawEnd

function onPointer(x, y) {
  if (!on) return false;
  const s = step();
  if (!shown) return M() !== 'bossintro';               // let you skip the boss intro, nothing else
  if (s.wait === 'end') {
    if (inR(x, y, END_BTN.real)) finish(true);
    else if (inR(x, y, END_BTN.menu)) finish(false);
    return true;
  }
  if (s.wait === 'next') { advance(); return true; }
  if (s.free || SHOP.busy() && M() === 'shop') return false;
  return !rects(s).some(r => inR(x, y, r));            // clicks only land on what I'm pointing at
}
function onKey(k) {
  if (!on || k === 'escape') return false;               // ESC always leaves
  const s = step();
  if (!shown) return !(M() === 'bossintro' && (k === ' ' || k === 'enter'));
  if (k !== ' ' && k !== 'enter') return true;
  if (s.wait === 'end') { finish(true); return true; }
  if (s.wait === 'next') { advance(); return true; }
  return !s.keys;
}
function advance() {
  const s = step();
  if (typed < s.text.length) { typed = s.text.length; return; }   // first click finishes the typing
  SFX.select(); next();
}

// ---------- draw ----------
function dim(rs, a) {
  const { ctx, W, H } = G;
  ctx.save();
  ctx.globalAlpha = a; ctx.fillStyle = PAL.ink;
  ctx.beginPath(); ctx.rect(0, 0, W, H);
  rs.forEach(r => ctx.rect(r.x, r.y, r.w, r.h));
  ctx.fill('evenodd');
  ctx.restore();
}
function frame(r, col) {
  const { rect } = G, p = Math.floor(G.T * 4) % 2;
  const c = p ? col : PAL.white;
  rect(r.x - 1, r.y - 1, r.w + 2, 1, c); rect(r.x - 1, r.y + r.h, r.w + 2, 1, c);
  rect(r.x - 1, r.y, 1, r.h, c); rect(r.x + r.w, r.y, 1, r.h, c);
}
function drawCoach(s) {
  const { text, rect } = G;
  const lines = wrapText(s.text.slice(0, Math.floor(typed)), 44);
  const full = wrapText(s.text, 44).length;
  const w = 278, h = 24 + full * 9, x = 104;
  const y = s.at === 'top' ? 14 : s.at === 'bottom' ? 203 - h : 60;
  UI.panel(x, y, w, h, PAL.green);
  // a tiny Dealer: hood + green eyes
  rect(x + 5, y + 4, 9, 7, PAL.purple); rect(x + 6, y + 6, 7, 5, PAL.ink);
  if (Math.floor(G.T * 1.3) % 5) { rect(x + 7, y + 8, 2, 1, PAL.green); rect(x + 10, y + 8, 2, 1, PAL.green); }
  text('THE DEALER', x + 18, y + 4, PAL.green);
  text('TUTORIAL ' + (i + 1) + '/' + STEPS.length, x + w - 5, y + 4, '#5a4c99', { align: 'right' });
  lines.forEach((l, k) => text(l, x + 5, y + 15 + k * 9, PAL.white));
  if (typed >= s.text.length) {
    const blink = Math.floor(G.T * 2.5) % 2 === 0;
    if (s.wait === 'next') { if (blink) text('CLICK TO CONTINUE', x + w - 5, y + h - 9, '#8a7fc0', { align: 'right' }); }
    else if (s.hint) text('> ' + s.hint, x + w - 5, y + h - 9, blink ? PAL.gold : '#b8860b', { align: 'right' });
  }
}
function drawHands() {
  const { text, rect } = G;
  const x = 60, y = 20, w = 264, h = 176;
  UI.panel(x, y, w, h, PAL.cyan);
  text('THE HANDS', x + w / 2, y + 5, PAL.cyan, { align: 'center', scale: 2 });
  text('HAND', x + 8, y + 23, '#5a4c99'); text('ON SCREEN', x + 112, y + 23, '#5a4c99'); text('CHIPS X MULT', x + w - 8, y + 23, '#5a4c99', { align: 'right' });
  const keys = ['bust', 'pair', 'twopair', 'three', 'full', 'straight', 'four', 'doker'];
  keys.forEach((k, n) => {
    const hd = HANDS[k], yy = y + 36 + n * 13;
    text(hd.name, x + 8, yy, hd.col);
    text(hd.proto, x + 112, yy, '#8a7fc0');
    text(hd.chips + ' X ' + hd.mult, x + w - 8, yy, PAL.white, { align: 'right' });
    if (n < keys.length - 1) rect(x + 8, yy + 10, w - 16, 1, '#2e2260');
  });
  text('LEVEL UP A HAND WITH PATCHES.', x + 8, y + h - 26, '#c9c3ea');
  if (Math.floor(G.T * 2.5) % 2 === 0) text('CLICK TO CONTINUE', x + w - 8, y + h - 13, '#8a7fc0', { align: 'right' });
}
function drawEnd() {
  const { text } = G;
  const x = 92, y = 66, w = 200, h = 106;
  UI.panel(x, y, w, h, PAL.gold);
  text('TUTORIAL', x + w / 2, y + 6, PAL.gold, { align: 'center', scale: 2 });
  text('COMPLETE', x + w / 2, y + 22, PAL.gold, { align: 'center', scale: 2 });
  text("YOU'RE READY. PROBABLY.", x + w / 2, y + 44, PAL.white, { align: 'center' });
  text('THE HOUSE IS WAITING.', x + w / 2, y + 56, '#c9c3ea', { align: 'center' });
  const m = G.mouse;
  UI.button({ ...END_BTN.real, label: 'PLAY >', ...UI.BTN.green }, m.inside && inR(m.x, m.y, END_BTN.real));
  UI.button({ ...END_BTN.menu, label: 'MENU', ...UI.BTN.blue }, m.inside && inR(m.x, m.y, END_BTN.menu));
}
function render() {
  if (!on || !shown) return;
  const s = step();
  if (s.panel) { dim([], 0.7); if (s.panel === 'hands') drawHands(); else drawEnd(); return; }
  const rs = rects(s);
  if (s.dim !== false) dim(rs, s.wait === 'next' ? 0.6 : 0.5);
  rs.forEach(r => frame(r, PAL.green));
  drawCoach(s);
}

/** (test harness) what the current step wants */
function dbg() { const s = step(); return s && { i, shown, end: s.wait === 'end', next: s.wait === 'next' || !!s.panel && s.wait !== 'end', free: !!s.free, rects: shown ? rects(s) : [] }; }

return { ROUNDS, dbg, start, stop, update, render, onPointer, onKey, faces, shop, target: r => TARGETS[r] || 300, get on() { return on; } };
})();
