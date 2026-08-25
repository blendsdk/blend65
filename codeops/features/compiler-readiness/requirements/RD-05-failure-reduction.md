# RD-05: Failure Classification, Shrinking and Regression Promotion

> **Document**: RD-05-failure-reduction.md
> **Status**: Approved
> **Created**: 2026-07-23
> **Last Updated**: 2026-08-26
> **Project**: Compiler Readiness
> **Depends On**: RD-02, RD-04
> **CodeOps Artifact Schema**: 1

## Feature Overview

Turn generated non-pass results into small, stable, and actionable evidence. Every result receives
a closed disposition, but only source-dependent failures enter shrinking and regression promotion.
Minimization preserves the exact failure predicate and execution route instead of collapsing a
semantic failure into an irrelevant parser error or executing unauthenticated candidate bytes.

RD-05 adds the reduction-candidate authority needed to execute transformed cases without changing
the original campaign identity. It supports both typed generated cases and a new closed, bounded
production ingress for intentionally malformed source. Confirmed failures become immutable
regression candidates; they enter the active specification tier only at a green checkpoint.

## Definitions

| Term | Definition |
|---|---|
| Failure predicate | Versioned identity of the complete condition a candidate must reproduce, including result code, terminal tier and stage, observation identity, claimed primary rules, target, route contract, and cleanup status. |
| Reduction candidate | Authenticated transformed source or typed IR derived from one historical failure and executed through that failure's unchanged route contract and predicate. |
| One-minimal | No single transformation in the applicable canonical catalog produces a strictly smaller candidate that preserves the predicate. |
| Failure core | Immutable content-addressed record containing the minimized case, predicate, campaign-independent minimized replay authority, canonical catalog/normalization revisions, and promoted regression identity. |
| Provenance event | Immutable append-only record associating one campaign's historical envelope, candidate-authority trace, discovery, or confirmation with a failure core. |
| Inactive regression | Immutable expectation-bearing candidate retained outside active test discovery while its defect is present. |
| Active regression | The byte-identical inactive candidate registered in the specification tier at a green checkpoint. |

## Functional Requirements

### Must Have

- [ ] Classify every RD-04 non-pass with exactly one disposition from the closed disposition table;
  unknown values fail closed and cleanup blockers remain separate evidence.
- [ ] Represent shrink equivalence with `FailurePredicateV1` and represent deduplication with the
  separate `PromotedFailureKeyV1`; neither identity may substitute for the other.
- [ ] Freeze the original primary rule and the fail-closed required subset of claimed rules into
  the failure predicate before shrinking. Those claims cannot be removed. An incidental claim that
  is explicitly outside that subset may disappear only when its witnessing construct disappears;
  incidental neighboring rules never become required claims.
- [ ] Shrink valid and type-constrained cases only through independent typed-IR transformations
  whose output is well formed and satisfies the original type and semantic invariants. (AR-8)
- [ ] Treat an invalid typed case as the complete tuple of valid baseline, invalid transform, and
  expected diagnostic contract; a candidate is accepted only when the tuple remains coherent.
- [ ] Own a closed, bounded raw-malformed-source ingress in `@blend65/readiness` and matching
  diagnostic-route authority in `@blend65/readiness-execution`; its record carries exact source
  bytes, rule and obligation, diagnostic-oracle authority, token/text provenance, and policy limits.
- [ ] Shrink raw malformed cases through token/text delta debugging while preserving exact source
  bytes, encoding, and the diagnostic predicate. (AR-8)
- [ ] Derive a domain-separated, revision-bound `ReductionCandidateAuthorityV1` from authenticated
  historical authority, candidate digest, canonical transformation trace, predicate, and route.
- [ ] Give every reduction candidate a new execution identity and execute it through the original
  obligation, terminal tier, policy, fixture, and oracle; never reuse the original case identity.
- [ ] Apply versioned deterministic transformation ordering and normalization until the result is
  one-minimal or a closed exhaustion result is produced.
- [ ] Reconstruct candidates only from a complete historical `FailureEnvelopeV1`; missing content
  returns `historical-authority-unavailable` and current revisions are never substituted.
- [ ] Confirm a minimized failure twice in fresh isolated workers. If isolated confirmation fails,
  run the bounded sequence reproducer and classify the result without promotion.
- [ ] Publish immutable failure cores, append-only provenance events, and immutable activation
  markers using secure durable no-clobber operations.
