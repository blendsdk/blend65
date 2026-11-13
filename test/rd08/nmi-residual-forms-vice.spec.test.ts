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

/** One cooperative runtime identity is enough for the sequential behavior cases. */
const PROFILE = "c64-pal-prg-kernal-6581" as const;
/** The placed Boolean that mainline waits on after the handler stores it. */
const READY_ADDRESS = 0xc000;
/** The wide word mask lives at a declared address. */
const WORD_ADDRESS = 0xc100;
/** CIA2 interrupt control register; reading it also clears the pending bits. */
const CIA2_INTERRUPT_CONTROL = 0xdd0d;
/** Timer A is bit 0 of the CIA2 interrupt control register. */
const TIMER_A_SOURCE_BIT = 0x01;
/** The stock KERNAL NMI vector is restored before returning to BASIC. */
const STOCK_NMI_VECTOR = [0x47, 0xfe] as const;
/** Nine screen cells pre-filled with the values the handler retains. */
/** Nine simultaneously retained screen cells plus the call and join samples. */
const NINE_SAMPLE_VALUES = [0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19] as const;
const CALL_SAMPLE_VALUE = 0x1a;
const JOIN_SAMPLE_VALUE = 0x1b;
const SAMPLE_INPUT_VALUES = [...NINE_SAMPLE_VALUES, CALL_SAMPLE_VALUE, JOIN_SAMPLE_VALUE] as const;
const SAMPLE_OUTPUT_VALUES = [...NINE_SAMPLE_VALUES, CALL_SAMPLE_VALUE] as const;
const SAMPLE_INPUT_START = 0x0400;
const SAMPLE_INPUT_END = 0x040a;
const SAMPLE_OUTPUT_START = 0x0410;
const SAMPLE_OUTPUT_END = 0x0419;
const JOIN_OUTPUT_ADDRESS = 0x041a;

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** The import block shared by both NMI witnesses. */
const NMI_IMPORTS = `module Game;
import { setNMIExclusive, restoreNMI } from c64.system;
import { readAndClearPendingSources } from c64.cia2;
import { sourceAll, sourceTimerA, timerLoad, timerOneShot, timerStart } from c64.cia1;
import { writeTimerALatch, configureTimerA, enableInterruptSources,
    disableInterruptSources } from c64.cia2;`;

/** Install the exclusive handler and arm a one-shot Timer A underflow. */
function timerMain(body: string): string {
  return `function main(): void {
${body}
    setNMIExclusive(&handler);
    disableInterruptSources(sourceAll);
    readAndClearPendingSources();
    configureTimerA(timerOneShot);
    writeTimerALatch($00FF);
    enableInterruptSources(sourceTimerA);
    configureTimerA(timerLoad | timerOneShot | timerStart);
    while (!ready) { asm_nop(); }
    restoreNMI();
}`;
}

/**
 * The materialization witness builds a wide word-mask Boolean, a masked
 * nonzero comparison, and the timer acknowledgement in one genuine NMI.
 */
const MATERIALIZATION_PROGRAM = `${NMI_IMPORTS}
place(at: $C000) let ready: boolean = false;
place(at: $C001) let wide: boolean = false;
place(at: $C002) let bit: boolean = false;
place(at: $C003) let sourceBits: byte = 0;
place(at: $C100) let w: word = 2;
interrupt function handler(): void {
    wide = ((w & 258) != 0);
    bit = ((sourceBits & 3) == 1);
    ready = ((readAndClearPendingSources() & 1) != 0);
}
${timerMain("    sourceBits = $09;")}`;

/**
 * The retention witness keeps nine samples, one sample across a balanced call,
 * one sample across an if/else join, and a computed runtime mask. The timer is
 * acknowledged by the computed-mask read.
 */
