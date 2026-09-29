# CIA1 Return Authority Evidence

> **Status**: Preparation only; candidate not activated.
> **Candidate**: `/tmp/blend65-cia-return-candidate.usrAwL`
> **Evaluation workspace**: `/tmp/blend65-cia-return-eval.zByQ2k`

## Scope and baseline

This evidence belongs to the approved Phase 1 correction, not a new qualification
framework. No compiler file or live authority has changed. Only one expert skill
remains active: version 2.0.0, content commit
`c9e70fab6039e9ced3108e88f0ea9730d4fd3007`.

The active expert names specification digest
`5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa`.
The current specification already names
`ee2be7c2139ff82f22d1d8f169251bae1d2244e5e4a74bddbdfc4903af39fff8`.
Commit `4ccb28d0` added the approved E10280/E10281 diagnostic identities and span
rules under RD-04 AR-P27. The diff is ten added and two replaced lines across
the inventory and Chapters 02, 08 and 14; no accepted source form or runtime
semantics changed. This previously unpropagated identity change must be included
in candidate lineage and the diagnostic/corpus dependency checks. It is not a
new product decision. Updating the non-normative inventory digest after the
approved appendix correction is required bookkeeping, not another normative edit.

## New qualification case

Candidate Q-P23 distinguishes the approved final-exclusive stock-compatible
handback from impossible arbitrary CIA1 mask/latch restoration. CASE-Q-P23 is
its single coverage row. Case and row structure/identity checks pass. The old
111 case identities are retained.

Independent source-authority/semantic-soundness review by
`/root/cia_return_rescan_grounding` returned **no findings** on 2026-09-29.
The reviewer used the MOS 6526 data sheet and the pinned KERNAL source, not
compiler implementation. The order is an approved synthesis of hardware
semantics and stock setup, not a claim that a whole ROM exit routine exists.

