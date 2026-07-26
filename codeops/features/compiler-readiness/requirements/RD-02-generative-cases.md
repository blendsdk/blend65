# RD-02: Typed Generative Cases and Deterministic Replay

> **Document**: RD-02-generative-cases.md
> **Status**: Done
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1

## Feature Overview

Generate bounded valid and invalid Blend65 programs from independent models so readiness explores
type/value boundaries and feature interactions that compiler-authored examples omit.

The completed RD-01 inventory supplies authoritative rule identities and handler declarations, but
its generation-domain arrays are intentionally empty. RD-02 therefore owns a separate executable
rule-model registry. The registry interprets cited rules for generation without changing
inventory rule semantics or claiming that generator code is normative authority. RD-02 does update
the inventory's handler-binding metadata through its reviewed generation workflow.

## Functional Requirements

### Must Have

- [x] Define a small independent typed generator IR. Production rule-model, generator, transform,
  PRNG, renderer and replay modules in `@blend65/readiness` must not import any `@blend65/*`
  workspace package or compiler-owned AST/type utility. Compiler invocation belongs to RD-04
  adapters. (AR-6)
- [x] Before generating cases, define a closed, versioned executable rule-model registry keyed
  exhaustively to RD-01 rule IDs. Every rule is exactly one of:
  `modeled` with cited construction preconditions, typed domains, invalid-neighbor operations,
  boundary families and supported spellings; `unmodeled` with a reason code; or
  `not-generatable` with a reason code. Generators consume only `modeled` records and readiness
  reports every other state; both non-modeled states project to RD-06 `unmodeled` while retaining
  the closed reason code. Requirement prose is never parsed to infer a model.
- [x] Bind every implemented generator and `transform.boundary-variants` to its RD-01 handler
  declaration through a separate closed executable-binding registry. Each binding records handler
  ID, kind, declared contract version and a content-addressed implementation revision. Candidate
  validation requires one existing compatible `unbound` declaration but does not expose the
  binding. Published-state validation rejects undeclared or duplicate bindings, kind/contract
  mismatches, a published registry entry for an `unbound` declaration, and a `bound` declaration
  without exactly one compatible published binding.
- [x] Publish a binding only in this order: candidate-validate against the unbound declaration;
  stage the authoritative declaration as `bound`; refresh its semantic-review evidence and
  generated projections; published-state-validate the staged authority and registry
  bidirectionally; then atomically publish both. Failure at any step leaves the declaration and
  published registry unbound and unchanged.
- [x] Render IR through deterministic source generation so the real lexer and parser remain under
  test.
- [x] Generate valid programs only where evaluation behavior is defined by inventoried rules.
- [x] Generate type-neighbor invalid programs with one intentional contract violation and a named
  expected diagnostic family.
- [x] Use token/text generators only for lexical, parser and malformed-input robustness rules.
- [x] Pin the PRNG algorithm and version as well as the campaign seed.
- [x] Define one canonical `CampaignIdentity` containing the inventory schema version, inventory
  version, canonical inventory digest, spec revision, rule-model registry version and digest,
  generator handler ID/contract version/implementation revision, boundary-transform handler
  ID/contract version/implementation revision, renderer revision, target, PRNG algorithm/version,
  seed and normalized generation-configuration digest.
- [x] Derive `CaseIdentity` from the campaign digest plus a deterministic generation path and
  ordinal. Domain-separated SHA-256 identities must reject collisions. Replay requires the exact
  identity and produces an explicit unavailable/incompatible result when a referenced revision
  cannot be loaded; it never substitutes current code.
- [x] Generate boundary values, empty/min/max forms, signed/unsigned widths, literal/const/local/
  parameter spellings, nesting and cross-module combinations where permitted by the rule model.

### Won't Have

- Unrestricted random text as semantic coverage.
- Construction of compiler-owned AST nodes.
- Generation of undefined behavior as a valid semantic case.

## Technical Requirements

Generation is compositional and rejects a case before compilation when it exceeds maximum modules,
declarations, IR nodes/statements, expression depth, statically bounded loop-work product, source
bytes or generation attempts. These structural limits are separate from RD-03 evaluator steps and
RD-04/RD-07 compiler, assembler, emulator and wall-time limits.

Source rendering has a structural round-trip test through a deliberately bounded independent
tokenizer and parser/normalizer for exactly the emitted subset. The inverse implementation uses
separate precedence data and normalizes only semantically irrelevant surface choices before
comparing with the originating IR. It is mutation-tested for precedence and parenthesization. The
real compiler parser remains an integration check, never the renderer's only oracle.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Valid generation | Independent typed IR | AR-6 |
| Malformed generation | Token/text partition | AR-6 |
| Persistence | Identity and promoted failures, not all cases | AR-9 |
| Rule models | Separate exhaustive registry; modeled/unmodeled/not-generatable | AR-6 |
| Executable binding | Closed registry checked bidirectionally against RD-01 declarations | AR-4 |
| Replay | Content-addressed campaign identity plus deterministic case path | AR-9 |

## Security Considerations

