# Blend Parser & Frontend Roadmap

## 0. Guiding Principles
- **God-level AST fidelity**: Capture every syntactic nuance (storage classes, decorators, callbacks, pragmas) with precise source spans so semantic analysis, optimization, IL generation, and codegen have all context without re-parsing.
- **Single parse per file**: Lexer + parser run once per source file. Results live in a module registry so downstream stages never restart the front-end even after module resolution.
- **Extensibility hooks**: Reserve first-class nodes for decorators/`#pragma` directives, future storage backends, callbacks, etc.
- **Coding standards**: Follow `.clinerules/coding.md`—DRY code (no duplicated string literals, reuse shared enums/constants like `lexer/types.ts`), comprehensive comments, JSDoc on public APIs, no private class members, and tests must cover new logic.
- **Educational value**: Heavily document parser utilities and AST builders so contributors can learn how the compiler works.

## 1. Lexer Assurance (Baseline)
1. Keep `packages/compiler/src/lexer` as the single source of truth for tokens; extend token enums before adding grammar constructs.
2. Add golden token fixtures/tests whenever introducing new syntax (e.g., decorator prefix symbols) to ensure regressions are caught early.

## 2. Core Parser Architecture
1. **Parser shell**
   - `Parser` class stores token array, cursor index, diagnostics collector, and configuration (e.g., whether decorators enabled).
   - Utilities: `current()`, `peek(offset)`, `match(...types)`, `consume(type, message)`, `skipNewlines()`, `expectEnd(keyword)`, `synchronize()`.
2. **Recursive descent for declarations/statements**
   - `parseProgram()` loops over `parseTopLevelItem()` until `EOF`, tolerating multiple NEWLINE separators.
   - Branching functions: `parseModuleDecl`, `parseImportDecl`, `parseExportableDecl`, `parseFunctionDecl`, `parseEnumDecl`, `parseVariableDecl`, `parseStatement` (with sub-handlers for `if`, `while`, `for`, `match`, etc.).
   - Each block verifies its terminator (`end if`, `end function`, `next identifier`, `end match`, `end enum`).
3. **Pratt / precedence-climbing expressions**
   - Register prefix parselets for literals, identifiers, parenthesized/grouped expressions, unary operators, decorator expressions (future).
   - Register infix parselets for calls `()`, indexing `[]`, member access `.`, binary operators (arithmetic, bitwise, logical, relational, assignment), ensuring multi-character tokens like `<<=` and `>>=` slot into the precedence ladder.
4. **Decorator/pragma hooks**
   - `parseDecoratorList()` captures leading decorator tokens (e.g., `@zp`, `@ram`, `#pragma interrupt`, future annotations) before declarations.
   - AST nodes include `decorators?: DecoratorNode[]` so semantics/codegen can inspect metadata later.
5. **Lookahead support**
   - Provide configurable lookahead to disambiguate constructs (identifier + colon as type annotation vs future labels, decorator parameters, etc.).

## 3. AST & IR Design
1. **Node taxonomy** (TypeScript discriminated unions + enums reused across compiler stages):
   - **Declarations**: `ModuleDecl`, `ImportDecl`, `ExportDecl`, `FunctionDecl`, `TypeAliasDecl`, `EnumDecl`, `VariableDecl`.
   - **Statements**: `BlockStmt`, `IfStmt`, `WhileStmt`, `ForStmt`, `MatchStmt`, `CaseClause`, `DefaultClause`, `ReturnStmt`, `BreakStmt`, `ContinueStmt`, `ExpressionStmt`.
   - **Expressions**: `LiteralExpr`, `IdentifierExpr`, `QualifiedNameExpr`, `BinaryExpr`, `UnaryExpr`, `CallExpr`, `IndexExpr`, `AssignmentExpr`, `StorageClassExpr`, `DecoratorExpr`, `PragmaExpr` (future).
2. **Metadata per node**
   - `kind`, `span` (`start`/`end` `SourcePosition`), optional `docComment`, `decorators`, `storageClass`, `symbolId` (for analyzer linking).
   - Builder helpers keep node creation DRY and enforce coding standards (no repeated string literals for kinds; reuse enums/constants like `AstNodeKind`).
3. **Symbol tables & storage**
   - Create `SymbolTable` interfaces keyed by module and scope. Parser seeds the tables with declarations while recording references for analyzer resolution.

## 4. Module Registry & Multi-file Integration
1. **Parsing pipeline**
   - For each source file: run lexer → parser → produce AST + diagnostics.
   - Insert result into `ModuleRegistry` keyed by canonical module name plus URI/path; include version/hash for incremental updates.
2. **Dependency graph**
   - After parsing all files, resolve imports to module entries, detect missing modules, version mismatches, or cycles.
3. **Compilation context**
   - `CompilationContext` bundles module graph, AST map, symbol tables, storage-class maps, decorator metadata, and diagnostics. Downstream stages consume this context without touching the lexer/parser again.
4. **Incremental build hooks**
   - Registry tracks which modules depend on which imports so a single-file change triggers targeted re-parse and analyzer re-run (foundation for LSP responsiveness).

