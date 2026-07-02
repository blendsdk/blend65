# RD-17: Intrinsic Functions & Runtime-Routine ABI

> **Status**: 🟢 Authored
> **MVP Phase**: A
> **Depends On**: RD-04, RD-10
> **Implements**: `spec-v3.0` Ch 12 (Intrinsic Functions); AR-28..AR-36
> **Owning package(s)**: `@blend65/core` (descriptor types, registry interface),
>   `@blend65/codegen` (T1/T2 Instr emission, T3 runtime `.asm` modules, call-site
>   marshalling), `@blend65/platforms` (T4 descriptors + runtime `.asm`)
> **Created**: 2026-05-31
> **Last Updated**: 2026-05-31

---

## 1. Purpose

This document specifies the **intrinsic function system** — the compiler's model for
all built-in and platform-provided callable operations — and the **runtime-routine
ABI** that governs how hand-written assembly routines are called. Together they close
the gap between what the Blend65 language offers as built-in primitives (Ch 12) and
how the compiler generates code for them.

The v2 pain point was that each intrinsic was special-cased: ad-hoc stub functions,
no consistent typing, no uniform cost metadata, and no clear boundary between core
and platform helpers. The v3 model replaces this with a **four-tier taxonomy** (AR-28)
and a **typed descriptor registry** (AR-29) that the compiler consults uniformly for
type checking, lowering, and codegen — never special-casing an individual name.

---

## 2. Scope

**In scope:**
- Four-tier intrinsic taxonomy (T1–T4, AR-28)
- Typed descriptor registry (AR-29)
- Hybrid body strategy: TS Instr-emit for T1/T2, hand-written `.asm` for T3/T4 (AR-30)
- Import boundary: core (T1–T3) ambient, platform (T4) imported (AR-31)
- Reserved name enforcement (AR-31)
- CPU/platform conditioning and availability predicates (AR-32)
- Runtime-routine calling convention / ABI (AR-33)
- ZP argument-block sizing with core-guaranteed minimum (AR-34)
- "Crazy asm" = registered routine only (AR-35)
- End-user `extern function` deferred to FUT-011 (AR-36)
- Complete Ch 12 intrinsic catalog with tier/signature/cost classification

**Out of scope (and where it lives instead):**
- Intrinsic validation during semantic analysis → RD-04 (R99–R108)
- Intrinsic dispatch in IL lowering → RD-06 (AR-49)
- Codegen for specific IL ops (add/sub/etc.) → RD-07
- Platform plugin interface (hooks, profile) → RD-10
- Platform plugin T4 descriptor contributions → RD-10 (R30–R32)

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Four-Tier Taxonomy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Every intrinsic is classified into exactly one tier | T1 (opcode), T2 (inline/compile-time), T3 (core runtime routine), T4 (platform). No intrinsic spans tiers | AR-28 |
| R2 | **T1 — Opcode** | Maps to exactly one 6502 opcode. CPU-conditioned (e.g., `asm_wai` requires 65C02). Ambient. Examples: `asm_sei`, `asm_cli`, `asm_nop`, `asm_wai`, `asm_stp` | AR-28, Ch 12 §3 |
| R3 | **T2 — Inline / Compile-Time** | Emits a small inline `Instr` pattern OR folds to a compile-time constant. Universal (all platforms). Ambient. Examples: `peek`, `poke`, `peekw`, `pokew`, `lo`, `hi`, `sizeof`, `offsetof`, `length` | AR-28, Ch 12 §2 |
| R4 | **T3 — Core Runtime Routine** | A precompiled `.asm` module shipped with `@blend65/codegen`. Lowered as `JSR <symbol>`. Universal. Ambient. Dead-stripped when unreferenced. Examples: software `*` / `/` / `%` routines | AR-28, AR-30 |
| R5 | **T4 — Platform Runtime** | A precompiled `.asm` module shipped with `@blend65/platforms`. Platform-conditioned. **Explicitly imported** (`import { ... } from <platform>.<lib>`). Examples: `petscii()`, VIC helpers, `screen_codes()` | AR-28, AR-31 |

