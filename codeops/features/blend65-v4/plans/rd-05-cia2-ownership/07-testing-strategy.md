# Testing strategy: CIA2 ownership

> **Parent**: [Index](00-index.md)
> **Authority**: AR-P2–AR-P4; frozen interrupt, volatile and SFA semantics

## Independent oracles

Fresh specification author reads only this strategy, governing contract excerpts,
public service/types and approved fixtures; production and prior review/probe
answers are forbidden. Real four-profile `optimization: none` builds use ACME.
Existing test helpers and native VICE mechanisms are reused. Every native case is
sequential. Missing tools/model/ROM/host access is Unknown, not a passing skip.

## 🚨 Specification Test Cases

| Case  | Concrete input/scenario                                                                                                                                                                                                                                            | Independent expected output                                                                                                                                                                                                                                                                        | Authority                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| ST-1  | Empty callback; `setNMIExclusive(&handler); restoreNMI();` on all four cooperative profiles                                                                                                                                                                        | Check/build success; exclusive RTI, coherent matching-$47 high-only publication/restoration; no private NMI homes; unchanged external uncertainty records.                                                                                                                                         | Ch 06/15; AR-P2                 |
| ST-2  | Exclusive callback `poke($0410, 7);`, plus a separate companion calling an ordinary void constant-writing helper                                                                                                                                                   | Ordered source effects; A/X/Y/P/D preserved across real NMI; JSR/RTS helper; no NMI private RAM/ZP. Standalone A-only fixture is PHA/CLD/body/PLA/RTI: 9 bytes, 21 cycles including 5-byte/6-cycle body; entry stack 4 before helper calls. Charge the companion's helper/call separately.         | Appendix §9.2; MOS-PGM-1976     |
| ST-3  | Exclusive lease; CIA2 disable `$1F`; latch A `$1234`/B `$5678`; controls A `$19`/B `$49`; enable `$03`; one returned pending byte handled by two ordinary source bit tests in main                                                                                 | Correct widths, low/high order, preserved controls and single consuming read; both branches run for `$83`, only A for `$81`, only B for `$82`, neither for `0`; no generic dispatcher.                                                                                                             | R5.12/R5.20; MOS-6526-1981      |
| ST-4  | Owning exclusive callback `poke($0410, c64.cia2.readAndClearPendingSources());` and a companion callback with constant latch/control mutations                                                                                                                     | Exactly one LDA `$DD0D` per source call; fixed store consumes the captured byte without private staging; returning handler mutation is owned and final release cannot be undone by later old-handler arrivals.                                                                                     | Ch 06 §7.5; AR-P2/AR-P4         |
| ST-5  | Every CIA2 mutation/read-clear without NMI ownership, in ordinary stock chain, or through an unowned helper                                                                                                                                                        | One source-linked E10278/no generation. Counter reads remain legal.                                                                                                                                                                                                                                | R5.15/R5.20                     |
| ST-6  | Known bad A/B flags `$20`, enable `$10`, or enable timer source without proved mask initialization                                                                                                                                                                 | Source-linked E10278. Dynamic mainline flags preserve existing bounding semantics; no NMI mask/exclusion inference.                                                                                                                                                                                | CIA API contract; MOS-6526-1981 |
| ST-7  | Outer exclusive → clean exclusive/chain successor → matching pops; balanced helper/conditional/loop installs; one release() helper called for clean inner/final stock pops and sequential chained/typed-exclusive depth-one leases, directly and through a wrapper | Correct actual predecessor and immutable links; no syntactic nesting/helper/CFG ban; proved finite variants select the correct restore bodies and transitive call edges even at equal depth. Dirty inner/nonstock release with unproved prior mask/latch fails E10278, not fabricated restoration. | R5.16; AR-P2 item 5             |
| ST-8  | Known raw timer/control/mask mirrors, word overlaps, or `$02A1` change invalidates final stock handback; raw vector writers/erased callback/ordinary function controls                                                                                             | Actual affected release/operation fails with its existing E10278/E10244/E10247; no fresh generation. Unrelated proved-disjoint writes remain legal.                                                                                                                                                | Ch 06; R5.16; AR-P4             |
| ST-9  | Exclusive handler/helper retains five ordered volatile samples through later stores                                                                                                                                                                                | Canonical E10245 with unchanged wording, spans/related-array shape and no generation; selected helper/private scratch participates.                                                                                                                                                                | Ch 06 §7.5; AR-P3               |
| ST-10 | Final typed restore with general preserved CRA/CRB fields                                                                                                                                                                                                          | Actual source-correlated release bytes/effects match the 38-byte/56-cycle sequence in the technical spec; 2 temporary stack bytes, no new RAM/ZP; proved stock-high immediate FE, control masks C6/86 and stop-one-shot 08, one generated ICR drain.                                               | AR-P4; MOS-PGM-1976             |
| ST-11 | Genuine CIA2 A/B underflow and simultaneous pending bits, real RESTORE during lease and after release; pinned four-profile idle entry                                                                                                                              | Owned entry uses RTI and exact source policy; stock RESTORE policy resumes after release; native values, accesses, source-bit branches, caller state and normal BASIC return match the source. No direct PC jump is counted as genuine NMI.                                                        | AR-P2; primary KERNAL/MOS       |
| ST-12 | Genuine arrivals at each emitted capture/publication/removal/device-release instruction boundary; two bounded overlapping entries                                                                                                                                  | Complete old/new vector only; no stale capture or resumed old timer writer after final stock publication; one generated drain plus separately counted stock reads; exact stopped/masked controls and A/P on normal return. No arbitrary nesting/stack/silicon claim.                               | AR-P4; R5.16/R5.17              |
| ST-13 | Empty/no-hook and ordinary chained regressions; all old unauthorized test files unchanged                                                                                                                                                                          | No added CIA2 entry precondition/output for unaffected programs; stock chain never steals ICR; existing source/storage/publication tests remain GREEN.                                                                                                                                             | AR-P2; frozen Ch 15             |
| ST-14 | Positive qualification complete, then exact ledger retirement                                                                                                                                                                                                      | Retire only `v4-nmi-installation`; preserve all other ledger rows byte-for-byte and all negative assertions. RD-05/DEF-7 stay open; review deferral expiry and assign remaining landing places.                                                                                                    | AR-P3; AGENTS.md                |

