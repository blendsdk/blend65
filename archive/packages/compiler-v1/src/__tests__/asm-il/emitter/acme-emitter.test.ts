/**
 * ACME Emitter Tests
 *
 * Tests for AcmeEmitter: assembly text serialization,
 * addressing mode formatting, and source map generation.
 *
 * @module __tests__/asm-il/emitter/acme-emitter.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AcmeEmitter, createAcmeEmitter } from '../../../asm-il/emitters/acme-emitter.js';
import { AsmModuleBuilder } from '../../../asm-il/builder/module-builder.js';
import { AddressingMode, DataType, LabelType } from '../../../asm-il/types.js';
import type { AsmModule, AsmInstruction, AsmLabel, AsmData, AsmComment, AsmOrigin } from '../../../asm-il/types.js';
import type { AcmeEmitterConfig } from '../../../asm-il/emitters/types.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a simple test module
 */
function createTestModule(): AsmModule {
  return new AsmModuleBuilder('test.blend')
    .functionLabel('_main')
    .ldaImm(0x05)
    .staAbs(0xD020)
    .rts()
    .build();
}

/**
 * Create emitter with custom config
 */
function createEmitter(config?: Partial<AcmeEmitterConfig>): AcmeEmitter {
  return createAcmeEmitter(config);
}

// ============================================================================
// CONSTRUCTION TESTS
// ============================================================================

describe('AcmeEmitter construction', () => {
  it('should create with factory function', () => {
    const emitter = createAcmeEmitter();
    expect(emitter).toBeInstanceOf(AcmeEmitter);
  });

  it('should create with constructor', () => {
    const emitter = new AcmeEmitter();
    expect(emitter).toBeInstanceOf(AcmeEmitter);
  });

  it('should accept partial config', () => {
    const emitter = createAcmeEmitter({
      uppercaseMnemonics: false,
      includeComments: false,
    });
    expect(emitter).toBeInstanceOf(AcmeEmitter);
  });
});

// ============================================================================
// BASIC EMIT TESTS
// ============================================================================

describe('Basic emit functionality', () => {
  let emitter: AcmeEmitter;

  beforeEach(() => {
    emitter = createAcmeEmitter();
  });

  it('should emit module to text', () => {
    const module = createTestModule();
    const result = emitter.emit(module);

    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should include origin directive', () => {
    const module = createTestModule();
    const result = emitter.emit(module);

    expect(result.text).toContain('*=');
    expect(result.text).toContain('$0801');
  });

  it('should track line count', () => {
    const module = createTestModule();
    const result = emitter.emit(module);

    expect(result.lineCount).toBeGreaterThan(0);
  });

  it('should track total bytes', () => {
    const module = createTestModule();
    const result = emitter.emit(module);

    expect(result.totalBytes).toBeGreaterThan(0);
  });

  it('should provide source map', () => {
    const module = createTestModule();
    const result = emitter.emit(module);

    expect(result.sourceMap).toBeInstanceOf(Map);
  });
});

// ============================================================================
// INSTRUCTION EMISSION TESTS
// ============================================================================

describe('Instruction emission', () => {
  let emitter: AcmeEmitter;

  beforeEach(() => {
    emitter = createAcmeEmitter();
  });

  describe('Implied mode', () => {
    it('should emit RTS', () => {
      const module = new AsmModuleBuilder('test.blend').rts().build();
      const result = emitter.emit(module);

      expect(result.text).toContain('RTS');
    });

    it('should emit NOP', () => {
      const module = new AsmModuleBuilder('test.blend').nop().build();
      const result = emitter.emit(module);

      expect(result.text).toContain('NOP');
    });
  });

  describe('Immediate mode', () => {
    it('should emit LDA #$xx', () => {
      const module = new AsmModuleBuilder('test.blend').ldaImm(0x42).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA #$42');
    });

    it('should format hex with leading zeros', () => {
      const module = new AsmModuleBuilder('test.blend').ldaImm(0x05).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA #$05');
    });
  });

  describe('Zero page mode', () => {
    it('should emit LDA $xx', () => {
      const module = new AsmModuleBuilder('test.blend').ldaZp(0x10).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA $10');
    });
  });

  describe('Zero page,X mode', () => {
    it('should emit LDA $xx,X', () => {
      const module = new AsmModuleBuilder('test.blend').ldaZpX(0x20).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA $20,X');
    });
  });

  describe('Absolute mode', () => {
    it('should emit LDA $xxxx', () => {
      const module = new AsmModuleBuilder('test.blend').ldaAbs(0x1234).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA $1234');
    });

    it('should emit STA $xxxx', () => {
      const module = new AsmModuleBuilder('test.blend').staAbs(0xD020).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('STA $D020');
    });

    it('should emit with label operand', () => {
      const module = new AsmModuleBuilder('test.blend').ldaAbs('_counter').build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA _counter');
    });
  });

  describe('Absolute,X mode', () => {
    it('should emit LDA $xxxx,X', () => {
      const module = new AsmModuleBuilder('test.blend').ldaAbsX(0x1000).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA $1000,X');
    });
  });

  describe('Absolute,Y mode', () => {
    it('should emit LDA $xxxx,Y', () => {
      const module = new AsmModuleBuilder('test.blend').ldaAbsY(0x1000).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA $1000,Y');
    });
  });

  describe('Indirect,X mode', () => {
    it('should emit LDA ($xx,X)', () => {
      const module = new AsmModuleBuilder('test.blend').ldaIndX(0x80).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA ($80,X)');
    });
  });

  describe('Indirect,Y mode', () => {
    it('should emit LDA ($xx),Y', () => {
      const module = new AsmModuleBuilder('test.blend').ldaIndY(0x80).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA ($80),Y');
    });
  });

  describe('Relative mode (branches)', () => {
    it('should emit BNE with label', () => {
      const module = new AsmModuleBuilder('test.blend')
        .blockLabel('.loop')
        .ldaImm(0x00)
        .bne('.loop')
        .build();
      const result = emitter.emit(module);

      expect(result.text).toContain('BNE .loop');
    });
  });

  describe('Indirect mode (JMP)', () => {
    it('should emit JMP ($xxxx)', () => {
      const module = new AsmModuleBuilder('test.blend').jmpInd(0x0314).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('JMP ($0314)');
    });
  });
});

