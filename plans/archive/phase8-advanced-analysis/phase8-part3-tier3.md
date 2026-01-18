# Phase 8 Implementation Plan - Part 3: Tier 3 - Advanced Analysis

> **Navigation**: [Part 2](phase8-part2-tier2.md) ← [Part 3] → [Part 4: Tier 4 Hardware](phase8-part4-tier4-hardware.md)
>
> **Focus**: Week 3 - Advanced Analysis
> **Tasks**: 8.8-8.14, 8.18-8.19 (9 tasks, 75 hours, 238+ tests)
> **Prerequisites**: Part 2 complete (Tier 2 - Data Flow) ✅

---

## Tier 3 Overview: Advanced Analysis

**Goal**: Implement sophisticated analyses that go beyond basic dataflow.

**Why Critical**: These analyses enable:
- Pointer alias analysis
- Function purity detection
- Memory escape analysis
- Loop optimization opportunities
- Call graph construction
- 6502-specific hardware hints

**Dependencies**:
- Tier 2 complete (reaching definitions, liveness, constants)
- Control flow graphs from Phase 5
- Type system from Phase 2

---

## Task 8.8: Alias Analysis (10 hours) 🔧 EXPANDED

**File**: `packages/compiler/src/semantic/analysis/alias-analysis.ts`

**Goal**: Track which variables/pointers may refer to the same memory location + detect self-modifying code

**Why Critical**: Determines safe transformations, prevents incorrect optimizations

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.AliasPointsTo;        // Set<MemoryLocation> - what this points to
OptimizationMetadataKey.AliasNonAliasSet;     // Set<VariableId> - proven non-aliases
OptimizationMetadataKey.AliasMemoryRegion;    // MemoryRegion enum - I/O, ZP, RAM, etc.
OptimizationMetadataKey.SelfModifyingCode;    // boolean - writes to code addresses 🆕
```

**Implementation**: Use Andersen's or Steensgaard's algorithm for pointer analysis

**🆕 NEW: Self-Modifying Code Detection**

Detect and warn about potential self-modifying code patterns:

```typescript
// Detect writes to code address ranges
function detectSelfModifyingCode(): void {
  for (const write of this.getAllMemoryWrites()) {
    const writeAddr = this.getWriteAddress(write);
    
    // Check if write target is in code address range
    if (this.isCodeAddress(writeAddr)) {
      // Warn about potential self-modifying code
      this.diagnostics.push(
        Diagnostic.warning(
          write.location,
          'Potential self-modifying code detected. ' +
          'Writing to code address range may break optimizations.'
        )
      );
      
      write.metadata = write.metadata || new Map();
      write.metadata.set(OptimizationMetadataKey.SelfModifyingCode, true);
    }
  }
}
```

**Key Scenarios**:
```typescript
// Scenario 1: Address-of function/label (suspicious!)
let codePtr: word = @myFunction;  // WARNING: Taking address of code
mem[codePtr] = 0x60;  // WARNING: Writing to code address!

// Scenario 2: Indirect write to code range
let addr: word = $C000;  // In typical code range
mem[addr] = value;  // WARNING: May modify code!
```

**Tests** (30+): Same memory, different variables, @map aliases, address-of operator, function parameters, array indexing, conditional aliasing, no-alias proofs, I/O region detection, zero-page aliasing, **self-modifying code detection (5+ new tests)**

---

## Task 8.9: Purity Analysis (8 hours)

**File**: `packages/compiler/src/semantic/analysis/purity-analysis.ts`

**Goal**: Detect pure functions (no side effects, same inputs → same outputs)

**Why Critical**: Pure functions can be memoized, reordered, eliminated

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.PurityLevel;              // PurityLevel enum
OptimizationMetadataKey.PurityWrittenLocations;   // Set<MemoryLocation>
OptimizationMetadataKey.PurityReadLocations;      // Set<MemoryLocation>
OptimizationMetadataKey.PuritySideEffectFree;     // boolean
```

**PurityLevel enum**:
```typescript
export enum PurityLevel {
  Pure = 'Pure',                    // No side effects, deterministic
  ReadOnly = 'ReadOnly',            // Reads memory, no writes
  LocalMutation = 'LocalMutation',  // Only mutates local state
  SideEffects = 'SideEffects',      // Has observable side effects
}
```

