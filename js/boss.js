// ============================================================
//  DOKER — BOSS ACTORS. Boss firewalls (rounds 4 and 8) get a giant
//  character that is part of the table: its bust looms over the top edge of
//  the felt (in front of your wildcards, behind your dice), its arms reach out
//  and its hands grip the table's top corners. The hands do the dirty work:
//  pound a die to 1, slap padlocks on 6s, stuff your rolls in its mouth, slam
//  a cage on your perks, grab at your score. Its energy veins crawl across the
//  room. It fades back when you look at your wildcards.
//  Art: BOSS_LOOM_DEFS (js/bossloom.js: bust + hand + anchors), falling back to
//  the full-body BOSS_ART_DEFS (js/bossart.js). Rules: BOSSES (js/items.js).
// ============================================================
const BOSS = (() => {
'use strict';

const LS = 2;                      // the bust and hands are drawn at 2x

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

// ---------- art: bust frames, hand frames, anchors, arm colours ----------
const BUST_FRAMES = ['idle', 'blink', 'act', 'peek', 'hurt'];
const HAND_FRAMES = ['grip', 'open', 'fist', 'point'];
const artCache = {};

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
}

/** Fallback hand (until the boss has drawn hands): a chunky 4-finger claw in its colour. */
function makeFallbackHand(col, f) {
  const [c, g] = newCanvas(20, 18);
  const px = (x, y, w, h, cc) => { g.fillStyle = cc; g.fillRect(x, y, w, h); };
  const dark = shadeHex(col, 0.55), hi = shadeHex(col, 1.35);
  const fingers = f === 'fist' ? [] : f === 'point' ? [[8, 9, 4, 8]] : f === 'open' ? [[1, 1, 3, 7], [6, 0, 3, 7], [11, 0, 3, 7], [16, 1, 3, 7]] : [[2, 9, 3, 8], [7, 10, 3, 8], [12, 10, 3, 8], [16, 9, 3, 7]];
  const palm = f === 'open' ? [2, 7, 16, 9] : f === 'fist' ? [2, 4, 16, 12] : [2, 2, 16, 9];
  for (const [x, y, w, h] of [palm, ...fingers]) px(x - 1, y - 1, w + 2, h + 2, PAL.ink);
  for (const [x, y, w, h] of [palm, ...fingers]) { px(x, y, w, h, col); px(x, y, w, 1, hi); px(x, y + h - 1, w, 1, dark); }
  if (f === 'fist') for (let k = 0; k < 4; k++) px(3 + k * 4, 6, 1, 4, dark);
  return c;
}

function artFor(id) {
  if (artCache[id]) return artCache[id];
  const P0 = PERSONA[id];
  const loom = typeof BOSS_LOOM_DEFS !== 'undefined' && BOSS_LOOM_DEFS[id];
  const full = typeof BOSS_ART_DEFS !== 'undefined' && BOSS_ART_DEFS[id];
  const out = { bust: {}, hand: {} };
  if (loom) {
    const pal = { ...ART_PAL, ...(loom.pal || {}) };
    for (const f of BUST_FRAMES) out.bust[f] = makeSprite(loom.bust[f] || loom.bust.idle, pal);
    for (const f of HAND_FRAMES) out.hand[f] = makeSprite(loom.hand[f] || loom.hand.grip, pal);
    out.shoulders = loom.shoulders; out.wrist = loom.wrist; out.arm = loom.arm;
  } else {
    // stand-in: the full-body sprite as the bust, a drawn claw as the hands
    for (const f of BUST_FRAMES) {
      if (full) out.bust[f] = makeSprite(full.frames[f] || full.frames.idle, { ...ART_PAL, ...(full.pal || {}) });
      else { const [c, g] = newCanvas(36, 36); g.fillStyle = P0.col; g.fillRect(2, 2, 32, 32); out.bust[f] = c; }
    }
    for (const f of HAND_FRAMES) out.hand[f] = makeFallbackHand(shadeHex(P0.col, 0.8), f);
    const w = out.bust.idle.width, h = out.bust.idle.height;
    out.shoulders = [[Math.round(w * 0.18), Math.round(h * 0.42)], [Math.round(w * 0.82), Math.round(h * 0.42)]];
    out.wrist = [10, 2];
    out.arm = { main: shadeHex(P0.col, 0.55), dark: shadeHex(P0.col, 0.32), hi: shadeHex(P0.col, 0.9) };
  }
  out.arm = { main: out.arm.main, dark: out.arm.dark || shadeHex(out.arm.main, 0.6), hi: out.arm.hi || shadeHex(out.arm.main, 1.4) };
  return (artCache[id] = out);
}

// ---------- state ----------
let id = null, run = null, P = null, A = null, hk = null;
let body = { ox: 0, oy: 0, frame: 'idle' };       // bust offset from its home + current frame
let bodyHome = { x: 0, y: 0 };                    // top-left of the bust at rest
let hands = [];                                   // [{ x, y (centre), frame, home:{x,y} }] 0 = left (mirrored), 1 = right
let tasks = [], busy = false;
let speech = null, cut = null, dead = 0;
let caged = false, cageT = 0, locks = new Map(), freezeT = 0, held = 0;
let veins = [], beams = [], motes = [], rings = [];
let blinkT = 0, nextBlink = 2, bob = 0, presence = 0, fade = 1, lookX = 0;

const pick = a => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const bustImg = () => A.bust[body.frame] || A.bust.idle;
const bustW = () => A.bust.idle.width * LS, bustH = () => A.bust.idle.height * LS;
const bustX = () => Math.round(bodyHome.x + body.ox + lookX), bustY = () => Math.round(bodyHome.y + body.oy + breathe());
const mouth = () => ({ x: bustX() + bustW() / 2, y: bustY() + bustH() * 0.62 });
const breathe = () => (!cut && !dead && (body.frame === 'idle' || body.frame === 'blink') ? Math.sin(bob * 1.8) * 1.5 : 0);
const handSize = () => ({ w: A.hand.grip.width * LS, h: A.hand.grip.height * LS });

/** hooks from play.js: { TX, TY, TW, TH, dieX(i), dieTop, face(i), setFace(i,f), float(x,y,txt,col,big),
 *  spark(x,y), rollsBox:{x,y}, perkBox:{x,y,w,h}, encrypted(i), resultY } */
function setup(r, hooks) {
  run = r; hk = hooks;
  id = r.boss || null;
  tasks = []; busy = false; speech = null; cut = null; dead = 0;
  caged = false; cageT = 0; locks = new Map(); freezeT = 0; held = 0;
  beams = []; motes = []; rings = []; presence = 0; fade = 1;
  if (!id) return;
  P = PERSONA[id]; A = artFor(id);
  bodyHome = { x: hk.TX + hk.TW / 2 - bustW() / 2, y: hk.TY - 12 };   // its hood/head pokes up past the top bar
  body = { ox: 0, oy: 0, frame: 'idle' };
  const { w, h } = handSize();
  // hands grip the top corners of the table, fingers curled over the rail
  const hy = hk.TY - 15 + h / 2;          // knuckles land on the rail; the wrists reach up over the top bar
  hands = [
    { x: hk.TX + 12, y: hy, frame: 'grip' },
    { x: hk.TX + hk.TW - 12, y: hy, frame: 'grip' },
  ];
  hands.forEach(hd => (hd.home = { x: hd.x, y: hd.y }));
  makeVeins();
}
const active = () => !!id && !dead;

/** Lightning-like cracks from behind the boss out to the edges of the screen. */
function makeVeins() {
  veins = [];
  const cx = hk.TX + hk.TW / 2, cy = hk.TY + 30;
  for (let k = 0; k < 11; k++) {
    const ang = Math.PI + (k / 10) * Math.PI + G.rand(-0.15, 0.15) + (k > 5 ? 0.25 : -0.25) * (k % 2);
    const pts = [[cx + Math.cos(ang) * 30, cy + Math.sin(ang) * 18]];
    let px = pts[0][0], py = pts[0][1], dir = ang;
    const len = G.rand(16, 26);
    for (let s = 0; s < len; s++) {
      dir += G.rand(-0.55, 0.55); dir = lerp(dir, ang, 0.35);
      px += Math.cos(dir) * G.rand(6, 11); py += Math.sin(dir) * G.rand(5, 9);
      pts.push([px, py]);
      if (px < -10 || px > G.W + 10 || py < -10 || py > G.H + 10) break;
    }
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
  // two that crawl down the sides of the table
  for (const side of [-1, 1]) {
    let px = cx + side * 60, py = cy, dir = side < 0 ? Math.PI * 0.75 : Math.PI * 0.25;
    const pts = [[px, py]];
    for (let s = 0; s < 22; s++) { dir += G.rand(-0.5, 0.5); dir = lerp(dir, side < 0 ? Math.PI * 0.6 : Math.PI * 0.4, 0.3); px += Math.cos(dir) * 8; py += Math.sin(dir) * 8; pts.push([px, py]); }
    veins.push({ pts, branches: [], ph: Math.random() * 6 });
  }
}

// ---------- task queue (sequential little animations) ----------
function task(dur, tick, end) { tasks.push({ dur, t: 0, tick, end }); }
function wait(dur, f) { task(dur, () => { if (f) body.frame = f; }); }
function call(fn) { task(0, null, fn); }
/** Move the bust (offset from home) and set its frame. */
function lean(ox, oy, dur, f = 'idle') {
  let sx, sy;
  task(dur, p => { if (sx === undefined) { sx = body.ox; sy = body.oy; } const e = ease(p); body.ox = lerp(sx, ox, e); body.oy = lerp(sy, oy, e); body.frame = f; },
    () => { body.ox = ox; body.oy = oy; });
}
/** Move a hand (centre) with a little arc; f = hand frame, bf = bust frame while it moves. */
function reach(i, tx, ty, dur, f, bf, hop = 10) {
  let sx, sy;
  const hd = () => hands[i];
  task(dur, p => {
    const h = hd();
    if (sx === undefined) { sx = h.x; sy = h.y; }
    const e = ease(p);
    h.x = lerp(sx, tx, e); h.y = lerp(sy, ty, e) - Math.sin(p * Math.PI) * hop; h.frame = f;
    if (bf) body.frame = bf;
  }, () => { hd().x = tx; hd().y = ty; });
}
/** Two hands at once. */
function reach2(t0, t1, dur, f, bf) {
  let s;
  task(dur, p => {
    if (!s) s = hands.map(h => ({ x: h.x, y: h.y }));
    const e = ease(p);
    [t0, t1].forEach((t, i) => { hands[i].x = lerp(s[i].x, t[0], e); hands[i].y = lerp(s[i].y, t[1], e); hands[i].frame = f; });
    if (bf) body.frame = bf;
  });
}
function handHome(i, dur = 0.35) { reach(i, hands[i].home.x, hands[i].home.y, dur, 'open', null, 12); call(() => (hands[i].frame = 'grip')); }
function settle(dur = 0.35) {
  lean(0, 0, dur, 'idle');
  call(() => { body.frame = 'idle'; });
}
const nearest = x => (x < hk.TX + hk.TW / 2 ? 0 : 1);
function say(text, life = 1.8) { speech = { text, t: 0, life }; SFX.talk(); }
function beam(x1, y1, x2, y2, col, life = 0.3) { beams.push({ x1, y1, x2, y2, life, max: life, col: col || P.col }); }

// ---------- intro cutscene: it rises out of the dark and grabs the table ----------
const CUT_LEN = 3.9;
function intro(done) {
  if (!id) return done();
  cut = { t: 0, done, risen: false, grabbed: false, said: false };
  if (id === 'lag') held = Math.max(0, Math.min(RULES.ROLLS, run.rollsLeft + 3) - run.rollsLeft);
  body.oy = 150; body.frame = 'blink'; presence = 0;
  hands.forEach(h => { h.x = h.home.x + (h.home.x < hk.TX + 50 ? -30 : 30); h.y = -40; h.frame = 'open'; });
  SFX.fail(); G.glitch(0.6);
}
function endCut() {
  if (!cut) return;
  const done = cut.done;
  cut = null; body.ox = 0; body.oy = 0; body.frame = 'idle'; presence = 1;
  hands.forEach(h => { h.x = h.home.x; h.y = h.home.y; h.frame = 'grip'; });
  // rule set-pieces right after the intro
  if (id === 'lag') {
    busy = true;
    const rx = hk.rollsBox.x + 50, ry = hk.rollsBox.y + 16;
    for (let k = 0; k < 3; k++) {
      reach(0, rx, ry, 0.35, 'open', 'peek', 14);                       // reach into the roll counter...
      call(() => { held = Math.max(0, held - 1); SFX.slam(k); G.shake(2); hk.float(rx + 24, ry - 20, '-1 ROLL', PAL.red); });
      reach(0, rx, ry - 2, 0.06, 'fist', 'peek', 0);                     // ...grab one...
      const m = mouth();
      reach(0, m.x - 6, m.y + 4, 0.32, 'fist', 'act', 18);               // ...and stuff it in its mouth
      call(() => { SFX.slam(3); G.shake(1.5); for (let q = 0; q < 6; q++) hk.spark(m.x + G.rand(-8, 8), m.y + G.rand(-4, 4)); });
      wait(0.12, 'act');
    }
    call(() => { held = 0; say('MMM... CRUNCHY.'); });
    handHome(0, 0.4);
    settle(0.3);
    call(() => { busy = false; done(); });
  } else if (id === 'sandbox') {
    busy = true;
    const b = hk.perkBox, cx = b.x + b.w / 2;
    lean(0, -4, 0.2, 'act');
    reach(1, cx, b.y - 34, 0.4, 'fist', 'act', 16);
    reach(1, cx, b.y - 6, 0.07, 'fist', 'act', 0);
    call(() => {
      caged = true; cageT = 0; SFX.slam(2); G.shake(5);
      rings.push({ x: cx, y: b.y + 5, r: 6, life: 1 });
      hk.float(cx, b.y - 12, 'PERKS LOCKED UP', PAL.red, true);
    });
    wait(0.4, 'act');
    handHome(1, 0.4);
    settle(0.3);
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
    reach2([hands[0].home.x + 20, hands[0].home.y + 30], [hands[1].home.x - 20, hands[1].home.y + 30], 0.2, 'open', 'act');
    wait(0.6, 'act');
    reach2([hands[0].home.x, hands[0].home.y], [hands[1].home.x, hands[1].home.y], 0.2, 'grip', 'idle');
    return 0.9;
  }
  return 0;
}

/** After all dice land, before scoring. DDOS pounds its die, CIPHER slaps padlocks onto 6s. */
function afterLand(done) {
  if (!active()) return done();
  busy = true;
  if (id === 'ddos') {
    const i = run.ddosDie, tx = hk.dieX(i), top = hk.dieTop, hi = nearest(tx);
    if (hk.face(i) !== 1) {
      reach(hi, tx, top - 22, 0.32, 'fist', 'act', 14);               // fist hovers over the die...
      wait(0.1, 'act');
      reach(hi, tx, top + 12, 0.06, 'fist', 'act', 0);                // ...SLAM
      call(() => {
        hk.setFace(i, 1); SFX.slam(4); G.shake(6); G.glitch(0.15);
        rings.push({ x: tx, y: top + 20, r: 8, life: 1 });
        hk.float(tx, top + 52, 'ACCESS DENIED', PAL.red, true);
        say(pick(P.act), 1.2);
      });
      wait(0.28, 'act');
      handHome(hi, 0.35);
    } else {
      const ox = G.clamp((tx - (hk.TX + hk.TW / 2)) * 0.3, -30, 30);
      lean(ox, 14, 0.4, 'peek');                                       // leans right down for a peep
      reach(hi, tx + (hi ? 26 : -26), top - 8, 0.4, 'grip', 'peek', 6); // and rests a hand beside it
      call(() => say(pick(P.peek), 1.3));
      wait(0.9, 'peek');
      handHome(hi, 0.35);
    }
    settle(0.3);
  } else if (id === 'encryption') {
    const six = [0, 1, 2, 3, 4].filter(i => hk.encrypted(i));
    if (!six.length) {
      if (Math.random() < 0.5) { lean(0, 8, 0.25, 'peek'); call(() => say(pick(P.peek), 1.1)); wait(0.5, 'peek'); settle(0.3); }
    } else {
      for (const i of six) {
        const tx = hk.dieX(i), hi = nearest(tx), top = hk.dieTop;
        reach(hi, tx, top - 18, 0.26, 'point', 'act', 12);
        reach(hi, tx, top + 8, 0.06, 'fist', 'act', 0);
        call(() => {
          locks.set(i, 1); SFX.decrypt(); G.glitch(0.08);
          rings.push({ x: tx, y: top + 22, r: 5, life: 0.8 });
          hk.float(tx, top + 52, 'ENCRYPTED', PAL.cyan);
        });
        wait(0.14, 'act');
        handHome(hi, 0.28);
      }
      call(() => say(pick(P.act), 1.1));
      settle(0.3);
    }
  }
  call(() => { busy = false; done(); });
}

/** Scoring has started (hand known). SANDBOX rattles the cage if perks would have fired. */
function onScore(key) {
  if (!active()) return;
  if (id === 'sandbox' && run.perks.length) {
    const b = hk.perkBox, cx = b.x + b.w * 0.75;
    reach(1, cx, b.y - 10, 0.18, 'grip', 'act', 8);
    for (let k = 0; k < 3; k++) { reach(1, cx + (k % 2 ? 3 : -3), b.y - 8, 0.06, 'grip', 'act', 0); call(() => { cageT = 0.6; SFX.slam(1); G.shake(1); }); }
    call(() => { if (Math.random() < 0.5) say(pick(P.act), 1.0); });
    handHome(1, 0.3);
    settle(0.2);
  }
  if (id === 'honeypot' && key !== 'pair' && key !== 'bust' && Math.random() < 0.3) say(pick(P.peek), 1.1);
}

/** HONEYPOT: it lunges and grabs at the score when a pair lands. */
function bite() {
  if (!active() || id !== 'honeypot') return;
  const cx = hk.TX + hk.TW / 2, cy = hk.resultY + 18;
  lean(0, 18, 0.14, 'act');
  reach2([cx - 34, cy], [cx + 34, cy], 0.16, 'open', 'act');
  reach2([cx - 18, cy + 4], [cx + 18, cy + 4], 0.06, 'fist', 'act');
  call(() => {
    SFX.slam(3); G.shake(4); say(pick(P.act), 1.1);
    for (let k = 0; k < 14; k++) motes.push({ x: cx + G.rand(-20, 20), y: cy + G.rand(-6, 6), vx: G.rand(-90, 90), vy: G.rand(-140, 0), t: 0, col: G.pick(['#feae34', '#fee761', '#f77622']) });
  });
  wait(0.35, 'act');
  reach2([hands[0].home.x, hands[0].home.y], [hands[1].home.x, hands[1].home.y], 0.35, 'grip', 'idle');
  settle(0.25);
}

/** Flavour after a roll scores: laughs and slaps the table on a bust, flinches at big hands. */
function react(key) {
  if (!active() || busy || tasks.length) return;
  const tier = HANDS[key].tier;
  if (key === 'bust' && Math.random() < 0.5) {
    say(pick(P.bust), 1.3);
    for (let k = 0; k < 2; k++) {
      reach2([hands[0].home.x, hands[0].home.y - 8], [hands[1].home.x, hands[1].home.y - 8], 0.1, 'fist', 'act');
      reach2([hands[0].home.x, hands[0].home.y + 4], [hands[1].home.x, hands[1].home.y + 4], 0.06, 'fist', 'act');
      call(() => { SFX.slam(0); G.shake(2); });
    }
    reach2([hands[0].home.x, hands[0].home.y], [hands[1].home.x, hands[1].home.y], 0.15, 'grip', 'idle');
  } else if (tier >= 4) {
    say(pick(P.big), 1.4);
    lean(0, -8, 0.15, 'peek');
    reach2([hands[0].home.x - 6, hands[0].home.y - 10], [hands[1].home.x + 6, hands[1].home.y - 10], 0.15, 'open', 'peek');
    wait(0.5, 'peek');
    reach2([hands[0].home.x, hands[0].home.y], [hands[1].home.x, hands[1].home.y], 0.25, 'grip', 'idle');
    settle(0.2);
  }
}

function defeat() {
  if (!id || dead) return;
  tasks = []; cut = null; busy = false;
  dead = 0.001; body.frame = 'hurt';
  hands.forEach(h => (h.frame = 'open'));
  say(P.defeat, 1.6);
  SFX.glitch(); G.glitch(0.5);
  MUSIC.play('table');
}
function gloat() {
  if (!active()) return;
  tasks = [];
  say(P.gloat, 2.4);
  lean(0, 10, 0.3, 'act');
  for (let k = 0; k < 3; k++) {
    reach2([hands[0].home.x, hands[0].home.y - 8], [hands[1].home.x, hands[1].home.y - 8], 0.1, 'fist', 'act');
    reach2([hands[0].home.x, hands[0].home.y + 4], [hands[1].home.x, hands[1].home.y + 4], 0.06, 'fist', 'act');
    call(() => { SFX.slam(1); G.shake(2); });
  }
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
  for (const m of motes) { m.t += dt; m.vy += 300 * dt; m.x += m.vx * dt; m.y += m.vy * dt; if (m.t > 0.9) m.dead = true; }
  motes = motes.filter(m => !m.dead);

  // it watches you: the bust drifts toward the cursor
  const m = G.mouse;
  const mx = m.inside ? m.x : hk.TX + hk.TW / 2;
  lookX += (G.clamp((mx - (hk.TX + hk.TW / 2)) / 30, -4, 4) - lookX) * Math.min(1, dt * 3);
  // ...and steps back when you look at your wildcards (top band of the felt)
  const wantFade = !cut && m.inside && m.x >= hk.TX && m.x < hk.TX + hk.TW && m.y >= hk.TY && m.y < hk.TY + 34 ? 0.22 : 1;
  fade += (wantFade - fade) * Math.min(1, dt * 8);

  if (dead) {
    dead += dt;
    presence = Math.max(0, 1 - dead / 1.6);
    body.oy += dt * 30;
    hands.forEach(h => { h.y -= dt * 40; h.x += (h.x < hk.TX + hk.TW / 2 ? -1 : 1) * dt * 30; });
    if (Math.random() < 0.6) hk.spark(bustX() + G.rand(0, bustW()), bustY() + G.rand(0, bustH()));
    if (dead > 1.6) { id = null; caged = false; locks.clear(); }
    return;
  }

  if (cut) {
    cut.t += dt;
    const t = cut.t;
    // eyes in the dark, it rises behind the table, then slams both hands onto the corners
    if (t < 0.7) { body.oy = 150; body.frame = 'blink'; presence = t / 0.7 * 0.3; }
    else if (t < 1.5) {
      const p = (t - 0.7) / 0.8;
      body.oy = lerp(150, 0, ease(p)); presence = 0.3 + 0.7 * p; body.frame = 'idle';
      if (Math.random() < 0.3) G.shake(1.5);
    } else {
      body.oy = 0;
      if (!cut.risen) { cut.risen = true; body.frame = 'act'; SFX.slam(3); G.shake(4); }
      const p = Math.min(1, (t - 1.5) / 0.3);
      hands.forEach(h => { const sx = h.home.x + (h.home.x < hk.TX + 50 ? -30 : 30); h.x = lerp(sx, h.home.x, ease(p)); h.y = lerp(-40, h.home.y, p * p); h.frame = p < 1 ? 'open' : 'grip'; });
      if (p >= 1 && !cut.grabbed) {
        cut.grabbed = true; SFX.slam(4); G.shake(7); G.flash(0.3);
        hands.forEach(h => { for (let k = 0; k < 8; k++) hk.spark(h.x + G.rand(-14, 14), h.y + G.rand(0, 14)); });
      }
      if (t > 2.1 && body.frame === 'act') body.frame = 'idle';
      if (t > 1.9 && !cut.said) { cut.said = true; say(P.intro, 2.0); }
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
    if (blinkT > 0) { blinkT -= dt; if (body.frame === 'idle' || body.frame === 'blink') body.frame = blinkT > 0 ? 'blink' : 'idle'; }
    // idle hands flex their fingers on the rail now and then
    hands.forEach(h => {
      if (h.flexT > 0) { h.flexT -= dt; if (h.flexT <= 0) h.frame = 'grip'; }
      else if (h.frame === 'grip' && Math.random() < dt * 0.25) { h.frame = 'open'; h.flexT = 0.16; }
    });
  }
}

// ---------- draw helpers ----------
function plot(x, y, w, col) { G.rect(Math.round(x - w / 2), Math.round(y - w / 2), w, w, col); }
function strokeVein(pts, col, w, alpha) {
  G.ctx.globalAlpha = alpha;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let s = 0; s <= n; s++) G.rect(Math.round(lerp(ax, bx, s / n)), Math.round(lerp(ay, by, s / n)), w, w, col);
  }
}
/** Wrist position (where the arm meets hand i). */
function wrist(i) {
  const h = hands[i], { w, h: hh } = handSize();
  const left = h.x - w / 2, top = h.y - hh / 2;
  const wx = i === 0 ? left + (A.hand.grip.width - A.wrist[0]) * LS : left + A.wrist[0] * LS;
  return { x: wx, y: top + A.wrist[1] * LS };
}
/** A thick shaded arm from the shoulder, arcing up and over, down to the wrist. */
function drawArm(i, alpha) {
  const sh = A.shoulders[i];
  const x1 = bustX() + sh[0] * LS, y1 = bustY() + sh[1] * LS;
  const { x: x2, y: y2 } = wrist(i);
  const cx = (x1 + x2) / 2 + (x2 - x1) * 0.1, cy = Math.min(y1, y2) - 16;
  const pts = [];
  for (let k = 0; k <= 48; k++) { const p = k / 48; pts.push([(1 - p) * (1 - p) * x1 + 2 * (1 - p) * p * cx + p * p * x2, (1 - p) * (1 - p) * y1 + 2 * (1 - p) * p * cy + p * p * y2]); }
  G.ctx.globalAlpha = alpha;
  for (const [x, y] of pts) plot(x, y, 10, PAL.ink);
  for (const [x, y] of pts) plot(x, y, 8, A.arm.dark);
  for (const [x, y] of pts) plot(x, y - 1, 5, A.arm.main);
  for (const [x, y] of pts) plot(x - 1, y - 2, 2, A.arm.hi);
  // elbow / joint knob
  const [ex, ey] = pts[24];
  plot(ex, ey, 12, PAL.ink); plot(ex, ey, 10, A.arm.dark); plot(ex - 1, ey - 1, 6, A.arm.main);
  G.ctx.globalAlpha = 1;
}
function drawHand(i, alpha) {
  const h = hands[i], im = A.hand[h.frame] || A.hand.grip;
  const { w, h: hh } = handSize();
  const { ctx } = G;
  ctx.save();
  ctx.globalAlpha = alpha;
  const x = Math.round(h.x - w / 2), y = Math.round(h.y - hh / 2);
  if (i === 0) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, hh); }
  else ctx.drawImage(im, x, y, w, hh);
  ctx.restore();
}

