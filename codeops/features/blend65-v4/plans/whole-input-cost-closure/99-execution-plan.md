# Execution: whole-input cost closure

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-15 13:58 CEST
> **Progress**: 9/40 tasks (22%)
> **CodeOps Artifact Schema**: 1

## Objective and ownership

Execute the approved AR-P4 prerequisite and PF-001–PF-003 corrections only after full-plan preflight. The
requirements, exact permitted exception and component specs are linked from the
index; this document owns progress, not a duplicate behavioral specification.
The root agent owns tightly coupled implementation and all expensive verification.
Spec authors/reviewers are independent and use bounded packets. Preserve the
inherited dirty tree and record a complete temporary-index phase-start snapshot
using the exec-plan workflow. No automatic push or frozen-authority modification.

## Implementation phase

| Phase | Scope | Tasks |
| --- | --- | ---: |
| 1 | Closed facts, bounded selections and complete input qualification | 40 |

> **Execution rule:** this checklist is the only task-progress authority. On
> implementation mark `[~]` with actual time; on directed verification pass mark
> `[x]` with actual time and result. Only `[x]` counts in the progress header.
> Update progress/time after each task. Resume the first `[~]`, else first `[ ]`;
> a blocked task is `[!]` with its exact reason. Do not duplicate task lines.
> Local task verification is not phase completion. No RED composite checkpoint
> may be committed; this phase closes only after all original/new tests and its
> complete quality loop pass. Commit at coherent GREEN checkpoints through the
> git-commit skill; push only on a new explicit user request.

### Phase 1

> **Phase baseline tree**: `e221a08c894bd1a8b1a505115f437de2c5582e76`
> **Execution entry**: 2026-10-12 22:29 CEST; preflight identity `2e1afb628ec58b687acadca59a390077fa4fc4413054cb23601dcc38ab5f31bf` matched before task/progress edits
> **Scope mode**: strict — original input behavior/963/725-byte limits, approved AR-P4/PF-001–PF-003 only
> **Lenses**: correctness, maintainability, standards; api-surface, concurrency, perf, security
> **Risk**: critical — storage/interrupt/effect corruption; base + relevant independent domain review

Expected modification set: the exact production files named in Session 1.2 and
the three 03 documents; the seven new specification files, exact four-file
AR-P4 exception and adjacent implementation tests named in Sessions 1.1/1.3;
this plan's progress/closeout/review documents, `docs/platform-libraries.md` and
the owning feature/keyboard prerequisite status. The separately approved RD-03
paragraph correction already exists in the baseline. All other pre-phase dirty
work is preserved and excluded from this phase's review diff. Frozen authority,
dependencies, unrelated oracles and the portfolio remain excluded.

Minimum-sufficient checkpoint for 1.1.1: one new specification file using the
existing public compiler, profile/VICE helpers and CLI process pattern. No new
test runner, fixture registry, production code or generalized helper is needed.
The /tmp inventory contains only the ten retained CIA2/NMI evidence directories;
no disposable item created by this continuation was found or removed.

#### Session 1.0 — Approved necessary baseline-host prerequisite

AR-P6/AR-P7 received direct exact approval on 2026-10-13. The correction-start
worktree tree is `59a5883af6ad08733e5a851843a22c19ba0e3a32`; the original phase
baseline above remains unchanged. These three added tasks are a necessary
baseline correction, not size implementation or a new solver. Existing frontier
specifications and retained source/RED/profile evidence precede production edits.
Only the four existing storage files in AR-P7 may change. The independently
authored AR-P6 correction remains within task 1.1.5 and its one approved function.

- [x] 1.0.1 Confirm the existing frontier spec/reproduction RED evidence, run unchanged storage tests and capture a tractable canonical-none artifact identity before edits — existing frontier specification and this journal; AR-P7. ✅ (completed: 2026-10-13 15:28 CEST; 24 unchanged storage tests pass; existing frontier rejected-reference case remains meaningful RED; retained 32/72 profiles remain stall evidence; legal four-call none build/artifact hashes captured before edits)
- [x] 1.0.2 Apply the independent-group weighted accounting upper bound and the witnessed required-ZP impossibility lower bound only — `packages/compiler/src/storage/closure.ts`, `packages/compiler/src/storage/allocate.ts`; AR-P7 exact scope; exact enumeration/fallback and outputs unchanged. ✅ (requalified: 2026-10-13 15:53 CEST; fresh build/typecheck and75 storage tests pass; final six files byte-identical to retained pre-refinement generation and match original hashes; dense redundant-bound cost removed, one bounded fix review clear)
- [x] 1.0.3 Add the approved independent graph/allocation checks in existing `closure.impl.test.ts`/`sfa.impl.test.ts`, verify old tests and unchanged-none identity, measure unchanged 32/64-site and 72-chain endpoints, and obtain bounded independent implementation reviews — AR-P7; this journal. ✅ (completed: 2026-10-13 15:53 CEST;43 directed/75 complete storage tests pass including1,024 independent graphs;32/64 sources succeed and72-chain returns known allocation failure promptly; base/SFA/performance/output reviews have no findings, one dense-cost refinement review clear; exact outputs preserved)

Verify: directed existing storage/frontier tests with fresh built dependencies,
exact before/after identities, elapsed time and RSS. No source, output, resource
limit or timeout amendment. If the bounded remedy is insufficient, report its
actual endpoint; no extra solver or machinery is silently added. Full phase
verification and its review gate remain mandatory later.

Baseline evidence: `ar-p7-storage-baseline.log` (24/24),
`ar-p7-frontier-baseline-red.log` and `ar-p7-none-before-identities.log` in the
retained evidence directory. The first manually transcribed identity fixture
used invalid struct/declaration spelling; that source failure is retained as
`ar-p7-none-before.log`, not a successful baseline. The corrected ordinary
four-call source builds successfully (`ar-p7-none-before-corrected.log`), with
complete emitted assembly/labels/PRG/memory/costs/debug identities recorded.
The profile/72-chain reproductions and their prior CPU profiles precede this
correction; no new specification or limit is manufactured to ease the search.

