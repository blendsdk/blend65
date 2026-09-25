import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

type BuildResult = Awaited<ReturnType<typeof buildProject>>;

/** Build one project with exact source and asset bytes, then remove its temporary files. */
async function withBuild<T>(
  source: readonly string[],
  assets: readonly { readonly name: string; readonly bytes: Uint8Array }[],
  inspect: (result: BuildResult, root: string) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-intrinsics-spec-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "intrinsics-spec",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(join(root, "src/game.blend"), source.join("\n"));
    for (const asset of assets) {
      const path = join(root, "src", asset.name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, asset.bytes);
    }
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    return await inspect(result, root);
  } finally {
    await rm(root, { recursive: true });
  }
}

/** Execute a successful C64 build until its startup return and observe screen memory. */
async function observe(source: readonly string[], lastAddress: number): Promise<number[]> {
  return withBuild(source, [], async (result) => {
    expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
      "success",
    );
    if (result.kind !== "success") throw new Error("Expected an executable intrinsic program");
    const labels = await readFile(join(result.generation.directory, ".labels"), "utf8");
    const returnLabel = `b65_${Buffer.from("startup.restore").toString("hex")}`;
    const returnMatch = labels.match(
      new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "imu"),
    );
    expect(returnMatch).not.toBeNull();
    const returnAddress = Number.parseInt(returnMatch?.[1] ?? "", 16);
    const started = await startVice(
      join(result.generation.directory, result.generation.primaryArtifact),
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    try {
      const checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
      try {
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(returnAddress);
        return [...(await started.monitor.readMemory(0x0420, lastAddress))];
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  });
}

/** Return emitted assembly for a valid source program. */
async function assemblyFor(source: readonly string[]): Promise<string> {
  return withBuild(source, [], async (result) => {
    expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
      "success",
    );
    if (result.kind !== "success") throw new Error("Expected a valid intrinsic program");
    return readFile(join(result.generation.directory, ".asm"), "utf8");
  });
}

describe.sequential("C64 intrinsic execution", () => {
  // The low byte uses ordinary RAM; at $FFFF only the high byte is checked because the low read may see ROM.
  it("should evaluate dynamic memory arguments once and wrap the high byte to $0000", async () => {
    const bytes = await observe(
      [
        "module Game;",
        "function address(): word { poke($0430, peek($0430) + 1); return $0404; }",
        "function value(): word { poke($0431, peek($0431) + 1); return $1234; }",
        "function main(): void {",
        "  poke($0430, 0); poke($0431, 0);",
        "  pokew(address(), value());",
        "  let target: word = $0404;",
        "  let observed: word = peekw(target);",
        "  poke($0420, lo(observed)); poke($0421, hi(observed));",
        "  poke($0422, peek($0430)); poke($0423, peek($0431));",
        "  let previousDDR: byte = peek($0000);",
        "  let tail: word = $FFFF;",
        "  pokew(tail, $5A12);",
        "  poke($0424, hi(peekw(tail)));",
        "  poke($0000, previousDDR);",
        "}",
      ],
      0x0424,
    );
    expect(bytes).toEqual([0x34, 0x12, 1, 1, 0x5a]);
  }, 60_000);

  // Decimal operations wrap by decimal digits and leave D clear for ordinary binary arithmetic.
  it("should execute byte and word BCD arithmetic with selected NMOS invalid-digit behavior", async () => {
    const bytes = await observe(
      [
        "module Game;",
        "function main(): void {",
        "  poke($0400, $99);",
        "  poke($0420, bcd_add(peek($0400), byte(1)));",
        "  poke($0400, 0);",
        "  poke($0421, bcd_sub(peek($0400), byte(1)));",
        "  pokew($0402, $9999);",
        "  pokew($0422, bcd_add(peekw($0402), word(1)));",
        "  pokew($0402, 0);",
        "  pokew($0424, bcd_sub(peekw($0402), word(1)));",
        "  poke($0400, $0A);",
        "  poke($0426, bcd_add(peek($0400), byte(0)));",
        "  poke($0427, byte(9) + byte(1));",
        "}",
      ],
      0x0427,
    );
    expect(bytes).toEqual([0, 0x99, 0, 0, 0x99, 0x99, 0x10, 10]);
  }, 60_000);

  // A constant-address word write stores its low byte before its high byte.
  it("should emit low-first stores for a constant-address word write", async () => {
    const assembly = await assemblyFor([
      "module Game;",
      "function main(): void { pokew($C000, $1234); }",
    ]);
    expect([...assembly.matchAll(/^\s*(?:sta|stx|sty)\s+\$c000\b/gimu)]).toHaveLength(1);
    expect([...assembly.matchAll(/^\s*(?:sta|stx|sty)\s+\$c001\b/gimu)]).toHaveLength(1);
    expect(assembly).toMatch(
      /^\s*(?:sta|stx|sty)\s+\$c000\b[\s\S]*^\s*(?:sta|stx|sty)\s+\$c001\b/imu,
    );
  });

  // The five named controls each contribute one non-removable source-ordered instruction.
  it("should emit each CPU control once in source order", async () => {
    const assembly = await assemblyFor([
      "module Game;",
      "function main(): void { asm_php(); asm_sei(); asm_nop(); asm_plp(); asm_cli(); }",
    ]);
    const baseline = await assemblyFor(["module Game;", "function main(): void {}"]);
    for (const opcode of ["php", "sei", "nop", "plp", "cli"]) {
      const pattern = new RegExp(`^\\s*${opcode}\\b`, "gimu");
      const increase =
        [...assembly.matchAll(pattern)].length - [...baseline.matchAll(pattern)].length;
      expect(increase, `Expected one ${opcode.toUpperCase()} from source`).toBe(1);
    }
    expect(assembly).toMatch(
      /^\s*php\b[\s\S]*^\s*sei\b[\s\S]*^\s*nop\b[\s\S]*^\s*plp\b[\s\S]*^\s*cli\b/imu,
    );
  });
});

