# Inline Assembly Blocks Design

**Date:** January 8, 2026  
**Status:** Design Complete - Ready for Implementation  
**Priority:** ⭐⭐⭐⭐⭐ (Critical)

---

## Executive Summary

This document specifies the design for **inline assembly blocks** in Blend65, enabling developers to write raw 6502 assembly code within Blend65 functions when the language doesn't provide the necessary low-level control.

**Key Design Decision:** IL-centric architecture where assembly code is parsed into structured form, transformed to IL (Intermediate Language), merged with Blend65 IL, and processed through a unified optimizer before code generation.

---

## Table of Contents

1. [Motivation](#motivation)
2. [Design Goals](#design-goals)
3. [Syntax Specification](#syntax-specification)
4. [Architecture Overview](#architecture-overview)
5. [IL Representation](#il-representation)
6. [Compilation Pipeline](#compilation-pipeline)
7. [Challenges & Solutions](#challenges--solutions)
8. [Implementation Phases](#implementation-phases)
9. [Examples](#examples)
10. [Future Enhancements](#future-enhancements)

---

## Motivation

### Why Inline Assembly?

Blend65 aims to be a high-level, type-safe language for 6502 development, but there are scenarios where developers need direct assembly access:

1. **Performance-critical code**: Tight inner loops, cycle-counted operations
2. **Specific CPU instructions**: SEI, CLI, NOP, illegal opcodes
3. **Hardware tricks**: Cycle-exact timing, specific addressing modes
4. **Library integration**: Interfacing with existing assembly routines
5. **Learning and experimentation**: Gradual transition from assembly to Blend65

### Use Cases

```js
// Example 1: Disable/enable interrupts
function criticalSection(): void
  asm
    SEI  // Disable interrupts
  end asm
  
  // Critical code here
  
  asm
    CLI  // Enable interrupts
  end asm
end function

// Example 2: Performance-critical sprite update
function updateSprites(): void
  asm
    LDX #$00
  loop:
    LDA spriteData,X
    STA $D000,X
    INX
    CPX #$10
    BNE loop
  end asm
end function

// Example 3: Illegal opcode for optimization
function fastClear(): void
  asm
    LDA #$00
    SLO $D020  // Illegal opcode: shift + OR
  end asm
end function
```

---

## Design Goals

### Primary Goals

1. ✅ **Statement-level blocks**: Assembly is a statement, not an expression
2. ✅ **Variable access**: Reference Blend65 variables by name
3. ✅ **Label support**: Local labels within assembly blocks
4. ✅ **Illegal opcodes**: Allow all 6502 opcodes (legal and illegal)
5. ✅ **Clean integration**: Unified IL representation with Blend65 code
6. ✅ **Optimization potential**: Enable cross-boundary optimizations

### Non-Goals (For MVP)

- ❌ Expression-level assembly (returning values)
- ❌ Assembly macros
- ❌ Explicit register contracts (will use conservative defaults)
- ❌ Standalone `.asm` file support (future feature)

---

## Syntax Specification

### Block Structure

```ebnf
inline_asm_stmt = "asm"
                , { NEWLINE }
                , assembly_lines
                , "end" , "asm" ;

assembly_lines = { assembly_line , NEWLINE } ;

assembly_line = [ label ] , [ instruction ] , [ comment ] ;

label = identifier , ":" ;

instruction = mnemonic , [ operand ] ;

comment = ";" , { any_char } ;
```

### Example

```js
function example(): void
  @zp let counter: byte = 0;
  
  asm
    ; Assembly comment (semicolon-style)
    LDA counter      // Can reference Blend65 variables
    STA $D020
    INX
  loop:              // Local labels
    DEX
    BNE loop
  end asm
  
  counter = counter + 1;  // Continue with Blend65
end function
```

### Syntax Rules

1. **Block delimiter**: `asm ... end asm`
2. **No semicolon required**: Self-terminating block (like `end if`, `end function`)
3. **Comments**: Assembly-style (`;`) and Blend65-style (`//`) both allowed
4. **Whitespace**: Preserved within assembly block
5. **Case-insensitive mnemonics**: `LDA`, `lda`, `Lda` all valid
6. **Variable references**: Use Blend65 identifier names directly

### Scope Rules

**Accessible from assembly:**
- ✅ Local variables (function scope)
- ✅ Function parameters
- ✅ Module-level globals
- ✅ Memory-mapped variables (`@map`)

**NOT accessible:**
- ❌ Variables from other modules (unless imported and global)
- ❌ Variables from other functions

**Label scoping:**
- Labels are local to the assembly block
- Labels cannot conflict with other blocks in the same function
- Labels cannot be referenced from Blend65 code

---

## Architecture Overview

### IL-Centric Design

```
┌─────────────┐
│   Source    │
└──────┬──────┘
       │
   ┌───▼────┐
   │ Lexer  │ Captures raw assembly text
   └───┬────┘
       │
   ┌───▼────┐
   │ Parser │ Creates AST with InlineAssemblyBlock nodes
   └───┬────┘
       │
   ┌───▼──────────────┐
   │  AST (mixed)     │
   │  - Blend nodes   │
   │  - Raw asm text  │
   └───┬──────────────┘
       │
   ┌───▼────────────────┐
   │ Assembly Parser    │ Parse asm → structured asm nodes
   └───┬────────────────┘
       │
   ┌───▼──────────────┐
   │ AST (structured) │
   │  - Blend nodes   │
   │  - Asm nodes     │
   └───┬──────────────┘
       │
       ├─────────────────────────────┐
       │                             │
   ┌───▼──────────┐         ┌────────▼─────────┐
   │ Blend → IL   │         │ Assembly → IL    │
   └───┬──────────┘         └────────┬─────────┘
       │                             │
       └──────────┬──────────────────┘
                  │
           ┌──────▼─────────┐
           │  Unified IL    │ ← Single representation!
           └──────┬─────────┘
                  │
           ┌──────▼────────┐
           │   Analyzer    │ Type checking, validation
           └──────┬────────┘
                  │
           ┌──────▼────────┐
           │   Optimizer   │ Works on ALL code!
           └──────┬────────┘
                  │
           ┌──────▼────────┐
           │   Codegen     │ IL → 6502 asm
           └──────┬────────┘
                  │
           ┌──────▼────────┐
           │  6502 Output  │
           └───────────────┘
```

### Key Insight

**Assembly is just low-level IL operations.** By representing assembly as IL early, we:
- Enable unified optimization across Blend65 and assembly boundaries
- Eliminate redundant loads/stores between Blend and assembly
- Enable register allocation across boundaries
- Provide a single source of truth for optimization

---

## IL Representation

### IL Node Types

```typescript
// IL for 6502 instructions
interface LoadIL {
  kind: 'Load';
  source: Operand;          // Memory address or immediate
  destination: Register;     // A, X, Y
  addressing: AddressingMode;
}

interface StoreIL {
  kind: 'Store';
  source: Register;          // A, X, Y
  destination: Operand;      // Memory address
  addressing: AddressingMode;
}

interface ArithmeticIL {
  kind: 'Add' | 'And' | 'Or' | 'Xor' | 'Sub';
  operand: Operand;
  affectsCarry: boolean;
}

interface BranchIL {
  kind: 'Branch';
  condition: BranchCondition;  // Zero, Carry, Negative, etc.
  target: Label;
}

interface TransferIL {
  kind: 'Transfer';
  from: Register;
  to: Register;
}

// Operand types
type Operand =
  | { kind: 'immediate', value: number }
  | { kind: 'memory', address: number | string }
  | { kind: 'register', register: Register }
  | { kind: 'indexed', base: number, index: Register }
  | { kind: 'variable', name: string, symbol: VariableSymbol };

enum Register {
  A = 'A',   // Accumulator
  X = 'X',   // X register
  Y = 'Y',   // Y register
  S = 'S',   // Stack pointer
}
```

### Assembly → IL Mapping

| 6502 Instruction | IL Representation |
|-----------------|-------------------|
| `LDA $FB` | `Load { source: memory($FB), dest: A, mode: ZeroPage }` |
| `STA $D020` | `Store { source: A, dest: memory($D020), mode: Absolute }` |
| `INX` | `Arithmetic { kind: 'Increment', register: X }` |
| `BNE loop` | `Branch { condition: NotZero, target: 'loop' }` |
| `TAX` | `Transfer { from: A, to: X }` |

### Example Transformation

**Input:**
```js
@zp let counter: byte = 0;

function increment(): void
  counter = counter + 1;
  
  asm
    LDA counter
    STA $D020
  end asm
end function
```

**Unified IL:**
```typescript
FunctionIL("increment") {
  blocks: [
    BasicBlock("entry") {
      instructions: [
        // counter = counter + 1
        %1 = Load(counter)              // Blend → IL
        %2 = Add(%1, 1)
        Store(%2, counter)
        
        // asm block → IL
        %3 = Load(counter)              // LDA counter
        Store(%3, $D020)                // STA $D020
        
        Return()
      ]
    }
  ]
}
```

**Optimized IL:**
```typescript
// Optimizer sees %3 = Load(counter) is redundant (already have %2)
FunctionIL("increment") {
  blocks: [
    BasicBlock("entry") {
      instructions: [
        %1 = Load(counter)
        %2 = Add(%1, 1)
        Store(%2, counter)
        Store(%2, $D020)        // Reuse %2 directly!
        Return()
      ]
    }
  ]
}
```

---

## Compilation Pipeline

### Phase 1: Lexer

**Changes:**
1. Add `ASM` keyword token
2. Implement assembly block capture mode
3. Preserve whitespace and formatting

```typescript
// New token
enum TokenType {
  ASM = 'ASM',
  ASSEMBLY_BLOCK = 'ASSEMBLY_BLOCK',
  // ... existing tokens
}

// Lexer captures assembly block as raw text
protected scanAssemblyBlock(): Token {
  const lines: string[] = [];
  
  while (!this.isAtEnd()) {
    if (this.peekKeyword() === 'end' && this.peekNext() === 'asm') {
      break;
    }
    lines.push(this.readLine());
  }
  
  return this.makeToken(TokenType.ASSEMBLY_BLOCK, lines.join('\n'));
}
```

### Phase 2: Parser

**Changes:**
1. Parse `asm ... end asm` blocks
2. Create `InlineAssemblyBlock` AST node
3. Store raw assembly text

```typescript
export class InlineAssemblyBlock extends Statement {
  constructor(
    protected readonly rawAssembly: string,
    location: SourceLocation,
  ) {
    super(ASTNodeType.INLINE_ASM_BLOCK, location);
  }
}
```

### Phase 3: Assembly Sub-Parser

**New component: `assembler/parser.ts`**

```typescript
export class AssemblyParser {
  parse(source: string, scope: SymbolTable): AsmInstruction[] {
    const instructions: AsmInstruction[] = [];
    
    for (const line of source.split('\n')) {
      const trimmed = this.removeComments(line).trim();
      if (trimmed === '') continue;
      
      if (this.isLabel(trimmed)) {
        instructions.push(this.parseLabel(trimmed));
      } else {
        instructions.push(this.parseInstruction(trimmed, scope));
      }
    }
    
    return instructions;
  }
  
  protected parseInstruction(line: string, scope: SymbolTable): AsmInstruction {
    const [mnemonic, operandStr] = this.splitInstruction(line);
    const operand = this.parseOperand(operandStr, scope);
    const mode = this.detectAddressingMode(mnemonic, operand);
    
    return new AsmInstruction(mnemonic, mode, operand);
  }
}
```

### Phase 4: IL Transform

**Transform both Blend and Assembly to unified IL:**

```typescript
class ILTransformer {
  transformInlineAssembly(block: InlineAssemblyBlock): Instruction[] {
    const asmParser = new AssemblyParser();
    const asmNodes = asmParser.parse(block.getRawAssembly(), this.scope);
    
    const ilInstructions: Instruction[] = [];
    
    for (const asmNode of asmNodes) {
      const il = this.asmToIL(asmNode);
      ilInstructions.push(...il);
    }
    
    return ilInstructions;
  }
  
  protected asmToIL(instruction: AsmInstruction): Instruction[] {
    switch (instruction.mnemonic.toUpperCase()) {
      case 'LDA':
        return [new LoadIL(instruction.operand, Register.A, instruction.mode)];
      case 'STA':
        return [new StoreIL(Register.A, instruction.operand, instruction.mode)];
      case 'INX':
        return [new ArithmeticIL('Increment', Register.X)];
      // ... map all 6502 instructions
    }
  }
}
```

### Phase 5: Optimizer

**Operates on unified IL:**

```typescript
class Optimizer {
  optimize(il: FunctionIL): FunctionIL {
    // Works on Blend + Assembly IL uniformly
    this.eliminateDeadCode(il);
    this.eliminateRedundantLoads(il);
    this.propagateConstants(il);
    this.reuseRegisters(il);
    return il;
  }
  
  protected eliminateRedundantLoads(il: FunctionIL): void {
    // Example: Remove redundant loads across Blend/asm boundary
    // Store(%2, counter) followed by Load(counter) → reuse %2
  }
}
```

### Phase 6: Codegen

**Generate 6502 assembly from IL:**

```typescript
class CodeGenerator {
  generateFromIL(il: FunctionIL): string {
    const output: string[] = [];
    
    for (const block of il.blocks) {
      for (const instruction of block.instructions) {
        output.push(this.generateInstruction(instruction));
      }
    }
    
    return output.join('\n');
  }
}
```

---

## Challenges & Solutions

### Challenge 1: Control Flow Reconstruction

**Problem:** Assembly has arbitrary jumps and branches that don't map to structured CFG.

**Solution:** Standard control flow graph construction:
1. Identify all labels (basic block boundaries)
2. Identify branch targets
3. Split into basic blocks
4. Connect predecessors/successors

**Status:** ✅ SOLVABLE (standard compiler technique)

### Challenge 2: Processor Flags (Implicit State)

**Problem:** Flags (Zero, Carry, Negative, Overflow) are implicit state.

**Solution:** Represent flags as explicit IL values or pseudo-registers:
```typescript
// CMP produces flags
%flags1 = Compare(operand, value)

// BEQ uses flags
CondBranch(FlagCheck('zero', %flags1), trueBlock, falseBlock)
```

**Status:** ✅ SOLVABLE

### Challenge 3: Memory Aliasing

**Problem:** Assembly can write to arbitrary memory; optimizer must be conservative.

**Solution:** Conservative analysis + escape tracking:
- Track which variables are accessed by assembly
- Assume unknown memory writes may modify any variable
- Use memory barriers around assembly blocks

```typescript
// Variables accessed in assembly are marked volatile
Store(%2, counter)
MemoryBarrier()           // Assembly block starts
Load(counter) → A         // Must actually load from memory
MemoryBarrier()           // Assembly block ends
```

**Status:** ⚠️ REQUIRES CONSERVATISM

### Challenge 4: Register State at Boundaries

**Problem:** What register values can assembly assume on entry?

**Solution:** Conservative default + explicit contracts (future):

**MVP (Conservative):**
- **liveIn:** No assumptions (reload everything)
- **clobbered:** All registers (A, X, Y, flags)
- **liveOut:** No guarantees (reload everything)

**Future:**
```js
asm(uses: [A: counter], clobbers: [X, Y])
  TAX
  INX
end asm
```

**Status:** ✅ SOLVABLE

### Challenge 5: Illegal Opcodes

**Problem:** Illegal opcodes have undocumented behavior.

**Solution:** Opaque intrinsic IL nodes:

```typescript
interface IntrinsicIL {
  kind: 'Intrinsic';
  name: string;        // "SLO", "RLA", etc.
  operands: Operand[];
  effects: EffectSet;  // What it modifies
}
```

Optimizer treats as black box with documented effects.

**Status:** ✅ SOLVABLE

### Challenge 6: Optimization Safety

**Problem:** Optimizations might break assembly semantics.

**Solution:** Memory barriers + volatile variables:
- Assembly blocks act as memory barriers
- Variables accessed in assembly are marked volatile
- Optimizer must not eliminate loads/stores to volatile vars

**Status:** ✅ SOLVABLE (CRITICAL for correctness)

---

## Implementation Phases

### Phase 1: Core Infrastructure (5-7 days)

#### Task 1.1: Lexer Changes
- Add `ASM` and `ASSEMBLY_BLOCK` token types
- Implement assembly block capture mode
- Test tokenization of assembly blocks

#### Task 1.2: AST Nodes
- Create `InlineAssemblyBlock` class
- Update `ASTNodeType` enum
- Update `ASTVisitor` interface

#### Task 1.3: Parser Implementation
- Implement `parseInlineAssemblyStatement()`
- Handle `asm ... end asm` syntax
- Add parser tests

#### Task 1.4: Assembly Sub-Parser
- Create `assembler/parser.ts`
- Implement instruction parsing
- Implement operand parsing
- Handle variable references
- Detect addressing modes

#### Task 1.5: Testing Infrastructure
- Unit tests for assembly parsing
- Tests for variable reference extraction
- Tests for label detection

### Phase 2: IL Integration (5-7 days)

#### Task 2.1: IL Node Definitions
- Define IL types for 6502 instructions
- Define operand types
- Define addressing modes

#### Task 2.2: Assembly → IL Transform
- Implement `AssemblyToIL` transformer
- Map each 6502 instruction to IL
- Handle variable resolution
- Create label targets

#### Task 2.3: IL Merger
- Integrate assembly IL into Blend IL
- Connect control flow
- Create unified CFG

#### Task 2.4: Analyzer Updates
- Validate variable references
- Track assembly-accessed variables
- Check label conflicts
- Add memory barrier insertion

### Phase 3: Codegen & Testing (3-5 days)

#### Task 3.1: Codegen Updates
- Generate assembly from IL
- Resolve variable addresses
- Mangle label names
- Emit debug annotations

#### Task 3.2: Integration Testing
- End-to-end tests (source → assembly)
- Test variable access
- Test label scoping
- Test optimization

#### Task 3.3: Real-World Validation
- Test with C64 use cases
- Test with illegal opcodes
- Performance validation

### Phase 4: Optimization (Future)

#### Task 4.1: Basic Optimizations
- Dead code elimination
- Constant propagation
- Copy propagation

#### Task 4.2: Cross-Boundary Optimization
- Redundant load/store elimination
- Register reuse
- Common subexpression elimination

#### Task 4.3: Assembly-Specific
- Peephole optimization
- Branch optimization
- Addressing mode selection

---

## Examples

### Example 1: Interrupt Control

```js
function criticalOperation(): void
  asm
    SEI  // Disable interrupts
  end asm
  
  updateCriticalData();
  
  asm
    CLI  // Enable interrupts
  end asm
end function
```

### Example 2: Fast Memory Clear

```js
function clearScreen(): void
  asm
    LDA #$20      ; Space character
    LDX #$00
  loop:
    STA $0400,X   ; Screen RAM page 1
    STA $0500,X   ; Screen RAM page 2
    STA $0600,X   ; Screen RAM page 3
    STA $0700,X   ; Screen RAM page 4
    INX
    BNE loop
  end asm
end function
```

### Example 3: Variable Access

```js
@zp let spriteX: byte = 100;
@zp let spriteY: byte = 50;

function updateSprite(): void
  asm
    LDA spriteX   ; Access Blend65 variable
    STA $D000     ; Sprite 0 X position
    
    LDA spriteY
    STA $D001     ; Sprite 0 Y position
  end asm
end function
```

### Example 4: Illegal Opcode

```js
function fastShift(): void
  @zp let value: byte = 0xFF;
  
  asm
    SLO value     ; Illegal opcode: shift left + OR
  end asm
end function
```

### Example 5: Cross-Boundary Optimization

```js
function optimizedUpdate(): void
  let x: byte = calculateValue();  // Returns in A
  
  asm
    ; Optimizer can reuse A register (no reload needed)
    STA $D020
  end asm
end function
```

---

## Future Enhancements

### V2 Features

1. **Expression-level assembly** (returns values)
   ```js
   let result: byte = asm<byte> { LDA $D012 } end asm
   ```

2. **Explicit register contracts**
   ```js
   asm(uses: [A: counter], clobbers: [X, Y])
     TAX
   end asm
   ```

3. **Assembly macros**
   ```js
   macro clearScreen()
     LDA #$20
     LDX #$00
   loop:
     STA $0400,X
     INX
     BNE loop
   end macro
   ```

4. **Standalone assembly files**
   - Import `.asm` files as modules
   - Call assembly routines from Blend65

5. **Advanced optimizations**
   - Peephole optimization
   - Register allocation across boundaries
   - Instruction scheduling

---

## Comparison with Other Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Raw Text** | Simple, fast | No optimization, no validation |
| **IL-Centric (Chosen)** | Full optimization, unified representation | More complex implementation |
| **Opaque Blocks** | Medium complexity | Limited optimization |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Optimization breaks semantics | **Critical** | Memory barriers, conservative analysis, thorough testing |
| Complex implementation | High | Phased approach, start with MVP |
| Performance overhead | Medium | Caching, lazy evaluation |
| Poor error messages | Medium | Source location tracking |

---

## Success Criteria

### MVP Success Criteria

1. ✅ Assembly blocks parse correctly
2. ✅ Variables are accessible from assembly
3. ✅ Labels work within blocks
4. ✅ Generated code is correct
5. ✅ No optimization bugs (conservative is fine)

### V2 Success Criteria

6. ✅ Cross-boundary optimization works
7. ✅ Illegal opcodes supported
8. ✅ Performance matches hand-written assembly
9. ✅ Good error messages with line numbers

---

## References

- Language Specification: `docs/language-specification.md`
- AST Base Classes: `packages/compiler/src/ast/base.ts`
- AST Nodes: `packages/compiler/src/ast/nodes.ts`
- Parser Base: `packages/compiler/src/parser/base.ts`

---

**Document Status:** Design Complete  
**Implementation Status:** Not Started  
**Estimated Effort:** 15-20 days (MVP + IL + Codegen)  
**Next Steps:** Begin implementation with Phase 1 (Lexer + Parser + Assembly Sub-Parser)

---

## Appendix A: 6502 Instruction Set

### Legal Instructions (56 total)

**Data Transfer:**
LDA, LDX, LDY, STA, STX, STY, TAX, TAY, TSX, TXA, TXS, TYA

**Arithmetic:**
ADC, SBC, INC, INX, INY, DEC, DEX, DEY

**Logical:**
AND, ORA, EOR

**Shift/Rotate:**
ASL, LSR, ROL, ROR

**Comparison:**
CMP, CPX, CPY

**Branching:**
BCC, BCS, BEQ, BMI, BNE, BPL, BVC, BVS

**Jumps:**
JMP, JSR, RTS, RTI

**Stack:**
PHA, PHP, PLA, PLP

**Flags:**
CLC, CLD, CLI, CLV, SEC, SED, SEI

**Other:**
BIT, BRK, NOP

### Common Illegal Opcodes

**Combo Operations:**
SLO, RLA, SRE, RRA (shift + logic)

**Load/Store:**
LAX, SAX (load/store combos)

**Arithmetic:**
DCP, ISC (decrement/increment + compare)

**Others:**
ANC, ALR, ARR, AXS, AHX, SHY, SHX, TAS, LAS

---

**End of Document**
