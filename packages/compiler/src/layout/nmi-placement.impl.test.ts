import { describe, expect, it } from "vitest";
import type { PlacementConstraints } from "../frontend/semantic-types.js";
import { machineInstruction } from "../machine/lower-control.js";
import type { MachineDataObject, MachineFunction } from "../machine/machine-types.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import type { C64LayoutResult } from "./c64-layout.js";
import { layoutC64Program } from "./c64-layout.js";
import { createC64Startup } from "./startup.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

/** Lay out an already-bound, private-home-free empty wrapper with a page-safe tail. */
function layout(
  target: (typeof profiles)[number],
  placement?: PlacementConstraints,
  data: readonly MachineDataObject[] = [],
) {
  const selected = selectTargetProfile(target);
  if (selected.kind !== "complete") throw new Error("Expected selected profile");
  const profile = selected.profile;
  const startup = createC64Startup({ initializerLabels: [], mainLabel: "main", profile });
  if (startup.kind !== "complete") throw new Error("Expected startup");
  const wrapper: MachineFunction = {
    id: "nmi",
    nmiPublicationEntry: true,
    nmiEntryStackBytes: 3,
    ...(placement === undefined ? {} : { placement }),
    blocks: [
      {
        label: "nmi.body",
        instructions: [
          machineInstruction(profile.cpu, "jmp", "indirect", { kind: "absolute", value: 0xc000 }),
        ],
        terminator: { kind: "unreachable" },
      },
    ],
  };
  const certificate: StorageClosureCertificate = {
    inventoryHash: "inventory",
    graphHash: "graph",
    profileId: target,
    homes: [{ requestId: "tail", address: 0xc000, bytes: 2, region: "ram" }],
    interference: [],
    helperCalls: [],
    staticBytes: { ram: 2, zeroPage: 0 },
    peakBytes: { ram: 2, zeroPage: 0 },
    hardwareStackPeak: 0,
    closed: true,
  };
  return layoutC64Program({
    profile,
    certificate,
    program: {
      functions: [
        {
          id: "main",
          blocks: [{ label: "main.entry", instructions: [], terminator: { kind: "return" } }],
        },
        wrapper,
      ],
      data,
      startup: startup.startup,
      requiredStorage: [],
    },
  });
}

/** Every loaded address is charged once; function homes are not PRG bytes. */
function complete(result: C64LayoutResult) {
  expect(result.kind, JSON.stringify(result.kind === "error" ? result : null)).toBe("complete");
  if (result.kind !== "complete") throw new Error("Expected complete placement");
  const loaded = result.intervals.filter(({ bytes }) => bytes !== null);
  const charged = loaded.reduce((sum, { start, end, bytes }) => {
    expect(bytes).toHaveLength(end - start + 1);
    return sum + bytes!.length;
  }, 0);
  expect(charged).toBe(result.loadRange.end - result.loadRange.start + 1);
  for (let index = 1; index < result.intervals.length; index += 1)
    expect(result.intervals[index]!.start).toBeGreaterThan(result.intervals[index - 1]!.end);
  expect(result.program.requiredStorage).toEqual([]);
  expect(result.intervals.filter(({ kind }) => kind === "sfa")).toEqual([
    { id: "tail", kind: "sfa", start: 0xc000, end: 0xc001, bytes: null },
  ]);
  return { result, wrapper: result.program.functions.find(({ id }) => id === "nmi")! };
}

describe.each(profiles)("NMI publication placement: %s", (target) => {
  it("uses the complete wrapper directly at low $47 and charges all loaded fill", () => {
    const { result, wrapper } = complete(layout(target));
    expect(wrapper.origin! & 0xff).toBe(0x47);
    expect(wrapper.blocks).toHaveLength(1);
    expect(wrapper.blocks[0]?.origin).toBe(wrapper.origin);
    expect(wrapper.blocks[0]?.instructions).toHaveLength(1);
    expect(wrapper.blocks[0]?.instructions[0]).toMatchObject({
      opcode: "jmp",
      mode: "indirect",
      operand: { kind: "absolute", value: 0xc000 },
      cost: { bytes: 3, minCycles: 5, maxCycles: 5 },
    });
    expect(result.intervals.some(({ kind }) => kind === "fill")).toBe(true);
  });

  it.each([
    ["fixed address", { at: 0x2000, align: 256, noCross: 256, region: null }],
    ["alignment", { at: null, align: 256, noCross: 256, region: null }],
  ] as const)(
    "retains %s on the complete body, with one immutable three-byte adapter",
    (_name, placement) => {
      const { wrapper } = complete(layout(target, placement));
      expect(wrapper.blocks).toHaveLength(2);
      const [entry, body] = wrapper.blocks;
      expect(wrapper.origin! & 0xff).toBe(0x47);
      expect(entry?.origin).toBe(wrapper.origin);
      expect(body!.origin! % 256).toBe(0);
      if (placement.at !== null) expect(body?.origin).toBe(placement.at);
      expect(wrapper.placement).toEqual(placement);
      expect(entry?.instructions).toHaveLength(1);
      expect(entry?.instructions[0]).toMatchObject({
        opcode: "jmp",
        mode: "absolute",
        operand: { kind: "label", label: body?.label },
        cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
      });
      expect(wrapper.nmiEntryStackBytes).toBe(3);
      expect(body?.instructions[0]?.mode).toBe("indirect");
    },
  );

  it("moves automatic publication past an occupied low-$47 address without moving fixed data", () => {
    const baseline = complete(layout(target)).wrapper.origin!;
    const data: MachineDataObject = {
      id: "fixed.data",
      kind: "immutable",
      alignment: 1,
      bytes: [0xa5, 0x5a, 0xff],
      placement: { at: baseline, align: 1, noCross: null, region: null },
    };
    const { result, wrapper } = complete(layout(target, undefined, [data]));
    expect(wrapper.origin).toBe(baseline + 256);
    expect(wrapper.blocks).toHaveLength(1);
    expect(result.intervals.find(({ id }) => id === data.id)).toMatchObject({
      start: baseline,
      end: baseline + 2,
      bytes: data.bytes,
    });
  });

  it.each([
    ["real complete-body collision", { at: 0x2047, align: 1, noCross: null, region: null }, true],
    ["misaligned fixed body", { at: 0x2001, align: 256, noCross: null, region: null }, false],
    ["complete body crosses page", { at: 0x20ff, align: 1, noCross: 256, region: null }, false],
  ] as const)(
    "rejects %s rather than adapting away its source constraint",
    (_name, placement, collision) => {
      const data: MachineDataObject[] = collision
        ? [{ id: "collision", kind: "immutable", alignment: 1, bytes: [1, 2, 3], placement }]
        : [];
      expect(layout(target, placement, data)).toEqual({
        kind: "error",
        reason: "source-placement",
        objectId: "nmi",
      });
    },
  );
});
