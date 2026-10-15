# Execution: keyboard and combined input

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-11
> **Progress**: 38/48 tasks (79%)
> **Status**: Blocked — AR-P38 whole-input cost-closure design is unresolved
> **CodeOps Artifact Schema**: 1

## Implementation phases

| Phase | Title                                                    | Tasks | Dependency                                |
| ----- | -------------------------------------------------------- | ----- | ----------------------------------------- |
| 1     | Three existing-consumer output corrections               | 20    | Approved AR-P12; qualified T-11/T-12/T-14 |
| 2     | Complete ordinary-source input library and qualification | 28    | Phase 1 GREEN and reviewed                |

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

| Source variant | Payload/code | BSS | RAM SFA |  ZP | Resident RAM | Generated stack | Scratch |
| -------------- | -----------: | --: | ------: | --: | -----------: | --------------: | ------: |
| Masked read    |          767 |  60 |      14 |   4 |          845 |               2 |       0 |
| Returned store |          772 |  57 |      17 |   6 |          852 |               2 |       0 |
| Borrowed store |          809 |  65 |      15 |   4 |          893 |               2 |       0 |
| Index guards   |        1,086 | 389 |      31 |   6 |        1,512 |               4 |       0 |
| Checked bounds |          735 |  60 |       7 |   4 |          806 |               4 |       0 |
| Predicate      |          694 |  50 |       5 |   0 |          749 |               2 |       0 |
| Byte retention |          816 |  58 |       7 |   0 |          881 |               4 |       0 |
| Fixed caller   |          918 |  49 |      22 |   8 |          997 |               2 |       0 |
| Call guards    |        1,622 |  91 |      30 |  10 |        1,753 |               2 |       0 |

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

| Source                     | Payload/code before→after | BSS | RAM SFA before→after | ZP before→after | Resident before→after | Generated stack | Scratch |
| -------------------------- | ------------------------: | --: | -------------------: | --------------: | --------------------: | --------------: | ------: |
| Masked read                |                   767→726 |  60 |                 14→9 |             4→4 |               845→799 |               2 |       0 |
| Returned store             |                   772→731 |  57 |                17→12 |             6→6 |               852→806 |               2 |       0 |
| Borrowed store             |                   809→768 |  65 |                15→10 |             4→4 |               893→847 |               2 |       0 |
| Index guards               |               1,086→1,086 | 389 |                31→31 |             6→6 |           1,512→1,512 |               4 |       0 |
| Bounds witness, checks off |                   735→719 |  60 |                  7→7 |             4→4 |               806→790 |               4 |       0 |
| Predicate                  |                   694→668 |  50 |                  5→1 |             0→0 |               749→719 |               2 |       0 |
| Byte retention             |                   816→788 |  58 |                  7→6 |             0→0 |               881→852 |               4 |       0 |
| Fixed caller               |                   918→870 |  49 |                22→19 |             8→6 |               997→944 |               2 |       0 |
| Call guards                |               1,622→1,609 |  91 |                30→30 |           10→10 |           1,753→1,740 |               2 |       0 |

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

> **Phase baseline tree**: `04d97bcc38c3498427a9e41b37380223c2e04527`
> **Source checkpoint**: `904511e9238604419303e4e20df84d2305156bef`
> **Scope mode**: strict

Phase 1 is GREEN and reviewed. Root inspected `/tmp` before this next task;
the ten remaining Blend65 directories are retained CIA2/NMI qualification
evidence, not unneeded current scratch. None is removed. Implementation-blind
authors receive fresh contexts, frozen/approved behavior excerpts and existing
public fixture interfaces only. They first bound each writing task by concern
and size before editing; root owns task sequencing and sequential verification.

### Session 2.1 — independent specification tests

Reference: [03-02](03-02-saved-input.md), [03-03](03-03-acquisition.md), [07](07-testing-strategy.md).

Before writing, the independent author bounded ST-10–ST-15 into six small
concern files, each expected at roughly 140–195 lines. This preserves readable
test files and one bounded task per concern without a shared helper module,
framework or product change. The five additional writing tasks change 36→41;
Phase 1 remains complete. Other Phase 2 task identifiers stay unchanged.

The grounded author's first unverified draft formats to 265 lines. Before
further editing or execution, root splits exact grounded examples from the
independent contact-graph soundness checks into two bounded writing tasks.
No case is dropped and no shared helper/framework is added. This changes
41→42 tasks and six→seven saved-data files. Later Session 2.1 IDs shift by
one; Sessions 2.2/2.3 and their authority are unchanged. The oversized draft
is neither complete nor verified and will be revised within the assigned file.

Before writing the guard unit, the author separates invalid arguments/quality
from changed-hardware/no-MMIO/saved-only reachability evidence. Each is bounded
below 200 added lines, using existing public fixtures only. This changes
42→43 tasks and seven→eight saved-data files, without a new helper or framework.
Later Session 2.1 IDs shift once more; Sessions 2.2/2.3 stay unchanged.

The acquisition author's read-only sizing separates normal acquisition,
PBON failure, running timers and compatible prior owners into four bounded
writing units. Each uses existing public fixtures; no write-value recorder,
decoder or shared helper is added. Register access order/count is automated;
native held-matrix cases and independent source/output review jointly prove
driven-column values. Existing negative/regression suites remain unchanged
and are verified at the phase checkpoint, not duplicated from their answers.
This changes 43→46 tasks and ten→thirteen new Phase 2 files. Later Session 2.1
IDs shift by three; Sessions 2.2/2.3 and product authority stay unchanged.

The clean output author's pre-sizing separates saved-query, acquisition and
whole-caller output assertions into three bounded files. Plain independent
assembly/source fixtures retain complete candidate code, layout and cost
derivations; no new TypeScript helper, harness or validator is introduced.
Actual fast/small expert artifacts keep their different byte/cycle tradeoffs;
partial diagnostic sums never become a whole-package floor. This changes
46→48 tasks and thirteen→fifteen new Phase 2 specification files. The final
combined RED task moves to 2.1.16; Sessions 2.2/2.3 stay unchanged.

- [x] 2.1.1 [spec-author] Write ST-10 declarations, exact exports, enum/matrix values and packed layout in `test/rd05/input-saved-data.spec.test.ts`. (verified: 2026-10-10 14:20; all 16 cases execute to expected RED for the absent nine-name API; zero skips; formatting and independent-author input boundary clear)
- [x] 2.1.2 [spec-author] Write ST-11 released/single-key/all-joystick-domain saved observations in `test/rd05/input-saved-simple.spec.test.ts`. (verified: 2026-10-10 14:28; four profile cases expected RED for absent exports, zero skips; independent oracle and formatting inspected)
- [x] 2.1.3 [spec-author] Write ST-12 floating rectangles and both star orientations in `test/rd05/input-saved-components.spec.test.ts`. (verified: 2026-10-10 14:30; four cases expected RED for missing exports, zero skips; independent component oracle and formatting inspected)
- [x] 2.1.4 [spec-author] Write ST-13's exact grounded eligibility, sole-source and distinct-ground cases in `test/rd05/input-saved-grounded.spec.test.ts`. (verified: 2026-10-10 14:38; four cases expected RED for absent API, zero skips; twelve exact examples retained, formatting and oracle inspected)
- [x] 2.1.5 [spec-author] Write ST-13's independent 16-endpoint contact-graph observations and definite-answer soundness cases in `test/rd05/input-saved-contact-graphs.spec.test.ts`; no production decoder mirror or shared helper module. (verified: 2026-10-10 14:41; four profile cases expected RED for absent API, zero skips; independent reachability, soundness and formatting inspected)
- [x] 2.1.6 [spec-author] Write ST-14 full-matrix inconsistencies and direct HIGH preservation in `test/rd05/input-saved-incompatible.spec.test.ts`. (verified: 2026-10-10 14:44; four cases expected RED for absent API, zero skips; all six incompatibility classes and direct HIGH oracle inspected, formatting passes)
- [x] 2.1.7 [spec-author] Write ST-15 invalid arguments/quality, snapshot immutability and out-of-range guard evidence in `test/rd05/input-saved-guards.spec.test.ts`. (verified: 2026-10-10 14:55; four cases expected RED for absent API, zero skips; dynamic guard/padding oracle and formatting inspected)
- [x] 2.1.8 [spec-author] Write ST-15 changed-hardware, zero fresh MMIO and saved-only scanner-state/interrupt reachability in `test/rd05/input-saved-query-purity.spec.test.ts`; use existing tracepoints and public frontend/debug identities, not private names or a new fixture. (verified: 2026-10-10 15:03; four cases expected RED for absent exports, zero skips; independent oracle/public joins inspected, formatting passes)
- [x] 2.1.9 [spec-author] Write ST-16 normal acquisition, exact ordered register effects, restoration and helper/loop/status cases in `test/rd05/input-acquisition.spec.test.ts`; use existing build/VICE interfaces. (verified: 2026-10-10 15:19; eight cases expected RED for absent exports, zero skips; normative effect/order oracle and formatting inspected)
- [x] 2.1.10 [spec-author] Write ST-17's CRA/CRB/both PBON unavailable paths in `test/rd05/input-acquisition-unavailable.spec.test.ts`; preserve zero placeholders, ordered reads and absence of writes/publication. (verified: 2026-10-10 15:20; eight cases expected RED for absent exports, zero skips; normative failure-path oracle and formatting inspected)
- [x] 2.1.11 [spec-author] Write ST-17 running-timer/configuration and normal-handback cases in `test/rd05/input-acquisition-timers.spec.test.ts`; preserve existing timer and consuming-read ownership. (verified: 2026-10-10 15:31; eight cases expected RED for absent exports, zero skips; normative timer oracle and formatting inspected)
- [x] 2.1.12 [spec-author] Write ST-22 compatible chained/exclusive prior-owner composition in `test/rd05/input-acquisition-owners.spec.test.ts`; preserve existing negative/no-generation suites without inventing a new source ban. (verified: 2026-10-10 15:40; eight cases expected RED for absent exports, zero skips; normative composition oracle and formatting inspected)
- [x] 2.1.13 [spec-author] Write ST-23's saved-query output/resource assertions in `test/rd05/input-saved-query-output.spec.test.ts` with independently derived complete ordinary-caller assembly/source fixtures. (verified: 2026-10-10 16:04; complete 683-byte expert artifact independently assembles; four expected missing-export RED cases, zero skips; source/oracle/formatting inspected)
- [x] 2.1.14 [spec-author] Write ST-23's acquisition/callback output/resource assertions in `test/rd05/input-acquisition-output.spec.test.ts`; preserve selected-route and complete state/stack ownership boundaries. (verified: 2026-10-10 16:04; independently assembled complete fast/small artifacts retain distinct costs; four expected missing-export RED cases, zero skips; formatting and oracle inspected)
- [x] 2.1.15 [spec-author] Write ST-23's complete caller/artifact assertions in `test/rd05/input-library-output.spec.test.ts`; derive complete equivalent expert acquisition/query/caller baselines before production edits. ST-18–ST-22 native matrix/RESTORE cases use the already-owned procedure in 07, not a new test framework. (verified: 2026-10-10 16:05; complete expert artifacts independently assemble unchanged; four expected missing-export RED cases, zero skips; complete ownership/oracle/formatting inspected)
- [x] 2.1.16 Run all fifteen new files to RED for the absent public library; record baseline diagnostics and oracle provenance here. (verified: 2026-10-10 16:06; all 88 cases execute to expected absent-API RED, zero skips; complete source/oracle identities and independent provenance retained, formatting/links/whitespace/guards pass)

Verify: `yarn vitest run test/rd05/input-saved-data.spec.test.ts
test/rd05/input-saved-simple.spec.test.ts test/rd05/input-saved-components.spec.test.ts
test/rd05/input-saved-grounded.spec.test.ts test/rd05/input-saved-contact-graphs.spec.test.ts
test/rd05/input-saved-incompatible.spec.test.ts
test/rd05/input-saved-guards.spec.test.ts test/rd05/input-saved-query-purity.spec.test.ts
test/rd05/input-acquisition.spec.test.ts test/rd05/input-acquisition-unavailable.spec.test.ts
test/rd05/input-acquisition-timers.spec.test.ts test/rd05/input-acquisition-owners.spec.test.ts
test/rd05/input-saved-query-output.spec.test.ts test/rd05/input-acquisition-output.spec.test.ts
test/rd05/input-library-output.spec.test.ts`.
Missing library/API is RED, not a permitted skip or commit. Stop for an exact
runtime ruling if the ordinary source or complete output needs support beyond
AR-P12; do not weaken the accepted behavior to produce GREEN.

Task 2.1.1: the implementation-blind author writes 192 formatted lines. All
16 declaration/layout/cast cases execute across four cooperative profiles and
fail as expected while the nine new public names are absent; no skip or VICE
run. The cast cases are incomplete, other cases error, with explicit missing
exports; mask caller constants produce ordinary unused warnings. Log:
`phase2-declarations-red.log`, 4.44 seconds. Public parsed member inventories
prove exact enum names, evaluated caller constants prove values, and public
typed declarations prove packed layout and ordinary const-borrow signatures.
All 256 byte values are covered for each enum. Root inspects the new source,
author provenance and actual RED log. No production or old-test change occurs;
this expected-RED test work remains uncommitted until the coherent Phase 2
checkpoint.

Task 2.1.2: the blind author writes 125 formatted lines using only existing
public source-library/VICE interfaces. The frozen finite batch contains
1,089 saved snapshots per profile: released, all 64 single contacts and all
1,024 two-port ground combinations, including every single-port state.
Each snapshot expects all 74 named answers and its original 11 bytes.
Grounded endpoint alternatives produce UNCERTAIN; opposite-baseline-empty
joystick lows produce DOWN. No physical-acquisition claim follows.
Root's directed run is expected RED: four failures, zero passes/skips,
all at missing library exports before any VICE start, 2.03 seconds.
Log: `phase2-simple-red.log`. Root inspects the complete new file and
formatting passes. Runtime coverage remains pending; the existing per-profile
100,000,000-cycle VICE session budget is an explicit verification assumption.
No implementation, old-test, shared-fixture or commit change occurs.

Task 2.1.3: 128 independently authored formatted lines, fifteen floating
component snapshots per profile. All 64 keys, ten controls and eleven saved
bytes are asserted for boundary rectangles, both star orientations, larger
rectangles through full 8×8 and disjoint star/rectangle cases. The oracle
uses necessary star paths and optional connected-rectangle edges, not
production code. Root inspects the entire file. Formatting passes.
`phase2-components-red.log` records four expected missing-export failures,
zero passes/skips, 1.99 seconds, before VICE. Runtime coverage is pending;
no production, old-oracle or shared-fixture edit occurs.

Task 2.1.4: root splits the oversized unverified draft before verification;
the exact-example file is 104 formatted lines. All twelve grounded examples
are retained with both star orientations, eligible 0/4 and ineligible 5/7
endpoints, distinct same-ordinal port sources and opposite-empty baselines.
Each asserts all 74 answers and unchanged packed bytes. Root inspects the
entire file; formatting passes. `phase2-grounded-red.log` records four
expected missing-API failures and zero skips, before VICE. Actual runtime
qualification and the separate independent contact model remain pending.
While inspecting the draft, root corrects only its not-yet-frozen supporting
disjoint witness: the future floating rectangle must not share the grounded
star's PB7. No completed oracle expectation or product behavior is changed.

Task 2.1.5: 173 independent formatted lines. Six physical-contact witnesses
cover floating/grounded missing-edge rectangles, genuinely disjoint components,
a sparse cycle spanning all eight columns/rows and both sole-source stars.
A local 16-node reachability walk constructs released/drive observations;
every definite answer must match actual contacts/direct sources. This does
not compute the production residual characterization or replace exact
certainty tests/full-domain proof. Root inspects the complete new file;
formatting passes. `phase2-contact-graphs-red.log` records four expected
missing-export failures before VICE, zero skips. Runtime remains pending.
No shipped graph, shared helper, old-oracle or implementation edit occurs.

Task 2.1.6: 112 independent formatted lines, seventeen explicitly incompatible
snapshots per profile. The fixtures cover all six condition classes, every
missing-baseline column, remote unequal overlapping components and eligible
4 versus ineligible 5/7 grounds. Only the independent direct-HIGH→UP,
other-LOW→UNCERTAIN rule computes expected answers; no decoder is mirrored.
Each snapshot asserts all 74 answers and eleven unchanged bytes.
Root inspects the full file and formatting passes. `phase2-incompatible-red.log`
records four expected missing-export failures before VICE, zero skips.
Runtime remains pending; production, old oracles and fixtures stay unchanged.

Task 2.1.7: 120 independently authored formatted lines. Twenty-five dynamic
scenarios per profile check 317 answers: four invalid quality classes over
all named queries, two invalid keys, three invalid ports over all five
controls, and two invalid controls on both valid ports. Ordinary packed
padding surrounds the snapshot, with 1,024 load/store tracepoints per profile
and unchanged-byte assertions. The source fill syntax is frozen Chapter 08's
`[values; fill]`, not a partial-array construction. Root inspects the full
file and frozen fill rule; formatting passes.
`phase2-guards-red.log` records four expected missing-export/type failures,
zero skips, 2.03 seconds, before VICE. Actual guard execution remains pending;
padding traces alone do not prove every internal row/control dominance boundary.
Source/emitted review and the separate purity/output cases still own those
remaining obligations. No implementation or existing oracle changes.

Task 2.1.8: 162 independently authored formatted lines. Four compatible saved
observations exercise single-key, floating-rectangle, sole-source grounded and
distinct-port grounded DOWN/UNCERTAIN paths. Each profile checks all 74 answers
and eleven unchanged bytes under two different CIA1 latch/DDR configurations.
The 8,196 owned CPU-port/full-I/O load/store tracepoints exclude monitor setup
and are filtered/removed locally. Public typed interrupt identities are joined
to selected debug functions; public module globals are joined to symbol-owned
physical intervals. These checks distinguish unused scanner state from ordinary
SFA and declaration-only constants; the complete-output audit still owns the
remaining wrapper/link attribution. Root inspects the full new source.
Formatting passes. `phase2-query-purity-red.log` records four expected
missing-export/type failures, zero skips, 2.13 seconds, before VICE starts.
Hardware independence and trace execution remain pending; no native acquisition
claim, new fixture, production or existing-oracle change follows.

Task 2.1.9: 174 formatted lines, eight profile/I-state cases; each runs two
ordinary helper/loop acquisitions with saved DDR pairs $FF/$00 and $A5/$5A.
The independent expected register list follows 03-03 directly: 14 reads and
15 writes, no PB/timer/ICR/CIA2/bank traffic, publication after direction setup,
own final idle before removal and direction restoration. Results, saved DDRs,
vector and observable I/D/SP are asserted. This released-input case does not
prove driven-column values, native races, timing, parity or normal BASIC return.
Root inspects the full new source; formatting passes. `phase2-acquisition-red.log`
records eight expected missing-export/type failures, zero skips, 2.07 seconds,
before VICE. The author disclosed roadmap cost/status-row and adjacent monitor/
runtime body exposure. Those inputs are excluded from oracle evidence; expected
transaction behavior derives from the approved normative sequence only.
Fresh independent phase review must verify that derivation; author agreement
is not decisive proof. Actual transaction execution remains pending.

Task 2.1.10: 126 formatted lines, eight profile/I-state cases and three
ordinary helper/loop scenarios each: CRA PBON, CRB PBON and both. Source
initializes distinct nonzero result bytes before each call, then expects ten
zero raw placeholders and UNAVAILABLE. The only owned device accesses are
ordered CRA/CRB reads; no CIA1 write or vector publication, with unchanged
controls/DDRs/vector and observable I/D/SP. Root inspects the full source and
formatting passes. `phase2-acquisition-unavailable-red.log` records eight
expected missing-export/type failures, zero skips, 2.04 seconds, before VICE.
No additional prior-file read occurs for this unit; the earlier disclosed
orientation exposure is excluded, with fresh phase-oracle review still due.
Actual device/return execution remains pending; no source or old-oracle edit.

Task 2.1.11: 169 formatted lines, eight profile/I-state cases and three
scenarios each: timer A, timer B and both running with PBON clear. The oracle
preserves exact controls/DDRs, stopped counters, result initialization and I/D/SP;
the owned scan interval permits no timer/control writes or CIA1/CIA2 ICR access.
A one-NOP public helper probe after START settling demonstrates progress outside
the scan, avoiding a false full-scan inequality claim across a possible timer
wrap. The probe opcode is verified rather than inferred from a private layout.
No atomic counter snapshot, finite full-scan deadline or exact bus-cycle claim
is made. Root inspects the full source and formatting passes.
`phase2-acquisition-timers-red.log` records eight expected missing-export/type
failures, zero skips, 2.05 seconds, before VICE starts. The earlier disclosed
orientation exposure stays excluded; no further prior-file read is reported.
Actual timer/transaction execution and fresh phase-oracle review remain due.

Task 2.1.12: 156 formatted lines, eight profile/prior-owner cases, each with
two ordinary helper/loop acquisitions. A transparent chained predecessor retains
stock consuming firmware. The exclusive caller explicitly acknowledges CIA2
into caller-owned shared state and replaces RESTORE with normal return in this
unexpanded fixture, as permitted by frozen Appendix C64 section 9.2. That is
caller policy, not library policy or qualification of injected events.
Actual generated terminals, a non-stock predecessor vector, exact nested LIFO
handback/removal, results, DDRs and observable I/D/SP are asserted. The chained
terminal operand identifies its two-byte page-safe physical link without private
labels; owned store traces and byte observations check its live immutability.
No private owner-ID convention is guessed. Complete selected-route/SFA closure
and native NMI/RESTORE behavior stay due under 2.3.2/2.3.4.
Root inspects the full source and formatting passes.
`phase2-acquisition-owners-red.log` records eight expected missing-export/type
failures, zero skips, 2.08 seconds, before VICE. Fresh author inputs are only the
normative contract, frozen NMI ownership section and generic public evidence
schemas. No additional implementation/prior-answer exposure is reported;
the earlier orientation disclosure stays excluded with fresh phase review due.

Output-author provenance: an initial context read roadmap cost-answer rows and
is stopped before writing. Its derivation is excluded. A fresh context receives
only aggregate workflow metadata, normative contracts and public interface
shapes; no prior cost answers. Complete expert query/caller/startup/placement
baselines are still being derived, not replaced by partial acquisition sums.

Preliminary combined check at 15:46: `phase2-first-twelve-red.log` retains all
twelve currently authored files failing for absent exports/types: 76 expected
RED cases, zero skips, 11.38 seconds. All twelve files pass targeted formatting;
links, whitespace and unchanged frozen/source paths pass. This does not complete
2.1.16: the independent complete-output units still must be authored and included.
No VICE case, production edit or GREEN commit follows from this RED checkpoint.

Tasks 2.1.13–2.1.15: the clean author supplies three bounded public output
files and thirteen plain source/assembly fixtures. Root reads every complete
file before running tests. Initial independent ACME 0.97 assembly rejects all
three expert candidates' exact placement/payload guards. Numeric expectations
remain explicitly pre-freeze while instruction syntax/width is reconciled;
no production result is used to adjust them, and no implementation starts.
Unknown external firmware/interrupt time remains outside finite CPU witnesses.

Task 2.1.13: primary ACME examples establish bare accumulator mnemonics;
seven accidental memory-symbol operands are corrected before oracle freeze,
without changing any intended instruction, numeric expectation or product
contract. All three complete candidates then assemble with every exact placement
guard: saved payload 683 bytes, fast 912 and small 829. Saved PRG SHA-256 is
`be6f4e7acaf7676316c1be216aa71e01a2257418760b458ff8c239fbc52f6772`.
The saved-only file imposes no NMINV entry qualifier. The ordinary source has
the unchanged word-indexed row loop; no compiler-convenience source rewrite.
`phase2-saved-output-red.log`: four missing-export/type failures, zero skips,
1.93 seconds, before runtime or output comparison. Formatting passes. The
bound includes startup/caller/all helpers, physical SFA overlays and complete
general storage. Finite generated-stack components do not certify external
firmware/nesting; CPU path witnesses still need native qualification.

Task 2.1.14: `phase2-acquisition-output-red.log` records four expected
missing-export/type failures, zero skips, 1.93 seconds, before VICE or cost
comparison. Complete fast/small PRG SHA-256 identities are respectively
`634a6184652a3efb6566271713a2b63a6df71b147a78a82758ebbd653e50a7bc`
and `6d6b7b2b244c3520487b462667c16ddc88b2f073eb6f535941ec2a5dc903978b`.
The callback wrapper, immutable link, marker, startup state, alignment padding,
function homes and bounded generated stack are included, not estimated from
an isolated scan. Unknown retained-owner/ROM costs remain Unknown. These are
assembled independent candidates, not executed native qualification.

Task 2.1.15: `phase2-library-output-red.log` records four expected
missing-export/type failures, zero skips, 1.89 seconds. Complete assembly files
charge actual retained code/padding and physical homes, including startup and
ordinary dynamic caller, not a sum substituted from partial diagnostic probes.
Fast and small candidates retain distinct byte/CPU-path tradeoffs; no mixed
minimum is used. The immutable acceptance bound selects the complete fast
candidate. Source evaluation order and stable external qualification-RAM
disjointness remain explicit. The keyboard-only startup candidate declares no
VIC consumer or CIA2 device/bank change and is not a general profile-bank rule.
Complete runtime/CPU timing and actual generated equivalence stay pending.
The fresh author reports no forbidden implementation, prior expectations,
roadmap-answer or qualification-answer inputs. Its initial contaminated
predecessor remains excluded; the acquisition author's earlier disclosed
orientation exposure remains excluded and independently reviewable.

