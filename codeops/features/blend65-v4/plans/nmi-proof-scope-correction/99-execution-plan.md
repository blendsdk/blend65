# Task T-06: Approved NMI proof-scope correction

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Progress**: 1/1 tasks (100%)
> **Last Updated**: 2026-10-03
> **Phase baseline tree**: 220505e0349adb6ec69c496c508217af6c03d39a
> **Scope mode**: strict

## Objective

Apply [NMI AR-P7](../rd-05-nmi-cia2/00-ambiguity-register.md)'s approved narrow
authority correction. The user said: “commit and push all we have first. I approve
the correction, continue further.” The four existing commits were pushed first,
through `29df7555`. The remaining RD-05 effort handoffs are waived; recommended
effort is xhigh for this safety-sensitive authority task.

**Smallest viable design:** Reuse the existing specification inventory and expert
qualification/release procedure. Stage expert 2.0.2 outside the working tree;
freeze a discriminating oracle before changing its guidance. Independently review
the source/oracle, qualify changed and dependency-traced cases with isolated
evaluators and separate grading, then activate the exact qualified content.
The active 2.0.1 baseline stays unchanged until qualification passes. No new
qualification framework, dependency or persistent runner is introduced.

The explicit D3 exception covers Chapters 06/11/14/15 and their non-normative
identity record. R5.17 and corresponding expert knowledge/oracles receive the
same proof boundary. NMI remains externally unbounded. Only complete generated
routes proved reentrant without invocation-private RAM/ZP homes may use the
exception, and only on the four cooperative KERNAL profiles. Unsafe private
overlap, recursion, compiler-controlled growing-stack cycles, incomplete proof,
ABI/device/vector/banking/lifetime errors and finite resource overflow still fail.
No new source restriction or event suppression is authorized. External aggregate
hardware-stack use and retained-firmware reentrancy/completion remain unproved.
Finite deadlines still require real arrival/completion proof.

**Expected modification set:** This mini-plan, the existing NMI decision register,
feature roadmap, RD-05 R5.17, the five specification files above, and existing
expert runtime/qualification files needed for the version, identity and traced
correction. This includes source-determined expert errata discovered during qualification,
not unrelated specification repair. AR-P9 additionally authorizes only the three public identity
fields in `packages/compiler/src/build-info.ts` and existing authority/freeze checks in
`test/foundation.spec.test.ts`, retaining all historical negatives and exact-byte protection.
No generated-code, CLI, package configuration, example, dependency or CI changes. Exact obsolete
NMI acceptance expectations and keyboard API decisions remain separate gates. Portfolio
synchronization waits for integration.

## Task

- [x] T-06.1 Correct, qualify and activate the approved authority boundary. Verified on 2026-10-03: exact 2.0.2 content binding, all foundation negatives, complete project verification and independent binding-integrity review pass.
      **Deliverable:** Consistent normative wording and new raw-byte identity;
      expert 2.0.2's strengthened positive/negative NMI oracle, changed/dependent
      isolated captures and independent grades, source/semantics review,
      dependent-decision dispositions and exact single-active release binding.
      Keep historical captures unchanged. Record generated-route facts separately
      from unproved external stack/firmware facts; do not claim compiler or silicon
      qualification or close DEF-7/RD-05.
      **Verify:** Specification membership/digest and exact approved diff,
      skill topology/frontmatter/YAML/links/source keys, dependency closure,
      oracle-first ordering and behavioral qualification, applicable Language
      Guard and hardware-exception scan, targeted formatting/whitespace, candidate
      to live byte equality, and independent whole-task correctness/semantics
      review. AR-P9 adds directed foundation tests and full install/build/typecheck/test verification.

## Verification and impact record

### Activation dependency — NMI AR-P9

The final impact check found that `packages/compiler/src/build-info.ts` publishes the old
specification and expert/content identities, and `test/foundation.spec.test.ts` pins their
exact freeze bytes/checkpoint. Leaving either unchanged would misidentify the release or
break the foundation guard after authorized activation. AR-P9 now explicitly approves only
those three public metadata fields and the corresponding active-authority/freeze checks in
that existing test, preserving all negative cases and exact-byte protection. The user replied
“Yes, approve this bounded identity synchronization”. No lowering, runtime, new metadata schema,
NMI acceptance expectation or generic release framework is authorized.

