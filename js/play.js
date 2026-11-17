// ============================================================
//  DOKER — THE TABLE (a run: 8 firewalls, Black Market between)
//  Sidebar = run info + chips x mult. Felt = 5 dice slots.
//  Perk strip under the felt. Uses window.G, UI, SHOP, items.js.
// ============================================================
const PLAY = (() => {
'use strict';

// ---------- layout ----------
const N = 5, SLOT = 44, GAP = 9;
const TX = 106, TY = 22, TW = 272, TH = 146;          // felt table
const CX = TX + TW / 2;
const SX0 = TX + Math.floor((TW - (N * SLOT + (N - 1) * GAP)) / 2);
const SY = 58;
const REST = SY + 38;
const SBX = 4, SBW = 96;                              // sidebar
const OX = TX + 20, OW = TW - 40, OY = 34, OH = 124;  // overlay panel
const PSX = TX, PSY = 174, BADGE_W = 24, BADGE_H = 11, BADGE_GAP = 3, BADGES_PER_ROW = 10;
const CHIPS_BOX = { x: SBX + 4 + 19, y: 120 }, MULT_BOX = { x: SBX + SBW - 4 - 19, y: 120 };
const WW = 40, WH = 28, WG = 6, WY = 25;                                  // wildcard row on the felt
const WX0 = TX + Math.floor((TW - (WILD_SLOTS * WW + (WILD_SLOTS - 1) * WG)) / 2);

// ---------- timings ----------
const AIR = 0.62, SETTLE = 0.42, STAGGER = 0.2, FLIPS = 5, INTRO = 1.5;

const TABLE_RAMP = [[4,10,12],[8,16,22],[12,24,32],[18,30,46],[26,36,60],[34,44,74],[44,54,90]];
const TICK = '*** BREACH ALL 8 FIREWALLS *** SCORE = (HAND CHIPS + DICE) X MULT *** PERKS TRIGGER AFTER THE DICE, THEN WILDCARDS LEFT TO RIGHT *** CLICK A WILDCARD TO SELL OR MOVE IT *** SPACE = ROLL   ESC = MENU   M = MUTE   N = MUSIC *** ';
const HEX = '0123456789ABCDEF';

// ---------- state ----------
let run = null;
let mode = 'intro';        // intro | ready | rolling | scoring | cleared | failed | won | shop
let modeT = 0, enterT = 0, shownScore = 0;
let dice = [], parts = [], rings = [], floats = [];
let result = null, cur = null;
let seq = [], seqT = 0;
let reward = null;
let btns = [], hoverBtn = -1, prevHoverBtn = -1;
let hover = -1, prevHover = -1, menuHover = false, prevMenuHover = false;
let hoverPerk = -1, prevHoverPerk = -1;
let hoverWild = -1, prevHoverWild = -1, selWild = -1, wbtns = [], hoverWBtn = -1, prevHoverWBtn = -1;
const badgePop = new Map();
let felt = null;
let auto = false;

let pendingContinue = false;
let dokerEv = null, forceFaces = null;          // the DOKER!! event (five of a kind): { t, face, parts }
const DOKER_LEN = 3.6;

// ---------- autosave (so a crash or a trip to the menu never wipes a run) ----------
const SAVE_KEY = 'doker.save.v1';
function saveRun(phase, extra) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, phase, run, ...extra })); } catch (e) { /* storage blocked */ }
}
function loadSave() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); return d && d.v === 1 && d.run ? d : null; } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

const slotX = i => SX0 + i * (SLOT + GAP);
const wildX = i => WX0 + i * (WW + WG);
const canEditWilds = () => mode === 'ready' || mode === 'intro';
/** Which music should be playing: the boss's own track while it's alive. */
const track = () => (run && run.boss && BOSS.active() && mode !== 'shop' ? 'boss_' + run.boss : 'table');
/** What the boss actor (js/boss.js) is allowed to touch on the table. */
const bossHooks = {
  TX, TY, TW, TH, dieX: i => dieX(i), dieTop: SY + 6, resultY: 120,
  face: i => dice[i].face,
  setFace: (i, f) => { const d = dice[i]; d.face = f; d.flash = 1; d.pop = 1; burst(i, 12, 1.2); },
  float: (x, y, txt, col, big) => floats.push({ x, y, txt, col, life: 1.2, big }),
  spark: (x, y) => parts.push({ x, y, vx: G.rand(-90, 90), vy: G.rand(-150, -30), life: G.rand(0.3, 0.7), col: G.pick([PAL.red, PAL.white, PAL.magenta, PAL.gold]), s: Math.random() < 0.3 ? 2 : 1 }),
  rollsBox: { x: SBX, y: 158 },
  get perkBox() { return { x: PSX, y: PSY, w: TW, h: run.perks.length > BADGES_PER_ROW ? BADGE_H * 2 + 3 : BADGE_H }; },
  encrypted: i => dice[i].face === 6 || (dice[i].face === 1 && wildsOf(run, 'ducky').length > 0),
};

function removeWild(w) {
  const k = run.wilds.indexOf(w);
  if (k >= 0) run.wilds.splice(k, 1);
  selWild = -1;
}
function wildFloat(w, txt, col, big) {
  const k = run.wilds.indexOf(w);
  floats.push({ x: wildX(Math.max(0, k)) + WW / 2, y: WY + WH + 2, txt, col, life: 1.1, big });
}
const dieX = i => slotX(i) + SLOT / 2;
const slotDrop = i => G.clamp((enterT - 0.15 - i * 0.07) / 0.45, 0, 1);
const isOverlay = () => mode === 'cleared' || mode === 'failed' || mode === 'won';

/** Schedule fn to run `t` seconds from now. */
function at(t, fn) { seq.push({ t: seqT + t, fn }); }

