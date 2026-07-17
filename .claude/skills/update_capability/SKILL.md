---
name: update_capability
description: >
  Re-score and maintain the C64 game feasibility matrix against the compiler's CURRENT capability
  state, and add/remove games. The data lives in docs/game-feasibility-matrix.json (source of
  truth); docs/game-feasibility-matrix.html is generated from it. Use for "update_capability",
  "/update_capability", "refresh the feasibility matrix", "re-score the game matrix", "add <game>
  to the matrix", or "remove <game> from the matrix". Manual only — the matrix is never auto-updated.
---

# update_capability — feasibility matrix keeper

Maintains the **C64 game feasibility matrix**: a strict, capability-grounded assessment of whether
100 well-known C64 games are buildable with Blend65 **today**.

The model is **capability-based**. Each game lists the **capabilities it needs**; each capability
sits in a **tier** (available / planned / unplanned); a game's **Buildable** verdict falls out of the
two. The matrix is **data + a renderer**, not a hand-edited document:

- **`docs/game-feasibility-matrix.json`** — the **single source of truth**. Games, the capability
  status board, the "how to read" rubric, and the prioritization prose live here. This skill edits
  *only this file*.
- **`scripts/gen-capability-matrix.mjs`** — the renderer. It validates the JSON, computes every
  derived number (each game's verdict, the Now/Soon/Blocked tallies, the per-capability unlock
  counts), and writes the HTML. Run it after every edit: `node scripts/gen-capability-matrix.mjs`
  (or `yarn gen:matrix`).
- **`docs/game-feasibility-matrix.html`** — the **generated** interactive output. Never hand-edited.

It is **manual** — run it deliberately; nothing triggers it automatically. The JSON's `intro`,
`howToRead`, and `capabilities` sections are the source of truth for the rubric; this skill applies
it. If the skill and the file ever disagree on a definition, the file wins.

## The model (how a verdict is decided)

A game is scored by **which capabilities it needs** and **what tier each of those is in**:

- **Now** (✅) — the game needs nothing that isn't already `available`.
- **Soon** (🟡) — the only capabilities it's missing are `planned`.
- **Blocked** (❌) — it needs at least one `unplanned` capability.

The verdict is **computed by the generator** from `needs` + each capability's `tier`. You never set a
verdict directly — you set the **needs** (per game) and the **tiers** (per capability), and the
verdict follows. **This is the lever: flip one capability's tier and every game that needs it
re-scores at once.**

## Data shape (what you edit)

A capability (in `capabilities[]`):

```json
{ "id": "optimizer", "name": "Optimizer (speed)", "tier": "planned",
  "blurb": "A cycle-budget optimizer. Unlocks smooth scrolling and sprite multiplexing." }
```

A game (in `games[]`):

```json
{ "n": 19, "title": "Ghosts 'n Goblins", "year": 86, "publisher": "Elite",
  "category": "Platform", "archetype": "hscroll run-and-gun",
  "needs": ["optimizer"], "diff": "L", "conf": "known" }
```

- **`tier`** (per capability): `available` | `planned` | `unplanned` (ids from `tiers`).
- **`needs`** (per game): an array of capability `id`s from `capabilities`. Empty ⇒ buildable Now.
  Only list capabilities that are *essential* for a faithful build — never a `available` one (that
  adds noise; nothing is blocked on it). Memory pressure that fits with effort is a difficulty
  concern, not a need; data that genuinely exceeds RAM needs `graphics-loading`.
- **`conf`**: `known` | `inferred` | `low` (from `scales.confidence`).
- **`diff`**: `S` | `M` | `L` | `XL` (from `scales.diff`).

The generator **rejects** an unknown capability id, a bad tier/conf/diff value, a non-contiguous `n`,
or a duplicate title — and writes nothing until you fix it. Trust it as your validator.

## Modes (detect from the argument)

| Invocation | Mode |
|---|---|
| `/update_capability` (no args) | **rescore** — re-derive capability tiers, adjust needs, re-tally |
| `/update_capability add "<Game> (yr, pub)" [category]` | **add** — assess and insert one game |
| `/update_capability remove <#\|name>` | **remove** — delete a row, renumber |
| `/update_capability --check` (or `--dry-run`) | **check** — preview edits + validate; write no HTML |

`--check` composes with any mode.

## Governing rules (all modes)

1. **Strict faithfulness bar — no sugarcoating.** `Now` means the original *as played*: right engine,
   right controls, clean in-language audio, no missing essentials, **no hand-poked machine-code
   bytes**. A reduced-scope demake is not `Now`. Never inflate a verdict.
