# Test Fixtures

> **Document**: 05-testing/07-fixtures.md
> **Parent**: [05-overview.md](05-overview.md)
> **Status**: Ready

## Overview

This document defines the Blend test programs (fixtures) used to test SFA functionality. Each fixture is designed to test specific SFA features.

---

## 1. Fixture Categories

| Category | Purpose | Count |
|----------|---------|-------|
| 01-basic | Simple allocation scenarios | 5 |
| 02-coalescing | Frame coalescing tests | 5 |
| 03-zp | Zero page allocation tests | 5 |
| 04-threads | Thread safety (callback) tests | 4 |
| 05-stress | Memory limit tests | 4 |

---

## 2. Basic Fixtures (01-basic/)

### 2.1 single-function.blend

**Purpose**: Simplest possible allocation - one function with locals.

```js
// 01-basic/single-function.blend
// Tests: Basic frame allocation for single function
// Expected: main frame at $0200 with 2 bytes

module SFA.Test.SingleFunction;

function main(): void {
    let x: byte = 10;
    let y: byte = 20;
    x = y;
}
```

**Expected Allocation**:
- `main` → Frame at $0200, size 2 bytes

---

### 2.2 two-functions.blend

**Purpose**: Two separate functions, both called from main.

```js
// 01-basic/two-functions.blend
// Tests: Multiple function frame allocation
// Expected: Three frames allocated sequentially

module SFA.Test.TwoFunctions;

function main(): void {
    update();
    draw();
}

function update(): void {
    let delta: byte = 1;
}

function draw(): void {
    let color: byte = 0;
}
```

**Expected Allocation**:
- `main` → Frame at $0200 (0 bytes - no locals)
- `update` + `draw` → Coalesced (never active together)

---

### 2.3 nested-calls.blend

**Purpose**: Deep call chain (main → a → b → c).

```js
// 01-basic/nested-calls.blend
// Tests: Nested function calls allocation
// Expected: Proper frame chain without overlap

module SFA.Test.NestedCalls;

function main(): void {
    let mainVar: byte = 0;
    outer();
}

function outer(): void {
    let outerVar: byte = 1;
    middle();
}

function middle(): void {
    let middleVar: byte = 2;
    inner();
}

function inner(): void {
    let innerVar: byte = 3;
}
```

**Expected Allocation**:
- `main` → Frame at $0200
- `outer` → Separate frame (active when main active)
- `middle` → Separate frame (active when outer active)
- `inner` → Separate frame (active when middle active)

---

### 2.4 with-parameters.blend

**Purpose**: Functions with parameters.

```js
// 01-basic/with-parameters.blend
// Tests: Parameter allocation in frames
// Expected: Parameters allocated as slots

module SFA.Test.WithParameters;

function main(): void {
    let result: byte = add(10, 20);
}

function add(a: byte, b: byte): byte {
    let sum: byte = a + b;
    return sum;
}
```

**Expected Allocation**:
- `add.a` → Parameter slot
- `add.b` → Parameter slot
- `add.sum` → Local slot

---

### 2.5 with-arrays.blend

**Purpose**: Functions with array locals.

```js
// 01-basic/with-arrays.blend
// Tests: Array allocation in frames
// Expected: Arrays in frame region, not ZP

module SFA.Test.WithArrays;

function main(): void {
    let buffer: byte[16];
    let index: byte = 0;
    
    buffer[index] = 42;
}
```

**Expected Allocation**:
- `main.buffer` → 16 bytes in frame region
- `main.index` → 1 byte (could be ZP if scoring high enough)

---

## 3. Coalescing Fixtures (02-coalescing/)

### 3.1 non-overlapping.blend

**Purpose**: Functions that can safely coalesce.

```js
// 02-coalescing/non-overlapping.blend
// Tests: Basic coalescing of non-overlapping functions
// Expected: funcA and funcB share memory

module SFA.Test.NonOverlapping;

function main(): void {
    funcA();
    funcB();
}

function funcA(): void {
    let a1: byte = 1;
    let a2: byte = 2;
    let a3: byte = 3;
}

function funcB(): void {
    let b1: byte = 4;
    let b2: byte = 5;
}
```