// ------------------------------------------------------------
//  felt table art (built once)
// ------------------------------------------------------------
function buildFelt() {
  const [c, g] = newCanvas(TW, TH);
  const ramp = ['#07231a', '#0b2f22', '#0f3b2a', '#134833', '#17543b'];
  const B = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  for (let y = 0; y < TH; y++)
    for (let x = 0; x < TW; x++) {
      const u = (x - TW / 2) / (TW / 2), v = (y - TH / 2) / (TH / 2);
      const r = Math.sqrt(u * u * 0.7 + v * v);
      const f = G.clamp(1 - r * 0.7, 0, 0.999) * (ramp.length - 1);
      let n = f | 0;
      if (f - n > (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16) n++;
      g.fillStyle = ramp[Math.min(n, ramp.length - 1)];
      g.fillRect(x, y, 1, 1);
    }
  let s = 1337;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  for (let k = 0; k < 14; k++) {
    const left = rnd() < 0.5;
    let x = left ? 0 : TW - 1, y = 6 + Math.floor(rnd() * (TH - 12));
    const dir = left ? 1 : -1, dy = rnd() < 0.5 ? 1 : -1;
    for (const [sx, sy, len] of [[dir, 0, 6 + rnd() * 22], [dir, dy, 4 + rnd() * 10], [dir, 0, 4 + rnd() * 14]])
      for (let i = 0; i < len; i++) { px(x, y, '#1a5c40'); x += sx; y += sy; }
    g.fillStyle = '#1a5c40'; g.fillRect(x - 1, y - 1, 3, 3);
    px(x, y, '#2f8f5f');
  }
  g.clearRect(0, 0, 1, 1); g.clearRect(TW - 1, 0, 1, 1); g.clearRect(0, TH - 1, 1, 1); g.clearRect(TW - 1, TH - 1, 1, 1);
  return c;
}

// ------------------------------------------------------------
//  run flow
// ------------------------------------------------------------
function enter() {
  if (!felt) felt = buildFelt();
  enterT = 0;
  parts = []; rings = []; floats = [];
  dice = Array.from({ length: N }, (_, i) => ({
    face: i + 1, theme: 'bone', phase: 'idle', t: 0, delay: 0, final: 1, flipTo: 0, flips: 0,
    h: 0, sq: 1, sx: 1, sy: 1, jx: 0, flash: 0, pop: 0, trail: [], scoring: false, label: '', entered: false,
  }));
  if (pendingContinue && continueRun()) { pendingContinue = false; return; }
  pendingContinue = false;
  newRun();
}

/** Resume the autosaved run. Returns false if there is nothing (valid) to resume. */
function continueRun() {
  const d = loadSave();
  if (!d) return false;
  run = d.run;
  run.wilds = run.wilds || [];
  if (!run.bosses) { run.bosses = rollBosses(); run.boss = bossOf(run); }
  // keep new item ids unique past the restored ones
  for (const p of run.perks) if (p.uid > _uid) _uid = p.uid;
  if (d.shop) for (const it of [...(d.shop.items || []), ...((d.shop.pack && d.shop.pack.items) || [])]) if (it && it.uid > _uid) _uid = it.uid;
  if (d.phase === 'shop') { shownScore = run.score; openShop(d.shop); }
  else if (d.phase === 'cleared') { shownScore = run.score; nextFirewall(); }
  else {
    shownScore = run.score;
    result = null; cur = null; reward = null; seq = []; seqT = 0;
    dice.forEach(dd => (dd.scoring = false));
    BOSS.setup(run, bossHooks); BOSS.resume();
    MUSIC.play(track());
    setMode('intro');
  }
  return true;
}

function newRun() {
  run = {
    round: 0, target: 0, score: 0, rollsLeft: 0, rollsRound: 0, money: RULES.START_MONEY, rollsUsed: 0,
    levels: {}, bonus: {}, perks: [], wilds: [], hot: 0, pity: 0, prevKey: null, hotShieldUsed: false, phantom: 0, seenKeys: [],
    bosses: rollBosses(), boss: null, ddosDie: -1,
  };
  startRound(1);
}

function startRound(r) {
  run.round = r;
  run.target = RULES.target(r);
  run.score = 0; shownScore = 0;
  run.boss = bossOf(run);
  run.ddosDie = run.boss === 'ddos' ? G.randi(0, N - 1) : -1;
  onRoundStart(run);
  run.rollsLeft = rollsPerRound(run);
  run.rollsRound = 0;
  result = null; cur = null; reward = null; seq = []; seqT = 0;
  dice.forEach(d => (d.scoring = false));
  BOSS.setup(run, bossHooks);
  if (run.boss) { setMode('bossintro'); BOSS.intro(() => setMode('ready')); }
  else { setMode('intro'); if (r > 1) SFX.whoosh(); }
  MUSIC.play(track());   // after setMode: coming from the shop, mode must no longer be 'shop'
  saveRun('round');
}

function setMode(m) { mode = m; modeT = 0; btns = []; hoverBtn = prevHoverBtn = -1; }

function rollAll() {
  if (mode !== 'ready') return;
  selWild = -1;
  if (MUSIC.name === 'doker') MUSIC.play(track());     // the party ends when you roll again
  run.rollsLeft--; run.rollsUsed++; run.rollsRound++;
  result = null; cur = null;
  setMode('rolling');
  // RANSOMWARE takes its cut before the dice leave your hand
  for (const w of wildsOf(run, 'ransom')) {
    if (run.money >= 1) { run.money--; wildFloat(w, '-$1', PAL.red); }
    else { wildFloat(w, 'DELETED', PAL.red); removeWild(w); SFX.deny(); G.glitch(0.3); }
  }
  const w = dieWeights(run);
  run.phantom = wildsOf(run, 'phantom').length ? rollFace(w) : 0;
  dice.forEach(d => (d.dropped = false));
  const finals = forceFaces ? forceFaces.slice() : dice.map(() => rollFace(w));
  forceFaces = null;
  const flips = bitFlips(run, finals);
  if (run.ddosDie >= 0) delete flips[run.ddosDie];
  const freeze = BOSS.beforeRoll();
  dice.forEach((d, i) => Object.assign(d, {
    phase: 'wait', t: 0, delay: i * STAGGER + freeze, final: finals[i], flipTo: flips[i] || 0, flips: 0, scoring: false,
  }));
  SFX.rollStart();
  G.glitch(0.08);
  saveRun('round');
}

// ------------------------------------------------------------
//  scoring:  hand -> each die adds chips -> perks -> x mult -> score
// ------------------------------------------------------------
function popPerk(p) { badgePop.set(p.uid, 1); }

function startScoring() {
  const faces = dice.map(d => d.face);
  const sc = scoreRoll(run, faces, {
    first: run.rollsRound === 1, last: run.rollsLeft === 0, prevKey: run.prevKey,
    rollsRound: run.rollsRound, scoreBefore: run.score, phantom: run.phantom,
  });
  const h = HANDS[sc.key];
  const lv = run.levels[sc.key] ?? 1;
  result = { key: sc.key, name: h.name, col: h.col, tier: h.tier };
  cur = { proto: h.proto, lv, col: h.col, chips: 0, mult: 0, total: 0, showTotal: false, cp: 0, mp: 0, tp: 0 };
  dice.forEach((d, i) => { d.scoring = sc.scoring[i]; d.dropped = sc.vals[i] == null; });
  setMode('scoring');
  // rule-benders announce themselves on the dice
  sc.notes.forEach(n => at(0.05, () => floats.push({ x: dieX(n.i), y: SY - 16, txt: n.txt, col: PAL.magenta, life: 1.2 })));
  if (sc.dropped >= 0) at(0.05, () => { floats.push({ x: dieX(sc.dropped), y: SY - 16, txt: 'DROPPED', col: '#8a7fc0', life: 1.2 }); wildsOf(run, 'packetloss').forEach(popPerk); });
  const honeypot = run.boss === 'honeypot' && sc.key === 'pair';
  BOSS.onScore(sc.key);
  if (sc.phantomUsed) at(0.05, () => wildsOf(run, 'phantom').forEach(w => { popPerk(w); wildFloat(w, 'GHOST ' + run.phantom, PAL.cyan); }));

  const isDoker = sc.key === 'doker';
  let t = isDoker ? startDokerEvent(faces) : 0;
  at(t, () => {
    cur.chips = sc.base.chips; cur.mult = sc.base.mult; cur.cp = 1; cur.mp = 1;
    SFX.hand(h.tier);
    if (h.tier >= 3) for (let i = 0; i < N; i++) if (dice[i].scoring) burst(i, 8, 1.4);
    if (h.tier >= 5) { G.flash(0.25); G.shake(3); }
    if (h.tier === 7) { G.glitch(0.7); G.flash(0.6); }
  });
  t += 0.55;
  for (let i = 0; i < N; i++) {
    at(t, () => {
      const d = dice[i], v = sc.vals[i];
      if (v == null) return;
      d.pop = 1;
      cur.chips += v; cur.cp = 1;
      floats.push({ x: dieX(i), y: SY - 8, txt: '+' + v, col: '#7d9bff', life: 0.9 });
      SFX.chip(i);
    });
    t += 0.13;
  }
  // perk triggers, one at a time
  sc.steps.forEach((s, k) => {
    t += 0.12;
    at(t, () => {
      popPerk(s.p);
      if (s.p.kind === 'wild') wildFloat(s.p, itemName(s.p), RARITY.col[s.p.rarity]);
      else {
        const bx = badgeXY(run.perks.indexOf(s.p));
        floats.push({ x: bx.x + BADGE_W / 2, y: bx.y - 9, txt: PERK_DEFS[s.p.id].name, col: RARITY.col[s.p.rarity], life: 1.1 });
      }
      if (s.kind === 'chips') {
        cur.chips += s.amt; cur.cp = 1;
        floats.push({ x: CHIPS_BOX.x, y: CHIPS_BOX.y, txt: '+' + fmtNum(s.amt), col: '#7d9bff', life: 0.9 });
        SFX.chip(5 + k);
      } else if (s.kind === 'mult') {
        cur.mult += s.amt; cur.mp = 1;
        floats.push({ x: MULT_BOX.x, y: MULT_BOX.y, txt: '+' + fmtMult(s.amt), col: PAL.red, life: 0.9 });
        SFX.multAdd();
      } else {
        cur.mult *= s.amt; cur.mp = 1;
        floats.push({ x: MULT_BOX.x, y: MULT_BOX.y, txt: 'X' + fmtMult(s.amt), col: PAL.red, life: 1.0, big: true });
        SFX.xmult(); G.shake(2);
      }
    });
    t += 0.3;
  });
  t += 0.2;
  at(t, () => {
    cur.total = Math.round(cur.chips * cur.mult) * (honeypot ? -1 : 1);
    cur.showTotal = true; cur.tp = 1;
    if (honeypot) { floats.push({ x: CX, y: 104, txt: 'HONEYPOT!', col: PAL.red, life: 1.4, big: true }); SFX.deny(); G.glitch(0.4); BOSS.bite(); }
    const power = cur.total / run.target;
    SFX.multHit(power);
    G.shake(Math.min(5, 1 + power * 5));
  });
  t += 0.75;
  at(t, () => {
    run.score = Math.max(0, run.score + cur.total); SFX.coin(); afterRoll(run, sc.key, faces);
    if (run.score < run.target) BOSS.react(sc.key);
    // CRYPTO MINER pays out for every 6
    const sixes = faces.filter(f => f === 6).length;
    if (sixes) for (const w of wildsOf(run, 'miner')) { run.money += sixes; popPerk(w); wildFloat(w, '+$' + sixes, PAL.gold); }
  });
  t += 0.6;
  at(t, endRoll);
}

/** DOKER!! — five of a kind stops the game: the logo slams in, the music changes, the announcer screams. */
function startDokerEvent(faces) {
  dokerEv = { t: 0, face: faces[0] || 6, parts: [], slammed: 0 };
  MUSIC.play('doker');
  VOICE.play('doker');
  SFX.hand(7); SFX.glitch();
  G.flash(1); G.shake(8); G.glitch(1);
  return DOKER_LEN;
}

/** Click/space during the event: jump to its end (the scoring sequence catches up). */
function skipDoker() {
  const rem = DOKER_LEN - 0.3 - dokerEv.t;
  if (rem > 0) { dokerEv.t += rem; seqT += rem; dokerEv.slammed = 5; }
}

function updateDokerEvent(dt) {
  const e = dokerEv;
  e.t += dt;
  // letters slam in one by one
  const due = Math.min(5, Math.floor((e.t - 0.35) / 0.17) + 1);
  while (e.slammed < due) { SFX.slam(e.slammed); G.shake(5); e.slammed++; if (e.slammed === 5) { G.flash(0.6); SFX.breach(); } }
  // fireworks
  if (e.t > 1.0 && e.t < DOKER_LEN - 0.4 && Math.random() < dt * 9) {
    const fx = G.rand(30, G.W - 30), fy = G.rand(30, 120), col = G.pick([PAL.magenta, PAL.cyan, PAL.gold, PAL.green, PAL.white]);
    for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2; e.parts.push({ x: fx, y: fy, vx: Math.cos(a) * G.rand(40, 110), vy: Math.sin(a) * G.rand(40, 110), life: G.rand(0.6, 1.1), col }); }
    SFX.chip(Math.floor(Math.random() * 6));
  }
  for (const p of e.parts) { p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  e.parts = e.parts.filter(p => p.life > 0);
  if (e.t >= DOKER_LEN) dokerEv = null;
}

function drawDokerEvent() {
  const e = dokerEv;
  if (!e) return;
  const { ctx, rect, text, W, H, T, clamp, easeOutBack } = G;
  const t = e.t;
  const a = Math.min(clamp(t / 0.15, 0, 1), clamp((DOKER_LEN - t) / 0.35, 0, 1));
  const cx = W / 2, cy = 84;
  ctx.globalAlpha = 0.9 * a; rect(0, 0, W, H, '#05030c');
  // spinning rainbow rays
  const rays = ['#ff3df2', '#2ce8f5', '#feae34', '#4dff88'];
  for (let k = 0; k < 28; k++) {
    const ang = k / 28 * Math.PI * 2 + t * 0.9;
    ctx.globalAlpha = 0.28 * a;
    for (let r = 20; r < 260; r += 2) rect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.75), 2 + (r > 120 ? 1 : 0), 2, rays[k % 4]);
  }
  // the five dice orbit the logo
  ctx.globalAlpha = a;
  const spin = t * (5 - Math.min(3.5, t * 1.4));
  for (let i = 0; i < 5; i++) {
    const ang = i / 5 * Math.PI * 2 + spin;
    const dx = cx + Math.cos(ang) * 150, dy = cy + 6 + Math.sin(ang) * 58;
    const img = DIE.bone[e.face];
    ctx.drawImage(img, Math.round(dx - 16), Math.round(dy - 16), 32, 32);
  }
  // DOKER logo slams in letter by letter
  const imgs = [LOGO_GLYPH.D, LOGO_DIE[e.face], LOGO_GLYPH.K, LOGO_GLYPH.E, LOGO_GLYPH.R];
  const S = 4, gap = 4;
  const total = imgs.reduce((s2, im) => s2 + im.width * S, 0) + gap * 4;
  let x = cx - total / 2;
  imgs.forEach((im, i) => {
    const lt = t - 0.35 - i * 0.17;
    if (lt < 0) { x += im.width * S + gap; return; }
    const p = easeOutBack(clamp(lt / 0.22, 0, 1));
    const sc = S * (2.6 - 1.6 * p), w = im.width * sc, h = im.height * sc;
    const bob = Math.round(Math.sin(T * 7 + i * 0.9) * 2 * clamp(lt - 0.3, 0, 1));
    const lx = Math.round(x + im.width * S / 2 - w / 2), ly = Math.round(cy - h / 2 + bob);
    ctx.globalAlpha = a * 0.7;
    const o = Math.round(1 + Math.abs(Math.sin(T * 13 + i)) * 3);
    ctx.drawImage(tinted(im, PAL.cyan), lx - o, ly, w, h);
    ctx.drawImage(tinted(im, PAL.magenta), lx + o, ly, w, h);
    ctx.globalAlpha = a;
    ctx.drawImage(im, lx, ly, w, h);
    x += im.width * S + gap;
  });
  // !! and the subtitle
  if (t > 1.3) {
    const p = clamp((t - 1.3) / 0.25, 0, 1);
    ctx.globalAlpha = a * p;
    const col = rays[Math.floor(T * 10) % 4];
    text('!!', cx + total / 2 + 12, cy - 18, col, { scale: 4, outline: PAL.ink });
    text('FIVE OF A KIND', cx, cy + 40, PAL.white, { align: 'center', scale: 2, outline: PAL.ink, wave: 1, t: T });
    text('THE HOUSE IS BROKEN', cx, cy + 62, col, { align: 'center', outline: PAL.ink });
  }
  // fireworks
  for (const pp of e.parts) { ctx.globalAlpha = a * clamp(pp.life * 2, 0, 1); rect(Math.round(pp.x), Math.round(pp.y), 2, 2, pp.col); }
  ctx.globalAlpha = 1;
}

