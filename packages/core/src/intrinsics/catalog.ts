/**
 * The core intrinsic catalog — RD-17 §4.3 (AR-28, AR-98, AR-99).
 *
 * {@link CORE_INTRINSICS} is the complete user-visible catalog: all 22 Ch 12
 * intrinsics (13 CPU-control T1 + 9 memory T2, matching `RESERVED_BUILTINS`) plus
 * the 65C02-gated `asm_wai` (R2). {@link RT_ROUTINES} is the four internal
 * operator-backing T3 routines (`__rt_mul8/mul16/div8/div16`) — not user-callable,
 * not in `RESERVED_BUILTINS`, and the exact call sites shipped codegen emits for
 * `*`/`/`/`%` (AR-98).
 *
 * Cost figures follow frozen Ch 12 §3.1. The `~`-approximate runtime-routine costs
 * are data-dependent, so they carry `'varies'`; their byte size is finalised when
 * the `.asm` bodies are authored (Phase 4).
 */

import type { PlatformProfile } from "../platform/platform-profile.js";
import type { ClobberEntry, IntrinsicDescriptor } from "./descriptor.js";

/** Available on every platform/CPU (the common case). */
const ALL: (profile: PlatformProfile) => boolean = () => true;

/** Available only on the WDC 65C02 (R24) — gates `asm_wai`. */
const WDC65C02_ONLY: (profile: PlatformProfile) => boolean = (profile) =>
  profile.cpu === "wdc65c02";

/**
 * Build a T1 CPU-control descriptor: `(): void`, `'opcode'` lowering, 1 byte, on
 * every CPU (R2). The `cycles`/`clobber` differ per opcode.
 *
 * @param name The intrinsic name (e.g. `"asm_sei"`).
 * @param cycles The opcode's cycle count.
 * @param clobber The registers/status the opcode destroys.
 * @param description Hover description.
 * @returns The descriptor.
 */
function t1(
  name: string,
  cycles: number,
  clobber: readonly ClobberEntry[],
  description: string,
): IntrinsicDescriptor {
  return {
    name,
    tier: "T1",
    signature: { params: [], returnType: "void" },
    availability: ALL,
    loweringStrategy: "opcode",
    costMetadata: { cycles, bytes: 1, zpBytes: 0 },
    clobberList: clobber,
    description,
  };
}

/**
 * Build an internal T3 operator-backing runtime routine descriptor: `'call'`
 * lowering, `asmModulePath` set, available everywhere (AR-98).
 *
 * @param name The `__rt_*` symbol.
 * @param params The parameter list.
 * @param returnType The declared return type.
 * @param clobber Registers/status the routine destroys.
 * @param zpBytes ZP arg-block bytes the routine consumes.
 * @param description Hover description.
 * @returns The descriptor.
 */
function rt(
  name: string,
  params: IntrinsicDescriptor["signature"]["params"],
  returnType: IntrinsicDescriptor["signature"]["returnType"],
  clobber: readonly ClobberEntry[],
  zpBytes: number,
  description: string,
): IntrinsicDescriptor {
  return {
    name,
    tier: "T3",
    signature: { params, returnType },
    availability: ALL,
    loweringStrategy: "call",
    costMetadata: { cycles: "varies", bytes: "varies", zpBytes },
    clobberList: clobber,
    description,
    asmModulePath: `runtime/${name.replace(/^__rt_/, "")}.asm`,
  };
}

/**
 * The 9 memory T2 intrinsics (Ch 12 §3). `lo`/`hi` use `'inline'` with a
 * constant-fold optimisation in the emitter (PF-021); `sizeof`/`offsetof`/`length`
 * always fold (`'fold'`).
 */
const MEMORY_INTRINSICS: readonly IntrinsicDescriptor[] = [
  {
    name: "peek",
    tier: "T2",
    signature: { params: [{ name: "addr", type: "word" }], returnType: "byte" },
    availability: ALL,
    loweringStrategy: "inline",
    costMetadata: { cycles: 4, bytes: 3, zpBytes: 0 },
    clobberList: ["A"],
    description: "Read a byte from an absolute memory address (LDA abs).",
  },
  {
    name: "poke",
    tier: "T2",
    signature: {
      params: [
        { name: "addr", type: "word" },
        { name: "val", type: "byte" },
      ],
      returnType: "void",
    },
    availability: ALL,
    loweringStrategy: "inline",
    costMetadata: { cycles: 4, bytes: 3, zpBytes: 0 },
    clobberList: ["A"],
    description: "Write a byte to an absolute memory address (STA abs).",
  },
  {
    name: "peekw",
    tier: "T2",
    signature: { params: [{ name: "addr", type: "word" }], returnType: "word" },
    availability: ALL,
    loweringStrategy: "inline",
    costMetadata: { cycles: 8, bytes: 6, zpBytes: 0 },
    clobberList: ["A", "X"],
    description: "Read a little-endian word from an absolute address (LDA abs / LDX abs+1).",
  },
  {
    name: "pokew",
    tier: "T2",
    signature: {
      params: [
        { name: "addr", type: "word" },
        { name: "val", type: "word" },
      ],
      returnType: "void",
    },
    availability: ALL,
    loweringStrategy: "inline",
    costMetadata: { cycles: 8, bytes: 6, zpBytes: 0 },
    clobberList: ["A"],
    description: "Write a little-endian word to an absolute address (STA abs / STA abs+1).",
  },
  {
    name: "lo",
    tier: "T2",
    signature: { params: [{ name: "val", type: "word" }], returnType: "byte" },
    availability: ALL,
    loweringStrategy: "inline",
    costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 0 },
    clobberList: ["A"],
    description: "The low byte of a word (folds a constant, else AND #$FF).",
  },
  {
    name: "hi",
    tier: "T2",
    signature: { params: [{ name: "val", type: "word" }], returnType: "byte" },
    availability: ALL,
    loweringStrategy: "inline",
    costMetadata: { cycles: "varies", bytes: "varies", zpBytes: 0 },
    clobberList: ["A"],
    description: "The high byte of a word (folds a constant, else shift/extract).",
  },
  {
    name: "sizeof",
    tier: "T2",
    signature: { params: [{ name: "type", type: "byte" }], returnType: "byte" },
    availability: ALL,
    loweringStrategy: "fold",
    costMetadata: { cycles: 0, bytes: 0, zpBytes: 0 },
    clobberList: [],
    description: "The byte size of a type (compile-time constant).",
  },
  {
    name: "offsetof",
    tier: "T2",
    signature: { params: [{ name: "type", type: "byte" }], returnType: "byte" },
    availability: ALL,
    loweringStrategy: "fold",
    costMetadata: { cycles: 0, bytes: 0, zpBytes: 0 },
    clobberList: [],
    description: "The byte offset of a struct field (compile-time constant).",
  },
  {
    name: "length",
    tier: "T2",
    signature: { params: [{ name: "array", type: "byte" }], returnType: "word" },
    availability: ALL,
    loweringStrategy: "fold",
    costMetadata: { cycles: 0, bytes: 0, zpBytes: 0 },
    clobberList: [],
    description: "The element count of an array (compile-time constant; byte if <=255, else word).",
  },
];

