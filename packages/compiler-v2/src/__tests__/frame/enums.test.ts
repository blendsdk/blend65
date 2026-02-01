/**
 * Frame Enums Tests
 *
 * Comprehensive tests for SFA enum types:
 * - SlotLocation
 * - SlotKind
 * - ZpDirective
 * - ThreadContext
 * - DiagnosticSeverity
 *
 * @module frame/enums.test
 */

import { describe, it, expect } from 'vitest';
import {
  SlotLocation,
  SlotKind,
  ZpDirective,
  ThreadContext,
  DiagnosticSeverity,
} from '../../frame/index.js';

// ============================================================================
// SlotLocation Tests
// ============================================================================

describe('SlotLocation', () => {
  describe('enum values', () => {
    it('should have ZeroPage value', () => {
      expect(SlotLocation.ZeroPage).toBe('zp');
    });

    it('should have FrameRegion value', () => {
      expect(SlotLocation.FrameRegion).toBe('frame');
    });

    it('should have Register value', () => {
      expect(SlotLocation.Register).toBe('register');
    });
  });

  describe('enum membership', () => {
    it('should have exactly 3 members', () => {
      const values = Object.values(SlotLocation);
      expect(values).toHaveLength(3);
    });

    it('should contain all expected members', () => {
      const values = Object.values(SlotLocation);
      expect(values).toContain('zp');
      expect(values).toContain('frame');
      expect(values).toContain('register');
    });
  });

  describe('type safety', () => {
    it('should be usable as string literal', () => {
      const location: SlotLocation = SlotLocation.ZeroPage;
      expect(location).toBe('zp');
    });

    it('should be comparable to string', () => {
      const location = SlotLocation.FrameRegion;
      expect(location === 'frame').toBe(true);
    });
  });

  describe('use cases', () => {
    it('should work in switch statements', () => {
      const getAccessCycles = (location: SlotLocation): number => {
        switch (location) {
          case SlotLocation.ZeroPage:
            return 3; // Fastest: 2-byte instructions
          case SlotLocation.FrameRegion:
            return 4; // Normal: 3-byte instructions
          case SlotLocation.Register:
            return 2; // Fastest: no memory access
        }
      };

      expect(getAccessCycles(SlotLocation.ZeroPage)).toBe(3);
      expect(getAccessCycles(SlotLocation.FrameRegion)).toBe(4);
      expect(getAccessCycles(SlotLocation.Register)).toBe(2);
    });
  });
});

// ============================================================================
// SlotKind Tests
// ============================================================================

describe('SlotKind', () => {
  describe('enum values', () => {
    it('should have Parameter value', () => {
      expect(SlotKind.Parameter).toBe('parameter');
    });

    it('should have Local value', () => {
      expect(SlotKind.Local).toBe('local');
    });

    it('should have Return value', () => {
      expect(SlotKind.Return).toBe('return');
    });

    it('should have Temporary value', () => {
      expect(SlotKind.Temporary).toBe('temporary');
    });
  });

  describe('enum membership', () => {
    it('should have exactly 4 members', () => {
      const values = Object.values(SlotKind);
      expect(values).toHaveLength(4);
    });

    it('should contain all expected members', () => {
      const values = Object.values(SlotKind);
      expect(values).toContain('parameter');
      expect(values).toContain('local');
      expect(values).toContain('return');
      expect(values).toContain('temporary');
    });
  });

  describe('type safety', () => {
    it('should be usable as string literal', () => {
      const kind: SlotKind = SlotKind.Local;
      expect(kind).toBe('local');
    });

    it('should be comparable to string', () => {
      const kind = SlotKind.Parameter;
      expect(kind === 'parameter').toBe(true);
    });
  });

  describe('use cases', () => {
    it('should work in categorization', () => {
      const isUserDefined = (kind: SlotKind): boolean => {
        return kind === SlotKind.Parameter || kind === SlotKind.Local;
      };

      expect(isUserDefined(SlotKind.Parameter)).toBe(true);
      expect(isUserDefined(SlotKind.Local)).toBe(true);
      expect(isUserDefined(SlotKind.Return)).toBe(false);
      expect(isUserDefined(SlotKind.Temporary)).toBe(false);
    });

    it('should work in allocation ordering', () => {
      // Frame slot allocation order: Parameter -> Return -> Local -> Temporary
      const getAllocationOrder = (kind: SlotKind): number => {
        switch (kind) {
          case SlotKind.Parameter:
            return 0;
          case SlotKind.Return:
            return 1;
          case SlotKind.Local:
            return 2;
          case SlotKind.Temporary:
            return 3;
        }
      };

      expect(getAllocationOrder(SlotKind.Parameter)).toBe(0);
      expect(getAllocationOrder(SlotKind.Return)).toBe(1);
      expect(getAllocationOrder(SlotKind.Local)).toBe(2);
      expect(getAllocationOrder(SlotKind.Temporary)).toBe(3);
    });
  });
});

