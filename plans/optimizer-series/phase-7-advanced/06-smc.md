# Self-Modifying Code (SMC)

> **Phase**: 7 - Advanced Optimizations  
> **Document**: 06-smc.md  
> **Focus**: Optional self-modifying code optimization (-Osmc)  
> **Est. Lines**: ~250

---

## Overview

**Self-Modifying Code (SMC)** is a powerful 6502 optimization technique where code modifies itself at runtime. It can save bytes and cycles but has significant caveats.

**⚠️ WARNING**: SMC is **opt-in only** via `-Osmc` flag. It breaks on:
- Modern emulators with strict memory protection
- Hardware accelerators
- Some flash cartridges
- Debugging tools

**Best use**: Pure C64 targets where maximum performance is critical.

---

## 1. When to Use SMC

### 1.1 Valid Use Cases

| Use Case | Benefit | Risk |
|----------|---------|------|
| Inner loops with varying addresses | 1 byte, 1 cycle per access | Moderate |
| Computed jumps | Avoids jump tables | Low |
| Constant patching | Dynamic configuration | Low |
| Unrolled loops with address progression | Significant savings | Moderate |

### 1.2 When NOT to Use SMC

- ❌ Code that runs from ROM
- ❌ Code copied to different addresses
- ❌ Interrupt handlers (timing-sensitive)
- ❌ Code that needs to be debugged
- ❌ Multi-platform targets

---

## 2. SMC Patterns

### 2.1 Address Modification

Most common SMC pattern - modify the operand of an instruction:

```asm
; Standard indexed addressing (4 cycles, 3 bytes)
    LDA data,X        ; 4 cycles

; SMC version (3 cycles, but requires setup)
load_addr = * + 1     ; Point to operand
    LDA data          ; 3 cycles (absolute, modified at runtime)

; Modification code
    LDA #<new_addr
    STA load_addr
    LDA #>new_addr
    STA load_addr+1
```

### 2.2 Opcode Modification

Change the instruction itself:

```asm
; Toggle between NOP and STA
toggle_store:
    NOP               ; or STA $D020

; To enable:
    LDA #$8D          ; STA absolute opcode
    STA toggle_store
    
; To disable:
    LDA #$EA          ; NOP opcode
    STA toggle_store
```

### 2.3 Computed Branch

Modify branch target:

```asm
; Dynamic branch target
branch_inst = * + 1
    BNE somewhere     ; Target modified at runtime

; Set new target
    LDA #offset
    STA branch_inst
```

---

## 3. SMC Implementation

### 3.1 SMC Detection

```typescript
/**
 * Detect opportunities for self-modifying code.
 */
export class SMCDetector {
  /**
   * Find candidates for address modification SMC.
   */
  public findAddressModCandidates(func: AsmFunction): SMCCandidate[] {
    const candidates: SMCCandidate[] = [];
    
    for (const inst of func.instructions) {
      // Look for indexed addressing in hot loops
      if (this.isIndexedAddressing(inst) && this.isInHotLoop(inst)) {
        const benefit = this.calculateBenefit(inst);
        if (benefit > 0) {
          candidates.push({
            instruction: inst,
            type: 'address-modification',
            benefit,
          });
        }
      }
    }
    
    return candidates;
  }
  
  /**
   * Calculate benefit of SMC transformation.
   */
  protected calculateBenefit(inst: AsmInstruction): number {
    // Indexed: 4 cycles, 3 bytes
    // Absolute: 3 cycles, 3 bytes (but need setup)
    
    // Benefit = cycles saved × loop iterations - setup cost
    const cyclesSaved = 1;  // Per access
    const loopCount = this.estimateLoopIterations(inst);
    const setupCost = 8;    // LDA/STA pair for address
    
    return (cyclesSaved * loopCount) - setupCost;
  }
}
```

### 3.2 SMC Transformation

