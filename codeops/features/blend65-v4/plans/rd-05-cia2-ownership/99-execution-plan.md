# Execution plan: CIA2 ownership

> **Status**: Complete — bounded CIA2 slice qualified; local green checkpoint only
> **Implements**: blend65-v4/RD-05
> **Created**: 2026-10-06 20:06 CEST
> **Progress**: 20/20 tasks (100%)
> **Last Updated**: 2026-10-07 18:22 CEST
> **CodeOps Artifact Schema**: 1

## Implementation Phases

The checkbox lists below are the only task-progress owner. Mark `[~]` immediately
after implementation and `[x]` only after verification; update the header at the
same time. Resume the first incomplete task. Record blockers at their task and
in the ambiguity register, not a second state store. Current batch effort is
xhigh, explicitly confirmed for the full CIA2 batch; state advice without
repeating effort-confirmation pauses. Commit only coherent GREEN checkpoints
through the git-commit skill. Never push automatically.

| Phase | Sessions | Tasks | Boundary                                                               |
| ----- | -------- | ----- | ---------------------------------------------------------------------- |
| 1     | 1.1–1.3  | 20    | Existing exclusive CIA2 proof, direct output and bounded qualification |

## Phase 1 — CIA2 ownership

> **Phase baseline tree**: c4ede1bc5ac1568637257b3f51cb6d1411e4ba84
> **Scope mode**: strict

**Risk:** critical device/concurrency/SFA boundary; strict authorized scope.
**Baseline/modification set:** snapshot before first task under exec-plan. Targets
below include direct consumers and focused tests, plus this plan/roadmap and a
small public CIA2 ownership note. Spec/expert and all unauthorized old oracles
are excluded. No generic pass, runtime manager, schema or harness.

### 1.1 — Independent specification tests

- [x] 1.1.1 [spec-author] Write public admission/ownership cases in `test/rd05/cia2-ownership.spec.test.ts` and the two exact AR-P3 fixture changes; ST-1/ST-3/ST-5–ST-9. ✅ (implemented: 2026-10-06 20:40; verified: 2026-10-06 20:48; 744 new cases: 632 expected RED and 112 justified prepasses; both exact old fixtures remain 56/56 GREEN; lifecycle/provenance/storage split; formatting and oracle diff pass)
- [x] 1.1.2 [spec-author] Write independent actual-byte/output cases in `test/rd05/cia2-output.spec.test.ts`; ST-2/ST-4/ST-10/ST-13. ✅ (implemented: 2026-10-06 21:08; verified: 2026-10-07 00:08; AR-P5 exact correction applied; 52 cases: 44 intended E10245 RED, eight unaffected controls GREEN; formatting and frozen-authority checks pass; oracle frozen)
- [x] 1.1.3 [spec-author] Write sequential CIA2 timer cases in `test/rd05/cia2-vice.spec.test.ts` using the current binary fixture. Define independent RESTORE/STOP and instruction-boundary cases before production for the existing GDB/text-monitor qualification in 1.3.3; ST-11/ST-12. No new monitor API or harness. ✅ (implemented: 2026-10-07 00:12; verified: 2026-10-07 00:20; twelve canonical E10245 RED cases, no prepasses or plumbing errors; source/artifact identity and native scenarios frozen; actual VICE/tool qualification still pending)
- [x] 1.1.4 Verify expected RED and document unchanged/pre-existing passes; directed new tests and existing CIA/NMI source controls. No production before RED. ✅ (implemented: 2026-10-07 00:20; verified: 2026-10-07 00:21; 952 cases: 688 canonical guard RED, 120 justified new prepasses and 144 existing controls GREEN; no unexpected failure; source/output/runtime oracles frozen)

### 1.2 — Existing-owner implementation

