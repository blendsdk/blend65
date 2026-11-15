# Startup Y-preservation — closeout

> **Issue**: [#139](https://github.com/blendsdk/blend65/issues/139)
> **Plan**: [99-execution-plan.md](99-execution-plan.md)
> **Preflight**: [00-preflight-report-99-execution-plan.md](00-preflight-report-99-execution-plan.md)
> **Status**: Done
> **Recorded**: 2026-11-15

## Delivered

The stored-status startup now omits the Y save/restore and its platform byte when the whole
machine program preserves Y.

| Metric | Before | After |
| --- | ---: | ---: |
| Startup bytes | 86 | **80** |
| Startup nominal cycles | 135 | **127** |
| Platform state | 7 | **6** |
| Pressure payload | 477 | **471** |
| Resident bytes | 484 | **477** |

The `bindC64StartupState` owner scans `program.functions` and `program.startup` for `ldy`, `tay`,
`iny`, `dey` and `ply`, excluding the startup's own Y-state `sty`/`ldy` at offset 2. A
`compact-stored` program with no such instruction is rebound with the six-byte layout: A, X, P, CPU
DDR/port and CIA2 DDRA; the entry omits `sty`, the restore omits `ldy`, and the status/port offsets
compact by one. Any Y-changing instruction keeps the seven-byte save.

## Implementation

| File | Change |
| --- | --- |
| `packages/compiler/src/layout/startup-status.ts` | Six-byte no-Y layout and omitted save/restore fragments |
| `packages/compiler/src/layout/startup.ts` | `preserveY` input, state-data sizing, whole-program fact in `bindC64StartupState` |
| `packages/compiler/src/layout/startup.impl.test.ts` | Construction target and Y-changing negative |
| `test/rd04/stack-startup-stored-status-output.spec.test.ts` | 471 / 477 / six-byte state bounds |
| `test/rd04/stack-startup-stored-status-behavior.spec.test.ts` | Size expectation for the six-byte state |

## Verification

| Tier | Result |
| --- | --- |
| Construction test | 80 bytes / 127 cycles / 6 state bytes; no `sty`/`ldy` |
| Fact test | No-Y program binds 6 bytes; a `ldy` program keeps 7 |
| Native VICE behavior | 16/16 on four profiles |
| Public output bounds | Payload ≤ 471, resident ≤ 477, zero-page 0, scratch 0, stack 188 |
| Compiler package | 233 files / 3,918 passed / 2 skipped |
| Host checkpoint | 235 files / 5,045 passed |
| `spec/` and ledger | Byte-identical |

## Residuals

| Residual | Owner |
| --- | --- |
| Balanced handler `tay`/`tya` save-restore recognized as preserving | #139 precision debt |
| Other register-preservation facts | not claimed |

## Deferral-expiry check

No deferral's reason is invalidated. The whole-program fact covers functions, initializers and the
startup; interrupt wrappers that transiently change Y are conservatively excluded, not falsely
accepted. The seven-byte save remains for any Y-changing program.
