# RD-03: Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: RD-03-independent-oracles.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Amended**: 2026-07-27 — first executable oracle slice bounded after preflight
> **Project**: Compiler Readiness
> **Depends On**: RD-01, RD-02
> **CodeOps Artifact Schema**: 1

## Feature Overview

Determine expected results without treating compiler output as truth. A deliberately bounded
reference interpreter covers concrete values and state; independent metamorphic relations test
semantic equivalence beyond that first subset. This RD establishes the oracle architecture and
binds all four declared oracle façades, but claims semantic coverage only for the explicit v1
population below.

## V1 Scope

The initial oracle-supported population is exactly the nine rules already modeled by RD-02:

- `rule.ch02.2-primitive-types.byte.range.0-255`
- `rule.ch02.2-primitive-types.sbyte.range.128-127`
- `rule.ch02.2-primitive-types.word.range.0-65535`
- `rule.ch02.2-primitive-types.sword.range.32768-32767`
- `rule.ch02.2-primitive-types.boolean.range.true`
- `rule.ch12.3-1-memory-access.peek-addr.signature.word`
- `rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte`
- `rule.ch12.3-1-memory-access.peekw-addr.signature.word`
- `rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word`

The evaluator accepts the current validated scalar/memory generator IR: scalar literals and
references; the existing unary and binary operators; constants, parameters, locals, assignments,
one selected function entry and return; and byte/word memory reads and writes. These composition
operations do not claim additional inventory-rule coverage.

Arrays, nested calls, branches, loops and loop-unrolling relations require generator/model
expansion and belong to RD-08. RD-08 must reuse and extend the versioned oracle contracts created
here; it must not create a parallel expected-result system. Unsupported constructs and rules return
`oracle-unmodeled`, never success.

## Functional Requirements

### Must Have

- [ ] Implement a pure reference evaluator over the independent generator IR. It must not import
  compiler lexer, parser, semantic, constant-folding, IL or codegen implementation. (AR-5)
- [ ] Define one closed v1 oracle request/result protocol used by the four declared oracle façades:
  `oracle.frontend-result`, `oracle.compiler-result`, `oracle.emitted-program` and
  `oracle.runtime-state`. Each façade routes only its declared contracts; unsupported rules and
  observables return `oracle-unmodeled`.
- [ ] Declare and bind `transform.semantic-relations` as one versioned handler with a closed
  relation-ID union. Bind all five RD-03 handlers to reviewed, content-derived implementation
  revisions; reject undeclared, duplicate and contract-incompatible bindings.
- [ ] Join the supported population exactly to the nine RD-02 modeled rules. A missing oracle
  contract, an oracle contract for an unmodeled rule, or a rule/handler route mismatch is an error.
- [ ] Model exact v3.0 evaluation order, integer width/sign, overflow, sequential statement
  execution, one entry frame, return and bounded memory effects for the v1 IR.
- [ ] Define diagnostic expectations in a closed, independently reviewed v1 manifest keyed by
  modeled rule and invalid-neighbor identity. Each record owns the stable diagnostic code, phase
  and observable projection; executable code must not infer these facts from requirement prose or
  current compiler output.
- [ ] Define semantics-preserving transformations including identifier renaming, literal-to-local,
  local-to-parameter where equivalent, algebraic identities and independent-declaration
  reordering. Every relation contract declares a machine-checkable precondition, normalization,
  observable projection and comparator.
- [ ] Record a separate oracle-evaluation identity that preserves RD-02 source-case identity while
  binding source/transformed case IDs, relation ID, diagnostic-manifest digest, oracle budget and
  policy revision, observable projection, and every participating handler contract and
  implementation revision.
- [ ] Mutation-test every implemented evaluator operation, diagnostic mapping, transform
  precondition, transform rewrite and relation comparator through a closed versioned catalog.
  Every required production-path mutant must be killed.
- [ ] Publish the five handlers atomically through the RD-02 publication authority. Candidate-only
  validation is insufficient: selected handlers must resolve through the opaque published
  snapshot, and a failed promotion must leave the previously selected authority unchanged.

### Won't Have

- A second full Blend65 compiler.
- Use of emitted assembly, current goldens or current diagnostics as expected-value generators.
- Metamorphic transformations whose preconditions are not machine-checkable.
- Arrays, nested calls, branches, loops or loop-unrolling in the v1 oracle population; RD-08 owns
  that generator/model expansion and the corresponding extension of these oracle contracts.
- An invented resolution for contradictory frozen-spec rules.

