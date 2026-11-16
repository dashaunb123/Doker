// ============================================================
//  DOKER — main menu scene
//  Internal resolution 384x216, scaled up in whole-pixel steps.
// ============================================================
(() => {
'use strict';

const W = 384, H = 216;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
cv.width = W; cv.height = H;
ctx.imageSmoothingEnabled = false;
const stage = document.getElementById('stage');

function resize() {
  let s = Math.floor(Math.min(innerWidth / W, innerHeight / H));
  if (s < 1) s = Math.min(innerWidth / W, innerHeight / H);
  stage.style.width = W * s + 'px';
  stage.style.height = H * s + 'px';
  document.documentElement.style.setProperty('--px', s + 'px');
}
addEventListener('resize', resize);
resize();

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOutBack = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const easeOutCubic = p => 1 - Math.pow(1 - p, 3);

function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function rrect(x, y, w, h, c) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = c; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
}
function blit(img, x, y, s = 1) { ctx.drawImage(img, Math.round(x), Math.round(y), img.width * s, img.height * s); }
/** Draw centred at (cx, cy), with optional rotation / horizontal squash / alpha. */
function blitC(img, cx, cy, s = 1, rot = 0, sx = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!rot && sx === 1) {
    ctx.drawImage(img, Math.round(cx - img.width * s / 2), Math.round(cy - img.height * s / 2), img.width * s, img.height * s);
  } else {
    ctx.translate(Math.round(cx), Math.round(cy));
    if (rot) ctx.rotate(rot);
    ctx.scale(sx * s, s);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  }
  ctx.restore();
}
const text = (s, x, y, c, o) => drawText(ctx, s, x, y, c, o);

// ---------- state ----------
const params = new URLSearchParams(location.search);
let state = 'boot';
let T = 0, menuT = 0, bootT = 0;
let shake = 0, glitchT = 0, flash = 0, nextGlitch = 8;
let kbMode = false, sel = 0;
let hoverBtn = -1, hoverCard = -1, hoverMascot = false, hoverDeco = -1, hoverLogoDie = false, hoverLogo = false;
const mouse = { x: -99, y: -99, inside: false };

// ============================================================
//  BACKGROUND — dithered swirling plasma (half resolution)
// ============================================================
const BGW = 192, BGH = 108;
const [bgC, bgG] = newCanvas(BGW, BGH);
const bgImg = bgG.createImageData(BGW, BGH);
const RR = new Float32Array(BGW * BGH), AA = new Float32Array(BGW * BGH);
for (let y = 0; y < BGH; y++)
  for (let x = 0; x < BGW; x++) {
    const u = (x - BGW / 2) / BGH, v = (y - BGH / 2) / BGH;
    RR[y * BGW + x] = Math.sqrt(u * u + v * v);
    AA[y * BGW + x] = Math.atan2(v, u);
  }
const RAMP = [[8,6,22],[20,13,44],[36,22,72],[58,32,104],[44,52,120],[28,92,108],[34,138,104]];
const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v => (v + 0.5) / 16);

function drawBackground(ramp = RAMP) {
  const d = bgImg.data;
  const sw = Math.sin(T * 0.13) * 2.2 + 2.6;
  let i = 0;
  for (let y = 0; y < BGH; y++)
    for (let x = 0; x < BGW; x++) {
      const k = y * BGW + x, r = RR[k];
      const a = AA[k] + r * sw + T * 0.08;
      let v = Math.sin(a * 2 + T * 0.4) * 0.45 + Math.sin(r * 9 - T * 0.9) * 0.25 + Math.sin(x * 0.07 + y * 0.05 + T * 0.35) * 0.2;
      v = (v * 0.5 + 0.5) * (1 - r * 0.6);
      const f = clamp(v, 0, 0.999) * (ramp.length - 1);
      let n = f | 0;
      if (f - n > BAYER[(y & 3) * 4 + (x & 3)]) n++;
      const c = ramp[Math.min(n, ramp.length - 1)];
      d[i++] = c[0]; d[i++] = c[1]; d[i++] = c[2]; d[i++] = 255;
    }
  bgG.putImageData(bgImg, 0, 0);
  ctx.drawImage(bgC, 0, 0, W, H);
}

// ============================================================
//  CODE RAIN
// ============================================================
const RAIN_CH = '01<>/#$%*=+DOKER:?'.split('');
const rain = [];
function newDrop(x, init) {
  return { x, y: init ? rand(-H, H) : rand(-80, -10), sp: rand(18, 50), len: randi(4, 11), chars: Array.from({ length: 12 }, () => pick(RAIN_CH)) };
}
for (let x = 2; x < W; x += 8) if (Math.random() < 0.55) rain.push(newDrop(x, true));

function updateRain(dt) {
  for (const d of rain) {
    d.y += d.sp * dt;
    if (Math.random() < dt * 3) d.chars[randi(0, 11)] = pick(RAIN_CH);
    if (d.y - d.len * 8 > H) Object.assign(d, newDrop(d.x, false));
  }
}
function drawRain(strength) {
  for (const d of rain)
    for (let k = 0; k < d.len; k++) {
      const cy = Math.round(d.y - k * 8);
      if (cy < -8 || cy > H) continue;
      ctx.globalAlpha = (k === 0 ? 1 : 0.6 * (1 - k / d.len)) * strength;
      blit(glyph(d.chars[k], k === 0 ? PAL.mint : PAL.green), d.x, cy);
    }
  ctx.globalAlpha = 1;
}

// ============================================================
//  FLOATING CHIPS
// ============================================================
const chips = Array.from({ length: 7 }, () => ({ x: rand(0, W), y: rand(0, H), sp: rand(4, 10), ph: rand(0, 6.28), img: pick(CHIP_IMGS), spin: rand(1, 2.5) }));
function updateChips(dt) {
  for (const c of chips) { c.y -= c.sp * dt; if (c.y < -12) { c.y = H + 12; c.x = rand(0, W); } }
}
function drawChips() {
  for (const c of chips) blitC(c.img, c.x + Math.sin(T * 0.8 + c.ph) * 6, c.y, 1, 0, Math.cos(T * c.spin + c.ph), 0.5);
}

