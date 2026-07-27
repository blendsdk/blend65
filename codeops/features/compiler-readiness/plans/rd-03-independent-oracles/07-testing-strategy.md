# Testing Strategy: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Every phase begins with implementation-blind specification tests derived only from RD-03, this
plan's public contracts and the ambiguity register. Specification tests are observed RED before
production implementation and are never weakened or reopened afterward. Implementation tests cover
internal algorithms and failure paths.

The readiness package retains at least 90% branch coverage, touched files pass targeted Prettier,
authority JSON is parsed and semantically validated, the exact repository verify passes, and
`spec/` remains unchanged.

## 🚨 Specification Test Cases

The cases below are immutable after their implementation-blind authoring.

### Oracle protocol and authority

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-01 | Parse a minimal request/result shape for each façade and query its route | Closed passive protocol; only the exact declared route is eligible to model | RD-03 Must Have; 03-01 |
| ST-02 | Unknown fields/IDs, accessors, cycles, exotic prototypes or oversize request | `oracle.input.invalid` before getter execution/evaluation | RD-03 AC-7; AR-P9/P29 |
| ST-03 | Canonical compiler-invalid source diagnostic manifest | Exactly nineteen lexical source-projection records parse and join | RD-03 AC-4; AR-P31 |
| ST-04 | Canonical invalid external parameter-binding projection | Separate binding-rejection authority joins; no compiler diagnostic is claimed | AR-P31; PF-006 |
| ST-05 | Remove, duplicate, reorder, misclassify or add either authority record | Suite rejects with exact code/path and no partial authority | RD-03 AC-4; AR-P4/P31 |
| ST-06 | Inspect Phase 1 public exports and raw source-authoring result | No public context constructor/authority injection exists; raw result contains no publication evidence | RD-03 AC-13; AR-P25/P28 |
| ST-07 | Malformed request, inconsistent suite/model, unsupported semantics and absent route | Exact required invalid/authority/unmodeled category; never implementation-selectable | RD-03 AC-2/7; AR-P29 |

### Reference evaluator and independence

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-08 | Literal/reference/unary/binary vectors at zero/min/max | Exact typed values for all five scalar types | RD-03 AC-3; 03-02 |
| ST-09 | Same-signed 8/16-bit arithmetic, bitwise and comparison in both operand orders | Widen before dispatch with exact zero/sign extension and result type; narrowing rejects | AR-P6; PF-007 |
| ST-10 | Overflow and signed/unsigned shift/comparison vectors | Width-local wrap and signed semantics match frozen rules | RD-03 AC-3; AR-P6 |
| ST-11 | Constants, parameters, locals, assignments and return | Dependency/frame/statement order produces exact result | RD-03 Must Have; AR-P5 |
| ST-12 | Structurally valid constant initialized by memory read/runtime name | Oracle semantic closure rejects before suite/evaluation | AR-P32; PF-008 |
| ST-13 | Two ordered memory reads/writes affect later expression | Public effect/value witness proves left-to-right volatile order | RD-03 AC-3; 03-02 |
| ST-14 | Explicit byte/word fixture with overlap | Little-endian reads/writes and complete final memory are exact | RD-03 AC-9; AR-P8 |
| ST-15 | Absent cell, byte out of range or word at `$ffff` | `oracle-unmodeled`; no invented value or partial effect | RD-03 AC-9; AR-P8 |
| ST-16 | Every consuming event at `bound-1`, `bound`, `bound+1` | First two fit; next charge returns `oracle-budget` | RD-03 AC-8; AR-P10 |
| ST-17 | Constant-shaped and runtime-shaped divisor zero | `blocked-errata` and `oracle-unmodeled`; `spec/` unchanged | RD-03 AC-10; AR-P2/P7 |
| ST-18 | Boundary scanner positive fixture plus forbidden package, relative escape and dynamic import | Immutable boundary oracle and `readiness:source-check` agree exactly | RD-03 AC-1; AR-P41 |

### Semantic relations

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-19 | Capture-free identifier rename over each declaration kind | All bound references change; exact observation remains equivalent | RD-03 AC-5; 03-03 |
| ST-20 | Rename would capture/reserve/collide or misses one reference | Relation is inapplicable or violation is detected | RD-03 AC-5; AR-P12 |
| ST-21 | Literal-to-local on valid executable literal | Revalidated transformed IR and exact state comparison pass | RD-03 AC-5; 03-03 |
| ST-22 | Local-to-parameter over pure immutable local | Exact external binding is added and observation remains equal | RD-03 AC-5; 03-03 |
| ST-23 | Local initializer reads memory or local is reassigned | Relation is inapplicable and removes no effect | RD-03 AC-5; AR-P12 |
| ST-24 | Every closed algebraic identity at widths/extrema | Original expression executes once and exact state remains equal | RD-03 AC-3/5; 03-03 |
| ST-25 | Swap independent constants and inject a hidden dependency | Independent case passes; dependency-precondition mutant fails | RD-03 AC-5; AR-P12 |
| ST-26 | Source-invalid or binding-invalid case under permitted rename/reorder | Exact diagnostic or binding-rejection projection compares; names/spans ignored | RD-03 AC-5; AR-P13/P31 |
| ST-27 | Rewrite result is structurally valid but violates oracle semantic closure | Transformation fails before evaluation/comparison | AR-P32; 03-03 |
| ST-28 | Relation-scoped false precondition, non-preserving rewrite or omitted observable | Each production-path fault fails the immutable relation specification | RD-03 AC-5; AR-P40 |

