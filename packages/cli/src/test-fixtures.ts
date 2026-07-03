/**
 * Shared test fixtures for the `@blend65/cli` spec/impl tiers (07 §Shared fixtures).
 *
 * Test-only support — not re-exported from the package barrel. Provides
 * {@link fakeIo} (a capturing {@link CliIo}) and {@link fakeCliBuildDeps} (a
 * {@link BuildDeps} whose ACME invocation is faked but whose fs is REAL, so the
 * CLI's on-disk artifacts land in a temp `--out-dir` for assertion).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DiagCode, IceCode } from "@blend65/core";
import type { BuildDeps } from "@blend65/compiler";
import type { CliIo } from "./index.js";

/**
 * The MVP gate source — the verbatim content of `examples/gate/main.blend`
 * (PF-007). Transcribed here so CLI tests can plant a real `.blend` on disk.
 */
export const GATE_SRC = `module Main;

function main(): void {
    poke(0xD020, 5);   // VIC-II border color; literal lives in the example, not core (P3)
}
`;

/** A {@link CliIo} that accumulates stdout/stderr into inspectable strings. */
export interface FakeIo extends CliIo {
  /** Everything written to stdout so far. */
  out: string;
  /** Everything written to stderr so far. */
  err: string;
}

/**
 * Build a capturing {@link CliIo} (07 fixture). Defaults: non-TTY, empty env,
 * `process.cwd()`. Override any field (e.g. `isTTY`, `env`, `cwd`, `buildDeps`).
 *
 * @param overrides Fields to override on the default IO.
 * @returns A {@link FakeIo}.
 */
export function fakeIo(overrides: Partial<CliIo> = {}): FakeIo {
  const io: FakeIo = {
    out: "",
    err: "",
    writeOut(text: string): void {
      io.out += text;
    },
    writeErr(text: string): void {
      io.err += text;
    },
    isTTY: false,
    env: {},
    cwd: process.cwd(),
    ...overrides,
  };
  return io;
}

/** Behaviour knobs for {@link fakeCliBuildDeps}. */
export interface FakeCliDepsOptions {
  /** ACME invocation outcome (default: success). */
  readonly acmeSuccess?: boolean;
  /** Binary size ACME reports on success (default: 100). */
  readonly binarySize?: number;
  /**
   * Diagnostic code recorded on ACME failure. Default `IceCode.Unexpected`
   * (ICE → exit 3); pass `DiagCode.AcmeNotFound` for the E10035 case (→ exit 1).
   */
  readonly failureCode?: string;
}

/** A {@link BuildDeps} that records whether ACME was invoked. */
export interface FakeCliDeps extends BuildDeps {
  /** Mutable call counters for assertions (e.g. `--emit-asm` never invokes ACME). */
  readonly calls: { invoke: number };
}

/**
 * Build a fake {@link BuildDeps} with a scripted ACME invocation and a REAL
 * filesystem (07 fixture). On success the fake writes a 3-byte PRG (`$01 $08 …`)
 * and an empty label file to the paths `emitBinary` chose, so `readBinary` and
 * the label parse work against real files in the temp `--out-dir`.
 *
 * @param options Outcome knobs (success/size/failure code).
 * @returns A {@link FakeCliDeps}.
 */
export function fakeCliBuildDeps(options: FakeCliDepsOptions = {}): FakeCliDeps {
  const succeed = options.acmeSuccess !== false;
  const binarySize = options.binarySize ?? 100;
  const calls = { invoke: 0 };

  return {
    emitDeps: {
      ensureDir(dir: string): void {
        mkdirSync(dir, { recursive: true });
      },
      writeFile(path: string, content: string): void {
        writeFileSync(path, content, "utf8");
      },
      readFile(path: string): string {
        try {
          return readFileSync(path, "utf8");
        } catch {
          return "";
        }
      },
      async invoke(_asmPath, opts, bag) {
        calls.invoke += 1;
        if (!succeed) {
          const code = options.failureCode ?? IceCode.Unexpected;
          const message =
            code === DiagCode.AcmeNotFound ? "ACME assembler not found" : "ACME assembler failed (fake)";
          bag.addError(code, null, message);
          return { success: false };
        }
        // Simulate ACME producing the binary + an (empty) label file on disk.
        writeFileSync(opts.binaryPath, Buffer.from([0x01, 0x08, 0x00]));
        writeFileSync(opts.labelPath, "");
        return {
          success: true,
          binaryPath: opts.binaryPath,
          labelFilePath: opts.labelPath,
          binarySize,
        };
      },
    },
    readBinary(path: string): Uint8Array {
      return new Uint8Array(readFileSync(path));
    },
    calls,
  };
}