**Implementation**: Analyze function bodies for I/O operations, memory writes, non-local state access

**Tests** (20+): Pure math functions, I/O operations detection, global variable writes, @map accesses, function call transitivity, parameter mutations, return value analysis, loop purity, conditional purity

---

## Task 8.10: Escape Analysis (6 hours) 🔧 EXPANDED

**File**: `packages/compiler/src/semantic/analysis/escape-analysis.ts`

**Goal**: Determine if variables "escape" local scope + track stack overflow risk

**Why Critical**: Non-escaping variables can use zero-page, be optimized aggressively

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.EscapeEscapes;          // boolean - does it escape?
OptimizationMetadataKey.EscapeStackAllocatable; // boolean - can use stack/ZP
OptimizationMetadataKey.EscapeLocalOnly;        // boolean - never leaves function
OptimizationMetadataKey.StackDepth;             // number - cumulative stack usage 🆕
OptimizationMetadataKey.StackOverflowRisk;      // boolean - >256 bytes used 🆕
```

**Implementation**: Track variable usage through function boundaries, address-of operators, assignments to globals

**🆕 NEW: Stack Overflow Detection**

6502 stack is only **256 bytes** ($0100-$01FF). Deep call chains cause stack overflow!

```typescript
/**
 * Track cumulative stack depth through call chain
 */
function analyzeStackUsage(func: FunctionDeclaration): void {
  let stackUsage = 0;
  
  // JSR pushes 2-byte return address
  stackUsage += 2;
  
  // Function parameters passed on stack (if any)
  stackUsage += this.getParameterStackUsage(func);
  
  // Local variables on stack
  stackUsage += this.getLocalVariableStackUsage(func);
  
  // Recursively track called functions
  for (const calledFunc of this.getCalledFunctions(func)) {
    const calleeDepth = calledFunc.metadata?.get(OptimizationMetadataKey.StackDepth) || 0;
    stackUsage += calleeDepth;
  }
  
  func.metadata = func.metadata || new Map();
  func.metadata.set(OptimizationMetadataKey.StackDepth, stackUsage);
  
  // Warn if stack usage exceeds 256 bytes
  if (stackUsage > 256) {
    this.diagnostics.push(
      Diagnostic.error(
        func.location,
        `Stack overflow risk! Function uses ${stackUsage} bytes (limit: 256 bytes). ` +
        'Reduce call depth or local variable usage.'
      )
    );
    
    func.metadata.set(OptimizationMetadataKey.StackOverflowRisk, true);
  } else if (stackUsage > 200) {
    this.diagnostics.push(
      Diagnostic.warning(
        func.location,
        `High stack usage: ${stackUsage} bytes. Close to 256 byte limit.`
      )
    );
  }
}
```

**Why This Matters**:
```typescript
// DANGER: Deep recursion on 6502
function factorial(n: byte): word {
  if (n <= 1) return 1;
  return n * factorial(n - 1);  // Each call: ~6 bytes stack
}

// factorial(50) = 300 bytes → STACK OVERFLOW! 💥
```

**Tests** (20+): Local-only variables, function parameters that escape, return value escaping, address-of causing escape, array element escape, global assignment, nested function escape, conditional escape, **stack depth tracking (5+ new tests)**

---

## Task 8.11: Loop Analysis (10 hours) 🔧 EXPANDED

**File**: `packages/compiler/src/semantic/analysis/loop-analysis.ts`

**Goal**: Detect loop-invariant code, unrollable loops, iteration counts + induction variables

**Why Critical**: Loop optimization is critical for 6502 performance

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.LoopInvariant;          // boolean - invariant expression
OptimizationMetadataKey.LoopHoistCandidate;     // boolean - can hoist out of loop
OptimizationMetadataKey.LoopIterationCount;     // number - known iteration count
OptimizationMetadataKey.LoopUnrollable;         // boolean - small, fixed count
OptimizationMetadataKey.InductionVariable;      // boolean - is induction variable 🆕
OptimizationMetadataKey.InductionVariableBase;  // string - base variable (for derived) 🆕
OptimizationMetadataKey.InductionVariableStride; // number - increment per iteration 🆕
```

**Implementation**: Natural loop detection, dominance analysis, invariant code motion candidates

**🆕 NEW: Induction Variable Recognition**