2. **Needs anchor on engine archetype, then adjust for the title.** The archetype is the real
   feasibility driver. Do not invent per-title cycle-counts you cannot defend.
3. **Confidence honesty.** Set `conf` to `known` only when the title's internals are genuinely known;
   otherwise `inferred` or `low`. Never mark `known` to hide uncertainty.
4. **Tiers are the lever; move them only on real evidence.** A capability's tier changes only when the
   compiler's actual state changes (a capability ships → `available`; work gets scheduled →
   `planned`). Flipping a tier re-scores every game that needs it — that is the whole point.
5. **Audio footnote is global, not per-row.** In-language SID music/SFX is the `sound-music`
   capability (available). A byte-faithful ripped `.sid` tune needs `indirect-calls` — this lives in
   `notes`; do not add `indirect-calls` to a row *solely* for the original soundtrack.
6. **Determinism.** Same capability tiers + same game needs ⇒ same verdicts, byte for byte. Two people
   running `rescore` on an unchanged baseline must produce no diff.
7. **Edit the JSON, never the HTML.** Keep the JSON's sections and keys intact. The HTML is
   overwritten on the next run.

## Step 1 — Re-derive the capability status board (every mode except pure `remove`)

Read the current state from disk and update each capability's `tier` in `capabilities[]`:

- **Optimizer** — read `codeops/features/blend65-ri/00-roadmap.md`. Has the Phase B optimizer (real
  peephole/IL passes) landed? If yes → `available`; if actively scheduled → keep `planned`.
- **Graphics / data loading** (`DISK`) — any disk I/O / loader / KERNAL-call / streaming path shipped?
- **Math** — any floating-point or fixed-point-library support shipped?
- **Hand-tuned asm** — external asm linking (was `FUT-011`) shipped?
- **Indirect calls** — function pointers / indirect calls (was `FUT-003`) shipped? Check
  `spec/06-functions.md` and grep for indirect-call lowering.
- **Sound (sampled), Joystick, Compiler** — confirm their tiers still hold (compiler is `available`
  since RD-18 closed).

If a capability's tier changed, that is what re-scores rows. **This is the whole point.**

## Step 2 — Adjust game needs (mode `rescore`, or the affected rows in `add`)

Usually Step 1 does the work (a tier flip re-scores automatically). Only touch `games[].needs` when:

1. A game's *archetype-driven* required capabilities were wrong or incomplete.
2. A new title is being assessed (mode `add`).
   Re-derive needs from the archetype: which capabilities are *essential* for a faithful build, and
   are any of them not `available`? List those ids. Never regress a need without a reason that traces
   to a real capability change.

## Step 3 — add / remove

- **add**: research the game's engine archetype (be honest about `conf`), set its `needs` per the
  rubric, insert it in its category grouping, and renumber `n` contiguous from 1. If the list already
  holds 100, ask the user whether to grow past 100 or swap out a game.
- **remove**: delete the row by `n` or title, renumber `n` from 1.

## Step 4 — Regenerate (mandatory after any content change)

Run the renderer:

```
node scripts/gen-capability-matrix.mjs        # writes the HTML
node scripts/gen-capability-matrix.mjs --check # validate + print counts, write nothing
```

It **recomputes every derived number** — each game's Now/Soon/Blocked verdict, the summary tallies,
and the per-capability unlock counts — so you never tally by hand. If it reports a validation error,
fix the JSON and re-run. Bump `meta.lastUpdated` to today's date in the JSON before the final run
(read the session's current date; never fabricate one).

## Step 5 — Report

Summarize what changed: which capability tiers moved and why (trace each to a disk-state delta), which
games therefore re-scored, new/removed games, and the before→after Now/Soon/Blocked counts printed by
the generator. In `--check` mode, report the same as a preview and leave the HTML untouched. Never
commit — leave the diff for the user (`git diff docs/game-feasibility-matrix.json`; the HTML
regenerates deterministically).

## Guardrails

- If `docs/game-feasibility-matrix.json` is missing, STOP and report it — do not recreate it from
  scratch (its 100 curated rows and per-title confidence are not reconstructible here).
- Do not touch `spec/` (frozen, D3) or any compiler code — this skill edits one JSON file and runs
  the renderer.
- If a verdict change would be large or surprising (e.g. a whole tier of games flips), surface it in
  the report with the evidence rather than applying it silently.
