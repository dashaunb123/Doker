// ============================================================
//  DOKER — THE BLACK MARKET (between firewalls) + pack opening
//  Lives in the table area to the right of the run sidebar.
// ============================================================
const SHOP = (() => {
'use strict';

// ---------- layout ----------
const RX = 106, RW = 272, RCX = RX + RW / 2;
const CW = 44, CH = 58, CY = 62;
const SLOTX = [170, 224, 278, 332];                 // 2 software slots, 2 pack slots
const IX = 110, IY = 134, IW = 266, IH = 42;        // info box (title + 3 lines)
const PCW = 40, PCH = 54, PCY = 66;                 // cards inside an open pack
const DX = 112, DY = 58;                            // the Dealer

const GREET = ['WELCOME BACK. NO REFUNDS.', 'FRESH EXPLOITS. BARELY USED.', 'CASH ONLY. OBVIOUSLY.', "DON'T ASK WHERE THIS CAME FROM."];
const BUY   = ['PLEASURE DOING BUSINESS.', 'GOOD CHOICE. PROBABLY.', 'THAT ONE BITES.', 'NO RECEIPTS.'];
const BROKE = ['COME BACK WITH MORE CREDITS.', 'NICE TRY. CREDITS FIRST.', 'YOUR WALLET SAYS NO.'];
const RARE  = ['OOH. THAT ONE IS SPICY.', 'WHERE DID YOU FIND THAT?', 'NOW WE ARE TALKING.'];
const TICK  = '*** BLACK MARKET *** NO REFUNDS *** CASH ONLY *** WHAT HAPPENS HERE STAYS ENCRYPTED *** ';

// ---------- state ----------
let run = null, onDone = null, onSave = null, t = 0;
let items = [], packs = [], rerollCost = 2;
let hover = -1, prevHover = -1, hoverBtn = -1, prevHoverBtn = -1, btns = [];
let hoverW = -1, prevHoverW = -1, selW = -1;      // your wildcards, shown along the top of the shop
let quote = '', quoteT = 0, typed = 0;
let reveal = null;          // { item, t, done, doneT }
let faceFor = null;         // LOADED (legendary) waiting for the player to choose a face
let pack = null;            // open pack
let swap = null;            // { item, done } — wildcard slots are full: pick one to sell first
let dieFor = null;          // { item, done(k) } — a die mod is waiting for you to pick which die gets it
let shakeSlot = -1, shakeT = 0, blinkT = 0, nextBlink = 2;

const money = () => run.money;
/** What an item costs here (PATCH TUESDAY discounts patches). */
function cost(it) {
  let p = itemPrice(it);
  if (it.kind === 'patch') p -= (run.perks || []).filter(q => q.id === 'patchtuesday').reduce((a, q) => a + q.stats.amt, 0);
  if (run.rig === 'whale') p += 1;                                  // WHALE: everything costs $1 more
  if (run.rig === 'goldbug' && it.kind === 'diemod') p += 2;        // GOLDBUG: die mods cost $2 more
  if (run.rig === 'botnet' && it.kind === 'perk') p += 1;           // BOTNET: perks cost $1 more
  if (stakeOf(run) >= 6) p += 1;                                     // HONEYNET: shop prices +$1
  return Math.max(1, p);
}

/** snap = a saved shop (from snapshot()) to restore instead of rolling fresh stock. */
function enter(r, cb, saveCb, snap) {
  run = r; onDone = cb; onSave = saveCb || null; t = 0;
  reveal = null; faceFor = null; pack = null; swap = null; dieFor = null; selW = -1;
  if (snap) {
    items = snap.items; packs = snap.packs; rerollCost = snap.rerollCost;
    if (snap.pack) pack = { ...snap.pack, def: PACKS[snap.pack.type], t: 99, shown: snap.pack.items.length, flash: [] };
    if (snap.faceFor) faceFor = run.perks.find(p => p.uid === snap.faceFor) || null;
  } else {
    items = rollItems(2, ['perk', 'patch', 'wild', 'exploit', 'diemod']);
    packs = [rollPackType(), rollPackType()].map(type => ({ type, sold: false }));
    rerollCost = stakeOf(run) >= 6 ? 3 : 2;                          // HONEYNET: rerolls start at $3
  }
  say(G.pick(GREET));
  save();
}

function snapshot() {
  return {
    items, packs, rerollCost, faceFor: faceFor ? faceFor.uid : 0,
    pack: pack ? { type: pack.type, items: pack.items, picks: pack.picks, picked: pack.picked, closeT: -1 } : null,
  };
}
function save() { if (onSave) onSave(snapshot()); }

function say(s) { quote = s; quoteT = 0; typed = 0; SFX.talk(); }

// ------------------------------------------------------------
//  actions
// ------------------------------------------------------------
function broke(i) { say(G.pick(BROKE)); SFX.deny(); shakeSlot = i; shakeT = 0.3; }

const slotsFull = it => it.kind === 'wild' && (run.wilds || []).length >= wildSlots(run);
const hacksFull = it => it.kind === 'exploit' && (run.exploits || []).length >= exploitSlots(run);
function denyHack(i) { say('YOUR HANDS ARE FULL. USE AN EXPLOIT FIRST.'); SFX.deny(); shakeSlot = i; shakeT = 0.3; }
function askSwap(it, done) { swap = { item: it, done }; say('NO ROOM. SELL ONE?'); SFX.deny(); }
function swapSell(k) {
  const w = run.wilds[k];
  if (!w) return;
  run.money += wildSell(w);
  run.wilds.splice(k, 1);
  packWilds(run);
  SFX.coin();
  const done = swap.done;
  swap = null;
  done();
  save();
}

function buy(i) {
  if (i < 2) {
    const it = items[i];
    if (!it) return;
    if (money() < cost(it)) return broke(i);
    if (slotsFull(it)) return askSwap(it, () => buy(i));
    if (hacksFull(it)) return denyHack(i);
    if ((it.kind === 'diemod' || it.kind === 'sticker') && it.target == null) {
      dieFor = { item: it, done: k => { it.target = k; dieFor = null; buy(i); } };
      say('WHICH DIE GETS IT?'); SFX.select();
      return;
    }
    run.money -= cost(it);
    items[i] = null;
    SFX.buy();
    startReveal(it);
    say(it.rarity >= 3 ? G.pick(RARE) : G.pick(BUY));
  } else {
    const p = packs[i - 2];
    if (p.sold) return;
    const def = PACKS[p.type];
    if (money() < def.price) return broke(i);
    run.money -= def.price;
    p.sold = true;
    SFX.buy();
    openPack(p.type);
    save();
  }
}

function reroll() {
  if (money() < rerollCost) return broke(-1);
  run.money -= rerollCost;
  rerollCost++;
  items = rollItems(2, ['perk', 'patch', 'wild', 'exploit', 'diemod']);
  packs = [rollPackType(), rollPackType()].map(type => ({ type, sold: false }));   // packs restock too
  reveal = null;
  SFX.rollStart(); G.glitch(0.1);
  say('NEW STOCK. NEW PACKS. SAME PRICES.');
  save();
}

function leave() { SFX.select(); onDone(); }

function startReveal(it) { reveal = { item: it, t: 0, done: false, doneT: 0 }; SFX.decrypt(); }

function finishReveal() {
  const it = reveal.item;
  applyItem(run, it);
  reveal.done = true; reveal.doneT = 0;
  SFX.rarity(it.rarity);
  if (it.rarity >= 4) { G.flash(0.35); G.shake(3); }
  if (it.rarity === 5) G.glitch(0.5);
  if (it.kind === 'perk' && it.id === 'loaded' && it.stats.choose) faceFor = it;
  save();
}

function chooseFace(f) {
  faceFor.stats.face = f;
  faceFor = null;
  SFX.select();
  save();
}

// ------------------------------------------------------------
//  packs
// ------------------------------------------------------------
function openPack(type) {
  const def = PACKS[type];
  pack = {
    type, def, items: rollItems(def.show, def.pool, def.boost), t: 0, shown: 0, flash: [],
    picks: def.pick, picked: [], closeT: -1,
  };
  reveal = null;
  SFX.packOpen(); G.glitch(0.25); G.shake(2);
}

// ---- die-mod target picker ----
const DPY = 70;
const dieCardX = k => Math.round(RX + (RW - (5 * 40 + 4 * 12)) / 2 + k * 52);
function drawDiePick() {
  const { rect, rrect, text, ctx, T } = G;
  ctx.globalAlpha = 0.95; rect(RX - 3, 20, RW + 6, 181, '#08061a'); ctx.globalAlpha = 1;
  const it = dieFor.item, isSt = it.kind === 'sticker';
  const def = isSt ? STICKER_DEFS[it.id] : DIEMOD_DEFS[it.id];
  text('PICK A DIE', RCX, 24, PAL.white, { align: 'center', scale: 2, outline: PAL.ink });
  text(isSt ? 'SLAP THE ' + def.name + ' ON IT' : 'IT BECOMES A ' + def.name, RCX, 44, PAL.green, { align: 'center' });
  for (let k = 0; k < 5; k++) {
    const x = dieCardX(k), on = hover === k, y = DPY - (on ? 3 : 0);
    const cur = isSt ? dieSticker(run, k) : dieMod(run, k);
    rrect(x - 1, y - 1, 42, 50, on ? PAL.green : PAL.ink);
    rrect(x, y, 40, 48, '#241a4a');
    rect(x + 2, y + 2, 36, 44, '#0b0920');
    // show the die as it is now, and (hovered) as it will be
    const th = !isSt && on ? it.id : (dieMod(run, k) || 'bone');
    ctx.drawImage(DIE[th][6], x + 4, y + 6, 32, 32);
    const st = isSt && on ? it.id : dieSticker(run, k);
    if (st) { rect(x + 27, y + 5, 9, 9, PAL.ink); rect(x + 28, y + 6, 7, 7, STICKER_DEFS[st].col); rect(x + 28, y + 6, 3, 1, '#ffffff'); }
    text('DIE ' + (k + 1), x + 20, y + 40, '#8a7fc0', { align: 'center' });
    const curDef = cur && (isSt ? STICKER_DEFS[cur] : DIEMOD_DEFS[cur]);
    if (cur && cur !== it.id) text(on ? 'REPLACES ' + curDef.code : curDef.code, x + 20, y + 52, on ? PAL.red : '#a99be0', { align: 'center' });
    if (on) drawCorner(x, y, T);
  }
}
function drawCorner(x, y, T) {
  const e = 2 + Math.round(Math.abs(Math.sin(T * 8))), { rect } = G;
  rect(x - e, y - e, 5, 1, PAL.green); rect(x - e, y - e, 1, 5, PAL.green);
  rect(x + 40 + e - 5, y - e, 5, 1, PAL.green); rect(x + 40 + e - 1, y - e, 1, 5, PAL.green);
}

function swapCardX(i) {
  const n = run.wilds.length, gap = 10, total = n * PCW + (n - 1) * gap;
  return Math.round(RX + (RW - total) / 2 + i * (PCW + gap));
}

function drawSwap() {
  const { rect, text, ctx } = G;
  ctx.globalAlpha = 0.95; rect(RX - 3, 20, RW + 6, 181, '#08061a'); ctx.globalAlpha = 1;
  text('SLOTS FULL', RCX, 24, PAL.white, { align: 'center', scale: 2, outline: PAL.ink });
  text('SELL A WILDCARD TO MAKE ROOM FOR ' + itemName(swap.item), RCX, 44, PAL.green, { align: 'center' });
  run.wilds.forEach((w, i) => {
    const x = swapCardX(i), on = hover === i;
    UI.itemCard(w, x, PCY + (on ? -3 : 0), PCW, PCH, { hover: on });
    UI.priceTag(wildSell(w), x + PCW / 2, PCY + PCH + 3, true);
  });
}

function packCardX(i) {
  const n = pack.items.length;
  const gap = Math.min(12, Math.floor((260 - n * PCW) / Math.max(1, n - 1)));
  const total = n * PCW + (n - 1) * gap;
  return Math.round(RX + (RW - total) / 2 + i * (PCW + gap));
}

function pickFromPack(i) {
  if (pack.picks <= 0 || pack.picked.includes(i)) return;
  if (slotsFull(pack.items[i])) return askSwap(pack.items[i], () => pickFromPack(i));
  if (hacksFull(pack.items[i])) return denyHack(-1);
  if ((pack.items[i].kind === 'diemod' || pack.items[i].kind === 'sticker') && pack.items[i].target == null) {
    const it = pack.items[i];
    dieFor = { item: it, done: k => { it.target = k; dieFor = null; pickFromPack(i); } };
    say('WHICH DIE GETS IT?'); SFX.select();
    return;
  }
  pack.picked.push(i);
  pack.picks--;
  startReveal(pack.items[i]);
}

function closePack(skipped) {
  if (skipped && pack.picked.length === 0) { run.money += SKIP_REWARD; SFX.coin(); say('SUIT YOURSELF. HAVE $' + SKIP_REWARD + '.'); }
  pack = null;
  reveal = null;
  save();
}

// ------------------------------------------------------------
//  update
// ------------------------------------------------------------
function update(dt) {
  t += dt; quoteT += dt;
  const n = Math.floor(quoteT * 40);
  if (n > typed && n <= quote.length) { if (n % 3 === 0) SFX.type(); typed = n; }
  if (shakeT > 0) shakeT -= dt;
  if ((nextBlink -= dt) <= 0) { blinkT = 0.12; nextBlink = G.rand(1.8, 4); }
  if (blinkT > 0) blinkT -= dt;

  if (reveal) {
    reveal.t += dt;
    if (!reveal.done && reveal.t >= 0.75) finishReveal();
    if (reveal.done) reveal.doneT += dt;
  }

  if (pack) {
    pack.t += dt;
    const n = pack.items.length;
    while (pack.shown < n && pack.t >= 0.55 + pack.shown * 0.3) {
      const it = pack.items[pack.shown];
      pack.flash[pack.shown] = 1;
      SFX.cardReveal(it.rarity);
      if (it.rarity >= 4) { G.flash(0.2); G.shake(2); }
      if (it.rarity === 5) G.glitch(0.25);
      pack.shown++;
    }
    pack.flash = pack.flash.map(f => Math.max(0, (f || 0) - dt * 3));
    const settled = !reveal || reveal.done;
    if (pack.picks === 0 && settled && !faceFor && pack.closeT < 0) pack.closeT = 1.4;
    if (pack.closeT > 0 && (pack.closeT -= dt) <= 0) closePack(false);
  }

  // ---- hover ----
  const m = G.mouse;
  hover = -1; hoverBtn = -1; hoverW = -1;
  if (selW >= 0 && (pack || swap || dieFor || faceFor || !run.wilds[selW])) selW = -1;
  if (m.inside) {
    btns.forEach((b, i) => { if (UI.hitBox(b, m.x, m.y)) hoverBtn = i; });
    if (hoverBtn < 0) {
      if (dieFor) {
        for (let k = 0; k < 5; k++) { const x = dieCardX(k); if (m.x >= x && m.x < x + 40 && m.y >= DPY - 4 && m.y < DPY + 48) hover = k; }
      } else if (swap) {
        run.wilds.forEach((_, i) => {
          const x = swapCardX(i);
          if (m.x >= x && m.x < x + PCW && m.y >= PCY - 6 && m.y < PCY + PCH) hover = i;
        });
      } else if (pack) {
        if (pack.shown >= pack.items.length)
          pack.items.forEach((_, i) => {
            const x = packCardX(i);
            if (m.x >= x && m.x < x + PCW && m.y >= PCY - 6 && m.y < PCY + PCH) hover = i;
          });
      } else if (!faceFor) {
        run.wilds.forEach((_, i) => { const x = swX(i); if (m.x >= x && m.x < x + SW_W && m.y >= SW_Y - 2 && m.y < SW_Y + SW_H) hoverW = i; });
        SLOTX.forEach((x, i) => {
          const live = i < 2 ? items[i] : !packs[i - 2].sold;
          if (live && m.x >= x && m.x < x + CW && m.y >= CY - 4 && m.y < CY + CH + 14) hover = i;
        });
      }
    }
  }
  if (hover !== prevHover && hover >= 0) SFX.hover();
  if (hoverW !== prevHoverW && hoverW >= 0) SFX.hover();
  prevHoverW = hoverW;
  if (hoverBtn !== prevHoverBtn && btns[hoverBtn] && !btns[hoverBtn].disabled) SFX.hover();
  prevHover = hover; prevHoverBtn = hoverBtn;
}

// ------------------------------------------------------------
//  render
// ------------------------------------------------------------
function drawRoom() {
  const { rrect, rect, ctx, T } = G;
  rrect(RX - 5, 18, RW + 10, 185, PAL.ink);
  const flick = Math.random() < 0.03 ? 0.4 : 1;
  ctx.globalAlpha = (0.55 + Math.sin(T * 2.3) * 0.15) * flick;
  rrect(RX - 4, 19, RW + 8, 183, PAL.magenta);
  ctx.globalAlpha = 1;
  rect(RX - 3, 20, RW + 6, 181, '#0c0820');
  ctx.fillStyle = '#140e2e';
  for (let y = 22; y < 200; y += 6) ctx.fillRect(RX - 3, y, RW + 6, 1);
}

function drawDealer() {
  const { blit, rect, ctx, T } = G;
  const breathe = Math.round(Math.sin(T * 2) * 0.8);
  const hy = DY + breathe * 2;
  blit(MASCOT, DX, hy, 2);
  ctx.globalAlpha = 0.14; rect(DX + 14, hy + 20, 20, 4, PAL.green); ctx.globalAlpha = 1;
  const m = G.mouse;
  const lookX = m.inside ? G.clamp(Math.round((m.x - (DX + 24)) / 60), -1, 1) : 0;
  for (const col of [8, 14]) {
    const ex = DX + (col + lookX) * 2, ey = hy + 16;
    if (hover >= 0 && !pack) G.blit(glyph('$', PAL.gold), ex - 1, ey - 2);
    else if (blinkT > 0) rect(ex, ey + 2, 4, 1, PAL.green);
    else { rect(ex, ey, 4, 4, PAL.green); rect(ex, ey, 2, 2, PAL.mint); }
  }
  blit(LAPTOP, DX, DY + 30, 2);
  rect(DX - 5, DY + 53, 58, 7, PAL.ink);
  rect(DX - 4, DY + 54, 56, 1, '#7a62c0');
  rect(DX - 4, DY + 55, 56, 4, '#3a2a78');
}

// ---- your wildcards, along the top of the shop (hover to read, click to sell / move) ----
const SW_W = 40, SW_H = 28, SW_G = 6, SW_Y = 21;
const swSlotX = s => { const n = wildSlots(run); return Math.round(RCX - (n * SW_W + (n - 1) * SW_G) / 2) + s * (SW_W + SW_G); };
const swX = i => swSlotX(wildSlotsOf(run)[i] ?? i);   // i = index in run.wilds (HOT POTATO may sit past empty slots)
function drawShopWilds() {
  const { rect, rrect, ctx, T } = G;
  const pos = wildSlotsOf(run);
  for (let s = 0; s < wildSlots(run); s++) {   // empty slot outlines
    if (pos.includes(s)) continue;
    const x = swSlotX(s);
    ctx.globalAlpha = 0.45;
    for (let k = 0; k < SW_W; k += 4) { rect(x + k, SW_Y, 2, 1, '#8a3bd4'); rect(x + k, SW_Y + SW_H - 1, 2, 1, '#8a3bd4'); }
    for (let k = 0; k < SW_H; k += 4) { rect(x, SW_Y + k, 1, 2, '#8a3bd4'); rect(x + SW_W - 1, SW_Y + k, 1, 2, '#8a3bd4'); }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < run.wilds.length; i++) {
    const x = swX(i), w = run.wilds[i];
    if (!w) {
      ctx.globalAlpha = 0.45;
      for (let k = 0; k < SW_W; k += 4) { rect(x + k, SW_Y, 2, 1, '#8a3bd4'); rect(x + k, SW_Y + SW_H - 1, 2, 1, '#8a3bd4'); }
      for (let k = 0; k < SW_H; k += 4) { rect(x, SW_Y + k, 1, 2, '#8a3bd4'); rect(x + SW_W - 1, SW_Y + k, 1, 2, '#8a3bd4'); }
      ctx.globalAlpha = 1;
      continue;
    }
    const lift = hoverW === i || selW === i ? 2 : 0, y = SW_Y - lift, col = RARITY.col[w.rarity];
    rrect(x - 1, y - 1, SW_W + 2, SW_H + 2, PAL.ink);
    rrect(x, y, SW_W, SW_H, selW === i ? PAL.white : col);
    rect(x + 1, y + 1, SW_W - 2, SW_H - 2, '#15112c');
    const art = CARD_ART[w.id];
    if (art) ctx.drawImage(art, x + Math.floor((SW_W - art.width) / 2), y + Math.floor((SW_H - art.height) / 2));
    else G.text(WILD_DEFS[w.id].code, x + SW_W / 2, y + 10, col, { align: 'center' });
    if (w.edition) UI.editionFx(w.edition, x, y, SW_W, SW_H);
    if (selW === i) {
      const e = 2 + Math.round(Math.abs(Math.sin(T * 8)));
      rect(x - e, y - e, 5, 1, PAL.green); rect(x - e, y - e, 1, 5, PAL.green);
      rect(x + SW_W + e - 5, y - e, 5, 1, PAL.green); rect(x + SW_W + e - 1, y - e, 1, 5, PAL.green);
      rect(x - e, y + SW_H + e - 1, 5, 1, PAL.green); rect(x + SW_W + e - 5, y + SW_H + e - 1, 5, 1, PAL.green);
    }
  }
}
function sellShopWild() {
  const w = run.wilds[selW];
  if (!w) return;
  run.money += wildSell(w);
  run.wilds.splice(selW, 1);
  packWilds(run);
  selW = -1;
  SFX.coin(); G.glitch(0.1);
  say(G.pick(['PLEASURE DOING BUSINESS.', "I'LL FIND IT A NEW HOME.", 'NO REFUNDS. BUT I BUY.']));
  save();
}
function moveShopWild(dir) {
  const j = selW + dir;
  if (j < 0 || j >= run.wilds.length) return;
  swapWilds(run, selW, j);
  selW = j;
  SFX.select();
  save();
}

function drawShopFloor() {
  const { text, T, rect } = G;
  drawShopWilds();
  text('"' + quote.slice(0, typed) + '"', RCX, 52, PAL.green, { align: 'center' });

  SLOTX.forEach((x, i) => {
    const sh = shakeSlot === i && shakeT > 0 ? Math.round(Math.sin(shakeT * 80) * 2) : 0;
    const on = hover === i;
    const y = CY + (on ? -3 : 0);
    if (i < 2) {
      const it = items[i];
      if (!it) { soldSlot(x); return; }
      UI.itemCard(it, x + sh, y, CW, CH, { hover: on });
      UI.priceTag(cost(it), x + CW / 2, CY + CH + 3, money() >= cost(it));
    } else {
      const p = packs[i - 2];
      if (p.sold) { soldSlot(x); return; }
      const def = PACKS[p.type];
      UI.packArt(def, x + sh, y + Math.round(on ? Math.sin(T * 12) : 0), CW, CH, { hover: on });
      UI.priceTag(def.price, x + CW / 2, CY + CH + 3, money() >= def.price);
    }
  });
}

function soldSlot(x) {
  const { rect, text } = G;
  for (let k = 0; k < CW; k += 4) { rect(x + k, CY, 2, 1, '#2e2260'); rect(x + k, CY + CH - 1, 2, 1, '#2e2260'); }
  for (let k = 0; k < CH; k += 4) { rect(x, CY + k, 1, 2, '#2e2260'); rect(x + CW - 1, CY + k, 1, 2, '#2e2260'); }
  text('SOLD', x + CW / 2, CY + CH / 2 - 3, '#4b3a8c', { align: 'center' });
}

function scrambled(str) {
  const hex = '0123456789ABCDEF';
  return str.replace(/\?\?/g, () => hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)]);
}

