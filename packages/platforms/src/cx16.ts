/**
 * The Commander X16 platform plugin; spec Ch 15 §2 + appendix-cx16.
 *
 * The CX16 is a modern WDC 65C02 platform (`cpu: "wdc65c02"`, enabling
 * 65C02 opcodes/modes via the shared `CpuVariant`). Profile transcribed from
 * appendix-cx16 §10. In this slice the codegen hooks delegate to the shared
 * C64-style bodies (the CX16 uses the same PRG/BASIC-stub loader). Banked
 * RAM / VERA specifics are platform libraries, not the core profile.
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
 * The Commander X16 profile (appendix-cx16 §10). `maxZp` (94) `=== zpEnd −
 * zpStart + 1` (`0x7F − 0x22 + 1`).
 */
const cx16Profile: PlatformProfile = {
  platformId: "cx16",
  codeStart: 0x0800,
  codeEnd: 0x9eff,
  dataStart: 0x0800,
  dataEnd: 0x9eff,
  ramStart: 0x0800,
  ramEnd: 0x9eff,
  zpStart: 0x22,
  zpEnd: 0x7f,
  stackReserve: 16,
  maxBinarySize: 38656,
  maxRam: 38656,
  maxZp: 94,
  stackBudget: 234,
  outputFormat: "prg",
  loadAddress: 0x0801,
  cpu: "wdc65c02",
  zpArgBlockSize: 8,
  defaultEncoding: "petscii",
  screenEncoding: "petscii",
  warnFrameSize: 256,
  warnArraySize: 1024,
  clockMhz: 8.0,
  cyclesPerFrame: 133333,
};

/**
 * The Commander X16 plugin (R36). Hooks delegate to the shared C64-style bodies
 * (D4).
 */
export const cx16Plugin: PlatformPlugin = {
  id: "cx16",
  displayName: "Commander X16",
  profile: cx16Profile,
  intrinsics: [], // asm_wai() etc. are populated once that runtime support is wired up
  // The mul/div operator-backing routines are codegen-owned T3 modules,
  // not platform contributions; genuine T4 modules go here.
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
    return { canReturn: true };
  },

  validateProfile(): ValidationError[] {
    return validateProfileVia(cx16Profile, "cx16");
  },
};
