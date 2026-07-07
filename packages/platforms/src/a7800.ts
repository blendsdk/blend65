/**
 * The Atari 7800 platform plugin; spec Ch 15 §2 + appendix-a7800.
 *
 * Profile transcribed from appendix-a7800 §10 (`cpu: "nmos6502"`, ROM/cart-based
 * with code at `$8000`, 4 KB RAM at `$1800–$27FF`, `outputFormat: "a78"`,
 * `defaultEncoding: "ascii"`). Crucially `getMainTerminationPolicy().canReturn`
 * is **false**: the 7800 game loop is non-terminating — there is
 * no OS to return to.
 *
 * The codegen hooks delegate to the shared C64-style bodies in this slice
 * (the bespoke `.a78` cartridge-header preamble and the ASCII encoder are
 * deferred); only the profile, `getMainTerminationPolicy`, and `validateProfile`
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
  c64StylePreamble,
  c64StyleStartupShim,
  petsciiEncodeChar,
  petsciiEncodeString,
  prgOutputDirective,
  validateProfileVia,
} from "./shared-hooks.js";

/**
 * The Atari 7800 profile (appendix-a7800 §10). Code lives in cartridge ROM
 * (`$8000–$FFF7`); RAM is the scarce `$1800–$27FF` window. `maxZp` (64) `===
 * zpEnd − zpStart + 1` (`0x7F − 0x40 + 1`).
 */
const a7800Profile: PlatformProfile = {
  platformId: "a7800",
  codeStart: 0x8000,
  codeEnd: 0xfff7,
  dataStart: 0x1800,
  dataEnd: 0x27ff,
  ramStart: 0x1800,
  ramEnd: 0x27ff,
  zpStart: 0x40,
  zpEnd: 0x7f,
  stackReserve: 24,
  maxBinarySize: 32752,
  maxRam: 1536,
  maxZp: 64,
  stackBudget: 226,
  outputFormat: "a78",
  loadAddress: 0x8000,
  cpu: "nmos6502",
  zpArgBlockSize: 8,
  defaultEncoding: "ascii",
  screenEncoding: "ascii",
  warnFrameSize: 16,
  warnArraySize: 32,
  clockMhz: 1.19,
  cyclesPerFrame: 29868,
};

/**
 * The Atari 7800 plugin. Hooks delegate to the shared C64-style bodies; the
 * `.a78` cartridge preamble is deferred. `main` may NOT return: the game loop
 * is non-terminating and there is no OS to return to.
 */
export const a7800Plugin: PlatformPlugin = {
  id: "a7800",
  displayName: "Atari 7800",
  profile: a7800Profile,
  intrinsics: [], // populated once the runtime intrinsics are wired up
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
    return {
      canReturn: false,
      warningOnReturn:
        "main must not return on the Atari 7800 — the game loop is non-terminating (no OS to return to)",
    };
  },

  validateProfile(): ValidationError[] {
    return validateProfileVia(a7800Profile, "a7800");
  },
};
