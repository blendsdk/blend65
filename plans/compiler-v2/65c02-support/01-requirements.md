# Requirements: 65C02 Multi-CPU Support

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Add CPU target awareness to the Blend65 v2 code generator so the X16 platform (65C02 CPU) generates optimized assembly using 65C02-specific instructions, while C64 (6502) continues generating standard 6502 code.

## Functional Requirements

### Must Have

- [ ] `CpuTarget` type: `'6502' | '65c02'`
- [ ] `CpuInstructionSet` abstract base class with CPU-specific method signatures
- [ ] `Cpu6502InstructionSet` — standard 6502 instruction patterns
- [ ] `Cpu65C02InstructionSet` — 65C02 optimized instruction patterns
- [ ] `PlatformConfig.cpuTarget` field on all platform configs
- [ ] ASM-IL builder supports 65C02 mnemonics (`STZ`, `BRA`, `PHX`, `PLX`, `PHY`, `PLY`, `INA`, `DEA`)
- [ ] Code generator accepts `CpuInstructionSet` via constructor/options
- [ ] All codegen layers delegate CPU-specific operations to the strategy
- [ ] All existing 6502 tests continue to pass unchanged
- [ ] New tests for 65C02 code paths

### Should Have

- [ ] Factory function: `createCpuInstructionSet(cpuTarget)` 
- [ ] `CodeGenerator` constructor accepts `CodegenOptions` with `cpuTarget`

### Won't Have (Out of Scope)

- 65816 support
- Platform-specific IL opcodes
- Platform-specific semantic analysis
- Bank switching for X16

## Acceptance Criteria

1. [ ] C64 compilation produces identical output to current (no regression)
2. [ ] X16 compilation produces 65C02-optimized output
3. [ ] All existing 6272+ tests pass
4. [ ] New 65C02-specific tests pass
5. [ ] Strategy pattern cleanly separates CPU concerns
