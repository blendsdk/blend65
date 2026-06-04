# Module Vars & Zero-Page Allocation: RD-05 SFA Frame Planner

> **Document**: 03-03-zp-and-layout.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-05 R24–R36, §4.5/§4.6/§4.7/§4.8; spec Ch 11 §4/§7

## Overview

Covers RAM placement of module-level `let` variables, frame-region placement, and the
priority-ordered zero-page allocator (user vars → pointers → main temps → IRQ temps), including
ZP pointer sharing via the interference graph from 03-02. These passes consume the coloring
result and produce `ModuleVariableAllocation[]` and `ZpAllocation[]` for the `AllocationPlan`.

## Architecture

### New Types (core `sfa/allocation-plan.ts`)

```typescript
export interface ModuleVariableAllocation {
  readonly moduleName: string;
  readonly variableName: string;
  readonly address: number;        // absolute RAM (finalized after frame base known)
  readonly offset: number;         // relative offset within module-var region
  readonly size: number;
  readonly type: Type;
}

export interface ZpAllocation {
  readonly name: string;           // var name or "__zp_ptr_N" / "__zp_tmp_N" / "__zp_irq_tmp_N"
  readonly address: number;        // $00–$FF
  readonly size: number;           // 1 or 2
  readonly category: "user" | "pointer" | "temp" | "irq-temp" | "arg-block";
}
```

### Interim `PlatformProfile` budget fields (core, additive — D2)

```typescript
// packages/core/src/semantics/platform-profile.ts (additive — RD-10 supersedes)
export interface PlatformProfile {
  readonly name: string;            // existing
  readonly charEncoding: string;    // existing
  // --- interim SFA budget fields (D2) ---
  readonly ramStart: number;        // RAM segment start (module vars then frames)
  readonly ramEnd: number;          // RAM segment end (exclusive)
  readonly zpStart: number;         // first usable ZP byte
  readonly zpEnd: number;           // last usable ZP byte (inclusive) — budget = zpEnd-zpStart+1
  readonly stackBudget: number;     // usable hardware-stack bytes (256 − reserve), R39
  readonly zpArgBlockMin: number;   // reserved runtime-ABI ZP arg-block (AR-34); interim default 0 — RD-17 owns the floor (D8)
  readonly mainTempBytes: number;   // default ZP main expression temps (R33, default 4)
  readonly irqTempBytes: number;    // default ZP IRQ temps (R34, default 2)
  readonly zpWarnThreshold: number; // 0..1 fraction → W10030 (default 0.80)
  readonly ramWarnThreshold: number;// 0..1 fraction → W10033 (default 0.90)
  readonly stackWarnThreshold: number; // 0..1 fraction → W10180 (default 0.75)
}
```

A C64-shaped fixture profile (`testFixtures` / test helper, not shipped as a real platform):
`ramStart 0x0800`, `ramEnd 0xA000`, `zpStart 0x02`, `zpEnd 0x2F` (46 bytes), `stackBudget 230`,
`zpArgBlockMin 0` (D8 — deferred to RD-17), `mainTempBytes 4`, `irqTempBytes 2`, thresholds
0.80/0.90/0.75 — values from Ch 11 examples / appendix-c64.

> **Budget convention (clarity):** `zpBudget = zpEnd − zpStart + 1` is **inclusive** (both
> endpoints are usable ZP bytes), whereas `ramBudget = ramEnd − ramStart` is **half-open**
> (`ramEnd` is exclusive). The two formulas differ deliberately — it is not an off-by-one.

### New Functions (frontend `sfa/`)

```typescript
// module-var layout (inside plan-allocation or a helper)
export function layoutModuleVariables(
  vars: readonly ModuleVarInput[],     // { moduleName, variableName, type, size } in init+decl order
): { allocations: ModuleVariableAllocation[]; totalSize: number };

// zp-allocator.ts
export interface ZpInput {
  readonly userVars: readonly { name: string; size: number }[];  // zeropage-declared, decl order
  readonly peakPointers: number;       // from §4.7 computePeakPointers
  readonly mainTemps: number;          // profile.mainTempBytes
  readonly irqTemps: number;           // profile.irqTempBytes
  readonly argBlockMin: number;        // profile.zpArgBlockMin
}
export function allocateZeroPage(
  input: ZpInput, profile: PlatformProfile, bag: DiagnosticBag,
): { allocations: ZpAllocation[]; used: number; overflowed: boolean };

export function computePeakPointers(
  fns: readonly FunctionInfo[], graph: InterferenceGraph,
): number;
```

## Implementation Details

### Module-variable layout (R24, §4.5)

```
offset = 0; allocations = []
for v in vars (module init order, then declaration order within module):
  allocations.push({ ...v, offset, address: 0 /* finalized later */ })
  offset += v.size
totalSize = offset
```
Absolute `address` is finalized once the frame base is known (§4.6): module vars occupy
`[ramStart, ramStart+totalSize)`, then the frame region follows. For pre-ACME budget checking
(R42/AR-81) only the **sum of sizes** is needed; absolute addresses may be finalized at emit time
(AR-67). The planner fills `address = ramStart + offset` using the profile's `ramStart`.

> **Provisional addresses (clarity):** the absolute `address`/`absoluteAddress` values the
> planner computes here are **provisional** — the authoritative placement of the RAM-variable
> and frame regions relative to code/data segments is owned by the platform segment ordering
> (AR-64) and finalized at emit time via the ACME label file (AR-67), i.e. by RD-09/RD-10. The
> pre-ACME budget checks (R42) depend only on sum-of-sizes and are correct regardless.

- **R25:** const **scalars** are inlined (0 bytes) — not passed to this layout.
- **R26:** const **aggregates** live in the Data segment (RD-09), not RAM — not placed here.
- **R27:** `zeropage` variables go to the ZP allocator, not RAM layout.

