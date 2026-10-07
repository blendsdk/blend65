# Independent phase review: CIA2 ownership

> **Parent**: [Index](00-index.md)
> **Date**: 2026-10-07
> **Status**: Complete — AR-P12 fix-review clear; documentation limits explicitly recorded
> **CodeOps Artifact Schema**: 1

## Reviewed boundary

The original goal is exclusive CIA2 ownership on the four existing cooperative
C64 PRG profiles. The smallest design extends the existing ordered context proof,
finite device facts, direct lowering and existing storage/placement consumers.
Scope is strict: no new API, profile, syntax, runtime, shadow, solver, dependency,
general optimizer or harness. Tasks 1.1.1–1.3.5 are verified; this report owns
1.3.6, not the remaining documentation task or RD-05 closeout.

Phase baseline tree: `c4ede1bc5ac1568637257b3f51cb6d1411e4ba84`.
Review snapshot tree: `bcaec3ec504e9edbaf80776254b362ff3ec38532`.
The complete baseline-to-snapshot diff includes new files and excludes prior
planning changes. Its retained output is
`/tmp/blend65-cia2-spec-kTWCbB/task-136-phase.diff`.

The checkpoint passes frozen install, build, typecheck and **4,975 tests**, with
zero failures and two existing compiler skips. Root: 3,091 cases in 157 files.
All 568 bounded native cases pass without skips. Actual source, bytes, model,
tool and full resource evidence remain in [the qualification record](08-closeout.md).
Only VICE-verified / hardware-unverified claims are permitted.

## Responsibility and independence

| Responsibility                                               | Assigned reviewer                                                  | State                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Correctness, maintainability, standards and oracle integrity | `/root/cia2_phase_correctness`                                     | No findings                                                  |
| Semantic preservation and modern-source DX                   | `/root/cia2_phase_semantics`                                       | SM-001/SM-002 MAJOR; SM-003 MINOR                            |
| SFA/ABI and immutable-link lifetime                          | `/root/cia2_preflight_risk`, bounded SFA charter                   | No independent findings; semantic fix still requires recheck |
| Selected platform and firmware                               | `/root/cia2_phase_platform`                                        | No new findings; TP-003 remains separately owned             |
| Equivalent expert output and complete artifact costs         | `/root/cia2_phase_output`                                          | MC-001/MC-002 MAJOR; existing RD-08 owners, no output waiver |
| Host performance                                             | `/root/cia2_phase_semantics`, separate bounded performance charter | No findings; measured latency/peak memory remain Unknown     |

The runtime refused a fresh SFA thread after reaching its thread limit. The
available independent preflight reviewer therefore received the full local
SFA/ABI charter and a bounded implementation-review packet. Its earlier plan
verdict is not implementation proof. No reviewer authored the production or
specification tests; all review actions remain read-only. The four-total-active
limit and six separate responsibilities are retained. A fresh host-performance
thread was also refused; the completed semantics reviewer received the complete
performance charter for a separate host-cost review, not a second semantic pass.
No competing tests, builds or VICE runs are authorized.

## Oracle boundaries

The exact user-approved old-test exceptions are AR-P3 and AR-P10 in
[the ambiguity register](00-ambiguity-register.md). Existing negative assertions,
source fixtures outside the named witnesses and other ledger rows remain
protected. AR-P5–AR-P8 record the exact approved new-spec observer/extraction
corrections; they grant no general oracle-edit permission.

The pre-production RED JSON reports and authoring records are retained. No
separate source-content snapshot/hash at each new-spec freeze was found. Those
reports prove recorded test execution, not historical byte-for-byte source
integrity. Old-oracle diffs are directly comparable against the phase baseline;
new oracles remain reviewable against requirements and the exact recorded
correction boundaries. This limitation is not represented as a passing content
hash check.

## Findings and dispositions

The original three independently identified semantic findings were reproduced by parent-owned
public checks on all four profiles. Sources and results are retained under
`/tmp/blend65-cia2-review.pdcDY2`. Their bounded corrections are implemented and
verified below; the subsequent review found remaining defects.

