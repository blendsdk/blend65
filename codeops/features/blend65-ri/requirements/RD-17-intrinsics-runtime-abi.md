# RD-17: Intrinsic Functions & Runtime-Routine ABI

> **Status**: 🟢 Authored — ✅ Preflighted 2026-07-02 (13 findings resolved; see `00-preflight-report.md`)
> **MVP Phase**: A
> **Depends On**: RD-04, RD-10
> **Implements**: `spec-v3.0` Ch 12 (Intrinsic Functions); AR-28..AR-36, AR-97..AR-101 (runtime, preflight 2026-07-02); plus RD-04's deferred intrinsic rules R95–R100/R19/R59
> **Owning package(s)**: `@blend65/core` (descriptor types, registry interface),
>   `@blend65/codegen` (T1/T2 Instr emission, T3 runtime `.asm` modules, call-site
>   marshalling), `@blend65/platforms` (T4 descriptors + runtime `.asm`)
> **Created**: 2026-05-31
> **Last Updated**: 2026-07-02 (preflight PF-001..PF-013 fixes applied; runtime AR-97..AR-101 logged)

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
- **Semantic-analysis validation of intrinsic calls** — this RD *implements* RD-04's
  deferred intrinsic rules (R95–R100, R19, R59): signature/arity/type checks
  (E10040/E10041), reserved-name shadowing (E10101), availability errors (E10043),
  import-boundary errors. RD-04 shipped as a passthrough skeleton with these rules
  explicitly deferred to RD-17 (see its deferred-semantics ledger); RD-04 remains the
  rule-*specification* source (PF-001)

**Out of scope (and where it lives instead):**
- Intrinsic validation *rule definitions* → RD-04 (R95–R100; implemented here, see In scope)
- Intrinsic dispatch in IL lowering → RD-06 (AR-49)
- Codegen for specific IL ops (add/sub/etc.) → RD-07
- Platform plugin interface (hooks, profile) → RD-10
- Platform plugin interface/contract for T4 descriptor contributions → RD-10 (R23–R26);
  this RD populates the actual descriptors (RD-10 AC-16 shipped deferred, `intrinsics: []`)

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Four-Tier Taxonomy

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Every intrinsic is classified into exactly one tier | T1 (opcode), T2 (inline/compile-time), T3 (core runtime routine), T4 (platform). No intrinsic spans tiers | AR-28 |
| R2 | **T1 — Opcode** | Maps to exactly one 6502 opcode. CPU-conditioned (e.g., `asm_wai` requires 65C02). Ambient. Covers **all 13** Ch 12 §2.2 CPU-control intrinsics plus `asm_wai` (65C02-gated per `grammar.ebnf` + CX16 appendix). `asm_stp` is **dropped** in v3 — it has no frozen-spec basis (AR-99). Implementation note: `asm_wai` must be added to `RESERVED_BUILTINS` (its size-locked tests grow to 23) and `WAI` to `W65C02_OPCODES` | AR-28, AR-99, Ch 12 §2.2 |
| R3 | **T2 — Inline / Compile-Time** | Emits a small inline `Instr` pattern OR folds to a compile-time constant. Universal (all platforms). Ambient. Examples: `peek`, `poke`, `peekw`, `pokew`, `lo`, `hi`, `sizeof`, `offsetof`, `length` | AR-28, Ch 12 §3 |
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
| R15 | T3/T4 `.asm` modules are JSR-linked | Codegen emits `JSR <symbol>` for the routine. The emitter **textually embeds** each referenced module's `.asm` text into the single generated `.asm` file — preserving RD-09's single-file contract (RD-09 R4); no `!source`/multi-file output | AR-30, AR-100 |
| R16 | Unreferenced T3/T4 modules are dead-stripped | If no call site references a T3/T4 routine, its `.asm` module is simply NOT embedded in the output. This is critical for the 4KB Atari 7800 | AR-30, AR-100 |
| R17 | Lowering strategy is part of the descriptor | `loweringStrategy: 'opcode' | 'inline' | 'fold' | 'call'`. Determines how the IL→Instr lowering handles the intrinsic. Tier mapping: T1→`'opcode'`, T2→`'inline'` or `'fold'`, T3/T4→`'call'` — the normalized form of AR-49's "dispatch on tier" | AR-29, AR-49 |

