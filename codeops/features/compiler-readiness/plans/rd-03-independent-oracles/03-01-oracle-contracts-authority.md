# Component Specification: Oracle Contracts and Diagnostic Authority

> **Document**: 03-01-oracle-contracts-authority.md
> **Parent**: [Index](00-index.md)
> **Implements**: AR-P1–AR-P5, AR-P9, AR-P16, AR-P18, AR-P25–AR-P32

## Responsibility

Define one bounded public protocol for all four oracle façades, validate the exact nine-rule route
join, and establish independently reviewable authority for compiler-invalid source projections and
external binding-value rejections. This component does not execute compiler code. Source-authoring
suites remain non-authoritative; selected invocation receives authority only from a resolver-owned
snapshot context.

## Files

| File | Purpose |
|---|---|
| `packages/readiness/src/oracle-model.ts` | Passive public request/result/value/effect types |
| `packages/readiness/src/oracle-input.ts` | Hostile-input snapshot and closed request validation |
| `packages/readiness/src/oracle-diagnostic-input.ts` | Bounded closed manifest parser |
| `packages/readiness/src/oracle-binding-rejection.ts` | Closed external binding-value rejection authority |
| `packages/readiness/src/oracle-provenance.ts` | Full RD-02 replay provenance validation/regeneration |
| `packages/readiness/src/oracle-suite.ts` | Opaque joined modeled/diagnostic authority capability |
| `packages/readiness/src/oracle-routing.ts` | Exact rule/handler/observable route table |
| `packages/readiness/src/oracle-handlers.ts` | Four stateless façade callables |
| `packages/readiness/src/generated/declarations.ts` | Generated `transform.semantic-relations` ID |
| `readiness/oracles/diagnostic-oracle-v1.json` | Canonical nineteen-row diagnostic manifest |
| `readiness/oracles/binding-rejections-v1.json` | Canonical external binding-value rejection contract |
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

interface BindingRejectionManifestV1 {
  readonly schemaVersion: 1;
  readonly manifestVersion: "1.0.0";
  readonly policyRevision: "binding-rejection-policy-v1";
  readonly records: readonly BindingRejectionRecordV1[];
}

interface BindingRejectionRecordV1 {
  readonly ruleId: RuleId;
  readonly neighborId: NeighborId;
  readonly spelling: "parameter";
  readonly rejectionCode:
    | "binding.value.type-invalid"
    | "binding.value.range-invalid";
}
```

Records are lexically ordered by `(ruleId, neighborId)`. They apply only when the RD-02 invalid
projection kind is `invalid-source-transform`. The parser rejects unknown or duplicate
keys, unsupported versions, non-canonical order, unknown phases, blank/unbounded identifiers and
more than the fixed authority limit. The semantic join requires exactly nineteen records:

- one boolean wrong-type neighbor;
- two range neighbors for each of `byte`, `sbyte`, `word` and `sword`;
- two signature neighbors for `peek` and `peekw`;
- three signature neighbors for `poke` and `pokew`.

Each key must exist in the reviewed RD-02 modeled registry and must have at least one
compiler-invalid source projection. Missing/extra keys, family mismatch, unknown rules/neighbors or
a non-modeled owner reject the suite. Exact diagnostic facts are derived from the frozen
specification and independently accepted as a dedicated `diagnostic-oracle-v1` semantic-review
unit; current compiler output is never consulted.

An `invalid-parameter-binding` projection never queries this manifest because its source remains
compiler-valid. `binding-rejections-v1.json` instead defines one closed lexical record for each
reviewed external parameter binding type/range rejection. The key is
`(ruleId, neighborId, spelling)`; records are unique and lexical, and the rejection code must match
the RD-02 invalid-contract family. Its parser and exact join are independent, and its digest
receives a separate semantic-review dependency. Conflating the two projection kinds, or leaving
either one unmatched, rejects suite construction.

## Oracle Suite

```ts
interface OracleSuiteInput {
  readonly modeledSuite: ModeledGeneratorSuite;
  readonly replayRegistry: RevisionRegistry;
  readonly inventory: unknown;
  readonly diagnosticManifestBytes: Uint8Array;
  readonly bindingRejectionBytes: Uint8Array;
}

type OracleSuiteResult =
  | {
      readonly ok: true;
      readonly suite: OracleSuite;
      readonly authorityDigests: {
        readonly diagnosticManifest: Sha256Digest;
        readonly bindingRejections: Sha256Digest;
      };
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };
```

`OracleSuite` is opaque and module-branded. Construction snapshots all input, validates both
authorities, verifies the exact route/model join and requires a freshness-verified RD-02 replay
registry containing inventory, rule-model, generator, boundary-transform, renderer and
configuration dependencies. It freezes retained data and exposes no raw mutable tables. It is a
source-authoring/test capability; readiness authority still requires an opaque `PublishedSnapshot`
containing the exact handler revisions and accepted semantic review.

## Invocation Authority

The public source-authoring functions may accept an `OracleSuite` for fixture authoring and
specification tests, but their results are explicitly non-authoritative. Selected evaluation is
exposed only as:

```ts
declare const publishedOracleContextBrand: unique symbol;

