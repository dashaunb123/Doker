# Balance sim

Plays full runs with the real game code (no rendering): auto-rolls every roll and shops completely at
random (`SHOP.botStep`: every affordable buy and leaving are equally likely; random pack picks / dice).
Exploits are never fired mid-roll, so this is a pure-luck baseline, not a skilled player.

Run (prints JSON in the page title; ~2.5 ms per run):

    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
      --allow-file-access-from-files --dump-dom \
      "file://$PWD/tools/balance/sim.html?skipboot&n=5000&stakes=1,2,3,4&rig=stock" | grep -o '<title>[^<]*'

Params: `n` runs per stake, `stakes` list, `rig`, `zd` = ZERO DAY rule to test (`none` | `half` | `cap3`),
plus any key of `KNOBS` in js/items.js (e.g. `&phishChance=1&twofaRepeat=0&greyHat=boss6&traceOn=bust&traceEvery=3&tracePct=0.1`).
Output per stake: winPct, avgRound, diedAt[round 1..8], avgItemsOwned (perks + wilds + die mods + patch levels),
bossKill = { boss: [times faced, % of those runs it ended] } (THE HOUSE keyed as `house:ruleA+ruleB`).

Run one Chrome at a time: two headless instances in parallel hung on this machine.

## Sensible-player bot (`&bot=smart`)

`SHOP.smartStep` plays a few hundred simulated rolls with and without each option (same random dice for every
option) and buys whatever raises expected score per firewall most per dollar; it opens packs, picks the best card,
replaces its weakest wildcard when full, rerolls when rich, and picks the best LOADED face. It never fires exploits
and ignores pure-economy items. ~0.3 s per run, so use n=500-1000.

| stake | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| smart win % | 83.7 | 74.1 | 64.2 | 35.6 | 21.6 | 15.2 | 12.0 | 4.4 |

Most stake 1-2 losses are at THE HOUSE (firewall 8). HONEYPOT is the outlier boss for good players (13% kill at
stakes 1-2 where the next worst is 5%) because pairs are ~46% of rolls.

## Results (stock rig, 5000 runs/stake, Nov 2026, after boss wave 2 + tuning)

| stake | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| win % | 17.3 | 12.8 | 7.5 | 2.7 | 1.9 | 1.5 | 0.7 | 0.4 |

Solo boss kill rates (all stakes) sit between 32% (DDOS) and 55% (HONEYPOT); THE HOUSE ends ~65% of runs that reach it.
Tuning that got there: PHISHER baits half the rolls, 2FA repeats score half, KERNEL PANIC smacks a die in your hand,
GREY HAT makes THE HOUSE play 3 rules, TRACE raises the target 2% every roll (was: every 3rd bust +10%, which almost
never fired since a random roll busts only ~6% of the time). Boss picks use a real shuffle now (`shuffle()` in items.js);
`sort(() => Math.random() - 0.5)` had made the first-listed bosses ~9x likelier.
