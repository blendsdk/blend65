# Semantic Analyzer IL-Readiness Enhancement Plan

> **Status**: Implementation Plan
> **Date**: January 19, 2026
> **Priority**: CRITICAL - Required before IL Generator
> **Estimated Time**: 3-4 days

---

## Executive Summary

This plan addresses the gaps identified in the semantic analyzer to make it 1000% ready for god-level IL generation. After thorough analysis, we identified 5 potential gaps, of which 2 are already addressed, 2 are critical, and 1 is nice-to-have.

### Gap Assessment Summary

| Gap | Description | Status | Priority |
|-----|-------------|--------|----------|
| **Gap 1** | Type Coercion Tracking | ❌ NOT DONE | **CRITICAL** |
| **Gap 2** | Constant Expression Evaluation | ✅ DONE | N/A |
| **Gap 3** | Addressing Mode Hints | ⚠️ PARTIAL | **IMPORTANT** |
| **Gap 4** | Expression Complexity Scoring | ❌ NOT DONE | **IMPORTANT** |
| **Gap 5** | Branch Distance Estimation | ❌ NOT DONE | Nice-to-have |

---

## Gap Analysis Details

### ✅ **Gap 2: Constant Expression Evaluation (ALREADY DONE)**

**Location**: `packages/compiler/src/semantic/analysis/constant-propagation.ts`

**What's Already Implemented**:
- Sparse Conditional Constant Propagation (SCCP)
- Lattice-based optimistic data flow analysis
- Full binary operator evaluation (+, -, *, /, %, &, |, ^, <<, >>, comparisons)
- Full unary operator evaluation (-, ~, !)
- Constant folding identification with `ConstantFoldable` metadata
- Effectively const variable detection
- Branch condition analysis for dead code

**Metadata Keys Set**:
- `ConstantValue` - Known constant value
- `ConstantFoldable` - Can be folded
- `ConstantFoldResult` - Result of folding
- `ConstantEffectivelyConst` - Never changes
- `ConstantBranchCondition` - Branch always true/false

**No Action Required** ✅

---

### ❌ **Gap 1: Type Coercion Tracking (CRITICAL)**

**Problem**: The type checker validates types but does NOT mark where type conversions are needed.

**Example**:
```js
let b: byte = 10;
let w: word = b;      // byte → word (zero extension needed)
let result: byte = w; // word → byte (truncation needed, should error or require explicit)
```

**Current Behavior**:
- Type checker validates compatibility
- Sets `typeInfo` on nodes
- Does NOT mark conversion points

**Required for IL**:
- IL generator needs to know WHERE to insert `ZERO_EXTEND` or `TRUNCATE` operations
- Without this, IL generator must re-analyze types (wasteful, error-prone)

**Solution**: Create `TypeCoercionAnalyzer` pass

---

### ⚠️ **Gap 3: Addressing Mode Hints (PARTIAL)**

**Current State**:
- `AddressingMode` enum EXISTS in `optimization-metadata-keys.ts`
- `M6502AddressingMode` key EXISTS
- BUT: `m6502-hints.ts` does NOT set addressing mode hints

**What's Missing**:
- Logic to determine optimal addressing mode for each memory access
- Setting the `M6502AddressingMode` metadata on AST nodes

**Solution**: Extend `M6502HintAnalyzer` to set addressing modes

---

### ❌ **Gap 4: Expression Complexity Scoring (IMPORTANT)**

**Problem**: No way to know how "expensive" an expression is.

**Why It Matters**:
- Helps decide when to spill to memory vs keep in register
- Guides register allocation (complex = likely spill)
- Helps IL generator create optimal temporaries

**Example**:
```js
// Simple: 1 register, no spill needed
let a = x + y;

// Complex: May need temp storage, potential spill
let b = ((a + b) * (c + d)) / ((e + f) - (g + h));
```

**Solution**: Create `ExpressionComplexityAnalyzer` pass

---

### ❌ **Gap 5: Branch Distance Estimation (Nice-to-have)**

**Problem**: 6502 branches are limited to ±127 bytes.

**Current State**: Not addressed

**Impact**: Low - can be handled in code generator

**Recommendation**: Defer to code generation phase

---

## Implementation Plan

### **Phase 1: Type Coercion Tracking (CRITICAL)**

#### **Task 1.1: Define Coercion Types**

**File**: `packages/compiler/src/semantic/analysis/optimization-metadata-keys.ts`

