// ============================================================
//  DOKER — BOSS ACTORS. Boss firewalls (rounds 4 and 8) get a character
//  that crashes in with a cutscene, lives on the felt, and physically
//  enforces its rule (stomps a die to 1, padlocks 6s, eats rolls, ...).
//  Sprites: BOSS_ART_DEFS (js/bossart.js). Rules: BOSSES (js/items.js).
//  play.js drives it through the hooks returned at the bottom.
// ============================================================
const BOSS = (() => {
'use strict';

// ---------- personas ----------
const PERSONA = {
  ddos: {
    title: 'THE FLOOD', col: '#e43b44',
    intro: 'TOO MANY REQUESTS. ONE OF YOUR DICE BELONGS TO ME NOW.',
    act: ['ACCESS DENIED!', 'ONE. FOREVER.', 'REQUEST REJECTED.', 'MINE.'],
    peek: ['...STILL A ONE.', 'JUST CHECKING.', 'GOOD. STAY DOWN.'],
    bust: ['HA! TIMEOUT.', '503: LUCK UNAVAILABLE.'], big: ['...A LUCKY PACKET.', 'IMPOSSIBLE!'],
    defeat: 'CONNECTION... DROPPED...', gloat: 'SERVICE DENIED. PERMANENTLY.',
  },
  encryption: {
    title: 'CIPHER', col: '#2ce8f5',
    intro: 'YOUR SIXES ARE MINE. I HOLD THE ONLY KEY.',
    act: ['LOCKED.', 'ENCRYPTED.', 'NO KEY, NO PIPS.'],
    peek: ['NO SIXES? HOW DULL.', 'NOTHING TO LOCK...'],
    bust: ['PREDICTABLE.', 'NOISE. ALL NOISE.'], big: ['YOU CRACKED... THAT?', 'A BRUTE. HOW CRUDE.'],
    defeat: 'MY KEYS... LEAKED...', gloat: 'THE CIPHER HOLDS.',
  },
  lag: {
    title: 'BUFFER', col: '#feae34',
    intro: 'YAWN... TEN ROLLS? THAT IS... SO MANY... LET ME TAKE A FEW...',
    act: ['BUFFERING...', 'HOLD... ON...', 'LOADING...'],
    peek: ['ZZZ...', '...HM?'],
    bust: ['HEH... SLOW...', 'ZZZ... HA.'], big: ['TOO... FAST...', 'WAIT... WHAT...'],
    defeat: 'CONNECTION... TIMED... OUT...', gloat: '...TOO SLOW. ZZZ.',
  },
  sandbox: {
    title: 'THE WARDEN', col: '#4f9bff',
    intro: 'YOUR LITTLE PERKS STAY IN THE SANDBOX. BEHAVE.',
    act: ['NOPE.', 'BACK IN YOUR CELL.', 'NOT TODAY.'],
    peek: ['CELL CHECK.', 'ALL SECURE.'],
    bust: ['THAT IS WHAT RULES DO.', 'ORDER RESTORED.'], big: ['CONTRABAND!', 'WHO LET THAT IN?'],
    defeat: 'JAILBREAK... DETECTED...', gloat: 'LIFE SENTENCE.',
  },
  honeypot: {
    title: 'SWEETTOOTH', col: '#feae34',
    intro: 'OOH, A VISITOR. ROLL ME A PAIR, SUGAR...',
    act: ['NOM!', 'DELICIOUS.', 'SWEET, SWEET POINTS.'],
    peek: ['NO PAIR? SHAME.', 'SO HUNGRY...'],
    bust: ['TEE HEE.', 'STICKY, ISN\'T IT?'], big: ['OOH, TOO BIG TO SWALLOW.', 'HEY! SHARE!'],
    defeat: 'I\'M... CRACKING...', gloat: 'YOU WERE DELICIOUS.',
  },
};

// ---------- sprites (falls back to a placeholder until art exists) ----------
const FRAMES = ['idle', 'blink', 'act', 'peek', 'hurt'];
const spriteCache = {};
function spritesFor(id) {
  if (spriteCache[id]) return spriteCache[id];
  const def = typeof BOSS_ART_DEFS !== 'undefined' && BOSS_ART_DEFS[id];
  const out = {};
  if (def) {
    const pal = { ...ART_PAL, ...(def.pal || {}) };
    for (const f of FRAMES) out[f] = makeSprite(def.frames[f] || def.frames.idle, pal);
  } else {
    const col = PERSONA[id].col;
    for (const f of FRAMES) {
      const [c, g] = newCanvas(36, 36);
      g.fillStyle = PAL.ink; g.fillRect(2, 4, 32, 32);
      g.fillStyle = col; g.fillRect(3, 5, 30, 30);
      g.fillStyle = PAL.ink;
      if (f !== 'blink') { g.fillRect(10, 13, 5, 5); g.fillRect(21, 13, 5, 5); } else { g.fillRect(10, 16, 5, 1); g.fillRect(21, 16, 5, 1); }
      if (f === 'act') g.fillRect(12, 24, 12, 6);
      out[f] = c;
    }
  }
  return (spriteCache[id] = out);
}

// ---------- state ----------
let id = null, run = null, P = null, S = null, hk = null;
let x = 0, y = 0, home = { x: 0, y: 0 }, frame = 'idle', scale = 1, flip = false;
let tasks = [], busy = false;
let speech = null;                 // { text, t, life }
let cut = null;                    // intro cutscene { t, done, phase }
let dead = 0;                      // >0 while the defeat animation plays
let caged = false, cageT = 0;      // SANDBOX cage over the perk strip
let locks = new Map();             // ENCRYPTION padlocks: die index -> pop timer
let freezeT = 0;                   // LAG: dice frozen mid-air
let held = 0;                      // LAG: rolls still on show before it eats them (intro)
let blinkT = 0, nextBlink = 2, bob = 0;

const pick = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** hooks from play.js: { TX, TY, TW, TH, dieX(i), dieTop, face(i), setFace(i,f), float(x,y,txt,col,big),
 *  rollsBox:{x,y}, perkBox:{x,y,w,h}, encrypted(i), resultY } */
function setup(r, hooks) {
  run = r; hk = hooks;
  id = r.boss || null;
  tasks = []; busy = false; speech = null; cut = null; dead = 0;
  caged = false; cageT = 0; locks = new Map(); freezeT = 0; held = 0;
  if (!id) return;
  P = PERSONA[id]; S = spritesFor(id);
  home = { x: hk.TX + hk.TW - 24, y: hk.TY + hk.TH - 3 };
  x = home.x; y = home.y; frame = 'idle'; scale = 1; flip = false;
}
const active = () => !!id && !dead;

// ---------- task queue (sequential little animations) ----------
function task(dur, tick, end) { tasks.push({ dur, t: 0, tick, end, started: false }); }
function wait(dur, f) { task(dur, () => { if (f) frame = f; }); }
function call(fn) { task(0, null, fn); }
function moveTo(tx, ty, dur, hop = 10, f = 'idle') {
  let sx, sy;
  task(dur, p => {
    if (sx === undefined) { sx = x; sy = y; flip = tx < sx; }
    const e = ease(p);
    x = lerp(sx, tx, e); y = lerp(sy, ty, e) - Math.sin(p * Math.PI) * hop;
    frame = f;
  }, () => { x = tx; y = ty; });
}
function goHome(dur = 0.35) { moveTo(home.x, home.y, dur, 12); call(() => { flip = false; frame = 'idle'; }); }
function say(text, life = 1.8) { speech = { text, t: 0, life }; SFX.talk(); }

// ---------- intro cutscene ----------
const CUT_LEN = 3.6;
function intro(done) {
  if (!id) return done();
  cut = { t: 0, done, landed: false, said: false };
  if (id === 'lag') held = Math.max(0, Math.min(RULES.ROLLS, run.rollsLeft + 3) - run.rollsLeft);
  x = hk.TX + hk.TW / 2; y = -60; scale = 2; frame = 'idle';
  SFX.fail(); G.glitch(0.6);
}
function endCut() {
  if (!cut) return;
  const done = cut.done;
  cut = null; scale = 1; x = home.x; y = home.y; frame = 'idle'; flip = false;
  // rule set-pieces right after the intro
  if (id === 'lag') {
    busy = true;
    moveTo(hk.rollsBox.x + 30, hk.rollsBox.y + 30, 0.55, 20, 'idle');
    for (let k = 0; k < 3; k++) {
      wait(0.12, 'act');
      call(() => { held = Math.max(0, held - 1); SFX.slam(k); G.shake(2); hk.float(hk.rollsBox.x + 70, hk.rollsBox.y - 4, '-1 ROLL', PAL.red); });
      wait(0.22, 'idle');
    }
    call(() => { held = 0; say('MMM... CRUNCHY.'); });
    goHome(0.55);
    call(() => { busy = false; done(); });
  } else if (id === 'sandbox') {
    busy = true;
    moveTo(hk.perkBox.x + hk.perkBox.w / 2, hk.perkBox.y - 2, 0.45, 18, 'act');
    call(() => { caged = true; cageT = 0; SFX.slam(2); G.shake(4); hk.float(hk.perkBox.x + hk.perkBox.w / 2, hk.perkBox.y - 10, 'PERKS LOCKED UP', PAL.red, true); });
    wait(0.45, 'idle');
    goHome(0.45);
    call(() => { busy = false; done(); });
  } else done();
}
function skip() {
  if (cut) endCut();
}
/** Restore the boss's lasting effects without the cutscene (after CONTINUE). */
function resume() { if (id === 'sandbox') { caged = true; cageT = 1; } }

// ---------- rule enforcement hooks ----------
/** Before the dice leave: LAG sometimes freezes them. Returns extra launch delay. */
function beforeRoll() {
  locks.clear();
  if (!active()) return 0;
  if (id === 'lag' && Math.random() < 0.4) {
    freezeT = 0.9;
    frame = 'act'; say(pick(P.act), 1.0);
    task(0.9, () => { frame = 'act'; }, () => { frame = 'idle'; });
    return 0.9;
  }
  return 0;
}

/** After all dice land, before scoring. DDOS stomps its die, ENCRYPTION padlocks 6s. */
function afterLand(done) {
  if (!active()) return done();
  busy = true;
  if (id === 'ddos') {
    const i = run.ddosDie;
    const tx = hk.dieX(i), ty = hk.dieTop - 4;
    moveTo(tx, ty, 0.4, 24, 'idle');
    if (hk.face(i) !== 1) {
      wait(0.22, 'act');
      moveTo(tx, ty + 10, 0.07, 0, 'peek');            // SLAM
      call(() => {
        hk.setFace(i, 1); SFX.slam(4); G.shake(5); G.glitch(0.15);
        hk.float(tx, hk.dieTop + 52, 'ACCESS DENIED', PAL.red, true);
        say(pick(P.act), 1.2);
      });
      wait(0.12, 'peek');
      moveTo(tx, ty, 0.12, 0, 'act');
      wait(0.25, 'act');
    } else {
      wait(0.7, 'peek');
      call(() => say(pick(P.peek), 1.2));
      wait(0.3, 'peek');
    }
    goHome(0.4);
  } else if (id === 'encryption') {
    const six = [0, 1, 2, 3, 4].filter(i => hk.encrypted(i));
    if (!six.length) {
      if (Math.random() < 0.5) { wait(0.25, 'peek'); call(() => say(pick(P.peek), 1.1)); wait(0.2, 'peek'); }
    } else {
      for (const i of six) {
        moveTo(hk.dieX(i) - 10, hk.dieTop + 2, 0.28, 16, 'idle');   // its key is on its right: land the key tip on the die
        wait(0.1, 'act');
        call(() => { locks.set(i, 1); SFX.decrypt(); G.glitch(0.08); hk.float(hk.dieX(i), hk.dieTop + 52, 'ENCRYPTED', PAL.cyan); });
        wait(0.18, 'act');
      }
      call(() => say(pick(P.act), 1.1));
      goHome(0.4);
    }
  }
  call(() => { busy = false; done(); });
}

/** Scoring has started (hand known). SANDBOX rattles the cage if perks would have fired. */
function onScore(key) {
  if (!active()) return;
  if (id === 'sandbox' && run.perks.length) {
    task(0.12, () => { frame = 'act'; }, () => { cageT = 0.4; SFX.slam(1); G.shake(1.5); });
    wait(0.3, 'act'); call(() => { frame = 'idle'; if (Math.random() < 0.5) say(pick(P.act), 1.0); });
  }
  if (id === 'honeypot' && key !== 'pair' && key !== 'bust' && Math.random() < 0.3) say(pick(P.peek), 1.1);
}

/** HONEYPOT: lunge at the score when a pair lands. */
function bite() {
  if (!active() || id !== 'honeypot') return;
  moveTo(hk.TX + hk.TW / 2 + 40, hk.resultY + 30, 0.18, 6, 'act');
  wait(0.12, 'act');
  call(() => { SFX.slam(3); G.shake(4); say(pick(P.act), 1.1); });
  wait(0.35, 'act');
  goHome(0.4);
}

/** Flavour after a roll scores. */
function react(key) {
  if (!active() || busy || tasks.length) return;
  const tier = HANDS[key].tier;
  if (key === 'bust' && Math.random() < 0.45) { say(pick(P.bust), 1.3); wait(0.4, 'act'); call(() => (frame = 'idle')); }
  else if (tier >= 4) { say(pick(P.big), 1.4); wait(0.6, 'peek'); call(() => (frame = 'idle')); }
}

function defeat() {
  if (!id || dead) return;
  tasks = []; cut = null; busy = false;
  dead = 0.001; frame = 'hurt';
  say(P.defeat, 1.6);
  SFX.glitch(); G.glitch(0.5);
}
function gloat() {
  if (!active()) return;
  tasks = [];
  say(P.gloat, 2.2);
  frame = 'act';
}

// ---------- update ----------
function update(dt) {
  if (!id) return;
  bob += dt;
  if (speech) { speech.t += dt; if (speech.t > speech.life + 0.4) speech = null; }
  if (cageT < 1) cageT = Math.min(1, cageT + dt * 3);
  for (const [k, v] of locks) locks.set(k, Math.max(0, v - dt * 3));
  if (freezeT > 0) freezeT -= dt;

  if (dead) {
    dead += dt;
    if (Math.random() < 0.4) hk.spark(x + G.rand(-14, 14), y - G.rand(4, 36));
    if (dead > 1.6) { id = null; caged = false; locks.clear(); }
    return;
  }

  if (cut) {
    cut.t += dt;
    const t = cut.t, cx = hk.TX + hk.TW / 2, cy = hk.TY + 92;
    if (t < 0.55) { y = -60; frame = 'idle'; }
    else if (t < 0.85) { const p = (t - 0.55) / 0.3; y = lerp(-60, cy, p * p); }
    else {
      if (!cut.landed) { cut.landed = true; y = cy; SFX.slam(5); G.shake(7); G.flash(0.3); frame = 'act'; for (let k = 0; k < 16; k++) hk.spark(cx + G.rand(-30, 30), cy - G.rand(0, 8)); }
      if (t > 1.15 && frame === 'act') frame = 'idle';
      if (t > 1.35 && !cut.said) { cut.said = true; say(P.intro, 2.0); }
    }
    x = cx;
    if (t > CUT_LEN - 0.45) { const p = Math.min(1, (t - (CUT_LEN - 0.45)) / 0.45); scale = lerp(2, 1, ease(p)); x = lerp(cx, home.x, ease(p)); y = lerp(cy, home.y, ease(p)); }
    if (t >= CUT_LEN) endCut();
    return;
  }

  // run queued animation steps
  let budget = dt;
  while (tasks.length && budget >= 0) {
    const tk = tasks[0];
    if (tk.dur <= 0) { tasks.shift(); if (tk.end) tk.end(); continue; }
    tk.t += budget;
    const p = Math.min(1, tk.t / tk.dur);
    if (tk.tick) tk.tick(p);
    if (p < 1) break;
    budget = tk.t - tk.dur;
    tasks.shift();
    if (tk.end) tk.end();
  }
  if (!tasks.length && !busy) {
    if ((nextBlink -= dt) <= 0) { blinkT = 0.14; nextBlink = G.rand(1.6, 3.6); }
    if (blinkT > 0) { blinkT -= dt; if (frame === 'idle' || frame === 'blink') frame = blinkT > 0 ? 'blink' : 'idle'; }
  }
}

// ---------- draw ----------
function drawSprite() {
  const img = S[frame] || S.idle;
  const { ctx } = G;
  const w = img.width * scale, h = img.height * scale;
  const by = Math.round(y + (frame === 'idle' && !cut && !tasks.length ? Math.sin(bob * 2.2) : 0));
  ctx.save();
  if (dead) {
    ctx.globalAlpha = Math.max(0, 1 - dead / 1.6) * (Math.floor(dead * 20) % 2 ? 0.4 : 1);
    ctx.translate(G.rand(-2, 2), 0);
  }
  // shadow
  ctx.globalAlpha *= 0.45; G.rect(Math.round(x - w * 0.35), Math.round(y), Math.round(w * 0.7), 2, '#000000');
  ctx.globalAlpha = dead ? ctx.globalAlpha / 0.45 : 1;
  if (flip) { ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(img, Math.round(-w / 2), by - h, w, h); }
  else ctx.drawImage(img, Math.round(x - w / 2), by - h, w, h);
  ctx.restore();
}

function drawSpeech() {
  if (!speech) return;
  const { text: T, rrect, rect } = G;
  const n = Math.min(speech.text.length, Math.floor(speech.t * 45));
  const lines = wrapText(speech.text, 22);
  const w = Math.max(...lines.map(l => l.length)) * 6 + 8, h = lines.length * 9 + 6;
  const img = S[frame] || S.idle;
  let bx = Math.round(x - w + 10), by = Math.round(y - img.height * scale - h - 6);
  bx = G.clamp(bx, hk.TX + 2, hk.TX + hk.TW - w - 2);
  by = Math.max(18, by);
  const fade = speech.t > speech.life ? 1 - (speech.t - speech.life) / 0.4 : 1;
  G.ctx.globalAlpha = Math.max(0, fade);
  rrect(bx - 1, by - 1, w + 2, h + 2, PAL.ink);
  rrect(bx, by, w, h, PAL.white);
  rect(Math.round(x) - 2, by + h, 4, 3, PAL.white);
  let left = n;
  lines.forEach((l, i) => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; T(s, bx + 4, by + 3 + i * 9, PAL.ink); });
  G.ctx.globalAlpha = 1;
}

function drawPadlock(cx, ty, pop) {
  const { rect } = G;
  const s = 1 + pop * 0.6, w = Math.round(9 * s), h = Math.round(7 * s);
  const x0 = Math.round(cx - w / 2), y0 = Math.round(ty - h / 2);
  rect(x0 + 2, y0 - 4, w - 4, 5, PAL.ink); rect(x0 + 3, y0 - 3, w - 6, 3, '#a9a9bd'); rect(x0 + 4, y0 - 2, w - 8, 3, PAL.ink);
  rect(x0 - 1, y0 - 1, w + 2, h + 2, PAL.ink); rect(x0, y0, w, h, '#2ce8f5'); rect(x0, y0, w, 1, '#b6ffcc');
  rect(Math.round(cx) - 1, y0 + 2, 2, 3, PAL.ink);
}

/** On the felt: the boss + its marks on the dice. Call after the dice are drawn. */
function draw() {
  if (!id || cut) return;
  for (const [i, pop] of locks) drawPadlock(hk.dieX(i), hk.dieTop + 22, pop);
  if (freezeT > 0) {
    const { ctx, text, T } = G;
    ctx.globalAlpha = 0.25; G.rect(hk.TX, hk.TY + 30, hk.TW, 80, '#2ce8f5'); ctx.globalAlpha = 1;
    const cx = hk.TX + hk.TW / 2, cy = hk.TY + 60;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + T * 6;
      G.rect(Math.round(cx + Math.cos(a) * 8) - 1, Math.round(cy + Math.sin(a) * 8) - 1, 3, 3, k === 0 ? PAL.white : '#7d9bff');
    }
    text('BUFFERING...', cx, cy + 14, PAL.white, { align: 'center', outline: PAL.ink });
  }
}

