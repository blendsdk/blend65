# Testing Strategy: RD-02 Typed Generative Cases and Deterministic Replay

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Specification tests are implementation-blind and precede each phase. Logic tests follow the
implementation. The readiness package retains at least 90% branch coverage, changed files pass
Prettier checks, the full repository verify passes, and `spec/` remains unchanged (AR-P13).

## 🚨 Specification Test Cases

> Expectations below derive only from RD-02, component specifications and the ambiguity register.
> They are immutable oracles. A failing specification test means the implementation is wrong.

### Rule models and bindings

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-01 | Manifest contains every authoritative rule exactly once | Validation succeeds and reports exact modeled/unmodeled/not-generatable counts | RD-02 AC-2; 03-01 |
| ST-02 | Remove, duplicate or add an unknown rule record | Deterministic validation failure naming the offending rule/path | RD-02 AC-2; AR-P2 |
| ST-03 | A modeled record has a missing/mutated citation, precondition, typed domain, invalid contract, predicate or operation ID | Registry is rejected unless canonical facts and executable behavior agree | RD-02 AC-2/3; 03-01 |
| ST-04 | Initial subset query plus accepted model-review record | Exact nine-rule seed set and exact per-rule contract/spelling matrix match digest-bound independent review evidence | RD-02 AC-3/6; AR-P1 |
| ST-05 | Unmodeled/not-generatable rule requested by a campaign | No case is generated; RD-06 projection is `unmodeled` with reason retained | RD-02 AC-2; 03-01 |
| ST-06 | Compatible implementation against one unbound declaration | Candidate validation succeeds but published lookup remains unavailable | RD-02 AC-10/13; AR-P9 |
| ST-07 | Candidate/published matrix with undeclared, duplicate, kind/contract/revision mismatch and stale binding state | Each invalid state fails with its stable diagnostic | RD-02 AC-10/13; 03-01 |

### IR, neighbors and budgets

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-08 | Construct minimal module/function with each scalar type and spelling | Typed IR validates without compiler imports | RD-02 Must Have; AR-P3 |
| ST-09 | Construct `peek/poke/peekw/pokew` using literal, const, local and parameter operands | Every specification-permitted spelling is representable and model-valid | RD-02 AC-6; AR-P1 |
| ST-10 | Apply one named invalid neighbor to a valid baseline | Exactly the named predicate flips; metadata names one diagnostic family | RD-02 AC-7; AR-P8 |
| ST-11 | Neighbor flips zero or two predicates | Case generation rejects it; no source is emitted | RD-02 AC-7; AR-P8 |
| ST-12 | Hit each structural budget exactly and then exceed it by one | Boundary succeeds; excess fails before rendering with the named dimension | RD-02 AC-8; AR-P11 |
| ST-13 | Overflow-sized loop-work/configuration input | Closed input rejection without Number coercion or allocation blowup | RD-02 AC-8/12; AR-P11 |
| ST-14 | Boundary transform over signed/unsigned widths and spelling families | Empty/min/max/nearest-invalid variants are stable, typed and deduplicated | RD-02 AC-3/11; 03-02 |

### Identity and replay

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-15 | Published SHA-256 counter vectors | Draw bytes and rejection-sampled integers match exactly | 03-03; AR-P4 |
| ST-16 | Insert an unrelated generation branch | Existing sibling path produces identical draws and case digest | 03-03; AR-P4 |
| ST-17 | Same complete campaign/case identity in two fresh processes | Source bytes are identical | RD-02 AC-4; AR-P5 |
| ST-18 | Mutate each campaign field one at a time | Identity changes or replay returns explicit incompatibility | RD-02 AC-4/5; 03-03 |
| ST-19 | Same ordinal/path under different handler, target, config or transform revision | Case digests do not collide | RD-02 AC-5; 03-03 |
| ST-20 | Requested exact model/generator/transform/renderer revision is absent | `replay-incompatible` names it; current implementation is never called | RD-02 AC-5; AR-P6 |
| ST-21 | Inject equal digest for unequal canonical preimages | Collision is rejected and neither case is accepted | RD-02 AC-5; AR-P5 |
| ST-22 | Replay JSON has duplicate/unknown/oversize fields, unsupported IDs or path-like values | Rejected before generation/filesystem access | RD-02 AC-12; AR-P12 |
| ST-34 | Handler dependency bytes change while claimed implementation revision remains fixed | Freshness validation rejects before candidate validation, replay or publication | RD-02 identity requirements; 03-01 |
| ST-35 | Fresh-process replay has no ambient configuration, or carried configuration is missing/mismatched | Complete carried configuration replays; missing/mismatched content is explicitly incompatible | RD-02 AC-4/5; 03-03 |
| ST-41 | Prepared campaign requested by ordinal in repeated, reversed and concurrent order | Identity, plan item, effective parameter bindings, usage and source bytes remain identical; the plan has no cursor | RD-02 AC-4/6/8; AR-P30 |
| ST-42 | Campaign cannot hold mandatory reviewed spelling coverage, mixes generator routes, exceeds 100,000 cases or supplies a used/wrong-campaign collision index | Closed deterministic failure occurs before any case handler or renderer runs | RD-02 AC-5/6/8/12; AR-P30 |

