// ============================================================
//  DOKER — pixel art sprites
//  Everything here is drawn pixel-by-pixel into small offscreen
//  canvases, then scaled up with nearest-neighbour sampling.
// ============================================================
const PAL = {
  ink: '#0a0818', white: '#f4f4f4', grey: '#b8b8c8', shade: '#d6d6e4',
  red: '#e43b44', dred: '#9e2835', orange: '#f77622', gold: '#feae34', yellow: '#fee761',
  green: '#4dff88', mgreen: '#1e8c4f', dgreen: '#0f4d2b', mint: '#b6ffcc',
  cyan: '#2ce8f5', blue: '#3b5dc9', purple: '#5a43a0', dpurple: '#2e2260', magenta: '#ff3df2',
};

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** Build a sprite from rows of characters + a palette map. '.' = transparent. */
function makeSprite(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const [c, g] = newCanvas(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const col = pal[rows[y][x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  return c;
}

/** Draw only the left half of a symmetric sprite, mirror it for the right half. */
function mirrorRows(half) {
  return half.map(r => r + [...r].reverse().join(''));
}

/** Silhouette of a sprite in one solid color (cached). */
function tinted(img, color) {
  img._tints = img._tints || {};
  if (img._tints[color]) return img._tints[color];
  const [c, g] = newCanvas(img.width, img.height);
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return (img._tints[color] = c);
}

function gRRect(g, x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

// ------------------------------------------------------------
//  DICE (16x16)
// ------------------------------------------------------------
const PIP_POS = { L: 3, M: 7, R: 11 };
const FACES = {
  1: [['M','M']],
  2: [['L','L'],['R','R']],
  3: [['L','L'],['M','M'],['R','R']],
  4: [['L','L'],['R','L'],['L','R'],['R','R']],
  5: [['L','L'],['R','L'],['M','M'],['L','R'],['R','R']],
  6: [['L','L'],['R','L'],['L','M'],['R','M'],['L','R'],['R','R']],
};
const DIE_THEMES = {
  bone: { body: '#f4f4f4', hi: '#ffffff', shade: '#b8b8c8', pip: '#e43b44', pipD: '#9e2835', out: PAL.ink },
  hack: { body: '#15122b', hi: '#2b2650', shade: '#0a0818', pip: '#4dff88', pipD: '#1e8c4f', out: '#4dff88' },
};

function makeDie(face, th) {
  const S = 16;
  const [c, g] = newCanvas(S, S);
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
      const corner = (x === 0 || x === S - 1) && (y === 0 || y === S - 1);
      const inCorner = (x === 1 || x === S - 2) && (y === 1 || y === S - 2);
      if (corner) continue;
      if (edge || inCorner) { px(x, y, th.out); continue; }
      let col = th.body;
      if (x === S - 2 || y === S - 2) col = th.shade;
      else if (x === 1 || y === 1) col = th.hi;
      px(x, y, col);
    }
  for (const [cx, cy] of FACES[face]) {
    const x = PIP_POS[cx], y = PIP_POS[cy];
    px(x, y, th.pip); px(x + 1, y, th.pip); px(x, y + 1, th.pip); px(x + 1, y + 1, th.pipD);
  }
  return c;
}

const DIE = { bone: [], hack: [] };
for (let f = 1; f <= 6; f++) {
  DIE.bone[f] = makeDie(f, DIE_THEMES.bone);
  DIE.hack[f] = makeDie(f, DIE_THEMES.hack);
}

// ------------------------------------------------------------
//  LOGO — chunky 9x11 letters with outline + 3px extrusion
// ------------------------------------------------------------
const LOGO_BITMAPS = {
  D: ['#######..','########.','##....###','##.....##','##.....##','##.....##','##.....##','##.....##','##....###','########.','#######..'],
  K: ['##....###','##...###.','##..###..','##.###...','#####....','####.....','#####....','##.###...','##..###..','##...###.','##....###'],
  E: ['#########','#########','##.......','##.......','#######..','#######..','##.......','##.......','##.......','#########','#########'],
  R: ['#######..','########.','##....###','##.....##','##....###','########.','#######..','##..###..','##...###.','##....###','##.....##'],
};
const LOGO_RAMP = ['#ffffff','#fff4c2','#fee761','#feae34','#feae34','#f77622','#f77622','#e43b44','#e43b44','#b02a3a','#b02a3a'];

function buildLogoGlyph(w, h, colorAt, extrude) {
  const E = extrude.length;
  const [c, g] = newCanvas(w + 2, h + 2 + E);
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && colorAt(x, y) != null;
  const mask = new Set();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (filled(x, y)) for (let d = 0; d <= E; d++) mask.add(x + ',' + (y + d));
  // outline around letter + extrusion
  g.fillStyle = PAL.ink;
  for (const k of mask) {
    const [x, y] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (!mask.has((x + dx) + ',' + (y + dy))) g.fillRect(x + dx + 1, y + dy + 1, 1, 1);
  }
  // extrusion (deepest first)
  for (let d = E; d >= 1; d--) {
    g.fillStyle = extrude[d - 1];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (filled(x, y)) g.fillRect(x + 1, y + 1 + d, 1, 1);
  }
  // face
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const col = colorAt(x, y);
      if (col) { g.fillStyle = col; g.fillRect(x + 1, y + 1, 1, 1); }
    }
  return c;
}

const LOGO_GLYPH = {};
for (const ch in LOGO_BITMAPS) {
  const bm = LOGO_BITMAPS[ch];
  LOGO_GLYPH[ch] = buildLogoGlyph(9, 11, (x, y) => {
    if (bm[y][x] !== '#') return null;
    if (y === 0 || bm[y - 1][x] !== '#') return '#ffffff'; // top-edge highlight
    return LOGO_RAMP[y];
  }, ['#7a1f3d', '#5a1530', '#3b1030']);
}

// The "O" in DOKER is a hacked neon die. Face 0 = glitched "?" face.
const LOGO_PIP = { L: 3, M: 5, R: 7 };
const LOGO_DIE = [];
for (let f = 0; f <= 6; f++) {
  const pips = new Set();
  const shadows = new Set();
  if (f === 0) {
    const q = FONT['?'];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (q[y][x] === '1') pips.add((x + 3) + ',' + (y + 2));
  } else {
    for (const [cx, cy] of FACES[f]) {
      pips.add(LOGO_PIP[cx] + ',' + LOGO_PIP[cy]);
      shadows.add(LOGO_PIP[cx] + ',' + (LOGO_PIP[cy] + 1));
    }
  }
  LOGO_DIE[f] = buildLogoGlyph(11, 11, (x, y) => {
    const corner = (x === 0 || x === 10) && (y === 0 || y === 10);
    if (corner) return null;
    const ring = x === 0 || y === 0 || x === 10 || y === 10;
    const inCorner = (x === 1 || x === 9) && (y === 1 || y === 9);
    if (ring || inCorner) return PAL.green;
    if (pips.has(x + ',' + y)) return f === 0 ? PAL.gold : PAL.mint;
    if (shadows.has(x + ',' + y)) return PAL.mgreen;
    if (x === 1 || y === 1) return '#262046';
    return '#15122b';
  }, ['#1e8c4f', '#0f4d2b', '#0a2a1a']);
}

// ------------------------------------------------------------
//  CARDS (24x32)
// ------------------------------------------------------------
const SUIT_BIG = {
  H: ['.##.##.','#######','#######','#######','.#####.','..###..','...#...'],
  D: ['...#...','..###..','.#####.','#######','.#####.','..###..','...#...'],
  S: ['...#...','..###..','.#####.','#######','#######','...#...','..###..'],
  C: ['..###..','..###..','#######','#######','##.#.##','...#...','..###..'],
};

function makeCard(rank, suit) {
  const w = 24, h = 32;
  const [c, g] = newCanvas(w, h);
  gRRect(g, 0, 0, w, h, PAL.ink);
  gRRect(g, 1, 1, w - 2, h - 2, PAL.white);
  g.fillStyle = PAL.shade;
  g.fillRect(2, h - 2, w - 4, 1);
  g.fillRect(w - 2, 2, 1, h - 4);
  const col = (suit === 'H' || suit === 'D') ? PAL.red : '#1a1530';
  for (let i = 0; i < rank.length; i++) g.drawImage(glyph(rank[i], col), 2 + i * 6, 2);
  const rw = rank.length * 6 - 1;
  for (let i = 0; i < rank.length; i++) g.drawImage(glyph(rank[i], col), w - 2 - rw + i * 6, h - 9);
  const bm = SUIT_BIG[suit];
  g.fillStyle = col;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++)
      if (bm[y][x] === '#') g.fillRect(5 + x * 2, 9 + y * 2, 2, 2);
  return c;
}

function makeGlitchCard() {
  const w = 24, h = 32;
  const [c, g] = newCanvas(w, h);
  gRRect(g, 0, 0, w, h, PAL.ink);
  gRRect(g, 1, 1, w - 2, h - 2, PAL.green);
  gRRect(g, 2, 2, w - 4, h - 4, '#0d1a14');
  // scanline texture
  g.fillStyle = '#12261c';
  for (let y = 3; y < h - 3; y += 2) g.fillRect(2, y, w - 4, 1);
  // corrupted pixels (fixed seed so it looks the same each load)
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = PAL.mgreen;
  for (let i = 0; i < 18; i++) g.fillRect(3 + Math.floor(rnd() * 18), 3 + Math.floor(rnd() * 26), 1, 1);
  g.drawImage(glyph('?', PAL.green), 3, 3);
  g.drawImage(glyph('?', PAL.green), w - 8, h - 10);
  g.drawImage(LOGO_DIE[5], 5, 8);
  return c;
}

function makeCardBack() {
  const w = 24, h = 32;
  const [c, g] = newCanvas(w, h);
  gRRect(g, 0, 0, w, h, PAL.ink);
  gRRect(g, 1, 1, w - 2, h - 2, PAL.white);
  gRRect(g, 2, 2, w - 4, h - 4, PAL.dpurple);
  g.fillStyle = '#4b3a8c';
  for (let y = 3; y < h - 3; y++)
    for (let x = 3; x < w - 3; x++)
      if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) g.fillRect(x, y, 1, 1);
  // tiny neon die emblem
  gRRect(g, 7, 11, 10, 10, PAL.ink);
  gRRect(g, 8, 12, 8, 8, PAL.green);
  gRRect(g, 9, 13, 6, 6, '#15122b');
  g.fillStyle = PAL.mint;
  g.fillRect(10, 14, 1, 1); g.fillRect(12, 16, 1, 1); g.fillRect(13, 17, 1, 1);
  g.fillRect(11, 15, 1, 1); g.fillRect(13, 14, 1, 1); g.fillRect(10, 17, 1, 1);
  return c;
}