// ============================================================
//  LOGO
// ============================================================
const LOGO_S = 3, LOGO_Y = 6;
const LOGO_UNITS = [11, 13, 11, 11, 11];
const LOGO_X = [];
{
  let x = 0;
  for (const u of LOGO_UNITS) { LOGO_X.push(x); x += u + 1; }
  const x0 = Math.floor((W - (x - 1) * LOGO_S) / 2);
  for (let i = 0; i < 5; i++) LOGO_X[i] = x0 + LOGO_X[i] * LOGO_S;
}
const logo = { face: 5, roll: 0, rollFT: 0, nextRoll: 4, glitch: 0, nextGlitch: 2.5, landed: [0, 0, 0, 0, 0] };
const LOGO_ROLL = 0.75;
const logoImg = i => (i === 1 ? LOGO_DIE[logo.face] : LOGO_GLYPH['DOKER'[i]]);

function rollLogoDie() {
  if (logo.roll > 0) return;
  logo.roll = LOGO_ROLL;
  SFX.dice();
}
function updateLogo(dt) {
  if (logo.roll > 0) {
    logo.roll -= dt; logo.rollFT -= dt;
    if (logo.rollFT <= 0) { logo.face = randi(1, 6); logo.rollFT = 0.07; SFX.tick(); }
    if (logo.roll <= 0) {
      logo.roll = 0;
      logo.face = Math.random() < 0.12 ? 0 : randi(1, 6);
      SFX.land(2);
      if (logo.face === 0) { logo.glitch = 0.4; termPush('> ERR: DIE FACE UNDEFINED'); }
    }
  } else if ((logo.nextRoll -= dt) <= 0) { rollLogoDie(); logo.nextRoll = rand(4, 8); }
  if ((logo.nextGlitch -= dt) <= 0) { logo.glitch = rand(0.12, 0.3); logo.nextGlitch = rand(2.5, 6); }
  if (logo.glitch > 0) logo.glitch -= dt;
}
function drawLogo() {
  for (let i = 0; i < 5; i++) {
    const p = clamp((menuT - (0.1 + i * 0.08)) / 0.55, 0, 1);
    if (p <= 0) continue;
    if (p >= 1 && !logo.landed[i]) { logo.landed[i] = 1; SFX.land(i); shake = Math.max(shake, 1.5); }
    const img = logoImg(i);
    const x = LOGO_X[i];
    let y = LOGO_Y + (1 - easeOutBack(p)) * -80 + Math.round(Math.sin(T * 2.2 + i * 0.7) * 1.5);
    let rot = 0, sq = 1;
    if (i === 1 && logo.roll > 0) {
      const rp = 1 - logo.roll / LOGO_ROLL;
      sq = Math.max(0.08, Math.abs(Math.cos(easeOutCubic(rp) * Math.PI * 4))); // tumble = squash flips
      y -= Math.sin(rp * Math.PI) * 10;
    }
    if (hoverLogo && i !== 1) y += Math.round(Math.sin(T * 40 + i * 2));
    const cx = x + img.width * LOGO_S / 2, cy = y + img.height * LOGO_S / 2;
    if (logo.glitch > 0) {
      const o = randi(2, 4);
      blitC(tinted(img, PAL.cyan), cx - o, cy, LOGO_S, rot, sq, 0.75);
      blitC(tinted(img, PAL.magenta), cx + o, cy + randi(-1, 1), LOGO_S, rot, sq, 0.75);
    }
    blitC(img, cx, cy, LOGO_S, rot, sq);
  }
}

// ============================================================
//  BUTTONS
// ============================================================
const BX = 144, BWD = 96, BHT = 15;
let BY = 74, BSTEP = 19;
const BTN_CONTINUE = { label: 'CONTINUE', base: '#b8860b', hi: '#feae34', dark: '#5c4306', act: actContinue };
const BTN_BASE = [
  { label: 'PLAY',       base: '#1e8c4f', hi: '#4dff88', dark: '#0f4d2b', act: actPlay },
  { label: 'OPTIONS',    base: '#3b5dc9', hi: '#7d9bff', dark: '#1f2f6b', act: actOptions },
  { label: 'COLLECTION', base: '#8a3bd4', hi: '#c27bff', dark: '#47206e', act: actCollection },
  { label: 'QUIT',       base: '#c42f3c', hi: '#ff6b75', dark: '#6b1820', act: actQuit },
];
let BUTTONS = BTN_BASE;
const btnHoverT = [0, 0, 0, 0, 0];
/** Show CONTINUE on top when there is an autosaved run (buttons pack a little tighter). */
function refreshButtons() {
  const has = PLAY.hasSave();
  BUTTONS = has ? [BTN_CONTINUE, ...BTN_BASE] : BTN_BASE;
  BY = has ? 72 : 74; BSTEP = has ? 16 : 19;
  sel = 0;
}
let pressedBtn = -1, pressT = 0;

function hitButton(x, y) {
  for (let i = 0; i < BUTTONS.length; i++) {
    const by = BY + i * BSTEP;
    if (x >= BX - 2 && x < BX + BWD + 2 && y >= by - 1 && y < by + BHT + 3) return i;
  }
  return -1;
}
function activeBtn() { return kbMode ? sel : hoverBtn; }

