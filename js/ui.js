// ============================================================
//  DOKER — shared pixel UI pieces (panels, buttons, cards, packs)
//  Everything draws through window.G (set up by menu.js).
// ============================================================
const UI = (() => {
'use strict';

const BTN = {
  green:  { base: '#1e8c4f', hi: '#4dff88', dark: '#0f4d2b' },
  blue:   { base: '#3b5dc9', hi: '#7d9bff', dark: '#1f2f6b' },
  red:    { base: '#c42f3c', hi: '#ff6b75', dark: '#6b1820' },
  purple: { base: '#8a3bd4', hi: '#c27bff', dark: '#47206e' },
  grey:   { base: '#3a3550', hi: '#5a5478', dark: '#1e1a30' },
};

function panel(x, y, w, h, accent) {
  const { rrect, rect } = G;
  rrect(x - 1, y - 1, w + 2, h + 2, PAL.ink);
  rrect(x, y, w, h, '#2e2260');
  rect(x + 1, y + 1, w - 2, h - 2, '#120e28');
  if (accent) rect(x + 1, y + 1, w - 2, 1, accent);
}

/** Number in a box: scale 2 if it fits, else scale 1. */
function boxNum(str, cx, y, w, col) {
  const s = textWidth(str, 2) <= w - 4 ? 2 : 1;
  G.text(str, cx, s === 2 ? y : y + 3, col, { align: 'center', scale: s, shadow: PAL.ink });
}

/** b = { x, y, w, h, label, base, hi, dark, disabled } */
function button(b, on) {
  const { rrect, rect, text } = G;
  const c = b.disabled ? BTN.grey : b;
  const y = b.y + (on && !b.disabled ? -1 : 0);
  rrect(b.x - 1, y - 1, b.w + 2, b.h + 4, PAL.ink);
  rrect(b.x, y + 2, b.w, b.h, c.dark);
  rrect(b.x, y, b.w, b.h, on && !b.disabled ? c.hi : c.base);
  rect(b.x + 2, y + 1, b.w - 4, 1, on && !b.disabled ? '#ffffff' : c.hi);
  const tc = b.disabled ? '#8a84a8' : on ? PAL.ink : PAL.white;
  text(b.label, b.x + b.w / 2, y + Math.floor((b.h - 7) / 2), tc, { align: 'center', shadow: on || b.disabled ? null : PAL.ink });
}
const hitBox = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y - 1 && y < b.y + b.h + 3;

// ------------------------------------------------------------
//  item card (perk / patch)
// ------------------------------------------------------------
function rarityPips(r, cx, y) {
  const n = r === 5 ? 5 : r + 1;
  const tw = n * 5 - 2;
  for (let k = 0; k < n; k++) {
    const col = r === 5 ? (Math.floor(G.T * 8 + k) % 2 ? PAL.magenta : PAL.ink) : RARITY.col[r];
    G.rect(Math.round(cx - tw / 2) + k * 5, y, 3, 3, col);
  }
}

function itemCard(it, x, y, w, h, o = {}) {
  const { rect, rrect, text, ctx, T } = G;
  const r = it.rarity, col = RARITY.col[r];
  x = Math.round(x); y = Math.round(y);
  ctx.globalAlpha = 0.4; rrect(x + 2, y + 3, w, h, '#000000'); ctx.globalAlpha = 1;

  if (o.faceDown) {
    rrect(x - 1, y - 1, w + 2, h + 2, PAL.ink);
    rrect(x, y, w, h, PAL.white);
    rect(x + 1, y + 1, w - 2, h - 2, PAL.dpurple);
    ctx.fillStyle = '#4b3a8c';
    for (let yy = y + 2; yy < y + h - 2; yy++)
      for (let xx = x + 2; xx < x + w - 2; xx++)
        if ((xx + yy) % 4 === 0) ctx.fillRect(xx, yy, 1, 1);
    const hex = '0123456789ABCDEF';
    const s = hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    rect(x + w / 2 - 9, y + h / 2 - 6, 18, 11, PAL.ink);
    text(s, x + w / 2, y + h / 2 - 4, PAL.green, { align: 'center' });
    return;
  }

  rrect(x - 1, y - 1, w + 2, h + 2, PAL.ink);
  rrect(x, y, w, h, col);
  rect(x + 1, y + 1, w - 2, h - 2, '#15112c');
  rect(x + 1, y + 1, w - 2, 9, col);
  text(it.kind === 'perk' ? 'PERK' : 'PATCH', x + w / 2, y + 2, PAL.ink, { align: 'center' });

  const code = itemCode(it);
  const jit = r === 5 && Math.random() < 0.15 ? (Math.random() < 0.5 ? -2 : 2) : 0;
  if (r === 5 && jit) text(code, x + w / 2 - jit, y + h / 2 - 8, PAL.cyan, { align: 'center', scale: 2 });
  text(code, x + w / 2 + jit, y + h / 2 - 8, col, { align: 'center', scale: 2, shadow: PAL.ink });

  if (it.kind === 'patch') text('+' + PATCH_BOOST[r].lv + ' LV', x + w / 2, y + h / 2 + 9, PAL.white, { align: 'center' });
  else text(it.revealed ? 'OK' : '??', x + w / 2, y + h / 2 + 9, it.revealed ? PAL.green : '#5a4c99', { align: 'center' });
  rarityPips(r, x + w / 2, y + h - 7);

  // legendary shine sweep
  if (r === 4) {
    ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, w - 2, h - 2); ctx.clip();
    const sx = x - 20 + ((T * 50) % (w + 60));
    ctx.globalAlpha = 0.25;
    for (let k = 0; k < h; k++) rect(sx + k * 0.5, y + k, 4, 1, PAL.white);
    ctx.restore();
  }
  if (o.hover) {
    const e = 2 + Math.round(Math.abs(Math.sin(T * 8)));
    const c = PAL.white, L = 5;
    const X = x - e, Y = y - e, Wd = w + e * 2, Ht = h + e * 2;
    rect(X, Y, L, 1, c); rect(X, Y, 1, L, c); rect(X + Wd - L, Y, L, 1, c); rect(X + Wd - 1, Y, 1, L, c);
    rect(X, Y + Ht - 1, L, 1, c); rect(X, Y + Ht - L, 1, L, c); rect(X + Wd - L, Y + Ht - 1, L, 1, c); rect(X + Wd - 1, Y + Ht - L, 1, L, c);
  }
  if (o.flash > 0) { ctx.globalAlpha = o.flash; rrect(x, y, w, h, PAL.white); ctx.globalAlpha = 1; }
}

// ------------------------------------------------------------
//  pack art — a crimped foil data pack
// ------------------------------------------------------------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * f))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function packArt(def, x, y, w, h, o = {}) {
  const { rect, ctx, text, T } = G;
  x = Math.round(x); y = Math.round(y);
  const base = def.col, dark = shade(base, 0.6), light = shade(base, 1.4);
  ctx.globalAlpha = 0.4; rect(x + 2, y + 4, w, h - 2, '#000000'); ctx.globalAlpha = 1;
  // body with crimped (zig-zag) top and bottom edges
  rect(x - 1, y + 3, w + 2, h - 6, PAL.ink);
  for (let xx = 0; xx < w; xx++) {
    const z = xx % 4 < 2 ? 0 : 1;
    rect(x + xx, y + z, 1, 4 - z, PAL.ink);
    rect(x + xx, y + h - 4, 1, 4 - (1 - z), PAL.ink);
    rect(x + xx, y + 1 + z, 1, 3 - z, light);
    rect(x + xx, y + h - 4, 1, 3 - (1 - z), dark);
  }
  rect(x, y + 4, w, h - 8, base);
  rect(x, y + 4, 2, h - 8, light);
  rect(x + w - 3, y + 4, 3, h - 8, dark);
  if (def.mega) { rect(x, y + 4, w, 1, PAL.gold); rect(x, y + h - 5, w, 1, PAL.gold); }
  // label
  rect(x + 3, y + 8, w - 6, 19, PAL.white);
  text(def.lines[0], x + w / 2, y + 9, PAL.ink, { align: 'center' });
  text(def.lines[1], x + w / 2, y + 18, PAL.ink, { align: 'center' });
  // emblem
  G.ctx.drawImage(DIE.hack[def.mega ? 6 : 5], x + Math.round(w / 2 - 8), y + 31);
  // sheen
  ctx.globalAlpha = 0.18 + Math.sin(T * 3) * 0.06;
  rect(x + 6, y + 4, 2, h - 8, PAL.white);
  ctx.globalAlpha = 1;
  if (o.hover) {
    const e = 2 + Math.round(Math.abs(Math.sin(T * 8)));
    rect(x - e, y - e, 5, 1, PAL.white); rect(x - e, y - e, 1, 5, PAL.white);
    rect(x + w + e - 5, y - e, 5, 1, PAL.white); rect(x + w + e - 1, y - e, 1, 5, PAL.white);
    rect(x - e, y + h + e - 1, 5, 1, PAL.white); rect(x - e, y + h + e - 5, 1, 5, PAL.white);
    rect(x + w + e - 5, y + h + e - 1, 5, 1, PAL.white); rect(x + w + e - 1, y + h + e - 5, 1, 5, PAL.white);
  }
}

