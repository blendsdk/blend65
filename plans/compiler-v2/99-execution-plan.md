# Execution Plan: Compiler v2

> **Document**: 99-execution-plan.md  
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the Blend65 v2 compiler with Static Frame Allocation (SFA).

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Package Setup | 1-2 | 1-2 hours |
| 2 | Lexer Migration | 1-2 | 1-2 hours |
| 3 | Parser Migration | 2-3 | 2-3 hours |
| 4 | AST Migration | 1-2 | 1-2 hours |
| 5 | Semantic Migration | 2-3 | 2-3 hours |
| 6 | Frame Allocator (NEW) | 3-4 | 3-4 hours |
| 7 | Simple IL (NEW) | 3-4 | 3-4 hours |
| 8 | Code Generator (NEW) | 4-5 | 4-5 hours |
| 9 | ASM Optimizer | 2-3 | 2-3 hours |
| 10 | Integration & Testing | 2-3 | 2-3 hours |

**Total: 22-31 sessions, ~22-31 hours**

---

## Phase 1: Package Setup

### Session 1.1: Create Package Structure

**Objective**: Set up the new compiler-v2 package

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 1.1.1 | Create package.json | `packages/compiler-v2/package.json` |
| 1.1.2 | Create tsconfig.json | `packages/compiler-v2/tsconfig.json` |
| 1.1.3 | Create directory structure | `packages/compiler-v2/src/` |
| 1.1.4 | Create index.ts exports | `packages/compiler-v2/src/index.ts` |
| 1.1.5 | Update root turbo.json | `turbo.json` |

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

| # | Task | File(s) |
|---|------|---------|
| 2.1.1 | Copy lexer types | `src/lexer/types.ts` |
| 2.1.2 | Remove @map token types | `src/lexer/types.ts` |
| 2.1.3 | Copy lexer implementation | `src/lexer/lexer.ts` |
| 2.1.4 | Remove @map tokenization | `src/lexer/lexer.ts` |
| 2.1.5 | Copy lexer tests | `src/__tests__/lexer/` |
| 2.1.6 | Update tests (remove @map) | `src/__tests__/lexer/` |
| 2.1.7 | Create lexer index.ts | `src/lexer/index.ts` |

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

| # | Task | File(s) |
|---|------|---------|
| 3.1.1 | Copy parser base | `src/parser/base.ts` |
| 3.1.2 | Copy expression parsing | `src/parser/expressions.ts` |
| 3.1.3 | Copy statement parsing | `src/parser/statements.ts` |
| 3.1.4 | Copy declaration parsing | `src/parser/declarations.ts` |

**Deliverables**:
- [ ] Parser base compiles

### Session 3.2: Remove @map Parsing

**Objective**: Remove @map syntax parsing

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 3.2.1 | Remove @map from declarations | `src/parser/declarations.ts` |
| 3.2.2 | Update parser entry | `src/parser/parser.ts` |
| 3.2.3 | Copy parser tests | `src/__tests__/parser/` |
| 3.2.4 | Remove @map test cases | `src/__tests__/parser/` |
| 3.2.5 | Create parser index.ts | `src/parser/index.ts` |

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

| # | Task | File(s) |
|---|------|---------|
| 4.1.1 | Copy AST base types | `src/ast/base.ts` |
| 4.1.2 | Copy AST node types | `src/ast/nodes.ts` |
| 4.1.3 | Remove @map AST nodes | `src/ast/nodes.ts` |
| 4.1.4 | Copy type guards | `src/ast/type-guards.ts` |
| 4.1.5 | Update type guards | `src/ast/type-guards.ts` |
| 4.1.6 | Copy visitor pattern | `src/ast/visitor.ts` |
| 4.1.7 | Create AST index.ts | `src/ast/index.ts` |

**Deliverables**:
- [ ] AST compiles
- [ ] @map nodes removed
- [ ] Type guards updated

**Verify**: `clear && yarn clean && yarn build`

---

## Phase 5: Semantic Migration

### Session 5.1: Copy Semantic Base

**Objective**: Copy semantic analysis infrastructure

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 5.1.1 | Copy symbol table | `src/semantic/symbol-table.ts` |
| 5.1.2 | Copy type system | `src/semantic/types.ts` |
| 5.1.3 | Copy type checker base | `src/semantic/type-checker.ts` |

### Session 5.2: Simplify Semantic Analysis

**Objective**: Remove SSA preparation, add recursion detection

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 5.2.1 | Remove SSA preparation code | `src/semantic/` |
| 5.2.2 | Remove @map type handling | `src/semantic/` |
| 5.2.3 | Add call graph builder | `src/semantic/call-graph.ts` |
| 5.2.4 | Add recursion detection | `src/semantic/recursion-check.ts` |
| 5.2.5 | Copy semantic tests | `src/__tests__/semantic/` |
| 5.2.6 | Add recursion error tests | `src/__tests__/semantic/` |
| 5.2.7 | Create semantic index.ts | `src/semantic/index.ts` |

