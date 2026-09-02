# RD-08: Complete C64 Rule Models and Generated-Program Coverage

> **Document**: RD-08-complete-c64-rule-coverage.md
> **Status**: Approved
> **Created**: 2026-09-02
> **Project**: Compiler Readiness
> **Depends On**: RD-01, RD-02, RD-03, RD-04; completed RD-05 Phase 3 contracts; RD-07 evolution contract before the first changed-format selection
> **CodeOps Artifact Schema**: 1

## Feature Overview

Expand compiler-readiness from its nine-rule scalar/memory seed to the complete C64 v3.0
denominator. The current inventory contains 2,112 rules: nine have reviewed executable models and
2,103 remain `unmodeled`. RD-08 gives every rule an explicit terminal disposition and adds broad,
independently generated Blend65 programs that exercise the real frontend, compiler, emitter,
assembler and emulator paths. (AR-11, AR-14)

This is the compiler-facing coverage phase. It begins with arrays, nested calls, branches and
bounded loops because those constructs reach substantially more compiler machinery than the
existing scalar seed. The resulting cases and independent expectations also become semantic input
to the commercial optimizer's reference, isolated-pass, prefix and full-profile validation. Cost
and expert-assembly parity remain separate authorities. (AR-12, AR-18)

## Functional Requirements

### Must Have

- [ ] Replace every `outside-initial-slice` reason in the selected 2,112-rule authority. Keep
  independently validated facts per rule: immutable inventory applicability; reviewed
  semantic-gate or secondary-quality claim role; a source-generated or named non-source evidence
  route; and a decisive passing, failing or blocking evidence result. The fail-closed join of those
  facts produces the RD-06 projection. `blocked-errata` and
  `out-of-claim-target` remain inventory applicability, not duplicated rule-model states. Generic
  `unmodeled`, route classification alone and unsupported-oracle outcomes cannot satisfy or
  disappear from readiness. (AR-11)
- [ ] Preserve one independently reviewable rule result per inventory ID even when many rules use
  one shared construction, predicate, diagnostic or observation family. Removing or misrouting one
  rule binding must fail complete-authority validation. (AR-13)
- [ ] Extend the independent typed generator IR with the minimum forms required for arrays,
  indexed reads/writes, function calls, nested calls, `if`/branching and bounded loops. Every form
  carries enough independent type and effect information to reject undefined programs before the
  compiler is invoked. (AR-12)
- [ ] Generate valid cases for every supported construction and invalid cases for every declared
  invalid-neighbor contract. Cover every declared boundary family and applicable source spelling;
  a missing construction, neighbor, boundary or spelling is a visible coverage failure.
- [ ] Extend independent semantic, diagnostic and metamorphic contracts for the new IR forms.
  Absolute expectations come from bounded independent evaluation or reviewed deterministic
  evidence; relations such as legal loop unrolling supplement but never replace an absolute
  expectation where observable state is defined.
- [ ] Validate generated programs through each inventory rule's declared evidence obligations.
  Frontend-only rules stop at the frontend; compiler, CLI, emit and ACME obligations reach their
  exact public boundaries; every mandatory modeled rule with a `vice` obligation contributes at
  least one bounded case that assembles and executes on real VICE. (AR-14)
- [ ] Publish the expanded rule-model, generator, oracle and transform bindings atomically through
  the existing content-addressed provider contracts. A consumer cannot observe a mixed old/new
  authority, and failure at validation, review, staging or selection preserves the prior selected
  publication.
- [ ] Make the first independently accepted RD-08 publication contain arrays, calls, branches and
  bounded loops before attempting denominator-wide expansion. A lexically ordered reviewed list in
  that publication names every included inventory ID and family member; family validation cannot
  silently add or omit members. It must expose a stable case, expectation and execution envelope
  that a small consumer-contract fixture can read without any production compiler or optimizer
  import of `@blend65/readiness`. Real optimizer profiles and mismatch localization remain owned by
  `game-optimizer-codegen/RD-14`. (AR-18)