/**
 * The 13 CPU-control T1 intrinsics (Ch 12 §2) + the 65C02-gated `asm_wai` (R2).
 * Cost/clobber follow the underlying 6502 opcode semantics.
 */
const CPU_CONTROL_INTRINSICS: readonly IntrinsicDescriptor[] = [
  t1("asm_sei", 2, ["status"], "Set interrupt-disable flag (SEI)."),
  t1("asm_cli", 2, ["status"], "Clear interrupt-disable flag (CLI)."),
  t1("asm_pha", 3, [], "Push the accumulator (PHA)."),
  t1("asm_pla", 4, ["A", "status"], "Pull the accumulator (PLA)."),
  t1("asm_php", 3, [], "Push the processor status (PHP)."),
  t1("asm_plp", 4, ["status"], "Pull the processor status (PLP)."),
  t1("asm_clc", 2, ["status"], "Clear the carry flag (CLC)."),
  t1("asm_sec", 2, ["status"], "Set the carry flag (SEC)."),
  t1("asm_cld", 2, ["status"], "Clear decimal mode (CLD)."),
  t1("asm_sed", 2, ["status"], "Set decimal mode (SED)."),
  t1("asm_clv", 2, ["status"], "Clear the overflow flag (CLV)."),
  t1("asm_nop", 2, [], "No operation (NOP)."),
  t1("asm_brk", 7, ["status"], "Force a break/interrupt (BRK)."),
  {
    ...t1("asm_wai", 3, [], "Wait for interrupt — halts the CPU until an IRQ/NMI (WAI, 65C02 only)."),
    // 65C02-gated: cost varies (halts until an interrupt), unlike the fixed T1 costs.
    costMetadata: { cycles: "varies", bytes: 1, zpBytes: 0 },
    availability: WDC65C02_ONLY,
  },
];

/**
 * The complete user-visible core intrinsic catalog: 22 Ch 12 names + `asm_wai`
 * (AC-01). Registered as the reserved, availability-gated set.
 */
export const CORE_INTRINSICS: readonly IntrinsicDescriptor[] = [
  ...MEMORY_INTRINSICS,
  ...CPU_CONTROL_INTRINSICS,
];

/**
 * The four internal operator-backing T3 runtime routines (AR-98). ZP-byte usage:
 * `mul16`/`div16` pass their second word operand through 2 ZP arg-block bytes
 * (`div16` reuses those slots for the remainder — AR-P7); `mul8`/`div8` pass both
 * operands in registers.
 */
export const RT_ROUTINES: readonly IntrinsicDescriptor[] = [
  rt(
    "__rt_mul8",
    [
      { name: "a", type: "byte" },
      { name: "b", type: "byte" },
    ],
    "word",
    ["A", "X", "status"],
    0,
    "Unsigned 8-bit multiply: a*b. a->A, b->X; product A(lo)/X(hi).",
  ),
  rt(
    "__rt_mul16",
    [
      { name: "a", type: "word" },
      { name: "b", type: "word" },
    ],
    "word",
    ["A", "X", "Y", "status"],
    2,
    "Unsigned 16-bit multiply: a*b. a->A/X, b->ZP arg-block; product A(lo)/X(hi).",
  ),
  rt(
    "__rt_div8",
    [
      { name: "a", type: "byte" },
      { name: "b", type: "byte" },
    ],
    "byte",
    ["A", "X", "status"],
    0,
    "Unsigned 8-bit divide: a/b. a->A, b->X; quotient->A, remainder->X.",
  ),
  rt(
    "__rt_div16",
    [
      { name: "a", type: "word" },
      { name: "b", type: "word" },
    ],
    "word",
    ["A", "X", "Y", "status"],
    2,
    "Unsigned 16-bit divide: a/b. a->A/X, b->ZP arg-block; quotient->A(lo)/X(hi), remainder->ZP arg-block.",
  ),
];
