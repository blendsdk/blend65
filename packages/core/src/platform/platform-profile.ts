/**
 * The canonical RD-10 `PlatformProfile` data type + its value enums — spec Ch 15 §3,
 * RD-10 R6–R15 (§4.2); decisions D2/D6.
 *
 * This is a **new** type (D6), distinct from the interim `PlatformProfile` in
 * `core/src/semantics/platform-profile.ts` (RD-04/RD-05), which is left untouched
 * until a later migration. The canonical profile is exported only from the
 * `@blend65/core/platform` subpath barrel — never the root barrel.
 *
 * A profile is pure compile-time data: every field is `readonly`. The `cpu` field
 * uses the shared canonical {@link CpuVariant} (D2) so codegen's CPU-validation
 * tables and the platform profiles agree on exactly one type.
 */

import type { CpuVariant } from "../instr-model/cpu-variant.js";

/**
 * The binary container format a platform emits (Ch 15 §3.1).
 *
 * - `"prg"` — Commodore PRG (2-byte load address header): C64, C64 Ultimate.
 * - `"bin"` — raw binary blob.
 * - `"rom"` — ROM image.
 * - `"xex"` — Atari executable: Atari 800XL.
 * - `"a78"` — Atari 7800 cartridge image (with `.a78` header).
 */
export type OutputFormat = "prg" | "bin" | "rom" | "xex" | "a78";

/**
 * The character encoding a platform's string literals are emitted in (Ch 15 §3.2).
 *
 * - `"petscii"` — Commodore PETSCII: C64, C64 Ultimate, Commander X16.
 * - `"atascii"` — Atari ATASCII: Atari 800XL, Atari 7800.
 * - `"ascii"` — plain ASCII (fallback).
 */
export type CharEncoding = "petscii" | "atascii" | "ascii";

/**
 * The canonical RD-10 platform profile (spec Ch 15 §3) — the data half of a
 * {@link PlatformPlugin}. Pure compile-time constant data.
 *
 * Required fields cover the memory map (§3.1), resource budgets, output format,
 * CPU variant, and the ZP arg-block size (AR-34). Optional fields cover character
 * encodings (§3.2), embed-format handlers, platform warning thresholds, and
 * informational clock/frame metadata.
 */
export interface PlatformProfile {
  // --- Memory map (required, Ch 15 §3.1) ---
  /** First address of the code segment. */
  readonly codeStart: number;
  /** Last address of the code segment (exclusive-upper convention per §3.1). */
  readonly codeEnd: number;
  /** First address of the initialised-data segment. */
  readonly dataStart: number;
  /** Last address of the initialised-data segment. */
  readonly dataEnd: number;
  /** First address of general RAM. */
  readonly ramStart: number;
  /** Last address of general RAM. */
  readonly ramEnd: number;
  /** First usable zero-page address. */
  readonly zpStart: number;
  /** Last usable zero-page address. */
  readonly zpEnd: number;
  /** Bytes of hardware stack reserved (e.g. for the KERNAL/IRQ). */
  readonly stackReserve: number;

  // --- Resource budgets (required) ---
  /** Maximum emitted binary size in bytes. */
  readonly maxBinarySize: number;
  /** Maximum usable RAM in bytes. */
  readonly maxRam: number;
  /** Maximum usable zero-page bytes (must equal `zpEnd - zpStart + 1`). */
  readonly maxZp: number;
  /** Usable hardware-stack budget (`256 - stackReserve - IRQ overhead`). */
  readonly stackBudget: number;

  // --- Output format (required) ---
  /** The binary container format emitted for this platform. */
  readonly outputFormat: OutputFormat;
  /** The load address the binary is assembled at. */
  readonly loadAddress: number;

  // --- CPU (required) ---
  /** The CPU instruction-set variant (shared canonical type, D2). */
  readonly cpu: CpuVariant;

  // --- ZP arg-block (required, AR-34) ---
  /** Zero-page bytes reserved for the cross-function argument block. */
  readonly zpArgBlockSize: number;

  // --- Character encoding (optional, Ch 15 §3.2) ---
  /** Encoding used for string literals; absent ⇒ raw ASCII bytes. */
  readonly defaultEncoding?: CharEncoding;
  /** Encoding used for direct screen-memory writes, if different. */
  readonly screenEncoding?: CharEncoding;

  // --- Embed format handlers (optional) ---
  /** Map of file extension → embed-handler id, for `embed`/asset inclusion. */
  readonly embedFormats?: ReadonlyMap<string, string>;

  // --- Platform-specific warnings (optional) ---
  /** Frame size (bytes) above which the planner warns (Tier-1 escape hatch). */
  readonly warnFrameSize?: number;
  /** Array size (bytes) above which the compiler warns. */
  readonly warnArraySize?: number;

  // --- Informational (optional) ---
  /** CPU clock in MHz (informational; cost reporting). */
  readonly clockMhz?: number;
  /** CPU cycles available per video frame (informational). */
  readonly cyclesPerFrame?: number;
}
