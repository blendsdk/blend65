# Navigation: Definition, Symbols, References & Rename

> **Document**: 07-navigation.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete

## Go-to-Definition (`definition.ts`)

Uses the cached AST and symbol table to find where a symbol is declared.

### Algorithm

1. Find the token at the cursor position (identify the symbol name)
2. Look up the symbol in the cached `SymbolTable` via `symbolTable.lookup(name)`
3. Return the symbol's `location` (SourceLocation) as an LSP `Location`
4. Convert 1-indexed compiler positions to 0-indexed LSP positions

### Supported Targets

| Target | Source | Notes |
|--------|--------|-------|
| Local variable | `SymbolTable.lookup()` | Navigates to `let`/`const` declaration |
| Function | `SymbolTable.lookup()` | Navigates to `function` declaration |
| Parameter | `SymbolTable.lookup()` | Navigates to parameter in function signature |
| Enum name | `SymbolTable.lookup()` | Navigates to `enum` declaration |
| Enum member | AST walk on EnumDecl | Navigates to member within enum body |
| Imported symbol | `ImportResolver` + `GlobalSymbolTable` | Cross-module: resolves to source file |
| Type alias | `SymbolTable.lookup()` | Navigates to `type` declaration |

### Cross-Module Navigation

For imported symbols, use `GlobalSymbolTable.lookupQualified(moduleName, symbolName)` to find the declaration in another file. Convert the module name to a file URI for the LSP Location.

## Document Symbols (`symbols.ts`)

Provides the **Outline View** (sidebar) and **Go to Symbol** (Ctrl+Shift+O).

### Symbol Hierarchy

Walk the AST and produce `DocumentSymbol[]` with parent-child nesting:

```
📦 Module: Game.Main
├── 📌 const MAX_SPRITES: byte = 8
├── 📦 @zp let playerX: byte
├── 📦 @zp let playerY: byte
├── 📋 enum Direction { UP, DOWN, LEFT, RIGHT }
│   ├── 🔹 UP = 0
│   ├── 🔹 DOWN = 1
│   ├── 🔹 LEFT = 2
│   └── 🔹 RIGHT = 3
├── 🔧 function init(): void
├── 🔧 export function main(): void
└── 🔤 type SpriteId = byte
```

### Symbol Kind Mapping

| AST Node | LSP SymbolKind | Icon |
|----------|---------------|------|
| `ModuleDecl` | `Module` | 📦 |
| `FunctionDecl` | `Function` | 🔧 |
| `VariableDecl` (let) | `Variable` | 📦 |
| `VariableDecl` (const) | `Constant` | 📌 |
| `EnumDecl` | `Enum` | 📋 |
| `EnumMember` | `EnumMember` | 🔹 |
| `TypeDecl` | `TypeParameter` | 🔤 |
| `ImportDecl` | `Module` | 📦 |
| `Parameter` | `Variable` | 📦 |

## Find References (`references.ts`)

Walk the cached AST to find all `Identifier` nodes matching the target symbol name. Use the `ASTWalker` visitor pattern.

### Algorithm

1. Identify the symbol at cursor position
2. Walk the entire AST looking for `Identifier` expressions matching the name
3. Include the declaration location itself (if `context.includeDeclaration`)
4. Return all matching locations as LSP `Location[]`

## Rename Symbol (`rename.ts`)

### Prepare Rename

Validate that the symbol can be renamed:
- ✅ User-defined variables, functions, parameters, enums, type aliases
- ❌ Keywords, intrinsic functions, asm_* functions, imported symbols (rename at source)

### Execute Rename

1. Find all references (same as find-references)
2. Generate `TextEdit` for each reference location, replacing old name with new name
3. Return `WorkspaceEdit` with all edits

## Semantic Tokens (`semantic-tokens.ts`)

Provides context-aware highlighting beyond TextMate regex.

### Token Legend

**Types:** `function`, `variable`, `parameter`, `type`, `enum`, `enumMember`, `property`, `namespace`, `keyword`, `number`, `string`, `comment`

**Modifiers:** `declaration`, `readonly`, `static`, `defaultLibrary`

### Algorithm

Walk the AST and for each node, emit semantic token data (line, char, length, tokenType, modifiers). Encode as delta-encoded integer array per LSP spec.

## Code Folding (`folding.ts`)

### Folding Ranges

| Structure | Fold Region |
|-----------|-------------|
| Function body | `{` to `}` |
| If/else blocks | `{` to `}` for each branch |
| While/for/do-while | `{` to `}` |
| Switch statement | `{` to `}` |
| Enum body | `{` to `}` |
| Block comments | `/*` to `*/` |
| Import groups | Consecutive import lines |
| Region markers | `// #region` to `// #endregion` |
