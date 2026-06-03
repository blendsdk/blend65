# Scope / Symbol / SemanticModel: RD-04 Semantic Analysis (Skeleton)

> **Document**: 03-02-scope-symbol-model.md
> **Parent**: [Index](00-index.md)
> **Package**: `@blend65/core` (new `semantics/` module)
> **Implements**: RD-04 §4.2 (Scope), §4.3 (Symbol), §4.7 (ConstValue), §4.8 (CallGraph), §4.10 (SemanticModel)

## Overview

This component defines the **scope tree**, the **symbol record**, the **call graph**, the
**const value**, and the top-level **`SemanticModel`** — the output record every downstream
phase consumes. All are data shapes transcribed from RD-04 §4; the *behavior* that fills them
is deferred (the passthrough returns an empty model — D2). They live in `@blend65/core`
(R15/AR-20).

## Architecture

### Current Architecture

No scope, symbol, call-graph, const-value, or model representation exists.

### Proposed Changes

Add `semantics/scope.ts`, `symbol.ts`, `const-value.ts`, `call-graph.ts`, `semantic-model.ts`,
and the `semantics/index.ts` barrel to `@blend65/core`. Additive.

## Implementation Details

### `semantics/scope.ts` (RD-04 §4.2, R7–R8)

```typescript
import type { AstNode } from "../ast/index.js";
import type { Symbol } from "./symbol.js";

export type ScopeKind = "global" | "module" | "function" | "block";

export interface Scope {
  readonly kind: ScopeKind;
  readonly parent: Scope | null;
  readonly children: Scope[];
  readonly symbols: Map<string, Symbol>;
  /** The AST node that introduced this scope (module/function/block); null for global. */
  readonly node: AstNode | null;
}

/** Construct an empty scope (used by the passthrough to build the lone global scope). */
export function createScope(kind: ScopeKind, parent: Scope | null, node: AstNode | null): Scope {
  return { kind, parent, children: [], symbols: new Map(), node };
}
```

### `semantics/symbol.ts` (RD-04 §4.3)

```typescript
import type { AstNode } from "../ast/index.js";
import type { Type } from "./type.js";
import type { Scope } from "./scope.js";
import type { ConstValue } from "./const-value.js";

export type SymbolKind =
  | "variable"
  | "constant"
  | "function"
  | "interrupt"
  | "struct"
  | "enum"
  | "parameter"
  | "enumMember"
  | "intrinsic";

export interface Symbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly type: Type;
  readonly decl: AstNode;
  readonly scope: Scope;
  readonly exported: boolean;
  readonly mutable: boolean;
  readonly constValue?: ConstValue;
  readonly byRef: boolean; // true for struct-typed parameters (FN-3)
}
```

> Note the `Symbol` ↔ `Scope` mutual reference (a symbol holds its owning scope; a scope holds
> a `Map<string, Symbol>`). Resolved with `import type` to avoid a runtime cycle.

### `semantics/const-value.ts` (RD-04 §4.7, R94)

```typescript
import type { Type } from "./type.js";

export interface ConstValue {
  readonly type: Type;
  readonly value: number | boolean;
}
```

### `semantics/call-graph.ts` (RD-04 §4.8, R84–R86)

```typescript
import type { Symbol } from "./symbol.js";

export interface CallGraph {
  readonly functions: ReadonlySet<Symbol>;
  readonly edges: ReadonlyMap<Symbol, ReadonlySet<Symbol>>;
  /**
   * DEFERRED(RD-04-checker): R86 — cycle (recursion) detection emitting E10174.
   * Passthrough: returns [] (the empty graph has no cycles).
   */
  findCycles(): Symbol[][];
}

/** Construct an empty call graph for the passthrough model. */
export function emptyCallGraph(): CallGraph {
  return {
    functions: new Set(),
    edges: new Map(),
    findCycles: () => [], // DEFERRED(RD-04-checker): R86
  };
}
```

### `semantics/semantic-model.ts` (RD-04 §4.10, R121)

