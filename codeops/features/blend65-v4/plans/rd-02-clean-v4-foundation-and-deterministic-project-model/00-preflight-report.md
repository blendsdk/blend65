# Preflight Report: RD-02 Foundation Plan

> **Status**: ✅ PREFLIGHT PASSED — all five findings resolved and verified
> **Iteration**: 2 — bounded whole-plan re-scan, including simplicity
> **Audit Target**: The nine implementation-plan documents at `codeops/features/blend65-v4/plans/rd-02-clean-v4-foundation-and-deterministic-project-model/`
> **Review Base Commit**: `bc8d2394d5e1d83264286da14d88906ab81411fc`; reviewed corrections identified by the digest below
> **Artifact SHA-256**: `716c242318885afb4fe9809b9f401422616421c3b610eba7bd467c670901b07e`
> **Digest Method**: SHA-256 of sorted `sha256sum`-format records using the nine original document basenames; this report and continuity notes are excluded
> **Scope Mode**: Strict — no optional product additions
> **Modification Set**: Five user-approved corrections inside this plan, audit evidence, and derived feature-roadmap status; no implementation or authority-baseline change
> **Codebase Grounded**: Six representative source modules, one existing boundary test, thirteen manifests/configurations, and directly related authority documents examined
> **Last Updated**: 2026-09-17
> **CodeOps Artifact Schema**: 1

**SAME-SESSION REVIEW:** The lead helped create this plan in the current logical
session. Five independent audit clusters countered shared-context bias. A further
blind recommendation challenger could not run because the agent thread limit was
reached. No challenger verdict is claimed; major recommendations have medium
confidence under the required fallback. A fresh-session or human filesystem/API
review would provide additional independence.

## Scope and Codebase Context

The target contains nine documents. Context documents are not
additional audit targets: owning RD-02 and the v4 requirements register/report;
Phase 0 handoff; RD-01 final closeout and active expert release; frozen lexical,
modules, diagnostics, and profile chapters; inherited code and build configuration.
No context document receives a new PASS from this review.

**Observed checkout:** Node 22, Yarn classic, twelve inherited v3 workspaces,
TypeScript 5, Turbo, Vitest, ESLint, Vite, and readiness scripts. The proposed v4
APIs and two-package graph are future contracts, not existing capabilities.
The parked evidence worktree is clean at the recorded base. No worktree edit
exists under `spec/` or the active expert skill.

**Key implementation evidence:** `packages/config/src/{parse,discovery}.ts`;
`packages/core/src/diagnostics/{source-span,line-map}.ts`;
`packages/compiler/src/index.ts`; `packages/cli/src/args.ts`;
`test/boundary.spec.test.ts`; root package/TS/Turbo/Vitest configuration;
compiler/config/CLI manifests and compiler/CLI TS/Vitest configuration;
`.github/workflows/ci.yml`. The eleven current-state evidence rows map to real
files. All local links in the revised plan resolve.

**Iteration 1 identity:** Artifact commit
`cc663baebc8d284f7b3de4c83e7dacc581b6ea7e`, Git tree
`d54367547e510d55b734087406759591a4212e43`, and digest
`9245c0b5fc7ff58616e693f1ed762a826dd027591b2211281825139cb6bfeed2`.
That scan recorded 66 headings, 23 local links, and five findings. The findings
below retain their original evidence locations and severity as review history.

**Minimum-sufficient baseline:** One compiler library with focused internal project
modules and one real CLI consumer. Reuse `jsonc-parser` 3.3.1 and the accepted
tool roles. No compiler pipeline, publisher, public host framework, watcher,
persistent cache, new dependency, generated registry, custom runner, or replacement
linter. AR-P1/AR-P2 are user-approved scope decisions; AR-P3–AR-P7 are plan-owned
choices under the user's overriding workflow directive 4, not invented user votes.

## Simplicity Verdict

**The design is proportionate to accepted RD-02. No complexity escalation found.**

| Surface | Why it is necessary | Bound on complexity |
|---|---|---|
| Two real packages | Public library and CLI are accepted consumers, R2.11–R2.12 | No package per pass or empty future owner |
| Direct boundary helper | R2.13 requires synthetic and future real import-graph proof after ESLint removal | One focused helper/test; no policy framework or TS6 API dependency |
| Containment, identities, bounded reads/retries | R2.17–R2.18 and R2.22 require safe, coherent observed inputs | Internal modules only; no filesystem transaction, lock service, watcher, or cache |
| Native Linux/Windows evidence | Corrected AC-15 and AR-048 require actual host behavior | Adapt existing CI; unavailable evidence blocks closeout, not permission to create infrastructure |
| Observational measurements | R2.28 requires separate real-input observations | No performance threshold, synthetic scale suite, or benchmark service |