Dense-graph cost check: actual current 256/512 overlapping-RAM closures return
exact peaks in 1.216/9.303s, including the unchanged allocator. An isolated
before/after measurement of the exact accounting function from the pre-fix
Git tree/current source (Node type stripping in memory, no new file/export in
the product) distinguishes extra bound cost: 256 vertices19.3→108.8ms and
512 vertices53.7→791.9ms. This is a real dense-case slowdown, not waived.
The local refinement skips only the added bound when the entire graph is
complete: independent grouping is then provably no tighter than the existing
additive bound. Exact stable search remains unchanged. No new heuristic cutoff,
solver, module, public API or resource result. Logs preserve the original
measurements and the failed initial TypeScript-API probe; fresh qualification
and one bounded fix review of this refinement remain due.

Final AR-P7 qualification: all75 storage tests, build, typecheck, targeted
formatting and documentation/reference checks pass. The complete first review
diff is `59a5883af6ad08733e5a851843a22c19ba0e3a32`→
`f0219a2776fd8384ace2738cb147b8dd6a7bfc20`; correctness, SFA, host-performance
and emitted-output reviewers report no findings. The host reviewer then clears
the one complete-graph refinement diff to
`fb7da6feaa1cbf4d7ec6de03d99d5431d8a407af`. Reviewers ran no native tools or
mutations. Routing/release setup-summary exposures are disclosed and excluded
from decisive evidence; no evaluator/qualification case answers were used.
Expert lineage is2.0.4/content `0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
normative SFA overlay/ZP/final-closure and frozen Chapter11§3.5.

| Final endpoint | Result / evidence |
| --- | --- |
| Exact small weighted graphs | All1,024 five-vertex graphs match independently enumerated subset demand; unequal weights, C5static3/peak2 and RAM/ZP partitioning pass. Existing test fixtures/assertions unchanged. |
| Required-ZP placement |144/142 clique, duplicate/overlapping/empty windows, malformed precedence, zero/noninterfering requests and feasible exact backtracking pass. Preferred RAM fallback remains unchanged. |
| Unchanged32/64-site sources | Initial separate processes0.63/1.99s, RSS109,436/122,716KiB; after refinement0.427/1.699s in one process. Both succeed with no diagnostics. |
| Unchanged72-chain none | Initial0.46s/RSS93,076KiB; refined0.152s in same process. Known `COMPILER_INCOMPLETE` allocation failure, no generation. Not a new source rejection or successful size fit. |
| Dense redundant-bound refinement | Exact512-vertex accounting53.7→791.9ms before refinement; final before/refined64.4/60.5ms.256 final18.3/25.0ms. One-shot timings retain noise; no general nearly-complete-graph/scaling guarantee. |
| None artifacts | Six observed files are byte-identical to the retained prior generation and match every original byte length/SHA-256.812 payload/814 PRG bytes;7 RAM SFA/2 ZP; bounded stack2/scratch0. |

Raw final logs: `ar-p7-refined-storage.log`, `ar-p7-refined-build.log`,
`ar-p7-refined-typecheck.log`, `ar-p7-dense-helper-refined.log`,
`ar-p7-refined-probes-identity.log`, `ar-p7-refined-identity-final.log`.
The first refined identity comparison attempted the original generation after
normal retention had removed it; its ENOENT is retained, not a pass. The final
check uses the still-retained pre-refinement generation, plus original hashes.
Frozen build-info SHA is public identity, not a source-tree digest; no pre-fix
loaded-module digest was captured. Absolute implementation-to-binary attestation
and other-profile before/after identity remain Unknown. The transcript records
invocation/build order. No size/runtime/full-phase qualification follows.

AR-P6's one-function correction receives the one concrete TP-001 review with
no findings; exact combined-route retrieval and236 limit stay binding. The
first native run reaches a separate mechanical draft typo: `$E138` is an operand
of pinned ROM `LDA $030F`, not an instruction address. All32 none observations
time out at the initial breakpoint;32 size failures are meaningful mode RED.
The independent draft author verifies ROM hash/bytes and corrects only that
checkpoint to `$E136`, as the existing comment requires. This is not an AR-P6
expectation expansion, changed product contract or weakened runtime oracle.
Corrected sequential run is pending; ST-20 NMI facets still remain due.

The corrected startup run completes in41.41s. All32none sources, builds,
accounting and native source answers reach restoration, then fail the separate
universal first-opcode SEI assertion (actual AD, expected78);32size builds
remain unsupported-mode RED. No normal-return completion is claimed. The
independent platform review is assigned only that contract/scope question;
AR-P6's exact accounting amendment is not used to authorize another assertion
change. Raw log: `ar-p6-startup-checkpoint-corrected-red.log`.

Exact AR-P4 output-mode amendments are independently authored and root-verified:
three explicit-size build calls, two metadata strings, no other line changes
between correction baseline and tree `2dc95a86d45ab7c1b9ee3b5751b7507cae2e7afd`.
All12 original whole-output cases now produce meaningful unsupported-size RED
in3.09s. All original source/expert fixtures and numerical/behavior/accounting
expectations remain unchanged. Logs: `ar-p4-exact-output-mode-red.log`,
`ar-p4-exact-output-mode-format.log`. This is authoring/RED qualification, not
implemented size or a complete-cost pass.

Cleanup: the two root-owned interrupted diagnostic projects are no longer
needed in `/tmp` after host qualification. They were moved intact into the
retained evidence directory as `32-site-retained/` and `72-chain-retained/`.
This is recoverable and preserves both original source/config bytes; no other
temporary file or the ten older CIA2/NMI evidence directories was changed.
Historical logs retain their original paths; future reproduction uses these
two recorded evidence locations instead.

Historical stop, superseded by AR-P8 below: independent platform review reports TP-002 (its local TP-001),
MAJOR, for the universal compact restore-opcode expectation. It independently
checks the frozen return contract, approved retained Full/none alternatives and
the exact artifact. No pre-existing none IRQ-masking defect is established by
that first byte. AR-P8 owns the exact one-function assertion-scope amendment
and requires direct approval. No amendment has been applied. Normal-return,
NMI interleavings and the main size implementation remain unqualified. The
completed host/frontier/mode tasks stay verified; progress9/40, parent38/48.
No RED composite commit or automatic push. Final local links, whitespace,
formatting and frozen-authority checks still precede the handoff.

#### Session 1.1 — Specification tests first

Read [07](07-testing-strategy.md) and the exact AR-P4 exception. Hand independent
authors frozen excerpts, interface signatures and the FORBIDDEN list; no compiler
implementation. Author related files together where useful, but keep numbered
tasks and verify each. Only the root runs native/expensive RED checks.

- [x] 1.1.1 [spec-author] Author mode/host/publication specifications — `test/rd08/input-size-mode.spec.test.ts`; ST-1–ST-3. ✅ (completed: 2026-10-12 22:40 CEST; meaningful RED confirmed: 3 size-positive failures, 7 justified baseline passes; implementation still pending)
- [x] 1.1.2 [spec-author] Author object/alias/early-publication specifications — `test/rd08/input-object-facts.spec.test.ts`; ST-4–ST-8/ST-21 ordinary-object facets; hardware-edge observations additionally owned by 1.1.7. ✅ (requalified: 2026-10-13 11:06 CEST; AR-P5 exact correction independently reviewed with no findings; all sources legal, 32 size failures and 32 none-mode runtime passes; implementation still pending)
- [x] 1.1.3 [spec-author] Author byte/condition/complement/exit specifications — `test/rd08/input-byte-selection.spec.test.ts`; ST-9–ST-12 ordinary-source facets; handler mutation additionally owned by 1.1.7 and invalid selected-exit certificates by 1.3.2. ✅ (requalified: 2026-10-13 11:06 CEST; AR-P5 exact correction independently reviewed with no findings; all 56 sources legal, meaningful unsupported-size RED; runtime/instruction checks still await implementation)
- [x] 1.1.4 [spec-author] Author induction/lifetime/debug specifications — `test/rd08/input-loop-storage.spec.test.ts`; ST-13–ST-16/ST-28 ordinary-source facets; held-link/timing facets additionally owned by 1.1.7/1.3.2. ✅ (completed: 2026-10-12 23:37 CEST; meaningful RED confirmed: 20 size-positive failures, 20 justified none-mode runtime/debug/resource passes)
- [~] 1.1.5 [spec-author] Author compact-startup/interrupt specifications — `test/rd08/input-startup-selection.spec.test.ts`; ST-17–ST-20. ⏳ (partial qualification: 2026-10-15 13:54 CEST; complete104-case run52 none native passes/52 meaningful unsupported-size RED,89.96s; new20 none NMI boundary cases pass, no stimulus amendment; remaining public acquisition-quality/held-link scope and draft-oracle review remain due)
- [x] 1.1.6 [spec-author] Author fixed-frontier, resource-recovery and v1 evidence specifications — `packages/compiler/src/services/input-size-frontier.spec.test.ts`; ST-22–ST-24/ST-29–ST-30. ✅ (completed: 2026-10-13 15:54 CEST; complete27-case run11.72s:14 meaningful RED/13 unchanged baseline guards pass; all32/64 sources legal,72-chain baseline failure/no-generation proved; private-only facets remain1.3.3; size implementation pending)
- [~] 1.1.7 [spec-author] Author independent optimized runtime specifications, ST-6 wrapped/dummy-bus and ST-8 alternate-domain observations, and only the approved default-none helper argument — `test/rd08/input-size-runtime.spec.test.ts`, `test/rd05/profile-fixture.ts`; ST-27 plus the named hardware-edge facets, AR-P4 exact exception. ⏳ (partial qualification: 2026-10-15 13:55 CEST; all64 saved/bus/acquisition/IRQ sources legal and meaningful unsupported-size RED,11.84s; held-link/real-NMI and remaining acquired-input facets stay due)
- [x] 1.1.8 [spec-author] Apply only the approved build-mode and two metadata-mode amendments — `test/rd05/input-acquisition-output.spec.test.ts`, `input-library-output.spec.test.ts`, `input-saved-query-output.spec.test.ts`; ST-25–ST-26, AR-P4 exact exception. ✅ (completed: 2026-10-13 16:02 CEST; tree-to-tree diff is exactly five approved line changes; all12 cases meaningful unsupported-size RED, no fixture/limit/assertion drift; formatting/documentation checks pass)
- [ ] 1.1.9 Run and record meaningful RED/unchanged-negative evidence for every new specification group and all three original whole-output files; no size implementation or expectation weakening — this journal, ST-1–ST-30; approved AR-P8 qualification and remaining startup/runtime facets first.

Deliverables: independent specification files, exact exception diff and RED
source/byte/log identities. Verify: directed files with fresh built public
dependencies; explain pre-existing GREEN behavior/negative cases individually.

### Runtime oracle review and correction history

AR-P8 resume, 2026-10-15 13:19 CEST: user directly approved the sole exact startup-test
conditional/comment recommendation. Pre-correction complete tree:
`6ad981106b7ccdacb4d3deb7b93c4c9643623fa2`; original phase baseline is
unchanged. The independent author changes only the restore-entry instruction
check's scope to actual size-mode held-P outcomes, retaining `[0x78]` and every
shared restoration, source-answer, access, accounting and resource assertion.
Root owns sequential verification and one bounded concrete TP-002 fix review.
No compiler, source fixture, helper, public schema or numerical limit changes.
The /tmp inventory contains only the ten retained CIA2/NMI evidence directories;
no new disposable project is present and unrelated files remain untouched.

AR-P8 qualification, 2026-10-15: build and targeted formatting pass. The complete
64-case startup file finishes in60.20s: all32 none-mode startup/return cases pass;
all32 size-mode cases pass source checking and fail only at the unsupported
optimization option. One independent concrete fix review compares complete trees
`6ad981106b7ccdacb4d3deb7b93c4c9643623fa2` →
`4a2484bef5f8e93eed3bd954fe007156f81f928b` and clears TP-002 with no findings.
Logs: Git-private `input-size-exec.A0isqV/ar-p8-{build,format,startup-red}.log`.
This proves none-mode behavior in VICE, not size runtime, real-NMI coverage or
silicon behavior. Task1.1.5 remains partial until ST-20 is authored and qualified.

Runtime authoring, 2026-10-15: independent blind authors append only eight bus,
16 acquisition and four IRQ cases to the existing runtime file. The prior36
saved-input cases and local build helper remain unchanged. The bus draft's
initial two `sei()` spellings fail source checking; the author replaces only
those with frozen `asm_sei()` and uses an explicit array guard instead of a cast.
The corrected44-case run finishes in11.04s; the60-case acquisition run in12.73s;
the64-case IRQ run in12.06s. Every source passes checking; all failures are the
unsupported size option, not a behavior or native-runtime result. File identities:
bus `bf1dc207ee0d910c592decb4f00b83b03eff8da280d7fa78e9965dc02a0b7c85`,
acquisition `2fd16284b4bb73f6e94850bbaac225e3733f30be6fbc60301b56801faae39a18`,
IRQ `a16e45fc4841cec824022f19b28238a61180064b468836741c02185fe7fb01e3`.
Logs in the retained evidence directory:
`runtime-bus-{initial,corrected}-red.log`, `runtime-acquisition-initial-red.log`,
`runtime-irq-initial-red.log`. Targeted runtime formatting and whitespace pass.
Primary VICE commit `4d283a2e7dd59b7e378524878e81ecc7826b700c`,
`vice/src/viciisc/vicii-mem.c`, confirms masked register mirroring and unused
register FF reads; pinned KERNAL bytes independently confirm FFFF=FF. The monitor
does not expose every NMOS dummy read, so the new test additionally rejects the
two named unsafe indexed forms within public main-function ranges. This does
not prove every possible bus footprint. Acquisition trace IDs prove order/count,
not distinct PA-mask values. IRQ output/return/ABI assertions await size runtime;
they establish no whole-machine timing, NMI or external stack guarantee.

### User restart pause — 2026-10-15

The user requested: **“after this part is done, pause, commit and push everything,
I want to start this machine”**. Finish the currently written specification
verification only, then pause; no size implementation or further test authoring.
The public-acquisition NMI/quality case was prepared but not edited.

The independent startup author adds40 NMI boundary cases without changing the
prior64 cases. The initial targeted run finishes in29.11s:20 none cases pass,
20 size cases fail only at the unsupported option,64 unrelated cases are skipped.
The complete104-case run then finishes in89.96s:52 none cases pass and52 size
cases reach meaningful unsupported-mode RED. All five accepted-frame windows
pass on four profiles with the original timer2 stimulus; no timeout/input/answer
amendment. These are VICE-verified / hardware-unverified bounded normal-mode
observations, not optimized or external-arrival/firmware-completion proof.
Logs: `startup-nmi-initial-red.log`, `startup-complete-red.log`.
Startup source SHA256:
`5db6cd73a5913285f25d4e0f42d12ae9f525f8ef07ce1b0f4f697f243891113d`.

The runtime author's new IRQ fixture now names VIC IRQ status/enable registers;
its literal addresses, answers and behavior are unchanged. The final64-case run
finishes in11.84s: all sources legal, all failures unsupported size. No optimized
native observation follows. Runtime source SHA256:
`46dafcbbc4155e42ab834eafe578884f9858757e3990480d0977d4e22ee485dd`.
Log: `runtime-final-red.log`. Targeted formatting, documentation-reference and
whitespace checks pass. Frozen specification and expert paths remain clean.
All new temporary test projects are removed by their existing fixture cleanup;
only the ten retained CIA2/NMI evidence directories remain in `/tmp`.

Restart at the first partial task, not size implementation:

1. Review the new startup draft's final post-removal predecessor-link value
   assertion against the live-only immutability contract. Do not make allocation
   retain retired bytes merely to satisfy an overbroad new oracle. It is not yet
   qualified size behavior or an approved permanent storage restriction.
2. Author the prepared four-profile real-NMI public `readInputSnapshot` case in
   the existing runtime file: quality1, three UNCERTAIN answers, actual accepted
   frame, generated PA-before-prior-marker order, exactly one stock ICR read,
   correct immutable page-safe predecessor while live, balanced caller/vector
   restoration. Reuse current public ranges and monitor APIs; no new harness.
3. Account for the remaining acquired-input/held-link facets, then complete1.1.9's
   full RED gate before1.2.1. The named-batch effort confirmation remains valid;
   do not repeat an effort-only approval pause for this unchanged scope.

Both tasks stay partial and progress stays9/40; parent keyboard38/48. The29
already committed local checkpoints were safely pushed after fetch proved0
behind/29 ahead, through `904511e9`. The remaining work initially stayed
uncommitted because the green-only rule forbids an intentionally RED composite.

**One-time WIP checkpoint exception, approved2026-10-15:** root presented only
“Approve one clearly labelled WIP backup commit despite the expected test
failures”, followed by “Commit and push everything, then remain paused”. The
user directly replied **“i approve”**. This approves one backup commit and normal
push of the complete current source/test/fixture/plan worktree on
`feature/v4-rebuild`, including the intentionally RED specifications. It does
not approve weakening any test, bypassing hooks, changing frozen authority,
advancing task/phase status, resuming execution or future RED commits.

The checkpoint is explicitly work in progress, not a GREEN implementation or
phase closeout. Fresh build, typecheck and43 directed storage tests pass;
current-hash startup evidence remains52 none passes/52 unsupported-size failures,
and current-hash runtime evidence64 unsupported-size failures. No full-suite
pass is claimed. Logs are retained as `wip-checkpoint-{build,typecheck,storage}.log`
beside the existing evidence. All128 new files are inspected as regular text in
the approved source/test/fixture/plan paths, with no credential-pattern matches
or generated binaries. Specification and expert paths remain unchanged. Commit
message identifies the WIP boundary; resume instructions above remain binding.

Resume, 2026-10-13 10:57 CEST: user directly approved the exact AR-P5 three-file
correction. The pre-correction review snapshot is
`dcd531ce106bb6649d3d526d48de781d03cb6db1`; it does not replace the phase-start
baseline. Independent authors own only the approved fixture input amendments;
root owns directed sequential verification and the one bounded independent
fix review. No expanded framework, old-oracle amendment or new compiler behavior
is authorized. The /tmp inventory is unchanged: the two interrupted-test sources
remain necessary diagnosis evidence, not disposable files.

AR-P5 concrete correction recorded at 2026-10-13 11:02 CEST: both independent
authors report only the approved input declarations/seeding changes and local
preparation hooks. The concrete post-correction review tree is
`c58fe60c5d8bba1a79bfc3946ffc4b72d7a31165`; review is limited to the three named
test paths against the pre-correction tree. No answers, assembly/cost thresholds,
old test, shared helper or compiler owner changed. Fresh dependency build passes
(four packages, no cache); root directed RED and one independent fix review are
pending before reopened tasks regain completion.

AR-P5 requalification: the one concrete independent review reports no findings
and clears SM-001 for the static input-contract correction. Fresh directed
object/byte run: 88 meaningful unsupported-size failures and 32 none-mode native
passes, 120 total, 47.35s; all source checks are legal. Formatting and code-doc
reference checks pass. Tasks 1.1.2/1.1.3 regain authoring completion only; no size
runtime or compiler implementation pass follows. Current SHA-256 identities:

| File | Corrected oracle SHA-256 |
| --- | --- |
| `input-object-facts.spec.test.ts` | `a3b2572eed7c9405a98875a13d8f6cc000328ec790dd2c587941088cad05185b` |
| `input-byte-selection.spec.test.ts` | `1d20e5b7451600d4acf1bd9aae57724ab188a186529dad4bc8653abbed24d321` |

Logs: `build-ar-p5.log`, `ar-p5-object-byte-red.log`, `ar-p5-format.log` in the
retained evidence directory. The saved-input draft's first 36-case check is not
meaningful RED: it exposes pre-existing authoring `as` syntax not in the frozen
language. Task 1.1.7 remains partial while its blind author substitutes normative
functional enum casts/implicit enum-to-byte assignments without changing any
classification or effect assertion. That parse log remains `ar-p5-runtime-red.log`;
the draft is not counted as qualified merely because it failed.

The blind runtime author corrected only that draft's syntax using frozen
EN-9/EN-10: implicit enum-to-byte assignment and functional casts `Key(64)`,
`JoystickPort(3)` and `JoystickControl(5)`. The second directed run confirms
all 36 sources legal and 36 unsupported-size failures in 10.10s; there is no
import/setup/parse failure. Final draft SHA-256:
`f8e0acec4438aa11286757fb83815d43ecc4ecd78460e97fd74698e8c92245c3`.
Log: `ar-p5-runtime-legal-red.log`. Input preparation is the independently
reviewed AR-P5 correction; the later mechanical cast spelling changes neither
its sequence nor the classification oracle. This is not a second fix review,
size runtime pass or completion of 1.1.7's remaining hardware/acquisition facets.

### Subsequent bounded baseline findings

The 64-case startup check has legal sources but 32 unjustified none failures
from its blanket capacity236 assertion, alongside 32 meaningful unsupported-size
failures. TP-001 independently establishes that this draft assertion exceeds
the public field contract, while the generated usable236 budget remains binding.
No draft assertion or producer has been changed; AR-P6 owns its exact ruling.
Log: `startup-64-red.log`. This is not proof of a capacity-reporting compiler bug.

The 72-return-chain-only run was interrupted after 319 seconds, with no complete
test result; only the validated root-owned Vitest parent/worker were signalled.
Separate five-second V8 profiles distinguish 32-site exact accounting search
from 72-chain exact allocation fallback. The failed diagnostic-report attempt
emitted no report and is not evidence; successful V8 profiles are the decisive
host endpoint. Raw logs: `frontier-chain-red.log`, `frontier-32-v8.log`,
`frontier-32-profile-summary.log`, `frontier-72-v8.log`,
`frontier-72-profile-summary.log`. No output/runtime conclusion follows.
An independent challenger recommends AR-P7's exact four-existing-file scope;
no compiler fix or task-order amendment applied before user authorization.

Cleanup: root confirmed `/tmp/blend65-profile-build-uJSD3f` was byte-for-byte
identical to retained `/tmp/blend65-profile-build-HM3niE`, then removed only that
duplicate interrupted-test project. Its files are recoverable from the retained
copy. The new exact 72-chain source `/tmp/blend65-profile-build-g52DXA` remains
needed for diagnosis/qualification. Older CIA2/NMI evidence and all unrelated
temporary files are untouched.

Final stop-record validation: local links and whitespace pass; task parsing
remains 4/37. The four proposed host-owner files exist and are 249/489/470/452
lines, so the bounded proposal needs no new module or file split. Frozen
specification/expert paths remain clean. No compiler edit, full-suite/size-runtime
pass, RED composite commit or push is claimed. AR-P6/AR-P7 remain explicit
approval gates; their fixes are not silently applied under AR-P5 authority.

At 2026-10-13 00:14 CEST, independent SM-001 found that initialized module
inputs are overwritten only by the debugger after startup. That can reject
sound future constant propagation or early reads. AR-P5 records the exact
three-file amendment; no test has been changed under this finding. Tasks 1.1.2
and 1.1.3 are reopened and no longer contribute to progress. Their old hashes
and logs below remain historical. Tasks 1.1.1 and 1.1.4 remain verified;
their 23 size failures and 27 baseline passes are the current completed-group
RED evidence. Implementation entry remains blocked by the specification gate.

The fresh startup author now has 64 cases, including synthetic varied-SP and
real display-observation cases. Its earlier 48-case run passed public source
legality but stopped before native execution: 24 size builds reject the mode;
24 none builds report stack capacity 256 instead of the frozen profile's
available 236. No runtime pass or stack-ledger correction is inferred. Exact
real-NMI publication/removal/restore coverage is still due from the already
assigned ST-20 protocol; the prior contaminated author result remains excluded.

The package-local frontier file has 27 cases. Filtered version-one/publication
verification returns 2 meaningful failures (rejected-reference record and size
source-diagnostic preservation), 13 justified baseline passes and 12 cases
excluded by that directed filter. The complete and repeated-site-only runs were
interrupted after approximately 300 and 508 seconds of CPU-bound canonical
checking, respectively; they have no complete test result. A public frontend-only
probe of the retained 32-site source returns `complete` with no diagnostics in
about 60ms. Backend cause and full source/resource qualification remain Unknown;
no execution cap, expectation or timeout was raised to manufacture a pass.
Logs: `startup-partial-red.log`, `frontier-red.log`,
`frontier-record-publication-red.log`, `frontier-site-red.log`,
`frontier-32-frontend-probe.log`, in the evidence directory below.

Only root-owned test workers were interrupted. The two resulting exact `/tmp`
projects, `/tmp/blend65-profile-build-HM3niE` and
`/tmp/blend65-profile-build-uJSD3f`, are retained for the unresolved backend
diagnosis; the ten older CIA2/NMI evidence directories and unrelated files are
untouched. These sources remain needed, not disposable cleanup targets.

Stop-record validation: all four touched Markdown owners have valid local file
links; progress parsing confirms 2/37, whitespace validation passes, and all
four previously recorded oracle hashes remain unchanged. Frozen specification
and expert paths remain clean. No compiler suite or new runtime pass is claimed
for this documentation-only stop record; no RED composite commit or push.

### Task 1.1.1 specification evidence

Independent `spec-test-author` wrote only the owned new file and reported no
forbidden implementation/grader reads. Initial packet clarification supplied
the existing v1 publication/decision shapes, half-open PRG bounds and ordinary
failed-result contract before the oracle was frozen; no expectation came from
compiler inspection or was weakened to fit implementation.

Root ran the dependency build, targeted specification file and targeted code
format check. Build and formatting pass. The specification command intentionally
returns RED: explicit size API, size CLI publication and clean-size
reproducibility fail at the currently unsupported mode, not import/setup errors.
Seven baseline cases pass with justification: none writes the independently
expected byte7 in VICE; default helper remains none; two invalid API options
return failures without output changes; two invalid CLI modes and build-only
check flags return usage errors without output changes. None's exact publication,
inventory/hash/accounting and empty-decision assertions pass. Size runtime and
portable artifact assertions remain unexecuted behind the mode failure.

Frozen oracle SHA-256:
`4064b9f28cb5f0c901182fe306fc2646df77c7a8050b0c1cf140923d99594fd0`.
Raw logs: `/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/input-size-exec.A0isqV/`
(`build-before-mode-red.log`, `mode-red.log`, `mode-format.log`). Documentation
entity/plan-reference self-check and `git diff --check` pass. No compiler change,
full-suite/phase completion, new tool/harness, RED commit or push is claimed.
The none probe is VICE-verified / hardware-unverified; it is not size evidence.

### Task 1.1.2 specification evidence

Independent author wrote only the owned object file, with no forbidden
implementation/grader reads or native test execution. All eight source scenarios
pass public checking in both modes on all four profiles. Final directed RED:
32 size builds fail at `SERVICE_INVALID_OPTION`; all 32 none-mode cases pass
actual ACME/VICE behavior, accounting and bounded stack-resource checks.
Those passes separately cover ordinary forwarding/evaluation order, differing
roots and callable entries, crossing/member/unsized borrows, captured fields
across typed and raw aliases, forwarded returns, old destination observation
before publication, overlapping returns and distinct nested/early results.
Selected size-only leaf/storage assertions remain unexecuted behind mode rejection.

Initial run had four additional none-mode fixture failures: root's packet had
mistakenly supplied `[0; 8]` as a repetition initializer. Frozen Chapter 08 §4.1
instead defines explicit values followed by a fill value; the author corrected
only the initializer to `[; 0]` before oracle freeze. The independent expected
answers `[7, 9, 12, 12]` were not changed; no implementation correction was needed.
The corrected run has no import, setup or source-legality failure.

Frozen oracle SHA-256:
`e34be01956a40e1f5097704f728d0720c956e1a0240e4348a7f1fa24b77d00a0`.
Raw logs share the task 1.1.1 evidence directory: `object-red.log` preserves the
initial packet error; `object-red-corrected.log` records the final 64-case run.
Targeted formatting passes. Wrapped/dummy-bus and alternate-domain facets are
still mandatory task 1.1.7 coverage, not claimed here. Compiler implementation,
full checkpoint and phase completion remain pending; no RED commit or push.
None-mode observations are VICE-verified / hardware-unverified.

### Task 1.1.3 specification evidence

Independent author wrote only the owned byte file, with no forbidden reads or
native runs. Both root directed runs have 56 meaningful `SERVICE_INVALID_OPTION`
failures after every source passes public checking; no import/setup failure or
unjustified baseline pass. Runtime/instruction/resource assertions are authored,
not yet executed: exhaustive 65,536 individually checked byte pairs per profile,
short-circuit effects, call/load/status invalidation with incoming C/D/Z variation,
canonical Boolean exits, stable complements and mutation/raw/volatile/zero-trip
counterexamples. No differential-only oracle or general instruction decoder.

Source-level PLP does not force invalid returned Z: a legal reload may establish
Z again. The negative retest assertion therefore applies only to an actual
selected exit restoring unrelated P; the source return remains canonical.
Machine-level invalid-exit rejection stays mandatory in task 1.3.2, and handler
mutation stays mandatory in 1.1.7. Small fixture refinements wrap stack addresses
within page one and bound mnemonic inspection by actual function/startup labels;
they preserve the original behavior and instruction expectations.

Frozen oracle SHA-256:
`f3bd6fe4215d307d7dd4fa06d0e3de94966c670873755468d99665241a4c5122`.
Logs in the same Git-private evidence directory: `byte-red.log` and
`byte-red-final.log`. Targeted formatting passes. No size runtime/exhaustive-domain
pass, compiler implementation, full checkpoint, GREEN commit or push is claimed.

### Task 1.1.4 specification evidence

The independent author retained all source answers and storage/debug expectations.
The first directed run exposed an unsupported test assumption that public symbol
`name` is the unqualified source identifier. Before oracle freeze, retrieval was
corrected to use exact UTF-8 declaration provenance and owning function context,
as the version-1 contract permits. No compiler code or expected result changed.
The corrected root run has 20 meaningful size-mode option failures and 20
none-mode passes on all four profiles, with no source/import/setup failure.

None independently proves eight/nested ordinals, crossing255, non-retaining
counter borrows, break/continue/live-outs, exact volatile event order, early and
unknown exits, dead whole/member writes, unused parameter marshalling, deferred
compound reads, last-use call arguments and surviving call values. Public word
width/context/ranges, retained-home disjointness and physical accounting pass.
The selected narrowing/overlay bounds remain behind unsupported size mode.
Held interrupt-link and machine timing-certificate facets remain mandatory in
their already named runtime/logic owners, not covered by this file.

Frozen oracle SHA-256:
`e9c321823c2b95e66d32cf2689adc689dda240e5f5f0676086fbdcdc216ac1ae`.
Logs: `loop-red.log` retains the lookup mistake;
`loop-red-provenance.log` records the final 40-case result in the same evidence
directory. No general runner, production change, whole-phase pass, RED commit
or push. Runtime scope is VICE-verified / hardware-unverified.

### Pending startup author replacement

The first startup author disclosed reading helper lines 277–304 containing a
stack expectation outside its allowed public range/instruction-helper packet.
Root stopped that context before any startup file was created. No result from
that context is counted as decisive independent evidence; a fresh blind author
will receive only the normative schema/CPU/platform excerpts and allowed helper
signatures. Scope, expected answers and reviewer requirements are unchanged.

#### Session 1.2 — Implementation and directed GREEN

Follow [03-01](03-01-source-facts.md), [03-02](03-02-machine-selection.md) and
[03-03](03-03-closure-and-modes.md). Keep each unit reviewable; split a task in
this owner before implementation if actual work exceeds the 1–3-file/50–150-line
guideline. A split does not expand scope or create new proof machinery. Verify
the relevant cases after each unit; all specification groups must reach GREEN
by the final task of this session.

- [ ] 1.2.1 Add explicit size to the existing public/CLI selections and help without changing other option rules — `services/types.ts`, `packages/cli/src/args.ts`, `packages/cli/src/render.ts`; 03-03 public mode, ST-1/ST-2.
- [ ] 1.2.2 Wire validated size, reusable checked source input and typed nonterminal canonical resource outcome, leaving none canonical — `services/services.ts`, `machine/machine-types.ts`; 03-03 interfaces/reference/public mode, ST-29.
- [ ] 1.2.3 Define source-associated closed-object facts and finite direct-origin propagation — `semantic/closed-object-facts.ts`; 03-01 interfaces/whole objects, ST-4/ST-5.
- [ ] 1.2.4 Close bounded footprints, object stability and early-publication obligations — `semantic/closed-object-facts.ts`, `semantic/aggregate-place-proof.ts`; 03-01 effects, ST-6–ST-8/ST-21.
- [ ] 1.2.5 Derive access-complete binding occupancy over CFG positions, including write/marshal/deferred-read obligations — `semantic/local-storage-lifetimes.ts`, `semantic/value-lifetimes.ts`; 03-01 local lives, ST-16.
- [ ] 1.2.6 Derive canonical finite induction and exact exit/counter obligations — `semantic/fixed-loop-facts.ts`; 03-01 induction, ST-13–ST-15.
- [ ] 1.2.7 Hand selected source facts/recipes to per-function lowering without reanalysis or none-path changes — `machine/lower.ts`, `machine/lower-function.ts`, `machine/lower-state.ts`; 03-02 integration.
- [ ] 1.2.8 Consume unique object/destination recipes through existing aggregate/call owners — `machine/lower-aggregate-place.ts`, `machine/lower-call.ts`, `machine/lower-aggregate-build.ts`; fixed-object-address/direct-fixed-result, ST-4–ST-8.
- [ ] 1.2.9 Implement exact byte-window/short-edge retention and value-preserving comparison — `machine/byte-value-availability.ts`, `machine/lower-register-forwarding.ts`, `machine/lower-comparison.ts`; ST-9/ST-10.
- [ ] 1.2.10 Consume proved invariant complement/dual-byte availability — `machine/byte-value-availability.ts`, `machine/lower-unary.ts`; ST-12.
- [ ] 1.2.11 Certify selected Boolean exits and consume only proved returned flags — `machine/byte-value-availability.ts`, `machine/lower-call.ts`, `machine/lower-control.ts`; ST-11.
- [ ] 1.2.12 Select exact low-byte/register/flat-eight loop alternatives with original exits/effects — `machine/fixed-loop-selection.ts`, `machine/lower-function.ts`, `machine/lower-bounds.ts`; ST-13–ST-15.
- [ ] 1.2.13 Close selected logical/storage recipes and actual private interference through existing allocation — `storage/selection.ts`, `storage/inventory.ts`, `storage/interference.ts`; 03-02 SFA recipes, ST-16.
- [ ] 1.2.14 Hand precise call-site live requests and startup-held stack demand to closure — `machine/lower.ts`, `storage/storage-types.ts`; 03-03 closure/startup, ST-16/ST-17.
- [ ] 1.2.15 Validate feasible/reference-rejected observer outcomes and complete candidate bank footprints without inventing missing intervals — `services/size-observers.ts`, `services/shared-storage.ts`; 03-03 observer order, ST-6/ST-21/ST-24/ST-29.
- [ ] 1.2.16 Add fully proved held-P startup/preservation alternatives and final placement integration — `layout/startup.ts`, `layout/c64-layout.ts`; 03-03 startup, ST-17–ST-20/ST-22.
- [ ] 1.2.17 Construct all admitted fixed bundles/loop/startup recipes, with at most37 outer attempts, and close each through existing service owners — `services/size-selection.ts`, `services/services.ts`; 03-03 finite alternatives/closure, ST-23/ST-24/ST-29.
- [ ] 1.2.18 Select by closed costs and implement only the approved v1 feasible-baseline validation correction — `services/size-selection.ts`, `services/evidence.ts`, `artifacts/costs-evidence-validator.ts`; 03-03 comparison/evidence, ST-3/ST-22–ST-26/ST-30.
- [ ] 1.2.19 Populate final source/register/rematerialized availability and optimization ranges — `services/evidence-records.ts`, `services/debug-storage-locations.ts`, `services/debug-machine-ranges.ts`; 03-02 debug recipes, ST-28.
- [ ] 1.2.20 Rerun all new specifications and every original input specification, recording complete actual source/assembly/artifact/resource identities and independent answers — this journal; ST-1–ST-30, AR-P4 unchanged limits.

Compiler paths above are relative to `packages/compiler/src/`; the three CLI
paths are explicitly repo-relative. Selected types may add only necessary
fields to existing internal machine/storage owners. No blanket module rewrite,
new root export, dependency or unlisted support family is allowed.

Deliverables: implemented admitted rule packets and their actual independent
GREEN behavior/output/resource evidence. Verify: directed tests during units;
native runs sequential, existing byte/observer/boundary regressions unchanged.

#### Session 1.3 — Logic tests, hardening and one full checkpoint

- [ ] 1.3.1 Add fact/lifetime/induction invalidation logic tests — adjacent `closed-object-facts.impl.test.ts`, `local-storage-lifetimes.impl.test.ts`, `fixed-loop-facts.impl.test.ts`; 03-01.
- [ ] 1.3.2 Add byte/exit/loop counterexample logic tests — adjacent `byte-value-availability.impl.test.ts`, `fixed-loop-selection.impl.test.ts`; 03-02.
- [ ] 1.3.3 Add final-observer/reference-outcome/fixed-frontier/permutation/scaling logic tests — adjacent `size-observers.impl.test.ts`, `size-selection.impl.test.ts`; 03-03, ST-21–ST-24/ST-29–ST-30.
- [ ] 1.3.4 Run exact-source four-profile native input, preservation/coexistence/return and original timing qualification sequentially; retain raw identities — this journal and `08-closeout.md`; ST-17–ST-20/ST-25–ST-28.
- [ ] 1.3.5 Update supported-mode/library notes and bounded deferral-expiry/issue ownership — `docs/platform-libraries.md`, `08-closeout.md`; AR-P1–AR-P4, RD-08 R8.47/R8.56.
- [ ] 1.3.6 Run the complete inherited install/build/typecheck/test and touched-code formatting checkpoint; frozen-authority/import/oracle guards unchanged — this journal.
- [ ] 1.3.7 Obtain independent correctness, semantics/DX, SFA/ABI, platform, output and host-performance review of the complete phase snapshot/diff; resolve and reverify authorized findings — `09-phase-review.md`.
- [ ] 1.3.8 Validate final evidence, exact exception and closeout; sync only the feature roadmap/owning keyboard prerequisite; make a coherent GREEN local checkpoint through git-commit skill, never automatic push — index, this journal, closeout and feature roadmap.

Deliverables: independent complete phase clearance and a truthful handoff to the
blocked keyboard tasks. Verify: full inherited commands, all directed/original
qualification, exact exception diff and final source/artifact matching.

## Completion boundary

All 40 tasks must be verified and no critical/major review finding unresolved.
Only then is this prerequisite Done. Resume keyboard tasks in their existing
owner; do not mark their four pending hardening/closeout tasks done here.
RD-05/DEF-7 and other open task rows remain owned; full RD-08 remains incomplete.
Review every deferral whose rationale these facts expire and assign due work to
an open owner, not this completed slice. Physical QA and user hosts stay RD-10.
No fresh verification or implementation completion is claimed by creating this plan.