function endRoll() {
  if (run.score >= run.target) breach();
  else if (run.rollsLeft <= 0) {
    const fw = wildsOf(run, 'firewall')[0];
    if (fw) { wildFloat(fw, 'FIREWALL BURNED', PAL.orange, true); removeWild(fw); G.flash(0.4); G.shake(4); breach(); }
    else fail();
  }
  else { setMode('ready'); saveRun('round'); }
}

function breach() {
  setMode('cleared');
  BOSS.defeat();
  const rows = [['BREACH REWARD', RULES.reward(run.round)]];
  if (run.rollsLeft > 0) rows.push(['UNUSED ROLLS X' + run.rollsLeft, run.rollsLeft]);
  const intr = interestFor(run);
  if (intr > 0) rows.push(['COMPOUND INTEREST', intr]);
  if (run.boss) rows.push(['BOSS BOUNTY', BOSS_BOUNTY]);
  const gold = run.wilds.filter(w => w.edition === 'gold').length;
  if (gold) rows.push(['GOLD WILDCARD' + (gold > 1 ? 'S X' + gold : ''), 2 * gold]);
  reward = { rows, total: rows.reduce((a, r) => a + r[1], 0), shown: 0 };
  SFX.breach();
  G.flash(0.35); G.glitch(0.25);
  for (let i = 0; i < N; i++) burst(i, 14, 1.8);
  rows.forEach((_, i) => at(0.45 + i * 0.3, () => { reward.shown = i + 1; SFX.coin(); }));
  at(0.45 + rows.length * 0.3, () => { reward.shown = rows.length + 1; run.money += reward.total; SFX.select(); saveRun('cleared'); });
}

