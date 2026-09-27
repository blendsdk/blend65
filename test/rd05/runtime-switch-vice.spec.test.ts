import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { profileRecord, profileRecords, withProfileProject } from "./profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";
const source = `module Game;
function selected(value: byte): byte {
  switch (value) {
    case 1: return 11;
    case 2: return 22;
    default: return 99;
  }
}
function selectedWord(value: word): byte {
  switch (value) {
    case $0001: return 11;
    case $0101: return 22;
    default: return 99;
  }
}
function withoutDefault(value: byte): byte {
  switch (value) { case 1: return 11; }
  return 99;
}
function selector(): byte { poke($0440, 7); return peek($0418); }
function main(): void {
  poke($0425, selected(peek($0400)));
  poke($0426, selected(peek($0401)));
  poke($0427, selected(peek($0402)));
  poke($0428, selected(peek($0403)));
  poke($0430, selectedWord(peekw($0410)));
  poke($0431, selectedWord(peekw($0412)));
  poke($0432, selectedWord(peekw($0414)));
  poke($0433, selectedWord(peekw($0416)));
  switch (selector()) {
    case 1: poke($0441, 11); fallthrough;
    case 2: poke($0442, 22);
    default: poke($0443, 99);
  }
  switch (peek($0419)) {
    case 1: poke($0444, 11);
    case 2: poke($0445, 22);
    default: poke($0446, 99);
  }
  poke($0447, withoutDefault(peek($041a)));
  poke($0448, withoutDefault(peek($041b)));
}`;