function drawInfo() {
  const wk = hoverW >= 0 ? hoverW : selW;
  if (!pack && !swap && !dieFor && !faceFor && wk >= 0 && run.wilds[wk]) {
    const w = run.wilds[wk], col = RARITY.col[w.rarity];
    const tag = (w.edition ? EDITIONS[w.edition].name + ' ' : '') + 'SELLS FOR $' + wildSell(w);
    const lines = wrapText(itemDesc(w), Math.floor((IW - 8) / 6));
    if (selW < 0) lines.push('CLICK TO SELL OR MOVE IT');
    UI.infoBox(IX, IY, IW, IH, itemName(w), col, tag, w.edition ? EDITIONS[w.edition].col : PAL.gold, selW >= 0 ? lines.slice(0, 2) : lines, PAL.white);
    return;
  }
  const hovered = swap ? (hover >= 0 ? run.wilds[hover] : null)
    : pack ? (hover >= 0 ? pack.items[hover] : null) : (hover >= 0 && hover < 2 ? items[hover] : null);
  if (dieFor) {
    const it = dieFor.item, k = hover, isSt = it.kind === 'sticker';
    const D = isSt ? STICKER_DEFS : DIEMOD_DEFS, cur = k >= 0 ? (isSt ? dieSticker(run, k) : dieMod(run, k)) : null;
    const body = D[it.id].desc + (cur && cur !== it.id ? ' REPLACES THE ' + D[cur].name + ' ON DIE ' + (k + 1) + '.' : '');
    UI.infoBox(IX, IY, IW, IH, itemName(it), RARITY.col[it.rarity], '$' + cost(it), PAL.gold, body, PAL.white);
    return;
  }
  if (swap && !hovered) {
    UI.infoBox(IX, IY, IW, IH, itemName(swap.item), RARITY.col[swap.item.rarity], 'INCOMING', PAL.green, itemDesc(swap.item, true, run), PAL.white);
    return;
  }

  if (faceFor) {
    UI.infoBox(IX, IY, IW, IH, 'LOADED: CHOOSE YOUR FACE', RARITY.col[4], '', '', []);
    return;
  }
  if (reveal && (!reveal.done || (reveal.doneT < 3 && !hovered && !(hover >= 2 && !pack)))) {
    const it = reveal.item, col = RARITY.col[it.rarity];
    if (!reveal.done) {
      UI.infoBox(IX, IY, IW, IH, itemName(it), col, 'DECRYPTING...', PAL.green, scrambled(itemDesc(it, true, run)), PAL.mint);
    } else {
      let d = itemDesc(it, true);
      if (it.kind === 'patch') d = `${HANDS[it.key].name} IS NOW LEVEL ${run.levels[it.key]}.` + (it.other ? ` ${HANDS[it.other].name} DROPPED TO LEVEL ${run.levels[it.other]}.` : '');
      UI.infoBox(IX, IY, IW, IH, itemName(it), col, 'INSTALLED', PAL.green, d, PAL.white);
    }
    return;
  }
  if (hovered) {
    const col = RARITY.col[hovered.rarity];
    const d = hovered.revealed
      ? (hovered.kind === 'patch' ? `INSTALLED. ${HANDS[hovered.key].name} IS LEVEL ${run.levels[hovered.key]}.` : itemDesc(hovered, true))
      : itemDesc(hovered, true, run);
    UI.infoBox(IX, IY, IW, IH, itemName(hovered), col, hovered.revealed ? 'INSTALLED' : RARITY.name[hovered.rarity], hovered.revealed ? PAL.green : col, d, PAL.white);
    return;
  }
  if (!pack && hover >= 2) {
    const def = PACKS[packs[hover - 2].type];
    const what = def.pool.length > 1 ? 'PERKS OR PATCHES' : def.pool[0] === 'perk' ? 'PERKS' : 'PATCHES';
    UI.infoBox(IX, IY, IW, IH, def.name, PAL.white, '$' + def.price, PAL.gold,
      `OPEN IT TO SEE ${def.show} ${what}, THEN TAKE ${def.pick}.` + (def.mega ? ' BETTER ODDS OF RARE AND ABOVE.' : ''), PAL.white);
    return;
  }
  if (pack) {
    UI.infoBox(IX, IY, IW, IH, pack.def.name, PAL.white, '', '',
      pack.shown < pack.items.length ? 'DECRYPTING PAYLOAD...' : 'HOVER A CARD TO INSPECT IT. CLICK TO TAKE IT.', PAL.mint);
    return;
  }
  const perks = run.perks.length;
  UI.infoBox(IX, IY, IW, IH, 'THE DEALER', PAL.green, perks + ' PERK' + (perks === 1 ? '' : 'S') + ' // ' + (run.wilds || []).length + '/' + wildSlots(run) + ' WILD', '#8a7fc0',
    'HOVER TO INSPECT. CLICK TO BUY.', '#a99be0');
}

