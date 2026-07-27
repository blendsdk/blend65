# Current State: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Foundations

RD-02 completed the compiler-independent `@blend65/readiness` generation foundation:

- a closed typed generator IR and hostile-input validator;
- exact nine-rule model authority plus independent digest-bound review;
- deterministic cases, external parameter bindings and stable source-case identity;
- content-derived implementation revisions and non-forgeable fresh registrations;
- an opaque selected-publication capability with crash-consistent pointer promotion;
- a selected seven-member v1 release containing four executable RD-02 bindings.

The current IR can express typed constants, one or more functions, parameters, locals,
assignments, returns, all current unary/binary operators, and byte/word memory reads and writes.
It cannot express arrays, nested calls, control flow or loops.

## Relevant Existing Files

| File | Current purpose | RD-03 change |
|---|---|---|
| `generator-ir.ts` | Independent closed IR and structural budget types | Reuse unchanged unless a passive oracle type belongs separately |
| `generator-ir-validator.ts` | Bounded immutable structural IR validation | Reuse unchanged; add a distinct oracle semantic-closure validator |
| `modeled-generator-model.ts` | Generated case, invalid projection and parameter binding contracts | Consume without changing case identity |
| `modeled-generator-suite.ts` | Reviewed rule-model capability | Compose into a distinct oracle suite |
| `case-identity.ts` | RD-02 configuration/campaign/path/ordinal identities | Do not modify identity semantics; verify complete replay provenance |
| `identity-collision-registry.ts` | Bounded digest/preimage collision proof | Reuse mechanics for separate oracle identity |
| `implementation-revision.ts` | Content-derived complete dependency revisions | Reuse for five RD-03 candidate closures |
| `binding-model.ts`, `binding-validator.ts` | Candidate and published binding integrity | Reuse; add typed RD-03 registration composition |
| `publication-candidates.ts` | Fixed four-handler v1 candidate catalog | Evolve to handler-ID-directed historical/current catalogs |
| `binding-publication.ts` | Legacy four-handler preparation and atomic publication | Preserve wrapper; add explicit base-snapshot/target-set incremental preparation |
| `publication-resolver.ts` | Digest/member verification and opaque snapshots | Resolve named candidates, revalidate review evidence and create bound evaluation context |
| `publication-model.ts` | Exact seven-member v1 wire contract | Preserve member list and wire schema |
| `publication-conformance-v1.ts` | Crash/limit and module-boundary seams | Extend owner/source gates without changing wire format |
| `generated/declarations.ts` | Eight current handler IDs | Generate ninth transform ID |
| `readiness/inventory/compiler-readiness-v1.json` | Four bound RD-02 and four unbound RD-03 declarations | Add transform declaration; bind five RD-03 handlers at publication |
| `readiness/reviews/semantic-review-v1.json` | Accepted selected-release semantic review | Replace only after independent review of exact staged digest |

## Confirmed Gaps

| Gap | Consequence | Planned owner |
|---|---|---|
| No oracle protocol or reviewed oracle capability | Expected results cannot be requested safely | 03-01 |
| No exact diagnostic authority | Current compiler behavior could become circular truth | 03-01 |
| Diagnostic projection conflates compiler-invalid source and external binding values | One authority would misclassify non-compiler failures | 03-01 |
| No evaluator | Valid generated cases have no absolute expected state/value | 03-02 |
| Structural IR validation admits non-constant constant initializers | Oracle could model language-illegal input as valid | RD-03 semantic closure; T-02 owns the RD-02 validator correction |
| No memory fixture/effect projection | Volatile order and overlap cannot be compared | 03-02 |
| No semantic transform handler | Metamorphic requirements cannot bind or publish | 03-03 |
| No relation-local comparator | Wrong transforms can self-confirm | 03-03 |
| RD-02 identity does not digest case content or transformed cases | Provenance/content substitution could survive weak evidence | 03-04 |
| No oracle-evaluation identity/evidence envelope | Evidence can survive stale oracle policy/revisions | 03-04/03-05 |
| No exhaustive mutation catalog | Broad semantic code can be weakly tested | 03-04 |
| Synchronous mutants cannot be preempted in-process | A hang could stall the verification gate | 03-04 |
| Publication assumes one fixed four-candidate profile | A nine-row release would break historical resolution | 03-05 |
| Release resolution does not recompute accepted review units | Stored evidence can be semantically stale | 03-05 |
| Post-pointer faults can report failure after commit | Caller cannot safely distinguish committed state | 03-05 |
| Diagnostic data is not a v1 release member | Atomicity needs dependency/review binding without format mutation | 03-05 |

## Dependencies

### Internal

- RD-01 inventory, declarations, semantic review and publication schemas.
- RD-02 rule-model suite, generator IR, generated cases, case identities and publication.
- Node `crypto` and existing bounded JSON/filesystem utilities.

### External

- Existing Yarn/Vitest/TypeScript dependencies only.
- Compiler packages remain forbidden production dependencies.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Evaluator repeats compiler assumptions | Medium | Critical | Frozen-spec citations, no compiler imports, mutation catalog |
| Host values leak JS-number semantics | Medium | Critical | `bigint`, typed normalization after every operation |
| Mixed-width operands normalize incorrectly | Medium | Critical | Same-signed widening in both orders; reject narrowing |
| Caller substitutes unreviewed diagnostic authority | Medium | Critical | Resolver-owned snapshot-bound evaluation context |
| Structurally valid illegal constants reach evaluation | Medium | Critical | Oracle semantic-closure validator |
| Relation removes a volatile effect | Medium | Critical | Purity/dependency preconditions and complete effect projection |
| Diagnostic manifest drifts from modeled neighbors | Medium | High | Exhaustive join and independent digest-bound review |
| Oracle update changes source-case identity | Low | High | Separate oracle-evaluation identity |
| Mutation branch omitted behind a broad operation ID | Medium | Critical | Exact closed operation/path registry join |
| Mutation context leaks across concurrent calls | Medium | Critical | AsyncLocalStorage plus barrier interleaving spec |
| New catalog breaks old selected release | Medium | Critical | Preserve legacy wrapper; handler-ID-directed reconstruction |
| Review bytes create revision circularity | Medium | Critical | Review bytes excluded from implementation closures |
| Release omits standalone manifest bytes | Low | Medium | Exact source-closure reconstruction fails closed; v2 owned by RD-07 if needed |
| Publication exposes mixed generations | Low | Critical | Four carried rows, five promotions, atomic commit and worker-reader interleaving |
| Resolution accepts stale semantic review | Medium | Critical | Rebuild units and call shared review validator |
| Post-commit fault is misreported | Low | Critical | Resolve-and-reconcile committed/old/indeterminate outcomes |
