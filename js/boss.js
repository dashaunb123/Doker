// ============================================================
//  DOKER — BOSS ACTORS. Boss firewalls (rounds 4 and 8) get a giant
//  character that rises up behind the table and looms over it, watching.
//  Its energy veins crawl across the room, and it leans in to enforce its
//  rule in person (pounds a die to 1, beams padlocks onto 6s, sucks rolls out
//  of the counter, slams a cage on the perks, bites the score).
//  Sprites: BOSS_ART_DEFS (js/bossart.js). Rules: BOSSES (js/items.js).
//  play.js drives it through the hooks returned at the bottom.
// ============================================================
const BOSS = (() => {
'use strict';

const BIG = 2.5;                   // how much bigger than the sprite the looming boss is drawn

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
let x = 0, y = 0, home = { x: 0, y: 0 }, frame = 'idle', scale = BIG, lookX = 0;
let tasks = [], busy = false;
let speech = null;                 // { text, t, life }
let cut = null;                    // intro cutscene { t, done }
let dead = 0;                      // >0 while the defeat animation plays
let caged = false, cageT = 0;      // SANDBOX cage over the perk strip
let locks = new Map();             // ENCRYPTION padlocks: die index -> pop timer
let freezeT = 0;                   // LAG: dice frozen mid-air
let held = 0;                      // LAG: rolls still on show before it eats them (intro)
let veins = [];                    // glowing energy cracks crawling out from the boss
let beams = [];                    // { x1, y1, x2, y2, life, col }
let motes = [];                    // particles sucked toward / flung from the boss
let rings = [];                    // shockwaves { x, y, r, life }
let blinkT = 0, nextBlink = 2, bob = 0, presence = 0;

const pick = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const img = () => S[frame] || S.idle;
const topY = () => y - img().height * scale;           // top of the drawn sprite
const mouthY = () => y - img().height * scale * 0.45;  // roughly the face/hands

/** hooks from play.js: { TX, TY, TW, TH, dieX(i), dieTop, face(i), setFace(i,f), float(x,y,txt,col,big),
 *  spark(x,y), rollsBox:{x,y}, perkBox:{x,y,w,h}, encrypted(i), resultY } */
function setup(r, hooks) {
  run = r; hk = hooks;
  id = r.boss || null;
  tasks = []; busy = false; speech = null; cut = null; dead = 0;
  caged = false; cageT = 0; locks = new Map(); freezeT = 0; held = 0;
  beams = []; motes = []; rings = []; presence = 0;
  if (!id) return;
  P = PERSONA[id]; S = spritesFor(id);
  home = { x: hk.TX + hk.TW / 2, y: hk.TY - 8 + S.idle.height * BIG };
  x = home.x; y = home.y; frame = 'idle'; scale = BIG;
  makeVeins();
}
const active = () => !!id && !dead;

/** Lightning-like cracks from behind the boss out to the edges of the screen. */
function makeVeins() {
  veins = [];
  const cx = home.x, cy = hk.TY + 40;
  for (let k = 0; k < 11; k++) {
    const ang = Math.PI + (k / 10) * Math.PI + G.rand(-0.15, 0.15) + (k > 5 ? 0.25 : -0.25) * (k % 2);
    const pts = [[cx + Math.cos(ang) * 30, cy + Math.sin(ang) * 18]];
    let px = pts[0][0], py = pts[0][1], dir = ang;
    const len = G.rand(16, 26);
    for (let s = 0; s < len; s++) {
      dir += G.rand(-0.55, 0.55);
      dir = lerp(dir, ang, 0.35);
      px += Math.cos(dir) * G.rand(6, 11); py += Math.sin(dir) * G.rand(5, 9);
      pts.push([px, py]);
      if (px < -10 || px > G.W + 10 || py < -10 || py > G.H + 10) break;
    }
    // ...and two that crawl down the sides of the table
    const branches = [];
    for (let b = 0; b < 2; b++) {
      const at = pts[Math.floor(G.rand(2, pts.length - 1))];
      if (!at) continue;
      let bx = at[0], by = at[1], bd = ang + G.rand(-1.1, 1.1);
      const bp = [[bx, by]];
      for (let s = 0; s < 5; s++) { bd += G.rand(-0.6, 0.6); bx += Math.cos(bd) * 6; by += Math.sin(bd) * 5; bp.push([bx, by]); }
      branches.push(bp);
    }
    veins.push({ pts, branches, ph: Math.random() * 6 });
  }
  for (const side of [-1, 1]) {
    let px = cx + side * 60, py = cy, dir = side < 0 ? Math.PI * 0.75 : Math.PI * 0.25;
    const pts = [[px, py]];
    for (let s = 0; s < 22; s++) { dir += G.rand(-0.5, 0.5); dir = lerp(dir, side < 0 ? Math.PI * 0.6 : Math.PI * 0.4, 0.3); px += Math.cos(dir) * 8; py += Math.sin(dir) * 8; pts.push([px, py]); }
    veins.push({ pts, branches: [], ph: Math.random() * 6 });
  }
}

// ---------- task queue (sequential little animations) ----------
function task(dur, tick, end) { tasks.push({ dur, t: 0, tick, end }); }
function wait(dur, f) { task(dur, () => { if (f) frame = f; }); }
function call(fn) { task(0, null, fn); }
/** Lean the looming body toward a point (clamped: it stays behind the table). */
function lean(tx, dy, dur, f = 'idle', sc = BIG) {
  let sx, sy, ss;
  const ex = home.x + G.clamp(tx - home.x, -95, 95), ey = home.y + dy;
  task(dur, p => {
    if (sx === undefined) { sx = x; sy = y; ss = scale; }
    const e = ease(p);
    x = lerp(sx, ex, e); y = lerp(sy, ey, e); scale = lerp(ss, sc, e);
    frame = f;
  }, () => { x = ex; y = ey; scale = sc; });
}
function settle(dur = 0.35) { lean(home.x, 0, dur, 'idle', BIG); call(() => { frame = 'idle'; }); }
function say(text, life = 1.8) { speech = { text, t: 0, life }; SFX.talk(); }
function beam(x2, y2, col, life = 0.35) { beams.push({ x1: x, y1: mouthY(), x2, y2, life, max: life, col: col || P.col }); }
function suck(fx, fy, n, col) { for (let k = 0; k < n; k++) motes.push({ x: fx + G.rand(-8, 8), y: fy + G.rand(-4, 4), tx: () => x, ty: () => mouthY(), t: -k * 0.03, col: col || P.col }); }

// ---------- intro cutscene: it rises out of the dark behind the table ----------
const CUT_LEN = 3.8;
function intro(done) {
  if (!id) return done();
  cut = { t: 0, done, risen: false, said: false };
  if (id === 'lag') held = Math.max(0, Math.min(RULES.ROLLS, run.rollsLeft + 3) - run.rollsLeft);
  x = home.x; y = home.y + 140; scale = BIG; frame = 'blink'; presence = 0;
  SFX.fail(); G.glitch(0.6);
}
function endCut() {
  if (!cut) return;
  const done = cut.done;
  cut = null; x = home.x; y = home.y; scale = BIG; frame = 'idle'; presence = 1;
  // rule set-pieces right after the intro
  if (id === 'lag') {
    busy = true;
    lean(hk.rollsBox.x, 10, 0.5, 'peek');
    for (let k = 0; k < 3; k++) {
      wait(0.12, 'act');
      call(() => {
        held = Math.max(0, held - 1); SFX.slam(k); G.shake(2);
        suck(hk.rollsBox.x + 40, hk.rollsBox.y + 18, 8, PAL.green);
        hk.float(hk.rollsBox.x + 70, hk.rollsBox.y - 4, '-1 ROLL', PAL.red);
      });
      wait(0.3, 'peek');
    }
    call(() => { held = 0; say('MMM... CRUNCHY.'); });
    settle(0.5);
    call(() => { busy = false; done(); });
  } else if (id === 'sandbox') {
    busy = true;
    wait(0.25, 'act');
    lean(hk.perkBox.x + hk.perkBox.w / 2, 18, 0.12, 'act', BIG * 1.05);
    call(() => {
      caged = true; cageT = 0; SFX.slam(2); G.shake(5);
      rings.push({ x: hk.perkBox.x + hk.perkBox.w / 2, y: hk.perkBox.y + 5, r: 6, life: 1 });
      hk.float(hk.perkBox.x + hk.perkBox.w / 2, hk.perkBox.y - 10, 'PERKS LOCKED UP', PAL.red, true);
    });
    wait(0.45, 'act');
    settle(0.45);
    call(() => { busy = false; done(); });
  } else done();
}
function skip() { if (cut) endCut(); }
/** Restore the boss's lasting effects without the cutscene (after CONTINUE). */
function resume() { if (!id) return; presence = 1; if (id === 'sandbox') { caged = true; cageT = 1; } }

// ---------- rule enforcement hooks ----------
/** Before the dice leave: LAG sometimes freezes them. Returns extra launch delay. */
function beforeRoll() {
  locks.clear();
  if (!active()) return 0;
  if (id === 'lag' && Math.random() < 0.4) {
    freezeT = 0.9;
    say(pick(P.act), 1.0);
    task(0.9, () => { frame = 'act'; }, () => { frame = 'idle'; });
    return 0.9;
  }
  return 0;
}

/** After all dice land, before scoring. DDOS pounds its die, CIPHER beams padlocks onto 6s. */
function afterLand(done) {
  if (!active()) return done();
  busy = true;
  if (id === 'ddos') {
    const i = run.ddosDie, tx = hk.dieX(i);
    if (hk.face(i) !== 1) {
      lean(tx, -10, 0.3, 'act');                       // rear up...
      wait(0.12, 'act');
      lean(tx, 26, 0.07, 'peek', BIG * 1.08);           // ...and POUND the table
      call(() => {
        hk.setFace(i, 1); SFX.slam(4); G.shake(6); G.glitch(0.15);
        rings.push({ x: tx, y: hk.dieTop + 20, r: 8, life: 1 });
        beam(tx, hk.dieTop + 20, P.col, 0.25);
        hk.float(tx, hk.dieTop + 52, 'ACCESS DENIED', PAL.red, true);
        say(pick(P.act), 1.2);
      });
      wait(0.3, 'peek');
    } else {
      lean(tx, 22, 0.45, 'peek', BIG * 1.06);           // lean right down for a look
      call(() => say(pick(P.peek), 1.3));
      wait(0.9, 'peek');
    }
    settle(0.4);
  } else if (id === 'encryption') {
    const six = [0, 1, 2, 3, 4].filter(i => hk.encrypted(i));
    if (!six.length) {
      if (Math.random() < 0.5) { lean(home.x, 10, 0.25, 'peek'); call(() => say(pick(P.peek), 1.1)); wait(0.4, 'peek'); settle(0.3); }
    } else {
      lean(home.x, 6, 0.2, 'act');
      for (const i of six) {
        call(() => {
          beam(hk.dieX(i), hk.dieTop + 20, PAL.cyan, 0.3);
          locks.set(i, 1); SFX.decrypt(); G.glitch(0.08);
          hk.float(hk.dieX(i), hk.dieTop + 52, 'ENCRYPTED', PAL.cyan);
        });
        wait(0.24, 'act');
      }
      call(() => say(pick(P.act), 1.1));
      settle(0.4);
    }
  }
  call(() => { busy = false; done(); });
}

/** Scoring has started (hand known). SANDBOX rattles the cage if perks would have fired. */
function onScore(key) {
  if (!active()) return;
  if (id === 'sandbox' && run.perks.length) {
    lean(hk.perkBox.x + hk.perkBox.w / 2, 10, 0.12, 'act');
    call(() => { cageT = 0.4; SFX.slam(1); G.shake(1.5); });
    wait(0.25, 'act');
    call(() => { if (Math.random() < 0.5) say(pick(P.act), 1.0); });
    settle(0.3);
  }
  if (id === 'honeypot' && key !== 'pair' && key !== 'bust' && Math.random() < 0.3) say(pick(P.peek), 1.1);
}

/** HONEYPOT: lunge at the score when a pair lands. */
function bite() {
  if (!active() || id !== 'honeypot') return;
  lean(home.x, 30, 0.16, 'act', BIG * 1.12);
  call(() => {
    SFX.slam(3); G.shake(4); say(pick(P.act), 1.1);
    for (let k = 0; k < 14; k++) motes.push({ x: x + G.rand(-20, 20), y: mouthY() + G.rand(-6, 6), vx: G.rand(-90, 90), vy: G.rand(-120, 20), t: 0, col: G.pick(['#feae34', '#fee761', '#f77622']) });
  });
  wait(0.4, 'act');
  settle(0.4);
}

/** Flavour after a roll scores. */
function react(key) {
  if (!active() || busy || tasks.length) return;
  const tier = HANDS[key].tier;
  if (key === 'bust' && Math.random() < 0.45) { say(pick(P.bust), 1.3); wait(0.5, 'act'); call(() => (frame = 'idle')); }
  else if (tier >= 4) { say(pick(P.big), 1.4); lean(home.x, -6, 0.15, 'peek'); wait(0.5, 'peek'); settle(0.3); }
}

function defeat() {
  if (!id || dead) return;
  tasks = []; cut = null; busy = false;
  dead = 0.001; frame = 'hurt';
  say(P.defeat, 1.6);
  SFX.glitch(); G.glitch(0.5);
  MUSIC.play('table');
}
function gloat() {
  if (!active()) return;
  tasks = [];
  say(P.gloat, 2.4);
  lean(home.x, 12, 0.4, 'act', BIG * 1.1);
}

// ---------- update ----------
function update(dt) {
  if (!id) return;
  bob += dt;
  if (speech) { speech.t += dt; if (speech.t > speech.life + 0.4) speech = null; }
  if (cageT < 1) cageT = Math.min(1, cageT + dt * 3);
  for (const [k, v] of locks) locks.set(k, Math.max(0, v - dt * 3));
  if (freezeT > 0) freezeT -= dt;
  for (const b of beams) b.life -= dt;
  beams = beams.filter(b => b.life > 0);
  for (const r of rings) { r.r += 90 * dt; r.life -= dt * 2.2; }
  rings = rings.filter(r => r.life > 0);
  for (const m of motes) {
    m.t += dt;
    if (m.t < 0) continue;
    if (m.tx) { const tx = m.tx(), ty = m.ty(); m.x += (tx - m.x) * Math.min(1, dt * 7); m.y += (ty - m.y) * Math.min(1, dt * 7); if (Math.abs(tx - m.x) + Math.abs(ty - m.y) < 4) m.dead = true; }
    else { m.vy += 300 * dt; m.x += m.vx * dt; m.y += m.vy * dt; if (m.t > 0.9) m.dead = true; }
  }
  motes = motes.filter(m => !m.dead);
  // it watches you: the body drifts a little toward the cursor
  const mx = G.mouse.inside ? G.mouse.x : home.x;
  lookX += (G.clamp((mx - home.x) / 30, -4, 4) - lookX) * Math.min(1, dt * 3);

  if (dead) {
    dead += dt;
    presence = Math.max(0, 1 - dead / 1.6);
    if (Math.random() < 0.6) hk.spark(x + G.rand(-40, 40), topY() + G.rand(10, img().height * scale));
    if (dead > 1.6) { id = null; caged = false; locks.clear(); }
    return;
  }

  if (cut) {
    cut.t += dt;
    const t = cut.t;
    // eyes in the dark (blink frame), then it rises behind the table with a roar
    if (t < 0.7) { y = home.y + 140; frame = 'blink'; presence = t / 0.7 * 0.3; }
    else if (t < 1.5) {
      const p = (t - 0.7) / 0.8;
      y = lerp(home.y + 140, home.y, ease(p)); presence = 0.3 + 0.7 * p; frame = 'idle';
      if (Math.random() < 0.3) G.shake(1.5);
    } else {
      if (!cut.risen) { cut.risen = true; y = home.y; frame = 'act'; SFX.slam(4); G.shake(7); G.flash(0.3); for (let k = 0; k < 18; k++) hk.spark(home.x + G.rand(-70, 70), hk.TY + G.rand(0, 20)); }
      if (t > 1.9 && frame === 'act') frame = 'idle';
      if (t > 1.7 && !cut.said) { cut.said = true; say(P.intro, 2.0); }
    }
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
function strokeVein(pts, col, w, alpha) {
  const { ctx } = G;
  ctx.globalAlpha = alpha;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let s = 0; s <= n; s++) G.rect(Math.round(lerp(ax, bx, s / n)), Math.round(lerp(ay, by, s / n)), w, w, col);
  }
}

/** Behind everything on the table: the lair tint, the energy veins (whole screen), the looming body.
 *  Call right after the felt is drawn. */
function drawBack() {
  if (!id) return;
  const { ctx, T, W, H } = G;
  const pr = presence;
  // darken the felt into its lair
  ctx.globalAlpha = 0.42 * pr; G.rect(hk.TX, hk.TY, hk.TW, hk.TH, '#05030c');
  ctx.globalAlpha = 0.08 * pr; G.rect(0, 0, W, H, P.col);
  // veins crawl out from behind it
  veins.forEach(v => {
    const flick = 0.55 + Math.sin(T * 3 + v.ph) * 0.25 + (Math.random() < 0.03 ? 0.3 : 0);
    const n = Math.max(2, Math.round(v.pts.length * Math.min(1, pr * 1.2)));
    const pts = v.pts.slice(0, n);
    strokeVein(pts, P.col, 3, 0.18 * flick * pr);
    strokeVein(pts, P.col, 1, 0.8 * flick * pr);
    if (pr > 0.8) v.branches.forEach(b => strokeVein(b, P.col, 1, 0.5 * flick * pr));
  });
  ctx.globalAlpha = 1;
  drawBody();
}

function drawBody() {
  const { ctx, T } = G;
  const im = img();
  const w = im.width * scale, h = im.height * scale;
  const breathe = !cut && !tasks.length && (frame === 'idle' || frame === 'blink') ? Math.sin(bob * 1.8) * 2 : 0;
  const dx = Math.round(x + lookX - w / 2), dy = Math.round(y - h + breathe);
  ctx.save();
  let a = Math.min(1, presence * 1.1);
  if (dead) { a *= Math.floor(dead * 20) % 2 ? 0.35 : 1; ctx.translate(G.rand(-3, 3), 0); }
  // aura: a glowing silhouette just behind it
  const glow = tinted(im, P.col);
  ctx.globalAlpha = a * (0.28 + Math.sin(T * 2.4) * 0.1);
  for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) ctx.drawImage(glow, dx + ox, dy + oy, w, h);
  ctx.globalAlpha = a;
  ctx.drawImage(im, dx, dy, w, h);
  ctx.restore();
}

function drawSpeech() {
  if (!speech) return;
  const { text: T, rrect, rect } = G;
  const n = Math.min(speech.text.length, Math.floor(speech.t * 45));
  const lines = wrapText(speech.text, 22);
  const w = Math.max(...lines.map(l => l.length)) * 6 + 8, h = lines.length * 9 + 6;
  const im = img();
  // beside its head, on whichever side has room
  const right = x + im.width * scale / 2 + 4;
  let bx = right + w < hk.TX + hk.TW - 2 ? right : x - im.width * scale / 2 - w - 4;
  bx = G.clamp(Math.round(bx), 2, G.W - w - 2);
  const by = Math.max(18, Math.round(topY() + 14));
  const fade = speech.t > speech.life ? 1 - (speech.t - speech.life) / 0.4 : 1;
  G.ctx.globalAlpha = Math.max(0, fade);
  rrect(bx - 1, by - 1, w + 2, h + 2, PAL.ink);
  rrect(bx, by, w, h, PAL.white);
  rect(bx < x ? bx + w : bx - 3, by + 4, 3, 3, PAL.white);
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

/** In front of the dice: its marks, beams, shockwaves, particles, the freeze. */
function draw() {
  if (!id || cut) return;
  const { ctx, text, T, rect } = G;
  for (const [i, pop] of locks) drawPadlock(hk.dieX(i), hk.dieTop + 22, pop);
  for (const b of beams) {
    const p = b.life / b.max;
    const pts = [[b.x1, b.y1]];
    for (let s = 1; s < 7; s++) pts.push([lerp(b.x1, b.x2, s / 7) + G.rand(-4, 4), lerp(b.y1, b.y2, s / 7) + G.rand(-3, 3)]);
    pts.push([b.x2, b.y2]);
    strokeVein(pts, b.col, 3, 0.35 * p);
    strokeVein(pts, PAL.white, 1, 0.9 * p);
    ctx.globalAlpha = 1;
  }
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life) * 0.9;
    const s = Math.round(r.r);
    rect(r.x - s, r.y - s / 2, s * 2, 1, P.col); rect(r.x - s, r.y + s / 2, s * 2, 1, P.col);
    rect(r.x - s, r.y - s / 2, 1, s, P.col); rect(r.x + s, r.y - s / 2, 1, s, P.col);
  }
  for (const m of motes) { if (m.t >= 0) { ctx.globalAlpha = 1; rect(Math.round(m.x), Math.round(m.y), 2, 2, m.col); } }
  ctx.globalAlpha = 1;
  if (freezeT > 0) {
    ctx.globalAlpha = 0.25; rect(hk.TX, hk.TY + 30, hk.TW, 80, '#2ce8f5'); ctx.globalAlpha = 1;
    const cx = hk.TX + hk.TW / 2, cy = hk.TY + 60;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + T * 6;
      rect(Math.round(cx + Math.cos(a) * 8) - 1, Math.round(cy + Math.sin(a) * 8) - 1, 3, 3, k === 0 ? PAL.white : '#7d9bff');
    }
    text('BUFFERING...', cx, cy + 14, PAL.white, { align: 'center', outline: PAL.ink });
  }
}