### Provenance, identity and mutation adequacy

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-29 | Complete replay provenance with content changed under same RD-02 case ID | Regeneration detects mismatch before evaluation | AR-P26; PF-002 |
| ST-30 | Canonical source and transformed content vectors | Role-separated domain digests match; no synthetic transformed RD-02 ID | AR-P27; PF-002 |
| ST-31 | Published canonical evaluation-identity vector | Exact domain-separated digest matches | RD-03 AC-11; 03-04 |
| ST-32 | Mutate provenance, content, entry, initial memory, authority, policy, projection or participant | Every mutation changes evaluation identity | RD-03 AC-11; AR-P14/P28 |
| ST-33 | Oracle policy/revision changes over identical source case | RD-02 identity stays equal; evaluation identity changes | RD-03 AC-11; AR-P14 |
| ST-34 | Equal digest injected for unequal canonical preimages | Collision rejects and neither evaluation is authoritative | AR-P14; 03-04 |
| ST-35 | Catalog compared to closed production operation/path registries | Exact join; missing/extra/duplicate/unreachable pair rejects | RD-03 AC-6; AR-P30 |
| ST-36 | Execute every catalog mutant through production dispatch | Every required operation/path mutant is killed; zero survivors | RD-03 AC-6; AR-P17 |
| ST-37 | Barrier-interleave baseline and two mutant contexts across awaits | AsyncLocalStorage keeps all three results isolated | AR-P36; PF-012 |
| ST-38 | Worker mutant times out, crashes, exceeds budget or sends invalid protocol | Report is harness failure, not a killed mutant | AR-P38; PF-014 |

### Bindings and compatible staging

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-39 | Existing legacy four-handler no-pointer preparation | Signature and immutable bootstrap behavior remain unchanged | AR-P33; PF-009 |
| ST-40 | Register five exact RD-03 dependency closures | Fresh compatible candidates have content-derived revisions | RD-03 AC-12; 03-05 |
| ST-41 | Undeclared, duplicate, stale, wrong-kind/contract/revision handler | Registration/publication rejects exact failure | RD-03 AC-12; AR-P16 |
| ST-42 | Resolve old four-row release after newest catalog contains nine handlers | Exact old IDs and four bindings resolve | AR-P15; 03-05 |
| ST-43 | Incrementally prepare from named selected RD-02 base and exact target set | Four rows carry byte-identically; exactly five promote; nine total | RD-03 AC-12; AR-P33 |
| ST-44 | Changed carried row, absent base, wrong target set or eighth member | Reject before authoritative staging; v1 format remains unchanged | AR-P15/P33; 03-05 |
| ST-45 | Resolve with missing/extra/stale/rejected semantic-review evidence | Reconstructed units fail `validateReviewEvidence`; no snapshot exists | AR-P34; PF-010 |

### Final publication and authoritative evidence

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-46 | Staged accepted snapshot and published evaluation | Nine bindings resolve once; evidence envelope binds one snapshot's revisions and reviewed authority | RD-03 AC-12/13; AR-P25/P28 |
| ST-47 | Forged context or manifest/revision/review/content/provenance mutation in staged context | Authority membership/resolution/evaluation fails closed; no stale evidence is emitted | RD-03 AC-4/11/13; AR-P25/P26/P34 |
| ST-48 | Failure at each pre/post pointer fault point | Old selection fails ordinarily; new selection reconciles committed success; unknown is `commit-indeterminate` | RD-03 AC-13; AR-P35 |
| ST-49 | Barrier-controlled worker reader forced across pointer replacement | One bounded full retry yields exact four-row or nine-row state; second change fails closed; never mixed | RD-03 AC-13; AR-P37 |

## Test Files

| File | ST cases | Authoring gate |
|---|---|---|
| `oracle-contracts.spec.test.ts` | ST-01–ST-07 | Before Phase 1 production |
| `oracle-evaluator.spec.test.ts` | ST-08–ST-17 | Before Phase 2 production |
| `oracle-boundary.spec.test.ts` | ST-18 | Before Phase 2 production |
| `semantic-relations.spec.test.ts` | ST-19–ST-28 | Before Phase 3 production |
| `oracle-evaluation-identity.spec.test.ts` | ST-29–ST-34 | Before Phase 4 production |
| `oracle-mutation.spec.test.ts` | ST-35–ST-38 | Before Phase 4 production |
| `oracle-bindings.spec.test.ts` | ST-39–ST-42 | Before Phase 5 production |
| `oracle-publication.spec.test.ts` | ST-43–ST-45 | Before Phase 5 production |
| `oracle-published-evidence.spec.test.ts` | ST-46–ST-47 | Before snapshot-wrapper/candidate revision implementation in Phase 5 |
| `oracle-final-publication.spec.test.ts` | ST-48–ST-49 | Before Phase 6 pointer integration |

No existing `*.spec.test.ts` file is modified. Once one of the new specification files is authored
and its RED recorded, later phases never reopen it. Implementation tests use new matching
`*.impl.test.ts` files split by parser/validation, scalar operations, memory, relations, identity,
mutation workers and publication compatibility.

## Integration and Process Tests

- Historical resolution uses a fixture copy of the existing selected four-binding release.
- Fault tests use isolated temporary repositories and established pointer fault points.
- Deterministic worker-thread barriers control concurrent readers; no child process is introduced.
- Diagnostic/review tests use injected exact review fixtures until final independent evidence exists.
- Mutation execution may be scheduled serially, but the immutable concurrency case proves
  AsyncLocalStorage isolation across overlapping contexts.
- Worker inputs are stable mutant/vector IDs and canonical fixtures; callers cannot supply code.
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
