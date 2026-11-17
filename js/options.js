// ============================================================
//  DOKER — OPTIONS screen (a scene inside menu.js: state 'options')
//  Settings live in SET (settings.js) and save as they change.
// ============================================================
const OPTIONS = (() => {
const PX = 52, PY = 4, PW = 280, PH = 208;     // panel
const VX0 = 214, VX1 = 318;                    // value widget: '<' at VX0, '>' at VX1
const VC = (VX0 + VX1) / 2 + 3;

const ROWS = [
  { h: 'AUDIO' },
  { id: 'music', label: 'MUSIC VOLUME', type: 'vol' },
  { id: 'sfx', label: 'SOUND EFFECTS', type: 'vol' },
  { id: 'announcer', label: 'ANNOUNCER (DOKER!!)', type: 'bool' },
  { h: 'VIDEO' },
  { id: 'fullscreen', label: 'FULLSCREEN', type: 'fs' },
  { id: 'crt', label: 'CRT FILTER', type: 'bool' },
  { id: 'shake', label: 'SCREEN SHAKE', type: 'enum', vals: [0, 1, 2], names: ['OFF', 'REDUCED', 'FULL'] },
  { id: 'flashes', label: 'FLASHES + GLITCHES', type: 'enum', vals: [0, 1], names: ['REDUCED', 'FULL'] },
  { h: 'GAMEPLAY' },
  { id: 'speed', label: 'GAME SPEED', type: 'enum', vals: [1, 1.5, 2, 3], names: ['1X', '1.5X', '2X', '3X'] },
  { id: 'bossIntro', label: 'BOSS INTROS', type: 'enum', vals: ['always', 'first'], names: ['ALWAYS', 'FIRST TIME'] },
  { h: 'MORE' },
  { id: 'tutorial', label: 'TUTORIAL', type: 'action', btn: 'PLAY' },
  { id: 'controls', label: 'CONTROLS', type: 'action', btn: 'VIEW' },
  { id: 'reset', label: 'RESET PROGRESS', type: 'action', btn: 'RESET', danger: true },
  { id: 'back', label: '< BACK', type: 'back' },
];
// lay the rows out once
let yy = PY + 22;
for (const r of ROWS) { if (r.type === 'back') yy += 2; r.y = yy; yy += r.h ? 9 : 10; }
const PICK = ROWS.filter(r => !r.h);

let sel = 0, hover = -1, kb = false, t = 0;
let overlay = null;            // null | 'controls' | 'reset'
let typed = '', resetMsg = '', resetErrT = 0, wiped = 0;
let onExit = null;

function enter(exitCb) { onExit = exitCb; sel = 0; hover = -1; overlay = null; t = 0; }

// ---------- values ----------
function valueText(r) {
  if (r.type === 'vol') return null;
  if (r.type === 'bool') return SET[r.id] ? 'ON' : 'OFF';
  if (r.type === 'fs') return document.fullscreenElement ? 'ON' : 'OFF';
  if (r.type === 'enum') return r.names[Math.max(0, r.vals.indexOf(SET[r.id]))];
  return null;
}
function change(r, dir) {
  if (r.type === 'vol') {
    const v = Math.max(0, Math.min(10, SET[r.id] + dir));
    if (v === SET[r.id]) return;
    SET[r.id] = v; SFX.applyVolumes();
    if (r.id === 'sfx') SFX.chip(v); else SFX.select();
  } else if (r.type === 'bool') {
    SET[r.id] = !SET[r.id];
    if (r.id === 'crt') applyCrt();
    SFX.select();
  } else if (r.type === 'fs') {
    G.toggleFullscreen(); SFX.select();
    return;
  } else if (r.type === 'enum') {
    const k = r.vals.indexOf(SET[r.id]);
    SET[r.id] = r.vals[(Math.max(0, k) + dir + r.vals.length) % r.vals.length];
    SFX.select();
    if (r.id === 'shake' && SET.shake) G.shake(3);          // a taste of what you picked
    if (r.id === 'flashes') G.flash(0.5);
  } else return activate(r);
  saveSettings();
}
function activate(r) {
  if (r.type === 'action') {
    SFX.select();
    if (r.id === 'controls') overlay = 'controls';
    if (r.id === 'tutorial') G.startTutorial();
    if (r.id === 'reset') { overlay = 'reset'; typed = ''; resetMsg = ''; wiped = 0; }
    return;
  }
  if (r.type === 'back') { SFX.select(); if (onExit) onExit(); return; }
  change(r, 1);
}

// ---------- reset progress (type CONFIRM) ----------
function tryReset() {
  if (typed !== 'CONFIRM') { resetMsg = 'TYPE CONFIRM EXACTLY.'; resetErrT = 0.5; SFX.deny(); G.shake(2); return; }
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem('doker.save.v1');
    localStorage.removeItem('doker.lastError');
  } catch (e) { /* storage blocked */ }
  SET.seenBosses = []; saveSettings();
  wiped = 1.6; typed = ''; resetMsg = '';
  SFX.glitch(); G.glitch(0.5); G.flash(0.4);
}

// ---------- input ----------
const rowAt = (x, y) => PICK.findIndex(r => x >= PX + 4 && x < PX + PW - 4 && y >= r.y - 2 && y < r.y + 8);
const inBox = (x, y, b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
const OV = { x: 74, y: 40, w: 236, h: 132 };
const RB = { cancel: { x: 100, y: 150, w: 80, h: 13 }, wipe: { x: 204, y: 150, w: 80, h: 13 } };

function update(dt) {
  t += dt;
  if (resetErrT > 0) resetErrT -= dt;
  if (wiped > 0 && (wiped -= dt) <= 0) overlay = null;
  const m = G.mouse;
  const h = overlay || !m.inside ? -1 : rowAt(m.x, m.y);
  if (h !== hover && h >= 0) { SFX.hover(); kb = false; sel = h; }
  hover = h;
}

function onPointer(x, y) {
  if (overlay === 'controls') { overlay = null; SFX.select(); return; }
  if (overlay === 'reset') {
    if (wiped > 0) return;
    if (inBox(x, y, RB.cancel)) { overlay = null; SFX.select(); return; }
    if (inBox(x, y, RB.wipe)) return tryReset();
    return;
  }
  const i = rowAt(x, y);
  if (i < 0) return;
  sel = i;
  const r = PICK[i];
  if (r.type === 'vol' || r.type === 'enum') change(r, x < VC ? -1 : 1);
  else activate(r);
}

/** Raw key from keydown (e.key). Returns true if handled. */
function onKey(key) {
  const k = key.toLowerCase();
  if (overlay === 'controls') { overlay = null; SFX.select(); return true; }
  if (overlay === 'reset') {
    if (wiped > 0) return true;
    if (k === 'escape') { overlay = null; SFX.select(); }
    else if (k === 'enter') tryReset();
    else if (k === 'backspace') { typed = typed.slice(0, -1); SFX.hover(); }
    else if (/^[a-z]$/.test(k) && typed.length < 10) { typed += k.toUpperCase(); SFX.chip(typed.length); resetMsg = ''; }
    return true;
  }
  kb = true;
  if (k === 'escape' || k === 'backspace') { SFX.select(); if (onExit) onExit(); }
  else if (k === 'arrowdown' || k === 's') { sel = (sel + 1) % PICK.length; SFX.hover(); }
  else if (k === 'arrowup' || k === 'w') { sel = (sel + PICK.length - 1) % PICK.length; SFX.hover(); }
  else if (k === 'arrowleft' || k === 'a') change(PICK[sel], -1);
  else if (k === 'arrowright' || k === 'd') change(PICK[sel], 1);
  else if (k === 'enter' || k === ' ') activate(PICK[sel]);
  else return false;
  return true;
}
/** While typing CONFIRM, every key belongs to the text box (so M/N/C/F don't fire their shortcuts). */
const typing = () => overlay === 'reset';
const hot = () => hover >= 0 || !!overlay;

// ---------- draw ----------
function arrow(x, y, dir, on) { G.text(dir < 0 ? '<' : '>', x, y, on ? PAL.white : '#5a5478'); }

function drawRow(r, i) {
  const { rect, text, ctx } = G;
  const on = i === sel && (kb || hover === i);
  if (on) {
    ctx.globalAlpha = 0.35; rect(PX + 4, r.y - 2, PW - 8, 10, r.danger ? PAL.dred : PAL.mgreen); ctx.globalAlpha = 1;
    if (Math.floor(t * 3) % 2 === 0) text('>', PX + 6, r.y, PAL.green);
  }
  if (r.type === 'back') { text(r.label, PX + 14, r.y, on ? PAL.white : PAL.grey); return; }
  text(r.label, PX + 14, r.y, r.danger ? '#ff6b75' : on ? PAL.white : '#c9c3ea');
  if (r.type === 'action') {
    const col = r.danger ? (on ? '#ff6b75' : PAL.dred) : on ? PAL.white : '#7d9bff';
    text('[ ' + r.btn + ' ]', VC, r.y, col, { align: 'center' });
    return;
  }
  arrow(VX0, r.y, -1, on);
  arrow(VX1, r.y, 1, on);
  if (r.type === 'vol') {
    const v = SET[r.id], bx = VC - 27;
    for (let k = 0; k < 10; k++) rect(bx + k * 5 + 1, r.y + 1, 4, 5, k < v ? (on ? PAL.green : PAL.mgreen) : '#2e2260');
    text(String(v), VX1 - 9, r.y, on ? PAL.white : '#8a7fc0', { align: 'right' });
    return;
  }
  const v = valueText(r);
  const good = v === 'ON' || v === 'FULL' || v === 'ALWAYS' || v === '1X';
  text(v, VC, r.y, on ? PAL.white : good ? PAL.green : PAL.gold, { align: 'center' });
}

function drawControls() {
  const { text } = G;
  UI.panel(OV.x, OV.y, OV.w, OV.h, PAL.cyan);
  text('CONTROLS', OV.x + OV.w / 2, OV.y + 6, PAL.cyan, { align: 'center', scale: 2 });
  const L = [
    ['CLICK / SPACE', 'ROLL THE DICE'],
    ['CLICK A CARD', 'INSPECT, SELL, MOVE'],
    ['ARROWS + ENTER', 'MENUS + RIG PICKER'],
    ['ESC', 'BACK TO MENU (RUN SAVES)'],
    ['M', 'MUTE EVERYTHING'],
    ['N', 'MUSIC ON / OFF'],
    ['C', 'CRT FILTER'],
    ['F', 'FULLSCREEN'],
  ];
  L.forEach(([a, b], i) => {
    text(a, OV.x + 10, OV.y + 26 + i * 11, PAL.gold);
    text(b, OV.x + OV.w - 10, OV.y + 26 + i * 11, '#c9c3ea', { align: 'right' });
  });
  if (Math.floor(t * 2) % 2 === 0) text('CLICK OR PRESS ANY KEY', OV.x + OV.w / 2, OV.y + OV.h - 12, '#8a7fc0', { align: 'center' });
}

function drawReset() {
  const { rect, text, ctx } = G;
  UI.panel(OV.x, OV.y, OV.w, OV.h, PAL.red);
  text('RESET PROGRESS', OV.x + OV.w / 2, OV.y + 6, PAL.red, { align: 'center', scale: 2 });
  if (wiped > 0) {
    text('PROGRESS WIPED.', OV.x + OV.w / 2, OV.y + 56, PAL.green, { align: 'center', scale: 2 });
    text('FRESH START. GOOD LUCK.', OV.x + OV.w / 2, OV.y + 78, '#c9c3ea', { align: 'center' });
    return;
  }
  text('THIS DELETES YOUR UNLOCKED RIGS', OV.x + OV.w / 2, OV.y + 26, '#c9c3ea', { align: 'center' });
  text('AND STAKES, YOUR SAVED RUN AND', OV.x + OV.w / 2, OV.y + 36, '#c9c3ea', { align: 'center' });
  text('THE BOSSES YOU HAVE MET.', OV.x + OV.w / 2, OV.y + 46, '#c9c3ea', { align: 'center' });
  text('TYPE CONFIRM TO CONTINUE:', OV.x + OV.w / 2, OV.y + 62, PAL.gold, { align: 'center' });
  // the input box
  const bx = OV.x + 58, by = OV.y + 74, bw = 120, bh = 16;
  const dx = resetErrT > 0 ? Math.round(Math.sin(resetErrT * 60) * 2) : 0;
  rect(bx + dx - 1, by - 1, bw + 2, bh + 2, typed === 'CONFIRM' ? PAL.green : '#5a5478');
  rect(bx + dx, by, bw, bh, PAL.ink);
  const ok = typed === 'CONFIRM';
  text(typed, bx + dx + bw / 2, by + 5, ok ? PAL.green : PAL.white, { align: 'center' });
  if (Math.floor(t * 3) % 2 === 0) rect(bx + dx + bw / 2 + textWidth(typed) / 2 + 2, by + 4, 5, 8, ok ? PAL.green : PAL.white);
  if (resetMsg) text(resetMsg, OV.x + OV.w / 2, OV.y + 96, '#ff6b75', { align: 'center' });
  const m = G.mouse;
  UI.button({ ...RB.cancel, label: 'CANCEL', ...UI.BTN.blue }, m.inside && inBox(m.x, m.y, RB.cancel));
  UI.button({ ...RB.wipe, label: 'WIPE IT', ...(UI.BTN.red || UI.BTN.blue), disabled: !ok }, ok && m.inside && inBox(m.x, m.y, RB.wipe));
  ctx.globalAlpha = 1;
}

function render() {
  const { text, ctx, rect } = G;
  UI.panel(PX, PY, PW, PH, PAL.green);
  text('OPTIONS', PX + PW / 2, PY + 6, PAL.green, { align: 'center', scale: 2, shadow: PAL.ink });
  for (const r of ROWS) if (r.h) {
    text('// ' + r.h, PX + 8, r.y, '#6b5fa8');
    rect(PX + 8 + textWidth('// ' + r.h) + 4, r.y + 3, PW - 24 - textWidth('// ' + r.h), 1, '#2e2260');
  }
  PICK.forEach(drawRow);
  if (overlay) { ctx.globalAlpha = 0.7; rect(0, 0, G.W, G.H, PAL.ink); ctx.globalAlpha = 1; }
  if (overlay === 'controls') drawControls();
  if (overlay === 'reset') drawReset();
}

return { enter, update, render, onPointer, onKey, typing, hot };
})();
