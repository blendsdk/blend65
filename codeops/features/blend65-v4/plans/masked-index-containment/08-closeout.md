# Local masked-index containment — verification and review

> **Status**: Complete — bounded correction verified; not a keyboard/RD-05 closeout
> **Last Updated**: 2026-10-09 15:15 CEST
> **CodeOps Artifact Schema**: 1

## Scope and identity

[T-11](99-execution-plan.md) implements only the approved
[keyboard AR-P8](../rd-05-keyboard-input/00-ambiguity-register.md#ar-p8--masked-saved-row-query-retains-cold-state)
local containment correction. Review baseline tree:
`43f8797a15a5f4bd60a6c32dea2e87cf2f016586`; planning checkpoint `fa696631`.
The historical prerequisite commit is `25533bc2`.

One production file gains a body-local inclusive nonnegative bound query for constant
AND masks and proved value-preserving conversions. Indexed places consume that query;
raw CPU/hardware addresses still use the original exact literal/conversion resolver.
No operation, source identity, public API, SFA contract, runtime, dependency or pass is added.
The production file is 416 lines; the focused new internal suite is 311 lines.

The [targeted preflight](00-preflight-report-99-execution-plan.md) audited planning blob
`a2a204c50bb7cc39c567b6f49ddf0d473485194b`. Its sole minor finding corrected fresh-build
ordering. Task timestamps and evidence below do not alter that approved semantic contract.

Expert authority: `2.0.4`, content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`;
normative integer/index/effect rules, not historical qualification answers.
Source key `BLEND65-SPEC-4-038b70e9`; frozen Specification 4 TS-3/4/9/20,
Chapter 4 §3.5/3.6/4, AR-3/4/6, and Chapter 12 ordered memory intrinsics.
No frozen authority or existing specification test was changed.

## Independent oracle and verification

New immutable oracle: `test/rd05/source-library-masked-index.spec.test.ts`, 294 lines,
SHA-256 `9098a0cc77d1c5c880db4fefef8c6fac3c2a609d3081b7ab12c49512c3674c65`.
The independent author never read production, dist, old specification tests, internal tests,
phase diffs or qualification answers. Incidental historical expert navigation supplied
no expectation or implementation/cost answer and is not counted as decisive evidence.

Before production edits, the final directed run produced 56 genuine cold-byte omission
failures and 76 prepasses (132 total, 26.37 s). All four sequential VICE controls prepassed.
Construction-only intrinsic spelling and full public source identities were corrected
before this freeze. An earlier large driver stalled in CPU-bound baseline compilation,
before ACME/VICE; only its validated owned processes were terminated. The final fixed-slot
driver uses host-stepped inputs without reducing any value or ordered-access expectation.
The stopped driver's three-file reproducer was moved out of `/tmp` into the private evidence
directory. No other temporary directory or user process was modified.

| Check                                        | Result                                        | Evidence                                                                    |
| -------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| Fresh task-2 build                           | PASS, 4/4 packages                            | `task2-build.log`                                                           |
| New specs + immutable indexed/raw/VIC suites | PASS, 516 tests, 104.13 s                     | `task2-directed.log`                                                        |
| New/internal selector boundary suites        | PASS, 63 tests including 44 new, 2.17 s       | `task3-internals.log`                                                       |
| Fresh task-3 build and typecheck             | PASS                                          | `task3-build.log`, `task3-typecheck.log`                                    |
| Complete source-library suites               | PASS, 588 tests, 292.29 s                     | `task3-source-library.log`                                                  |
| Full Linux install/build/typecheck/test      | PASS, 5,866 tests; two existing package skips | `full-install.log`, `full-build.log`, `full-typecheck.log`, `full-test.log` |
| Six independent phase reviews                | No in-scope findings                          | Results below                                                               |

The first internal invocation used package-relative discovery from the root and found no
tests; it did not execute a failing test. The correct existing workspace command passed.
Both invocation logs are retained. The final oracle hash remains unchanged.

Evidence root, outside the working tree:
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/masked-index-containment.OWT7Fh/`.
Each VICE control checks all 256 byte patterns, eight word boundaries and nine signed
boundaries, four lookup forms, no acquisition access, and six ordered VICE watchpoint/source-access
observations for raw RAM/VIC/CIA operations after `asm_sei()` and the ready checkpoint.
This is not startup/return qualification or complete physical bus-traffic proof; existing
indirect accesses have bus cycles beyond that monitor endpoint.
Status is **VICE-verified / hardware-unverified**.

## Complete artifact accounting

The unchanged ordinary diagnostic projects are in the sibling private evidence directory
`keyboard-technical-closure.PHqrhM/query-control` and `query-cold`.
Fresh public `buildProject` builds use real ACME, optimization `none`, PAL/6581 cooperative PRG.
`query-before.log` and `query-after.log` preserve source hashes, actual generations,
PRG/assembly/labels/debug/memory/cost hashes and every interval.

| Charged component                                    |               Before cold | After cold | Control before/after |
| ---------------------------------------------------- | ------------------------: | ---------: | -------------------: |
| PRG container / executable payload                   |                 828 / 826 |  828 / 826 |            828 / 826 |
| Code: BASIC / startup entry / main / query / restore | 12 / 328 / 142 / 63 / 281 |       Same |                 Same |
| Resident RAM, including ZP                           |                       912 |        911 |                  911 |
| BSS: platform state / unrelated cold byte            |                    49 / 1 |     49 / 0 |               49 / 0 |
| Function-storage reservations                        |                        28 |         28 |                   28 |
| ZP reservations                                      |                         8 |          8 |                    8 |
| Reported generated stack component / scratch         |                     2 / 0 |      2 / 0 |                2 / 0 |
| Alignment padding / separate data intervals          |                     0 / 0 |      0 / 0 |                0 / 0 |

Actual payload ends at `$0B3B`, load address `$0801`. The cold byte alone disappears;
remaining BSS/SFA homes relocate by one byte without an added instruction or resource.
The original control has identical artifact hashes before/after. The original cold diagnostic
does not have identical bytes to its separately positioned source control: source identity
sorting gives different ZP/SFA operand addresses. That is not presented as byte equality.
The independent new same-position source controls instead assert exact whole-PRG equality,
complete resource totals, all physical allocation intervals and stack domains for each omission.

After generations: control `20826989-de39-4dba-99ca-1c87b6c34d4d`,
cold `890087ab-650c-4ddc-b9b5-cb1c94663f1d`. Before generations: control
`31d57882-89bc-46f4-ba62-81f0e93f8e2f`, cold `fe5f3c42-7482-4694-94e5-5eacc2c04902`.
Entry-to-return cycles remain **Unknown**; the reported stack component is not a total
firmware/external-interrupt stack peak. No full expert-output or keyboard-acquisition parity
claim follows from a one-byte saving. Existing output debt remains owned, not waived.

### Unchanged expert-output debt

The independent output auditor reconciled all 301 executable instructions' addresses,
opcodes and encoded widths; no instruction is added or enlarged. All six relative branches
stay within page `$09`, and the selected query's `$0B74..$0B7B` access stays within a page.
Cold global removal reaches the expert's zero-byte storage floor for that unused object;
this is not a local routine parity pass or a whole-program win certificate.

The existing query body is still **Incorrect local parity**: 63 actual bytes / 91 calculated
nominal cycles including `RTS`, versus a conservative expert candidate of 25 bytes / 41
calculated nominal cycles. The candidate uses the same three static parameter bytes and
existing two-byte ZP pointer, preserves X/D/I, returns A, restores Y to zero, clears C/V and
restores result N/Z for the captured layout. It has one array read and no extra helper/scratch.
The expert candidate is unassembled and unexecuted; these costs are an independent calculation,
not an emulator measurement. Its equivalent sequence is:

```asm
LDA data
STA $02
LDA data+1
STA $03
LDA column
AND #7
TAY
LDA ($02),Y
LDY #0
CLC
CLV
ORA #0
RTS
```

The baseline gap is 38 bytes / 50 nominal cycles. Its existing RD-08 owner
[#89](https://github.com/blendsdk/blend65/issues/89) was independently checked open on
2026-10-09. The concrete route is consuming retained mask facts in existing `lowerBitwise`
and `lowerAggregateIndex` seams before SFA closure: eliminate the zero high half, redundant
word-offset staging/address addition and result store/reload. Existing adjacent-restore
fallthrough debt stays with #51. No issue or external state was changed, no debt is waived,
and no general optimizer is added to this task.

## Review and deferral boundary

All six native independent reviewers assessed the complete baseline-to-worktree diff.
Their full-checkpoint endpoint was pending; the primary owns final log reconciliation.

The primary reconciled the successful full checkpoint: packages 1,980 passes / two existing
compiler-package skips; all 175 root files / 3,886 tests pass in 1,262.73 s. Total `yarn test`
time is 1,352.74 s. Install/build/typecheck pass. The exact three reviewed code/test hashes
remain unchanged at completion. Touched formatting/local file links, whitespace and empty
frozen-authority guards pass; local links are file-target checks, not a universal anchor audit.

| Role / agent                           | Bounded result                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness / `mask_correctness_phase` | No findings; written standards, strict scope and new-oracle provenance/hash clear; no old exception needed                                      |
| Semantics / `mask_semantics_phase`     | No findings; runtime domains, masks/conversions, complete footprints and unchanged effects clear; modern source forms need no workaround        |
| SFA/ABI / `mask_sfa_phase`             | No findings; removal precedes reservation/inventory, complete function demands and final closure/binding preserved                              |
| Platform / `mask_platform_phase`       | No findings; exact raw/hardware consumers, selected visibility and actual artifact accounting preserved; monitor/bus endpoints bounded          |
| Output / `mask_output_phase`           | No introduced findings; actual instructions/bytes/resources reconciled; unchanged 63/91 baseline debt above is not a parity pass                |
| Performance / `mask_performance_phase` | No findings; one inventory, memoized iterative O(V+I) queried-definition/index work, O(V+D) live proof state; deep/shared counter is meaningful |

Reviewed production SHA-256:
`dc2c5329911a8a548a86dfc0b4fceae3c05039839f99b625ed9bfdc25d1742f9`;
internal suite SHA-256 `274bd576efcfd6b612720e8ec8143f4feb3b769ad2646b43711523f299f455cd`.
All domain reviewers extracted active expert 2.0.4/content `0e2a6280...`, not a copied
implementation doctrine. Selected keys additionally include MOS-6510-1982, MOS-PGM-1976,
MOS-HW-1976, CBM-C64-PRG-1982, ACME-097-R266 and VICE-310-MANUAL for bounded output/platform claims.

Incidental exposures were disclosed and excluded: correctness saw historical AR-P8 challenger
commentary beside approval; semantics saw this closeout's build-order preflight summary;
performance over-read historical routing setup evidence; output emitted the adjacent lowering
qualification-case map after the selected review heading. That visible map contained generic
CPU/lowering obligations, no masked-index/cold-storage/one-byte/artifact-cost answer. No evaluator,
grader or source-manifest audit map was opened; no T-11 check acquired its answer there.
No reviewer ran verification or mutated files. The baseline large-fixture CPU stall is neither
attributed to nor shown resolved by this change.

Only the primary runs verification; reviewers are read-only.
There is no new input/process security boundary and no architectural documentation component.

Did this task expire a deferral's stated rationale? Yes: AR-P8's masked-index diagnostic is now
settled by the qualified bounded correction. The keyboard register links this completion;
no other deferral rationale expires. It does not prove keyboard acquisition,
electrical certainty, NMI coordination, arbitrary-index safety or T-10's separate callable defect.
RD-05/DEF-7 and the keyboard positive gate stay open. Overall roadmap count stays 4/10.
No push is authorized or performed.