function drawButtons() {
  for (let i = 0; i < BUTTONS.length; i++) {
    const b = BUTTONS[i];
    const p = clamp((menuT - (0.55 + i * 0.08)) / 0.5, 0, 1);
    if (p <= 0) continue;
    const on = activeBtn() === i;
    const pressed = pressedBtn === i && pressT > 0;
    const wig = on && btnHoverT[i] < 0.25 ? Math.round(Math.sin(btnHoverT[i] * 60) * (1 - btnHoverT[i] * 4) * 2) : 0;
    const x = BX + wig;
    const lift = pressed ? 2 : on ? -1 : 0;
    const by = Math.round(BY + i * BSTEP + (1 - easeOutBack(p)) * 120 + lift);
    const depth = pressed ? 1 : 3 - (on ? 0 : 1);
    rrect(x - 1, by - 1, BWD + 2, BHT + depth + 2, PAL.ink);
    rrect(x, by + depth, BWD, BHT, b.dark);
    rrect(x, by, BWD, BHT, on ? b.hi : b.base);
    rect(x + 2, by + 1, BWD - 4, 1, on ? '#ffffff' : b.hi);
    if (on) {
      // scrolling stripes on the hovered button
      ctx.save(); ctx.beginPath(); ctx.rect(x + 1, by + 2, BWD - 2, BHT - 3); ctx.clip();
      ctx.globalAlpha = 0.18;
      for (let sx = -20 + ((T * 30) % 8); sx < BWD; sx += 8) for (let k = 0; k < BHT; k++) rect(x + sx + k, by + k, 2, 1, '#ffffff');
      ctx.restore();
    }
    text(b.label, x + BWD / 2, by + 4, on ? PAL.ink : PAL.white, { align: 'center', shadow: on ? null : PAL.ink });
    if (on) {
      const bob = Math.round(Math.sin(T * 10) * 1.5);
      text('>', x - 10 + bob, by + 4, b.hi, { shadow: PAL.ink });
      text('<', x + BWD + 5 - bob, by + 4, b.hi, { shadow: PAL.ink });
    }
  }
}

function actContinue() {
  shake = 3; SFX.select();
  termPush('> ./DOKER --RESUME');
  PLAY.queueContinue();
  goTo('play');
}
function actPlay() {
  shake = 3; SFX.select();
  termPush('> ./DOKER --NEW-RUN');
  goTo('play');
}
function actOptions() {
  SFX.select();
  termPush('> NANO DOKER.CFG');
  termPush('> [OPTIONS COMING SOON]');
}
function actCollection() {
  SFX.select();
  termPush('> LS ~/COLLECTION');
  termPush('> 0/52 CARDS DECRYPTED');
}
function actQuit() {
  shake = 5; glitchT = 0.5; SFX.deny(); SFX.glitch();
  termPush('> EXIT');
  termPush('> PERMISSION DENIED.');
  say('NOBODY LEAVES THE TABLE.');
}
function activate(i) {
  pressedBtn = i; pressT = 0.12;
  BUTTONS[i].act();
}

// ============================================================
//  MASCOT — "THE DEALER"
// ============================================================
const MAS = { x: 46, y: 94, s: 2 };
const QUIPS = [
  'THE HOUSE ALWAYS WINS. I AM THE HOUSE NOW.',
  'ROLL THE BONES, FRIEND.',
  'I COUNT CARDS. AND DICE. AND YOU.',
  'FULL HOUSE? MORE LIKE FULL STACK.',
  'SUDO ROLL 6',
  'LUCK IS JUST UNPATCHED CODE.',
  'NICE CURSOR.',
  'PSST. CLICK THE TABLE.',
  'FIVE OF A KIND. THAT IS A DOKER.',
];
let speech = null, nextSpeech = 2.5, blinkT = 0, nextBlink = 2;
const bits = [];
let nextBit = 0;

