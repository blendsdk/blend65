# RD-08: Complete C64 Rule Models and Generated-Program Coverage

> **Document**: RD-08-complete-c64-rule-coverage.md
> **Status**: Approved
> **Created**: 2026-09-02
> **Project**: Compiler Readiness
> **Depends On**: RD-01, RD-02, RD-03, RD-04
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

- [ ] Replace every `outside-initial-slice` disposition in the selected 2,112-rule authority with
  a reviewed terminal disposition. Each rule is either source-generated and modeled,
  non-source-generatable with named deterministic evidence, `blocked-errata` with conflicting
  citations, or `out-of-claim-target` with its accepted C64 projection. Generic `unmodeled` and
  unsupported-oracle outcomes cannot satisfy or disappear from readiness. (AR-11)
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
  bounded loops before attempting denominator-wide expansion. It must expose stable case and
  execution identities that the commercial optimizer can consume through an adapter without any
  production compiler or optimizer import of `@blend65/readiness`. (AR-18)
- [ ] Preserve the normal development gate: the readiness portion of `yarn test` runs a fixed,
  versioned, bounded smoke selection and never invokes the exhaustive readiness campaign or its
  production VICE routes. Exhaustive non-emulator and emulator readiness campaigns remain explicit
  readiness/release commands. This does not alter the separate compiler test-harness emulator tier.
  (AR-15)
- [ ] Keep each campaign deterministic and bounded across modules, declarations, IR nodes,
  statements, expression depth, loop work, source bytes, construction attempts and execution
  resources. Exact-bound cases succeed; the next consuming event returns the stable applicable
  budget result and cannot count as passing evidence.
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
spellings and oracle routes. Each member retains its own rule ID, source citation, applicability,
evidence obligations and terminal result. Family expansion is deterministic: the same reviewed
authority produces the same lexically ordered member bindings and content digest. (AR-13)

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
empty/minimum/maximum declared extents, direct and computed indices, element reads/writes and
boundary-invalid indices. Call models cover zero and multiple parameters, nested calls, return
values, `void`, by-value and supported by-reference forms. Control-flow models cover both branch
outcomes, nested branches, zero/one/multiple loop iterations, legal bounds and termination budgets.
Unsupported semantic forms return explicit unmodeled/proof-incomplete evidence and cannot pass.

Metamorphic transforms prove and record their preconditions before construction. A loop-unrolling
relation preserves the loop's ordered observable projection, iteration domain, overflow behavior,
volatile effects and termination bound; it is inapplicable when those conditions cannot be proven.

### Publication and migration

Use the smallest additive schema/publication evolution that can represent rule families and
non-source evidence routes. Existing v1 inventory, rule-model and publication bytes remain
unchanged and independently resolvable. A new selection references exact previous and current
schema, generator, oracle, transform and execution revisions; replay never substitutes a current
implementation for an unavailable historical revision. Any format change activates RD-07's
evolution gate before selection. (AR-16)

### Optimizer-consumer contract

Readiness publishes cases and independent semantic expectations; it does not publish cost truth.
The optimizer harness consumes them through a one-way adapter and runs the identical case identity
under reference, isolated-pass, prefix and full profiles. Every profile compares against the
independent expectation, not merely against unoptimized compiler output. A mismatch names the
first failing profile/pass when known and retains the complete execution identity for replay and
reduction. (AR-18)

The first vertical publication is the optimizer unlock gate. Denominator-wide model expansion may
continue after that publication while optimizer authority, effects, pass-manager and whole-program
analysis foundations proceed. Neither workstream may claim the other's completion.

### Development and release tiers

The root test command includes only a deterministic readiness smoke manifest with a positive
case-count cap per included family. Tests prove from the readiness command graph that it cannot
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
| RD-05 | Classifies, reduces and promotes confirmed failures; RD-08 adds only new-IR reduction forms |
| RD-06 | Consumes complete per-rule dispositions and evidence for the strict readiness matrix |
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
2. [ ] Every mandatory C64 rule ends as modeled with decisive evidence or `blocked-errata` with
   both conflicting citations. A non-source-generatable classification without an accepted named
   evidence handler remains non-passing, and no out-of-claim target can hide a mandatory C64 rule.
3. [ ] Immutable specification tests generate, validate, render and deterministically replay array,
   nested-call, branch and bounded-loop cases. They cover empty/minimum/maximum supported shapes,
   both branch outcomes, zero/one/multiple loop iterations, exact generation bounds and the first
   over-bound event.
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
8. [ ] The first accepted RD-08 publication includes arrays, calls, branches and bounded loops and
   can be consumed under reference, isolated-pass, prefix and full optimizer profiles with one
   unchanged case identity. A seeded profile/pass mismatch names the failing profile and cannot be
   accepted as an optimization.
9. [ ] Existing v1 inventory, rule-model and publication files remain byte-identical and resolve
   independently after the expanded selection. Missing historical revisions reject replay without
   substituting current code; crash-injected promotion preserves the prior selected publication.
10. [ ] The readiness smoke invoked by `yarn test` cannot invoke exhaustive readiness campaigns or
    production VICE routes and runs only its bounded manifest. The explicit full command can
    execute the complete non-emulator population, while readiness emulator campaigns remain
    separately bounded and locally available. The independent compiler test-harness emulator tier
    is unaffected.
11. [ ] A seeded valid-program rejection, invalid-program acceptance, wrong diagnostic, ICE,
    semantic mismatch, assembler failure, VICE failure, timeout and cost-only divergence each
    receives its distinct owner and exact reproducible identity. Cost-only evidence cannot alter a
    semantic result, and RD-08 adds no unrelated failure-harness subsystem.
12. [ ] `spec/` has no changes. Every authority conflict stays visible as `blocked-errata`, and no
    generated expectation resolves contradictory frozen semantics by inference.

## Deferral-Expiry Gate

At closeout, answer whether the completed rule families or optimizer handoff expired any rationale
in the compiler-readiness ambiguity register, every RD Won't-Have section,
`spec/future-considerations.md`, or the expressiveness ledger. Reopen every expired item under an
explicit owner before RD-08 closes. In particular, closure may not leave arrays, nested calls,
branches, loops or loop-unrolling relations pointing to RD-08 as future work.
