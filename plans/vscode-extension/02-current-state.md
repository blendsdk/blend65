# Current State: Compiler Infrastructure for VS Code Extension

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete

## Existing Implementation

The `@blend65/compiler` package provides a complete compilation pipeline that the VS Code extension will leverage as its analysis engine. This document analyzes the compiler APIs relevant to building LSP features.

### Compiler Package Overview

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `@blend65/compiler` | 0.2.0 | `packages/compiler/` | Full compiler (lexer → emit) |
| `@blend65/cli` | 0.2.0 | `packages/cli/` | CLI interface for `blend65` command |

The compiler is published as an ESM module (`"type": "module"`) with TypeScript declarations. The extension's LSP server will import it directly via the monorepo workspace dependency.

## Relevant Compiler APIs

### Lexer (`packages/compiler/src/lexer/`)

**Key export:** `Lexer` class, `tokenize()` utility

| API | Signature | Use in Extension |
|-----|-----------|-----------------|
| `new Lexer(source, options)` | `Lexer(source: string, options?: LexerOptions)` | Create lexer for document text |
| `lexer.tokenize()` | `(): Token[]` | Get all tokens for semantic highlighting |
| `tokenize(source)` | `(source: string): Token[]` | Quick tokenization utility |

**Token structure** (from `types.ts`):
```typescript
interface Token {
  type: TokenType;    // Enum: NUMBER, STRING, IDENTIFIER, MODULE, etc.
  value: string;      // Raw string value from source
  start: SourcePosition;  // { line, column, offset }
  end: SourcePosition;    // { line, column, offset }
}
```

**Extension relevance:**
- Tokens with source positions enable precise semantic token highlighting
- Comment tokens (`LINE_COMMENT`, `BLOCK_COMMENT`) available when `skipComments: false`
- TokenType enum provides complete keyword/operator classification
- Source positions are 1-indexed (line, column) — matches LSP convention

**Complete token categories (from `TokenType` enum):**

| Category | Tokens |
|----------|--------|
| Literals | `NUMBER`, `STRING`, `BOOLEAN`, `IDENTIFIER`, `STRING_LITERAL`, `BOOLEAN_LITERAL` |
| Module keywords | `MODULE`, `IMPORT`, `EXPORT`, `FROM`, `TARGET` |
| Function keywords | `FUNCTION`, `RETURN` |
| Control flow | `IF`, `ELSE`, `WHILE`, `FOR`, `TO`, `DOWNTO`, `STEP`, `DO`, `SWITCH`, `CASE`, `BREAK`, `CONTINUE`, `DEFAULT` |
| Declaration | `TYPE`, `ENUM` |
| Mutability | `LET`, `CONST` |
| Storage classes | `ZP`, `RAM`, `DATA` |
| Primitive types | `BYTE`, `WORD`, `VOID`, `CALLBACK`, `ADDRESS` |
| Arithmetic ops | `PLUS`, `MINUS`, `MULTIPLY`, `DIVIDE`, `MODULO` |
| Assignment ops | `ASSIGN`, `PLUS_ASSIGN`, `MINUS_ASSIGN`, `MULTIPLY_ASSIGN`, `DIVIDE_ASSIGN`, `MODULO_ASSIGN`, `BITWISE_AND_ASSIGN`, `BITWISE_OR_ASSIGN`, `BITWISE_XOR_ASSIGN`, `LEFT_SHIFT_ASSIGN`, `RIGHT_SHIFT_ASSIGN` |
| Comparison ops | `EQUAL`, `NOT_EQUAL`, `LESS_THAN`, `LESS_EQUAL`, `GREATER_THAN`, `GREATER_EQUAL` |
| Logical ops | `AND`, `OR`, `NOT` |
| Bitwise ops | `BITWISE_AND`, `BITWISE_OR`, `BITWISE_XOR`, `BITWISE_NOT`, `LEFT_SHIFT`, `RIGHT_SHIFT` |
| Punctuation | `LEFT_PAREN`, `RIGHT_PAREN`, `LEFT_BRACKET`, `RIGHT_BRACKET`, `LEFT_BRACE`, `RIGHT_BRACE`, `COMMA`, `SEMICOLON`, `COLON`, `DOT`, `QUESTION`, `AT` |
| Special | `NEWLINE`, `EOF`, `LINE_COMMENT`, `BLOCK_COMMENT` |

