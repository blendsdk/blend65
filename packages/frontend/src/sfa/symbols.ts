/**
 * The SFA ACME symbol generator (spec Ch 11 §3.5).
 *
 * Produces the `__`-prefixed, address-valued {@link SymbolDefinition}s the ACME
 * emitter writes into the `.asm` header so generated code can reference frame
 * bases, frame slots, module variables, and zero-page slots by name. The `__`
 * prefix and `[A-Za-z0-9_]`-only sanitization guarantee these never collide with
 * user labels.
 *
 * Naming scheme:
 *   - `__frame_<Module>_<function>`        — frame base (= `absoluteAddress`)
 *   - `__frame_<Module>_<function>_<slot>` — slot (= base + `slot.offset`)
 *   - `__var_<Module>_<name>`              — module variable (= its `address`)
 *   - the ZP allocation's own name         — ZP slot (= its `address`)
 *
 * Emission order is deterministic — frames (by name), then module variables (in
 * layout order), then ZP allocations (in allocation order) — so the emitted header
 * is stable for golden snapshots.
 *
 * Imports `@blend65/core` only — never `@blend65/codegen`.
 */

import type {
  FrameAllocation,
  ModuleVariableAllocation,
  ZpAllocation,
  SymbolDefinition,
} from "@blend65/core";

/** The placement records the symbol generator reads (a subset of the plan). */
export interface SymbolSources {
  /** Placed frames, keyed by fully-qualified function name. */
  readonly frames: ReadonlyMap<string, FrameAllocation>;
  /** Placed module-level variables, in layout order. */
  readonly moduleVariables: readonly ModuleVariableAllocation[];
  /** Placed zero-page allocations, in allocation order. */
  readonly zpAllocations: readonly ZpAllocation[];
}

/**
 * Sanitizes a name fragment to the ACME-safe `[A-Za-z0-9_]` set, mapping every
 * other character (notably the `.` in `Module.function`) to `_`.
 */
function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}

/**
 * Generates the deterministic ACME symbol definitions for a plan.
 *
 * @param sources The placed frames, module variables, and ZP allocations.
 * @returns Symbol definitions in the stable frames → vars → ZP order.
 */
export function generateSymbolDefinitions(sources: SymbolSources): SymbolDefinition[] {
  const symbols: SymbolDefinition[] = [];

  // Frames, ordered by fully-qualified function name for a stable header.
  const frameNames = [...sources.frames.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const fnName of frameNames) {
    const fa = sources.frames.get(fnName)!;
    const base = `__frame_${sanitize(fa.functionName)}`;
    // Frame base symbol = the frame's absolute address.
    symbols.push({ name: base, value: fa.absoluteAddress });
    // Slot symbols = base + each slot's offset.
    for (const slot of fa.frame.slots) {
      symbols.push({
        name: `${base}_${sanitize(slot.name)}`,
        value: fa.absoluteAddress + slot.offset,
      });
    }
  }

  // Module variables, in layout order.
  for (const mv of sources.moduleVariables) {
    symbols.push({
      name: `__var_${sanitize(mv.moduleName)}_${sanitize(mv.variableName)}`,
      value: mv.address,
    });
  }

  // Zero-page allocations, in allocation order. Generated slot names
  // (`__zp_ptr_N`, …) are already ACME-safe; user var names are sanitized.
  for (const zp of sources.zpAllocations) {
    symbols.push({ name: sanitize(zp.name), value: zp.address });
  }

  return symbols;
}
