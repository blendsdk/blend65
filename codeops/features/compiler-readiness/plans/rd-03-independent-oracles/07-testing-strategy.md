# Testing Strategy: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Every phase begins with implementation-blind specification tests derived only from RD-03, this
plan's public contracts and the ambiguity register. Specification tests are observed RED before
production implementation and are never weakened afterward. Implementation tests cover internal
algorithms and failure paths.

The readiness package retains at least 90% branch coverage, touched files pass targeted Prettier,
authority JSON is parsed and semantically validated, the exact repository verify passes, and
`spec/` remains unchanged.

## 🚨 Specification Test Cases

The cases below are immutable after their implementation-blind authoring.

### Oracle protocol and diagnostic authority

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-01 | Minimal valid request to each of four façade handlers | Closed result envelope; only exact declared route can model | RD-03 Must Have; 03-01 |
| ST-02 | Unknown fields/IDs, accessors, cycles, exotic prototypes or oversize request | Deterministic bounded failure before getter execution/evaluation | RD-03 AC-7; AR-P9 |
| ST-03 | Canonical diagnostic manifest with all modeled invalid neighbors | Exactly nineteen unique lexical records parse and join | RD-03 AC-4; 03-01 |
| ST-04 | Remove, duplicate, reorder or add unknown manifest record/field | Suite rejects with exact code/path and no partial authority | RD-03 AC-4; AR-P4 |
| ST-05 | Manifest/review/spec/model digest changes after acceptance | Review is stale and published authority cannot be prepared | RD-03 AC-4/13; AR-P15 |
| ST-06 | Query exact nine supported rules and every other rule/route | Registry equals nine; other rules/routes return `oracle-unmodeled` | RD-03 AC-2; AR-P1/AR-P3 |

### Reference evaluator

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-07 | Literal/reference/unary/binary vectors at zero/min/max | Exact typed values for all five scalar types | RD-03 AC-3; 03-02 |
| ST-08 | Overflow and signed/unsigned shift/comparison vectors | Width-local wrap and signed semantics match frozen rules | RD-03 AC-3; AR-P6 |
| ST-09 | Constants, parameters, locals, assignments and return | Dependency/frame/statement order produces exact result | RD-03 Must Have; AR-P5 |
| ST-10 | Two ordered memory reads/writes affect later expression | Public effect/value witness proves left-to-right volatile order | RD-03 AC-3; 03-02 |
| ST-11 | Explicit byte/word fixture with overlap | Little-endian reads/writes and complete final memory are exact | RD-03 AC-9; AR-P8 |
| ST-12 | Absent cell, byte out of range or word at `$ffff` | `oracle-unmodeled`; no invented value or partial effect | RD-03 AC-9; AR-P8 |
| ST-13 | Every consuming event at `bound-1`, `bound`, `bound+1` | First two fit as applicable; next charge returns `oracle-budget` | RD-03 AC-8; AR-P10 |
| ST-14 | Unsupported construct/rule, unresolved entry/name or invalid frame binding | Closed invalid/unmodeled outcome; never modeled success | RD-03 AC-2/7; 03-02 |
| ST-15 | Constant-shaped and runtime-shaped divisor zero | Visible `blocked-errata` and `oracle-unmodeled`; `spec/` unchanged | RD-03 AC-10; AR-P2/AR-P7 |

### Semantic relations

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-16 | Capture-free identifier rename over each declaration kind | All bound references change; exact observation remains equivalent | RD-03 AC-5; 03-03 |
| ST-17 | Rename would capture/reserve/collide or misses one reference | Relation is inapplicable or violation is detected | RD-03 AC-5; AR-P12 |
| ST-18 | Literal-to-local on valid executable literal | Revalidated transformed IR and exact state comparison pass | RD-03 AC-5; 03-03 |
| ST-19 | Local-to-parameter over pure immutable local | Exact parameter binding is added and observation remains equal | RD-03 AC-5; 03-03 |
| ST-20 | Local initializer reads memory or local is reassigned | Relation is inapplicable and removes no effect | RD-03 AC-5; AR-P12 |
| ST-21 | Every closed algebraic identity at widths/extrema | Original expression executes once and exact state remains equal | RD-03 AC-3/5; 03-03 |
| ST-22 | Swap independent constants and inject a hidden dependency | Independent case passes; dependency-precondition mutant fails | RD-03 AC-5; AR-P12 |
| ST-23 | Invalid case under permitted rename/reorder | Exact diagnostic code/phase/severity compares; names/spans ignored | RD-03 AC-5; AR-P13 |
| ST-24 | Inject false precondition, non-preserving rewrite or omitted observable | Each fault fails immutable relation specification | RD-03 AC-5; PF-004 |