const RETENTION_PROGRAM = `${NMI_IMPORTS}
place(at: $C000) let ready: boolean = false;
place(at: $C001) let out: byte = 0;
place(at: $C002) let maskValue: byte = 1;
place(at: $C003) let flag: boolean = false;
place(at: $C004) let marker: byte = 0;
function helper(): void { marker = $5A; }
interrupt function handler(): void {
    let x0: byte = peek($0400); let x1: byte = peek($0401);
    let x2: byte = peek($0402); let x3: byte = peek($0403);
    let x4: byte = peek($0404); let x5: byte = peek($0405);
    let x6: byte = peek($0406); let x7: byte = peek($0407);
    let x8: byte = peek($0408);
    let callSample: byte = peek($0409);
    let joinSample: byte = peek($040A);
    let m: byte = maskValue | 1;
    ready = ((readAndClearPendingSources() & m) != 0);
    poke($0410, x0); poke($0411, x1); poke($0412, x2);
    poke($0413, x3); poke($0414, x4); poke($0415, x5);
    poke($0416, x6); poke($0417, x7); poke($0418, x8);
    helper();
    poke($0419, callSample);
    if (flag) {
        out = joinSample;
    } else {
        out = 0;
    }
    poke($041A, joinSample);
}
${timerMain(`    poke($0400, $11); poke($0401, $12); poke($0402, $13);
    poke($0403, $14); poke($0404, $15); poke($0405, $16);
    poke($0406, $17); poke($0407, $18); poke($0408, $19);
    poke($0409, $1A); poke($040A, $1B);
    flag = true;
    maskValue = 1;`)}`;

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

/** Documented one-byte NMOS 6510 opcodes. */
const ONE_BYTE = new Set([
  0x00, 0x08, 0x0a, 0x18, 0x28, 0x2a, 0x38, 0x40, 0x48, 0x4a, 0x58, 0x60, 0x68, 0x6a, 0x78, 0x88,
  0x8a, 0x98, 0x9a, 0xa8, 0xaa, 0xb8, 0xba, 0xc8, 0xca, 0xd8, 0xe8, 0xea, 0xf8,
]);
/** Documented two-byte NMOS 6510 opcodes. */
const TWO_BYTE = new Set([
  0x01, 0x05, 0x06, 0x09, 0x10, 0x11, 0x15, 0x16, 0x21, 0x24, 0x25, 0x26, 0x29, 0x30, 0x31, 0x35,
  0x36, 0x41, 0x45, 0x46, 0x49, 0x50, 0x51, 0x55, 0x56, 0x61, 0x65, 0x66, 0x69, 0x70, 0x71, 0x75,
  0x76, 0x81, 0x84, 0x85, 0x86, 0x90, 0x91, 0x94, 0x95, 0x96, 0xa0, 0xa1, 0xa2, 0xa4, 0xa5, 0xa6,
  0xa9, 0xb0, 0xb1, 0xb5, 0xb6, 0xc0, 0xc1, 0xc4, 0xc5, 0xc6, 0xc9, 0xd0, 0xd1, 0xd5, 0xd6, 0xe0,
  0xe1, 0xe4, 0xe5, 0xe6, 0xe9, 0xf0, 0xf1, 0xf5, 0xf6,
]);

/** Return the documented encoded length of one opcode. */
function instructionLength(opcode: number): number {
  if (ONE_BYTE.has(opcode)) return 1;
  if (TWO_BYTE.has(opcode)) return 2;
  return 3;
}