### 3.2 Typed Descriptor Registry

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R6 | Each intrinsic has a typed descriptor | `IntrinsicDescriptor { name, signature, tier, availability, loweringStrategy, costMetadata, clobberList }`. The compiler never special-cases an individual name — it consults the registry | AR-29 |
| R7 | Signature includes params and return type | `params: { name: string, type: Type }[]`, `returnType: Type`. The frontend type-checks calls against this signature identically for core and platform intrinsics | AR-29 |
| R8 | Availability is a predicate | `availability: (profile: PlatformProfile) => boolean`. Keyed on `profile.cpu` and/or platform identity. If `false` for the active target, calling the intrinsic is a compile-time error | AR-32 |
| R9 | Cost metadata documents cycle and byte costs | `costMetadata: { cycles: number | 'varies', bytes: number | 'varies' }`. Feeds the hover documentation in the LSP (RD-14 R23) and the build-summary annotations | AR-29, H2 |
| R10 | Clobber list declares register side effects | `clobberList: ('A' | 'X' | 'Y' | 'status')[]`. Allows the compiler to optimize around the call (vs the blanket "clobber-all" model for user functions) | AR-29, AR-33 |
| R11 | Platform packages contribute T4 descriptors | `@blend65/platforms` plugins export an array of `IntrinsicDescriptor` entries. These are merged into the global registry at compile start | AR-29, AR-18 |

### 3.3 Body Strategy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R12 | T1/T2 bodies are emitted by TypeScript as Instr patterns | The codegen stage contains TypeScript functions that emit `Instr` sequences for each T1/T2 intrinsic. No external `.asm` file needed | AR-30 |
| R13 | T3/T4 bodies are hand-written `.asm` runtime modules | Each T3/T4 routine is a `.asm` file authored by compiler/platform-package authors. The file adheres to the AR-33 ABI contract | AR-30 |
| R14 | Intrinsic bodies are never Blend65 source | No intrinsic is self-hosted. This is a hard constraint from AR-30 | AR-30 |
| R15 | T3/T4 `.asm` modules are JSR-linked | Codegen emits `JSR <symbol>` for the routine. The ACME emitter includes the referenced `.asm` module via `!source` directive | AR-30 |
| R16 | Unreferenced T3/T4 modules are dead-stripped | If no call site references a T3/T4 routine, its `.asm` module is NOT included in the output. This is critical for the 4KB Atari 7800 | AR-30 |
| R17 | Lowering strategy is part of the descriptor | `loweringStrategy: 'opcode' | 'inline' | 'fold' | 'call'`. Determines how the IL→Instr lowering handles the intrinsic | AR-29 |

### 3.4 Import Boundary & Reserved Names

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R18 | Core intrinsics (T1–T3) are ambient | Available without import. They are visible in every scope. No `import` needed | AR-31 |
| R19 | Platform intrinsics (T4) require explicit import | `import { petscii } from c64.encoding;` — T4 intrinsics are only visible when imported from a platform library | AR-31 |
| R20 | All intrinsic names are reserved | A user-defined function, variable, or constant that shadows an intrinsic name (core or platform) is a **compile-time error**. This prevents accidental shadowing | AR-31 |
| R21 | Reserved-name enforcement is in the semantic analyzer | RD-04 checks every declaration name against the intrinsic registry and emits a diagnostic if it matches a reserved name | AR-31, RD-04 |

### 3.5 CPU/Platform Conditioning

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R22 | Calling an unavailable intrinsic is a compile-time error | If `descriptor.availability(profile)` returns `false`, the semantic analyzer emits `E10xxx` with the reason (e.g., "asm_wai requires 65C02, but target CPU is NMOS 6502") | AR-32, L7 |
| R23 | The error message names the required CPU/platform | The diagnostic is actionable: it tells the developer what CPU or platform is needed and what the current target is | AR-32, L6 |
| R24 | T1 opcodes are conditioned on `profile.cpu` | `asm_wai` and `asm_stp` require `cpu: '65C02'`. All other T1 opcodes are available on all CPUs | AR-32, Ch 12 §3 |
| R25 | T4 intrinsics are conditioned on the platform | A T4 intrinsic contributed by the `c64` plugin is unavailable when targeting `a7800`. The availability predicate checks `profile.platformId` | AR-32 |

