# Testing Strategy: Compiler Stress Testing

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ COMPLETE — 20 scenarios, 1087 E2E pipeline tests, 8568 total tests passing

## Testing Philosophy

**CRITICAL PRINCIPLE: Isolated unit tests will NOT find these bugs.**

The bugs discovered in sprite-test.blend and border-cycle only manifest when multiple
compiler phases interact with real-world code patterns. The test suite MUST use full
pipeline compilation of realistic C64 programs, not isolated function-level tests.

## Testing Architecture

### Full Pipeline Tests

Every test compiles from Blend source through ALL 8 pipeline phases:

```
Source → Lexer → Parser → Semantic → Frame → IL → Optimizer → Codegen → ASM Optimizer → Emit
```

### Test File Structure

```
packages/compiler/src/__tests__/e2e/pipeline/
├── real-world-stress.test.ts                  ← Scenarios 1-4 (Sprite, Border, Screen, Raster)
├── real-world-stress-scenario-5.test.ts       ← Multi-Sprite Animation
├── real-world-stress-scenario-6.test.ts       ← Sound Effect Player
├── real-world-stress-scenario-7.test.ts       ← Memory Copy Utility
├── real-world-stress-scenario-8.test.ts       ← Game State Machine
├── real-world-stress-scenario-9.test.ts       ← Scrolling Text
├── real-world-stress-scenario-10.test.ts      ← Character Set Animation
├── real-world-stress-scenario-11.test.ts      ← Collision Detection
├── real-world-stress-scenario-12.test.ts      ← Multi-Module Game
├── real-world-stress-scenario-13.test.ts      ← Keyboard Scanner
├── real-world-stress-scenario-14.test.ts      ← Timer-Based Music
├── real-world-stress-scenario-15.test.ts      ← Multiplexed Sprites
├── real-world-stress-scenario-16.test.ts      ← Screen Editor
├── real-world-stress-scenario-17.test.ts      ← High Score Table
├── real-world-stress-scenario-18.test.ts      ← Parallax Scroller
├── real-world-stress-scenario-19.test.ts      ← Particle System
├── real-world-stress-scenario-20.test.ts      ← Boot Sequence (ALL classes)
├── simple-programs.test.ts                    ← Existing
├── intrinsics.test.ts                         ← Existing
├── c64-patterns.test.ts                       ← Existing
└── helpers.ts                                 ← Shared helpers
```

### Test Helper Functions

```typescript
/**
 * Compile a Blend source string through the full pipeline.
 * Returns the compilation result including assembly output and diagnostics.
 */
function compileFullPipeline(source: string, optLevel?: string): CompileResult;

/**
 * Assert compilation succeeds with zero errors and zero warnings.
 * This catches false positive warnings like Bug 1.
 */
function expectCleanCompilation(result: CompileResult, testName: string): void;

/**
 * Assert assembly output contains a specific instruction pattern.
 * Uses regex for flexible matching.
 */
function expectAssemblyContains(result: CompileResult, pattern: string | RegExp): void;

/**
 * Assert assembly output does NOT contain a pattern.
 * Used for verifying dead code elimination.
 */
function expectAssemblyNotContains(result: CompileResult, pattern: string | RegExp): void;

/**
 * Assert no function label exists in assembly for a given function name.
 * Used for Bug 3 (inlined functions removed).
 */
function expectFunctionRemoved(result: CompileResult, funcName: string): void;

/**
 * Assert a function label EXISTS in assembly.
 * Used for verifying exported functions are preserved.
 */
function expectFunctionPresent(result: CompileResult, funcName: string): void;
```

## Test Categories

### Category A: Bug Regression Tests

Every confirmed bug gets a dedicated regression test that:
1. Uses the EXACT failing code that exposed the bug
2. Compiles at the optimization level that triggered the bug
3. Verifies the SPECIFIC assembly pattern that was wrong

| Bug | Regression Test | Verification |
|-----|----------------|--------------|
| 1 | For-loop with `i` used in body | Zero warnings in diagnostics |
| 2 | `poke(baseAddr + i, value)` | Compilation succeeds, assembly has STA |
| 3 | `delay()` inlined at O3 | `delay:` label NOT in assembly |
| 4 | `color += 1` in while loop | Assembly has INC or ADC |
| 5 | `color = 0` in if-branch | Assembly has `LDA #$00` before `STA` |
| 6 | Inlined delay in while loop | Loop init `LDA #$00` inside `.while` label |

