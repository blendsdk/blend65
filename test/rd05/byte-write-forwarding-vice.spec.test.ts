import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";

const profile = "c64-pal-prg-kernal-6581";
const source = `module Game;
function main():void {
  let counter:byte=0;
  while(true){
    poke($D005,counter+21);
    counter+=1;
  }
}`;

/** Invalid or missing memory evidence must fail setup, not silently exclude executable code. */
function address(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 65536)
    throw new Error("Invalid CPU address in public memory evidence");
  return value;
}

/** Find the fixture's unique application store in CPU code, excluding asset/device projections. */
function applicationStore(prg: Buffer, memory: Record<string, unknown>): number {
  expect(prg.length).toBeGreaterThan(2);
  const load = prg.readUInt16LE(0);
  const stores: number[] = [];
  const intervals = profileRecords(memory.intervals).filter(
    (interval) => interval.addressSpaceId === "cpu16" && interval.kind === "code",
  );
  expect(intervals.length).toBeGreaterThan(0);
  for (const interval of intervals) {
    const start = address(interval.start);
    const end = address(interval.end);
    expect(end).toBeGreaterThan(start);
    expect(address(interval.size)).toBe(end - start);
    expect(start - load + 2).toBeGreaterThanOrEqual(2);
    expect(end - load + 2).toBeLessThanOrEqual(prg.length);
    for (let pc = start; pc + 3 <= end; pc += 1) {
      const offset = pc - load + 2;
      if (prg[offset] === 0x8d && prg[offset + 1] === 0x05 && prg[offset + 2] === 0xd0)
        stores.push(pc);
    }
  }
  expect(stores).toHaveLength(1);
  const store = stores[0];
  if (store === undefined) throw new Error("No unique application STA $D005 in CPU code");
  return store;
}

/** Binary eight-bit addition defines flags independently of the generated instruction sequence. */
function addition(seed: number) {
  const sum = seed + 21;
  const value = sum & 255;
  const negative = value & 0x80;
  const zero = value === 0 ? 0x02 : 0;
  const carry = sum > 255 ? 0x01 : 0;
  const overflow = (~(seed ^ 21) & (seed ^ value) & 0x80) !== 0 ? 0x40 : 0;
  return { value, flags: negative | zero | carry | overflow };
}

describe("anonymous byte-write runtime behavior", () => {
  it("should preserve all 257 ordered wrapping writes, accumulator, binary flags and stack in VICE", async () => {
    const artifacts = await buildProfileSource(source, profile, "none");
    const store = applicationStore(artifacts.prg, artifacts.memory);
    const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "byte-write-vice-"));
    try {
      const prgPath = join(root, "counter.prg");
      await writeFile(prgPath, artifacts.prg);
      const started = await startVice(prgPath, 100_000_000, profile);
      if ("kind" in started)
        throw new Error(
          `VICE fixture unavailable: ${started.reason}. Install the qualified VICE 3.10 runtime and rerun the serialized tier.`,
        );
      try {
        const { monitor } = started;
        // Stop before the first application write, after startup has finished observing device state.
        const entry = await monitor.setExecuteCheckpoint(store);
        try {
          const stopped = monitor.waitForStop(30_000);
          await monitor.resume();
          expect(await stopped).toBe(store);
        } finally {
          await monitor.deleteCheckpoint(entry);
        }
        monitor.takeCheckpointHits();
        const checkpoints = new Set<number>();
        let stack: number | undefined;
        let interruptMask: number | undefined;
        try {
          const watch = await monitor.setAccessTracepoint(0xd005, "store");
          checkpoints.add(watch);
          const sample = await monitor.setExecuteCheckpoint(store + 3);
          checkpoints.add(sample);
          let writes = 0;
          for (let ordinal = 0; ordinal < 257; ordinal += 1) {
            const expected = addition(ordinal & 255);
            const stopped = monitor.waitForStop(30_000);
            await monitor.resume();
            // Observe the mainline continuation, even if an IRQ runs after the store.
            expect(await stopped, `write ${ordinal}: post-store PC`).toBe(store + 3);
            const registers = await monitor.readCpuRegisters();
            const device = await monitor.readIo(0xd005, 0xd005);
            expect(device.length).toBe(1);
            expect(device[0], `write ${ordinal}: device byte`).toBe(expected.value);
            expect(registers.a, `write ${ordinal}: accumulator`).toBe(expected.value);
            expect(registers.p & 0xcb, `write ${ordinal}: N/V/D/Z/C`).toBe(expected.flags);
            if (stack === undefined) stack = registers.sp;
            if (interruptMask === undefined) interruptMask = registers.p & 0x04;
            expect(registers.sp, `write ${ordinal}: stack pointer`).toBe(stack);
            expect(registers.p & 0x04, `write ${ordinal}: interrupt mask`).toBe(interruptMask);
            writes += monitor.takeCheckpointHits().filter((id) => id === watch).length;
          }
          const nextStore = await monitor.setExecuteCheckpoint(store);
          checkpoints.add(nextStore);
          await monitor.deleteCheckpoint(sample);
          checkpoints.delete(sample);
          const stopped = monitor.waitForStop(30_000);
          await monitor.resume();
          expect(await stopped).toBe(store);
          // Execute stops can precede pending trace events. Drain before another write occurs.
          writes += monitor.takeCheckpointHits().filter((id) => id === watch).length;
          expect(writes).toBe(257);
        } finally {
          for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
        }
      } finally {
        await stopVice(started);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 300_000);
});
