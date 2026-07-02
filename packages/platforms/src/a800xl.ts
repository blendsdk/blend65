/**
 * The Atari 800XL platform plugin — RD-10 R40; spec Ch 15 §2 + appendix-a800xl;
 * decision D4.
 *
 * Profile transcribed from appendix-a800xl §10 (`cpu: "nmos6502"`, `outputFormat:
 * "xex"`, `defaultEncoding: "atascii"`). Per D4 the codegen hooks delegate to the
 * shared C64-style bodies in this slice — the bespoke ATASCII encoder and XEX
 * preamble are deferred (the slice ships the shared default); only the profile,
 * `getMainTerminationPolicy`, and `validateProfile` carry the platform's own data.
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
 * The Atari 800XL profile (appendix-a800xl §10). `maxZp` (128) `=== zpEnd −
 * zpStart + 1` (`0xFF − 0x80 + 1`).
 */
const a800xlProfile: PlatformProfile = {
  platformId: "a800xl",
  codeStart: 0x2000,
  codeEnd: 0xbfff,
  dataStart: 0x2000,
  dataEnd: 0xbfff,
  ramStart: 0x2000,
  ramEnd: 0xbfff,
  zpStart: 0x80,
  zpEnd: 0xff,
  stackReserve: 16,
  maxBinarySize: 40960,
  maxRam: 40960,
  maxZp: 128,
  stackBudget: 234,
  outputFormat: "xex",
  loadAddress: 0x2000,
  cpu: "nmos6502",
  zpArgBlockSize: 8,
  defaultEncoding: "atascii",
  screenEncoding: "atascii",
  warnFrameSize: 64,
  warnArraySize: 256,
  clockMhz: 1.79,
  cyclesPerFrame: 29829,
};

/**
 * The Atari 800XL plugin (R40). Hooks delegate to the shared C64-style bodies
 * (D4); the ATASCII/XEX-specific bodies are deferred.
 */
export const a800xlPlugin: PlatformPlugin = {
  id: "a800xl",
  displayName: "Atari 800XL",
  profile: a800xlProfile,
  intrinsics: [], // RD-17 (D1)
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
    return { canReturn: true };
  },

  validateProfile(): ValidationError[] {
    return validateProfileVia(a800xlProfile, "a800xl");
  },
};