**Deliverables**:
- [ ] Semantic analyzer compiles
- [ ] Recursion detection works
- [ ] All tests pass

**Verify**: `clear && yarn clean && yarn build && yarn test`

---

## Phase 6: Frame Allocator (NEW)

### Session 6.1: Frame Allocator Types

**Objective**: Define frame allocator data structures

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 6.1.1 | Define Frame type | `src/frame/types.ts` |
| 6.1.2 | Define FrameSlot type | `src/frame/types.ts` |
| 6.1.3 | Define FrameMap type | `src/frame/types.ts` |
| 6.1.4 | Create frame tests file | `src/__tests__/frame/` |

### Session 6.2: Call Graph Builder

**Objective**: Build call graph from AST

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 6.2.1 | Create call graph builder | `src/frame/call-graph.ts` |
| 6.2.2 | Implement function visitor | `src/frame/call-graph.ts` |
| 6.2.3 | Build caller/callee maps | `src/frame/call-graph.ts` |
| 6.2.4 | Add call graph tests | `src/__tests__/frame/` |

### Session 6.3: Recursion Detection

**Objective**: Detect direct and indirect recursion

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 6.3.1 | Implement cycle detection | `src/frame/recursion.ts` |
| 6.3.2 | Create error messages | `src/frame/recursion.ts` |
| 6.3.3 | Add recursion tests | `src/__tests__/frame/` |

### Session 6.4: Frame Address Allocator

**Objective**: Allocate static addresses for frames

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 6.4.1 | Calculate frame sizes | `src/frame/allocator.ts` |
| 6.4.2 | Assign frame addresses | `src/frame/allocator.ts` |
| 6.4.3 | Handle param/local slots | `src/frame/allocator.ts` |
| 6.4.4 | Add allocator tests | `src/__tests__/frame/` |
| 6.4.5 | Create frame index.ts | `src/frame/index.ts` |

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

| # | Task | File(s) |
|---|------|---------|
| 7.1.1 | Define IL opcode enum | `src/il/types.ts` |
| 7.1.2 | Define IL instruction type | `src/il/types.ts` |
| 7.1.3 | Define IL program type | `src/il/types.ts` |
| 7.1.4 | Define IL function type | `src/il/types.ts` |

### Session 7.2: IL Builder

**Objective**: Create IL construction utilities

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 7.2.1 | Create IL builder class | `src/il/builder.ts` |
| 7.2.2 | Add instruction factories | `src/il/builder.ts` |
| 7.2.3 | Add label management | `src/il/builder.ts` |
| 7.2.4 | Add builder tests | `src/__tests__/il/` |

### Session 7.3: IL Generator

**Objective**: Generate IL from AST + frames

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 7.3.1 | Create IL generator class | `src/il/generator.ts` |
| 7.3.2 | Generate for expressions | `src/il/generator.ts` |
| 7.3.3 | Generate for statements | `src/il/generator.ts` |
| 7.3.4 | Generate for functions | `src/il/generator.ts` |

### Session 7.4: IL Generator Control Flow

**Objective**: Generate IL for control flow

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 7.4.1 | Generate for if/else | `src/il/generator.ts` |
| 7.4.2 | Generate for while loops | `src/il/generator.ts` |
| 7.4.3 | Generate for for loops | `src/il/generator.ts` |
| 7.4.4 | Generate for break/continue | `src/il/generator.ts` |
| 7.4.5 | Add generator tests | `src/__tests__/il/` |
| 7.4.6 | Create IL index.ts | `src/il/index.ts` |

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

| # | Task | File(s) |
|---|------|---------|
| 8.1.1 | Create codegen class | `src/codegen/generator.ts` |
| 8.1.2 | Set up ASM-IL output | `src/codegen/generator.ts` |
| 8.1.3 | Implement load/store | `src/codegen/generator.ts` |

### Session 8.2: CodeGen Arithmetic

**Objective**: Generate code for arithmetic

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 8.2.1 | Generate for byte add/sub | `src/codegen/generator.ts` |
| 8.2.2 | Generate for byte mul/div | `src/codegen/generator.ts` |
| 8.2.3 | Generate for word operations | `src/codegen/generator.ts` |
| 8.2.4 | Add codegen tests | `src/__tests__/codegen/` |

### Session 8.3: CodeGen Comparison

**Objective**: Generate code for comparisons

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 8.3.1 | Generate for byte compare | `src/codegen/generator.ts` |
| 8.3.2 | Generate for word compare | `src/codegen/generator.ts` |
| 8.3.3 | Generate branch instructions | `src/codegen/generator.ts` |

