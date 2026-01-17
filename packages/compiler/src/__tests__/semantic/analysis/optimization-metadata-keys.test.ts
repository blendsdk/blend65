/**
 * Tests for Optimization Metadata Keys (Task 0.1)
 *
 * Verifies that all metadata key enums are properly defined,
 * unique, and follow correct patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  OptimizationMetadataKey,
  DeadCodeKind,
  PurityLevel,
  EscapeReason,
  MemoryRegion,
  Register,
  AddressingMode,
} from '../../../semantic/analysis/optimization-metadata-keys.js';

describe('OptimizationMetadataKey enum', () => {
  it('should have all expected keys defined', () => {
    // Tier 1 keys
    expect(OptimizationMetadataKey.DefiniteAssignmentAlwaysInitialized).toBeDefined();
    expect(OptimizationMetadataKey.UsageReadCount).toBeDefined();
    expect(OptimizationMetadataKey.DeadCodeUnreachable).toBeDefined();
    expect(OptimizationMetadataKey.CallGraphUnused).toBeDefined();

    // Tier 2 keys
    expect(OptimizationMetadataKey.ReachingDefinitionsSet).toBeDefined();
    expect(OptimizationMetadataKey.LivenessLiveIn).toBeDefined();
    expect(OptimizationMetadataKey.ConstantValue).toBeDefined();

    // Tier 3 keys
    expect(OptimizationMetadataKey.AliasPointsTo).toBeDefined();
    expect(OptimizationMetadataKey.PurityLevel).toBeDefined();
    expect(OptimizationMetadataKey.EscapeEscapes).toBeDefined();
    expect(OptimizationMetadataKey.LoopInvariant).toBeDefined();
    expect(OptimizationMetadataKey.CallGraphInlineCandidate).toBeDefined();
    expect(OptimizationMetadataKey.M6502ZeroPagePriority).toBeDefined();
  });

  it('should have unique enum values', () => {
    const values = Object.values(OptimizationMetadataKey);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should use correct naming pattern', () => {
    const keys = Object.values(OptimizationMetadataKey);

    for (const key of keys) {
      // Should start with capital letter
      expect(key[0]).toMatch(/[A-Z]/);

      // Should use PascalCase (no underscores, except for special cases)
      if (!key.startsWith('M6502')) {
        expect(key).not.toContain('_');
      }
    }
  });

  it('should have 50+ metadata keys', () => {
    const keys = Object.keys(OptimizationMetadataKey);
    expect(keys.length).toBeGreaterThanOrEqual(50);
  });
});

describe('DeadCodeKind enum', () => {
  it('should have all dead code classifications', () => {
    expect(DeadCodeKind.UnreachableStatement).toBe('UnreachableStatement');
    expect(DeadCodeKind.UnreachableBranch).toBe('UnreachableBranch');
    expect(DeadCodeKind.DeadStore).toBe('DeadStore');
    expect(DeadCodeKind.UnusedResult).toBe('UnusedResult');
  });

  it('should have 4 dead code kinds', () => {
    const kinds = Object.keys(DeadCodeKind);
    expect(kinds.length).toBe(4);
  });
});

describe('PurityLevel enum', () => {
  it('should have all purity levels', () => {
    expect(PurityLevel.Pure).toBe('Pure');
    expect(PurityLevel.ReadOnly).toBe('ReadOnly');
    expect(PurityLevel.LocalEffects).toBe('LocalEffects');
    expect(PurityLevel.Impure).toBe('Impure');
  });

  it('should have 4 purity levels', () => {
    const levels = Object.keys(PurityLevel);
    expect(levels.length).toBe(4);
  });
});

describe('EscapeReason enum', () => {
  it('should have all escape reasons', () => {
    expect(EscapeReason.NoEscape).toBe('NoEscape');
    expect(EscapeReason.PassedToFunction).toBe('PassedToFunction');
    expect(EscapeReason.ReturnedFromFunction).toBe('ReturnedFromFunction');
    expect(EscapeReason.StoredGlobally).toBe('StoredGlobally');
    expect(EscapeReason.AddressTaken).toBe('AddressTaken');
  });

  it('should have 5 escape reasons', () => {
    const reasons = Object.keys(EscapeReason);
    expect(reasons.length).toBe(5);
  });
});

describe('MemoryRegion enum', () => {
  it('should have all 6502 memory regions', () => {
    expect(MemoryRegion.ZeroPage).toBe('ZeroPage');
    expect(MemoryRegion.RAM).toBe('RAM');
    expect(MemoryRegion.Hardware).toBe('Hardware');
    expect(MemoryRegion.ROM).toBe('ROM');
    expect(MemoryRegion.Unknown).toBe('Unknown');
  });

  it('should have 5 memory regions', () => {
    const regions = Object.keys(MemoryRegion);
    expect(regions.length).toBe(5);
  });
});

describe('Register enum', () => {
  it('should have all 6502 registers', () => {
    expect(Register.A).toBe('A');
    expect(Register.X).toBe('X');
    expect(Register.Y).toBe('Y');
    expect(Register.None).toBe('None');
  });

  it('should have 4 register options', () => {
    const registers = Object.keys(Register);
    expect(registers.length).toBe(4);
  });
});

describe('AddressingMode enum', () => {
  it('should have all 6502 addressing modes', () => {
    expect(AddressingMode.Immediate).toBe('Immediate');
    expect(AddressingMode.ZeroPage).toBe('ZeroPage');
    expect(AddressingMode.ZeroPageX).toBe('ZeroPageX');
    expect(AddressingMode.ZeroPageY).toBe('ZeroPageY');
    expect(AddressingMode.Absolute).toBe('Absolute');
    expect(AddressingMode.AbsoluteX).toBe('AbsoluteX');
    expect(AddressingMode.AbsoluteY).toBe('AbsoluteY');
    expect(AddressingMode.Indirect).toBe('Indirect');
    expect(AddressingMode.IndexedIndirect).toBe('IndexedIndirect');
    expect(AddressingMode.IndirectIndexed).toBe('IndirectIndexed');
  });

  it('should have 10 addressing modes', () => {
    const modes = Object.keys(AddressingMode);
    expect(modes.length).toBe(10);
  });
});

describe('Enum export verification', () => {
  it('should export all enums', () => {
    expect(OptimizationMetadataKey).toBeDefined();
    expect(DeadCodeKind).toBeDefined();
    expect(PurityLevel).toBeDefined();
    expect(EscapeReason).toBeDefined();
    expect(MemoryRegion).toBeDefined();
    expect(Register).toBeDefined();
    expect(AddressingMode).toBeDefined();
  });
});