/** The boss itself + its speech bubble. Drawn late so it can walk over the sidebar. */
function drawActor() {
  if (!id || cut) return;
  drawSprite();
  drawSpeech();
}

/** Over the perk strip: the SANDBOX cage. Call after the perk strip is drawn. */
function drawCage() {
  if (!caged) return;
  const { rect, ctx } = G;
  const b = hk.perkBox, drop = Math.round((1 - cageT) * -30);
  const shake = cageT < 1 && cageT > 0.5 ? Math.round(Math.sin(cageT * 60) * 1) : 0;
  ctx.globalAlpha = 0.35; rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, '#000000'); ctx.globalAlpha = 1;
  rect(b.x - 3 + shake, b.y - 3 + drop, b.w + 6, 2, '#5a5478');
  rect(b.x - 3 + shake, b.y + b.h + 1 + drop, b.w + 6, 2, '#5a5478');
  for (let xx = b.x - 2; xx <= b.x + b.w + 2; xx += 7) {
    rect(xx + shake, b.y - 3 + drop, 2, b.h + 6, PAL.ink);
    rect(xx + shake, b.y - 3 + drop, 1, b.h + 6, '#a9a9bd');
  }
}

/** Full-screen intro cutscene overlay (call last in render). */
function drawCut() {
  if (!cut) return;
  const { rect, text, ctx, T, W, H } = G;
  const t = cut.t;
  // darken the room
  ctx.globalAlpha = Math.min(0.7, t * 2); rect(0, 0, W, H, '#05030c'); ctx.globalAlpha = 1;
  // alarm bars
  const bar = (yy) => {
    rect(0, yy, W, 11, Math.floor(T * 6) % 2 ? '#3a0610' : '#1a0408');
    for (let k = -2; k < W / 12 + 2; k++) rect(((k * 12 + T * 40) % (W + 24)) - 12, yy, 6, 11, '#e43b44');
    rect(0, yy + 2, W, 7, '#1a0408');
    text('!! INTRUSION DETECTED !!   BOSS FIREWALL ' + run.round + '/' + RULES.ROUNDS + '   !! INTRUSION DETECTED !!', W / 2, yy + 2, PAL.red, { align: 'center' });
  };
  if (t > 0.05) { bar(18); bar(H - 30); }
  // the boss itself (drawn big)
  drawSprite();
  // name card
  if (t > 1.0) {
    const p = Math.min(1, (t - 1.0) / 0.25);
    const cx = hk.TX + hk.TW / 2, yy = hk.TY + 100;
    const off = Math.round((1 - p) * 60);
    ctx.globalAlpha = p;
    const b = BOSSES[id];
    text(b.name, cx - off, yy, P.col, { align: 'center', scale: 2, outline: PAL.ink });
    text('// ' + P.title + ' //', cx + off, yy + 16, PAL.white, { align: 'center', outline: PAL.ink });
    text(b.text, cx, yy + 27, '#ff9aa2', { align: 'center', outline: PAL.ink });
    ctx.globalAlpha = 1;
  }
  drawSpeech();
  if (t > 0.6) text('CLICK TO SKIP', W - 6, H - 42, '#5a4c99', { align: 'right' });
}

return {
  setup, active, intro, skip, resume, beforeRoll, afterLand, onScore, bite, react, defeat, gloat,
  update, draw, drawActor, drawCage, drawCut,
  get held() { return held; },
  get inCut() { return !!cut; },
  get busy() { return busy || tasks.length > 0; },
  PERSONA,
};
})();
