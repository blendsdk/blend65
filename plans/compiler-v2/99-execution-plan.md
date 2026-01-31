# Execution Plan: Compiler v2

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the Blend65 v2 compiler with Static Frame Allocation (SFA).

## Implementation Phases

| Phase | Title                 | Sessions | Est. Time |
| ----- | --------------------- | -------- | --------- |
| 1     | Package Setup         | 1-2      | 1-2 hours |
| 2     | Lexer Migration       | 1-2      | 1-2 hours |
| 3     | Parser Migration      | 2-3      | 2-3 hours |
| 4     | AST Migration         | 1-2      | 1-2 hours |
| 5     | Semantic Analyzer (NEW) | 18-22   | 22-28 hours |
| 6     | Frame Allocator (NEW) | 3-4      | 3-4 hours |
| 7     | Simple IL (NEW)       | 3-4      | 3-4 hours |
| 8     | Code Generator (NEW)  | 4-5      | 4-5 hours |
| 9     | ASM Optimizer         | 2-3      | 2-3 hours |
| 10    | Integration & Testing | 2-3      | 2-3 hours |

**Total: 38-50 sessions, ~44-55 hours**

---

## Phase 1: Package Setup

### Session 1.1: Create Package Structure

**Objective**: Set up the new compiler-v2 package

**Tasks**:

| #     | Task                       | File(s)                              |
| ----- | -------------------------- | ------------------------------------ |
| 1.1.1 | Create package.json        | `packages/compiler-v2/package.json`  |
| 1.1.2 | Create tsconfig.json       | `packages/compiler-v2/tsconfig.json` |
| 1.1.3 | Create directory structure | `packages/compiler-v2/src/`          |
| 1.1.4 | Create index.ts exports    | `packages/compiler-v2/src/index.ts`  |
| 1.1.5 | Update root turbo.json     | `turbo.json`                         |

**Directory Structure**:

```
packages/compiler-v2/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── lexer/
    ├── parser/
    ├── ast/
    ├── semantic/
    ├── frame/          ← NEW
    ├── il/             ← NEW
    ├── codegen/        ← NEW
    ├── optimizer/
    └── __tests__/
```

**Deliverables**:

- [ ] Package builds successfully
- [ ] Can import from @blend65/compiler-v2

**Verify**: `clear && yarn build`

---

## Phase 2: Lexer Migration

### Session 2.1: Copy and Simplify Lexer

**Objective**: Migrate lexer from v1, remove @map tokens

**Tasks**:

| #     | Task                       | File(s)                |
| ----- | -------------------------- | ---------------------- |
| 2.1.1 | Copy lexer types           | `src/lexer/types.ts`   |
| 2.1.2 | Remove @map token types    | `src/lexer/types.ts`   |
| 2.1.3 | Copy lexer implementation  | `src/lexer/lexer.ts`   |
| 2.1.4 | Remove @map tokenization   | `src/lexer/lexer.ts`   |
| 2.1.5 | Copy lexer tests           | `src/__tests__/lexer/` |
| 2.1.6 | Update tests (remove @map) | `src/__tests__/lexer/` |
| 2.1.7 | Create lexer index.ts      | `src/lexer/index.ts`   |

**Deliverables**:

- [ ] Lexer compiles
- [ ] All lexer tests pass
- [ ] @map tokens removed

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 3: Parser Migration

### Session 3.1: Copy Parser Base

**Objective**: Copy parser infrastructure

**Tasks**:

| #     | Task                     | File(s)                      |
| ----- | ------------------------ | ---------------------------- |
| 3.1.1 | Copy parser base         | `src/parser/base.ts`         |
| 3.1.2 | Copy expression parsing  | `src/parser/expressions.ts`  |
| 3.1.3 | Copy statement parsing   | `src/parser/statements.ts`   |
| 3.1.4 | Copy declaration parsing | `src/parser/declarations.ts` |

**Deliverables**:

- [ ] Parser base compiles

### Session 3.2: Remove @map Parsing

**Objective**: Remove @map syntax parsing

**Tasks**:

| #     | Task                                       | File(s)                      |
| ----- | ------------------------------------------ | ---------------------------- |
| 3.2.1 | Remove @map from declarations              | `src/parser/declarations.ts` |
| 3.2.2 | Update parser entry                        | `src/parser/parser.ts`       |
| 3.2.3 | Copy and Migrate ALL parser relevant tests | `src/__tests__/parser/`      |
| 3.2.4 | Remove @map test cases                     | `src/__tests__/parser/`      |
| 3.2.5 | Create parser index.ts                     | `src/parser/index.ts`        |

**Deliverables**:

- [ ] Parser compiles
- [ ] All parser tests pass
- [ ] @map parsing removed

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 4: AST Migration

### Session 4.1: Copy and Simplify AST

**Objective**: Migrate AST, remove @map nodes

**Tasks**:

| #     | Task                  | File(s)                  |
| ----- | --------------------- | ------------------------ |
| 4.1.1 | Copy AST base types   | `src/ast/base.ts`        |
| 4.1.2 | Copy AST node types   | `src/ast/nodes.ts`       |
| 4.1.3 | Remove @map AST nodes | `src/ast/nodes.ts`       |
| 4.1.4 | Copy type guards      | `src/ast/type-guards.ts` |
| 4.1.5 | Update type guards    | `src/ast/type-guards.ts` |
| 4.1.6 | Copy visitor pattern  | `src/ast/visitor.ts`     |
| 4.1.7 | Create AST index.ts   | `src/ast/index.ts`       |

**Deliverables**:

- [ ] AST compiles
- [ ] @map nodes removed
- [ ] Type guards updated

**Verify**: `clear && yarn clean && yarn build`

---

## Phase 5: Semantic Analyzer (Write From Scratch)

> **Reference**: [06-semantic-migration.md](06-semantic-migration.md)
> **Approach**: Write from scratch with V1 as documentation reference
> **Architecture**: Multi-pass, production-quality, SFA-optimized

### Session 5.1: Core Foundation (Symbol, Scope)

**Objective**: Create core symbol and scope infrastructure

**Tasks**:

| #     | Task                    | File(s)                    |
| ----- | ----------------------- | -------------------------- |
| 5.1.1 | Create Symbol interface | `src/semantic/symbol.ts`   |
| 5.1.2 | Create SymbolKind enum  | `src/semantic/symbol.ts`   |
| 5.1.3 | Create Scope interface  | `src/semantic/scope.ts`    |
| 5.1.4 | Create ScopeKind enum   | `src/semantic/scope.ts`    |
| 5.1.5 | Create SymbolTable class| `src/semantic/symbol-table.ts` |
| 5.1.6 | Add scope management    | `src/semantic/symbol-table.ts` |
| 5.1.7 | Add symbol tests        | `src/__tests__/semantic/symbol.test.ts` |
| 5.1.8 | Add scope tests         | `src/__tests__/semantic/scope.test.ts` |

**Deliverables**:
- [ ] Symbol/Scope types compile
- [ ] SymbolTable manages scopes correctly
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.2: Type System

**Objective**: Create type system utilities

**Tasks**:

| #     | Task                          | File(s)                      |
| ----- | ----------------------------- | ---------------------------- |
| 5.2.1 | Update types.ts (add TypeCompatibility) | `src/semantic/types.ts` |
| 5.2.2 | Create TypeSystem class       | `src/semantic/type-system.ts` |
| 5.2.3 | Add built-in types            | `src/semantic/type-system.ts` |
| 5.2.4 | Add type compatibility check  | `src/semantic/type-system.ts` |
| 5.2.5 | Add array type creation       | `src/semantic/type-system.ts` |
| 5.2.6 | Add function type creation    | `src/semantic/type-system.ts` |
| 5.2.7 | Add binary/unary op types     | `src/semantic/type-system.ts` |
| 5.2.8 | Add type system tests         | `src/__tests__/semantic/type-system.test.ts` |

**Deliverables**:
- [ ] TypeSystem handles all built-in types
- [ ] Type compatibility checking works
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.3: Symbol Table Builder (Pass 1)

**Objective**: Create visitor to collect declarations and build symbol table

**Tasks**:

| #     | Task                          | File(s)                                  |
| ----- | ----------------------------- | ---------------------------------------- |
| 5.3.1 | Create SymbolTableBuilder     | `src/semantic/visitors/symbol-table-builder.ts` |
| 5.3.2 | Visit module declarations     | `src/semantic/visitors/symbol-table-builder.ts` |
| 5.3.3 | Visit function declarations   | `src/semantic/visitors/symbol-table-builder.ts` |
| 5.3.4 | Visit variable declarations   | `src/semantic/visitors/symbol-table-builder.ts` |
| 5.3.5 | Visit parameters              | `src/semantic/visitors/symbol-table-builder.ts` |
| 5.3.6 | Handle exports/imports        | `src/semantic/visitors/symbol-table-builder.ts` |
| 5.3.7 | Add builder tests             | `src/__tests__/semantic/symbol-table-builder.test.ts` |

**Deliverables**:
- [ ] Pass 1 builds complete symbol table
- [ ] Scopes created correctly
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.4: Type Resolution (Pass 2)

**Objective**: Create visitor to resolve type annotations

**Tasks**:

| #     | Task                          | File(s)                                  |
| ----- | ----------------------------- | ---------------------------------------- |
| 5.4.1 | Create TypeResolver visitor   | `src/semantic/visitors/type-resolver.ts` |
| 5.4.2 | Resolve variable types        | `src/semantic/visitors/type-resolver.ts` |
| 5.4.3 | Resolve function return types | `src/semantic/visitors/type-resolver.ts` |
| 5.4.4 | Resolve parameter types       | `src/semantic/visitors/type-resolver.ts` |
| 5.4.5 | Handle array types            | `src/semantic/visitors/type-resolver.ts` |
| 5.4.6 | Add resolver tests            | `src/__tests__/semantic/type-resolver.test.ts` |

**Deliverables**:
- [ ] Pass 2 resolves all type annotations
- [ ] Symbols annotated with types
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.5: TypeCheckerBase + LiteralTypeChecker

**Objective**: Create base type checker and literal checking

**Tasks**:

| #     | Task                          | File(s)                                  |
| ----- | ----------------------------- | ---------------------------------------- |
| 5.5.1 | Create TypeCheckerBase        | `src/semantic/visitors/type-checker/base.ts` |
| 5.5.2 | Add diagnostic utilities      | `src/semantic/visitors/type-checker/base.ts` |
| 5.5.3 | Add symbol lookup utilities   | `src/semantic/visitors/type-checker/base.ts` |
| 5.5.4 | Create LiteralTypeChecker     | `src/semantic/visitors/type-checker/literals.ts` |
| 5.5.5 | Check numeric literals        | `src/semantic/visitors/type-checker/literals.ts` |
| 5.5.6 | Check string/bool literals    | `src/semantic/visitors/type-checker/literals.ts` |
| 5.5.7 | Check array literals          | `src/semantic/visitors/type-checker/literals.ts` |
| 5.5.8 | Add literal tests             | `src/__tests__/semantic/type-checker/literals.test.ts` |

**Deliverables**:
- [ ] TypeCheckerBase provides utilities
- [ ] All literal types inferred correctly
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.6: ExpressionTypeChecker

**Objective**: Create expression type checking layer

**Tasks**:

| #     | Task                          | File(s)                                  |
| ----- | ----------------------------- | ---------------------------------------- |
| 5.6.1 | Create ExpressionTypeChecker  | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.2 | Check identifier expressions  | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.3 | Check binary expressions      | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.4 | Check unary expressions       | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.5 | Check call expressions        | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.6 | Check index expressions       | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.7 | Check ternary expressions     | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.8 | Check assignment expressions  | `src/semantic/visitors/type-checker/expressions.ts` |
| 5.6.9 | Add expression tests          | `src/__tests__/semantic/type-checker/expressions.test.ts` |

**Deliverables**:
- [ ] All expression types checked
- [ ] Type errors reported
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.7: DeclarationTypeChecker

**Objective**: Create declaration type checking layer

**Tasks**:

| #     | Task                          | File(s)                                  |
| ----- | ----------------------------- | ---------------------------------------- |
| 5.7.1 | Create DeclarationTypeChecker | `src/semantic/visitors/type-checker/declarations.ts` |
| 5.7.2 | Check variable declarations   | `src/semantic/visitors/type-checker/declarations.ts` |
| 5.7.3 | Check function declarations   | `src/semantic/visitors/type-checker/declarations.ts` |
| 5.7.4 | Check parameter declarations  | `src/semantic/visitors/type-checker/declarations.ts` |
| 5.7.5 | Check import declarations     | `src/semantic/visitors/type-checker/declarations.ts` |
| 5.7.6 | Check export declarations     | `src/semantic/visitors/type-checker/declarations.ts` |
| 5.7.7 | Add declaration tests         | `src/__tests__/semantic/type-checker/declarations.test.ts` |

**Deliverables**:
- [ ] All declarations validated
- [ ] Initializer types match declared types
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.8: StatementTypeChecker + Final TypeChecker

**Objective**: Create statement checking and final type checker

**Tasks**:

| #     | Task                          | File(s)                                  |
| ----- | ----------------------------- | ---------------------------------------- |
| 5.8.1 | Create StatementTypeChecker   | `src/semantic/visitors/type-checker/statements.ts` |
| 5.8.2 | Check if/while/for statements | `src/semantic/visitors/type-checker/statements.ts` |
| 5.8.3 | Check return statements       | `src/semantic/visitors/type-checker/statements.ts` |
| 5.8.4 | Check break/continue          | `src/semantic/visitors/type-checker/statements.ts` |
| 5.8.5 | Create final TypeChecker      | `src/semantic/visitors/type-checker/type-checker.ts` |
| 5.8.6 | Create type-checker index     | `src/semantic/visitors/type-checker/index.ts` |
| 5.8.7 | Add statement tests           | `src/__tests__/semantic/type-checker/statements.test.ts` |
| 5.8.8 | Add integration tests         | `src/__tests__/semantic/type-checker/integration.test.ts` |

