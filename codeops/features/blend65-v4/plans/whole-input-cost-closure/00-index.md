# Whole-input cost closure

> **Status**: Stopped —29/40 verified; task1.2.17 complete; task1.2.18 closed-cost selection/evidence partial; 963/725 unmet; full RD-08 optimization scope reopened (AR-P85 resolved)
> **Created**: 2026-10-12
> **Implements**: blend65-v4/RD-08, blend65-v4/RD-05
> **CodeOps Artifact Schema**: 1

## Minimum-sufficient baseline

**Original goal:** finish the existing ordinary-source keyboard and both-port
joystick qualification without weakening its complete expert-output bounds.
**Smallest viable design:** the bounded early RD-08 `size` prerequisite approved
in [AR-P4](00-ambiguity-register.md#ar-p4--exact-approved-complexity-decision).
Use existing semantic operations, machine selection, SFA, layout, startup and
artifact owners. One phase qualifies the interacting families together.
**Excluded machinery:** general optimizer/pass framework, alias solver, register
allocator, predicate-layout framework, inliner, runtime, dependency, test runner
and input-specific source recognition.
**Approved complexity:** AR-P4 and the three bounded preflight corrections
approved on 2026-10-12; unknown eligibility keeps ordinary source lowering.
The only context-contract expansion is PF-002's existing costs-evidence rule
and validator. No new support family, runtime or language restriction is added.

This plan implements only an early subset of RD-08 and unblocks the named input
gate in RD-05. It does not complete either RD or qualify `balanced`/`speed`,
assets, D64, raw takeover, unrestricted external interrupt behavior or physical
silicon. The rest of RD-08 keeps its RD-06/RD-07 prerequisites. The owning input
plan remains 38/48 until its own qualification tasks pass.

## Documents

<!-- prettier-ignore -->
| Document | Owner |
| --- | --- |
| [Decisions](00-ambiguity-register.md) | Scope, direct approval, exact oracle exception and analytical cost ledger |
| [Requirements delta](01-requirements.md) | RD subset and plan-local completion boundary |
| [Current state](02-current-state.md) | Observed producers/consumers and missing facts |
| [Source facts](03-01-source-facts.md) | Objects, footprints, lifetimes and fixed induction |
| [Machine selection](03-02-machine-selection.md) | Exact byte/flag/loop/address rules and storage recipes |
| [Closure and modes](03-03-closure-and-modes.md) | Finite alternatives, final observers, startup, public mode and evidence |
| [Tests](07-testing-strategy.md) | Independent behavior and cost expectations |
| [Preflight](00-preflight-report.md) | Complete rescan, verified corrections and remaining implementation evidence limits |
| [Execution](99-execution-plan.md) | Single task-progress authority |

## Specialist Agents

Existing specialist selection for the current phase is explicit below. This is
workflow metadata only: task 1.3.7 already requires all six independent review
lenses. Correctness, semantics/DX and host-performance review remain mandatory in
addition to these domain auditors. No new capability, compiler behavior, oracle
exception or review waiver is introduced.

<!-- prettier-ignore -->
| Role | Kind | Use | Authority |
| --- | --- | --- | --- |
| sfa-abi-auditor | reviewer | Phase 1 storage, calls, lifetimes and final closure | Existing task 1.3.7; project routing |
| target-platform-auditor | reviewer | Phase 1 interrupts, startup, visibility and runtime evidence | Existing task 1.3.7; project routing |
| machine-code-auditor | reviewer | Phase 1 equivalent assembly and complete artifact/resource costs | Existing task 1.3.7; project routing |

The OpenCode migration does not requalify the design or replace historical
preflight identities. Runtime checks, exact oracle gates and the existing
specification-first continuation remain unchanged.

## Usage

Ordinary Blend65 source and installed `c64.input` APIs do not change. The planned
public request is `buildProject({ project, optimization: "size" })`, or the
existing CLI's `build --optimization size`. `none` keeps direct lowering.
Availability of a manifest goal is not full optimizer qualification.

## Readiness

The new acquisition-NMI draft needs actual-range coordinate checks (AR-P10),
which cannot fit readably in the existing699-line file. AR-P11 proposes moving
only that new case to a focused eighth specification file. The user directly
approved that exact split; original runtime bytes are restored and the focused
257-line case passes formatting, source/meaningful RED and TP-002 fix review.
Tasks1.1.5/1.1.7 are verified authoring completions;1.1.9 completes the full
specification RED gate:381cases,257meaningful failures/124justified baseline
passes/0skips. Task1.2.1 now verifies explicit size in the public/CLI option types,
parser and help: fresh build/typecheck,62CLI tests,61direct parser/help checks
and bounded correctness/security reviews pass. The mode suite remains7baseline
passes/3expected incomplete-candidate failures. Task1.2.2 also passes source/
reference partition, resource-classification/cancellation probes,14service tests,
unchanged none artifact identities and one bounded SFA fix review. Progress
is26/40; direct origins, source effects, conditional binding occupancy, induction, lowering handoff and aggregate/byte-window/complement/Boolean/loop recipes are
locally verified. AR-P13's real aggregate-backing gap and cubic retransmission
are corrected with85regressions, source probes and one SFA fix review. Final
physical/domain/selected-code obligations remain. AR-P14 observer/context fixes
pass67combined regressions,45boundary tests and one SFA fix review. Handoff
passes618directed cases, unchanged none artifacts and base/SFA/output reviews.
AR-P15's exact existing aggregate consumer is user-approved; AR-P16's recipe
binding/mixed-result fixes pass625directed/45boundary cases, four sequential
VICE transition fixtures and one base/SFA/output fix pass. Final
storage/physical observers/public constructor and all cost limits remain due.
AR-P17's joint flag/sibling fix passes641directed/45boundary cases, four exhaustive
VICE byte grids and12saved-status cases with bounded base/SFA/output clearance.
AR-P18's approved complement logic concern and implementation pass671directed/
45boundary cases,32sequential native fixtures and bounded base/SFA/output review
with three MINOR metadata corrections qualified. AR-P19 Boolean exits now pass
691directed/45boundary cases, four sequential256-value native fixtures and bounded
base/SFA/output reviews. Task1.2.12 now passes776directed/45boundary cases and224
final sequential X/Y native cases, with144fresh complete artifact identities;
the prior56FlatEight/LowByte cases and their necessary corrections remain recorded.
AR-P21's counter concern is approved; AR-P22/AR-P23 proof/bounds corrections are
recorded. AR-P24–AR-P27 corrections, bounded base/output fix review and actual
14-byte loop/6-or8-byte store-window expectations pass. The one SFA fix review
clears binding/shift and finds the backing-view lifetime defect; its guarded
conservative correction is independently hardened and directly qualified, not
claimed to have a third iterative SFA review. Full phase SFA review remains due.
Local expert meets are tracked in[#114](https://github.com/blendsdk/blend65/issues/114).
Final call/startup closure, physical/async observers, debug, public constructor and
complete963/725qualification remain open. No successful public size build or
complete output-cost qualification is claimed. The keyboard parent remains38/48.
The next unit's independent seam check identifies five currently excluded
presence/namespace consumers. AR-P28 requests their exact narrow addition before
selected storage implementation. The user approves exactly those five consumers
on2026-10-18; no task13code or test edit precedes approval. Implementation resumes
with logical identity and physical placement kept distinct.
Task1.2.13 now locally qualifies the one selected inventory, truthful fixed-result
records and producer-sealed access-covered occupancy. AR-P29's independently
challenged existing-owner projection passes817directed/45boundary cases,60native
value/order/count cases plus6canonical-occupancy controls, unchanged none/oracle
identities and bounded base/SFA/output reviews. The72-chain closes without canonical
allocation; all conservative unknowns remain. Task14's actual call-live/startup
stack interfaces pass835directed cases/45boundaries,8native helper cases plus one
conservative-helper control and bounded base/SFA/platform/output review. Current
constructors retain unchanged0/1stack behavior; real held-P instructions and their
IRQ-entry proof remain task16. Final observers, public size construction/debug and
full963/725qualification belong to tasks15onward. No RD/parent/phase closes.
Task15's bounded CPU-envelope query and ordinary selected-body context handoff now
pass862directed cases across74files plus build/typecheck. The complete tuple verifier
is not implemented. AR-P32 blocks its actual generated-wrapper association: the
currently unlisted producer drops source/context metadata. No edit to that consumer
precedes the completed independent minimum-sufficient challenge and exact scope
ruling. The one-factory recommendation is now ready; direct approval is pending.
The user then directly approves exactly that factory packet on2026-10-18. Task15
resumes without any broader scope or qualification claim.
AR-P32's exact wrapper changes then pass33directed/868combined cases, canonical
identity/oracle/boundary guards and bounded base/SFA/platform review. The initial
strict typed observer interface passes36host cases/build/typecheck, not full raw/
async/source acceptance qualification. Its owner/test now reach700/699lines after
reuse of existing source queries. AR-P33 blocks additional growth pending independent
minimum-sufficient ownership/scope resolution; no extra module is yet authorized.
The completed reviews find two MAJOR gaps in the unwired typed subset: forged
stack/code handoffs can pass, and relocated startup restore/state can be hidden by
BASIC banking. Root host probes reproduce both; neither is waived. AR-P34/AR-P35
own necessary corrections. Independently hardened AR-P33 now requests the exact
CPU concern/test extraction, typed provenance helper and unchanged initializer move
to the existing data owner. Direct scope approval is pending; no new file exists.
The user subsequently approves exactly AR-P33. The CPU/test and unchanged initializer
moves are token-equivalent; linked lowering/shared evidence and actual startup-bank
guards pass881directed cases, build/typecheck and compatibility identities. The one
SFA fix review finds a temporal profile mutation hole; its entry-and-mint correction
now passes the discriminating regression plus synthetic geometry control. No third
bounded review is claimed; final phase SFA review remains mandatory. The platform
fix is clear only for the guard, not the inherited layout/return repair. The complete
typed/source/raw/bank/async observer gate remains unqualified. Full compiler tests
show2512passes/13known frontier failures/two existing skips; no commit/push. Host
review's denied external diff read is binding and supplies no performance clearance.
The completed challenge closes the exact remaining observer surface after bounded
raw/platform/binding/deferral and unary/indirect/provenance checks. AR-P36 proposes
two residual-effects concern files, five precise restricted producer/sharing edits,
data-only associations in already owned producers and one unchanged pure-query move.
No general solver or additional raw/indirect/C64/type/provenance helper is proposed.
Direct approval is pending before any of that instrumentation; tasks15/17 and the
residual test concern are blocked, without changing the40-task total or original
source/cost/oracle requirements.
The user subsequently approves the exact AR-P36 packet. Producer associations pass
895directed cases plus original none/boundary/oracle guards and bounded reviews.
Seven metadata on/off chosen-recipe pairs preserve45actual artifact identities across
14ACME assemblies; FlatEight's baseline debug mapping remains task18-owned. The new
residual concern admits only the checked straight-line fixed ordinary-RAM class;
all17producer/initial-consumer cases pass, with no findings in the three bounded
consumer reviews. Variable addresses, MMIO, calls, loops/range premises, status and
native/async windows remain unqualified. Full install/build/typecheck/directed/package
reverification completes:899directed cases/76files pass; complete compiler2530passes/
13known frontier failures/two existing skips, other owned packages pass and root is
not reached. No progress promotion, commit/push or public size qualification follows.
The next bounded Original-loop/ranged-RAM proof is under independent challenge;
the complete observer, startup, public constructor, debug and cost gates remain due.
The independently bounded evaluated-address seam then passes23cases and the full
905-case directed slice. It retains the actual address representation, validates
pointer/Y/word-buffer templates and uses interval intersection in both layouts.
Bounded reviews report no findings except a corrected MINOR documentation issue;
fresh none/boundary/oracle guards pass. Original-loop maxima still cannot be used
until their separate structural induction/alias premises close. No whole-input,
public size, new runtime or complete phase qualification follows.
The next continuation rechecks the unchanged source identity, build/typecheck,
23existing cases and11oracle hashes. Eight independently closed Original-loop
probes reach the conditional-range/control-flow proof guards with bounds on/off.
AR-P38 holds tasks15/17 and residual test completion while an independent challenge
determines the smallest readable proof/test ownership split. It returns Justified
for one existing raw-layout extraction, one focused loop-test concern and one
test-only fixture move outside src. AR-P38 owns the exact three-path packet and
bounded existing changes; direct approval is pending. No additional file,
extraction, loop proof or source/oracle change has been implemented.
The user subsequently approves exactly AR-P38 after two interrupted prompts.
The extraction preserves ten function bodies and every existing assertion; fresh
build/typecheck and905directed cases pass before loop admission changes. The first
bounded Original proof now passes40focused cases, including eight bounds-on/off
typed/raw positives, actual counter-write negatives, stale facts and genuinely
missing block evidence. Fresh none/boundary/oracle guards pass. Base/SFA reviews
report no findings within their stated static boundaries; the platform first review
also completes after its exact guidance supplement. The922-case/package checkpoint
is pending. Broader induction/read/home,
call/MMIO/native-state/async and complete963/725qualification remain due. No task,
phase, RD or parent progress is promoted and no commit/push occurs.
That checkpoint now completes:922directed cases/77files pass; full compiler2553passes/
13unchanged frontier failures/two existing skips, other packages pass and root is
not reached. The Original unit remains host/static only. Actual loop-read/differing
home/interior contrasts, call/MMIO/native-state/async and complete qualification stay
open. Owned extraction scratch is removed after durable recording; no task promotion,
commit/push or public size success follows.
The next continuation adds eight rebuilt loop-read/interval contrasts and five
direct-call cases without changing an oracle or adding support machinery. Only
ordinary calls outside proved induction bodies lose the residual blanket exclusion;
every reachable raw envelope and both actual layouts remain mandatory.74observer
cases/build/typecheck and all three bounded static reviews pass. Eleven real
ACME/VICE configurations also pass independent values, effective RAM order/count,
SP/P and normal SYS return on PAL/6581; this is not a dummy-bus, hardware, four-profile
or whole-cost proof. Seven original none identities,45boundaries and11oracle hashes
remain unchanged. Fresh935directed/full-package verification is pending. Task15
remains partial; loop-body calls, device/status/native-window/asynchronous closure
and the remaining14tasks stay open, with no commit/push or public-size success.
Fresh935directed cases/77files now pass; complete compiler2566passes/13unchanged
frontier failures/two existing skips. Other packages pass; root is not reached.
Owned probes/logs are removed after their bounded results and identities are
recorded. No task promotion or GREEN checkpoint follows from these partial results.
The next unit admits Original break/continue/return and conditional bodies through
the existing sealed source graph. Its platform review finds a real shared-exit
alias mismatch. AR-P39's independently hardened same-PC empty-fallthrough correction
passes77focused cases,16PAL/6581 VICE configurations, original compatibility guards
and the single bounded platform fix review. One MINOR new-test witness is corrected;
all30prior loop cases/assertion bytes remain intact. The959-case/full-package
checkpoint is pending. MMIO/status/native changed-state/async, wider call/induction,
startup/debug/constructor and complete963/725qualification remain unqualified.
Final959directed cases/77files now pass; full compiler2590passes/13unchanged frontier
failures/two existing skips, other packages pass and root is not reached. The extra
strict test-type check finds two pre-existing allocation-profile typing errors in
the moved fixture and older loop test. AR-P40 requests only those two local
constructions; its move-only fixture amendment needs direct approval before edits.
Tasks15/17/1.3.3are blocked, not promoted. All current proof work/oracles/none outputs
stay preserved; temporary evidence is cleaned after durable recording.
The user approves exactly AR-P40's two local constructions before edits. The guards
and typed views now pass the project's strict semantic TypeScript options for both
test roots and all77focused cases. One bounded test-only review has no findings.
Thirty-two real ACME assemblies preserve48paired assembly/labels/PRG identities,
including all16previously VICE-verified PRG hashes; no new VICE execution is claimed.
Full959/project checkpoint is pending. Next incoming-parameter loop premises are
under independent mechanism check only; no new admission has been implemented.
That mechanism check selects the by-value scalar/enum subset, not aggregate entry.
AR-P41's implementation passes strict test typing,95focused/977directed cases and
12newPAL VICE configurations with actual argument-delivery bytes and independent
values/SP/P/SYS return. Both bounded first reviews have no findings. Full compiler
2608passes/13known frontier failures/two existing skips; other packages pass and
root is not reached. Caller-side aggregate borrow construction/backing, device/
status/native-state/async and complete qualification remain open. No task promotion,
public-size success, commit or push follows; all original oracle/none guards remain.
The next caller-aggregate investigation reproduces the real named snapshot copy,
original mutation and forwarding path. Same first independent challenge recommends
one cohesive borrow proof/test concern, with no new producer needed for that named
case. AR-P42 records the exact two proposed files and existing composition-only
changes; direct approval remains pending before either file or admission edit.
Numeric publication, anonymous captures/results and unproved return-address sinks
stay gated. Current95focused/strict/build checks and all source/oracle guards pass;
this is not a new full compiler/native or complete borrower qualification result.
The user approves AR-P42's exact new consumer/test owner and AR-P43's two old
implementation-frontier outcomes before their edits. The named ten-byte copied
snapshot→relay→Original loop now passes independent PAL VICE data/mutation/scalar/
SP/P/SYS observations,110focused/992directed cases and strict test roots. Four
bounded reviews have no correctness findings; two MINOR documentation/host-cost
items are corrected and verified. Full compiler2623passes/13known frontier failures/
two existing skips; other packages pass and root is not reached. Canonical none
and all original oracles stay exact. Anonymous/captured and returned backing,
status/MMIO/native windows/async and complete qualification remain open. Owned
scratch is removed after durable recording; no task promotion, commit or push.
AR-P44's direct returned-local to named caller proof and AR-P45's exact stateless
lookup extraction are directly approved before edits. Normal backing88/borrow662/
test441line concerns preserve every old program and all expectations except the
one approved returned-local outcome/table plumbing. Fresh strict roots,1004directed
cases and two independent-answer PAL return cases pass; source/assembly/PRG/resource
identities are unchanged before/after. All four new bounded reviews have no findings.
Full compiler2635pass/13known frontier failures/two skips; other packages pass and
root is not reached. Capture, wider return destinations and remaining observer/
startup/debug/public-selection/cost qualification stay open. All none/oracle/frozen
guards remain exact. Owned scratch is cleaned after durable recording; no task
promotion or GREEN commit/push follows.
AR-P46's exact nine-path capture packet is directly approved before edits. The
unchanged cache-type/edge-copy moves and opt-in actual capture association preserve
all request/lifetime/none output identities. The focused capture proof closes the
bounded first-member class with all-use, full-copy/order and both-layout storage
obligations. Three MINOR review findings are fixed, the final source-authority
composition regression is corrected after meaningful RED, and one bounded base
correction review is clear. Fresh1030directed/79files, strict roots and six sequential
PAL capture cases—including nonuniform255byte page crossings—pass. Original2/8
capture images are byte-identical; the255edge is current-only evidence. Full2661
compiler passes/13known frontier failures/two skips; other packages pass and root
is not reached. None/oracle/frozen guards remain exact. Complete observers and the
remaining14tasks stay open; no task, public-size, phase or GREEN commit/push follows.
The next existing-owner Boolean slice now closes only certified empty/CMP#0
windows with actual final callee/branch/carry proofs. Seven additive cases,
1037directed/79files, strict roots,20sequential PAL native cases and three bounded
reviews pass; all original programs/assertions and none/oracle identities remain.
Full2668compiler passes/13known frontier failures/two skips, other packages pass;
root is not reached. Main/test reach700/691lines. AR-P47's independent Justified
four-path packet covers the next byte-edge concern and one exact conflicting
implementation-row migration; direct scope approval is pending before any new
file, extraction or byte admission. Complete task15, public size and963/725remain
unqualified. Progress26/40; no commit/push.
The user subsequently approves exactly AR-P47 after the interrupted prompt. The
unchanged helper extraction and exact one-row migration now locally verify:21new
cases,1057directed/80files, strict roots,24sequential PAL global/home native pairs,
exact before/after images/resources and three bounded reviews pass. Complete
native read order/count is compared at restore after diagnosing delayed trace
event delivery; no monitor or producer edit. Full2688compiler passes/13known
frontier failures/two skips, other packages pass and root is not reached. All
none/oracle/frozen guards stay exact; source/runtime/hardware/cost endpoints remain
distinct. Complete observers, startup/constructor/debug and original963/725bounds
remain open. Progress26/40, no commit/push or phase/public-size promotion.

### Current continuation boundary —2026-10-26

AR60approval11:18CETprecedes18new meaningful admission REDs and direct call draft.
Ordinary formatting measures effects707/700and triggers the promised hard stop.
New test57/500;old outside-call row remains unmigrated368. No build/GREEN/native
qualification or deleted check/doc, compression, helper/API/extraction follows.
The sole independent **Justified** identifies an additional local proof obligation:
unassociated actual JSRs are not closed by a mapped-block-only walk. [Exact AR61](00-ambiguity-register.md#ar-p61-exact-measured-call-site-leaf-packet)
requests only one200-line call-correspondence leaf with one existing-type function
export returning failure/null, movement of new unqualified logic and complete
actual enumeration. Existing word/CFG helpers/signatures and all main/query/guard/
producer/fixture/other-oracle boundaries stay. Draft2d7c187c(707/57/368)preserved;
user ruling pending;task15/17/1.3.3blocked26/40,parent38/48,no staging/commit/push.

ContinuationafterGREEN-firstconfirmation preserves3371ab33and all445source/test/
fixture/query/policy hashes/11oracles. Fresh156focused/45boundaries/build/typecheck
pass;48isolated/actual diagnostics close and serialize but all atomic tuples reject.
The sole independent **Simplify** selects [exact AR-P60call-only scope](00-ambiguity-register.md#ar-p60-exact-call-only-approval-packet):
effects≤700,no new production helper/signature/API/result;one new500-line test;
exact old outside-call row migration only. Source/actual correspondence must be
occurrence- and invocation-correct; reuse authenticated central SFA/outer observers,
not a new closure engine. Main/raw-layout/guarded-use/old-loop files and both post-
call guard negatives stay. Fit remains unmeasured; no leaf/guard-map fallback is
authorized. Exact ruling pending;task15/17/1.3.3blocked26/40,parent38/48. Last full
3003/13knownfail/two skips remains RED;no new runtime/parity or commit/push result.

Current2026-10-27bounded [checkpoint](99-execution-plan.md#bounded-guarded-usegeneric-pretest-checkpoint-2026-10-27):
guarded-use/generic-pretest proof passes50new/316focused/1331directed/45boundaries,
72ACME images/144sequentialPAL6581cases,all file budgets,seven original none
identities and11immutable oracles. Exactly one old nonconstant-start outcome is
amended only AFTER directAR59approval and independent admission evidence; every
other source/assertion/old outcome stays. Production remains658/583,new test232/300,
old694/no growth. Four bounded reviews find no introduced observer defect; prior
host review applies unchanged production. Inherited MAJOR#121–#123are owned,not
fixed/waived;no expert-output/whole-input completion. Full compiler3003passes/
13same knownfail/two skips,other packages pass,root not reached. Actual24input
tuples still reject: savedOriginal now reaches snapshotCompatible call306;
acquisition async remains. Task15partial26/40,parent38/48and no GREEN commit/push.

After exact AR-P58approval at07:32CETon2026-10-27, the three-file integration fits
658/583/185lines. Twelve meaningful admission REDs precede production edits; all
38new cases and strict owned-root compilation/build pass. The broader directed
run reports1318passes/one unchanged old nonconstant-start rejection now complete.
No old expectation is edited. Install/build/typecheck and standalone45boundaries
pass; full composite stops at directed failure, with no native/full/output/platform
qualification. Three static reviews find no findings but do not waive that failure.
[Exact AR-P59packet](00-ambiguity-register.md#ar-p59-exact-nonconstant-start-qualification-packet)
requests only qualification/coverage in the existing new concern and one old expected
literal at645from rejected→complete, after direct approval and independent evidence.
Production remains frozen; no helper/API/query/producer/fixture/cap or other old
expectation changes. The sole blind assessor recommends that minimum; ruling
pending. Task15/17/1.3.3blocked,26/40,parent38/48and no staging/commit/push stay.

Continuation2026-10-27preserves all compiler/test/source hashes. Fresh build/
typecheck,289existing focused/query regressions and45boundary cases pass. Sixty-
two real construction diagnostics show a per-use containment gap before the
saved caller's outside-loop call barrier. The sole blind assessment is **Simplify**:
reuse existing conservative ordinalBoundsForFunction at both typed consumers,
not new call or range machinery. [Exact AR-P58packet](00-ambiguity-register.md#ar-p58-exact-guarded-use-approval-packet)
requests effects≤668within700,main≤586unchanged and one new300-line test. No API,
helper move, producer/query edit, call admission or old-test exception. Direct
approval is pending; proposed test absent. Neither the saved post-call reload nor
whole-input completion is promised. Task15/17/1.3.3blocked,26/40,parent38/48and last
full2953passes/13knownfail/two skips stay;no GREEN commit/push.

The approved Original-composition unit now fits effects644/700,new test368/500,
old test694/no growth and passes266focused/1263directed/45boundary cases. The
exact one-row migration is independently checked against original bytes followed
by normal formatting; all other source/test/producers/fixture/oracles stay. Twenty-
eight ACME images and56sequential PAL/6581VICE cases independently verify nested/
sequential/prefixed/early-exit values, write order/count, parent-next zero-trip,
word homes and normal SYS state/return. Seven original none artifact identities
reproduce. All four bounded reviews find no introduced observer defect; inherited
direct-index MAJOR is[#120](https://github.com/blendsdk/blend65/issues/120)-owned,
not waived/fixed. Analytical12-byte/17-cycle-per-store savings retain both word
homes/all other reservations; no replacement is assembled/executed. This is not
parity/publicsize/whole-input completion. Full compiler2953passes/13same knownfail/
two skips; other packages pass, root not reached. Task15partial26/40,parent38/48
and no GREEN commit/push remain. [Checkpoint](99-execution-plan.md#bounded-original-composition-checkpoint-2026-10-26)
owns exact source/state/bytes/resources/reviews/issue/failure evidence and limits.

Subsequently, user **“i approve, proceed”** directly approves the sole exact
three-file/cap/one-row question. At13:53CETtask15resumes partial before code;
admission REDs, actual fit and complete qualification are due. All exclusions and
counts26/40,parent38/48remain, with no GREEN commit/push.

The user's **“proceed further”** resumes read-only diagnosis. Fresh build/typecheck,
160focused and45boundary cases reproduce the existing proof. All96isolated and
24unchanged actual-source constructions close and serialize; none of the24actual
input tuples passes final observers. Saved Original reaches prefixed/nested induction,
while acquisition still needs asynchronous borrowed backing. Fourteen nested probes
also expose missing sibling maxima in per-loop checks and the final function Map.

AR-P57owns the exact next scope/capacity/old-test decision. The sole independent
verdict is **Simplify**: existing-effects Original composition, not a production
extraction or checked-store-first. Exclude new cross-counter address arithmetic
and call handling; real saved/main acceptance remains unpromised. The exact
[three-file packet](00-ambiguity-register.md#ar-p57-exact-original-induction-approval-packet)
needs effects608→700cap, one new500line test and one constant-nest row migration.
No source/test/API/producer/fixture/agent edit is authorized or made. Task15and
dependent17/1.3.3are blocked there;26/40,parent38/48and14remaining tasks stay.
Fresh110Original regressions also pass; all443entry source/fixture/test/producer/
policy hashes and all11oracles remain unchanged. No ACME/VICEruns or publicsize pass.
The last full2919passes/13knownfail/two existing skips remains historical, not rerun.

### Current indexed-store checkpoint —2026-10-26

The exact approved four-path proof now fits469/685/458/596lines and passes160
focused cases(59new/101unchanged),1229directed/81files,45boundaries and16actual
ACME images/64sequential defined-answer PAL/6581VICE cases. Correct packed-offset
dummy footprints, finite V propagation, caller Y state, empty selected owner and
source-value/write-order/normal-return duties pass. Old tests,eleven oracles,
seven original none artifacts,main/effects/producers/fixture/lower-control and
agents/config remain unchanged. No producer/old-test exception is silently added.

Four bounded reviews find no introduced observer-unit defect, but output audit
reports four inherited MAJOR gaps with distinct measured costs: one-trip/invariant
RHS loop work[#119](https://github.com/blendsdk/blend65/issues/119), global initialization
size/time[#117](https://github.com/blendsdk/blend65/issues/117), and sole void-call
continuation[#118](https://github.com/blendsdk/blend65/issues/118). These are accepted
for correction under mandatory issue-filing authority, not fixed/waived or a parity
pass. Actual expert replacements are not assembled/executed; global-fill savings
trade time for bytes and independent deltas cannot be added without re-closure.
[Checkpoint](99-execution-plan.md#bounded-indexed-store-checkpoint-2026-10-26)
owns complete source/image/state/resource/review/failure evidence and limits.

Fresh full compiler2919passes/13same frontier failures/two existing skips; other
packages pass, root not reached. Task15remains partial: checked/split/non-elided/
main/nested/early-return, reads/native-retention/expanded/mixed, wider transports,
raw/status/MMIO/platform/async and unavailable-reference observers still need proof.
26/40,parent38/48and six implementation/eight hardening tasks remain. No complete
input963/725,publicsize,four-profile,elapsed-timing,hardware,output-parity or phase
qualification. VICE-verified/hardware-unverified; no GREEN commit/push.

### Next typed-index discovery —2026-10-26

User **“proceed”** authorizes read-only next-boundary discovery, not new code/API/
test files. Build/101focused cases and f96f43e3/11oracles are freshly preserved.
96isolated+24exact whole-input constructions and nine ACME images identify the
missing typed indirect→X/Y address proof, removed pointer demand and actual mixed/
nested/main/async obligations. No toy acceptance is claimed as real input proof.
AR-P56owns the exact next scope/capacity decision; implementation is blocked there,
not on model switching or a lost scalar proof. Agents/config remain unchanged.
One new bounded independent design assessment compares existing owners with an
additional index leaf; it does not reopen AR-P55or grant implementation authority.
26/40,parent38/48and last full13known failures stay unchanged; no commit/push.

The same assessment now completes **Justified—A**, after its requested source/
pointer/state/capacity supplement. Mandatory correction: reference packed access
can hold R+i in the pointer and d in Y; final address equality must not hide its
distinct dummy access. Actual nonzero-offset X/Y records confirm that form.
[Corrected four-path packet](00-ambiguity-register.md#ar-p56-corrected-exact-approval-packet)
adds no production module: three existing proof owners plus one new focused test,
exact pointer/root/offset/maximum result and indexed-only V/Y/state/physical
obligations. Caps500/700/500/700stay, with actual fit unmeasured. No code/test/helper/
producer/fixture/oracle/agent change or acceptance precedes direct approval.
The user's subsequent **“Yes - proceed further”** directly approves that sole
four-file/API question. At11:39CETtask15resumes partial, first admission REDs then
implementation/fit/qualification. Existing caps and every excluded path/test/agent
boundary remain.26/40,parent38/48and the RED full-suite frontier do not advance.

### Current scalar register checkpoint —2026-10-26

The exact approved six-path X/Y snapshot proof is locally verified:55new tests plus
46retained LowByte cases, strict/build/typecheck,1170directed/80files,45boundaries
and96sequential defined-answer PAL/6581VICE cases/24actual ACME images pass. Exact
source-value snapshot, current ordinal, arithmetic flags, access order/count and
normal SYS P/SP/ports/CIA2duties are checked without uninitialized-input assumptions.
All caps,11oracle hashes, seven original none artifact identities and four exact
pre-implementation X/Y diagnostic PRGs remain protected. Agents/config unchanged.

Four bounded reviews find no introduced observer-unit defect, but output audit
reports two inherited MAJOR defects: result capture remains[#115](https://github.com/blendsdk/blend65/issues/115),
and a newly explicit held-ordinal snapshot gap is[#116](https://github.com/blendsdk/blend65/issues/116).
Neither is waived or fixed by the proof. No whole-routine expert parity, full input,
public size, four-profile, timing or physical-hardware qualification follows.
[Checkpoint](99-execution-plan.md#bounded-scalar-register-checkpoint-2026-10-26)
owns complete bounded evidence and dispositions.

Fresh full compiler2860passes/13unchanged frontier failures/two existing skips;
other owned packages pass, root suite is not reached. Composite remains RED:
no commit/push. Task15still needs typed-index/native/expanded/mixed/direct-transfer,
wider transport/raw/status/MMIO/async and rejected-reference closure. Six implementation
and eight hardening/qualification tasks remain;26/40,parent38/48and FO-SF-002/final
phase clearance stay unchanged. Runtime status:VICE-verified/hardware-unverified.

### Next selected-loop boundary —2026-10-25

Fresh build/typecheck/48LowByte tests and all11oracle hashes pass at unchanged
five-source6ebc4e5aidentity.48real next-class constructions across four sources,
six policies and bounds on/off close, but expose distinct register snapshot/read,
first-test, indexed pointer/bounds-split, native-store and expansion obligations.
Actual conservative caller queries do not kill X/Y differences. These are static
construction/query observations, not new runtime or next-class proof.

[AR-P55](00-ambiguity-register.md#ar-p55--next-selected-loop-proof-boundary) records
the exact discovery and asks for one separate bounded read-only assessment before
selecting the smallest complete next proof and readable ownership. The prior
challenge allowance is exhausted; no new context, code/helper/file/ceiling change,
producer/fixture/oracle edit or broader acceptance is inferred from “proceed”.
The user then selects **“Approve assessment (Recommended)”** after the interrupted
prompt is repeated: exactly one separate next-unit read-only Astra context is now
authorized, with no code/newfile/ceiling/agent amendment. The future exact code-scope
decision is still open. Tasks15/17/1.3.3stay blocked;26/40,parent38/48 and last
full13known failures remain.
No commit/push; prior LowByte qualification and all exclusions stay intact.

The separate one-context assessment is now complete: **Justified—one register-specific
factor, not a standalone validator**. Requested evidence finds the existing approved
normal-return no-AXY-value contract, closes actual snapshot correspondence, and
measures14ACME images/24PAL traces. These are diagnostics, not accepted observer/
source-value/whole-input qualification; uninitialized answers use observed initial
values only. The complete [AR-P55packet](00-ambiguity-register.md#ar-p55-exact-scalar-register-approval-packet)
proposes exactly two new factor/test files and four bounded existing edits, including
only the old X/Y rejection-list migration. No producer/helper move/fixture/oracle/
agent change or expanded acceptance precedes direct user approval. Full parent700
fit and implementation correctness remain unmeasured; all hard ceilings stay.
The user subsequently says **“I approve”**, directly approving that sole exact
six-path scope and two-label implementation-test amendment before edits. At23:33CET
task15resumes partial, without advancing26/40or keyboard38/48; actual fit, meaningful
RED→GREEN, native/resource and independent qualification remain due.

### Current LowByte checkpoint —2026-10-24

The approved exact five-path LowByte proof is locally verified: build/typecheck,
strict owned test root,48focused cases,1117directed/79files,45import boundaries,
24reconciled ACME images and96sequential PAL/6581VICE cases pass. Independent
source/CPU values, flags, intended access order/count and normal SYS P/SP/machine
restoration are checked. Bounds on/off and C/D/I/V entry variants are included;
physical hardware, full timing and four-profile/whole-input qualification remain
unproved. Base/SFA/platform/output bounded reviews have no findings. All five
files fit500/700/700/608/586ceilings; no producer/fixture/oracle/agent change.

Seven original none artifacts and all11oracles remain exact. Fresh full suite is
compiler2807passes/13unchanged frontier failures/two existing skips; other owned
packages pass, root suite is not reached. This run's directed filter is narrower
than historical82file selections; no cohort-equivalence claim. The composite
remains RED, so no commit/push. [#115](https://github.com/blendsdk/blend65/issues/115)
explicitly owns inherited scalar-store capture output debt; it is not a new unit
finding or full-program parity waiver. [Qualification](99-execution-plan.md#bounded-lowbyte-qualification-2026-10-24)
owns exact evidence and limits. Task15remains partial; six implementation/eight
hardening tasks remain, keyboard38/48 and FO-SF-002/final phase clearance unchanged.

### Current continuation —2026-10-23

2026-10-24: the user approves a bounded independent implementation-strategist
trial on AR-P53, not implementation or permanent agent creation. The existing
read-only role is reused without changing CodeOps agents, routing or permissions.
The [trial journal](99-execution-plan.md#user-approved-strategist-trial-2026-10-24)
owns its evidence, probes and outcome. The trial now completes36primary probes
and a same-context Ready to implement—narrowed design verdict. Exact five-block
LowByte with direct unstaged truncation, closed control/body/storage identities
and all existing continuation queries fits an estimated690/680new proof/test lines;
actual fit and correctness remain unqualified. No producer/agent/permission change
or extra helper is proposed. The revised four-file packet remains unapproved;
See [trial outcome](00-ambiguity-register.md#strategist-trial-outcome-2026-10-24).
The user subsequently says **“I do”**, directly approving the sole narrowed
four-file implementation packet at16:50CEST. AR-P1–AR-P53are resolved; task15
resumes partial implementation, while17/1.3.3return to not-started. No task is
promoted. The exact700/700/608/586ceilings and all exclusions remain binding.
The first normally formatted draft reaches780production lines, so implementation
stops before wiring acceptance. AR-P54owns a read-only investigation of a genuinely
smaller complete fit; no additional file or relaxed ceiling/check is authorized.
The actual-fit investigation now returns Simplify: one500line layout leaf, with
source-associated occupancy/demands kept in the parent. Revised complete estimates
390–420leaf/625–660parent/650test remain unmeasured. Canonical startup and actual
caller-difference premises are corrected in the exact AR-P54packet before any
scope change. Direct user approval is pending. The unqualified draft's diagnostic
build is RED with six TypeScript errors; acceptance remains unwired and no GREEN
checkpoint is claimed.
At21:01CEST the user directly approves the revised fifth-file split with **“yes”**.
AR-P1–AR-P54are resolved and the partial task15resumes, with exact relocation
before proof fixes. The500/700/700/608/586ceilings and all exclusions remain binding;
no local, native or whole-input success follows from scope approval.

The user resumes task1.2.15 with **“proceed”**. Fresh build/typecheck and124focused
tests pass; all11recorded oracle hashes match. Thirty actual source/reference/
candidate constructions show that six Original controls pass while24selected
counter/expansion constructions reject at the Original-only induction guard,
before the separate pending-window barrier. No implementation or new source/test
file is changed. [AR-P53](00-ambiguity-register.md#ar-p53--selected-loop-observer-ownership-and-next-bounded-proof)
owns the independently challenged smallest selected-loop proof/test scope;
tasks15/17/1.3.3are blocked pending its exact ruling. No new machinery, old
expectation amendment or broader scope follows from generic continuation.

### Retained verified subunit —2026-10-22

Cache and Original-field complement subsets are locally verified. AR-P50's exact
Original-source migration and AR-P51's unchanged unqualified helper relocation
preserve all cache helpers/guards and other sources/assertions. AR-P52's actual
reference-AND addressing gap is corrected with meaningful RED→GREEN and one
platform fix review. Current1128directed/82files, strict/build/typecheck,54sequential
PAL/6581 Original-field native cases, six exact pre/post-fix images/resources,
seven original none identities,45boundaries and11oracle guards pass. Hardware
remains unverified; no full-input963/725or whole-phase claim.

Latest full checkpoint: compiler2759passes/13known frontier failures/two existing
skips; twelve cases reach unfinished candidate construction and one rejects the
approved resource-rejected baseline contract. Other packages pass, root suite is
not reached. The user's requested commit
and push cannot pass the green-only gate, so nothing is staged/committed/pushed.
Work is preserved. Resolve AR-P53, then resume task1.2.15's remaining final observers,
then startup/candidate/cost/debug/full-qualification and hardening/review tasks.
Progress26/40; keyboard38/48. FO-SF-002 and final six-lens review remain open.
The execution journal owns the exact [paused handoff](99-execution-plan.md#paused-compaction-handoff-2026-10-22).

### Prior qualification context

The following paragraphs retain earlier restart evidence; the current checklist
and readiness summary above supersede their historical partial-task statuses.

The user resumed execution on 2026-10-15. Independent SFA/platform review finds
that the final startup draft assertion retains predecessor contents after their
last consumer. [AR-P9](00-ambiguity-register.md#ar-p9--do-not-require-predecessor-contents-after-the-last-consumer)
owns the exact one-line oracle amendment directly approved by the user. Exact
independent deletion, fresh build,104 startup cases (52none passes/52 meaningful
size RED) and one concrete fix review pass. Task 1.1.5 remains partial; 1.1.9 is
not started. No compiler edit is applied.
Remaining acquisition/held-link runtime facets and complete RED still precede
size implementation. Progress remains 9/40; the keyboard parent remains 38/48.

The design preflight remains historically PASSED. [AR-P5](00-ambiguity-register.md#ar-p5--new-fixture-inputs-must-not-prohibit-legal-optimization)
has the exact user ruling of 2026-10-13; its concrete input correction passes
one independent static fix review and directed source/RED checks. The two
reopened authoring completions are requalified. The remaining specification
groups and complete RED gate still precede implementation. No original expected
answer, cost limit or compiler behavior has been changed.
The user directly approved the exact AR-P6/AR-P7 corrections on 2026-10-13.
The execution owner records the necessary bounded baseline-host prerequisite
before the remaining frontier checks. Its scope is four existing files and
exact-result pruning only. Startup correction remains one test function.
AR-P7's exact host remedy qualifies with75 storage tests, fresh build/typecheck,
six unchanged artifact identities and bounded independent reviews. The
complete frontier group now has14 meaningful RED/13 justified baseline passes.
AR-P6's accounting correction is independently clear; native checks expose the
separate universal compact-instruction assertion recorded in AR-P8. The user
directly approved that exact conditional/comment amendment on 2026-10-15;
the concrete fix review is clear and all32normal startup/return cases pass,
with32meaningful unsupported-size failures. No producer or
other test expectation is changed under that ruling. No broader
fix or new framework is authorized; complete RED still precedes the main size
implementation. The exact AR-P4 output-mode amendment has five verified line
changes and12 meaningful unsupported-size failures, with every original limit
preserved.

Status: **Unknown** for implemented sufficiency; claim kind: **Recommendation**
for the approved design. The conditional cost ledger is owned by AR-P4, not a
compiler-run result. Before execution, the full plan must pass preflight. Before
any GREEN checkpoint, both behavior and complete assembled/resource gates must
pass and the phase must receive all configured independent reviews.

The current tree already contains uncommitted keyboard work. Preserve it and
snapshot the complete phase-start state. Do not commit a RED composite tree or
push automatically. The project effort confirmation is already standing for the
named RD-05 continuation; advise effort without repeated handoffs within it.
