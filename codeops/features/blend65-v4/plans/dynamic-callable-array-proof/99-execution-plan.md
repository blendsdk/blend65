# Dynamic callable array proof — blocked plan

> **Owner**: issue [#167](https://github.com/blendsdk/blend65/issues/167).
> **Scope mode**: strict. No new runtime, source restriction or `spec/` change.
> **Status**: Blocked on a public-oracle conflict; the sound escape proof is delivered.

## Problem

`test/rd04/function-values.spec.test.ts` builds with `optimization: none` and default unchecked
arrays:

```blend65
function record(tag: byte): void { poke($0424 + word(step), tag); step += 1; }
function main(): void {
  let first: byte = choose(false)(0);                       // opaque write via record()
  let callbacks: (fn(byte): byte)[2] = [&plusOne, &plusTwo];
  let which: byte = peek($0440);
  let third: byte = callbacks[word(which)](10);             // currently E10277
}
```

The index `which` is loaded from raw memory, so it is a runtime value with no proved upper bound.
The preceding indirect call reaches a helper whose runtime `poke` destination is opaque. The
callable-read proof rejects the dynamic read.

## Why the obvious relaxation is unsound

The first attempt filtered the *opaque* kill by root in the unchecked/unbounded branch: the private
array is not address-taken, so the kill was ignored. Independent review (SM-001) produced a
counterexample:

```blend65
let tail: (fn(): byte)[2] = [&chosen, &other];   // global -> nameable by the opaque write
function main(): void {
  let callbacks: (fn(): byte)[2] = [&chosen, &other];
  corrupt();                                     // opaque kill
  poke($C000, callbacks[peekw($0400)]());        // unbounded: may land on tail
}
```

An unchecked index may leave the array entirely (`spec/08-arrays-strings.md` AR-8: "The optimizer
must not assume that a runtime index is in bounds"). The read can reach `tail`, whose bytes the
opaque write can name, so the certified target set `{chosen, other}` need not contain the loaded
value. Filtering the opaque kill only in the unbounded branch is therefore inconsistent with the
concrete-kill branch and with the signed-off #156 behavior.

The same class is already pinned as a **rejection** by
`test/rd04/bounded-local-index.spec.test.ts`:

```blend65
let index: byte = peek($0400);              // unbounded
poke($C000, callbacks[index]());            // outcome: failure (E10277)
```

## Oracle conflict

| Oracle | Source | Expected |
| --- | --- | --- |
| `function-values.spec.test.ts` | RD-04 ordinary function values | **success** for an unbounded unchecked callable-array read after an opaque call |
| `bounded-local-index.spec.test.ts` | #163 bounded local index | **E10277** for the same class |

Both are public specification tests. The frozen spec supports the rejection
(`spec/08-arrays-strings.md` AR-8; `spec/06-functions.md` §4.3; R4.30 "reject only when no finite
source target set is provable"; E10277). Resolving the conflict needs an explicit oracle ruling;
the executor may not edit a specification test.

## Delivered sound slice

- `opaqueRoots` now includes address-taken storage: a non-aggregate `place-address` (`&local`,
  `word(&local)`) and an aggregate place passed as a call argument. Aggregate value materialization
  and local copies are excluded, so an ordinary `let copy = box;` does not become opaque.
- The conservative unchecked/unbounded rule is restored: any known kill rejects the read. A checked
  or proved-bounded read keeps its element-range proof.
- The escaped-local and concrete-placed-kill rejections and the aggregate-copy acceptance are
  implementation-pinned.

## Decision requested

**Recommended**: authorize the minimal oracle edit to the RD-04 acceptance so its index is proved
in bounds while keeping the dynamic-index intent and the VICE observations. Either form works:

```blend65
let which: byte = peek($0440) & 1;              // same runtime value 1
let third: byte = callbacks[word(which)](10);   // #163-accepted bounded form
```

The unbounded class stays rejected, matching `bounded-local-index.spec.test.ts`. The implementation
change in this branch then needs no further semantic rule.

**Alternative** (not recommended): rule that an unchecked out-of-bounds callable read is outside the
typed target contract. That would permit the unguarded acceptance but contradicts AR-8, the #156
closeout, and the #163 oracle; it would need a spec/ambiguity decision record, not a silent change.

## Tasks

- [x] T-167.1 Record the failing public acceptance and the poisoned `callbacks` load.
- [x] T-167.2 Attempt the root-sensitive relaxation; independent review rejected it (SM-001).
- [x] T-167.3 Deliver the sound address-taken escape rule and the conservative unchecked rule.
- [x] T-167.4 Add the escaped-local, concrete-kill and aggregate-copy implementation tests.
- [x] T-167.5 Rerun the VICE acceptance (still red by design) and the host/compiler checkpoints.
- [ ] T-167.6 Resolve the oracle conflict with the user, then rerun the complete checkpoint.

## Acceptance

| Area | State |
| --- | --- |
| Escaped address | Rejected (delivered). |
| Aggregate copy | Accepted (delivered). |
| Concrete placed kill | Rejected (delivered). |
| Unbounded private array after an opaque call | Rejected; the RD-04 acceptance still expects success. **Decision required.** |
| Complete checkpoint | Cannot be green until the oracle conflict is resolved. |

## Residuals

| Residual | Owner |
| --- | --- |
| Unbounded unchecked callable read after a kill | oracle ruling; conservative rejection until then |
| RAW-memory constant tracking for `poke($addr, c); peek($addr)` | not claimed; volatile/asynchronous-writer obligations unresolved |
| Hidden aggregate-return destination | unresolved boundary, no observed source escape |

## Constraints

- `spec/` and the expressiveness ledger stay byte-identical. No test or VICE journey is weakened.
  No push.
