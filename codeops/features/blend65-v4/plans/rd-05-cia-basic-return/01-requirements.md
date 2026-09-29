# Requirements: CIA1 Return to BASIC

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) — owning requirements document

## Scope of this plan

### In this plan

- RD-05 R5.4/AC-04: cooperative-profile normal BASIC return after an owned CIA1 timer/mask takeover, under the approved stock-compatible rather than arbitrary bit-exact write-only-state contract (AR-P2, AR-P5).
- RD-05 R5.15–R5.17/AC-13–AC-14: release the outermost exclusive IRQ route without exposing its predecessor to an incompatible CIA1 state; retain exact LIFO vector ownership and complete route evidence (AR-P3).
- RD-05 R5.20/AC-16: restore the pinned KERNAL Timer A source and preserve device access count/order at the handback (AR-P2–AR-P4).
- RD-05 R5.13/AC-35: compare the emitted exit sequence with an equal-contract expert handback, keeping the hot IRQ path unchanged (AR-P3–AR-P4).

### Outside this plan

- DEF-7 CIA2/NMI/RESTORE source ownership, raw takeover, custom pre-entry resident IRQ/CIA1 state, and unrelated RD-05 workload families (AR-P1–AR-P3).
- Physical revision-sensitive CIA-edge proof before RD-10; VICE status is bounded as `VICE-verified / hardware-unverified` (AR-P4).

## Plan-local decisions

| Decision | Chosen | Authority |
|---|---|---|
| Write-only prior device state | Recreate stock BASIC/KERNAL CIA1 Timer A service, not arbitrary old latch/mask bytes | AR-P2 |
| Source operation and nested ownership | Existing outermost `restoreIRQ()` transaction; safe inner vector-only pop or E10278 | AR-P3 |
| Authority ordering | Correct the narrow frozen contract and dependent qualified expert baseline before compiler code | AR-P5 |
| Verification | Existing full checkpoint plus directed output and sequential four-profile VICE | AR-P4 |

## Slice acceptance

The slice is complete only when the corrected single authority is qualified, the [ST cases](07-testing-strategy.md#specification-test-cases) and full checkpoint pass, the handback matches expert assembly cost for equal effects, an independent review is clear, and its closeout names the still-open DEF-7 and RD-05 work. This plan does not mark RD-05 Done (AR-P1–AR-P5).
