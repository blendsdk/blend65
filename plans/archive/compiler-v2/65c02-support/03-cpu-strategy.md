# CPU Instruction Set Strategy

> **Document**: 03-cpu-strategy.md
> **Parent**: [Index](00-index.md)

## Overview

The `CpuInstructionSet` is an abstract base class that encapsulates CPU-specific instruction patterns. Each CPU variant (6502, 65C02) provides its own implementation.

## Architecture

```
CpuInstructionSet (abstract)
├── Cpu6502InstructionSet
└── Cpu65C02InstructionSet
```

## CpuInstructionSet Interface

```typescript
// codegen/cpu/types.ts
export type CpuTarget = '6502' | '65c02';

// codegen/cpu/cpu-instruction-set.ts
export abstract class CpuInstructionSet {
  abstract readonly target: CpuTarget;

  /** Store zero to memory (STZ on 65C02, LDA #0 + STA on 6502) */
  abstract emitStoreZero(asm: AsmILBuilder, address: number, isZp: boolean, comment?: string): void;

  /** Unconditional branch (BRA on 65C02, JMP on 6502) */
  abstract emitBranchAlways(asm: AsmILBuilder, label: string, comment?: string): void;

  /** Increment accumulator (INA on 65C02, CLC+ADC #1 on 6502) */
  abstract emitIncrementA(asm: AsmILBuilder, comment?: string): void;

  /** Decrement accumulator (DEA on 65C02, SEC+SBC #1 on 6502) */
  abstract emitDecrementA(asm: AsmILBuilder, comment?: string): void;

  /** Push X register (PHX on 65C02, TXA+PHA on 6502) */
  abstract emitPushX(asm: AsmILBuilder, comment?: string): void;

  /** Pull X register (PLX on 65C02, PLA+TAX on 6502) */
  abstract emitPullX(asm: AsmILBuilder, comment?: string): void;

  /** Push Y register (PHY on 65C02, TYA+PHA on 6502) */
  abstract emitPushY(asm: AsmILBuilder, comment?: string): void;

  /** Pull Y register (PLY on 65C02, PLA+TAY on 6502) */
  abstract emitPullY(asm: AsmILBuilder, comment?: string): void;
}
```

## 6502 Implementation

```typescript
// codegen/cpu/cpu-6502.ts
export class Cpu6502InstructionSet extends CpuInstructionSet {
  readonly target: CpuTarget = '6502';

  emitStoreZero(asm, address, isZp, comment?) {
    asm.lda(0, comment);           // LDA #0
    const mode = isZp ? AsmAddressingMode.ZeroPage : AsmAddressingMode.Absolute;
    asm.sta(address, mode);        // STA addr
  }

  emitBranchAlways(asm, label, comment?) {
    asm.jmp(label, false, comment); // JMP label
  }

  emitIncrementA(asm, comment?) {
    asm.clc();                      // CLC
    asm.instruction('ADC', AsmAddressingMode.Immediate, 1, undefined, comment); // ADC #1
  }

  emitDecrementA(asm, comment?) {
    asm.sec();                      // SEC
    asm.instruction('SBC', AsmAddressingMode.Immediate, 1, undefined, comment); // SBC #1
  }

  emitPushX(asm, comment?) {
    asm.txa(comment);               // TXA
    asm.pha();                      // PHA
  }

  emitPullX(asm, comment?) {
    asm.pla();                      // PLA
    asm.tax(comment);               // TAX
  }

  emitPushY(asm, comment?) {
    asm.tya(comment);               // TYA
    asm.pha();                      // PHA
  }

  emitPullY(asm, comment?) {
    asm.pla();                      // PLA
    asm.tay(comment);               // TAY
  }
}
```

## 65C02 Implementation

```typescript
// codegen/cpu/cpu-65c02.ts
export class Cpu65C02InstructionSet extends CpuInstructionSet {
  readonly target: CpuTarget = '65c02';

  emitStoreZero(asm, address, isZp, comment?) {
    const mode = isZp ? AsmAddressingMode.ZeroPage : AsmAddressingMode.Absolute;
    asm.instruction('STZ', mode, address, undefined, comment); // STZ addr
  }

  emitBranchAlways(asm, label, comment?) {
    asm.instruction('BRA', AsmAddressingMode.Relative, undefined, label, comment); // BRA label
  }

  emitIncrementA(asm, comment?) {
    asm.instruction('INC', AsmAddressingMode.Accumulator, undefined, undefined, comment); // INC A (INA)
  }

  emitDecrementA(asm, comment?) {
    asm.instruction('DEC', AsmAddressingMode.Accumulator, undefined, undefined, comment); // DEC A (DEA)
  }

  emitPushX(asm, comment?) {
    asm.instruction('PHX', AsmAddressingMode.Implied, undefined, undefined, comment); // PHX
  }

  emitPullX(asm, comment?) {
    asm.instruction('PLX', AsmAddressingMode.Implied, undefined, undefined, comment); // PLX
  }

  emitPushY(asm, comment?) {
    asm.instruction('PHY', AsmAddressingMode.Implied, undefined, undefined, comment); // PHY
  }

  emitPullY(asm, comment?) {
    asm.instruction('PLY', AsmAddressingMode.Implied, undefined, undefined, comment); // PLY
  }
}
```

## Factory

```typescript
// codegen/cpu/index.ts
export function createCpuInstructionSet(target: CpuTarget): CpuInstructionSet {
  switch (target) {
    case '6502': return new Cpu6502InstructionSet();
    case '65c02': return new Cpu65C02InstructionSet();
    default: throw new Error(`Unknown CPU target: ${target}`);
  }
}
```

## Integration into Codegen

The `CodeGeneratorBase` receives the strategy:

```typescript
// In base.ts constructor:
constructor(moduleName: string = 'main', cpuTarget: CpuTarget = '6502') {
  this.cpu = createCpuInstructionSet(cpuTarget);
  // ...
}
```

Codegen layers then call `this.cpu.emitStoreZero(...)` etc. instead of directly emitting multi-instruction sequences.