**Add to OptimizationMetadataKey enum**:
```typescript
// ==========================================
// Type Coercion Analysis (New)
// ==========================================

/** Type coercion required at this node (TypeCoercionKind enum) */
TypeCoercionRequired = 'TypeCoercionRequired',

/** Source type before coercion (TypeInfo) */
TypeCoercionSourceType = 'TypeCoercionSourceType',

/** Target type after coercion (TypeInfo) */
TypeCoercionTargetType = 'TypeCoercionTargetType',

/** Is this an implicit coercion? (boolean) */
TypeCoercionImplicit = 'TypeCoercionImplicit',

/** Estimated cost of coercion in cycles (number) */
TypeCoercionCost = 'TypeCoercionCost',
```

**Add new enum**:
```typescript
/**
 * Type coercion kinds for IL generation
 */
export enum TypeCoercionKind {
  /** No coercion needed */
  None = 'None',
  
  /** byte → word (zero extension) */
  ZeroExtend = 'ZeroExtend',
  
  /** word → byte (truncation) */
  Truncate = 'Truncate',
  
  /** boolean → byte */
  BoolToByte = 'BoolToByte',
  
  /** byte → boolean (non-zero test) */
  ByteToBool = 'ByteToBool',
}
```

**Estimated Time**: 30 minutes

---

#### **Task 1.2: Create TypeCoercionAnalyzer Class**

**File**: `packages/compiler/src/semantic/analysis/type-coercion.ts` (NEW)

**Responsibilities**:
1. Traverse AST after type checking
2. For each expression, compare operand types with expected types
3. Mark nodes where coercion is needed
4. Store metadata on AST nodes

**Key Points to Check**:
- Assignment: value type vs target type
- Function arguments: argument type vs parameter type
- Binary operators: operand types when different
- Return statements: expression type vs function return type
- Array index expressions: index must be numeric

**Estimated Time**: 3 hours

---

#### **Task 1.3: Integrate with SemanticAnalyzer**

**File**: `packages/compiler/src/semantic/analyzer.ts`

**Changes**:
- Add TypeCoercionAnalyzer to the analysis pipeline
- Run AFTER TypeChecker
- Run BEFORE AdvancedAnalyzer (Phase 8)

**Estimated Time**: 30 minutes

---

#### **Task 1.4: Tests for Type Coercion**

**File**: `packages/compiler/src/__tests__/semantic/type-coercion.test.ts` (NEW)

**Test Cases**:
1. Byte to word assignment (zero extension)
2. Word to byte assignment (should error or require explicit)
3. Mixed-type binary operations
4. Function argument coercions
5. Return type coercions
6. Array index coercions
7. No coercion needed (same types)
8. Boolean to byte coercion
9. Compound assignment coercions

**Target**: 40+ tests

**Estimated Time**: 2 hours

---

### **Phase 2: Addressing Mode Hints**

#### **Task 2.1: Enhance M6502HintAnalyzer**

**File**: `packages/compiler/src/semantic/analysis/m6502-hints.ts`

**Add new method**: `determineAddressingModes()`

**Logic**:
```typescript
protected determineAddressingModes(): void {
  for (const [varName, hints] of this.variableHints) {
    let mode: AddressingMode;
    
    // 1. Check if it's a constant/literal
    if (isConstantAddress(hints)) {
      if (address <= 0xFF) {
        mode = AddressingMode.ZeroPage;
      } else {
        mode = AddressingMode.Absolute;
      }
    }
    
    // 2. Check if used with index variable
    if (isIndexedAccess(hints)) {
      if (isZeroPage) {
        mode = hints.registerPreference === M6502Register.X 
          ? AddressingMode.ZeroPageX 
          : AddressingMode.ZeroPageY;
      } else {
        mode = hints.registerPreference === M6502Register.X 
          ? AddressingMode.AbsoluteX 
          : AddressingMode.AbsoluteY;
      }
    }
    
    // 3. Check for indirect access pattern
    if (isIndirectAccess(hints)) {
      mode = hints.registerPreference === M6502Register.Y
        ? AddressingMode.IndirectIndexed  // (zp),Y
        : AddressingMode.IndexedIndirect; // (zp,X)
    }
    
    // Store in metadata
    setMetadata(hints.symbol, M6502AddressingMode, mode);
  }
}
```

**Estimated Time**: 2 hours

---

#### **Task 2.2: Add Addressing Mode Detection Logic**

**Enhancements to detection**:
1. Detect pointer dereference patterns
2. Detect array access patterns (already partial)
3. Detect @map access patterns
4. Handle @zp variables specifically

**Estimated Time**: 1.5 hours

---

#### **Task 2.3: Tests for Addressing Modes**

**File**: `packages/compiler/src/__tests__/semantic/addressing-modes.test.ts` (NEW)