**Deliverables**:
- [ ] All statements validated
- [ ] break/continue only in loops
- [ ] Return types match function
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.9: Control Flow Analysis (Pass 5)

**Objective**: Create control flow graph building

**Tasks**:

| #     | Task                          | File(s)                                  |
| ----- | ----------------------------- | ---------------------------------------- |
| 5.9.1 | Create CFG types              | `src/semantic/control-flow.ts`           |
| 5.9.2 | Create BasicBlock class       | `src/semantic/control-flow.ts`           |
| 5.9.3 | Create CFGBuilder             | `src/semantic/control-flow.ts`           |
| 5.9.4 | Create ControlFlowAnalyzer    | `src/semantic/visitors/control-flow-analyzer.ts` |
| 5.9.5 | Build CFGs for functions      | `src/semantic/visitors/control-flow-analyzer.ts` |
| 5.9.6 | Detect unreachable code       | `src/semantic/visitors/control-flow-analyzer.ts` |
| 5.9.7 | Add CFG tests                 | `src/__tests__/semantic/control-flow.test.ts` |

**Deliverables**:
- [ ] CFGs built for all functions
- [ ] Unreachable code detected
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.10: Multi-Module Support (Part 1)

**Objective**: Create module registry and dependency graph

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.10.1 | Create ModuleRegistry         | `src/semantic/module-registry.ts`        |
| 5.10.2 | Create DependencyGraph        | `src/semantic/dependency-graph.ts`       |
| 5.10.3 | Add cycle detection           | `src/semantic/dependency-graph.ts`       |
| 5.10.4 | Add topological sort          | `src/semantic/dependency-graph.ts`       |
| 5.10.5 | Add module registry tests     | `src/__tests__/semantic/module-registry.test.ts` |
| 5.10.6 | Add dependency graph tests    | `src/__tests__/semantic/dependency-graph.test.ts` |

**Deliverables**:
- [ ] Module registry tracks all modules
- [ ] Dependency graph detects cycles
- [ ] Topological sort provides compile order
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.11: Multi-Module Support (Part 2)

**Objective**: Create import resolver and global symbol table

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.11.1 | Create ImportResolver         | `src/semantic/import-resolver.ts`        |
| 5.11.2 | Validate imports              | `src/semantic/import-resolver.ts`        |
| 5.11.3 | Create GlobalSymbolTable      | `src/semantic/global-symbol-table.ts`    |
| 5.11.4 | Aggregate module exports      | `src/semantic/global-symbol-table.ts`    |
| 5.11.5 | Cross-module symbol lookup    | `src/semantic/global-symbol-table.ts`    |
| 5.11.6 | Add import resolver tests     | `src/__tests__/semantic/import-resolver.test.ts` |
| 5.11.7 | Add global symbol table tests | `src/__tests__/semantic/global-symbol-table.test.ts` |

**Deliverables**:
- [ ] Import resolution works
- [ ] Global symbol table aggregates exports
- [ ] Cross-module type checking works
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.12: Call Graph + Recursion Detection (Pass 6)

**Objective**: Build call graph and detect recursion (SFA-critical)

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.12.1 | Create CallGraphNode type     | `src/semantic/call-graph.ts`             |
| 5.12.2 | Create CallGraphBuilder       | `src/semantic/call-graph.ts`             |
| 5.12.3 | Walk AST for function calls   | `src/semantic/call-graph.ts`             |
| 5.12.4 | Create RecursionChecker       | `src/semantic/recursion-checker.ts`      |
| 5.12.5 | Detect direct recursion       | `src/semantic/recursion-checker.ts`      |
| 5.12.6 | Detect indirect recursion     | `src/semantic/recursion-checker.ts`      |
| 5.12.7 | Add recursion error messages  | `src/semantic/recursion-checker.ts`      |
| 5.12.8 | Add call graph tests          | `src/__tests__/semantic/call-graph.test.ts` |
| 5.12.9 | Add recursion tests           | `src/__tests__/semantic/recursion-checker.test.ts` |

**Deliverables**:
- [ ] Call graph built correctly
- [ ] Direct recursion DETECTED as ERROR
- [ ] Indirect recursion DETECTED as ERROR
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.13: Advanced Analysis (Part 1)

**Objective**: Create definite assignment and variable usage analysis

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.13.1 | Create DefiniteAssignmentAnalyzer | `src/semantic/analysis/definite-assignment.ts` |
| 5.13.2 | Detect uninitialized variables | `src/semantic/analysis/definite-assignment.ts` |
| 5.13.3 | Create VariableUsageAnalyzer  | `src/semantic/analysis/variable-usage.ts` |
| 5.13.4 | Detect unused variables       | `src/semantic/analysis/variable-usage.ts` |
| 5.13.5 | Detect unused parameters      | `src/semantic/analysis/variable-usage.ts` |
| 5.13.6 | Add definite assignment tests | `src/__tests__/semantic/analysis/definite-assignment.test.ts` |
| 5.13.7 | Add variable usage tests      | `src/__tests__/semantic/analysis/variable-usage.test.ts` |

**Deliverables**:
- [ ] Uninitialized variable warnings
- [ ] Unused variable warnings
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.14: Advanced Analysis (Part 2)

**Objective**: Create dead code and liveness analysis

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.14.1 | Create DeadCodeAnalyzer       | `src/semantic/analysis/dead-code.ts`     |
| 5.14.2 | Detect unreachable code       | `src/semantic/analysis/dead-code.ts`     |
| 5.14.3 | Create LivenessAnalyzer       | `src/semantic/analysis/liveness.ts`      |
| 5.14.4 | Compute live-in/live-out      | `src/semantic/analysis/liveness.ts`      |
| 5.14.5 | Add dead code tests           | `src/__tests__/semantic/analysis/dead-code.test.ts` |
| 5.14.6 | Add liveness tests            | `src/__tests__/semantic/analysis/liveness.test.ts` |

**Deliverables**:
- [ ] Dead code warnings
- [ ] Liveness info computed
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.15: Advanced Analysis (Part 3)

**Objective**: Create purity, loop, and M6502 analysis

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.15.1 | Create PurityAnalyzer         | `src/semantic/analysis/purity-analysis.ts` |
| 5.15.2 | Detect function side effects  | `src/semantic/analysis/purity-analysis.ts` |
| 5.15.3 | Create LoopAnalyzer           | `src/semantic/analysis/loop-analysis.ts`  |
| 5.15.4 | Detect loop invariants        | `src/semantic/analysis/loop-analysis.ts`  |
| 5.15.5 | Create M6502HintAnalyzer      | `src/semantic/analysis/m6502-hints.ts`   |
| 5.15.6 | Identify zero-page candidates | `src/semantic/analysis/m6502-hints.ts`   |
| 5.15.7 | Add purity tests              | `src/__tests__/semantic/analysis/purity.test.ts` |
| 5.15.8 | Add loop analysis tests       | `src/__tests__/semantic/analysis/loop.test.ts` |
| 5.15.9 | Add M6502 hints tests         | `src/__tests__/semantic/analysis/m6502-hints.test.ts` |