// ============================================================================
// ZpDirective Tests
// ============================================================================

describe('ZpDirective', () => {
  describe('enum values', () => {
    it('should have None value', () => {
      expect(ZpDirective.None).toBe('none');
    });

    it('should have Zp value', () => {
      expect(ZpDirective.Zp).toBe('zp');
    });

    it('should have Ram value', () => {
      expect(ZpDirective.Ram).toBe('ram');
    });
  });

  describe('enum membership', () => {
    it('should have exactly 3 members', () => {
      const values = Object.values(ZpDirective);
      expect(values).toHaveLength(3);
    });

    it('should contain all expected members', () => {
      const values = Object.values(ZpDirective);
      expect(values).toContain('none');
      expect(values).toContain('zp');
      expect(values).toContain('ram');
    });

    it('should NOT have a "prefer" option (by design)', () => {
      const values = Object.values(ZpDirective);
      expect(values).not.toContain('prefer');
    });
  });

  describe('type safety', () => {
    it('should be usable as string literal', () => {
      const directive: ZpDirective = ZpDirective.Zp;
      expect(directive).toBe('zp');
    });

    it('should be comparable to string', () => {
      const directive = ZpDirective.Ram;
      expect(directive === 'ram').toBe(true);
    });
  });

  describe('allocation behavior', () => {
    it('should identify forced ZP allocation', () => {
      const mustBeZp = (directive: ZpDirective): boolean => {
        return directive === ZpDirective.Zp;
      };

      expect(mustBeZp(ZpDirective.Zp)).toBe(true);
      expect(mustBeZp(ZpDirective.Ram)).toBe(false);
      expect(mustBeZp(ZpDirective.None)).toBe(false);
    });

    it('should identify forced RAM allocation', () => {
      const mustBeRam = (directive: ZpDirective): boolean => {
        return directive === ZpDirective.Ram;
      };

      expect(mustBeRam(ZpDirective.Ram)).toBe(true);
      expect(mustBeRam(ZpDirective.Zp)).toBe(false);
      expect(mustBeRam(ZpDirective.None)).toBe(false);
    });

    it('should identify compiler-decides allocation', () => {
      const compilerDecides = (directive: ZpDirective): boolean => {
        return directive === ZpDirective.None;
      };

      expect(compilerDecides(ZpDirective.None)).toBe(true);
      expect(compilerDecides(ZpDirective.Zp)).toBe(false);
      expect(compilerDecides(ZpDirective.Ram)).toBe(false);
    });

    it('should handle ZP overflow logic', () => {
      const handleZpOverflow = (
        directive: ZpDirective,
        zpAvailable: boolean,
      ): 'zp' | 'ram' | 'error' => {
        switch (directive) {
          case ZpDirective.Zp:
            return zpAvailable ? 'zp' : 'error'; // Error if ZP required but full
          case ZpDirective.Ram:
            return 'ram'; // Always RAM
          case ZpDirective.None:
            return zpAvailable ? 'zp' : 'ram'; // Silent fallback
        }
      };

      // ZP available
      expect(handleZpOverflow(ZpDirective.Zp, true)).toBe('zp');
      expect(handleZpOverflow(ZpDirective.Ram, true)).toBe('ram');
      expect(handleZpOverflow(ZpDirective.None, true)).toBe('zp');

      // ZP full
      expect(handleZpOverflow(ZpDirective.Zp, false)).toBe('error');
      expect(handleZpOverflow(ZpDirective.Ram, false)).toBe('ram');
      expect(handleZpOverflow(ZpDirective.None, false)).toBe('ram');
    });
  });
});

// ============================================================================
// ThreadContext Tests
// ============================================================================