**What is an Induction Variable?**

A variable that changes by a fixed amount each loop iteration.

```typescript
// Basic induction variable
for (let i: byte = 0; i < 10; i = i + 1) {
  // 'i' is basic induction variable (stride = 1)
}

// Derived induction variable
for (let i: byte = 0; i < 10; i = i + 1) {
  let j: byte = i * 4;  // 'j' is derived induction variable (base = i, stride = 4)
  array[j] = value;     // Can optimize to: base + 4*i
}
```

**Implementation Pattern**:

```typescript
/**
 * Recognize basic and derived induction variables
 */
function recognizeInductionVariables(loop: LoopInfo): void {
  // Phase 1: Find basic induction variables (loop counters)
  const basicIVs = new Map<string, { stride: number }>();
  
  for (const phi of loop.headerPhis) {
    if (this.isLinearUpdate(phi)) {
      const stride = this.getUpdateStride(phi);
      basicIVs.set(phi.variable, { stride });
      
      phi.metadata = phi.metadata || new Map();
      phi.metadata.set(OptimizationMetadataKey.InductionVariable, true);
      phi.metadata.set(OptimizationMetadataKey.InductionVariableStride, stride);
    }
  }
  
  // Phase 2: Find derived induction variables (i*2, i*4, etc.)
  for (const stmt of loop.body) {
    if (this.isDerivedIV(stmt, basicIVs)) {
      const base = this.getBaseIV(stmt);
      const stride = this.getDerivedStride(stmt, basicIVs);
      
      stmt.metadata = stmt.metadata || new Map();
      stmt.metadata.set(OptimizationMetadataKey.InductionVariable, true);
      stmt.metadata.set(OptimizationMetadataKey.InductionVariableBase, base);
      stmt.metadata.set(OptimizationMetadataKey.InductionVariableStride, stride);
    }
  }
}
```

**Why This Matters**:

```typescript
// WITHOUT induction variable recognition:
for (let i: byte = 0; i < 10; i = i + 1) {
  array[i * 4] = value;  // Multiply every iteration (~80 cycles!)
}

// WITH induction variable recognition:
let j: byte = 0;
for (let i: byte = 0; i < 10; i = i + 1) {
  array[j] = value;  // Use derived IV directly
  j = j + 4;         // Simple addition (3 cycles)
}
// Saves: 77 cycles per iteration!
```

**Tests** (33+): Loop-invariant expressions, loop-variant expressions, nested loop invariants, loop hoisting opportunities, iteration count detection, unrollable loops, infinite loops, break/continue handling, complex control flow in loops, **basic induction variables (4+ tests), derived induction variables (4+ tests)**

---

## Task 8.12: Call Graph Analysis (8 hours)

**File**: `packages/compiler/src/semantic/analysis/call-graph.ts`

**Goal**: Build complete call graph, detect inlining opportunities

**Why Critical**: Enables interprocedural optimization, dead code elimination

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.CallGraphUnused;           // boolean - never called
OptimizationMetadataKey.CallGraphCallCount;        // number - static call sites
OptimizationMetadataKey.CallGraphInlineCandidate;  // boolean - small enough to inline
```

**Implementation**: Build directed graph of function calls, detect recursion, calculate function sizes

**Tests** (20+): Direct calls, indirect calls, recursive functions, mutually recursive, call count tracking, inline candidates (small functions), large functions (no inline), entry points, exported functions, dead function detection

---

## Task 8.13: 6502 Hardware Hints (10 hours) 🔧 EXPANDED

**File**: `packages/compiler/src/semantic/analysis/m6502-hints.ts`

**Goal**: Generate 6502-specific optimization hints + blacklist reserved zero-page locations

**Why Critical**: Guides code generation for optimal 6502 assembly

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.M6502ZeroPagePriority;      // number 0-100 - ZP allocation priority
OptimizationMetadataKey.M6502RegisterPreference;    // Register enum (A, X, Y, Any)
OptimizationMetadataKey.M6502MemoryAccessPattern;   // MemoryAccessPattern enum
OptimizationMetadataKey.M6502ZeroPageReserved;      // boolean - reserved location 🆕
```

**Implementation**: Analyze usage patterns, liveness intervals, access frequency, loop depth

**🆕 NEW: Reserved Zero-Page Blacklist**