/** Decode published addresses exclusively for execution checkpoints. */
function addresses(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Resolve a unique public startup checkpoint by its logical name. */
function startupAddress(labels: Map<string, number>, name: string): number {
  const matches = [...labels].filter(([label]) =>
    label.endsWith(`_${Buffer.from(name).toString("hex")}`),
  );
  expect(matches, name).toHaveLength(1);
  return matches[0]![1];
}

describe.sequential("runtime switches in pinned PAL VICE", () => {
  // Runtime selectors select exact results and effects, then return with the BASIC caller intact.
  it("should preserve byte and word selection, effect order, and the ordinary caller return", async () => {
    await withProfileProject(source, target, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Runtime switch build failed");
      const directory = built.generation.directory;
      const prgPath = join(directory, built.generation.primaryArtifact);
      const prg = await readFile(prgPath);
      // Reserve the same test-only status trampoline used by startup qualification.
      expect([...prg.subarray(0, 2)]).toEqual([1, 8]);
      expect(0x0801 + prg.length - 2).toBeLessThan(0xc000);
      const labels = addresses(await readFile(join(directory, ".labels"), "utf8"));
      const entry = startupAddress(labels, "startup.entry");
      const restore = startupAddress(labels, "startup.restore");
      const debug = profileRecord(
        JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")),
      );
      const main = profileRecords(debug.functions).find(
        (fn) => fn.qualifiedName === "src/game.blend::Game.main",
      );
      if (!main) throw new Error("Missing public main function record");
      const variants = profileRecords(main.entryVariants);
      expect(variants).toHaveLength(1);
      const mainLabel = variants[0]!.label;
      if (typeof mainLabel !== "string") throw new Error("Missing public main entry label");
      const mainAddress = labels.get(mainLabel);
      if (mainAddress === undefined) throw new Error("Missing assembled main address");
      const started = await startVice(prgPath, 100_000_000, target);
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const { monitor } = started;
      const checkpoints = new Set<number>();
      let entryBytes: Uint8Array | undefined;
      /** Arm observation before resuming so short functions cannot race the waiter. */
      const resume = async () => {
        const stopped = monitor.waitForStop(20_000);
        await monitor.resume();
        return stopped;
      };
      const checkpoint = async (address: number) => {
        const id = await monitor.setExecuteCheckpoint(address);
        checkpoints.add(id);
        return id;
      };
      const remove = async (id: number) => {
        await monitor.deleteCheckpoint(id);
        checkpoints.delete(id);
      };
      try {
        expect(await monitor.readIntegerResource("VICIIModel")).toBe(0);
        expect(await monitor.readIntegerResource("SidModel")).toBe(0);
        const atEntry = await checkpoint(entry);
        expect(await resume()).toBe(entry);
        entryBytes = await monitor.readMemory(entry, entry + 2);
        await monitor.writeMemory(
          0xc000,
          Uint8Array.of(0x78, 0xf8, 0x4c, entry & 0xff, entry >> 8),
        );
        await monitor.writeMemory(entry, Uint8Array.of(0x4c, 0, 0xc0));
        const atTrampoline = await checkpoint(0xc000);
        expect(await resume()).toBe(0xc000);
        await monitor.writeMemory(entry, entryBytes);
        await remove(atTrampoline);
        expect(await resume()).toBe(entry);
        const entryCpu = await monitor.readCpuRegisters();
        expect(entryCpu.p & 0x0c).toBe(0x0c);
        const stackByte = async (offset: number) => {
          const address = 0x0100 + ((entryCpu.sp + offset) & 0xff);
          return (await monitor.readMemory(address, address))[0]!;
        };
        const callerReturn = (((await stackByte(1)) | ((await stackByte(2)) << 8)) + 1) & 0xffff;
        await remove(atEntry);
        const atMain = await checkpoint(mainAddress);
        await checkpoint(restore);
        await checkpoint(callerReturn);
        expect(await resume()).toBe(mainAddress);
        expect((await monitor.readCpuRegisters()).p & 8).toBe(0);
        await monitor.writeMemory(0x0400, Uint8Array.of(1, 2, 0, 255));
        await monitor.writeMemory(0x0410, Uint8Array.of(1, 0, 1, 1, 0, 0, 255, 255, 1, 1, 1, 0));
        await monitor.writeMemory(0x0425, new Uint8Array(4));
        await monitor.writeMemory(0x0430, new Uint8Array(4));
        await monitor.writeMemory(0x0440, new Uint8Array(9));
        const events = new Map<number, string>();
        for (const [operation, locations] of [
          [
            "load",
            [0x0400, 0x0401, 0x0402, 0x0403, ...Array.from({ length: 12 }, (_, n) => 0x0410 + n)],
          ],
          [
            "store",
            [
              0x0425,
              0x0426,
              0x0427,
              0x0428,
              0x0430,
              0x0431,
              0x0432,
              0x0433,
              ...Array.from({ length: 9 }, (_, n) => 0x0440 + n),
            ],
          ],
        ] as const) {
          for (const address of locations) {
            const id = await monitor.setAccessTracepoint(address, operation);
            checkpoints.add(id);
            events.set(id, `${operation}:${address.toString(16)}`);
          }
        }
        await remove(atMain);
        monitor.takeCheckpointHits();
        expect(await resume()).toBe(restore);
        const trace = monitor.takeCheckpointHits().flatMap((id) => {
          const event = events.get(id);
          return event === undefined ? [] : [event];
        });
        const byteResults = [...(await monitor.readMemory(0x0425, 0x0428))];
        const wordResults = [...(await monitor.readMemory(0x0430, 0x0433))];
        const effects = [...(await monitor.readMemory(0x0440, 0x0448))];
        expect(byteResults).toEqual([11, 22, 99, 99]);
        expect(wordResults).toEqual([11, 22, 99, 99]);
        expect(effects).toEqual([7, 11, 22, 0, 11, 0, 0, 11, 99]);
        const expected = [
          "load:400",
          "store:425",
          "load:401",
          "store:426",
          "load:402",
          "store:427",
          "load:403",
          "store:428",
        ];
        // Both bytes must be read once before each word result; their internal read order is immaterial.
        for (let n = 0; n < 4; n += 1) {
          const offset = expected.length;
          const reads = [
            `load:${(0x0410 + n * 2).toString(16)}`,
            `load:${(0x0411 + n * 2).toString(16)}`,
          ];
          expect(trace.slice(offset, offset + 2).sort()).toEqual(reads);
          expected.push(...trace.slice(offset, offset + 2), `store:${(0x0430 + n).toString(16)}`);
        }
        expected.push(
          "store:440",
          "load:418",
          "store:441",
          "store:442",
          "load:419",
          "store:444",
          "load:41a",
          "store:447",
          "load:41b",
          "store:448",
        );
        expect(trace).toEqual(expected);
        expect(await resume()).toBe(callerReturn);
        const exitCpu = await monitor.readCpuRegisters();
        expect(exitCpu.p & 0x0c).toBe(entryCpu.p & 0x0c);
        expect(exitCpu.sp).toBe((entryCpu.sp + 2) & 0xff);
        console.info(
          "Runtime switch evidence",
          JSON.stringify({
            profile: target,
            artifactSha256: createHash("sha256").update(prg).digest("hex"),
            byteResults,
            wordResults,
            effects,
            trace,
            entryCpu,
            exitCpu,
            callerReturn,
          }),
        );
      } finally {
        try {
          if (entryBytes) await monitor.writeMemory(entry, entryBytes);
          for (const id of checkpoints) await monitor.deleteCheckpoint(id);
        } finally {
          await stopVice({ child: started.child, monitor });
        }
      }
    });
  });
});