describe('ThreadContext', () => {
  describe('enum values', () => {
    it('should have MainOnly value', () => {
      expect(ThreadContext.MainOnly).toBe('main');
    });

    it('should have IsrOnly value', () => {
      expect(ThreadContext.IsrOnly).toBe('isr');
    });

    it('should have Both value', () => {
      expect(ThreadContext.Both).toBe('both');
    });
  });

  describe('enum membership', () => {
    it('should have exactly 3 members', () => {
      const values = Object.values(ThreadContext);
      expect(values).toHaveLength(3);
    });

    it('should contain all expected members', () => {
      const values = Object.values(ThreadContext);
      expect(values).toContain('main');
      expect(values).toContain('isr');
      expect(values).toContain('both');
    });
  });

  describe('type safety', () => {
    it('should be usable as string literal', () => {
      const context: ThreadContext = ThreadContext.MainOnly;
      expect(context).toBe('main');
    });

    it('should be comparable to string', () => {
      const context = ThreadContext.IsrOnly;
      expect(context === 'isr').toBe(true);
    });
  });

  describe('coalescing rules', () => {
    it('should identify coalesceable contexts', () => {
      const canCoalesce = (
        ctx1: ThreadContext,
        ctx2: ThreadContext,
      ): boolean => {
        // Both contexts must be pure (not Both) and different
        // Same context -> same call chain -> cannot coalesce
        // Different pure contexts -> never overlap -> can coalesce
        if (ctx1 === ThreadContext.Both || ctx2 === ThreadContext.Both) {
          return false;
        }
        return ctx1 !== ctx2;
      };

      // MainOnly and IsrOnly can coalesce (never run simultaneously)
      expect(canCoalesce(ThreadContext.MainOnly, ThreadContext.IsrOnly)).toBe(
        true,
      );
      expect(canCoalesce(ThreadContext.IsrOnly, ThreadContext.MainOnly)).toBe(
        true,
      );

      // Same context cannot coalesce (same call chain)
      expect(canCoalesce(ThreadContext.MainOnly, ThreadContext.MainOnly)).toBe(
        false,
      );
      expect(canCoalesce(ThreadContext.IsrOnly, ThreadContext.IsrOnly)).toBe(
        false,
      );

      // Both cannot coalesce with anything
      expect(canCoalesce(ThreadContext.Both, ThreadContext.MainOnly)).toBe(
        false,
      );
      expect(canCoalesce(ThreadContext.Both, ThreadContext.IsrOnly)).toBe(
        false,
      );
      expect(canCoalesce(ThreadContext.Both, ThreadContext.Both)).toBe(false);
    });

    it('should identify interrupt-safe functions', () => {
      const isInterruptSafe = (context: ThreadContext): boolean => {
        return context === ThreadContext.IsrOnly || context === ThreadContext.Both;
      };

      expect(isInterruptSafe(ThreadContext.IsrOnly)).toBe(true);
      expect(isInterruptSafe(ThreadContext.Both)).toBe(true);
      expect(isInterruptSafe(ThreadContext.MainOnly)).toBe(false);
    });

    it('should identify main-only functions', () => {
      const isMainOnly = (context: ThreadContext): boolean => {
        return context === ThreadContext.MainOnly;
      };

      expect(isMainOnly(ThreadContext.MainOnly)).toBe(true);
      expect(isMainOnly(ThreadContext.IsrOnly)).toBe(false);
      expect(isMainOnly(ThreadContext.Both)).toBe(false);
    });
  });
});

// ============================================================================
// DiagnosticSeverity Tests
// ============================================================================

describe('DiagnosticSeverity', () => {
  describe('enum values', () => {
    it('should have Error value', () => {
      expect(DiagnosticSeverity.Error).toBe('error');
    });

    it('should have Warning value', () => {
      expect(DiagnosticSeverity.Warning).toBe('warning');
    });

    it('should have Info value', () => {
      expect(DiagnosticSeverity.Info).toBe('info');
    });
  });

  describe('enum membership', () => {
    it('should have exactly 3 members', () => {
      const values = Object.values(DiagnosticSeverity);
      expect(values).toHaveLength(3);
    });

    it('should contain all expected members', () => {
      const values = Object.values(DiagnosticSeverity);
      expect(values).toContain('error');
      expect(values).toContain('warning');
      expect(values).toContain('info');
    });
  });

  describe('type safety', () => {
    it('should be usable as string literal', () => {
      const severity: DiagnosticSeverity = DiagnosticSeverity.Error;
      expect(severity).toBe('error');
    });

    it('should be comparable to string', () => {
      const severity = DiagnosticSeverity.Warning;
      expect(severity === 'warning').toBe(true);
    });
  });

  describe('severity ordering', () => {
    it('should have correct severity priority', () => {
      const getSeverityLevel = (severity: DiagnosticSeverity): number => {
        switch (severity) {
          case DiagnosticSeverity.Error:
            return 0; // Highest priority
          case DiagnosticSeverity.Warning:
            return 1;
          case DiagnosticSeverity.Info:
            return 2; // Lowest priority
        }
      };

      expect(getSeverityLevel(DiagnosticSeverity.Error)).toBeLessThan(
        getSeverityLevel(DiagnosticSeverity.Warning),
      );
      expect(getSeverityLevel(DiagnosticSeverity.Warning)).toBeLessThan(
        getSeverityLevel(DiagnosticSeverity.Info),
      );
    });

    it('should identify compilation-stopping severity', () => {
      const stopsCompilation = (severity: DiagnosticSeverity): boolean => {
        return severity === DiagnosticSeverity.Error;
      };

      expect(stopsCompilation(DiagnosticSeverity.Error)).toBe(true);
      expect(stopsCompilation(DiagnosticSeverity.Warning)).toBe(false);
      expect(stopsCompilation(DiagnosticSeverity.Info)).toBe(false);
    });
  });

  describe('use cases', () => {
    it('should work for diagnostic filtering', () => {
      type Diagnostic = { severity: DiagnosticSeverity; message: string };

      const diagnostics: Diagnostic[] = [
        { severity: DiagnosticSeverity.Error, message: 'ZP overflow' },
        { severity: DiagnosticSeverity.Warning, message: 'Large frame' },
        { severity: DiagnosticSeverity.Info, message: 'Coalesced 3 frames' },
      ];

      const errors = diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Error,
      );
      const warnings = diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Warning,
      );
      const infos = diagnostics.filter(
        (d) => d.severity === DiagnosticSeverity.Info,
      );

      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(infos).toHaveLength(1);
    });
  });
});

