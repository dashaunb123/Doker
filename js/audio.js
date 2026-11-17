// ============================================================
//  DOKER — tiny synth: chiptune sound effects + music (no files)
// ============================================================
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const SFX = {
  ac: null, out: null, muted: false, _nb: null,

  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.out = this.ac.createGain();
    this.out.gain.value = 0.35;
    this.out.connect(this.ac.destination);
    // one shared second of white noise, sliced for every noise hit
    this._nb = this.ac.createBuffer(1, this.ac.sampleRate, this.ac.sampleRate);
    const d = this._nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  },

  get ok() { return !!this.ac && !this.muted; },

  tone(f, dur, o = {}) {
    if (!this.ok) return;
    // a bad pitch (NaN/undefined) makes Web Audio throw "Failed to execute ... non-finite": just skip the note
    if (!Number.isFinite(f) || !Number.isFinite(dur) || (o.to !== undefined && !Number.isFinite(o.to))) return;
    const t0 = this.ac.currentTime + (o.delay || 0);
    const osc = this.ac.createOscillator(), g = this.ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(o.vol ?? 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(o.dest || this.out);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  },

  noise(dur, o = {}) {
    if (!this.ok) return;
    const t0 = this.ac.currentTime + (o.delay || 0);
    const src = this.ac.createBufferSource(); src.buffer = this._nb;
    const f = this.ac.createBiquadFilter(); f.type = o.ftype || 'highpass'; f.frequency.value = o.freq || 1000;
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t0 + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(o.dest || this.out);
    src.start(t0, Math.random() * 0.5, dur + 0.05);
  },

  // ---- UI ----
  hover()  { this.tone(1320, 0.04, { vol: 0.06 }); },
  select() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.09, { delay: i * 0.045, vol: 0.1 })); },
  deny()   { this.tone(220, 0.22, { type: 'sawtooth', to: 70, vol: 0.12 }); },
  tick()   { this.noise(0.02, { vol: 0.08, freq: 3000 }); },
  dice()   { this.noise(0.05, { vol: 0.18, freq: 1500 }); this.tone(180 + Math.random() * 80, 0.04, { vol: 0.06 }); },
  land(i = 0) { this.tone(220 + i * 55, 0.08, { to: 110 + i * 30, vol: 0.12 }); this.noise(0.04, { vol: 0.1, freq: 600 }); },
  flip()   { this.noise(0.06, { vol: 0.12, freq: 2500, ftype: 'bandpass' }); },
  talk()   { for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 400, 0.05, { delay: i * 0.07, vol: 0.05 }); },
  type()   { this.tone(1600 + Math.random() * 600, 0.015, { vol: 0.03 }); },
  glitch() { this.noise(0.18, { vol: 0.1, freq: 400 }); this.tone(60, 0.18, { type: 'sawtooth', to: 600, vol: 0.06 }); },
  boot()   { [262, 392, 523, 784, 1047].forEach((f, i) => this.tone(f, 0.14, { delay: i * 0.06, vol: 0.1, type: 'triangle' })); this.glitch(); },
  combo(n) { for (let i = 0; i < n + 2; i++) this.tone(523 * Math.pow(1.26, i), 0.1, { delay: i * 0.06, vol: 0.1 }); },
  whoosh() { this.noise(0.35, { vol: 0.12, freq: 300, fto: 6000, ftype: 'bandpass' }); },

  // ---- table / dice ----
  rollStart() {
    this.noise(0.15, { vol: 0.12, freq: 800, fto: 4000, ftype: 'bandpass' });
    this.tone(200, 0.15, { type: 'sawtooth', to: 900, vol: 0.05 });
  },
  launch(i) {
    this.tone(180 + i * 40, 0.2, { type: 'triangle', to: 900 + i * 120, vol: 0.12 });
    this.noise(0.12, { vol: 0.07, freq: 1200, fto: 5000, ftype: 'bandpass' });
  },
  flipTick(k) { this.tone(700 + k * 70, 0.025, { vol: 0.05 }); this.noise(0.015, { vol: 0.05, freq: 4000 }); },
  slam(i) {
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
    i = (((i | 0) % notes.length) + notes.length) % notes.length;
    this.tone(150, 0.2, { type: 'sine', to: 42, vol: 0.45 });                       // thump
    this.noise(0.08, { vol: 0.22, freq: 900, ftype: 'lowpass' });                    // wood crack
    this.noise(0.03, { vol: 0.1, freq: 5000 });                                      // click
    this.tone(notes[i], 0.28, { type: 'square', vol: 0.07, delay: 0.01 });          // rising note per die
    this.tone(notes[i] * 2, 0.14, { type: 'triangle', vol: 0.05, delay: 0.03 });
  },
  // ---- black market / packs ----
  buy()     { this.tone(1319, 0.05, { vol: 0.08 }); this.tone(1760, 0.08, { vol: 0.08, delay: 0.05 }); this.noise(0.05, { vol: 0.06, freq: 4000 }); },
  decrypt() { for (let i = 0; i < 10; i++) this.tone(400 + Math.random() * 1600, 0.03, { delay: i * 0.065, vol: 0.04 }); },
  packOpen() {
    this.noise(0.4, { vol: 0.14, freq: 200, fto: 7000, ftype: 'bandpass' });
    this.tone(110, 0.35, { type: 'sawtooth', to: 440, vol: 0.06 });
    this.tone(1760, 0.08, { vol: 0.05, delay: 0.3 });
  },
  cardReveal(r) {
    const base = [660, 740, 880, 988, 1175, 220][r];
    this.noise(0.03, { vol: 0.06, freq: 3000 });
    this.tone(base, 0.08, { vol: 0.07, type: r === 5 ? 'sawtooth' : 'square' });
    if (r >= 2) this.tone(base * 1.5, 0.1, { vol: 0.06, delay: 0.05 });
    if (r >= 3) this.tone(base * 2, 0.14, { vol: 0.06, delay: 0.1, type: 'triangle' });
    if (r === 5) this.glitch();
  },
  rarity(r) {
    const run = [[784], [784, 988], [784, 988, 1175], [784, 988, 1175, 1568], [523, 784, 1047, 1319, 1568, 2093], [220, 208, 196, 330, 311]][r];
    run.forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.07, vol: 0.09, type: r === 5 ? 'sawtooth' : 'square' }));
    if (r >= 4) this.whoosh();
    if (r === 5) this.glitch();
  },

  // ---- scoring ----
  multAdd() { this.tone(523, 0.06, { vol: 0.08, type: 'sawtooth' }); this.tone(784, 0.1, { vol: 0.07, delay: 0.05 }); },
  xmult() {
    this.tone(110, 0.25, { type: 'sine', to: 50, vol: 0.35 });
    this.tone(392, 0.08, { vol: 0.08, type: 'sawtooth' });
    this.tone(784, 0.18, { vol: 0.08, delay: 0.06, type: 'sawtooth', to: 1175 });
    this.noise(0.08, { vol: 0.08, freq: 2500 });
  },
  chip(i) { this.tone(660 * Math.pow(1.122, i), 0.06, { type: 'square', vol: 0.07 }); this.noise(0.02, { vol: 0.05, freq: 5000 }); },
  multHit(power) {
    const p = Math.min(1, power);
    this.tone(90, 0.3, { type: 'sine', to: 35, vol: 0.4 });
    this.noise(0.12, { vol: 0.15 + p * 0.1, freq: 600, ftype: 'lowpass' });
    this.tone(330 + p * 330, 0.25, { type: 'sawtooth', to: 880 + p * 880, vol: 0.06 });
  },
  coin() { this.tone(988, 0.06, { vol: 0.08 }); this.tone(1319, 0.14, { vol: 0.08, delay: 0.06 }); },
  breach() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.14, { delay: i * 0.08, vol: 0.1 }));
    this.tone(262, 0.7, { type: 'triangle', delay: 0.1, vol: 0.15 });
    this.whoosh();
  },
  fail() {
    [392, 349, 311, 262, 196].forEach((f, i) => this.tone(f, 0.22, { type: 'sawtooth', delay: i * 0.16, vol: 0.07 }));
    this.tone(80, 0.9, { type: 'sine', to: 30, delay: 0.3, vol: 0.3 });
    this.glitch();
  },
  hand(tier) {
    if (tier === 0) { [392, 370, 349, 262].forEach((f, i) => this.tone(f, 0.18, { type: 'sawtooth', delay: i * 0.14, vol: 0.06 })); return; }
    const scale = [523, 659, 784, 1047, 1319, 1568, 2093];
    for (let i = 0; i < tier + 2; i++) this.tone(scale[i % 7] * (i >= 7 ? 2 : 1), 0.12, { delay: i * 0.065, vol: 0.09 });
    this.tone(scale[Math.min(tier, 6)] / 2, 0.5, { type: 'triangle', delay: (tier + 1) * 0.065, vol: 0.12 });
    if (tier >= 5) this.whoosh();
    if (tier === 7) this.glitch();
  },
};