**Deliverables**:
- [ ] Purity analysis works
- [ ] Loop analysis works
- [ ] 6502 optimization hints generated
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.16: Advanced Analyzer Orchestrator

**Objective**: Create orchestrator for all advanced analysis passes

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.16.1 | Create AdvancedAnalyzer       | `src/semantic/analysis/advanced-analyzer.ts` |
| 5.16.2 | Orchestrate Tier 1 analysis   | `src/semantic/analysis/advanced-analyzer.ts` |
| 5.16.3 | Orchestrate Tier 2 analysis   | `src/semantic/analysis/advanced-analyzer.ts` |
| 5.16.4 | Orchestrate Tier 3 analysis   | `src/semantic/analysis/advanced-analyzer.ts` |
| 5.16.5 | Create analysis index.ts      | `src/semantic/analysis/index.ts`         |
| 5.16.6 | Add orchestrator tests        | `src/__tests__/semantic/analysis/advanced-analyzer.test.ts` |

**Deliverables**:
- [ ] All analysis passes orchestrated
- [ ] Diagnostics collected
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.17: Main Semantic Analyzer

**Objective**: Create main analyzer entry point with multi-pass orchestration

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.17.1 | Create AnalysisResult types   | `src/semantic/analyzer.ts`               |
| 5.17.2 | Create SemanticAnalyzer class | `src/semantic/analyzer.ts`               |
| 5.17.3 | Implement single-module API   | `src/semantic/analyzer.ts`               |
| 5.17.4 | Implement multi-module API    | `src/semantic/analyzer.ts`               |
| 5.17.5 | Wire up all passes (1-7)      | `src/semantic/analyzer.ts`               |
| 5.17.6 | Create visitors index.ts      | `src/semantic/visitors/index.ts`         |
| 5.17.7 | Create semantic index.ts      | `src/semantic/index.ts`                  |
| 5.17.8 | Add analyzer tests            | `src/__tests__/semantic/analyzer.test.ts` |

**Deliverables**:
- [ ] Single-module analysis works
- [ ] Multi-module analysis works
- [ ] All passes integrated
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.18: Semantic Integration Tests

**Objective**: Create comprehensive integration tests

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.18.1 | Add end-to-end semantic tests | `src/__tests__/semantic/e2e/`            |
| 5.18.2 | Test complete type checking   | `src/__tests__/semantic/e2e/`            |
| 5.18.3 | Test multi-module analysis    | `src/__tests__/semantic/e2e/`            |
| 5.18.4 | Test recursion errors         | `src/__tests__/semantic/e2e/`            |
| 5.18.5 | Test all warning types        | `src/__tests__/semantic/e2e/`            |
| 5.18.6 | Verify production quality     | `src/__tests__/semantic/e2e/`            |

**Deliverables**:
- [ ] All E2E tests pass
- [ ] Coverage meets requirements

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.19: Error Messages

**Objective**: Create comprehensive error message tests

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.19.1 | Create type error tests       | `src/__tests__/semantic/errors/type-errors.test.ts` |
| 5.19.2 | Create recursion error tests  | `src/__tests__/semantic/errors/recursion-errors.test.ts` |
| 5.19.3 | Create import error tests     | `src/__tests__/semantic/errors/import-errors.test.ts` |
| 5.19.4 | Create semantic error tests   | `src/__tests__/semantic/errors/semantic-errors.test.ts` |
| 5.19.5 | Verify error message quality  | All error test files |

**Deliverables**:
- [ ] All error types have tests
- [ ] Error messages are clear and helpful
- [ ] All tests pass (105+ tests)

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.20: Main Analyzer Tests

**Objective**: Create comprehensive tests for main analyzer entry point

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.20.1 | Test single-module analysis   | `src/__tests__/semantic/analyzer.test.ts` |
| 5.20.2 | Test multi-module analysis    | `src/__tests__/semantic/analyzer.test.ts` |
| 5.20.3 | Test pass orchestration       | `src/__tests__/semantic/analyzer.test.ts` |
| 5.20.4 | Test diagnostic collection    | `src/__tests__/semantic/analyzer.test.ts` |
| 5.20.5 | Test analysis result types    | `src/__tests__/semantic/analyzer.test.ts` |

**Deliverables**:
- [ ] Full analyzer coverage
- [ ] All passes tested
- [ ] All tests pass (40+ tests)

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.21: E2E Tests (Part 1)

**Objective**: Create end-to-end tests for simple and complex programs

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.21.1 | Test simple variable programs | `src/__tests__/semantic/e2e/simple-programs.test.ts` |
| 5.21.2 | Test simple function programs | `src/__tests__/semantic/e2e/simple-programs.test.ts` |
| 5.21.3 | Test simple expression progs  | `src/__tests__/semantic/e2e/simple-programs.test.ts` |
| 5.21.4 | Test complex multi-function   | `src/__tests__/semantic/e2e/complex-programs.test.ts` |
| 5.21.5 | Test complex control flow     | `src/__tests__/semantic/e2e/complex-programs.test.ts` |
| 5.21.6 | Test complex nested scopes    | `src/__tests__/semantic/e2e/complex-programs.test.ts` |

**Deliverables**:
- [ ] Simple programs fully analyzed
- [ ] Complex programs fully analyzed
- [ ] All tests pass (55+ tests)

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

### Session 5.22: E2E Tests (Part 2) + Final Verification

**Objective**: Create real-world and stress tests, final verification

**Tasks**:

| #      | Task                          | File(s)                                  |
| ------ | ----------------------------- | ---------------------------------------- |
| 5.22.1 | Test C64 programming patterns | `src/__tests__/semantic/e2e/real-world.test.ts` |
| 5.22.2 | Test game-like programs       | `src/__tests__/semantic/e2e/real-world.test.ts` |
| 5.22.3 | Test hardware access patterns | `src/__tests__/semantic/e2e/real-world.test.ts` |
| 5.22.4 | Create stress tests           | `src/__tests__/semantic/e2e/stress-tests.test.ts` |
| 5.22.5 | Test large programs           | `src/__tests__/semantic/e2e/stress-tests.test.ts` |
| 5.22.6 | Final Phase 5 verification    | All semantic test files |

**Deliverables**:
- [ ] Real-world patterns work
- [ ] Stress tests pass
- [ ] All 1,295+ tests pass
- [ ] Phase 5 COMPLETE

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 6: Frame Allocator (NEW)

### Session 6.1: Frame Allocator Types

**Objective**: Define frame allocator data structures

**Tasks**:

| #     | Task                    | File(s)                |
| ----- | ----------------------- | ---------------------- |
| 6.1.1 | Define Frame type       | `src/frame/types.ts`   |
| 6.1.2 | Define FrameSlot type   | `src/frame/types.ts`   |
| 6.1.3 | Define FrameMap type    | `src/frame/types.ts`   |
| 6.1.4 | Create frame tests file | `src/__tests__/frame/` |

### Session 6.2: Call Graph Builder

**Objective**: Build call graph from AST

**Tasks**:

