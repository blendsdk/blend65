import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";

async function put(root: string, name: string, content: string): Promise<void> {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function resumeTo(monitor: ViceMonitor, address: number): Promise<void> {
  const stopped = monitor.waitForStop(20_000);
  await monitor.resume();
  expect(await stopped).toBe(address);
}

async function withProgram<T>(
  sourceText: string,
  divisionZeroCheck: boolean | undefined,
  inspect: (monitor: ViceMonitor, labels: string, returnAddress: number) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-arithmetic-runtime-"));
  try {
    await put(
      root,
      "blend65.json",
      JSON.stringify({
        schemaVersion: 1,
        name: "arithmetic-runtime",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
        divisionZeroCheck,
      }),
    );
    await put(root, "src/game.blend", sourceText);

    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Arithmetic runtime build did not succeed");
    const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
    const returnLabel = `b65_${Buffer.from("startup.restore").toString("hex")}`;
    const returnMatches = [
      ...labels.matchAll(new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "gimu")),
    ];
    expect(returnMatches).toHaveLength(1);
    const addressText = returnMatches[0]?.[1];
    if (addressText === undefined) throw new Error("Missing startup return checkpoint");
    const returnAddress = Number.parseInt(addressText, 16);
    const started = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    try {
      return await inspect(started.monitor, labels, returnAddress);
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  } finally {
    await rm(root, { recursive: true });
  }
}

async function observe(
  sourceLines: readonly string[],
  lastAddress: number,
  divisionZeroCheck?: boolean,
): Promise<number[]> {
  const sourceText = ["module Game;", "function main(): void {", ...sourceLines, "}"].join("\n");
  return withProgram(sourceText, divisionZeroCheck, async (monitor, _labels, returnAddress) => {
    const checkpoint = await monitor.setExecuteCheckpoint(returnAddress);
    try {
      await resumeTo(monitor, returnAddress);
      return [...(await monitor.readMemory(0x0420, lastAddress))];
    } finally {
      await monitor.deleteCheckpoint(checkpoint);
    }
  });
}

function checkedSource(divisorValue: number): string {
  return [
    "module Game;",
    "function numerator(): byte { poke($0430, peek($0430) + 1); return 17; }",
    "function divisor(): byte { poke($0432, peek($0432) + 1); poke($0431, peek($0430)); return peek($0400); }",
    "function main(): void {",
    `  poke($0400, ${divisorValue});`,
    "  poke($0420, 165); poke($0421, 165);",
    "  poke($0430, 0); poke($0431, 0); poke($0432, 0);",
    "  let quotient: byte = numerator() / divisor();",
    "  poke($0420, quotient); poke($0421, 1);",
    "}",
  ].join("\n");
}

describe.sequential("runtime arithmetic operations", () => {
  it("multiplies byte and word variable pairs with fixed-width results", async () => {
    const bytes = await observe(
      [
        "poke($0400, 20); poke($0401, 13);",
        "pokew($0402, 500); pokew($0404, 300);",
        "let a: byte = peek($0400); let b: byte = peek($0401);",
        "let wa: word = peekw($0402); let wb: word = peekw($0404);",
        "let small: byte = a * b; let wide: word = wa * wb;",
        "poke($0420, small); pokew($0421, wide);",
      ],
      0x0422,
    );
    expect(bytes).toEqual([0x04, 0xf0, 0x49]);
  }, 60_000);

  it("applies variable shift counts at and beyond both integer widths", async () => {
    const bytes = await observe(
      [
        "poke($0400, 128); poke($0401, 1); poke($0402, 8); poke($0403, 9);",
        "pokew($0404, 32768); poke($0406, 15); poke($0407, 16); poke($0408, 17);",
        "let signedByte: sbyte = sbyte(peek($0400));",
        "let one: byte = peek($0401); let eight: byte = peek($0402); let nine: byte = peek($0403);",
        "let unsignedWord: word = peekw($0404);",
        "let fifteen: byte = peek($0406); let sixteen: byte = peek($0407); let seventeen: byte = peek($0408);",
        "poke($0420, byte(signedByte >> one));",
        "poke($0421, byte(signedByte >> eight));",
        "poke($0422, byte(signedByte >> nine));",
        "poke($0423, byte(byte(1) << eight));",
        "pokew($0424, unsignedWord >> fifteen);",
        "pokew($0426, unsignedWord >> sixteen);",
        "pokew($0428, unsignedWord >> seventeen);",
        "pokew($042A, word(sword(unsignedWord) >> sixteen));",
        "pokew($042C, word(1) << sixteen);",
      ],
      0x042d,
    );
    expect(bytes).toEqual([
      0xc0, 0xff, 0xff, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00,
    ]);
  }, 60_000);

  it("divides signed and unsigned variables with truncating quotient and dividend-signed remainder", async () => {
    const bytes = await observe(
      [
        "poke($0400, 251); poke($0401, 13); pokew($0402, 50000); pokew($0404, 300);",
        "poke($0406, 251); poke($0407, 2); poke($0408, 5); poke($0409, 254);",
        "poke($040A, 128); poke($040B, 255); pokew($040C, 32768); pokew($040E, 65535);",
        "let ub: byte = peek($0400); let db: byte = peek($0401);",
        "let uw: word = peekw($0402); let dw: word = peekw($0404);",
        "let sn: sbyte = sbyte(peek($0406)); let sd: sbyte = sbyte(peek($0407));",
        "let pn: sbyte = sbyte(peek($0408)); let nd: sbyte = sbyte(peek($0409));",
        "let minb: sbyte = sbyte(peek($040A)); let negb: sbyte = sbyte(peek($040B));",
        "let minw: sword = sword(peekw($040C)); let negw: sword = sword(peekw($040E));",
        "poke($0420, ub / db); poke($0421, ub % db);",
        "pokew($0422, uw / dw); pokew($0424, uw % dw);",
        "poke($0426, byte(sn / sd)); poke($0427, byte(sn % sd));",
        "poke($0428, byte(pn / nd)); poke($0429, byte(pn % nd));",
        "poke($042A, byte(minb / negb)); poke($042B, byte(minb % negb));",
        "pokew($042C, word(minw / negw)); pokew($042E, word(minw % negw));",
      ],
      0x042f,
    );
    expect(bytes).toEqual([19, 4, 166, 0, 200, 0, 0xfe, 0xff, 0xfe, 1, 0x80, 0, 0, 0x80, 0, 0]);
  }, 60_000);

  it("continues after unchecked runtime division and remainder by zero", async () => {
    const bytes = await observe(
      [
        "poke($0400, 0); poke($0423, 165);",
        "let numerator: byte = 17; let divisor: byte = peek($0400);",
        "let quotient: byte = numerator / divisor;",
        "let remainder: byte = numerator % divisor;",
        "poke($0420, quotient); poke($0421, remainder); poke($0422, 1);",
      ],
      0x0423,
    );
    expect(bytes[2]).toBe(1);
    expect(bytes[3]).toBe(165);
  }, 60_000);

  it("checks a nonzero runtime divisor once after the numerator and continues with its quotient", async () => {
    await withProgram(checkedSource(5), true, async (monitor, _labels, returnAddress) => {
      const checkpoint = await monitor.setExecuteCheckpoint(returnAddress);
      try {
        await resumeTo(monitor, returnAddress);
        expect([...(await monitor.readMemory(0x0420, 0x0421))]).toEqual([3, 1]);
        expect([...(await monitor.readMemory(0x0430, 0x0432))]).toEqual([1, 1, 1]);
      } finally {
        await monitor.deleteCheckpoint(checkpoint);
      }
    });
  }, 60_000);

  it("checks a zero divisor before division and enters the four-byte non-returning stop", async () => {
    await withProgram(checkedSource(0), true, async (monitor, labels, returnAddress) => {
      const startupLabel = `b65_${Buffer.from("startup").toString("hex")}`;
      const startupMatches = [
        ...labels.matchAll(new RegExp(`^\\s*${startupLabel}\\s*=\\s*\\$([0-9a-f]+)`, "gimu")),
      ];
      expect(startupMatches).toHaveLength(1);
      const startupAddress = Number.parseInt(startupMatches[0]![1]!, 16);
      const startupCheckpoint = await monitor.setExecuteCheckpoint(startupAddress);
      try {
        await resumeTo(monitor, startupAddress);
      } finally {
        await monitor.deleteCheckpoint(startupCheckpoint);
      }
      const memory = await monitor.readMemory(0x0800, 0xffff);
      const stops = new Set<number>();
      for (const match of labels.matchAll(/^\s*\S+\s*=\s*\$([0-9a-f]{1,4})/gimu)) {
        const address = Number.parseInt(match[1]!, 16);
        if (
          address >= 0x0800 &&
          address <= 0xfffc &&
          memory[address - 0x0800] === 0x78 &&
          memory[address - 0x0800 + 1] === 0x4c &&
          memory[address - 0x0800 + 2] === (address & 0xff) &&
          memory[address - 0x0800 + 3] === address >> 8
        ) {
          stops.add(address);
        }
      }
      expect([...stops]).toHaveLength(1);
      const stopAddress = [...stops][0];
      if (stopAddress === undefined) throw new Error("Missing labelled safety stop");
      const entryCheckpoint = await monitor.setExecuteCheckpoint(stopAddress);
      const jumpCheckpoint = await monitor.setExecuteCheckpoint(stopAddress + 1);
      const returnCheckpoint = await monitor.setExecuteCheckpoint(returnAddress);
      try {
        await resumeTo(monitor, stopAddress);
        expect([...(await monitor.readMemory(0x0420, 0x0421))]).toEqual([165, 165]);
        expect([...(await monitor.readMemory(0x0430, 0x0432))]).toEqual([1, 1, 1]);
        await resumeTo(monitor, stopAddress + 1);
        expect((await monitor.readCpuRegisters()).p & 0x04).toBe(0x04);
        await resumeTo(monitor, stopAddress);
        expect([...(await monitor.readMemory(0x0420, 0x0421))]).toEqual([165, 165]);
      } finally {
        await monitor.deleteCheckpoint(entryCheckpoint);
        await monitor.deleteCheckpoint(jumpCheckpoint);
        await monitor.deleteCheckpoint(returnCheckpoint);
      }
    });
  }, 60_000);
});