---

### Parser (`packages/compiler/src/parser/`)

**Key export:** `Parser` class

**Architecture:** Inheritance chain `BaseParser → ExpressionParser → DeclarationParser → ModuleParser → StatementParser → Parser`

| API | Signature | Use in Extension |
|-----|-----------|-----------------|
| `new Parser(tokens, config)` | `Parser(tokens: Token[], config?: Partial<ParserConfig>)` | Parse tokens into AST |
| `parser.parse()` | `(): Program` | Get complete AST |
| `parser.getDiagnostics()` | `(): Diagnostic[]` | Get parse errors/warnings |
| `parser.hasErrors()` | `(): boolean` | Quick error check |

**AST node types available** (all with `SourceLocation`):
- `Program` — root node containing module name and declarations
- `ModuleDecl` — module declaration
- `ImportDecl` — import statement with symbols list and source module
- `VariableDecl` — variable with storage class, mutability, type, initializer
- `FunctionDecl` — function with parameters, return type, body, modifiers (export, callback)
- `TypeDecl` — type alias
- `EnumDecl` — enum with members (each has name and optional value)
- `Parameter` — function parameter (name, type)
- Expressions: `NumberLiteral`, `StringLiteral`, `BooleanLiteral`, `Identifier`, `BinaryExpression`, `UnaryExpression`, `CallExpression`, `MemberExpression`, `IndexExpression`, `TernaryExpression`, `ArrayLiteral`, `AssignmentExpression`
- Statements: `ExpressionStatement`, `IfStatement`, `WhileStatement`, `DoWhileStatement`, `ForStatement`, `SwitchStatement`, `ReturnStatement`, `BreakStatement`, `ContinueStatement`

**Extension relevance:**
- AST provides the structure for document symbols (outline view)
- Source locations on every node enable go-to-definition and find-references
- Error recovery allows partial parsing (diagnostics even with syntax errors)
- Visitor pattern via `ASTWalker` base class for tree traversal

---

### Semantic Analyzer (`packages/compiler/src/semantic/`)

**Key export:** `SemanticAnalyzer` class

**Architecture:** 8-pass Static Frame Allocation analysis

| API | Signature | Use in Extension |
|-----|-----------|-----------------|
| `new SemanticAnalyzer(options)` | `SemanticAnalyzer(options?: SemanticAnalyzerOptions)` | Create analyzer |
| `analyzer.analyze(program)` | `(program: Program): AnalysisResult` | Single-module analysis |
| `analyzer.analyzeMultiple(programs)` | `(programs: Program[]): MultiModuleAnalysisResult` | Multi-module analysis |
| `analyzer.getTypeSystem()` | `(): TypeSystem` | Access type system |

**AnalysisResult structure:**
```typescript
interface AnalysisResult {
  diagnostics: Diagnostic[];       // Errors and warnings
  symbolTable: SymbolTable;        // All declared symbols with types
  callGraph: CallGraph;            // Function call relationships
  // ... additional analysis data
}
```

**Symbol Table API** (critical for IntelliSense):

| Method | Returns | Use in Extension |
|--------|---------|-----------------|
| `symbolTable.lookup(name)` | `Symbol \| undefined` | Hover info, go-to-definition |
| `symbolTable.getAllVisibleSymbols()` | `Map<string, Symbol>` | Autocomplete candidates |
| `symbolTable.getExportedSymbols()` | `Symbol[]` | Cross-module completion |
| `symbolTable.getFunctionSymbols()` | `Symbol[]` | Function-specific completions |
| `symbolTable.getSymbolsByKind(kind)` | `Symbol[]` | Filtered completions |

**Symbol structure:**
```typescript
interface Symbol {
  name: string;
  kind: SymbolKind;           // Variable, Constant, Function, Parameter, Import, etc.
  type: TypeInfo | null;       // Type information
  location: SourceLocation;    // Declaration location
  isExported: boolean;
  isConst: boolean;
  // ... additional properties
}
```