/** Speech bubble on top of everything (incl. the sidebar). */
function drawActor() {
  if (!id || cut) return;
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
  // darkness everywhere, then the boss rising out of it
  ctx.globalAlpha = Math.min(0.55, t * 1.5); rect(0, 0, W, H, '#05030c'); ctx.globalAlpha = 1;
  drawBack();
  const bar = yy => {
    rect(0, yy, W, 11, Math.floor(T * 6) % 2 ? '#3a0610' : '#1a0408');
    for (let k = -2; k < W / 12 + 2; k++) rect(((k * 12 + T * 40) % (W + 24)) - 12, yy, 6, 11, '#e43b44');
    rect(0, yy + 2, W, 7, '#1a0408');
    text('!! INTRUSION DETECTED !!   BOSS FIREWALL ' + run.round + '/' + RULES.ROUNDS + '   !! INTRUSION DETECTED !!', W / 2, yy + 2, PAL.white, { align: 'center' });
  };
  if (t > 0.05) { bar(18); bar(H - 30); }
  // name card under it
  if (t > 1.6) {
    const p = Math.min(1, (t - 1.6) / 0.25);
    const cx = hk.TX + hk.TW / 2, yy = hk.TY + hk.TH - 44;
    const off = Math.round((1 - p) * 60);
    ctx.globalAlpha = 0.75 * p; rect(hk.TX, yy - 4, hk.TW, 42, '#05030c');
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
  update, drawBack, draw, drawActor, drawCage, drawCut,
  get inCut() { return !!cut; },
  get busy() { return busy || tasks.length > 0; },
  get held() { return held; },
  get looming() { return !!id && presence > 0; },
  PERSONA,
};
})();
