import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { BOING_BALL_DIR, labels } from "./boing-ball-fixture.js";
import { profileRecords, readProfileArtifacts } from "./profile-fixture.js";

/** Require the explicit startup/application boundary rather than an internal block label. */
function requireLabel(map: ReadonlyMap<string, number>, name: string): number {
  const address = map.get(name);
  if (address === undefined) throw new Error(`Missing observation label ${name}`);
  return address;
}

/** Prepare a checked four-byte decimal-mode bootstrap in unused PRG padding. */
function decimalBootstrap(prg: Buffer, codeEnd: number): Buffer {
  const load = prg.readUInt16LE(0);
  expect(load).toBe(0x0801);
  expect(codeEnd, "the bootstrap must follow all executable code").toBeLessThanOrEqual(0x1000);
  const at = (address: number) => address - load + 2;
  expect([...prg.subarray(at(0x0805), at(0x080b))]).toEqual([0x9e, 0x32, 0x30, 0x36, 0x31, 0]);
  expect(prg.length).toBeGreaterThanOrEqual(at(0x1004));
  expect(
    [...prg.subarray(at(0x1000), at(0x1004))],
    "bootstrap window must be unused zero padding",
  ).toEqual([0, 0, 0, 0]);
  const result = Buffer.from(prg);
  result.set(Buffer.from("4096", "ascii"), at(0x0806));
  // SED; JMP $080D enters the ordinary startup with decimal mode deliberately set.
  result.set([0xf8, 0x4c, 0x0d, 0x08], at(0x1000));
  return result;
}