function drawPack() {
  const { rect, text, ctx, clamp, easeOutBack, T } = G;
  ctx.globalAlpha = 0.93; rect(RX - 3, 20, RW + 6, 181, '#08061a'); ctx.globalAlpha = 1;
  const def = pack.def;
  text(def.name, RCX, 24, PAL.white, { align: 'center', scale: 2, outline: PAL.ink });
  const sub = pack.shown < pack.items.length ? 'DECRYPTING PAYLOAD...'
    : pack.picks > 0 ? `TAKE ${pack.picks} // ${pack.items.length} OFFERED` : 'INSTALLED';
  text(sub, RCX, 44, PAL.green, { align: 'center' });

  pack.items.forEach((it, i) => {
    const p = easeOutBack(clamp((pack.t - i * 0.06) / 0.35, 0, 1));
    const x = packCardX(i);
    const picked = pack.picked.includes(i);
    const on = hover === i && pack.picks > 0 && !picked;
    let y = PCY + Math.round((1 - p) * 140) + (on ? -3 : 0) + (picked ? -6 : 0);
    if (pack.picks === 0 && !picked) ctx.globalAlpha = 0.35;
    UI.itemCard(it, x, y, PCW, PCH, { faceDown: i >= pack.shown, hover: on, flash: pack.flash[i] || 0 });
    ctx.globalAlpha = 1;
    if (picked) text('TAKEN', x + PCW / 2, PCY + PCH + 2, PAL.green, { align: 'center' });
  });
}

