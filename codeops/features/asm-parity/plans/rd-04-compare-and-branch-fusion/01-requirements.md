# Requirements: RD-04 Compare-and-Branch Fusion

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-compare-and-branch-fusion.md) — the OWNING requirements doc

## Scope of this plan (delta view)

### In this plan

All RD-04 Must-Haves, both Should-Haves (plan-AR #7):

- Fused `brcmp` terminator (req-AR #23; final name plan-AR #4) — 03-01
- All framings branch directly (five framings, both polarities/operand orders) — 03-02
- Condition-position lowering (`if`/`while`/`do-while`/`for`/`switch` dispatch; `!` swap,
  `&&`/`||` slot-free short-circuit edges, materialize+`brcond` fallback; req-AR #22) — 03-03
- SFA slot preorder updated in step (structural definition per the RD; R15 untouched) — 03-03
- Boolean-literal fold at lowering (req-AR #21) — 03-03
- Value contexts keep materialization; boolean reads keep `brcond`; MMIO discipline — 03-02/03-03
- Dangling-terminator-target translation ICE (plan-AR #2) — 03-01
- Corpus supersession, same change (req-AR #24, #12, #17) — 03-04
- Acceptance shapes in named homes + the `guards` fixture pair (plan-AR #5) — 03-04, 07
- Should-Have word-framing simplification (inherent to the fused framings) — 03-02
- Should-Have closeout delta record (measured, per plan-AR #1) — 99 Phase 5

### Deferred / out of this plan

The RD's Won't-Haves, unchanged: 3-instruction idiom → RD-05/#51 (req-AR #20);
computed-constant folding → const-fold pass (req-AR #21); branch relaxation → #65/#51
(req-AR #25); `?:` special lowering; peephole/ABI work.

## Plan-local decisions

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Phase structure — fixture authored before the flip; flip atomic (lowering + SFA + supersession); staging fallback unused | 5 phases, see 99 | plan-AR #1 |
| Dangling-target ICE placement | Translation-start pre-pass + shared `terminatorTargets()` | plan-AR #2 |
| Branch-context recursion home | `lower.ts`, in place | plan-AR #3 |
| Terminator name | `brcmp` | plan-AR #4 |
| Fixture name | `guards` | plan-AR #5 |
| Verify command | CLAUDE.md verify chain (+ local VICE tiers where assets are emulator-verified) | plan-AR #6 |
| Should-Have scope | Both in | plan-AR #7 |

## Acceptance Criteria

The RD owns AC-1…AC-10. Plan-local additions only:

1. [ ] The `guards` fixture's pre-flip baseline (golden, budgets, scoreboard row) is committed
   before phase 4 and superseded by it — the delta record quotes the measured pair (plan-AR #1).
2. [ ] Termination analysis enumerates `brcmp` successors via the shared helper — no terminator
   kind can contribute zero successors unnoticed (plan-AR #2).
3. [ ] Every phase boundary is verify-green per plan-AR #6.
