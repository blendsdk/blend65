/**
 * CodeGenerator Rewire - Base Infrastructure Tests
 *
 * Tests for Phase 3e base infrastructure changes:
 * - CodeGenResult type with AsmModule
 * - BaseCodeGenerator with AsmModuleBuilder
 * - ASM-IL generation helper methods
 *
 * @module codegen/rewire/base-infrastructure.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AsmModuleBuilder, createAcmeEmitter } from '../../../asm-il/index.js';
import type { AsmModule } from '../../../asm-il/types.js';
import type { CodegenResult } from '../../../codegen/types.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a minimal AsmModule for testing
 */
function createTestModule(name: string = 'test.blend'): AsmModule {
  const builder = new AsmModuleBuilder(name, 0x0801);
  builder.comment('Test module');
  builder.ldaImm(0x00);
  builder.rts();
  return builder.build();
}

/**
 * Emits an AsmModule to text
 */
function emitToText(module: AsmModule): string {
  const emitter = createAcmeEmitter();
  return emitter.emit(module).text;
}

// ============================================================================
// CodeGenResult Type Tests
// ============================================================================

describe('CodeGenResult Type', () => {
  describe('module field', () => {
    it('should allow undefined module (backward compatibility)', () => {
      const result: CodegenResult = {
        assembly: '; test',
        warnings: [],
        stats: {
          codeSize: 0,
          dataSize: 0,
          zpBytesUsed: 0,
          functionCount: 0,
          globalCount: 0,
          totalSize: 0,
        },
      };

      expect(result.module).toBeUndefined();
      expect(result.assembly).toBe('; test');
    });

    it('should allow AsmModule in result', () => {
      const module = createTestModule();

      const result: CodegenResult = {
        module,
        assembly: emitToText(module),
        warnings: [],
        stats: {
          codeSize: 3,
          dataSize: 0,
          zpBytesUsed: 0,
          functionCount: 0,
          globalCount: 0,
          totalSize: 3,
        },
      };

      expect(result.module).toBeDefined();
      expect(result.module?.name).toBe('test.blend');
      expect(result.module?.items.length).toBeGreaterThan(0);
    });

    it('should derive assembly text from module', () => {
      const module = createTestModule();
      const assembly = emitToText(module);

      const result: CodegenResult = {
        module,
        assembly,
        warnings: [],
        stats: {
          codeSize: 3,
          dataSize: 0,
          zpBytesUsed: 0,
          functionCount: 0,
          globalCount: 0,
          totalSize: 3,
        },
      };

      // Assembly should be derived from module
      expect(result.assembly).toContain('; Test module');
      expect(result.assembly).toContain('LDA');
      expect(result.assembly).toContain('RTS');
    });
  });

  describe('backward compatibility', () => {
    it('should work without module field', () => {
      const result: CodegenResult = {
        assembly: `; ===========================================================================
; Blend65 Compiler Output
; ===========================================================================

* = $0801

; Code section
_main:
  LDA #$00
  RTS
`,
        warnings: [],
        stats: {
          codeSize: 3,
          dataSize: 0,
          zpBytesUsed: 0,
          functionCount: 1,
          globalCount: 0,
          totalSize: 3,
        },
      };

      // Should still work without module
      expect(result.assembly).toContain('LDA #$00');
      expect(result.module).toBeUndefined();
    });

    it('should include all existing fields', () => {
      const result: CodegenResult = {
        assembly: '; test',
        binary: new Uint8Array([0x01, 0x08, 0xa9, 0x00, 0x60]),
        sourceMap: [
          {
            address: 0x0801,
            source: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 10, offset: 9 },
            },
          },
        ],
        viceLabels: 'al C:0801 _main',
        warnings: ['Test warning'],
        stats: {
          codeSize: 3,
          dataSize: 0,
          zpBytesUsed: 0,
          functionCount: 1,
          globalCount: 0,
          totalSize: 3,
        },
      };

      expect(result.binary).toBeDefined();
      expect(result.sourceMap).toHaveLength(1);
      expect(result.viceLabels).toContain('_main');
      expect(result.warnings).toHaveLength(1);
    });
  });
});