| #     | Task                       | File(s)                   |
| ----- | -------------------------- | ------------------------- |
| 6.2.1 | Create call graph builder  | `src/frame/call-graph.ts` |
| 6.2.2 | Implement function visitor | `src/frame/call-graph.ts` |
| 6.2.3 | Build caller/callee maps   | `src/frame/call-graph.ts` |
| 6.2.4 | Add call graph tests       | `src/__tests__/frame/`    |

### Session 6.3: Recursion Detection

**Objective**: Detect direct and indirect recursion

**Tasks**:

| #     | Task                      | File(s)                  |
| ----- | ------------------------- | ------------------------ |
| 6.3.1 | Implement cycle detection | `src/frame/recursion.ts` |
| 6.3.2 | Create error messages     | `src/frame/recursion.ts` |
| 6.3.3 | Add recursion tests       | `src/__tests__/frame/`   |

### Session 6.4: Frame Address Allocator

**Objective**: Allocate static addresses for frames

**Tasks**:

| #     | Task                     | File(s)                  |
| ----- | ------------------------ | ------------------------ |
| 6.4.1 | Calculate frame sizes    | `src/frame/allocator.ts` |
| 6.4.2 | Assign frame addresses   | `src/frame/allocator.ts` |
| 6.4.3 | Handle param/local slots | `src/frame/allocator.ts` |
| 6.4.4 | Add allocator tests      | `src/__tests__/frame/`   |
| 6.4.5 | Create frame index.ts    | `src/frame/index.ts`     |

**Deliverables**:

- [ ] Frame allocator compiles
- [ ] Call graph built correctly
- [ ] Recursion detected
- [ ] Frames allocated with addresses
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 7: Simple IL (NEW)

### Session 7.1: IL Types

**Objective**: Define simple linear IL

**Tasks**:

| #     | Task                       | File(s)           |
| ----- | -------------------------- | ----------------- |
| 7.1.1 | Define IL opcode enum      | `src/il/types.ts` |
| 7.1.2 | Define IL instruction type | `src/il/types.ts` |
| 7.1.3 | Define IL program type     | `src/il/types.ts` |
| 7.1.4 | Define IL function type    | `src/il/types.ts` |

### Session 7.2: IL Builder

**Objective**: Create IL construction utilities

**Tasks**:

| #     | Task                      | File(s)             |
| ----- | ------------------------- | ------------------- |
| 7.2.1 | Create IL builder class   | `src/il/builder.ts` |
| 7.2.2 | Add instruction factories | `src/il/builder.ts` |
| 7.2.3 | Add label management      | `src/il/builder.ts` |
| 7.2.4 | Add builder tests         | `src/__tests__/il/` |

### Session 7.3: IL Generator

**Objective**: Generate IL from AST + frames

**Tasks**:

| #     | Task                      | File(s)               |
| ----- | ------------------------- | --------------------- |
| 7.3.1 | Create IL generator class | `src/il/generator.ts` |
| 7.3.2 | Generate for expressions  | `src/il/generator.ts` |
| 7.3.3 | Generate for statements   | `src/il/generator.ts` |
| 7.3.4 | Generate for functions    | `src/il/generator.ts` |

### Session 7.4: IL Generator Control Flow

**Objective**: Generate IL for control flow

**Tasks**:

| #     | Task                        | File(s)               |
| ----- | --------------------------- | --------------------- |
| 7.4.1 | Generate for if/else        | `src/il/generator.ts` |
| 7.4.2 | Generate for while loops    | `src/il/generator.ts` |
| 7.4.3 | Generate for for loops      | `src/il/generator.ts` |
| 7.4.4 | Generate for break/continue | `src/il/generator.ts` |
| 7.4.5 | Add generator tests         | `src/__tests__/il/`   |
| 7.4.6 | Create IL index.ts          | `src/il/index.ts`     |

**Deliverables**:

- [ ] IL types defined
- [ ] IL builder works
- [ ] IL generator produces correct output
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 8: Code Generator (NEW)

### Session 8.1: CodeGen Base

**Objective**: Create SFA-based code generator

**Tasks**:

| #     | Task                 | File(s)                    |
| ----- | -------------------- | -------------------------- |
| 8.1.1 | Create codegen class | `src/codegen/generator.ts` |
| 8.1.2 | Set up ASM-IL output | `src/codegen/generator.ts` |
| 8.1.3 | Implement load/store | `src/codegen/generator.ts` |

### Session 8.2: CodeGen Arithmetic

**Objective**: Generate code for arithmetic

**Tasks**:

| #     | Task                         | File(s)                    |
| ----- | ---------------------------- | -------------------------- |
| 8.2.1 | Generate for byte add/sub    | `src/codegen/generator.ts` |
| 8.2.2 | Generate for byte mul/div    | `src/codegen/generator.ts` |
| 8.2.3 | Generate for word operations | `src/codegen/generator.ts` |
| 8.2.4 | Add codegen tests            | `src/__tests__/codegen/`   |

### Session 8.3: CodeGen Comparison

**Objective**: Generate code for comparisons

**Tasks**:

| #     | Task                         | File(s)                    |
| ----- | ---------------------------- | -------------------------- |
| 8.3.1 | Generate for byte compare    | `src/codegen/generator.ts` |
| 8.3.2 | Generate for word compare    | `src/codegen/generator.ts` |
| 8.3.3 | Generate branch instructions | `src/codegen/generator.ts` |

### Session 8.4: CodeGen Control Flow

**Objective**: Generate code for control flow

**Tasks**:

| #     | Task                      | File(s)                    |
| ----- | ------------------------- | -------------------------- |
| 8.4.1 | Generate for jumps        | `src/codegen/generator.ts` |
| 8.4.2 | Generate for conditionals | `src/codegen/generator.ts` |
| 8.4.3 | Generate for loops        | `src/codegen/generator.ts` |

### Session 8.5: CodeGen Functions & Intrinsics

**Objective**: Generate code for functions and intrinsics

**Tasks**:

| #     | Task                        | File(s)                    |
| ----- | --------------------------- | -------------------------- |
| 8.5.1 | Generate for function calls | `src/codegen/generator.ts` |
| 8.5.2 | Generate for returns        | `src/codegen/generator.ts` |
| 8.5.3 | Generate for peek/poke      | `src/codegen/generator.ts` |
| 8.5.4 | Generate for hi/lo          | `src/codegen/generator.ts` |
| 8.5.5 | Add comprehensive tests     | `src/__tests__/codegen/`   |
| 8.5.6 | Create codegen index.ts     | `src/codegen/index.ts`     |

**Deliverables**:

- [ ] Code generator produces correct ASM-IL
- [ ] All IL opcodes handled
- [ ] Intrinsics generate correct code
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 9: ASM Optimizer

### Session 9.1: Optimizer Infrastructure

**Objective**: Set up optimizer architecture

**Tasks**:

| #     | Task                            | File(s)                      |
| ----- | ------------------------------- | ---------------------------- |
| 9.1.1 | Copy optimizer types            | `src/optimizer/types.ts`     |
| 9.1.2 | Create optimizer pass interface | `src/optimizer/pass.ts`      |
| 9.1.3 | Create optimizer runner         | `src/optimizer/optimizer.ts` |

