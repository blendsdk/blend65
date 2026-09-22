# Phase 8 Qualification Review

> **Status**: In progress — immutable M1 qualification is green; expert-cost scope ruling AR-P2 is pending
> **Scope**: M1 ACME/VICE qualification and RD-03 handoff

## Qualification Before Expert Comparison

- The immutable pipeline oracle hash remains `9bdb81370f21037c28437e77d142b0bab848434b2162da39be55640f612de0d7`.
- The immutable VICE oracle hash remains `62b0839357d2bb80d935f4bf711ae0a50964dfde67002b8a2b590940eb1b8c3d`.
- The public M1 build passes through real ACME 0.97.
- The complete fixed input trace passes on VICE 3.10, including all game state, eight sprite
  publications, resident asset bytes, restoration and BASIC return.
- Runtime status is `VICE-verified / hardware-unverified`.

## Immutable Expert Comparison

The expert twin and baseline ledger remained read-only. The generated values come from the final
layout and cost sidecars produced by the same qualified M1 build.

| Dimension | Expert twin | Generated `none` | Result |
|---|---:|---:|---|
| Behavior, restoration and BASIC return | Required | Complete fixed trace passed | Meets |
| PRG body including required placement padding | 6,655 bytes | 6,655 bytes | Meets |
| BASIC stub, startup/restore and function code | 1,268 bytes | 5,890 bytes | Worse by 4,622 bytes |
| Data including the single 512-byte sprite payload | 636 bytes | 637 bytes | Worse by 1 byte |
| Permanent/temporary zero page | 0 bytes | 4 bytes | Worse by 4 bytes |
| Static mutable storage | 106 bytes | 144 bytes | Worse by 38 bytes |
| Program-owned hardware-stack peak | 2 bytes | 12 bytes | Worse by 10 bytes |
| Runtime asset copying | 0 bytes | 0 bytes | Meets |
| Complete fixed-trace cycles | Pending independent measurement | Unknown | Not comparable |

The equal final PRG size comes from the same required sprite placement at `$2000`; it does not hide
the local code and storage gap. Closing the gap needs register retention/allocation, loop and indexed
address strength reduction, and inlining or equivalent call-shape work. Those are RD-08 optimizer
capabilities, not a small Phase 8 correction. AR-P2 therefore asks whether to restore R3.33/AC-31's
original baseline-only boundary or keep RD-03 open until that later optimizer work exists.

No independent final phase review has run yet. It follows the AR-P2 ruling so the reviewer assesses
the correct accepted scope.