### 3.6 Runtime-Routine Calling Convention (ABI)

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R26 | The ABI is stable and documented | Hand-written `.asm` routines code against the ABI, not against SFA. The compiler marshals SFA frame slots → ABI registers/ZP at each call site | AR-33 |
| R27 | Parameters ≤ 3 scalar bytes go in A/X/Y registers | A single `byte` → A. Two bytes (e.g., `word`) → A (low), X (high). Three bytes → A, X, Y. This is the fast path | AR-33 |
| R28 | Larger/additional parameters go in the ZP arg-block | If more than 3 bytes of parameters are needed, the compiler stores them into a reserved ZP argument block before the `JSR` | AR-33, AR-34 |
| R29 | Pointer parameters use ZP pairs for indirect addressing | A pointer (for array/struct access) is passed as a 2-byte ZP pair so the routine can use `(ptr),Y` indirect-indexed addressing | AR-33 |
| R30 | Return values: byte in A, word in A(lo)/X(hi), void = nothing | The return value convention is fixed and declared per routine in the descriptor | AR-33 |
| R31 | Clobber is declared per routine | Each routine declares which registers it destroys. The compiler saves/restores any live values around the call. This is better than blanket "clobber-all" | AR-33 |
| R32 | The compiler marshals SFA → ABI at call sites | Before a `JSR`, the compiler loads parameters from their SFA frame slots into A/X/Y or the ZP arg-block. After return, it stores the result back. The `.asm` author never sees SFA addresses | AR-33 |

### 3.7 ZP Argument-Block Sizing

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R33 | ZP arg-block size is declared in the platform profile | `PlatformProfile.zpArgBlockSize: number`. The 7800's tiny ZP gets a small block; the CX16's generous ZP gets a larger one | AR-34 |
| R34 | The core ABI guarantees a minimum floor | **≥ 4 bytes** of ZP arg-block on every platform. This is the minimum a routine author can rely on without checking the profile | AR-34 |
| R35 | Exceeding the arg-block is a compile-time error | If a routine's parameter marshalling requires more ZP arg-block bytes than the profile provides, the compiler emits an `E10xxx` error | AR-34 |

### 3.8 "Crazy Asm" Boundary

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R36 | The only sanctioned way to add hand-written asm is a registered T3/T4 routine | No inline asm, no untyped escape hatch. The typed descriptor (signature + cost + clobber) is the full contract | AR-35 |
| R37 | End users cannot add their own asm routines in v3 | `extern function` is **deferred to FUT-011**. Only compiler/platform-package authors can create registered routines | AR-36 |
| R38 | When `extern` lands, it reuses the same ABI | FUT-011 will expose the AR-33/AR-34 ABI to end users. No new calling convention will be invented | AR-36 |

---

## 4. Design Detail

### 4.1 IntrinsicDescriptor

```typescript
// @blend65/core — intrinsic descriptor types

interface IntrinsicDescriptor {
  /** Intrinsic name (e.g., "peek", "asm_sei", "petscii") */
  name: string;

  /** Tier classification */
  tier: 'T1' | 'T2' | 'T3' | 'T4';

  /** Parameter and return types */
  signature: IntrinsicSignature;

  /** Is this intrinsic available on the active platform? */
  availability: (profile: PlatformProfile) => boolean;

  /** How to lower this intrinsic */
  loweringStrategy: 'opcode' | 'inline' | 'fold' | 'call';

  /** Cost metadata for documentation and hover */
  costMetadata: CostMetadata;

  /** Which registers are clobbered by this intrinsic */
  clobberList: ClobberEntry[];

  /** Human-readable description for hover/docs */
  description: string;

  /**
   * For T3/T4: the .asm module path relative to the package.
   * For T1/T2: undefined (emitted inline by codegen).
   */
  asmModulePath?: string;
}

interface IntrinsicSignature {
  params: IntrinsicParam[];
  returnType: TypeRef;
}

interface IntrinsicParam {
  name: string;
  type: TypeRef;
}

/** Type reference for intrinsic signatures */
type TypeRef = 'byte' | 'sbyte' | 'word' | 'sword' | 'bool' | 'void'
  | { kind: 'pointer'; elementType: TypeRef }
  | { kind: 'array'; elementType: TypeRef };

interface CostMetadata {
  /** Cycle count (or 'varies' for routines with data-dependent paths) */
  cycles: number | 'varies';
  /** Byte count of generated code (or 'varies') */
  bytes: number | 'varies';
  /** ZP bytes consumed (from arg-block or otherwise) */
  zpBytes: number;
}

type ClobberEntry = 'A' | 'X' | 'Y' | 'status';
```

