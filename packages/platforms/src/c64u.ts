/**
 * The Commodore 64 Ultimate platform plugin — RD-10 R35/R38; spec Ch 15 §2 +
 * appendix-c64u; decision D4.
 *
 * The C64 Ultimate is a hardware-enhanced C64: its base profile is identical to
 * the C64's (appendix-c64u §10), differing only in optional REU/turbo hardware
 * exposed through platform libraries (not the core profile). In this slice the
 * codegen hooks delegate to the shared C64-style bodies (D4); only the profile
 * data is carried here. REU intrinsics are RD-17 (`intrinsics: []`).
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
 * The C64 Ultimate profile (appendix-c64u §10). Identical memory map / budgets
 * to the C64; REU memory is a platform-library concern, not the core map.
 * `maxZp` (142) `=== zpEnd − zpStart + 1`.
 */
const c64uProfile: PlatformProfile = {
  codeStart: 0x0801,
  codeEnd: 0xcfff,
  dataStart: 0x0801,
  dataEnd: 0xcfff,
  ramStart: 0x0801,
  ramEnd: 0xcfff,
  zpStart: 0x02,
  zpEnd: 0x8f,
  stackReserve: 20,
  maxBinarySize: 26623,
  maxRam: 26623,
  maxZp: 142,
  stackBudget: 230,
  outputFormat: "prg",
  loadAddress: 0x0801,
  cpu: "nmos6502",
  zpArgBlockSize: 8,
  defaultEncoding: "petscii",
  screenEncoding: "petscii",
  warnFrameSize: 64,
  warnArraySize: 256,
  clockMhz: 0.985,
  cyclesPerFrame: 19656,
};

/**
 * The Commodore 64 Ultimate plugin (R35). Hooks delegate to the shared
 * C64-style bodies (D4).
 */
export const c64uPlugin: PlatformPlugin = {
  id: "c64u",
  displayName: "Commodore 64 Ultimate",
  profile: c64uProfile,
  intrinsics: [], // REU intrinsics are RD-17 (D1)
  runtimeModules: [
    { name: "mul8", asmPath: "runtime/mul8.asm", exports: ["__rt_mul8"] },
    { name: "mul16", asmPath: "runtime/mul16.asm", exports: ["__rt_mul16"] },
    { name: "div8", asmPath: "runtime/div8.asm", exports: ["__rt_div8"] },
    { name: "div16", asmPath: "runtime/div16.asm", exports: ["__rt_div16"] },
  ],

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
    return { canReturn: true };
  },

  validateProfile(): ValidationError[] {
    return validateProfileVia(c64uProfile);
  },
};