**CRITICAL**: Not all zero-page is usable!

```typescript
/**
 * Zero-page reserved locations (CANNOT USE!)
 */
const RESERVED_ZERO_PAGE = {
  // $00-$01: Memory configuration (CRITICAL - DO NOT USE!)
  memoryConfig: { start: 0x00, end: 0x01 },
  
  // $90-$FF: KERNAL workspace (Risk of corruption!)
  kernalWorkspace: { start: 0x90, end: 0xFF },
};

/**
 * Safe zero-page range: $02-$8F (~140 bytes, not 256!)
 */
const SAFE_ZERO_PAGE = { start: 0x02, end: 0x8F };  // Only 142 bytes usable!

function isZeroPageSafe(address: number): boolean {
  return address >= SAFE_ZERO_PAGE.start && address <= SAFE_ZERO_PAGE.end;
}

function allocateZeroPage(): void {
  // Sort variables by priority
  const sorted = this.sortByZeroPagePriority();
  
  let zpAddress = SAFE_ZERO_PAGE.start;
  
  for (const variable of sorted) {
    if (zpAddress > SAFE_ZERO_PAGE.end) {
      // Out of zero-page!
      break;
    }
    
    // Allocate safe zero-page address
    variable.metadata = variable.metadata || new Map();
    variable.metadata.set(OptimizationMetadataKey.M6502ZeroPageAddress, zpAddress);
    
    zpAddress += this.getVariableSize(variable);
  }
}
```

**Why This Matters**:

```typescript
// DANGER: Using $00-$01 crashes the C64!
@zp myVar at $00: byte;  // FATAL: Memory configuration register!

// DANGER: Using $90-$FF causes random crashes
@zp temp at $90: byte;   // BAD: KERNAL workspace (corrupted by KERNAL calls)

// SAFE: Use $02-$8F only
@zp counter at $02: byte;  // GOOD: Safe zero-page range
```

**Tests** (38+): High-frequency variables → ZP priority, loop counters → X/Y registers, single-access variables → low priority, hot path detection, array indexing → X/Y preference, accumulator operations → A preference, indirect addressing detection, **reserved ZP detection (5+ tests), safe ZP allocation (3+ tests)**

---

---

## Task 8.18: Global Value Numbering (6 hours) 🆕

**File**: `packages/compiler/src/semantic/analysis/global-value-numbering.ts`

**Goal**: Eliminate redundant computations across basic blocks

**Why Critical**: GVN finds identical expressions that constant propagation misses

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.GVNNumber;        // number - value number assigned
OptimizationMetadataKey.GVNRedundant;     // boolean - redundant computation
OptimizationMetadataKey.GVNReplacement;   // string - variable to replace with
```

**What is Global Value Numbering?**

Assign same "value number" to expressions that compute the same value:

```typescript
// WITHOUT GVN:
let x: byte = a + b;    // Value number 1
// ... other code ...
let y: byte = a + b;    // Recomputes same value!

// WITH GVN:
let x: byte = a + b;    // Value number 1
// ... other code ...
let y: byte = x;        // Reuse x (same value number!)
```

**Implementation Pattern**:

```typescript
/**
 * Global value numbering analyzer
 *
 * Assigns value numbers to expressions and detects
 * redundant computations across basic blocks.
 */
export class GlobalValueNumberingAnalyzer {
  private valueNumbers = new Map<string, number>();
  private expressions = new Map<number, Expression>();
  private nextValueNumber = 1;

  constructor(
    private cfg: ControlFlowGraph,
    private symbolTable: SymbolTable
  ) {}

  analyze(): void {
    // Phase 1: Assign value numbers to all expressions
    for (const block of this.cfg.getBlocks()) {
      for (const stmt of block.statements) {
        if (this.isExpression(stmt)) {
          const vn = this.getOrAssignValueNumber(stmt);
          
          stmt.metadata = stmt.metadata || new Map();
          stmt.metadata.set(OptimizationMetadataKey.GVNNumber, vn);
        }
      }
    }

    // Phase 2: Detect redundant computations
    this.detectRedundantComputations();
  }

