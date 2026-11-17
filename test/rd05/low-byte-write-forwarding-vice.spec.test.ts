import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const SOURCE = `module Game;
function main():void {
  let value:word=$12A5;
  while(true){value=value+257;poke($D005,lo(value));}
}`;
type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Locate the unique application store in CPU code, excluding device projections and assets. */
function applicationStorePc(artifacts: Artifacts): number {
  const origin = artifacts.prg.readUInt16LE(0);
  const intervals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => interval.addressSpaceId === "cpu16" && interval.kind === "code",
  );
  expect(intervals.length).toBeGreaterThan(0);
  const stores: number[] = [];
  for (const interval of intervals) {
    const { start, end, size } = interval;
    if (typeof start !== "number" || typeof end !== "number" || typeof size !== "number")
      throw new Error("CPU code interval has no numeric extent");
    expect(end - start).toBe(size);
    expect(start).toBeGreaterThanOrEqual(origin);
    expect(end - origin + 2).toBeLessThanOrEqual(artifacts.prg.length);
    for (let pc = start; pc + 3 <= end; pc++) {
      const offset = pc - origin + 2;
      if (
        artifacts.prg[offset] === 0x8d &&
        artifacts.prg[offset + 1] === 0x05 &&
        artifacts.prg[offset + 2] === 0xd0
      )
        stores.push(pc);
    }
  }
  expect(stores).toHaveLength(1);
  const pc = stores[0];
  if (pc === undefined) throw new Error("Application STA $D005 was not found");
  return pc;
}

/** Derive observable arithmetic and flags from the source's wrapping word addition. */
function expectedSample(ordinal: number, interruptFlag: number, sp: number) {
  const previous = (0x12a5 + 257 * ordinal) & 0xffff;
  const value = (previous + 257) & 0xffff;
  const low = value & 0xff;
  const overflow = (~(previous ^ 257) & (previous ^ value) & 0x8000) !== 0;
  return {
    device: low,
    a: low,
    sp,
    // Bit 5 and the software-break marker are not arithmetic observations.
    flags:
      (low & 0x80) |
      (low === 0 ? 0x02 : 0) |
      (previous + 257 > 0xffff ? 0x01 : 0) |
      (overflow ? 0x40 : 0) |
      interruptFlag,
  };
}

describe("low-byte volatile writes on the selected C64 CPU", () => {
  it.each(PROFILES)(
    "preserves all 257 writes, accumulator and flags on %s",
    async (profile) => {
      const artifacts = await buildProfileSource(SOURCE, profile, "none");
      const storePc = applicationStorePc(artifacts);
      const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "low-byte-vice-"));
      try {
        const prgPath = join(root, "program.prg");
        await writeFile(prgPath, artifacts.prg);
        const started = await startVice(prgPath, 100_000_000, profile);
        if ("kind" in started) throw new Error(`VICE is required: ${started.reason}`);
        const monitor = started.monitor;
        const checkpoints = new Set<number>();
        try {
          const beforeFirst = await monitor.setExecuteCheckpoint(storePc);
          checkpoints.add(beforeFirst);
          const firstStop = monitor.waitForStop(30_000);
          await monitor.resume();
          expect(await firstStop).toBe(storePc);
          const initial = await monitor.readCpuRegisters();
          expect(initial.p & 0x08).toBe(0);
          await monitor.deleteCheckpoint(beforeFirst);
          checkpoints.delete(beforeFirst);

          const trace = await monitor.setAccessTracepoint(0xd005, "store");
          checkpoints.add(trace);
          const afterStore = await monitor.setExecuteCheckpoint(storePc + 3);
          checkpoints.add(afterStore);
          monitor.takeCheckpointHits();
          const samples: ReturnType<typeof expectedSample>[] = [];
          for (let ordinal = 0; ordinal < 257; ordinal++) {
            // The monitor must already be listening when execution reaches the next stop.
            const stopped = monitor.waitForStop(30_000);
            await monitor.resume();
            expect(await stopped).toBe(storePc + 3);
            const registers = await monitor.readCpuRegisters();
            const device = await monitor.readIo(0xd005, 0xd005);
            expect(device).toHaveLength(1);
            const value = device[0];
            if (value === undefined) throw new Error("VIC register sample is missing");
            samples.push({
              device: value,
              a: registers.a,
              sp: registers.sp,
              flags: registers.p & 0xcf,
            });
          }

          await monitor.deleteCheckpoint(afterStore);
          checkpoints.delete(afterStore);
          const beforeNext = await monitor.setExecuteCheckpoint(storePc);
          checkpoints.add(beforeNext);
          const nextStop = monitor.waitForStop(30_000);
          await monitor.resume();
          expect(await nextStop).toBe(storePc);
          const writes = monitor.takeCheckpointHits().filter((checkpoint) => checkpoint === trace);
          expect(writes).toHaveLength(257);
          expect(samples).toEqual(
            Array.from({ length: 257 }, (_unused, ordinal) =>
              expectedSample(ordinal, initial.p & 0x04, initial.sp),
            ),
          );
        } finally {
          try {
            for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
          } finally {
            await stopVice(started);
          }
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    300_000,
  );
});
