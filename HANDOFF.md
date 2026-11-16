# DOKER — Handoff

_Last updated: 2026-11-16_

A dice-poker roguelike with a Balatro feel and a hacker theme. Everything — art, music,
sound — is generated in code. No build step, no dependencies, no assets.

## Run it

Double-click `index.html` (any modern browser). Sound starts after the first click/key.

Controls: mouse, or **Space** = roll · **Esc** = back to menu · **M** = mute all ·
**N** = music on/off · **C** = CRT scanlines on/off.

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
| Boss firewalls: rounds 4 + 8 get ENCRYPTION / LAG / SANDBOX / DDOS / HONEYPOT, warned one round early | Done |
| Exploits, upgradable dice, starting rigs, Dealer reactions | Planned |
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
| `js/play.js` | The table: run flow, dice animation, scoring sequence, sidebar, perk strip, autosave (`localStorage` key `doker.save.v1`) |
| `js/menu.js` | Boot + menu scene, main loop, input, scene transitions, shared helpers (`window.G`) |

Internal resolution is 384×216, scaled up in whole-pixel steps.

`art-gallery.html` (double-click) shows every card icon large and on its in-game card, per rarity.

**Autosave:** saved at round start, after every roll (the roll is spent the moment the dice leave), after a breach
payout, and after every Black Market action (stock and open packs are restored). Cleared on win/loss.
The last uncaught error is kept in `localStorage['doker.lastError']`.

## Dev URL flags (for testing)

Append to `index.html`:

- `?skipboot` — straight to the menu
- `?play` — straight to the table · `&auto` — auto-rolls (and auto-continues past breaches)
- `&perks=8` — start with 8 random perks · `&shop` — open the Black Market · `&pack=megaperk` — open a pack
- `&ff=5` — fast-forward 5 seconds of game time (for screenshots); shows `FF OK` / the error in the top bar
- `&clicks=x,y;x,y` — simulate clicks at game coordinates after fast-forwarding

- `&wilds=dealer,mirror,botnet` — start with those wildcards (`&wilds=3` = 3 random); `&ed=holo` forces an edition

- `&round=4&boss=ddos` — jump to a firewall, optionally forcing its boss

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
- Bosses: two different random bosses per run (rounds 4 and 8), same targets as normal rounds, +$2 BOSS BOUNTY
  on breach. ENCRYPTION: 6s (incl. Rubber Ducky 6s) count for nothing. LAG: hard cap of 7 rolls even with
  Extra Socket. SANDBOX: perks fully off (incl. dice odds, extra rolls, interest). HONEYPOT: a Pair subtracts
  its score (score can't go below 0).

## Next steps

1. Playtest the sound/music levels and the overall balance (wildcards make runs much stronger — targets may need a bump).
2. Wildcard follow-ups: drag-to-reorder (now click → MOVE buttons), wildcard sell from inside the shop
   (now only via the slots-full prompt), more than 5 slots as a reward.

## Git

Repo: https://github.com/dashaunb123/Doker (branch `main`). Work happens on feature branches.
