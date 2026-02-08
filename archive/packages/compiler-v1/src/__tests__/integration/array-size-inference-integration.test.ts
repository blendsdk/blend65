/**
 * Array Size Inference Tests - Integration
 *
 * End-to-end integration tests for array size inference feature
 * Tests the complete workflow from source code to semantic analysis
 */

import { describe, it, expect } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SymbolTableBuilder } from '../../semantic/visitors/symbol-table-builder.js';
import { TypeResolver } from '../../semantic/visitors/type-resolver.js';
import { TypeKind } from '../../semantic/types.js';
import { DiagnosticSeverity } from '../../ast/diagnostics.js';
import { isProgram, isVariableDecl } from '../../ast/type-guards.js';

/**
 * Helper to run complete compilation pipeline
 */
function compileSource(source: string) {
  // Lexer
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();

  // Parser
  const parser = new Parser(tokens);
  const program = parser.parse();

  // Semantic Analysis Phase 1: Symbol Table
  const builder = new SymbolTableBuilder();
  builder.walk(program);
  const symbolTable = builder.getSymbolTable();

  // Semantic Analysis Phase 2: Type Resolution
  const resolver = new TypeResolver(symbolTable);
  resolver.walk(program);

  return {
    tokens,
    program,
    symbolTable,
    typeSystem: resolver.getTypeSystem(),
    parserDiagnostics: parser.getDiagnostics(),
    semanticDiagnostics: resolver.getDiagnostics(),
    allDiagnostics: [...parser.getDiagnostics(), ...resolver.getDiagnostics()],
  };
}

describe('Array Size Inference - End-to-End Integration', () => {
  it('should compile simple array with inferred size', () => {
    const source = 'let colors: byte[] = [2, 5, 6];';
    const result = compileSource(source);

    // No errors
    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    // Program parsed correctly
    expect(isProgram(result.program)).toBe(true);

    // Symbol exists with correct type
    const symbol = result.symbolTable.lookup('colors');
    expect(symbol).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Array);
    expect(symbol!.type!.arraySize).toBe(3);
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Byte);
  });

  it('should compile const array with inferred size', () => {
    const source = 'const palette: byte[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];';
    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    const symbol = result.symbolTable.lookup('palette');
    expect(symbol!.type!.arraySize).toBe(16);
  });

  it('should compile array with storage class and inferred size', () => {
    const source = '@data const spriteData: byte[] = [0xFF, 0x3C, 0x18, 0x18, 0x18, 0x3C, 0xFF, 0x00];';
    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    const symbol = result.symbolTable.lookup('spriteData');
    expect(symbol!.type!.arraySize).toBe(8);
  });

  it('should compile exported array with inferred size', () => {
    const source = 'export const sharedTable: word[] = [$D000, $D020, $D400, $DC00];';
    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    const symbol = result.symbolTable.lookup('sharedTable');
    expect(symbol!.type!.arraySize).toBe(4);
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Word);
  });
});

