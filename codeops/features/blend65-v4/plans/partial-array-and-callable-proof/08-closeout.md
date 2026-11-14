# Partial array construction and helper callable proof — closeout

> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Ambiguity ruling**: [00-ambiguity-register.md](00-ambiguity-register.md) AR-P1
> **Status**: implemented, independently reviewed and verified at the complete checkpoint
> **Roadmap rows**: T-15, T-10 (delivered by T-30)

## Delivered behavior

| Item | Result |
| --- | --- |
| T-15 partial local array | `let a: byte[2] = [7];` builds with `W10140`, stores only element 0, and executes with `a[0] = 7` on all four profiles. |
| T-15 partial global array | `let values: byte[3] = [9];` initializes only element 0 and executes with `values[0] = 9`. |
| T-15 nested outer partial | `let pairs: byte[2][2] = [[7, 8]];` builds and executes with `pairs[0][0] = 7`. |
| T-15 fill contrast | `[7; 0]` still initializes every element and emits no `W10140`. |
| T-10 direct helper | `prepare()` assigns `callback = &chosen`; `invoke()` returns 37 through a direct `JSR chosen` on all four profiles. |
| T-10 transitive helper | A second-level helper transfers the same guarantee; the call returns 41. |
| T-10 startup helper | A helper called by a global initializer transfers the guarantee into `main` before the call. |
| T-10 conditional/omitted/raw | Conditional assignment, early return, post-call write, multi-caller, address-taken, placed, copied-source, omitted callable element and overwrite cases still fail `E10277`. |
| T-15 callable interaction | A partial callable array keeps the omitted element unknown; an omitted or dynamically selected element fails `E10277` instead of lowering an indeterminate pointer. |

## Measured evidence

| Check | Result |
| --- | --- |
| `yarn vitest run test/rd04/partial-array-construction.spec.test.ts test/rd05/callable-helper-assignment.spec.test.ts` | 2 files, 36 passed (16 + 20), 50.3 s |
| `yarn workspace @blend65/compiler vitest run src/machine src/semantic` | 96 files, 1,264 passed, 26.6 s |
| Complete compiler package suite | 227 files, 3,828 passed / 2 skipped, 5m10s |
| Emitted partial construction | `LDA #7; STA array; LDA array; STA $C000` — one construction store, no zero fill |
| Emitted singleton call | `JSR chosen; STA $0ac7; LDA $0ac7; RTS` — direct target, no dispatcher |
| Complete package + host checkpoint | Compiler 227 files / 3,828 passed / 2 skipped; CLI 70; language-server green; host root 219 files / 4,681 passed |
| Complete VICE tier, first run | 121 files passed / 1 skipped and 2,269 tests passed / 4 skipped; one known VIC collision timing flake (`vic-collision-vice.spec.test.ts`, `c64-pal-prg-kernal-8580`, sprite 7 foreground) failed a single byte observation |
| Isolated flake rerun | 16/16 passed twice in the serialized VICE tier |
| Complete VICE tier, clean rerun | 122 files passed / 1 skipped; 2,270 tests passed / 4 skipped in 64m55s |

## Review record

| Lens | Verdict |
| --- | --- |
| Correctness | APPROVE within the AR-P1 boundary after destination-wide overwrite exclusion and direct-source qualification. |
| Semantics | APPROVE within the AR-P1 boundary; canonical/transitive/startup forms and partial arrays correct; #156 is an accepted risk, #157 conservative precision debt. |
| SFA/ABI | APPROVE within the AR-P1 boundary; no false call edge, zero target storage/ZP/scratch/stack/ABI change. |
| Emitted code | APPROVE on output dispositions; construction 5 B / 6 cycles, direct call 3 B / 6 cycles; surrounding reload/return/startup debt tracked by #154/#124/#155. |

## Accepted boundary (AR-P1)

The user ruled on 2026-11-14: ship the bounded typed-provenance transfer. The new guarantee is
limited to a bare `fn(...)` global with no placement, no scalar address-of, and no visible
non-direct store anywhere in the program or its initializers. The guarantee is transferred only
for stores of a direct function address or an all-address merge.

**Issue #156 is not fixed by this batch.** A raw memory write, or an unchecked typed escape, can
still replace callable bytes and leave a stale target proof. That can produce incorrect output, not
a safe rejection. It is the pre-existing compiler-wide corruption model, accepted as risk for this
batch with a named owner. Issue #157 owns aggregate-field helper transfer, which remains
conservatively rejected.

## Deferral-expiry check

- T-15 and T-10 were the only recorded owners of these two expressiveness defects. Both close with
  this delivery; their deferral rationale expires.
- The expressiveness ledger never contained a T-10 or T-15 row and is byte-unchanged (eight rows,
  no addition, no retirement).
- The raw-corruption and aggregate-field gaps were never recorded as deferrals; they are filed as
  #156 and #157 with explicit owners and acceptance criteria.
- `spec/` is untouched, including the F018 target-set and F014 partial-initializer contracts.
- No other deferral named T-15 or T-10 as its landing place.

## Output debt filed during review

| Issue | Gap |
| --- | --- |
| [#154](https://github.com/blendsdk/blend65/issues/154) | Forward a known private array element into its next read (3 B / 4 cycles). |
| [#155](https://github.com/blendsdk/blend65/issues/155) | Inline supplied elements of a partial global initializer (4 B / 12 cycles). |
| [#124](https://github.com/blendsdk/blend65/issues/124) | Existing return-result staging debt (6 B / 8 cycles in the helper witness). |
| [#156](https://github.com/blendsdk/blend65/issues/156) | Raw-write invalidation of callable target proofs; accepted AR-P1 risk. |
| [#157](https://github.com/blendsdk/blend65/issues/157) | Aggregate callable-field helper transfer; conservative rejection. |

## Verification status

Install/build/typecheck and the targeted package, root and VICE spec tests pass. The first complete
`yarn test:full` run passed the package and host tiers and hit one known VIC collision timing flake
in the serialized VICE tier; two isolated serialized reruns of that file passed 16/16. The complete
VICE tier rerun then passed 122 files / 2,270 tests with 1 file and 4 tests skipped, closing the
gate cleanly. No oracle was skipped, deleted or weakened; the flake is recorded with its exact
case and rerun evidence.