## 5. Error Handling & Recovery
1. **Diagnostics model**
   - `ParserDiagnostic` includes `code`, `message`, `severity`, `span`, `relatedSpans`. Follows coding standards with enums/constants for diagnostic codes to avoid magic strings.
2. **Recovery strategies**
   - Each construct defines a sync point (e.g., newline, `end`, `case`, `default`). On error, advance until reaching a sync token to continue parsing other sections.
3. **Testing**
   - Ensure malformed inputs yield predictable diagnostics without crashes.

## 6. Testing Strategy
1. **Unit tests**
   - Snapshot ASTs for isolated constructs (functions, enums, if/else, match/case) verifying node kinds, spans, decorators, storage classes.
2. **Integration tests**
   - Multi-file fixtures under `packages/compiler/src/__tests__/parser/` verifying module registry linking, import resolution, and combined diagnostics.
3. **Regression/fuzz tests**
   - Feed randomized token streams or real-world Blend programs to catch edge cases early.

## 7. Tooling & LSP Readiness
- Parser exposes incremental APIs (`parseFile`, `updateFile`, `getModuleGraph`) so the future VS Code language server can provide diagnostics, go-to-definition, hover, completion.
- Diagnostics formatting aligns with VS Code expectations (line/column positions from `SourcePosition`).

## 8. Implementation Phases
1. Scaffold parser project (types, AST enums, parser class, diagnostics).  
2. Implement top-level declarations + NEWLINE handling.  
3. Add Pratt expression parser.  
4. Implement control-flow statements and block verification.  
5. Build module registry, dependency graph, and compilation context.  
6. Integrate diagnostics + test harness.  
7. Add decorator/pragma parsing + storage-class metadata.  
8. Expose incremental parsing APIs and document usage for semantic analyzer, optimizer, IL, codegen, and future LSP.

## 9. Phase Breakdown & Exit Criteria
| Phase | Scope | Key Deliverables | Exit Criteria |
| --- | --- | --- | --- |
| **Phase 1 – Parser Scaffolding** | Project wiring, enums, AST node kinds, diagnostics infrastructure, parser utilities respecting `.clinerules/coding.md`. | `Parser` class shell, `AstNodeKind`/`ExpressionKind` enums, builder helpers, diagnostic types, baseline tests proving token ingestion. | AST builders compile, unit tests verifying node factories all pass, lint/tests green. |
| **Phase 2 – Top-Level Declarations** | Module/import/export/function/type/enum/variable parsing with NEWLINE handling and decorator hooks. | Functions `parseProgram`, `parseTopLevelItem`, declaration-specific parsers, decorator storage on nodes, golden AST snapshots. | Sample programs parse into AST without TODO nodes; tests cover each declaration type; diagnostics emitted for missing `end` tokens. |
| **Phase 3 – Expression Engine** | Pratt/precedence parser covering literals, identifiers, calls, indexing, member access, unary/binary/assignment ops. | Binding-power table, prefix/infix parselets, expression tests for operator precedence and associativity, error recovery on malformed expressions. | Expression suite passes; statements using expressions (assignments, returns) produce correct AST nodes. |
| **Phase 4 – Control Flow Statements** | `if/then/else`, `while`, `for…next`, `match/case/default`, `break/continue`, `return`, blocks. | Statement parsers with `expectEnd` enforcement, block AST nodes retaining spans and decorators. | Control-flow fixtures parse successfully; diagnostics confirm unmatched `end` recovery; coverage includes nested constructs. |
| **Phase 5 – Module Registry & Multi-file Context** | Parse-many driver, module registry, dependency graph, compilation context, incremental hooks. | `ModuleRegistry`, `CompilationContext`, import resolution diagnostics, version/hash tracking. | Multi-file integration tests proving registry linking and cycle detection; incremental update API re-parses one file without global reset. |
| **Phase 6 – Diagnostics & Testing Hardened** | Panic-mode recovery refinements, diagnostic codes/enums, regression test harness. | Comprehensive diagnostic catalog, snapshot tests for errors, fuzz/regression automation entry point. | No unhandled parser exceptions on malformed corpora; test suite green. |
| **Phase 7 – Decorators & Pragmas** | Concrete syntax for `@decorator` / `#pragma`, storage-class metadata propagation, semantic placeholders. | Decorator AST nodes, parser hooks, updated lexer tests if new tokens are needed, fixtures verifying metadata. | Decorator metadata appears in AST; storage classes captured consistently; tests cover success and failure paths. |
| **Phase 8 – Incremental & LSP-ready APIs** | Public parser APIs for language server/IDE integration, documentation for semantic analyzer and future tools. | `parseFile`, `updateFile`, `getModuleGraph`, documentation/tutorial markdown, sample usage script. | VS Code extension stub (optional) can call parser API; docs reviewed/approved; all prior tests remain green. |

> **Next Steps**: Execute phases sequentially. At the end of each phase, run `yarn clean && yarn build && yarn test` from repo root to comply with `.clinerules/project.md`, update documentation/tests, and only proceed once exit criteria are met.