### Session 9.2: Peephole Passes

**Objective**: Implement peephole optimization passes

**Tasks**:

| #     | Task                       | File(s)                    |
| ----- | -------------------------- | -------------------------- |
| 9.2.1 | Redundant load elimination | `src/optimizer/passes/`    |
| 9.2.2 | Dead store elimination     | `src/optimizer/passes/`    |
| 9.2.3 | Add optimizer tests        | `src/__tests__/optimizer/` |

### Session 9.3: ASM Emitter

**Objective**: Emit ACME assembler output

**Tasks**:

| #     | Task                      | File(s)                  |
| ----- | ------------------------- | ------------------------ |
| 9.3.1 | Copy ASM-IL emitter       | `src/asm-il/emitter.ts`  |
| 9.3.2 | Update for v2             | `src/asm-il/emitter.ts`  |
| 9.3.3 | Create optimizer index.ts | `src/optimizer/index.ts` |

**Deliverables**:

- [ ] Optimizer infrastructure works
- [ ] Peephole passes reduce code
- [ ] ACME output generated
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 10: Integration & Testing

### Session 10.1: Compiler Entry Point

**Objective**: Create main compiler entry

**Tasks**:

| #      | Task                    | File(s)           |
| ------ | ----------------------- | ----------------- |
| 10.1.1 | Create Compiler class   | `src/compiler.ts` |
| 10.1.2 | Wire up pipeline stages | `src/compiler.ts` |
| 10.1.3 | Add optimization levels | `src/compiler.ts` |
| 10.1.4 | Export public API       | `src/index.ts`    |

### Session 10.2: End-to-End Tests

**Objective**: Test complete pipeline

**Tasks**:

| #      | Task                     | File(s)              |
| ------ | ------------------------ | -------------------- |
| 10.2.1 | Create E2E test fixtures | `src/__tests__/e2e/` |
| 10.2.2 | Test simple programs     | `src/__tests__/e2e/` |
| 10.2.3 | Test control flow        | `src/__tests__/e2e/` |
| 10.2.4 | Test functions           | `src/__tests__/e2e/` |

### Session 10.3: Example Programs

**Objective**: Verify with real programs

**Tasks**:

| #      | Task                  | File(s)       |
| ------ | --------------------- | ------------- |
| 10.3.1 | Compile hello world   | examples/     |
| 10.3.2 | Test in VICE emulator | manual        |
| 10.3.3 | Fix any issues        | varies        |
| 10.3.4 | Update CLI to use v2  | packages/cli/ |

**Deliverables**:

- [ ] Compiler class works
- [ ] All E2E tests pass
- [ ] Example programs compile
- [ ] Output runs in VICE
- [ ] CLI updated

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Task Checklist (All Phases)

### Phase 1: Package Setup

- [x] 1.1.1 Create package.json
- [x] 1.1.2 Create tsconfig.json
- [x] 1.1.3 Create directory structure
- [x] 1.1.4 Create index.ts exports
- [x] 1.1.5 Update root turbo.json (not needed - yarn workspaces auto-discovery)

### Phase 2: Lexer Migration

- [x] 2.1.1 Copy lexer types
- [x] 2.1.2 Remove @map token types
- [x] 2.1.3 Copy lexer implementation
- [x] 2.1.4 Remove @map tokenization
- [x] 2.1.5 Copy lexer tests
- [x] 2.1.6 Update tests (remove @map)
- [x] 2.1.7 Create lexer index.ts

### Phase 3: Parser Migration ✅ COMPLETE

- [x] 3.1.1 Copy parser base ✅
- [x] 3.1.2 Copy expression parsing ✅
- [x] 3.1.3 Copy statement parsing ✅
- [x] 3.1.4 Copy declaration parsing ✅
- [x] 3.2.1 Remove @map from declarations ✅
- [x] 3.2.2 Update parser entry ✅
- [x] 3.2.3 Copy parser tests (18/18 files migrated) ✅
  - [x] expression-parser.test.ts
  - [x] control-flow.test.ts
  - [x] function-declarations.test.ts
  - [x] base-parser.test.ts
  - [x] module-parser.test.ts
  - [x] scope-manager.test.ts
  - [x] declaration-parser.test.ts
  - [x] ternary-expression.test.ts
  - [x] array-literals.test.ts
  - [x] array-size-inference-basic.test.ts
  - [x] elseif.test.ts
  - [x] type-system.test.ts
  - [x] advanced-expressions.test.ts
  - [x] parser-integration.test.ts
  - [x] phase3-integration.test.ts
  - [x] end-to-end.test.ts
  - [x] import-export-integration.test.ts
  - [x] error-messages.test.ts
- [x] 3.2.4 Remove @map test cases ✅
- [x] 3.2.5 Create parser index.ts ✅

### Phase 4: AST Migration ✅ COMPLETE

- [x] 4.1.1 Copy AST base types
- [x] 4.1.2 Copy AST node types
- [x] 4.1.3 Remove @map AST nodes
- [x] 4.1.4 Copy type guards
- [x] 4.1.5 Update type guards
- [x] 4.1.6 Copy visitor pattern (walker infrastructure: base, collector, context, transformer)
- [x] 4.1.7 Create AST index.ts
- [x] 4.1.8 Create type-guards tests (36 tests)
- [x] 4.1.9 Create walker/base tests (25 tests)
- [x] 4.1.10 Create walker/collector tests (34 tests)
- [x] 4.1.11 Create walker/context tests (41 tests)
- [x] 4.1.12 Create walker/transformer tests (46 tests)

### Phase 5: Semantic Analyzer (Write From Scratch)

**Session 5.1: Core Foundation** ✅ COMPLETE (2025-01-30)
- [x] 5.1.1 Create Symbol interface ✅
- [x] 5.1.2 Create SymbolKind enum ✅
- [x] 5.1.3 Create Scope interface ✅
- [x] 5.1.4 Create ScopeKind enum ✅
- [x] 5.1.5 Create SymbolTable class ✅
- [x] 5.1.6 Add scope management ✅
- [x] 5.1.7 Add symbol tests ✅ (74 tests)
- [x] 5.1.8 Add scope tests ✅ (73 tests)
- [x] 5.1.9 Add SymbolTable tests ✅ (87 tests)

**Session 5.2: Type System** ✅ COMPLETE (2025-01-30)
- [x] 5.2.1 Update types.ts (add TypeCompatibility) ✅
- [x] 5.2.2 Create TypeSystem class ✅
- [x] 5.2.3 Add built-in types ✅
- [x] 5.2.4 Add type compatibility check ✅
- [x] 5.2.5 Add array type creation ✅
- [x] 5.2.6 Add function type creation ✅
- [x] 5.2.7 Add binary/unary op types ✅
- [x] 5.2.8 Add type system tests ✅ (151 tests across 5 files)