**TypeSystem API** (for hover info):

| Method | Returns | Use in Extension |
|--------|---------|-----------------|
| `typeSystem.getTypeDescription(type)` | `string` | Human-readable type name |
| `typeSystem.getTypeSize(type)` | `number` | Size in bytes |
| `typeSystem.isNumericType(type)` | `boolean` | Type classification |
| `typeSystem.getBuiltinTypeNames()` | `string[]` | Type completions |

**Extension relevance:**
- `AnalysisResult.diagnostics` → LSP diagnostics (errors, warnings)
- `SymbolTable` → autocomplete, hover, go-to-definition
- `TypeSystem` → type info for hover
- `CallGraph` → find references, call hierarchy (future)
- Multi-module analysis enables cross-file features

---

### Additional Relevant APIs

**Global Symbol Table** (`GlobalSymbolTable` class):
- `lookup(symbolName)` — Find symbol across all modules
- `lookupQualified(moduleName, symbolName)` — Qualified lookup
- `getModuleExports(moduleName)` — Get all exports from a module
- `findSymbols(pattern)` — Pattern-based symbol search (useful for workspace symbols)
- `getAllSymbols()` — All registered symbols

**Module Registry** (`ModuleRegistry` class):
- `register(name, program)` — Register a parsed module
- `getModule(name)` — Get registered module by name
- `getAllModuleNames()` — List all known modules
- `hasModule(name)` — Check if module exists

**Import Resolver** (`ImportResolver` class):
- `resolveImports(program)` — Resolve import statements
- `getModuleExports(moduleName)` — Get exportable symbols
- `checkImportConflicts(importDecl, symbolTable)` — Validate imports

**Diagnostic structure:**
```typescript
interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;  // Error, Warning, Info, Hint
  code?: DiagnosticCode;         // Specific error code
  location: SourceLocation;      // Source position
}

interface SourceLocation {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
```

---

## Library Files (Intrinsics & ASM Functions)

### Intrinsics (10 built-in functions)

Defined in the language spec (`docs/language-specification-v2/08-intrinsics.md`). These are compiler-handled functions, not library imports.

| Intrinsic | Signature | Runtime Cost | Category |
|-----------|-----------|--------------|----------|
| `peek` | `(address: word): byte` | 4 cycles | Memory access |
| `poke` | `(address: word, value: byte): void` | 4 cycles | Memory access |
| `peekw` | `(address: word): word` | 8 cycles | Memory access |
| `pokew` | `(address: word, value: word): void` | 8 cycles | Memory access |
| `lo` | `(value: word): byte` | 0 (compile-time) | Byte extraction |
| `hi` | `(value: word): byte` | 0 or 3 cycles | Byte extraction |
| `length` | `(array/string): word` | 0 (compile-time) | Compile-time |
| `barrier` | `(): void` | 0 cycles | Optimizer control |
| `volatile_read` | `(address: word): byte` | 4 cycles | Volatile access |
| `volatile_write` | `(address: word, value: byte): void` | 4 cycles | Volatile access |

### ASM Functions (~151 functions)

Defined in the language spec (`docs/language-specification-v2/09-asm-functions.md`). Each maps to exactly one 6502 opcode.

**Categories:**
- Load/Store: `asm_lda_*`, `asm_ldx_*`, `asm_ldy_*`, `asm_sta_*`, `asm_stx_*`, `asm_sty_*`
- Transfer: `asm_tax`, `asm_tay`, `asm_txa`, `asm_tya`, `asm_tsx`, `asm_txs`
- Arithmetic: `asm_adc_*`, `asm_sbc_*`, `asm_inc_*`, `asm_dec_*`, `asm_inx`, `asm_iny`, `asm_dex`, `asm_dey`
- Logic: `asm_and_*`, `asm_ora_*`, `asm_eor_*`
- Compare: `asm_cmp_*`, `asm_cpx_*`, `asm_cpy_*`
- Shift/Rotate: `asm_asl*`, `asm_lsr*`, `asm_rol*`, `asm_ror*`
- Branch: `asm_bcc_rel`, `asm_bcs_rel`, `asm_beq_rel`, `asm_bne_rel`, `asm_bmi_rel`, `asm_bpl_rel`, `asm_bvc_rel`, `asm_bvs_rel`
- Jump/Call: `asm_jmp_abs`, `asm_jmp_ind`, `asm_jsr`, `asm_rts`, `asm_rti`
- Stack: `asm_pha`, `asm_pla`, `asm_php`, `asm_plp`
- Flags: `asm_clc`, `asm_sec`, `asm_cli`, `asm_sei`, `asm_cld`, `asm_sed`, `asm_clv`
- Bit test: `asm_bit_zp`, `asm_bit_abs`
- Misc: `asm_nop`, `asm_brk`

