/**
 * Implementation tests for the runtime routines — functional verification
 * using an interim in-process harness, ahead of full emulator-based
 * verification.
 *
 * Each `runtime/*.asm` module is assembled with the real ACME (skipped when
 * ACME is not on PATH) and executed on the in-process test interpreter against
 * arithmetic vectors: full edge-value crosses plus seeded pseudo-random
 * samples. This proves the *math* of the hand-written 6502 (mul8/mul16/div8/
 * div16).
 *
 * ABI under test:
 *   __rt_mul8 : a→A, b→X            → product lo→A, hi→X       (Y preserved)
 *   __rt_div8 : a→A, b→X            → quotient→A, remainder→X  (Y preserved)
 *   __rt_mul16: a→A/X, b→zp[2..3]   → product lo→A, hi→X
 *   __rt_div16: a→A/X, b→zp[2..3]   → quotient→A/X, remainder→zp[2..3]
 * (ZP addresses per the shared prelude below: __zp_arg_0=$02 .. __zp_arg_3=$05.)
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RT_ROUTINES } from "@blend65/core";
import { loadRuntimeModule } from "@blend65/codegen";
import { runRoutine } from "./testing/mos6502-interpreter.js";

/** Resolve ACME from PATH (null → tests are skipped). */
function findAcme(): string | null {
  try {
    const out = execFileSync("which", ["acme"], { encoding: "utf8" }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

const ACME = findAcme();
const WORK_DIR = mkdtempSync(join(tmpdir(), "blend65-rt-func-"));

afterAll(() => {
  rmSync(WORK_DIR, { recursive: true, force: true });
});

/** Same prelude as the ACME-validity spec test: origin + the program-header `__zp_arg_N` symbols. */
const PRELUDE = [
  "* = $8000",
  "__zp_arg_0 = $02",
  "__zp_arg_1 = $03",
  "__zp_arg_2 = $04",
  "__zp_arg_3 = $05",
  "",
].join("\n");

/** Assemble one routine module to raw bytes via the real ACME. */
function assembleRoutine(name: string): Uint8Array {
  const descriptor = RT_ROUTINES.find((d) => d.name === name);
  if (descriptor === undefined) {
    throw new Error(`no catalog descriptor for ${name}`);
  }
  const asmPath = join(WORK_DIR, `${name}.asm`);
  const binPath = join(WORK_DIR, `${name}.bin`);
  writeFileSync(asmPath, PRELUDE + loadRuntimeModule(descriptor), "utf8");
  execFileSync(ACME ?? "acme", ["-f", "plain", "-o", binPath, asmPath], { encoding: "utf8" });
  return new Uint8Array(readFileSync(binPath));
}

/** Deterministic LCG — reproducible pseudo-random vectors (seeded, no Date/Math.random). */
function makeRng(seed: number): (bound: number) => number {
  let state = seed >>> 0;
  return (bound: number) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state % bound;
  };
}

const EDGE8 = [0, 1, 2, 3, 127, 128, 129, 254, 255] as const;
const EDGE16 = [0, 1, 2, 255, 256, 257, 32767, 32768, 65534, 65535] as const;
const RANDOM_SAMPLES = 500;

describe.skipIf(ACME === null)("RD-17 runtime routines — functional math (AR-P17)", () => {
  it("__rt_mul8 computes a*b for all edge crosses + random samples; Y preserved", () => {
    const bin = assembleRoutine("__rt_mul8");
    const check = (a: number, b: number): void => {
      const s = runRoutine(bin, { a, x: b, y: 0x5a });
      const got = s.a | (s.x << 8);
      expect(got, `${a} * ${b}`).toBe(a * b);
      expect(s.y, "Y must be preserved (clobber list: A, X, status)").toBe(0x5a);
    };
    for (const a of EDGE8) for (const b of EDGE8) check(a, b);
    const rnd = makeRng(0x12345678);
    for (let i = 0; i < RANDOM_SAMPLES; i++) check(rnd(256), rnd(256));
  });

  it("__rt_div8 computes a/b and a%b for all edge crosses + random samples; Y preserved", () => {
    const bin = assembleRoutine("__rt_div8");
    const check = (a: number, b: number): void => {
      const s = runRoutine(bin, { a, x: b, y: 0x5a });
      expect(s.a, `${a} / ${b} quotient`).toBe(Math.floor(a / b));
      expect(s.x, `${a} % ${b} remainder`).toBe(a % b);
      expect(s.y, "Y must be preserved (clobber list: A, X, status)").toBe(0x5a);
    };
    for (const a of EDGE8) for (const b of EDGE8) {
      if (b !== 0) check(a, b);
    }
    const rnd = makeRng(0x23456789);
    for (let i = 0; i < RANDOM_SAMPLES; i++) check(rnd(256), 1 + rnd(255));
  });

  it("__rt_mul16 computes (a*b) mod 2^16 for all edge crosses + random samples", () => {
    const bin = assembleRoutine("__rt_mul16");
    const check = (a: number, b: number): void => {
      const s = runRoutine(bin, { a: a & 0xff, x: a >> 8, zp: { 2: b & 0xff, 3: b >> 8 } });
      const got = s.a | (s.x << 8);
      expect(got, `${a} * ${b}`).toBe((a * b) & 0xffff);
    };
    for (const a of EDGE16) for (const b of EDGE16) check(a, b);
    const rnd = makeRng(0x3456789a);
    for (let i = 0; i < RANDOM_SAMPLES; i++) check(rnd(65536), rnd(65536));
  });

  it("__rt_div16 computes a/b and a%b for all edge crosses + random samples (remainder overwrites b — AR-P7)", () => {
    const bin = assembleRoutine("__rt_div16");
    const check = (a: number, b: number): void => {
      const s = runRoutine(bin, { a: a & 0xff, x: a >> 8, zp: { 2: b & 0xff, 3: b >> 8 } });
      const quotient = s.a | (s.x << 8);
      const remainder = (s.mem[2] ?? 0) | ((s.mem[3] ?? 0) << 8);
      expect(quotient, `${a} / ${b} quotient`).toBe(Math.floor(a / b));
      expect(remainder, `${a} % ${b} remainder (in __zp_arg_0/1)`).toBe(a % b);
    };
    for (const a of EDGE16) for (const b of EDGE16) {
      if (b !== 0) check(a, b);
    }
    const rnd = makeRng(0x456789ab);
    for (let i = 0; i < RANDOM_SAMPLES; i++) check(rnd(65536), 1 + rnd(65535));
  });
});