**Session 5.3: Symbol Table Builder (Pass 1)** ✅ COMPLETE (2025-01-30)
- [x] 5.3.1 Create SymbolTableBuilder ✅
- [x] 5.3.2 Visit module declarations ✅
- [x] 5.3.3 Visit function declarations ✅
- [x] 5.3.4 Visit variable declarations ✅
- [x] 5.3.5 Visit parameters ✅
- [x] 5.3.6 Handle exports/imports ✅
- [x] 5.3.7 Add builder tests ✅ (40 tests - all passing, 7 tests fixed 2025-01-31)

**Session 5.4: Type Resolution (Pass 2)** ✅ COMPLETE (2025-01-30)
- [x] 5.4.1 Create TypeResolver visitor ✅
- [x] 5.4.2 Resolve variable types ✅
- [x] 5.4.3 Resolve function return types ✅
- [x] 5.4.4 Resolve parameter types ✅
- [x] 5.4.5 Handle array types ✅
- [x] 5.4.6 Add resolver tests ✅ (33 tests)

**Session 5.5: TypeCheckerBase + LiteralTypeChecker** ✅ COMPLETE (2025-01-30)
- [x] 5.5.1 Create TypeCheckerBase ✅
- [x] 5.5.2 Add diagnostic utilities ✅
- [x] 5.5.3 Add symbol lookup utilities ✅
- [x] 5.5.4 Create LiteralTypeChecker ✅
- [x] 5.5.5 Check numeric literals ✅
- [x] 5.5.6 Check string/bool literals ✅
- [x] 5.5.7 Check array literals ✅
- [x] 5.5.8 Add literal tests ✅ (53 tests)

**Session 5.6: ExpressionTypeChecker** ✅ COMPLETE (2025-01-31)
- [x] 5.6.1 Create ExpressionTypeChecker ✅
- [x] 5.6.2 Check identifier expressions ✅
- [x] 5.6.3 Check binary expressions ✅
- [x] 5.6.4 Check unary expressions ✅
- [x] 5.6.5 Check call expressions ✅
- [x] 5.6.6 Check index expressions ✅
- [x] 5.6.7 Check ternary expressions ✅
- [x] 5.6.8 Check assignment expressions ✅
- [x] 5.6.9 Add expression tests ✅ (60 tests)

**Session 5.7: DeclarationTypeChecker** ✅ COMPLETE (2025-01-31)
- [x] 5.7.1 Create DeclarationTypeChecker ✅
- [x] 5.7.2 Check variable declarations ✅
- [x] 5.7.3 Check function declarations ✅
- [x] 5.7.4 Check parameter declarations ✅
- [x] 5.7.5 Check import declarations ✅
- [x] 5.7.6 Check export declarations ✅
- [x] 5.7.7 Add declaration tests ✅ (42 tests, 9 skipped for full pipeline)

**Session 5.8: StatementTypeChecker + Final TypeChecker** ✅ COMPLETE (2025-01-31)
- [x] 5.8.1 Create StatementTypeChecker ✅
- [x] 5.8.2 Check if/while/for statements ✅
- [x] 5.8.3 Check return statements ✅
- [x] 5.8.4 Check break/continue ✅
- [x] 5.8.5 Create final TypeChecker ✅
- [x] 5.8.6 Create type-checker index ✅
- [x] 5.8.7 Add statement tests ✅ (70+ tests)
- [x] 5.8.8 Add integration tests ✅ (16 skipped for full pipeline)

**Session 5.9: Control Flow Analysis (Pass 5)** ✅ COMPLETE (2025-01-31)
- [x] 5.9.1 Create CFG types ✅
- [x] 5.9.2 Create BasicBlock class (CFGNode + CFGBuilder) ✅
- [x] 5.9.3 Create CFGBuilder ✅
- [x] 5.9.4 Create ControlFlowAnalyzer ✅
- [x] 5.9.5 Build CFGs for functions ✅
- [x] 5.9.6 Detect unreachable code ✅
- [x] 5.9.7 Add CFG tests ✅ (59 tests)

**Session 5.10: Multi-Module Support (Part 1)** ✅ COMPLETE (2025-01-31)
- [x] 5.10.1 Create ModuleRegistry ✅
- [x] 5.10.2 Create DependencyGraph ✅
- [x] 5.10.3 Add cycle detection ✅
- [x] 5.10.4 Add topological sort ✅
- [x] 5.10.5 Add module registry tests ✅ (35 tests)
- [x] 5.10.6 Add dependency graph tests ✅ (57 tests)

**Session 5.11: Multi-Module Support (Part 2)** ✅ COMPLETE (2025-01-31)
- [x] 5.11.1 Create ImportResolver ✅
- [x] 5.11.2 Validate imports ✅
- [x] 5.11.3 Create GlobalSymbolTable ✅
- [x] 5.11.4 Aggregate module exports ✅
- [x] 5.11.5 Cross-module symbol lookup ✅
- [x] 5.11.6 Add import resolver tests ✅ (35 tests)
- [x] 5.11.7 Add global symbol table tests ✅ (56 tests)

**Session 5.12: Call Graph + Recursion Detection (Pass 6)**
- [ ] 5.12.1 Create CallGraphNode type
- [ ] 5.12.2 Create CallGraphBuilder
- [ ] 5.12.3 Walk AST for function calls
- [ ] 5.12.4 Create RecursionChecker
- [ ] 5.12.5 Detect direct recursion
- [ ] 5.12.6 Detect indirect recursion
- [ ] 5.12.7 Add recursion error messages
- [ ] 5.12.8 Add call graph tests
- [ ] 5.12.9 Add recursion tests

**Session 5.13: Advanced Analysis (Part 1)**
- [ ] 5.13.1 Create DefiniteAssignmentAnalyzer
- [ ] 5.13.2 Detect uninitialized variables
- [ ] 5.13.3 Create VariableUsageAnalyzer
- [ ] 5.13.4 Detect unused variables
- [ ] 5.13.5 Detect unused parameters
- [ ] 5.13.6 Add definite assignment tests
- [ ] 5.13.7 Add variable usage tests

**Session 5.14: Advanced Analysis (Part 2)**
- [ ] 5.14.1 Create DeadCodeAnalyzer
- [ ] 5.14.2 Detect unreachable code
- [ ] 5.14.3 Create LivenessAnalyzer
- [ ] 5.14.4 Compute live-in/live-out
- [ ] 5.14.5 Add dead code tests
- [ ] 5.14.6 Add liveness tests

**Session 5.15: Advanced Analysis (Part 3)**
- [ ] 5.15.1 Create PurityAnalyzer
- [ ] 5.15.2 Detect function side effects
- [ ] 5.15.3 Create LoopAnalyzer
- [ ] 5.15.4 Detect loop invariants
- [ ] 5.15.5 Create M6502HintAnalyzer
- [ ] 5.15.6 Identify zero-page candidates
- [ ] 5.15.7 Add purity tests
- [ ] 5.15.8 Add loop analysis tests
- [ ] 5.15.9 Add M6502 hints tests

**Session 5.16: Advanced Analyzer Orchestrator**
- [ ] 5.16.1 Create AdvancedAnalyzer
- [ ] 5.16.2 Orchestrate Tier 1 analysis
- [ ] 5.16.3 Orchestrate Tier 2 analysis
- [ ] 5.16.4 Orchestrate Tier 3 analysis
- [ ] 5.16.5 Create analysis index.ts
- [ ] 5.16.6 Add orchestrator tests

