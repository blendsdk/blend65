# Frontend Tooling Index: RD-09 Developer Tooling

> **Document**: 03-01-frontend-tooling-index.md
> **Parent**: [Index](00-index.md)

## Overview

The tooling index is the one shared source of editor facts. It is a deterministic, read-only view
over the existing `AnalysisResult` from `analyzeProject`/`analyzeProjectOverlay`. It adds no
parser, type checker, project model, or backend import. The language server calls it; the compiler
pipeline does not.

## Architecture

### Current Architecture

`analyzeProjectOverlay` returns `AnalysisResult` with a `TypedProgram` on `complete`/`incomplete`
(`packages/compiler/src/frontend/service.ts:62-113`). The program already carries reachable modules
and parsed units, `SemanticBinding` records, semantic types, typed declarations and bodies, call
edges, effects, initializer order, load units, assets, and the selected profile. `TypedExpr` carries
a source span, resolved `BindingId`, type, constant value, place, signature, member/index facts, and
memory facts (`packages/compiler/src/frontend/semantic-types.ts:250-360`).

### Proposed Changes

Add `packages/compiler/src/frontend/tooling.ts` and export it from the frontend subpath. The module
builds a closed index once per analysis result. Queries are pure functions over the index.

## Implementation Details

### New Types

```ts
/** Stable source position in UTF-8 bytes. */
export interface ToolingPosition {
  readonly sourceId: string;
  readonly offset: number;
}

/** What an editor needs to render one declaration. */
export interface ToolingSymbol {
  readonly id: string;
  readonly binding: BindingId | null;
  readonly name: string;
  readonly qualifiedName: string;
  readonly kind:
    | "module"
    | "function"
    | "struct"
    | "enum"
    | "field"
    | "variable"
    | "constant"
    | "parameter"
    | "local";
  readonly type: SemanticType | null;
  readonly declaration: SourceSpan;
  readonly nameSpan: SourceSpan;
  readonly scope: SourceSpan;
  readonly storage: BindingStorage;
  readonly exported: boolean;
  readonly readonly: boolean;
  readonly constant: bigint | boolean | null;
  readonly functionMode?: "ordinary" | "comptime" | "interrupt";
  readonly effects?: EffectSummary;
  readonly placement?: PlacementConstraints;
  readonly asset?: SemanticAsset;
  readonly loadUnit?: LoadUnitRecord;
}

/** One source occurrence of a symbol. */
export interface ToolingOccurrence {
  readonly span: SourceSpan;
  readonly symbolId: string;
  readonly role: "declaration" | "reference" | "import" | "field";
}

/** Derived facts shared by every editor query. */
export interface ToolingIndex {
  readonly complete: boolean;
  readonly sources: readonly { readonly sourceId: string; readonly text: string }[];
  readonly symbols: readonly ToolingSymbol[];
  readonly occurrences: readonly ToolingOccurrence[];
  readonly modules: readonly {
    readonly name: string;
    readonly sourceIds: readonly string[];
    readonly exports: readonly string[];
  }[];
}
```

### New Functions

| Function | Contract |
| -------- | -------- |
| `buildToolingIndex(result: AnalysisResult): ToolingIndex \| null` | Returns `null` for an error-only result. Derives symbols and occurrences without mutating the result. |
| `symbolAt(index, position): ToolingSymbol \| null` | Chooses the narrowest occurrence containing the byte offset. Declaration and reference spans both resolve. |
| `referencesFor(index, symbolId, includeDeclaration): readonly SourceSpan[]` | Returns deterministic source-ordered occurrences. |
| `visibleSymbols(index, sourceId, offset): readonly ToolingSymbol[]` | Innermost-first visible bindings for completion and collision checks. |
| `completionAt(index, sourceId, offset, options): readonly CompletionFact[]` | Context-aware candidate list. `options` carries the destination directory and contained asset roots. |
| `hoverAt(index, symbolId): HoverFact` | Presentation facts only; no guessed final addresses or costs. |
| `signatureAt(index, sourceId, offset): SignatureFact \| null` | Innermost typed call containing the offset; `null` when no proved signature exists. |
| `documentSymbols(index, sourceId): readonly DocumentSymbolFact[]` | Source-ordered hierarchy. |
| `workspaceSymbols(index, query, limit): readonly WorkspaceSymbolFact[]` | Deterministic name/qualified-name match, capped at the caller's bound. |
| `renameEdits(index, symbolId, newName): RenameResult` | Closed edit set or a typed rejection reason. |
| `semanticTokenFacts(index, sourceId): readonly SemanticTokenFact[]` | Lexical tokens classified by proved occurrences; lexical fallback only. |
| `codeActionsAt(index, sourceId, offset): readonly CodeActionFact[]` | Always an empty list: no current diagnostic supplies a closed, proved edit. |