```typescript
import type { ExprNode, AstNode } from "../ast/index.js";
import type { Type } from "./type.js";
import { ERROR_TYPE } from "./type.js";
import type { Scope } from "./scope.js";
import { createScope } from "./scope.js";
import type { Symbol } from "./symbol.js";
import type { ConstValue } from "./const-value.js";
import type { StructType, EnumType } from "./type.js";
import type { CallGraph } from "./call-graph.js";
import { emptyCallGraph } from "./call-graph.js";

/**
 * The semantic model — the output of `analyze()` consumed by SFA/IL/codegen/LSP.
 *
 * PASSTHROUGH CONTRACT (RD-04 plan, D2): in this skeleton, `analyze()` returns a model whose
 * maps/collections are all empty, `mainFunction` is null, `hasErrors` is false, and
 * `globalScope` is a lone empty global scope. The real four-pass checker (DEFERRED) populates
 * these. See plans/rd-04-semantic-analysis/08-deferred-semantics-ledger.md.
 */
export interface SemanticModel {
  readonly globalScope: Scope;
  readonly typeMap: ReadonlyMap<ExprNode, Type>;
  readonly symbolMap: ReadonlyMap<AstNode, Symbol>;
  readonly callGraph: CallGraph;
  readonly initOrder: ReadonlyArray<Symbol>;
  readonly constValues: ReadonlyMap<Symbol, ConstValue>;
  readonly structTypes: ReadonlyMap<string, StructType>;
  readonly enumTypes: ReadonlyMap<string, EnumType>;
  readonly mainFunction: Symbol | null;
  readonly hasErrors: boolean;

  // Query helpers (R121). Passthrough returns defined safe values (D2/D13).
  typeOf(expr: ExprNode): Type;          // passthrough: ERROR_TYPE
  symbolOf(node: AstNode): Symbol | null; // passthrough: null
  scopeOf(node: AstNode): Scope;          // passthrough: globalScope
}

/**
 * Build the empty passthrough model (D2). The lone global scope is created here; query
 * helpers close over it.
 *
 * DEFERRED(RD-04-checker): the real model is produced by the four-pass analyzer.
 */
export function createEmptyModel(): SemanticModel {
  const globalScope = createScope("global", null, null);
  return {
    globalScope,
    typeMap: new Map(),
    symbolMap: new Map(),
    callGraph: emptyCallGraph(),
    initOrder: [],
    constValues: new Map(),
    structTypes: new Map(),
    enumTypes: new Map(),
    mainFunction: null,
    hasErrors: false,
    typeOf: () => ERROR_TYPE,      // DEFERRED(RD-04-checker): R44 expression typing
    symbolOf: () => null,          // DEFERRED(RD-04-checker): R14–R19 name resolution
    scopeOf: () => globalScope,    // DEFERRED(RD-04-checker): R7 scope assignment
  };
}
```

### `semantics/index.ts` (barrel)

```typescript
export type { PrimitiveName, PrimitiveType, ArrayType, StructType, EnumType, ErrorType, Type } from "./type.js";
export { ERROR_TYPE, primitive } from "./type.js";
export {
  isInteger, isSigned, isUnsigned, bitWidth, byteSize, isError, typeName,
  isAssignableTo, commonType,
} from "./type-utils.js";
export type { PlatformProfile } from "./platform-profile.js";
export { DEFAULT_PROFILE } from "./platform-profile.js";
export type { ScopeKind, Scope } from "./scope.js";
export { createScope } from "./scope.js";
export type { SymbolKind, Symbol } from "./symbol.js";
export type { ConstValue } from "./const-value.js";
export type { CallGraph } from "./call-graph.js";
export { emptyCallGraph } from "./call-graph.js";
export type { SemanticModel } from "./semantic-model.js";
export { createEmptyModel } from "./semantic-model.js";
```

> **Naming caution:** the core exports a type named `Symbol`, which shadows the global
> `Symbol`. This matches RD-04 §4.3 verbatim and is acceptable in modules that don't use the
> JS `Symbol` primitive. Documented here so it's an intentional, traceable choice.

### Core barrel wiring (`packages/core/src/index.ts`)

Append one additive line:

```typescript
export * from "./semantics/index.js";
```

## Integration Points

- `SemanticModel` is the contract RD-05/06/07/14 consume.
- `createEmptyModel()` is called by `analyze()` in `@blend65/frontend` ([03-03](03-03-passthrough-analyzer.md)).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| All scope/symbol/recursion/model-population diagnostics | **DEFERRED** to the checker | D1 |
| Query helper called on an unknown node | Returns the documented safe value (`ERROR_TYPE`/`null`/`globalScope`); never throws | D2/D13 |

> **Traceability:** [Ambiguity Register](00-ambiguity-register.md) D1, D2, D7, D13(FR-S13).
> Deferred behavior: [08-deferred-semantics-ledger.md](08-deferred-semantics-ledger.md).

## Testing Requirements

- **Spec tests** (`semantic-model.spec.test.ts`): `createEmptyModel()` returns a model with
  `hasErrors===false`, `mainFunction===null`, non-null `globalScope` (kind `"global"`), empty
  maps; query helpers return the documented safe values (AC-S1/AC-S2).
- **Impl tests**: `createScope` parent/child wiring; `emptyCallGraph().findCycles()===[]`.