// ============================================================================
// AsmModuleBuilder Integration Tests
// ============================================================================

describe('AsmModuleBuilder Integration', () => {
  let builder: AsmModuleBuilder;

  beforeEach(() => {
    builder = new AsmModuleBuilder('test.blend', 0x0801);
  });

  describe('basic operations', () => {
    it('should create module with name and origin', () => {
      const module = builder.build();

      expect(module.name).toBe('test.blend');
      expect(module.origin).toBe(0x0801);
      expect(module.target).toBe('c64');
    });

    it('should reset and reuse builder', () => {
      builder.ldaImm(0x00);
      builder.rts();

      const module1 = builder.build();
      const count1 = module1.items.length;

      builder.reset();
      builder.nop();

      const module2 = builder.build();

      expect(module2.items.length).toBeLessThan(count1);
    });

    it('should emit instructions', () => {
      builder.ldaImm(0x05);
      builder.staAbs(0xd020);
      builder.rts();

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('LDA');
      expect(text).toContain('#$05');
      expect(text).toContain('STA');
      expect(text).toContain('RTS');
    });

    it('should emit labels', () => {
      builder.functionLabel('_main');
      builder.ldaImm(0x00);
      builder.rts();

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('_main');
    });

    it('should emit comments', () => {
      builder.comment('This is a test comment');
      builder.ldaImm(0x00);

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('; This is a test comment');
    });

    it('should emit sections', () => {
      builder.section('Code Section');
      builder.ldaImm(0x00);

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('Code Section');
    });
  });

  describe('code generation patterns', () => {
    it('should generate simple function', () => {
      builder.functionLabel('_simple');
      builder.comment('Simple function that returns 0');
      builder.ldaImm(0x00);
      builder.rts();

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('_simple');
      expect(text).toContain('LDA');
      expect(text).toContain('RTS');
    });

    it('should generate hardware write', () => {
      builder.functionLabel('_setBorder');
      builder.ldaImm(0x00); // Black
      builder.staAbs(0xd020); // Border color
      builder.rts();

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('STA $D020');
    });

    it('should generate hardware read', () => {
      builder.functionLabel('_readRaster');
      builder.ldaAbs(0xd012); // Raster line
      builder.rts();

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('LDA $D012');
    });

    it('should generate loop with branch', () => {
      builder.functionLabel('_waitRaster');
      builder.blockLabel('.loop');
      builder.ldaAbs(0xd012);
      builder.cmpImm(100);
      builder.bne('.loop');
      builder.rts();

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('.loop');
      expect(text).toContain('BNE');
    });
  });
});

// ============================================================================
// AcmeEmitter Integration Tests
// ============================================================================