The corrections below clarify existing obligations. They do not authorize extra
systems. In particular, PF-002 separates behavior tests from direct closeout
inspection rather than constructing a self-verifying evidence framework.

## Scan Coverage

The table retains iteration 1 findings. All listed findings are now closed;
iteration 2 coverage and reviewer results appear below.

| # | Dimension | Findings | Highest severity |
|---|---|---|---|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit assumptions | 0 | — |
| 3 | Logical contradictions | PF-001 | 🟠 Major |
| 4 | Completeness gaps | 0 | — |
| 5 | Dependency issues | 0 | — |
| 6 | Feasibility concerns | 0 | — |
| 7 | Testability | PF-005 | 🟠 Major |
| 8 | Security blind spots | 0 | — |
| 9 | Edge cases | PF-004 | 🟡 Minor |
| 10 | Scope creep | 0 | — |
| 11 | Ordering and sequencing | PF-002, PF-003 | 🟠 Major |
| 12 | Consistency | 0 | — |
| 13 | Codebase alignment | 0 | — |

| Selected domain lens | Dedicated lead check | Result |
|---|---|---|
| Compiler/language | Frozen profile table/E10279, qualified identifier rules, UTF-8 spans and explicit UTF-16 conversion, diagnostic ownership | PF-001; raw-byte test allocation PF-003 |
| Data/migration | Inventory before destructive transition, no v3 compatibility requirement, Git/parked recovery, exact raw hashes and versioned snapshot identity | No separate finding |
| Concurrency | Whole-attempt discard/retry, bounded work, identity/content/inventory revalidation, explicit observed-input rather than filesystem-transaction scope | PF-005 test contract; no additional locking machinery justified |

| Severity | Count | State |
|---|---:|---|
| 🔴 Critical | 0 | — |
| 🟠 Major | 3 | All resolved and verified in iteration 2 |
| 🟡 Minor | 2 | All resolved and verified in iteration 2 |
| 🔵 Observation | 0 | — |

Independent clusters: `rd02_soundness` (1/3/12), `rd02_grounding` (2/13),
`rd02_delivery` (4/5/11), `rd02_risk` (6/8/9), and `preflight_fit` (7/10).
The fit review reused an idle generic auditor with a complete read-only packet
after fresh-agent creation reached the thread limit. Auditors did not change files.
The lead deduplicated overlapping evidence-order findings and reviewed all lenses.

## Findings

### PF-001: Establish who owns host error identifiers 🟠 MAJOR

**Dimension:** 3 — Logical contradictions.
**Location:** `03-02-project-service.md:234–254`; `03-03-cli-and-qualification.md:29,117`.
**Context evidence:** `spec/14-diagnostics.md:12–15,21–23,50–51`;
owning RD-02 R2.24 and Diagnostic foundation (`:185–190,383–392`).
**Related:** AR-P5 selects descriptive project-host identifiers.

**Problem in plain language:** The plan gives project and CLI errors new names,
but the frozen spec says it alone owns public diagnostic codes and messages.
Its wording also covers command-line failures. We need one explicit authority
boundary before tests lock in competing contracts.

**Recommended — A:** Record a user-owned product clarification: `PROJECT_*` and
`CLI_INVALID_ARGUMENT` are host-service result identifiers outside Chapter 14's
language/compiler registry. Preserve normative E10279 and its exact template.
Keep this clarification in the plan's authority record; do not silently edit the
frozen spec or create another diagnostic subsystem.

**Material alternative — B:** If the product instead requires all host errors to
use Chapter 14, separately authorize an upstream registry change and its authority
qualification. This expands the modification set and is not an RD-02 implementation
shortcut. Reusing unrelated or retired E codes is not viable.

**Refutation:** The plan already says host failures are not language rules, and
RD-02 requires stable host diagnostics. That explains intent but does not expressly
resolve the frozen registry's broader authority statement.
**Strongest counterargument:** A clarification outside the frozen text leaves
that chapter's universal wording intact; the overriding product decision must be
explicit and visible to future consumers.
**Confidence:** Medium — an explicit accepted host/language boundary would settle this.
**Hardening:** No independent challenger available; no claim of convergence.
**User Decision:** Approved 2026-09-17: “i do approve”, responding to the explicit
host-result boundary and five bounded corrections request; recommendation A accepted.
**Application:** Applied and verified. The approved authority record and both
service/CLI contracts separate host results from Chapter 14; E10279 remains exact.
Frozen specification files are unchanged. Independent soundness review found no residual issue.

### PF-002: Produce closeout evidence before requiring it 🟠 MAJOR

**Dimension:** 11 — Ordering and sequencing.
**Location:** `99-execution-plan.md:160,167–168`;
`07-testing-strategy.md:72,75–76`; `03-03-cli-and-qualification.md:93,100`.
**Codebase evidence:** `.github/workflows/ci.yml:10` currently has a Linux job only;
workflow configuration is not a native Windows qualification result.

