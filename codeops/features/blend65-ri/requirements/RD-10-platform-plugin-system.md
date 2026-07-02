# RD-10: Platform Plugin System

> **Status**: 🔵 Implemented (slice — see Implementation Status below)
> **MVP Phase**: A
> **Depends On**: RD-01
> **Implements**: `spec-v3.0` Ch 15 (Platform Profile Contract), all 5 platform
>   appendices (c64, c64u, cx16, a800xl, a7800); platform model per AR-18
> **Owning package(s)**: `@blend65/platforms` (plugin implementations),
>   `@blend65/core` (plugin interface + profile types)
> **Created**: 2026-05-31
> **Last Updated**: 2026-06-09

---

## Implementation Status (2026-06-09)

The RD-10 **slice** is implemented per `plans/rd-10-platform-plugin-system/` (decision
D1). **Delivered:**

- `@blend65/core/platform` subpath: canonical `PlatformProfile`/`PlatformPlugin` + hook
  types, `validateProfileFields`, and the relocated pure-data Instr/stream model (D6/D7/D8).
- `@blend65/platforms`: the full `c64` plugin with bespoke, golden-tested codegen hooks
  (preamble/shim/output-directive/PETSCII encode/termination/validate), the static
  `PLATFORM_REGISTRY` + `loadPlatform` + `DEFAULT_PLATFORM`, and the four remaining
  platform profiles (`c64u`, `cx16`, `a800xl`, `a7800`) with profile data + `validateProfile`,
  whose codegen hooks delegate to the shared C64-style bodies (D4).

**Deferred (carried by later RDs):**

- Intrinsic descriptors ship as `intrinsics: []` and the `.asm` runtime bodies are
  metadata-only — RD-17 (D1).
- Bespoke non-MVP codegen bodies (ATASCII/ASCII encoders, XEX/`.a78` preambles) — they
  currently reuse the shared C64-style default (D4).
- Driver wiring of `loadPlatform`/profile budgets/output directives — RD-15/16/09 (D1).


---

## 1. Purpose

This document specifies the **platform plugin system** — the architecture that allows
the Blend65 compiler to target multiple 6502-based platforms without hardcoding any
platform-specific details in the core compiler. Each target platform is implemented as
a **plugin**: a combination of data (profile values from Ch 15 §3) and behavior hooks
(codegen strategy callbacks from AR-18).