### Derivation Rules

1. **Declaration name spans.** Walk `TypedProgram.modules[].units[].declarations`; use each
   declaration's `nameSpan` and whole `declaration` span. The map is keyed by
   `bindingIdentityKey`.
2. **Bindings.** One `ToolingSymbol` per `TypedProgram.bindings` entry. `readonly` is true for
   `storage === "constant"` and for `const` parameters; `constant` is the declaration initializer's
   proved value when it is a literal.
3. **Locals and parameters.** Walk every `TypedDeclaration.body` and record `TypedVariableStatement`
   and function parameters with their containing block span as `scope`. Parameters use the function
   body span. A local declared in an inner block is visible only inside that block.
4. **References.** Walk typed expressions, statements, initializers, and blocks. Every node with a
   non-null `binding` contributes a reference at its identifier span. For a qualified reference,
   the module qualifier is a module occurrence and the member name is the target occurrence. For a
   member expression, the member token is a field occurrence when the object type is a struct.
5. **Imports.** Each `ResolvedImport` contributes an import occurrence at its source span and a
   reference to the target binding.
6. **Modules.** One module symbol per `TypedProgram.modules` entry, with the header span as its
   name span. Module exports are the module's `exported` bindings.
7. **Fields.** One field symbol per `StructType.fields` entry with a `nameSpan`. The field id is
   `struct:<binding key>:<field name>`.
8. **Ordering.** Symbols and occurrences are sorted by UTF-8 `sourceId`, start, end, then id. The
   index is frozen.

### Context Rules

| Context | Candidates |
| ------- | ---------- |
| Ordinary expression/statement | Visible locals, parameters, module bindings, imported aliases, language keywords, scalar type names, `embed` |
| After `.` | Struct fields of the typed left operand; module exports when the left operand is a module |
| `embed("` string | Declaring source directory and contained asset roots, filtered by typed handler selector |
| `place(... region: ...)` | Selected profile region constants only |
| Call argument | Type-compatible visible declarations and literals; no inaccessible or wrong-kind candidate |
| Type position | Scalar, struct, enum, and function type names visible in the module |

Completion returns at most 200 items, sorted by kind rank then UTF-8 label. The caller applies the
LSP `CompletionItemKind` mapping; the index never emits protocol types.

### Rename Rules

Rename is allowed only for a `ToolingSymbol` whose declaration is in the project's source set, not
an installed library, not an asset selector, and not generated. The new name must be a valid
identifier and not a reserved keyword. Rename is rejected when:

- the analysis is not `complete`;
- any occurrence is outside the project source set;
- a visible binding with the new name exists in the same scope;
- an import aliases the symbol under a different spelling;
- the symbol is a field whose struct is used by an installed-library declaration;
- the new spelling would collide with another member of the same struct or module.

Edits are `{ sourceId, span, newText }` records. The server groups them into a `WorkspaceEdit` and
revalidates document versions and source hashes before returning.

### Code Action Rule

The provider returns no action. The frontend does not expose a typed program for `error` or
`incomplete` results, so a missing-import candidate cannot be proved unique and contained. R9.22
forbids a speculative refactor or a workaround for a missing lowering. The provider is still
registered so the capability shape is stable; it returns an empty list and never invents an edit.
Revisit only when incomplete analysis exposes poison-safe declaration facts.

## Integration Points

- `packages/compiler/src/frontend/index.ts` exports the new types and functions.
- `packages/language-server/src/` imports only `@blend65/compiler/frontend`.
- `test/import-boundary.ts` continues to prove no backend reachability.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Error-only analysis result | `buildToolingIndex` returns `null`; queries return unavailable | AR-4 |
| Poisoned declaration | Exclude from symbols/occurrences; affected queries return no fact | AR-4 |
| Invalid offset | Return `null` or empty list; never clamp into another token | AR-4 |
| Duplicate binding name in scope | Keep distinct ids; `visibleSymbols` orders by narrowest scope | AR-16 |
| Ambiguous rename | Reject with `ambiguous` reason | AR-16 |
| Aliased import | Reject rename of the target | AR-16 |
| Any diagnostic without a proved edit | Return no code action | AR-7 |

## Testing Requirements

- Unit tests for derivation, ordering, shadowing, fields, imports, and poison exclusion.
- Behavior tests for every query against real projects.
- A property-style test that every occurrence span is inside its containing declaration or source.
- Boundary test that `tooling.ts` imports no backend module.
