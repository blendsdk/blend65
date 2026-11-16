# Boing-ball benchmark repair and continuation evidence

> **Status**: first bounded unit complete — benchmark repair, proof/poll and complete checkpoint green.
> **Date**: 2026-11-16
> **Commit**: coherent local checkpoint follows this verified closeout; never push automatically.

## Exact benchmark correction authority

The user's AR-P1 approval is recorded in [the execution plan](99-execution-plan.md). The benchmark
repair changed only the cost pin `twinCodeBytes: 402 -> 442`; its compiler pins and all behavior
assertions were unchanged. The separately approved compiler unit below subsequently lowers its
code pin to 1,593. The old frame comparison, canonical `none` manifest, frozen specification,
expert authority and expressiveness ledger remain unchanged throughout.

## Specification-first evidence

An independent implementation-blind author created three new oracle files. The author corrected
test-only adapters before freeze: compiled artifacts have no bare `start` symbol; the old twin's
application starts at its entry before normalization exists; application tracing must not mistake
retained KERNAL CPU-port traffic for source-owned VIC/pointer writes. No VIC/pointer expectation
was removed or filtered. Both programs are checked separately against source-derived state.

| New specification                                 | Frozen SHA-256                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `test/rd05/boing-ball-contract-vice.spec.test.ts` | `c2d3a68ab4f0aead296bdc52dc4fa1e8372b9bdaeb61cfe2cbd00e88fa5e073a` |
| `test/rd05/boing-ball-startup.spec.test.ts`       | `7662d056defb2ec251b38fb03a9e30df08ab658813a52df774b78125773a6d49` |
| `test/rd05/volatile-byte-poll.spec.test.ts`       | `33dc25bf4956542f536ef05e2b6214a1a91bd34975d29ff2d645d2afcc7d5f55` |

| Command                                                                                                                                                                                                             | Executed result                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn vitest run --config vitest.integration.config.ts test/rd05/volatile-byte-poll.spec.test.ts --reporter=verbose`                                                                                                | 9/9 RED: the next opcode after the raster LDA is capture STA `$8D`, not immediate EOR/CMP. Four profiles, both comparison polarities, plus canonical workload.                                                |
| `yarn vitest run --config vitest.vice.config.ts test/rd05/boing-ball-contract-vice.spec.test.ts --reporter=verbose` before repair                                                                                   | Compiled positive control passes all 100 trace/checkpoint-SP checks and selected independent states. Twin fails at checkpoint 1: wrong X-store order, enable before pointers and duplicate initial positions. |
| `yarn vitest run --config vitest.vice.config.ts test/rd05/boing-ball-startup.spec.test.ts` before repair, with the trace file in the same serialized run                                                            | Compiled decimal/mapping/bank/latch startup control passes. Twin fails because required CIA2 DDR preparation is absent.                                                                                       |
| `yarn vitest run --config vitest.vice.config.ts test/rd05/boing-ball-startup.spec.test.ts test/rd05/boing-ball-contract-vice.spec.test.ts test/rd05/boing-ball-parity.spec.test.ts --reporter=verbose` after repair | **3 files / 5 tests pass**; 60.55 s test time, 64.86 s total. Includes unchanged original cross-program checkpoints 2/6/10/99/100.                                                                            |
| `yarn vitest run --config vitest.integration.config.ts test/rd05/boing-ball-parity-cost.impl.test.ts --reporter=dot` after authorized pin correction                                                                | **1/1 passes**. Before pin correction, this test failed only at twin 402 expected / 442 measured.                                                                                                             |

The new trace test checks source-order/count and checkpoint SP for 100 checkpoints **per program**.
Independent values are checked at 1/2/6/10/99/100, not after every individual store. The startup
test injects decimal mode through checked unused CPU-RAM padding and perturbs CPU/CIA2/display
state; it checks D, I, mapping, latent latch preservation, screen, sprite-enable and vectors. This
is directed coverage, not exhaustive entry-state or physical-silicon qualification.

## Fresh assembled twin attestation

The primary assembled an owned scratch copy with ACME, read its exact bytes/symbols and deleted
the scratch tree. PRG SHA-256:
`1623eaa9fa6b717623c02d371fe3cfb3adbeb7ff50558c0c691f7b85c00587f2`.

| Symbol / cost                       | Measured result                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `start` / `applicationStart`        | `$080D` / `$0831`                                                               |
| `wait` / `framePoint` / `codeEnd`   | `$0885` / `$088C` / `$09C7`                                                     |
| Poll bytes                          | `AD 12 D0 C9 FB D0 F9`; same-page taken loop, 7 bytes / 9 nominal cycles        |
| Code                                | 442 bytes: 36 profile startup + 406 application/shared code                     |
| BASIC stub / asset / padding        | 12 / 1,024 / 5,689 bytes                                                        |
| PRG payload / header                | 7,167 / 2 bytes                                                                 |
| ZP / other declared application RAM | 12 / 0 bytes                                                                    |
| Mainline hardware stack             | 0 retained / 2 transient bytes, excluding caller and firmware/interrupt context |

The original 402-byte twin omitted live profile duties and violated source effects. Its 40-byte
correction is not a compiler optimization or packaged-size win. Current compiler `none` remains
1,599 code / 7,167 payload / 0 ZP, with a 1,157-byte code gap against the repaired twin.

## Separately labelled optimized-mode probe

Public builds of exact source/asset copies in owned scratch, with explicit mode overrides, measured
both `size` and `balanced` at 1,512 code / 7,167 payload / 10 ZP / 7,281 resident RAM / 1 reported
hardware-stack / 0 scratch. These do not replace the canonical `none` pins. Each mode selected its
canonical candidate; the other two candidates were rejected because raw/control/platform or
asynchronous observations remained unproved. Entry-to-return cycles are `Unknown` for every
measured mode. This probe changes no source or manifest and makes no optimized-runtime claim.

## Independent bounded reviews

| Role                      | Result and scope                                                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `machine-code-auditor`    | No findings in twin repair. MC-001/002 corrected; 442-byte accounting independently reconciled, helper stack balanced, X ownership valid. Complete compiler costs/timing and PF-001 remain open.                                                                                 |
| `target-platform-auditor` | No findings in repaired startup and two additive VICE oracles. No generated IRQ/NMI route is added; inapplicable generated-route items are N/A, retained firmware remains separate.                                                                                              |
| `correctness-reviewer`    | No findings in bounded diff and new tests under supplied full-standard excerpts. Exact AR-P1 pin exception checked; no full-checkpoint or compiler clearance. A native denied external standards read was not retried; the primary supplied previously read applicable excerpts. |

Reviewers used parent-authorized normative excerpts, not skill qualification cases or graders.
Expert `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; governing sources
`BLEND65-SPEC-4-038b70e9`, `MOS-PGM-1976`, `CBM-C64-PRG-1982` and pinned KERNAL route facts.
The claimed runtime endpoint remains `VICE-verified / hardware-unverified`.

