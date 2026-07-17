/**
 * The Atari 800XL platform plugin; spec Ch 15 §2 + appendix-a800xl.
 *
 * Profile transcribed from appendix-a800xl §10 (`cpu: "nmos6502"`, `outputFormat:
 * "xex"`, `defaultEncoding: "atascii"`). The encode hooks delegate to the core
 * ATASCII encoder; the remaining codegen hooks delegate to the shared C64-style
 * bodies — the bespoke XEX preamble is deferred (the slice ships the shared
 * default); only the profile, `getMainTerminationPolicy`, and `validateProfile`
 * carry the platform's own data.
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
  atasciiEncodeChar,
  atasciiEncodeString,
  c64StylePreamble,
  c64StyleStartupShim,
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
 * The Atari 800XL plugin (R40). Encode hooks use the core ATASCII encoder;
 * the codegen hooks delegate to the shared C64-style bodies (D4) — the
 * XEX-specific bodies are deferred.
 */
export const a800xlPlugin: PlatformPlugin = {
  id: "a800xl",
  displayName: "Atari 800XL",
  profile: a800xlProfile,
  intrinsics: [], // populated once the runtime intrinsics are wired up
  // The mul/div operator-backing routines are codegen-owned T3 modules,
  // not platform contributions; genuine T4 modules go here.
  runtimeModules: [],

  emitPreamble(options: PreambleOptions): StreamEntry[] {
    return c64StylePreamble(
      options.projectName,
      options.shimVariant,
      options.hasInitCode ?? false,
    );
  },

  emitStartupShim(variant: ShimVariant, hasInitCode?: boolean): StreamEntry[] {
    return c64StyleStartupShim(variant, hasInitCode ?? false);
  },

  getOutputDirective(projectName: string): AcmeDirective {
    return prgOutputDirective(projectName);
  },

  encodeChar(char: string): number {
    return atasciiEncodeChar(char);
  },

  encodeString(text: string): number[] {
    return atasciiEncodeString(text);
  },

  getMainTerminationPolicy(): MainTerminationPolicy {
    return { canReturn: true };
  },

  validateProfile(): ValidationError[] {
    return validateProfileVia(a800xlProfile, "a800xl");
  },
};