// ============================================================
//  MUSIC — a lookahead step sequencer playing procedural chiptune
// ============================================================
const _ = null;
const MUSIC = {
  song: null, name: null, step: 0, next: 0, loop: 0, timer: null, gain: null, enabled: true,

  SONGS: {
    // moody hacker lo-fi for the menu (A minor)
    menu: {
      bpm: 92,
      chords: [[57, 60, 64, 69], [53, 57, 60, 65], [50, 53, 57, 62], [52, 56, 59, 64]],
      kick: [0, 7, 10], snare: [4, 12],
      hat: [0.03, 0.01, 0.03, 0.01, 0.03, 0.01, 0.03, 0.015, 0.03, 0.01, 0.03, 0.01, 0.03, 0.01, 0.03, 0.02],
      bass: [0, _, _, 0, _, _, 12, _, 0, _, _, 7, _, _, 12, _],
      arp: [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 0, 3, 2, 1, _], arpOct: 1, arpVol: 0.03,
      lead: null,
    },
    // driving table theme (E minor)
    table: {
      bpm: 124,
      chords: [[52, 55, 59, 64], [48, 52, 55, 60], [55, 59, 62, 67], [50, 54, 57, 62]],
      kick: [0, 4, 8, 12], snare: [4, 12],
      hat: [0.02, 0.012, 0.04, 0.012, 0.02, 0.012, 0.04, 0.012, 0.02, 0.012, 0.04, 0.012, 0.02, 0.012, 0.04, 0.02],
      bass: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 0, 12, 0, 12],
      arp: [0, 1, 2, 3], arpOct: 1, arpVol: 0.022,
      lead: [
        [76, _, _, 79, _, _, 81, _, 83, _, 81, _, 79, _, 76, _],
        [72, _, _, 76, _, _, 79, _, 76, _, _, _, 74, _, 72, _],
        [79, _, _, 83, _, _, 86, _, 83, _, 79, _, 81, _, 79, _],
        [74, _, _, 78, _, _, 81, _, 78, _, 74, _, 71, _, 74, _],
      ],
    },

    // PHISHER / THE ANGLER — slinky, sneaky lounge bait (D dorian, 96 bpm, swung feel)
    boss_phisher: {
      bpm: 96,
      chords: [[50, 53, 57, 60], [55, 59, 62, 65], [50, 53, 57, 60], [52, 55, 59, 62]],
      kick: [0, 7, 10], snare: [4, 12], snareVol: 0.1,
      hat: [0.02, 0, 0.01, 0.015, 0.02, 0, 0.01, 0.015, 0.02, 0, 0.01, 0.015, 0.02, 0, 0.01, 0.02],
      perc: [3, 11], percHz: 6000, percVol: 0.04,
      bass: [0, _, 7, _, 10, _, 12, _, 0, _, 7, _, 5, _, 3, _], bassType: 'triangle', bassVol: 0.24, bassLen: 1.2,
      arp: [0, _, 2, _, 3, _, 2, _], arpOct: 1, arpType: 'triangle', arpVol: 0.025,
      leadAlways: true, leadType: 'square', leadVol: 0.035, leadLen: 1.6, leadBend: 1,
      lead: [
        [74, _, _, 77, _, 76, 74, _, 72, _, _, _, 69, _, _, _],
        [74, _, _, 77, _, 79, 81, _, 79, _, 77, _, 74, _, _, _],
        [77, _, 76, _, 74, _, 72, _, 74, _, _, 69, _, _, _, _],
        [71, _, _, 74, _, 76, _, 77, 76, _, 74, _, 71, _, _, _],
      ],
    },
    // 2FA / THE GATEKEEPER — rigid, mechanical, a beeping code-check (A minor, 120 bpm)
    boss_twofa: {
      bpm: 120,
      chords: [[57, 60, 64, 69], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]],
      kick: [0, 4, 8, 12], snare: [4, 12], snareVol: 0.12,
      hat: [0.025, 0, 0.025, 0, 0.025, 0, 0.025, 0, 0.025, 0, 0.025, 0, 0.025, 0, 0.025, 0],
      perc: [2, 6, 10, 14], percHz: 2200, percVol: 0.07,
      bass: [0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 12, _, 0, _], bassType: 'square', bassVol: 0.08, bassLen: 0.8,
      arp: [3, _, 3, _, 2, _, 2, _], arpOct: 2, arpVol: 0.025,
      leadAlways: true, leadType: 'square', leadVol: 0.04, leadLen: 0.8,
      lead: [
        [81, 81, _, _, 81, 81, _, _, 84, _, 81, _, _, _, _, _],
        [81, 81, _, _, 81, 81, _, _, 79, _, 76, _, _, _, _, _],
        [77, 77, _, _, 77, 77, _, _, 81, _, 77, _, _, _, _, _],
        [79, 79, _, _, 79, 79, _, _, 83, _, 86, _, 83, _, _, _],
      ],
    },
    // KERNEL PANIC / SEGFAULT — frantic, stuttering, tempo-crashing (F# minor, 164 bpm)
    boss_kernelpanic: {
      bpm: 164,
      chords: [[54, 57, 61, 66], [55, 58, 62, 67], [54, 57, 61, 66], [49, 52, 56, 61]],
      kick: [0, 3, 6, 8, 11, 14], snare: [4, 12, 13], snareVol: 0.16,
      hat: [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03],
      perc: [5, 9, 15], percHz: 900, percVol: 0.12,
      bass: [0, 0, 0, 12, 0, 0, 1, 0, 0, 0, 0, 12, 0, 1, 0, 13], bassType: 'sawtooth', bassVol: 0.1, bassLen: 0.7,
      arp: [0, 3, 1, 2, 0, 3, 2, 1], arpOct: 2, arpVol: 0.025,
      leadAlways: true, leadType: 'sawtooth', leadVol: 0.03, leadLen: 0.7,
      lead: [
        [78, 78, 78, _, 81, _, 78, 78, 85, _, 78, _, 90, 89, 88, 87],
        [79, 79, 79, _, 82, _, 79, 79, 86, _, 79, _, 91, 90, 89, 88],
        [78, _, 81, _, 85, _, 90, _, 85, _, 81, _, 78, 78, 78, 78],
        [73, 73, _, 76, _, 80, _, 85, 84, 83, 82, 81, 80, 79, 78, 77],
      ],
    },
    // TROJAN / THE GIFT — a jaunty music-box present that turns menacing (C major -> minor, 104 bpm)
    boss_trojan: {
      bpm: 104,
      chords: [[48, 52, 55, 60], [53, 57, 60, 65], [48, 51, 55, 60], [55, 58, 62, 67]],
      kick: [0, 8, 11], snare: [4, 12], snareVol: 0.11,
      hat: [0.02, 0, 0.015, 0, 0.02, 0, 0.015, 0, 0.02, 0, 0.015, 0, 0.02, 0, 0.015, 0.015],
      perc: [6, 14], percHz: 1500, percVol: 0.08,
      bass: [0, _, 7, _, 0, _, 7, _, 0, _, 7, _, 0, _, 6, _], bassType: 'triangle', bassVol: 0.22, bassLen: 1,
      arp: [0, 1, 2, 3, 2, 1], arpOct: 2, arpType: 'triangle', arpVol: 0.025,
      leadAlways: true, leadType: 'triangle', leadVol: 0.07, leadLen: 1.4,
      lead: [
        [84, _, 79, _, 76, _, 79, _, 84, _, 86, _, 88, _, _, _],
        [89, _, 84, _, 81, _, 84, _, 89, _, 88, _, 86, _, _, _],
        [84, _, 79, _, 75, _, 79, _, 84, _, 82, _, 80, _, _, _],
        [79, _, 74, _, 70, _, 74, _, 79, _, 78, _, 74, _, _, _],
      ],
    },
    // BLACKOUT / LIGHTS OUT — near-silent, a heartbeat in the dark (E minor, 64 bpm)
    boss_blackout: {
      bpm: 64,
      chords: [[40, 43, 47, 52], [41, 45, 48, 53], [40, 43, 47, 52], [39, 43, 46, 51]],
      kick: [0, 2], snare: [], snareVol: 0.05,
      hat: [0, 0, 0, 0, 0, 0, 0, 0.01, 0, 0, 0, 0, 0, 0, 0, 0.01],
      bass: [0, _, _, _, _, _, _, _, 0, _, _, _, _, _, _, _], bassType: 'sine', bassVol: 0.3, bassLen: 6,
      arp: [_, _, _, _, 3, _, _, _, _, _, _, _, 2, _, _, _], arpOct: 2, arpType: 'triangle', arpVol: 0.03,
      leadType: 'sine', leadVol: 0.06, leadLen: 4, leadBend: 1,
      lead: [
        [_, _, _, _, 76, _, _, _, _, _, _, _, 75, _, _, _],
        [_, _, _, _, 77, _, _, _, _, _, _, _, 76, _, _, _],
        [_, _, _, _, 79, _, _, _, 78, _, _, _, 76, _, _, _],
        [_, _, _, _, 75, _, _, _, _, _, _, _, 71, _, _, _],
      ],
    },
    // THE HOUSE — the finale: the table theme's chords turned grand and sinister (E minor, 136 bpm)
    boss_house: {
      bpm: 136,
      chords: [[52, 55, 59, 64], [48, 52, 55, 60], [55, 59, 62, 67], [54, 58, 61, 66]],
      kick: [0, 3, 4, 8, 11, 12], snare: [4, 12], kickVol: 0.5, snareVol: 0.18,
      hat: [0.03, 0.015, 0.03, 0.015, 0.03, 0.015, 0.03, 0.015, 0.03, 0.015, 0.03, 0.015, 0.03, 0.015, 0.03, 0.03],
      perc: [7, 15], percHz: 3000, percVol: 0.08,
      bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 0, 12, 0], bassType: 'sawtooth', bassVol: 0.11, bassLen: 0.9,
      arp: [0, 1, 2, 3, 2, 1, 0, 3], arpOct: 1, arpVol: 0.025,
      leadAlways: true, leadType: 'square', leadVol: 0.045, leadLen: 1.8,
      lead: [
        [76, _, _, 79, _, _, 83, _, 88, _, 86, _, 83, _, 79, _],
        [72, _, _, 76, _, _, 79, _, 84, _, 83, _, 79, _, 76, _],
        [79, _, _, 83, _, _, 86, _, 91, _, 89, _, 86, _, 83, _],
        [78, _, 82, _, 85, _, 90, _, 89, _, 85, _, 82, _, 78, _],
      ],
    },

    // DOKER!! — five of a kind takes over the room: euphoric, fast, everything at once (G major, 168 bpm)
    doker: {
      bpm: 168,
      chords: [[55, 59, 62, 67], [52, 55, 59, 64], [48, 52, 55, 60], [50, 54, 57, 62]],
      kick: [0, 4, 8, 12], snare: [4, 12], kickVol: 0.5, snareVol: 0.2,
      hat: [0.03, 0.03, 0.04, 0.03, 0.03, 0.03, 0.04, 0.03, 0.03, 0.03, 0.04, 0.03, 0.03, 0.03, 0.04, 0.04],
      perc: [2, 6, 10, 14], percHz: 4000, percVol: 0.06,
      bass: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12], bassType: 'square', bassVol: 0.09, bassLen: 0.9,
      arp: [0, 1, 2, 3, 2, 1, 2, 3], arpOct: 2, arpVol: 0.03,
      leadAlways: true, leadType: 'square', leadVol: 0.05, leadLen: 1.6,
      lead: [
        [79, _, 83, _, 86, _, 91, _, 86, _, 83, _, 86, _, 88, _],
        [88, _, 86, _, 83, _, 79, _, 83, _, 86, _, 88, _, 91, _],
        [84, _, 88, _, 91, _, 96, _, 91, _, 88, _, 91, _, 93, _],
        [93, _, 91, _, 90, _, 86, _, 90, _, 93, _, 95, _, 98, _],
      ],
    },

    // ---- boss themes: each boss firewall has its own track ----
    // DDOS / THE FLOOD — relentless and pounding, a flood of repeated notes (D phrygian, 150 bpm)
    boss_ddos: {
      bpm: 150,
      chords: [[50, 53, 57, 62], [51, 55, 58, 63], [50, 53, 57, 62], [48, 52, 55, 60]],
      kick: [0, 3, 4, 8, 11, 12, 14], snare: [4, 12], kickVol: 0.5,
      hat: [0.03, 0.02, 0.03, 0.02, 0.03, 0.02, 0.03, 0.02, 0.03, 0.02, 0.03, 0.02, 0.03, 0.02, 0.03, 0.03],
      perc: [6, 15], percHz: 2500, percVol: 0.1,
      bass: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 1, 0, 12, 0], bassType: 'sawtooth', bassVol: 0.12, bassLen: 0.9,
      arp: [0, 0, 2, 0, 0, 0, 3, 0], arpOct: 1, arpVol: 0.025,
      leadAlways: true, leadType: 'sawtooth', leadVol: 0.035, leadLen: 0.9,
      lead: [
        [74, 74, _, 74, 74, _, 77, _, 74, 74, _, 72, _, 74, _, _],
        [75, 75, _, 75, 75, _, 79, _, 75, _, 74, _, 72, _, 70, _],
        [74, 74, _, 74, 74, _, 81, _, 79, 77, _, 77, 74, _, _, _],
        [72, _, 72, 72, _, 72, 74, _, 76, _, 77, _, 76, _, 74, _],
      ],
    },
    // ENCRYPTION / CIPHER — cold and mysterious: tritones, a music-box lead (B minor, 100 bpm)
    boss_encryption: {
      bpm: 100,
      chords: [[47, 50, 54, 59], [53, 57, 60, 65], [55, 58, 62, 67], [54, 58, 61, 64]],
      kick: [0, 10], snare: [8], snareVol: 0.1,
      hat: [0.02, 0, 0.01, 0, 0.02, 0, 0.01, 0.01, 0.02, 0, 0.01, 0, 0.02, 0, 0.01, 0.015],
      perc: [3, 11], percHz: 9000, percVol: 0.04,
      bass: [0, _, _, _, _, _, 6, _, 0, _, _, _, 12, _, 6, _], bassType: 'sine', bassVol: 0.25, bassLen: 3,
      arp: [0, 2, 1, 3, 2, 0, 3, 1], arpOct: 2, arpType: 'triangle', arpVol: 0.03,
      leadType: 'triangle', leadVol: 0.07, leadLen: 2.4,
      lead: [
        [83, _, _, 77, _, _, 78, _, _, 83, _, 86, _, _, 85, _],
        [84, _, _, 77, _, _, 81, _, _, 84, _, _, 89, _, _, _],
        [86, _, _, 79, _, _, 82, _, 86, _, 85, _, 82, _, 79, _],
        [85, _, 82, _, 78, _, 76, _, 73, _, _, 70, _, _, _, _],
      ],
    },
    // LAG / BUFFER — slow and sluggish, notes that sag and stutter (C minor, 70 bpm)
    boss_lag: {
      bpm: 70,
      chords: [[48, 51, 55, 60], [44, 48, 51, 56], [53, 56, 60, 65], [43, 47, 50, 55]],
      kick: [0, 7, 9], snare: [8], snareHz: 900,
      hat: [0.015, 0, 0, 0.01, 0, 0, 0.015, 0, 0, 0.01, 0, 0, 0.015, 0, 0.01, 0.01],
      bass: [0, _, _, _, _, _, _, 0, 0, _, _, _, 7, _, _, _], bassType: 'sawtooth', bassVol: 0.1, bassLen: 4,
      arp: [0, _, _, 1, _, _, 2, _, _, 3, _, _, 2, _, _, _], arpOct: 1, arpVol: 0.03,
      leadAlways: true, leadType: 'square', leadVol: 0.04, leadLen: 3, leadBend: 2,
      lead: [
        [72, _, _, _, 72, 72, _, _, 70, _, _, _, 67, _, _, _],
        [68, _, _, _, 67, _, 67, 67, _, _, 63, _, _, _, _, _],
        [65, _, _, _, 68, _, _, _, 72, 72, 72, _, _, 70, _, _],
        [67, _, _, _, 66, _, _, _, 65, _, _, _, 62, _, _, _],
      ],
    },
    // SANDBOX / THE WARDEN — a stern march, snare rolls and jail-cell clanks (E phrygian, 112 bpm)
    boss_sandbox: {
      bpm: 112,
      chords: [[52, 55, 59, 64], [53, 57, 60, 65], [52, 55, 59, 64], [50, 53, 57, 62]],
      kick: [0, 8], snare: [4, 12, 13, 14, 15], snareVol: 0.14,
      hat: [0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0, 0.02, 0],
      perc: [6, 10], percHz: 1200, percVol: 0.12,
      bass: [0, _, _, _, 7, _, _, _, 0, _, _, _, 7, _, 5, _], bassType: 'square', bassVol: 0.08, bassLen: 1.2,
      arp: [0, _, 1, _, 2, _, 1, _], arpOct: 1, arpVol: 0.02,
      leadAlways: true, leadType: 'square', leadVol: 0.04, leadLen: 1.5,
      lead: [
        [76, _, _, 76, 77, _, 76, _, 74, _, _, _, 76, _, _, _],
        [77, _, _, 77, 79, _, 77, _, 76, _, 74, _, 72, _, _, _],
        [76, _, _, 76, 79, _, 83, _, 81, _, 79, _, 77, _, 76, _],
        [74, _, 74, _, 72, _, 71, _, 69, _, _, _, 64, _, _, _],
      ],
    },
    // HONEYPOT / SWEETTOOTH — a too-sweet bouncy tune that turns sour (F major -> Db, 108 bpm)
    boss_honeypot: {
      bpm: 108,
      chords: [[53, 57, 60, 65], [58, 62, 65, 70], [49, 53, 56, 61], [48, 52, 55, 61]],
      kick: [0, 6, 8], snare: [4, 12], snareVol: 0.1,
      hat: [0.02, 0, 0.015, 0, 0.02, 0, 0.015, 0, 0.02, 0, 0.015, 0, 0.02, 0, 0.015, 0.01],
      perc: [2, 10], percHz: 5000, percVol: 0.05,
      bass: [0, _, 7, _, 12, _, 7, _, 0, _, 7, _, 12, _, 7, _], bassType: 'triangle', bassVol: 0.22, bassLen: 1,
      arp: [0, 2, 3, 2], arpOct: 2, arpType: 'triangle', arpVol: 0.025,
      leadAlways: true, leadType: 'triangle', leadVol: 0.08, leadLen: 1.4,
      lead: [
        [81, _, 77, _, 81, _, 84, _, 82, _, 81, _, 77, _, _, _],
        [82, _, 79, _, 82, _, 86, _, 84, _, 82, _, 81, _, _, _],
        [80, _, 77, _, 73, _, 77, _, 80, _, 85, _, 84, _, _, _],
        [79, _, 76, _, 73, _, 70, _, 72, _, _, 73, _, 72, _, _],
      ],
    },
  },

  ensure() {
    if (!SFX.ac) return false;
    if (!this.gain) {
      this.gain = SFX.ac.createGain();
      this.gain.gain.value = 0.6;
      this.gain.connect(SFX.out);
    }
    return true;
  },

  play(name) {
    if (!this.ensure() || this.name === name) return;
    this.name = name;
    this.song = this.SONGS[name];
    this.step = 0; this.loop = 0;
    this.next = SFX.ac.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  },

  toggle() { this.enabled = !this.enabled; },

  /** Dip the music for a moment (so the announcer cuts through). */
  duck(sec = 1.2, to = 0.18) {
    if (!this.gain || !SFX.ac) return;
    const g = this.gain.gain, t = SFX.ac.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(to, t + 0.06);
    g.setValueAtTime(to, t + sec);
    g.linearRampToValueAtTime(0.6, t + sec + 0.5);
  },

  tick() {
    const s = this.song;
    if (!s) return;
    const spb = 60 / s.bpm / 4; // one 16th note
    const total = 16 * s.chords.length;
    while (this.next < SFX.ac.currentTime + 0.12) {
      if (this.enabled && !SFX.muted) this.playStep(this.step, this.next, spb);
      this.next += spb;
      this.step = (this.step + 1) % total;
      if (this.step === 0) this.loop++;
    }
  },

  playStep(step, time, spb) {
    const s = this.song;
    const bar = Math.floor(step / 16), st = step % 16;
    const ch = s.chords[bar];
    const o = { dest: this.gain, delay: Math.max(0, time - SFX.ac.currentTime) };
    if (s.kick.includes(st)) SFX.tone(s.kickHz || 150, 0.16, { ...o, type: 'sine', to: 40, vol: s.kickVol || 0.4 });
    if (s.snare.includes(st)) SFX.noise(0.1, { ...o, freq: s.snareHz || 1800, ftype: 'bandpass', vol: s.snareVol || 0.16 });
    if (s.hat[st]) SFX.noise(0.03, { ...o, freq: 7000, vol: s.hat[st] });
    // optional extra hit (claps, clanks, glitches): perc = [steps], percHz
    if (s.perc && s.perc.includes(st)) SFX.noise(0.05, { ...o, freq: s.percHz || 3000, ftype: 'highpass', vol: s.percVol || 0.08 });
    if (s.bass[st] != null) SFX.tone(mtof(ch[0] - 12 + s.bass[st]), spb * (s.bassLen || 1.6), { ...o, type: s.bassType || 'triangle', vol: s.bassVol || 0.22 });
    const ai = s.arp[st % s.arp.length];
    if (ai != null) SFX.tone(mtof(ch[ai] + 12 * s.arpOct), spb * 0.9, { ...o, type: s.arpType || 'square', vol: s.arpVol });
    // the lead melody plays every other loop (or every loop with leadAlways), so the track breathes
    if (s.lead && (s.leadAlways || this.loop % 2 === 1)) {
      const n = s.lead[bar][st];
      if (n) SFX.tone(mtof(n), spb * (s.leadLen || 1.8), { ...o, type: s.leadType || 'square', vol: s.leadVol || 0.045, to: s.leadBend ? mtof(n - s.leadBend) : undefined });
    }
  },
};

// ============================================================
//  VOICE — the DOKER arcade announcer (ElevenLabs, voice "DOKER Arcade Announcer").
//  Only the big hands get a call. Several takes per line so it doesn't repeat.
//  Files live in assets/voice/ (see assets/voice/voice.json for the scripts).
// ============================================================
const VOICE = {
  LINES: {"straight": ["straight_1.mp3", "straight_2.mp3", "straight_3.mp3"], "full": ["full_1.mp3", "full_2.mp3", "full_3.mp3"], "four": ["four_1.mp3", "four_2.mp3", "four_3.mp3"], "doker": ["doker_1.mp3", "doker_2.mp3", "doker_3.mp3"]},
  last: {},
  volume: 0.95,
  /** Play a random take of a call: 'straight' | 'full' | 'four' | 'doker'. */
  play(key) {
    const list = this.LINES[key];
    if (!list || SFX.muted) return;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[key]) i = (i + 1) % list.length;
    this.last[key] = i;
    try {
      const a = new Audio('assets/voice/' + list[i]);
      a.volume = this.volume;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
      MUSIC.duck(key === 'doker' ? 2.6 : 1.3);
    } catch (e) { /* audio unavailable: stay silent */ }
  },
};