describe('Array Size Inference - Complete C64 Programs', () => {
  it('should compile C64 sprite system with inferred arrays', () => {
    const source = `
      // C64 sprite system with inferred array sizes
      @map spriteEnabled at $D015: byte;
      @map spriteColors from $D027 to $D02E: byte;

      @data const spritePointerOffsets: byte[] = [0, 1, 2, 3, 4, 5, 6, 7];
      
      @data const spriteArrow: byte[] = [
        0b00000001,
        0b00000011,
        0b00000111,
        0b00001111,
        0b00011111,
        0b00001111,
        0b00000111,
        0b00000011
      ];

      function initSprites() {
        let i: byte = 0;
        spriteEnabled = 0xFF;
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    // Verify inferred sizes
    expect(result.symbolTable.lookup('spritePointerOffsets')!.type!.arraySize).toBe(8);
    expect(result.symbolTable.lookup('spriteArrow')!.type!.arraySize).toBe(8);
  });

  it('should compile C64 color system with inferred palettes', () => {
    const source = `
      @map backgroundColor at $D021: byte;
      @map borderColor at $D020: byte;

      const defaultPalette: byte[] = [
        0,   // Black
        1,   // White
        2,   // Red
        3,   // Cyan
        4,   // Purple
        5,   // Green
        6,   // Blue
        7,   // Yellow
        8,   // Orange
        9,   // Brown
        10,  // Light Red
        11,  // Dark Gray
        12,  // Medium Gray
        13,  // Light Green
        14,  // Light Blue
        15   // Light Gray
      ];

      function setPalette(index: byte) {
        backgroundColor = defaultPalette[index];
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);
    expect(result.symbolTable.lookup('defaultPalette')!.type!.arraySize).toBe(16);
  });

  it('should compile C64 SID music system with inferred register arrays', () => {
    const source = `
      @map sidVoice1Freq at $D400: word;
      @map sidVoice1PulseWidth at $D402: word;
      @map sidVoice1Control at $D404: byte;

      @data const noteFrequencies: word[] = [
        0x0111,  // C
        0x0123,  // C#
        0x0137,  // D
        0x014B,  // D#
        0x0161,  // E
        0x0179,  // F
        0x0193,  // F#
        0x01AF,  // G
        0x01CE,  // G#
        0x01F0,  // A
        0x0214,  // A#
        0x023B   // B
      ];

      function playNote(note: byte) {
        sidVoice1Freq = noteFrequencies[note];
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);
    expect(result.symbolTable.lookup('noteFrequencies')!.type!.arraySize).toBe(12);
    expect(result.symbolTable.lookup('noteFrequencies')!.type!.elementType!.kind).toBe(TypeKind.Word);
  });

  it('should compile complete C64 game state with multiple inferred arrays', () => {
    const source = `
      // Game state with inferred arrays
      @zp let playerX: byte = 100;
      @zp let playerY: byte = 100;
      
      let enemyXPositions: byte[] = [50, 100, 150, 200];
      let enemyYPositions: byte[] = [80, 90, 100, 110];
      let enemyActive: boolean[] = [true, true, true, true];
      
      const scoreMultipliers: byte[] = [1, 2, 4, 8, 16];
      
      function updateEnemies() {
        let i: byte = 0;
        let count: byte = 4;
      }

      function calculateScore(combo: byte): word {
        return scoreMultipliers[combo];
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    // Verify all array sizes
    expect(result.symbolTable.lookup('enemyXPositions')!.type!.arraySize).toBe(4);
    expect(result.symbolTable.lookup('enemyYPositions')!.type!.arraySize).toBe(4);
    expect(result.symbolTable.lookup('enemyActive')!.type!.arraySize).toBe(4);
    expect(result.symbolTable.lookup('scoreMultipliers')!.type!.arraySize).toBe(5);
  });
});

describe('Array Size Inference - Mixed Explicit and Inferred', () => {
  it('should handle program with both explicit and inferred array sizes', () => {
    const source = `
      // Explicit size
      let buffer: byte[256] = [];
      
      // Inferred size
      let colors: byte[] = [2, 5, 6, 14];
      
      // Another explicit
      const lookup: byte[128] = [];
      
      // Another inferred
      const values: word[] = [100, 200, 300];
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    // Verify explicit sizes are preserved
    expect(result.symbolTable.lookup('buffer')!.type!.arraySize).toBe(256);
    expect(result.symbolTable.lookup('lookup')!.type!.arraySize).toBe(128);

    // Verify inferred sizes are correct
    expect(result.symbolTable.lookup('colors')!.type!.arraySize).toBe(4);
    expect(result.symbolTable.lookup('values')!.type!.arraySize).toBe(3);
  });

  it('should handle multiple inferred arrays in same program', () => {
    const source = `
      let a: byte[] = [1];
      let b: byte[] = [1, 2];
      let c: byte[] = [1, 2, 3];
      let d: word[] = [100, 200, 300, 400];
      let e: boolean[] = [true, false, true, false, true];
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    expect(result.symbolTable.lookup('a')!.type!.arraySize).toBe(1);
    expect(result.symbolTable.lookup('b')!.type!.arraySize).toBe(2);
    expect(result.symbolTable.lookup('c')!.type!.arraySize).toBe(3);
    expect(result.symbolTable.lookup('d')!.type!.arraySize).toBe(4);
    expect(result.symbolTable.lookup('e')!.type!.arraySize).toBe(5);
  });
});

describe('Array Size Inference - Error Cases Integration', () => {
  it('should report error for empty brackets without initializer', () => {
    const source = 'let buffer: byte[];';
    const result = compileSource(source);

    const errors = result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);
    expect(errors.length).toBeGreaterThan(0);

    const inferenceError = errors.find((e) => e.message.includes('Cannot infer array size'));
    expect(inferenceError).toBeDefined();
    expect(inferenceError!.message).toContain('no initializer provided');
  });

  it('should report error for inference from non-literal', () => {
    const source = `
      let source: byte[] = [1, 2, 3];
      let target: byte[] = source;
    `;
    const result = compileSource(source);

    const errors = result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);
    expect(errors.length).toBeGreaterThan(0);

    const inferenceError = errors.find((e) => e.message.includes('non-literal initializer'));
    expect(inferenceError).toBeDefined();
  });

  it('should report error for empty array literal', () => {
    const source = 'let empty: byte[] = [];';
    const result = compileSource(source);

    const errors = result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);
    expect(errors.length).toBeGreaterThan(0);

    const inferenceError = errors.find((e) => e.message.includes('empty array literal'));
    expect(inferenceError).toBeDefined();
  });

  it('should report error for unknown type with inference', () => {
    const source = 'let bad: invalid[] = [1, 2, 3];';
    const result = compileSource(source);

    const errors = result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);
    expect(errors.length).toBeGreaterThan(0);

    // Should error on unknown type, not on inference
    const typeError = errors.find((e) => e.message.includes("Unknown element type 'invalid'"));
    expect(typeError).toBeDefined();
  });

  it('should handle multiple errors gracefully', () => {
    const source = `
      let a: byte[];
      let b: invalid[] = [1, 2];
      let c: byte[] = [];
      let d: byte[] = source;
    `;
    const result = compileSource(source);

    const errors = result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR);

    // Should have multiple errors but not crash
    expect(errors.length).toBeGreaterThan(2);

    // Verify specific errors are present
    expect(errors.some((e) => e.message.includes('no initializer provided'))).toBe(true);
    expect(errors.some((e) => e.message.includes('empty array literal'))).toBe(true);
  });
});

