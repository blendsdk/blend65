# Rule Models and Bindings

> **Document**: 03-01-rule-models-bindings.md
> **Parent**: [Index](00-index.md)

## Overview

This component turns RD-01 rule identities into explicit generator readiness without modifying
inventory semantics. Canonical JSON owns reviewable facts; TypeScript owns executable operations
(AR-P2). Bindings are validated in candidate and published states (AR-P9).

## Canonical contracts

```ts
type RuleModelState =
  | { readonly state: "modeled"; readonly model: ModeledRuleRecord }
  | { readonly state: "unmodeled"; readonly reason: RuleModelReason }
  | { readonly state: "not-generatable"; readonly reason: RuleModelReason };

type RuleModelReason =
  | "outside-initial-slice"
  | "requires-semantic-oracle"
  | "not-source-generatable";

interface ModelCitation {
  readonly sourcePath: string;
  readonly contentHash: Sha256Digest;
}

interface ConstructionPrecondition {
  readonly kind: "type-in" | "value-range" | "arity" | "spelling-in";
  readonly subject: string;
  readonly values: readonly string[];
}

interface TypedDomain {
  readonly subject: string;
  readonly type: "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";
  readonly values: readonly string[];
}

interface InvalidContract {
  readonly contractId: string;
  readonly diagnosticFamily: string;
  readonly neighborIds: readonly NeighborId[];
}

interface ModeledRuleRecord {
  readonly ruleId: RuleId;
  readonly citations: readonly ModelCitation[];
  readonly constructionPreconditions: readonly ConstructionPrecondition[];
  readonly typedDomains: readonly TypedDomain[];
  readonly invalidContracts: readonly InvalidContract[];
  readonly constructorIds: readonly ConstructorId[];
  readonly predicateIds: readonly PredicateId[];
  readonly neighborIds: readonly NeighborId[];
  readonly boundaryFamilyIds: readonly BoundaryFamilyId[];
  readonly spellings: readonly SpellingKind[];
}

interface ExecutableBinding<TImplementation> {
  readonly handlerId: HandlerId;
  readonly kind: HandlerKind;
  readonly contractVersion: string;
  readonly implementationRevision: Sha256Digest;
  readonly implementation: TImplementation;
}

interface ModelBindingDiagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

type RuleModelRegistryResult =
  | {
      readonly ok: true;
      readonly registry: RuleModelRegistry;
      readonly counts: RuleModelStateCounts;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly ModelBindingDiagnostic[] };

type BindingValidationResult =
  | {
      readonly ok: true;
      readonly bindings: ValidatedBindingRegistry;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly ModelBindingDiagnostic[] };

declare function getPublishedBinding(
  snapshot: PublishedSnapshot,
  handlerId: HandlerId,
): ExecutableBinding<HandlerImplementation> | undefined;
```

Parsing and validation return these closed discriminated results. Expected invalid input is never
reported by throwing, and specification tests assert stable diagnostic `code` and JSON `path`
rather than English message text (AR-P15).

### Wire contract

Canonical model input is closed JSON:

```ts
interface RuleModelRegistryInput {
  readonly schemaVersion: 1;
  readonly registryVersion: string;
  readonly rules: readonly RuleModelEntryInput[];
}
```

Every entry contains `ruleId`, `state` and exactly the fields permitted by that state. Modeled
entries contain citations, construction preconditions, typed domains, invalid contracts,
constructor/predicate/neighbor/boundary operation IDs and spellings. `unmodeled` and
`not-generatable` entries contain one closed reason code and no modeled fields.

All semantic subjects, contract IDs, diagnostic families and executable operation IDs use
`^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$`. Source paths are contained repository-relative paths and
content hashes use canonical `sha256:<64 lowercase hex>` form. Arrays are non-empty, duplicate-free
and lexically ordered wherever order is not semantic. Values are canonical strings interpreted only
by the operation named in the same modeled record; the registry never parses requirement prose.

The two-stage public API is:

```ts
declare function parseRuleModelRegistry(
  input: Uint8Array,
): RuleModelRegistryParseResult;

declare function validateRuleModelRegistry(
  input: RuleModelRegistryInput,
  inventoryRuleIds: readonly string[],
  executableOperationIds: readonly string[],
): RuleModelRegistryResult;
```

Parsing applies strict UTF-8/JSON, duplicate-key, closed-schema and resource-limit checks.
Validation joins the already-parsed input against exact inventory IDs and an injected closed set of
known operation IDs. Specification fixtures therefore use fixture-local IDs such as
`constructor.fixture.scalar`, `predicate.fixture.range`, `neighbor.fixture.above-max` and
`boundary.fixture.min-max`; they do not depend on Phase 5 implementations.

Binding validation accepts the RD-01 declaration shape exactly:
`{ id, kind, owner, contractVersion, binding: "bound" | "unbound" }`. Executable entries contain
exactly `handlerId`, `kind`, `contractVersion`, `implementationRevision` and `implementation`.
Duplicate declarations and bindings are rejected before map construction.

Diagnostics use RFC 6901 JSON pointers. Model paths are rooted at `/rules`; binding paths are rooted
at `/declarations` or `/bindings`. The Phase 1 closed codes are:

| Code | Meaning |
|---|---|
| `model.input.invalid-json` | Input is not strict valid JSON |
| `model.input.invalid-utf8` | Input is not strict UTF-8 |
| `model.input.limit` | A byte, depth, string or collection limit is exceeded |
| `model.schema.invalid` | Closed envelope, field, version or state shape is invalid |
| `model.rule.missing` | An authoritative inventory rule has no entry |
| `model.rule.duplicate` | A rule ID occurs more than once |
| `model.rule.unknown` | An entry names no authoritative inventory rule |
| `model.modeled.incomplete` | A modeled entry lacks a required canonical semantic fact |
| `model.operation.unknown` | A modeled entry names an unavailable executable operation |
| `binding.declaration.missing` | A binding has no declaration |
| `binding.declaration.duplicate` | A declaration ID occurs more than once |
| `binding.entry.duplicate` | A binding handler ID occurs more than once |
| `binding.entry.kind` | Binding and declaration kinds differ |
| `binding.entry.contract` | Binding and declaration contract versions differ |
| `binding.entry.revision` | Implementation revision is not canonical or fresh |
| `binding.candidate.state` | Candidate declaration is not `unbound` |
| `binding.published.state` | Published binding targets an `unbound` declaration |
| `binding.published.missing` | A `bound` declaration lacks exactly one binding |

Phase 1 never constructs a trusted `PublishedSnapshot`. Candidate bindings remain unavailable to
published lookup by type; runtime lookup behavior is completed with the opaque snapshot in Phase 7
(AR-P16).

`RuleModelReason`, operation IDs and spelling kinds are closed discriminated unions. The canonical
manifest covers every current inventory rule exactly once and is stored in lexical rule-ID order.
Modeled records require at least one source citation, one closed construction precondition, one
typed domain and one executable predicate. Each invalid contract names its expected diagnostic
family. Validation evaluates executable operations against these canonical facts; matching IDs
alone never establishes modeled coverage. Non-modeled states project to RD-06 `unmodeled` while
retaining their distinct reason code.

## Executable registry

The TypeScript registry contains pure constructors, predicates and neighbor operations keyed by
generated closed IDs. Loading performs three linear joins:

1. inventory rule IDs ↔ canonical model records;
2. modeled operation IDs ↔ executable operations;
3. handler declarations ↔ executable handler bindings.

No operation may inspect requirement prose, compiler types or compiler output.

`implementationRevision` is derived, not supplied. The domain tag
`blend65-handler-implementation-v1` covers canonical LF-normalized UTF-8 bytes of the handler entry
module and its complete transitive production-module dependency set, each preceded by its
repository-relative path and byte length in lexical path order. Generated revision metadata and a
freshness gate reject changed, missing or extra dependency bytes before candidate validation,
replay or publication.

## Binding state machines

### Candidate validation

- declaration exists and is `unbound`;
- ID, kind and contract version match;
- implementation revision is a canonical SHA-256 digest;
- implementation is registered exactly once;
- candidate is not returned by published lookup.

### Published-state validation

- declaration exists and is `bound`;
- exactly one compatible binding exists in the selected publication snapshot;
- no unbound declaration has a published binding;
- every RD-02-owned bound declaration has a binding;
- RD-03/RD-04 unbound declarations remain untouched.

## First modeled subset

The initial modeled set is exactly these nine inventory rules. Every other rule remains explicitly
`unmodeled` or `not-generatable`; adding a rule requires an amended seed contract and new accepted
review evidence.

| Concern | Exact rule IDs |
|---|---|
| Scalar value domains | `rule.ch02.2-primitive-types.byte.range.0-255`; `rule.ch02.2-primitive-types.sbyte.range.128-127`; `rule.ch02.2-primitive-types.word.range.0-65535`; `rule.ch02.2-primitive-types.sword.range.32768-32767`; `rule.ch02.2-primitive-types.boolean.range.true` |
| Memory signatures | `rule.ch12.3-1-memory-access.peek-addr.signature.word`; `rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte`; `rule.ch12.3-1-memory-access.peekw-addr.signature.word`; `rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word` |

Each scalar rule carries its exact domain, boundary family, literal/const/local/parameter
constructors, range/type predicate and nearest-invalid neighbors. Each memory rule carries its
exact parameter/return types, literal/const/local/parameter address spellings, value spellings
where applicable, and wrong-type/wrong-arity invalid contracts. Runtime/computed address operands
are mandatory model-valid constructor variants because the specification permits them; current
compiler rejection is evidence to be found later, not a generator constraint (AR-P1).
Arithmetic/comparison expressions and module/function scaffolding are IR composition machinery,
not extra modeled-coverage claims.

Before generator implementation, a separate semantics reviewer records the exact seed-contract and
manifest digests, reviewer identity, disposition and citations in
`readiness/reviews/rule-models-v1-review.json`. Candidate validation requires accepted,
digest-matching evidence; any model-fact or manifest change invalidates it.

## Error handling

| Error | Result | AR Ref |
|---|---|---|
| Missing/duplicate/unknown rule | Deterministic model-registry diagnostic | AR-P2 |
| Unknown operation ID | Registry rejected before generation | AR-P2 |
| Candidate against bound declaration | Candidate-state mismatch | AR-P9 |
| Published binding against unbound declaration | Published-state mismatch | AR-P9 |
| Invalid digest/version/kind | Closed binding diagnostic | AR-P9 |

## Tests

- Exhaustive 2,112-rule coverage and non-vacuity.
- One-to-one executable operation joins.
- Exact equality with the nine-rule seed set and per-rule contract/spelling matrix.
- Manifest-fact mutation and implementation-revision freshness failures.
- Candidate/published state matrix.
- Dependency boundary across every new production file.
