# Type Model: RD-04 Semantic Analysis (Skeleton)

> **Document**: 03-01-type-model.md
> **Parent**: [Index](00-index.md)
> **Package**: `@blend65/core` (new `semantics/` module)
> **Implements**: RD-04 R24–R29 (§4.4), §4.6 (utils), R120/§4 (`PlatformProfile` shape)

## Overview

This component defines the **resolved semantic type representation** (the `Type` discriminated
union) and its utility functions, plus the minimal `PlatformProfile` stub. These are pure data
+ pure functions — no checker logic — so they live in `@blend65/core` and are shared by
`frontend`/`language-server` (R15/AR-20). The *type-policy* utilities (`isAssignableTo`,
`commonType`) are **stubbed** because their real behavior *is* the deferred checking (D10).

## Architecture

### Current Architecture

The compiler has only **syntactic** types — the AST `TypeNode` union (`PrimitiveTypeNode`,
`NamedTypeNode`, `ArrayTypeNode`, `ErrorTypeNode`). There is no resolved/semantic type.

### Proposed Changes

Add `semantics/type.ts` (the `Type` union) and `semantics/type-utils.ts` (utilities) to
`@blend65/core`, plus `semantics/platform-profile.ts` (stub). All additive.

## Implementation Details

### New Types/Interfaces (`semantics/type.ts`)

Transcribed from RD-04 §4.4, with **D5** applied (`PrimitiveName` reuses the AST's six-name
union including `"boolean"`).

```typescript
import type { StructDeclNode, EnumDeclNode } from "../ast/index.js";

/** The six primitive type names (matches the AST `PrimitiveTypeName`, D5). */
export type PrimitiveName = "byte" | "sbyte" | "word" | "sword" | "boolean" | "void";

export interface PrimitiveType {
  readonly kind: "primitive";
  readonly name: PrimitiveName;
}

export interface ArrayType {
  readonly kind: "array";
  readonly element: Type;
  readonly size: number; // compile-time constant, >= 1 (validated by the deferred checker)
}

export interface StructType {
  readonly kind: "struct";
  readonly name: string;
  readonly decl: StructDeclNode;
  readonly fields: ReadonlyMap<string, { type: Type; offset: number }>;
  readonly byteSize: number;
}

export interface EnumType {
  readonly kind: "enum";
  readonly name: string;
  readonly decl: EnumDeclNode;
  readonly members: ReadonlyMap<string, number>; // name -> backing value
}

/** Poison type — cascade suppression (R29/R114). The *interface* is in scope; the
 *  *propagation behavior* is deferred to the checker. */
export interface ErrorType {
  readonly kind: "error";
}

export type Type = PrimitiveType | ArrayType | StructType | EnumType | ErrorType;
```

Provide small constructor/singleton helpers for ergonomics and to give tests something to
build (AC-S2):

```typescript
/** Shared singleton poison type. */
export const ERROR_TYPE: ErrorType = { kind: "error" };

/** Construct a primitive type. */
export function primitive(name: PrimitiveName): PrimitiveType { return { kind: "primitive", name }; }
```

### New Functions/Methods (`semantics/type-utils.ts`)

**Implemented now (pure structural facts — D10):**

```typescript
/** byte | sbyte | word | sword (R24/§4.4). bool and enum are NOT integers here. */
export function isInteger(t: Type): boolean;

/** sbyte | sword. */
export function isSigned(t: Type): boolean;

/** byte | word. */
export function isUnsigned(t: Type): boolean;

/**
 * Bit width of a width-bearing primitive (D13): 8 for byte/sbyte/boolean; 16 for word/sword.
 * NOTE: typed to accept only `PrimitiveType` — `void` carries no width, and struct/array/error
 * are not primitives, so they are rejected at COMPILE TIME (callers must narrow first). This
 * makes the function total over its (narrowed) domain and removes the void/error ambiguity.
 */
export function bitWidth(t: PrimitiveType): 8 | 16;

/**
 * Total byte size over the whole `Type` union (D13) — never throws:
 *   byte/sbyte/boolean → 1 · word/sword → 2 · void/error → 0 ·
 *   struct → struct.byteSize · array → byteSize(element) * size.
 */
export function byteSize(t: Type): number;


/** ErrorType check (R29). */
export function isError(t: Type): boolean;

/** Human-readable name for diagnostics, e.g. "byte", "word[4]", "Enemy", "<error>". */
export function typeName(t: Type): string;
```

**Stubbed now (type-system policy — DEFERRED, D10):**

