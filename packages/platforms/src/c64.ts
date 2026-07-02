/**
 * The Commodore 64 platform plugin — RD-10 R16–R22, R26, R33, R37; spec Ch 15 §4
 * + appendix-c64; decisions D1/D3/D4.
 *
 * The C64 is the MVP platform (R33) and the reference for the four non-MVP
 * plugins, which delegate to the shared hook bodies in `shared-hooks.ts` (D4).
 * It implements the full {@link PlatformPlugin} contract: the profile *data*
 * (transcribed from the frozen appendix-c64) plus the six codegen *hooks*. Every
 * hook output is pure {@link StreamEntry}/{@link AcmeDirective} data the shipped
 * `printInstr` (`@blend65/codegen`) renders to deterministic ACME text, so the
 * goldens verify real serialized output.
 *
 * Per D1 the `.asm` runtime bodies and the intrinsic descriptors are deferred to
 * RD-17 — only their metadata is declared here.
 */

import type {
  AcmeDirective,
  MainTerminationPolicy,
  PlatformPlugin,
  PlatformProfile,
  PreambleOptions,
  ShimVariant,
  StreamEntry,
  ValidationError,
} from "@blend65/core/platform";
import {
  c64StylePreamble,
  c64StyleStartupShim,
  petsciiEncodeChar,
  petsciiEncodeString,
  prgOutputDirective,
  validateProfileVia,
} from "./shared-hooks.js";

/**
 * The C64 profile (appendix-c64, R37). `maxZp` (142) equals
 * `zpEnd − zpStart + 1` (`0x8F − 0x02 + 1`), so `validateProfile()` passes its
 * own consistency check (FR-12 / R22).
 */
const c64Profile: PlatformProfile = {
  // identity
  platformId: "c64",
  // memory map
  codeStart: 0x0801,
  codeEnd: 0xcfff,
  dataStart: 0x0801,
  dataEnd: 0xcfff,
  ramStart: 0x0801,
  ramEnd: 0xcfff,
  zpStart: 0x02,
  zpEnd: 0x8f,
  stackReserve: 20,
  // budgets
  maxBinarySize: 26623,
  maxRam: 26623,
  maxZp: 142,
  stackBudget: 230,
  // output
  outputFormat: "prg",
  loadAddress: 0x0801,
  // cpu
  cpu: "nmos6502",
  // zp arg-block
  zpArgBlockSize: 8,
  // encoding
  defaultEncoding: "petscii",
  screenEncoding: "petscii",
  // warnings
  warnFrameSize: 64,
  warnArraySize: 256,
  // informational
  clockMhz: 0.985,
  cyclesPerFrame: 19656,
};

/**
 * The Commodore 64 platform plugin (R1/R33).
 */
export const c64Plugin: PlatformPlugin = {
  id: "c64",
  displayName: "Commodore 64",
  profile: c64Profile,
  intrinsics: [], // RD-17 populates (D1)
  // The mul/div operator-backing routines are codegen-owned T3 modules
  // (RD-17 AR-98), not platform contributions; genuine T4 modules go here.
  runtimeModules: [],

  emitPreamble(options: PreambleOptions): StreamEntry[] {
    return c64StylePreamble(options.projectName, options.shimVariant);
  },

  emitStartupShim(variant: ShimVariant): StreamEntry[] {
    return c64StyleStartupShim(variant);
  },

  getOutputDirective(projectName: string): AcmeDirective {
    return prgOutputDirective(projectName);
  },

  encodeChar(char: string): number {
    return petsciiEncodeChar(char);
  },

  encodeString(text: string): number[] {
    return petsciiEncodeString(text);
  },

  getMainTerminationPolicy(): MainTerminationPolicy {
    return { canReturn: true }; // C64 main can return (restore BASIC) — AC-08
  },

  validateProfile(): ValidationError[] {
    return validateProfileVia(c64Profile, "c64");
  },
};