describe("raw embedded inputs", () => {
  // Two declarations of one contained input share one immutable emitted byte sequence.
  it("should deduplicate identical raw embedded data", async () => {
    const data = Uint8Array.from({ length: 32 }, (_, index) => (index * 37 + 11) & 0xff);
    await withBuild(
      [
        "module Game;",
        'const FIRST: byte[] = embed("data.bin");',
        'const SECOND: byte[] = embed("data.bin");',
        "function main(): void { poke($0400, FIRST[0] + SECOND[1]); }",
      ],
      [{ name: "data.bin", bytes: data }],
      async (result) => {
        expect(
          result.kind,
          result.kind === "failure" ? JSON.stringify(result.diagnostics) : "",
        ).toBe("success");
        if (result.kind !== "success") throw new Error("Expected contained raw data");
        expect(result.diagnostics.map(({ code }) => code)).toContain("W10151");
        const image = await readFile(
          join(result.generation.directory, result.generation.primaryArtifact),
        );
        expect(image.indexOf(data)).toBeGreaterThanOrEqual(0);
        expect(image.lastIndexOf(data)).toBe(image.indexOf(data));
      },
    );
  });

  // A selector is never accepted for raw data, and native extensions never fall back to raw.
  it.each([
    ["raw selector", 'const DATA: byte[] = embed("data.bin", "sprites");', "E10137"],
    [
      "nonliteral selector",
      'const KEY: byte[7] = "sprites"; const DATA: byte[] = embed("data.bin", KEY);',
      "E10250",
    ],
    ["registered malformed version", 'const DATA: byte[] = embed("bad.spd");', "E10204"],
    ["parent traversal", 'const DATA: byte[] = embed("../data.bin");', "PROJECT_PATH_INVALID"],
  ])("should reject %s without publishing an asset", async (_case, declaration, code) => {
    await withBuild(
      ["module Game;", declaration, "function main(): void {}"],
      [
        { name: "data.bin", bytes: Uint8Array.from([1, 2, 3]) },
        { name: "bad.spd", bytes: Uint8Array.from([1, 2, 3]) },
      ],
      async (result, root) => {
        expect(result.kind).toBe("failure");
        expect(result.diagnostics.map(({ code: actual }) => actual)).toContain(code);
        const outputFiles = await readdir(join(root, "out")).catch(() => []);
        expect(outputFiles.filter((name) => name.endsWith(".prg"))).toEqual([]);
      },
    );
  });
});
