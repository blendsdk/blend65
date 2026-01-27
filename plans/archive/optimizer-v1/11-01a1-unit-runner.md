# 11-01a1: Unit Test Runner Infrastructure

> **Document ID**: 11-01a1-unit-runner
> **Phase**: 11 - Testing Framework
> **Task**: 11.1a1 - Unit test runner infrastructure
> **Priority**: Critical
> **Estimated LOC**: 400-500

---

## Overview

This document specifies the unit test runner infrastructure for the Blend65 optimizer. The runner provides a framework for executing isolated tests on individual optimization passes, pattern matchers, and analysis components.

### Goals

1. Fast, isolated test execution for individual optimizer components
2. Comprehensive assertion capabilities for IL and 6502 code
3. Fixture management for common test scenarios
4. Integration with Vitest test framework
5. Detailed failure diagnostics

---

## Type Definitions

```typescript
/**
 * Configuration for the unit test runner
 */
interface UnitTestRunnerConfig {
  /** Enable verbose output */
  verbose: boolean;
  /** Stop on first failure */
  failFast: boolean;
  /** Timeout per test in milliseconds */
  timeout: number;
  /** Enable IL validation after each test */
  validateIL: boolean;
  /** Enable cycle counting verification */
  verifyCycles: boolean;
  /** Snapshot directory for golden tests */
  snapshotDir: string;
}

/**
 * Test context provided to each unit test
 */
interface UnitTestContext {
  /** IL builder for constructing test programs */
  builder: ILTestBuilder;
  /** Assertion utilities */
  assert: OptimizerAssertions;
  /** Fixture loader */
  fixtures: FixtureLoader;
  /** Cycle counter */
  cycles: CycleCounter;
  /** Test metadata */
  meta: TestMetadata;
}

/**
 * Metadata about the current test
 */
interface TestMetadata {
  /** Test name */
  name: string;
  /** Test file path */
  file: string;
  /** Test suite name */
  suite: string;
  /** Tags for filtering */
  tags: string[];
  /** Timeout override */
  timeout?: number;
}

/**
 * Result of a single unit test
 */
interface UnitTestResult {
  /** Test identifier */
  name: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped' | 'timeout';
  /** Duration in milliseconds */
  duration: number;
  /** Failure details if failed */
  failure?: TestFailure;
  /** Cycle counts if measured */
  cycles?: CycleMetrics;
  /** IL snapshots if captured */
  snapshots?: ILSnapshot[];
}

/**
 * Detailed failure information
 */
interface TestFailure {
  /** Error message */
  message: string;
  /** Stack trace */
  stack: string;
  /** Expected value (for assertions) */
  expected?: string;
  /** Actual value (for assertions) */
  actual?: string;
  /** Diff between expected and actual */
  diff?: string;
  /** IL state at failure */
  ilState?: string;
}

/**
 * Cycle metrics from test execution
 */
interface CycleMetrics {
  /** Cycles before optimization */
  before: number;
  /** Cycles after optimization */
  after: number;
  /** Cycles saved */
  saved: number;
  /** Percentage improvement */
  improvement: number;
}

/**
 * IL snapshot for comparison
 */
interface ILSnapshot {
  /** Snapshot name */
  name: string;
  /** IL instructions */
  instructions: string[];
  /** Capture point */
  phase: 'before' | 'after' | 'intermediate';
}
```

---

## Implementation

### Unit Test Runner

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Unit test runner for optimizer components
 * 
 * Provides infrastructure for running isolated tests on individual
 * optimization passes, pattern matchers, and analysis components.
 */
export class UnitTestRunner {
  protected config: UnitTestRunnerConfig;
  protected results: UnitTestResult[];
  protected currentContext: UnitTestContext | null;
  
  constructor(config: Partial<UnitTestRunnerConfig> = {}) {
    this.config = {
      verbose: false,
      failFast: false,
      timeout: 5000,
      validateIL: true,
      verifyCycles: false,
      snapshotDir: '__snapshots__',
      ...config
    };
    this.results = [];
    this.currentContext = null;
  }
  