## Files and verification

New concerns: `test/rd05/cia2-ownership.spec.test.ts` (ST-1/ST-3/ST-5–ST-9),
`cia2-output.spec.test.ts` (ST-2/ST-4/ST-10/ST-13), and
`cia2-vice.spec.test.ts` plus a separate release-interleaving concern when needed
(ST-11/ST-12). Split new test files before 300 lines without changing cases.
The only existing oracle edits are the two AR-P3 fixtures and later ledger row.
Implementation tests stay `*.impl.test.ts` and follow GREEN.

Directed test runs precede and follow implementation; document genuine pre-change
passes separately from expected RED. At the checkpoint run frozen install,
build, typecheck and full `yarn test`, with emulator cases serialized. Force
Markdown formatting for ignored CodeOps files; validate links and frozen paths.
Specialist reviews cover correctness/oracle integrity, semantics/DX, SFA/ABI,
platform, emitted output and host scaling in waves under four total agents.

Runtime identity binds source/build/profile, PRG hash, actual instruction bytes,
ACME, VICE executable/ROM hashes and selected VIC/SID/CIA models. Use current
monitor access tracepoints and source/debug ranges; do not build a new harness.

The binary monitor currently has no RESTORE-input operation. Use it for CIA2
timer cases. Define all RESTORE, STOP-matrix and instruction-boundary scenarios
and independent invariants before production, then run them in task 1.3.3 using
the existing pinned GDB/text-monitor native qualification mechanism. Its narrow
protocol stops at `mon_keyboard_feed`, applies the selected keyboard matrix,
and calls `machine_set_restore_key(0/1)` before returning to the monitor. The
installed binary routes that function through `c64keyboard_restore_key` and
the timed CPU interrupt state; it does not set the emulated PC. The previous
temporary script is a protocol example, not a durable dependency or result oracle.
No binary-monitor API, generic harness or package dependency is added.

Fresh qualification must prove the injection point preserves boundary fidelity
and causes a real NMI entry. Retain reproducible scripts, tool hashes, exact
instruction-boundary targets, source/artifact/model identities, ordered accesses,
explicit input-success assertions and bounded failing exits. Old native results
are not evidence for the new compiler. A missing or unsafe injection stays
Unknown and blocks qualification and ledger retirement.

Count payload, padding, links, code, SFA/ZP and per-entry stack separately. Report
`VICE-verified / hardware-unverified`; physical edge checks remain RD-10.
