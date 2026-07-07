/**
 * The canonical `CpuVariant` primitive.
 *
 * This is the **single canonical** CPU-variant discriminant for the whole
 * toolchain. It lives in `@blend65/core` so both the codegen CPU legality
 * tables and the `PlatformProfile.cpu` field share exactly one type without a
 * circular dependency. `@blend65/codegen` re-exports it from its `instr/`
 * barrel so every import path resolves unchanged.
 *
 * The 65C02 spelling is the shipped value `"wdc65c02"`: the frozen spec writes
 * `65c02`, but renaming the value would churn fully-tested codegen validation
 * tables for a cosmetic difference. If a human-facing rendering ever needs the
 * spec spelling, that is a display-boundary concern — it does not change this
 * internal discriminant.
 */

/**
 * The CPU variant a stream / platform profile targets.
 *
 * - `"nmos6502"` — the universal NMOS 6502 (C64, C64 Ultimate, Atari 800XL,
 *   Atari 7800).
 * - `"wdc65c02"` — the WDC 65C02 superset (Commander X16), which adds 8 opcodes
 *   and the `(zp)` addressing mode.
 */
export type CpuVariant = "nmos6502" | "wdc65c02";
