# IL Generator Multi-Target Architecture Analysis

> **Date**: January 18, 2026
> **Status**: Analysis Complete
> **Question**: Does the IL generator need special handling for multi-target support (C64/C128/X16)?

---

## Executive Summary

**Answer: NO, the IL generator does NOT need major changes for multi-target support.**

The IL (Intermediate Language) should remain **target-agnostic** with only minimal target awareness. Your existing multi-target architecture plan correctly places target-specific concerns in the semantic analyzer and code generator phases.

---

## Architecture Decision: Three-Layer Separation

### **Layer 1: Semantic Analyzer (Target-Aware) ✅**

**Status**: Already implemented correctly

**Responsibilities**:
- Target-specific hardware analysis (VIC-II timing, SID conflicts, VERA)
- Hardware constraint detection
- Zero-page allocation with target-specific reserved ranges
- Optimization metadata generation

**Implementation**:
- Accepts `TargetConfig` parameter
- Hardware analyzers for C64/C128/X16
- Stores results as AST metadata

**Example**:
```typescript
// Semantic analyzer knows about C64 vs X16 differences
const analyzer = new AdvancedAnalyzer(
  symbolTable,
  cfgs,
  typeSystem,
  targetConfig  // C64_CONFIG vs X16_CONFIG
);

// Analyzes VIC-II on C64, VERA on X16
analyzer.runTier4HardwareAnalysis();
```

---

### **Layer 2: IL Generator (Target-Agnostic) 🎯**

**Status**: Needs minimal target awareness only