  /**
   * Create a test suite for an optimizer component
   */
  createSuite(name: string, fn: (ctx: UnitTestContext) => void): void {
    describe(name, () => {
      let context: UnitTestContext;
      
      beforeEach(() => {
        context = this.createContext(name);
        this.currentContext = context;
      });
      
      afterEach(() => {
        this.currentContext = null;
      });
      
      fn(context);
    });
  }
  
  /**
   * Create a test context with all utilities
   */
  protected createContext(suiteName: string): UnitTestContext {
    return {
      builder: new ILTestBuilder(),
      assert: new OptimizerAssertions(),
      fixtures: new FixtureLoader(),
      cycles: new CycleCounter(),
      meta: {
        name: '',
        file: '',
        suite: suiteName,
        tags: []
      }
    };
  }
  
  /**
   * Run a single test with context
   */
  runTest(
    name: string,
    fn: (ctx: UnitTestContext) => void | Promise<void>
  ): void {
    it(name, async () => {
      const startTime = Date.now();
      const context = this.currentContext!;
      context.meta.name = name;
      
      try {
        await fn(context);
        
        // Validate IL if enabled
        if (this.config.validateIL) {
          this.validateILState(context);
        }
        
        // Record success
        this.results.push({
          name,
          status: 'passed',
          duration: Date.now() - startTime,
          cycles: this.config.verifyCycles ? context.cycles.getMetrics() : undefined
        });
      } catch (error) {
        // Record failure
        this.results.push({
          name,
          status: 'failed',
          duration: Date.now() - startTime,
          failure: this.formatFailure(error as Error, context)
        });
        throw error;
      }
    });
  }
  
  /**
   * Validate IL state is consistent
   */
  protected validateILState(context: UnitTestContext): void {
    const program = context.builder.getProgram();
    if (program) {
      // Verify all blocks have proper termination
      for (const block of program.blocks) {
        if (!block.terminator) {
          throw new Error(`Block ${block.label} missing terminator`);
        }
      }
      
      // Verify SSA form if applicable
      if (program.isSSA) {
        this.validateSSAForm(program);
      }
    }
  }
  
  /**
   * Validate SSA form is correct
   */
  protected validateSSAForm(program: ILProgram): void {
    const definitions = new Map<string, ILBlock>();
    
    for (const block of program.blocks) {
      for (const instr of block.instructions) {
        if (instr.dest) {
          if (definitions.has(instr.dest)) {
            throw new Error(
              `SSA violation: ${instr.dest} defined in both ` +
              `${definitions.get(instr.dest)!.label} and ${block.label}`
            );
          }
          definitions.set(instr.dest, block);
        }
      }
    }
  }
  
  /**
   * Format failure for reporting
   */
  protected formatFailure(error: Error, context: UnitTestContext): TestFailure {
    return {
      message: error.message,
      stack: error.stack || '',
      ilState: context.builder.getProgram()?.toString()
    };
  }
  
  /**
   * Get all test results
   */
  getResults(): UnitTestResult[] {
    return [...this.results];
  }
  
  /**
   * Get summary statistics
   */
  getSummary(): TestSummary {
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    return {
      total: this.results.length,
      passed,
      failed,
      skipped,
      duration: totalDuration,
      passRate: this.results.length > 0 ? passed / this.results.length : 0
    };
  }
}

/**
 * Test summary statistics
 */
interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  passRate: number;
}
```

### IL Test Builder

```typescript
/**
 * Builder for constructing IL programs in tests
 * 
 * Provides a fluent API for creating IL instruction sequences
 * for testing optimization passes.
 */
export class ILTestBuilder {
  protected blocks: ILBlock[];
  protected currentBlock: ILBlock | null;
  protected nextTempId: number;
  
  constructor() {
    this.blocks = [];
    this.currentBlock = null;
    this.nextTempId = 0;
  }
  
  /**
   * Start a new basic block
   */
  block(label: string): this {
    const block: ILBlock = {
      label,
      instructions: [],
      terminator: null,
      predecessors: [],
      successors: []
    };
    this.blocks.push(block);
    this.currentBlock = block;
    return this;
  }
  