- [x] 1.2.1 Extend route admission and transfer the CIA2 guard to the proved owner in `semantic/interrupt-routes.ts` and `semantic/cia-ownership.ts`; 03 §Source ownership and finite facts. ✅ (implemented: 2026-10-07 00:22; verified: 2026-10-07 00:24 after wrapper prerequisite; 160 CIA/source/storage/control cases GREEN; build/typecheck/format/documentation pass; exact candidate delegation only; ordered CIA2 integration and full positive qualification remain pending)
- [x] 1.2.2 Add focused device fact types/equality/classification in `semantic/cia2-ownership-facts.ts`; 03 §Source ownership and finite facts. ✅ (implemented: 2026-10-07 00:26; verified: 2026-10-07 00:27; build/typecheck, 112 directed CIA/NMI/storage controls, format and documentation pass; finite physical leases and exact raw mirror/word/ENABL classification; integration and dedicated implementation cases follow)
- [x] 1.2.3 Implement focused source device transitions and release classification in `semantic/cia2-ownership.ts`; 03 §Source ownership and finite facts. Split before 500–700 lines; no second solver. ✅ (implemented/verified: 2026-10-07 00:28; build/typecheck, 112 directed controls, formatting/documentation pass; pure 226-line local transitions and 124-line finite facts; source/context integration and its positive/negative verification remain in 1.2.4)
- [x] 1.2.4 Wire those facts into existing ordered contexts/state equality in `semantic/interrupt-context-proof.ts` and `interrupt-context-facts.ts`, plus existing `interrupt-contexts.ts`/`interrupt-context-walk.ts` only for the proved finite release-variant identity; 03 §Producer-to-consumer transport. Extract a current focused helper only if needed for the file ceiling; no second solver. ✅ (implemented: 2026-10-07 00:36; verified: 2026-10-07 00:41; build/typecheck, 636 new negative cases, 152 source/output controls and 39 existing context cases GREEN; directed filters leave 108 positive cases unrun pending direct lowering/variant consumers; docs/format/frozen pass)
- [x] 1.2.5 Enable proved direct CIA2 lowering and adjacent result forwarding in `machine/lower-c64-cia.ts` and `lower-register-forwarding.ts`; 03 §Direct output. ✅ (implemented: 2026-10-07 00:42; verified: 2026-10-07 00:44; build/typecheck, 148 ownership cases, twenty exact output cases and seventeen existing CIA/wrapper implementation cases GREEN; final shutdown output is deliberately unrun until its producer/consumer steps; docs/format pass)
- [x] 1.2.6 Extend selected exclusive NMI wrapper/placement/stack metadata in `machine/lower-c64-interrupt.ts` and existing `nmi-entry.ts` only where required; 03 §Direct output. ✅ (implemented: 2026-10-07 00:23; verified: 2026-10-07 00:24; brought forward prerequisite; 160 source/storage/control cases, twelve wrapper implementation cases and twelve selected exact output cases GREEN; build/typecheck/format/documentation pass; no nmi-entry.ts edit needed)
- [x] 1.2.7 Transport proved handback by existing emitted source/context plus finite release-variant identity through `machine/lower-platform.ts` and `lower-c64.ts`; extend current `machine/interrupt-specialize.ts` and `lower.ts` selection only where needed. Preserve nested, same-depth and transitive ordinary release-helper calls, per-operation policies and final storage closure. ✅ (implemented: 2026-10-07 00:46; verified: 2026-10-07 00:52; build/typecheck, 68 public lifecycle/storage/output controls and 47 context/wrapper implementation cases GREEN; exact source/context handback flag and direct/finite-target selection; code-only suffix preserves domain/ABI/storage identities; lower.ts reused)
- [x] 1.2.8 Emit the direct preserving shutdown in `machine/lower-c64-interrupt.ts`; 03 §Final CIA2 shutdown. No scratch or lowerer-invented proof. ✅ (implemented: 2026-10-07 00:53; verified: 2026-10-07 09:41; AR-P6 exact reader correction applied; all 52 output cases GREEN; build/typecheck/format/docs/whitespace pass; 38 bytes/56 cycles, ordered volatile effects and no scratch)
- [x] 1.2.9 Verify public directed GREEN, exact old negatives, final storage/private gate and unchanged artifact/publication controls; ST-1–ST-10/ST-13. ✅ (verified: 2026-10-07 09:43; all 940 directed source/output/storage and existing CIA/profile/NMI controls GREEN, zero skips; exact AR-P3/AR-P5/AR-P6 exceptions only; format/docs/frozen checks pass; native proof remains pending)

