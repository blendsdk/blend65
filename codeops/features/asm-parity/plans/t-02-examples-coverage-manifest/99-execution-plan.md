# Task T-02: Examples coverage manifest + completeness gate

> **Type**: Task (lightweight) · **Feature**: asm-parity · **CodeOps Skills Version**: 3.11.0
> **Progress**: 5/5 tasks (100%) — ✅ complete 2026-07-21
> **Created**: 2026-07-21

## Objective

Make it impossible to add an `examples/` program that nothing verifies.

`examples/balloon-color` spent its entire life referenced by nothing in `packages/`, `test/`,
`scripts/` or `.github/`, and `examples/boing-ball` landed the same way. Both were found by grep,
not by a failing test. Slice fixtures arrive with a whole harness; demos get added ad-hoc, and
nothing forces a coverage decision at add-time.

A committed manifest assigns every example a coverage tier, and a spec test asserts two things:
the manifest and the directory listing agree exactly, and every example carries the artifacts its
tier claims. Adding a program without choosing a tier fails CI.

## Scope

**In:** the manifest, the completeness gate, and tiers for all 18 current examples.

**Out:** adding goldens, twins or budget ratchets to anything (the demos' own headers opt out of
all three on purpose); building examples in the gate (T-01/[#55](https://github.com/blendsdk/blend65/issues/55)
makes a relative `--out-dir` fail, and per-example build coverage belongs to each example's own
suite); a hand-written twin for `boing-ball` (RD-sized — see the follow-up note below).

## Tiers

Derived from what each example actually has today, not from intent.

| Tier | Obligations the gate enforces | Members |
|---|---|---|
| `corpus` | `<n>.asm.golden` + `<n>.twin.asm` + a `budgets.json` program + a `twins.json` pair | `gate`, `guards`, `rasterpoll`, `slice3a`, `slice3b`, `slice4a`, `slice4b`, `slice5a`, `slice5b`, `slice6`, `slice7`, `slice7b`, `slice8`, `slice8b` |
| `measured` | a `budgets.json` program + a `twins.json` pair + a twin **inside its own example directory**; explicitly **no** golden | `balloon` |
| `probe` | a suite **named in the manifest** and present on disk; explicitly no golden, no twin, no budget | `align-mixed` |
| `demo` | a suite **named in the manifest** and present on disk; explicitly no golden, no twin, no budget | `balloon-color`, `boing-ball` |

`balloon` is `measured` rather than `corpus` because it has a twin and a ratchet but no committed
golden — the exact gap that leaves its page alignment watched by one assertion. Recording that as a
named tier makes the gap visible instead of implicit.

`balloon-color` and `boing-ball` acquire their `demo` suites in RD-13 Phase 4. Until then the
manifest records the tier they are *moving to*, and the gate's suite obligation for `demo` is the
one check enabled last — see task T-02.3.

## Tasks

- [x] T-02.1 Write `packages/test-harness/src/examples-coverage.spec.test.ts` — RED. It asserts:
      (a) every `examples/*/` directory appears exactly once in the manifest and vice versa, with
      the diff named in the failure message; (b) each tier's artifact obligations from the table
      above hold, including the **negative** ones (a `demo` must not have a golden). Header
      documents the tiers in plain language, with no plan, task or requirement ID
- [x] T-02.2 Author `packages/test-harness/test/golden/examples-coverage.json` beside its sibling
      ledgers `budgets.json` and `twins.json`, with all 18 examples tiered — GREEN
- [x] T-02.3 Enable the `demo` suite obligation only for tiers that already have one; leave a
      recorded exemption for `balloon-color` and `boing-ball` that RD-13 Phase 4 removes when it
      adds their suites. The exemption is a named list in the manifest, not a silent skip
- [x] T-02.4 **Seed and watch fail** — four ways in the end, the fourth added during execution:
      an `examples/` directory absent from the manifest; a manifest row naming a directory that does
      not exist; a `corpus` row whose golden is missing; and a `demo` that silently acquires a
      golden. Each must fail loudly and name the offender. Restore after each
- [x] T-02.5 Full verify; roadmap sync

**Verify**: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Follow-up this task deliberately does not do

`boing-ball` is the closest thing in the repo to real game code — multicolor sprites, pointer-swap
animation, bounds logic — while the parity corpus is 14 synthetic slices plus `balloon`. A
hand-written twin for it would be the most informative addition to the scoreboard since the corpus
was built, and it is RD-sized work, not a task. **Filed 2026-07-21 as
[#72](https://github.com/blendsdk/blend65/issues/72)** and tracked as RD-16; not started here.

One sequencing note carried into that issue: `boing-ball` still uses `hi(&BALL) * 4`, and RD-13
migrates it to `lo(&BALL / 64)`, which moves its bytes. The twin must be authored **after** that
lands or the pair is stale on arrival.

## Outcome

Green on the first full verify (EXIT=0, 33 test files). Seven assertions across two suites.

Two things changed during execution and are worth recording:

- **The "has a suite" obligation was re-scoped, and the first mechanism was wrong.** The suite was
  first inferred by scanning every `*.spec.test.ts` for the string `examples/<name>`. That reported
  thirteen corpus fixtures as unverified, which was false — fixtures are reached through inlined
  source constants and joined paths that never spell the directory. The obligation now applies only
  to `probe` and `demo`, the two tiers with no golden, ratchet or scoreboard pair to reach them, and
  the suite is **named in the manifest** rather than inferred. Explicit beats clever here: the
  inferred version was wrong in the safe direction this time and would have been wrong in the unsafe
  direction the moment a fixture happened to mention a path.
- **A prefix bug in the first draft.** `examples/balloon` is a prefix of `examples/balloon-color`,
  and `slice7` of `slice7b`, so a substring match credited the shorter name for the longer one's
  mention. Removed with the scanning approach, but it is why the scan went.

All four failure modes were seeded and watched to fail, each naming its offender:

| Seeded | Message |
|---|---|
| an `examples/` directory absent from the manifest | names the undeclared directory |
| a manifest row naming a directory that does not exist | names the phantom |
| a `corpus` fixture whose golden is missing | `slice6 is corpus but has no committed golden` |
| a `demo` that silently acquires a golden | `boing-ball is demo but has a golden — change the tier deliberately` |

`balloon-color` and `boing-ball` sit in `pendingSuite` with stated reasons; RD-13 Phase 4 removes
both entries when it adds their suites. Emptying that list is the goal, not a formality.