## Technical Requirements

Reference state is finite: typed scalar values, module/parameter/local bindings, one entry frame
and a bounded abstract memory map sufficient for v1 generated observables. Each operation cites
its specification rule ID.

Every public oracle or transform entry accepts `unknown`, validates through the independent IR
validator and operates only on its immutable validated snapshot. A closed oracle budget limits
input nodes and depth, evaluation steps, frames, memory cells and transformed-output growth.
Transformed IR is revalidated before execution. The contract enumerates step-consuming events;
exactly-at-bound succeeds, while the next event produces `oracle-budget` and contributes no
readiness success.

Memory evaluation starts from an explicit versioned fixture. Every read cell must be initialized;
effects are recorded in evaluation order; byte/word writes use frozen-spec little-endian ordering;
overlap observes prior ordered writes. Any address whose complete access falls outside `$0000` to
`$ffff`, including a word access at `$ffff`, returns `oracle-unmodeled` until semantic authority
defines the behavior.

The frozen specification currently conflicts on runtime division by zero (maximum value versus
zero) and constant division-by-zero diagnostics (E10160 versus E10082). The affected inventory
rules must be recorded as `blocked-errata` and remain `oracle-unmodeled`; RD-03 does not choose
between contradictory authorities and does not modify `spec/`.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Absolute oracle | Bounded pure interpreter | AR-5 |
| Supplemental oracle | Metamorphic relations | AR-5 |
| Semantic authority | Frozen specification | AR-1 |
| V1 population | Nine RD-02 modeled scalar/memory rules | User-authorized preflight PF-001 |
| Broader IR | RD-08-owned extension of RD-03 contracts | User-authorized preflight PF-001 |
| Contradictory semantics | `blocked-errata`, never guessed | User-authorized preflight PF-012 |

## Security Considerations

The evaluator executes only a validated immutable IR snapshot, never JavaScript/source text.
Hostile objects, accessors, cycles, exotic prototypes and oversized inputs are rejected before
evaluation. Arithmetic, state and transform growth are bounded. No dynamic module loading,
`eval`, shell calls, network, credentials, PII, authentication or encryption surface exists.

## Acceptance Criteria

1. [ ] A package-wide dependency-boundary test rejects every `@blend65/*` import and every relative
   import that escapes `packages/readiness` from production oracle/transform code.
2. [ ] The supported-rule registry equals the nine-rule v1 population exactly, and every other
   rule or unsupported construct returns `oracle-unmodeled`, never pass or silent skip.
3. [ ] Reference tests cover zero, minimum, maximum, overflow, signedness and evaluation order for
   every implemented scalar operation and byte/word memory effect. Evaluation order is proven by
   an ordered volatile-effect witness, not an internal traversal assertion.
4. [ ] The diagnostic manifest is independently reviewed, digest-bound, exhaustive for the
   supported invalid-neighbor contracts and rejected for unknown, duplicate, missing or stale
   records.
5. [ ] Each semantic relation proves its precondition, records source/transformed case IDs and
   evaluation identity, and compares its relation-specific diagnostic or state projection.
   Injected precondition, non-preserving rewrite and omitted-observable faults each fail a
   specification test.
6. [ ] The required mutation catalog has zero survivors across evaluator operations, diagnostic
   mappings, transform preconditions/rewrites and comparators.
7. [ ] Hostile objects, accessors, cycles, exotic prototypes and over-limit inputs/transforms are
   rejected without execution; revalidation rejects an invalid transformed result.
8. [ ] Oracle budget tests prove `bound-1`, `bound` and `bound+1` behavior for every consuming
   event class; `oracle-budget` cannot count toward readiness.
9. [ ] Memory tests cover explicit initial state, absent cells, overlapping byte/word writes,
   ordered effects and out-of-range word access without inventing unspecified values.
10. [ ] Division-by-zero conflicts remain visible as `blocked-errata` and `oracle-unmodeled`;
    neither result nor diagnostic is guessed and `spec/` remains unchanged.
11. [ ] Evaluation identity changes when any diagnostic manifest, budget/policy, comparator,
    oracle or transform revision changes, while the RD-02 source case ID remains unchanged.
12. [ ] Binding validation rejects undeclared, duplicate and incompatible handlers, and an atomic
    publication makes all five RD-03 handlers resolvable exactly once through the selected opaque
    snapshot with content-derived revisions.
13. [ ] A failed or crash-injected promotion preserves the previously selected publication and
    never exposes a mixed oracle/manifest/transform set.