```typescript
/**
 * Apply SMC transformation.
 */
export class SMCTransformer {
  /**
   * Transform indexed addressing to SMC.
   */
  public transformToSMC(candidate: SMCCandidate): void {
    const inst = candidate.instruction;
    
    // Create label for operand location
    const operandLabel = this.createOperandLabel(inst);
    
    // Change to absolute addressing
    const newInst = this.convertToAbsolute(inst, operandLabel);
    
    // Generate address update code
    const updateCode = this.generateAddressUpdate(operandLabel, inst);
    
    // Insert before loop
    this.insertBeforeLoop(updateCode);
    
    // Replace original instruction
    this.replaceInstruction(inst, newInst);
  }
  
  /**
   * Generate code to update SMC address.
   */
  protected generateAddressUpdate(label: string, inst: AsmInstruction): AsmInstruction[] {
    // Calculate address: base + index
    return [
      { opcode: 'CLC' },
      { opcode: 'LDA', operand: `#<${inst.baseAddress}` },
      { opcode: 'ADC', operand: inst.indexReg },
      { opcode: 'STA', operand: label },
      { opcode: 'LDA', operand: `#>${inst.baseAddress}` },
      { opcode: 'ADC', operand: '#0' },  // Carry from low byte
      { opcode: 'STA', operand: `${label}+1` },
    ];
  }
}
```

---

## 4. SMC Safety Checks

### 4.1 Code Location Verification

```typescript
/**
 * Verify SMC is safe to apply.
 */
