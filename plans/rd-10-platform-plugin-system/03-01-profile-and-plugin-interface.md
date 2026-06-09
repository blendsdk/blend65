# Profile & Plugin Interface: RD-10 Platform Plugin System

> **Document**: 03-01-profile-and-plugin-interface.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-10 R1–R22 (type/interface surface), spec Ch 15 §3; decisions D2, D6

## Overview

This component defines the **data contract** every platform plugin satisfies, in
`@blend65/core` (R2 — so both `frontend` budget checks and `codegen` hooks consume it without a
circular dependency). It creates a new `core/src/platform/` directory and a new
`@blend65/core/platform` subpath barrel (D6). The interim `PlatformProfile`
(`core/src/semantics/platform-profile.ts`) is **not** touched.

## Architecture

### New directory layout (`@blend65/core`)

```
packages/core/src/platform/
  cpu-variant.ts          # canonical CpuVariant (D2)
  platform-profile.ts     # PlatformProfile + OutputFormat + CharEncoding (Ch 15 §3)
  platform-plugin.ts      # PlatformPlugin interface + hook types
  validate-profile.ts     # validateProfileFields() shared helper (FR-21, R22)
  index.ts                # the @blend65/core/platform subpath barrel
```

Plus a packaging change: `packages/core/package.json` `exports` gains a `"./platform"` entry
(D6); the root barrel (`src/index.ts`) is **unchanged** (still exports the interim profile).

## Implementation Details

### `cpu-variant.ts` (D2)

```typescript
/**
 * The CPU instruction-set variant a platform targets.
 *
 * Canonical home (RD-10 D2): `@blend65/codegen` re-exports this so the CPU-validation
 * tables and the platform profiles share exactly one type. The `"wdc65c02"` spelling
 * matches the shipped RD-07a value; the frozen spec's prose `65c02` is a display concern
 * only (see AR D2).
 */
export type CpuVariant = "nmos6502" | "wdc65c02";
```

### `platform-profile.ts` (R6–R15, Ch 15 §3)

The field set is RD-10 §4.2 with the `cpu` field typed as the canonical `CpuVariant`:

```typescript
import type { CpuVariant } from "./cpu-variant.js";

export type OutputFormat = "prg" | "bin" | "rom" | "xex" | "a78";
export type CharEncoding = "petscii" | "atascii" | "ascii";

/**
 * Canonical RD-10 platform profile (Ch 15 §3). NEW type (D6) — distinct from the
 * interim `PlatformProfile` in `core/src/semantics/`, which is left untouched until a
 * later migration. Exported from `@blend65/core/platform`, NOT the root barrel.
 */
export interface PlatformProfile {
  // --- Memory map (required, Ch 15 §3.1) ---
  readonly codeStart: number;
  readonly codeEnd: number;
  readonly dataStart: number;
  readonly dataEnd: number;
  readonly ramStart: number;
  readonly ramEnd: number;
  readonly zpStart: number;
  readonly zpEnd: number;
  readonly stackReserve: number;

  // --- Resource budgets (required) ---
  readonly maxBinarySize: number;
  readonly maxRam: number;
  readonly maxZp: number;
  readonly stackBudget: number;

  // --- Output format (required) ---
  readonly outputFormat: OutputFormat;
  readonly loadAddress: number;

  // --- CPU (required) ---
  readonly cpu: CpuVariant;

  // --- ZP arg-block (required, AR-34) ---
  readonly zpArgBlockSize: number;

  // --- Character encoding (optional, Ch 15 §3.2) ---
  readonly defaultEncoding?: CharEncoding;
  readonly screenEncoding?: CharEncoding;

  // --- Embed format handlers (optional) ---
  readonly embedFormats?: ReadonlyMap<string, string>;

  // --- Platform-specific warnings (optional) ---
  readonly warnFrameSize?: number;
  readonly warnArraySize?: number;

  // --- Informational (optional) ---
  readonly clockMhz?: number;
  readonly cyclesPerFrame?: number;
}
```

> All fields `readonly` (profiles are compile-time constants). This matches RD-10 §4.2 exactly
> except the `cpu` type is the shared canonical `CpuVariant` (D2) rather than an inline literal.

### `platform-plugin.ts` (R1–R3, R16–R22; §4.1/§4.3)

