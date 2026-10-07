import { expect } from "vitest";
import type { ViceCpuRegisters, ViceMonitor } from "../m1/vice-monitor.js";
import type { Cia2Artifacts, Cia2CodeSlice } from "./cia2-output-fixture.js";
import {
  cia2FunctionVariants,
  cia2Instructions,
  cia2OperationGroups,
} from "./cia2-output-fixture.js";
import type { Cia2TimerScenario } from "./cia2-vice-sources.js";

/** Observe only CPU accesses to the vector and the timer/device epoch being qualified. */
const DEVICE_ADDRESSES = [
  ["NMINV_LOW", 0x0318],
  ["NMINV_HIGH", 0x0319],
  ["TIMER_A_LOW", 0xdd04],
  ["TIMER_A_HIGH", 0xdd05],
  ["TIMER_B_LOW", 0xdd06],
  ["TIMER_B_HIGH", 0xdd07],
  ["ICR", 0xdd0d],
  ["CRA", 0xdd0e],
  ["CRB", 0xdd0f],
] as const;

/** Associate monitor checkpoint identities with their exact non-consuming observation labels. */
export async function cia2AccessTrace(monitor: ViceMonitor): Promise<ReadonlyMap<number, string>> {
  const events = new Map<number, string>();
  for (const [name, address] of DEVICE_ADDRESSES)
    for (const operation of ["load", "store"] as const)
      events.set(await monitor.setAccessTracepoint(address, operation), `${operation}:${name}`);
  monitor.takeCheckpointHits();
  return events;
}

/** Take CPU device events without confusing execute-checkpoint IDs with CPU addresses. */
function takeTrace(monitor: ViceMonitor, events: ReadonlyMap<number, string>): string[] {
  return monitor.takeCheckpointHits().flatMap((id) => {
    const event = events.get(id);
    return event === undefined ? [] : [event];
  });
}

/** Arm the stop wait before execution and fail if any other boundary is reached. */
export async function cia2Reach(monitor: ViceMonitor, address: number): Promise<void> {
  const stop = monitor.waitForStop(15_000);
  await monitor.resume();
  expect(await stop).toBe(address);
}

/** Resolve one emitted source body from actual public range metadata. */
function body(artifacts: Cia2Artifacts, name: string): Cia2CodeSlice {
  const variants = cia2FunctionVariants(artifacts, name);
  expect(variants).toHaveLength(1);
  return variants[0]!;
}