- [ ] Preserve the normal development gate: the readiness portion of `yarn test` runs a fixed,
  versioned, bounded smoke selection and never invokes the exhaustive readiness campaign or its
  production VICE routes. Exhaustive non-emulator and emulator readiness campaigns remain explicit
  readiness/release commands. This does not alter the separate compiler test-harness emulator tier.
  (AR-15)
- [ ] Keep each campaign deterministic and bounded across modules, declarations, IR nodes,
  statements, expression depth, loop work, source bytes, construction attempts and execution
  resources. Exact-bound cases succeed; the next consuming event returns the stable applicable
  budget result and cannot count as passing evidence.
- [ ] Keep the first implementation phase centered on real generated Blend programs and independent
  semantic expectations for arrays, calls, branches and bounded loops. It may extend only the
  existing generator, oracle, publication and execution seams needed by those cases; it cannot add
  a generalized framework, resume unfinished RD-05/RD-07 phases or expand readiness-execution
  infrastructure.
- [ ] Route every compiler rejection, diagnostic mismatch, ICE, emission/assembly failure,
  timeout and semantic mismatch through the existing typed evidence contracts with its exact rule,
  case, publication, compiler and execution identities. RD-08 adds only the reduction support
  required by its new IR forms and does not resume unrelated failure-harness expansion. (AR-17)
- [ ] Export semantic failures to conformance/compiler recovery and cost-only divergences to
  assembly-parity/optimizer ownership. A performance improvement cannot waive a semantic failure,
  and a semantically passing case cannot claim expert parity without independent cost evidence.
  (AR-17, AR-18)
- [ ] Keep `spec/` byte-identical. Contradictory normative sources remain `blocked-errata`; RD-08
  cannot invent semantics or change the frozen v3.0 authority.

### Should Have

- [ ] Partition exhaustive campaigns by rule family and evidence tier so a developer can run one
  bounded family without executing the complete denominator.
- [ ] Publish family-level counts for modeled, passing, failing, blocked and non-source evidence,
  while retaining per-rule drill-down for RD-06.
- [ ] Reuse one generated case for multiple compatible rule claims only when every claimed rule's
  preconditions, evidence obligations and expected projection are independently validated.

### Won't Have

- Compiler, optimizer or platform-library fixes discovered by the campaigns — those land in their
  owning feature with the RD-08 reproducer retained as evidence. (AR-17)
- Performance ratios, optimizer profitability or expert-assembly judgments in semantic readiness.
- A second full Blend65 parser, type checker, compiler or unrestricted evaluator. (AR-12)
- Hand-authored generator implementations for every rule when reviewed family data expresses the
  same contract. (AR-13)
- More general failure storage, orchestration or reduction infrastructure than the new case forms
  demonstrably require. (AR-17)
- Readiness claims for non-C64 targets or changes beneath `spec/`.

## Technical Requirements

### Rule-family authority

The rule-model authority remains closed and versioned. A family definition owns shared
construction preconditions, typed domains, invalid contracts, predicates, boundary families,
spellings and oracle routes. Each member retains its own rule ID, source citation and route/model
facts. The terminal projection joins the inventory-owned applicability and evidence
obligations, the reviewed claim role and the evidence result by rule ID; family data cannot override
those authorities. Family expansion is deterministic: the same reviewed authority produces the
same lexically ordered member bindings and content digest. (AR-13)

The first vertical publication carries a simple reviewed `firstVerticalRuleIds` list inside that
authority. Its members are exactly the accepted arrays, calls, branches and bounded-loop rule IDs;
unknown, duplicate, omitted or family-incompatible members fail validation. This list reuses the
publication's existing content identity and review transaction rather than introducing another
manifest or selection system.