| ID     | Severity | Violated boundary and witness                                                                                                                                                                                                                                                    | Smallest necessary correction                                                                                                                                         | Disposition                                                                                                    |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| SM-001 | MAJOR    | Equal live capture reuses a physical CIA2 lease, but a reentrant inner restore deletes it while the suspended caller still requires it. A handler installing/restoring an empty exclusive successor makes the public check throw `CIA2 release lacks its proved physical lease`. | Preserve the finite physical lease and mutation history until every suspended owner/reader has finished; no external-depth counter or runtime.                        | Corrected; public/native and independent fix review pass this invariant.                                       |
| SM-002 | MAJOR    | `clear(mask: byte)` performs a full disable when called with `$1F`, but the invocation proof discards that exact actual argument and rejects the following enable with E10278.                                                                                                   | Carry the relevant exact argument through the existing ordered proof, preserving byte conversions and invalidation; no source workaround, API or general interpreter. | Original helper/wrapper cases corrected; follow-up SM-004/SM-005 prevents closing the argument-proof boundary. |
| SM-003 | MINOR    | An unresolved ordinary/typed release join correctly fails, but its E10278 message omits the canonical `at '<operation>'` field.                                                                                                                                                  | Instantiate the existing template with the affected restore/call operation and preserve its source span.                                                              | Corrected; independent review and canonical public cases pass.                                                 |

The first two findings have eight recorded public outcomes in
`public-check-caught.log`; the diagnostic witness has four outcomes in
`public-diagnostic.log`. No unsafe generated artifact is claimed from a source
which fails before emission. Correctness cleared the exact old-oracle exceptions;
SFA cleared its separate bounded storage/ABI boundary, not these semantic bugs.
User authorization to apply necessary subsequent corrections does not authorize
new machinery, weakened tests, a source restriction or a frozen-authority change.
The original six reviews are complete. Findings remain open until their necessary
corrections and the applicable continuation ruling are verified.

### Correction oracles and baseline

The implementation-blind author owns only the new
`test/rd05/cia2-review.spec.test.ts`, created before any production correction.
Its 24 cases cover balanced nested installation, exact helper/wrapper clears,
partial/unknown-clear controls and canonical unresolved-policy diagnostics on
all four profiles. Directed verification records **16 expected RED and eight
negative-control prepasses**, with no other failure. No old oracle is edited.

The pre-fix tree is `e23bdf9f09a9b181f4e1e06a78a7caafaf4f9154`.
New-test content SHA-256 at 14:40 is
`f4dde80b892bf15dd4786276cf4827832df1170d501de92ba2f05c05f12a39a0`.
Formatting-only final content SHA-256 is
`3e5fd4b6f1d631b2f23dae3aae490b75d9c4bdbffaa6c2ea860138cc844f8a63`;
the final pre-production tree is `0a2387bf70003d1d693f212b0a743ac2ac820571`.
The author confirmed every source and expectation is unchanged. This retained
source tree permits an exact subsequent content comparison; it is not inferred
from the test-result report.

The independent design challenger recommends retaining physical leases while
existing protected capture references remain live, and carrying actual scalar
arguments through the existing ordered invocation identity. It considered
return-time lease reconstruction and parametric effect summaries, but neither
is needed here. Its assessment is limited to supplied source excerpts, not an
independent file inspection or qualification. The parent implements the bounded
necessary corrections under the user's explicit subsequent-fix authority. No
new runtime, solver, API, frozen-authority edit or old-test exception is granted.

### Output findings and ownership

MC-001 measures redundant constant loads: adjacent `$FFFF` CIA2 latch writes
cost 20 bytes/24 nominal cycles versus the equivalent expert's 14/18. Each word
write is 10/12 versus 8/10. Three adjacent zero initializers also retain four
unnecessary code bytes/cycles. Existing #70/RD-08 owns this ordinary forwarding
family. Removing code at the current fixed entries adds equal padding, so the
isolated rewrite saves no loaded/resident bytes.

MC-002 measures the existing cold-layout gap under #96/RD-08. Splitting the
287-byte restoration block at its verified 216-byte instruction boundary and
adding a three-byte jump analytically reduces the base PRG/resident account by
287 bytes at a three-cycle cold cost, while keeping each matching-low entry
fixed. The proposed packed artifact is unassembled and runtime-unqualified. It
does not repair TP-003. These are surviving Incorrect-parity findings, not an
output waiver or a whole-program win. The existing optimization owners remain
mandatory before optimized/game-grade closeout; no general optimizer is added
to this slice.

