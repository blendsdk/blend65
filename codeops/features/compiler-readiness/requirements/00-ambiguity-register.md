# Ambiguity Register: Compiler Readiness

> **Status**: ✅ GATE PASSED — all 18 items resolved
> **Last Updated**: 2026-09-02
> **Mode**: Auto-design for AR-4–AR-9; normal user authority for AR-11–AR-18
> **Root invocation ID**: `compiler-readiness-20260723-01`
> **Policy version**: 1

| # | Category | Ambiguity / gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-1 | Scope | What defines compiler readiness? | Frozen v3.0 specification; examples, goldens, twins and performance are secondary evidence | User, imported from retro T-003/T-008 | ✅ Resolved |
| AR-2 | Behavioral | Is runtime/computed memory access an unsupported feature or a defect? | Defect: ordinary `word` address forms required by the spec belong in recovery scope | User, imported from retro T-001 | ✅ Resolved |
| AR-3 | Scope | Does assembly parity participate in the readiness gate? | No. Correctness, expressibility and robustness gate first; parity remains downstream quality evidence | User, imported from retro T-002/T-004/T-005 | ✅ Resolved |
| AR-4 | Data & state | How is the normative rule inventory represented? | Versioned closed JSON: JSON Schema validates local shape, a semantic validator owns cross-record integrity, and declared handler contracts bind to implementations in RD-02/RD-03 | AI delegated by `--auto-design`, hardened by RD-01 preflight | ✅ Resolved |
| AR-5 | Technical | What provides an independent semantic oracle? | Hybrid: deliberately bounded pure interpreter plus orthogonal metamorphic relations | AI delegated by `--auto-design` | ✅ Resolved |
| AR-6 | Technical | How are programs generated without sharing compiler assumptions? | Independent typed generator IR for valid/type-neighbor cases; grammar/token/text generation for malformed syntax and robustness | AI delegated by `--auto-design` | ✅ Resolved |
| AR-7 | Integration | Which execution tier decides each case? | Every rule declares one or more capability-defined evidence obligations; use cheapest-sufficient routes, while runtime-semantic cases must reach ACME and bounded VICE | AI delegated by `--auto-design`, hardened by RD-01 preflight | ✅ Resolved |
| AR-8 | Failure recovery | How are generated failures minimized? | Typed-IR-aware shrinking for semantic cases; token/text delta debugging for malformed cases; preserve rule coverage and failure predicate | AI delegated by `--auto-design` | ✅ Resolved |
| AR-9 | Data lifecycle | Which generated evidence is persistent? | Commit versioned rule/schema data and confirmed minimized regressions; retain campaign manifests/summaries; bulk cases remain reproducible ephemeral data; activate RD-07 evolution gates before the first format upgrade | AI delegated by `--auto-design`, hardened by RD-01 preflight | ✅ Resolved |
| AR-10 | Product acceptance | What exact scope and threshold earns a readiness claim? | Issue target-scoped claims, beginning with `C64 v3.0 Ready`; require 100% of applicable mandatory rules modeled and passing their declared terminal tier, zero unexplained exclusions, and zero ICE/assembler-failure/timeout outcomes. Never issue an unqualified global “compiler ready” claim while another advertised target is unevaluated. Additional platform readiness is future work. | User approved recommendation | ✅ Resolved |
| AR-11 | Scope | What must RD-08 do with the remaining 2,103 rule records? | Give every record an explicit terminal disposition; source-generatable rules receive executable cases, while non-source-generatable rules receive named deterministic evidence and cannot silently pass or remain generically unmodeled | User accepted the complete RD-08 recommendation package | ✅ Resolved |
| AR-12 | Technical | How broadly should the independent generator IR grow? | Add only constructs required by owned rule families, beginning with arrays, calls, branches and bounded loops; do not build a second full compiler | User accepted the complete RD-08 recommendation package | ✅ Resolved |
| AR-13 | Scale | Are 2,103 separate generator implementations required? | No; reviewed data-driven family templates retain one traceable disposition and result per inventory rule without bespoke implementations for equivalent shapes | User accepted the complete RD-08 recommendation package | ✅ Resolved |
| AR-14 | Integration | Which pipeline and evidence tiers must generated cases exercise? | Exercise the public compiler pipeline and every rule's existing declared obligations; runtime rules reach ACME/VICE, while frontend-only rules do not pay emulator cost | User accepted the complete RD-08 recommendation package | ✅ Resolved |
| AR-15 | Non-functional | May broad readiness campaigns enter normal development and quick-release tests? | No; root tests retain a bounded deterministic smoke selection, while exhaustive campaigns remain explicit readiness/release work | User accepted the complete RD-08 recommendation package | ✅ Resolved |
| AR-16 | Data lifecycle | How does broader rule-model data evolve? | Use the smallest additive versioned evolution required and preserve byte-identical historical v1 publications and exact replay; never reinterpret existing evidence in place | User accepted the complete RD-08 recommendation package | ✅ Resolved |
| AR-17 | Ownership | Does RD-08 fix compiler or optimizer defects it discovers? | No; it publishes exact evidence and routes semantic defects to compiler recovery and cost defects to parity/optimizer owners. It adds no general failure-harness work beyond what its new cases require | User accepted the complete RD-08 recommendation package | ✅ Resolved |
| AR-18 | Optimizer handoff | When and how does RD-08 begin helping optimizer development? | Its first vertical slice publishes arrays, calls, branches and loops through the existing provider contracts; optimizer foundations may then proceed while RD-08 coverage expands, and readiness supplies semantics but never cost truth | User accepted the complete RD-08 recommendation package | ✅ Resolved |