- [MOS 6526](https://myoldcomputer.nl/Files/mos_6526_cia.pdf), printed pp.6–8:
  readable counters, write-only reload latches and masks, consuming ICR read,
  and LOAD strobe.
- [Pinned KERNAL init](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/init),
  IOKEYS/IO010/IO020/SIXTY/SIXTYP: PAL 16421 (`$4025`), NTSC 17045 (`$4295`),
  low byte before high byte.
- [Pinned PIOKEY](https://raw.githubusercontent.com/mist64/cbmsrc/01bd60f162ef92212ef0cb67546ae8f42be34168/KERNAL_C64_03/irqfile):
  mask `$81`; CRA `(old & $80) | $11` preserves the TOD input bit.

The main agent rechecked the actual hash-pinned PDF and KERNAL files. The old
expert's printed CIA page numbers were wrong: the scan has ports/register map on
p.5, timers on p.6, ICR on p.7 and control fields on p.8. Candidate citations are
corrected on the touched CIA surface; this changes no hardware invariant.
The pinned `IOINIT` also makes Timer B's stopped stock control value explicit:
`$08`, not a guessed `$00`. The approved ordered contract already required the
pinned stock mode. Q-P10 is added as a fixed port-ownership control for the
corrected source location, not a new product capability.

The reviewed draft case-file SHA-256 is
`485f78ec2e1c71167b1b7155b8246cb85e9981a6859956721a10d80a86a2307f`;
coverage-file SHA-256 is
`41e4ab8779874879e689373709695f1c58f4c136a0b7fdd2a226030b9fc8d0c3`.
Final frozen-oracle and result hashes remain pending.

## Enforced blind evaluation

The normal unprivileged bubblewrap boundary is unavailable (`uid map: Permission
denied`). A temporary Landlock probe passed packet-read and forbidden-read
controls, but the current client could not initialize with its ordinary home
denied; those setup attempts are **not behavioral results**.

The replacement uses the already-installed immutable `node:22` image:
`node@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d`.
It is a disposable OS-enforced container, not project infrastructure. No image
download, repository dependency, or persistent harness is added. A fresh private
home is mounted at the image user's normal home; host HOME/CODEX_HOME variables
are not reassigned.

Each evaluator gets only the exact router, metadata, thirteen runtime references,
prompt and control script. No qualification/oracle/plan/history directory or host
workspace is mounted. The client and code-mode host are read-only mounts; only
the credential file needed by the client is mounted read-only. The new private
client home and `/tmp` are writable. Image root is read-only, all capabilities
are dropped, privilege elevation is disabled, UID/GID are 1000, and the process
has bounded CPU/memory/process limits. Web search is disabled; no author context
or prior answer is supplied.

The process first reads its allowed router and then attempts to read repository
AGENTS.md and the candidate oracle. Both forbidden paths must fail before its
evaluation is accepted. A separate fresh grader gets only the frozen oracle
and captured answer, with the same isolation controls. The setup-only run with
a missing code-mode host was discarded; no inaccessible-packet answer counts.

Exact accepted commands, packet/answer/grade hashes and results are pending.
Raw temporary captures remain available for the final independent review; no
compiler execution, output cost, VICE result, or physical-silicon result is
claimed by this authority qualification.

### Old-baseline capture

The accepted evaluation ran with `gpt-5.6-sol` at high effort, client 0.159.0,
inside the read-only cached-image container. Both forbidden-read controls failed
as required, and packet reads succeeded. The exact eighteen-file packet contains
only router, metadata, thirteen runtime references, prompt and control.

- Packet GNU record-stream SHA-256:
  `d98adb801b837625ceaa716aa255a296b0e9b8c3c10828e0457ff5421b53a7fa`.
- Captured answer SHA-256:
  `8774f9b5aba3edb37f938002ae7a39988954d1e7427b82fc9ea7533bfbdf447c`.
- Frozen Q-P23 oracle section SHA-256 supplied to the separate grader:
  `f223beece43dbab4a422cd5329ba83ab2f40c4920b33bb1696bc6b4c571bbe6d`.

The old response correctly keeps exact reloads Unknown, but cannot satisfy the
new contract. It also proposes predecessor-device reconstruction for dirty
nested routes and new software state objects, instead of rejecting unsafe inner
releases. The response places the consuming read before stopping/reprogramming
the timer and suggests a further stale-condition clear. Those are discriminating
differences, not a cosmetic wording test. A separate `gpt-6-astra`/xhigh process
graded the frozen oracle and exact answer: **Fail**, confirming the expected red.
Its packet SHA-256 is
`bdf0418cbf88823b2f0f047ef57abbc7d1979784987dbfae093a6f66f75077f5`;
grade SHA-256 is
`8742e9d13a9c637b8801f220fec25be6d8962e67f79513559cd2646fa0c1f17a`.
The grader's independent positive/negative controls also passed.

Captures: `baseline-red/{events.jsonl,client-stderr.txt,output/answer.md}`;
grader packet: `baseline-grade/packet/{oracle.md,answer.md,prompt.md,control.py}`
under the temporary evaluation workspace. Invalid client-setup attempts are not
part of this accepted capture and were not mounted into its empty private home.

## Language Guard applicability

The live guard contains **27**, not 23, rules. This is a correction to an existing
target-library return contract, not a core-language syntax addition. The following
results assess the approved design; they do not claim implemented or executed
compiler behavior. Phase 2 retains the source/assembly/cost/runtime obligations.

| Rule | Authority/design result and applicability |
|---|---|
| P1 | Pass under Tier 2: named C64 library contract on four cooperative PRGs; no core meaning changes or unsupported-profile promise. |
| P2 | Pass: ordinary Quit-to-BASIC is useful on PAL/NTSC with either SID model. |
| P3 | Pass: all device/register facts remain in the C64 appendix and platform library. |
| P4 | Pass: profile-qualified stock service; unavailable/nonstock ownership is rejected rather than guessed. |
| H1 | Pass: direct NMOS-compatible loads/stores and existing masked vector transaction; no novel CPU capability. |
| H2 | Pass at contract level: inline fixed-access recipe and complete assembly/cost comparison required; measured compiler bytes/cycles remain Unknown until Phase 2. |
| H3 | Pass: existing saved vector links and status/register saves; no new function storage, heap, or runtime flag. |
| H4 | Pass at contract level: no new data/ZP/scratch object; all emitted and existing-ROM bytes, stack and cycles must be reported separately in Phase 2. |
| H5 | Pass: exact device order, discarded ending-game pending events, named stock-entry bounds and diagnosed unsafe releases. |
| L1 | Unchanged: no grammar or source-syntax addition. |
| L2 | Pass: existing LIFO restore operation acquires its safe, profile-specific reverse handoff. |
| L3 | Pass: users keep the existing install/restore calls; they do not program ROM reload values or manually order the release transaction. |
| L4 | Pass: one direct final-release recipe; no manager, scheduler, generic restoration system or separate API. |
| L5 | Pass: no duplicate release operation; main epilogue is not a second handback owner. |
| L6 | Pass: existing source-linked E10278 for dirty inner releases, unqualified predecessors, raw invalidation and unreleased handlers. |
| L7 | Pass: ownership and final-release classification are compile-time facts; no runtime ownership check. |
| L8 | Pass: nested routes, calls/branches/loops, read-only observations, volatile effects, raw writes, status and saved-vector identity are covered by ST-1–ST-11. |
| L9 | Pass: ST-1 is the complete positive entry/use/release example; ST-4/ST-5/ST-6/ST-11 are named unsafe boundaries. |
| C1 | Unchanged: lexer/parser and public operation signatures are untouched. |
| C2 | Pass: final-exclusive stock handback versus clean inner vector-only pop is explicit; unsafe or ambiguous classification yields E10278. |
| C3 | Pass: ordered direct mask/stop/read/reload/vector/enable/start/status transaction is specified. |
| C4 | Pass at contract level: eleven independent source/output/runtime cases plus directed implementation checks; tests are not yet written or executed. |
| C5 | Pass at contract level: four sequential fresh VICE profile cases with pinned ACME/VICE and stock entry; physical CIA-edge QA remains RD-10. No runtime pass is claimed. |
| F1 | Pass: no new syntax/API or state object constrains later independently proved ownership support. |
| F2 | Pass: selected PAL/NTSC facts choose the reload; no runtime profile dispatch or new universal assumption. |
| F3 | Pass: exact volatile directions/count/order constrain only observable device effects; normal IL and peephole optimization remain legal around them. |
| F4 | Pass: explicit approved correction to the existing frozen profile contract, not an experimental source feature or silent redefinition. |

**Disposition:** the approved Tier-2 target-library correction satisfies the
guard's design/applicability gate. Implementation qualification remains open.

## Corrected non-active specification

Only the cooperative return paragraph in candidate `spec/appendix-c64.md` is
expanded: exact captured-state restoration remains the rule, with the expressly
approved four-PRG stock CIA1 exception. It names final-release ownership,
read-only/nested/raw boundaries, all ordered device/vector/status effects, exact
PAL/NTSC reloads, and excluded custom state/missed ticks/other profiles. Matching
candidate RD-05 R5.4/AC-04 text is corrected. No core chapter or grammar changes.

The candidate retains all 45 specification paths and the same 18 normative
members. The recomputed raw GNU record-stream specification digest is
`1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf`.
Only the appendix contributes new normative bytes; inventory identity refresh is
non-normative bookkeeping. This candidate includes the previously approved
RD-04 diagnostic errata. The live specification remains unchanged until final
exact-evidence approval and byte-identical migration.

## Candidate expert preparation

Version 2.0.1 remains non-active. The router adds one conditional load of the
stock CIA1 handback section. Existing SFA, IL, allocation, lowering and parity
doctrine is unchanged except for version/specification identity bookkeeping.
The independent semantic/optimization/simplicity reviewer confirmed that the
eight otherwise unchanged references compare byte-identically after normalizing
those identities. This interim review is not the final activation review.

Packaging validation passes. The candidate retains exactly 22 skill files,
thirteen runtime references and 112 unique case identities with matching coverage
rows. Existing baseline headers name 2.0.1; references that did not have such a
header do not acquire one. The diagnostic count is reconciled to 184 active
codes, including the previously approved E10280/E10281 identities.

| Identity | SHA-256 |
|---|---|
| Candidate router | `8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68` |
| Initial candidate runtime payload: router, metadata, thirteen references | `11c99ea065d01d4cc388e69ce158852fda112d8df41ac6bb005f74aaadeea76f` |
| Candidate runtime payload after two crosswalk anchor repairs | `627fc804ab8e7cb7ca9414987557700cf165f00aa9da9e00b710e65adc05fa16` |
| Candidate runtime payload after reviewed provenance/precision corrections and status-neutral binding | `423e8907096fb5cdf533890c22c0a7b567cf70b935c83878c6c48cad9a768397` |

### Qualification dependency closure

| Group | Cases | Reason |
|---|---|---|
| Handback | Q-P23 | New discriminating stock-handback contract; identical evaluator prompt to the accepted old-baseline run. |
| IRQ and return | Q-P07, Q-P09, Q-L29 | Pending-source ownership, CIA timer/IRQ behavior and profile-qualified exit are directly affected. |
| Specification corpus | Q-L01, Q-L24 | Full 45-path crosswalk and diagnostic ownership include the approved appendix and inherited diagnostic identity corrections. |
| Errata and unchanged controls | Q-A15; Q-C13, Q-L03, Q-L06, Q-R08, Q-P10 | Errata procedure is affected by the new identity. Fixed controls protect CPU legality, volatile effects, SFA lifetimes, simplicity and CIA port ownership. |

These twelve cases cover all five existing qualification families. Evaluators
receive only prompts, candidate runtime knowledge and the permitted raw
specification/context artifacts, never case oracles, prior results or compiler
implementation. Graders receive separate frozen-oracle/answer packets. Existing
case expectations are unchanged except the independently source-reviewed Q-L01
provenance erratum below; new Q-P23 was frozen before either evaluation.

### Corrections and first qualification results

The deterministic check found two inherited crosswalk links to nonexistent
`acme-and-artifacts.md#artifact-boundaries`. Only their anchors change to the
existing `#five-separate-boundaries`: rows for Chapter 13 and evaluation F015.
All 84 runtime Markdown links/anchors now resolve. No artifact semantic text
changes. A fresh Q-L01/Q-L24 corpus packet covers the final anchors; original
captures remain historical and are never modified.

Independent source/dependency review found one minor missing owner heading in
CASE-Q-P23. Adding the exact stock-handback section to that existing coverage row
resolves it without changing knowledge or oracle. The same review found no
missing fresh-case dependency, and confirmed that the two link repairs require
only the corpus rerun. This is interim closure evidence, not final activation.

Initial separate grades: Q-P23 and Q-P09 Pass; Q-L03/Q-L06/Q-R08 Pass.
Q-P07/Q-L29/Q-C13 had answer-completeness failures. Q-A15/Q-P10 lacked concrete
permitted scenario inputs needed for complete fact/impact or scan accounting.
Fresh isolated IRQ/control packets retain the original prompts and frozen
expectations, and add explicitly synthetic raw scenarios. No old answer, grade,
oracle or implementation is supplied to those evaluators. Knowledge is not
changed to accommodate an incomplete answer; all final grades remain required.

### Source-derived Q-L01 erratum

The full corpus check exposed a prior categorical source-attribution error:
Q-L01 and its dependent crosswalk said ACME selection cannot follow from the
specification, but the unchanged normative C64 Common Machine Contract explicitly
names ACME 0.97. Independent source review checked that contract, the exact
project-policy excerpts, EN-10, the future register and conditional router paths.
It approved reopening only this source/oracle clause, not changing the assembler,
source forms, CPU behavior or resource rules.

The refrozen invariant distinguishes target/toolchain prescription from
source-language/CPU semantics. Repository parity-debt issue authorization still
needs its hash-pinned project-policy source. The source erratum and invalidation
of prior Q-L01 qualification are append-only case history. Refreeze precedes
dependent knowledge correction and a fresh blind corpus run. The other 110
preceding oracle sections remain byte-identical; Q-P23 is the only added case.

Two small crosswalk precision repairs follow the same unchanged governing text:
enum conversion is type-valid without a member-value range check; reconsideration
triggers are required where applicable, not for resolved entries with resolution
records. The reviewer refuted the broad shallow-routing allegation because the
router already loads the conditional union of required branches.

The manifest's historical AGENTS hash `28627e0c…` is recovered exactly at
`a96cfd3c41a456d4d4f983021cf43535a1d5bdaa`. Current hash `648e2400…` is distinct.
Relied-on assembler/commit excerpts are byte-identical; the parity excerpt changes
emphasis markers only. The candidate records both provenance records without
relabelling historical bytes or importing unrelated project-status changes.
The specification binding now defers activation status to the release record,
like the router; it will not leave an obsolete pending-activation claim in frozen
runtime content after release bookkeeping.

### Independent grading disposition

The Q-L24 corpus grader mistook the required no-artifact consequence for a
measured compiler result. A separate semantic reviewer checked the complete
answer context, frozen oracle and grade: the answer repeatedly distinguishes
required behavior from actual compiler behavior Unknown. The reviewer grades
Q-L24 **Pass**; the original failure capture and corrective disposition are kept.
This does not change the oracle or imply a compiler/runtime measurement.

### Retained-history source correction and response completeness

The second source review found that the inherited Q-L01 wording demanded a
historical standalone migration/HLE disclosure file no longer present in the
frozen 45-path inventory. The manifest explicitly records that removal. The
review approved replacing that obsolete file obligation with the live governing
disclosures: Chapter 04 division bounds, Chapter 08 unchecked/banked access,
Chapter 13 trusted-media/overwrite boundaries, and Chapter 14 retained diagnostic
retirement/migration dispositions. SC-152–SC-155 remain historical lineage.

This source-gate correction was recorded and refrozen before the fresh
`candidate-ql01-final` evaluation. That capture supplies the live effect/lifetime
disclosures but omits the separate retained diagnostic-history table. A fresh
source-only diagnostic-history probe supplements it; no expectation is removed
to accommodate the omission. Other 110 old oracle sections remain unchanged.

The final Q-L29 grade passes the main entry-lowering capture plus a fresh source
probe that names all five permitted CPU intrinsics and the typed `setIRQ` remedy.
The grader also records one non-disqualifying overbroad sentence in the probe:
it must not override the main capture's separately proved masked active-vector
update. Final semantic review examines that discrepancy before clearance.

The coverage header is made status-neutral before the immutable checkpoint.
It defers gate/activation state to the sole release record; otherwise it would
incorrectly keep claiming non-activation after the later release binding. This
bookkeeping changes no runtime knowledge, case oracle or qualification decision.

## Qualification results and independent corrective dispositions

The twelve selected cases now have passing contract/knowledge evidence. Separate
captures, original grades, packet manifests and output hashes are preserved in
the candidate's existing `qualification/release.md`; case-result fields and the
coverage impact audit are complete. The remaining 100 cases inherit only their
reviewed unchanged oracle and routed semantic/source inputs. All 112 invariant
sections were independently checked for omitted dependencies.

| Case group | Final evidence |
|---|---|
| Q-P23 | Original candidate handback capture and separate grade Pass. |
| Q-P07 / Q-P09 | Final IRQ-entry capture / original CIA-effect capture and separate grades Pass. |
| Q-L29 | Main entry capture plus source-remedy probe jointly Pass. |
| Q-L01 | Complete 45-path audit plus retained-diagnostic-history probe jointly Pass. |
| Q-L24 | Final corpus capture and separate grade Pass. |
| Q-A15 / Q-L03 / Q-L06 / Q-R08 / Q-P10 | Complete control capture and separate grades Pass. |
| Q-C13 | Fresh general proof, exhaustive separate analytical grade and independent source-chain correction Pass. |

Q-C13's proof output SHA-256 is
`769b9976b6aacc6e7c34fd468244943d38666f5e4ddfb371f754b379839dfbe5`;
unchanged oracle section SHA-256 is
`65cf1b1e3011e4771d27662c1a7d0c6deb20662a8fcd426c1c3e5d13e30a922d`.
The separate grader confirms all 84 result entries, 22 selected instruction
streams, seven comparisons and five lower-write alternatives, including flags,
path costs and RAM traffic, through 6,301,696 abstract-model evaluations.
Its remaining missing-path complaint is independently resolved: all six cited
paths exist in the actual evaluator packet. The source chain pins MOS-PGM
Appendices B/C and Chapter 10 §§10.0–10.4, MOS-HW and the WDC bus table.
The intentionally narrower grader filesystem is not the evaluator's source
boundary. The original Fail and this corrective Pass are both preserved.
No assembler, compiler, VICE or hardware execution is claimed.

The Q-L29 probe sentence rejecting every already exposed transition is excluded
from authority. The actual runtime doctrine and main capture permit a separately
proved interrupt-masked active-vector update. Both independent reviewers refute
the probe's blanket statement; its joint case Pass does not validate that sentence.

### Corpus-audit allegations and bounded dispositions

| Allegation | Independently checked disposition |
|---|---|
| Chapter 15 stable/provisional labels | Real nonmaterial stability-metadata wording drift at lines 5/550. Profile acceptance and runtime semantics are determined; no unapproved chapter edit. |
| First-profile raw IRQ checklist | Overbroad shorthand, not undetermined availability: appendix G3 lines 1095–1098, default sinks and takeover delta explicitly restrict raw entry to raw profiles. |
| F019 “Any read” warning summary | Stale subordinate non-normative summary at line 640; F019 line 244 and normative Chapter 03 lines 126/539 determine function-local W10190 scope. |
| F017 “deterministic results” summary | Overstated non-normative summary at line 1168; F017 line 1154 and normative Chapter 04 lines 133–155 preserve bounded unspecified runtime-zero results. |
| Exact route coverage described as shallow | Refuted by the router's existing conditional union of required branches. No new routing framework. |
| Historical/current project-policy hashes differ | Distinct identities are explicitly retained and their relied-on excerpts compared. No fabricated same-hash claim or absent-policy implementation inference. |

These presentation/history notes stay visible; a passing audit does not claim a
spotless historical corpus. None changes an accepted program's runtime contract,
requires a user decision, or authorizes expanding this correction beyond its
approved appendix/RD/expert boundary. Final exact-identity review remains required.


## Final reviewed candidate and activation handoff

The user granted the required exact-candidate activation approval with “I do”
on 2026-09-30. Task 1.3.1 may now migrate the recorded candidate byte-identically;
compiler work still waits for the immutable content and release-binding commits.

Before migration, the default whitespace audit reports 583 warnings: 558 blank
capture lines represented by `> `, 24 original two-space Markdown hard breaks,
and one harmless EOF blank in the C64 case file. Independent source review
classifies all 583; no accidental trailing whitespace exists in authored additions.
All 19 decoded captures still match their originals. These narrow capture/EOF
exceptions preserve the explicitly approved identities; ordinary authored content
retains the default whitespace rule. No global suppression or formatting rewrite
is applied to frozen evidence.

Task 1.2.3 is verified; this plan is 5/19 complete. Both independent final
reviewers returned **no findings**. They independently reproduce the exact
specification/runtime/router/qualification identities below and reviewed release
snapshot `eee80b2260a60bc229a811bcbd2d383fa127a8522084209675c465c9d93950b7`.
The only later candidate change records their verdicts and candidate gate state
in release.md; frozen runtime, specification and six-file qualification payload
remain unchanged.

| Final candidate identity | SHA-256 |
|---|---|
| Specification 4 normative corpus | `1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf` |
| Expert 2.0.1 router | `8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68` |
| Expert runtime payload | `423e8907096fb5cdf533890c22c0a7b567cf70b935c83878c6c48cad9a768397` |
| Frozen six-file qualification payload, excluding release | `b77c3c3b5c1e5a1ba723cb007910d19ff324eea74d6bc9d0349202c3e9849c91` |
| Final draft release record, including bound review verdicts | `1d9b13c2931038a8955d77bce3f4b81c6ba3eed5f3b26437d21000560e6419ae` |
| Complete 22-file candidate skill tree | `85cfd0a19e06e8fa3c66f70ac3dcdbe8cfc465179be48961f190ee6ae6eeeca7` |

Source reviewer `/root/cia_return_final_source` checks the 12-fresh/100-inherited
closure, all 112 invariant sections, all 381 captured packet-file hashes and
all 19 capture texts; zero omitted material source conflict remains. Semantic
reviewer `/root/cia_return_final_semantics` checks stock handback order/ownership,
independent Q-C13 behavior/cost proofs, all 27 guard results and exception/deferral
scan. Both confirm no added API/storage/manager/runtime, no SFA/IL/peephole doctrine
change and no blocked optimization path. Neither review qualifies compiler output,
VICE or physical hardware.

Current direct checks pass: skill packaging, 22-file/thirteen-reference topology,
112 unique cases/twelve appended results, 84 runtime Markdown links/anchors,
45-path/18-member specification scope/digest, touched documentation check and
`git diff --check`. Live spec, expert skill, compiler and tests remain clean.
Markdown is excluded by the existing Prettier ignore policy; that command's
success is not substituted for manual structure/link/source validation.
The roadmap engine reports only the pre-existing portfolio drift; portfolio
writes stay deferred on `feature/v4-rebuild`, as required by the branch rule.

The non-active candidate remains at `/tmp/blend65-cia-return-candidate.usrAwL`.
Final exact-candidate activation approval is required by task 1.3.1. Approval
will permit byte-identical migration of only the approved appendix/inventory,
matching RD text and sole expert baseline, followed by immutable content and
release-binding commits. No push is authorized. Phase 2 specification tests and
compiler implementation remain untouched until both authority commits are green.

### Green authority checkpoint — 2026-09-30

The user approved the exact reviewed candidate with “I do”. The 22 skill files
and three specification/RD files migrated byte-identically. Immutable content
commit `1ce4852016e2a883cf1f733c6014c45e176bfc69` binds full-tree digest
`85cfd0a19e06e8fa3c66f70ac3dcdbe8cfc465179be48961f190ee6ae6eeeca7`.
The following release-binding commit, containing this checkpoint, activates
expert 2.0.1 and records that immutable content ID. Only release bookkeeping and
this plan's progress/evidence/roadmap change after the content checkpoint.

Direct binding checks pass: exact 18-member specification identity, runtime,
router, six-file qualification and content-checkpoint hashes; 22 regular files;
112 unique cases; byte-identical unchanged payload and capture-record suffix;
84 runtime relative links/anchors; packaging, targeted formatting and the
ordinary whitespace check. Runtime/source-key bytes and all independent grades
are unchanged. `spec/`, compiler and tests are clean. Markdown's existing ignore
policy is unchanged. Compiler and runtime handback are not yet qualified.

Phase 1 is documentation-only. Its mandatory correctness review still runs;
security/performance auditors are skipped under the configured docs-only rule.
Phase 2 remains closed until that review clears. Portfolio sync remains deferred
to integration under the existing branch rule. No push is authorized.

The following mandatory review completed on 2026-09-30:
`/root/cia_return_phase1_review` reports **no findings**. It reproduces the committed
phase diff and bound digests, confirms all 112 unique identities and reuse of the
unchanged qualified payload, and verifies captured-evidence equality and zero
spec-test mutation. Source, semantics, standards and simplicity lenses are clear.
The release binding is `e063ef575d13c02c076c94e24616dd27ae4a75e2`, following immutable
content `1ce4852016e2a883cf1f733c6014c45e176bfc69`. This is the completed green
authority checkpoint. Phase 2's baseline tree is
`07933e91be7c66723f357ebe55f780ae2d668156`; frozen authorities are clean.

### Exact non-active specification delta

This is the reviewed candidate text, not an independently active specification.
The matching RD change is limited to R5.4 and AC-04. Migration checks will bind
these exact complete file bytes as well as the corpus and skill identities above.

| Candidate file | SHA-256 |
|---|---|
| spec/appendix-c64.md | `70e822e3ec88506fd694303d98f37b8eacc0bf6cb4febb5fe7fea5d4f0fe25f2` |
| spec/00-normative-inventory.md | `f0e9de860cc820c950188cb2e2ab77c89e836168475921c4ba568c7c0068c6bb` |
| RD-05 requirements | `c4ff590286f421dcf463ef03b0d64f4fe3b3d907fc7f9903532c99cd264613ac` |

```diff
@@ -239 +239,23 @@ then restores the exact captured compiler-owned port, vector, device, interrupt,
-state and executes `RTS` to BASIC.
+state and executes `RTS` to BASIC, with the CIA1 stock-service exception below.
+
+For the four cooperative PRG profiles, stock BASIC/KERNAL entry excludes custom resident IRQ or
+CIA1 service. The final compiler-owned exclusive `restoreIRQ()` restores stock CIA1 Timer A
+service, not arbitrary prior mask or reload-latch values: those values are write-only and cannot
+be captured by reading CIA1. This handback occurs even when the exclusive route made no typed
+CIA1 write. Counter observation alone, without an exclusive route, creates no handback obligation;
+ordinary chained routes do not acquire it.
+
+Within the existing IRQ-masked restore transaction, the compiler clears all five CIA1 source masks,
+stops Timer A while retaining its TOD-input bit and stops Timer B in stock mode, then consumes CIA1
+pending sources with exactly one ICR read. Ending-game pending events are discarded. It writes
+the stock Timer A reload low byte then high byte: PAL `16421` (`$4025`), NTSC `17045` (`$4295`).
+It restores both bytes of the exact saved predecessor CINV before enabling only Timer A, then
+loads/starts Timer A in the pinned KERNAL mode while preserving its TOD-input bit. Finally it
+restores caller CPU status, including I and D. No whole `IOINIT` call, additional source operation,
+runtime ownership flag, device-state manager, or function storage is introduced.
+
+A clean inner LIFO restore remains vector-only. An inner route that changed CIA1, an unqualified
+nonstock predecessor, or a known raw mutation outside the proved typed ownership contract is
+rejected with E10278 rather than silently resetting another owner. The stock-service exception
+does not reconstruct missed KERNAL ticks or custom pre-entry state, and does not broaden CIA2/NMI,
+VIC-raster, D64, or raw-takeover ownership. Other captured-state restoration remains unchanged.
```
