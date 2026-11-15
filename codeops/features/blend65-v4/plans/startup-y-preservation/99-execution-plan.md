# Startup Y-preservation — execution plan

> **Owner**: issue [#139](https://github.com/blendsdk/blend65/issues/139).
> **Scope mode**: strict. No new runtime, source restriction or `spec/` change.

## Problem

The stored-status startup saves and restores Y even when the whole program never changes it:
`STY` plus `LDY` cost 6 bytes / 8 cycles and one platform save byte. The PHP188 body and its
mapping/return operations preserve Y, so the save is redundant.

## Decision

Add a whole-program unchanged-Y fact consumed by `bindC64StartupState`:

- The machine program (functions + startup) is scanned for `ldy`, `tay`, `iny`, `dey` and `ply`.
  The startup's own Y-state `sty`/`ldy` at the saved-state offset are excluded.
- When the policy is `compact-stored` and no instruction changes Y, the startup is rebound with a
  no-Y layout: A, X, P, CPU DDR/port and CIA2 DDRA need six bytes; the entry omits `sty`, the
  restore omits `ldy`, and the status/port offsets compact by one.
- Any Y-changing instruction keeps the seven-byte save. Interrupt wrappers that temporarily save
  and restore Y with `tay`/`tya` are conservatively rejected by this scan.
- Initializer order, register handoff, effects, banking, borrowing and the ABI are unchanged.

## Tasks

- [x] T-139.1 Add the no-Y startup layout and omit the save/restore fragments.
- [x] T-139.2 Compute the whole-program Y-preservation fact in the startup binder.
- [x] T-139.3 Add construction and fact tests.
- [x] T-139.4 Update the stored-status output and native behavior oracles.
- [x] T-139.5 Run the 16 VICE behavior cases and the compiler/host checkpoints.

## Acceptance

| Area | Oracle |
| --- | --- |
| Startup bytes | 86 → 80 bytes. |
| Startup cycles | 135 → 127 nominal cycles. |
| Platform state | 7 → 6 bytes. |
| Payload/resident | ≤ 471 / ≤ 477. |
| Y-changing program | The seven-byte save remains. |
| Native behavior | 16 VICE status/initializer/borrow cases pass. |

## Residuals

| Residual | Owner |
| --- | --- |
| Balanced handler Y save/restore recognized as preserving | #139 precision debt |
| Other register-preservation facts | not claimed |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