## Delegated Resolution Records

### RD-08 Normal-Mode Resolution — AR-11–AR-18

- **Authority:** User — explicit bulk acceptance on 2026-09-02
- **Decision:** The user accepted the complete recommended RD-08 scope and sequencing after review
  of how generated semantic evidence feeds compiler recovery, assembly parity and the commercial
  optimizer without itself becoming performance authority.
- **Accepted package:** complete rule dispositions; minimum family-driven IR; arrays/calls/branches/
  bounded-loops first; declared public execution tiers; bounded smoke versus explicit exhaustive
  campaigns; additive historical compatibility; evidence-only defect routing; first-publication
  optimizer handoff.
- **Rejected direction:** waiting for all 2,103 remaining models before optimizer work. The first
  vertical publication unlocks optimizer foundations while denominator expansion continues.
- **Confidence:** High — each choice is grounded in the existing RD-02–RD-04 provider contracts,
  RD-06 strict gate and the preflighted optimizer translation-validation contract.
- **Reopen trigger:** an accepted provider contract cannot represent the first vertical families
  without making readiness depend on compiler internals or performance evidence.

### AR-4 — Rule inventory representation

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal data representation and reversible schema-evolution mechanism
- **Objective:** auditable machine-readable coverage without coupling semantic authority to compiler code
- **Decision:** versioned closed JSON owns stable rule IDs, resolvable spec citations, domains,
  applicability, evidence obligations and handler declarations. JSON Schema validates local shape;
  one semantic validator owns uniqueness, source resolution, graph and declaration integrity.
  RD-02/RD-03 bind executable handlers and readiness rejects unbound declarations.
- **Evidence:** the reconstruction requires a machine-readable denominator and strict separation;
  the repository already uses JSON manifests with TypeScript tooling
- **Rejected alternatives:** Markdown annotations are weakly governed; a TypeScript-only DSL makes
  the authority executable and easier to couple accidentally to compiler internals
- **Strongest counterargument:** split JSON/TypeScript ownership can drift
- **Confidence:** High — reopen if schema/handler integrity cannot be made exhaustive
- **Hardening:** the creation challenger converged; RD-01 preflight separated local schema checks
  from semantic integrity and handler declarations from executable bindings
- **Reopen triggers:** unrepresentable rule domains or unrecoverable schema migration
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-20260723-01`

### AR-5 — Semantic oracle

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal testing architecture within confirmed semantic authority
- **Objective:** detect wrong-code behavior without building a circular oracle or a second complete compiler
- **Decision:** a pure, bounded interpreter is the primary value/state oracle for its explicit
  subset; metamorphic properties provide an independent supplement and cover additional relations
- **Evidence:** compiler output/goldens are disallowed as semantic truth; metamorphic-only testing
  cannot distinguish consistently wrong implementations
- **Rejected alternatives:** full-language interpreter duplicates the compiler; metamorphic-only
  lacks an absolute outcome; compiler-AST evaluation violates independence
- **Strongest counterargument:** the bounded interpreter covers less than the full spec initially
- **Confidence:** High — its explicit subset prevents false completeness
- **Hardening:** blind challenger converged
- **Reopen triggers:** subset cannot grow without sharing compiler semantic code
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-20260723-01`

### AR-6 — Program generation

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** testing algorithm and internal model
- **Objective:** generate defined, type-correct programs while still exercising the real parser
- **Decision:** render Blend65 source from an independent typed generator IR; use grammar/token/text
  generators only for deliberately malformed lexical/parser cases
- **Evidence:** sharing `@blend65/core` AST nodes would import compiler-specific assumptions and
  spans; pure text fuzzing wastes most semantic campaigns on parse errors
