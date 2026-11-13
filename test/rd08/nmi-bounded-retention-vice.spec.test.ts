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

/** One cooperative runtime identity is enough for the sequential behavior case. */
const PROFILE = "c64-pal-prg-kernal-6581" as const;
/** The placed Boolean that mainline waits on after the handler stores it. */
const TRUE_FLAG_ADDRESS = 0xc000;
/** The placed Boolean that must stay false for the same timer source. */
const FALSE_FLAG_ADDRESS = 0xc001;
/** The distinct bytes mainline pre-fills and the handler copies onward. */
const SAMPLE_VALUES = [0x11, 0x22, 0x33, 0x44, 0x55] as const;
/** First and last screen cells holding the five samples the handler must retain. */
const SAMPLE_INPUT_START = 0x0400;
const SAMPLE_INPUT_END = 0x0404;
/** First and last screen cells receiving the retained samples. */
const SAMPLE_OUTPUT_START = 0x0410;
const SAMPLE_OUTPUT_END = 0x0414;
/** The first copied sample is the tracepoint cell that proves the handler wrote its output. */
const FIRST_OUTPUT_ADDRESS = SAMPLE_OUTPUT_START;
/** CIA2 interrupt control register; reading it also clears the pending bits. */
const CIA2_INTERRUPT_CONTROL = 0xdd0d;
/** Timer A is bit 0 of the CIA2 interrupt control register. */
const TIMER_A_SOURCE_BIT = 0x01;
/** The stock KERNAL NMI vector is restored before returning to BASIC. */
const STOCK_NMI_VECTOR = [0x47, 0xfe] as const;

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/**
 * One witness that keeps a masked value for two consumers and five volatile
 * samples for five later consumers. The route is a source-programmed one-shot
 * CIA2 Timer A interruption, so the handler is reached by a genuine NMI.
 */
