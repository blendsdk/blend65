# Raw-write invalidation of callable target proofs — bounded direct slice

> **Owner**: issue [#156](https://github.com/blendsdk/blend65/issues/156), direct-storage slice.
> **Scope mode**: strict. No frozen `spec/` change, no new runtime, no new source restriction, and
> no oracle weakened.
> **Explicit non-goal**: interprocedural and borrowed-alias invalidation is **not** delivered here.
> It is filed as [#161](https://github.com/blendsdk/blend65/issues/161) and #156 stays open for it.

## Problem

Frozen Specification 4 says a raw write to a typed function value's storage erases its callable
proof:

```blend65
pokew(&exact, peekw($0330)); // raw mutation invalidates exact's typed target proof
exact(1);                    // E10277: no finite source target set remains
```

The current compiler still builds the equivalent v4 program and emits a direct call:

```blend65
module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function main(): void {
  callback = &chosen;
  pokew(&callback, peekw($0330));
  poke($C000, callback());
}
```

The raw write replaces the pointer bytes; the direct call no longer reflects the runtime target.
This is silent wrong output, not a missing optimization.

## Decision

Extend the must-assignment proof with flow-sensitive **byte-interval kill** facts for raw writes
whose destination is statically resolvable **in the same executable body**:

- A raw write kills the exact byte interval it writes.
- A callable leaf is unsafe when its complete pointer interval overlaps a killed interval. This is
  byte-based, not path-based: `pokew(&box.prefix, ...)` can cross into `box.cb` in a packed
  struct, while `poke(&box.prefix, ...)` does not.
- A later typed store restores only the bytes it writes. A whole-object store restores every
  covered callable leaf; a field store restores that field, not its siblings.
- Merge is killed-union and assigned-intersection. A kill on one branch makes a post-join read
  unknown.
- A raw write before the first assignment, a direct reassignment after the raw write, and a raw
  write to an unrelated object remain accepted.
- A runtime destination that cannot be resolved, a raw write inside a callee, and a borrowed
  parameter/global alias are outside this bounded slice. They remain the accepted AR-P1 risk and
  are owned by #161; this batch does not pretend that every alias is proved.

The kill is a proof fact, not a source rule. No new diagnostic code is introduced: the read still
fails the existing `E10277` because no finite target set remains.

## Authority

| Fact | Authority | Consequence |
| --- | --- | --- |
| Raw mutation erases typed callable provenance | `spec/06-functions.md` §4.3; `spec/evaluations/F018-functions.md` target-set boundary | A call after the same-body raw write must fail `E10277`. |
| Ordinary raw memory is outside typed provenance | `spec/11-memory-model.md`; `spec/04-expressions-operators.md` | Unrelated raw writes keep their ordinary behavior. |
| Packed fields have exact byte offsets | `spec/07-structs.md` | Overlap must be computed from widths and offsets, not names. |
| Definite assignment is path-sensitive | `spec/03-variables.md`; `spec/04-expressions-operators.md` | The proof must respect branches and later stores. |
| No new runtime or heap | Prime Directive | The fix is analysis-only; emitted code for accepted programs is unchanged. |

## Tasks

- [x] T-156.1 Reproduce the direct, byte, word, aggregate-member, placed-address, before-store and
      unrelated-write witnesses with public builds. Record the exact current outcome.
- [x] T-156.2 Author the specification oracle before implementation. It must assert `E10277` after
      a same-body raw write to a callable root, a byte write, a crossing word write and a placed
      callable address; it must accept a raw write before the assignment, an unrelated write and a
      direct reassignment after the raw write. Confirm RED for the right reason.
- [x] T-156.3 Add byte-interval place facts and killed-state dataflow. Merge is killed-union and
      assigned-intersection; a typed store subtracts its written interval; a raw write adds its
      written interval. Feed killed facts into both unknown-read consumers.
- [x] T-156.4 Resolve raw destinations through bit-preserving conversions and direct
      `place-address`; resolve constant destinations against explicitly placed globals of known
      size. A runtime destination is not guessed, and a call boundary does not transfer kills.
- [x] T-156.5 Implementation tests: direct/byte/word/field/crossing-field/placed kill, before-store
      acceptance, unrelated write acceptance, branch-only kill rejection, direct reassignment
      recovery, and a non-callable raw write control.
- [x] T-156.6 Independent review: correctness, semantics, SFA/ABI, target platform and emitted
      code. A major finding stops delivery until fixed and re-reviewed.
- [ ] T-156.7 Verification: install, build, typecheck, directed package/root tests, then the
      complete `yarn test:full` checkpoint at the batch gate.
- [ ] T-156.8 Closeout: record evidence, update the roadmap and issue, run the deferral-expiry
      question, confirm `spec/` and the ledger are untouched, file #161 for the interprocedural and
      runtime-alias remainder, and commit. Do not close #156 while #161 remains open.

## Acceptance

| Area | Oracle |
| --- | --- |
| Direct word write | `callback = &chosen; pokew(&callback, ...); callback()` fails `E10277`. |
| Direct byte write | `poke(&callback, 0); callback()` fails `E10277`. |
| Aggregate field | `box.cb = &chosen; pokew(&box.cb, ...); box.cb()` fails `E10277`. |
| Crossing-field width | A word write at a byte field that overlaps the next packed callable kills that callable. |
| Disjoint byte field | `poke(&box.prefix, 0)` leaves `box.cb` accepted. |
| Placed address | A constant raw write overlapping a `place(at:)` callable invalidates its proof. |
| Before-store control | `pokew(&callback, 0); callback = &chosen; callback()` builds and calls `chosen`. |
| Unrelated control | A raw write to an unrelated object leaves the callable proof intact. |
| Branch kill | A raw write on one branch makes a post-join call fail `E10277`. |
| Direct recovery | A direct `callback = &chosen` after the raw write, with no intervening corrupted read, builds and calls `chosen`. |
| Cost | Accepted programs keep their emitted code; no instruction, stack, ZP or scratch byte is added. |
| Regression | Existing callable, partial-array, placement and VICE suites stay green. |

## Explicit boundary

| Boundary | Why it is not in this slice | Owner |
| --- | --- | --- |
| Raw write inside a callee, then caller call | Needs interprocedural may-kill summaries and context handling. | #161 |
| Borrowed parameter/global aliasing | Needs call-site-sensitive alias translation and byte-interval mapping. | #161 |
| Finite indirect call kills | Depends on the provisional target set and the interprocedural summary. | #161 |
| Runtime destination | The address value is not statically resolvable; this is the AR-P1 raw-alias class. | #161 |
| Constant-index callable array recovery | The must-assignment proof collapses every array index to `index:*`; this is a pre-existing precision gap, not introduced by the kill facts. | #162 |
| Bounded local index value | Inline masked indices are proved; a bound held in a local is conservatively rejected without dominating-range propagation. | #163 |

## Constraints

- `spec/` stays byte-identical.
- No test, oracle or VICE journey is deleted, skipped or weakened.
- The expressiveness ledger gains no row: this enforces an existing specification rule.
- The runtime/interprocedural boundary is recorded as #161; it is not presented as solved.
- The compiler package is the only production surface changed.
- No push. Commit at the verified checkpoint.