- **Rejected alternatives:** compiler AST construction, unrestricted text generation
- **Strongest counterargument:** maintaining another small typed IR adds modeling cost
- **Confidence:** High — independence is the governing objective
- **Hardening:** blind challenger converged
- **Reopen triggers:** renderer cannot round-trip its own independent model deterministically
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-20260723-01`

### AR-7 — Execution tiers

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal execution strategy and performance engineering
- **Objective:** obtain decisive evidence without making every generated case pay emulator cost
- **Decision:** RD-01 declares versioned evidence-capability contracts, initially `frontend`,
  `compiler-api`, `cli`, `emit`, `acme` and `vice`; RD-04 binds executable routes. Each rule
  declares one or more obligations; invalid diagnostic cases prove both diagnostics and no
  emission, while runtime-semantic rules include bounded cases through ACME and VICE even when
  cheaper obligations pass.
- **Evidence:** VICE suites are sequential and not universally available in CI; runtime behavior
  cannot be proved by frontend or assembly legality
- **Rejected alternatives:** every case through VICE; failure-triggered heuristic escalation
- **Strongest counterargument:** tier declarations can be under-specified
- **Confidence:** High
- **Hardening:** the creation challenger converged; RD-01 preflight found that compiler API and CLI
  are distinct observable boundaries and that some rules require multiple obligations
- **Reopen triggers:** a declared tier cannot observe the rule's normative outcome
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-20260723-01`

### AR-8 — Failure shrinking

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** failure-recovery algorithm
- **Objective:** produce minimal relevant reproducers without changing the failure class
- **Decision:** typed-IR shrinkers preserve valid/type-constrained cases; text delta debugging is
  restricted to malformed-input campaigns; every step reruns the same terminal oracle
- **Evidence:** text-only shrinking commonly collapses semantic failures into parse errors, while
  AST-only shrinking cannot represent intentionally malformed input
- **Rejected alternatives:** text-only and typed-only minimizers
- **Strongest counterargument:** two shrink paths increase implementation effort
- **Confidence:** High
- **Hardening:** blind challenger converged
- **Reopen triggers:** minimized output cannot preserve rule identity or failure predicate
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-20260723-01`

### AR-9 — Evidence persistence and evolution

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** reversible artifact persistence and compatibility design
- **Objective:** retain forensic evidence without turning generated bulk into repository goldens
- **Decision:** persist schemas, rule inventory, generator/PRNG versions, campaign summaries and
  confirmed minimized regressions; reconstruct bulk cases from identity and seed. RD-01 defines v1
  dispatch and migration interfaces; every format upgrade requires a current `evolutionGate`
  record keyed to RD-07's semantic revision and evolution acceptance gate.
- **Evidence:** every failure needs replay, but committing entire campaigns creates bloat and
  accidental authority
- **Rejected alternatives:** commit all generated source; retain only ephemeral CI output
- **Strongest counterargument:** replay can break when generators evolve
- **Confidence:** High
- **Hardening:** the creation challenger converged; RD-01 preflight made the first-upgrade
  prerequisite explicit so migration guarantees cannot arrive after durable readiness evidence
- **Reopen triggers:** a historical confirmed failure cannot be replayed after an allowed upgrade
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-20260723-01`

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature and behavioral gaps | Covered by AR-1–AR-3, AR-5–AR-8 |
| Scope | Target-scoped C64 threshold resolved by AR-10 |
| Technical unknowns | Resolved under auto-design: AR-4–AR-9 |
| Edge cases | Bounds, undefined behavior, malformed input, timeouts and shrink preservation included |
| Integration | Compiler API, ACME, VICE, filesystem and CI tiering included |
| Data and state | Schema versioning, seed identity, persistence and invalidation included |
| Security | Local-path, subprocess, resource-bound and hostile-source risks included |
| Non-functional | Determinism, replay, scale bounds and execution cost included |
| UX/presentation | Human and machine-readable rule matrix included; exact format is reversible |
| Stakeholder conflict | Readiness authority separated from optimization evidence |
| Naming | `compiler-readiness`, rule, case, oracle, terminal tier and readiness claim defined |

## RD-08 Addendum Gate Scan

| Category | Result |
|---|---|
| Feature and behavioral gaps | AR-11–AR-14 define denominator closure, family modeling and execution behavior |
| Scope | AR-12, AR-17 and AR-18 keep the work bounded and separate defect-fix ownership |
| Technical unknowns | AR-12–AR-14 and AR-18 resolve generator, scaling, execution and optimizer handoff |
| Edge cases | RD-08 requires declared boundaries, invalid neighbors, loop bounds and proof-incomplete outcomes |
| Integration | AR-14 and AR-18 bind public execution tiers and the one-way optimizer adapter |
| Data and state | AR-11, AR-13 and AR-16 resolve per-rule identity, family data and historical compatibility |
| Security | Existing closed-input, canonical-path, subprocess and execution bounds remain mandatory |
| Non-functional | AR-15 and AR-16 resolve quick-gate isolation, determinism and evolution |
| UX and presentation | RD-06 retains human/machine reporting ownership; RD-08 supplies per-rule evidence |
| Stakeholder conflict | AR-17 separates readiness, conformance, parity and optimizer owners |
| Naming and terminology | `terminal disposition`, `rule family` and `optimizer handoff` are defined in RD-08 |