describe('Array Size Inference - Function Scope Integration', () => {
  it('should infer array sizes at module level with function usage', () => {
    const source = `
      let globalBuffer: byte[] = [10, 20, 30, 40, 50];
      let tempValues: word[] = [1000, 2000];
      
      function processData() {
        let value: byte = globalBuffer[0];
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);
    expect(result.symbolTable.lookup('globalBuffer')!.type!.arraySize).toBe(5);
    expect(result.symbolTable.lookup('tempValues')!.type!.arraySize).toBe(2);
  });

  it('should infer sizes for multiple arrays at module level', () => {
    const source = `
      let firstArray: byte[] = [1, 2, 3];
      let secondArray: byte[] = [10, 20, 30, 40];
      
      function outer() {
        let x: byte = firstArray[0];
      }
      
      function inner() {
        let y: byte = secondArray[0];
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);
    expect(result.symbolTable.lookup('firstArray')!.type!.arraySize).toBe(3);
    expect(result.symbolTable.lookup('secondArray')!.type!.arraySize).toBe(4);
  });

  it('should infer sizes for arrays used in function return expressions', () => {
    const source = `
      const multipliers: byte[] = [1, 2, 4, 8];
      
      function calculate(input: byte): byte {
        return multipliers[input];
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);
    expect(result.symbolTable.lookup('multipliers')!.type!.arraySize).toBe(4);
  });
});

describe('Array Size Inference - Complex Integration Scenarios', () => {
  it('should handle inference with all storage classes in same program', () => {
    const source = `
      @zp let zpArray: byte[] = [1, 2, 3];
      @data const dataArray: byte[] = [10, 20, 30, 40];
      @ram let ramArray: word[] = [100, 200];
      let normalArray: byte[] = [5, 6, 7, 8, 9];
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    expect(result.symbolTable.lookup('zpArray')!.type!.arraySize).toBe(3);
    expect(result.symbolTable.lookup('dataArray')!.type!.arraySize).toBe(4);
    expect(result.symbolTable.lookup('ramArray')!.type!.arraySize).toBe(2);
    expect(result.symbolTable.lookup('normalArray')!.type!.arraySize).toBe(5);
  });

  it('should handle inference with expressions as array elements', () => {
    const source = `
      let x: byte = 10;
      let y: byte = 20;
      
      let calculated: byte[] = [x + y, x - y, x * 2, y / 2];
      let mixed: byte[] = [5, x, 15, y, 25];
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    expect(result.symbolTable.lookup('calculated')!.type!.arraySize).toBe(4);
    expect(result.symbolTable.lookup('mixed')!.type!.arraySize).toBe(5);
  });

  it('should handle complete C64 hardware access with inferred arrays', () => {
    const source = `
      // VIC-II registers
      @map borderColor at $D020: byte;
      @map backgroundColor at $D021: byte;
      @map spriteEnabled at $D015: byte;

      // Sprite system
      @data const spriteXPositions: byte[] = [24, 48, 72, 96, 120, 144, 168, 192];
      @data const spriteYPositions: byte[] = [50, 60, 70, 80, 90, 100, 110, 120];
      const spriteColors: byte[] = [1, 2, 3, 4, 5, 6, 7, 8];

      // Screen system
      const screenLineStarts: word[] = [
        $0400, $0428, $0450, $0478, $04A0, $04C8, $04F0, $0518,
        $0540, $0568, $0590, $05B8, $05E0, $0608, $0630, $0658,
        $0680, $06A8, $06D0, $06F8, $0720, $0748, $0770, $0798,
        $07C0
      ];

      function initializeGraphics() {
        borderColor = 0;
        backgroundColor = 0;
        spriteEnabled = 0xFF;
      }

      function positionSprite(index: byte, x: byte, y: byte) {
        // Position sprite logic
      }
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    // Verify all inferred arrays
    expect(result.symbolTable.lookup('spriteXPositions')!.type!.arraySize).toBe(8);
    expect(result.symbolTable.lookup('spriteYPositions')!.type!.arraySize).toBe(8);
    expect(result.symbolTable.lookup('spriteColors')!.type!.arraySize).toBe(8);
    expect(result.symbolTable.lookup('screenLineStarts')!.type!.arraySize).toBe(25);
  });

  it('should handle multiline arrays with comments and trailing commas', () => {
    const source = `
      const waveform: byte[] = [
        0,    // Start
        32,   // Rise
        64,   // Quarter
        96,   // 
        128,  // Peak
        160,  // 
        192,  // Fall
        224,  // 
        255,  // End
      ];
    `;

    const result = compileSource(source);

    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);
    expect(result.symbolTable.lookup('waveform')!.type!.arraySize).toBe(9);
  });
});