function buildButtons() {
  btns = [];
  if (dieFor) {
    btns.push({ x: 292, y: 182, w: 84, h: 13, label: 'CANCEL', act: () => { SFX.select(); dieFor = null; say('CHANGED YOUR MIND?'); }, ...UI.BTN.blue });
    return;
  }
  if (swap) {
    btns.push({ x: 292, y: 182, w: 84, h: 13, label: 'CANCEL', act: () => { SFX.select(); swap = null; say('SUIT YOURSELF.'); }, ...UI.BTN.blue });
    return;
  }
  if (faceFor) {
    for (let f = 1; f <= 6; f++)
      btns.push({ face: f, x: IX + 8 + (f - 1) * 30, y: IY + 15, w: 24, h: 18, act: () => chooseFace(f) });
    return;
  }
  if (pack) {
    if (pack.shown >= pack.items.length && pack.picks > 0 && (!reveal || reveal.done)) {
      const label = pack.picked.length ? 'DONE' : 'SKIP +$' + SKIP_REWARD;
      btns.push({ x: 292, y: 182, w: 84, h: 13, label, act: () => { SFX.select(); closePack(true); }, ...UI.BTN.blue });
    }
    return;
  }
  if (selW >= 0 && run.wilds[selW]) {
    const w = run.wilds[selW];
    btns.push({ x: IX + 4, y: IY + IH - 11, w: 52, h: 10, label: '< MOVE', act: () => moveShopWild(-1), ...UI.BTN.blue, disabled: selW === 0 });
    btns.push({ x: IX + 60, y: IY + IH - 11, w: 52, h: 10, label: 'MOVE >', act: () => moveShopWild(1), ...UI.BTN.blue, disabled: selW === run.wilds.length - 1 });
    btns.push({ x: IX + IW - 80, y: IY + IH - 11, w: 76, h: 10, label: 'SELL +$' + wildSell(w), act: sellShopWild, ...UI.BTN.red });
  }
  btns.push({ x: 110, y: 182, w: 84, h: 13, label: 'REROLL $' + rerollCost, act: reroll, ...UI.BTN.blue, disabled: money() < rerollCost });
  btns.push({ x: 292, y: 182, w: 84, h: 13, label: 'JACK OUT >', act: leave, ...UI.BTN.green });
}

