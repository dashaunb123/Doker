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
| Wildcards (20 joker-style cards, limited slots, selling) | **Next** |
| Boss firewalls (rounds 4 and 8 with rule twists) | Planned |
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
| `js/audio.js` | `SFX` (synth sound effects) and `MUSIC` (step sequencer + 2 songs) |
| `js/rules.js` | Run constants, hand table (`HANDS`), `evaluateDice()` |
| `js/items.js` | Rarity, perk/patch definitions, packs, and the perk engine (`scoreRoll`, `dieWeights`, …) |
| `js/ui.js` | Shared drawing: panels, buttons, item cards, pack art, info box |
| `js/shop.js` | Black Market + pack opening |
| `js/play.js` | The table: run flow, dice animation, scoring sequence, sidebar, perk strip |
| `js/menu.js` | Boot + menu scene, main loop, input, scene transitions, shared helpers (`window.G`) |

Internal resolution is 384×216, scaled up in whole-pixel steps.

## Dev URL flags (for testing)

Append to `index.html`:

- `?skipboot` — straight to the menu
- `?play` — straight to the table · `&auto` — auto-rolls (and auto-continues past breaches)
- `&perks=8` — start with 8 random perks · `&shop` — open the Black Market · `&pack=megaperk` — open a pack
- `&ff=5` — fast-forward 5 seconds of game time (for screenshots); shows `FF OK` / the error in the top bar
- `&clicks=x,y;x,y` — simulate clicks at game coordinates after fast-forwarding

Example: `index.html?play&perks=14&auto&ff=60`

## Decisions made without the user (worth confirming)

- **Corrupted perks** (except Streak): ~1.6× Legendary numbers, catch = −1 roll per firewall.
- Patch cards show their boost up front (it's fixed by rarity); only Corrupted hides the hand it lowers.
- No keyboard shortcut leaves the shop (so mashing Space can't skip it).
- Balance: with no build, runs die around firewall 3–4 — intentional.

## Next steps

1. **Wildcards** — 20 cards in DESIGN.md §6, 5 slots, sell for 50%, order matters (Mirror),
   editions (Neon/Gold/Holo/Corrupted). Add the Wildcard Drop pack and add wildcards to Mystery Payload.
2. **Boss firewalls** on rounds 4 and 8.
3. Playtest the sound/music levels and the overall balance.

## Getting it into git

Git is **not installed** on this machine yet. Once it is (`winget install --id Git.Git -e`,
then reopen the terminal):

```powershell
cd C:\Users\dashbarn\Desktop\Doker
git init
git config user.name "Your Name"
git config user.email "you@example.com"
git add .
git commit -m "Doker: menu, table, run loop, Black Market, packs, perks, patches"
```

To put it on GitHub: create an empty repo on github.com, then
`git remote add origin <repo URL>` and `git push -u origin main`
(use `git branch -M main` first if the branch is named `master`).
