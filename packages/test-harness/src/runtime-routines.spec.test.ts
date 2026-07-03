/**
 * Specification tests for the RD-17 inherited AC-14 — the `__rt_mul8/mul16/div8/
 * div16` runtime routines verified on REAL VICE silicon (ST-30..ST-33, AR-P4/AR-H5).
 *
 * Derived EXCLUSIVELY from the RD-17 runtime ABI (AR-33/AR-P7, mirrored from
 * `compiler/src/runtime-asm.impl.test.ts`) and reference integer math — never from
 * reading the harness implementation (IMMUTABLE ORACLE RULE). Discharges RD-17's
 * INHERITED AC-14 on real silicon (distinct from RD-12's own AC-14 = publishable
 * package). The interim in-process interpreter test retains the exhaustive 500-sample
 * coverage; this is the bounded real-silicon parity check (AR-H5).
 *
 * ABI (a→A, b→X for 8-bit; a→A/X, b→zp[2..3] for 16-bit):
 *   __rt_mul8 : a→A, b→X          → product lo→A, hi→X   (Y preserved)
 *   __rt_div8 : a→A, b→X          → quotient→A, remainder→X (Y preserved)
 *   __rt_mul16: a→A/X, b→zp[2..3] → product lo→A, hi→X
 *   __rt_div16: a→A/X, b→zp[2..3] → quotient→A/X, remainder→zp[2..3]
 *
 * Assembles via ACME AND runs on VICE → gates on `skipIf(!hasVice() || !hasAcme())`
 * (PF-002). Each vector injects in-session via a `JSR <routine>` trampoline +
 * breakpoint (no relaunch between vectors, AR-H6).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RT_ROUTINES } from "@blend65/core";
import { loadRuntimeModule } from "@blend65/codegen";
import { ViceDriver } from "./emulator/vice/vice-driver.js";
import { hasAcme, hasVice } from "./fixture.js";
import net from "node:net";

/** Routine load origin, trampoline, and the post-JSR breakpoint address. */
const ROUTINE_ORIGIN = 0x8000;
const TRAMPOLINE = 0xc000;
const RETURN_ADDR = 0xc003; // instruction after `JSR $8000`
/** ZP arg slots (__zp_arg_0..3 = $02..$05 per the RD-17 prelude). */
const ZP_ARG0 = 0x02;

const LOCAL_TEST_TIMEOUT = 120000;
const RUN = hasVice("c64") && hasAcme();

/** The prelude the runtime modules expect (origin + program-header ZP symbols). */
const PRELUDE = [
  `* = $${ROUTINE_ORIGIN.toString(16)}`,
  "__zp_arg_0 = $02",
  "__zp_arg_1 = $03",
  "__zp_arg_2 = $04",
  "__zp_arg_3 = $05",
  "",
].join("\n");

/** Deterministic LCG — reproducible pseudo-random vectors (seeded, no Date/Math.random). */
function makeRng(seed: number): (bound: number) => number {
  let state = seed >>> 0;
  return (bound: number) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state % bound;
  };
}

