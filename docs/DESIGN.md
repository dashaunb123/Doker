# DOKER — Game Design

Source of truth for the run structure and collectibles. Decided in the design review
(review board: https://claude.ai/artifact/HZQ8eKYF3MScqJzPfApfGp). Numbers are starting
values to tune in playtesting.

Status legend: **[built]** in the game · **[planned]** agreed, not built · **[later]** parked

---

## 1. The run

| Setting | Value |
|---|---|
| Rounds per run | 8 |
| Rolls per round | 10 |
| Round 1 target | 300 |
| Target growth | +60% per round (R1 300 → R8 ≈ 8,050) |

- **Every roll scores.** Roll all 5 dice, the hand scores, repeat. No locking/rerolling.
  The build (perks, patches, wildcards) does the heavy lifting. [built]
- Each round is a **firewall** with a score target. Beat it before the rolls run out to
  breach it and advance (the round ends the moment the target is hit); miss it and the
  run ends. Win screen after firewall 8. [built]
- Playtest note: with no build, an average run dies around firewall 3–4. That is the
  intended pressure — perks/wildcards have to carry the later rounds.
- **Boss firewalls** on rounds 4 and 8, each with a rule twist, revealed one round early:
  `ENCRYPTION` (6s score 0), `LAG` (only 7 rolls), `SANDBOX` (perks offline),
  `DDOS` (one die stuck on 1), `HONEYPOT` (pairs score negative). [planned]
- **Credits ($)** earned per firewall breached ($3, +$1 every 2 rounds), plus $1 per
  leftover roll. Start with $4. [built]
- **Black Market** between rounds [built]: run by the Dealer. Each visit stocks
  2 "software" items (single perks/patches, priced by rarity: $3/5/7/9/12, Corrupted $10)
  and 2 random packs. Reroll the software for $2 (+$1 per reroll that visit).
  "JACK OUT" starts the next firewall. No keyboard shortcut out, so mashing space
  after a breach can't skip the shop.
- ~~Trace meter~~ — cut.

## 2. Scoring

```
score = (hand chips + sum of dice) × hand mult
```

Perks, patches and wildcards add chips, add mult, or multiply mult.

### Hand values — set by real odds

Rarer hand = bigger payout, always. Odds are for one roll of 5d6 (7,776 outcomes).
Note **Straight is rarer than Full House** with dice, so it pays more.

| Hand | Protocol | Ways | Odds | Base chips | Base mult | +chips / lvl | +mult / lvl |
|---|---|---:|---:|---:|---:|---:|---:|
| Pair | PING | 3,600 | 46.3% | 10 | ×2 | +10 | +1 |
| Two pair | HANDSHAKE | 1,800 | 23.1% | 20 | ×3 | +15 | +1 |
| Three of a kind | TRIANGULATE | 1,200 | 15.4% | 30 | ×4 | +20 | +2 |
| Full house | FULL STACK | 300 | 3.9% | 50 | ×6 | +25 | +2 |
| Straight | PIPELINE | 240 | 3.1% | 60 | ×7 | +30 | +3 |
| Four of a kind | QUAD CORE | 150 | 1.9% | 80 | ×9 | +35 | +3 |
| Five of a kind | ROOTKIT (DOKER!!) | 6 | 0.08% | 150 | ×25 | +60 | +5 |
| Bust | NULL | 480 | 6.2% | 5 | ×1 | +5 | +0.5 |

Bust is a non-hand, so it stays at the bottom even though it is rarer than Three of a kind.

**Extra hand types** (kept, need rules before building): `SMALL STRAIGHT` (4 in a row),
`PARITY` (all even or all odd, ~6.25% combined), `BOOKENDS` (definition TBD). These overlap
with the core hands, so each needs a precedence rule (which hand wins when both apply) and
a value from its own odds. [planned]

## 3. Rarity

| Tier | Drop % | Notes |
|---|---:|---|
| Common | 55 | |
| Uncommon | 25 | |
| Rare | 12 | |
| Epic | 6 | |
| Legendary | 1.5 | |
| Corrupted | 0.5 | Huge upside with a drawback; glitches on screen |

- **Encrypted stats:** in a pack you see an item's name and rarity color; its random
  numbers read `[ENCRYPTED]` until you take it, then a decrypt animation reveals them.
- Applies to perks, patches and wildcards.

## 4. Perks — permanent, unlimited

Random stats rolled by rarity (Common → Legendary).

| Perk | Effect | C | U | R | E | L |
|---|---|---|---|---|---|---|
| STREAK | Rolling `[face]` makes it +X% likelier next roll; stacks, resets on a miss. Face random & encrypted | +10% | +15% | +25% | +35% | face 6, +50%, never resets |
| LOADED | `[face]` permanently +X% likelier | +5% | +8% | +12% | +18% | +25%, choose the face |
| HOT HAND | +X mult per scoring hand in a row; resets on bust | +0.5 | +1 | +1.5 | +2 | +3, survives one bust |
| PITY PROTOCOL | Each bust stores +X chips for the next scoring hand | +10 | +20 | +35 | +50 | +80 and ×1.5 |
| BIT FLIP | X% per die to flip to 7−n if it improves the hand | 4% | 7% | 10% | 15% | 22% |
| OVERCLOCK | First roll of each round ×X | ×1.5 | ×2 | ×2.5 | ×3 | ×5 |
| LAST CALL | Final roll of each round ×X | ×2 | ×2.5 | ×3 | ×4 | ×6 |
| PIP INFLATION | `[face]` counts +X for chips | +2 | +4 | +6 | +9 | +15 |
| EXTRA SOCKET | +X rolls per round | +1 | +1 | +2 | +2 | +3 |
| LUCKY NUMBER | Dice sum exactly = random target (10–25) → +X mult | +5 | +8 | +12 | +18 | +30, target shown |
| SNAKE CHARMER | Each 1 rolled → +X chips | +5 | +10 | +15 | +25 | +40 |
| ECHO | Same hand twice in a row → second scores ×X | ×1.5 | ×2 | ×2.5 | ×3 | ×4 |
| COMPOUND INTEREST | X% interest on credits per round (capped) | 5% ($3) | 8% ($4) | 10% ($6) | 12% ($8) | 20% ($15) |
| RECURSION | X% chance a scoring hand scores twice | 5% | 8% | 12% | 18% | 30% |

Corrupted perks: stronger than Legendary with a catch (e.g. CORRUPTED STREAK: +80% on a
face that secretly changes every round). **Placeholder rule until each perk gets its own
catch:** every other Corrupted perk gets ~1.6× its Legendary numbers and costs −1 roll
per firewall.

All 14 perks are [built]. Implementation notes:
- "+X% likelier" multiplies that face's weight on every die (Loaded, Streak stacks).
- Streak counts rolls that *contain* the face, not how many dice show it.
- Perks trigger after the dice, in order: +chips perks, then +mult, then ×mult.
- Lucky Number's target stays secret below Legendary, even after you own it.
- Loaded (Legendary) asks you to pick the face right after it decrypts.

## 5. Patches — hand upgrades, with rarity

A patch levels up one hand. **The patch's rarity sets how big the boost is.** [built]
Since a patch's boost is fixed by its visible rarity, its card shows the boost up front
(and a before → after preview); only a Corrupted patch hides which hand it will lower.

| Rarity | Boost |
|---|---|
| Common | +1 level |
| Uncommon | +1 level, +5 bonus chips |
| Rare | +2 levels |
| Epic | +2 levels, +1 bonus mult |
| Legendary | +3 levels |
| Corrupted | +4 levels, but a random other hand −1 level |

- **Mastery at level 5:** a hand at level 5 gains a bonus effect (e.g. a level-5 Pair
  also counts as Two Pair for wildcard triggers). Per-hand effects TBD.

## 6. Wildcards — joker-like, limited slots

- 5 starting slots. Sell for 50% of price. Order matters (drag to reorder).
- **Editions:** NEON (+chips), GOLD (+$ per round), HOLO (+mult), CORRUPTED (×mult, flickers on/off).

| Wildcard | Effect |
|---|---|
| THE DEALER | +4 mult every roll |
| RUBBER DUCKY | 1s count as 6s |
| MAN IN THE MIDDLE | Slot-3 die counts twice for chips; ×1.5 mult if it's in the hand |
| RANSOMWARE | ×3 mult, costs $1 per roll; deletes itself if you go broke |
| ZERO DAY | First time each hand type is rolled in a round → ×2 |
| BOTNET | +3 mult per wildcard owned |
| KEYLOGGER | +0.1× mult (permanent) each time you repeat your previous hand |
| PACKET LOSS | Lowest die dropped every roll, hand scores ×2 |
| PHANTOM DIE | Ghost 6th die that only counts for pairs/kinds |
| FIREWALL | Once per run, a failed round counts as passed; then burns |
| OVERFLOW | Dice sum ≥ 24 → ×2 mult |
| PARITY BIT | All even → +40 chips; all odd → +8 mult |
| COOKIE JAR | +3 chips (permanent) each time a 1 is rolled |
| BRUTE FORCE | +1 mult per roll already used this round |
| MIRROR | Copies the wildcard to its right |
| GLITCH | Each round a random face is WILD |
| CRYPTO MINER | +$1 per 6 rolled |
| DEAD MAN'S SWITCH | Final roll, target not yet hit → ×4 mult |
| SPOOFER | Straights may skip one number (1-2-3-5-6 counts) |

## 7. Packs

Open a pack, see a spread, pick one (or skip).

| Pack | Price | Contents | Pick |
|---|---:|---|---|
| PERK CACHE | $4 | Perks | 1 of 3 |
| PATCH BUNDLE | $4 | Patches | 1 of 4 |
| WILDCARD DROP | $5 | Wildcards | 1 of 2 | [planned — needs wildcards]
| MYSTERY PAYLOAD | $6 | Perks + patches (wildcards later) | 1 of 5 |
| MEGA PERK CACHE / MEGA PATCH BUNDLE | $8 | Same pool, 2× odds of Rare+ | 2 of 6 |

Packs are [built]. Shop pack odds: Perk 30, Patch 30, Mystery 20, each Mega 10.

- **Skip reward:** +$2 or +1 roll next round.
- **Decrypt animation:** face-down cards with scrolling hex decrypt one by one, color by
  rarity; Legendary and Corrupted get a flash and their own sound.

## 8. More systems [planned]

- **Exploits** (single-use): FORCE (set a die), NUDGE (±1), CLONE (copy a die), NUKE (free full reroll).
- **Upgradable dice:** GOLD (+$1 when scoring), GLASS (×2 mult, 1-in-6 to shatter), WEIGHTED (favors high), NEON (+15 chips).
- **Starting rigs:** BURNER (+1 roll, −1 wildcard slot), WHALE (start $20), SCRIPT KIDDIE (random perk), ROOT (unlock by winning).
- **The Dealer reacts** live to busts, close calls and DOKER!!

## 9. Parked [later]

- Seeds and a daily run
- Endless mode

## 10. Roadmap — rigs, stakes and more content [agreed 2026-11-16]

Order: content wave 1 (die mods, exploits, stickers) → wave 2 (perks, wildcards) → rigs + stakes →
upgrades, new bosses, final boss THE HOUSE.

**Rigs** (starting loadouts; winning unlocks the next): STOCK · BURNER (+1 roll, −1 wildcard slot) · WHALE ($20,
shop +$1) · SCRIPT KIDDIE (random perk + exploit) · GOLDBUG (all dice GOLD, mods +$2) · GLASS CANNON (all dice GLASS)
· BOTNET (6 wildcard slots + free common wildcard, perks +$1) · PHANTOM (permanent 6th ghost die, 8 rolls) · ROOT
(3 exploit slots, starts with FORCE; unlock by winning any rig on stake 4).

**Stakes** (cumulative difficulty per rig, sticker shows best beaten): WHITE HAT · GREY HAT (extra boss on round 6) ·
BLACK HAT (targets +25%) · ZERO DAY (unused rolls pay half, rounded down — was no payout; softened after the balance sim) · ICE (normal firewalls get a mini-boss rule) ·
HONEYNET (shop +$1, rerolls start $3) · TRACE (every 3rd bust raises the target 10%) · SINGULARITY (9 rolls, bosses
get a second rule).

**Wave 1 — die mods (+8):** CHROME (+3 mult if NOT in the hand) · LUCKY (1/5 +20 mult, 1/15 +$10) · STONE (no
face, always +50 chips, never in hands) · WILD (any face for hands) · TWIN (counts twice for pairs/kinds) · RUBBER
(a 1 bounces and rerolls once) · PRISM (x1.5 mult when it scores) · EMBER (+1 mult per scoring hand in a row).
**Die stickers** (stack with a mod): RED (chips trigger twice) · BLUE (+1 roll if part of a DOKER) · PURPLE (spawns
an exploit when it scores in four of a kind or better).
**Exploits (+8):** FLIP · SWAP · REROLL ONE · OVERWRITE · INJECT (+50 chips) · ROLLBACK (undo a bust, roll back) ·
SIPHON ($ = dice total / 5) · PING (+1 level to the rolled hand).

**Wave 2 — perks (+10):** BACKDOOR · SPEEDRUN · LOW ORBIT · HIGH ROLLER · CRON JOB · PATCH TUESDAY · CACHE HIT ·
SIDE CHANNEL · STACK OVERFLOW · PIPELINE. **Wildcards (+13):** HOT POTATO · DOUBLE AGENT · CAPTCHA · SANDCASTLE ·
SNAKE OIL · DEAD DROP · THE AUDITOR · ANTIVIRUS · GHOST PROTOCOL · HEX EDITOR · LATENCY · QUANTUM · SUDO.

**Later:** upgrades (FIBER OPTIC, VPN, RAM UPGRADE, BOTNET LICENSE, SSD, OVERCLOCKED CPU) · bosses PHISHER, 2FA,
KERNEL PANIC, TROJAN, BLACKOUT · final boss THE HOUSE (the Dealer unmasked) · hands SMALL STRAIGHT, PARITY, secret
ROOT ACCESS (six of a kind).
