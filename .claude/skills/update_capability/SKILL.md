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
100 well-known C64 games are buildable with Blend65, at RD-18 close (unoptimized) and after Phase B.

The matrix is **data + a renderer**, not a hand-edited document:

- **`docs/game-feasibility-matrix.json`** — the **single source of truth**. Every row, the capability
  baseline, the legend, the "how to read" rubric, and the prioritization prose live here. This skill
  edits *only this file*.
- **`scripts/gen-capability-matrix.mjs`** — the renderer. It validates the JSON, computes every
  derived number (the summary ✅/⚠️/❌ tallies and the prioritization-inversion counts), and writes
  the HTML. Run it after every edit: `node scripts/gen-capability-matrix.mjs` (or `yarn gen:matrix`).
- **`docs/game-feasibility-matrix.html`** — the **generated** interactive output. Never hand-edited.

This skill re-scores rows against the *current* capability state and adds/removes games. It is
**manual** — run it deliberately; nothing triggers it automatically.

The JSON's `intro`, `howToRead`, `baseline`, and `legend` sections are the source of truth for the
rubric. This skill applies that rubric; if the skill and the file ever disagree on a definition, the
file wins.

## Data shape (what you edit)

Each game is one object in `games[]`:

```json
{ "n": 10, "title": "Bubble Bobble", "year": 87, "publisher": "Firebird",
  "category": "Platform", "archetype": "single-screen (2P)",
  "rd18": "caveated", "phaseB": "clean",
  "blockers": ["MUX"], "pathTo100": "OPT", "diff": "L", "conf": "known" }
```

- **Verdict keys** (`rd18`, `phaseB`): `clean` | `caveated` | `blocked` — NOT glyphs. The renderer
  maps them to ✅/⚠️/❌.
- **Confidence key** (`conf`): `known` | `inferred` | `low` (→ ✅/⚠️/🔴).
- **Difficulty** (`diff`): `S` | `M` | `L` | `XL`.
- **`blockers`**: an array of codes from `legend.blockerCodes`. A trailing qualifier is allowed
  (`"SAMPLE(minor)"`, `"SCROLL(soft)"`); the base code before `(` must be a known code.
- **`pathTo100`**: free text (`""` renders as `—`).

The generator **rejects** an unknown code, a bad verdict/conf/diff value, a non-contiguous `n`, or a
duplicate title — and writes nothing until you fix it. Trust it as your validator.

## Modes (detect from the argument)

| Invocation | Mode |
|---|---|
| `/update_capability` (no args) | **rescore** — re-derive the baseline, re-score every row |
| `/update_capability add "<Game> (yr, pub)" [category]` | **add** — assess and insert one game |
| `/update_capability remove <#\|name>` | **remove** — delete a row, renumber |
| `/update_capability --check` (or `--dry-run`) | **check** — preview edits + validate; write no HTML |

`--check` composes with any mode (e.g. `add ... --check`).

## Governing rules (all modes)

1. **Strict faithfulness bar — no sugarcoating.** `clean` (✅) means the original *as played*: right
   engine, right controls, clean in-language audio, no missing essentials, **no hand-poked
   machine-code bytes**. A reduced-scope demake is `caveated`, never `clean`. Never inflate a verdict
   to look encouraging.
2. **Verdicts anchor on engine archetype, then adjust for the title.** The archetype is the real
   feasibility driver (see `legend.archetypeTerms`). Do not invent per-title cycle-counts you cannot
   defend.
3. **Confidence honesty.** Set `conf` to `known` only when the title's internals are genuinely known;
   otherwise `inferred` (archetype-inferred) or `low`. Never mark `known` to hide uncertainty.
4. **Two columns, one meaning each.** `rd18` = clean in-language build the day RD-18 closes (codegen
   unoptimized). `phaseB` = same, after the Phase B optimizer. The optimizer improves
   *performance-bound* verdicts only — it NEVER clears a hard capability gap (`DISK`, real-time
   `FLOAT`/3D, `FUT-011`, `FUT-003`). If a row is `blocked` at RD18 and its only blockers are perf
   (`SCROLL`/`MUX`/`OPT`), it becomes `caveated` (occasionally `clean`) at PhaseB; if it stays
   `blocked` at PhaseB, a hard gap is the reason.