```typescript
/**
 * DEFERRED(RD-04-checker): R36/§4.6 — assignment compatibility (widening, narrowing,
 * signedness, enum<->byte cast rules). See 08-deferred-semantics-ledger.md.
 *
 * Passthrough placeholder: returns `true` (permissive) so no caller is blocked while the
 * checker is unimplemented. The real rules emit E10152/E10153/E10154.
 */
export function isAssignableTo(source: Type, target: Type): boolean;

/**
 * DEFERRED(RD-04-checker): R31/§4.6 — widening promotion (byte->word, sbyte->sword) and
 * mixed-signedness rejection. See 08-deferred-semantics-ledger.md.
 *
 * Passthrough placeholder: returns `null` (no common type computed). The real logic emits
 * E10153 on mixed signedness and returns the promoted common type otherwise.
 */
export function commonType(a: Type, b: Type): Type | null;
```

> **Lint (D15, supersedes D14):** these two policy stubs leave their parameters unused, which
> trips **two** gates — `tsc --noUnusedParameters` (TS6133) *and* ESLint's
> `@typescript-eslint/no-unused-vars`. The canonical fix (D15) is to `_`-prefix the params
> (`_source`/`_target`/`_a`/`_b`) — which `tsc` honours natively — and to add
> `argsIgnorePattern: "^_"` to the root `eslint.config.mjs` `no-unused-vars` rule so ESLint
> agrees. (D14's scoped `eslint-disable` is **not** used: an `eslint-disable` cannot suppress
> the `tsc` error that fires first.) Same mechanism as the four pass seams. See
> [AR D15](00-ambiguity-register.md).



### New Interface (`semantics/platform-profile.ts`)

Minimal stub per **D4**. RD-10 supersedes. Shape only — the passthrough never reads it.

```typescript
/**
 * Minimal placeholder for the platform profile (RD-04 R120). The real profile system is
 * RD-10; this stub exists only so `analyze()` can carry its R118 signature today.
 *
 * DEFERRED(RD-10): full profile (memory map, ZP ranges, output format, intrinsic registry).
 */
export interface PlatformProfile {
  /** Platform identifier, e.g. "c64" (placeholder — RD-10 defines the canonical set). */
  readonly name: string;
  /** Character-encoding name for char/string literals (R47/R120), e.g. "petscii". */
  readonly charEncoding: string;
}

/** A neutral default profile so callers/tests have something to pass (passthrough ignores it). */
export const DEFAULT_PROFILE: PlatformProfile = { name: "none", charEncoding: "ascii" };
```

### Integration Points

- `type.ts` imports `StructDeclNode`/`EnumDeclNode` from `../ast/index.js` (intra-core).
- All three files are re-exported by `semantics/index.ts` (see [03-02](03-02-scope-symbol-model.md)),
  which the core barrel re-exports.
- `frontend`'s `analyze()` imports `Type`, `ERROR_TYPE`, `PlatformProfile`, `DEFAULT_PROFILE`
  from `@blend65/core`.

## Code Examples

### Example 1: Structural utilities (in scope)

```typescript
isInteger(primitive("byte"));      // true
isInteger(primitive("boolean"));   // false
bitWidth(primitive("word"));       // 16
byteSize(primitive("byte"));       // 1
isError(ERROR_TYPE);               // true
typeName(primitive("sword"));      // "sword"
```

### Example 2: Policy utilities (deferred placeholders)

```typescript
isAssignableTo(primitive("byte"), primitive("word")); // true (placeholder — checker enforces R31/R36)
commonType(primitive("byte"), primitive("word"));     // null (placeholder — checker returns "word")
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| All type-checking diagnostics (E10150–E10155, E10080–E10083) | **DEFERRED** — emitted by the future checker, not here | D1 |
| `bitWidth` called on `void`/`error`/`struct`/`array` | **Compile-time rejection** — `bitWidth` accepts only `PrimitiveType`; non-width types never reach it (D13) | D13 |
| `byteSize` called on `void`/`error` | Total & throws-free: `byteSize(void)===0`, `byteSize(error)===0` (D13) | D13 |

> **Traceability:** Every design choice references the [Ambiguity Register](00-ambiguity-register.md)
> (D1, D4, D5, D7, D10, D13). Deferred behavior is enumerated in

> [08-deferred-semantics-ledger.md](08-deferred-semantics-ledger.md).

## Testing Requirements

- **Spec tests** (`type.spec.test.ts`, `type-utils.spec.test.ts`): every interface is
  constructible (AC-S2); structural utilities return correct values for representative inputs
  (AC-S3); policy stubs exist and return their documented placeholders (AC-S4).
- **Impl tests**: edge cases of `byteSize`/`bitWidth`/`typeName` across all variants.