For every inventory ID, the terminal join preserves inventory applicability and the reviewed claim
role, selects exactly one source or non-source evidence route, and records exactly one decisive
result. A non-source passing result requires an accepted named handler result. Missing facts, an
invalid applicability/claim-role/route/result combination or disagreement between authorities is
blocking rather than projected optimistically.

Rules that cannot be proven by generated source use a named deterministic evidence handler rather
than an executable-source constructor. Such a handler must state the observable contract, input
authority, failure states and evidence capability. It is subject to the same binding, revision,
review and stale-evidence checks as source-generating handlers. `not-source-generatable` is a route
classification, never a passing result by itself. (AR-11)

### Independent generator and oracle

New generator nodes are immutable, closed discriminated unions validated before rendering. The IR
models only semantic information required to construct defined programs and compute expectations;
it does not copy compiler AST nodes or internal lowering forms. Production generator, evaluator and
transform code keeps the existing dependency boundary that forbids imports from compiler packages.

Array models cover fixed and unsized parameter shapes where the frozen language permits them,
minimum extent one, maximum supported extents, empty initializers where legal, direct and computed
indices and element reads/writes. A constant out-of-range index is an invalid neighbor with the
frozen diagnostic; a computed runtime out-of-range index remains valid and its absolute expectation
uses the frozen address-space wrapping behavior. Zero declared extent is the E10111 invalid
neighbor, never a supported array shape. Call models cover zero and multiple parameters, nested calls, return
values, `void`, by-value and supported by-reference forms. Control-flow models cover both branch
outcomes, nested branches, zero/one/multiple loop iterations, legal bounds and termination budgets.
Unsupported semantic forms return explicit unmodeled/proof-incomplete evidence and cannot pass.

Valid `embed()` rules use fixed content-addressed, size-bounded fixture IDs materialized through the
existing canonical execution workspace. Generated source cannot select a host path or command.
Absolute, traversal, symlink, missing-file and over-limit forms remain rejection cases and cannot
read outside the allocated workspace. This is a narrow case-input mapping, not a general asset or
workspace subsystem.

Metamorphic transforms prove and record their preconditions before construction. A loop-unrolling
relation preserves the loop's ordered observable projection, iteration domain, overflow behavior,
volatile effects and termination bound; it is inapplicable when those conditions cannot be proven.

### Publication and migration

Use the smallest additive schema/publication evolution that can represent rule families and
non-source evidence routes. Existing v1 inventory, rule-model and publication bytes remain
unchanged and independently resolvable. Before the first changed-format selection, implement and
record only RD-07's required version-dispatch, deterministic migration, failure-atomic selection and
replay-invalidation checks; this does not resume or advance the rest of RD-07. Parent and execution
publications retain their existing separate pointers and exact parent-child digest binding. A stale
intermediate pair is explicitly unavailable and fail-closed until the compatible child is selected;
recovery must restore a valid pair without exposing mixed evidence. Replay never substitutes a
current implementation for an unavailable historical revision. (AR-16)

Before denominator-wide expansion, review all selected `quality-obligation` records against their
frozen citations. True correctness/semantic obligations remain mandatory semantic-gate rows.
Byte-, cycle- and other cost-only obligations retain their inventory IDs but project only to the
secondary quality section consumed by parity/optimizer work; they cannot change semantic readiness.
An ambiguous or unreviewed classification remains blocking. This reconciliation is rule data and
validation, not a new cost-measurement subsystem.

### Optimizer-consumer contract

Readiness publishes cases, independent semantic expectations and stable replay/execution identity;
it does not publish cost truth. RD-08 proves this provider boundary with one small consumer fixture
that reads the published envelope and preserves its identity. The optimizer harness later consumes
that envelope through a one-way adapter and owns reference, isolated-pass, prefix and full profile
execution, comparison and mismatch localization. (AR-18)

