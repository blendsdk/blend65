import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

const LARGE_FILL_SOURCE = [
  "module Game;",
  "function main(): void {",
  "  let before: byte = 165;",
  "  let after: byte = 90;",
  "  let buffer: byte[5000] = [0; 0];",
  "  let mismatches: word = 0;",
  "  for (let index: word = 0; index < length(buffer); index += 1) {",
  "    if (buffer[index] != 0) { mismatches += 1; }",
  "  }",
  "  pokew($0420, mismatches);",
  "  poke($0422, buffer[0]); poke($0423, buffer[255]);",
  "  poke($0424, buffer[256]); poke($0425, buffer[4999]);",
  "  pokew($0426, length(buffer));",
  "  poke($0428, before); poke($0429, after);",
  "}",
].join("\n");

async function withProgram(
  source: string,
  inspect: (directory: string, prg: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "blend65-array-fill-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "array-fill",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const built = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Array fill build failed");
    await inspect(
      built.generation.directory,
      join(built.generation.directory, built.generation.primaryArtifact),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function observations(
  directory: string,
  prg: string,
  lastAddress: number,
): Promise<number[]> {
  const labels = await readFile(join(directory, ".labels"), "utf8");
  const restore = labels.match(
    new RegExp(
      `^\\s*b65_[A-Za-z0-9_]+_${Buffer.from("startup.restore").toString("hex")}\\s*=\\s*\\$([0-9a-f]+)`,
      "imu",
    ),
  );
  if (restore === null) throw new Error("Missing startup restore checkpoint");
  const returnAddress = Number.parseInt(restore[1]!, 16);
  const started = await startVice(prg, 300_000_000);
  if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
  try {
    const checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
    try {
      const stopped = started.monitor.waitForStop(50_000);
      await started.monitor.resume();
      expect(await stopped).toBe(returnAddress);
      return [...(await started.monitor.readMemory(0x0420, lastAddress))];
    } finally {
      await started.monitor.deleteCheckpoint(checkpoint);
    }
  } finally {
    await stopVice({ child: started.child, monitor: started.monitor });
  }
}

describe.sequential("fixed array remaining-element fill", () => {
  it("keeps a 5000-byte uniform local initializer compact without optimization", async () => {
    await withProgram(LARGE_FILL_SOURCE, async (_directory, prg) => {
      // This includes startup and the observation loop, not just the fill instructions.
      expect((await readFile(prg)).length).toBeLessThan(1024);
    });
  }, 60_000);

  it("fills all 5000 bytes including page boundaries and the final element", async () => {
    await withProgram(LARGE_FILL_SOURCE, async (directory, prg) => {
      // The mismatch count examines every element; samples also expose boundary failures directly.
      expect(await observations(directory, prg, 0x0429)).toEqual([
        0, 0, 0, 0, 0, 0, 0x88, 0x13, 165, 90,
      ]);
    });
  }, 60_000);

  it("evaluates explicit prefixes once from left to right before a nonzero remaining fill", async () => {
    await withProgram(
      [
        "module Game;",
        "let calls: byte = 0;",
        "let order: byte = 0;",
        "function mark(value: byte): byte {",
        "  calls += 1; order = order * 10 + value; return value + 16;",
        "}",
        "function main(): void {",
        "  let values: byte[7] = [mark(1), mark(2), mark(3); 90];",
        "  poke($0420, calls); poke($0421, order);",
        ...Array.from(
          { length: 7 },
          (_, index) => `  poke($${(0x0422 + index).toString(16)}, values[${index}]);`,
        ),
        "}",
      ].join("\n"),
      async (directory, prg) => {
        expect(await observations(directory, prg, 0x0428)).toEqual([
          3, 123, 17, 18, 19, 90, 90, 90, 90,
        ]);
      },
    );
  }, 60_000);

  it("fills exactly 255, 256 and 257 bytes while preserving adjacent fields", async () => {
    await withProgram(
      [
        "module Game;",
        ...[255, 256, 257].map(
          (size) => `struct Frame${size} { before: byte; values: byte[${size}]; after: byte; }`,
        ),
        "function main(): void {",
        ...[255, 256, 257].flatMap((size, ordinal) => {
          const output = 0x0420 + ordinal * 6;
          const fill = ordinal === 0 ? 0 : ordinal === 1 ? 165 : 255;
          return [
            `  let frame${size}: Frame${size};`,
            `  frame${size}.before = 19; frame${size}.after = 37;`,
            `  frame${size}.values = [; ${fill}];`,
            `  let mismatches${size}: word = 0;`,
            `  for (let index: word = 0; index < ${size}; index += 1) {`,
            `    if (frame${size}.values[index] != ${fill}) { mismatches${size} += 1; }`,
            "  }",
            `  pokew($${output.toString(16)}, mismatches${size});`,
            `  poke($${(output + 2).toString(16)}, frame${size}.before);`,
            `  poke($${(output + 3).toString(16)}, frame${size}.after);`,
            `  poke($${(output + 4).toString(16)}, frame${size}.values[0]);`,
            `  poke($${(output + 5).toString(16)}, frame${size}.values[${size - 1}]);`,
          ];
        }),
        "}",
      ].join("\n"),
      async (directory, prg) => {
        expect(await observations(directory, prg, 0x0431)).toEqual([
          0, 0, 19, 37, 0, 0, 0, 0, 19, 37, 165, 165, 0, 0, 19, 37, 255, 255,
        ]);
      },
    );
  }, 60_000);
});
