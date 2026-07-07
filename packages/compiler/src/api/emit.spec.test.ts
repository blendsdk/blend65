/**
 * Specification tests for `emitIl` / `emitAsm`.
 *
 * Written from the requirements, never from the implementation. Immutable
 * oracles: `emitIl` yields IL text (no `.asm`), `emitAsm` yields ACME text with
 * the c64 `!to` directive and no printing/writes; the startup/out-name seam
 * threads `outName` into `!to` and `startup` into the shim.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitAsm, emitIl } from "./emit.js";
import { GATE_SRC, memHost } from "./test-fixtures.js";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "b65-emit-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("Specification: emitIl on the gate program (ST-15)", () => {
  it("returns IL text with the Main.main function header and no .asm markers (ST-15)", () => {
    const result = emitIl(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
    );

    expect(result.text).toBeDefined();
    expect(result.text!).toContain("function Main.main");
    expect(result.text!).not.toMatch(/!to/);
  });
});

describe("Specification: emitAsm on the gate program (ST-16)", () => {
  it("returns ACME text with a code marker and the c64 !to directive, printing nothing (ST-16)", () => {
    const outSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    try {
      const result = emitAsm(
        { platform: "c64", cwd, sourceFiles: ["main.blend"] },
        memHost({ "main.blend": GATE_SRC }),
      );

      expect(result.text).toBeDefined();
      expect(result.text!).toMatch(/JSR|STA/i);
      expect(result.text!).toMatch(/!to/);
      expect(outSpy.mock.calls.length).toBe(0);
      expect(errSpy.mock.calls.length).toBe(0);
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});

describe("Specification: emitAsm threads outName into !to (ST-41, PF-001)", () => {
  it("names the output game.prg when outName is 'game' (ST-41)", () => {
    const result = emitAsm(
      { platform: "c64", cwd, outName: "game", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
    );

    expect(result.text).toBeDefined();
    expect(result.text!).toContain('!to "game.prg"');
    expect(result.text!).not.toContain('!to "main.prg"');
  });
});

describe("Specification: emitAsm threads startup into the shim (ST-42, PF-001)", () => {
  it("emits no terminating startup shim under startup:'bare' (ST-42)", () => {
    const bare = emitAsm(
      { platform: "c64", cwd, startup: "bare", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
    );
    const terminating = emitAsm(
      { platform: "c64", cwd, startup: "terminating", sourceFiles: ["main.blend"] },
      memHost({ "main.blend": GATE_SRC }),
    );

    // The c64 terminating/non-terminating shims emit the `__startup` label + a
    // `$01` bank-out body; `bare` emits nothing (shared-hooks c64StyleStartupShim).
    expect(bare.text!).not.toContain("__startup");
    expect(terminating.text!).toContain("__startup");
  });
});