function render() {
  drawRoom();
  if (pack) drawPack();
  else { drawDealer(); drawShopFloor(); }
  if (swap) drawSwap();
  if (dieFor) drawDiePick();
  drawInfo();
  buildButtons();
  btns.forEach((b, i) => {
    if (b.face) {
      const on = hoverBtn === i;
      G.rrect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, on ? PAL.green : PAL.ink);
      G.blitC(DIE.bone[b.face], b.x + b.w / 2, b.y + b.h / 2, 1);
    } else UI.button(b, hoverBtn === i);
  });
  G.drawTicker(TICK);
}

// ------------------------------------------------------------
//  input
// ------------------------------------------------------------
function onPointer() {
  const b = btns[hoverBtn];
  if (b) { hoverBtn = -1; if (b.disabled) return broke(-1); return b.act(); }
  if (faceFor) return;
  if (dieFor) { if (hover >= 0) { SFX.buy(); dieFor.done(hover); } return; }
  if (swap) { if (hover >= 0) swapSell(hover); return; }
  if (reveal && !reveal.done) return;
  if (pack) { if (hover >= 0 && pack.shown >= pack.items.length) pickFromPack(hover); return; }
  if (hoverW >= 0) { selW = selW === hoverW ? -1 : hoverW; SFX.select(); return; }
  if (hover >= 0) { selW = -1; buy(hover); return; }
  if (selW >= 0) { selW = -1; SFX.select(); }      // click away = deselect
}
// no keyboard shortcut to leave: mashing space after a breach must not skip the shop
function onKey() {}
// btns is rebuilt every render, so hoverBtn can point past its end for a frame: always look it up safely
const hot = () => hover >= 0 || hoverW >= 0 || (!!btns[hoverBtn] && !btns[hoverBtn].disabled);
const isOpen = () => !!pack;