// ---------- draw (layers called by play.js) ----------
/** 1. Right after the felt: the lair tint and the energy veins crawling over the room. */
function drawBack() {
  if (!id) return;
  const { ctx, T, W, H } = G;
  const pr = presence;
  ctx.globalAlpha = 0.42 * pr; G.rect(hk.TX, hk.TY, hk.TW, hk.TH, '#05030c');
  ctx.globalAlpha = 0.08 * pr; G.rect(0, 0, W, H, P.col);
  veins.forEach(v => {
    const flick = 0.55 + Math.sin(T * 3 + v.ph) * 0.25 + (Math.random() < 0.03 ? 0.3 : 0);
    const n = Math.max(2, Math.round(v.pts.length * Math.min(1, pr * 1.2)));
    const pts = v.pts.slice(0, n);
    strokeVein(pts, P.col, 3, 0.18 * flick * pr);
    strokeVein(pts, P.col, 1, 0.8 * flick * pr);
    if (pr > 0.8) v.branches.forEach(b => strokeVein(b, P.col, 1, 0.5 * flick * pr));
  });
  ctx.globalAlpha = 1;
}

/** 2. After the wildcard row, before the dice: arms + the bust leaning over the top of the table. */
function drawBody() {
  if (!id || cut) return;
  drawBodyNow(fade);
}
function drawBodyNow(f) {
  const { ctx, T } = G;
  let a = Math.min(1, presence * 1.1) * f;
  if (dead) a *= Math.floor(dead * 20) % 2 ? 0.35 : 1;
  drawArm(0, a); drawArm(1, a);
  const im = bustImg(), x = bustX(), y = bustY(), w = bustW(), h = bustH();
  ctx.save();
  if (dead) ctx.translate(G.rand(-3, 3), 0);
  const glow = tinted(im, P.col);
  ctx.globalAlpha = a * (0.3 + Math.sin(T * 2.4) * 0.1);
  for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) ctx.drawImage(glow, x + ox, y + oy, w, h);
  ctx.globalAlpha = a;
  ctx.drawImage(im, x, y, w, h);
  ctx.restore();
}

