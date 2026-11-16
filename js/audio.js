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
    if (s.kick.includes(st)) SFX.tone(150, 0.16, { ...o, type: 'sine', to: 40, vol: 0.4 });
    if (s.snare.includes(st)) SFX.noise(0.1, { ...o, freq: 1800, ftype: 'bandpass', vol: 0.16 });
    if (s.hat[st]) SFX.noise(0.03, { ...o, freq: 7000, vol: s.hat[st] });
    if (s.bass[st] != null) SFX.tone(mtof(ch[0] - 12 + s.bass[st]), spb * 1.6, { ...o, type: 'triangle', vol: 0.22 });
    const ai = s.arp[st % s.arp.length];
    if (ai != null) SFX.tone(mtof(ch[ai] + 12 * s.arpOct), spb * 0.9, { ...o, type: 'square', vol: s.arpVol });
    // the lead melody only plays every other loop, so the track breathes
    if (s.lead && this.loop % 2 === 1) {
      const n = s.lead[bar][st];
      if (n) SFX.tone(mtof(n), spb * 1.8, { ...o, type: 'square', vol: 0.045 });
    }
  },
};