/** Find the handler's real RTI by decoding its contiguous code interval. */
function handlerRtiAddress(artifacts: Artifacts, range: { start: number; end: number }): number {
  const load = artifacts.prg.readUInt16LE(0);
  let address = range.start;
  while (address < range.end) {
    const opcode = artifacts.prg[address - load + 2]!;
    if (opcode === 0x40) return address;
    address += instructionLength(opcode);
  }
  throw new Error("Handler has no RTI opcode");
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

/** One reviewed runtime witness and its expected final memory. */
interface Witness {
  readonly source: string;
  readonly title: string;
  /** Selected post-acknowledgement store, used as the effect tracepoint. */
  readonly outputAddress: number;
  /** Exact reported hardware-stack peak including the handler frame. */
  readonly hardwareStack: number;
  /** Placed flags that must read one after the handler. */
  readonly trueFlags: readonly number[];
  /** Placed flags that must read zero after the handler. */
  readonly falseFlags: readonly number[];
  /** Extra final-memory assertions keyed by address. */
  readonly memory: readonly {
    readonly start: number;
    readonly end: number;
    readonly values: readonly number[];
  }[];
}

/**
 * Build, run and observe one retained handler through a genuine CIA2 Timer A NMI.
 * A missing or unidentifiable emulator runtime fails the case instead of skipping it.
 */
async function qualify(witness: Witness): Promise<void> {
  await withProfileProject(witness.source, PROFILE, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const artifactSha256 = createHash("sha256").update(artifacts.prg).digest("hex");
    const totals = profileRecord(artifacts.costs.totals);
    const stackRows = profileRecords(totals.resources).filter(
      (row) => row.kind === "standard" && row.id === "hardwareStack",
    );
    expect(stackRows).toHaveLength(1);
    expect(stackRows[0]!.value).toBe(witness.hardwareStack);
    const labels = addresses(artifacts.labels);
    const handlerAddress = functionEntry(artifacts, labels, "handler");
    const mainRange = functionRange(artifacts, "main");
    const handlerRange = functionRange(artifacts, "handler");
    const rtiAddress = handlerRtiAddress(artifacts, handlerRange);
    const restoreAddress = operationStart(artifacts, witness.source, "restoreNMI()", "main");
    const helperAddress = witness.source.includes("function helper")
      ? functionEntry(artifacts, labels, "helper")
      : null;

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
      expect(callerReturn).toBe(0xe147);
      const entryPorts = Array.from(await monitor.readMemory(0, 1));
      await remove(atStartup);

      const atMain = await checkpoint(mainRange.start);
      const atHandler = await checkpoint(handlerAddress);
      expect(await resume()).toBe(mainRange.start);
      await remove(atMain);

      // Observe the handler's device read and selected post-acknowledgement store without stopping inside it.
      const trace = new Map<number, string>();
      trace.set(await monitor.setAccessTracepoint(CIA2_INTERRUPT_CONTROL, "load"), "load:ICR");
      trace.set(await monitor.setAccessTracepoint(witness.outputAddress, "store"), "store:OUTPUT");
      monitor.takeCheckpointHits();

      // Genuine hardware acceptance of the source-programmed timer underflow.
      expect(await resume()).toBe(handlerAddress);
      const accepted = await monitor.readCpuRegisters();
      const frame = await stackBytes(monitor, accepted.sp, 3);
      expect(frame[0]! & 0x10).toBe(0);
      expect(accepted.p & 0x04).toBe(0x04);
      const resumedPc = frame[1]! | (frame[2]! << 8);
      // The Timer A underflow can land in the KERNAL setup rather than the
      // main loop; the genuine frame must simply not point inside the handler
      // that is about to run. The later mainline checkpoint proves the return.
      expect(resumedPc < handlerRange.start || resumedPc >= handlerRange.end).toBe(true);
      expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([
        handlerAddress & 0xff,
        handlerAddress >> 8,
      ]);
      expect(
        (await monitor.readIo(CIA2_INTERRUPT_CONTROL, CIA2_INTERRUPT_CONTROL))[0]! &
          TIMER_A_SOURCE_BIT,
      ).toBe(TIMER_A_SOURCE_BIT);
      monitor.takeCheckpointHits();

      // Run to the handler's RTI and assert all observed effects and the restored frame.
      const atRti = await checkpoint(rtiAddress);
      expect(await resume()).toBe(rtiAddress);
      expect(takeTrace(monitor, trace)).toEqual(["load:ICR", "store:OUTPUT"]);
      for (const address of witness.trueFlags)
        expect(Array.from(await monitor.readMemory(address, address)), String(address)).toEqual([
          1,
        ]);
      for (const address of witness.falseFlags)
        expect(Array.from(await monitor.readMemory(address, address)), String(address)).toEqual([
          0,
        ]);
      for (const entry of witness.memory)
        expect(Array.from(await monitor.readMemory(entry.start, entry.end))).toEqual([
          ...entry.values,
        ]);
      // The CPU interrupt frame is untouched by the body pushes and cleanup.
      expect(await stackBytes(monitor, accepted.sp, 3)).toEqual(frame);
      const beforeRti = await monitor.readCpuRegisters();
      expect([beforeRti.a, beforeRti.x, beforeRti.y, beforeRti.sp]).toEqual([
        accepted.a,
        accepted.x,
        accepted.y,
        accepted.sp,
      ]);
      await remove(atRti);
      await remove(atHandler);

      // Mainline leaves the loop because it observed the stored readiness flag.
      const atRestore = await checkpoint(restoreAddress);
      monitor.takeCheckpointHits();
      expect(await resume()).toBe(restoreAddress);
      expect(takeTrace(monitor, trace)).toEqual([]);
      for (const address of witness.trueFlags)
        expect(Array.from(await monitor.readMemory(address, address))).toEqual([1]);
      for (const entry of witness.memory)
        expect(Array.from(await monitor.readMemory(entry.start, entry.end))).toEqual([
          ...entry.values,
        ]);
      await remove(atRestore);

      // The final release restores the stock route and returns to the BASIC caller.
      await checkpoint(callerReturn);
      expect(await resume()).toBe(callerReturn);
      const returned = await monitor.readCpuRegisters();
      expect(returned.sp).toBe((caller.sp + 2) & 0xff);
      expect(returned.p & 0x0c).toBe(caller.p & 0x0c);
      expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual(STOCK_NMI_VECTOR);
      expect(Array.from(await monitor.readMemory(0, 1))).toEqual(entryPorts);

      console.info(
        "Residual NMI runtime evidence",
        JSON.stringify({
          title: witness.title,
          profile: PROFILE,
          artifactSha256,
          hardwareStack: witness.hardwareStack,
          handlerRange,
          handlerAddress,
          helperAddress,
          callerReturn,
          trueFlags: witness.trueFlags,
          memory: witness.memory,
        }),
      );
    } finally {
      for (const id of checkpoints) await monitor.deleteCheckpoint(id);
      await stopVice({ child: started.child, monitor });
    }
  });
}