function fail() {
  setMode('failed');
  BOSS.gloat();
  clearSave();
  SFX.fail();
  G.glitch(0.7); G.shake(5);
}

function nextFirewall() {
  SFX.select();
  if (run.round >= RULES.ROUNDS) { clearSave(); setMode('won'); SFX.hand(7); G.flash(0.7); G.glitch(0.5); return; }
  G.glitch(0.3); SFX.whoosh();
  openShop(null);
}

function openShop(snap) {
  setMode('shop');
  MUSIC.play(track());
  SHOP.enter(run, () => { G.glitch(0.3); startRound(run.round + 1); }, snapShop => saveRun('shop', { shop: snapShop }), snap);
}

// ------------------------------------------------------------
//  update
// ------------------------------------------------------------
function burst(i, n, up) {
  for (let k = 0; k < n; k++)
    parts.push({
      x: dieX(i) + G.rand(-14, 14), y: REST - 1,
      vx: G.rand(-100, 100), vy: G.rand(-180, -40) * (up || 1),
      life: G.rand(0.35, 0.8), col: G.pick([PAL.white, PAL.green, PAL.gold, PAL.mint]), s: Math.random() < 0.3 ? 2 : 1,
    });
}

function land(d, i) {
  Object.assign(d, { phase: 'land', t: 0, h: 0, trail: [], face: d.final, theme: 'bone', flash: 1, sq: 1, jx: 0 });
  G.shake(1.5 + i * 0.5);
  SFX.slam(i);
  burst(i, 16);
  rings.push({ x: dieX(i), y: SY + SLOT / 2, r: SLOT / 2, life: 1 });
  if (d.flipTo) {
    // BIT FLIP: the die glitches to its opposite face a moment after landing
    at(0.2, () => {
      d.face = d.flipTo; d.flipTo = 0; d.flash = 1; d.pop = 1;
      floats.push({ x: dieX(i), y: SY - 8, txt: 'BIT FLIP', col: PAL.magenta, life: 1 });
      perksOf(run, 'bitflip').forEach(popPerk);
      SFX.glitch(); G.glitch(0.12);
    });
  }
  if (i === N - 1) at(0.45, () => BOSS.afterLand(startScoring));
}

function badgeXY(k) {
  const row = Math.floor(k / BADGES_PER_ROW), col = k % BADGES_PER_ROW;
  return { x: PSX + col * (BADGE_W + BADGE_GAP), y: PSY + row * (BADGE_H + 3) };
}

function update(dt) {
  enterT += dt; modeT += dt;
  const m = G.mouse;

  // ---- timed events (run even in the shop so nothing gets stuck) ----
  if (seq.length) {
    seqT += dt;
    const due = seq.filter(e => e.t <= seqT);
    seq = seq.filter(e => e.t > seqT);
    due.forEach(e => e.fn());
  } else seqT = 0;

  menuHover = m.inside && m.x >= 3 && m.x < 50 && m.y >= 1 && m.y < 14;
  if (menuHover && !prevMenuHover) SFX.hover();
  prevMenuHover = menuHover;

  if (mode === 'shop') { SHOP.update(dt); updateFx(dt); return; }
  BOSS.update(dt);
  if (dokerEv) updateDokerEvent(dt);

  // ---- hover ----
  hover = -1; hoverBtn = -1; hoverPerk = -1; hoverWild = -1; hoverWBtn = -1;
  if (selWild >= 0 && (!canEditWilds() || !run.wilds[selWild])) selWild = -1;
  if (m.inside) {
    wbtns.forEach((b, i) => { if (UI.hitBox(b, m.x, m.y)) hoverWBtn = i; });
    if (!isOverlay() && hoverWBtn < 0)
      run.wilds.forEach((w, i) => {
        const x = wildX(i);
        if (m.x >= x && m.x < x + WW && m.y >= WY - 2 && m.y < WY + WH) hoverWild = i;
      });
    if (mode === 'ready')
      for (let i = 0; i < N; i++) {
        const x = slotX(i);
        if (m.x >= x && m.x < x + SLOT && m.y >= SY - 2 && m.y < SY + SLOT + 12 && selWild < 0) hover = i;
      }
    btns.forEach((b, i) => { if (UI.hitBox(b, m.x, m.y)) hoverBtn = i; });
    run.perks.forEach((p, k) => {
      const b = badgeXY(k);
      if (k < BADGES_PER_ROW * 2 && m.x >= b.x && m.x < b.x + BADGE_W && m.y >= b.y && m.y < b.y + BADGE_H) hoverPerk = k;
    });
  }
  if (hover !== prevHover && hover >= 0) SFX.hover();
  if (hoverBtn !== prevHoverBtn && hoverBtn >= 0) SFX.hover();
  if (hoverPerk !== prevHoverPerk && hoverPerk >= 0) SFX.hover();
  if (hoverWild !== prevHoverWild && hoverWild >= 0) SFX.hover();
  if (hoverWBtn !== prevHoverWBtn && hoverWBtn >= 0) SFX.hover();
  prevHover = hover; prevHoverBtn = hoverBtn; prevHoverPerk = hoverPerk; prevHoverWild = hoverWild; prevHoverWBtn = hoverWBtn;

  if (mode === 'intro' && modeT >= INTRO && enterT > 1) setMode('ready');
  if (auto && mode === 'ready') rollAll();
  if (auto && mode === 'cleared' && reward && reward.shown > reward.rows.length && modeT > 1.6) nextFirewall();

  // ---- dice ----
  for (let i = 0; i < N; i++) {
    const d = dice[i];
    if (!d.entered && slotDrop(i) >= 1) { d.entered = true; SFX.land(i); }
    d.flash = Math.max(0, d.flash - dt * 3);
    d.pop = Math.max(0, d.pop - dt * 4);

    if (d.phase === 'wait') {
      d.t += dt;
      const c = G.clamp((d.t - (d.delay - 0.14)) / 0.14, 0, 1);
      d.sy = 1 - 0.22 * c; d.sx = 1 + 0.14 * c;
      d.jx = c > 0 ? G.rand(-1, 1) : 0;
      if (d.t >= d.delay) {
        Object.assign(d, { phase: 'air', t: 0, sx: 1, sy: 1, flips: 0, label: '??' });
        SFX.launch(i);
        burst(i, 6, 0.6);
      }
    } else if (d.phase === 'air') {
      d.t += dt;
      const p = Math.min(1, d.t / AIR);
      d.h = 4 * 52 * p * (1 - p);
      const ph = p * Math.PI * FLIPS;
      d.sq = Math.max(0.08, Math.abs(Math.cos(ph)));
      const k = Math.floor(ph / Math.PI + 0.5);
      if (k !== d.flips) {
        d.flips = k;
        if (k >= FLIPS) { d.face = d.final; d.theme = 'bone'; }
        else { d.face = G.randi(1, 6); d.theme = Math.random() < 0.35 ? 'hack' : 'bone'; }
        SFX.flipTick(k + i);
      }
      d.jx = Math.sin(p * Math.PI * 3) * 2;
      d.label = HEX[G.randi(0, 15)] + HEX[G.randi(0, 15)];
      d.trail.push({ h: d.h, face: d.face, theme: d.theme, sq: d.sq, jx: d.jx });
      if (d.trail.length > 5) d.trail.shift();
      if (p >= 1) land(d, i);
    } else if (d.phase === 'land') {
      d.t += dt;
      const p = Math.min(1, d.t / SETTLE);
      const s = Math.cos(p * Math.PI * 2.5) * (1 - p);
      d.sx = 1 + 0.4 * s; d.sy = 1 - 0.4 * s;
      if (p >= 1) Object.assign(d, { phase: 'idle', sx: 1, sy: 1 });
    }
  }
  updateFx(dt);
}

