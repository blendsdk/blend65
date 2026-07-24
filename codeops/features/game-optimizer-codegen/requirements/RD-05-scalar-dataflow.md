# RD-05: Scalar and Dataflow Optimization

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-02–RD-04
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Implement the core value optimizer over the derived overlay: sparse conditional constant
propagation, copy/value propagation, folding, range analysis, common-subexpression elimination,
dead-value removal and algebraic/bitwise simplification with exact 8/16-bit semantics.

## Functional Requirements

### Must Have

- [ ] Perform sparse conditional constant propagation across branches, merges and direct-call
  summaries.
- [ ] Propagate copies, constants, ranges and known bits without crossing effect/alias barriers.
- [ ] Fold byte/sbyte/word/sword arithmetic, comparisons, shifts, casts and intrinsics according to
  exact wrap/sign/evaluation rules.
- [ ] Apply local/global value numbering and CSE only when operands, memory version, effects and
  termination behavior are equivalent.
- [ ] Remove dead pure computations, stores proven overwritten/unobservable and unused merge values.
- [ ] Simplify algebraic identities without assuming mathematical integers where modular/signed
  semantics differ.
- [ ] Strength-reduce constant multiply/divide/modulo and address arithmetic into target-cheaper
  forms while preserving divide-by-zero and signed edge behavior.
- [ ] Preserve diagnostic obligations and warnings whose existence is language-defined.
- [ ] Reach a deterministic fixed point under a declared iteration/work budget.
- [ ] Emit no `JSR` runtime arithmetic for a compile/link-time constant when an exact constant or
  relocatable expression is available.

### Should Have

- [ ] Use demand-driven bit/range facts to reduce widths and remove unnecessary extensions.
- [ ] Hoist common pure address expressions when lifetime/allocation cost does not regress.

### Won't Have

- Floating-point algebra or undefined-overflow assumptions.
- Reassociation that changes specified evaluation order or volatile access.

## Technical Requirements

Every rewrite declares preconditions over type, range, known bits, effects and target cost. Signed
division/remainder corner cases and shifts at zero/width boundaries have explicit truth tables.
Relocatable symbolic constants remain linker expressions rather than being materialized at runtime.

## Integration Points

- RD-04 supplies interprocedural facts.
- RD-06 consumes simplified CFG/conditions.
- RD-09 selects target idioms.
- RD-14 validates rule contracts and generated boundary cases.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Semantics | Exact finite-width, no UB assumptions | AR-5 |
| Fixed point | Deterministic bounded worklist | AR-8 |
| Constant addresses | Preserve relocatable expressions | AR-11, AR-15 |

## Security Considerations

All arithmetic uses checked host operations/BigInt where needed before explicit target truncation.
Worklists and expression tables have input-derived caps; adversarial IL cannot cause unbounded
fixed-point iteration or memory growth.

## Acceptance Criteria

1. [ ] SCCP folds a branch made constant by a direct-call argument and removes only the unreachable
   successor.
2. [ ] Byte `255 + 1`, sbyte `127 + 1`, word `65535 + 1` and sword `32767 + 1` produce the exact
   specified wrapped values.
3. [ ] Signed and unsigned comparisons over the same bit pattern remain distinct.
4. [ ] CSE merges two pure equal expressions but not expressions separated by an aliasing write,
   volatile read or unknown call.
5. [ ] Dead-store elimination removes an overwritten ordinary store but preserves every MMIO store
   and its order.
6. [ ] Multiply/divide/modulo by powers of two use verified shift/mask forms for every valid signed
   and unsigned boundary; invalid signed cases stay on the correct fallback.
7. [ ] `lo(&X / 64)` remains a relocatable constant expression and emits no runtime divide helper.
8. [ ] A seeded reassociation mutation that changes overflow/evaluation behavior fails translation
   validation and target execution.
9. [ ] Exceeding the work budget reports a classified optimizer-budget failure and returns the last
   semantically valid state, never partial corrupt IL.
