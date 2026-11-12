# Closeout — NMI Residual Source Reads

> **Status**: Delivery complete; final verification recorded below
> **Updated**: 2026-11-13
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Issue**: [#147](https://github.com/blendsdk/blend65/issues/147)
> **Residual owner**: [#148](https://github.com/blendsdk/blend65/issues/148)

## Delivered boundary

Four narrow rules on existing seams close the remaining ordinary NMI source-read forms:

1. a direct volatile byte read owns Z for an adjacent closed zero test;
2. `(x & 1) != 0` is the value itself, and `== 0` adds one `EOR #$01`;
3. a direct read stays in A when the other bitwise operand is a directly addressable byte;
4. a single-use NMI local is eliminated before SFA closure when its whole life is one adjacent
   store/load pair fed by a direct read.

The NMI private-home proof, the storage model and the specification are untouched. No storage is
created or moved after closure.

## Delivered forms

| Form | Result |
|---|---|
| `if (readAndClearPendingSources() != 0) { flag = true; }` | Builds, zero private storage |
| `flag = ((readAndClearPendingSources() & 1) != 0);` | Builds, zero private storage |
| `flag = ((readAndClearPendingSources() & 1) == 0);` | Builds, zero private storage |
| `if ((readAndClearPendingSources() & maskValue) != 0)` | Builds with a directly addressable mask |
| `let sample = read(); sampleOut = sample;` | Builds, local home omitted before allocation |
| `let sample = read(); poke($0402, sample);` | Builds, local home omitted |
| `let sample = read(); if ((sample & 1) != 0)` | Builds, read stays in A |
| `let sample = read(); if (sample != 0)` | Builds, read owns Z |

## Measured costs

Wrapper for every sequence: `PHA`/`CLD`/`PLA`/`RTI` = 4 bytes, 15 cycles, 4 stack bytes.
Cycles below are the generated wrapper+body nominal model. A real NMI entry adds the documented
7-cycle CPU sequence and the 7-cycle KERNAL `$FE43` stub; no VICE cycle claim is made here.

| Form | Handler bytes | Cycles | Private storage |
|---|---:|---|---:|
| bare zero | 14 | 27 store path, 22 skip path (23 with page-cross allowance) | 0 |
| Boolean `& 1` | 12 | 25 | 0 |
| Boolean inverse | 14 | 27 | 0 |
| addressable mask | 17 | 31 store path, 26 skip path (27 with allowance) | 0 |
| local store | 10 | 23 | 0 |
| local memory write | 10 plus the following flag store | 23 plus the following flag store | 0 |
| local bit condition | 16 | 29 store path, 24 skip path (25 with allowance) | 0 |
| local zero condition | 14 | 27 store path, 22 skip path (23 with allowance) | 0 |

Every form reports `zeroPage = 0`, `scratch = 0` and `hardwareStack = 4`.

Exact expert sequences:

```asm
; bare zero
pha / cld / lda $dd0d / beq done / lda #$01 / sta flag / done: / pla / rti

; Boolean mask one
pha / cld / lda $dd0d / and #$01 / sta flag / pla / rti

; addressable mask
pha / cld / lda $dd0d / and mask / beq done / lda #$01 / sta flag / done: / pla / rti

; local store
pha / cld / lda $dd0d / sta sampleOut / pla / rti
```

The `== 0` Boolean inverse inserts one `eor #$01` before the store.

## Runtime evidence

Two sequential VICE 3.10 `x64sc` cases were run on `c64-pal-prg-kernal-6581`:

| Fact | Bare zero | Single-use local |
|---|---|---|
| Artifact SHA-256 | `5966e4d749061d48079dfe02d6c436f127a29a7f2cd72549555d77eb8e69f89a` | `27e0ac569199e22567901fb691ff7c538eaaf8c961e582108899f9199afef771` |
| VICE executable SHA-256 | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` | same |
| ROM SHA-256 | `83c60d47…`, `89878cea…`, `fd0d53b8…` | same |
| Handler entry | `$0A47` | `$0A47` |
| Handler bytes | 14 | 10 |
| Observed global | `$C000 = 1` | `$C000 = $81` (timer source byte) |
| Caller return | `$E147` | `$E147` |

Both cases use genuine CIA2 Timer A NMI acceptance through the installed route. Status:
`VICE-verified / hardware-unverified`. The Boolean and addressable-mask forms are covered by
four-profile assembled-byte oracles, not by additional runtime cases.

## Restrictions kept

| Form | Result | Owner |
|---|---|---|
| Boolean from a constant mask other than `1` | `E10245` | [#148](https://github.com/blendsdk/blend65/issues/148) |
| Several simultaneously retained samples | `E10245` | #148 (contract boundary) |
| A single-use local fed by a CIA1 pending-source read | `E10245` | Keeps the existing stable CIA1 store path; not elided |
| Any real private home | `E10245` | Unchanged NMI proof |

The elided local has no SFA home, so it also has no debug symbol/location. That is the expected
consequence of eliminating the storage, not a hidden home. All four optimization modes (`none`,
`size`, `balanced`, `speed`) build the local form with `zeroPage = 0`, `scratch = 0` and
`hardwareStack = 4`.

`test/rd04/expressiveness-ledger.json` row `v4-nmi-retained-source-reads` now records exactly these
forms with two probes: the five-sample source and a constant-mask-two Boolean source.

## Deferral-expiry check

This slice expires the deferral recorded by issue #100 and #147: the bare zero, non-constant mask,
mask-one Boolean and single-use local forms are delivered and removed from the ledger. The remaining
clauses are narrowed to the non-`1` Boolean materialization and the genuine multi-sample storage
boundary, and are owned by issue #148 before #147 closes. No other deferral's rationale changed:
takeover, physical, host and producer rows keep their existing owners.

## Independent reviews

Three read-only post-implementation audits ran against the final diff:

| Lens | Verdict | Material findings and disposition |
|---|---|---|
| Machine code | PASS WITH FIXES | CIA1 local seam: local elision now uses the narrower forwardable direct-read set, matching the existing stable CIA1 store path. Staged peer load: only a single-use direct byte load is accepted, and the local helper permits only that exact peer in the consumer gap. Branch/cost witness: the pre-layout `BNE` witness no longer claims the final 27-cycle layout; the four-profile spec oracle pins the final `BEQ` polarity and the closeout records the final path. Converted zero and parameter exclusion added. |
| SFA/ABI | PASS WITH FIXES | `closeStorage` now preserves `elidedLocalBindings` and `storageInventoryHash` includes the sorted keys, so a stale/closed inventory cannot silently rebind the elided access. Lowering always derives the set from the inventory and never trusts a caller-supplied set. The helper excludes parameters/assets. The debug-symbol consequence and optimization-mode probe are disclosed. |
| Target platform | PASS WITH FIXES | The direct-read set is confirmed as one `lda absolute` per member. The CIA1 local form keeps `E10245` instead of an internal failure. Runtime scope is explicitly PAL/6581, two forms; the other forms are four-profile assembled-byte evidence. The release record records #100/#147 as post-candidate deliveries. |

No critical finding remains open. The remaining mirrored-operand forms (`mask & read()` and
`0 != read()`) are outside issue #147's table and keep the existing source-order behavior; they are
not claimed by this delivery.

## Verification

| Check | Result |
|---|---|
| #147 spec oracle | 44/44 pass (8 positives ×4, 3 negatives ×4) |
| Issue #100 oracle after authorized retirement | 16/16 pass |
| Machine impl oracle | 14/14 pass |
| Storage/elision impl oracle | 9/9 pass |
| Sequential VICE | 2/2 pass |
| Expressiveness-ledger gate | 14/14 pass |
| NMI-route + CIA2 root slice | 32 files / 778 tests pass |
| Profile pipeline | 10/10 pass |
| Foundation status oracle | 12/12 pass |
| Pinned optimizer outputs | `exact-output` 3/3, `saved-output` 17/17, `acquisition-output` 12/12 |
| Complete compiler suite | 222 files / 3,732 passed / 2 skipped, zero failures |
| `yarn build` / `yarn typecheck` | 4/4 and 7/7 Turbo tasks |
| `spec/` | Clean; no file changed |

The full root corpus was not rerun end to end; the affected root suites above cover every changed
seam: the pinned optimizer artifacts, the ledger gate, the NMI/CIA2 route behavior, the foundation
status oracle and the profile pipeline. No push.