**Test Cases**:
1. Zero-page variable → ZeroPage mode
2. Absolute variable → Absolute mode
3. Array with X index → ZeroPageX or AbsoluteX
4. Array with Y index → ZeroPageY or AbsoluteY
5. Pointer dereference → IndirectIndexed
6. @map hardware registers → Absolute
7. Constant immediate values → Immediate

**Target**: 25+ tests

**Estimated Time**: 1.5 hours

---

### **Phase 3: Expression Complexity Scoring**

#### **Task 3.1: Define Complexity Metrics**

**File**: `packages/compiler/src/semantic/analysis/optimization-metadata-keys.ts`

**Add to OptimizationMetadataKey enum**:
```typescript
// ==========================================
// Expression Complexity (New)
// ==========================================

/** Expression complexity score (number 1-100) */
ExprComplexityScore = 'ExprComplexityScore',

/** Register pressure - max registers needed (number 1-3) */
ExprRegisterPressure = 'ExprRegisterPressure',

/** Expression depth in AST (number) */
ExprTreeDepth = 'ExprTreeDepth',

/** Number of operations in expression (number) */
ExprOperationCount = 'ExprOperationCount',

/** Contains function call (boolean) */
ExprContainsCall = 'ExprContainsCall',

/** Contains memory access (boolean) */
ExprContainsMemoryAccess = 'ExprContainsMemoryAccess',
```

**Estimated Time**: 20 minutes

---

#### **Task 3.2: Create ExpressionComplexityAnalyzer**

**File**: `packages/compiler/src/semantic/analysis/expression-complexity.ts` (NEW)

**Scoring Algorithm**:
```typescript
protected calculateComplexity(expr: Expression): number {
  let score = 0;
  
  // Base score by expression type
  if (isLiteralExpression(expr)) {
    score = 1; // Simplest
  } else if (isIdentifierExpression(expr)) {
    score = 2; // Variable load
  } else if (isBinaryExpression(expr)) {
    score = 5 + calculateComplexity(left) + calculateComplexity(right);
  } else if (isUnaryExpression(expr)) {
    score = 3 + calculateComplexity(operand);
  } else if (isCallExpression(expr)) {
    score = 20 + sumArgComplexity(args); // Calls are expensive
  } else if (isIndexExpression(expr)) {
    score = 8 + calculateComplexity(index); // Array access
  }
  
  return Math.min(100, score);
}
```

**Register Pressure Calculation**:
```typescript
protected calculateRegisterPressure(expr: Expression): number {
  // 6502 has 3 registers: A, X, Y
  // Calculate max simultaneous registers needed
  
  if (isLiteralExpression(expr) || isIdentifierExpression(expr)) {
    return 1; // Just need A
  }
  
  if (isBinaryExpression(expr)) {
    const leftPressure = calculateRegisterPressure(left);
    const rightPressure = calculateRegisterPressure(right);
    
    // Need registers for both sides, plus result
    // But can reuse after computing one side
    return Math.max(leftPressure, rightPressure + 1);
  }
  
  // Cap at 3 (all 6502 registers)
  return Math.min(3, pressure);
}
```

**Estimated Time**: 2.5 hours

---

#### **Task 3.3: Integrate with SemanticAnalyzer**

**File**: `packages/compiler/src/semantic/analyzer.ts`

**Changes**:
- Add ExpressionComplexityAnalyzer to pipeline
- Run AFTER TypeCoercionAnalyzer
- Part of Phase 8 (advanced analysis)

**Estimated Time**: 30 minutes

---

#### **Task 3.4: Tests for Expression Complexity**

**File**: `packages/compiler/src/__tests__/semantic/expression-complexity.test.ts` (NEW)

**Test Cases**:
1. Literal → score 1
2. Identifier → score 2
3. Simple binary (a + b) → score ~7
4. Nested binary ((a + b) * c) → score ~12
5. Deep nesting → high score
6. Function call → high score (~20+)
7. Array access → medium score (~8+)
8. Register pressure for simple expr → 1
9. Register pressure for nested → 2-3
10. Expressions with calls need spills

**Target**: 30+ tests

**Estimated Time**: 1.5 hours

---

## Implementation Order

### **Day 1: Type Coercion (Critical Path)**

| Task | Description | Time |
|------|-------------|------|
| 1.1 | Define coercion types in metadata-keys | 30 min |
| 1.2 | Create TypeCoercionAnalyzer class | 3 hrs |
| 1.3 | Integrate with SemanticAnalyzer | 30 min |
| 1.4 | Write tests (40+ tests) | 2 hrs |
| | **Day 1 Total** | **6 hrs** |

### **Day 2: Addressing Modes**

| Task | Description | Time |
|------|-------------|------|
| 2.1 | Enhance M6502HintAnalyzer | 2 hrs |
| 2.2 | Add detection logic | 1.5 hrs |
| 2.3 | Write tests (25+ tests) | 1.5 hrs |
| | **Day 2 Total** | **5 hrs** |