// ============================================================================
// LABEL EMISSION TESTS
// ============================================================================

describe('Label emission', () => {
  let emitter: AcmeEmitter;

  beforeEach(() => {
    emitter = createAcmeEmitter();
  });

  it('should emit function label', () => {
    const module = new AsmModuleBuilder('test.blend')
      .functionLabel('_main')
      .rts()
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('_main');
  });

  it('should emit block label with dot prefix', () => {
    const module = new AsmModuleBuilder('test.blend')
      .blockLabel('.loop')
      .rts()
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('.loop');
  });

  it('should emit exported label with + prefix', () => {
    const module = new AsmModuleBuilder('test.blend')
      .functionLabel('_main', 'Entry point', true)
      .rts()
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('+_main');
  });
});

// ============================================================================
// DATA EMISSION TESTS
// ============================================================================

describe('Data emission', () => {
  let emitter: AcmeEmitter;

  beforeEach(() => {
    emitter = createAcmeEmitter();
  });

  it('should emit byte directive', () => {
    const module = new AsmModuleBuilder('test.blend')
      .byte([0x01, 0x02, 0x03])
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('!byte');
    expect(result.text).toContain('$01');
    expect(result.text).toContain('$02');
    expect(result.text).toContain('$03');
  });

  it('should emit word directive', () => {
    const module = new AsmModuleBuilder('test.blend')
      .word([0x1234, 0x5678])
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('!word');
    expect(result.text).toContain('$1234');
    expect(result.text).toContain('$5678');
  });

  it('should emit text directive', () => {
    const module = new AsmModuleBuilder('test.blend')
      .text('HELLO')
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('!text');
    expect(result.text).toContain('"HELLO"');
  });

  it('should emit fill directive', () => {
    const module = new AsmModuleBuilder('test.blend')
      .fill(256, 0x00)
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('!fill');
    expect(result.text).toContain('256');
  });

  it('should track data bytes', () => {
    const module = new AsmModuleBuilder('test.blend')
      .byte([0x01, 0x02, 0x03]) // 3 bytes
      .word([0x1234]) // 2 bytes
      .build();
    const result = emitter.emit(module);

    expect(result.totalBytes).toBe(5);
  });
});

// ============================================================================
// COMMENT EMISSION TESTS
// ============================================================================

describe('Comment emission', () => {
  let emitter: AcmeEmitter;

  beforeEach(() => {
    emitter = createAcmeEmitter({ includeComments: true });
  });

  it('should emit line comment', () => {
    const module = new AsmModuleBuilder('test.blend')
      .comment('This is a comment')
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('; This is a comment');
  });

  it('should emit section comment', () => {
    const module = new AsmModuleBuilder('test.blend')
      .section('Code Section')
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('; Code Section');
  });

  it('should skip comments when disabled', () => {
    const emitter = createAcmeEmitter({ includeComments: false });
    const module = new AsmModuleBuilder('test.blend')
      .comment('This should be hidden')
      .ldaImm(0x00)
      .build();
    const result = emitter.emit(module);

    expect(result.text).not.toContain('This should be hidden');
  });
});

// ============================================================================
// ORIGIN EMISSION TESTS
// ============================================================================

describe('Origin emission', () => {
  let emitter: AcmeEmitter;

  beforeEach(() => {
    emitter = createAcmeEmitter();
  });

  it('should emit origin directive', () => {
    const module = new AsmModuleBuilder('test.blend')
      .setOrigin(0xC000)
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('*= $C000');
  });

  it('should emit origin with comment', () => {
    const emitter = createAcmeEmitter({ includeComments: true });
    const module = new AsmModuleBuilder('test.blend')
      .setOrigin(0xC000, 'High memory')
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('*= $C000');
    expect(result.text).toContain('High memory');
  });
});

