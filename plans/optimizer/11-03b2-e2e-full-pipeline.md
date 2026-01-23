# 11-03b2: E2E Full Compiler Pipeline Tests

> **Document ID**: 11-03b2-e2e-full-pipeline
> **Phase**: 11 - Testing Framework
> **Task**: 11.3b2 - E2E full compiler pipeline tests
> **Priority**: High
> **Estimated LOC**: 250-300

---

## Overview

This document specifies end-to-end testing for the complete compiler pipeline from Blend65 source through to final 6502 assembly output. Tests verify the entire compilation chain works correctly together.

### Goals

1. Test complete source-to-assembly pipeline
2. Verify code generation produces correct 6502 code
3. Test target emitter integration
4. Validate final output is executable
5. Detect end-to-end integration issues

---

## Type Definitions

```typescript
/**
 * Full pipeline test configuration
 */
interface FullPipelineTestConfig {
  /** Test identifier */
  testId: string;
  /** Blend65 source code */
  source: string;
  /** Target platform */
  target: TargetPlatform;
  /** Compiler options */
  options?: CompilerOptions;
  /** Optimization level */
  optimizationLevel: OptimizationLevel;
  /** Output format */
  outputFormat: 'asm' | 'prg';
  /** Assertions on final output */
  assertions: FullPipelineAssertion[];
}

/**
 * Target platform
 */
type TargetPlatform = 'c64' | 'c128' | 'x16';

/**
 * Full pipeline assertions
 */
interface FullPipelineAssertion {
  type: FullPipelineAssertionType;
  params: Record<string, unknown>;
  description: string;
}

type FullPipelineAssertionType =
  | 'compiles_to_asm'         // Produces valid assembly
  | 'compiles_to_prg'         // Produces valid PRG
  | 'output_size_under'       // Binary size under limit
  | 'contains_instruction'    // Assembly contains instruction
  | 'no_instruction'          // Assembly lacks instruction
  | 'entry_point_correct'     // Entry point is set
  | 'hardware_init_present'   // VIC/SID init code present
  | 'valid_6502_code'         // All instructions valid
  | 'custom';

/**
 * Full pipeline result
 */
interface FullPipelineResult {
  testId: string;
  passed: boolean;
  duration: number;
  phases: PipelinePhaseResult[];
  output?: CompilerOutput;
  assertionResults: AssertionResult[];
  error?: Error;
}

/**
 * Individual phase result
 */
interface PipelinePhaseResult {
  phase: 'lexer' | 'parser' | 'semantic' | 'il_gen' | 'optimizer' | 'codegen' | 'emitter';
  success: boolean;
  duration: number;
  errors: string[];
}

/**
 * Final compiler output
 */
interface CompilerOutput {
  format: 'asm' | 'prg';
  content: string | Uint8Array;
  size: number;
  entryPoint?: number;
  symbols?: Map<string, number>;
}
```

---

## Implementation

### Full Pipeline Test Runner