The independent challenge recommends the existing two ordinary green checkpoints:
first preserve the old selected authority and its historical negative guards while
pinning the exact qualified/inactive candidate's complete raw bytes; then, with its
content commit known, bind the three public fields and replace the temporary
candidate check with the exact active freeze. The second checkpoint requires the
narrow metadata/test bookkeeping exception to the original release-only binding
set. AR-P9 approves this bounded synchronization, not an active-release claim.
A content-only Git object or generic pending-release switch is unnecessary.

Crash-safe, non-installed qualification backup:

`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/nmi-proof-scope-qualification.QpwsyV`.

It retains only candidate/specification bytes, permitted packets, captured answers/run logs
and manifests. Authentication, automatic plugin caches and conversation/history stores
are excluded. This is local evidence preservation, not a second active skill or a release
claim. At the initial preservation point the live expert/specification remained unchanged.
The qualified candidate is now migrated byte-exact but inactive; final focused joint grading passes.

Prerequisite source/oracle review found two draft precision errors before knowledge
authoring: “storage-bearing” needed to mean invocation-private RAM/ZP, and a shared
RMW warning must not become a new source rejection. The draft was corrected to the
approved boundary; the original is retained in the temporary evidence directory.
Existing E10180/E10181 recursion diagnostics are preserved rather than reassigned
to E10245. These are authority-consistency corrections, not new product decisions.

Independent read-only source/semantics review cleared the final normative identity
`566da991146be7ef6a09efa63449421e27c4873cde9788c84220d187460586f7`
and runtime digest `b87ef4e32cc3854e01994c140218c8157e4ba947d599916d501a4bc46f8cf983`.
Before definitive runs, three precision fixes clarified E10245 outside the four
profiles, the bounded comparison scope of existing optimization costs, and the
matching source-manifest derivation. They add no policy, ordering or machinery.
The unchanged Q-C25/Q-C26/Q-C27 mode/frontier oracles remain mandatory.

All 27 actual Language Guard rules were assessed. P1/P2/P4/H5/C5 pass only at
their stated profile/bounded-verification scope; these conditions are explicit
claim limits, not waived rules. The independent final omission scan accounted for
all ten HLE entries. HLE-004's interrupt-domain subsection already covers the
approved exception; no new exception identifier or source restriction is needed.

The independently traced fresh set is Q-L01/Q-L03/Q-L04/Q-L07–09/Q-L11/Q-L24–25/
Q-L29/Q-L32, Q-C07/Q-C18/Q-C23/Q-C25–27, Q-P02/Q-P04–11/Q-P13/Q-P17/Q-P19–21/
Q-P23–24, Q-R04/Q-R08/Q-R10–11, and Q-A15: 38 cases, including four fixed
controls. The remaining 75 may inherit only unchanged contracts and decisive
facts, with their actual old capture identities retained. Definitive evaluation
uses fresh OS-isolated case-family packets without qualification/oracle/history;
separate graders receive frozen expectations and captured output. Qualification
remains pending.

### Qualification corrections and final freeze

The first independently graded NMI response passed seven cases but exposed a
pre-existing BRK source-surface claim in expert 2.0.1. The complete-corpus response
also exposed pre-existing ordinary-function/handler-flow conflation. Both expert
claims were corrected against existing normative owners, without changing the
specification or oracles. CPU BRK semantics remain; no public `asm_brk` exists.
Ordinary `fn` storage remains legal; handler values have the existing direct/
same-kind conditional sink flow and explicit one-way `word` exposure.

Derivative HLE ownership, Chapter-14-only diagnostic extraction and the bounded
known-copy disclosure were clarified. The first Q-L01 grade failed two evaluator
reasoning claims: a scope-versus-borrow-lifetime conflict and a mixed-addressing
FUT-016 cost. The source reviewer independently refuted the former and reproduced
the latter. These failures remain recorded; they are not silently changed to passes.
The guide now requires like-property conflict checks and costs from actual selected
addressing forms. No required governing field is unresolved: introduction/index
authority, Chapter-02 conversion costs and the current JSR/RTS ABI have unique owners.
Unrelated retained-copy maintenance is separately owned by roadmap T-07; it receives
no specification-edit authority from this task.