## Continuation boundary

PF-001 and its reserved complexity packet live in
[the preflight report](00-preflight-report-99-execution-plan.md#pf-001-reserved-complexity-decision--approved-planning-boundary).
The approved standalone proof passed preflight and now supplies the bounded publication handoff.
No observation contract or source restriction changed; all existing named-source observer checks
remain default-conservative. The nine original poll cases and new 32-case publication suite pass.
The actual complete checkpoint passes. Whole-program parity and issue closure are not claimed.
Portfolio cascade is deferred on `feature/v4-rebuild`, as required by the roadmap integration rule.
All owned scratch probe trees were deleted by their `finally` cleanup.

## Bounded compiler poll — verified partial

Child progress and detailed evidence are owned by the
[publication proof execution plan](../boing-ball-publication-proof/99-execution-plan.md) and
[verification record](../boing-ball-publication-proof/08-verification.md).

| Boundary                 | Current evidence                                                                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local poll               | Exact `AD 12 D0 49 FB D0 F9`: one volatile read, EOR retained, seven bytes / nine same-page nominal taken cycles; IRQ/DMA excluded                                                                                     |
| Canonical code           | 1,599→1,593; 1,151-byte gap against the equivalent 442-byte twin remains                                                                                                                                               |
| Complete artifact        | 1,593 code + 1,024 asset + 4,538 padding + 12 stub = 7,167 payload; no payload win                                                                                                                                     |
| Resources                | 0 ZP, 7,271 reported resident RAM, 1 bounded reported hardware-stack, 0 scratch; prior RAM delta and unrestricted firmware-inclusive peak Unknown                                                                      |
| Directed post-fix checks | 79 compiler controls; 42 public output/cost checks pass                                                                                                                                                                |
| Runtime                  | Five startup/trace/state/original-comparison checks pass; the actual complete post-fix serialized tier passes 130 files / 2,379 tests, with existing skips.                                                            |
| Reviews                  | Six independent lenses clear. Firmware-routing eligibility gap and two scaling findings fixed, verified and independently fix-reviewed                                                                                 |
| Gates                    | Install/build/typecheck, changed+host, `yarn test` and actual `yarn test:full` pass; compiler 240 / 3,995 + 2 skips, root host 246 / 5,153, VICE 130 / 2,379 + 1 file / 4 test skips. Full gate 5,101.66 s, exit zero. |

The proof rejects unproved low-RAM/CIA routing, helpers, executable initializers, aliases and stale
identities rather than adding firmware state analysis. It changes only anonymous byte retention.
Later zero-page or block/edge units still require a grounded plan and their own proof; no such
implementation is silently included in this checkpoint.

## First-unit closeout and continuation

PF-001's missing-proof rationale is discharged by the specifically approved bounded helper and
its complete green checkpoint; it is not an observer waiver. The scoped deferral-expiry walk is
recorded in the child's verification record. No other reason for a language, runtime, hardware or
general-analysis deferral expires. The measured 1,151-byte code gap and unproved steady-state cycle
parity remain due under #168, which stays open.

The next independently preflighted [dead-teardown unit](../boing-ball-dead-teardown/99-execution-plan.md)
removes only the proved-dead restore path; startup entry and snapshots remain unchanged. Its D1
waits for this green local commit. No new teardown tests or compiler edits entered this checkpoint.

The read-only plan helper counts this checklist as **8/8 verified / Done**, but exits nonzero
because it demands `00-index.md` and an `Implements` declaration. The exec-plan lightweight-task
contract explicitly permits this single-file mini-plan. No unnecessary index was added to satisfy
that helper limitation. Direct file-link, checklist, formatting and frozen-oracle checks pass.
