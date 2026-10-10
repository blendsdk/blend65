# Execution: keyboard and combined input

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-10 14:09 CEST
> **Progress**: 20/36 tasks (56%)
> **CodeOps Artifact Schema**: 1

## Implementation phases

| Phase | Title                                                    | Tasks | Dependency                                |
| ----- | -------------------------------------------------------- | ----- | ----------------------------------------- |
| 1     | Three existing-consumer output corrections               | 20    | Approved AR-P12; qualified T-11/T-12/T-14 |
| 2     | Complete ordinary-source input library and qualification | 16    | Phase 1 GREEN and reviewed                |

Task checkboxes are the sole progress authority. Immediately mark implemented
work `[~]` with its actual timestamp; promote to `[x]` only after relevant
verification. Update Progress/Last Updated after each task. Resume the first
`[~]`, otherwise first `[ ]`; `[!]` requires an explicit blocked reason.
Green coherent checkpoints use the git-commit skill, without asking; never push
automatically. Expected RED or incomplete public library work is not committed.
The standing named RD-05 effort confirmation applies; recommend effort before
each task without repeated confirmation pauses. New material scope decisions
retain their normal gate.

Production paths below are relative to `packages/compiler/src/` unless fully
qualified. Root owns tightly coupled implementation and durable progress.
Specification authors own only their assigned new test file, cannot read
implementation, and cannot review their own oracle. Record a real phase baseline
tree before starting; exclude any earlier dirty work. Keep every implementation
task to one concern and 1–3 files; split before execution if it grows to 200
added lines, six files or multiple independent concerns. A split changes ordering,
not authority. Existing specification tests remain unchanged except the exact
task 2.2.7 exception and AR-P13's two exact Phase 1 setup changes. Focused implementation-test extensions are named below;
preserve their still-valid negative/effect guards.

## Phase 1: output corrections

> **Phase baseline tree**: `55940197c46b22e2de82893372d1d932382185cb`
> **Scope mode**: strict

Expected phase modification set: the eight new Session 1.1 root specification
files; seven existing `packages/compiler/src/machine/` owners (`lower-scalar`,
`lower-state`, `lower-aggregate-index`, `lower-aggregate`,
`lower-register-forwarding`, `lower-call`, `lower-aggregate-place`); new `input-index.impl.test.ts` and
existing `lower-register-forwarding.impl.test.ts` / `call-retention.impl.test.ts`
in that directory; this plan's progress/index/register/review bookkeeping and
the feature roadmap. No bundled-library, frozen, old-specification-test or
portfolio modification is authorized in this phase except AR-P13's exact
`cia-basic-return-vice.spec.test.ts` four-profile and
`handler-irq-nesting-vice.spec.test.ts` eight-status-case setup read/write pairs.
Every source/assertion/injection/timeout/observed interval stays unchanged; no
ICR acknowledgement or shared fixture edit is permitted. Baseline excludes earlier
work and contains the clean `80afcbf5` documentation checkpoint.

### Session 1.1 — independent specification tests

Reference: [03-01](03-01-output-corrections.md), [07](07-testing-strategy.md).

Before authoring on 2026-10-10, the original ST-1–ST-3 task was decomposed into
three concern-specific files/tasks to preserve readable coverage below the
task-size limit. Before writing ST-3, unchecked retention and checked failure
were also separated rather than compressed into an oversized test task.
Before writing ST-4–ST-6, the ordered predicate cost and byte-retention guards
were separated for the same readable-file constraint.
The call author likewise separated the fixed caller cost from dynamic/alias
fallback guards before writing. These splits change 29 to 34 tasks (Phase 1:
13 to 18), not behavior, support machinery, test authority or the accepted
modification families.

- [x] 1.1.1 [spec-author] Write ST-1 in `test/rd05/input-index-output.spec.test.ts` using ordinary-source public fixtures. ✅ (completed: 2026-10-10 10:01; expected RED verified)
- [x] 1.1.2 [spec-author] Write ST-2 in `test/rd05/input-index-store.spec.test.ts`; separate hidden-destination cost from the borrowed full-address-wrap witness. ✅ (completed: 2026-10-10 10:21; expected RED verified)
- [x] 1.1.3 [spec-author] Write ST-3's unchecked signed/wider/stride/multi-use cases in `test/rd05/input-index-guards.spec.test.ts`. ✅ (completed: 2026-10-10 10:28; baseline safety cases verified)
- [x] 1.1.4 [spec-author] Write ST-3's E10240 and checked runtime-stop/no-access cases in `test/rd05/input-index-bounds.spec.test.ts`. ✅ (completed: 2026-10-10 10:40; baseline safety cases verified)
- [x] 1.1.5 [spec-author] Write ST-4 in `test/rd05/input-expression-output.spec.test.ts`; freeze ordered predicate effects and complete first-branch cost. ✅ (completed: 2026-10-10 10:43; expected RED verified)
- [x] 1.1.6 [spec-author] Write ST-5–ST-6 in `test/rd05/input-byte-retention.spec.test.ts`; freeze independent fresh-flag and clobber/multi-use retention expectations. ✅ (completed: 2026-10-10 10:47; expected RED verified)
- [x] 1.1.7 [spec-author] Write ST-7/ST-9 in `test/rd05/input-call-output.spec.test.ts`; freeze complete equivalent caller cost, actual-byte and fixed-address ABI expectations. ✅ (completed: 2026-10-10 10:55; expected RED verified)
- [x] 1.1.8 [spec-author] Write ST-8 in `test/rd05/input-call-guards.spec.test.ts`; freeze dynamic-pointer, nonzero-offset, alias/effect-order and scalar-retention fallbacks. ✅ (completed: 2026-10-10 10:58; baseline safety cases verified)
- [x] 1.1.9 Run the eight new files before production changes; record expected RED output assertions and justified baseline-pass safety cases in this document. ✅ (completed: 2026-10-10 11:02; all expected RED and baseline-pass cases verified)

