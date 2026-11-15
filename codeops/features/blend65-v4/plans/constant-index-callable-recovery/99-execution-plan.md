# Constant-index callable element recovery — execution plan

> **Owner**: issue [#162](https://github.com/blendsdk/blend65/issues/162).
> **Dependency**: the byte-interval kills from #156/#161 and the field transfer from #157.
> **Scope mode**: strict. No frozen `spec/` change, no runtime, no new source restriction.

## Problem

Every array index collapses to `index:*` in the assignment and target paths. A complete
constant-index store therefore cannot restore a callable element after a raw write:

```blend65
let table: (fn(): byte)[1];
table[0] = &chosen;
pokew(&table[0], 0);
table[0] = &chosen;
poke($C000, table[0]());
```

The final store writes the complete pointer, but the assignment fact is missing and the read is
poisoned. A runtime index must keep the collapsed conservative behavior.

## Decision

- The **assignment path** distinguishes a proved constant index (`index:<n>`) from a runtime index.
  A runtime index still has no must-assignment key.
- The **target provenance path** stays collapsed (`index:*`) so the existing finite target
  selection is unchanged.
- A load checks assignment against the constant-aware path and reports a missing target against the
  collapsed path, so a poisoned target still empties the finite set.
- A complete typed store to a constant-index callable element restores exactly that element's bytes;
  the byte-interval kill analysis already subtracts those bytes.
- No per-element solver, runtime or source restriction.

## Tasks

- [ ] T-162.1 Reproduce the witness, the uninitialized constant sibling, the raw-written constant
      element, the runtime-index read and the partial-initializer controls.
- [ ] T-162.2 Author the public oracle and the cost expectation; confirm RED for the witness.
- [ ] T-162.3 Add the constant-aware assignment key/path and keep the target path collapsed.
- [ ] T-162.4 Implementation tests for every witness and control.
- [ ] T-162.5 Independent review for correctness, semantics and emitted output.
- [ ] T-162.6 Host checkpoint and the wave-level `yarn test:full`; closeout and issue evidence.

## Acceptance

| Area | Oracle |
| --- | --- |
| Witness | The constant-index raw write followed by a complete store builds and calls `chosen`. |
| Unwritten element | A constant-index read of an uninitialized sibling still fails `E10277`. |
| Unrestored element | A constant-index read after a raw write without a restore still fails `E10277`. |
| Runtime index | A runtime-index read of a raw-written or uninitialized element still fails `E10277`. |
| Partial initializer | Omitted-element and partial-array suites stay green. |
| Cost | The accepted witness keeps an exact PRG/code/resource expectation. |

## Residuals

| Residual | Owner |
| --- | --- |
| Runtime-index must-assignment | stays collapsed by design |
| Interprocedural constant-element transfer | direct-call field transfer only; documented |
| Bounded local index ranges | #163 |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