### 3.4 Import Boundary & Reserved Names

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R18 | Core intrinsics (T1–T3) are ambient | Available without import. They are visible in every scope. No `import` needed | AR-31 |
| R19 | Platform intrinsics (T4) require explicit import | `import { petscii } from c64;` — one pseudo-module per platform, named by the platform's single grammar-legal identifier (dotted paths like `c64.encoding` are NOT expressible in the frozen import grammar, `grammar.ebnf` §import_stmt). T4 intrinsics are only visible when imported from their platform module | AR-31, AR-97 |
| R20 | All intrinsic names are reserved | A user-defined function, variable, or constant that shadows an intrinsic name (core or platform) is a **compile-time error** (`E10101` NameShadows) | AR-31, RD-04 R100 |
| R21 | Reserved-name enforcement is in the semantic analyzer | The semantic analyzer (rules from RD-04 R19/R100, implemented by this RD) checks every declaration name against the intrinsic registry and emits `E10101` if it matches a reserved name. The provisional E10212 reservation in the diag-code registry comment is retired | AR-31, RD-04 R100 |

### 3.5 CPU/Platform Conditioning

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R22 | Calling an unavailable intrinsic is a compile-time error | If `descriptor.availability(profile)` returns `false`, the semantic analyzer emits **`E10043` (IntrinsicUnavailable)** with the reason (e.g., "asm_wai requires 65C02, but target CPU is NMOS 6502"). This assigns the concrete code AR-32 required at RD-17 authoring (next free in the E10040-E10042 intrinsic band) | AR-32, L7, PF-009 |
| R23 | The error message names the required CPU/platform | The diagnostic is actionable: it tells the developer what CPU or platform is needed and what the current target is | AR-32, L6 |
| R24 | T1 opcodes are conditioned on `profile.cpu` | `asm_wai` requires `cpu: 'wdc65c02'` (the shipped `CpuVariant` spelling, decision D2). All other T1 opcodes are available on all CPUs. (`asm_stp` dropped — AR-99) | AR-32, AR-99, grammar.ebnf |
| R25 | T4 intrinsics are conditioned on the platform | A T4 intrinsic contributed by the `c64` plugin is unavailable when targeting `a7800`. The availability predicate checks `profile.platformId` | AR-32 |

### 3.6 Runtime-Routine Calling Convention (ABI)

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R26 | The ABI is stable and documented | Hand-written `.asm` routines code against the ABI, not against SFA. The compiler marshals SFA frame slots → ABI registers/ZP at each call site | AR-33 |
| R27 | Parameters ≤ 3 scalar bytes go in A/X/Y registers | A single `byte` → A. Two bytes (e.g., `word`) → A (low), X (high). Three bytes → A, X, Y. This is the fast path | AR-33 |
| R28 | Larger/additional parameters go in the ZP arg-block | If more than 3 bytes of parameters are needed, the compiler stores them into a reserved ZP argument block before the `JSR` | AR-33, AR-34 |
| R29 | Pointer parameters use ZP pairs for indirect addressing | A pointer (for array/struct access) is passed as a 2-byte ZP pair so the routine can use `(ptr),Y` indirect-indexed addressing | AR-33 |
| R30 | Return values: byte in A, word in A(lo)/X(hi), void = nothing | The return value convention is fixed and declared per routine in the descriptor. Fused div routines return **two** values: `__rt_div8` quotient→A, remainder→X; `__rt_div16` quotient→A(lo)/X(hi), remainder→first 2 bytes of the ZP arg-block | AR-33, AR-98 |
| R31 | Clobber is declared per routine | Each routine declares which registers it destroys. The compiler saves/restores any live values around the call. This is better than blanket "clobber-all" | AR-33 |
| R32 | The compiler marshals SFA → ABI at call sites | Before a `JSR`, the compiler loads parameters from their SFA frame slots into A/X/Y or the ZP arg-block. After return, it stores the result back. The `.asm` author never sees SFA addresses | AR-33 |