### Evaluation identity and mutation adequacy

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-25 | Published canonical evaluation-identity vector | Exact domain-separated digest matches | RD-03 AC-11; 03-04 |
| ST-26 | Mutate each identity field and participant revision separately | Every mutation changes evaluation identity | RD-03 AC-11; AR-P14 |
| ST-27 | Oracle policy/revision changes over identical source case | Source case ID stays equal; evaluation identity changes | RD-03 AC-11; AR-P14 |
| ST-28 | Equal digest injected for unequal canonical preimages | Collision is rejected and neither evaluation is authoritative | 03-04; AR-P14 |
| ST-29 | Catalog compared to production operation/manifest/relation sets | Exact exhaustive one-or-more mapping; missing/extra/duplicate rejects | RD-03 AC-6; AR-P17 |
| ST-30 | Execute every catalog mutant through production dispatch | Every required mutant is killed; zero survivors | RD-03 AC-6; 03-04 |
| ST-31 | Mutant times out, exceeds budget or breaks harness | Report is failure, not a killed mutant | AR-P17; 03-04 |

### Bindings and compatible publication

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-32 | Register five exact RD-03 dependency closures | Fresh compatible candidates have content-derived revisions | RD-03 AC-12; 03-05 |
| ST-33 | Undeclared, duplicate, stale, wrong-kind/contract/revision handler | Registration/publication rejects exact failure | RD-03 AC-12; AR-P16 |
| ST-34 | Resolve old four-row release after newest catalog contains nine handlers | Resolver requests exact old IDs and returns exact four bindings | AR-P15; 03-05 |
| ST-35 | Prepare new release from selected RD-02 base | Four rows carried byte-identically; exactly five promoted; nine total | RD-03 AC-12; 03-05 |
| ST-36 | Carried row/source closure changes or base pointer is absent | Preparation rejects before staging authoritative release | AR-P15; 03-05 |
| ST-37 | Exact staged semantic-review request | Diagnostic/evaluator/relation/identity/mutation/binding units are complete | RD-03 AC-4/12; 03-05 |
| ST-38 | Add eighth member or mutate member order/schema/domain | Publication-v1 parser/resolver rejects; RD-07 gate is not bypassed | AR-P15; 03-05 |
| ST-39 | Crash/failure at every promotion fault point | Old four-row or new complete nine-row release resolves; never mixed | RD-03 AC-13; 03-05 |
| ST-40 | Final selected snapshot | All nine bindings resolve exactly once; manifest/revision mutation fails closed | RD-03 AC-12/13; 03-05 |

## Test Files

| File | ST cases |
|---|---|
| `oracle-contracts.spec.test.ts` | ST-01–ST-06 |
| `oracle-evaluator.spec.test.ts` | ST-07–ST-15 |
| `semantic-relations.spec.test.ts` | ST-16–ST-24 |
| `oracle-evaluation-identity.spec.test.ts` | ST-25–ST-28 |
| `oracle-mutation.spec.test.ts` | ST-29–ST-31 |
| `oracle-bindings.spec.test.ts` | ST-32–ST-34 |
| `oracle-publication.spec.test.ts` | ST-35–ST-40 |

No existing `*.spec.test.ts` file is modified. Implementation tests use new matching
`*.impl.test.ts` files split by parser/validation, scalar operations, memory, relations, identity,
mutation execution and publication compatibility.

## Integration and Process Tests

- Historical resolution uses a fixture copy of the existing selected four-binding release.
- Crash tests use isolated temporary repositories and existing publication fault points.
- Diagnostic review tests use injected exact review fixtures until the final independently authored
  repository evidence exists.
- Mutation tests run serially where operation-scoped conformance contexts could overlap.
- No compiler package is imported or invoked by RD-03 tests.
- No emulator is needed; RD-04 owns execution-tier comparison.

## Verification

Focused checks:

```text
yarn workspace @blend65/readiness test
yarn workspace @blend65/readiness test:coverage
npx prettier --check <touched-files>
yarn readiness:source-check
yarn readiness:check
```

Also run the repository's frozen-`spec/` cleanliness check.

Full gate:

```text
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```