const CARD_AS = makeCard('A', 'S');
const CARD_KH = makeCard('K', 'H');
const CARD_7D = makeCard('7', 'D');
const CARD_GLITCH = makeGlitchCard();
const CARD_BACK = makeCardBack();

// ------------------------------------------------------------
//  POKER CHIPS (11x11)
// ------------------------------------------------------------
function makeChip(col, dark) {
  const S = 11;
  const [c, g] = newCanvas(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x - 5, dy = y - 5, d = Math.hypot(dx, dy);
      let pc = null;
      if (d > 5.4) continue;
      else if (d > 4.5) pc = PAL.ink;
      else if (d > 3.2) {
        const seg = Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4));
        pc = seg % 2 ? col : PAL.white;
      } else if (d > 2.3) pc = dark;
      else pc = col;
      g.fillStyle = pc; g.fillRect(x, y, 1, 1);
    }
  return c;
}
const CHIP_IMGS = [
  makeChip('#e43b44', '#9e2835'),
  makeChip('#3b5dc9', '#1f2f6b'),
  makeChip('#1e8c4f', '#0f4d2b'),
  makeChip('#feae34', '#b86f1a'),
];

// ------------------------------------------------------------
//  THE DEALER — hooded hacker mascot (24x26, eyes drawn live)
// ------------------------------------------------------------
const MASCOT_HALF = [
  '........kkkk',
  '......kkHHHH',
  '.....kHHHHHH',
  '....kHHHhhhh',
  '...kHHhhkkkk',
  '...kHhhkffff',
  '..kHHhkfffff',
  '..kHhhkfffff',
  '..kHhkffffff',
  '..kHhkffffff',
  '..kHhkffffff',
  '..kHhhkfffff',
  '..kHhhkkffff',
  '.kHHhhhhkkkk',
  '.kHhhhhhhdhh',
  'kHHhhhhhhdhh',
  'kHhhhhhhhdhh',
  'kHhhhhhhhhhh',
  'kHhhhhhhhhhh',
  'kHhhhhhhhhhh',
  'kHhhhhhhhhhh',
  'kHhhhhhhhhhh',
  'kHhhhhhhhhhh',
  'kHhhhhhhhhhh',
  'kHhhhhhhhhhh',
  'kkkkkkkkkkkk',
];
const MASCOT = makeSprite(mirrorRows(MASCOT_HALF), {
  k: PAL.ink, H: '#5a43a0', h: '#3a2a78', f: '#05040c', d: '#c9c2ff',
});

