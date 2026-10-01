import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Build and inspect one isolated final-memory assignment. */
async function withProgram(source: string, inspect: (directory: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "blend65-shared-storage-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "shared-storage",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected shared-memory build");
    await inspect(result.generation.directory);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Execute through source return within a finite host budget, then inspect predicted bytes. */
async function observations(directory: string, timeoutMs = 50_000): Promise<number[]> {
  const labels = await readFile(join(directory, ".labels"), "utf8");
  const restore = labels.match(
    new RegExp(
      `^\\s*b65_[A-Za-z0-9_]+_${Buffer.from("startup.restore").toString("hex")}\\s*=\\s*\\$([0-9a-f]+)`,
      "imu",
    ),
  );
  if (restore === null) throw new Error("Missing startup restore label");
  const address = Number.parseInt(restore[1]!, 16);
  const started = await startVice(join(directory, "shared-storage.prg"), 300_000_000);
  if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
  try {
    const checkpoint = await started.monitor.setExecuteCheckpoint(address);
    try {
      const stopped = started.monitor.waitForStop(timeoutMs);
      await started.monitor.resume();
      expect(await stopped).toBe(address);
      return [...(await started.monitor.readMemory(0x0420, 0x0421))];
    } finally {
      await started.monitor.deleteCheckpoint(checkpoint);
    }
  } finally {
    await stopVice({ child: started.child, monitor: started.monitor });
  }
}

it("admits a local frame larger than the old separate 4K storage pool", async () => {
  await withProgram(
    [
      "module Game;",
      "function main(): void {",
      "let buffer: byte[5000];",
      "buffer[0] = 19; buffer[4999] = 37;",
      "poke($0420, buffer[0]); poke($0421, buffer[4999]);",
      "}",
    ].join("\n"),
    async (directory) => {
      expect(await observations(directory)).toEqual([19, 37]);
      // An uninitialized frame occupies RAM, not emitted data or an initialization routine.
      expect((await readFile(join(directory, "shared-storage.prg"))).length).toBeLessThan(1024);
    },
  );
}, 60_000);

it.each([0xcefa, 0xcefb, 0xcf00])(
  "rebinds indirect calls and shared helpers after padding to %i",
  async (origin) => {
    await withProgram(
      [
        "module Game;",
        `place(at: ${origin}) const MARK: byte = 1;`,
        "function first(): byte { return peek($0440) * peek($0441); }",
        "function second(): byte { return peek($0440) * peek($0441); }",
        "function main(): void {",
        "poke($0440, 7); poke($0441, 9);",
        "let callback: fn(): byte = peek($0440) == 7 ? &first : &second;",
        "poke($0420, callback()); poke($0421, second() + MARK);",
        "}",
      ].join("\n"),
      async (directory) => {
        // Disk autostart loads the complete padded 50 KB image. Allow slower host scheduling
        // without changing the emulated program, checkpoint, or expected result bytes.
        expect(await observations(directory, 90_000)).toEqual([63, 64]);
        const assembly = await readFile(join(directory, ".asm"), "utf8");
        expect(assembly).toMatch(/jmp\s+\(/iu);
        const image = await readFile(join(directory, "shared-storage.prg"));
        expect(image.length - 2).toBe(origin + 1 - 0x0801);
      },
    );
  },
  100_000,
);

it("rebinds handler-owned IRQ links and private helpers after shared-RAM closure", async () => {
  await withProgram(
    [
      "module Game;",
      "import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;",
      "function triple(value: byte): byte { return value * 3; }",
      "interrupt function B(): void { poke($d019, 1); poke($0422, triple(7)); }",
      "interrupt function A(): void {",
      "  setIRQExclusive(&B); asm_cli(); asm_nop(); asm_sei(); restoreIRQ();",
      "}",
      "function main(): void {",
      "  let buffer: byte[5000];",
      "  buffer[0] = 19;",
      "  setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ();",
      "  poke($0420, buffer[0]); poke($0421, triple(7));",
      "}",
    ].join("\n"),
    async (directory) => {
      expect(await observations(directory)).toEqual([19, 21]);
      const assembly = await readFile(join(directory, ".asm"), "utf8");
      expect(assembly).toMatch(/jmp\s+\(\$[0-9a-f]+\)/iu);
      // The large local frame remains uninitialized RAM, not emitted image bytes.
      expect((await readFile(join(directory, "shared-storage.prg"))).length).toBeLessThan(1024);
    },
  );
}, 60_000);