```typescript
// AcmeDirective/StreamEntry are the core-resident model types (D7) — same barrel.
import type { AcmeDirective, StreamEntry } from "./instr-model.js";
import type { PlatformProfile } from "./platform-profile.js";

export type ShimVariant = "terminating" | "non-terminating" | "bare";

export interface PreambleOptions {
  readonly projectName: string;
  readonly shimVariant: ShimVariant;
  readonly needsBssZero: boolean;
  readonly needsDataInit: boolean;
}

export interface MainTerminationPolicy {
  readonly canReturn: boolean;
  readonly warningOnReturn?: string;
}

export interface RuntimeModule {
  readonly name: string;       // e.g. "mul8"
  readonly asmPath: string;    // path to the .asm relative to the plugin package
  readonly exports: readonly string[];  // symbols for dead-stripping, e.g. ["__rt_mul8"]
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

/**
 * Intrinsic descriptors are RD-17's type. Until RD-17 lands the plugins ship an empty
 * list; this alias keeps the interface field present without a fabricated shape (D1).
 */
export type IntrinsicDescriptor = unknown;   // DEFERRED(RD-17) — see note below

export interface PlatformPlugin {
  readonly id: string;
  readonly displayName: string;
  readonly profile: PlatformProfile;
  readonly intrinsics: readonly IntrinsicDescriptor[];  // [] until RD-17
  readonly runtimeModules: readonly RuntimeModule[];

  emitPreamble(options: PreambleOptions): StreamEntry[];
  emitStartupShim(variant: ShimVariant): StreamEntry[];
  getOutputDirective(projectName: string): AcmeDirective;
  encodeString(text: string): number[];
  encodeChar(char: string): number;
  getMainTerminationPolicy(): MainTerminationPolicy;
  validateProfile(): ValidationError[];
}
```

### `validate-profile.ts` (FR-21, R22)

```typescript
import type { PlatformProfile } from "./platform-profile.js";
import type { ValidationError } from "./platform-plugin.js";

/**
 * Shared profile-consistency checks (R22/R31). Each plugin's `validateProfile()`
 * delegates here, so the field invariants live in one place.
 */
export function validateProfileFields(profile: PlatformProfile): ValidationError[] {
  const errors: ValidationError[] = [];
  if (profile.zpStart > profile.zpEnd) {
    errors.push({ field: "zpStart", message: `zpStart ($${...}) > zpEnd (...)` });
  }
  if (profile.codeStart >= profile.codeEnd) {
    errors.push({ field: "codeStart", message: "codeStart must be < codeEnd" });
  }
  if (profile.maxZp !== profile.zpEnd - profile.zpStart + 1) {
    errors.push({ field: "maxZp", message: "maxZp must equal zpEnd - zpStart + 1" });
  }
  // (additional internal-consistency checks per R22)
  return errors;
}
```

### `index.ts` — the `@blend65/core/platform` subpath barrel (D6)

```typescript
export type { CpuVariant } from "./cpu-variant.js";
export type { PlatformProfile, OutputFormat, CharEncoding } from "./platform-profile.js";
export type {
  PlatformPlugin, PreambleOptions, ShimVariant, MainTerminationPolicy,
  RuntimeModule, ValidationError, IntrinsicDescriptor,
} from "./platform-plugin.js";
export { validateProfileFields } from "./validate-profile.js";
```

### `package.json` `exports` change (D6)

```jsonc
"exports": {
  ".":         { "types": "./dist/index.d.ts",          "default": "./dist/index.js" },
  "./platform":{ "types": "./dist/platform/index.d.ts", "default": "./dist/platform/index.js" }
}
```

## Shared Instr/stream model relocation (D7 — resolved)

The plugin hooks return `StreamEntry[]` / `AcmeDirective`, originally defined in
`@blend65/codegen` (`instr/stream.ts`). Since `PlatformPlugin` lives in `@blend65/core` and core
must not depend on codegen, **D7 resolves this by promoting the pure-data Instr/stream model to
`@blend65/core`** (symmetric with the D2 `CpuVariant` move):

- **Moved into core** (new `core/src/instr-model/` — or folded into `platform/`):
  `Opcode`, `AddressingMode`, `InstrOperand` (+ constructors/guards), `AcmeDirective`,
  `StreamEntry`, `InstrStream` (+ `instr`/`label`/`directive` constructors and
  `isInstr`/`isLabel`/`isDirective` guards), and `CpuVariant`. These are pure data + trivial
  constructors — no compiler logic.
- **Stays in codegen** (logic): `cpu-table`, `validate`, `print-instr`, the RD-07a/07b
  translator/binder/program. `@blend65/codegen`'s `instr/` barrel **re-exports** the moved model
  types so every shipped RD-07a/07b import path and test resolves and passes **by value**
  unchanged — only the definition site moves.
- `PlatformPlugin` (core) references the core-resident `StreamEntry`/`AcmeDirective` directly;
  the AR-20 graph is preserved (core depends on nothing; codegen→core already exists).
- `printInstr` remains in codegen; plugin goldens import it from `@blend65/codegen` (test
  packages may depend on codegen — only `frontend`/`language-server` may not, R15).

This relocation is a **Phase-1 step**, done test-first by confirming the existing codegen `instr`
spec/impl tests stay green after the move (they assert on values/strings, not file locations).
See `00-ambiguity-register.md` D7 for the full rationale.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Inconsistent profile fields | `validateProfile()` returns `ValidationError[]` (non-throwing data) | R22 / FR-12 |
| Profile validation surfaced at load | `loadPlatform` callers inspect the returned errors (wiring is RD-15/16) | R31 |

## Testing Requirements

- Spec tests: `PlatformProfile` is constructible with all required fields; `validateProfileFields`
  flags `zpStart > zpEnd`, `codeStart >= codeEnd`, `maxZp` mismatch; the canonical `CpuVariant`
  equals the value codegen uses. (See 07-testing-strategy ST-CP1..)
- The interim `PlatformProfile` spec tests in `core/src/semantics/` remain unchanged and green.