function updateFx(dt) {
  shownScore += (run.score - shownScore) * Math.min(1, dt * 7);
  if (Math.abs(run.score - shownScore) < 0.5) shownScore = run.score;
  if (cur) { cur.cp = Math.max(0, cur.cp - dt * 5); cur.mp = Math.max(0, cur.mp - dt * 5); cur.tp = Math.max(0, cur.tp - dt * 3); }
  for (const [k, v] of badgePop) { if (v - dt * 3 <= 0) badgePop.delete(k); else badgePop.set(k, v - dt * 3); }
  for (const p of parts) { p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  parts = parts.filter(p => p.life > 0);
  for (const r of rings) { r.r += 70 * dt; r.life -= dt * 2.6; }
  rings = rings.filter(r => r.life > 0);
  for (const f of floats) { f.y -= 20 * dt; f.life -= dt; }
  floats = floats.filter(f => f.life > 0);
}

// ------------------------------------------------------------
//  render helpers
// ------------------------------------------------------------
function drawSq(img, cx, by, s, sx, sy, alpha = 1) {
  const w = Math.max(1, Math.round(img.width * s * sx)), h = Math.max(1, Math.round(img.height * s * sy));
  G.ctx.globalAlpha = alpha;
  G.ctx.drawImage(img, Math.round(cx - w / 2), Math.round(by - h), w, h);
  G.ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
//  render: sidebar
// ------------------------------------------------------------
function drawSidebar() {
  const { rect, text, T } = G;
  const x = SBX + 4, R = SBX + SBW - 4;
  const inShop = mode === 'shop';

  // firewall + target (in the shop: the NEXT firewall)
  const r = inShop ? run.round + 1 : run.round;
  UI.panel(SBX, 20, SBW, 42, PAL.red);
  const bossR = bossOf(run, r);
  text(bossR ? (inShop ? 'NEXT: BOSS' : 'BOSS') : inShop ? 'NEXT UP' : 'FIREWALL', x, 24, bossR ? PAL.red : '#8a7fc0');
  text(r + '/' + RULES.ROUNDS, R, 24, PAL.green, { align: 'right' });
  text('TARGET', x, 35, '#8a7fc0');
  UI.boxNum(fmtNum(RULES.target(r)), SBX + SBW / 2, 45, SBW, PAL.gold);

  // round score + progress
  const done = run.score >= run.target;
  UI.panel(SBX, 66, SBW, 40, PAL.green);
  text(inShop ? 'LAST SCORE' : 'SCORE', x, 70, '#8a7fc0');
  UI.boxNum(fmtNum(shownScore), SBX + SBW / 2, 80, SBW, done ? PAL.green : PAL.white);
  const pct = G.clamp(shownScore / run.target, 0, 1);
  rect(x, 97, SBW - 8, 5, PAL.ink);
  rect(x + 1, 98, Math.round((SBW - 10) * pct), 3, done ? PAL.gold : PAL.green);

  // hand: chips x mult
  UI.panel(SBX, 110, SBW, 44, '#7d9bff');
  if (cur) text(cur.proto + ' LV' + cur.lv, x, 114, cur.col);
  else text(mode === 'rolling' ? 'ROLLING...' : '-- NO HAND --', x, 114, '#5a4c99');
  const cy = 125, bw = 38, bh = 18;
  const cpY = cur ? -Math.round(cur.cp * 2) : 0, mpY = cur ? -Math.round(cur.mp * 2) : 0;
  G.rrect(x - 1, cy - 1 + cpY, bw + 2, bh + 2, PAL.ink);
  G.rrect(x, cy + cpY, bw, bh, cur && cur.cp > 0.5 ? '#6d8cff' : '#2f4fae');
  G.rrect(R - bw - 1, cy - 1 + mpY, bw + 2, bh + 2, PAL.ink);
  G.rrect(R - bw, cy + mpY, bw, bh, cur && cur.mp > 0.5 ? '#ff6b75' : '#b02a3a');
  text('X', SBX + SBW / 2, cy + 6, PAL.red, { align: 'center', shadow: PAL.ink });
  UI.boxNum(cur ? fmtNum(cur.chips) : '0', x + bw / 2, cy + 3 + cpY, bw, PAL.white);
  UI.boxNum(cur ? fmtMult(cur.mult) : '0', R - bw / 2, cy + 3 + mpY, bw, PAL.white);

  // rolls + credits
  const total = rollsPerRound(run) + (inShop ? 0 : BOSS.held);
  const left = inShop ? total : run.rollsLeft + BOSS.held;
  UI.panel(SBX, 158, SBW, 42, PAL.gold);
  text('ROLLS', x, 162, '#8a7fc0');
  text(String(left), R, 162, left <= 2 && !inShop ? PAL.red : PAL.white, { align: 'right' });
  const pw = Math.max(3, Math.min(9, Math.floor((SBW - 6) / total)));
  for (let k = 0; k < total; k++) {
    const on = k < left;
    rect(x + k * pw, 172, pw - 2, 5, PAL.ink);
    rect(x + k * pw + 1, 173, pw - 4, 3, on ? (left <= 2 && !inShop && Math.floor(T * 4) % 2 ? PAL.red : PAL.green) : '#241a4a');
  }
  text('$' + run.money, x, 184, PAL.gold, { scale: 2, shadow: PAL.ink });
}

// ------------------------------------------------------------
//  render: perk strip + tooltip
// ------------------------------------------------------------
function drawPerkStrip() {
  const { rrect, rect, text } = G;
  if (!run.perks.length) return;
  const max = BADGES_PER_ROW * 2;
  run.perks.slice(0, max).forEach((p, k) => {
    const b = badgeXY(k);
    const pop = badgePop.get(p.uid) || 0;
    const y = b.y - Math.round(pop * 3) - (hoverPerk === k ? 1 : 0);
    const col = RARITY.col[p.rarity];
    rrect(b.x - 1, y - 1, BADGE_W + 2, BADGE_H + 2, PAL.ink);
    rrect(b.x, y, BADGE_W, BADGE_H, pop > 0.3 ? PAL.white : col);
    rect(b.x + 1, y + 1, BADGE_W - 2, BADGE_H - 2, pop > 0.3 ? col : '#15112c');
    text(PERK_DEFS[p.id].code, b.x + BADGE_W / 2, y + 2, pop > 0.3 ? PAL.ink : PAL.white, { align: 'center' });
  });
  if (run.perks.length > max) text('+' + (run.perks.length - max), TX + TW, PSY + 16, '#8a7fc0', { align: 'right' });
}

function drawPerkTip() {
  if (hoverPerk < 0) return;
  const p = run.perks[hoverPerk];
  const col = RARITY.col[p.rarity];
  let d = itemDesc(p, true);
  if (p.id === 'streak') d += ` STACKS NOW: ${p.stats.stacks}.`;
  if (p.id === 'hothand') d += ` STREAK NOW: ${run.hot}.`;
  if (p.id === 'pity' && run.pity) d += ` STORED: ${run.pity}.`;
  UI.infoBox(TX + 4, 120, TW - 8, 48, PERK_DEFS[p.id].name, col, RARITY.name[p.rarity], col, d, PAL.white);
}

// ------------------------------------------------------------
//  render: wildcard row (top of the felt) + its tooltip / sell-move panel
// ------------------------------------------------------------
function drawWildRow() {
  const { rect, rrect, text, ctx, T } = G;
  for (let i = 0; i < WILD_SLOTS; i++) {
    const x = wildX(i), w = run.wilds[i];
    if (!w) {
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < WW; k += 4) { rect(x + k, WY, 2, 1, '#2f8f5f'); rect(x + k, WY + WH - 1, 2, 1, '#2f8f5f'); }
      for (let k = 0; k < WH; k += 4) { rect(x, WY + k, 1, 2, '#2f8f5f'); rect(x + WW - 1, WY + k, 1, 2, '#2f8f5f'); }
      ctx.globalAlpha = 1;
      continue;
    }
    const pop = badgePop.get(w.uid) || 0;
    const y = WY - Math.round(pop * 4) - (hoverWild === i || selWild === i ? 2 : 0);
    const col = RARITY.col[w.rarity];
    rrect(x - 1, y - 1, WW + 2, WH + 2, PAL.ink);
    rrect(x, y, WW, WH, pop > 0.3 ? PAL.white : col);
    rect(x + 1, y + 1, WW - 2, WH - 2, '#15112c');
    const art = CARD_ART[w.id];
    if (art) ctx.drawImage(art, x + Math.floor((WW - art.width) / 2), y + Math.floor((WH - art.height) / 2));
    else text(WILD_DEFS[w.id].code, x + WW / 2, y + WH / 2 - 3, col, { align: 'center' });
    // live counters on the card
    let tag = '';
    if (w.id === 'glitch') tag = 'W' + w.state.face;
    else if (w.id === 'keylogger' && w.state.x > 1) tag = 'X' + fmtMult(w.state.x);
    else if (w.id === 'cookiejar' && w.state.chips) tag = '+' + w.state.chips;
    else if (w.id === 'phantom' && run.phantom && mode !== 'ready' && mode !== 'intro') tag = String(run.phantom);
    if (tag) text(tag, x + WW - 2, y + WH - 8, PAL.white, { align: 'right', outline: PAL.ink });
    if (w.edition) UI.editionFx(w.edition, x, y, WW, WH);
    if (selWild === i) drawBrackets(x, y, WW, WH, PAL.green, 2 + Math.round(Math.abs(Math.sin(T * 8))));
  }
}

function drawWildPanel() {
  wbtns = [];
  const k = selWild >= 0 ? selWild : hoverWild;
  if (k < 0 || !run.wilds[k]) return;
  const w = run.wilds[k], col = RARITY.col[w.rarity];
  const tag = (w.edition ? EDITIONS[w.edition].name + ' ' : '') + RARITY.name[w.rarity];
  const tagCol = w.edition ? EDITIONS[w.edition].col : col;
  const lines = wrapText(itemDesc(w), Math.floor((TW - 16) / 6));
  if (selWild < 0) {
    if (canEditWilds()) lines.push('CLICK TO SELL OR MOVE');
    UI.infoBox(TX + 4, 168 - 14 - lines.length * 9 - 4, TW - 8, 14 + lines.length * 9 + 4, itemName(w), col, tag, tagCol, lines, PAL.white);
    return;
  }
  const show = lines.slice(0, 3);
  const h = 14 + show.length * 9 + 24, y = 168 - h;
  UI.infoBox(TX + 4, y, TW - 8, h, itemName(w), col, tag, tagCol, show, PAL.white);
  const by = y + h - 19;
  wbtns.push({ x: TX + 10, y: by, w: 56, h: 13, label: '< MOVE', act: () => moveWild(-1), ...UI.BTN.blue, disabled: k === 0 });
  wbtns.push({ x: TX + 70, y: by, w: 56, h: 13, label: 'MOVE >', act: () => moveWild(1), ...UI.BTN.blue, disabled: k === run.wilds.length - 1 });
  wbtns.push({ x: TX + TW - 82, y: by, w: 72, h: 13, label: 'SELL +$' + wildSell(w), act: sellWild, ...UI.BTN.red });
  wbtns.forEach((b, i) => UI.button(b, hoverWBtn === i));
}

function moveWild(dir) {
  const k = selWild, j = k + dir;
  if (j < 0 || j >= run.wilds.length) return;
  [run.wilds[k], run.wilds[j]] = [run.wilds[j], run.wilds[k]];
  selWild = j;
  SFX.select();
  saveRun('round');
}
function sellWild() {
  const w = run.wilds[selWild];
  if (!w) return;
  run.money += wildSell(w);
  wildFloat(w, '+$' + wildSell(w), PAL.gold);
  removeWild(w);
  SFX.coin(); G.glitch(0.1);
  saveRun('round');
}

// ------------------------------------------------------------
//  render: table
// ------------------------------------------------------------
function drawTable() {
  const { rrect, rect, ctx } = G;
  rrect(TX - 5, TY - 5, TW + 10, TH + 10, PAL.ink);
  rrect(TX - 4, TY - 4, TW + 8, TH + 8, '#3d2416');
  rect(TX - 2, TY - 4, TW + 4, 1, '#7a4a2a');
  rect(TX - 2, TY + TH + 3, TW + 4, 1, '#24140c');
  rrect(TX - 1, TY - 1, TW + 2, TH + 2, PAL.ink);
  ctx.globalAlpha = 0.55 + Math.sin(G.T * 2) * 0.15;
  rrect(TX - 1, TY - 1, TW + 2, TH + 2, PAL.mgreen);
  ctx.globalAlpha = 1;
  ctx.drawImage(felt, TX, TY);
}

function drawBrackets(x, y, w, h, col, e) {
  const { rect } = G;
  const L = 6;
  x -= e; y -= e; w += e * 2; h += e * 2;
  rect(x, y, L, 2, col); rect(x, y, 2, L, col);
  rect(x + w - L, y, L, 2, col); rect(x + w - 2, y, 2, L, col);
  rect(x, y + h - 2, L, 2, col); rect(x, y + h - L, 2, L, col);
  rect(x + w - L, y + h - 2, L, 2, col); rect(x + w - 2, y + h - L, 2, L, col);
}

function drawSlot(i, off) {
  const { rrect, rect, ctx, text, T } = G;
  const d = dice[i];
  const x = slotX(i), y = SY + off;
  if (BOSS.looming) ctx.globalAlpha = 0.5;      // see-through slots so the boss shows behind the dice
  rrect(x - 1, y - 1, SLOT + 2, SLOT + 2, PAL.ink);
  rrect(x, y, SLOT, SLOT, '#241a4a');
  rect(x + 2, y + 2, SLOT - 4, SLOT - 4, '#0b0920');
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#18133a';
  for (let gy = y + 4; gy < y + SLOT - 3; gy += 4)
    for (let gx = x + 4; gx < x + SLOT - 3; gx += 4) ctx.fillRect(gx, gy, 1, 1);
  rect(x + 2, y + 2, SLOT - 4, 1, '#05040c');
  if (d.flash > 0) { ctx.globalAlpha = d.flash * 0.7; rect(x + 2, y + 2, SLOT - 4, SLOT - 4, PAL.mint); ctx.globalAlpha = 1; }

  let col = '#4b3a8c', e = 0;
  if (d.scoring && result) { col = Math.floor(T * 6) % 2 ? result.col : PAL.white; e = 1 + Math.round(Math.abs(Math.sin(T * 5))); }
  else if (hover >= 0) { col = hover === i ? PAL.green : PAL.mgreen; e = hover === i ? 1 + Math.round(Math.abs(Math.sin(T * 8))) : 0; }
  else if (d.phase === 'air' || d.phase === 'wait') col = PAL.mgreen;
  if (i === run.ddosDie) {
    col = PAL.red; e = Math.floor(T * 4) % 2;
    text('STUCK ON 1', x + SLOT / 2, y + SLOT + 4, PAL.red, { align: 'center', outline: PAL.ink });
  }
  drawBrackets(x, y, SLOT, SLOT, col, e);
}

function drawDie(i, off) {
  const { ctx, rect, T } = G;
  const d = dice[i];
  const cx = dieX(i) + d.jx;
  const base = REST + off;

  const sw = Math.max(6, Math.round(28 * (1 - d.h / 100)));
  ctx.globalAlpha = 0.5; rect(cx - sw / 2, base + 1, sw, 2, '#000000'); ctx.globalAlpha = 1;

  d.trail.forEach((tr, k) => {
    const img = tinted(DIE[tr.theme][tr.face], k % 2 ? PAL.magenta : PAL.cyan);
    drawSq(img, dieX(i) + tr.jx, base - tr.h, 2, tr.sq, 1, 0.1 + k * 0.05);
  });

  let bob = 0;
  if (d.phase === 'idle') {
    if (d.scoring && result) bob = Math.round(Math.abs(Math.sin(T * 6 + i * 0.7)) * 3);
    else if (hover >= 0) bob = Math.round(Math.abs(Math.sin(T * 9 + i * 0.9)) * 1.5);
  }
  bob += Math.round(d.pop * 6);
  const img = DIE[d.theme][d.face];
  const ps = 1 + d.pop * 0.2;
  const sx = (d.phase === 'air' ? d.sq : d.sx) * ps, sy = (d.phase === 'air' ? 1 : d.sy) * ps;
  if (d.scoring && result && d.phase === 'idle') {
    const glow = tinted(img, result.col);
    for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) drawSq(glow, cx + ox, base - bob + oy, 2, sx, sy, 0.8);
  }
  drawSq(img, cx, base - d.h - bob, 2, sx, sy, d.dropped && d.phase === 'idle' ? 0.3 : 1);
}