describe.sequential("residual NMI forms at runtime", () => {
  it("should observe a wide word mask and a nonzero masked comparison through Timer A", async () => {
    await qualify({
      source: MATERIALIZATION_PROGRAM,
      title: "materialization",
      outputAddress: READY_ADDRESS,
      hardwareStack: 4,
      trueFlags: [0xc001, 0xc002],
      falseFlags: [],
      memory: [
        { start: READY_ADDRESS, end: READY_ADDRESS, values: [1] },
        { start: WORD_ADDRESS, end: WORD_ADDRESS + 1, values: [2, 0] },
        { start: 0xc003, end: 0xc003, values: [9] },
      ],
    });
  }, 120_000);

  it("should retain nine samples, a join sample and a called sample through Timer A", async () => {
    await qualify({
      source: RETENTION_PROGRAM,
      title: "retention",
      outputAddress: 0x0410,
      hardwareStack: 19,
      trueFlags: [0xc000],
      falseFlags: [],
      memory: [
        { start: 0xc001, end: 0xc001, values: [0x1b] },
        { start: 0xc004, end: 0xc004, values: [0x5a] },
        { start: SAMPLE_OUTPUT_START, end: SAMPLE_OUTPUT_END, values: [...SAMPLE_OUTPUT_VALUES] },
        { start: JOIN_OUTPUT_ADDRESS, end: JOIN_OUTPUT_ADDRESS, values: [JOIN_SAMPLE_VALUE] },
        { start: SAMPLE_INPUT_START, end: SAMPLE_INPUT_END, values: [...SAMPLE_INPUT_VALUES] },
      ],
    });
  }, 120_000);
});