### Rendering and round trip

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-23 | Render representative modules twice | Byte-identical LF UTF-8 source with deterministic ordering | RD-02 Must Have; 03-04 |
| ST-24 | Render every operator precedence/associativity discriminator | Independent parse projection equals originating projection | RD-02 AC-9; AR-P7 |
| ST-25 | Mutate one renderer precedence/parenthesis rule | At least one independent round-trip test fails | RD-02 AC-9; AR-P7 |
| ST-26 | Source contains unsupported token/construct | Inverse returns bounded `roundtrip-unsupported`, never partial success | 03-04; AR-P7 |
| ST-27 | Source exceeds byte limit after UTF-8 rendering | Fails before source is returned | RD-02 AC-8/12; AR-P11 |
| ST-36 | Inverse imports renderer behavior, or a spec-derived token/literal/normalization/precedence vector is mutated | Static boundary or frozen-vector test fails | RD-02 AC-9; 03-04 |

### Binding publication and closeout

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-28 | Valid staged release with four RD-02 bindings | One pointer commit selects a digest-verified complete release | RD-02 AC-10/11/13; AR-P10 |
| ST-29 | Kill publisher before pointer replacement | Old authority/bindings remain current | RD-02 AC-13; 03-05 |
| ST-30 | Kill publisher after pointer replacement | New complete authority/bindings are current | RD-02 AC-13; 03-05 |
| ST-31 | Member digest, symlink, traversal or non-regular pointer is injected | Resolver rejects before member consumption | RD-02 AC-12; AR-P12 |
| ST-32 | Production module reads published member directly | Static boundary test fails; resolver is the only readiness-claim path | 03-05; AR-P10 |
| ST-33 | Final selected publication | Three generators and boundary transform are bound; RD-03/RD-04 declarations remain unbound | RD-02 AC-10/11; AR-P14 |
| ST-37 | Directory/pointer/manifest publication digests differ, or injected equal digest has unequal release bytes | Promotion rejects and the old pointer remains selected; byte-identical reuse is idempotent | RD-02 AC-13; 03-05 |
| ST-38 | Pointer, manifest, binding, member-count, per-member or total-release size hits its limit then exceeds it | Limit succeeds; excess is rejected before allocation or hashing | RD-02 AC-12; 03-05 |
| ST-39 | Raw authority reaches published lookup, or CLI command crosses the authoring/claim boundary | Opaque capability is required; generate is non-authoritative, check resolves selected release, publish uses lock/protocol | RD-02 AC-10/13; 03-05 |
| ST-40 | Staged binding digest lacks accepted matching independent review, or real pointer is selected before staged suite passes | Publication is blocked; accepted evidence and complete staging suite precede the sole pointer commit | RD-02 AC-13; 03-05 |

## Test Files

| File | ST cases |
|---|---|
| `rule-model-registry.spec.test.ts` | ST-01–ST-05 |
| `handler-bindings.spec.test.ts` | ST-06–ST-07 |
| `generator-ir.spec.test.ts` | ST-08–ST-11 |
| `generation-budget.spec.test.ts` | ST-12–ST-14 |
| `case-identity.spec.test.ts` | ST-15–ST-16, ST-18–ST-21 |
| `handler-revision.spec.test.ts` | ST-34 |
| `replay.spec.test.ts` | ST-17, ST-20, ST-22, ST-35 |
| `campaign-replay.spec.test.ts` | ST-17–ST-22, ST-27, ST-35, ST-41–ST-42 at the composed campaign boundary |
| `renderer-roundtrip.spec.test.ts` | ST-23–ST-27, ST-36 |
| `binding-publication.spec.test.ts` | ST-28–ST-33, ST-37–ST-40 |

Implementation tests use matching `*.impl.test.ts` files split by parser/schema internals,
canonicalization, budget accounting, error paths and crash recovery.

## Integration and process tests

- Fresh-process replay uses a small checked-in child entrypoint and real filesystem isolation.
- Publication crash tests use child processes and the real pointer resolver.
- Publication durability tests inject each sync/rename failure boundary and use a capability probe
  to skip only with the typed unsupported result on platforms lacking directory synchronization.
- No compiler package is imported or invoked in RD-02 tests.
- Final checks: `yarn readiness:generate`, `yarn readiness:check`, readiness coverage, full verify,
  traceability readiness, Markdown links, Prettier, and `git status --porcelain spec/`.

## Verification command

```text
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```
