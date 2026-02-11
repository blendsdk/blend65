# Requirements: Compiler Stress Testing & Bug Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix 6 confirmed compiler bugs and create a comprehensive real-world E2E test suite
that exercises the ENTIRE compiler pipeline using realistic C64 game/demo programs.
Every test must represent a real-world scenario — isolated unit tests will NOT catch
the interaction bugs between compiler phases that cause silent wrong code generation.

## Functional Requirements

### Must Have — Bug Fixes

- [x] **Bug 1**: Fix UsageWalker scope tracking for all 7 scope-creating constructs ✅
- [x] **Bug 2**: Fix dynamic-address POKE/PEEK (IL emission + codegen handling) ✅
- [x] **Bug 3**: Fix post-inlining dead function elimination ✅
- [x] **Bug 4**: Fix missing compound assignment (`+=`, `-=`, etc.) in assembly output ✅
- [x] **Bug 5**: Fix literal assignment (`x = 0`) missing LDA before STA ✅
- [x] **Bug 6**: Fix inlined loop counter re-initialization inside outer loops ✅

### Must Have — Real-World E2E Tests

- [x] 20 test scenarios representing real C64 programs ✅
- [x] Every test exercises full pipeline (lexer → emitter) ✅
- [x] Every test verifies assembly output patterns (not just "does it compile") ✅
- [x] Every test runs at multiple optimization levels (O0, O1, O2, O3 minimum) ✅
- [x] Tests cover ALL 10 bug classes identified ✅

### Must Have — Bug Class Coverage

| Class | Category | Required Test Coverage |
|-------|----------|----------------------|
| 1 | Type Coercion / Width Promotion | byte↔word math, overflow, hi/lo extraction |
| 2 | Register State / Accumulator Tracking | A clobber across branches, expressions, inlined code |
| 3 | Control Flow Correctness | break/continue, early return, nested if/while/for |
| 4 | Memory Layout / Frame Allocation | ZP collisions, word variables, array bounds |
| 5 | Multi-Module Interaction | imports, cross-module calls, symbol resolution |
| 6 | Optimizer Phase Interactions | DFE+inline, DCE+side-effects, CSE+volatile |
| 7 | Complex Expression Codegen | compound assignment, bitwise, shift, ternary |
| 8 | ASM-Level / Peephole Optimizer | pattern correctness, branch distance |
| 9 | Intrinsic Edge Cases | nested poke/peek, barrier preservation, volatile |
| 10 | Stack / Calling Convention | parameter passing, return values, multi-param |

### Won't Have (Out of Scope)

- Performance benchmarking (no cycle counting)
- VICE emulator verification (manual testing only)
- Recursive function testing (limited 6502 stack)
- Full game implementations (tests are representative scenarios, not complete games)

## Technical Requirements

### Test Infrastructure
- Tests use the existing E2E pipeline test infrastructure
- Assembly output verification via string matching/regex
- Diagnostic verification (no false warnings, no crashes)
- Multi-optimization-level testing via parameterized test runs

### Assembly Verification
- Every test checks for presence of expected instruction patterns
- Every test checks for absence of known-bad patterns
- Dead function labels checked at O3
- Loop counter initialization checked inside loops

## Acceptance Criteria

1. [x] All 6 bugs fixed and verified ✅
2. [x] 20 real-world E2E test scenarios passing ✅
3. [x] sprite-test.blend compiles without warnings or errors ✅
4. [x] border-cycle compiles correctly at O0 and O3 ✅
5. [x] Full test suite (8568 tests) passes with 0 failures ✅
6. [x] All 10 bug classes have at least 2 test scenarios each ✅
7. [x] Assembly output verified at O0 and O3 for every scenario ✅