function drawResult() {
  const { text, clamp, easeOutBack, T } = G;
  if (mode === 'rolling') {
    const dots = '.'.repeat(1 + Math.floor(T * 6) % 3);
    text('DECRYPTING' + dots, CX - 33, 126, PAL.green, { shadow: PAL.ink });
    return;
  }
  if (!result || isOverlay()) return;
  text(result.name, CX, 120, result.col, { align: 'center', scale: 2, outline: PAL.ink, wave: result.tier >= 3 ? 1 : 0, t: T });
  if (cur && cur.showTotal) {
    const pop = easeOutBack(clamp(1 - cur.tp, 0, 1));
    G.ctx.globalAlpha = clamp(pop, 0, 1);
    const neg = cur.total < 0;
    text((neg ? '-' : '+') + fmtNum(Math.abs(cur.total)), CX, 140 + Math.round((1 - pop) * 8), neg ? PAL.red : PAL.gold, { align: 'center', scale: 2, outline: PAL.ink });
    G.ctx.globalAlpha = 1;
  }
}

function drawIntro() {
  if (mode !== 'intro') return;
  const { rect, text, ctx, easeOutCubic, clamp } = G;
  const pin = easeOutCubic(clamp(modeT / 0.3, 0, 1));
  const pout = clamp((modeT - (INTRO - 0.3)) / 0.3, 0, 1);
  const dx = Math.round((1 - pin) * -TW + pout * TW);
  const y = 118;
  ctx.save();
  ctx.beginPath(); ctx.rect(TX, TY, TW, TH); ctx.clip();
  const boss = run.boss && BOSSES[run.boss];
  const bh = boss ? 44 : 34, by = boss ? y - 10 : y, acc = boss ? PAL.red : PAL.green;
  ctx.globalAlpha = 0.88; rect(TX + dx, by, TW, bh, boss ? '#1a0408' : PAL.ink); ctx.globalAlpha = 1;
  rect(TX + dx, by, TW, 1, acc); rect(TX + dx, by + bh - 1, TW, 1, acc);
  text((boss ? 'BOSS: ' + boss.name : 'FIREWALL ' + run.round + '/' + RULES.ROUNDS), CX + dx, by + 5, boss ? PAL.red : PAL.white, { align: 'center', scale: 2, shadow: PAL.ink });
  if (boss) text(boss.text, CX + dx, by + 22, PAL.white, { align: 'center' });
  text('TARGET ' + fmtNum(run.target) + '  //  ' + run.rollsLeft + ' ROLLS', CX + dx, by + bh - 11, acc, { align: 'center' });
  ctx.restore();
}

