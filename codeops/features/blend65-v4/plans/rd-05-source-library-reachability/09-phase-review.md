# Source-library phase review

> **Status**: Complete — required fixes verified; six fix-only reviews clear
> **Baseline tree**: `0ed834a7ce1021214ca5066e80b4912f66015f76`
> **Reviewed implementation**: `a8af0532`
> **CodeOps Artifact Schema**: 1

Six independent native read-only roles reviewed the complete bounded diff and direct consumers.
Only the primary owns verification. No reviewer ran a competing build, test or emulator.

| Review                         | Result / endpoint                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Correctness / oracle integrity | No findings. New spec authority, RED history, exact AR-8 scope and non-writing AR-9/10 observation extensions checked. No old spec or frozen authority edit.             |
| Semantics / modern DX          | No in-scope findings. Root/metadata/selection interfaces clear; full finite-target expressiveness not established. Separate baseline helper-assignment limitation below. |
| SFA / ABI                      | No findings. Same selected program reaches reservation/inventory/selection/final closure/layout. Existing complete interrupt routes are not universally requalified.     |
| Platform                       | TP-001 Major: CPU-address-only proof omits indirect VIC RAM observers.                                                                                                   |
| Emitted output                 | No introduced finding. Exact ZP/wrap bytes and cold-artifact equality clear; MC-001 Minor is pre-existing adjacent-restore JMP debt owned by #51.                        |
| Host performance               | PE-001 Major: corrected export seeds amplify a quadratic global-root membership scan.                                                                                    |

## Initial required fix rulings

| Finding | Evidence                                                                                                                                                                                                                                             | Ruling / status                                                                                                                                                                                                    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PE-001  | `semantic/function-targets.ts:339`: assigned facts × copied/scanned root list at every direct call; cold exported wrappers now carry the global facts. About 50 million comparisons for 1,000 roots × 100 wrappers in one round.                     | Fix through existing exact Set membership and complete-closure deterministic internal regression, per AR-11. Compiler-owned necessary correction under PRIME workflow4; pending.                                   |
| TP-001  | `semantic/reachable-globals.ts:219/124`: numeric sprite pointers/enable and raw pointer/control/bank writes expose RAM reads not included in CPU-byte checks. The supplied fence/image collision witness is source-derived; runtime remains Unknown. | Conservative typed/raw hardware-observer guard and independent new source cases, per AR-12. Preserve disjoint colors/position and old oracles. Compiler-owned necessary correction under PRIME workflow4; pending. |

Both remedies remain inside the accepted modification set. They introduce no runtime, API,
dependency, new pass or generalized analysis. They do not waive either finding. The initial
rulings above are historical; both are resolved by the qualified fixes below. One focused
independent fix-only review round is complete; no third review is claimed.

## Separate baseline debt and evidence limits

MC-001: a main tail jumps to its physically next restore instruction. Equivalent fallthrough
saves three bytes / three nominal cycles without changing duties. The producer is unchanged
from baseline; #51 already owns fallthrough elision, with #89 broader output floors. No new
waiver or source workaround is accepted. Actual control/cold main is eight bytes / nine nominal
cycles versus the five-byte / six-cycle expert store. Fixed-word main is 26/41 versus 23/38.
Actual whole-program payloads are 629/647 bytes, resident RAM 678/696; ZP/SFA/scratch zero.

The semantics reviewer separately inferred the old `prepare(){ callback=&chosen; }` then
`invoke(){ return callback(); }` E10277 limitation. Callee definite writes are not transferred
back into caller assignment facts. A primary public build confirms E10277 in Git-private
`keyboard-technical-closure.PHqrhM/capture.log`; no runtime or fix is claimed. This is an
expressiveness defect, not an SFA/language restriction or a reason to expand this prerequisite.
Its owned follow-up must be recorded at closeout.

The closeout assigns this separate baseline defect to roadmap T-10, the RD-05
closed-program callable-proof owner. The live ledger/probe amendment retains its
exact old-oracle authority gate; no new row or protected test was silently changed.

All reviews bind expert `2.0.4`, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`, specification key
`BLEND65-SPEC-4-038b70e9`. Relevant normative references cover information preservation,
semantics, complete SFA/interrupt interfaces, CPU/VIC memory views, actual bytes, equivalent
costs and volatility. Required routing reads contained unrelated historical setup-smoke
summaries; reviewers exclude them from decisive evidence. No expert qualification answers,
grader, case map or source-manifest oracle audit map was opened.

The preserved logs prove the pre-fix checkpoint: 324 new passes, 55 internal passes and
5,556 full Linux passes with two existing skips. They do not qualify the pending corrections.
Entry-to-return timing, unrestricted external stack/firmware guarantees, native user hosts and
physical silicon remain Unknown. Runtime results stay VICE-verified/hardware-unverified.

## Fix verification and independent re-review

The final directed fix run passes 456 public specification cases in eight files (229.89
seconds, 2026-10-09 13:10:09 CEST) and 57 internal cases in seven files (3.57 seconds).
All four new two-frame collision witnesses run successfully in VICE; the pre-fix run
failed retention before runtime. Fresh full Linux install/build/typecheck/test pass:
5,690 passes and two existing package skips, root 3,754 passes in 174 files. Root starts
2026-10-09 13:16:19 CEST and completes in 1,150.32 seconds; full test command 1,229.45 seconds,
exit zero. Each reviewer saw a then-unfinished full checkpoint and kept that endpoint
Unknown. The primary's final terminal result closes that verification boundary, not
the separately stated physical/user-host/external/timing Unknowns.

All six native fix-only roles report no findings: correctness/oracle integrity,
semantics/DX, SFA/ABI, selected platform, actual emitted output and host performance.
No third review or blanket qualification is claimed. The membership work is now
linear in assigned-fact key lengths per call, not assigned facts times global roots.
Whole-solver linearity is not claimed. Platform review checks actual decode mirrors,
wrapped bytes and the independent transparent-block/collision witness. SFA review
checks the complete unchanged selection-to-final-storage interface. Output review
checks all fresh artifact hashes/bytes against their original equivalents.

| Finding               | Fix-only disposition                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| PE-001 Major          | Resolved: exact full-root Set membership, unchanged assignment facts/seeds; genuine RED scaling witness and 57 internal passes      |
| TP-001 Major          | Resolved: unknown indirect hardware fetches retain data; 132 new observer passes, including four actual bounded collision witnesses |
| MC-001 Minor baseline | Unchanged, owned by open #51; no new output waiver or universal expert win                                                          |

The blind new author separately confirms no content changes after `vic-observer-red.log`;
formatting preceded RED. Supplied authority was frozen wrapping/conversion, initialization,
placement and volatile-access contracts plus normative expert VIC/CPU memory-view sections.
No implementation, dist, implementation test, phase diff, reviewer-answer or qualification
case/grader/map file was opened. Public fixtures/spec conventions were permitted. The
disclosed release identity/digest/checkpoint-summary exposure was unused behaviorally.
No pre-RED byte hash was captured, so that historical hash-bound endpoint remains unverified.
The primary likewise made no new-spec edits after author handoff. Existing oracles are unchanged.

The SFA reviewer disclosed one accidentally emitted current content-checkpoint digest
row during release metadata extraction. It was excluded; the corrected extraction
contains only the five allowed identity fields. No qualification answers, case maps
or manifest were opened. This is a lineage-extraction disclosure, not behavior proof.
