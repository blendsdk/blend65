# Preflight Report: RD-03 Frontend First

> **Status**: ✅ PREFLIGHT PASSED — all 3 findings resolved
> **Iteration**: 2 — bounded corrective rescan; no new findings
> **Artifact**: Full partial-RD implementation plan; eight documents in `codeops/features/blend65-v4/plans/rd-03-frontend-first/`
> **Iteration 1 revision**: `26b258250eb6968b723e6ed56fe62ab04d17c8cc`
> **Iteration 1 directory tree**: `e1e9bf547a75ac85ddfdac216c6ff8deeaee97ef`
> **Iteration 2 content SHA256**: `37e7e8ec207db549b0f151bafa33283c032a6de3341fb3fc6c344013a5066163`
> **Codebase Grounded**: 6 source/support files, 2 test files and 7 manifest/configuration files examined; 28 local link targets verified
> **Last Updated**: 2026-09-18
> **CodeOps Artifact Schema**: 1

⚠️ SAME-SESSION REVIEW: The lead created this plan in the current session.
Independent clustered reviewers and a blind finding-batch challenger were used.
The grounding/domain reviewer previously advised the design; that review is not
fully independent. Consider a fresh-session or human domain review for additional
independence; this is not a new implementation gate.

## Audit Scope

The audit target is the eight plan documents at the recorded revision, not the
parent RD, other plans or the compiler implementation. Context documents are
`AGENTS.md`, RD-03 and its existing decisions, the active feature roadmap,
RD-02 project contracts/tests, current manifests/configurations, frozen
Specification 4 and qualified expert 2.0.0. Reading these did not expand the target.

Strict scope applies. The approved goal is asset-independent frontend work first.
The minimum design is focused internal compiler modules, immutable snapshot inputs,
one Pratt parser, typed syntax and direct stage services. There is no new workspace,
dependency, generic IR, pass registry, harness or infrastructure. CLI/editor,
assets/profiles, backend/SFA and full M1 acceptance remain outside this partial plan.
AR-P1–AR-P7 and Windows DEF-1 were respected, not reopened.

Iteration 1 authorized review evidence and derived roadmap updates, not fixes.
For iteration 2, the user answered "you may" to the explicit request to apply
PF-001–PF-003 and re-check. Only the plan and derived feature roadmap changed.
No implementation, tests, frozen authority or context requirement was modified.

## Codebase Context Summary

Actual stack: TypeScript 7.0.2, Node 22, Yarn classic 1.22.22, Turbo and Vitest.
The two workspaces are compiler and CLI. No language frontend exists yet; no lint
script or emulator is required for this review.

| Examined surface | Verified consequence |
|---|---|
| `project/types.ts`, `positions.ts`, compiler `index.ts` | Exact source text/raw UTF-8 spans and immutable snapshots exist. The public compiler entry remains load-only. These files do not define frontend node/result shapes. |
| `project/snapshot.ts`, `snapshot.spec.test.ts`, `packages/compiler/test/project-fixtures.ts` | Real loader and fixture patterns support load-to-analysis tests without another harness. Existing snapshot tests preserve BOM, line endings, identity and immutability. |
| `test/import-boundary.ts`, `import-boundary.spec.test.ts` | Internal frontend ownership and transitive backend restrictions are already enforced, including a non-vacuous internal-to-lowering fixture. |
| Root/compiler manifests, compiler tsconfig, both Vitest configs, CodeOps policy/marker | Planned commands, colocated test paths, two-workspace ownership and independent review match the actual checkout. |

Direct artifact checks passed: eight documents, 76 headings, 28 existing local
link targets, 64 unique task identifiers and 48 ST rows. Six phases contain
specification-first ordering. All seven ambiguity entries are resolved.
These iteration 1 structural passes did not override the findings below.
Iteration 2 repeats the structural checks on the corrected documents.

## Iteration 1 Summary by Dimension

Counts identify each root cause by its primary dimension; related dimensions do
not duplicate findings.

| # | Dimension | Findings | Highest severity |
|---|---|---|---|
| 1 | Ambiguities | 1 — PF-001 | 🟠 MAJOR |
| 2 | Implicit assumptions | 0 | — |
| 3 | Logical contradictions | 0; PF-002 cross-checked | — |
| 4 | Completeness | 0; PF-003 cross-checked | — |
| 5 | Dependencies | 0; PF-002 cross-checked | — |
| 6 | Feasibility | 0 | — |
| 7 | Testability | 1 — PF-003 | 🟠 MAJOR |
| 8 | Security | 0 | — |
| 9 | Edge cases | 0 | — |
| 10 | Scope creep / simplicity | 0 | — |
| 11 | Ordering | 1 — PF-002 | 🟠 MAJOR |
| 12 | Consistency | 0 | — |
| 13 | Codebase alignment | 0 | — |