The independently reviewed semantic-repair runtime is
`1f84a10dff93f598e5a8a8d16eda2d30d3e38327146bd30c2762df48f4e77e7f`;
the normative `566da991` identity and frozen oracle hashes are unchanged.
Q-L01/Q-L11/Q-L29/Q-L32/Q-P07/Q-P24 require new isolated evidence;
Q-C07 is the fresh unchanged control. The NMI family additionally reruns
Q-L08/Q-L25. Other initial captures retain their actual `b87ef4e3` runtime
identity and may qualify only independently reviewed unchanged decisive facts.
The routing grade then found the pre-existing Q-R04 manifest made lowering
conditional although its frozen oracle always requires all five domain modules.
The smallest correction aligns that one raster-IRQ/scratch route in the router
and manifest. Independent review cleared final runtime
`639cd7277009ec051ffa2f985bee247ae5307fbed879098ce6206e6b4593a659`
and router `0152f760035a8b5d1c89e3e6d2dc02062857f2860c79e9622f00433dc40f223a`.
Q-R04 receives fresh evidence with Q-R08 as simplicity control. Q-P11/Q-P20
receive fresh responses for evaluator omissions (multi-SID profile ownership
and justified static replication), not knowledge/oracle changes. The reviewer
compared actual packets and confirmed `1f84a10d` NMI/corpus/control evidence
remains applicable only at unchanged decisive facts and its real identity.
Final qualification and activation remain pending.

The semantic-repair NMI grade passed six cases but failed Q-P24's exact library
ownership boundary. All numbered route decisions and costs passed; the response
allowed developer interpretation as an alternative to the required standard
platform-library responsibility. The guide's omission was repaired explicitly:
ordinary saved-keyboard/both-joystick decoding lives in Blend65 platform libraries;
compiler entry/storage/volatile proof stays separate; debounce/repeat and gameplay
remain user code. No API, complete scan or new runtime is approved. Independent
source review cleared runtime
`0c078efbd0f4b351fd3b0a0c9675fd717597087685f6d345a6f01d763ce41dfe`
and router `74b1c0b90aac9999f556e7dd4530c035c8c4456de1f0a57f660c3dc4ab00d43f`.
Fresh Q-P24 with Q-P07 control tests this ownership correction. Earlier corpus,
CPU and routing facts remain applicable only at their unchanged decisive inputs
and real `1f84a10d`/`639cd727` capture identities. The failed Q-P24 response does
not qualify the corrected ownership field. Final activation remains pending.

Q-C07's fresh independent grade passed every numerical and semantic check, while
identifying one minor pre-existing cost label: 36 cycles reach CINV dispatch,
not binary Blend65-body entry. The final guide labels dispatch and adds the selected
compiler prologue separately. Runtime is now
`280ae28fdbf7ef9eb01ec5e8e618d84600df930a31ae3f38bf2cb25cca857a0e`;
no instruction, table or numeric fact changed. Its precise inheritance disposition
and final activation are still pending review.

The complete refined Q-L01 audit independently passed. Its two remaining expert-copy
findings were real: SFA's general provenance paragraph still blurred ordinary `fn`
storage with non-storable handler expressions, and IL's status list differed from the
router's exact Status/Claim kind split. Both duplicate copies now state the existing
governing rules explicitly. Runtime is
`5a422482f1c82d1ed15f61d35e447f9cd6e9af80bd930841a82a4c0de8128bef`;
router and specification/oracles are unchanged. Fresh isolated Q-L29/Q-R11 with
Q-R08 simplicity control verify those precise fields. No new semantic policy follows.
Earlier captures retain their actual identities and only unchanged decisive facts.
The audit's stale binary-AND numeric annotation is separately owned by T-07;
grammar explicitly delegates behavior to the Chapter-04 precedence table, so the
governing level-seven rule is not an unresolved parse choice. Final activation
and whole-task review remain pending.

