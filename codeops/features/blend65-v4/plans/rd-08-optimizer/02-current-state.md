# Current State: Full RD-08 Optimizer

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The compiler already has a complete semantic and machine pipeline:

```text
frontend analyze -> WholeProgram -> StorageInventory/SFA -> MachineProgram
-> shared layout/branch repair -> ACME -> evidence/publication
```

The stopped size slice adds:

- `SizeSelectionPlan` and candidate construction;
- compact startup alternatives;
- final observer validation;
- closed-cost selection and rejected-baseline evidence;
- 27/27 frontier cases and a 1623-byte saved LowByte candidate.
- RD-08 compact-startup composition now selects a 1055-byte saved candidate; the
  stopped slice's 1623-byte LowByte candidate remains its historical evidence.

It does not add a reusable optimizer. The current candidate frontier is a fixed
2 × loop × startup recipe menu. Every family has its own whole-program proof
gate, and untouched code must pass every gate.

### Relevant Files

| File | Purpose | Changes Needed |
|---|---|---|
| `packages/compiler/src/machine/lower.ts` | Machine lowering producer and storage projection | Invoke the shared facts/rule pipeline inside the producer |
| `packages/compiler/src/machine/lowering-provenance.ts` | Seals the exact machine program | Preserve/extend producer authority; no post-seal rewrite |
| `packages/compiler/src/services/shared-storage.ts` | Draft/final SFA closure and layout | Re-close after every code-shape change |
| `packages/compiler/src/services/size-selection.ts` | Candidate plans and closure | Generalize the recipe plan to per-site rule choices |
| `packages/compiler/src/services/size-observers.ts` | Final whole-program observer gate | Consume per-rule obligations; keep canonical fallback |
| `packages/compiler/src/services/evidence.ts` | B/R/T and evidence generation | Add complete T and optimization records without breaking none |
| `packages/compiler/src/storage/selection.ts` | Object/storage projection | Keep the sole SFA omission channel |
| `packages/compiler/src/layout/c64-layout.ts` | Final layout/branch repair | Re-run SFA closure after size changes |
| `packages/compiler/src/machine/byte-value-availability.ts` | Adjacent byte rules | Reuse queries; do not grow beyond its 700-line ceiling |
| `packages/compiler/src/services/size-observer-*` | Current family proofs | Replace only where per-rule obligations fully cover them |

### Code Analysis

The pipeline is producer-sealed. `lowerMachineProgram` discovers storage and
calls `projectMachineStorage` before closure; final SFA closure happens after a
draft layout, not once after lowering. A pass that changes code after sealing
would invalidate `LOWERING_EVIDENCE` and `SharedEvidence`.

Final observers currently reject entire candidates for missing async, raw/MMIO,
global-return or family facts. The acquisition candidates fail before selection;
saved LowByte succeeds after a complement-ordering correction but is still 898
bytes over target.

## Gaps Identified

### Gap 1: No shared facts layer

**Current Behavior:** each family re-derives object, loop, byte, alias, bounds
and layout facts, and rejects the whole candidate when one family is unsupported.

**Required Behavior:** one immutable facts bundle and per-rule obligations let
independent rules compose without re-parsing the source or waiving untouched
code.

**Fix Required:** add `optimization-facts.ts` and make rules consume it.

### Gap 2: No explicit ordered rule runner

**Current Behavior:** transformations are scattered across lowering and proof
owners; there is no stable rule order or independent rule result.

**Required Behavior:** a deterministic ordered list inside the lowering producer,
with a stable rule ID, matched sites, rewritten code and complete obligations.

**Fix Required:** add `optimization-rules.ts`; keep the runner internal.

### Gap 3: Incomplete cost model

**Current Behavior:** B and R are measured; T is always unknown.

**Required Behavior:** exact/range/symbolic T where machine costs and path
classes prove it; unknown is honest and cannot decide a tie.

**Fix Required:** add `optimization-cost.ts`; extend evidence consumers without
changing the v1 schema.

### Gap 4: Missing transformation eligibility

**Current Behavior:** all acquisition candidates reject async borrow/raw/MMIO/
platform/global-return classes; saved X/Y/FlatEight reject whole-program scalar
guards.

**Required Behavior:** per-rule async, raw, MMIO, aggregate-return and loop
obligations, with canonical fallback for unproved sites.

**Fix Required:** implement rule obligations and the saved/acquisition rule
tranches in phases; never weaken final behavior or resource checks.

## Dependencies

### Internal Dependencies

- RD-01–RD-07 correctness pipeline and `none` behavior.
- SFA/interference/layout/closure owners.
- Final observer and evidence/publication owners.
- ACME 0.97 and VICE 3.10 for native qualification.
- The stopped slice’s measured fixtures and 27/27 frontier as regression evidence.

### External Dependencies

None new. Node/Yarn/Turbo/TypeScript/Vitest/ACME/VICE are already configured.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rules change code after provenance is sealed | High | High | Run inside the lowering producer; re-close SFA/layout; reject post-seal rewrites |
| Per-rule obligations become a new monolith | Med | High | Facts ≤600, rules ≤700, cost ≤400; split focused rule modules only via a new AR |
| Saved 725 remains unreachable | High | High | Foundation/saved tranche has a measured go/no-go; stop and re-baseline if far |
| Acquisition observer classes expand without bound | High | High | Size-first milestone; async/raw/MMIO scoped by actual fixture needs, no generic solver |
| None behavior/artifacts drift | Med | High | Default path never derives optional facts or runs rules; artifact identity tests |
| T becomes a guessed heuristic | Med | High | Accept unknown/range/symbolic only; no frequencies or weights |
| 700-line and native-host limits | High | Med | Bounded modules; sequential VICE; host performance review |