/** Acquire an ephemeral free TCP port. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      resolve(typeof addr === "object" && addr !== null ? addr.port : 0);
      srv.close();
    });
  });
}

const EDGE8 = [0, 1, 2, 3, 127, 128, 129, 254, 255] as const;
const EDGE16 = [0, 1, 2, 255, 256, 257, 32767, 32768, 65534, 65535] as const;
const RANDOM_SAMPLES = 25; // bounded subset (AR-H5); the interpreter keeps 500

describe.skipIf(!RUN)("Specification: RD-17 runtime routines on real VICE (ST-30..ST-33)", () => {
  let driver: ViceDriver;
  let workDir: string;
  let acme: string;

  beforeAll(async () => {
    acme = execFileSync("which", ["acme"], { encoding: "utf8" }).trim();
    workDir = mkdtempSync(join(tmpdir(), "b65-rt-vice-"));
    const vice = execFileSync("which", ["x64sc"], { encoding: "utf8" }).trim();
    driver = new ViceDriver();
    await driver.launch({ executablePath: vice, monitorPort: await freePort() });
    // Trampoline: JSR $8000 ($20 lo hi), then NOP ($EA) at the breakpoint.
    await driver.writeMemory(
      TRAMPOLINE,
      new Uint8Array([0x20, ROUTINE_ORIGIN & 0xff, ROUTINE_ORIGIN >> 8, 0xea]),
    );
    await driver.setBreakpoint(RETURN_ADDR);
  }, LOCAL_TEST_TIMEOUT);

  afterAll(async () => {
    if (driver !== undefined) await driver.shutdown();
    if (workDir !== undefined) rmSync(workDir, { recursive: true, force: true });
  });

  /** Assemble one runtime module to raw bytes at {@link ROUTINE_ORIGIN} via real ACME. */
  function assembleRoutine(name: string): Uint8Array {
    const descriptor = RT_ROUTINES.find((d) => d.name === name);
    if (descriptor === undefined) throw new Error(`no catalog descriptor for ${name}`);
    const asmPath = join(workDir, `${name}.asm`);
    const binPath = join(workDir, `${name}.bin`);
    writeFileSync(asmPath, PRELUDE + loadRuntimeModule(descriptor), "utf8");
    execFileSync(acme, ["-f", "plain", "-o", binPath, asmPath], { encoding: "utf8" });
    return new Uint8Array(readFileSync(binPath));
  }

  /** Load a routine's bytes at the origin (relaunch-free, AR-H6). */
  async function loadRoutine(name: string): Promise<void> {
    await driver.writeMemory(ROUTINE_ORIGIN, assembleRoutine(name));
  }

  /**
   * Invoke the loaded routine once: seed registers/ZP, run the trampoline to the
   * breakpoint, and return the CPU registers + the two ZP arg bytes.
   */
  async function invoke(seed: {
    a: number;
    x: number;
    y?: number;
    zp?: [number, number];
  }): Promise<{ a: number; x: number; y: number; zp: [number, number] }> {
    if (seed.zp !== undefined) {
      await driver.writeMemory(ZP_ARG0, new Uint8Array([seed.zp[0], seed.zp[1]]));
    }
    await driver.writeRegisters({ a: seed.a, x: seed.x, y: seed.y ?? 0x5a, pc: TRAMPOLINE });
    const reason = await driver.resume();
    expect(reason).toBe("breakpoint");
    const regs = await driver.readRegisters();
    const zp = await driver.readMemory(ZP_ARG0, 2);
    return { a: regs.a, x: regs.x, y: regs.y, zp: [zp[0], zp[1]] };
  }

  it(
    "ST-30: __rt_mul8 — product lo→A, hi→X for edge crosses + seeded samples (Y preserved)",
    async () => {
      await loadRoutine("__rt_mul8");
      const check = async (a: number, b: number): Promise<void> => {
        const out = await invoke({ a, x: b, y: 0x5a });
        expect(out.a | (out.x << 8), `${a} * ${b}`).toBe(a * b);
        expect(out.y, "Y preserved").toBe(0x5a);
      };
      for (const a of EDGE8) for (const b of EDGE8) await check(a, b);
      const rnd = makeRng(0x12345678);
      for (let i = 0; i < RANDOM_SAMPLES; i++) await check(rnd(256), rnd(256));
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-31: __rt_div8 — quotient→A, remainder→X for edge crosses + seeded samples (Y preserved)",
    async () => {
      await loadRoutine("__rt_div8");
      const check = async (a: number, b: number): Promise<void> => {
        const out = await invoke({ a, x: b, y: 0x5a });
        expect(out.a, `${a} / ${b} quotient`).toBe(Math.floor(a / b));
        expect(out.x, `${a} % ${b} remainder`).toBe(a % b);
        expect(out.y, "Y preserved").toBe(0x5a);
      };
      for (const a of EDGE8) for (const b of EDGE8) if (b !== 0) await check(a, b);
      const rnd = makeRng(0x23456789);
      for (let i = 0; i < RANDOM_SAMPLES; i++) await check(rnd(256), 1 + rnd(255));
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-32: __rt_mul16 — product lo→A, hi→X for edge crosses + seeded samples",
    async () => {
      await loadRoutine("__rt_mul16");
      const check = async (a: number, b: number): Promise<void> => {
        const out = await invoke({ a: a & 0xff, x: a >> 8, zp: [b & 0xff, b >> 8] });
        expect(out.a | (out.x << 8), `${a} * ${b}`).toBe((a * b) & 0xffff);
      };
      for (const a of EDGE16) for (const b of EDGE16) await check(a, b);
      const rnd = makeRng(0x3456789a);
      for (let i = 0; i < RANDOM_SAMPLES; i++) await check(rnd(65536), rnd(65536));
    },
    LOCAL_TEST_TIMEOUT,
  );

  it(
    "ST-33: __rt_div16 — quotient→A/X, remainder→zp[2..3] for edge crosses + seeded samples",
    async () => {
      await loadRoutine("__rt_div16");
      const check = async (a: number, b: number): Promise<void> => {
        const out = await invoke({ a: a & 0xff, x: a >> 8, zp: [b & 0xff, b >> 8] });
        const quotient = out.a | (out.x << 8);
        const remainder = out.zp[0] | (out.zp[1] << 8);
        expect(quotient, `${a} / ${b} quotient`).toBe(Math.floor(a / b));
        expect(remainder, `${a} % ${b} remainder`).toBe(a % b);
      };
      for (const a of EDGE16) for (const b of EDGE16) if (b !== 0) await check(a, b);
      const rnd = makeRng(0x456789ab);
      for (let i = 0; i < RANDOM_SAMPLES; i++) await check(rnd(65536), 1 + rnd(65535));
    },
    LOCAL_TEST_TIMEOUT,
  );
});