The final precision grade passes Q-R11/Q-R08 and every repaired handler-flow/ABI/cost
fact, but fails Q-L29's full response for one evaluator omission: it does not explicitly
state that raw decimal-mode source intrinsics are absent. The existing closed five-name
surface and emitted D-normalization rules already determine this field; no guide or
oracle change is needed. The failed capture remains recorded. One fresh, focused
source-surface completion and separate grade are required before activation; a broad
batch is not repeated merely to seek a simultaneous all-pass transcript.

### Final documentary qualification — 2026-10-03

The fresh focused decimal-source response and independent joint grade pass every
frozen Q-L29 invariant. Its original full response remains FAIL, and the focused
answer alone is not represented as a complete original run. The first joint-grader
process ended at status 143 with an incomplete turn log; its last answer is retained
but not accepted as the final capture. One retry of the identical grading packet
completed with controls, full turn output and exit status 0. This was capture
recovery, not a changed oracle or another whole-batch attempt.

The final documentary candidate has 38 independently graded fresh cases and 75
independently reviewed unchanged-input inheritances, disjoint and complete across
113 cases. Every result retains its actual specification/runtime/capture lineage.
The final runtime remains `5a422482`; six-file qualification payload is
`5944207baae30d079a5bb965fc4441c651a909dc40a79566665d44437c16b8be`.
All case writes precede the immutable content checkpoint. No generated compiler
artifact, new emulator result or silicon guarantee follows from this qualification.
AR-P9 is approved; foundation RED/green, live equality, final review and binding
remain, with no new support framework.

### Qualified-content checkpoint verification — 2026-10-03

Independent foundation authoring preserved all seven historical per-key negatives
and added eleven fixed candidate negatives. Initial directed RED was exactly the
unmigrated candidate, with both historical controls green; after exact migration
all 12 foundation cases pass. Install, build, typecheck and full `yarn test` pass:
3,422 tests overall, two existing compiler skips, and 113 root files/1,662 root
tests. Existing VICE cases ran sequentially; their hardware-unverified boundary
is unchanged. Capture: `/tmp/blend65-authority-checkpoint.uR8yox/`.

Whole-content independent review found only RV-002 (Minor): the current release
gate still described the initial unmigrated state. The staged wording correction
is independently clear and changes no runtime, specification, oracle or six-file
qualification payload. The independent author supplied two new fixed byte
expectations, proved RED on exactly expert/release, then exact release replacement
and all 12 foundation cases passed again. Final inactive full-skill digest is
`a56c667b12450307b676c3f188e9a3898bb3852cff1fd0b14a8048a19a9f27ca`;
release hash is `7a8f7b8f993c04795eca6a7c791de8c94bccf64a9221468ceeb12c4b45d37b1b`.
The 45-file specification and all 22 expert files match the qualified candidate
byte-exact. Targeted formatting, source keys, links and whitespace checks pass.

Before the content commit, a directed Git-read check exposed the default subprocess
buffer limit: the 1,415,070-byte release record failed with `ENOBUFS` after
1,064,960 captured bytes. The existing test reader now uses an explicit 2 MiB
bound, returns every byte with the fixed release hash above, and retains every
assertion. All 12 foundation tests, strict TypeScript and targeted formatting
pass after this test-I/O correction. No authority bytes or runtime behavior change.

This green immutable-content checkpoint is permitted while T-06 remains incomplete:
the project's coherent-green-commit directive and approved two-checkpoint release
sequence govern it. The public selection stays 2.0.1. The next binding checkpoint
must identify this actual commit, replace the temporary inactive guard with exact
active protection, synchronize the three public fields, verify and independently
review the binding. No additional push is authorized by this continuation.

The actual ordinary content commit is
`13b995d0ddacc304aa066e015c14c63678e99dcc`. Independent review cleared the
complete content and buffer-only guard correction. A fresh post-commit run passes
all 12 foundation tests, exercising the full committed-HEAD freeze rather than
the pre-content path. The tree was clean after that checkpoint. Binding is the
remaining part of this task; the content commit itself does not select 2.0.2.

### Active binding verification — 2026-10-03