// ============================================================================
// OUTPUT FILE DIRECTIVE TESTS
// ============================================================================

describe('Output file directive', () => {
  it('should emit !to directive when output file set', () => {
    const emitter = createAcmeEmitter();
    const module = new AsmModuleBuilder('test.blend')
      .setOutputFile('game.prg')
      .rts()
      .build();
    const result = emitter.emit(module);

    expect(result.text).toContain('!to "game.prg"');
  });

  it('should not emit !to when no output file', () => {
    const emitter = createAcmeEmitter();
    const module = new AsmModuleBuilder('test.blend')
      .rts()
      .build();
    const result = emitter.emit(module);

    expect(result.text).not.toContain('!to');
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe('Emitter configuration', () => {
  describe('uppercaseMnemonics', () => {
    it('should emit uppercase mnemonics by default', () => {
      const emitter = createAcmeEmitter();
      const module = new AsmModuleBuilder('test.blend').ldaImm(0x00).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA');
    });

    it('should emit lowercase mnemonics when disabled', () => {
      const emitter = createAcmeEmitter({ uppercaseMnemonics: false });
      const module = new AsmModuleBuilder('test.blend').ldaImm(0x00).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('lda');
    });
  });

  describe('hexPrefix', () => {
    it('should use $ prefix by default', () => {
      const emitter = createAcmeEmitter();
      const module = new AsmModuleBuilder('test.blend').ldaImm(0xFF).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('$FF');
    });

    it('should use 0x prefix when configured', () => {
      const emitter = createAcmeEmitter({ hexPrefix: '0x' });
      const module = new AsmModuleBuilder('test.blend').ldaImm(0xFF).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('0xFF');
    });
  });

  describe('includeCycleCounts', () => {
    it('should not include cycle counts by default', () => {
      const emitter = createAcmeEmitter();
      const module = new AsmModuleBuilder('test.blend').ldaImm(0x00).build();
      const result = emitter.emit(module);

      expect(result.text).not.toMatch(/\d+b \d+c/);
    });

    it('should include cycle counts when enabled', () => {
      const emitter = createAcmeEmitter({ includeCycleCounts: true });
      const module = new AsmModuleBuilder('test.blend').ldaImm(0x00).build();
      const result = emitter.emit(module);

      expect(result.text).toContain('2b 2c'); // LDA immediate is 2 bytes, 2 cycles
    });
  });
});

// ============================================================================
// SOURCE MAP TESTS
// ============================================================================

describe('Source map generation', () => {
  it('should map lines to source locations', () => {
    const location = {
      start: { line: 10, column: 5, offset: 100 },
      end: { line: 10, column: 20, offset: 115 },
      file: 'test.blend',
    };

    const emitter = createAcmeEmitter();
    const module = new AsmModuleBuilder('test.blend')
      .setLocation(location)
      .ldaImm(0x05)
      .clearLocation()
      .rts()
      .build();
    const result = emitter.emit(module);

    expect(result.sourceMap.size).toBeGreaterThan(0);
  });
});

// ============================================================================
// COMPLETE PROGRAM TESTS
// ============================================================================

describe('Complete program emission', () => {
  it('should emit a complete hello world program', () => {
    const emitter = createAcmeEmitter({ includeComments: true });
    const module = new AsmModuleBuilder('hello.blend')
      .setOutputFile('hello.prg')
      .header()
      .setOrigin(0x0801)
      .functionLabel('_main', 'Entry point')
      .ldaImm(0x00)
      .staAbs(0xD020)
      .staAbs(0xD021)
      .rts()
      .footer()
      .build();

    const result = emitter.emit(module);

    expect(result.text).toContain('!to "hello.prg"');
    expect(result.text).toContain('*= $0801');
    expect(result.text).toContain('_main');
    expect(result.text).toContain('LDA #$00');
    expect(result.text).toContain('STA $D020');
    expect(result.text).toContain('RTS');
    expect(result.lineCount).toBeGreaterThan(10);
  });

  it('should produce valid ACME assembly structure', () => {
    const emitter = createAcmeEmitter();
    const module = new AsmModuleBuilder('test.blend')
      .setOrigin(0x0801)
      .functionLabel('_main')
      .ldaImm(0x05)
      .blockLabel('.loop')
      .sec()
      .sbcImm(0x01)
      .bne('.loop')
      .rts()
      .globalLabel('_counter')
      .byte([0x00])
      .build();

    const result = emitter.emit(module);

    // Should have origin at start
    const lines = result.text.split('\n');
    const originLine = lines.find((l) => l.includes('*='));
    expect(originLine).toBeDefined();

    // Should have labels
    expect(result.text).toContain('_main');
    expect(result.text).toContain('.loop');
    expect(result.text).toContain('_counter');

    // Should have instructions
    expect(result.text).toContain('LDA');
    expect(result.text).toContain('SEC');
    expect(result.text).toContain('SBC');
    expect(result.text).toContain('BNE');
    expect(result.text).toContain('RTS');

    // Should have data
    expect(result.text).toContain('!byte');
  });
});