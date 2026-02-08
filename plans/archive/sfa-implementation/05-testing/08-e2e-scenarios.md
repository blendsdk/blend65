# End-to-End Test Scenarios

> **Document**: 05-testing/08-e2e-scenarios.md
> **Parent**: [05-overview.md](05-overview.md)
> **Status**: Ready

## Overview

This document defines end-to-end test scenarios that verify SFA works correctly through the entire compilation pipeline: Source → Parse → Semantic → SFA → IL → Codegen → Assembly.

---

## 1. E2E Test Strategy

### 1.1 What E2E Tests Verify

| Verification | Description |
|--------------|-------------|
| **Full Pipeline** | Source code compiles to assembly |
| **Correct Addresses** | Variables at expected memory locations |
| **Correct Opcodes** | ZP vs absolute addressing modes |
| **Memory Layout** | Frame region, ZP, RAM all correct |
| **No Regressions** | Existing code still works |

### 1.2 E2E Test Structure

```typescript
describe('E2E: SFA Compilation', () => {
  it('scenario name', () => {
    // 1. Load source fixture
    const source = loadFixture('category', 'name');
    
    // 2. Compile through full pipeline
    const result = compileToAssembly(source);
    
    // 3. Verify no errors
    expect(result.errors).toHaveLength(0);
    
    // 4. Verify assembly output
    expect(result.assembly).toContain('main:');
    expect(result.assembly).toContain('lda $0200');  // Frame address
  });
});
```

---

## 2. E2E Test Scenarios

### 2.1 Scenario: Simple Game Loop

**Purpose**: Verify basic SFA with game-like structure.

**Source** (`e2e/game-loop.blend`):
```js
module E2E.GameLoop;

@zp let frameCounter: byte = 0;
let running: byte = 1;

function main(): void {
    while running != 0 {
        update();
        draw();
        frameCounter += 1;
    }
}

function update(): void {
    let input: byte = peek($DC00);
    if input == 0 {
        running = 0;
    }
}

function draw(): void {
    let color: byte = frameCounter & $0F;
    poke($D020, color);
}
```

**Expected Assembly Patterns**:
```asm
; frameCounter should use ZP addressing (1 byte shorter)
inc $02               ; Not inc $0800

; update.input in frame region
lda $DC00
sta $0200             ; update frame

; update and draw should share memory (coalesced)
```

**Verification**:
- [ ] `frameCounter` at ZP address
- [ ] `update` and `draw` coalesced
- [ ] Correct addressing modes

---

### 2.2 Scenario: Sprite Handler

**Purpose**: Verify coalescing with multiple similar functions.

**Source** (`e2e/sprites.blend`):
```js
module E2E.Sprites;

function main(): void {
    updateSprites();
    drawSprites();
}

function updateSprites(): void {
    updateSprite0();
    updateSprite1();
    updateSprite2();
    updateSprite3();
}

function drawSprites(): void {
    drawSprite0();
    drawSprite1();
    drawSprite2();
    drawSprite3();
}

function updateSprite0(): void { let x: byte = 0; let y: byte = 0; }
function updateSprite1(): void { let x: byte = 0; let y: byte = 0; }
function updateSprite2(): void { let x: byte = 0; let y: byte = 0; }
function updateSprite3(): void { let x: byte = 0; let y: byte = 0; }

function drawSprite0(): void { let color: byte = 0; }
function drawSprite1(): void { let color: byte = 0; }
function drawSprite2(): void { let color: byte = 0; }
function drawSprite3(): void { let color: byte = 0; }
```

**Verification**:
- [ ] All updateSpriteN functions coalesce
- [ ] All drawSpriteN functions coalesce
- [ ] updateSpriteN and drawSpriteN coalesce (different branches)
- [ ] Memory savings > 50%

---

### 2.3 Scenario: ISR Timer

**Purpose**: Verify callback isolation.

**Source** (`e2e/isr-timer.blend`):
```js
module E2E.ISRTimer;

let tick: word = 0;
let running: byte = 1;

function main(): void {
    setupTimer();
    while running != 0 {
        gameLoop();
    }
}

function setupTimer(): void {
    let temp: byte = 0;
    // Setup IRQ vector...
}

function gameLoop(): void {
    let frame: byte = 0;
    // Game logic using tick...
}

callback timerIRQ(): void {
    let savedA: byte = 0;
    tick += 1;
    // Acknowledge interrupt...
}
```

**Verification**:
- [ ] `timerIRQ` NOT coalesced with `main`, `setupTimer`, `gameLoop`
- [ ] `setupTimer` and `gameLoop` CAN coalesce (same thread)
- [ ] No runtime interference

---

### 2.4 Scenario: ZP Pressure

**Purpose**: Verify ZP scoring under pressure.

**Source** (`e2e/zp-pressure.blend`):
```js
module E2E.ZPPressure;

// Explicit ZP requests
@zp let fastPtr: *byte;
@zp let loopIdx: byte = 0;

// Compete for remaining ZP
let counter1: byte = 0;
let counter2: byte = 0;
let bigArray: byte[200];

function main(): void {
    while loopIdx < 100 {
        // Hot loop - counter1 should get ZP
        counter1 += 1;
        loopIdx += 1;
    }
    
    // Cold code - counter2 stays in RAM
    counter2 = counter1;
}
```