- [ ] Deduplicate only equal `PromotedFailureKeyV1` values and preserve all campaign discoveries as
  distinct provenance events.
- [ ] Publish a confirmed unique failure immediately as an immutable inactive regression candidate.
  Activate the unchanged candidate only with its separately owned fix and a green checkpoint, or
  immediately when the current compiler already satisfies its expectation.
- [ ] Keep bulk generated source ephemeral while persisting deterministic campaign manifests,
  summaries, failure envelopes, confirmed failure cores, provenance events, and activation state.
  (AR-9)

### Won't Have

- Automatic modification of the compiler or frozen specification.
- Golden or expected-failure approval of failing compiler output.
- Text-only shrinking for valid semantic cases.
- Reuse of an original campaign identity or direct compiler invocation as candidate authority.
- A claim of globally smallest output; the deterministic contract is one-minimal.
- Fallback to current inventory, oracle, execution, projection, or tool revisions when historical
  content is unavailable.

## Technical Requirements

### Closed Non-Pass Dispositions

`FailureDispositionPolicyV1` is keyed by the exact RD-04 result code. Its route contract also checks
the required terminal tier and stage for that code; a code at a disallowed tier or stage is
`unsupported-non-pass-disposition`. Its only initial outputs are `direct-shrink`, `fresh-confirm`,
`campaign-only`, and `unsupported`.

| RD-04 result | Required RD-05 disposition |
|---|---|
| `diagnostic-mismatch`, `unexpected-emission`, `semantic-mismatch` | `direct-shrink`. |
| `compiler-ice`, `emission-failure`, `assembler-failure` | `fresh-confirm`; transition to `direct-shrink` only when two fresh workers reproduce it and a same-route known-good control passes, otherwise `campaign-only`. |
| `instruction-exhaustion`, `cycle-exhaustion`, `wall-time-exhaustion`, `output-exhaustion`, `evidence-exhaustion` | `fresh-confirm`; transition to `direct-shrink` only when two fresh workers reproduce it and a same-route known-good control passes under the identical policy, otherwise `campaign-only`. |
| `emulator-launch-failure`, `emulator-handshake-failure` | `fresh-confirm`; transition to `direct-shrink` only when two fresh workers reproduce it and a same-route known-good control passes, otherwise `campaign-only`. |
| `invalid-evidence-input`, `unbound-capability`, `execution-plan-capacity`, `tier-unavailable`, `emulator-lease-recovery-blocked` | `campaign-only`; never promoted as a source regression. |
| Unknown code or disallowed tier/stage combination | `unsupported`, reported as `unsupported-non-pass-disposition`; do not shrink or promote. |

The v1 allowed-tuple relation is exhaustive. The result tier must equal the authenticated route
item's terminal tier, and its stage must be reachable in that route's ordered prefix. The following
table then defines the only allowed stages per code; every other `(code, tier, stage)` tuple is
`unsupported`:

| Code | Allowed stage(s) |
|---|---|
| `invalid-evidence-input` | `input`, `vice-launch`, `fixture`, `observe`, `compare` |
| `unbound-capability`, `execution-plan-capacity` | `capability` |
| `tier-unavailable` | `capability`, `acme`, `vice-launch` |
| `diagnostic-mismatch`, `unexpected-emission` | `frontend`, `compiler-api`, `cli`, `emit` |
| `compiler-ice` | `frontend`, `compiler-api`, `cli`, `emit`, `acme`, `vice-launch` |
| `emission-failure` | `emit` |
| `assembler-failure` | `acme` |
| `emulator-launch-failure` | `vice-launch` |
| `emulator-handshake-failure` | `vice-handshake`, `fixture`, `run` |
| `instruction-exhaustion`, `cycle-exhaustion` | `run` |
| `wall-time-exhaustion`, `output-exhaustion`, `evidence-exhaustion` | `frontend`, `compiler-api`, `cli`, `emit`, `acme`, `vice-launch`, `vice-handshake`, `fixture`, `run`, `observe`, `compare` |
| `semantic-mismatch` | `fixture`, `observe`, `compare` |
| `emulator-lease-recovery-blocked` as a primary result | `vice-launch`, `cleanup` |

