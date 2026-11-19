# DOKER — Handoff

_Last updated: 2026-11-16_

A dice-poker roguelike with a Balatro feel and a hacker theme. Everything — art, music,
sound — is generated in code. No build step, no dependencies, no assets.

## Run it

Double-click `index.html` (any modern browser). Sound starts after the first click/key.
To let people on your Wi-Fi play: `python3 tools/serve.py` (serves only the game files, prints the link).

Controls: mouse, or **Space** = roll · **Esc** = back to menu · **M** = mute all ·
**N** = music on/off · **C** = CRT scanlines on/off · **F** = fullscreen.

## What's built

| Area | Status |
|---|---|
| Boot screen → main menu (logo, mascot "The Dealer", buttons, terminal, card fan, throwable dice) | Done |
| Music (2 procedural chiptune tracks) + all SFX | Done (never heard by Claude — needs a listen) |
| The table: 5 dice slots, sequential roll animation, poker-dice hand detection | Done |
| Run loop: 8 firewalls × 10 rolls, targets, chips × mult scoring, breach / fail / win screens | Done |
| Credits ($) + Black Market shop between firewalls | Done |
| Packs with decrypt reveal (Perk, Patch, Mystery, 2 Mega packs) | Done |
| All 14 perks + rarity-scaled patches (hand level-ups) | Done |
| Perk values shown on cards before you pick (no hidden stats) | Done |
| Pixel-art icons for every patch + perk card (`js/cardart.js`, preview in `art-gallery.html`) | Done |
| Autosave + CONTINUE on the menu; crash guard keeps the game running after an error | Done |
| Decluttered table (no slot labels under dice, no HOUSE OF BONES / TABLE text) | Done |
| Wildcards: all 19 from DESIGN.md §6, 5 slots on the felt, sell/move, editions, Wildcard Drop pack, slots-full swap in shop | Done |
| Rigs (9) + stakes (8): rig picker before each run, unlocks + best-stake stickers saved in `localStorage['doker.profile']` | Done |
| Content waves 1+2: 12 die mods, 3 stickers, 12 exploits, 24 perks, 32 wildcards — all with art | Done |
| Die mods (NEON / GOLD / WEIGHTED / GLASS): permanent upgrades on one of your 5 dice; Dice Lab pack; die picker in the shop | Done |
| Exploits (NUDGE / CLONE / NUKE / FORCE): 2 slots, fired in the HACK WINDOW after the dice land; Exploit Kit pack | Done |
| Boss firewalls: round 4 (and 6 at stake 2+) draws from ENCRYPTION / LAG / SANDBOX / DDOS / HONEYPOT / PHISHER / 2FA / KERNEL PANIC / TROJAN / BLACKOUT, warned one round early | Done |
| Final boss THE HOUSE (round 8 always): the Dealer unmasked, runs two other bosses' rules at once (`run.houseRules`, checked via `ruleOn`) | Done |
| Announcer voice (ElevenLabs) — only DOKER is voiced (user's call); straight/full/four takes kept in `assets/voice/` but unused | Done |
| DOKER!! event (five of a kind): cutscene, DOKER party track, announcer scream | Done |
| Boss characters (`js/boss.js`, sprites in `js/bossart.js`): intro cutscene, live on the felt, physically enforce their rule | Done |
| VERSUS (online, up to 4 players via Cotchu rooms): host from the rig picker, share a link, lobby, same bosses for everyone, player tabs along the bottom, match board + rematch | Done |
| Dealer reactions, upgrades (vouchers) | Planned |
| Extra hand types (Small Straight, Parity, Bookends) | Needs precedence rules first |
| Seeds / daily run, endless mode | Parked |

The full game design (numbers, every perk/wildcard, open questions) is in
[docs/DESIGN.md](docs/DESIGN.md) — that file is the source of truth.
The original idea review board: https://claude.ai/artifact/HZQ8eKYF3MScqJzPfApfGp

## Code map

Plain `<script>` files (no modules, so it runs from `file://`). Load order matters — see `index.html`.

| File | What's in it |
|---|---|
| `js/font.js` | Hand-made 5×7 bitmap font + `drawText()` |
| `js/sprites.js` | All pixel art built pixel-by-pixel: dice, logo, cards, chips, mascot, laptop, cursor |
| `js/cardart.js` | Card icons (rows of characters + palette), one per patch hand / perk id → `CARD_ART` |
| `js/audio.js` | `SFX` (synth sound effects) and `MUSIC` (step sequencer + 2 songs) |
| `js/rules.js` | Run constants, hand table (`HANDS`), `evaluateDice()` |
| `js/items.js` | Rarity, perk/patch definitions, packs, and the perk engine (`scoreRoll`, `dieWeights`, …) |
| `js/ui.js` | Shared drawing: panels, buttons, item cards, pack art, info box |
| `js/shop.js` | Black Market + pack opening |
| `js/boss.js` | Boss actors: personas/quips, intro cutscene, task-queue animations, rule set-pieces (stomp, padlock, eat rolls, cage, bite) |
| `js/bossloom.js` | Looming boss art: 2x bust (idle/blink/act/peek/hurt), hand (grip/open/fist/point), shoulder + wrist anchors, arm colours |
| `js/bossart.js` | Older full-body boss sprites — only used as a fallback if a boss has no loom art |
| `js/play.js` | The table: run flow, dice animation, scoring sequence, sidebar, perk strip, autosave (`localStorage` key `doker.save.v1`) |
| `js/menu.js` | Boot + menu scene, main loop, input, scene transitions, shared helpers (`window.G`) |
| `js/settings.js` | Player settings `SET` (volumes, announcer, CRT, shake, flashes, game speed, boss intros, bosses met) in `localStorage['doker.settings']`; loaded before audio.js |
| `js/tutorial.js` | Scripted tutorial (`TUT`): 3-firewall rigged run (`run.tutorial`), coach box + highlights, click gating; offered on first PLAY (`SET.tutorialOffered`), replay from OPTIONS, dev `?play&tutorial` |
| `js/options.js` | OPTIONS scene (state `'options'` in menu.js): settings rows, CONTROLS panel, RESET PROGRESS (type CONFIRM) |
| `js/net.js` | VERSUS (`NET`): Cotchu rooms, the lobby + match board (state `'lobby'` in menu.js), the player tabs drawn in the bottom strip of the table/shop |

Internal resolution is 384×216, scaled up in whole-pixel steps.

`art-gallery.html` (double-click) shows every card icon large and on its in-game card, per rarity.

**Autosave:** saved at round start, after every roll (the roll is spent the moment the dice leave), after a breach
payout, and after every Black Market action (stock and open packs are restored). Cleared on win/loss.
The last uncaught error is kept in `localStorage['doker.lastError']`.

## VERSUS (online matches)

- **Service:** [Cotchu](https://cotchu.com/llms.txt) shared rooms. SDK `cotchu@0.1.0`, loaded from jsDelivr with a
  dynamic `import()` only when someone opens a versus lobby, so solo play never touches the network and still runs
  from `file://`. The `pk_live_…` key in `js/net.js` is a *publishable* key (Cotchu says it's safe in game code).
  Never put an `sk_…` key in the game.
- **Flow:** rig picker → VERSUS (or `V`) → lobby with a share link `…/?room=doker-xxxxxxxx` → host presses START →
  everyone plays their own run → when a run ends, MATCH > opens the board → host can REMATCH.
- **Fair setup:** the host rolls bosses, THE HOUSE's rules and ICE once and puts them in the room; dice, shops and
  rig loadout items stay each player's own luck. Everyone uses the host's rig + stake.
- **Who wins:** rooted beats not rooted, then furthest firewall, then most credits. (So a survivor still has to get
  further than the dead player; if both root it, money decides.)
- **Room state:** `match` (setup + roster), `players.<id>` (name, st, round, money; ~4 updates/s, only on change),
  `results.<n>.<id>` (written once a run ends; outlives the seat, since the room deletes `players.<id>` on leave).
- **Leaving:** ESC / MENU mid-run asks twice (it forfeits). Closing the tab: shown OFFLINE within ~5 s, counted as
  LEFT after Cotchu's 60 s seat window. A reload within 60 s resumes the same seat *and* run (versus runs autosave
  to `localStorage['doker.save.versus']`, apart from the solo save).
- **Hosting:** the share link points at wherever the page is served (GitHub Pages, `tools/serve.py` on the LAN, …).
  Cotchu: 50 open rooms per project; rooms close a minute after the last player leaves. If the project lists
  allowed origins, the hosting site must be on it (`localhost` always works).

## Dev URL flags (for testing)

Append to `index.html`:

- `?skipboot` — straight to the menu
- `?play` — straight to the table · `&auto` — auto-rolls (and auto-continues past breaches)
- `&perks=8` — start with 8 random perks · `&shop` — open the Black Market · `&pack=megaperk` — open a pack
- `&ff=5` — fast-forward 5 seconds of game time (for screenshots); shows `FF OK` / the error in the top bar
- `&clicks=x,y;x,y` — simulate clicks at game coordinates after fast-forwarding

- `&wilds=dealer,mirror,botnet` — start with those wildcards (`&wilds=3` = 3 random); `&ed=holo` forces an edition

- `&rig=goldbug&stake=5` — start straight into a rig/stake (`?play` skips the rig picker; add `&setup` to see it)
- `&perks=backdoor,cronjob` — perks by id (or a number for random ones); `&stickers=red,blue,purple`
- `&mods=gold,glass,neon,weighted` — put die mods on dice 1-5 (`-` skips a die)
- `&exploits=force,nuke` — start holding those exploits (max 2)
- `&doker` (or `&doker=4`) — the first roll is five of a kind, to see the DOKER!! event
- `&round=4&boss=ddos` — jump to a firewall, optionally forcing its boss
- `?room=doker-xxxxxxxx` — join that VERSUS match (what the share link does)

Example: `index.html?play&perks=14&auto&ff=60`

## Decisions made without the user (worth confirming)

- **Corrupted perks** (except Streak): ~1.6× Legendary numbers, catch = −1 roll per firewall.
- All card values are visible before you pick (the user asked for no hidden stats). Exceptions that are part of a perk's design: Lucky Number's target below Legendary, Corrupted Streak's face, Corrupted patches' lowered hand.
- No keyboard shortcut leaves the shop (so mashing Space can't skip it).
- Balance: with no build, runs die around firewall 3–4 — intentional.
- Wildcards (design said 20, the table lists 19 — built the 19). Prices $4–9 by rarity, editions add $2–3.
  Editions: NEON +20 chips, HOLO +6 mult, GOLD +$2 per breach, CORRUPTED X2 on half the rolls.
  Order of scoring: dice → perks → wildcards left to right (each with its edition). MIRROR copies only the
  scoring of the card to its right (not rule changes like Rubber Ducky). PHANTOM can't make straights.
  ZERO DAY ignores Bust. COOKIE JAR counts this roll's 1s immediately.
- Bosses: a random boss at round 4 (plus round 6 at stake 2+), THE HOUSE at round 8 with two rules you haven't faced this run;
  same targets as normal rounds, +$2 BOSS BOUNTY. Always check rules with `ruleOn(run, id)`, never `run.boss === id`
- Balance knobs live in `KNOBS` (js/items.js); tools/balance/sim.html overrides them from the URL. Latest numbers in tools/balance/README.md
  on breach. ENCRYPTION: 6s (incl. Rubber Ducky 6s) count for nothing. LAG: hard cap of 7 rolls even with
  Extra Socket. SANDBOX: perks fully off (incl. dice odds, extra rolls, interest). HONEYPOT: a Pair subtracts
  its score (score can't go below 0).
- Exploits: the HACK WINDOW only opens if you hold one (auto-play skips it). Using the last one scores the roll
  automatically. The DDOS die can't be targeted while the boss is alive; changing a padlocked 6 removes the lock
  (the 6 is no longer a 6). NUKE relaunches the dice without spending a roll (boss set-pieces run again).
  Buying with full slots is refused (no swap prompt, unlike wildcards).
- Die mods: one per die (a new one replaces the old). NEON/GOLD/GLASS fire only when that die is part of the
  scoring hand; GLASS doubles mult during the dice phase (before perks/wildcards) and has a 1 in 6 chance to
  shatter back to a plain die. WEIGHTED multiplies that die's odds of 4/5/6 by 1.6/1.8/2 (~64% vs 50% high).
- Rigs/stakes: roadmap in DESIGN.md §10. Unlocks: SCRIPT KIDDIE (win STOCK), GOLDBUG (win WHALE), GLASS CANNON
  (win GOLDBUG), BOTNET (win SCRIPT KIDDIE), PHANTOM (win BOTNET), ROOT (win any rig on stake 4). A stake opens
  after beating the one below with that rig. ICE rules: COLD BOOT (first roll half), NOISE (-1 roll), TAX (-$2).
  ZERO DAY pays half the unused-roll money (rounded down); switch: ZERO_DAY_RULE in items.js.
  PHANTOM rig's ghost die has no visual of its own yet (it shows up as GHOST notes when it completes a hand).

## Next steps

1. Playtest the sound/music levels and the overall balance (wildcards make runs much stronger — targets may need a bump).
2. Wildcard follow-ups: drag-to-reorder (now click → MOVE buttons).

## Announcer voice (ElevenLabs)

- Voice: **DOKER Arcade Announcer** (designed voice, saved in the user's ElevenLabs account; id in `assets/voice/voice.json`),
  picked in an audition (`audition/`, git-ignored). Model `eleven_v3`, stability 0 (creative), audio tags like `[excited]`.
- API key: the same file the user's UFC project uses, `~/.config/university-football/elevenlabs.key` — never copy it into this repo.
- Only DOKER (five of a kind) is voiced — the user tried calls on every big hand and cut them back to just DOKER.
  The straight/full/four takes are still in `assets/voice/` if that changes. `VOICE.play(key)` in `js/audio.js`
  picks a random take and ducks the music. Lines/scripts: `assets/voice/voice.json`.

## Git

Repo: https://github.com/dashaunb123/Doker (branch `main`). Work happens on feature branches.
