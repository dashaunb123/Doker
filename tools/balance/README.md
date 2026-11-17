# Balance sim

Plays full runs with the real game code (no rendering): auto-rolls every roll and shops completely at
random (`SHOP.botStep`: every affordable buy and leaving are equally likely; random pack picks / dice).
Exploits are never fired mid-roll, so this is a pure-luck baseline, not a skilled player.

Run (prints JSON in the page title; ~2.5 ms per run):

    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
      --allow-file-access-from-files --dump-dom \
      "file://$PWD/tools/balance/sim.html?skipboot&n=5000&stakes=1,2,3,4&rig=stock" | grep -o '<title>[^<]*'

Params: `n` runs per stake, `stakes` list, `rig`, `zd` = ZERO DAY rule to test (`none` | `half` | `cap3`).
Output per stake: winPct, avgRound, diedAt[round 1..8], avgItemsOwned (perks + wilds + die mods + patch levels).
