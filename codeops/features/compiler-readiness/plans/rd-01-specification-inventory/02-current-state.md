# Current State: RD-01 Specification Inventory

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The repository has a frozen v3.0 specification, strict TypeScript packages, Vitest tiers, Turbo
orchestration and several root data-generation scripts. It does not have a readiness package,
inventory schema, normative-source manifest, fragmenter, clause ledger, rule graph or validation
command. The only installed Ajv is transitive v6; `jsonc-parser` is declared only by
`@blend65/config`.

The source boundary is heterogeneous: chapters 00–15 and the C64 appendix are normative owners,
grammar sections are normative syntax, while the feature index, evaluations, build/migration
documents, other target appendixes, future considerations and prior reports require explicit
classification. The build plan establishes chapter precedence; the feature index describes itself
as an overview and error-code registry.

### Relevant Files

| File | Purpose | Changes Needed |
|---|---|---|
| `package.json` | Workspace scripts and shared dev dependencies | Add check/generate commands |
| `tsconfig.json` | Root project references | Add readiness workspace |
| `packages/config/src/parse.ts` | Existing `jsonc-parser` offset pattern | Context only; do not import or modify |
| `packages/test-harness/` | Existing evidence consumer | Context only; inventory remains independent |
| `spec/00-introduction.md`–`spec/15-platform-profile.md` | Normative language owners | Read only |
| `spec/grammar.ebnf.md` | Normative syntax sections | Read only |
| `spec/appendix-c64.md` | C64 target obligations | Read only |
| remaining `spec/**` | Context/deferred/other-target/history | Classify, never edit |
| `codeops/features/compiler-readiness/requirements/RD-02*`–`RD-07*` | Downstream contracts | Context only |

### Code Analysis

- Root workspaces automatically include `packages/*`, but the root TS reference list is explicit.
- Every package owns build/typecheck/lint/test scripts; a new workspace must match that pattern.
- `@blend65/test-harness` is public and compiler-coupled, so it is not a neutral owner for a
  denominator used by independent generators and oracles (AR-P2).
- Existing root generators are single-purpose `.mjs` scripts. RD-01 instead defines reusable typed
  contracts and a validation pipeline, requiring a package API.
- No current dependency provides strict draft-2020-12 validation as a declared project contract.

## Gaps Identified

### Gap 1: No typed readiness boundary

**Current Behavior:** downstream work has no stable rule, handler, capability or diagnostic model.

**Required Behavior:** a compiler-independent private package exports closed v1 contracts and pure
validation/projection APIs (03-01, AR-P2).

### Gap 2: No exhaustive source discovery

**Current Behavior:** the feature index summarizes accepted areas but cannot prove every normative
fragment is represented.

**Required Behavior:** byte-exact fragmentation plus a closed source manifest and one disposition
per fragment (03-02, AR-P6).

### Gap 3: No relational integrity

**Current Behavior:** no tool detects source drift, duplicate semantic ownership, unresolved
contradictions, unavailable handlers, graph cycles or invalid target projection.

**Required Behavior:** ordered semantic passes with machine-readable blocking reasons (03-03,
AR-P7–AR-P9).

### Gap 4: No complete denominator or freshness gate

**Current Behavior:** there is no authoritative rule inventory and no generated projection.

**Required Behavior:** populate and validate the C64 v3.0 denominator, then make projection
freshness part of one non-mutating command (03-04, AR-P1, AR-P3).

## Dependencies

### Internal Dependencies

- Node 22, TypeScript/ESM, Yarn classic workspaces, Turbo and Vitest.
- Frozen `spec/` source bytes.
- RD-07 semantic revision as data in evolution-gate fixtures; RD-01 does not activate an upgrade.

### External Dependencies

- `jsonc-parser` as an explicit readiness dependency for lossless syntax-tree intake (AR-P4).
- Ajv v8 as an explicit readiness dependency, with remote schema loading disabled (AR-P5).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Natural-language inventory omits or misclassifies a clause | High | High | Total fragment ledger plus author/reviewer separation and unit/dependency-digest review evidence |
| Scanner accidentally becomes incomplete Markdown parser | Medium | High | Closed node profile plus residual spans and independent vectors |
| Duplicate/conflicting rules inflate denominator | Medium | High | Canonical ownership and one blocked-conflict aggregate |
| Generated docs drift from JSON | Medium | Medium | Byte-identical generation and non-mutating freshness check |
| Path or symlink escapes `spec/` | Low | High | Realpath containment before reads and adversarial fixtures |
| Resource exhaustion on hostile JSON/Markdown | Medium | Medium | Pre-allocation v1 caps and exact-boundary tests |
| Future RDs couple to implementation internals | Medium | High | Small exported contract barrel and compiler/toolchain-independent workspace |
