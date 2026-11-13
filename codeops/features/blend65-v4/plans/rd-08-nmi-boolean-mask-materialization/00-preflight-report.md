# Preflight Report — NMI Boolean Mask Materialization

> **Target**: [Plan index](00-index.md) and the full plan set
> **Status**: PASS WITH FIXES — every finding dispositioned before implementation
> **Date**: 2026-11-13

## Method

An independent read-only preflight auditor compared the plan against issue #149, the frozen NMI
contract, the qualified expert references, the real lowering/storage/debug-range seams, and the
cost facts. The auditor did not modify files, run the suite or launch VICE. The spec author
independently wrote the two requirement oracles; its RED run is recorded below and was not used to
derive the implementation.

## Findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | Major | The debug-range bridge resolves a machine block to a semantic block by a fixed label-prefix list; a new `.boolean.` family would throw "Final machine block has no semantic CFG owner". | Fixed: task 2.2.2 adds `.boolean.` to `services/debug-machine-ranges.ts`; the Phase 2 modification set names the file. |
| F2 | Major | The plan claimed the frontend folds the constant word-local comparison and costed 9 bytes from that premise; the frontend's constant rule may not cover a mutable `let`. | Fixed: the design no longer relies on a frontend fold. `lowerBitwise` gains a constant bitwise fold and a zero-mask fold; a materialized constant comparison folds to `LDA #0/#1`. The constant-local elision then yields the 9-byte result by construction. Task 2.2.3 covers both folds. |
| F3 | Major | The 16-bit word-mask negative used a constant local, which the new elision/fold could make buildable, so it did not isolate the wide mask. | Fixed: the negative is a placed word **global** (`place(at: $C100) let w: word = 2`, `w & 258`), so the high byte is runtime-unknown. The spec oracle already uses this shape; `07-testing-strategy.md` is corrected. |
| F4 | Major | `maskValue & read()` is currently retained; `lowerBitwise` commutes only a `storage`/`constant` left, while a placed global mask lowers to a `label`. Extending only the forwarding rule would turn retention into a hard lowering error. | Fixed: tasks 2.2.5 and 2.2.6 extend the byte bitwise commute to a directly addressable `label`/`static-address` left operand **and** the platform-to-bitwise rule to the mirrored order; the impl test pins the mirrored runtime mask. |
| F5 | Major | AR-M9 and acceptance #9 named Timer B mask 8 `!=` and Timer A mask 3 `==`, which would publish 0; the testing strategy named Timer A mask 3 `!=` and Timer A mask 8 `==`, which publish 1. | Fixed: AR-M9 and acceptance #9 now use Timer A mask `3` `!=` (bit 0 set → true) and Timer A mask `8` `==` (serial bit clear → true). Both observe `$C000 = 1`. |
| F6 | Major | The elided-local carrier is a `Set<string>` and the load lowering unconditionally claims A. A constant-initialized local whose store emitted nothing would be treated as living in A. | Fixed: the design states the load resolves the single preceding store's value from `state.values`; a constant initializer yields the constant, a read initializer keeps the A claim. The store lowering asserts A only for a non-constant initializer. No kind plumbing is added. |
| F7 | Major | A computed/non-addressable mask and a masked value compared to a nonzero constant still fail `E10245` but were not in the residual list, ledger row or follow-up owner. | Fixed: both join the residual list, the ledger `sourceForm`, the probes and the follow-up issue. |
| F8 | Minor | The index said 0/28 while the execution plan said 30. | Fixed: 0/30 everywhere; task 1.1.2 produces the preflight report. |
| F9 | Minor | ST-M1 did not declare the mask/word placements, so the pinned byte totals were ambiguous. | Fixed: ST-M1 declares `maskValue` at `$C001` and the word global at `$C100`. |
| F10 | Minor | The current-state seam table called guarded shifts a block splitter. | Fixed: it cites checked division, variable shift, aggregate fill/copy and indirect dispatch. |
| F11 | Minor | "Same pattern as checked division" understated that the Boolean splitter must suppress normal comparison lowering. | Fixed: the design states the splitter bypasses `lowerComparison` and sets the result value itself. |
| F12 | Minor | The impl-case list referred generally to "a mirrored zero-test operand order that the lowering cannot serve". | Fixed: the only unserved mirrored case is the mask-`1` identity; the delivered masks `8+` accept either zero-test side. The general phrase is removed. |

## Oracle RED evidence

The implementation-blind spec author wrote `test/rd08/nmi-boolean-mask-materialization.spec.test.ts`
(14 positive forms × 4 profiles, 4 residual negatives × 4) and
`test/rd08/nmi-boolean-mask-materialization-vice.spec.test.ts` (two sequential Timer A cases). The
baseline run was:

```text
Test Files  1 failed (1)
Tests       56 failed | 16 passed (72)
```

Every positive failure carried exactly one `E10245`; all 16 negative runs passed with the canonical
diagnostic and no generation. The VICE file was not run at baseline because its positives cannot
build yet.

After the audit-driven extension the final oracle has 17 positives and 6 negatives (92 tests). The
three added positives are the word mask `1` identity, the constant byte local plus mask `8`, and the
all-ones mask; the two added negatives are the computed runtime mask and the nonzero-constant
comparison.

## Residual risk

- The branch splitter touches the machine block close and debug-range bridge; the complete suite and
  the debug decode oracle are the guard.
- The constant folds change mainline output for `x & 0` and constant comparisons; pinned optimizer
  artifacts must be inspected, not silently updated.
- The runtime and word forms have byte evidence only; the branch shape is shared with the VICE
  cases, but the operand source differs.

## Gate verdict

**PASS WITH FIXES** — every critical and major finding is dispositioned; implementation may start.