Task 2.1.16: `phase2-all-fifteen-red.log` records all fifteen files and
88 expected absent-export/type failures, zero skips, 13.15 seconds. This is
the specification-first RED criterion, not an implementation/runtime pass.
No VICE process starts. All fifteen files pass targeted Prettier, local links
and whitespace pass, and compiler source/stdlib/frozen spec/expert paths are
unchanged. Exact raw SHA-256 identities for all fifteen test files and thirteen
baseline fixtures are retained in `phase2-oracle-sha256.txt`, manifest identity
`059acf608052ee40483853b668894e6d0a07e1c3a1c5eaffb9af064145cf7fd2`.
Output baselines independently assemble before any source implementation; their
behavior/nominal CPU path witnesses still require native qualification. The
clean output author, saved-data author and disclosed acquisition provenance
remain separately attributable. No RED commit is created.

### Session 2.2 — ordinary source implementation

All source changes below target `packages/compiler/stdlib/c64/input.blend`.
Prepare/qualify through normal builds. The complete public surface and its one
old inventory amendment publish together at the coherent phase checkpoint,
after native qualification, full verification and independent reviews;
partial declarations or an UNAVAILABLE-only acquisition stub are not shipped.

- [x] 2.2.1 Add documented declarations and the exact matrix enum; [03-02 §Declarations](03-02-saved-input.md#declarations), ST-10. (completed: 2026-10-10 19:19; all sixteen complete-source data/signature cases pass, zero skips; fresh build, targeted formatting, documentation/scope checks and independent exact AR-P16 review pass. Other output/retention/runtime tasks remain unqualified.)
- [!] 2.2.2 Add bounded private compatibility/population-count source helpers; [03-02 §Query implementation](03-02-saved-input.md#query-implementation), ST-12–ST-14. (implemented: 2026-10-10 17:29; bounded in-place compatibility and exact-one-eligible-source predicate; public query/runtime verification pending). Complete output qualification resumes under the exact approved AR-P25 batch. Blocked: AR-P38 whole-input cost-closure design/proof boundary; implemented work preserved.
- [!] 2.2.3 Implement guarded `keyState` over borrowed saved data; 03-02, ST-11–ST-15. (implemented: 2026-10-10 17:30; early quality/key/high guards and compatible floating/grounded predicates; independent runtime/output verification pending). Complete output qualification resumes under the exact approved AR-P25 batch. Blocked: AR-P38 whole-input cost-closure design/proof boundary; implemented work preserved.
- [!] 2.2.4 Implement guarded `joystickState` for both ports; 03-02, ST-11–ST-15. (implemented: 2026-10-10 17:31; quality/port/control guards, direct release and separate-port eligible-source classification; independent runtime/output verification pending). Complete output qualification resumes under the exact approved AR-P25 batch. Blocked: AR-P38 whole-input cost-closure design/proof boundary; implemented work preserved.
- [!] 2.2.5 Add named register constants, full result initialization and the balanced one-attempt acquisition transaction; [03-03 §Source transaction](03-03-acquisition.md#source-transaction), ST-16–ST-17. (implemented: 2026-10-10 18:33; one full initialized local result, ordered control/DDRs capture, guarded balanced transaction and ordinary eight-column loop; callback and independent build/runtime/output verification pending). Complete output qualification resumes under the exact approved AR-P25 batch. Blocked: AR-P38 whole-input cost-closure design/proof boundary; implemented work preserved.
- [!] 2.2.6 Add the private PA-only callback/shared marker and complete route ordering; [03-03 §Interrupt callback and handback](03-03-acquisition.md#interrupt-callback-and-handback), ST-19–ST-22. (implemented: 2026-10-10 18:34; private literal PA-idle store then idempotent module-global flag, reusing ordinary setNMI/restoreNMI; selected route/storage, native boundary and independent output verification pending). Complete output qualification resumes under the exact approved AR-P25 batch. Blocked: AR-P38 whole-input cost-closure design/proof boundary; implemented work preserved.
- [x] 2.2.7 Apply only AR-P6's exact nine-name extension in `test/rd05/bundled-input-library.spec.test.ts:135`; preserve every existing fixture and behavior assertion. (completed: 2026-10-10 18:40; all fourteen old inventory/source-composition cases pass; only the nine-name expectation differs from HEAD; formatting and documentation/scope self-check pass. Partial library/data/output failures still prevent a coherent GREEN commit.)
- [!] 2.2.8 Rebuild and run all fifteen new specification files to GREEN, unchanged except exact approved observer exceptions; record actual source/byte identities and complete output comparisons here. Resumed: the user explicitly approved AR-P35's exact observer exception with “Do apply”; all176 unchanged public cases and independent exact-exception reviews now pass; whole-input cost qualification remains due. (implemented: 2026-10-10 17:42; resumed: 2026-10-11 01:15 CEST). AR-P23/AR-P24's startup/observer unit passes136 independent and76 existing banking/output cases; complete compiler2,019 pass, with two existing unrelated skips. Compact startup is60 code bytes/94 nominal cycles/4 saved bytes, with actual borrowed BASIC bytes added separately. AR-P21/AR-P22 static checks and all296 sequential guard/cast/purity cases pass. The approved AR-P12 fixed-global argument completion passes32 new/unchanged caller cases and independent correctness/SFA review. Complete output remains RED at full3,476/963 and saved3,072/725; saved-simple's unchanged native cycle bound remains binding. AR-P25's exact narrowed four-consumer batch is approved; no cost waiver, eligibility solver or unnamed further support authorized. Blocked: AR-P38 whole-input cost-closure design/proof boundary; implemented work preserved.

#### Approved guard-proof specification baseline — 23:20 CEST

An independent implementation-blind author owns only the two new
`source-library-guarded-index*.spec.test.ts` files. The frozen RED baseline has
156 cases: 80 RED and 76 passing conservative fallbacks, zero skips. All four
profiles have identical results. Positive omission compares complete resources
against the same source without cold acquisition state; negative witnesses cover
writes, real mutators, exposed addresses, incomplete/late/unrelated guards, signed
and changing conversions, extent/OOB and volatile/raw observers.

Three legal direct cast/shift forms additionally reveal existing compilation
failures; their source and expectations remain intact. `byte(column)>>3` and
`byte(column)>>6` fail integer-extension lowering, and `sbyte(column)>>5` fails
frontend construction. These are not source restrictions or permission to replace
the witnesses with typed-local workarounds. Production correction starts only
after this RED baseline. Logs: `guard-footprint-spec-red.log` and the preserved
initial authoring run in the existing Git-metadata evidence root. The sole draft
fixture correction replaces compile-time-known OOB assignment `column=9` with
unknown `column=byte(other)`, because the frozen array rule requires E10240 for
the former; the stale-bound assertion remains unchanged. No forbidden production
file was read by the author, no existing oracle edited, and no native run started.

#### Approved offset and observer continuation — 2026-10-11 00:36 CEST

The user explicitly approves the AR-P21/AR-P22 pair before asking the remaining
RD-05 status, then requests uninterrupted completion of this keyboard/input
plan. Only the bounded unsigned constant-offset transfer and exact original
twelve-call fixture selector are authorized. Independent new offset specifications
must be RED before the transfer; all unrelated output mechanisms, protected
tests and frozen authorities remain excluded. Task 2.2.8 resumes in progress,
still 38/48 verified. No RED commit or automatic push.

Independent offset specifications are RED before the production change:
64/64 positive cases fail only the cold-global interval expectation; 60/60
conservative fallback cases already pass. All legal sources check/build, with
no frontend defect and no forbidden implementation read. Raw author log:
`guard-offset-author-red.log` (SHA-256
`a57a3c3f68f315bb6759aafa69255ac48bb94979ff87317c4cd2675a2dad35b8`).
Positive/fallback specification SHA-256 values:
`0bc1f511e06813dcabcd039186dead6ae21a15751c921cf0fc13a05e261bd775`
and `dcba4a4e3d7b592b3cab47398b390643232cc03032af1d8998790c07ccc5ad48`.
Only the approved exact-constant unsigned no-wrap arm is now implemented in
the existing guard helper; directed GREEN and unchanged purity remain pending.
The exact AR-P22 selector passes the complete old profile file (28/28), and
in-memory reversal recovers its original protected file hash above. Complete
compiler verification and final independent oracle inspection remain due.

The post-offset complete compiler suite passes **1,980**, with only two existing
unrelated skips (`guard-offset-compiler-final.log`, 135 files/93.77s). Fresh build,
typecheck, focused124 and targeted formatting pass. Both new specification
hashes remain unchanged. Independent correctness/SFA reviewers find no surviving
logic/storage issue; correctness identifies RV-001 MINOR for two missing new-test
acceptance comments. Its initial broad heading lookup exposed historical preamble
snippets, and the storage reviewer saw the recorded AR-P21 challenge paragraph;
both exclude those exposures from decisive evidence. Their results are static
unit/code/log inspection, not blind expert qualification or independent native
proof. No full Phase 2 review is substituted.

Fresh complete output remains twelve RED (`guard-offset-output.log`,31.87s),
with unchanged payloads3,441/3,001 and budgets963/725. An independent new scope
challenge justifies only one conservative startup choice in existing owners,
not a general effect solver or device framework. Its supplied-excerpt-only
evidence and the actual old A/X/Y observer boundary are disclosed in AR-P23.
AR-P23/AR-P24 await direct approval; no startup or protected observer is changed.
The existing sequential native purity/combined guard command remains running,
without a runtime-pass claim. Task2.2.8 is blocked for new implementation, still
38/48 verified. The user receives the single bounded pair while already approved
verification continues. No RED checkpoint, automatic push or frozen/portfolio edit.

Final approved static regression checks also pass: all five actual semantic
files,94/94 (`guard-offset-internal-complete.log`), and the two old guard files
plus foundation/import-boundary/bundled-source,206/206
(`guard-offset-static-regressions.log`). The derived plan helper confirms38/48,
five verification-pending tasks, one visibly blocked task and four not started;
the initial missing `Blocked:` colon is corrected without changing the reason.
Targeted source/document formatting and diff checks pass; frozen specification,
expert baseline and portfolio have no edits. Read-only roadmap arithmetic finds
only the inherited portfolio1/10 versus feature4/10 drift; its write remains
deferred on this non-integration branch.

Resume the existing native command before starting another VICE run. Its unified
execution session is93831, with output retained in `guard-offset-directed.log`.
At00:55 CEST it is still active; profile processes advance sequentially, but the
reporter has not produced a terminal verdict. Do not infer PASS from that process
progress, delete its live temporary directory or start a competing emulator.
AR-P23/AR-P24 approval is requested asynchronously and remains unanswered.
No further production/old-test change is authorized until that exact reply.

#### Approved startup continuation — 2026-10-11 01:15 CEST

Independent startup authoring has handed off two immutable oracles before any
production startup edit. The final sequential RED run is72 tests:20 genuine
failures /52 passes,23.70s, exit1. Twelve positive cases expose unnecessary
display traffic; eight native cases expose lost borrowed live BASIC bytes after
the existing P/SP/CPU-port/CIA2 checks pass. All52 full-startup fallback cases
pass. The author used primary BASIC declarations and SYS/READY paths, intersecting
proved live ranges with the actual source workspace. No complete BASIC liveness
catalogue is inferred from that bounded observer.

Final SHA-256 identities: positive
`d172a5df1d520ed3d834d9e069cff2a1b7d7df9249a129e473a6bc77fb5894a6`;
fallback `bf5423df7f0a010cfa1dc46f58db47d8fd0e34b1db77324d56d88c7c1d10395c`;
`startup-author-final-red.log`
`9e1bf65afbe5ad9bbab04a787fa6ea8b9957ca31a7888b58a28a970c462dedc2`
in the existing `keyboard-plan-check.hzunZt` evidence root. Before this initial
handoff, a missing planned adapter identity was completed from the public helper
signature: each new file's one `Game.main` lookup became the full
`src/game.blend::Game.main`. Fixtures and behavioral expectations did not change.
The original observer-error run and corrected adapter run are retained as
`startup-author-initial-red.log` and `startup-author-adapter-red.log`, hashes
`24e23acfb899290b47259376a91fd961e278398805ea63959a923af8440d9dd5`
and `a9e299ca9459dea49df8453caf1401d133146f0b8ff3322d876326fc315ab7b4`.
The independently missing live-byte obligation was completed before immutable
handoff; no existing assertion was removed. This initial two-file authoring does
not expand the approved old-test exception.

The bounded binary choice is now implemented, unverified, in the existing
startup/lowering/layout owners. The existing machine-data construction was
mechanically extracted to keep lowering below the project file-size ceiling;
the one conservative eligibility query remains a small lowering helper, not a
new pass or effect solver. Final layout uses actual certified ZP homes and
already reserved source ZP globals for BASIC snapshots. Unknown call/address/
alias/place facts keep the full startup. Caller status remains a transient
one-byte stack operation, not an unproved retained save across main. Actual
borrowed BASIC-window bytes are conservatively saved; no complete liveness
catalogue or expert seven-byte inventory is copied. The cost of that conservative
choice remains subject to the output gate. GREEN/native and full-output
qualification are pending;38/48 remains unchanged. Old startup oracles still
have no edits.

Directed new startup qualification is72/72 PASS,27.06s, unchanged oracle hashes.
The approved two49-byte observers now require the actual empty-program5 bytes;
only the twelve named outgoing-register lines were removed. Exact in-memory
comparison against original hashes passes. The old banking/output root suite
passes72/72,231.79s. Its mixed filename command selected only the two root files;
internal evidence comes separately from the compiler suite, not that command.
The first full compiler run exposes two mutable internal expectation mismatches
(full structured bytes606 vs actual unchanged609, and an eligible aggregate
call's save size49 vs actual5); both are corrected. The dedicated compiler-cwd
rerun passes45/45,1.71s. Build/typecheck pass; complete compiler rerun remains due.

Independent bounded review: SFA/ABI and platform preservation have no findings
at their stated static/inspected native endpoints. Correctness reports RV-001
MAJOR: the initializer handoff still assumes incoming A=0, while compact startup
ends with the masked incoming CIA2 direction byte. A leading source zero
initializer can therefore store a nonzero value. This is a necessary correction
inside the approved exact initializer contract, not a new effect solver, product
decision or output allowance. Independent new RED regression precedes the
smallest handoff correction; the unit is not declared clear or committed.

The first additional-author context accidentally exposed source-manifest
oracle-map rows during a broad search. It produced no file and started no native
run; that context is excluded from this new decisive check. A fresh blind author
owns only `startup-zero-initializer.spec.test.ts`, with the entire manifest and
all production/prior oracle/findings/history files forbidden. Earlier immutable
two-file qualification preceded the exposure and remains unchanged. Historical
routing smoke summaries accidentally exposed to the primary and two reviewers
were also excluded from decisive evidence. No complete phase/parity/hardware
qualification follows from these bounded reviews;38/48 and all output gates stay.

The fresh blind initializer author hands off24 independent cases RED before
the correction:12 pure-startup failures /12 full-fallback passes,190.02s,exit1.
Pure scalar/zero-leading array values contain164 instead of0 under DDRA=$A7;
the scalar instruction oracle independently observes164 in the actual store
register. Full controls restore SYS P/SP/ports/DDRA and reach READY. New immutable
file `startup-zero-initializer.spec.test.ts` SHA-256
`8e0bd994b5dce64029c87adb6311128065a7d5a85b622307d64a59b7892aab3c`;
`startup-zero-author-red.log` SHA-256
`f2f017696af0769b828e7d73a79305f59725cf626ac588d5b8f52468551a46a2`
in the retained evidence root. No forbidden read/exposure in this fresh context.
The smallest correction is now implemented, unverified: calculate the same binary
choice before lowering initializers and seed the accumulator fact unknown for
compact, zero for full. No redundant full-startup zero load, new helper, source
restriction, oracle edit or new storage demand. Fresh GREEN and independent
correctness re-review remain due; the unit/phase is not committed or advanced.

At01:57 CEST, the corrected initializer qualifies: all three immutable startup
files pass96/96,66.39s (`startup-final-native.log`, SHA-256
`9c2a1f0094f18738218c2304a4d2af2f2fa33b3543471f90201b1eed268edce0`).
The complete compiler passes2,013 with the two existing unrelated skips,137
files,94.21s (`startup-final-compiler.log`, SHA-256
`b4e610ca385c817442430cfcca62b27bffb918e83f52b0e345bc3d0151f477c0`).
All twelve full-output cases still fail their unchanged first payload bounds:
full3,496/963 and saved3,131/725 (`startup-final-output.log`, SHA-256
`161c2e1662d63ae28a1055f1c88dece818d60a321e9201ed8c3c28d1aba9ff5b`).
The ordinary caller conservatively keeps full startup; its eleven actually
borrowed BASIC bytes add110 code/11 state bytes. Placement absorbs part of the
change. No compact eligibility expansion or complete output win follows.

Independent emitted-byte review reports two necessary compact-startup
corrections, MC-001/MC-002 MAJOR: avoidable processor-port reloads cost5 bytes/
6 nominal cycles; defensive SP capture/reset costs8 bytes/12 cycles/one state
byte despite the existing balanced-stack source/return contract. These are
existing-owner instruction/storage corrections within AR-P23's observable
P/I/D/SP duties, not a new solver, product decision or waiver. The project
workflow directive permits compiler-owned corrections without another prompt;
the approved exact AR-P24 observer remains the actual independently qualified
empty save size, not an arbitrary fixed allowance. Fresh independent RED cost
expectations and bounded stack/correctness review precede either change.
Direct/default full construction retains its conservative save/reset contract.
The proposed60-byte/94-nominal-cycle compact startup is still unassembled and
unexecuted. Its inherited empty-main3-byte jump is separate baseline layout
debt, not hidden by comparing only a startup component. No RED commit or push.

The independent compact-cost author hands off8/8 genuine RED cases before
either instruction/storage correction,2.58s, on four profiles and empty/eight-
byte placed BASIC workspaces. All hardware/order checks already pass; only
code/cycle/state ceilings fail. The instruction-derived equal-contract ceiling
is60 bytes/94 nominal cycles/four save bytes, plus10 bytes/14 cycles/one save
byte per unique actual BASIC borrow. Whole artifacts are separately observed,
not assigned an invented startup-derived ceiling. The bounded straight-line
decoder leaves unsupported control flow Unknown; it is not a new CPU validator.
New immutable file `startup-register-cost.spec.test.ts` SHA-256
`5461c670f357a703ad8401066eac8ce481c4543c9ef4dfe318dd96fb4125d95c`;
`startup-register-cost-red.log` SHA-256
`4ca9f852839734f9a29a9ae24975107ee9a659c3fe7896f458bdb906e8de6429`.
The author used only the explicitly allowed schema-only memory report and public
adapters, plus normative instructions/contracts; no production/old-finding/
assembly/cost-oracle read. Earlier zero-initializer observations remain in its
context and do not supply this independent cost ledger.

Fresh correctness re-review reports RV-001 resolved, all four exact exceptions
within scope, and unchanged three earlier startup hashes. Its separate stack
assessment supports compact SP preservation through existing source/ABI balance;
direct/default full capture/reset remains. The compact corrections are now
implemented, verification pending: retain captured direction in X across A-only
borrow snapshots, capture CPU1 last and use its fresh A for mapping, and omit
only compact SP save/reset and its byte. No held P across main, new stack route,
eligibility expansion, solver, source workaround or relaxed ceiling. New GREEN,
sequential native state preservation and fix-only output review remain due.
The two old size observers remain5 until the actual four-byte state independently
qualifies; AR-P24 authorizes the qualified actual size, not a permanent five.

Compact-fix qualification is GREEN at the bounded endpoint: all104 unchanged
startup specifications pass60.11s, complete compiler2,013 pass with two existing
unrelated skips86.10s, build/typecheck and targeted formatting pass. The actual
empty PRG is retained at `startup-probe.eIJFEU/out/243e2327-c902-4dbc-9cae-1454a760692a/`,
SHA-256 `3c4e6d831357b73e11a27311ff8110baf7637e9eb704c72579335cb1c23beeaf`.
Independent fix-only output review clears MC-001/MC-002: entry38 bytes/55
nominal cycles, restore22/39;60/94 combined, four state bytes, zero ZP/function
homes/scratch/padding, one transient stack byte. Complete payload75/resident79
includes the unchanged12-byte BASIC stub and inherited3-byte/3-cycle main JMP.
Local meet is not a whole-program win; full startup remains609/826/49.

After this independent/native qualification, the two approved size observers
become4. The old output/banking suite then passes72/72,205.08s; no outgoing
register expectation is reintroduced and every other original observer remains.
Evidence hashes: `startup-register-native-green.log`
`1535d9aac6435c95436166c13c2b01ba5138a341e9132bb5de258fd63337ded8`;
`startup-register-compiler.log`
`57be9a8d5b3e689ce4c4157fd792768e3133c579e94b0752ff405e6ae2006085`;
`startup-register-old-regressions.log`
`9ef6b4c01121cea2aeac36591825675dc057caa1b252834a8a03b87dcd3b2f81`.
All four new startup oracle hashes remain unchanged. Full phase six-lens review,
whole input parity, saved-simple's unchanged bound and subsequent tasks remain
due. Physical, unrestricted external NMI stack/firmware/deadline endpoints stay
unproved.38/48 remains; no RED commit or push.

The next read-only ordinary-source probe reveals an incompletely selected
already-approved AR-P12 fixed-argument case: a global struct/array label still
stages its constant address in ZP, unlike a fixed local home. The existing
marshaller already handles both storage and label identities, but the address
producer's sole-call guard currently admits storage only. Completing that same
guard family requires no new pass/IR/runtime/solver/call ABI/public support.
Fresh independent global-argument behavior/output tests precede the correction;
no fixed-field addressing, interprocedural solver, loop or general optimization
support is inferred. The separate read-only `borrow-field-probe.Ckg2Ir` artifact
also exposes28-byte/45-cycle borrowed-field access; that distinct family is
outside this completion and is not yet authorized or implemented.

The user accepts the exact AR-P23/AR-P24 pair with “I approve”. Task2.2.8
resumes; no sibling promotion or new material support follows. The independent
author owns only fresh `startup-unobserved-display.spec.test.ts` and
`startup-display-fallback.spec.test.ts`, with implementation/old-oracle reads
forbidden and RED required before production changes. Existing startup is the
default/fallback. Actual borrowed BASIC/vector protection, returning-interrupt
and retained-status stack duties remain proof obligations, not assumed expert
inventory. The two exact offset comments are added without fixture/assertion
change; RV-001's missing-comment remedy is applied.

The prior sequential native command93831 finishes successfully: six files,
296/296 cases,1879.15seconds. All four saved-query purity profiles pass; the
8,196-byte-tracepoint observer is slow but correct. No timeout/helper change or
further exception is needed. Log: `guard-offset-directed.log` under the existing
Git-metadata evidence root. This is native purity/guard qualification only;
complete output and saved-simple cycle bounds remain RED. No frozen/portfolio
edit, RED commit or automatic push.

#### Guard/cast unit qualification and remaining authority — 23:38 CEST

The bounded AR-P19 correction is implemented in the existing semantic footprint
owner. It records unsigned facts before each indexed access, preserves captured
value identity, invalidates mutable reload facts, and joins only facts present
on every path. Shared/address-exposed roots and unproved/raw accesses retain
the complete conservative fallback. The helper adds no runtime storage, pass,
IR kind or general arithmetic/recurrence solver.

Independent source tests also expose two deterministic frontend defects in
legal cast/shift expressions. The existing contextual conversion consumer now
keeps an explicit cast as its inner operand, and the shift consumer selects
width/signedness from the shifted operand, not its unsigned count. No source
workaround, diagnostic waiver or old expectation is introduced. The independent
author preserves all three failing legal forms and adds a separate 12-case
native oracle before these corrections. Its original RED logs remain intact.

| Verification                                            | Result / retained log in the existing Git-metadata evidence root                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| New guard/fallback/cast specifications                  | 168/168 PASS, including 12 sequential VICE cases; `guard-cast-directed.log`                                |
| Existing semantic implementations                       | 76/76 PASS; `guard-proof-internal-final.log`                                                               |
| New guard internals                                     | 12/12 PASS; `guard-proof-internal-new.log`                                                                 |
| Existing frontend scalar specifications/implementations | 66/66 PASS; `guard-cast-frontend.log`                                                                      |
| Ten complete input-behavior files                       | 68/68 PASS, including all eight exact AR-P20 timer cases; `guard-cast-phase2-behavior.log`                 |
| Foundation, import boundary and bundled source          | 50/50 PASS; `guard-cast-boundary-final.log`                                                                |
| Build / final typecheck                                 | PASS; `guard-cast-build.log`, `guard-cast-typecheck-final.log`                                             |
| Complete compiler suite                                 | 1,961 PASS, two existing unrelated SKIP, one protected profile-count FAIL; `guard-cast-compiler-suite.log` |
| Complete cold-state purity / output                     | Four / twelve RED; `guard-proof-purity.log`, `guard-proof-output.log`                                      |

The independent author reads no forbidden implementation files and changes no
old specification. Guard/fallback SHA-256 values remain respectively
`81797816f903668aa92083a971092d9b582c84cdf47f4fbada5c3bce7b8571cf`
and `7b365a434536a557cf2a2ed7b4edd9673713f681e7140832d8469bef36bbe8c8`.
The initial draft's compile-time-known OOB assignment was corrected before the
final RED baseline, because the frozen array rule requires rejection; its
stale-bound expectation was not weakened. An initial mistyped directed command
selected the semantic files only; the separate 66-case frontend run supplies
the actual frontend result. One original semantic host-work cap initially fails;
the helper's straight-line early return fixes it without changing that cap.

Three independent initial unit reviews (correctness, semantics/DX and SFA/ABI)
report no findings against `904511e9238604419303e4e20df84d2305156bef`.
They are not the full Phase 2 review or a third AR-P18 review. Their endpoint is
static producer/consumer inspection plus supplied logs, not independent native
runs. Two routing historical-summary exposures and one release-summary exposure
are reported and excluded from decisive evidence; no blind expert qualification
is claimed. Expert 2.0.4/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`
and the frozen Specification 4 identity remain unchanged.

The actual unchanged purity source now has only two unproved indexed accesses:
`answers[64 + control]` and `answers[69 + control]`, under `control < 5`, in a
74-byte array. `guard-footprint-probe.log` records their actual semantic identities.
Addition is not part of AR-P19's comparison/shift/conversion-only mechanism.
AR-P21 proposes one unsigned exact-literal, no-wrap transfer in the same helper;
it is not implemented before its named authority gate.

The old `frontend/profile.spec.test.ts:351` expects twelve calls in its Game
fixture. A public read-only analysis confirms those same twelve source-owned
calls plus six new cold library calls, eighteen total. AR-P22 proposes selecting
only the existing `src/game.blend` caller identity and keeping twelve; no old
test is edited yet. Neither current approval covers that exact exception.

The ordinary-source library, twelve complete expert-output budgets, four-profile
saved-simple 100-million-cycle limit and all other old/frozen oracles remain
unchanged. Progress stays 38/48; RD-05/DEF-7 and T-10/T-13/T-15/T-17 stay open.
No partial RED checkpoint is committed or pushed. Runtime evidence is
VICE-verified / hardware-unverified at its stated endpoints only.

Verify: the new directed command, existing bundled-input/library, source
reachability, joystick and NMI suites; build first. ST-23 parity is mandatory,
not deferred to RD-08. Each pure classifier task gets its directed cases as soon
as declarations resolve; complete scan/runtime tasks remain pending until run.
No new compiler intrinsic, profile inventory or bundled loader change.

Task 2.2.1 runtime discovery: the fresh inventory predicate combines installed
source and profile-provided exports, although AR-P6 names only the fifteen
installed-source exports and preserves the seven profile operations. Four
public frontend overlay probes pass the partial declarations' size/offset/key
count and separately identify twelve source bindings plus seven profile
bindings. This proves the observer mismatch; it is not a new compiler defect,
product restriction or permission to change a protected test. The exact
one-condition correction is proposed as [AR-P14](00-ambiguity-register.md#ar-p14--fresh-installed-source-inventory-counts-a-separate-producer).
Independent challenge agrees; all raw oracle hashes still match, no test edit
is made. Continue only after exact user authority; re-record changed oracle
identity and expected RED before completing the ordinary source module. The
partial declarations are uncommitted and nothing is pushed.

AR-P14 resumes: the user approves the exact one-condition correction at
17:25 CEST. `phase2-ar14-all-fifteen-red.log` records all 88 cases still failing
for the three absent functions, zero skips, 14.31 seconds. Formatting passes.
Read-only reconstruction of the original filter matches the original raw hash;
all other twenty-seven frozen inputs match unchanged. The corrected manifest
`phase2-ar14-oracle-sha256.txt` has SHA-256
`a44fa115215323d5169e216b45521682d8fb01696fca9ed683407a795f397422`.
No expected name, behavior, cost or source fixture changes. Exact-fix review
remains part of the independent phase review.

Task 2.2.2 uses the population-count requirement only through its required
predicates: groundability needs a nonempty eligible set and classification needs
exactly one eligible endpoint. A bounded exact-one-bit predicate on separate
ports avoids computing an unused full count, without merging distinct endpoints
or changing any answer. The compatibility loop has eight columns and at most
28 unordered pairs, reads rows in place and adds no graph/table/cache/runtime.

Session 2.2 runtime discovery at 17:38 CEST: the first six saved-query files
build successfully through their exercised public artifact lookups, then four
files record sixteen failures for incomplete function identities before VICE.
`phase2-pure-first-runtime.log` ends with exit 143 and no suite summary;
termination cause is Unknown and the other two files have no counted result.
The unchanged `SavedComponents` caller/library source, built through public
`buildProject`, publishes `src/library.blend::SavedComponents.query/completed`.
The new tests ask for `SavedComponents.query/completed`. A bounded inventory
finds twenty-eight analogous literal sites across eleven fresh runtime files
and three related saved-only selectors that use incompatible identity domains.
[AR-P15](00-ambiguity-register.md#ar-p15--fresh-runtime-observers-omit-source-qualified-debug-identity)
requests one exact observer-only correction; no source, expected behavior,
output bound, shared fixture, compiler schema or old test changes. All
twenty-eight AR-P14-corrected oracle hashes still match. No runtime or parity
result is claimed; tasks 2.2.1–2.2.4 remain implemented but unverified, acquisition
and callback are not implemented, and Session 2.2 pauses at the protected-oracle
gate. Progress remains 36/48; no broken checkpoint is committed or pushed.

AR-P15 resumes on explicit “I approve” at 18:20 CEST: apply only its exact
twenty-eight lookup literals and three saved-only identity selectors across
eleven fresh runtime files. Record the corrected raw oracle manifest and verify
read-only reconstruction against every prior identity before directed runtime
checks. No old test, shared fixture, input case, expected behavior or cost bound
is changed. Task 2.2.8's authority blocker clears; source qualification remains
pending and no task is promoted by approval alone.

AR-P15 applied at 18:21 CEST. Read-only reversal of only its approved observers
reconstructs all twenty-eight preceding raw oracle hashes exactly: eleven
changed files, twenty-eight lookup literals, three purity-selector sites;
all other tests and thirteen assembly/source assets remain unchanged. Targeted
formatting corrects only the long absent-function assertion's line wrap.
`phase2-ar15-oracle-sha256.txt` has SHA-256
`d78457e484efa1578b3f285a19e9dcdf189b9c4fe897125d07c1b2fbea1d54a1`.
The first six-file sequential saved runtime run is in progress; acceptance and
final independent exact-fix review remain due. No source/compiler/shared-harness
change accompanies the observer correction.

Tasks 2.2.5/2.2.6 add only the planned ordinary-source acquisition and callback
at 18:33–18:34 CEST. Saved-query bodies and all test/assembly fixtures stay
unchanged. The six-file directed runtime run began before these additions;
its early generations are partial-source evidence only. Final qualification
must freshly build/run the complete candidate with one recorded source identity.
No partial-source result will be treated as full-library qualification. The
unused prior-run `/tmp/blend65-profile-build-WsHmBL` directory, independently
identified as the old SavedIncompatible fixture with no active owner, is moved
to Trash before this task; it is recoverable. Active test directories and all
ten retained CIA2/NMI evidence directories are untouched.

`phase2-data-and-old-inventory.log`: 26 PASS / 4 FAIL / zero skips, 11.38 seconds.
All fourteen existing bundled-input cases pass and task 2.2.7's exact expectation
reversal matches HEAD byte-for-byte. Twelve of sixteen fresh data cases pass;
four function-signature cases fail because they read a source function binding's
return type as if it were the complete callable signature. No observer edit is
applied; a separate exact gate is due. The public complete-source frontend probe
passes on all four profiles with fifteen exports; this is not runtime/storage
qualification. Candidate source SHA-256 is
`d5c3129c80fea3cdc13e08edc22b53241b10f4a86cde9ef4524306baa23e29c7`.

`phase2-first-complete-output.log`: all twelve static output cases fail, zero
skips, 32.09 seconds. Every actual build/assembly succeeds. All four profiles
produce 3,441 packaged payload bytes versus the unchanged complete912-byte
expert bound, and 3,025 versus the unchanged saved-only683-byte bound. Remaining
resource/path assertions lie after those failures and are not claimed as passed.
No budget, fixture, compiler consumer or source workaround is changed. Actual
residual waste needs the plan's normal output/scope assessment; RD-08 is not a
waiver. Full acquisition runtime and native NMI proof remain pending. The ongoing
six-file saved runtime run stays supporting partial-source evidence only.

The six-file run finishes with **22 PASS / 2 FAIL / zero skips**, 1,056.46
seconds. Five behavior files pass all twenty cases; purity's two early PAL cases
use the partial pre-acquisition source and are not complete-library acceptance.
The later two NTSC purity cases fail at the retained scanner byte before VICE.
A fresh complete-source purity rerun records **0 PASS / 4 FAIL / zero skips**,
11.66 seconds, confirming the same allocation failure on every profile before
VICE. No guard is weakened; full complete-source runtime requalification is due.

Bounded diagnostic probes retain exact copies of both independent output callers
outside the worktree in the existing raw-evidence root. Public builds reproduce
3,025/3,441 bytes, with exact source hashes recorded and no production edit.
The data-signature observer and a separate complete-output standard-resource
field mismatch form [AR-P16](00-ambiguity-register.md#ar-p16--fresh-signature-and-resource-checks-read-the-wrong-public-fields).
No protected edit has been applied. Additional output/private-state mechanisms
remain [AR-P17](00-ambiguity-register.md#ar-p17--residual-output-must-be-assessed-before-additional-machinery),
with required independent output/platform equivalence lenses running read-only
before proposing any bounded support scope. The four existing acquisition
concern files are exercised sequentially, with results recorded below.
Task 2.2.7 remains the only newly verified source-execution task: **37/48**.
No RED checkpoint is committed and nothing is pushed.

`phase2-first-acquisition-runtime.log` records **20 PASS / 12 FAIL / zero
skips**, 54.02 seconds: normal8, unavailable8 and chained predecessor4 pass.
Timer8 fails before acquisition at the fixture's stopped-B `$FFFF` assumption
(actual `$FFFD`), with exact setup cause still Unknown; exclusive predecessor4
fails public check at E10245 because its consuming-read-to-global witness still
needs invocation-private storage. The latter matches existing RD-08/#100 debt,
not an approved fixture workaround or permanent language restriction. Preserve
all counter, consuming-read, ownership and no-private-storage expectations.
AR-P17 records these additional qualification limits; no task is promoted by
partial coverage. Native physical matrix/RESTORE and complete-source
requalification remain pending.

Independent output/platform assessment finds the whole expert startup comparison
not equivalent: it omits the explicitly approved fixed-bank-0 DDRA duty and uses
`JSR main`/main `RTS`, contrary to frozen Chapter 10 fall-through. Retain every
existing byte/path/stack expectation unchanged until an exact oracle-correction
scope is approved. No compiler remedy may be justified by that invalid complete
comparison. Real residual body/storage/layout defects remain subject to direct
equal-contract proof, not an RD-08 waiver or source workaround. AR-P16 additionally
names the fresh output test's one mistaken CPU sidecar-ID literal; the normative
profile identity and actual NMOS instruction contract remain unchanged.

Both required bounded lenses have completed. Output MC-001–MC-005 and platform
TP-001 survive at their inspected boundaries; detailed disposition is retained
under AR-P17. Local address/predicate waste, unused return-copy pointer setup and
matching-low padding are concrete existing-consumer opportunities, not a proved
complete remedy. No copy-elision proof, new compiler support approval or valid
replacement whole budget is inferred. Actual resource inventories are retained;
all future final runtime/physical and six-lens phase obligations remain due.

AR-P16 approved resume, 19:19 CEST: only the two named observer tests change.
The exact independent correction review reports no findings; all twenty-eight
raw inputs match the new manifest
`bc39b97d2dbd11a925e31ca1a7c7f11e4945f733efe38cfc04b1f10b273068b7`,
and the retained predecessor blobs plus twenty-six unchanged files reconstruct
AR-P15. Fresh build and typecheck pass. The directed log `phase2-ar16-directed.log` records
sixteen declaration/signature passes and four complete-output failures at the
unchanged first payload assertion (3,441 versus 912), zero skips, 17.71 seconds.
Task 2.2.1 is verified, **38/48**. Output resource/path checks are not reached;
AR-P17 and remaining source/runtime/storage/cost qualification stay open.
Formatting, documentation/scope, whitespace and frozen guards pass. No incomplete
library checkpoint is committed; no push. The final six-lens review remains due.

AR-P17 normal-return follow-up: platform TP-002 identifies the expert helper's
borrowed `$10` as BASIC `SUBFLG`. One preserved saved-input witness reaches an
early incompatible exit and leaves it one; the next BASIC `A%=1` is predicted
to fail. This is static, not executed; generated full/saved ZP ends at `$0D`/
`$0F`, so no generated `$10` failure is claimed. Stock SYS supports changed
outgoing A/X/Y, but their exact Blend65 boundary ownership and that of the
documented `$03–$06` vectors must be explicit. The required independent
semantics/DX assessment is bounded to that contract. No blanket ZP copy,
startup framework, source restriction, oracle edit or replacement budget is
authorized. Details, primary pin, counterexample and exposure exclusions are
retained under AR-P17. Progress remains **38/48**, RD-05/DEF-7 open.

The independent semantics/DX follow-up converges on safe normal RTS return,
with outgoing A/X/Y unpromised and exact restoration of borrowed `$03–$06`
documented vectors requiring a narrow explicit user ruling. SM-001 duplicates
TP-002's now-closed static same-line `SYS 2061:A%=1` witness; no VICE execution
is claimed. AR-P17 now records one exact ten-file baseline-only correction
proposal: approved bank-mode duty, fall-through main, proved `$07` scratch
overlay instead of live `$10`, and complete-artifact-derived observers after
qualification. Every ordinary source/behavior fixture and all further compiler
mechanisms stay unchanged/unapproved. The execution-plan protected-oracle gate
requires the user's exact decision before those edits. Scope is not a budget
waiver, and no task is promoted. All required agents have finished; no tests or
emulators remain running. Plan/index/roadmap are synchronized at **38/48**;
the portfolio's numeric cascade remains deferred to integration.

AR-P17 approved resume, 20:03 CEST: the user's exact “I approve” authorizes the
normal-return rule and ten-file protected-baseline correction, not production
compiler/library changes. Within 2.2.8, bounded substeps are scratch lifetime
proof, entry/restore and complete placement, then native qualification and
derived observers. Every ordinary source and behavior fixture remains frozen.
Current baseline inputs match AR-P16's 28-file raw manifest; no partial commit
or push. Counts remain 38/48; residual output/retention and runtime gates remain.

AR-P17 bounded correction, 20:16 CEST: independent static proof confirms the
exact three `$10` column-mask operands can use dead caller `$07`; no predicate
or opcode-form change. Root applies the approved entry/inline-restore and
whole layout. ACME 0.97 strict documented-6502 assembly passes for all three:
fast963/small877/saved736 payload, general suffix21/21/20, physical ZP14,
generated stack5 and scoped one-NMI component10; CPU paths await independent
rederivation. Both acquisition bodies, callback, sole-source helper and ordinary
sources remain byte-identical. `ar17-native-return-2.log` records 12/12 genuine
SYS/BASIC returns across the three artifacts and four profiles, followed by
successful ordinary keyboard-command `A%=1`. P/SP, port, borrowed vectors,
`$10`, DDRA and zero program PRA accesses pass; low latent bank bits are
observed separately after return, not confused with upper serial pin readback.
The first probe's incorrect full-PRA pin-equals-latch assertion is retained
in its failing log and corrected only in the untracked diagnostic script;
it is not a product, baseline or protected-test failure. All sixteen low
PRA/DDRA configurations are now running sequentially. Source fixtures, library,
production compiler and numeric tests are unchanged during qualification.
No whole electrical-matrix, silicon, external-stack or phase-GREEN claim follows.

AR-P17 final bounded evidence, 20:28 CEST: final strict ACME assembly passes
all three and `cmp` confirms actual192-case-qualified instruction bytes unchanged
after the corrected29 nominal CPU annotations. Final28-file manifest is
`phase2-ar17-oracle-sha256.txt`, SHA-256
`637bbad08d5f70d517fb6eb755c43e3d4a45059546300481236d010f90401dc7`.
Independent storage/platform/correctness-oracle reviewers report no findings
for this exact seven-file correction. Output review verifies the artifact costs
but identifies MAJOR MC-001 repeated pointer marshalling8bytes/10cycles and
MC-002 unnecessarily expensive status peek3bytes/1cycle. They are not silently
changed under the narrower AR-P17 exception. [AR-P18](00-ambiguity-register.md#ar-p18--remove-two-proved-benchmark-redundancies)
names only those two tiny benchmark substitutions, complete cost rederivation
and the already named three numerical observers; approval remains required.
All fifteen spec files and six other fixtures remain byte-identical to AR-P16.
Production compiler/library and frozen sources stay unchanged this session.
Full expert-floor and compiler qualification remain pending, progress38/48.
No new runtime/API/framework, partial RED commit or push. All native processes
have completed; evidence is VICE-verified / hardware-unverified only at the
recorded return/bank endpoints. Portfolio sync remains deferred to integration.
Final guards pass: all28 current manifest entries, unchanged library SHA,
zero frozen/expert/production-source diff, whitespace, targeted Markdown
formatting and actual four-document local links. No full compiler test rerun
or phase-GREEN result is claimed for this assembly-only correction.

AR-P18 completion, 22:50 CEST: the user approves the exact preceding cleanup
packet through the RD-05 continuation instruction. Two instruction substitutions
and their derivative annotations/observers are applied, with every other source,
predicate and expectation intact. All three strict assemblies pass and final
commented assemblies match the native PRGs. Complete fast/small/saved payloads
are **963/877/725**, combined resident bytes **998/912/759**, physical ZP14 and
base stack5; full one-callback components peak10. There are **28**, not29,
nominal annotated paths; the preceding count was mistaken. The revised benchmark
passes all **192/192** sequential native return/bank cases. Output/platform/
correctness exact-fix reviews report no findings. Complete proof limits, hashes
and the 36-entry manifest (28 Phase2 plus eight unchanged Phase1 files) are in
[AR-P18](00-ambiguity-register.md#applied-qualification--2250-cest).

Fresh build passes; `ar18-output-directed.log` records twelve first-bound RED
cases, zero skips, 26.14 seconds: compiler full3,441/963, saved3,025/725.
`phase2-saved-simple-native.log` records four monitor-closure failures, zero
skips, 343.34 seconds; cause not yet established. No behavior assertion, shared
harness, compiler/library source or frozen authority changed this session.
The cleaned reference is qualified only at its recorded return/bank endpoints,
**VICE-verified / hardware-unverified**. Progress remains38/48, phase still RED;
no commit/push or premature phase/RD closeout. Portfolio sync waits integration.

Approved-family continuation, 23:05 CEST: the adjacent fixed-store selector now
accepts ordinary path-empty scalar `store`, whose existing consumer emits no
address setup. Sole-use/byte/adjacency/fallback guards remain; no NMI or storage
policy changes. Original predecessor specs pass8/8 (four exclusive formerly RED),
existing admission/storage/profile specs64/64 and directed compiler internals39/39,
including one new regression. Build/typecheck and targeted formatting pass.
Full output remains RED: full3,441/963, saved3,001/725; no task is promoted.

The source-identical diagnostic reaches952/1,089 saved-simple observations at
100million cycles, then childexit1/monitor closure; with only the launch bound
200million it reaches1,089. This is budget diagnosis, not complete behavior
qualification or permission to increase the actual specification/harness bound.
The timer source-identical comparison records48 observations: all24 LOAD-strobe
setups across four profiles/two I states/three timer modes establish exact stopped
FFFF, active NOP progress and preserved readable controls. No protected file was
edited by these probes. Evidence/hashes and limits are in
[the follow-up](00-ambiguity-register.md#approved-family-follow-up-and-diagnosis--2305-cest).

The independent challenger narrows the necessary footprint support to actual
unsigned reaching guard facts; no counted-loop recurrence or unrelated startup
mechanism. Its charter/tool restrictions prevented direct file reads; the verdict
uses root's verified packet, not independent code or runtime proof. New material
support [AR-P19](00-ambiguity-register.md#ar-p19--use-source-guards-in-the-existing-footprint-proof)
and the single protected timer setup argument/comment exception
[AR-P20](00-ambiguity-register.md#ar-p20--establish-the-timer-latch-with-the-normal-load-strobe)
are recorded for one clear user decision. Neither is implemented or silently
authorized by general continuation. Keep all other output/startup/oracle gates,
unknown pointer/MMIO fallbacks and independent final phase review intact.
Progress38/48; RD-05/DEF-7 and T-10/T-13/T-15/T-17 open; no RED commit/push.

#### Approved fixed-address family completion — 2026-10-11 02:18 CEST

The existing AR-P12 selector preserves fixed local storage but loses ordinary
global labels. This is completion of its explicitly named storage/label family,
not a new optimization family. Independent implementation-blind authoring adds
only `input-fixed-global-argument.spec.test.ts`, SHA-256
`212a9ac3075a05a79ba97594858ac94e06bd4c7c6c02ef79799368a0dbb99944`.
Its pre-correction run records eight cost failures and eight native behavior
passes, zero skips,12.54 seconds. Both global structs and fixed arrays on all
four profiles measure37 MAIN bytes/49 nominal cycles versus the independent
29/37 direct-address caller. Callee/startup/whole costs remain separately
reported, not waived by that local bound. The public parameter pointer aliases
the original source object; values9, unchanged[7,9], balanced JSR/RTS and normal
return pass. Raw log `input-fixed-global-argument-red.log`, SHA-256
`4f7be079f38901e14f970443f76977ab9dfde72af39d8ed8e647169e6f20800d`.
The author reads no forbidden implementation, prior oracle or retained report.

At02:18, the two existing producer owners share the original fixed-call selector
for both certified storage and global labels. Captured values and returned-local
pointers are handled first; sole-use, fixed/in-bounds/zero-offset, direct-call and
dynamic-parameter fallbacks remain. The existing call marshaller and ABI do not
change. Implementation is pending verification; task2.2.8 stays[~],38/48.
No distinct borrowed-field selector, startup eligibility expansion, solver,
source workaround, frozen/protected-oracle edit, RED commit or push is included.
The four exact AR-P24 in-memory exception reversals match their original hashes
again after the qualified size changes from5 to4.

Fixed-address qualification: build/typecheck, all32 new/unchanged caller
specifications and all2,013 compiler cases pass, with the same two unrelated
skips. The focused mutable closure extension passes13 cases after GREEN and
retains the prior load case while adding a global place-address producer.
Independent correctness and SFA/ABI reviews report no findings; the latter
checks shared global labels versus context-private storage specialization and
states the missing dedicated new-path interrupt runtime witness. Ordinary
caller37/49 becomes29/37; complete tiny payload716 becomes688, including20 fewer
startup snapshot bytes. This local floor is not a whole-input win.

`fixed-global-whole-output.log` still has12/12 first-bound failures,24.11 seconds:
full3,476/963 and saved3,072/725. The retained exact-source PAL full generation
is `input-output-probe.KPKGDU/out/94078a27-3eed-4569-adf5-8e31c577c6a4`, PRG
SHA-256 `c44cf63cbbe08480b540a0d9d8abddaf0bc9a5a60a04f576c1294edd27fb4450`.
Startup remains679 bytes/state56; compatibility728, sole-ground123, key799 and
joystick456 remain independent generated query owners. All later budget/path
assertions remain unqualified. No budget or source changes follow.

#### Known whole-global borrowing within the approved startup facts — 02:25 CEST

Independent read-only correctness assessment classifies this as existing AR-P23
identity/use consumption, not a new effect/interprocedural solver. A sole whole
global aggregate result consumed at a known ordinary aggregate parameter can
be distinguished from a scalar address escape using existing semantic operands.
Every reached callee/initializer/declared-handler check still applies. Unknown
aliases, captured/dynamic pointers, parameter/local source roots, offsets,
multiple/merge/terminator uses, assets, raw addresses and unproved footprints
retain full fallback. A known call alone never establishes display independence.

The independent blind author adds two concern-separated files before production:
`startup-whole-object-borrow.spec.test.ts`, SHA-256
`3cdfe553ac6b8b414fbae8a264067b9e1576477061452e8c0b801828769e4669`, and
`startup-whole-object-borrow-native.spec.test.ts`, SHA-256
`1e5fa4a2ec0bffb95dd2a8e425d8d744198363d9294ae29fda3bd4bd91c52a84`.
Static8 RED/16 fallback PASS and native8 PASS prove genuine excess startup, not
an ABI/value defect:619 bytes/840 nominal cycles/state50 versus independently
derived70/108/state5 for the actual one-byte BASIC borrow. Whole688, caller29
and callee28 are separate unbounded reports. Controls retain exact full state
and VIC save/default/restore for reached VIC reads, uncontained indices, scalar
address exposure and fixed high-RAM writes. Native values, original-object
identity, P/I/D/SP, mapping, DDRA, BASIC bytes and normal READY return pass.
Raw logs `startup-whole-object-borrow-static-red.log` and
`startup-whole-object-borrow-native-red.log` have respective SHA-256
`69f2e077b1191ca093dd92279e949de164921c58821800befa51a8f971cfdfc3` and
`5d061e4a2efe934414d6c7546a827733627e7004dd2e7e32e7bcef8c5547e355`.
No forbidden author reads or existing-oracle edits occur.

At02:25, the existing semantic operand enumerator is shared unchanged with
startup's one per-body use count, including merge operands and terminators.
Only a complete whole global whose sole use is a matching direct ordinary
aggregate call is admitted; all existing body/raw checks remain. This is two
existing consumers, with no new pass, proof model, runtime, ABI or API.
Implementation/qualification are pending;38/48 and task2.2.8[~] remain.
Full-input output remains RED and no protected/frozen edit, RED commit or push
is authorized by this bounded refinement.

Known-global startup qualification — 02:40 CEST: all136 directed cases pass,
zero skips,64.72 seconds. Complete compiler verification passes2,019 with the
same two unrelated skips,85.11 seconds. The three existing startup/banking/output
files pass76/76, zero skips,218.04 seconds; this includes the old72 native cases
and four output cases. Fresh typecheck and targeted source/test formatting pass.
Independent correctness and platform reviews report no findings for this bounded
refinement. Every old fallback and protected exception remains unchanged.

Evidence logs `startup-borrow-directed.log`, `startup-borrow-compiler.log` and
`startup-borrow-old-regressions.log` have respective SHA-256 identities
`ed93440e39f0601e6ca7d2ce7df9f7c61c3e308c617dc9bc854c0f1901374fa1`,
`59ec72c299bcad451feaf09be1b6558b07397c254c383e6e1f77fdf403fd8465` and
`7e11dc6115fc52337fe88362087126273e758b258a16524b5ff29e5dc34237dd`.
The retained ordinary Pair generation is
`borrow-field-probe.Ckg2Ir/out/fd04a7b1-d9af-45ec-a16f-59302f4d15d5`, PRG SHA-256
`f6d1c2c7e780054fed01fbdfd4db87d4dfc5daa75165bf9ea889562ffab6fb5b`:
complete payload139/resident151, caller29, callee28, startup70/108/state5 after
its actual `$03` BASIC borrow. A narrower field-access selector is not implemented
or authorized by this startup qualification.

Fresh post-refinement whole/saved output checks still fail8/8 at3,476/963 and
3,072/725, zero skips,16.05 seconds (`startup-borrow-whole-output.log`). Ordinary
input callers retain the full startup because raw RAM stores and parameter-root
forwarding are unproved by the approved existing facts. No whole-input parity,
phase completion, budget waiver, RED commit or push is claimed. Progress38/48;
RD-05/DEF-7 and T-10/T-13/T-15/T-17 remain open. Native evidence is only
VICE-verified / hardware-unverified at the recorded endpoints.

Fresh input-behavior regression — 02:46 CEST: all68 cases in the ten focused
behavior files pass, zero skips,171.62 seconds (`startup-borrow-input-behavior.log`,
SHA-256 `2d2fcbb96cba503e6abb63b90fbc6cc7f66f14e8f529739fb79607a252b821d0`).
Acquisition's separate complete-output file still fails4/4 at3,476/963, zero
skips,8.86 seconds (`startup-borrow-acquisition-output.log`, SHA-256
`070995c86654b4aeb7f025c96ef4c1c181b76ae8dd3f939e5fe2594ad00e727a`).
The preceding two-file whole/saved-output log SHA-256 is
`3203e8a7d57889fd0bc1f1d65bd63e9fdf01b9b3e905d5fa06cb8ae053e0210b`.
Together all12 complete-output cases remain RED. Saved-simple and final phase
qualification remain open, not silently replaced by the focused68 behavior cases.

Read-only guards pass: all four exact AR-P24 in-memory reversals, unchanged
qualified AR-P20 timer SHA,35/36 unchanged AR-P18 manifest paths (the timer is
the sole approved exception), three new spec hashes and unchanged input source.
Forced four-document formatting,179 existing local links, whitespace and empty
frozen-spec/expert guards pass. Checklist remains exactly38 verified of48 tasks;
six source/output tasks remain implemented/unverified and four closeout tasks
remain not started. Portfolio numerical synchronization still waits integration.
No production/test change or new support follows from the residual assessment.

Residual output scope gate — 02:58 CEST: the independent output assessment
reports four MAJOR existing-consumer gaps and one MINOR unused copy setup,
recorded with actual artifact identities and conditional local costs in
[AR-P25](00-ambiguity-register.md#ar-p25--finish-the-measured-missing-output-consumers).
The current complete reference is fast963/small877/saved725, not the older
similarly named evidence files. Ordinary Pair's28-byte/45-cycle callee confirms
the field defect independently of input-library source. Actual query bodies
alone total2,106 bytes; startup or field selection alone cannot close parity.

The required independent design challenger returns **Simplify**: retain four
existing seams in one batch but replace broad expression completion with an
explicit byte complement/bitwise whitelist. Root accepts that narrower proposal.
The challenger used directly verified supplied excerpts because its permitted
filesystem readers were unavailable; it performed no code/artifact/native
qualification. Each selection requires its own independent behavior and
assembly/cost tests before implementation. Current facts or generic fallback
remain mandatory; no new solver, pass, runtime/API or budget waiver is proposed.

No AR-P25 production/specification implementation has occurred. The latest user
approval covers AR-P23/AR-P24 only. Tasks2.2.2–2.2.6 and2.2.8 are marked[!]
with the exact new scope blocker, preserving original implementation timestamps.
Checklist remains38/48: six source/output tasks blocked, four closeout tasks
not started. Feature RD-05 stays Executing4/10 because this is one unfinished
slice; portfolio numerical synchronization remains at integration. No RED
commit or push. The plan/index/register and live roadmap record the gate before
presenting the one narrowed batch for the user's direct decision.

Gate-bookkeeping validation passes: all182 local Markdown path links in the
four touched documents resolve; checklist48 contains38 verified, six explicitly
blocked and four pending tasks. AR-P25 has one section and a pending direct
decision. Five qualified source/specification hashes, all four exact AR-P24
exceptions, formatting, whitespace and unchanged frozen authorities pass.
This documentation validation does not replace the recorded RED output/native
qualification. Execution Plan Updated: ✅.

AR-P25 direct approval and continuation — 2026-10-11 09:07 CEST: after the sole
pending narrowed packet and its plain-language explanation, the user expressly
approves compiler improvements “like you describe above” and directs progress
without routine interruptions. The exact four-consumer batch and conditional
MC-005 removal are executable, with all original fallback/behavior/output and
protected-oracle limits unchanged. This is not activation of `--auto-design`,
approval of new unnamed support machinery or permission to waive tests.
The six affected tasks resume[~]; progress remains38/48. Root starts adjacent
byte complement/bitwise delivery, then branch-only control, proved index-bound
handoff, eligible constant fields and the conditional unused copy setup. Each
bounded unit follows independent specifications RED, inline implementation,
GREEN tests and relevant independent review. Existing confirmed xhigh applies.
No RED commit or automatic push; ordinary safe corrections within the approved
families are resolved without further trivial prompts.

First residual unit baseline: `17fd5bf4be0ac9c40ae0e9083ba845ba7f4a42f1`,
snapshotted with the provided worktree script before implementation. This is a
bounded unit-review baseline; the Phase2 baseline remains unchanged. Expected
byte-unit changes: two new source-library-byte-delivery output/native specs,
the existing register-forwarding owner and its implementation tests, plus owned
plan/roadmap bookkeeping. No protected specification changes are authorized.

Specification independence: the first dispatched byte author accidentally saw
prior review/production snippets through the collaboration inventory tool before
writing any file. It stopped with no files/tests, and its context is excluded
from decisive authorship. A fresh implementation-blind author owns the two new
specifications and is forbidden from the inventory/reviewer conversations.
Root remains sole VICE owner; the author may run only directed static RED.
This disclosed restart adds no test harness, oracle change or implementation scope.

Byte-consumer independent RED — 09:18 CEST: the fresh blind author adds only
`source-library-byte-delivery-output.spec.test.ts` (SHA-256
`51bd4f760ba3d18b662e725ae010f9f11d6b41ec5b516a2f5bf5081e09bc1514`)
and `source-library-byte-delivery-native.spec.test.ts` (SHA-256
`ce1709c9ddbf5e1a4bd3a11ca8fee175f4f93d6d3e85aa2b658b25eee0c3ebaf`).
All148 static cases fail at complete leaf cost/staging after successful public
builds, zero skips,15.57 seconds. The RED log is `ar25-byte-output-red.log`,
SHA-256 `343da2eac91c28e000523502e393a4825734f1ec84123a691d1b10c70c57cb47`.
Eight numeric/effect native cases awaited root-owned sequential VICE execution.
No production code changed before these RED tests. Implementation now selects
only the named adjacent sole-use byte consumers in the existing forwarding owner;
no helper/pass/IR or general arithmetic forwarding is added. Task2.2.8 stays[~]
and complete input output remains unqualified.

Byte consumer locally GREEN — 09:20 CEST: fresh root build and all156 new
specifications pass (148 complete-cost/static and eight sequential native),
zero skips,27.11 seconds. `ar25-byte-green.log` SHA-256 is
`db0ee9de8c296ad1339f39a2a4c39e3665627c1ff4cadcb168c18c36869dc761`.
The fixed absolute complement/store meets9 bytes/16 nominal cycles; three
immediate operations meet13/20; parameter complement returns fit6/12 or the
cheaper ZP form. These are complete leaf floors, not whole-input parity.
New private selector coverage is isolated in
`machine/lower-byte-delivery.impl.test.ts` rather than growing the existing
291-line test concern. No existing test is edited by this unit. Fresh typecheck
passes; bounded correctness/storage/output review and full-input remeasurement
remain due. The initially misrouted internal command selected no files under
the root test config; its workspace rerun supplies the actual internal result,
not a false pass. Task2.2.8 stays[~], progress38/48.

The same still-blind author now owns two new branch-only specifications, with
only approved condition semantics, CPU-derived complete costs and existing
public fixture conventions. No implementation or generated artifacts are
provided. Root remains the sole VICE owner.

Byte-unit regression and review — 09:28 CEST: the complete compiler workspace
passes2,027 tests across138 files, with the same two unrelated skips,87.00 seconds
(`ar25-byte-compiler.log`, SHA-256
`aa942e7a6fb3750cf8aa25ddf14937b8d3bf5dd1c9e79b4f67ab914537b62e37`).
All40 directed internals pass; their workspace log SHA-256 is
`77eae653e02ed59ed546b83330491a107a811e5e04bc78cbf564334242129646`.
Independent base correctness and SFA/ABI report no findings. The base reviewer
discloses over-broad release-record access; no evaluator-derived or skill
qualification check is decisive. Its bounded actual-code/oracle-integrity review
is separate from SFA/output inspection. Root's own later release read also
overran the identity rows; no expert-qualification conclusion is drawn from it.
Subsequent lineage reads are limited to the five metadata rows.
The output auditor independently inspects three exact-source retained PAL
artifacts in `ar25-byte-artifacts.JbY4f1`; its disposition remains pending.

Complete input remeasurement is still RED12/12: full3,220/963 and saved2,922/725,
saving256/150 payload bytes from the pre-unit3,476/3,072. No bound changed.
`ar25-byte-input-output.log` SHA-256 is
`49afe9329be163edc6d37afa4c864f2f866e0839d4af6f101a2af9156f0c9b76`.
Task2.2.8 and the six source/output tasks remain unverified,38/48 overall;
no RED commit or push.

Branch-consumer independent RED — 09:28 CEST: two new blind-authored tests have
original SHA-256 output
`79f21cb7a255ab4beb2eb0dddd99716c41cd7fa189f0d449907b8562003b4694`
and native
`137072e605aaf12ce24fc3ddd13df4cf87091052e3709e84c2621a85b2eba9c1`.
All64 static cases fail at complete bytes/private homes after successful public
builds, zero skips,8.95 seconds. `ar25-branch-output-red.log` SHA-256 is
`11713efe98bc501c0b4a0e5b097052faa94b2f745fc30e6f301c9338530bde1a`.
Sixteen native cases await root sequential execution. Byte changes are already
in the baseline used for this RED; the bounded branch review compares only
semantic control/CFG and any necessary existing layout change against the
unchanged corresponding files in unit snapshot17fd5bf4. No branch implementation
preceded RED. Root now emits direct condition edges in existing control owners;
escaping/stored Boolean construction stays unchanged. No new representation/pass.

Branch implementation pending — 09:36 CEST: condition-only `&&`/`||` now use
existing semantic branch edges in `lower-control.ts`/`cfg.ts`; value lowering is
unchanged. The first directed run passes36 and fails44 of80 cases: ordinary
loop behavior passes; seven leaf layouts have one redundant3-byte forward JMP,
and generated fallthrough bridges expose the existing debug-owner classifier's
missing bridge suffix. The original64 RED and all new test hashes remain intact.
Root fixes these existing consumers: unconditional forward layout edges follow
their sole target without a JMP, while back/already-placed targets keep it;
debug projection recognizes the layout's existing `.fallthrough.` owner suffix.
This adds no representation, pass, schema or harness. Rebuild and all80 tests
are due before any GREEN claim. Task2.2.8 stays[~],38/48.

Branch follow-up — 09:43 CEST: the existing layout/debug corrections pass72/80,
including all16 sequential native cases. Eight static cases remain RED:
right-nested AND retains one3-byte bridge (24/21); AND inside OR takes29/28
worst-path cycles. Root requests bounded independent output diagnosis of these
exact layouts; original oracles and budgets remain unchanged.

Necessary byte-chain correction — AR-P26: independent output review finds
13/20 is not the true expert floor; a complete equivalent AND/EOR leaf is11/18.
The minimum-design challenger independently inspects the existing append owner
and recommends Simplify, no material support machinery. It identifies the
net-length emission-site hazard, which must be fixed at that owner as well.
This ordinary necessary correction uses the user's standing compiler-improvement
approval and prime directive4, not an invented auto-design mode. No broader
algebra/pass/state/framework or protected-oracle edit is authorized.

The challenger accidentally reads the complete release record while orienting;
this disclosure is excluded from expert qualification evidence. Its decisive
minimum-design assessment uses actual compiler seams and normative CPU/IL
references, not evaluator answers. No skill or skill-qualification claim follows.

The unchanged implementation-blind author adds only two new byte-chain specs:
output SHA-256 `4d86b965248314a8bc77b2ebba4e6be8b3d7f99a232c954fb1d651ac5131cabd`,
native `ca072ad391601b1fd958af25fffa4c8f5210fb06f326bf498a4323c49987b367`.
All24 static cases fail complete costs after successful builds, zero skips,
4.86 seconds, before any composition implementation. RED log
`ar26-byte-chain-output-red.log` SHA-256
`3ef3a530044f4c6a0b6e49338a6469974139a0ec0adca7d39e46aebe68e4c430`.
Eight native cases remain unrun. Original delivery tests are not edited.
Root now implements only the bounded three-instruction append correction and
actual emission inventory, then runs both independent oracles. Task2.2.8 stays[~].

Byte-chain and branch units locally GREEN — 09:54 CEST: all188 byte-chain and
unchanged byte-delivery cases pass, including exhaustive256-byte four-profile
runtime and ordered effects,42.61 seconds. Log SHA-256
`59825a77ea8700e6812305460f9d4a665f6ae9db75f755418241043c2cb72325`.
All80 branch-only cases pass (64 static/16 sequential native) after existing
layout's one-hop shared-continuation order correction. The same combined run
still fails12 whole-input budgets: full2,964/963 and saved2,568/725,
43.65 seconds; SHA-256
`35cdaf1b12250d933e7a58025ceb20133fce61111dc4ce5996f69574960972f2`.
Combined savings from pre-batch are512/504 payload bytes, not a parity waiver.

Private byte35/35 and branch45/45 pass. Their log SHA-256 identities respectively
are `c0d991d369fafe97942b72e863a255fdfbdf1a20db159c6da9b59723d6f3f1a1`
and `db407e3815309134e1cc25f1f199be58dbe2b620222b69eff6feaa34b81a475b`.
One new private assertion initially counted a retained unreachable CFG arm;
the corrected implementation-tier assertion checks existing reachableBlocks.
Existing private layout expectations now charge the retained explicit NOP/RTS
and necessary backward JMP, not removed ordinary forward jumps. No protected
specification or original new-oracle byte changes occur.

Independent correctness/oracle integrity and SFA/ABI report no findings for
these two bounded units. Conservatively retained erased pure-operation sites
cannot hide a status/stack/vector transition; final selected emission is recorded
even without net list growth. Final emitted-output artifact inspection is pending.
Complete compiler workspace regression passes2,042 tests/139 files, with the
same two unrelated skips,82.70 seconds (`ar25-26-compiler.log`). This is not full
phase/root verification. Task2.2.8 remains[~],38/48; no RED commit or push.

The still-blind author now owns only two new proved-ordinal specs under the
approved existing-facts handoff. Root has not changed its production consumer.
No source word narrowing, recurrence, range/provenance solver or new pass follows.

Final bounded emitted-output review is clear. Actual assembled store/parameter
chains are11/18 and8/14; both nested branch witnesses are21 bytes/27 worst-path
nominal cycles with same-page branches and no bridge. All effects/ABI/flags and
surviving debug spans agree; no frame/ZP/scratch/helper growth. Store artifact
payload/resident is645/696, parameter651/703 and each branch658/708. The store's
total653→645 saving separates two composition bytes from six main-layout bytes.
Fresh PRG identities respectively are
`ec10be25767c20cab39db0785a39430e798dcae0d5ebadfcfc193b22019ff3c2`,
`d68cf2f09a6491b3a74afcddb8d2fc700d5d5c317b3a9efafad1af58f721cd08`,
`a3c16aa4fdb1fe754125329c640c842f9f7acccfea92df8769ed4eb73e5c269b`
and `69a33821db1d1381aae3af1a2f40572932c630c265de211165b9a0aa4ec20fbd`.
Retained evidence paths are `ar25-byte-artifacts.JbY4f1/chain` and
`ar25-branch-review.q4LkEl/{parameter-return-chain,right-nested-and,and-inside-or}`.
Local byte-review MC-001 and branch-review MC-002 are closed at this bounded
endpoint, not the similarly numbered original four-consumer assessment or full
input budget. Runtime status stays VICE-verified/hardware-unverified.

Ordinal/copy sequencing — 10:09 CEST: targeted touched-file formatting passes;
fresh typecheck and compiler2,042/two existing skips are locally GREEN. The
ordinal author has begun only the two new independent specifications; no
ordinal production change precedes its directed RED.

The separate copy author accidentally reads expert release summaries while
checking identity. It is stopped before writing any file or running a test and
excluded from decisive oracle authorship. A fresh implementation-blind author
must receive the verified identity directly and may not open the release record.
No evaluator material is used as a specification or qualification expectation.

The replacement copy author reads only normative authority and public test
infrastructure. Its extra read of `analyzeProfileSource` is expressly classified
as permitted public harness inspection, not compiler/evaluator exposure; the
otherwise unchanged implementation-blind boundary remains. It has not authored
an oracle from implementation evidence. Inspection snapshot
`79b65002d0ee120921dc802e7d6f2b37d5904cc1` preserves tracked production before the
ordinal/copy consumers. It is not a green checkpoint and does not replace the
actual Phase2 baseline04d97bcc or prior unit snapshot17fd5bf4.

Existing ordinal consumer RED/first selection — 10:21 CEST: new output/native
hashes are `1c60783b5d46eda01ebb81deb2831898035c2405a911443485ac912ba3025ffb`
and `303672c424951997b9e68c9b4b846f5f5fe89e6eb2599669f7b5c604f1f205d3`.
All32 static cases fail after successful builds before consumer implementation;
zero skips, RED log SHA-256
`541faae74b6178d52b3478514fa53d09efc5c7fd4c78520efcdba4a9d805ea76`.
Native72 are authored first and unrun. The existing proof adapter now hands
use-site bounds to the stride-one selector; source word homes/updates stay words,
full carry and Y-zero remain. Globals, exposed roots, unknown raw/indexed writes,
calls and partial joins retain conservative reload handling. First static32
remain RED on complete comparison/layout/mask/offset costs, not missing basic
address narrowing. Independent bounded output diagnosis is in progress.

Conditional unused-copy setup RED: the replacement blind author creates two
new files with original output/native hashes
`03bd11ca4cef301bec34278b645861fbef3a91af569d61854305594a8a13f077`
and `5940043ef3c24c16ddb1c53241da6d777e77e09f7eb6d028f9b90ba4db44cf3f`.
Eight meaningful static RED cases follow eight successful builds, zero skips,
with actual21/204 versus unchanged13/194 setup-removal ceilings. Earlier public
range-boundary debugging attempts are preserved separately and are not claimed
as meaningful RED. Complete function decode/home provenance and accounting
charge every source-pointer setup plus ordinary copy/RTS. Native8 are authored
and unrun. This ceiling is not universal expert parity: a separately proved RAM
reverse copy can be cheaper. Root reuses the existing fixed-object identity
consumer for a sole adjacent terminal whole-local return, leaving the copy,
hidden destination and alias/borrowed/path fallbacks unchanged. Qualification
remains due, task2.2.8[~],38/48; no RED checkpoint or push.

Ordinal behavior / conditional copy locally GREEN — 10:28 CEST: all88 combined
cases pass:72 ordinal native,8 copy static and8 copy sequential native,113.29
seconds. Log `ar25-ordinal-copy-native-first.log` SHA-256
`507f246823898ccaa66139de85fca73de33782043130a10758cc306a014a378c`.
Copy private22/22 pass (new closed-storage5, existing aggregate4/call13),1.91
seconds. The initial root-level private command matched no tests and is not
claimed as a pass; the correct compiler-workspace run supplies this evidence.
Independent correctness review and actual copy artifact review are pending;
ordinal complete output32 and whole-input costs remain RED.

Fresh diagnostic PAL artifacts in `ar25-ordinal-artifacts` use exact upper/lower/
offset/join/mask source witnesses. Separate complete fixed-return artifact is
`ar25-fixed-return-artifacts/out/b70716ce-67a7-4015-a382-25adb123049f`.
The independent output diagnosis identifies remaining comparison/mask/adjacent
offset/layout waste; the minimum-design challenger assesses whether corrections
fit existing facts/owners without any new support machinery. This is not a
general arithmetic completion, source word-counter narrowing, range/provenance
solver, tail-merging framework or expert-parity waiver.

### Session 2.3 — internal checks, native qualification and closeout

Ordinal/copy bounded qualification — 10:56 CEST: all32 unchanged ordinal output
cases now pass, log SHA-256
`27eddb12313ba50da63e3748ae9ed3f7f34758d3b84e422a578104a65cfbaed7`.
All356 byte188/branch80/ordinal-native72/copy16 regression cases pass,184.47s,
SHA-256 `cd002b1c920fa38e18aee7a0bcca06df01a39a62e6960222762e10be5b1dba00`.
New ordinal/comparison10 and layout5 private cases follow GREEN; together with
existing14,29/29 pass, SHA-256
`41ac6d4c75509a2c5c8908d772ddca6a24d89e7bf11660752e6d294b2b97f4b2`.
The new checked fixture initially omits unsigned integer/lifetime metadata;
supplying actual `valueLifetimes(fn)` refutes a production retention defect,
preserving every checked expectation and changing no retention implementation.

Independent correctness finds MINOR RV-001: re-layout can reuse a retained alias
bridge label. A new exact private reproducer is RED, then reserving all declared
and generated labels makes it GREEN; independent fix-only review clears it.
The full compiler run reveals one old internal target-spelling expectation.
Only `machine-contracts.impl.test.ts`'s canonical target changes false→test;
all fixture/opcode/fallthrough/physical-next checks remain, and alias-origin
equality checks strengthen the preserved behavior. Independent review confirms
this is private implementation synchronization, not a specification exception.
Fresh final compiler2,062 pass/two existing skips,143 files,91.02s, log SHA-256
`7f886f6d3381ca4761eaabd81cdd3895d325f985caf44fae4495b7994167dbc1`.
Build/typecheck, whitespace and frozen guards pass. All ten new immutable
byte/branch/ordinal/copy specification hashes remain their authored originals.

SFA/ABI and correctness report no remaining bounded findings. Independent actual
output review verifies upper/false/early29/41, lower34/47, mask21/35, offset38/51
(tail23/37, two-byte sum temporary removed), equaljoin42/48 and mixedjoin47/54.
Payload/resident are704/1065,709/1070,696/1057,713/1074,717/1078,722/1083
respectively; source word parameter homes remain5, ZP2 and bounded callstack2.
These are locally qualified transformations, not universal complete-leaf parity.
MAJOR MC-007/MC-008 remain concrete: guard/live-A candidates31/43 and35/47;
identical-guard factoring29/41; mixed factoring37/51 with ordinary X/Y clobber
permission (A-only39/53). They are analytical, not separately assembled/native.
[#105](https://github.com/blendsdk/blend65/issues/105) tracks those exact seams
under RD-08/#89/#51, without waiving the current full input gate. The separate
fixed-return constant-local promotion debt remains #70-owned: actual complete
141 bytes/332–333 cycles versus analytical53 bytes including immutable data/
200–201 cycles. Pointer removal itself16 specs/private22 and all three reviews
are clear; source/destination/copy contracts remain unchanged.

Whole-input fresh remeasurement remains RED on all12 complete-profile cases:
full2,698/963 and saved2,437/725. This saves another266/131 bytes over the prior
2,964/2,568 endpoint, or778/635 over AR-P25's3,476/3,072. Separate old guarded
index/offset/cast regression292 passes; its four acquisition-size cases remain
RED. The reference budgets, saved-simple100million-cycle bound and all resource
obligations remain binding. Task2.2.8[~],38/48; no full-phase pass, RED commit or
push. Runtime status remains VICE-verified/hardware-unverified.

AR-P28 next ordinary correction: combine the existing full-pointer copy and
constant-offset formation without changing its effective address/Y-zero read.
This safe opaque fallback does not need positive RAM/dummy-read provenance.
The independent specification author receives only the approved public
contract, selected normative authority and public test infrastructure. No
production change precedes its meaningful static RED. Borrowed-base/Y selection
still lacks current complete footprint proof and is not silently enabled.

AR-P28 author allowlist clarification — 11:03 CEST: the author discloses a
reread of `nmi-route-initializer-lifetimes.spec.test.ts:54–106` before writing
either new file. Those exact lines contain only previously allowed public
source-symbol/memory-home helpers and a disjoint-helper signature, not fixtures,
oracles, production or evaluation material. Root verifies the range and
explicitly adds it to this packet's public-harness allowlist; no other range is
allowed. The author resumes without changing an expectation or accessing the
implementation. This is a disclosed allowance clarification, not hidden oracle
exposure or permission to read other specification tests.

AR-P29 next ordinary condition correction — 11:06 CEST: current unary negation
materializes a Boolean byte even when its only use is an immediate branch.
Reuse the existing condition representation and same-block sole-use call-result
window; explicitly test call-returned A rather than assuming its flags. The
bounded contract is recorded before independent specification authoring. No
general call forwarding, cross-block flag propagation or new support machinery
is authorized; implementation awaits meaningful RED. This remains task2.2.8.

AR-P28 pre-oracle arithmetic correction — 11:08 CEST: the blind author derives
20 bytes/33 nominal cycles, not root's20/35 estimate. Root independently sums
the direct setup20 plus Y-zero read/RTS13 and corrects the ordinary contract
before output authoring. Relative to the actual28/45 opaque fallback, the exact
saving is8 bytes/12 cycles. Native-first specifications already exist but are
unrun; no existing expectation, implementation or budget is amended. The author
uses20/33, not a conservative35 ceiling.

AR-P28 meaningful RED / implementation — 11:09 CEST: the blind author freezes
output `948e74aa28b8dee741f05372b5aca086f508c6d2f6da0b2009e3a041837f5996`
and native `cd89a79d6b8ff4fda19d64594c8e96c2159b2e41a8048e4f6cb8b89888851a50`.
Eight public builds succeed; seven nonzero leaves fail at28/45 versus20/33 and
the unchanged zero-offset control passes15/27. Static RED log SHA-256
`d93c0e087cee4e896b7962e45865148a56f02d04ce1910fbd3be117e5cd267ad`.
Five native cases were authored first and remain unrun. The author confirms
only normative `spec/07-structs.md:25–115,190–240`, not another fixture, supplied
struct authority. Root verifies files/hashes/RED before production.

Tracked pre-unit inspection snapshot `d19b77f3438b50bf4ebc166e56888f0949c499ae`
is a diff reference, not a green checkpoint or phase baseline. Root changes
only `lower-aggregate-place.ts`: nonzero parameter-root formation loads/adds/
stores directly; zero-offset copying, fixed roots, indices, cache and final
Y-zero access stay unchanged. No request/home or later-stage storage is added.
Build and immutable qualification are running; task2.2.8 stays unverified.

AR-P29 pre-oracle arithmetic correction — 11:10 CEST: the blind author correctly
includes the explicit post-call A test: JSR6 + test2 + branch2/3 + selected
LDA2/RTS6 =18/19 nominal cycles. Root's16/17 estimate had omitted the test and
is corrected before output authorship. Complete wrapper13 bytes/18–19 cycles
excludes only the separately charged callee body; parameter11/14–15 is unchanged.
The approved adversarial native fixture uses existing public `writeMemory` to
inject an independently authored RAM stub at a test-only callee boundary. It
preserves defined effect markers and exact returned Boolean A while deliberately
disagreeing Z, with stable I/D/SP. Separate untouched generated-callee cases
remain mandatory. No production API, register setter or shared harness is added.

AR-P28 bounded GREEN — 11:13 CEST: all13 immutable cases pass, including five
sequential VICE cases,10.40s. GREEN log SHA-256
`52fef2cb74c6b596e9da1e9ba924b7346f3344efe8455b6b17a9c08e8023587a`.
New private5 and existing aggregate/copy/return15 pass20/20 after GREEN. The
new tests certify two-byte borrowed/pointer homes are disjoint, exact high/low
constant ADC operands, one carry reset, zero-offset no-arithmetic fallback and
unchanged full-word dynamic ordinal addition after offset257. Independent
correctness/output review is running; SFA review follows at available capacity.

Fresh retained Pair/full/saved generations are `f2919784-d228-4130-b5b1-56acad90c05f`,
`a732f4a2-8987-41b6-9a9a-2d0988700803` and
`f4cf791e-679e-44b1-bcc8-d4888a14695f`; exact identities are in
`ar28-fresh-artifact-identities-corrected.log`. The first diagnostic build command
incorrectly supplied a loaded snapshot instead of the public project path and
failed before compilation; it is retained as non-evidence. The corrected public
path command succeeds without any production API change. No full-input pass is
claimed by generating these artifacts.

AR-P29 meaningful RED / implementation — 11:16 CEST: the first decoder-gap run
is NOT decisive RED; its log SHA-256
`b591aa8db165b12279e18920c6e492af513a955b6567553f27fe8e0c829c0b7e` is retained.
Before final freeze, the blind author adds only official CLC/SEC/ADC/SBC decoding
shapes from primary instruction tables, changing no bound or expectation. The
directed rerun is meaningful RED: eight failures (parameter19 bytes versus11;
call-result staging store versus none), four unchanged-callee control passes.
Final immutable output `cc15a7f1aafbcc8b56bcfcd7b57eecfa8557bb626187b24aea6cccd556da1d32`,
native `bafdcff8ba08a0d2dd2b0337c87984e6b94f7f17479997ae92da74d727efe1fc`;
RED log `b844a14bfd5f3ff8153c798b45a69dd6452e441c3fd7599545a5e15093d9b50b`.
Twelve native cases were authored first and remain unrun. No forbidden exposure.

Pre-unit tracked inspection snapshot `a9da83ff2550a69fdf2b7f8fd41e808c17f2ed40`
does not change the phase baseline or create a green checkpoint. Root implements
only the existing unary and forwarding consumers: an unmaterialized final unary
whose exact result is the current block's branch condition returns existing Z
condition; a sole adjacent direct Boolean-call result stays in A for that exact
consumer. A fresh load/OR establishes Z; otherwise CMP#0 establishes it. No
cross-block/callee-flag inference, source change or new storage is introduced.
Build and immutable output/native verification follow; task2.2.8 remains[~].

AR-P29 local specification GREEN — 11:18 CEST: all24 independent static/native
cases pass, including twelve sequential VICE cases with ordinary effects/order,
fallbacks and deliberate A/Z disagreement. Log SHA-256
`c1e26d3e79db43280a19749dd7c718ea6d8bbe0ee35af5d485c9cda4962050d8`.
Build/typecheck pass; independent bounded review follows. Whole-output rerun
still fails all12 cases: full2,698/963, saved2,333/725; no budget changes.
Rerun log SHA-256 `0be0a77c0617296da6a43b8ef5b511503b12b5569008ee6e76c576a7b3f8d964`.

New private intervening-use fixture initially expects a retained temporary for
an unmaterialized branch value spanning a synthetic NOP, then a synthetic call.
Both runs fail that expectation. Root inspects the current retention guard:
branch-only values are not materialized by that synthetic shape. A normal source
local spanning a call instead includes STORE/local LOAD, which the original
fixture omitted. The fixture is corrected to that actual source-lowering shape,
preserving the temporary requirement and canonical-value expectation. No
production retention rule or specification is changed; fresh directed/full
verification is required. Earlier failed compiler/private logs remain evidence,
not passes.

AR-P28 output review additionally derives an analytical19-byte/33-cycle short
offset candidate using the already-required Y=0, with full carry and the same
source/bus effects. The original20/33 oracle has exact shape equalities, so a
stronger supplemental oracle alone cannot permit that candidate. Its original
hash/evidence remains unchanged; an exact specification-test exception is
required before any such production change. This is a measured remaining debt,
not a parity waiver or silent oracle edit.

Artifact retention limit: publishing fresh AR-P29 full/saved generations has
pruned their third-old AR-P27 generations. Those original2698/91-padding and
2437 endpoints survive in captured logs/review evidence, not current raw files.
Root withdraws its earlier claim that all old artifact directories remain.
Pair old/fresh raw artifacts still exist for independent direct comparison.
Do not treat an absent generation as a currently inspected byte-diff endpoint.

AR-P29 bounded host correction — the independent reviewer identifies an introduced
function/block search for every unary negation. Root will pass the actual block
already owned by the existing function selector through its operation/unary
consumers. The existing optional interrupt-route argument remains unchanged;
callers without a block use the conservative value path. Exact final-operation,
branch-result and materialization guards remain. No cache, fact model, pass or
new storage is introduced. All immutable output/native expectations stay fixed.
The corrected source-shaped private suite is37/37 GREEN; the two earlier full
compiler runs loaded the pre-correction private fixture and are not GREEN.
Fresh verification and independent handoff review follow this small correction.

AR-P29 post-correction checkpoint — independent correctness and SFA/ABI reviews
clear the actual-block handoff. New eligibility overhead isO(1), with no
global/function lookup. Build/typecheck and public24 pass; fresh compiler145
files/2,072 tests pass with two existing skips,88.72s. Compiler log SHA-256
`28a76938ef5e757583107d340926a6e9e9b7ba987dbd311730b39cc651edbf16`,
public log `31ac47afde7717ab0fef7482557014a44975855b820b3885c1a25e81c831c8d0`.
The prior two failed compiler logs remain non-passing evidence.

Independent output review inspects retained exact AR-P29 generation
`7a82c830-f061-46a8-914f-d145a30cb5c8`, build-JSON SHA-256
`ed57073ac706b932bea0eccd713a1263c8e4b3ac831b36950174d28ca1a56a87`:
parameter11/14–15, callee4/10, wrapper13/18–19 excluding the callee,
28–29 including it. Its direct constant-byte-return arms permit an analytical
12-byte transfer/test form, with a concrete register-clobber proof. AR-P31
records the ordinary bounded consumer correction; new blind oracles precede
code. Existing13-byte upper-bound oracles already admit official transfer
instructions and remain unchanged. No arbitrary continuation clobber is allowed.

AR-P28's remaining19/33 local gap is filed as
[#106](https://github.com/blendsdk/blend65/issues/106). AR-P30 requests only the
exact stronger one-file oracle exception; that correction remains pending while
other approved work continues. The20-byte form is not declared local parity.
Whole-output12 still fail at full2,698/963 and saved2,333/725; task2.2.8 stays[~].

AR-P31 meaningful RED / conservative route boundary — 11:44 CEST: native12
cases were authored first, SHA-256
`55c372d9dbc1ecb45c9bb5b476db30da0c26df0b8e8f1ad87d28502dd08e6071`.
Independent output8 cases, final SHA-256
`9d974b8ef47b3c3faf32830759a17bca764e3aa148209eff390a81ac0817aaa2`,
meaningfully fail four complete wrappers13/12 bytes; four unchanged callee
controls pass. RED log `3aa21e9aa630400ec3882879348812a97e102d12a21a1e1eb5a084e5534bda20`.
Native baseline12 pass before production, proving the existing behavior oracle
is independently usable; no expectation is weakened. The author makes no new
NMI runtime claim. Pre-unit inspection snapshot
`b99cf0c73d2ffe1cfbc250912aad2ff752dbca39` is not a checkpoint/baseline change.

Root independently verifies SFA review's domain caveat: retained helpers can
normalize numerical ownership depth to zero while still executing in NMI.
Select the shorter test only outside that execution domain; selected NMI routes
retain their existing register-save demand. The two direct constant-byte-return
arms are resolved using the owner's existing block index, with no CFG walk or
liveness solver. All earlier14 concern files now pass425/425 together,210.99s;
log SHA-256 `dbb9eda237cfa8c8b3ad57067ef01842cfbbd41d710bf8c1ec5814e0cf750690`.
Root implements only this bounded existing-consumer selection now; build,
immutable/native verification and independent reviews follow. Task2.2.8 stays[~].

AR-P31 locally GREEN — public44, including24 sequential VICE cases,37.14s;
log `5fc04bb6cc1264594a5435c1d6ac5f73e855f03a3b6cff59d953a4a11a1c1994`.
Private42 pass, log `23f20ba3513850269595d545c2ea3065c713d5cf66cf9ca8da3f3723af2f3f08`.
The initial private run40-pass/one-fail changed a synthetic startup expectation
incorrectly. Root restores its original CMP assertion and adds a distinct actual
ordinary-function witness; no production fallback or protected oracle is weakened.
Fresh compiler2,077 pass/two existing skips across145 files,84.65s, log
`0a3588d3bc9dcc5ab7d5943b0cb9f560e0a6a33f0df3f82bba53d51d259c31ba`;
build/typecheck pass. Independent correctness, SFA/ABI and output reviews report
no findings. Ordinary/IRQ select TAX; NMI-domain descriptors retain CMP even when
their normalized numerical depth is zero. No new NMI native proof is claimed.

Exact retained diagnostic generation `5ce116de-5f58-44ca-ac0f-2c86582a4183`,
build JSON `790f0e325ee4aeb2bb509cf1ffefec87fc11ca6c8b68a1f684db9f1dfb351683`,
contains wrapper `207b09aaf003a92260a91160`:12 bytes/18–19 nominal cycles;
separately retained callee4/10 gives16/28–29 combined. Diagnostic payload677→676,
resident730→729, with unchanged homes/ZP/scratch/bounded stack. MC-010 resolves;
existing #79 owns the separately scoped trivial-callee inlining beat opportunity.
Full generation `41337a98-a5d9-4723-811c-9a6848dfbeab` and saved generation
`b772d208-bd4f-4149-88e8-ad14d4f449a6` are byte-identical to AR-P29. Their build
JSON hashes are `afacbae85c6ab288cc25dd8bcde60380e130711ad6533f7d4362da6ce2fe67f3`
and `0f59f77da6edda268bfe2f40230175898784cc9fd5634a7bbf94cf08f1ea93d8`.
Whole full2,698/963 and saved2,333/725 remain RED; task2.2.8 stays[~]. Frozen
authority and whitespace checks pass. AR-P30's exact exception remains pending.

AR-P32 records the next ordinary consumer reduction: reuse the existing exact
operation's unsigned0..7 proof to omit unreachable byte-shift saturation work.
No new proof model, solver, producer fact or shared harness. Independent blind
native/output authoring precedes production; existing specifications stay fixed.
Pre-unit inspection snapshot `992b9326f38d7ed1363eb1c1d8641c841a60e4d3`
is read-only recovery/review evidence, not a commit or changed phase baseline.
Actual owners are `lower-bounds.ts`, `guarded-place-proof.ts`'s existing consumer
collection, `lower-variable-shift.ts`, and the existing state-field comment.
No proof transfer/refinement/join/invalidation rule changes. Native is authored
first; all tests and production remain pending verification at this entry.

AR-P32 native-first baseline — eight profile groups pass on unchanged production,
19.39s. Immutable native hash `6bd548f58fd5b71e9485ac1d35300af9cc00005cfb3907715a86f27b4620078e`;
log `bd01a7b902c735abc201d1bebb3dd4b66e7de8f0fe5102b774c1d35f85f3055a`.
Each bounded/fallback group checks35 input pairs with20/eight outputs respectively,
including signed negative bytes, zero, saturation, conversion, mutation versus
retained local data, ordered read/store/marker events and I/D/SP. The local capture
case proves behavior, not that a shared-global reload acquired a new bound.
No new interrupt-domain or physical claim; static meaningful RED is still pending.

AR-P32 pre-implementation SFA/ABI assessment reports no surviving finding for
the exact consumer: the existing maximum bounds the complete nonnegative value,
not merely its low byte, so a word maximum below8 proves high zero. Collect RHS
before the existing proof transfer. Keep all invalidation/refinement rules,
low-count loading, zero comparison/loop and homes. A cheap literal-only/no-index
skip avoids new guarded-proof work in constant-only shift bodies. Removing Y use
can only shrink selected wrapper/clobber demand before closure. This is feasibility,
not implementation or native qualification; the independent static oracle remains
the required meaningful RED before production.

AR-P32 static baseline / AR-P33 observer gate — all80 bounded cases fail the
public-range observer before cost assertions; eight unknown-count controls pass,
11.03s. Output hash
`d455705b8bfd6cb3d9aab61cb705a8b0be1f8dcc538c3f611cd8ef1a467621f0`;
log `ar32-output-red.log`, SHA-256
`cf5d5592084363cf21a3b6a1d21e7c9e9a1b01008a24e0ea065ecf92daa7224b`.
This is NOT meaningful optimization RED. Public masked/guarded artifacts prove
legitimate function-origin branch/return gaps inside narrower shift-origin
ranges, while guard/false-arm bytes remain outside the shift interval. AR-P33
requests one exact observer-only exception that charges all intervening bytes
and preserves every program and numerical limit. The native eight-group
baseline and its immutable hash stay unchanged. AR-P32 production remains
untouched relative to snapshot `992b9326f38d7ed1363eb1c1d8641c841a60e4d3`.
The same raw assembly exposes a result store/reload that must be removed through
bounded existing result delivery, not excused by increasing the15/17-byte floor.
AR-P30's stronger one-file exception is also pending. Standing approval removes
routine compiler-decision pauses, not either exact protected-oracle gate.
Task2.2.8 remains[~],38/48; no RED commit or push.

Continuation authority corrected — after the exact two-file AR-P30/AR-P33
packet, the user reiterates that trivial approvals must not interrupt work.
The parent records both exact stronger/measurement-only exceptions under that
reaffirmed standing approval and proceeds; the prior pause was unnecessary.
No source program, native test, numerical ceiling, frozen authority or scope
gate is weakened. Independent blind authors apply only the named oracle edits;
meaningful RED, bounded compiler remediation, GREEN and independent review
remain required. This is the same ongoing2.2.8 task, not a new effort handoff.

AR-P30 stronger oracle is frozen at SHA-256
`e6f00d88e39593e7551185f2706ecc280723ae4b44d25e3ca0a57aad0490b7f4`.
Unchanged production has meaningful RED: three short-offset shape failures,
five zero/high-offset controls pass,2.87s. Log `ar30-stronger-red.log`, SHA-256
`b23e0423219595e693628addbbc5c2b428a0f727a61358585eba9ddd924183eb`.
The existing address builder owns Y's earlier zero initialization; its two
immediate byte-access consumers need only a local optional `zeroIndexInY` result
bit to omit their duplicate LDY at zero displacement. This is a construction-owned
instruction handoff, not a propagated register-availability proof or new state
model. Dynamic/high/zero offsets and retained-pointer users keep old formation.
The bounded SFA/ABI feasibility check is dispatched before implementation.

AR-P30 implemented, verification pending: existing borrowed short-offset byte
address formation initializes Y once, uses TYA/ADC-high and returns only a local
construction-owned zero-index bit. Immediate load/store consumers omit only the
duplicate LDY at offset/displacement zero. Returned-root displacement, cache,
retained, dynamic and zero/high-offset paths stay unchanged. No home, closure,
global register fact or transitive clobber is added. Build passes. Independent
SFA/ABI feasibility reports no surviving problem; actual output/native and
fix review follow. Task2.2.8 stays[~].

AR-P33's first corrected observer is frozen at
`97c85f280dabf062b87505971ff701322514193936bf6b7dda907cb2ee9000d5`.
Unchanged shift production now yields48 meaningful saturation failures and
eight passing unknown controls, but16 masked-byte count-boundary and16
masked-word return-boundary observer errors remain. Log
`ar32-observer-corrected-red.log`, SHA-256
`0786a8e54885dad8ace1d378b6e89da37492b5f08cbedc6842717ca131a483ab`,11.23s.
The exact one-function measurement correction continues without another trivial
approval; no assertion or numerical limit is weakened. AR-P32 production still
waits for the complete intended meaningful RED, not these observer errors.

AR-P33 final observer identity is
`e2f87aa4532d05dff1afcaecfe7f87e75cb7bd4f060f2f7f9bcd0f0d5381a045`.
Public raw byte/word metadata proves the shift's origin excludes the trailing
grouping delimiter; the local lookup removes only those trailing parentheses,
without changing any source or expectation. Meaningful RED now holds for all80
bounded cases at the redundant saturation assertion; eight unknown controls
pass,11.41s, with no observer-boundary errors. Log `ar32-meaningful-red.log`,
SHA-256 `58b333dc4b99df60918d3634d26c699bb4b823b4998545752c41121b2fdc0276`.
AR-P32 production may begin. Its documented existing-forwarding companion admits
only a sole terminal byte-result return to avoid the exposed store/reload; the
15/17-byte floor is not waived. No additional proof model or source limitation.

AR-P32 implemented, verification pending: the existing semantic proof walk
records exact shift-count maxima before its unchanged transfers, and the machine
adapter supplies them to byte-result consumers. Index-free literal-only shift
bodies return before the guarded walk. The byte selector omits only proved
unreachable high-count/range/fill work; zero bypass and signed/logical loops stay
intact. Existing forwarding retains A only for a sole same-block terminal byte
return, removing its redundant result home before closure. Unknown counts,
wider results and all other lifetimes keep their existing paths. No pass,
runtime, general liveness/register model, proof invalidation change or source
workaround. Build and immutable output/native checks follow;2.2.8 remains[~].

AR-P30 now passes13 public cases, including five sequential native groups, and
five private selector cases. Bounded correctness and final SFA/ABI review report
no findings; output review awaits the fresh19-byte artifact. AR-P32/AR-P33 final
public run passes96 cases (88 static, eight sequential native groups),28.38s.
Log `ar32-final-public.log`, SHA-256
`15fd6ea11168a1945cadd9fce9d80cb4528bcfd0d085b33cb863778e6504b67b`.
Final observer SHA-256 is
`220895fb7b91d474102f673d295c3d3676b08ef145f374b6ea7eed1dac5beede`;
native remains `6bd548f58fd5b71e9485ac1d35300af9cc00005cfb3907715a86f27b4620078e`.
Final SFA/ABI review is clear for that bounded endpoint. These are local results,
not fresh whole-input qualification or task2.2.8 completion.

Independent output review MC-011/MC-012 identifies needless private count-zero
comparison and sole-adjacent masked count staging. The smallest remedies reuse
the same selector and existing mask forwarding whitelist, under standing
approval. A new blind ST-33 whole-masked-leaf oracle is authored before production.
Private A-before-X is limited to two storage operands; the masked live-A path
keeps CPX#0 after loading the left value. No new pass, liveness proof, conversion
or cross-block guard reuse. The separate guarded whole-leaf debt stays visible.
Pre-unit tracked inspection ref `9c73dcded50b9c36f22af43bb2d93db06c5599fd`
is not a commit or an untracked snapshot. The exact current untracked guarded
proof owner is separately retained as `ar32-before-guarded-place-proof.ts` under
the existing evidence root; it is not claimed as an earlier AR-P32 baseline.
Task2.2.8 remains[~]; no RED checkpoint or push.

ST-33 blind oracle is frozen at
`7ee6cacae952bc7e3b14d914604134cc86ef11feb98d3540ea302171404a0393`.
All32 complete masked-leaf cases have meaningful RED before production:
29 zero-path cycles exceed23; independent numeric execution succeeds before
that cost assertion. Log `ar32-masked-leaf-red.log`, SHA-256
`e70f443298f4c8862a6ca4ba81408b10454e5880c18d5cf50da74dbb9f00c3b6`,5.48s.
The author discloses only adjacent public-helper declaration/header exposure,
not implementation, old-oracle or evaluator-answer reads. The next bounded
selector changes are now implemented, verification pending: two private homes
use fresh LDX zero; an exact sole adjacent bounded AND-mask count remains in
its existing A/zero-extended-low representation until TAX. Live count A retains
CPX#0 after loading left A. No home, proof model, general conversion or cross-block
register state is introduced. Old bounded/static/native oracles stay unchanged.
The fresh preceding whole-output run has eight size failures: full2,698/963,
saved2,311/725, not the earlier saved2,333 endpoint. Final whole costs follow
this correction; all limits remain binding and task2.2.8 stays[~].

MC-011/MC-012 now pass128 public cases, including eight sequential native groups,
32.15s (`ar32-selector-public.log`, SHA-256
`941bbfb3b9052867f2bef351abb5601988a98dba7f405cf62ee3523665290d20`).
New private count fixtures initially omitted real unsigned metadata; correcting
only those fixture facts preserves every assertion and yields7/7 PASS. Full
compiler2,084 pass, two existing skips,90.34s (`ar32-selector-compiler.log`,
SHA-256 `f2fd33b6ba5537a083c5517d7b781ae01e406ebb0a4cc792960e8a4521644ff0`).
Build/typecheck/targeted formatting pass. Bounded correctness/SFA/output reviews
clear the repaired source and actual18-byte masked/13-byte private tail artifacts.
SFA count staging falls4→3 bytes on the direct word-mask witness; payload678→673,
resident735→729, with unchanged stack2/ZP0/scratch0. Fresh full/saved artifacts
are2,698/2,311 bytes and resident2,835/2,464; both complete budgets remain RED.
Full code2,481 plus217 padding reconciles2,698; saved has no padding.

Evidence limitation: neither the original untracked pre-AR-P32 proof-helper text
nor the original457-line AR-P33 oracle is mechanically recoverable after
compaction. Do not fabricate a snapshot or claim a complete historical diff.
Base correctness instead reviewed the whole added helper against actual Phase2
baseline absence and the current88 oracle programs/limits against the authorized
packet. Current behavior, production and new immutable ST-33 evidence are clear;
historical exact-exception immutability remains Unknown, not waived or recovered.
Current source/oracle hashes establish stability for subsequent units only.

Output MC-013 still finds1 byte/3 cycles of guarded complete-leaf debt requiring
a bounded guard-edge count/layout handoff. MC-014 separately finds an intervening
lossless conversion stages a proved0..7 mask:21/23-byte complete leaves instead
of18/20. The smallest next correction is one exact mask→word-to-byte conversion→
byte-shift window in the same existing forwarding/retention owners. No general
conversion forwarding, cross-block register state or new proof/pass is permitted.
Standing approval covers this ordinary remediation; a new blind converted-leaf
cost oracle precedes production. Exact tracked pre-unit inspection ref
`841ea8cbf4c08ac33cf4d09c2315a4a8caaedbe8` is retained; unchanged untracked
proof owner remains hash-bound separately. Task2.2.8 stays[~]; no commit or push.

ST-34's new implementation-blind16-case converted-leaf oracle is frozen at
SHA-256 `f7ccebd690f88060da79a04529c5eb5880624fb71a078b110347420134d66d77`.
All16 cases reached meaningful RED at21/23 bytes against unchanged18/20 limits,
3.67s (`ar32-converted-leaf-red.log`, SHA-256
`55bd9fb496d8fbe35584a60f1fb22ae43c8d6085a0f8fd8ebc5d1ce1c48eb0c9`).
MC-014 is now implemented, qualification pending: the existing mask whitelist
may retain low A through exactly one sole-use unsigned word-to-byte truncation
whose next emitted consumer is the same exact proved0..7 byte shift. Conversion
lowering, storage closure, proof owners and all conservative paths are unchanged.
The public converted witness is retained before production under
`ar32-converted.KEFaYN`; original current oracles/private fixture snapshots are
also retained for exact subsequent diffs. Task2.2.8 stays[~],38/48.

MC-014's final fresh build/typecheck and complete compiler suite pass:
2,087 tests, two existing skips,146 files/85.56s (`ar32-converted-compiler.log`,
SHA-256 `68989c1459064d0c292c0bd793660df5f3ba6e6dd44895c48abd45dbb06b9ad2`).
Root private10/10 pass1.12s, including the exact conversion window and unsigned,
width, multi-use, bound-identity and both barrier fallbacks. The final combined
public run passes144 directed cases, including eight sequential native groups,
and fails only eight complete-budget cases: full2,698/963 and saved2,311/725.
Duration42.32s, log `ar32-converted-final-public.log`, SHA-256
`d2c4f7a0703e556774904341398bdd8fbb3630c90759f66caf4136bae7853b82`.
All four oracle hashes remain unchanged. Bounded correctness/SFA/output reviews
find no surviving MC-014 issue; their source, actual-byte and runtime scopes stay
distinct. Historical AR-P33 exact-exception integrity remains Unknown.

Actual converted witness before generation `b758bfa6-847d-4e72-b772-ae5fff2d0495`,
build SHA-256 `ef25236a067466010b6fdec18c288d44eb46b1cc9f9b288b3e019f9f7e0cc663`,
has21-byte leaf2422–2443; after `86cc15a4-cb99-442c-ba05-2aeea4477c16`, build
SHA-256 `2bce10d37ec871fb5cbfc1d23637f91a73a91cdbabd5386e5b05d3f15c7f2ad3`,
has18-byte leaf2422–2440. Count-zero cycles27→23; positive25+7k→21+7k.
PRG678→675, payload676→673, resident733→729, SFA4→3. Word count2B/value1B,
startup328B/restore281B/caller33B, ZP0/stack2/scratch0/padding0 are unchanged.
The only removed home is the masked temporary. Signed right meets20 bytes with
21+9k positive cycles. An existing-scan index handoff removes a newly introduced
whole-block search without changing adjacency. No general new machinery,
protected/frozen edit, RED commit, push or full Phase2 qualification follows.

The remaining guarded-shift debt is owned by GitHub#107, not silently deferred
or waived. AR-P34 records the ordinary bounded compiler-owned selection under
standing approval. ST-35's new blind complete-leaf32 cases reach meaningful RED
before production, with parameter widths/accounting already passing: log
`ar34-guarded-leaf-red.log`, SHA-256
`56801d139f5001763e2c9f0ed11d1a473862be2c9219553d70848dcdc531bd75`.
Oracle SHA-256 `9fe1df9b3b2606b9c0005ddf3310b70173c3f26facd03daf5dbc410cb03af11a`.
Exact tracked pre-unit inspection ref `e3400524951fb727813ca24be584b3ad41b6a6a2`
is retained. Implementation follows only the fixed guarded-leaf topology;
no generalized cross-block register state or proof change. Task2.2.8 stays[~].

AR-P34 is implemented, qualification pending: one fixed machine-pattern helper
in `machine/lower-guarded-shift.ts` is called at the existing function-selection
boundary before closure. It inspects actual typed parameter homes and the exact
guard/success/empty-entry/loop/return topology, with predecessor checks; it never
creates a general X-availability fact. Only successful fallthrough and the checked
count's reload change. Word high rejection remains explicit, CPX#0 follows the
value load, and existing homes/ABI are unchanged. The first build reports only
an unused type import in the new helper; its removal changes no selection.
Immutable/native qualification and independent reviews follow. No GREEN claim.

The first immutable32-case implementation run remains RED because actual public
frontend rejection uses one instruction-empty JMP before its constant return.
A read-only replay of existing frontend/semantic/storage/machine owners confirms
that exact shape. The matcher now accepts only that single alias or the direct
return, with exact incoming edges; it does not traverse alias chains. Entry guard
and exact seven/eight-block coverage enforce whole-leaf purity. Existing function
metadata is passed through rather than scanning all functions a second time.
Build passes (`ar34-build-alias.log`); the unchanged32-case run passes16 byte-count
cases but rejects16 word-count builds at artifact evidence. The new low-check
block initially lacked an existing recognized source-owner suffix. It now uses
the existing `.shift.` owner convention; no evidence-owner API or resolver changes.
All32 unchanged cases are rerun after rebuilding.
No oracle edit, whole-input clearance, commit or push.

The rebuilt source-owner fix passes all32 unchanged new whole-leaf cases:
`ar34-guarded-owner.log`, SHA-256
`6917f1e6aaa5b4dfcb2522f7bc999186ec2b68e1ce610a0488cbc96ee8119614`.
Combined five-file176 qualification has144PASS and32 existing observer failures
(`ar34-public.log`, SHA-256
`94366ccb3041c1c599f0da7fd41bfbedfefc6f417120bc15ca977958099209d2`).
All eight native groups pass sequentially. The old observer assumes the removed
count reload is inside the shift-source hull; it is left untouched. AR-P35 records
the exact proposed instrumentation exception and blocks promotion until decided.

New private16 and existing10 cases pass in `ar34-private-shape.log`, SHA-256
`99b467a5104c0df2fc8a5db47aeda4f509141e31d466fd9995f22a37e03a345f`.
The first private run had six fixture assertions fail: request classification used
the wrong field, and unrelated unbounded-shift CPX instructions were mistaken for
this selector. The corrected private tests use actual `storageClass` and inspect
the unchanged entry guard/absence of the new low-check block. No production or
public oracle change follows from those fixture repairs. Storage closure/binding,
typed byte/word parameter widths, aliases, pure effects, extra entries, signed
count, wide return, startup and IRQ/NMI fallback are checked.

Typecheck passes (`ar34-typecheck.log`, SHA-256
`2b3188e10b490fb3fdaf30d56b1cf728749e5029d08840ba61d6d6a5266f4c87`).
The retained same-source word witness is27 bytes2422–2449 versus28 before:
generation `2c51ac08-02e8-48ce-92a3-3f52affed273`, build SHA-256
`525f37fcf19522e76741a3968bf165be85ea8ecc37734caf3535798164d96f7f`.
PRG685→684, payload683→682, resident739→738; parameter homes2+1B, stack2,
ZP0, scratch0, padding0, startup328/restore281/main33 and platform state49B
remain unchanged. Complete compiler passes2,103 with two existing unrelated skips
in147 files/89.34s (`ar34-compiler.log`, SHA-256
`95bf255603de2574de93b8cfcc3379fb5319c10212d1be61d4e3ca9ac84fb648`).
Fix-only SFA review reports no findings, with private interrupt checks explicitly
selection-only. Correctness review reports no surviving source finding and leaves
the existing-oracle exception uncleared. Final output review reports no surviving
production-output finding within this bounded pure-leaf contract and independently
reconciles before/after raw bytes, hashes, complete resources and source ranges.
All three dispositions remain Verified partial because the old32 observer cases
and exact AR-P35 authorization remain open; no combined GREEN is inferred.
Fresh whole-output four-profile runs still fail all eight unchanged ceilings:
full2,698/963 (`ar34-whole.log`, SHA-256
`88a4015e9810ac309526680aaaf89e97d7ab5e527c96a09e7e43d3ba5a5e8fae`),
saved2,311/725 (`ar34-saved-whole.log`, SHA-256
`d00fea5495126ea5ce97313072fd59a5afe208d3e7ff400f84dfd097937b05e5`).
Output inspection confirms the retained word leaf's exact27-byte witness and
analytical accepted zero32→29 cycles/positive30+7k→27+7k, with high-byte
rejection22→15. High-zero/low>=8 rejection costs22→23: a one-cycle branch-layout
tradeoff, not uniformly faster output. Byte accepted zero26→23/positive24+7k→21+7k
has the same rejection16→17 tradeoff. Signed-right loop terms use9k instead of7k.
These match the stated complete expert idiom; this is local meeting, not a proved
whole-program beat. #107 stays open. A smaller analytical alternative25-byte word
leaf has23-cycle zero/25+7k positive paths but29-cycle low rejection, six slower
than the selected idiom; it is unassembled/unexecuted and not a dominating fix.
No phase/task GREEN, historical-integrity waiver, commit or push.

#### Exact guarded-shift observer correction — AR-P35

The user's explicit “Do apply” approves only `shiftTail` and its sole call site.
The corrected fallback admits source-owned CPX#0 only after certifying the exact
entry prefix against declared byte/word count and value homes, with both guard
rejections targeting the final outside-tail LDA#$55/RTS. Old index-load discovery
remains first choice. No other prefix, immediate/indexed load, omitted high byte
or intervening instruction qualifies. Every program, decoder, executor, behavior
assertion and cost limit is unchanged. No compiler code changes in this unit.

The retained exact prospective baseline `ar35-observer-before.ts` has SHA-256
`220895fb7b91d474102f673d295c3d3676b08ef145f374b6ea7eed1dac5beede`.
The new observer SHA-256 is
`1adfe68b719e440082f5ae44ef3f91c899c77e9f6963159d35f21d259de41df2`.
An independent byte projection verifies all text outside the two approved regions
unchanged, and all four companion oracle hashes remain unchanged. This does not
recover or waive historical AR-P33 integrity Unknown.

All176 public cases pass, zero skips, five files/38.45s, including eight sequential
native VICE groups: `ar35-public.log`, SHA-256
`c1d089efe41e1d20330f07515a79a5231d690b5cf89ea8aea1de2daff303180a`.
Typecheck passes (fresh invocation, cache-backed production declarations):
`ar35-typecheck.log`, SHA-256
`e98d9411baf9fe1e423576d97b84954247343acafc7ee164f0f1618cdc50a723`.
Targeted formatting, whitespace and frozen-spec checks pass. Independent
correctness and output reviewers report no findings and clear this exact bounded
exception; no behavior/cost expectations are relaxed. Guarded whole leaves remain
22/24 byte-count bytes and27/29 word-count bytes. Separate prefix accounting
charges13/18 bytes while the selected core is9/11 bytes. Complete whole-input
gates remain RED at2,698/963 and2,311/725. Task2.2.8 remains unverified; no phase
clearance, integrity waiver, commit or push. VICE-verified/hardware-unverified.

#### Returned predicate consumer — AR-P36, RED-first authoring

The next ordinary correction reuses existing `lowerCondition` at the semantic
return consumer for unconverted runtime comparison trees only. Raw Boolean
names/calls, unrelated logical leaves, constants/conversions, stored values and
other returns remain unchanged. No new pass/IR, solver, support framework or
storage fact is proposed. It is covered by the user's standing compiler/code-size
approval, not a new material-complexity permission. The sole-source104-byte
artifact shows comparison stores/reloads and a logical merge immediately before
return; full/saved963/725 byte ceilings stay unchanged and RED.

The implementation-blind specification author owns only new
`source-library-returned-predicate-output.spec.test.ts` and
`source-library-returned-predicate-native.spec.test.ts`, with all production,
internal implementation, prior answer maps and current planning journals forbidden.
Existing public build/byte/accounting/VICE fixtures are allowed; root owns all
execution. True is tested by nonzero language truth, false by zero; raw Boolean
returns preserve exact0/1/$80/$FF. Complete byte/cycle floors, ordered/bypassed
reads, no input writes, balanced SP and unchanged I/D qualify independently.

Pre-production tracked inspection identity
`aab5bdf7d572d4d9f140c4d364c4224c31e1b305` and exact `ar36-cfg-before.ts`
SHA-256 `a44276a5c97e82960e5c386c433916f55258f57837e87bdad5150dd74a76c3f1`
retain the old owner for fix-only review. No production change or GREEN claim
precedes the blind immutable RED baseline.

The blind output oracle freezes20 cases across four profiles:16 meaningful
complete-byte failures (direct18/16 versus11; logical41 versus16) and four
existing raw-return controls pass before code. Log `ar36-predicate-red.log`,
SHA-256 `a0288e2cf76d758bafd7fd24feaeedd53de373dbac3dfec09fee7b33240cb8f4`.
Static oracle SHA-256
`9b8c97364652ed3472c5c18c291c4014d9d3161adafc17fa883f1e68c06bcaa6`;
native oracle SHA-256
`8917096d7f7293b9e469da5c81b5d7749c026675945b8a748c221d0446baf365`.
Both files remain immutable after this baseline. Root owns their20 native groups
and176 operand cases. Production implementation may now start; no task GREEN.

The implemented consumer uses only the existing condition lowering and two
ordinary constant-return blocks. Raw or mixed logical values retain their old
path. Fresh checks pass:44 private CFG cases,40 public output/native cases and
eight additional four-profile word/sword effect-order groups. The latter cover
all six comparisons over49 boundary pairs and captured-left calls whose RHS
mutates the original input. No public oracle is changed. The additional oracle
SHA-256 is `99e63acdf137ffb0eeba98860ada4765d92f9e7760abeb7fd4611a3abf52e9c5`.

Evidence in the retained Git-metadata directory: `ar36-cfg-private.log`
SHA-256 `62a3fd1a8040d8a061f11a8dd61b4e3f3918c44f5ec63b16d861145532ce04be`;
`ar36-predicate-public.log`
`0ace8c97b4d90e8ffa982ebe32d5c67b417df7b0530e46214b54edef907d97be`;
`ar36-predicate-effects.log`
`e03a0b981ba0bf46296efcf7d3e8633d9e731e5f92159734124fde1e981c6c29`.
Full compiler147 files pass2,116 cases with two existing unrelated skips:
`ar36-compiler.log`
`686bdc33e136e565f1fb3b5ff20d21c3adf11da51bb615f2e205831121f2f75f`.
Fresh build/typecheck pass, respectively
`62bc3fb7d24437cd735692b9a8f3675c5b60d5f3c62dad19e526b5558eb17301`
and `3cc5dc8639c76743c175c2d80d9c702ef4f614afba9d269862e55b0dee49bba2`.

Same-source retained actual artifacts shrink `soleGroundSource`104→64 executable
bytes. Full payload2,698→2,442 comprises40 fewer code bytes and216 fewer padding
bytes (217→1); saved payload2,311→2,271 is40 fewer code bytes. Full closed
SFA/ZP/stack/scratch63/6/5/0 and saved71/10/4/0 stay unchanged. The summary
`ar36-actual-artifacts.json` has SHA-256
`5a03735393a2b68a3c6b6dd45951bfb4e4abc048fb28f66149e9f6decb0d00b7`.
All eight unchanged whole-output gates remain RED,963/725 ceilings binding:
`ar36-whole.log`
`2535b352c70d1dd01682aaefe4394c65da247b9c9d2bbffcaa63ba6aba166727`.

Independent correctness and SFA reviewers clear the bounded semantic consumer,
not the phase. Output review confirms exact code/padding and unchanged resource
accounting, but identifies a smaller freshly-zero return idiom. The retained
public standalone leaf summary `ar36-predicate-actual.json`, SHA-256
`40659d9d5950377b9d844e68a1cb6bacd98d4e0bdccbd1a2e7459c693c99c443`,
shows11-byte direct and16-byte logical leaves. Their redundant zero load and
duplicated RTS have8/13-byte direct-edge alternatives. This bounded defect is
not dismissed by the earlier weaker GREEN floor. Task2.2.8 stays[~],38/48;
no complete-input qualification, integrity waiver, RED commit or push.

#### Direct zero-return selection — AR-P37, meaningful RED first

Output reviewer MC-015 is accepted for correction under the user's standing
compiler/code-size authority. It is a concrete routine defect, not a new material
mechanism or an old-oracle edit. A separate blind author freezes12 stronger
four-profile output cases, SHA-256
`3bb8a06abb664a291157ebc84edf131d304d32627b15f987d12bffee51b8966f`.
All12 fail meaningfully before production:11 versus8 and16 versus13 complete
bytes. `ar37-zero-return-red.log` retains this baseline; all earlier files stay
unchanged. Exact prospective owner snapshots are `ar37-register-before.ts`
SHA-256 `9d7f80e956f0acf6e31a84ab66718c5ac94a368dd88bcc565b63800306861bf2`
and `ar37-function-before.ts`
`29725a61059d43eb212627c7458307a922f7de9a84ab68f6b023c5dae7cfff2a`.

The selected machine-block correction admits only an ordinary Boolean function
with exactly two single-immediate0/1 return arms. Every direct zero-arm entry
must test freshly produced A/N/Z for Z=1. Unconditional/aliased/unknown, duplicate
label, both-successor, nonzero or stale-flag entries reject. The zero load is
removed and the one arm uses existing fallthrough to its RTS. No new IR/pass,
availability facts, predecessor traversal, requests, scratch or public API.
Selection runs before function-storage closure. Build and immutable public
output/native/effects verification follow; task2.2.8 stays[~],38/48.

The prospective RED log SHA-256 is
`02f08c3b1f9e4d2d6c6e724e34037d74431d439f44b62ec9e78aff1007fab99e`.
All60 public cases now pass, including20 sequential byte/native and eight
wider/effect groups: `ar37-predicate-public.log`, SHA-256
`9fa0241b33b8ffb3d5710c0f3f6868c8e684e05b13f5bd574d445b59c2f7a283`.
Private proof/fallback/layout22 new plus24 retained cases pass:
`ar37-private.log`,
`3b8fb5b561f6b5e3948f589cf38598f880242a2a62d0f3fc7f6890bcd8c6a749`.
Full compiler148 files pass2,138/two existing unrelated skips:
`ar37-compiler.log`,
`03a71616add4ba23c8ef70026d2a08a3adbdeee600cdce123448f66a8f822c9b`.
Fresh build/typecheck log hashes are
`8310d8609379f72e11d63ed609d408218a5e6b4c77afeed8d4b8adf1d8d75980`
and `2ae156a15d965587bee970f855ec46f76c7b05c084e006061cccc5ce1ee21061`.
Formatting, whitespace and frozen-spec checks pass. All four predicate public
oracles retain their frozen hashes.

Public standalone generations5d7080c9→8fbfe669 retain identical source and
reconciled published hashes. Complete inequality/conjunction/disjunction now
fit8/13/13 bytes and13–14/13–20/15–20 nominal cycles, same-page at current placement.
Payload714→705 and resident768→759; SFA/ZP/scratch0, BSS54 and bounded stack2 are
unchanged. The exact summary `ar37-actual-artifacts.json` has SHA-256
`bc61934a2b6d4beba881c8774cac82bdb7bb88c77f5afb3e162a828157cf99e4`.
Full/saved artifacts are byte-identical to AR-P36 at2,442/2,271; all eight
unchanged whole cost cases remain RED. `ar37-whole.log` SHA-256
`986ab2f622b7c42ddab69c05ad8d5bc4d036ecee359cd5b93201fcf7132c6e8f`.

Independent correctness/output/SFA reviewers report no findings and clear the
exact bounded MC-015 defect. No general flags/availability proof or new optimizer stage was
added. Local meet has an explicitly tracked path to a whole-call win:
[#108](https://github.com/blendsdk/blend65/issues/108) records eligible JSR/RTS
elimination's4-byte/12-cycle delta, ABI/effect/storage proofs and independent
whole-artifact expectations. Issue creation is durably authorized by the parity
directive. No code commit/push follows while full gates remain RED. VICE-verified
/hardware-unverified, historical-integrity Unknown unchanged;38/48 remains.

#### Identical constant-return arms — existing layout consumer, RED first

Current actual key/query output repeats identical pure LDA#constant/RTS arms.
The deterministic correction uses the existing block-layout alias owner only:
share a single immediate byte load and ordinary return for equal constants;
preserve every old source label as an instruction-empty alias. Calls, loads,
stores, extra instructions, other terminators and unequal constants do not
qualify. There is no unresolved source/product contract, new pass, general tail
merging, proof model, runtime or storage request. Standing routine-correction
authority covers the existing consumer; no trivial user handoff is required.

A blind author freezes `source-library-shared-constant-return.spec.test.ts`,
SHA-256 `2d5ad0474accee24bf8ac7483740225b566f1625480d2a7dd1ec6d39e4e97871`.
Before code, eight static cases fail meaningfully at19/27 versus16/21 complete
bytes; eight sequential native groups over320 input combinations pass independent
value/order/bypass/SP/I/D assertions. `shared-return-red.log` SHA-256
`7afc795b62102a2dd93f37dcc6dd5fdbf5d71d0732abc4099eb2aa6a41f93fe3`.
Exact baseline `shared-return-layout-before.ts` SHA-256
`f6d85e960bdcc80e98e1e9a51bf0c37e12814eafc9c971fed3866a878e80e505`.
All prior oracles stay unchanged; selection/build/reverification and bounded
independent review follow. Whole limits, historical-integrity Unknown,38/48 and
unverified task2.2.8 remain unchanged; no RED checkpoint or push.

The implemented layout consumer retains every equal return label as an empty
alias to the first identical effect-free immediate-byte return. Existing alias
resolution and branch ordering consume these blocks; no new storage or stage is
introduced. Its both-shared-terminal tie keeps the shorter terminal first. An
intermediate private size expectation failed23 versus20; only that mutable
implementation expectation and its rationale comment changed. A subsequent
strong ordering assertion failed and was corrected in production, not weakened.
No exact pre-unit snapshot of that untracked private test was retained: its
two-region change is supported by the recorded patch, not a byte-exact old-file
projection. This limitation does not affect the frozen blind public oracle.

Final public10 files pass252/252, zero skips, including44 sequential native groups:
`shared-return-final-public.log`, SHA-256
`eac296cc53e1ed7acb0700db151a5d732a67866f787f7ed87b6b7278aa4c2275`.
Private four-file proof/fallback/layout checks pass43/43:
`shared-return-private-final.log`,
`d8cd1bdf0d8123aa599c139740eca51621c8cbabad7a002eb0940543ff966bf8`.
Complete compiler149 files pass2,148 with two existing unrelated skips:
`shared-return-final-compiler.log`,
`29c4c96f6a76b73651fe2f2625d87e8bdf9868e4d9df7a201c91e4afcbdf3b07`.
Fresh build/typecheck pass, respectively
`d09bb6625b8a62a5bc333fa7517037f79e41cb0e2a77837b05768cbb30557bcd`
and `c06bbec3cf802b9618cf7abff70cba254e52f432e14222eaea8c724d2e717f6c`.
Targeted formatting, whitespace and frozen-spec guards pass. All ten protected
observer/companion public files retain their frozen hashes.

Actual complete two/three-test leaves are16/21 bytes, with nominal paths
15/21/20 and15/21/27/26 cycles at their same-page placement. Public build/PRG
hashes reconcile. The summary `shared-return-actual-artifacts.json` SHA-256 is
`8577ee5f6170ed0087170b277f0d4da64d17f260520419231aa0e3a891e6eea5`.
Full code2,441→2,381 saves60 bytes, but padding1→61 cancels the saving: payload
2,442 and resident2,579 stay unchanged. Saved payload2,271→2,211 and resident
2,424→2,364 save60 bytes. Full SFA/ZP/stack/scratch63/6/5/0 and saved71/10/4/0
remain unchanged. Saved physical homes relocate through fresh closure/rebinding;
its closure hash changes without changing demands. Full closure is unchanged.

Independent correctness, SFA/ABI and emitted-code reviews report no findings in
this bounded unit. Runtime does not improve on every path: branch inversion
trades cycles, and saved soleGroundSource's columns-nonzero/rows-nonzero rejection
gains one taken-page cycle,21→22. Complete entry-to-return timing stays Unknown.
[#109](https://github.com/blendsdk/blend65/issues/109) owns the measured local-meet
path through eligible sole-call continuation specialization, reusing #108's seam:
an analytical, unassembled/unexecuted2-byte and9/12-nominal-cycle win candidate.
All eight whole-output gates still fail2,442/963 and2,211/725:
`shared-return-final-whole.log`, SHA-256
`07439e8051a41e41c18519d72affd145a48368caa43d6ea34176ac121269446e`.
Historical-integrity Unknown is not waived; task2.2.8 stays[~],38/48. No full
phase clearance, RED commit or push. VICE-verified/hardware-unverified.

#### Adjacent byte arithmetic/bitwise delivery — existing lowering owners

The next demonstrated ordinary defect is a byte arithmetic result stored and
reloaded immediately for a commutative bitwise consumer. Actual semantic
soleGroundSource operands are separate load identities of the same private
parameter, not one assumed source-name identity. Existing lowered value kinds
and closure distinguish private stable homes from registers or global labels.
The bounded correction will retain a sole-use constant-right byte add/subtract
in A only for the next byte AND/OR/XOR with a proved stable private/constant
operand. One intervening unselected direct byte load qualifies only if its
existing private home is known and no preplanned staging instruction exists.
Other operations, effects, calls, extra uses and words retain their old path.

A second exact emitted-prefix correction may remove a private LDA immediately
after STA of that same symbolic byte, only in a selected byte arithmetic prefix
and after an adjacent LDA/AND/ORA/EOR establishes A/N/Z. Labels, raw addresses,
volatile effects, byte-address transforms, stale flags and other producer forms
reject. This uses the existing scalar selector/appender, not a new availability
model, pass, IR, runtime or request. All decisions are deterministic routine
corrections under standing authorization; no material support surface is added.

Blind oracles freeze before production: output SHA-256
`3630d521e6c3302359389f1d3610106a859f51e6f06aeb930f1fb9562efd3c10`;
native SHA-256
`c08d744dbd10be89ecab2b0a2da0cfbd81637bd9a97aec6d3c4bf26f9eba048b`.
All20 output cases fail meaningfully at22/13 captured and16/10 parameter bytes,
zero skips: `byte-arithmetic-output-red.log`, SHA-256
`46842d766a214ca0c49428ec75e884bbf51863d3e09b99fa4188f98295f4e1d7`.
Prospective owner snapshots `byte-arithmetic-forwarding-before.ts` and
`byte-arithmetic-scalar-before.ts` retain exact hashes
`e515f16bbf91e068009a78eaba0d991cdf97ef836bc4d7eeaf910b23106b3188`
and `0c60fcca76feadc11d91681c32c00dce64eeae6ccaac10867415c46514942950`.
This unit's actual modified owners will also be retained before any edit.
Task2.2.8 stays[~],38/48; full2,442/963 and saved2,211/725 stay RED.
Historical-integrity Unknown remains unchanged; no RED commit or push.

The initial correction passes20 output cases and36 sequential native groups
(8,192 byte samples and36 word boundary samples). Subsequent index/flag-prefix
hardening builds successfully but requires fresh final tests. The caller supplies
the existing operation-loop index; no repeated block-prefix lookup remains.
Independent correctness/SFA reviews find no source defect, with final artifact
evidence pending. Output review records **MC-016, MAJOR**: captured13B/22cy and
parameter10B/18cy still exceed eligible terminal floors12B/22cy and9B/18cy.
The remedy is accepted under standing ordinary-code-generation correction
authority, not a budget waiver or a new support surface.

The stronger captured idiom is LDX source; STX original home; DEX/INX; TXA;
AND/ORA/EOR original home; RTS. It preserves the original capture home and the
single ordered source read. The parameter idiom omits STX and leaves its home
unchanged. Exact ordinary terminal-byte selection may dispose of X/C/V, which
the byte-return ABI does not promise; startup, IRQ and every NMI domain stay
excluded. Extra blocks/instructions/effects and non-byte returns fall back.
No last-use home repurposing, new storage, register-availability model or pass
is necessary. Before that production correction, an independent stronger
32-case oracle freezes at SHA-256
`7c14377d3bdee03c8999fbb18a139009561e4f932d21bd8282970e260bf7e76d`.
All32 cases fail meaningfully at13/12 or10/9 bytes, with zero skips:
`terminal-byte-output-red.log`, SHA-256
`a89f287bdd370354aa71592e1af26f3c6de49f91e10b84240d0153acc71141b4`.
The two original arithmetic oracles remain byte-identical. Current pre-terminal
owner snapshots retain scalar22e9c34895de78cd3fdbaf5950b94c8e841f1aaf4765f0a1e6f2f22309d60932
and function44214bc48496994f0ed5943ca6b34af5461183c69569ee1d55ac406645dd9b71.

Final correction uses the focused102-line `machine/lower-terminal-byte.ts`
selector at the existing machine-function boundary, before closure. It matches
the entire4/5-instruction ordinary main-domain byte/sbyte leaf, not a sliding
availability window. The original capture home is never repurposed. New
instructions carry actual CPU use/define facts and original source/read metadata.
All extra instructions/edges, indexed modes, distinct home identities/offsets,
address-byte transforms, startup and every IRQ/NMI domain keep their old path.
MC-016 is resolved by independently inspected actual12/9-byte leaves. Correctness,
SFA/ABI and output reviewers report no findings in the bounded unit. The final
expanded compiler run is parent-owned evidence; their earlier source reviews
inspected2,164 passing cases before the last11 private appender cases were added.

Current output52/52 and native36/36 groups pass, with zero skips:
`terminal-byte-output-green.log`, SHA-256
`e71fa46e4305dc78110ab8dba61d1ded938fa367e3595f41b452d209d0ded21d`;
`terminal-byte-native.log`,
`a0dbc44a81df5fe7b5082f846028306bd6b59dbd680ca70341dfbe2d8c2fc2f7`.
The latter independently exercises8,192 byte and36 word samples, including
intervening calls, multiple uses and later mutation of a separate capture.
All252 earlier public regression cases pass across ten files:
`terminal-byte-prior-public.log`,
`f4aa002fa162cd952bff253665748a26d41321eb2302f91aa96ed5c6a30d5a30`.
Private59/59 cases pass, including16 exact terminal,11 arithmetic appender,
19 existing forwarding and13 existing call-retention checks:
`terminal-byte-final-private.log`,
`2bae24a8d9baf9c134d4287fbecbe359737cf3ec437f75f0a43bb2b5eda1b60e`.
Final compiler151 files pass2,175 with two existing unrelated skips:
`terminal-byte-final-compiler.log`,
`41ccb915caa8139f763e8e2f1c4a52a1b66dd799a644624097dc32285b1b96a3`.
Final build/typecheck/targeted formatting pass, respectively
`16d34f7a0b2ca84be92a3ab41112f50726c220896228766e9b4b76608508a940`,
`d9fb158c1aab418a605b5a5e3b9305af9d2f2f59956deb0c56968f4ddbd5ba74`
and `785b1193c80d2aa6b49a962b529fe2bb0469b96a342efe813d242721f86d9deb`.

Actual summary `terminal-byte-actual-artifacts.json`, SHA-256
`7193bf283753ee2200caacc5c62f011ae8ad716e553bebff98aa33b127db6a3c`,
retains eight exact before/after generations and reconciles all56 published
artifact hashes/lengths with PRG bytes, debug spans and closure identities.
Captured leaf13→12B/22 nominal cycles; parameter10→9B/18 cycles. Their payloads
655→654 and664→663, resident706→705 and716→715 each save one byte. Capture SFA1
and parameter SFA2 including caller stage, ZP/scratch0, stack2 and padding0 remain
unchanged. These are local expert meets; [#110](https://github.com/blendsdk/blend65/issues/110)
records a4-byte/12-cycle analytical eligible single-site call-elimination win
using the existing #108/#109 seam. No inlining framework is authorized or emitted.

The preceding accumulator-delivery correction, not terminal-X selection, removes
36 code bytes and three SFA bytes in each whole input artifact. soleGroundSource
55→43 and keyState553→529 account for the36 code bytes. Full padding61→97 absorbs
its code saving: payload2,442 stays unchanged, resident2,579→2,576 and SFA63→60.
Saved payload2,211→2,175, resident2,364→2,325 and SFA71→68. ZP/stack/scratch stay
full6/5/0 and saved10/4/0. These four-profile complete budgets remain RED:
`terminal-byte-whole.log`, SHA-256
`2b565eaa47703a0ffe37317107aa4b751f80928703147db3651d4464e7f2cd7a`.
No universal runtime improvement or full100million-cycle qualification follows.
Whole2,442/963 and2,175/725 remain binding; task2.2.8 stays[~],38/48. Historical
AR-P33 integrity remains Unknown. No phase clearance, RED commit or push.
VICE-verified/hardware-unverified; expert2.0.4/frozen spec4.0 unchanged.

#### Captured unsigned byte comparison — meaningful RED and bounded scope

The next ordinary witness captures one volatile byte, conditionally calls a
clobbering helper, then returns the original sample. Its four equivalent bit-7
conditions (`<128`, `>127`, `>=128`, `<=127`) need no CMP after a fresh LDA.
The blind output/native oracles freeze before production at SHA-256
`eb9d7dc4b3a3413703ee8d25995fdbe14daaf9ce4226ae25843bf877a8706549`
and `636e46432b87d7f9855366800baf28f935e4a5b74bfd5c474029d78093f85497`.
All16 output cases fail meaningfully at20/15 complete bytes, zero skips:
`captured-comparison-output-red.log`, SHA-256
`3b4a152a2a015d5ac5d193dbf12efabceee847854aa3888b31780472094ff810`.
The independent strongest floor is15 bytes,13 nominal owner cycles without a
call and26 owner cycles plus18 helper cycles on the called path; actual taken
page penalties are separately charged. This is not a17-byte/looser-cycle waiver.

First correct the existing scalar appender's exact fresh-A/N/Z private reload
and branch-only unsigned-byte instruction selection. Retain the unconditional
original capture store and shared return until conditional-store source/debug
ownership is proved. A register returned from a call alone does not prove N;
signed, wide, materialized and other limits keep their old path. No new pass,
IR, request, ownership model or generalized availability support is authorized.
The prospective scalar/comparison/function owner snapshots retain hashes
`22e9c34895de78cd3fdbaf5950b94c8e841f1aaf4765f0a1e6f2f22309d60932`,
`576ff689e78ab88afd5ed908cfa1f35c3b2e82de936bd2beda47d8d2da077bb8`
and `b5b027c98c857d201cce0f1458b1abc7860aa654b060059b9d4e0bd443515aca`.
New selectors remain unqualified until independent runtime/cost checks pass.
Task2.2.8 stays[~],38/48; the whole963/725-byte and saved runtime bounds remain
binding. Historical integrity Unknown is unchanged; no RED commit or push.

Prefix-only build/typecheck pass. All16 native groups (4,096 byte samples) and
100 prior public output cases pass. Actual generation
`562e11b8-7548-4ef2-8e56-a78cede8a996`, build SHA-256
`2019ba36b90044083bb3787334822a89e54b72cd900d105a259ae3d08a99f1f5`,
emits the15-byte LDA/STA/N-branch/call/private-LDA/RTS owner, but no-call21>13
cycles keeps all16 complete cost cases RED. Independent output review records
**MC-017, MAJOR** for that avoidable private store/reload traffic. The called
path meets26 owner plus18 helper cycles; before20B/no-call27/called32+18.
The private endpoint is32 PASS/1 FAIL, not GREEN: a new ordinary returned-byte
`>127` case exposes the existing swapped-register comparator crash. A separate
blind public regression must fail before its deterministic lowering correction;
the failure is not a source limitation or an authorized test deletion.

Independent SFA assessment records **SF-001, MAJOR prerequisite**: conditional
store motion would make the current debugger falsely advertise a stale home on
the bypass edge. The smallest correction is an exact final-machine consumer
using existing source binding, certified home and instruction ranges. Existing
debug v1 already represents A, memory, unavailable and multiple same-symbol
locations. Partition this one complete leaf: initial source LDA unavailable;
branch/conditional STA entry A; JSR/post-call reload entry certified memory;
shared RTS A on both predecessors. Keep conservative SFA lifetimes, interference,
home and certificate untouched. This is a bounded existing-consumer correction,
not a general availability analysis, new metadata/pass/schema or allocation
model. Recover only unique retained cross-block operation ownership; function-
span return setup may remain honestly unassociated with a source operation.
New blind debug coverage precedes conditional-store production changes: its
16 cases freeze at SHA-256
`2af330cf8b99196791ff87f2e5d5f3d8c3b5f2fa07a82cbb5bb990d23e8da7c1`
and all fail meaningfully on falsely initialized-home availability before the
first capture/store, zero skips (`captured-comparison-debug-red.log`,
`395fa6bbc75b50f59eced33c6a3b2abd76fe07063635ba8c7fb6c70f793f3c13`).
The separate returned-byte public regression freezes at
`8f3dee0c9236081f3f809bdbf145d4c162ea7db9f793be652a485611373bd07c`
and already passes all16 groups/4,096 samples unchanged. The earlier private
crash does **not** prove a public-source defect: that synthetic fixture omitted
the real semantic-liveness producer, leaving A without normal retention facts.
Closed-call private cases now use the real `valueLifetimes` producer; explicit
outgoing-register flag tests retain their intentionally unretained setup. All35
private cases pass. No unrelated comparator canonicalization/fix was added.

The bounded conditional selector is now implemented but unqualified. It matches
the complete four-block main-domain byte leaf, its unique source-owned private
declaration/two direct reads and sole no-argument direct call. Parameters, globals,
address publication, extra instructions/edges and interrupt/startup duties reject.
The focused existing debug consumer matches final source-owned/certified storage
and partitions actual instruction ranges into existing unavailable/A/memory
locations. No global source-range mapper change is needed: original spans remain
truthful and the matched local uses final ranges directly, including null semantic
operation records. SFA and the conservative lifetime are unchanged. New baseline
terminal/evidence snapshots were retained before edits; independent re-review,
runtime, artifact and whole-output evidence remain due. No GREEN/phase claim.

The final static rerun passes all32 immutable public cost/debug cases, no skips
(`captured-comparison-terminal-static.log`). The exact complete leaf now meets
15 bytes,13 nominal bypass cycles and26 called-owner cycles plus18 helper cycles;
branch-page penalties remain separate. Build and typecheck pass. This is not
task/phase clearance: final native replay, retained artifact reconciliation and
independent review are still due. Review explicitly checks whether raw or
asynchronous source/platform observations can see the skipped private store;
no existing observer safeguard or private-display ruling is widened silently.

The final native rerun passes all32 groups/8,192 exhaustive byte samples, no
skips,56.22 seconds (`captured-comparison-terminal-native.log`):16 captured-byte
groups and16 unchanged returned-threshold controls. Six focused private shape/
fallback cases also pass. Public generation
`30933c29-b654-4123-943d-65455b88c68e`, build SHA-256
`34a3e88107e7f5cf7f0c46ffced52a1526ed0ca718814435e485b480412b7014`,
contains exact15-byte `ad003330098dd70a207609add70a60`; helper is11 bytes/18
cycles. All seven artifacts reconcile by hash and length. PRG/payload/resident
are679/677/728 bytes, SFA1/ZP0/scratch0/generated-stack4, padding0. The final
and preceding prefix generations remain inspectable; normal publication pruned
the original20-byte raw generation. Its previously independently verified
measurement remains recorded evidence, not a currently inspectable raw diff.

Independent output review resolves MC-017's measured cost defect for that exact
source, and the final debugger groups describe actual instruction-entry state.
Correctness RV-003 and SFA review identify a remaining MAJOR eligibility defect:
three named local uses do not exclude independent raw/indexed/asynchronous
observers of its home. The new comparison-prefix reload also needs that exclusion.
The routine repair reuses existing whole-program domains, complete SFA windows,
literal/raw/place/publication utilities and conservative fallback. Never use the
relocatable provisional address as final disjointness proof. Only this exact
initial fixed one-byte read may be exempt, and only for an exclusively-main
source owner; it precedes the declaration store and cannot itself observe that
store. All other potentially intersecting reads, asynchronous writes/unchecked
places, unknown banking or persistent RAM publication retain the original path.
No new proof model, metadata, pass, allocation policy or frozen/test exception
is authorized. A blind new observer oracle precedes the guard edit. No broader
eligibility, task, phase or whole-input clearance follows from local GREEN.

The blind observer oracle freezes at
`07f380c36372b665800bda4f3e924f31fbed5ac37b94dff015f5e084af66154e`.
All20 cases fail meaningfully before the guard edit, no skips
(`captured-comparison-observers-red.log`): ordinary runtime raw/unchecked-array
readers, generated IRQ readers/writers and persistent VIC RAM publication on all
four profiles. Legal check/build already pass; failure is the conditional save.
The existing eligible cost/debug/native/returned-call oracle hashes stay exact.
The authorized routine correction uses conservative existing observer facts, not
a new product or support mechanism. Code snapshots before this guard edit are
retained separately from the original selector/prefix snapshots.

The bounded guard is implemented. Both exact
consumers use the same existing-domain/full-window observer checks. Comparison
reload omission additionally ties the unique fresh read to its actual private
source save; missing facts retain the reload. Only the new comparison path is
gated; the inherited arithmetic appender is unchanged. The focused helper adds no
state/schema/pass and does not alter source diagnostics, SFA or layout policy.

Final correctness, SFA/ABI and output reviews report no findings for this bounded
repair. RV-003/SF-001 and MC-017 are resolved; this is not whole-phase clearance.
The guard requires actual source/read identity, complete domain/context coverage
and exclusively-main execution. It scans reached bodies and executable globals
against full admitted RAM/ZP windows, not a provisional capture home. Other raw
reads, escaping indexed accesses, asynchronous writes, banking and persistent
RAM publication retain the original save/reload path. The initial-read exemption
applies only to that exact operation. Both consumers fail closed; inherited
arithmetic remains unchanged. Guard SHA-256:
`26cffd79230a4117851178e7070a3e67dc6e5fd9fae31cc65a58c78c930e146d`.

Root-owned final evidence, all with zero new skips:

| Check                                        | Result                                   | Evidence log SHA-256                                               |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Cost/debug and blind observer controls       | 52 PASS                                  | `84750215ef6026b8f92faa1647f556c96721430f51fa2bd0d68c9ecf80697325` |
| Sequential native captured/returned controls | 32 groups/8,192 samples PASS             | `3dd85a2911c5b9d5c4d9fb3dbc1dbbaaddc15833f102d16b08b67bf574877a6d` |
| Focused private tests                        | 59 PASS                                  | `7df2ffea190e254e172e4234d231628f4dd453a15724e50c5c43d13fb7638af6` |
| Preceding public regression controls         | 100 PASS                                 | `cb9ba3ef6b3d525e2bf62cefe06a284b148e22453d92365d308826b456118d65` |
| Complete compiler package                    | 2,217 PASS/two existing skips, 153 files | `22178c4c4f79f072441d26f1aeb27d610f4f5ca5ffa9a8de2ba02deecd48d187` |
| Build                                        | PASS                                     | `bf888f37162a299a3871deed243b2902d89010fff3f2df1e9b649a5c28c334a2` |
| Production typecheck                         | PASS                                     | `7999a058f6ce48979a059d425e55e3e1a0f7555a364b86400eba0cbbe1c193da` |

Logs use the `captured-comparison-observers-` prefix under the existing metadata
evidence root. The20 blind controls prove assembled fallback preservation, not
exhaustive native asynchronous interleaving. Clone-based private selector
negatives are not isolated proof of their named predicate: actual-source identity
also rejects those clones. The independent source review and public observer
controls cover the corrected eligibility. No public oracle hash changed.

Fresh generation `237eee0a-5320-4d65-8b9c-95da3b42330f`, build SHA-256
`09b40f52a41f34a26715311c56c2c6aac835cad0d3246917ea72711278478e55`,
independently reconciles all seven artifacts. PRG, memory, debugger location/
range data and SFA closure match retained preguard generation30933c29. The
15-byte owner retains13 bypass cycles and26 called-owner plus18 helper cycles,
with actual page penalties separate. PRG/payload/resident679/677/728, SFA1,
ZP/scratch0, stack4 and padding0 remain unchanged. Summary
`captured-comparison-observers-actual-artifacts.json`, SHA-256
`9cfa63da7488e254c57776567a7f10bf95c2beeec8691fee670d053e3eff2745`,
records both inspectable endpoints. Original20-byte raw output was pruned by
normal publication; its prior independently verified measurement is historical.
[#111](https://github.com/blendsdk/blend65/issues/111) owns the local-meet path to
a whole-program win: proved sole-use helper expansion/dead retention can remove
4 bytes/12 cycles analytically. No general inliner or new proof model follows.

Fresh whole-input rerun remains8/8 RED: full2,442/963 and saved2,175/725 bytes,
`captured-comparison-observers-whole.log`, SHA-256
`0e8356fcc21eef0a887621b7707a1ca9008ca3c5352eb99819ac9e73ac197780`.
The saved100million-cycle bound stays binding and unqualified. Task2.2.8 stays
[~],38/48; RD-05/DEF-7 remain open. Historical AR-P33 integrity stays Unknown.
No phase clearance, RED commit or push; VICE-verified/hardware-unverified.

#### Constant-byte shift delivery — bounded existing-consumer continuation

Actual saved keyState contains a fixed three-bit shift followed by a private
expression-result STA/LDA before the unchanged declared local store. The existing
`selectRegisterForwarding` whitelist already supplies sole-adjacent byte delivery
to fixed raw and unselected scalar stores; constant byte shifts leave A available
but are absent from that whitelist. The next routine correction adds only a
known1..7-count byte shift at this existing owner. Keep the declared destination
store, parameter home, source read, evaluation order and actual CPU flags. Unknown
counts, words, nonadjacent/multiple uses, calls and selected destinations retain
their general path. No new proof model, pass, IR, register state, helper or ABI.

Before production, the implementation-blind author owns only new fixed-shift
delivery output/native oracles. All compiler/internal/stdlib/planning/evidence
files are forbidden; existing public fixtures and frozen CPU/language authority
are allowed. Root owns RED/GREEN, builds and sequential VICE execution. Tight
complete costs cover unsigned left/right counts1/3/7 and signed right1 on all
four profiles; parameter/caller/startup/storage accounting remains complete.
Zero/saturated counts are outside this local cost scope, not endorsed output.
This bounded ordinary-consumer correction is covered by standing compiler
approval; the ongoing task/batch effort waiver remains valid. Task2.2.8 stays[~]
and all whole-input/runtime/integrity gates remain unchanged.

The two implementation-blind oracles are now frozen before production edits:
output SHA-256 `fa2d22f5dff58a92f37416aa026a42d4323ce54b0fc149904c63c166a3b58711`,
native SHA-256 `213b90bff557731b701119714dbd2bc49779c604a8ca6a128c1d94f532bdf38d`.
Root executed all28 output cases:28 meaningful RED, no skips,4.87s. Counts1/3/7
cost14/16/20 bytes versus8/10/11; signed-right1 costs16 versus10. Retained
`fixed-shift-delivery-red.log` SHA-256
`fadea027aeaebcef4a6ff41f983f0becde23ed209047b8b6c60c2595ebb4d53d`.
Seven-bit endpoint extraction changes outgoing carry, so its three-instruction
selection is restricted to the existing complete ordinary main-domain void-leaf
boundary: original parameter load, seven same-source shifts, original fixed
store, return. No later flag/CPU-control operation, call or edge is admitted.
The ordinary adjacent-store handoff itself retains all original shift flags.
One sole-use same-width identity/reinterpret cast may carry that unchanged byte;
other conversions, dynamic/saturated counts and selected destinations retain
their current path. No new shared fact, model, runtime helper or storage request.

The existing forwarding owner now hands a sole-use fixed byte shift, optionally
through one same-width identity/reinterpret cast, directly to its fixed byte
destination. The prior dynamic terminal-return path is unchanged. First build
passes; unchanged output cases20 GREEN/eight count7 RED,4.74s. The existing
terminal-byte owner now matches only the complete ordinary parameter-byte/void
leaf described above and emits the official endpoint shift/load/rotate metadata.
It retains the original load/store objects, symbolic parameter home and source
spans before closure. Build, immutable output/native and internal controls are
pending; no phase or complete-input improvement is claimed yet.

Local qualification now passes all28 frozen output cases,48 sequential native
groups,63 directed private cases,164 preceding output/observer cases and52
preceding native groups. Full compiler:2,245 pass/two existing skips/155 files,
96.54s. Build, production typecheck, formatting and whitespace pass. Actual
seven-leaf probe `4bb79e42-27ce-4e04-80a4-656c00d4c03e` reconciles all seven
published artifacts:8/10/11-byte left and right counts1/3/7,10-byte signed right1;
16/20/20 and18 nominal leaf cycles. PRG820/payload818/resident876, SFA8,
ZP0/scratch0/generated stack2; the complete caller, marker and startup bytes
are charged. Native mathematical values, source read/write order/count and SP/I/D
pass independently; VICE-verified/hardware-unverified, not universal silicon
or exhaustive interrupt-interleaving proof.

Fresh exact-source whole builds reconcile seven artifacts each. Full
`1396e214-dd18-4d95-a102-e554bf2e4e3d` still costs2,442 payload bytes, resident2,574,
code2,333/padding109/SFA58/ZP6/stack5/scratch0. Saved
`5403fdc4-62ba-4521-a29a-75369734cb56` costs2,163 payload bytes, resident2,311,
SFA66/ZP10/stack4/scratch0. KeyState and snapshotCompatible each save six code
bytes; two expression homes disappear. Full alignment absorbs all12 code bytes;
saved payload saves12. The963/725-byte whole bounds remain RED, saved100million
cycles still binding, historical integrity still Unknown. Independent bounded
correctness/SFA/output review and local-meet debt registration follow; no phase
closeout, frozen edit, RED checkpoint or push.

All three independent bounded reviewers now report no findings: correctness,
SFA/ABI and emitted-output. They independently trace source/consumer/closure,
actual parameter overlays, final debug locations/ranges and all seven artifact
hashes/lengths. The combined probe's SFA8 is one safely shared parameter byte
plus seven conservative caller-capture bytes; each actual callsite still costs
15 bytes/22 cycles before its leaf, not caller parity. Full whole branch-page
predicates remain unchanged; saved relocation removes and adds taken penalties
in keyState, joystickState and soleGroundSource. Whole timing is Unknown here,
not uniformly improved. Both whole-input files rerun eight meaningful size
failures,8.58s; all other binding checks remain unwaived. Mandatory local-meet
debt [#112](https://github.com/blendsdk/blend65/issues/112) owns the analytical,
unassembled4-byte/12-cycle eligible sole-call expansion/dead-body removal route,
with marshalling/lifetime/effect/closure proof required; no general inliner.
The SFA review's required routing-file read exposed historical synthetic routing
distinctions, reported and excluded from decisive evidence; no qualification
answer or oracle map was used.

| Retained fixed-shift evidence              | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| 28 immutable output GREEN                  | `808faa48847288572eeee4dc8bde3a64a1c856a5536ed59f29eceab103d06c4c` |
| 48 sequential native GREEN                 | `d35413724274daead2caf5768ac0bbb4ae9e748c4f7e877c13c853e9a7a30fd4` |
| 63 directed private GREEN                  | `2a374c3843985ac62f4f46455df354e9f25608dbc605beb6425d1ed7c8e73a77` |
| 164 preceding static GREEN                 | `97fdbbf60ae5f657e8219db7dacb2b0a7fc7860a4a8be5db7a671aa180f0338e` |
| 52 preceding native GREEN                  | `db14d50714df452bd91404cf0e18d72d524f75aefe27cc7fc2e5e1608e1fd34e` |
| Compiler2,245/two existing skips           | `44e0c54c588cfd00bccc6676d6a11f8c39da796fb94a79f8cc28256c277f419f` |
| Build                                      | `2219ec2a8d98512a71ed21e3f408bd5d861b2380ea200f93633e93747ca9f368` |
| Production-only typecheck                  | `8cfad88f36bbfc80e855ad218fd8c0a05f2484219350c4f0e04df0de4f8cb03b` |
| Targeted formatting                        | `af649e13a9aec6bde821255b766b73bf63d5b2e930d4deed2c44b615b6fe900c` |
| Seven-leaf actual artifact reconciliation  | `90aa5e84b7708589d4aaa84e592316b6efcdb93826168b634e1dcf8f27a2381b` |
| Whole before/after artifact reconciliation | `c53f96a80072c19aaed9642b6b174808eacab09881bcb6cb46920c19806aaf36` |

These files live in the previously identified root-owned evidence directory.
Production owner hashes at review: forwarding
`348e53eae375e61d04aaa96c7b781511ebec74c2ac6b9212eee722da5376fc5f`,
terminal-byte `bdfffc48a8c7af26667f0a4f4982bf824d5cd23798b637621705d94d74a38f36`.
Frozen output/native hashes match their pre-code freeze. No broader mechanism,
source restriction, old-oracle change, historical-integrity clearance or phase
completion follows. Task2.2.8 remains[~],38/48; no RED checkpoint or push.

#### One-bit shift followed by OR1 — bounded existing-consumer continuation

The actual acquisition uses ordinary `(columnMask << 1) | 1`. A fresh fixed
byte shift leaves A ready, but the following constant OR is not in that shift's
existing adjacent-consumer whitelist. The next small correction admits only
count1 followed immediately by byte OR literal1, preserving sole-use and
optional same-width cast checks. The existing immediate byte-tail appender can
select exact adjacent accumulator ASL/ORA#1 as SEC/ROL: same final A/N/Z/C and
unchanged X/Y/V/D/I, no crossed read/store/call/flag observer or edge. Signed and
unsigned right1 retain their own shift/OR instructions. This is ordinary reuse,
not a new model, pass, IR, runtime, fact set or calling convention.

Before production, the blind author owns only two new one-bit-shift/OR output
and native files; the same compiler/internal/library/planning/artifact forbidden
boundary applies. Independent strongest complete costs include the declared byte
parameter, final destination/return and RTS; full caller/startup/storage remain
charged. Existing shift and earlier oracles remain frozen. Root owns RED/GREEN,
private checks, full verification and sequential VICE. Existing standing approval
and ongoing task/batch effort waiver cover this routine correction. All complete
input/runtime/integrity limits remain unchanged,38/48 and task2.2.8[~].

Before code, the blind output/native hashes freeze as
`cafe2bed4bf12ec754ca1e52b65b83a3b1d8f26df0c4d170e7f46f0ee0eb6e69`
and `7c8e2676de1348dfe8f4405563653c548a2dc6252caa6ab5d7417d9d800b1ec5`.
All36 complete output cases reach meaningful size RED, no skips,5.68s;
`one-bit-shift-or-red.log` SHA-256
`4f811cb089be6092c6e8a9b38b11658f02dcf9aaceed8897b8f85cc1fd737965`.
The signed expression has an ordinary same-width byte cast after OR1. Reuse
the same exact sole-use identity/reinterpret handoff for OR literal1 into an
immediate fixed byte destination or ordinary return; do not broaden other casts,
operators, selected places, additional uses or nonadjacent consumers. To keep
the forwarding module below700 lines, move its existing immediate byte-tail
appender into the existing scalar owner, preserving XOR/AND/XOR behavior. The
current CPU facts select official SEC/ROL metadata; no new module, pass or fact.

The three existing production owners now implement that exact handoff/cast/tail
selection. The immediate bitwise appender moved without changing its older XOR
composition; its caller supplies existing selected CPU facts for SEC/ROL. No
semantic, library, call/storage or debugger model is changed. Forwarding/scalar
remain below700 lines. The old private chain test changes only its import and
CPU argument. Build and frozen output/native qualification are pending; this
is not a verified checkpoint or whole-input clearance.

Root local qualification now passes36 immutable output cases,56 sequential
native groups,108 directed private cases and216 preceding static cases. Full
compiler:2,254 pass/two existing skips/156 files,97.84s. Build, production-only
typecheck, targeted formatting and whitespace pass. Native value/effect oracles
cover all256 byte inputs and263 word samples with dynamic-count, multi-use,
clobbering-call and indexed-destination controls. The output and native hashes
still match the pre-code freeze. Prior native regressions and all three bounded
independent reviews follow; no full-root or phase GREEN is claimed.

Actual standalone generation `d10e74a5-8696-4df3-89ae-99222db7c44d` reconciles
all seven artifact hashes and lengths. Complete return leaves meet6/7/9 bytes
and14/14/16 nominal cycles for unsigned left/right and signed right; each fixed
store adds3 bytes/four cycles. PRG875/payload873/resident933, SFA10,
ZP0/generated stack2/scratch0. Whole full generation
`35d03ca9-6d0f-41e1-b4ad-ab5fbeda118a` reduces readInputSnapshot326→319 and
code2,333→2,326, but padding109→116 absorbs all seven bytes. Payload2,442,
resident2,574, SFA58/ZP6/stack5/scratch0 remain unchanged. Saved generation
`e2e07cfd-3576-4fa0-a48e-c12845150737` has the identical PRG to its prior
generation: payload2,163/resident2,311/SFA66/ZP10/stack4/scratch0. The whole
963/725-byte bounds remain RED; saved100million cycles stays binding. Review
agreement cannot qualify those whole endpoints or clear historical integrity.
VICE-verified/hardware-unverified remains the bounded execution status.

All92 preceding native groups now pass sequentially,146.41s. Fresh whole-input
rerun remains eight meaningful size failures,9.83s, with unchanged963/725 caps.
Independent correctness and SFA/ABI report no findings; output review is pending.
The standalone's SFA10 is one overlaid parameter byte plus nine caller capture
homes. The full input loses the logical `readInputSnapshot:v55` request/debug
symbol while overlay preserves physical SFA58; its closure hash correctly
changes. Saved PRG, closure and storage symbols remain identical. Mandatory
local-meet debt [#113](https://github.com/blendsdk/blend65/issues/113) records the
measured current15-byte/22-cycle caller setup and the analytical9-byte/14-cycle
adjacent scalar-call candidate (6 bytes/eight cycles/one capture home saved),
then the eligible4-byte/12-cycle sole-call selected-body route shared with#112.
Neither candidate is emitted/native-qualified or a general-inliner authorization.
No routine approval pause, whole-input waiver, RED checkpoint or push follows.

Independent emitted-output review now also reports no findings. All three
bounded reviews are clear. The exact acquisition mask update at$0FA3 changes
15 bytes/20 nominal cycles to8/12, saving7/eight per execution. All listed
full-program branch-page predicates remain unchanged; no full timing guarantee
follows. Output review independently verifies every actual PRG slice, label,
parameter location, source/debug range and published artifact. Its preceding
routing synthetic-summary exposure remains disclosed/excluded; no grader or
qualification input is decisive. No new old-oracle exception or support model.

| Retained one-bit-shift/OR1 evidence        | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| 36 immutable output GREEN                  | `5b9417f59bd7fd12cbb6deb4c972c5755aee4c0b84e653e526b6d83ae1a7cd68` |
| 56 sequential native GREEN                 | `145d106ac99db53ed18fddac4020b4684bced11566b938e65dc20f703bbb0a1f` |
| 108 directed private GREEN                 | `88110990c30eee340b292b0ac85c89c412c42580afdabe077890796faaa5611d` |
| 216 preceding static GREEN                 | `3962b2bbed39f86bca2cc8d4fa6db92a753e2a21755e8336a23c2f9fb8b1541d` |
| 92 preceding native GREEN                  | `b9a0f91f295329f026e188ffc624878dc3e6db576566a063f251b4bac8b67d8f` |
| Compiler2,254/two existing skips           | `b0f4f2ea1869f25292f1aff33aeb444e2f8bdbd4b5cf74819d6d6fae1413b9c4` |
| Build                                      | `d8da8706d0888eedaa35f5ee4e5fdb3cb16b546be76c96a471b8bf8fefec062b` |
| Production-only typecheck                  | `bee239c65b7d5f5603ab4d8d6ee53c9c7b32739f3f181c6a4b413596b4bb864d` |
| Targeted formatting                        | `0acf8af13ed4391ef9884f31835f4c53c94b6796a376827b1952bb5d7e010a9d` |
| Standalone artifact reconciliation         | `1865aa917ed09dc6fa111aba6e2100de769e79f2033ab885a0b4d5e8349cfe64` |
| Whole before/after artifact reconciliation | `8d2dee183ec02c2109999225d29268776d37ec6a16a18af217b5120c40ee6115` |
| Eight whole-input RED cases                | `acf4e574bc509f7ce1d7255d48be455ec944f07b3b4a91f47ca36a35240d406c` |

Production review hashes: forwarding
`687840415c5658363b05759f05dc0b9eec716d4259d997dea12281dd5996a5cd`,
scalar`c8cf54aff99f184c9e001c1a292406e53852a768f370ef45cd57eccc9228a40c`,
function`e35ed415af47ee3b78e725cdee51c146369de8d95d7503e725a7b13312a8cea1`.
Frozen specification hashes remain unchanged. These files are retained in the
identified root-owned evidence directory. Task2.2.8 stays[~],38/48; no RED
checkpoint, automatic push, historical-integrity clearance or phase completion.

#### Adjacent scalar-byte call delivery — bounded existing-consumer continuation

The actual standalone caller retains an immediate source byte, then reloads it
solely to copy it into the known callee's declared byte parameter. The next
bounded correction reuses the existing adjacency/sole-use selector and the
existing direct-call marshaller: keep only one scalar byte argument in A until
the first parameter store. Require the known exact one-byte parameter and one
argument; same-width identity/reinterpret casts emit nothing. More arguments,
indirect or unknown calls, wider/nonidentity conversions, clobbering gaps and
additional uses retain their stable path. No parameter ABI, invocation-private
storage, generalized call/register facts, helper, IR or optimizer pass is added.

Two new blind source/output/native files are authored before production using
only public fixture interfaces and normative semantics. Root freezes their
hashes, runs meaningful RED, implements inline and owns all expensive execution.
The ordinary caller's complete target is10 bytes/20 nominal cycles for a source
load and10/22 for a call-produced byte, with callee, parameter, caller return,
startup and full artifact costs separately charged. This is not whole-input
parity, a general inliner or permission to edit an old oracle. Standing routine
approval and the ongoing task2.2.8 effort waiver apply; new specification/RED,
typed parameter grounding, regressions and independent reviews remain due.

The blind author supplies12 output cases and32 native groups/8,220 sample
invocations. Initial draft SHA-256 values are output
`9f0516b859173254adb7f2c71ad28d31a0b4c03c079cbafedf32ce97fa0ad2f7`
and native`bd34917a13d7fcf6d0f325d5dfad772b9830f12d653a6dbdecb7ac7526e4f96f`.
The first root run fails all12 before cost observation: the draft gives short
`Game.*` names to public helpers requiring exact `sourceId::qualifiedName`.
This is not meaningful optimization RED and does not authorize production.
The author corrects only those observer identity strings in the two brand-new
drafts to `src/game.blend::Game.*`; all source, limits, cases and behavior/resource
assertions remain. Root retains this invalid-observer log, reverses the exact
prefix-only correction against the original hashes, refreezes and reruns before
implementation. No existing specification test or production expectation changes.

The exact prequalification identity correction refreezes output/native as
`660ddc486494a152a12c43af03c6f82ef5307325193c430c6377f3c238b66b98`
and`a99400489f195331436f156d8d9102aa1fb127fc8ea096560cc657d38a5764c3`.
Reverse-prefix plus deterministic output formatting recovers both original
hashes; native reverses byte-for-byte. The retained invalid-observer run's hash
is`5e91ce39d06cfb4e6a2d854e8912051c7276a452db8381a3f737e90057230c53`.
All12 refrozen output cases then reach meaningful cost RED: complete caller16
bytes versus10,3.27s. Log`byte-call-delivery-cost-red.log` SHA-256
`38fd47850e0a2991fda3d78ac8c5f7072705cf8fb741c20b363b6caab6152b93`.

Only after that RED, the existing direct-call owner adds a small pure signature
check for its one declared scalar/enum byte parameter and sole argument. The
adjacency owner uses those existing closed declarations and permits at most one
sole-use same-width identity/reinterpret cast. Its existing retention and direct
parameter marshaller remain unchanged; result-address setup happens after the
argument is consumed. To stay below700 lines, the unchanged byte-return-arm
recognizer moves from forwarding to the existing terminal-byte owner; only its
existing private test import changes. No new module, fact model, storage or ABI.
The first build identifies only an optional next-operation type annotation; the
explicit union fixes it without changing selection. The first output run then
passes eight direct-read/signed cases and fails four produced-byte cases: the
producer's complete body is10 bytes versus4 because its final byte read is
needlessly stored/reloaded before the ordinary byte return. The same existing
terminal handoff now admits a sole-use width-one memory read immediately before
its own return, with no intervening emitted operation. Wider reads, extra uses,
nonreturn terminators and gaps remain conservative. No oracle is amended.
All12 immutable output cases now pass,3.28s. All32 native groups/8,220 sample
invocations pass sequentially,56.25s, including the nonvacuous indirect and
effectful multiargument controls. The14 new focused private cases and97 existing
checks pass across eight files,111 total,3.59s. Fresh complete compiler regression
passes2,268 tests with two existing skips across157 files,89.15s; verified build
passes. Independent correctness/output/SFA reviews report no findings for the
bounded handoff and preserve the separate terminal-wrapper debt. Preceding
regressions pass252 static cases across10 files,33.42s, and148 sequential native
groups across four files,233.11s. Production typecheck passes. Task2.2.8
stays[~],38/48; no whole clearance follows. Root reruns the existing saved-simple
runtime gate at its unchanged100million-cycle bound after the preceding output
repairs. All four profile cases pass,263.15s, with zero skips. Each profile
completes1,089 observations and74 named queries per observation:4,356 observations
and322,344 independently expected answers overall. Every11-byte saved object
remains unchanged. The test source, fixture, cycle bound and expectations are
untouched; this current runtime pass supersedes the earlier monitor-closure
failures, not their historical record. It does not clear the complete-size gates,
establish exact whole-program timing or qualify physical hardware. Evidence:
`byte-call-delivery-saved-simple.log`, SHA256
`e5220025141838a882f1a748d7af574e009aa549b21adb2c71216dd57236dd20`.
The remaining eleven input behavior files are now being rerun sequentially.

The unchanged nine-leaf ordinary probe's actual seven-artifact reconciliation
changes generation`d10e74a5-8696-4df3-89ae-99222db7c44d` to
`e23419e1-6458-421e-aea1-94fe70b6a392`: payload873→819, PRG875→821,
resident933→870 and SFA10→1. All nine caller expression homes disappear; the
one declared overlaid parameter remains. ZP0, generated stack2 and scratch0
stay unchanged. Caller156→102 bytes; each source-to-parameter call setup drops
15→9 bytes and22→14 nominal cycles before the unchanged, separately charged
leaf. Return-result delivery adds its original3 bytes/four cycles. Startup,
restoration, markers and leaf lengths are unchanged. No general inliner or
new call convention accounts for this ordinary-program reduction. #113 still
owns the subsequent eligible whole-call/dead-body route beyond the local meet.

Fresh whole full/saved generations`c6fa559a-ac1d-452a-9cdd-2332a30f5201`
and`5c6f001f-ee39-4290-859f-6a090dc55f31` retain payload2,442/2,163,
resident2,574/2,311, SFA58/66, ZP6/10, generated stack5/4 and scratch0.
Current summaries retain complete actual generation identities, byte hashes,
source/debug ranges and resource sums under the root-owned evidence directory.
All eight complete-size cases freshly remain RED,8.58s. Whole963/725-byte bounds,
saved-simple's100million-cycle bound and historical pre-AR-P33 oracle integrity
remain unwaived. Whole timing is Unknown;
VICE-verified/hardware-unverified. No RED commit or automatic push.

The subsequent complete three-file output rerun includes acquisition's separate
observer:all12 cases remain RED,13.10s, at unchanged full2,442/963 and
saved2,163/725. No later resource or route assertion is counted as passing when
its earlier size assertion fails. Evidence:`byte-call-delivery-all-input-output.log`,
SHA256`1d8098c9bbc827af513eda325524d8ec4604a118b6cc8f7a1b74ddb2edcbb57e`.
The required emitted-output auditor is examining the actual whole artifacts for
any overlooked high-impact direct correction using existing facts only. This is
not an independent complexity verdict or authority for new borrowed-RAM
provenance, an inliner, a register model or an output-budget change.

Root orientation accidentally printed routing's historical smoke footer, and
the new correctness reviewer initially extracted extra release gate summaries.
Neither is used as decisive behavior/output/oracle evidence; review uses only
normative authority, exact bounded diffs, immutable new oracles and current raw
artifacts/logs. Reviewers are told to exclude qualification/grader/maps.

The correctness reviewer independently reverses the exact draft-only observer
prefix change and applies the actual repository formatter configuration
(`printWidth:100`, not the formatter default) to recover the original output
draft hash. Native reversal recovers its original hash byte-for-byte. Both
refrozen hashes are unchanged; no oracle-integrity finding survives. SFA review
also verifies all nine declared parameter/debug locations at$0B65, their own
leaf lifetimes and source read→LDA / call→STA+JSR ranges; nine actual capture
homes and their debug symbols disappear. Output independently reconciles all42
published artifact hashes/lengths across six before/after generations and every
listed body against PRG bytes. Both whole programs' seven published artifacts
are byte-identical to their respective baselines, not merely equal in size.

The isolated caller setup9 bytes/14 cycles is not a universal complete-wrapper
floor. Under this unit's unchanged JSR/RTS topology, the terminal wrapper costs
10 bytes/20 cycles plus its7-byte/14-cycle sink. An analytical terminal JMP
route costs9/11 plus7/14, saving one complete byte/nine cycles; exact cleanup,
domain, terminal-entry and representation-observer proof remains due. #113
owns this same complete-call debt and the stronger eligible sole-call/dead-body
four-byte/12-cycle route. Neither is assembled/executed or authorized by this
consumer unit. Its RTS observer is not a permanent language restriction or
permission to block a separately proved future optimization.

| Evidence                     | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| Output12 GREEN               | `dd46745dcccda4a3ea3f1826841857d25e97684dde0caba477862c0f6a465d4d` |
| Native32 groups GREEN        | `023ef79966524df2253a8268c370e70feada3c16c6534dceac73508688b2459a` |
| Private111 GREEN             | `a404ce9c0745d12663e2434cc4e0a8a5a95c49c79e2b5959a77b89ead6c2f63b` |
| Preceding static252 GREEN    | `db7e40db1242a0a312034ab19ac04c03ff49faf7b82e26fe4e60c3615978ff79` |
| Preceding native148 GREEN    | `5d7502179bbad5d585f30028d2d380e660b7e85156ca231bcee9984bd957f4da` |
| Compiler2,268 PASS/two skips | `2ff5984659da3de9d1006afb58b90a66708eebb32859fb26f841c6e8805cd4d2` |
| Verified build               | `de1a564f8270d997c361841ebc0e158229cbc956218a13a33a92670551ba6ad5` |
| Production typecheck         | `c8e54f82fbbd58aaa5d8034b017d1e7c7a326e269f18a27e54f4bce31b330327` |
| Standalone actual JSON       | `bb7d2c57c2b62c1195c4b1bd30f7a77d46a9436c506c0a3dff29541eb668caa0` |
| Whole actual JSON            | `70ebc29b39e9aeceb190f143ca5728a5b257abd56e29545ce4abe012bf3f22b0` |
| Whole eight-case RED         | `3bb28143a6857fe85188dd05bce19b888f398329630e87293f93d2101860306b` |
| Saved-simple four GREEN      | `e5220025141838a882f1a748d7af574e009aa549b21adb2c71216dd57236dd20` |
| All input output twelve RED  | `1d8098c9bbc827af513eda325524d8ec4604a118b6cc8f7a1b74ddb2edcbb57e` |

Reviewed production hashes: direct-call
`f71adfda783bb6621a4d135120c69c633a931feb7eb69b9cdc292813bff37ba7`,
forwarding`2b0d00148b6128088ee86447956f7d20a85b62aacd6824dd92b751ad72b2dad3`,
terminal`0f9b4abdf670bd3122483d8a701a60bebed62172ff8eb320c66398fdb8819898`,
function`0039dd8b673526c41da970dd36a69c335160d454a8ca23b0954202a189700f5a`.
New private hash`350418774cc17b2500aaf0605767e75e2f558590261a14ce630b4529f4b7dfa2`.
The recorded five prediff owners exclude all inherited dirty work. The old
private test changes only its relocated-helper import, not an assertion. No
frozen spec/expert change, protected old-oracle edit, RED commit or push.

#### Whole-input residual output audit

The current unchanged behavior rerun finishes72/72 cases across11 files,
zero skips,1,905.34s. Saved-query purity, invalid-enum/no-outside-access guards,
contact/grounded/component classifications, acquisition/unavailable routes,
eight complete timer cases and eight NMI-predecessor ownership cases all pass.
Together with saved-simple's four current passes, all76 behavior cases in the
original fifteen-file input set pass at the same production endpoint.
The remaining12 cases fail the complete-size limits; no later assertions are
counted as passing after those failures.

Evidence:`byte-call-delivery-input-behavior.log`, SHA256
`fd401f90311de6083567c12050da3deee1e0826b5c70ffbdd727296541a83b40`.
The slow purity trace remains intact; no timeout, cycle limit, fixture, tracepoint
or expected value was changed. All native cases ran sequentially.
No whole-phase, unrestricted timing or physical-hardware claim follows.

The required read-only emitted-output auditor independently reconciles the
current full/saved manifests and records these surviving necessary findings:

| Finding              | Current emitted work                                                                                                        | Analytical alternative / decisive limit                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MC-017 MAJOR         | Three two-complement bitwise tails each22 bytes/28 nominal cycles; full addresses$0B04,$0CD2,$0D2C, saved$0B9E,$0D6C,$0DC6. | ORA the same grounded-row home, EOR#$FF, then the same named store is8/10:42 code bytes prospective. A related common-mask tail adds14 prospective bytes. Earlier borrowed reads/bus behavior stay unchanged. Semantic sole-use identity is not established by allocation IDs; new exact selection/oracles are due and not executable under the current constant-RHS whitelist. |
| MC-018 MAJOR         | Three dynamic byte shifts end in expression STA/LDA then declared-local STA; full$0BBD,$0C45,$0DC9, each9/12.               | Direct named STA is3/4,18 code bytes prospective. The removed LDA refreshes N/Z after DEX/CPX: those flags are dead only when the actual next instruction refreshes them before use. Existing source-use/adjacency must be checked; no generic flag ownership is granted.                                                                                                       |
| Word update boundary | Four full/three saved same-local word updates compute a2-byte temporary then copy back,29/38 each.                          | Direct declared-home carry chain is17/22,48/36 code bytes prospective. It writes the declared low byte earlier; current byte-capture proof cannot certify this observer boundary. Different-local initialization is excluded. No code is selected.                                                                                                                              |

These are analytical instruction deltas, not assembled/executed replacements,
actual payload/residency wins or a design-challenger verdict. The current whole
artifacts retain full2,442/963 and saved2,163/725 deficits1,479/1,438 bytes.
The auditor finds no existing-facts correction that closes those deficits.

Correct complete startup/restore attribution is659 bytes full and699 saved,
not the609-byte base. The additional50/90 bytes preserve five/nine actually
allocated ZP bytes under the unchanged ABI. Full payload reconciles as
1,543 library query/acquisition bytes +112 main/NMI wrapper +659 startup/restore
+12 BASIC stub +116 padding =2,442. Current resident2,574/2,311, SFA58/66,
ZP6/10, generated stack5/4 and scratch0 remain unchanged.

[AR-P38](00-ambiguity-register.md#ar-p38--whole-input-cost-closure-exceeds-the-current-proof-boundary-runtime)
records the missing next design/complexity authority, not an executable proof.
Current execution-run challenger budget is exhausted; this output auditor does
not replace a fresh independent complexity verdict. Tasks2.2.2–2.2.6 and2.2.8
are now visibly blocked with implemented work preserved; four2.3 tasks remain
pending. Progress stays38/48; RD-05 waits on DEF-16. Portfolio cascade is deferred
on the non-integration branch. No source workaround, wider proof model, cost
waiver, frozen/old-oracle edit, RED commit or push.

- [ ] 2.3.1 Add `test/rd05/input-library.impl.test.ts` for actual private helper/callback reachability and selected-home closure after GREEN; reuse current typed/build evidence, not a new validator.
- [ ] 2.3.2 Execute ST-18–ST-23's exact-source four-profile native qualification sequentially; record matrix/joystick/NMI/RESTORE, restoration, full cost and proof limits in `09-closeout.md`.
- [ ] 2.3.3 Update `docs/platform-libraries.md` and complete the scoped deferral-expiry/ownership check in `09-closeout.md`; [01](01-requirements.md).
- [ ] 2.3.4 Run full verification and independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance reviews; resolve findings through their normal gates, record `10-phase-2-review.md` and update index/progress/roadmap.

Verify: root install/build/typecheck/full tests, sequential actual VICE cases,
targeted formatting, whitespace and exact immutable/old-oracle guards. All new
specifications execute without skips. Reviewers independently inspect the actual
phase baseline/diff and evidence; authors do not review their own oracle.

## Completion and resume boundary

All 48 tasks and [01's completion evidence](01-requirements.md#completion-evidence)
must be satisfied. Plan/preflight acceptance is not runtime or parity acceptance.
Any necessary larger mechanism, new API, source limitation, frozen change or
old-test exception becomes the next exact AR-P item before implementation.
RD-05/DEF-7 remain open unless their separately owned remaining work completes.
No automatic push, host release claim or physical-hardware certificate follows.
