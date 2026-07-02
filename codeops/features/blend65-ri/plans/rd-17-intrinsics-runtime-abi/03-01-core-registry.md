# Core Registry & Catalog: RD-17

> **Document**: 03-01-core-registry.md
> **Parent**: [Index](00-index.md)

## Overview

The `@blend65/core` foundation everything else consumes: descriptor types, the
registry, the complete core catalog, the new diagnostic codes, and the small
core-level deltas (reserved names, opcode set, profile floor).

## Architecture

### Current
Two unrelated placeholders named `IntrinsicDescriptor` (`core/platform/platform-plugin.ts:81`
= `unknown`; `codegen/il/intrinsic-descriptor.ts:23-30` = `{name, tier?: number, clobbers?}`).
No registry, no catalog, no E10043-45.

### Proposed
New module `packages/core/src/intrinsics/` (AR-P8) with a single barrel export via
`core/src/index.ts`:

```
core/src/intrinsics/
├── descriptor.ts   # IntrinsicDescriptor, IntrinsicSignature, IntrinsicParam,
│                   # TypeRef, CostMetadata, ClobberEntry, LoweringStrategy
├── registry.ts     # IntrinsicRegistry + createIntrinsicRegistry()
└── catalog.ts      # CORE_INTRINSICS (23 user-visible) + RT_ROUTINES (4 internal T3)
```

## Implementation Details

### Types (per RD-17 §4.1 verbatim — `'boolean'` spelling, pointer = ABI-view)

```typescript
export type IntrinsicTier = 'T1' | 'T2' | 'T3' | 'T4';
export type LoweringStrategy = 'opcode' | 'inline' | 'fold' | 'call';
export type ClobberEntry = 'A' | 'X' | 'Y' | 'status';
export type TypeRef = 'byte' | 'sbyte' | 'word' | 'sword' | 'boolean' | 'void'
  | { kind: 'pointer'; elementType: TypeRef }
  | { kind: 'array'; elementType: TypeRef };

export interface IntrinsicDescriptor {
  name: string;
  tier: IntrinsicTier;
  signature: IntrinsicSignature;
  availability: (profile: PlatformProfile) => boolean;
  loweringStrategy: LoweringStrategy;   // T1→'opcode', T2→'inline'|'fold', T3/T4→'call' (R17)
  costMetadata: CostMetadata;
  clobberList: readonly ClobberEntry[];
  description: string;
  asmModulePath?: string;               // T3/T4 only
}
```

`PlatformProfile` here is the **canonical** RD-10 profile (`core/platform/platform-profile.ts`)
— availability predicates key on `profile.cpu` (`asm_wai`: `cpu === "wdc65c02"`). The
canonical profile gains a `readonly platformId: string` field (PF-015 — R25 requires it,
and every frozen platform appendix lists "Platform ID" as the first profile-table row;
the TS type simply omitted it). T4 platform-identity conditioning compares
`profile.platformId` against the contributing plugin id captured at merge time (see
03-05). The analyzer receives this profile via `AnalyzeInput.targetProfile` (PF-014,
03-02).

### Registry (RD-17 §4.2; AR-P3, AR-P9)

```typescript
export interface IntrinsicRegistry {
  register(descriptor: IntrinsicDescriptor): void;  // throws Error on duplicate name (AR-P9)
  get(name: string): IntrinsicDescriptor | undefined;
  isReserved(name: string): boolean;
  getAvailable(profile: PlatformProfile): IntrinsicDescriptor[];
  getAll(): IntrinsicDescriptor[];
}

/** Core catalog pre-registered; platform T4 descriptors appended (03-05). */
export function createIntrinsicRegistry(
  platformDescriptors?: readonly IntrinsicDescriptor[],
): IntrinsicRegistry;
```

Internal T3 routine descriptors (`__rt_*`) are registered but `isReserved()` reports
**only user-visible names** (T1/T2/T4 + any future user-visible T3) — `__rt_*` symbols
are not language identifiers (RD-17 §4.3 internal table).