// ------------------------------------------------------------
//  render: overlays (breached / denied / rooted)
// ------------------------------------------------------------
function drawOverlay() {
  if (!isOverlay()) { btns = []; return; }
  const { rect, rrect, text, ctx, clamp, easeOutBack, T } = G;
  const p = easeOutBack(clamp(modeT / 0.35, 0, 1));
  ctx.globalAlpha = 0.6 * clamp(modeT / 0.2, 0, 1); rect(TX, TY, TW, TH, '#000000'); ctx.globalAlpha = 1;
  const y0 = Math.round(OY + (1 - p) * 30);
  const accent = mode === 'cleared' ? PAL.green : mode === 'failed' ? PAL.red : PAL.magenta;
  rrect(OX - 2, y0 - 2, OW + 4, OH + 4, PAL.ink);
  rrect(OX - 1, y0 - 1, OW + 2, OH + 2, accent);
  rrect(OX, y0, OW, OH, '#120e28');
  const L = OX + 14, R = OX + OW - 14;
  btns = [];

  if (mode === 'cleared') {
    text('FIREWALL BREACHED', CX, y0 + 8, PAL.green, { align: 'center', scale: 2, outline: PAL.ink, wave: 1, t: T });
    text('SCORED ' + fmtNum(run.score) + ' / ' + fmtNum(run.target), CX, y0 + 28, '#a99be0', { align: 'center' });
    reward.rows.forEach(([a, b], i) => {
      if (reward.shown <= i) return;
      text(a, L, y0 + 42 + i * 10, PAL.white);
      text('$' + b, R, y0 + 42 + i * 10, PAL.gold, { align: 'right' });
    });
    if (reward.shown > reward.rows.length) {
      const ly = y0 + 44 + reward.rows.length * 10;
      rect(L, ly, R - L, 1, '#2e2260');
      text('TOTAL', L, ly + 4, PAL.white);
      text('+$' + reward.total, R, ly + 4, PAL.gold, { align: 'right' });
      const last = run.round >= RULES.ROUNDS;
      btns.push({ x: CX - 64, y: y0 + 98, w: 128, h: 15, label: last ? 'FINISH RUN >' : 'BLACK MARKET >', act: nextFirewall, ...UI.BTN.green });
    }
  } else if (mode === 'failed') {
    text('ACCESS DENIED', CX, y0 + 8, PAL.red, { align: 'center', scale: 2, outline: PAL.ink });
    text('RUN TERMINATED AT FIREWALL ' + run.round + '/' + RULES.ROUNDS, CX, y0 + 32, PAL.white, { align: 'center' });
    text('SCORED ' + fmtNum(run.score) + ' / ' + fmtNum(run.target), CX, y0 + 46, '#a99be0', { align: 'center' });
    text('SHORT BY ' + fmtNum(run.target - run.score), CX, y0 + 58, PAL.gold, { align: 'center' });
    text(run.perks.length + ' PERKS OWNED', CX, y0 + 70, '#8a7fc0', { align: 'center' });
    if (modeT > 0.8) {
      btns.push({ x: CX - 66, y: y0 + 98, w: 62, h: 15, label: 'RETRY', act: () => { SFX.select(); newRun(); }, ...UI.BTN.green });
      btns.push({ x: CX + 4, y: y0 + 98, w: 62, h: 15, label: 'MENU', act: () => { SFX.select(); G.goTo('menu'); }, ...UI.BTN.blue });
    }
  } else if (mode === 'won') {
    text('SYSTEM ROOTED', CX, y0 + 8, PAL.magenta, { align: 'center', scale: 2, outline: PAL.ink, wave: 1, t: T });
    text('ALL ' + RULES.ROUNDS + ' FIREWALLS BREACHED', CX, y0 + 32, PAL.white, { align: 'center' });
    text('CREDITS $' + run.money, CX, y0 + 46, PAL.gold, { align: 'center' });
    text('ROLLS USED ' + run.rollsUsed + ' // ' + run.perks.length + ' PERKS', CX, y0 + 58, '#a99be0', { align: 'center' });
    if (modeT > 0.8) {
      btns.push({ x: CX - 66, y: y0 + 98, w: 62, h: 15, label: 'NEW RUN', act: () => { SFX.select(); newRun(); }, ...UI.BTN.green });
      btns.push({ x: CX + 4, y: y0 + 98, w: 62, h: 15, label: 'MENU', act: () => { SFX.select(); G.goTo('menu'); }, ...UI.BTN.blue });
    }
  }
  btns.forEach((b, i) => UI.button(b, hoverBtn === i));
}

