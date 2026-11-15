# SFA staging-home reuse — execution plan

> **Owner**: issue [#146](https://github.com/blendsdk/blend65/issues/146).
> **Scope mode**: strict. No frozen `spec/` change, no runtime, no source restriction.

## Problem

The SFA inventory plans a `return-stage` or `argument-stage` home for a value that crosses a call,
but `retainMachineValue` creates a separate `machine:<owner>:retained-value:<id>` home. The planned
home is never accessed, so it consumes RAM and publishes a debug location no instruction writes.

## Decision

Reuse the planned staging request as the retained machine home when the lowering context is a
main-domain context and the request matches the value, storage class, byte width, and has no
activation root. Fall back to the existing machine request for interrupt domains or when no planned
home exists. The byte accounting, closure certificate and debug symbol then describe the same
accessed home.

## Tasks

- [ ] T-146.1 Reproduce the unused return-stage and argument-stage homes.
- [ ] T-146.2 Add implementation tests for reuse and the no-machine-home result.
- [ ] T-146.3 Reuse the planned request in `retainMachineValue`; keep the interrupt fallback.
- [ ] T-146.4 Run the compiler and host checkpoints; closeout and issue evidence.

## Acceptance

| Area | Oracle |
| --- | --- |
| Return stage | The witness has one planned return-stage home, no `retained-value` machine home for that value, and the machine program references the planned ID. |
| Argument stage | The nested-call witness reuses its planned argument-stage home. |
| Fallback | A context without a matching planned home still creates a machine home. |
| Behavior and cost | Existing compiler/host checkpoints stay green; accepted artifacts keep their bytes. |

## Residuals

| Residual | Owner |
| --- | --- |
| Interrupt-domain staging reuse | machine home fallback remains; separate activation-root matching |
| Unmatched values | a machine home is created as before |

## Constraints

- No test or VICE journey is weakened. `spec/` and the ledger stay byte-identical. No push.
