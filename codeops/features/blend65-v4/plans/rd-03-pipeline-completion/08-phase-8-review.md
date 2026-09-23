# Phase 8 Qualification Review

> **Status**: GREEN on Linux; exact generated-versus-expert VICE rendering passes
> **Scope**: M1 ACME/VICE qualification and RD-03 handoff

## Qualification Result

- The immutable pipeline oracle hash remains
  `9bdb81370f21037c28437e77d142b0bab848434b2162da39be55640f612de0d7`.
- The immutable VICE oracle hash remains
  `62b0839357d2bb80d935f4bf711ae0a50964dfde67002b8a2b590940eb1b8c3d`.
- The public M1 build passes through real ACME 0.97.
- The generated program and frozen expert twin each pass all 441 fixed inputs in VICE 3.10.
- Their rendered frames, logical state, ordered device traffic, restoration and BASIC return match.
- Runtime status is `VICE-verified / hardware-unverified`.

## Immutable Expert Comparison

The expert twin and baseline ledger remained read-only. Generated values come from the final M1
layout and cost sidecars.

| Dimension | Expert twin | Generated `none` | Result |
|---|---:|---:|---|
| Behavior, rendering, restoration and BASIC return | Required | Complete 441-input trace passed | Meets |
| PRG body including required placement padding | 6,655 bytes | 6,655 bytes | Meets |
| BASIC stub, startup/restore and function code | 1,268 bytes | 3,551 bytes | Worse by 2,283 bytes |
| Resident non-code data including one sprite payload | 636 bytes | 632 bytes | Better by 4 bytes |
| Permanent/temporary zero page | 0 bytes | 4 bytes | Worse by 4 bytes |
| Static mutable general RAM | 106 bytes | 142 bytes | Worse by 36 bytes |
| Program-owned hardware-stack peak | 2 bytes | 6 bytes | Worse by 4 bytes |
| Runtime asset copying | 0 bytes | 0 bytes | Meets |
| Complete fixed-trace cycles | Pending independent measurement | Unknown | Not comparable |

The equal final PRG body size comes from the required sprite placement at `$2000`; it does not hide
the local code and storage gaps. The Phase 8 timing corrections reduced generated code without
changing the language or adding an optimizer mode. General register allocation, block layout,
inlining and broader strength reduction remain RD-08 work under AR-P2.

## Independent Review Corrections

The independent review and its single fix-only re-review found no surviving critical or major
issue after the user accepted the findings. The completed corrections are:

| Finding | Result |
|---|---|
| RV-001 | Module `let` initialization remains executable; constants avoid needless resident homes; BSS follows loaded data. |
| RV-002 | VICE compares display signatures, active VIC/CIA2 fields, entry/return CPU state and stack restoration. |
| RV-003 | Qualification pins the VICE executable and KERNAL, BASIC and character ROM identities. |
| RV-004 | Evidence separates the 6-byte program peak, 6-byte measured interrupt save and 20-byte platform reserve. |
| RV-005 | The frozen expert twin runs through the same 441-input oracle and records separate runtime evidence. |
| RV-006 | Failed socket ownership attestation destroys the socket before rethrowing. |
| RV-FIX-001 | VICE post-spawn setup now cleans up the owned child on failure. |
| RV-FIX-002 | Stack evidence uses narrow measured labels and reports the separate reserve. |
| RV-FIX-003 | Expert assembly uses the admitted bounded ACME 0.97 path. |
| RV-FIX-004 | Checkpoint events drain per frame and have a fixed journey-derived bound. |
| RV-FIX-005 | Final measurements supersede the issue's obsolete intermediate counts. |

## Rendered-Timing Correction

The strengthened oracle initially exposed a generated-only publication-timing defect. Logical
state, sprite registers and ordered game-loop traffic already matched the expert, so the fault was
in generated execution time rather than VICE or game semantics.

AR-P6 through AR-P10 applied only bounded, generally valid lowering corrections:

| Correction | Scope guard | Result |
|---|---|---|
| Direct raster boundary wait | Exact `$D012`/`$FB` condition | Established the required publication boundary |
| Affine aggregate-address reuse | Same root/index/stride with invalidation | Mismatches reduced to 24 |
| Forward CFG fact propagation | Single-predecessor paths only | Mismatches reduced to 9 |
| Acyclic identical-fact meet | Identical incoming facts; never a backedge | Removed 195 code bytes; mismatches stayed at 9 |
| Loop-carried affine pointer | One canonical single-latch loop with strict alias/effect guards | Removed 215 more code bytes; all 441 frames passed |

The final loop lowering initializes the existing pointer once and advances it by the proved constant
stride. Any uncertain shape falls back to ordinary recomputation. It adds no new IR, pass manager,
public API, dependency, runtime or storage class. Zero-page use remains 4 bytes. This keeps the path
open for RD-08 to subsume or generalize the optimization instead of making the compiler depend on an
M1-specific workaround.

## Final Evidence

| Check | Result |
|---|---|
| M1 public build and eight-file publication | PASS |
| Pure behavior and pipeline tests | 6/6 PASS |
| Focused lowering tests | 18/18 PASS |
| Sequential VICE generated/expert journey | 1/1 PASS; all 441 rendered frames exact |
| Repository build and typecheck | PASS |
| Repository tests | PASS: compiler, CLI, editor packages and 68 root tests |
| Touched-file Prettier and `git diff --check` | PASS |
| Frozen `spec/` worktree | Clean |
| Lint | Not configured in this checkout: no script, Turbo task or ESLint executable |

The Linux phase is GREEN. Native Node 22 Windows x64 qualification remains the explicitly deferred
DEF-3 evidence owned by RD-10; it does not block RD-04 through RD-09.
