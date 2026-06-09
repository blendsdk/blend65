/**
 * Shared codegen-hook bodies reused across the built-in plugins — RD-10 D4.
 *
 * In this slice the four non-MVP platforms (`c64u`, `cx16`, `a800xl`, `a7800`)
 * delegate their codegen hooks to the C64 implementations rather than shipping
 * bespoke bodies (D4). Those bodies are factored out here as small reusable
 * functions so the delegation is expressed by *importing* them — never by
 * duplicating code (code.md DRY).
 *
 * The C64-specific BASIC-stub / `$01`-banking preamble lives in `c64.ts`; this
 * module holds only the platform-neutral pieces: the PRG/PETSCII helpers the
 * other Commodore-family targets share, plus the `validateProfile` delegate.
 */

import type {
  PlatformProfile,
  StreamEntry,
  ValidationError,
} from "@blend65/core/platform";
import { validateProfileFields } from "@blend65/core/platform";
import { directive, imm8, instr, label, symbolRef } from "@blend65/core/platform";

/**
 * Encode a single character to the PETSCII MVP subset (R19/R20, D3 — the §4.5
 * table). Shared by the Commodore-family plugins (`c64`, `c64u`, `cx16`).
 *
 * @param char A single-character string.
 * @returns The encoded PETSCII byte value.
 */
export function petsciiEncodeChar(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 0x41 && code <= 0x5a) {
    return code; // A-Z → $41-$5A
  }
  if (code >= 0x61 && code <= 0x7a) {
    return code + 0x60; // a-z → $C1-$DA
  }
  if (code >= 0x30 && code <= 0x39) {
    return code; // 0-9
  }
  if (code === 0x20) {
    return 0x20; // space
  }
  if (char === "\n") {
    return 0x0d; // newline → CR
  }
  return code; // pass-through
}

/**
 * Encode a string to the PETSCII MVP subset, char by char (R19, D3).
 *
 * @param text The source string.
 * @returns The encoded byte values.
 */
export function petsciiEncodeString(text: string): number[] {
  return [...text].map((ch) => petsciiEncodeChar(ch));
}

/**
 * Build the standard Commodore `!to "<name>.prg", cbm` output directive (R18).
 *
 * @param projectName The output base name.
 * @returns The `outputFile` directive.
 */
export function prgOutputDirective(projectName: string): {
  readonly kind: "outputFile";
  readonly name: string;
  readonly format: string;
} {
  return { kind: "outputFile", name: `${projectName}.prg`, format: "cbm" };
}

/**
 * The shared C64-style startup shim (R17, §4.6). Banks out BASIC via the `$01`
 * processor port, calls `_main`, and either restores + returns (`terminating`),
 * loops forever (`non-terminating` → `JMP _main`), or emits nothing (`bare`).
 *
 * @param variant The shim variant to emit.
 * @returns The shim stream entries (empty for `"bare"`).
 */
export function c64StyleStartupShim(
  variant: "terminating" | "non-terminating" | "bare",
): StreamEntry[] {
  if (variant === "bare") {
    return [];
  }
  const entries: StreamEntry[] = [
    label("__startup"),
    instr("LDA", "Immediate", imm8(0x36)),
    instr("STA", "ZeroPage", symbolRef("$01")),
  ];
  if (variant === "terminating") {
    entries.push(
      instr("JSR", "Absolute", symbolRef("_main")),
      instr("LDA", "Immediate", imm8(0x37)),
      instr("STA", "ZeroPage", symbolRef("$01")),
      instr("RTS", "Implied", { kind: "none" }),
    );
  } else {
    entries.push(instr("JMP", "Absolute", symbolRef("_main")));
  }
  return entries;
}

/**
 * The shared C64-style preamble (R16, §4.5): `!to` directive, origin, the
 * `10 SYS 2061` BASIC stub, then the startup shim. Reused by the Commodore
 * targets whose load address is `$0801` (`c64`, `c64u`).
 *
 * @param projectName The output base name.
 * @param variant The startup-shim variant.
 * @returns The preamble stream entries.
 */
export function c64StylePreamble(
  projectName: string,
  variant: "terminating" | "non-terminating" | "bare",
): StreamEntry[] {
  return [
    directive(prgOutputDirective(projectName)),
    directive({ kind: "origin", address: 0x0801 }),
    // BASIC stub: 10 SYS 2061 (per RD-10 §4.5)
    directive({ kind: "word", values: [0x080b] }), // pointer to next BASIC line
    directive({ kind: "word", values: [0x000a] }), // line number 10
    directive({ kind: "byte", values: [0x9e] }), // SYS token
    directive({ kind: "text", text: "2061" }), // address as PETSCII text
    directive({ kind: "byte", values: [0x00] }), // end-of-line
    directive({ kind: "word", values: [0x0000] }), // end-of-program
    ...c64StyleStartupShim(variant),
  ];
}

/**
 * Validate a profile via the shared core helper (R22/FR-21). A thin delegate so
 * each plugin's `validateProfile()` reads uniformly.
 *
 * @param profile The profile to validate.
 * @returns The list of inconsistencies (empty when consistent).
 */
export function validateProfileVia(profile: PlatformProfile): ValidationError[] {
  return validateProfileFields(profile);
}