**Expected Allocation**:
- `funcA` + `funcB` → Coalesced, share same base address
- Group size = max(3, 2) = 3 bytes
- Savings = (3 + 2 - 3) / (3 + 2) = 40%

---

### 3.2 overlapping.blend

**Purpose**: Functions that CANNOT coalesce (nested calls).

```js
// 02-coalescing/overlapping.blend
// Tests: Functions that overlap cannot coalesce
// Expected: outer and inner have separate frames

module SFA.Test.Overlapping;

function main(): void {
    outer();
}

function outer(): void {
    let outerVar: word = 1000;
    inner();
}

function inner(): void {
    let innerVar: word = 2000;
}
```

**Expected Allocation**:
- `outer` and `inner` → NOT coalesced (inner called from outer)
- Each has separate frame

---

### 3.3 deep-calls.blend

**Purpose**: Complex call graph with multiple coalesce groups.

```js
// 02-coalescing/deep-calls.blend
// Tests: Multiple coalesce groups
// Expected: Siblings coalesce, parent-child don't

module SFA.Test.DeepCalls;

function main(): void {
    branch1();
    branch2();
}

function branch1(): void {
    let b1: byte = 1;
    leaf1a();
    leaf1b();
}

function branch2(): void {
    let b2: byte = 2;
    leaf2a();
    leaf2b();
}

function leaf1a(): void { let x: byte = 0; }
function leaf1b(): void { let x: byte = 0; }
function leaf2a(): void { let x: byte = 0; }
function leaf2b(): void { let x: byte = 0; }
```

**Expected Allocation**:
- `branch1` + `branch2` → Coalesced (never active together)
- `leaf1a` + `leaf1b` → Coalesced
- `leaf2a` + `leaf2b` → Coalesced
- `leaf1a` + `leaf2a` → Coalesced (different branches)

---

### 3.4 max-coalescing.blend

**Purpose**: Maximum coalescing scenario.

```js
// 02-coalescing/max-coalescing.blend
// Tests: Many functions that all coalesce
// Expected: Significant memory savings

module SFA.Test.MaxCoalescing;

function main(): void {
    step1();
    step2();
    step3();
    step4();
    step5();
}

function step1(): void { let data: byte[10]; }
function step2(): void { let data: byte[10]; }
function step3(): void { let data: byte[10]; }
function step4(): void { let data: byte[10]; }
function step5(): void { let data: byte[10]; }
```

**Expected Allocation**:
- All 5 functions coalesce → 10 bytes (not 50 bytes)
- Savings = 80%

---

### 3.5 no-coalescing.blend

**Purpose**: Worst case - no coalescing possible.

```js
// 02-coalescing/no-coalescing.blend
// Tests: Fully nested calls prevent coalescing
// Expected: Each function gets separate frame

module SFA.Test.NoCoalescing;

function main(): void { a(); }
function a(): void { let x: byte = 0; b(); }
function b(): void { let x: byte = 0; c(); }
function c(): void { let x: byte = 0; d(); }
function d(): void { let x: byte = 0; e(); }
function e(): void { let x: byte = 0; }
```

**Expected Allocation**:
- No coalescing (fully nested)
- 5 separate frames, 5 bytes total

---

## 4. Zero Page Fixtures (03-zp/)

### 4.1 zp-required.blend

**Purpose**: Test @zp directive enforcement.

```js
// 03-zp/zp-required.blend
// Tests: @zp variables MUST be in ZP
// Expected: counter in ZP, buffer in RAM

module SFA.Test.ZPRequired;

@zp let counter: byte = 0;
@ram let buffer: byte[100];
let normal: byte = 0;

function main(): void {
    counter += 1;
    buffer[0] = counter;
    normal = counter;
}
```

**Expected Allocation**:
- `counter` → Zero Page (required)
- `buffer` → RAM (required)
- `normal` → RAM (default for module globals)

---

### 4.2 zp-scoring.blend

**Purpose**: Test automatic ZP promotion by scoring.