export class SMCSafetyChecker {
  /**
   * Check if code location supports SMC.
   */
  public canApplySMC(inst: AsmInstruction): boolean {
    // Must be in RAM, not ROM
    if (this.isInROM(inst.address)) {
      return false;
    }
    
    // Must not be in a relocatable section
    if (this.isRelocatable(inst)) {
      return false;
    }
    
    // Must not be in interrupt handler
    if (this.isInInterruptHandler(inst)) {
      return false;
    }
    
    // Check for code banking issues
    if (this.hasBankingConflict(inst)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check for potential race conditions.
   */
  public hasRaceCondition(inst: AsmInstruction): boolean {
    // Modification and execution must not overlap
    const modificationPoint = this.findModificationPoint(inst);
    const executionPoint = inst.address;
    
    // Check if IRQ could fire between modification and execution
    return this.irqCouldInterfere(modificationPoint, executionPoint);
  }
}
```

### 4.2 Timing Considerations

```asm
; DANGEROUS: SMC in tight timing loop
    LDA #$00
modify_addr = * + 1
    STA $D020         ; If IRQ modifies this, wrong address!
    
; SAFE: Disable interrupts around SMC execution
    SEI               ; Disable interrupts
    LDA #<new_addr
    STA modify_addr
    LDA #>new_addr
    STA modify_addr+1
    ; ... execute modified code ...
    CLI               ; Re-enable interrupts
```

---

## 5. Common SMC Idioms

### 5.1 Fast Screen Clear

```asm
; Traditional (indexed)
    LDX #0
clear:
    LDA #$20          ; Space character
    STA $0400,X       ; 5 cycles
    STA $0500,X
    STA $0600,X
    STA $06E8,X
    INX
    BNE clear

; SMC version (unrolled with SMC)
clear:
addr1 = * + 1
    STA $0400         ; 4 cycles (faster!)
addr2 = * + 1
    STA $0401
addr3 = * + 1
    STA $0402
    ; ... more unrolled stores ...
    
    ; Update addresses
    CLC
    LDA addr1
    ADC #8            ; Increment by unroll factor
    STA addr1
    ; ... update other addresses ...
```

### 5.2 Dynamic Jump Table

```asm
; Instead of: JMP (vector) which has a bug at page boundary
; Use SMC:
jump_target = * + 1
    JMP $0000         ; Target patched at runtime

; Patch:
    LDA #<handler
    STA jump_target
    LDA #>handler
    STA jump_target+1
```

### 5.3 Sprite Multiplexer

```asm
; Sprite Y position comparison (very hot path)
; Standard: CMP $D001 (4 cycles)
; SMC: CMP #nn where nn is patched
check_sprite0:
y_pos_0 = * + 1
    CMP #$00          ; 2 cycles! (immediate)
    BCS skip0
    ; ... sprite handling ...
skip0:

; At frame start, patch the values:
    LDA sprite_y+0
    STA y_pos_0
    LDA sprite_y+1
    STA y_pos_1
    ; ...
```

---

## 6. Code Generation with SMC

### 6.1 SMC Annotation

```typescript
/**
 * Annotate code for SMC.
 */
export interface SMCAnnotation {
  /** Label pointing to modifiable operand */
  operandLabel: string;
  
  /** Original addressing mode */
  originalMode: AddressingMode;
  
  /** Size of operand (1 or 2 bytes) */
  operandSize: 1 | 2;
  
  /** Code that modifies this location */
  modifierCode: AsmInstruction[];
}

/**
 * Generate SMC-aware assembly output.
 */
export class SMCAsmGenerator {
  /**
   * Emit instruction with SMC annotation.
   */
  protected emitSMCInstruction(inst: AsmInstruction, smc: SMCAnnotation): void {
    // Emit label for operand
    this.emit(`${smc.operandLabel} = * + 1`);
    
    // Emit instruction (absolute addressing)
    this.emit(`    ${inst.opcode} $0000`);
    
    // Emit comment
    this.emit(`    ; SMC: ${smc.originalMode} converted`);
  }
}
```

### 6.2 SMC Initialization

```typescript
/**
 * Generate SMC initialization code.
 */
export class SMCInitGenerator {
  /**
   * Generate code to initialize all SMC locations.
   */
  public generateInit(smcLocations: SMCAnnotation[]): AsmInstruction[] {
    const code: AsmInstruction[] = [];
    
    for (const smc of smcLocations) {
      // Generate address setup
      code.push(...smc.modifierCode);
    }
    
    return code;
  }
}
```

---

## 7. Debugging SMC

### 7.1 SMC Debug Mode

```typescript
/**
 * Debug support for SMC.
 */
export class SMCDebugger {
  /**
   * Generate debug-friendly SMC (with verification).
   */
  public generateDebugSMC(smc: SMCAnnotation): AsmInstruction[] {
    return [
      // Store expected value
      { opcode: 'LDA', operand: `#<${smc.operandLabel}` },
      { opcode: 'CMP', operand: `_smc_expected_${smc.operandLabel}` },
      { opcode: 'BEQ', operand: '+3' },
      { opcode: 'JMP', operand: '_smc_error' },  // Verification failed!
      
      // ... normal SMC modification ...
    ];
  }
}
```

### 7.2 SMC Listing

```asm
; Assembler listing with SMC annotations
; 
; SMC Locations:
;   $0810: load_addr (2 bytes) - screen pointer
;   $0820: store_addr (2 bytes) - color pointer
;   $0830: branch_target (1 byte) - loop control
;
; Modified by:
;   init_screen ($0850)
;   advance_row ($0870)
```

---

## 8. Configuration

### 8.1 SMC Options

```typescript
/**
 * SMC configuration options.
 */
export interface SMCConfig {
  /** Enable SMC optimization */
  enabled: boolean;
  
  /** Minimum benefit (cycles) to apply SMC */
  minBenefit: number;
  
  /** Allow SMC in loops only */
  loopsOnly: boolean;
  
  /** Generate debug verification */
  debugMode: boolean;
  
  /** Emit SMC location listing */
  emitListing: boolean;
}

/**
 * Default SMC configuration.
 */
const defaultSMCConfig: SMCConfig = {
  enabled: false,       // Opt-in only
  minBenefit: 50,       // At least 50 cycles saved
  loopsOnly: true,      // Only in loops
  debugMode: false,     // No debug overhead
  emitListing: true,    // Document SMC locations
};
```

---

## 9. Warnings and Limitations

### 9.1 Compiler Warnings

```typescript
/**
 * SMC-related warnings.
 */
export const SMCWarnings = {
  ROM_LOCATION: 'SMC attempted in ROM region - ignored',
  INTERRUPT_CONTEXT: 'SMC in interrupt handler - potential race condition',
  RELOCATION_CONFLICT: 'SMC in relocatable section - may break if moved',
  LOW_BENEFIT: 'SMC benefit below threshold - skipped',
  DEBUG_OVERHEAD: 'SMC debug mode adds runtime overhead',
};
```

### 9.2 Documentation Output

```asm
; ============================================
; SELF-MODIFYING CODE WARNING
; ============================================
; This code contains self-modifying instructions.
; It will NOT work correctly:
;   - In ROM
;   - With code relocation
;   - On some emulators (enable SMC support)
;   - With memory-mapped debugging
;
; SMC Locations:
;   screen_ptr at $0810 (2 bytes)
;   color_ptr at $0820 (2 bytes)
; ============================================
```

---

## Success Criteria

- [ ] Address modification SMC pattern
- [ ] Opcode modification pattern (toggle)
- [ ] Safety checks (ROM, interrupts, relocation)
- [ ] Minimum benefit threshold
- [ ] -Osmc flag enables SMC
- [ ] Debug mode with verification
- [ ] SMC location listing in output
- [ ] Clear warnings about limitations
- [ ] ~15 tests passing for SMC

---

**Previous Document**: [05-size-opt.md](05-size-opt.md)  
**Next Document**: [99-phase-tasks.md](99-phase-tasks.md)  
**Parent**: [00-phase-index.md](00-phase-index.md)