```typescript
/**
 * End-to-end test runner for full compiler pipeline
 */
export class FullPipelineTestRunner {
  protected compiler: Blend65Compiler;
  
  constructor() {
    this.compiler = new Blend65Compiler();
  }
  
  /**
   * Run full pipeline test
   */
  async runTest(config: FullPipelineTestConfig): Promise<FullPipelineResult> {
    const startTime = Date.now();
    const phases: PipelinePhaseResult[] = [];
    
    try {
      // Run complete compilation
      const output = await this.compiler.compileToTarget(config.source, {
        target: config.target,
        optimizationLevel: config.optimizationLevel,
        outputFormat: config.outputFormat,
        ...config.options
      });
      
      // Collect phase results
      phases.push(...this.compiler.getPhaseResults());
      
      // Run assertions
      const assertionResults = this.runAssertions(config.assertions, output);
      
      return {
        testId: config.testId,
        passed: assertionResults.every(r => r.passed),
        duration: Date.now() - startTime,
        phases,
        output,
        assertionResults
      };
    } catch (error) {
      return {
        testId: config.testId,
        passed: false,
        duration: Date.now() - startTime,
        phases,
        assertionResults: [{
          description: 'Compilation should complete',
          passed: false,
          message: (error as Error).message
        }],
        error: error as Error
      };
    }
  }
  
  /**
   * Run assertions
   */
  protected runAssertions(
    assertions: FullPipelineAssertion[],
    output: CompilerOutput
  ): AssertionResult[] {
    return assertions.map(a => this.runAssertion(a, output));
  }
  
  /**
   * Run single assertion
   */
  protected runAssertion(
    assertion: FullPipelineAssertion,
    output: CompilerOutput
  ): AssertionResult {
    switch (assertion.type) {
      case 'compiles_to_asm':
        return {
          description: assertion.description,
          passed: output.format === 'asm' && typeof output.content === 'string' && output.content.length > 0
        };
      
      case 'compiles_to_prg':
        return {
          description: assertion.description,
          passed: output.format === 'prg' && output.content instanceof Uint8Array
        };
      
      case 'output_size_under':
        const maxSize = assertion.params.bytes as number;
        return {
          description: assertion.description,
          passed: output.size <= maxSize,
          message: output.size > maxSize ? `Size ${output.size} exceeds ${maxSize}` : undefined
        };
      
      case 'contains_instruction':
        const instr = assertion.params.instruction as string;
        const hasInstr = typeof output.content === 'string' && output.content.includes(instr);
        return {
          description: assertion.description,
          passed: hasInstr
        };
      
      case 'no_instruction':
        const noInstr = assertion.params.instruction as string;
        const lacksInstr = typeof output.content === 'string' && !output.content.includes(noInstr);
        return {
          description: assertion.description,
          passed: lacksInstr
        };
      
      case 'entry_point_correct':
        const expectedEntry = assertion.params.address as number;
        return {
          description: assertion.description,
          passed: output.entryPoint === expectedEntry
        };
      
      case 'valid_6502_code':
        const valid = this.validate6502Code(output);
        return {
          description: assertion.description,
          passed: valid.isValid,
          message: valid.errors.join(', ')
        };
      
      default:
        return {
          description: assertion.description,
          passed: false,
          message: `Unknown assertion: ${assertion.type}`
        };
    }
  }
  
  /**
   * Validate 6502 code
   */
  protected validate6502Code(output: CompilerOutput): { isValid: boolean; errors: string[] } {
    if (typeof output.content !== 'string') {
      return { isValid: true, errors: [] };
    }
    
    const errors: string[] = [];
    const lines = output.content.split('\n');
    const validOpcodes = new Set([
      'LDA', 'LDX', 'LDY', 'STA', 'STX', 'STY',
      'ADC', 'SBC', 'AND', 'ORA', 'EOR', 'CMP', 'CPX', 'CPY',
      'INC', 'DEC', 'INX', 'DEX', 'INY', 'DEY',
      'ASL', 'LSR', 'ROL', 'ROR',
      'TAX', 'TXA', 'TAY', 'TYA', 'TXS', 'TSX',
      'PHA', 'PLA', 'PHP', 'PLP',
      'CLC', 'SEC', 'CLI', 'SEI', 'CLV', 'CLD', 'SED',
      'BEQ', 'BNE', 'BCS', 'BCC', 'BMI', 'BPL', 'BVS', 'BVC',
      'JMP', 'JSR', 'RTS', 'RTI', 'BRK', 'NOP', 'BIT'
    ]);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';') || line.endsWith(':')) continue;
      
      const opcode = line.split(/\s+/)[0].toUpperCase();
      if (opcode && !validOpcodes.has(opcode) && !opcode.startsWith('.')) {
        errors.push(`Line ${i + 1}: Unknown opcode ${opcode}`);
      }
    }
    
    return { isValid: errors.length === 0, errors };
  }
}
```

---

## Usage Examples

```typescript
const runner = new FullPipelineTestRunner();

const result = await runner.runTest({
  testId: 'hello_world',
  source: `
    @map screen at $0400: byte[1000];
    function main(): void {
      screen[0] = 8; // 'H'
    }
  `,
  target: 'c64',
  optimizationLevel: 'standard',
  outputFormat: 'asm',
  assertions: [
    { type: 'compiles_to_asm', params: {}, description: 'Produces assembly' },
    { type: 'valid_6502_code', params: {}, description: 'Valid 6502' },
    { type: 'output_size_under', params: { bytes: 1000 }, description: 'Under 1KB' }
  ]
});
```

---

## Test Requirements

| Test Case | Description | Status |
|-----------|-------------|--------|
| full-hello-world | Hello world compiles | ⏳ |
| full-loop-program | Loop program works | ⏳ |
| full-hardware-access | VIC/SID access works | ⏳ |
| full-prg-output | PRG output valid | ⏳ |
| full-all-targets | All targets work | ⏳ |

---

## Task Checklist

- [ ] 11.3b2.1: Implement `FullPipelineTestRunner`
- [ ] 11.3b2.2: Implement 6502 validation
- [ ] 11.3b2.3: Add target-specific tests
- [ ] 11.3b2.4: Create full pipeline test suite
- [ ] 11.3b2.5: Write unit tests

---

## References

- `11-03a-e2e-compile.md`, `11-03b1-e2e-opt-pipeline.md`, `09-08a-target-interface.md`