A cleanup blocker never changes the primary result code. It receives its own closed cleanup
disposition: `cleanup-clear` when absent or `cleanup-blocked` when the closed RD-04 blocker is
present. It remains separately observable even when a primary failure is present. The disposition,
but not volatile cleanup evidence bytes, is included in the failure predicate and must reproduce
for predicate equality unless the primary result is campaign-only.

Reduction itself has the closed outputs `confirmed-source-failure`, `stateful-sequence-failure`,
`flaky-failure`, `reduction-exhausted`, and `historical-authority-unavailable`. Only
`confirmed-source-failure` may enter promotion.

### Failure and Promotion Identities

`FailurePredicateV1` contains the schema and predicate-contract revision; primary result code; terminal tier and
stage; observation identity; cleanup disposition; primary rule and immutable
required subset of claimed rule IDs; target; route-contract identity; and obligation, fixture,
oracle, and tool contract digests. The route-contract identity encodes route kind, terminal
obligation, policy, fixture, and oracle semantics but excludes source-bound or campaign-bound case,
execution, route-plan, and observation identities. Equality is byte equality of its canonical
encoding.

The observation identity is the closed union `observed:<normalized-observation-digest>` when an
oracle observation exists or `not-reached:<terminal-stage>:<normalized-terminal-reason-digest>`
when execution terminated before observation. Terminal-reason normalization retains the stable
failure category and bounded predicate-bearing evidence but excludes case, candidate, execution,
route-plan, timing, workspace, and host-path identities. No missing or optional observation value is
permitted.

`PromotedFailureKeyV1` contains the schema revision, normalized minimized-content digest, and the
complete canonical `FailurePredicateV1`. Its normalization revision is explicit. It excludes
campaign identity and non-authoritative observation prose. Digest collisions with different
canonical bytes are fatal publication conflicts rather than deduplication.

### Historical and Candidate Authority

`FailureEnvelopeV1` embeds or content-addresses all information needed for exact historical replay:

- either the complete typed-case `ReplayEnvelopeV1` or complete raw-source
  `MalformedReplayEnvelopeV1`, plus generated source or typed IR and route-plan bytes;
- generation, reduction, execution, timeout, evidence, and normalization policies;
- selected inventory, rule, oracle, diagnostic, execution-publication, and projection authorities;
- fixture and platform identities, compiler/assembler/emulator identities, and relevant versions;
- canonical closed oracle-observation projections needed to evaluate the predicate; and
- resolvers whose content digests and schemas are verified before use.

Unavailable, oversized, malformed, digest-mismatched, or unsupported historical content produces a
closed replay result and is never replaced with current content.

`@blend65/readiness` owns envelope validation, transformation generation, candidate authority,
predicate evaluation, minimality, normalization, deduplication identity, and regression lifecycle.
`@blend65/readiness-execution` owns execution of authenticated reduction candidates through the
existing terminal routes and secure publication primitives. The original `CaseIdentity` remains
immutable. The new candidate identity is domain-separated from campaign, replay, and publication
identities.

Every accepted typed edit revalidates the validity kind, primary rule, fail-closed required subset
of claimed rules, complete type-correct bindings, and all family-specific semantic invariants. For
an invalid neighbor it additionally preserves the neighbor identity, violated predicate,
diagnostic family and context, and proof of exactly one intentional violation. Any edited path is
rebased and must resolve exactly once. A claim may vary only through an explicit predicate contract.

### Deterministic Reduction

`failure-reduction-catalog-v1` is closed and non-empty. Its typed-valid family includes irrelevant
statement/subtree deletion and type-preserving expression/literal simplification. Its typed-invalid
family includes baseline deletion/simplification, transform-target rebasing, and unused-binding
reduction while preserving the complete invalid tuple. Its raw-malformed family includes canonical
token-range and byte-chunk deletion without source rewriting. Unsupported transformation kinds fail
closed; catalog revision participates in the reduction identity.

Each versioned transformation family defines a total candidate order, deterministic normalization,
a strictly decreasing size tuple, preservation checks, first-preserving-candidate acceptance, and a
fixed-point proof after a complete catalog pass that no single transformation produces a smaller
preserving case.

Typed cases use a lexicographic tuple of typed-node count, serialized typed-IR bytes, source bytes,
and canonical source bytes. Raw malformed cases use token count, source-byte count, and an exact-byte
digest tie-breaker; normalization may canonicalize token metadata but may not rewrite authoritative
malformed source bytes. Invalid typed tuples include the baseline, transform, and
diagnostic-contract sizes. Equal-size rewrites are accepted only as deterministic normalization and
may not cycle.