  private getOrAssignValueNumber(expr: Expression): number {
    // Compute expression hash (structural equality)
    const exprHash = this.computeExpressionHash(expr);
    
    if (this.valueNumbers.has(exprHash)) {
      // Expression already computed - mark as redundant!
      return this.valueNumbers.get(exprHash)!;
    }
    
    // New unique expression - assign new value number
    const vn = this.nextValueNumber++;
    this.valueNumbers.set(exprHash, vn);
    this.expressions.set(vn, expr);
    return vn;
  }

  private computeExpressionHash(expr: Expression): string {
    // Structural hash: same operator + same operands = same hash
    if (this.isBinaryExpression(expr)) {
      const left = this.getValueNumber(expr.left);
      const right = this.getValueNumber(expr.right);
      return `${expr.operator}:${left}:${right}`;
    } else if (this.isVariable(expr)) {
      return `var:${expr.name}`;
    }
    // ... other expression types
    return '';
  }

  private detectRedundantComputations(): void {
    const firstOccurrence = new Map<number, Expression>();
    
    for (const block of this.cfg.getBlocks()) {
      for (const stmt of block.statements) {
        const vn = stmt.metadata?.get(OptimizationMetadataKey.GVNNumber);
        if (vn !== undefined) {
          if (firstOccurrence.has(vn)) {
            // Redundant! Mark for replacement
            const original = firstOccurrence.get(vn)!;
            
            stmt.metadata.set(OptimizationMetadataKey.GVNRedundant, true);
            stmt.metadata.set(
              OptimizationMetadataKey.GVNReplacement,
              this.getVariableName(original)
            );
          } else {
            firstOccurrence.set(vn, stmt);
          }
        }
      }
    }
  }

  // ... helper methods
}
```

**Why This Matters**:

```typescript
// WITHOUT GVN:
let temp1: byte = sprite.x + 8;  // Compute sprite.x + 8
updateSpriteX(sprite);
let temp2: byte = sprite.x + 8;  // Recompute same value! (5 cycles wasted)

// WITH GVN:
let temp1: byte = sprite.x + 8;  // VN = 1
updateSpriteX(sprite);
let temp2: byte = temp1;         // Reuse temp1 (VN = 1)
// Saves: 5 cycles per redundant computation
```

**Tests** (15+):

- Simple redundant expression
- Redundant across blocks
- Non-redundant (different operands)
- Binary expression GVN
- Variable reference GVN
- Array access GVN
- Commutative operations (a+b = b+a)
- GVN with constant folding
- GVN through control flow
- GVN invalidation (variable reassignment)
- Complex nested expressions
- GVN with function calls (conservative)

---

## Task 8.19: Common Subexpression Elimination (5 hours) 🆕

**File**: `packages/compiler/src/semantic/analysis/common-subexpr-elimination.ts`

**Goal**: Eliminate repeated subexpressions within basic block

**Why Critical**: CSE is GVN's simpler sibling - faster analysis, local optimization

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.CSEAvailable;     // Set<string> - available expressions
OptimizationMetadataKey.CSECandidate;     // boolean - can be eliminated
```

**What is CSE?**

Find repeated subexpressions in same basic block:

```typescript
// WITHOUT CSE:
let x: byte = a * 2 + b * 2;  // Computes a*2 and b*2
let y: byte = a * 2;          // Recomputes a*2!

// WITH CSE:
let temp1: byte = a * 2;      // Compute once
let temp2: byte = b * 2;
let x: byte = temp1 + temp2;
let y: byte = temp1;          // Reuse temp1
```

**Implementation Pattern**:

