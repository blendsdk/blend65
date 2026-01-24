/**
 * ASM-IL Pipeline Integration Tests
 *
 * End-to-end tests for the complete ASM-IL pipeline:
 * Builder → Optimizer → Emitter
 *
 * @module __tests__/asm-il/integration/pipeline.test
 */

import { describe, it, expect } from 'vitest';
import { AsmModuleBuilder } from '../../../asm-il/builder/module-builder.js';
import { AsmOptimizer, createAsmOptimizer } from '../../../asm-il/optimizer/asm-optimizer.js';
import { AcmeEmitter, createAcmeEmitter } from '../../../asm-il/emitters/acme-emitter.js';

// ============================================================================
// FULL PIPELINE TESTS
// ============================================================================

describe('Full ASM-IL pipeline', () => {
  it('should build, optimize, and emit a simple program', () => {
    // Step 1: Build module
    const module = new AsmModuleBuilder('test.blend')
      .setOutputFile('test.prg')
      .setOrigin(0x0801)
      .functionLabel('_main', 'Entry point')
      .ldaImm(0x00)
      .staAbs(0xD020)
      .rts()
      .build();

    // Step 2: Optimize (pass-through)
    const optimizer = createAsmOptimizer({ enabled: false });
    const optimized = optimizer.optimize(module);

    // Step 3: Emit
    const emitter = createAcmeEmitter();
    const result = emitter.emit(optimized.module);

    // Verify
    expect(result.text).toContain('!to "test.prg"');
    expect(result.text).toContain('*= $0801');
    expect(result.text).toContain('_main');
    expect(result.text).toContain('LDA #$00');
    expect(result.text).toContain('STA $D020');
    expect(result.text).toContain('RTS');
    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it('should handle complex program with multiple sections', () => {
    // Build
    const module = new AsmModuleBuilder('game.blend')
      .header()
      .setOrigin(0x0801)
      .section('Initialization')
      .functionLabel('_init')
      .ldaImm(0x00)
      .ldxImm(0xFF)
      .txs()
      .rts()
      .blank()
      .section('Main Loop')
      .functionLabel('_main')
      .jsr('_init')
      .blockLabel('.loop')
      .ldaAbs('_counter')
      .clc()
      .adcImm(0x01)
      .staAbs('_counter')
      .jmp('.loop')
      .blank()
      .section('Data')
      .globalLabel('_counter')
      .byte([0x00])
      .footer()
      .build();

    // Optimize
    const optimizer = createAsmOptimizer({ enabled: true });
    const optimized = optimizer.optimize(module);

    // Emit
    const emitter = createAcmeEmitter({ includeComments: true });
    const result = emitter.emit(optimized.module);

    // Verify structure
    expect(result.text).toContain('_init');
    expect(result.text).toContain('_main');
    expect(result.text).toContain('.loop');
    expect(result.text).toContain('_counter');
    expect(result.lineCount).toBeGreaterThan(20);
  });

  it('should track statistics through pipeline', () => {
    // Build with known sizes
    const builder = new AsmModuleBuilder('stats.blend')
      .functionLabel('_main')
      .ldaImm(0x05) // 2 bytes
      .staZp(0x10) // 2 bytes
      .rts() // 1 byte
      .globalLabel('_data')
      .byte([0x01, 0x02, 0x03]); // 3 bytes

    const builderStats = builder.getStats();
    expect(builderStats.codeBytes).toBe(5);
    expect(builderStats.dataBytes).toBe(3);
    expect(builderStats.functionCount).toBe(1);
    expect(builderStats.globalCount).toBe(1);

    // Build and emit
    const module = builder.build();
    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);

    // Emitter should track bytes
    expect(result.totalBytes).toBe(8); // 5 code + 3 data
  });

  it('should preserve source locations through pipeline', () => {
    const location = {
      start: { line: 5, column: 0, offset: 50 },
      end: { line: 5, column: 20, offset: 70 },
      file: 'test.blend',
    };

    // Build with source location
    const module = new AsmModuleBuilder('test.blend')
      .setLocation(location)
      .ldaImm(0x00)
      .clearLocation()
      .rts()
      .build();

    // Emit
    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);

    // Should have source map
    expect(result.sourceMap.size).toBeGreaterThan(0);
  });
});

// ============================================================================
// PIPELINE COMPONENT TESTS
// ============================================================================