The plugin system is the mechanism behind Language Guard rule P3 ("no platform
assumptions in core"). The core compiler never references a specific memory address,
hardware chip, character encoding, or binary format — all such details are provided by
the active platform plugin. When the developer specifies `--platform c64` (or sets
`"platform": "c64"` in `blend65.json`), the compiler loads the `c64` plugin and delegates
all platform-specific decisions to it.

---

## 2. Scope

**In scope:**

- `PlatformPlugin` interface: the contract every platform must implement
- `PlatformProfile` data type: all Ch 15 §3 required/optional fields
- Codegen hooks: startup-stub emission, binary-format selection, character encoding,
  string encoding, shim-variant rendering (AR-64/65/69)
- Plugin registration: how plugins are discovered and loaded
- Built-in plugins: c64 (MVP), c64u, cx16, a800xl, a7800 (per AR-37)
- T4 intrinsic registry contributions from platform plugins (AR-28/29)
- Runtime-routine `.asm` modules shipped per plugin (AR-30)
- ZP arg-block sizing per profile (AR-34)
- Platform-specific warnings and resource budgets
- CPU variant declaration (NMOS 6502 vs 65C02)

**Out of scope (and where it lives instead):**

- Core compiler pipeline (lexer, parser, semantic, IL, codegen) → RD-02..RD-07
- ACME emitter and assembler invocation → RD-09
- Intrinsic descriptor registry and ABI definition → RD-17
- Diagnostics engine → RD-11
- Test harness emulator drivers → RD-12
- CLI flag wiring → RD-15
- `blend65.json` platform selection → RD-16

> **Traceability rule:** Every decision below must cite the Ambiguity Register entry
> (`AR-NN`, in `00-ambiguity-register.md`) that resolved it, or the frozen spec section
> it implements. No decision may be invented here — discovery is closed.

---

## 3. Decisions & Requirements

### 3.1 Plugin Architecture

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R1 | Platforms are plugins (data + codegen-strategy hooks) | Not data-only config files — plugins provide executable hooks for startup emission, binary wrapping, string encoding, and other behavior that varies per platform. This is the AR-18 decision | AR-18 |
| R2 | The plugin interface is defined in `@blend65/core` | The `PlatformPlugin` interface and `PlatformProfile` type are in core so that both `@blend65/frontend` (for budget checks) and `@blend65/codegen` (for codegen hooks) can consume them without a circular dependency | AR-20 |
| R3 | Plugin implementations live in `@blend65/platforms` | One sub-module per platform (e.g., `platforms/c64.ts`, `platforms/cx16.ts`). The package exports a registry of all built-in plugins | AR-20 |
| R4 | No platform logic is hardcoded in core compiler packages | The core compiler (frontend, codegen, compiler) never references any platform-specific address, byte value, chip name, or encoding. All such data comes through the plugin interface | P3 |
| R5 | Plugins are loaded by platform ID string | The compiler receives a platform ID (e.g., `"c64"`, `"cx16"`) from CLI or config and looks up the matching plugin from the registry | Design |

### 3.2 Platform Profile (Data)

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R6 | Every plugin provides a `PlatformProfile` data record | The profile contains all required fields from Ch 15 §3.1 (memory map, resource budgets, output format) plus optional fields from §3.2 (encoding, embed formats, warnings) | Ch 15 §3 |
| R7 | Memory map: `code_start`, `code_end`, `data_start`, `data_end`, `ram_start`, `ram_end`, `zp_start`, `zp_end`, `stack_reserve` | All word/byte values defining the platform's memory layout | Ch 15 §3.1 |
| R8 | Resource budgets: `max_binary_size`, `max_ram`, `max_zp`, `stack_budget` | Used by RD-05 (pre-ACME budget check) and RD-09 (post-ACME binary check) | Ch 15 §3.1 |
| R9 | Output format: `output_format`, `load_address` | `output_format` selects the ACME writer format (`prg`/`bin`/`rom`/`xex`/`a78`). `load_address` is the binary's starting address | Ch 15 §3.1 |
| R10 | CPU variant: `cpu` | `'nmos6502'` or `'65c02'`. Determines the legal opcode+mode table for CPU validation (AR-58) and which peephole rules apply (RD-08) | AR-58 |
| R11 | Character encoding: `default_encoding`, `screen_encoding` | Optional. Defines how string/char literals are encoded for this platform (PETSCII for C64, ATASCII for Atari, ASCII for CX16) | Ch 15 §3.2 |
| R12 | Embed format handlers: `embed_formats` | Optional map of file extension → format handler name. Powers `embed()` (Ch 13) | Ch 15 §3.2 |
| R13 | Platform-specific warning thresholds: `warn_frame_size`, `warn_array_size` | Optional. Feed warnings W10030/W10191 | Ch 15 §3.2 |
| R14 | ZP arg-block size: `zp_arg_block_size` | Profile-declared with a core-guaranteed minimum. Defines the reserved ZP region for T3/T4 runtime-routine argument passing | AR-34 |
| R15 | Clock speed: `clock_mhz`, `cycles_per_frame` | Optional informational fields for cycle-timing documentation and future profiling | Ch 15 §3 |

### 3.3 Codegen Hooks (Behavior)

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R16 | `emitPreamble()` → produces the platform preamble as `StreamEntry[]` | The hook emits the `!to` directive, origin, BASIC stub (or equivalent), and startup-shim entries. Called once per build, before function code | AR-64 |
| R17 | `emitStartupShim(variant)` → produces the startup shim as `StreamEntry[]` | Three variants: `terminating` (the default — returns to OS/BASIC), `non-terminating` (falls through / `JMP *`), `bare` (no shim). Core selects the variant from CFG analysis of `main()` (AR-69); the plugin renders the platform-specific implementation | AR-69 |
| R18 | `getOutputDirective(projectName)` → returns the ACME `!to` directive | Returns `{ kind: 'outputFile', name: '<name>.<ext>', format: '<fmt>' }` where `ext` and `fmt` come from the profile's `output_format` | AR-65 |
| R19 | `encodeString(text)` → encodes a string literal to platform bytes | Converts source characters to the platform's character encoding. C64 → PETSCII; Atari → ATASCII; CX16 → ASCII/PETSCII. Returns `number[]` | Ch 15 §3.2 |
| R20 | `encodeChar(char)` → encodes a single character to a platform byte | Single-character version of `encodeString`. Returns `number` | Ch 15 §3.2 |
| R21 | `getMainTerminationPolicy()` → describes how `main()` can terminate | Returns `{ canReturn: boolean, warningOnReturn?: string }`. On a7800, `main` cannot return (game loop is non-terminating); returning `main` emits a warning (AR-69) | AR-69 |
| R22 | `validateProfile()` → self-check for profile consistency | Called at startup. Validates that profile fields are internally consistent (e.g., `zp_start <= zp_end`, `max_zp = zp_end - zp_start + 1`, `code_start < code_end`). Returns validation errors if inconsistent | Design |

### 3.4 T4 Intrinsic Contributions

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R23 | Platform plugins contribute T4 intrinsic descriptor entries | Each plugin provides a list of `IntrinsicDescriptor` records for its platform-specific intrinsics. These are merged into the compiler's intrinsic registry during plugin loading | AR-28, AR-29 |
| R24 | T4 intrinsics are accessed via explicit import | `import { setIRQ } from c64;` — T4 intrinsics are not ambient. One pseudo-module per platform, named by the platform's single identifier (dotted paths like `c64.system` are not expressible in the frozen import grammar — corrected by AR-97, RD-17 preflight 2026-07-02) | AR-31, AR-97 |
| R25 | T4 intrinsic descriptors follow the same format as T1–T3 | Name, signature (params + return type), tier (T4), availability predicate (platform + CPU), clobber declaration, cost estimate | AR-29 |
| R26 | Each plugin ships hand-written `.asm` runtime modules | T3/T4 runtime routines are implemented as hand-written ACME-syntax `.asm` files bundled with the plugin. They are `JSR`-linked and dead-stripped per AR-30 | AR-30 |
| R27 | Runtime `.asm` modules follow the ABI from AR-33 | Arguments passed via registers (≤3 bytes) and ZP arg-block (rest). Return in A (byte) or A/X (word). Clobber declared per routine | AR-33 |

### 3.5 Plugin Registration & Loading

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R28 | Plugins are registered in a static registry | The `@blend65/platforms` package exports a `Map<string, PlatformPlugin>` mapping platform IDs to plugin instances. No dynamic plugin loading in v1 | Design |
| R29 | Unknown platform ID is a compile-time error | If the user specifies `--platform foo` and `foo` is not in the registry, the compiler emits an error listing available platforms | Design |
| R30 | The active plugin is set once per compilation | The compiler resolves the platform ID at startup (from CLI or config), loads the plugin, and uses it throughout the build. Switching platforms mid-build is not supported | Design |
| R31 | The profile is validated at load time | `validateProfile()` is called immediately after loading. Profile validation failures are reported as errors before any compilation begins | Design |

### 3.6 Built-in Platforms

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R32 | Five built-in platforms ship with the compiler | `c64`, `c64u`, `cx16`, `a800xl`, `a7800`. Each is fully specified in a platform appendix | AR-37, Ch 15 §2 |
| R33 | C64 is the MVP platform | The `c64` plugin is implemented first and is the default platform if none is specified | AR-37, AR-43 |
| R34 | Platform implementation order | `c64` → `c64u` → `cx16` → `a7800` → `a800xl`. VIC-20 deferred to the final phase (AR-86) | AR-37, AR-86 |
| R35 | C64U extends C64 | The `c64u` plugin extends the `c64` plugin with additional capabilities (REU, extended RAM). It shares the C64 base profile with override fields | appendix-c64u |
| R36 | CX16 uses 65C02 CPU variant | The `cx16` plugin sets `cpu: '65c02'`, enabling 65C02-only opcodes and peephole rules | appendix-cx16 |

### 3.7 Platform Profile Summary (built-in platforms)

| # | Requirement | Decision / Behavior | Source |
|---|-------------|---------------------|--------|
| R37 | C64 profile values | `code_start: $0801`, `code_end: $CFFF`, `zp: $02–$8F` (142 bytes), `max_binary: 26623`, `output_format: prg`, `cpu: nmos6502`, `encoding: petscii` | appendix-c64 |
| R38 | C64U profile values | Extends C64; adds REU memory, additional ZP range if available | appendix-c64u |
| R39 | CX16 profile values | `code_start: $0801`, `zp: $02–$21` (32 bytes, shared with KERNAL), `cpu: 65c02`, `encoding: petscii/ascii`, banked RAM available | appendix-cx16 |
| R40 | A800XL profile values | `code_start: $2000` (after OS workspace), `zp: $80–$FF` (128 bytes), `cpu: nmos6502`, `encoding: atascii` | appendix-a800xl |
| R41 | A7800 profile values | `code_start: ROM-based (cart)`, `ram: 4KB ($1800–$27FF)`, `zp: $40–$FF` (192 bytes), `cpu: nmos6502`, `output_format: a78` | appendix-a7800 |

---

## 4. Design Detail

### 4.1 PlatformPlugin Interface

```typescript
/**
 * The contract every platform plugin must implement.
 * Defined in @blend65/core.
 */
interface PlatformPlugin {
  /** Unique platform identifier (e.g., "c64", "cx16") */
  readonly id: string;

  /** Human-readable platform name (e.g., "Commodore 64") */
  readonly displayName: string;

  /** The complete platform profile data */
  readonly profile: PlatformProfile;

  /** T4 intrinsic descriptors contributed by this platform */
  readonly intrinsics: IntrinsicDescriptor[];

  /** Paths to hand-written .asm runtime modules */
  readonly runtimeModules: RuntimeModule[];

  // --- Codegen hooks ---

  /**
   * Emit the platform preamble (origin, stub, shim, !to).
   * Called once per build before function code emission.
   */
  emitPreamble(options: PreambleOptions): StreamEntry[];

  /**
   * Emit the startup shim for the given variant.
   * Called by emitPreamble internally.
   */
  emitStartupShim(variant: ShimVariant): StreamEntry[];

  /**
   * Get the ACME !to output directive.
   */
  getOutputDirective(projectName: string): AcmeDirective;

  /**
   * Encode a string literal to platform character bytes.
   */
  encodeString(text: string): number[];

  /**
   * Encode a single character to a platform byte.
   */
  encodeChar(char: string): number;

  /**
   * Get the main() termination policy for this platform.
   */
  getMainTerminationPolicy(): MainTerminationPolicy;

  /**
   * Validate profile internal consistency. Called at load time.
   */
  validateProfile(): ValidationError[];
}
```

### 4.2 PlatformProfile Data Type

```typescript
/**
 * Platform profile data — all Ch 15 §3 fields.
 * Defined in @blend65/core.
 */
interface PlatformProfile {
  // --- Memory map (required) ---
  codeStart: number;        // word
  codeEnd: number;          // word
  dataStart: number;        // word
  dataEnd: number;          // word
  ramStart: number;         // word
  ramEnd: number;           // word
  zpStart: number;          // byte
  zpEnd: number;            // byte
  stackReserve: number;     // byte

  // --- Resource budgets (required) ---
  maxBinarySize: number;    // word
  maxRam: number;           // word
  maxZp: number;            // byte
  stackBudget: number;      // byte

  // --- Output format (required) ---
  outputFormat: OutputFormat;  // 'prg' | 'bin' | 'rom' | 'xex' | 'a78'
  loadAddress: number;         // word

  // --- CPU (required) ---
  cpu: CpuVariant;             // 'nmos6502' | '65c02'

  // --- Character encoding (optional) ---
  defaultEncoding?: CharEncoding;    // 'petscii' | 'atascii' | 'ascii'
  screenEncoding?: CharEncoding;

  // --- Embed format handlers (optional) ---
  embedFormats?: Map<string, string>;  // ext → handler name

  // --- Platform-specific warnings (optional) ---
  warnFrameSize?: number;    // warn W10030 if frame exceeds this
  warnArraySize?: number;    // warn W10191 if array exceeds this

  // --- ZP arg-block (required) ---
  zpArgBlockSize: number;    // bytes reserved for runtime-routine args

  // --- Informational (optional) ---
  clockMhz?: number;
  cyclesPerFrame?: number;
}

type OutputFormat = 'prg' | 'bin' | 'rom' | 'xex' | 'a78';
type CpuVariant = 'nmos6502' | '65c02';
type CharEncoding = 'petscii' | 'atascii' | 'ascii';
```

### 4.3 Codegen Hook Types

```typescript
interface PreambleOptions {
  /** Project name (for output filename) */
  projectName: string;

  /** Startup-shim variant selected by core termination analysis */
  shimVariant: ShimVariant;

  /** Whether BSS zeroing is needed (any uninitialized mutable data?) */
  needsBssZero: boolean;

  /** Whether DATA init copying is needed (any initialized mutable data?) */
  needsDataInit: boolean;
}

type ShimVariant = 'terminating' | 'non-terminating' | 'bare';

interface MainTerminationPolicy {
  /** Can main() return? (false on a7800 — game loop is infinite) */
  canReturn: boolean;

  /** Warning message if main returns on a platform where it shouldn't */
  warningOnReturn?: string;
}

interface RuntimeModule {
  /** Module name (e.g., "mul8", "div16") */
  name: string;

  /** Path to the .asm file relative to the plugin package */
  asmPath: string;

  /** Symbols exported by this module (for dead-stripping) */
  exports: string[];
}

interface ValidationError {
  field: string;
  message: string;
}
```

### 4.4 Plugin Registry

```typescript
// @blend65/platforms — index.ts

import { c64Plugin } from './c64.js';
import { c64uPlugin } from './c64u.js';
import { cx16Plugin } from './cx16.js';
import { a800xlPlugin } from './a800xl.js';
import { a7800Plugin } from './a7800.js';

/** Static registry of all built-in platform plugins */
const PLATFORM_REGISTRY: Map<string, PlatformPlugin> = new Map([
  ['c64',    c64Plugin],
  ['c64u',   c64uPlugin],
  ['cx16',   cx16Plugin],
  ['a800xl', a800xlPlugin],
  ['a7800',  a7800Plugin],
]);

/**
 * Load a platform plugin by ID.
 * @throws Error with available platform list if not found
 */
function loadPlatform(id: string): PlatformPlugin {
  const plugin = PLATFORM_REGISTRY.get(id);
  if (!plugin) {
    const available = [...PLATFORM_REGISTRY.keys()].join(', ');
    throw new Error(
      `Unknown platform '${id}' — available platforms: ${available}`
    );
  }
  return plugin;
}

/** Default platform for MVP */
const DEFAULT_PLATFORM = 'c64';
```

### 4.5 C64 Plugin Sketch (MVP)

```typescript
const c64Plugin: PlatformPlugin = {
  id: 'c64',
  displayName: 'Commodore 64',

  profile: {
    codeStart: 0x0801,
    codeEnd: 0xCFFF,
    dataStart: 0x0801,
    dataEnd: 0xCFFF,
    ramStart: 0x0801,
    ramEnd: 0xCFFF,
    zpStart: 0x02,
    zpEnd: 0x8F,
    stackReserve: 20,
    maxBinarySize: 26623,
    maxRam: 26623,
    maxZp: 142,
    stackBudget: 230,
    outputFormat: 'prg',
    loadAddress: 0x0801,
    cpu: 'nmos6502',
    defaultEncoding: 'petscii',
    screenEncoding: 'petscii',  // screen codes differ, handled by library
    warnFrameSize: 64,
    warnArraySize: 256,
    zpArgBlockSize: 8,   // 8 bytes for runtime-routine args
    clockMhz: 0.985,
    cyclesPerFrame: 19656,  // PAL
  },

  intrinsics: [
    // T4 intrinsics for C64 (populated by RD-17)
  ],

  runtimeModules: [
    // Hand-written .asm runtime routines
    { name: 'mul8',  asmPath: 'runtime/mul8.asm',  exports: ['__rt_mul8'] },
    { name: 'mul16', asmPath: 'runtime/mul16.asm', exports: ['__rt_mul16'] },
    { name: 'div8',  asmPath: 'runtime/div8.asm',  exports: ['__rt_div8'] },
    { name: 'div16', asmPath: 'runtime/div16.asm', exports: ['__rt_div16'] },
  ],

  emitPreamble(options: PreambleOptions): StreamEntry[] {
    const entries: StreamEntry[] = [];

    // !to "project.prg", cbm
    entries.push({
      type: 'directive',
      directive: this.getOutputDirective(options.projectName),
    });

    // * = $0801
    entries.push({
      type: 'directive',
      directive: { kind: 'origin', address: 0x0801 },
    });

    // BASIC stub: 10 SYS 2061
    entries.push(
      { type: 'directive', directive: { kind: 'word', values: [0x080B] } },
      { type: 'directive', directive: { kind: 'word', values: [0x000A] } },
      { type: 'directive', directive: { kind: 'byte', values: [0x9E] } },
      { type: 'directive', directive: { kind: 'text', text: '2061' } },
      { type: 'directive', directive: { kind: 'byte', values: [0x00] } },
      { type: 'directive', directive: { kind: 'word', values: [0x0000] } },
    );

    // Startup shim
    entries.push(...this.emitStartupShim(options.shimVariant));

    return entries;
  },

  emitStartupShim(variant: ShimVariant): StreamEntry[] {
    // See §4.6 for variant implementations
    // ...
  },

  getOutputDirective(projectName: string): AcmeDirective {
    return { kind: 'outputFile', name: `${projectName}.prg`, format: 'cbm' };
  },

  encodeString(text: string): number[] {
    return [...text].map(ch => this.encodeChar(ch));
  },

  encodeChar(char: string): number {
    // PETSCII encoding table (simplified)
    const code = char.charCodeAt(0);
    if (code >= 0x41 && code <= 0x5A) return code;        // A-Z → $41-$5A
    if (code >= 0x61 && code <= 0x7A) return code + 0x60;  // a-z → $C1-$DA
    if (code >= 0x30 && code <= 0x39) return code;          // 0-9
    if (code === 0x20) return 0x20;                          // space
    if (char === '\n') return 0x0D;                          // newline → CR
    return code;  // pass-through for other printable chars
  },

  getMainTerminationPolicy(): MainTerminationPolicy {
    return { canReturn: true };  // C64 main can return (restore BASIC)
  },

  validateProfile(): ValidationError[] {
    // Profile is compile-time constant; validation is a smoke test
    return [];
  },
};
```

### 4.6 Startup Shim Variants (C64)

**Terminating** (default, per AR-44):
```
__startup:
    LDA #$36            ; bank out BASIC ROM
    STA $01
    [BSS zeroing if needed]
    [DATA init if needed]
    JSR _main
    LDA #$37            ; restore BASIC ROM
    STA $01
    RTS                 ; return to BASIC
```

**Non-terminating** (game loop):
```
__startup:
    LDA #$36            ; bank out BASIC ROM
    STA $01
    [BSS zeroing if needed]
    [DATA init if needed]
    JMP _main           ; main never returns
```

**Bare** (no shim — used for advanced/custom startup):
```
; No startup code. _main is the entry point directly at load address.
```

---

## 5. Interactions With Other RDs

| RD | Relationship |
|----|--------------|
| RD-01 | Package structure: interface in `@blend65/core`, implementations in `@blend65/platforms` |
| RD-05 | **Consumer**: SFA frame planner reads profile budgets (`maxZp`, `maxRam`, `stackBudget`) for pre-ACME budget checks |
| RD-07 | **Consumer**: codegen reads CPU variant for opcode validation table, calls startup/format hooks |
| RD-08 | **Consumer**: peephole optimizer filters rules by CPU variant from the profile |
| RD-09 | **Consumer**: ACME emitter serializes the preamble produced by `emitPreamble()`; uses `getOutputDirective()` and `encodeString()` |
| RD-11 | **Data contributor**: profile budgets feed the resource report comparisons |
| RD-12 | **Consumer**: test harness uses the profile to configure emulator settings |
| RD-16 | **Config surface**: `blend65.json` `"platform"` field selects the active plugin |
| RD-17 | **Two-way**: plugins contribute T4 `IntrinsicDescriptor` entries (AR-29); intrinsic validation uses plugin's availability predicates; plugins ship runtime `.asm` modules (AR-30) |

---

## 6. Acceptance Criteria

- [x] AC-01: `PlatformPlugin` interface is defined in `@blend65/core` with all required methods and properties
- [x] AC-02: `PlatformProfile` type includes all Ch 15 §3.1 required fields
- [x] AC-03: The `c64` plugin is implemented with all profile values from appendix-c64
- [x] AC-04: `emitPreamble()` produces a valid BASIC stub + startup shim for C64
- [x] AC-05: All three startup-shim variants (terminating/non-terminating/bare) are implemented for C64
- [x] AC-06: `encodeString()` correctly encodes PETSCII for C64 (A-Z, a-z, 0-9, space, newline)
- [x] AC-07: `getOutputDirective()` produces `!to "<name>.prg", cbm` for C64
- [x] AC-08: `getMainTerminationPolicy()` returns `canReturn: true` for C64
- [x] AC-09: `validateProfile()` catches inconsistent profile fields (e.g., `zpStart > zpEnd`)
- [x] AC-10: The plugin registry maps platform IDs to plugin instances
- [x] AC-11: Unknown platform ID produces an actionable error listing available platforms
- [ ] AC-12: CPU variant from the profile is used by RD-07 for opcode validation — DEFERRED (RD-07 driver wiring)
- [x] AC-13: The `c64u` plugin extends C64 with additional capabilities
- [x] AC-14: The `cx16` plugin sets `cpu: '65c02'` (canonical spelling `wdc65c02`, D2)
- [x] AC-15: The `a7800` plugin sets `canReturn: false` for main termination
- [ ] AC-16: T4 intrinsic descriptors from the plugin are merged into the intrinsic registry — DEFERRED (RD-17; `intrinsics: []`)
- [ ] AC-17: Runtime `.asm` modules are discoverable for JSR-linking and dead-stripping — DEFERRED (RD-17; metadata only)
- [x] AC-18: No platform-specific address, chip name, or encoding appears in core compiler code (P3)
- [x] AC-19: Unit tests validate profile data for all 5 built-in platforms (AR-22 tier 1)
- [x] AC-20: All decisions trace to an `AR-NN` or a frozen spec section

---

## 7. Open Questions

> Discovery is **closed** (Zero-Ambiguity Gate PASSED). This section must normally be
> **empty**. If authoring surfaces a *new* ambiguity, STOP, add it to
> `00-ambiguity-register.md` as the next `AR-NN` (tagged `(runtime)`), resolve it with the
> user, then resume — per the Surface-During-Authoring rule. Do not fill gaps by guessing.

1. **C64U plugin differentiation**: The `c64u` plugin extends C64 with REU and hardware
   extensions. The exact set of additional capabilities (expanded RAM regions, additional
   ZP, REU-related intrinsics) depends on which C64 Ultimate features the community
   prioritizes. The base profile (memory map, budgets) is identical to C64 plus override
   fields. Specific T4 intrinsics for REU are defined in RD-17.

2. **A7800 cartridge format**: The `a7800` plugin uses ROM-based output with a cart header.
   The exact `.a78` container format (header bytes, bank structure) is defined in
   appendix-a7800. The plugin's `emitPreamble()` produces the appropriate directives for
   ACME to assemble a valid cartridge image.

3. **VIC-20 plugin**: Deferred per AR-86. When implemented, it will be the 6th plugin,
   sharing the C64 toolchain (VICE emulator, similar PETSCII encoding, PRG format) but
   with different memory map (5KB base RAM, expandable) and ZP range.