### 3.7 ZP Argument-Block Sizing

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R33 | ZP arg-block size is declared in the platform profile | `PlatformProfile.zpArgBlockSize: number` (the canonical RD-10 field — the **single authoritative declaration**; all 5 shipped profiles = 8). The 7800's tiny ZP gets a small block; the CX16's generous ZP gets a larger one. The interim frontend `zpArgBlockMin` (semantics profile, default 0) is reconciled — raised to the floor or retired — when this RD wires marshalling into the SFA path | AR-34, PF-011 |
| R34 | The core ABI guarantees a minimum floor | **≥ 4 bytes** of ZP arg-block on every platform; enforced in `PlatformPlugin.validateProfile()`. This is the minimum a routine author can rely on without checking the profile | AR-34, PF-011 |
| R35 | Exceeding the arg-block is a compile-time error | If a routine's parameter marshalling requires more ZP arg-block bytes than the profile provides, the compiler emits **`E10044` (ZpArgBlockExceeded)** | AR-34, PF-009 |

### 3.8 "Crazy Asm" Boundary

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R36 | The only sanctioned way to add hand-written asm is a registered T3/T4 routine | No inline asm, no untyped escape hatch. The typed descriptor (signature + cost + clobber) is the full contract | AR-35 |
| R37 | End users cannot add their own asm routines in v3 | `extern function` is **deferred to FUT-011**. Only compiler/platform-package authors can create registered routines | AR-36 |
| R38 | When `extern` lands, it reuses the same ABI | FUT-011 will expose the AR-33/AR-34 ABI to end users. No new calling convention will be invented | AR-36 |

### 3.9 Deferred Surface & Registry-Adjacent Checks

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R39 | Non-constant T2 addresses are deferred in this RD | A non-compile-time-constant address argument to `peek`/`poke`/`peekw`/`pokew` produces **`E10045` (NonConstantIntrinsicAddress)** — a proper diagnostic, replacing today's ICE (`lower.ts` `addressLocation`). Indirect `(zp),Y` lowering for runtime-computed addresses is a later slice | AR-101, PF-012 |
| R40 | Ch 12 §4 warnings ship with the validation pass | `W10120` (`asm_sed` without a matching `asm_cld`) and `W10121` (`asm_brk` present in a release build) are implemented alongside the intrinsic validation this RD delivers | Ch 12 §4, PF-003 |

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

/**
 * Type reference for intrinsic signatures.
 * 'boolean' matches the semantic type system's spelling (PrimitiveName in
 * core/semantics/type.ts). The 'pointer' kind is the ABI-level marshalling view
 * (R29) only — the frontend type-checks calls against semantic array/struct
 * types; no user-facing pointer type exists in the language.
 */
type TypeRef = 'byte' | 'sbyte' | 'word' | 'sword' | 'boolean' | 'void'
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

> **Migration note (PF-010):** this canonical descriptor replaces **two** shipped
> placeholders: `packages/core/src/platform/platform-plugin.ts`
> (`type IntrinsicDescriptor = unknown`, marked DEFERRED(RD-17)) and
> `packages/codegen/src/il/intrinsic-descriptor.ts`
> (`{ name, tier?: number, clobbers? }`, embedded in the IL `intrinsic` op in
> `il/instruction.ts`). Both migrate to this type; the IL placeholder's numeric
> `tier` becomes the `'T1' | 'T2' | 'T3' | 'T4'` string union.

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

Complete user-visible catalog — all 22 Ch 12 intrinsics (13 CPU-control + 9 memory,
matching `RESERVED_BUILTINS`) plus the 65C02-gated `asm_wai` (PF-003).