function makeLaptop() {
  const [c, g] = newCanvas(24, 12);
  const P = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y <= 9; y++)
    for (let x = 2; x <= 21; x++) {
      let col = '#6b7090';
      if (x === 2 || x === 21 || y === 0) col = PAL.ink;
      else if (y === 9) col = '#3a3d52';
      else if (x === 3 || y === 1) col = '#a3a8c3';
      else if (x === 20) col = '#4a4e66';
      P(x, y, col);
    }
  for (let x = 0; x <= 23; x++) { P(x, 10, x === 0 || x === 23 ? PAL.ink : '#4a4e66'); P(x, 11, PAL.ink); }
  // red die sticker
  const st = ['kkkkkkk','krrrrrk','krwrrrk','krrwrrk','krrrwrk','krrrrrk','kkkkkkk'];
  st.forEach((r, y) => [...r].forEach((ch, x) => P(6 + x, 2 + y, { k: PAL.ink, r: PAL.red, w: PAL.white }[ch])));
  // green "x" sticker
  [[0,0],[2,0],[1,1],[0,2],[2,2]].forEach(([x, y]) => P(15 + x, 5 + y, PAL.green));
  return c;
}
const LAPTOP = makeLaptop();

// ------------------------------------------------------------
//  CURSOR
// ------------------------------------------------------------
const CURSOR_ROWS = [
  'k.......',
  'kk......',
  'kwk.....',
  'kwwk....',
  'kwwwk...',
  'kwwwwk..',
  'kwwwwwk.',
  'kwwwwwwk',
  'kwwkkkkk',
  'kwk.....',
  'kk......',
  'k.......',
];
const CURSOR = makeSprite(CURSOR_ROWS, { k: PAL.ink, w: PAL.white });
const CURSOR_HOT = makeSprite(CURSOR_ROWS, { k: PAL.ink, w: PAL.green });
