# Task 8.13: 6502 Hardware Hints - Detailed Implementation Plan

> **Parent Plan**: [Phase 8 Part 3 - Tier 3](phase8-part3-tier3.md)
>
> **Total Effort**: 10 hours, 38+ tests
> **File**: `packages/compiler/src/semantic/analysis/m6502-hints.ts`
> **Test File**: `packages/compiler/src/__tests__/semantic/analysis/m6502-hints.test.ts`

---

## Current Implementation Status

**Existing Code Review** (`m6502-hints.ts`):

| Component | Status | Notes |
|-----------|--------|-------|
| `M6502Register` enum | ✅ Done | A, X, Y, Any |
| `MemoryAccessPattern` enum | ✅ Done | Single, Sequential, Random, HotPath |
| `SAFE_ZERO_PAGE` constant | ✅ Done | $02-$8F (142 bytes) |
| `VariableHints` interface | ✅ Done | Basic structure |
| `collectVariableUsage()` | ⚠️ Basic | Reads from metadata, needs loop counter detection |
| `calculateZeroPagePriorities()` | ⚠️ Basic | Simple scoring, needs enhancement |
| `determineRegisterPreferences()` | ⚠️ Basic | Loop counter only, needs array indexing |
| `detectAccessPatterns()` | ⚠️ Basic | Simple patterns, needs sequential detection |
| `checkReservedZeroPage()` | ❌ TODO | Placeholder, not implemented |
| `estimateCycles()` | ❌ TODO | Returns hardcoded 4 |
| `isZeroPageSafe()` | ✅ Done | Static method |
| **Tests** | ❌ Missing | No test file exists |

---

## Subtask Breakdown

### Task 8.13.1: Reserved Zero-Page Blacklist (2.5 hours)

**Goal**: Implement detection and validation of reserved zero-page locations

**Why Critical**: Using reserved zero-page ($00-$01, $90-$FF) crashes the C64!

**Implementation Details**:

```typescript
/**
 * Reserved zero-page locations (CANNOT USE!)
 */
const RESERVED_ZERO_PAGE = {
  // $00-$01: Memory configuration (CRITICAL - DO NOT USE!)
  memoryConfig: { start: 0x00, end: 0x01, reason: 'Memory configuration registers' },
  
  // $90-$FF: KERNAL workspace (Risk of corruption!)
  kernalWorkspace: { start: 0x90, end: 0xFF, reason: 'KERNAL workspace' },
};
```

**Methods to Implement/Update**:

1. **`isZeroPageReserved(address: number): boolean`** (NEW)
   - Check if address is in reserved ranges
   - Return true for $00-$01 and $90-$FF

2. **`getReservationReason(address: number): string | undefined`** (NEW)
   - Return human-readable reason why address is reserved
   - Return undefined if address is safe

3. **`checkReservedZeroPage(ast: Program): void`** (UPDATE - currently TODO)
   - Walk AST for @zp and @map declarations
   - Check each declared address against reserved ranges
   - Generate error diagnostics for violations

4. **`validateZeroPageAllocation(address: number, size: number): Diagnostic | null`** (NEW)
   - Validate address + size doesn't overlap reserved ranges
   - Return diagnostic if invalid

**Test Cases** (10+):

| Test | Description |
|------|-------------|
| 1 | `isZeroPageReserved($00)` returns true (memory config) |
| 2 | `isZeroPageReserved($01)` returns true (memory config) |
| 3 | `isZeroPageReserved($90)` returns true (KERNAL start) |
| 4 | `isZeroPageReserved($FF)` returns true (KERNAL end) |
| 5 | `isZeroPageReserved($02)` returns false (safe start) |
| 6 | `isZeroPageReserved($8F)` returns false (safe end) |
| 7 | `isZeroPageReserved($50)` returns false (middle safe) |
| 8 | @zp at $00 generates error diagnostic |
| 9 | @zp at $90 generates error diagnostic |
| 10 | @zp at $02 passes validation |
| 11 | @zp at $8E with size 2 (ends at $8F) passes |
| 12 | @zp at $8F with size 2 (ends at $90) generates error |

**Metadata Keys Used**:
- `M6502ZeroPagePriority` (existing)

**Deliverables**:
- [ ] Implement `isZeroPageReserved()` static method
- [ ] Implement `getReservationReason()` static method
- [ ] Implement `validateZeroPageAllocation()` method
- [ ] Update `checkReservedZeroPage()` to actually validate
- [ ] Add 10+ tests for reserved ZP validation