Verify: `yarn vitest run test/rd05/input-index-output.spec.test.ts
test/rd05/input-index-store.spec.test.ts test/rd05/input-index-guards.spec.test.ts
test/rd05/input-index-bounds.spec.test.ts
test/rd05/input-expression-output.spec.test.ts test/rd05/input-byte-retention.spec.test.ts
test/rd05/input-call-output.spec.test.ts test/rd05/input-call-guards.spec.test.ts`.
VICE portions run sequentially. No implementation or RED commit yet.

Task 1.1.1 baseline: eight cases execute, zero skips; four actual VICE page-carry,
word-input and register/value cases pass on the four cooperative profiles.
Four independent output cases fail as intended at 64 bytes versus 23; the
37-cycle assertion remains frozen but is not reached after the byte failure.
Raw log: `.git/worktrees/v4/keyboard-plan-check.hzunZt/index-red.log` (resolved
against the shared repository's worktree git directory, outside this worktree).
The author used only normative clauses/CPU timings and supplied public fixture
signatures. Fixture byte-buffer/identity corrections preceded the first run;
no expected behavior or limit changed. Formatting/documentation checks pass.

Root retained an exact public PAL fixture at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-index-baseline.LLfyEp/`,
generation `15495bbc-7c4c-42b0-a091-09736d6d6721`; source SHA-256
`63fa95e4110de1551157f104735fee25b3ddecbfc7172895faeb8c410b55ad88`.
Actual row parameter homes are absolute ($0B35–$0B38) and the indirect pointer is
ZP $02/$03, matching the independently derived 23-byte/37-cycle contract. This
is baseline evidence, not corrected-output, scanner or full decoder qualification.

Task 1.1.2 baseline: twelve cases execute, zero skips; all eight actual VICE
returned-row/ordered-MMIO and borrowed $FFFC+7→$0003 cases pass. All four
cost cases fail as intended at 64 bytes/90 nominal cycles versus 23/34,
and expose the redundant sampled-byte spill/reload. Authoring corrections kept
the behavior and analytical budget unchanged: join the complete adjacent range
after PA through the selected store (nested producer origins were omitted by the
initial helper slice), capture mapping after startup, and collect the completed
result through a typed array assignment rather than an unknown raw-address
observer that defeats the prerequisite private-destination proof. Earlier logs
are retained but do not qualify the final fixture. Final log:
`.git/worktrees/v4/keyboard-plan-check.hzunZt/index-store-qualified-red.log`.
The author's release-summary exposure at lines 1–47 was disclosed and excluded;
expectations derive only from the packet and governing normative clauses.

Exact retained public PAL source:
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-store-baseline.vHn45V/`,
generation `cfbd5075-cb5d-4d3b-98c7-cdc8e8b406df` in
`typed-observer-result.json`; source SHA-256
`655a9e89ab06fd9b788e61f6dd4f778f1a44de7e5c221532f732c59c937a3c10`.
The actual hidden result base is ZP $04/$05, the indirect pointer is $02/$03,
and the column parameter is absolute $0B42/$0B43. No redundant returned-local
home remains, matching the 23-byte/34-cycle equivalent-work candidate.

Task 1.1.3 baseline: all four profile cases pass, zero skips. The actual VICE
program preserves signed -1, full word 265, direct byte-expression widening,
stride-two/page carry, and one indexed byte retained across an ordered volatile
read and ordinary clobbering call. Input/source data and interrupt masking stay
unchanged. These are deliberately passing fallback guards, not evidence that
the new cost corrections are implemented. Log:
`.git/worktrees/v4/keyboard-plan-check.hzunZt/index-guards-baseline.log`.
The 111-line file is specification-derived; no forbidden input was read.

Task 1.1.4 baseline: all 24 profile/ordinal cases pass, zero skips. Both constant
violations preserve E10240 and no generation; signed runtime -1/8 reach the
exact source-associated SEI/self-JMP stop before any array/output access, with
stable stack and unchanged input/source bytes. Valid 0/7 controls prove the
normal indexed-read/output path. These are passing existing safety guards,
not new output qualification. Log:
`.git/worktrees/v4/keyboard-plan-check.hzunZt/index-bounds-baseline.log`.
The author read only supplied contracts and exported public declarations;
source provenance was clarified through existing published record fields,
without backend labels, output addresses or compiler-derived expectations.

Task 1.1.5 baseline: eight cases execute, zero skips. All four VICE predicate
cases pass across all 00/00, 02/00, 00/02 and 02/02 control inputs, with exactly
one CRA read before one CRB read and local C/V/X/Y/D/I/SP preservation. All
four complete entry-to-first-branch costs fail at 36 bytes versus 10; the
12/13-cycle expectations remain unchanged. Log:
`.git/worktrees/v4/keyboard-plan-check.hzunZt/expression-red.log`.
The 159-line independent oracle uses actual PRG instruction boundaries;
no source-origin omission or whole-callee preservation claim is made.

Task 1.1.6 baseline: eight cases execute, zero skips. Four VICE cases preserve
fresh 0/1/$80 answers and saved bytes across uses, opposite-zero volatile/call
clobbers and block boundaries, with exact ordered accesses and unchanged device
controls. Four instruction-boundary output cases fail on the redundant EOR #0
as intended. Log:
`.git/worktrees/v4/keyboard-plan-check.hzunZt/byte-retention-red.log`.
The 172-line file is independently authored; no forbidden input was read.

Task 1.1.7 baseline: all eight cases execute, zero skips, and fail only their
intended output assertions. Four complete callers are 55 bytes/75 nominal cycles
against 41/55. Four actual VICE runs complete every destination/parameter/quality,
snapshot/output/effect-order and balanced-stack observation before failing on
the disposable result store instead of direct fixed delivery. Log:
`.git/worktrees/v4/keyboard-plan-check.hzunZt/call-red.log`.
Before the first run, the author moved the identical final output-shape assertion
after independent runtime observations; no source, expected value, ABI, budget
or negative guard changed. The 184-line oracle is implementation-blind.

Task 1.1.8 baseline: all eight profile/runtime-selection cases pass, zero skips.
Two distinct selected structs preserve the ten-byte field offset, nested
argument address capture and latest aliased contents. The saved query byte
survives a word-returning call and later dynamic pointer setup; all five ordered
helper-port effects, two intentional source writes, remaining input/source
bytes and balanced stack match the independent oracle. Log:
`.git/worktrees/v4/keyboard-plan-check.hzunZt/call-guards-baseline.log`.
These passing existing fallback guards do not qualify the new fast paths.

Session 1.1 combined baseline: all eight files execute sequentially, 80 cases,
56 passes and 24 intended output failures, zero skips; no unexpected failure.
Log: `.git/worktrees/v4/keyboard-plan-check.hzunZt/all-output-baseline-red.log`
(10:59:36 CEST, 80.54 seconds). All eight files pass formatting and whitespace
checks. Production, frozen specification/expert and existing oracle files remain
unchanged. No RED commit is made.

Before production, root also retained 36 public builds (nine source variants on
four profiles), exact generation/source/PRG identities, complete memory/cost/debug
sidecars and SFA closure hashes at
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-output-baselines.HKy67s/baseline-records.jsonl`.
Retained source matches the test fixtures apart from terminal line feeds. Every
payload charge reconciles against actual PRG bytes and ACME memory evidence.
The independent caller's ZP hidden-result and absolute argument-home classes
match the actual fixture. The baseline quantities below are whole artifact
inventory, not local expert targets or full-decoder qualification.

| Source variant | Payload/code | BSS | RAM SFA | ZP | Resident RAM | Generated stack | Scratch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Masked read | 767 | 60 | 14 | 4 | 845 | 2 | 0 |
| Returned store | 772 | 57 | 17 | 6 | 852 | 2 | 0 |
| Borrowed store | 809 | 65 | 15 | 4 | 893 | 2 | 0 |
| Index guards | 1,086 | 389 | 31 | 6 | 1,512 | 4 | 0 |
| Checked bounds | 735 | 60 | 7 | 4 | 806 | 4 | 0 |
| Predicate | 694 | 50 | 5 | 0 | 749 | 2 | 0 |
| Byte retention | 816 | 58 | 7 | 0 | 881 | 4 | 0 |
| Fixed caller | 918 | 49 | 22 | 8 | 997 | 2 | 0 |
| Call guards | 1,622 | 91 | 30 | 10 | 1,753 | 2 | 0 |

These quantities agree across the four profiles; container size adds its two-byte
load word. Data/padding charges are zero for these diagnostic fixtures. Reported
stack is the generated bounded component, not an external interrupt peak.
Looping full-program paths remain reported Unknown; no finite deadline is inferred.

### Session 1.2 — three separate existing-consumer corrections

Reference: [03-01](03-01-output-corrections.md). Reuse existing pre-SFA facts and
fallbacks. Do not combine the three families into a new optimization pass.

- [x] 1.2.1 Retain proved zero-high/byte ordinal facts in `machine/lower-scalar.ts` and `lower-state.ts`; ST-1–ST-3. ✅ (completed: 2026-10-10 11:15; build, 47 implementation and 28 safety cases pass)
- [x] 1.2.2 Consume those facts for stride-one addressing in `machine/lower-aggregate-index.ts` and `lower-aggregate.ts`; preserve full address carry and fallback behavior; ST-1–ST-3. ✅ (completed: 2026-10-10 11:21; build, 47 implementation and 40 family behavior cases pass; adjacent-delivery output remains next task)
- [x] 1.2.3 Deliver adjacent aggregate bytes through existing `machine/lower-state.ts`, `lower-register-forwarding.ts` and `lower-aggregate.ts` consumer facts; preserve exact ordered read/store behavior; ST-1–ST-3. ✅ (completed: 2026-10-10 11:40; build, 47 implementation and all 48 family behavior/output cases pass)
- [x] 1.2.4 Correct adjacent byte expression/valid zero-flag delivery in `machine/lower-register-forwarding.ts`, `lower-scalar.ts` and their existing `lower-state.ts` retention owner; ST-4–ST-6. ✅ (completed: 2026-10-10 11:46; build, 47 implementation and all 64 first/two-family cases pass)
- [x] 1.2.5 Preserve proved fixed aggregate-place identity in the existing `machine/lower-aggregate.ts` / `lower-state.ts` producer-to-consumer path; ST-7–ST-8. ✅ (completed: 2026-10-10 11:52; build, 47 implementation and all 16 call-family cases pass)
- [x] 1.2.6 Consume fixed places and eligible immediate byte-call results in `machine/lower-call.ts` / `lower-register-forwarding.ts`; ST-7–ST-9. ✅ (completed: 2026-10-10 11:52; existing call marshaller reused unchanged; build, 47 implementation and all 16 call-family cases pass)
- [x] 1.2.7 Rebuild and run all eight new files to GREEN without changing their oracle; record actual output/resource deltas here. ✅ (completed: 2026-10-10 11:55; build, all 80 cases and 36 complete artifact inventories pass)

Verify: rebuild after production edits, then the directed command above and
impacted existing scalar/index/aggregate/call/forwarding suites. After each family
run its own new files immediately; only proceed with their behavior and output
expectations GREEN. A later family's RED baseline is not waived. No local
analytical subtraction substitutes for complete assembled evidence.

Task 1.2.1 verification: the final production build and all 47 cases in five
existing lowering/aggregate/call/forwarding implementation files pass. Two
sequential directed safety runs each finish 27/28, with a VICE checkpoint timeout
in a different PAL/8580 invalid-ordinal case (-1 versus 8). All six PAL/8580 cases
pass in a targeted recheck; its 18 filtered cases are not counted as passes.
The independent bounded correctness review reports RV-001 MAJOR: both new bounds
test sites resume before arming their stop wait, while the monitor only delivers
stops to an already armed waiter. One response callback can drop an early stop
before the awaiting caller resumes. Historical monitor frames were not retained,
so attribution of each timeout to that race remains Unknown.
The necessary correction moves only waiter creation before the two resumes in
this new, phase-owned file. Every source byte, expected address, provenance,
stack/no-access/memory/interrupt assertion, case count and timeout stays unchanged;
no old specification test or harness changes. The reviewer separately confirms
that this repairs coordination, not the immutable behavior oracle; AR-P6's old
inventory exception is not used. This is an in-scope plan/test technical correction,
not a material product choice, support mechanism or scope expansion. Independent
exact-fix review reports no findings; all 28 fresh sequential safety cases pass,
zero skips, in 29.21 seconds. Log: `zero-high-safety-coordinated.log`.
Raw logs: `zero-high-build-final.log`,
`zero-high-internals-qualified.log`, `zero-high-safety.log`,
`zero-high-safety-rerun.log`, `zero-high-bounds-profile-recheck.log` under the
retained `keyboard-plan-check.hzunZt` worktree git-directory root above.

Before task 1.2.2 execution, address formation and adjacent-byte delivery were
split to keep each correction within three owners and one concern. The unchanged
family now occupies 1.2.2–1.2.3; later Session 1.2 numbering shifts by one. Total
tasks become 35, Phase 1 becomes 19; no behavior, scope or support surface changes.
Family 1 output qualification remains pending until both tasks are verified.

Task 1.2.2 final rebuilt intermediate witness: all 40 index-family behavior and
safety cases pass, zero skips; eight output cases remain expected RED for the
separate adjacent-delivery task. Complete read shrinks 64→35 bytes; complete
store shrinks 64/90→35/50 bytes/nominal cycles, still above unchanged 23-byte
limits and still staging the sampled byte. No completed parity claim is made.
All 47 directed existing implementation cases pass. Logs:
`byte-address-build-final.log`, `byte-address-internals-final.log`,
`byte-address-family-intermediate.log` in the retained log root above.

Task 1.2.3: complete read is now 23 bytes/37 nominal cycles and the complete
hidden-destination store is 23/34, meeting the unchanged independent expert
limits. All 48 fresh index-family cases pass, zero skips, including full word
inputs, page carry, $FFFF wrap, returned initialized rows, exact PA/PB/store
order, signed/wider/stride/multi-use fallbacks and checked no-access stops.
All 47 existing directed implementation cases and the rebuilt compiler pass.
Logs: `adjacent-byte-build-signed-guard.log`,
`adjacent-byte-internals-qualified.log`, `adjacent-byte-family-coordinated.log`.

The preceding family run was 32 pass/16 fail: four load-trace observations and
twelve store-source coverage extractions failed before complete qualification.
Independent review found RV-002/RV-003 MAJOR test coordination/provenance defects,
not changed behavior or production provenance. A retained one-shot public VICE
probe captures correct A=49/pointer=$30FC at RTS, then receives that same load
trace before the existing observed barrier. The new lookup test keeps its RTS
register capture and collects exact single-load hits at that barrier, before
the next invocation. The new store test unions same-variant nested assignment
origins and proves gap-free coverage from PA.end through the final store; it
charges every actual PRG byte. The narrower PB origin remains intact.
Exact-fix independent review reports no findings and preserves oracle integrity.
Every source, value/register/effect assertion and cost limit stays unchanged;
no old test, shared harness or production source mapping is amended. These are
necessary in-scope observation corrections, not a material product/support
choice or use of AR-P6. No incomplete phase or RED work is committed.

Task 1.2.4: all 16 ST-4–ST-6 cases pass, zero skips. The complete ordered
control predicate shrinks 36→10 bytes and meets the independent 12/13 nominal
cycle budget; fresh marker comparisons contain no EOR #0. Both volatile reads
remain ordered and unique, local C/V/X/Y/D/I/SP obligations and saved values
across calls/reads/uses/blocks stay correct. The existing single-use window proves
A ownership separately from the specific load/bitwise producer's fresh-Z
condition; call results and merely preserving stores gain no zero-flag proof.
The existing adjacent-read fact also delivers a fixed second read as the ALU
operand at the same bus-access position, retaining its original effect/span.
No pass, IR kind or runtime is added. Build and all 47 directed internal cases
pass; a fresh combined first/two-family run passes all 64 cases, zero skips.
Logs: `byte-expression-build.log`, `byte-expression-family.log`,
`byte-expression-internals-qualified.log`,
`byte-expression-two-family-qualified.log`.

After the new specification family was GREEN, the owned forwarding portion of
task 1.3.2 began: its obsolete returning-arm internal rejection becomes a separate
positive test, while every nonzero, intervening-instruction, word, dynamic-address
and multiple-use negative remains intact. A branch arm's eventual return does
not invalidate flags established before selecting it. The preceding internal
run was 46/47 because of that obsolete implementation restriction; it is retained
as `byte-expression-internals.log`, not counted as passing. No old specification
oracle changes. Remaining internal extensions still belong to 1.3.2.

Tasks 1.2.5–1.2.6: a fixed zero-offset SFA data home with one same-block direct
call consumer retains its existing data-home identity instead of allocating a
captured address pair. The existing call marshaller already emits its immediate
low/high address bytes, so `lower-call.ts` needs no edit. Borrowed parameters,
returned roots, dynamic ordinals, nonzero offsets, other consumers and missing
proof retain their ordinary path; no guessed label or fabricated pointer is used.
The existing selector now allows an ordinary byte-call result only into its
sole adjacent fixed byte write. It grants A ownership, not fresh-Z ownership;
word/indirect/nonadjacent/multi-use results keep their stable path.

The intermediate fixed-home witness was 47 bytes/63 nominal cycles, with all
eight dynamic/offset/alias/effect-order fallback cases passing. Its eight
output cases remained RED for the separate immediate-result delivery, after
their independent runtime observations passed. Final complete caller is
41/55 versus baseline 55/75 and meets every unchanged output/ABI observation.
All 16 call-family cases pass, zero skips; build and all 47 existing directed
implementation cases pass. Logs: `fixed-place-build.log`,
`fixed-place-internals.log`, `fixed-place-call-intermediate.log`,
`byte-call-build.log`, `byte-call-internals-qualified.log`,
`byte-call-family-qualified.log`. Full artifact inventory and combined GREEN
still belong to task 1.2.7; no phase checkpoint is claimed yet.

Task 1.2.7: rebuilt combined run passes all 80 cases in eight files, zero skips,
81.80 seconds. Logs: `all-output-green-build.log`, `all-output-green.log`.
Thirty-six separate GREEN public builds retain exact unchanged source hashes,
unique generation/PRG identities, ACME reconciliation, closure hashes and complete
sidecars in `keyboard-output-baselines.HKy67s/green-records.jsonl`; baseline
records remain intact. Thirty-four of the 36 original baseline generation
directories remain available. Normal generation retention removed only the
read/PAL-6581 and returned-store/PAL-6581 directories after diagnostic rebuilds;
their original generation sidecars are now record-only. Each missing recorded
PRG hash exactly matches all three retained same-fixture profile PRGs, so those
peer bytes support the bounded byte comparison, not a claim to inspect the
missing generation. All 36 GREEN generation directories remain available.
Actual payload bytes equal the published code/program
charge; complete category totals agree with resident-RAM resources. All four
profiles agree on the quantities below. No BSS, SFA, ZP, stack or scratch growth
occurs; data/padding remain zero. Local nominal costs do not establish a finite
whole-program deadline: looping path-cycle totals remain Unknown, and stack is
the generated bounded component, not an external-interrupt peak.

| Source | Payload/code before→after | BSS | RAM SFA before→after | ZP before→after | Resident before→after | Generated stack | Scratch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Masked read | 767→726 | 60 | 14→9 | 4→4 | 845→799 | 2 | 0 |
| Returned store | 772→731 | 57 | 17→12 | 6→6 | 852→806 | 2 | 0 |
| Borrowed store | 809→768 | 65 | 15→10 | 4→4 | 893→847 | 2 | 0 |
| Index guards | 1,086→1,086 | 389 | 31→31 | 6→6 | 1,512→1,512 | 4 | 0 |
| Bounds witness, checks off | 735→719 | 60 | 7→7 | 4→4 | 806→790 | 4 | 0 |
| Predicate | 694→668 | 50 | 5→1 | 0→0 | 749→719 | 2 | 0 |
| Byte retention | 816→788 | 58 | 7→6 | 0→0 | 881→852 | 4 | 0 |
| Fixed caller | 918→870 | 49 | 22→19 | 8→6 | 997→944 | 2 | 0 |
| Call guards | 1,622→1,609 | 91 | 30→30 | 10→10 | 1,753→1,740 | 2 | 0 |

These are complete diagnostic artifacts, not acquisition/decoder or arbitrary
whole-program expert parity. The retained bounds witness uses `boundsCheck: false`;
the separate bounds-on public tests and runtime logs prove checked-stop behavior,
not these byte-identical retained artifacts. No phase completion claim precedes internal guards,
full checkpoint and independent reviews. Status: VICE-verified/hardware-unverified.

### Session 1.3 — internals, checkpoint and review

- [x] 1.3.1 Add focused `packages/compiler/src/machine/input-index.impl.test.ts` guards after GREEN; [03-01](03-01-output-corrections.md#masked-addressing-and-aggregate-byte-delivery). ✅ (completed: 2026-10-10 12:01; all eight internal cases pass)
- [x] 1.3.2 Add adjacency/flag/fixed-place/call fallback cases to existing `lower-register-forwarding.impl.test.ts` and `call-retention.impl.test.ts`; [03-01](03-01-output-corrections.md). ✅ (completed: 2026-10-10 12:06; all 38 index/forwarding/call cases and typecheck pass)
- [x] 1.3.3 Keep aggregate lowering below the repository file-size limit by moving its unchanged address routine/cache helper into the existing `lower-aggregate-place.ts`; preserve its exported entry and all emitted/storage behavior. (verified: 2026-10-10 13:44; build/typecheck pass; 80 public plus 38 internal cases pass with no skips; independent mechanical correctness review reports no findings)
- [x] 1.3.4 Run complete phase verification and independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance reviews; retain `08-phase-1-review.md`, dispose findings and update this plan/roadmap. (verified: 2026-10-10 14:09; fresh install/build/typecheck and 6,140 tests pass, two existing skips; all six reviews and both exact-fix/mechanical follow-ups complete; MINOR debts remain explicitly owned)

Task 1.3.4 review status: all six original independent lenses complete. Correctness,
semantics/DX, SFA/ABI and platform report no findings. Output reports no introduced
blocking local-boundary finding and three inherited MINOR whole-source debts,
owned by RD-08 #104/#51. Host PE-001 is MINOR and explicitly owned by RD-05 T-17
before RD closeout, not waived. The complete Linux test command exits 1 with
6,138 passes, two old CIA/IRQ runtime failures and two existing skips. Two
unchanged directed reruns pass 13/13 each, with no skips; the first checkpoint
remains RED. Independent platform follow-up finds a running Timer-A setup
counterexample before both controlled injections; attribution of the recorded
failures remains Unknown. [AR-P13](00-ambiguity-register.md#ar-p13--deterministic-setup-for-two-existing-cia1-timer-fixtures)
records the exact two-file deterministic-precondition exception, explicitly
approved on 2026-10-10. Independent correctness follow-up agrees with the local
setup correction and preserves the substantive tests. Apply only its stated
sites; directed checks, exact-fix review and a successful full checkpoint remain due. See
[pending review evidence](08-phase-1-review.md).

AR-P13 applied at 13:22 CEST: exactly one local CRA read/write pair and durable
setup explanation in each approved case family. All source strings, assertions,
timeouts, controlled injections and observed intervals remain unchanged; the
shared harness and nested-storage case are untouched. The first failed full
checkpoint remains retained. Directed verification passes 13/13 with no skips,
and exact-fix correctness review reports no findings. Fresh install/build/typecheck
pass; the complete test run starts at 13:24 CEST (`ar13-full-test.log`). Exact-fix
platform review also reports no findings. Phase 1 is not yet GREEN or committed.

Before committing, the file-size self-check found `lower-aggregate.ts` at 807
lines. The smallest necessary organization correction moves the complete address
routine and its private cache helper, without changing their text, into the
existing 62-line address-place owner. Re-export the same entry from the old
module so every caller stays unchanged. No new file, layer, representation,
optimization or behavior is added. This two-file mechanical concern is split
into 1.3.3; the full checkpoint becomes 1.3.4. Total 35→36 is task sequencing,
not expanded product scope. Existing named RD-05 effort/continuation authority
applies. The seventh expected owner is explicitly recorded above.

Root interrupted only its own 13:24 full run at 13:35 (exit 130) to avoid
continuing verification of the pre-move organization. Its 33 completed root
files and complete package passes are retained in `ar13-full-test.log`, not a
complete GREEN checkpoint. The owned VICE child is terminated before restarting;
no user process is stopped. Final build/directed/full checks and bounded
mechanical-move reviews remain due.

Mechanical move implemented at 13:37: `lower-aggregate.ts` is 530 lines and
the existing `lower-aggregate-place.ts` is 358. The private cache helper and
complete exported address function are moved verbatim, with only imports and
the compatibility re-export adjusted. Every existing caller remains unchanged.

Mechanical verification complete at 13:44: fresh build and typecheck pass;
`address-move-directed.log` records 80/80 public cases and
`address-move-internals.log` records 38/38 internal cases, zero skips. The root
Vitest invocation did not select package internals, so those were separately
run from the compiler workspace. Independent review verifies all 9,866 moved
characters are identical to tree `ef4a8a552269db0db6b3cfc9a43b9773bb7eb323`,
with no findings. Full phase verification remains due in 1.3.4.

Final full checkpoint starts at 13:45 CEST, after fresh frozen install, build
and typecheck all pass. Log: `phase1-final-full-test.log`. Targeted final
TypeScript formatting and local Markdown links pass. No production, test or
fixture bytes change during the running full suite; Phase 1 remains uncommitted
until its complete result is known.

Final checkpoint complete at 14:09 CEST: the command exits 0. All package
suites pass (compiler 1,961 plus two existing skips, CLI 62, language server 21,
VS Code 6); all 189 root files and 4,090 root cases pass. Total: 6,140 passes,
two existing unrelated skips. Root duration is 1,375.32 seconds; complete command
duration is 1,458.63 seconds. Both approved Timer-A fixture families pass in the
full suite. This qualifies their deterministic setup; the original failure's
cause remains Unknown. Final formatting, links, whitespace and immutable/old
oracle guards are clear. Phase 1 is GREEN and independently reviewed; acquisition,
saved classifiers and complete library parity remain Phase 2, not qualified by
this checkpoint. A local coherent commit follows, with no push.

Verify: root install/build/typecheck/full tests; targeted formatting, frozen/old
oracle guards, actual ST-9 resource evidence. Reviewers run in waves under the
four-total limit. No library API is published by this phase. A green local
checkpoint follows verification/review, with no push.

Task 1.3.1: all eight focused internal cases pass, including complete low/high
carry, absence of unnecessary widening homes, wide-mask/signed/word-stride
fallbacks, zero-page aliasing at $02/$FF, non-aliasing adjacent delivery and
bounds-on ordinal/sample retention. Each fixture closes storage and binds its
machine program successfully before any emission. Initial draft failures were
three incorrect internal request-name lookups (`scaled-index` rather than the
existing `aggregate-index-candidate`); expectations stayed two-byte storage.
The fixture was shortened to 197 readable lines without dropping any case.
Final log: `index-internals-final.log`; initial draft remains
`index-internals-new.log`. No specification or production change.

Task 1.3.2 final: all 38 internal index/forwarding/call cases pass, zero skips;
typecheck passes. The four new forwarding cases cover all three adjacent byte
ALUs, multi-use/word/instruction barriers, direct byte-call fixed stores and
absence of fresh-Z proof for calls. Five new closed/bound ABI cases cover fixed
zero-offset versus retained nonzero-offset places, direct byte return delivery,
intervening-instruction retention and word-result homes. Every still-valid old
negative stays intact. The two-file task adds 196 lines, no new test helper
module or runtime. Logs: `all-new-internals-final.log`, `internals-typecheck.log`.

## Phase 2: complete source input library

### Session 2.1 — independent specification tests

Reference: [03-02](03-02-saved-input.md), [03-03](03-03-acquisition.md), [07](07-testing-strategy.md).

- [ ] 2.1.1 [spec-author] Write ST-10–ST-15 in `test/rd05/input-saved-data.spec.test.ts`; keep the electrical oracle independent of implementation.
- [ ] 2.1.2 [spec-author] Write ST-16–ST-17/ST-22/ST-24 in `test/rd05/input-acquisition.spec.test.ts` using existing build/VICE interfaces and preserved negative cases.
- [ ] 2.1.3 [spec-author] Write ST-23 output/resource assertions in `test/rd05/input-library-output.spec.test.ts`; derive complete equivalent expert acquisition/query/caller baselines before production edits. ST-18–ST-22 native matrix/RESTORE cases use the already-owned procedure in 07, not a new test framework.
- [ ] 2.1.4 Run all three new files to RED for the absent public library; record baseline diagnostics and oracle provenance here.

Verify: `yarn vitest run test/rd05/input-saved-data.spec.test.ts
test/rd05/input-acquisition.spec.test.ts test/rd05/input-library-output.spec.test.ts`.
Missing library/API is RED, not a permitted skip or commit. Stop for an exact
runtime ruling if the ordinary source or complete output needs support beyond
AR-P12; do not weaken the accepted behavior to produce GREEN.

### Session 2.2 — ordinary source implementation

All source changes below target `packages/compiler/stdlib/c64/input.blend`.
Prepare/qualify through normal builds. The complete public surface and its one
old inventory amendment publish together at the coherent phase checkpoint,
after native qualification, full verification and independent reviews;
partial declarations or an UNAVAILABLE-only acquisition stub are not shipped.

- [ ] 2.2.1 Add documented declarations and the exact matrix enum; [03-02 §Declarations](03-02-saved-input.md#declarations), ST-10.
- [ ] 2.2.2 Add bounded private compatibility/population-count source helpers; [03-02 §Query implementation](03-02-saved-input.md#query-implementation), ST-12–ST-14.
- [ ] 2.2.3 Implement guarded `keyState` over borrowed saved data; 03-02, ST-11–ST-15.
- [ ] 2.2.4 Implement guarded `joystickState` for both ports; 03-02, ST-11–ST-15.
- [ ] 2.2.5 Add named register constants, full result initialization and the balanced one-attempt acquisition transaction; [03-03 §Source transaction](03-03-acquisition.md#source-transaction), ST-16–ST-17.
- [ ] 2.2.6 Add the private PA-only callback/shared marker and complete route ordering; [03-03 §Interrupt callback and handback](03-03-acquisition.md#interrupt-callback-and-handback), ST-19–ST-22.
- [ ] 2.2.7 Apply only AR-P6's exact nine-name extension in `test/rd05/bundled-input-library.spec.test.ts:135`; preserve every existing fixture and behavior assertion.
- [ ] 2.2.8 Rebuild and run all three new specification files to GREEN, unchanged; record actual source/byte identities and complete output comparisons here.

Verify: the new directed command, existing bundled-input/library, source
reachability, joystick and NMI suites; build first. ST-23 parity is mandatory,
not deferred to RD-08. Each pure classifier task gets its directed cases as soon
as declarations resolve; complete scan/runtime tasks remain pending until run.
No new compiler intrinsic, profile inventory or bundled loader change.

### Session 2.3 — internal checks, native qualification and closeout

- [ ] 2.3.1 Add `test/rd05/input-library.impl.test.ts` for actual private helper/callback reachability and selected-home closure after GREEN; reuse current typed/build evidence, not a new validator.
- [ ] 2.3.2 Execute ST-18–ST-23's exact-source four-profile native qualification sequentially; record matrix/joystick/NMI/RESTORE, restoration, full cost and proof limits in `09-closeout.md`.
- [ ] 2.3.3 Update `docs/platform-libraries.md` and complete the scoped deferral-expiry/ownership check in `09-closeout.md`; [01](01-requirements.md).
- [ ] 2.3.4 Run full verification and independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance reviews; resolve findings through their normal gates, record `10-phase-2-review.md` and update index/progress/roadmap.

Verify: root install/build/typecheck/full tests, sequential actual VICE cases,
targeted formatting, whitespace and exact immutable/old-oracle guards. All new
specifications execute without skips. Reviewers independently inspect the actual
phase baseline/diff and evidence; authors do not review their own oracle.

## Completion and resume boundary

All 36 tasks and [01's completion evidence](01-requirements.md#completion-evidence)
must be satisfied. Plan/preflight acceptance is not runtime or parity acceptance.
Any necessary larger mechanism, new API, source limitation, frozen change or
old-test exception becomes the next exact AR-P item before implementation.
RD-05/DEF-7 remain open unless their separately owned remaining work completes.
No automatic push, host release claim or physical-hardware certificate follows.
