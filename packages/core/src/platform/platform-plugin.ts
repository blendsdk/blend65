/**
 * The `PlatformPlugin` interface + its hook types — RD-10 R1–R3, R16–R22
 * (§4.1/§4.3). Lives in `@blend65/core` (R2/AR-20) so both `frontend` budget
 * checks and `codegen` hooks consume it without a circular dependency.
 *
 * The codegen hooks (`emitPreamble`/`emitStartupShim`/`getOutputDirective`)
 * return the core-resident Instr/stream model types (`StreamEntry`/`AcmeDirective`),
 * which were promoted to `@blend65/core` by D7 precisely so this interface can
 * reference them without core depending on codegen.
 */

import type { AcmeDirective, StreamEntry } from "../instr-model/index.js";
import type { IntrinsicDescriptor } from "../intrinsics/descriptor.js";
import type { PlatformProfile } from "./platform-profile.js";

export type { IntrinsicDescriptor } from "../intrinsics/descriptor.js";

/**
 * Which startup-shim a preamble wraps the program entry point in (R17).
 *
 * - `"terminating"` — `main` may return; the shim restores state and returns to
 *   the OS/BASIC.
 * - `"non-terminating"` — `main` is an endless loop; the shim ends with a jump to
 *   `_main` and never returns.
 * - `"bare"` — no shim; the preamble emits the load directive + origin only.
 */
export type ShimVariant = "terminating" | "non-terminating" | "bare";

/**
 * Options controlling preamble generation (R17/§4.3).
 */
export interface PreambleOptions {
  /** The program/output base name (drives the `!to` directive). */
  readonly projectName: string;
  /** Which startup-shim to emit. */
  readonly shimVariant: ShimVariant;
  /** Whether the shim must zero the BSS region before entry. */
  readonly needsBssZero: boolean;
  /** Whether the shim must copy initialised data before entry. */
  readonly needsDataInit: boolean;
}

/**
 * Whether `main` is allowed to return on this platform, and any warning (R18).
 */
export interface MainTerminationPolicy {
  /** `true` if returning from `main` is well-defined on this platform. */
  readonly canReturn: boolean;
  /** Optional diagnostic shown when `main` returns on a platform that warns. */
  readonly warningOnReturn?: string;
}

/**
 * Metadata for a hand-written runtime `.asm` module a plugin provides (R26/R27).
 *
 * Only the *metadata* is declared in this RD-10 slice (D1); the `.asm` bodies are
 * RD-17/AR-30. The `exports` list drives dead-stripping and linking (RD-09).
 */
export interface RuntimeModule {
  /** Logical module name, e.g. `"mul8"`. */
  readonly name: string;
  /** Path to the `.asm` source, relative to the plugin package. */
  readonly asmPath: string;
  /** Exported symbols (for dead-stripping/link), e.g. `["__rt_mul8"]`. */
  readonly exports: readonly string[];
  /**
   * Self-locating base URL (`import.meta.url` of the declaring module) that
   * T4 embedding resolves `asmPath` against (RD-17 PF-017). Required for a
   * module to be loadable — codegen has no dependency on the plugin packages,
   * so a self-located URL is the only mechanism that resolves identically from
   * `src/` (vitest) and `dist/` (built).
   */
  readonly baseUrl?: string;
}

/**
 * A single profile-consistency problem reported by `validateProfile` (R22).
 * Non-throwing data so callers (RD-15/16 driver) can surface all problems.
 */
export interface ValidationError {
  /** The profile field the problem concerns, e.g. `"zpStart"`. */
  readonly field: string;
  /** A human-readable description of the inconsistency. */
  readonly message: string;
}

/**
 * The contract every target platform satisfies (R1) — profile *data* plus
 * codegen-strategy *hooks*. The core compiler never names a memory address,
 * hardware chip, character encoding, or binary format; the active plugin
 * provides them (Language Guard P3).
 */
export interface PlatformPlugin {
  /** Stable platform id used by the registry/loader, e.g. `"c64"`. */
  readonly id: string;
  /** Human-facing platform name, e.g. `"Commodore 64"`. */
  readonly displayName: string;
  /** The platform's profile data (Ch 15 §3). */
  readonly profile: PlatformProfile;
  /** Intrinsic descriptors — `[]` until RD-17 (D1). */
  readonly intrinsics: readonly IntrinsicDescriptor[];
  /** Hand-written runtime `.asm` module metadata (bodies are RD-17). */
  readonly runtimeModules: readonly RuntimeModule[];

  /**
   * Emit the program preamble (load directive, origin, optional startup shim)
   * as a stream of {@link StreamEntry} the serializer renders to ACME (R17).
   *
   * @param options Preamble generation options.
   * @returns The preamble stream entries.
   */
  emitPreamble(options: PreambleOptions): StreamEntry[];

  /**
   * Emit just the startup shim for the given variant (R17).
   *
   * @param variant The shim variant to emit.
   * @returns The shim stream entries (empty for `"bare"`).
   */
  emitStartupShim(variant: ShimVariant): StreamEntry[];

  /**
   * The ACME output-file directive for this platform (R20), e.g.
   * `{ kind: "outputFile", name: "main.prg", format: "cbm" }`.
   *
   * @param projectName The output base name.
   * @returns The `!to` directive.
   */
  getOutputDirective(projectName: string): AcmeDirective;

  /**
   * Encode a string literal to this platform's character set (R19).
   *
   * @param text The source string.
   * @returns The encoded byte values.
   */
  encodeString(text: string): number[];

  /**
   * Encode a single character to this platform's character set (R19).
   *
   * @param char A single-character string.
   * @returns The encoded byte value.
   */
  encodeChar(char: string): number;

  /**
   * The platform's `main`-termination policy (R18).
   *
   * @returns Whether `main` may return, plus any warning.
   */
  getMainTerminationPolicy(): MainTerminationPolicy;

  /**
   * Validate the plugin's own profile for internal consistency (R22).
   *
   * @returns The list of problems (empty when the profile is consistent).
   */
  validateProfile(): ValidationError[];
}