```js
// 03-zp/zp-scoring.blend
// Tests: Hot variables get ZP automatically
// Expected: loopCounter in ZP (high score), result in RAM

module SFA.Test.ZPScoring;

let result: word = 0;

function main(): void {
    let loopCounter: byte = 0;
    let temp: word = 0;
    
    while loopCounter < 100 {
        temp = temp + loopCounter;
        loopCounter += 1;
    }
    result = temp;
}
```

**Expected Allocation**:
- `loopCounter` → Zero Page (high score: loop variable, byte)
- `temp` → Frame region (word, lower priority)
- `result` → RAM (module global)

---

### 4.3 zp-overflow.blend

**Purpose**: Test ZP overflow error.

```js
// 03-zp/zp-overflow.blend
// Tests: Too many @zp variables causes error
// Expected: Compile error for ZP overflow

module SFA.Test.ZPOverflow;

// Request more ZP than available (142 bytes on C64)
@zp let v1: byte[50];
@zp let v2: byte[50];
@zp let v3: byte[50];  // This should overflow!

function main(): void {
    v1[0] = 1;
}
```

**Expected**: Compile error - ZP overflow

---

### 4.4 zp-pointer.blend

**Purpose**: Pointers get high ZP priority.

```js
// 03-zp/zp-pointer.blend
// Tests: Pointers score highest for ZP
// Expected: ptr in ZP (required for indirect addressing)

module SFA.Test.ZPPointer;

function main(): void {
    let ptr: *byte;
    let data: byte = 42;
    let counter: byte = 0;
    
    ptr = @data;
    counter = *ptr;
}
```

**Expected Allocation**:
- `ptr` → Zero Page (pointers get highest score)
- `data`, `counter` → Frame region

---

### 4.5 zp-function-locals.blend

**Purpose**: @zp on function locals.

```js
// 03-zp/zp-function-locals.blend
// Tests: @zp directive on function-local variables
// Expected: fastCounter in ZP, normalVar in frame

module SFA.Test.ZPFunctionLocals;

function main(): void {
    @zp let fastCounter: byte = 0;
    let normalVar: byte = 0;
    
    while fastCounter < 10 {
        normalVar += fastCounter;
        fastCounter += 1;
    }
}
```

**Expected Allocation**:
- `fastCounter` → Zero Page (explicit @zp)
- `normalVar` → Frame region

---

## 5. Thread Fixtures (04-threads/)

### 5.1 callback-isolation.blend

**Purpose**: Callback functions are isolated from main thread.

```js
// 04-threads/callback-isolation.blend
// Tests: Callback frames never coalesce with main
// Expected: mainFunc and irqHandler have separate frames

module SFA.Test.CallbackIsolation;

let shared: byte = 0;

function main(): void {
    mainFunc();
}

function mainFunc(): void {
    let mainLocal: byte = 1;
    shared = mainLocal;
}

callback irqHandler(): void {
    let irqLocal: byte = 2;
    shared = irqLocal;
}
```

**Expected Allocation**:
- `mainFunc` → Main thread frame
- `irqHandler` → ISR thread frame (NOT coalesced with main)

---

### 5.2 shared-function.blend

**Purpose**: Function called from both threads.

```js
// 04-threads/shared-function.blend
// Tests: Shared function cannot coalesce with either thread
// Expected: utilityFunc has dedicated frame

module SFA.Test.SharedFunction;

function main(): void {
    utilityFunc();
}

callback irq(): void {
    utilityFunc();
}

function utilityFunc(): void {
    let temp: byte = 0;
}
```

**Expected Allocation**:
- `utilityFunc` → Dedicated frame (called from both threads)
- Warning: "Function called from multiple thread contexts"

---

### 5.3 multi-callback.blend

**Purpose**: Multiple callbacks.

```js
// 04-threads/multi-callback.blend
// Tests: Multiple callbacks each isolated
// Expected: Each callback has separate frame from main

module SFA.Test.MultiCallback;

function main(): void {
    let mainVar: byte = 0;
}

callback irq(): void {
    let irqVar: byte = 1;
}

callback nmi(): void {
    let nmiVar: byte = 2;
}
```