### Category B: Real-World Scenario Tests

20 scenarios from [04-test-scenarios.md](04-test-scenarios.md), each testing multiple
bug classes simultaneously. Every scenario runs at O0 AND O3 minimum.

### Category C: Optimization Level Matrix Tests

Key scenarios run at ALL optimization levels (O0, O1, O2, O3, Os) to verify correct
behavior across the optimization spectrum.

## Coverage Goals

### Bug Class Coverage Matrix

| Class | Scenario Coverage |
|-------|------------------|
| 1 - Type Coercion | Scenarios 1, 3, 5, 7, 9, 10, 11, 15, 17, 19 |
| 2 - Register State | Scenarios 1, 4, 5, 7, 15, 18 |
| 3 - Control Flow | Scenarios 4, 5, 6, 8, 9, 11, 13, 16 |
| 4 - Memory Layout | Scenarios 3, 5, 7, 10, 16, 17, 19 |
| 5 - Multi-Module | Scenarios 8, 12, 16 |
| 6 - Optimizer Phases | Scenarios 2, 4, 6, 10, 14, 18 |
| 7 - Complex Expressions | Scenarios 1, 3, 5, 6, 8, 9, 10, 11, 13, 15, 17 |
| 8 - ASM Peephole | Scenarios 15, 18 |
| 9 - Intrinsics | Scenarios 1, 4, 6, 7, 9, 10, 12, 14, 18 |
| 10 - Calling Convention | Scenarios 4, 5, 6, 8, 11, 14, 19 |

**Every class has 3+ scenario coverage minimum.**

## Assembly Verification Patterns

### What to CHECK FOR (must be present):

```
# Compound assignment (Bug 4)
/INC \$\w+/           → x += 1 generates INC
/CLC.*ADC #\$\w+/s   → x += N generates CLC; ADC

# Literal assignment (Bug 5)
/LDA #\$00.*STA \$\w+/s  → x = 0 generates LDA #$00; STA

# Loop counter init (Bug 6)
/\.while\d+:.*LDA #\$00.*STA \$\w+/s  → init INSIDE loop

# Dynamic address poke (Bug 2)
/STA \$\w{4}/         → poke generates absolute STA
/STA \(\$\w+\),Y/    → poke with indirect indexed

# Inlined code markers (Bug 3 verification)
/\[inlined from/     → inlined code present in main
```

### What to CHECK AGAINST (must NOT be present):

```
# Dead inlined functions (Bug 3)
/^delay:$/m           → delay function should be removed at O3

# Dead stores (optimizer quality)
/LDA #\$\w+\nLDA #\$\w+/  → consecutive LDA without intervening STA

# Missing initialization
/\.while\d+:.*STA \$\w+/  → STA without preceding LDA inside loop (Bug 6)
```

## Test Execution

### During Development (targeted)
```bash
./compiler-test e2e
```

### Before Task Completion (full)
```bash
./compiler-test
```

### Optimization Level Testing
Each scenario should have a parameterized test:
```typescript
describe.each(['O0', 'O1', 'O2', 'O3'])('at %s', (level) => {
    it('should compile Scenario N correctly', () => {
        const result = compileFullPipeline(scenarioSource, level);
        expectCleanCompilation(result, `Scenario N at ${level}`);
        // Level-specific checks
        if (level === 'O3') {
            expectFunctionRemoved(result, 'helperFunc');
        }
    });
});
```

## Verification Checklist

- [x] All 6 bug regression tests passing ✅
- [x] All 20 real-world scenarios passing at O0 ✅
- [x] All 20 real-world scenarios passing at O3 ✅
- [x] Key scenarios passing at O1, O2 ✅
- [x] Assembly output verified for correctness patterns ✅
- [x] No false warnings in any scenario ✅
- [x] No crashes in any scenario ✅
- [x] Full test suite passing (8568 tests, 0 failures) ✅
- [x] All 10 bug classes have 3+ scenario coverage ✅

## Final Results

- **Total tests**: 8568 (all passing, 0 failures)
- **E2E pipeline tests**: 1087
- **Real-world stress scenarios**: 20
- **Optimization levels tested**: O0, O1, O2, O3
- **Bug classes covered**: All 10/10 with 3+ scenarios each