The first vertical publication is the optimizer unlock gate. Denominator-wide model expansion may
continue after that publication while optimizer authority, effects, pass-manager and whole-program
analysis foundations proceed. Neither workstream may claim the other's completion.

### Development and release tiers

The root test command includes only a deterministic readiness smoke manifest with a positive
case-count cap of at most four cases per included family and sixteen generated cases in total.
Tests prove from the readiness command graph that it cannot
reach the exhaustive readiness campaign or its production VICE routes. Adding a family requires an
explicit smoke selection; it cannot make all cases implicit members. Full readiness campaigns
remain separately invocable by family, evidence tier and complete denominator, and their results
never enter Turbo's normal test dependency graph. The compiler test-harness keeps its independently
owned emulator coverage. (AR-15)

## Integration Points

| Provider or consumer | Contract |
|---|---|
| RD-01 | Supplies the exact 2,112-rule denominator, citations, applicability and evidence obligations |
| RD-02 | Supplies independent typed generation, deterministic identity and replay contracts |
| RD-03 | Supplies semantic, diagnostic and metamorphic oracle contracts |
| RD-04 | Executes selected cases through frontend, compiler, CLI, emit, ACME and VICE routes |
| RD-05 | Supplies its completed Phase 3 classification, exact-route execution and confirmation contracts; unfinished durable publication/promotion remains deferred and is not an RD-08 closeout dependency |
| RD-06 | Consumes complete per-rule dispositions and evidence for the strict readiness matrix |
| RD-07 | Supplies only the mandatory evolution contract activated locally before the first changed-format selection; its remaining work stays deferred |
| `blend65-conformance` | Owns expressiveness, rejection, ICE and wrong-result compiler recovery |
| `asm-parity` | Owns expert-twin byte/cycle comparison and cost-only divergence routing |
| `game-optimizer-codegen` | Consumes generated cases and expectations for pass validation; owns optimization implementation and cost authority |

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Denominator closure | Explicit terminal disposition for all 2,112 rules | AR-11 |
| Generator breadth | Minimum family-driven IR, beginning with arrays/calls/branches/loops | AR-12 |
| Scale strategy | Reviewed family templates with per-rule traceability | AR-13 |
| Execution | Existing declared public-pipeline obligations | AR-14 |
| Developer gate | Bounded smoke; exhaustive readiness/release commands remain separate | AR-15 |
| Evolution | Additive versioning with historical v1 replay | AR-16 |
| Defect ownership | Evidence and routing here; fixes remain with compiler/optimizer owners | AR-17 |
| Optimizer handoff | First vertical publication unlocks concurrent optimizer foundation work | AR-18 |

## Security Considerations

Generated inputs are closed, immutable and size-bounded before rendering or execution. Identifiers,
module paths and asset-free source forms use allowlists; no generated value can select host paths,
commands, environment values, network endpoints or emulator arguments. Existing canonical-root,
subprocess-array, output-cap, timeout, process-tree and loopback-only VICE protections remain
mandatory for every new route.

The feature handles no authentication, credentials, PII or remotely supplied data. Historical
artifacts retain repository-relative paths and content identities only. Hostile objects, exotic
prototypes, accessors, cycles, over-limit graphs and stale/mixed publications fail validation
before compiler or subprocess work.

## Acceptance Criteria

1. [ ] The selected rule-model authority contains exactly the same 2,112 rule IDs as the selected
   inventory. All nine existing modeled rules remain present, and none of the other 2,103 records
   retains `outside-initial-slice`; deleting, duplicating or misrouting one ID fails validation.
2. [ ] Every semantic-gate mandatory C64 rule has either a source-modeled route or an accepted named
   non-source route and exactly one decisive passing, failing or blocking result. A
   `blocked-errata` result retains both conflicting citations. A non-source classification without
   an accepted handler result remains blocking; only a passing result can satisfy the later RD-06
   semantic-readiness gate; a cost-only row requires the reviewed secondary-quality claim role; and
   no out-of-claim target or claim role can hide a semantic mandatory C64 rule.