interface PublishedOracleContext {
  readonly [publishedOracleContextBrand]: true;
  readonly selectedReleaseDigest: Sha256Digest;
}

function evaluatePublishedOracle(
  context: PublishedOracleContext,
  request: unknown,
): PublishedOracleEvaluationResultV1;
```

`PublishedOracleContext` is opaque, resolver-created and module-branded. It privately supplies the
exact suite reconstructed from accepted dependency bytes plus the handler contract/implementation
revisions from the same selected snapshot. The reconstructed suite includes the exact complete
freshness-verified RD-02 replay registry, including renderer authority, committed through the
RD-03 dependency closures/review units. No authoritative entry accepts a caller-provided suite,
registry, manifest digest or participant list. Context construction fails unless review evidence
has been reconstructed and revalidated. Runtime capability membership is also checked against a
private `WeakSet`; a forged JavaScript object returns a bounded
`oracle.authority.not-accepted` failure and never reaches request evaluation.

## Request Protocol

Every raw oracle façade accepts `(suite: OracleSuite, request: unknown)` and validates
`OracleRequestV1`. The raw transform accepts the same suite plus its own
`SemanticRelationRequestV1`. The published entry accepts
`(context: PublishedOracleContext, request: unknown)` and validates the closed union
`OracleRequestV1 | SemanticRelationRequestV1`, dispatching only by exact `handlerId`:

```ts
interface OracleRequestV1 {
  readonly schemaVersion: 1;
  readonly handlerId:
    | "oracle.frontend-result"
    | "oracle.compiler-result"
    | "oracle.emitted-program"
    | "oracle.runtime-state";
  readonly ruleId: RuleId;
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
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
2. validates the contained baseline with `validateGeneratorIr`;
3. runs the oracle semantic-closure validator, including compile-time-constant purity;
4. validates invalid transforms using the existing RD-02 projection rules;
5. verifies complete campaign/configuration/path/ordinal replay provenance, regenerates the case and
   requires byte-equivalent canonical case content and external bindings;
6. derives a domain-separated canonical source-content digest without changing RD-02 identity;
7. joins the rule to the exact modeled registry route and correct invalid-projection authority;
8. requires one lexically exact entry-function name and parameter binding per entry parameter;
9. validates memory and budget limits before any evaluation.

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
typed return/final-memory/ordered-effect projection, plus the distinct external-binding projection:

```ts
interface BindingRejectionObservationV1 {
  readonly kind: "binding-rejection";
  readonly ruleId: RuleId;
  readonly neighborId: NeighborId;
  readonly spelling: "parameter";
  readonly rejectionCode:
    | "binding.value.type-invalid"
    | "binding.value.range-invalid";
}
```

Oracle-engine failures, expected compiler diagnostics and modeled external-binding rejections are
three distinct types.

`PublishedOracleEvidenceV1` closes authoritative evidence around the raw result:

```ts
interface PublishedOracleEvidenceV1 {
  readonly ok: true;
  readonly result: OracleResultV1;
  readonly evaluationIdentity: Sha256Digest;
  readonly sourceProvenance: Rd02ReplayProvenanceV1;
  readonly contentIdentities: {
    readonly source: Sha256Digest;
    readonly transformed?: Sha256Digest;
  };
}

type PublishedOracleEvaluationResultV1 =
  | PublishedOracleEvidenceV1
  | { readonly ok: false; readonly diagnostics: readonly OracleDiagnostic[] };
```

The evidence variant exists only after request validation, replay regeneration and content
identity derivation succeed. Malformed input returns the failure variant and cannot fabricate
provenance, content or evaluation identity fields.

Stable engine diagnostic families are:

- `oracle.input.invalid`, `oracle.input.limit`;
- `oracle.authority.missing`, `oracle.authority.stale`, `oracle.authority.not-accepted`;
- `oracle.route.invalid`, `oracle.contract.invalid`;
- `oracle.budget`;
- `oracle.identity.collision`;
- `oracle.relation.invalid`, `oracle.relation.violated`.

Every failure carries an RFC 6901 path and a bounded non-sensitive message.

Classification is exhaustive:

| Condition | Required result |
|---|---|
| Malformed/hostile/non-canonical request or invalid binding frame | `oracle.input.invalid` |
| Reviewed suite/model/dependency inconsistency | `oracle.authority.*` failure |
| Structurally valid but unsupported semantic construct | `oracle-unmodeled` |
| Declared handler has no route for the rule/observable | `oracle-unmodeled` |
| Compiler-invalid source projection | Exact diagnostic-manifest observation |
| Invalid external binding projection | Exact binding-rejection outcome |

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

Publication preparation creates separate `diagnostic-oracle-v1` and
`binding-rejection-oracle-v1` review units. Their semantic digests cover their own canonical bytes,
and the union of their dependency maps covers:

- frozen specification revision;
- RD-02 rule-model digest;
- complete freshness-verified RD-02 replay registry component revisions, including renderer;
- exact modeled-neighbor projection digest;
- diagnostic manifest digest;
- external binding-rejection projection and manifest digests;
- parser/policy revision.

Accepted review evidence stays in the existing `semantic-review-v1.json` release member. It is
not included in handler implementation closures, avoiding revision/review circularity.