**Problem in plain language:** Task 3.2.5 requires every case to pass before later
tasks record the measurements, Windows results, and deferral closeout those cases
require. Following the checklist in order makes its green gate circular.

**Recommended — A:** Gate 3.2.5 on completed behavior/configuration tests. Keep
actual native results, observations, and deferral ownership as direct checkpoint
evidence checks, completed in 3.3.1/3.3.2 before final review and commit. The first
native command run must be able to produce evidence without already requiring a
completed record of that same run. Preserve every acceptance obligation; add no
evidence parser, harness, or new task family.

Moving all proof producers earlier is viable but needlessly disturbs the existing
behavior → internal tests → qualification sequence. Weakening closeout checks or
pretending configured CI is executed proof is not viable.

**Refutation:** Earlier CI/guidance tasks produce configuration and labels, not
the expressly required real recorded results. Synthetic fixture tests cannot
replace actual qualification evidence.
**Strongest counterargument:** Direct checks can be missed unless the last task
clearly names them; retain them explicitly in 3.3.2's Verify contract.
**Confidence:** Medium — concrete task dependency verified; challenger unavailable.
**Hardening:** Keep direct evidence inspection, not a larger automated meta-test system.
**User Decision:** Plan-owned recommendation selected under workflow directive 4;
explicitly approved with all five corrections on 2026-09-17: “i do approve”.
**Application:** Applied and verified. Task 3.2.5 gates runnable suites only;
3.3.1/3.3.2 produce and directly inspect actual native, observation, and deferral
evidence before final review, green commit, or Done. Independent delivery review
confirmed no acceptance obligation was dropped or replaced by synthetic evidence.

### PF-003: Test malformed file bytes when byte reading exists 🟡 MINOR

**Dimension:** 11 — Ordering and sequencing.
**Location:** `07-testing-strategy.md:38`; `99-execution-plan.md:59,76,120`.
**Codebase evidence:** `packages/config/src/parse.ts:74` accepts strings;
`packages/compiler/src/host/disk-host.ts:74` uses ordinary string reading.

**Problem in plain language:** Phase 1's parser accepts JavaScript text, not raw
file bytes. Its malformed UTF-8 file test belongs to Phase 2's fatal byte decoder.
Rejecting an unpaired JavaScript surrogate is a different proof.

**Recommended:** Leave BOM/span/position and ill-formed JavaScript text checks in
Phase 1. Move malformed manifest/source byte vectors to Phase 2 with ST-31 and
task 2.2.4. No early byte-reader API is needed.
**Refutation:** The standalone text validator cannot represent every malformed
UTF-8 byte sequence without another decoding stage.
**User Decision:** Plan-owned correction selected under workflow directive 4;
explicitly approved with all five corrections on 2026-09-17: “i do approve”.
**Application:** Applied and verified. ST-12 owns pure-text/BOM/position cases;
ST-31 owns malformed manifest and source bytes in Phase 2. Independent delivery
review confirmed the byte-decoding dependency and retained both obligations.

### PF-004: Include a below-limit JSONC nesting failure 🟡 MINOR

**Dimension:** 9 — Edge cases.
**Location:** `03-02-project-service.md:103–107,174–188`;
`07-testing-strategy.md:36,58`.
**Codebase evidence:** `packages/config/package.json:16` pins JSONC 3.3.1;
`packages/config/src/parse.ts:80–81` invokes its parser/tree.

**Problem in plain language:** A small manifest can exhaust the retained parser's
call stack before schema validation. The byte cap alone does not prevent this.
Both auditor and lead reproduced `RangeError` on Node 22.23.1 with the installed
3.3.1 library in the parked evidence checkout, without changing that checkout:

```javascript
const text = '{"unknown":' + '['.repeat(10000) + '0' + ']'.repeat(10000) + '}';
parseTree(text, [], { allowTrailingComma: true });
// 20,013 bytes; RangeError: Maximum call stack size exceeded
```

**Recommended:** Add this nested unknown/wrong-type vector to ST-10. Explicitly
return a deterministic typed failure on parser stack exhaustion, without recovery
values, and keep the plan's own tree traversal stack-safe. Retain JSONC; add no
parser dependency, public depth setting, or generalized limit framework.