// ------------------------------------------------------------
//  dev / balance testing: a bot that shops completely at random
// ------------------------------------------------------------
let botActions = 0;
function botStep() {
  if (faceFor) return chooseFace(G.randi(1, 6));
  if (dieFor) return dieFor.done(G.randi(0, 4));
  if (swap) return swapSell(G.randi(0, run.wilds.length - 1));
  if (reveal && !reveal.done) return;
  if (pack) {
    if (pack.shown < pack.items.length || pack.picks <= 0) return;           // still revealing / auto-closing
    const open = pack.items.map((_, i) => i).filter(i => !pack.picked.includes(i) && !hacksFull(pack.items[i]));
    if (!open.length) return closePack(true);
    return pickFromPack(open[Math.floor(Math.random() * open.length)]);
  }
  if (++botActions > 12) { botActions = 0; return leave(); }
  const opts = [];
  items.forEach((it, i) => { if (it && money() >= cost(it) && !hacksFull(it)) opts.push(() => buy(i)); });
  packs.forEach((p, k) => { if (!p.sold && money() >= PACKS[p.type].price) opts.push(() => buy(k + 2)); });
  const r = Math.floor(Math.random() * (opts.length + 1));                   // every option, and leaving, equally likely
  if (r === opts.length) { botActions = 0; return leave(); }
  opts[r]();
}

