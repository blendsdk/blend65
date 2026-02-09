# Current State: IL & IL-Optimizer Testing

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

#### IL Generator Tests

| Directory | Files | Purpose |
|-----------|-------|---------|
| `il/` | `analysis.test.ts` | Liveness analysis |
| `il/` | `builder.test.ts` | IL instruction building |
| `il/` | `enums.test.ts` | IL opcode enums |
| `il/` | `factories.test.ts` | IL object factories |
| `il/` | `generator.test.ts` | Core IL generation |
| `il/` | `generator-control-flow.test.ts` | Control flow generation |
| `il/` | `generator-functions.test.ts` | Function IL generation |
| `il/` | `guards.test.ts` | Type guards |
| `il/e2e/` | `functions.test.ts` | Function e2e tests |
| `il/e2e/` | `loops.test.ts` | Loop e2e tests |
| `il/e2e/` | `simple-add.test.ts` | Simple expressions |
| `il/integration/` | `ast-to-il.test.ts` | AST → IL integration |
| `il/integration/` | `sfa-to-il.test.ts` | SFA → IL integration |

**Total IL tests**: ~8 unit test files + 3 e2e + 2 integration = 13 files

#### IL Optimizer Tests

| Directory | Files | Purpose |
|-----------|-------|---------|
| `optimizer/` | `e2e.test.ts` | End-to-end optimization |
| `optimizer/` | `integration.test.ts` | Pass integration |
| `optimizer/` | `options.test.ts` | Optimizer options |
| `optimizer/` | `pass-manager.test.ts` | Pass manager logic |
| `optimizer/` | `pass.test.ts` | Base pass class |
| `optimizer/passes/` | `constant-fold.test.ts` | Constant folding |
| `optimizer/passes/` | `constant-prop.test.ts` | Constant propagation |
| `optimizer/passes/` | `copy-prop.test.ts` | Copy propagation |
| `optimizer/passes/` | `dce.test.ts` | Dead code elimination |
| `optimizer/passes/` | `il-peephole.test.ts` | Peephole optimization |

**Total optimizer tests**: ~5 core + 5 passes = 10 files

### Comparison with Semantic Testing

The semantic analyzer has comprehensive testing that we're missing:

| Category | Semantic | IL Generator | IL Optimizer |
|----------|----------|--------------|--------------|
| Real-world patterns | ✅ 7 files | ❌ 0 | ❌ 0 |
| Stress tests | ✅ 3 files | ❌ 0 | ❌ 0 |
| Complex combinations | ✅ 3 files | ❌ 0 | ❌ 0 |
| Edge cases | ✅ 17 files | ❌ 0 | ❌ 0 |

## Gaps Identified

### Gap 1: No Real-World C64 Pattern Tests

**Current Behavior:** Tests use synthetic, simplified examples
**Required Behavior:** Tests should reflect actual C64 game development patterns
**Fix Required:** Create 7 real-world test files for each component

Examples of missing patterns:
- Game loops with frame timing
- Sprite manipulation code
- Hardware register access
- Memory copying/clearing
- Joystick/keyboard input
- Raster timing code
- Sound/music patterns

### Gap 2: No Stress Tests

**Current Behavior:** Tests use small programs (1-10 functions, <50 instructions)
**Required Behavior:** Tests should push limits (50-200 functions, 500-2000 instructions)
**Fix Required:** Create 4 stress test files for each component

Missing stress scenarios:
- Deep nesting (10-20 levels)
- Many functions (50-200)
- Many variables (50-200 per function)
- Large programs (1000+ IL instructions)

### Gap 3: No Complex Combination Tests

**Current Behavior:** Tests focus on single features in isolation
**Required Behavior:** Tests should verify feature interactions
**Fix Required:** Create 6 complex combination files for IL

Missing combinations:
- Nested loops with function calls
- Expression trees with mixed operators
- Control flow with all statement types
- Arrays with complex indexing
- State machines patterns
- Multi-module scenarios

### Gap 4: No Edge Case Tests

**Current Behavior:** Tests use "happy path" values
**Required Behavior:** Tests should cover boundary conditions
**Fix Required:** Create 5 edge case files for each component

Missing edge cases:
- Byte boundaries (0, 255)
- Word boundaries (0, 65535)
- Array boundaries (first, last index)
- Break/continue in nested loops
- Operator edge cases (divide by 1, multiply by 0)

### Gap 5: No Optimizer Correctness Tests

**Current Behavior:** Tests verify optimization happens, not correctness
**Required Behavior:** Tests should verify optimizer doesn't break semantics
**Fix Required:** Create 6 correctness test files for optimizer

Missing correctness:
- DCE preserves necessary code
- Constant folding produces correct values
- Propagation handles all cases correctly
- Peephole patterns are semantically correct
- Ordering is preserved where needed

## Dependencies

### Internal Dependencies

- `packages/compiler-v2/src/lexer/` - Tokenization
- `packages/compiler-v2/src/parser/` - AST generation
- `packages/compiler-v2/src/semantic/` - Semantic analysis + frame allocation
- `packages/compiler-v2/src/il/` - IL generation
- `packages/compiler-v2/src/optimizer/` - IL optimization

### External Dependencies

- Vitest - Test framework
- TypeScript - Type checking

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Tests reveal implementation bugs | High | Medium | Fix bugs as found, don't delay |
| Tests take too long to run | Low | Medium | Keep individual tests fast |
| AI context limits | Medium | Medium | Keep files small (5-10 tests) |
| Test duplication | Low | Low | Use shared helpers |
| Maintenance burden | Low | Low | Follow established patterns |

## Relevant Code Patterns

### Existing IL E2E Test Pattern

```typescript
// From il/e2e/functions.test.ts
function compileToIL(source: string) {
  const lexer = new Lexer(source, 'test.blend');
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, { filename: 'test.blend' });
  const ast = parser.parse();
  const semanticAnalyzer = new SemanticAnalyzer({
    runFrameAllocation: true,
    runAdvancedAnalysis: false,
  });
  const analysisResult = semanticAnalyzer.analyze(ast);
  const ilGenerator = new ILGenerator(analysisResult.frameMap, analysisResult.symbolTable);
  return ilGenerator.generate(ast);
}

function countOpcode(instructions: { opcode: ILOpcode }[], opcode: ILOpcode): number {
  return instructions.filter(i => i.opcode === opcode).length;
}
```

### Existing Optimizer E2E Test Pattern

```typescript
// From optimizer/e2e.test.ts
const optimizer = new ILOptimizer({ level: 'O2' });
optimizer.optimizeFunction(func);
const result = optimizer.getLastResult();
expect(result?.modified).toBe(true);
expect(func.instructions).toHaveLength(2);
```

### Reference: Semantic Real-World Pattern

```typescript
// From semantic/e2e/real-world/game-loop.test.ts
describe('Game Loop Patterns', () => {
  it('should analyze basic game loop', () => {
    const result = analyze(`
      module GameLoop;
      function mainLoop(): void {
        let running: bool = true;
        while (running) {
          running = true;
        }
      }
    `);
    expect(result.success).toBe(true);
  });
});
```