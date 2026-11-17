import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { profileRecord, profileRecords, readProfileArtifacts } from "./profile-fixture.js";

describe.sequential("captured processor-port startup in PAL 6581 VICE", () => {
  it.each([
    { name: "unchanged live readbacks", livePort: 0xa7, liveDirection: 0xff },
    { name: "port readback changes after capture", livePort: 0x07, liveDirection: 0xff },
    { name: "direction changes after capture", livePort: 0xa7, liveDirection: 0xf7 },
  ])(
    "uses saved FF/A7 with $name",
    async ({ livePort, liveDirection }) => {
      const root = await mkdtemp(
        join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "startup-captured-port-"),
      );
      let vice: Awaited<ReturnType<typeof startVice>> | undefined;
      const checkpoints = new Set<number>();
      try {
        const example = fileURLToPath(new URL("../../examples/boing-ball/", import.meta.url));
        await mkdir(join(root, "src"));
        await mkdir(join(root, "assets"));
        await copyFile(join(example, "src", "main.blend"), join(root, "src", "main.blend"));
        await copyFile(join(example, "assets", "ball.bin"), join(root, "assets", "ball.bin"));
        await copyFile(join(example, "blend65.json"), join(root, "blend65.json"));
        const built = await buildProject({
          project: join(root, "blend65.json"),
          optimization: "none",
        });
        if (built.kind !== "success")
          throw new Error("The unchanged Boing Ball fixture must build before runtime observation");
        const artifacts = await readProfileArtifacts(built);
        if (!Array.isArray(artifacts.memory.intervals))
          throw new Error("Memory artifact must contain an intervals array");
        const intervals = profileRecords(artifacts.memory.intervals).filter(
          (record) => record.addressSpaceId === "cpu16",
        );
        for (const interval of intervals) {
          const { id, kind, start, end, size } = interval;
          if (
            typeof id !== "string" ||
            typeof kind !== "string" ||
            typeof start !== "number" ||
            !Number.isInteger(start) ||
            start < 0 ||
            typeof end !== "number" ||
            !Number.isInteger(end) ||
            end > 0x10000 ||
            end <= start ||
            typeof size !== "number" ||
            !Number.isInteger(size) ||
            size !== end - start
          ) {
            throw new Error(
              "CPU16 intervals require named, nonempty, integer address ranges with exclusive ends",
            );
          }
        }
        const entries = intervals.filter((record) => record.id === "code.startup.entry");
        const states = intervals.filter((record) => record.id === "platform.startup-state");
        expect(entries).toHaveLength(1);
        expect(states).toHaveLength(1);
        const entry = profileRecord(entries[0]);
        const state = profileRecord(states[0]);
        const entryStart = entry.start;
        const entryEnd = entry.end;
        const stateStart = state.start;
        if (
          entry.kind !== "code" ||
          typeof entryStart !== "number" ||
          typeof entryEnd !== "number" ||
          typeof stateStart !== "number" ||
          state.size !== 49
        ) {
          throw new Error(
            "The fixture requires the full startup entry and its unchanged 49-byte CPU16 snapshot",
          );
        }
        expect(entryStart).toBe(0x080d);
        expect(artifacts.prg.length).toBeGreaterThan(2);
        const load = artifacts.prg.readUInt16LE(0);
        const first = entryStart - load + 2;
        const last = entryEnd - load + 2;
        expect(first).toBeGreaterThanOrEqual(2);
        expect(last).toBeLessThanOrEqual(artifacts.prg.length);
        const bytes = artifacts.prg.subarray(first, last);
        const directionCaptures: number[] = [];
        const portCaptures: number[] = [];
        const portStores: number[] = [];
        const directionStores: number[] = [];
        // These bounded adapters accept any matching A/X/Y capture without choosing its register.
        // They locate observations; the accumulator values below are the behavior oracle.
        for (let index = 0; index < bytes.length; index += 1) {
          const opcode = bytes[index];
          const storeOpcode =
            opcode === 0xa5 ? 0x8d : opcode === 0xa6 ? 0x8e : opcode === 0xa4 ? 0x8c : -1;
          if (index + 4 < bytes.length && storeOpcode >= 0 && bytes[index + 2] === storeOpcode) {
            const destination = bytes.readUInt16LE(index + 3);
            if (bytes[index + 1] === 0 && destination === stateStart + 5)
              directionCaptures.push(entryStart + index);
            if (bytes[index + 1] === 1 && destination === stateStart + 6)
              portCaptures.push(entryStart + index);
          }
          if (
            index + 5 < bytes.length &&
            bytes[index] === 0x29 &&
            bytes[index + 1] === 0xf8 &&
            bytes[index + 2] === 0x09 &&
            bytes[index + 3] === 0x06 &&
            bytes[index + 4] === 0x85 &&
            bytes[index + 5] === 1
          ) {
            portStores.push(entryStart + index + 4);
          }
          if (
            index + 3 < bytes.length &&
            bytes[index] === 0x09 &&
            bytes[index + 1] === 7 &&
            bytes[index + 2] === 0x85 &&
            bytes[index + 3] === 0
          ) {
            directionStores.push(entryStart + index + 2);
          }
        }
        expect(directionCaptures).toHaveLength(1);
        expect(portCaptures).toHaveLength(1);
        expect(portStores).toHaveLength(1);
        expect(directionStores).toHaveLength(1);
        const captureDirection = directionCaptures[0];
        const capturePort = portCaptures[0];
        const storePort = portStores[0];
        const storeDirection = directionStores[0];
        if (
          captureDirection === undefined ||
          capturePort === undefined ||
          storePort === undefined ||
          storeDirection === undefined
        ) {
          throw new Error(
            "The startup observation points must be uniquely located within its CPU16 entry",
          );
        }
        expect(captureDirection).toBeLessThan(capturePort);
        expect(capturePort + 5).toBeLessThan(storePort);
        expect(storePort).toBeLessThan(storeDirection);
        const mainLabels = [
          ...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu),
        ].filter((match) => /^b65_Main_main_[^_]+$/u.test(match[1] ?? ""));
        expect(mainLabels).toHaveLength(1);
        const mainText = mainLabels[0]?.[2];
        if (!mainText) throw new Error("The fixture requires one linked Main.main label");
        const main = Number.parseInt(mainText, 16);
        expect(Number.isInteger(main) && main >= 0 && main < 0x10000).toBe(true);
        expect(
          intervals.some(
            (record) =>
              record.kind === "code" &&
              typeof record.start === "number" &&
              typeof record.end === "number" &&
              record.start <= main &&
              main < record.end,
          ),
        ).toBe(true);

        vice = await startVice(
          join(built.generation.directory, built.generation.primaryArtifact),
          100_000_000,
          "c64-pal-prg-kernal-6581",
        );
        if ("kind" in vice)
          throw new Error(`VICE 3.10 x64sc is required for this fixture: ${vice.reason}`);
        const { monitor } = vice;
        const points = [
          entryStart,
          captureDirection,
          capturePort + 5,
          storePort,
          storeDirection,
          main,
        ];
        expect(new Set(points).size).toBe(points.length);
        const ids: number[] = [];
        for (const point of points) {
          const id = await monitor.setExecuteCheckpoint(point);
          checkpoints.add(id);
          ids.push(id);
        }
        const portStoreId = ids[3];
        const directionStoreId = ids[4];
        if (portStoreId === undefined || directionStoreId === undefined)
          throw new Error("Compiler store checkpoints were not armed");
        let caller: Awaited<ReturnType<typeof monitor.readCpuRegisters>> | undefined;
        let vectors: Uint8Array | undefined;
        const hits: number[] = [];
        monitor.takeCheckpointHits();
        for (const [phase, point] of points.entries()) {
          // The stop listener must exist before execution can reach the next instruction.
          const stopped = monitor.waitForStop(30_000);
          await monitor.resume();
          expect(await stopped).toBe(point);
          hits.push(...monitor.takeCheckpointHits());
          const registers = await monitor.readCpuRegisters();
          if (phase === 0) {
            caller = registers;
            vectors = await monitor.readMemory(0x0314, 0x0319);
            expect(registers.p & 0x0c).toBe(0);
          } else if (phase === 1) {
            // All pins are outputs for an exact A7 readback. This changes no CPU register.
            await monitor.writeMemory(0, Uint8Array.of(0xff, 0xa7));
            expect([...(await monitor.readMemory(0, 1))]).toEqual([0xff, 0xa7]);
          } else if (phase === 2) {
            expect([...(await monitor.readMemory(stateStart + 5, stateStart + 6))]).toEqual([
              0xff, 0xa7,
            ]);
            // The DDR change isolates compiler provenance; it does not model a stock ROM DDR write.
            // Both mutations retain valid low mapping pins and leave the captured homes untouched.
            await monitor.writeMemory(1, Uint8Array.of(livePort));
            await monitor.writeMemory(0, Uint8Array.of(liveDirection));
            expect([...(await monitor.readMemory(0, 1))]).toEqual([liveDirection, livePort]);
          } else if (phase === 3) {
            // Execute checkpoints stop before STA, even when a device store watch would stop in ROM.
            expect
              .soft(registers.a, "compiler port write must use captured A7, not a later readback")
              .toBe(0xa6);
            expect
              .soft([...(await monitor.readMemory(stateStart + 5, stateStart + 6))])
              .toEqual([0xff, 0xa7]);
          } else if (phase === 4) {
            expect
              .soft(registers.a, "compiler DDR write must use captured FF, not a later F7")
              .toBe(0xff);
            expect
              .soft([...(await monitor.readMemory(stateStart + 5, stateStart + 6))])
              .toEqual([0xff, 0xa7]);
          } else {
            if (!caller || !vectors)
              throw new Error("Caller state must be observed before startup executes");
            const saved = await monitor.readMemory(stateStart, stateStart + 6);
            expect.soft([...saved.subarray(0, 3)]).toEqual([caller.a, caller.x, caller.y]);
            expect.soft((saved[3] ?? -1) & 0xcf).toBe(caller.p & 0xcf);
            expect.soft(saved[4]).toBe(caller.sp);
            expect.soft([...saved.subarray(5, 7)]).toEqual([0xff, 0xa7]);
            expect.soft(registers.p & 8).toBe(0);
            expect.soft(registers.p & 4).toBe(caller.p & 4);
            // Nonreturning tail entry owns no additional call frame.
            expect.soft(registers.sp).toBe(caller.sp);
            expect.soft([...(await monitor.readMemory(0x0314, 0x0319))]).toEqual([...vectors]);
            const mapping = await monitor.readMemory(0, 1);
            expect.soft((mapping[0] ?? -1) & 7).toBe(7);
            expect.soft((mapping[1] ?? -1) & 7).toBe(6);
            // Firmware may independently change upper port bits while interrupts remain enabled.
            // Only the compiler's pre-STA input above is required to retain the captured upper bits.
          }
        }
        hits.push(...monitor.takeCheckpointHits());
        expect(hits.filter((id) => id === portStoreId || id === directionStoreId)).toEqual([
          portStoreId,
          directionStoreId,
        ]);
      } finally {
        try {
          if (vice && !("kind" in vice)) {
            try {
              for (const id of checkpoints) await vice.monitor.deleteCheckpoint(id);
            } finally {
              await stopVice(vice);
            }
          }
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }
    },
    180_000,
  );
});