function wrap(str, n) {
  const out = [];
  let line = '';
  for (const w of str.split(' ')) {
    if (line && (line + ' ' + w).length > n) { out.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
}
function say(txt) {
  speech = { lines: wrap(txt, 14), t: 0, dur: 2.6 + txt.length * 0.05, typed: 0 };
  SFX.talk();
  nextSpeech = rand(9, 15);
}
function hitMascot(x, y) { return x >= MAS.x && x < MAS.x + 48 && y >= MAS.y && y < MAS.y + 54; }

function updateMascot(dt) {
  if ((nextBlink -= dt) <= 0) { blinkT = 0.13; nextBlink = rand(1.8, 4.5); }
  if (blinkT > 0) blinkT -= dt;
  if (speech) {
    speech.t += dt;
    const n = Math.floor(speech.t * 45);
    if (n > speech.typed && n % 3 === 0) SFX.type();
    speech.typed = n;
    if (speech.t > speech.dur) speech = null;
  } else if (menuT > 1 && (nextSpeech -= dt) <= 0) say(pick(QUIPS));
  if ((nextBit -= dt) <= 0) {
    const side = Math.random() < 0.5;
    bits.push({ x: side ? MAS.x - rand(4, 12) : MAS.x + 48 + rand(0, 8), y: MAS.y + rand(26, 40), ch: pick(['0', '1']), life: 1.4 });
    nextBit = rand(0.2, 0.5);
  }
  for (const b of bits) { b.y -= 14 * dt; b.life -= dt; }
  while (bits.length && bits[0].life <= 0) bits.shift();
}

function drawMascot() {
  const { x, y, s } = MAS;
  const appear = clamp((menuT - 0.4) / 0.4, 0, 1);
  if (appear <= 0) return;
  const breathe = Math.round(Math.sin(T * 2) * 0.8);
  const hy = y + breathe * s + Math.round((1 - easeOutCubic(appear)) * 60);

  blit(MASCOT, x, hy, s);

  // screen glow on the face
  ctx.globalAlpha = 0.14 + Math.sin(T * 7) * 0.04;
  rect(x + 7 * s, hy + 10 * s, 10 * s, 2 * s, PAL.green);
  ctx.globalAlpha = 1;

  // eyes follow the mouse
  const lookX = mouse.inside ? clamp(Math.round((mouse.x - (x + 24)) / 50), -1, 1) : 0;
  const lookY = mouse.inside && mouse.y > y + 30 ? 1 : 0;
  for (const col of [8, 14]) {
    const ex = x + (col + lookX) * s, ey = hy + (8 + lookY) * s;
    if (hoverMascot) {
      blit(glyph('$', PAL.gold), ex - 1, ey - 2);
    } else if (blinkT > 0) {
      rect(ex, ey + s, 2 * s, 1, PAL.green);
    } else {
      rect(ex, ey, 2 * s, 2 * s, PAL.green);
      rect(ex, ey, s, s, PAL.mint);
    }
  }

  // laptop + desk
  blit(LAPTOP, x, y + 15 * s + Math.round((1 - easeOutCubic(appear)) * 60), s);
  const dy = y + 54;
  rect(x - 17, dy - 1, 82, 7, PAL.ink);
  rect(x - 16, dy, 80, 1, '#7a62c0');
  rect(x - 16, dy + 1, 80, 4, '#3a2a78');
  rect(x - 16, dy + 4, 80, 1, '#2a1d5c');

  for (const b of bits) {
    ctx.globalAlpha = clamp(b.life, 0, 1) * 0.8;
    blit(glyph(b.ch, PAL.green), b.x, b.y);
  }
  ctx.globalAlpha = 1;
}

function drawSpeech() {
  if (!speech) return;
  const lines = speech.lines;
  const w = Math.max(...lines.map(l => l.length)) * 6 + 7;
  const h = lines.length * 9 + 5;
  const pop = easeOutBack(clamp(speech.t / 0.18, 0, 1));
  const bx = Math.round(clamp(MAS.x + 24 - w / 2, 4, 100 - w));
  const by = Math.round(MAS.y - 8 - h + (1 - pop) * 6);
  rrect(bx - 1, by - 1, w + 2, h + 2, PAL.ink);
  rrect(bx, by, w, h, PAL.white);
  rect(bx + 1, by + h - 1, w - 2, 1, PAL.grey);
  // tail
  const tx = MAS.x + 26, ty = by + h;
  rect(tx, ty, 4, 1, PAL.white); rect(tx + 1, ty + 1, 2, 1, PAL.white); rect(tx + 1, ty + 2, 1, 1, PAL.white);
  rect(tx - 1, ty, 1, 1, PAL.ink); rect(tx + 4, ty, 1, 1, PAL.ink);
  rect(tx, ty + 1, 1, 1, PAL.ink); rect(tx + 3, ty + 1, 1, 1, PAL.ink);
  rect(tx, ty + 2, 1, 1, PAL.ink); rect(tx + 2, ty + 2, 1, 1, PAL.ink); rect(tx + 1, ty + 3, 1, 1, PAL.ink);
  let rem = speech.typed;
  lines.forEach((l, li) => {
    text(l.slice(0, Math.max(0, rem)), bx + 4, by + 3 + li * 9, PAL.ink);
    rem -= l.length + 1;
  });
}

// ============================================================
//  CARD FAN
// ============================================================
const PIV = { x: 314, y: 208 };
const cards = [
  { front: CARD_AS, ang: 0, target: 0, lift: 0 },
  { front: CARD_GLITCH, ang: 0, target: 0, lift: 0 },
  { front: CARD_KH, ang: 0, target: 0, lift: 0 },
];
let nextCardFlip = 5;

function flipCard(i) { cards[i].target += Math.PI; SFX.flip(); }
function hitCard(x, y) {
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i];
    if (c.cx === undefined) continue;
    const dx = x - c.cx, dy = y - c.cy;
    const lx = dx * Math.cos(-c.a) - dy * Math.sin(-c.a);
    const ly = dx * Math.sin(-c.a) + dy * Math.cos(-c.a);
    if (Math.abs(lx) <= 24 && Math.abs(ly) <= 32) return i;
  }
  return -1;
}
function updateCards(dt) {
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    c.ang += (c.target - c.ang) * Math.min(1, dt * 9);
    c.lift += ((hoverCard === i ? 1 : 0) - c.lift) * Math.min(1, dt * 12);
  }
  if ((nextCardFlip -= dt) <= 0) {
    const back = cards.findIndex(c => Math.cos(c.target) < 0);
    flipCard(back >= 0 ? back : randi(0, cards.length - 1));
    nextCardFlip = rand(3.5, 6.5);
  }
}
function drawCards() {
  const appear = clamp((menuT - 0.7) / 0.6, 0, 1);
  if (appear <= 0) return;
  // upright cards (keeps the pixel art crisp) fanned along an arc
  const spread = hoverCard >= 0 ? 1.2 : 1;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const off = (i - 1) * spread * easeOutBack(appear);
    c.a = 0;
    c.cx = Math.round(PIV.x + off * 34 + Math.sin(T * 0.9 + i * 2.1) * 1.5);
    c.cy = Math.round(PIV.y - 80 + Math.abs(off) * 10 - c.lift * 10 + Math.sin(T * 1.4 + i * 1.7) * 2 + (1 - easeOutCubic(appear)) * 100);
    const sx = Math.cos(c.ang);
    const img = sx >= 0 ? c.front : CARD_BACK;
    const sq = Math.max(0.06, Math.abs(sx));
    blitC(tinted(img, '#000000'), c.cx + 3, c.cy + 4, 2, 0, sq, 0.35);
    blitC(img, c.cx, c.cy, 2, 0, sq);
  }
}

