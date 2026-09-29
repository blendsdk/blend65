# Testing Strategy: CIA1 Return to BASIC

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Authority qualification before compiler tests

The approved contract must first replace only the cooperative CIA1-return sentence in the frozen C64 appendix and matching RD-05 R5.4/AC-04 wording (AR-P2, AR-P5). A candidate expert qualification case must distinguish an unsafe claim of arbitrary bit-exact CIA1 restoration from the approved stock-compatible handback. Show that it fails against the old knowledge, then run the existing 27-rule Language Guard applicability check, changed/dependent expert cases and fixed unchanged controls. The candidate is independently reviewed and activated as the sole qualified baseline only after the required explicit final evidence approval. This is a documentation/authority checkpoint, not a compiler test run; no new evaluator or second spec layer is created (AR-P5).

## Specification Test Cases

These input→expected pairs are derived from RD-05 R5.4/R5.13/R5.15–R5.20, the approved AR-P2–AR-P5 correction, and [the design](03-cia-basic-return.md). Specification tests are written before compiler changes and are never weakened to fit output.

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-1 | On each cooperative profile, use a valid CIA1 handler and this complete entry sequence: `asm_php(); asm_sei();`, `setIRQExclusive(&handler)`, `c64.cia1.disableInterruptSources(c64.cia1.sourceAll)`, one `c64.cia1.readAndClearPendingSources()`, then `asm_plp()` at the qualified safe point. Configure/use CIA1 Timer A and enable its source under the existing ownership contract; finally call `restoreIRQ()` and return from `main`. | `checkProject` reports no E10278, build emits a PRG, and the final restore is marked for stock CIA1 handback. Before implementation, entry setup must pass and the expected-red E10278 must identify the final `restoreIRQ()`. | RD-05 R5.4/R5.16/R5.20; AR-P2–AR-P3; PF-002 |
| ST-2 | Install and finally restore an exclusive IRQ handler without a typed CIA1 write. | The final exclusive restore still emits one stock handback; a plain `setIRQ`/`restoreIRQ` chain emits none. | AR-P3; 03 §Contract and boundary |
| ST-3 | Configure CIA1 under outer exclusive handler A; temporarily install handler B that makes no CIA1 change; restore B, then restore A. | Both restores compile; B's pop is vector-only, A's pop performs exactly one CIA1 handback, and predecessor links remain LIFO. | RD-05 R5.16; AR-P3 |
| ST-4 | Install A, then nested B changes CIA1 configuration and attempts to restore A's vector while A remains active. | Source-linked E10278 at the inner `restoreIRQ()`; no artifact. | RD-05 R5.16–R5.17; AR-P3 |
| ST-5 | A source-known chained handler precedes the exclusive handler, or a known raw CINV write invalidates its saved predecessor; then attempt a dirty reverse handoff. | Source-linked E10278 before emission; no stock reset is silently applied to the nonstock owner. | RD-05 R5.16; AR-P3 |
| ST-6 | After CIA1 takeover, return from `main` without releasing the installed exclusive handler. | Existing ownership E10278; no BASIC-returning artifact. | RD-05 R5.4/R5.16; AR-P3 |
| ST-7 | Both arms of a source `if` reach the same final exclusive restore, one arm configuring Timer A and the other leaving it unchanged; include a called helper and a loop that changes only a bounded timer parameter. | The final restore remains one compile-time-selected handback, legal on both paths; no runtime ownership flag or extra function storage. | RD-05 R5.16–R5.17; AR-P3; 03 §Compiler integration |
| ST-8 | Compile ST-1 for PAL and NTSC, with either SID model, and inspect the final restore's device trace. | One full mask-clear write, Timer A/B stop, one consuming CIA1 ICR read, low-then-high reload writes (`$25/$40` PAL; `$95/$42` NTSC), exact two-byte saved CINV restore, one Timer-A-only mask set, Timer A load/start, then status restore. No CIA2/SID access or whole `IOINIT` call. | RD-05 R5.13/R5.20; AR-P2–AR-P4; 03 §Direct machine transaction |
| ST-9 | Compile the same source with a selected IRQ wrapper and compare emitted and expert assembly for the equal-contract final handback and IRQ route. | No extra runtime flag, helper, scratch, RAM or ZP; identical volatile direction/count/order; local handback delta ≤0 bytes and ≤0 cycles versus expert, with existing-ROM bytes reported separately from emitted bytes. | RD-05 R5.13/R5.17; AR-P3–AR-P4 |
| ST-10 | Reuse ST-1's complete valid entry setup in sequential fresh ACME 0.97/VICE 3.10 runs of all four cooperative PRGs from stock BASIC, with an old Timer A event armed at handback and a normal `main` return. | No torn CINV dispatch; game sources are consumed before release; BASIC/KERNAL Timer A ticks and keyboard service continue after RTS; return status/stack and unrelated CIA2/SID state match their entry contract. | RD-05 AC-04/AC-06/AC-16; AR-P2–AR-P4; PF-002 |
| ST-11 | A known raw CIA1 control/ICR mutation not covered by the typed owned timer contract reaches the final restore. | E10278 rather than an unsupported claim that the stock handback reconstructed all raw device state. An opaque runtime-address write stays the existing explicit caller-owned hardware escape. | RD-05 R5.17/R5.20; AR-P3 |

## Test files and verification

| Test tier | File / checks | Coverage |
|---|---|---|
| Independent specification | `test/rd05/cia-basic-return.spec.test.ts` | ST-1–ST-7, ST-11; real project/check entry, exact source spans |
| Superseded specification expectations | `test/rd05/cia-ownership.spec.test.ts` | Only the three former final-exclusive-restore rejection cases identified in PF-001; preserve their source fixtures and all remaining safety expectations |
| Independent output/cost | `test/rd05/cia-basic-return-output.spec.test.ts` | ST-2–ST-3, ST-8–ST-9; selected assembly and expert budget |
| Independent runtime | `test/rd05/cia-basic-return-vice.spec.test.ts` | ST-10; reuse existing sequential ACME/VICE helpers |
| Implementation internals | `packages/compiler/src/semantic/cia-return.impl.test.ts`, `packages/compiler/src/machine/cia-return.impl.test.ts` | Route-depth joins, handler/helper effects, selected lowering, raw-address classification and preservation |

Under PF-001, the implementation-blind spec author updates only the three old rejection expectations for final exclusive restore after Timer B enable/full disable, a typed timer write, and a selected handler helper's timer mutation. Their source fixtures remain intact; update only obsolete expectation wording and its matching names/comments. Record the corrected authority in the spec-author evidence, keeping plan identifiers out of test code. Raw-write, unsafe inner-restore, and unreleased-handler negative cases retain their current expectations.

Use real compiler objects and the existing emulator helper, not a new harness. Security scope is limited to the existing closed profile/operation allowlists and source-linked rejection of invalid ownership; there is no network, authentication, persistent data, or new untrusted input format. The three new files and the three superseded expectations must be red for the missing handback before compiler implementation and green afterward; report already-green controls separately. Directed cases run during tasks; each compiler phase checkpoint runs `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`, with VICE cases sequential. The authority-only checkpoint validates the 27-rule applicability result, exact spec/skill identity, qualification/controls, links, source keys, and targeted formatting; it does not run the compiler suite (AR-P4–AR-P5).