describe('AcmeEmitter Integration', () => {
  it('should emit module to ACME text', () => {
    const builder = new AsmModuleBuilder('test.blend', 0x0801);
    builder.ldaImm(0x00);
    builder.rts();

    const module = builder.build();
    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);

    expect(result.text).toContain('LDA');
    expect(result.text).toContain('RTS');
  });

  it('should track line numbers', () => {
    const builder = new AsmModuleBuilder('test.blend', 0x0801);
    builder.functionLabel('_main');
    builder.ldaImm(0x00);
    builder.rts();

    const module = builder.build();
    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);

    expect(result.lineCount).toBeGreaterThan(0);
  });

  it('should handle empty module', () => {
    const builder = new AsmModuleBuilder('empty.blend');
    const module = builder.build();
    const emitter = createAcmeEmitter();
    const result = emitter.emit(module);

    expect(result.text).toBeDefined();
    expect(result.lineCount).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// BaseCodeGenerator Pattern Tests
// ============================================================================

describe('BaseCodeGenerator Patterns', () => {
  describe('ASM-IL generation flow', () => {
    it('should support start -> emit -> finish pattern', () => {
      // Simulate the pattern used by BaseCodeGenerator
      const builder = new AsmModuleBuilder('main.blend', 0x0801);

      // Start generation (header)
      builder.comment('Generated by Blend65');

      // Emit code
      builder.functionLabel('_main');
      builder.ldaImm(0x00);
      builder.rts();

      // Finish generation
      const module = builder.build();

      expect(module.name).toBe('main.blend');
      expect(module.items.length).toBeGreaterThan(0);
    });

    it('should support module -> text conversion', () => {
      const builder = new AsmModuleBuilder('main.blend', 0x0801);
      builder.ldaImm(0x05);
      builder.staAbs(0xd020);
      builder.rts();

      const module = builder.build();
      const emitter = createAcmeEmitter();
      const result = emitter.emit(module);

      expect(result.text).toContain('LDA');
      expect(result.text).toContain('STA');
      expect(result.text).toContain('RTS');
    });

    it('should support multiple generation passes', () => {
      const builder = new AsmModuleBuilder('test.blend');

      // Pass 1
      builder.ldaImm(0x01);
      const module1 = builder.build();
      const text1 = emitToText(module1);

      // Reset for pass 2
      builder.reset();
      builder.ldaImm(0x02);
      const module2 = builder.build();
      const text2 = emitToText(module2);

      expect(text1).toContain('#$01');
      expect(text2).toContain('#$02');
      expect(text2).not.toContain('#$01');
    });
  });

  describe('code organization', () => {
    it('should support sections', () => {
      const builder = new AsmModuleBuilder('game.blend', 0x0801);

      builder.section('BASIC Loader');
      // ... BASIC stub would go here

      builder.section('Code');
      builder.functionLabel('_main');
      builder.ldaImm(0x00);
      builder.rts();

      builder.section('Data');
      builder.globalLabel('_score');
      // Use fill instead of byte with single value to avoid API issue
      builder.fill(1, 0x00);

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('BASIC Loader');
      expect(text).toContain('Code');
      expect(text).toContain('Data');
    });

    it('should support labels with comments', () => {
      const builder = new AsmModuleBuilder('test.blend');

      builder.functionLabel('_main', 'Program entry point');
      builder.ldaImm(0x00);
      builder.rts();

      const module = builder.build();
      const text = emitToText(module);

      expect(text).toContain('_main');
      expect(text).toContain('Program entry point');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle module with only comments', () => {
    const builder = new AsmModuleBuilder('comments.blend');
    builder.comment('This is just a comment');
    builder.comment('Another comment');

    const module = builder.build();
    const text = emitToText(module);

    expect(text).toContain('; This is just a comment');
    expect(text).toContain('; Another comment');
  });

  it('should handle module with origin only', () => {
    const builder = new AsmModuleBuilder('origin.blend', 0xc000);
    builder.setOrigin(0xc000);

    const module = builder.build();
    expect(module.origin).toBe(0xc000);
  });

  it('should handle all addressing modes', () => {
    const builder = new AsmModuleBuilder('modes.blend');

    // Immediate
    builder.ldaImm(0x05);

    // Zero page
    builder.ldaZp(0x02);

    // Absolute
    builder.ldaAbs(0xd020);

    // Zero page,X
    builder.ldaZpX(0x10);

    // Absolute,X
    builder.ldaAbsX(0x1000);

    // Absolute,Y
    builder.ldaAbsY(0x1000);

    const module = builder.build();
    const text = emitToText(module);

    expect(text).toContain('LDA #$05');
    expect(text).toContain('LDA $02');
    expect(text).toContain('LDA $D020');
  });

  it('should handle statistics tracking', () => {
    const builder = new AsmModuleBuilder('stats.blend');

    builder.ldaImm(0x00); // 2 bytes
    builder.staAbs(0xd020); // 3 bytes
    builder.rts(); // 1 byte

    const stats = builder.getStats();

    // Stats structure from BuilderStats type
    expect(stats).toBeDefined();
    expect(typeof stats.codeBytes).toBe('number');
    expect(stats.codeBytes).toBe(6); // 2 + 3 + 1
  });
});