Empty UTF-8 source is a valid raw-malformed candidate and may be the one-minimal result. The new raw
diagnostic route accepts zero source bytes; existing non-empty typed-case validation does not apply
to this authority arm.

### Versioned Policy and Hard Limits

The selected reduction policy is campaign-specific and is recorded in the historical envelope and
provenance event, not the deduplicated failure core. Every field has both a selected limit and an
implementation hard maximum:

| Resource | Default selected limit | Hard maximum |
|---|---:|---:|
| Transformation attempts | 1,024 | 4,096 |
| Candidate route executions | 1,024 | 4,096 |
| Oracle evaluations | 2,048 | 8,192 |
| Captured diagnostic bytes | 262,144 | 1,048,576 |
| Provenance events read per projection | 256 | 4,096 |
| Cases in a sequence reproduction | 8 | 64 |
| Durable bytes per failure core | 16,777,216 | 67,108,864 |
| Durable bytes per run | 67,108,864 | 268,435,456 |

Every selected value is a positive safe integer. The complete policy revision and selected values
are encoded into reduction-candidate authority, transformation trace, and provenance event, so a
policy change produces a different reduction-run identity without splitting equivalent promoted
failures. Selected values above the hard maximum are rejected
before work starts. Reaching an exact selected limit is allowed; the next consuming operation
returns the relevant closed exhaustion result. Exhausted, truncated, or unconfirmed candidates are
retained as campaign evidence but never promoted.

### Confirmation and Regression Lifecycle

After deterministic minimization, execute the candidate twice, each time in a fresh worker with a
fresh temporary root and no inherited mutable compiler process. Both executions must reproduce the
same predicate and normalized observation. If not, a bounded sequence reproducer replays the
originating case order in fresh workers. A reproducible sequence is persisted and classified as
`stateful-sequence-failure`; a flaky result receives its own campaign-only disposition. Neither is
promoted as a standalone source regression.

Promotion writes an inactive candidate whose source, predicate, expectation, key, and failure core
are immutable. The expectation comes from the inventory/oracle contract, never the observed failing
output. Activation records the candidate digest and the green verification commit; it cannot alter
candidate bytes. An implementation task may activate the candidate only when the compiler passes
the unchanged expectation. Existing-pass discoveries may activate within RD-05 after full green
verification.

### Durable Storage and Concurrency

Use these logical paths beneath the configured readiness evidence root:

- `readiness/failures/cores/<failure-core-digest>.json`
- `readiness/failures/events/<failure-core-digest>/<event-digest>.json`
- `readiness/failures/activations/<promoted-failure-key>.json`

All records use closed, size-bounded schemas and canonical encodings. Publication pins directory
identity, rejects symlinks and non-regular files, validates domain-separated content digests, writes
through same-directory temporary files, durably syncs file and directory state, and publishes with
no-clobber semantics. An existing byte-identical target is an idempotent success; different bytes
at the same identity are a fatal conflict. Partial temporary files and orphan events are safely
ignored or reconciled. A derived projection may aggregate events but is never the authority.

Failure-core derivation excludes original campaign identity, selected reduction limits, and
discovery-specific historical or candidate authority. It creates a canonical minimized replay
authority from the minimized content and campaign-independent predicate, catalog, and normalization
contracts. Each provenance event retains the originating `FailureEnvelopeV1` digest or content
reference, complete selected reduction policy, reduction-candidate authority and transformation
trace, and confirmation identity. Thus equal promoted keys produce byte-identical cores while every
campaign retains its separately authenticated path to that core.

RD-07 may package or migrate these records only by verifying the original canonical bytes and
digests; it may not rewrite their meaning or merge immutable provenance.

### Security and Host Data Handling

Persisted schemas structurally exclude environment variables, command lines, arbitrary host-file
contents, absolute host paths, raw process-stream bytes, and unstructured diagnostic prose. Exact
source bytes required for replay are stored in the failure core; host provenance is represented
separately with field-aware allowlisted identifiers. Persisted tool evidence is a closed typed
projection of diagnostic codes/ranges, normalized path fields, bounded numeric facts, and raw-stream
digests; source/tool echoes are never copied into another persisted field. Field normalization does
not rewrite exact source by substring. Tests inject canary secrets and path-like source literals to
prove secrets are absent while exact source bytes survive round-trip replay.
Worker environments are reduced to the smallest documented allowlist that preserves route
semantics.

