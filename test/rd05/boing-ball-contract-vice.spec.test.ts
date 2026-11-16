import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { BOING_BALL_DIR, labels } from "./boing-ball-fixture.js";
import { readProfileArtifacts } from "./profile-fixture.js";

/** Coordinate stores follow source order, not ascending hardware address order. */
const coordinates = [0xd000, 0xd002, 0xd004, 0xd006, 0xd001, 0xd003, 0xd005, 0xd007, 0xd010];
const colors = [0xd025, 0xd027, 0xd028, 0xd029, 0xd02a];
const pointers = [0x07f8, 0x07f9, 0x07fa, 0x07fb];
const initialization = [
  0xd01c,
  0xd017,
  0xd01d,
  0xd026,
  0xd021,
  0xd020,
  ...colors,
  ...coordinates,
  ...pointers,
  0xd015,
];
/** The kth post-wait checkpoint observes k - 1 completed movement updates. */
const checkpoints = [
  { k: 1, x: 100, y: 90, frame: 0, swapped: false },
  { k: 2, x: 102, y: 92, frame: 0, swapped: false },
  { k: 6, x: 110, y: 100, frame: 2, swapped: false },
  { k: 10, x: 118, y: 108, frame: 0, swapped: true },
  { k: 99, x: 296, y: 90, frame: 3, swapped: true },
  { k: 100, x: 294, y: 88, frame: 3, swapped: true },
];

/** Require one named observation point rather than accidentally selecting a basic block. */
function requireLabel(map: ReadonlyMap<string, number>, name: string): number {
  const address = map.get(name);
  if (address === undefined) throw new Error(`Missing observation label ${name}`);
  return address;
}

/** Find the compiled main entry independently of its internal block labels. */
function applicationEntry(map: ReadonlyMap<string, number>): number {
  const matches = [...map].filter(([name]) => /^b65_Main_main_[^_]+$/u.test(name));
  expect(matches, "one function entry for Main.main").toHaveLength(1);
  return matches[0]![1];
}

