// ============================================================
//  DOKER — VERSUS: online matches through Cotchu rooms (https://cotchu.com)
//
//  Everyone plays their own run; the room only carries the match setup and
//  where each player is. A scene inside menu.js (state 'lobby': the lobby and
//  the results board) plus the player tabs along the bottom of the table.
//
//  Room state:
//    match             { host, rig, stake, n, started, roster, names, bosses, houseRules, ice }
//    players.<id>      { name, st, round, money, n }      st: lobby | play | boss | shop | dead | won
//    results.<n>.<id>  { name, round, money, won, out }   written once that player's run ends
//                      (kept apart from players.<id>, which the room deletes when someone leaves)
//
//  Who wins: rooting the system beats not rooting it; then the furthest
//  firewall; then the most money. The SDK loads only when you open a versus
//  lobby, so solo play never touches the network.
// ============================================================
const NET = (() => {
const SDK_URL = 'https://cdn.jsdelivr.net/npm/cotchu@0.1.0/dist/cotchu.min.js';
const KEY = 'pk_live_3aoxj868o1hr_P9CyO3gOx2rVDH8SqWVMEAZWc0yMhWQx';   // publishable key: made to ship in game code
const SEATS = 4;
const NAME_MAX = 8;
const HANDLES = ['ZEROCOOL', 'ACIDBURN', 'CEREAL', 'PHREAK', 'NULLBYTE', 'GLITCH', 'BITROT', 'SYNACK',
  'DAEMON', 'CIPHER', 'HEXDUMP', 'PACKET', 'SUDO', 'ROOTKIT', 'LOOPBACK', 'OVERFLOW'];
const ERRORS = {
  bad_origin: 'THIS WEBSITE IS NOT ALLOWED ON THE MATCH SERVER.',
  room_full: 'THAT MATCH IS FULL (' + SEATS + ' PLAYERS).',
  room_limit: 'TOO MANY MATCHES OPEN. TRY AGAIN SOON.',
  balance_empty: 'THE MATCH SERVER IS OUT OF CREDIT.',
  unreachable: 'CANNOT REACH THE MATCH SERVER. CHECK THE WIFI.',
  bad_key: 'THE MATCH SERVER KEY IS NOT VALID.',
  replaced: 'THIS MATCH WAS OPENED IN ANOTHER TAB.',
  room_closed: 'THE MATCH CLOSED.',
  sdk: 'COULD NOT LOAD THE MATCH CODE. CHECK THE WIFI.',
  nomatch: 'NO MATCH HERE. ASK FOR A NEW LINK.',
};

let sdk = null;              // promise of the cotchu module (loaded on first use)
let room = null;
let phase = 'idle';          // idle | connecting | lobby | error
let err = '';
let roomName = '';
let launched = -1;           // match.n this client has already started (or chose not to)
const known = {};            // id -> last players.<id> seen, so someone who drops still shows on the board
let snapT = 0, lastSnap = '', lastStatus = {};
let toasts = [];
let t = 0, copiedT = 0, copyMsg = '';
let btns = [], hoverB = -1, prevHoverB = -1, sel = 0, kb = false;
let editing = false, draft = '';

// ---------- helpers ----------
const clean = s => String(s || '').toUpperCase().replace(/[^A-Z0-9_.-]/g, '').slice(0, NAME_MAX);
function handle() {
  if (!clean(SET.handle)) { SET.handle = HANDLES[Math.floor(Math.random() * HANDLES.length)]; saveSettings(); }
  return clean(SET.handle);
}
const randId = n => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
const S = () => (room ? room.state : {});
const match = () => S().match || null;
const me = () => (room ? room.me.id : '');
const online = id => !!room && room.players.some(p => p.id === id);
function hostId() {
  const m = match();
  if (!m || !room) return '';
  if (online(m.host)) return m.host;
  return room.players.map(p => p.id).sort()[0] || '';     // the host left: the lowest id takes over (everyone agrees)
}
const isHost = () => !!room && hostId() === me();
function link() {
  const base = location.href.split(/[?#]/)[0];
  return base + '?room=' + roomName;
}
function setUrl(q) { try { history.replaceState(null, '', location.pathname + q); } catch (e) { /* file:// may refuse */ } }

function loadSdk() {
  if (!sdk) sdk = import(SDK_URL).then(m => m.cotchu).catch(e => { sdk = null; throw Object.assign(new Error('sdk'), { code: 'sdk' }); });
  return sdk;
}

// ---------- joining ----------
/** Host a new match with this rig + stake (from the rig picker). */
function host(rig, stake) { connect('doker-' + randId(8), { rig, stake }); }
/** Join a match from a shared link (?room=...). */
function joinRoom(name) { connect(String(name).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 64), null); }

async function connect(name, hostCfg) {
  leave(true);
  roomName = name; phase = 'connecting'; err = ''; editing = false; t = 0;
  toasts = []; lastStatus = {}; lastSnap = '';
  for (const k in known) delete known[k];
  setUrl('?room=' + name);
  let r;
  try {
    const cotchu = await loadSdk();
    r = await cotchu.join(name, { key: KEY, name: handle(), seats: SEATS, type: 'shared' });
  } catch (e) { return fail(e); }
  if (roomName !== name) { r.leave(); return; }        // left (or switched rooms) while connecting
  room = r;
  r.on('error', e => { if (e.fatal && room === r) fail(e); });
  r.on('status', s => { if (s === 'closed' && room === r) fail({ code: 'room_closed' }); });
  r.on('state', st => { if (room === r) onState(st); });
  if (hostCfg && !match()) room.set('match', { host: me(), rig: hostCfg.rig, stake: hostCfg.stake, n: 0, started: false });
  const m = match();
  if (!m) { fail({ code: 'nomatch' }); return; }      // an old link: don't hold the empty room open
  phase = 'lobby';
  launched = m.n;
  // back after a reload, mid-run: pick the run back up
  const mine = (S().players || {})[me()];
  const res = ((S().results || {})[m.n] || {})[me()];
  if (m.started && (m.roster || []).includes(me()) && !res && mine && PLAY.hasVersusSave(name, m.n)) {
    PLAY.queueContinue('versus');
    G.goTo('play', true);
    return;
  }
  report(true);
}

function fail(e) {
  const code = (e && e.code) || 'unreachable';
  err = ERRORS[code] || 'CONNECTION FAILED: ' + String(code).toUpperCase();
  phase = 'error';
  const r = room; room = null;
  if (r) { try { r.leave(); } catch (_) { /* already closed */ } }
}

/** Leave the room for good (frees the seat). quiet = switching rooms, keep the URL.
 *  delay gives queued writes (a forfeit) a moment to reach the room first. */
function leave(quiet, delay = 0) {
  const r = room;
  room = null; phase = 'idle'; roomName = ''; editing = false;
  if (!quiet) setUrl('');
  if (r) {
    const go = () => { try { r.leave(); } catch (e) { /* already closed */ } };
    if (delay) setTimeout(go, delay); else go();
  }
}

/** ESC mid-run: give up. Counts as knocked out where you stand. */
function forfeit() {
  const r = PLAY.run, m = match();
  if (room && r && r.versus && m && r.versus.n === m.n) {
    room.set(['results', String(m.n), me()], { name: handle(), round: r.round, money: r.money, won: false, out: true });
  }
  leave(false, 1200);
}

// ---------- reacting to the room ----------
function onState(state) {
  const m = state.match;
  for (const id in state.players || {}) known[id] = state.players[id];
  if (!m) return;
  // the host pressed START: everyone on the roster starts their run with the same bosses
  if (m.started && m.n > launched && (m.roster || []).includes(me())) {
    launched = m.n;
    lastSnap = '';
    PLAY.startVersus({ room: roomName, n: m.n, rig: m.rig, stake: m.stake, bosses: m.bosses, houseRules: m.houseRules, ice: m.ice });
    G.goTo('play', true);
  }
}

/** Where am I? Sent to the room a few times a second, only when it changes. */
function snapshot() {
  const r = PLAY.run, m = match();
  if (!m) return null;
  const inRun = r && r.versus && r.versus.room === roomName && r.versus.n === m.n && m.started;
  if (!inRun) return { name: handle(), st: 'lobby', round: 0, money: 0, n: m.n };
  const md = PLAY.mode;
  const st = md === 'failed' ? 'dead' : md === 'won' ? 'won' : md === 'shop' ? 'shop' : r.boss ? 'boss' : 'play';
  return { name: handle(), st, round: r.round, money: r.money, n: m.n };
}
function report(force) {
  if (!room || phase !== 'lobby') return;
  const s = snapshot();
  if (!s) return;
  const j = JSON.stringify(s);
  if (j !== lastSnap || force) { lastSnap = j; room.set('players.me', s); }
  // the run is over: post the result where it outlives the seat
  if (s.st === 'dead' || s.st === 'won') {
    const res = ((S().results || {})[s.n] || {})[me()];
    if (!res) room.set(['results', String(s.n), me()], { name: s.name, round: s.round, money: s.money, won: s.st === 'won' });
  }
}

/** Everyone on this match's roster, best first: rooted > furthest firewall > most money. */
function standings() {
  const m = match();
  if (!m || !m.started) return [];
  const res = (S().results || {})[m.n] || {};
  const players = S().players || {};
  return (m.roster || []).map(id => {
    const r = res[id], live = players[id] && players[id].n === m.n ? players[id] : null, last = known[id];
    const name = clean((r && r.name) || (live && live.name) || (m.names && m.names[id]) || (last && last.name)) || 'PLAYER';
    let st, round, money;
    if (r) { st = r.won ? 'won' : r.out ? 'quit' : 'dead'; round = r.round; money = r.money; }
    else if (live) { st = online(id) ? live.st : 'offline'; round = live.round; money = live.money; }
    else { st = 'left'; round = last && last.n === m.n ? last.round : 0; money = last && last.n === m.n ? last.money : 0; }
    const done = st === 'won' || st === 'dead' || st === 'quit' || st === 'left';
    return { id, name, st, round: round || 0, money: money || 0, done, you: id === me() };
  }).sort((a, b) => ((b.st === 'won') - (a.st === 'won')) || (b.round - a.round) || (b.money - a.money));
}
const matchOver = s => s.length > 0 && s.every(p => p.done);

function toast(txt, col) { toasts.push({ txt, col, life: 4 }); if (toasts.length > 3) toasts.shift(); }
function watchOthers() {
  for (const p of standings()) {
    const was = lastStatus[p.id];
    lastStatus[p.id] = p.st;
    if (p.you || !was || was === p.st) continue;
    if (p.st === 'dead') { toast(p.name + ' WAS DENIED AT FIREWALL ' + p.round, PAL.red); SFX.deny(); }
    else if (p.st === 'won') { toast(p.name + ' ROOTED THE SYSTEM: $' + p.money, PAL.magenta); SFX.select(); }
    else if (p.st === 'quit' || p.st === 'left') toast(p.name + ' LEFT THE MATCH', '#8a7fc0');
    else if (p.st === 'boss' && was !== 'boss') toast(p.name + ' IS FIGHTING A BOSS', PAL.orange);
  }
}

/** Every frame, whatever the scene: keep the room posted. */
function tick(dt) {
  t += dt;
  if (copiedT > 0) copiedT -= dt;
  toasts.forEach(q => (q.life -= dt));
  toasts = toasts.filter(q => q.life > 0);
  if (!room || phase !== 'lobby') return;
  if ((snapT -= dt) > 0) return;
  snapT = 0.25;
  report(false);
  watchOthers();
}

// Navigating away can park the page in the back/forward cache with its socket still open, so the
// others would see you "playing" forever. Close the socket (without leaving) when the page hides:
// the room marks you offline, a reload resumes the seat from the SDK's saved token, and coming
// back with the back button reconnects on its own. (room.ws is the SDK's socket; pinned to 0.1.0.)
addEventListener('pagehide', () => {
  const ws = room && room.ws;
  if (ws) { try { ws.close(); } catch (e) { /* already closing */ } }
});

// ---------- host actions ----------
function startMatch() {
  const m = match();
  if (!isHost() || !m || m.started) return;
  const roster = room.players.map(p => p.id);
  if (roster.length < 2) { SFX.deny(); return; }
  const names = {};
  for (const id of roster) names[id] = clean(((S().players || {})[id] || {}).name || (room.players.find(p => p.id === id) || {}).name) || 'PLAYER';
  // same bosses (and ICE) for everyone; dice and shops stay each player's own luck
  const bosses = rollBosses(m.stake);
  const houseRules = rollHouseRules(bosses, m.stake >= 2 && KNOBS.greyHat === 'house3' ? 3 : 2);
  const ice = {};
  for (let r = 2; r <= RULES.ROUNDS; r++) ice[r] = _pick(ICE_IDS);
  room.set('match', { ...m, host: me(), n: m.n + 1, started: true, roster, names, bosses, houseRules, ice });
  SFX.select(); G.shake(3);
}
function rematch() {
  const m = match();
  if (!isHost() || !m || !matchOver(standings())) return;
  room.set('match', { host: me(), rig: m.rig, stake: m.stake, n: m.n, started: false });
  SFX.select();
}

// ---------- copy the link ----------
function copyLink() {
  const url = link();
  const ok = () => { copiedT = 2.5; copyMsg = 'COPIED! SEND IT TO A FRIEND.'; SFX.select(); };
  const no = () => { copiedT = 4; copyMsg = 'COPY IT FROM THE ADDRESS BAR INSTEAD.'; SFX.deny(); };
  const legacy = () => {
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch (e) { /* not allowed */ }
    ta.remove();
    return done;
  };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(ok, () => (legacy() ? ok() : no()));
  else if (legacy()) ok(); else no();
}

// ---------- renaming ----------
function startRename() { editing = true; draft = handle(); SFX.select(); }
function commitRename() {
  const v = clean(draft);
  editing = false;
  if (!v) { SFX.deny(); return; }
  SET.handle = v; saveSettings(); SFX.select();
  lastSnap = ''; report(true);
}

// ============================================================
//  LOBBY SCENE (menu.js state 'lobby')
// ============================================================
const PX = 28, PY = 4, PW = 328, PH = 198;
const CXL = PX + PW / 2;

function exit() { leave(); SFX.select(); G.goTo('menu'); }
function backToMenu() { SFX.select(); G.goTo('menu'); }

function update(dt) {
  const m = G.mouse;
  hoverB = -1;
  if (m.inside) btns.forEach((b, i) => { if (UI.hitBox(b, m.x, m.y)) hoverB = i; });
  if (hoverB >= 0) { kb = false; sel = hoverB; }
  if (hoverB !== prevHoverB && hoverB >= 0) SFX.hover();
  prevHoverB = hoverB;
}

function statusWord(p) {
  return { play: 'FIREWALL ' + p.round, boss: 'BOSS FIGHT ' + p.round, shop: 'BLACK MARKET ' + p.round, dead: 'DENIED AT ' + p.round,
    won: 'ROOTED', quit: 'QUIT AT ' + p.round, left: p.round ? 'LEFT AT ' + p.round : 'LEFT', offline: 'OFFLINE', lobby: 'IN LOBBY' }[p.st] || p.st.toUpperCase();
}
const ST_COL = { play: PAL.green, boss: PAL.orange, shop: PAL.gold, dead: PAL.red, won: PAL.magenta, quit: '#8a7fc0', left: '#8a7fc0', offline: '#5a5478', lobby: PAL.cyan };

function render() {
  const { text, rect, ctx } = G;
  btns = [];
  UI.panel(PX, PY, PW, PH, phase === 'error' ? PAL.red : PAL.magenta);
  const m = match();

  if (phase === 'connecting' || phase === 'idle') {
    text('VERSUS', CXL, PY + 8, PAL.magenta, { align: 'center', scale: 2, shadow: PAL.ink });
    text('CONNECTING' + '...'.slice(0, Math.floor(t * 3) % 4), CXL, PY + 90, PAL.white, { align: 'center' });
    btns.push({ x: CXL - 40, y: PY + PH - 22, w: 80, h: 14, label: 'CANCEL', act: exit, ...UI.BTN.blue });
  } else if (phase === 'error') {
    text('NO SIGNAL', CXL, PY + 8, PAL.red, { align: 'center', scale: 2, shadow: PAL.ink });
    wrapText(err, 46).forEach((l, k) => text(l, CXL, PY + 80 + k * 10, PAL.white, { align: 'center' }));
    btns.push({ x: CXL - 40, y: PY + PH - 22, w: 80, h: 14, label: 'MENU', act: exit, ...UI.BTN.blue });
  } else if (m && m.started) drawResults(m);
  else drawLobby(m);

  if (kb && btns[sel]) sel = Math.min(sel, btns.length - 1);
  btns.forEach((b, i) => UI.button(b, (kb ? sel : hoverB) === i && !b.disabled));
  if (room && room.status === 'reconnecting') text('RECONNECTING...', CXL, PY + PH - 34, PAL.gold, { align: 'center' });
}

function drawLobby(m) {
  const { text, rect } = G;
  const st = STAKES[m.stake - 1];
  text('VERSUS LOBBY', CXL, PY + 6, PAL.magenta, { align: 'center', scale: 2, shadow: PAL.ink });
  text(RIG[m.rig || 'stock'].name + ' RIG // STAKE ' + m.stake + ': ' + st.name, CXL, PY + 24, st.col, { align: 'center' });
  text('SAME BOSSES FOR EVERYONE. YOUR OWN LUCK.', CXL, PY + 34, '#c9c3ea', { align: 'center' });
  text('ROOT THE SYSTEM WITH THE MOST $ TO WIN.', CXL, PY + 43, '#c9c3ea', { align: 'center' });
  text('IF NOBODY ROOTS IT, FURTHEST FIREWALL WINS.', CXL, PY + 52, '#8a7fc0', { align: 'center' });

  // share link
  text('SHARE THIS LINK:', PX + 10, PY + 66, PAL.gold);
  const shown = link().replace(/^https?:\/\//, '');
  const bx = PX + 8, bw = PW - 16;
  rect(bx, PY + 76, bw, 13, PAL.ink);
  rect(bx, PY + 76, bw, 1, '#2e2260');
  let s = shown;
  while (textWidth(s) > bw - 8 && s.length > 8) s = '...' + s.slice(4);
  text(s, bx + 4, PY + 79, PAL.cyan);
  btns.push({ x: PX + PW - 88, y: PY + 63, w: 80, h: 11, label: 'COPY LINK', act: copyLink, ...UI.BTN.purple });
  if (copiedT > 0) text(copyMsg, CXL, PY + 93, copyMsg.startsWith('COPIED') ? PAL.green : PAL.gold, { align: 'center' });

  // who's here
  const ps = room.players;
  text('PLAYERS ' + ps.length + '/' + SEATS, PX + 10, PY + 106, '#8a7fc0');
  const hid = hostId();
  ps.forEach((p, k) => {
    const y = PY + 117 + k * 11;
    const info = (S().players || {})[p.id] || {};
    const you = p.id === me();
    const nm = you && editing ? draft : clean(info.name || p.name);
    rect(PX + 12, y + 1, 5, 5, you ? PAL.green : PAL.cyan);
    text(nm + (you && editing && Math.floor(t * 3) % 2 ? '_' : ''), PX + 22, y, you ? PAL.white : '#c9c3ea');
    const tags = (p.id === hid ? 'HOST' : '') + (you ? (p.id === hid ? ' / ' : '') + 'YOU' : '');
    if (tags) text(tags, PX + 22 + textWidth('W'.repeat(NAME_MAX)) + 10, y, '#6b5fa8');
    if (you && !editing) btns.push({ x: PX + PW - 70, y: y - 2, w: 60, h: 10, label: 'RENAME', act: startRename, ...UI.BTN.blue });
    if (you && editing) btns.push({ x: PX + PW - 70, y: y - 2, w: 60, h: 10, label: 'SAVE', act: commitRename, ...UI.BTN.green });
  });

  const host = isHost(), enough = ps.length >= 2;
  const msg = editing ? 'TYPE A NAME, THEN ENTER' : !enough ? 'WAITING FOR A FRIEND TO OPEN THE LINK...' : host ? 'EVERYONE IN? PRESS START.' : 'WAITING FOR THE HOST TO START...';
  if (Math.floor(t * 2) % 2 === 0 || enough) text(msg, CXL, PY + PH - 36, enough ? PAL.green : PAL.gold, { align: 'center' });
  if (host) btns.push({ x: CXL - 94, y: PY + PH - 22, w: 90, h: 14, label: 'START >', act: startMatch, ...UI.BTN.green, disabled: !enough || editing });
  btns.push({ x: host ? CXL + 4 : CXL - 45, y: PY + PH - 22, w: 90, h: 14, label: 'LEAVE', act: exit, ...UI.BTN.red });
}

function drawResults(m) {
  const { text, rect } = G;
  const rows = standings(), over = matchOver(rows);
  const inIt = (m.roster || []).includes(me());
  text(over ? 'MATCH OVER' : 'MATCH IN PROGRESS', CXL, PY + 6, over ? PAL.magenta : PAL.cyan, { align: 'center', scale: 2, shadow: PAL.ink });
  const st = STAKES[m.stake - 1];
  text(RIG[m.rig || 'stock'].name + ' RIG // STAKE ' + m.stake + ': ' + st.name, CXL, PY + 24, st.col, { align: 'center' });
  if (!inIt) text('YOU JOINED MID-MATCH. YOU PLAY THE NEXT ONE.', CXL, PY + 34, PAL.gold, { align: 'center' });

  const y0 = PY + 48;
  text('#', PX + 12, y0, '#6b5fa8'); text('PLAYER', PX + 26, y0, '#6b5fa8'); text('WHERE', PX + 136, y0, '#6b5fa8');
  text('CREDITS', PX + PW - 12, y0, '#6b5fa8', { align: 'right' });
  rect(PX + 10, y0 + 9, PW - 20, 1, '#2e2260');
  rows.forEach((p, k) => {
    const y = y0 + 14 + k * 12;
    const lead = over && k === 0;
    if (lead) { G.ctx.globalAlpha = 0.25; rect(PX + 8, y - 2, PW - 16, 11, PAL.magenta); G.ctx.globalAlpha = 1; }
    text(String(k + 1), PX + 12, y, lead ? PAL.gold : '#8a7fc0');
    text(p.name + (p.you ? ' (YOU)' : ''), PX + 26, y, p.done && p.st !== 'won' ? '#8a84a8' : PAL.white);
    text(statusWord(p), PX + 136, y, ST_COL[p.st] || PAL.white);
    text('$' + p.money, PX + PW - 12, y, PAL.gold, { align: 'right' });
  });

  const by = y0 + 14 + rows.length * 12 + 8;
  if (over && rows.length) {
    const tie = rows.length > 1 && rows[0].st === rows[1].st && rows[0].round === rows[1].round && rows[0].money === rows[1].money;
    const w = rows[0];
    const head = tie ? 'IT IS A TIE!' : w.you ? 'YOU WIN THE MATCH!' : w.name + ' WINS THE MATCH';
    text(head, CXL, by, tie ? PAL.gold : w.you ? PAL.green : PAL.magenta, { align: 'center', scale: 2, outline: PAL.ink, wave: 1, t: G.T });
    const why = w.st === 'won' ? (rows.filter(p => p.st === 'won').length > 1 ? 'ROOTED IT WITH THE MOST CREDITS' : 'THE ONLY ONE TO ROOT THE SYSTEM')
      : 'NOBODY ROOTED IT: GOT THE FURTHEST';
    if (!tie) text(why, CXL, by + 18, '#c9c3ea', { align: 'center' });
  } else {
    const wait = rows.filter(p => !p.done).map(p => p.name);
    if (wait.length) text('WAITING ON ' + wait.join(', ') + '...', CXL, by, PAL.gold, { align: 'center' });
    const mine = rows.find(p => p.you);
    const need = !mine || !mine.done ? 'THE NEXT MATCH STARTS WHEN THE HOST PRESSES REMATCH.'
      : mine.st === 'won' ? 'TO BEAT YOU THEY MUST ROOT IT WITH OVER $' + mine.money + '.'
      : 'TO BEAT YOU THEY MUST GET PAST FIREWALL ' + mine.round + '.';
    text(need, CXL, by + 10, '#8a7fc0', { align: 'center' });
  }
  if (isHost() && over) btns.push({ x: CXL - 94, y: PY + PH - 22, w: 90, h: 14, label: 'REMATCH', act: rematch, ...UI.BTN.green });
  btns.push({ x: isHost() && over ? CXL + 4 : CXL - 45, y: PY + PH - 22, w: 90, h: 14, label: 'LEAVE', act: exit, ...UI.BTN.red });
  if (over && !isHost()) text('THE HOST CAN START A REMATCH', CXL, PY + PH - 34, '#6b5fa8', { align: 'center' });
}

function onPointer() {
  const b = btns[hoverB];
  if (!b) { if (editing) commitRename(); return; }
  if (b.disabled) { SFX.deny(); return; }
  b.act();
}
function onKey(key) {
  const k = key.toLowerCase();
  if (editing) {
    if (k === 'enter') commitRename();
    else if (k === 'escape') { editing = false; SFX.select(); }
    else if (k === 'backspace') draft = draft.slice(0, -1);
    else if (/^[a-z0-9_.-]$/.test(k) && draft.length < NAME_MAX) { draft += k.toUpperCase(); SFX.hover(); }
    return true;
  }
  if (k === 'escape') { exit(); return true; }          // not backspace: too easy to hit while meaning to rename
  if (k === 'arrowleft' || k === 'arrowup' || k === 'a' || k === 'w') { kb = true; sel = (sel + btns.length - 1) % Math.max(1, btns.length); SFX.hover(); return true; }
  if (k === 'arrowright' || k === 'arrowdown' || k === 'd' || k === 's' || k === 'tab') { kb = true; sel = (sel + 1) % Math.max(1, btns.length); SFX.hover(); return true; }
  if (k === 'enter' || k === ' ') { kb = true; const b = btns[sel]; if (b) { if (b.disabled) SFX.deny(); else b.act(); } return true; }
  return false;
}
const typing = () => editing;
const hot = () => hoverB >= 0 && !!btns[hoverB] && !btns[hoverB].disabled;

// ============================================================
//  PLAYER TABS (bottom strip of the table and the black market)
// ============================================================
function drawTabs() {
  const r = PLAY.run;
  if (!r || !r.versus) return false;
  const { rect, rrect, text, ctx } = G;
  rect(0, 205, G.W, 11, PAL.ink); rect(0, 205, G.W, 1, PAL.purple);
  if (!room || r.versus.room !== roomName) {
    text(phase === 'connecting' ? 'RECONNECTING TO THE MATCH...' : 'MATCH CONNECTION LOST: YOUR RUN STILL COUNTS HERE', G.W / 2, 207, '#8a7fc0', { align: 'center' });
    return true;
  }
  const others = standings().filter(p => !p.you);
  if (!others.length) { text('WAITING FOR THE OTHER PLAYERS...', G.W / 2, 207, '#8a7fc0', { align: 'center' }); return true; }
  const gap = 4, w = Math.min(186, Math.floor((G.W - 8 - gap * (others.length - 1)) / others.length));
  let x = Math.round((G.W - (others.length * w + (others.length - 1) * gap)) / 2);
  for (const p of others) {
    const col = ST_COL[p.st] || PAL.white;
    const dead = p.st === 'dead' || p.st === 'quit' || p.st === 'left';
    rrect(x, 206, w, 10, dead ? '#2a0610' : p.st === 'won' ? '#3a0a3a' : '#1a1438');
    rect(x, 206, w, 1, col);
    // status light: pulses during a boss fight
    const on = p.st !== 'boss' || Math.floor(G.T * 4) % 2 === 0;
    if (on) rect(x + 3, 208, 5, 5, col);
    if (dead) { rect(x + 3, 210, 5, 1, PAL.ink); }
    const where = { play: 'FW' + p.round + '/' + RULES.ROUNDS, boss: 'BOSS ' + p.round, shop: 'SHOP ' + p.round, dead: 'OUT ' + p.round,
      won: 'ROOTED', quit: 'QUIT ' + p.round, left: 'LEFT', offline: 'OFFLINE', lobby: 'LOBBY' }[p.st] || '';
    const cash = '$' + p.money;
    const room_ = w - 12 - textWidth(where) - textWidth(cash) - 12;
    let nm = p.name;
    while (nm.length > 1 && textWidth(nm) > room_) nm = nm.slice(0, -1);
    text(nm, x + 11, 208, dead ? '#8a84a8' : PAL.white);
    text(where, x + 11 + textWidth(nm) + 6, 208, col);
    text(cash, x + w - 3, 208, PAL.gold, { align: 'right' });
    x += w + gap;
  }
  // news about the others, just above the strip
  toasts.forEach((q, i) => {
    const y = 194 - (toasts.length - 1 - i) * 11;
    const a = Math.min(1, q.life * 2);
    ctx.globalAlpha = a;
    const tw = textWidth(q.txt) + 10;
    rect(G.W / 2 - tw / 2, y - 2, tw, 11, PAL.ink);
    rect(G.W / 2 - tw / 2, y - 2, tw, 1, q.col);
    text(q.txt, G.W / 2, y, q.col, { align: 'center' });
    ctx.globalAlpha = 1;
  });
  return true;
}

return {
  host, joinRoom, leave, forfeit, tick, update, render, onPointer, onKey, typing, hot, drawTabs,
  get active() { return !!room || phase === 'connecting'; },
  get dbg() { return { phase, err, roomName, state: room && room.state, players: room && room.players, me: room && room.me, standings: standings(), status: room && room.status }; },
};
})();
