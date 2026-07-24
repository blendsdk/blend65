# Ambiguity Register: RD-02 Typed Generative Cases and Deterministic Replay

> **Status**: ✅ GATE PASSED — all 14 items resolved
> **Last Updated**: 2026-07-24 15:55
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd02-20260724-01`
> **Policy version**: 1

## Register

| # | Category | Ambiguity / Gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Which rules form the first non-vacuous modeled subset? | Model exactly the five scalar-domain and four memory-signature rule IDs listed in 03-01 with a closed per-rule contract/spelling matrix and digest-bound independent review. Arithmetic/comparison and module/function forms are composition machinery, not additional coverage claims. Every other rule remains visibly unmodeled/not-generatable. | AI delegated by `--auto-design`; independently challenged and preflight-hardened | ✅ Resolved |
| AR-P2 | Data & state | Where do typed rule models live without changing inventory v1? | A closed canonical JSON model manifest owns serializable reviewed facts and reason-coded coverage state; a TypeScript registry owns executable constructors/neighbor operations and must bind one-to-one to modeled manifest records. Validation joins both against the RD-01 inventory. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P3 | Technical | What independent IR is sufficient for the first subset? | Immutable discriminated unions for modules, consts, functions, parameters, locals, scalar types, expressions, calls, assignments, returns and memory intrinsics; no compiler AST/spans/symbol objects. Unsupported constructs are unrepresentable. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P4 | Technical | Which deterministic PRNG is pinned? | A counter-based domain-separated SHA-256 generator identified as `blend65-sha256-ctr-v1`; every draw binds seed, generation path and draw ordinal, with rejection sampling for bounded integers. No mutable global stream or host RNG participates. | AI delegated by `--auto-design`; challenger improved the design | ✅ Resolved |
| AR-P5 | Data & state | How are campaign and case identities canonicalized? | RFC-independent canonical UTF-8 encoding with fixed field order, decimal BigInt strings, sorted record keys and LF; domain-separated SHA-256 for configuration, campaign and case identities. Case path is an integer-choice path plus ordinal, not arbitrary text. Replay carries the bounded normalized configuration preimage and verifies its digest. | AI delegated by `--auto-design`; preflight-hardened | ✅ Resolved |
| AR-P6 | Behavioral | What happens when an exact replay revision is unavailable? | Return a typed `replay-incompatible` result naming the missing identity component; never load nearest/current code and never generate partial source. Handler revisions are freshly derived from the handler's complete transitive production dependency bytes, never supplied labels. | AI delegated by `--auto-design`; preflight-hardened | ✅ Resolved |
| AR-P7 | Technical | How is renderer independence proven? | A renderer and a separate bounded tokenizer/Pratt parser-normalizer share only public IR types and token-kind names; they do not share precedence tables or formatting helpers. Structural equality ignores only explicit normalization fields. | AI delegated by `--auto-design`; independently challenged | ✅ Resolved |
| AR-P8 | Behavioral | How is “exactly one intentional violation” established? | Begin from a model-valid IR, apply one named neighbor operation, revalidate every participating model contract, and require the target contract alone to flip valid→invalid; otherwise generation rejects the case. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P9 | Integration | How are executable bindings represented? | A closed in-memory registry binds generated handler IDs to kind, contract version, content revision and callable implementation. Candidate and published-state validators are separate APIs. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P10 | Data & state | How is binding publication made atomic with existing RD-01 files? | Stage and durably sync a content-addressed release containing inventory, rule models, both review-evidence sets, bindings and projections; validate and test it through an isolated opaque snapshot; then atomically replace and sync one regular-file pointer. Published claims require that snapshot capability; source authoring remains explicitly non-authoritative. | AI delegated by `--auto-design`; challenger and preflight improved the design | ✅ Resolved |
| AR-P11 | Edge cases | Which limits are enforced before compilation? | Closed positive integer budgets for modules, declarations, IR nodes, statements, expression depth, loop-work product, source bytes and generation attempts; checked during construction and again on the completed case with overflow-safe BigInt arithmetic. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P12 | Security | How are external registry/replay inputs handled? | Parse as bounded bytes with closed schemas; allowlist IDs/targets/algorithms; reject duplicate keys, unknown fields, unsupported versions, absolute/traversal paths and oversize values before resolution or filesystem access. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P13 | Testing | What verification and coverage policy applies? | Follow repository full verify; readiness logic retains ≥90% branch coverage, changed files pass Prettier checks, spec tests are written and observed red before implementation, and `spec/` remains byte-untouched. | AI delegated by `--auto-design`; verify command detected from AGENTS.md | ✅ Resolved |
| AR-P14 | Ordering | What phase order prevents false readiness? | Foundations → rule-model registry → bindings/identity → IR/generation/budgets → renderer/inverse → replay/campaigns → authority publication/closeout. No handler becomes bound before the complete generation surface is verified. | AI delegated by `--auto-design` | ✅ Resolved |

## Delegated Resolution Provenance

All entries are eligible internal architecture, algorithm, data-shape, validation, security,
testing or sequencing decisions within the approved RD-02 behavior and scope.

- **Objective:** produce independent, deterministic, replayable generative evidence without
  treating compiler output or unreviewed prose inference as semantic authority.
- **Evidence:** RD-02 preflight; `packages/readiness` public contracts and dependency boundary;
  empty generation-domain arrays in the 2,112-rule authority; existing atomic writer, generation
  lock, review evidence and projection pipeline.
- **Rejected alternatives:** compiler AST reuse violates independence; broad inventory-v1 schema
  mutation triggers premature evolution; TypeScript-only semantic facts are not independently
  reviewable; text-only fuzzing cannot establish valid semantics; snapshots cannot prove renderer
  structure; binding before end-to-end verification creates false readiness.
- **Strongest counterargument:** the hybrid registry and independent inverse add substantial
  machinery before the first campaign runs.
- **Confidence:** High — reopen if the first modeled subset cannot express ordinary
  const/local/parameter memory-intrinsic arguments without compiler types, or if exact replay needs
  an identity input not listed by RD-02.
- **Hardening:** the independent challenger converged on AR-P1, AR-P2, AR-P7 and AR-P14. It
  improved AR-P4 from mutable-stream PCG32 to path-local SHA-256 counter generation so unrelated
  cases survive traversal changes, and improved AR-P10 from sequential loose-file renames to one
  content-addressed snapshot pointer so authority and bindings cannot become half-visible.
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd02-20260724-01`
- **Reopen triggers:** an unmodeled case is counted as coverage; a case-shaping change preserves
  identity; renderer/parser share behavioral tables; publication can expose half-bound state; or a
  generated program requires compiler-owned semantic types.

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature and behavioral gaps | Generator/model/binding/replay workflows closed by AR-P1–AR-P10 |
| Scope | First subset and exclusions fixed by AR-P1 |
| Technical unknowns | IR, PRNG, identities, inverse and publication resolved |
| Edge cases | Empty/unavailable/collision/overflow/limit states resolved |
| Integration | RD-01 authority and future RD-03/RD-04 boundaries explicit |
| Data and state | Manifest, registry, identity and publication ownership explicit |
| Security | Closed bounded parsing and path rejection explicit |
| Non-functional | Determinism, replay and budgets explicit |
| UX/presentation | Typed results and stable IDs; no end-user UI introduced |
| Stakeholder conflicts | Frozen spec authority and modern-source ergonomics preserved |
| Naming and terminology | Public type/module terms fixed by AR-P2–AR-P11 |