// ============================================================
//  DECO DICE (floating, right side)
// ============================================================
const deco = [
  { x: 296, y: 74, face: 6, theme: 'bone', ph: 0, roll: 0, ft: 0, next: 2.5, rot: 0 },
  { x: 362, y: 46, face: 3, theme: 'hack', ph: 2, roll: 0, ft: 0, next: 4.5, rot: 0 },
];
function rollDeco(d) { if (d.roll > 0) return; d.roll = 0.7; SFX.dice(); }
function hitDeco(x, y) { return deco.findIndex(d => Math.hypot(x - d.x, y - d.y) < 18); }
function updateDeco(dt) {
  for (const d of deco) {
    if (d.roll > 0) {
      d.roll -= dt; d.ft -= dt;
      if (d.ft <= 0) { d.face = randi(1, 6); d.ft = 0.07; }
      d.rot = easeOutCubic(1 - d.roll / 0.7) * Math.PI * 4; // used as flip phase
      if (d.roll <= 0) { d.roll = 0; d.rot = 0; SFX.land(1); }
    } else if ((d.next -= dt) <= 0) { rollDeco(d); d.next = rand(3, 6); }
  }
}
function drawDeco() {
  const appear = clamp((menuT - 0.9) / 0.4, 0, 1);
  if (appear <= 0) return;
  for (let i = 0; i < deco.length; i++) {
    const d = deco[i];
    const hop = d.roll > 0 ? Math.sin((1 - d.roll / 0.7) * Math.PI) * 10 : 0;
    const y = d.y + Math.sin(T * 1.6 + d.ph) * 3 - hop;
    const sq = d.roll > 0 ? Math.max(0.08, Math.abs(Math.cos(d.rot))) : 1;
    const wob = hoverDeco === i ? Math.round(Math.sin(T * 20)) : 0;
    blitC(tinted(DIE[d.theme][d.face], '#000000'), d.x + 3, d.y + 14, 2, 0, 1 - hop / 20, 0.25 * appear);
    blitC(DIE[d.theme][d.face], d.x + wob, y, 2, 0, sq, appear);
  }
}

// ============================================================
//  THROWN DICE — click the table to roll
// ============================================================
const FLOOR = 203;
const thrown = [];
const floats = [];
let recent = [];
const COMBO = { 2: 'PAIR!', 3: 'TRIPS!', 4: 'QUADS!', 5: 'DOKER!!' };

function throwDie(x, y) {
  if (thrown.length > 14) thrown.shift();
  thrown.push({
    x, y, vx: rand(-130, 130), vy: rand(-260, -180), rot: 0, vr: rand(-12, 12),
    face: randi(1, 6), theme: Math.random() < 0.3 ? 'hack' : 'bone', settled: false, life: 0, ft: 0,
  });
  SFX.dice();
}
function floatText(x, y, txt, col, big) { floats.push({ x, y, txt, col, life: 1.2, big }); }

function updateThrown(dt) {
  for (const d of thrown) {
    if (d.settled) { d.life += dt; continue; }
    d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
    if ((d.ft -= dt) <= 0) { d.face = randi(1, 6); d.ft = 0.06; }
    if (d.x < 8) { d.x = 8; d.vx = -d.vx * 0.7; }
    if (d.x > W - 8) { d.x = W - 8; d.vx = -d.vx * 0.7; }
    if (d.y > FLOOR - 8) {
      d.y = FLOOR - 8;
      if (Math.abs(d.vy) > 70) { d.vy = -d.vy * 0.45; d.vx *= 0.75; d.vr *= 0.6; SFX.dice(); }
      else settle(d);
    }
  }
  for (let i = thrown.length - 1; i >= 0; i--) if (thrown[i].life > 3.2) thrown.splice(i, 1);
  for (const f of floats) { f.y -= 18 * dt; f.life -= dt; }
  for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);
}
function settle(d) {
  d.settled = true; d.vy = 0;
  d.rot = Math.round(d.rot / (Math.PI / 2)) * (Math.PI / 2);
  SFX.land(d.face);
  floatText(d.x, d.y - 16, '+' + d.face, PAL.gold);
  recent = recent.filter(r => T - r.t < 5);
  recent.push({ face: d.face, t: T });
  const n = Math.min(5, recent.filter(r => r.face === d.face).length);
  if (n >= 2) {
    floatText(d.x, d.y - 28, COMBO[n], n >= 5 ? PAL.green : PAL.yellow, true);
    SFX.combo(n);
    termPush('> ' + COMBO[n] + ' ' + n + 'X ' + d.face + "'S");
    if (n >= 3) { shake = n; flash = 0.15 * n; }
    if (n >= 5) { glitchT = 0.6; recent = []; say('A DOKER! YOU ARE ONE OF US NOW.'); }
  } else if (term.queue.length < 3) termPush('> ROLL D6 = ' + d.face);
}
function drawThrown() {
  for (const d of thrown) {
    if (d.settled && d.life > 2.4 && Math.floor(d.life * 12) % 2) continue; // blink out
    blitC(DIE[d.theme][d.face], d.x, d.y, 1, d.rot);
  }
  for (const f of floats) {
    ctx.globalAlpha = clamp(f.life * 1.5, 0, 1);
    text(f.txt, f.x, f.y, f.col, { align: 'center', outline: PAL.ink, scale: f.big ? 2 : 1 });
  }
  ctx.globalAlpha = 1;
}