Compiler/language lens completed: no additional root finding. Checks covered
constant/runtime widths, signedness, narrowing barriers, scopes/calls/recursion,
ordinary loop exits, aggregate permissions, initializer effects, diagnostics and
truthful incomplete results against the raw governing chapters.

| Severity | Count | State |
|---|---|---|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 3 | Resolved and verified in iteration 2 |
| 🟡 MINOR | 0 | — |
| 🔵 OBSERVATION | 0 | — |

## PF-001: Define What Independent Tests Inspect 🟠 MAJOR

**Dimension:** Ambiguities.
**Location:** `03-01-source-and-syntax.md:23–29,65–71`;
`03-02-semantic-analysis.md:25–34`; `99-execution-plan.md:87–93`.
**Codebase evidence:** `packages/compiler/src/project/types.ts:51–82` defines
diagnostics/source records, not syntax node shapes. Compiler Vitest discovers
ordinary colocated tests (`packages/compiler/vitest.config.ts:4`).

**Problem:** ST-7 must inspect right-associative assignment; ST-9 must inspect
ordered call arguments and postfix nesting. The plan names conceptual variants
but not the exact discriminator values or inspected child fields. Blind authors
would have to invent whether to assert `right`, `rhs`, `arguments` or another shape.
Module result signatures and later typed-program observations have the same gap.
Syntax/type implementation tasks come after these immutable tests are authored.

**Refutation attempted:** Grammar fixes grouping, not TypeScript field names.
The promise to supply syntax/type definitions does not supply their observable
contract or schedule its freezing before the authors receive their packet.

**Recommended — A:** Freeze a compact phase-local contract in the existing plan
before each specification-author task: exact result/node discriminators and only
fields that the phase's tests inspect. No comprehensive AST schema or new accessor
framework is required. Implementation stays after specification tests.

The viable alternative is for the independent author to propose that narrow
contract, then freeze it separately before implementation. This transfers design
ownership but does not remove the needed step. A new observation framework is
unnecessary and was rejected.

**Resolution authority:** Plan-owned technical correction under overriding project
workflow directive 4; recommended A selected. **User Decision:** "you may"
authorized application and verification on 2026-09-18. No public contract or scope change.
**Fix verification:** A blind author can write the required typed assertions from
the supplied plan contract without opening production frontend files or guessing
tested field names. **State:** Resolved — verified in iteration 2.

**Iteration 2 evidence:** Exact token, syntax, module and typed-body fields are
frozen in the existing two component documents and required in every author packet.
`analyzeModules` exposes internal intermediate facts without a typed program.
The soundness rescan found a residual of this same root: `sizeof(byte[2])` could
not use an expression-only call argument. The syntax table now supplies the
three query nodes required by grammar §7.3, with matching typed observations.
Independent soundness and fit rechecks verified that residual closed. No new API.

Confidence: High. Hardening: narrowed to fields the tests actually observe.
Challenger: converged; strongest counterargument is author-proposed contracts,
which still need a preimplementation freeze.

## PF-002: Put Each Test After Its Required Stage Exists 🟠 MAJOR

**Dimension:** Ordering; related dependencies and contradictions.
**Location:** `07-testing-strategy.md:28,47,80,89–94`;
`99-execution-plan.md:60–68,88–99,151,215–216`.
**Codebase evidence:** The current compiler public entry exports project-input
services only (`packages/compiler/src/index.ts:4–22`); no existing analyzer or
initializer scheduler satisfies these dependencies.
**Governing source:** `spec/01-lexical-structure.md:218–220,260–262` explicitly
assigns reserved built-in declaration diagnostics to semantic analysis;
`spec/14-diagnostics.md:56–65` requires independent root errors, not parser binding.

**Problem:** Three early tiers require later semantic work:

| Existing case | Early phase | Later dependency |
|---|---|---|
| ST-3: declaration of `peek` emits E10212 | Lexer, phase 1 | Semantic declaration checking, phase 4 |
| ST-17: name-based initializer schedule stays invariant | Modules, phase 3 | Initializer scheduling, phase 6 |
| ST-45: recovered source retains undeclared-name error | Parser, phase 2 | Body binding and service recovery, phases 4/6 |