  /**
   * Add a load instruction
   */
  load(dest: string, address: number | string): this {
    this.addInstruction({
      opcode: ILOpcode.LOAD,
      dest,
      operands: [typeof address === 'number' ? `$${address.toString(16)}` : address]
    });
    return this;
  }
  
  /**
   * Add a store instruction
   */
  store(address: number | string, value: string): this {
    this.addInstruction({
      opcode: ILOpcode.STORE,
      operands: [
        typeof address === 'number' ? `$${address.toString(16)}` : address,
        value
      ]
    });
    return this;
  }
  
  /**
   * Add a binary operation
   */
  binop(op: BinaryOp, dest: string, left: string, right: string): this {
    this.addInstruction({
      opcode: ILOpcode.BINOP,
      dest,
      operands: [op, left, right]
    });
    return this;
  }
  
  /**
   * Add a comparison
   */
  cmp(dest: string, op: CompareOp, left: string, right: string): this {
    this.addInstruction({
      opcode: ILOpcode.CMP,
      dest,
      operands: [op, left, right]
    });
    return this;
  }
  
  /**
   * Add a conditional branch terminator
   */
  branch(cond: string, thenLabel: string, elseLabel: string): this {
    if (!this.currentBlock) throw new Error('No current block');
    this.currentBlock.terminator = {
      kind: 'branch',
      condition: cond,
      thenTarget: thenLabel,
      elseTarget: elseLabel
    };
    return this;
  }
  
  /**
   * Add an unconditional jump terminator
   */
  jump(label: string): this {
    if (!this.currentBlock) throw new Error('No current block');
    this.currentBlock.terminator = {
      kind: 'jump',
      target: label
    };
    return this;
  }
  
  /**
   * Add a return terminator
   */
  ret(value?: string): this {
    if (!this.currentBlock) throw new Error('No current block');
    this.currentBlock.terminator = {
      kind: 'return',
      value
    };
    return this;
  }
  
  /**
   * Add a phi node (for SSA form)
   */
  phi(dest: string, ...sources: Array<[string, string]>): this {
    this.addInstruction({
      opcode: ILOpcode.PHI,
      dest,
      operands: sources.flat()
    });
    return this;
  }
  
  /**
   * Add a constant
   */
  const(dest: string, value: number): this {
    this.addInstruction({
      opcode: ILOpcode.CONST,
      dest,
      operands: [value.toString()]
    });
    return this;
  }
  
  /**
   * Generate a fresh temporary name
   */
  temp(): string {
    return `t${this.nextTempId++}`;
  }
  
  /**
   * Add instruction to current block
   */
  protected addInstruction(instr: ILInstruction): void {
    if (!this.currentBlock) {
      throw new Error('No current block - call block() first');
    }
    this.currentBlock.instructions.push(instr);
  }
  
  /**
   * Build the complete IL program
   */
  build(): ILProgram {
    // Connect predecessors and successors
    this.computeCFGEdges();
    
    return {
      blocks: [...this.blocks],
      entry: this.blocks[0]?.label || '',
      isSSA: this.hasPhiNodes()
    };
  }
  
  /**
   * Compute CFG edges from terminators
   */
  protected computeCFGEdges(): void {
    const blockMap = new Map(this.blocks.map(b => [b.label, b]));
    
    for (const block of this.blocks) {
      if (!block.terminator) continue;
      
      const targets: string[] = [];
      switch (block.terminator.kind) {
        case 'jump':
          targets.push(block.terminator.target);
          break;
        case 'branch':
          targets.push(block.terminator.thenTarget, block.terminator.elseTarget);
          break;
      }
      
      for (const target of targets) {
        const targetBlock = blockMap.get(target);
        if (targetBlock) {
          block.successors.push(target);
          targetBlock.predecessors.push(block.label);
        }
      }
    }
  }
  
  /**
   * Check if program uses phi nodes
   */
  protected hasPhiNodes(): boolean {
    return this.blocks.some(b =>
      b.instructions.some(i => i.opcode === ILOpcode.PHI)
    );
  }
  
  /**
   * Get the built program
   */
  getProgram(): ILProgram | null {
    return this.blocks.length > 0 ? this.build() : null;
  }
  