// ============================================================
//  TERMINAL
// ============================================================
const TX = 6, TY = 158, TW = 182, TH = 43;
const term = { lines: [], queue: [], typing: null, typed: 0, idle: 4 };
const IDLE_MSGS = [
  '> PING HOUSE.SERVER ... 13MS',
  '> RNG SEED ROTATED',
  '> SNIFFING DEALER PACKETS...',
  '> 3 PLAYERS ONLINE (2 BOTS)',
  '> CHIP BALANCE: $1,337',
  '> DECK INTEGRITY: 51/52 ??',
  '> DICE ENTROPY: SUSPICIOUS',
  '> FIREWALL: [####----] 50%',
  '> WHOAMI: PLAYER_1',
];
function termPush(s) { term.queue.push(String(s).toUpperCase().slice(0, 29)); }
function updateTerm(dt) {
  if (!term.typing && term.queue.length) { term.typing = term.queue.shift(); term.typed = 0; }
  if (term.typing) {
    const before = Math.floor(term.typed);
    term.typed += dt * 50;
    if (Math.floor(term.typed) !== before && before % 2 === 0) SFX.type();
    if (term.typed >= term.typing.length) {
      term.lines.push(term.typing); term.typing = null;
      if (term.lines.length > 10) term.lines.shift();
    }
  } else if ((term.idle -= dt) <= 0) { termPush(pick(IDLE_MSGS)); term.idle = rand(4, 7); }
}
function drawTerminal() {
  const p = clamp((menuT - 0.9) / 0.4, 0, 1);
  if (p <= 0) return;
  const x = TX - Math.round((1 - easeOutCubic(p)) * 200);
  rrect(x - 1, TY - 1, TW + 2, TH + 2, PAL.ink);
  ctx.globalAlpha = 0.88; rect(x, TY, TW, TH, '#060d0a'); ctx.globalAlpha = 1;
  rect(x, TY, TW, 9, PAL.mgreen);
  text('~/DOKER.SH', x + 3, TY + 1, PAL.ink);
  [PAL.red, PAL.gold, PAL.green].forEach((c, i) => { rect(x + TW - 22 + i * 7, TY + 2, 5, 5, PAL.ink); rect(x + TW - 21 + i * 7, TY + 3, 3, 3, c); });
  const shown = term.lines.slice(term.typing ? -2 : -3);
  if (term.typing) shown.push(term.typing.slice(0, Math.floor(term.typed)));
  shown.forEach((l, i) => text(l, x + 4, TY + 12 + i * 10, i === shown.length - 1 ? PAL.mint : PAL.green));
  if (Math.floor(T * 3) % 2 === 0) {
    const last = shown[shown.length - 1] || '';
    rect(x + 4 + last.length * 6, TY + 12 + (shown.length - 1) * 10, 5, 7, PAL.green);
  }
}

// ============================================================
//  TICKER + CORNER INFO
// ============================================================
const TICKER = '*** WELCOME TO DOKER *** CLICK ANYWHERE TO THROW DICE *** FIVE OF A KIND PAYS 50X *** THE HOUSE ALWAYS WINS... UNLESS YOU HACK IT *** ARROWS + ENTER TO NAVIGATE *** M = MUTE   N = MUSIC   C = CRT ';
function drawTicker(str = TICKER) {
  rect(0, 205, W, 11, PAL.ink);
  rect(0, 205, W, 1, PAL.purple);
  const tw = str.length * 6;
  const off = (T * 26) % tw;
  for (let x = -off; x < W; x += tw) text(str, x, 207, PAL.gold);
}
function drawInfo() {
  const p = clamp((menuT - 1.1) / 0.3, 0, 1);
  if (p <= 0) return;
  ctx.globalAlpha = p;
  text('BEST RUN $13,370', W - 6, 182, PAL.gold, { align: 'right', shadow: PAL.ink });
  text('V0.1 ALPHA' + (SFX.muted ? ' // MUTED' : ''), W - 6, 192, '#8a7fc0', { align: 'right', shadow: PAL.ink });
  ctx.globalAlpha = 1;
}

// ============================================================
//  BOOT SCREEN
// ============================================================
const BOOT = [
  'DOKER BIOS V0.1 // HOUSE OF BONES',
  '',
  '> MOUNTING /DEV/DICE ......... OK',
  '> SHUFFLING 52 CARDS ......... OK',
  '> STACKING CHIPS ............. OK',
  '> BYPASSING HOUSE EDGE ....... ??',
  '> ACCESS GRANTED',
];
const BOOT_CPS = 80, BOOT_PAUSE = 8;
const BOOT_TOTAL = BOOT.reduce((n, l) => n + l.length + BOOT_PAUSE, 0);
const bootDone = () => bootT * BOOT_CPS >= BOOT_TOTAL;

function renderBoot() {
  rect(0, 0, W, H, '#03020a');
  drawRain(0.15);
  let budget = Math.floor(bootT * BOOT_CPS), y = 14, lastX = 12, lastY = 14;
  for (const line of BOOT) {
    if (budget <= 0) break;
    const n = Math.min(line.length, budget);
    const col = line.includes('??') ? PAL.gold : line.startsWith('DOKER') ? PAL.white : PAL.green;
    text(line.slice(0, n), 12, y, col);
    lastX = 12 + n * 6; lastY = y;
    budget -= line.length + BOOT_PAUSE;
    y += 10;
  }
  if (bootDone()) {
    blitC(LOGO_DIE[Math.floor(T * 2) % 6 + 1], W / 2, 132, 3, Math.sin(T * 2) * 0.25);
    if (Math.floor(T * 2.5) % 2 === 0) text('PRESS ANY KEY TO JACK IN', W / 2, 172, PAL.gold, { align: 'center', shadow: PAL.ink });
  } else if (Math.floor(T * 6) % 2 === 0) rect(lastX, lastY, 5, 7, PAL.green);
}

function startMenu() {
  state = 'menu'; menuT = 0;
  refreshButtons();
  glitchT = 0.45; flash = 0.8;
  SFX.boot();
  MUSIC.play('menu');
  termPush('> CONNECTED: HOUSE.SERVER');
  termPush('> WELCOME BACK, PLAYER_1');
}

// ============================================================
//  SCENE TRANSITION — pixel-block dissolve with a neon edge
// ============================================================
const BLK = 8, BCOLS = W / BLK, BROWS = H / BLK;
const BLOCK_ORDER = Array.from({ length: BCOLS * BROWS }, (_, i) => i);
for (let i = BLOCK_ORDER.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [BLOCK_ORDER[i], BLOCK_ORDER[j]] = [BLOCK_ORDER[j], BLOCK_ORDER[i]];
}
let trans = null;
const TRANS_HALF = 0.32;