**Session 5.17: Main Semantic Analyzer**
- [ ] 5.17.1 Create AnalysisResult types
- [ ] 5.17.2 Create SemanticAnalyzer class
- [ ] 5.17.3 Implement single-module API
- [ ] 5.17.4 Implement multi-module API
- [ ] 5.17.5 Wire up all passes (1-7)
- [ ] 5.17.6 Create visitors index.ts
- [ ] 5.17.7 Create semantic index.ts
- [ ] 5.17.8 Add analyzer tests

**Session 5.18: Semantic Integration Tests**
- [ ] 5.18.1 Add end-to-end semantic tests
- [ ] 5.18.2 Test complete type checking
- [ ] 5.18.3 Test multi-module analysis
- [ ] 5.18.4 Test recursion errors
- [ ] 5.18.5 Test all warning types
- [ ] 5.18.6 Verify production quality

**Session 5.19: Error Messages**
- [ ] 5.19.1 Create type error tests
- [ ] 5.19.2 Create recursion error tests
- [ ] 5.19.3 Create import error tests
- [ ] 5.19.4 Create semantic error tests
- [ ] 5.19.5 Verify error message quality

**Session 5.20: Main Analyzer Tests**
- [ ] 5.20.1 Test single-module analysis
- [ ] 5.20.2 Test multi-module analysis
- [ ] 5.20.3 Test pass orchestration
- [ ] 5.20.4 Test diagnostic collection
- [ ] 5.20.5 Test analysis result types

**Session 5.21: E2E Tests (Part 1)**
- [ ] 5.21.1 Test simple variable programs
- [ ] 5.21.2 Test simple function programs
- [ ] 5.21.3 Test simple expression programs
- [ ] 5.21.4 Test complex multi-function
- [ ] 5.21.5 Test complex control flow
- [ ] 5.21.6 Test complex nested scopes

**Session 5.22: E2E Tests (Part 2) + Final Verification**
- [ ] 5.22.1 Test C64 programming patterns
- [ ] 5.22.2 Test game-like programs
- [ ] 5.22.3 Test hardware access patterns
- [ ] 5.22.4 Create stress tests
- [ ] 5.22.5 Test large programs
- [ ] 5.22.6 Final Phase 5 verification

### Phase 6: Frame Allocator (NEW)

- [ ] 6.1.1 Define Frame type
- [ ] 6.1.2 Define FrameSlot type
- [ ] 6.1.3 Define FrameMap type
- [ ] 6.1.4 Create frame tests file
- [ ] 6.2.1 Create call graph builder
- [ ] 6.2.2 Implement function visitor
- [ ] 6.2.3 Build caller/callee maps
- [ ] 6.2.4 Add call graph tests
- [ ] 6.3.1 Implement cycle detection
- [ ] 6.3.2 Create error messages
- [ ] 6.3.3 Add recursion tests
- [ ] 6.4.1 Calculate frame sizes
- [ ] 6.4.2 Assign frame addresses
- [ ] 6.4.3 Handle param/local slots
- [ ] 6.4.4 Add allocator tests
- [ ] 6.4.5 Create frame index.ts

### Phase 7: Simple IL (NEW)

- [ ] 7.1.1 Define IL opcode enum
- [ ] 7.1.2 Define IL instruction type
- [ ] 7.1.3 Define IL program type
- [ ] 7.1.4 Define IL function type
- [ ] 7.2.1 Create IL builder class
- [ ] 7.2.2 Add instruction factories
- [ ] 7.2.3 Add label management
- [ ] 7.2.4 Add builder tests
- [ ] 7.3.1 Create IL generator class
- [ ] 7.3.2 Generate for expressions
- [ ] 7.3.3 Generate for statements
- [ ] 7.3.4 Generate for functions
- [ ] 7.4.1 Generate for if/else
- [ ] 7.4.2 Generate for while loops
- [ ] 7.4.3 Generate for for loops
- [ ] 7.4.4 Generate for break/continue
- [ ] 7.4.5 Add generator tests
- [ ] 7.4.6 Create IL index.ts

### Phase 8: Code Generator (NEW)

- [ ] 8.1.1 Create codegen class
- [ ] 8.1.2 Set up ASM-IL output
- [ ] 8.1.3 Implement load/store
- [ ] 8.2.1 Generate for byte add/sub
- [ ] 8.2.2 Generate for byte mul/div
- [ ] 8.2.3 Generate for word operations
- [ ] 8.2.4 Add codegen tests
- [ ] 8.3.1 Generate for byte compare
- [ ] 8.3.2 Generate for word compare
- [ ] 8.3.3 Generate branch instructions
- [ ] 8.4.1 Generate for jumps
- [ ] 8.4.2 Generate for conditionals
- [ ] 8.4.3 Generate for loops
- [ ] 8.5.1 Generate for function calls
- [ ] 8.5.2 Generate for returns
- [ ] 8.5.3 Generate for peek/poke
- [ ] 8.5.4 Generate for hi/lo
- [ ] 8.5.5 Add comprehensive tests
- [ ] 8.5.6 Create codegen index.ts

### Phase 9: ASM Optimizer

- [ ] 9.1.1 Copy optimizer types
- [ ] 9.1.2 Create optimizer pass interface
- [ ] 9.1.3 Create optimizer runner
- [ ] 9.2.1 Redundant load elimination
- [ ] 9.2.2 Dead store elimination
- [ ] 9.2.3 Add optimizer tests
- [ ] 9.3.1 Copy ASM-IL emitter
- [ ] 9.3.2 Update for v2
- [ ] 9.3.3 Create optimizer index.ts

### Phase 10: Integration & Testing

- [ ] 10.1.1 Create Compiler class
- [ ] 10.1.2 Wire up pipeline stages
- [ ] 10.1.3 Add optimization levels
- [ ] 10.1.4 Export public API
- [ ] 10.2.1 Create E2E test fixtures
- [ ] 10.2.2 Test simple programs
- [ ] 10.2.3 Test control flow
- [ ] 10.2.4 Test functions
- [ ] 10.3.1 Compile hello world
- [ ] 10.3.2 Test in VICE emulator
- [ ] 10.3.3 Fix any issues
- [ ] 10.3.4 Update CLI to use v2

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/compiler-v2/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
clear && yarn clean && yarn build && yarn test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Lexer) + Phase 4 (AST)
    ↓
Phase 3 (Parser)
    ↓
Phase 5 (Semantic)
    ↓
Phase 6 (Frame Allocator)
    ↓
Phase 7 (IL Generator)
    ↓
Phase 8 (Code Generator)
    ↓
Phase 9 (ASM Optimizer)
    ↓
Phase 10 (Integration)
```

---

## Success Criteria

**Compiler v2 is complete when**:

1. ✅ All 10 phases completed
2. ✅ All ~85 tasks done
3. ✅ All tests passing
4. ✅ Can compile example programs
5. ✅ Output runs in VICE
6. ✅ CLI updated to use v2
7. ✅ Documentation complete