The selected writer (35 bytes/53 cycles), final shutdown (38/56), empty exclusive
successor (1/6) and empty chain (3/5) meet their equivalent local expert floor.
The output auditor independently reconciled all 64 digests and complete resource
accounts. New local meets require an exact tracked path to the program-scale
win. [Issue #98](https://github.com/blendsdk/blend65/issues/98) records these exact
new local boundaries, complete accounts and the measured #70/#96 path. It was
created under the user's durable mandatory-meet-debt authorization; no issue was
closed/edited and no Git push occurred. No local meet proves whole-program superiority.

## Fix-only review and remaining necessary corrections

Fixed tree: `0728e89c2b05742cac12f7a2852088cd08692443`.
Diff: `/tmp/blend65-cia2-review.pdcDY2/fix-only.diff`, compared with the final
pre-fix tree above. The new immutable specification hash still matches exactly.
Correctness independently reports no findings and no old-oracle/frozen-authority
diff. SFA/ABI independently reports no findings in the assigned storage boundary;
all twelve scoped source/test blobs match the reviewed tree. Semantic review
reports the remaining three findings below, not a clean semantic/DX verdict.
Reviewers ran no competing verification or VICE process.

| ID     | Severity | Remaining defect                                                                                                                                                                                                                                                                                                                                      | Necessary remedy                                                                                                                                                                                        |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SM-004 | MAJOR    | An interrupt can raw-write a caller's parameter while an ordinary helper temporarily installs it, or exposes an IRQ and masks it again before returning. The ordinary-call writer predicate sees no raw write in that helper, and its returned vector state loses the earlier home clobber. An exact `$1F` input can therefore remain falsely proved. | Carry the finite possible-home-clobber effect through the existing ordered invocation/exit and arrival relation. Preserve already-evaluated values separately; no second solver, runtime or source ban. |
| SM-005 | MAJOR    | `peek(&mask); disableInterruptSources(mask);` loses the exact mask solely on forming its address. A read-only borrowed parameter is legal and has not changed.                                                                                                                                                                                        | Retain the exact home fact through address formation/read-only use; invalidate on a possible modifying effect.                                                                                          |
| SM-006 | MINOR    | Unsupported propagated flags are attributed only to the valid reusable helper's platform expression, not to the actual caller supplying the rejected value.                                                                                                                                                                                           | Attach the existing proving call location and rejected actual value without changing diagnostic identity or primary span.                                                                               |

The parent reproduced all three through public services in
`remaining-review-probes.log`. The concrete SM-004 source is
`alias/src/game.blend`: a temporary storage-free NMI handler writes `$01` to the
actual `clear.mask` home `$0CA5`, then restores the quiet route. The public build
incorrectly succeeds; actual memory metadata confirms that address, and actual
assembly contains both the handler store and later helper load at `$0CA5`.
This is an admission/assembly witness, not an executed corruption claim. Its
generation is `0a26356a-1ee8-4a74-ab72-841edfc8c5f7`. The stronger inner-mask
handback and temporarily exposed IRQ variants remain static reviewer witnesses,
not native observations. `borrow/` demonstrates SM-005's E10278 false rejection;
`provenance/` demonstrates SM-006 with an empty related-location array.

Directed correction evidence passes 24 public cases, four fresh sequential VICE
timer witnesses and 44 focused implementation cases, with no skips. The native
witnesses qualify exact ordinary-helper clearing, two balanced handler-side
successor installs/restores, real NMI/RTI, device effects, registers and BASIC
return. The new runtime fixture was corrected only within its implementation
tier to put its handler after main, as the reused observer selects the first
restore expression; no old fixture/oracle or behavior expectation changed.

Fresh install/build/typecheck and the complete suite pass **5,017 cases**, zero
failures and two existing compiler skips: compiler 1,809, CLI 62, language server
21, VS Code six and root 3,119 in 159 files. Root duration: 817.35 seconds.
`checkpoint-fix-{install,build,typecheck,test}.log` retain the results. They prove
the tested cases, not the missing semantic counterexamples. Fresh rebuilds of all
eight earlier native sources retain byte-identical source, assembly, labels and
PRG identities (`rebuilt-{base,decimal}.log`, `rebuilt-check.log`), so their original
bounded qualification is not silently replaced by different bytes.

The normal execution skill permits only one fix-only re-review. That round has
now found a remaining MAJOR defect; no third review is silently dispatched.
AR-P11 requests a single additional bounded correction/verification/review cycle.
The necessary fixes remain within the current ownership/argument-proof contract;
no API, profile, source restriction, frozen-authority change or old-spec exception
is requested. No additional production correction or commit is made while this
continuation gate is pending.

TP-003 remains a separately owned **MAJOR** startup
preservation defect under RD-05 R5.4 / T-09, not a waiver or a new CIA2 operation
failure. RD-05 and DEF-7, keyboard/coexistence, raw/takeover and remaining platform
obligations stay open. No phase-review completion is claimed yet.

## Approved additional correction and review

The user explicitly approved AR-P11 on 2026-10-07. The historical continuation
gate above is resolved; it is not permission for another unbounded review loop.
This section records the one approved additional cycle. The finite possible
home-write effect is carried by the existing invocation/exit/arrival relation,
reset at child and local operation boundaries, and accumulated at returns.
Address formation/read-only use retains home facts. Evaluated argument values
remain separate from mutable homes. No second solver, runtime or API is added.

The independent blind author froze 52 new specification cases before production:
20 intended RED and 32 justified prepasses. Their exact source hashes and RED
tree are in [execution evidence](99-execution-plan.md#approved-additional-correction-cycle).
The required consumer correction distinguishes copied scalar parameter addresses
from aggregate borrowed bases in the existing packed-address lowerer. All 76
combined public cases, 47 focused implementation cases, two storage-binding
cases and four sequential VICE cases then pass without skips. The native cases
also observe the borrowed read returning `$1F`. The earlier eight native artifact
families rebuild with identical source, assembly, labels and PRG bytes; this is
identity reconciliation, not a new full native matrix run.

The additional semantic reviewer identified a narrow caller-note edge:
`byte($180)` produces rejected `$80`, so numeric equality against the original
word argument cannot identify the reaching call. A separate blind author froze
12 conversion cases before that correction: eight RED and four supported
controls PASS. SHA256:
`a282d5fe3dc5c081c883f7c546622d67ef90e0a28cf7a2b2f9235166ce004be3`.
RED: `/tmp/blend65-cia2-conversion-red.AmeSJY/red.{json,log}`.
The existing invocation context now supplies the reaching call for nonliteral
rejected flags; wording states reachability, not that a caller supplied the
converted numeric byte. Roots with no actual arguments do not inherit a false
caller note. No provenance map or new diagnostic identity is introduced.
All 88 combined public cases pass without skips after this correction.

The saved initial additional diff is
`/tmp/blend65-cia2-effects-fix.rFstLv/additional-fix.diff`, baseline
`0728e89c2b05742cac12f7a2852088cd08692443`, fixed tree
`8bf60a9fb576030c9e1349bc7301024e0951bbec`. The diagnostic-only follow-on delta
and final tree are supplied to each applicable reviewer within this same cycle.
No existing oracle or frozen authority changes. Correctness reports no findings
at the initial fixed tree. Remaining independent lenses and the fresh complete
checkpoint were still underway at that interim snapshot; task 1.3.6 was not
verified. The completed additional cycle follows.

### Completed additional-cycle verdict

Final review tree: `6a6f920c0eeddeb7450426f5bef8fafdc383afda`.
Complete diff: `additional-final.diff`, SHA256
`d065c3579afc78b0104f0cffeeb16c8d4abfbf4c5955a63b1c42a207f4609615`,
under the correction evidence root. Later changes are progress/review documents,
not production or frozen-oracle changes. All applicable responsibilities were
reviewed within the one authorized cycle; advisory hardening is not a further
phase-review round.

| Responsibility                                                 | Independent reviewer                | Final bounded result                                                                    |
| -------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| Base correctness, standards, maintainability, oracle integrity | `/root/cia2_additional_correctness` | No findings; final narrow diagnostic delta checked                                      |
| Semantic preservation and modern-source DX                     | `/root/cia2_additional_semantics`   | SM-004/SM-005/SM-006 corrected; no surviving findings in assigned lens                  |
| SFA/ABI and closed address consumers                           | `/root/cia2_additional_sfa`         | No findings; scalar home and aggregate borrowed base remain distinct                    |
| Selected CPU/platform                                          | `/root/cia2_additional_platform`    | TP-004 MAJOR; confirmed and not waived                                                  |
| Equivalent expert output and complete costs                    | `/root/cia2_additional_output`      | New fixed-borrow witness mapped to MC-003 / RD-08 / #70 / #99; Incorrect parity         |
| Host performance                                               | `/root/cia2_additional_performance` | No findings; finite Boolean reset before memoization; measured latency/peak RSS Unknown |

Fresh full install/build/typecheck and all **5,086 tests PASS**, zero FAIL and
two existing compiler SKIP: compiler 1,814, CLI 62, language server 21, VS Code
six, root 3,183 in 162 files. Root duration 697.35 seconds; logs
`final-{install,build,typecheck,test}.log`. All 88 directed public, 47 internal,
two binding and four sequential native cases pass without skips. The four
additional runtime cases retain source/report endpoints, not cleaned temporary
PRG identities. Their NTSC fixture uses model 3/6567; the original GDB evidence
uses separately observed model 4/8562. These model endpoints are not conflated.
Exact frozen review-spec hashes and old-oracle exceptions still pass.

**TP-004 MAJOR:** `interrupt-context-proof.ts:257` retains pre-interrupt
`eligible` after actual RTI returns. After CLI, a quiet NMI can return with I=0,
allowing a pending IRQ before the resumed parameter load. The proof misses that
early home write and derives a falsely exact snapshot. The source/assembly and
pinned CPU-model witness, acknowledgement refutation and smallest transfer
correction are retained in
[AR-P12](00-ambiguity-register.md#ar-p12--actual-interrupt-return-ends-the-prior-old-i-delay).
The independently verified strengthened handler writes the bound `$0B9D` home,
consumes CIA1 ICR once and uses its real KERNAL return; the no-ack looping
objection is removed. Native corruption has not been executed. A fresh advisory
challenger independently recommends the existing restored-I transfer with no
change to the absence branch or storage/runtime.

**MC-003 MAJOR** (auditor-local MC-001): the corrected ordinary scalar borrow
still emits fixed-address→ZP pair→second pair→indirect read. Complete `clear`
cost is 29 bytes/45 cycles/four pointer ZP bytes. The generic expert is nine
bytes/16 cycles; this closed `$1F` witness needs seven bytes/14 cycles. Its
caller plus body is 37/15 bytes and 57/26 cycles. Full generated code/padding is
749/121 bytes, payload/PRG 870/872, startup state/link/parameter 50/2/1, occupied
memory 927 bytes. Keeping the same entry turns the projected 22 removed code
bytes into padding: code/padding 727/143, identical PRG, occupied memory 923
and nominal CPU entry/return 1,014→983 cycles. The projected sequence is not
assembled or runtime-qualified. [#99](https://github.com/blendsdk/blend65/issues/99)
tracks this concrete existing RD-08/#70 witness and the direct certified-storage
consumer seam before closure. Ordinary debt remains Incorrect, not a new
capability waiver or a demand for a general optimizer. Original direct CIA2
writer/shutdown costs and eight artifact families remain unchanged.

At that historical checkpoint AR-P11's additional review cap was exhausted and
task 1.3.6 blocked on AR-P12. The later explicit approval and new bounded cycle
follow. The green suite alone did not override the surviving CPU counterexample.

### Approved CPU-return fix-review cycle

The user approved AR-P12 with “I approve” on 2026-10-07. This authorizes exactly
one additional CPU-return correction, verification and independent fix-review.
Baseline tree: `a22a6e99ea5a45f7eded27f30a552d22a2ec5753`; frozen-RED tree:
`569a00eb8649a556034080d79d0e80ddda5fac5d`; initial corrected review tree:
`b6afc8811a3901be3d3b3999fb3895a72d2a73a8`. Only production difference is the
existing return transfer's `eligible: state.enabled`, with a durable two-line
rationale. No-arrival state and existing key/worklist remain unchanged. The new
specification test is independently authored before production; no old oracle,
expert or frozen specification changes.

Evidence root: `/tmp/blend65-cia2-rti-fix.Muxd4B`. `rti-review.diff` is the bounded
production/new-test diff; `rti-fix.diff` additionally includes current plan and
roadmap bookkeeping. All 108 directed public cases, 38 existing focused internal
cases and four sequential native helper/capture companions pass without skips.
`internal-green-retry.log` is the successful internal invocation; the earlier
`internal-green.log` contains a no-test-files command failure, not a green result.
The earlier eight source/assembly/labels/PRG families rebuild byte-identically
(`rebuild-original.jsonl`), not a rerun of their 568-case native matrix.
Fresh install/build/typecheck/full tests are running; no complete checkpoint
verdict is implied yet. Six required independent review lenses remain pending.

That interim state is superseded by the final checkpoint and verdicts below.

Three CPU-order probes use the existing pinned GDB/text monitor. Source code
programs a real CIA1 one-shot and waits for its pending level while I=1. Only
physical RESTORE input is injected; no PC/frame/ICR/latch is patched. On PAL
6569R3/SID6581/CIA model0/KERNAL3, the preserved pre-fix unsafe artifact proves
CLI→NMI→RTI→acknowledged IRQ→resumed LDA: stack status/PC `$20/$0A5D`, exact
one-byte home `$0C9D` changes `$1F→$01`, and the load returns `$01`. This same
source now fails public check/build with E10278. The no-RESTORE control loads
`$1F` before IRQ (IRQ return PC `$0A60`); an I=1 counterpart preserves `$1F`
across NMI/RTI despite the still-pending IRQ. The masked counterpart is a fresh
current successful build; executing the old unsafe artifact is diagnostic
evidence, not current acceptance. No new CPU semantics or source workaround.

`rti-qualified.json` SHA256
`e49a1a1493be4d4e48f7c7c37844845fb9172587ce3a7c236c01bb074f935172`
binds actual PRGs/source/scripts/logs, observed resources, tool/ROM hashes and
the checker. Final pulse uses fresh `rti-pulse-final.monitor.log`; the earlier
failed quoted-command pilot and appended diagnostic monitor log are excluded.
This is bounded CPU-order VICE evidence, not physical silicon or a global
arrival/stack/deadline proof. Original NTSC8562 and new binary-fixture NTSC6567
endpoints remain distinct. RD-05, DEF-7, mandatory TP-003/T-09 and ordinary
RD-08 debts remain open; no push or frozen-authority edit.

### Final CPU-return verdict

The bounded diff SHA256 is
`19a56205e22a864f2d3f688c6c9239dc211873147cb69c40c0c43ad4f01ea742`.
There is no further production change after the reviewed tree; later changes
are evidence/status documentation. Fresh install/build/typecheck and all
**5,106 tests PASS**, zero failures and two existing compiler skips, at 18:04
CEST. Compiler 1,814; CLI 62; language server 21; VS Code six; root 3,203 in
163 files, 683.99 seconds. Each reviewer receives the final logged checkpoint.

| Responsibility                                               | Independent reviewer                                             | Bounded verdict                                                                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Correctness, standards, maintainability and oracle integrity | `/root/cia2_rti_correctness`                                     | No findings; independent RED chronology and exact unchanged test hash checked                                      |
| Semantic preservation and modern-source DX                   | `/root/cia2_rti_sfa`, separate complete semantics charter        | No findings; mutable homes and evaluated snapshots remain distinct; ordinary helper/borrow/nested source preserved |
| SFA/ABI and saved-link lifetime interfaces                   | `/root/cia2_rti_sfa`, SFA charter                                | No findings; no new storage/domain/activation and final certificate preserved                                      |
| Selected CPU/platform                                        | `/root/cia2_rti_platform`, platform charter                      | No findings; actual RTI and absent-arrival/masked controls independently checked                                   |
| Equivalent expert output and complete costs                  | `/root/cia2_rti_platform`, separate complete output charter      | No new findings; zero cost delta across eight recorded-hash artifact families; existing RD-08 debts not waived     |
| Host performance                                             | `/root/cia2_rti_platform`, separate complete performance charter | No findings; O(1) transfer, existing finite keys/worklist/memoization; isolated latency/RSS Unknown                |

Fresh semantic-thread creation and revival of the earlier output reviewer were
refused by the cumulative runtime thread limit. Existing independent xhigh
reviewers therefore load each full local charter and return separate lens
verdicts. They authored neither production nor specification tests. The maximum
four active agents, required responsibility coverage and independence are
preserved. No competing verification or VICE is run by any reviewer.

The correctness reviewer reports accidental exposure to unrelated release
qualification summaries, explicitly excluded from decisive RTI/oracle judgments.
Platform's headings-only inventory sees map titles but no map bodies/answers;
its conclusions use bounded normative/source sections and the exact native
packet. These disclosures are retained, not counted as additional oracle proof.

The output auditor independently confirms that all eight current source/asm/
labels/PRG/memory/cost/debug/assets hashes match the original recorded hashes.
Earlier generation directories were retired normally by build publication;
comparison is to retained records, not deleted originals. New build generation/
measurement identities differ normally. Current artifacts are bound by
`rebuild-original.jsonl` and `rebuilt-metadata-identities.jsonl`. This is not a
fresh 568-case native matrix. Local writer/shutdown costs remain 35/53 and 38/56;
#98 tracks local meets, #96 layout and #99 ordinary fixed-borrow debt under
RD-08/#70. No production game-grade waiver or measured whole-program win.

TP-004 is corrected and task 1.3.6 is verified. External aggregate stack,
retained-firmware completion/deadlines and physical behavior remain unproved.
TP-003/T-09 is mandatory before RD-05 closeout; RD-05/DEF-7 remain open. No push.
