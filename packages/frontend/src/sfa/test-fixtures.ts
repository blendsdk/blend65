/**
 * Shared test fixtures for the RD-05 SFA planner passes.
 *
 * Provides the C64-shaped interim `PlatformProfile` (the budget values listed in
 * plans/rd-05-sfa-frame-planner/03-03-zp-and-layout.md) and small builders for
 * `FunctionInfo` / `FrameVar` / struct & array `Type`s, so the frame-computation,
 * interference, coloring, ZP, stack, budget, symbol, and plan-assembly suites all
 * construct inputs the same way (DRY — code.md §1).
 *
 * This is test-support data only (no compiler logic); it is **not** re-exported
 * from the package barrel. It imports `@blend65/core` only — never
 * `@blend65/codegen` (R15/AR-20).
 */

import type {
  FunctionInfo,
  FrameVar,
  PlatformProfile,
  Type,
  StructType,
  ArrayType,
  StructDeclNode,
  SourceSpan,
} from "@blend65/core";
import { primitive } from "@blend65/core";

/**
 * A C64-shaped interim platform profile for SFA tests (RD-05 D2/D8).
 *
 * Values from 03-03-zp-and-layout.md: RAM `[0x0800, 0xA000)` (38 912 bytes), ZP
 * `[0x02, 0x2F]` (46 inclusive bytes), `stackBudget` 230, `zpArgBlockMin` 0 (D8 —
 * the arg-block floor is deferred to RD-17), `mainTempBytes` 4, `irqTempBytes` 2,
 * and the 0.80/0.90/0.75 warn thresholds.
 */
export const C64_FIXTURE_PROFILE: PlatformProfile = {
  name: "c64",
  charEncoding: "petscii",
  ramStart: 0x0800,
  ramEnd: 0xa000,
  zpStart: 0x02,
  zpEnd: 0x2f,
  stackBudget: 230,
  zpArgBlockMin: 0,
  mainTempBytes: 4,
  irqTempBytes: 2,
  zpWarnThreshold: 0.8,
  ramWarnThreshold: 0.9,
  stackWarnThreshold: 0.75,
};

/** A zero-width span for the synthetic decl node used as struct-type provenance. */
const SPAN: SourceSpan = { sourceId: 0, start: 0, end: 0 };

/**
 * Builds a {@link StructType} of the given byte size, with a minimal synthetic
 * declaration node so `StructType.decl` references a real AST node.
 *
 * @param name The struct's name.
 * @param byteSize The struct's total size in bytes.
 * @returns A `StructType` record.
 */
export function structType(name: string, byteSize: number): StructType {
  const decl: StructDeclNode = {
    kind: "StructDecl",
    exported: false,
    name,
    nameSpan: SPAN,
    fields: [],
    span: SPAN,
  };
  return { kind: "struct", name, decl, fields: new Map(), byteSize };
}

/**
 * Builds an {@link ArrayType} `element[size]`.
 *
 * @param element The element type.
 * @param size The compile-time element count.
 * @returns An `ArrayType` record.
 */
export function arrayType(element: Type, size: number): ArrayType {
  return { kind: "array", element, size };
}

/**
 * Builds a {@link FrameVar} with the given name and type.
 *
 * @param name The variable's name.
 * @param type The resolved semantic type.
 * @param byRef `true` for a by-reference struct/array parameter (default `false`).
 * @returns A `FrameVar` record.
 */
export function frameVar(name: string, type: Type, byRef = false): FrameVar {
  return { name, type, byRef };
}

/** Convenience: a `byte`-typed value `FrameVar`. */
export function byteVar(name: string): FrameVar {
  return frameVar(name, primitive("byte"));
}

/** Convenience: a `word`-typed value `FrameVar`. */
export function wordVar(name: string): FrameVar {
  return frameVar(name, primitive("word"));
}

/** Optional fields for {@link makeFn}; everything not given gets a sensible default. */
export interface FnOptions {
  readonly parameters?: readonly FrameVar[];
  readonly locals?: readonly FrameVar[];
  readonly isInterrupt?: boolean;
  readonly isEscaped?: boolean;
  readonly isReachable?: boolean;
  readonly callees?: readonly string[];
}

/**
 * Builds a {@link FunctionInfo} with defaults: no params/locals, not
 * interrupt/escaped, reachable, no callees. Override any field via `opts`.
 *
 * @param name The fully-qualified function name.
 * @param opts Optional overrides for the function's fields.
 * @returns A `FunctionInfo` record.
 */
export function makeFn(name: string, opts: FnOptions = {}): FunctionInfo {
  return {
    name,
    parameters: opts.parameters ?? [],
    locals: opts.locals ?? [],
    isInterrupt: opts.isInterrupt ?? false,
    isEscaped: opts.isEscaped ?? false,
    isReachable: opts.isReachable ?? true,
    callees: opts.callees ?? [],
  };
}