### Frame-region placement (R19/R23, §4.6)

```
frameRegionBase = ramStart + moduleVariablesSize
for each function F with an offset:
  F.absoluteAddress = frameRegionBase + F.frameOffset
```

### Zero-page allocation (R28–R36, §4.7) — priority order

```
zpCursor = profile.zpStart
allocations = []

// Reserve runtime-ABI arg-block first (AR-34) — interim default 0 (D8: RD-17 owns the floor).
// The loop is plumbed so RD-17 lights it up additively with no code change; 0 → no bytes today.
for i in 0 .. profile.zpArgBlockMin-1: push {category:"arg-block", size:1}, zpCursor++

// Priority 1: user zeropage variables (R30) — declaration order
for v in userVars: push {name:v.name, category:"user", size:v.size}; zpCursor += v.size
  if zpCursor > zpEnd+1: emit E10032 (overflow), stop

// Priority 2: struct/array pointer bytes (R31/R32) — peakPointers × 2
for n in 0 .. peakPointers-1: push {name:`__zp_ptr_${n}`, category:"pointer", size:2}; zpCursor += 2
  if overflow: emit E10032

// Priority 3: main expression temps (R33) — profile.mainTempBytes
for n in 0 .. mainTemps-1: push {name:`__zp_tmp_${n}`, category:"temp", size:1}; zpCursor++
  if overflow: emit E10032

// Priority 4: IRQ temps (R34, separate pool) — profile.irqTempBytes
for n in 0 .. irqTemps-1: push {name:`__zp_irq_tmp_${n}`, category:"irq-temp", size:1}; zpCursor++
  if overflow: emit E10032

used = zpCursor - profile.zpStart
```

- **Overflow (R35/FR-28):** the first allocation that would push `zpCursor` past `zpEnd` emits
  **E10032** once, sets `overflowed = true`, and stops further ZP placement (no partial garbage).
  The diagnostic span points at the largest contributing `zeropage` var when available.
- **Determinism (R36):** fixed priority order + declaration order + deterministic generated names.

### ZP pointer sharing & peak (R31/R32, §4.7)

`computePeakPointers` reuses the interference graph (03-02). A function "needs a pointer" for each
**by-ref parameter** (struct/array param → `FrameVar.byRef === true`). Sequential (non-interfering)
functions share pointer slots; nested (interfering) functions accumulate them. The peak is the
maximum, over all functions `F`, of the sum of by-ref-param counts across `F` and all its
**interfering ancestors** on the deepest path:

```
peak = 0
for F in nodes:
  // walk F and its interfering set that are ancestors (simultaneously live with F)
  liveTogether = { F } ∪ { A in interferes(F) | A is an ancestor of F }
  needed = Σ over g in liveTogether of byRefParamCount(g)
  peak = max(peak, needed)
return peak
```

This yields: `f(struct); g(struct)` sequential → 1 slot (×2 bytes); `f` nested-calls `g` → 2 slots
(×2 = 4 bytes); 3-level nesting → 3 slots (6 bytes) — matching §4.7's examples.

> Simplification recorded: the deepest-nesting computation is bounded by the interference graph
> already built; we count by-ref params along the maximal interfering ancestor chain. This is a
> conservative upper bound (never under-allocates), satisfying H5 determinism. Exact minimization
> is a future optimization (does not affect correctness).

### Expression-temp estimation (R33, §4.8)

For RD-05 the main/IRQ temp counts are **configurable defaults** read from the profile
(`mainTempBytes`=4, `irqTempBytes`=2). The precise Sethi-Ullman estimation is explicitly a
**refinement** deferred to when RD-06/RD-07 land (RD-05 §7-Q1 — *not* a new ambiguity, an
acknowledged refinement). The planner reserves the configured bytes today.

## Code Examples

### ZP layout on the C64 fixture

```
profile: zpStart $02, zpEnd $2F, argBlockMin 0 (D8), mainTemps 4, irqTemps 2
userVars: [rasterLine:1]
peakPointers: 1

$02       __zp_... user rasterLine (1)   // arg-block contributes 0 bytes (D8 → RD-17)
$03..$04  __zp_ptr_0 (2)
$05..$08  __zp_tmp_0.._3 (4)
$09..$0A  __zp_irq_tmp_0.._1 (2)
used = 9 bytes  (well under 46 → no W10030)
```

> When RD-17 sets `zpArgBlockMin > 0`, the arg-block prepends that many bytes and every
> subsequent ZP address shifts up accordingly — an additive change the loop already handles.

## Error Handling

| Error Case                       | Handling Strategy                                          | AR Ref |
| -------------------------------- | ---------------------------------------------------------- | ------ |
| ZP cursor exceeds `zpEnd`        | Emit **E10032** once, stop ZP placement, `overflowed=true` | R35    |
| `peakPointers` huge              | Still attempts; overflow → E10032                          | R35    |
| Module var size 0 (error type)   | Placed with size 0; harmless                               | R60    |
| Upstream errors present          | ZP/RAM budget diagnostics suppressed (03-04, R62)          | R62    |

> **Traceability:** maps to RD-05 §4.5–§4.8 and Ch 11 §4/§7. Codes per Ch 14 (verified present).

## Testing Requirements

- Unit: module-var sequential offsets + total size; `address = ramStart + offset`.
- Unit: ZP priority order (arg-block → user → pointer → temp → irq-temp); generated names.
- Unit: `computePeakPointers` for sequential vs nested by-ref calls (1 vs 2 vs 3 slots).
- Unit: E10032 on overflow (stops, sets flag, one diagnostic).
- Determinism: identical input → identical ZP layout (R36).
- See `07-testing-strategy.md` ST-Z1..ST-Z8.