function goTo(scene) {
  if (trans) return;
  trans = { t: 0, to: scene, swapped: false };
  SFX.glitch(); SFX.whoosh();
}
function updateTrans(dt) {
  trans.t += dt;
  if (!trans.swapped && trans.t >= TRANS_HALF) {
    trans.swapped = true;
    state = trans.to;
    if (state === 'play') { PLAY.enter(); MUSIC.play('table'); }
    else { menuT = 0; refreshButtons(); logo.landed = [0, 0, 0, 0, 0]; MUSIC.play('menu'); }
    glitchT = 0.2;
  }
  if (trans.t >= TRANS_HALF * 2) trans = null;
}
function drawWipe() {
  const p = trans.t < TRANS_HALF ? trans.t / TRANS_HALF : 1 - (trans.t - TRANS_HALF) / TRANS_HALF;
  const n = Math.floor(clamp(p, 0, 1) * BLOCK_ORDER.length);
  const edge = 60;
  for (let i = 0; i < n; i++) {
    const b = BLOCK_ORDER[i];
    const col = i > n - edge ? (i % 3 ? PAL.green : PAL.mint) : PAL.ink;
    rect((b % BCOLS) * BLK, Math.floor(b / BCOLS) * BLK, BLK, BLK, col);
  }
}

// ============================================================
//  POST FX
// ============================================================
function postGlitch() {
  const n = randi(2, 5);
  for (let i = 0; i < n; i++) {
    const y = randi(0, H - 1), h = randi(2, 10), dx = randi(-12, 12);
    ctx.drawImage(cv, 0, y, W, h, dx, y, W, h);
  }
  ctx.globalAlpha = 0.25;
  rect(0, randi(0, H), W, randi(1, 4), pick([PAL.magenta, PAL.cyan, PAL.green]));
  ctx.globalAlpha = 1;
}

// ============================================================
//  UPDATE / RENDER
// ============================================================
let lastHoverBtn = -1;
function updateHover() {
  hoverBtn = hoverCard = hoverDeco = -1;
  hoverMascot = hoverLogoDie = hoverLogo = false;
  if (state !== 'menu' || menuT < 1 || !mouse.inside || trans) { lastHoverBtn = -1; return; }
  const { x, y } = mouse;
  hoverBtn = hitButton(x, y);
  // only blip when the mouse moves onto a *different* button (was firing every frame)
  const changed = hoverBtn !== lastHoverBtn;
  lastHoverBtn = hoverBtn;
  if (hoverBtn >= 0) {
    if (changed && !(kbMode && sel === hoverBtn)) { SFX.hover(); btnHoverT[hoverBtn] = 0; }
    kbMode = false; sel = hoverBtn;
    return;
  }
  hoverMascot = hitMascot(x, y);
  if (hoverMascot) return;
  hoverCard = hitCard(x, y);
  if (hoverCard >= 0) return;
  hoverDeco = hitDeco(x, y);
  if (hoverDeco >= 0) return;
  hoverLogoDie = x >= LOGO_X[1] && x < LOGO_X[1] + 39 && y >= LOGO_Y && y < LOGO_Y + 48;
  hoverLogo = y >= LOGO_Y && y < LOGO_Y + 48 && x >= LOGO_X[0] && x < LOGO_X[4] + 33;
}

function update(dt) {
  T += dt;
  updateRain(dt);
  if (shake > 0) shake = Math.max(0, shake - dt * 12);
  if (glitchT > 0) glitchT -= dt;
  if (flash > 0) flash = Math.max(0, flash - dt * 3);

  if (trans) updateTrans(dt);

  if (state === 'boot') {
    bootT += dt;
    if (params.has('play')) {
      state = 'play'; PLAY.enter();
      // dev-only test hooks: ?play&auto  ?play&perks=6  ?play&shop  ?play&pack=megaperk
      if (params.has('perks')) rollItems(+params.get('perks') || 5, ['perk'], 3).forEach(it => applyItem(PLAY.run, it));
      // ?wilds=dealer,mirror,botnet  (or ?wilds=3 for random ones); &ed=holo forces an edition
      if (params.has('wilds')) {
        const v = params.get('wilds') || '3';
        const ids = /^\d+$/.test(v) ? WILD_IDS.slice().sort(() => Math.random() - 0.5).slice(0, +v) : v.split(',');
        ids.slice(0, WILD_SLOTS).forEach(id => applyItem(PLAY.run, makeWild(id, params.get('ed') || undefined)));
      }
      if (params.has('shop') || params.has('pack')) { PLAY.run.money = 40; PLAY.debugShop(); }
      if (params.has('pack')) SHOP.debugOpen(params.get('pack') || 'perk');
      if (params.has('auto')) PLAY.auto = true;
    }
    else if (params.has('skipboot')) startMenu();
    return;
  }
  if (state === 'play') { PLAY.update(dt); return; }

  menuT += dt;
  for (let i = 0; i < btnHoverT.length; i++) btnHoverT[i] += dt;
  if (pressT > 0) pressT -= dt;
  if ((nextGlitch -= dt) <= 0) { glitchT = rand(0.08, 0.2); nextGlitch = rand(7, 14); }

  updateHover();
  updateChips(dt);
  updateLogo(dt);
  updateMascot(dt);
  updateCards(dt);
  updateDeco(dt);
  updateThrown(dt);
  updateTerm(dt);
}

function renderMenu() {
  drawBackground();
  drawRain(0.22);
  drawChips();
  drawDeco();
  drawCards();
  drawMascot();
  drawLogo();

  // subtitle typed under the logo
  const SUB = 'ROLL // BLUFF // BREACH';
  const n = clamp(Math.floor((menuT - 0.9) * 28), 0, SUB.length);
  const sx = Math.floor(W / 2 - textWidth(SUB) / 2);
  text(SUB.slice(0, n), sx, 61, PAL.green, { shadow: PAL.ink });
  if (n > 0 && Math.floor(T * 3) % 2 === 0) rect(sx + n * 6, 61, 5, 7, PAL.green);

  drawButtons();
  drawTerminal();
  drawInfo();
  drawSpeech();
  drawTicker();
  drawThrown();
}