### 4.2 Intrinsic Registry

```typescript
// @blend65/core — registry interface

interface IntrinsicRegistry {
  /** Register a descriptor (called at compile start) */
  register(descriptor: IntrinsicDescriptor): void;

  /** Look up by name */
  get(name: string): IntrinsicDescriptor | undefined;

  /** Check if a name is reserved (any registered intrinsic) */
  isReserved(name: string): boolean;

  /** Get all descriptors available on the active platform */
  getAvailable(profile: PlatformProfile): IntrinsicDescriptor[];

  /** Get all registered descriptors (all platforms) */
  getAll(): IntrinsicDescriptor[];
}

/** Create the registry and populate it with core intrinsics */
function createIntrinsicRegistry(): IntrinsicRegistry;
```

### 4.3 Core Intrinsic Catalog (Ch 12)

| Name | Tier | Signature | Lowering | Cost | Available |
|------|------|-----------|----------|------|-----------|
| `peek` | T2 | `(addr: word): byte` | inline `LDA abs` | 4 cyc, 3 bytes | all |
| `poke` | T2 | `(addr: word, val: byte): void` | inline `LDA # / STA abs` | 6 cyc, 5 bytes | all |
| `peekw` | T2 | `(addr: word): word` | inline `LDA abs / LDX abs+1` | 8 cyc, 6 bytes | all |
| `pokew` | T2 | `(addr: word, val: word): void` | inline `LDA # / STA abs / LDA # / STA abs+1` | 12 cyc, 10 bytes | all |
| `lo` | T2 | `(val: word): byte` | fold or `AND #$FF` | 0–2 cyc | all |
| `hi` | T2 | `(val: word): byte` | fold or shift/extract | 0–4 cyc | all |
| `sizeof` | T2 | `<T>(): word` | fold to constant | 0 cyc, 0 bytes | all |
| `offsetof` | T2 | `<T>(field: string): word` | fold to constant | 0 cyc, 0 bytes | all |
| `length` | T2 | `<T>(): word` | fold to constant | 0 cyc, 0 bytes | all |
| `asm_sei` | T1 | `(): void` | opcode `SEI` | 2 cyc, 1 byte | all |
| `asm_cli` | T1 | `(): void` | opcode `CLI` | 2 cyc, 1 byte | all |
| `asm_nop` | T1 | `(): void` | opcode `NOP` | 2 cyc, 1 byte | all |
| `asm_wai` | T1 | `(): void` | opcode `WAI` | varies | 65C02 only |
| `asm_stp` | T1 | `(): void` | opcode `STP` | — | 65C02 only |
| `mul8` | T3 | `(a: byte, b: byte): word` | call `JSR __rt_mul8` | ~80 cyc, ~40 bytes | all |
| `div8` | T3 | `(a: byte, b: byte): byte` | call `JSR __rt_div8` | ~100 cyc, ~50 bytes | all |
| `mod8` | T3 | `(a: byte, b: byte): byte` | call `JSR __rt_mod8` | ~100 cyc, ~50 bytes | all |
| `mul16` | T3 | `(a: word, b: word): word` | call `JSR __rt_mul16` | ~200 cyc, ~80 bytes | all |

> **Note:** The operator `*`/`/`/`%` in expressions dispatches to these T3 routines
> when the compiler cannot use a cheaper strategy (shift, constant multiply, etc.).
> See RD-07 multiply three-tier strategy.

### 4.4 Runtime-Routine ABI — Call-Site Marshalling

```
Given: T3 routine `mul8(a: byte, b: byte): word`
  Descriptor: params=[{a:byte}, {b:byte}], return=word, clobber=[A,X,status]
  ABI: a→A, b→X, return lo→A, hi→X

Call site in Blend65:
  let result: word = a * b;   // compiles to mul8(a, b)

Generated Instr sequence:
  LDA __frame_a         ; load 'a' from its SFA slot → A
  LDX __frame_b         ; load 'b' from its SFA slot → X
  JSR __rt_mul8          ; call the runtime routine
  STA __frame_result     ; store result low byte from A
  STX __frame_result+1   ; store result high byte from X
```

### 4.5 ZP Argument-Block Layout

For routines that need more than 3 bytes of parameters:

```
ZP arg-block (example: 8 bytes starting at $02):
  $02: arg0_lo   ← first pointer low byte
  $03: arg0_hi   ← first pointer high byte
  $04: arg1_lo   ← second pointer low byte
  $05: arg1_hi   ← second pointer high byte
  $06: arg2      ← scalar param
  $07: arg3      ← scalar param
  $08: (unused)
  $09: (unused)
```

The compiler generates marshalling code before the `JSR`:
```
  LDA #<__frame_array   ; pointer to array → ZP pair
  STA $02
  LDA #>__frame_array
  STA $03
  LDA __frame_index     ; scalar → ZP byte
  STA $06
  JSR __rt_routine
```

### 4.6 `.asm` Runtime Module Convention

```asm
; @blend65/codegen/runtime/mul8.asm
; T3 runtime routine: unsigned 8-bit multiply
;
; ABI: A = multiplicand, X = multiplier
; Returns: A = result low byte, X = result high byte
; Clobbers: A, X, status
; Cost: ~80 cycles, 38 bytes

__rt_mul8:
    ; ... hand-written multiply algorithm ...
    RTS
```

Each `.asm` file:
- Starts with an ABI comment block (params, return, clobber, cost)
- Exports exactly one entry-point label (`__rt_<name>`)
- Ends with `RTS`
- Is self-contained (no external dependencies beyond ZP arg-block addresses)
- Is tested with dedicated emulator-tier tests (RD-12)

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-04 | **Consumer**: semantic analysis validates intrinsic calls against the typed descriptor (signature, availability, reserved names) |
| RD-06 | **Consumer**: IL lowering dispatches on the descriptor's `loweringStrategy` — fold, inline load/store, or call (AR-49) |
| RD-07 | **Consumer**: codegen emits `Instr` sequences for T1/T2 (from TS functions keyed by descriptor) and `JSR` + marshalling for T3/T4 |
| RD-09 | **Consumer**: ACME emitter includes referenced T3/T4 `.asm` modules via `!source`; dead-strips unreferenced ones |
| RD-10 | **Producer**: platform plugins contribute T4 descriptor arrays and ship `.asm` runtime modules |
| RD-11 | **Consumer**: cost metadata feeds the resource report; availability errors produce `E10xxx` diagnostics |
| RD-14 | **Consumer**: the LSP uses the descriptor registry for completion (R20), hover (R23), and signature help |
| RD-15 | **Implicit**: the intrinsic registry is populated during `compile()` / `build()` |

---

## 6. Acceptance Criteria

- [ ] AC-01: Every Ch 12 intrinsic has an `IntrinsicDescriptor` in the registry with correct tier, signature, availability, and cost
- [ ] AC-02: The frontend type-checks intrinsic calls against the descriptor signature — wrong arg count/type produces `E10xxx`
- [ ] AC-03: A user-defined function shadowing a reserved intrinsic name produces a compile-time error
- [ ] AC-04: Calling `asm_wai` on an NMOS 6502 target produces a compile-time error naming the required CPU
- [ ] AC-05: T4 intrinsics are unavailable without an explicit import — using `petscii()` without `import` is an error
- [ ] AC-06: T4 intrinsics from a different platform are unavailable — `petscii()` on `a7800` is an error
- [ ] AC-07: T1 opcodes lower to exactly one `Instr` with the correct opcode
- [ ] AC-08: T2 `peek`/`poke` lower to inline `LDA`/`STA` sequences (not `JSR`)
- [ ] AC-09: T2 `sizeof`/`offsetof`/`length` fold to compile-time constants (no runtime code)
- [ ] AC-10: T3 `mul8` lowers to a `JSR __rt_mul8` with ABI-correct marshalling
- [ ] AC-11: Unreferenced T3/T4 `.asm` modules are NOT included in the output
- [ ] AC-12: The ZP arg-block minimum floor (≥ 4 bytes) is enforced across all platform profiles
- [ ] AC-13: Exceeding the ZP arg-block capacity produces a compile-time error
- [ ] AC-14: Hand-written `.asm` runtime modules pass emulator-tier tests verifying correct results
- [ ] AC-15: The descriptor registry is populated from core + platform contributions before semantic analysis runs
- [ ] AC-16: Platform plugins can contribute T4 descriptors via the `PlatformPlugin` interface
- [ ] AC-17: No individual intrinsic name is special-cased in the compiler — all dispatch through the registry
- [ ] AC-18: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