function priceTag(price, cx, y, afford) {
  const s = '$' + price;
  const w = textWidth(s) + 6;
  G.rrect(Math.round(cx - w / 2) - 1, y - 1, w + 2, 11, PAL.ink);
  G.rrect(Math.round(cx - w / 2), y, w, 9, afford ? '#3a2a10' : '#3a1016');
  G.text(s, cx, y + 1, afford ? PAL.gold : PAL.red, { align: 'center' });
}

// ------------------------------------------------------------
//  info box: title row + wrapped body
// ------------------------------------------------------------
function infoBox(x, y, w, h, title, titleCol, tag, tagCol, body, bodyCol) {
  panel(x, y, w, h, titleCol);
  const { text } = G;
  if (title) text(title, x + 4, y + 4, titleCol);
  if (tag) text(tag, x + w - 4, y + 4, tagCol || '#8a7fc0', { align: 'right' });
  const lines = Array.isArray(body) ? body : wrapText(body || '', Math.floor((w - 8) / 6));
  lines.slice(0, Math.floor((h - 14) / 9)).forEach((l, i) => text(l, x + 4, y + 14 + i * 9, bodyCol || PAL.white));
}

return { BTN, panel, boxNum, button, hitBox, itemCard, packArt, priceTag, infoBox, rarityPips };
})();
