/**
 * The universal intrinsic names reserved across every Blend65 platform (AR-3).
 *
 * Spec Ch 12 defines two groups of intrinsics that exist on all targets: 13 CPU
 * control intrinsics (§2) and 9 memory intrinsics (§3). RD-17 (R2) adds the
 * 65C02-gated `asm_wai` as the 23rd reserved name — reserved on every target
 * (availability gating happens in semantic analysis, not here). The
 * parser uses this set to decide whether an `Identifier` immediately followed by
 * `(` is an {@link IntrinsicCallExprNode} (a hit) or an ordinary `CallExpr`
 * (a miss). Platform encoders (Ch 15) are *not* universal and are deliberately
 * excluded — they resolve to normal calls and are validated by later phases.
 *
 * Arity and argument-type checking belong to semantic analysis (RD-04); this set
 * only governs the syntactic intrinsic-vs-call decision.
 */

/**
 * The 23 universal intrinsic names (13 CPU control + `asm_wai` + 9 memory) from
 * spec Ch 12 (+ RD-17 R2's 65C02-gated `asm_wai`).
 */
export const RESERVED_BUILTINS: ReadonlySet<string> = new Set([
  // CPU control (13) — spec Ch 12 §2
  "asm_sei",
  "asm_cli",
  "asm_pha",
  "asm_pla",
  "asm_php",
  "asm_plp",
  "asm_clc",
  "asm_sec",
  "asm_cld",
  "asm_sed",
  "asm_clv",
  "asm_nop",
  "asm_brk",
  // CPU control — 65C02-gated (RD-17 R2)
  "asm_wai",
  // Memory (9) — spec Ch 12 §3
  "peek",
  "poke",
  "peekw",
  "pokew",
  "lo",
  "hi",
  "sizeof",
  "offsetof",
  "length",
]);
