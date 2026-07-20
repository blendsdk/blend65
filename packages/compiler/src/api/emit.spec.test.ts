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

/**
 * The raster-poll program, whose lowered control flow carries every shape the
 * block-layout passes exist to remove: a chain of jump-only blocks between the
 * entry and the poll, and an epilogue block the infinite frame loop can never
 * reach.
 */
const RASTERPOLL_SRC = `module Main;

let frame: byte = 0;

function main(): void {
  while (true) {
    while (peek($D012) != 251) { }

    frame = frame + 1;
    poke($0400, frame);
    poke($D020, frame);
  }
}
`;

/** The printed-IL body of one function, without its header or closing brace. */
function ilFunctionBody(text: string, name: string): string {
  const start = text.indexOf(`function ${name}(`);
  if (start < 0) {
    throw new Error(`printed IL has no function '${name}'`);
  }
  const open = text.indexOf("{", start);
  const close = text.indexOf("\n}", open);
  return text.slice(open + 1, close);
}

/**
 * The block labels a printed-IL function body declares, in order.
 *
 * Printed IL renders a block label at column 0 followed by a colon; every other
 * line is indented. Anchoring on that keeps this reading of the text
 * independent of which instructions the blocks happen to contain.
 */
function ilBlockLabels(body: string): string[] {
  return body
    .split("\n")
    .filter((line) => /^_[A-Za-z0-9_]*:$/.test(line))
    .map((line) => line.replace(/:$/, ""));
}

/** The instruction/terminator lines a printed-IL block owns, keyed by label. */
function ilBlocks(body: string): Map<string, string[]> {
  const blocks = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of body.split("\n")) {
    if (/^_[A-Za-z0-9_]*:$/.test(line)) {
      current = [];
      blocks.set(line.replace(/:$/, ""), current);
    } else if (current !== undefined && line.trim().length > 0) {
      current.push(line.trim());
    }
  }
  return blocks;
}

/** The `Main.main` block labels present in emitted ACME text, in order. */
function asmBlockLabels(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => /^Main_main_L\d+:$/.test(line))
    .map((line) => line.replace(/:$/, "").replace("Main_main_", ""));
}

describe("Specification: --emit-il tells the truth about block layout (ST-B45)", () => {
  it("ST-B45: emitIl shows no trampoline and no unreachable block, and its blocks are the blocks emitted", () => {
    const host = memHost({ "main.blend": RASTERPOLL_SRC });
    const il = emitIl({ platform: "c64", cwd, sourceFiles: ["main.blend"] }, host);
    const asm = emitAsm(
      { platform: "c64", cwd, sourceFiles: ["main.blend"] },
      memHost({ "main.blend": RASTERPOLL_SRC }),
    );
    expect(il.text).toBeDefined();
    expect(asm.text).toBeDefined();

    const body = ilFunctionBody(il.text!, "Main.main");
    const blocks = ilBlocks(body);

    // No jump-only block survives — except the entry block, which is a root:
    // nothing branches to it, so there is nothing to retarget, and its own jump
    // is what falling through removes later.
    const trampolines = [...blocks]
      .filter(([label]) => label !== "_entry")
      .filter(([, lines]) => lines.length === 1 && lines[0]!.startsWith("br "))
      .map(([label]) => label);
    expect(trampolines).toEqual([]);

    // The dead epilogue is gone. `main` never leaves its frame loop, so the
    // `ret` block lowering placed after it is code no execution can arrive at.
    const returning = [...blocks]
      .filter(([, lines]) => lines.some((l) => /^ret\b/.test(l)))
      .map(([label]) => label);
    expect(returning).toEqual([]);

    // What --emit-il shows IS what gets emitted. Both entry points share the
    // lowering step, so a divergence here would mean the printed IL described
    // a program the assembler never saw.
    const ilLabels = ilBlockLabels(body).filter((l) => l !== "_entry");
    const asmLabels = asmBlockLabels(asm.text!).map((l) => `_${l}`);
    expect(ilLabels).toEqual(asmLabels);
    expect(ilLabels.length).toBeGreaterThan(0);
  });
});