```typescript
/**
 * Common subexpression elimination analyzer
 *
 * Finds repeated subexpressions within basic blocks
 * and marks them for elimination.
 */
export class CommonSubexpressionEliminationAnalyzer {
  private availableExpressions = new Map<string, Set<string>>();

  constructor(
    private cfg: ControlFlowGraph
  ) {}

  analyze(): void {
    // Process each basic block independently
    for (const block of this.cfg.getBlocks()) {
      this.analyzeBlock(block);
    }
  }

  private analyzeBlock(block: BasicBlock): void {
    const available = new Set<string>();
    
    for (const stmt of block.statements) {
      if (this.isExpression(stmt)) {
        const exprStr = this.expressionToString(stmt);
        
        if (available.has(exprStr)) {
          // Subexpression already computed in this block!
          stmt.metadata = stmt.metadata || new Map();
          stmt.metadata.set(OptimizationMetadataKey.CSECandidate, true);
        } else {
          // First occurrence - add to available set
          available.add(exprStr);
        }
      }
      
      // Update available expressions after assignments
      if (this.isAssignment(stmt)) {
        this.invalidateExpressionsUsing(available, stmt.target);
      }
    }
    
    // Store available expressions for this block
    block.metadata = block.metadata || new Map();
    block.metadata.set(OptimizationMetadataKey.CSEAvailable, available);
  }

  private expressionToString(expr: Expression): string {
    // Simple string representation of expression
    if (this.isBinaryExpression(expr)) {
      return `(${this.expressionToString(expr.left)} ${expr.operator} ${this.expressionToString(expr.right)})`;
    } else if (this.isVariable(expr)) {
      return expr.name;
    }
    // ... other types
    return '';
  }

  private invalidateExpressionsUsing(available: Set<string>, variable: string): void {
    // Remove all expressions that use this variable
    for (const expr of available) {
      if (expr.includes(variable)) {
        available.delete(expr);
      }
    }
  }

  // ... helper methods
}
```

**Why This Matters**:

```typescript
// WITHOUT CSE (array indexing):
sprites[i].x = sprites[i].x + 1;  // Computes sprites[i] twice!
// sprites[i] = load base + i*size (6+ cycles per access)
// Total: 12+ cycles

// WITH CSE:
let temp: Sprite = sprites[i];    // Compute once (6 cycles)
temp.x = temp.x + 1;               // Reuse (3 cycles)
// Total: 9 cycles (saves 3 cycles)
```

**Tests** (12+):

