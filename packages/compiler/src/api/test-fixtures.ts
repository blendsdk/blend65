/**
 * Shared test fixtures for the RD-15 facade spec/impl tiers (07 §Shared fixtures).
 *
 * Test-only support — intentionally NOT re-exported from the package barrel
 * (mirrors the codegen `test-fixtures.ts` precedent). Provides:
 *   - {@link GATE_SRC} — the verbatim MVP gate source (single source of truth, PF-007).
 *   - {@link memHost} — an in-memory {@link CompilerHost} built from the R14 contract.
 *   - {@link fakeBuildDeps} — a {@link BuildDeps} with an in-memory fs + fake ACME.
 */

import { DiagCode, IceCode, type CompilerHost } from "@blend65/core";
import type { BuildDeps } from "./build.js";

/**
 * The MVP gate source — the verbatim content of `examples/gate/main.blend`
 * (PF-007; capital `Main`, hex `0xD020`, value `5`). Single source of truth for
 * every facade/CLI test that needs a clean-compiling program.
 */
export const GATE_SRC = `module Main;

function main(): void {
    poke(0xD020, 5);   // VIC-II border color; literal lives in the example, not core (P3)
}
`;

/**
 * Build an in-memory {@link CompilerHost} from a path→content map (07 fixture).
 *
 * Spec-legal: constructed from the R14 interface contract only. `resolvePath` is
 * identity (the map keys ARE the paths), `listSourceFiles` returns the keys sorted,
 * `readFile` returns the mapped content or `undefined`.
 *
 * @param files A map of source path to file content.
 * @returns A {@link CompilerHost} backed by `files`.
 */
export function memHost(files: Record<string, string>): CompilerHost {
  return {
    listSourceFiles(): string[] {
      return Object.keys(files).sort();
    },
    readFile(path: string): string | undefined {
      return files[path];
    },
    resolvePath(path: string): string {
      return path;
    },
  };
}

/** Behaviour knobs for {@link fakeBuildDeps}. */
export interface FakeBuildDepsOptions {
  /** ACME invocation outcome (default: success). */
  readonly acmeSuccess?: boolean;
  /** Binary size ACME reports on success (default: 100). */
  readonly binarySize?: number;
  /**
   * Diagnostic code to record on ACME failure. Default: `IceCode.Unexpected`
   * (an ICE → exit 3). Pass `DiagCode.AcmeNotFound` to model ACME-not-found
   * (a normal error → exit 1, PF-003/ST-43).
   */
  readonly failureCode?: string;
  /** Records every file write (path → content) the emit performs. */
  readonly written?: Map<string, string>;
}

/**
 * Build a fake {@link BuildDeps} with an in-memory filesystem and a scripted ACME
 * invocation (07 fixture; mirrors the `emit-binary.spec.test.ts` fake pattern).
 * No real files are written and no real ACME is spawned.
 *
 * @param options Outcome knobs (success/size/failure code/write recorder).
 * @returns A {@link BuildDeps} for injection into `build()`.
 */
export function fakeBuildDeps(options: FakeBuildDepsOptions = {}): BuildDeps {
  const written = options.written ?? new Map<string, string>();
  const succeed = options.acmeSuccess !== false;
  const binarySize = options.binarySize ?? 100;

  return {
    emitDeps: {
      ensureDir(): void {
        /* in-memory: nothing to create */
      },
      writeFile(path: string, content: string): void {
        written.set(path, content);
      },
      readFile(): string {
        // The VICE label file — empty content parses to an empty symbol map.
        return "";
      },
      async invoke(_asmPath, opts, bag) {
        if (!succeed) {
          // Record the scripted diagnostic (ICE by default; E10035 for ST-43).
          const code = options.failureCode ?? IceCode.Unexpected;
          if (code === DiagCode.AcmeNotFound) {
            bag.addError(code, null, "ACME assembler not found");
          } else {
            bag.addError(code, null, "ACME assembler failed (fake)");
          }
          return { success: false };
        }
        return {
          success: true,
          binaryPath: opts.binaryPath,
          labelFilePath: opts.labelPath,
          binarySize,
        };
      },
    },
    // A minimal PRG: the c64 load address $0801 little-endian + one payload byte.
    readBinary(): Uint8Array {
      return new Uint8Array([0x01, 0x08, 0x00]);
    },
  };
}
