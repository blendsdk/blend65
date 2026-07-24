# Current State: RD-02 Typed Generative Cases and Deterministic Replay

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What exists

RD-01 created `@blend65/readiness`, a compiler-independent package that loads and validates the
authoritative inventory, semantic review evidence, projections and version dispatch. It already
has bounded JSON parsing, stable diagnostics, a generation lock and atomic single-file writes.

The authoritative inventory contains 2,112 rules and declares three RD-02 generators plus
`transform.boundary-variants`, all unbound. Every rule currently has empty generation-domain
arrays. No generator IR, executable rule model, PRNG, renderer, inverse parser, campaign identity,
case identity, replay resolver or executable binding registry exists.

### Relevant files

| File | Current purpose | Change needed |
|---|---|---|
| `packages/readiness/src/model.ts` | Inventory and declaration contracts | Add separate RD-02 public contracts |
| `packages/readiness/src/index.ts` | Public package boundary | Export stable RD-02 APIs |
| `packages/readiness/src/declaration-validator.ts` | Inventory declaration metadata | Preserve; add separate binding validators |
| `packages/readiness/src/authority-loader.ts` | Fixed-path current authority load | Add publication-resolved load path |
| `packages/readiness/src/atomic-writer.ts` | Atomic one-file replacement | Reuse for pointer commit and harden directory durability if needed |
| `packages/readiness/src/generation-lock.ts` | Single-writer generation lease | Reuse for publication transaction |
| `packages/readiness/src/projection.ts` | Canonical inventory digest/projections | Consume during staged publication |
| `readiness/inventory/compiler-readiness-v1.json` | Rule/declaration authority | Final binding metadata only; no rule-semantic rewrite |
| `readiness/schema/inventory-v1.schema.json` | Closed inventory v1 | No schema-version change |

## Confirmed gaps

| Gap | Consequence | Planned owner |
|---|---|---|
| Empty generation domains | Coverage can be vacuous | 03-01 |
| No binding implementation identity | `bound` can be asserted without code | 03-01 |
| No typed construction model | Valid/invalid programs cannot be proven | 03-02 |
| No stable random-access draws | Traversal edits break replay | 03-03 |
| No independent inverse | Renderer mistakes can self-confirm | 03-04 |
| Loose multi-file publication | Half-bound state can become visible | 03-05 |

## Dependencies

### Internal

- RD-01 inventory, generated declaration IDs, review evidence and projection digest.
- Node `crypto` SHA-256 and filesystem primitives.
- Existing Vitest and TypeScript infrastructure.

### External

- `ajv` and `jsonc-parser` already present; no new runtime dependency is planned.
- Compiler packages are explicitly excluded from production generation code (AR-P1).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Model facts drift from executors | Medium | High | Exhaustive ID joins and digest pinning |
| Independent parser grows into second compiler | Medium | High | Closed emitted subset and projection-only AST |
| Identity omits case-shaping input | Low | Critical | Closed campaign record and field mutation tests |
| Pointer bypass exposes loose files | Medium | Critical | Static read-boundary test plus digest-checked resolver |
| Known compiler restriction influences generator | Medium | Critical | Spec-owned local/parameter memory cases stay valid |
| Large manifest creates slow validation | Medium | Medium | Linear passes, size limits and coverage profiling |