For ST-45, `missing;` is a syntactically valid statement. A parser can preserve it
after a missing semicolon, but cannot prove E10239 without name resolution.
As written, early GREEN checkpoints require pulling later responsibilities forward
or weakening the specified assertions.

**Refutation attempted:** Full task mapping supplies none of these semantic
dependencies early. Preserving syntax nodes is not a semantic diagnostic proof.

**Recommended — A:** Keep token, recovery/sibling and reachability assertions in
their original phases. Move only their semantic assertions to the existing scalar,
effect and service specification tiers. Preserve the complete intended ST coverage.
Do not add modules or test files solely for this correction.

Waiting until the whole analyzer exists before qualifying early suites is viable,
but discards the plan's useful per-phase GREEN checkpoints. Moving semantics into
the lexer/parser was rejected because it breaks responsibility ownership.

**Resolution authority:** Plan-owned technical correction under project directive 4;
recommended A selected. **User Decision:** "you may" authorized application and verification.
**Fix verification:** Every required assertion maps to an implementation available
at its GREEN checkpoint; no overall case expectation is lost.
**State:** Resolved — verified in iteration 2.

**Iteration 2 evidence:** ST-3 preserves lexical assertions in phase 1, reserved
`type` syntax in phase 2 and declaration errors in phase 4. ST-17 schedules
initializers only in phase 6. ST-45 checks parser recovery in phase 2 and retained
independent semantic errors in phase 6. Both testing and task mappings agree.
Phase 4/5 body tests use the direct internal result, not the phase 6 service.

Confidence: High. Hardening: three symptoms merged into one sequencing root cause.
Challenger: converged; deferring all early qualification is the strongest but
larger alternative.

## PF-003: Add Focused Division and Remainder Expectations 🟠 MAJOR

**Dimension:** Testability; related completeness.
**Location:** `03-02-semantic-analysis.md:41,81–93`;
`07-testing-strategy.md:51–55,130`.
**Codebase evidence:** The existing compiler Vitest configuration accepts these
ordinary scalar parameter cases (`packages/compiler/vitest.config.ts:4`).
**Governing source:** `spec/04-expressions-operators.md:113–123` requires signed
division to truncate toward zero and remainder to have the dividend's sign;
`:133–139` separates constant-zero rejection from runtime operations.

**Problem:** All ordinary scalar operators and exact constant evaluation are
admitted, but the specified scalar acceptance cases omit decisive `/`, `%` and
zero-divisor expectations. An evaluator returning `-3` for `sbyte(-5)/sbyte(2)`
or `1` for `sbyte(-5)%sbyte(2)` can pass the listed tests. A host exception or
fabricated value for a constant zero divisor is likewise not distinguished.
The required answers are `-2`, `-1`, and structured E10160 for constant `/0` or `%0`.

**Refutation attempted:** ST-7 verifies parsing, not multiplication/division
evaluation; ST-22 covers addition and ST-23 casts/shifts. Generic implementation
boundary tests do not prescribe these independent specification expectations.

**Recommended — A:** Extend existing scalar specification parameter rows with
signed quotient/remainder signs, constant `/0` and `%0` diagnostics, and
parameter-divisor functions retaining typed runtime `/` and `%` operations without
fabricated results or implicit checks. Assert structured diagnostics rather than
host exceptions. Do not assert runtime-zero result bits or decide reaching-local-zero
classification in this correction.

Narrowing the admitted operators would change the approved coherent slice without
need and was rejected. A machine runner, interpreter or backend assertion is not
needed to prove these frontend obligations.

**Resolution authority:** Plan-owned technical correction under project directive 4;
recommended A selected. **User Decision:** "you may" authorized application and verification.
**Fix verification:** Existing scalar tests distinguish the wrong rounding/sign,
constant-zero exception/value and fabricated runtime-fold behaviors above.
**State:** Resolved — verified in iteration 2.

**Iteration 2 evidence:** ST-23 now fixes four signed quotient/remainder vectors,
both constant-zero diagnostic cases and unknown-parameter runtime operations.
Phase 4 author/implementation tasks explicitly own these rows. No machine
runner, runtime-zero bit expectation or reaching-local-zero ruling was added.

Confidence: High. Hardening: runtime assertions narrowed to frontend-provable
parameter-divisor operations. Challenger: converged; relying on authors to discover
extra cases does not guarantee the promised immutable acceptance oracle.

## Simplicity and Rejected Candidates

No extra support machinery is needed. The three remedies update existing contracts,
phase mappings and scalar test rows. They add no product capability or language
restriction. There is no complexity escalation or scope-expansion proposal.