// ============================================================================
// Cross-Enum Integration Tests
// ============================================================================

describe('Enum Integration', () => {
  it('should work together in frame slot context', () => {
    // Simulated frame slot structure using all enums
    interface MockFrameSlot {
      name: string;
      location: SlotLocation;
      kind: SlotKind;
      zpDirective: ZpDirective;
    }

    const slot: MockFrameSlot = {
      name: 'counter',
      location: SlotLocation.ZeroPage,
      kind: SlotKind.Local,
      zpDirective: ZpDirective.Zp,
    };

    expect(slot.location).toBe(SlotLocation.ZeroPage);
    expect(slot.kind).toBe(SlotKind.Local);
    expect(slot.zpDirective).toBe(ZpDirective.Zp);
  });

  it('should support complex allocation decisions', () => {
    interface AllocationDecision {
      slot: { kind: SlotKind; zpDirective: ZpDirective };
      result: SlotLocation;
      diagnostic?: { severity: DiagnosticSeverity; message: string };
    }

    // ZP requested and available
    const decision1: AllocationDecision = {
      slot: { kind: SlotKind.Local, zpDirective: ZpDirective.Zp },
      result: SlotLocation.ZeroPage,
    };

    // ZP requested but not available
    const decision2: AllocationDecision = {
      slot: { kind: SlotKind.Local, zpDirective: ZpDirective.Zp },
      result: SlotLocation.FrameRegion, // Will be error in real impl
      diagnostic: {
        severity: DiagnosticSeverity.Error,
        message: 'ZP overflow: cannot allocate to zero page',
      },
    };

    expect(decision1.result).toBe(SlotLocation.ZeroPage);
    expect(decision1.diagnostic).toBeUndefined();

    expect(decision2.result).toBe(SlotLocation.FrameRegion);
    expect(decision2.diagnostic?.severity).toBe(DiagnosticSeverity.Error);
  });

  it('should handle thread context with slot allocation', () => {
    interface FunctionContext {
      name: string;
      threadContext: ThreadContext;
      slots: Array<{ kind: SlotKind; location: SlotLocation }>;
    }

    const mainFunc: FunctionContext = {
      name: 'main',
      threadContext: ThreadContext.MainOnly,
      slots: [{ kind: SlotKind.Local, location: SlotLocation.FrameRegion }],
    };

    const isrHandler: FunctionContext = {
      name: 'handleIrq',
      threadContext: ThreadContext.IsrOnly,
      slots: [{ kind: SlotKind.Parameter, location: SlotLocation.Register }],
    };

    expect(mainFunc.threadContext).toBe(ThreadContext.MainOnly);
    expect(isrHandler.threadContext).toBe(ThreadContext.IsrOnly);

    // These can coalesce (different thread contexts)
    const canCoalesce =
      mainFunc.threadContext !== isrHandler.threadContext &&
      mainFunc.threadContext !== ThreadContext.Both &&
      isrHandler.threadContext !== ThreadContext.Both;

    expect(canCoalesce).toBe(true);
  });
});

// ============================================================================
// Export Verification Tests
// ============================================================================

describe('Module Exports', () => {
  it('should export SlotLocation', () => {
    expect(SlotLocation).toBeDefined();
  });

  it('should export SlotKind', () => {
    expect(SlotKind).toBeDefined();
  });

  it('should export ZpDirective', () => {
    expect(ZpDirective).toBeDefined();
  });

  it('should export ThreadContext', () => {
    expect(ThreadContext).toBeDefined();
  });

  it('should export DiagnosticSeverity', () => {
    expect(DiagnosticSeverity).toBeDefined();
  });
});