function render() {
  rect(0, 0, W, H, '#07061a');
  ctx.save();
  if (shake > 0) ctx.translate(Math.round(rand(-shake, shake)), Math.round(rand(-shake, shake)));
  if (state === 'boot') renderBoot();
  else if (state === 'play') PLAY.render();
  else renderMenu();
  ctx.restore();
  if (glitchT > 0) postGlitch();
  if (flash > 0) { ctx.globalAlpha = flash; rect(0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
  if (trans) drawWipe();
  if (params.has('ff')) { rect(0, 0, W, 9, '#000000'); text(document.title.slice(0, 63), 1, 1, document.title.startsWith('FF OK') ? PAL.green : PAL.red); }
  if (mouse.inside) {
    const hot = state === 'play' ? PLAY.hot()
      : state === 'menu' && (hoverBtn >= 0 || hoverMascot || hoverCard >= 0 || hoverDeco >= 0 || hoverLogoDie);
    blit(hot ? CURSOR_HOT : CURSOR, mouse.x, mouse.y);
  }
}

// shared helpers for other scenes (play.js)
window.G = {
  W, H, ctx, mouse,
  rand, randi, pick, clamp, easeOutBack, easeOutCubic,
  rect, rrect, blit, blitC, text,
  drawBackground, drawRain, drawTicker, goTo,
  shake: n => { shake = Math.max(shake, n); },
  glitch: t => { glitchT = Math.max(glitchT, t); },
  flash: a => { flash = Math.max(flash, a); },
  get T() { return T; },
};

// dev: ?skipboot&ff=3 fast-forwards the simulation N seconds (for screenshots)
if (params.has('ff')) {
  mouse.x = +(params.get('mx') || -99); mouse.y = +(params.get('my') || -99); mouse.inside = params.has('mx');
  try { for (let i = 0, n = +params.get('ff') * 60; i < n; i++) update(1 / 60); render(); document.title = 'FF OK'; }
  catch (e) { document.title = 'FF ERROR: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]; }
  // dev: &clicks=x,y;x,y  clicks each point, then simulates 1.2s
  (params.get('clicks') || '').split(';').filter(Boolean).forEach(pt => {
    const [cx, cy] = pt.split(',').map(Number);
    mouse.x = cx; mouse.y = cy; mouse.inside = true;
    update(1 / 60);
    if (state === 'play') PLAY.onPointer();
    for (let i = 0; i < 72; i++) update(1 / 60);
  });
  glitchT = 0; flash = 0; shake = 0;
}

let last = performance.now();
// Crash guard: an error in one frame must never freeze the game. The run is autosaved,
// so the player can always press ESC -> menu -> CONTINUE.
let crashMsg = '', crashT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    update(dt);
    render();
  } catch (e) {
    console.error(e);
    crashMsg = (e && e.message ? e.message : String(e)).toUpperCase().slice(0, 60);
    crashT = 6;
    try { localStorage.setItem('doker.lastError', (e && e.stack) || String(e)); } catch (_) { /* ignore */ }
    for (let i = 0; i < 16; i++) ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (crashT > 0) {
    crashT -= dt;
    try {
      rect(0, H - 22, W, 22, '#2a0610');
      text('ERROR: ' + crashMsg, 4, H - 19, '#ff6b75');
      text('PROGRESS IS SAVED. ESC -> MENU -> CONTINUE', 4, H - 9, PAL.gold);
    } catch (_) { /* ignore */ }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ============================================================
//  INPUT
// ============================================================
function setMouse(e) {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * W / r.width;
  mouse.y = (e.clientY - r.top) * H / r.height;
  mouse.inside = mouse.x >= 0 && mouse.y >= 0 && mouse.x < W && mouse.y < H;
}
addEventListener('pointermove', setMouse);
document.addEventListener('pointerleave', () => { mouse.inside = false; });

function startAudio() {
  SFX.init();
  if (!MUSIC.name && state !== 'boot') MUSIC.play(state === 'play' ? 'table' : 'menu');
}

addEventListener('pointerdown', e => {
  startAudio();
  setMouse(e);
  if (state === 'boot') { if (bootDone()) startMenu(); else bootT = 999; return; }
  if (trans || !mouse.inside) return;
  if (state === 'play') return PLAY.onPointer(mouse.x, mouse.y);
  if (menuT < 1) return;
  const { x, y } = mouse;
  const b = hitButton(x, y);
  if (b >= 0) return activate(b);
  if (hitMascot(x, y)) { say(pick(QUIPS)); glitchT = 0.12; SFX.glitch(); return; }
  const c = hitCard(x, y);
  if (c >= 0) return flipCard(c);
  const d = hitDeco(x, y);
  if (d >= 0) return rollDeco(deco[d]);
  if (hoverLogoDie) return rollLogoDie();
  throwDie(x, y);
});

addEventListener('keydown', e => {
  startAudio();
  if (state === 'boot') { if (bootDone()) startMenu(); else bootT = 999; return; }
  const k = e.key.toLowerCase();
  if (k === 'm') { SFX.muted = !SFX.muted; return; }
  if (k === 'n') { MUSIC.toggle(); return; }
  if (k === 'c') { document.body.classList.toggle('nocrt'); return; }
  if (trans) return;
  if (state === 'play') { if (k === ' ' || k === 'enter') e.preventDefault(); return PLAY.onKey(k); }
  if (menuT < 1) return;
  if (k === 'arrowdown' || k === 's') { kbMode = true; sel = (sel + 1) % BUTTONS.length; btnHoverT[sel] = 0; SFX.hover(); e.preventDefault(); }
  else if (k === 'arrowup' || k === 'w') { kbMode = true; sel = (sel + BUTTONS.length - 1) % BUTTONS.length; btnHoverT[sel] = 0; SFX.hover(); e.preventDefault(); }
  else if (k === 'enter' || k === ' ') { kbMode = true; activate(sel); e.preventDefault(); }
  else if (k === 'r') throwDie(rand(60, W - 60), 120);
});
})();