**Refutation:** Typed failures are already required, so this is a missing concrete
edge/control, not proof the future implementation will crash. Schema rejection
does not prevent the demonstrated parser exception because parsing happens first.
The pinned [JSONC parser source](https://github.com/microsoft/node-jsonc-parser/blob/v3.3.1/src/impl/parser.ts)
shows recursive value/array parsing.
**User Decision:** Plan-owned correction selected under workflow directive 4;
explicitly approved with all five corrections on 2026-09-17: “i do approve”.
**Application:** Applied and verified by the lead. ST-10 includes the reproduced
20,013-byte input. The contract specifies a typed PROJECT_MANIFEST_SYNTAX result,
exact deterministic message, no recovery value, and stack-safe plan-owned traversal.
No dependency or public depth limit was added. Implementation proof remains future work.

### PF-005: Declare the existing private test controls 🟠 MAJOR

**Dimension:** 7 — Testability.
**Location:** `03-02-project-service.md:65–88,184–188`;
`07-testing-strategy.md:56–59,98–100`; `99-execution-plan.md:33–36,106–108`.
**Context evidence:** RD-02 R2.22/AC-20 require controlled-change proof; AC-25
requires bounded-input proof.

**Problem in plain language:** Tests must be written without seeing implementation.
The plan asks those authors to lower limits and trigger changes at exact read
steps, but supplies neither a private access path nor those parameter signatures.
They would have to invent an API or use unreliable timing races.

**Recommended:** Declare only the already-proposed private limit/interleaving
parameters and their exact invocation checkpoints in the existing project modules.
Provide those declarations to the spec author. Keep them out of package exports
and manifest/CLI options. No public host abstraction, separate test framework,
runner, or dependency is justified.

Native concurrent writes remain supporting proof; running large fixtures at every
production limit would not resolve the missing deterministic race contract.
**Refutation:** Real temporary trees and the permitted narrow injection are useful,
but an implementation-blind author still needs the injection declaration.
**Strongest counterargument:** Test hooks can distort production design; keep the
control scoped to existing operations and required test cases, not a generic host.
**Confidence:** Medium — missing contract verified; challenger unavailable.
**Hardening:** Name existing small parameters only; do not build a support layer.
**User Decision:** Plan-owned correction selected under workflow directive 4;
explicitly approved with all five corrections on 2026-09-17: “i do approve”.
**Application:** Applied and verified. `03-02` declares the private import,
function/types, reduced-limit rules, awaited checkpoints, source IDs, and attempt
numbering; test and execution packets include them. Independent fit review
confirmed controls cannot replace host/read/hash/handle/results and are absent
from production exports. No framework or new module owner was introduced.

## Iteration 2 Re-scan

| Coverage | Reviewer | Result |
|---|---|---|
| Dimensions 1/3/12 | Independent `rd02_soundness` follow-up | PF-001 closed; no new finding |
| Dimensions 4/5/11 | Independent `rd02_delivery` follow-up | PF-002/PF-003 closed; no new finding |
| Dimensions 7/10 and simplicity | Independent `preflight_fit` follow-up | PF-005 closed; no new finding or complexity escalation |
| Dimensions 2/13 | Lead, unchanged reconnaissance | Alignment/assumptions remain valid |
| Dimensions 6/8/9 | Lead, bounded correction review | PF-004 closed; production bounds unchanged |
| Compiler/language, data/migration, concurrency lenses | Lead | All rechecked; no residual finding |

The remaining clusters ran inline because fresh-agent creation had reached the
thread limit. Three independent follow-ups and their refutation checks are
recorded; no additional challenger or unanimous independent verdict is claimed.
All 13 dimensions were re-scanned against the revised nine-document target.
New findings: 0. Carried-forward unresolved findings: 0. Simplicity remains PASS.

## Validation and Verdict

All 13 dimensions, three domain lenses, and the explicit simplicity check are
complete. Adversarial checks challenged same-session confirmation, external API
assumptions, whole-filesystem atomicity, future empty packages, parser recovery,
native Windows proof, and premature green evidence. No optional expansion is
reported and no accepted decision is reopened without new evidence.

Primary-source checks: Node 22's [filesystem contract](https://nodejs.org/docs/latest-v22.x/api/fs.html)
supports explicit handle closure, cautions against access-before-use races, and
notes Windows ACL limits of `fs.access`; the plan must prove actual reads.
The [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
confirms the normal package/`tsc` direction and the absence of the old API in 7.0.
The plan avoids that API and requires exact stable-version verification at execution.
Neither external check requires extra production machinery.

Documentation checks: original local links resolve; 35 unique unstarted tasks
parse with no structural problem; spec-first phase ordering is present; seven
register rows are closed under their recorded authority; revised Markdown is
Prettier-clean. Report/plan/roadmap local links, diff whitespace, task structure,
and frozen-surface checks pass. No compiler suite is appropriate here: the
changes are documentation only, and no runtime qualification is claimed.

**The RD-02 plan passes preflight.** All five approved corrections were applied
inside the plan and verified. RD-02 advances to Plan Preflighted; its 35 tasks
remain unstarted. Specification, expert, implementation, sibling RDs, and the
non-integration-branch portfolio are unchanged. This is a plan PASS, not an
implementation or native-host qualification PASS.

## Next Steps

| Action | Owner |
|---|---|
| Start Phase 1 at task 1.1.1 using the verified plan | Agent after execution instruction |