  /**
   * Reset builder state
   */
  reset(): void {
    this.blocks = [];
    this.currentBlock = null;
    this.nextTempId = 0;
  }
}
```

### Fixture Loader

```typescript
/**
 * Loader for test fixtures
 * 
 * Provides access to predefined IL programs and code patterns
 * commonly used in optimizer tests.
 */
export class FixtureLoader {
  protected cache: Map<string, ILProgram>;
  
  constructor() {
    this.cache = new Map();
  }
  
  /**
   * Load a predefined fixture by name
   */
  load(name: string): ILProgram {
    if (this.cache.has(name)) {
      return this.clone(this.cache.get(name)!);
    }
    
    const fixture = this.getBuiltinFixture(name);
    this.cache.set(name, fixture);
    return this.clone(fixture);
  }
  
  /**
   * Get builtin fixtures
   */
  protected getBuiltinFixture(name: string): ILProgram {
    switch (name) {
      case 'simple-loop':
        return this.buildSimpleLoop();
      case 'nested-loops':
        return this.buildNestedLoops();
      case 'diamond-cfg':
        return this.buildDiamondCFG();
      case 'memory-copy':
        return this.buildMemoryCopy();
      case 'sprite-update':
        return this.buildSpriteUpdate();
      default:
        throw new Error(`Unknown fixture: ${name}`);
    }
  }
  
  /**
   * Build simple loop fixture
   */
  protected buildSimpleLoop(): ILProgram {
    const builder = new ILTestBuilder();
    return builder
      .block('entry')
      .const('i', 0)
      .jump('loop')
      .block('loop')
      .phi('i.0', ['i', 'entry'], ['i.1', 'loop'])
      .load('v', 'buffer')
      .binop('add', 'v.1', 'v', 'one')
      .store('buffer', 'v.1')
      .binop('add', 'i.1', 'i.0', 'one')
      .cmp('done', 'lt', 'i.1', 'limit')
      .branch('done', 'loop', 'exit')
      .block('exit')
      .ret()
      .build();
  }
  
  /**
   * Build nested loops fixture
   */
  protected buildNestedLoops(): ILProgram {
    const builder = new ILTestBuilder();
    return builder
      .block('entry')
      .const('i', 0)
      .jump('outer')
      .block('outer')
      .phi('i.0', ['i', 'entry'], ['i.1', 'outer.inc'])
      .const('j', 0)
      .jump('inner')
      .block('inner')
      .phi('j.0', ['j', 'outer'], ['j.1', 'inner'])
      .binop('mul', 'idx', 'i.0', 'width')
      .binop('add', 'idx.1', 'idx', 'j.0')
      .store('screen', 'value')
      .binop('add', 'j.1', 'j.0', 'one')
      .cmp('j.done', 'lt', 'j.1', 'width')
      .branch('j.done', 'inner', 'outer.inc')
      .block('outer.inc')
      .binop('add', 'i.1', 'i.0', 'one')
      .cmp('i.done', 'lt', 'i.1', 'height')
      .branch('i.done', 'outer', 'exit')
      .block('exit')
      .ret()
      .build();
  }
  
  /**
   * Build diamond CFG fixture
   */
  protected buildDiamondCFG(): ILProgram {
    const builder = new ILTestBuilder();
    return builder
      .block('entry')
      .load('cond', 'flag')
      .branch('cond', 'then', 'else')
      .block('then')
      .const('v.then', 1)
      .jump('merge')
      .block('else')
      .const('v.else', 0)
      .jump('merge')
      .block('merge')
      .phi('v', ['v.then', 'then'], ['v.else', 'else'])
      .store('result', 'v')
      .ret()
      .build();
  }
  
