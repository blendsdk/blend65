# Current-tree release-readiness assessment

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-32; bounded assessment, not release approval
> **Progress**: 4/4 tasks (100%)
> **Status**: Done — documentation/review GREEN; no release approval or product change
> **Baseline**: `5fe74ec6`, clean `feature/v4-rebuild`
> **Phase baseline tree**: `39067aee0b81ffa82e6cd8a0f5ee258d960a29a7` (clean committed tree before this task's first edit)
> **Scope**: strict
> **Historical release candidate**: `bb10e0d1`
> **Created**: 2026-11-19
> **Reasoning**: high — distinguish current regression evidence from exact-candidate release qualification

## Objective and scope

Identify the evidence and known limitations that separate the current development tree from a
new release of the already approved bounded Linux/C64 surface. Separate that work from the
stronger expert-output ambition and from unavailable native-host or physical-hardware proof.
Use this assessment to identify the next bounded implementation or qualification task.

**Planning target:** current-tree readiness within `blend65-v4`.
**Context artifacts:** the RD-10 execution plan and release record, active roadmap, relevant
post-candidate closeouts, current expressiveness ledger and scoped product-change inventory.
**Modification set:** this mini-plan and its derived T-32 feature-roadmap row only.

Do not change compiler code, tests, oracles, ledger, specification, expert authority, hidden
configuration, release approval or publication state. Do not close issues, weaken the expert
output requirement, reinterpret accepted risks as fixes, or claim every open issue was audited.
No new framework, harness, script, dependency or evidence database.

**Smallest viable design:** inspect existing evidence and scoped Git history; record the bounded
assessment in this document; obtain independent read-only review. Do not rerun the complete
compiler/emulator gate for a documentation-only assessment. Missing exact-candidate evidence
remains missing even when earlier tests passed.

## Acceptance

- Distinguish the historical approved candidate, later approved extensions and current tree.
- Name the missing release evidence without inventing new release requirements.
- Keep correctness risks, conservative source restrictions, measured output debt and external
  qualification separate, each with its existing owner.
- State which conclusions are documented facts, assessments or Unknown.
- Select a next bounded task without silently approving a new release scope or product design.
- Verify formatting, local links, checklist consistency, the exact documentation-only diff and
  unchanged frozen/source/test inputs. Review agreement is not runtime evidence.

## Tasks

- [x] T-32.1 Establish candidate identities and map post-candidate changes to existing release-evidence obligations. Verified 2026-11-19: formatting, local links, 75/49 inventory and unchanged product/frozen inputs pass.
- [x] T-32.2 Classify selected remaining risks/debt and record the smallest next-task recommendation. Verified 2026-11-19: formatting, links, checklist and source/risk references pass; independent challenge recommends the bounded #164 classification probe.
- [x] T-32.3 Obtain independent correctness review of the assessment and resolve findings without changing product scope. Verified 2026-11-19: no findings; review record, formatting, links and unchanged product/oracle inputs pass.
- [x] T-32.4 Validate documentation and unchanged-input scope, synchronize T-32, commit GREEN locally with the git-commit skill and clean owned temporary files. Never push. Verified 2026-11-19: documentation-only checks pass, roadmap synchronized and owned task-verification directories removed; local GREEN documentation checkpoint records this closeout.

**Task verify**: `yarn prettier --check codeops/features/blend65-v4/plans/current-tree-release-readiness/99-execution-plan.md codeops/features/blend65-v4/00-roadmap.md`; check relative links, exact four-task progress and documentation-only diff against `5fe74ec6`; verify `spec/`, expert authority, source, tests, manifests and the historical release record remain unchanged.

**Verify**: the same documentation-only checks at closeout, plus independent review. No new
compiler/runtime/installed-package/hardware verification is claimed by this assessment.

## Evidence and assessment

### Candidate and evidence boundaries

| Boundary | Observation | Meaning |
| --- | --- | --- |
| Original candidate | [`bb10e0d1`](../../../../../docs/releases/v4-production-qualification.md#1-candidate-identity); user approval recorded in section 12 | Historical approval, not approval of the latest HEAD |
| Approved extension | [Takeover approval](../../../../../docs/releases/v4-production-qualification.md#130-approval), implementation `d73e002c`, four additional PRG profiles | Eight PRG profiles plus the existing D64 are the bounded approved surface; source raw NMI and raw-MMIO source containment remain excluded |
| Current assessment baseline | `5fe74ec6`; clean before this task, immediately after implementation `9bbc9ead` | No current-candidate release approval is inferred |
| Latest complete regression checkpoint | [Byte-assignment qualification](../boing-ball-byte-assignment-forwarding/08-verification.md#actual-complete-checkpoint-after-ar-p2--green): fresh root host 5,230 and serialized VICE 2,403 pass; four existing VICE skips | Strong regression evidence, not a substitute for installed-package, VSIX and exact-candidate release identities |
| Workspace portion of that checkpoint | Seven cached tasks replay prior verified compiler 4,298/2 existing skips, CLI 70, server 21, editor 18 | Not newly executed workspace tests in that invocation |
| Raw evidence retention | The same closeout records cleanup of raw logs, manifests and temporary witnesses; committed summaries/hashes remain | This assessment can inspect summaries and Git history, not authenticate deleted raw logs anew |

The original RD-10 82/82 and v4 10/10 counters are completed milestones, not percentages for
remaining product work. The old release record remains historical evidence and is not rewritten
by this assessment. No new runtime test has run here.

### Observed change scope and affected evidence

A scoped name-only comparison of `bb10e0d1..5fe74ec6` across `packages/compiler/src`,
`packages/compiler/stdlib` and the CLI/server/editor `src` directories finds 75 changed non-test
source paths, all under the compiler, plus 49 changed package-source test paths. The 75 include
two test-support modules; the count is a reproducible inventory, not a product-quality score.
The non-test source grouping is frontend 1, layout 4, machine 33, profile 1, semantic 19,
services 9, storage 5, target 2 and tools 1. CLI/server/editor source changes in this scoped
comparison are test-only, but those products consume the changed compiler.

| Changed boundary | Existing obligation that intersects | Available evidence / next release action |
| --- | --- | --- |
| Semantic analysis, calls, alias invalidation and function storage | Language acceptance, diagnostics, safe indirect calls and storage/interrupt proof | Bounded task closeouts and latest regression checkpoint exist; a new candidate must bind the relevant evidence and disclose remaining risk boundaries |
| Machine lowering, startup, target profiles and layout | Final bytes/resources, startup/return, profile matrix, debug/evidence identity | Existing full gate includes runtime suites; refresh candidate/artifact provenance rather than copying historical hashes |
| Compiler service path passes the selected `boundsCheck` setting into semantic construction (`services.ts`) | Installed compiler/CLI behavior for safety options | Re-test the installed path for an exact candidate; unchanged CLI source does not imply unchanged CLI behavior |
| ACME subprocess error handling (`tools/acme.ts`) | Missing-path/tool failure, safe diagnostics and atomic publication | Relevant tests exist; include changed tool behavior in any refreshed installed-public-path qualification |
| Compiler package scripts and root test tiers/runners | What the checkpoint actually executes and what was cached/skipped | Root `package.json`, compiler `package.json`, runner/selector and tier configs changed; use current commands, not historical suite counts |
| Packaging/export declarations | Public packages and bundled compiler/frontend availability | Compiler package changes are test-script additions, not new exports/dependencies; still verify actual current tarballs and consumers before a new release claim |

The governing [RD-10 reuse rule](../rd-10-production-qualification/03-01-candidate-and-release-evidence.md#evidence-reuse)
requires matching identities and refresh of intersecting families. It does not require
discarding every historical result or rerunning unrelated suites after a documentation edit.
The [installed public path](../rd-10-production-qualification/03-02-host-and-package-qualification.md#public-path)
cannot be proved solely by workspace imports. A real tarball consumer test exists at
[`bundled-input-evidence.spec.test.ts`](../../../../../test/rd05/bundled-input-evidence.spec.test.ts);
that is partial package-consumer evidence, not the entire CLI/LSP/VSIX release journey.

### Remaining-work classification and next task

| Class | Selected remaining item and owner | Release consequence |
| --- | --- | --- |
| Evidence freshness | Current installed packages, public CLI/LSP/VSIX journeys, profile/artifact identities and approval binding | Required before presenting the current tree as a newly qualified release; current regression GREEN alone is insufficient |
| Unresolved correctness-risk boundary | Constant raw write overlapping an automatically placed callable after layout, [#164 owner](../interprocedural-raw-write-kills/08-closeout.md#residuals) | Current end-to-end behavior is Unknown. Investigate before deciding whether the next qualification can proceed unchanged; do not call this either fixed or a reproduced current miscompilation |
| Accepted historical risk | [T-30 AR-P1](../partial-array-and-callable-proof/00-ambiguity-register.md#ar-p1--raw-memory-corruption-boundary-for-the-new-callable-write-transfer) permitted bounded typed-provenance delivery with wider raw-corruption exposure | That was an explicit batch risk, not a language rule or a permanent waiver. Later #156/#161 work closes specific invalidation cases, not every raw-address case |
| Conservative source rejection | Stock-chained NMI retention #153; multi-screen sprite-pointer relation #140; remaining helper-field transfer precision #165 | These are user-visible capability/precision debt, not evidence of emitted wrong behavior for the rejected form. Existing exclusions must stay explicit; no new rejection is authorized |
| Expert-output debt | #168 code 1,151 versus equivalent twin 442, gap 709; #145 acquisition gap 58 payload bytes in its later closeout | The full expert-output ambition is not met. Historical bounded release exclusions do not downgrade this product requirement or close these issues |
| Timing/resource uncertainty | Equivalent boing whole-frame timing; external aggregate NMI stack, retained-firmware completion and deadlines | No whole-frame speed or unrestricted firmware/interrupt resource guarantee; local instruction savings are not a full-program timing result |
| Explicit target-surface exclusions | Source raw NMI `V4-TAKEOVER-F2`; raw-MMIO interrupt containment `V4-TAKEOVER-F3` | Remain outside the approved takeover claim; their absence must not be described as blanket interrupt safety |
| External qualification | Physical C64/drive/SID `V4-HW-1`; native Windows/macOS `V4-HOST-1`; exact CharPad 3.88 and GoatTracker adapter `V4-ASSET-1`/T-19 | Unknown or absent as recorded. Not prerequisites for the already bounded Linux/emulator claim, but required before extending it to those surfaces |

This is a selected risk/evidence assessment, not a complete fresh audit of every issue or a
new decision that any known correctness risk is acceptable for release.
The current [expressiveness ledger](../../../../../test/rd04/expressiveness-ledger.json) has two
deferred rows (multi-screen sprite pointer and chained-NMI retention); that ledger is not a
complete inventory of all remaining correctness or optimization work.

### Next bounded task recommendation

**Recommended:** classify #164 with one public-build overlap witness and a disjoint-write
control, before spending another full qualification gate or adding another #168 optimization.
The deliverable is a decision-quality reproduction or demonstrated safeguard, not a compiler fix.

Grounding from current source:

- [`function-targets.ts:172–182`](../../../../../packages/compiler/src/semantic/function-targets.ts)
  builds the absolute overlap map from explicitly placed globals; automatic storage has no
  interval there.
- [`raw-write-kills.ts:499–517`](../../../../../packages/compiler/src/semantic/raw-write-kills.ts)
  intersects a constant write with that map and preserves facts when nothing matches. An
  unresolved runtime address instead creates an opaque kill.
- The [#161 closeout](../interprocedural-raw-write-kills/08-closeout.md#residuals) names the
  post-layout constant-overlap obligation as #164. These observations make a concrete risk
  plausible; they do not establish that a final artifact lacks another safeguard.

The smallest decisive probe must:

1. Use automatically placed callable storage, assign a known function, perform a constant raw
   overwrite after assignment, then call it. Do not add explicit placement or take the callable
   storage's address in source, because that would change the proof boundary.
2. Establish the overlap from the final artifact's actual storage interval, not an address from
   an earlier build. If the new source moves the object, re-establish the final relation before
   classifying the result.
3. Pair with a disjoint constant-write control and identify whether the compiler rejects,
   relocates safely, or accepts overlapping bytes while preserving an obsolete target proof.
4. If accepted output alone is not decisive, inspect the exact emitted call and execute the
   minimum sequential VICE witness. Keep source/semantic expectations independent of the
   emitted target. Preserve all existing oracles and shared helpers.
5. Stop at classification. A correction or risk acceptance requires its own bounded plan and
   applicable authority; this assessment grants neither a repair nor a new release approval.

The strongest alternative is an exact-candidate installed-public-path qualification refresh:
its evidence gap is certain, whereas the current #164 failure is unproved. Probe-first is
preferred because it can cheaply determine whether a correction must precede that refresh.
Continuing #168 first improves output but cannot resolve this correctness question or replace
the release evidence. No new analyzer, global raw-write ban or automatic rejection policy is
selected.

Independent challenge `ses_e0e92afeeffexnaDFKhKLxqC5i` returned the same priority after inspecting
the evidence, with no parent preference supplied. Confidence: medium-high in task ordering;
current end-to-end #164 outcome remains Unknown. Hardening: independent Astra challenge.

### Assessment boundary and specialist coverage

Status: **Verified partial**; claim kind: **Inference** from inspected source, scoped Git
inventory and recorded verification. This task does not freshly qualify compiler artifacts,
runtime timing, installed products or physical hardware.

Evidence-boundary guidance: expert `2.0.4`, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`,
`references/evidence-parity-and-recovery.md#evidence-boundary-rules` and
`#transformation-proof`; no new hardware claim or hardware-source interpretation is made.

Specialist check: **None new**. This documentation-only phase needs base correctness review,
not security/performance or compiler-specialist execution audits. The proposed #164 probe crosses
existing semantics, SFA/ABI and machine-code ownership; it does not justify creating an agent.
Its eventual execution review must select the actual affected contracts. No hidden policy or
specialist-index update is needed for this bounded assessment.

## Independent review

Correctness review `ses_e0e8e6f27ffeIlN9AVcIbx6Wl1`, Astra/high, returned **no findings** on the
complete new mini-plan and inserted T-32 roadmap row. It independently checked historical versus
current evidence, conservative rejection versus wrong-output risk, bounded AR-P1 authority,
unchanged expert-output requirement and the classification-only next probe.

Oracle integrity: no new or edited specification tests; no oracle exception applies. The reviewer
did not execute commands, authenticate deleted logs or re-audit historical oracle exceptions.
Specialist/security/performance execution audits are skipped for the documentation-only diff.
No finding was waived or accepted as risk during this assessment.

## Verification and cleanup

All three task-verification runs pass targeted formatting, local links and unchanged
product/frozen/release-record checks. The scoped 75/49 change inventory was reproduced.
No compiler, runtime, package-install or physical test ran during this assessment.
Final prechecks confirm that only this new mini-plan and the single inserted T-32 roadmap row
changed. Historical release record, source, tests, specification, expert authority, manifests
and integration-owned portfolio are unchanged. Final four-task checks and the guarded local
documentation commit bind this closeout. Each owned verification directory was automatically
removed when its task check ended; commit-message/verification scratch is removed by the local
checkpoint wrapper. No raw artifact is retained and no push is authorized.

The installed progress helper renders the four mini-plan tasks correctly but exits 1 because
its `inspect_plan` unconditionally requires a full-feature `00-index.md` and `Implements`.
Those documents are expressly absent for lightweight tasks. Record this workflow-tool limitation;
do not fabricate an index or change the plugin. Checklist assertions independently verify the
four-task arithmetic.
