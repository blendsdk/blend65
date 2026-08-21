# Component Design: Envelope, Identity and Observation

> **Document**: 03-02-envelope-identity-observation.md
> **Parent**: [Index](00-index.md)
> **Decisions**: AR-P7, AR-P8

## Responsibility

Turn only a selected valid generated case into an executable program without changing its RD-02
identity or embedding the RD-03 answer. Establish the target input fixture, allocate observable
state through the compiler, and prove the final layout before runtime evidence is accepted.

## Envelope IR

`ExecutionEnvelopeIrV1` is distinct from RD-02 `GenModule`. It contains the source-case digest,
complete typed external argument literals, one entry call, actual-observation declarations, a
non-success completion initializer and one completion-last store. Its validator accepts only the
closed primitive set required by the nine modeled rules.

The renderer emits a deterministic `main(): void` for valid cases. Scalar-returning cases store the
actual bytes into compiler-allocated module globals. Memory-write intrinsics use the narrowly
declared direct MMIO observable when mirroring into RAM would change semantics. The completion byte
starts at `0x00` and is written `0xA5` only after every actual store. Invalid diagnostic cases keep
their exact original source and cannot be enveloped.

## Initial state projection

`ExecutionInitialStateFixtureV1` and projection `c64-vic-color-readback-v1` establish the current
C64 fixture:

| Cell | Before entry | Oracle-visible value |
|---|---|---|
| `$D020` | write fixture low nibble, read back | `0xF0 | lowNibble` |
| `$D021` | write fixture low nibble, read back | `0xF0 | lowNibble` |
| `$D022` | write fixture low nibble, read back | `0xF0 | lowNibble` |

Word reads combine adjacent projected bytes little-endian. The route verifies all touched cells
before entry and gives the identical host fixture to RD-03 evaluation. A missing cell, unsupported
projection, or readback mismatch is non-passing. The projection cannot become selectable authority
until real VICE proves all three registers plus direct `$D020` and computed `$D021` word starts.

## Two-stage execution identity

1. The pre-build identity hashes the immutable source-case identity, rendered source digest,
   argument bindings, envelope/selector/fixture revisions, target, budgets, handler revisions and
   declared observation request.
2. The final identity additionally hashes ACME label/report-derived addresses and the accepted
   layout proof.

Replay requires the historical revisions named by the record. It never substitutes current
handlers. Changing any identity input changes the execution identity while the RD-02 source-case
identity remains byte-identical.

## Layout proof

`ExecutionObservationLayoutV1` records compiler symbols for result bytes and completion. A verifier
uses emitted labels and compiler build metadata to prove that each range is unique and disjoint
from code, constants/data, semantic memory footprint, stack, MMIO and every other observation
range. It also proves the completion store occurs after actual stores in the accepted envelope IR.
Fixed absolute ordinary-RAM addresses and post-build binary patching are forbidden.

## Failure behavior

Envelope validation, expectation-text leakage, incomplete arguments, stale sentinel, missing
labels, overlapping ranges, unsupported direct observables and fixture mismatches return stable
pre-runtime failures. No such failure may be converted into partial passing evidence or allowed to
launch VICE.
