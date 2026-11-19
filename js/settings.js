// ============================================================
//  DOKER — player settings (saved in localStorage['doker.settings'])
//  Loaded before audio.js so volumes apply from the first note.
// ============================================================
const SETTINGS_KEY = 'doker.settings';
const SET_DEFAULTS = {
  music: 8, sfx: 8,          // volume steps 0..10
  announcer: true,           // the DOKER!! voice
  crt: true,                 // scanlines + vignette
  shake: 2,                  // 0 off, 1 reduced, 2 full
  flashes: 1,                // 0 reduced, 1 full (screen flashes + glitch tears)
  speed: 1,                  // game speed: 1 | 1.5 | 2 | 3
  bossIntro: 'always',       // 'always' | 'first' (only the first time you meet each boss)
  seenBosses: [],
  handle: '',                // VERSUS name (picked at random the first time)
};
const SET = (() => {
  try { return { ...SET_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (e) { return { ...SET_DEFAULTS }; }
})();
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SET)); } catch (e) { /* storage blocked */ } }
const shakeScale = () => [0, 0.45, 1][SET.shake] ?? 1;
const flashScale = () => (SET.flashes ? 1 : 0.25);
/** CRT filter on/off (body.nocrt hides the scanlines + vignette). */
function applyCrt() { document.body.classList.toggle('nocrt', !SET.crt); }
applyCrt();
