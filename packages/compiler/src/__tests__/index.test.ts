/**
 * Blend65 Compiler v2 - Basic Tests
 *
 * Placeholder test file to verify the test infrastructure works.
 * Will be expanded as modules are implemented.
 */

import { describe, it, expect } from 'vitest';
import { VERSION } from '../index.js';

describe('Compiler v2', () => {
  describe('Package Setup', () => {
    it('should export VERSION', () => {
      expect(VERSION).toBe('0.1.0');
    });

    it('should be a valid semver version', () => {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});