// ---- balance sim: a "sensible player" shopper (?bot=smart). For every option it plays a few hundred
// simulated rolls with and without the item and buys whatever raises expected score per firewall most per dollar.
// It never fires exploits (so it doesn't buy them) and ignores pure-economy items, so it's a slight underestimate.
let botRerolls = 0, botSell = -1;
const clone = o => JSON.parse(JSON.stringify(o));
function seeded(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Expected score of one firewall's worth of rolls with build r (same random dice for every option compared). */
function botValue(r, fw = 40) {
  const rnd = Math.random; Math.random = seeded(12345);
  let total = 0;
  try {
    const rolls = Math.max(1, rollsPerRound(r));
    for (let f = 0; f < fw; f++) {
      let prevKey = null;
      for (let k = 1; k <= rolls; k++) {
        const w = dieWeights(r);
        const faces = [0, 1, 2, 3, 4].map(i => rollFace(dieWeightsFor(r, i, w)));
        const phantom = wildsOf(r, 'phantom').length || r.rig === 'phantom' ? rollFace(w) : 0;
        const sc = scoreRoll(r, faces, { first: k === 1, last: k === rolls, prevKey, rollsRound: k, scoreBefore: 0, phantom });
        let chips = sc.base.chips, mult = sc.base.mult;
        for (let i = 0; i < 5; i++) {
          const m = dieMod(r, i), v = sc.vals[i];
          if (m === 'stone') chips += 50;
          if (m === 'chrome' && !sc.scoring[i]) mult += 3;
          if (v == null) continue;
          chips += v;
          if (dieSticker(r, i) === 'red') chips += v;
          if (!sc.scoring[i]) continue;
          if (m === 'neon') chips += 15; else if (m === 'glass') mult *= 2; else if (m === 'prism') mult *= 1.5;
          else if (m === 'lucky') mult += 4; else if (m === 'ember') mult += 3;
        }
        for (const st of sc.steps) { if (st.kind === 'chips') chips += st.amt; else if (st.kind === 'mult') mult += st.amt; else mult *= st.amt; }
        total += Math.round(chips * mult);
        prevKey = sc.key;
      }
    }
  } finally { Math.random = rnd; }
  return total / fw;
}
const freeDie = (r, it) => { const arr = it.kind === 'sticker' ? r.dieStickers : r.dieMods; const k = (arr || []).findIndex(x => !x); return k < 0 ? 0 : k; };
/** Value gain of adding item it (best replacement if the wildcard row is full). Returns { gain, sell }. */
function botGain(it, v0) {
  if (it.kind === 'exploit') return { gain: -1, sell: -1 };
  const add = (r, c) => { if (c.kind === 'diemod' || c.kind === 'sticker') c.target = freeDie(r, c); applyItem(r, c); return r; };
  if (it.kind === 'wild' && run.wilds.length >= wildSlots(run)) {
    let best = { gain: -1, sell: -1 };
    run.wilds.forEach((_, j) => { const r = clone(run); r.wilds.splice(j, 1); const g = botValue(add(r, clone(it))) - v0; if (g > best.gain) best = { gain: g, sell: j }; });
    return best;
  }
  return { gain: botValue(add(clone(run), clone(it))) - v0, sell: -1 };
}
function smartStep() {
  if (faceFor) {   // LOADED: pick the face that scores best
    let bf = 6, bv = -1;
    for (let f = 1; f <= 6; f++) { const r = clone(run); r.perks.find(p => p.uid === faceFor.uid).stats.face = f; const v = botValue(r); if (v > bv) { bv = v; bf = f; } }
    return chooseFace(bf);
  }
  if (dieFor) return dieFor.done(freeDie(run, dieFor.item));
  if (swap) { const k = botSell >= 0 ? botSell : 0; botSell = -1; return swapSell(k); }
  if (reveal && !reveal.done) return;
  const v0 = botValue(run);
  if (pack) {
    if (pack.shown < pack.items.length || pack.picks <= 0) return;
    let best = null;
    pack.items.forEach((it, i) => { if (pack.picked.includes(i) || hacksFull(it)) return; const g = botGain(it, v0); if (!best || g.gain > best.gain) best = { ...g, i }; });
    if (!best || best.gain <= v0 * 0.01) return closePack(true);
    botSell = best.sell;
    return pickFromPack(best.i);
  }
  let best = null;
  items.forEach((it, i) => {
    if (!it || money() < cost(it) || hacksFull(it)) return;
    const g = botGain(it, v0), ratio = g.gain / cost(it);
    if (g.gain > v0 * 0.03 && (!best || ratio > best.ratio)) best = { ...g, ratio, i };
  });
  if (best) { botSell = best.sell; return buy(best.i); }
  const pk = packs.findIndex(p => !p.sold && money() >= PACKS[p.type].price);
  if (pk >= 0) return buy(pk + 2);
  if (botRerolls < 3 && money() >= rerollCost + 3) { botRerolls++; return reroll(); }
  botRerolls = 0;
  return leave();
}

/** Tutorial: is the shop mid-action (revealing, pack open, picking a die)? And where things are. */
const busy = () => !!pack || !!dieFor || !!faceFor || !!swap || !!(reveal && !reveal.done);
const ui = {
  slot: i => ({ x: SLOTX[i] - 3, y: CY - 6, w: CW + 6, h: CH + 16 }),
  reroll: { x: 108, y: 180, w: 88, h: 19 }, leave: { x: 290, y: 180, w: 88, h: 19 },
  wilds: () => { const n = wildSlots(run), w = n * SW_W + (n - 1) * SW_G; return { x: Math.round(RCX - w / 2) - 3, y: SW_Y - 3, w: w + 6, h: SW_H + 6 }; },
  packCard: i => [packCardX(i) + PCW / 2, PCY + PCH / 2],   // (test harness)
  dieCard: k => [dieCardX(k) + 20, DPY + 20],
  get picking() { return !!dieFor; },
};

return { enter, update, render, onPointer, onKey, hot, isOpen, debugOpen: openPack, botStep, smartStep, busy, ui };
})();