describe('Pipeline component interaction', () => {
  it('should allow module reuse', () => {
    const module = new AsmModuleBuilder('test.blend')
      .ldaImm(0x00)
      .rts()
      .build();

    // Emit multiple times
    const emitter1 = createAcmeEmitter();
    const result1 = emitter1.emit(module);

    const emitter2 = createAcmeEmitter({ uppercaseMnemonics: false });
    const result2 = emitter2.emit(module);

    // Both should work
    expect(result1.text).toContain('LDA');
    expect(result2.text).toContain('lda');
  });

  it('should allow optimizer configuration changes', () => {
    const module = new AsmModuleBuilder('test.blend')
      .ldaImm(0x00)
      .rts()
      .build();

    // Disabled optimizer
    const optimizer1 = createAsmOptimizer({ enabled: false });
    const result1 = optimizer1.optimize(module);
    expect(result1.changed).toBe(false);

    // Enabled optimizer (no passes, so still no change)
    const optimizer2 = createAsmOptimizer({ enabled: true });
    const result2 = optimizer2.optimize(module);
    expect(result2.changed).toBe(false);
  });

  it('should chain builder operations correctly', () => {
    // Full chained construction
    const module = new AsmModuleBuilder('chained.blend')
      .setOutputFile('out.prg')
      .header()
      .setOrigin(0x0801)
      .functionLabel('_main')
      .ldaImm(0x00)
      .ldxImm(0x00)
      .ldyImm(0x00)
      .staAbs(0xD020)
      .stxAbs(0xD021)
      .rts()
      .footer()
      .build();

    expect(module.name).toBe('chained.blend');
    expect(module.outputFile).toBe('out.prg');
    expect(module.labels.has('_main')).toBe(true);
    expect(module.items.length).toBeGreaterThan(10);
  });
});

// ============================================================================
// REALISTIC PROGRAM TESTS
// ============================================================================

describe('Realistic program examples', () => {
  it('should build a border color cycler', () => {
    const module = new AsmModuleBuilder('border.blend')
      .setOrigin(0x0801)
      .functionLabel('_main', 'Border color cycler')
      .blockLabel('.loop')
      .ldaAbs(0xD020)
      .clc()
      .adcImm(0x01)
      .andImm(0x0F)
      .staAbs(0xD020)
      .jmp('.loop')
      .build();

    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);

    expect(result.text).toContain('LDA $D020');
    expect(result.text).toContain('ADC #$01');
    expect(result.text).toContain('AND #$0F');
    expect(result.text).toContain('STA $D020');
    expect(result.text).toContain('JMP .loop');
  });

  it('should build a memory clear routine', () => {
    const module = new AsmModuleBuilder('memclear.blend')
      .setOrigin(0x0801)
      .functionLabel('_memclear', 'Clear 256 bytes at ptr')
      .ldaImm(0x00)
      .ldyImm(0x00)
      .blockLabel('.loop')
      .staIndY(0xFB)
      .iny()
      .bne('.loop')
      .rts()
      .build();

    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);

    expect(result.text).toContain('LDA #$00');
    expect(result.text).toContain('LDY #$00');
    expect(result.text).toContain('STA ($FB),Y');
    expect(result.text).toContain('INY');
    expect(result.text).toContain('BNE .loop');
    expect(result.text).toContain('RTS');
  });

  it('should build a simple counter display', () => {
    const module = new AsmModuleBuilder('counter.blend')
      .setOrigin(0x0801)
      .functionLabel('_main')
      .blockLabel('.mainloop')
      .ldaAbs('_counter')
      .clc()
      .adcImm(0x01)
      .staAbs('_counter')
      .jsr('_display')
      .jmp('.mainloop')
      .blank()
      .functionLabel('_display', 'Display counter value')
      .ldaAbs('_counter')
      .staAbs(0x0400)
      .rts()
      .blank()
      .section('Data')
      .globalLabel('_counter')
      .byte([0x00])
      .build();

    const emitter = createAcmeEmitter({ includeComments: true });
    const result = emitter.emit(module);

    // Should have all components
    expect(result.text).toContain('_main');
    expect(result.text).toContain('_display');
    expect(result.text).toContain('_counter');
    expect(result.text).toContain('JSR _display');
    expect(result.text).toContain('!byte $00');
  });
});