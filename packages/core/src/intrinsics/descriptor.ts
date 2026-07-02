/**
 * Intrinsic descriptor types — RD-17 §4.1 (AR-29, R6–R10, R17).
 *
 * The single typed contract the compiler consults for every built-in/platform
 * callable operation. It replaces two shipped placeholders (PF-010): the
 * `type IntrinsicDescriptor = unknown` in `platform/platform-plugin.ts` and the
 * `{ name, tier?, clobbers? }` shape in `codegen/src/il/intrinsic-descriptor.ts`.
 * The compiler never special-cases an individual intrinsic name — it looks the
 * descriptor up in the {@link IntrinsicRegistry} and dispatches on its fields
 * (AC-17).
 */

import type { PlatformProfile } from "../platform/platform-profile.js";

/**
 * The four-tier taxonomy (R1): T1 opcode, T2 inline/compile-time, T3 core runtime
 * routine, T4 platform runtime routine. No intrinsic spans tiers.
 */
export type IntrinsicTier = "T1" | "T2" | "T3" | "T4";

/**
 * How IL→Instr lowering handles the intrinsic (R17). Tier mapping: T1→`'opcode'`,
 * T2→`'inline'` or `'fold'`, T3/T4→`'call'`.
 */
export type LoweringStrategy = "opcode" | "inline" | "fold" | "call";

/** A register/status side effect a routine destroys (R10). */
export type ClobberEntry = "A" | "X" | "Y" | "status";

/**
 * A type reference in an intrinsic signature (RD-17 §4.1).
 *
 * `'boolean'` matches the semantic type system's spelling (`PrimitiveName` in
 * `core/semantics/type.ts`). The `'pointer'` kind is the ABI-level marshalling
 * view (R29) only — the frontend type-checks calls against semantic array/struct
 * types; no user-facing pointer type exists in the language.
 */
export type TypeRef =
  | "byte"
  | "sbyte"
  | "word"
  | "sword"
  | "boolean"
  | "void"
  | { kind: "pointer"; elementType: TypeRef }
  | { kind: "array"; elementType: TypeRef };

/** A single intrinsic parameter (R7). */
export interface IntrinsicParam {
  /** Parameter name (documentation/hover). */
  readonly name: string;
  /** Parameter type. */
  readonly type: TypeRef;
}

/** An intrinsic's parameter list and return type (R7). */
export interface IntrinsicSignature {
  /** Ordered parameter list. */
  readonly params: readonly IntrinsicParam[];
  /** The return type (`'void'` for statement-form intrinsics). */
  readonly returnType: TypeRef;
}

/**
 * Cycle/byte/ZP cost metadata for hover documentation and build-summary
 * annotations (R9). `'varies'` marks routines with data-dependent paths.
 */
export interface CostMetadata {
  /** Cycle count, or `'varies'` for data-dependent paths. */
  readonly cycles: number | "varies";
  /** Generated-code byte count, or `'varies'`. */
  readonly bytes: number | "varies";
  /** Zero-page bytes consumed (from the arg-block or otherwise). */
  readonly zpBytes: number;
}

/**
 * The typed descriptor for one intrinsic (R6). The compiler consults this rather
 * than special-casing the name.
 */
export interface IntrinsicDescriptor {
  /** Intrinsic name, e.g. `"peek"`, `"asm_sei"`, `"__rt_mul8"`. */
  readonly name: string;
  /** Tier classification (R1). */
  readonly tier: IntrinsicTier;
  /** Parameter and return types (R7). */
  readonly signature: IntrinsicSignature;
  /**
   * Availability predicate keyed on `profile.cpu` and/or `profile.platformId`
   * (R8/R24/R25). `false` for the active target ⇒ calling it is a compile-time
   * error (E10043).
   */
  readonly availability: (profile: PlatformProfile) => boolean;
  /** How to lower this intrinsic (R17). */
  readonly loweringStrategy: LoweringStrategy;
  /** Cycle/byte/ZP cost metadata (R9). */
  readonly costMetadata: CostMetadata;
  /** Registers/status this intrinsic clobbers (R10). */
  readonly clobberList: readonly ClobberEntry[];
  /** Human-readable description for hover/docs. */
  readonly description: string;
  /**
   * For T3/T4: the `.asm` module path relative to the owning package. For T1/T2:
   * `undefined` (emitted inline by codegen).
   */
  readonly asmModulePath?: string;

  /**
   * The contributing platform's id, stamped by the registry merge for T4
   * descriptors (R25/PF-015). Core T1–T3 descriptors carry `undefined`. Drives
   * the E10043 "requires platform X" and E10046 import-hint messages (AR-P11/
   * AR-P14) without special-casing any name.
   */
  readonly platformId?: string;
}
