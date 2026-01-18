/**
 * VIC-II Timing Analyzer Tests
 *
 * Tests for Phase 8 Tier 4 - VIC-II timing analysis
 * Step 8.15.1: Class structure and constants
 * Step 8.15.2: Sophisticated cycle estimation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VICIITimingAnalyzer,
  CYCLE_ESTIMATES,
  HARDWARE_PENALTIES,
  BadlineRecommendation,
  createVICIITimingAnalyzer,
  calculateCyclesPerFrame,
  fitsInRasterLine,
  DEFAULT_LOOP_ITERATIONS,
  type LoopCycleEstimate,
  type HardwarePenalties,
  type RasterSafetyMetadata,
  C64HardwareAnalyzer,
} from '../../../../../semantic/analysis/hardware/c64/index.js';
import { C64_CONFIG, C64_NTSC_CONFIG } from '../../../../../target/configs/c64.js';
import type { TargetConfig } from '../../../../../target/config.js';
import { ASTNodeType, type SourceLocation, type Expression, type Statement } from '../../../../../ast/base.js';
import {
  LiteralExpression,
  IdentifierExpression,
  BinaryExpression,
  UnaryExpression,
  CallExpression,
  IndexExpression,
  MemberExpression,
  AssignmentExpression,
  ArrayLiteralExpression,
  VariableDecl,
  ExpressionStatement,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  BreakStatement,
  ContinueStatement,
} from '../../../../../ast/nodes.js';
import { TokenType } from '../../../../../lexer/types.js';
import { SymbolTable } from '../../../../../semantic/symbol-table.js';
import type { ControlFlowGraph } from '../../../../../semantic/control-flow.js';

describe('VIC-II Timing Analyzer', () => {
  let palConfig: TargetConfig;
  let ntscConfig: TargetConfig;
  let analyzer: VICIITimingAnalyzer;

  beforeEach(() => {
    palConfig = C64_CONFIG;
    ntscConfig = C64_NTSC_CONFIG;
    analyzer = new VICIITimingAnalyzer(palConfig);
  });

  describe('Timing Constants (Step 8.15.1)', () => {
    describe('PAL Configuration', () => {
      it('should have correct cycles per line (63)', () => {
        expect(analyzer.getCyclesPerLine()).toBe(63);
      });

      it('should have correct badline penalty (40)', () => {
        expect(analyzer.getBadlinePenalty()).toBe(40);
      });

      it('should calculate correct badline cycles (23)', () => {
        // 63 - 40 = 23 cycles available on badlines
        expect(analyzer.getBadlineCycles()).toBe(23);
      });

      it('should calculate correct cycles per frame (PAL: 63 * 312)', () => {
        expect(analyzer.getCyclesPerFrame()).toBe(63 * 312);
      });

      it('should return complete timing constants', () => {
        const constants = analyzer.getTimingConstants();

        expect(constants.cyclesPerLine).toBe(63);
        expect(constants.linesPerFrame).toBe(312);
        expect(constants.badlinePenalty).toBe(40);
        expect(constants.cyclesPerFrame).toBe(19656);
        expect(constants.normalLineCycles).toBe(63);
        expect(constants.badlineCycles).toBe(23);
      });
    });

    describe('NTSC Configuration', () => {
      it('should have correct NTSC cycles per line (65)', () => {
        const ntscAnalyzer = new VICIITimingAnalyzer(ntscConfig);
        expect(ntscAnalyzer.getCyclesPerLine()).toBe(65);
      });

      it('should have correct NTSC lines per frame (262)', () => {
        const ntscAnalyzer = new VICIITimingAnalyzer(ntscConfig);
        const constants = ntscAnalyzer.getTimingConstants();
        expect(constants.linesPerFrame).toBe(262);
      });

      it('should calculate correct NTSC cycles per frame (65 * 262)', () => {
        const ntscAnalyzer = new VICIITimingAnalyzer(ntscConfig);
        expect(ntscAnalyzer.getCyclesPerFrame()).toBe(65 * 262);
      });

      it('should calculate correct NTSC badline cycles (25)', () => {
        // 65 - 40 = 25 cycles available on NTSC badlines
        const ntscAnalyzer = new VICIITimingAnalyzer(ntscConfig);
        expect(ntscAnalyzer.getBadlineCycles()).toBe(25);
      });
    });
  });

  describe('Cycle Estimate Constants', () => {
    it('should have ASSIGNMENT cycle estimate', () => {
      expect(CYCLE_ESTIMATES.ASSIGNMENT).toBe(5);
    });

    it('should have BINARY_OP cycle estimate', () => {
      expect(CYCLE_ESTIMATES.BINARY_OP).toBe(8);
    });

    it('should have UNARY_OP cycle estimate', () => {
      expect(CYCLE_ESTIMATES.UNARY_OP).toBe(6);
    });

    it('should have BRANCH cycle estimate', () => {
      expect(CYCLE_ESTIMATES.BRANCH).toBe(3);
    });

    it('should have FUNCTION_CALL cycle estimate', () => {
      expect(CYCLE_ESTIMATES.FUNCTION_CALL).toBe(12);
    });

    it('should have RETURN cycle estimate', () => {
      expect(CYCLE_ESTIMATES.RETURN).toBe(6);
    });

    it('should have LOOP_OVERHEAD cycle estimate', () => {
      expect(CYCLE_ESTIMATES.LOOP_OVERHEAD).toBe(5);
    });

    it('should have DEFAULT cycle estimate', () => {
      expect(CYCLE_ESTIMATES.DEFAULT).toBe(2);
    });
  });

  describe('Hardware Penalty Constants', () => {
    it('should have SPRITE_DMA_PER_SPRITE penalty', () => {
      expect(HARDWARE_PENALTIES.SPRITE_DMA_PER_SPRITE).toBe(2);
    });

    it('should have PAGE_CROSSING penalty', () => {
      expect(HARDWARE_PENALTIES.PAGE_CROSSING).toBe(1);
    });

    it('should have RMW_PENALTY', () => {
      expect(HARDWARE_PENALTIES.RMW_PENALTY).toBe(2);
    });

    it('should have MAX_SPRITES constant', () => {
      expect(HARDWARE_PENALTIES.MAX_SPRITES).toBe(8);
    });
  });

  describe('Sprite DMA Penalty Calculation', () => {
    it('should calculate 0 cycles for 0 sprites', () => {
      expect(analyzer.calculateSpriteDMAPenalty(0)).toBe(0);
    });

    it('should calculate 2 cycles for 1 sprite', () => {
      expect(analyzer.calculateSpriteDMAPenalty(1)).toBe(2);
    });

    it('should calculate 8 cycles for 4 sprites', () => {
      expect(analyzer.calculateSpriteDMAPenalty(4)).toBe(8);
    });

    it('should calculate 16 cycles for 8 sprites (maximum)', () => {
      expect(analyzer.calculateSpriteDMAPenalty(8)).toBe(16);
    });

    it('should clamp to 8 sprites maximum', () => {
      // More than 8 sprites should be clamped
      expect(analyzer.calculateSpriteDMAPenalty(10)).toBe(16);
    });

    it('should handle negative values gracefully', () => {
      expect(analyzer.calculateSpriteDMAPenalty(-1)).toBe(0);
    });
  });

  describe('Effective Cycles Calculation', () => {
    it('should return full cycles with no sprites on normal line', () => {
      expect(analyzer.getEffectiveCycles(0, false)).toBe(63);
    });

    it('should return badline cycles with no sprites on badline', () => {
      expect(analyzer.getEffectiveCycles(0, true)).toBe(23);
    });

    it('should subtract sprite DMA from normal line', () => {
      // 63 - (4 * 2) = 55 cycles
      expect(analyzer.getEffectiveCycles(4, false)).toBe(55);
    });

    it('should subtract sprite DMA from badline', () => {
      // 23 - (4 * 2) = 15 cycles
      expect(analyzer.getEffectiveCycles(4, true)).toBe(15);
    });

    it('should handle maximum sprites on normal line', () => {
      // 63 - 16 = 47 cycles
      expect(analyzer.getEffectiveCycles(8, false)).toBe(47);
    });

    it('should handle maximum sprites on badline', () => {
      // 23 - 16 = 7 cycles
      expect(analyzer.getEffectiveCycles(8, true)).toBe(7);
    });
  });

  describe('Badline Recommendation Enum', () => {
    it('should have SAFE recommendation', () => {
      expect(BadlineRecommendation.SAFE).toBe('safe');
    });

    it('should have SPLIT_ACROSS_LINES recommendation', () => {
      expect(BadlineRecommendation.SPLIT_ACROSS_LINES).toBe('split_across_lines');
    });

    it('should have USE_STABLE_RASTER recommendation', () => {
      expect(BadlineRecommendation.USE_STABLE_RASTER).toBe('use_stable_raster');
    });

    it('should have DISABLE_BADLINES recommendation', () => {
      expect(BadlineRecommendation.DISABLE_BADLINES).toBe('disable_badlines');
    });

    it('should have TOO_LONG recommendation', () => {
      expect(BadlineRecommendation.TOO_LONG).toBe('too_long');
    });
  });

  describe('Warning Management', () => {
    // Helper to create a mock source location
    const createMockLocation = () => ({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    });

    it('should start with empty warnings', () => {
      expect(analyzer.getWarnings()).toHaveLength(0);
    });

    it('should allow adding warnings', () => {
      const warning = {
        message: 'Test warning',
        location: createMockLocation(),
        severity: 'warning' as const,
      };

      analyzer.addWarning(warning);
      expect(analyzer.getWarnings()).toHaveLength(1);
      expect(analyzer.getWarnings()[0].message).toBe('Test warning');
    });

    it('should allow clearing warnings', () => {
      const warning = {
        message: 'Test warning',
        location: createMockLocation(),
        severity: 'warning' as const,
      };

      analyzer.addWarning(warning);
      analyzer.clearWarnings();
      expect(analyzer.getWarnings()).toHaveLength(0);
    });

    it('should return a copy of warnings array', () => {
      const warning = {
        message: 'Test warning',
        location: createMockLocation(),
        severity: 'warning' as const,
      };

      analyzer.addWarning(warning);
      const warnings = analyzer.getWarnings();
      warnings.pop(); // Modify the returned array

      // Original should be unchanged
      expect(analyzer.getWarnings()).toHaveLength(1);
    });
  });

  describe('Utility Functions', () => {
    describe('createVICIITimingAnalyzer', () => {
      it('should create analyzer from config', () => {
        const created = createVICIITimingAnalyzer(palConfig);
        expect(created).toBeInstanceOf(VICIITimingAnalyzer);
        expect(created.getCyclesPerLine()).toBe(63);
      });
    });

    describe('calculateCyclesPerFrame', () => {
      it('should calculate PAL cycles per frame', () => {
        expect(calculateCyclesPerFrame(63, 312)).toBe(19656);
      });

      it('should calculate NTSC cycles per frame', () => {
        expect(calculateCyclesPerFrame(65, 262)).toBe(17030);
      });
    });

    describe('fitsInRasterLine', () => {
      it('should return true for cycles that fit', () => {
        expect(fitsInRasterLine(50, 63)).toBe(true);
      });

      it('should return true for exact fit', () => {
        expect(fitsInRasterLine(63, 63)).toBe(true);
      });

      it('should return false for cycles that exceed', () => {
        expect(fitsInRasterLine(64, 63)).toBe(false);
      });

      it('should return false for badline-exceeding cycles', () => {
        expect(fitsInRasterLine(24, 23)).toBe(false);
      });
    });
  });

  // ============================================
  // Step 8.15.2: Sophisticated Cycle Estimation
  // ============================================

  describe('Expression Cycle Estimation (Step 8.15.2)', () => {
    // Helper to create a mock source location
    const createMockLocation = (): SourceLocation => ({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    });

    describe('Literal Expressions', () => {
      it('should estimate 2 cycles for numeric literal', () => {
        const expr = new LiteralExpression(42, createMockLocation());
        expect(analyzer.estimateExpressionCycles(expr)).toBe(2);
      });

      it('should estimate 2 cycles for string literal', () => {
        const expr = new LiteralExpression('hello', createMockLocation());
        expect(analyzer.estimateExpressionCycles(expr)).toBe(2);
      });

      it('should estimate 2 cycles for boolean literal', () => {
        const expr = new LiteralExpression(true, createMockLocation());
        expect(analyzer.estimateExpressionCycles(expr)).toBe(2);
      });
    });

    describe('Identifier Expressions', () => {
      it('should estimate 3 cycles for variable reference', () => {
        const expr = new IdentifierExpression('counter', createMockLocation());
        expect(analyzer.estimateExpressionCycles(expr)).toBe(3);
      });
    });

    describe('Unary Expressions', () => {
      it('should estimate cycles for unary negation (-x)', () => {
        const operand = new IdentifierExpression('x', createMockLocation());
        const expr = new UnaryExpression(TokenType.MINUS, operand, createMockLocation());
        // UNARY_OP (6) + operand (3) = 9
        expect(analyzer.estimateExpressionCycles(expr)).toBe(9);
      });

      it('should estimate cycles for logical NOT (!flag)', () => {
        const operand = new IdentifierExpression('flag', createMockLocation());
        const expr = new UnaryExpression(TokenType.BANG, operand, createMockLocation());
        expect(analyzer.estimateExpressionCycles(expr)).toBe(9);
      });

      it('should estimate cycles for nested unary (!!x)', () => {
        const inner = new IdentifierExpression('x', createMockLocation());
        const middle = new UnaryExpression(TokenType.BANG, inner, createMockLocation());
        const outer = new UnaryExpression(TokenType.BANG, middle, createMockLocation());
        // UNARY_OP (6) + [UNARY_OP (6) + operand (3)] = 15
        expect(analyzer.estimateExpressionCycles(outer)).toBe(15);
      });
    });

    describe('Binary Expressions', () => {
      it('should estimate cycles for simple addition (a + b)', () => {
        const left = new IdentifierExpression('a', createMockLocation());
        const right = new IdentifierExpression('b', createMockLocation());
        const expr = new BinaryExpression(left, TokenType.PLUS, right, createMockLocation());
        // BINARY_OP (8) + left (3) + right (3) = 14
        expect(analyzer.estimateExpressionCycles(expr)).toBe(14);
      });

      it('should estimate cycles for literal binary (5 * 3)', () => {
        const left = new LiteralExpression(5, createMockLocation());
        const right = new LiteralExpression(3, createMockLocation());
        const expr = new BinaryExpression(left, TokenType.STAR, right, createMockLocation());
        // BINARY_OP (8) + left (2) + right (2) = 12
        expect(analyzer.estimateExpressionCycles(expr)).toBe(12);
      });

      it('should estimate cycles for nested binary ((a + b) * c)', () => {
        const a = new IdentifierExpression('a', createMockLocation());
        const b = new IdentifierExpression('b', createMockLocation());
        const c = new IdentifierExpression('c', createMockLocation());
        const inner = new BinaryExpression(a, TokenType.PLUS, b, createMockLocation());
        const outer = new BinaryExpression(inner, TokenType.STAR, c, createMockLocation());
        // BINARY_OP (8) + [BINARY_OP (8) + a (3) + b (3)] + c (3) = 25
        expect(analyzer.estimateExpressionCycles(outer)).toBe(25);
      });

      it('should estimate cycles for comparison (x > 10)', () => {
        const left = new IdentifierExpression('x', createMockLocation());
        const right = new LiteralExpression(10, createMockLocation());
        const expr = new BinaryExpression(left, TokenType.GREATER, right, createMockLocation());
        // BINARY_OP (8) + left (3) + right (2) = 13
        expect(analyzer.estimateExpressionCycles(expr)).toBe(13);
      });
    });

    describe('Call Expressions', () => {
      it('should estimate cycles for function call with no args', () => {
        const callee = new IdentifierExpression('doSomething', createMockLocation());
        const expr = new CallExpression(callee, [], createMockLocation());
        // FUNCTION_CALL (12)
        expect(analyzer.estimateExpressionCycles(expr)).toBe(12);
      });

      it('should estimate cycles for function call with one arg', () => {
        const callee = new IdentifierExpression('print', createMockLocation());
        const arg = new LiteralExpression(42, createMockLocation());
        const expr = new CallExpression(callee, [arg], createMockLocation());
        // FUNCTION_CALL (12) + arg (2) + push (3) = 17
        expect(analyzer.estimateExpressionCycles(expr)).toBe(17);
      });

      it('should estimate cycles for function call with multiple args', () => {
        const callee = new IdentifierExpression('add', createMockLocation());
        const arg1 = new IdentifierExpression('x', createMockLocation());
        const arg2 = new IdentifierExpression('y', createMockLocation());
        const expr = new CallExpression(callee, [arg1, arg2], createMockLocation());
        // FUNCTION_CALL (12) + [arg1 (3) + push (3)] + [arg2 (3) + push (3)] = 24
        expect(analyzer.estimateExpressionCycles(expr)).toBe(24);
      });
    });

    describe('Index Expressions', () => {
      it('should estimate cycles for array index with literal', () => {
        const array = new IdentifierExpression('arr', createMockLocation());
        const index = new LiteralExpression(5, createMockLocation());
        const expr = new IndexExpression(array, index, createMockLocation());
        // Base (5) + index (2) = 7
        expect(analyzer.estimateExpressionCycles(expr)).toBe(7);
      });

      it('should estimate cycles for array index with variable', () => {
        const array = new IdentifierExpression('arr', createMockLocation());
        const index = new IdentifierExpression('i', createMockLocation());
        const expr = new IndexExpression(array, index, createMockLocation());
        // Base (5) + index (3) = 8
        expect(analyzer.estimateExpressionCycles(expr)).toBe(8);
      });

      it('should estimate cycles for array index with expression', () => {
        const array = new IdentifierExpression('arr', createMockLocation());
        const i = new IdentifierExpression('i', createMockLocation());
        const one = new LiteralExpression(1, createMockLocation());
        const indexExpr = new BinaryExpression(i, TokenType.PLUS, one, createMockLocation());
        const expr = new IndexExpression(array, indexExpr, createMockLocation());
        // Base (5) + [BINARY_OP (8) + i (3) + one (2)] = 18
        expect(analyzer.estimateExpressionCycles(expr)).toBe(18);
      });
    });

    describe('Member Expressions', () => {
      it('should estimate 4 cycles for member access', () => {
        const object = new IdentifierExpression('player', createMockLocation());
        const expr = new MemberExpression(object, 'health', createMockLocation());
        expect(analyzer.estimateExpressionCycles(expr)).toBe(4);
      });
    });

    describe('Assignment Expressions', () => {
      it('should estimate cycles for simple assignment (x = 5)', () => {
        const target = new IdentifierExpression('x', createMockLocation());
        const value = new LiteralExpression(5, createMockLocation());
        const expr = new AssignmentExpression(target, TokenType.ASSIGN, value, createMockLocation());
        // ASSIGNMENT (5) + value (2) = 7
        expect(analyzer.estimateExpressionCycles(expr)).toBe(7);
      });

      it('should estimate cycles for assignment with expression (x = a + b)', () => {
        const target = new IdentifierExpression('x', createMockLocation());
        const a = new IdentifierExpression('a', createMockLocation());
        const b = new IdentifierExpression('b', createMockLocation());
        const value = new BinaryExpression(a, TokenType.PLUS, b, createMockLocation());
        const expr = new AssignmentExpression(target, TokenType.ASSIGN, value, createMockLocation());
        // ASSIGNMENT (5) + [BINARY_OP (8) + a (3) + b (3)] = 19
        expect(analyzer.estimateExpressionCycles(expr)).toBe(19);
      });
    });

    describe('Array Literal Expressions', () => {
      it('should estimate 0 cycles for empty array', () => {
        const expr = new ArrayLiteralExpression([], createMockLocation());
        expect(analyzer.estimateExpressionCycles(expr)).toBe(0);
      });

      it('should estimate cycles for array with literals', () => {
        const elem1 = new LiteralExpression(1, createMockLocation());
        const elem2 = new LiteralExpression(2, createMockLocation());
        const elem3 = new LiteralExpression(3, createMockLocation());
        const expr = new ArrayLiteralExpression([elem1, elem2, elem3], createMockLocation());
        // 3 * [elem (2) + store (4)] = 18
        expect(analyzer.estimateExpressionCycles(expr)).toBe(18);
      });
    });
  });

  describe('Statement Cycle Estimation (Step 8.15.2)', () => {
    // Helper to create a mock source location
    const createMockLocation = (): SourceLocation => ({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    });

    describe('Variable Declaration', () => {
      it('should estimate 0 cycles for declaration without initializer', () => {
        const stmt = new VariableDecl('x', 'byte', null, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        expect(estimate.minCycles).toBe(0);
        expect(estimate.avgCycles).toBe(0);
      });

      it('should estimate cycles for declaration with literal initializer', () => {
        const init = new LiteralExpression(42, createMockLocation());
        const stmt = new VariableDecl('x', 'byte', init, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // ASSIGNMENT (5) + literal (2) = 7
        expect(estimate.minCycles).toBe(7);
        expect(estimate.breakdown?.assignments).toBe(7);
      });

      it('should estimate cycles for declaration with expression initializer', () => {
        const a = new IdentifierExpression('a', createMockLocation());
        const b = new IdentifierExpression('b', createMockLocation());
        const init = new BinaryExpression(a, TokenType.PLUS, b, createMockLocation());
        const stmt = new VariableDecl('x', 'byte', init, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // ASSIGNMENT (5) + [BINARY_OP (8) + a (3) + b (3)] = 19
        expect(estimate.minCycles).toBe(19);
      });
    });

    describe('Expression Statement', () => {
      it('should estimate cycles for assignment expression statement', () => {
        const target = new IdentifierExpression('x', createMockLocation());
        const value = new LiteralExpression(5, createMockLocation());
        const assignExpr = new AssignmentExpression(target, TokenType.ASSIGN, value, createMockLocation());
        const stmt = new ExpressionStatement(assignExpr, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // ASSIGNMENT (5) + value (2) = 7
        expect(estimate.minCycles).toBe(7);
        expect(estimate.breakdown?.assignments).toBe(7);
      });

      it('should estimate cycles for binary expression statement', () => {
        const a = new IdentifierExpression('a', createMockLocation());
        const b = new IdentifierExpression('b', createMockLocation());
        const binaryExpr = new BinaryExpression(a, TokenType.PLUS, b, createMockLocation());
        const stmt = new ExpressionStatement(binaryExpr, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // BINARY_OP (8) + a (3) + b (3) = 14
        expect(estimate.minCycles).toBe(14);
        expect(estimate.breakdown?.binaryOps).toBe(14);
      });

      it('should estimate cycles for function call statement', () => {
        const callee = new IdentifierExpression('doSomething', createMockLocation());
        const callExpr = new CallExpression(callee, [], createMockLocation());
        const stmt = new ExpressionStatement(callExpr, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // FUNCTION_CALL (12)
        expect(estimate.minCycles).toBe(12);
        expect(estimate.breakdown?.functionCalls).toBe(12);
      });
    });

    describe('Return Statement', () => {
      it('should estimate cycles for return without value', () => {
        const stmt = new ReturnStatement(null, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // RETURN (6)
        expect(estimate.minCycles).toBe(6);
      });

      it('should estimate cycles for return with literal', () => {
        const value = new LiteralExpression(42, createMockLocation());
        const stmt = new ReturnStatement(value, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // RETURN (6) + value (2) = 8
        expect(estimate.minCycles).toBe(8);
      });

      it('should estimate cycles for return with expression', () => {
        const a = new IdentifierExpression('a', createMockLocation());
        const b = new IdentifierExpression('b', createMockLocation());
        const value = new BinaryExpression(a, TokenType.PLUS, b, createMockLocation());
        const stmt = new ReturnStatement(value, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // RETURN (6) + [BINARY_OP (8) + a (3) + b (3)] = 20
        expect(estimate.minCycles).toBe(20);
      });
    });

    describe('If Statement', () => {
      it('should estimate cycles for if with simple condition', () => {
        const condition = new IdentifierExpression('flag', createMockLocation());
        const stmt = new IfStatement(condition, [], null, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // BRANCH (3) + condition (3) = 6
        expect(estimate.minCycles).toBe(6);
        expect(estimate.breakdown?.branches).toBe(6);
      });

      it('should estimate cycles for if with comparison condition', () => {
        const x = new IdentifierExpression('x', createMockLocation());
        const ten = new LiteralExpression(10, createMockLocation());
        const condition = new BinaryExpression(x, TokenType.GREATER, ten, createMockLocation());
        const stmt = new IfStatement(condition, [], null, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // BRANCH (3) + [BINARY_OP (8) + x (3) + ten (2)] = 16
        expect(estimate.minCycles).toBe(16);
      });
    });

    describe('While Statement', () => {
      it('should estimate cycles for while condition evaluation', () => {
        const condition = new IdentifierExpression('running', createMockLocation());
        const stmt = new WhileStatement(condition, [], createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // BRANCH (3) + condition (3) = 6
        expect(estimate.minCycles).toBe(6);
        expect(estimate.breakdown?.branches).toBe(6);
      });

      it('should estimate cycles for while with comparison', () => {
        const i = new IdentifierExpression('i', createMockLocation());
        const ten = new LiteralExpression(10, createMockLocation());
        const condition = new BinaryExpression(i, TokenType.LESS, ten, createMockLocation());
        const stmt = new WhileStatement(condition, [], createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // BRANCH (3) + [BINARY_OP (8) + i (3) + ten (2)] = 16
        expect(estimate.minCycles).toBe(16);
      });
    });

    describe('For Statement', () => {
      it('should estimate cycles for for loop setup', () => {
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(10, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // ASSIGNMENT (5) + start (2) + end (2) + BRANCH (3) = 12
        expect(estimate.minCycles).toBe(12);
        expect(estimate.breakdown?.branches).toBe(3);
        expect(estimate.breakdown?.assignments).toBe(7); // ASSIGNMENT + start
      });

      it('should estimate cycles for for loop with variable bounds', () => {
        const start = new IdentifierExpression('startIdx', createMockLocation());
        const end = new IdentifierExpression('endIdx', createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // ASSIGNMENT (5) + start (3) + end (3) + BRANCH (3) = 14
        expect(estimate.minCycles).toBe(14);
      });
    });

    describe('Break and Continue Statements', () => {
      it('should estimate cycles for break statement', () => {
        const stmt = new BreakStatement(createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // BRANCH (3)
        expect(estimate.minCycles).toBe(3);
        expect(estimate.breakdown?.branches).toBe(3);
      });

      it('should estimate cycles for continue statement', () => {
        const stmt = new ContinueStatement(createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // BRANCH (3)
        expect(estimate.minCycles).toBe(3);
        expect(estimate.breakdown?.branches).toBe(3);
      });
    });

    describe('Cycle Estimate Properties', () => {
      it('should include page crossing penalty in maxCycles', () => {
        const value = new LiteralExpression(42, createMockLocation());
        const stmt = new ReturnStatement(value, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        // maxCycles = minCycles + PAGE_CROSSING (1)
        expect(estimate.maxCycles).toBe(estimate.minCycles + HARDWARE_PENALTIES.PAGE_CROSSING);
      });

      it('should have avgCycles equal to minCycles for basic statements', () => {
        const stmt = new BreakStatement(createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        expect(estimate.avgCycles).toBe(estimate.minCycles);
      });

      it('should not include hardware penalties by default', () => {
        const value = new LiteralExpression(42, createMockLocation());
        const stmt = new ReturnStatement(value, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        expect(estimate.includesHardwarePenalties).toBe(false);
      });

      it('should include breakdown for all statements', () => {
        const value = new LiteralExpression(42, createMockLocation());
        const stmt = new ReturnStatement(value, createMockLocation());
        const estimate = analyzer.estimateStatementCycles(stmt);
        expect(estimate.breakdown).toBeDefined();
        expect(estimate.breakdown?.assignments).toBeDefined();
        expect(estimate.breakdown?.binaryOps).toBeDefined();
        expect(estimate.breakdown?.functionCalls).toBeDefined();
        expect(estimate.breakdown?.branches).toBeDefined();
        expect(estimate.breakdown?.other).toBeDefined();
      });
    });
  });

  // ============================================
  // Step 8.15.3: Loop Cycle Estimation
  // ============================================

  describe('Loop Cycle Estimation (Step 8.15.3)', () => {
    // Helper to create a mock source location
    const createMockLocation = (): SourceLocation => ({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    });

    describe('DEFAULT_LOOP_ITERATIONS constant', () => {
      it('should have default loop iterations constant', () => {
        expect(DEFAULT_LOOP_ITERATIONS).toBe(10);
      });
    });

    describe('For Loop with Literal Bounds', () => {
      it('should detect known iteration count from literal bounds', () => {
        // for i in 0 to 10 { }
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(10, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.iterationsKnown).toBe(true);
        expect(estimate.iterations).toBe(10); // 10 - 0 = 10
      });

      it('should calculate correct total cycles for empty for loop', () => {
        // for i in 0 to 5 { } - 5 iterations
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(5, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        // setupCycles = ASSIGNMENT (5) + start (2) + end (2) = 9
        expect(estimate.setupCycles).toBe(9);

        // bodyCycles = 0 (empty body)
        expect(estimate.bodyCycles).toBe(0);

        // overheadCycles = LOOP_OVERHEAD (5)
        expect(estimate.overheadCycles).toBe(CYCLE_ESTIMATES.LOOP_OVERHEAD);

        // cyclesPerIteration = bodyCycles + overheadCycles = 0 + 5 = 5
        expect(estimate.cyclesPerIteration).toBe(5);

        // totalCycles = setupCycles + (iterations * cyclesPerIteration)
        // = 9 + (5 * 5) = 34
        expect(estimate.totalCycles).toBe(34);
      });

      it('should handle non-zero start bounds correctly', () => {
        // for i in 5 to 15 { } - 10 iterations
        const start = new LiteralExpression(5, createMockLocation());
        const end = new LiteralExpression(15, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.iterationsKnown).toBe(true);
        expect(estimate.iterations).toBe(10); // 15 - 5 = 10
      });

      it('should handle zero iterations (end <= start)', () => {
        // for i in 10 to 5 { } - 0 iterations (end < start)
        const start = new LiteralExpression(10, createMockLocation());
        const end = new LiteralExpression(5, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.iterationsKnown).toBe(true);
        expect(estimate.iterations).toBe(0);
        // totalCycles should just be setup (no iterations)
        expect(estimate.totalCycles).toBe(estimate.setupCycles);
      });
    });

    describe('For Loop with Variable Bounds', () => {
      it('should use default iterations when start is variable', () => {
        // for i in startIdx to 10 { }
        const start = new IdentifierExpression('startIdx', createMockLocation());
        const end = new LiteralExpression(10, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.iterationsKnown).toBe(false);
        expect(estimate.iterations).toBe(DEFAULT_LOOP_ITERATIONS);
      });

      it('should use default iterations when end is variable', () => {
        // for i in 0 to endIdx { }
        const start = new LiteralExpression(0, createMockLocation());
        const end = new IdentifierExpression('endIdx', createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.iterationsKnown).toBe(false);
        expect(estimate.iterations).toBe(DEFAULT_LOOP_ITERATIONS);
      });

      it('should use default iterations when both bounds are variables', () => {
        // for i in startIdx to endIdx { }
        const start = new IdentifierExpression('startIdx', createMockLocation());
        const end = new IdentifierExpression('endIdx', createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.iterationsKnown).toBe(false);
        expect(estimate.iterations).toBe(DEFAULT_LOOP_ITERATIONS);
      });

      it('should calculate higher setup cycles with variable bounds', () => {
        // for i in startIdx to endIdx { }
        const start = new IdentifierExpression('startIdx', createMockLocation());
        const end = new IdentifierExpression('endIdx', createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        // setupCycles = ASSIGNMENT (5) + start (3) + end (3) = 11
        // (variable access costs 3 cycles, not 2)
        expect(estimate.setupCycles).toBe(11);
      });
    });

    describe('While Loop', () => {
      it('should use default iterations for while loop', () => {
        // while running { }
        const condition = new IdentifierExpression('running', createMockLocation());
        const stmt = new WhileStatement(condition, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.iterationsKnown).toBe(false);
        expect(estimate.iterations).toBe(DEFAULT_LOOP_ITERATIONS);
      });

      it('should calculate setup cycles from condition', () => {
        // while running { }
        const condition = new IdentifierExpression('running', createMockLocation());
        const stmt = new WhileStatement(condition, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        // setupCycles = condition evaluation = 3 (identifier)
        expect(estimate.setupCycles).toBe(3);
      });

      it('should calculate setup cycles for complex condition', () => {
        // while i < 10 { }
        const i = new IdentifierExpression('i', createMockLocation());
        const ten = new LiteralExpression(10, createMockLocation());
        const condition = new BinaryExpression(i, TokenType.LESS, ten, createMockLocation());
        const stmt = new WhileStatement(condition, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        // setupCycles = condition evaluation = BINARY_OP (8) + i (3) + 10 (2) = 13
        expect(estimate.setupCycles).toBe(13);
      });

      it('should calculate total cycles for empty while loop', () => {
        // while running { }
        const condition = new IdentifierExpression('running', createMockLocation());
        const stmt = new WhileStatement(condition, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        // setupCycles = 3 (condition)
        // bodyCycles = 0 (empty)
        // overheadCycles = LOOP_OVERHEAD (5)
        // cyclesPerIteration = 0 + 5 = 5
        // totalCycles = 3 + (10 * 5) = 53
        expect(estimate.totalCycles).toBe(53);
      });
    });

    describe('Loop with Body Statements', () => {
      it('should calculate body cycles for for loop with statements', () => {
        // for i in 0 to 3 {
        //   let x: byte = 42;
        // }
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(3, createMockLocation());
        const initExpr = new LiteralExpression(42, createMockLocation());
        const bodyStmt = new VariableDecl('x', 'byte', initExpr, createMockLocation());
        const stmt = new ForStatement('i', start, end, [bodyStmt], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        // bodyCycles = ASSIGNMENT (5) + literal (2) = 7
        expect(estimate.bodyCycles).toBe(7);

        // cyclesPerIteration = bodyCycles + overheadCycles = 7 + 5 = 12
        expect(estimate.cyclesPerIteration).toBe(12);

        // iterations = 3
        expect(estimate.iterations).toBe(3);

        // totalCycles = setup (9) + (3 * 12) = 9 + 36 = 45
        expect(estimate.totalCycles).toBe(45);
      });

      it('should calculate body cycles for while loop with statements', () => {
        // while running {
        //   counter = counter + 1;
        // }
        const condition = new IdentifierExpression('running', createMockLocation());
        const target = new IdentifierExpression('counter', createMockLocation());
        const counterRead = new IdentifierExpression('counter', createMockLocation());
        const one = new LiteralExpression(1, createMockLocation());
        const addExpr = new BinaryExpression(counterRead, TokenType.PLUS, one, createMockLocation());
        const assignExpr = new AssignmentExpression(target, TokenType.ASSIGN, addExpr, createMockLocation());
        const bodyStmt = new ExpressionStatement(assignExpr, createMockLocation());
        const stmt = new WhileStatement(condition, [bodyStmt], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        // bodyCycles = ASSIGNMENT (5) + [BINARY_OP (8) + counter (3) + 1 (2)] = 5 + 13 = 18
        expect(estimate.bodyCycles).toBe(18);
      });

      it('should include body breakdown', () => {
        // for i in 0 to 5 {
        //   let x: byte = 42;
        // }
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(5, createMockLocation());
        const initExpr = new LiteralExpression(42, createMockLocation());
        const bodyStmt = new VariableDecl('x', 'byte', initExpr, createMockLocation());
        const stmt = new ForStatement('i', start, end, [bodyStmt], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.bodyBreakdown).toBeDefined();
        // Variable declaration with initializer goes to assignments
        expect(estimate.bodyBreakdown?.assignments).toBeGreaterThan(0);
      });
    });

    describe('Loop Cycle Estimate Properties', () => {
      it('should return all required properties', () => {
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(5, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate).toHaveProperty('totalCycles');
        expect(estimate).toHaveProperty('cyclesPerIteration');
        expect(estimate).toHaveProperty('iterations');
        expect(estimate).toHaveProperty('iterationsKnown');
        expect(estimate).toHaveProperty('setupCycles');
        expect(estimate).toHaveProperty('bodyCycles');
        expect(estimate).toHaveProperty('overheadCycles');
        expect(estimate).toHaveProperty('bodyBreakdown');
      });

      it('should satisfy total cycles formula', () => {
        // totalCycles = setupCycles + (iterations * cyclesPerIteration)
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(8, createMockLocation());
        const initExpr = new LiteralExpression(1, createMockLocation());
        const bodyStmt = new VariableDecl('x', 'byte', initExpr, createMockLocation());
        const stmt = new ForStatement('i', start, end, [bodyStmt], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        const expectedTotal = estimate.setupCycles + estimate.iterations * estimate.cyclesPerIteration;
        expect(estimate.totalCycles).toBe(expectedTotal);
      });

      it('should satisfy cycles per iteration formula', () => {
        // cyclesPerIteration = bodyCycles + overheadCycles
        const condition = new IdentifierExpression('flag', createMockLocation());
        const initExpr = new LiteralExpression(42, createMockLocation());
        const bodyStmt = new VariableDecl('x', 'byte', initExpr, createMockLocation());
        const stmt = new WhileStatement(condition, [bodyStmt], createMockLocation());

        const estimate = analyzer.estimateLoopCycles(stmt);

        expect(estimate.cyclesPerIteration).toBe(estimate.bodyCycles + estimate.overheadCycles);
      });
    });
  });

  // ============================================
  // Step 8.15.4: Hardware Penalty Detection
  // ============================================

  describe('Hardware Penalty Detection (Step 8.15.4)', () => {
    // Helper to create a mock source location
    const createMockLocation = (): SourceLocation => ({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    });

    describe('Page Crossing Detection', () => {
      it('should detect page crossing between different pages', () => {
        // Page 0: $0000-$00FF, Page 1: $0100-$01FF
        expect(analyzer.isPageCrossingLikely(0x00ff, 0x0100)).toBe(true);
      });

      it('should not detect page crossing within same page', () => {
        // Both addresses on Page 0
        expect(analyzer.isPageCrossingLikely(0x0010, 0x00ff)).toBe(false);
      });

      it('should detect page crossing for distant addresses', () => {
        // Page 0 to Page 255
        expect(analyzer.isPageCrossingLikely(0x0000, 0xff00)).toBe(true);
      });

      it('should handle zero page correctly', () => {
        // Zero page is $00-$FF
        expect(analyzer.isPageCrossingLikely(0x0000, 0x00ff)).toBe(false);
        expect(analyzer.isPageCrossingLikely(0x00ff, 0x0100)).toBe(true);
      });
    });

    describe('RMW Operation Detection', () => {
      it('should detect RMW for assignment where target is in value (x = x + 1)', () => {
        const target = new IdentifierExpression('x', createMockLocation());
        const xRead = new IdentifierExpression('x', createMockLocation());
        const one = new LiteralExpression(1, createMockLocation());
        const addExpr = new BinaryExpression(xRead, TokenType.PLUS, one, createMockLocation());
        const assignExpr = new AssignmentExpression(target, TokenType.ASSIGN, addExpr, createMockLocation());

        const rmwCount = analyzer.detectRMWOperations(assignExpr);

        expect(rmwCount).toBeGreaterThan(0);
      });

      it('should not detect RMW for simple assignment (x = 5)', () => {
        const target = new IdentifierExpression('x', createMockLocation());
        const value = new LiteralExpression(5, createMockLocation());
        const assignExpr = new AssignmentExpression(target, TokenType.ASSIGN, value, createMockLocation());

        const rmwCount = analyzer.detectRMWOperations(assignExpr);

        // Simple assignment with literal value should not be RMW
        expect(rmwCount).toBe(0);
      });

      it('should detect RMW in for loop (implicit increment)', () => {
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(10, createMockLocation());
        const stmt = new ForStatement('i', start, end, [], createMockLocation());

        const rmwCount = analyzer.detectStatementRMWOperations(stmt);

        // For loops have implicit increment (RMW)
        expect(rmwCount).toBe(1);
      });

      it('should detect RMW for nested expressions', () => {
        // counter = counter + (index = index + 1)
        // This has two RMW operations
        const counter = new IdentifierExpression('counter', createMockLocation());
        const counterRead = new IdentifierExpression('counter', createMockLocation());
        const index = new IdentifierExpression('index', createMockLocation());
        const indexRead = new IdentifierExpression('index', createMockLocation());
        const one = new LiteralExpression(1, createMockLocation());

        const innerAdd = new BinaryExpression(indexRead, TokenType.PLUS, one, createMockLocation());
        const innerAssign = new AssignmentExpression(index, TokenType.ASSIGN, innerAdd, createMockLocation());

        const outerAdd = new BinaryExpression(counterRead, TokenType.PLUS, innerAssign, createMockLocation());
        const outerAssign = new AssignmentExpression(counter, TokenType.ASSIGN, outerAdd, createMockLocation());

        const rmwCount = analyzer.detectRMWOperations(outerAssign);

        // Both counter = counter + ... and index = index + 1 are RMW
        expect(rmwCount).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Hardware Penalties Calculation', () => {
      it('should calculate hardware penalties for empty statements', () => {
        const penalties = analyzer.calculateHardwarePenalties([], 0);

        expect(penalties.totalPenalty).toBe(0);
        expect(penalties.spriteDMAPenalty).toBe(0);
        expect(penalties.rmwPenalty).toBe(0);
        expect(penalties.activeSprites).toBe(0);
        expect(penalties.rmwOperations).toBe(0);
      });

      it('should include sprite DMA penalty', () => {
        const penalties = analyzer.calculateHardwarePenalties([], 4);

        // 4 sprites * 2 cycles = 8 cycles
        expect(penalties.spriteDMAPenalty).toBe(8);
        expect(penalties.activeSprites).toBe(4);
        expect(penalties.totalPenalty).toBeGreaterThanOrEqual(8);
      });

      it('should include RMW penalty for for loops', () => {
        const start = new LiteralExpression(0, createMockLocation());
        const end = new LiteralExpression(10, createMockLocation());
        const forStmt = new ForStatement('i', start, end, [], createMockLocation());

        const penalties = analyzer.calculateHardwarePenalties([forStmt], 0);

        // For loop has 1 RMW operation * 2 cycles = 2
        expect(penalties.rmwOperations).toBe(1);
        expect(penalties.rmwPenalty).toBe(HARDWARE_PENALTIES.RMW_PENALTY);
      });

      it('should return all HardwarePenalties properties', () => {
        const stmt = new BreakStatement(createMockLocation());
        const penalties = analyzer.calculateHardwarePenalties([stmt], 2);

        expect(penalties).toHaveProperty('totalPenalty');
        expect(penalties).toHaveProperty('spriteDMAPenalty');
        expect(penalties).toHaveProperty('pageCrossingPenalty');
        expect(penalties).toHaveProperty('rmwPenalty');
        expect(penalties).toHaveProperty('activeSprites');
        expect(penalties).toHaveProperty('pageCrossings');
        expect(penalties).toHaveProperty('rmwOperations');
      });
    });

    describe('Cycles with Penalties', () => {
      it('should include hardware penalties in cycle estimate', () => {
        const initExpr = new LiteralExpression(42, createMockLocation());
        const stmt = new VariableDecl('x', 'byte', initExpr, createMockLocation());

        const baseEstimate = analyzer.estimateBlockCycles([stmt]);
        const withPenalties = analyzer.estimateCyclesWithPenalties([stmt], 4);

        // With 4 sprites: +8 cycles
        expect(withPenalties.avgCycles).toBeGreaterThan(baseEstimate.avgCycles);
        expect(withPenalties.includesHardwarePenalties).toBe(true);
      });

      it('should add badline penalty when isBadline is true', () => {
        const stmt = new BreakStatement(createMockLocation());

        const normalEstimate = analyzer.estimateCyclesWithPenalties([stmt], 0, false);
        const badlineEstimate = analyzer.estimateCyclesWithPenalties([stmt], 0, true);

        // Badline adds 40 cycles penalty
        expect(badlineEstimate.avgCycles).toBe(normalEstimate.avgCycles + analyzer.getBadlinePenalty());
      });

      it('should combine sprite and badline penalties', () => {
        const stmt = new BreakStatement(createMockLocation());

        const baseEstimate = analyzer.estimateBlockCycles([stmt]);
        const withAllPenalties = analyzer.estimateCyclesWithPenalties([stmt], 8, true);

        // 8 sprites * 2 = 16 cycles + 40 badline cycles = 56 extra cycles
        const expectedExtraCycles = 16 + 40;
        expect(withAllPenalties.avgCycles).toBeGreaterThanOrEqual(
          baseEstimate.avgCycles + expectedExtraCycles
        );
      });

      it('should mark includesHardwarePenalties as true', () => {
        const stmt = new BreakStatement(createMockLocation());

        const estimate = analyzer.estimateCyclesWithPenalties([stmt], 0, false);

        expect(estimate.includesHardwarePenalties).toBe(true);
      });
    });
  });

  // ============================================
  // Step 8.15.5: Raster Safety Metadata & Badline Warnings
  // ============================================

  describe('Raster Safety Metadata & Badline Warnings (Step 8.15.5)', () => {
    // Helper to create a mock source location
    const createMockLocation = (): SourceLocation => ({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    });

    describe('Raster Safety Metadata Generation', () => {
      it('should generate VICIIRasterSafe=true and VICIIBadlineAware=true for small code', () => {
        // Very small code: just a break statement (3 cycles)
        // Should fit within badline budget (23 cycles)
        const stmt = new BreakStatement(createMockLocation());
        const location = createMockLocation();

        analyzer.clearWarnings();
        const metadata = analyzer.generateRasterSafetyMetadata([stmt], location);

        expect(metadata.VICIIRasterSafe).toBe(true);
        expect(metadata.VICIIBadlineAware).toBe(true);
        expect(metadata.estimatedCycles).toBeLessThan(23); // Less than badline cycles
        expect(metadata.linesRequired).toBe(1);
        expect(metadata.recommendation).toBe(BadlineRecommendation.SAFE);
      });

      it('should generate VICIIRasterSafe=true and VICIIBadlineAware=false for medium code', () => {
        // Medium code that exceeds badline budget (23) but fits in normal line (63)
        // Create several variable declarations to reach ~30-50 cycles
        const stmts: Statement[] = [];
        for (let i = 0; i < 5; i++) {
          const init = new LiteralExpression(i, createMockLocation());
          stmts.push(new VariableDecl(`var${i}`, 'byte', init, createMockLocation()));
        }
        // 5 * 7 cycles = 35 cycles (plus penalties) > 23 but < 63
        const location = createMockLocation();

        analyzer.clearWarnings();
        const metadata = analyzer.generateRasterSafetyMetadata(stmts, location);

        expect(metadata.VICIIRasterSafe).toBe(true);
        expect(metadata.VICIIBadlineAware).toBe(false);
        expect(metadata.estimatedCycles).toBeGreaterThan(23);
        expect(metadata.estimatedCycles).toBeLessThanOrEqual(63);
        expect(metadata.recommendation).toBe(BadlineRecommendation.USE_STABLE_RASTER);
      });

      it('should include all required metadata properties', () => {
        const stmt = new BreakStatement(createMockLocation());
        const location = createMockLocation();

        analyzer.clearWarnings();
        const metadata = analyzer.generateRasterSafetyMetadata([stmt], location);

        expect(metadata).toHaveProperty('VICIIRasterSafe');
        expect(metadata).toHaveProperty('VICIIBadlineAware');
        expect(metadata).toHaveProperty('estimatedCycles');
        expect(metadata).toHaveProperty('maxSafeCycles');
        expect(metadata).toHaveProperty('cycleMargin');
        expect(metadata).toHaveProperty('recommendation');
        expect(metadata).toHaveProperty('linesRequired');
        expect(metadata).toHaveProperty('stableRasterCompatible');
      });
    });

    describe('Badline Warning Generation', () => {
      it('should generate warning when code exceeds badline cycles but fits normal line', () => {
        // Create code that exceeds badline (23) but fits normal (63)
        const stmts: Statement[] = [];
        for (let i = 0; i < 5; i++) {
          const init = new LiteralExpression(i, createMockLocation());
          stmts.push(new VariableDecl(`var${i}`, 'byte', init, createMockLocation()));
        }
        const location = createMockLocation();

        analyzer.clearWarnings();
        analyzer.generateBadlineWarnings(stmts, location);

        const warnings = analyzer.getWarnings();
        // Should have at least one warning about badline cycles
        expect(warnings.length).toBeGreaterThan(0);
        const badlineWarning = warnings.find((w) => w.message.includes('badline'));
        expect(badlineWarning).toBeDefined();
        expect(badlineWarning?.severity).toBe('warning');
      });

      it('should generate error when code exceeds normal raster line cycles', () => {
        // Create code that exceeds normal line (63 cycles)
        const stmts: Statement[] = [];
        for (let i = 0; i < 15; i++) {
          const init = new LiteralExpression(i, createMockLocation());
          stmts.push(new VariableDecl(`var${i}`, 'byte', init, createMockLocation()));
        }
        // 15 * 7 = 105 cycles > 63 cycles
        const location = createMockLocation();

        analyzer.clearWarnings();
        analyzer.generateBadlineWarnings(stmts, location);

        const warnings = analyzer.getWarnings();
        // Should have an error about exceeding raster line
        const errorWarning = warnings.find((w) => w.severity === 'error');
        expect(errorWarning).toBeDefined();
        expect(errorWarning?.message).toContain('exceeds raster line cycle budget');
      });
    });

    describe('Quick Safety Check Methods', () => {
      it('should correctly identify badline-aware code with isBadlineAware()', () => {
        // Small code that fits within badline budget
        const stmt = new BreakStatement(createMockLocation());

        expect(analyzer.isBadlineAware([stmt])).toBe(true);

        // Larger code that exceeds badline budget
        const stmts: Statement[] = [];
        for (let i = 0; i < 5; i++) {
          const init = new LiteralExpression(i, createMockLocation());
          stmts.push(new VariableDecl(`var${i}`, 'byte', init, createMockLocation()));
        }

        expect(analyzer.isBadlineAware(stmts)).toBe(false);
      });

      it('should correctly identify raster-safe code with isRasterSafe()', () => {
        // Small code that fits within normal line
        const stmt = new BreakStatement(createMockLocation());

        expect(analyzer.isRasterSafe([stmt])).toBe(true);

        // Very large code that exceeds normal line
        const stmts: Statement[] = [];
        for (let i = 0; i < 15; i++) {
          const init = new LiteralExpression(i, createMockLocation());
          stmts.push(new VariableDecl(`var${i}`, 'byte', init, createMockLocation()));
        }

        expect(analyzer.isRasterSafe(stmts)).toBe(false);
      });
    });
  });

  // ============================================
  // Step 8.15.6: C64HardwareAnalyzer Integration
  // ============================================

  describe('C64HardwareAnalyzer VIC-II Integration (Step 8.15.6)', () => {
    // Helper to create a mock source location
    const createMockLocation = (): SourceLocation => ({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 10, offset: 9 },
    });

    // Helper to create a minimal symbol table
    const createMinimalSymbolTable = () => {
      return new SymbolTable();
    };

    // Helper to create a minimal CFG map
    const createMinimalCFGs = () => {
      return new Map<string, ControlFlowGraph>();
    };

    describe('VIC-II Timing Analyzer Access', () => {
      it('should create VIC-II timing analyzer from C64 config', () => {
        const symbolTable = createMinimalSymbolTable();
        const cfgs = createMinimalCFGs();
        const hwAnalyzer = new C64HardwareAnalyzer(C64_CONFIG, symbolTable, cfgs);

        const vicIIAnalyzer = hwAnalyzer.getVICIITimingAnalyzer();

        expect(vicIIAnalyzer).not.toBeNull();
        expect(vicIIAnalyzer).toBeInstanceOf(VICIITimingAnalyzer);
      });

      it('should return same VIC-II analyzer instance on multiple calls', () => {
        const symbolTable = createMinimalSymbolTable();
        const cfgs = createMinimalCFGs();
        const hwAnalyzer = new C64HardwareAnalyzer(C64_CONFIG, symbolTable, cfgs);

        const analyzer1 = hwAnalyzer.getVICIITimingAnalyzer();
        const analyzer2 = hwAnalyzer.getVICIITimingAnalyzer();

        expect(analyzer1).toBe(analyzer2);
      });
    });

    describe('Raster Safety Metadata Storage', () => {
      it('should return undefined for unknown function', () => {
        const symbolTable = createMinimalSymbolTable();
        const cfgs = createMinimalCFGs();
        const hwAnalyzer = new C64HardwareAnalyzer(C64_CONFIG, symbolTable, cfgs);

        const metadata = hwAnalyzer.getRasterSafetyMetadata('unknownFunction');

        expect(metadata).toBeUndefined();
      });

      it('should return false for unknown function raster safety check', () => {
        const symbolTable = createMinimalSymbolTable();
        const cfgs = createMinimalCFGs();
        const hwAnalyzer = new C64HardwareAnalyzer(C64_CONFIG, symbolTable, cfgs);

        expect(hwAnalyzer.isFunctionRasterSafe('unknownFunction')).toBe(false);
        expect(hwAnalyzer.isFunctionBadlineAware('unknownFunction')).toBe(false);
      });

      it('should return empty map for all metadata before analysis', () => {
        const symbolTable = createMinimalSymbolTable();
        const cfgs = createMinimalCFGs();
        const hwAnalyzer = new C64HardwareAnalyzer(C64_CONFIG, symbolTable, cfgs);

        const allMetadata = hwAnalyzer.getAllRasterSafetyMetadata();

        expect(allMetadata.size).toBe(0);
      });
    });

    describe('VIC-II Warnings Access', () => {
      it('should return empty warnings before analysis', () => {
        const symbolTable = createMinimalSymbolTable();
        const cfgs = createMinimalCFGs();
        const hwAnalyzer = new C64HardwareAnalyzer(C64_CONFIG, symbolTable, cfgs);

        const warnings = hwAnalyzer.getVICIIWarnings();

        expect(warnings).toEqual([]);
      });
    });

    describe('Target Name', () => {
      it('should return "Commodore 64" as target name', () => {
        const symbolTable = createMinimalSymbolTable();
        const cfgs = createMinimalCFGs();
        const hwAnalyzer = new C64HardwareAnalyzer(C64_CONFIG, symbolTable, cfgs);

        expect(hwAnalyzer.getTargetName()).toBe('Commodore 64');
      });
    });
  });
});