/** Locate the first labeled instruction following the source raster wait. */
function compiledFramePoint(assembly: string, map: ReadonlyMap<string, number>): number {
  const lines = assembly.split("\n");
  const test = lines.findIndex((line) => /^\s+(?:eor|cmp) #\$fb\s*$/iu.test(line));
  expect(test, "raster-251 test").toBeGreaterThanOrEqual(0);
  for (const line of lines.slice(test + 1)) {
    const match = /^(b65_[A-Za-z0-9_]+):$/u.exec(line.trim());
    if (match !== null) return requireLabel(map, match[1]!);
  }
  throw new Error("No observation label after the raster wait");
}

/** Build only public artifacts, or assemble the independent twin, inside owned scratch space. */
async function withWorkload(
  kind: "compiled" | "twin",
  inspect: (prg: string, application: number, frame: number) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(
    join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-ball-contract-"),
  );
  try {
    await mkdir(join(root, "assets"));
    await copyFile(join(BOING_BALL_DIR, "assets/ball.bin"), join(root, "assets/ball.bin"));
    if (kind === "twin") {
      await copyFile(join(BOING_BALL_DIR, "twin.asm"), join(root, "twin.asm"));
      const assembled = spawnSync(
        "acme",
        ["-f", "cbm", "-o", "twin.prg", "-l", "twin.sym", "twin.asm"],
        {
          cwd: root,
          encoding: "utf8",
        },
      );
      expect(assembled.status, assembled.stderr).toBe(0);
      const map = labels(await readFile(join(root, "twin.sym"), "utf8"));
      await inspect(
        join(root, "twin.prg"),
        map.get("applicationStart") ?? requireLabel(map, "start"),
        requireLabel(map, "framePoint"),
      );
    } else {
      await mkdir(join(root, "src"));
      await copyFile(join(BOING_BALL_DIR, "src/main.blend"), join(root, "src/main.blend"));
      await copyFile(join(BOING_BALL_DIR, "blend65.json"), join(root, "blend65.json"));
      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const artifacts = await readProfileArtifacts(built);
      const map = labels(artifacts.labels);
      await inspect(
        join(built.generation.directory, built.generation.primaryArtifact),
        applicationEntry(map),
        compiledFramePoint(artifacts.assembly, map),
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Resume to a bounded execution checkpoint, arming the stop wait before execution. */
async function reach(monitor: ViceMonitor, address: number): Promise<void> {
  const stopped = monitor.waitForStop(20_000);
  await monitor.resume();
  expect(await stopped).toBe(address);
}

/**
 * Observe workload-owned VIC registers and sprite pointers without filtering their stores.
 * Retained KERNAL IRQ service can write the CPU port independently of the app;
 * mapping and bank prerequisites are checked separately at the startup boundary.
 */
async function installStores(monitor: ViceMonitor): Promise<ReadonlyMap<number, number>> {
  const addresses = [
    ...Array.from({ length: 0x2f }, (_, index) => 0xd000 + index),
    ...Array.from({ length: 8 }, (_, index) => 0x07f8 + index),
  ];
  const stores = new Map<number, number>();
  for (const address of addresses)
    stores.set(await monitor.setAccessTracepoint(address, "store"), address);
  return stores;
}

/** Remove only the known execution stop; never discard an unexpected traced store. */
function takeStores(
  monitor: ViceMonitor,
  stores: ReadonlyMap<number, number>,
  execution: number,
): readonly number[] {
  return monitor.takeCheckpointHits().flatMap((hit) => {
    if (hit === execution) return [];
    const address = stores.get(hit);
    if (address === undefined) throw new Error(`Unexpected checkpoint ${hit}`);
    return [address];
  });
}

/** Compare each workload separately with source-derived values, not with the other workload. */
async function expectBallState(
  monitor: ViceMonitor,
  state: (typeof checkpoints)[number],
): Promise<void> {
  const { x, y, frame, swapped } = state;
  const xr = x + 24;
  expect(
    [...(await monitor.readIo(0xd000, 0xd007))],
    `coordinates at checkpoint ${state.k}`,
  ).toEqual([x & 0xff, y, xr & 0xff, y, x & 0xff, y + 21, xr & 0xff, y + 21]);
  expect((await monitor.readIo(0xd010, 0xd010))[0]).toBe((x >= 256 ? 5 : 0) | (xr >= 256 ? 10 : 0));
  expect([...(await monitor.readMemory(0x07f8, 0x07fb))]).toEqual(
    [0, 1, 2, 3].map((index) => 0x80 + 4 * frame + index),
  );
  expect((await monitor.readIo(0xd025, 0xd025))[0]! & 0x0f).toBe(swapped ? 2 : 1);
  expect([...(await monitor.readIo(0xd027, 0xd02a))].map((value) => value & 0x0f)).toEqual(
    Array.from({ length: 4 }, () => (swapped ? 1 : 2)),
  );
  expect((await monitor.readIo(0xd015, 0xd015))[0]).toBe(15);
  if (state.k === 1) {
    for (const [address, value] of [
      [0xd01c, 15],
      [0xd017, 0],
      [0xd01d, 0],
    ] as const)
      expect((await monitor.readIo(address, address))[0]).toBe(value);
    for (const [address, value] of [
      [0xd026, 0],
      [0xd021, 14],
      [0xd020, 14],
    ] as const)
      expect((await monitor.readIo(address, address))[0]! & 0x0f).toBe(value);
  }
}

describe.sequential("independent ball source contract in VICE", () => {
  for (const kind of ["compiled", "twin"] as const) {
    it(`should preserve exact source store order and independent bounce/rotation values when running ${kind}`, async () => {
      await withWorkload(kind, async (prg, application, frame) => {
        const started = await startVice(prg, 100_000_000, "c64-pal-prg-kernal-6581");
        if ("kind" in started) throw new Error(`Native runtime unavailable: ${started.reason}`);
        try {
          const { monitor } = started;
          const entryStop = await monitor.setExecuteCheckpoint(application);
          await reach(monitor, application);
          await monitor.deleteCheckpoint(entryStop);
          const entryStack = (await monitor.readCpuRegisters()).sp;
          const frameStop = await monitor.setExecuteCheckpoint(frame);
          const stores = await installStores(monitor);
          monitor.takeCheckpointHits();
          for (let k = 1; k <= 100; k += 1) {
            await reach(monitor, frame);
            // The first wait follows initialization. Every later wait follows
            // one completed update; even-numbered updates rotate before moving.
            const expected =
              k === 1
                ? initialization
                : (k - 1) % 2 === 0
                  ? [...colors, ...pointers, ...coordinates]
                  : coordinates;
            expect(takeStores(monitor, stores, frameStop), `${kind}, checkpoint ${k}`).toEqual(
              expected,
            );
            const state = checkpoints.find((entry) => entry.k === k);
            if (state !== undefined) await expectBallState(monitor, state);
            expect(
              (await monitor.readCpuRegisters()).sp,
              "no unfinished position call or growing stack",
            ).toBe(entryStack);
          }
        } finally {
          await stopVice(started);
        }
      });
    }, 180_000);
  }
});
