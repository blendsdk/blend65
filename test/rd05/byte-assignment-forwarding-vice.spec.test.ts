import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** Locate the unique application device store in real CPU code, not asset bytes. */
function assignmentWindow(prg: Buffer, memory: Record<string, unknown>) {
  const origin = prg.readUInt16LE(0);
  const byte = (address: number): number => {
    const offset = address - origin + 2;
    if (offset < 2 || offset >= prg.length) throw new Error("Instruction outside PRG");
    return prg[offset]!;
  };
  const stores: number[] = [];
  const regions = profileRecords(memory.intervals).filter(
    (entry) => entry.addressSpaceId === "cpu16" && entry.kind === "code",
  );
  expect(regions.length).toBeGreaterThan(0);
  for (const region of regions) {
    if (
      typeof region.start !== "number" ||
      typeof region.end !== "number" ||
      typeof region.size !== "number"
    ) {
      throw new Error("Code interval requires exact numeric bounds");
    }
    expect(region.end - region.start).toBe(region.size);
    for (let pc = region.start; pc + 2 < region.end; pc += 1) {
      if (byte(pc) === 0x8d && byte(pc + 1) === 0x05 && byte(pc + 2) === 0xd0) stores.push(pc);
    }
  }
  expect(stores).toHaveLength(1);
  const device = stores[0]!;
  expect(byte(device - 3)).toBe(0xad);
  const named = byte(device - 2) | (byte(device - 1) << 8);
  expect(byte(device - 6)).toBe(0x8d);
  expect(byte(device - 5) | (byte(device - 4) << 8)).toBe(named);
  expect(
    profileRecords(memory.intervals).filter(
      (entry) =>
        entry.addressSpaceId === "cpu16" &&
        entry.kind === "sfa" &&
        typeof entry.start === "number" &&
        typeof entry.end === "number" &&
        entry.start <= named &&
        named < entry.end,
    ),
  ).toHaveLength(1);
  return { device, named, assignment: device - 6 };
}

/** Compute binary 6502 arithmetic independently of generated code and reports. */
function arithmetic(old: number, rhs: number, subtract: boolean) {
  const value = (subtract ? old - rhs : old + rhs) & 255;
  const carry = subtract ? old >= rhs : old + rhs > 255;
  const overflow = subtract
    ? ((old ^ rhs) & (old ^ value) & 128) !== 0
    : (~(old ^ rhs) & (old ^ value) & 128) !== 0;
  const flags = (value & 128) | (value === 0 ? 2 : 0) | Number(carry) | (overflow ? 64 : 0);
  return { value, flags };
}

describe.sequential("named byte assignment execution", () => {
  for (const profile of profiles) {
    for (const operator of ["+", "-"]) {
      for (const runtime of [false, true]) {
        it(`should preserve 257 complete assignments when ${operator} uses ${runtime ? "runtime" : "constant"} RHS on ${profile}`, async () => {
          const source = `module Game;
function main(): void {
  let value: byte = $A5;
  let step: byte = 37;
  while (true) {
    value = value ${operator} ${runtime ? "step" : "37"};
    poke($D005, value);
    ${runtime ? "step += 1;" : ""}
  }
}`;
          const built = await buildProfileSource(source, profile, "none");
          const window = assignmentWindow(built.prg, built.memory);
          const root = await mkdtemp(
            join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "byte-assignment-vice-"),
          );
          try {
            const prgPath = join(root, "program.prg");
            await writeFile(prgPath, built.prg);
            const started = await startVice(prgPath, 100_000_000, profile);
            if ("kind" in started) throw new Error(`VICE is required: ${started.reason}`);
            const monitor = started.monitor;
            const checkpoints = new Set<number>();
            try {
              const first = await monitor.setExecuteCheckpoint(window.assignment);
              checkpoints.add(first);
              const firstStop = monitor.waitForStop(30_000);
              await monitor.resume();
              expect(await firstStop).toBe(window.assignment);
              await monitor.deleteCheckpoint(first);
              checkpoints.delete(first);
              expect([...(await monitor.readMemory(window.named, window.named))]).toEqual([165]);
              const initial = await monitor.readCpuRegisters();
              expect(initial.p & 8).toBe(0);
              monitor.takeCheckpointHits();

              const namedTrace = await monitor.setAccessTracepoint(window.named, "store");
              checkpoints.add(namedTrace);
              const deviceTrace = await monitor.setAccessTracepoint(0xd005, "store");
              checkpoints.add(deviceTrace);
              const postDevice = await monitor.setExecuteCheckpoint(window.device + 3);
              checkpoints.add(postDevice);
              const traceHits: number[] = [];
              let old = 165;
              for (let ordinal = 0; ordinal < 257; ordinal += 1) {
                const stopped = monitor.waitForStop(30_000);
                await monitor.resume();
                expect(await stopped).toBe(window.device + 3);
                const rhs = runtime ? (37 + ordinal) & 255 : 37;
                const expected = arithmetic(old, rhs, operator === "-");
                const registers = await monitor.readCpuRegisters();
                expect(registers.a).toBe(expected.value);
                expect(registers.p & 0xcf).toBe(expected.flags | (initial.p & 4));
                expect(registers.sp).toBe(initial.sp);
                expect([...(await monitor.readMemory(window.named, window.named))]).toEqual([
                  expected.value,
                ]);
                expect([...(await monitor.readIo(0xd005, 0xd005))]).toEqual([expected.value]);
                traceHits.push(
                  ...monitor
                    .takeCheckpointHits()
                    .filter((id) => id === namedTrace || id === deviceTrace),
                );
                old = expected.value;
              }
              await monitor.deleteCheckpoint(postDevice);
              checkpoints.delete(postDevice);
              // Stop before assignment 258, allowing pending trace events to drain
              // without executing an extra named or device write.
              const next = await monitor.setExecuteCheckpoint(window.assignment);
              checkpoints.add(next);
              const finalStop = monitor.waitForStop(30_000);
              await monitor.resume();
              expect(await finalStop).toBe(window.assignment);
              traceHits.push(
                ...monitor
                  .takeCheckpointHits()
                  .filter((id) => id === namedTrace || id === deviceTrace),
              );
              expect(traceHits).toEqual(
                Array.from({ length: 257 }, () => [namedTrace, deviceTrace]).flat(),
              );
            } finally {
              const cleanupErrors: unknown[] = [];
              try {
                for (const checkpoint of checkpoints) {
                  try {
                    await monitor.deleteCheckpoint(checkpoint);
                  } catch (error) {
                    cleanupErrors.push(error);
                  }
                }
              } finally {
                await stopVice(started);
              }
              if (cleanupErrors.length > 0) {
                throw new AggregateError(cleanupErrors, "Could not delete all VICE checkpoints");
              }
            }
          } finally {
            await rm(root, { recursive: true, force: true });
          }
        }, 300_000);
      }
    }
  }
});
