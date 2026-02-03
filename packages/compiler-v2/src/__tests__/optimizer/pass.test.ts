/**
 * Tests for Optimization Pass Interface
 *
 * @module __tests__/optimizer/pass.test
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyResult,
  createResult,
  mergeResults,
  type PassResult,
  type OptimizationPass,
  type PassStats,
  type OptimizationResult,
} from '../../optimizer/pass.js';

// ============================================================================
// createEmptyResult Tests
// ============================================================================

describe('createEmptyResult', () => {
  it('should return result with modified=false', () => {
    const result = createEmptyResult();
    expect(result.modified).toBe(false);
  });

  it('should return result with zero instructions removed', () => {
    const result = createEmptyResult();
    expect(result.instructionsRemoved).toBe(0);
  });

  it('should return result with zero instructions added', () => {
    const result = createEmptyResult();
    expect(result.instructionsAdded).toBe(0);
  });

  it('should not include debugInfo', () => {
    const result = createEmptyResult();
    expect(result.debugInfo).toBeUndefined();
  });
});

// ============================================================================
// createResult Tests
// ============================================================================

describe('createResult', () => {
  it('should set modified=true when instructions removed', () => {
    const result = createResult(3, 0);
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(3);
    expect(result.instructionsAdded).toBe(0);
  });

  it('should set modified=true when instructions added', () => {
    const result = createResult(0, 2);
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(0);
    expect(result.instructionsAdded).toBe(2);
  });

  it('should set modified=true when both removed and added', () => {
    const result = createResult(3, 2);
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(3);
    expect(result.instructionsAdded).toBe(2);
  });

  it('should set modified=false when nothing changed', () => {
    const result = createResult(0, 0);
    expect(result.modified).toBe(false);
  });

  it('should include debugInfo when provided', () => {
    const result = createResult(1, 0, ['Removed dead store at index 5']);
    expect(result.debugInfo).toEqual(['Removed dead store at index 5']);
  });

  it('should not include debugInfo when not provided', () => {
    const result = createResult(1, 0);
    expect(result.debugInfo).toBeUndefined();
  });

  it('should handle multiple debug messages', () => {
    const debugInfo = ['Message 1', 'Message 2', 'Message 3'];
    const result = createResult(3, 0, debugInfo);
    expect(result.debugInfo).toEqual(debugInfo);
  });
});

// ============================================================================
// mergeResults Tests
// ============================================================================

describe('mergeResults', () => {
  it('should handle empty array', () => {
    const result = mergeResults([]);
    expect(result.modified).toBe(false);
    expect(result.instructionsRemoved).toBe(0);
    expect(result.instructionsAdded).toBe(0);
    expect(result.debugInfo).toBeUndefined();
  });

  it('should handle single result', () => {
    const result = mergeResults([createResult(3, 1)]);
    expect(result.modified).toBe(true);
    expect(result.instructionsRemoved).toBe(3);
    expect(result.instructionsAdded).toBe(1);
  });

  it('should sum removed and added across results', () => {
    const result = mergeResults([
      createResult(3, 0),
      createResult(2, 1),
      createResult(0, 2),
    ]);
    expect(result.instructionsRemoved).toBe(5);
    expect(result.instructionsAdded).toBe(3);
  });

  it('should set modified=true if any result modified', () => {
    const result = mergeResults([
      createEmptyResult(),
      createResult(1, 0),
      createEmptyResult(),
    ]);
    expect(result.modified).toBe(true);
  });

  it('should set modified=false if no result modified', () => {
    const result = mergeResults([
      createEmptyResult(),
      createEmptyResult(),
    ]);
    expect(result.modified).toBe(false);
  });

  it('should merge debugInfo from all results', () => {
    const result = mergeResults([
      createResult(1, 0, ['Message 1']),
      createResult(2, 0, ['Message 2', 'Message 3']),
    ]);
    expect(result.debugInfo).toEqual(['Message 1', 'Message 2', 'Message 3']);
  });

  it('should handle results with undefined debugInfo', () => {
    const result = mergeResults([
      createResult(1, 0),
      createResult(2, 0, ['Message']),
      createResult(3, 0),
    ]);
    expect(result.debugInfo).toEqual(['Message']);
  });

  it('should return undefined debugInfo if no messages', () => {
    const result = mergeResults([
      createResult(1, 0),
      createResult(2, 0),
    ]);
    expect(result.debugInfo).toBeUndefined();
  });
});

// ============================================================================
// PassResult Interface Tests
// ============================================================================

describe('PassResult interface', () => {
  it('should accept minimal result', () => {
    const result: PassResult = {
      modified: false,
      instructionsRemoved: 0,
      instructionsAdded: 0,
    };
    expect(result.modified).toBe(false);
  });

  it('should accept result with debugInfo', () => {
    const result: PassResult = {
      modified: true,
      instructionsRemoved: 5,
      instructionsAdded: 2,
      debugInfo: ['Some debug info'],
    };
    expect(result.debugInfo).toBeDefined();
  });
});

// ============================================================================
// PassStats Interface Tests
// ============================================================================

describe('PassStats interface', () => {
  it('should accept minimal stats', () => {
    const stats: PassStats = {
      pass: 'dce',
      iteration: 1,
      instructionsBefore: 50,
      instructionsAfter: 47,
      modified: true,
    };
    expect(stats.pass).toBe('dce');
    expect(stats.iteration).toBe(1);
    expect(stats.instructionsBefore).toBe(50);
    expect(stats.instructionsAfter).toBe(47);
    expect(stats.modified).toBe(true);
  });

  it('should accept stats with durationMs', () => {
    const stats: PassStats = {
      pass: 'constant-fold',
      iteration: 2,
      instructionsBefore: 100,
      instructionsAfter: 95,
      modified: true,
      durationMs: 2.5,
    };
    expect(stats.durationMs).toBe(2.5);
  });
});

// ============================================================================
// OptimizationResult Interface Tests
// ============================================================================

describe('OptimizationResult interface', () => {
  it('should accept complete result', () => {
    const result: OptimizationResult = {
      modified: true,
      stats: [
        {
          pass: 'dce',
          iteration: 1,
          instructionsBefore: 50,
          instructionsAfter: 47,
          modified: true,
        },
      ],
      totalIterations: 1,
      totalInstructionsRemoved: 3,
      totalInstructionsAdded: 0,
      totalDurationMs: 10.5,
    };
    expect(result.modified).toBe(true);
    expect(result.stats).toHaveLength(1);
    expect(result.totalIterations).toBe(1);
    expect(result.totalInstructionsRemoved).toBe(3);
  });

  it('should accept result with empty stats', () => {
    const result: OptimizationResult = {
      modified: false,
      stats: [],
      totalIterations: 0,
      totalInstructionsRemoved: 0,
      totalInstructionsAdded: 0,
      totalDurationMs: 0,
    };
    expect(result.stats).toEqual([]);
  });
});

// ============================================================================
// OptimizationPass Interface Tests
// ============================================================================

describe('OptimizationPass interface', () => {
  it('should accept pass implementation', () => {
    // Mock pass for type checking
    const mockPass: OptimizationPass = {
      name: 'test-pass',
      dependencies: [],
      run: () => createEmptyResult(),
    };
    expect(mockPass.name).toBe('test-pass');
    expect(mockPass.dependencies).toEqual([]);
  });

  it('should accept pass with dependencies', () => {
    const mockPass: OptimizationPass = {
      name: 'copy-prop',
      dependencies: ['constant-prop'],
      run: () => createResult(2, 0),
    };
    expect(mockPass.dependencies).toContain('constant-prop');
  });

  it('should call run method correctly', () => {
    let runCalled = false;
    const mockPass: OptimizationPass = {
      name: 'test-pass',
      dependencies: [],
      run: () => {
        runCalled = true;
        return createResult(1, 0);
      },
    };

    const result = mockPass.run(
      // Minimal ILFunction mock
      {
        name: 'test',
        frame: {} as never,
        instructions: [],
        isExported: false,
        isCallback: false,
        loops: [],
        maxLoopDepth: 0,
      },
      { level: 'O2' }
    );

    expect(runCalled).toBe(true);
    expect(result.modified).toBe(true);
  });
});