/** Keep both original artifacts and the test-only bootstrap inside one owned scratch tree. */
async function withDecimalWorkload(
  kind: "compiled" | "twin",
  inspect: (prg: string, application: number) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-ball-startup-"));
  try {
    await mkdir(join(root, "assets"));
    await copyFile(join(BOING_BALL_DIR, "assets/ball.bin"), join(root, "assets/ball.bin"));
    let prg: Buffer;
    let application: number;
    let codeEnd: number;
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
      expect(requireLabel(map, "start")).toBe(0x080d);
      application = map.get("applicationStart") ?? requireLabel(map, "start");
      codeEnd = requireLabel(map, "codeEnd");
      prg = await readFile(join(root, "twin.prg"));
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
      const entries = [...map].filter(([name]) => /^b65_Main_main_[^_]+$/u.test(name));
      expect(entries, "one function entry for Main.main").toHaveLength(1);
      application = entries[0]![1];
      const code = profileRecords(artifacts.memory.intervals).filter(
        (entry) => entry.kind === "code",
      );
      expect(code.length).toBeGreaterThan(0);
      codeEnd = Math.max(...code.map((entry) => Number(entry.end)));
      // No asset or live storage may occupy the injected instruction window.
      const occupied = profileRecords(artifacts.memory.intervals).filter(
        (entry) =>
          entry.kind !== "padding" && Number(entry.start) < 0x1004 && Number(entry.end) > 0x1000,
      );
      expect(occupied, "bootstrap window must not overlap live allocations").toEqual([]);
      prg = artifacts.prg;
    }
    const bootstrapped = join(root, "decimal-entry.prg");
    await writeFile(bootstrapped, decimalBootstrap(prg, codeEnd));
    await inspect(bootstrapped, application);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Arm the bounded execution wait before asking VICE to continue. */
async function reach(monitor: ViceMonitor, address: number): Promise<void> {
  const stopped = monitor.waitForStop(20_000);
  await monitor.resume();
  expect(await stopped).toBe(address);
}

describe.sequential("ball cooperative startup prerequisites", () => {
  for (const kind of ["compiled", "twin"] as const) {
    it(`should establish binary mode, preserve mapping/latch state and disable sprites before ${kind} application initialization`, async () => {
      await withDecimalWorkload(kind, async (prg, application) => {
        const started = await startVice(prg, 100_000_000, "c64-pal-prg-kernal-6581");
        if ("kind" in started) throw new Error(`Native runtime unavailable: ${started.reason}`);
        try {
          const { monitor } = started;
          const bootstrap = await monitor.setExecuteCheckpoint(0x1000);
          const startup = await monitor.setExecuteCheckpoint(0x080d);
          const main =
            application === 0x080d ? undefined : await monitor.setExecuteCheckpoint(application);
          await reach(monitor, 0x1000);
          await monitor.deleteCheckpoint(bootstrap);
          await reach(monitor, 0x080d);
          await monitor.deleteCheckpoint(startup);
          const incoming = await monitor.readCpuRegisters();
          expect(incoming.p & 8, "the injected entry really has decimal mode set").toBe(8);
          const vectors = await monitor.readMemory(0x0314, 0x0319);
          // All CPU-port bits are outputs so the upper latch bits can be observed.
          // CIA2 low pins initially select a different bank; its hidden latch must survive.
          await monitor.writeMemory(0x0000, Uint8Array.of(0xff, 0xa7));
          await monitor.writeIo(0xdd02, Uint8Array.of(0xff));
          await monitor.writeIo(0xdd00, Uint8Array.of(0xa0));
          await monitor.writeIo(0xdd02, Uint8Array.of(0xa7));
          await monitor.writeIo(0xd018, Uint8Array.of(0xff));
          await monitor.writeIo(0xd015, Uint8Array.of(0xff));
          const events = new Map<number, string>();
          for (const address of [0, 1, 0xdd00, 0xdd02, 0xd018, 0xd015]) {
            for (const operation of ["load", "store"] as const) {
              events.set(
                await monitor.setAccessTracepoint(address, operation),
                `${operation}:${address}`,
              );
            }
          }
          monitor.takeCheckpointHits();
          // When application and startup share an entry, no startup instructions
          // precede initialization. Observe that boundary without executing the app.
          if (application !== 0x080d) await reach(monitor, application);
          const trace = monitor.takeCheckpointHits().flatMap((hit) => {
            if (hit === main) return [];
            const event = events.get(hit);
            if (event === undefined) throw new Error(`Unexpected checkpoint ${hit}`);
            return [event];
          });
          expect(
            trace.filter((event) => event.endsWith(`:${0xdd00}`)),
            "startup must not read or overwrite the CIA2 port latch",
          ).toEqual([]);
          expect(trace.filter((event) => event === `load:${0xdd02}`)).toHaveLength(1);
          expect(trace.filter((event) => event === `store:${0xdd02}`)).toHaveLength(1);
          const latch = trace.indexOf("store:1");
          const direction = trace.indexOf("store:0");
          expect(latch).toBeGreaterThanOrEqual(0);
          expect(direction).toBeGreaterThan(latch);
          expect(trace.indexOf(`store:${0xdd02}`)).toBeGreaterThan(direction);
          expect(trace).toContain(`store:${0xd018}`);
          expect(trace).toContain(`store:${0xd015}`);
          expect((await monitor.readMemory(0x0001, 0x0001))[0]).toBe(0xa6);
          expect((await monitor.readIo(0xdd02, 0xdd02))[0]).toBe(0xa4);
          expect(
            (await monitor.readIo(0xdd00, 0xdd00))[0]! & 3,
            "input pull-ups select VIC bank zero",
          ).toBe(3);
          expect((await monitor.readIo(0xd018, 0xd018))[0]! & 0xfe).toBe(0x14);
          expect((await monitor.readIo(0xd015, 0xd015))[0]).toBe(0);
          const entered = await monitor.readCpuRegisters();
          expect(entered.p & 8).toBe(0);
          expect(entered.p & 4, "cooperative startup retains the incoming IRQ state").toBe(
            incoming.p & 4,
          );
          expect([...(await monitor.readMemory(0x0314, 0x0319))]).toEqual([...vectors]);
          // Expose the latent latch only after observing the required bank-zero state.
          await monitor.writeIo(0xdd02, Uint8Array.of(0xa7));
          expect((await monitor.readIo(0xdd00, 0xdd00))[0]! & 3).toBe(0);
        } finally {
          await stopVice(started);
        }
      });
    }, 180_000);
  }
});
