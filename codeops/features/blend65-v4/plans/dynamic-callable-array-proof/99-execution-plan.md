# Dynamic callable array proof — execution plan

> **Owner**: issue [#167](https://github.com/blendsdk/blend65/issues/167).
> **Scope mode**: strict. No new runtime, source restriction or `spec/` change.

## Problem

`test/rd04/function-values.spec.test.ts` used an unbounded unchecked index:

```blend65
function record(tag: byte): void { poke($0424 + word(step), tag); step += 1; }
function main(): void {
  let first: byte = choose(false)(0);                       // opaque write via record()
  let callbacks: (fn(byte): byte)[2] = [&plusOne, &plusTwo];
  let which: byte = peek($0440);                            // 0..255
  let third: byte = callbacks[word(which)](10);             // E10277
}
```

The index had no proved upper bound, and an earlier indirect call reached a helper whose runtime
`poke` destination was opaque, so the callable-read proof rejected the dynamic read. The same read
class is **pinned as a rejection** by `test/rd04/bounded-local-index.spec.test.ts`, and
`spec/08-arrays-strings.md` AR-8 forbids assuming a runtime index stays in bounds.

## Why the obvious relaxation was rejected

Filtering the opaque kill by root in the unchecked/unbounded branch is unsound: an out-of-bounds
index may leave the array and land on another nameable opaque root (for example a global callable
array that the opaque write can reach). Independent review SM-001 produced that counterexample; the
certified target set could then omit the loaded value. The conservative `killed.length > 0` rule is
therefore retained.

## Decision

- **Sound rule (delivered)**: an opaque runtime write reaches only roots it can name: globals,
  borrowed aggregate parameters and address-taken storage. A non-aggregate `place-address`
  (`&local`, `word(&local)`) and an aggregate place passed as a call argument join `opaqueRoots`;
  aggregate materialization and local copies do not.
- **Unchecked dynamic reads**: any known kill rejects, preserving AR-8. Checked and proved-bounded
  reads keep their element-range proof.
- **Oracle resolution (user-authorized 2026-11-16)**: the RD-04 acceptance's index is bounded with
  `let which: byte = peek($0440) & 1;`. The runtime value is still 1 and the VICE observations are
  unchanged; the test still exercises dynamic indexing. The unbounded class stays rejected, matching
  the #163 oracle.

## Tasks

- [x] T-167.1 Record the failing public acceptance and the poisoned `callbacks` load.
- [x] T-167.2 Attempt the root-sensitive relaxation; independent review rejected it (SM-001).
- [x] T-167.3 Deliver the sound address-taken escape rule and keep the conservative unchecked rule.
- [x] T-167.4 Add the escaped-local, concrete-kill and aggregate-copy implementation tests.
- [x] T-167.5 Apply the authorized bounded-index oracle edit; the VICE observations are unchanged.
- [x] T-167.6 Run the complete checkpoint and record the closeout.

## Acceptance

| Area | Oracle |
| --- | --- |
| Escaped address | `word(&local)` followed by an opaque write still rejects. |
| Aggregate copy | A private struct copy followed by an opaque write still accepts. |
| Concrete placed kill | An unbounded dynamic read after `pokew($C100, 0)` still rejects. |
| Unbounded array class | E10277, matching the #163 oracle. |
| RD-04 acceptance | Bounded index builds; VICE returns `[7, 9, 12, 5, 1, 2, 4, 3, 4]`. |
| Complete checkpoint | `yarn test:full` green. |

## Residuals

| Residual | Owner |
| --- | --- |
| Volatile raw-memory forwarding for `poke($addr, c); peek($addr)` | separate slice; asynchronous-writer proof required |
| Hidden aggregate-return destination | unresolved boundary, no observed source escape |
| Cross-block bounds | existing #163 precision debt |

## Constraints

- `spec/` and the expressiveness ledger stay byte-identical. No test or VICE journey is weakened.
  No push.