  /**
   * Build memory copy fixture (C64 typical)
   */
  protected buildMemoryCopy(): ILProgram {
    const builder = new ILTestBuilder();
    return builder
      .block('entry')
      .const('i', 0)
      .jump('loop')
      .block('loop')
      .phi('i.0', ['i', 'entry'], ['i.1', 'loop'])
      .binop('add', 'src.addr', 'src', 'i.0')
      .load('v', 'src.addr')
      .binop('add', 'dst.addr', 'dst', 'i.0')
      .store('dst.addr', 'v')
      .binop('add', 'i.1', 'i.0', 'one')
      .cmp('done', 'lt', 'i.1', 'count')
      .branch('done', 'loop', 'exit')
      .block('exit')
      .ret()
      .build();
  }
  
  /**
   * Build sprite update fixture (C64 typical)
   */
  protected buildSpriteUpdate(): ILProgram {
    const builder = new ILTestBuilder();
    return builder
      .block('entry')
      .load('x', 'sprite.x')
      .binop('add', 'x.1', 'x', 'dx')
      .store('sprite.x', 'x.1')
      .store(0xD000, 'x.1')  // VIC sprite X
      .load('y', 'sprite.y')
      .binop('add', 'y.1', 'y', 'dy')
      .store('sprite.y', 'y.1')
      .store(0xD001, 'y.1')  // VIC sprite Y
      .ret()
      .build();
  }
  
  /**
   * Deep clone a program
   */
  protected clone(program: ILProgram): ILProgram {
    return JSON.parse(JSON.stringify(program));
  }
}
```

---

## Usage Examples

### Basic Unit Test

```typescript
import { UnitTestRunner } from './unit-runner';

const runner = new UnitTestRunner({ verifyCycles: true });

runner.createSuite('DeadCodeElimination', (ctx) => {
  runner.runTest('removes unused store', (ctx) => {
    // Build test program
    ctx.builder
      .block('entry')
      .const('v', 42)
      .store('unused', 'v')  // Dead store
      .ret();
    
    const program = ctx.builder.build();
    
    // Run optimization
    const dce = new DeadCodeElimination();
    const optimized = dce.run(program);
    
    // Assert dead store removed
    ctx.assert.instructionCount(optimized, 2); // const + ret
    ctx.assert.noInstruction(optimized, ILOpcode.STORE);
  });
});
```

### Using Fixtures

```typescript
runner.createSuite('LoopOptimization', (ctx) => {
  runner.runTest('hoists invariant from simple loop', (ctx) => {
    // Load predefined fixture
    const program = ctx.fixtures.load('simple-loop');
    
    // Add loop-invariant computation
    ctx.builder.reset();
    // ... modify fixture
    
    // Run LICM
    const licm = new LoopInvariantCodeMotion();
    const optimized = licm.run(program);
    
    // Verify invariant hoisted
    ctx.assert.instructionInBlock(optimized, 'entry', ILOpcode.BINOP);
  });
});
```

---

## Test Requirements

### Unit Tests for Runner

| Test Case | Description | Status |
|-----------|-------------|--------|
| runner-create-context | Creates valid test context | ⏳ |
| runner-collect-results | Collects pass/fail results | ⏳ |
| runner-timeout-handling | Handles test timeouts | ⏳ |
| runner-il-validation | Validates IL after tests | ⏳ |
| runner-ssa-validation | Validates SSA form | ⏳ |
| builder-basic-block | Creates basic blocks | ⏳ |
| builder-instructions | Adds various instructions | ⏳ |
| builder-terminators | Adds all terminator types | ⏳ |
| builder-cfg-edges | Computes CFG edges | ⏳ |
| fixture-loader | Loads built-in fixtures | ⏳ |

---

## Task Checklist

- [ ] 11.1a1.1: Implement `UnitTestRunner` class
- [ ] 11.1a1.2: Implement `ILTestBuilder` class
- [ ] 11.1a1.3: Implement `FixtureLoader` class
- [ ] 11.1a1.4: Add test context creation
- [ ] 11.1a1.5: Add IL validation
- [ ] 11.1a1.6: Add SSA form validation
- [ ] 11.1a1.7: Create built-in fixtures
- [ ] 11.1a1.8: Write unit tests for runner components

---

## References

- **Related Documents**:
  - `11-01a2-unit-helpers.md` - Unit test helper utilities
  - `11-01b-unit-assertions.md` - Unit test assertions library
  - `01-architecture.md` - IL instruction set