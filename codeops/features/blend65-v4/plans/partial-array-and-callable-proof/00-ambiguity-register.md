# Ambiguity register: partial array construction and helper callable proof

> **Status**: AR-P1 resolved by user ruling; release checkpoint pending
> **Scope mode**: strict

## AR-P1 — Raw-memory corruption boundary for the new callable-write transfer

**Status**: RESOLVED — user selected Option A on 2026-11-14: ship the bounded transfer with the
documented typed-provenance boundary; issue #156 owns raw-write invalidation and issue #157 owns
aggregate-field transfer. The ruling is an accepted risk for this batch, not a language rule or a
waiver of the canonical T-10 behavior.

**Question**: Must the new helper/startup definite-write transfer be sound against arbitrary
raw-memory aliasing and unchecked typed escapes, or may it inherit the compiler's existing
typed-provenance model and leave that wider class to the tracked corruption debt?

**Why it cannot be decided by the plan**: the frozen specification defines typed provenance
(Chapter 06 §4.3) and the explicit address-taking erasure example (F018), but it does not define
how an arbitrary raw write at a runtime address affects a typed callable target proof. The
compiler currently has no raw-write invalidation; the direct `callback = &chosen` path has the
same exposure. Extending or repairing that model is a compiler-wide proof decision, not a local
lowering choice.

**Witnesses found by independent review**:

1. Runtime-word alias: uninitialized module storage holds the emitted address of the callable
   (legal per Chapter 03 §5.1, "memory contains whatever was there before"), a two-byte raw write
   through it replaces the callable, and the proof still selects the old target.
2. Unchecked typed escape: with bounds checking disabled, an indexed store can write outside its
   object and replace an adjacent callable.
3. Copied/returned corruption: a raw-written callable value copied or returned into another
   callable global carries the stale target.
4. Helper/startup overwrite: a safe direct assignment followed by a non-qualifying store in the
   same helper, another helper, or an initializer.

**Current bounded implementation** (already green on the targeted oracles):

- Transfers only a bare `fn(...)` global with no placement, no scalar address-of, and no
  compiler-visible non-direct store anywhere.
- Transfers only stores whose value is a direct function address or an all-address merge.
- Rejects same-helper, cross-helper and startup overwrites.
- Leaves aggregate fields (#157) conservatively rejected. The wider raw-memory and
  unchecked-escape corruption class (#156) is **not** made safe by this batch: it can still
  invalidate a callable proof and produce incorrect output. Treating it as safe rejection would
  be dishonest; it is an accepted risk with a named owner.

**Options**:

| ID | Option | Consequence |
| --- | --- | --- |
| A | **Recommended** — ship the bounded transfer with the typed-provenance boundary documented; #156 owns raw-write invalidation and #157 owns aggregate transfer. | T-15 and the canonical T-10 form ship now; no new source restriction; the pre-existing memory-integrity assumption is unchanged. A strict reviewer can still construct a raw-alias witness, exactly as before this batch. |
| B | Block T-10 until #156 invalidates callable provenance on potentially overlapping raw writes. | Strict soundness for helper transfer, but the broader change can reject `poke(variableAddress, value)` sequences followed by function-pointer calls and needs its own plan, tests and checkpoint. T-15 ships alone. |
| C | Extend this batch to fix #156. | Largest scope and risk; touches the core target-proof model, likely requires layout/alias facts and a full release checkpoint. |

**Recommendation**: A. It delivers the requested expressiveness with the canonical helper,
keeps the compiler's existing typed-storage contract, adds no false language restriction, and
gives the memory-corruption class named owners (#156/#157). B is the only materially different
option and is the correct choice if the raw-alias witness must block T-10.

**Decision owner**: user. **Ruling**: Option A. The bounded transfer ships; the raw-memory
corruption class stays tracked under #156 and the aggregate remainder under #157. The closeout must
state the boundary in plain language and must not present it as universal raw-memory safety.
