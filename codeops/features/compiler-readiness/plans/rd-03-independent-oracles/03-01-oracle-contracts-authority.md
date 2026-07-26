# Component Specification: Oracle Contracts and Diagnostic Authority

> **Document**: 03-01-oracle-contracts-authority.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P1–AR-P5, AR-P9, AR-P16, AR-P18

## Responsibility

Define one bounded public protocol for all four oracle façades, validate the exact nine-rule route
join, and establish independently reviewable diagnostic authority for every modeled invalid
neighbor. This component does not execute compiler code and does not make source-authoring data
authoritative.

## Files

| File | Purpose |
|---|---|
| `packages/readiness/src/oracle-model.ts` | Passive public request/result/value/effect types |
| `packages/readiness/src/oracle-input.ts` | Hostile-input snapshot and closed request validation |
| `packages/readiness/src/oracle-diagnostic-input.ts` | Bounded closed manifest parser |
| `packages/readiness/src/oracle-suite.ts` | Opaque joined modeled/diagnostic authority capability |
| `packages/readiness/src/oracle-routing.ts` | Exact rule/handler/observable route table |
| `packages/readiness/src/oracle-handlers.ts` | Four stateless façade callables |
| `packages/readiness/src/generated/declarations.ts` | Generated `transform.semantic-relations` ID |
| `readiness/oracles/diagnostic-oracle-v1.json` | Canonical nineteen-row diagnostic manifest |
| `readiness/inventory/compiler-readiness-v1.json` | New unbound transform declaration during staging |

Keep production files under 500 lines where practical. Split parsing, routing and capability
construction instead of growing one oracle service.

## Closed Authority Shape

```ts
interface DiagnosticOracleManifestV1 {
  readonly schemaVersion: 1;
  readonly manifestVersion: "1.0.0";
  readonly specRevision: Sha256Digest;
  readonly policyRevision: "diagnostic-oracle-policy-v1";
  readonly records: readonly DiagnosticOracleRecordV1[];
}

interface DiagnosticOracleRecordV1 {
  readonly ruleId: RuleId;
  readonly neighborId: NeighborId;
  readonly diagnosticCode: string;
  readonly phase: "lexer" | "parser" | "semantic";
  readonly severity: "error";
  readonly observableFields: readonly ["code", "phase", "severity"];
}
```

Records are lexically ordered by `(ruleId, neighborId)`. The parser rejects unknown or duplicate
keys, unsupported versions, non-canonical order, unknown phases, blank/unbounded identifiers and
more than the fixed authority limit. The semantic join requires exactly nineteen records:

- one boolean wrong-type neighbor;
- two range neighbors for each of `byte`, `sbyte`, `word` and `sword`;
- two signature neighbors for `peek` and `peekw`;
- three signature neighbors for `poke` and `pokew`.

Each key must exist in the reviewed RD-02 modeled registry. Missing/extra keys, family mismatch,
unknown rules/neighbors or a non-modeled owner reject the suite. Exact diagnostic facts are
derived from the frozen specification and independently accepted as a dedicated
`diagnostic-oracle-v1` semantic-review unit; current compiler output is never consulted.

## Oracle Suite

```ts
interface OracleSuiteInput {
  readonly modeledSuite: ModeledGeneratorSuite;
  readonly inventory: unknown;
  readonly diagnosticManifestBytes: Uint8Array;
}

type OracleSuiteResult =
  | {
      readonly ok: true;
      readonly suite: OracleSuite;
      readonly diagnosticManifestDigest: Sha256Digest;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };
```

`OracleSuite` is opaque and module-branded. Construction snapshots all input, validates the
manifest, verifies the exact route/model join, freezes retained data and exposes no raw mutable
tables. It is a source-authoring/test capability; readiness authority still requires an opaque
`PublishedSnapshot` containing the exact handler revisions and accepted semantic review.

## Request Protocol

Every public handler accepts `(suite: OracleSuite, request: unknown)`. Validated v1 requests have:

```ts
interface OracleRequestV1 {
  readonly schemaVersion: 1;
  readonly handlerId:
    | "oracle.frontend-result"
    | "oracle.compiler-result"
    | "oracle.emitted-program"
    | "oracle.runtime-state";
  readonly ruleId: RuleId;
  readonly sourceCaseId: Sha256Digest;
  readonly case: GeneratedModeledCase;
  readonly entryFunction: string;
  readonly memory: MemoryFixtureV1;
  readonly budget: OracleBudgetV1;
  readonly observable:
    | { readonly kind: "diagnostic" }
    | { readonly kind: "value-state" };
}
```

The validator:

1. rejects accessors, cycles, exotic prototypes and unknown fields before reading nested values;
2. validates the contained valid baseline with `validateGeneratorIr`;
3. validates invalid transforms using the existing RD-02 projection rules;
4. verifies the supplied `sourceCaseId` against the unchanged RD-02 case identity;
5. joins the rule to the exact modeled registry route;
6. requires one lexically exact entry-function name and parameter binding per entry parameter;
7. validates memory and budget limits before any evaluation.

## Result Protocol

```ts
type OracleResultV1 =
  | {
      readonly ok: true;
      readonly outcome: "modeled";
      readonly observation: OracleObservationV1;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "oracle-unmodeled";
      readonly reason: OracleUnmodeledReason;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "relation-inapplicable";
      readonly relationId: SemanticRelationId;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };
```

`OracleObservationV1` is either the exact manifest-owned diagnostic projection or the evaluator's
typed return/final-memory/ordered-effect projection. Oracle-engine failures and expected compiler
diagnostics are distinct types.

Stable engine diagnostic families are:

- `oracle.input.invalid`, `oracle.input.limit`;
- `oracle.authority.missing`, `oracle.authority.stale`, `oracle.authority.not-accepted`;
- `oracle.route.invalid`, `oracle.contract.invalid`;
- `oracle.budget`;
- `oracle.identity.collision`;
- `oracle.relation.invalid`, `oracle.relation.violated`.

Every failure carries an RFC 6901 path and a bounded non-sensitive message.

## Exact Route Policy

The supported registry equals the RD-02 modeled rule set. A rule's request handler must equal its
declared `oracleIds` route:

- scalar-domain rules route to `oracle.frontend-result`;
- memory-signature runtime observations route to `oracle.runtime-state`;
- the compiler-result and emitted-program façades are implemented and published but return
  `oracle-unmodeled` for this initial population because no modeled rule declares those routes.

No façade falls back to another handler. Unknown/unmodeled rules and unsupported observables
return `oracle-unmodeled`, never success or silent skip.

## Review Contract

Publication preparation creates a `diagnostic-oracle-v1` review unit whose semantic digest covers
canonical manifest bytes and whose dependency map covers:

- frozen specification revision;
- RD-02 rule-model digest;
- exact modeled-neighbor projection digest;
- diagnostic manifest digest;
- parser/policy revision.

Accepted review evidence stays in the existing `semantic-review-v1.json` release member. It is
not included in handler implementation closures, avoiding revision/review circularity.
