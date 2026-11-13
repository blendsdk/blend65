# Closeout — Residual Boolean Masks

> **Status**: Delivery complete; final verification recorded below
> **Updated**: 2026-11-13
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Issue**: [#148](https://github.com/blendsdk/blend65/issues/148)
> **Residual owner**: [#149](https://github.com/blendsdk/blend65/issues/149)

## Delivered boundary

One rule on the existing Boolean identity closes the actionable non-`1` NMI Boolean-mask form:

- a single-use byte `&` with a compile-time constant mask `2` or `4`;
- the masked value is consumed by one materialized `== 0`/`!= 0` comparison with one A consumer;
- the comparison result feeds one byte store, constant-address byte memory write, or Boolean return;
- lowering emits one `LSR A` per bit position and one `EOR #$01` for `== 0`.

The rule covers the masked value and zero test in either operand order, the elided single-use local,
the mirrored local `&` operand, and the byte memory-write consumer. The mask-`1` identity keeps its
existing output. The NMI private-home proof, the storage model and the specification are untouched;
no storage is created or moved after closure.

## Delivered forms

| Form | Result |
|---|---|
| `flag = ((read() & 2) != 0)` | Builds, zero private storage |
| `flag = ((read() & 2) == 0)` | Builds, zero private storage |
| `flag = ((read() & 4) != 0)` | Builds, zero private storage |
| `flag = ((read() & 4) == 0)` | Builds, zero private storage |
| `flag = ((2 & read()) != 0)` | Builds, same body |
| `flag = (0 != (read() & 2))` | Builds, same body |
| `let s = read(); flag = ((s & 2) != 0)` | Builds, local home omitted |
| `let s = read(); flag = ((2 & s) != 0)` | Builds, local home omitted |
| `let s = read(); flag = ((s & 4) == 0)` | Builds, local home omitted |
| `let s = read(); poke($0402, (s & 2) != 0)` | Builds direct memory write, no staging |

## Measured costs

The NMI wrapper is `PHA`/`CLD`/`PLA`/`RTI` = 4 bytes, 15 cycles, 4 stack bytes. Only A is saved
because the body proves A live and X/Y dead at every reachable point. Totals are compiler-owned
handler code; the fixed 7-cycle CPU NMI acceptance and the 7-cycle/4-ROM-byte KERNAL `$FE43` stub are
excluded and cancel in the relative comparison.

| Form | Handler bytes | Path-max cycles | Best expert | Verdict |
|---|---:|---:|---|---|
| mask 2, `!=` | 13 | 27 | 16 bytes, 29 cycles | wins 3 bytes, 2 cycles |
| mask 4, `!=` | 14 | 29 | 16 bytes, 29 cycles | wins 2 bytes, ties cycles |
| mask 2, `==` | 15 | 29 | 18 bytes, 31 cycles | wins 3 bytes, 2 cycles |
| mask 4, `==` | 16 | 31 | 18 bytes, 31 cycles | wins 2 bytes, ties cycles |

Every form reports `zeroPage = 0`, `scratch = 0` and `hardwareStack = 4`.

Exact expert tails (after the shared `AND`):

```asm
; != 0
beq done / lda #$01            ; 4 bytes, 4 path-max cycles
; == 0
beq zero / lda #$01 / zero: eor #$01   ; 6 bytes, 6 path-max cycles
```

The shift tails are `k` bytes / `2k` cycles and `k+2` / `2k+2`. Mask `8` would spend 3/6 and 5/8,
so it loses the expert's 4/4 and 6/6 path-max tails. Masks `2` and `4` are the only constants that
meet both measures.

## Runtime evidence

Two sequential VICE 3.10 `x64sc` cases ran on `c64-pal-prg-kernal-6581`:

| Fact | Mask 2, `!=`, Timer B | Mask 2, `==`, Timer A |
|---|---|---|
| Artifact SHA-256 | `85db4323e2334edbec42a9b3d49086fa21ba672cf0fc6b70257c51df091ba6ff` | `355d6b6e69a0b17cdb98adecd3e7b0f978e00bd711a8938682c824e6e33a0225` |
| VICE executable SHA-256 | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` | same |
| ROM SHA-256 | `83c60d47…`, `89878cea…`, `fd0d53b8…` | same |
| Handler entry | `$0A47` (2631) | `$0A47` (2631) |
| Handler bytes | 13 | 15 |
| Observed global | `$C000 = 1` | `$C000 = 1` |
| Caller return | `$E147` | `$E147` |

Both cases use a genuine CIA2 NMI through the installed exclusive route; the Timer B case observes
the Timer B source bit, the Timer A inverse case observes the Timer A bit and the `== 0` result.
Mask `4` has four-profile assembled-byte evidence only: the typed library exposes no TOD-alarm
programming, and a raw `$DD08–$DD0B` write would invalidate the typed CIA2 lease and handback proof.
Status remains `VICE-verified / hardware-unverified`.

## Restrictions kept

| Form | Result | Owner |
|---|---|---|
| Constant mask `8` or higher (single bit) | `E10245` | [#149](https://github.com/blendsdk/blend65/issues/149) |
| Multi-bit constant mask (`3`, `6`, …) | `E10245` | #149 |
| Zero constant mask | `E10245` | #149 |
| Runtime mask (`maskValue`) | `E10245` | #149 |
| Wider-than-byte operand | `E10245` | #149 |
| Masked value shared by several consumers | `E10245` | #149 |
| Several simultaneously retained samples | `E10245` | #149 (route limitation) |
| Any real private home | `E10245` | Unchanged NMI proof |

`test/rd04/expressiveness-ledger.json` row `v4-nmi-retained-source-reads` records exactly these forms
with eight probes: five retained samples, mask `8` in both polarities, mask `3`, a runtime mask, a
shared masked value, a word operand and a zero mask.

## Deferral-expiry check

This slice expires the mask-not-`1` clause recorded by #147 and #148 for constant masks `2` and `4`.
The row's rationale is rewritten: the remaining masks, the runtime mask, the wider operand, the
shared masked value and the multi-sample form are owned by #149 before #148 closes. No other
deferral's rationale changed: takeover, physical, host and producer rows keep their existing owners.
`spec/` has no diff.

## Independent reviews

Three read-only post-implementation audits ran against the final diff:

| Lens | Verdict | Material findings and disposition |
|---|---|---|
| Machine code | PASS WITH FIXES | The delivered sequences meet or beat the expert branch on bytes and path-max cycles; the shift is the best local expert sequence, so the closeout does not claim a beat over the best expert. The local mirrored `&` claim was not supported and is now delivered with a test. The mirrored zero test is now delivered instead of left as an internal-failure risk. Handler totals, memory-write and return output are pinned. |
| SFA/ABI | PASS WITH FIXES | No storage request is created; the shift map is per-function state and is not persisted through closure. The local elision remains pre-SFA and the mirrored `&` order is accepted. The #147 retirement removes only the mask-two negative. Return and memory-write consumers now have exact output tests. |
| Target platform | PASS WITH FIXES | The `$DD0D` read remains exactly once; both VICE cases are genuine Timer B/Timer A NMIs with `$C000 = 1` and `$E147`. Mask `4` is ICR bit `2` (TOD alarm), not FLAG; the runtime boundary now says so. The release record distinguishes mask-2 runtime evidence from mask-4 byte evidence. The ledger includes mask `0`, the word operand and the shared masked value. |

## Verification

| Check | Result |
|---|---|
| #148 spec oracle | 60/60 pass (11 positives × 4, 4 negatives × 4) |
| #147 oracle after the one-case retirement | 40/40 pass |
| Issue #100 oracle | 16/16 pass |
| Machine impl oracle | 21/21 pass |
| Storage/elision impl oracle | 10/10 pass |
| Sequential VICE | 2/2 pass |
| Expressiveness-ledger gate | 14/14 pass |
| Complete compiler suite | 223 files / 3,754 passed / 2 skipped, zero failures |
| Root affected slice | 9 files / 184 tests pass |
| NMI/CIA2 route slice | 32 files / 778 tests pass |
| `yarn build` / `yarn typecheck` | 4/4 and 7/7 Turbo tasks |
| `spec/` | Clean; no file changed |

No push.
