/**
 * E2E Pipeline Tests: Dead Function Elimination
 *
 * Tests that the Dead Function Elimination (DFE) pass correctly removes
 * unreachable functions from the final assembly output when optimization
 * is enabled at O1 or higher.
 *
 * **Test Strategy:**
 * - Compile with O0 → all functions present (no DFE)
 * - Compile with O1 → unreachable functions removed by DFE
 * - Verify reachable functions (called, exported, callback) survive DFE
 *
 * **Real-World Scenario:**
 * The border-cycle example has a `speedy()` function that is never called.
 * With O1 optimization, DFE should eliminate it from the output.
 *
 * @module __tests__/e2e/pipeline/dead-function-elim
 */

import { describe, it } from 'vitest';
import {
  compileBlend,
  expectSuccess,
  expectAssemblyContains,
  expectAssemblyNotContains,
} from './helpers.js';
import type { Blend65Config } from '../../../config/types.js';

/**
 * Helper to create a Blend65Config with the specified optimization level.
 *
 * @param optimization - The optimization level ('O0', 'O1', etc.)
 * @returns A Blend65Config targeting C64 with the given optimization
 */
function configWithOptimization(optimization: 'O0' | 'O1' | 'O2' | 'O3'): Blend65Config {
  return {
    compilerOptions: {
      target: 'c64',
      optimization,
    },
  };
}

/**
 * Border-cycle inspired source with an unreachable `speedy()` function.
 *
 * - `main()` calls `delay()` → both are reachable
 * - `speedy()` is never called → unreachable, should be eliminated by DFE
 */
const BORDER_CYCLE_SOURCE = `
module BorderCycle;

const BORDER_COLOR: word = $D020;

export function main(): void {
    let color: byte = 0;

    while (true) {
        poke(BORDER_COLOR, color);

        delay();

        color += 1;
        if (color > 15) {
            color = 0;
        }
    }
}

function delay(): void {
    for (_outer = 0 to 254) {
        for (_inner = 0 to 254) {
            barrier();
        }
    }
}

function speedy(): void {
    while (true) {
        poke(BORDER_COLOR, peek(BORDER_COLOR)+1);
    }
}
`;

/**
 * Simple source with a dead utility function for focused testing.
 *
 * - `main()` calls `helper()` → both reachable
 * - `unused()` is never called → should be eliminated by DFE
 */
const SIMPLE_DEAD_FUNCTION_SOURCE = `
export function main(): void {
    let result: byte = helper();
}

function helper(): byte {
    return 42;
}

function unused(): byte {
    return 0;
}
`;

describe('E2E: Dead Function Elimination', () => {
  // ── Border-Cycle Scenario ──────────────────────────────────────

  describe('border-cycle with dead speedy()', () => {
    it('should include speedy() in assembly at O0 (no DFE)', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configWithOptimization('O0'));
      expectSuccess(result, 'border-cycle at O0');

      // All functions should be present without optimization
      expectAssemblyContains(result, 'main', 'delay', 'speedy');
    });

    it('should remove speedy() from assembly at O1 (DFE enabled)', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configWithOptimization('O1'));
      expectSuccess(result, 'border-cycle at O1');

      // Reachable functions must survive DFE
      expectAssemblyContains(result, 'main', 'delay');

      // speedy() is unreachable → should be eliminated
      expectAssemblyNotContains(result, 'speedy');
    });

    it('should remove speedy() at O2 as well', () => {
      const result = compileBlend(BORDER_CYCLE_SOURCE, configWithOptimization('O2'));
      expectSuccess(result, 'border-cycle at O2');

      // Reachable functions survive, speedy removed
      expectAssemblyContains(result, 'main', 'delay');
      expectAssemblyNotContains(result, 'speedy');
    });
  });

  // ── Simple Dead Function Scenario ──────────────────────────────

  describe('simple program with dead function', () => {
    it('should include unused() at O0', () => {
      const result = compileBlend(SIMPLE_DEAD_FUNCTION_SOURCE, configWithOptimization('O0'));
      expectSuccess(result, 'simple program at O0');

      // All functions present without optimization
      expectAssemblyContains(result, 'main', 'helper', 'unused');
    });

    it('should remove unused() at O1', () => {
      const result = compileBlend(SIMPLE_DEAD_FUNCTION_SOURCE, configWithOptimization('O1'));
      expectSuccess(result, 'simple program at O1');

      // Reachable: main calls helper
      expectAssemblyContains(result, 'main', 'helper');

      // unused() is dead → eliminated
      expectAssemblyNotContains(result, 'unused');
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────

  describe('DFE edge cases', () => {
    it('should preserve exported functions even if not called internally', () => {
      const source = `
        export function api_init(): void {
            let x: byte = 1;
        }

        export function api_update(): void {
            let y: byte = 2;
        }

        function internal_dead(): void {
            let z: byte = 3;
        }
      `;

      const result = compileBlend(source, configWithOptimization('O1'));
      expectSuccess(result, 'exported functions preserved');

      // Exported functions must survive DFE regardless of call graph
      expectAssemblyContains(result, 'api_init', 'api_update');

      // internal_dead is not exported and not called → eliminated
      expectAssemblyNotContains(result, 'internal_dead');
    });

    it('should preserve transitively reachable functions', () => {
      const source = `
        export function main(): void {
            a();
        }

        function a(): void {
            b();
        }

        function b(): void {
            let x: byte = 99;
        }

        function orphan(): void {
            let y: byte = 0;
        }
      `;

      const result = compileBlend(source, configWithOptimization('O1'));
      expectSuccess(result, 'transitive reachability');

      // main → a → b: all reachable
      expectAssemblyContains(result, 'main', 'a', 'b');

      // orphan is not reachable from any entry point
      expectAssemblyNotContains(result, 'orphan');
    });
  });
});