---

### Task 8.13.2: Zero-Page Priority Scoring (3 hours)

**Goal**: Implement multi-factor scoring system for ZP allocation priority

**Why Critical**: Zero-page access is 1 cycle faster than absolute addressing. Prioritize hot variables!

**Current Scoring** (needs enhancement):
```typescript
// Current: 0-100 scale with 4 factors
Factor 1: Total accesses (0-40 points)
Factor 2: Loop depth (0-30 points)  
Factor 3: Hot path accesses (0-20 points)
Factor 4: Variable size (0-10 points)
```

**Enhanced Scoring Algorithm**:

```typescript
/**
 * Zero-page priority factors (0-100 scale)
 * 
 * Higher score = higher priority for ZP allocation
 */
interface ZPPriorityFactors {
  // Access frequency (0-30 points)
  // More accesses = more cycles saved by ZP
  accessFrequency: number;
  
  // Loop depth bonus (0-25 points)
  // Variables in deep loops benefit most from ZP
  loopDepthBonus: number;
  
  // Hot path multiplier (0-20 points)
  // Critical path variables get priority
  hotPathBonus: number;
  
  // Variable size (0-10 points)
  // Bytes benefit more than words (2 ZP bytes vs 2 RAM bytes)
  sizeBonus: number;
  
  // Arithmetic intensity (0-10 points) [NEW]
  // Variables used in arithmetic operations benefit from A register
  arithmeticBonus: number;
  
  // Index variable (0-5 points) [NEW]
  // Array index variables benefit from X/Y registers + ZP
  indexBonus: number;
}
```

**Methods to Implement/Update**:

1. **`calculateZeroPagePriorities(): void`** (UPDATE)
   - Add arithmetic intensity factor
   - Add index variable detection
   - Improve scoring granularity

2. **`calculateArithmeticIntensity(symbol: Symbol): number`** (NEW)
   - Count arithmetic operations using this variable
   - Return 0-10 score

3. **`isIndexVariable(symbol: Symbol): boolean`** (NEW)
   - Check if variable is used as array index
   - Check usage patterns in loop analysis metadata

4. **`getZPPriorityBreakdown(varName: string): ZPPriorityFactors`** (NEW)
   - Return detailed breakdown of priority factors
   - Useful for debugging and diagnostics

**Test Cases** (12+):

| Test | Description | Expected Priority |
|------|-------------|-------------------|
| 1 | Single-use variable | Low (10-20) |
| 2 | High-frequency variable (10+ accesses) | High (60-80) |
| 3 | Loop counter (depth 1) | High (70-80) |
| 4 | Nested loop counter (depth 3) | Very high (85-95) |
| 5 | Hot path variable | High (70+) |
| 6 | Byte variable vs word variable | Byte > Word |
| 7 | Array index variable | High (60+) |
| 8 | Arithmetic-heavy variable | High (55+) |
| 9 | Combined factors (loop + hot + byte) | Very high (90+) |
| 10 | Read-only variable | Lower than read-write |
| 11 | Multiple variables ranked correctly | Verify ordering |
| 12 | Priority breakdown returns all factors | All factors present |

**Metadata Keys Used**:
- `M6502ZeroPagePriority` (existing)
- `UsageReadCount` (from Task 8.2)
- `UsageWriteCount` (from Task 8.2)
- `UsageHotPathAccesses` (from Task 8.2)
- `UsageMaxLoopDepth` (from Task 8.2)

**Deliverables**:
- [ ] Update `calculateZeroPagePriorities()` with enhanced scoring
- [ ] Implement `calculateArithmeticIntensity()` 
- [ ] Implement `isIndexVariable()`
- [ ] Implement `getZPPriorityBreakdown()` for debugging
- [ ] Add 12+ tests for ZP priority scoring

---

### Task 8.13.3: Register Preference Analysis (2.5 hours)

**Goal**: Analyze variable usage to determine optimal register (A, X, Y)

**Why Critical**: Correct register selection saves cycles and enables better addressing modes.

**6502 Register Characteristics**:

| Register | Best For | Addressing Modes |
|----------|----------|------------------|
| A | Arithmetic, comparisons, I/O | Immediate, absolute |
| X | Loop counters, array indexing | Zero-page,X; Absolute,X; (zp,X) |
| Y | Array indexing, indirect | Zero-page,Y; Absolute,Y; (zp),Y |

**Methods to Implement/Update**:

1. **`determineRegisterPreferences(): void`** (UPDATE)
   - Enhance loop counter detection
   - Add array indexing detection
   - Add arithmetic operation detection
   - Handle indirect addressing needs

2. **`detectArrayIndexUsage(symbol: Symbol): boolean`** (NEW)
   - Check if variable is used as array subscript
   - Return true if used in `array[variable]` pattern

3. **`detectIndirectAddressing(symbol: Symbol): boolean`** (NEW)
   - Check if variable is used in indirect addressing
   - Return true if used in `@variable` or pointer patterns

4. **`getRegisterPreferenceReason(symbol: Symbol): string`** (NEW)
   - Return human-readable reason for preference
   - e.g., "Loop counter → X/Y", "Arithmetic → A"

**Decision Tree**:

```
Is variable used for indirect addressing?
├─ Yes → Y (indirect indexed mode)
│
├─ No → Is variable an array index?
│        ├─ Yes → X (default index register)
│        │
│        ├─ No → Is variable a loop counter?
│                 ├─ Yes → X or Y (prefer X)
│                 │
│                 ├─ No → Is variable arithmetic-heavy?
│                          ├─ Yes → A
│                          │
│                          └─ No → Any
```

**Test Cases** (10+):

| Test | Description | Expected Register |
|------|-------------|-------------------|
| 1 | Loop counter `for i = 0 to 10` | X |
| 2 | Array index `array[i]` | X |
| 3 | Arithmetic variable `x + y * z` | A |
| 4 | I/O variable (VIC/SID writes) | A |
| 5 | Indirect pointer | Y |
| 6 | Nested loop outer counter | X |
| 7 | Nested loop inner counter | Y |
| 8 | Single-use temporary | Any |
| 9 | Multiple usage patterns | Most common wins |
| 10 | Reason string contains pattern type | Verify message |

**Metadata Keys Used**:
- `M6502RegisterPreference` (existing)

**Deliverables**:
- [ ] Update `determineRegisterPreferences()` with enhanced detection
- [ ] Implement `detectArrayIndexUsage()`
- [ ] Implement `detectIndirectAddressing()`
- [ ] Implement `getRegisterPreferenceReason()`
- [ ] Add 10+ tests for register preference

---

### Task 8.13.4: Memory Access Pattern Detection (2 hours)

**Goal**: Classify memory access patterns for optimization

**Why Critical**: Sequential access can use post-increment; random access may need different strategies.

**Access Patterns**:

```typescript
export enum MemoryAccessPattern {
  /** Single access - no pattern */
  Single = 'Single',
  
  /** Sequential access (array iteration, stride +1) */
  Sequential = 'Sequential',
  
  /** Strided access (array iteration, stride > 1) */
  Strided = 'Strided',
  
  /** Random access (unpredictable) */
  Random = 'Random',
  
  /** Hot path (in critical loops) */
  HotPath = 'HotPath',
}
```

**Methods to Implement/Update**:

1. **`detectAccessPatterns(): void`** (UPDATE)
   - Use loop analysis to detect sequential/strided patterns
   - Use induction variable info to detect strides
   - Improve random vs sequential classification

2. **`analyzeAccessStride(symbol: Symbol): number | null`** (NEW)
   - Analyze access pattern to determine stride
   - Return null if not strided access
   - Return stride (1 = sequential, >1 = strided)

3. **`detectSequentialAccess(symbol: Symbol): boolean`** (NEW)
   - Check if variable accesses form sequential pattern
   - Use loop induction variable analysis

4. **`getAccessPatternDetails(symbol: Symbol): AccessPatternInfo`** (NEW)
   - Return detailed pattern information
   - Include stride, loop depth, access count

**Test Cases** (6+):

| Test | Description | Expected Pattern |
|------|-------------|------------------|
| 1 | Single read variable | Single |
| 2 | Loop iteration `for i = 0; i < 10; i++` | Sequential |
| 3 | Strided access `array[i * 2]` | Strided |
| 4 | Random access (conditional index) | Random |
| 5 | Hot path in inner loop | HotPath |
| 6 | Access stride detection | Correct stride value |

**Metadata Keys Used**:
- `LoopInductionVariable` (from Task 8.11)
- `UsageHotPathAccesses` (from Task 8.2)

**Deliverables**:
- [ ] Update `detectAccessPatterns()` with stride detection
- [ ] Implement `analyzeAccessStride()`
- [ ] Implement `detectSequentialAccess()`
- [ ] Implement `getAccessPatternDetails()`
- [ ] Add 6+ tests for access pattern detection