5. **Audio footnote is global, not per-row.** In-language music/SFX is clean; a byte-faithful ripped
   `.sid` tune needs `FUT-003`. This lives in `baseline.audioNote` — do not add a `FUT-003` blocker
   to a row *solely* for the original soundtrack.
6. **Determinism.** Same capability baseline + same game list ⇒ same verdicts, byte for byte. Two
   people running `rescore` on an unchanged baseline must produce no diff.
7. **Edit the JSON, never the HTML.** Keep the JSON's sections and keys intact. Do not hand-edit the
   generated HTML — it is overwritten on the next run.

## Step 1 — Re-derive the capability baseline (every mode except pure `remove`)

Read the current state from disk and update the JSON's `baseline` (`rows[]` and `asOf`):

- **RD-18 slice progress + Phase B** — read `codeops/features/blend65-ri/00-roadmap.md` and any active
  plan's `99-execution-plan.md`. Confirm which slices are Done and whether Phase B (IL optimizer
  passes / peephole rules) has started.
- **Language capability gaps** — check whether the deferred items have shipped:
  - `FUT-003` (indirect calls / function pointers): does `spec/06-functions.md` still say deferred?
    grep the codebase for any indirect-call lowering.
  - `FUT-011` (external asm linking), `DISK` (any disk I/O / loader / KERNAL-call path), `FLOAT` (any
    floating-point or fixed-point-library support).
- If a gap has closed since `meta.lastUpdated`, update its `baseline` row and note it. **This is the
  whole point** — a closed gap is what re-scores rows.

## Step 2 — Re-score (mode `rescore`, or the affected rows in `add`)

For each `games[]` row, re-apply the rubric against the refreshed baseline:

1. Determine the archetype → its intrinsic blockers (perf vs hard-gap).
2. Set `rd18` and `phaseB` per rule 4. A capability that shipped in Step 1 clears its code everywhere
   it appears (e.g. if `DISK` ships, every `DISK`-blocked row is re-evaluated).
3. Update `blockers` (what stands between the current column and `clean`) and `pathTo100` (the
   milestone that makes a byte-faithful build `clean`).
4. Leave `diff` and `conf` unless new information changes them. Difficulty is implementation effort
   (S/M/L/XL), independent of feasibility.
5. **Never regress a verdict without cause.** If the baseline did not change, the verdict must not
   change. Any change must trace to a Step-1 baseline delta.

## Step 3 — add / remove

- **add**: research the game's engine archetype (be honest about `conf`), assign all fields per the
  rubric, insert it in its category grouping, and renumber `n` so the array stays contiguous from 1.
  If the list already holds 100, ask the user whether to grow past 100 or swap out a game.
- **remove**: delete the row by `n` or title, renumber `n` from 1.

## Step 4 — Regenerate (mandatory after any content change)

Run the renderer:

```
node scripts/gen-capability-matrix.mjs        # writes the HTML
node scripts/gen-capability-matrix.mjs --check # validate + print counts, write nothing
```

It **recomputes every derived number** — the summary ✅/⚠️/❌ tallies and the inversion counts
(a title is gated by a code if the code appears in its `blockers` or `pathTo100`) — so you never tally
by hand. If it reports a validation error, fix the JSON and re-run. In `--check` and `--dry-run`
modes, run it with `--check` (no HTML written). Bump `meta.lastUpdated` to today's date in the JSON
before the final run (read the session's current date; never fabricate one).

## Step 5 — Report

Summarize what changed: baseline deltas, which rows moved and why (trace each to a baseline change),
new/removed games, and the before→after summary counts printed by the generator. In `--check` mode,
report the same as a preview and leave the HTML untouched. Never commit — leave the diff for the user
to review (`git diff docs/game-feasibility-matrix.json`; the HTML regenerates deterministically).

## Guardrails

- If `docs/game-feasibility-matrix.json` is missing, STOP and report it — do not recreate it from
  scratch (its 100 curated rows and per-title confidence are not reconstructible here).
- Do not touch `spec/` (frozen, D3) or any compiler code — this skill edits one JSON file and runs
  the renderer.
- If a verdict change would be large or surprising (e.g. a whole category flips), surface it in the
  report with the baseline evidence rather than applying it silently.