### Catalog (`catalog.ts`)

- 9 memory T2 + 13 CPU-control T1 + `asm_wai` per the RD-17 §4.3 table (signatures,
  Ch 12 cost figures, `description` strings for RD-14 hover).
- `lo`/`hi` descriptors carry `loweringStrategy: 'inline'`; their inline emitter folds
  compile-time-constant operands as an optimization (PF-021 — mirrors RD-17 §4.3
  "fold or `AND #$FF`"; the `'fold'` strategy is reserved for the always-fold
  `sizeof`/`offsetof`/`length`).
- `RT_ROUTINES`: `__rt_mul8`, `__rt_mul16`, `__rt_div8`, `__rt_div16` — tier T3,
  `loweringStrategy: 'call'`, `asmModulePath: 'runtime/<name>.asm'`, clobber
  `[A, X, status]` (+`Y` where the algorithm needs it), div ZP usage in `costMetadata.zpBytes`.
- The catalog array lengths are spec-locked in tests (AC-01).

### Core deltas (same phase)

| Change | File | Detail |
|--------|------|--------|
| +E10043/44/45/46 | `diagnostics/diagnostic-codes.ts` | `IntrinsicUnavailable`, `ZpArgBlockExceeded`, `NonConstantIntrinsicAddress` (AR-P8/P11) + `IntrinsicNotImported` E10046 (AR-P14); retire the E10212 reservation comment (RD-17 R21) |
| +`asm_wai` | `ast/reserved-builtins.ts` | Set 22→23; update size-locked tests deliberately |
| +`WAI` | `instr-model/opcode.ts` | `W65C02_OPCODES` += `WAI` (Implied mode) |
| Floor check | `platform/validate-profile.ts` | `zpArgBlockSize >= 4` → validation error (R34/AC-12) |
| Interim floor | `semantics/platform-profile.ts` | `DEFAULT_PROFILE.zpArgBlockMin` 0→4 (AR-P10); update the locked `core/src/sfa/records.impl.test.ts:31` assertion + sweep for other `DEFAULT_PROFILE` assertions deliberately (PF-020) |
| Real plugin type | `platform/platform-plugin.ts` | `export type IntrinsicDescriptor = unknown` → re-export of the real type |
| +`platformId` | `platform/platform-profile.ts` + all 5 plugin profiles (+ profile test fixtures) | Canonical profile gains `readonly platformId: string` (PF-015); each plugin's `validateProfile()` additionally checks `profile.platformId === plugin.id` (reuses the R22 machinery) |
| +`baseUrl` | `platform/platform-plugin.ts` (`RuntimeModule`) | `readonly baseUrl: string` — the owning plugin sets `import.meta.url`, giving `embed.ts` a resolvable base for plugin-relative `asmPath` (PF-017). **Applied in Phase 5** (not this phase): after the Phase-4 runtimeModules migration removes the 5 plugins' mul/div stub entries, only the T4 fixture sets it — avoids churning the spec-locked plugin tests twice |

## Integration Points
- Frontend (03-02) consumes the registry via `AnalyzeInput.registry` (AR-P3).
- Codegen (03-03/03-04) consumes descriptors on IL `intrinsic` ops and `RT_ROUTINES`.
- Platforms (03-05) contribute T4 arrays merged by `createIntrinsicRegistry`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Duplicate `register()` name | Throw plain `Error` (setup bug) | AR-P9 |
| `zpArgBlockSize < 4` | `validateProfile()` validation error | R34, AC-12 |

## Testing Requirements
- Spec: registry contract (register/get/isReserved/getAvailable), duplicate-throw, catalog completeness vs the Ch 12 name list, `asm_wai` availability predicate, floor check.
- Impl: TypeRef edge shapes, `getAvailable` filtering across all five real profiles, reserved-set/opcode-set growth assertions.