3. [ ] Immutable specification tests generate, validate, render and deterministically replay array,
   nested-call, branch and bounded-loop cases. They cover minimum extent one, zero-extent E10111,
   maximum supported extents, legal empty initializers, constant out-of-range rejection, computed
   runtime wrapping, both branch outcomes, zero/one/multiple loop iterations, exact generation
   bounds and the first over-bound event.
4. [ ] Every declared construction, invalid neighbor, boundary family, applicable spelling and
   evidence obligation has at least one selected case or a stable explicit blocker. Injecting one
   omitted member in each category fails coverage validation.
5. [ ] The expanded evaluator and relations distinguish seeded wrong array indexing, call argument
   order, return propagation, branch selection, loop termination, overflow, volatile-effect order
   and illegal loop-unrolling behavior. Unsupported proof forms return proof-incomplete and never
   count as pass.
6. [ ] Dependency-boundary tests reject every production readiness import from compiler packages
   and every production compiler/optimizer import from readiness. Seeded compiler-output,
   unoptimized-output and golden-derived expectations each fail oracle acceptance.
7. [ ] Every modeled mandatory rule reaches all declared public evidence obligations; each rule
   with a `vice` obligation contributes at least one case that assembles and executes on real VICE.
   Missing ACME/VICE remains unavailable/blocking, not skipped or passing.
8. [ ] The first accepted RD-08 publication's reviewed member list contains exactly its accepted
   array, call, branch and bounded-loop inventory IDs. A consumer-contract fixture reads one
   unchanged published case/expectation/execution envelope without importing readiness into
   production compiler or optimizer code. Real optimizer-profile execution remains an optimizer
   RD-14 acceptance criterion, not an RD-08 prerequisite.
9. [ ] Existing v1 inventory, rule-model and publication files remain byte-identical and resolve
   independently after the expanded selection. Missing historical revisions reject replay without
   substituting current code; crash-injected promotion preserves the prior selected publication.
10. [ ] The readiness smoke invoked by `yarn test` cannot invoke exhaustive readiness campaigns or
    production VICE routes, rejects a fifth case in one family and a seventeenth generated case in
    total, and runs only its bounded manifest. The explicit full command can
    execute the complete non-emulator population, while readiness emulator campaigns remain
    separately bounded and locally available. The independent compiler test-harness emulator tier
    is unaffected.
11. [ ] A seeded valid-program rejection, invalid-program acceptance, wrong diagnostic, ICE,
    semantic mismatch, assembler failure, VICE failure, timeout and cost-only divergence each
    receives its distinct owner and exact reproducible identity. Cost-only evidence cannot alter a
    semantic result, and RD-08 adds no unrelated failure-harness subsystem.
12. [ ] `spec/` has no changes. Every authority conflict stays visible as `blocked-errata`, and no
    generated expectation resolves contradictory frozen semantics by inference.
13. [ ] All selected `quality-obligation` rows have reviewed frozen-source classifications. True
    semantic obligations remain in the semantic gate, cost-only rows retain their IDs in the
    secondary quality projection, and one ambiguous or unreviewed row blocks denominator closure.
14. [ ] The first changed-format selection is rejected until the minimal RD-07 evolution record is
    present. Selecting a new parent before its compatible execution child yields explicit
    unavailable evidence, never a mixed pass, and recovery selects a valid exact pair without
    altering either historical v1 release.

## Deferral-Expiry Gate

At closeout, answer whether the completed rule families or optimizer handoff expired any rationale
in the compiler-readiness ambiguity register, every RD Won't-Have section,
`spec/future-considerations.md`, or the expressiveness ledger. Reopen every expired item under an
explicit owner before RD-08 closes. In particular, closure may not leave arrays, nested calls,
branches, loops or loop-unrolling relations pointing to RD-08 as future work.