**Responsibilities**:
- Convert AST to abstract intermediate representation
- Handle intrinsics (peek, poke, sizeof) generically
- Preserve semantic analysis metadata
- Pass target context through (but don't interpret it)

**What IL Generator DOES NOT Do**:
- ❌ Interpret hardware-specific addresses
- ❌ Make target-specific optimization decisions
- ❌ Create separate IL dialects per target
- ❌ Understand VIC-II vs VERA vs TIA differences

**What IL Generator DOES Do**:
- ✅ Accept `TargetConfig` parameter (for context only)
- ✅ Generate generic hardware access operations
- ✅ Preserve metadata from semantic phase
- ✅ Let code generator handle target specifics

**Example**:
```typescript
// IL Generator with minimal target awareness
class ILGenerator {
  constructor(
    ast: Program,
    symbolTable: GlobalSymbolTable,
    typeSystem: TypeSystem,
    targetConfig: TargetConfig  // For intrinsic resolution context only
  ) { }
}

// Generates same IL for C64 and X16
// peek($D020) on C64 → HardwareRead { address: 0xD020 }
// peek($9F29) on X16 → HardwareRead { address: 0x9F29 }
```

---

### **Layer 3: Code Generator (Target-Specific) 🔜**

**Status**: Future phase (not yet implemented)

**Responsibilities**:
- Generate actual 6502/65C02/65816 assembly
- Map abstract IL to target-specific instructions
- Apply hardware-specific optimizations
- Interpret metadata from semantic analysis

**Example**:
```typescript
// Code generator handles ALL target differences
class CodeGenerator {
  constructor(
    il: ILProgram,
    targetConfig: TargetConfig  // Fully interprets target
  ) { }
  
  generateHardwareAccess(node: HardwareReadIL): void {
    if (this.targetConfig.architecture === TargetArchitecture.C64) {
      // C64: VIC-II access with badline awareness
      this.applyC64Timing(node);
    } else if (this.targetConfig.architecture === TargetArchitecture.X16) {
      // X16: VERA access with different timing model
      this.applyX16Timing(node);
    }
  }
}
```

---

## Compiler Pipeline with Target Awareness

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SOURCE CODE                                     │
│  C64: peek($D020)    // VIC-II border color                            │
│  X16: peek($9F29)    // VERA composer control                          │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC ANALYZER (Target-Aware)                     │
│  ✅ Knows: C64 has VIC-II at $D000, X16 has VERA at $9F20             │
│  ✅ Runs: C64HardwareAnalyzer vs X16HardwareAnalyzer                   │
│  ✅ Detects: VIC-II badlines (C64) vs VERA timing (X16)               │
│  ✅ Stores: Metadata on AST nodes                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    IL GENERATOR (Target-Agnostic)                       │
│  📋 Generates: HardwareRead { address: 0xD020, metadata: {...} }      │
│  📋 Generates: HardwareRead { address: 0x9F29, metadata: {...} }      │
│  ⚠️  SAME IL STRUCTURE FOR BOTH TARGETS                                │
│  ⚠️  Passes metadata through unchanged                                 │
└─────────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                   CODE GENERATOR (Target-Specific)                      │
│  C64: LDA $D020       ; Apply VIC-II timing constraints                │
│  X16: LDA $9F29       ; Apply VERA timing model                        │
│  ✅ Interprets metadata and generates target-specific code             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Concrete Examples

### **Example 1: VIC-II (C64) vs VERA (X16) Hardware Access**

**Source Code (C64)**:
```js
@map borderColor at $D020: byte;
let color = borderColor;  // Read VIC-II register
```

**Source Code (X16)**:
```js
@map veraControl at $9F29: byte;
let control = veraControl;  // Read VERA register
```

**Semantic Analysis**:
```typescript
// C64: Phase 8 analyzer detects VIC-II access
metadata = {
  isVICIIRegister: true,
  canCauseBadline: false,
  cycleEstimate: 4
}

// X16: Phase 8 analyzer detects VERA access
metadata = {
  isVERARegister: true,
  veraAddressSpace: 'composer',
  cycleEstimate: 2  // X16 is faster!
}
```

**IL Generated (SAME STRUCTURE)**:
```typescript
// C64
HardwareRead {
  address: Const(0xD020),
  size: 'byte',
  metadata: { isVICIIRegister: true, ... }
}

// X16
HardwareRead {
  address: Const(0x9F29),
  size: 'byte',
  metadata: { isVERARegister: true, ... }
}
```

**Code Generated (TARGET-SPECIFIC)**:
```asm
; C64 - May need to wait for safe raster line
LDA $D020

; X16 - Direct access, different timing
LDA $9F29
```

---

### **Example 2: Sound Chip Access - SID (C64) vs YM2151 (X16)**

**Source Code (C64)**:
```js
// SID voice 1 frequency
poke($D400, freqLow);
poke($D401, freqHigh);
```

**Source Code (X16)**:
```js
// YM2151 register write
poke($9F40, register);
poke($9F41, value);
```

**Semantic Analysis**:
```typescript
// C64: SID conflict detector runs
metadata = {
  sidVoice: 1,
  sidRegister: 'frequency',
  voiceConflict: false
}

// X16: YM2151 analyzer runs (future)
metadata = {
  ym2151Register: true,
  channelNumber: 0
}
```

**IL Generated (SAME STRUCTURE)**:
```typescript
// Both become HardwareWrite with different addresses
HardwareWrite {
  address: Const(0xD400),  // or 0x9F40
  value: Variable(freqLow),
  size: 'byte',
  metadata: { ... }
}
```

**Code Generated (TARGET-SPECIFIC)**:
```asm
; C64 - SID has specific timing requirements
LDA freqLow
STA $D400

; X16 - YM2151 requires different sequence
LDA register
STA $9F40
LDA value
STA $9F41
```

---

## Required Updates to IL Generator Plan

### **1. Constructor Signature (Minor Update)**

```typescript
class ILGenerator {
  constructor(
    ast: Program,
    symbolTable: GlobalSymbolTable,
    typeSystem: TypeSystem,
    targetConfig: TargetConfig  // ADD THIS PARAMETER
  ) {
    this.ast = ast;
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.targetConfig = targetConfig;  // Store for intrinsic resolution
  }
}
```

**Why**: Provides context for intrinsic resolution and future extensibility.

---

### **2. Generic Hardware Access IL Nodes (New Types)**

```typescript
/**
 * Generic hardware register read
 * Target-agnostic representation
 */
interface HardwareReadIL extends ILNode {
  kind: 'HardwareRead';
  addressExpr: ILExpression;  // Could be $D020 (C64) or $9F29 (X16)
  size: 'byte' | 'word';
  metadata?: Map<OptimizationMetadataKey, any>;  // From semantic phase
}

/**
 * Generic hardware register write
 * Target-agnostic representation
 */
interface HardwareWriteIL extends ILNode {
  kind: 'HardwareWrite';
  addressExpr: ILExpression;  // Could be $D400 (SID) or $9F40 (YM2151)
  valueExpr: ILExpression;
  size: 'byte' | 'word';
  metadata?: Map<OptimizationMetadataKey, any>;  // From semantic phase
}
```

**Why**: Abstracts hardware access without target-specific knowledge.

---

### **3. Metadata Preservation (Critical)**

```typescript
/**
 * All IL nodes must preserve metadata from semantic analysis
 */
interface ILNode {
  kind: string;
  location?: SourceLocation;
  metadata?: Map<OptimizationMetadataKey, any>;  // PRESERVE THIS
}

/**
 * Copy metadata from AST to IL
 */
protected generateILNode(astNode: ASTNode): ILNode {
  const ilNode = this.createILNode(astNode);
  
  // Preserve all metadata from semantic analysis
  if (astNode.metadata) {
    ilNode.metadata = new Map(astNode.metadata);
  }
  
  return ilNode;
}
```

**Why**: Code generator needs semantic analysis results (timing, conflicts, etc.).

---

### **4. Intrinsic Resolution Context (Optional)**

```typescript
/**
 * Resolve intrinsic with target context
 */
protected resolveIntrinsic(name: string): IntrinsicInfo {
  const intrinsic = this.intrinsics.get(name);
  
  if (!intrinsic) {
    throw new Error(`Unknown intrinsic: ${name}`);
  }
  
  // Most intrinsics are target-agnostic
  // Future: Some might need target-specific behavior
  // Example: sizeof() might vary by target in future (unlikely)
  if (intrinsic.targetDependent && this.targetConfig) {
    return this.resolveTargetSpecificIntrinsic(name);
  }
  
  return intrinsic;
}
```

**Why**: Future-proofs for potential target-specific intrinsics.

---

## What Multi-Target Plan Already Solves

Your existing `plans/multi-target-architecture-abstraction-plan.md` correctly handles:

✅ **Target Configuration**
- `TargetConfig` interface with hardware specs
- C64/C128/X16 configurations
- Target registry and selection

✅ **Hardware Analyzers**
- Base classes for hardware analysis
- Target-specific analyzer implementations
- C64HardwareAnalyzer, C128HardwareAnalyzer, X16HardwareAnalyzer

✅ **Semantic Phase Integration**
- `AdvancedAnalyzer` accepts `TargetConfig`
- Phase 8 runs target-specific analysis
- Metadata stored on AST nodes

**The IL generator just needs to preserve this work, not duplicate it.**

---

## Summary of Required Changes

### **IL Generator Requirements Document** ✅

**Status**: Updated with multi-target section

**Changes**:
- Added "Multi-Target Architecture Considerations" section
- Documented target-agnostic design philosophy
- Added examples of C64 vs X16 code
- Clarified what IL does NOT do

**File**: `plans/il-generator-requirements.md`

---

### **Multi-Target Architecture Plan** (Optional Update)

**Status**: Plan is correct, could add clarification

**Optional Enhancement**:
Add section clarifying IL generator's role:
- "IL Generator: Target-Agnostic Operations"
- Explain metadata passthrough
- Reference IL requirements doc

**File**: `plans/multi-target-architecture-abstraction-plan.md`

---

### **Compiler Master Plan** (No Changes Needed)

**Status**: Already correct

The master plan correctly lists IL Generator as target-agnostic phase.

---

## Conclusion

### **Answer to Your Question**

**"Do we have to do something special in the IL generator for multi-target requirements?"**

**Answer: Minimal changes only. The IL generator needs:**

1. ✅ **Accept `TargetConfig` parameter** - For context (intrinsic resolution)
2. ✅ **Use generic hardware access IL nodes** - HardwareRead/Write
3. ✅ **Preserve semantic metadata** - Pass through to code generator
4. ❌ **Does NOT need target-specific logic** - That's in semantic & code gen

### **Your Architecture is Correct**

The separation you designed is exactly right:
- **Semantic Analyzer**: Target-aware (hardware analysis, constraints)
- **IL Generator**: Target-agnostic (abstract operations)
- **Code Generator**: Target-specific (actual 6502/65C02 assembly)

### **Implementation Order**

1. **Implement IL generator as target-agnostic** (4-6 weeks)
2. **Multi-target abstraction already done** (Phase 8 complete)
3. **Code generator handles target differences** (future phase)

---

## Next Steps

### **Immediate**

✅ **IL generator requirements updated** with multi-target considerations
✅ **Analysis document created** (this file)

### **Optional**

- Update multi-target plan to reference IL requirements
- Add IL generator multi-target section to master plan
- Create IL generator detailed implementation plan

### **When Ready to Implement IL Generator**

The IL generator can proceed with minimal target awareness:
- Accept `TargetConfig` parameter
- Generate generic IL operations
- Preserve metadata
- Let code generator handle differences

---

**Document Status**: ✅ Complete - Analysis Done

**Key Finding**: IL generator needs minimal changes for multi-target support. Your existing architecture correctly separates concerns.