**Expected Allocation**:
- `main` → Main thread frame
- `irq` → ISR thread frame (isolated)
- `nmi` → ISR thread frame (could coalesce with irq if non-overlapping)

---

### 5.4 callback-calls-function.blend

**Purpose**: Functions called only from callback.

```js
// 04-threads/callback-calls-function.blend
// Tests: Functions in ISR thread coalesce among themselves
// Expected: isrHelper coalesces with irq, not with main

module SFA.Test.CallbackCallsFunction;

function main(): void {
    let mainVar: byte = 0;
    mainHelper();
}

function mainHelper(): void {
    let helper: byte = 1;
}

callback irq(): void {
    let irqVar: byte = 2;
    isrHelper();
}

function isrHelper(): void {
    let isrHelperVar: byte = 3;
}
```

**Expected Allocation**:
- `mainHelper` → Main thread, can coalesce with siblings
- `isrHelper` → ISR thread, can coalesce with irq
- `mainHelper` + `isrHelper` → NOT coalesced (different threads)

---

## 6. Stress Fixtures (05-stress/)

### 6.1 many-functions.blend

**Purpose**: Large number of functions.

```js
// 05-stress/many-functions.blend
// Tests: Allocation with 50+ functions
// Expected: Completes without error, coalescing works

module SFA.Test.ManyFunctions;

function main(): void {
    phase1();
    phase2();
    phase3();
}

function phase1(): void {
    f01(); f02(); f03(); f04(); f05();
    f06(); f07(); f08(); f09(); f10();
}

function phase2(): void {
    f11(); f12(); f13(); f14(); f15();
    f16(); f17(); f18(); f19(); f20();
}

function phase3(): void {
    f21(); f22(); f23(); f24(); f25();
    f26(); f27(); f28(); f29(); f30();
}

function f01(): void { let x: byte = 1; }
function f02(): void { let x: byte = 2; }
// ... f03 through f30 similar
function f30(): void { let x: byte = 30; }
```

**Expected**: All functions allocate successfully with aggressive coalescing.

---

### 6.2 large-frames.blend

**Purpose**: Functions with large local arrays.

```js
// 05-stress/large-frames.blend
// Tests: Large frame allocation
// Expected: Frames fit within region

module SFA.Test.LargeFrames;

function main(): void {
    processBuffer();
}

function processBuffer(): void {
    let buffer: byte[256];
    let index: byte = 0;
    
    while index < 255 {
        buffer[index] = index;
        index += 1;
    }
}
```

**Expected**: Frame of 257 bytes allocated in frame region.

---

### 6.3 frame-overflow.blend

**Purpose**: Exceed frame region limit.

```js
// 05-stress/frame-overflow.blend
// Tests: Frame region overflow detection
// Expected: Compile error

module SFA.Test.FrameOverflow;

function main(): void { bigFunc1(); bigFunc2(); }
function bigFunc1(): void { let a: byte[300]; }
function bigFunc2(): void { let b: byte[300]; }
```

**Expected**: Compile error - Frame region overflow (600 > 512 bytes, cannot coalesce).

---

### 6.4 deep-nesting.blend

**Purpose**: Very deep call nesting.

```js
// 05-stress/deep-nesting.blend
// Tests: Deep nesting allocation
// Expected: 20 separate frames

module SFA.Test.DeepNesting;

function main(): void { d01(); }
function d01(): void { let x: byte = 1; d02(); }
function d02(): void { let x: byte = 2; d03(); }
// ... d03 through d19
function d19(): void { let x: byte = 19; d20(); }
function d20(): void { let x: byte = 20; }
```

**Expected**: 20 separate frames (no coalescing possible).

---

## 7. Fixture Validation

Each fixture should be validated with:

| Check | Description |
|-------|-------------|
| **Parses** | Lexer and parser succeed |
| **Type checks** | Semantic analysis passes |
| **Allocates** | Frame allocator produces result |
| **Correct addresses** | Addresses match expected |
| **Correct coalescing** | Coalesce groups match expected |
| **Correct errors** | Error cases produce expected errors |

---

**Next Document**: [08-e2e-scenarios.md](08-e2e-scenarios.md)