function drawHUD() {
  const { rect, rrect, text, W } = G;
  rect(0, 0, W, 15, PAL.ink);
  rect(0, 15, W, 1, PAL.purple);
  rrect(3, 2, 46, 11, menuHover ? PAL.green : '#2e2260');
  text('< MENU', 6, 4, menuHover ? PAL.ink : PAL.white);
  // boss warning: during the boss firewall, and one round early (incl. the shop before it)
  const HX = (52 + W - 60) / 2;
  if (mode !== 'shop' && run.boss) {
    const b = BOSSES[run.boss];
    text((Math.floor(G.T * 3) % 2 ? '! ' : '  ') + 'BOSS ' + b.name + ': ' + b.short, HX, 4, PAL.red, { align: 'center' });
  } else {
    const nb = bossOf(run, run.round + 1);
    if (nb) text('BOSS NEXT: ' + BOSSES[nb].name + ' // ' + BOSSES[nb].short, HX, 4, PAL.orange, { align: 'center' });
  }
  text('RUN $' + run.money, W - 5, 4, PAL.gold, { align: 'right' });
}

function drawFx() {
  const { ctx, rect, text, clamp } = G;
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life) * 0.8;
    const s = Math.round(r.r);
    rect(r.x - s, r.y - s, s * 2, 1, PAL.green); rect(r.x - s, r.y + s, s * 2 + 1, 1, PAL.green);
    rect(r.x - s, r.y - s, 1, s * 2, PAL.green); rect(r.x + s, r.y - s, 1, s * 2, PAL.green);
  }
  for (const p of parts) { ctx.globalAlpha = clamp(p.life * 2, 0, 1); rect(p.x, p.y, p.s, p.s, p.col); }
  ctx.globalAlpha = 1;
}
function drawFloats() {
  const { ctx, text, clamp } = G;
  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life * 2, 0, 1);
    text(f.txt, f.x, f.y, f.col, { align: 'center', outline: PAL.ink, scale: f.big ? 2 : 1 });
  }
  ctx.globalAlpha = 1;
}

function render() {
  const { text, T } = G;
  G.drawBackground(TABLE_RAMP);
  G.drawRain(0.12);

  if (mode === 'shop') {
    SHOP.render();
    drawSidebar();
    drawHUD();
    drawFloats();
    return;
  }

  drawTable();
  BOSS.drawBack();          // boss rounds: the lair and its energy veins
  drawWildRow();
  BOSS.drawBody();          // its arms + bust leaning over the top of the table (in front of wildcards, behind dice)
  for (let i = 0; i < N; i++) {
    const p = slotDrop(i);
    if (p > 0) drawSlot(i, Math.round((1 - G.easeOutBack(p)) * -140));
  }
  for (let i = 0; i < N; i++) {
    const p = slotDrop(i);
    if (p > 0) drawDie(i, Math.round((1 - G.easeOutBack(p)) * -140));
  }
  drawFx();
  BOSS.draw();
  drawResult();
  drawIntro();
  drawPerkStrip();
  BOSS.drawCage();
  drawPerkTip();
  if (!isOverlay()) drawWildPanel(); else wbtns = [];
  if (isOverlay()) BOSS.drawActor();
  drawOverlay();
  drawSidebar();
  drawHUD();
  if (!isOverlay()) BOSS.drawActor();   // the boss's hands grip the table over the top bar
  drawFloats();

  if (mode === 'ready' && hoverPerk < 0 && hoverWild < 0 && selWild < 0 && Math.floor(T * 2) % 2 === 0)
    text(run.rollsLeft === 1 ? 'LAST ROLL!' : run.rollsRound === 0 ? 'CLICK ANY DIE TO ROLL' : 'ROLL AGAIN',
      CX, 153, run.rollsLeft === 1 ? PAL.red : PAL.gold, { align: 'center', shadow: PAL.ink });

  G.drawTicker(TICK);
  drawDokerEvent();
  BOSS.drawCut();
}

// ------------------------------------------------------------
//  input
// ------------------------------------------------------------
function onPointer() {
  if (menuHover) { SFX.select(); G.goTo('menu'); return; }
  if (mode === 'shop') { SHOP.onPointer(); return; }
  if (mode === 'bossintro') { BOSS.skip(); return; }
  if (dokerEv) { skipDoker(); return; }
  if (hoverBtn >= 0 && btns[hoverBtn]) { btns[hoverBtn].act(); return; }
  if (wbtns[hoverWBtn]) { const b = wbtns[hoverWBtn]; hoverWBtn = -1; if (b.disabled) SFX.deny(); else b.act(); return; }
  if (hoverWild >= 0 && canEditWilds()) { selWild = selWild === hoverWild ? -1 : hoverWild; SFX.select(); return; }
  if (selWild >= 0) { selWild = -1; return; }
  if (mode === 'intro' && enterT > 1) { setMode('ready'); return; }
  if (hover >= 0) rollAll();
}
function onKey(k) {
  if (k === 'escape' || k === 'backspace') { SFX.select(); G.goTo('menu'); return; }
  if (mode === 'shop') { SHOP.onKey(k); return; }
  if (k !== ' ' && k !== 'enter') return;
  if (mode === 'bossintro') { BOSS.skip(); return; }
  if (dokerEv) { skipDoker(); return; }
  selWild = -1;
  if (isOverlay()) { if (btns[0]) btns[0].act(); return; }
  if (mode === 'intro' && enterT > 1) { setMode('ready'); return; }
  rollAll();
}
const hot = () => menuHover || (mode === 'shop' ? SHOP.hot() : hover >= 0 || hoverBtn >= 0 || hoverPerk >= 0 || hoverWild >= 0 || !!wbtns[hoverWBtn]);

return {
  enter, update, render, onPointer, onKey, hot, rollAll,
  set auto(v) { auto = v; },
  // dev hooks for testing
  get run() { return run; },
  debugShop() { openShop(null); },
  /** dev: force the next roll to be five of a kind */
  debugDoker(face = 6) { forceFaces = [face, face, face, face, face]; },
  track,
  debugRound(r, boss) { if (boss) run.bosses[r] = boss; startRound(r); },
  hasSave: () => !!loadSave(),
  queueContinue() { pendingContinue = true; },
};
})();