---

## Implementation Order

**Recommended sequence** (dependencies flow):

```
Task 8.13.1 (Reserved ZP) ──┐
                            ├──► Task 8.13.2 (ZP Priority) ──► Task 8.13.3 (Register Pref)
Task 8.13.4 (Access Patterns) ─┘
```

**Detailed Order**:

1. **Task 8.13.1** - Foundation: Reserved ZP validation
   - No dependencies on other 8.13 subtasks
   - Provides safety checks for all ZP allocations

2. **Task 8.13.4** - Access pattern detection
   - Uses loop analysis from Task 8.11 (already done)
   - Feeds into ZP priority scoring

3. **Task 8.13.2** - ZP priority scoring
   - Uses access patterns from 8.13.4
   - Uses reserved ZP checks from 8.13.1

4. **Task 8.13.3** - Register preference
   - Uses access patterns from 8.13.4
   - Uses ZP priority from 8.13.2

---

## Test File Structure

```typescript
// packages/compiler/src/__tests__/semantic/analysis/m6502-hints.test.ts

describe('M6502HintAnalyzer', () => {
  // Task 8.13.1: Reserved Zero-Page Blacklist
  describe('Reserved Zero-Page Validation', () => {
    describe('isZeroPageReserved()', () => { /* 7 tests */ });
    describe('checkReservedZeroPage()', () => { /* 5 tests */ });
  });

  // Task 8.13.2: Zero-Page Priority Scoring
  describe('Zero-Page Priority Scoring', () => {
    describe('calculateZeroPagePriorities()', () => { /* 8 tests */ });
    describe('getZPPriorityBreakdown()', () => { /* 4 tests */ });
  });

  // Task 8.13.3: Register Preference Analysis
  describe('Register Preference Analysis', () => {
    describe('determineRegisterPreferences()', () => { /* 6 tests */ });
    describe('detectArrayIndexUsage()', () => { /* 4 tests */ });
  });

  // Task 8.13.4: Memory Access Pattern Detection
  describe('Memory Access Pattern Detection', () => {
    describe('detectAccessPatterns()', () => { /* 4 tests */ });
    describe('analyzeAccessStride()', () => { /* 2 tests */ });
  });
});
```

---

## Task Implementation Checklist

| Task | Description | Hours | Tests | Dependencies | Status |
|------|-------------|-------|-------|--------------|--------|
| 8.13.1 | Reserved ZP blacklist | 2.5 | 10+ | None | [ ] |
| 8.13.4 | Memory access patterns | 2.0 | 6+ | Task 8.11 (done) | [ ] |
| 8.13.2 | ZP priority scoring | 3.0 | 12+ | 8.13.1, 8.13.4 | [ ] |
| 8.13.3 | Register preference | 2.5 | 10+ | 8.13.4 | [ ] |
| **Total** | **4 subtasks** | **10 hrs** | **38+ tests** | | **[ ]** |

---

## Success Criteria

Each subtask is complete when:

1. ✅ All methods implemented per specification
2. ✅ All tests passing
3. ✅ JSDoc comments on all public/protected methods
4. ✅ No TypeScript errors
5. ✅ Metadata keys properly set on AST nodes
6. ✅ Diagnostics generated for violations (8.13.1)

**Final Integration Test**:
```typescript
it('should analyze complete C64 program with all hints', () => {
  const source = `
    @zp counter at $02: byte;
    @zp screenPtr at $04: word;
    
    function main() {
      for (let i: byte = 0; i < 40; i = i + 1) {
        screen[i] = counter;
      }
    }
  `;
  
  const analyzer = new M6502HintAnalyzer(symbolTable, cfgs);
  analyzer.analyze(ast);
  
  // counter: high ZP priority, X/Y preference (loop counter)
  // screenPtr: high ZP priority, Y preference (indirect)
  // i: high ZP priority, X preference (loop counter, array index)
  
  expect(diagnostics).toHaveLength(0); // No reserved ZP violations
});
```

---

## Cross-References

- **Language Specification**: `docs/language-specification/13-6502-features.md`
- **Phase 8 Plan**: `plans/phase8-part3-tier3.md` (Task 8.13)
- **Code Standards**: `.clinerules/code.md` (Rules 4-8 testing)
- **Task 8.2**: Variable usage analysis (provides input metadata)
- **Task 8.11**: Loop analysis (provides induction variable info)