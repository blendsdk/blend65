# A returned byte whose flags already describe it

> **Owner**: [#185](https://github.com/blendsdk/blend65/issues/185) · **Type**: Task (lightweight)
> **CodeOps Artifact Schema**: 1
> **Status**: Complete for producing exits; the filed witness is a verified refusal
> **Progress**: 6/6 tasks in scope (100%)
> **Last Updated**: 2026-11-23

## What was wrong

A byte handed back through the accumulator was stored and read straight back
before the caller branched on it:

```asm
jsr b65_Game_masked_
sta $0872          ; 6 bytes / 8 cycles plus one home
lda $0872
bne skip
```

The call convention promises no flags and the call itself encodes none, so the
caller had no way to know the callee had already settled N and Z from the very
byte it returned.

## The premise the issue filed, and what measurement found

The issue argued its own witness was removable because "the callee's own last act
before `rts` is the shift that set N and Z from the very byte in A". That is not
what the compiler generates. `Game.shifted` ends like this:

```asm
b65_Game_shifted_block_2_:
  beq b65_Game_shifted_block_4_      ; flags from ldx count — describes X
b65_Game_shifted_block_3_:
  asl
  dex
  bne b65_Game_shifted_block_3_      ; falls through with flags from dex
b65_Game_shifted_block_4_:
  rts
```

The value leaves the loop at a merge block holding nothing but the return, and
both paths into it carry the flags of the loop *counter*. At the `rts`, N and Z
describe X and say nothing about the byte in A. So the caller's reload is doing
real work, and **the filed witness is a correct refusal.** It stays as it is, now
pinned by an oracle case that says why.

What is removable is the witness class that actually satisfies the contract: a
body whose last write of A also wrote both flags from that write. `return seed &
7` and `return seed` are the plain cases, and a two-exit body qualifies when both
of its exits do.

## The fact, and where it lives

`machine/return-flag-facts.ts` answers one question about a callee: at every
reachable `rts`, is the last instruction to write A also the last to write N and
Z, with both set from that same write? Read backwards from the end of each return
block, the first instruction writing A settles it; an instruction writing either
flag after that refuses.

A return block that writes no A at all refuses rather than following its
predecessors. That is the shift-loop merge above, and chasing the edges would
have to prove agreement across a loop back-edge and a branch — a wider claim than
this one, and one the weakest-exit rule exists to avoid making.

Every reachable exit has to agree and the weakest governs, which is why a body
with one producing exit and one loop-merge exit refuses even though half of it
would have qualified.

A body cannot be asked about itself. Recursion is rejected by the language so no
accepted program reaches that barrier; it stays because a certificate resting on
its own conclusion is not one. That is the discipline carried over from the
narrower all-exit certificate beside it.

The fact is consumed in `copyForward`, exactly where the adjacent-producer proof
rejects the `jsr`. A call writes A and no flag, so it can never be a producer on
its own terms; what it can carry is its callee's promise.

While extracting the call's entry label a duplicate appeared, since the census
beside this one already tests the same operand shape. `plainEntryLabel` is now
stated once in `machine/call-site-facts.ts` and the census's own
`plainEntryCall` is expressed in terms of it.

## Measured before anything was changed

Ten witnesses, every optimization goal, bounds checks off and on, ACME 0.97, on
the four cooperative KERNAL PRG profiles.

| Witness | Before | After | Saved |
| --- | --- | --- | --- |
| `return seed & 7` tested by its caller | 110 | 104 | 6 |
| `return seed` tested by its caller | 108 | 102 | 6 |
| Two exits which both settle the flags | 120 | 114 | 6 |
| The filed witness: a shift result returned | 122 | 122 | — |
| Two exits where one is that shift merge | 134 | 134 | — |
| The returned byte stored rather than tested | 110 | 110 | — |
| The next callee opens with a call | 138 | 138 | — |
| Two wrappers deep | 142 | 142 | — |
| A wrapper whose inner body saves the status register | 204 | 204 | — |
| A call to a generated helper block | 196 | 196 | — |

Six bytes and eight cycles plus one home on every delivered result, identical at
`balanced`, `speed` and `size`, and unchanged by bounds checking. Of eighty
generated artifacts compared as text before and after, exactly the eighteen that
save differ — the three delivering witnesses at three optimized goals with bounds
either way — and the other sixty-two are byte-identical, including every
canonical `none`.

## Tasks

- [x] T-185.1 Measure the filed witness and nine controls at all four goals, bounds off and on.
- [x] T-185.2 Check the filed premise against the callee's actual exits.
- [x] T-185.3 Author the return contract as its own module.
- [x] T-185.4 Consume it where the adjacent-producer proof rejects a call.
- [x] T-185.5 Author the four-profile oracle, proved red before the fix, and the unit cases.
- [x] T-185.6 Compiler, host and root checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| A masked byte returned | the caller branches straight off the call |
| A plain load returned | the caller branches straight off the call |
| Two exits which agree | the caller branches straight off the call |
| Every optimized goal | `speed` and `size` branch the same way |
| Bounds checks on | the same branch, measured not assumed |
| Canonical reference | `none` still stores and reloads |
| The returned byte leaves a loop | the reload stays, because the flags describe the counter |
| One exit settles nothing | the reload stays; the weakest exit governs |

## Verification

| Tier | Result |
| --- | --- |
| Oracle red before the fix | 20 failed / 12 passed — every failure a delivery case, every pass a retention or reference control |
| `test/rd04/returned-byte-flags.spec.test.ts` | 32/32 on four profiles |
| The three neighbouring delivery oracles | 116/116, all unchanged — 148 with this one's own 32 |
| `return-flag-facts.impl.test.ts` | 13/13, every guard proved load-bearing by removal |
| Compiler machine tier | 93 files / 1,327 |
| `test/rd08/optimizer-saved-output.spec.test.ts` (VICE) | 17/17, including its byte-exact payload pins |
| Root host tier | 277 files / 5,913, green on the first run |

No pinned answer moved. Every refusal the caller census established survives
untouched — a caller that saves the status register, a run-time dispatch
candidate, an address taken, a next call that settles no flag, and a cycle of
bodies — and this session adds a refusal of its own rather than relaxing any of
them.

Each guard was removed in turn and failed exactly its own case:

| Guard removed | Case that failed |
| --- | --- |
| The plain-entry operand shape | the operand that is not a plain entry label |
| The self-certification refusal | the body asked about itself |
| The unresolved-call refusal | the call the program cannot resolve to a body |
| The reachable-return requirement | the body with no reachable return |
| The A-writer's own flag check | the write of A that settles no flag |
| The later-flag-writer refusal | the later write of either flag |

Two barriers cannot be reached from accepted source and are pinned in the unit
file rather than the oracle. No documented mnemonic writes A without writing both
flags, so that case builds the instruction; and recursion is rejected by the
language, so the self-certification refusal is unreachable. Both are kept because
the claims they protect are about this proof, not about which opcodes or which
diagnostics happen to exist.