**Addressing mode suffixes:**
- (none) = implied, `_imm` = immediate, `_zp` = zero page, `_zpx` = zero page X
- `_zpy` = zero page Y, `_abs` = absolute, `_abx` = absolute X, `_aby` = absolute Y
- `_ind` = indirect, `_inx` = indexed indirect, `_iny` = indirect indexed, `_rel` = relative

### Library File Location

Library `.blend` files are in `packages/compiler/library/`:
- `common/asm.blend` — ASM function stubs
- `common/system.blend` — System utilities
- `c64/common/` — C64-specific hardware definitions

---

## Monorepo Structure

| Field | Value |
|-------|-------|
| Root package | `@blend65/monorepo` (private) |
| Package manager | Yarn 1.22 Classic |
| Build orchestration | Turbo 2.8+ |
| Node version | 22+ |
| Module type | ESM (`"type": "module"`) |
| Workspaces | `packages/*`, `packages/*/*` |
| TypeScript | 5.9+ |
| Test framework | Vitest 4.0 |

**Existing packages:**
- `packages/compiler/` — `@blend65/compiler`
- `packages/cli/` — `@blend65/cli`
- `packages/vscode-blend65/` — **NEW** (to be created)

---

## Gaps and Integration Notes

### What Exists and Can Be Used Directly

| Capability | Status | API |
|------------|--------|-----|
| Tokenization with positions | ✅ Ready | `Lexer.tokenize()` |
| AST with source locations | ✅ Ready | `Parser.parse()` |
| Parse error diagnostics | ✅ Ready | `Parser.getDiagnostics()` |
| Semantic analysis | ✅ Ready | `SemanticAnalyzer.analyze()` |
| Type information | ✅ Ready | `TypeSystem`, `Symbol.type` |
| Symbol table | ✅ Ready | `SymbolTable.lookup()`, `getAllVisibleSymbols()` |
| Multi-module analysis | ✅ Ready | `SemanticAnalyzer.analyzeMultiple()` |
| Export tracking | ✅ Ready | `GlobalSymbolTable.getModuleExports()` |
| Call graph | ✅ Ready | `CallGraph`, `CallGraphBuilder` |
| Import resolution | ✅ Ready | `ImportResolver` |
| Comment tokens | ✅ Ready | `skipComments: false` option |
| Keyword/type constants | ✅ Ready | `eModuleKeyword`, `ePrimitiveType`, etc. |

### What the Extension Must Build

| Feature | Why Not in Compiler | Extension Responsibility |
|---------|-------------------|--------------------------|
| Intrinsic documentation | Spec-only, no structured data | Build `data/intrinsics.ts` with docs, params, cycle counts |
| ASM function documentation | Spec-only, no structured data | Build `data/asm-functions.ts` with opcode docs |
| Hardware constant docs | Library files, no IntelliSense data | Build `data/hardware.ts` with register descriptions |
| Incremental analysis | Compiler runs full pipeline each time | Cache and invalidate per-document |
| Document sync | Compiler works with strings | Map LSP `TextDocument` → compiler source |
| Position mapping | Compiler positions are 1-indexed | Direct mapping (LSP also 0-indexed lines but compiler is 1-indexed — small offset) |

### Important v2 Notes

- **No `@map` syntax** — v2 removes memory-mapped I/O syntax; uses `peek`/`poke` intrinsics instead
- **No `boolean`/`string` as separate token types** — they share `BOOLEAN` and keyword patterns
- **SFA architecture** — no recursion; compiler detects and reports cycles
- **Static typing** — all types are explicit; limited inference