**Verification**:
- [ ] `fastPtr` in ZP (explicit)
- [ ] `loopIdx` in ZP (explicit)
- [ ] `counter1` may get ZP (hot variable)
- [ ] `bigArray` in RAM (too large for ZP)
- [ ] No ZP overflow

---

### 2.5 Scenario: Memory Limits

**Purpose**: Verify behavior at frame region limits.

**Source** (`e2e/memory-limits.blend`):
```js
module E2E.MemoryLimits;

function main(): void {
    phase1();
    phase2();
    phase3();
}

function phase1(): void {
    let buffer1: byte[150];
    process(buffer1);
}

function phase2(): void {
    let buffer2: byte[150];
    process(buffer2);
}

function phase3(): void {
    let buffer3: byte[150];
    process(buffer3);
}

function process(data: *byte): void {
    let i: byte = 0;
    // Process data...
}
```

**Verification**:
- [ ] `phase1`, `phase2`, `phase3` coalesce (150 bytes each → 150 total)
- [ ] Total frame usage ≤ 512 bytes
- [ ] `process` called from all phases, gets own frame

---

### 2.6 Scenario: Real C64 Memory Map

**Purpose**: Verify addresses match C64 hardware.

**Source** (`e2e/c64-memory.blend`):
```js
module E2E.C64Memory;

// Screen memory pointer (must be in ZP for indirect)
@zp let screenPtr: *byte;

// Raster position (hot, should get ZP)
@zp let rasterY: byte = 0;

function main(): void {
    screenPtr = $0400;  // C64 screen RAM
    
    while true {
        waitRaster();
        drawScreen();
    }
}

function waitRaster(): void {
    let current: byte = 0;
    while current != rasterY {
        current = peek($D012);
    }
}

function drawScreen(): void {
    let offset: word = 0;
    let i: byte = 0;
    
    while i < 40 {
        *(screenPtr + offset) = i;
        offset += 1;
        i += 1;
    }
}
```

**Verification**:
- [ ] `screenPtr` in ZP $02-$8F range
- [ ] `rasterY` in ZP
- [ ] Indirect addressing uses `(zp),Y` pattern
- [ ] Screen writes go to $0400+

---

## 3. E2E Test Implementation

### 3.1 Test File Structure

```typescript
// __tests__/frame/e2e/game-patterns.test.ts
import { describe, it, expect } from 'vitest';
import { compileToAssembly, loadE2EFixture } from '../helpers/index.js';

describe('E2E: Game Patterns', () => {
  describe('Game Loop', () => {
    it('should compile game loop with correct SFA', () => {
      const source = loadE2EFixture('game-loop');
      const result = compileToAssembly(source);
      
      // No errors
      expect(result.errors).toHaveLength(0);
      
      // Frame addresses correct
      expect(result.frameMap.get('main')).toBeDefined();
      expect(result.frameMap.get('update')).toBeDefined();
      
      // Coalescing applied
      const updateFrame = result.frameMap.get('update')!;
      const drawFrame = result.frameMap.get('draw')!;
      expect(updateFrame.coalesceGroup).toBe(drawFrame.coalesceGroup);
      
      // ZP for hot variables
      expect(result.zpAllocations).toContain('frameCounter');
      
      // Assembly has ZP opcodes
      expect(result.assembly).toMatch(/inc \$[0-8][0-9a-f]/);  // ZP inc
    });
  });
});
```

### 3.2 Full Pipeline Helper

```typescript
// helpers/pipeline.ts
export function compileToAssembly(source: string): E2EResult {
  // 1. Parse
  const program = parse(source);
  
  // 2. Semantic analysis (includes SFA)
  const semanticResult = analyze(program);
  
  // 3. Generate IL
  const ilProgram = generateIL(program, semanticResult.frameMap);
  
  // 4. Generate assembly
  const assembly = generateAssembly(ilProgram);
  
  return {
    program,
    semanticResult,
    frameMap: semanticResult.frameMap,
    zpAllocations: getZPSlotNames(semanticResult.frameMap),
    ilProgram,
    assembly,
    errors: semanticResult.diagnostics.filter(d => d.severity === 'error'),
  };
}
```

---

## 4. E2E Test Schedule

| Phase | E2E Tests Enabled |
|-------|-------------------|
| Phase 1 (Types) | None - no runtime yet |
| Phase 2 (Allocator) | Frame address tests |
| Phase 3 (Coalescing) | Coalescing tests |
| Phase 4 (Integration) | All E2E tests |

---

## 5. Success Criteria

E2E tests pass when:

- [ ] All fixtures compile without errors
- [ ] Frame addresses match expected values
- [ ] Coalescing produces expected groups
- [ ] ZP allocations match expected slots
- [ ] Assembly uses correct addressing modes
- [ ] No regressions in existing tests

---

**Next Document**: [../10-types/10-overview.md](../10-types/10-overview.md)