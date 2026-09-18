# Preflight Report: RD-03 Frontend First

> **Status**: ❌ BLOCKED — 3 major findings require plan corrections and verification
> **Iteration**: 1 — first scan
> **Artifact**: Full partial-RD implementation plan; eight documents in `codeops/features/blend65-v4/plans/rd-03-frontend-first/`
> **Audited revision**: `26b258250eb6968b723e6ed56fe62ab04d17c8cc`
> **Audited directory tree**: `e1e9bf547a75ac85ddfdac216c6ff8deeaee97ef` — before this report; all eight document blobs unchanged
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

This invocation authorizes review evidence and derived roadmap updates, not fixes
to the plan. No implementation, tests, frozen authority or context requirement
has been modified. Findings remain open until the corrections are applied and checked.

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
These structural passes do not override the semantic findings below.

## Summary by Dimension

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
| 🟠 MAJOR | 3 | Open; corrections not applied |
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
workflow directive 4; recommended A selected. **User Decision:** No request to
apply corrections yet. No public contract or scope change is proposed.
**Fix verification:** A blind author can write the required typed assertions from
the supplied plan contract without opening production frontend files or guessing
tested field names. **State:** Open — unapplied.

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
recommended A selected. **User Decision:** No request to apply corrections yet.
**Fix verification:** Every required assertion maps to an implementation available
at its GREEN checkpoint; no overall case expectation is lost.
**State:** Open — unapplied.

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
recommended A selected. **User Decision:** No request to apply corrections yet.
**Fix verification:** Existing scalar tests distinguish the wrong rounding/sign,
constant-zero exception/value and fabricated runtime-fold behaviors above.
**State:** Open — unapplied.

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
report. The roadmap stays at Plan Created; this report is not a passing gate.

## Next Steps

| Action | Owner |
|---|---|
| Request application of the three bounded plan corrections | User |
| Apply only those plan changes and run a bounded corrective rescan | Agent, after that request |
| Start lexer specification tests after the plan passes | Agent |