/** 3. In front of the dice: padlocks, shockwaves, honey, the freeze. */
function draw() {
  if (!id || cut) return;
  const { ctx, text, T, rect } = G;
  for (const [i, pop] of locks) drawPadlock(hk.dieX(i), hk.dieTop + 22, pop);
  for (const b of beams) {
    const p = b.life / b.max, pts = [[b.x1, b.y1]];
    for (let s = 1; s < 7; s++) pts.push([lerp(b.x1, b.x2, s / 7) + G.rand(-4, 4), lerp(b.y1, b.y2, s / 7) + G.rand(-3, 3)]);
    pts.push([b.x2, b.y2]);
    strokeVein(pts, b.col, 3, 0.35 * p); strokeVein(pts, PAL.white, 1, 0.9 * p);
    ctx.globalAlpha = 1;
  }
  for (const r of rings) {
    ctx.globalAlpha = Math.max(0, r.life) * 0.9;
    const s = Math.round(r.r);
    rect(r.x - s, r.y - s / 2, s * 2, 1, P.col); rect(r.x - s, r.y + s / 2, s * 2, 1, P.col);
    rect(r.x - s, r.y - s / 2, 1, s, P.col); rect(r.x + s, r.y - s / 2, 1, s, P.col);
  }
  for (const m of motes) { ctx.globalAlpha = 1; rect(Math.round(m.x), Math.round(m.y), 2, 2, m.col); }
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

/** 4. Over everything on the table and the sidebar: the hands and the speech bubble. */
function drawActor() {
  if (!id || cut) return;
  const a = Math.min(1, presence * 1.1) * (dead ? (Math.floor(dead * 20) % 2 ? 0.35 : 1) : 1);
  drawHand(0, a); drawHand(1, a);
  drawSpeech();
}

function drawSpeech() {
  if (!speech) return;
  const { text: T, rrect, rect } = G;
  const n = Math.min(speech.text.length, Math.floor(speech.t * 45));
  const lines = wrapText(speech.text, 22);
  const w = Math.max(...lines.map(l => l.length)) * 6 + 8, h = lines.length * 9 + 6;
  // beside its head, on whichever side has room
  const right = bustX() + bustW() - 6;
  let bx = right + w < hk.TX + hk.TW - 2 ? right : bustX() - w + 6;
  bx = G.clamp(Math.round(bx), 2, G.W - w - 2);
  const by = Math.max(18, Math.round(bustY() + 10));
  const fd = speech.t > speech.life ? 1 - (speech.t - speech.life) / 0.4 : 1;
  G.ctx.globalAlpha = Math.max(0, fd);
  rrect(bx - 1, by - 1, w + 2, h + 2, PAL.ink);
  rrect(bx, by, w, h, PAL.white);
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

/** Over the perk strip: the SANDBOX cage. */
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
  ctx.globalAlpha = Math.min(0.55, t * 1.5); rect(0, 0, W, H, '#05030c'); ctx.globalAlpha = 1;
  drawBack();
  drawBodyNow(1);
  drawHand(0, Math.min(1, presence * 1.1)); drawHand(1, Math.min(1, presence * 1.1));
  const bar = yy => {
    rect(0, yy, W, 11, Math.floor(T * 6) % 2 ? '#3a0610' : '#1a0408');
    for (let k = -2; k < W / 12 + 2; k++) rect(((k * 12 + T * 40) % (W + 24)) - 12, yy, 6, 11, '#e43b44');
    rect(0, yy + 2, W, 7, '#1a0408');
    text('!! INTRUSION DETECTED !!   BOSS FIREWALL ' + run.round + '/' + RULES.ROUNDS + '   !! INTRUSION DETECTED !!', W / 2, yy + 2, PAL.white, { align: 'center' });
  };
  if (t > 0.05) { bar(4); bar(H - 30); }
  if (t > 1.8) {
    const p = Math.min(1, (t - 1.8) / 0.25);
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
  update, drawBack, drawBody, draw, drawActor, drawCage, drawCut,
  /** An exploit changed a die: drop CIPHER's padlock from it. */
  clearLock(i) { locks.delete(i); },
  get inCut() { return !!cut; },
  get busy() { return busy || tasks.length > 0; },
  get held() { return held; },
  get looming() { return !!id && presence > 0; },
  PERSONA,
};
})();
