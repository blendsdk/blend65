/**
 * Shared codegen-hook bodies reused across the built-in plugins.
 *
 * In this slice the four non-MVP platforms (`c64u`, `cx16`, `a800xl`, `a7800`)
 * delegate their codegen hooks to the C64 implementations rather than shipping
 * bespoke bodies. Those bodies are factored out here as small reusable
 * functions so the delegation is expressed by *importing* them — never by
 * duplicating code.
 *
 * The C64-specific BASIC-stub / `$01`-banking preamble lives in `c64.ts`; this
 * module holds only the platform-neutral pieces: the PRG/PETSCII helpers the
 * other Commodore-family targets share, plus the `validateProfile` delegate.
 */

import type {
  CharEncoder,
  PlatformProfile,
  StreamEntry,
  ValidationError,
} from "@blend65/core/platform";
import { encoderFor, validateProfileFields } from "@blend65/core/platform";
import { directive, imm8, instr, label, symbolRef } from "@blend65/core/platform";

/**
 * Adapt a core encoder to the total plugin-hook shape. The hook API predates
 * the fallible core encoders and returns a plain `number`, so an unmappable
 * character falls back to its own code point — the hooks are platform
 * tooling/test surface only; the compile path uses the fallible core
 * encoders directly and diagnoses unmappable characters instead.
 */
function hookEncodeChar(encoder: CharEncoder, char: string): number {
  const cp = char.codePointAt(0);
  if (cp === undefined) return 0;
  return encoder.encodeCodePoint(cp) ?? cp;
}

const PETSCII = encoderFor("petscii");
const ATASCII = encoderFor("atascii");
const ASCII = encoderFor("ascii");

/**
 * Encode a single character to PETSCII via the core encoder. Shared by the
 * Commodore-family plugins (`c64`, `c64u`, `cx16`).
 *
 * @param char A single-character string.
 * @returns The encoded PETSCII byte value.
 */
export function petsciiEncodeChar(char: string): number {
  return hookEncodeChar(PETSCII, char);
}

/**
 * Encode a string to PETSCII, char by char, via the core encoder.
 *
 * @param text The source string.
 * @returns The encoded byte values.
 */
export function petsciiEncodeString(text: string): number[] {
  return [...text].map((ch) => petsciiEncodeChar(ch));
}

/**
 * Encode a single character to ATASCII via the core encoder (Atari 800XL).
 *
 * @param char A single-character string.
 * @returns The encoded ATASCII byte value.
 */
export function atasciiEncodeChar(char: string): number {
  return hookEncodeChar(ATASCII, char);
}

/**
 * Encode a string to ATASCII, char by char, via the core encoder.
 *
 * @param text The source string.
 * @returns The encoded byte values.
 */
export function atasciiEncodeString(text: string): number[] {
  return [...text].map((ch) => atasciiEncodeChar(ch));
}

/**
 * Encode a single character to plain ASCII via the core encoder (Atari 7800).
 *
 * @param char A single-character string.
 * @returns The encoded ASCII byte value.
 */
export function asciiEncodeChar(char: string): number {
  return hookEncodeChar(ASCII, char);
}

/**
 * Encode a string to plain ASCII, char by char, via the core encoder.
 *
 * @param text The source string.
 * @returns The encoded byte values.
 */
export function asciiEncodeString(text: string): number[] {
  return [...text].map((ch) => asciiEncodeChar(ch));
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
 * processor port, calls the module-initializer routine (`__init`) when the
 * program has one — after banking, so initializers run in the same memory
 * configuration as `main` — then calls `_main`, and either restores + returns
 * (`terminating`), loops forever (`non-terminating` → `JMP _main`), or emits
 * nothing (`bare`). Under `bare` the user owns the ENTIRE entry sequence:
 * the `__init` routine, when present, is emitted with its label and it is the
 * user's job to call it — exactly as they own calling `_main`.
 *
 * @param variant The shim variant to emit.
 * @param hasInitCode Whether to call `__init` before `_main` (default `false`).
 * @returns The shim stream entries (empty for `"bare"`).
 */
export function c64StyleStartupShim(
  variant: "terminating" | "non-terminating" | "bare",
  hasInitCode = false,
): StreamEntry[] {
  if (variant === "bare") {
    return [];
  }
  const entries: StreamEntry[] = [
    label("__startup"),
    instr("LDA", "Immediate", imm8(0x36)),
    instr("STA", "ZeroPage", symbolRef("$01")),
  ];
  if (hasInitCode) {
    entries.push(instr("JSR", "Absolute", symbolRef("__init")));
  }
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
 * @param hasInitCode Whether the shim calls `__init` before `_main`
 *   (default `false`).
 * @returns The preamble stream entries.
 */
export function c64StylePreamble(
  projectName: string,
  variant: "terminating" | "non-terminating" | "bare",
  hasInitCode = false,
): StreamEntry[] {
  return [
    directive(prgOutputDirective(projectName)),
    directive({ kind: "origin", address: 0x0801 }),
    // BASIC stub: 10 SYS 2061
    directive({ kind: "word", values: [0x080b] }), // pointer to next BASIC line
    directive({ kind: "word", values: [0x000a] }), // line number 10
    directive({ kind: "byte", values: [0x9e] }), // SYS token
    directive({ kind: "text", text: "2061" }), // address as PETSCII text
    directive({ kind: "byte", values: [0x00] }), // end-of-line
    directive({ kind: "word", values: [0x0000] }), // end-of-program
    ...c64StyleStartupShim(variant, hasInitCode),
  ];
}

/**
 * Validate a profile via the shared core helper, plus the platform-identity
 * consistency check: the profile's `platformId` must equal the owning
 * plugin's `id`. A thin delegate so each plugin's `validateProfile()` reads
 * uniformly.
 *
 * @param profile The profile to validate.
 * @param expectedPlatformId The owning plugin's `id`; the profile's `platformId`
 *   must match it, since T4 intrinsic availability is keyed on this identity.
 * @returns The list of inconsistencies (empty when consistent).
 */
export function validateProfileVia(
  profile: PlatformProfile,
  expectedPlatformId: string,
): ValidationError[] {
  const errors = validateProfileFields(profile);
  if (profile.platformId !== expectedPlatformId) {
    errors.push({
      field: "platformId",
      message: `platformId ("${profile.platformId}") must equal the plugin id ("${expectedPlatformId}")`,
    });
  }
  return errors;
}