### 1.3 — Hardening and closeout

- [x] 1.3.1 Add focused device/context implementation tests in `semantic/cia2-ownership.impl.test.ts`; actual caller/handler facts, mirrors, joins, mixed restore contexts and convergence. ✅ (implemented: 2026-10-07 09:46; verified: 2026-10-07 09:48; thirty focused device and actual-context cases GREEN; split cia2-contexts.impl.test.ts keeps concerns under 300 lines; initial internal-result discriminator and unrelated empty-map counts corrected; no spec edit; build/typecheck/docs/format/whitespace pass)
- [x] 1.3.2 Add lowering/forwarding implementation tests in `machine/cia2.impl.test.ts` and existing register-forwarding implementation concern; exact volatile effects, controls, no late scratch and counterexamples. ✅ (implemented: 2026-10-07 09:49; verified: 2026-10-07 09:51; 23 lowering/forwarding implementation cases GREEN; invalid duplicate SSA result in one new internal barrier fixture corrected; no spec change; exact effects/cost/no-scratch and dynamic staging verified; build/typecheck/docs/format pass)
- [x] 1.3.3 Run sequential actual-artifact/native interleaving and resource qualification; binary-fixture CIA2 timers and the existing pinned GDB/text-monitor RESTORE/STOP/boundary mechanism. Bind fresh scripts/input-success checks/instruction boundaries and artifact/tool/model identities in `08-closeout.md`; ST-11/ST-12. Unknown/skipped native cases do not close this task. ✅ (qualification started: 2026-10-07 09:51; verified: 12:53; 568 cases GREEN, zero skips: twelve timers, 528 actual instruction boundaries, sixteen two-entry overlaps, eight no-RESTORE controls and four real BCD/D-state companions; all eight source/build families, 64 artifact hashes and 36 observed model/PRG identities reconcile; complete code/padding/RAM/ZP/stack accounts retained in 08-closeout.md; independent bounded native audit reports no new finding; AR-P9 retains pre-existing TP-003 MAJOR as mandatory R5.4/T-09, not waived; VICE-verified/hardware-unverified, not global startup or RD-05 closeout)
- [x] 1.3.4 After positive qualification, apply only AR-P3's exact ledger retirement and verify its gate; `test/rd04/expressiveness-ledger.json`; ST-14. ✅ (implemented: 2026-10-07 12:53; AR-P10 exact two-case setup correction applied at 14:02; verified: 14:03; all eleven gate cases GREEN, zero skips; whole-file exact exception check, untouched assertion/source fixtures and byte-for-byte other ledger rows pass; code formatting/whitespace pass)
- [x] 1.3.5 Full checkpoint: frozen install, build, typecheck, all owned tests, targeted formatting, links, frozen authority and authorized-oracle diff checks. ✅ (checkpoint started: 2026-10-07 14:03; verified: 14:18; install/build/typecheck and all 4,975 owned tests PASS, two existing compiler skips; root 3,091/3,091 in 157 files; targeted code/forced Markdown formatting, 70 local links, documentation/source-reference checks, unchanged native identity report and exact authorized-oracle/frozen-authority checks pass; prior diagnostic failure retained separately)
- [x] 1.3.6 Complete required independent reviews and any bounded authorized fix/re-review; record `09-phase-review.md`. Correctness, semantics/DX, SFA/ABI, platform, output and host performance responsibilities remain separate. ✅ (prior correction implemented 16:43; AR-P12 CPU-return correction implemented 17:42, verified 2026-10-07 18:06 CEST; independent RED then 108 public/38 internal/four sequential native companions and three CPU-order probes PASS; fresh install/build/typecheck and 5,106 tests PASS, two existing compiler skips; six fix-only review responsibilities clear with recorded thread-limit fallback and separate full charters; TP-004 corrected; ordinary RD-08/#70/#99 debt, mandatory TP-003/T-09, immutable oracles and frozen authorities retained)
- [x] 1.3.7 Finish `08-closeout.md`, public `docs/c64-cia2.md` note, deferral-expiry check and derived roadmap pointer; RD-05/DEF-7 remain open. Reverify any review/document changes, then green local checkpoint; no push. ✅ (implemented: 2026-10-07 18:13 CEST; verified: 18:22 CEST; public note/signature keys, forced Markdown formatting, local links, exact oracle exceptions/hashes and frozen authorities pass; production/tests unchanged from 5,106-test checkpoint. Sixteen public-service diagnostic probes disclose ordinary NMI assignment/conditional admission debt as RD-08/#70/#100 with ledger follow-up, not supported examples or extra compiler work. Deferral expiry retires only the approved exclusive row; keyboard contract assessment is now due under its existing owner, mandatory T-09 startup repair remains next, RD-05/DEF-7 stay open. Coherent green local checkpoint; never push automatically.)

**Verify:** `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
`yarn test`; directed Vitest during tasks; sequential VICE; forced touched-file
Prettier and Markdown links. Exact assertions and emitted/native costs are owned
by [the testing strategy](07-testing-strategy.md), not this checklist.

## Specification-authoring evidence

### Approved additional correction cycle

AR-P11 was explicitly approved on 2026-10-07. New independent, implementation-blind
regressions precede further production: 52 cases, 20 intended RED and 32 justified
preservation/precondition prepasses. The RED cases cover exact published-home
corruption during temporary NMI/IRQ exposure (eight), direct/transitive read-only
parameter borrows (eight), and actual invalid flag caller provenance (four).
The author read no forbidden implementation or prior review outputs.

Frozen new oracles:
`cia2-review-effects.spec.test.ts` SHA256
`17f682c5e565d8b4275e79a82cea8b8d52697bb238881065677eec3480a0b98c`;
`cia2-review-alias.spec.test.ts` SHA256
`467c0711f504fc98bfa9930e3b8a8af08ffc42bebc6395fc8f6c3bec84693969`.
RED evidence: `/tmp/blend65-cia2-effects-red-v15YxV/final-red.{json,log}`.
Pre-production tree: `d1ceb30e3331cac1d2eca23afd32aa5618564fcd`.
Correction evidence root: `/tmp/blend65-cia2-effects-fix.rFstLv`.
No production correction, green result or additional review is implied by RED.

The first corrected public run passes 68/76 combined cases, including both exact
home corruption and actual caller provenance, but eight borrowed-read builds fail
at machine storage binding. The existing packed-address lowerer incorrectly
treats every parameter as an aggregate's borrowed two-byte pointer, including a
one-byte copied scalar home. Completing SM-005 requires the same existing
consumer to distinguish scalar/enum homes from by-reference struct/array
parameters in `machine/lower-aggregate.ts`. This direct classification correction
adds no IR form, pass, runtime, storage request or public contract; it is included
in AR-P11's necessary correction diff. The immutable public tests are unchanged.

The same approved additional review identified converted-word caller attribution:
numeric equality is not call provenance after `byte($180)` becomes `$80`.
A separate blind author froze 12 new conversion cases before this final narrow
correction: eight intended RED and four supported-conversion prepasses.
`cia2-review-conversion.spec.test.ts` SHA256
`a282d5fe3dc5c081c883f7c546622d67ef90e0a28cf7a2b2f9235166ce004be3`;
RED `/tmp/blend65-cia2-conversion-red.AmeSJY/red.{json,log}`.
The existing actual invocation supplies the reaching call context with truthful
wording, without a numeric-origin claim or new provenance machinery. All 88
combined public cases now pass without skips (`conversion-green.{json,log}`).
The earlier 47 focused implementation, two binding and four sequential native
cases also pass. Original eight source/assembly/label/PRG families rebuild
byte-identically. Full fresh verification and the final independent verdicts
remain pending at this earlier checkpoint; those results do not close task 1.3.6.

The final fresh checkpoint completes at 17:19 CEST: install/build/typecheck PASS;
compiler 1,814 PASS/two existing SKIP; CLI 62 PASS; language server 21 PASS;
VS Code six PASS; root 3,183 PASS in 162 files. Total **5,086 PASS, zero FAIL,
two existing SKIP**; root duration 697.35 seconds. Logs `final-{install,build,
typecheck,test}.log` are under the correction evidence root. Four frozen new
oracle hashes, the three exact old-test fixture/setup exceptions, the single
ledger row and unchanged frozen specification/expert all pass exact comparison.
Six additional bounded review responsibilities are complete. TP-004 remains a
MAJOR selected-CPU proof defect; the green suite does not cover or waive it.
This historical checkpoint preceded AR-P12 approval. The user subsequently
approved that exact additional focused correction/review; task 1.3.6 resumes.

### Approved CPU-return correction cycle

AR-P12 was explicitly approved on 2026-10-07. The pre-correction complete
worktree snapshot is `a22a6e99ea5a45f7eded27f30a552d22a2ec5753`.
Evidence root: `/tmp/blend65-cia2-rti-fix.Muxd4B`.
Independent new public RTI regressions are being authored before production.
The earlier 5,086-test checkpoint is historical, not verification of this change.
One fix-only independent review cycle is authorized; no new old-oracle exception.

The independent author froze `cia2-review-rti.spec.test.ts` at SHA256
`f0ab13ca78092e211ae6bc59dfa4d3e071251229f2ad888c1edd3567173bb5da`:
four intended RED live-home aliases and sixteen justified acceptance controls,
covering all four profiles. RED is `/tmp/blend65-cia2-rti-red-pF2Yd7/red.json`;
the author reports no implementation/review read. The complete frozen-RED tree
is `569a00eb8649a556034080d79d0e80ddda5fac5d`. After RED, the existing actual
interrupt-return alternative derives eligibility from the interrupted enabled
state; the no-arrival branch is unchanged. Implemented 2026-10-07 17:42 CEST;
all 108 focused public cases pass with no failures/skips at 17:44. Fresh native
CPU-order evidence, full checkpoint and independent fix-review remain pending.

The current fresh checkpoint completes at 18:04 CEST: install/build/typecheck
PASS and **5,106 PASS, zero FAIL, two existing compiler SKIP**. Compiler 1,814,
CLI 62, language server 21, VS Code six and root 3,203 in 163 files. Root duration
683.99 seconds. All 38 focused internals, four sequential native companions and
three independent PAL CPU-order probes pass. Eight source/asm/labels/PRG and
stable resource metadata families match their original recorded hashes; old
generation directories were retired normally, so this is recorded-hash identity,
not direct comparison to deleted files or a fresh 568-case matrix rerun.
All six independent fix-review responsibilities are now clear; the runtime
thread-limit fallback reuses independent xhigh auditors with separate complete
charters/verdicts. Task 1.3.6 is verified; no existing/frozen oracle is edited by
AR-P12. The public note and deferral-expiry check remain in task 1.3.7.

### Current checkpoint diagnostics

AR-P10 was approved on 2026-10-07 and its exact two-case correction was applied
at 14:02. `task-134-ledger-ar10-results.json` and its verification log record
eleven passes with no skips. Whole-file comparison confirms only the two approved
mutation setups changed; all assertions and source fixtures are identical.
The fresh complete checkpoint is GREEN at 14:18: install/build/typecheck PASS;
compiler 1,795 PASS/two existing SKIP, CLI 62 PASS, language server 21 PASS,
VS Code six PASS and root 3,091 PASS in 157 files. This is **4,975 PASS, zero
FAIL and two existing SKIP**. The root duration is 832.60 seconds. Logs are
`checkpoint-ar10-install.log`, `checkpoint-ar10-build.log`,
`checkpoint-ar10-typecheck.log` and `checkpoint-ar10-test.log` under the same
evidence root. Code/forced touched-Markdown formatting, 70 local links,
97 documented direct exports, source-reference checks, unchanged native identity
report and exact authorized-oracle/frozen-authority checks also pass. The failed
run below remains historical diagnostic evidence, not the current gate result.

After bounded native qualification and the exact ledger retirement, the complete
local Linux checkpoint ran without an existing-test edit. Frozen install, build
and typecheck pass. Compiler tests: 1,795 PASS/two existing SKIP; CLI 62 PASS;
language server 21 PASS; VS Code six PASS. Root: 3,089 PASS/two FAIL across
157 files. The only failures are AR-P10's two obsolete negative-mutation setups;
all new CIA2 source/output/storage and twelve sequential timer cases pass.
This is **4,973 PASS, two FAIL, two existing SKIP**, not a GREEN checkpoint.

Logs `checkpoint-install.log`, `checkpoint-build.log`, `checkpoint-typecheck.log`
and `checkpoint-test.log` remain under `/tmp/blend65-cia2-spec-kTWCbB`. The root
run takes 641.47 seconds; VICE cases stay sequential. Exact other-ledger-row byte
checks, source-reference/documentation checks, forced touched-Markdown/code
formatting, 68 local link targets, whitespace and unchanged frozen authorities
pass. The protected ledger test is unchanged. AR-P10's corrected pending request
includes deferred status and, for the closing-owner case, the existing canonical
failed synthetic observation; every expectation and source fixture is preserved.
Full phase reviews and coherent local commit wait for that gate. RD-05/DEF-7 and
mandatory TP-003/R5.4/T-09 remain open.

Task 1.1.1 used the implementation-blind author. Before freezing its draft,
the normative self-check clarified that a chain above an exclusive owner may
perform non-consuming mutations charged to that owner, and that writing the
already-proved zero firmware-enable byte does not invalidate idle provenance.
A nonzero write followed by zero cannot recover that proof. These refinements
preceded production and were not adaptations to generated behavior: the positive
cases still fail at the existing E10245 guard. One unsafe cause per negative
fixture retains one canonical source diagnostic.

The frozen test report is `/tmp/blend65-cia2-spec-kTWCbB/frozen-results.json`;
the command log is `frozen-verify.log` in that directory. All 800 named results
are recorded. No syntax/type fixture errors remain. The author's disclosed
release-section and public-index overreads were excluded from oracle derivation;
no forbidden implementation target was read. No production or ledger edit has
occurred, and no RED tree is committed.

Task 1.1.2's report is
`/tmp/blend65-cia2-spec-kTWCbB/output-final-results.json`. The primary independently
checked its 52 named results. Before freeze, the draft's source identity and
overlay association were corrected from public-record metadata, and the source
extractor was made to cover the complete operation rather than its first byte.
The primary packet had incorrectly omitted the module name from its identity
example; that packet error is corrected. These are extraction/plumbing changes,
not byte, cycle or behavior expectation changes. No forbidden implementation
file was read by the output author. AR-P5 records its separate unsupported
empty-main instruction expectation; its exact correction was approved on
2026-10-07 and applied before the final expected-RED verification. The final
`output-frozen-results.json` and `output-frozen-verify.log` in that same directory
record 44 expected guard failures and eight justified prepasses. The primary
independently checked the counts and the exact approved correction. No syntax,
type or extraction failure remains; task 1.1.2's oracles are now frozen.

During task 1.1.3 orientation, the primary's overbroad source-manifest heading
lookup accidentally displayed unrelated qualification-map rows. Those rows are
excluded from oracle derivation and were not sent to the blind runtime author.
Subsequent reads were bounded to the four selected primary-source definitions.
VICE resource identities were checked against the named 3.10 source enums, not
prior runtime results or compiler tests.

The runtime author notified the primary immediately when its files were written.
The primary's progress-marker write was delayed across context compaction; the
author's first directed RED run therefore preceded that marker. This sequencing
deviation did not permit production work or change an oracle. Final verification
and freezing followed the marker. `vice-red-results.json` and
`vice-red-verify.log` in the same evidence directory record twelve canonical
E10245 guard failures, independently counted by the primary. No VICE process
started because admission failed. Runtime tooling and execution are still
unqualified; zero pending data is never represented as unreadable-mask proof.
The fixture observes the source mask-clear write and its actual accumulator
value separately. Source and PRG hashes bind the public artifact identities.
The predeclared native RESTORE/STOP/boundary predicates precede production.
Formatting, local links, documentation and frozen-authority checks pass. No
forbidden implementation or old-test reads were reported by the runtime author.

The aggregate report `aggregate-red-results.json` and command log
`aggregate-red-verify.log` in the same evidence directory independently confirm
the complete RED boundary: 808 new cases comprise 688 E10245 guard failures and
120 prepasses. The prepasses are 84 unowned-operation rejections, twelve counter
observations, eight preserved ordinary/raw provenance controls, eight private
storage rejections and eight unaffected output controls. All 144 existing CIA
API/ownership and NMI/profile admission cases remain GREEN. No production edit
preceded this recorded RED phase. Frozen authority, exact old-oracle exception,
formatting, local links and documentation checks pass. Native execution remains
pending until admission and machine output are implemented.

Task 1.2.1's first directed run identified the already-planned wrapper dependency:
sixteen private-storage negative cases reached machine closure, whose exclusive
entry had no selected stack metadata. Build/typecheck passed; those tests failed
with an internal error, not their required E10245. Task 1.2.6 is brought forward
within the same approved modification set so admission can retain its final safety
gate. No test changes or additional machinery are authorized by this reorder.
The CIA2 context integration remains pending, so intermediate candidate admission
is not a capability checkpoint and is not committed.

The prerequisite and admission reverification reports are
`task-121-126-results.json`, `task-126-wrapper-results.json` and
`task-126-output-results.json` in the same evidence directory. All 184 selected
cases pass (the directed output filter leaves twelve later device/shutdown cases
unrun, not qualified). Existing unowned CIA operations, private-storage failures
and unaffected chain/no-hook output stay GREEN. The empty exclusive entry is
RTI; the standalone writer is nine bytes/21 cycles; the ordinary helper companion
is thirteen bytes/33 cycles; coherent high-only publication uses matching-$47
placement. Build and typecheck pass. No spec assertion was changed.

Task 1.2.4 reports are `task-124-negative-results.json`,
`task-124-controls-results.json` and `task-124-context-results.json` in the same
evidence directory. Its current local transitions allow mask-only inner work
whose exact prior mask is software-proved and restored on all actual paths;
unreadable masks, changed timer phases/latches and raw history remain rejected.
This uses finite fields on existing physical leases, not device frames or runtime
reconstruction. The current worklist closes device facts; subsequent code
projection traverses only its already-proved ordinary call edges and records
per-operation and transitive callee policies. It does not evaluate a second CFG
or discover new incoming states. Equivalent machine policies reuse a variant;
incompatible policy at one unresolved source call/body fails E10278.
Physical slots and capture/equality witnesses remain unchanged. Existing block,
ABI-context, recurrence and publication helpers were moved into the existing
context-walk module to keep all touched semantic files below 700 lines. Exact
positive machine selection and native execution remain owned by later tasks.

Task 1.2.7's first lifecycle run found four finite-call failures: address-taking
had seeded a closed finite target as an independent call with no installed owner.
The correction stays in the approved context modules. Closed finite source
targets remain reachability roots, but actual call edges supply their incoming
ownership and code policies. The same root selection is used for proof seeding
and code projection; other independent callable roots retain their existing
model. No frozen test changed. `task-127-retry-results.json` confirms 68/68;
`task-127-context-machine-retry-results.json` confirms 47/47. Build, typecheck,
formatting, documentation, whitespace and frozen-authority checks pass. Final
shutdown bytes remain pending task 1.2.8.