| Name | Tier | Signature | Lowering | Cost (Ch 12) | Available |
|------|------|-----------|----------|--------------|-----------|
| `peek` | T2 | `(addr: word): byte` | inline `LDA abs` | 4 cyc, 3 bytes | all |
| `poke` | T2 | `(addr: word, val: byte): void` | inline `STA abs` (+ operand load) | 4 cyc, 3 bytes | all |
| `peekw` | T2 | `(addr: word): word` | inline `LDA abs / LDX abs+1` | 8 cyc, 6 bytes | all |
| `pokew` | T2 | `(addr: word, val: word): void` | inline `STA abs / STA abs+1` (+ operand loads) | 8 cyc, 6 bytes | all |
| `lo` | T2 | `(val: word): byte` | fold or `AND #$FF` | 0–2 cyc | all |
| `hi` | T2 | `(val: word): byte` | fold or shift/extract | 0–4 cyc | all |
| `sizeof` | T2 | `(type): byte` | fold to constant | 0 cyc, 0 bytes | all |
| `offsetof` | T2 | `(type, field): byte` | fold to constant | 0 cyc, 0 bytes | all |
| `length` | T2 | `(array): byte \| word` | fold to constant | 0 cyc, 0 bytes | all |
| `asm_sei` | T1 | `(): void` | opcode `SEI` | 2 cyc, 1 byte | all |
| `asm_cli` | T1 | `(): void` | opcode `CLI` | 2 cyc, 1 byte | all |
| `asm_pha` | T1 | `(): void` | opcode `PHA` | 3 cyc, 1 byte | all |
| `asm_pla` | T1 | `(): void` | opcode `PLA` | 4 cyc, 1 byte | all |
| `asm_php` | T1 | `(): void` | opcode `PHP` | 3 cyc, 1 byte | all |
| `asm_plp` | T1 | `(): void` | opcode `PLP` | 4 cyc, 1 byte | all |
| `asm_clc` | T1 | `(): void` | opcode `CLC` | 2 cyc, 1 byte | all |
| `asm_sec` | T1 | `(): void` | opcode `SEC` | 2 cyc, 1 byte | all |
| `asm_cld` | T1 | `(): void` | opcode `CLD` | 2 cyc, 1 byte | all |
| `asm_sed` | T1 | `(): void` | opcode `SED` | 2 cyc, 1 byte | all |
| `asm_clv` | T1 | `(): void` | opcode `CLV` | 2 cyc, 1 byte | all |
| `asm_nop` | T1 | `(): void` | opcode `NOP` | 2 cyc, 1 byte | all |
| `asm_brk` | T1 | `(): void` | opcode `BRK` | 7 cyc, 1 byte | all |
| `asm_wai` | T1 | `(): void` | opcode `WAI` | varies (halts until IRQ) | 65C02 only |

> **Cost figures** follow frozen Ch 12 §3.1 (they count the memory-access
> instructions; immediate operand loads add ~2 cycles / 2 bytes each — surfaced as a
> note in the hover docs, PF-005). `sizeof`/`offsetof` return `byte` per Ch 12 §3.3;
> if a ≥256-byte type is ever hit in practice, raise a runtime AR then (PF-005).
> `length` folds to `byte` or `word` by array size (Ch 12 §3.3). Signatures use the
> parser's actual model: `type` is a type argument, `field` a field identifier
> (`IntrinsicCallExprNode.typeArg`/`.fieldArg`) — the language has no generics and no
> `string` type.

#### Internal T3 runtime routines (operator-backing; not user-callable)

| Symbol | Signature | Lowering | Returns | Cost | Available |
|--------|-----------|----------|---------|------|-----------|
| `__rt_mul8` | `(a: byte, b: byte): word` | `JSR __rt_mul8` | product A(lo)/X(hi) | ~80 cyc, ~40 bytes | all |
| `__rt_mul16` | `(a: word, b: word): word` | `JSR __rt_mul16` | product A(lo)/X(hi) | ~200 cyc, ~80 bytes | all |
| `__rt_div8` | `(a: byte, b: byte)` | `JSR __rt_div8` | quotient→A, remainder→X | ~100 cyc, ~50 bytes | all |
| `__rt_div16` | `(a: word, b: word)` | `JSR __rt_div16` | quotient→A(lo)/X(hi), remainder→ZP arg-block | ~250 cyc, ~90 bytes | all |

> **These four symbols back the `*` / `/` / `%` operators** (spec Ch 04 §3.2; RD-07
> R21/R22 three-tier strategy) and are exactly the call sites shipped codegen already
> emits (`translate.ts`). They are **not** user-callable intrinsic names, are not in
> `RESERVED_BUILTINS`, and have no Ch 12 rows. There are **no separate `mod`
> routines**: `%` consumes the remainder output of the div routines (AR-98). The
> existing per-platform `runtimeModules` stubs (mul8/mul16/div8/div16 in all five
> plugins) migrate to codegen-owned T3 modules per R4 (AR-98).