/** Resolve a complete source call, never a narrower operand-load span. */
function operation(artifacts: Cia2Artifacts, source: string, proof: string, name = "main") {
  const groups = cia2OperationGroups(artifacts, source, proof, name);
  expect(groups).toHaveLength(1);
  return groups[0]!;
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

/** Compare real register/status state, excluding the non-persistent B and constant representation bits. */
function expectRestored(actual: ViceCpuRegisters, expected: ViceCpuRegisters): void {
  expect([actual.a, actual.x, actual.y, actual.sp, actual.p & 0xcf]).toEqual([
    expected.a,
    expected.x,
    expected.y,
    expected.sp,
    expected.p & 0xcf,
  ]);
}

/** Require the precise model resources selected by the attested native bridge. */
export async function cia2ModelIdentity(monitor: ViceMonitor, profile: string): Promise<void> {
  const expected = [
    ["VICIIModel", profile.includes("-pal-") ? 0 : 3],
    ["SidModel", profile.endsWith("6581") ? 0 : 1],
    ["CIA1Model", 0],
    ["CIA2Model", 0],
    ["KernalRev", 3],
  ] as const;
  for (const [resource, value] of expected)
    expect(await monitor.readIntegerResource(resource)).toBe(value);
}

/** Prove actual NMI acceptance, selected RTI execution, source bit policy and final idle handback. */
export async function qualifyCia2Timer(
  monitor: ViceMonitor,
  artifacts: Cia2Artifacts,
  source: string,
  scenario: Cia2TimerScenario,
): Promise<void> {
  const main = body(artifacts, "main");
  const handler = body(artifacts, "handler");
  const ingress = operation(
    artifacts,
    source,
    "poke($0410, readAndClearPendingSources())",
    "handler",
  );
  const install = operation(artifacts, source, "setNMIExclusive(&handler)");
  const release = operation(artifacts, source, "restoreNMI()");
  const maskWrites = cia2Instructions(release.bytes).filter(
    ({ opcode, operand }) => opcode === 0x8d && operand === 0xdd0d,
  );
  expect(maskWrites).toHaveLength(1);
  const maskWrite = release.start + maskWrites[0]!.offset;
  const rti = handler.end - 1;
  expect(handler.bytes.at(-1)).toBe(0x40);
  expect(handler.start & 0xff).toBe(0x47);
  const capture = cia2Instructions(install.bytes);
  const lowCapture = capture.findIndex(
    ({ opcode, operand }) => opcode === 0xad && operand === 0x0318,
  );
  expect(lowCapture).toBeGreaterThanOrEqual(0);
  const linkStore = capture[lowCapture + 1]!;
  expect([0x85, 0x8d]).toContain(linkStore.opcode);
  const link = linkStore.operand!;
  expect(link & 0xff).toBeLessThanOrEqual(0xfe);

  const startCheckpoint = await monitor.setExecuteCheckpoint(0x080d);
  await cia2Reach(monitor, 0x080d);
  await monitor.deleteCheckpoint(startCheckpoint);
  const caller = await monitor.readCpuRegisters();
  const returnBytes = await stackBytes(monitor, caller.sp, 2);
  const basicReturn = ((returnBytes[0]! | (returnBytes[1]! << 8)) + 1) & 0xffff;
  // The pinned SYS extension pushes $E146; RTS resumes at its PHP in KERNAL ROM.
  expect(basicReturn).toBe(0xe147);
  const ports = await monitor.readMemory(0, 1);
  expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([0x47, 0xfe]);
  expect((await monitor.readMemory(0x02a1, 0x02a1))[0]).toBe(0);
  const idleControls = await monitor.readIo(0xdd0e, 0xdd0f);
  expect(idleControls[0]! & 1).toBe(0);
  expect(idleControls[1]! & 1).toBe(0);
  expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x1f).toBe(0);
  expect(Array.from(await monitor.readMemory(0xfffa, 0xfffb))).toEqual([0x43, 0xfe]);
  expect(Array.from(await monitor.readMemory(0xfe43, 0xfe46))).toEqual([0x78, 0x6c, 0x18, 0x03]);
  const events = await cia2AccessTrace(monitor);
  const hardware = await monitor.setExecuteCheckpoint(0xfe43);
  const entry = await monitor.setExecuteCheckpoint(handler.start);
  const bodyEntry = await monitor.setExecuteCheckpoint(ingress.start);
  const terminal = await monitor.setExecuteCheckpoint(rti);
  await monitor.setExecuteCheckpoint(release.start);
  await monitor.setExecuteCheckpoint(maskWrite);
  await monitor.setExecuteCheckpoint(release.end);
  await monitor.setExecuteCheckpoint(basicReturn);

  await cia2Reach(monitor, 0xfe43);
  const accepted = await monitor.readCpuRegisters();
  const frame = await stackBytes(monitor, accepted.sp, 3);
  const resumedPc = frame[1]! | (frame[2]! << 8);
  expect(frame[0]! & 0x10).toBe(0);
  expect(frame[0]! & 0x04).toBe(0x04);
  expect(resumedPc).toBeGreaterThanOrEqual(main.start);
  expect(resumedPc).toBeLessThan(main.end);
  // VICE's non-consuming peek does not catch up the delayed ICR bit-seven state.
  expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x1f).toBe(scenario.pending & 0x1f);
  expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([
    handler.start & 0xff,
    handler.start >> 8,
  ]);
  expect(Array.from(await monitor.readMemory(link, link + 1))).toEqual([0x47, 0xfe]);
  const programming = takeTrace(monitor, events);
  expect(programming.filter((event) => event === "load:ICR")).toHaveLength(1);
  const latchWrites = [
    "store:TIMER_A_LOW",
    "store:TIMER_A_HIGH",
    "store:TIMER_B_LOW",
    "store:TIMER_B_HIGH",
  ];
  expect(programming.filter((event) => latchWrites.includes(event))).toEqual([
    "store:TIMER_A_LOW",
    "store:TIMER_A_HIGH",
    "store:TIMER_B_LOW",
    "store:TIMER_B_HIGH",
  ]);
  await cia2Reach(monitor, handler.start);
  await cia2Reach(monitor, ingress.start);
  expect((await monitor.readCpuRegisters()).p & 8).toBe(0);
  await cia2Reach(monitor, rti);
  const beforeRti = await monitor.readCpuRegisters();
  expect([beforeRti.a, beforeRti.x, beforeRti.y, beforeRti.sp]).toEqual([
    accepted.a,
    accepted.x,
    accepted.y,
    accepted.sp,
  ]);
  expect(takeTrace(monitor, events).filter((event) => event === "load:ICR")).toHaveLength(1);
  expect((await monitor.readMemory(0x0410, 0x0410))[0]).toBe(scenario.pending);
  expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x1f).toBe(0);
  const resumed = await monitor.setExecuteCheckpoint(resumedPc);
  await cia2Reach(monitor, resumedPc);
  expectRestored(await monitor.readCpuRegisters(), {
    ...accepted,
    sp: (accepted.sp + 3) & 0xff,
    p: frame[0]!,
  });
  await monitor.deleteCheckpoint(resumed);
  await monitor.deleteCheckpoint(entry);
  await monitor.deleteCheckpoint(bodyEntry);
  await monitor.deleteCheckpoint(terminal);
  // Keep the hardware checkpoint armed: an unexpected second acceptance cannot silently pass.
  expect(hardware).toBeGreaterThan(0);

  await cia2Reach(monitor, release.start);
  expect(takeTrace(monitor, events).filter((event) => event === "load:ICR")).toEqual([]);
  expect(Array.from(await monitor.readMemory(0x0410, 0x0414))).toEqual([
    scenario.pending,
    scenario.mask & 1 ? 0x11 : 0,
    scenario.mask & 2 ? 0x22 : 0,
    1,
    0,
  ]);
  const beforeRelease = await monitor.readCpuRegisters();
  const controls = await monitor.readIo(0xdd0e, 0xdd0f);
  await cia2Reach(monitor, maskWrite);
  expect((await monitor.readCpuRegisters()).a).toBe(0x1f);
  await cia2Reach(monitor, release.end);
  expectRestored(await monitor.readCpuRegisters(), beforeRelease);
  expect(takeTrace(monitor, events)).toEqual([
    "store:NMINV_HIGH",
    "store:ICR",
    "load:CRA",
    "store:CRA",
    "load:CRB",
    "store:CRB",
    "load:ICR",
  ]);
  expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([0x47, 0xfe]);
  expect(Array.from(await monitor.readMemory(link, link + 1))).toEqual([0x47, 0xfe]);
  expect(Array.from(await monitor.readIo(0xdd0e, 0xdd0f))).toEqual([
    (controls[0]! & 0xc6) | 8,
    (controls[1]! & 0x86) | 8,
  ]);
  expect(Array.from(await monitor.readIo(0xdd04, 0xdd07))).toEqual([0xff, 0, 0xff, 0]);
  expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x9f).toBe(0);
  await cia2Reach(monitor, basicReturn);
  const returned = await monitor.readCpuRegisters();
  expect(returned.sp).toBe((caller.sp + 2) & 0xff);
  expect(returned.p & 0x0c).toBe(caller.p & 0x0c);
  expect(Array.from(await monitor.readMemory(0, 1))).toEqual(Array.from(ports));
  expect((await monitor.readMemory(0x0414, 0x0414))[0]).toBe(1);
  expect((await monitor.readMemory(0x02a1, 0x02a1))[0]).toBe(0);
  expect(Array.from(await monitor.readMemory(0x0318, 0x0319))).toEqual([0x47, 0xfe]);
  expect(Array.from(await monitor.readIo(0xdd04, 0xdd07))).toEqual([0xff, 0, 0xff, 0]);
}