The read-only plan helper would project RD-03 Done after the partial plan completes,
because it does not interpret `Coverage: Partial`. This was refuted as a target
blocker: the roadmap arithmetic engine never changes stages, and the audited plan
explicitly forbids parent completion and requires remaining-obligation ownership.
No tool migration, placeholder plan or second state store is warranted.

Adversarial checks asked whether the authored plan assumed its tests were executable,
whether representation choices were mistaken for grammar authority, and whether
partial success hid later obligations. PF-001/PF-002 capture the surviving issues;
explicit incomplete results and no-parent-closeout rules address the latter.

## Review Provenance and Evidence Limits

Soundness and fit: `frontend_pf_soundness`; delivery: `preflight_delivery`;
risk: `preflight_risk`; grounding and compiler lens:
`rd03_frontend_challenge_fallback` (previous design-advice overlap disclosed).
Blind three-finding challenge: `preflight_findings_challenge`; all remedies converged.
The phase-only reviewer rejected the initial delivery packet without reviewing it;
the packet was then sent to the existing preflight auditor. No rejected review
was counted as audit evidence.

Status: Verified partial. Claim kinds: inspected facts and plan recommendations,
not implemented frontend defects. Expert lineage: `skillVersion=2.0.0`, content
commit `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`,
`compiler-architecture.md#target-neutral-front-end`,
`blend65-semantics.md#diagnostic-doctrine`, governing key
`BLEND65-SPEC-4-5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa`.
No assembly, SFA, artifact, runtime, timing or parity claim is made.

Markdown-only verification checks formatting, local links, identifiers, audit
identity and unchanged frozen trees. The compiler suite is not rerun for this
Markdown-only checkpoint. Iteration 1 stayed at Plan Created; iteration 2 advances
only the partial frontend plan to Plan Preflighted. RD-03 is not complete.

## Iteration 2 Corrective Review

The unchanged eight-document target was rescanned across all 13 dimensions and
the compiler/language lens. All three original findings are resolved; there are
zero new or carried-forward findings. The lead also checked the corrective diff
for lost assertions, invented acceptance, operand-shape conflicts and extra scope.

| Cluster | Dimensions | Reviewer | Result |
|---|---|---|---|
| Soundness | 1, 3, 12 | `frontend_pf_soundness` | PF-001 residual closed; no remaining findings |
| Grounding | 2, 13 | `preflight_findings_challenge` | No findings |
| Delivery | 4, 5, 11 | `preflight_delivery` | No findings |
| Risk | 6, 8, 9 | `preflight_findings_challenge` | No findings |
| Fit / simplicity | 7, 10 | `preflight_delivery` | No findings |
| Compiler/language | Selected domain lens | `frontend_pf_soundness` | No findings |

The remedies are direct fields in existing contracts, corrected phase ownership
and ordinary scalar parameter rows. Task count remains 64 and case IDs remain
ST-1–ST-48. No framework, dependency, workspace, runtime or product scope was added.
All execution tasks remain unchecked. Passing this plan proves no implemented
frontend behavior, native Windows qualification, expert parity or full M1 delivery.

Audit identity is SHA256 of the UTF-8 concatenation of sorted records
`<filename> <file-SHA256>\n` for the eight target documents: `00-index.md`,
`00-ambiguity-register.md`, `01-requirements.md`, `02-current-state.md`,
`03-01-source-and-syntax.md`, `03-02-semantic-analysis.md`, `07-testing-strategy.md`
and `99-execution-plan.md`. The report and temporary notes are excluded to avoid
a self-referential hash. The frozen authority lineage above is unchanged.

Final structural checks passed for the eight target documents, report and feature
roadmap: 46 local links/anchors, 64 unique unchecked tasks, 48 ordered ST rows,
seven resolved ARs and six specification-first phases. The read-only plan helper
reports Ready with no problems. Targeted Prettier and Git whitespace checks pass;
the specification and expert trees remain identical to the freeze checkpoint.

The feature roadmap was updated immediately. Portfolio cascade is deferred on
`feature/v4-rebuild`, a non-integration branch; no portfolio file was changed.
The counter engine confirms no feature-counter drift. Its only drift is the
known portfolio roll-up (`0/10` versus `1/10` and the RD-02 blocked status), which
must be reconciled on integration rather than written from this branch.

## Next Steps

| Action | Owner |
|---|---|
| Start phase 1 lexer specification tests when execution is requested | Agent |
| Supply native Windows access later for RD-02 DEF-1 | User; agent then qualifies |