### 4.4 Runtime-Routine ABI — Call-Site Marshalling

```
Given: T3 routine `__rt_mul8` — (a: byte, b: byte): word
  Descriptor: params=[{a:byte}, {b:byte}], return=word, clobber=[A,X,status]
  ABI: a→A, b→X, return lo→A, hi→X

Call site in Blend65:
  let result: word = a * b;   // lowers to JSR __rt_mul8 (operator-backing, AR-98)

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
| RD-04 | **Rule source**: defines the intrinsic validation rules (R95–R100, R19, R59). RD-04 shipped as a passthrough skeleton with these rules deferred to RD-17 — **this RD implements them** (signature, availability, reserved names) |
| RD-06 | **Consumer**: IL lowering dispatches on the descriptor's `loweringStrategy` — fold, inline load/store, or call (AR-49) |
| RD-07 | **Consumer**: codegen emits `Instr` sequences for T1/T2 (from TS functions keyed by descriptor) and `JSR` + marshalling for T3/T4 |
| RD-09 | **Consumer**: referenced T3/T4 `.asm` modules are textually embedded into the single RD-09 `.asm` output (single-file contract R4 preserved); unreferenced modules are not embedded (AR-100) |
| RD-10 | **Producer**: platform plugins contribute T4 descriptor arrays and ship `.asm` runtime modules |
| RD-11 | **Consumer**: cost metadata feeds the resource report; availability errors produce `E10043`, arg-block overflow `E10044`, non-constant addresses `E10045` |
| RD-14 | **Consumer**: the LSP uses the descriptor registry for completion (R20), hover (R23), and signature help |
| RD-15 | **Implicit**: the intrinsic registry is populated during `compile()` / `build()` |

---

## 6. Acceptance Criteria

- [ ] AC-01: Every Ch 12 intrinsic has an `IntrinsicDescriptor` in the registry with correct tier, signature, availability, and cost
- [ ] AC-02: The frontend type-checks intrinsic calls against the descriptor signature — wrong arg count/type produces `E10040`/`E10041`
- [ ] AC-03: A user-defined function shadowing a reserved intrinsic name produces a compile-time error (`E10101`)
- [ ] AC-04: Calling `asm_wai` on an NMOS 6502 target produces `E10043` naming the required CPU
- [ ] AC-05: T4 intrinsics are unavailable without an explicit import — using `petscii()` without `import` is an error
- [ ] AC-06: T4 intrinsics from a different platform are unavailable — `petscii()` on `a7800` is an error
- [ ] AC-07: T1 opcodes lower to exactly one `Instr` with the correct opcode
- [ ] AC-08: T2 `peek`/`poke` lower to inline `LDA`/`STA` sequences (not `JSR`) for compile-time-constant addresses; a non-constant address produces `E10045` (R39), not an ICE
- [ ] AC-09: T2 `sizeof`/`offsetof`/`length` fold to compile-time constants (no runtime code)
- [ ] AC-10: `*` on bytes lowers to `JSR __rt_mul8` with ABI-correct marshalling (both operands, per AR-33 — replacing the shipped left-only stub)
- [ ] AC-11: Unreferenced T3/T4 `.asm` modules are NOT included in the output
- [ ] AC-12: The ZP arg-block minimum floor (≥ 4 bytes) is enforced across all platform profiles
- [ ] AC-13: Exceeding the ZP arg-block capacity produces `E10044`
- [ ] AC-14: Hand-written `.asm` runtime modules pass emulator-tier tests verifying correct results
- [ ] AC-15: The descriptor registry is populated from core + platform contributions before semantic analysis runs
- [ ] AC-16: Platform plugins can contribute T4 descriptors via the `PlatformPlugin` interface
- [ ] AC-17: No individual intrinsic name is special-cased in the compiler — all dispatch through the registry
- [ ] AC-18: All decisions trace to an `AR-NN` or a frozen spec section
- [ ] AC-19: Every runtime-routine symbol shipped codegen emits (`__rt_mul8`, `__rt_mul16`, `__rt_div8`, `__rt_div16`) has a corresponding `.asm` module body — a program using `*`, `/`, or `%` on byte and word operands assembles with no unresolved symbols

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

None.