describe('Array Size Inference - Lexer to Semantic Pipeline', () => {
  it('should correctly parse, tokenize, and infer complete workflow', () => {
    const source = 'let data: byte[] = [$FF, $AA, $55, $00];';
    const result = compileSource(source);

    // Step 1: Lexer produced tokens
    expect(result.tokens.length).toBeGreaterThan(0);

    // Step 2: Parser produced AST
    expect(isProgram(result.program)).toBe(true);
    expect(result.program.getDeclarations().length).toBe(1);

    const varDecl = result.program.getDeclarations()[0];
    expect(isVariableDecl(varDecl)).toBe(true);

    // Step 3: Symbol table built
    const symbol = result.symbolTable.lookup('data');
    expect(symbol).toBeDefined();

    // Step 4: Type resolved with inferred size
    expect(symbol!.type).toBeDefined();
    expect(symbol!.type!.kind).toBe(TypeKind.Array);
    expect(symbol!.type!.arraySize).toBe(4);
    expect(symbol!.type!.elementType!.kind).toBe(TypeKind.Byte);

    // Step 5: No errors
    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);
  });

  it('should validate complete compilation pipeline integrity', () => {
    const source = 'let values: word[] = [100, 200, 300];';
    const result = compileSource(source);

    // No errors throughout entire pipeline
    expect(result.allDiagnostics.filter((d) => d.severity === DiagnosticSeverity.ERROR)).toHaveLength(0);

    // Pipeline produced valid results
    expect(result.tokens).toBeDefined();
    expect(result.program).toBeDefined();
    expect(result.symbolTable).toBeDefined();
    expect(result.typeSystem).toBeDefined();
    
    // Array size was inferred correctly
    const symbol = result.symbolTable.lookup('values');
    expect(symbol!.type!.arraySize).toBe(3);
  });
});