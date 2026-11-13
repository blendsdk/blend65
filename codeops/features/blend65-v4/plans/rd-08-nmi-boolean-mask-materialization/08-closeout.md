# Closeout — NMI Boolean Mask Materialization

> **Status**: Delivery complete; final verification recorded below
> **Updated**: 2026-11-13
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Issue**: [#149](https://github.com/blendsdk/blend65/issues/149)
> **Residual owner**: [#150](https://github.com/blendsdk/blend65/issues/150)

## Delivered boundary

Issue #149 closes the remaining NMI Boolean **materialization** gap without a private home:

- any nonzero constant mask not handled by `#148`'s shift chain uses the expert inline branch;
- the zero mask folds to a constant and the read still executes exactly once;
- an addressable runtime mask uses the same branch in either `&` operand order;
- a byte-masked word keeps its low byte: mask `1` identity, masks `2`/`4` shift, other byte masks
  branch; a word byte-mask branch condition uses the low `AND`'s Z;
- the all-ones mask `0xFF` keeps the load's value and flags without a redundant `AND`;
- a single-use constant local (byte or word) is elided before SFA closure and its load resolves to
  the constant.

The branch is an inline machine block, not a helper or a storage class. No storage request is
created, so the NMI private-home proof, the storage model and the specification are untouched.

## Delivered forms

| Form | Result |
|---|---|
| `flag = ((read() & 8) != 0)` | Builds, expert branch, zero private storage |
| `flag = ((read() & 8) == 0)` | Builds, expert inverse branch |
| `flag = ((read() & 3) != 0)` / `== 0` | Builds, expert branch/inverse |
| `flag = ((read() & 0) != 0)` / `== 0` | Builds, constant fold |
| `flag = ((read() & maskValue) != 0)` / `== 0` | Builds, addressable runtime mask |
| `flag = ((maskValue & read()) != 0)` | Builds, mirrored runtime mask |
| `flag = ((read() & 255) != 0)` | Builds, no redundant `AND` |
| `place word w; flag = ((w & 1) != 0)` | Builds, identity |
| `place word w; flag = ((w & 2) != 0)` | Builds, one shift |
| `place word w; flag = ((w & 8) != 0)` | Builds, branch |
| `let x: byte = 5; flag = ((x & 8) != 0)` | Builds, constant fold after local elision |
| `let w: word = 2; flag = ((w & 2) != 0)` | Builds, constant fold after local elision |
| mirrored `&` / mirrored zero test / elided byte local | Builds, same body as the direct form |

The frontend rejects a source-level `poke` of a Boolean with `E10086`; the constant-address byte
memory-write branch remains a defensive machine-level boundary only.

## Measured costs

The NMI wrapper is `PHA`/`CLD`/`PLA`/`RTI` = 4 bytes, 15 cycles, 4 stack bytes. Only A is saved
because the body clobbers only A. Totals are compiler-owned handler code; the fixed 7-cycle CPU NMI
acceptance and the 7-cycle/4-ROM-byte KERNAL `$FE43` stub are excluded and cancel in the relative
comparison.

| Form | Handler bytes | Path-max cycles | Best expert | Verdict |
|---|---:|---:|---|---|
| mask `8`/`3`, `!=` | 16 | 29 | same branch, 16/29 | meets exactly |
| mask `8`/`3`, `==` | 18 | 31 | same inverse, 18/31 | meets exactly |
| zero mask, either | 12 | 25 | constant fold, 12/25 | meets exactly |
| runtime mask, `!=` | 17 | 31 | same branch, 17/31 | meets exactly |
| runtime mask, `==` | 19 | 33 | same inverse, 19/33 | meets exactly |
| word mask `1`, `!=` | 12 | 25 | identity, 12/25 | meets exactly |
| word mask `2`, `!=` | 13 | 27 | one `LSR`, 13/27 | beats the 16/29 branch |
| all-ones mask, `!=` | 14 | 27 | load identity, 14/27 | beats the 16/29 branch |
| constant local, `!=` | 9 | 21 | constant load, 9/21 | meets exactly |

The all-ones identity removes a redundant `AND #$FF`; the word mask `2` shift removes the branch.
Every other delivered form is byte-for-byte and cycle-for-cycle the expert sequence, so no generated
form is worse than the expert.

## Runtime evidence

Two sequential VICE 3.10 `x64sc` cases ran on `c64-pal-prg-kernal-6581`:

| Fact | Mask `3`, `!=`, Timer A | Mask `8`, `==`, Timer A |
|---|---|---|
| Artifact SHA-256 | `91882526ebb08a734f63b7ee40e22bd1f5f95b81e44e9b562b14c2fc77dbec0d` | `de91014df9b487648ea8a681470ef10b2b13e0a7fec03c690a846e152340dfdd` |
| VICE executable SHA-256 | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` | same |
| ROM SHA-256 | `83c60d47…`, `89878cea…`, `fd0d53b8…` | same |
| Handler entry | `$0A47` (2631) | `$0A47` (2631) |
| Handler range | `2631-2647` | `2631-2649` |
| Observed global | `$C000 = 1` | `$C000 = 1` |
| Caller return | `$E147` | `$E147` |

Both use a genuine CIA2 NMI through the installed exclusive route. Timer A sets ICR bit 0, so the
mask-`3` test is true; the serial bit is clear, so the mask-`8` inverse is true. The zero, runtime,
all-ones and word forms have four-profile assembled-byte evidence only. Status remains
`VICE-verified / hardware-unverified` for the two branch witnesses and assembled-byte-verified for
the rest.

## Restrictions kept

| Form | Result | Owner |
|---|---|---|
| Masked value shared by several consumers | `E10245` | [#150](https://github.com/blendsdk/blend65/issues/150) |
| Several simultaneously retained samples | `E10245` | #150 (route limitation) |
| 16-bit word mask with a possibly-nonzero high byte | `E10245` | #150 |
| Runtime word local from a byte read | `E10245` | #150 |
| Computed/non-addressable runtime mask | `E10245` | #150 |
| Masked value compared to a nonzero constant | `E10245` | #150 |
| Any real private home | `E10245` | Unchanged NMI proof |

`test/rd04/expressiveness-ledger.json` row `v4-nmi-retained-source-reads` records exactly these six
forms with six probes, owned by #150.

## Deferral-expiry check

This slice expires the materialization clauses recorded by #147/#148 for every nonzero constant mask,
the zero mask, the addressable runtime mask, the byte-masked word and the constant local. The row's
rationale is rewritten: the six remaining forms are a different subsystem (bounded retention, a wider
join, zero-extension staging, addressable computed masks, a general comparison branch) and are owned
by #150 **before** #149 closes. No other deferral's rationale changed: takeover, physical, host and
producer rows keep their existing owners. `spec/` has no diff.

## Independent reviews

| Review | Verdict | Material findings and disposition |
|---|---|---|
| Preflight | PASS WITH FIXES | F1–F12 dispositioned: `.boolean.` debug-range family, no reliance on a frontend fold, wide-word global negative, mirrored runtime commute, VICE case alignment, constant-local kind, missing residual classes, counts and wording. |
| Machine code | BLOCKED → fixed | MC-001 constant-comparison forward could clobber a non-adjacent consumer; the fold now returns a constant with no instruction and no forwarding. MC-002 a constant-folded selected mask threw; it now falls through to the comparison fold. MC-004 all-ones mask emitted a redundant `AND`; the identity now skips it. MC-005/006 signed zero mask and sign-extended literal precision fixed. MC-009 branch-condition test made real and path-max asserted. |
| SFA/ABI | BLOCKED → fixed | SF-001 truncating a constant returned the untruncated value; `lowerConversion` now masks it. SF-002 same fallback as MC-002. SF-003 word mask `1` was unselected; the identity now covers a zero-extended word. SF-004 two residual negatives added to the four-profile oracle. SF-005/006/007 plan and elision docs/tests updated. |
| Target platform | PASS WITH FIXES | TP-001 word mask `1` fixed. TP-002 docs/release owner updated to #150. TP-003 closeout/progress written. TP-004 artifact hashes and handler entries recorded above. TP-005 two negatives added (six total). TP-006 signed zero mask fixed. TP-007/008 index and per-form runtime boundary corrected. |

## Verification

| Check | Result |
|---|---|
| #149 spec oracle | 92/92 pass (17 positives × 4, 6 negatives × 4) |
| #148 oracle after three authorized retirements | 48/48 pass (five-sample negative kept) |
| #147 oracle | 40/40 pass |
| Issue #100 oracle | 16/16 pass |
| Machine impl (mask materialization) | 25/25 pass |
| Machine impl (shift/branch selection) | 21/21 pass |
| Storage/elision impl | 11/11 pass |
| Sequential VICE | 2/2 pass |
| Expressiveness-ledger gate | 14/14 pass |
| Pinned optimizer artifacts | 3/3, 17/17, 12/12 pass |
| Foundation / profile pipeline | 12/12, 10/10 pass |
| NMI/CIA2 route slice | 32 files / 778 tests pass |
| Complete compiler suite | 224 files / 3,780 passed / 2 skipped, zero failures |
| `yarn build` / `yarn typecheck` | 4/4 and 7/7 Turbo tasks |
| `spec/` | Clean; no file changed |

No push.
