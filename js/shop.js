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
const TICK  = '*** BLACK MARKET *** *** PACKS: OPEN, DECRYPT, PICK *** REROLL FOR NEW SOFTWARE *** ';

// ---------- state ----------
let run = null, onDone = null, onSave = null, t = 0;
let items = [], packs = [], rerollCost = 2;
let hover = -1, prevHover = -1, hoverBtn = -1, prevHoverBtn = -1, btns = [];
let quote = '', quoteT = 0, typed = 0;
let reveal = null;          // { item, t, done, doneT }
let faceFor = null;         // LOADED (legendary) waiting for the player to choose a face
let pack = null;            // open pack
let swap = null;            // { item, done } — wildcard slots are full: pick one to sell first
let shakeSlot = -1, shakeT = 0, blinkT = 0, nextBlink = 2;

const money = () => run.money;

/** snap = a saved shop (from snapshot()) to restore instead of rolling fresh stock. */
function enter(r, cb, saveCb, snap) {
  run = r; onDone = cb; onSave = saveCb || null; t = 0;
  reveal = null; faceFor = null; pack = null; swap = null;
  if (snap) {
    items = snap.items; packs = snap.packs; rerollCost = snap.rerollCost;
    if (snap.pack) pack = { ...snap.pack, def: PACKS[snap.pack.type], t: 99, shown: snap.pack.items.length, flash: [] };
    if (snap.faceFor) faceFor = run.perks.find(p => p.uid === snap.faceFor) || null;
  } else {
    items = rollItems(2, ['perk', 'patch', 'wild']);
    packs = [rollPackType(), rollPackType()].map(type => ({ type, sold: false }));
    rerollCost = 2;
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

const slotsFull = it => it.kind === 'wild' && (run.wilds || []).length >= WILD_SLOTS;
function askSwap(it, done) { swap = { item: it, done }; say('NO ROOM. SELL ONE?'); SFX.deny(); }
function swapSell(k) {
  const w = run.wilds[k];
  if (!w) return;
  run.money += wildSell(w);
  run.wilds.splice(k, 1);
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
    if (money() < itemPrice(it)) return broke(i);
    if (slotsFull(it)) return askSwap(it, () => buy(i));
    run.money -= itemPrice(it);
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
  items = rollItems(2, ['perk', 'patch', 'wild']);
  reveal = null;
  SFX.rollStart(); G.glitch(0.1);
  say('NEW STOCK. SAME PRICES.');
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
  hover = -1; hoverBtn = -1;
  if (m.inside) {
    btns.forEach((b, i) => { if (UI.hitBox(b, m.x, m.y)) hoverBtn = i; });
    if (hoverBtn < 0) {
      if (swap) {
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
        SLOTX.forEach((x, i) => {
          const live = i < 2 ? items[i] : !packs[i - 2].sold;
          if (live && m.x >= x && m.x < x + CW && m.y >= CY - 4 && m.y < CY + CH + 14) hover = i;
        });
      }
    }
  }
  if (hover !== prevHover && hover >= 0) SFX.hover();
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

function drawShopFloor() {
  const { text, T, rect } = G;
  const flick = Math.random() < 0.04;
  text('BLACK MARKET', RCX, 23, flick ? '#6b1f63' : PAL.magenta, { align: 'center', scale: 2, shadow: PAL.ink });
  text('"' + quote.slice(0, typed) + '"', RCX, 40, PAL.green, { align: 'center' });

  text('SOFTWARE', (SLOTX[0] + SLOTX[1] + CW) / 2, 50, '#8a7fc0', { align: 'center' });
  text('PACKS', (SLOTX[2] + SLOTX[3] + CW) / 2, 50, '#8a7fc0', { align: 'center' });

  SLOTX.forEach((x, i) => {
    const sh = shakeSlot === i && shakeT > 0 ? Math.round(Math.sin(shakeT * 80) * 2) : 0;
    const on = hover === i;
    const y = CY + (on ? -3 : 0);
    if (i < 2) {
      const it = items[i];
      if (!it) { soldSlot(x); return; }
      UI.itemCard(it, x + sh, y, CW, CH, { hover: on });
      UI.priceTag(itemPrice(it), x + CW / 2, CY + CH + 3, money() >= itemPrice(it));
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
  const hovered = swap ? (hover >= 0 ? run.wilds[hover] : null)
    : pack ? (hover >= 0 ? pack.items[hover] : null) : (hover >= 0 && hover < 2 ? items[hover] : null);
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
  UI.infoBox(IX, IY, IW, IH, 'THE DEALER', PAL.green, perks + ' PERK' + (perks === 1 ? '' : 'S') + ' // ' + (run.wilds || []).length + '/' + WILD_SLOTS + ' WILD', '#8a7fc0',
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
  btns.push({ x: 110, y: 182, w: 84, h: 13, label: 'REROLL $' + rerollCost, act: reroll, ...UI.BTN.blue, disabled: money() < rerollCost });
  btns.push({ x: 292, y: 182, w: 84, h: 13, label: 'JACK OUT >', act: leave, ...UI.BTN.green });
}

function render() {
  drawRoom();
  if (pack) drawPack();
  else { drawDealer(); drawShopFloor(); }
  if (swap) drawSwap();
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
  if (swap) { if (hover >= 0) swapSell(hover); return; }
  if (reveal && !reveal.done) return;
  if (pack) { if (hover >= 0 && pack.shown >= pack.items.length) pickFromPack(hover); return; }
  if (hover >= 0) buy(hover);
}
// no keyboard shortcut to leave: mashing space after a breach must not skip the shop
function onKey() {}
// btns is rebuilt every render, so hoverBtn can point past its end for a frame: always look it up safely
const hot = () => hover >= 0 || (!!btns[hoverBtn] && !btns[hoverBtn].disabled);
const isOpen = () => !!pack;

return { enter, update, render, onPointer, onKey, hot, isOpen, debugOpen: openPack };
})();