## Scope Decisions

| Decision | Chosen | Rationale |
|---|---|---|
| Shrink vs. promotion identity | Separate `FailurePredicateV1` and `PromotedFailureKeyV1` | Predicate preservation and cross-campaign deduplication have different equality contracts. |
| Semantic shrinking | Typed-IR aware | Valid programs must remain valid and type-correct. (AR-8) |
| Invalid typed shrinking | Preserve complete invalid-neighbor tuple | The invalid transform and expected diagnostic depend on a valid baseline. |
| Malformed shrinking | RD-05-owned bounded raw-source ingress plus token/text reduction | Completed dependencies do not provide production raw malformed cases. (AR-8) |
| Candidate execution | New derived authority through the same route | Reduced bytes cannot truthfully reuse campaign identity. |
| Minimality | Deterministic one-minimal fixed point | This is reproducible and testable without claiming an infeasible global minimum. |
| Persistence | Immutable cores, append-only events, immutable activation markers | Prevents concurrent lost updates and mutable evidence. (AR-9) |
| Promotion | Inactive immutable candidate, then green activation | Preserves both the regression oracle and the repository's green-commit rule. |
| Historical replay | Complete retained or content-addressed authority; no current fallback | Revision drift must not change the reproduced case or oracle. |

## Acceptance Criteria

1. [ ] Exhaustive cross-product tests prove every RD-04 code/tier/stage tuple maps to exactly one
   disposition or `unsupported`; unknown values fail closed and a cleanup blocker remains separately
   observable.
2. [ ] Predicate equality distinguishes result code, tier, stage, observation, cleanup, rules,
   target, route, and authorities; promotion-key equality follows its separate closed schema.
3. [ ] A valid semantic failure cannot be replaced by a candidate that is ill-typed, malformed, or
   witnesses only an incidental rule.
4. [ ] An invalid typed candidate preserves a coherent valid baseline, invalid transform, and
   expected diagnostic contract.
5. [ ] A production raw malformed case can be generated, authenticated, minimized as exact bytes,
   and executed through the diagnostic route without typed IR.
6. [ ] Every reduced candidate has a new authenticated identity and runs through the original
   obligation, tier, policy, fixture, oracle, and predicate.
7. [ ] Replaying a retained `FailureEnvelopeV1` after authority revisions reproduces the same case
   and predicate; unavailable historical content returns a closed failure without current fallback.
8. [ ] Repeating reduction with the same envelope and policy produces byte-identical one-minimal
   output and a trace proving no canonical single step can reduce it further.
9. [ ] Exact selected limits succeed, the next consuming operation returns a closed exhaustion
   result, hard-limit violations are rejected, and no exhausted case is promoted.
10. [ ] A minimized failure is promoted only after two fresh-worker confirmations; a reproducible
    sequence is persisted and classified separately, while flaky results remain campaign evidence.
11. [ ] Two campaigns with the same `PromotedFailureKeyV1` create one immutable core and distinct
    append-only provenance events without lost updates under concurrent retry.
12. [ ] A digest collision, schema mismatch, oversized record, symlink substitution, partial write,
    or different bytes at an existing identity fails closed without changing accepted evidence.
13. [ ] A promoted current defect is durably visible as an inactive immutable candidate without
    making the repository red.
14. [ ] Activation preserves candidate bytes and occurs only with a passing compiler and green
    verification; the regression fails if the defect is reintroduced.
15. [ ] Persisted schemas expose no environment or command fields, arbitrary host-file content, or
    absolute temporary path; seeded secret canaries are absent outside exempt exact source bytes,
    and required replay authority round-trips unchanged.
16. [ ] Field-aware normalization preserves exact path-like source literals and typed non-host
    values while removing host path fields; raw prose/streams are absent and injected secret
    canaries never appear outside the exact-source field.
17. [ ] RD-05 writes neither compiler implementation nor any file under `spec/`; regression
    activation that needs a compiler fix remains owned by the later fix task.
18. [ ] Known-reducible typed-valid, typed-invalid, and raw-malformed fixtures each shrink strictly
    under the non-empty v1 catalog while preserving their complete predicate and family invariants.
19. [ ] A raw malformed case whose one-minimal reproducer is zero source bytes executes through the
    diagnostic route and promotes normally; typed cases continue to reject empty source.
