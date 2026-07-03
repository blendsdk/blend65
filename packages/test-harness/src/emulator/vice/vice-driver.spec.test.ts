/**
 * Specification tests for `ViceDriver` (ST-09..ST-13) — integration against a real
 * VICE `x64sc` (Local tier, `describe.skipIf(!hasVice())`).
 *
 * Derived EXCLUSIVELY from RD-12 §4.1/§4.5 and R7/R8/R12/R13/R14/R15/R16 — never
 * from reading the implementation (IMMUTABLE ORACLE RULE). CI has no emulator tier
 * (AR-27), so these skip cleanly there and are proven green locally on VICE 3.10
 * (AR-H3).
 *
 * ST-11 sets its breakpoint at the KERNAL IRQ entry `$EA31` — executed ~60×/second
 * by the CIA-timer IRQ regardless of any loaded program — so the breakpoint/resume/
 * register capability (R12/R13/R15) is proven WITHOUT an ACME build. The gate
 * program's `_main` breakpoint is the Phase-3 ST-29 suite (VICE + ACME).
 */

import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import net from "node:net";
import { ViceDriver } from "./vice-driver.js";

/** Resolve `x64sc` on PATH → null when absent (drives the skipIf guard, AR-27). */
function findVice(): string | null {
  try {
    const out = execFileSync("which", ["x64sc"], { encoding: "utf8" }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Acquire an ephemeral free TCP port for the monitor bind (avoids cross-file clashes). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

const VICE = findVice();
/** The C64 KERNAL IRQ handler entry — hit every frame regardless of program. */
const KERNAL_IRQ = 0xea31;
/** Free RAM — a full-byte memory round-trip target (ST-10). ($D020 reads its
 *  top 4 bits back as 1s, so it is not a clean round-trip target.) */
const FREE_RAM = 0xc000;

describe.skipIf(VICE === null)("Specification: ViceDriver on real VICE (ST-09..ST-13)", () => {
  let driver: ViceDriver | undefined;

  afterEach(async () => {
    if (driver !== undefined) {
      await driver.shutdown();
      driver = undefined;
    }
  });

  async function launch(): Promise<ViceDriver> {
    const port = await freePort();
    const d = new ViceDriver();
    await d.launch({ executablePath: VICE!, monitorPort: port });
    return d;
  }

  it("ST-09: launch() connects the monitor socket, shutdown() exits the process", async () => {
    driver = await launch();
    // A round-trip proves the socket is live; shutdown() (afterEach) exits the process.
    const regs = await driver.readRegisters();
    expect(typeof regs.pc).toBe("number");
  });

  it("ST-10: writeMemory then readMemory round-trips the byte", async () => {
    driver = await launch();
    await driver.writeMemory(FREE_RAM, new Uint8Array([0x2a]));
    const read = await driver.readMemory(FREE_RAM, 1);
    expect(read).toHaveLength(1);
    expect(read[0]).toBe(0x2a);
  });

  it("ST-11: setBreakpoint + resume stops at the breakpoint and registers are readable", async () => {
    driver = await launch();
    await driver.setBreakpoint(KERNAL_IRQ);
    const reason = await driver.resume();
    expect(reason).toBe("breakpoint");

    const regs = await driver.readRegisters();
    expect(regs.pc).toBe(KERNAL_IRQ);
    expect(typeof regs.a).toBe("number");
    expect(typeof regs.sp).toBe("number");
  });

  it("ST-12: captureScreenshot returns a PNG buffer (signature + decodable IHDR)", async () => {
    driver = await launch();
    const png = await driver.captureScreenshot();
    expect(Buffer.isBuffer(png)).toBe(true);
    // PNG 8-byte signature.
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // First chunk is IHDR; width/height are positive.
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it("ST-13: readRegisters maps VICE ids to the named Registers shape (all fields present)", async () => {
    driver = await launch();
    const regs = await driver.readRegisters();
    for (const k of ["a", "x", "y", "sp", "pc"] as const) {
      expect(typeof regs[k]).toBe("number");
    }
    for (const f of ["carry", "zero", "interrupt", "decimal", "break_", "overflow", "negative"] as const) {
      expect(typeof regs.flags[f]).toBe("boolean");
    }
  });
});
