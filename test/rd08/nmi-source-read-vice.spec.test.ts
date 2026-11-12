import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { cia2ModelIdentity } from "../rd05/cia2-vice-fixture.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";

/** One cooperative runtime identity is enough for a single sequential behavior case. */
const PROFILE = "c64-pal-prg-kernal-6581" as const;

/** The reported defect: a bit condition on the consuming read must reach mainline. */
const SOURCE = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources, readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;

place(at: $C000) let timerFinished: boolean = false;
interrupt function timerHandler(): void {
    if ((readAndClearPendingSources() & sourceTimerA) != 0) { timerFinished = true; }
}
function main(): void {
    setNMIExclusive(&timerHandler);
    disableInterruptSources(sourceAll);
    readAndClearPendingSources();
    configureTimerA(timerOneShot);
    writeTimerALatch($00FF);
    enableInterruptSources(sourceTimerA);
    configureTimerA(timerLoad | timerOneShot | timerStart);
    while (!timerFinished) { asm_nop(); }
    restoreNMI();
}`;

const GLOBAL_ADDRESS = 0xc000;
const STOCK_NMI_VECTOR = [0x47, 0xfe] as const;
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Require a nonnegative integer in public evidence instead of trusting metadata. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative integer in generated evidence");
  return value;
}

/** Decode the public label map only to locate checkpoints, never to derive behavior. */
function addresses(text: string): Map<string, number> {
  return new Map(
    [...text.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Find one public startup symbol by its documented logical name. */
function startupAddress(labels: ReadonlyMap<string, number>, name: string): number {
  const matches = [...labels].filter(([label]) =>
    label.endsWith(`_${Buffer.from(name).toString("hex")}`),
  );
  expect(matches, name).toHaveLength(1);
  return matches[0]![1];
}

/** Resolve one source function's single published entry address. */
function functionEntry(
  artifacts: Artifacts,
  labels: ReadonlyMap<string, number>,
  name: string,
): number {
  const fn = profileRecords(artifacts.debug.functions).find(
    (entry) => entry.qualifiedName === `src/game.blend::Game.${name}`,
  );
  if (fn === undefined) throw new Error(`Missing source function ${name}`);
  const variants = profileRecords(fn.entryVariants);
  expect(variants).toHaveLength(1);
  const label = variants[0]!.label;
  if (typeof label !== "string") throw new TypeError(`Missing entry label for ${name}`);
  const address = labels.get(label);
  if (address === undefined) throw new Error(`Missing assembled address for ${name}`);
  return address;
}

/** Resolve one source function's complete code interval for the stacked-return check. */
function functionRange(artifacts: Artifacts, name: string) {
  const qualifiedName = `src/game.blend::Game.${name}`;
  const rows = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return interval.kind === "code" && owner.kind === "function" && owner.id === qualifiedName;
  });
  expect(rows).toHaveLength(1);
  return { start: integer(rows[0]!.start), end: integer(rows[0]!.end) };
}

/** Find the first emitted address of one source operation in a named function. */
function operationStart(artifacts: Artifacts, proof: string, name: string): number {
  const position = Buffer.byteLength(SOURCE.slice(0, SOURCE.indexOf(proof)));
  expect(SOURCE.indexOf(proof)).toBeGreaterThanOrEqual(0);
  const proofBytes = Buffer.byteLength(proof);
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((entry) => entry.path === "src/game.blend");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const functions = profileRecords(artifacts.debug.functions);
  const fn = functions.find((entry) => entry.qualifiedName === `src/game.blend::Game.${name}`);
  if (fn === undefined) throw new Error(`Missing source function ${name}`);
  const ranges = profileRecords(artifacts.debug.ranges);
  let best: { width: number; start: number } | undefined;
  for (const rangeIndex of (fn.rangeIndexes as unknown[]).map(integer)) {
    const origin = profileRecord(ranges[rangeIndex]!.origin);
    if (origin.kind !== "source") continue;
    const span = profileRecord(origin.span);
    if (span.sourceIndex !== sourceIndex) continue;
    const start = integer(span.startByte);
    const end = integer(span.endByte);
    if (start > position || position + proofBytes > end) continue;
    const machine = profileRecord(ranges[rangeIndex]!.machine);
    const candidate = { width: end - start, start: integer(machine.start) };
    if (
      best === undefined ||
      candidate.width < best.width ||
      (candidate.width === best.width && candidate.start < best.start)
    )
      best = candidate;
  }
  if (best === undefined) throw new Error(`Missing emitted source operation ${proof}`);
  return best.start;
}

/** Read a CPU stack frame with page-one wrapping, without changing the emulated CPU. */
async function stackBytes(monitor: ViceMonitor, sp: number, count: number): Promise<number[]> {
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const address = 0x0100 | ((sp + index + 1) & 0xff);
      return (await monitor.readMemory(address, address))[0]!;
    }),
  );
}

/** Associate monitor tracepoint identities with their exact non-consuming observation labels. */
function takeTrace(monitor: ViceMonitor, events: ReadonlyMap<number, string>): string[] {
  return monitor.takeCheckpointHits().flatMap((id) => {
    const event = events.get(id);
    return event === undefined ? [] : [event];
  });
}

describe.sequential("register-only NMI source read at runtime", () => {
  it("should accept a genuine CIA2 Timer A NMI, publish the Boolean and return to BASIC", async () => {
    await withProfileProject(SOURCE, PROFILE, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const artifacts = await readProfileArtifacts(built);
      expect(artifacts.memory.acmeReconciled).toBe(true);
      const artifactSha256 = createHash("sha256").update(artifacts.prg).digest("hex");
      const labels = addresses(artifacts.labels);
      const handlerAddress = functionEntry(artifacts, labels, "timerHandler");
      const mainRange = functionRange(artifacts, "main");
      const restoreAddress = operationStart(artifacts, "restoreNMI()", "main");

      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
        80_000_000,
        PROFILE,
      );
      // A missing or unidentifiable runtime fails the case; an unrun case is not evidence.
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const { monitor } = started;
      const checkpoints = new Set<number>();
      try {
        expect(started.identity.executableSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(started.identity.roms).toHaveLength(3);
        await cia2ModelIdentity(monitor, PROFILE);

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

        // Enter through the stock BASIC SYS startup and record the caller's return address.
        const atStartup = await checkpoint(startupAddress(labels, "startup.entry"));
        expect(await resume()).toBe(startupAddress(labels, "startup.entry"));
        const caller = await monitor.readCpuRegisters();
        const returnBytes = await stackBytes(monitor, caller.sp, 2);
        const callerReturn = ((returnBytes[0]! | (returnBytes[1]! << 8)) + 1) & 0xffff;
        // The pinned SYS extension pushes $E146; RTS resumes at its PHP in KERNAL ROM.
        expect(callerReturn).toBe(0xe147);
        const entryPorts = Array.from(await monitor.readMemory(0, 1));
        await remove(atStartup);

        const atMain = await checkpoint(mainRange.start);
        const atHandler = await checkpoint(handlerAddress);
        expect(await resume()).toBe(mainRange.start);
        await remove(atMain);

        // Observe the two handler device effects without stopping inside the handler.
        const trace = new Map<number, string>();
        trace.set(await monitor.setAccessTracepoint(0xdd0d, "load"), "load:ICR");
        trace.set(await monitor.setAccessTracepoint(GLOBAL_ADDRESS, "store"), "store:GLOBAL");
        monitor.takeCheckpointHits();

        // Genuine hardware acceptance of the source-programmed Timer A underflow.
        expect(await resume()).toBe(handlerAddress);
        const accepted = await monitor.readCpuRegisters();
        const frame = await stackBytes(monitor, accepted.sp, 3);
        expect(frame[0]! & 0x10).toBe(0);
        // Acceptance sets I in the running CPU; the pushed frame preserves the prior state.
        expect(accepted.p & 0x04).toBe(0x04);
        const resumedPc = frame[1]! | (frame[2]! << 8);
        expect(resumedPc).toBeGreaterThanOrEqual(mainRange.start);
        expect(resumedPc).toBeLessThan(mainRange.end);
        expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([
          handlerAddress & 0xff,
          handlerAddress >> 8,
        ]);
        expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x01).toBe(0x01);
        monitor.takeCheckpointHits();

        // One consuming read and one global store, then the wrapper restores the caller frame.
        const handlerEnd = functionRange(artifacts, "timerHandler").end;
        const atRti = await checkpoint(handlerEnd - 1);
        expect(await resume()).toBe(handlerEnd - 1);
        expect(takeTrace(monitor, trace)).toEqual(["load:ICR", "store:GLOBAL"]);
        const observedGlobal = (await monitor.readMemory(GLOBAL_ADDRESS, GLOBAL_ADDRESS))[0]!;
        expect(observedGlobal).toBe(1);
        const beforeRti = await monitor.readCpuRegisters();
        expect([beforeRti.a, beforeRti.x, beforeRti.y, beforeRti.sp]).toEqual([
          accepted.a,
          accepted.x,
          accepted.y,
          accepted.sp,
        ]);
        await remove(atRti);
        await remove(atHandler);

        // Mainline leaves the loop because it observed the stored Boolean.
        const atRestore = await checkpoint(restoreAddress);
        monitor.takeCheckpointHits();
        expect(await resume()).toBe(restoreAddress);
        expect((await monitor.readMemory(GLOBAL_ADDRESS, GLOBAL_ADDRESS))[0]!).toBe(1);
        expect(takeTrace(monitor, trace)).toEqual([]);
        await remove(atRestore);

        // The final release restores the stock route and returns to the BASIC caller.
        await checkpoint(callerReturn);
        expect(await resume()).toBe(callerReturn);
        const returned = await monitor.readCpuRegisters();
        expect(returned.sp).toBe((caller.sp + 2) & 0xff);
        expect(returned.p & 0x0c).toBe(caller.p & 0x0c);
        expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual(STOCK_NMI_VECTOR);
        const controls = await monitor.readIo(0xdd0e, 0xdd0f);
        expect(controls[0]! & 1).toBe(0);
        expect(controls[1]! & 1).toBe(0);
        expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x9f).toBe(0);
        expect((await monitor.readMemory(GLOBAL_ADDRESS, GLOBAL_ADDRESS))[0]!).toBe(1);
        expect(Array.from(await monitor.readMemory(0, 1))).toEqual(entryPorts);

        console.info(
          "NMI source read runtime evidence",
          JSON.stringify({
            profile: PROFILE,
            artifactSha256,
            identity: started.identity,
            mainRange,
            handlerAddress,
            restoreAddress,
            callerReturn,
            observedGlobal,
          }),
        );
      } finally {
        for (const id of checkpoints) await monitor.deleteCheckpoint(id);
        await stopVice({ child: started.child, monitor });
      }
    });
  }, 120_000);
});
