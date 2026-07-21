# Requirements: Alignment Granularity

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-15](../../requirements/RD-15-alignment-granularity.md) — the OWNING requirements
> document. Its Must-Haves, Won't-Haves, fifteen acceptance criteria and scope decisions are not
> restated here.

## Scope of this plan (delta view)

### In this plan

| RD-15 item | Lands in | One-line gloss |
|---|---|---|
| **M1** | Phase 2 | the fold shape with normalized shift 6 registers a 64-byte demand; everything else registers 256 |
| **M2** | Phase 2 | coarsest-wins keeps a symbol that also carries `hi(&X) * 4` on a page |
| **M3** | Phase 1 | the mark carries a value rather than a flag, and an entry with no demand carries no boundary |
| **M4** | Phase 2 | three fold-form oracles re-derived; three bare-`&` oracles kept untouched as the control |
| **M5** | Phase 3 | RD-13's contradicted prediction corrected |
| **AC-1 … AC-15** | Phases 2–3 | all fifteen; AC-10, AC-11 and AC-14 discharge at closeout by measurement and review rather than by a test |

### Deferred / out of this plan

| Item | Why |
|---|---|
| RD-15's **Should-Have** — the granularity allowlist sourced from the platform | Pulls `@blend65/compiler` into the blast radius for zero behaviour change; C64 contributes the only granularity that exists. Stays an RD Should-Have (AR #119) |
| Everything in RD-15's **Won't Have** | Unchanged by this plan — in particular the mutable-aggregate hazard, which is [#74](https://github.com/blendsdk/blend65/issues/74)'s and is *pinned as inert* here by AC-15 rather than fixed |

## Plan-local decisions

Everything the plan decided that the RD did not is in
[00-ambiguity-register.md](00-ambiguity-register.md) — AR #113 (how the demand reaches the mark
site and where the allowlist lives), #114 (the context field's name), #115–#117 (fixture location,
suite file, test tier), #118 (phase structure), #119 (the Should-Have), #120 (the verify command).

## Plan-local acceptance criteria

RD-15 owns the fifteen acceptance criteria. These three are additional, and exist because this
plan's phase split makes claims the RD does not:

1. [ ] **P-1 — Phase 1 moves no bytes.** After the data-shape migration and before the 64 demand
   exists, every committed golden is byte-identical, `budgets.json` is unchanged, no ratchet moves,
   `SCOREBOARD.md` is unchanged, and the three fold-form oracles still assert `% 256` — *untouched*
   — and still pass. This is what buys the split its keep (AR #118).
2. [ ] **P-2 — The reshape weakens no negative case.** Every one of the twelve `pageAligned`
   assertions in `lower-address-of.spec.test.ts` that reads `false` today becomes an assertion that
   the entry carries **no boundary at all**, not an assertion that it carries 256. The distinction
   is the suppression predicate M3 introduces, and a reshape that flattened it would leave the
   by-reference membership rule (AC-7) pinned by nothing.
3. [ ] **P-3 — No boundary value outside `{64, 256}` is representable.** Not asserted in a test but
   in the type: `AlignBoundary` is the declared type of the parameter, the map value and the
   `ConstDataEntry` field, so a third value is a compile error at every producer (AR #113).
