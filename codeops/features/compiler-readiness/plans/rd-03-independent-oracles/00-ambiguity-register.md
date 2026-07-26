# Ambiguity Register: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Status**: ✅ GATE PASSED — all 24 items resolved
> **Last Updated**: 2026-07-27
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd03-20260727-01`
> **Policy version**: 1

## Register

| # | Category | Ambiguity / Gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Which requirement and plan boundary does this plan implement? | Implement only `compiler-readiness/RD-03` over the exact nine RD-02 modeled scalar/memory rules. Arrays, nested calls, branches, loops, loop unrolling and the remaining inventory population stay owned by RD-08. | User-authorized RD-03 preflight PF-001 | ✅ Resolved |
| AR-P2 | Scope | May RD-03 change the frozen language specification or decide contradictory division-by-zero behavior? | No. `spec/` remains byte-untouched. Both identified division-by-zero conflicts remain `blocked-errata` and `oracle-unmodeled`; the plan neither chooses a result nor a diagnostic. | User-authorized RD-03 preflight PF-012; project D3 | ✅ Resolved |
| AR-P3 | Architecture | What is the executable oracle surface? | Add one closed oracle protocol shared by the four declared façades and one closed `transform.semantic-relations` handler. The four façades route only their declared observable contracts; one transform implementation owns the five relation IDs. | AI delegated by `--auto-design`; RD-03 preflight PF-002 | ✅ Resolved |
| AR-P4 | Data & state | Where does diagnostic truth live without upgrading inventory schema v1? | Add canonical closed diagnostic-manifest JSON plus independently authored digest-bound review JSON. Join the manifest exhaustively to the nine-rule modeled registry and its invalid-neighbor contracts; executable code consumes validated authority and never derives expected diagnostics from prose or compiler output. | AI delegated by `--auto-design`; RD-03 preflight PF-003 | ✅ Resolved |
| AR-P5 | Behavioral | What does the reference evaluator execute? | Execute one named function entry over immutable validated generator IR: constants in dependency order, exact parameter bindings, locals, assignments, ordered volatile reads/writes, return, unary operations and binary operations. Unsupported constructs or unresolved names/routes fail as data and never count as modeled success. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P6 | Semantics | How are scalar values represented and normalized? | Represent integers with `bigint`, normalize after every operation to the expression's declared 8- or 16-bit signed/unsigned type, preserve booleans as a distinct value variant, and implement signed comparison/right-shift through the declared type rather than host-number coercion. Evaluate binary operands left-to-right. | AI delegated by `--auto-design`; grounded in frozen type/operator rules | ✅ Resolved |
| AR-P7 | Semantics | How are division and remainder handled? | Reject divisor zero as `oracle-unmodeled` for both constant-shaped and runtime-shaped expressions because frozen authorities conflict. For non-zero operands, use truncation toward zero and type-width normalization. Mutation and boundary vectors include signed extrema without executing the blocked case. | AI delegated by `--auto-design`; user-authorized blocked-errata ruling | ✅ Resolved |
| AR-P8 | Memory | What is the exact memory-state contract? | Require an explicit versioned fixture of initialized byte cells. Reads of absent cells and any complete access outside `$0000..$ffff`, including word access at `$ffff`, return `oracle-unmodeled`. Word access is little-endian; writes update cells in low/high order and append ordered effects; later overlapping operations observe prior writes. | AI delegated by `--auto-design`; RD-03 requirement contract | ✅ Resolved |
| AR-P9 | Input safety | How do public entries handle hostile or oversized input? | Every public oracle/transform entry accepts `unknown`, snapshots and validates own data through bounded independent-IR parsing, rejects accessors, cycles, exotic prototypes, unknown fields/IDs and non-canonical values, and evaluates only the immutable validated snapshot. Transformed output is independently revalidated before use. | AI delegated by `--auto-design`; RD-03 security contract | ✅ Resolved |
| AR-P10 | Resources | Which oracle limits and consumption rules are fixed? | Add a closed positive-integer `OracleBudgetV1` covering input nodes, expression depth, evaluation steps, entry frames, initialized memory cells, recorded effects and transformed-output nodes. Validation is preflighted; one event is charged before each constant/statement/expression/memory effect/transform-node action. Exactly-at-limit succeeds; the next charge returns `oracle-budget` without partial success. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P11 | Metamorphic behavior | Which relation IDs exist in v1? | The closed union is `relation.identifier-renaming`, `relation.literal-to-local`, `relation.local-to-parameter`, `relation.algebraic-identity` and `relation.independent-declaration-reordering`. Unknown IDs reject; a false precondition returns `relation-inapplicable`, never pass. | AI delegated by `--auto-design`; RD-03 approved scope | ✅ Resolved |
| AR-P12 | Metamorphic soundness | What makes each rewrite semantics-preserving? | Identifier renaming is capture-avoiding and rewrites one complete declaration/reference binding set; literal-to-local inserts one typed immutable local before first use; local-to-parameter replaces one immutable entry local and adds the exact external binding; algebraic identity applies only type-correct identities and retains operand evaluation; declaration reordering follows an explicit dependency graph and moves only independent immutable declarations. | AI delegated by `--auto-design`; relation-specific preconditions required by PF-004 | ✅ Resolved |
| AR-P13 | Comparison | How are source and transformed observations compared? | Each relation owns a closed observable projection and comparator. Value/state relations compare typed return, ordered effects and the complete final initialized-memory projection. Diagnostic relations compare manifest-owned code, phase and normalized observable fields while excluding source-name/span fields changed by the relation. No global equality fallback exists. | AI delegated by `--auto-design`; RD-03 preflight PF-004 | ✅ Resolved |
| AR-P14 | Identity | How is oracle evidence identified without changing RD-02 case identity? | Add a separate domain-separated SHA-256 oracle-evaluation identity. Its canonical preimage binds source and transformed case IDs, optional relation ID, diagnostic-manifest digest, budget, policy revision, observable projection, and every participating handler contract/implementation revision. RD-02 campaign/configuration/case identities remain unchanged. | AI delegated by `--auto-design`; RD-03 preflight PF-007 | ✅ Resolved |
| AR-P15 | Publication | How can the diagnostic authority and five RD-03 handlers be selected atomically without an illicit publication-v1 format mutation before RD-07? | Preserve the exact seven-member `PublicationManifestV1`. Include the diagnostic manifest, generated projection and parser in each relevant handler's complete implementation closure, but exclude accepted review bytes to avoid revision/review circularity. Bind the manifest digest through a dedicated semantic-review unit and dependency digest. Publish one nine-row binding snapshot: four carried RD-02 bindings proven byte-identical plus exactly five fresh RD-03 promotions. Candidate resolution selects the serialized handler-ID set so historical four-row releases remain resolvable. | AI delegated by `--auto-design`; independent challenger corrected incremental promotion and review circularity | ✅ Resolved |
| AR-P16 | Binding compatibility | How are five new handlers declared and resolved? | Add the missing transform declaration to inventory v1 using existing schema fields; retain the four existing oracle declarations; register content-derived fresh candidates with exact kind/contract compatibility; extend the package-owned fixed publication profile; and expose lookup only through a digest-verified opaque selected snapshot. Reject missing, duplicate, undeclared, stale and incompatible entries. | AI delegated by `--auto-design`; RD-03 preflight PF-002/PF-006 | ✅ Resolved |
| AR-P17 | Mutation adequacy | What constitutes exhaustive mutation evidence? | Add a closed versioned catalog with one stable mutant ID for every evaluator operation/normalization path, diagnostic mapping, transform precondition, transform rewrite and relation comparator. Conformance seams dispatch production paths through the selected variant; the specification suite must kill every required mutant and rejects duplicate, missing, unknown or surviving catalog rows. No external mutation dependency is added. | AI delegated by `--auto-design`; RD-03 preflight PF-005 | ✅ Resolved |
| AR-P18 | Diagnostics | What are the stable result categories? | Public calls return closed discriminated success, `oracle-unmodeled`, `relation-inapplicable` or failure results. Failures use stable families for invalid/over-limit input, authority missing/stale/not-accepted, route/contract mismatch, budget exhaustion, identity collision and relation violation, each with an RFC 6901 path and bounded message. Expected compiler diagnostics remain manifest data rather than oracle-engine failures. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P19 | Module boundaries | How is independence mechanically enforced? | Production oracle/transform modules may import only Node standard library and public or relative modules contained by `packages/readiness`; a TypeScript-AST module-graph test rejects every `@blend65/*` import, any relative resolution escaping the package, and non-literal dynamic imports. Compiler packages are test subjects only in later tier adapters, not semantic authority. | AI delegated by `--auto-design`; RD-03 AC-1 | ✅ Resolved |
| AR-P20 | Testing | Which test tiers and coverage rules apply? | Author immutable `*.spec.test.ts` suites first and observe targeted RED before implementation; add `*.impl.test.ts` suites only for internal algorithms. Cover happy paths, extrema, wrap, order, hostile input, every budget boundary, authority freshness, relation fault injection, identity mutation, mutation catalog, publication crash points and package boundaries. Retain at least 90% branch coverage for readiness logic. | AI delegated by `--auto-design`; repository standards | ✅ Resolved |
| AR-P21 | Ordering | What implementation order prevents circular or prematurely authoritative evidence? | Contracts/spec tests → evaluator semantics → memory/diagnostic authority → relations/comparators → identity/mutation conformance → declaration/candidate integration → one final atomic publication and closeout. No RD-03 candidate is authoritative before every implementation closure and independent review artifact is final. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P22 | Verification | What command gates each checkpoint and final completion? | Run `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`; additionally run targeted readiness tests, `npx prettier --check` on touched files, JSON parsing/schema checks for authority files, the repository's frozen-`spec/` cleanliness check, CodeOps traceability validation/readiness and selected-publication resolution. Never commit a red checkpoint and never push. | User-supplied repository policy; `--auto-commit` | ✅ Resolved |
| AR-P23 | Integration | Does RD-03 add runtime dependencies or external services? | No new package dependency, subprocess, network, credential, database, authentication or deployment surface is introduced. Use existing Node crypto/filesystem primitives and Vitest infrastructure only. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P24 | Closeout | What downstream ownership must be checked before RD-03 closes? | Re-scan the requirement ambiguity register, RD Won't Have sections and `spec/future-considerations.md` for deferral-rationale expiry. Preserve RD-08 ownership of broader IR/oracle expansion, record every user-hittable restriction in the expressiveness ledger when applicable, update feature/portfolio roadmaps under branch policy and leave `spec/` unchanged. | Project deferral-expiry directive | ✅ Resolved |

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature and behavioral gaps | Bounded evaluator, diagnostic and five-relation behavior resolved by AR-P1–AR-P13 |
| Scope | Exact nine-rule current-IR population and RD-08 continuation resolved by AR-P1–AR-P2 |
| Technical unknowns | Handler, identity, mutation, module and backward-compatible publication composition resolved |
| Edge cases | Wrap, signedness, division conflict, absent/out-of-range memory and budget boundaries resolved |
| Integration | RD-02 IR, modeled registry, identity and publication seams covered by AR-P14–AR-P16 |
| Data and state | Closed diagnostic authority, immutable state, memory effects and canonical identities resolved |
| Security | Hostile objects, path/import escapes, resource bounds and dynamic-code exclusion resolved |
| Non-functional | Determinism, bounded work, freshness, crash consistency and branch coverage resolved |
| UX/presentation | Failures-as-data and stable bounded diagnostics resolved; no end-user UI introduced |
| Stakeholder conflict | User-owned scope correction and frozen-spec contradiction handling are explicitly authorized |
| Naming | Oracle, relation, evaluation identity, unmodeled and inapplicable states are closed |
| Dependencies | No new dependency; RD-01/RD-02 prerequisites and RD-08 continuation are explicit |

## AR-P15 Delegated Resolution Record

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal compatibility,
  content-addressing and publication-composition mechanism within the approved atomic-publication
  requirement. No frozen-spec, product-scope, deployment or outward-facing decision changes.
- **Objective:** atomically select the five RD-03 handlers and diagnostic authority without
  mutating the closed seven-member v1 release or activating the RD-07 evolution gate early.
- **Evidence:** implementation revisions already digest arbitrary canonical dependency bytes;
  semantic review already carries dependency digests and review units; `bindings-v1.json` may
  contain the complete nine-row binding set; the release digest already commits both bindings and
  semantic review. Manifest parsing requires exactly seven ordered members.
- **Decision:** diagnostic manifest/projection/parser bytes enter relevant handler closures and a
  dedicated semantic-review dependency. Accepted review bytes do not enter implementation
  closures because they approve the resulting revisions. One transaction carries forward the
  four selected RD-02 rows unchanged and promotes exactly five new candidates. Candidate
  reconstruction keys from the serialized binding rows instead of assuming the newest fixed
  profile, preserving resolution of historical four-row releases.
- **Rejected alternatives:** adding an eighth v1 member is rejected by the exact member parser and
  would be an ungoverned format mutation; embedding accepted review bytes in implementation
  revisions creates circular identity; a v2 release is deferred until RD-07's evolution gate.
- **Strongest counterargument:** the immutable release commits the diagnostic digest and handler
  closures but does not store standalone historical diagnostic-manifest bytes. The current
  resolver intentionally reconstructs exact source closures and fails closed if unavailable;
  immutable release-only replay would require the RD-07-gated v2 alternative.
- **Confidence:** High. Reopen if historical four-row releases stop resolving, carried bindings
  can change during promotion, or readiness requires release-only reconstruction without source
  closure bytes.
- **Hardening:** independent challenger found and resolved the review-circularity and incremental
  promotion hazards.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd03-20260727-01`.

## Gate

The systematic scan covers every required category, every item is resolved, and the independent
challenge has converged. The Zero-Ambiguity Gate is open; the remaining plan documents may be
created.