### **Day 3: Expression Complexity**

| Task | Description | Time |
|------|-------------|------|
| 3.1 | Define complexity metrics | 20 min |
| 3.2 | Create ExpressionComplexityAnalyzer | 2.5 hrs |
| 3.3 | Integrate with SemanticAnalyzer | 30 min |
| 3.4 | Write tests (30+ tests) | 1.5 hrs |
| | **Day 3 Total** | **4.75 hrs** |

### **Day 4: Integration & Polish**

| Task | Description | Time |
|------|-------------|------|
| 4.1 | Run full test suite | 30 min |
| 4.2 | Fix any integration issues | 2 hrs |
| 4.3 | Update documentation | 1 hr |
| 4.4 | Update COMPILER-MASTER-PLAN.md | 30 min |
| | **Day 4 Total** | **4 hrs** |

---

## Task Implementation Checklist

| Task | Description | Dependencies | Status |
|------|-------------|--------------|--------|
| 1.1 | Define TypeCoercionKind enum | None | [x] |
| 1.2 | Create TypeCoercionAnalyzer | 1.1 | [x] |
| 1.3 | Integrate TypeCoercionAnalyzer | 1.2 | [x] |
| 1.4 | Tests for type coercion | 1.3 | [x] |
| 2.1 | Enhance M6502HintAnalyzer addressing | 1.4 | [x] |
| 2.2 | Addressing mode detection logic | 2.1 | [x] |
| 2.3 | Tests for addressing modes | 2.2 | [x] |
| 3.1 | Define complexity metadata keys | 2.3 | [x] |
| 3.2 | Create ExpressionComplexityAnalyzer | 3.1 | [x] |
| 3.3 | Integrate complexity analyzer | 3.2 | [x] |
| 3.4 | Tests for expression complexity | 3.3 | [x] |
| 4.1 | Run full test suite | 3.4 | [x] |
| 4.2 | Fix integration issues | 4.1 | [x] |
| 4.3 | Update documentation | 4.2 | [x] |
| 4.4 | Update COMPILER-MASTER-PLAN.md | 4.3 | [ ] |

---

## Success Criteria

### **Tests**
- [ ] All existing 2,428 tests pass
- [ ] 40+ new type coercion tests pass
- [ ] 25+ new addressing mode tests pass
- [ ] 30+ new complexity tests pass
- [ ] **Total: ~95+ new tests**

### **Functionality**
- [ ] Type coercions marked on all relevant AST nodes
- [ ] Addressing modes set for all variable accesses
- [ ] Complexity scores set for all expressions
- [ ] Integration with SemanticAnalyzer complete

### **Documentation**
- [ ] All new files have JSDoc comments
- [ ] README or documentation updated
- [ ] COMPILER-MASTER-PLAN.md updated

---

## Files to Create

| File | Purpose |
|------|---------|
| `semantic/analysis/type-coercion.ts` | Type coercion analyzer |
| `semantic/analysis/expression-complexity.ts` | Expression complexity analyzer |
| `__tests__/semantic/type-coercion.test.ts` | Type coercion tests |
| `__tests__/semantic/addressing-modes.test.ts` | Addressing mode tests |
| `__tests__/semantic/expression-complexity.test.ts` | Complexity tests |

## Files to Modify

| File | Changes |
|------|---------|
| `semantic/analysis/optimization-metadata-keys.ts` | Add new enum values and TypeCoercionKind |
| `semantic/analysis/m6502-hints.ts` | Add addressing mode determination |
| `semantic/analyzer.ts` | Integrate new analyzers into pipeline |
| `semantic/analysis/index.ts` | Export new analyzers |

---

## After Completion

Once this plan is implemented, the semantic analyzer will be **1000% ready** for IL generation with:

1. ✅ Type coercion points explicitly marked
2. ✅ Optimal addressing modes determined
3. ✅ Expression complexity for register allocation
4. ✅ All existing Phase 8 analysis
5. ✅ 6502-specific optimization hints
6. ✅ Constant propagation and folding
7. ✅ Liveness and reaching definitions
8. ✅ Alias and escape analysis
9. ✅ Loop and call graph analysis
10. ✅ Zero-page priority scoring

**Total Tests After**: 2,523+ (2,428 + 95)

---

## Next Steps After Completion

1. ✅ Return to IL Generator plan
2. ✅ Finalize IL architecture details
3. ✅ Create detailed IL implementation plan
4. ✅ Begin IL Generator implementation

---

**Document Status**: Ready for Implementation

**Next Action**: Toggle to Act mode to begin Task 1.1