Generated identifiers and paths use allowlists. Campaign budgets prevent resource exhaustion.
Sources are data files, never executed by the host. Temporary directories are unique and removed
after bounded execution. No credentials, user accounts, encryption or network access are involved.
Registry and replay inputs are closed, size-bounded data; unknown fields, identities, algorithms,
versions and absolute or traversal-bearing paths are rejected before generation or filesystem use.

## Acceptance Criteria

1. [x] Static boundary tests fail on every `@blend65/*` production import in the rule-model,
   generator, boundary-transform, PRNG, renderer and replay implementation surface.
2. [x] The rule-model registry covers every inventory rule ID exactly once and rejects missing,
   duplicate or unknown IDs, invalid states and uncited modeled semantics. A campaign cannot claim
   a rule that is `unmodeled` or `not-generatable`, and reports that state non-vacuously.
3. [x] At least one independently reviewed initial rule subset has non-empty typed domains,
   invalid neighbors and boundary families; each participating rule has a machine-checkable model
   rather than semantics derived from requirement prose.
4. [x] Replaying the same complete `CampaignIdentity` and `CaseIdentity` produces byte-identical
   Blend65 source in two fresh processes. Changing each case-shaping identity field—including
   canonical inventory content or boundary-transform revision—changes the campaign/case identity
   or returns an explicit incompatibility/invalidation result.
5. [x] Equal case IDs under different generator or boundary-transform handler IDs, targets,
   configuration digests or implementation revisions cannot collide, and an unavailable
   historical revision never falls back to the current implementation.
6. [x] Valid campaigns generate at least literal, named-constant, local-variable and parameter
   spellings for every participating modeled rule whose declared model permits those forms.
7. [x] Invalid semantic cases contain exactly one intentional violation recorded in case metadata;
   applying the recorded neighbor operation to a model-valid baseline is independently validated
   to violate only its named contract and carries a named expected diagnostic family.
8. [x] Maximum configured modules, declarations, IR nodes/statements, expression depth, bounded
   loop-work product, source bytes and generation attempts are enforced before compilation.
9. [x] A renderer mutation affecting precedence or parentheses is detected by independent
   tokenizer/parser round-trip and property tests whose precedence data is not shared with the
   renderer.
10. [x] Binding validation fails for an undeclared, duplicate, kind-incompatible,
    contract-incompatible or revision-invalid generator/boundary-transform implementation and
    leaves declared-but-unbound handlers visibly unavailable.
11. [x] `transform.boundary-variants` is implemented as the generator-domain boundary transform
    and bound by RD-02; oracle-aware semantic/metamorphic transforms remain RD-03-owned.
12. [x] Closed registry, replay and identifier/path validation rejects unknown fields, unsupported
    versions or algorithms, oversized inputs, absolute paths and traversal before generation or
    filesystem access.
13. [x] Binding publication proves candidate validation and published-state validation as
    distinct state machines, plus their required candidate-validate → bind →
    review/projection-refresh → published-state-validate → atomic-publication sequence. Premature
    or stale `bound` metadata fails, and any unsuccessful promotion preserves the prior unbound
    authority and registry.

## Closeout Evidence

Implementation verification and independent quality closeout passed on 2026-07-26.

- The exhaustive 2,112-rule registry remains explicit: nine independently reviewed scalar and
  memory rules are modeled, while every other rule remains visibly unmodeled and cannot count as
  generated coverage.
- Deterministic construction, rendering, independent round trip, campaign identity and exact
  fresh-process replay pass the immutable readiness specification tier.
- The three generators and `transform.boundary-variants` are bound through independently reviewed
  publication `sha256:41afbb4512456470e0b182fb14edb5caeaac7688d7e36ba1e102fc8d42ae3403`;
  later-RD oracles and execution capabilities remain unbound.
- The selected inventory and its accepted 20-unit review evidence were promoted to the checked-in
  current authority. Regenerated Markdown and TypeScript projections are byte-identical to the
  selected release; source-authoring and selected-publication checks both pass.
- Readiness coverage passes with 66 test files, 952 tests and 90.01% branches. The exact repository
  verify command passes across all 18 workspace tasks, emulator-backed acceptance tests and the
  root boundary tier. The authorized specification-test baseline and frozen `spec/` tree are
  unchanged; independent remediation review accepted RV-002–RV-006 as resolved with no surviving
  critical or major finding, and its RV-007 documentation-only drift is corrected.
- Deferral-expiry review retained RD-03 ownership of semantic/diagnostic/metamorphic oracles,
  RD-04 ownership of compiler/ACME/VICE routes, RD-05 ownership of shrinking and regression
  promotion, and RD-07 ownership of retention/evolution guarantees. Broad aggregate, pointer,
  control-flow, interrupt, embed and full-module model/generator expansion had no owner; it is now
  reopened as roadmap backlog RD-08 and blocks RD-06 readiness release work. No item in
  `spec/future-considerations.md` names RD-02 or one of its phases as its landing place.
- No VitePress technical-architecture set is configured in this repository. The durable
  publication architecture is recorded in the plan component specification and public
  `readiness/README.md`; no separate techdocs update is due.