- Simple repeated subexpression
- Multiple occurrences in block
- Subexpression invalidated by assignment
- Array access CSE
- Member access CSE
- Arithmetic subexpression
- Nested subexpressions
- No CSE across basic blocks (different from GVN)
- CSE with side effects (don't eliminate!)
- Commutative expression matching

---

## Task 8.14: Tier 3 Integration & Testing (10 hours)

**File**: `packages/compiler/src/semantic/analysis/integration.ts` (update)

**Goal**: Integrate all Tier 3 analyses into AdvancedAnalyzer orchestrator

**Deliverables**:
- Update `AdvancedAnalyzer.runTier3AdvancedAnalysis()` to call all analyses (including 8.18, 8.19)
- End-to-end tests combining all Tier 1-3 analyses
- Performance testing (ensure <2s for 10,000 LOC)

**Tests** (50+): Full pipeline tests, analysis interdependencies, real C64 code patterns, performance benchmarks, error handling, edge cases, complex programs

---

## Tier 3 Summary

| Task      | Description                | Hours      | Tests          | Metadata Keys | Status  |
| --------- | -------------------------- | ---------- | -------------- | ------------- | ------- |
| 8.8       | Alias analysis 🔧          | 10         | 30+            | 4             | [ ]     |
| 8.9       | Purity analysis            | 8          | 20+            | 4             | [ ]     |
| 8.10      | Escape analysis 🔧         | 6          | 20+            | 5             | [ ]     |
| 8.11      | Loop analysis 🔧           | 10         | 33+            | 7             | [ ]     |
| 8.12      | Call graph                 | 8          | 20+            | 3             | [ ]     |
| 8.13      | 6502 hints 🔧              | 10         | 38+            | 4             | [ ]     |
| 8.18      | Global value numbering 🆕  | 6          | 15+            | 3             | [ ]     |
| 8.19      | CSE 🆕                     | 5          | 12+            | 2             | [ ]     |
| 8.14      | Integration                | 10         | 50+            | N/A           | [ ]     |
| **Total** | **Tier 3 (Advanced)**      | **73 hrs** | **238+ tests** | **32 keys**   | **[ ]** |

---

## Detailed Task Specifications

### Task 8.8: Alias Analysis (Detailed)

**Core Algorithm**: Andersen's points-to analysis (flow-insensitive, context-insensitive)

**Steps**:
1. Build points-to constraints from assignments
2. Solve constraints iteratively until fixpoint
3. Build alias sets from points-to information
4. Attach metadata to AST nodes

**Key Scenarios**:
```typescript
// Scenario 1: Direct aliasing
@map screenRam at $0400: [byte; 1000];
@map colorRam at $D800: [byte; 1000];
// Non-alias: screenRam and colorRam never alias

// Scenario 2: Address-of aliasing
let x: byte = 10;
let ptr: word = @x;
// ptr aliases x's memory location

// Scenario 3: I/O region detection
@map vicBorder at $D020: byte;
// Memory region: I/O ($D000-$DFFF)
```

---

### Task 8.9: Purity Analysis (Detailed)

**Core Algorithm**: Bottom-up purity inference with function call transitivity

**Steps**:
1. Mark all functions as Pure initially
2. Scan for side effects (I/O, global writes, @map accesses)
3. Downgrade purity level as needed
4. Propagate impurity through call graph
5. Iterate until fixpoint

**Key Scenarios**:
```typescript
// Pure function
function add(a: byte, b: byte): byte {
  return a + b;  // Pure: no side effects
}

// ReadOnly function
@map vicBorder at $D020: byte;
function getBorder(): byte {
  return vicBorder;  // ReadOnly: reads I/O
}

// Side effects
function setBorder(color: byte): void {
  vicBorder = color;  // SideEffects: writes I/O
}
```

---

### Task 8.11: Loop Analysis (Detailed)

**Core Algorithm**: Natural loop detection + dominance-based invariant detection

**Steps**:
1. Detect back edges in CFG
2. Identify natural loops
3. Compute dominance frontier
4. Detect loop-invariant expressions
5. Calculate iteration counts (if possible)
6. Mark unrollable loops (small, fixed count)

**Key Scenarios**:
```typescript
// Loop-invariant hoisting
function process() {
  let constant: byte = 100;
  for (let i: byte = 0; i < 10; i = i + 1) {
    let x: byte = constant + i;  // 'constant' is loop-invariant
  }
}

// Unrollable loop
for (let i: byte = 0; i < 4; i = i + 1) {
  // Small, fixed count → can unroll
}
```

---

### Task 8.13: 6502 Hints (Detailed)

**Core Algorithm**: Multi-factor scoring for register/memory allocation

**Zero-Page Priority Factors**:
- Usage frequency (reads + writes)
- Loop depth (higher depth → higher priority)
- Liveness interval (short-lived → higher priority)
- Size (byte → higher priority than word)

**Register Preference Factors**:
- Arithmetic operations → A register
- Loop counters → X or Y register
- Array indexing → X or Y register
- Indirect addressing → depends on addressing mode

**Example Scoring**:
```typescript
// High ZP priority (loop counter, high frequency)
for (let i: byte = 0; i < 100; i = i + 1) {
  // i: ZP priority = 95, register preference = X
}

// Low ZP priority (single use)
let temp: byte = x + y;
// temp: ZP priority = 10, register preference = A
```

---

## Integration Notes

**After Tier 3 completion, the following are available:**

1. **Full Analysis Pipeline**: Tiers 1-3 all working together
2. **Optimization Metadata**: ~50 metadata keys available for IL optimizer
3. **Production-Ready**: Can analyze real C64 programs with sophisticated optimizations

**Dependencies for Tier 4 (God-Level)**:

- Tier 3 provides foundation for hardware-specific analyses
- Call graph enables cross-module analysis
- Purity analysis enables aggressive optimization
- Loop analysis feeds into cycle-counting optimizations

---

## Next Steps

After completing **Part 3 (Tier 3)**:

1. ✅ All Tier 3 tasks complete (8.8-8.14)
2. ✅ 185+ tests passing
3. ✅ Advanced analyses working
4. ✅ Full Tier 1-3 pipeline functional

**→ Continue to [Part 4: Tier 4 - Hardware & Modern Compiler](phase8-part4-tier4-hardware.md)**

---

**Part 3 Status**: Tier 3 - Advanced Analysis (9 tasks, 73 hours, 238+ tests)
**Architecture**: Sophisticated analyses with GVN/CSE, production-ready ✅

**🆕 NEW in This Update**:
- Task 8.18: Global Value Numbering (6 hours, 15+ tests)
- Task 8.19: Common Subexpression Elimination (5 hours, 12+ tests)
- Task 8.8: Expanded with self-modifying code detection
- Task 8.10: Expanded with stack overflow detection
- Task 8.11: Expanded with induction variable recognition
- Task 8.13: Expanded with reserved zero-page blacklist