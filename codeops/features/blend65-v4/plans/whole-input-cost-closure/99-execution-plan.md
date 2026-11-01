# Execution: whole-input cost closure

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-10-31
> **Progress**: 28/40 tasks (70%)
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

Expected modification set: the exact production files named in Session 1.2,
the user-approved existing `machine/lower-aggregate.ts` consumer (AR-P15), and
the exact `machine/bind.ts` native-X mode-preservation correction (AR-P25), and
AR-P28's exact logical-presence/physical-proof queries in the five existing
operation/conversion/scalar/indirect/interrupt-namespace consumers, and AR-P30's
three existing stack consumers and three bounded existing test concerns, and
AR-P32's exact existing C64 wrapper-factory provenance concerns, and
AR-P33's exact CPU/provenance concern files and constant-initializer data-owner move, and
AR-P36's exact residual-effects concern files and data-only producer/sharing additions, and
AR-P38's exact raw-layout concern, loop implementation tests and moved test-only fixture, and
AR-P42's exact borrow consumer/test concerns and effects/main composition, and
AR-P43's exact two-case implementation-frontier expectation amendment, and
AR-P44's exact existing return-only borrow consumer/test and one-outcome amendment, and
AR-P45's exact stateless backing lookup/type relocation and bounded existing composition, and
AR-P46's exact nine-path capture association/proof, unchanged type/merge moves and single capture outcome amendment, and
AR-P47's exact final byte-window proof/test pair, unchanged Boolean helper moves and single row migration, and
AR-P48's exact cache-complement proof/test pair and bounded existing main composition, and
AR-P50's exact Original-field proof/test pair, existing class dispatch and single Original-row migration, and
AR-P51's exact unqualified field-layout helper/type relocation and one leaf, and
AR-P53's exact narrowed LowByte proof/test pair and bounded existing effects/main composition, and
AR-P54's exact unqualified LowByte layout/physical helper relocation and one500line leaf, and
AR-P55's exact six-path scalar register factor/test, parent/layout/main composition and two-label old implementation-test amendment, and
AR-P56's exact four-path indexed-store factor/parent/layout/test and internal API extensions with unchanged caps, and
AR-P57's exact three-path Original composition/effects capacity and single old-row migration, and
AR-P58's exact two-consumer guarded-use integration and300-line test with no old-test exception, and
AR-P59's exact old-loop single-outcome qualification and bounded existing new-test coverage, and
AR-P60's exact existing-owner call-only proof/new test/single outside-call row migration, and
AR-P61's exact unqualified call-site leaf/export/movement with complete actual occurrence closure, and
AR-P62's exact final-only guard leaf/per-operation result and two typed consumers/single old-outcome exception, and
AR-P63's exact unsigned-byte internal-shift leaf/alias-cycle integration and fresh Original-composition tests, and
AR-P64's exact adjacent mutation-test concern/movement with unchanged production and qualified helpers, and
AR-P65's exact shared-byte-return leaf/qualified inline-predicate movement and additive composition tests, and
AR-P66's exact adjacent return-fragment test movement with unchanged production and qualified helpers, and
AR-P67's exact existing layout observerBlocks maintenance and additive producer/composition regressions, and
AR-P68's exact single composition-test ceiling500→550exception without code movement or new scope, and
AR-P70's exact field/caller correspondence owner/test, named qualified relocations/exports and sole caller-C100 outcome amendment, and
AR-P71's exact single field-layout ceiling400→450exception without code movement or extra scope, and
AR-P72's exact single correspondence ceiling700→850exception without code movement or extra scope, and
AR-P73's exact two-finding opcode/complete-entry corrections in existing parent/correspondence/new implementation test within unchanged ceilings, and
the three 03 documents; the eight new specification files (AR-P11 adds the focused
acquisition-NMI file), exact four-file
AR-P4 exception and adjacent implementation tests named in Sessions 1.1/1.3;
the exact AR-P18-approved adjacent complement implementation-test concern;
the exact AR-P19-approved adjacent Boolean-exit implementation-test concern;
the exact AR-P21-approved adjacent counter implementation-test concern;
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
- [x] 1.1.5 [spec-author] Author compact-startup/interrupt specifications — `test/rd08/input-startup-selection.spec.test.ts`; ST-17–ST-20. ✅ (completed: 2026-10-15 18:13 CEST; AR-P9 exact correction/fix review and104-case run52 none passes/52 meaningful size RED; focused four-profile public acquisition-NMI/live-link case is legal/meaningful size RED with TP-002 fix review clear; optimized runtime and final closure remain later gates)
- [x] 1.1.6 [spec-author] Author fixed-frontier, resource-recovery and v1 evidence specifications — `packages/compiler/src/services/input-size-frontier.spec.test.ts`; ST-22–ST-24/ST-29–ST-30. ✅ (completed: 2026-10-13 15:54 CEST; complete27-case run11.72s:14 meaningful RED/13 unchanged baseline guards pass; all32/64 sources legal,72-chain baseline failure/no-generation proved; private-only facets remain1.3.3; size implementation pending)
- [x] 1.1.7 [spec-author] Author independent optimized runtime specifications, ST-6 wrapped/dummy-bus and ST-8 alternate-domain observations, the focused acquisition-NMI split, and only the approved default-none helper argument — `test/rd08/input-size-runtime.spec.test.ts`, `input-acquisition-nmi.spec.test.ts`, `test/rd05/profile-fixture.ts`; ST-27 plus named hardware-edge facets, AR-P4/AR-P11 exact exceptions. ✅ (completed: 2026-10-15 18:13 CEST; exact original runtime SHA restored; focused257-line actual-range case, formatting,68legal/meaningful size RED and base/SFA/platform static reviews clear, including one TP-002 fix review; no optimized native result)
- [x] 1.1.8 [spec-author] Apply only the approved build-mode and two metadata-mode amendments — `test/rd05/input-acquisition-output.spec.test.ts`, `input-library-output.spec.test.ts`, `input-saved-query-output.spec.test.ts`; ST-25–ST-26, AR-P4 exact exception. ✅ (completed: 2026-10-13 16:02 CEST; tree-to-tree diff is exactly five approved line changes; all12 cases meaningful unsupported-size RED, no fixture/limit/assertion drift; formatting/documentation checks pass)
- [x] 1.1.9 Run and record meaningful RED/unchanged-negative evidence for every new specification group and all three original whole-output files; no size implementation or expectation weakening — this journal, ST-1–ST-30. ✅ (completed: 2026-10-15 18:20 CEST; complete sequential381cases:257meaningful RED/124justified baseline passes/0skips; all eight new groups and all12original whole-output cases included; exact oracle identities and classifications below; size implementation not started)

Deliverables: independent specification files, exact exception diff and RED
source/byte/log identities. Verify: directed files with fresh built public
dependencies; explain pre-existing GREEN behavior/negative cases individually.

### Runtime oracle review and correction history

Resume, 2026-10-15 16:25 CEST: the user says **“resume”**, continuing the
previously requested `--auto-design --auto-commit` execution in strict scope.
Workflow correction `79ccb88b` is complete; no new effort-confirmation pause,
model change, native permission change or push authority follows. The original
phase baseline remains unchanged. The named source/test/plan paths are clean
before this continuation and the latest verified output-mode task's files exist.

The restart's first obligation receives independent SFA and platform review.
Both find the same MAJOR scope defect: the startup draft's final predecessor
value assertion at line 673 observes retired storage after source removal and
later output operations. Live-link retention remains mandatory, including
suspended routes, but not after every possible consumer completes. AR-P9 records
the exact proposed one-line amendment and pending direct ruling. No author or
compiler edit is made. Existing live-link checks and all other assertions stay
intact. Tasks 1.1.5/1.1.9 are blocked; 1.1.7 remains partial; progress stays9/40.

Reviews are static contract evidence only, not fresh source/assembly/VICE or
size qualification. Both reviewers receive selected normative expert excerpts
and current release metadata from the primary, inspect the frozen clauses and
new test directly, and use no implementation or qualification answers. The SFA
review's requested routing excerpt is supplied and does not change its finding.
External aggregate NMI/firmware, actual dead-link reuse and hardware remain
Unknown. Root owns subsequent sequential verification and one concrete fix review
after approval. No repeated full preflight, new harness or size implementation.

Stop-record validation passes: four touched Markdown prose checks, local file
links, whitespace,40 task markers/9 verified and exact blocker ownership. The
full explicit-parser check exposes only inherited compact-table formatting in
two documents; no unrelated table rewrite is applied. Both startup/runtime
SHA-256 identities above remain unchanged, as do compiler, test, frozen expert/
specification and portfolio scope. No fresh compiler or emulator run, oracle
edit, new commit or push is claimed while the exact ruling remains pending.

AR-P9 approval, 2026-10-15 16:56 CEST: user selects **“Approve exact edit
(Recommended)”**, answering the sole one-line oracle question. Independent author
may remove only the final post-retirement value assertion; root then runs the
existing startup cases sequentially and obtains one concrete fix review. The
pre-edit test SHA-256 is the unchanged startup identity above at `79ccb88b`.
No stronger storage rule, source/stimulus amendment, helper or producer change.
Tasks 1.1.5/1.1.9 leave the ruling block; neither is promoted to verified.

AR-P9 concrete amendment, 2026-10-15 16:57 CEST: independent author reports
exactly the approved one-line deletion and no forbidden implementation reads.
The live-route expectation is untouched. Root qualification and the one
independent fix review are pending; task 1.1.5 stays partial.

AR-P9 concrete qualification, 2026-10-15 17:00 CEST: fresh `yarn build` passes;
the complete sequential startup file has52none native passes/52meaningful size
failures,104total,92.24s wall time. All nine grouped error summaries are the
unsupported `SERVICE_INVALID_OPTION`, not source/import/setup failures.
Independent SFA fix review clears SF-001 with no findings on the exact one-line
diff. Corrected startup SHA-256:
`01f3fe24d90746e2367a41483b510890403605640c79c7d3b2028962ce9f0c8f`.
Logs: `ar-p9-build.log`, `ar-p9-startup-red.log` under the task-owned temporary
directory; cleanup removes them at this continuation's boundary. This is
VICE-verified / hardware-unverified none behavior, not size implementation,
actual dead-link reuse or full-phase qualification. Remaining acquisition/NMI
and held-link runtime facets still precede authoring completion and1.1.9.

Runtime NMI authoring, 2026-10-15 17:26 CEST: a fresh implementation-blind author
appends four size-mode public-acquisition cases and one necessary helper import
to the existing runtime file, retaining every previous case/helper/source.
Author reports699lines and no forbidden reads. Missing standards are supplied
as an authorized excerpt. A checkpoint-location clarification uses public scan
ranges only to propose `STA $DC00` addresses; two actual execute stops establish
instruction boundaries and the specified idle/publication/PA=$FF ordering.
This is not byte-pattern-only proof, a decoder, retry loop or new monitor API.
The actual accepted frame/vector must still prove the NMI phase. No none-mode
supporting case is added; all new optimized runtime checks remain unexecuted
until size exists. Root source/RED, formatting and bounded protocol review are
pending before either partial task may be promoted. No implementation starts.

New runtime draft qualification, 2026-10-15 17:48 CEST: first68-case run takes
14.47s; all sources are legal and all failures are unsupported size. Initial
formatting is not accepted: the nominal699-line draft would format to752lines
at the baseline's verified100-column style. The independent author simplifies
lookup through existing public helpers and removes an unsound host inference
that last physical-address reads identify semantic link retirement. Revised
draft is699lines and formatting passes; original64cases remain unchanged.

Base and SFA static reviews have no findings after the supplied public register
interface confirms snapshots contain only A/X/Y/P/SP. Platform TP-002 finds a
necessary host-coordinate correction: function bytes start at the minimum public
range, not necessarily the entry label, and a min/max envelope may contain gaps.
The new draft must derive its byte origin and candidate/accepted-PC membership
from actual scanner ranges. AR-P10 records this eligible draft-mechanism fix;
no independent source answer changes and no new support surface is authorized.
Final RED, one fix review and file-limit validation precede task promotion.

AR-P11 stop, 2026-10-15 17:52 CEST: the author cannot fit the necessary readable
range correction inside the existing700-line ceiling. No edit is made. Root
recommends a focused new specification file instead of the suggested725-line
exception or compressed code. The exact eighth-file boundary and removal only
of this run's runtime additions require the user's scope ruling. Draft remains
699lines and unqualified; all original64runtime cases stay preserved. Tasks
1.1.5/1.1.7/1.1.9 are visibly blocked and progress stays9/40. AR-P9's exact
startup correction remains qualified. No new implementation or push authority.

AR-P11 approval, 2026-10-15 18:02 CEST: user directly selects **“Approve split
(Recommended)”** for the exact focused eighth-file/restore-runtime/inventory
question. Independent author may now move only this run's new case, apply the
actual-range correction there and restore the old runtime bytes. No shared
helper, new API, acceptance change or file-size exception. Root verifies exact
restoration, all cases and the one concrete TP-002 fix review before promotion.

AR-P11 concrete split, 2026-10-15 18:10 CEST: independent author restores the
original520-line runtime and writes only the new257-line acquisition-NMI file.
The same four-profile case uses small inline existing public-build/VICE setup;
actual owned ranges supply byte origin and complete candidate/accepted-PC
membership. No entry-equality/gapless requirement, new helper or forbidden read.
Root exact restoration, formatting, source/RED and one TP-002 fix review remain
pending; neither partial task is promoted yet.

AR-P10/AR-P11 qualification, 2026-10-15 18:13 CEST: root verifies the original
runtime SHA-256 is restored exactly. All three touched test files match the
verified100-column TypeScript style and remain below700lines. New focused file
has257lines and SHA-256
`7de6ea1485ffcb3b51bb560cc2398f98e8d1c50225e4bf31f6e8f68f56be4c3e`.
The concrete platform fix review clears TP-002 with no findings; the former
entry-offset and gap counterexamples no longer survive. One subsequent purely
whitespace formatting hunk changes no expression. Corrected runtime/focused
run has68legal/unsupported-size failures in15.31s, not setup/source failures.
Logs: `split-format.log`, `split-runtime-red.log` in the task-owned directory.

Base/SFA reviews of the new case report no findings, with exact register-type
excerpts resolving their interface questions. Platform clearance is static,
not executed optimized behavior. Public acquisition-NMI/quality/live-link
authoring is now accounted for; real native64-key/two-joystick/coexistence,
selected-certificate/counterexample and complete SFA/output proof remain in
their existing1.3.2/1.3.4/parent owners. No full phase or size claim follows.
Documentation/forbidden-reference self-check passes for the new focused test.

### Complete specification RED gate — 2026-10-15 18:20 CEST

Root runs all ten selected root files together with existing serial Vitest/VICE
ownership, then the compiler-local frontier file through its workspace runner.
The root command takes194.58s:354cases,243failures/111passes/0skips. Frontier
takes13.70s:27cases,14failures/13passes/0skips. Total **381 cases:257meaningful
RED,124justified baseline passes,0skips**. Both command exits are intentionally1;
this is a completed RED gate, not a GREEN compiler checkpoint.

| Group | Cases | Meaningful RED | Baseline pass | Failure / pass explanation |
| --- | ---: | ---: | ---: | --- |
| Mode/host/publication | 10 | 3 | 7 | Two size API paths reject the unsupported option; CLI rejects explicit size. None execution/default helper and invalid API/CLI guards pass. |
| Objects/aliases | 64 | 32 | 32 | All size sources check legally, then reject the mode; none preserves the independently specified values/effects/returns/resources. |
| Bytes/conditions | 56 | 56 | 0 | Legal sources reach unsupported size; optimized exhaustive truths/instructions remain unexecuted. |
| Loops/lifetimes/debug | 40 | 20 | 20 | Size rejects the mode; none proves ordinary loop/value/effect/debug/resource cases. |
| Startup/NMI boundaries | 104 | 52 | 52 | Legal size sources reject the mode; none passes startup, return and accepted-NMI boundary observations. |
| Saved/bus/acquisition/IRQ runtime | 64 | 64 | 0 | Original runtime bytes unchanged; all sources legal, all builds reject size. |
| Focused acquisition NMI | 4 | 4 | 0 | Four legal sources reject size; new native protocol, quality/ABI/link and effect assertions remain unexecuted. |
| Original whole-output files | 12 | 12 | 0 | Every original source/expert/numerical gate remains; explicit size is unsupported. |
| Frontier/evidence/publication | 27 | 14 | 13 | Twelve size builds reject the mode; rejected-baseline v1 round-trip and size source-diagnostic precedence remain missing. Existing feasible/v1 malformed-record and none/cancellation publication guards pass. |

Structured failure inspection finds242root `SERVICE_INVALID_OPTION` failures
and one `CLI_INVALID_ARGUMENT` size-admission failure. Frontier has12unsupported
size failures, one rejected-reference reader rejection and one missing E10174
source diagnostic because unsupported size validation precedes checking. None's
same invalid source returns E10174 and preserves every last-good byte. All11
original v1 feasible/malformed-record cases pass, along with none source-failure
publication and already-cancelled size publication. No import, setup, accidental
illegal-positive-source failure or unexplained GREEN case is counted as RED.
The size diagnostic case's later byte-preservation assertion remains unreached;
its earlier no-generation assertion passes. No optimized publication proof follows.

| Specification file | SHA-256 used by the complete run |
| --- | --- |
| `input-size-mode.spec.test.ts` | `4064b9f28cb5f0c901182fe306fc2646df77c7a8050b0c1cf140923d99594fd0` |
| `input-object-facts.spec.test.ts` | `a3b2572eed7c9405a98875a13d8f6cc000328ec790dd2c587941088cad05185b` |
| `input-byte-selection.spec.test.ts` | `1d20e5b7451600d4acf1bd9aae57724ab188a186529dad4bc8653abbed24d321` |
| `input-loop-storage.spec.test.ts` | `e9c321823c2b95e66d32cf2689adc689dda240e5f5f0676086fbdcdc216ac1ae` |
| `input-startup-selection.spec.test.ts` | `01f3fe24d90746e2367a41483b510890403605640c79c7d3b2028962ce9f0c8f` |
| `input-size-runtime.spec.test.ts` | `46dafcbbc4155e42ab834eafe578884f9858757e3990480d0977d4e22ee485dd` |
| `input-acquisition-nmi.spec.test.ts` | `7de6ea1485ffcb3b51bb560cc2398f98e8d1c50225e4bf31f6e8f68f56be4c3e` |
| Compiler-local `input-size-frontier.spec.test.ts` | `3a44dd3c8f3c518c4a05d485400cd85e14839288a219a6517a675c41716a31c5` |
| Original `input-acquisition-output.spec.test.ts` | `fbd2226bf155f2e191d3ca7f66f533095701c70baccbcad33542f12a4b3eaf3e` |
| Original `input-library-output.spec.test.ts` | `cbfa8d738403c19a7703e37a1f2b2dac6990c9c97a745f23cd54c90a4b27f956` |
| Original `input-saved-query-output.spec.test.ts` | `85ebd1305804d95c03f9abfe5f5a61115debacb82e6b701e69a08a4e514932d6` |

Raw task-owned reports: `complete-root-red.{log,json}` and
`complete-frontier-red.{log,json}`; fixture temporary projects use this run's
temporary directory and their existing cleanup. These new logs/reports are
removed at session cleanup; the durable classifications and exact test hashes
above retain the result. Prior sessions' evidence is untouched.

**Next:** task1.2.1, explicit size option/CLI plumbing, then1.2.2 and the remaining
approved implementation units. Required documents exist; historical preflight
has no unresolved findings; AR-P9–AR-P11 and the two bounded execution findings
are resolved. The original phase baseline, complete final review/full owned test
gates and all963/725/resource limits remain. This RED tree is not committed:
the one-time WIP backup exception is spent, and no new exception or push exists.

Final continuation validation: eight touched Markdown prose checks, two touched
TypeScript style/file-ceiling checks,159local file links, whitespace and
documentation/credential-pattern checks pass. Parent task lines remain exactly
unchanged at38/48. Root confirms the startup diff is exactly AR-P9's one-line
deletion; runtime bytes are restored; the original four-file mode/helper diff
against the phase baseline remains within AR-P4. Compiler, frozen specification/
expert, native charters and portfolio have no new changes. Temporary logs and
structured reports are removed at wrap-up; durable results/hashes remain above.
Resume at1.2.1 without another effort-only pause; no additional approval is
needed for the already approved implementation scope, but its normal ambiguity,
oracle, review and complete GREEN checkpoint gates remain binding.

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

- [x] 1.2.1 Add explicit size to the existing public/CLI selections and help without changing other option rules — `services/types.ts`, `packages/cli/src/args.ts`, `packages/cli/src/render.ts`; 03-03 public mode, ST-1/ST-2. ✅ (completed: 2026-10-15 22:00 CEST; fresh build/typecheck,62CLI tests,61built-parser/help assertions and three-file formatting/documentation checks pass; bounded correctness/security reviews clear; public-mode suite remains7baseline passes/3expected service-guard failures; no size build qualification)
- [x] 1.2.2 Wire validated size, reusable checked source input and typed nonterminal canonical resource outcome, leaving none canonical — `services/services.ts`, the already-approved `services/size-selection.ts` reference owner and necessary machine input types; 03-03 interfaces/reference/public mode, ST-29. ✅ (completed: 2026-10-15 22:36 CEST; build/typecheck,14service tests,13boundary probes,7unchanged none artifact identities and AR-P12 concrete SFA fix review pass; source-error precedence GREEN; actual size candidate construction remains1.2.17)
- [x] 1.2.3 Define source-associated closed-object facts and finite direct-origin propagation — `semantic/closed-object-facts.ts`; 03-01 interfaces/whole objects, ST-4/ST-5. ✅ (completed: 2026-10-15 22:49 CEST; build/typecheck,7real-source forwarding/ambiguity/callable/member/unsized/result/32/64-site probes and327-line style/documentation checks pass; source-identity facts only, no lowering consumer enabled)
- [x] 1.2.4 Close bounded footprints, object stability and early-publication obligations — `semantic/closed-object-facts.ts`, `semantic/aggregate-place-proof.ts`; 03-01 effects, ST-6–ST-8/ST-21. ✅ (completed: 2026-10-15 23:09 CEST; build/typecheck,11checked-source effects/wrap/stale-fact probes and21unchanged helper regressions pass; bounded base/SFA/platform Astra reviews clear; source facts only, final physical/domain/selected obligations remain later gates)
- [x] 1.2.5 Derive access-complete binding occupancy over CFG positions, including write/marshal/deferred-read obligations — `semantic/local-storage-lifetimes.ts`, `semantic/value-lifetimes.ts`; 03-01 local lives, ST-16. ✅ (completed: 2026-10-16 00:14 CEST; build/typecheck,85regressions,10retained source cases,real aggregate producer RED→GREEN,scalar output fingerprints and one SFA fix review pass; AR-P13 fixes clear; source occupancy remains conditional until selected access/observer closure)
- [x] 1.2.6 Derive canonical finite induction and exact exit/counter obligations — `semantic/fixed-loop-facts.ts` and already owned checked-source/peer handoffs; 03-01 induction, ST-13–ST-15. ✅ (completed: 2026-10-16 01:40 CEST; build/typecheck,9source cases,3new logic regressions,67combined regressions/45boundary tests,7none identities and one concrete SFA fix review pass; AR-P14 fixes clear; range/home/register premises remain conditional)
- [x] 1.2.7 Hand selected source facts/recipes to per-function lowering without reanalysis or none-path changes — `machine/lower.ts`, `machine/lower-function.ts`, `machine/lower-state.ts` and necessary existing machine types; 03-02 integration. ✅ (completed: 2026-10-16 01:55 CEST; build/typecheck,618directed cases/61files,45boundary tests,7unchanged none identities and base/SFA/output reviews pass; internal source packets only, no rewrite active)
- [x] 1.2.8 Consume unique object/destination recipes through existing aggregate/call owners — `machine/lower-aggregate-place.ts`, `machine/lower-call.ts`, `machine/lower-aggregate-build.ts` and exact AR-P15-approved `machine/lower-aggregate.ts` consumer; fixed-object-address/direct-fixed-result, ST-4–ST-8. ✅ (completed: 2026-10-16 06:53 CEST; build/typecheck,625directed/45boundary cases,7none identities,4sequential native transition fixtures and one base/SFA/output fix pass clear; AR-P16 fixes qualified; selected inventory/final observers/public size constructor remain later gates)
- [x] 1.2.9 Implement exact byte-window/short-edge retention and value-preserving comparison — `machine/byte-value-availability.ts`, `machine/lower-register-forwarding.ts`, `machine/lower-comparison.ts` and necessary existing machine type/function handoff; ST-9/ST-10. ✅ (completed: 2026-10-16 08:13 CEST; AR-P17 joint flag/sibling/A correction,641directed/45boundary tests,4exhaustive grids+12saved-status cases,7none identities and base/SFA/output reviews pass; pending physical/A/P/read observers not discharged)
- [x] 1.2.10 Consume proved invariant complement/dual-byte availability — `machine/byte-value-availability.ts`, `machine/lower-unary.ts` and necessary already owned source-proof/function/state/control/forwarding handoffs; ST-12. ✅ (completed: 2026-10-16 12:41 CEST;671directed/45boundary cases,32sequential native fixtures,7unchanged none identities and bounded base/SFA/output dispositions pass;3MINORmetadata fixes qualified; final observer/size-constructor/complete-cost gates unchanged)
- [x] 1.2.11 Certify selected Boolean exits and consume only proved returned flags — `machine/byte-value-availability.ts`, `machine/lower-call.ts`, `machine/lower-control.ts` and necessary existing lowering/type handoffs; ST-11. ✅ (completed: 2026-10-16 14:05 CEST;20logic/691directed/45boundary cases,4sequential256-value native fixtures,7unchanged none identities and bounded base/SFA/output reviews pass; final observer/storage/cost/public constructor gates unchanged)
- [x] 1.2.12 Select exact low-byte/register/flat-eight loop alternatives with original exits/effects — `machine/fixed-loop-selection.ts`, `machine/lower-function.ts`, `machine/lower-bounds.ts` and necessary already-owned source/state/type/typed-index handoffs, plus exact AR-P25 `machine/bind.ts` correction; ST-13–ST-15. ✅ (completed: 2026-10-17 10:37 CEST;776directed/45boundary cases,224final sequential native cases/144fresh artifact identities,7none identities and bounded base/output fix dispositions pass; AR-P24–AR-P27 and metadata correction qualified; source/backend recipes only, final full storage/observer/debug/cost/phase gates remain; local meets tracked in#114; owned scratch removed)
- [x] 1.2.13 Close selected logical/storage recipes and actual private interference through existing allocation — `storage/selection.ts`, `storage/inventory.ts`, `storage/interference.ts` and exact AR-P28 consumer handoffs; 03-02 SFA recipes, ST-16. ✅ (completed: 2026-10-18 03:06 CEST; AR-P28/AR-P29 logical/projection/covered-occupancy units pass817directed/45boundary cases,42targeted cases,60native value/order/count cases plus6canonical-occupancy controls,7none identities and bounded base/SFA/output reviews;72-chain selected/shared closure fits without canonical allocation; final call/observer/startup/debug/public size/963/725/phase gates remain; owned scratch removed)
- [x] 1.2.14 Hand precise call-site live requests and startup-held stack demand to closure — `machine/lower.ts`, `storage/storage-types.ts` and AR-P30's exact three stack consumers/existing test concerns; 03-03 closure/startup, ST-16/ST-17. ✅ (completed: 2026-10-18 11:58 CEST;835directed/73files,71targeted cases,45boundaries,8native helper cases+1conservative-helper control,7none identities and base/SFA/platform/output reviews pass; actual current constructors remain0held/1transient and instructions unchanged; task16held-P/IRQ-boundary proof remains separate; owned scratch removed)
- [x] 1.2.15 Validate feasible/reference-rejected observer outcomes and complete candidate bank footprints without inventing missing intervals — `services/size-observers.ts`, `services/shared-storage.ts`, AR-P32/AR-P33/AR-P36/AR-P38–AR-P83 exact concerns; 03-03 observer order, ST-6/ST-21/ST-24/ST-29. ✅ (completed: 2026-10-31 23:45 CET; AR82 addressing fix read619/occurrence617; fresh strict/build/typecheck,901owned/45boundary,6ACME/120VICE; artifacts byte-identical, native only live-P bit5; SF001 accepted fixed for bounded seam; #133 tracked by AR-P83;27/40,no commit/push.)
- [x] 1.2.16 Add fully proved held-P startup/preservation alternatives and final placement integration — `layout/startup.ts`, `layout/c64-layout.ts`; 03-03 startup, ST-17–ST-20/ST-22. ✅ (completed: 2026-11-01 00:30 CET; compact held-P constructor `PHP;SEI;CLD`, held byte 1/transient 2, 3 mapping bytes, exact main-entry/restore copy; unit and real ACME/VICE probe with borrowed $03 pass; selected-loop held-P branch under AR-P84 at exactly700 lines; four existing implementation tests updated only for compact facts; focused187/187, owned983/983/29files,45 boundaries, strict/build/typecheck; `none` spec passes; compact looped recipe remains in 1.2.17; 28/40,no commit/push.)
- [x] 1.2.17 Construct all admitted fixed bundles/loop/startup recipes, with at most37 outer attempts, and close each through existing service owners — `services/size-selection.ts`, `services/services.ts`; 03-03 finite alternatives/closure, ST-23/ST-24/ST-29. ✅ (completed: 2026-11-01 CET; finite `sizeSelectionPlans` derives Direct/Closed × applicable loop policy × Full/CompactUnrolled/CompactLooped, at most36 plans + reference; `closeSizeCandidate` closes each through actual logical storage, selected lowering, SFA/shared layout and final observer validation; CompactLooped uses contiguous borrowed bytes with six startup blocks, exact capture/restore loops and multi-block startup layout; size-only ordinary-RAM startup eligibility and explicit final-placement proof added; `services.ts` constructs every admitted tuple and leaves only closed-cost selection unfinished; scratch constructions: plain6/6, no-loop placed2/2 (1 complete), 72-chain2 (1 complete), startup-owned6/6 with 10-byte looped state; 983/983/29files,45 boundaries, build/typecheck; looped startup not yet ACME/VICE-qualified;29/40;13frontier/publicsize/963/725remain; no commit/push.)
- [ ] 1.2.18 Select by closed costs and implement only the approved v1 feasible-baseline validation correction — `services/size-selection.ts`, `services/evidence.ts`, `artifacts/costs-evidence-validator.ts`; 03-03 comparison/evidence, ST-3/ST-22–ST-26/ST-30. (partial: closed-cost selection, decision evidence and rejected-baseline v1 validation implemented; 27/27 frontier cases pass including 32/64/72-chain on four profiles and compact startup restoration; blocked before closure by AR-P85 — acquisition still rejects asynchronous borrowed backing and then raw/MMIO/global-return/loop/typed classes, leaving2442 against963; saved has no asynchronous route; its complement-ordering defect was corrected and LowByte now selects1623 (Original1860), but X-Y/FlatEight selected-loop proof and the remaining898-byte gap leave725 unmet. AR-P85 resolved by user decision “Stop and reopen RD-08”; this prerequisite stops at29/40 and tasks1.2.19–1.2.20 are not executed.)
- [ ] 1.2.19 Populate final source/register/rematerialized availability and optimization ranges — `services/evidence-records.ts`, `services/debug-storage-locations.ts`, `services/debug-machine-ranges.ts`; 03-02 debug recipes, ST-28.
- [ ] 1.2.20 Rerun all new specifications and every original input specification, recording complete actual source/assembly/artifact/resource identities and independent answers — this journal; ST-1–ST-30, AR-P4 unchanged limits.

Compiler paths above are relative to `packages/compiler/src/`; the three CLI
paths are explicitly repo-relative. Selected types may add only necessary
fields to existing internal machine/storage owners. No blanket module rewrite,
new root export, dependency or unlisted support family is allowed.

Implementation resume, 2026-10-15 21:56 CEST: user says **“proceed”** after the
explicit next-task handoff. Existing auto-design/auto-commit chain continues in
strict scope, green local commits only and never automatic push. Root confirms
the feature branch, required documents, eleven resolved AR rows, passed preflight
and latest specification files. The original phase baseline remains unchanged;
all inherited uncommitted specification/status work is preserved.

Minimum-sufficient checkpoint for1.2.1: widen only the two existing option unions,
extend the parser's existing exact-value allowlist and update its help line.
No helper, dependency, default/manifest change, new export or support surface.
A pre-edit real built-parser probe is RED for explicit size. Root records the
three pre-edit source hashes in the task-owned temporary directory, excluding
inherited dirty work from this bounded unit. Service validation, candidate
construction and complete optimized evidence are not implemented by this task.

Task1.2.1 directed qualification, 2026-10-15 22:00 CEST: fresh `yarn build`
passes in2.60s, `yarn typecheck` in0.71s, and the complete CLI workspace suite
passes62tests across8files in7.63s. A real built-parser/help probe has61passing
assertions: build/run, separate/equals forms, both admitted values, omitted
override, unknown/injection-like/case/whitespace/missing/duplicate values,
check/informational restrictions and unchanged Boolean guards. It invokes no
compiler service, native assembler or publication action.

The unchanged public mode specification runs completely in5.09s:7baseline passes
and3expected failures. The size CLI case now passes parsing and reaches the same
`SERVICE_INVALID_OPTION` as the API because runtime admission is task1.2.2.
No fake size result, implicit fallback, fabricated decision or new generation is
introduced. This is a locally verified option-surface unit, not successful size
builds, optimization, full-suite GREEN or full-phase review clearance.

Bounded independent correctness and security reviews report no findings. The
correctness reviewer excludes incidental historical routing-smoke summaries
from its evidence; neither reviewer runs commands or changes files. Their
routing default is high; no model/variant change is claimed. Security concludes
new selections remain data, with no shell interpolation or widened native-agent
capability. The unchanged runtime guard follows project loading but precedes
lowering/tool/publication. All six final phase review lenses remain task1.3.7.

The three changed production files pass existing100-column TypeScript formatting,
file ceilings, whitespace and the junior-readable documentation/reference
self-check. Their pre-edit hashes are types
`ab3375509c9f0d96324aed6632a0c972daf93ff722a3b1b2ddf09423e228ac82`, args
`ab4b8ca027b56ae2a9f15acf3e5918b0e3d4590a5d809b8d19d9d35aa6b10beb`, render
`7a5b6b54ccd0beeb90f2e4c098fba4a17391d35ade2158478f35cbb3a418cd53`.
Unit-start oracle hashes remain unchanged, including all inherited exact
exceptions; frozen specification/expert paths remain clean. Task-owned
`baseline.json`, parser/build/typecheck/CLI/format logs and structured mode
report are temporary and removed at wrap-up; durable outcomes remain here.

Continue at1.2.2: runtime validation, reusable checked input and typed nonterminal
canonical resource outcome. Its service owner is already724lines, so respect
the existing focused-module/file-size and reviewable-unit gates before adding
the next mechanism. No new support family or broader edit authority follows.
The inherited RED composite still forbids a commit, and no push is authorized.

Wrap-up validation passes:3production TypeScript and5Markdown prose checks,
154local file links,13/40verified task parsing, exact three-file production scope,
unchanged unit-start oracle hashes, file ceilings, whitespace and documentation/
credential-pattern checks. Feature/parent status is synchronized; the portfolio
is untouched on this non-integration branch. All this run's logs, report and
native temporary caches are removed during cleanup. No full compiler-suite pass
or phase checkpoint is claimed. The first incomplete task remains1.2.2.

User continuation, 2026-10-15 22:15 CEST: **“If possible, proceed until all 40
items are done.”** Continue the existing strict auto-design execution chain;
do not pause at routine task boundaries. Reserved scope/oracle/complexity and
native-permission gates, independent reviews, GREEN-only local commits and no
automatic push remain unchanged. All inherited work and phase baseline remain.

Task1.2.2 is divided into reviewable subunits before production edits:

1. Retain the immutable checked semantic input separately from canonical SFA;
   extract the existing allocation/binding path into the already approved
   `services/size-selection.ts` owner so `services.ts` falls below its724-line
   size. This is a relocation within the existing phase modification set, not a
   new pipeline layer or additional support module.
2. Carry specifically identified allocation, finite stack and final-layout
   resource rejection as typed data with only actually available facts. Keep
   incomplete lowering, unbounded routes and invalid certificates terminal;
   retain exact legacy diagnostics for `none`.
3. Admit only explicit `none|size` service values. Wire checked source/reference
   handoff for the later candidate constructor without publishing a substitute
   `none` result as qualified size output. Verify unchanged-none artifact bytes,
   source-error precedence, no-generation/cancellation and original service tests.

The existing03-03 service extraction/PF-002 contract determines this placement;
no new material design or complexity decision is introduced. Machine recipe
fields remain owned by their actual consumers in1.2.7 rather than adding unused
type fields now. The40 task identities and original acceptance criteria stay
unchanged. Root captures pre-edit source/oracle hashes and a canonical native
artifact identity before the first subunit; no spec-test edit is authorized.

First1.2.2 checks: build/typecheck pass;14original service tests pass in13.32s;
the complete frontier now has14passes/13remaining failures in31.33s, with size
source-error precedence newly GREEN. Seven actual none artifact identities and
diagnostics are unchanged. Files format to546/349lines. Size remains explicitly
incomplete before tools/publication until the later candidate constructor exists.

Independent Astra base/high and SFA/xhigh dispatch overrides are accepted under
the live routing update; primary settings and native charters are unchanged.
The concurrently edited AGENTS/routing/configuration files are user work, not
part of this compiler diff. Two SFA MAJOR classification findings and one base
MINOR cancellation finding are recorded with distinct RF-prefixed ledger IDs;
AR-P12 resolves their necessary in-scope technical remedies. Task stays partial
until concrete correction, directed proof and one SFA fix review pass. Native
external baseline denials are respected; authorized source excerpts are supplied
inline, never by changing permissions or retrying the denied operation.

AR-P12 concrete fixes: validate the complete initial/lowering request contents
before the legacy resource tag is interpreted; exact restore no-fit becomes
resource-rejected; driver storage-before-layout cancellation ordering is restored.
One SFA fix review clears both MAJOR findings and statically confirms the base
cancellation correction, with no findings. Its denied external preimage is not
retried; parent-authorized original source excerpts plus actual current code
establish the bounded ordering claim.

Fresh fix build/typecheck and all14service tests pass (12.61s); seven none
artifact identities/diagnostics remain unchanged. Eight predicate checks over
a real storage request and five actual pipeline checks pass:72-call resource
rejection/no invented layout, mandatory partial-array lowering failure terminal,
exact synthetic restore no-fit and both none/size cancellation checkpoints.
The public mode file remains7baseline passes/3honest size-constructor failures
in5.14s. No new native optimized result is implied. Final selected-candidate
acceptance must still prove the mixed resource-plus-private-NMI/mandatory-error
composition; that boundary remains explicit in1.2.17/1.3.3, not waived here.

Minimum-sufficient checkpoint for1.2.3: one already-approved semantic module;
reuse actual semantic identities, reachable CFG bodies, type equality and value
definition indexing. A finite monotone source-root propagation follows direct
whole-object borrows and hidden caller destinations only. Addressed/callable,
indirect, unsized, member, captured, differing and unknown origins stay generic.
No alias solver, source-name recognition, physical address or instruction rewrite.
Facts retain exact source function/operation objects; identity alone does not
discharge stability, early publication, domain/lifetime or final observer duties.

Task1.2.3 source-fact qualification: seven real checked-source scenarios prove
three-level parameter forwarding, distinct-object rejection, callable-entry
fallback, member/unsized fallback, two-level caller-result forwarding and32/64
independent sites without per-site choices. Build/typecheck, formatting,
documentation/reference and whitespace checks pass. Module is327lines; maps
retain actual source function/call objects. Reviewable internal units are type/
body inventory, direct source edges and finite propagation; no extra module or
task count. No generated instructions change until the later verified consumer.

Reviewable1.2.4 subunits before implementation: (a) bounded logical raw-access
footprints using existing literal/unsigned-range facts, including16-bit wrap;
(b) typed/borrow/escape and transitive/async source observations; (c) conditional
object stability and early-publication results with explicit final physical
obligations. Keep code in the two already named semantic owners. Reuse current
platform-disjointness guards, not a new device/alias engine. Loop-specific bounds
remain supplied by1.2.6; missing bounds stay unknown rather than using an array
extent as proof. No source restriction, unqualified lifetime certificate or
instruction selection is introduced by these observations.

Task1.2.4 qualification: exact word wrap, literal-plus-proved-ordinal ranges,
unknown footprints, typed/root containment, transitive/async writes and old-result
observation are retained without inventing private addresses. Optional bounds
must name the exact source program and actual function objects; stale input is
an invariant failure. Array extent alone is never a proof. Existing helpers are
unchanged; only the focused footprint queries and new object-fact owner are added.

Eleven checked-source effect/provenance cases pass, as do build/typecheck and
21unchanged returned-local helper regressions (2.24s). The first temporary probe
used an unqualified function-name lookup and stopped there; the corrected host
lookup uses the actual qualified source name and normative import placement.
No source answer, production behavior or specification expectation changes to
make that probe pass. The failed initial probe is not qualified evidence.

Bounded Astra base/high, SFA/xhigh and platform/xhigh reviews all return no
findings. Incidental historical routing summaries are excluded by all reviewers.
Their endpoints are static source-fact consistency, not emitted code, physical
closure, native behavior or963/725 outcomes. The original963/725byte limits,
independent eight-file oracle identities and final stage gates remain unchanged.
All new source observations must still be validated against actual reference/
candidate homes, banks and dummy accesses before a recipe can be accepted.

Reviewable1.2.5 subunits before implementation: (a) expose a conservative operand
query without changing existing SSA liveness; (b) derive private binding backward
CFG occupancy and all surviving write events; (c) extend backing homes through
potential deferred SSA consumers and last-use argument delivery, retaining the
common incoming marshal group. Address-exposed automatic objects stay conservative.
This is conditional source occupancy, not standalone alias/observer clearance;
later selected-access coverage and final physical observations remain mandatory.
Use only the two named source owners, existing positions and ValueLifetime shape.

Initial1.2.5 checks pass build/typecheck, ten real source occupancy cases and all
84storage/nested-constant regressions across9files (8.05s). Base review has no
findings. SFA reports MAJOR LF-SF-001 for a missing aggregate destination backing;
root confirms the exact real checked-source producer with no explicit address.
Performance reports MINOR LF-PE-001 for cubic full-root retransmission; separate
right-nested and disjoint-scope measurements are recorded in AR-P13. That ruling
selects the bounded fixes and an early seed of the already owned adjacent logic
test;1.3.1 remains unverified. No source/assembly/limit/oracle amendment or added
consumer is authorized by a successful source-fact probe.

AR-P13 final qualification: the new adjacent implementation regression has
meaningful missing-backing RED before the fix, then GREEN. The real checked
`consume(buffer=[7], dead=2)` producer now conflicts correctly; no explicit
address pinning hides the issue. One SFA fix review clears LF-SF-001 and confirms
complete delta delivery through previously processed/queued consumers and cycles.
The pre-fix source SHA is
`31b90a06554bba1b224152ea92b9c8e38444daf8e1747be60eabb2ca6207bad0`.

Right-nested32/64/128 probes preserve exact full lifetime-map fingerprints while
membership checks drop6,642→2,147;48,098→8,387;366,530→33,155. Instrumented
times13.101→11.377ms,44.150→40.450ms,186.443→160.789ms are observations only;
peak RSS is75,320/84,584/111,956KiB after correction. No uniform speed ratio or
wall-clock correctness gate is claimed. Full root sets remain intact; only pending
new facts are forwarded. LF-PE-001 is fixed without adding a cache/solver.

Fresh `yarn build`/`yarn typecheck`, the existing storage/nested-constant tests
plus the new adjacent regression (85cases/10files,8.45s), and all ten prior real
source occupancy cases pass after correction. Explicit100-column style, JSDoc/
reference/whitespace/file-ceiling checks pass. Eight oracle hashes remain exact
and `git status --porcelain -- spec` is empty.1.3.1 remains incomplete; the one
early regression does not count its later invalidation suites done. No inventory,
domain/physical overlay, selected-code or native qualification is implied.

Reviewable1.2.6 subunits before implementation: (a) structural header/preheader/
unit-update and private unsigned-word recognition, without block-name heuristics;
(b) literal and already recognized parent-plus-one domains, abrupt exits and
outside uses; (c) conditional source value maxima and exact-eight body admission.
Counter-range facts retain the no-alias/visibility observer premises explicitly.
Any range used by another rewrite must carry those loop premises into the
existing whole-tuple final observer gate; source structure is not a physical
counter certificate. No additional dependency engine or source restriction.

Actual lexical depth cannot be inferred reliably from CFG backedges after an
abrupt/non-repeating source parent is normalized. Retain only immutable nesting
records from the existing checked frontend tree, keyed by actual source function
and condition span. The already owned checked-source/service files hand this
size-only context to the fact query; `none` performs no optimizer AST walk.
No parser, frontend reanalysis, CFG/IR owner change, label-name heuristic, new
module or support surface is added. Initialization dependency and lexical
register-policy depth remain distinct facts.

Initial1.2.6 verification passes: fresh build/style/typecheck; nine source loop
cases; explicit premise-carry/stale-peer checks;7unchanged none artifact/diagnostic
identities;64CFG/service/induction cases across5files (13.63s);45root import
boundary cases across3files (2.00s). Semantics/DX review has no findings after
authorized literal/definition/place helper evidence closes its initial Unknown.
The reviewer runs no native tools; no source restriction or width change follows.

SFA reports MAJOR LO-SF-001: typed indexed stores/aggregate destinations must not
vanish from counter observer premises. Base MINOR LO-RV-001 requests variant
property JSDoc and raises source-context identity after canonical reservation.
AR-P14 selects the bounded complete-inventory/stage-separation fixes and early
seed of the already planned fixed-loop logic test. All pending premises still
require actual counter-home/domain/bank validation before any selected recipe.

AR-P14 qualification: three adjacent fixed-loop logic cases are GREEN after two
meaningful initial failures (missing typed observer and canonical metadata),
with the premise-carry case already passing. The observer inventory now retains
all typed place uses as well as raw/call/borrow/platform operations. Canonical
storage omits source-only lexical metadata rather than rebinding its provenance;
the original checked input remains unchanged after explicit ZP reservation.
Initializer variant fields have complete JSDoc. No new source/backend consumer.

One SFA fix review clears LO-SF-001 with no findings and confirms the exact
typed-operation identities/context separation. Initial semantic preservation and
modern-DX reviews are clear after helper evidence; base MINOR corrections are
complete. Final `yarn typecheck` and six CFG/service/induction/logic files pass
67cases in13.95s;45root boundary cases passed in2.00s;7actual none artifact and
diagnostic identities remain byte-identical. Documentation/file-ceiling/whitespace
checks, eight original oracle hashes and empty frozen-spec status pass.
The681-line loop owner/604-line object owner retain conditional premises; no
physical counter, selected register, native runtime or963/725-byte claim follows.

Reviewable1.2.7 subunits before edits: (a) add only current internal fact packet
types in `machine-types.ts`, indexed by exact immutable source function; (b)
move the existing function value-use inventory unchanged into `lower-state.ts`
so the735-line function owner falls below the ceiling; (c) validate source/fact
identity once on selected lowering entry and carry that per-function packet into
state. No rule is enabled, reanalysis performed or generic ABI changed here.
The original checked source may differ from the lowering program only by the
existing zero-page global placement reservation; exact functions, effects,
routes, domains, bodies and all other analysis remain the same. A stale or
cross-program packet fails as an internal lowering invariant, not silent fallback.
The already owned fixed-loop logic test gains bounded handoff/provenance checks;
1.3.1 remains pending. No new owner family, proof graph or optimizer layer.

Task1.2.7 qualification: `yarn build` (2.42s), `yarn typecheck` (1.62s), and
`yarn workspace @blend65/compiler test src/semantic/fixed-loop-facts.impl.test.ts
src/machine src/storage src/services/services.spec.test.ts
src/services/services.impl.test.ts` pass618cases/61files (36.71s). Three root
import-boundary files pass45cases (1.92s). Five-file100-column formatting,
documentation/whitespace/ceilings and eight unchanged specification hashes pass;
frozen `spec/` status is empty. Seven actual ACME none artifacts and diagnostics
remain byte-identical to the retained pre1.2.2 fixture.

Independent Astra base/high, SFA/xhigh and emitted-code/xhigh bounded reviews
all report no findings. They inspect source identity and the exact old-inventory
excerpt/current relocation, not independently run native commands. Static output
invariance is zero instructions/effects/ABI/storage change for this unit; it is
not a full-input expert-parity result. Historical guidance snippets incidentally
returned to reviewers are excluded from decisive evidence. Actual selected-code,
physical/cost/native gates remain pending. The function owner is655lines (from735),
state673, lower661 and types330; no additional support module is introduced.

Continuation boundary, 2026-10-16 01:59 CEST: read-only investigation of1.2.8
finds the necessary direct-access/caller-destination consumers in existing
`machine/lower-aggregate.ts`, outside the exact source list. One blind ownership
challenge establishes that adding only this existing owner is sufficient; the
return owner need not expand. AR-P15 requests that exact reserved scope decision.
No implementation/staging helper in1.2.8 is written and no additional owner is
edited. Tasks1.2.8/1.2.17 are visibly blocked; completed count remains19/40.
The user asked to continue all40 where possible; this is a reserved path boundary,
not an effort confirmation or request to redesign the already approved mechanism.

Continuation, 2026-10-16 06:21 CEST: user requests the interrupted AR-P15 question
again and selects **“Approve addition (Recommended)”**. Only the existing
`machine/lower-aggregate.ts` consumer joins the exact modification set; the
return owner stays excluded. Tasks1.2.8/1.2.17 return to not-started, not verified.
Existing auto-design/green-local-commit/no-push authority continues unchanged.

Reviewable1.2.8 subunits before edits: (a) seed only the currently consumed
conditional fixed-object/result descriptor in the already approved
`storage/selection.ts`, adding its necessary machine packet field and root
resolution; this does not complete1.2.13's inventory/interference work; (b)
consume direct roots in existing aggregate address/destination selectors, with
the exact AR-P15 owner and ordinary fallback; (c) consume agreed direct-call
parameter/result recipes before generic marshalling/preparation. Caller/callee
share one immutable selected descriptor. Facts alone still enable no rewrite.
Direct result-local eligibility admits only the same complete fresh constant
initializer and whole returned identity, with bounded member accesses and no
escaping/captured local address; conditional induction premises remain attached.
Incomplete initializers or ambiguous return shapes retain ordinary lowering.
No snapshot is replaced by a later read merely because a parameter is readonly.

Initial1.2.8 checks: fresh build/typecheck pass;623directed cases/62files pass
in41.03s,45boundary cases in2.13s, and7actual none artifacts/diagnostics remain
byte-identical. Six checked-source recipe probes pass, including old-destination,
multiple-object and callable fallback. The first scratch probe incorrectly asked
for word-index narrowing before its owner exists and failed; its corrected
boundary checks hidden-result-pointer removal and the direct quality store only.
That initial failure is not counted as passing or used to change any oracle.
The small returned-pair route has40→16function instruction bytes, not a complete
artifact or resource vector. Inventory elision and final physical proof remain due.

Base review reports MAJOR OB-RV-001: the recipe guard must bind `resultLocal` and
the full `resultRoots` replacement map, not only source function/fact identities.
The task remains partial; SFA/output reviews and the concrete correction gate
are pending. No malformed-recipe waiver or public size output is authorized.

Output review additionally reports MAJOR OB-MC-001: a fixed-result relay must
not forward an undelivered hidden pointer into a generic aggregate callee. The
exact source witness returns a resident seed from `make`, then forwards through
`relay` into fixed `item`. Generic and fixed entry agreement is a current ABI
obligation, not something deferred to physical observer closure. The existing
call owner can deliver the actual fixed destination to the generic callee while
retaining the already-delivered marker; the excluded return owner stays untouched.
Concrete qualification and one bounded fix review remain required.

AR-P16 concrete qualification, 2026-10-16 06:53 CEST: both new implementation
regressions have meaningful RED (two failures/five prior passes), then seven
GREEN cases. A private immutable producer seal binds complete replacement data
and exact function/facts/producer-entry identity after the shared map is complete.
One complete installed-bundle check prevents stale root replacements from an
omitted caller recipe. No registry, public checksum, repeated source analysis,
additional source owner or return-owner edit is introduced.

The mixed bridge supplies the actual fixed destination through the existing
generic place-destination helper and marks delivery only after preparation
succeeds. Fresh build/typecheck and625directed cases/62files pass in41.14s;
45boundary cases, seven actual none identities, all eight specification hashes,
empty frozen-spec status and the excluded return-owner status remain clean.
Source files stay within ceilings; the adjacent object logic file is299lines.
Base/SFA/output each perform one concrete fix pass and clear their assigned
findings. Output raw external-artifact access is natively denied and not retried;
its clearance is explicitly static/template-based, not independent raw-byte proof.

The exact mixed source is assembled through existing closure/layout/serializer
owners and ACME, then executed with the unchanged pinned VICE runtime/monitor
helpers compiled only into owned scratch. Two calls before the fix leave
`item=[17,34]` and corrupt unrelated `$3600` to`[7,9]`; after correction,
`item=[7,9]`, `seed=[7,9]`, and unrelated`[85,170]` is preserved. Three further
sequential fixtures cover two-hop forwarding, fixed→fixed and generic-only
delivery with the same independent byte/sentinel answers after two calls.
Status is **VICE-verified / hardware-unverified** for these four fixtures only.
The first scratch helper compile omitted TypeScript7's `--ignoreConfig`, and an
initial host assertion tried to stringify a successful BigInt-bearing result;
both fail before CPU execution and are excluded. Correcting scratch flags/logging
changes neither production nor the independently expected destination values.

Native evidence identities (bytes / SHA-256), recorded before scratch cleanup:

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| mixed-before.asm | 13274 | `de7824d5c6d2e7e1aa9e3a84c04827b9eeb262a0b7f63f5494961384cae6e86f` |
| mixed-before.prg | 733 | `a48e8e00b86a4afa9cfc71a62b5a93c886ff27a9ba6310fe302c2d8ee8f72265` |
| mixed-after.asm | 13408 | `b041c8017028980fff682275da4c1a0afedbb2a84bb3e9e3f61f25b5852827ec` |
| mixed-after.prg | 733 | `6e609399274b0f8473da4255c251c296bb13e305ef717cb0e8efa3910cf2409a` |
| mixed-after-twohop.asm | 14093 | `ca77049ab03e5dd8366d74bb983db5173feebc94b72ffab80cfd200ecee0bb28` |
| mixed-after-twohop.prg | 757 | `6b4bc7952b7ab615b0684c43cfad228060b1707eee17813847aae8e1e4fd0e41` |
| mixed-after-fixed.asm | 12604 | `0939020d0913e23d56011013ee2928e0e239e671484570ecdd70214d01655c22` |
| mixed-after-fixed.prg | 693 | `e27f7007e41bd0ab28f0544704ca6b59ab2876fea198632233ad04e93df86022` |
| mixed-after-generic.asm | 13638 | `ff64074772941d5b998f3204d1031cfb6dc3c5cdc5aa5cd65af9f28e26a45903` |
| mixed-after-generic.prg | 749 | `c12a19552606364caaf6204b251d3e736ac1d659449d5577543c409cefce9c01` |

These are separate bounded fixture identities, not whole-input cost deltas or
public accepted-generation evidence. The original963/725limits, actual selected
inventory/observer closure,37attempt frontier, full costs, public size builds and
whole-input native qualification remain due. No RED composite commit or push.

The repeated none identity fixture uses project name`none-identity`, normal
v1 manifest spelling with selected`c64-pal-prg-kernal-6581`, explicit
none, both safety flags true, empty assets and the exact following UTF-8 source
with final newline (`src/game.blend`):

```blend
module Game;
struct Pair { a: byte; b: byte; }
function leaf(): Pair { return { a: 7, b: 9 }; }
function relay(): Pair { return leaf(); }
place(at: $3200) let result: Pair;
function main(): void { result = relay(); poke($C100, result.a); poke($C101, result.b); }
```

Before1.2.2 through corrected1.2.8, diagnostics are exactly empty and these
seven actual artifact identities remain unchanged:

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| .asm | 12392 | `577359b995724e0c5e15fbc96f9c4105ce7f9f4f0f573c507380ab51f66326ff` |
| .labels | 978 | `75b122f6e6f00eb46c7f90fb7f248f8b73ca356112206a6cdbbe39d5b2ea0063` |
| .assets.json | 56 | `2d669e0c90f199959a14d1739c58a7f67758063919ba184c3e89f16a5a1e5fac` |
| .memory.json | 5966 | `50aba75646e4390a738e568171e7a323959b7dc9d79a565eeb4b2a4e9cc2fac4` |
| .costs.json | 1169 | `e4a9340120676723bb256229d8803956906706b39e349d34259a2fc7a654d239` |
| .debug.json | 11590 | `32689045f9eaf5fe2cd4c58f00a7239a32263c90745ef72ba12fb622d86cae8d` |
| none-identity.prg | 704 | `361ef52729e2bf6fa5391564c8700cae2f900af7e4be8f656984134bd0ec258e` |

Cleanup before1.2.8 completion: all373task-owned scratch files in the exact
`size-closure-7pm5okil` directory are deleted after recording durable outcomes
and artifact identities above. Existing source/plans, other runtime artifacts
and prior-session retained evidence outside that directory are untouched.

Reviewable1.2.9 subunits before edits: (a) in the already approved byte-availability
owner, match one actual LDA/CMP/branch→LDA/AND edge with a single proved entry,
unchanged operands and no volatile/flag/register invalidation; (b) for the explicit
Closed bundle only, preserve A with byte CMP rather than destructive EOR when
only comparison Z is consumed; (c) retain exact source/edge/logical-address
obligations on the internal machine function, to be discharged against both
reference and candidate homes in1.2.15. This is structured selection, not an
ACME-text rewrite or general register allocator. Facts alone still activate no
rule. The necessary post-shaping call remains in the already owned lower-function
path; existing register-forwarding decisions are reused, not silently widened.
No physical stability, interrupt or volatile-read equivalence follows from a
register-edge match alone. Those pending observers cannot disappear on allocation
failure, home elimination or original loop selection. No v1 evidence keys added.

Initial1.2.9 checks pass fresh build/typecheck and636cases/63files (40.12s).
Four sequential VICE profiles each pass65,536independent byte-pair answers with
actual prefix`AD 00 32 CD 01 32 F0 05 2D 01 32`. This is an internal selected
template, not public size or final-observer qualification. The first directed
filter named one nonexistent old forwarding test path; Vitest actually ran only
two files/24cases. The subsequent complete machine/storage sweep is the recorded
636-case result and does not infer a pass for that missing path.

Parent flags an unproved C/N premise despite those positive value tests; a blind
challenge confirms BW-DC-001. AR-P17 selects ordinary EOR fallback plus joint
window/flag/sibling/A proof before zero-return shaping. Task remains partial;
the initial positive results are not current clearance of the corrected rule.

AR-P17 corrected qualification, 2026-10-16 08:13 CEST: ordinary comparison
lowering is restored exactly. CMP creation and one reload omission occur jointly
only after the actual EOR/short-edge/AND and both continuation prefixes qualify.
An iterative memoized prefix proof rejects calls, unresolved transfers/cycles,
reads-before-definitions and pre-shaped zero arms without matching A/N. It is not
a general flag allocator. The query runs before zero-return shaping; the output
auditor verifies that later guarded-shift shaping requires a non-overlapping
complete-function shape. Transient Z as well as A/N/C, logical byte identities
and source/context/edge information remain pending physical/asynchronous records.
No home, spill, helper or stack operation is introduced or lifetime shortened.

Four negative logic cases have meaningful RED before correction; after correction
all16new logic cases pass, including independent prefix resets. Earlier standalone
comparison hypotheses now correctly expect ordinary EOR without a complete window;
these are new implementation tests, not an existing/frozen oracle amendment.
Fresh build/typecheck,641directed cases/63files (38.81s),45boundary cases (1.96s),
all seven actual none artifact hashes/empty diagnostics and targeted formatting/
JSDoc/file-ceiling/whitespace checks pass. Three inherited exact oracle hashes and
five unchanged HEAD specification files remain intact; frozen specification and
the excluded return owner remain clean. The initial filter's nonexistent forwarding
test is not credited; the full machine sweep supplies its actual coverage.

Actual PAL pre-fix saved-P probes independently reproduce three wrong results:
carry0instead of forced1 after AND, carry1instead of forced0 on the sibling, and
negative1instead of0 on the equality sibling. Corrected balanced PHP/NOP/PLP source
passes all three cases on each of four profiles. One explicit main-entry NOP is
changed in monitor memory to SEC/CLC solely to establish incoming C; the emitted
source gains no new CPU API. The saved stack P byte is read after PHP and before
PLP. The existing pinned VICE helpers are compiled unchanged into scratch.

All four corrected256×256byte grids also pass every independent row answer,
with exact assembled prefix`AD 00 32 CD 01 32 F0 05 2D 01 32`. This is four grids
plus12saved-status cases, run sequentially: **VICE-verified / hardware-unverified**
for these fixtures only. The four grid PRGs are1584bytes with SHA-256
`bcb2f3c6592430c7088b7677b0df46743292d956150f1129a7449c89a9c8fb68`.
Corrected saved-status PRG identities are identical across the four profiles:

| Fixture | Bytes | SHA-256 |
| --- | --- | --- |
| PHP after AND | 677 | `c2adba263c52fb4c86b09e1310a659e5759328d4ba7725fd49550320eb6a330d` |
| PHP on sibling | 672 | `3b04671ae6b5ba5ecd3ea23b01233e5d462edcd5abb376e19b3fe8043f56063b` |
| Sibling negative flag | 674 | `a8deb13c3b30dc2e2f0ab5e145ece7a32951deebbd2e66740e1e6938e11cfd20` |

Base, SFA and output bounded reviews all report no findings and clear BW-DC-001
at their assigned endpoints. Base receives four captured-preimage diffs and three
explicitly reconstructed small supporting diffs; no falsely independent baseline
claim. SFA's requested active-router/lifetime/final-closure/full interrupt-gate
excerpts close its authority Unknown without hidden reads or a new route audit.
Output external artifact access is denied and not retried; its byte/runtime claims
remain parent-reported. Static local absolute-prefix costs are14→11bytes and
18→14nominal cycles on the executing AND path; the skipping branch remains11–12
cycles. Those are not complete predicate/artifact wins or whole-input cost proof.
Final15/17observer/constructor and full qualification remain mandatory; no public
size success, complete963/725outcome, hardware or external-NMI guarantee follows.

Cleanup before1.2.9 completion: all179task-owned files in the exact
`size-byte-yr2y_qfp` directory are removed after durable outcome/identity recording.
Other runtime directories, source and retained evidence are untouched. No green
composite checkpoint or push is claimed while the remaining specification groups
still await their implementation owners. The next incomplete task is1.2.10.

Continuation boundary, 2026-10-16 08:41 CEST: task1.2.10 remains not implemented.
The current byte edge/flag logic file is382lines; complement coverage needs its
own adjacent concern rather than more mixed tests. AR-P18 asks for exactly one
additional implementation-test path under the current named-file contract. No
new mechanism, harness, API, oracle or cost-limit decision is requested. The
missing test-path approval blocks10/17/1.3.2, not a model/effort confirmation.

Continuation, 2026-10-16 11:16 CEST: user asks the interrupted prompt again,
then approves the exact AR-P18 complement logic-test path. Affected tasks return
to not-started; completed count remains21/40. No broader production/test family,
oracle edit, scope exploration, runtime or numerical-limit waiver follows.

Reviewable1.2.10 subunits before implementation: (a) source-associated complement
facts for pure stable byte loads in the admitted loops and double-complement
field views; (b) one predeclared SFA cache before a positive entry-dominated loop,
with all subsequent loads bound to that cache; (c) exact adjacent pure bitwise
use of a stable original field, plus ordinary eager value fallback. Volatile,
mutated, opaque, unsized or unproved cases retain ordinary lowering. Keep all
logical/physical source, loop-range, old-home, new-read and changed A/P obligations
for the final observer gate. No source-name/address recognition or new analysis
framework. Reuse the current machine label operand's byte offset for scalar
field views; add only the missing retained-label offset/handoff in the existing
control owner. The near-ceiling state owner may move its bundle-tag predicate
to the existing selection owner, preserving exact failure order/messages; no
additional helper module or new exception hierarchy.

The new complement types/source matching bring the byte owner to644lines before
runtime preparation. Keep conditional global-byte stability in the already owned
`semantic/aggregate-place-proof.ts` source-effect query owner, with per-function
indexes/root memoization; do not add a helper module or push the byte owner past
700lines. Source facts remain distinct from candidate machine values and final
physical observer acceptance.

First directed compile exposes only ordinary TypeScript narrowing/contextual
typing errors, not a test pass. Formatting puts combined fact+emission code at
769lines; move cache-home/prefix emission into the already owned unary lowering
owner, leaving source availability facts in the byte owner. This preserves the
approved two-owner responsibility split and adds no helper module or layer.

Task1.2.10 initial qualification: source-only facts are derived once per function
and sealed by immutable source/operation/recipe identities. Mainline Closed
runtime preparation declares one preferred-ZP SFA byte for a shared global
complement, or no storage for an exact original-field view. Old local/read homes,
new reads/cache writes, range-counter premises, possibly obsolete left captures
and changed A/P remain final observer obligations. IRQ/NMI/Direct/unproved cases
stay ordinary. The no-code classification consults actual provisional argument
stages before preserving a left A. Retained labels now carry packed scalar offsets
through the existing operand owner; default offsets preserve none behavior.

Seven real-frontend logic cases pass; full directed machine/storage/object/loop/
returned-local/service regressions pass669cases/65files in40.77s; build/typecheck
and45import-boundary cases pass. All seven actual none hashes/empty diagnostics
match the durable pre1.2.2 baseline. Native experiments use unchanged pinned VICE
helpers and actual ACME/shared closure:7fixtures across each4profiles run
sequentially (28total). Stable bytes0/255 have one source load/one EOR/one cache;
original-field recovery checks all256bytevalues perprofile with one EOR/no cache;
mutation preserves16loads and values0..7/complements, raw alias8, volatile8 and
zero-trip effectful producer0reads/calls. Bounded status **VICE-verified /
hardware-unverified** only; no public size, whole963/725or final observer claim.

Initial base review has one MINOR CP-RV-001: seal the original derivation profile
as well as checking the exposed profile field, so a copied fact cannot simply be
relabelled for another target. No emitted corruption established for the current
shared CPU/storage profiles. The necessary small fix is accepted; SFA/output
initial reviews pause for explicit selected expert-router/reference excerpts.
Parent supplies only current metadata/normative excerpts, not hidden permissions
or qualification answers. Their initial source inspections and the profile fix
must finish before task promotion. No source/oracle scope is expanded by this fix.

Task1.2.10 metadata corrections, 2026-10-16 12:41 CEST: base MINOR CP-RV-001
seals the original derivation profile, rejecting a copied fact relabelled together
with its supplied target ID. SFA MINOR CP-SF-001 retains the actual deferred binary
left SSA identity for cache recipes too; CP-SF-002 records the exact positive-trip
admitting counter independently of optional object-range facts. The runtime proof
unions/deduplicates both counter sources. Three focused regressions are meaningfully
RED before correction (three failures/six prior passes), then all nine GREEN.
These are complete-provenance fixes, not new opcodes, homes or source behavior.
One concrete SFA metadata-fix pass clears both findings and statically confirms
the profile interface; base/MCA initial endpoints remain separately recorded.

Fresh build/typecheck and671directed cases/65files pass (65.51s);45boundary cases
pass (2.70s). All seven actual none hashes/empty diagnostics remain exact after
correction. Targeted formatting/JSDoc/whitespace/file ceilings and eight oracle
identities pass; frozen spec and the excluded return owner remain clean. Byte
availability is696lines, function696, state695, unary356, source query490; no
additional production module or framework is introduced.

Four additional native cached-RHS fixtures use an instruction-producing volatile
left: `peek($C110) & ~x`. Every profile preserves eight C110reads, samples x once,
has one EOR/one cache and produces eight A5bytes for C110=A5/x=0. Total native
qualification is32sequential fixtures, including four256-value original-field
checks. All28earlier fixtures remain passing; metadata-only corrections do not
alter their target code. Status **VICE-verified / hardware-unverified** is bounded
to these fixtures, not accepted public size or whole-input qualification.

MCA receives authorized parent byte/PC/symbol excerpts after native external
artifact reads are denied (never retried). Cache at099F is`AD 00 32 49 FF 85 04`
(LDA3200/EORff/STA04):7bytes/9nominal cycles plus one SFA byte. Actual live-left
at09C9 is`AD 10 C1 25 04`(LDA C110/AND04):5bytes/7cycles before common store
`8D C1 0B`(3/4). Packed field at09E0 is`2D 02 32`(AND3202), explicitly symbol
base3200+wordpad2; its preceding`AD 00 33` gives6bytes/8cycles combined. Source
no-code/offset/register/flag checks are clear; these local expert-idiom matches
do not pretend cache/setup/retained homes/startup/padding are free. Full cost and
remaining local-meet debt disposition remain1.3.5/15/17/20 and the phase gate.

Emitted PRG identities are identical across all four profiles for each fixture:

| Fixture | Bytes | SHA-256 |
| --- | --- | --- |
| Stable0 / stable255 | 881 | `31a6798e2d314f8af120e864d294f1abd05f53f231ab38da3f47c5f75c93e434` |
| Original field | 844 | `cd2c81b020260dd3dcf93bd18cdb1d94eeca1c4e9d77d44333e625f31a17ef9d` |
| Typed mutation | 933 | `e035cadb9c9e7fc57637c07f312ef56c0999d90ac5db5bc822306f6dca12760e` |
| Raw alias | 857 | `07d820a10516b56573f1418b16d22e6c72fd97938ab5733b579ce66c37da37b2` |
| Volatile producer | 787 | `071ab5448586c2311091db99479688d1ea617e0df97de0272bd6e839b5f0f7ad` |
| Zero-trip producer | 848 | `31a13dc991099551fa58ec511c98f6093ed312c305167d7c5a8578cd243116db` |
| Cached RHS/live A | 902 | `1167bdc95934f2ab396a5380ad04f269764bce818143eecd90c70914ea367453` |

Final both-layout visibility/raw/async/firmware/A/P observers, selected inventory,
complete B/R/T and the original963/725limits remain unproved here. New metadata
does not make those obligations optional, remove unavailable reference homes or
authorize a generation. All specialist authority input is parent-attested selected
active-router/reference excerpts; incidental historical routing summaries are
excluded. No frozen authority, source API, legacy oracle, push or RED commit.

Cleanup before1.2.10 completion:227owned scratch files in the exact
`size-complement-0xn5ntt3` directory are removed after durable result/identity
recording. Source, other runtime directories and retained external evidence are
untouched. The next incomplete task is1.2.11;1.3.2 remains unverified despite its
early concern tests. No composite GREEN or push is claimed.

Continuation boundary, 2026-10-16 12:54 CEST:1.2.11 remains not implemented.
AR-P19 requests one ordinary adjacent Boolean-exit logic-test concern under the
current named-path contract. Edge/flag382lines and complement324lines remain
unchanged; the new concern does not alter an oracle or add a harness/framework.
Tasks11/17/1.3.2 are blocked on that exact user-owned file decision, not effort.

Continuation, 2026-10-16 13:42 CEST: user selects **“Approve file (Recommended)”**
for exactly AR-P19. Affected tasks return to not-started;22/40 remain verified.
The minimum1.2.11 implementation keeps the near-ceiling byte/function/state owners
unchanged where possible: derive all-exit canonical A/Z certificates in the
existing control owner and consume exact post-call windows in the existing call
owner after selected functions and context labels exist. Keep ordinary JSR/RTS,
unchanged source results and all reference-home/read/asynchronous obligations.
No flag allocator, general dataflow engine, new production module or public ABI.

Task1.2.11 implementation/initial qualification: the existing control owner now
derives a body-bound certificate for every reachable ordinary Boolean return.
Its finite local join tracks exact A, the canonical0/1union and whether N/Z
describe A; it does not track memory, stack contents or general value ranges.
PLP loses flag agreement; later proved producers can restore it. Shared empty
false returns and a shared RTS reached with either0or1 are covered. Calls and
unresolved instruction-level jumps remain conservative. The actual source
Boolean signature is separately required; this is no stronger public ABI.

The existing call owner consumes certificates only after final local shaping and
execution-context labels exist. Mainline ordinary owners are recorded directly
by the existing lowering loop, not recovered from display names. Branch-only
calls/adjacent negation can remove exact capture/reload or CMP0/TAX suffixes.
Both continuations must kill changed C/X before a synchronous use, through the
existing memoized prefix proof (now exporting its state mask and supporting X).
Already bare JSR branches require a certificate too; otherwise this Closed
candidate inserts an explicit CMP0, rather than assuming the public ABI owns Z.
Stored/multiuse values retain ordinary lowering. Fresh all-exit checks cover
every actually consumed final callee; lost proof rejects lowering. All old
requests remain in inventory, and exact removed/added instructions, source call,
selected callee/block and pending physical/async state obligations are retained.

The first compiler check exposed a TypeScript closure-narrowing error, corrected
without behavioral changes. A new implementation fixture initially omitted its
two branch destinations; those fixture blocks were supplied. The first native
clean-caller check then meaningfully failed: an exact-A-only join forgot that
the shared RTS's0/1union was still canonical. A focused persistent regression
and the canonical-union bit correct that bounded proof; no native/spec assertion
was weakened. The20Boolean logic cases and full691-case/66-file directed suite
pass (43.18s), along with build/typecheck and45boundary cases (2.10s). All seven
actual none hashes/empty diagnostics still match the original durable baseline.
Formatting, documentation/plan-reference checks,700-line ceilings, eight oracle
identities and frozen/excluded paths pass. Production lengths: control399,
call492, lowering682, byte698, machine types349; new Boolean test concern381.

Four actual ACME/shared-closure/VICE fixtures run sequentially across the four
profiles with all256byteinputs each. Independent expected output checks clean,
restored-status, negated and multiply used stored results. All1024returned-state
observations at the direct clean branch have canonical A, matching Z and N=0.
The unchanged pinned monitor/runtime helpers are only compiled into owned scratch;
no repository runner, harness or dependency is introduced. All four PRGs are866
bytes with SHA-256`a97f2ceb713ee6aa24df25836f2b4e6ef54977225deca46cc2dde4f1eb170168`.
This fixture cost is not the whole-input963/725qualification.

Actual PAL bytes: cleanCaller09D4=`20 B4 09 D0 06`(JSRclean/BNE), restoredCaller
09E7=`20 BC 09 C9 00 D0 06`(JSRrestored/CMP0/BNE), negativeCaller09FC=
`20 B4 09 F0 06`(JSRclean/BEQ). Certified caller idioms cost5bytes/8–9nominal
cycles excluding callee; fallback adds2bytes/2cycles. These observed short
branches do not cross pages. Ordinary calls/RTS and all retained homes/startup/
padding remain charged. Status is **VICE-verified / hardware-unverified** only
for these fixtures; final observers, selected storage/debug, full artifacts/costs
and public size construction remain due. Base review has no findings; the SFA
and output reviewers receive only this complete six-file task boundary and
parent-extracted selected expert-router/reference metadata, not hidden permission
or qualification answers. Their dispositions and owned scratch cleanup remain due.

Task1.2.11 final bounded dispositions, 2026-10-16 14:05 CEST: base correctness,
SFA/ABI and emitted-code reviews all return **no findings**. SFA confirms zero new
function-storage or stack demand and preserved argument/result/call-graph duties.
MCA independently decodes the parent byte excerpts and confirms the5/7/5-byte
expert idioms and same-page8–9/10–11/8–9cycle caller costs. Static/body/byte-excerpt
and parent-executed runtime endpoints remain distinct; no final whole-program
parity, reference-home or unrestricted external NMI claim follows. Incidental
historical routing summaries encountered by reviewers are excluded. Requested
backedge-invalidation and inverse-long-branch counterexamples stay owned by1.3.2,
not silently counted as current qualification or a new concern/harness.

Exact ephemeral native source, with source ID`src/game.blend`, retained here for
reproduction before scratch cleanup (normal bounds/division checks, source entry
Game, per-profile manifests; direct Closed lowering through the existing owners):

```blend65
module Game;
place(at:$3200)let x:byte;
place(at:$3400)let answers:byte[8]=[;0];
function clean():boolean{if(x==0){return false;}return true;}
function restored():boolean{asm_php();let result:boolean=x!=0;asm_plp();return result;}
function cleanCaller():void{if(clean()){answers[0]=7;}else{answers[0]=9;}}
function restoredCaller():void{if(restored()){answers[1]=11;}else{answers[1]=13;}}
function negativeCaller():void{if(!clean()){answers[2]=17;}else{answers[2]=19;}}
function stored():void{let value:boolean=clean();answers[3]=value?1:0;answers[4]=value?1:0;}
function rowReady():void{asm_nop();}
function main():void{for(let g:word=0;g<256;g+=1){x=byte(g);cleanCaller();restoredCaller();negativeCaller();stored();rowReady();}}
```

Observe each cleanCaller JSR+3: A=Number(g!=0), Z=(g==0), N=0. At rowReady,
answers3400..3404are`[9,13,17,0,0]`for0and`[7,11,19,1,1]`otherwise. After256
rows, stop at startup.restore. This is the behavior oracle, separate from the
instruction/byte oracle above; no optimized-versus-none differential is its basis.

Cleanup before1.2.11 completion:94owned scratch files in the exact
`size-boolean-gqxbmkf2` directory are removed after durable source/results/identity
recording. Repository content and other sessions' evidence are untouched. Next
incomplete task1.2.12;1.3.2 and complete six-lens phase qualification remain open.
No composite GREEN checkpoint, automatic push or complete963/725claim is made.

Task1.2.12 pre-implementation seam check, 2026-10-16 14:17 CEST: no loop-policy
field, selector, loop test or production edit has been written. The approved
`fixed-loop-selection.ts` path is absent. An independent challenge compares
source-associated lowering views, source-identified structured-machine rewriting
and a smaller hybrid, against real source/SSA/retention/bounds/helper/debug
interfaces. This is one integration decision, not a new optimizer scope or a
reset of prior challenge budgets. Its missing-authority stop is answered with
bounded active-router/CPU/lowering/SFA/IL normative excerpts; an initially
descriptive architecture heading label is corrected to the exact current
Responsibility Map/Required Pipeline Invariants headings before any conclusion.

A separate root-executed, non-native probe uses an ordinary eight-row word loop
with fixed raw output/input, variable byte shift and typed indexed destination,
plus nested constant/parent-next word counters. Current facts recognize the
flat-eight loop at depth0and the nested loops at depths0/1, with no outside
counter accesses. Existing Closed lowering emits12blocks/51instructions for the
scan and12blocks/59instructions for the nested function, plus the two-call main.
These are observed integration complexity, not optimized behavior/cost results.
Source values/types, exact effects and existing qualification remain unchanged.
No alternative or additional owner is selected before the challenge returns;
any necessary unapproved production path still requires the exact user decision.

AR-P20, 2026-10-16 14:24 CEST: the independent challenge selects source-associated
selection in the existing function dispatcher plus actual machine validation.
No additional production owner is needed; `lower-operation.ts` stays unchanged.
First subunit is bounded FlatEight occurrence replay through the full dispatcher,
with original source/value/storage identities and iteration-local cache/value
state. Counter control/register views follow only after the highest-risk block/
lifetime/provenance boundary is qualified. No framework, general allocator or
extra helper module is approved by the internal decision.

Task1.2.12 FlatEight first subunit, 2026-10-16 14:49 CEST: the new selector
prepares emission-only block occurrences while preserving original operations,
value IDs and storage positions. The existing function dispatcher still owns
bounds, runtime shifts, staging and helper discovery. Original CFG bookkeeping
is relocated verbatim into the selector's preparation result to keep the function
owner below700lines. Each occurrence clears only its own body-defined temporary
values/load origins and resets address facts; generated continuations get unique
labels. Instruction-site accounting keeps original source terminators, and every
expanded instruction carries its0..7source iteration. Source-associated pure
ordinal chains fold with explicit runtime width/sign normalization; unrelated
runtime shifts and effects stay ordinary. No general load/store switch is copied.

A source-template recheck rejects copied four-trip facts relabelled as eight.
The first guard run incorrectly expected integer-result metadata on a Boolean
comparison; actual checked comparisons have`integer:null`. The guard now checks
the actual word counter load, literal bound/control edges and word increment,
not the Boolean result's nonexistent integer width. Original tests/assertions
remain unchanged. Eight initial logic cases and699directed cases/67files pass
(40.21s),45boundaries pass (1.93s), and build/typecheck pass. A ninth logic case
then checks post-domain-specialization occurrence labels and stale/missing block
rejection; its directed run and fresh build pass. This context metadata adjustment
changes no target instruction or request.

The independent challenge's exact high-risk source is qualified through actual
ACME/shared storage closure and unchanged pinned VICE helpers: per profile,
`(count,index)`is`(0,0),(1,7),(7,7),(8,0),(255,7),(1,8)`. All24sequential cases
pass. Each legal index produces eight ordered C110-read/C100-write/C111-read
groups; index8stops at the original bounds failure after exactly one group.
Source runtime shift counts0/1/7/8/255 retain their byte semantics. All fixture
PRGs are1217bytes, SHA-256
`2d8de8928437a5cb357a13811b0ece4f5e81f3b3d8dfdbb740f2c7e8ce01345e`;
two late requests are shared by source identity, with no iteration-specific
request IDs or invented source lifetime positions. This is a different stress
fixture, not a claimed963/725whole-input outcome or complete loop qualification.
Status **VICE-verified / hardware-unverified** is limited to these cases.

Exact stress source for reproduction (entryGame, bounds/division checks enabled,
explicit Closed/FlatEightXFirst internal construction, source IDsrc/game.blend):

```blend65
module Game;
place(at:$3200)let count:byte;
place(at:$3400)let answers:byte[8]=[;0];
function work():void{for(let row:word=0;row<8;row+=1){
  let value:byte=peek($C110); answers[row]=value<<count;
  poke($C100,answers[row]); answers[byte(peek($C111))]=byte(row);
}}
function main():void{work();}
```

Seed count3200and`[A5,index]`atC110..C111after startup at main. Let
`v=count>=8?0:(A5<<count)&255`. For a legal index, answers contains veverywhere
except the indexed slot, which ends at7. At index8, only answers[0]=vis written;
all other slots stay0and execution stops at the bounds block. The trace above
is an independent ordered-effects oracle, not a differential comparison.

Task12remains implemented-partial: LowByte/X/Y, joint nest/register proof and
complete unit review are still due. Full final observers/inventory/debug/public
constructor/costs remain separately owned. The current FlatEight logic concern
is287lines; the distinct counter-representation concern requires AR-P21's exact
adjacent implementation-test path before it is written. No LowByte/X/Y counter
implementation or new counter-test file precedes that reserved decision.

Continuation, 2026-10-16 15:02 CEST: user approves exactly AR-P21 with
**“Approve file (Recommended)”**. Task12returns to implemented-partial; dependent
tasks return to not-started. Count remains23/40. Only the adjacent counter test
concern is added; no source/oracle/limit/framework or further-file waiver.

Task1.2.12 partial continuation, 2026-10-16 17:37 CEST:

- AR-P22 binds each derived source loop once with a private per-fact stamp. It
  checks exact fields and mutable Set/Map contents; exit records are frozen.
  The machine entry validates the stamp instead of duplicating the source loop
  recognizer. No global registry, source reparse or new support module.
- LowByte uses one predeclared preferred-ZP byte per admitted private word
  counter. All source types/positions remain word-shaped; reads zero-extend and
  existing argument stages still receive both bytes. Parameters, live-outs,
  addressed/wider counters and incomplete source-context subgraphs keep ordinary
  representation. Original word requests remain certified: this currently adds
  one byte of logical demand, not an asserted physical storage saving.
- Original initializer/body/update/condition/break/continue/return ordering is
  retained. The typed-array consumer accepts only the actual selected low home;
  no generic zero-extension or none-path addressing rule is broadened.
- Existing prefix state/declared successors move to the control owner, with
  unchanged old defaults and added explicit Z/V masks/return obligations. The
  old runtime complement classifier moves verbatim to the unary runtime owner,
  with re-exports preserving its entry point. These keep touched files below700
  without introducing another module, optimizer layer or allocation mechanism.
- A native overflow witness first fails at the second PHP: bare CMP leaves V=1,
  unlike the zero-high word subtraction's V=0. Start with full comparison state;
  remove it only through independent continuation proof. The CLV alternative
  preserves required flags at1byte/2cycles when initial<=bound makes N/Z/C agree
  and A is dead on both edges. Full suffixes are removed from the proof graph
  first. Physical/asynchronous A/X/Y/N/Z/C/V observations remain pending.
- Signed constant operands may contain two's-complement bit patterns. The
  initial folder failed legal sbyte/sword low/high-byte answers; normalizing
  each operand's signed interpretation before arithmetic shift fixes them.
  The initial private fixture's invalid`int`spelling and diagnostic-printing
  BigInt error are corrected host-fixture setup, not meaningful RED evidence.
  Only the subsequent legal-source native failure and proper helper cases count.
- Base MAJOR FL-RV-001 exposes derived constant index8bypassing a runtime stop.
  AR-P23 accepts the fix: prove counter-derived typed indices in bounds before
  installing any expansion, otherwise retain the ordinary loop/guards. Logic
  and actual native RED precede the fix; all four profiles then preserve earlier
  writes, marker90and the bounds stop. One bounded correctness fix review clears
  the finding. Independent dynamic indices retain their normal checked dispatch.
- A separate preheader PHP witness exposes initialization A/Z differences before
  the first comparison. When later source operations follow a nonzero initializer,
  emit the original high-zero load after the new byte store. This2byte/2cycle
  correction preserves C/V and adds no storage/stack demand; constantzero or
  direct-to-header cases need no load. Logic/native RED precede the correction;
  four-profile A=0/Z=1/zero-trip checks and one output fix review pass.

Fresh build/typecheck,715directed cases/68files (41.26s) and45boundary cases
(2.02s) pass after all corrections. Seven actual none artifact hashes and empty
diagnostics matched the original baseline at the preceding check; final identity/
format/frozen guards are rerun before the continuation closes. Source specification
files, numeric limits, lower-operation and excluded return lowering remain unchanged.
All three bounded partial review lenses clear their assigned endpoints, including
the one necessary bounds fix pass and initialization fix pass. Their authority
remains parent-attested selected expert2.0.4normative excerpts/content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; incidental historical summaries are
excluded. This is not the complete phase's six-lens review.

There are56unique sequential native fixtures across four profiles:24Flat stress,
20LowByte control,4signed-fold,4bounds-stop and4preheader-state cases. The overflow
fixtures include32entry-V observations. All statuses are **VICE-verified /
hardware-unverified**, limited to these sources, not public size, universal silicon,
external NMI guarantees or the original963/725whole-input result.

| LowByte source fixture | PRG bytes | SHA-256, identical across four profiles |
| --- | --- | --- |
| Simple counter/index/high byte | 701 | `ea2c2ed0b4c5ec04f8b76d3fafd3cf94a4f4e92d1393686b54e944662c8789be` |
| Nested parent-next | 731 | `cde536dadbce45e51ac98951d97ae07c69fc14859a8244c5f20918b79571c5c3` |
| Zero trip | 674 | `fe29235f6769f87baba37dda62e5ee484b1180c7852ac1d25ef16603f54fdc7e` |
| Break/continue | 722 | `a23a7ae0176c873c7cea217aca1847b75042571c4ad0e9b6946eb256a093d2fd` |
| Entry overflow/CLV | 714 | `b6d6c809cf5b07a993b0a7d77829fc8d71d22be42e8a34ab6d3b465631bb8ea0` |
| Initialization state | 678 | `59c9b9ef4fa20e4db26c8eaadb6fcf05292a187b535787151e055da6d614bbba` |
| Signed FlatEight | 806 | `2a6270b985f647d5d88c713bda7e71904a59db47e6549531ac8a0d8224833b2a` |
| Bounds-stop ordinary fallback | 775 | `7104e1f93f190c6eeb110c96dc815b616db11697a28a47716560fbc2e1cc7cc5` |

LowByte exact-source reproduction: sourceID`src/game.blend`, project name
`counter-probe`, common prefix
`module Game;place(at:$3400)let answers:byte[8]=[;0];`, then newline,
`function work():void{BODY}`, newline,`function main():void{work();}`. Bounds and
division checks enabled; explicit Closed/LowByte internal construction.

| Fixture | Exact BODY |
| --- | --- |
| Simple | `for(let row:word=0;row<8;row+=1){answers[row]=byte(row);poke($C100,hi(row));}` |
| Nested | `for(let col:word=0;col<4;col+=1){for(let other:word=col+1;other<4;other+=1){answers[other]=byte(col);}}` |
| Zero | `for(let row:word=8;row<8;row+=1){poke($C100,byte(row));}` |
| Break | `for(let row:word=0;row<8;row+=1){if(row==3){continue;}if(row==6){break;}answers[row]=byte(row);}` |
| Flags | `let value:byte=120;for(let row:word=0;row<8;row+=1){asm_php();asm_plp();value+=120;answers[row]=value;}` |
| Initialization | `let row:word=8;asm_php();asm_plp();for(;row<8;row+=1){poke($C100,byte(row));}` |

Expected source answers are respectively`[0,1,2,3,4,5,6,7]`,
`[0,0,1,2,0,0,0,0]`, eightzeros,`[0,1,2,0,4,5,0,0]`,
`[240,104,224,88,208,72,192,56]`and eightzeros. Observe V=0at every entry PHP
in the flags fixture; initialization PHP observes A=0/Z=1before the zero-trip
condition. These are independent source/CPU expectations, not differential output.

The signed FlatEight source uses answersbyte[16]and a0..7word loop:
`answers[row]=byte(sbyte(byte(row)|$80)>>byte(row));`
`answers[row+8]=hi(sword(sbyte(byte(row)|$80))>>byte(row));`.
Expected lows are`[128,192,224,240,248,252,254,255]`, highs eight255. The bounds
witness uses initialized answersbyte[8]at3400, marker90at3408and done0atC101;
work writes`answers[row+1]=1`forrow0..7and main writes done99after work. It must
stop with`[0,1,1,1,1,1,1,1,90]`at3400..3408and done0.

Continuation boundary: XFirst/YFirst and the register part of FlatEight policies
are **not implemented**. No register capability is inferred from declared policy
tags. Task12stays`[~]`, progress23/40; next work is the remaining register views,
joint clobber/nest checks, their directed/native qualification and complete task12
review. Selected inventory/physical observers/debug/constructor/complete costs and
eight hardening tasks remain open. Public size still deliberately reports
COMPILER_INCOMPLETE at candidate selection. No GREEN composite commit or push.

Final continuation guards, 2026-10-16: all seven actual none hashes/empty
diagnostics again match the original baseline after the loop corrections.
Targeted formatting/documentation/whitespace/700-line ceilings, eight oracle
identities and frozen/excluded-owner checks pass. Cleanup removes475owned files
from the exact`size-loop-g3t58fm6`directory after durable source/result/hash
recording; no repository or other-session content is removed. Next execution
resumes the first`[~]`task1.2.12at the X/Y register subunit, not1.2.13or1.3.2.

Deliverables: implemented admitted rule packets and their actual independent
GREEN behavior/output/resource evidence. Verify: directed tests during units;
native runs sequential, existing byte/observer/boundary regressions unchanged.

Task1.2.12 X/Y continuation, 2026-10-17: all four register policies now construct
truthful one-byte X/Y views for exact proved typed consumers. Other source word
reads transfer to A only through an immediate code-free use chain, or receive
finite one-byte SFA snapshots with high0 reconstruction. Existing argument stages
still hold both word bytes. Parent-plus-one initialization uses the parent register
and one increment only when both removed source values are sole-use and no effect
or staging intervenes. Source/value/lifetime and context identities remain original.
Counter runtime types move to the common machine owner; bounds/index and value
construction stay in already approved owners. No additional module or runtime.

Joint source admission rejects clobbered whole nests, including overlapping third
register levels, calls, unsupported helpers and competing generic Y setup. An
unrelated safe nest remains selected. Actual emitted register definitions and
native-index consumption are checked before accepting conditional proof records.
The records still retain all original word homes and A/X/Y/N/Z/C/V/physical/async
obligations; this unit does not claim final observer or physical storage closure.

The initial6register/nest regressions are meaningful RED before implementation.
A converted-index Y case then exposes missing ordinary fallback; source admission
now requires the actual sole unchanged counter-load consumer, not a merely traced
cast. Four additional native-store cases expose redundant capture before a proved
no-setup indexed store; only an exact adjacent sole byte producer can now feed A
directly. Existing oracle files/expectations are untouched.

Fresh build/typecheck,764directed cases/71files (43.74s),45boundaries and all seven
original none artifact identities/empty diagnostics pass at this first endpoint.
The initial96native fixtures (12source kinds ×2policies ×4profiles) pass sequentially
in137.12s through actual ACME/shared closure/VICE. Independent expected values and
source read/write counts, header Vclear and preheader A0/Z1 are checked. An initial
trace-count mismatch is probe setup only: deleted execute checkpoint IDs were reused
by access tracepoints, so the old event list needed clearing before observation.
No compiler or oracle change follows from that host-probe correction.

Initial X/Y native sources use the common prefix/manifest pattern above, project
name`register-probe`, sourceID`src/game.blend`, Closed bundle and named X/Y policy.
The exact prefix is`module Game;place(at:$3400)let answers:byte[8]=[;0];`, newline,
`function work():void{BODY}`, newline,`function main():void{work();}` with no final
newline. Seed C110=A5/C111=7 after startup at main; initial answers are eight zeros.

| Kind | Exact BODY / independent result |
| --- | --- |
| Simple | `for(let row:word=0;row<4;row+=1){answers[row]=peek($C110);}` →A5fourtimes, exactly4C110reads |
| Data | `for(let row:word=0;row<4;row+=1){answers[row]=byte(row);}` →0,1,2,3 |
| Nested | `for(let col:word=0;col<4;col+=1){for(let other:word=col+1;other<4;other+=1){answers[other]=byte(col);}}` →0,0,1,2 |
| Shift | `for(let row:word=0;row<4;row+=1){answers[row]=byte(1<<byte(row));}` →1,2,4,8; Xordinary/Yheld |
| Control | `for(let row:word=0;row<8;row+=1){if(row==3){continue;}if(row==6){break;}answers[row]=byte(row);}` →0,1,2,0,4,5,0,0 |
| Zero | `for(let row:word=8;row<8;row+=1){poke($C100,byte(row));}` →all0/noC100writes |
| Flags | `let value:byte=120;for(let row:word=0;row<4;row+=1){asm_php();asm_plp();value+=120;answers[row]=value;}` →240,104,224,88; VclearbeforeeachPHP |
| Initialization | `let row:word=8;asm_php();asm_plp();for(;row<8;row+=1){poke($C100,byte(row));}` →all0/A0/Z1beforePHP |
| Snapshot | `for(let row:word=0;row<4;row+=1){let saved:word=row;answers[row]=byte(saved+257);poke($C100,hi(row));}` →1,2,3,4/fourhigh0writes |
| Cast index | `for(let row:word=0;row<4;row+=1){answers[byte(row)]=peek($C110);}` →A5fourtimes/exactly4reads/Yordinary |
| Generic index | `for(let row:word=0;row<4;row+=1){let index:byte=byte(peek($C111));answers[index]=byte(row);}` →slot7=3/fourC111reads/Yordinary |
| Early return | Boolean work body`for(let row:word=0;row<4;row+=1){answers[row]=byte(row);if(row==3){return true;}}return false;`; main body`if(work()){answers[7]=7;}` →0,1,2,3,0,0,0,7 |

All24initial artifact identities are identical across the four profiles. The sorted
tuple list(policy,kind,PRGbytes,SHA-256), compact JSON encoding, hashes to
`7ccdcde212b0b6576bae9ea111ebe9e67d55997cb91cefbf9edd0f336feeba24`.
Selected actual pre-review artifacts and costs (PRG includes its2-byte header):

| Kind | X / Y PRG bytes | X SHA-256 | Y SHA-256 |
| --- | --- | --- | --- |
| Simple |670/670|`6b4b5904af7df80771e517b4c135b99df05aac4c81b875716e4d3fc8a7d7e7b2`|`bf9f6a469c774145a4bbe09d8876688b1bcbd89443c61182f2bbaf5caf8415da`|
| Nested |680/680|`dd300ed88a7330dba1512284c73d14b4393dd415ca353d7b5ab8737ae4035ef7`|`d48cd64979a21e099b5498766062c6f9baa6495364d1a7f22f0e5a19c5cb259f`|
| Flags |693/693|`aec3dd7ddc06c409c245cafc49f6f13ddd91d853396ff089f124fea89e458266`|`f6c13725f2a0ad6fa3f4e5d829cfa37519ad84ee74bb14299ff34539f80e8a3a`|

The complete bounded reviews find three necessary corrections and two output debts:

- MAJOR XY-RV-001: byte-result shifts can still use Y for a runtime word count's
  high-byte test. AR-P24 accepts the bounds-aware admission fix after independent
  challenge. The already computed per-operation map is handed to selection;
  byte counts or complete maxima below8retain Y, unknown/wider cases keep the
  affected nest ordinary. No shift emission or new analysis is added.
- MAJOR XY-SF-001: storage-home binding drops absolute-X while retaining Y; its
  final metadata validator rejects the candidate before emission. Root reproduces
  actual closure RED. User directly approves only AR-P25's existing binder path;
  the correction preserves that mode in the existing condition. No new module,
  source workaround or oracle change. The previous global-symbol matrix did not
  exercise this seam and was not sufficient binding evidence.
- MINOR XY-SF-002: selected snapshots had conservative whole-function lifetimes
  because their request suffix was not an original semantic value ID. The existing
  request helper gains an optional exact value identity while retaining its stable
  request ID/default behavior. Snapshot type stays byte; source counter stays word.
  The pure packed-width query moves verbatim to its existing control/value owner,
  with the original state entry re-exported, keeping production files below700.
- MAJOR XY-MC-001: actual simple work is17bytes/88nominalcycles versus14/71for a
  proved positive bottom-tested expert loop. MAJOR XY-MC-002: flags-store window
  is15bytes/21cycles versus8/11for conservative ORA0/store/store, a7byte/40cycle
  four-iteration gap. Both are accepted, not waived as mere historical debt.
  AR-P26's independent smallest-remedy challenge and concrete corrections remain
  due before task completion. The PHP header's CLV cannot be removed blindly.

All three correctness/SFA regressions are meaningful RED before fixes. After the
in-scope shift/lifetime fixes and directly approved binder edit, build and45loop
cases pass. Fresh typecheck/45boundaries/sevennone identities pass. The additional
local-array/full-word-count native matrix then passes104sequential cases in164.78s.
It covers local byte arrays under both registers on all four profiles, and both
ordinary/unbounded versus retained-Y/bounded word shifts at complete counts
0,7,8,255,256and65535. Independent expected byte outputs are1,128,0,0,0,0for
the unbounded shift, and1,128,1,128,1,128for`count&7`; local answers[0]is3.
Actual recipe assertions require ordinary counters for unbounded shifts and
bounded X, heldYfor bounded Y and X/Yfor their local-array cases. Exact sources
extend the common pattern with`count:word`and main`work(peekw($C112));`;
their BODYis`for(let row:word=0;row<4;row+=1){answers[row]=byte(1)<<count;}`
or`for(let row:word=0;row<4;row+=1){answers[row]=byte(1)<<(count&7);}`.
Seed C112/C113 with the tested word after startup. Local BODYis
`let items:byte[4]=[;0];for(let row:word=0;row<4;row+=1){items[row]=byte(row);}answers[0]=items[3];`.
One concrete correctness/SFA fix review remains due.
Reviewers use parent-attested exact change excerpts after external preimage reads
are denied; no tool retries or permission changes. Expert lineage remains2.0.4/
content`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; incidental historical routing
smoke summaries are excluded. No full phase/six-lens clearance follows.

Task12remains partial and23/40remain verified. All status is fixture-only
**VICE-verified / hardware-unverified**; final physical/async/observer/storage/debug,
public size constructor, complete costs and963/725qualification remain open. No
composite GREEN checkpoint, automatic push or phase-baseline change occurred.

Task1.2.12 final local qualification, 2026-10-17:

AR-P26's first-test bypass now reaches the existing tail layout without a new
layout pass. Only a positive, two-member straight-line register loop with one
bare immediate comparison and exact entry/backedge is admitted; actual N/Z/C
continuation proof is required. Zero-trip, CLV/other reconstruction and unsupported
entry/exit shapes retain the first comparison. The selected counter record carries
first-test elision as a still-pending source/state/debug obligation.

The existing selected-byte owner matches the actual arithmetic source value,
sole private write/read, declared capture/home identities and proved native
consumer. It retains both source writes and all original requests. All candidate
removals precede N/Z continuation queries; the two-store form is used only when
those flags die before observation, otherwise ORA0 restores them. C/V are preserved
without assuming binary ADC/SBC flag equivalence. New conditional records retain
the removed capture/store reads, source operations, exact context/homes and changed
N/Z interval. Call-context binding rewrites their labels and removed storage
operands too. No new public schema, module, runtime or general forwarding is added.
Common representation types and pure queries move within the already approved
owners, with existing entries re-exported, to respect the700-line ceilings.

The one correctness/SFA fix review clears XY-RV-001 and XY-SF-001, but identifies
new MAJOR XY-SF-003 after the attempted precise snapshot-life correction. Actual
closure and VICE produce0,2,4,6instead of3,4,5,6for overlapping converted counters.
AR-P27's independent challenge identifies conversions, unaryplus, zero shifts,
multiply-one and unsigned divide-one as possible backing views. The authorized
single technical correction keeps only exact fully enumerated materializing lo/hi
uses precise; all other snapshots explicitly retain their entire original function
positions/calls, preserving source value and definition identities. The use index
includes terminators. Actual closed homes are distinct and all eight four-profile/
register combinations then produce3,4,5,6. No third iterative SFA review is claimed;
the final complete phase SFA audit remains mandatory. No unsafe lifetime is waived.

The base review's one final fix pass clears XY-RV-001 and reports no new source/
control/standards/scope findings. The output review's one fix pass and artifact
continuation clear XY-MC-001/002 at their exact local byte/runtime endpoint.
External preimages remain denied; reviewer change attribution and native runs are
parent-attested, with actual raw byte/PC excerpts independently compared against
the reviewers' instruction expectations. Existing oracle identity checks remain
root-executed, not an independently diff-checked claim.

A final parent metadata check finds MINOR XY-RV-002: ORA inserted in an expanded
occurrence lacks its capture's source iteration. The new iteration7 regression is
meaningfully RED before correction. Preserving that occurrence while replacing
every architectural effect fixes it without changing instructions/cost/storage.
An additional ordinary whole-array-copy Y-clobber fallback case passes unchanged.
These use the already approved counter concern; no new oracle or support file.

Fresh build/typecheck,776directed cases/71files (44.08s),45boundaries (2.19s),
targeted formatting and all seven actual none identities/empty diagnostics pass.
All11new/original output-oracle hashes, whitespace, documentation/source-reference
checks and frozen/excluded paths pass. The new counter concern has646lines;
production ceilings are698for byte availability,700state,699aggregate and693function.

The final sequential native run has224input cases in352.79s:16source kinds ×2
policies ×4profiles, plus96unbounded/bounded complete-word count cases. It checks
independent source results, read/write counts, header V, preheader A/Z and poststore
A/N/Z, including a zero result. After three stricter admission guards, a fresh
build and all144unique complete PRG/assembly/code identities match those runtime
artifacts exactly (94.23s including directed checks). The metadata-only correction
then passes ten repeated native cost/state/view cases. Those are repeats, not ten
more distinct cases. All36policy/source artifact identities are identical across
the four profiles and runtime counts. Compact sorted JSON tuples
`(policy,kind,codeBytes,PRGbytes,SHA-256)` hash to
`e83c5bed13ec3a692fb6d4746e0a8f43e4d7a8276a325871cdacd837017a10a6`.

| Final source kind | Work code / PRG bytes | X SHA-256 | Y SHA-256 |
| --- | --- | --- | --- |
| Simple |14/667|`b7eaf55d940a3d454b9ac1857106a56d9018a302b05c1ae438efd79e3539a10c`|`b6cdc7b8d65c07f2ba4e04c1f055ba21b54d0cea528aa8b9d81daccaa06d1483`|
| Flags, N/Z dead |31/684|`c9b6b190dac65f2023ed5e265678065baecc07d3b8d6b8d6ad54b88a6d954a0a`|`896039f3998da9188a769b3a7e4f9d9bb0d1141ab9090b518d7af750e983c8aa`|
| Flags, N/Z observed |35/688|`13ee6a291426918716bacf2805c5b22bc5af483a53155c46d1d9c249fc003f88`|`588295eeb27b4621940e0845283b03787fadeadf81ceb1d47c298608e4a2ca2b`|
| Observed zero |35/688|`84c6376d79b3ac19fe8cc35eaf83ac6078afdeced72e99877ac9788a9e4987b5`|`b6ba6555a0b7355938eb52f0fc065fd4e6f8eb01640c02a9b4345b038cfad26c`|
| Local array |38/691|`2a8a439c80a63fde8350b3f904c4d31a8eaf739be6a4ddc501bdca8f5607f791`|`64373ef2f91276605bd4dbf837afc8a86a785ae8f9a1fe5ca306ae56ee4f7993`|
| Overlapping views |45/698|`a4b184e5d7e3fa4ede9bc5a4508d4a5017ab940fc2887734247df4227f48aa54`|`3d8e29635a9520df1db5de8760f9bdd52bc8932be6abb2a4d15d961405ab8d06`|

The observed-flags source appends`asm_php();asm_plp();`after the indexed store;
the zero-result variant starts value at16rather than120. Its independent first
four answers are136,0,120,240instead of240,104,224,88. The second PHP observes
A and N/Z from each answer; the first still requires Vclear. The overlapping-view
BODYis`for(let col:word=0;col<4;col+=1){for(let row:word=0;row<4;row+=1){answers[row]=byte(col)+byte(row);}}`.
All other source/manifest/seed details remain in the reproduction tables above.

Actual PAL X simple bytes:0973=`A2 00`;0975=`AD 10 C1 9D 00 34`;
097B=`E8`;097C=`E0 04 90 F5`;0980=`60`. This is14bytes/71nominal cycles
including RTS, excluding JSR/interrupts/VIC stalls. Y uses A0/C0/99/C8forms.
The flags window at0988is`8D DF 0A 9D 00 34`(6bytes/9cycles); observed flags
use`09 00 8D E3 0A 9D 00 34`(8/11), also at0988. Header CLV remains at097C.
All relevant branches are same-page09. Static SFA RAM/ZP/stack are2/0/2for the
simple source and4/0/3for flags sources; retained original counter/capture homes,
eight-byte answers and unchanged full startup are not free or eliminated.

These local expert meets are explicitly tracked by
[#114](https://github.com/blendsdk/blend65/issues/114), with measured deltas and
conditional paths to a whole-program win. The issue grants no larger machinery,
source restriction, debug-schema change or cost-limit waiver. Complete B/R/T,
selected storage, both-layout raw/bank/dummy/asynchronous observers, debug and
original963/725qualification remain the subsequent tasks. Status stays fixture-only
**VICE-verified / hardware-unverified**. The original phase baseline is unchanged;
the composite remains RED behind the unfinished public constructor, so no commit
or push is made. Before task promotion all task-owned scratch is removed: only
the exact owned`size-register-ojtegsj4`directory is deleted, including logs, source
projects, temporary VICE helpers, trace/debug reports, preimages and issue-body
scratch. Repository content, other runtime directories and retained external
evidence are untouched. Durable sources, raw excerpts, findings, rulings and
identities remain in this owner. Resume1.2.13; no sibling task is advanced.

Task1.2.13 minimum-sufficient seam check, 2026-10-17: no task13production or new
test edit has begun. The independent challenge selects existing logical-inventory
data/functions in the approved selection owner, not another pass or allocator.
Canonical source declarations must remain available without canonical allocation;
physical address/page facts are used only when genuinely present. Actual selected
requests/results, certification hash, discovery and closure must agree. Source
occupancy still includes writes, deferred views and callee entry delivery; unknown
coverage retains conservative occupancy. AR-P27 snapshot backing is not weakened.

Five existing presence/namespace/physical-proof consumers are outside the current
file set, including AR-P20's deliberately excluded operation owner. AR-P28 records
the exact narrow addition and independent recommendation before any edits. Task13
and constructor17wait for the user's scope ruling; other tasks are not advanced.
No fake placement, new support module, source workaround or cost waiver is used.
Task12's owned scratch is already removed; there is no new task13scratch to clean.

Task13continuation, 2026-10-18: the user directly approves only AR-P28's five
bounded consumers. Reviewable subunits before implementation are (a) real logical
declaration lookup/namespace aliases, optional physical placement and complete
query migration; (b) source-associated selected requests/results and certification
agreement; (c) sealed conditional binding occupancy and actual access coverage,
then existing interference/closure qualification. Use the already planned adjacent
`services/size-selection.impl.test.ts` for early handoff/certificate cases without
advancing task1.3.3. No new helper module, fake home/address, alias engine or schema.
None retains the existing allocation-first path. Preserve AR-P27's guarded backing
lifetimes and all persistent/page-safe/domain/call/marshal duties.

Task13a bounded qualification, 2026-10-18: complete original logical inventory
now supplies presence/identity/declared-width queries without canonical allocation.
Physical placement remains optional and never fabricated. The root entry requires
exact program identity and canonical inventory content; aliases are query-only and
never enter certification. Existing physical domain/root alias iteration is reused
unchanged for logical declarations. The indirect thunk keeps its existing comparison
fallback when physical page/region proof is unavailable. No selected demand is
removed yet, no binding lifetime is narrowed, and result ABI remains canonical.

The planned adjacent size-selection concern has11real frontend cases. Initial
struct spelling, a fixed instead of variable word-read fixture and allocation
discriminator mistakes are corrected before their claims; genuine missing-home
and namespace failures precede implementation. Final loop/complement fixtures need
the existing source-loop range map to prove distinct global storage, not a weakened
cache expectation. A message-only eager BigInt serialization failure is test setup.
The corrected11cases and787combined directed cases/72files pass, along with build/
typecheck,45boundaries, all11unique oracle hashes and all seven original none
artifact identities/empty diagnostics. The72-chain now reaches actual symbolic
lowering despite a canonical allocation error; selected allocation/public size are
still unimplemented. Original requests/results and certification remain unchanged.

The bounded base and SFA reviews establish no production defect within this exact
handoff. They both identify the same MINOR proof gap: non-throwing binder error
results were not excluded by three assertions. Merged DS-RV-001 replaces them with
actual complete-result checks. DS-RV-002 corrects stale concrete-home/placement
documentation. Fresh format/build/typecheck and all11seam cases pass; an additional
real shared mainline/IRQ private-namespace closure/binding case brings that concern
to12passing cases. The extra case tests actual semantic context selection, not just
a synthetic root alias. This does not establish native interrupt execution.
Reviewers inspect current source; change attribution, baseline
and execution are parent-attested. Historical setup-smoke exposure is excluded.
No third SFA fix review, selected-storage closure or final phase clearance follows.

The output auditor resumes only after receiving parent-supplied current router,
exact five release fields and normative excerpts; no denied/protected guidance read
is retried. It reports no findings for the handoff and explicitly does not turn
generated-reference equality into independent expert parity. All28sequential
four-profile native cases pass through ACME0.97, complete output reconciliation,
shared re-closure and VICE3.10 in44.79s. Expected answers are independent: nested
staging/dynamic-word read gives$1242, signed extension across a call gives$FF80,
local pair returns7/9, both finite function targets give7or9, and cached~$55gives
eight$AAbytes under X/Y. Status is **VICE-verified / hardware-unverified**.

| PAL fixture | Code bytes, excluding startup | Complete PRG bytes | Retained SFA RAM/ZP | SHA-256 |
| --- | ---: | ---: | --- | --- |
| Nested staging/word read |206|839|25/2|`69250d7686f79ce9d88be3a8825c0906426f07888300424e03f572d2e58ecdc8`|
| Signed cast/call |114|737|12/0|`4f0613a011b86d5c074494c43821766c251780f80d5759130bdd56a1e3c00c80`|
| Local aggregate return |38|671|2/2|`2de612941c6c99e3331642a1f3937268362502e9dc9675e83d84b83f523bd230`|
| Finite indirect, either target |84|707|7/0|`a44b3023787387583ae6352ec7cae04c203aebd133dcaedaf79afa78d077372b`|
| Loop/complement X |42|689|4/1|`0aece8ee692a88a94ed657685172d660e1666a9566a2f965654f8082c7981085`|
| Loop/complement Y |42|689|4/1|`f718ff5c2e48acc158a0d5b0e6dea9b3d5723c2d1d4e8f5c32ca72391a5887c0`|

Exact13a native reproduction uses the in-memory manifest/snapshot construction in
`services/size-selection.impl.test.ts`, with project name`selected-storage`,
sourceID`src/game.blend`, selected profile and no final source newline. The original
canonical inventory is passed as logical declarations without physical placement;
only the loop sources use the existing Closed source facts and X/Y policy. Close
storage, shared layout, ACME serialization and complete report/label/PRG verification
before VICE. Stop after startup at main, seed C110–C114with34,12,10,C1,80(hex),
except indirect C110is0or1. Loop data3200is55. Observe at startup.restore.

| Native kind | Exact source bytes, UTF-8 without final newline |
| --- | --- |
| Staged | `module Game;function add(first:word,second:word):word{return first+second;}function work():word{let item:byte=7;let converted:word=word(item);let address:word=peekw($C112);return add(converted,add(peekw(address),word(item)));}function main():void{pokew($C100,work());}` |
| Signed | `module Game;function keep(value:sword,other:word):sword{return value;}function other():word{return peekw($C110);}function main():void{let value:sbyte=sbyte(peek($C114));pokew($C100,word(keep(sword(value),other())));}` |
| Aggregate | `module Game;struct Pair{left:byte;right:byte;}function pair():Pair{let item:Pair={left:7,right:9};return item;}function main():void{let result:Pair=pair();poke($C100,result.left);poke($C101,result.right);}` |
| Indirect | `module Game;function left():byte{return 7;}function right():byte{return 9;}function main():void{let target:fn():byte=peek($C110)!=0?&left:&right;poke($C100,target());}` |
| Loop | `module Game;place(at:$3200)let value:byte;place(at:$3400)let answers:byte[8]=[;0];function work():void{for(let row:word=0;row<4;row+=1){answers[row]=~value;}for(let row:word=4;row<8;row+=1){answers[row]=~value;}}function main():void{work();}` |

All six source/policy identities are byte-identical across the four profiles and
the applicable indirect input choices. Compact sorted JSON tuples
`(mode,policy-count,PRGbytes,codeBytes,SHA-256)` hash to
`710731bece756f9df4c0726716f4902b3939711da3683172ec0bd6c354dd8f20`.
For loops policy-count0meansXfirst/1meansYfirst; every other tuple uses0.

Fresh actual-placement reconstructions produce identical complete PRGs for all
five non-indirect source/policy identities. The real-placement indirect path uses
the existing thunk and costs64code/687PRGbytes versus84/707for logical fallback:
the20-byte construction cost is real. AR-P28 permits this fallback, not a parity
waiver. A credible proved page-safe thunk is JSRthunk/JMP(pointer),6bytes/11cycles
before callee execution; its RTS is additional. The complete64-byte generated
reference is not an independent expert floor. Final candidate comparison must
retain a feasible canonical reference, charge all selected path/startup/data/
padding/stack costs and satisfy the original963/725limits within37attempts.
Unknown physical facts remain unknown; the fallback's cost cannot be waived when
that later gate is reached. No new indirect mechanism is authorized here.

The first native scratch probe expects a JavaScript transpiler payload from the
normal TS7package and stops before execution because that file is absent. It is
corrected to Node22's own type stripping for the existing VICE helpers, entirely
within owned scratch. No compiler/dependency/harness change follows. The first
oracle-check script counts repeated historical hash rows instead of unique source
files; all hashes already match, and its corrected distinct count is11. Neither
host-probe mistake is a product failure or an unearned pass. No commit/push or task
promotion follows this partial unit; selected demand/results and access-complete
occupancy still remain task13b/c, followed by the existing later gates.
After both minor corrections and the real IRQ context case, the fresh combined
suite passes788cases/72files in46.11s. Task progress remains24/40.
Owned task13a scratch`selected-storage-yj2b8ffk`is removed after verifying all five
exact native source strings and qualified identities are durably recorded above.
No repository content, other runtime evidence or another agent's files is deleted.
The independent smallest-mechanism challenge for selected demand/result projection
and access-complete occupancy is pending before task13b/cimplementation. It has no
scratch writes; no further scope addition or oracle authority is inferred.

Task13b removal/result checkpoint, 2026-10-18: AR-P29's single independent challenge
confirms one post-selection projection in existing owners, followed by separately
sealed/covered binding occupancy. It adds flat-eight's explicit complete occurrence
proof as distinct authority. Source/result/loop/capture metadata and actual absence
of every operand/effect reference are both required; unused requests alone are not
removed. Startup and every body/helper block are scanned. Unknown demand, stages,
persistent/page-safe links and the native source-variable write/home remain.

Allocation-independent logical inputs now opt into one complete projected inventory;
legacy physical recipe qualification and canonical none retain their inventories.
Internal fixed-object result rows preserve function/domain/root while naming the
resolved real global/private backing and width, never an erased hidden pointer.
Canonical-plus-late demand and source authority remain as conditional observer
evidence. Only retained late requests enter requiredStorage/candidates/discovery;
the same selected requests/results feed certification, helpers and existing closure/
shared re-closure. Source ownership is explicit, not a display-name inference.
No retained lifetime is narrowed yet; task13c's seals and access coverage remain due.

Eleven new projection cases have meaningful RED before production, while the prior
twelve seam cases pass. All23then pass. The newly authored counter test initially
assumes no unrelated captures; actual LowByte/FlatEight captures have no elimination
proof and must remain, so the implementation-tier check is corrected to assert only
the counter replacement and exact retention of all other demand. No specification,
source/behavior oracle or numerical limit is changed. The earlier newly authored
loop-handoff comparison now compares actual code/data/startup rather than whole
inventory, since demand projection deliberately changes only that metadata.

The first combined test run times out while Vitest attempts to print the enormous
cyclic source-authority difference from that intended metadata change. A separate
actual72-chain probe finds one real two-byte request, not an allocator stall; the
correct code-only comparison then finishes normally. No process still holds the
owned timed-out log. The new discriminated result type lives in the existing storage
type owner, re-exported by selection, to keep readable code below700lines without
a new module. Final counts: selection681/interference375/types313/lower695/
function694/state696. No allocator, binder or aggregate-return implementation edit.

Fresh build/typecheck,799directed cases/72files (44.18s),45boundaries (2.01s), all
seven original none artifact identities/empty diagnostics and all11unique output
oracle hashes pass. The72-chain closes and survives shared re-closure using72fixed
result rows, one caller-owned object, no late demand and zero required ZP; canonical
allocation was not a prerequisite. This is internal selected closure, not a public
size build or full task13qualification. The bounded base review reports no findings;
SFA and output dispositions remain pending.

All28sequential actual projected native cases pass in41.17s through ACME0.97,
complete report/label/PRG verification, shared re-closure and VICE3.10. These are
seven sources/policies on the four cooperative profiles. Original full startup,
source data, retained unexplained homes and generated bounded stack are charged.
The seven complete identities match across all four profiles. Compact sorted JSON
tuples`(kind,codeBytes,PRGbytes,SHA-256,RAM,ZP,boundedStack,omittedCount,requestCount)`
hash to`ec59d08ea23021621be4b91701309fb45176f6463d31a5a40e4cad58b2b7d1be`.

| Projected fixture | Code / PRG bytes | SFA RAM/ZP | Bounded generated stack | Omitted / retained requests | SHA-256 |
| --- | --- | --- | ---: | --- | --- |
|72-return chain|313/936|2/0|144|72/1|`ef2e8f3307d7de087e4787438f740f39ff6920e595302f73d735796babc998ae`|
|Global result/borrow|33/656|2/0|2|3/1|`c532f9aadd36b42c5ed1b2aedc63b40cf5c8c38737e2c442d56f79d2e2a43925`|
|X counter|20/667|0/0|2|1/0|`b7eaf55d940a3d454b9ac1857106a56d9018a302b05c1ae438efd79e3539a10c`|
|Y counter|20/667|0/0|2|1/0|`b6cdc7b8d65c07f2ba4e04c1f055ba21b54d0cea528aa8b9d81daccaa06d1483`|
|LowByte|50/697|1/1|2|1/2|`e8c54b728061137f880194fc15cfe1d0ceac146198572ef8129d275e7f318bcd`|
|FlatEight|103/750|1/0|2|1/1|`ec2fb8e54efe69d51e68c51da1ae38d74fc42836675b587ec66f0a24cb9bfc0e`|
|Native capture|37/684|1/0|3|2/1|`b2f3061da83704b8b7fff76f032f50e7024aa70c16b34988301e4709ae15a1f7`|

Code includes every ordinary function/helper, excluding startup; PRG includes the
load header and complete code/data/padding. Frame-free X/Y still have the eight-byte
source array and full startup, not free output. Low/Flat retain unproved capture
demand; the object fixture retains one unexplained local. No generic dead-request
sweep or free-home claim is made. The chain's bounded144-byte generated stack is
not an unrestricted external-NMI/firmware peak guarantee. All original resource
limits and later complete B/R/T comparisons remain binding.

The X work bytes remain0973=`A2 00`,0975=`AD 10 C1 9D 00 34`,097B=`E8`,
097C=`E0 04 90 F5`,0980=`60`:14bytes/71nominalcycles, plus6bytes in main.
The capture work remains31bytes:0973=`A9 78 8D DC 0A A2 00`,
097A=`E0 04 B8 90 01`,097F=`60`,0980=`08 28 AD DC 0A 18 69 78 8D DC 0A 9D 00 34`,
098E=`E8 4C 7A 09`. Its source variable is now at0ADC; its retained two-store
window is6bytes/9cycles. This preserves the existing local expectations; it does
not establish expert parity for every alternate or the complete input program.
Old/new physical/raw/bank/dummy/asynchronous/state/debug acceptance remains due.
Status is fixture-only **VICE-verified / hardware-unverified**, progress24/40.
The completed bounded base, SFA and output interface reviews all report no findings
for13b. They inspect current source; attribution, raw/native measurements and hashes
are parent-attested, not independent artifact decoding or expert whole-program
comparisons. Historical routing-smoke text is incidentally returned and excluded.
No full13c/observer/debug/public-size/963/725or full-phase clearance follows.

Task13c begins with the source producer only: three new binding-authority cases
are meaningful RED while the old backing-view regression stays GREEN. Each produced
binding lifetime now carries a private seal over original program/function/binding
and full definition/live-position/crossed-call content. Identical-looking unsealed,
re-keyed, altered or rebuilt-source facts fail validation; valid original facts pass.
Fresh build and all four producer cases pass. No machine request lifetime has yet
been narrowed, and the consumer coverage/query wiring remains due. These early
tests do not advance hardening task1.3.1. Original AR-P27 snapshot retention is intact.

Task13c covered-occupancy implementation, 2026-10-18: Closed source-binding requests
now consume their producer-sealed lives only after every actual operand/effect
reference maps to one exact original occupied source position. The index retains
ambiguous spans rather than choosing one; existing terminator loads use the owner
span and therefore also fail conservatively if more than one boundary matches.
Unknown source/context/owner, callable/interrupt/rooted or non-main instances,
foreign backing and uncovered accesses retain original occupancy. Only verified
direct-call parameter stores may map to common callee entry0; other cross-owner
references are not treated as marshalling. Snapshots, argument stages, pointer/
helper scratch, spills and saved links retain their prior lifetimes. Direct keeps
canonical binding occupancy. Widths, constraints and interference algorithms stay
unchanged; helper conflicts remain conservative pending task14.

Three additional integration cases are meaningful RED before consumer wiring:
disjoint locals do not yet overlay, parameter lives remain canonical, and altered
supplied content is accepted. The cross-owner borrow case already passes as a
justified conservative control. After implementation42targeted source/closure
cases pass, including original-source seals after real zero-page reservation and
full-profile shared layout, unknown/outside/effect/ambiguous associations, missing
owners/domains, callable/IRQ/snapshot controls and simultaneous incoming delivery.
The current base and SFA reviews report no findings in this exact unit; output-cost
review is pending. Their static source review is not independent diff/native proof.

All60four-profile selected-demand/covered-life native cases pass in86.93s through
actual ACME, complete output reconciliation, shared re-closure and pinned VICE.
This includes all28previous projected cases and32new cases: disjoint locals,
incoming parameters/dead local, surviving dead assignment, zero-shift word view,
source-owned ZP, X/Y overlapping converted counter snapshots and cross-owner borrow.
Expected values are independent:7/9,7/9,9,$68AC,7,3/4/5/6and7/3respectively.
The seven13bcomplete artifact/resource identities remain unchanged. In particular,
the two overlapping snapshots remain separate one-byte TEMP homes under AR-P27.

| New PAL covered-life source | Code / PRG bytes | SFA RAM/ZP | Bounded stack | Retained requests | SHA-256 |
| --- | --- | --- | ---: | ---: | --- |
|Disjoint locals|31/654|1/0|2|2|`676cf4b7686387001d782ead8a1335eeba2205908219a98393ff723e91e1f397`|
|Incoming parameters/dead local|34/657|2/0|2|3|`f46696b421fee057d431e4affc6066c3f21791873bb295cd48cd6e1730e695c1`|
|Surviving dead assignment|28/651|2/0|2|2|`5bd1a6bd33cd31ec9d5290410e74799a6e7146aec3a5d1f2724252d331f0a4fa`|
|Zero-shift word view|47/670|4/0|2|3|`0cea86be87f45e1ae8e4b0fe5428865bbb20704cf80d1167073fd8b6f1e37ec6`|
|Source-owned zero page|18/646|1/0|2|1|`3f80c8f348ab9109278658dfb71ae87845573abfe15e0b58878754b0ef2816ad`|
|Overlapping snapshots X|51/698|2/0|2|2|`3974736d529cffba023dc192798861ca3595afd5e2c2fd3220f8a93e2af5b372`|
|Overlapping snapshots Y|51/698|2/0|2|2|`ab05d8127aab33fe8f9d08f7fe0e42c4ea5eabcc6df03e95ce1025d153ff6648`|
|Cross-owner fixed borrow|38/661|5/0|4|3|`97892270f87947cae0a43b845813ce5ad44e23d3079aa120d7ec79e4605cbb57`|

The ZP row additionally owns one module-global ZP byte outside SFA; it is not free
or part of the SFA0column. The borrow row retains all unexplained backing/staging;
no speculative5→3claim is made. These are bounded fixture costs, not new expert
floors, full input costs or universal external-NMI/firmware stack guarantees.

The first expanded native probe stops before emission with source-placement:
its scratch driver wrongly passes the reduced SFA profile to final global layout.
The existing canonical service already distinguishes that profile from the full
platform profile. Correcting only the scratch wiring and strengthening the real-ZP
shared-closure regression yields the complete60pass rerun. No product defect,
oracle/limit amendment or guessed placement follows from that probe mistake.

Fresh ctypecheck,45boundaries, seven original none identities/empty diagnostics
and all11unique specification hashes pass. The latest full directed rerun and
an enhanced60-case source-access order/count repeat plus six canonical-occupancy
controls are pending. The latter uses the existing missing-optional-life fallback
with the same Closed object/loop recipes; it is a temporary qualification control,
not a new public mode, product recipe, old-binary claim or extra outer alternative.
Progress remains24/40until complete local qualification, review and cleanup.

Task13final qualification, 2026-10-18: the latest directed suite passes817cases/
72files in44.99s;42targeted cases, build/typecheck,45boundaries, all seven original
none artifacts/empty diagnostics and11unique immutable oracle hashes pass.
All three bounded c reviews report no findings. The output auditor's evidence-only
continuation confirms the measured endpoint below without another source/fix audit.
No third iterative fix review is claimed; full six-lens phase review remains due.

The enhanced60-case native repeat also checks independent exact read/write order
and count, not just final values. Six additional canonical-occupancy controls pass
the same value/trace oracles. All66runs are sequential and finish in95.04s. The
controls use the same current Closed object/loop construction with optional binding
precision absent, exercising its documented canonical fallback; they are not an
old compiler binary, public none, independent expert baseline or extra product choice.

| Canonical occupancy → covered | SFA RAM | Code / PRG bytes | Bounded stack | Control PRG SHA-256 |
| --- | --- | --- | --- | --- |
|Disjoint locals|2→1|31/654unchanged|2→2|`2fbae58222b5cb1fad5bf7c0b1b4b67938bc563cb9bf28da9e004ce2aa556e3b`|
|Parameters/dead local|3→2|34/657unchanged|2→2|`5f4427086f9180dfd5fef167b3672001291e54be7ef8538b33fcfadd8c60bbd2`|
|Dead assignment|2→2|28/651unchanged|2→2|`5bd1a6bd33cd31ec9d5290410e74799a6e7146aec3a5d1f2724252d331f0a4fa`|
|Word view|6→4|47/670unchanged|2→2|`f205041fdc628f3c38b1d7b6f92bdf900de35d337298d77ab17db3da70762c2f`|
|Source ZP|1→1|18/646unchanged|2→2|`3f80c8f348ab9109278658dfb71ae87845573abfe15e0b58878754b0ef2816ad`|
|Foreign borrow|5→5|38/661unchanged|4→4|`97892270f87947cae0a43b845813ce5ad44e23d3079aa120d7ec79e4605cbb57`|

Root comparison of actual post-reclosure machine records proves identical function/
block PCs, opcode/addressing/cycle-cost records and terminators/paths for all six
controls. Only allocated storage operands move. This establishes the stated static
RAM deltas, not elapsed-time improvements or expert parity. Source ZP additionally
owns its separately charged module byte. All15selected artifact/resource identities
match across the four profiles, and all60enhanced PRGs match the prior60exactly.
Their compact sorted tuples in the earlier format hash to
`294002a8a729352cd26e535bc8c53c5054b55a862c31e7fbea90eb000f7a2c24`.

Exact source reconstruction uses the same in-memory manifest/snapshot helper as
13a, project`selected-storage`, sourceID`src/game.blend`, size and both safety flags
true, with no final source newline. Every packet is Closed. Policies are Original
except X/Y/Low/Flat/Capture and the two named overlapping-counter policies. Fixed
object recipes are enabled only for Chain/Object/Borrow. Source ZP uses the real
reservation service, its reduced SFA profile and the full platform for final layout.

For loop-family cases define prefix`module Game;place(at:$3400)let answers:byte[8]=[;0];`
and append`function work():void{BODY}function main():void{work();}`exactly:

| Kind / policy | Exact BODY |
| --- | --- |
|X / XFirst; Y / YFirst; Low / LowByte|`for(let row:word=0;row<4;row+=1){answers[row]=peek($C110);}`|
|Flat / FlatEightXFirst|`for(let row:word=0;row<8;row+=1){answers[row]=peek($C110);}`|
|Capture / XFirst|`let value:byte=120;for(let row:word=0;row<4;row+=1){asm_php();asm_plp();value+=120;answers[row]=value;}`|
|Overlap-X / XFirst; Overlap-Y / YFirst|`for(let col:word=0;col<4;col+=1){for(let row:word=0;row<4;row+=1){answers[row]=byte(col)+byte(row);}}`|

| Kind | Exact remaining source, UTF-8 with no final newline |
| --- | --- |
|Object|`module Game;struct Pair{left:byte;right:byte;}place(at:$3400)let answer:Pair;function pair():Pair{let item:Pair={left:7,right:9};return item;}function read(value:const Pair):byte{return value.left;}function main():void{answer=pair();poke($C100,read(answer));poke($C101,answer.right);}`|
|Disjoint|`module Game;function work():void{let first:byte=peek($C110);poke($C100,first);let second:byte=peek($C111);poke($C101,second);}function main():void{work();}`|
|Parameters|`module Game;function work(first:byte,second:byte):void{poke($C100,first);let dead:byte=0;poke($C101,second);}function main():void{work(7,9);}`|
|Dead|`module Game;function work():void{let first:byte=7;let second:byte=9;first=3;poke($C100,second);}function main():void{work();}`|
|View|`module Game;function work():void{let first:word=$1234;let saved:word=first>>0;let second:word=$5678;pokew($C100,saved+second);}function main():void{work();}`|
|Zero page|`module Game;zeropage { shared:byte=7; }function work():void{let item:byte=shared;poke($C100,item);}function main():void{work();}`|
|Borrow|`module Game;function use(value:const byte[2]):byte{return value[0];}function work():void{let items:byte[2]=[7,9];let other:byte=3;poke($C100,use(items));poke($C101,other);}function main():void{work();}`|

Chain source is`module Game;struct Pair{left:byte;right:byte;}`plus newline, followed
by72lines`function pairN():Pair{return pairNEXT();}`forN0..70and
`function pair71():Pair{return {left:7,right:9};}`. Each NEXTisN+1. Append newline
and`function main():void{let result:Pair=pair0();poke($C100,result.left);poke($C101,result.right);}`
with no final newline. This is the exact source generator, not a changed oracle.

After startup stops at main, seed C110withA5except Disjoint's C110/C111=7/9.
Observe values at startup.restore, before caller cleanup. Input tracepoints are
loads at C110/C111; output tracepoints are stores at C100/C101or3400..3407.
Clear earlier checkpoint events after tracepoint installation, before resuming.
X/Y/Low require four ordered read/store pairs; Flat requires eight. Overlap requires
stores3400..3403repeated four times. Capture requires one store to3400..3403in
order. Disjoint requires readC110/storeC100/readC111/storeC101. All other outputs
are stored exactly once in source low/high order. No host seed write is counted.
Compact sorted tuples`(profile,kind,PRGhash,expectedValues,orderedTrace)`for all60
enhanced cases hash to`38cbb2efecb407bc748ba7ebdf758258203bf6d54924b2fc939564f1dd4c6dda`.

The final output review treats these data as parent-attested measurements, not an
independently decoded expert baseline. Existing#114and complete B/R/T, frontier,
old/new physical/raw/bank/dummy/async/P/debug, public size and963/725gates remain
open. Status stays **VICE-verified / hardware-unverified**. No composite GREEN
checkpoint, phase-baseline change, commit or push follows. Task13promotion waits
for the final source/frozen/link/format checks and owned scratch cleanup below.
Those checks pass for all19touched production/test owners: targeted formatting,
700-line ceilings and no planning references in source. All158checked local links,
whitespace and frozen/excluded paths pass. The17production producer/consumer paths
named by this unit, sorted as`(repoPath,SHA-256(fileBytes))`and compact-JSON hashed,
have scoped content digest`72d1c82846f7211719524641a1c0b92a324882a1efe64d98eb827b6e513c2740`.
This is a bounded source identity, not a full compiler-tree/binary attestation.
The exact owned`selected-projection-kg1if50q`scratch directory is removed only
after all three reviewers finish and the sources/hashes/traces/costs above are
recorded. Other runtime evidence, worktrees, user files and repository artifacts
are untouched. Continue task14; no sibling task, parent task or RD closes.

Task14entry, 2026-10-18: existing startupStackBytes1means transient PHP/PLA
capacity, not a byte held throughout source execution. Closure currently compares
that separate maximum; both ordinary and IRQ route composition need the exact
held-state distinction. One independent challenge selects constructor-produced
held/transient facts and three existing stack consumers, rather than changing
analysis selection for ordinary programs or inventing helper/source PHP nodes.
AR-P30 owns the exact three-file/three-existing-test-concern scope question.

No task14production/test edit or scratch exists. Current startup constructors stay
0held/1transient, with no generated-code change; actual held-P emission and its
copied-P/IRQ main-entry boundary remain task16proofs. Helper live-request precision
uses original source positions and explicit domain/root facts, retaining all
unproved staging/scratch/views and existing interference. Metadata precision is not
itself a claimed allocation win. Task14and dependent16/17wait for direct approval;
no sibling or parent task advances. Progress25/40, keyboard38/48, no push/commit.
The user then directly approves AR-P30's exact six concerns on2026-10-18after
requesting the interrupted prompt again. Task14resumes: first qualify constructor
facts and held/transient root accounting, then helper call-live metadata. No current
startup instructions, helper output lifetimes, source relative-depth rules or
default none behavior may change. No task16work or sibling promotion is implied.

Task14implementation/verification, 2026-10-18: actual constructor output now carries
heldBytes/transientPeakBytes. Both current startup forms report0/1and their actual
instruction/state construction is unchanged. The transient count is absolute and
already includes held state when present. Existing binders without facts keep the
legacy profile path. Actual0/1facts matching the existing profile1add no graph-hash
record, preserving canonical none. Other facts are validated as coherent nonnegative
safe integers before discovery and enter certificate identity.

The ordinary call analyzer adds held bytes once at main/initializer roots before
root competition, not once per callee or after choosing an independent callable
winner. The IRQ model adds the same base to each composed main/initializer program
portion with its associated system bytes/route, preserving source-relative saved
depths, delayed I-bit behavior and collected overlap pairs. NMI per-entry summaries
remain independent. Existing measured-peak versus capacity-minus-reserve checks are
unchanged. Current facts do not qualify task16's held instruction sequence or its
copied-P/generated-IRQ main-entry boundary; that separate proof remains mandatory.

New stack/constructor/IRQ cases give11meaningful REDs with31baseline passes before
production edits. The callable competition control already passes, guarding against
the tempting but wrong post-winner addition. All42then pass, including nested held
once, initializer JSRs, transient2not1+2, exact8-byte use at10raw/2reserve capacity,
one-byte deficit, invalid counts, unchanged IRQ system/overlap records and actual
constructor/rebinding0/1facts. No existing oracle/assertion is amended.

The actual dynamic multiply helper then provides a separate meaningful RED: an
already covered dead retired binding remains in its live-request list. The outer
producer now records actual domain/root fields, never decoding generated IDs. A
single per-lowering query indexes owners/source positions and retains the exact
canonical set for Direct/none/missing or ambiguous facts. Only context-matching
producer-sealed covered local/parameter lives can prove absence at the exact helper
operation. Unproved temporaries, snapshots, stages, pointers, scratch, outputs and
persistent storage stay conservative. Helper-free programs do not build the index.
No helper output lifetime or interference rule is shortened by this metadata step.

The first RED-summary script uses the wrong English substring, but the retained
Vitest result itself fails at the intended dead-binding inclusion assertion. That
host summary typo is not a product failure or a pass. Current71directed cases and
the fresh835-case/73-file owned slice pass in46.47s, alongside build/typecheck,
45boundaries, all seven original none identities/empty diagnostics and all11unique
immutable specification hashes. Formatting/700-line/reference guards pass for the
task14scope. Source maximum remains below700; the existing size-selection test
concern has689lines, leaving no authority for an unapproved extra concern.

Eight sequential helper native cases (Closed/Direct × four cooperative profiles)
pass actual ACME0.97, full report/label/PRG verification, shared re-closure and pinned
VICE3.10 in12.58s. Exact source is below, using the existing selected-storage
in-memory snapshot helper, sourceID`src/game.blend`, no final newline, size and
both safety flags true, Original loop policy and no fixed-object recipe. Only
the named non-loop bundle differs:

```blend
module Game;function work():void{let retired:byte=peek($C110);poke($C100,retired);let left:byte=peek($C111);let right:byte=peek($C112);let product:byte=left*right;poke($C101,product);}function main():void{work();}
```

The code block's displayed newline is not part of its source byte string. Seed
C110/C111/C112=A5/7/9after startup stops at main. At startup.restore independently
expect C100/C101=A5/3F and exact ordered trace readC110/writeC100/readC111/readC112/
writeC101. Clear old checkpoint hits after installing non-stopping tracepoints.
No seed writes are counted. Actual binder facts remain0held/1transient in both
initial closure and final shared re-closure.

| Native bundle | Complete PRG bytes | Unique SFA RAM/ZP | Bounded program stack | Helper live IDs | PRG SHA-256 |
| --- | ---: | --- | ---: | ---: | --- |
|Closed|712|4/2|4|3|`ea534457197c54951214e72d478c698d487b5c45780fe01282fe081bb81102a7`|
|Direct|712|5/2|4|5|`ff07585a59e301113717483a754164b2bb9590ee67394c623c32f9bc4ffcf9da`|

A ninth native PAL control restores the conservative five helper-live IDs while
retaining the exact same Closed source/code/inventory. It passes the same values
and ordered counts, with identical PRG/hash, RAM4/ZP2and stack4. Therefore helper
list precision alone has no demonstrated allocation win. Direct5→Closed4RAM comes
from task13's covered binding occupancy and is not attributed to task14. All startup,
data/padding and bounded stack remain charged; external NMI/firmware aggregate and
physical hardware remain unproved. Status: **VICE-verified / hardware-unverified**.

Bounded base/SFA/platform reviews report no findings for their assigned current
interfaces. They inspect current code with parent-attested change attribution and
execution, not independent historical diffs or assembled byte decoding. Historical
routing smoke text is excluded. The completed output review also reports no findings
and confirms the control refutes any task14allocation-win attribution. No actual held-P native,
full observer/debug/public size/963/725or full six-lens phase clearance follows.
All four bounded reviews are complete. Both native bundle artifact/resource/traffic
identities match all four profiles; compact sorted tuples
`(bundle,PRGhash,PRGbytes,RAM,ZP,boundedStack,liveIDs,orderedTrace)`hash to
`937ba6ebaa461cbebf2339f5a304ab3a159e2ec0f0e46259172b5468e230c0e2`.
The seven task14production paths, sorted as`(repoPath,SHA-256(fileBytes))`and compact
JSON hashed, have scoped identity`43ae065a18b9228f372ef7052fa5480cfc7a1cd3c3043abe2fb42443cfb8db66`.
This is not a whole compiler/binary attestation. Exact source and artifact/cost/
trace reproduction are recorded above before removing only the owned
`call-stack-handoff-fmv_n5lr`scratch directory. No other runtime evidence, worktree
or user artifact is deleted. Task15is next; no parent/RD/phase closes or push occurs.

User requests commit and push before continuation on2026-10-18. Install, build,
typecheck, all11recorded oracle hashes, frozen-authority and whitespace guards pass.
The first full test command is interrupted by the tool's120-second timeout; it is
not a completed verify. Its captured compiler output already records13frontier
specification failures, including public size construction, rejected-reference
recovery and the existing costs-evidence rule. No GREEN composite commit or push
is permitted. The longer full run completes in137.9s: compiler2466pass/13fail/
two existing skips across167files, one file failing. Other owned package suites
pass. The root suite does not run after the compiler package failure. No successful
full verification is claimed. Its original frozen/spec/source/cost expectations
are unchanged; unfinished size candidate/evidence tasks explain these failures.
The user's explicit push authority applies to the eventual green checkpoint, not
to automatic later pushes or bypassing verification. No history/index is changed.

Task15's independent minimum-sufficient challenge recommends one standalone pure
post-layout verifier, with task17's mandatory consumer; AR-P31 records the technical
resolution. No new shared-storage hook or algorithm is needed at this boundary.
Unknown observations reject a complete tuple, while invalid provenance is terminal.
Qualification begins in the already planned observer module/test concern with
bounded actual-NMOS access envelopes; no general bus/context analysis framework or
extra module is introduced. The query alone cannot accept a candidate or close
task15. All actual source, two-layout, rejected-reference, bank and async obligations
remain until the full verifier qualifies.

Task15a's query is now implemented only in the planned observer module. It accepts
actual selected NMOS forms and final PC/label origins, independently proved byte
index/pointer domains, and returns immutable possible-address envelopes. It never
uses optional instruction.memory to narrow a bus footprint. Fetch/16-bit wrap,
zero-page index/base dummy, indirect pointer-byte wrap, conditional indexed-read
and unconditional store/RMW dummy, separate old/new RMW writes and NMOS indirect
JMP page wrap are represented. Missing targets/unsupported stack/control/invalid
facts return unknown. An envelope is not an ordered cycle trace and proves no bank,
MMIO count/order, state, source-domain or whole-candidate acceptance obligation.
No production consumer is installed and no shared-storage algorithm changes.

The initial21logic cases pass, including2048independently computed low-byte/index/
opcode witnesses and a separately enumerated wrapping pointer-domain rectangle.
Base review finds two MINOR necessary corrections: freezing the returned ranges
also freezes a caller-owned pointee object; inherited opcode names can reach the
Object prototype and throw before returning unknown. Four meaningful regressions
fail before either fix, with21unchanged passes. Copy before freezing and an own-key
opcode guard correct them. All25then pass in1.65s, fresh build2.73s/typecheck0.94s,
45boundary cases2.71s and targeted formatting. Source/test are247/317lines; no
specification assertions change. Original full-checkpoint other packages pass
CLI62/language-server21/VSCode6cases; the root suite remains unexecuted after the
compiler's13frontier failures.

The first platform reviewer reports no arithmetic finding but accidentally reads
prohibited historical routing smoke, explicitly declining decisive clearance.
That review is excluded. A fresh clean replacement receives only the two assigned
files, actual CPU/types if needed and authorized normative excerpts; full routing,
historical/evaluator/qualification reads are forbidden. Its result is pending.
Base review reports the same historical exposure but excludes it; its two concrete
findings are independently reproduced by the root before fixes. No blind behavioral
or hardware qualification is attributed to either exposed context.

Current bounded source identities before cleanup: observer module
`cdc280bcacd73ba791bf564448bf1f1759c622c3bfe01f4ee82b38d5d637f3d7`;
adjacent implementation test
`9fb5151269a67b7d3a03bb1c1e8c296853f617804a26b8bbe9da8b2ff2b158fb`.
These are source-byte hashes, not assembled artifact or native-bus attestations.
All11original oracle hashes and frozen-authority/line/reference/link/whitespace
guards pass. Durable commands/results and the meaningful four-case RED are recorded
above before removing only owned `checkpoint-push-5_zkc6n3` scratch. No unrelated
evidence or worktree is removed. The clean review uses current source, not logs.
The full checkpoint remains RED; no commit/push or progress promotion follows.

The clean replacement platform review finds no address undercoverage for supported
well-formed forms, but reports MINOR FO-TP-001: a missing immediate operand is
accepted as a fetch envelope. Its source reads stay within the two assigned files,
necessary CPU/machine definitions and routing1–160; no prohibited historical/
evaluator material is opened. One focused regression gives a meaningful RED with
25unchanged passes. The query now rejects a null immediate operand before returning
success. All26cases pass in1.34s, build2.01s/typecheck0.65s. No broader validator or
acceptance guarantee is introduced.

The next existing-owner provenance unit reproduces a real missing handoff: a
source helper called in main and IRQ has two correctly emitted/specialized bodies,
but neither carries the actual execution context. The new real-source integration
case fails at undefined domains before any producer edit. The already owned machine
types/lower-function producer now retains an immutable copy of its actual context
only for selected source-fact attempts. No generated-name parsing, context reanalysis,
new instruction or namespace/allocator rule is introduced; none keeps its original
metadata shape. Binding and final layout must preserve this exact association.
Concrete verification is pending. This is narrow AR-P31 provenance retention, not
a general context engine or completed asynchronous-observer proof.
The first broad run reveals two unchanged equality guards: merely carrying source
facts in the legacy allocation-first path must not change its generic machine
representation. Both fail only because of the added metadata. The producer is
therefore restricted to the actual allocation-independent logical-storage path,
with source facts present. No existing assertion is edited. The integration case
also checks absence on its actual final canonical reference; re-verification is due.
That first refinement restores the two fact-only guards but exposes five existing
logical-versus-physical selected-recipe equality guards. Provenance must describe
the same explicit selection regardless of whether lowering began with homes. The
final guard therefore records context only when a non-loop bundle or loop policy
is explicitly chosen, independent of allocation order. Merely carrying unselected
facts and canonical none keep their original representations. These seven old
assertions remain unchanged and all must pass before this unit qualifies.
The final explicit-axis guard passes all862cases across74files in52.15s, with
fresh build2.19s/typecheck0.69s and targeted formatting. Production source remains
under700lines: observer249, machine types603, lower-function698. The combined
observer implementation concern is510lines. No old assertion is edited. The retained
context is the actual body-construction context, not every caller or preemption;
the complete original execution proof must still govern final observers.

AR-P32 then records a separate real scope boundary: the currently unlisted C64
interrupt-wrapper factory discards body source/context metadata. No edit to that
producer occurs. The independent minimum-sufficient challenge examines actual,
retained and raw variants before an exact user-owned scope decision. Task15's partial
work remains unpromoted; task17 is visibly blocked on this required handoff. The
ordinary-body provenance review is bounded separately; no wrapper, asynchronous,
whole-candidate or phase clearance is inferred.
The bounded SFA producer review reports one MINOR documentation correction,
FO-SF-001: the retained field is body-construction/ABI provenance, not actual or
complete execution evidence. Retained-only callees and shared code may carry a
representative descriptor without proving invocation. The field comment now states
that distinction and requires the original complete execution analysis. No algorithm,
schema, target instruction, frame or runtime change is needed. The explicit-axis
guard, frozen primitive descriptor copy and ordinary association are otherwise
clear at this bounded endpoint. Retained/callable/merged-context final acceptance
still needs its own consumer tests or conservative rejection; the scope challenge
does not waive those cases.
The source/ABI documentation correction is formatted and fresh build/typecheck
pass. All seven original canonical-none artifact identities and empty diagnostics,
45boundary cases and11immutable oracle hashes also pass. The independent scope
challenge closes after exact deferred-NMI and handler-proof-exclusion excerpts:
one additional existing factory file is sufficient, with no NMI consumer edit,
proof-array propagation, new registry/module or opcode/ABI change. AR-P32 now owns
the exact unanswered user approval, including reference-shell source-only opt-in
from already owned lower.ts. No wrapper edit precedes it; task15/17 stay blocked.
After the documentation fix, the four subunit paths observer module/test and
machine types/lower-function, sorted as `(repoPath,SHA-256(fileBytes))` then compact
JSON hashed, have source identity
`a206b42ed782126ebe58876af919f92f9371d73b8ae96d07e9ade973a69f1f25`.
This is not a whole compiler or binary attestation. Exact new query/context tests,
failure sequences, commands and outcomes are retained in versioned source/journal.
Remove only owned `observer-immediate-uxt2au2a` scratch before asking the sole
AR-P32 scope question. No other evidence, user artifact or worktree is removed.
Progress26/40; no GREEN composite, commit, push, or full observer/phase clearance.
User then selects **“Approve file (Recommended)”** for AR-P32's exact additional
factory on2026-10-18. Record the ruling and unblock only its affected tasks before
implementation. Wrapper regression seeding/implementation has not started. No
instruction, ABI, proof-array, schema, oracle, numerical or broader file change is
authorized. Task15continues; none/source/complete-cost and review gates remain.
The wrapper implementation concern is seeded only after this approval. Five
meaningful REDs/28baseline passes establish lost executed IRQ/NMI owner/context,
raw association and source-only reference identity under each explicit axis.
The facts-without-selection control passes before edits. The exact two factory
concerns and lower.ts opt-in are now implemented; verification is pending. No
whole-body/proof-array spread or instruction/ABI/stack operation is changed.
Wrapper qualification now passes33directed cases and868combined cases/74files in
48.86s, build2.47s/typecheck0.69s,45boundaries,7unchanged none artifact identities/
empty diagnostics and all11immutable oracle hashes. Bounded base/SFA/platform
reviews report no findings for the metadata-only delta; none is runtime arrival,
complete asynchronous, output-cost or full observer clearance. The tests select
PAL/6581; no new four-profile/native assertion follows. Factories/lower/test remain
466/698/653lines. The original whole-input and complete phase gates remain open.

The next verifier unit implements the planned internal input/result seam and a
fail-closed initial typed-storage class. It validates actual inventory/certificate/
home/layout agreement, exact canonical eligibility, sealed original source/borrow
packets and both actual feasible layouts. Unavailable reference homes use a complete
source non-observation argument, never candidate/provisional addresses substituted
as before-homes. Numeric/raw/device/status/explicit-placement/async/callable/range
and pending-machine-window cases still reject until their stronger proof closes.
The candidate is never repaired/reallocated, and no public size consumer is wired.
New real two/72-function typed outcomes, malformed-certificate and unknown-raw/
canonical-fallback cases are seeded. This partial implementation is unverified;
readability ceilings and tests must pass before any bounded endpoint is claimed.
The first formatting pass puts that new observer module at717lines. No compression
or extra module is accepted: reuse the existing machine-source validator for its
source/recipe/lifetime invariants and the already indexed reachable-callee set,
removing duplicate checks. This preserves ownership and reduces redundant work;
the readability ceiling remains a hard verification gate, not a waived exception.
The next pass is707lines. For this strict typed-only class, use the existing pure
literal/bounded-ordinal/containment queries directly on each original source body,
indexed once per attempt, instead of duplicating an observation multimap and trusting
a copied containment Boolean. Conditional induction still rejects first. This is
bounded source querying, not re-parsing, semantic reanalysis or an extra module.
The resulting module is700lines/test699. New36directed cases pass in3.64s, build
2.19s/typecheck0.64s. The real two-function feasible reference and72-function
resource-rejected reference both reach the guarded typed-storage success endpoint
with the exact input candidate; a stale inventory hash is terminal. Unknown raw
source rejects the selected tuple while exact feasible canonical reuse remains
eligible. These are host/interface checks, not native value/arrival or cost proof.
Independent source/SFA and platform safety reviews of this new subset are pending.
AR-P33 stops further growth: required raw/bank/state/async logic and full counterexample
coverage must not be squeezed into the remaining zero/one lines. A separate
minimum-sufficient ownership challenge runs before any new file or support surface.
The completed capacity challenge recommends moving only the existing CPU envelope
concern/types/shared address helpers into machine/nmos6510-access.ts and its unchanged
cases into an adjacent implementation test. The one final observer acceptance owner
and real source/closure tests stay in their current service files. This is not yet
directly approved and no such file exists.

The new subset's base review reports no findings within its assigned contract
lens, with additional negative coverage still required. SFA and platform review
identify two MAJOR acceptance-proof gaps, accepted **for correction, not risk
acceptance or waiver** under the continuing auto-design chain:

| Finding | Independent root reproduction | Required endpoint |
| --- | --- | --- |
|FO-SF-002|Real two-function Pair fixture has certified peak4. Clone only total/program/system peaks to0; the current observer still returns complete. Static inventory hash/legality/arithmetic checks do not tie totals/helper/startup/site demands or code to the actual producers.|Linked actual lowering/shared evidence; zero or transplanted/stale demand/code facts must return error without solver replay or repair.|
|FO-TP-002|Real1180-function typed word-update source closes lowering/shared layout. Observer returns complete with startup.restore at41042($A052) and platform.startup-state41066–41069($A06A–$A06D). Restoring a BASIC-visible incoming mapping hides subsequent code/state reads.|Actual startup code/state visibility guard before any observer success, including exact canonical reuse. Reject unsafe/unproved tuples; underlying inherited placement repair remains task16-owned.|

The zero-stack probe uses the same real source family as the new two-function
positive case, no final newline, sourceIDsrc/game.blend, project observer, PAL/6581,
both safety flags true and explicit Closed/Original. Only the three peak fields
change; its expected-error assertion gives a meaningful RED. No allocator defect
or actual target stack overflow is inferred from this forged-handoff probe.

The bank-window source is reproducible without file/input-name recognition:
`module Game;let answer:word;` followed by1180declarations generated as
`function f${index}():void{answer+=1;}`, then
`function main():void{${calls}}`, calls generated in increasing index order as
`f${index}();`. No final newline. Same existing in-memory fixture/profile/flags.
Host construction takes37.007s; actual1180requests/0interference edges overlay to
2RAMbytes. The38943function-code-byte sum excludes startup/data/padding and is
**not** a complete artifact cost. No VICE, source-value execution, physical return
or whole-program parity is claimed. Both the restore code and saved state are
inside the documented BASIC ROM window for an allowed incoming-visible mapping.

The first39000-byte array attempt stops before observer in branch-layout; it is
not qualifying bank evidence. A32-function pilot closes below the window; the
1150-function attempt ends at40052($9C74), also below it. Neither substitutes for
the actual1180-function counterexample. These unsuccessful/non-discriminating
attempts are retained honestly until owned scratch cleanup.

AR-P34 records the independently challenged linked private-receipt mechanism.
Current bound-machine legality checking has no certificate/symbolic parameter,
so it cannot supply the missing association by itself. Capture actual lower inputs/
symbolic/binder contents before exposure and actual final shared outputs after
reclosure; validate the trusted producer's paired checker, immutable/root/member
association and typed contents, including runtime Map/Set membership and nested
operands. No generic framework, new registry, solver replay or second candidate
graph. AR-P35 records the necessary conservative return-visibility correction;
neither technical ruling grants new file scope.

A bounded follow-up challenge grounds the additional minimum provenance owner:
new machine/lowering-provenance.ts for specifically typed producer/checker/content
mechanics, and the unchanged57-line constant-initializer move into existing
machine/lower-data.ts. Its existing75-line data-lowering role is cohesive; do not
hide this work in the CPU helper or types/allocator files. Real mint authority stays
with the actual private lowering implementation, and a caller-created producer pair
must fail its checker. The original lowering signature/re-exports and none bytes
remain binding. Exact scope is reserved in AR-P33; no initializer move or provenance
module exists. All three typed-subset reviews are first reviews; after fixes use
their single bounded fix-review opportunity, never iterative clearance loops.
The SFA review's outstanding binding subcheck is then completed with authorized
live validator excerpts and an additional independent root RED: shift the first
final f0 STA from answer+0 to answer+1 and shift its write annotation consistently.
Standalone machine validation remains true and observer acceptance remains complete.
The expected-error assertion fails. This is folded into FO-SF-002's one selected
producer-chain association cause, not a duplicate finding; it demonstrates that
opcode/operand legality is not binding provenance. No target-value execution is
claimed for this modified tuple.

The platform reviewer confirms AR-P35's small current-constructor guard: each
actual startup block's complete encoded extent, including terminator, and the full
startup-state interval must remain visible. Any BASIC-window overlap is rejected
unless precisely proved safe; missing/inconsistent facts are internal errors.
The check precedes all complete paths, including canonical reuse, and feasible
reference facts are checked when used. Never fabricate rejected-before layouts or
relabel an observer rejection as a resource rejection. Underlying public-none
placement/return behavior for the large case remains unproved/task16-owned.

The exact AR-P33 packet is now independently hardened and ready: new CPU concern+
unchanged adjacent cases, new specifically typed lowering-provenance helper and
the unchanged constant-initializer move into existing lower-data.ts; already owned
lower/shared-storage/observer/test files wire the paired real producer/checker,
final receipt, visibility guard and regressions. This is two new production files,
one new implementation-test file and one additional existing data-owner concern,
not a new optimizer/solver/harness/runtime/public schema. Direct approval is pending;
none of those new files or the initializer move exists. Private evidence must
capture before exposure, detect nested/Map/Set changes and copied/foreign-authority
markers, and retain one candidate graph. No new algorithmic replay is approved.
The final fresh directed corpus is871passes/74files in48.03s. This does **not**
clear the independent zero-stack/final-store/bank-window RED probes, which remain
outstanding MAJOR fixes. Do not infer acceptance safety from this positive corpus.
The source/test stay700/699lines; no new module or lower-data edit precedes AR-P33.
Immediately before the reserved-scope question, fresh7none artifact identities/
empty diagnostics,45boundaries,targeted source formatting,11original oracle hashes,
all26/40task/blocked-reason counts,links/references/ceilings/whitespace and frozen/
reserved-path guards pass. This does not supersede the three independent MAJOR
counterexample REDs. The six current observer/test + machine-types/lower-function/
lower/wrapper paths, sorted `(repoPath,SHA-256(fileBytes))` then compact JSON hashed,
have source identity
`090a7d472fc8bb4074ecf147e7a820d982b28b6f319b5231ac2f1d00c3e8c254`.
It is not a binary/whole-compiler attestation. Reproduction sources, mutations,
addresses, timings and findings are recorded above before removing only owned
`wrapper-provenance-fqhuk7zc` scratch, including its unsuccessful pilots. No user
file, other session evidence or worktree is removed. No commit/push or task promotion.
User then directly selects **“Approve scope (Recommended)”** for the exact AR-P33
packet on2026-10-18. Record the ruling and resume only its named concerns. New CPU
helper/test, typed provenance helper and unchanged initializer move have not begun
before approval. Both MAJOR findings remain accepted for correction, not waived.
No new source/oracle/schema/limit/runtime/engine/harness/dependency or extra file
scope follows. Commit/push remains pending a coherent GREEN tree.
AR-P33 ownership moves are now implemented: existing CPU types/query/address
helpers and their unchanged case concern move to machine/nmos6510-access.ts and
its adjacent implementation test; observer imports that owner. The existing
constant-initializer body moves unchanged to lower-data.ts, with exported contract
documentation and cleaned imports. Move/body/assertion equivalence, build and
directed verification are pending. Provenance and bank fixes are not implemented
by these moves and both MAJOR findings remain open.
The pure ownership move passes build/typecheck and36directed cases. A bounded
lexical comparison preserves all six CPU/helper bodies, initializer body, two test
helpers and every CPU case token/string literal; moved case digest
`e2056dea4e477f5d3eb4c6f0c722359abaf18e8fd89498d39e70f1a3440f93f8`.
The first comparison cannot use the installed TypeScript7 AST API; its failure is
not a pass or authority to install a replacement. The next lexical guard scans
beyond the selected body and is also excluded; the corrected bounded comparison
and real project checks are the actual endpoint. Counts after move: CPU268/test331,
observer458/test367, lower637/data151, all readable and below700.

The specifically typed paired lowering producer and private shared-result evidence
are now implemented in the approved owners, with iterative streaming content and
identity/Map/Set comparison rather than serialized graph copies or solver replay.
Lowering failures pass through unchanged; successful shallow roots are stamped
before exposure, preserving their nested graph. The real lowerer exports only its
paired producer/checker. Root/member replacements, changed binder/site contents and
foreign producer authority have new regressions. The real1180-function bank-window
regression is also seeded. Consumer enforcement and the visibility guard are still
pending, so proof findings are not marked fixed; pre-consumer RED qualification is due.
The pre-consumer run gives6meaningful failures/11baseline passes in52.65s, including
the real bank case, zero totals, donor/code, pre-closure binder, site-membership and
copied-root probes. Foreign producer authority already fails the real paired checker.
Now finalStorageFailure enforces linked producer evidence, and actual startup block
extents (including terminators) plus saved-state interval are checked before every
success/canonical-reuse path. Bank overlap rejects the tuple; missing/inconsistent
facts error. No source lowering, allocation, binder/layout replay, default-none or
resource-reference relabelling is performed. GREEN/fix review still pending.
The first fix run passes43directed cases in56.99s with build/typecheck. Additional
coverage then keeps operand and write annotation changes consistent and confirms
standalone machine legality, substitutes same-size source-fact Map entries and
restores their original records, checks all cloned finite binder demand families,
and prevents/detects actual nested operand/data mutation. The fresh combined owned
slice passes881cases/75files in111.75s, build2.03s/typecheck0.80s. Current files:
provenance304, lower654, shared267, observer550/test593, CPU268/test331, data151.
All stay below700; no new public acceptance consumer is installed.

| Required evidence coverage | Actual fix mechanism / probe |
| --- | --- |
|Actual lowering source/profile/inventory/binder before exposure|One private producer/checker pair wraps the real private implementation; another caller-created pair fails the real checker. Failed lowering returns unchanged; successful shallow roots alone are replaced/stamped.|
|Code/data/operands/effects/costs/transforms/proof collections and nested mutable values|Iterative streaming observation of the typed producer data; tagged values, exact object membership and explicit Map/Set entries, no retained serialized graph or solver replay. Altered legal STA+annotation and nested data/operand probes error or are prevented.|
|Helper/startup/NMI/discovery/site facts|Complete binder contents plus function identity and exact Set membership are captured before shared closure. Pre-closure startup clone, each demand-family clone and same-size site replacement fail; restored genuine membership passes.|
|Final selected certificate/homes/interference/totals/routes/scoped NMI, bound code/layout/profiles|Object-local final receipt after actual reclosure/binding/layout; real lowerer's checker is mandatory. Zero totals, donor members, copied root and changed final output error before any success. Allocation-profile reservation remains distinct from original target/trailing RAM.|
|Physical return visibility independent of receipt authenticity|Actual startup block extents include terminators; saved-state interval width must match its actual object. The genuine1180-function layout and exact canonical reuse both reject BASIC-window visibility. No layout repair or native-return proof is claimed.|

This is data-association comparison, not another source-semantic authority: the
existing source/recipe/lifetime/complement/loop validators still govern those facts.
Private symbol evidence is not serialized or treated as a public artifact field.
The complete typed-input graph is observed without recursive host-stack dependence;
Map/Set/object membership metadata holds references, not a cloned candidate graph.
Both MAJOR findings are implemented/tested but remain open until the single bounded
fix reviews and compatibility checks complete. Full raw/bank/async/state admission,
public size/debug/cost gates and complete phase review still remain.
The single SFA fix review does not clear FO-SF-002: it finds a producer-time
mutation/restoration hole. Root independently reproduces a real make():Pair with
two destinations (so its generic pointer remains), substitutes the genuine mutable
allocation profile's ZP window with90–FF, performs actual provisional/shared closure,
then restores02–8F. A resulting pointer at90or above still passes the old late-only
observer, giving one meaningful temporal RED. The source/binder/root are otherwise
genuine; this is not a renamed source pattern or invented before-home.

The approved shared owner now records lower-provenance validity **before** any
binding/reclosure and requires it again before minting final evidence. Geometric
complete results without valid initial evidence remain supported for existing
synthetic geometry specifications, but have no receipt and cannot become observer-
safe after the inputs are restored. No new stage/solver/replay/schema or source
restriction is added. AR-P34's same necessary technical correction applies.
Temporal GREEN and preservation checks are pending. No third bounded SFA fix review
will be requested; this limitation remains explicit and the complete phase SFA
review remains mandatory before phase clearance.
The temporal regression and the immutable synthetic shared-RAM reclosure case
both pass after the entry-and-mint guard; build/typecheck/format also pass. The
directed filter excludes26unrelated cases in that command only; these are not
new suite skips or passes. A fresh full directed-slice rerun is in progress.

FO-TP-002's single platform fix review clears the bounded visibility guard. It
checks complete startup code/state extents, all success paths including canonical
reuse, and actual reference handling. The real host regression demonstrates code-
window rejection; state-only/reference-only branches are statically reviewed, not
independently executed. Underlying startup/layout repair and actual return execution
remain task16-owned. FO-RV-003's canonical-eligibility documentation is corrected;
the base fix review otherwise reports no findings. FO-SF-002 remains accepted for
correction until its temporal change is verified and the complete phase association
review closes; no third bounded SFA review is claimed or requested.

The fresh full compatibility run before that temporal-only guard passes install,
build/typecheck, seven original canonical-none artifact identities/empty diagnostics,
45boundaries and all11immutable oracle hashes. Full yarn test takes211.68s and
reports compiler2512passes/13known frontier failures/two existing skips across169files;
all other owned packages pass. Root tests are not reached after the compiler package
fails. No composite GREEN, public size clearance or commit/push follows.

The host-performance review is **blocked**, not clean: its native permissions deny
the exact external bounded-diff path. The denial is binding; do not transmit that
denied artifact inline, relocate it or use another tool/agent to bypass the boundary.
No performance finding or clearance is inferred. Final task1.3.7 still requires a
permitted complete-phase performance packet and actual host-cost evidence. This
does not authorize workflow/permission changes or an extra benchmark harness.

Before expanding admission beyond the strict typed subset, an independent design
challenge now checks the minimum complete raw/bank/state/async mechanism against
the actual existing source/proof packets. Missing applicability must remain a
whole-tuple rejection, but rejecting every required positive is not completion.
No extra owner/module, oracle edit or general engine is authorized by the challenge.
The corrected temporal producer boundary now passes882directed cases across75files
in116.56s, plus fresh seven original none artifact identities/empty diagnostics,
45boundary cases and unchanged11oracle/frozen-authority/line/reference/link guards.
Shared280/observer551/test628/provenance304remain below700. This verifies the root
correction, not an independent third SFA clearance or final raw/async acceptance.
The eight AR-P33 code/test paths, sorted as `(repoPath,SHA-256(fileBytes))` then
compact JSON hashed, have final repair-source identity
`d49d408cea431a84871f397109cd1b0a69f4290327112150b4697e81ef330b27`.
This is not binary or whole-phase qualification. Commands, results, temporal/source
mutations, addresses, review limits and moved-case identities are recorded above
before deleting only the owned `observer-proof-repair-jk01wiex` scratch, including
its denied-to-reviewer diff. Do not move or retransmit that artifact to bypass its
native denial. No other session file/worktree/user artifact is removed. Remaining
challenge inputs are current allowed repository source only. No commit/push/promotion.
The completed challenge confirms that authentic producer receipts do not discharge
residual source/bus/state observations. Current conditional packets retain useful
source facts, but not every operation/access/index/window association needed by the
required positive classes. Raw/platform/binding/deferred-read follow-up excerpts and
then unary/indirect/provenance excerpts close the exact missing surface. No common
end-of-operation tag or span-only matching is sufficient. No new general engine is
recommended; extra source identity is data, not proof by itself.

AR-P36 now records the independently hardened two-file residual consumer/test,
five restricted existing producer/sharing concerns, precise already-owned fields,
one unchanged pure-containment query move and preservation/reopen gates. The
multi-handler sink's device arms already traverse the outer platform producer;
namespace/binder spread preserves domain-neutral instruction data, with explicit
sharing-origin preservation needed in the existing binder. Lowering/shared receipts
already observe new enumerable fields, so no more receipt algorithm or input-state
helper scope is needed. No speculative indirect/C64/BCD/provenance/type helper file
is added. Exact direct user approval is pending; no code changes follow the challenge.
Tasks15/17 are visibly blocked, progress26/40. The original source, eight oracles,
37-attempt bound,963/725limits and full phase reviews remain binding.
The first AR-P36 question is interrupted without a ruling. The user asks again,
then directly selects **“Approve scope (Recommended)”** on2026-10-18. Record the
resolution and unblock only affected tasks before code/test edits. Begin with
data-only raw/platform/deferred access handoffs and unchanged-output checks; the
complete residual gate, required native positives and final qualification remain
due. No arbitrary producer helper, source/oracle change or stronger API is implied.
Three new real-source access-association cases fail meaningfully before producer
edits: fixed byte/word wrap, deferred second raw LDA becoming AND, and complete
platform sequences. They reach actual lowering/shared closure; no import failure is
counted. The first data-only handoff is now implemented in the approved raw/platform/
scalar consumers, internal types and canonical-size opt-in. It remains unverified.
The old typed/wrapper fixture explicitly requests manifest none so its existing
canonical-none metadata-absence assertions stay literal; no assertion is weakened.
The new residual fixture explicitly exercises size and its opt-in. No target code,
source effect or declared storage demand is intentionally changed. Sharing origins,
typed access/counter/complement facts and final residual admission remain pending.
The raw/platform handoff passes3real-source cases after a strict optional-property
type correction; build/typecheck pass. No native or final observer result follows.
The first sharing test assumes the NMI-aware `.depth0.0` bodies are merged, but the
unchanged binder's legacy rule does not merge that spelling in either mode. This
failed assumption is excluded as a metadata-defect RED. A second attempted source
creates an actually unbounded IRQ chain and fails E10245 before the sharing check;
it is also excluded, not weakened into acceptance.

The corrected test keeps the genuine NMI-aware two-body equality/control, then
exercises the existing legacy binder namespace separately with those actual source
instructions and construction descriptors. Its extra unreachable bodies are an
explicit geometry-only unit, not source-execution or observer-complete proof. One
physical body already shares while observerBodies is absent: this is the meaningful
association RED. The approved binder now excludes observer fields from both physical
comparisons and unions exact instruction/body origins for helper/root sharing.
It does not widen the legacy sharing rule or reinterpret construction as invocation.
No instruction, redirect, allocation or real NMI-aware sharing policy is changed.
Verification is pending; typed/state/occurrence closure remains unimplemented.
Sharing/raw/platform cases and the existing handler-binding cases pass6combined
tests with build/typecheck. Actual NMI-aware bodies remain two in both modes; the
separate legacy geometry probe alone exercises merging and its retained origins.
The exact approved pure-containment query move is now implemented with compatibility
re-export; bodyValuesStayLocal stays in place. Raw footprint decomposition prefers
the proved literal-plus-bounded ordinal before a coarser maximum, preserving wrap.
Its new source-based precision case is a post-change pass, not claimed RED evidence.

The first typed-access draft reaches707lines because nested constructor/provenance
calls duplicate indentation/argument scaffolding. Replacing those new nested calls
with explicit local access values simplifies the code and reaches681lines; no
unrelated compression, second extraction or extra module is used. A genuine
borrowed/global access case fails before the tag producer is added. Typed records
now retain logical place, actual register/stride/displacement and existing use-site
bound Maps, distinct from the pointer's home. Raw/platform sequences include setup;
typed records enumerate effective bytes, stated explicitly in the shared contract.

Complement, Original-loop source-block and Y-prefix cases are seeded next. The
first complement source has no admitted recipe and is excluded as a handoff RED.
The corrected ordinary packed-field/loop source has a real recipe and fails exactly
at missing operation/recipe selection. Original source-block and changed-Y cases
also fail meaningfully before their producer/mask edits. The exact sealed complement
pair, opt-in source-block mappings, consumed counter index views and bounded Y mask
are now retained. No public ABI is strengthened. One type error used a nonexistent
terminator span; the error now uses the actual function binding span. Build/typecheck
and the nine initial source/association cases pass after correction.

Further native X/Y-view, eight-connected-occurrence and mutable new-bound-Map probes
are added within the approved residual implementation concern. Their verification
and broad preservation checks are due. These are producer/metadata checks, not
final state/interrupt/bus proof. The residual production consumer is not yet written
or wired, and tasks15/17 remain unpromoted.
The producer slice passes895cases/76files in116.19s, build/typecheck and13new
association cases. Pure-containment move tokens are identical, digest
`75e389e2d97f8e52ce03dda545fbf465477b29ae65a95fba971ec54f25d4bbc2`.
Fresh original seven none artifacts/empty diagnostics,45boundaries,11oracle hashes
and frozen-authority guards pass. The SFA/output reviewers report no findings for
their bounded current-artifact associations/effect-preservation endpoints. Base
initially stops for missing baseline/commands; newly supplied exact before/after
excerpts for this AR-P36 unit and the exact verification commands allow its first
review to complete with no findings. No old denied artifact is read or reused.
These are not independent historical phase-diff, runtime or complete observer proofs.

A separate private chosen-recipe check compares metadata on/off through the actual
serializer, ACME0.97 output verification and evidence builders, using identical
evidence options rather than inventing public size decisions. Four canonical cases
and selected XFirst/complement recipes retain seven exact assembly/labels/PRG/
assets/memory/cost/debug identities each. FlatEight retains assembly/labels/PRG
identity, but its uninstrumented baseline evidence builder already throws
`Final machine block has no semantic CFG owner`. This is task18's pending debug
mapping, not a new metadata exception or qualified sidecar generation. The first
run stops there after five pairs; it is not a full pass. The bounded rerun explicitly
records the same failure for both FlatEight sides and changes no production/debug
expectation. It completes14real assemblies and45matching file identities in1.62s.

| Ordinary chosen-recipe case | PRG bytes, equal metadata on/off | Compared endpoint |
| --- | ---: | --- |
|Fixed raw byte/word wrap|655|7artifact identities|
|Deferred second ALU read|635|7artifact identities|
|Borrowed/global typed indexing|810|7artifact identities|
|Generated IRQ platform sequence|127|7artifact identities|
|XFirst counter|97|7artifact identities|
|FlatEightXFirst|173|3artifact identities; debug/other sidecars unqualified|
|Original-policy no-code complement|217|7artifact identities|

This is instrumentation preservation under one PAL/6581 target, not independent
source-value execution, four-profile/runtime qualification, a public size build,
expert win or the963/725outcome. Complete certificates also match in every pair.

The residual production concern is now started with a deliberately small checked
class: fixed ordinary-RAM raw byte/word sequences, straight-line source without
calls/platform/status/async effects and with an actual feasible reference. It checks
actual original/candidate occupied intervals, effective source byte count/order,
full producer positions and independently decoded setup/data/fetch/dummy footprints.
Setup touches owned data only. Unknown/indirect/device/wrapping-into-unsafe-domain,
missing-before or broader control-flow classes reject the whole tuple, not source.
The main gate still validates all remaining typed/source/state obligations and
uses exact final instruction identity to skip only raw members checked in both
layouts. No pending machine-window, conditional-range or async guard is removed.

The new checker indexes source definitions once per body and physical coverage
once per layout; point/range queries are logarithmic. It keeps concrete owner/source
records and reports an actual intersected interval on rejection. There is no new
source/bus/state solver, allocation, repair, context assumption or per-site fallback.
Four new host cases (ordered word success, actual-home observation rejection,
unknown address and MMIO rejection) pass with all13producer cases:17total, build/
typecheck/format pass. Current effects434/test635/main568lines before final formatting
of documentation/diagnostic additions. This initial raw class is not the required
complete task15closure: variable-address loops, MMIO, calls, source status outside
windows, native state windows, Original-range premises and safe IRQ/NMI positives
still need their explicit proof. No task is promoted or public constructor wired.
After final explicit four-profile admission, diagnostic and documentation edits,
format/build/typecheck and all17cases pass again:2.38s/0.70s/5.50s for the three
verification commands. Effects447/test635/main568lines. New consumer tests are
additions only: the previous13producer cases/helpers remain byte-identical to their
reviewed prefix after removing the new import/describe. Base, SFA and platform first
reviews report no findings for this bounded initial fixed-RAM class. The source
review's authority-only supplement supplies the five current release fields and
actual selected router/lifetime/closure excerpts; it accepts those inputs without
renewing code review or pretending independent hidden reads/execution.

Additional canonical-size metadata probes preserve equal-constant byte returns,
equal boolean returns consumed normally and differing byte returns. An earlier
probe incorrectly casts boolean to byte and stops at the frozen E10086 rule; it is
excluded as a compiler/observer failure. No source, expectation or language rule
is amended to permit that invalid probe.

Fresh install/build/typecheck, the complete899-case directed slice and full inherited
yarn test are now running sequentially. Results are pending; the earlier13frontier
failures/two skips remain the last complete-package evidence. No GREEN checkpoint,
commit/push, task15promotion or general observer qualification is inferred from
the small raw class or the successful metadata artifact pairs.
The checkpoint completes: install0.38s/build0.36s/typecheck0.34s all pass; directed
899cases/76files pass114.95s. Full yarn test206.38s reports compiler2530passes/
13unchanged frontier failures/two existing skips across170files; CLI62, language
server21and VSCode6cases pass. Root tests are not reached after the compiler failure.
No new compiler-suite regression, full GREEN, commit or push is claimed. The13
failures still belong to unimplemented public candidate/evidence construction.

Before the next higher-risk extension, an independent challenge is selecting the
minimum Original-loop/ranged ordinary-RAM proof from actual source-loop facts,
source-block/access associations and both actual counter homes. Existing opaque
MMIO/status/call/async and changed-representation classes stay rejected until their
own proof. The challenge must not assume its conditional maxima, invent missing
before-homes, parse request names as authority or grow past the approved file/test
ceilings. It uses current repository source only and no prior denied artifact.
Final preservation after the consumer checkpoint repeats the seven original none
identities/empty diagnostics,45boundary cases and11immutable oracle hashes; source
ceilings, forbidden references, links, whitespace and frozen-authority guards pass.
The nineteen AR-P36 code/test paths, sorted `(repoPath,SHA-256(fileBytes))` then
compact JSON hashed, have source identity
`6701af3e7b79dbf58d394c8407cc4fee25810852e1e7c2cbfa966843217b7121`.
The seven-pair artifact ledger, recursively key-sorted compact JSON, has identity
`eae743e07f439734ee1043e85e2db254c5a922de253c8e0acc0d3a2a028e33b1`.
These are source/fixture attestations, not a compiler release or native-runtime claim.

Artifact inputs reuse the corresponding ordinary source in the residual implementation
tests, removing LF characters only. No terminal newline is added. Canonical cases
compare metadata size-reference construction with direct none; selected-policy cases
re-lower the identical original source/facts/recipe with observerEvidence false,
then perform genuine closure/layout. Evidence comparison uses identical none options
and the same UUID solely to isolate instrumentation; it is not public size selection.

| Case | Source UTF-8 bytes | Source SHA-256 |
| --- | ---: | --- |
|raw-wrap|84|`57dc922e7ecff64ab3ea27830865748d20f397b4eba5ef28b4ccff29b75a54ca`|
|deferred-read|70|`7cce6f4553eb7831d471ad0267d8948d86e89c5b4513cbe3a5761fa5e679c964`|
|borrowed|181|`8aa27ccf3c692b05ccaffb1660e563b331e3bed423f7551c7223e10d76138614`|
|platform|142|`56e2c3f924905cf6ead2587a9da2c4acf07b30dd635fe720ee7a1cb766fdd9d1`|
|x-counter / flat-eight|99|`dfa941102e1aa184839adbbb4a7413156422884f7b85537024db0422b32f17db`|
|complement|257|`6b9cf4127d693c5ea3d8ab6a27537019807e9fb544233d85ec6a4aac1da23c0e`|

Results, source mutations, artifact endpoints, unsuccessful probes and review limits
are durable above before removing only owned `observer-effects-a2b7x652` scratch.
Its source snapshots, logs, private staging generations and this unit's own diff are
temporary, not worktrees/user content or another session's evidence. The remaining
challenge has current repository-only inputs and does not use these paths. No denied
artifact is moved or retransmitted. Progress26/40, no commit/push or task promotion.
The challenge completes with a bounded structural-induction recommendation and
identifies the nullable evaluated-address identity seam plus the interval exclusion
trap. AR-P37 records the eligible technical ruling without enlarging AR-P36 scope.
Implement evaluated-address/template and interval proof first for independently
bounded RAM addresses; Original-loop base/step/alias closure remains a subsequent
unit. No inferred request spelling, missing-before substitution, machine evaluator
or wider-context/namespace edit is authorized. Capacity and actual positives remain
hard gates; no conditional range is released merely because its policy is Original.
The independently bounded straight-line address seam is seeded with byte/word
reads/writes through a source-masked address, an unsafe second-byte device crossing
and a real occupied byte strictly inside an interval. Four positives fail at the
old fixed-only guard; the interior case also fails its required overlap reason.
The device case already rejects. These five meaningful failures precede code edits.

The approved raw producer now retains its actual immutable address representation,
not a pointer-home duplicate or request-name inference. Consumer matching checks
symbolic low/high input loads, the actual certified pointer pair, Y0/1 progression,
no pointer overwrites and word-read buffering before final CPU decoding. This
initial extension requires unambiguous main construction; it does not add namespace
rewrites or admit source loops/calls/status/IRQ/MMIO. Exclusion now tests interval
intersection, while setup ownership retains containment. Base envelopes and exact
byte Y values prevent width being added twice. New code is implemented but not yet
verified; capacity and the prior17cases remain mandatory, no task promotion.
All23cases pass in6.62s after implementation, with build2.89s/typecheck0.81s.
The complete directed slice then passes905cases/76files in117.08s. Current effects620,
test669, types667 and raw producer307lines remain within capacity. Base finds one
MINOR contract correction, RA-RV-001: fixed-only comments must describe the newly
admitted bounded/template-checked indirect class. Those comments are corrected.
The first SFA artifact review reports no findings but limits its endpoint to actual
source/address/template association; prior producer/lifetime/binding algorithms are
not newly audited. Its storage search accidentally exposes specification snippets;
they are excluded and no blind/oracle clearance is claimed. The parent retains the
full64-digit specification pin including leading0; the abbreviated reviewer display
does not amend frozen authority. Platform review and current preservation checks
are still pending. Original-loop/range premises remain unproved and rejected.
The first platform review also reports no findings for the bounded address/Y/CPU
footprint extension, including pre-Y envelopes, word offsets, discarded page-cross
reads and interval-interior exclusion. These reviews are static/before-after
artifact conclusions, not new source-value, bus-trace or four-profile execution.
After the MINOR documentation correction, targeted formatting, build2.37s/typecheck
0.72s, seven original none artifact identities/empty diagnostics and45boundary
cases pass. All11immutable oracle hashes, source ceilings/references, links,
whitespace and frozen-authority guards pass. Last complete package remains
2530passes/13known frontier failures/two old skips; no fresh full-package pass is
invented from this905-case directed verification.

The five current address-unit paths (machine types/raw producer, effects/test and
the unchanged atomic main gate), sorted `(repoPath,SHA-256(fileBytes))` then compact
JSON hashed, have identity
`dc33954696810e27b1d195b22a5147131880a3c26375762725c907416ba28efe`.
The source-masked address cases, exact record/template checks and independent
interior-overlap contrast remain versioned in the implementation concern. Recorded
commands/results and five meaningful REDs survive before removing only owned
`ranged-ram-proof-bsbd1f0k` scratch. No user artifact, worktree or other session
evidence is removed. Full Original-loop induction, calls, MMIO, status/native-state
and async closure remain due; progress26/40, no commit/push or task promotion.

The user asks to proceed with Original-loop induction. Continuation entry confirms
the current source identity,23existing cases (6.71s), fresh build/typecheck and all
eleven oracle/frozen guards. Eight private real-source probes cover typed-only,
bounded raw read/write and word page crossing, each with configured bounds on/off.
Every candidate is independently lowered/shared, not exact-reference reuse. Both
typed-only cases reject conditional range premises; the six raw cases reject
unproved source control flow. All source programs reach actual feasible closure.
These are honest pending-proof endpoints, not new specification RED or runtime proof.

AR-P38 records the required readable-capacity/ownership gate before any new proof
or test edit. The existing effects/test/main owners have620/669/568lines and the
complete induction/block-order/alias contrasts cannot be hidden by compression.
A blind challenge compares direct existing-owner work with cohesive extraction or
a specifically bounded loop concern/test split; no preferred decomposition is
sent. No new file, harness, dependency, general solver, source restriction, oracle
amendment or37-attempt/cost waiver precedes an exact ruling. Tasks15/17 and residual
test completion remain blocked; count26/40 is unchanged. No commit/push.
The independent capacity challenge returns **Justified**: extract the existing raw
layout/pointer/interval concern, leave induction in effects and one acceptance gate
in main, add a focused loop test concern and move the existing fixture for reuse.
A bounded follow-up checks actual tsconfig/vitest discovery and moves that proposed
fixture path outside src, avoiding shipped test support or an empty collected test
without configuration changes. AR-P38 now records the exact three new paths and
three bounded existing consumers, the move-first preservation checkpoint, costs,
viable alternative, counterargument and remaining uncertainty. No production/test
edit or extra file precedes direct approval. The temporary source probes confirm
eight actual rejection endpoints in1.95s; current source identity remains unchanged.

The private continuation probes use these ordinary main bodies with a literal
`for(let i:word=0;i<8;i+=1)` header; each runs configured bounds both true/false,
Closed/Original and an independently closed candidate. No behavior expectation is
derived from optimized-versus-none execution. All have one retained range premise.

| Case | Declarations / loop body | Original / selected homes | Current endpoint |
| --- | --- | ---: | --- |
| Typed-only | `let data:byte[8];` / `data[i]=byte(i);` | 3/3 | Conditional induction observers remain |
| Bounded raw read | `let data:byte[8];` / `data[i]=peek($C110+i);` | 6/6 | Unproved raw source control flow |
| Bounded raw write | none / `poke($C110+i,byte(i));` | 4/4 | Unproved raw source control flow |
| Word page crossing | `let data:word[8];` / `data[i]=peekw($C1FF+i);` | 8/8 | Unproved raw source control flow |

After preserving these results and the exact scope ruling above, remove only this
continuation's `original-loop-fit-wu6f9s00` scratch (logs, private probe source/module
and JSON results). No production/specification test was added. No other session's
artifacts, user files or worktrees are owned by this cleanup. Tasks15/17/1.3.3 stay
blocked pending the direct AR-P38 decision; no commit/push or task promotion.
The first two AR-P38 prompts are interrupted without a ruling. The user asks again
and directly selects **“Approve scope (Recommended)”** on2026-10-19. Record that
exact resolution and unblock only affected tasks before extraction/new-file edits.
Begin with unchanged raw concern and test-fixture moves, then verify preservation;
complete Original induction and stronger observers remain due. No wider scope follows.
The exact raw-layout and test-fixture moves are now implemented. The effects owner
retains the same residual orchestration and profile checks; the new raw owner holds
the same instruction/pointer/interval functions and result plumbing. The existing
effects tests import the moved fixture; every test/assertion remains in place.
No loop guard or behavior is changed. Extraction preservation verification is due
before the first conditional-range/control-flow admission edit.
Extraction preservation passes: ten moved/orchestrator bodies retain every code
token; all existing test/assertion bytes after the fixture remain unchanged.
Fresh build2.27s/typecheck0.75s and905directed cases/76files in116.42s pass. Effects
shrinks to140lines, raw owner491, old tests515 and test-only fixture165; no config
changes or production fixture build input. Only then seed the new loop concern.

The new loop concern reaches real closure before production admission edits. The
two configured-bounds positive groups and restored-seal positive fail at the
conditional-range gate. One initial read-at-pilot-home assertion also fails because
the actual home moves when the source changes; this is a fixture assumption, not
an implementation RED or permission to invent a stable home. Exclude that contrast
and retain the genuine checked actual-home mutation case plus unknown-address read
and write negatives. All future differing-home/read observations remain due.

The first bounded Original implementation is now written but unverified: sealed
constant-initialized straight loops, source-contained effects, both actual two-byte
counter homes, emitted block/control continuity and complete counter init/update
writes. Raw intervals are still checked in both actual artifact unions, with order
grouped by actual source block. Only discharged range premises/maxima pass to the
atomic typed guard; raw-free loops no longer bypass premise checking. Calls,
nested/parent-dependent/zero-trip or changed representations, opaque/status/async
effects and unavailable original homes retain tuple rejection. No producer, source,
oracle, attempt limit or output instruction is changed. Verification/reviews are due.
The first implementation passes build2.31s/typecheck0.78s and31combined cases.
Split the positive groups into eight granular bounds-policy cases, then add genuine
observerEvidence-false re-lowering to check unsupported missing block associations,
plus zero/nested generic-fallback contrasts. These are new implementation checks,
not retroactively claimed pre-implementation RED. Current17loop/23existing cases
all pass (40total,11.90s), build2.42s/typecheck0.78s and targeted format pass.
Effects464/raw519/main569/loop-test159lines remain within readable capacity.

Fresh seven original none artifact identities/empty diagnostics,45import-boundary
cases,11immutable oracle hashes and frozen-authority/portfolio/whitespace guards
pass. The full inherited install/build/typecheck,922-case directed slice and package
test run are now sequentially in progress; their results are pending. No native
source-value/bus/four-profile/timing/whole-artifact-cost proof follows from host tests.

Base first review reports no findings for scope/integration/standards, conditional
on its packet baseline; moved-body identity and old assertion preservation are root
attestations, not an independently read historical diff. Its mandatory routing read
also returns historical qualification summaries; those are excluded from decisive
evidence and supply no blind/oracle clearance. The first SFA review also reports no
findings within its bounded source/home/alias endpoint; a storage-definition search
returns unrelated test previews, which are not opened or used. Actual loop read,
differing-home and interval-interior contrasts remain explicitly unqualified.
Platform review initially stops before reading because the packet excludes required
guidance; no finding or clearance follows. An exact read-only routing/router/selected
normative allowlist supplement supplies the missing instructions without changing
any native permission or accessing a denied artifact; its first review remains due.
The six current extraction/induction paths (effects, raw layout, atomic main, old
effects tests, new loop tests and test-only fixture), sorted
`(repoPath,SHA-256(fileBytes))` then compact JSON hashed, have current identity
`0a4491b068393e3c457a3ea97caf258dca1b31609f5aec468761b443e71b8832`.
All old test/assertion bytes after the moved fixture remain identical; source
ceilings/references and documentation link/whitespace checks pass. This identity
records the reviewed host artifact, not a compiler release or native qualification.
After the guidance supplement, the same first platform review completes with no
findings for Original-loop source/control and CPU-admission composition. It directly
loads only the authorized active router/selected normative headings; release metadata
remains parent-extracted. It explicitly treats normal initializer/comparison/update
value correctness as the unchanged-lowerer premise, not an independent machine-value
proof. All three bounded first reviews now have no findings, without granting full
task/phase, native, four-profile, timing or parity clearance. Differing-home/read/
interior contrasts and complete source-value qualification remain due. The current
sequential922-case/full-package verification run is still in flight; retain only
this continuation's owned logs/snapshot/probe files until those results are recorded.
The current sequential checkpoint now completes. Install0.36s/build0.39s/typecheck
0.37s pass; all922directed cases/77files pass in132.38s. Full yarn test223.52s reports
compiler2553passes/13frontier failures/two existing skips across171files. Every one
of the13failures remains in the original input-size-frontier specification; public
size candidate selection is still incomplete. CLI62, language server21and VSCode6
cases pass. Root tests are not reached after compiler failure. No new complete
package regression is demonstrated; this is not a full GREEN checkpoint.

The six-source identity above remains exact after review and verification. Fresh
none/oracle/boundary guards, old assertion-byte preservation, source documentation/
line ceilings, links and whitespace are unchanged. The active expert remains2.0.4,
qualified/frozen at content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15. These host/static
results do not qualify native values/control/bus traces, all four profiles, costs,
deadlines, complete SFA/ABI closure or whole-phase performance. Final six-lens review
and FO-SF-002's final-phase disposition remain mandatory.

**Next owned proof:** loop-specific raw reads, before-only/after-only and interval
interior observation contrasts must use actual regenerated homes; the failed
pilot-home assumption is not recycled. Calls, MMIO, status/native changed-state,
generated IRQ/NMI and unavailable-before envelopes remain unqualified. No source
restriction or numerical waiver is created by keeping these tuples unsupported.
Task15stayspartial;40-task progress26/40 and keyboard38/48 remain unchanged.

After recording these results, delete only owned `original-loop-extract-6fqganij`
scratch under this runtime: baseline copies, logs, private fixture/inspection modules,
none generation and JSON attestations. No user file, worktree, another session's
evidence or denied artifact belongs to this cleanup. No commit, push, merge, public
size qualification or whole-phase clearance occurred.

### Original-loop alias contrasts — 2026-10-19 continuation

Resume task15 only. Six-source identity exactly matches
`0a4491b068393e3c457a3ea97caf258dca1b31609f5aec468761b443e71b8832`;
fresh build0.45s/typecheck0.36s and40focused cases11.30s pass before edits. Required
documents/preflight/AR-P1–AR-P38 remain present/resolved. No specification edit or
new support surface is needed for the already approved loop-test concern.

Host probes confirm why the earlier fixed-read pilot failed: retargeting its raw
read changes lowering and relocates its counter. A bounded `base+i` read retains
the representation and actual homes. Eight new implementation cases are now written,
verification pending: four counter-read/byte/bounds-policy contrasts; original-only
and selected-only interval-union discrimination; byte/word interior observations.
Each source is rebuilt and actual memberships are asserted before checking rejection.

The differing-home source uses eight ordinary repeated complements, not fabricated
placements or receipts. Original-only RAM alias exercises whole-gate rejection;
the selected-only extra byte lies in zero page, so its opposite-layout acceptance
is asserted only at the existing raw-layout checker endpoint. The atomic gate
must still reject that unsupported domain earlier. No public zero-page admission,
native value proof, pending-machine-window clearance or new whole-task claim follows.
No production code, fixture body, oracle, source API or numerical boundary changed.
All eight alias additions pass against unchanged production (25loop cases/9.60s).
They are qualification contrasts, not claimed implementation RED. The loop concern
is288lines after formatting. Seed five direct-call composition cases in that same
approved concern before extending admission: a caller of the proved raw loop with
bounds on/off, nested direct raw-result delivery, loop-body call rejection and an
unknown callee raw target. This retains the original independent specification RED
gate; no specification oracle or new test support is authored. Directed RED is due.
The unchanged checker gives three meaningful positive REDs at its blanket raw-call
guard. The unknown-target negative already rejects; only its expected precise
downstream reason fails, not the safety outcome. The loop-body-call negative passes.

Implement the smallest direct-call composition in the existing effects owner:
remove only ordinary `call` from the residual opaque-operation exclusion, retaining
indirect/platform/status/async restrictions. Every reachable source body still
contributes all raw envelopes and both actual interval/template checks; genuine
final SFA closure supplies argument/result interference. The atomic typed consumer
continues to check source call reachability and actual internal machine entries.
Original induction still excludes calls throughout all five loop source blocks.
No call summary, alias solver, new scratch, storage producer or acceptance gate is
added. Implementation is partial/unverified until directed and independent checks.
Fresh build2.25s/typecheck0.77s, targeted formatting and all74observer cases across
three files pass in74.47s (30loop/23effects/21atomic). Effects467/loop-tests347lines.
The first bounded base review reports no findings for this continuation's exact
consumer/test delta. Its historical hash/assertion preservation evidence remains
parent-supplied; SFA/platform first reviews are still pending. No full-task clearance.

Prepare eleven private source-value probes using the existing real closure fixture,
serializer, ACME and pinned VICE monitor/runtime helpers unchanged: eight Original
typed/read/write/page-crossing-word cases across both bounds policies, two callers
of the raw loop and one nested returned-byte chain. Independent expected arrays are
source arithmetic/seeded RAM values. Endpoint is actual startup restore entry, not
full return/preservation, dummy-bus trace, four-profile or complete cost qualification.
Only owned runtime scratch is added; no production/test helper or runtime changes.
All eleven real assemblies and sequential PAL/6581 VICE cases pass in15.26s through
restore entry. Strengthen only the private probe, then rerun all eleven in17.29s:
independent source values, source-effective RAM access order/count, balanced
main-to-restore SP, represented caller P (excluding synthetic B/bit5) and the actual
normal SYS continuation at$E147 all pass. Final returned SP equals incoming SP+2,
including the consumed SYS return link. Eight ordinary effective events are observed
for byte reads/writes and call→scan, sixteen for overlapping word reads, two for the
nested sample→relay→main read/write, and none are expected for typed-only fixtures.
This is22actual ACME assemblies/22sequential VICE runs across11case configurations.

| Case / bounds check | PRG bytes | SFA RAM/ZP | Generated program stack | PRG SHA-256 |
| --- | ---: | ---: | ---: | --- |
| typed / on |178|4/2|1| `904be7a0ee868de50806a449a9bc63d1bdd3ef96ad99ce4b0d1bca1e71e642fb` |
| byte read / on |781|7/4|1| `f909c7d8f91590f6d0270fa8f0311cba8dac7da18482b2d26dcb52e666f3acf4` |
| byte write / on |724|6/2|1| `1e3bf345a28e1d59f49090ce70f497a59c1ea5502412519f4b15dcd86e209aed` |
| page-crossing word / on |828|11/4|1| `005d758e91f4c4f20abfba36ce29ef53775b52b5541509c9c4106e8c00153127` |
| typed / off |162|4/2|1| `6823a609951e55221dfd2af4e9b90cd6a2c5c0fc876fa1944a099bfe990a0969` |
| byte read / off |765|7/4|1| `53bdd0ed04ed9b7361e0ab340514760f18e67c4050bb0d45803b866e3367c803` |
| byte write / off |724|6/2|1| `1e3bf345a28e1d59f49090ce70f497a59c1ea5502412519f4b15dcd86e209aed` |
| page-crossing word / off |812|11/4|1| `8f05914cdb0298e7f2cfdaec2af18474bc656dfb497183e3680e5ed961274dd3` |
| call→scan / on |785|7/4|2| `e2908deb6b101cdbd984264d2a61399127ffd5eaa00e25dc4a2abd68f6987d92` |
| call→scan / off |769|7/4|2| `8f2031e4255b8c647791e91020c08f3f6956e03c26cbda78758b3b9e1b80505d` |
| nested returned byte / off |646|3/0|4| `4117c1a4d5c9cc38fe3a6a2a5fa7efcdb33a125bea785914cec8d83c830307d7` |

All serializer-owned labels match actual ACME symbols. Values are0..7 for typed/
write cases,17/34/51/68/85/102/119/136for seeded byte reads, eight little-endian
overlapping words fromA0..A8for word cases, and17for the nested returned byte.
PRG sizes include the load header; SFA terms above are function storage only,
not complete resident/platform/padding/cycle budgets. No expert-parity assertion
follows from these measurements. The admission delta emits no runtime instructions.
Pinned VICE executable identity is
`f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`;
the unchanged runtime helper pins the KERNAL901227-03/BASIC901226-01/chargen ROMs.
Status is **VICE-verified / hardware-unverified** for this bounded PAL endpoint.
No dummy-bus trace, device-preservation, interrupt interleaving, other-profile,
deadline or whole963/725-cost proof is claimed.

All three first bounded15i reviews now report no findings. Base owns test/scope/
standards; SFA owns direct-call argument/result/interference composition; platform
owns physical/control composition. All reported runtime results above are root-run,
not independently rerun or retrospectively claimed as reviewer evidence. Remaining
machine windows, call-within-induction, MMIO/status and asynchronous proofs are open.

Fresh seven original none identities/empty diagnostics and45import-boundary cases
pass; all11oracle hashes, frozen authority/portfolio and whitespace guards remain
unchanged. The four untouched continuation paths are byte-identical to the prior
checkpoint. Current six-source identity, using the same sortedpath/fileSHAcompactJSON
method, is `f3128aac487eb7606474f5506127ad4fe77c15974094c99f34a6dfb545c0635c`.
The935-case directed/full-package checkpoint remains in progress. Task15stayspartial;
progress26/40 and parent38/48 do not change, and no commit/push occurs.
The continuation's complete sequential checkpoint now finishes: frozen install,
build and typecheck each pass in0.35s;935directed cases/77files pass in131.56s.
Full yarn test225.04s reports compiler2566passes/13frontier failures/two existing
skips across171files; every failure remains in input-size-frontier.spec.test.ts.
CLI62, language server21and VSCode6pass. Root suite is not reached. This remains
a RED composite, with no new complete-package regression demonstrated and no
GREEN commit/push checkpoint.

The source identity above stays exact after reviews/runtime/full verification.
Every pre-existing loop assertion/helper byte remains intact, not merely its test
count. Targeted formatting, documentation links/ceilings/reference checks,26/40
accounting and whitespace pass. Eleven specification identities, frozen authority,
seven original none artifact identities and portfolio non-modification remain
binding. Runtime JSON attestation before owned cleanup has SHA-256
`d8b3cb9af6cb86a3d83bc032b67bf1bab0b9316a365573c1d02c6bb1c3304d9b`.
The active expert remains2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15.

**Next owned boundary:** complete source/control and physical proof for required
MMIO/status/native changed-state windows and asynchronous observers, including
the needed wider induction/call shapes. Newly admitted ordinary direct callers
do not imply loop-body-call, indirect-call, generated-route, missing-reference,
device, bank or pending-selected-window clearance. Task15and hardening tasks stay
partial/pending; final six-lens review, FO-SF-002final disposition, debug/startup/
constructor and complete963/725qualification remain mandatory. Public size still
returns COMPILER_INCOMPLETEfor candidate selection.

Delete only this continuation's owned `loop-alias-contrast-s0zhmm1r` scratch after
this durable recording: baseline copies, temporary source probes/modules, all
22run artifacts/logs, none generation and JSON attestations. No user work, worktree,
another runtime's evidence or previously denied artifact is a cleanup target.
Execution plan updated; no commit, push, merge, RD or phase clearance occurred.

### Original source-control exits — 2026-10-19 continuation

Resume task15at exact six-source identity
`f3128aac487eb7606474f5506127ad4fe77c15974094c99f34a6dfb545c0635c`.
Build0.43s/typecheck0.39s and53focused cases15.16s pass before edits. Five real
independently lowered/shared probes retain the expected missing status, device,
changed-counter and early-exit proof rejections; none is canonical object reuse.

The existing source-loop seal already owns every update/break/return edge, while
loopRepresentation checks all actual source-to-machine block successors in both
layouts. The next smallest bounded unit is therefore Original branch/exit control,
within AR-P38's already approved effects and loop-test owners. Do not invent status
or device authority while their distinct proof obligations remain open.

Seed ten implementation cases before admission edits: eight bounds-policy positives
for break/continue/return/conditional raw access, plus unknown and real counter-home
conditional-write negatives. Rebuild actual homes before asserting alias rejection.
Tests are now written; meaningful RED is due. No extra module, producer, metadata,
runtime, oracle, source workaround, numerical limit or frontier change is added.
The ten new cases reach closure then fail at the expected straight-shape guard.
Eight are meaningful positive implementation REDs; the two negatives already reject
and fail only their more specific downstream-reason assertions. No false safety RED
is claimed for those negatives.

Remove only the arbitrary five-block/two-member/straight-body/ordinary-exit shape
conditions in originalInduction. Retain sealed exact source/fact membership, one
loop per owner, constant positive entry, entry preheader, no parameters/parent,
all source effect/containment exclusions, both actual counter homes and complete
initialization/update writes. Existing loopRepresentation must still preserve every
actual source successor in both layouts. This is a local consumption of the already
sealed break/continue/return graph, not another CFG/value/alias analysis. No machine
instruction, producer or pending-window gate changes. Implemented; verification due.
First build/typecheck pass, but all ten new cases then stop at actual control
consistency: the existing lowerer threads through empty if arms while retaining
their source/machine labels. The checker incorrectly demands the immediate empty
label as the only legal target. A real before/after graph confirms the same valid
threading in both representations; no lowerer defect or missing producer field is
demonstrated.

Extend only the existing source-successor comparison with an explicit empty-arm
chain: a skipped source block must have no operations, exactly one actual mapped
instruction-free block, and an unconditional source and actual transfer. Retain
all source-block membership/write checks; check every retained empty block's own
successor independently. Missing/cyclic chains reject, and neither an effectful
source block nor an actual instruction may be bypassed by this rule. Each original
semantic edge must still deliver to its immediate or proved transparent target.
This local normalization consumes the actual source/machine association; it is
not a new CFG pass, machine-state engine or producer change. Verification is due.
The local correction passes build2.18s/typecheck0.79s and63focused cases18.85s;
effects504/loop-tests402lines. First base review finds one MINOR witness issue
(CE-RV-001): the conditional alias test writes home+i only when i==3, outside its
two-byte counter. Its conservative envelope is real, but the claimed actual
overwrite needs i==1. Record acceptance now; correct only that new implementation
fixture after the other first reviews finish. No production finding or oracle edit.

The first private VICE break probe exposes a separate draft expectation error:
an uninitialized array's untouched bytes are indeterminate, not promised zero
(frozen Chapter03VAR-2). It observes1/2/3/0/255/255/255/255and is not a compiler
counterexample. Give this newly authored private probe an explicit `[;0]` source
initializer before repeating it; preserve the independent break/continue/return/
access expectations. No existing specification or implementation assertion changes,
nor any source workaround for accepted semantics. Native qualification remains due.
With explicit initialization, all eight new real ACME/PAL VICE configurations pass
in12.71s: exact arrays, taken/untaken raw access order/count, main stack balance,
represented caller P and normal SYS continuation$E147. Untaken accesses are watched
too: return must not perform the post-loop store, and the conditional body must
sample only the first three source addresses. These are source-derived expectations,
not optimized/unoptimized differential answers. The first failed uninitialized
draft is retained as evidence, not counted as a runtime compiler failure or pass.

The first SFA/source-induction review has no findings within this new bounded delta.
Its duplicate test-witness qualification merges with CE-RV-001; no second finding
or production fix is invented. Platform control review remains pending. Fresh
seven original none identities/empty diagnostics and45boundary cases also pass.
The first platform review finds CE-TP-001, MAJOR: two break arms share a source
exit, while final block layout co-locates their zero-byte fallthrough aliases.
The retained arm can target its sibling alias before the actual exit; source-only
transparent matching treats that legitimate physical control as an internal error.
Accept for correction without waiver. AR-P39 blocks affected task15/17/1.3.3 until
the exact existing-owner mechanism is independently hardened and resolved.

Add the reported shared-break case with bounds on/off before the fix. Correct
CE-RV-001 only in its new implementation source: conditional i==1 writes value1
to the high counter byte, with explicit rebuilt actual-home membership. No old
assertion, specification, producer or runtime surface changes. New RED is due.
Root confirms both shared-break cases are meaningful host RED:2errors/40other loop
passes. The corrected conditional high-byte write passes. The first challenge stops
on shorthand file names and missing exact normative paths, without a mechanism
verdict. Supply exact existing paths and normative ranges to that same challenge;
no native permission is changed and no denied artifact is accessed. Fix remains gated.

Four additional private diagnostic assemblies/VICE runs (shared break/continue,
bounds on/off) confirm correct existing target behavior in7.92s while the observer
returns the expected internal error. The private diagnostic explicitly asserts
that error before inspecting these real closed objects; it does not publish or
pretend that a rejected tuple is accepted. Values, effective access order/count,
SP/P and normal SYS return pass. This proves a real checker false error, not a
source/lowering control defect, and is not final admission or cost qualification.
The same independent challenge now completes and recommends bounded actual empty
same-origin fallthrough canonicalization, not general jump or PC equivalence.
AR-P39 records the eligible internal ruling, rejected alternatives, confidence and
reopen triggers before the fix. It stays within existing effects/loop-test owners;
no additional support surface or producer authority is needed. Resume the correction
and existing-tier tests; CE-TP-001 remains accepted until direct/native checks and
the single bounded platform fix review clear it.
Implement the selected correction in loopRepresentation: one per-function local
canonical target query validates labels/origins, detects cycles and traverses only
empty same-PC fallthroughs. Memoize only successful chains. Resolve both expected
source-allowed labels and actual outside targets; retain a distinct delivery set
for each semantic successor. No executable JMP, instruction, cross-function edge,
source effect or counter write becomes transparent. Missing/inconsistent promised
physical alias evidence is an error, not acceptance.

Extend the existing loop concern with second-arm and longer shared breaks plus
shared continues, and require the actual produced same-PC alias chain. Add six
copied-invalid residual-boundary negatives: cycle, missing label/origin, unequal
origin, arbitrary JMP and an instruction-bearing inserted target. These copies
exercise rejection only; the atomic entry must independently reject their invalid
producer association. No receipt is minted or replaced with fabricated success.
Existing source/control/alias and pre-existing assertion content remains. Implemented;
direct verification, native rerun and the one fix review are due.
The fix passes build2.12s/typecheck0.72s and77focused cases20.38s (54loop/23effects),
with targeted formatting. Effects556/loop-tests546lines remain below their ceiling;
the existing approved concern owns all added tests and malformed-copy negatives.
The sixteen final real ACME/sequential PAL/6581 VICE cases pass in24.03s. Every
serializer label matches ACME. Source-derived values, taken/untaken effective RAM
access count/order, main SP, represented caller P and actual SYS continuation pass.
The second break arm and longer alias chain are exercised, not only the original
first-arm witness. No dummy-bus, device, hardware, other-profile, timing or complete
cost conclusion follows.

| Case / bounds | PRG bytes | SFA RAM/ZP | PRG SHA-256 |
| --- | ---: | ---: | --- |
| break / on |791|7/2| `fb3a6ace11fd587c8e713c4b6567786c54d32167ddcee5cd87bc83df27493135` |
| shared break / on |809|8/2| `b7f4ea99d06ab847cfacc8c2063367a6ce731b4fa60792db561cc4bd8df9ac85` |
| second shared break / on |809|8/2| `ab7789f246ffa8d803a686f6719d62c5cb86cba8096d2262acfbe6d72cc4341c` |
| long shared break / on |830|9/2| `f026a31e00233123ef731ad5e30a6398e63089b0795b596d7019be00e716b02d` |
| continue / on |791|7/2| `c8dd6db2767db4310d1278ac8d563dd62299867ede7bda3a75b3506f9584e0c0` |
| shared continue / on |809|8/2| `a8d5be7e881a730bde1ee7b91e796c59cd5cca183de2f434085a81d91b515217` |
| return / on |794|7/2| `c4f0b81595e2eb210437aefd6cafc300d7c38b8b2718474444eaca8b129cc4ae` |
| conditional / on |878|9/4| `d08ce06b9b9b7bf24ca7d80f4f988c775956e59c971792326d2c4a6cba78a715` |
| break / off |775|7/2| `e3c80161158d78eab9a635ce9b32d9da665442019a10f5940368baa56d95d33d` |
| shared break / off |793|8/2| `cd411638a59b3a5e329e31585f01ff861003374fc36f1f0e52502b9cf0a25396` |
| second shared break / off |793|8/2| `5313ae60253817cbb33de8a292a6057821ab4e23ce233a6b50be5d1d6081116b` |
| long shared break / off |811|9/2| `423256369ffc57ad98264520e0a5676f119906ee3d244c375e0e7ff7f425df62` |
| continue / off |775|7/2| `23bf2048afb1aa9fc130d5740bdbca1f4fa733ec429555d7f3aa8d49a0c89511` |
| shared continue / off |793|8/2| `e3772ee15f254ca97bd8f39690e72eb2e5d33358e8533e44d7e59587052c6245` |
| return / off |778|7/2| `856a65eed778fe5068cf6d615c0e5f488a9c662571a296c69800f623ad3eab5b` |
| conditional / off |847|9/4| `e16bc55214bc7c35d142004ef414fdae86c3c9fb5ebdaa0f190f8374a89cf3a9` |

Generated program-stack component is2in every case; it is not an unrestricted
external/firmware peak. PRG sizes include the load header; SFA terms exclude global,
startup/platform and padding residency. Twelve configurations retain byte-identical
pre-fix assembly/PRG artifacts and source identities (24artifact and12source field
comparisons), including all four formerly error-rejected shared-exit diagnostics.
This proves zero emitted byte/storage delta for the correction, not expert parity.
Runtime evidence JSON SHA-256 before cleanup:
`b6cbd04519c724e38f6957d546880a3c677cf86e45dd8942cf00204de3f84bfe`.
Status: **VICE-verified / hardware-unverified**, selected PAL/6581 endpoint only.

The single bounded platform fix review clears CE-TP-001 with no findings for alias
recognition, instruction/JMP barriers, cycle/origin checks and separate semantic
edge coverage. It inspects code/tests; runtime and identity checks remain parent-run
evidence, not independently inspected artifacts. The earlier SFA first review has
no production finding; the base MINOR witness is corrected and directly passing.
No third bounded fix review or full task/phase clearance is claimed.

Fresh seven original none identities/empty diagnostics and45boundary cases pass.
All30pre-existing loop-case/helper/assertion bytes are preserved after removing only
the new helper/imports for the comparison; every original oracle hash/frozen authority/
portfolio guard remains exact. Current six-source identity is
`7b91a8f812d5f7abc0ab54c6e3f3621d14924c58f1f9eb0c63ce7df096453dad`.
Final959-case/full-package checkpoint is sequentially in progress. No task promotion,
public size success, GREEN composite, commit or push follows from this bounded unit.
An extra official-TypeScript strict check explicitly includes the loop test and
test-only fixture, which ordinary package build/typecheck do not include. The first
invocation needs TS7's explicit --ignoreConfig when passing root files; no permission
denial is involved. The corrected --ignoreConfig/--noEmit/NodeNext/ES2023/--strict/
--skipLibCheck/--types node invocation reports two TS2322errors in pre-existing test
allocation-profile constructions, not in new alias code: the fixture and older
observerEvidence-false case have generic optional StorageProfile.profileId where
TargetProfile requires the exact selected identity. Old bytes remain unchanged.

Do not hide these diagnostics behind the ordinary passing typecheck, use a cast,
or silently overwrite an actual ID. AR-P40 requests only those two existing test
construction corrections, with an actual-ID equality guard and typed view. The
shared fixture's move-only authority does not authorize this body amendment.
Affected tasks15/17/1.3.3 are visibly blocked pending direct exact approval. Preserve
all current verified proof work; no profile, fixture, source or assertion edit is
applied. The in-flight final project regression run still completes independently.
The final ordinary project checkpoint completes: install0.37s/build0.35s/typecheck
0.35s pass;959directed cases/77files pass in130.30s. Full yarn test232.72s reports
compiler2590passes/13unchanged frontier failures/two existing skips across171files.
All13failures remain in input-size-frontier.spec.test.ts; public candidate selection
is still incomplete. CLI62/language server21/VSCode6pass; root is not reached.
No new ordinary project regression is demonstrated, and there is no GREEN composite.

Confirm the extra test diagnostic under the project's actual semantic type options
from tsconfig.base.json, not looser custom assumptions: strict, NodeNext/ES2023,
exact optional properties, verbatim modules, unused/override/fallthrough checks and
the existing library/type settings. It reports only the same two TS2322errors in
1.17s. Compiler tsconfig explicitly excludes src/**/*.test.ts and includes only src,
so the normal project typecheck does not clear these two test constructions.
This extra check remains failing; AR-P40 is not resolved or silently bypassed.

The six-source identity remains
`7b91a8f812d5f7abc0ab54c6e3f3621d14924c58f1f9eb0c63ce7df096453dad`.
All original oracle/none/boundary/frozen-authority guards and30prior loop assertion/
helper bytes remain unchanged. Source formatting/ceilings/documentation/link checks
pass. CE-RV-001and CE-TP-001are fixed within their bounded endpoint; FO-SF-002final
phase closure and all six final review lenses remain due. Active expert2.0.4/content
0e2a6280ddf77e42252b7a50b85cf9ea3d732b15is unchanged.

Remove only owned `remaining-observer-seam-8vk17xj8` scratch after recording these
results: probe modules/logs, real/draft/diagnostic/runtime assemblies and PRGs, copied
fix baseline and runtime JSON, none generation and directed typecheck logs. The
initial failed draft and extra typing failures remain durably classified above;
raw temporary files are not a retained release artifact. No user file, worktree,
other session's evidence or denied artifact is a cleanup target. Plan/keyboard
handoffs remain26/40and38/48, with six implementation/eight qualification tasks
remaining. Exact AR-P40 approval is the next user-owned gate. No commit/push/merge,
public-size success or whole-phase clearance occurred.
The user directly selects **“Approve fix (Recommended)”** for AR-P40's exact two
local test profile constructions before either edit. Record approval and unblock
only affected execution before implementing the real-ID guard/typed view. No
assertion, fixture program, production type, validator or configuration edit follows.
Implement only the two approved local profile constructions: obtain actual lowered
storage, reject an unequal/missing profileId, then copy its unchanged fields with
the verified selected ID in the typed view. All source cases/assertions, fixture
arguments/export and real producer/closure calls remain intact. No cast, ID masking,
helper or production change. The extra strict check's two known RED diagnostics
precede this correction. Implemented; strict/direct and compatibility verification due.
The approved correction passes build2.08s/typecheck0.81s, explicit strict test-root
compilation with all project semantic options in1.20s, targeted formatting and all
77focused cases in21.18s. The first bounded test-only correctness review reports
no findings for scope, real-ID validation, typed-view safety and negative protection.
It does not re-review alias/control/SFA production or supply whole-phase clearance.

Mechanical comparison proves exactly the two authorized local replacements and
teaching comments; every other byte in those files, including all program fixtures,
assertions, imports and export signatures, remains unchanged. All four production/
other concern paths in the six-source identity are byte-identical to the preceding
checkpoint. Current six-source identity:
`935f8c53646c2e9d06bd877a01c1c6d8ef7bef83b66f2c11d3981aadbe39563b`.

The before/after fixture matrix performs32real ACME assemblies in9.64s across the
same16branch/exit configurations. All48paired assembly/labels/PRG identity fields
match; every PRG still matches its previously recorded VICE-verified hash. Every
observer result remains complete. No VICE rerun or additional runtime proof is
claimed for this host test-only qualification. No source, assertion, production,
oracle, resource limit or37-attempt change occurs. Fresh959/full project verification
is in progress; the prior13frontier failures remain unqualified, not accepted passes.

While that fixed snapshot verifies, gather the next Original-loop entry facts
without implementation: scalar, fixed aggregate, forwarded aggregate and two-origin
aggregate source probes all independently close then reach the existing parameter
shape exclusion. The first two aggregate classes retain actual unique/stable origin
facts, while the multi-origin class does not. An independent mechanism check is
assigned only this remaining source/SFA premise question inside existing owners;
no new parameter admission or source-facing restriction is yet written.
AR-P40's fresh ordinary checkpoint now completes: install0.37s/build0.36s/typecheck
0.34s;959directed cases/77files in128.27s pass. Full yarn test224.63s reports the same
compiler2590passes/13known frontier failures/two existing skips; CLI62/language
server21/VSCode6pass and root is not reached. Extra strict test types remain green.
No assertion/program/production change or GREEN composite follows from this fix.

The next independent mechanism check selects a narrower by-value step: ordinary
scalar/enum parameters use existing ABI entry/staging and actual interference,
while the counter remains private and every current source/control/home premise
stays. Aggregate unique/stable facts do not prove non-overlap; their caller-side
place-address construction has a separate atomic observer gate. AR-P41 records
this eligible internal ruling before implementation, without extra owner or producer.
No aggregate admission, solver, qualifier field or stronger ABI is invented.
Seed the scalar-entry cases in the already approved loop concern before changing
the guard: byte, word, multiple, enum, forwarded and sequential by-value calls,
each with bounds on/off. Assert the real incoming homes/widths and disjointness from
the live counter in both final layouts. Retain parameter-as-counter, nonconstant
start, unknown raw address and three aggregate-entry rejections; the aggregate cases
assert their actual unique/stable facts rather than fabricating positive authority.
No existing assertion/program fixture is changed. New meaningful RED is due.
All twelve scalar/enum positives reach the expected shape-guard RED after their
actual live parameter/counter homes and widths are checked in both layouts;60other
loop cases pass. Replace only the zero-parameter condition with scalar/enum type
admission and explain the by-value entry distinction. Every private-counter,
source/frame/effect/control/profile/async gate remains unchanged. No new borrow,
caller-root, stable-contents or word-address assumption is made. Implemented;
strict/direct/native verification and bounded independent reviews are due.
The scalar/enum change passes build2.09s/typecheck0.73s, explicit strict test types
1.11s and95focused cases23.17s (72loop/23effects). Effects558/loop-tests685lines;
no compression or old-case removal creates that capacity. Both first bounded
reviews report no findings: base owns the exact type/fallback/standards boundary,
SFA owns by-value delivery, live occupancy, interference and actual-counter safety.
The requested independent release/spec confirmation is outside those packets;
lineage remains the parent-supplied frozen identity, not an independently reopened
release record. Root directly confirms frozen Chapter06FN-2/FN-3: scalar/enum values
are copied and stored before JSR; aggregates are by reference. Ordinary function
values are also by value but retain their separate callable-entry proof boundary.

All twelve new real ACME/sequential PAL/6581 VICE configurations pass in19.17s.
At every actual loop-function entry, every parameter byte matches independent
source values, including both word bytes, all three mixed arguments and both
sequential calls. Expected output is7..14 for byte/enum/forwarded,9..16 after the
second sequential call, and$12F9..$1300for word/mixed arguments. Check the one
post-call sentinel store, balanced main SP, represented caller P and actual normal
SYS continuation$E147. All serialized labels match ACME. This is not ACME-only
differential evidence; values and entry-delivery bytes are source/ABI expectations.

| Case / bounds | PRG bytes | SFA RAM/ZP | Generated program stack | PRG SHA-256 |
| --- | ---: | ---: | ---: | --- |
| byte / on |775|6/2|2| `4c6e18971be0da4db7999eef2b3f85d35f0c3089d6bccdc060bd2564da076c29` |
| word / on |847|10/2|2| `37993f9d3b13d6164279cf8e29f65de6e7c0b487015fd28d3428b25f9b81eeff` |
| mixed / on |893|16/2|2| `2a4e8d9e4060c1c8fea7e2592fc56395f0ff4169ff35d2ebcdd92cdedf1c938d` |
| enum / on |775|6/2|2| `967984fcb53d4b28abe6b61015689104f252c837ba78a4b3da0adc6cc6427d55` |
| forwarded / on |785|7/2|4| `39c2a2907506a9f0e569633c587f3a35fd6a596c2e66e8f0d0bdd3a7dc2f352b` |
| sequential / on |783|6/2|2| `41c922b40732dcfc632bcce3b3fdf85c1872180c8e81fc5be37eee3aaa69b7bc` |
| byte / off |759|6/2|2| `ee080a63609e1810ecb20b63578d09864786e3a62f71d94a44d6496190194cd1` |
| word / off |831|10/2|2| `645dd72c7aeacb652cb54f50902f6485b58d11a35eb21941a7ea8267a875118d` |
| mixed / off |877|16/2|2| `43e35379f4b2b9017d321c4cdaf68ea640bf252030adb76cbb46ebffeb1c191b` |
| enum / off |759|6/2|2| `69395fd7833a7cd69b5b9ada46779a653a69a4986e213c88ac499dbe279fc7e7` |
| forwarded / off |769|7/2|4| `cd7a7356a31a37783691b5df70cadf5ff977f237d67dec67845bd524306978e6` |
| sequential / off |767|6/2|2| `b2f9183b6725d38a2aea7f51578018156c7328fd7a3a5615683c52263cad367b` |

PRG includes its load header; SFA counts exclude global/platform residency and
padding. Generated stack terms do not bound unrestricted external/firmware entry.
The validator change emits no new instruction or storage mechanism; these are not
expert whole-program or963/725-cost results. Status: **VICE-verified / hardware-unverified**
for the selected PAL endpoint; no four-profile, device/dummy-bus or deadline claim.
Native evidence JSON SHA-256:
`6199470c470e81bd70bc56b1d489222c85bcfd9b34eeb5a25ad7a6999d868431`.

Fresh sequential install0.33s/build0.41s/typecheck0.39s and977directed cases/77files
125.81s pass. Full yarn test209.84s reports compiler2608passes/13known frontier
failures/two existing skips; CLI62/language server21/VSCode6pass. Root is not reached.
No new project regression is demonstrated and no GREEN composite is claimed.
Seven original none identities/empty diagnostics,45boundaries,11oracle hashes and
frozen-authority/portfolio guards pass. All54pre-existing loop cases/helpers/
assertion bytes remain exact apart from AR-P40's explicitly authorized construction.

Current six-source identity:
`bd7092df94be593fd23f81825135b8308becf87e69c1f64d7157b0c84783752f`.
Active expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15unchanged. The
next unclosed source boundary is caller-side aggregate place-address/backing and
borrow forwarding, not scalar constness or stable contents. Native machine windows,
status/MMIO and asynchronous observers, wider induction, startup/debug/constructor,
unavailable-before envelopes and complete963/725qualification remain due. There is
no aggregate, callable, parameter-counter or arbitrary address admission from this step.
The saved-parameter geometry probe observes no reused parameter/counter homes;
do not claim a dead-home-reuse runtime witness or add a blanket reuse prohibition.

After final link/source/format checks, remove only this continuation's owned
`profile-test-types-clf0j1to` scratch: exact pre-edit copies, temporary modules,
32assembly identity matrix,12native cases, argument probes, none generation,
strict/directed/full logs and JSON attestations. No user work, worktree, another
session's files or previously denied artifact is a cleanup target. Progress remains
26/40, keyboard38/48, six implementation/eight qualification tasks pending. No commit,
push, merge, public-size success or whole-task/phase clearance occurred.

### Caller aggregate transport — 2026-10-20 continuation

Resume the exact bd7092df94be593fd23f81825135b8308becf87e69c1f64d7157b0c84783752f
six-source checkpoint on feature/v4-rebuild. Required plan documents and passed
preflight remain present; no original oracle/frozen/portfolio change is observed.
Fresh build0.42s/typecheck0.32s/strict test types0.93s and95focused cases22.68s pass.
Active expert five-field extraction confirms2.0.4frozen/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15.

Eight real source probes independently lower/share: global/local simple aggregate
reads, global/local loops, forwarded local, two local origins, returned-local
aggregate and numeric global address publication. Simple reads/returned transport
stop at the typed source exclusion; loops at aggregate entry. The final numeric
case is a required retained barrier, not a positive to force through. Both global
and private caller cases exist; no reduced benchmark replaces the approved source.

AR-P42 records the mechanism/ownership question before additional helpers/files or
admission edits. Current loop tests are685lines and cannot absorb another concern.
Existing residual/atomic concerns retain some room; inspect a direct composition
against a cohesive borrow query/test owner without biasing the independent challenge.
No new file, source proof or producer change has been made. Tasks15/17/1.3.3 are
visibly blocked until the ruling; reserved extra paths still need exact user approval.
The first independent challenge recommends the two-file borrow concern as justified
ownership, not permission. It requires the actual copied caller-local snapshot path,
all constructor users/terminators, active recipes, resolved object bytes (not pointer
homes), forwarding lifetime/interference and both actual interval separations.
Numeric publication and unknown/captured/returned representations remain separate
proof obligations; no source address operation is accepted solely from its type.

Supply the requested exact existing copy/capture/return/storage excerpts to that
same first challenge. Two additional real probes distinguish the cases: a named
Packet snapshot copied from another local, followed by original mutation, scalar
live across relay→scan, uses only uncaptured aggregate place-address operations;
the copy itself is a semantic store. A nested aggregate member evaluated before a
mutating later argument has captureValue=true and a separate eight-byte temporary.
Its request.value is a producer role key, not the raw SSA result. Do not parse the
generated request name or guess a backing from span/cardinality. Both still reject
the current gate. This closes actual evidence inputs before any permission packet;
no additional producer or capture admission is authorized by the owner recommendation.
The same first challenge closes the consumer-only packet: two new borrow concern
paths are justified; existing effects/main only compose proof results. The actual
named-copy source needs no new producer association. Require whole-object copy
width, every use/terminator, active recipes, actual named data backing, occupancy/
interference and full source/destination/counter separation in both layouts. Never
substitute the address observation's zero width or the parameter pointer's two bytes.

Captured anonymous members, anonymous call-result temporaries and unproved
return-address/hidden-destination transport remain C stops; the existing literal/
direct result class must not be blanket-rejected. The challenge reads adjacent
normative headings in two reference reads; those headings are not decisive evidence.
The required copied-snapshot positive and explicit scope/reopen boundaries are
recorded in AR-P42 before presenting exact path approval. No file/helper/admission,
producer or oracle edit exists. Prior current six-source identity remains exact.
The AR-P42 packet is now ready for direct exact approval. Fresh source/oracle/link/
whitespace checks pass; neither proposed file exists. Latest actual execution is
the fresh95focused/build/typecheck/strict run above, not another full compiler or
native run. Last complete compiler remains2608pass/13frontierfail/two existing skips;
all14remaining tasks retain their owner and full qualification gates.

After durable recording, remove only owned `aggregate-borrow-proof-vljnv9ij`
scratch: baseline copies, temporary fixture/probe modules and host verification logs.
No new production code, admission, producer field, public source change or oracle
edit occurred. No user file/worktree/other session/denied artifact is a cleanup
target. Task15/17/1.3.3 stay blocked pending exact AR-P42 approval; progress26/40,
keyboard38/48 and v4four/ten remain unchanged. No commit, push or phase clearance.
The user directly selects **“Approve scope (Recommended)”** for AR-P42's exact
two new concern paths and existing effects/main composition on2026-10-20. Record
approval and unblock only affected work before tests/helper/consumer creation.
No other producer, metadata, type owner, source, schema or oracle authority follows.
Create the approved borrow implementation concern first. Seed the actual copied
ten-byte snapshot→relay→Original loop with both bounds policies, real original/
saved/counter homes and conflicts, global/local non-loop controls, preserved
literal/direct aggregate-result behavior, and numeric/capture/return/multiple-root/
escaping-index negatives. Every fixture and assertion is new implementation-tier
coverage; the eight specification groups remain immutable. Consumer implementation
has not started; meaningful RED/source validity verification is due.
Initial concern verifies four meaningful REDs (two real snapshot bounds policies
and global/local simple controls) and six justified passes, including old direct
aggregate results and retained unsafe classes. All source/home/origin assertions
precede the positive acceptance expectation.

Implement the named transport consumer and effects composition only. It resolves
whole aggregate bindings/active formal replacements, checks actual data homes and
platform intervals, same-block full-width copy sinks, every operand/terminator,
recorded fixed call positions, closed forwarding paths, call-point occupancy,
certificate conflicts and actual separation against callee/transitive/helper and
caller-live storage in both layouts. It rejects anonymous/numeric/returned or
unresolved backing. Only source operation/parameter identities are returned; no
instruction is marked footprint-covered and no acceptance receipt is minted.
The existing main already consumes discharged operations, so no blanket opcode or
source operation whitelist change is needed. Borrowed loop entry is enabled only
through that invocation-local result; all other induction/raw/typed/context guards
remain. Implemented; source formatting/types/direct verification are due.
First consumer build2.17s/typecheck0.72s and all10initial concern cases5.30s pass.
The full named snapshot's ten-byte backing/forwarding and old result controls close.
Add existing-tier checks for genuine Direct re-lowering (facts are not activation),
missing/two-byte pointer-sized fake backing, absent caller-counter conflict and
temporarily stale selected roots. Invalid copies exercise rejection only, with the
atomic provenance gate independently rejecting them. No additional producer or
fixture edit follows; full directed interaction with older frontier checks is due.
Expanded formatting/build/typecheck/strict tests pass. Combined run107passes/
3failures27.41s: two old aggregate-frontier outcomes now correctly reach complete;
the third is a new Direct fixture that retained Closed recipes after changing its
mode. Correct only that new fixture by omitting storage/complement recipes before
real Direct re-lowering; the existing bundle validator is not relaxed. All15new
borrow cases then pass in7.09s. No old assertion is changed.

AR-P43 requests exactly two superseded implementation outcomes and their shared
table title/expected-result plumbing in the existing loop file. Every old source,
origin/stability check and all four other rejection outcomes remain. This concern
is not in AR-P42's four-path permission packet, despite earlier ownership; exact
approval is required before editing it. Preserve current implementation and mark
tasks15/17/1.3.3blocked. The borrow consumer is not independently reviewed/native
qualified or whole-task complete yet; no commit/push follows.
First AR-P43 prompt is interrupted without a ruling; user asks again and directly
selects **“Approve amendment (Recommended)”** on2026-10-20. Record the exact ruling
and unblock affected work before editing the two outcome cells and table plumbing.
No source fixture, origin assertion, earlier test or specification oracle changes.
Apply only the approved two complete outcomes and four retained rejected outcomes
as an explicit table column, plus the shared proof-boundary title. All six source
programs and origin/stability checks remain byte-identical. The old-loop file's
other cases are untouched. Implemented; combined and strict verification is due.
Combined verification now passes110cases/3files28.58s, build2.22s/typecheck0.76s and
strict test roots1.06s. The new concern has15cases; the old table changes exactly
the two authorized outcomes, keeping four rejections and all origin checks.
Before review, index actual homes, per-request source positions and per-function
use sites once inside the invocation to avoid repeated full home/position/function
scans. These indexes consume existing facts only; no lifetime/alias solver or
persistent cache is introduced. Reverification is due after that local cost cleanup.
The first bounded SFA review has no findings for actual object backing, copy,
forwarding lifetime/interference and counter/atomic composition. Base review has
no correctness finding and one MINOR descendant-query documentation item; add the
self-inclusion/transitive/invocation-cache explanation. Host-performance review
finds MINOR repeated per-borrow private-root reachability (B²p edge checks;64links
266,240per candidate in its cost model). Skip direct-owner traversal and cache the
validated reached-owner set per root inside this invocation. No origin/lifetime
inference, persistent cache or producer change. NB-RV-001/NB-PE-001record these fixes;
reverification/measurement remains due, and physical-view review is still required.
After the two MINOR corrections, fresh build2.21s/typecheck0.75s/strict test roots
1.20s and110focused cases/3files28.29s pass. The first two source/SFA reviewers
report no correctness findings; the remaining physical-view review is pending.
Actual new owner608lines/test286, effects568 and old loop694 remain below700;
the original size estimate was not a measured ceiling and no source is compressed.

Two real ACME/sequential pinned PAL/6581 VICE executions in2.69s pass the unchanged
required snapshot source with both bounds policies. Actual scan entry observes all
ten saved bytes17/34/51/68/85/102/119/136/34/18and changed original99/.../239/190.
Exactly ten saved-byte stores complete before the three original-byte mutations.
The loop yields the original eight rows and marker$1234at$C210, caller scalar$A55A
survives at$C200, and original99/$BEEFare observed at$C202/$C203. Main SP, represented
caller P and actual SYS continuation$E147pass. These are independent source answers,
not canonical-output agreement. Status: VICE-verified / hardware-unverified, PAL only.

The actual snapshot copy matches the existing counted constructor:
LDY0; LDA original,Y; STA saved,Y; INY; CPY10; BNEloop,13encoded bytes. Full copy
extent is10, not a zero-width address observation or two-byte pointer. Current
snapshot PRGs are950/922bytes(bounds on/off), SFA31RAM/4ZP and generated program
stack4. These are this witness's bounded costs, not complete original input963/725
qualification, expert whole-program parity, timing, device/dummy-bus or external
firmware aggregate stack proof. The validator adds no emitted instructions.

NB-PE-001measurement constructs each8/16/32leaf-first forwarding input once, then
measures only five repeated validations per version after warmup. Median ms before/
after:8links3.02/1.42,16links11.22/2.59,32links57.68/6.59. Both versions return complete
for every sample; no timeout becomes an oracle. Observational RSS111.3/117.4/138.3MB
is process-wide, not isolated allocation attribution. No general scaling guarantee.

The current eight-source identity, sortedpath/fileSHAcompactJSON, is
`89dd7b9b897003fd23df3c46c75e4c957a169ab762817e3866192737c9654833`.
Mechanical checks confirm every AR-P43source table row is identical, exactly two
outcomes change, four rejections remain and all preceding loop bytes are unchanged.
Existing main/raw/residual tests/shared fixture are byte-identical to the pre-unit
snapshot. Full992directed/project checks and the platform review remain pending.
No task/phase promotion, public size, commit or push follows from this local result.
The first bounded platform review now has no findings for real global data/interval
identity, both-layout physical-view composition, copy exclusion and preserved
startup/banking/placement/asynchronous guards. It confirms canonical producer
binding identity is a lookup of real platform data, not a manufactured SFA home.
Runtime/assembly observations remain parent-run evidence, not independent artifact
inspection. All four review endpoints are bounded; full six-lens phase clearance
and hardware/cost qualification remain due. No extra alias-fix re-review is claimed.

Fresh seven none identities/empty diagnostics,45import-boundary cases, touched-code
formatting, all11oracle hashes and source/reference/700-line/frozen/portfolio guards
pass. Current full992directed/project checkpoint is still pending. The two named
snapshot PRG identities are626d8e8b4eeb5dd28f5b2924b57882332a1bf14d60044fe31c1823623e402ca1
andf9b59aba042ad7c24ba29ee22b7e12dead28ece75b1b4cf476bc2fdf52d8550d(bounds on/off).
These identify inspected execution inputs only; they do not qualify the original
complete input output limits. Scope and all original source/oracle/numerical
boundaries remain unchanged.
The full checkpoint now completes: frozen install0.36s/build0.35s/typecheck0.35s
and992directed cases/78files145.50s pass. Full yarn test241.42s reports compiler
2623passes/13known frontier failures/two existing skips across172files. All13failures
remain in input-size-frontier.spec.test.ts; public size candidate selection is
still incomplete. CLI62/language server21/VSCode6pass; root is not reached. There
is no new ordinary project regression demonstrated and no GREEN composite.

The eight-source identity above stays exact after reviews, native/host probes and
final verification. Native JSON SHA-256 is
`6925dc6c97205306fab4c621bccb18ea37a57107286c0541bdc2670fb34ed076`;
bounded scaling JSON is
`ae3b8137f3caa1693f30303bb290f83d41d5e7d8925ee3e3845469279a6fe9f1`.
These are root-run attestations, not external publication or full phase artifacts.
The active expert remains2.0.4frozen/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15;
all11original oracle hashes and canonical none identities remain binding.

**Next actual proof boundary:** anonymous captures and aggregate-result temporaries
lack an authenticated source operation/value/context→object backing association;
representation-named values, span/type/cardinality or pointer homes are not substitutes.
Returned-local/hidden destination sinks need their complete existing result proof.
Keep these gates and all status/MMIO/native-window/asynchronous obligations explicit;
no new producer edit is authorized by AR-P42. Wider induction and actual startup/
debug/public constructor/cost selection remain their existing owners. Task15stays
partial; final six-lens review and FO-SF-002final disposition remain mandatory.

After final source/link/accounting checks, remove only owned
`named-borrow-closure-hzrmglk9`: pre-unit copies, all scoped verification logs,
temporary native/assembly/host-cost modules and generated PRGs, fixtures, JSON
attestations and none generation. No user file, worktree, another runtime's evidence
or denied artifact belongs to cleanup. Execution plan and owning status updated;
progress26/40, keyboard38/48, v4four/ten unchanged. No commit, push, merge, public
size qualification, whole-task or phase clearance occurred.

### Aggregate representation/backing boundary — 2026-10-20 continuation

Resume by checking the exact eight-source identity above, which remains unchanged.
Fresh build0.49s/typecheck0.35s and110focused borrow/loop/effects cases in28.19s pass.
All11original oracle hashes, frozen spec/expert authority, portfolio and whitespace
guards remain intact. The selected plan helper reports26/40tasks65%; no task advances.

Three fresh unchanged-fixture probes distinguish actual representations. Captured
member evaluation has an eight-byte temporary in both layouts and rejects for the
missing checked source association. Returned-local delivery has no anonymous object
temporary; canonical storage and selected fixed-object results differ, and the named
consumer rejects its backing. A direct ten-byte anonymous call result already
completes through existing lowering and must not acquire a new rejection or redundant
proof mechanism. Representation-valued requests are not semantic IDs in either side.

AR-P44 records the exact scope/complexity stop before any producer/type/consumer or
old test edit. Its single blind independent challenge must identify the smallest
complete next seam and exact approval packet. Tasks15/17/1.3.3show the blocker; all
previous named-copy assertions and completed subunit evidence stay preserved. Only
this plan's documentation and owning status change during investigation. No new
producer, fixture, solver, specification or oracle authority follows from continuation.
The single independent challenger returns **Simplify**: reuse only existing return/
result/root/call evidence for direct returned-local delivery to a named caller-local
destination. No producer/type/metadata or new file is necessary for that bounded
next slice. The existing anonymous call-result acceptance stays intact; capture
rejection remains. AR-P44 now owns an exact two-existing-path packet and explicitly
names the single old returned-local expected outcome/title/table-plumbing amendment.
Approval is pending before either source or test edit. Source/storage/ABI/native/
cost checks and independent review remain due after any approved implementation.
User directly selects **“Approve scope (Recommended)”** on2026-10-20, approving
exactly AR-P44's existing consumer/test scope and one old returned-local outcome
with table plumbing before any edit. Record the ruling and unblock affected tasks
before implementation. No producer/type/fixture/effects/main or other test change.
Before production edits, the approved returned-local outcome and two ten-byte
returned Packet positives fail meaningfully at the named-backing exclusion;
15existing/new control cases pass. No fixture or prior source string changes.
Implement the bounded existing-evidence lookup and feed exact result calls through
the existing backing/call-occupancy/conflict checks. Preserve terminal block identity
so only an exact proved returned-local return can discharge, never a branch use.
Implementation is provisional; readable formatting/700-line capacity, strict typing,
all-use/call coverage and both-layout/native/independent verification remain due.
Normal formatting yields719production/340test lines. Stop before any further
implementation and record AR-P45. The same independent challenge must distinguish
removable duplicated proof from a necessary new owner; no compressed formatting,
weakened premise or silently added file follows. Provisional code remains unverified.
Read-only execution of the provisional concern passes18cases7.99s, but explicit
strict test-root compilation fails at the new test's callback capture of an unnarrowed
ResultLocation.requestId. No production or old test failure is established by that
type error; its small test-local correction waits for the capacity ruling. No GREEN
claim follows from Vitest transpilation. Existing compiled pre-change modules also
construct/assemble both returned Packet bounds variants:1013/985PRG bytes, each with
actual ten-byte caller data, while their old observer rejects. Preserve these as
before-artifact identities for a later exact no-codegen-change comparison, not the
original input963/725qualification. Source/program fixtures stay unchanged.
The same independent challenger returns **Justified** for moving only the existing
stateless named-object backing lookup and unchanged ObjectRoot/Backing types into
one new size-observer-backing.ts. It finds no genuine19line simplification without
hiding a proof boundary; extracting returnedRoot would need a wider callback/state
interface. Keep the two side-specific caches and all proof/acceptance in the current
owner. AR-P45records the exact three-path packet; direct approval is pending before
the new file/type relocation. Tests/native/full/size measurements remain due.
First AR-P45question is interrupted without a ruling. User asks again and selects
**“Approve extraction (Recommended)”** on2026-10-20 for the exact stateless lookup/
unchanged types and bounded existing composition/test edits. Record the ruling and
unblock affected tasks before any extraction/new file. No other path is authorized.
Extract only the pre-existing stateless backing lookup and unchanged types; both
layout caches stay in the borrow consumer, indexed by the actual side. Correct the
new test's union narrowing through a local const, without a cast or changed answer.
Add explicit independent-layout full-width/missing-home and caller-scalar conflict
contrasts, plus global/different/forwarded/member/anonymous-returned destination
rejections. Preserve the working anonymous literal-call result and old capture
rejection. Implemented, not verified; formatting/size/strict/directed checks follow.
Normal formatting produces backing88/borrow657/test441lines, with no compressed
formatting or deleted proof. The first build finds the now-unused moved BindingId
type import; remove that import only. Fresh build2.34s/typecheck0.73s/strict test
roots0.95s and122combined cases/3files28.82s pass. Both layouts have genuinely
different ten-byte caller addresses; each missing/two-byte substitute and each
removed live-scalar conflict rejects in the direct consumer and fails atomic
provenance. All five new destination exclusions reject; the old capture and working
anonymous literal-call classes are preserved. Documentation adds the pointer/data
and invocation-local proof rationale. Independent review/native/full checks follow.
Final documented sources are backing88/borrow662/test441lines. Mechanical extraction
checks confirm the lookup body is identical apart from its explicit homes parameter
and indentation, and both relocated type fields are unchanged. No new producer,
storage/type owner, fixture, effects/main or old loop/residual test edits occur.

Actual before/after source, assembly, PRG, resource and caller-home identities match
for both returned Packet variants. The previously rejected witness now reaches
complete without changing emitted instructions or storage. PRG bounds on/off:
1013bytes`592d3309c8cacedd5234909d9f1910e0c810fd541f4499e893bf421b88df9098`,
985bytes`7441dd12a6aa3b99c5d1ae837f282fc60faece55150af4603f38355bdf318ab2`.
Both actual witness costs remain21RAM/6ZP/generated stack4; these are not the
original whole-input963/725qualification or an expert whole-program parity claim.
Both variants' source SHA-256 is
`122b9ba7222247a64f6b1e8ee80e841c1a50790adbc391ba019ce106f73c70ad`.
Assembly bounds on/off SHA-256:
`0f78487df0a05e2c26eef34dd52747129834c6f044d7a33cba4c3e05186242bd` /
`52e6ed8448e23820fbbe423e6501dfd076627a9f7c38eeb4d5f4c345de028512`.

Two sequential pinned PAL/6581 VICE cases pass in2.82s with bounds on/off. Host seeds
$C110=$A55Abefore the ordinary source read. At actual make entry, overwrite the
ten-byte caller destination with$CC; before scan entry, all ten bytes have been
written and equal18/34/51/68/85/102/119/136/52/18. Eleven actual saved-byte stores
include the one source mutation. Final data matches the independent eight-row
answer, marker$1234is at$C210and caller live$A55Ais at$C200. Source input$C110stays
unchanged. Make/scan/main/SYS stack checkpoints, represented caller P and actual
$E147continuation pass. Status: VICE-verified / hardware-unverified, PAL/6581 only.
Native JSON SHA-256:
`164911ff10773e2b0c1222443d55ab702f23bb79216d85e14a96c70b4f22a502`.

First bounded SFA/ABI and platform reviews have no findings. Base review initially
lacks actual baseline excerpts; two exact current-unit external diff reads receive
native external_directory denials. No retry, shell, permission change or alternate
access is used. Already-present source-only before/after excerpts are supplied in
the review packet under routing's authorized-excerpt mechanism. Its completed
first review has no findings and checks the exact single implementation-outcome
amendment against those excerpts; oracle hashes remain parent-attested. No denied
artifact is treated as inspected. Host review first reports missing diff input;
authorized inline current-unit excerpts complete that packet and its verdict is
still pending. These are first reviews, not repeated finding-fix clearances.

Fresh seven none identities/empty diagnostics,45import-boundary cases, touched-code
formatting,11original oracle hashes and frozen/spec/portfolio/source-reference/
ceiling/whitespace guards pass. Current nine-source sortedpath/fileSHAcompactJSON
identity is`f1a184d8ab1fe3cd548e0ec3d40d226277c278e80e40f8ce33f010ed2a47b300`.
The1004directed/full package checkpoint is still running; no task, phase, public
size, commit or push promotion occurs. All remaining capture/return variants,
status/MMIO/native windows/asynchronous observers and complete startup/debug/cost
selection retain their proof gates.
The fourth bounded host-cost review now has no findings: the root exclusion Set
removes repeated scans; extracted lookup complexity/caches remain unchanged; terminal
indexing retains existing references, and new result-call records are invocation-local.
No host latency/RSS measurement or general scaling guarantee is claimed. All four
first-review endpoints are bounded; final six-lens phase review remains due. No
critical/major remediation, extra fix review or phase waiver occurs in this unit.

Full checkpoint completes: frozen install0.35s/build2.15s/typecheck0.75s and1004
directed cases/78files134.14s pass. Full yarn test221.84s reports2635compiler passes,
13known frontier failures and two existing skips across172files. Every failure is
still in input-size-frontier.spec.test.ts at the unfinished public candidate stage.
CLI62/language-server21/VSCode6pass; root is not reached. No new inherited regression
is demonstrated, but the composite remains RED and is not a commit checkpoint.

Current nine-source identity above remains exact after review/native/full checks.
AR-P44's five old table programs and all earlier assertions stay unchanged except
the approved returned-local outcome/title/column; AR-P45's exact lookup/types move
is mechanically checked. All11specification identities, seven none identities and
the frozen specification/expert/portfolio guards stay binding. Expert lineage is
2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15, unchanged.

**Next actual boundary:** captured members still lack authenticated source-operation
to actual temporary backing evidence. Preserve their rejection and the accepted
anonymous literal-call path. Forwarded/global/member/alternative/anonymous returned
destinations still need their own proof; no new producer/type/metadata authority is
implied by the exact stateless extraction. Continue task15's remaining status/MMIO/
native-window/asynchronous/reference-rejected observer obligations through their
approved owners. Task15and the parent remain partial;14tasks remain (six
implementation/eight hardening-qualification), keyboard38/48and v4four/ten unchanged.

After final accounting/link/source guards, remove only the current owned
`aggregate-backing-scope-fw0tgad1`: pre-unit copies, current-unit diffs/logs, native
modules/assembly/PRGs/maps/JSON, none project and probe modules. No rejected artifact
is re-read for review or retained as inspected evidence. No user/worktree/another
runtime/historical evidence belongs to cleanup. Execution plan and owning status
updated. No commit, push, merge, public size, complete963/725, whole-task or phase
clearance occurred.

### Captured-member association — continuation

The user says continue. Fresh nine-source identity matches
`f1a184d8ab1fe3cd548e0ec3d40d226277c278e80e40f8ce33f010ed2a47b300`.
Build0.43s/typecheck0.36s and122focused cases/three files29.15s pass. No source/test
edit occurs. Four real two/eight-byte captured-member probes with bounds on/off
close actual reference and candidate layouts, then reject at the explicit capture
barrier. Full temporary homes differ by layout; each lifetime covers nine source
positions and two calls. The semantic result differs from request.value in every
case. AR-P46 records the necessary association/ownership stop before any producer,
type, consumer, new-file or old expectation expansion. Challenge the smallest
viable existing-evidence or opt-in producer path; direct exact approval remains
reserved. No progress promotion, public size, commit or push follows.
The first independent verdict is Justified for an opt-in exact source-operation
to actual capture-request association on the authenticated symbolic function,
with actual backing independently resolved per final layout. It requires a focused
capture proof/test, not treating snapshots as named aliases or granting machine
footprint coverage. Existing request.value/lifetime/hash logic must stay exact.
The initial producer wiring would cross699/700line owners. The same challenge now
resolves that concrete capacity constraint before the unified path/concern packet
is presented. No limit exception, compressed formatting or silent additional
extraction follows. The association, full copy/delivery/order, all-use and lifetime/
interference obligations are distinct; no new code or expectation is changed.
Current nine-source identity is still exact. Eleven specification hashes, frozen
spec/expert and the untouched non-integration portfolio guards pass. The capture
probe JSON SHA-256 is
`b32c3603e282eaab3ba8c730ebbcdfe20385c3348023f5627359758668eb27e9`.
No ACME/native/full-regression claim is added by these association probes. The
previous full2635pass/13known frontierfail/two existing skips remains the latest
composite evidence, not a new GREEN checkpoint. Only this continuation's owned
scratch is disposable after durable recording and exact approval presentation.
The same independent challenge completes capacity reconciliation: keep exact
constructor/request association; relocate only AggregateAddressCache's unchanged
type to machine-types with compatible type-only import/re-export, and extract only
the existing edge-merge-copy loop to lower-merge-copies. All other cache/merge
semantics remain unchanged. The unified nine-path packet adds just that helper,
the focused capture proof/test and six existing wiring/test owners. Every file
must remain at most700after ordinary formatting; no small-overrun exception.
Independent verdict Justified; Confidence Medium until readable full copy/order
proof and actual sizes are demonstrated. The rejected hook-based alternative has
unproved interception/value-publication coverage, not a demonstrated safe smaller
implementation. Exact paths, estimated costs, exclusions and the single old
anonymous-member-capture outcome amendment are recorded in AR-P46 before asking.
No source/test edit or expanded authority follows from the verdict. Fresh guards
and owning-status links pass. Owned capture-association-cg_uugp2 scratch is removed
after its probe hash and endpoints are recorded; no unrelated scratch is touched.
The user directly selects **“Approve scope (Recommended)”** for the unified
nine-path AR-P46 packet, both unchanged moves and exact single capture outcome
amendment. Record the ruling and unblock affected tasks before any new file,
producer/type/test change. No other path or behavior is authorized.

Three meaningful capture expectation failures and26passing controls precede new
production edits. Implement the exact unchanged cache-interface relocation and
edge-copy extraction, plus opt-in main-context operation/request associations at
both existing capture constructors. Request values/lifetimes, cache constructor,
merge byte order/failures and selection remain unchanged. Producer subunit is
implemented, not verified; readable formatting/build/artifact checks follow before
the focused final consumer. No complete capture or task15 claim occurs.

Producer wiring now builds after removing only the moved storeA import. Normal
sizes are machine-types684/state696/function687/build610/merge39lines. Four actual
source/assembly/request/home/stack identities match pre-edit output exactly while
captures remain gated. Add the focused consumer and bounded borrow composition:
whole-object sub-page captures, one straight-line source body, same-block first
member construction into a named private destination. Match both existing unrolled
and counted/directional copy templates and actual graph edges, preserve call order,
check every value use and complete occupancy/interference on both constructions.
No capture instruction receives footprint coverage. Consumer implemented, not
verified; ordinary formatting/typing/RED-to-GREEN and negative tests follow. Task15
is still partial, with no public-size or complete observer qualification claim.

The first formatted consumer is751lines. Remove repeated per-site failure plumbing
through one local rejection helper retaining every reason/span/object; no proof,
acceptance class or check is removed and no additional path is needed. Normal
consumer688/borrow660lines now fit. Fresh build and29focused cases pass, including
both new widths with bounds on/off and the one approved old capture outcome. The
explicit source-kind/call-order/copy/count/occupancy/conflict integrity cases and
strict test-root compilation remain due before any verified subunit claim.

First bounded base review reports one MINOR missing direct source-boundary test,
not a production defect: add non-first-member displacement and unsupported extra
consumer contrasts with specific rejection reasons, preserving ordinary none
compilation. Add only these cases to the approved new capture test owner; no old
expectation or proof changes. The SFA/platform first reviews and full checkpoint
remain active. Four actual before/after ACME PRGs are byte-identical: two-byte
capture688bytes, eight-byte836bytes, both bounds variants. Four sequential pinned
PAL/6581 native cases pass in5.35s: poison capture/saved homes before execution;
each snapshot byte is written exactly once in ordinal order and is7before mutate;
saved rows remain7and marker5before read while original[0]is99. C100returns7;
main/call/restore/SYS SP and represented P are preserved. This is VICE-verified /
hardware-unverified, not original963/725whole-input qualification. No task promotion,
commit or push follows.

CA-RV-001's two focused boundary contrasts pass with exact rejection reasons and
ordinary none acceptance; all23capture cases and strict roots pass. The base review
has no other findings; first SFA and platform reviews report no findings within
their static boundaries. Host-cost first review remains active. The platform's
remaining decisive edge probe is a nonuniform255byte page-crossing capture: add
that already admitted width to the new positive test table, with independent
period256byte values; no production or old-source change. Its actual native and
page-crossing results remain pending, with no inherited before-artifact claim for
this newly added witness. Full checkpoint running; task15remains partial.

Full checkpoint reports install0.33s/build0.32s/typecheck0.74s and1025directed cases/
79files140.17s. Full compiler2659passes/13known frontier failures/two existing skips
includes all24new capture cases; other packages62/21/6pass, root is not reached.
The refreshed directed slice including the two boundary cases and255edge now
passes1028/79files139.37s. Two additional sequential native255cases pass in3.87s:
source/capture/destination all genuinely cross pages; all255nonuniform bytes and
ordered stores, marker5, mutated original99, answer3and SP/P/SYS are correct.
Their2085byte PRGs are current-only evidence, not before/after qualification.

The fourth bounded first review finds two MINOR host costs, with no measured
latency failure: repeated position×request×lifetime scans and per-capture index/
conflict-set rebuilding. Apply only local algebra-preserving changes in the
approved capture owner. Snapshot occupancy is checked once through a source-point
Set; each other request's source lifetime intersects the complete interval once.
Each actual layout owns its own invocation-local lazy request/home/conflict index,
created only after the source/metadata guards and reused across captures. Reuse
the identical main-body query for source and call cardinality; no producer/request/
instruction/source acceptance change. Implemented, not yet reverified; preserve
the prior immutable source as the bounded host-fix baseline. No major finding or
extra review waiver occurs; final six-lens phase review remains mandatory.

Both minor host corrections pass147focused cases/build/typecheck/strict roots.
The capture owner is700normally formatted lines; tests489lines. Two real-fixture
validation-only seven-sample medians improve13.17→4.82ms(1capture/32later scalar
members,69requests/2346edges per layout) and4.46→2.03ms(8capture bodies/1marker,
56requests/168edges per layout). Both old and new proof functions return complete
for identical actual inputs. These are bounded host observations, not general
latency/RSS guarantees. Snapshot interval gap and late independent-function missing
home controls pass on both layouts. No extra review pass is required or claimed
for these MINOR corrections; final six-lens review remains due.

Post-host install/build/typecheck and1029directed/79files139.61s pass. Full221.30s
reports2660compiler passes/13known frontier failures/two skips; other packagespass,
rootnotreached. Fresh seven none identities,45boundaries,11oracle hashes, frozen/
portfolio/format/source-reference and exact unchanged type/helper/producer moves
pass. Native images remain exact after the host-only edits. A final composition
integrity check then finds a clear ordering regression: a cloned checked-program
handoff reaches capture eligibility's tuple rejection before the existing source
authority error. Its new regression is meaningful RED. Restore existing source/
recipe checks before delegation, in the already approved borrow composition owner;
capture admissions and all proof checks stay unchanged. Implemented, awaiting the
final directed/full reverification; no task/phase/public size promotion occurs.

The one bounded base correction review has no findings: source authority precedes
capture eligibility again; the interval query retains the union of all original
source-point obligations; indexes remain lazy, invocation-local and side-specific;
and both cardinality queries preserve their predicates. CA-RV-001/CA-PE-001/002
are fixed within the approved files. There is no third iterative review, major waiver or
independent host/native claim. The base first review's incidental historical
routing setup-summary exposure is disclosed and excluded from decisive evidence.
FO-SF-002 remains unclosed for the final phase; earlier denied host evidence is
not treated as inspected or cleared by these separate current-unit reviews.

**Final current capture checkpoint:** install0.30s/build0.36s/typecheck0.72s,
strict test roots0.93s and148focused cases/four files38.28s pass. The complete
directed slice passes1030cases/79files153.03s. Full yarn test244.28s reports2661
compiler passes/13known input-size-frontier failures/two existing skips across173
files. All failures still report the unfinished public candidate stage. CLI62,
language-server21andVSCode6pass; root is not reached. This remains a RED composite,
not a commit checkpoint. Neither public size nor whole task15 is promoted.

The exact nine-file unit finishes at machine-types684/state696/function687/build610/
merge39/capture700/borrow661/capture-test497/borrow-test441normally formatted lines.
No compressed formatting or removed safety checks produce those sizes. The old
capture row is the only amended old outcome; all old source/program/assertion bytes
remain exact otherwise. Mechanical checks confirm the unchanged cache type,
cache constructor, requestStorage, edge-copy loop and two-line producer additions.
The pre-unit nine-source identity reconstructs exactly with the saved borrow pair;
the other seven current observer/fixture concerns are untouched by this unit.

| Capture width | Bounds | Actual PRG | Certificate staticBytes RAM/ZP | Generated program stack | Identity endpoint |
| --- | --- | --- | --- | --- | --- |
| 2 | on/off | 688bytes,`5aa019ddc0eb03710659734c3399467e20a4a11aa0f5871303069f3256390026` | 8/0 | 2 | Exact before/after assembly,PRG,requests,homes and stack; rejected→complete only. |
| 8 | on/off | 836bytes,`4550b3bc12c74c517424981b17d4ca5500caf18124b5c8e759fd573204c2b075` | 20/8 | 2 | Same exact before/after endpoint. |
| 255 | on/off | 2085bytes,`99efef555e8fb9c824e97f3a33bc67d4bd69c2491238417cb2e4c101d6ab667d` | 514/8 | 2 | Current-only edge witness; no inherited before-image claim. |

These certificate fields are not a complete whole-input resource vector or an
expert-parity result. The original963/725limits remain unchanged and unqualified.
Source/assembly SHA-256 pairs for the three rows:

- 2:`c39c68ebe4f66c236f93004917db23a60785f1377e20d556b668dd6173803cad` /
  `eaca464db51e01bc8a2a1990963e4b5b25dc6139c34a4879ef475c5a91ad09b6`.
- 8:`df3ac0afa2116054c9e5a2837794f6d1f0ec24ec2b318e1a1cb40b85f8d79022` /
  `809cf34481da0e5d4a622b2723ec5960f26cffbe1ed030bdf0b72a58201bfc1c`.
- 255:`8c0a98b9679ae582a97bc0dffbec406c6d791dc1139b8fb0eafa66121fb15f70` /
  `f4557c17540aa414693cfa05670a65affc27da69231afa37432917b2b500bb2d`.

Six sequential pinned PAL/6581 native cases establish the independent source
answers, complete capture before mutation and complete member delivery before
borrowing, every ordinal store, original mutation, marker and SP/representedP/SYS
return. The255case uses `(17*i+3)&255` and genuinely crosses pages for source,
temporary and destination. Both bounds policies pass. Native JSON hashes:
`2387638417956c4f44b2b640e417994fec3d0ea6b3f6f3d1f8a8e77b2337df29`
and`5699ca03e47182d84e2a18bfa685b643fddb7027ba5229de7a9bf984df443455`.
Status is VICE-verified / hardware-unverified, PAL/6581 only; no original-input,
four-profile, explicit timing, universal dummy-bus or external-interrupt proof.
Fresh assembly/PRG identities after the final host/composition corrections match
the native-executed images, without rerunning unchanged emulator cases.

Seven original none identities/empty diagnostics,45import-boundary cases, all11
oracle hashes, frozen spec/expert/portfolio, source-reference, ceiling and
whitespace guards pass. Current16-source sortedpath/fileSHAcompactJSON identity:
`62e2258ef9c84e7f50f50fbc40ed955684ca6442ac6b23c510076ec551095935`.
Expert lineage remains2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15.

**Continuation boundary:** the bounded direct first-member capture class is now
locally verified, alongside the named and direct-return classes. Non-first/member/
parameter/redirected or larger captures and other unresolved transports retain
ordinary fallback, not source restrictions. Remaining reference-rejected outcomes,
status/MMIO/platform, native changed-state windows, asynchronous observers and
complete footprint closure remain task15-owned. Startup, finite construction,
cost/evidence/debug and qualification remain the other five implementation tasks.
Total26/40, six implementation/eight hardening-qualification tasks remain; keyboard
38/48andv4four/ten are unchanged. No new scope is inferred from the exact capture
packet. No commit, push, merge, whole-task or phase clearance occurs.

After final plan/link/source accounting, remove only the owned
`capture-proof-b4tct0wq` directory: pre-unit source copies, old host-query copy,
logs, temporary modules, ACME/VICE images/results, none project and all probe files.
No historical/user/other-session evidence is disposable. Owning status is updated
before cleanup. The journal and findings ledger retain the decisive endpoints;
no temporary artifact needs to outlive this continuation.

### Remaining machine-window observers — continuation

The user requests further execution. The final capture16-source identity remains
`62e2258ef9c84e7f50f50fbc40ed955684ca6442ac6b23c510076ec551095935`.
Fresh build0.46s/typecheck0.35s and26capture cases13.95s pass. Required plan files
and all11oracle hashes are intact; the first partial task remains1.2.15. No phase
baseline, public mode, outer-attempt budget or963/725limit changes.

Four fresh real typed-source probes close both actual layouts. A plain Boolean
predicate called by a direct branch has one authenticated certified-call record,
no other pending family, and a valid all-exit fact on the final callee, but the
atomic observer rejects only its pending-window guard. Comparison/AND versions
also carry a byte-edge record and remain a distinct obligation; the plain negated
source carries no pending proof and is already accepted. These are real source/
lowering facts, not native or whole-output qualification. A first scratch JSON
write encounters BigInt; its serialization is corrected in owned scratch without
changing source or claiming a successful initial probe.

Before editing, an independent minimum-sufficient challenge selects the next
required window subset and decides whether it fits the existing atomic owner/
test with all physical/source/status/asynchronous gates preserved. No support
module, producer instrumentation, oracle amendment or additional path is assumed.
All existing code/tests remain unchanged during this investigation. Progress26/40;
complete task15, public-size construction and final phase review remain open.

The independent challenge selects Simplify: use only the already approved atomic
observer and its existing implementation test, with no support module, producer
or fixture edit. Grounded actual source corrects its initial unproved TAX premise:
the ordinary negated byte-return caller removes CMP#0; Boolean return arms can emit
TAX without any removable-window proof. The same challenger converges on empty or
one CMP#0 certified suffix only; TAX, retests, capture reloads and all five other
pending families remain rejected. Existing final callee exit and carry-continuation
queries discharge actual physical register/flag state, not an origin receipt.

This is an existing-owner task15 implementation choice within AR-P31, not a new
support surface or oracle exception. Require no residual raw/borrow operations for
this newly admitted subset and retain every old source/async/placement/footprint
guard. Exact final caller/JSR/callee/block/branch associations must close without
new alias resolution. New additive real-source positives and retained barriers
are written before production changes; no old assertion or outcome is amended.

Two actual-source Boolean admission cases are meaningful RED before production;
four independent byte-edge/status/raw/MMIO barrier cases pass. Implement only
the register-only certified empty/CMP#0 suffix closure in the existing observer.
Resolve exact final caller/block/JSR/branch/callee ownership; reject remapped/shared
owners instead of adding an alias resolver. Reuse actual final all-exit Boolean
facts and the existing carry continuation query on both physical successors,
including relaxed branches. All existing authentication/source/footprint checks
and the other five pending-family barriers remain. Production implemented, not
verified; formatting/file ceilings and directed RED→GREEN follow. No task promotion.

Normal formatting fits the existing owners at693production/684test lines. Build
passes2.11s. Strict compilation exposes two inherited typing errors in this exact
owned test's private fixture, not production: a widened storage profile ID and a
Map.has-guarded optional selection. Correct only those expressions to the already
selected typed profile ID and the known-present map value. No fixture path,
source program, oracle, assertion or expectation changes. This is not AR-P40's
separately bounded moved fixture; that test-support file stays unchanged. The
strict/positive verification is resumed before claiming this subunit verified.

The empty window passes, but the real CMP caller initially rejects at final
association: existing layout bypasses an empty label at the same actual PC. Compare
already known final entry PCs and normalize short/relaxed branch polarity, not
symbolic spelling or inferred jump chains. Foreign/missing/shared owners still
reject; no resolver or new metadata is introduced. Cache each actual callee's exit
result once. Normal observer700/test684lines; fresh build2.26s and all six new cases
pass. Original comparison/AND cases retain their independent-family rejection.
Add one real oversized typed-arm case to require actual branch relaxation in the
same table, preserving both earlier source cases. Strict/full/directed verification,
independent bounded reviews and sequential native checks remain pending.

All three bounded first reviews now report no findings within their distinct
base/ABI/platform boundaries. Base/platform initially request exact skill authority;
the primary supplies already-loaded authorized router/normative excerpts and the
exact command/result mapping. No denied/hidden read is retried or bypassed. SFA
and platform disclose incidental historical setup summaries in routing guidance;
those summaries are excluded from decisive evidence. No full-phase, independent
execution or host-latency clearance is inferred. FO-SF-002 remains open.

Twenty sequential pinned PAL/6581 native cases pass: empty and comparison callers
at0/1/127/128/255, an ordinary carry-clearing prefix and an actual relaxed-branch
witness. At each observed condition, A is canonical0/1 and N/Z agree; carry is
actually0(including the explicit prefix variant), demonstrating that removal of
CMP#0 need not preserve its incidental C=1. Every independent ordinary-source
answer, SP, represented P and normal SYS return passes. First15cases16.09s, five
additional relaxed-branch cases6.76s. This is VICE-verified / hardware-unverified,
PAL/6581 only—not timing, four-profile, hardware or original963/725qualification.

All six originally captured probe artifacts remain source/assembly/PRG/request/
home/staticBytes/stack-identical before and after the observer-only edits. The
plain and actual-CMP windows change rejected→complete; other pending-family
probes retain their previous rejection and previously accepted probes remain so.
Scratch's historical tax label denotes the actual CMP-removal witness, not TAX
admission. The carry-prefix and relaxed witnesses are current-only artifact
evidence, not inherited before-images. Seven original none artifacts/empty
diagnostics,45boundary cases,11oracle hashes, frozen/portfolio/format/ceiling and
whitespace guards pass. Mechanical two-file reconstruction proves every prior
source line, test program/assertion/outcome unchanged apart from the exact two
private-fixture type expressions and explicit Boolean integration.

Final17-source identity is
`6fc556effc66e98a91d5a86320c33195d9d528374b000158824f73321696526d`.
The complete install/build/typecheck/strict/direct/full checkpoint is active;
task15stays partial. Main observer700/test691lines exhaust their readable capacity.
The next demonstrated comparison/AND byte-edge obligation therefore has a separate
independent minimum-sufficient ownership check before any new concern, extraction
or wider proof admission. No next-scope implementation is authorized or started.

AR-P47 records the next genuine capacity stop before any new concern, extraction
or wider proof change. Block tasks15/17/1.3.3visibly; preserve the current Boolean
diff and continue only its already authorized verification. The independent
challenge owns the next minimum-sufficient packet, not permission to implement it.
Feature/keyboard status is updated; portfolio remains integration-only and is
untouched on feature/v4-rebuild. No task progress or phase clearance changes.

**Final Boolean checkpoint:** install0.35s/build2.00s/typecheck0.70s/strict roots1.15s
pass. Directed1037cases/79files157.89s pass. Full251.57s:2668compiler passes/13known
input-size-frontier failures/two existing skips across173files; all failures still
report incomplete public size selection. CLI62/language-server21/VSCode6pass;
root is not reached. Boolean subunit locally verified, not task15/phase/public size.
No RED composite commit/push; expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15
and open final-phase FO-SF-002 remain unchanged.

| Witness | Actual PRG bytes/SHA-256 | Certificate RAM/ZP; generated stack | Evidence |
| --- | --- | --- | --- |
| Empty suffix | 108;`ecc1beb80d6fa3fd8beb46ec6b38483867ac4110bda9d50abea1a64af4d04241` | 0/0;2 | Exact before/after source/assembly/PRG/requests/homes/staticBytes/stack; rejected→complete. |
| CMP#0 removed | 107;`362f6c1a3e28cc5b0db5419acb817ee590c719f1cabf2c16bb82e66ea6bf649f` | 0/0;4 | Same exact before/after endpoint. Scratch tax label does not mean TAX admission. |
| Carry-zero prefix | 146;`74c339b199aabcd7235d654dd990554a6804fdcba87f07cfb1b78b996c85bb22` | 2/0;4 | Current-only witness. |
| Relaxed branch | 711;`a9fb047fc1b18284137a1985aea8860212ca338fe67f76f3e4449067bcfc0abe` | 0/0;2 | Current-only witness; actual long branch required. |

Certificate fields omit platform/global ownership and are not a complete resource
vector. Twenty sequential PAL/6581 source answers at0/1/127/128/255, actual canonical
A/N/Z, carry0, SP/represented P/SYS pass. Native JSON hashes:
`8d551f11c28a7f17af6424a138bfebc21d013b4d1aa094aca7ba6f437d022009`
and`ad53e6793eba00f85a6523f7e98b7588dceebdca3c99013f5b7d7d12a7cd2a59`.
VICE-verified / hardware-unverified; no four-profile, deadline or original963/725
claim. Host latency/RSS unmeasured. Upstream local CMP removal is2bytes/2nominal
cycles; this observer-only unit changes zero target bytes/storage versus pre-unit
selected output and makes no new whole-program parity claim.

Source/assembly SHA-256 pairs in table order:

- `559eaef6cd9eda371525c0b9ce84b9dbf59fc9d4670a2634148cf278cc85292c` /
  `48bb1c27922608ee0d09256889cba9766daf4d137cf5138e05d102bf4c8601ce`.
- `17605020c2734097a4dae624818e783a3f29cb6446bf05572d61c14fe11595db` /
  `6b234298073947638b54fcb48985dcb4b3b7a46c9604b8ed32599c21883c7b48`.
- `e64463417c68af5e1aa1d0fae45c34e6991fc42bf85f1c36470a73dd4cbb8ec2` /
  `0c31d1944ff485cfebab7ecbc382c5ed14f12c3076dea6ea4cd7e6ff03c33bb6`.
- `dd8865ca2240a4b820984d2e83ae746e012b211bd9ba29effc101e5b04675067` /
  `2b2b7e5b3bb9ee20dfc03089e2147aaa1e9fbf6312f448e3f1b84901e30aa5e6`.

The next independent challenge returns Justified: exactly one final byte-window
owner/test pair, unchanged ordinary/Boolean helper moves and bounded main wiring.
It identifies the conflicting current byte-expression rejection row; AR-P47 now
explicitly requests only its migration with exact generated source to positive
coverage. Direct approval is pending before either new file, move or amendment.
Remaining three barriers, three pure-Boolean admission cases and every other test stay protected.

Final17-source identity remains
`6fc556effc66e98a91d5a86320c33195d9d528374b000158824f73321696526d`.
Substituting only the saved old observer reconstructs the prior16-source identity
exactly; all other15current concerns are untouched. Seven none identities,45boundaries,
11oracle/frozen/portfolio/scope/doc/format/ceiling/whitespace guards pass. Main700/
test691lines; next two files absent. Tasks15/17/1.3.3blocked for AR-P47,26/40verified,
six implementation/eight hardening-qualification tasks remain. Keyboard38/48andv4
four/ten are unchanged. Portfolio cascade remains deferred off integration v3.

After final linked/status guards, remove only owned observer-windows-zbss8pyy:
before-code copies, previews, probes/modules/logs/results, ACME/VICE images and none
project. Keep user/history/other-session artifacts. Decisive evidence is durable;
no temporary artifact needs to outlive the exact approval presentation.

The first AR-P47 prompt is interrupted without a ruling. The user asks again and
directly selects **“Approve scope (Recommended)”** on2026-10-21 for exactly the
four named paths, unchanged ordinary/Boolean helper moves and single implementation
row migration. Record this ruling and unblock tasks before every new file/move/
expectation change. No other producer, fixture, oracle or support surface is granted.

The exact migrated source has one meaningful admission RED before production,
with six current Boolean/barrier controls passing. The17-source pre-unit identity
matches. Actual global and parameter-home probe images are captured before edits;
both current observers reject the byte family. Extract only the unchanged two
Boolean helper bodies and reuse the existing failure representation; wire their
new focused owner while retaining the byte blanket gate during the move. The
approved row moves to its new positive test without altering its source. Extraction
implemented, awaiting ordinary formatting/mechanical body comparison and build;
new byte admission is not yet implemented or verified. No progress promotion.

The move formats/builds and mechanically compares both helper bodies byte-for-byte;
six existing Boolean/barrier cases pass. Main569/test690/new-owner152lines before
byte logic. Implement only the bounded actual reference EOR/reload versus selected
CMP/no-reload templates, exact per-layout home/symbol byte resolution, source/final
branch mapping, actual single entry, changed-state continuations and Boolean-first
composition. Remove only the byte-family blanket gate. Other four pending families
and all outer guards remain. Implemented, not verified; readable size, strict typing,
positive GREEN and discriminating negative cases follow before subunit clearance.

Byte owner409/test369/main568/old-test690normally formatted lines. Build2.27s,
strict owned test roots0.94s and21new cases5.41s pass. Actual global-symbol and
scalar-parameter-home constructions both now close. Negatives distinguish the
focused rejection reason before the separate atomic provenance error: missing/
displaced/different identity, wrong effective load, branch polarity, alternate
entry, intervening code and observed changed A/N/C, including ADC read-before-write.
Boolean-first rejection and raw/status/MMIO/IRQ source barriers stay covered.
Initial typing checks correct only the new local interval-payload/count distinction,
explicit consumer narrowing and a new test's missing null operand; no cast or
existing fixture/producer change. Base first review reports no findings; assigned
SFA/platform first reviews and final artifact/native/full checks remain pending.

All three bounded first reviews report no findings within base/ABI/platform
boundaries; routing-summary exposure is disclosed and excluded. The first native
probe fails its assumed per-stop trace-event timing, not a source answer or CPU
state assertion. A diagnostic observes LDA's hit at the branch stop, CMP's hit at
the next stop and AND's hit at restore in both global/home cases. Compare the exact
complete-window load order/count at normal restore, keeping every original source
answer/A/NZC/SP/P assertion and no reinitialization of traces. This corrects only
owned scratch observation timing; no monitor/helper/production edit or weakened
CPU read oracle. The diagnostic itself is not full count qualification. Rerun all
24sequential cases before claiming native success; full checkpoint remains active.

Twenty-four sequential pinned PAL/6581 cases now pass in25.12s, twelve each for
actual resident symbols and scalar-parameter SFA homes. Independent equal/unequal,
overlapping/disjoint-bit and high-bit answers, retained A at CMP/AND, exact comparison
N/Z/C, complete-window effective load order/count, SP, represented P and SYS return
all pass. Equality takes only left/right reads; unequal paths read left/right/right,
never the removed left reload. The two diagnostic timing failures remain recorded
as failed observation assumptions, not suppressed target failures; final aggregate
order/count retains the original exact expectation. No existing monitor edit.

Both actual before/after source/assembly/PRG/request/home/staticBytes/stack records
are identical; only observer outcomes change rejected→complete. Native JSON SHA:
`b106d3f1e528ac922aa338bc23dabe2cd478d5bd6323da14aa49acacc2dfae35`.
VICE-verified / hardware-unverified, PAL/6581 only;24boundary pairs are not exhaustive
byte-grid, physical silicon, universal dummy-bus, timing or original963/725proof.

Fresh seven original none identities/empty diagnostics,45import boundaries,
11oracle hashes, frozen/portfolio/format/ceiling/doc/whitespace guards pass. Exact
four-path reconstruction proves unchanged Boolean helper bodies, the one removed
row and every remaining original assertion/source. Replacing the saved two old
owners reconstructs the prior17-source identity exactly, excluding unrelated work.
Current19-source identity:
`b93676f23cdc2247938da2dbd62e0a4e2b751b7e982c42ca56ff22e488668a22`.
Platform review's requested metadata-only supplement is supplied from the fresh
current Status row: Active qualified and frozen — exact approval, byte-identical
migration and immutable content binding complete. It acknowledges this one datum
without another substantive review or native/phase clearance. Final full/direct
checkpoint remains active; no task, public-size, commit or push promotion occurs.

**Final AR-P47 checkpoint —2026-10-21:** frozen install0.36s/build1.88s/typecheck0.72s/
strict owned roots1.11s pass. Directed1057cases/80files155.28s pass. Full yarn test
251.69s reports2688compiler passes/13known input-size-frontier failures/two existing
skips across174files. Every failure still reports unfinished public candidate
selection. CLI62/language-server21/VSCode6pass; root is not reached. The exact
approved byte-edge subunit is locally verified, not whole task15 or the phase.
No RED composite commit/push, public-size promotion or963/725qualification follows.

| Byte witness | PRG bytes/SHA-256 | Certificate staticBytes RAM/ZP; generated stack | Endpoint |
| --- | --- | --- | --- |
| Resident symbols | 124;`f780d3908325921edd3b882a2a27792e4c30985c3887f9719351ea7f10fc8d77` | 0/0;2 | Exact before/after source,assembly,PRG,requests,homes and resources; rejected→complete only. |
| Scalar parameter homes | 136;`b383df116ea44daa48289f20cdd099737ffd007e6e78bdb4dcec41f675c6e421` | 2/0;2 | Same exact before/after endpoint. |

Certificate fields do not include platform/global ownership and are not whole-input
vectors. This observer-only unit changes zero target instructions/storage versus
its pre-unit selected output. The upstream absolute window costs9bytes/12nominal
CPU cycles versus12/16reference, excluding branch/bus-stall/whole-artifact effects;
no new full-program expert claim or change to existing parity debt. Source/assembly
SHA-256 pairs:

- Symbols:`0d205a5628120ca0c02f0ef82135964e8d6af95aff1b0bdd1bc3c2f4869011a1` /
  `46912f99d0ee8794b27639ea28f663acd6f510bdf69f18880706777721afaf76`.
- Homes:`16aa24d306f99e2ca51403054483762730c59ff8924e73f4fc54f3fabfc5a2d5` /
  `6adf25dbefe88775071932fa5b529c818338d18b51bc89a71665134c441e4b52`.

Twenty-four native pairs are0/0,1/1,255/255,3/1,1/3,128/1,128/128,255/128,128/255,
0/255,255/0and128/127for each storage class. Defined truth, retained A, actual CMP
N/Z/C, complete-window effective read order/count, unchanged source globals and
SP/representedP/SYS pass. VICE-verified / hardware-unverified, PAL/6581 only; this
does not establish all65536pairs, four profiles, timing or universal dummy-bus
observations. The exact image/resource, footprint and native endpoints are distinct.

All three bounded first base/SFA/platform reviews report no findings. Reviewers
did not execute the parent probes or grant task/phase/public-size clearance. The
metadata-only Status supplement is acknowledged without another review. Any
incidental historical routing summaries are excluded from decisive evidence.
Expert lineage remains2.0.4, active qualified/frozen, content
0e2a6280ddf77e42252b7a50b85cf9ea3d732b15. FO-SF-002 stays open for final six-lens
phase review; current results neither retroactively inspect denied evidence nor
close that finding.

Exact path/capacity endpoint: main568, old-test690, new proof409 and new-test369
normally formatted lines. The two Boolean helper bodies compare unchanged. Only
the specifically approved old byte-expression row moves with exact generated
source and rejected→complete outcome; every other old source/assertion/outcome and
all pure-Boolean admission cases remain exact. Producer, test-support fixture, storage,
metadata, schema, dependency and specification-test owners are untouched by this
unit. Seven original none artifacts/empty diagnostics,45boundaries,11oracle hashes,
frozen/portfolio/source-doc/format/ceiling/whitespace/link guards pass.

Current19-source sortedpath/fileSHAcompactJSON identity remains
`b93676f23cdc2247938da2dbd62e0a4e2b751b7e982c42ca56ff22e488668a22`.
Restoring only the two saved existing owners reconstructs the pre-unit17-source
identity exactly; unrelated dirty work stays excluded. No task line is promoted:
26/40verified; six implementation/eight hardening-qualification tasks remain;
keyboard38/48andv4four/ten unchanged. Remaining task15native-store/complement/
counter/expanded-window, status/platform/MMIO, asynchronous and reference-rejected/
wider transport proofs remain conservative tuple fallbacks. Public size constructor,
compact startup/debug and original complete cost qualification stay separately due.

Execution plan and owning/keyboard roadmap summaries are updated before cleanup.
After final source/status/link guards, remove only owned byte-window-proof-hrmjfqd2:
pre-unit sources, temporary modules/logs, failed timing diagnostics, ACME/VICE
images/results and none project. No user/history/other-session artifact is
disposable. No temporary evidence needs to outlive this verified subunit boundary.

**Next continuation —2026-10-21:** entry documents/closed AR-P1–AR-P47/preflight,
existing specification-first381-case baseline and accepted-not-waived FO-SF-002
status are checked before work. Prior19-source identity matches and27byte/Boolean
resume cases pass. Four actual cache/original-field constructions with bounds
on/off close both layouts, residual source proof and one Original induction. Only
their complement pending-window gate rejects. No native-store/counter/expanded/
Boolean/edge pending family is present in these probes. Cache has two records;
original-field has one record and one already discharged aggregate borrow.

AR-P48 records the next ownership/scope question before code. Existing byte owner
has409lines/test369, main568/test690; its exact AR-P47 concern is narrower than
complement admission. Independently compare existing-owner extension with a
focused pair, including actual-byte/source/cache/occupancy/entry/A/P obligations.
No implementation/test/producer/fixture/oracle edit or additional file is made.
Tasks15/17and residual test concern are visibly blocked while this resolves.
Original phase baseline/counts/none/oracles and all prior dirty work stay intact.

The one independent challenge returns **Simplify: one focused cache-only proof/
test pair plus minimal main wiring**, not extension of the byte pair or a combined
original-field proof. Its initial material missing input is supplied through a
fresh actual association probe. On both bounds settings and both store sites,
source operation/recipe/store membership and original source-block/preheader
identity match exactly. Each effective source store retains the exact operation
object; reference load/unary origins do not survive and are not invented.

Actual source-store operand chains identify each reference capture directly:
source-block prefix LDA source/EOR#255/STA capture, unchanged bounded address setup,
LDA that same symbolic capture/STA with exact source-store origin. The next site's
prefix starts after the preceding anchored store. Selected code removes only each
prefix and reloads the recorded cache before its anchored store. Bounds branches
split the emitted chains; ordinal concatenation is not a path proof. One selected
preheader LDA source/EOR#255/STA recorded-cache suffix follows original operations.
The same challenger confirms these existing anchors support a bounded complete
proof with no new producer metadata; actual path/lifetime/state checks remain due.

Exact AR-P48 packet: new services/size-observer-byte-complements.ts (620line ceiling),
new matching implementation tests (640), existing size-observers.ts wiring (586).
No existing helper move/export, fixture/producer/test amendment or other path is
requested. Existing Boolean/byte proof runs first; every outer source/storage/
startup/footprint gate and native/counter/expanded rejection stays. One stable
global cache group, deferred immediate typed stores, actual feasible reference and
proved positive Original loop only. Original-field/preserved-left/raw/borrow/status/
MMIO/platform/async/callable and other mixed windows stay rejected. Approval is
pending before either new file or removal of the complement blanket gate.

Current assembled probe endpoints, not runtime qualification:

| Probe | Bounds | PRG bytes | SHA-256 |
| --- | --- | ---: | --- |
| Cache | on | 256 | `9f5e04bfb6b1b6b419b137f72697c372e1a084393071b698980df9267fe3cc91` |
| Cache | off | 228 | `9e807ded900aac27a6f1b03387de212578aee9b5216570eb03e01384642c4781` |
| Original packed field | on | 217 | `b8324bd4644eb64c222aeadb5cc571a86b0997a995d767e69fd65dcda603cdb7` |
| Original packed field | off | 201 | `d39f121c06020a4eb51469b176d8822f49968335cfe48c172ebabfe246cecd6c` |

The original packed-field class is investigation evidence only and is explicitly
excluded from the recommended next unit. No VICE run or new acceptance is claimed.
Task/progress counts remain26/40; full baseline remains2688compiler passes/13known
frontier failures/two skips, not newly rerun full verification. Final fresh build/
repeat-probe/durable/source/oracle/link guards and owned scratch cleanup follow
before the direct scope question. No GREEN commit/push or public-size promotion.

Final proposal checks pass: fresh build0.45s, four exact repeated actual probes1.01s
and exact repeated identity/chain queries0.56s. Every before/repeated record matches,
including actual symbolic/final source/store anchors and source-load-origin absence.
Prior19-source identity,11oracle hashes, frozen/portfolio/link/checklist/whitespace
guards pass; both proposed files are absent. No production/test edit or VICE run.
Three affected tasks remain blocked for direct AR-P48 approval; total40/verified26
and parent38/48/v4four-ten counts are unchanged. No root/full verification is newly
claimed. Execution Plan Updated:yes; after recording these durable results, remove
only owned complement-observer-17im4lys scripts/logs/probe JSON/ASM/PRGs before the
scope question. No temporary artifact needs to outlive this investigation.

The user then selects **“Approve scope (Recommended)”** on2026-10-21 for exactly
AR-P48's three paths and620/640/586line ceilings before any new file or admission.
The ruling is recorded and tasks unblocked before new RED tests. Existing byte
pair, producers, fixtures, all old tests and specification oracles stay unchanged.
No full-task or progress promotion; task15 remains the current partial owner.

Two meaningful bounds-on/off cache admission REDs precede production, with21old
byte-window controls passing. Implement only the new focused cache proof and main
dispatch. Require sealed source membership, exact immediate stores/Original loop,
explicit whole-function private occupancy, actual binding, one setup, source-block
bounds chains, reference capture/store anchors and exact unchanged remainder.
Check actual writes and A/N/Z continuations; no instruction coverage or producer
amendment. Implementation is written, not verified; ordinary formatting, strict
typing, readable scope fit and discriminating tests are due before any clearance.

The first normal-format draft exceeds the620line ceiling; local readable
simplification removes transient tuple wrappers/duplicate comparisons and uses
existing StorageRange values and set/clear flag destinations. No old helper or
check changes. Final proof620/main568, initial two admissions, build2.18s and
strict root1.11s pass before broader negatives. The first31case negative run has
29passes/two failures: repeated initialization reuses the same instruction object,
so filtering by object identity incorrectly hides both occurrences. Match only
the final three actual preheader positions instead. The new raw-barrier draft put
POKE inside the owning function, which correctly prevents any cache selection;
that is a generic source program, not a cache-admission negative. Move only this
new test's prefix to the ordinary caller so the genuine cache obligation remains
and no raw composition is admitted. Retain both rejection expectations and every
old test/oracle; no producer/fixture changes. Corrections implemented, awaiting
normal-format/strict/regression verification and independent reviews.

Final local first checks: proof620/test535/main568, build2.31s/strict test root1.29s
and52focused cases (31new/21old) pass. First base review then reports MAJOR RV-001:
the reference omission/allowed-write maps still key by instruction object rather
than occurrence, so repeating the final capture STA object can be hidden twice.
AR-P49 records the necessary in-scope correction and pauses tasks before code/test
fixes. The review witness is inspection-derived, not yet parent-executed; no
public bypass is claimed. Complete direct/full/native/identity checks are not
claimed. The SFA/platform first reviews remain active. Platform first requests
active router/dispatch instructions omitted from its allowlist; parent supplies
authorized task-relevant excerpts and current release metadata without hidden
reads, denied-read retries, qualification maps or review waiver. That is still
the first substantive platform review. No task/phase/public-size/commit promotion.

Parent reproduces RV-001 in owned scratch with both bounds settings. Take the
last exact source store's symbolic reload operand as its real reference capture;
reuse that same actual STA-capture instruction object immediately before its
reload in both reference symbolic/final bodies. Focused complement proof returns
null; outer atomic proof returns error, as provenance must. Bounds-on original
capture is in body.bounds.0.0.pass at instruction12, repeated in the final pass
at16. Bounds-off original body instruction15 repeats at32. These labels/indices
describe the actual witness only; no label spelling selects the proposed fix.
No public bypass or runtime corruption is claimed from this host-only probe.

The current ordinary selected images still match both original256/228-byte PRGs
and hashes exactly. Running saved pre-unit observer versus current observer over
each same genuine tuple changes rejected→complete and leaves actual program,
requests, homes, certificate and layout contents unchanged. Request JSON SHA:
`4ae2712e1dd31c24c33b0d81af1e505c687ab0341f3cd44d4089f3cbabd75fcc`.
Bounds-on/off home JSON SHAs:
`b80b6cf3ffde57555c7e4953117725643376d05f5ba1cea9765243c79b830b29` /
`f04db2c99845cf671c5a8eedf597b6ae6035a9fa5ba59064a658adb34692a3fc`.
These images are unchanged-emission evidence, not acceptance clearance for the
new proof. Native script preparation is scratch-only and is not executed while
the major is unresolved. First SFA review reports no separate findings within
its assigned storage/ABI endpoint; it does not clear the base occurrence defect.

Recommended AR-P49 fix stays in the approved new proof/test paths: use occurrence
keys for omissions, replacements, allowed writes and typed-store envelopes; retain
source-operation object identity only as the exact immutable source association.
Add the same-object reference-store regression. Keep all existing files and
620/640/586ceilings; stop if complete readable fit needs more authority. Direct
user ruling precedes either new test or correction, then one bounded fix review
and reverification are mandatory. No task/progress/phase/public-size promotion.

Before the ruling, exact three-path reconstruction/eleven oracle/frozen/portfolio/
line-ceiling/source-doc/link/checklist/whitespace guards pass. The first scope
comparison fails because its expected string omits Prettier's array/return wrapping;
the explicit bounded diff confirms only the approved import, complement-row
removal and final composition. The corrected exact comparison passes; no source
edit is made to satisfy the guard. Replacing only saved main reconstructs the
prior19-source identity exactly, so existing byte/Boolean/tests/fixtures remain
unchanged. Current21-source identity:
`cb5032d79be0c18603d298c2c99d8a584719b72ab1502a62da1d7384b166538e`.

The cache source SHA is
`b721812cfd71332c004da3d7834093f333c5e707768b772f8bcecbc548911c6c`.
Bounds-on/off assembly SHAs are
`503daa5db433c282f614f46096437dd7505e039ba0cb514f9c7ee08f525a5b8d` /
`e3e1b55b5fa2ec273732d9c95cdf168fbf4e053eded46714aa0d8a4c5d0ba2bc`.
Both actual certificates report6RAM/3ZP static bytes and2program/0system/2total
bounded hardware-stack bytes. Those certificate fields exclude global/platform
ownership; they are not complete963/725cost vectors or runtime proof. Selected
PRG identity and zero mutation through either observer are verified only for the
two genuine input tuples, not the invalid repeated-store witness.

No full suite or native probe is newly run while the MAJOR is unresolved. Earlier
complete result remains2688compiler passes/13known frontier failures/two existing
skips, root not reached. New31/old21focused cases and strict/build results do not
override RV-001. All pending proof/final-phase/public-size/FO-SF-002 gates remain.
Only owned cache-complement-proof-gj7s9m14 may be removed after durable review and
scope evidence is recorded; it contains baseline copies, test logs, scratch host
reproduction, image comparisons and prepared-but-unexecuted native scripts. No
user/other-session artifact is disposable and no temporary evidence needs to
outlive this ruling boundary. No commit, push or task promotion occurs.

All first reviews complete before changing their inspected snapshot. Base RV-001
and platform TP-001 merge as CC-RV-001, one occurrence-identity root cause; platform
adds a same-object removed-EOR/byte-return witness. SFA has no separate findings,
not whole-unit clearance. AR-P49's initial user-owned pause was unnecessary:
project PRIME DIRECTIVE4 assigns deterministic compiler-owned decisions to the
agent inside approved scope. AI selects the recommended exact occurrence fix
under that standing directive, not a new user ruling or historical auto-design.
Ledger records accepted-for-fix, never waived/fixed/cleared yet. The exact AR-P48
paths/ceilings, all old tests/fixtures/producers and reserved scope/oracle gates
remain binding. Unblock before new regression and correction, then obtain one
base/platform fix review; if readable fit needs more scope, stop explicitly.

Two new occurrence regressions produce meaningful focused-null REDs before the
fix, with genuine byte-return admission controls passing. Both regressions run
bounds on/off after correction: a repeated final-reference capture store and a
repeated removed EOR at the actual byte-return exit. New test606lines fits640.
Implement block/index occurrence keys for omitted instructions, replacements,
permitted writes and typed-store envelopes; exact source-operation associations
remain immutable objects. The fix changes only the approved proof and additive
new tests, not main/producer/fixture/old tests. Implemented, pending normal-format
fit, strict tests, one base/platform fix review and complete reverification.

Occurrence fix formats at619proof/606test/main568lines without changing ceilings.
Replace the equivalent single-byte validRange wrapper with explicit safe-integer
and unchanged admitted-RAM checks; simplify optional data-ID lookup and the trivial
point key expression. No guard or old helper is removed. Build2.37s/strict1.18s
pass. Both new occurrence cases now reject and their byte-return controls pass.
The first54case run has53passes/one diagnostic-order mismatch: positional allowed
writes now reject duplicate initialization earlier as an intervening write rather
than later unchanged-code mismatch. Update only that newly authored private reason
expectation, preserving rejection and every source/value/cost assertion. This is
not an old or specification oracle edit. Final directed GREEN/fix review remains due.

The corrected33new/21oldfocused54cases pass in11.35s. One bounded base/platform
fix round independently clears the occurrence defect with no findings; no third
pass or whole-unit/phase acceptance is inferred. Ledger CC-RV-001 is fixed at that
bounded endpoint, while FO-SF-002 remains open for final phase review. Proof619/
test606/main568remain within exact AR-P48 ceilings; existing helpers/producers/
fixtures/old tests unchanged. Full fresh install/build/typecheck/direct/full suite
and final none/oracle/source compatibility guards follow before local clearance.

Fresh actual image/resource comparison0.76s matches both original selected256/
228-byte PRGs, original source/assembly/request/home hashes and zero mutation of
the genuine tuple through pre-fix/current proof evaluation. Fourteen sequential
pinned PAL/6581 native cases pass14.62s: source byte values0/1/127/128/255/85/170with
bounds on/off. Independent complement values in every output byte and cache,
unchanged source, one source read/one cache initialization/eight cache reads/eight
ordered source stores, SP, represented P and SYS return all pass. Complete-window
event comparison uses existing monitor semantics; no helper edit or failed native
expectation. Native JSON SHA
`d7502cfed4ddfdb8629b52f0be9caaa1346053fd3a6bfb62cc1515aab77fe259`.
VICE-verified / hardware-unverified, PAL/6581 only, seven machine input values not
all256/four profiles/observable timing/original963/725qualification. The invalid
duplicate-store/EOR tuples are host proof counterexamples, not native/public
miscompile evidence. No task count, public-size, phase, commit or push promotion.

**Final cache-complement checkpoint —2026-10-21:** frozen install0.34s/build1.93s/
typecheck0.70s/strict owned roots0.98s pass. Directed1090cases/81files157.64s pass.
Full yarn test267.28s:2721compiler passes/13known input-size-frontier failures/two
existing skips across175files. Every failure still reports incomplete public size
candidate selection. CLI62/language-server21/VSCode6pass; root is not reached. No
new regression, full GREEN checkpoint or automatic commit/push is claimed.

The cache-only subunit and occurrence correction are locally verified, not whole
task15. Three first bounded review lenses complete; base/platform's shared major
is corrected with meaningful RED→GREEN and one fix round, SFA has no separate
findings, FO-SF-002 stays open. Seven original none artifact identities/empty
diagnostics,45import boundaries,11oracle hashes, source-doc/format/frozen/portfolio/
ceiling/link/whitespace guards pass. Existing byte-window helpers, all producers,
fixtures, old tests and oracles are unchanged. Main has only the exact AR-P48 import,
one blanket-row removal and final composition. Restoring two pre-fix new files
reconstructs21-source cb5032d7exactly; removing the two new files and restoring only
the saved main form reconstructs the earlier19-source identity b93676f2exactly.
Current21-source identity:
`b9c019228023905bae2ecd4f2dc2209df99b597806a171f403db269ec2be522a`.
The only amended new diagnostic expectation preserves rejection at the earlier
write check; the prior535line test content otherwise reconstructs exactly after
removing the two additive occurrence cases. Final619/606/568fit620/640/586.

Observational host probes through the unchanged fixture admit32/64cache sites:
construction829.4/1256.0ms, observer248.5/488.4ms, total1077.9/1744.4ms; process RSS
116256768/154726400bytes. These run sequentially in one process while the separate
full checkpoint runs, so they are not isolated benchmarks, linear-complexity proof,
new wall-clock gates or public size constructor qualification. No new host tool,
framework or source restriction. The raw repeated-site source is qualification
only, not a workaround for the unchanged ordinary input programs.

Fresh read-only investigation of the next actual original-member source confirms
the separate proof gap in both bounds modes. Both residual outcomes close one
borrow and one Original loop. Canonical entry forms its packed field+2 through
the actual two-byte parameter and retains a typed-indirect source-load identity;
selected entry retains that exact operation on an absolute typed-fixed load, then
the same EOR255/inverse-local store. Canonical body LDAinverse/EOR255/STArhsCapture,
LDAmask/ANDrhsCapture/STAresult becomes LDAmask/ANDoriginalField/STAresult. Actual
selected inventory removes the reference parameter pair and RHS capture; it does
not invent backing. Typed source-field and result-store identities survive, while
the unary/inverse load remain their sealed recipe/source obligations. Current
cache-only observer correctly rejects this unsupported class. No original-member
admission, new file, old-test amendment or producer change is made.

AR-P50 records the next material ownership/outcome boundary before implementation:
cache proof619/test606lack capacity, original-kind is explicitly excluded by its
approval, and the current combined original/preserved-left test protects rejection.
Independently close the smallest owner/routing/reuse and exact single-row migration
packet before asking for new authority. Tasks15/17and final test concern are marked
blocked;40total/26verified and parent38/48/v4four-ten remain. No native original-member
or963/725result is claimed. Current cache evidence stays preserved during scope work.

The second/final blind challenge recommends a focused Original-field proof/test
pair plus existing complement dispatch and exact single-row migration. It first
requests missing actual caller evidence; four fresh global/private/bounds-on/off
constructions close that gap without new instrumentation. Source-call operation
at its recorded block/position, evaluated place-address root, original source-block
mapping and exact actual JSR target/source-call association all match. The actual
reference four-instruction pointer delivery is absent selected; private object
initialization remains and must not be erased with it.

| Root/bounds | Actual complete reference→selected backing | Reference parameter home | Actual call occurrence, reference→selected |
| --- | --- | --- | --- |
| Global/on | 2297–2299→2264–2266 | 2314–2315 RAM | entry4→entry0 |
| Global/off | 2281–2283→2248–2250 | 2298–2299 RAM | entry4→entry0 |
| Caller-local/on | 2901–2903→2868–2870 | 2908–2909 RAM | entry9→entry5 |
| Caller-local/off | 2885–2887→2852–2854 | 2892–2893 RAM | entry9→entry5 |

Global caller symbolic low/high loads name the actual resident root. Private caller
symbolic immediate storage addressByte loads bind to85/11and69/11respectively,
encoding the two actual reference roots, not selected/provisional addresses.
Both forms write the actual formal binding's two-byte home and JSR the actual
callee. Parameter requests are absent selected. All five reference delivery/call
instructions retain exact call.sourceSpan object association; selected calls do
too. The private variant moves the same named Cell declaration into main; existing
borrow and Original induction still pass, no global-only workaround required.
These numeric addresses describe evidence only; no code may hardcode them or assume
the observed33byte shift. No Original native or changed acceptance is claimed.

Final AR-P50 packet: new services/size-observer-complement-fields.ts/test at700
ceilings; existing complement dispatcher only, with explicit620→650ceiling; old
combined-test Original source rejected→complete migration only, existing test640
ceiling unchanged. Cache helpers, backing/borrow/effects/main/byte/producer/fixture/
schema/dependency/spec oracles untouched. Preserve cached preserved-left rejection
and every other source/assertion/outcome in the current33case file. The verdict is Justified; actual
caller associations suffice without new producer metadata, complete readable fit
remains Unknown until implementation. Direct approval is pending before edits.
No more challenger spawn in this run; any later material expansion stays blocked.

The execution plan and owning/keyboard summaries retain26/40, parent38/48 andv4
four/ten, with tasks15/17/1.3.3blocked only for the exact next-scope decision. Cache
qualified source identity b9c01922and all other evidence remain current. After final
scope/source/oracle/link/checklist/whitespace guards, remove only owned
cache-occurrence-fix-znvb2vh5 logs, baseline copies, artifact/native scripts/images,
none project, host probes and Original/caller inspection records. No user/history/
other-session file is disposable; no temporary evidence needs to outlive this
scope question. No commit/push, public-size or final-phase promotion occurs.

Final ruling-boundary guards pass: current21-source b9c01922, all11oracle hashes,
both Original proposed files absent, four actual caller probes,14native cache
records, exact13full-failure identities, fixed CC-RV-001/only AR-P50open,26/40and
14remaining task counts, frozen/portfolio/link/whitespace checks. Every agent and
verification process has completed. Execution Plan Updated:yes. Cleanup:done—only
owned cache-occurrence-fix-znvb2vh5 is removed after durable recording. The prior
owned complement-observer-17im4lys and cache-complement-proof-gj7s9m14 were already
removed at their recorded boundaries. No temporary artifact outlives this scope
question. Cache locally verified; Original-field admission remains unimplemented.

The user subsequently selects **“Approve scope (Recommended)”** on2026-10-21 for
exactly AR-P50's four paths, the one Original-source rejected→complete migration
and650/700/700/640ceilings. Record and unblock before new files/routing/test edits.
No other helper/producer/fixture/oracle authority or additional challenger spawn
is granted. New admission RED precedes implementation; progress remains26/40.

The exact Original-source migration produces two meaningful admission REDs before
production, with all33cache controls passing. New bounded field proof and existing
class dispatch are written: independent named backing and actual binding, exact
field-pointer/inverse/RHS windows, occurrence-based permitted changes, pointer
overwrite-before-read, actual call/argument delivery and call-entry state. Cache
helpers stay unchanged; their zero-effects guard moves only into cache dispatch.
Implementation is not verified: normal-format/700fit, strict typing, real positive
admission, negative tests and independent review are due before any clearance.

AR-P50 first normal formatting returns878new-proof/21new-test/626dispatcher/
602cache-test lines. The field proof exceeds its explicitly approved700ceiling;
AR-P51 immediately blocks affected tasks before build/type/admission verification
or further implementation. Preserve the draft and exact migration; do not compress
checks, delete obligations, export helpers or add a file silently. The existing
second/final Original ownership challenge may assess this actual sizing evidence,
but no third challenger spawn or role/budget bypass is authorized. No new fit,
source/ABI/window/native/public-size or phase clearance is claimed.

The existing Original ownership challenge revisits its measured Unknown sizing
factor and returns Justified for one focused unqualified layout leaf; no third
spawn or unrelated review. Its exact235line inventory is Shared/key/ram/edge/side/
Side/bound/body/Body/Item/direct/immediate/storage/request/scalar/unchanged. Only
necessary import/export/type placement/JSDoc changes; first compare all bodies,
predicates/operands/keys/return shapes unchanged. Effects/occupied/field/continuation/
stream/pointerDead/entrySafe/writes/validateFieldComplements stay in field owner.
New leaf proposed size-observer-complement-field-layout.ts has400ceiling, estimated
330–370; original owner estimated650–665and keeps700ceiling. Qualified cache helpers,
main, backing, producers, fixtures and oracles do not move/change. Caller extraction
alone removes159lines and cannotfit700; no complete four-path simplification
removing178lines is demonstrated. The unqualified878draft remains preserved and
not source/ABI/admission verified. AR-P51 exact scope awaits direct approval before
any new file/helper move/export or resumed implementation.

A read-only build observation of the blocked draft finds two local TypeScript
errors: dispatcher Set.has receives an unnecessarily widened string and the new
field owner imports unused SemanticFunction. Correct only those already-approved
typing sites under the project's compiler-owned correction rule, without creating
the gated leaf, moving helpers or continuing Original-proof feature work. The
dispatcher predicate is equivalent; no helper body or rejection guard is weakened.
Normal formatting still measures878field lines and exceeds700. Rebuild3.18s and
all33cache controls9.73s pass solely to establish current tree typing/cache health,
not proof fit or Original admission clearance. No new leaf or helper move exists;
the capacity decision remains blocked for AR-P51. A full or native verification
of this unqualified draft is not claimed.

Final AR-P51 question-boundary guards pass: exact four approved paths only,
qualified cache helper bodies unchanged, exact one Original source/outcome migration
and cached-preserved-left rejection retained, prior21-source b9c01922reconstructed
by restoring only the two approved existing owners. All11oracle hashes, frozen/
portfolio/link/checklist/whitespace checks pass; proposed layout leaf is absent.
Current23-source UNVERIFIED identity:
`eda0ee8cd2c320511042d274ce992be8845e75afda8cdd3d2b05bac31016e86c`.
Build3.18s and33cache controls pass after two local typing corrections, but the
878line draft has no Original admission, ABI/state/control or native clearance.
Field tests remain21lines/two initial admission RED cases, not complete coverage.
No full checkpoint is rerun or task promoted;26/40and14remaining stay unchanged.

After durable recording, delete only owned original-field-proof-okdkcn9_ baseline
copies/logs/identity records; no user/history/other-session artifacts. The unverified
implementation and approved row migration remain intact for the direct capacity
decision. Execution Plan Updated:yes. Cleanup of that owned scratch is performed
before the question; no temp evidence needs to outlive it. No commit or push.

The user selects **“Approve split (Recommended)”** on2026-10-22 for exactly
AR-P51's one leaf and unchanged helper/type inventory,400line leaf ceiling and
unchanged650/700/700/640remaining ceilings. Record/unblock before the new file or
move. Mechanical comparison precedes admission/type/build checks. No further
scope, producer/fixture/oracle change or task promotion; progress remains26/40.

Implement only AR-P51's exact unqualified helper/type move and required imports/
exports/JSDoc. Existing qualified cache helpers/main/backing/producers remain
untouched. Field-specific logic and helper bodies are not corrected during the
move. Implemented, awaiting normal formatting, AST body/type comparison and
build/type/admission verification; relocation alone grants no correctness claim.

Mechanical move formats320leaf/649field lines. Exact16moved/9retained declaration
signatures/bodies/types compare formatter-equivalent; export set exact and leaf
has no parent import. Initial scratch comparator assumes TypeScript's removed JS
compiler API; installed7.0.2exposes version only. Replace only that scratch check
with exact declaration extraction and the already installed Prettier, no new
dependency/compiler. Build3.11s/strict roots1.54s pass,33cache controls pass; both
new Original admissions remain RED. Global/private bounds-on/off host probes all
reject the final combined write/remainder gate. Split only that new core diagnostic
into its three unchanged checks before diagnosis; no predicate or guard removal.

The first remaining admission failure is a write-only query demanding pointee
envelopes from a known read-only field LDA. Restrict only that private write check
to official NMOS data writers; stack/control writes are page-one-only and every
watched extent excludes page one. All read/fetch/indirect/dummy checks remain the
atomic owner's obligation, no instruction coverage is granted. Both named-root
classes and both bounds settings then close in host probes. No leaf body changes.

New field tests format448lines, field653; strict2.31s passes. First60case run has
58passes/two failures. A real missing-reference-opcode guard allows ORA in place
of the typed field LDA; add exact LDA/indirect-indexed-Y checks. The private wrong
address-byte test already rejects at caller ownership/binding, so correct only its
new private reason hint, preserving rejection. No old oracle/assertion change.
Corrections implemented, pending directed GREEN and independent review.

Expanded tests format588lines/field655/leaf320, build2.73s and strict1.47s pass.
The69case run has67passes/two offset-zero draft-source failures: its reordered
declaration still uses the old struct literal order, so E10097 precedes the proof.
Correct only that new derived fixture's literal order, preserving values/offset/
admission expectation and the exact migrated FIELD_SOURCE. Other added failures
exercise pointer overwrite-before-read, entry carry/overflow, private initialization,
reused EOR occurrence and actual stable-field writes. No old-test/fixture edit.

The corrected offset-zero source now reaches a meaningful unsupported-template
RED. Actual canonical entry copies both formal pointer bytes then LDY0/LDA(pointer),Y
without the nonzero displacement's ADC carry chain. Add only that exact five-prefix
form, retaining the existing eight-prefix form and every direct-field/inverse/
state/private-pointer check. No numeric layout constant, helper body or source
restriction is introduced. The two template forms remain independently testable.

Current field670/test588/leaf320/dispatcher626/cache-test602fit all approved
ceilings. Build3.27s/strict owned roots1.73s and69focused cases (36new/33cache)
pass22.30s. First base/SFA reviews report no findings in their bounded static lenses;
platform review remains active. None grants full task/phase/public-size clearance.

Six actual ACME inputs (global/private roots, plus packed offset-zero global,
bounds on/off) serialize and assemble in2.15s. Original global offset-two217/201
PRGs match their pre-unit SHA-256 exactly. Fifty-four sequential pinned PAL/6581
native cases pass64.13s, using field/mask pairs0/255,255/255,127/128,128/255,255/128,
85/170,170/85,3/1and1/3per input. Independent AND answers in all four outputs,
unchanged field and nonuniform AABBpadding, inverse value, exact five field reads/
four mask reads/one inverse write/four ordered result writes, SP, represented P
and SYS return all pass. Native JSON SHA
`8c52705ee1033051315efc9b9f0e738b643799ddc5d98ac8c86f498bfea6a196`.
VICE-verified / hardware-unverified, PAL/6581 only; no exhaustive byte grid,
four-profile/timing/full963/725or universal external-firmware claim. Complete
install/build/typecheck/direct/full and source/oracle/none guards remain due.

First platform review reports MAJOR TP-001: the reference AND's storage ID/offset
is checked but not its actual mode/addressByte form. A bound immediate low-address
AND may be mistaken for a capture read. Merge as FF-TP-001, accepted for exact
in-scope correction under project PRIME DIRECTIVE4, never waived. Base/SFA no
findings do not clear it. Record AR-P52 before reproduction/fix: existing direct()
reference check plus one additive immediate-AND negative, no leaf/producers/
fixtures/oracle or scope change. The active complete checkpoint keeps its snapshot
frozen until completion; scratch reproduction may proceed. One platform fix review
and fresh affected/full checks follow correction. Current69/54results are bounded
support, not complete proof/phase acceptance.

Frozen pre-fix checkpoint completes: install0.36s/build0.38s/typecheck0.77s/
strict1.23s pass;1126directed/82files241.15s pass. Full400.21s yields2757compiler
passes/13known frontier failures/two existing skips; CLI62/LS21/VSCode6pass, root
not reached. These do not clear FF-TP-001 and are not post-fix verification.

Scratch reproduction confirms focused null/outer error with both bounds modes.
The first mask5 example coincidentally yields the same value for actual capture
low bytes13/253; retain that limitation, then use a new derived mask255source.
Reference immediate results13/253 differ from defined AND-with-captured7 result7.
The actual bound immediate form passes the old focused proof, establishing the
missing value-access check without claiming public/native miscompilation. Add
the new immediate-AND regression before correcting production; exact migrated
FIELD_SOURCE and all old assertions stay unchanged. Source snapshot is now free
to change after the completed frozen run. One platform fix review remains due.

Both new immediate reference-AND cases fail meaningfully on focused null before
production correction. Add only the existing direct() check for the reference
AND against that side's real RHS capture home. This closes actual addressing-mode/
addressByte data consumption, not merely identity. No leaf/producer/fixture/old
oracle change. Implemented, pending normal-format/type/directed GREEN, one bounded
platform fix review, exact artifact/native repeat and fresh complete verification.

Reference-AND fix formats671field/626testlines. Build2.26s/strict1.18s and71focused
cases pass14.99s. One bounded platform fix review clears FF-TP-001 with no surviving
findings; no third pass or broad phase clearance. A malformed non-semantic suffix
in the first fix packet is explicitly withdrawn and replaced with the exact one-
line diff/regression/evidence supplement; no protected or qualification content
was involved and the reviewer counts it as the same fix review.

Post-fix six-image/source/assembly/PRG/request/home/resource records compare exact
to the pre-fix genuine records. Fresh54sequential PAL/6581 cases pass60.85s with
the same independent values/padding/event order-count/SP/P/SYS assertions and
identical native JSON SHA8c52705e. No target cost or storage changes. Ledger marks
only the bounded addressing finding fixed; FO-SF-002 and full-task/phase/public-
size gates remain open. Fresh complete post-fix checkpoint follows.

**Final Original-field checkpoint —2026-10-22:** post-fix frozen install0.37s/
build0.38s/typecheck0.84s/strict owned roots1.49s pass. Directed1128cases/82files
pass178.84s. Full yarn test269.28s yields2759compiler passes/13known frontier
failures/two existing skips across176files. All13failures remain in
src/services/input-size-frontier.spec.test.ts at unfinished public size candidate
selection. CLI62/language-server21/VSCode6pass; root suite is not reached. The
initial pre-fix full run and the post-fix run are separately recorded; only this
later snapshot is current. No whole-task, phase or963/725qualification follows.

The user requests **“commit and push all thenlet me compact then let me know what
is next.”** This authorizes push for the requested coherent checkpoint and a pause
after handoff. It does not waive the repository's green-only commit rule or the
guarded commit skill's failing-verification stop. No staging, commit, rebase or
push is performed. The historical one-time RED backup exception is not reused.
All accumulated changes remain preserved and uncommitted on feature/v4-rebuild.

Original-field proof is locally verified at the explicitly bounded endpoint:
38new/33cache focused cases,54sequential PAL/6581 native cases, independent source
values/access order-count/padding/SP/P/SYS, and three bounded first review lenses
plus one platform fix review. FF-TP-001 is fixed; FO-SF-002 remains open for final
six-lens phase review. Native is VICE-verified / hardware-unverified; no exhaustive
grid/four-profile/timing/external-firmware/whole-program cost proof is inferred.
Expert2.0.4active qualified/frozen, content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15.

All six pre/post-fix source/assembly/PRG/request/home/resource records match. The
original global217/201images additionally match the pre-unit recorded hashes;
private and offset-zero images are current-unit evidence, not pre-unit attestations.

| Field witness | Bounds | PRG bytes / SHA-256 | Certificate RAM/ZP; program stack |
| --- | --- | --- | --- |
| Global, offset2 | on | 217 / `b8324bd4644eb64c222aeadb5cc571a86b0997a995d767e69fd65dcda603cdb7` | 6/2;2 |
| Global, offset2 | off | 201 / `d39f121c06020a4eb51469b176d8822f49968335cfe48c172ebabfe246cecd6c` | 6/2;2 |
| Caller-private, offset2 | on | 766 / `46f20e9efd33e03065bef62d9672bb589318877539efb2c914dfd0fcc09e181f` | 9/2;2 |
| Caller-private, offset2 | off | 750 / `6f04426cf7c401ce7662f7a9f7fc6680cf5f88d7b055b0a6699dcda86d2cc136` | 9/2;2 |
| Global, offset0 | on | 217 / `195bda0f25a75f10fa4c5a6f167b2e286f7fe09209f6c85880aca4f572a3e305` | 6/2;2 |
| Global, offset0 | off | 201 / `5d6506970795ef745126bae9c8a913126db281fb3b0047cae64778d373ce1dcb` | 6/2;2 |

Certificate storage fields exclude global/platform ownership; these are not the
complete original input cost vectors. Observer-only work changes no target bytes
or storage demand. The6byte/8nominal-cycle LDA/AND pair is only a local instruction
window, not a whole-path or expert-program win. Existing parity debt remains owned.

Final scope/oracle guards pass: exact AR-P50 five-path unit after AR-P51 leaf
addition, unchanged qualified cache helpers, one exact Original-source/outcome
migration and preserved cached-left/other assertions. Reversing only that declared
dispatcher/test migration and omitting the three added owners reconstructs the
prior21-source b9c01922identity. All16relocated declarations still compare unchanged;
leaf has no parent import. The final one-line reference-AND fix and two-row additive
regression reconstruct their saved pre-fix files exactly. Final owner/test/leaf/
dispatcher/cache-test sizes671/626/320/626/602fit700/700/400/650/640ceilings.
Current24-source sortedpath/fileSHAcompactJSON identity:
`9f2ee4aafa59c69a5eb0715441d6f50c0596637ad8ef3fc68d3a65e57531e72f`.
Seven original none artifacts/empty diagnostics,45import boundaries, all11oracle
hashes, frozen/portfolio/source-doc/format/whitespace guards pass. Native JSON SHA:
`8c52705ee1033051315efc9b9f0e738b643799ddc5d98ac8c86f498bfea6a196`.

### Paused compaction handoff —2026-10-22

- Authoritative progress remains26/40; task1.2.15partial, six implementation and
  eight hardening/qualification tasks remain. Keyboard38/48; v4four/ten unchanged.
- AR-P1–AR-P52resolved; no pending scope question. Exact approved helper inventory,
  paths, ceilings and test exceptions remain binding; generic continuation adds none.
- Resume1.2.15: next examine the still-rejected native-store/counter/expanded
  families and their actual source/physical state premises. Wider/mixed complement,
  aggregate/reference-rejected, raw/status/MMIO/platform and asynchronous closure
  still need their complete proofs. Existing source/native evidence does not clear
  those boundaries. No new unapproved file or old-outcome change is authorized.
- Then1.2.16startup,1.2.17finite candidate construction,1.2.18closed costs,
  1.2.19debug and1.2.20original full qualification; all1.3hardening/review gates follow.
- Keep none|size,37attempts,963/725and every full resource/behavior bound unchanged.
  Public size still returns COMPILER_INCOMPLETE for candidate selection.
- User-requested commit/push remains unperformed because full verification is RED.
  Complete required work to a coherent GREEN checkpoint before using that authority;
  later pushes are not automatically authorized. No history or index changed here.
- All agents and verification processes have completed. Remove only owned
  field-layout-move-zxtlzb91 after final durable guards; it contains saved drafts,
  logs, scratch probes/ASM/PRGs/native records and none project. No user/other-session
  evidence is disposable. No temporary artifact needs to survive the pause.

Execution Plan Updated:yes. Stop further implementation after recording final
guards and cleanup so the user can compact at this verified subunit boundary.

Final handoff guards pass: current24-source9f2ee4aa, all11oracles,54native records,
six exact pre/post-fix image/resource records,1128directed/current13known full
failure identities,52resolved decisions,26/40checklist/14remaining, links, frozen/
portfolio, unchanged empty Git index and whitespace. Cleanup:done—only owned
field-layout-move-zxtlzb91 is removed after durable evidence recording. All agents
and verification processes are complete. No staging, commit or push; preserved
worktree is paused for user compaction, with the failing full checkpoint explicit.

### Selected-loop continuation —2026-10-23

The user says **“proceed”** after the26/40handoff. This is a fresh bounded
continuation after the completed complement run, not a reset of that run's two
challenger uses or its exhausted review rounds. Existing frozen authority,
strict scope, exact file/concern/ceiling approvals and green-only commit/push
gates remain. No new auto-design flag or scope authority is inferred.

Required plan documents, all52resolved AR rows, passed preflight, original381case
RED gate and task14's named owners are confirmed. Feature/v4-rebuild is current;
the inherited dirty tree and empty index are preserved. FO-SF-002 remains accepted
for correction/final phase clearance, not waived or claimed clear. The latest
full-suite evidence remains2759compiler passes/13frontier failures/two skips;
12cases reach unfinished candidate construction and one rejects the approved
resource-rejected baseline contract. No fresh full-suite pass is claimed.

Fresh build0.49s/typecheck0.36s and124tests/four files19.10s pass. The focused files
are the Original-field/cache concerns and machine counter/expansion concerns.
All11recorded immutable oracle hashes match before investigation. A read-only
source/hash snapshot for23relevant existing files is held only in this run's
temporary directory; the original phase baseline remains unchanged.

Thirty actual source→reference/candidate constructions cover scalar accumulation,
typed indexing and native arithmetic stores, bounds on/off, and Original,
LowByte, XFirst, YFirst and FlatEightXFirst policies. All storage/layout closures
succeed. Six Original controls pass final observers. The other24reject at
`Conditional induction needs actual Original homes in both layouts`, earlier
than the main pending-window barrier. Native X/Y witnesses carry both one native
store and one counter; exact-eight indexing carries eight connected occurrences.
This establishes the next missing proof boundary, not a miscompile or acceptance.
The first temporary probe tried the absent TypeScript7JavaScript transpiler API;
it created no fixture/result. The corrected probe copies only the existing fixture
to owned scratch, rewrites its imports to freshly built dependencies and uses
Node22type stripping. No repository fixture, runner or source/test is modified.

AR-P53 owns the smallest readable selected-loop proof/test concern and exact
composition question. Current effects/main/loop-test sizes568/568/694and the
main's586ceiling prevent treating generic continuation as unbounded ownership.
Tasks15/17/1.3.3are visibly blocked pending the independently hardened scope
decision; progress remains26/40. No implementation, new repository file,
old-outcome amendment, staging, commit, push or native runtime follows.

The one independent challenge returns **Justified — focused pair, scalar LowByte
only**, with two new700line proof/test owners and existing effects/main608/586
ceilings. It excludes held X/Y, native-store, expansion, indexed/staged/escaping
reads, abrupt exits, raw/status/platform/async/callable and mixed selected windows.
The exact four-path packet, complete proof outline, tests, exclusions and conditional
fit are recorded in AR-P53 before presenting it. Existing tests/oracles and all
producers/fixtures/helpers stay unchanged; no new metadata or runtime is authorized.

The challenger cannot read the parent-owned probe JSON: native external_directory
permission is denied. No retry, alias/tool workaround or forwarding of the denied
raw file occurs. Its verdict covers ownership from permitted source review, not
successful admission or raw-evidence clearance. Parent's preceding permitted
30construction results remain primary-only evidence. A truncated completion is
recovered by the same context repeating its existing report with no new tools or
challenge pass. Historical routing smoke exposure is disclosed and excluded.

Fresh45import-boundary cases/three files pass2.29s. Document/source guards confirm
23relevant source/test files unchanged,159local file links, required plan artifacts,
53unique decisions,40unique tasks with26verified and visible blocker reasons, empty
index and unchanged frozen spec/expert/portfolio. Portfolio sync remains deferred
on feature/v4-rebuild. No complete phase, compiler-suite, native or cost pass is
claimed. Direct AR-P53 approval remains the next action; no task advances.

Final guards re-confirm all23source/test identities,159file links,26/40tasks,
53decisions with AR-P53pending, absent proposed new files and unchanged frozen
spec/expert/portfolio and empty index. Cleanup:done—only this continuation's owned
native-window-resume-ru9BltUi scratch is removed after the challenger completes.
No temporary evidence needs to survive the scope decision. No commit/push.

### User-approved strategist trial —2026-10-24

At12:26CEST the user answers **“I agree”** to the bounded project-specific
implementation-strategist trial. This authorizes one independent read-only
assessment of AR-P53 and necessary permitted primary-owned diagnostic probes.
It does not approve AR-P53 implementation, either proposed new source/test file,
an existing expectation amendment, a permanent agent, agent/routing/permission
edits, frozen-authority changes, commit or push. Tasks15/17/1.3.3remain blocked;
progress26/40 and keyboard38/48 do not change.

The existing native design-challenger carries the one-off assignment, explicitly
dispatched to available openai/gpt-6-astra#xhigh. This is the second/final fresh
challenger context of this AR-P53continuation; use only that context for factual
supplements, not another committee or reset of the earlier complement run.
No CodeOps/plugin/agent definition is changed. The root keeps implementation and
all executable probes; the advisor stays read-only and cannot delegate or run shell.

The trial must inspect actual current source, construct the smallest complete
proof path, attack its assumptions, identify the smallest decisive probes and
return Ready to implement/Needs evidence/Revise approach with one grounded
recommendation. Each required proof must name its actual available evidence and
consumer; file-fit estimates must include all checks/documentation and an explicit
reserve, not pretend to measure unwritten code. Missing producer identity or
inaccessible evidence stays Unknown, never inferred from names or status claims.

The old external_directorydenial remains binding. No new role, changed permissions,
relocated artifact or alternate tool may bypass it. The advisor is given ordinary
source allowlists and primary verification summaries, not the denied old JSON.
Any required new probe is run by the primary within its own native permissions;
results are identified as primary-owned, not independent execution/inspection.
No broad raw-artifact read or native/hardware/whole-input clearance is implied.

Entry guards confirm feature/v4-rebuild, empty index and clean frozen spec/expert,
existing native agent definitions, routing policy and integration-only portfolio.
The original phase baseline and all inherited dirty implementation work remain
preserved. Trial scratch is owned ar-p53-strategist-trial-BCKOlaf6 under the runtime
temporary root and is removed after durable result recording.

The initial strategist result is **Needs evidence**, not an implementation ruling.
It proposes finite actual control templates plus exact body correspondence, with
unstaged low-byte counter uses first. Its full outline estimates870production/
790test lines, exceeding the unapproved700/700proposal. These are independent
estimates, not measured code or authority for four new files. Three decisive
primary probes are requested in the same context before selecting any revision.

Fresh build0.45s/typecheck0.37s pass;22source/config/charter hashes are captured and
all11recorded oracle hashes match. Using only the unchanged existing fixture,
freshly built dependencies and Node22type stripping in owned scratch, the primary
closes36actual reference/LowByte pairs: bounds1/4/8, bounds-check on/off, three
scalar bodies, and caller suffix absent/present (`answer+=120`). This adds no
repository source/test, runner or production proof. Both producer associations
remain valid; all36still reject at the Original-only final induction guard.

The three bodies are sum (`answer+=byte(i)`), assignment (`answer=byte(i)`) and
local (`let small:byte=byte(i);answer+=small`). Every pair has exact ordered body
correspondence after resolving each actual certified storage operand independently
and substituting only original-counter-low→selected-counter-low. Body lengths
are6/6,2/2and8/8instructions respectively. No argument-stage request occurs in
either inventory. The three source counter reads are test/body/update; each body
read has one actual truncate consumer and exactly one selected null-stage record.
No source/value identity is inferred by parsing a generated request name.

At bound4/bounds-on/ordinary caller, both actual functions have exactly the five
source-associated entry/test/body/update/exit blocks, retained first test and
matching branch polarity. Reference initialization is LDA0/STA-low/LDA0/STA-high;
test is LDA-low/CMPbound/LDA-high/SBC0/BCC; update is the complete11instruction
word-add→two-byte temporary→counter copy. Candidate initialization is LDA0/STA-byte,
test LDA-byte/CMPbound/BCC and update INC-byte. The reference-only arithmetic
temporary is independently identified by actual symbolic operands: two stores
and two loads, all inside update. Its value field is not a semantic definition;
no general scalar capture certificate is assumed. The original word counter is
the other reference-only request; selected omission alone is not the full list.

Actual work-owned homes are disjoint. Reference sum arithmetic/counter/body-temp
homes are2203–2204/2205–2206/2207; candidate counter/body-temp2/2163. Assignment
reference arithmetic/counter2193–2194/2195–2196, candidate counter2. Local reference
arithmetic/counter/body-temp/local2209–2210/2211–2212/2213/2214, candidate2/2169/2170.
These are current probe facts, not required literal placement. Reported lifetimes
cover19/17/21positions with no crossed calls; symbolic operand scans find no use
of these requests outside their owner. Full alias, physical-write and lifetime
proof remains an implementation obligation, not inferred from those summaries.

Actual candidate continuation queries with empty void result obligations pass
body A|V, exit A|V and update/header A|N|Z|C|V for all12sum and12local cases. All12
assignment cases fail the cyclic V query, while A-only/exit queries pass; there
are no V reads in any test/body/update cycle. All36actual direct caller suffixes
pass A|V and full changed-register/arithmetic-flag continuation checks through
the real startup restore graph, with/without the extra scalar update. No void
result ABI row exists. These results distinguish a conservative cycle rejection
from a real read-before-write witness; no cycle-proof exception is implemented.

Primary summary SHA-256:
`b7a64a35421a178bf4e37705cbe13d31f21b207c3b845b1aa791e0c2619a3948`.
Primary detail SHA-256:
`cf71ac69ad287882d238c91116140fda00e30807801364b0544ffd6669957e77`.
These new diagnostic results answer the advisor's requested probes, not the denied
old artifact. The advisor receives bounded primary-run outcomes in its existing
context; no new external read, relocated file or independent execution claim.
The trial has not yet settled the complete proof budget or revised admission;
no native execution, artifact parity, task promotion, scope approval or new agent.

**Final strategist outcome:** Ready to implement—narrowed design only. The same
context recommends exactly the existing four-path proposal, revised to exactly
five source/symbolic/final blocks, direct unstaged unsigned-word→byte truncation
uses, complete reference/candidate control templates and ordered body correspondence,
both-layout demand/home/lifetime/interference closure, exhaustive operand plus
memory-effect use sets, and all existing state queries passing. Failed cyclic V
queries reject the tuple; no new alias walker, cycle exception, scalar interpreter
or producer certificate is introduced. Full startup D/I/SP and every actual caller
continuation remain explicit checks, not presumed dead merely because return isvoid.

The initially recommended extra production/test split is withdrawn after these
deciding probes. The complete narrowed estimates, including documentation and
75/95line reserve, are690production/680test. Existing effects/main changes are
estimated38/14lines, final606/582within608/586. These are honest planning estimates,
not measured fit or correctness; all four ceilings remain binding and no safety
check or comment may be removed to meet them. Actual observer/runtime/cost/public
size qualification and all final phase reviews remain due. AR-P53records the revised
exact packet and proof/budget tables; direct implementation approval is pending.

The final report's prefix is transport-truncated and recovered in the same context
by repeating only the missing verdict/admission rows, with no new tools/reasoning
pass. No fresh challenger beyond the two-context cap is spawned. The only new
evidence supplied is the primary's requested fresh probe summaries; the earlier
denied external artifact remains unread and is not relocated or forwarded.

Fresh final124focused cases/four files pass16.68s and45import-boundary cases/three
files pass2.16s. Build/typecheck previously passed0.45/0.37s on this unchanged source.
No compiler-suite rerun or new ACME/VICE execution is claimed for this read-only
trial. No CodeOps/native agent/routing/permission/plugin/global configuration,
compiler source/test, frozen authority, index or commit history changes. The user's
approval was the trial only; the next decision is its narrowed AR-P53scope, not
creation of another agent. Execution Plan Updated:yes;26/40tasks remain verified.

Final12:56CESTguards pass:22source/config/charter identities and all11oracles
unchanged;161local file links,40unique tasks/26verified and53decisions with
AR-P53pending; complete690/680and606/582budget arithmetic. Proposed source/test
files are absent; frozen spec/expert, existing agents/routing, portfolio, Git index
and history remain unchanged. Cleanup:done—only owned ar-p53-strategist-trial-BCKOlaf6
scratch is removed after both same-context report recoveries and durable recording.
No temporary artifact needs to survive. No staging, commit, push or compiler edit.

### Approved LowByte implementation entry —2026-10-24

The user directly answers the sole narrowed four-file implementation packet with
**“I do”**. At16:50CEST AR-P53is resolved and tasks15/17/1.3.3leave its scope block,
without promoting any verified task. Task15resumes its preserved partial state.
Only services/size-observer-selected-loops.ts and its adjacent implementation test,
plus existing effects/main wiring, are authorized; ceilings700/700/608/586remain.
No old assertion/source/oracle, producer/fixture/helper, agent/routing/permission or
public mode/cost contract changes. Original phase baseline remains unchanged.

Required plan/closed53AR/design-preflight/specification-first entry is rechecked;
the original381case RED gate precedes this implementation. Add a meaningful new
admission RED through the existing final observer before the new proof. Preserve
all prior byte/complement/binding/raw/startup guards. No broader tuple, public-size,
native, full-checkpoint or final phase qualification follows from local GREEN.

### LowByte draft capacity stop —2026-10-24

Entry captures the exact pre-unit effects/main bytes plus12relevant source/
producer/fixture/configuration identities and all11recorded oracle hashes under
owned ar-p53-lowbyte-fdVQe1OT scratch. New proof/test paths are absent before edits;
existing phase baseline and inherited dirty work stay untouched. Two bounds-on/off
admission tests are added first through the existing final observer. Both fail
meaningfully at the actual Original-only induction guard, after successful source,
canonical/selected storage and layout; no missing module or setup failure.

The first unqualified proof draft is written only in the approved new owner. It
does not change or wire existing effects/main. Normal Prettier formatting measures
780production/21test lines, exceeding the binding700production ceiling. Stop before
further implementation/wiring/compilation or any admission claim. AR-P54records
the measured-fit problem and allowed read-only simplification investigation.
No safety check/documentation may be dropped or formatting compressed to fit;
no additional file, producer, old test, ceiling or helper move is authorized.
Only the existing strategist context may assess the actual draft; the challenge
budget is not reset. Tasks15/17/1.3.3are visibly blocked,26/40unchanged.

The same-context measured-fit assessment retracts the690line estimate. Actual
sections are distinct obligations, not duplicated work: only20–35lines of genuine
simplification are supported; missing checks add70–120plus40reserve, giving a
single-owner855–920line planning range. Required work includes retained-home/
non-SFA interference, complete operand and memory-effect references, conditional
fallthrough geometry, terminator/header/update consumer and both-inventory stage
checks, actual caller/interior-entry coverage, explicit return observations and
correct architectural s naming. Reference update span identity still needs its
actual operation association; no span coincidence may be assumed.

Two primary diagnostics prevent another over-strong premise entering the revised
scope packet. Actual reference and selected SUM startup both use the existing
display-independent canonical constructor: PHP/PLA/save-P(offset0)/CLD and
normal PHA/PLP restoration, held0/transient1. This is not task16's held-P option;
requiring the legacy display-dependent A/X/Y snapshot would reject the actual
source. With explicit conservative return observations A/X/Y/N/Z/C/V, a proved
A|V difference mask passes both layouts and both caller suffix variants. An
all-seven difference mask fails all four; the trial's earlier all-seven success
had empty void return observations and did not prove this stronger endpoint.
Finite control/body proof must establish equal X/Y/N/Z/C, then check the actual
A|V differences against all conservative observers. Internal update/body checks
and ASSIGN's V-cycle rejection remain unchanged. No arbitrary void-flag liveness
assumption, constructor rewrite or source workaround is authorized.

The same strategist corrects both earlier premises and returns **Simplify** on
the precise next capacity decision: add one500line selected-loop-layout leaf,
moving only view/side/bound/physical/ram/siteKey and View/Side. Export only view/
side/physical/siteKey and those types; keep occupied/demands private in the parent.
Leaf390–420,parent625–660,test650estimates include missing checks, documentation
and reserve. Effects/main608/586ceilings remain. This is an exact five-path
proposal, not implementation authority or measured replacement-code fit. AR-P54
owns its full packet, concrete inventory, correction obligations and user ruling.
No leaf, move/export, code fix, extra test file or wiring is applied while pending.

Final diagnostic formatting passes for the two new files. A diagnostic yarn build
then records the actual draft's RED state: six compiler TypeScript errors—three
unused imports, one lost label-operand narrowing and two invalid sp register
arguments. No compiler/CLI/root suite or build success is claimed. These are
unqualified draft errors to fix in the revised proof, not a frozen oracle failure
or accepted checkpoint. The two admission REDs remain independently meaningful
because the new module is not imported by the existing observer yet. Existing
effects/main remain unchanged and public size still stops at candidate selection.
No staging/commit/push; no agent, routing, permission or frozen-authority edit.

Final17:36CESTpreservation guards pass: all12entry source/producer/fixture/config
identities,11oracle hashes,161file links,40tasks/26verified and54unique decisions
with AR-P54pending. Effects/main, frozen spec/expert, existing agents/routing,
portfolio, index and history are unchanged. The proposed layout leaf is absent.
Capacity and draft build remain RED, explicitly not a GREEN checkpoint.

Preserved unqualified proof780lines SHA-256:
`8ae17127d2ffef75e4888d4b4718a56b9c82d4df07ae9e78851e2bd5d506e1da`.
New two-case test21lines SHA-256:
`7f11e3027e410049e9a780527c04ca3740f6d99838ac10fe0f76f27f1d0db580`.
Cleanup:done—only owned ar-p53-lowbyte-fdVQe1OT scratch is removed after durable
diagnostics and exact scope recording. No temporary evidence needs to survive;
the two approved new source/test files remain in the repository, unqualified and
unwired. All agents/processes have completed. Execution Plan Updated:yes; no
task promotion, commit or push. Next action is the exact AR-P54capacity ruling.

### Approved LowByte layout split —2026-10-24

The user directly approves the sole revised fifth-file packet with **“yes”**.
At21:01CEST AR-P1–AR-P54are resolved. Resume task15partial, return17/1.3.3to
not-started and retain26/40verified. First relocate only the exact unqualified
view/side/bound/physical/ram/siteKey and View/Side inventory, unchanged apart from
visibility/import/export documentation. Keep occupied/demands private in parent.
Then complete the expressly included missing proof obligations and typing fixes.
The exact five-path500/700/700/608/586ceilings, all prior frozen/source/oracle,
non-loop/helper/producer/fixture, mode/resource and agent/permission exclusions
remain binding. No unit, public size, native or full checkpoint is yet qualified.

At21:19CEST the unchanged relocation is verified for all8declarations and9retained
parent proof functions. The first two comparison attempts exposed only formatter
whitespace/parameter trailing-comma normalization in the temporary guard, not a
code move discrepancy; the corrected signature/body comparison passes. The leaf
has no runtime import back to the proof owner. Parent/leaf measure506/304before
new proof corrections. The private ram dependency is then closed in the leaf's
complete all-home geometry check rather than exported or duplicated.

The approved corrections and exact effects/main composition are now implemented,
verification pending. Normal formatting measures leaf372/500,parent604/700,
new test21/700,effects574/608,main569/586. Source/control/terminator consumers,
both-inventory staging, complete T0/body/demand matching, retained-home/non-SFA
geometry, all actual data accesses, s/D/I checks, branch physical fallthrough and
actual caller/interior-entry checks are retained. Caller queries use proved A|V
differences with explicit A/X/Y/N/Z/C/V observations; canonical display-independent
startup remains admitted only with the actual P/D/I/SP preservation shape.
No more file or producer/fixture/helper/old-test/oracle change exists. The two
meaningful admission REDs precede these edits; compile/GREEN, complete negative
tests, native/cost identity and independent review still follow. Task15stayspartial,
26/40unchanged; no local acceptance or GREEN checkpoint is claimed yet.

### Bounded LowByte qualification —2026-10-24

The exact approved five-path unit now builds and passes strict owned test-root
compilation plus48focused implementation cases. Normal sizes are leaf374/500,
parent606/700,test508/700,effects574/608,main569/586. Initial compile diagnosis
corrects the new interval bytes array/null versus extent-count assumption; the
geometry check uses actual nonempty start/end extents. New test typing uses the
actual reference certificate inventory. The repeated-T0-object regression first
changed body length and stopped at topology; its same-width reused-instruction
replacement reaches the intended complete occurrence/use guard. No old test,
source, assertion, protected oracle or producer/fixture is changed by these fixes.

Frozen five-source sortedpath/fileSHAcompactJSON identity:
`6ebc4e5ad2225adaac1704e98289d0ec5cb20a5f52df53c387a11e2512e1cdf1`.
This is the unit source identity, not complete compiler-binary attestation.
All four bounded first reviews complete with **no findings**: correctness/high,
SFA/ABI/xhigh, platform/xhigh and emitted-code/xhigh, explicitly dispatched to
Astra under unchanged native read-only charters. No fix/re-review or new agent is
needed. Base owns general correctness/standards/oracle integrity; SFA owns source/
request/lifetime/closure interfaces; platform owns CPU/state/entry/bus visibility;
output owns actual sequence and complete artifact/resource claims. These are
bounded unit reviews, not the final six-lens phase review or FO-SF-002closure.

Reviewers receive source allowlists and exact wiring baseline excerpts, not
external-directory access or denied artifacts. SFA/output disclose incidental
historical routing/setup-summary exposure and exclude it from evidence. The
requested bounded five current-release metadata rows are supplied verbatim by the
primary; SFA confirms consistency without claiming independent hidden-file
attestation. All retain expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15,
frozen spec BLEND65-SPEC-4-038b70e9, selected normative SFA/IL/CPU/platform headings
and MOS-PGM-1976/MOS-HW-1976/MOS-6510-1982/project-policyP3source keys. No grader/
qualification-case map, secret or permission change participates.

The primary serializes and reconciles24real ACME0.97images and executes96sequential
pinned PAL/6581VICE3.10cases: six source variants, bounds on/off, real reference/
selected closures and incoming representedP20/29/e4/ed. Source globals are initialized
normally in source, never debugger-injected after startup. Variants are scalar
sum0/bound4, copied-byte-local sum0/bound4, sum127/bound2with caller+120, sum250/
bound8, sum0/bound1 and sum0/bound8. Independent update values are respectively
[0,1,3,6], [0,1,3,6], [127,128]then248, [250,251,253,0,4,9,15,22], [0] and
[0,1,3,6,10,15,21,28]. Every actual update checkpoint checks A-result memory,
N/Z/C/V from independent binary-add arithmetic, helper SP and X/Y, D=0 and originalI.
Actual global load/store event order/count matches the intended retained body.
At startup restore the final value/events are checked; at pinned SYS continuationE147,
returned P&CF, SP=entrySP+2,
CPUport/DDR readbacks and CIA2DDRA match entry. The unchanged helpers attest the
VICEbinary/version, pinned901227-03KERNAL and ROM set; selected target is PAL/6581.

Runtime endpoint is **VICE-verified / hardware-unverified**, PAL/6581only. No full
dummy-bus trace, elapsed/raster/deadline timing, external firmware-stack guarantee,
four-profile or original963/725qualification is claimed. The source-model flag
formula and exact intended output expectation remain independent of reference/
selected differential execution. Compact results SHA-256:
`7ddb42d914597fbc54a71964bc184bfcd8389cca87fe0486ea81ba8ed6dc0fc1`.
Complete native JSON file SHA-256:
`a146ed957967117d95d56aaf6e72d94b627864851e730f48084372943199d660`.

| Actual witness, bounds on/off | Reference/selected PRG bytes | Selected certificate RAM/ZP; generated stack |
| --- | --- | --- |
| SUM4 | 156/116 | 1/1;2 |
| LOCAL4 | 162/122 | 2/1;2 |
| Overflow2pluscaller | 171/131 | 2/1;2 |
| Wrap8, One, Eight | 156/116 | 1/1;2 |

The PRG count includes the2byte load header; certificate storage excludes global/
platform ownership. SUM accounting independently reconciles2header+12BASIC+
43startup+6main+71/31work+22restore=156/116. Answer1and canonical state4are
separate RAM. Reference SUM storage5RAM/0ZP→selected1RAM/1ZP; this is not the
40byte packaged delta. SUM PRG SHA reference/selected:
`ba1a34601713a1f7dfb26aaf0ce875821b3983b068cec3c11503d3f40939c8af` /
`09c4d4105e5394a19bf8fb458cead4d1046b064ee077d62dd44755904d5930ae`.
LOCAL SHA reference/selected:
`a44fb8d92ce113fd9774342dcc19d6aedb13f08df6f1ae40bcbfc5166dae00ef` /
`6fcd1912bcfd237abb64749cc3d5f1b5797b2bd574d575d9aad5972c2a411af9`.
All24fresh image/source records match the native-executed serializations. Repeated
observer calls leave exact serialized source, requests, homes and certificates
unchanged. Preservation JSON SHA:
`c4dfe8e3c0ba084514f9a2f2716e11bb15204261237a044e92838fcb148a5815`.

All12reference/selected image pairs have exact matching source/assembly/PRG/request/
home/resource records between bounds on/off. Native source is the following exact
UTF-8 template without a final newline; SUM uses body`answer+=byte(i);`, LOCAL
uses`let small:byte=byte(i);answer+=small;`, and only overflow2has suffix`answer+=120;`:

```text
module Game;let answer:byte=${initial};function work():void{for(let i:word=0;i<${bound};i+=1){${body}}}function main():void{work();${suffix}}
```

| Source case (initial/bound) | Source SHA-256 |
| --- | --- |
| sum4 (0/4) | `4765661262ee6855f49e51c5687d189be17ae64f0b4e7962f663a1bd227967bb` |
| local4 (0/4) | `702c8faada82a5705db1530648afce6f00110433eef8ac7b425624d9d0f1c67f` |
| overflow2 (127/2) | `ef9a1bfc5382f834142e7c5c959fe8275c2fb4bbae1fbb216ee094842699eb53` |
| wrap8 (250/8) | `c977f59ab70a1f277358524a972cd10c09b081e4c4902dd819b8e79056c6069d` |
| one (0/1) | `461d30b61270674f40ec75354b0710f809977c45c53e5655019cb13f60f70926` |
| eight (0/8) | `b86ac77d84fcc0a13b1a49173c400e2a54930995ed48f2b8b318a07f07a4a37e` |

| Actual image, both bounds policies | PRG bytes | Assembly SHA-256 | PRG SHA-256 |
| --- | ---: | --- | --- |
| sum4/reference | 156 | `3bec2d81ace248dbfcaed4d54474aafc8612dbd6c74f13164a0c085677ae9a4e` | `ba1a34601713a1f7dfb26aaf0ce875821b3983b068cec3c11503d3f40939c8af` |
| sum4/selected | 116 | `0dd596f1480b86a5b43e884159bb09e5c4b4d8ccd1bb8ae41eac01d0cc7a9ba7` | `09c4d4105e5394a19bf8fb458cead4d1046b064ee077d62dd44755904d5930ae` |
| local4/reference | 162 | `ac1e6d2f10eda1f5e47256961c664e48a313fca08c7e0e0710f62ed9d211038e` | `a44fb8d92ce113fd9774342dcc19d6aedb13f08df6f1ae40bcbfc5166dae00ef` |
| local4/selected | 122 | `fd8a53aaa5a91995cdd6fb0011658b44711e8ed293eadedd094377212e94f17d` | `6fcd1912bcfd237abb64749cc3d5f1b5797b2bd574d575d9aad5972c2a411af9` |
| overflow2/reference | 171 | `9c8b68ab8a2d5989e91a1ea13bb121d44f7f0ad14936f66d62eaab359423a00b` | `b00d79836b20e9f68c0eb2a37c89747a2b8e01f9777951bdba08efc5c2acd797` |
| overflow2/selected | 131 | `27a7af736870ba72b31a3945f5517db8d20d0389872b11b3529781bec11d0aeb` | `8612fea59f8a7ae233394fa333fbc5e9e4dd73042fb14f98aa53c95f909d0d86` |
| wrap8/reference | 156 | `bac863fe5d642732caae326ed2305fc08819245bb2dccb760b1f000a6bbb47b6` | `e2f5e518307e6c9e260fca0dfcf0ead7e15869588dc0472385bf9971ca41ecae` |
| wrap8/selected | 116 | `5d636b2433384c0be829bea2e764a6d81b9603ca811f5556767b01808d1d6550` | `8243f0a51304d88c5245da5d9af544331076d44ca5366f4ac01bd9aa861d0d1e` |
| one/reference | 156 | `74b255fba73dfc4d57b494802b8ec6c179b7bcb6fa737c1470006bb69b55c305` | `c237773fa7a036b549579075a9bb8b123f649598b6352c013b4f31a7e295db47` |
| one/selected | 116 | `63040a174972c730f606d0183683aaef8d20b441758d8cbd1c38f8c477d13b07` | `abee57d63d8058c9a1f6022814b227a5049a33edbb6a24c08d60ea16d73b1a75` |
| eight/reference | 156 | `7114359b21a9c7752e96872c80bb2f3b861be02276ddf303be3c54c16d9ccd49` | `b8ae2cbfef3df957dbf68bd5c0bdca1219982750c4f65177c4579636bc4065ad` |
| eight/selected | 116 | `92f74b9b06fcd7c56afb0972343633add45a8e1aea181d7499ec4050b92110bd` | `cbf6e5a11e9086f9843fd1b2aee094d42de21e5111500a24a539455b33ea9755` |

Output audit identifies inherited scalar arithmetic capture debt, not a new unit
finding or a parity waiver. Actual body15bytes/21nominalcycles versus equivalent
expert9/13; complete SUM work31bytes/166cycles versus25/134at bound4. Removed
traffic is private STA/LDA; answer accesses and A/N/Z/C/V/X/Y agree under the proved
contract. No expert replacement is assembled/executed here. Existing #114native
store/X/Y and #89scalar-operation/#110terminal-leaf owners are inspected and do not
explicitly own this scalar store case. Mandatory expert-output issue creation is
durably authorized; [#115](https://github.com/blendsdk/blend65/issues/115) now owns
the exact six-byte/eight-cycle-per-iteration gap, missing existing-consumer seam,
complete proof/qualification requirements and path to a win. No source/codegen
change, dependency, source workaround or automatic push accompanies the issue.

Fresh checkpoint: frozen install0.33s/build2.12s/typecheck0.88s pass. This run's
explicit directed selection passes1117cases/79files171.94s; it is narrower than
the historical82file filter, not a claim of the same cohort.45import-boundary
cases pass2.16s. Full yarn test278.88s reports compiler2807passes/13failures/two
existing skips across177files; all prior2759passes plus the48new cases pass. CLI62,
language-server21andVSCode6pass; root suite is not reached. Exactly the same13
frontier identities remain: eight32/64site and four72-return-chain cases hit
unfinished size candidate construction; one cost-reader case rejects the approved
resource-rejected baseline contract. No new full-suite failure or skip is hidden.

The seven original canonical-none artifacts and empty diagnostics match every
recorded byte length/SHA. All11oracles and unchanged producers/fixture/agents/
configuration/frozen authority remain protected. Whole task15is still partial:
X/Y/native/expanded/mixed windows, wider transports, raw/status/MMIO/platform,
asynchronous and reference-rejected closure remain due. Six implementation/eight
hardening/qualification tasks remain;26/40,parent38/48,v4four/ten unchanged.
No public size, full963/725, phase, RD or GREEN composite checkpoint is claimed;
no commit/push while the full suite remains RED. Further observer-class admission
requires its exact scope/evidence gate, not inferred authority from this unit.

Final22:18CESTpreservation guards confirm the frozen five-source6ebc4e5aidentity,
all11oracles, seven original none artifacts/empty diagnostics,24native image
records/96cases,162local file links,54resolved decisions and40tasks/26verified.
The final exact test source also passes fresh strict-root compilation and all
five source files pass targeted Prettier checks. All code/producer/fixture/agent/
policy/frozen/portfolio/index exclusions remain protected; current entry copies
show only the exact main/effects wiring deltas. GitHub confirms #115open under
the intended RD-08owner. Full-suite RED remains explicit; no task/phase promotion,
staging, commit or push. Execution Plan Updated:yes.

This is a clean bounded-unit continuation boundary, not completion of task15.
Next inspect the remaining selected-loop/native/mixed and physical/source observer
obligations within their exact scope before implementation; startup, finite
construction, closed costs/debug and original qualification still follow. No
extra support owner or source restriction is inferred from the narrow success.

Final cleanup/preservation recheck passes at the unchanged6ebc4e5aunit identity,
all11oracle hashes and162local links. Cleanup:done—only the149temporary files
under owned ar-p54-lowbyte-6Rbo2ttH are removed after durable source/image/resource/
review/failure/issue evidence recording. No symlink, unrecognized scratch entry,
user/worktree content or other session's artifact is removed. All agents and
verification/emulator processes have completed; no raw artifact needs to survive.
No source changes follow review/native/full-checkpoint verification. The index is
empty and no commit/push is performed; the13known full-suite failures still block
the requested coherent GREEN checkpoint. Task15partial,26/40,parent38/48 unchanged.

### Next selected-loop discovery stop —2026-10-25

User **“proceed”** resumes inspection/measurement, not class/file/helper expansion.
Entry reproduces exact frozen6ebc4e5aLowByte source identity, build0.44s/typecheck0.40s,
48focused cases10.30s and all11oracle hashes. Every named latest task14/LowByte
continuation owner exists. Preflight findings remain resolved; accepted FO-SF-002
retains its final complete-phase review gate, not a new failure or waiver.

The unchanged real fixture constructs48reference/selected pairs across scalar4,
typed ordinal-array4, local byte arithmetic/native-array4 and typed exact-eight
array sources; six policies, bounds on/off. Every SFA/layout closes and selected
serialization validates. Eight Original and two LowByte scalar controls pass;
38remaining cases conservatively reject. Scalar register bodies are6→7instructions
with actual STX/STY snapshots; indexed reference bodies have bounds splits/evaluated
pointers versus selected native addressing. Native arithmetic has a dependent
counter plus native-store proof; expansion has eight occurrences/ten actual blocks.
All actual caller continuations pass A|V but fail A|V|X and A|V|Y under explicit
all-seven return observations. This does not establish a miscompile or a right to
weaken observations; actual language/ABI/platform observability remains to prove.

AR-P55owns the complete factual probe summary, scope/evidence stop and request for
one separately authorized next-unit read-only assessment. Compact probe SHA
`d828284a62a2c2e3da4d08d14fbeb7b4617f8034677310970e32bef2ec7141c3`.
No code, tests, old expectations, fixture, producer, helper, ceiling, runtime,
agent/config/permission or frozen authority changes. No ACME run, new VICE case,
full-suite or next-class qualification is claimed. Prior AR-P53/54fresh-context
allowance is exhausted and is not reset or bypassed. A separate assessment needs
direct user authority before dispatch; no independent verdict or larger-code
recommendation is fabricated. Exact implementation scope still follows that gate.

Task15is preserved partial and marked blocked alongside17/1.3.3.26/40verified,
keyboard38/48,v4four/ten and six implementation/eight hardening tasks remain.
The last full suite stays2807passes/13known failures/two existing skips; no commit/
push. Portfolio unchanged on feature/v4-rebuild; only owning status summaries sync.

The first assessment question is interrupted, not approved. After **“ask again”**,
the user selects **“Approve assessment (Recommended)”**. At18:06CETthe sole separate
next-unit design assessment is authorized for existing design-challenger at native
`openai/gpt-6-astra#xhigh` (availability confirmed). One fresh context only; requested
factual supplements return to that same context. No code/newfile/ceiling/helper/
producer/oracle/agent/config/permission changes are authorized. AR-P55code-scope
decision and task15/17/1.3.3blocks remain pending after assessment; no progress bump.

The separate read-only native dispatch succeeds with the explicit Astra/xhigh
override. Its sole session is`ses_e8bf63a2bffe4F3c0RZBiB087I`; only requested factual
supplements may return there. Packet supplies original goal/minimum design,
measured primary evidence, existing exact authority/caps, normative excerpts and
strict source/evidence/sensitive-path limits, without the primary's preferred
owner/design. No external scratch, denied JSON, hidden qualification/grader map,
prior reviewer verdict or executable permission is an agent input. Code stays frozen
at6ebc4e5a; root remains the sole execution owner. Assessment outcome is pending.

The sole assessment returns **Simplify—Needs evidence**. Its best next boundary is
scalar X/Y with the actual byte snapshot, excluding indexed/native/expanded cases.
Neither current-owner fit nor an additive concern is yet justified. It requests
three bounded primary packets in the same context: governing terminal X/Y contract
plus actual caller/startup trace; complete scalar snapshot/demand/cost correspondence;
and a documentation/test/reserve-inclusive fit ledger comparing current composition
with a focused concern. Scalar-eight expansion is a genuine alternative, but no
artifact/complete-proof advantage or protected old-row amendment is assumed.
No file or implementation is approved by this initial verdict.

Pre-question scratch is absent after the interrupted/user-question handoffs; a
guard attempting its saved baseline reports ENOENT, not a code/oracle failure.
The primary rederives6ebc4e5a and all11hashes from durable recorded identities and
checks55decision rows/26of40tasks/163links/targeted Markdown formatting successfully.
Temporary loss does not erase recorded source/static-query facts or fabricate raw
inspection. The requested fresh probes use a new owned runtime directory.

During terminal-contract source lookup, the primary's overly broad source-manifest
opening also exposes historical qualification labels/summaries. They are excluded
from decisive evidence and never supplied to the challenger; subsequent manufacturer
lookup is restricted to the exact CBM-C64-PRG-1982source-definition heading.
No expert/spec/source-manifest content is edited. Terminal behavior must be grounded
in the actual governing product contract and primary machine/firmware evidence,
not historical qualification descriptions or current compiler choices.

The three requested packets are now supplied to the same assessment context.
Keyboard AR-P17contains explicit prior user authority for usable normal BASIC
return with no promised outgoing A/X/Y values; only that approved-rule excerpt,
not earlier reviewer conclusions, is supplied. No new ABI policy or old-oracle
edit is inferred. Fresh4X/Y scalar correspondence/query probes close exact byte
snapshot identities, complete two-use sets,19source-position occupancy and paired
6/7instruction bodies. Actual main-to-startup terminal queries succeed under that
existing terminal contract, not under arbitrary empty void-return observations.

Primary14ACME images/24sequential PAL/6581trace diagnostics establish exact scalar
cost/state facts, not final observer acceptance. Uninitialized source answers are
conditioned on their actually observed initial values, never fixed6/28or assumed
equal across layouts. Reference/LowByte/X/Y PRGs151/111/107/107and scalar-eight
reference/Flat151/201show no smaller size case for the overlooked scalar expansion
alternative. Common startup38/main6/restore22includingRTS, state4, generatedstack2
and no borrowed-BASIC delta reconcile full artifacts. Initial packet attribution
main7/restore21is corrected to6/22without changing totals. P/SP,ports/DDR/CIA2DDRA
and actual SYS030C–030Foutput-capture traces agree with the approved terminal
contract. Status is diagnostic **VICE-verified / hardware-unverified**, PALonly;
whole-input,publicsize,four-profile,timing and final proof remain unqualified.

Read-only complete concern budgets find no demonstrated current700line fit or
single700line standalone replacement: direct parent786–846/leaf429–444, standalone
1080, newtest490including documentation and reserve. These are conservative
estimates, not code/lower bounds; the same independent context is asked to refute
them and find a smaller complete factor-specific composition if one exists.
No production draft, private-helper export/move, new concern or implementation
approval follows from those estimates. AR-P55owns exact evidence/hashes/limits;
its code-scope ruling and tasks15/17/1.3.3stay blocked until the assessment ends
and any necessary exact user scope gate passes.

The sole context returns its final **Justified—one register-specific factor**
verdict. It independently rejects a duplicated standalone validator and finds a
factor-specific composition that keeps existing private proof owners. AR-P55now
contains the complete six-path packet: new register-counter factor/test, bounded
existing parent/layout/main changes and only removal of x-first/y-first from the
old bound8rejection parameter list. Flat rejections/source/assertions remain;
new tests own X/Y acceptance. Effects, producers, fixture and all11oracles stay
unchanged. Existing siteKey/Side gain only the factor consumer; memory-counter
null is distinct from its separately proved value snapshot. No private helper
move/export or new general ABI/observer/solver/runtime surface is proposed.

Prospective complete budgets incl.docs/reserve are parent700/700,leaf434/500,
factor390/500,main586/586,newtest490/700,oldtest542/700; unchanged effects574/608.
Actual formatted fit remains unmeasured and a binding stop. The same context
acknowledges main6/restore22includingRTS without tools/reasoning or a fresh review;
its totals/verdict do not change. No further assessment context is authorized.

The exact implementation decision is now the sole pending user question. The
read-only assessment approval is not code/file/ceiling/test-edit authority.
Task15partial and tasks15/17/1.3.3remain blocked; no production draft/newtest,
old-test edit, agent/config/permission change or acceptance wiring is implemented.
26/40,parent38/48,v4four/ten and all original qualification gates remain unchanged.

Final18:42CETassessment-boundary checks pass: all14actual PRGs reconcile complete
header/stub/startup/main/work/restore costs;24traces and four snapshot/query records
remain exact. Source5file6ebc4e5aand all11unique oracle hashes are unchanged;
165local links,55decisions/soleAR-P55open,40tasks/26verified, absent proposed files,
unchanged spec/expert/agents/routing/policy/portfolio and empty index all pass.
A temporary guard first counts13historical table appearances instead of11unique
oracle owners; corrected unique-owner/hash checking passes every record. This is
guard bookkeeping, not a changed oracle or compiler failure.

Fresh targeted formatting1.09s(retaining repository Markdown ignore policy),
build0.50s/typecheck0.40s,48LowByte cases10.39s and45import-boundary cases2.34s pass.
No fresh full-suite or new observer acceptance is claimed; the last full result
remains2807compiler passes/13known frontier failures/two existing skips. All
assessment/emulator/tool processes are complete. Execution Plan Updated:yes.
The remaining user-owned action is the exact AR-P55six-path/two-label amendment
ruling; the read-only assessment is complete and supplies no implementation authority.

Cleanup:done—75temporary files are removed only from the exact owned register/
assessment scratch directories after durable evidence recording. Pre-question
scratch is already absent; no unexpected entry, symlink, user/worktree file or
other session's artifact is removed. Final guards again confirm6ebc4e5a/all11oracles,
the unchanged four-label old rejection list, absent proposed files, frozen/agent/
policy/portfolio guards and empty index. No raw artifact needs to survive, no
process remains active and no source/test change follows the evidence checks.
No commit/push; exact AR-P55implementation approval remains the next action.

### Approved scalar register factor —2026-10-25

At23:33CETthe user's **“I approve”** directly authorizes the sole AR-P55six-path
packet and exact x-first/y-first rejection-list removal. No code/newfile/old-test
or wiring edit precedes this ruling. Resume task15partial;17/1.3.3return to not-
started. Preserve all caps, the complete existing LowByte proof, two factor exports,
separate snapshot/counter identities, main-only terminal contract and outer gates.
No effects/producer/fixture/helper relocation, specification/oracle, runtime,
dependency or agent/config/permission authority is added. First add real fixed-
answer admission tests and confirm meaningful rejection before implementation.
Scope approval is not measured fit or qualification;26/40,parent38/48 unchanged.

The new initialized scalar admission test first reaches two meaningful register
REDs; its initial inner bounds loop stops at bounds-on. Reshape only this new
test into separate bounds-on/off cases before production: all four X/Y×bounds
cases then meaningfully reject at the existing observer, with real source and
closures succeeding. No old test or source assertion is weakened for RED.

The exact register factor, parent/layout/main composition and two-label old-test
amendment are implemented, verification pending. Only the approved six source/test
paths change; effects/producers/fixture/qualified-private helper exports remain
unchanged. The nullable counter is separate from the returned snapshot request;
the complete existing parent/physical proof still follows the factor. Actual
main-only terminal graph carries the register difference without a blanket void
ABI assumption. Format/actual fit, build, meaningful GREEN, expanded negatives,
native/cost identities and independent reviews remain due; task15stayspartial.

First actual fit passes: factor223/500,parent644/700,leaf381/500,main570/586,
oldtest508/700. Build and strict owned test-root compilation pass. Four admission
REDs become GREEN; the approved old test differs only by removal of the two named
policy literals, retaining46other cases. The new register test then grows to50
cases; combined96cases pass before additional storage/terminal regressions.

The draft positive copied-local fixture is discovered to emit direct TXA/TYA and
no byte snapshot. That is outside the expressly approved actual-snapshot boundary,
not a reason to broaden production or reject ordinary source. Only the new unqualified
implementation-test fixture is corrected: use a second genuine snapshot body for
positive coverage and retain the copied-local form as an explicit unsupported-
tuple control. No old test/specification/source expectation changes. Assigned-
register mutation drafts initially append bytes and stop at physical fallthrough;
same-width paired STX/LDX replacements now isolate register read/clobber checks
without altering topology. These are new test-mechanism corrections, not relaxed
behavior or proof requirements. Complete T0, occupancy/home and terminal negative
coverage is being added within the same focused test cap.

The complete new test concern now has55cases/611lines; the factor223,parent644,
leaf381,main570and oldtest508all remain within their approved caps. Fresh build,
strict NodeNext/ES2023 owned test roots and101focused cases(twofiles) pass. The
six-file sortedpath/SHAcompactJSON source identity is
`f96f43e375556f05d669def82c97243c22b64c20d15a721c214b4efd97af6dd5`.
Exact two-label full-file comparison confirms that the approved old implementation-
test exception changes nothing else; effects/producers/fixture/config and all11
oracle hashes remain unchanged. Source is frozen for qualification/review.

First bounded correctness/high,SFA/xhigh and platform/xhigh reviews explicitly use
native Astra overrides and return **no findings**. Base initially stops for an
inspectable existing-file diff and exact verification commands; the primary
supplies the exact fresh four-file patch inline from this unit's permitted entry
copies plus command lines, not denied external evidence. The same first-review
context then completes, including the exact old-test exception check; this is not
a fix/re-review or a fresh review context. SFA/platform report a rendering typo
splitting the spec identifier/leading zero; metadata-only no-tool acknowledgements
restore exact BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b
without changing their static-only verdicts. No hidden authority or external
scratch access is used. These are bounded unit reviews, not FO-SF-002/final phase
closure or an output/parity qualification.

Root now executes defined-answer scalar X/Y constructions sequentially with
unchanged pinned ACME/VICE helpers; source initialization, intermediate values,
snapshot use order/count, N/Z/C/V and P/SP/ports/CIA2/SYS observations are independent
expectations, not reference-only differential answers. Full directed/owned suite,
actual output-cost review and final preservation/cleanup remain due. Task15stays
partial26/40; no public size, full input963/725, phase or GREEN commit/push follows.

### Bounded scalar register checkpoint —2026-10-26

The exact six-path AR-P55unit remains frozen at
`f96f43e375556f05d669def82c97243c22b64c20d15a721c214b4efd97af6dd5`.
All55new focused register tests and46retained LowByte tests pass; the sole old
test edit is the directly approved two-policy-list migration. New factor223/500,
newtest611/700,parent644/700,leaf381/500,main570/586,oldtest508/700fit after normal
formatting. Effects, producers, fixture, qualified-private helpers and all11oracles
are unchanged. No source/storage/codegen/startup instruction is introduced here.

Correctness, SFA/ABI and platform first static reviews are clear for this bounded
unit. Output review likewise finds **no defect introduced by the observer unit**,
but independently reports two **MAJOR inherited output defects**, not a parity pass:
RC-MC-001is the redundant scalar arithmetic capture already owned by[#115](https://github.com/blendsdk/blend65/issues/115);
RC-MC-002is the avoidable held-ordinal snapshot before commutative byte addition.
The primary checks#114/#115and the plausible guarded-ordinal#105owner and an open
snapshot search; none explicitly owns the latter case. Under the standing mandatory
expert-debt filing authority, [#116](https://github.com/blendsdk/blend65/issues/116)
now records that exact source/assembly/cost gap and existing-owner path to a win.
No producer/proof expansion, old issue edit, optional machinery or push accompanies
filing. The ledger accepts both defects for correction under their explicit owners;
it does **not** dismiss/defer/waive them or clear phase/output qualification.

Actual SUM body is STX/STY snapshot;LDA answer;CLC;ADC snapshot;STA result;LDA result;
STA answer. Removing the result capture is6bytes/eight nominalcycles per iteration
(#115). Replacing the pure snapshot/add prefix with TXA/TYA;CLC;ADC answer saves a
separate5bytes/six cycles and one byte's demand (#116), subject to complete future
use/effect/flag/alias/ABI/closure proof. These are inherited producer gaps, not a
reason to weaken the current exact-shape factor. Equivalent four-iteration work
includingRTS is27bytes/139cycles versus16bytes/83cycles when both are repaired;
same surrounding obligations give an analytical112→101PRG target and frame2→0RAM.
Those expert replacements are instruction-derived expectations, not newly assembled
or executed expert artifacts. Snapshot-only work target22bytes/115cycles is separate
from the combined target. Cycles exclude IRQ/NMI,VIC stalls and firmware latency.
No whole-routine or whole-program expert parity is claimed for current output.

The primary now qualifies24reconciled actual ACME0.97candidate images with96sequential
pinned VICE3.10PAL/6581cases. Six ordinary explicitly initialized sources, X/Y,
bounds on/off and incomingP20/29/e4/ed cover bound1/4/8, second body addition,
signed-overflow flag, unsigned wrap and caller arithmetic. Initial A/X/Y17/55/aa
are supplied through the actual pinned SYS inputs before startup. No source input
is injected after startup and no uninitialized fixed-answer assumption is used.

Independent source arithmetic predicts update arrays [0], [0,1,3,6],
[0,1,3,6,10,15,21,28], [1,3,6,10], [127,128]then caller248, and
[250,251,253,0,4,9,15,22]. At each actual update PC, runtime checks A/value,N/Z/C/V
from binary ADC arithmetic, snapshot=ordinal, assignedregister=ordinal, unchanged
otherindexregister, SP, D=0and originalI. Actual answer read/write order/count and
snapshot write/read pairs match every intended source operation. Before restore,
the held register equals the bound; at SYS E147normal return P&CF, SP=entrySP+2,
CPUport/DDR and CIA2DDRAreadbacks agree with entry. E155captures actual outgoing
A/X/Y/P in030C–030F, without asserting unpromised outgoing register values.

Status is **VICE-verified / hardware-unverified**, PAL/6581only. No full dummy-bus,
deadline/raster, arbitrary firmware-stack, four-profile, whole-input/public-size or
physical-silicon qualification follows. Tests/native results are primary-executed;
reviewers inspect static source and supplied actual assembly/resource/results, not
independently executed denied or external raw artifacts. No new review-fix round
is needed for this unit; all six final phase lenses/FO-SF-002still remain due.

| Defined-answer native source | Bound / initial | Body extra / caller suffix | Work bytes reference/selected | Selected PRG bytes | Certificate frame RAM/ZP |
| --- | --- | --- | --- | ---: | --- |
| One | 1/0 | none/none | 71/27 | 112 | 2/0 |
| SUM4 | 4/0 | none/none | 71/27 | 112 | 2/0 |
| Eight | 8/0 | none/none | 71/27 | 112 | 2/0 |
| Extra4 | 4/0 | answer+=1;/none | 86/42 | 127 | 3/0 |
| Overflow2 | 2/127 | none/answer+=120; | 71/27 | 127 | 3/0including caller capture |
| Wrap8 | 8/250 | none/none | 71/27 | 112 | 2/0 |

Every row includes both register policies and bounds settings; generated-program
stack2is unchanged. Actual SUM accounting is2loadheader+12stub+43startup+6main+
27work+22restore=112. Answer1and canonical platformstate4are separate RAM, not
frame or initialized PRG payload. The12on/off pairs have exactly equal source,
assembly,PRG,requests,homes and resource identities. Every observer call preserves
its serialized source and complete request/certificate contents in all24images.
Seven original canonical-none artifact lengths/hashes and empty diagnostics also
match. Four additional107byte uninitialized diagnostic PRGs exactly match the
pre-implementation X/Y hashes from AR-P55; that preservation check makes no
source-value/runtime qualification claim for the uninitialized fixture.

Exact initialized UTF-8native source template, without finalnewline, is below.
Values and optional strings are exactly the table; empty extras/suffixes add no bytes:

```text
module Game;let answer:byte=${initial};function work():void{for(let i:word=0;i<${bound};i+=1){answer+=byte(i);${extra}}}function main():void{work();${suffix}}
```

Compact image/result SHA-256identities are
`052760cbe467cb999763ca2539f90641d80fb2837f74b70099b0ea24de38d738` /
`b845ac4e4f22d9e7ef4df6486d5cae3e64bb713561006515cb3eb36ab48127a1`.
Pretty JSON file identities are
`130035d99fe9253f8ddbb2d998d2a4700392f1eaba6d49ca67f51572841b411e` /
`cfdcc646a48740b8cf426c15bd494e345403c7c262614b0be50df4cf3250445f`.

| Actual native image, both bounds policies | PRG bytes | Assembly SHA-256 | PRG SHA-256 |
| --- | ---: | --- | --- |
| One/X | 112 | `84eb611dcdd8210e361faee8f387bbf9c2a3f78bffcd008dfb32f0cda19a123e` | `13c39d1d4d3ae8c6400833dde7a2ebc202a6238a2b5b6cf5bcea1dd9ca268678` |
| One/Y | 112 | `a8ca27c04d579edd08c654c52f5147bd2325975f871858d3ccc848fd6af72196` | `f1ec1cdb19acd2d2ec497d2be37a3d68053bd42e6590b9238357a8d956fb143c` |
| SUM4/X | 112 | `6435ff113ea03d5e97c15f3c251c1e3a9ff50a42603db27c4b895d5837247171` | `e509a9d9e4f22d6c1bb620f170d7b7918d27a1e8704b244a2d5f5b68d18fdd46` |
| SUM4/Y | 112 | `c9d50497ed2eb6932864ac002ffb8d84d50cd19991a002adeacdb3ddc893bdf0` | `45763eb5edfab5f4602c9eb27213b306df57de96e2668da7f3c588b26b33bc08` |
| Eight/X | 112 | `557ab35ebc4a8169778dcbaa96d9da23d32437d8dc769899c67d41d0db03efda` | `1f6da14f4e62fa2a9d3eb110c17538c662f5840dc53be19b32345e515fecc652` |
| Eight/Y | 112 | `39b9f2f11b8d86daa5bf159636cf52b17541218b6d9d50258ad89d1d58aefdad` | `d4c28de406e3dbb43c63421a57327ba377c69d0513b612b01b1d7d8a70497e55` |
| Extra4/X | 127 | `59720ed8129aa17e34c8f9260403ceca191051cb99637a3488d4206dd42d4978` | `08ca8797288d2c06c54a78b59ac88e569713e42f30f314b54c4af0fa38f7fe17` |
| Extra4/Y | 127 | `410cd4fac1eb767dd7854f0e7d3b4de3a9b5ceb79c1f1637940f283a3d54f163` | `6485ce5537e490fd7c206659a97395be8fa8e4b154043a9d83a9a10a7f94b03c` |
| Overflow2/X | 127 | `0882d3ed7d1077c6878e4fe82411581690402e26d3d00c1f810f3685fd3e6c94` | `9d10ab8971f3cef5c8436e043c99c154187dbab319df6b1958dffee9bf4a5daa` |
| Overflow2/Y | 127 | `bde5890781617348c342842cf60916cd66d7d47cfecdd85708e1fab994821487` | `c68b65de74010c67c01f3190e2247ba872bdf36e9f67d28bdae26746bfe5db64` |
| Wrap8/X | 112 | `7bfd5ea19f6cf7f5a95af8e9fd5b421f75a31532b2a3cd3fe3e932e5a1f0c679` | `4743621b5057e92e495a25ae02140e3105f0d46b6e58dc94b0dd1fb9645c09f5` |
| Wrap8/Y | 112 | `b9bf6e407a773fcedf312edc561ba2438686e98b06c01fcc4ff15640831570de` | `d06bbabcf6bd0560cbcc371dd8d089f2568d7b3a7b6b13e5790c752e03054ccb` |

Fresh frozen install0.36s/build0.41s/typecheck0.67s pass. The same explicit directed
cohort used at the prior LowByte checkpoint gains this new file and its net53cases:
1170cases/80files173.68s pass.45import-boundary cases pass2.28s. Full yarn test265.58s
reports compiler2860passes/13known frontier failures/two existing skips across178
files. The two authorized old negatives move into55new tests; no other old pass or
negative is lost. The same12unfinished candidate-construction cases and one
resource-rejected-baseline validator case remain; CLI62,language-server21,VSCode6
pass and root suite is not reached. No new full-suite failure or skip is hidden.

All bounded review metadata retains expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15,
exact frozen spec BLEND65-SPEC-4-038b70e9and selected SFA/IL/CPU/lowering/C64/source
keys. Task15is still partial: typed-index/native/expanded/mixed and direct-transfer
windows,wider transports,raw/status/MMIO/platform,asynchronous and rejected-reference
observers remain due. Six implementation/eight hardening/qualification tasks remain;
26/40,parent38/48,v4four/ten unchanged. No full-phase/output-parity/public-size or
original963/725qualification; no GREEN commit/push while the composite is RED.

Final00:36CETpreservation checks reproduce f96f43e3, all11oracle hashes, exact
two-label-only old-test diff, all caps,55resolved decisions/40tasks/26verified and
167local file links. Effects/producers/fixture, frozen spec/expert, agents/routing/
policy, non-integration portfolio and empty index remain unchanged. All24native
image/96result records, seven original none artifacts and four pre-implementation
diagnostic PRGs reconcile; GitHub confirms#116open. Targeted source/Markdown format
checks pass with the repository's Markdown ignore policy retained. The touched
code has no planning-reference leaks and required public/internal documentation
is checked. No source changes follow static review/native/full verification.
Execution Plan Updated:yes. This is a bounded proof continuation checkpoint, not
task15, full output, phase, RD or release completion.

Cleanup:done—only162temporary files under the exact owned register-factor-rp1hPEXX
directory are removed after durable source/artifact/resource/runtime/review/failure/
issue evidence recording. No unrecognized entry, symlink, user/worktree content or
other session's artifact is removed. All reviewers, assembler/emulator and verify
processes have completed; no raw artifact needs to survive. Final preservation
again confirms f96f43e3,11oracles and unchanged effects/producers/fixture/agents/
policy/frozen/portfolio with empty index. Source stays unchanged after reviews/
native/full checkpoint. Task15partial26/40,parent38/48,remaining14tasks and all
unfixed output/whole-input gates stay explicit. No staging, commit or push.

### Next typed-index discovery —2026-10-26

User says **“proceed”** to read-only smallest-indexed-unit/exact-scope discovery.
Sol retains strict scope; no historical auto-design/push authority is inferred.
Original phase baseline e221a08c894bd1a8b1a505115f437de2c5582e76is unchanged. Required
documents/schema,55resolved prior decisions, original381case spec gate, passed
preflight and actual task14owners are checked. FO-SF-002/final phase and#115/#116
stay open, not waived. Fresh build/101focused tests and f96f43e3/11oracle hashes
pass; all compiler source/test-support/producer hashes are captured before probes.

AR-P56owns96isolated+24actual-source constructions and nine ACME images, not runtime
or output qualification. The finished AR-P55packet is not reopened or expanded.
Any next typed proof/API/test path needs its own exact scope; tasks15/17/1.3.3block
there, with26/40,parent38/48,v4four/ten unchanged. No source rewrite, producer/fixture/
qualified-helper move, old-test amendment, runtime/dependency/solver or agent/
permission change is authorized. Final scope evidence/validation/cleanup are due.

The required single new bounded design check uses native Astra/xhigh explicitly
(configured routing default, supported model/variant discovered). It receives
fresh facts and genuine direct-extension/additional-leaf alternatives, not the
primary's preference, AR-P55verdicts or hidden qualification answers. The packet
forbids shell/edits/children/hidden/external raw access and carries complete safety,
source/CPU/SFA/terminal constraints. It asks for actual consumer/API boundaries and
complete logic/docs/reserve budgets, not a speculative implementation. This is a
new next-unit assessment; its result cannot authorize code or a new file.

Read-only discovery additionally passes fresh yarn typecheck and45import-boundary
tests. All entry compiler source/test-support, producers, shared fixture, installed
input library and exact caller source hashes remain equal. Frozen expert/spec,
agents/routing/policy, non-integration portfolio and empty index are unchanged.
No fresh full-suite run follows a source change because no source changes occur;
the last full2860/13knownfail/two skips endpoint remains explicitly historical.

| Reconciled diagnostic, bounds off | Source SHA-256 | PRG bytes | PRG SHA-256 |
| --- | --- | ---: | --- |
| Constant/reference | `1075a0d4c876923c18efbb47e0f402faa363bb33f0bae3957812843521a9a978` | 191 | `88dbb50120ee1ab49e23db3bb1197822778ff09e22f865c9f8aa48fbb5eba611` |
| Constant/X | same | 119 | `a1ec159430f69b9a97ac751a8d0b1c109cd20f5ca3ae0bb4f6a5f769541c382b` |
| Constant/Y | same | 119 | `73880542d6e11c5ad1ade321a25022d0385ef0ab7a736babfb8c1faa1c806550` |
| Scalar/reference | `932e5df020c60d4066a84cab8ba5f77d3431c2553d2c8866f041752f34b5b3c3` | 197 | `4b3bfeebf3c1d6d52fff66a79f168cd6604bbe827102e567d640f621a8d15b99` |
| Scalar/X | same | 125 | `7f20bdaea738868cd4b9de93d57b16a3d67fb7436665e0886e4e9fd367a03c7c` |
| Scalar/Y | same | 125 | `f084f39cbceec67d6b493616cf6dfebb5fcd98604b981328eb7e6eec5436ecd0` |
| Field/reference | `fb2a06fdc57ca07467c8dafb4d08676bb36edb60c411b2fe7e1adac8b728b347` | 196 | `80830146f2788154feb038b45f1b0d4e6313e0b69d478c78e99aca4027de974f` |
| Field/X | same | 124 | `92026129fc0fba59624aa9ec2a8e4d96d64a6627309cf7ba833b925862329934` |
| Field/Y | same | 124 | `f8cc7a91bfd2d7f21160c419eb79300cb4f48a6920279ce9d87184b01635ec10` |

These PRGs include the two-byte header. Constant accounting is2header+12stub+
69/64startup+6main+75/13work+27/22restore=191/119. Scalar adds five startupbytes
and one workbyte; field adds five startupbytes. Reference frame4RAM/2ZP has an
actual borrowed03byte plus platformstate5; selected frame0/0uses platformstate4.
No padding, helper, generatedstack2or source-global-width obligation is omitted.

Exact source templates, UTF-8without final newline, use the same work/main suffix:

```text
module Game;${declarations}function work():void{for(let i:word=0;i<4;i+=1){${body}}}function main():void{work();}
```

| Witness | Exact declarations | Exact body |
| --- | --- | --- |
| Constant | let rows:byte[8]=[;0]; | rows[i]=7; |
| Scalar | let rows:byte[8]=[;0];let value:byte=7; | rows[i]=value; |
| Field | struct Saved{quality:byte;rows:byte[8];}let saved:Saved={quality:2,rows:[;0]}; | saved.rows[i]=7; |

Diagnostic JSON file SHA-256:96isolated records
`60c429646b5cacd7e27a0f89fd0af2796e5df46725db7fd083bc21911490c313`,
24whole-input records`8184fa1aa6f53012d9d20394f5e649b861afc4e5e022895bcd637fbfdf4a303a`,
nine reconciled image records`c491dca7803cc0c3aabce4801dbea3b978c2d0067b9dd74cb4f1e38d93514060`.
The exact real callers/library are unchanged files, not generated substitutes.
No new source or timing oracle is inferred from these compiler-derived costs.
Expert lineage is2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15;
normative lowering#loops-and-induction, semantics#fixed-array-and-index-ordinal-invariant,
IL#two-oracle-proof, SFA#lifetime-model and MOS#instruction-effects/#bus-visible-accesses,
with MOS-PGM-1976/MOS-HW-1976/MOS-6510-1982and exact BLEND65-SPEC-4-038b70e9.
Status **Verified partial** / facts only at construction, serialization and ACME
reconciliation; indexed observer/runtime/parity and whole-input outcomes **Unknown**.

The same bounded assessor first returns **Simplify—needs evidence**: selected
constant/global native stores carry V around the loop without overwriting it;
main-X/Ymask widening alone cannot close the existing cycle-rejecting query. The
primary supplies exactly the requested source1X/Y/bounds-off source/global/full
pointer/occupancy/occurrence facts, live asymmetric reference/selected query
results and complete A responsibility/docs/reserve budgets. No compiler/test
draft, new production file/export or qualified-helper move occurs. AR-P56owns
the proposed indexed-only finite V-nonobservation→actual-main/restore proof and
the strict stop if complete readable code exceeds any existing cap. Current
scalar/LowByte guards/tests and lower-control remain unchanged. The optional
referenceYdifference must be checked at actual main, not presumed dead in void.

The diagnostic initially asserts reference queries also reject V and fails; actual
reference ADC/SBC kills the difference, so the corrected scratch report records
reference true and selected false. Minus-V interior queries pass on both, zero
actual V uses are found, and actual main+restore consumes the full A/V/X/Ymask
without observation; explicit PHP/TYA scratch counterexamples reject. This is
factual mechanism evidence, not implemented recurrence, runtime or parity proof.
The computed supplement JSON identity is5af1f954c5f4996fdec1673faa4db3a251c63e412aa1ccc964ecc9501d7416b5;
an unverified packet digest literal is immediately withdrawn in a same-context
factual correction. No reviewer independently reads or verifies external artifacts.
The original assessor alone continues; no second assessment context or implementation
authority is inferred. Tasks15/17/1.3.3stay blocked,26/40and38/48unchanged.

The sole same-context assessment now returns **Justified—A**, with mandatory
reference packed-offset correction. The reference cache can form pointerR+i
and separately LDY#d, not pointerR+d+i/Y0. Correct decoder inputs are reference
pointees[R,R+m],index[d,d] and selectedbaseR+d,index[0,m], independently resolved
in each layout. The primary confirms both existing field X/Y records: root address
bytes offset0/LDY#1/indirect origin displacement1 versus native root+1 and origin
displacement1. No source/result field or budget increase is needed. Arrays-only
and an additional production leaf are not the assessor's recommendation.

[Corrected AR-P56packet](00-ambiguity-register.md#ar-p56-corrected-exact-approval-packet)
now names exactly three existing proof owners and one new register-index test,
the pointer/root/offset/maximum return, originalYChanged=false helper argument,
optional physical record, exact no-new-home/source/V obligations and complete
500/700/500/700caps. Actual fit is still unmeasured. Default scalar/LowByte tests,
all qualified helper locations, main/effects, fixture/producers/lower-control,
public API/schemas/runtime, eleven oracles and agent/config/permission files remain
excluded. No fresh assessor or bounded fix review is claimed; this is one design
assessment with requested factual supplements, not implementation qualification.

Direct implementation approval remains pending. No new file/helper/API/source/
test change is made. Tasks15/17/1.3.3stay blocked at that exact ruling;26/40,parent
38/48,v4four/ten and original963/725/all behavior/resources remain unchanged.
Fresh build/typecheck,101focused/45boundary tests and source/oracle/format/link
guards cover this read-only continuation. No VICE/runtime/expert-parity/publicsize
or full-phase pass is claimed; the last full2860/13knownfail/two skips remains RED.

Final10:20CETchecks pass: six targeted Markdown files under existing format-ignore
policy,169local links, exact40tasks/26verified/three blocked,56ARs/55resolved with
AR-P56the only open decision. All complete compiler-source/test-support inventories
and hashes, f96f43e3,11oracles, input sources, producers/fixture, expert/spec,
agents/routing/policy, non-integration portfolio and empty index remain unchanged.
All four actual diagnostic JSON identities reconcile, including the corrected
state supplement; no proposed source/test path exists. The same assessor's final
verdict and mandatory field-offset correction are durably recorded, not counted
as product qualification or a new review context.

Cleanup:done—only265temporary files in the exact owned indexed-discovery-jPxbWu5l
directory are removed after durable facts/source/image/state/cost/assessment and
approval boundaries are recorded. No unrecognized entry/symlink, user file,
worktree or another session's content is removed. All tools/assembler/reviewer
processes have finished and no raw artifact needs to survive. Execution Plan
Updated:yes. This completes read-only next-scope discovery only; exact AR-P56
implementation approval remains due. No staging, commit, push or task promotion.

### Approved indexed-store implementation —2026-10-26

At11:39CETthe user's **“Yes - proceed further”** directly approves the sole exact
AR-P56four-path/API question, including mandatory reference pointer/Y offset proof.
This ruling precedes every new source/test file or code/API edit. Resume task15
partial;17/1.3.3return to not-started. Preserve hard500/700/500/700caps, old scalar/
LowByte checks/tests, every oracle and all source/producer/fixture/agent exclusions.
First add real initialized-source admission REDs through the unchanged fixture;
then implement and measure fit. No automatic extraction/helper export/leaf/cap
increase, generalized engine, source workaround or old-test amendment is granted.
Original e221a08c894bd1a8b1a505115f437de2c5582e76phase baseline,26/40,parent38/48,
v4four/ten and the RED composite/no GREEN commit/push remain unchanged.

Two real initialized packed-field X/Y admissions first reach meaningful observer
RED, with unchanged frontend/reference/selected closures succeeding. At11:47CET
the exact factor/parent/layout draft and new test are implemented with verification
pending; task15stayspartial. No other source/test/producers/fixture/old tests or
agents change. The source index record remains separate from a nonexistent selected
home, and reference packed displacement remains in Y for footprint decoding. Normal
formatting/actual caps are checked first; an overrun stops this unit before any
further implementation, extraction, new file, dropped proof or admission claim.

Actual first fit passes: factor467,parent682,leaf458,newtest20within500/700/500/700.
Fresh build passes; all101qualified scalar/LowByte cases pass, while both new
admissions still reject. The new global-initializer predicate incorrectly requires
each nested literal to name its destination before its enclosing aggregate owns it.
Actual initializer records show the unnamed inner array is consumed by the pure
global struct construction. Correct only this new predicate: absent nested
destination is allowed within the otherwise constant/aggregate/own-global-store
initializer class; a present foreign/non-place destination still rejects. No
producer/fixture/source or old test changes. Both original admission cases then
pass. New-test heterogeneous tuple arity first fails strict compilation; making
only its optional fourth policy parameter explicit corrects the test mechanism.

Complete new concern now has59cases. Fresh build, strict NodeNext/ES2023 root
compilation and160focused cases/three files pass, including all101old cases with
unchanged bytes and assertions. Final normal-format sizes factor469/500,parent
685/700,leaf458/500,newtest596/700. New packed offsets0/1/255, word bounds1/4/8,
constant/global-byte RHS, exact13/14byte native work and zero selected frame demand
are checked. Pointer metadata/whole occurrences/occupancy/foreign uses, source/
typed origins, actual binding, state/caller and dummy-address negatives accompany
the positives. V/Y caller counterexamples also directly exercise the restricted
helper, separately from outer authentication. The independent decoder witness
retains reference02FF+Y1dummy0200 versus native0300+X0dummy0300, same final target.

The four-path sortedpath/SHAcompactJSON review identity is
`4a3c4c5659e4ad0373ee168ae4bd231f88f9dd0e2ff5b1be43f290dd956df03d`.
Source is frozen for native/resource and independent bounded review; old tests,
main/effects, every producer, shared fixture, lower-control/config and11oracles
remain unchanged. Actual fit is now measured, not a qualification of all task15.
Full directed/checkpoint, sequential defined-answer native cases and bounded
correctness/SFA/platform/output reviews remain due. No GREEN commit/push.

The frozen4a3c4c56unit now has first bounded correctness/high,SFA/xhigh and
platform/xhigh reviews clear with **no findings**. Native Astra model overrides
are explicit and supported; no agent/config/permission files change. All four
files are read fully by each assigned role; base receives the exact changed
concerns/current full additions and before/after guard, specialists trace their
distinct interfaces. No hidden qualification answers or denied external evidence
is used. SFA/platform shorthand lineage is recorded here using the literal exact
knowledge identifier BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b,
expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15. Their status is bounded
static inspection, not independent raw-artifact/execution or phase qualification.

Primary native verification passes16reconciled ACME0.97images and64sequential
pinned VICE3.10PAL/6581cases: four ordinary initialized sources×X/Y×reference/
selected×incomingP20/29/e4/ed. There is no post-startup source-input injection.
Padding is initialized2, all eight rows0and any RHS global explicitly7/128/255;
actual SYS inputs before startup provide A/X/Y17/55/aa and the chosen P. Root
uses the unchanged pinned VICE helpers, not a new persistent runner or fixture.

Each source independently predicts the first bound row bytes equal to value and
the remaining rows0; every intermediate prefix is checked at actual update PCs.
Padding remains2and exactly one CPU store occurs per ordinal in order. Selected
A=value, held register=ordinal, other index=call-entry value, N/Zderive from value,
V=call-entryV, C=entryCfirst iteration then0, D=0/originalIand SPbalance all pass.
Thus set V actually survives repetitions without being silently equated to the
reference. Before restore, the held register equals the bound. Genuine SYS E147
has P&CFunchanged and SP=entrySP+2; CPUport/DDR,BASIC03–06and CIA2DDRAreadbacks
match entry. E155records the actual outgoing A/X/Y/P, not invented promised A/X/Y
values. Both constructions are tested against these independent source/state
answers, not merely against each other. Static decoder expectations distinguish
dummy addresses; ordinary VICE watchpoint counts are not a complete bus trace.

| Native source | Offset / bound / RHS | Reference PRG / work | Selected PRG / work | Startup reference/selected | Restore reference/selected |
| --- | --- | --- | --- | --- | --- |
| Array1 | 0/1/constant7 | 191/75 | 119/13 | 69/64 | 27/22 |
| Field4 | 1/4/constant7 | 196/75 | 124/13 | 74/69 | 27/22 |
| Edge8 | 255/8/global255 | 964/76 | 892/14 | 841/836 | 27/22 |
| Middle4 | 127/4/global128 | 580/76 | 508/14 | 457/452 | 27/22 |

Each row includes both X/Y and all four P states. PRGs include2loadheader+
12BASICstub+startup+6main+work+restore. No padding or helper is omitted. Reference
frame4RAM/2ZP becomes0/0; generated-program stack2remains. BorrowedZP02/03with
actual saved03becomes none; canonicalstate5becomes4. Total72PRG bytes disappear:
62work plus5startup/5restore, not a six-frame-byte-to-code subtraction. Global
data remains separate RAM: rows8; packedField4nine; Edge8packed263plus RHS1;
Middle4packed135plus RHS1. BSS/state/frame bytes are not initialized PRG payload.
Observer calls preserve every actual serialized source and request/certificate
content in the eight selected constructions. Seven original canonical-none
artifact lengths/SHA-256and empty diagnostics freshly reproduce unchanged.

Exact UTF-8native template without final newline:

```text
module Game;${decl}${rhsDeclaration}function work():void{for(let i:word=0;i<${bound};i+=1){${place}[i]=${rhs};}}function main():void{work();}
```

Array1decl is let rows:byte[8]=[;0];,place rows,empty RHS declaration,rhs7.
Other decl is struct Saved{padding:byte[${offset}];rows:byte[8];}let saved:Saved={padding:[;2],rows:[;0]};,
place saved.rows. Field4uses empty RHS declaration/rhs7; Edge8/Middle4use
let value:byte=255;/let value:byte=128; and rhs value. The table fixes every
parameter. No actual whole-input fixture or caller/library byte changes.

| Native image | Source SHA-256 | Reference PRG SHA-256 | X PRG SHA-256 | Y PRG SHA-256 |
| --- | --- | --- | --- | --- |
| Array1 | `b9868b03f2da023608a92c16ab6f2f1a5a348366caed0dd0fcfc7e19286b9afe` | `d0d910d9a860b10a709fdc5dc98bf2e2d521a0e3441b435862e9bdf9b3a44f2b` | `89629ccebc8eeb4d93629e37903933f83647f09a64d59ae07e5066fcc7611752` | `3143b8a4c7d363ac30a110633929272e3a058bd2c09da5ca62d254dd3b1d39dd` |
| Field4 | `a63fc0ee7463cf6738380dc4b3028f7c90b1a7c5d80a4795eedd2c1411fbc4ce` | `80830146f2788154feb038b45f1b0d4e6313e0b69d478c78e99aca4027de974f` | `92026129fc0fba59624aa9ec2a8e4d96d64a6627309cf7ba833b925862329934` | `f8cc7a91bfd2d7f21160c419eb79300cb4f48a6920279ce9d87184b01635ec10` |
| Edge8 | `ac1039eaf0ed375f015fb5959fa4cfab8546c63c4ff27a899399a64cace2d2ac` | `87e00e10d4f25cc6ea24012f36f96f3e4f07e2ecdad77561ce1a4d159b4cda86` | `6d23e2cbc29e4f621a3d7ffa86a70069af26216e566ff5554fb1631982526a1d` | `b9de174696a7a81df5c800d7ea68cf6ca375bae80c3322985ccfe3dc13dbe9d2` |
| Middle4 | `51adf64ad45d855f9d7cb917f907fc12ad86354582b3f97332c0113ed30276cd` | `613b203595d74187742eceeb74c84800644b229031a443eb6d7041dbaf270eba` | `207b560c06442ef0be370997ee8e00ab0a10b640ffe3e6dd69a71bffb79aadf9` | `e71dc27d0b730b5084a1592041b604c549ab790b0a8871926a3c7c3f998f210f` |

Actual native image/result JSON identities:
`976cdc51fe3c93108eb6deab927ef87e49c5f599d3177f730ae6c3ac92f51b5e` /
`8e321e72d08bf97ce7b8700dc118347c72305e99fdd6d4429e9cb249c027a702`.
Actual image-derived costs are not expert-optimality proofs. The output auditor
receives complete startup/initialization/data/frame/call/restore costs and fresh
assembly/results only after the three static reviews finish, preserving the
four-total-agent ceiling. That independent review and full root-owned checkpoint
remain pending; any surviving output debt stays explicit, not waived by native
success. Status:VICE-verified/hardware-unverified,PAL/6581only. No elapsed timing,
full bus, arbitrary external firmware/stack, four-profile, actual input963/725,
publicsize, task15or phase qualification. Source stays frozen4a3c4c56;no commit/push.

Fresh complete checkpoint: frozen install0.40s/build0.41s/typecheck0.71s pass;
the unchanged explicit directed cohort plus this new concern passes1229cases/
81files194.97s, and45import-boundary cases pass2.30s. Full yarn test297.24s reports
compiler2919passes/13known frontier failures/two existing skips across179files.
All59new tests add to the prior2860passes, with no old pass/negative removed.
The same12unfinished candidate-construction failures and one rejected-baseline
cost-validator failure remain; CLI62,language-server21and VSCode6pass. Root suite
is not reached. No new failure/skip, green-composite exception or commit is hidden.

Root preservation checks reproduce the frozen four-file4a3c4c56identity and exact
complete source/test-support inventories: precisely these three existing files
and this one new test differ. All old tests, producers, shared fixture, main/effects,
lower-control, frozen spec/expert, agents/routing/policy, non-integration portfolio,
eleven oracles and empty index stay protected. The16image/64trace identities and
seven original canonical-none artifact identities reconcile. Touched code has no
planning-reference leaks and required public/internal documentation is checked.
The output review is still pending; no new source change follows the completed
static/native/full checks. Task15partial26/40,parent38/48and14remaining tasks stay.

### Bounded indexed-store checkpoint —2026-10-26

The exact approved four-path unit remains at
`4a3c4c5659e4ad0373ee168ae4bd231f88f9dd0e2ff5b1be43f290dd956df03d`:
factor469/500,parent685/700,leaf458/500,newtest596/700. Two meaningful admissions
RED→GREEN precede the final59new/101unchanged focused cases. Full directed1229/
81files,boundaries45,actual ACME16images/VICE64PALcases and original none/oracle
identities pass. Correctness,SFA,platform and output reviews all find **no defect
introduced by this bounded observer unit**. No private-helper move/export, new
production module, producer/fixture, old-test, main/effects, lower-control or agent
change occurs. This is semantic/storage/physical/native proof, **not output parity**.

The output review independently identifies four MAJOR inherited producer defects.
Under the standing PRIME DIRECTIVE to file measured expert-output gaps, the primary
reads the65open issues once and checks#53/#114loop,#88localfill,#79memorywrapper,
#109returnedconstant-call and#51layout scopes. No existing issue silently acquires
a different contract. Two closely related finite-loop gaps share the exact same
existing owner and one issue with separate acceptance; global startup and sole-
void continuation get their own bounded owners. Existing issues are not edited,
closed, relabeled or treated as waiver; native issue creation performs no Git push.

| Output finding | Current / equivalent expert expectation | Distinct durable owner |
| --- | --- | --- |
| IX-MC-001 one-trip control | Array1work13bytes/21cycles→6/12; PRG119→112with other terms fixed, frame/stack unchanged. Counter0and trip1are proved; changed X/N/Z/C still need real caller proof. | [#119](https://github.com/blendsdk/blend65/issues/119), existing finite schedule/ordinal fold |
| IX-MC-002 invariant RHS reload | Hoist stable A before exact store loop: work13/14bytes unchanged; Field4cycles63→57, Edge8 135→107, Middle4 71→59. Preserve source reads/effects, alias/async and flag proof. | [#119](https://github.com/blendsdk/blend65/issues/119), existing loop/lowering availability |
| IX-MC-003 fully unrolled global fill | Edge8padding255stores767bytes/1022cycles→ascending fill12/3063; PRG892→137only with all other terms fixed. Saves755bytes but costs2041cycles: explicit size/time trade-off, not Pareto win. | [#117](https://github.com/blendsdk/blend65/issues/117), initializer/startup owner; related#88local case |
| IX-MC-004 sole void leaf wrapper | Field4main JSR/JMPplusworkRTS7bytes/15cycles→fallthrough; PRG124→117, complete nominal206→191cycles, program-attributed call-stack2→0while startup/SYS/external duties remain separate. | [#118](https://github.com/blendsdk/blend65/issues/118), existing call/layout owner; related#79/#108/#109/#51 |

All expert targets are instruction-derived expectations, **not assembled or
executed replacement artifacts**. Their independent deltas cannot be added without
combined construction/closure/placement and behavior proof. Cycles assume documented
same-page NMOS branches and exclude IRQ/NMI,VIC stalls and firmware latency. The
global-fill case deliberately keeps runtime initialization and ascending write order;
preloading bytes alone does not prove repeated-entry initialization. Any initializer
call/helper, changed stack/startup graph or page repair must be charged. Neither
large diagnostics nor routine-local matches stand in for the actual input workload.

The findings ledger's **accepted** means accepted for correction under these explicit
RD-08issue owners, using durable mandatory debt-filing authority. It does not dismiss
or waive a finding, approve a producer fix, defer/weaken input limits, or authorize
output/phase/release clearance. No producer change is within this four-path unit.
Existing#114/#115/#116remain open too. FO-SF-002and all six final phase lenses remain
due. No bounded fix/re-review round is claimed because no introduced unit defect
requires a fix; later producer recipes need their own exact approval/independent
behavior, assembly/resource, native and final-observer proof.

Fresh full compiler2919passes/13same known frontier failures/two existing skips;
other owned packages pass and root suite is not reached. Task15stayspartial until
checked/split or non-elided/main/nested/early-return/indexed-read/native-retention/
expanded/mixed windows,wider transports/raw/status/MMIO/platform/async and resource-
rejected-reference obligations close. The finite frontier/startup/cost/debug and
original four-profile963/725qualification remain subsequent owners. Six implementation
and eight hardening/qualification tasks remain;26/40,parent38/48,v4four/ten unchanged.
All source remains frozen after review/native/full checks; no staging/commit/push.

Final12:50CETvalidation passes: exact four-path4a3c4c56, all caps, all56resolved
decisions,40tasks/26verified/task15onlypartial,171local links, code/Markdown
formatting under the repository's ignore policy and whitespace/documentation/
planning-reference checks. Full source/test-support inventories and hashes prove
only the approved three existing files plus new test changed; every old test,
producer/fixture/main/effects/lower-control,11oracles,frozen spec/expert,agents/
routing/policy, non-integration portfolio and empty index remain unchanged.
Seven original none artifacts and16native image/64trace identities reconcile.
GitHub confirms#117/#118/#119open with the exact assigned titles. No old issue
mutation or automatic Git push occurs. Execution Plan Updated:yes. Cleanup follows
only after the complete durable approval/source/behavior/cost/review/debt/failure
record; this is bounded indexed-store proof verification, not task/phase closure.

Cleanup:done—only101temporary files in the exact owned indexed-proof-23FQ4Iyy
directory are removed; no unknown entry, symlink, user/worktree or other session's
content is deleted. All four reviewers and every native/checkpoint/issue process
have completed, with no raw artifact needing to survive. Final preservation again
confirms4a3c4c56, all old tests/producers/fixture/oracles/frozen/agents/policy/portfolio
and empty index. No source change follows any review/native/full qualification;
task15partial26/40,parent38/48,14remaining tasks, all output debts and original
whole-input/phase gates remain explicit. No staging, commit or push.

### Next Original-induction discovery —2026-10-26

The user's **“proceed further”** resumes read-only task15boundary discovery, not
a new file/API/helper move, old expectation amendment, producer edit or cap change.
Required documents/schema,56resolved decisions, passed preflight, original381case
spec gate, task14owners and source4a3c4c56/eleven oracle identities are checked.
Fresh build/typecheck/160focused/45boundaries pass. Last complete compiler2919/
13knownfail/two existing skips remains the prior endpoint, not a new full run.

Fresh96isolated plus24unchanged actual-input constructions under all six policies
and bounds on/off expose distinct source shapes; every construction/serialization
closes. Acquisition remains blocked by asynchronous borrowed backing under every
policy. Saved Original passes borrowing but rejects nested/prefixed induction;
other policies stop earlier on wider selected-loop/source/state composition. The
actual snapshot compatibility owner has35machine blocks, two nested counters,
parent-next child and early returns. Actual keyState has59machine blocks under
checked XFirst; its candidate loop is non-entry/non-elided and other proof families
remain present. The raw main loop likewise has non-elided first tests; X uses two
ordinal reads while Y keeps the word representation. None is the proved leaf.

Fourteen initialized/generic nested diagnostics cover the exact old constant nest,
parent-next1..8child including zero-trip last entry, a non-entry prefix, sequential
loops, nested break/continue/return, two-counter bounded raw reads and retained
standalone zero-trip rejection. They expose both entry/parent/one-owner guards and
per-loop source checks that lack sibling ranges. The final owner→bounds Map also
keeps only the last loop for a shared function. The existing pure source-bound
merger already retains all loop maxima with their pending premises; using it cannot
replace complete joint induction/source/home/physical proof or authorize bounds
to escape early. Exact nested word homes are genuine disjoint two-byte requests
in both actual layouts, not selected register-counter reconstruction.

Effects574lines has the approved608ceiling; its old loop concern is694/700and
contains an explicitly rejected constant-nest row. AR-P57records the scope/capacity/
old-test stop before any code. The single independent assessment will compare a
direct existing-owner extension, one focused production extraction and checked-
store-first work using fresh facts, without the primary's preferred answer. No
file, helper, API, source/test/producer/fixture or agent change is made. Counts
26/40,parent38/48,v4four/ten and all output debts/input963/725gates remain unchanged.

The single Astra/xhigh assessment returns **Simplify**, selecting existing-effects
composition and narrowing out new cross-counter raw-address arithmetic and new
call handling. Existing `ordinalBoundResolver` does not recursively prove arbitrary
two-counter sums; a merged source Map is not that proof. Full-function JSR rejection
also remains, so neither the real saved main nor keyState is promised to pass from
this structural subunit alone. No production leaf/extraction is justified before
direct fit is disproved, and checked-store-first still misses the actual shapes.

[Exact AR-P57packet](00-ambiguity-register.md#ar-p57-exact-original-induction-approval-packet)
now proposes only existing effects608→700cap, one new500line Original-composition
test and migration of the single constant-nest negative row at old-loop317to the
same exact source/new positive. Standalone zero-trip and every other old expectation
stay unchanged. New code/API/producer/helper movement and agent files remain absent.
The assessor reads actual ordinary sources/interfaces and parent-supplied fresh
facts only; no denied raw evidence, hidden answer maps or previous verdicts. Native
override Astra/xhigh is explicitly selected and supported. This is design advice,
not user approval or implementation qualification. All actual fit/runtime/cost
and bounded reviews remain due after exact approval.

Fresh old Original-loop/Original-field regression run passes110cases/two files,
in addition to160selected-focused and45boundary cases. All443entry source/test/
fixture/producer/policy hashes and inventories,11oracles and frozen/agent/routing/
portfolio/index guards remain unchanged. No source edit triggers a new full suite;
last2919passes/13knownfail/two skips is still the prior complete endpoint. No ACME,
VICE,new artifact parity or whole-input limit qualification is claimed this run.

Diagnostic JSON identities:96isolated
`84dcb4d76fff6157f5d7cfc5328e0743a5efc192feee79c9e84477f00e4aac62`;
24actual`9f23010ac6c93c574f70a0b54ac35327793966c714b10212a437e44f90c3fbfc`;
14nested`c266f907636a9e6d4b49ea85a4ad5c322c7277c7aa25fec6b84400e23ec4029a`.
The nested record is finalized after explicitly checking serialization; earlier
closure-only scratch rows are superseded, not runtime evidence. Actual callers
are unchanged test/rd05/fixtures/input-caller.blend and input-saved-caller.blend;
the installed library source SHA is d5c3129c80fea3cdc13e08edc22b53241b10f4a86cde9ef4524306baa23e29c7.
Reproduction uses the unchanged effectFixture for isolated sources and the same
real load/analyze/semantic/closure/lowering/shared/serialization owners for actual
sources, six named existing policies and bounds on/off on PAL/6581. These counts
are diagnostic constructions, not public-size builds or new test/oracle additions.

Status: **Verified partial**, claim kind **Fact** at checked construction/static
observer rejection/serialization; next acceptance/runtime/parity **Unknown**.
Expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15, exact knowledge
BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b;
IL#control-flow-and-layout/#two-oracle-proof,SFA#lifetime-model/#final-storage-closure,
MOS#instruction-effects/#bus-visible-accesses, source keysMOS-PGM-1976/MOS-HW-1976/
MOS-6510-1982/P3/spec4. No new output cost or byte threshold is inferred. Only
plan/owning roadmap status records change; exact AR-P57approval is the next action.

Final13:37CETchecks pass:270focused/45boundary regressions,134unique construction/
serialization diagnostics,443entry file hashes and complete scoped inventories,
all11oracles and source4a3c4c56unchanged. Six touched Markdown/status records pass
targeted format checks under the repository ignore policy,173local links and
whitespace. Exact57ARs/56resolved/only57open and40tasks/26verified/15,17,1.3.3blocked
with reasons are verified. Proposed new test is absent. Frozen spec/expert,agents/
routing/policy, non-integration portfolio and empty index remain unchanged. The
single assessor and all verification processes have completed; no pending output
or runtime tool is inferred. Execution Plan Updated:yes; no staging/commit/push.

Cleanup:done—only25temporary files in exact owned observer-next-7p9oi9jn are
removed after recording the complete facts/assessment/scope/evidence limits. No
unknown entry, symlink, user/worktree or other session content is touched. No raw
artifact needs to survive this read-only discovery. All443entry file/eleven oracle
hashes are checked again immediately before cleanup; no source/test/API/helper/
producer/fixture/agent change occurs. Exact three-file AR-P57ruling remains pending,
26/40and38/48unchanged,14tasks remain, no GREEN commit/push or new qualification.

### Approved Original-induction implementation —2026-10-26

At13:53CETthe user's **“i approve, proceed”** directly approves the sole exact
AR-P57three-file/cap/one-row question. The ruling precedes code/test changes.
Resume task15partial with meaningful real-source REDs, then existing-effects
composition capped700and new test capped500. Remove only the old constant-nest
rejection row, preserving its exact source as a new positive. No extra production
file/API/helper movement, new calls/arithmetic analysis, producer/fixture/agent
or other old-test/oracle edit is authorized. First measure normal formatting and
stop on any cap overrun. Counts26/40,parent38/48,v4four/ten do not advance.

All10new admission cases first reach meaningful residual RED through unchanged
real frontend/reference/selected construction. The existing constant-nest negative
is not moved yet. The three-file unit is now implemented with verification pending:
existing effects authenticates every loop before provisional sibling bounds,
checks initializer-barrier reachability and complete parent-next dependency closure,
retains both actual word-home/source/control checks and composes final per-function
bounds through the existing pure merger. No call or arithmetic admission changes.
Task15remains partial; normal formatting/caps/build/admission verification follow
before any larger test additions or accepted-outcome migration.

First normal fit is623/700effects and42/500new test. Build passes; eight admissions
pass, while nested Boolean exits expose an existing transparent-alias boundary:
equal false returns share one actual LDA0/RTS through an empty co-located label.
Within the approved loopRepresentation owner, prove only that exact pure Boolean
constant, matching value/load/RTS and validated empty fallthrough chain. Arbitrary
jumps/instructions or different return values remain rejected. No producer or
source workaround changes. Effects644/700and fresh build/all10admissions then pass.
Only the approved old constant-nest row is now removed and its exact source is
retained in the new positive. Expanded source/maxima/home/control/alias/raw/stale
premise regressions are implemented with verification pending; normal fit follows.

Complete first unit now fits effects644/700,new test368/500,old test694/no growth.
Fresh build/strict NodeNext-ES2023 owned-root compile and266focused cases/five files
pass:35new composition tests,71remaining old-loop tests and160unchanged selected
tests. Only one old literal is removed; normal formatting reshapes its unchanged
single-row callback, with no source/expectation/plumbing change elsewhere. All
other443entry source/test/fixture/producer/policy hashes and eleven oracles stay.
The new invalid-graph test initially loses a TypeScript property narrowing inside
a callback; retaining its local terminator corrects only new test plumbing.

Frozen sortedpath/SHAcompactJSON three-path review identity:
`57bf75072cf073d887a19b9829fe29e3e6541c4f75f108ef1f171c3081ab79b3`.
Independent correctness/SFA/platform reviews and sequential defined-answer native
qualification now use this frozen unit; output review follows within the four-
total-agent limit. Actual call/raw/arithmetic/async and public-size gates remain
open. Task15partial26/40; complete checkpoint and native/review results are pending.

The frozen57bf7507unit passes28ACME0.97reconciled images/56sequential pinned
VICE3.10PAL/6581cases: seven ordinary sources×bounds on/off×reference/selected×
incomingP20/ed,with actual SYS A/X/Y17/55/aa set before startup. Sources are the
five new positive templates, plus source-initialized stop1variants of prefixed and
nested-exit Boolean functions. No source input is injected after initialization.
All actual typed store PCs check independent expected A, written prefixes, exact
word counter values, SPbalance,D0and originalI. Watchpoints check ordered store
indices/counts. The exact migrated constant-nest source leaves data uninitialized:
no unknown byte is assumed zero; only written prefixes and fully overwritten
final values are observed. The parent-next case additionally stops at actual
false headers[outer6,inner8]then[outer7,inner8], proving the final zero-trip child.
Boolean results are checked at actual caller return, not presumed from a void ABI.

Independent final answers: constant nest64writes/final eight7s; parent-next28/
[0,0,1,2,3,4,5,6]; prefixedstop0eightwrites/final0..7/result1; stop1zero writes/
all0/result0; sequential16writes/final1..8; nested-exitstop0sixwrites at indices
[1,2,3,3,5,6],values[0,0,0,2,4,4],final[0,0,0,2,0,4,4,0]/result0; stop1zero/all0/
result0. Real SYS E147P&CF/entrySP+2,ports00/01,BASIC03–06,CIA2DDRAreadbacks and
E155actual A/X/Y/P delivery pass. Normal outgoing A/X/Y have no invented fixed
values. Runtime status **VICE-verified/hardware-unverified**, PAL/6581only; ordinary
CPU-store watchpoints are not a complete dummy-bus trace or elapsed-timing proof.

| Native source | PRG bounds off/on | Main/work bytes off/on | Startup / restore | Frame RAM/ZP | Program stack |
| --- | --- | --- | --- | --- | --- |
| Constant nest | 216/232 | main132/148 | 43/27 | 8/2 | 1 |
| Parent-next | 261/277 | main151/167 | 69/27 | 10/2 | 2 |
| Prefixed stop0 | 205/221 | main6,work86/102 | 72/27 | 4/2 | 2 |
| Prefixed stop1 | 207/223 | main6,work86/102 | 74/27 | 4/2 | 2 |
| Sequential | 280/314 | main170/204 | 69/27 | 10/2 | 2 |
| Nested exits stop0 | 335/351 | main6,work216/232 | 72/27 | 13/2 | 2 |
| Nested exits stop1 | 337/353 | main6,work216/232 | 74/27 | 13/2 | 2 |

Each row includes both actual reference/selected constructions and both P states;
their assembled PRGs are byte-identical per row. PRG accounting is2loadheader+
12BASICstub+startup+all retained functions+restore, with actual checked branches/
traps charged. The sequential checked difference34includes final branch repair,
not a guessed2×16. Separate global/BSS RAM is8data, plus1stop for prefixed/exits;
platformstate5and actual frame are separate, not PRG payload. All28images borrow
ZP02/03with saved03, startup held0/transient1; program stack1/2is not an unrestricted
ROM/interrupt bound. No observer-emitted code/storage/helper/padding is introduced.

Exact source templates are the new concern's CONSTANT_NEST/SOURCES strings;
the two stop1variants replace only let stop:byte=0;with let stop:byte=1;before
analysis. They are diagnostic source variants, not product/library/fixture changes.
Image/result JSON SHA-256:
`f6bfb310bfc073887455d7bf6199fd466aa701f88445268b9c9439c75c39f003` /
`5b094443ef7434607e76d0909f0e91c1c6d46a6baba9327eb55af0b636003be9`.
Fresh seven original canonical-none artifact lengths/SHA256reproduce exactly with
empty diagnostics. Root byte/hash/source guards validate the one literal deletion
followed by ordinary Prettier formatting; no other old test or producer changes.

Correctness/high,SFA/xhigh and platform/xhigh bounded reviews find **no findings**.
Each reads all three complete files and its relevant interfaces, with explicit
supported Astra overrides, no shell/children/edits or denied/hidden raw access.
Their static endpoints and parent-supplied execution/hash limits are retained;
lineage is expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15, literal exact
BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b.
The output auditor receives actual complete cost components plus fresh assembly/
source/state answers in a later wave. No independent binary execution/read claim
is inferred from reviewer agreement. That review remains pending.

Fresh checkpoint: install0.40s/build0.37s/typecheck0.88s pass;1263directed cases/
82files308.59s and45boundaries4.16s pass. Complete yarn test381.31s reports compiler
2953passes/13same known frontier failures/two existing skips across180files. Count
delta is35new tests minus the one migrated old row, not removal of a negative
without replacement. Twelve unfinished constructor cases and one rejected-baseline
cost-validator case remain. Other packages and root reach are reconciled below;
the composite stays RED and no commit/push or task15/phase promotion occurs.

Root reconciles the same exact13failure identities: four profiles×32/64-site
constructor cases, four72-function constructor cases, and one rejected-baseline
cost-validator case; no new failure/skip. CLI62,language-server21and VSCode6pass;
root tests are not reached. All14native reference/selected PRG pairs reproduce
exact bytes. The helper used for all56starts validates the executable and ROMs
before launch: x64scSHA f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74;
kernal-901227-03.bin8192B/SHA83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721;
basic-901226-01.bin8192B/SHA89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d;
chargen-901225-01.bin4096B/SHAfd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420.
These are the unchanged existing helper's mandatory admitted identities, not a
new unverified ROM installation or physical chip-revision claim. No tool denial
or protected-path boundary is bypassed; every external execution stays primary-owned.
Source57bf7507and original selected4a3c4c56remain frozen pending output review.

### Bounded Original-composition checkpoint —2026-10-26

All four independent bounded reviews find **no introduced observer defect** in
the exact approved three-path57bf7507unit. Normal-format caps fit644/700effects,
368/500new test and694/no-growth old test. Ten meaningful source admissions first
fail residual closure, then pass without source/expected-value relaxation. Current
35new tests/71remaining old-loop/160unchanged selected tests pass, as do1263directed/
82files,45boundaries,28ACME images/56defined-answer PAL/6581cases and all seven
original none identities. Eleven oracles and every excluded source/producer/
fixture/main/selected-loop/agent/frozen/config boundary remain unchanged. New proof
emits no instructions/storage or public API, and adds no arithmetic/call machinery.

One inherited MAJOR output defect survives: **OC-MC-001**, a bounded word index
still constructs an unnecessary aggregate pointer. The root inspects68open issue
scopes once and reconciles#53/#114/#116held counters,#89byte-index floors,#81copy
alias specialization,#104borrowed-base/#105guarded-word read. None explicitly owns
this retained-word/static-root byte-store view. Under the standing PRIME DIRECTIVE
to file measured output gaps, create[#120](https://github.com/blendsdk/blend65/issues/120)
as the exact RD-08direct-index child, with#89related, without editing any old issue.

| Boundary | Current / analytical equivalent expert | Explicit cost limit |
| --- | --- | --- |
| Parent/OFFstore at08B4–08C8 | Ten-instruction effective-pointer construction/store21bytes/30cycles→LDY j.low;LDA i.low;STA data,Y9bytes/13cycles | 12code bytes and17cycles per write;28writes save476nominal cycles |
| Complete parent/OFFPRG | 261→249bytes only if all other terms stay:14header/stub+69startup+139main+27restore | Keep all10RAM/2ZP frame reservations, sourceglobal8/platformstate5, programstack2 and startup0held/1transient; no unproved pointer/startup/induction savings |

The expert target retains both word counters, exact parent-next initialization/
unit updates/zero-trip, source store addresses/values/order/count and A at stores.
Changed Y/flags and complete both-layout dummy/fetch/visibility obligations still
need the actual continuation proof; no void-based dead-state assumption. Actual
old data0904..090Bhas no page crossing. A different final placement needs fresh
footprints. The next word update sets carry and overwrites arithmetic flags, but
that local fact is not a blanket ABI rule. Equivalent expert replacement is
**not assembled/executed**, so249bytes/476cycle savings are analytical, not a
qualified alternative or a whole-program win. Never add other issues' deltas.

The smallest future producer fix belongs to existing directAggregateAccess/
directIndexInstructions in lower-aggregate and its address owner: consume a proved
byte-addressable word view without requiring held-counter representation. The
approved observer unit does not grant either producer, new recipe or exception
edit. The ledger's **accepted** means accepted for correction under mandatory
debt-filing authority, not waived/dismissed, not current producer-fix authority,
not permission to defer/relax963/725limits or pass full output/phase qualification.
Existing#114–#119remain open; final six-lens/FO-SF-002closure stays due.

| Native source | Exact compact source SHA-256 | PRG off / on SHA-256, identical reference/selected |
| --- | --- | --- |
| Constant | `477f8518adb316010855b77ff1dab5361314aebeafc98c9795ab4a2785f0862e` | `dbab837cd3f00b6bd1824528460ab9131970753d8ab51c69f55d43b988887931` / `2078acbb9e6fd8e7baf3f143b24f6d8e5831c50180fcf8c854e39dae8f78a1dd` |
| Parent-next | `a29215daeed5f0b376b5ab254fe80df42eaa16c1d5ff551e590a5ba6975bced2` | `6c17e352357ee1c25167003ee3837647eaeaf83da53e1b93c6dec99c6a04217d` / `186bbd56ac0e39638566dac9a5f302cc955cfca2c3e89fa55e99289f209a4084` |
| Prefix0 | `279749be3d6c1e3a7db4ad125c5b49944a4e8f1e6df546ba3793ccc39b604aff` | `d2e1ec628f5563909236d13bac2efa6c734b726697124340447767cd6ba8cf15` / `ebc4d9daa84602a8cc0c8e2cc519b2e95000bc9f4b404acbfe21f605d508cc1d` |
| Prefix1 | `278266548b1911fd84da5ad7c60a35adc4e323d70c71e6e5e3cf0ef2beb64c9f` | `8316f5c6013ed61998807ee0ced72077e10371bf21617085b5ce2dae0052b84c` / `1ec90962a5af165f508ed804e61ed0e527b8d9792280c4c999f1315cecd10517` |
| Sequential | `4297b2a78a897b337f6bf6beefd14a8818a65053f6c72f4a429d87ce43909f8f` | `bd1131f625030afd506a04bdad7e7bae88e314e90cb658014f8f16c5432f7dce` / `c8378dedf81fc660eb8a3841c0780e55d2050c9d0d20877bb6fb6bd0efd04768` |
| Exits0 | `3b75642d6a8cb47f29eccab2255875eb41f5cb3661a262b1f338a8121a78bd22` | `78cf65a5c94d807b54962f8fb1798bc0ad5d974e8094342e448e576db44dfa3e` / `12f185f9543b8403fa155b72500f156eb3236dfe4a628376ac9125c7f751b177` |
| Exits1 | `9b5fdca72a870e2c445368289a33dd2c8be1c69af4959ca4f050771a908b42df` | `d991d06ac1738c5df48cf23679d691af6ea4082d6ad2ee2b614254ddfc71336f` / `51481a59aea829b444aa20a9cc8adb4f6264989bfffc61a93d124d4782e35a71` |

Expertlineage remains2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15, exact
BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b;
ILcontrol-flow/two-oracle, SFAlifetime/finalclosure, MOSinstruction/bus and lowering
loops/loads-stores headings; source keysMOS-PGM-1976/MOS-HW-1976/MOS-6510-1982/P3/spec4.
Reviewers' lineage/runtime/hash metadata is parent-supplied; root owns independent
execution and byte reconciliation. No undocumented firmware, physical silicon,
elapsed timing, full-bus or four-profile result is inferred. Source/runtime proof
is **Verified partial**, not a full artifact-parity or public-size conclusion.

Full2953passes/13same knownfail/two existing skips and root-not-reached remain RED.
Task15stillneeds outside-loop call composition, selected checked/non-elided/main/
nest/early-return/read/native-retention/expanded/mixed families, raw/status/MMIO/
platform/async and unavailable-reference observers. Startup/frontier/cost/debug,
original four-profile963/725and complete phase gates remain. Six implementation
and eight hardening tasks remain;26/40,parent38/48,v4four/ten unchanged. No staging,
commit or push. Final docs/link/identity/cleanup checks follow without code changes.

Final14:39CETvalidation passes: exact three-path57bf7507and644/368/694caps, old
loop bytes equal original minus the one approved literal followed by normal
Prettier formatting, complete443-file entry inventories with only the two approved
updates plus one new test, all eleven oracles and all selected4a3c4c56files unchanged.
All57decisions are resolved;40tasks/26verified/task15onlypartial;175local links,
seven touched Markdown/status records under the repo ignore policy, code formatting,
whitespace, documentation and planning-reference checks pass. Twenty-eight image/
56trace identities,14exact reference/selected PRG pairs and seven original none
artifact lengths/hashes reconcile. GitHub confirms#120open with exact assigned
title. Every reviewer and native/checkpoint/issue process has completed. Frozen
spec/expert,agents/routing/policy, non-integration portfolio and empty index remain
unchanged. Execution Plan Updated:yes; cleanup follows durable complete evidence,
with no source change after qualification and no staging/commit/push.

Cleanup:done—only127temporary files in exact owned original-composition-d4ncxuaj
are removed after the complete durable approval/source/behavior/cost/review/debt/
failure record. No unknown entry, symlink, user/worktree or other session content
is deleted. All tools/reviewers are finished; no raw evidence needs to survive.
Final preservation again confirms57bf7507and all excluded source/test/producer/
fixture/oracle/frozen/agent/policy/portfolio/index boundaries. Counts26/40,parent
38/48,14remaining tasks and every whole-input/output/phase gate remain unchanged.
No staging, commit or push.

### Next source/call observer discovery —2026-10-27

User **“continue”** resumes read-only boundary discovery, not a new call class,
production/test file, helper move/export, cap or old-test exception. Entry confirms
the complete approved Original unit57bf7507,444source/test/fixture/policy hashes,
eleven immutable oracles, current branch and frozen/agent/routing/portfolio/index
boundaries. Fresh build/typecheck and266focused tests/five files pass.

Twenty-four isolated Original constructions and24unchanged actual-input tuples
(six policies×bounds on/off×both callers) close and serialize. The no-call isolated
control passes; prefix/suffix/both/sequential-gap/nested-borrow/conditional-prefix/
loop-callee calls reject opaque induction, as do calls inside a loop or inside an
outer loop but outside its child. Actual saved Original first rejects the keyState
prefix snapshot.rows[column] at input.blend303, before the two outside-loop calls.
Neither the full-function JSR barrier nor that per-use containment gap is waived.
All other saved policies reject wider selected-loop composition; acquisition
rejects borrowed asynchronous backing under every policy. No actual tuple passes.

Existing ordinalBoundResolver proves literals/masks/conversions, not a mutable
local reload or guarded right shift. The already exported guardedOrdinalBounds
query and existing machine ordinalBoundsForFunction consumer can prove per-use
indices with write/call/alias invalidation. No new range solver is needed merely
to inspect their applicability. Such per-use bounds must never become a function-
wide value maximum or an exact raw address. The next exact support/test scope is
not yet chosen; effects644/700,main570and old tests remain untouched.

AR-P58records this scope/capacity boundary before any implementation. One blind
independent assessment will compare existing-query/source-containment-first,
bounded outside-loop call-first and any necessary larger extraction against the
original whole-input goal. No producer, source workaround, extra module/API/helper
or old-test change is authorized by discovery. Task15/17/1.3.3are visibly blocked;
26/40,parent38/48,v4four/ten and14remaining tasks stay. Last full2953/13knownfail/
two skips remains the prior endpoint, not a new complete test or runtime result.

Fourteen supplemental real constructions evaluate the existing use-site queries
without changing either query or observer. Guarded unsigned shift, a masked local
and a short-circuit prefix prove7at the access. Unguarded shift, a later unknown
write and a missing guard on one join path stay unknown. The saved caller's first
rows[column] can use the existing machine query; the second at input.blend318
cannot, because snapshotCompatible invalidates local reload facts. Both accesses
have only255in the current conditional value Map. A diagnostic invocation of the
same semantic query that does not classify direct calls as possible local aliases
produces7at both uses. That invocation **does not prove** the new non-alias premise
and does not accept a candidate. Exact call/storage/raw closure is still required.

Two exploratory mistakes are excluded, not hidden: column=9is correctly rejected
by the frontend with E10240and is not an observer case; the final mutable negative
instead uses an unknown peek. Walking all declared library bodies initially also
included unreachable readInputSnapshot. Final diagnostics use the unchanged closed
reachableFunctions set; the saved caller then has exactly the two keyState index
gaps. An initial scratch assertion that existing query reuse closed both gaps is
false and withdrawn. No product/test expectation, source fixture or oracle changes.

Every measured outside-loop source call retains counter callsCrossed and has no
overlap between that counter home and any direct/transitive callee/helper request
in either actual layout. This is an observed construction fact, not a universal
call-effect certificate. An internal block target alone is not the exact source
callee; helpers, actual source/entry correspondence, argument/result staging,
live state and raw footprints remain required. Calls outside a child but inside
its outer loop must not become outside-loop admissions.

Fresh existing guarded/induction regressions23cases/two files and45boundary cases
pass. Thus289selected existing cases pass this run, in addition to62diagnostic
constructions:24isolated,24actual and14guard probes. None runs ACME or VICE. Exact
diagnostic JSON SHA-256 values:
`282752af83da22915af7a0a8c808686b8b8829c0b266c228fb0bf822c54b3e65` /
`a9d9c3559db0593397c72ada482241e007ab437d97b156a20c23cb04ecaf6558` /
`85413bcfaba20e892cc26a2af55ef926e44247afd3d8a79f9552a66ae5d8fb10`.
The first two use unchanged effectFixture plus real shared closure/serialization;
the last also invokes only the existing pure per-use queries. Some source templates
repeat across diagnostics;62counts constructions, not distinct source programs.

The sole supported Astra/xhigh blind assessor receives these fresh facts and three
bounded choices: call-first, existing guarded-query-first, or one combined context
unit only if genuinely smaller/necessary. It receives no primary preferred choice,
prior review verdict, hidden oracle authority or external scratch/raw access.
Its selection is advice, not exact scope approval. No unapproved call/type/range
API, test row or file is edited while it works; every frozen source hash remains.

The single assessor completes with **Simplify**: choose conservative per-operation
query reuse before call admission. The exact [AR-P58packet](00-ambiguity-register.md#ar-p58-exact-guarded-use-approval-packet)
proposes only existing effects644→at-most668within700, existing main570→at-most586
within its unchanged ceiling, and new size-observer-guarded-uses.impl.test.ts≤300.
No API/result/private helper, production file, query implementation, fixture or
old-test amendment. In particular the outside-loop rejection is not migrated.
The same existing wrapper is called with reachable source blocks/actual entry
first, original checked program/profile and no selected loops; facts are consulted
only at the exact typed use after existing group authentication. No function-wide
or raw-address fact, call permission or stronger reload preservation follows.

This narrows the next unit away from both exact-call target authentication and a
combined context/callee-home engine. Both are real future proof boundaries, but
not prerequisites to qualifying conservative existing-query integration. The real
saved caller is not promised to pass: its post-call reload and calls still reject;
acquisition borrowed asynchronous proof and other selected families remain open.
Confidence is high on the direction and medium on actual readable fit/runtime.
The strongest objection is one more local checkpoint before complete saved-input
acceptance. No new complexity or expectation edits are silently bundled with it.

Status: **Verified partial**, claim kind **Fact** at current construction/query/
serialization/rejection and existing regression endpoints. Future acceptance,
assembled output/runtime/parity remain **Unknown**. Expert lineage is2.0.4,
content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15, router0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8,
knowledgeBLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b;
SFA#lifetime-model/#call-graph-roots-and-escape/#interference-and-reentrancy/#abi-contract/
#final-storage-closure;IL#control-flow-and-layout/#calls-helpers-and-clobbers/
#two-oracle-proof;MOS#instruction-effects/#bus-visible-accesses;lowering#loops-and-induction/
#calls-returns-abi-and-helpers. KeysMOS-PGM-1976/MOS-HW-1976/MOS-6510-1982/P3/spec4.
The assessor consumes parent-supplied lineage and fresh facts, not hidden authority
or denied historical raw evidence; independent static analysis is not new runtime
or byte qualification. No emitted code/resource delta is measured by this discovery.

Only the user's exact next three-file/new-test/budget ruling can resume task15.
Existing spec-first381case gate and all resolved decisions remain unchanged;
the current register has57resolved/only58open. All62diagnostic constructions and
289existing regressions/45boundaries finish; no compiler/test/source/API change.
No ACME/VICE or new full suite is run. Last2953passes/13knownfail/two skips is still
the prior full endpoint. Final source/oracle/plan/link/format/cleanup checks follow.

Final2026-10-27 00:38CETguards pass: all444captured source/test/fixture/policy hashes
and complete scoped inventories,11oracles and Original57bf7507are unchanged;
the proposed new test is absent. Exactly58ARs/57resolved/only58open and40tasks/
26verified/15,17,1.3.3blocked with reasons are checked. Six touched status/decision/
journal records pass targeted formatting under the repo ignore policy,177local
links/AR58anchor and whitespace checks. All62diagnostic record counts/hashes
reconcile. Frozen spec/expert, native agents/routing/policy, non-integration portfolio
and empty index remain unchanged. The sole assessor and every build/test/probe
process have completed. Execution Plan Updated:yes; no staging, commit or push.

Cleanup:done—only15temporary regular files in exact owned
call-composition-discovery-p926d_9d are removed after durable source/query/decision/
verification evidence is recorded. No unknown entry, symlink, user/worktree or
other-session content is deleted; no raw artifact needs to survive this read-only
discovery. Final444file/11oracle checks pass before deletion. Exact AR-P58ruling
remains pending,26/40and38/48stay,14tasks remain;no new implementation, expectation,
runtime/output qualification, staging, commit or push follows.

### Approved guarded-use implementation —2026-10-27

At07:32CETthe user's **“i approve”** directly approves the sole exact AR-P58
three-file/budget packet, before code/test edits. Resume task15partial with new
real-source admission REDs, then existing-query integration only in effects≤668
and main≤586, with new test≤300. No query/helper/API/result change, production
module, call admission/invalidation change, producer/fixture/library/agent edit or
old-test exception. Query input must be reachable blocks explicitly arranged with
the actual entry first: reachableBlocks itself preserves the input array order,
so a non-empty reachable array alone does not establish that precondition.
Counts26/40,parent38/48,v4four/ten stay; no GREEN commit/push.

All12new real-source admissions first fail meaningfully: six at residual Original
containment and six at final typed containment, with successful unchanged frontend/
reference/selected closure. The exact two production integrations are now implemented,
verification pending. Each query gets reachable blocks with the actual entry first,
original checked program/profile and no selected-loop premises. Its per-use maxima
are consulted only for typed containment; ordinary source walks, raw queries,
published bounds and every call/shape/physical gate stay unchanged. Normal formatting,
hard budgets and fresh build/admission checks follow before larger test additions.

First normal fit is658/668effects,583/586main and36/300new test. Fresh build and
all12unchanged positive admissions pass. Expanded new tests now cover failed joins,
mutations, exposed/shared/post-call reloads, pre-guard access, immutable captured
values, per-use versus published bounds, raw-address non-leakage and independent
assembly/inventory/certificate non-mutation. Verification pending; old tests and
all producers/queries/fixtures remain untouched. Query input explicitly places the
actual entry first without changing the surrounding source walk.

Complete first new concern fits185/300;effects658/668,main583/586. Strict full
ES2023/NodeNext owned-root compilation and all38new cases pass, including query-
unknown assertions for every conservative negative, unchanged published255versus
use-specific7, and source/serialization/resource non-mutation. Frozen sortedpath+
SHAcompactJSON identity:bc91b57a441a53b59ca6c84babd038798444fc0226fd28cd2c741fc0bbb37cfb.
Every other444entry source/test/fixture/producer/query/policy hash and11oracles
remains unchanged; old tests are not reformatted or amended. Complete install/
build/typecheck/directed/boundary/full checkpoint now runs primary-owned; bounded
correctness/SFA/host-performance reviews run independently against this frozen unit.
Platform/output follow in a later wave within the four-total-agent ceiling. All
qualified producer and raw/call/async barriers remain; task15partial26/40.

### Guarded-use regression stop —2026-10-27

Fresh install0.39s/build2.28s/typecheck0.88s pass. The first broader directed run
finishes1318passes/one failure across84files in250.19s. The unchanged old-loop
test's nonconstant-start row now returns complete rather than its expected rejected.
Its exact source is seed:word→for(let i:word=seed;i<8;i+=1),called by scan(0).
No source declaration is invalid; the current new query can use the successful
ordinary pretest at each typed access even though no constant-initialized loop
fact was derived. This is not permission to change the protected expectation.

AR-P58explicitly preserved every old outcome, so task15/17/1.3.3stop under AR-P59
before any native/full/output qualification or old-test amendment. The complete
approved implementation/test diff remains frozenbc91b57a; it is implemented with
a failing verification, not a locally qualified unit. No directive is bypassed by
calling the old negative obsolete or by treating the38new passes as full regression
evidence. The composite checkpoint stops at directed failure: boundaries and full
suite in that command are not reached. Prior2953/13knownfail/two skips remains
historical, not a new complete run. There is now an additional observed regression.

The first-wave correctness/SFA/host-performance static reviews find no findings
within their assigned structural/alias/host lenses. They do not execute old tests;
their static conclusions cannot waive this failed expectation or grant an oracle
exception. Output/platform/native qualification remains unstarted, not silently
passed. The next bounded assessment must distinguish a sound new typed-use proof
from exact old-test authority, or identify the smallest compliant restriction.

Read-only diagnosis closes/serializes14variants of the exact failing source:
word seed0/1/7/8/255/256/65535×bounds off/on. Every scan packet has zero recognized
fixed loops, zero conditional range observers and zero selected-counter proofs.
Its two-byte counter home remains in both actual constructions; the per-use query
proves7at data[i] from the successful ordinary comparison. All currently return
complete. No source counter narrowing, recurrence premise, new call permission,
output/resource or native claim follows. Independent source semantics still
require no body access for seed≥8 and i=seed..7otherwise; unwritten bytes in the
exact old source are not assumed zero. A future diagnostic may initialize them,
but must not rewrite the original row's source to manufacture a passing case.

Diagnostic JSON SHA-256:
`571b85889373d3f3afa56d651a06adb848e49c52c7246bf9a84a7eaeb5669e2a`.
This is structural/query evidence, not authorization or assembled runtime proof.
Standalone45boundary tests pass after the stopped composite; they are not falsely
reported as reached by the earlier failing command. All old tests/eleven oracles
and excluded source/producer/query/fixture/config hashes remain unchanged.

One fresh Astra/xhigh independent minimum-correction assessment compares an exact
single implementation-row exception with a genuinely grounded narrower consumer
proof, or a user-owned deferral. It receives no primary preferred option and no
other reviewers' verdicts. Any fourth path, changed old expectation, new cycle/
range analysis, API, helper, cap or query rule stays outside executable authority.
The implementation remains frozenbc91b57aand38new cases remain unamended. No
native/full/platform/output review is dispatched merely to qualify a failed scope.

The independent assessor recommends [exact AR-P59qualification](00-ambiguity-register.md#ar-p59-exact-nonconstant-start-qualification-packet):
preserve production658/583frozen; extend the existing185/300new concern with exact
old wrapped source and wordseed0/7/8/255/256/65535,bounds both; request authority to
change ONLY the old nonconstant-start expected literal at645from rejected→complete
after independent admission evidence. Every source/assertion/plumbing/other outcome
and specification oracle stays unchanged. No new helper/file/API/query/cap/producer.
This is a proposed fourth path, not a current executable exception.

The assessor distinguishes per-use successful-pretest containment from a conditional
fixed-induction rewrite. The strongest counterargument is bypass of the specialized
Original home/continuation proof; generic full-word lowering with no pending facts
still needs actual assembly/storage/behavior qualification under the atomic gate.
No demonstrated semantic hole survives static assessment, but source reasoning and
resource non-mutation are not emitted execution proof. No genuinely small existing
cycle discriminator was verified; a new traversal would be more machinery, not a
free repair within main's three remaining lines. User-owned deferral is the real
fallback if the exact exception is declined.

The future proof must cover writesseed..7onlyforseed<8and no bodywritesotherwise,
actual genericwordhomes/compares/updates,unwritten entrybytes,sourceorder/count,
flags/SP/return/platformduties and completebothartifactresources. No initialized
old byte is assumed or source rewritten. Exactapproval comes first, then independent
evidence, then the sole literal amendment if that evidence succeeds. Any failed
qualification/cap fit or wider correction returns to the user; no implicit approval.

AR-P59remains open and the old694-line test remains byte-identical. Sourcebc91b57a
and all38newtestexpectations remain frozen; no additional implementation or output/
native/full qualification occurs. Status is implemented/verification failed at the
old-outcome boundary, not locally verified or a new green endpoint. The complete
quality loop, FO-SF-002and all original963/725requirements remain open. Root source/
oracle/inventory/agent/config/index checks again pass; final record/cleanup follows.

Knowledge lineage remains expert2.0.4/qualifiedfrozen/content
0e2a6280ddf77e42252b7a50b85cf9ea3d732b15;router
0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8;
literal specification identity
BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b.
Normative headings:ILcontrol-flow/call-clobbers/two-oracle,SFAlifetime/interference/
ABI/finalclosure,MOSinstruction/bus;sourcekeysMOS-PGM-1976/MOS-HW-1976/MOS-6510-1982/
P3/spec4. Context LinuxNode22.23.1/TS7.0.2/Yarnclassic,NMOS6510,PAL/6581,boundsboth;
no current ACME/VICE/hardware/timing/output-cost endpoint. Reviewers/assessor use
parent-supplied lineage/hashes/execution facts and read-only ordinary interfaces,
with explicit supported Astra high/xhigh overrides and no denied/hidden/raw access.
Their static verdicts are not independent binary verification or oracle authority.
Host model adds at mostΣ(Lf+1)Qfplus reachability/reorderingperinvocation; actual
latency/allocation/RSS is unmeasured. No new persistent cache, retained state or
blockingI/O; no surviving bounded host finding, not a claim of unchanged performance.

Final07:57CETguards pass:bc91b57aand658/583/185budgets, all444entry source/test/
fixture/producer/query/policy hashes except the approved two integrations, one
approved new test only, full scoped inventories and eleven oracles. Every old
test remains byte-identical, including the failing694-line loop concern. Exactly
59ARs/58resolved/only59open and40tasks/26verified/15,17,1.3.3blocked with reasons
are checked. Code/six touched Markdown records pass targeted formatting under the
repo ignore policy,179local links/AR59anchors,whitespace,documentation/reference
checks. The checkpoint record truthfully stops at directed failure;14diagnostic
record counts/hashes reconcile. Frozen spec/expert,agents/routing/policy,
non-integration portfolio and empty index remain unchanged. All four reviewers/
assessor and every build/test/probe process have completed. Execution Plan Updated:
yes; no staging, commit or push. Cleanup follows the complete durable stop packet.

Cleanup:done—only22temporary regular files in exact owned guarded-uses-ioa7daql
are removed after the complete approval/implementation/RED/GREEN/regression/
assessment/stop/verification record. No unknown entry, symlink, user/worktree or
other-session file is deleted; no raw artifact needs to survive the blocked run.
Immediately preceding deletion,bc91b57a,all old tests/excluded source/query/producer/
fixture/policy hashes and eleven oracles still match. AR-P59remains open,26/40,
parent38/48and14remaining tasks stay;no native/full/output/phase qualification,
staging, commit or push is implied by cleanup.

### Approved generic-pretest qualification —2026-10-27

At08:15CETthe user's **“I pprove, proceed”** directly approves the sole exact AR-P59
qualification/single-expectation packet before any new test or old expectation edit.
Production658/583and all source/query/producer/fixture/agent boundaries remain frozen.
Extend only the existing185/300guarded-use concern; qualify exact old source and
wordseed0/7/8/255/256/65535,bounds both with independent behavior/resources first.
Only then amend the old nonconstant-start literal at645rejected→complete. No
source/assertion/table or other old outcome change, helper/API/file/cap expansion.
Task15partial26/40,parent38/48,v4four/ten stay; no GREEN commit/push.

Exact new coverage is implemented with verification pending: six full-word starts×
bounds both, unchanged wrapped old source atseed0, actual two-byte counter homes
and no fixed-loop/selected-counter/conditional bounds in either construction.
Production and the old expectation remain unchanged. New-source behavior and actual
assembly/resource/native qualification precede the sole old literal amendment.

Fresh build and strict fullES2023/NodeNext owned-root compilation pass. The new
concern fits232/300and all50cases pass (38unchanged+12generic-word cases); production
remains658/583and the old694-line expectation remains byte-identical. Fresh public
none build reproduces all seven original artifact lengths/SHA256with empty
diagnostics. Sequential primary-owned qualification now covers24generic images
(sixseeds×boundsboth×reference/selected) and48guarded-use images (the original
three forms with/without induction plus separately source-initialized reload7,
short-circuitstop1and shift0variants). Each gets incomingP20/ed:72images/144cases
planned, not yet counted as passing. Data patterns and SYS registers are set only
at pre-startup E136; no initialized source input is overwritten after startup.
The exact old uninitialized array retains its observed entry bytes; initialized
guarded sources must independently replace that pattern with source zeros.

Independent admission evidence now passes BEFORE the old expectation change:
72ACME0.97reconciled images/144sequential pinnedVICE3.10PAL/6581cases, both bounds,
both actual constructions and P20/ed. Every generic source uses its exact original
uninitialized array and source literal argument. Nonzero asymmetric entry patterns
are set at E136before startup, not injected after source initialization. At scan
entry the pattern is unchanged; seed full-word parameter and counter are checked.
Every actual header retains the fullword initial seed and each update seed..8;
seeds≥8never write a body byte. Typed-store PCs check independent A/sourceindex,
prefix values, ordered watchpoint counts, actual counter words, SP,D0/originalI.
The last header for active scans holds8, proving false termination without wrap.
All unwritten bytes retain the observed entry pattern. Guarded-source initializers
correctly replace pre-startup patterns with zeros; guarded writes/early returns
then match independent shift/reload/short-circuit answers with/without induction.

Both source-return paths reach restore with balanced call stack; real SYS E147
P&CF/entrySP+2, ports00/01,BASIC03–06andCIA2DDRArestore pass; E155delivers actual
A/X/Y/P without an invented outgoing register promise. All36reference/selected PRG
pairs are byte-identical. Complete image/result JSON SHA-256:
`dc88f7cf05d96d88cdd750f7dfcf5826fe9bf8ec2432df8abf8c3c63ac6d09cc` /
`9ea91011da9731d3ccaf2ca36fc18f9c573c5a0626da13ea5b684f864769df77`.
Status **VICE-verified/hardware-unverified**, PAL/6581only; no elapsed timing, full
dummy-bus, physical silicon, four-profile or whole-input qualification is inferred.
The old694-line test is checked byte-identical immediately after admission evidence.
Under the already recorded exact AR-P59approval, the sole literal amendment follows.

The one nonconstant-start expected literal is now amended to complete, with
verification pending. Every source/assertion/table byte and other old outcome is
preserved. Production remains658/583and new test232/300; no further code/query/
helper/fixture/resource or policy change. Fresh focused and complete checkpoint
verification plus exact exception and final bounded reviews are due.

Fresh focused316cases/six files pass (50new concern+266unchanged prior cases).
The old loop file equals its before bytes with ONLY the approved nonconstant-start
expected literal replaced; no formatting, source, assertion, table or other outcome
change. Final four-path sortedpath/SHAcompactJSON identity:
`3371ab333b6630e4d4888a2a97873c34ac05316d2f205eef768a70b032e7612f`.
All445entry source/test/fixture/query/producer/policy hashes except the two approved
test updates remain unchanged, including both production integrations. Eleven
oracles and all prior selected proofs stay; code freezes for final bounded reviews.

| Qualified native source | PRG off/on | Function bytes off/on | Startup / restore | Frame RAM/ZP | Separate globals / platform state | Program stack |
| --- | --- | --- | --- | --- | --- | --- |
| Generic word0/7/8/255/256/65535 | 178/194 | main16;scan78/94 | 43/27 | 6/2 | 8/5 | 2 |
| Shift63, no loop | 146/157 | main36/47 | 74/22 | 2/0 | 10/4 | 2 |
| Reload63or7, no loop | 137/148 | main27/38 | 74/22 | 1/0 | 10/4 | 2 |
| Shortstop0or1, no loop | 151/162 | main41/52 | 74/22 | 2/0 | 10/4 | 2 |
| Shift63, retained loop | 231/254 | main111/134 | 79/27 | 6/2 | 10/5 | 2 |
| Reload63or7, retained loop | 222/245 | main102/125 | 79/27 | 5/2 | 10/5 | 2 |
| Shortstop0or1, retained loop | 236/259 | main116/139 | 79/27 | 6/2 | 10/5 | 2 |
| Shift0, no loop | 142/153 | main36/47 | 70/22 | 2/0 | 10/4 | 2 |
| Shift0, retained loop | 227/250 | main111/134 | 75/27 | 6/2 | 10/5 | 2 |

Every row counts both actual reference/selected and bounds; PRG includes2loadheader+
12BASICstub+all startup/functions/restore. Global data and platform state are separate
BSS RAM, not emitted PRG bytes or function frame. All actual branches/checks/traps
are charged; no padding/table/helper payload is omitted from the reconstructed PRG.
With a loop or genericwordpointer, ZP02/03and borrowed03produce5state bytes; no-loop
guarded cases have no function ZP and4state bytes. Source initialized seed0shares
existing zero loads, so its startup is four bytes smaller. All closed program stack
values are2with separate startup0held/1transient, not a universal ROM/interrupt peak.

Generic scanOFFactual78bytes consists of12initializer+12wordheader+1RTS+21pointer/
store+32update/backedge. Header uses LDAlo;CMP8;LDAhi;SBC0;BCCbody with binaryD0;
wordseed0100/FFFFcannot enter through their low byte alone. Source body index0..7
may use a low address view, but both source word homes and full updates remain.
Checked scan94retains12high/low-check bytes and4SEI/self-JMP trap bytes, never
silently removing source bounds policy. Main16charges full parameter setup/JSR/
restore jump. GenericOFFactual data08B1,counter08C0/1,param08C2/3,temp08BE/BF and
pointer02/03are distinct; ONdata08C1,counter08D0/1,param08D2/3,temp08CE/CFreclose.
These are observed placements, not hardcoded compiler recognition or future layout
assumptions. Actual per-use proof still retains every unknown/raw/callable/async guard.

| Native source | Exact compact source SHA-256 | PRG off / on SHA-256, identical reference/selected |
| --- | --- | --- |
| word0 | `709e544e123c7de46c16c8c2594d3c2586999d64fc33c93f81e6a4011f308ca8` | `634788e01f9d35bb490d3143224b1aba4480972a0844fb31552a8da29c774c87` / `dbae6cc51c591736e23a12994d1346ae03ee7b813d497fb8d61b814f3659d2ae` |
| word7 | `0336a4054fa5166a4b1ca997f9da24cd7ce70a31d8422087a87c0cd71281b99a` | `3634d0e6acd9b099a981ecda1e1839f096ef26b5a8c32d67089f0bf38db632f3` / `11ef7108ea3d87400a7eee53f059c5d875eb097eb7889f1f2ff2e04e6ed03d77` |
| word8 | `9cee634d96b6f496820ff17073353f6ce77b55468d0b272ec8de23278a784898` | `866b68b2a6553b04a4509614dc01c5c26902d73cc74c0628e53a1b1876c6bd74` / `d445a0d3a339f789a00aa78341d0acbd9b5e22f4e759600ed138d2b1912da64e` |
| word255 | `0876bc1cf1275025ba0548502beb366dc6e71e16fb6bce1bcbf0532962822963` | `a62bb94cc4e3d10fdf7914bf21b3792f0150331a280aa1b300a824a87e646986` / `97de8b2eb2d0e97b0df32c54aee24aa467e2f9e4910c46e36b2a5698204f3c16` |
| word256 | `34b0345dcd2462068e17bd68f6dfd09a33bfe182f981964887e370095c945c01` | `146be34e6d6245523dde288c9622bdecf3d6498918d726ef6d0390c89d57461a` / `9154ce55ac47b829202ea8d111b94941db7c52ce05f55e41638d69fb40c60949` |
| word65535 | `8a20664e63cbea0dfeb1e63e538ba3745e2bcdfa4a8a9eca9a6a8b4b7c5f2aa3` | `5523da82440e24b748a8ab6aa82b82227673c6f6c297c2d1b36f5b8d33313a0c` / `48e049a7c5fead198ca625340399da74b380fdf1d4b2a060f5c13103f5943efb` |
| shift63-0-false | `f19b3417e54d42ccd04deb252d52c5fe08527fa507859ac98ce836744305de75` | `5539fad2b1c8dfc1dc63b58cfa0aa7bb92b49a491b917d36fcda217c4ce60da7` / `f0e7de3e219136b37d25374daf300db3d5ffd70768d6c08f0b06fa43dbdffb9e` |
| shift63-0-true | `d7aec85e43f8530981a75fa2c4937cec42275165b6be3f1a4604dcaa3de9327f` | `db8be848e38888ec562d8be27c63ad389141bbae429fe2dafdad1c21887fc846` / `6efb6b2635d5016bdd8848a5b94e4528c5c68d0295338deeef9e2613b91cd85d` |
| reload63-0-false | `c5345db6b3f0de34e6d9c0bacc1e11395f74bdc9d3e004cd6f901935d939b18b` | `1f8eadab023fcad578b0b91ea24a5eb97fc09e296cc4c1a030095e8d45dc8b0e` / `2665e41fe8ab1d6f7277e4ee29838ad09e985483cf19ab490c837338c2dceaf2` |
| reload63-0-true | `a1993741ef95855cd6b982007d5dc9412758b3e9b97b2c2fea2315a19b862d46` | `33c7f5c2cf616154a4b9e7f72b00e86271edb0ab963a7b9f4212ee331f9a9b73` / `340303fb7034f9ea9ff296d6fe02bcf2cfc79c920d7c83a8fc3bfae01d2b3525` |
| short63-0-false | `39bfae8560456f40e26991a206c0e2fb86cfa4c0872f821a5f7cc3d70970b5d3` | `99251a826807bba2eaf77bd72723686db2373775e1a62007c4b88278f0c7b7fa` / `0a7b80041882295e2fefd69170fe5961377451e3783c244187422f5e5aa1b2cb` |
| short63-0-true | `72f3a79f29f508e0042f178b986aeae3c170d062d15db57a9ca8b44e2e9ef271` | `f22615cc053ed78d4e6d768a032679bedabd2057d5f3cd5bbdaefa94d0144b7b` / `a8b033af1a16db68367a04c0e140059f05d3a4f1df2218bb836e883e28bdde5b` |
| reload7-0-false | `811b7879202f2eec6e4665e7a7c30d0e36a0b2733c46db15f2e140110763e72c` | `4a5cd5e2d1c18c0b9ee0fe8e60be1c0e19d4c99215340816bcfba6ffa0baa8e6` / `22cb8c162915db6e300dcc8c3422668838113d7240e8132601f5620e4bc90985` |
| reload7-0-true | `800a08d329e4eb11aeba7f484ac5828d22562b150f24edec026ef50df5e67a95` | `14d4eb3a1da29b1408f108777c15fc4c3cc5609bce85ba2e24e76a23140559c2` / `22371efe73f756a706e61e17b7be8e984f690ca6ae229bbf2171f01a5f26247f` |
| short63-1-false | `ed1a4957d5dfc882cf6d37a6ee7677bcce6edcc248e10a9cb713a61ed9c9a58e` | `73053b31038e51de2952c1ee1d9b1eb147ab29f4e73f2b19b6bd9c6d4e8e346f` / `95404836d706fd81b4e7cbbda413fafa2766674d39fbd5d692170ab9fadb4323` |
| short63-1-true | `6d5c58e213dd3c6616968d15d3a2494b7460e0d97b7cf7351949f17bd286c040` | `102e751ce7c7749853dce6dc2bdfd2f3d6d01a49972d908ff9e9199ca0442318` / `c63fe055725f130d03d7dc4644d973c1c1e38af2269df64de8708c5a772ca62d` |
| shift0-0-false | `a334fdb29a6d06322d6d5c61119fbca0dda2dd743047edc01e697a0c0f88c4b6` | `43f6ccad3a7a8b7197d93c215144d481ffc64a969c899188f58a81dcf8b09cc7` / `eb0830dffd848c700bfd7008d7a1a2d1485c68d05cca86371c93999077d5b5f2` |
| shift0-0-true | `78c2cdea7c9585f4ecde06e5386cdc01d8f21e01bd323b4174e51273a162e7cf` | `708790d1b198531b03d5a6afc5c79b3eb1f8e336af9c27b242584fd6d2b4e486` / `96f5fea52d3fc8030c4e295986130b5f4f5b60dafce712060d3b7756269a06f1` |

Guarded labels encode kind, source seed, source stop and whether the unchanged
source loop precedes the access. Their source bodies/preamble are the new concern's
GUARDED/source strings; supplementary seed7/0orstop1replace only that initializer
before analysis. Generic source is the exact old wrapped source with only the
explicit call literal varied. These are diagnostic constructions, not source
workarounds, new product APIs, library/fixture edits or a replacement for real input.

The unchanged existing helper attests every VICElaunch: x64scSHA
f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74;
kernal-901227-03.bin8192B/SHA83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721;
basic-901226-01.bin8192B/SHA89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d;
chargen-901225-01.bin4096B/SHAfd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420.
Those exact admitted identities and PAL/6581machine arguments are not physical
chip/revision proof. No interrupt/timing/full-bus qualification is inferred.

Fresh complete checkpoint: install0.39s/build2.20s/typecheck0.86s,1331directed cases/
84files247.13s and45boundaries5.01s pass. Complete yarn test365.46s reports compiler
3003passes/13same known frontier failures/two existing skips across181files. Root
reconciles exact identities: four profiles×32/64-site constructors, four72-function
constructors and one rejected-baseline cost-validator case; no new failure/skip.
CLI62,language-server21and VSCode6pass; the root suite is not reached. The added50
passes equal38guarded+12generic cases; the old literal changes no test count. The
prior extra nonconstant-start failure is gone only under the exact approved,
independently qualified exception—not a hidden amendment or baseline rebase.

Correctness/high exact-exception follow-up and SFA/xhigh generic-word follow-up
find no findings. Platform/xhigh first reports missing task-selected normative
content within its read boundary, so no audit conclusion is counted. Primary
supplies active router and selected IL/MOS/SFA/C64/lowering normative excerpts
inline, without hidden/denied raw access, permission changes or evaluator answers.
The same bounded platform audit then completes no findings. Static endpoints,
parent-supplied lineage/hash/native limitations and no full-bus/timing/silicon claim
are retained. Prior host-performance static review applies unchanged production;
no performance-invariance or new measured RSS/latency result is inferred. Output
auditor receives complete actual costs, fresh normalized assembly/source/state and
authorized normative guidance in a later wave; its result remains pending.

### Bounded guarded-use/generic-pretest checkpoint —2026-10-27

Correctness/high exact-exception, SFA/xhigh generic-family, platform/xhigh and
output/xhigh reviews find **no introduced observer defect** in frozen four-path
3371ab33. Prior host-performance/xhigh static review remains applicable because
production658/583has not changed; new tests fit232/300and old loop concern remains
694/no growth. Every review uses an explicit supported native model override and
bounded read-only charter; no shell/child/editor/config/denied-raw access. Active
expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15and literal knowledge
BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b
remain unchanged. Root supplies authorized current normative excerpts and exact
actual evidence; reviewers do not independently execute or hash native artifacts.

Output review nevertheless retains three **MAJOR inherited producer debts**. Root
inspects the69open issue inventory, including actual scopes#52/#53/#89/#105/#107/
#111/#115/#116/#119/#120. #120owns the first bounded-word direct-index step;#52is a
historical broad rule seed, not current v4 qualification or authority for a catalog/
harness. None explicitly owns the remaining same-value transfer, the current
word-result-copy/guarded-high-byte proof, or ordinary typed comparison-capture
eligibility. Under the standing expert-output directive, root creates three exact
RD-08children without editing old issues or any producer:

| Finding / owner | Current / equivalent analytical target | Complete isolated accounting |
| --- | --- | --- |
| GU-MC-001 →[#121](https://github.com/blendsdk/blend65/issues/121), related#120 | GenericOFFstore21B/30cy→LDA counter.low;TAY;STA data,Y7B/11cy. #120's intermediate9B/13cy is not counted twice. Additional same-value reuse beyond#120is2B/2cy; complete current gap14B/19cy per write. | PRG178→164only if all other terms/reservations stay. Seed0eight writes save152nominal cycles;seed7one saves19;high starts execute none. |
| GU-MC-002 →[#122](https://github.com/blendsdk/blend65/issues/122), related#52 | Fullwordupdate/backedge32B/41cy→in-place full-width destination forwarding20B/25cy (12B/16cy saved), or exact guarded INC low;JMPheader6B/9cy (26B/32cy saved). | PRG178→166or152independently, never both. Seed0stronger target saves256cycles,seed7saves32. Keep entire6RAM/2ZP/data8/state5/programstack2/startup0held1transient reservations. |
| GU-MC-003 →[#123](https://github.com/blendsdk/blend65/issues/123), related#52 | Guarded shift-with-loopOFFcapture LDA seed;STA ordinal;LDA ordinal9B/12cy→retain first LDA/STA6B/8cy before unchanged CMP. Only reload removed; private store/home/later uses stay. | PRG231→228independently;4cycles saved on each guard evaluation including rejection. Retain6RAM/2ZP/globals10/state5/programstack2/startup0held1transient. Not a whole-routine expert floor. |

All targets are **analytical, unassembled and unexecuted**. No independent delta
is added without combined source/helper/SFA/layout/branch/resource closure. MC-001
retains exact word initialization/update/zero-trip and changes Y/address traffic
only after proving actual continuation/both-layout dummy/fetch/mapping equivalence.
MC-002's stronger target needs high0/low≤7at update, body noninterference, private
RAM and complete live-state proof: NMOS INC adds an old-value write. Actual next
header overwrites A/N/Z/C/V; void alone is not proof. Full-width forwarding is the
smaller first repair and avoids RMW differences. MC-003already has identical A/N/Z
across STA, but the existing observer's volatile raw-read eligibility does not
cover this ordinary typed load. Preserve all source/domain/address-exposure/raw/
async and lifetime barriers when a future exact producer scope is approved.

Ledger **accepted** means accepted for correction under mandatory debt-filing
authority, not waived/dismissed, not an automatic deferral of original limits,
not producer/test/query/helper/cap edit authority, and not complete output parity.
No new pass, framework, range/alias engine, runtime, dependency, public API or
source workaround is introduced. Existing#114–#120stay open; final output/six-lens/
FO-SF-002and complete963/725gates remain due. Native behavior is Verified partial;
whole-program expert win and future replacement behavior/resources remain Unknown.

After qualification,24unchanged actual-input constructions under all six policies
and both bounds still close/serialize but all fail atomic observers. SavedOriginal
now reaches the next protected boundary: keyState's snapshotCompatible call at
input.blend306/span8669–8697rejects Opaque induction effects. The earlier prefix
column containment is no longer its first failure; later post-call reload/call
proofs still need their own authority. Other saved policies reject wider selected
loop composition; acquisition always rejects asynchronous borrowed backing.
Diagnostic JSON SHA-256:
`705335fdfd41c4b02b5aa575d6acb48a458deed7fc8475a5034a683098462b73`.
This is read-only next-boundary evidence, not new test/fixture/source/call permission,
actual-input ACME/VICE or complete size qualification. No real input tuple passes.

The exact single old outcome is now locally qualified under direct AR-P59authority;
all other tests/oracles/source/producers/queries/fixture/agents/config remain.
Status **Verified partial**, claim **Fact** for typed containment/generic source
admission, actual binary/runtime and regression endpoints only. Output parity is
open with measured inherited defects; publicsize stays incomplete. Task15remains
partial26/40,parent38/48,v4four/ten; six implementation and eight hardening tasks
remain. No staging/commit/push is permitted while the composite is RED. Final
exact-issue/source/oracle/exception/budget/link/format/cleanup checks follow.

Final09:18CETvalidation passes:3371ab33four-path identity and658/583/232/694caps,
exact one old expected-literal replacement with every source/assertion/table byte
and other outcome unchanged; both production files and every other445entry source/
query/producer/fixture/policy hash/inventory and eleven oracles preserved. Exactly
59ARsare resolved;40tasks/26verified/task15onlypartial. Code/seven touched Markdown
records pass targeted formatting under repo ignore policy,181local links/checkpoint
anchors,whitespace,documentation/reference checks. All18native source/PRG table
rows,72image/144trace hashes,36reference/selected PRG pairs,seven original none
identities and24actual-input rejection identities reconcile. GitHub confirms
#121/#122/#123OPENwith exact assigned titles; no old issue is edited. Frozen spec/
expert,agents/routing/policy, non-integration portfolio and empty index stay.
Every review/native/checkpoint/issue/probe process has completed. Execution Plan
Updated:yes; no staging, commit or push. The full composite remains RED on the
same13frontier failures; this locally verified subset does not close task15.

Cleanup:done—only263temporary files in exact owned generic-pretest-s49_4w_c are
removed after complete durable approval/source/admission/behavior/assembly/resource/
review/debt/failure evidence. No unknown entry, symlink, user/worktree or other
session content is deleted; no raw artifact needs to survive this bounded run.
Immediate pre-deletion checks preserve3371ab33and all excluded source/query/
producer/fixture/policy/eleven-oracle boundaries. All processes/reviewers are done.
Counts26/40,parent38/48,14remaining tasks and every original whole-input/output/
phase obligation stay. No staging, commit or push.

### Requested commit/push verification —2026-10-27

The user explicitly requests **“commit and push, then proceed”**. This supplies
push intent but does not change the plan's GREEN-checkpoint rule. Before staging,
source3371ab33, feature/v4-rebuild, HEAD1022fd52, empty index and frozen/agent/
policy/non-integration portfolio boundaries are confirmed. No unrelated prior work
is reverted or staged, and no hook/verification/permission rule is bypassed.

Fresh install0.38s/build0.43s/typecheck0.43s pass. The first background test runner
cannot record its result because its owned temporary test log is missing when
read; that test result is Unknown, not a pass or the claimed historical13failure
result. Its scratch directory is observed absent. A foreground rerun captures
output in memory, avoiding reliance on the missing file, and completes in675.85s:
compiler3003passes/13failures/two existing skips across181files; CLI62,language-
server21andVSCode6pass;root suite not reached. Exact failing identities remain
eight32/64-site constructor cases, four72-function constructor cases and one
rejected-baseline cost-validator case. No new failure or successful full checkpoint.

Commit/push stops at verification failure under the existing rule; no staging,
commit, fetch/rebase or push occurs. No compiler/test/query/source or artifact
oracle is modified to manufacture GREEN. Source3371ab33and59resolved decisions,
26/40withtask15partial,parent38/48and14remaining tasks stay. The requested order
cannot be completed while RED; continuing implementation to GREEN first is the
recommended next order, not an inferred permission to publish a broken checkpoint.
No RED-checkpoint exception or new implementation scope is recorded. Cleanup:
the original owned verification directory is already absent; the decisive rerun
uses no temporary files. Current evidence is retained here and in tool output.

### GREEN-first outside-call discovery —2026-10-27

User **“proceed”** accepts the recommended implementation-to-GREEN ordering after
the failed commit/push check. It does not authorize a RED checkpoint, new source
family, file/API/helper/result field, cap or protected expectation amendment.
Entry preserves3371ab33,445source/test/fixture/query/policy hashes and11oracles;
frozen/agent/routing/portfolio/index boundaries remain unchanged. Task15is the
first incomplete owner; no sibling task is advanced. Full3003/13knownfail/two
existing skips is the fresh preceding endpoint, not a successful checkpoint.

The current savedOriginal source first rejects the outside-loop snapshotCompatible
call at keyState306. Effects source-call and whole-function JSR barriers remain.
Even after exact call admission, the unchanged ordinary guarded query invalidates
the local column bound at a call, so later rows[column]318would remain unknown.
Current effects658/668and main583/586leave no room for unbudgeted new machinery;
the broad file ceiling700is not permission to expand the last unit's cap.
AR-P60records the necessary ownership/capacity decision before any implementation.

Read-only probes will distinguish direct source-call/actual-entry correspondence,
complete caller/callee/helper home protection and query provenance. A call outside
a child but inside its parent remains an inside-loop call. No current API returns
per-use call-qualified bounds; the residual result owns only checked operations,
instructions, loops and function-wide maxima. A proposed private-guard composition
must remain per-use and invocation-local, with all raw/source/physical/async gates
binding, not a new effect/alias/range engine. Call-only admission may avoid that
composition but cannot promise a real saved caller. Both existing negative rows
remain protected until an exact ruling; all source/fixture/producer/query/agent
files stay unchanged. Counts26/40,parent38/48,v4four/ten and14remaining tasks stay.

Fresh build/typecheck,156focused cases (50guarded+71old-loop+35Original-composition)
and45boundaries pass. Twenty-four isolated and24unchanged actual-input constructions
close and serialize; every atomic observer still rejects. Exact isolated cases
include prefix/suffix/between-loop calls, inside/parent-inside negatives, original
post-call guard with/without a recognized loop, source-initialized active seed7,
transitive call, compiler-helper descendant, const-array borrow and unknown raw
callee. No source/test/query edit or new runtime/cost qualification occurs.

For the real savedOriginal caller in both bounds/both actual layouts, each relevant
source call's JSR is in the first mapped actual block, with one matching source
span/target per operation. Main has two ordered calls in the same actual block;
proof cannot assume one call per block. KeyState snapshotCompatible/soleGroundSource
calls each occupy one actual source-block construction. All are outside every
affected pending Original loop; inside-parent probes correctly belong to the
parent despite being outside the child. A first-actual-block restriction may avoid
new CFG/dominance machinery, but remains a proposed scope rather than proof code.

Source-call crossed requests already have complete homes, no physical overlaps and
all required conflict edges against transitive callee/helper requests in both
actual constructions. KeyState→snapshotCompatible: reference28live/19callee,
selected17/15; selected private column byte4008is live across that call, with its
reference home4324. Main→keyState:12liveagainst49/43callee requests; Main→joystick:
12against32/25. Real input has no compiler-helper calls in those descendants.
The isolated multiplication callee has one helper/two helper requests, four live
caller requests versus five callee/helper requests, all disjoint/conflicted on both
sides. The const-array callee's canonical two requests become zero in a qualified
fixed entry; that is actual complete inventory, not fabricated missing homes.
These observations do not establish that a new duplicate interference checker is
needed: the independent assessment must distinguish existing authenticated SFA/
source/raw guarantees from genuinely missing site/alias proof.

Ordinary guarded query gives7at keyState's first rows[column]303and its loop index,
but no bound at the post-call use318. A diagnostic call of the unchanged semantic
query under an UNPROVED direct-call-nonalias hypothesis yields7at that later use.
No call-qualified context/certificate or accepted tuple is manufactured. The old
guarded-use post-call row likewise has unknown ordinary-query bounds with and
without its recognized loop. Global call-kill relaxation would change both old
atomic outcomes; a recognized-owner-only composition would still require exact
authority for only its induction=true outcome. Call-only admission can keep both
old post-call negatives, but cannot promise the real saved caller.

The first scratch inspector incorrectly assumed a matching main source block for
every acquisition interrupt variant and throws. Final diagnostics record absent
mapping as Unknown, never empty/proved; asynchronous acquisition rejection stays
first under every policy. No producer/API/fixture is changed to make inspection fit.
Final isolated/actual JSON SHA-256:
`feafb291c61a0f4d6a7d8fa8c0298427ba7340785815c6eb64d07c2f30e64ff7` /
`e985d53c8ae16ee1618e9fca0f540f9fe171134165a3128b20d2bde30a843a03`.

One blind supported Astra/xhigh assessor compares: direct existing-effects call-only
composition using already qualified central guarantees; one new focused leaf only
if direct readable proof cannot suffice; or tightly bounded call plus private-guard
composition with exact invocation-local per-use result and two old atomic outcomes.
No primary preferred choice, other reviewer verdict, denied historical raw evidence
or hidden evaluator/qualification answers are supplied. Exact source/JSR order,
cardinality and occurrence positions must be proved, not instruction-object identity
alone. The existing helpers, producers, query implementation and all445source/test/
fixture/policy hashes/eleven oracles remain untouched while the assessment works.

The sole assessor completes **Simplify**: direct existing-effects call-only proof
first, with no new production owner/helper/export/signature/API/result field and
no guard retention. [Exact AR-P60packet](00-ambiguity-register.md#ar-p60-exact-call-only-approval-packet)
requests only effects658→at-most700(current unit668),one new500-line call concern
and migration of only the old Original-composition outside-call row351–354to the
same exact source/new positive. Main/raw-layout/guarded-use/old-loop files remain
unchanged; both post-call ordinary-query bounds and atomic rejections stay.

New logic must authenticate all pending loops, reject calls in every affected
Original region, match every source/actual call occurrence in order in the first
mapped actual block and resolve actual sourcecallee/invocationidentity. Unknown
sharing/variants/helpers-in-caller and nonprimitive results retain fallback. Reuse
central authenticated source/SFA/helper/stack/borrow/raw/typed ownership rather
than rederive a second closure engine. Check by block/ordinal, not instruction
identity alone. Preserve PC and all direct counter-write/control checks; calls
never become physically footprint-covered. Complete actual before/after checks
and independent source/code/resource/runtime qualification remain due after approval.

This narrows away the proposed production leaf and call-qualified private-guard
result field. Both could be reconsidered only if a direct fit/proof is disproved
under a separately authorized packet. The complete700-line fit is explicitly
unmeasured and low-confidence: stop on overflow/missing obligation, never remove
checks/docs, compress code or auto-extract/raise caps. High confidence applies only
to separating the proof contracts and reusing existing ownership. The strongest
objection is a further checkpoint while the real saved caller still rejects the
post-call column access; neither that fact nor the assessment grants broader scope.

Status **Verified partial**, claim **Fact** for current diagnostic construction/
query/storage/serialization/rejection and existing test endpoints; future admission,
fit, runtime and complete parity remain **Unknown**. Expert2.0.4/content
0e2a6280ddf77e42252b7a50b85cf9ea3d732b15/router
0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8;
knowledgeBLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b.
Selected SFAcall-graph/lifetime/interference/ABI/finalclosure,ILcontrol-flow/call-
clobber/two-oracle,MOSinstruction/bus and C64startup headings;sourcekeysMOS-PGM-1976/
MOS-HW-1976/MOS-6510-1982/CBM-C64-PRG-1982/P3/spec4. Lineage and fresh diagnostic
execution/hash metadata are primary-supplied; the assessor reads ordinary interfaces
and authorized normative excerpts, not denied raw, hidden qualification/grader
answers or other reviewers' verdicts. Supported native Astra/xhigh override is
accepted; no model/effort-only pause or permission change. The assessor is done;
no production/test/API edit occurs. Exact three-file/cap/one-row ruling is next.

Final11:14CETchecks pass:3371ab33and all445entry source/test/query/producer/fixture/
policy hashes with complete scoped inventories and eleven immutable oracles stay.
Both proposed call files are absent. Exactly60ARs/59resolved/only60open and40tasks/
26verified/15,17,1.3.3blocked with reasons are checked. Six touched status/decision/
journal records pass targeted formatting under repo ignore policy,183local links/
AR60anchor and whitespace. Both24-record diagnostic hashes reconcile. Frozen spec/
expert,agents/routing/policy,non-integration portfolio and empty index remain
unchanged. Fresh156focused/45boundaries/build/typecheck and all48read-only source
constructions are the current endpoint; no new full-suite/ACME/VICE/parity result.
The sole assessor and every probe/verification process are done. Execution Plan
Updated:yes. No staging, commit or push; exact AR-P60ruling remains pending.

Cleanup:done—only11temporary regular files in exact owned outside-call-scope-inxt2t01
are removed after the complete durable goal/probe/assessment/scope/evidence-limit
record. No unknown entry, symlink, user/worktree or other-session content is deleted;
no raw artifact needs to survive discovery. Immediate pre-deletion preservation
confirms all445source/test/query/producer/fixture/policy hashes and11oracles.
All tools/assessor are done. No compiler/test/API/helper/codegen/agent change;
26/40,parent38/48,14remaining tasks and all original output/phase gates stay.

### Approved call-only implementation —2026-10-27

At11:18CETthe user's **“i approve”** directly approves the sole exact AR-P60
three-file/cap/old-row question before any code/test edits. Begin meaningful
admission REDs, then direct code only in the existing effects bodies≤700with
signatures unchanged. New focused test≤500; only the old outside-call row may
migrate, preserving exact source as a new positive. No new production owner,
helper, export/API/result, guard retention/query change, producer/fixture/agent
edit or other old expectation change. Stop if complete readable proof cannot fit.
Task15partial26/40,parent38/48,v4four/ten stay; GREEN-first ordering/no RED commit.

All18new admission cases first reach meaningful existing residual RED through
unchanged real frontend/reference/selected construction. The new direct code is
implemented with verification pending: source calls outside the current affected
loop and primitive/void only, ordered first-actual-block occurrence cursor, exact
source edge/span/entry/context correspondence and missing-call checks. Core SFA/
helper/stack/raw/typed ownership remains central, calls are never footprint-covered,
PC and all other direct-write/control checks remain. The old row is not migrated
yet. Normal formatting and the700-line hard stop precede all other qualification.

### Measured call-proof capacity stop —2026-10-27

Normal targeted Prettier formatting measures effects707/700, triggering the exact
AR60hard stop before build/admission GREEN or larger qualification. The full draft
is preserved, with no compressed formatting, deleted check/documentation, automatic
extraction/cap increase, helper/signature/API/result change or private-guard work.
The old outside-call row remains byte-identical and unmigrated. Current production
draft is implemented/unverified, not locally qualified. AR61blocks15/17/1.3.3;
counts26/40,parent38/48,v4four/ten and14remaining tasks do not advance.

An independent assessment must decide whether a genuine logical simplification
can preserve every correspondence/invocation/occurrence/storage obligation or one
new bounded call-correspondence leaf is now necessary. Only newly introduced,
unqualified call logic could move; existing qualified helpers and both original
private signatures stay protected absent a new exact ruling. No initial draft is
assumed complete merely because its field checks look plausible; semantic/proof,
strict compilation, successful admissions, actual output and native evidence remain
unmeasured. Eighteen meaningful admission REDs are the current executed endpoint.

Draft sortedpath/SHAcompactJSON identity:
`2d7c187cae3746377432a520df8e9c6e0a9e898f1335a181d21ab017c97531a9`.
Effects707,newcalltest57,oldOriginal-composition368unchanged; all other445entry
source/query/producer/fixture/policy/test hashes and eleven oracles remain intact.
No new production leaf exists. The source syntax formatter runs, but strict types,
admission GREEN, scope sentinels, output/runtime and bounded reviews are not yet
qualified. Source/runtime correctness is not inferred from this line measurement.

The sole fresh Astra/xhigh minimum-correction assessment completes **Justified**:
[exact AR61leaf packet](00-ambiguity-register.md#ar-p61-exact-measured-call-site-leaf-packet)
adds only a200-line source-call/actual-JSR correspondence leaf, one four-argument
export returning existing ResidualFailure|null, and exact movement of unqualified
new logic. It does not move qualified counter/CFG helpers or change their private
signatures, main/raw-layout/query/results/guarded tests/producers/fixtures/agents.
Effects remains≤700,aim≤680;newtest≤500;sole oldoutside-row authority stays AR60.

The ground is not merely seven excess lines: the current draft visits JSRs only
through mapped source blocks and never closes all actual blocks. An unassociated
occurrence therefore lacks local correspondence proof, even though outer provenance
may reject malformed candidates first. New leaf must enumerate every actual JSR,
including unknown blocks, preserve source order/cardinality/entry/context and reject
reused-object duplicate occurrences. Tests must exercise both local rejection and
the atomic gate, not count provenance-only failures as proof of the new checker.

Strict source-span identity and caller graph identity are genuine possible
refinements supported by current constructors, not formatting tricks. They do
not establish complete fit or close the actual-occurrence obligation. Callee
reference equality is NOT justified for all aliases: graph deduplication retains
one value-key representative and lowering resolves by value. Keep value-key proof
unless a separately complete argument is made; do not erase checks to hit700.
The strongest objection is that a complete same-file form might still fit; the
assessor does not claim a mathematical impossibility. Confidence medium-high in
separation/proof requirements and medium in the unmeasured200-line budget.

The explicit API reuses the exact actual caller already resolved/checked by
loopRepresentation. Null means correspondence only, not a storage/effect/whole-
program certificate, guardMap or footprint-coverage permission. Consumer retains
PC advancement and all word/home/init/update/CFG/private-write and final raw/typed/
source/provenance checks. No direct caller-storage reclosure, dataflow/invocation
engine or private-guard composition is introduced. Exact new path/export/movement
requires the user's ruling BEFORE any extraction. Draft remains frozen/stopped.

Authority remains expert2.0.4/qualifiedfrozen/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15,
router0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8,
knowledgeBLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b;
SFAinterference/finalclosure/ABI,ILcalls/control-flow/two-oracle,MOSinstruction/bus,
C64startup;keysMOS-PGM-1976/MOS-HW-1976/MOS-6510-1982/CBM-C64-PRG-1982/P3/spec4.
The assessor reads allowed ordinary interfaces and supplied normative excerpts,
not hidden case/grader maps or denied raw. Model/effort is explicitly supported
Astra/xhigh, source is read-only, no child/shell/editor/config actions. Structural
capacity finding is Fact; future semantic/type/runtime/complete output/fit is
Unknown. No compiler/test edits occur after the hard stop while ruling is pending.

Final12:09CETstop validation passes: unqualified2d7c187c(707/57/368)preserved,
all445entry source/test/query/producer/fixture/policy hashes except the approved
effects draft and one new test, full scoped inventories and eleven oracles intact.
Old outside-call row is byte-identical/unmigrated; proposed call-sites leaf absent.
Exactly61ARs/60resolved/only61open and40tasks/26verified/15,17,1.3.3blocked with
reasons are checked. Code/six touched Markdown records pass targeted formatting
under repo ignore policy,185local links/AR61anchor,whitespace and source-doc-
reference checks. Formatter success does not waive707/700failure or establish
strict types/admission GREEN. Eighteen source admissions fail meaningfully BEFORE
the draft; no post-draft build/test/runtime/cost qualification is falsely counted.
Frozen spec/expert,agents/routing/policy, non-integration portfolio and empty index
remain unchanged. Sole assessor and every process are done. Execution Plan Updated:
yes; no staging/commit/push. Exact four-path/export/movement AR61ruling is pending.

Cleanup:done—only8temporary regular files in exact owned original-calls-5y7wfmhx
are removed after durable approval/RED/draft/overflow/assessment/scope/stop evidence.
No unknown entry, symlink, user/worktree or other-session content is deleted; the
unverified707-line draft and57-line new test remain preserved in the worktree.
Immediate pre-deletion checks confirm2d7c187c,all excluded baseline source/query/
producer/fixture/policy/old tests and eleven oracles. No extra leaf/export/old-row
migration or qualification follows. Counts26/40,parent38/48,14remaining tasks and
every original output/phase gate remain; no staging, commit or push.

### Approved measured call-site leaf —2026-10-27

At13:12CETthe user's **“approved, proceed”** directly approves the sole exact
AR61new-leaf/export/movement question before extraction/new-file/export edits.
Move only unqualified new correspondence logic, close every actual JSR occurrence
and retain old private signatures/counter/CFG/init/update/write checks. Leaf≤200,
effects≤700,newcalltest≤500;sole old outside-call row remains protected until
admission is established. Existing18meaningful REDs are preserved, not recreated
by weakening expectations. No source/query/guard/result/producer/fixture/agent or
other old-oracle expansion. Counts26/40,parent38/48,v4four/ten stay; GREEN-first.

The exact movement/new leaf is now implemented with verification pending. One
export returns only correspondence failure/null and reuses the actual checked
caller. It enumerates all actual caller blocks, source-first associations and
ordered call occurrences, including unmapped blocks/reused objects/missing entries.
Parent retains signatures, word/CFG/private-write logic and JSR PC advancement;
no calls gain footprint coverage or guard facts. The old row is still unmigrated.
Measure complete ordinary formatting/caps before build/admission qualification.

First measured fit is leaf132/200,effects669/700,new test57/500. Build initially
flags a type-only firstSources.has(undefined) check because array indexing is typed
string; explicit empty-label-array validation preserves the same obligation. Leaf
135/200, fresh build and all18original positive admissions then pass. New adversarial
correspondence/value-key/storage/raw/region/callable/async/resource cases are now
implemented in the approved concern with verification pending. SourceSpan values
and callee value keys remain supported; no identity-only shortcut is introduced.
The old outside-call row is still unmigrated. Complete formatting/caps follow.

Complete first proof fits leaf135/200,effects669/700,new test386/500. Strict
owned-root typing initially catches one test late-block terminator widening and
an unused destructure; explicit MachineBlock mapping/local cleanup correct only
new test plumbing. First new concern run68/69passes; the async source used a
nonexistent c64.irqmodule, so its constructor—not the observer—was incomplete.
Use the existing c64.system IRQ API, preserving the negative's meaning/expected
rejection. All69new cases then pass; fresh190new-call/guarded/old-loop cases pass.
No query/counter/producer/fixture or old expectation is amended for those fixes.

After18meaningful REDs→18GREENadmissions and full local negatives, only the
approved old outside-call row is now removed; its exact source remains the new
positive under both bounds. All other old source/assertion/outcome bytes stay.
The migration is implemented with verification pending. Source behavior/complete
actual artifact/resource/native checks and final quality/checkpoint gates follow.

Final source membership uses Set.delete rather than repeated array membership,
preserving foreign/repeated/missing source checks with linear local work. Leaf
130/200,effects669/700,newtest386/500,oldtest364/no growth. Fresh build/strict
new-test typing/69cases pass. Four-path sorted-path/SHA compact-JSON identity is
`4207a8a8b8599e0f587a9aa5a2cb3ef534f6ec1119058bb83c47617f12bc2bc3`.
No later production edits are made during independent qualification.

Bounded correctness, SFA/ABI and host-performance reviews return no findings.
Correctness confirms meaningful component versus atomic negatives and exact old
row migration. SFA finds existing authenticated closure/named borrowing/final
typed/raw exclusion sufficient for this admitted class; no new callee-effect/home
checker is justified. Host review bounds introduced scans/indexes linearly per
loop/construction; at supplied four-loop scale≤296invocations/37attempts, including
≤148indexed scans, conservative counts rather than latency/RSS measurements.
All are static bounded endpoints, not full phase or actual-output clearance.

Fresh install/build/typecheck pass;1,399directed cases/85files and45boundaries
pass. Full yarn test remains RED:compiler3,071pass/13knownfail/two existing skips,
same unfinished frontier failures. Root suite is not reached. No GREEN checkpoint,
task promotion, staging, commit or push follows.

Native probe first completes four suffix images/eight sequential PAL/6581cases,
then times out on the prefix. The emitted main starts with the exact JSR where
the probe is already stopped; resuming to the same one-shot source site cannot
reach it again. Correct only that temporary probe scheduling, asserting equality
to main entry and retaining every behavior/resource expectation. No repository
test, production, timeout, source or oracle change. Full native rerun is pending.

The first corrected launch fails before execution because ACME requires a fresh
staging path; a nested fresh path also fails until its parent exists. Neither
tool setup failure is a behavior result. A fresh per-run scratch directory fixes
that ownership. The next native run passes12images/24cases before encountering
the same scheduling issue at two adjacent calls: return from the first call is
already the second JSR. Track only the actual stopped PC and skip a redundant
call-site resume; each repeated loop-store checkpoint still resumes normally.
The following run passes32images/64cases, then its helper lookup assumes a separate
MachineFunction. The actual multiply helper is a callee-owned block, reached by
an emitted direct JSR. Resolve that exact emitted block target instead; preserve
the source-result12,helper-entry four-byte stack depth and all other assertions.
All changes are temporary probe plumbing; a complete fresh rerun remains due.

Fresh public none identity reproduces all seven original artifact lengths/hashes
and exactly empty diagnostics. Read-only discovery closes/serializes24unchanged
actual-input constructions. Saved Original now passes all eight per-loop/per-layout
call correspondences and reaches rows[column] at input.blend318/span9184–9205,
rejected as an escaping induction access. Both bounds agree. Other saved policies
retain selected-loop composition rejection; acquisition retains asynchronous
borrow rejection. Its direct leaf diagnostics are outside the leaf's prerequisite
context and do not establish an atomic behavior defect. Discovery JSON SHA-256:
`623b1f46d998a4f48a82218dc9a3e300a167a939e091717ab3586086c8fd0c71`.
No post-call guard, ordinary query, source, producer, test or capacity authority
follows from these observations. Complete actual-input/public size remains RED.

Final fresh native run completes36ACME0.97images/72sequential VICE3.10cases under
PAL/6581, both bounds, both independent constructions and incomingP20/ED. Every
actual assembly/PRG hash reconciles with its captured image record. Source-derived
expected data writes are8or16ordered stores, not optimized-versus-unoptimized
agreement; ordered calls observe total1then2, byte8,fullword12FF→1300,borrow0,
transitive1andmultiply12. Every live caller request crossing each call is snapshotted
and unchanged at return. Actual callee/helper entry SP decrements2/4and returns
balance; main D0/Iincoming and wordcounter0..7 hold at each observed store. No
timing or actual asynchronous-entry observation is inferred from incoming I0.

The probe reaches restoration, verifies caller P/SP,CPUports00/01,CIA2DDRA,
SYS A/X/Y/P publication and every actually borrowed BASIC byte. Startup holds0
bytes across main,transient1; reported programstack is generated-component demand,
not an unrestricted external ROM/NMI peak. Raw C140 has exactly one value1write
only in the suffix source. All behavior expectations survive the probe-plumbing
corrections unchanged. Status **Verified partial**, claim **Fact**, bounded
**VICE-verified / hardware-unverified**, not whole input,all four profiles or phase.

| Ordinary source | Complete PRG bytes bounds off/on, reference → selected | SFA RAM/ZP reference → selected | Generated stack | Platform state reference → selected | Startup code bounds off |
| --- | --- | --- | ---: | --- | --- |
| Exact migrated suffix/raw call |744/760→744/760|4/2→4/2|2|50→50|643|
| Prefix call |227/243→227/243|6/2→6/2|2|5→5|102|
| Between two loops |319/353→319/353|12/2→12/2|2|5→5|102|
| Two ordered calls |222/238→222/238|4/2→4/2|2|5→5|102|
| Byte parameter/result |215/231→215/231|6/2→6/2|2|5→5|99|
| Word carry/result |250/266→250/266|10/2→10/2|2|5→5|102|
| Named const-array borrow |242/258→201/217|6/4→4/2|2|7→5|119→99|
| Transitive callee |231/247→231/247|6/2→6/2|4|5→5|102|
| Multiply/helper callee |267/283→267/283|7/4→7/4|4|7→7|119|

PRG includes2header+12stub+actualstartup+all reachable routine/helper code, with
no code padding in these fixtures. Source globals/BSS,platformstate and SFA/ZP
remain additional resident costs, never silently counted as zero or shipping
bytes. The observer itself adds no target instruction/storage/helper/stack demand.
Borrow specialization's measured41PRGbytes/twoRAM/twoZP/two platform-state bytes
are inherited selected construction, not a new optimization implemented here.
All callee/whole-program expert output gaps remain subject to independent review.

Native script SHA-256 `74b78d2f5fc9600bc9f0e7a9f6d6f926cb3aabc5f0be64bf41e2fafbfc73e505`;
36image JSON `a225994f5cac7e56b17abe9721969a7752d814954b820a2fdb8f7cd5d2930a3b`;
72trace JSON `26f546c0a6667fd6a5e0ee58ff40dbe31a19085fc1fbaf54da641314a82f8fa7`.
VICE executable SHA `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`;
KERNAL03 `83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721`;
BASIC01 `89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d`;
chargen01 `fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420`.
Lineage remains active qualified/frozen expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15,
SFA ABI/finalclosure,MOS instruction/bus/stack,IL TwoOracle,C64 startup and ACME/VICE
proof contracts; governingMOS-PGM-1976/MOS-HW-1976/MOS-6510-1982/CBM-C64-KERNAL-03/
VICE-310-MANUAL/P3/spec4. No authority, policy or oracle is changed.

Platform review returns no findings after inspecting the four files and unchanged
CPU/call/footprint/startup/runtime facilities. Its execution/artifact identities are
explicitly parent-supplied, not independently rerun. A separate factual current
router excerpt closes only its unavailable task-routing check; hardware,NTSC/8580,
actual interrupt-entry coverage and timing/devicewaveforms remain Unknown.

AR-P62 now owns the next post-call guard scope stop. A fresh independent assessor
receives code/failure/caps without a preferred remedy; no next production or test
edit precedes that assessment and a direct exact-scope ruling. Counts26/40,parent
38/48,v4four/ten and14remaining tasks stay; output review is still pending.

Output review completes with no introduced emitted-code defect and three inherited
MAJOR parity defects. Its initial unavailable-router qualifier is closed by an
authorized current routing/semantics supplement, without hidden/external reads or
another review/fix round. Replacements are analytical, not assembled or executed;
complete main/startup path timing,firmware execution,physical BSS totals and future
replacement allocation peaks remain Unknown. Exact startup code is99for byte and
119for borrow-reference/helper,not the dispatch's explicitly rough102/122estimates.
The auditor derives these independently from PRG−14−allfunctionbytes; the durable
ledger above already uses the reconciled exact values.

| Finding | Inherited generated → equivalent expert cost | Exact debt owner |
| --- | --- | --- |
| CL-MC-001 | Byte return13B/22cy→7/14;word25/38→19/30keeping low scratch/Y;calculate40/175→34/167for3,4. Each saves6B/8cy, caller JSR and every other obligation retained. | [#124](https://github.com/blendsdk/blend65/issues/124), immediate arithmetic/helper return staging |
| CL-MC-002 | Global word update callee30B/44cy→18/28with both destination stores/full width/flags preserved. PrefixPRG227→215,between319→307,transitive231→219in isolated analytical projections. | [#125](https://github.com/blendsdk/blend65/issues/125), global destination forwarding |
| CL-MC-003 | Ordinary nested wrapperJSR/RTS4B/12cy→JMP3/3;transitivePRG231→230,generatedstack4→2. Terminalcalculate40/175→33/158;PRG267→260,stack4→2. | [#126](https://github.com/blendsdk/blend65/issues/126), compatible nested terminal linkage |

Helper terminal saving overlaps CL-MC-001 and is never added. No frame release,
startup shrink,constant propagation or combined whole-program win is inferred.
The full-width direct-update comparator rejects INC because NMOS RMW bus writes
change the obligation. Existing main restoration is retained; the terminal-call
issue explicitly excludes returning past it or forging a JSR for current observer
enumeration. Existing call/arithmetic/retention owners are the correction seams,
not a new inliner,availability engine,runtime or source workaround.

Exact GitHub scopes#52/#115/#118/#122/#123are read before deduplication; none owns
these return/global/nested-link witnesses. Three focused issues are created under
the standing mandatory parity-debt authority; no existing issue is edited or closed.
Ledger **accepted** means accepted for correction/owned debt, not waived,dismissed,
new producer/API/helper/test authority, original-limit deferral or phase clearance.
All three are open; publicsize/963/725and FO-SF-002/full phase gates remain due.

The sole AR62independent assessment returns **Justified**: one96-line final-only
guard-composition leaf, not a producer-facing query capability. It verifies the
existing callback seam, exact private-local/call/SFA/raw proof conjunction and
operation-specific handoff; fit and fresh execution remain unmeasured. The visible
five-path packet is recorded in the owning ambiguity register: effects≤700,
rawresult≤526,main586→592,guardtest≤300;one new export,one optional per-use field,
one private accumulator signature,exactly one induction=truepost-call atomic
expectation change. Default query and induction=false rejection stay unchanged.
No AR62implementation/test/export/result/signature edit occurs before approval.

Call-only status is **Verified partial** for the qualified admitted class: all18
pre-draft meaningful REDs reach GREEN;69new/384focused/1,399directed/45boundaries,
strict/build/typecheck/install,36actualimages/72PALnative cases,seven original none
identities and all11oracles pass. Base,SFA,platform,host reviews find no introduced
defect; emitted-output inherited debt is explicitly owned above,not cleared. No
wholeinput accepted tuple/publicsize/task15/phase/GREENcheckpoint is claimed.
Source4207a8a8and130/669/386/364fit stay frozen. Tasks15/17/1.3.3await AR62direct
ruling,26/40verified,parent38/48,v4four/ten,14remainingtasks. No staging/commit/push.

Final bounded validation passes: exact4207a8a8four-path identity; sole approved
four-line old-row removal with every other old byte protected; all446entry-file
exclusions,eleven oracle hashes and frozen expert/spec/agent/policy/portfolio
boundaries preserved.62ARs/61resolved/only62open;40tasks/26verified with15/17/1.3.3
visibly blocked. Four source/seven touched Markdown files pass targeted formatting
under repository ignore policy,whitespace and185local links. The exact AR62new
leaf is absent and all AR62query/result/signature/test changes remain unapplied.
GitHub confirms#124/#125/#126OPENwith their exact assigned titles. Every native/
checkpoint/assessment/review/issue process is finished; index remains empty.
Execution Plan Updated:yes. Complete compiler checkpoint still has13known failures;
no RED commit/push or task/phase promotion is made.

Cleanup:done—remove only314owned temporary files in exact call-sites-e5jcjzu2after
the durable source/approval/RED/GREEN/native/cost/review/issue/blocker records above.
No symlink,unknown root,user file,worktree,retained artifact or another session's
content is removed. No raw artifact needs to survive this bounded qualification.
The next action is the sole exact five-path AR62user ruling,not implementation by
silence or a new model/effort prompt. All accumulated uncommitted work is preserved.

### Approved final-only call guards —2026-10-27

At14:38CETthe user's **“i approve”** directly answers the sole exact AR62five-path
packet before any new test/leaf/export/result/signature/guard edit. Resume only
one96-line final-only guarded-walker composition, effects≤700/rawresult≤526/main≤592/
guardtest≤300,one optional operation-keyed field and one private accumulator
parameter. Ordinary query/walker/producers/fixtures/call-only leaf stay unchanged.
Only the named old post-call atomic outcome for induction=true may later change;
its exact source/default-query negative and induction=false rejection stay.

Entry4207a8a8,447source/test/fixture/policy hashes and11oracles are captured; leaf
absent, HEAD1022fd52/feature-v4-rebuild,index/specclean. Fresh build and50unchanged
guard cases pass. Six new existing-concern admissions (reload/shift/short-circuit,
bounds both) are implemented with RED verification pending before production.
The old post-call row remains unchanged. Counts26/40,parent38/48,v4four/ten stay.

Complete six new admissions are meaningful RED at the intended atomic expectation;
50old cases pass and each ordinary query remains undefined. New test259/300fits.
Only then implement the approved leaf/result/private-parameter/two-consumer change.
Both actual representations now close before local guard hypotheses are computed;
other invalidators/default queries/raw maxima remain unchanged. The field is
operation-keyed and stays conditional on remaining atomic gates, never copied to
function-wide bounds or failed results. All five-path code is implemented with
formatting/fit/build/admission verification pending. Old row remains unchanged.

First complete production fit is60/96leaf,678/700effects,521/526rawresult,
589/592main,259/300test. Fresh build and all six new admissions pass; the50old
cases were filtered, not counted as passes in that directed admission run.
Only after admission GREEN, migrate the approved exact post-call row into the new
reload concern: both default-query undefined assertions and induction=false
rejection survive, induction=true atomic expectation changes to complete. Bounds
both now cover all three forms with/without induction; no other old bytes change.
Add operation-keyed7versusfunction-wide/raw isolation, two-layout resource/assembly
nonmutation and unknown/actual-code-overlap raw-callee rejection. These new test
additions are implemented with complete normal-format capacity/verification pending.

Complete five-path fit is60/96,678/700,521/526,589/592,296/300after normal formatting.
Strict ES2023/NodeNext owned-root typing and62complete guarded-use cases pass,
including six original admissions, both ordinary-query negatives and retained
non-induction rejection. Only the exact five-line post-call row is removed from
the old table; its exact source/default-query assertions now run in the focused
reload group under both bounds/induction settings. Every other old byte remains.
Frozen five-path sorted-path/SHA compact-JSON identity:
`ed1b4c1f5c794ba11bf182800ada4d71258361fc98fac43db39d291011b866d1`.
All excluded447entry hashes and eleven oracles are preserved. Production/test
code now freezes for bounded independent reviews,full checkpoint,native behavior
and exact assembly/resource evidence. Task15partial26/40,parent38/48stay.

Bounded base,SFA and host reviews complete with no findings. Base and host initially
pause for inspectable baseline diffs; primary supplies exact inline four-/five-file
diffs without hidden/external reads or denied-path relocation. These are completion
of the same first reviews, not fix/re-review rounds. Base checks the sole authorized
old-row migration and default-query/non-induction protections. SFA independently
refutes live caller/argument/helper/borrow/alias counterexamples through the final
atomic conjunction. Host confirms replacement rather than duplicate guarded walks,
plus per-loop map insertions and per-index lookups; retaining reload facts may
increase fixed-point fact counts/revisits and lifetime. No measured latency/RSS or
performance-invariance claim; supplied four-loop/37attempt bounds148queries and
296representation checks are conservative counts, mostly pre-existing work.

Fresh install/build/typecheck pass in0.39/2.18/0.98s;1,411directed cases/85files
pass243.42s,45boundaries2.52s. Full yarn test remains RED:compiler3,083passes/
13same known frontier failures/two existing skips,370.57s. Root suite is not reached.
Publicsizeconstructor and rejected-baseline cost-validator gates are unfinished,
not new test failures. No staging/commit/push,task promotion or GREEN claim.

First fresh native run passes80actualACME0.97images/160sequential pinnedVICE3.10
PAL/6581cases without skipped/failing cases or changed expectations. Three ordinary
guard forms×six source-initialized seeds0/7/8/63/64/255×both bounds×reference/selected
produce72images; nested-multiply and safe raw-call seed7 add eight. Every image runs
with incomingP20/ED. No source input is injected after startup: only pre-entry BSS
patterns are seeded, then actual source initializers overwrite them.

Independent source answers: the word loop writes0..7in order, then exactly one
value42store only on admitted paths. Reload requiresseed<8;shift/short-circuit
requiresseed<64andindex=seed>>3. Otherwise no call/extra store occurs. Touch writes
stop1, nestedmultiply12, safe rawcallstop0andC140exactly one value1write. All per-byte
data/stop/raw order/counts and intermediate pre-store arrays pass. Actual wordcounter
is0..7at each loop store. Every live caller request crossing the source call is
snapshotted; the guarded column is explicitly among them and retains its index
before/after. Actual callee/child/helper entries descendSP2/4/6and returns balance;
D0/Iincoming hold. Genuine SYS return restores P/SP,CPUports,BASIC03–06,CIA2DDRA,
all actually borrowed BASIC bytes and SYS A/X/Y/P publication. This is not elapsed
timing,IRQ/NMI injection,external total-stack or physical-hardware evidence.

| Seed7 actual source | PRG OFF/ON ref→selected | SFA RAM/ZP ref→selected | Unique general occupied OFF/ON ref→selected | Physical ZP | Generated stack | Platform state | Startup code |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| Derived shift |250/273→250/273|7/2→6/2|270/293→269/292|2|2|5|106|
| Local reload |241/264→241/264|6/2→6/2|260/283→260/283|2|2|5|106|
| Short-circuit guard |255/278→255/278|7/2→6/2|275/298→274/297|2|2|5|106|
| Nested multiply |302/325→302/325|8/4→8/4|325/348→325/348|4|6|7|126|
| Safe raw callee |778/801→778/801|5/2→5/2|841/864→841/864|2|2|50|653|

PRG=2header+12stub+actualstartup+every reachable function/helper,zero code padding.
Sourceglobals10(data8/seed1/stop1),platformBSS and SFA are separate resident terms;
unique general isPRG−2+globals+platformstate+actualRAMframe. Layout intervals use
inclusive ends. A first scratch union preview omits end+1and is corrected before
qualification claims; native expectations/identities never change. Startup holds0
across main/transient1; generated stack is not total external SYS/ROM/NMI demand.
Observer itself adds no target code,home,copy or runtime demand. Selected shift/
short have one less RAM byte from inherited construction,not a new emission win.

Source/native scriptSHAa9034f90fdb1ad13aa931641bd8bfb1cd11280e95b3b77a1b17c1e513833d343;
80imageJSON74a9463df6ad24bc8abd654d3b896e92ea074ba2f8df07e50a4742b43d25beac;
160traceJSON75218ef778668f3ee3a9487bfbf5269a73a50324d7e57dae104fe6089c16bd24;
inclusive unique-resource ledgeraae58429dccb81996c4693f01b93547e2e9c70a6f05b6897f129411efbb8e232.
Every actual assembly/PRGhash reconciles with its captured image record. Pinned
VICE executable/ROM identities equal the immediately preceding call-only ledger.

Platform auditor finds no introduced defect, but initially keeps intermediate
mapping/full-VIC-state/order observations Unknown. Supply eight additional native
cases reusing four existing compact/full images,reference/selected,P20/ED. Actual
mainentry00/01=$2F/$36andCIA2DDRA=$3C;incoming/final$2F/$37and$3F. Full entry is
seeded with nontrivial masked values at all41saved VIC/sprite-position/color/
pointer locations; all41restore,includingD010. Capture/initialization/restoration
CPU access traces include every named device/port/borrowed byte. First probe assumes
D010is cleared at initialization and fails after four compact passes. Existing
startup379–443disables sprites and does not clear X-high; correct only this temporary
initialization-write list, preserving D010capture/restore/order/value checks. Fresh
eight-case rerun passes; no existing test,producer,timeout or final-state oracle
amendment. Capture/restore separate read/write orders then pass exact combined
chronological `{address,operation}` stream comparisons over all eight retained
native records. Fullrestore45tracked writes,compact4; no tracked device reload.

Supplement probeSHAb58b868bbcebdc1c8417dce52c2f13df5c738018f56f1d2fe8da6532f4dad5ae;
eight-captureJSONab02f8698e72a2593a7bbf2c22ecc60f8d3d11b41ab25db32e919ba1704d14a3;
mixed-orderJSONe228f8d431c2174b30f7cfb17380a29d4a1c9f7cea87d418f251bbe6aca46850.
Platform reviewer closes its specific Unknowns with no findings, attribution to
parent execution explicit. No full-bus,silicon,other-profile,actualinterrupt-entry,
deadline,externalstack,public-input or phase claim. Status **Verified partial**,
claim **Fact**, **VICE-verified / hardware-unverified**, PAL/6581only.

Independent output review finds no introduced emitted-code defect and two inherited
MAJOR gaps. It reconciles complete PRG/resident/resource ledgers above. Incidental
historical roadmap verdict exposure is disclosed/excluded; current artifacts and
authorized normative excerpts remain its evidence. No replacement is assembled or
executed and no complete expert startup/firmware/whole-program cost is established.

| Finding | Current → equivalent expert isolated cost | Owned correction |
| --- | --- | --- |
| CG-MC-001 | Post-call LDAcolumn/CMP8/BCStrap7B/8cy→0on the proved successful path. Main128→121B,PRG264→257,general283→276;SFA6/ZP2/state5/stack2and looptrap retained. Main-entry/restoration-entry896→888nominal cycles. | [#127](https://github.com/blendsdk/blend65/issues/127), producer-side guarded call bounds |
| CG-MC-002 | STAcolumn/JSRtouch/LDYcolumn9B/14cy→TAY/JSRtouch4/8with proved Y preservation. Main114→109B,PRG250→245,general269→264;allSFA/ZP/state/stack reservations retained. Main790→784nominal cycles. | [#128](https://github.com/blendsdk/blend65/issues/128), call-clobber/index delivery |

CG-MC-001does not feed final conditional hypotheses backwards as unconditional
producer facts. CG-MC-002's conservative write-retaining first step saves2B/2cy;
actual home removal requires exhaustive-use/debug/SFA reclosure. Do not assume
void means flags dead; the exact next LDA42/normal restoration discharges N/Z.
All projections are analytical,not assembled/executed;do not sum other issue wins.
Exact scopes#89/#104/#105/#107are read before deduplication. #104owns X-retaining
aggregate calls,not this measured Y-store child. Two issues are filed under standing
mandatory parity-debt authority; no existing issue is edited/closed. Ledger
**accepted** is correction ownership,not waiver,dismissal,implementation/oracle
authority or original-limit deferral. Existing#115–#126and complete output gates stay.

Fresh seven original none artifact lengths/hashes and empty diagnostics reproduce.
All11oracles/447excluded-entry hashes and ed1b4c1ffive-path identity stay unchanged.
Current expertlineage remains2.0.4activequalifiedfrozen/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15,
SFA lifetime/interference/ABI/finalclosure,IL TwoOracle,MOS instruction/bus/stack,
C64 startup and ACME/VICE contracts;keysMOS-PGM-1976/MOS-HW-1976/MOS-6510-1982/
CBM-C64-KERNAL-03/VICE-310-MANUAL/P3/spec4. No frozen authority or policy change.

Read-only24actual-source constructions still fail. Saved Original now errors in
the earlier existing whole-function representation walk,not yet at the post-call
guard: an actual variable-shift source block has a bypassed same-PC empty .low
alias and a legitimate ASL/DEX/BNE self loop. Reference/candidate aliases share
PC3151/3047;loop3155/3051. The reported premise is matchingColumns324/span9454–9467,
but the source block contains rowMask302. AR62moved this unchanged check before
guard hypotheses; it did not modify emission or authorize CFG correction. Other
saved policies still reject wider selected-loop composition; acquisition keeps
asynchronous borrowed-backing rejection. Actual-source JSONSHA:
`faa01fe0b6094f01b75b17dd51280069e863adb230e3daa5a7a86a37b38b758f`.
Four isolated left/right variable-shift+ordinary-word-loop sources reproduce the
same error,boundsboth; discoveryJSONSHAb574a73d8d540fb33549531bca65c04515ba2848d49c21cf12cdbf63534792fd.

AR63records the necessary next source-block helper-CFG scope before any correction,
new test/helper/API or cap edit. Its sole independent assessment receives actual
facts/code/caps and viable directions without a preferred answer. Current guard
unit stays frozen and locally verified,task15partial26/40,parent38/48,v4four/ten;
six implementation and eight hardening tasks remain. Tasks15/17/1.3.3are visibly
blocked only on that exact next scope ruling. No staging,commit or push.

The sole AR63independent assessment returns **Justified**: reuse existing same-PC
alias authority and add one focused unsigned-byte ASL/LSR/DEX/BNE finite-kernel
predicate,not unrestricted graph reachability. Reloading X,overwriting Z,wrong
backedge/entry/direction/identity or a foreign continuation must fail locally.
Existing provenance authenticates content but does not replace that semantic
obligation. Parent has22lines; no complete inline fit is evidenced. Its one
genuine alternative is the same proof inline if readable700-line fit with reserve
is demonstrated,not a weaker reachability test. No such draft is authorized.

Exact pending three-path packet is in AR63: effects≤700/aim695,one new
size-observer-original-shifts.ts≤260/aim220,existingOriginal-composition test≤500/
aim480with fresh cases only. Exactly one five-argument boolean export uses existing
SemanticBlock/MachineBlock/ResidualFailure types and a callback to unchanged private
canonicalTarget. No old private signatures,producer/query/guard/result/API/metadata,
signed/word-kernel scope,old expectation,source or frozen-oracle change. Expected
target overhead0must be verified; host matching and readable fit remain unmeasured.
Current ed1b4c1fguard unit and every other file stay frozen. The new AR63leaf is
absent. Tasks15/17/1.3.3await the sole exact scope ruling;26/40,parent38/48,v4four/ten,
14remainingtasks. Full13knownfailures prohibit the pending commit/push.

Final bounded validation passes: ed1b4c1ffive-path identity and60/678/521/589/296
caps; exactly the approved five-line post-call row migrates, with every other old
test byte unchanged. All excluded447entry hashes/eleven oracles and frozenexpert/
spec/agent/policy/non-integration portfolio boundaries remain preserved.63ARs/
62resolved/only63open;40tasks/26verified/15,17,1.3.3visibly blocked with reasons.
Five source/seven touched Markdown files pass targeted formatting under repository
ignore policy,whitespace,documentation/reference checks and185local links. GitHub
confirms#127/#128OPENwith exact assigned titles. The proposed AR63leaf is absent;
no internal-shift correction/test/API or other unapproved change exists. Index
empty,all native/checkpoint/review/assessment/issue processes complete. Execution
Plan Updated:yes. No task/phase/GREEN promotion,staging,commit or push.

Cleanup:done—only297owned temporary files in the exact `call-guards-sgavpvgy`
directory are removed after durable approval/RED/GREEN/source/native/artifact/resource/review/debt/failure/
next-scope records. No symlink,unknown root,user file,worktree,retained artifact or
another session's content is removed. No raw evidence needs to survive this bounded
unit. Preserve all accumulated uncommitted work and await the sole exact three-path
AR63user ruling; do not implement by silence or pause for a model/effort decision.

### Approved Original internal shifts —2026-10-27

At23:00CETthe user's **“I approve, continue”** directly answers the sole exact
AR63three-path packet before new tests/leaf/export/helper/CFG edits. Resume only
one unsigned-byte finite-kernel leaf≤260, existing effects≤700alias/internal-edge
handling and existing Original-composition test≤500fresh cases. Every old private
signature/outcome, producer/query/guard/result/fixture and eleven oracles stay.
The first multi-file approval patch fails atomic context verification; no file
changes before the corrected approval record. Counts26/40,parent38/48stay.

Entry ed1b4c1fand448source/test/fixture/policy hashes are captured, leaf absent,
HEAD1022fd52/feature-v4-rebuild and index/spec clean. Fresh build and34old Original
cases pass. Six fresh bounded/fresh-Z/full-width unsigned left/right sources are
added to the existing positive/resource tables, preserving every old row/index/
assertion. Eighteen new directed cases are implemented with RED verification
pending before production. No new helper or source workaround is introduced.

All18new admission/resource cases reach meaningful RED;34old cases pass. The
bounded/fresh-zero forms hit the known disconnected-alias error and full-width
forms hit the internal-cycle rejection; no constructor/type failure is counted.
Actual source/producer inspection confirms unsigned byte ASL/LSR+DEX+BNE, explicit
CPX0or fresh final private LDX flags, and intact full-count saturation paths.
Implement only the approved finite-kernel/entry predicate and existing alias walk.
Source matching uses retained operation-span identity, incoming edges are scanned
once per match, and empty aliases are collapsed without granting memory coverage.
The parent still visits/owns every original label and checks every source exit,
word write,call and footprint. Return-to-startup fallthrough is not an internal
alias. Production implementation is complete with formatting/fit/build/admission
verification pending; no old helper signature,producer/query/guard/result changes.

First complete ordinary-format fit is178/260leaf,699/700effects,388/500test.
Fresh build and all52Original-composition cases pass:34old plus18new admissions/
resource identities. Both explicit CPX0and fresh final LDX zero gates pass, with
full-width high-byte/saturation construction retained. No existing expectation
or helper signature changes. Add17fresh mutation classes in both actual layouts
through unchanged actual/helper patterns; local residual and outer atomic
rejections are distinct assertions. This new test matrix is implemented with
complete normal-format capacity and strict/test verification pending. Effects
has one line of hard-cap reserve and receives no further edits during this step.

Complete mutation formatting is553/500,production178/260and699/700unchanged.
The agreed hard stop triggers immediately before strict test typing or mutation
execution. No build,full checkpoint,native/output/quality qualification follows
the overrun. Preserve all17mutation classes/two actual layouts and every old
source/outcome/assertion/helper; no code/docs are removed, compressed, extracted,
exported or moved and no cap grows. Prior18meaningfulREDs and52admission/resource
passes remain the only current-unit verification,not a complete shift-proof pass.

AR64records the exact measured capacity ambiguity. Current unqualified three-path
sorted-path/SHA compact-JSON identity is
`59103074487b8edc793a8e4f54c2a985cfbb5c23c38aab8a1227eac15960a2f0`.
All excluded448entry hashes and eleven immutable oracles remain unchanged; proposed
adjacent size-observer-original-shifts.impl.test.ts is absent,index/specclean.
Task15is partial and15/17/1.3.3visibly blocked,26/40,parent38/48,v4four/ten,14remaining.
No staging,commit or push. A single independent minimum-sufficient capacity
assessment receives measured ownership and viable same-file/focused-concern
directions without a preferred answer. It cannot approve movement or qualification.

The sole independent capacity assessment returns **Simplify**: keep the500-line
composition budget and move only the new unqualified matrix into one adjacent
implementation-test concern≤260. It independently reads553lines and confirms the
matrix102–266uses only bounded/fresh source literals and existing qualified helpers.
Keep Input/loops/homes/actual private and unchanged; no test-module exports or
imports. Use exact local source constants, checked semantic main identity and
inline side-local functions cloning in the new concern. Parent388is arithmetic,
new200–230/260is an estimate,not formatter/type/test evidence. Production178/699
is unchanged for this capacity remedy. No new named helper/harness/test-support/
API or old-outcome authority. Raising500→600is viable but not necessary and is
not the recommendation. Exact four-path preservation/movement packet is in AR64;
direct ruling pending,new test file absent,unqualified59103074preserved.

Final stop-packet validation passes: exact59103074three-path identity and178/699/
553counts remain,with the500test overrun visibly blocked,not treated as GREEN.
Removing only the24new source lines,165new matrix lines and new type-import token
in a read-only integrity comparison reconstructs every baseline364old test byte;
no helper/source/assertion/outcome was altered. All excluded448entry hashes,
eleven oracles and frozenexpert/spec/agent/policy/portfolio boundaries remain.
64ARs/63resolved/only64open;40tasks/26verified/15,17,1.3.3blocked with exact reasons.
Normal-format/whitespace/documentation-reference integrity and185local links pass;
these are artifact checks only,not forbidden post-overrun compiler/test qualification.
The proposed adjacent test concern is absent and every process/assessor is complete.
Index remains empty. Execution Plan Updated:yes;no task/phase promotion,commit,push
or new native/strict/full/quality claim. Prior52passes remain admission-only.

Cleanup:done—remove only16owned temporary files in the exact
`original-shifts-9o1gc0um` directory after durable approval/RED/admission/capacity/
identity/independent-assessment and pending-scope records. No symlink,user file,
worktree,retained artifact or other session content is removed. No temporary raw
evidence needs to outlive this stop. Preserve the entire unqualified source/test
draft and all accumulated work; await the sole exact AR64test-file/movement ruling.

### Approved adjacent shift mutations —2026-10-28

User **“proceed”** directly answers the sole AR64file/movement question; approval
clock captured2026-10-2723:59CETbefore extraction,new file or ownership wiring.
Entry current59103074/178-699-553and449source/test/fixture/policy hashes/eleven
oracles are captured at00:02CET. Existing production is unchanged for relocation.
Move only the new unqualified165-line matrix into the approved≤260test concern,
retaining exact bounded/fresh source bytes, all17mutations×two layouts and both
local/atomic assertions. Existing composition loses only that matrix and unused
MachineBlock import; all old helpers/source/outcomes and six positive/resource
rows remain. New concern uses checked semantic main and inline side-local clones,
not exports, named helpers, a cross-test import or changed test-support API.
The movement is implemented with complete formatting/identity/strict/test checks
pending. Counts26/40,parent38/48,v4four/ten and14remaining tasks stay.

Complete relocated fit is parent388/500,newmatrix186/260,production178/260and
699/700. Exact165-line removal plus unused type token is confirmed against the
captured553-line parent; both local source literals match the original positive
rows byte-for-byte. Production files remain byte-identical for relocation. No
qualified helper moves,exports,named new helpers or test-support changes occur.
Full strict ES2023/NodeNext typing and both complete test owners pass86cases:
52admission/resource plus34two-layout mutations,including local residual and
outer atomic assertions unchanged. No expectation is weakened for the movement.

Frozen four-path sorted-path/SHA compact-JSON identity:
`149233d870527d5b2f386aafac63bc168a95bb0a895d0011f23d5329debb7aaf`.
The complete AR63/64review diff includes the178-line new leaf,186-line new test,
parent control changes and six positive rows. Reversing only the known AR63parent
hunks reconstructs678lines; its five-path checksum exactly matches the prior
qualifieded1b4c1fbaseline,so the before-source is cryptographically checked,not
guessed. All excluded449entry hashes/eleven oracles remain unchanged. Code now
freezes for full checkpoint,independent reviews and actual native/resource/output
qualification. Task15is still partial26/40,parent38/48; no GREEN commit/push.

Three bounded static reviews complete with no findings: base correctness/standards/
oracle integrity,SFA/ABI/word-home preservation and host performance. Every old
helper/assertion/outcome remains unchanged under the exact complete diff. SFA
confirms aliases cannot skip instruction scans/ordered word writes/source exits;
the accepted ASL/LSR-A+DEX/BNE kernel has no memory,call or stack effect. Full-word
count high/saturation semantics remain ordinary lowering,not byte-X inference.
The old whole-function counter-write conservatism after counter death is unchanged,
not declared a permanent source rule. Incidental SFA roadmap/history exposure is
disclosed/excluded from substantive reasoning; current code and normative facts
are decisive,not prior verdicts.

Host review quantifies one predicate asO(B+E+O+S)per encountered kernel,including
local predecessor/owner allocations. WithKkernels/Lpendingloops,two layouts can
incur2LK(B+E)plusfilter/membershipwork. Quadratic aggregate scaling whenKgrowswithB
is real,not claimed absent; no consequential realistic workload/latency/RSS witness
survives this bounded audit. New admission versus baseline first-kernel rejection
is not equivalent completed work. There is no persistent cache,solver,I/O orsource
trip-count multiplier. Actual observer invocation counts and host invariance remain
unmeasured; complete phase performance/scaling remains open.

Fresh install/build/typecheck pass0.59/3.08/0.77s;1,463directed cases/86files pass
282.09s,45boundaries2.33s. Full yarn test is still RED:compiler3,135passes/13same
unfinished frontier failures/two existing skips,317.84s. Root suite not reached.
This is not GREEN and does not permit the pending commit/push or task15promotion.

First fresh native run passes152actualACME0.97images/304sequential pinnedVICE3.10
PAL/6581cases with no failed/skipped case or amended expectation. Six unchanged
positive source shapes vary only their declared seed literal. Bounded left/right
use0/1/7/8/255;private-fresh use0/1/7/8/128/255;full-word count use0/1/7/8/255/256/
257/65535. Both bounds,reference/selected and incomingP20/EDrun. All source inputs
are initialized by the program; debugger patterns are written only before startup
and then overwritten by the actual array/seed/answer initializers.

Independent mathematical reference iswidth8BigInt/floor:bounded/fresh countseed&7,
widecountfull16bits;count≥8returns0,otherwise exactleftshift&255orunsignedright.
Never use JS's modulo32shift count. Fresh operand=seed;literaloperand1/128. Each
actual typed array store checks sourceprefix,A=i,actualwordcounter=i,SP/D/I and
exact0..7writeorder. Zero gates check Xcount/Aoperand; empty gates require fresh
X-derived Z,including nonzerooperand128/count0. Every positive helper iteration
checks X=count−n,A=referencepartialshift,V unchanged; continuation checksfinalA,
X0andlastshifted-outCforpositivecounts,SP/D/I,wordcounter8andunchangedarray. Full
word0100/0101/FFFFsaturation preserves high bytes,not truncatedzero/one counts.
Exactlyone answer store occurs. True SYS return throughE147/E155checks P/SP,
CPUports,BASIC03–06,CIA2DDRA,allborrowedBASICbytes and SYS A/X/Y/P publication.
IntermediateCPU00/01mappingandCIA2DDRAare explicitly checked atmain,not inferred
only from restoration. No actual IRQ/NMI/deadline/fullbus/otherprofile/silicon claim.

| Actual seed7 family, left/right and ref/selected identical costs | Complete PRG OFF/ON | Startup code | Main code OFF/ON | SFA RAM/ZP | Globals / platform state | Unique general OFF/ON + ZP |
| --- | --- | ---: | --- | --- | --- | --- |
| Bounded literal |226/242|104|108/124|6/2|10/5|245/261+2|
| Private operand/fresh Z |231/247|104|113/129|7/2|10/5|251/267+2|
| Full-word count |237/253|109|114/130|5/2|11/5|256/272+2|

PRG=2header+12stub+allstartup+allfunctioncode,zero padding,no additionalhelper
functions. Globals/state are additional resident costs; inclusive interval unions
avoid duplicate ownership. Declared certificate hardwareStackProgramPeak2is a
conservative component,NOTobservedJSRdepth:actualmain/helpercodehasno calls and
SPisconstantacrossmain. Startupholds0/transient1;externalSYS/ROM/interruptaggregate
separate/Unknown. The observer adds no target instruction,home or runtime.

Native scriptSHAf5faa2edea178b81b8f318ec56414651ed4aa117a22278f09a1ddd68387a3dc9;
152imageJSONf7a16b07984c8bab49622fe5386d083b7bcc60466a5d0588230b3a04b37c9471;
304traceJSON09bf7dbee3a60d16345fd229498f849e561e011cc03e1a2dcbf190daac131469.
All actual ASM/PRGhashes reconcile with image records. Executable/ROM identities
match the preceding pinnedVICE/KERNAL03/BASIC01/chargen01ledger. Status **Verified
partial**,claim **Fact**,**VICE-verified / hardware-unverified**,PAL/6581only.

Platform reviewer initially marks independent raw-artifact correspondence Unknown,
not a compiler finding. Supply requested authorized inline line-numbered probe
assertions and matched PRG-offset/byte/native-record excerpts for fresh operand128/
count0andfull-word0100,both directions. At0884F004branches088A;zeroGateA128/X0/Z1
anddoneA128matchrecordedP20/ED. At0873actualACF308D052loadsseedhigh1andbranches08CA,
whoseA9004C8908sets0andjumps0889;doneA0/X47/Y1andfull-wordseedassertion distinguish
high-byte saturation from zero-count preservation. Bothkernel4byteencodings
0ACAD0FC/4ACAD0FCdecode exactlyshift/DEX/BNEself. E147/E155restoration/SYSrecords
matchmaskCF/SP+2/borrowedstate. The same first review then completes with no findings.
It independently decodes/checks fresh inline excerpts,not execution or hashing;
whole152/304reference/boundsONcorpus remains parent-executed. Earlier denied
historicalrawpaths are not reopened or relocated. Qualification limits stay explicit.

Output review identifies no introduced target/storage regression and three inherited
emission debts:twoMAJOR/oneMINOR. It independently reconciles all complete cost
terms above from supplied current ASM/ledger. Every replacement is analytical,
unassembled/unexecuted; no complete expert startup/firmware/wholeprogramwin follows.

| Finding | Current → equivalent expert isolated cost | Correction owner |
| --- | --- | --- |
| SH-MC-001 MAJOR | Bounded STAcount/LDXcount6B/8cy→TAX1/2;fresh7instructionprefix20/26→LDAseed/TAY/AND7/TAX/TYA/CPX0 10/14. PRG226→221or231→221,allreservationsretained. | [#129](https://github.com/blendsdk/blend65/issues/129) |
| SH-MC-002 MAJOR | Runtime-shift continuationSTAtemp/LDAtemp/STAanswer9B/12cy→directSTAanswer3/4. PRG226/231/237→220/225/231boundsOFF,othertermsretained. | [#130](https://github.com/blendsdk/blend65/issues/130) |
| SH-MC-003 MINOR | Bounded literal operand reordering reusesLDXZand removesCPX0(−2B/2cy). Wide successfulcount<8zero/kernel8→7BviaDEX/BMIthenASL-or-LSR/DEX/BPL,same5zero/7n+3positivecycles. | [#131](https://github.com/blendsdk/blend65/issues/131) |

SH-MC-001requiresstableordinaryRAM/Yavailability,notvolatile-readmerging. SH-MC-002
usesexactstore/restoration continuation todischargeN/Z,notuniversalvoiddeadflags.
SH-MC-003maychangeXfinalFF/NZ/zeroC;only thiscontinuationqualifies,andcurrentfresh
6Bkernelalreadybeats7Bcountdown. Countcaptureelisionandloadreorderingcompete;never
addtheseorotherissuesavingswithoutcombinedcode/layout/behavior/SFA/debugproof.
Old#120/#121/#122exactlyownwordindex/updatework;#107/#115/#116/#124inspectedscopes
do not record these runtime main-local/count/control cases. #116exactbody is read
before deduplication. Three focused issues are filed under standing parity-debt
authority; no old issue is edited/closed. Ledger **accepted** means ownedcorrection,
notwaiver,dismissal,producer/API/helper/test authority or original-limit deferral.
Futureproducerformsneedseparatelyqualifiedobserverproof;do notforgeBNEorloosencurrent
predicate. Canonicalnone/originaloraclesremainprotected. Source/body/stackcosts
andcriticalFO-SF-002/fullphase gates remain due.

Readonlyactual-source24constructionsstillunqualified. SavedOriginalnowpasses
theoldshiftfailureandhitsoldBoolean-onlyshared-returngateonInputState0/1/2. Empty
same-PCaliaschainsendinexactLDA-immediate/RTS;enumconstantusesBigInt/integer:null,
normalbyte-backedtype. IsolatedBooleancontrolsPASScurrentbyte/enumcasesFAILbothbounds.
ActualJSONab6589d0362476275537bc3d509e1dfb6c317b31aac4396f4c0f1e67dd5605e5;
return-mapJSON96a6b77ca469fd417c8ddac5eed22b21d5d59e0ea7d0e460c2fbf0361ae5bacb;
isolatedreturnJSON97dc1835725aeb8b107373f26247f26d0bc89d6ab8df2afa92c136c8d474c033.
Otherselected-loop/asyncborrowfailuresremainseparate. No new return-class code or
source workaround is made. AR65owns the exact necessary next scope before edits.

Sole AR65blindassessment returns **Justified**: one140linepuretypedshared-byte-return
leaf/onesix-argumentpredicate,exactqualifiedinlineBooleanconcern292–312movement,
effects≤700minimaldispatchandcompositiontest≤500additivecasesonly. Existingliteral
resolverandencoderalonecannotproveABI/type/range;useexistingsemanticTypesEqual
andencodeComptimeScalarONLYafterstrictvalidatedBoolean/byte/sbyte/enumdomainchecks.
Nominalenumidentity/returnID/signedencoding/alias/terminal/pureoneconstantshapeall
mandatory. No alias-walker/general-body framework/type/result/producer/query/guard/
old-outcomechange. Fit685–695parent,80–120/140leafand112availabletestlinesremain
estimates;natural signed shapes/fulltestcoverageunmeasured. Exactpacketrecordedin
AR65,notimplementationapproval. Newreturnleafabsent,current149233d8freezes.
Task15partial and15/17/1.3.3blocked,26/40,parent38/48,v4four/ten,14remainingtasks.
No staging,commit,push,whole-input,size or phaseacceptance. Five bounded reviews
complete;paritydefectsownednotwaived,full13failuresremain.

Final movement integrity additionally compares the old/new mutator bodies after
only the approved semantic-main ownership substitution and whitespace normalization,
while requiring every quoted string and all17labels/source-selection expressions
exactly unchanged. Normalized bodySHA865653312cf8089cf3c6ca2efef7627a6f4449dec19bca8de953d53b9ca4e1d7.
The first auxiliary AST attempt finds no ScriptTarget on the imported TS runtime
surface and yields no verdict; no dependency/toolchain/source change follows.
The completed exact-text/string comparison plus strict/tests and independent review
is the movement evidence,not a claimed AST result.

Final bounded validation passes:149233d8and178/699/388/186caps,exact165-line/type-token
movement,two source literal bytes,alloldhelpers/assertions/outcomes,all449excluded
entry hashes and eleven oracles.65ARs/64resolved/only65open;40tasks/26verified and
15/17/1.3.3visibly blocked with exact reasons. Four source/seven touched Markdown
files pass targeted formatting under repository ignore policy,whitespace,docs/
reference checks and185local links. All152actualASM/PRGhashes and304trace/image
cardinalities reconcile. GitHubconfirms#129/#130/#131OPENwith exact assignedtitles.
Frozenexpert/spec/agent/policy/non-integrationportfolio and empty index stay.
NewAR65returnleaf remains absent;all processes/reviewers/assessors/issue operations
are finished. Execution Plan Updated:yes. No task/phase/GREEN promotion,staging,
commit or push. Publicsize and alloriginal963/725/resource/output gates remain due.

Cleanup:done—only504owned temporary files in the exact `shift-qualification-at0i6_lx`
directory are removed after durable approval/source/RED/strict/native/ASM/resource/
review/debt/failure/next-scope records. No symlink,user file,worktree,retained artifact
or another session content is removed. No raw artifact needs to survive this bounded
unit. Preserve every accumulated uncommitted change and await the sole exact
three-path/six-argument shared-byte-return AR65ruling; no implementation by silence.

### Approved typed shared returns —2026-10-28

User **“proceed”** directly answers the sole AR65three-path packet; approval clock
captured14:32CETbefore new tests/extraction/leaf/export/dispatch edits. Only exact
qualified inline Boolean predicate movement, one140-line typed-return leaf/export,
effects≤700minimal dispatch and compositiontest≤500additive cases are executable.
All other signatures/helpers/alias walkers/queries/producers/guards/results/old
expectations remain protected. Counts26/40,parent38/48and14remaining tasks stay.

Entry149233d8and450source/test/fixture/policy hashes/eleven oracles are captured,
new return leaf absent,index/spec clean. Fresh build and52old composition cases
pass. Three fresh byte/sbyte/nominalenum source rows exercise0/127/255or−128/−1/127
with each return repeated three times to require real shared aliases. Natural
module constants express signed endpoints without a hardware/source workaround.
Nine new positive/resource cases are implemented with meaningful RED verification
pending before production. Every prior row/index/helper/assertion is unchanged.

All9new admission/resource cases reach meaningful RED at the intended Original
shared-return expectation;52old cases pass. Signed module constants lower to the
required single semantic constant,not a constructor/type failure. Test400/500fits.
Only then implement the exact qualified predicate movement and typed leaf. It
checks return ID/one-constant shape,Boolean/byte/sbyte/enum mathematical domains
and nominal declared type before existing scalar encoding. Same-PC empty aliases,
single immediate LDA/no memory effects/ordinary RTS remain mandatory; no branch-
span equality is invented. Parent keeps the same failure decision point and all
other control/word/call/physical logic. Production is implemented with complete
normal-format cap/build/admission verification pending; no other file/API change.

First measured fit75/140leaf,687/700effects,400/500test. Fresh build and all61cases
pass:52old plus9new admission/resource cases. Exact negative/nominal/signed ranges
are checked before encoding; extra RTS/no-memory checks preserve ordinary ABI.
Add direct fragment tests over each new source family/both actual layouts, proving
real multi-alias chains and baseline fragment success before each mutation. Cases
cover bad ID/type/nominal enum/range/Boolean representation,AX/aggregate exclusions,
extra source/effects/terminal shape and instruction/JMP/displaced/cyclic aliases.
Counterfactual immediate bytes intentionally match unchecked wrapping for malformed
values, so range rejection cannot be satisfied merely by a byte mismatch. The new
additive tests are implemented with complete normal-format capacity/strict/execution
verification pending. No old assertion/source/outcome or qualified helper changes.

Complete normal formatting measures75/140leaf,687/700effects and554/500test at
15:03CET. The151-line new direct matrix plus3imports exceeds100available lines.
Honor the agreed hard stop before strict typing,matrix/full/native execution or
quality qualification. Preserve unqualifiedthree-pathidentity
`fbc971f602894c43b240df6c49eb549dfffd113b4d0089692d8688b60576a381`.
No checks removed,compression,extraction/new file/helper/export/cap change. AR66
records the measured capacity issue; sole independent assessment pending. All
old helpers/source/assertions/outcomes and accumulated uncommitted work remain.
Task15partial and15/17/1.3.3blocked;26/40,parent38/48,v4four/ten,14remaining tasks.
No staging,RED commit,push,whole-input acceptance or phase promotion.

Read-only preservation checks confirm all388baseline composition bytes exactly
after removing only the12new source-row lines,151new matrix lines and3imports.
Every old helper/source/assertion/outcome is intact. Replacing only the new
sharedReturn dispatch with the captured21-line Boolean concern and removing its
one import reconstructs the exact699-line prior effects owner; no other parent
logic changed. All450entry hashes are accounted for,448excluded paths/eleven
oracles unchanged. Current fbc971f6and production75/687remain preserved; proposed
adjacent return test is absent. Frozenexpert/spec/non-integrationportfolio and
empty index stay. Targeted six-document formatting/whitespace and185local links
pass;66ARs/65resolved/only66open,40tasks/26verified,three visibleAR66blocks. These
are preservation/workflow checks only,not strict/matrix/native/full qualification.
Captured fresh RED11.43sreports9failed/52passed; firstGREEN11.60sreports61passed,
freshbuild2.407s. None qualifies the later554-line direct-fragment draft.

The sole blind AR66capacity assessment returns **Justified**: one adjacent
`size-observer-original-returns.impl.test.ts`≤200 owns only the new151-line direct
matrix,exact copies of the three labelled source strings102–113,and minimal
import/table/checked-function wiring. Parent removes only imports7–9/matrix117–267
and retains all source rows/private helpers/old assertions/resources;400lines by
exact subtraction,not post-movement formatting. New complete fit180–190/200 is an
estimate,not typed/measured. Production75/687stays byte-identical for the remedy.
Replace loops(input) ownership only with unique checked function whoseid!==main;
assert exactlyone and use its actual id/result. Keep reference/candidate separation,
actual maps/canonical callback,all18classes/threefamilies/two-layout checks and
deliberately matching wrapped-byte counterfactuals. Five existing imports,one
private literal table,no named helper/export/cross-test import/fixture API/harness.
If uniqueness or complete200/500fit fails,stop again. Sole viable alternative is
parent500→600,not recommended/approved. Test copies cost maintenance but avoid new
shared infrastructure; no readable within500 reduction preserving all checks is
demonstrated. Confidencehighownership/mediumfit;exact packet is in AR66. This is
advice only; new test absent,unqualifiedfbc971f6preserved,all further compiler/test
qualification awaits direct ruling. No checks deleted,cap raised or code moved.

Final stop validation confirms unchanged fbc971f6/75-687-554,all448excluded entry
hashes/eleven oracles,and exact388old composition bytes. Both production files
stay frozen; proposed return test remains absent. Targeted three-source/six-doc
formatting,whitespace and185local links pass under repository ignore policy.
66ARs/65resolved/only66open;40tasks/26verified with15/17/1.3.3visibly blocked. No
strict typing,matrix/full/native execution or current-unit quality qualification
follows the554/500overrun. Prior61admission/resource passes are partial evidence
only. Expert/spec/policy/non-integrationportfolio,index,branchfeature/v4-rebuild
andHEAD1022fd52remain preserved. No staging,commit,push or phase/GREEN claim.

Execution Plan Updated:yes. Cleanup:done—only17owned temporary files under the
exact `shared-return-2dlu9_cn` directory are removed after durable approval/RED/
admission/draft/preservation/next-scope records. No symlink,user file,worktree or
another session's content is removed. No temporary artifact needs to survive.
Await the sole AR66exact two-test-path matrix movement/checked-function selector/
200-line ceiling ruling. All accumulated uncommitted work stays intact.

### Approved adjacent return fragments —2026-10-28

User **“approved”** directly answers the sole AR66two-test-path movement/selector/
200-line packet; approval clock captured17:19CETbefore movement,new file or wiring.
Entryfbc971f6/75-687-554and451source/test/fixture/policy hashes/eleven oracles are
captured,newtestabsent,index/spec unchanged. Move only the new151-line matrix and
three imports; retain all parent source rows/private helpers/assertions/outcomes.
New owner copies the exact three labelled source literals and selects the unique
checked non-main function,not a name or exported loop helper. Preserve all18classes,
three families,both real layouts,nonvacuity/counterfactual checks and local maps/
canonical callback. Production75/687stays unchanged for relocation. Implemented
with complete normal-format capacity/preservation/strict/execution checks pending.
Counts26/40,parent38/48,v4four/ten and14remainingtasks stay; no GREEN commit/push.

Complete relocated fit is400/500parent and175/200newtest,with production75/687
byte-identical. Exact151-line/three-import parent removal,three literal strings
and all18classes/mutator/assertion text are verified after only approved selector
and whitespace changes. First strict typing finds one pre-existing draft issue:
the fresh alias mutation writes optional origin:number|undefined explicitly.
Correct only that fresh object's construction to conditionally override origin
for the alias-origin mutation,otherwise preserving the spread object's property.
No source/damage/assertion/outcome changes; first failure is not a matrix verdict.
Strict and execution rechecks remain pending after this local typing correction.

Strict recheck and all115cases pass at75/687/400/175. Frozenfour-path sorted-path/
SHAcompactJSONidentity3591beee96f926372f489f91930e0e5978b5ca617489be7ebcf5f6185d3d13d1.
Reversing only known AR65dispatch/oneimport and12new source-row lines reconstructs
the exact qualified149233d8baseline with the unchanged shifts pair. Code freezes
for full checkpoint and bounded independent/native/resource qualification.
Basecorrectness/standards/oracle,SFA/ABI and separate semantics/DXreviews report
no findings. Host reviewer requests the removed predicate verbatim; supply the
exact21lines,not historical raw access. The same first review completes with no
findings,explicitly noting early bounded encoder allocation and enum identity key
cost; no measured latency/RSS or invariance claim. None clears whole phase/output.

Fresh install/build/typecheck pass0.37/2.35/0.81s;1,526directed cases/87files pass
252.22s,45boundaries2.95s. Full yarn test remains RED:compiler3,198passes/13same
unfinished frontier failures/two existing skips,370.2s; root suite not reached.
Seven original none artifact lengths/hashes and empty diagnostics remain exact.
The RED composite permits no commit/push or task15promotion.

First native attempt stops before any completed case because the monitor driver
resumes to a second checkpoint at the already stopped caller-entry JSR PC2136.
Actual caller entry begins with JSR in both constructions. Do not change the source
answer or stack/flag expectation: reuse that current stop for atCall when both PCs
match,otherwise retain the explicit call checkpoint. The exact 6-cycle JSR and
callee/caller stack assertions remain. No compiler/test code or oracle changes.
Rerun sequentially from fresh owned staging; failed attempt is not native evidence.

Actual24construction discovery retains exactpriorartifact identities and outcome
JSONab6589d0362476275537bc3d509e1dfb6c317b31aac4396f4c0f1e67dd5605e5. This does not
mean the new predicate failed: direct inspection proves all18actualcheckedInputState
shared-return fragments on both savedOriginal constructions. Remaining failure
is sourceb34column>=5's real conditional-fallthrough bridge. Original sourcegroup
has onlyb34; actualbranchat3496/3309falls through to3-byteJMPat3503/3316whose
destinationb42is the checkedfalsecontinuation. The emitted bridge is absent from
the lowering-era observerBlocks group. It cannot be treated as an instruction-free
same-PC alias merely because its instruction list is empty. Existing layout248–267
creates it without source ownership; source metadata beforelayoutfixed-loop489–529
is unchanged. No layout/producer/observer repair is made. AR67records that exact
next boundary; one blind minimum-sufficient assessment pending. Already approved
current-unit qualification continues separately,notnewbridgeimplementation.

Corrected observation-only native rerun completes120actualACME0.97images/240
sequential pinnedVICE3.10PAL/6581cases,zero skipped/failed completed cases and no
changed source/behavior expectation. Three exact new byte/sbyte/enum sources vary
onlyseed0/1/2/3/4/5/6/7/8/255,with bothbounds/reference-selected/incomingP20-ED.
Independent mathematical answer follows the actual branch order:seed<8selects
oneofthreevaluesbyseed%3,elsethird;byte/enum0/127/255,signed−128/−1/127with two's-
complement byte encoding. Tests observe all three shared return sites in every
source family and all repeated branch paths,not merely one successful default.

Before startup,debugpatternsseedBSS/answer/arrayandSYScallerstate only; actual
sourceinitializersoverwrite them. At main verify sourcezeros/seedexact/answer0,
CPUports00/01mapping,CIA2DDRA,SPandbinaryD/I. AtactualJSR/calleeentry verify
SP−2; each ofeight actualtypedSTAIPschecksA=i,wordcounter=i,arrayprefix,SP/D/I.
Arm allthree actual return-load checkpoints simultaneously to avoid selecting
the desired answer's PC in advance. At actual selectedload,wordhome8/array0..7;
afterLDAassertAexpected/NZcorrect/CV-DI-X-Y-SPunchanged. ActualRTSreturns toJSR+3
withsameA/P/X/YandSP+2. Afterone sourceanswerstore,checkfinalanswer/array/exact
ordered0..7datawrites and answerwritecount1. TrueE147returnandE155SYSpublication
proveincomingPmaskCF/SP+2/ports/BASIC03–06/CIA2DDRA/allactualborrowedBASICrestoration.
No sourceinitializedinput is injected after startup. No actualinterruptinjection,
fullbus/deadline/otherprofile/hardware claim follows.

| Actual seed1 costs, byte/sbyte/enum and reference/selected | Bounds OFF | Bounds ON |
| --- | ---: | ---: |
| Complete PRG |265|281|
| Startup / main / work code |104/9/138|104/9/154|
| SFA RAM / ZP |4/2|4/2|
| Globals / platform save state |10/5|10/5|
| Unique general occupied / ZP |282/2|298/2|
| Declared generated stack component |2|2|

PRG=2containerheader+12BASICstub+startup+allmain/workcode,zero padding,no hidden
helper or table. The2-byte stack component matches one actualJSR's SP246→244→246;
startup0held/1transient stays separate from externalSYS/ROM/interruptaggregate.
Leafadds no targetinstruction/home/stackdemand; accepted artifacts still pay all
the costs above. Physicalframe/home releases or whole-program wins are not claimed.

Native scriptSHA267828418bc32ff27bb56f499d32acd88d1257fa29662eb45f0c42ab8846f24f;
120imageJSONffbd90f15e53c5e64870e8b0bb120fe82c8eb29febd7faf1b5cf98cc70d5a51d;
240traceJSON4122524893c14df0773d34206d1fc39e1febfb44a3d2c70cc5161b5df0eabb82.
EveryactualASM/PRGhashisreconciled. Pinnedexecutable/ROMs match precedingVICE3.10/
KERNAL03/BASIC01/chargen01identities;selectedPAL6569/SID6581/CIAmodel0isattested.
Status **Verified partial**,claim **Fact**,**VICE-verified / hardware-unverified**.
Expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15 remains active/frozen;
spec4identity unchanged. Governing router selects SFAABI/MOS/casebook/semantics/
ILTwoOracle/C64Startup/ACME-VICE/evidenceEquivalentWork/sourcekeysMOS-PGM-1976,
MOS-HW-1976,MOS-6510-1982,CBM-C64-KERNAL-03,VICE-310-MANUAL,P3/spec4.

Initial output/platform reviews request the applicable active router instructions;
platform additionally requests current startup/trace/checkpoint code. Supply only
fresh authorized inline router/normative/probe/byte/native-record excerpts. No
denied raw paths,hidden authority,evaluator/audit maps or otherreviewverdicts are
opened or relocated. These are samefirstreviews completing missing evidence,not
extra fix rounds. Their completed dispositions remain pending at this record.

Both samefirstqualification reviews complete after requested inline evidence.
Platform reports no findings: actual byte/offset decoding and current probe's
initialization,storewindow,all-three-return selection,LDA/RTS/JSRstate and genuine
SYS boundary agree. It independently checks supplied primary-extracted excerpts,
not execution/hashing; the120/240corpus remains primary-executed. E155publishes
returnedA/X/Y/P,not preservation of incomingA/X/Y. Allhardware/otherprofile/fullbus/
interrupt/deadline/externalstacklimits remain. No forbidden raw path is accessed.

Output reports no introduced emission/storage defect and one inherited MAJOR
RT-MC-001. Actual stable ordinary-RAM classifier LDA/BEQthen sevenLDA/EOR/BEQarms
plus sharedreturns costs63B; retain seed inAwithCMP#1..7 costs42B. Save21codebytes,
4cyseed1/up to28cy. Independentrefutation proves carrypreservation: finalwordloop
untakenBCCestablishesC1; reachingcomparisonkexcludesallunsignedvalues<k,soeachCMP
alsoleavesC1includingdefault≥8. SameconstantLDArestoresA/NZ,V/X/Y/SPunchanged.
StableRAM/nointerveningwriter is essential; never merge volatile/asynchronous reads.
CurrentmainJSR/STA/JMPis already direct,notresultstaging. SharedA9xx60returnlocally
meets3B/8cy;#109ownsitsseparateeligiblewhole-callwin,notsilentlythisreloadscope.

| Seed | Actual classifier cycles incl selected LDA/RTS | Expert analytical idiom |
| --- | ---: | ---: |
|0|15|15|
|k1…7|15+8k|15+4k|
|8…255|70|42|

ActualOFFwordloopprefix714cyremainscharged;seed1work737→733analytical. Complete
isolated projectionwork138/154→117/133,PRG265/281→244/260,general282/298→261/277
plusZP2;allSFA/global/state/startup/stackreservationsretained. Replacement is
unassembled/unexecuted/notreclosed. No physicalhomefree,combinedissuewin,total
firmware/startupdeadline or fullprogrambeat is claimed. Actual classifier branches
andsharedtails remainpage08; futurefinalwidth/page/layoutmustberechecked.

File [#132](https://github.com/blendsdk/blend65/issues/132) under standing parity-
debt authority with exact source/ASM/cycle/resource/carryproof and existing
comparison/byte-window correction seam. Exact#109body is read beforededuplication;
itsordered-read/shared-return/call-continuation scope does not ownthisstablebyte
reloadchain. No old issue edited/closed. Ledger **accepted** means owned correction,
notwaiver,dismissal,implementation/API/helper/old-oracleauthority or original-limit
deferral. Existing#120/#121/#122/#127andallotherdebtsstaycharged. Sixboundedreviews
complete;five nofindings/one inheritedMAJORowned,notfullphaseclearance.

AR67soleblindassessmentreturns **Simplify**: metadata-only maintenance in existing
block-layout≤480,additiveexistingalias-layouttest≤300,additivecompositiontest≤500.
OnlyobserverBlocks changes,no signature/helper/export/schema/emission/consumer
exception. Preserve uniqueexactsourceowner/tupleentry,insertfreshbridgeafterparent,
and onrepeatedrepairretire onlynonentryinstruction-emptycontrol labels which the
existingresolutionactuallyturnsintofreealiases;preserveactual labels/executingJMPs.
Prove direction/PC/end/3Bcosts and produceron-offnonmutation independently; don't
claimresidual-onlydirection/costauthenticationwhereatomicproducerchecksownit.
Wholebody/FlatEightoccurrence/shared-body/asyncproofs stay outside. Estimatedfit/
repeatqualification remainsunknown. No draft of that repair is made before ruling.

Eight read-only ordinarysourceprobes isolate one structurallyrealbridge without
borrowed input or unrelatedproof failure. Source89147a8388297fa4b5cf146d193d5c48bd75ce2f11e04591bb40e85647bde84a
and exactliteral are in AR67; seven smaller shapes contain no bridge and pass,
notbridgeevidence. ThisisnotanewformaltestorVICEcase. Freshreturn-fragmentmap
JSON4abbf386536d8aa27ebc859152f2ec12e0eed714a519dad7374daefe37e45a48;
remainingedgemap69f23853524952fd37572234459ae75594f6d9d699eaeab438033e169414c4e3;
else-sourceprobeJSON2a4c6896b8cdcbcf3b081ef7d9544ef6fbfde6c372786df2e686b3cdbc9698f7.
No bridgeowner/helper/metadata/cap/oldexpectationedit is made. AR67exactthree-path
packetawaitsdirectruling;current3591beeeprotected. Task15partial and15/17/1.3.3blocked,
26/40,parent38/48,v4four/ten,14remainingtasks. Full13failuresremain;no staging,
commit,push,whole-input,size,paritywaiver or phasepromotion.

Final movement integrity preserves exact parent removal,all three source literal
bytes and all18classes/threefamilies/twoactual-layout checks after only approved
selector/whitespace and the fresh optional-origin construction typing correction.
NormalizedmutatorSHA15c891329f7a67c85772940e9d56589b971daaabc67f51d65d7464d4653b8210.
All388qualified old test bytes reconstruct exactly. Production75/687isbyteidentical
forrelocation;currentfourpath3591beeeand400/175tests stay. All451entrypaths are
accounted for,448excludedhashes/elevenoracles unchanged; nextlayout/alias-test owners
also untouched. Freshfull verification remains3,198passes/13knownfailures/two skips,
notGREEN. No compiler or test code changes after the frozen qualified bounded unit.

Targeted four-source/seven-Markdown formatting under repository ignore policy,
whitespace,documentation/reference checks and185local links pass.67ARs/66resolved/
only67open;40tasks/26verified and15/17/1.3.3visiblyblocked. All120actualASM/PRGhashes
and240native/image cardinalities reconcile. GitHubconfirms#132OPENwith exacttitle.
Frozenexpert/spec/policy/non-integrationportfolio and emptyindex stay. All processes,
sixreviewers,oneAR67assessor and externalissueoperations are finished. Execution
Plan Updated:yes; no staging,commit,push,whole-input/phase/GREENpromotion.

Cleanup:done—only413owned temporary files in exact `return-qualification-5nj8thad`
are removed after durable approval/RED/strict/movement/native/ASM/resource/review/
debt/failure/next-scope records. No symlink,userfile,worktree,versionedartifact or
another session's content is removed;no raw artifact needs to survive. Preserve
all accumulated uncommitted work and await the sole AR67exactthree-existing-path
data-onlyobserverBlocks/480-300-500packet. No bridge implementation by silence.

### Approved layout bridge association —2026-10-28

User **“proceed”** directly answers the sole AR67exactthree-file data-only packet;
approval clock captured21:38CETbefore tests/producer/association changes. Only
existinglayout≤480observerBlocks maintenance,existingalias-layouttest≤300and
compositiontest≤500additivecases are executable. No emission,helper,export,schema,
consumer,fixture or old-source/outcome changes. Counts26/40,parent38/48and14remaining
tasks stay. Entry3591beeeand452source/test/fixture/policy hashes/eleven oracles are
captured. Freshbuild and66oldowned cases pass; currentlayout391/alias130/parent400.

Add structural short/long bridge owner/PC/bytes/direction/nonmutation and repeated
short-layout checks,malformedmissing/duplicate/competing/repeated-source/foreign
entry ownership cases,and an evidence-preserving branch inversion case. Add only
the exact isolated bridge source row to parent. All old source/helper/assertion/
outcome bytes remain unchanged. Complete formatting/cap/RED verification pending
before production; no bridge association code changed yet.

All10new required producer/admission/resource checks reach meaningful RED while
66old cases and the new inversion preservation case pass (67passes). Alias-test
269/300 and parent404/500fit. Capture88actual pre-change construction identities:
40smallbridgevariants plus48saved/acquisitionreference/candidate artifacts,including
source/ASM/machine excluding onlyobserverBlocks/layout/resource hashes. Baseline
JSONeaa88a1eb9341ec3318b1eaa2795ed689f61cf2c10ca47a2a6bdca25def6576d.

Only then implement existing orderBlocks data handoff. Validate unique source/
label ownership before filtering; use existing resolution to retire only originally
instruction-empty control aliases from interior ranks,never tupleentries or code-
bearing blocks. Keep actuallabels/emission. Associate a fresh executing bridge
immediately after its unique parent,checking no old transfer/address reference
enters that label. Preserve absent evidence and freeze final copied tuples/labels.
No helper/signature/schema/export/consumer/fixture/emission change. Implemented
with complete readable480cap/build/strict/old-new verification pending.

First fit454/480producer,269/300alias-test,404/500parent builds. New producer/bridge
cases pass but12oldshift cases reject: the first retirement filter also removed
already-free interior fallthrough aliases. Those were not executing control
labels converted by this repair,so their source association must remain. Narrow
retirement to originally instruction-empty JMP labels resolved elsewhere; keep
existing fallthrough aliases. No old expectation or consumer/predicate changes.
This corrects the fresh data-handoff implementation within the exact approved
retirement rule; recheck every old/new case and strict typing before proceeding.

Narrowed producer builds and all165owned cases/4files plus full strict NodeNext
typing pass at454/269/404. Add an explicit producer regression preserving already-
free interior fallthrough association. Add only fresh composition mutations across
reference/candidate:missing/wrong/duplicate owner,source identity,foreign entry,
bridge instruction/target/cycle/origin/branch direction/cost. Baseline residual and
atomic success precede each mutation. Direct residual rejection is required only
for graph/source-owner defects; physical direction/cost/origin and extra instruction
may reject at atomic authenticated closure,not a falsely claimed source-condition
proof. No old row/helper/assertion/outcome changes. Complete normal-format caps,
strict and matrix verification pending after these new implementation tests.

Complete normal formatting gives454/480layout,295/300alias-test and517/500parent.
The new113-line bridge matrix exceeds96available lines by17. Honor the hard stop
before strict typing,newmatrix/producer-preservation execution,full/native/quality
qualification. Preserveunqualifiedthreepathidentity
`5147eed4ab6199cd4cf4d4308aae3aef43143a63ffff8fc3c4f3329f497affea`.
No checks removed,compression,oldbytes amended,extraction/new file/helper/export/
cap change. A malformed host wrapper command exits at Python parse time before
formatting or file access; corrected wrapper performs formatting/measurement only.
AR68records measured capacity and sole independent assessment pending. Task15
partial and15/17/1.3.3blocked;26/40,parent38/48,v4four/ten,14remaining tasks. No
staging,RED commit,push,whole-input acceptance or phase promotion.

Read-only stop preservation confirms5147eed4,all452entrypaths accounted for,
449excluded hashes/eleven oracles unchanged. All130old producer-test bytes and
400old composition bytes reconstruct exactly after removing only new additions.
Reversing only the63data-handoff lines reconstructs the exact391-line prior
layout owner; no unrelated emission/selection code changed. The new matrix is
113formatted lines; deleting it in memory yields404parent lines,not permission
to remove it. Proposed adjacent bridge test is absent. Frozenexpert/spec/policy/
non-integrationportfolio and empty index stay. Captured RED14.19sreports10failed/
67passed; last owned30.75sreports165passed/4files and strict pass. Those precede
the later producer-preservation/mutation draft and do not qualify it. No further
compiler/test/artifact execution is performed while AR68is open.

The sole blind AR68capacity assessment returns **Justified**: raise only existing
compositiontest500→550for the current113-line matrix. Current517fits readably with
33reserve; no code movement,import,helper,export,new file,fixture/runtime or optional
tests. Production454/480andalias-test295/300remain unchanged for capacity. One17-line
within500saving is not demonstrated without unverified restructuring; focused
newbridge-test≤200is viable but needs duplicatedsource/private-helperreplacement/
side-local cloning and broader ownership. Its140–165fit is only an estimate. The
measured ceiling-only remedy is simpler for this3.4%overrun. Principal risk is
incremental ceiling growth; restrict any ruling to exact file/matrix,notgeneral
policy. Confidencehighcapacity,nottyping/behavior. ExactpendingpacketinAR68; no
code or ceiling changes follow advice. Current5147eed4,alloldbytes and unqualified
status remain. Task15partial/15-17-1.3.3blocked,26/40,parent38/48,14remaining tasks.

Durable pre-change reconstruction anchors (captured before AR67source/test edits):

| Path | Before SHA-256 |
| --- | --- |
| packages/compiler/src/machine/block-layout.ts |76badc8bf7f57dce215d20e854f7854c8b101ab0baa9d76d9c0f017e8654618a|
| packages/compiler/src/machine/block-alias-layout.impl.test.ts |fb2b5d2afbff8e828fdf56cec1119d1d15e1a342b2017010eb6ac9b14f98346a|
| packages/compiler/src/services/size-observer-original-composition.impl.test.ts |25a1ea2049f554e4c73e5c7c075e64edc9512ebf94298de938df37d2bf16b4cb|

Sorted-path/SHAcompactJSONthree-pathbeforeidentity:
`e7a2b915d4e1d9cb3aa4b9edafcbb00cb34349bcd1989d14004d4ea70ebe4f84`.
Known-hunk reversal must match these before using reconstructed before-source;
never overwrite or temporarily revert the preserved current worktree.

The88construction immutable projection SHA is
`238b979b85fe255b9979f74cb8d9a619bea6d73f088e1039b04289a058fd25f7`.
This permits the pending nonmutation comparison after raw temporary cleanup,
without reconstructing a guessed old cost vector or requiring old rejection
outcomes to stay. Exact ordered regeneration recipe:

1. Take the exact new `layout bridge` source89147a83from the parent table. Vary
   only declared seed/other literals in this pair order:
   (0,0),(0,4),(0,5),(0,255),(1,0),(1,3),(5,0),(5,1),(7,0),(255,255).
   For each pair,boundsfalse then true,loopPolicyoriginal,name`bridge-SEED-OTHER`.
2. Then source fixturesinput-saved-caller,input-callerin that order; each bounds
   false,true; each policyoriginal,low-byte,x-first,y-first,flat-eight-x-first,
   flat-eight-y-first in that order. Keep ordinary source files unchanged.
3. For each of44real effectFixtureinputs,recordreference then candidate. Rowkeys
   in exact insertion order:id,sourceSha,assemblySha,machineSha,layoutSha,resourceSha.
   id=`NAME-BOUNDS-POLICY-SIDE`. Hash source UTF8and complete serializeAcme.source.
4. machineSha hashes compactJSONof`{...program,functions:program.functions.map(
   ({observerBlocks,...fn})=>fn)}`. Exclude only that association; do not remove
   code,other metadata,domains or resource fields. layoutSha hashes compactJSONof
   shared.layout.intervals;resourceSha hashes compactJSONof the ordered pair
   [shared.certificate.inventory.requests,shared.certificate.certificate]. Convert
   every BigInt to decimal string using the same JSONreplacer; preserve all other
   keys/order/values. Eachdigest is lowercase SHA256of exact UTF8JSONbytes.
5. Hash compactJSONof all88rows,with no result/outcome key. Compare to238b979babove.
   Do not compare changed observer outcomes to the old intentional failures. Raw
   before JSONwith outcomes remains historically eaa88a1e,but is not the immutable
   after-comparison oracle. Current hard stop still forbids executing step1–5now;
   this is durable baseline evidence/recipe,not a new harness or test framework.

Final stop validation confirms unchanged5147eed4/454-295-517,all452entrypaths
accounted for,449excluded hashes/eleven oracles and all130/400oldtestbytes intact.
Proposed adjacent bridge file stays absent. Targeted three-source/six-Markdown
formatting under repository ignore policy,whitespace and185local links pass;
68ARs/67resolved/only68open,40tasks/26verified,three visibleAR68blocks. No strict,
matrix,producer-preservation,after-artifact,full/native/quality execution follows
the500cap overrun. Last165owned/strict passes remain partial earlier evidence.
Producer/consumer caps and all safety/oracle/emission boundaries remain unchanged
until exact ruling. All processes and the one capacity assessor are finished.
Execution Plan Updated:yes; no staging,commit,push or task/phase/GREENpromotion.

Cleanup:done—only23owned temporary files under exact `bridge-association-twy8fo11`
are removed after durable approval/RED/subset/strict/draft/preservation/baseline-
hash/88construction regeneration/next-scope records. No symlink,userfile,worktree,
versionedartifact or another session's content is removed. No raw artifact needs
to survive: the immutable before-projection digest and exact ordered recipe above
preserve the pending comparison. Keep every accumulated uncommitted change and
await the sole AR68single-file500→550ceiling ruling; no approval by silence.

### AR-P68 approved continuation

User approval recorded22:17CET on2026-10-28authorizes only the composition test's
500→550ceiling exception. Subsequent **“proceed with the remaining tasks and do
not stop for trivial questions”** continues the approved plan,not new material
scope or oracle authority. Resume confirms exact5147eed4and454/295/517lines before
any verification; all68material ARs resolved,preflight passed,phase baseline and
specification-first381-case gate retained. No code change is needed for capacity.

Fresh strict NodeNext typing passes for all three paths. Complete bridge matrix,
producer-preservation regression and unchanged shift/return/composition suites
pass177cases/4files. This is bounded task15evidence only,not complete observers,
GREEN/publicsize/task promotion. Next perform the recorded88construction immutable
projection comparison,then broad/native/resource qualification and bounded reviews.
No old expectation,emission,fixture,export or helper changes made on resumption.

The88construction immutable projection now exactly reproduces238b979b,including
40ordinarybridgevariants and48saved/acquisition actual reference/candidate artifacts.
OnlyobserverBlocks is excluded from the machine projection; every other machine,
ASM,layout interval and resource/certificate byte remains unchanged. All20small
source inputs pass residual/atomic admission. SavedOriginal no longer errors at
its conditional bridge; its next synchronous raw gate rejects because two reachable
typed-only callees have multiple source blocks and no induction bounds. All24full
saved/acquisition recipes still reject; selected-loop and asynchronous duties stay.

Fresh bounded native qualification passes40ACMEimages/80sequential pinnedVICE3.10
PAL/6581cases for ten recordedseed/otherpairs,bothbounds,bothconstructions andP20/ED.
Independent ordinary-source branch-order answers,data0..7writes/counter0..8,oneanswer
store,JSR/RTSstack andreturnA/NZ/preservedCV-DI-XY-SP pass. Both branch directions
are observed32times,total16executingbridges;actual3-byteJMP bytes/PC/target/cost and
its unchanged registers/flags are checked. GenuineE147return/E155SYSPpublication,
allactualborrowedBASICbytes,CPUportmapping/CIA2DDRArestoration pass. NoIRQs/NMIs,
fullbus/deadlines/otherprofiles/physicalhardware qualification follows.
Native scriptSHA`bc41564b913796fc16368e70a7e40bfd81c59b807cadee9346572d0092003faa`;
40imageledgerSHA`55a01db0abb88ec5f7521bf76305094578c02f0447c25efd5a8b3dcfa7ed3c16`;
80traceledgerSHA`04d1f9b329aed1b09ca725d1268ee740c33a0924ed918b97241e31e3461096b9`.
VICE-verified/hardware-unverified. Currentboundedcorrectness,SFA/ABI,semantics/DX
andhost-performance reviews report no findings. Hostcosts analytical; no newlatency/
RSSclaim. Platform/outputreviews and fullcheckpoint remain pending.

Fullcheckpoint completes: install0.50s,build/typecheckpass; yarn test392.11sreports
compiler3221passes/13sameunfinishedfrontierfailures/twoexistingskips,183passingfiles/
184total. CLI62,language-server21andVSCode6pass;rootnotreached. The unchanged13failures
remain12pendingpublicconstructors andonerejected-baselinecostvalidator. This isRED,
so no commit/push/task15promotion. Native/resourceevidence isnotfullsuiteGREEN.

Representativebridgecase(seed1,other3)costs:PRG252/268off/on=2loadheader+12stub+
82startup+9main+120/136work+27restore. Globals11,state5,frame4generalRAM+ZP2,
uniqueoccupiedgeneral270/286plusZP2,zero padding,generatedcallstack2/startupheld0/
transient1. Seed0/other0startup78makesPRG248/264andgeneral266/282plusZP2. Earlier
inline reviewerpacketinitiallyunder-addedseed1generalby4; correctedwithactual
intervalsum270/286beforeoutputdisposition. No certificate,artifact or expected
resource changed. Existingoutputdebtsremainowned/unwaived;notwhole-routineparity.

Platformreview initiallycannotreadexternalrawscript(nativeexternal_directorydeny).
Parentprovidestheexactauthorizedsetup/branch/JMP/return/restorationassertionsand
actualbyte/aggregateexcerptsinlinetosamefirstreview;noexternalretryorrelocation.
It completeswithnofindingsatstaticmeasurement-auditendpointonly. Outputreview
hasthesameexternalboundaryandreceivesrequestedinlineassembly/resource/native/
releasefields;firstreviewcontinuationpending. No independent reviewer execution
or directdenied-fileinspectionclaim. Routinghistoricalexposuresareexcluded.

Aftercompletednative/fullresultsanddurablehashrecording,theexactownedtemporary
directoryisobservedabsentbeforeboundaryverificationcouldopenitslog. Causeisnot
established;donotattributeit toanagentorclaimparentperformedcleanup. No compiler/
source/oraclefileisaffected. The attemptedboundarywrapperexitsbeforetestsorfixture
creation. Recreateonlyafreshownedtemporarydirectory,retainrecordedevidenceand
reverifyneededportableidentities;neverrecreateadeniedpathforrevieweraccess.

Freshboundaryrunpasses45cases/3files;sevenoriginalcanonicalnoneartifactlengths/
SHA256andemptydiagnosticsreproduceexactly. New452entry-pathsortedpath/SHAcompact
JSONbaselineidentity`4e47c21f310cceb479c72bd4affb62e68b70e91b6ee67a1f93b07e67eaa78eb1`
capturedbeforeanynextconsumer/testedit. CurrentAR67threepath5147eed4remains unchanged.

Theonenext-synchronous-raw-gateindependentassessmentconcludes**Simplify**,ordinary
implementationdetailwithinexistingtask15authorization: localizeonlytheexisting
rawbodyshapeprerequisitetobodiesthatactuallyownrawoperations. No newAR/helper/file/
API/type/export/producer/caprequired. Preserveglobalroute/callable/indirectcall/
platform/cpucontrolbarriers,whole-programno-recursion,borrow/typedcontainment,
changed-state/authenticationandcompletebefore/afterrawfootprints. Araw-freecallee
hasnorawaddress/byteorderingpremise;existingtypedborrow/effectchecksretaintheir
responsibility. Do notassumetransitiveeffectfreedom: theglobalreachableinventory
muststillfindraw-owningdescendants. Strongestcounterexampleisaconditionalborrowed
helperwithunprovedindex;additsretainedcontainmentrejectionbesidemeaningfulnew
ordinarytypedconditional-calleeREDs. Existingeffects687/700andcomposition517/550
caps/oldoutcomesstay. SeparateAR67finaloutputdispositionisnotyetcomplete;no next
consumer/codeeditbeforethatboundedunitisrecordedandallpreservationguardschecked.

Outputreviewproposesanadditionalinheritedbranchfactcostcandidate,notyetafinding:
actualbridgeJMPthenretestedknownseedversusLDA#2/RTS,same3B/−11nominalcycles.
Requestedfreshseed0/other4offsourceisactuallyassembledandVICE-executedonce;
sourceSHA`0b8fb72a1992ce9103711521be3bdafb77260ff6ab10e736bd15bf034e4d35b4`,
PRG252SHA`997fcdf5d5c82f179523db795ddf14529b6040582ce72ecc117a67975ea0dce7`.
Actualparent2262AD0409C905B0F6,branch2267;bridge2269bytes4C9408→2196,
target2196AD0309C905B038→2203A90260. Beforebranch/bridge/targetAXYSPP=
4/47/0/244/A0,actualreturnloadA0,P A0;afterLDA2A2,P20,andcaller2146SP246.
Globalactualinitializersprovide0/4,no post-startupinputinjection. Proposedreplacement
isanalytical,unassembled/unexecuted;nominal19→8cyclesonlythispath,allotherresources
retained. No production/oraclechange;outputreviewrefutation/dispositionpending.

Theoutputreviewcompletesandretains**BR-MC-001MAJOR**,inheritedpredicate-proved
terminal-pathretest,nometadataregression. Existing#51isread:notthispredicate-fact
specialization;open-issuecheckfindsnopreciseexistingowner. File[#133](https://github.com/blendsdk/blend65/issues/133)
understandingprimeoutput-debtissueauthority,withactualgeneratedsource/bytes/native
trace,analyticalequivalent3B/19→8nominalcyandallcompletecosts/reservations. No
producerfix/waiver/issueclosure/otheroutwardmutation. #132andallolddebtsremain.

AR69recordsreviewrulingpendingandmarks15/17/1.3.3blockedbeforeanynextconsumer,
testorproduceredit. Thesoleindependentorderingchallengerecommendscontinuingonly
already-approvedtask15observerworkwith#133explicitlyunresolvedandhardexpiry:
obtaintheexactremedy-scopeuserdecisionbeforetask15closeoutor17/1.3.3advancement.
Thisisnotariskwaiver,open-endeddeferralorpermissiontoexpandemission/helper/API/
cap/oracle scope. Alternativeread-onlyexactremedyinvestigationfirstisviablebut
blocksindependentprogressforaseamnotyetestablished. Confidence moderate-highon
ordering,notremedyfeasibility. Directrulingpending;no finding-ledgerrulingassigned.

AllsixboundedAR67reviewlenseshavecompleted:metadatachangehasnofindings;output
hasthenewinheritedMAJORabove. Platform/outputexternaldenialsarebinding;authorized
inlineexcerptsfinishstaticmeasurementaudits,notindependentreruns/deniedrawreads.
Currentstrict/build/typecheck177cases,45boundaries,seveneXACTnoneidentities,
88nonmutationidentitiesand40ACME/80VICEsmallwitnessesremainboundedqualifiedevidence.
OneadditionalfreshACME/VICE0/4caseconfirmscostwitnessonly;replacementnotexecuted.
Full3221pass13knownfail2oldskipremainsRED;rootnotreached,task15partial26/40.
No source/test/producercodeeditafterresumption,current5147eed4staysbyte-identical.

Finalstopguardsconfirmall452entrypathidentitiesincluding449excludedpaths/eleven
oraclesunchanged;known-hunkreversalreconstructsexact391oldproduction,130oldproducer-
testand400oldcompositionbytes. Current454/295/517limits480/300/550fit;sourceformat,
whitespace,comment-referencecheck,185locallinksandMarkdownstructurepass. Register
has69ARs/68resolved/only69open;40tasks/26verifiedandthreevisibleAR69blocks.
Frozenexpert/specification/portfolioandemptyindexremainunchanged. Allprocesses,
emulatorsandreviewersfinished. No furtherimplementationorverificationclaimafter
thematerialrulingstop. ExecutionPlanUpdated:yes;no staging,commit,pushorGREENclaim.

Cleanup:done—25ownedfilesinexactraw-control-fg6nzooyandtwoinreview-ruling-2_trfwox
removedafterdurablerecording. Priorbridge-qualified-atjiwr06wasalreadyabsentand
isnotrecreated;causeunestablished. No symlink,userfile,versionedartifact,worktree,
another session's contentorunrelatedtemporarypathisremoved. Durable88projection
baseline/recipe,native/source/PRGhashes,costwitnessand#133retainnecessaryevidence.
AwaitonlytheexactAR69boundedTask15orderingruling;task15closeout/17/1.3.3expiry,
allmaterialscope/oracle/reviewgatesandoriginal963/725limitsstaybinding.

### AR-P69 continuation: raw owning-body prerequisite

User **“proceed with the remaining tasks and do not stop for trivial questions”**
directly approves the sole bounded-ordering recommendation; clock22:49CET2026-10-28
beforetests/code. #133staysMAJOR/open; exactremedy-scoperulingduebeforetask15closes
or17/1.3.3advance. Existingraw-ownerpredicatecorrectioniswithinapprovedtask15,
notnewhelper/module/producer/API/oracle/cap authority. Recordacceptedorderingin
findingledger,notfixeddefect. Entry5147eed4/454-295-517andemptyindex/frozenspecpass.

Addonlytwoordinaryraw-loopcaller/typedconditionalcallee positiveSOURCESrowsbefore
thebridge,soexistinglast-rowmutationselectorstaysunchanged. Existingadmissionand
resourceassertionsapplytoboth. Addboundsfalse/truenegativeforaconditionalborrowed
arrayreaderwithunprovedwordindex,requiringretainedtypedcontainmentrejection.
Addconditionalrawcalleeandconditionalstatuscalleetotheexistingrejectionmatrix.
Alloldsource/helper/assertion/outcomeandAR67matrixbytesremainunchanged. Formatting/
≤550fitandmeaningfulREDsduenext;productioneffectsremains687andunchanged.

Ordinaryformatfitscomposition546/550. NewtestsproduceeightmeaningfulREDs:
sixadmission/resourcechecksforthetwotypedcalleesandtwoborrowed-indexreason
checkswhichcurrentlyhitthesameglobalrawbarrier. All75oldtestsandtwonewraw/status
calleeconservativecontrols pass(77passes). No source/type/setup failure. Only
thenlocalizethecontrol-shapepremisetoanactualraw-owningbodyusingitsoperation
inventory;globalindirect/platform/CPU/route/callableguardsareunchanged. Addtwo
plain-languagecommentlinesexplainingtypedcalleecontainment/borrowresponsibility.
No newhelper/type/export/API/producer/fixtureoroldexpectationedit. Production
implementedwithfit/strict/build/new-oldverificationpending;task15remainspartial.

Freshnormalformatfits694/700effectsand546/550composition. StrictNodeNextandbuild
pass;135cases/3ownedfilespass,includingalleightnewREDsnowGREENandalloldchecks.
Theborrowed-indexcaseisrejectedbyexacttypedcontainmentwithbothboundssettings,
notbytheremovedraw-freebodyshapeprerequisite. Conditionalraw/statuscalleesstill
reject. FreshactualsavedOriginal/bothboundsnowcompleteresidualclosureandadvance
toaseparateBoolean-windowobserverrejection. AcquisitionOriginalstillrejectsits
unchangedasynchronousborrowgate. No whole-inputtupleaccepted/task15completion.
Noemission,sourceworkaround,oldexpectation,helper/module/API/producerchange.

The88actualimmutableprojectionagainmatches238b979bexactly,includingallordinary
bridgevariantsandactualsaved/acquisitionrecipeartifacts. Currenttwo-pathsorted
path/SHAcompactJSONidentity:
`1a00d16c51d7634e9fbcfc0fb0e16dff87e1620dde4eb0812b7149e8986c1489`.
All452entrypathsaccountedfor,450excludedunchanged;currententrymapidentity
`378715c634157019d628009dc6e980a4995c606fc635cdf08d59ddd357c16dcd`.
Reversingonlynewtwo-pathhashesreconstructsprevious4e47c21fentrymanifest;onlyseven
additivelineschangetheproductionowner. No other consumer/producer/oracle modified.

Nativequalificationcompletes16actualACME0.97images/32sequentialpinnedVICE3.10cases:
twonewtypedcallee families×seed0/1×boundsfalse/true×reference/candidate×P20/ED.
Independentanswersreturn(seed0?7:9),write(seed!=0?7:9);actualsourceinitializers
provideglobals,externalrawC110–117pattern19/39/65/127/128/193/254/255suppliedbefore
startup. Atmainallsourcezeros/seedliteralarechecked;no post-startupsourcevalue
injection. Exacteightorderedrawreads/eighttypedstores/oneanswerstore,calleeJSR/
RTSstackbalance/actualreturnAXYP,andgenuineE147/E155incomingP/SP/CPUports/DDRA/
allactuallyborrowedBASICrestorationpass. ALLactualreturnPCsarmedbeforeobserving
whichbranchreturns;no answer-selectedcheckpoint. NoIRQNMIinjection/fullbus/
elapsedtiming/deadline/otherprofile/siliconclaim. VICE-verified/hardware-unverified.
ScriptSHA`f704fbfb5d7dfb36cb9a2548e57ddd30486dbde8cb2cfb1b8531a4b1edb6cb9c`;
16imageledgerSHA`40f845eb13ad704a5672870f1bf2be2d0120b5b407ec0abf2d49c2db4230cb7d`;
32traceledgerSHA`4f708a4201bc0c512fad261229bea92df3bb9e8b36d7365dfe2fe1e430f6bba3`.

Seed1reference/candidatePRGpairsarebyte-identical:typedreturn820/836off/on,
typedwrite825/841. Uniquegeneraloccupancy888/904and893/909plusZP4;eachincludes
globals10,state52(full49+threeborrowedBASICbytes),functionRAM8. Generatedcallstack2,
startupheld0/transient1andexternalUnknownsseparate. Thisiscompleteaccountingof
unmodifiedconstructions,notwhole-routineparityornewcodegen;oldoutputdebtsand
task16startupworkremainowned. Newconsumerpredicateadds0targetbytes/cycles/homes.
Base,SFA,semantics/DXandplatformboundedreviewsreportnofindingswithstatic/primary-
measurementlimits. Outputinvariance reviewandfullcheckpointpending;no taskpromotion.

Raw-owning-bodyboundedqualificationnowcompletes:allsixreviewsreportnofindings,
hostaddedscanlinearO(B+N)withnoretainedcollections,latency/RSSunmeasured. Output
reviewconfirmsinvarianceonlyforidenticalalready-constructedpairs,notuniversal
byteinvarianceofnewlyeligibleselectionsorwhole-routineexpertparity. Freshinstall
0.33s/typecheck0.84sandfull365.05s:compiler3231passes/13sameunfinishedfrontier
failures/twoexistingskips,183passfiles/184total;CLI62/LS21/VSCode6pass,rootnot
reached. Sevenoriginalnoneidentities/emptydiagnosticsand45boundariespassagain.
All517oldcompositionbytesincludingAR67matrixreconstructexactly;452frozenentry
pathsand11uniqueoraclehashesunchanged. Acount-onlyoraclewrapperinitiallycounted
duplicatedhistoricaltablerows;distinct-pathhashcheckpassesalleleven,nooracleedit.
Rawunit694/546frozen1a00d16c;noGREENcommit/task15promotion,#133expirybinding.

NextBoolean-onlybarrierassessmentreturns**Simplify**withinexistingtask15authority:
removeonlyitsglobalnonempty-effectsbanandreuseactualJSR/calleeA-NZ/successor/
changedCcontinuationproofs. Mechanicallydropthenow-unusedprivateeffectsparameter
anditsprivatecallargument;exportedtwo-argumentvalidator/import/separatebyte-window
effectsgatestayunchanged. No newhelper/file/type/API/export/produceroroldoutcome.
Observedowners409/369fitAR47explicit500/500caps(notchallenger'sgeneric700default).
Existingcomposition546/550isnotthisnexttestowner. Alloldassertionsstayprotected.

Importantprooflimit: existingcontinuationquerychecksreadsbeforedefinitionsand
rejectsunresolvedcalls/transfers/cycles,butaC-differentordinaryreturnmayterminate
undertheexistingABI. Do notclaimallsuccessfulpathsoverwriteC. Retainthatcontract;
newPHP/ADCcounterfactualsonBOTHactualsuccessorsmustfailthefocusedquerybeforeatomic
authentication. No newABIorcallerstatusguaranteeiscreated.

ActualsavedOriginalprobes,bothbounds:allthreefinalcalleesderivecanonicalBoolean
A/NZ;onekeyState→snapshotCompatibleproofremovesexactCMP#0andbothactualcarry
continuationsarecompatible(theactualedgelong-branch). TheotherkeyState/joystick
calls→soleGroundSourcehaveemptyremovedsuffixandcanonicalcallees. No sharedbody/
activation-root/ownermismatchappears. Theseprobesdonotbypassthecurrentbarrieror
acceptthetuple. Fournewordinaryraw-loopwork-returnsourceprobes(plain/constborrow
×direct/negatedBoolean)arelegal,residualcomplete,haveonecertifiedBooleanproof
withremoved0/1respectivelyandnobyteproof;allcurrentlyrejectexactBooleanbarrier.
NextaddfocusedREDtestswithinexistingbyte-windowtestowner,thenconsumer-onlyfix.

BeforeBoolean-onlyproductionchange,captureexactexistingowner409SHA
`f24cb8c5d3564be2b3650c2a91cdc19e7a9df0ea214b2c100beb98350c0fec31`
andtest369SHA`0395e0c236c62949f19f3117a9155118f8e0fedfb06db750aa5fe4bac91b4314`.
Addonlytwoordinarysourceconstants/plainandconstborrow,positivebothbounds/direct-
negatedBooleanwithactualremoved0/1andnobyteproof/canonicalcontrols. Addactualboth-
successorPHP/ADCcounterfactualsrequiringfocusedcarryrejectionaswellasatomicerror,
afterapositivefocusedcontrol. No qualifiedhelpermoved/changed/exported;all369old
testbytes/assertions/outcomesstay. Normalformat≤500andmeaningfulREDsduebefore
Booleanproductionedit. No otherconsumer/producer/emissionchangeauthorized.

Normalformatfits485/500test. All21oldcasespassandfournewcasesreachmeaningful
BooleanbarrierRED(twoordinarysourcecompositionsandbothsuccessorpositivecontrols).
OnlythenremovetheBoolean-onlyglobalnonempty-effectsbarrier,andmechanicallydrop
theunusedprivateparameter/callargument. Preserveexportedtwo-argumentvalidator,
itsimports,separatebyte-windowbarrierandallactualsource/callee/successor/carry
checks. Correctprivateproofdocumentation: compatibleordinaryreturnisnotacarry
overwrite. NoABIchange,newhelper/type/API/export/produceroroldexpectationamendment.
Implementationpendingnormalformat≤500/strict/build/old-newverification;task15partial.

Boolean-onlyfixformats402/500,test485/500;strictNodeNext/buildand137cases/3owned
filespass. All21oldbyte-windowcasesstayGREENincludingoldraw/status/asyncbarriers;
fournewcasespassallpositivebounds/direct-negated/constborrowconfigurationsand
allfourfocusedPHP/ADCsuccessorcounterfactuals. Atomicmutationerrorsarenotclaimed
aslocalcarryproof: focusedvalidatoritselfrejectsfirst. ActualsavedOriginal/both
boundsnowpassBoolean-specificchecksandstopattheseparatebyte-windoweffectsgate.
No fulltuple/task15acceptance,#133closureornewsource/producer/emissionauthority.

Boolean-onlytwo-pathsortedpath/SHAcompactJSONfreeze:
`f61d11aaaf1c00722b44fb83f6d6580e27d9c343138d7c0ee180580cd3a21fd6`.
All369oldtestbytesreconstructexactly;450excludedsource/test/policypathsunchanged.
Current452entrymapSHA`0050a8dce679bcae6b1fde6b3b44b4a22daf479e5fc6a475ecce78d8d868c693`
reconstructsprevious378715c6byreplacingonlythetwoknownpre-editdigests.

Fresh32ACMEimages/64sequentialVICEcasesALLPASSforplain/constborrow×direct/
negatedBoolean×seed0/1×bothbounds×reference/candidate×P20/ED. IndependentBoolean
answerseed!=0andworkreturn(condition?7:9),actualcalleeA0/1/N0/Zcorrect,allactual
predicateRTSpcsarmedbeforeobservedchoice. BeforeBooleanJSRSP=entry−2(main→work),
calleeentrySP=entry−4,RTSactualcall+3restoresAXYPandtwostackbytes. ActualPRGasserts
reference-negatedC900atJSR+3andselectedBEQ/BNE;emptysuffixreferencealsoBEQ/BNE.
Eightorderedrawreads/eighttypedwrites/oneanswerstore,sourceinitializersandtrue
E147/E155incomingP/SP/CPUports/DDRA/allactualborrowedBASICrestorationpass. No
post-startupsourceinjection;rawexternalpatternsetbeforestartup. PinnedPAL6569/
6581/CIA0/Kernal03only;noIRQ-NMI/fullbus/deadline/otherprofile/hardwareclaim.
VICE-verified/hardware-unverified.
ScriptSHA`ecf44c2118f6009b8d27d7dd8a6d76cbe4c268f1e32b627f27650fc55a2bd669`;
32imageledgerSHA`01d119f639bedf9a1b6f42867f5906b979a135d6f876040406ae1b862091497e`;
64traceledgerSHA`ee2fb15e41e9f0db462f5558edd0268ac458512d782158933b8ae78f21ab3e90`.

Actualseed1offcompletecosts(ref→selected):plain/directPRG822→822,uniquegeneral
889→889+ZP4;plain/negated824→822,general891→889+ZP4;borrow/direct863→822,
general934→889,ZP6→4;borrow/negated865→822,general936→889,ZP6→4. BoundsONadds16
PRG/generalbytesoneachside. FunctionRAM9→7borrowedroute(plain7),globals10,
startupstate54→52(borrowed5→3BASICbytes),generatedcallstack4/startupheld0/transient1
chargedseparatelyfromexternalUnknowns. Borrowdeltasincludeearlierclosed-address/
storage/startupwork,notallCMPelision. LocalCMPremovalonly2B/2nominalcycles;
allotherwhole-input/paritygatesstay. Base,SFAandsemantics/DXreviewsnofindings;
platform/outputreviewsandfreshfullcheckpointremainpending.No taskpromotion.

Boolean-onlyplatform/outputreviewsalsocompletenofindingswithstatic/primary-
measurementlimits. Fullcheckpointisdeferreduntilthenextcohesivewindow-composition
correction;currenttask15remainsWIPandnomorethandirected/nativequalificationis
claimed. Priorfull3231/13knownfail/twooldskipsisnotcurrentBooleanfullGREEN.

Byte-onlyminimum-sufficientchallengerreturns**Simplify**withinexistingtask15:
removeonlyprivatebyteproof'sglobalnonempty-effectsban;keepfeasiblereference,
async/callable/source/backing/branch/uniqueentry/exacttemplates/continuationandall
atomicphysicalchecks. Noadditionalmissingfact/corruptionclassisdemonstrated.
Preserveexportedtwo-argumenttype/callshape,explicitlymarkrequiredresidualargument
intentionallyuninspectedandnotanauthenticationreceipt;documentthesame-input
callerprecondition.Droponlyunusedprivateargument,notexportedparameter. Thisisnot
a newAPIorpermissiontoomitsourceclosure.No newhelper/file/type/producer/export.

Proofscopeclarification: BYTEvalidatesBOTHactualtemplates/backingbutqueries
continuationsonlyforselectedsideunderexisting!referencebranch. Do notclaim
independentreference-sidecontinuationqueries. Thatboundaryisunchangedhere.
Actualnewordinaryprobehasrawloops+Booleanandbyteproofs,bothboundsresidualcomplete/
nonemptyandfocusedexactBYTEbarrierRED. Addoneadditiveboundsmatrixusingexisting
ordinaryBooleanfixtureandfocusedhelper,assertingcomplete/nonemptyresidualviaits
operationcountandfocusedprecondition,activeBOTHproofs,focusedandatomicsuccess.
All485currenttestbytes/oldexpectationsstay;normalformat≤500/REDsbeforeproduction.

Normalformatfits499/500test;bothnewboundscasesreachmeaningfulBYTEbarrierREDwhile
all25oldBoolean/bytecasespass. Onlythenremoveprivatebyteproof'ssingleeffectsban,
droponlyunusedprivateparameter/callargument,andretainrequiredexported2argtype/
callshapewithintentionallyunused_effectsname/documentedsame-inputcallerprecondition.
No receipt/authenticationclaimorvacuousguard;atomicownerstillcomputesandchecks
allresidual/source/physicalobligations. Rejectiontextnowdescribesremainingactual/
synchronousrequirements,notunrelatedregister-onlysource. Allotherproofsunchanged.
No newhelper/file/type/API/export/producer/fixture/oldoutcome/capauthority. Normal
format/strict/build/new-oldverificationpending;task15WIP,#133expirybinding.

BYTEcorrectionformats397/500,test499/500;strictNodeNext/buildand162ownedcases/
4filespass. BothnewREDsGREENandall25oldbyte/Booleancasesunchanged. All485prior
testbytesreconstructexactly,newmatrixonly14lines. Two-pathfreeze
`e9c652eb5e5e6f0e1f717f4f805e08322d2e672f2914d3e377b91dd79d82e467`;
452currententrymapSHA`505bd551a0f629fa356767a610c2150763ea3f4f51103e8affae21d2cdc25557`,
450excludedunchanged. No unapproved oldexpectation/schema/producer/API expansion.

Fresh28ACMEimages/56sequentialVICEcasesALLPASSfor7x/ysets(3,1),(1,1),(0,1),
(128,0),(128,128),(255,1),(255,255)×bothbounds×bothactuals×P20/ED. Independent
sourceBooleanx!=y&&(x&y)!=0and7/9answer,actualsourceinitializersandexternalraw
patternbeforestartup. AtcomparisonreferenceA=x^y/Cpreserved,selectedA=x/Cunsigned
compare,sameequalityZ/preservedV-D-I-X-Y-SP. OnunequalpathafterANDA=x&y/NZcorrect,
CV-DI-X-Y-SPpreserved. ActualreturnedBooleanA/NZ,8orderedrawreads/8typedstores/
oneanswerstore,twonestedJSR4Bstack/genuineE147/E155P/SP/ports/DDRA/BASICrestorepass.
ActualwindowopcodesreferenceLDA/EOR/LDA/AND12B16nominalcy,selectedLDA/CMP/AND9B12cy;
no source/nativepatches. PAL6569/6581/CIA0/Kernal03only;no fullbus/deadline/IRQNMI/
otherprofile/siliconclaim. VICE-verified/hardware-unverified.
ScriptSHA`bb4b877884f36f73bdaea14b350b0805d6756b070e0a863ec6a2686a3c467027`;
28imageledgerSHA`248534247fe74df8d5355abf4d1b9357b5008d7b3fc9118a3b3e2232274aca3c`;
56traceledgerSHA`4cebdbd925cf5deeec1cc21c95421dae99388cfcf693062ae5944ce752e81275`.

Complete3/1sourcecostisPRG838→838off/854→854on,general906→906/922→922+ZP4,
functionRAM7,globals11,state52,generatedcallstack4/startupheld0/transient1. Thelocal
three-bytewindowwinisabsorbedbyactualBooleanreturnconstruction—notpadding:
referencefalsepathusesalready-zeroAandsharedRTS;selectedCMPpreservesleftAand
thereforeneedsLDA0/RTS,separatefromLDA1/RTS. Bothactualpredicates19B. Same-page
nominalpredicatepaths(equal/unequal-ANDzero/unequal-ANDnonzero)reference17/27/28cy,
selected19/24/25. Thisistradeoff,notuniversalTdominance;JSR6cycommontoallpaths.
Do notclaim−3PRGbytesorblindlystable-IDtieit. Task18completeB/R/comparableTselection
isstilldue;no publicsizechoiceorwhole-routineparityisqualifiedbythisconsumer.
Base/SFAboundedBYTEreviewsnofindings;remainingreviews/fullcheckpointpending.

ActualsavedOriginalbothboundsnowpassesBooleanandBYTEwindowchecksandstopsat
Originalfieldsourceclass. Freshreadonlyinventory: snapshotCompatible35sourceblocks,
twoOriginal-dischargeprovedloops(outerconstant8/innerparent-next8),neitherpreheader
issourceentry. TwoOriginalfieldproofssharegroundedRowsfirstdefinition/fieldoffset8:
outeruseinb19if-end(loadLHS),inneruseb27for-body(unary~typed-indexLHS). Existing
fieldvalidator671/700requiresone5-blockentryloop/useinthatbody/simpleloadLHS.
All24fullrecipesremainunqualified;selectedloop/asyncgateunchanged. No fieldproof/
helper/producer/testeditisgivenauthoritybythisdiscovery;needsminimum-sufficient
existing-ownerassessmentbeforeimplementation,notaguessedglobalguardremoval.

Freshcohesivecheckpointcompletesinstall0.41s/typecheck1.04s/buildpreviouslygreen;
full382.74sreportscompiler3237passes/13sameunfinishedfrontierfailures/twoexisting
skips,183passingfiles/184total. CLI62/LS21/VSCode6pass;rootnotreached. Nooldnegative
outcomechanged. FourcurrentcodepathsSHA
`f04737dbabee694694ecc66c293f01029473d05805aef635897ba7213e0507b4`;
all452entrypathsaccounted448excludedunchanged,reconstructpre-edit4e47c21fmapby
replacingonlyfourownerhashes. Elevenoracles,fresh45boundariesandsevenoriginalnone
artifactidentities/emptydiagnosticsstayunchanged. CompositeREDstillforbidscommit.

Finalreference-routecheckfindsthescratchnativeACMEcommandsomittedmandatory
--strict-segments,althoughallgeneratedPRGsexecutedandwerehashed. Do notsilently
treatthosecommandsascompleteassemblerqualification. Reassembleall76exactimages
usingexplicit--cpu6510/--strict-segments/--formatcbm,freshreports/symbols/output,
andtheexistingverifyAcmeOutputcompleteinstruction/label/segment/PRGreconciler.
Requireexactsource/ASM/PRGidentityagainstthealready-executedledgers. Thisstrengthens
artifactproofwithoutinventingnewVICEruns: identicalfreshstrictPRGbyteslinktothe
152recordedbehaviortraces. No compiler/test/source/oraclechange;verification
plumbingcorrectionwithinapprovedqualification,notnewharnessorproducer.

StrictreconciliationnowpassesALL76images(16raw/32Boolean/28BYTE). ACMEversion
exact`0.97("Zem"),31Jan2021`;freshstrictPRGsarebyte-identicaltoexecutedimages,
andexistingterminalreconcilerindependentlyencodes/checkseverystructuredinstruction,
alllabels,segments,padding/headerandcompletePRGbytes. No warning/overlapexception,
staleoutputorweakenedreconciler. LedgerSHA
`7bf707904592e50646390c5168ab4b71b52d38da0e1d883b685f3a709bd51e8b`.
Earliernative-driverhashesremainhistoricalactualexecutionidentities;donotedit
themtopretendtheyuseddifferentflags. Strictfollow-upisaseparateartifactendpoint,
notadditionalVICEcount. Consumerfullcheckpoint/sourceidentitiesremainunchanged.

AR70requestedoneboundedread-onlycorrespondencereportcompletes,bothbounds,SHA
`d50a2c5ae0f19508527106a9f120d1f90f2c90b0c73d865a2dc70e8ab69dc48c`.
No field/helper/testcodechanged,noproofmintedorcounterfactualeffectsetused. The
diagnosticaccountsforexistingoffset8fieldprefix/substitution/RHSelisionsandmarks
innerheld-leftstore/reloadasexpectedelisionsforcomparisonONLY,notvalidatedproof.

Fourfirst-unmatchedretainedsourceblockclassesremainonBOTHbounds:

| Source block | Reference → selected mismatch | Exact source identity / independently resolved address |
| --- | --- | --- |
| b0entry | Remaining16→8instructions,rank0LDY#0→LDAglobalSaved+9 | TypedLOADoperation0/v0,span5947–5965(joystick2),notfirstrecipefieldoffset8. Selectedroot3910/3990off/on,read3919/3999;effectiveLDAhasexacttyped-originoperation/position0/length1. |
| b14outerbody/boundspass | Remaining16→16,rank2ADCstorageparameterLow→ADCimmediateGlobalSavedLOW | TypedLOADoperation47/v43,span6532–6553(rows[column]);actualformalrequesthome4290/4370,2BRAM. Setupinstructionhasnoeffective-readorigin;laterLDAownsit. |
| b27innerbody/boundspass | Remaining14→14,sameADCparameterLow→GlobalSavedLOW | TypedLOADoperation86/v74,span6972–6992(rows[other]);sameactualparameter/rootbounds. |
| b32conditionselected | Remaining2→1,LDAotherResidual→ANDresidual | Binaryoperation102/v84,span7052–7076;otherResidualhome4317/4397,residual4004/4084. ExistingseparatelyvalidatedBYTEwindow,notnewfieldalgebra. |

Actualheld-leftrequestisidentifiedfrommatchingreferenceSTA/LDAstorageoperands:
`machine:@blend65/stdlib/c64/input.blend:5846:7176:retained-value:function:@blend65/stdlib/c64/input.blend:5846:7176:v75`.
Itis1Btemporary,bindingnull,domainmain,noactivationroot,owner/lifetimefn5846–7176,
source6971–6992(unaryoperation87/v75);operandLOAD86/v74span6972–6992. Home4322/4402
off/on;selectedrequestabsent. Innerblocksourceindicesunary2/use4/binary5;declared
occupancyincludesallpositions0..10ofthatblock,144totalpositions,zero crossedcalls.
ActualsymbolicSTA10andLDAreload14pairwithunary/binarysourceSpansrespectively.
No guessedrequeststemornonexistentvaluefieldisinvolved.

Existingbody()isNULLforBOTHrepresentations,off35/35blocks/on40/40—notmissing
blocks. Actualbindingdifferencesincludeliteralbranchendpointsthreadedthrough
same-PCemptyaliases,sourcebranchinversions,longrepairandsharedconstantfalse
returnaliaseswithremovedLDA0. Rawterminatordiagnosticcounts30differencesperside,
not30defects(jump→fallthroughalreadyedge-equivalent). Theoldhelperliteralendpoint/
instruction-indexcontractisnotadequatefortheactualfinalgraph. Firstdefinition
reallyisinsourceentry. Additionaltypedfield/indexed-readandBYTEcorrespondence,
notonlyunary-leftpreservation,arethereforepartofanyexactscopepacket.

Supplythisboundedactualreportinlinetosamefirstchallenger.Noexternalretries,
newproofmodule,oldoutcomeamendmentorproducerchangebeforeAR70ruling. Botholdstatus/
MMIOcontrolsandthecallerC100rejectionremainbyte-identical/unqualifiedforchange.

CurrentBYTEbase/SFA/platform/output/semanticsreviewscompletewithnofindingsat
theirstatedstaticandprimary-measurementendpoints. Selected-onlyBYTEcontinuation
scopeandrequired-uninspectedresidualparameterareexplicit;no sourceorABIpromise
isstrengthened. Outputreference-routecompletesfromboundednormativeoperator/
artifactexcerptsandseparatestrictreconciliation,notdeniedexternalreadsornew
reviewerexecution. Full3237/13knownfail/twooldskipstaysRED;#133andAR70stopsstay.

### AR70 consolidated handoff —2026-10-29

The same independent challenge closes the exact revised five-path packet in
AR70, including recorded callers and the executing-bridge addendum. Earlier
move-body-to-new-leaf inventory is superseded: final binding stays in the existing
layout owner; one new correspondence concern shares typed-read/window matching.
Only the named qualified movements/exports/anonymous contexts and single old
caller-C100 outcome are proposed. New leaf/test700, parent700/layout400/oldtest700
are hard limits, not evidence of fit. No new field/helper/producer/test edit has
been made, and both proposed files remain absent.

The bounded caller probe identifies both real forwarding arguments as discharged
place-address operations of whole caller formals, not the final global root.
Their existing Closed origins resolve to the same global object. Actual reference
delivery reads each aggregate-address temporary's low/high byte into the callee
formal; the existing immediate-root-only check is insufficient. The revised packet
therefore includes exact forwarding/materialization, occupancy/interference,
matched entry-state boundaries and exhaustive remaining caller correspondence.
No root solver, whole-body exemption or source-specific recognizer is authorized.

The interrupted wrap-up resumes at the same material scope stop, not with new
execution authority. Current four-code-path identity f04737db and all accumulated
work stay; AR70 remains the sole open AR. Task15 remains partial,26/40 verified,
parent38/48,v4four/ten. #133 remains MAJOR/open with its remedy-scope expiry before
task15 closes or17/1.3.3 advances. No staging,RED commit,push or task promotion.

Final handoff validation passes: current f04737db,all452entry-path identities,
448excluded paths/eleven oracles,unchanged671/320/626field owners and absent new
files. Four source ceilings694/546/397/499 fit700/550/500/500;source formatting,
whitespace,185local links and artifact/task structure pass. Register70ARs/69resolved/
only70open;40tasks/26verified/threevisibleAR70blocks. Frozen specification/expert,
portfolio,index and HEAD1022fd52 stay unchanged. No new compiler verification is
claimed by this interrupted-handoff continuation; completed3237/13knownfail/two
oldskip checkpoint remains RED. All reviewers/emulators/processes have finished.
Execution Plan Updated:yes. No commit or push.

Cleanup:done—remove only155ownedfilesinexactraw-owner-cejxffrfand458ownedfiles
inexactboolean-compose-oociyd1p after durable source/ASM/PRG/trace/strict-ledger/
correspondence/scope evidence is recorded. No symlink,userfile,versionedartifact,
worktree or another session's content is removed. No raw artifact needs to remain;
recorded hashes and regeneration recipes preserve required future comparisons.
Await the exact AR70 five-path/one-old-outcome approval; no field implementation
or expectation amendment is authorized by the request to resume the interruption.

### AR70 execution start —2026-10-29 09:00CET

User **“approved, proceed”** directly approves the exact five-path packet before
tests/code/relocation. Entry505bd551/452paths,70resolvedARs,field671/layout320/test626,
emptyindex/frozenspec andfreshbuild/38oldfieldtests pass. Originalphasebaseline
e221a08c remains;allaccumulateduncommittedworkispreserved. No broaderproducer,
fixture,publicschema,helper/file/cap orold-expectation authority.

Minimumsufficientcheckpoint:newfocusedtestusesunchangedeffectFixture,actualsaved
sourceandordinaryprefixed/nested/const-forwardedglobal/privatecases. No copied
privatehelperorgenericmutationframework. Initialadmission/resourcechecksderive
fromordinarysemantics;onlytheapprovedoldcallerC100expectation/titlechanges,not
itsinputorstatus/MMIO/nonecontrols. CapturemeaningfulREDsbeforeproduction;then
performexactqualifiedrelocationsbeforeextension,andverifyreadable700/400/700/
700/700fit. #133MAJOR/openandremedy-scopeexpirybefore15close/17or1.3.3stay.

InitialREDgate:five meaningfuladmission/resourceoutcomesfail(newsavedbothbounds,
composedbothboundsandsoleoldC100case),37oldcasespass;nofrontend/setupfailures.
Newtest82/700,oldtest626/700fits. Thenrelocateonlyoccupied/stream/pointerDead/
per-proofmatchingandlayoutunchangedtothenewconcern. Edgeexportiswiringonlyat
thispoint. KeepoldpointerDeadfour-argumentbodyforrelocationequivalencebefore
approvedthree-argumentextension;newcaller matcherisnotinventedasanacceptingstub.
Wraptheexactper-proofblockintheapprovedcalleecontractandmergeitslocalchanges
intheparent. Parentcollectssource-labelitemsforpointercheck;thenewprivate stream
checkstillmustclosebeforeanyacceptance. No source-class/admissionwideningyet.
Normalformat/type/build,relocated-bodyequivalenceandunchanged37oldpassesduenext.

Relocationgatepasses:exactqualifiedbodytokensforoccupied/stream/pointerDead/
per-proofloop/unchangedmatchbeforecopies;strict/buildpassandthesame5meaningful
RED/37oldpassesremain. Readablefitsparent551/layout275/leaf266/test82/oldtest626.
Onlythenextendfinalbinding: checkedsourceidentity,normalizedsame-PCaliases,
typedshared-returnproof,andindividuallysource-ownedadjacent3B/3cyJMPbridgeswith
solefallthroughentry/noaddressreference. No syntheticItem/Bodyfield or emission
change. Edgeisnowthenamedtwo-argumentnullableAPI;invalidnullpairsfail. Remaining
codecomparisonretainsalloriginalblocksandaccountsvalidatedmaterialization/
bridgegeometryratherthanrequiringidenticalphysicalblockcounts. Normalformat400
layoutcap/strict/old-outcomeverificationpendingbeforefurtherextension.

Firstordinaryformatproduceslayout415/400. HONORhardstopbeforestrict/build/new-old
execution/nativeoranyfurtherextension. Preservefulldraft;no guard removed,code
compressed,helpermoved,newfile/APIintroducedorceilingraised. AR71recordsmeasured
capacity;soleindependentminimum-sufficientassessmentpending. Thecurrentbinding
draftisNOTqualifiedbythepriorrelocation-onlystrict/build/5RED/37oldpasses.
Task15partialand15/17/1.3.3blocked,26/40,parent38/48,v4four/ten,14remain.

AR71stoppedfive-pathsortedpath/SHAcompactJSONidentity
`8c1175fe49b5af1270b410d1da3f856843ad5c3c3932818ec4926b611a5798f9`;
parent551/layout415/leaf301/newtest82/oldtest626. Soleblindcapacityassessment
returnsJustified: onlylayout400→450,measured415fits35reserve,no code/movement/
helper/API/import/dependency/newfilechangeforcapacity. Noreadable15-linesaving
demonstrated;movingbindingintocorrespondenceintroducescycle/interfaceexpansion.
Body158–304complexity/remainingfitriskstay;moderateconfidencecapacityonly. Exact
directrulingpending. No strict/build/new-old/nativequalificationorfurthercode
editfollowscapacityadvice. AR70and#133scope/old-outcome/verificationgatesstay.

Finalstopguardsconfirm8c1175fe,all452entrypathsaccounted449excludedunchanged,
elevenfrozenoraclesandonlytheapprovedC100expectation/titleoldtestdelta. Register
71ARs/70resolved/only71open;40tasks/26verified/threevisibleAR71blocks. Whitespace,
185locallinksandartifactstructurepass;sourceformatmeasurementisstill415/400,
NOTafitpass. Frozenexpert/spec/portfolioandemptyindexstay. No newstrict/build/
test/nativeorcompletecheckpointisperformedafterthehardstop. Lastrelocation-only
5meaningfulRED/37oldpasses/strict/builddoesnotqualifylaterbindingcode. Allprocesses
andtheonecapacityassessorarefinished. ExecutionPlanUpdated:yes;no commit/push.

Cleanup:done—removeonly15ownedtemporaryfilesinexactfield-correspondence-0bwsc635
afterrecordingapproval,RED/relocationequivalence/checkresults,entry/drafthashes,
capacityproposalandsafetyboundaries. No symlink,userfile,versionedartifact,worktree
orothersession'scontentisremoved. Keepbothnewsourcefilesandallaccumulatedchanges;
awaitonlytheexactAR71one-file400→450ruling,notapprovalbysilence.

### AR71 approved execution continuation —2026-10-29 10:18CET

User **“I approve, proceed”** approves only field-layout400→450. Entry8c1175fe and
551/415/301/82/626 confirm byte-identical before verification. All71ARsresolved;
strictNodeNext/buildpassandthe same5meaningfulRED/37oldpassesremain. No code
changeforcapacity. No newpublicAPI/producer/oracleauthority;#133expirybinding.

ResumeAR70: consumeallalready-dischargeprovedOriginalloops,notoneentry-shaped
loop;removeonlyunrelatedglobalraw-effectkindrestriction. Source/recipe/backing/
state/writes/calls/physicalchecksremain. Usechecked-sourcefinalbinding,move
pointerDeadtoapproved3argsandrequirefreshpointerbytesineachrelevantsourcestream.
Matchproof-ownedsourceblocksandbounded~typed-byteLHSwithactualheldcapture/lifetime/
two-use/selected-omissionchecks;keepscalarcaseandexactRHS/statechecks. No generic
valueinterpreterornewmetadata. Readablefit/strict/oldoutcomesdueafterthisextension.

Group/unary draft fits537parent/415layout/364correspondence/82newtest/626oldtest.
Fresh strictNodeNext and allfour build tasks pass; focused42cases report4newRED/
38oldpasses. The sole approvedC100outcome now closes; all38oldfieldcases pass.
Bothbounds composed and actualsaved source still reject `Original unchanged callee
code disagrees`. No other old assertion changes or full observer/Task15 promotion.

### AR72 correspondence capacity stop —2026-10-29

The next in-scope draft adds private local occurrence accounting, bound address-byte
resolution, fixed-field/unit-stride typed-read matching, existing Boolean/BYTE
validator reuse with exact occurrence accounting, and the approved six-argument
recorded-caller matcher. The parent does not yet call the latter. No producer,
fixture, metadata, public schema, new file/export beyondAR70 or old oracle changes.
First ordinary Prettier result is **791/700** for correspondence. Stop before
strict/build/tests/native or further implementation. This draft is untyped/unrun;
earlier group/unary results do not qualify it. No compression/check removal/movement
or extra cap is used to fit. All accumulated uncommitted work is preserved.

Five-path sorted-path/SHA compact-JSON identity:
`301b6e0279d6b3ffd2e3428634dfb782618377ca494251f4c337a3ba56afb1f0`.
Sizes537/415/791/82/626 versus700/450/700/700/700. AR71entry map covers454paths:
only parent and correspondence differ;452remaining source/test/fixture/policy hashes
are unchanged. Frozen spec and index remain empty. AR70/71scope/C100-only authority
and#133expiry remain;26/40,parent38/48,v4four/ten,six implementation/eight hardening
tasks remain. No staging, RED commit, push, phase or original963/725 claim.

One blind read-only capacity assessment, native design-challenger session
`ses_e78e4117dffeCJ2WhH6MkeTYDy`, requested Astra/xhigh override accepted, returns
**Justified**: exact correspondence700→850 only, retain stopped code byte-identically
FOR capacity remedy. No code, helper/file/API/import/dependency/movement amendment.
No concrete readable≥91-line reduction is established. Typed-read extraction is
viable but broader:272lines depend on qualified pointerDead and shared accounting,
requiring a new callback/export seam and explicit ownership approval. All other
AR70/71ceilings/authorities stay. Moderate confidence for capacity only;59reserve
does not prove final fit. Strongest objection is deferring a needed split while
caller integration and correctness fixes remain due. Direct exact ruling pending.

Final stop guards confirm301b6e02and537/415/791/82/626, all454entry paths accounted
with452unchanged outside parent/correspondence, and all11immutable oracle hashes.
The first inventory-only oracle lookup omitted threeRD05 paths; direct checks of
their exact known paths against the original ledger also pass. No oracle failure
or amendment.72unique ARs,71resolved/only72open;40tasks/26verified and three visible
AR72blocks. Six touched Markdown files pass targeted Prettier,185local links and
whitespace; source formatting remains791/700, NOT a capacity pass. Frozen expert/
spec/portfolio/policy and empty index are unchanged. No strict/build/tests/native
or further production follows the stop. Independent capacity advice is not a
correctness or full-phase review. Execution Plan Updated:yes;no commit/push.

Cleanup:done—17ownedtemporary files and the exact field-proof-88bfhz9t directory
removed after durable evidence recording. No symlink, user file, versioned artifact,
worktree or other session's scratch is removed. All checks and the sole assessor
have finished. Preserve both new source/test files and the entire accumulated
uncommitted worktree. Await only the exact AR72 correspondence700→850 ruling;
AR71's layout450 approval is not authority for this additional exception.

### AR72 approved continuation —2026-10-29 11:25CET

User **“proceed”** directly approves the sole exact correspondence700→850packet.
Confirm301b6e02and537/415/791/82/626beforecode/verification;457source/test/policy
entryhashes saved,emptyindex/frozenspec. No codechangeforcapacity. All72ARsresolved;
strictfirstfindsoneTypeScriptclosure-narrowingerrorat122. Capturethealreadychecked
operandbeforethecallback;no runtimeproofrelaxation. Freshstrict/build/old-newtests
due. RemainingAR70caller/negative/nativeproofs,#133expiryandallothercapsstay.

Closure-narrowingfixfits792/850;strict/buildpassandthe same4RED/38oldpassesremain.
Actual callee correspondence now closes; remaining reasons are evaluated forwarding
identity(composed) and caller binding(saved). Extend only the approved parent:
bind checked caller identity, consume existing Closed formal origins, identify the
actual2byte materialization from operands, prove exact four-plus-four byte-copy
instructions/omissions/occupancy/watched writes, merge caller correspondence, and
derive entry-state boundaries from matched surviving occurrences. No source-root
solver, new producer field or free-JMP treatment. Normal formatted700fit due FIRST.

Parent fits641/700. First strict flags SemanticFunction-keyed sourceFacts lookup
and inference annotation; both corrected without API change. Fresh strict/build
then42cases report38passes/4failures: global composed bothbounds and private/off
nowclose; actualsaved rejects pointer-dead associated-field proof and private/on
rejects address-state proof. One protected old failure is only error-order text:
restore original reference call-entry check before remaining-code comparison;
do not amend expectation. PointerDead inspects only source streams that actually
contain relevant later uses, retaining exhaustive unassociated-use rejection.
Retained-address state now queries each changedY/C/Vbit independently; a cycle
can bypass only a bit with no actual program reader and no unresolved call.
No generic cyclic evaluator or dropped status observation. Format/strict/tests due.

Fresh strict/build and39passes/3newREDs restore all38protected oldpasses. Narrow
diagnostics show caller pointer uses share source groups containing non-linear
shift/control expansions; requiring every such group to be a linear bounds chain
is unrelated. PointerDead now requires each actual source-associated block to
define both bytes before any read and resets that obligation at the replaced read;
no unassociated use or cross-edge assumed definition is accepted. State queries
reuse existing acyclic byteContinuationQuery perbit, treating only exact SEI/self
halts as terminal and an actual direct callee as query-only no-observation when
its real entry query proves that samebit dead. Carry the bit across the call;
do not invent a definition or erase actual call/costs. No recursive graph evaluator,
producer or lower-control change. Fit/strict/tests due before broader qualification.

Fit643/415/829/82/626,strict/buildpass;40passes/2savedREDs. Private/global bothbounds
and38oldcases nowpass. Saved remains address-state only. Replace global no-reader
fallback with stronger current-body per-block definition-before-use proof perbit,
using the same independently checked direct-callee summaries. Each block must be
safe for an arbitrary incoming bit; current suffix checked separately. This closes
dormant-bit cycles without a graph/value solver or weakening actual observers.

Fit828/850;one bitmask inference annotation fixes strict;strict/build then41/42
pass,onlysaved/bounds-on remains RED. Initial prose misidentifies mask64asV;
actual BYTE_WINDOW_CHANGED hasY64,V32,C4. The failing bit is Y across an internal
SEI/trap cycle in the actual callee; no final function reads V. Retain both valid
bounded alternatives: complete closed-program no-reader proof OR current-body
block-local proof, with existing acyclic query first when needed. Reuse one exact
direct-target lookup (zero offset,no address-byte/transform) for both alternatives.
No extra exported API or control/value interpreter; normal850fit checked first.

The complete global-no-reader alternative fits845/850 and strict/buildpass but
still41/42: it cannot close Y, which is read elsewhere. Reuse the exact terminal
halt normalization for the callee-entry query too; otherwise a self-halt falsely
requires Y at a path that never returns. Factor only this new local query helper,
not any qualified helper or exported API. Format850fit is checked before strict.

Terminal normalization plus required local helper docs fit643/415/847/82/626.
Fresh strict/build and all42focused tests pass, including actual saved/bothbounds,
both backing classes/bothbounds, unchanged serialization/resources and all38old
fieldcases. This is admission only,not completeAR70/Task15orpublicsizequalification.
Add bounded in-test occurrence corruptions for actual carry/indexbase/AND/unaryheld/
unrelatedopcode and forwarded highbyte/missinginit/extraJSR, bothbounds. Change
symbolic and actual instructions together so the local proof must reject, while
atomic authentication independently errors; no reusable mutation framework or
copied private test helper. Negative matrix, broader regressions and review due.

Fresh negative matrix fitsnewtest238/700;strict and44focused tests pass. Sixteen
explicit corruptions (8faults×2bounds) reject in the local field parent as well as
error at independent atomic authentication. Production remains643/415/847;oldtest
626 and its entry SHA2884044d6ec39a64ce211b126cae715a19e4f8287c13f6a0263ef615dc590f74
are unchanged. Current five-pathidentity
`4bd231ba9ccfe07082986e3ff8e168d7942926e792a8d38e8fe0a428a5d5522d`.

Bounded independent base and SFA reviews dispatched, not fullAR70/Task15/phase
clearance. Base session ses_e78b64578ffe5TtUvgs4l4BVJF first requests actual bounded
diff/commands; AR72entry→current five-path diff and exact successful commands are
prepared from pre-change owned copies, with no oldtest delta. EarlierAR70rawbefore
oracle copy is no longer available; its historical boundary stays independently
Unknown,not fabricated from this later baseline. Native base reviewer then rejects
external_directory reading review-evidence.md. No retry with another tool, shell,
path movement, permission change or delegated filesystem workaround. Base review
is blocked/not cleared. SFA session ses_e78b5c7e5ffexJPMBjJsVLSg2V and primary
typecheck/broader observer/import-boundary checks are pending. No code changes
after dispatch; no native/output/full-phase qualification or greencommit claimed.

Primary full typecheck passes all6Turbo tasks1.728s. The first broader-observer
command reaches the tool's120s timeout before a test summary; not counted green,
and the boundary command was not reached. A sequential boundary+observer retry
runs with timeout0 and captured logs; no emulator cases are launched by this unit.
All code remains frozen at4bd231ba while the two bounded reviewers finish/respond.

Retry completes:45import-boundary cases/3files pass2.56s;756observer/storage/layout
cases/18files pass229.67s. The earlier120s timeout remains an incomplete first run,
not a test failure or green claim. Current strict/build/typecheck/44focused and
756broader/45boundary gates pass atunchanged4bd231ba. No complete compiler/root
suite, new runtime, fullAR70matrix or final-phase qualification is claimed. Base
review remains blocked by native external-directory denial; SFA review pending.

Bounded host-cost probe uses the unchanged actual saved source, one independent
construction per bounds policy,25local-parent and10atomic calls each, first3calls
excluded from timing summaries. Every call completes and input/code remain unchanged.
Bounds off/on construction1690.22/1259.70ms; parent median23.41/22.81ms,max33.80/
35.83ms; atomic median503.88/480.54ms,max619.69/599.88ms. Process peak RSS226260/
272736KiB includes construction and both policies,not per-call allocation. No
before/after regression ratio or host-performance clearance is inferred. Full
`yarn test` launched separately with timeout0 and captured output; no result yet.

### AR73 review ruling stop —2026-10-29

SFA review returns two MAJOR local proof findings: AR73-SF-001 selected indirect
read opcode is unchecked; AR73-SF-002 complete actual-entry scan misses startup
and numeric addresses in unrelated functions. Primary real-fixture probes reproduce
both at4bd231ba: selected LDA→ORA on private rows3/value255,bounds off/on, and
separate numericJSR$09BC in actual startup/main. Every baseline is complete; all
four mutated local field parents return null, while all four atomic observers
error. No atomic forgery acceptance or current ordinary-source miscompile claim.
Correct instruction metadata is used; two opcode edits or one actual extra entry
are explicitly counted. The first probe's nonexistent semantic-name main lookup
aborts; the corrected checked-source binding rerun supplies the four durable cases.

The same SFA context inspects newly allowlisted existing named-borrow and Original
call-site owners, then retains both findings with no additional findings. Borrow
proof closes source roots/backing/occupancy/interference,not actual read opcode or
incoming copy. Original call-site matching rejects numeric/offset/transformed/
unrecorded calls only within its supplied loop-owning function,not arbitrary
startup/main. Outer provenance refutation is effective but not a local semantic
proof. Recommendations are existing LDA guard and complete actual-entry closure,
with focused negatives/fix-only re-review. No production/test fix is made pending
the exact AR73accept-both-for-correction ruling; existing850/700/700caps stay.

Fresh complete `yarn test` finishes RED384.07s: compiler3243passed/13failed/two
existing skips across185files;CLI62,language-server21,VSCode6pass. Root suite is
not reached. The13failures are the unchanged cost-reader case,eight32/64-site
frontier cases and four72-function-return cases across allfourprofiles. No new
failure identity or skip. Previous3237compilerpasses plus the six new tests now
pass. Strict/build/typecheck,44focused,756broader and45boundary gates remain green,
but this is not a GREEN composite checkpoint or publicsize/963/725qualification.

All primary checks and both reviewers have finished. Base review remains blocked
by its native external evidence-read denial,not cleared or bypassed. SFA findings
remain open pending user ruling;#133's separate expiry and all remaining AR70
corruption/native/resource/fullphase gates stay. Tasks15/17/1.3.3 visibly blocked,
26/40,parent38/48,v4four/ten. No staging,commit,push or progress promotion.

Final ruling-stop guards confirm4bd231ba,643/415/847/238/626,454of457entrypaths
unchanged outside parent/correspondence/newtest,all11immutable oracle hashes,
73uniqueARs/72resolved/only73open,40tasks/26verified/threevisibleAR73blocks.
Targeted formatting/whitespace and185local links pass. Frozen expert/spec/
portfolio/policy and empty index remain unchanged. All processes/reviewers finish;
Execution Plan Updated:yes. No fix or readiness claim follows the MAJOR findings.

Cleanup removes42disposable owned files,including all verification/probe/benchmark
logs and the derived fixture. Retain ONLY8review-baseline files under
`$CODEOPS_TMPDIR/field-resume-n13kcskn/` because required base review is unresolved:
the five `entry-size-observer-complement-*.ts` source/test copies, `entry.json`,
`ar72-review.diff`,and`review-evidence.md`. They preserve the exact pre-change
baseline and bounded diff; never count their existence as reviewer access or
clearance. No symlink/userfile/versionedartifact/worktree/other-session content
is removed. Delete these remaining owned files after their review purpose ends.
All repository source,including both new files and accumulated work,is preserved.

### AR73 approved fix execution —2026-10-29 13:02CET

User **“proceed”** approves the sole accept-and-fix-both packet. Entry4bd231ba and
643/415/847/238/626 confirm before tests/fixes;457source/test/policyhashes saved.
Fresh build and44existing focused tests pass. Both findings accepted in05-findings,
not fixed/waived yet. Add two real selected ORA negatives (bothbounds,correct opcode
metadata) and44separate entry cases (11encodings/controls×bothlayouts×bothbounds).
Each source baseline must close; the local parent must reject independently from
the atomic provenance error. Startup/main numeric/interior/offset-alias calls and
jump/fallthrough/branch/long-branch cross-function terminators are explicit. Reuse
only existing fixture/instruction factories; no mutation framework/producer/oracle
change. Meaningful REDs and≤700formatted test fit precede production correction.

RED gate: test454/700,strictpass;46new failures/44priorpasses. Later full-log review
corrects the initial classification:44are meaningful local-null failures and two
bounds-off long-branch cases lack the assumed existing repaired branch. Those two
are setup failures,not meaningful REDs; do not claim otherwise. Both defect families
have meaningful REDs before production. Then add the single selected-LDA check and
bounded complete-entry scan:
include startup; derive actual target code-byte extents from the existing selected
CPU form table,not reported mutable costs; include real terminator bytes/bridge
JMPs, numeric/interior/offset-label references and cross-function terminator edges.
Only recorded exact no-transform callee-label JSR occurrences are permitted; an
unresolved actual JSR cannot establish disjointness. No new solver/API/producer.
Normal700/850fit checked FIRST before strict/build/green execution.

Formatted production fits689parent/848correspondence;strict/buildpass. First green
run reports88passes/two setup failures only. Replace the new test's unavailable
long-branch lookup with explicit CPU-factory inverse-branch/JMP parts and exact
current-PC page-cross cost, keeping the same unrecorded-entry rejection assertion.
No old expectation or source fixture changes. This corrects test setup,not either
production fix or a previously passing protected outcome. Reformat/strict/green due.

Final correction fit689/415/848/470/626;freshstrict and90focusedcases pass. Both
SFA findings'46new isolated-parent rejection cases are green,including the44entry
encodings/control combinations. All38oldfieldcases and prior6newcases staygreen;
oldtest/layout byte-identical. Current five-pathidentity
`2d2f04081a181933ca29bb40db061870767f10abf022ad30d269c55857a5ef93`.
Dispatch the ONEfix-only SFA re-review to the same session,with actual production
diff supplied inline and newtest/command/results, no external-directory access
request. No thirdreviewpass or wholeAR70/Task15/phase clearance is inferred.

The one fix-only SFA re-review completes: both AR73-SF-001/002 corrected, no
findings within the fix-only storage/ABI boundary. CPU-form byte extents retain
bridge bytes; only exact recorded JSRs remain. No new machine instruction/storage
demand or changed ABI delivery. Reviewer does not execute/recomputehashes or
qualify historical C100/native/resources/fullphase. Ledger marks these two fixed,
not any other finding. No third SFA review for this unit. Fresh primary regression/
fullchecks remain running. The initial base context receives authorized inline
source-change excerpts and exact commands,with no external-file retry or filesystem
workaround; only the bounded AR72→AR73comparison is assigned, historicalAR70oracle/
relocation integrity remains independently Unknown. Base result is pending.

The initial base context resumes on authorized inline source-change excerpts and
current repository reads WITHOUT external-file retry. It returns no findings for
the assessed AR72–73continuation (correctness/maintainability/written standards/
current additive-test integrity); historical C100/qualified relocations remain
Unknown and fullAR70/Task15/phase clearance is explicitly not granted. Both required
bounded current-unit reviews are now complete; the earlier external-read denial
is not an active blocker for this assessed comparison. No permission change or
denied filesystem action is performed. Native/resources/fullmatrix and #133 stay.

Fresh primary verification completes at2d2f0408: typecheck6tasks3.31s,45boundaries
3.33s,802observer/storage/layout tests18files575.94s. Full yarn test417.95s stays
RED: compiler3289passed/13same frontier-cost failures/two existing skips;CLI62,
language-server21,VSCode6pass;rootnotreached. All46new tests pass in the full suite;
no new failure identity or skip. Slow broader elapsed time is recorded,not inferred
as a controlled before/after host regression. No GREEN commit/push or promotion.

Strict ACME0.97 qualification assembles/reconciles28actual images with6510,
--strict-segments,--formatcbm and existing verifyAcmeOutput. Seven ordinary source
variants(global/privateCOMPOSED,privatevalue255,globalvalue0,mode1,onezero-rowearly
return,andtheUNCHANGEDsavedfixture),bothbounds,reference/selectedOriginal. Every
atomicobservercloses; before/after assembly/request/certificate fingerprints are
unchanged by validation. Assembly ledgerSHA
`277e576354c5056226b2d035c6eba6a52ca0e3a5e9b4024979497e48de00cd66`.
GlobalCOMPOSEDPRG1061→970/off,1119→1028/on;private/value2551043→952/off,1101→1010/on;
value01059→968/off,1117→1026/on;mode11063→972/off,1121→1030/on;earlyzero1065→974/off,
1123→1032/on;saved2165→1862/off,2245→1942/on. Counts include2load-headerbytes;
these are not publicfrontier winners or original963/725qualification. No VICE
result yet; proceed only sequentially after the complete test command has ended.

Independent planned runtime expectations,not optimized/reference differential:
COMPOSED normal/private/value255 allanswers3/observedtrue;value0 allanswers0/true;
mode1 allanswers0/false;zero-row3 answers[3,3,3,7,4,4,4,4]/false. Source initialization
remains normal,never debugger-injected globals. Compare actual returned A/N and
call SP, final values and answer-write order/count,rawoutput,then restored P/SP/
CPUport/DDR/CIA2DDRA at the established SYSboundary. Saved source uses only its
explicit external RAM input bytes; planned vectors independently cover high/up,
single-key/down,groundedrow/joystick-down,ambiguousfloatingcomponent,incompatible
rows,interruptedquality andbothportgrounds. Check rawread/write order/count and
retained snapshot bytes plus enum return values. PAL/6581only,pinnedVICE3.10/ROMs;
no deadline/dummy-bus/fullprofile/silicon/general firmware-stack claim.

First native bootstrap stops on an incorrect driver assumption: mainSP246 is
expected244 only because the probe assumed a startup→main JSR. Actual published
startup has balancedPHP/PLA and a zero-byte fallthrough into main; certificate
programstackpeak4 counts onlymain→relay→work. Correct the new probe to mainSP=
startupSP,keeping nestedsourcecall SP−4 and SYSreturnSP+2 checks. This is neither
a compiler defect nor a weakened source behavior expectation. No runtime pass is
claimed from the failed bootstrap; owned VICE is closed in finally. No repository
production/test/fixture changes. Planned saved cases also include independent
joystick-one-only and joystick-two-only paths, so each actual forwarding caller
is checked at its own snapshotCompatible entry when applicable.

Native bootstrap correction passes,then the complete frozen28image set passes
60unique sequential VICE3.10cases109.58s (24COMPOSED-family and36saved-vector cases),
plus the earlier duplicated bootstrap. Returned A/N, source-call SP, normal-source
initialization/finalvalues, typed-answer write order/count, exact rawinput/output
order/count, retained snapshot bytes, and restored P/SP/CPUport/DDR/CIA2DDRA all
match independent expectations. PAL/6581,pinnedKERNAL/BASIC/chargen; represented
incomingP0/SP246 only,not a status grid. ResultSHA
`112c411d6b4aa0e9d14253dd3eff7d538a093b1a7318f8d4375148dd54af6075`.
Status **VICE-verified / hardware-unverified**, bounded to those cases;no timing/
fullbus/four-profile/externalfirmwarestack/wholeinput963/725claim. Certificate
generatedmainline stack4/system0 stays4/0;this excludes external SYS/firmware/IRQ
guarantees. Global-family frameRAM/ZP22/4→15/2;private/value25531/4→24/2;saved66/10→
49/8 (bounds-off;fullledger records both). Global data/platform state remain separate.

### Remaining approved AR70 bridge-ownership matrix

The mandatory AR70sole-parent/no-independent-reference rule is already explicit,
not a new policy choice. Read-only corruption of the real keyState-owned costed
bridge finds a remaining implementation gap: startup→bridge terminator or numeric
JSR,eachlayout/bothbounds (8cases),stillcloses modified residual effects and BYTE
windows,then the local fieldparentreturnsnull;atomicreceiptvalidationerrors.
Bridge addresses3503/3316(offreference/selected),3568/3384(on),stablelabel
`function:@blend65/stdlib/c64/input.blend:8256:10802:b34:if-true.fallthrough.0`.
AR73's corrected callee-entry inventory does not own this distinct recorded-caller
bridge boundary; its fix-only review is complete,not reopened or run a third time.

Complete this existing AR70obligation in its already-approved field-layout owner
and new correspondence implementation test,within450/700caps. No newfile/API/
qualified-helper movement/producer/oracle/ceiling change or semantic fork. Add
meaningful local regressions first,then strengthen exact static incoming edges/
underlying symbol references across startup and allfunctions while retaining only
the proved parent-fallthrough exception. No generic address/value/control solver.
If formatted fit or required facts fail,stop rather than compress/remove checks.
The60runtime/28assembly records remain evidence for unchanged emitted artifacts,
not clearance of this still-incomplete local negative proof or wholeTask15.

Bridge matrix uses24separate cases (6forms×bothlayouts×bothbounds),newtest581/700.
Freshstrictpasses. Directed RED:20meaningful local-null failures,4existing exact-
label-reference rejections pass;52othercases in that file are filtered out,not
newly skipped qualifications. Every mutated tuple still closes residual effects
and BYTE windows first. Then extend only the already-approved body ownership
check: cover all static edges across startup/allfunctions,allow only the actual
parent's exact bridge-label fallthrough,and inspect all three executing JMP bytes
for numeric/interior or underlying symbol+offset references,including address-byte
materialization. No CPU/profile/API guess: referenced-symbol addresses precede
operand extraction/transforms and are distinct from effective memory operands.
Retain all prior same-function/adjacency/sourcegroup/3B3cy/binding checks. Format
450layoutcap first; no source/producer/oracle/extraAPI change.

Bridge completion fits427/450,newtest581/700;strict/build and114focused cases
pass. Base,SFA/static-entry and target-platform initial reviews of this distinct
remainingAR70delta return no findings. No AR73thirdfixreview is performed. The
platformrequested fourbyte rows are independently decoded from supplied values:
offrefparentEnd/bridge3503,target3364,4C240D;offselected3316→3191,4C770C;
onref3568→3418,4C5A0D;onselected3384→3248,4CB00C. All actualJMPs remain3B/3cy.
PRG/assemblyhashbindings are primary-reported,not recomputed by reviewers. Expert
2.0.4current5releasefields rechecked; governing normative keys MOS-PGM-1976,
CBM-C64-PRG-1982,ACME-097-R266 supplied without qualification/grader inputs.

Fresh28postguard atomic admissions and serialization/request/home/certificate/PRG
identities all match the executed60VICEcase artifacts. NoextraVICEreplayclaimed.
Freshtypecheck0.90s/45boundaries2.40s andfulltest407.80s:compiler3313pass/13same
frontier-costfail/twoexistingskips;CLI62/LS21/VSCode6pass,rootnotreached. No new
failure or skip. Sourceproduction remains unchanged after those full results.

Complete the remaining already-approved unary-held/window metadata negatives
ONLYinnewtest: binding/lifetime/surviving-selected-demand×bothbounds (6), plus
missing/duplicateactualBYTEproof×bothbounds (4). Use realheldSTORE/source/request
identities and realwindowproofs,not stems/fake facts. Localfieldparent rejects
independently from atomicreceipt errors. Test673/700,freshstrict and124focused
cases pass;no production/API/fixture/oldexpectation changes. Exact before581test
reconstructed by removing onlyownappend,hash-verified tofe1d3054beforetuple;
currentfivepath5850deed128e12d563db8f060465b8ffa07e2741597fc8def4f634954c10a129.
The test-only delta has its own bounded base review pending; priorfull3313results
precede only these10additive cases,not a claimed newer full-suite run.

Bounded positive-input host comparison alternates oldAR73parent/currentparent,
bothusing SAMEcurrentfieldleaf/layout,on unchangedSavedsource,bothbounds. Thirty
pairs/policy,first5warmup pairs excluded. OffCPUmedian35.40→37.76ms,wall22.43→21.93;
onCPU23.67→22.60,wall21.02→20.86;currentatomicwallmedian427.13/454.87ms. CPU includes
parallelGC and distributions overlap;no controlledwholepipeline regression ratio
or independenthost-performanceclearance inferred. PeakprocessRSS262464/288036KiB
includes constructions,not per-call allocation. No performance machinery added.

### AR74 next-scope discovery — code frozen

Fresh24endpoint and6selected-group probes are recorded inAR74. TwoSavedOriginal
tuples close;10selected-loop and12async-acquisition tuples need distinct proof
work,not trivial guard removal. AR53–56boundedscalar/five-role/store authority
doesnotcovertheseaggregate/raw/multi-loop/split cases. No selectedloop/borrow
production or test extension is made. All earlierqualified work preserved.

One blind read-only design-challenger context ses_e77b2d92bffeH70onDZLP9iLFs,
requestedAstra/xhighoverrideaccepted,assesses ONE next minimum-sufficient proof
boundary/partition,without the primary's preferredanswer. Directexisting-owner
composition versusonejustifiedconcern orasync-first must be grounded in actual
code/proof/capacity. No newfile/API/helpermove/export/cap/producer/oraclechange is
approved by the assessment. Any requested factual probe returns to thissame
context;no newblindcontextfromthisdispatch. Exact scoped ruling still follows.

### AR74 final two-file proposal — no implementation approval

The sole context requested one complete-difference probe and one precise
shift-envelope/count/state probe; both were supplied without bypasses. It first
suggested a five-path shift-window correspondence prerequisite,then clarified
operation-local windows to avoid whole-block exemptions. No such scope was
approved or implemented. Recommendation hardening tested a stronger alternative:
the producer alreadyhas7buta coarserloop255winsby`??`precedence. Exactsamefunction/
operationboundsWithoutLoops7,boundsWithActualLoop255,bothsourcebounds policies.

Code inspection in the SAME assessment context verifies scoped same-value maxima
and selects **Simplify—choose existing producer correction**. AR74solepacket now
names existingmachine/lower-bounds.ts646lines and existinglower-variable-shift.impl
test385lines only,working680allocations underunchanged700ceilings. Preserve the
existing local guarded??ordinaryanswer,then intersectwiththeexistingselected-loop
maximumforthatvalue. No newexport/signature/fact/producerrecord/aliasengine/
cache/harness/runtime/fixture/oracle/capchange. ExistinglowerVariableShift emitter,
lowerFunction andsemanticfactproducers stayuntouched. Earliernew500shiftowner,
300comparerleaf,newtest,qualifiedunchangedmovement/windowAPIproposal withdrawn.

Existing#129/#131/#127scopechecked;noneownsboundprecedence. Durablyauthorized
[#134](https://github.com/blendsdk/blend65/issues/134) created withactualsource/
producer/PRGhashes and12B/+5nominalcycost. TwoLowByteimages strictlyassemble and
reconcile1640/1712;notatomic-admitted/VICEexecuted. No replacement/codefix observed.
No Gitpush,auth/credentialdiagnostics or protectedfileinspection performed.

The ten final test-only negatives' base review returns no findings,notproduction
re-review or wholephaseclearance. Current5850five-path code/testidentity frozen;
all73priorARsresolved,only74scopepending. Futureselected-loop/asyncproof,Task16
startup,17frontier,18cost/debug and#133scopeexpiry stay separate. 26/40 verified,
14remain(6implementation/8hardening),parent38/48,v4four/ten. No producer/test edit
in the two requested paths,staging,REDcommit,push or phasepromotion before ruling.

### Durable current Original artifact identities

All rows below are actual strict ACME0.97 images,profilePAL/6581,Originalpolicy,
andbind the60unique executedVICEcases. After the readonlybridgeguard,all28fresh
admissions/source/request/home/certificate/PRGidentitiesmatch. PRG counts include
two-byte loadheader. Sourcevariants are exactCOMPOSEDliteral from the newtest,
privateglobal-to-mainlocal substitution,privatevalue255,globalvalue0,mode1,
rows[3,3,3,0,3,3,3,3]earlyreturn,andunchangedSavedfixture. No debugging-injected
sourceglobals. SourceSHA(global/private/value255/value0/mode1/earlyzero/saved):
0144d23b97fcfdfe9ce8dc933c38d1eafceeaaaf148a156d11c1257a4ac2146a /
88c4999af7414fccd4218cbc1e8744108c5a0ab8cb67b342b908bc8f0c4c76ad /
c2f310182e93af4472d78ecf221a012aafacc4df02cab73885b876d37c6938a2 /
431e5d4261648d044ba98c51b1c9bc861c3a898b9596845520fcb9da1fa334dc /
dd0a51b587b70f5dd116a79b240961f2ea38c56c3f8d54eb38408504d2e03b90 /
ba7f72ce5e60b58a0e7608be81ba2264ec9fcb46ebeece74cafe012068351393 /
e2e9cba81ad8559ec86ff0f96376b6e0d76a0f5ef344e88b8e4461a94e6ef5a3.

| Actual source/bounds/layout | PRG bytes | PRG SHA-256 | Assembly SHA-256 |
| --- | ---: | --- | --- |
|global/off/reference|1061|6f756e0201269fef10c7c77d91452299507d769eb6ae3976a65369c1103e5cd9|e8ecad77689d1c5d81e02f9f2a83e04d9a974cddd9ad593eddda93e44bc746c4|
|global/off/selected|970|9be86f7839b644130f52434e8487f413d02eda00ada8eb342dbb914a0a442db1|d4d5d66f9970b09d387cd74c98715b8870a1df9c36c8f75a77d48cf0f5a92c94|
|global/on/reference|1119|b7da1fb5ccf5812dffe9cbc32d85f2e1d16d66e80ae848073076e6d2b409bdf0|60497dd264b100be54bb3f365a8aace7ff7f9c0206f5699ae3f61de35ee5ab26|
|global/on/selected|1028|c40e3dec385934eb0fd15b4d0577dde817b2eb3a4404a6bfd5d4e55a44aff9e8|b3295e2a8e8c96d6d79380e0021aff24830f236d0d7c84dc48cc4c158a0db889|
|private/off/reference|1043|fd7507c8a19f98c50536146a88ac2bbe7cb0c4385221367b525d4e65c78138f2|c8c6499880af9b26310ffa984ec816c6972b019873ddd61174ffa9f44ddce514|
|private/off/selected|952|33fa341fd553f5c882ec2932e56fa3f1ee7d6c1c1f3f45b93256f4d71cc6c3f0|785cbdf116f4033a5622dc94377c51c38b5c6f81300d8bde223677630d151f8e|
|private/on/reference|1101|13631b0466bce0e76ed37cb2d6aeee06acbf6bdfb2369a35560307967cf50d96|86248d1ea15693ef783b1b6c863b9060e021042ebcf28d17e36e46d8dcbe845e|
|private/on/selected|1010|caa731f8e90c5f95e251198116750ab54434ffbe0bdb28743a29abd2fc8053a0|f923af443cce65b9929b37f00e71a22fec439c2c617160973213552cf7f33762|
|value255/off/reference|1043|8f42544085598389d7f0f4cb1b7930f77929918e117b3e89c04c539a85b6487b|a969fcc965ffdb1f61171c924e4a4c070c4907656ddabe97f59c3f338c502be3|
|value255/off/selected|952|9bcd74c30748479744eea4e09496ff82750f4dd2a7fabedb66fc84098d117535|a3846d983347d741e1d20fa1630cf5b390e7f43ba64436ec07cac02839ce9d87|
|value255/on/reference|1101|306c38cfc7273457a1c5c032dec6d688589cacfc100a69c95064ef16bfdd26ba|c27b7526ae8a13f89927271fe9c5262c04473d93cec86faab128be645607ac68|
|value255/on/selected|1010|da98f98d51b84de9a9243b831ea971f93121f522930d8cd9eff0f37b86a183f5|a40a43b03164eb20fad6f0f37118358c7035bb5569bed7305e7f9cec511b43ee|
|value0/off/reference|1059|44799d30265451eaf90160295600021a512f889d1ef482d0888673d735567c64|5dd2494f33282c846de6598a613ed089e90dc42a82c626f0403f2458ebedddb6|
|value0/off/selected|968|8d34f3063c08d0f584412d5a61875766260db576c06618e7af36fc3887ef9abd|5c6e3c5178f63251c24b8a6300395943f1a9d282cdf06c1dfe3e741e7c6b025a|
|value0/on/reference|1117|0e5bac39ffa1c31c5fe48c23207236281dc8e44695d5c8c2174c50eca68236f7|77bfc931de2c70660a92561ce8a6811faffaba545b1778afbab3312636676eaa|
|value0/on/selected|1026|30e79f3280f5475ca084baed81d67693307f4b91faa0dc584b49729f18f8a3f2|1d8aa03dd28a6fc13ce7c3b76c870b0622503d118a1e194426aae4e282eaef4c|
|mode1/off/reference|1063|fbabb492f9ee480adc397bd266c5f3a3a694652e1a913dd2f52e6a2be1effc33|85d30d9002485e3dff34ef1dd8b4956bcdedd48d3e4b777bfe04b62e604e56a4|
|mode1/off/selected|972|4b7dcdf29a2e56b200ca93c077eb6b28c11ecffc7c50bd505afdbd2b04549486|dba151c4acb6347ce8bf07dc3e8bfc31060b39f71ccddd0a5b0d221e6f6d8f1a|
|mode1/on/reference|1121|5869b2554066b94c816ba8567280c328ad640b5f1bc30d058ebaf4317576243a|68edfec4ad52a0a0415a39f6342977db0fe095f2d821b06d6e0a011f63a29722|
|mode1/on/selected|1030|de7fae30f38d661b1d3eaff7ee867e3396b627f39516d9fbc2a4428b751fe047|3cf22e80106397c6229af590761d5569b6f690a18328eefbbc7a1aaf22ecbfb7|
|earlyzero/off/reference|1065|990c1fc1bd55a8849d4dfc85dde1fe4b64a135e3b72458eab35e4386b5ad9ba1|1291f33d160d2be325fce7a5fd76c65a99afca9bd0c0bc2f1cae4583b2000836|
|earlyzero/off/selected|974|f6322a51ba9a80843474ae88fd6032fe19ac47d25e0913cdb538b6a3a846879e|01f2640ef6e179823d77fc6931b82094edfc82f01873fed0fcbb3bad7cc2e999|
|earlyzero/on/reference|1123|dc246b79c2868f0f71aa07e970ef99e249f46e7106d385dee3fe2c5b42c76e2b|3163c81b987c4e1c09e552a3ecfd7128d36cbe306316b1f6272db2d6b52a62d9|
|earlyzero/on/selected|1032|73a6e290d43beb7897e7fec8e461a3a42d01053e20b4a8fcede3eede11f865a2|3c1487f4f0de44aaddbdef2f64f8ad53af7a6607e94dbeaf755f8b24b350a4fe|
|saved/off/reference|2165|0417b7da8c4eabb022e6ec868e0d8dcaf4b4727da83d43e29fcbe98e16a02a93|b298eb955cafe502c10f47c77c55ab4537b896e73ce75eb6b3c143d6df8b4a4f|
|saved/off/selected|1862|f2ef90490bf4a7a229486670e2280fc87aa11f53a4f40838fcb058488e78fa6b|a0398e21cfbec14d35d283b9ca91527ff6971e94dd5bcff6321e5d550630f145|
|saved/on/reference|2245|c4658a9560422c66985f193a8b156d65995eacf97bf9a0bd49007fc019264434|b280ba2005d13d91df9704fb752d4bb124c33b6464aa9dc275611475fde173eb|
|saved/on/selected|1942|d33ae8c99bafdc09f529611888d47bce41974f0ded1b6b66d887aec6d10ee7da|78653aa27bf556d3dd0076c996c62c200bd9a87d39c8e7d3097db3e943a84687|

Savednativevectorrecords(4images×9=36cases):rowsFF×8/joysFF,FF/quality0/key0/port1/
control0→UP,UP;rowsFE,FF×7/joysFF,FF→DOWN,UP;rowsFE×8/joysFE,FF→UP,DOWN;
rowsFC,FC,FF×6/joysFF,FF→UNCERTAIN,UP;rowsFC,FE,FF×6/joysFF,FF→UNCERTAIN,UP;
rowsFF×8/quality1→UNCERTAIN,UNCERTAIN;rowsFE×8/joysFE,FE→UNCERTAIN,UNCERTAIN;
rowsFE×8/joysFE,FF/key255→UNCERTAIN,DOWN;rowsFF×8/joysFF,FE/key0/port2→UP,DOWN.
Unlessoverridden,quality0/key0/port1/control0. EnumDOWN0/UP1/UNCERTAIN2. Rawinput
readsC110–C11AthenC100/C101/C102,outputstoresC103/C104;exactorder/countchecked.
COMPOSED6sources×4images=24cases use independently modelednestedwrites andnormal
initialization;answerzero-rowcase[3,3,3,7,4,4,4,4],otherfinals recordedabove.
InitialrepresentedP0/SP246;mainfallthroughsameSP,fieldentrymainSP−4,callreturns
sameSP/Aexpected/N0/D0/Iunchanged,restoreSP246,SYScontinuationE147SP248/P&CF0.
ActualCPUport/DDR/CIA2DDRAreturnreadbacks equalentry. Not a full-status/IRQ/firmware
stack or timed-bus proof. VICE executableSHAf148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74;
KERNAL83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721,
BASIC89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d,
chargenfd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420.

The test-only10case append base review returns no findings;allfourproduction
files remain unchanged. Current124focused/strict pass;earlierfull3313pass/13known
fail/twoexisting skips precedes ONLYthat append. No newer full-suite count claimed.

The sole AR74assessment first returnsSimplify/NeedsEvidence. Primary supplies
one complete SavedLowByte OFF/ONgroup diff:all4loops/3functions,source-associated
symbolic/actualinstructions/edges andactualrequests/homes/lifetimes. Counter IDs
alone normalized via exactproof IDs; all other opcode/mode/source/state/memory/
origin facts compared. Standard-librarydiff only locates differences,not semantic
proof. No producer/privateexport/guardbypass/fabricatedeffects/syntheticItem/Body.

| Bounds/function | Symbolic/actual blocks before→after | Total instructions before→after | Grouped before→after; equal | Changed instruction occurrences before/after | Normalized edge groups changed |
| --- | --- | --- | --- | --- | ---: |
| OFF/snapshot |35/35→35/35|142→76|142→76;63|79/13|0|
| OFF/key |55/56→56/57|195→129|195→129;117|78/12|1|
| OFF/main |5/5→5/5|83→55|83→55;50|33/5|0|
| ON/snapshot |40/40→40/40|149→83|148→82;67|81/15|0|
| ON/key |60/61→61/62|203→137|202→136;123|79/13|1|
| ON/main |8/8→8/8|87→59|86→58;52|34/6|0|

Every source-associated coordinate occurs once;no duplicates. BoundsONhas one
standaloneSEI/selfhaltperfunction/perlayout (3unchanged perlayout);OFFnone. All
six symbolic→actualfunction bindings pass existingbody() independently. Group
storage17removed/4added perbounds;42same-IDhomechanges,17also lifetimechanges.
Snapshot9removed/2added,key5/1,main3/1. Exactoffcounterhomes:columnRAM4286word→ZP4
byte,other4288word→ZP5byte,keycandidate4284word→ZP6byte,maini4306word→ZP7byte;
old/newlivepositions144/144,144/144,183/183,47/47;callscrossed0,0,2,2. Removed
wordupdate scratchesRAM4296/4294/4300/4302 respectively;parent-next initializer
T69RAM4292wordREMAINS. Same-IDlifetime narrowing includes144→128and183→24positions.

All changes classified:4controlnarrowings (includingCLV ininner/mainheaders),
oneparent-next11→9initializer,5scalarfield9→1reads,5indexed9→2reads,mainrawhighADC
counterhigh→0andtypedstore8→1addressprefix/indirect→absoluteY,2fieldANDuses/3
retained-byte removals,key8andmain2×4argumentcopyomissions,oneBooleanCMP removal,
oneBYTEEOR→CMP/reload removal,andoneUNRELATEDshift-envelope addition. Physical
long/short repairs preserve normalizededges. Existing selected-loop proofreturns
onlyloopIDs; fieldremaining-codecomparator has no counter-view/loop-correspondence
input and strict wholefunctionblockcount. Currentvalidators stillrejectfirst
scalar/five-role gate; primitive responsibilities are not claimed discharge.

Second precise requestedprobe resolves the only normalized-edge delta: keyState
`1<<row` source8565–8573,byteunsignedwidth8,leftliteral1,rightloadrowv15. Exactly
one rowstore8479–8507 from ordinal&7 at8495–8506. Existingordinaryboundundefined,
operation-localordinalBoundsForFunctionguardedbound7,OFF/ON. Actualsource-bound
deliveryeachsideLDAordinal/AND#7/STArow,thenonlyLDAordinal/LSR×3/STAseparatecolumn,
thenLDXsameonebyterow/LDA#1. OFFrowhomes4311/3759,ON4391/3831;columnhomes4324/3760,
4404/3832. No call,transfer or overlappingwrite intervenes.

Reference has empty.same-PClowalias→CPX0/BEQ→ASL/DEX/BNE→DONE. Candidate adds
CPX8/inverseBCC+JMPsaturation plusLDA0/JMPdonearm. Foractualcount0..7,guard's
saturationarm unreachable;CPX0overwritesN/Z/C. AtDONE c0hasA1/X0/N0/Z1/C1;
c1..7hasA1<<c/X0/N0/Z1/C0;V/Y/D/I/Sunchangedboth. LaterLDAresultregeneratesN/Z.
ExistingqueryZEROentryNZCtruebothlayouts/bothbounds;candidateafterCPX8Cfalse
becauseintroducedbranchreadsC,soqueryalonecannotignoreguard. ActualDONEdifference
mask0;query0trueboth,A/Xqueriesfalseboth. No dead-result/ABI/query weakening.
ONenvelopesmatchOFFmodhomes/PCsandordinaryboundscontinuation. Existing shift
predicate hasFIVEparameters,not6;earlierparentprosecorrected, no badinvocation.

The assessment initially proposes a five-path structured shift-window predicate/
remaining-code replacement and260→500shift cap. None approved/implemented. Final
minimum-sufficient reframing discovers a materially smaller real alternative:
ordinalBoundsForFunction withtheSAMEcheckedoperation gives7withselectedLoops[],
but255withactualkeyloopfacts (loop.valueBounds[v15]=255),bothbounds. Current
lower-bounds419–438 prioritizesloop??guarded??ordinary. ExistinglowerVariableShift
alreadyomitsguardwhenmax<8;the producer query merely discarded the stronger fact.

Solecontextcodeinspection verifies jointlyvalid same-value/use-site maxima and
selects **Simplify—producer correction**. AR74nowrequestsONLYexistinglower-bounds.ts
andadditivelower-variable-shift.impl.test.ts,working680/680underunchanged700caps.
Preserveguarded??ordinaryorder;intersectonlywithselectedloopmaximum. No newleaf,
qualifiedmove/export/signature/record/cache/solver/harness/runtime/fixture/oracle.
Allfive-pathwindowmachinery withdrawn BEFOREapproval; no correspondingrepo files
created. This prerequisitedoesnotadmitwholeSavedLowByteoracquisition tuples.

Two extra LowBytecost images strictlyassemble/reconcile1640/1712bytes,NOTatomic-
admitted/VICEexecuted. Actualguard/saturation windows12encodedbytes,+5nominal
reachablecycles,ownnoextraSFA/stack. Existing#129/#131/#127scopes do not own this
precedence defect. Durablyauthorizedoutputdebt issue[#134](https://github.com/blendsdk/blend65/issues/134)
records exact PRG/source/producerhashes,bytewindows,cost/resource/qualification
limits and narrow winpath. Issuecreation is not source/oracle permission; no push.
AR74exacttwo-pathproducer rulingpending. Codefrozen5850deed,producer646/test385
unchanged;no implementation workafterthis materialstop. #133expiry remains.

### Final AR74 ruling boundary and cleanup

Final checks confirm identity `5850deed…` and line counts689/427/848/673/626.
453/457 entry source/test/policy paths are unchanged; the four changed paths are
within the approved observer/test scope. All11 frozen oracles match. There are
74unique ARs:73resolved,only74open. The checklist remains26/40verified,with visible
AR74blocks on15/17/1.3.3. All28durable image rows match the qualified artifact
identities;185local links, targeted formatting and whitespace checks pass.
Frozen specification/expert/policy/portfolio files and the empty index stay unchanged.
The unapproved producer remains646lines atSHA
`2d72a1bf7e05b17293ba32957b35d0f6c13c7fa63493527a8349084c476ed55e`;
its existing test remains385lines. Neither withdrawn new leaf nor test exists.

Cleanup:done—189owned temporary files and three exact owned directories removed.
This includes112Original image files, two LowByte image output sets, logs, derived
helpers/probes and eight previously retained AR72baseline files whose bounded
review purpose is complete. Durable evidence above preserves results and limits.
No user file, symlink, versioned artifact, worktree or other session's content was
removed. All owned processes/reviewers finished; no temporary artifact is retained.
Execution Plan Updated:yes. All repository work is preserved, with no staging,
REDcommit, push or task/phase promotion. The sole next decision is AR74's exact
two-existing-file producer/test correction; no implementation is authorized yet.

### AR74 approved execution —2026-10-29 20:46CET

User **“I approve, continue”** directly approves only the two-existing-file packet.
Before tests/production: branchfeature/v4-rebuild,HEAD1022fd52,emptyindex/frozen
specification confirmed. Producer646lines/SHA2d72a1bf7e05b17293ba32957b35d0f6c13c7fa63493527a8349084c476ed55e;
test385lines/SHAf1f5e6ae71dd75e4f178de44cc20d5a8c5f6bb8a7bdb2ce6f13d44bb71f27197.
Exact before-copies retained in owned temporary directory for bounded review.
Read standards/current source and add meaningful regression REDs before production.
No new file/export/signature/schema/producer-fact/fixture/oracle/movement/cap
change. Existing680working allocations/700ceilings remain. #133expiry and all
selected-loop/async/native/frontier/output gates remain; no task promotion yet.

AR74 regression entry: freshbuild and10oldshiftcases pass. Add only implementation
regressions in the approved existing file. Initial9fail/16pass includes two selector
setup mistakes (a constant indexed-store was counted as a target; the first library
shift was not keyState's row shift) and an incorrect no-guard assumption for a
loop body. Correct only those new setups: exclude store setup operations, locate
the exact `1 << row` source expression, and use a real intervening call for the
induction-only case. No old expectation changes. Second strict run passes;7new
meaningful precedence failures/18passes, with both saved bounds policies observing
255instead of7. This is the RED gate; no setup failure is counted as semantic RED.

Before production, capture42real construction tuples (Saved/acquisition/independent
2048-value shift-grid source, both bounds, canonicalnone/ClosedOriginal/five selected
policies), including actual assembly, labels, inventory and certificate identities.
All references/Original outcomes and existing rejection reasons recorded, not
silently admitted. No ACME/VICE claim from this baseline capture.

Implemented20:53CET: one function-local maximumAt preserves guarded??ordinary and
combines only its same-value selected-loop maximum, returning the smaller valid
answer. Both existing shift/index call sites reuse it. No fact, barrier, width,
semantic operation, emitter, signature or downstream owner changed. Task15 stays
partial/verification pending;26/40. Format/capacity before green verification.

Formatted producer652/test541 then strict/build/25cases pass. Complete additive
coverage for inclusive0/7/8/255masks, neither-fact word reloads, unsafe global
reloads, and already captured immutable values across a real call. The last test
reorders only the actual IR call between an existing load and its consumer to
test immutable-value semantics; it does not claim a new checked-source receipt.
All old helpers/assertions remain unchanged. Finaltest585/680,producer652/680;
strict and32cases pass. ProductionSHA
`e0becc8bab3033939cd6e79b54a47b79e0a08cc0086f62e98abd384774c17a48`,testSHA
`ee28b179c60aab3ed284efac94a8706438a5b73bc1180847a6d3905aba377139`.

Fresh42-tuple comparison: canonicalnone,ClosedOriginal and allreferences retain
exact assembly/inventory/certificate identities. All42atomicobserver outcomes/
rejection reasons unchanged. Acquisition and initial shift-grid selected artifacts
also unchanged. Saved selected5policies×bothbounds shrink:LowByte1640→1625OFF,
1712→1700ON;X-first/FlatX1552→1540OFF,1576→1564ON;Y-first/FlatY1634→1622OFF,
1674→1662ON. Inventory identities/resource totals unchanged; relocated homes alter
certificate addresses as expected. LowByteOFFwins12guardbytes plus3branch-repair
bytes,not a15byte shift-onlyclaim. Exact ACME/branch/cycle/resource qualification due.

Affected consumers inspected: lowerFunction operation map→shift emission and
aggregate-place selection; register-forwarding mask/count windows and fixed-counter
register selection also read the query. No consumer edit. Freshinstall/build/
typecheck/directed/boundary/fullchecks run under the sole execution owner; no VICE
overlap with that command. Code frozen for bounded independent reviews.

### AR74 final bounded verification

Final corrected QA run:124sequentialVICE3.10cases pass206.11s,with no emulator
overlap. These are112unchangedSaved cases (none/Original/five selected×bothbounds×
eight isolated keys) plus12explicitly interrupt-masked QA grids. The earlier112
Saved successes followed by the IRQ-enabled grid trace failure remain recorded;
that failed grid is not counted as passed or erased. FourteenSavedimagehashes
are unchanged by the QA context correction; exactly12temporarygridimages change.

Saved vectors use row0..7,column=(row×3)&7,rowsFFexceptoneclearedrowbit atcolumn,
joysFF/FF,quality0,key=column×8+row,port1/control0. Independent enumexpectation
DOWN0/UP1. All14inputRAMread and2outputstore identities/order/count,snapshotbytes,
returnedA/N/callSP pass. Eighty changed-kernel cases checkactualentry A1/Xrow/
SPmain−2 and actualDONE A1<<row/X0/N0/Z1/C1iffrow0,Y/VDI/SPunchanged. Other32Saved
cases are unchanged canonical/Original controls,not additional changed kernels.

Each grid normally initializes counts[0..7],thenrow0..7/value0..255loops. Inside
the value loop, count=counts[row]&7 is recomputed before left shift and an independent
other=counts[row]&7 before right shift; this avoids silently carrying a reload
assumption across rawstores. Left results goC000–C7FF,rightC800–CFFF. Right source
is eitherbyte(value)>>other orbyte(sbyte(byte(value))>>other). The explicit leading
asm_sei owns onlythisQAwindow; ordinary startupreturn restores the capturedstatus.
All12×4096=49152bytes match independentinteger models;fourRAMsentinelstorechecks
andnamedIOsilence are not a complete grid bus trace. OutputSHAunsigned
`d0a49c1e1ec81c5eb6b244703b7259bc7102b7121b39b75496c6425963fe37b6`,signed
`0e22999bba901600d8b2ce8d7a389d7cd20c45234b57a9f5d7bfe799ff3374f4`.

| QA grid/bounds/policy | Actual PRG bytes | Actual PRG SHA-256 |
| --- | ---: | --- |
|unsigned/OFF/LowByte|1023|66f397a6ffbcb61c7b31fb768117e39129ebad8ce74189f8521b249a9bba7f45|
|unsigned/OFF/X-first,Y-first|1098|3dd448b2408d3d5d2c5b560050cc3a1381bbbb99add3a5475b9942c96b0257ae|
|unsigned/ON/LowByte|1059|816072ee8af308f110f5fc4d001216174cc5f766673ef800ceb291f10bf0085c|
|unsigned/ON/X-first,Y-first|1138|b4eeb730a1a4acba4f7cadf02331a5c4e22d08e21235e99d85de3c20c6042d2e|
|signed/OFF/LowByte|1025|0e1acc831070775ae41e8bb9982134a11e4d53bd1ef02ec2ccfe79d5c117025c|
|signed/OFF/X-first,Y-first|1100|8ffe7919107b2c04a22fca75e365b11c03834deb2a58276bf979482659bdabd8|
|signed/ON/LowByte|1061|f0a677e307151b00b590aff41160d9681765b336bd079d1a479ca8b07837bf2a|
|signed/ON/X-first,Y-first|1140|12fa26146b5584ae0bad30980d2d1b879b97b759e96d32d3cfb773cff8df5a01|

NativeledgerSHA`3c7cb81524351ab5b711e3c34089db7b6ed5f6149bfd13e3affcfe6c11633096`;
final26imageledgerSHA`1c9322e675d24d8217b444375f6f572d3ebef64d1a6e6592da00c2a8fdb778de`.
PinnedVICEexecutable/ROMidentities match the durable earlier exact hashes. Actual
resources PALVICII0/SID0/CIAmodels0/KERNALrev3. All124incomingP0/SP246/AXY0;
atrestoreSP246;BASIC E147SP248/AXY0/P20or30hex withP&CF0. ReadbacksCPUport/DDR/
CIA2DDRA equalentry; their exact numeric bytevalues were not retained,so no latch/
shadow-state claim. Representedstatus only,notfullstatus/IRQ/firmwarearrivalproof.

All26actual layoutintervals and everycertificatehome byteextent are disjointfrom
their explicitQARAMwindows;maxordinaryhomeSaved4429($114D),grid3269($0CC5).
GridmainfirstinstructionSEIverified;SavedmainhasnonewIRQmask. No globals/assets/
functionstorage overlap is inferred merely from resource totals. This is selected
cooperativePAL/6581 RAM ownership,not generalfreeRAM or silicon authority.

Target-platform and machine-code SAMEcontext factual requests close withno
findings after suppliedbytes/runtime/placement. Six distinct bounded initial
reviews nowcomplete(base,SFA,semantics,machine,platform,hostperformance),no fix
review or thirdpassneeded. Hostreview finds O(Q)extraquerywork,2Htransientresolver
containers plusoneclosure,unchangedCFGwalk/memoization;allocation elimination and
controlledhostregressionratios remainunmeasured. No newcache/framework justified.
Knowledge lineage stays2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15.

Finalsourceguards:703/705entrysource/testpathsunchanged;exactold385-linetestbody
andoldhelpers byte-identical after removingfournewimports/newappend. Priorfivefield
paths remain5850deed,producer652/test585,current hashesrecordedabove. No frozen
authority/specification/oracle/policy/portfolio/index change. AR74boundedremedy
verified;#134remainsopen,no outwardissue disposition. Publicsize/963/725,selected-
loop/asyncproof,Task16–18,#133expiryand13unfinishedfulltestfailures remain. No
Task15/phase/RDpromotion,staging,REDcommit orpush;progress26/40,parent38/48.

### AR75 non-executable continuation packet

The same independent design context resumes after AR74 removes the shift
discrepancy. It requests only the outer snapshotCompatible LowByte state witness,
then the generated caller/status-restore inventory. No composition code is written.

Actual outer counter0..8/high0,body0..7: reference initialization LDA0/STAlo/LDA0/
STAhi becomes LDA0/STAzp4,architecture difference0. Word test LDAlo/CMP8/LDAhi/
SBC0 becomes LDAzp4/CMP8: possible A/Vdifference33,withN/Z/CequalunderordinaryD0.
Word update's11instructions becomeINCzp4: use unchanged conservativeA/N/Z/C/Vmask55.
Exact defaultqueryreturnA/X/N remains. OFFreference all three masks pass; selected
comparison/update failV. The real feasible V-preserving path is sourceblocks
b14→b19→b23→b34→b15→b13→b14; noVread/definitionorJSRalongit. BoundsONalsoexposes
the exactSEI/self-JMPbounds-stopcycle,so referencecomparison nowfailsVtoo. No
filtered graph, empty return duties, fake complete effects or dropped bit is used.
These failures require state closure,not merely an instruction-coordinate map.

Whole generated caller inventory includes startup plusfivefunctions:OFFreference
766instructions/140blocks,selected540/140;ON785/153and559/153. SixJSRsallresolve;
all structuredtargetsresolve. The only Vread/statuscapture is startup.entryPHP
index3PC2070,before selectedexecution,thenPLA/STAstatusindex5PC2072. No later
PHP/BRK/BVC/BVS/RTIinthisgeneratedset. SavedPslotOFFreference4229/selected3689,
ON4309/3764;onlydirectresolvedwriteisentrycapture,onlylaterdirectreadrestore.
Actualrestoreloads savedS/TXS,loadsEARLYsavedP/PHA,loadsA/X/Y,PLPthenRTS. OFFPLP
PC4210/3670,ON4290/3745. No post-PLPflagreaderbefore externalreturn. Indirect
alias/status-slot immutability and existing external-profile premises remain
separate final obligations; this scan doesnotinventory arbitraryfirmwareIRQcode.
Two probe-formatting mistakes were corrected (CPUfactfieldusesFlags;startuplabel
has no colon);neither is a semantic failure or meaningfulRED.

The assessment rejects a standalone state API: it has no acceptance-producing
consumer and would not explain the field matcher. Its minimal coherent target is
all four Saved LowByte loops/threefunctions together,OFF/ON. Parent provides an
exact non-executable ownership draft,not another broad runtimeprobe. The independent
challenge retains that partition but requires explicit handoffs: conservative
continuation cuts, removed-demand identities, complete decoded access semantics,
mandatory delegated load/consumer routes, fresh-Item coordinate rebinding and
corrected capacity arithmetic. Privatefield-parentwritesisnotanavailableexport.

AR75consolidates those corrections in its sole eight-path packet:five new files,
three existing integrations,five named internal exports;exactqualifiedmask/stateSafe
movement and existingmachineSuccessorsreuse. No newgeneralcomparer/state-onlyAPI,
receiptregistry,cache,producerfact,queryrelaxation,runtime,dependency,fixture,
oracleamendment or ceilingincrease. Strictunchanged stays in its present owner.
The optional result cannot publishloops/boundsbeforetheir existing induction/
physicalpremisesclose;fieldconsumerpendingpairs must close exactlyonce on a
mandatory route before atomic success. StoreA/X/N/Zduties are not delegated to
the movedY/C/Vpredicate. Decoderfetch/pointer/dummy/data accesses stay distinct.

The documented capacities are planning allocations,not a fit claim. First
qualify the unchanged helper/binding reuse,then meaningful REDs,normal formatted
fit and full bounded proof/qualification. Any missing closure or overflow stops
for redesign,not compression or silent expansion. The endpoint is TWO real
atomic Saved LowByte closures,not just helper tests. Native-register/async/startup/
frontier/cost-debug/#133 and original963/725gates remain separate. All five new
paths are confirmed absent;no proposedsource/API/movement is implemented.

AR75is the sole open material item and visiblyblocks15/17/1.3.3. AR74remains
verified within its bounded scope;sourceonlydiffsinceentryisstill its652/585two
paths,withold385linetestbodyexactandfield5850unchanged. The fulltest13knownfails
remain;no REDcheckpoint exception,staging,commit,push or progresspromotion.

Final AR75 boundary checks pass:75unique ARs/74resolved/75soleopen,40tasks/26verified
and15/17/1.3.3visiblyblocked. 703/705entrysource/testpathsunchanged;onlyAR74'sexact
producer/testpair differs,within652/585lines,withtheold385linetestbodypreserved.
All11immutableoracles,185local links,targetedformatting andwhitespacepass. Allfive
proposedsource/testpathsremainabsent;no qualifiedhelpermovement/wrapperreuse/new
metadatafield is implemented. Frozenexpert/spec/policy/portfolio/indexunchanged.

Cleanup:done—156ownedtemporaryfiles andtwoexactowneddirectoriesremoved after
the durable result/probe/contract records andfinalartifacthashchecks. This includes
all104currentimagefiles,logs,derivedhelpers,baselines and both design probes.
No userfile,symlink,versionedartifact,worktree orother-session content removed.
All execution/review/assessment processes finished;no evidence artifact is retained.
Execution Plan Updated:yes. Await only the exactAR75scope ruling;no REDcommit/push.

### AR75 approved execution —2026-10-30 08:53CET

User **“i approve”** directly approves the sole exact eight-path packet before
source/test edits. Confirm branchfeature/v4-rebuild/HEAD1022fd52,emptyindex/frozen
specification. Entryeffects694/SHA2928eb7183f96b77743c38ad37d0f2dd6cc964e7f5189ddfdc949291d4ef78ba;
rawlayout521/SHA cab5e6f9102a3b28f8c85c1a1041b513d7d3714204723a98ac3ce41369976f43;
correspondence848/SHA be2960f747fadb035d40144f9148891419c6c464eb9f8e2e84c84fb8097ec850.
Allfiveproposedpaths absent;705source/testhashes and exactthreebeforecopies retained
for this unit's equivalence/scope checks. First qualify the exactstatehelpermove
andtargets→machineSuccessorsreuse without admission extension. Then meaningful
new REDs, bounded implementation and normal formatted fit. No gate/cap/oracle/
producer/query/fixture exception beyond the packet. Task15partial,26/40;#133expiry
still binds before15close/17or1.3.3advance. No staging/REDcommit/push.

AR75 step1 implemented: move onlymask/stateSafe andnestedclosures into the approved
sharedstatefile with publicdocumentation;fieldmatcher importsit. Replace only
private targets with existingmachineSuccessorsalias. No new composition function,
resultfield, admission or oldexpectation change. Token/body equivalence,normalfit,
strict/build/typecheck and existing observer/boundary checks precede extension.

Relocation gate passes: canonical-formatted initializer text is byte-identical
before/after for maskSHAfade60941fbeaecae647f34fd8fc8beb97e99431234c518d41b7db59195766bd
andstateSafeSHA7d753358f40b85b261400b38ebd3d02ff290d400ecca835a7a48eceb9dfa9451.
The installed TypeScript namespace lacks the attempted ScriptTarget API; use the
existingPrettierTypeScriptparser for identicalinitializertext,withno dependency
change. Firststrictcheck detects now-unusedMachineBlockimport;removeonlythat
part of the targets signature reuse. Freshstrict/build/typecheck pass,836existing
observer/layout cases and45boundaries pass. Fitsstate107/200,correspondence755/850,
effects683/700. No admission extension. New SavedLowByte group tests now require
the real4proofs/3functions/parent-next/reference/Original-positivepreconditions
before testing atomiccomplete,so a missing/setup failure cannot count as RED.

Two meaningful atomic REDs confirmed:both unchangedSavedLowByteconstructions fail
only the oldselectedeligibility guard after all4proofs/3function/parent-next/
reference/Original controls pass. Add the approved two proof concerns and optional
residual handoff. First formatted sizesoccurrences576/700,composition684/700;
no capacityoverflow or extra exports. Fix only unused new imports and a strict
optional-value guard before integration verification. New group is separate from
unchangedlegacyvalidation;no completeeffects object is fabricated. No targetcode/
producer/query/oldexpectation changes. Sourcecountercontrols,localoccurrences,
completebusenvelopes,mandatoryfieldroutes and state/root checks remain under test.

First native driver completes112Saved-source cases,including80changed-window
entry/DONE register/flag checks,then stops on the first long-grid trace assertion.
All4096gridbytes already match independent shift expectations. Extra CIA1portA
stores during ordinary enabled stockKERNAL IRQ scanning invalidate the probe's
assumption that a long pure-source grid would produce no device trace. This is
not evidence of a bound-producer miscompile or new source restriction. Do not
count the grid as passed or silently discard its unexpected device events.

Give ONLYthe separate temporary QA grid an explicit existingasm_sei operation
before the long loop. It owns that finite diagnostic window,charges1byte/2nominal
cycles,and ordinary startupreturn restores capturedP;the realSaved source and
all repository code/tests stay unchanged. Reassemble/reconcile the altered grid
and replay the full set sequentially,with incremental result preservation. The
new represented grid context is I=1duringbody,not an I=0no-device claim; Saved
remains the unchanged normalIRQ-enabled context. This corrects QA observation
scope,not a protected behavior oracle. No new runtime/helper/API/firmware guarantee.

Fresh checks complete: install0.37s/build2.18s/typecheck1.79s pass;232directed
tests7files107.14s and45boundaries2.49s pass. Fullyarn test452.66s remainsRED:
compiler3345passed/13same frontier-cost failures/twoexisting skips;CLI62,
language-server21,VSCode6pass;rootnotreached. No new failure/skip. All32shiftcases
pass within that full run. No GREEN commit/push or task promotion.

Bounded base/SFA/machine-code/semantics initial reviews return no findings.
SFA and semantics request only exact authority metadata/headings; supply the five
current release fields (stop before next heading) and selected normative excerpts
in their SAMEcontexts. Requests close without new review pass or hidden access.
Expert2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15 staysfrozen;governing
BLEND65-SPEC-4-038b70e9/MOS-PGM-1976/ACME-097-R266,finalSFAclosureandoperation-use
scope. A primary heading grep incidentally surfaced historical semantics metadata;
it was excluded from conclusions and no evaluator case answers were loaded.
Host-performance/platform initial reviews are pending. No missing-role waiver.

Current26images strictly assemble withACME0.97/6510/strictsegments/cbm and fully
reconcile through existingverifyAcmeOutput with the real layout/listing/symbols.
14Savedimages(none/Original/five selected×bothbounds),12independentunsigned/signed
gridimages(three selected×bothbounds×twoflavors). ImageledgerSHA
`02dc531b393c895216a645af5dff77cc7d35aa08ee6e4f0a1f1986f66b9a9708`.
All10changed Saved shift windows have actualbytes`E000F0040ACAD0FC`; both suffix
branches are same-page before/after. Machine auditor independently decodes these
supplied bytes and closes the local-cost request:20→8bytes,zero count10→5cycles,
count1..7`7c+8→7c+3`. This is local nominalCPUcost,notelapsed/deadline/globaldominance.
LowByteOFFextra3bytes are the exactkeyStateb32condition-selected long→shortrepair;
its path-cycle change remains Task18-owned,not folded into the5cyclelocal claim.

| Bounds/policy | PRG bytes | PRG SHA-256 | Static function RAM/ZP |
| --- | ---: | --- | --- |
|OFF/LowByte|1625|c5f58c286b66423b6a41156cf8c5b8c438bcfd60d548e4741132783cc7bdd00e|35/6|
|OFF/X-first andFlatX|1540|70491ad22dc6c57dff3ffbe8a9002c4a6c4287357ba46c0e0bf0c1dd298de797|33/2|
|OFF/Y-first andFlatY|1622|6fe6707b611b6ebb0f87e438724b6995766ace2f85e6e39644cb622207cff70b|37/4|
|ON/LowByte|1700|3f658e91d5cb0be72f1c3f7f06b9ef841af4a7911e9c9532e62a09702dbcf04c|35/6|
|ON/X-first andFlatX|1564|b341eee865c74061b5d4f0ba1847405b0d5e2dc3766389b8cb4b3a02afdbf677|33/2|
|ON/Y-first andFlatY|1662|245d97b694a1ab85d160b327e0c890407a1ca477ad84476c70a32835f5d9911a|37/4|

Counts include2load-headerbytes;FlatX/Y retain separate construction/outcome checks
despite identical image hashes. Generatedprogramstack4/ownedsystem0 and inventories
unchanged;externalSYS/firmware/IRQ bounds remainUnknown. Globaldata/startupstate/
padding are separate fromfunctionframe totals and remain counted in actual PRGs.
Canonicalnone/OriginalfreshPRGhashes match the prior durable fourSaved rows exactly.
After full tests finish, start only the sequential pinnedVICEdriver; no competing
emulator. Runtime results remain pending, not implied by ACME or hash equality.

### AR76 stopped incomplete-proof review —2026-10-30

The preceding assembly/runtime paragraphs are AR74history,not AR75qualification.
AR75remains unfinished with two atomicadmissionREDs. Reachability/aggregate-address
diagnostics correct the new synchronous guard to inspect5reachablefunctions,not
all7semantic library functions, and to retain legitimate whole-aggregate
place-address operations. No escaped counter address or source workaround is
accepted. Main scalar field stores stay with strict remaining-code comparison.

Newdraftstate logic addresses the mainstore's outgoingY:the oldcallee-entryquery
can reject a dormantYcycle in a byte-shift kernel. The unchanged sharedpredicate
is still a fast proof. A decoded construction-wide block-local Ydefinition-before-
read condition is used only at an actual terminalcut,with exactearlyYcapture/
rootrestore and resolvedcalls;itdoesnotclearC,relaxqueries,orclaimnonterminal
suffixes safe. These are draft checks,not separately qualified state logic.

CurrentOFFadmission reaches`Composed access envelope is incomplete`;ONstill
reaches`Composed main indexed store disagrees`. A returns no loop/bound result.
The ONsource-span collector can include an exactsharedSEIstop from anotherblock;
the required correction is uniqueactualtyped-STAsink+same-blockwindow,not pruning
the stop or treating allsame-spaninstructions as one window. No such fix after
the review. Complete busdomains for every reference typed indirectreader are
not yet proved;source root metadata does not replace actualpointervalueproof.

SFA initialreview ses_e73b689a5ffeGivL38iMZmi7ty returnsSF-001MAJORincomplete-proof
blocker,recorded asAR75-SF-001. Currentrejectioncorrect,no unsafeallocation or
atomicacceptanceescape demonstrated. Analyticalwrongformal$DC0D/page-one examples
explain why a broadread envelope is not harmlessnessproof;they were not executed.
Laterfield rejection cannot retroactivelyestablish an early advertisedpremise.
No ordinaryLDAis falselyclaimed tocaptureliveV ormodifyS.

Its one requestedread-onlyguardprobe confirms post-snapshotrows[column]9184–9205/
v46:guardedundefined,ordinaryundefined,CONDITIONALselectedLoopBound255,fallback255
withcurrentemptycallguards. Earliercolumnv17andcandidatev65fallback7. Sameboth
bounds; no completeeffects,induction discharge or validator bypass manufactured.
SFA closes the factualrequest and identifies the exactcross-call/private-home/
interference/raw/async/useidentity preconditions;no secondseverityfinding.

The same independent design context ses_e77b2d92bffeH70onDZLP9iLFs hardens the
necessaryruling: **Justified—bounded completion within AR75**. Proveactualformal/
staging/root-pointer/arithmetic/Ydomains for every reader,including reachable
non-counterfunctions,using onlyexistingpublicprimitives/existingpayload. Complete
the exactpostcallbound under genuinehelperpreconditions and fixthestorewindow.
No additionalfile/export/contract/payload/cap decision is demonstrablyunavoidable,
butno fit is promised. If prooforreadablefit fails,stopforexactredesignauthority.

Implementation stops pending the sole AR76accept-and-complete ruling. AR75approval
and user interruption/continue messages do not resolve this MAJORfinding. The
findings ledger will receive a disposition only after the authorized ruling.
15/17/1.3.3blocked;26/40,parent38/48,v4four/ten;#133expiry stillbinding.

StoppedsourceSHAcomposition9ce724b0378aace0b9357fffdbd4d753f61d47fc386eca28dac31387b21ac742,
occurrences07aa860de6af9060291415340766477fe1a63ff8683d154b5bd9364e54b4014e,
state8562c6869553f0947bd6953e9e9ead8315a86253c5d8ede184b4ce7ae6bbc279,
effects3e3877d0592088b9732866bea458b21506ee7df89a5a6af809e7a30466ef28ea,
raw23e9a6f1b24b53bbd6038de873c4a224ff4da7706c125bafe7e5e9c2c2950fe8,
correspondencecd86de4863f48b7d21e229471ac2d93a8e29ddf9396756557ffac589ff7acb62,
test918510f84f0a2de9c0e8258c1157fd682a30ee30febbb2def2b6730101e14927.
Sizes692/573/107/688/524/849/29; the occurrence-testfile is notcreated.
Read-only formatter measurementwould makeoccurrences577,stillwithin700,but
source is frozen unchanged for the ruling. No sourceformatting/edit afterreview.

AR76directruling recorded12:11CET: userselected **“Accept and complete”** on the
sole native question. AcceptAR75-SF-001forcorrectionunderunchangedAR75authority,
notwaiver or fit promise. Ledgeraccepted;onefix-only SFA re-review after correction.
Stoppedsourcehashes preserved untilthisruling. Freshstrict/build/typecheck pass;
current19observer/layoutfiles836oldpasses/twoexpectedadmissionfailures and45
boundariespass. No new old-case failure/skip. Resume onlybounded correction;
extrafile/export/payload/helpercontract/cap changes still require an exact stop.

### AR77 first normal read-proof capacity stop

Under acceptedAR76 only, add private incomingPointer andtypedReadInputs inside
the approved occurrence owner. They attempt actual const-global formal/staging
copies, live homes/transitive interference/overwrites, pointer arithmetic/carry/Y
and complete envelopes. No new export/resultproperty/owner outsideAR75. Replace
the store's source-span tail selection with the real typed-STAsink and same-block
prefix;guards/stops remain in strict remaining-code comparison. Guard completion
is still pending and unresolved input ranges continue to reject.

FIRSTnormalPrettierresult is942/700 inoccurrences,stoppedSHA
`9dab8dbe95585cb8f4920c0f7fba73bb8b8d57a37f13434d58929619299ddfcf`.
Mandatorycapacitystop: no compression, removed checks, extra API/file, borrowed
capacity, strict/build/test/native qualification or further source edit after
that measurement. The new helpers are unqualified drafts,not proven facts. All
other stopped source identities remain as recorded above. AR75-SF-001 stays
accepted/unresolved;the last completed verification remainsstrict/build/typecheck,
836oldcases/twoadmissionREDs and45boundaries BEFOREthispointerdraft.

Same independent contextses_e77b2d92bffeH70onDZLP9iLFs inspects the measured
obstruction and recommends **Simplify—one read-proof leaf,one new export**.
It rejects an unnecessary secondresidentlookup export:reuseexistingpublic
findNamedObjectBacking afterglobal-owner/fixedaggregate-type checks,while retaining
all separatepointer-valueproof. The private same-block/contiguous dependency is
explicitly included,not another sharedutilityexport. No futureproofing/parallel
verifier/newgeneral solver/receipt mechanism is proposed.

AR77exactamendment:oneadditional600line sourceowner,original8paths→9;newnamed
exports5→6. MoveonlynewunqualifiedincomingPointer/typedReadInputs responsibility,
replaceunqualifiedresidentwithpublicbackinglookup;no otherqualifiedmovement.
AddexplicitconditionalcallGuards onexistingLowByteFunctionChanges and seed only
theexistingoriginalCallGuardschannel aftersuccessfulcomposition,withownership/
duplicate/conflict checks andallcross-callphysicalpreconditions. No induction/raw
authorityfromthoseguards. Coverallreachableactualreadercontexts,notonlycounter
owners,using the existingfunctionmap. Oldceilings/fixtures/oracles/producers/
queries/expectations andthetwoplannedtestpaths stay unchanged. Firstmeasure
extraction/reuse-onlyfit,then guard completion;anynewoverflow stopsagain.

The addedowner/export/resultfield/integration are NOTimplemented. Bothproposal
fit andpointer/guardcorrectness remainunverified. SoleAR77rulingpending;15/17/
1.3.3visiblyblocked,26/40,parent38/48,v4four/ten. No staging,REDcommit,push or
phasepromotion;#133expiryandallrelease/native/resourcegates remainbinding.

AR77boundary guards pass:702/705entrysource/testpathsunchanged outside the exact
threeapproved existing owners;fourapproved new paths exist. All11oracles and185
local links match;77uniqueARs/76resolved/77soleopen,40tasks/26verified andthree
visibleAR77blocks. Bstays942/SHA9dab8dbe,the addedreadowner/occurrencetest/newexport/
callGuardsproperty are absent. No sourceedit orqualification afteroverflow.
Frozenexpert/spec/policy/portfolio/indexunchanged;targeteddocformat/whitespacepass.

Before-image retention:the accepted-findingB573beforecopy is reconstructed ONLY
in ownedtemp by reverting thissession's ownpointer insertion/store-windowdelta;
its exactSHA07aa860de6af9060291415340766477fe1a63ff8683d154b5bd9364e54b4014e
matches the frozen review identity. Other sixfix-beforecopies match their recorded
stoppedhashes directly. This preserves an exactfix-reviewdelta,not a guessed
historicaloracle comparison. OriginalAR75threebeforecopies/sourcehashmapretained.

Cleanup:39owneddisposablelogs/probes/loaders removed;11exactbaselinefiles remain
under `/tmp/opencode/codeops/runtime-10bcd0c1-4211-41e0-a079-c0c7c79057ea/ar75-lowbyte-uruu8b1p/`:
three `entry-size-observer-*.ts` copies, `entry-source-hashes.json`, and seven
`ar76-before-size-observer-*.ts` copies. They must outlive this unfinished unit
for its originalscope and singlefix-onlySFAreview;deletewhen that purpose ends.
No userfile/versionedartifact/worktree/symlink/other-sessioncontent removed.
All ownedprocesses/reviewers finished. Execution Plan Updated:yes;no commit/push.

### AR77 approved extraction —2026-10-30 13:01CET

User **“approved”** directly approves the sole exact nine-path/six-export amendment.
Before source edits confirm942/692/688entries, BexactSHA9dab8dbe and absentnewowner;
branchfeature/v4-rebuild/HEAD1022fd52,indexempty/specfrozen. Exactthreebeforecopies
retained;priorAR75/AR76reviewbaselinesstillpresent. Firstextractnewunqualified
readerproof and reusepublicbackinglookup,then normalfit before guard extension.
No extraexport/resulttype/producer/query/fixture/oracle/oldceilingauthority.

Extraction/reuse-only implemented before guard extension:move incomingPointer/
typedReadInputs into the new owner with a private contiguous check and the one
approved publicwrapper. Replace resident lookup with publicfindNamedObjectBacking
underfixedglobaltype checks. The new conditionalguard field is present but no
guard is asserted before its proof;unresolvedreadinputs still reject. No producer,
query,fixture,oldtest or qualifiedhelper change. Normalfit precedes verification.

ExtractionfirstfitB604/700,newleaf400/600;strict/buildpass. All-reader coverage
usesexistingfunctionmap,includingzero-counterbodies;effectsseedhasownershipand
duplicatechecks,normalfitA690/700,effects700/700. BothadmissiontestsremainRED
attypedindexedpointerarithmetic,notaccepted. Boundedprivateguardproofnowdrafted
usingexistingguardedanalysisunderboth-layoutprivatehome/liveness/callee-write
checks;normalfitmustpassbeforestrict/build/test. SF001remainsunresolved.

Firstguarddraft577/600strict/buildpassbutadmissionsstillREDat9184(max65535).
Read-onlyhomeprobeconfirmsselectedcolumnissealedliveacrosssnapshotCompatible,
notlaterterminalsoleGroundSource:thelatercalleeparameterlegallyreusesitsbyte.
UseunchangedvalidLocalStorageLifetimeforselectedoccupancy,andfulloccupancyfor
reference;onlycrossedcallsneedcalleeinterference.Nonliveactualparameterdelivery
isnotaguard-preservationfailure. Correctednormalfit599/600andstrictpass;still
REDbecausescalarparameterswereoverconservativelyunstableandlosttheearlierkey
guardbeforecolumnconstruction. Permitprivateunexposedscalarparametersunder
thesamehomechecks;nextfit/testdue. Nofactormovement,query/producer/oracleedit.

Boundedindependentdesignchallengeofguardclosureisrunning(noSFAfixreviewconsumed).
Addonlyapprovedoccurrence-testpath:realpositivecomponentpreconditionsforfour
snapshotCompatible/fivezero-counterjoystickreads,andtwo-layoutformal/stage/carry/Y/
read-opcodefaults.Negativequalificationandallremainingtestsremainpending.

Fourcomponenttestsnowpass(including12faultiterations),strictpass;45boundaries
and11oraclehashespass. Previous599-lineguarddraftpasses822oldobservercases
(17files);firstforeground120stimeoutisnotcountedasapass. Entryconservation
remains702/705unchanged,exactthreeapprovedexistingpaths;indexempty/specfrozen.

Independentchallenge(ses_e732e7be8ffecLEvBepZ9JgW5m,xhighroutingdefault)recommends
replacingbothblanketoverlapandwritevetoeswithauthenticatedoccupancy,notbuying
capacitybeforemeasuring. One-shotprobeconfirmsordinal8338selectedsealed/covered,
nocrossedcalls,andthreecallerlocalsharerswithdisjointlives/nointerferenceedge;
column8510sealed/covered/crosses8669only. UseexistingcoveredBindingRequests/
machineStorageAccessesandcontent-authenticatedfinalinterferencegraph,retaining
fullfallbackall-callcoverageandactualraw-writechecks. Removetheduplicatelocal
callauthlooponly:groupentriesstillchecksALLactualcalls/entriesbeforepublishing
conditionalfacts. Readablefit/strict/admissionpending;SF001andfullscopeunresolved.

### AR78 first-fit stop —2026-10-30

Firstnormalformatoflifetime-awarereplacementis608/600,SHA256
`0cb4a72a640c09c88cb85c3ff4b5fe97a8043a34d4878dd0c48df02e12269d40`.
Stopimmediatelybeforestrict/build/tests;donotcompress,removechecks,movequalified
codeorborrowotherownercapacity.AR78open;independentchallengeofexactremedydue.
The822casebackgroundrunfinishedat13:49:31whilecontinuationwasdraftingthe
replacement;nosingle-sourceidentitywasfrozenforthatrun. Itisold-casepreservation
evidenceonly,notqualificationof608. Thefourcomponent/45boundarychecksandstrict
passesprecededthereplacement. Nocurrentdraftqualified;noACME/VICErun.

Independentcapacitychallengecomplete:samecontextrecommendsoneprivateaccessInput
helperforthreeidenticaldecoderinputconstructions,notaceilingincrease.Analytical
reduction11lines→approximately597/600,notmeasured;correctness/fitstillUnknown.
ItalsofindslifetimeidentityalonecannotdistinguishfailedcoveredBindingRequests
(originalrequestreturned)fromsuccess(freshrequestreturned). Requirefreshrequest
ANDsamelifetime,andaddtheapprovedoccurrence-pathcoveragefailuretest.AR78exact
two-pathrulingrecorded;directuserapprovalpending,nosourceeditafter608stop.
Scope/caps/oracles/#133expiry unchanged;finalSFAfix-onlyreviewstillunconsumed.
Cleanupremoved29ownedscratch/logs;retainthreeAR77entrybeforeimagesplus11prior
AR75/AR76baselinesonlyfortheunfinishedunit/finalfixreview.

#### Session 1.3 — Logic tests, hardening and one full checkpoint

### AR81 approved qualification —2026-10-31 20:03CET

User **“i approve”** directly approves the exact600→614read-ownerexception.
Confirm614/SHA25a6bed9/indexempty/specfrozen before qualification;no production
sourceeditneeded. Runfreshstrict/build/typecheck/twooverwriteREDsandpositive
admissions,thenremainingauthorizedpointernegatives/oldcases/artifacttransfer/
nativeandfinalfix-onlySFAreview. Allothercaps/elevenpaths/sixexports/oracles/
#133expiry unchanged;26/40,nocommit/push/taskpromotion.

Preserved614draftfreshstrict/build/typecheckpass;all18currentcomponent/admission
casespass,includingBOTHpreviouslive-formaloverwriteREDs. No productionsourceedit.
Completeonlyapprovedoccurrence-testnegatives:low/highbyte,actualRMW/indexedwrites,
descendantcalleeoverwrite,unknowntargetindirectwriter,andinterveningcallerJSR.
Retainpositiveactualreader/geometrypreconditions;unknownwriter/suffixmustfail
atthepointer-inputboundary,notbypassdecoderuncertainty. Newtestsdrafted;normal
700testfit/strict/directedverificationnext,source614hashstays25a6bed9.

Newtest528/700andstrictpass;18pass/twoNEWsetupfailures:unknown-indirectfault
wasplacedbeforethefirstreader,andthereadclassselectorcorrectlyrejectedthe
non-LDAindirectsetupbeforeincomingPointer. Donotchangeproductionorexpectation;
locatethenewunknownwriterAFTERthefirstrealread,sothefull-lifetimepointerproof
mustcatchitbeforeanylaterdereference. Thisretainsitsoriginalunproved-pointer
expectationandstrengthensthelifetimewindow;nooldtest/oraclechanged.

Correctedunknownwriterlocationafterfirstread:bothtargetedbounds-policycases
passallthreefaults(descendant/unknown-indirect/caller-JSR),test533/700. Production
614hashunchanged. Freezeall11ownedfilesforfullobserver/shift/layout/boundary
checksandfreshsix-imageACME/120-caseVICErequalificationinseparateAR81tempdir;
oldAR80nativebaselinefilesremainread-only. Finalfix-onlySFAreviewafterevidence.

Final614qualification:strict/build/typecheckpass;897ownedobserver/shift/layout/
ACMEboundarycases(23files)and45rootimportboundariespasswithall11ownedhashesstable.
All20newcomponent/admissioncasesincluded;twooriginaloverwriteREDsandallnewhigh/
RMW/indexed/descendant/unknownwriter/caller-suffixcasesnowpass. Capsread614,
fieldparent700,dispatcher637,occurrences604,composition690,effects700,raw524,
correspondence849,state107,tests218/533 allwithinapprovedlimits.

Fresh614six-imageACMEreconciliationand120sequentialPAL6581VICEcasespass,notonly
a599evidencetransfer. Sixasm/PRG/symbol/resource/inputrecordidentitiesareexactly
unchanged. Thefirstpost-runequalitywrapperincorrectlyrequiredreportbytesidentical
acrossdifferenttempdirectories;nodequalificationitselfexited0with120passes.
Withoutaruntime rerun,verifyeachreportdiffersONLYatitsassertedowned-sourcepath
header;everyremainingreportbyteisidentical.Noopcode/address/symbol/resource
tolerancechanged. ImageledgerSHAdd5985c2662e8b19b7275e64e5dc0fb37d9bdbe1cbea1262ebdf14e0f56d74f5;
freshnativeledgerSHAf21393b1a339d8da56461a0c7633f45c6d95202cd7049333be1c2b48b4d3a5cd.
Allpreviousboundedprofile/state/resource/725limitsandUnknownsremainexplicit.
FreezeproductionandtestsforONEfix-onlySFAre-reviewagainstretainedAR76beforeimages
plusAR79qualified-consumerentries. SF001accepted/unresolvedpendingitsruling;
nootherphase/fullsize/#133expiry/commit/pushgatecleared;26/40.

### Single fix-only SFA re-review — surviving obligation,2026-10-31

OriginalSFAcontextses_e73b689a5ffeGivL38iMZmi7tycompletestheONEfix-onlyre-review.
SF001remainsMAJOR/open:indirectconsumer'soffsetisunchecked(q+1consumesq+1/q+2
whileproofsetupwroteq/q+1);storage()matchesrequest/offsetbutnotaddressingmode,
soindexedformalwordloads/copiescanpasswithoutanX/Ypremise. Overwriteguardsand
decoderrecalculationdonotfixpointer-byteidentity. Laterfieldrejection/outer
provenancepreventclaimingatomicescape,butcannotdischargetheearlierpromisedproof.
Reviewerreportsnoseparatefindingfornewoverwrite/coverage/guard/all-reader/
context/reconciliationchanges. Staticinspectiononly;noqualificationanswerexposure.
AR82recordsneededruling;nosourceeditafterreview. No thirdreviewisautomatically
authorized;existingreviewgates/remainingphasequalificationarenotwaived. Ground
thetwoactualcomponentwitnessesandminimalcorrection/fitbeforepresentingdecision.

Read-onlyparentprobesreproduceBOTHaddressingwitnessesunderBOTHbounds:real
positivecomponent,twoactual/symbolicedits,validbodygeometry;componentstill
returnsobject. Fullatomicmodifiedtuplereturnserror"Finaloutputnolongerbelongs
totheactuallowering/sharedproducers". Noatomicescapeorordinarysourcebugclaim.
No repositorysource/testeditmadeafterreview. A planning-onlyprospectivestring
(notwritten/executed/compiled)addszeroconsumeroffsetandchecksactualunindexed
absolute/zero-pageformsforallstorageoperandsineachprivatewordwindow;normal
Prettiercount619versuscurrent614. Qualifiedstorage()unchanged. Decisionhardening
ofminimalcorrection/authorityisrunning,notanotherSFAreview/clearance.

Fullyarn testfinishesexit1:compiler3365pass/13fail/twoskips(187files),CLI62,
language-server21,VSCode6pass. All13failuresaretheunchangedfrontieroracle:
1rejected-baselinev1costreader,8ordinary32/64sitesacrossfourprofiles,4ordinary
72-functionreturned-paircases. SelectioncasesfailCOMPILER_INCOMPLETE. Rootfull
suiteNOTreached;45directimportboundariesareseparateevidence. No oracle edit,
fullphaseGREEN,taskpromotion,staging,commit orpush.

IndependentAR82decisionhardeningcomplete(NOTthirdSFAreview):allcurrentstorage
copy/arithmeticmatchesfallunderexistingprivatewordwindows;recommendaddactual
unindexedmodeguardtherepluszeroeffective-consumeroffset. Planning-onlyformatted
prospectivetext619;reporoot614unchanged. ExactAR82accept-for-correctionAND614→619
capacityrulingrecorded;userdecisionpending. Qualifiedpublicstorage(),othercaps,
elevenpaths/sixexports remain;nonewhelper/API/movement/solver. Singlefix-only
SFAreviewconsumed;aftercorrection/verificationreturnfindingdispositiontouser,
notautomaticclearance/thirdpass. #133/fullphase/review/963/725gates unchanged.

BeforepresentingAR82,parentalso probes SAMEaddressing invariant at counter
representation:changeonlyactual/symbolicMAINinitialSTAwordcounter+0fromabsolute
toabsolute-X,keepwidth/operands/sourceannotations,andrebindvalidgeometry.
Bothboundsstillreturnacceptedcomposedgroup(counterwordhomes4306/4386). Xisnot
provedzero;thisphysicalinitializationneednotwritetheprovedbyte. Noexecutionor
atomicescapeclaim. Readleaf-onlyfixcannotcloseoccurrenceowner'sseparatestorage
matches. AR82proposalnotyetsubmittedtouser;decisionrefinementrunningforminimal
localcounter/control/tempwordmodecoveragewithinsameelevenpaths. No repository
source/testeditafterreview,noextraSFAreview/clearance.

AR82decisionrefinementrecommendsoccurrence-ownerpreclaimgateforBOTHbodies:
non-address-byte storageoperandsmustuseactualabsolute/zero-pagemodes. Covers
initialization,parent-nexttemps,comparison/update/delegation/store/call/residual
framebyteswithoutchangingpublicstorage(),addinghelperorblanket-rejectingglobal
indexedlabels/indirecttargets/address-byteimmediates. Existingindextemplate
positivewouldrequireSTOP/explicitpremise,notanunprovedexemption. Planning-only
Prettiercount616/700;repositoryoccurrence604unchanged. RefineexactAR82before
presentinguser:twoexistingowners,readcap614→619only,allotherlimitsunchanged.

Pausevalidation:all11frozenproduction/testhashesstillmatchpre-review snapshot;
proposalformat/locallinks/indexempty/frozenauthoritiespass. No source/testedit
afterreview;twoplanning-onlyformattingsdidnotexecute/compileproposedcode.
Remove21owneddisposablelogs/convertedhelpers. Retainfinalnativeimages/ledgers,
sourcehashsnapshotandtwoAR82sourcebeforeimagesonlyforunfinishedverification/
userdisposition;priorreview/nativebaselinesuntouched. Noactiveownedprocess/agent,
no staging/commit/push or taskpromotion;26/40. AR82wasnotyetapprovedatthispause.

### AR82 implementation — exact addressing correction,2026-10-31

Resumedaftercompactiononuser **“continue AR-P82”**. Confirmall11entryhashes,
read614/SHA25a6bed9,occurrence604,indexempty/frozenauthorities/featurebranch.
Newownedtemp`ar82-addressing-oku00zmv`underthesameruntimeroot;priorbaselines
read-only. Drafted ONLY approved existing-test extensions for displaced consumers,
read-prefix words, direct/forwarded delivery, forwarding materialization and both
layouts' counter initialization/comparison/increment/update/parent-next
temporaries; positive actual component/group and valid geometry are preconditions.

Meaningful REDs first: the new occurrence test's displaced-consumer and indexed-word
cases failed on the old source, and the composition cases either accepted the
composed group or refused only through a later pointer proof. The final direct test
now requires the occurrence owner's exact failed-obligation string for every mutated
frame byte.

Production changes are exactly the approved two owners:

| Owner | Lines | SHA-256 | Change |
| --- | ---: | --- | --- |
| read-input | 619/619 | `c67e28cf3b43e3cb672c5b256f4409596a12d9f10b561438953729bd5b78f68e` | private word-window storage modes must be actual absolute/zero-page; typed consumer offset must be zero |
| occurrence | 617/700 | `d4616aedb6f28aa0977beac3bf04098d009580477d1f4797c6d5a8a015728334` | reject non-address-byte symbolic frame data in either body unless actual absolute/zero-page, before any claim |

Public `storage()`, all other ceilings, eleven paths, six exports, oracles,
fixtures, producers and queries are unchanged. New tests: occurrence 687/700,
composition 375/700. Fresh strict pass; directed 24/24 pass (both bounds and both
layouts, including all prior component/admission cases).

**Final bounded verification, 2026-10-31 23:42CET:**

- Fresh strict/build/typecheck pass. Only the read owner, occurrence owner and the
  two approved test files changed from the AR81 snapshot; the other seven owned
  paths are byte-identical. The 705-entry conservation still reports exactly the
  five previously approved consumers changed; all 11 oracle hashes are exact;
  index empty and `spec/`/expert authority unchanged.
- Full owned suite **901/901** tests across 23 files and **45/45** root import
  boundaries pass. The two new addressing cases are meaningful REDs on the prior
  source and GREEN here.
- Fresh six strict ACME 0.97 images and **120 sequential VICE 3.10 cases**
  (PAL/6581) pass. Image ledger SHA `dd5985c2…` is exactly the 614 baseline; all
  six `.asm`/`.prg`/`.sym`/resource records are byte-identical; every report byte
  is identical except the asserted temporary source-path header.
- The fresh native ledger differs from the 614 baseline in exactly five
  `atRestore.p` observations, each by only bit 5 (`0x20`), the non-architectural
  represented/unused bit that the harness already masks in its restored-status
  check. Incoming registers, restored A/X/Y/S/P (masked), expected enums, all 27
  ordered RAM events, snapshot bytes, named CIA silence, stack balance and
  resources are identical in all 120 cases. Re-running the same byte-identical
  image with the full tracepoint setup twice produced the baseline P value, so
  the bit is not a stable architectural result and the compiler change cannot
  explain it. Fresh native ledger SHA `c1a5c4cb…`; no behavioral/failing
  assertion changed.
**User disposition, 2026-10-31:** the user directly selected **“Accept as fixed”**
for AR75-SF-001. The finding is fixed for this bounded composed-LowByte
pointer/read seam only; the findings ledger row is updated. The ONE fix-only SFA
re-review remains consumed and was not relabelled. No task promotion follows:
the separate #133 remedy-scope ruling is still required before task 1.2.15 can
close or tasks 1.2.17/1.3.3 advance. Full phase/963/725/native
hardware/whole-program claims remain open. No commit or push.

### AR82 approved — compaction handoff,2026-10-31 21:57CET

User **“i approve”** directly approves the sole exact AR82 packet,thenasks
**“should we compact first?”**. Yes:pausehere,beforeimplementation,afterrecording
authority. No new testsorproductionedits have started. Noactiveownedprocess/agent.

**Resume without asking approval again:**

1. ReadcurrentAR82exactrulingandthishandoff. Verifycurrentreadowner614/SHA
   `25a6bed990b0b85dd90e93342b63369912bfab320e364c55728f20438f32f0d5`,
   occurrenceowner604;all11frozen-sourcehashesareinretainedAR81temp
   `final-source-hashes.json`. Both sourcebeforeimagesare`before-ar82-*.ts`there.
2. Establish meaningful NEW addressing negatives in existing approved tests:
   nonzeroindirect-consumeroffset,indexedformal/forwarding/read-prefixwordcopies,
   indexedcounterinitialization/comparison/update/parent-nexttemporaries. Keep
   positiveactualreader/groupandvalidgeometrypreconditions;existing533/218-line
   occurrence/compositiontestceilings700each remain. Read-onlyprobesalreadyshow
   component/groupacceptanceunderbothbounds;fullatomicmutationsfailprovenance.
3. Implement EXACTLY two owned-source changes:readleafprivatewordwindowrequires
   actualabsolute/zero-pageforallstorageoperands,andtypedconsumerrequiresoffset0;
   occurrenceownerbeforeANYclaimsrejectsnon-address-byte symbolicstorage DATA
   referencesinEITHERbodyunlessactualmodeabsolute/zero-page. Address-byte
   immediates/globallabelindexing/indirect-yretainseparateproofs;publicstorage()
   unchanged. No newhelper/export/API/producer/query/oracle/fixture/surface.
4. ActualnormalformatfitFIRST:readcap619(prospectivememory-onlycount619),
   occurrencecap700(prospectivecount616). Othercaps/elevenpaths/sixexports unchanged.
   Stoponoverfloworlegitimatepositivewithanunprovedindexedframepremise;doNOT
   removechecks,borrowcapacityorsilentlyexemptthecase.
5. Freshstrict/build/typecheck,allnew/oldownedtests/import/oracleguards,actual
   artifacts/nativeidentityandaffectedqualification. UseaNEWtempoutputdirectory;
   doNOT overwrite retained pre-fixnativebaselines.
6. The ONEfix-onlySFAre-review is CONSUMED and did NOTclearSF001. Decisionhardening
   isnotathirdreview. Aftercorrection/verification,presentevidencefortheUSER's
   surviving-findingdisposition;no automaticfindingclearance/thirdagentpass.
   Fullphasequalitygatesremain;#133remedy-scopeexpirybefore15close/17or1.3.3advance.

**Latest bounded evidence:**897owned/45boundaryandfresh6strictACME/120sequential
PAL6581VICEcasespassforcurrent614code;allnativeunknowns/725deficitremain. Full
yarn test:compiler3365pass/13unfinishedfrontierfail/twoskips;CLI62/LS21/VSCode6
pass;rootfullsuitenotreached. Progress26/40,parent38/48,v4four/ten. NoREDcommit/push.

**Retained evidence/baselines**under
`/tmp/opencode/codeops/runtime-10bcd0c1-4211-41e0-a079-c0c7c79057ea/`:
`ar75-lowbyte-uruu8b1p`originalunit/AR76beforeimages;
`ar77-read-inputs-fletg9os`AR77entries;
`ar78-dedup-wpb_do8e`AR78entries;
`ar79-consumers-qc5milzo`qualifiedconsumerentries;
`ar80-selector-iq18w88u`AR80entries/pre-live-formal-fix599nativebaseline;
`ar81-formal-3oxiv7p4`614nativebaseline/sourcehashes/AR82beforeimages.
Disposablelogs/convertedhelpersremoved;retaintheseONLYfortheunfinishedproof/
verification/disposition,andcleanupwhenpurposeends. No unrelated/userfilesremoved.

### AR80 approved selector extraction —2026-10-30 23:56CET

User **“I approve”** directly approves the exact local entryLoads extraction.
Before edits confirm704/SHA c5683022,indexempty/specfrozen;retainbeforeimage.
Replace onlyduplicateentry-loadfilters,preservepredicate/order/actualinstruction
selection/separatearrays andallmissing/duplicatechecks. Dispatcher637unchanged.
Normalfitfirst,thenselectoridentity/negativeandAR79qualification. Elevenpaths/
sixexports,700cap/allotherlimits/#133expiry andnoREDcommit/pushremain;26/40.

Exactselector extractionimplementedwithpublicpredicateunchanged;nootherAR79
conditionormergechange. Firstnormalfitprecedesallqualification.

AR80normalfit700/700,SHAcd931f248cdbb0d6168a434018871df4323f556abe2f1d97c7b05828ad0cf01d.
Selectorpredicatesmatchtokens/orderinbotholdcopies;allbytesoutsidetheexact
extractionareunchanged. Freshstrictpass;BOTHactualSavedatomicadmissionsPASS.
No taskpromotion:AR79negative/native/resource/finalSFAqualificationstilldue.
Addonlyapprovednewcomposition-testcases:missing/partial/stalegroup,LowBytecache/
mixedclasses,missing/duplicateentryloadsineitherlayout,actualdirect-mainidentical
removalsversusconflictingclaim,andprocessor-statusobservation. Positiveactual
component/group/atomicpreconditionspreventunrelatedrejectionsfromcounting.
Testsimplemented;normaltestfitandfreshstrict/directedverificationnext.

2026-10-31:all16newcomponent/compositioncasespass,test218/700,strictpass. Fresh
build/typecheckandall838observercases(19files)passwithall11ownedfilehashesstable.
No task/phasepromotion;negativepointer/storagequalificationandnative/reviewdue.
Firstnativepreparationreconciles3OFFimagesbeforeanextraexplicit-placementsample
hitsitsEXISTINGseparateobserverboundary. NoVICEcaseexecuted;notamachinefailure.
CorrectonlythisnewQAsetup:qualifytheunchangedSavedsourcein6none/Original/LowByte
images(bothbounds),retainexplicitplacementasrejectedboundary,nopagecrossruntime
claim. Originalfixtures/oraclesandproductionunchanged;independent20vectoranswers
andfullRAM/IOtrace/statechecksremain. Nativepreparation/runrestartingsequentially.

CompleteapprovedpointernegativesbeforefinalSFAfixreview:Addrealcomponenttestfor
anactualSTAoverwritingtheliveincomingformalafteritscorrecttwo-bytedelivery.
Keepgeometry/sourceassociation/optionalannotations,andrequirepositivebaseline
beforethemutation. ThisisacceptedSF001'srequiredintervening-overwriteobligation,
notnewproductscope. Newtestunverified;productionfrozenwhilecurrentnativeimagesrun.

Overwrite-negativeverification:bothboundsreachrealpositivepointercomponent,
unchangedgeometry/twoactualedits,andthenincorrectlyreturncompletecomponentdata.
MeaningfulRED2cases;test348/700. Noatomicacceptanceescape/source miscompile shown;
acceptedSF001stillunresolved. Independentdesignchallengeofsmallestactualwrite
closureisrunning;thisisNOTthefinalfix-onlySFAreview. Productionunchanged.

### Bounded AR79/80 native evidence —2026-10-31

SixactualACME0.97strict-segmentimagesreconcileallCPUbytes/labels/segments/PRG.
120sequentialpinnedVICE3.10casespass:none/ClosedOriginal/LowByte×bothbounds×20
independentSavedvectors. SourceSHA
`e2e9cba81ad8559ec86ff0f96376b6e0d76a0f5ef344e88b8e4461a94e6ef5a3`.
Nooriginalsourcechange. Additionalexplicitplacementsampleremainsrejectedbyits
existingfinalobserverboundary;no page-cross runtime qualification is claimed.

| Private image | Loaded payload bytes (excludes2-bytePRGheader) | Physical general/ZP union | Function static RAM/ZP | Function peak RAM/ZP | Generated call-stack bytes | Actual PRG SHA256 |
| --- | ---: | --- | --- | --- | ---: | --- |
| none/OFF |2163|2301/10|66/10|66/10|4|`0417b7da8c4eabb022e6ec868e0d8dcaf4b4727da83d43e29fcbe98e16a02a93`|
| Original/OFF |1860|1979/8|49/8|49/8|4|`f2ef90490bf4a7a229486670e2280fc87aa11f53a4f40838fcb058488e78fa6b`|
| LowByte/OFF |1623|1726/6|35/6|33/6|4|`c5f58c286b66423b6a41156cf8c5b8c438bcfd60d548e4741132783cc7bdd00e`|
| none/ON |2243|2381/10|66/10|66/10|4|`c4658a9560422c66985f193a8b156d65995eacf97bf9a0bd49007fc019264434`|
| Original/ON |1940|2059/8|49/8|49/8|4|`d33ae8c99bafdc09f529611888d47bce41974f0ded1b6b66d887aec6d10ee7da`|
| LowByte/ON |1698|1801/6|35/6|33/6|4|`3f658e91d5cb0be72f1c3f7f06b9ef841af4a7911e9c9532e62a09702dbcf04c`|

Physicalunionincludesloaded/unloadedplatform/global/functionintervalswithout
aliasdoublecounting,notjustSFA. BSS68/70/72bytesarecharged,notassertedzero.
Everyplacedinterval/everycertificatehomeisdisjointfromC100–C11AQAinputs/outputs.
Observercallleavesassembly/inventory/certificatebytesidenticalwithin eachtuple.
LowByteversusClosedOriginalsaves237/242loadedbytes,253/258physicalgeneralbytes,
14staticfunctionRAMbytesand2ZP;generatedcallstackunchanged4. Theseareexisting
selectedartifacts newly admittedbyboundedobservers,notnewemissionoptimization,
expertparityor725-bytefit:LowBytepayload1623/1698stillfails725. No historical
before-image/C100amendment/helper-relocationUnknownisclearedbythisrun.

Vectors:released,8isolatedrow/columncontacts,invalidkeys64/255,invalidport3,
invalidcontrol5,quality1/2/255,floating2×2ghost,incompatibleoverlap,onegrounded
PBrowandonegroundedPAcolumn. Independentenumanswerscheckbothports;thisisnot
theparent'scomplete64-key/all-controlqualification. Eachcasechecks27ordered
traceevents:14inputreads,11source-snapshotstores,2outputstores;noadditional
load/storeat32namedCIAregisters. Snapshot11bytesexact;call-stackSPatrestore246;
incomingAXY0/P0/SP246andBASIC E147AXY0/P30hex/SP248,P&CFrestored. Onlyrepresented
statusobserved,notarbitraryincomingflag/registerclasses. CPUport/latchvalues,
allbusfetch/dummy/stackeventsandwholewalltimewerenotmeasuredbythisprobe.

ProfilePAL/6581only,VICII0/SID0/CIAmodels0/KERNALrev3;onepinnedruntime/ROMidentity.
ThehostdisabledCIA1IRQs/stoppedtimersONLYintheQAobservationwindow;noSEIaddedto
Savedsource. NoexternalIRQ/NMIarrival/firmware/revision/silicon guarantee.
Status:**VICE-verified / hardware-unverified**forthelistedobservations;complete
pointer-proofqualificationremainsblockedbythetwointernaloverwriteREDs.
ImageledgerSHA`dd5985c2662e8b19b7275e64e5dc0fb37d9bdbe1cbea1262ebdf14e0f56d74f5`;
nativeledgerSHA`9d054314784090fcb6365b0d4b382170de5bf573ec48a171e65885d6bfa34623`.
Lineage2.0.4/content0e2a6280ddf77e42252b7a50b85cf9ea3d732b15;
MOS-PGM-1976/MOS-6510-1982/ACME-097-R266/VICE-310-SOURCE governingexactCPU/tool
observations. No fullphase/publicsize/963/725/whole-cost/SFAreviewclearance.

### Accepted SF001 live-formal completion —2026-10-31 00:24CET

NativeownerfinishedandclosedallownedVICEprocesses;releaseproductionfreezeonly
now. Independentchallengeconfirmsmissingduring-calleewritescaninvalidateactual
pointercontentsdespitecorrectdelivery/declarationseparation. Smallestcompletion:
reuseexistingactive-ownertraversal,actualbodybinding/accessInput/NMOSdecoder;
rejectunavailablewriterenvelopeorwriteoverlapeitherformalbyteacrossreaderand
transitivecallees. FullfunctionoccupancyallowsNOwriteexemption. Keepallsource/
async/helper/call/entryexclusionsandstrictcaller-suffixdecoderunchanged.
Implementedonlyinsideapprovedreadowner;shareitsownunqualifieddata-writerlist
betweenexisting scalarcheckandnewformalcheck. Nonewexport/API/result/owner,
qualifiedmovement orcapauthority. Saveexact599beforeimage. Normalfitbeforeany
furtherqualification;SF001stillunresolveduntilREDs/remainingproof/reviewclear.

### AR81 first-fit stop —2026-10-31

Firstnormalformattedlive-formalcompletionis614/600,SHA
`25a6bed990b0b85dd90e93342b63369912bfab320e364c55728f20438f32f0d5`.
Stopbeforestrict/build/tests/native/finalSFAreview. No further source edit,
compression,checkremoval,borrowedcapacityornewhelper/export. AR81open;
independentmeasured-remedychallengedue. Prior599native/hostresultsareboundedto
theiractualsource/artifacts,notqualified614. Test348/700withtwooverwriteREDs.

IndependentAR81capacitychallengecomplete:recommendONLYreadowner600→614,preserve
exact614draft. Measured599+18+2−5=614;sharedwriterlistalreadyused. No demonstrated
readable14-linesavingwithoutmixingformal/scalar/suffixpoliciesoraddingabstraction.
Nofile/export/API/movement/solver/othercapauthorityorreserve. ExactAR81ruling
recorded;userdecisionpending. No further sourceedit/qualification;finalfix-only
SFAreviewunconsumed. SF001/#133expiryandallothergatesremain.
Conservation700/705entrypathsunchanged,exactfiveapprovedexistingpaths,all11oracle
hashes/indexempty/frozenauthoritiespass. Removed18disposablelogs/convertedhelpers.
Retain28nativeevidencefiles+3exactAR80reviewbaselinesintheAR80tempdirectory for
unfinishedreview/byte-transferchecks;doNOToverwritepre-fixnativebaselineimages
onfuturequalification. Prior18reviewbaselinefilesremainuntouched.

### AR79 approved integration —2026-10-30 23:36CET

User **“I approve”** directly approves the exacttwo-consumerpacket before edits.
Confirm626/689entryhashes,indexempty/specfrozen;retainbothbeforeimagesandnewtest
beforeimage. Dispatcherkeepssharedsource/reference/synchronouschecks,Original
behavior/cache-onlyrestriction;LowByteoriginal-fieldrecipe requiresactualgroup,
source-functionrecordandexactclosedloopset. Parentretainsentryquery,permitsonly
actualsame-source/before/aftergroup plusunchangedstateSafeatbothinverse-storecuts.
Parentmergesonlyidenticalcontext-validatedcomposedMAINdeliveryremovals;allother
duplicates/conflictingclaimsreject. Implementationrecorded;normalformattedfit
MUSTprecedestrict/build/tests. Both700caps,elevenpaths/sixexports andalloracles/
native/review/#133expiry gatesremain;26/40,nocommit/push/promotion.

### AR80 first-fit stop —2026-10-30

FirstnormallyformattedAR79integration:dispatcher637/700,SHA
`54dec7eb99601e8e258a556c75dfc2653ccdbe10e766dac0fe07563d5a2fb9c7`;
fieldparent704/700,SHA
`c56830228b5a777a5b2b2a922ff8462264816d9118231d23fcd57fd79d0a5ac8`.
Stopimmediatelybeforestrict/build/tests;nofurthersourceedit,checkremoval,
compression,capacityborrowingorqualifiedhelpermovement. AR80open;independent
smallest-remedychallengepending. PriorAR78qualificationdoesnotapplytothisdraft.

IndependentAR80challengecomplete:samecontextrecommendsonefunction-localentryLoads
selector replacingonlyidenticalbefore/afterfilters287–304. Allfourselector
predicates/order/actualinstructionlookup,independentarrays andmissing/duplicate
checksremain. Analytical18→14savesfourlines→700/700,notmeasured;noreservepromise.
Thisisqualifiedsame-ownerrewriteoutsideAR79'snamedregions;exactAR80authority
pending. Dispatcher637andparent704remainunchanged;nofurtherqualification.
No additionalfile/export/movement/payload/cap/oracleauthority. Allothergatesstay.
Pausevalidationpassesdocformat/links,stoppedhashes,emptyindex/frozenauthorities
and700/705unchangedentrypaths(exactfiveexistingpathsapproved). Cleanuptwodisposable
files;retainonlytwoAR79consumerbeforeimagesfortheunfinishedreview.

### AR78 approved correction —2026-10-30 21:48CET

User **“i approve”** directly approves the sole exact private-deduplication/
successful-coverage-check packet. Before edits confirm608/SHA0cb4a72a,indexempty,
specfrozen;retain exactreadowner/testbeforeimages. ImplementonlyprivateaccessInput,
threeunchangeddecoderinputreplacements,freshcoveredrequestandsamelifetimecheck,
andtheapprovedoccurrence-testnegative. Normalfitbeforecompilerqualification.
600/ninepaths/sixexports andallothercaps/oracles/gatesunchanged;26/40,noREDcommit/push.

PrivateaccessInputdedupimplementedwithoutchangingcoverageacceptanceyet. Addtwo
boundspolicytestswithpositiveexactpost-callguard7precondition;eachmutatesonly
selectedcolumnloadsourceassociation(missing/ambiguous),retainingthesamesealed
lifetime/actualgeometry. FirstnormalfitthenmeaningfulREDbeforecoveragefix.

Dedupnormalfit595/600,test270/700. MeaningfulRED:bothnewboundspolicytestsreach
realguard7andthenincorrectlyacceptmissingANDambiguouscoverageassociations;
fourpreviouscomponenttestspass. NowimplementonlyfreshcoveredrequestPLUSsame
lifetimecheck,withdurablewhycomment. Normalfitthenstrict/build/typecheckand
allnewcomponent/admissionchecksnext.Nooldexpectation/oraclechange.

Coveragefixnormalfit596/600,test270;freshstrict/build/typecheckpass.Sixcomponent
testspass,bothadmissionsadvancepastguardclosurebutrejectat"Typedpointerreadhas
noexactsourceconsumer". One-shotactualinstructionprobeidentifiessoleoffender:
referenceSTA302withtypedstoreorigin(mainrowsassignment),notanadditionalreader.
Keepitscompleteenvelope(includingdummyread)intheexistingoccurrencestoreowner;
readleafskipsstoreorigins,notarbitrarynon-LDAreads. No decoderroleisexempted.
ThisisremainingAR75/76/77read-versus-storeownershipcompletionwithinsamecaps;
normalfitandadmissionrecheckdue. Noproducer/query/export/oracleedit.

### AR79 final-dispatch scope stop —2026-10-30

Read/storeownershipcompletionnormallyfits599/600,SHA
`fb39ab12f0b15e5c6c22fc085be00619a150fcd585d85f301f91a701f529292b`.
BothatomicSavedLowByteadmissionsnowrejectat"Complementcacheneedsbothsynchronous
Originalconstructions". Existingunmodifiedsize-observer-byte-complements.ts604
requiresoriginalpolicybeforeline621fieldparentdispatch. Thatqualifiedconsumer
isNOToneofAR75/77'snineapprovedpaths;donoteditit,forgeoriginalpolicy,skipthe
consumerorweakenoracles. AR79recordsnecessaryintegration-scopeblocker;independent
smallest-remedychallengeanddirectrulingdue. Noqualificationscopeexpanded.

AR78current599identityfreshstrict/build/typecheckpass;all828observer/component
cases(18files)passwithpre/postsourcehashidentity,plus45boundaries,11oraclehashes
and702/705entryconservation. BothatomicadmissionsremainexpectedREDatdispatch;
noACME/VICE/finalSFArevieworwhole-phaseGREENclaimed.

AR79independentchallengecomplete:twoexistingconsumersrequired,notdispatcheronly.
Dispatcher626/700andfieldparent689/700unchanged. Probesusingrealresidualeffects
closefourloops/fivefunctionrecords;directfieldvalidationrejectsentryaddressing.
ActualSavedreferencecut21querytrue/selectedcut5queryfalse;unchangedstateSafetrue
onbothcutsunderbothbounds. A realapplicabledirect-main two-loop fieldshape with
retainedscalarargumentproducesfouractualdeliverykeysincontext-validatedgroup/
correspondenceremovals;theparentwouldindependentlyadd/rejectthesamekeysatmerge.
Themergeitselfwasnotexecutedpastentrygate. Firstone-arg
probeisearlierbounded-suffixrejection,notpositiveaccountingevidence.
ExactAR79eleven-path/six-exporttwo-consumeramendmentrecorded;userdecisionpending.
Both700capsremain;11-lineparentcapacityisnotmeasuredfit. Noqualifiedconsumeredit,
helpermovement/newAPI/cap/oraclewaiver. SF001/#133expiryandremaininggatesstay.

Finalpausevalidation:599andbothproposedconsumerhashesunchanged;targetedformat,
129locallinks,emptyindex/frozenauthoritiespass. Remove20owneddisposablefiles;
retainonlytwoAR78entrybaselinesalongside14priorbaselinefilesfortheunfinished
unit/finalfixreview. Noactiveownedprocess/reviewer,nocommit/push/taskpromotion.



- [ ] 1.3.1 Add fact/lifetime/induction invalidation logic tests — adjacent `closed-object-facts.impl.test.ts`, `local-storage-lifetimes.impl.test.ts`, `fixed-loop-facts.impl.test.ts`; 03-01.
- [ ] 1.3.2 Add byte/exit/loop counterexample logic tests — adjacent `byte-value-availability.impl.test.ts`, AR-P18 `byte-value-availability.complement.impl.test.ts`, AR-P19 `byte-value-availability.boolean-exits.impl.test.ts`, `fixed-loop-selection.impl.test.ts`, AR-P21 `fixed-loop-selection.counters.impl.test.ts`; 03-02. Existing early tests do not complete this task.
- [ ] 1.3.3 Add final-observer/reference-outcome/fixed-frontier/permutation/scaling logic tests — adjacent `size-observers.impl.test.ts`, `size-selection.impl.test.ts`, AR-P33's moved CPU, AR-P36's residual-effects, AR-P38's loop and AR-P42/AR-P44/AR-P45/AR-P46/AR-P47/AR-P48/AR-P50/AR-P51/AR-P53/AR-P54/AR-P55/AR-P56/AR-P57/AR-P58/AR-P59/AR-P60/AR-P61/AR-P62/AR-P63/AR-P64/AR-P65/AR-P66/AR-P67/AR-P68/AR-P70's transport/window/selected-loop/guarded-use/call/internal-shift/return/layout-association concerns; 03-03, ST-21–ST-24/ST-29–ST-30. (AR-P82/SF001 and AR-P84 closed; #133 tracked by AR-P83; task may advance.) Existing partial cases do not complete this task.
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
