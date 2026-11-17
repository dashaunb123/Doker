// Balance sim: real game code, no rendering. ?stakes=1,2&n=20&rig=stock
(function () {
  const q = new URLSearchParams(location.search);
  const N = +q.get('n') || 10, rig = q.get('rig') || 'stock';
  const stakes = (q.get('stakes') || '1,2,3,4,5,6,7,8').split(',').map(Number);
  if (q.get('zd')) ZERO_DAY_RULE = q.get('zd');
  try { Storage.prototype.setItem = function () {}; } catch (e) {}
  const DT = 0.05, CAP = 60 * 60 * 20;       // 20 minutes of game time max per run
  const out = {};
  const t0 = performance.now();
  for (const st of stakes) {
    const rounds = [];
    let wins = 0, frames = 0, owned = 0, spent = 0;
    for (let k = 0; k < N; k++) {
      PLAY.quickStart(rig, st); PLAY.enter(); PLAY.auto = true;
      let f = 0, shopT = 0;
      while (f++ < CAP) {
        PLAY.update(DT);
        const m = PLAY.mode;
        if (m === 'shop' && (shopT += DT) > 0.25) { shopT = 0; SHOP.botStep(); }
        if (m === 'failed' || m === 'won') break;
      }
      frames += f;
      const r = PLAY.run; owned += r.perks.length + r.wilds.length + r.dieMods.filter(Boolean).length + Object.values(r.levels).reduce((a, b) => a + Math.max(0, b - 1), 0);
      if (PLAY.mode === 'won') wins++;
      rounds.push(PLAY.mode === 'won' ? 9 : PLAY.run.round);
    }
    const hist = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => rounds.filter(x => x === r).length);
    out[st] = { n: N, wins, winPct: +(100 * wins / N).toFixed(1), avgRound: +(rounds.reduce((a, b) => a + b, 0) / N).toFixed(2), diedAt: hist.slice(0, 8), avgFrames: Math.round(frames / N), avgItemsOwned: +(owned / N).toFixed(1) };
  }
  out.seconds = +((performance.now() - t0) / 1000).toFixed(1);
  document.title = 'SIM ' + JSON.stringify(out);
})();