### Session 8.4: CodeGen Control Flow

**Objective**: Generate code for control flow

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 8.4.1 | Generate for jumps | `src/codegen/generator.ts` |
| 8.4.2 | Generate for conditionals | `src/codegen/generator.ts` |
| 8.4.3 | Generate for loops | `src/codegen/generator.ts` |

### Session 8.5: CodeGen Functions & Intrinsics

**Objective**: Generate code for functions and intrinsics

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 8.5.1 | Generate for function calls | `src/codegen/generator.ts` |
| 8.5.2 | Generate for returns | `src/codegen/generator.ts` |
| 8.5.3 | Generate for peek/poke | `src/codegen/generator.ts` |
| 8.5.4 | Generate for hi/lo | `src/codegen/generator.ts` |
| 8.5.5 | Add comprehensive tests | `src/__tests__/codegen/` |
| 8.5.6 | Create codegen index.ts | `src/codegen/index.ts` |

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

| # | Task | File(s) |
|---|------|---------|
| 9.1.1 | Copy optimizer types | `src/optimizer/types.ts` |
| 9.1.2 | Create optimizer pass interface | `src/optimizer/pass.ts` |
| 9.1.3 | Create optimizer runner | `src/optimizer/optimizer.ts` |

### Session 9.2: Peephole Passes

**Objective**: Implement peephole optimization passes

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 9.2.1 | Redundant load elimination | `src/optimizer/passes/` |
| 9.2.2 | Dead store elimination | `src/optimizer/passes/` |
| 9.2.3 | Add optimizer tests | `src/__tests__/optimizer/` |

### Session 9.3: ASM Emitter

**Objective**: Emit ACME assembler output

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 9.3.1 | Copy ASM-IL emitter | `src/asm-il/emitter.ts` |
| 9.3.2 | Update for v2 | `src/asm-il/emitter.ts` |
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

| # | Task | File(s) |
|---|------|---------|
| 10.1.1 | Create Compiler class | `src/compiler.ts` |
| 10.1.2 | Wire up pipeline stages | `src/compiler.ts` |
| 10.1.3 | Add optimization levels | `src/compiler.ts` |
| 10.1.4 | Export public API | `src/index.ts` |

### Session 10.2: End-to-End Tests

**Objective**: Test complete pipeline

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10.2.1 | Create E2E test fixtures | `src/__tests__/e2e/` |
| 10.2.2 | Test simple programs | `src/__tests__/e2e/` |
| 10.2.3 | Test control flow | `src/__tests__/e2e/` |
| 10.2.4 | Test functions | `src/__tests__/e2e/` |

### Session 10.3: Example Programs

**Objective**: Verify with real programs

**Tasks**:

| # | Task | File(s) |
|---|------|---------|
| 10.3.1 | Compile hello world | examples/ |
| 10.3.2 | Test in VICE emulator | manual |
| 10.3.3 | Fix any issues | varies |
| 10.3.4 | Update CLI to use v2 | packages/cli/ |

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
- [ ] 2.1.1 Copy lexer types
- [ ] 2.1.2 Remove @map token types
- [ ] 2.1.3 Copy lexer implementation
- [ ] 2.1.4 Remove @map tokenization
- [ ] 2.1.5 Copy lexer tests
- [ ] 2.1.6 Update tests (remove @map)
- [ ] 2.1.7 Create lexer index.ts

### Phase 3: Parser Migration
- [ ] 3.1.1 Copy parser base
- [ ] 3.1.2 Copy expression parsing
- [ ] 3.1.3 Copy statement parsing
- [ ] 3.1.4 Copy declaration parsing
- [ ] 3.2.1 Remove @map from declarations
- [ ] 3.2.2 Update parser entry
- [ ] 3.2.3 Copy parser tests
- [ ] 3.2.4 Remove @map test cases
- [ ] 3.2.5 Create parser index.ts

### Phase 4: AST Migration
- [ ] 4.1.1 Copy AST base types
- [ ] 4.1.2 Copy AST node types
- [ ] 4.1.3 Remove @map AST nodes
- [ ] 4.1.4 Copy type guards
- [ ] 4.1.5 Update type guards
- [ ] 4.1.6 Copy visitor pattern
- [ ] 4.1.7 Create AST index.ts

### Phase 5: Semantic Migration
- [ ] 5.1.1 Copy symbol table
- [ ] 5.1.2 Copy type system
- [ ] 5.1.3 Copy type checker base
- [ ] 5.2.1 Remove SSA preparation code
- [ ] 5.2.2 Remove @map type handling
- [ ] 5.2.3 Add call graph builder
- [ ] 5.2.4 Add recursion detection
- [ ] 5.2.5 Copy semantic tests
- [ ] 5.2.6 Add recursion error tests
- [ ] 5.2.7 Create semantic index.ts

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