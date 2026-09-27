import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { profileRecord, profileRecords, withProfileProject } from "./profile-fixture.js";

const profiles = [
  ["c64-pal-prg-kernal-6581", 0, 0, 312, 6581, 6],
  ["c64-pal-prg-kernal-8580", 0, 1, 312, 8580, 6],
  ["c64-ntsc-prg-kernal-6581", 3, 0, 263, 6581, 2],
  ["c64-ntsc-prg-kernal-8580", 3, 1, 263, 8580, 2],
] as const;
type ProfileId = (typeof profiles)[number][0];
const launch: (prg: string, cycles: number, profile: ProfileId) => ReturnType<typeof startVice> =
  startVice;
const source = `module Game;
place(at: $3000) const DATA: byte[3] = [13, 29, 47];
function initialize(): byte { poke($0428, peek($0428) + 1); return 19; }
let initialized: byte = initialize();
function main(): void {
  pokew($0420, c64.profile.rasterLines);
  pokew($0422, c64.profile.sidModel);
  poke($0424, initialized);
  poke($0425, DATA[0]);
  if (c64.profile.isPal) { c64.vic.setBorderColor(6); }
  else { c64.vic.setBorderColor(2); }
}`;

/** Decode the public label map only to locate checkpoints, never to derive expected behavior. */
function addresses(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Find one public startup symbol by its documented logical name. */
function startupAddress(labels: Map<string, number>, name: string): number {
  const matches = [...labels].filter(([label]) =>
    label.endsWith(`_${Buffer.from(name).toString("hex")}`),
  );
  expect(matches, name).toHaveLength(1);
  return matches[0]![1];
}

/** Capture stable readable device state, excluding raster, collision and interrupt side effects. */
async function machineState(monitor: ViceMonitor) {
  const colors = [...(await monitor.readIo(0xd020, 0xd02e))].map((value) => value & 0x0f);
  const control = [];
  for (const [address, mask] of [
    [0xd015, 0xff],
    [0xd017, 0xff],
    [0xd018, 0xfe],
    [0xd01b, 0xff],
    [0xd01c, 0xff],
    [0xd01d, 0xff],
  ] as const) {
    control.push((await monitor.readIo(address, address))[0]! & mask);
  }
  return {
    ports: [...(await monitor.readMemory(0, 1))],
    cinv: [...(await monitor.readMemory(0x0314, 0x0315))],
    nminv: [...(await monitor.readMemory(0x0318, 0x0319))],
    ciaPort: [...(await monitor.readIo(0xdd00, 0xdd00))],
    ciaDirection: [...(await monitor.readIo(0xdd02, 0xdd02))],
    positions: [...(await monitor.readIo(0xd000, 0xd010))],
    control,
    colors,
    pointers: [...(await monitor.readMemory(0x07f8, 0x07ff))],
  };
}

/** Observe the narrow integer-resource reader without requiring it during test collection. */
async function activeResources(monitor: ViceMonitor) {
  const read: unknown = Reflect.get(monitor, "readIntegerResource");
  expect(read, "integer-resource reader").toBeTypeOf("function");
  if (typeof read !== "function") throw new Error("Missing integer-resource reader");
  const values: Record<string, unknown> = {};
  for (const name of ["VICIIModel", "SidModel", "CIA1Model", "CIA2Model", "KernalRev"])
    values[name] = await Reflect.apply(read, monitor, [name]);
  return values;
}

describe.sequential("four-profile real VICE startup and normal return", () => {
  // Each fresh source build must attest its machine, execute selected facts once and restore its caller.
  it.each(profiles)(
    "should qualify %s with the selected resources and restored state",
    async (profile, vic, sid, rasterLines, sidModel, border) => {
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Fresh profile build failed");
        const directory = built.generation.directory;
        const prgPath = join(directory, built.generation.primaryArtifact);
        const prg = await readFile(prgPath);
        const artifactSha256 = createHash("sha256").update(prg).digest("hex");
        expect([...prg.subarray(0, 2)]).toEqual([1, 8]);
        // The temporary trampoline is above all loaded fixture bytes and outside language-owned data.
        expect(0x0801 + prg.length - 2).toBeLessThan(0xc000);
        const labels = addresses(await readFile(join(directory, ".labels"), "utf8"));
        const entry = startupAddress(labels, "startup.entry");
        const restore = startupAddress(labels, "startup.restore");
        expect(entry).toBe(0x080d);
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
        const started = await launch(prgPath, 100_000_000, profile);
        if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
        const { monitor } = started;
        const checkpoints = new Set<number>();
        let entryBytes: Uint8Array | undefined;
        /** Arm the stop waiter before resume so fast stops cannot race observation. */
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
          expect(started.identity.executableSha256).toBe(
            "f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74",
          );
          expect(
            started.identity.roms
              .map((rom) => ({ name: basename(rom.path), bytes: rom.bytes, sha256: rom.sha256 }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          ).toEqual([
            {
              name: "basic-901226-01.bin",
              bytes: 8192,
              sha256: "89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d",
            },
            {
              name: "chargen-901225-01.bin",
              bytes: 4096,
              sha256: "fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420",
            },
            {
              name: "kernal-901227-03.bin",
              bytes: 8192,
              sha256: "83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721",
            },
          ]);
          const resources = await activeResources(monitor);
          expect(resources).toEqual({
            VICIIModel: vic,
            SidModel: sid,
            CIA1Model: 0,
            CIA2Model: 0,
            KernalRev: 3,
          });
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
          const entryState = await machineState(monitor);
          const stackByte = async (offset: number) => {
            const address = 0x0100 + ((entryCpu.sp + offset) & 0xff);
            return (await monitor.readMemory(address, address))[0]!;
          };
          const callerReturn = (((await stackByte(1)) | ((await stackByte(2)) << 8)) + 1) & 0xffff;
          await remove(atEntry);
          await monitor.writeMemory(0x0420, new Uint8Array(9));
          expect([...(await monitor.readMemory(0x3000, 0x3002))]).toEqual([13, 29, 47]);
          const dataWrites = [];
          for (const address of [0x3000, 0x3001, 0x3002]) {
            const id = await monitor.setAccessTracepoint(address, "store");
            checkpoints.add(id);
            dataWrites.push(id);
          }
          const initializer = await monitor.setAccessTracepoint(0x0428, "store");
          const borderWrite = await monitor.setAccessTracepoint(0xd020, "store");
          checkpoints.add(initializer);
          checkpoints.add(borderWrite);
          const atMain = await checkpoint(mainAddress);
          await checkpoint(restore);
          await checkpoint(callerReturn);
          monitor.takeCheckpointHits();
          expect(await resume()).toBe(mainAddress);
          const startupHits = monitor.takeCheckpointHits();
          expect(startupHits.filter((id) => id === initializer)).toHaveLength(1);
          const mainCpu = await monitor.readCpuRegisters();
          expect(mainCpu.p & 8).toBe(0);
          const ports = [...(await monitor.readMemory(0, 1))];
          expect(ports[0]! & 7).toBe(7);
          expect(ports[1]! & 7).toBe(6);
          expect(ports.map((value) => value & 0xf8)).toEqual(
            entryState.ports.map((value) => value & 0xf8),
          );
          expect([...(await monitor.readMemory(0x0428, 0x0428))]).toEqual([1]);
          await remove(atMain);
          expect(await resume()).toBe(restore);
          const bodyHits = monitor.takeCheckpointHits();
          expect(bodyHits.filter((id) => id === borderWrite)).toHaveLength(1);
          expect([...(await monitor.readMemory(0x0420, 0x0425))]).toEqual([
            rasterLines & 0xff,
            rasterLines >> 8,
            sidModel & 0xff,
            sidModel >> 8,
            19,
            13,
          ]);
          expect((await monitor.readIo(0xd020, 0xd020))[0]! & 0x0f).toBe(border);
          const stop = await resume();
          expect(stop).toBe(callerReturn);
          const returnHits = monitor.takeCheckpointHits();
          const allHits = [...startupHits, ...bodyHits, ...returnHits];
          expect(allHits.filter((id) => dataWrites.includes(id))).toEqual([]);
          expect(allHits.filter((id) => id === initializer)).toHaveLength(1);
          const exitCpu = await monitor.readCpuRegisters();
          expect(exitCpu.p & 0x0c).toBe(entryCpu.p & 0x0c);
          expect(exitCpu.sp).toBe((entryCpu.sp + 2) & 0xff);
          const exitState = await machineState(monitor);
          expect(exitState).toEqual(entryState);
          expect([...(await monitor.readMemory(0x3000, 0x3002))]).toEqual([13, 29, 47]);
          console.info(
            "Profile runtime evidence",
            JSON.stringify({
              profile,
              artifactSha256,
              identity: started.identity,
              resources,
              entryCpu,
              mainCpu,
              exitCpu,
              entryState,
              exitState,
              stop,
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
    },
    90_000,
  );
});