The independent final authority oracle first produced the prescribed two RED
results: old public metadata and the inactive disk bundle. Historical checks,
all seven historical and eleven current negative fixtures, fixed content-commit
bytes and every non-release disk/HEAD comparison passed. Evidence:
`/tmp/blend65-inactive-authority-red.5PCu1g/active-binding-red.json`.

The three public fields now select the approved specification identity, expert
2.0.2 and actual content commit above. Only the release bookkeeping differs from
qualified expert content. Its final hash is
`1e2c67c3aaa5b68d6a094136e6b415280636d543e7280958770fca5ff4dfaea7`;
the resulting full skill-tree digest is
`16fc1cfe0161a4834d6ead608326cbf85dedf817943936c0320c1abf6b13bd66`.
The existing foundation guard protects exact active working bytes and exact
committed bytes, retaining only the fixed inactive content commit as the
pre-binding historical case. Final install, build, typecheck and full `yarn test`
pass: 3,422 tests, two existing compiler skips, and all 113 root files. VICE
remained sequential. Captures: `/tmp/blend65-authority-binding.9MyTik/`.
Independent binding-integrity review returns no findings, including actual
content ancestry, complete membership, historical capture preservation and
seven historical/eleven current negative fixtures. No generated-code,
NMI-acceptance or new API change occurs.

T-06 is complete. The qualified expert is 2.0.2, bound to content commit
`13b995d0ddacc304aa066e015c14c63678e99dcc`; only its separately pinned release
bookkeeping differs. The current register supersedes AR-P4's blanket admission
gate, not the true absence of a finite external bound. DEF-7 still owns positive
NMI implementation, vector/ABI/source ownership and keyboard prerequisites;
those are not qualified by this authority checkpoint. RD-05 remains open.

No compiler architecture or shipped platform-library behavior changed.
`docs/index.md` has no techdocs opt-in (the file is absent); the existing
`docs/platform-libraries.md` remains truthful and needs no change. No new
documentation framework or unrelated authority-copy repair is introduced.

Final tracking review found RV-003 (Minor): T-05's roadmap summary still called
T-06 executing. That single current-status phrase now says complete. The review
otherwise clears the exact T-06-only disposition; DEF-7/RD-05 and all separate
implementation/keyboard decisions remain open. No authority or test byte changes.

The read-only progress helper prints `Progress: [██████████] 1/1 tasks (100%)`.
Its exit status remains 1 because it also expects a full-plan `00-index.md`;
the execution skill explicitly permits this single-document mini-plan. The
verified checklist is complete; no unnecessary index or workflow change is added.

### Dependent decision audit

| Record                      | Disposition under the corrected authority                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R5.17 / AC-14               | Corrected only at generated admission and external-unproved reporting; existing evidence surface.                                                                                                                                                 |
| NMI AR-P4                   | Admission prerequisite corrected after activation; no finite bound has been established.                                                                                                                                                          |
| NMI AR-P6 / AR-P7           | Revalidated source reconciliation and exact approved scope.                                                                                                                                                                                       |
| Keyboard AR-P2 / AR-P3      | Unaffected; latch recovery and input certainty remain open.                                                                                                                                                                                       |
| T-04 / T-05                 | Revalidated only at their recorded bounded PAL/component evidence boundary; captures unchanged.                                                                                                                                                   |
| Completed IRQ / CIA1 return | Implementation unaffected. Historical 33/256 and 28/256 peak/headroom summaries are corrected in interpretation: bounded generated/reserved accounting, not unrestricted external-NMI headroom. Numbers and original identities remain unchanged. |
| Completed CIA / joystick    | Unaffected delivered device/IRQ/raw-observation boundary; CIA2 guards and hardware-unverified status remain.                                                                                                                                      |
| RD-08 optimizer modes       | Revalidated existing complete-cost closure and ordering; external-unproved is neither zero nor an exact tie.                                                                                                                                      |

No completed implementation needs reopening. DEF-7 and RD-05 are not closed.
AR-P9 adds directed foundation tests and the full install/build/typecheck/test checkpoint.
No generated-code hot path or security profile is affected; independent whole-task correctness
and semantics review remain required. Commits
use the guarded Git workflow; future pushes need a new explicit user request.