const RETENTION_PROGRAM = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources } from c64.cia2;
place(at: $C000) let a: boolean = false;
place(at: $C001) let b: boolean = false;
interrupt function handler(): void {
    let m: byte = readAndClearPendingSources() & 3;
    a = m != 0;
    b = m == 0;
    let x0: byte = peek($0400); let x1: byte = peek($0401);
    let x2: byte = peek($0402); let x3: byte = peek($0403);
    let x4: byte = peek($0404);
    poke($0410, x0); poke($0411, x1); poke($0412, x2);
    poke($0413, x3); poke($0414, x4);
}
function main(): void {
    poke($0400, $11); poke($0401, $22); poke($0402, $33);
    poke($0403, $44); poke($0404, $55);
    setNMIExclusive(&handler);
    disableInterruptSources(sourceAll);
    readAndClearPendingSources();
    configureTimerA(timerOneShot);
    writeTimerALatch($00FF);
    enableInterruptSources(sourceTimerA);
    configureTimerA(timerLoad | timerOneShot | timerStart);
    while (!a) { asm_nop(); }
    restoreNMI();
}`;

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
function operationStart(artifacts: Artifacts, source: string, proof: string, name: string): number {
  const proofIndex = source.indexOf(proof);
  expect(proofIndex).toBeGreaterThanOrEqual(0);
  const position = Buffer.byteLength(source.slice(0, proofIndex));
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

/**
 * Build, run and observe the retained handler through a genuine CIA2 Timer A NMI.
 * A missing or unidentifiable emulator runtime fails the case instead of skipping it.
 */
async function qualify(): Promise<void> {
  await withProfileProject(RETENTION_PROGRAM, PROFILE, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const artifactSha256 = createHash("sha256").update(artifacts.prg).digest("hex");
    const labels = addresses(artifacts.labels);
    const handlerAddress = functionEntry(artifacts, labels, "handler");
    const mainRange = functionRange(artifacts, "main");
    const handlerRange = functionRange(artifacts, "handler");
    const restoreAddress = operationStart(artifacts, RETENTION_PROGRAM, "restoreNMI()", "main");

    const started = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
      80_000_000,
      PROFILE,
    );
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

      // Observe the handler device effects without stopping inside the handler.
      const trace = new Map<number, string>();
      trace.set(await monitor.setAccessTracepoint(CIA2_INTERRUPT_CONTROL, "load"), "load:ICR");
      trace.set(
        await monitor.setAccessTracepoint(FIRST_OUTPUT_ADDRESS, "store"),
        "store:FIRST_OUTPUT",
      );
      monitor.takeCheckpointHits();

      // Genuine hardware acceptance of the source-programmed timer underflow.
      expect(await resume()).toBe(handlerAddress);
      const accepted = await monitor.readCpuRegisters();
      const frame = await stackBytes(monitor, accepted.sp, 3);
      expect(frame[0]! & 0x10).toBe(0);
      // Acceptance sets I in the running CPU; the pushed frame preserves the prior state.
      expect(accepted.p & 0x04).toBe(0x04);
      const resumedPc = frame[1]! | (frame[2]! << 8);
      expect(resumedPc).toBeGreaterThanOrEqual(mainRange.start);
      expect(resumedPc).toBeLessThan(mainRange.end);
      // The installed route is the handler under test, not a helper or stale vector.
      expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([
        handlerAddress & 0xff,
        handlerAddress >> 8,
      ]);
      expect(
        (await monitor.readIo(CIA2_INTERRUPT_CONTROL, CIA2_INTERRUPT_CONTROL))[0]! &
          TIMER_A_SOURCE_BIT,
      ).toBe(TIMER_A_SOURCE_BIT);
      monitor.takeCheckpointHits();

      // One consuming read and one first output write, then the wrapper restores the caller frame.
      const atRti = await checkpoint(handlerRange.end - 1);
      expect(await resume()).toBe(handlerRange.end - 1);
      expect(takeTrace(monitor, trace)).toEqual(["load:ICR", "store:FIRST_OUTPUT"]);
      const retainedFlags = Array.from(
        await monitor.readMemory(TRUE_FLAG_ADDRESS, FALSE_FLAG_ADDRESS),
      );
      expect(retainedFlags).toEqual([1, 0]);
      const retainedSamples = Array.from(
        await monitor.readMemory(SAMPLE_OUTPUT_START, SAMPLE_OUTPUT_END),
      );
      expect(retainedSamples).toEqual([...SAMPLE_VALUES]);
      expect(Array.from(await monitor.readMemory(SAMPLE_INPUT_START, SAMPLE_INPUT_END))).toEqual([
        ...SAMPLE_VALUES,
      ]);
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
      expect(takeTrace(monitor, trace)).toEqual([]);
      expect(Array.from(await monitor.readMemory(TRUE_FLAG_ADDRESS, FALSE_FLAG_ADDRESS))).toEqual([
        1, 0,
      ]);
      expect(Array.from(await monitor.readMemory(SAMPLE_OUTPUT_START, SAMPLE_OUTPUT_END))).toEqual([
        ...SAMPLE_VALUES,
      ]);
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
      expect(
        (await monitor.readIo(CIA2_INTERRUPT_CONTROL, CIA2_INTERRUPT_CONTROL))[0]! & 0x9f,
      ).toBe(0);
      const observedFlags = Array.from(
        await monitor.readMemory(TRUE_FLAG_ADDRESS, FALSE_FLAG_ADDRESS),
      );
      const observedSamples = Array.from(
        await monitor.readMemory(SAMPLE_OUTPUT_START, SAMPLE_OUTPUT_END),
      );
      expect(observedFlags).toEqual([1, 0]);
      expect(observedSamples).toEqual([...SAMPLE_VALUES]);
      expect(Array.from(await monitor.readMemory(0, 1))).toEqual(entryPorts);

      console.info(
        "Bounded NMI retention runtime evidence",
        JSON.stringify({
          profile: PROFILE,
          artifactSha256,
          identity: started.identity,
          mainRange,
          handlerRange,
          handlerAddress,
          restoreAddress,
          callerReturn,
          observedFlags,
          observedSamples,
        }),
      );
    } finally {
      for (const id of checkpoints) await monitor.deleteCheckpoint(id);
      await stopVice({ child: started.child, monitor });
    }
  });
}

describe.sequential("bounded NMI retention at runtime", () => {
  it("should keep a masked value and five samples through a genuine Timer A NMI and return", async () => {
    await qualify();
  }, 120_000);
});
