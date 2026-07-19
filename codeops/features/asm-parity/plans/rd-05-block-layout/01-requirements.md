# Requirements & Scope

> **Source**: [RD-05](../../requirements/RD-05-block-layout.md)
> **Implements**: asm-parity/RD-05 · [#51](https://github.com/blendsdk/blend65/issues/51), [#65](https://github.com/blendsdk/blend65/issues/65)

The RD is the owning document for every requirement below; this page states only what the plan
must satisfy and where each obligation is discharged. Nothing here restates the RD's rationale.

## In scope

| Obligation (RD Must-Have) | Discharged by |
|---|---|
| Fall-through elision, all trailing-`JMP` terminators | [03-02](03-02-branch-tail.md) · Phase 3–4 |
| Branch inversion as the *same* decision | [03-02](03-02-branch-tail.md) · Phase 1 (polarity table) + Phase 3–4 |
| Jump threading, chain-following, cycle-safe | [03-01](03-01-il-passes.md) · Phase 2 |
| Unreachable-block removal, reusable, self-loop carve-out | [03-01](03-01-il-passes.md) · Phase 2 |
| Layout unconditional (not `--optimize`-gated) | [03-01](03-01-il-passes.md), [03-03](03-03-relax-branches.md) · Phase 1, 4 |
| Branch relaxation (#65), minted `_rlxN` labels, fixpoint | [03-03](03-03-relax-branches.md) · Phase 1 |
| The twin-byte-comparable raster idiom | [03-04](03-04-corpus-supersession.md) · Phase 4 |
| Printed IL stays honest | [03-01](03-01-il-passes.md) · Phase 4 |
| Four transforms land as ONE change | AR #34 · phase structure, Phase 4 |
| Label-anchored artifacts re-anchored by re-derivation | [03-04](03-04-corpus-supersession.md) · Phase 4 |
| Corpus supersession — goldens, 4 budget windows, **all 15 byte ratchets**, scoreboard | [03-04](03-04-corpus-supersession.md) · Phase 4 |
| Divergence routing updated at its source | [03-04](03-04-corpus-supersession.md) · Phase 4 |
| Per-file oracle dispositions | [03-04](03-04-corpus-supersession.md) · Phase 4 |
| Structural invariants permanently enforced | [07](07-testing-strategy.md) · Phase 5 |
| Closeout delta record | Phase 5 |

Two obligations the RD did **not** enumerate, added by codebase sweep at planning time:

| Gap | Discharged by |
|---|---|
| `run/label-arrivals.spec.test.ts` derives the loop head from `_main`'s elided `JMP` (AR #35) | [03-04](03-04-corpus-supersession.md) · Phase 4 |
| `instr/translate.impl.test.ts` carries three fixtures inversion breaks (AR #36) | [03-04](03-04-corpus-supersession.md) · Phase 4 |

Three more found at preflight, two of which amended the RD itself:

| Gap | Discharged by |
|---|---|
| Every program's `bytes` ratchet in `budgets.json` goes slack — the plan re-derived only the four cycle windows (AR #56) | [03-04](03-04-corpus-supersession.md) §4 · Phase 4 |
| AC-13's invariants saw only the missed-elision half of the tail decision; the missed-**inversion** shape passed both (AR #40, RD amended) | [07](07-testing-strategy.md) ST-B43 · Phase 5 |
| AC-10 named a termination shape that cannot exist under the fixpoint's own monotonicity (RD amended, PF-004) | [07](07-testing-strategy.md) ST-B32 · Phase 1 |

## Out of scope

Block reordering / trace scheduling (AR #27) · peephole pattern rewrites, which are RD-06's
catalog (AR #26) · constant-driven unreachability, which reuses this plan's removal pass rather
than duplicating it (AR #21, #29) · a new corpus fixture for the range cases (AR #32) ·
register allocation, ABI and startup ceremony · collapsing a conditional whose two edges
converge after threading (AR #37).

## Acceptance criteria

The RD's AC-1…AC-13 are the definition of done. They are not restated here; the mapping from
each criterion to the test that proves it is in
[07-testing-strategy.md § Acceptance-criteria coverage](07-testing-strategy.md).

## Definition of done

1. Every AC-1…AC-13 walked against committed artifacts, with evidence quoted in the closeout.
2. Full verify green, including the repo-root boundary tier (R15 / AR-20 holds — neither
   `@blend65/frontend` nor `@blend65/language-server` gains a `@blend65/codegen` import).
3. Local emulator tiers green on VICE 3.10 (fixture, twin, budget-measured).
4. Area report posted on [#51](https://github.com/blendsdk/blend65/issues/51) with per-fixture
   before/after bytes and static cycles; [#65](https://github.com/blendsdk/blend65/issues/65)
   closed with its range evidence.
5. Feature and portfolio roadmaps synced.
