# Implementation Plan: Block Layout — Fall-Through Elision + Jump Threading

> **Implements**: asm-parity/RD-05
> **Source**: [RD-05](../../requirements/RD-05-block-layout.md)
> **Issue**: [#51](https://github.com/blendsdk/blend65/issues/51) · also closes [#65](https://github.com/blendsdk/blend65/issues/65)
> **Status**: Plan Preflighted (27 findings applied — see [00-preflight-report.md](00-preflight-report.md))
> **Created**: 2026-07-19 · **Preflighted**: 2026-07-20
> **Routing tag**: complex (Phase 4: sensitive)
> **CodeOps Skills Version**: 3.10.0

---

## What this delivers

The emitter stops writing jumps a hand-coder would never write. Five changes:

| # | Transform | Seam | New module |
|---|-----------|------|------------|
| 1 | **Branch relaxation** — an out-of-reach conditional becomes an inverted short branch over an absolute jump | new unconditional post-translation stage | `codegen/src/instr/relax-branches.ts` |
| 2 | **Jump threading** — a branch onto a jump-only block retargets to that block's destination | IL pass | `codegen/src/il/optimizer/thread-jumps.ts` |
| 3 | **Unreachable-block removal** — a reachability walk from each function's entry (and the module-init roots) | IL pass | `codegen/src/il/optimizer/remove-unreachable-blocks.ts` |
| 4 | **Fall-through elision + branch inversion** — ONE tail decision, not two transforms | translation time | `codegen/src/instr/branch-tail.ts` |
| 5 | **Corpus supersession** — goldens, four budget windows, all fifteen byte ratchets, label re-anchors, routing, scoreboard | — | — |

Corpus baseline, re-derived independently at planning time and matching the RD exactly:
**105 `JMP`s, 47 of them intra-function fall-through across 9 of 14 goldens, 13 trampoline
blocks.** `guards` emits 23 jumps against its twin's 1.

## Document map

| Document | Owns |
|----------|------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | The plan-stage gate: AR #34–#39, plus AR #40–#57 from the preflight (design decisions AR #26–#33 live with the RD) |
| [00-preflight-report.md](00-preflight-report.md) | The post-creation audit: 27 findings across 13 dimensions, all resolved |
| [01-requirements.md](01-requirements.md) | Scope, the 13 acceptance criteria, what is explicitly out |
| [02-current-state.md](02-current-state.md) | The code as it stands: the four emission sites, the three seams, every artifact this change invalidates |
| [03-01-il-passes.md](03-01-il-passes.md) | `threadJumps` + `removeUnreachableBlocks` |
| [03-02-branch-tail.md](03-02-branch-tail.md) | The tail decision + polarity table + its wiring into the block loop |
| [03-03-relax-branches.md](03-03-relax-branches.md) | The relaxation stage |
| [03-04-corpus-supersession.md](03-04-corpus-supersession.md) | Goldens, budgets, label re-anchoring, routing, scoreboard |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-* specification test cases + the verification ladder |
| [99-execution-plan.md](99-execution-plan.md) | 5 phases, the task checklist, progress |

## Delivery shape (AR #34)

The four layout transforms must land as **one** corpus change, but every phase must verify
green. The resolution is to build unwired and wire once:

```
P1  relaxBranches + range fixtures     → WIRED. Goldens must be byte-unchanged.
    …plus invertBranch + the polarity oracle, because relaxation consumes them.
P2  threadJumps + removeUnreachable    → unwired; driven directly by their spec suites.
P3  branch-tail decision (planBranchTail) → unwired, on top of Phase 1's polarity table.
P4  wire everything, re-anchor, regenerate the corpus   ← the single corpus commit
P5  permanent invariant scan, AC walk, closeout
```

Phase 1 is wired first precisely *because* it changes nothing: no fixture in the repo has ever
carried an out-of-reach branch, so a golden that moves a byte in Phase 1 means relaxation is
wrong. It also puts the sole range authority in place before inversion can create an
out-of-reach branch.

`branch-tail.ts` therefore lands in **two parts** (AR #42): relaxation needs `invertBranch`, so the
polarity table and its oracle (ST-B20, ST-B21) are Phase 1 work — red before the implementation —
while `planBranchTail` and the tail-decision cases follow in Phase 3.

## Known weakness, stated up front

The adjacency computation inside the translator's block loop receives no live evidence until
Phase 4, and a mistake there fails as a **silently missed transform**, not a red test. Phase 5's
committed corpus-invariant scan is the structural answer, and it covers **both** polarities of that
mistake: a missed elision leaves an intra-function fall-through jump (ST-B39) or a trampoline block
(ST-B40), and a missed *inversion* leaves a conditional branch over an unconditional jump to the
next label (ST-B43, added at preflight — the two original invariants saw only the elision half).
All three hold for this change and for every fixture added after it, with a non-vacuity check
(ST-B44) so a marker-format drift cannot make the scan pass by parsing nothing.

## Verify

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

The emulator tiers (`skipIf(!hasVice() || !hasAcme())`) do not run in CI. VICE 3.10 and ACME
0.97 are present on this machine, so Phases 1, 4 and 5 include local-tier tasks that CI cannot
perform — in particular the balloon `frameUpdate` **measured** re-measurement.
