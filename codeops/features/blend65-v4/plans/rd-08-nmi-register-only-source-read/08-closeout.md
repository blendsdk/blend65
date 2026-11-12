# Closeout — NMI Register-Only Source Reads

> **Status**: Delivery complete; root verification recorded below
> **Updated**: 2026-11-12
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Issue**: [#100](https://github.com/blendsdk/blend65/issues/100)

## Delivered boundary

A single-use byte result from a `platform` operation now stays in A when its only consumer is
an adjacent byte `&`, `|` or `^` with a compile-time constant mask, in either operand order. The
change is one rule in `selectRegisterForwarding`; the NMI private-home proof, the storage model and
the specification are untouched.

Both issue #100 witnesses now build on all four cooperative profiles:

| Form | Result |
|---|---|
| `pendingSources = readAndClearPendingSources();` | Builds, zero private storage, expert-equal output |
| `if ((readAndClearPendingSources() & sourceTimerA) != 0) { timerFinished = true; }` | Builds, zero private storage, expert-equal output |
| `if ((sourceTimerA & readAndClearPendingSources()) != 0)` | Builds, zero private storage |

The read remains exactly one volatile access. No storage is created, shared or moved, and no
instruction is added after SFA closure.

## Measured costs

| Item | Emitted |
|---|---|
| Assignment handler | 10 bytes, 23 cycles, 4 stack bytes (byte-for-byte the issue's expert target) |
| Conditional handler | 16 bytes, 29 cycles on the store path, 24 page-local on the skip path (25 with the cost model's page-cross allowance), 4 stack bytes |
| Handler resource use | `scratch = 0`, `zeroPage = 0`, one placed global byte |

Conditional sequence:

```asm
pha
cld
lda $dd0d
and #$01
beq done
lda #$01
sta $C000
done:
pla
rti
```

X and Y are untouched by both bodies, so the selected wrapper omits their pushes under the existing
dead-register rule. The full A/X/Y shape still applies to bodies that clobber them.

## Runtime evidence

One sequential VICE 3.10 `x64sc` case on `c64-pal-prg-kernal-6581`:

| Fact | Value |
|---|---|
| Artifact SHA-256 | `be47851bc3e44956fe38b8e7b744883812ad03e454e442ad17f6b77ee6f23178` |
| VICE executable SHA-256 | `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74` |
| ROM SHA-256 | `83c60d47…`, `89878cea…`, `fd0d53b8…` |
| Handler entry | `$0A47` |
| Restore entry | `$099F` |
| Observed global | `$C000 = 1` after the NMI handler |
| Caller return | `$E147` |

The case uses genuine CIA2 Timer A NMI acceptance through the installed route, not a monitor PC jump.
Status: `VICE-verified / hardware-unverified`.

## Restrictions kept

| Form | Result | Owner |
|---|---|---|
| Several simultaneously retained samples | `E10245` | [#147](https://github.com/blendsdk/blend65/issues/147) |
| Single-use local in an interrupt function | `E10245` | #147 (local elision) |
| Bare `if (read() != 0)` | `E10245` | #147 (producer flag ownership) |
| Mask from a non-constant operand | `E10245` | #147 (operand-load safety) |
| Boolean value assigned from the bit test | `E10245` | #147 (Boolean fact; current lowering is 8 bytes worse than expert) |
| Any real private home | `E10245` | Unchanged NMI proof |

`test/rd04/expressiveness-ledger.json` row `v4-nmi-retained-source-reads` now records exactly these
forms with five probe sources.

## Deferral-expiry check

This slice expires part of its own recorded deferral: the ledger row previously covered "assigns a
consuming read to a global/conditional", and that clause is now delivered and removed from the row.
The remaining clauses are narrowed, probed and owned by issue #147 before #100 closes, so no deferral
is orphaned. No other deferral's rationale changed: the takeover findings, physical, host and
producer rows keep their existing owners.

## Verification

| Check | Result |
|---|---|
| Complete compiler suite | 220 files / 3,709 passed / 2 skipped, zero failures |
| Spec oracle (`test/rd08/nmi-source-read.spec.test.ts`) | 32/32 pass (12 positives, 20 negatives) |
| Runtime oracle (`test/rd08/nmi-source-read-vice.spec.test.ts`) | 1/1 pass |
| Implementation oracle (`src/machine/nmi-source-read.impl.test.ts`) | 8/8 pass |
| Expressiveness-ledger gate | 14/14 pass |
| Pinned optimizer outputs | `optimizer-exact-output` 3/3, `saved-output` 17/17, `acquisition-output` 12/12 |
| NMI/CIA2 root slice | 32 files / 778 tests pass |
| Foundation status oracle | 12/12 pass |
| Profile pipeline | 10/10 pass |
| `yarn build` / `yarn typecheck` | 4/4 and 7/7 Turbo tasks |
| `spec/` | Clean; no file changed |

The full root corpus was started and stopped after 27 of 329 files so the session stayed bounded; it
showed no failure except an escaped README status label from the takeover update ("production release
is qualified" instead of the oracle's "production candidate is qualified"). The README now uses the
required truthful wording and the foundation oracle passes. The affected root suites listed above
cover the lowering change, the pinned optimizer artifacts, the ledger gate and the NMI/CIA2 route
behavior. No push.
