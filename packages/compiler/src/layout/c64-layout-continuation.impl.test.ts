import { describe, expect, it } from "vitest";
import { machineInstruction } from "../machine/lower-control.js";
import type { MachineBlock, MachineFunction, MachineProgram } from "../machine/machine-types.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { layoutC64Program } from "./c64-layout.js";
import {
  fallsIntoAnotherBody,
  occupiesNoBytes,
  restorationVisible,
} from "./c64-layout-continuation.js";
import { createC64Startup } from "./startup.js";

function selectedProfile() {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (result.kind !== "complete") throw new Error("Expected selected profile");
  return result.profile;
}

const profile = selectedProfile();

/** A closed certificate with one RAM home far above the code. */
const certificate: StorageClosureCertificate = Object.freeze({
  inventoryHash: "inventory",
  graphHash: "graph",
  profileId: "c64-pal-prg-kernal-6581",
  homes: Object.freeze([
    Object.freeze({ requestId: "home", address: 0xc000, bytes: 2, region: "ram" as const }),
  ]),
  interference: Object.freeze([]),
  helperCalls: Object.freeze([]),
  staticBytes: Object.freeze({ ram: 2, zeroPage: 0 }),
  peakBytes: Object.freeze({ ram: 2, zeroPage: 0 }),
  hardwareStackPeak: 6,
  closed: true,
});

/** `count` one-byte instructions. */
const nops = (count: number) =>
  Object.freeze(
    Array.from({ length: count }, () => machineInstruction(profile.cpu, "nop", "implied", null)),
  );

/** A jump, marked as a continuation when asked. */
function jump(target: string, continuation: boolean) {
  return Object.freeze({
    kind: "jump" as const,
    opcode: "jmp" as const,
    target,
    cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
    ...(continuation ? { continuation: true as const } : {}),
  });
}

/** One function of a single block. */
function body(
  id: string,
  instructions: number,
  terminator: MachineBlock["terminator"],
  overrides: Partial<MachineFunction> = {},
): MachineFunction {
  return Object.freeze({
    id,
    blocks: Object.freeze([
      Object.freeze({ label: `${id}.entry`, instructions: nops(instructions), terminator }),
    ]),
    ...overrides,
  });
}

/** Lay out a program whose functions are given in order; main is the first. */
function layout(
  functions: readonly MachineFunction[],
  data: MachineProgram["data"] = Object.freeze([]),
) {
  const startup = createC64Startup({
    initializerLabels: Object.freeze([]),
    mainLabel: "main",
    profile,
  });
  if (startup.kind !== "complete") throw new Error("Expected startup");
  const program: MachineProgram = Object.freeze({
    functions: Object.freeze(functions),
    data,
    startup: startup.startup,
    requiredStorage: Object.freeze([]),
  });
  const result = layoutC64Program({ program, certificate, profile });
  if (result.kind !== "complete")
    throw new Error(`Expected a layout: ${result.reason} ${String(result.objectId)}`);
  return result;
}

/** Placed bytes of one function, summed over its blocks. */
function length(fn: MachineFunction): number {
  return fn.blocks.reduce(
    (sum, { instructions, terminator }) =>
      sum +
      instructions.reduce((total, item) => total + item.cost.bytes, 0) +
      (terminator.kind === "jump" ? 3 : terminator.kind === "return" ? 1 : 0),
    0,
  );
}

const restoreOrigin = (result: ReturnType<typeof layout>) =>
  result.program.startup.blocks.find(({ label }) => label === "startup.restore")!.origin!;

describe("layout of a continuation into the next body", () => {
  it("places each continued body after the one continuing into it and drops the jumps", () => {
    const result = layout([
      body("main", 0, jump("work", true)),
      body("helper", 4, Object.freeze({ kind: "return" as const })),
      body("work", 5, jump("startup.restore", true)),
    ]);
    const byId = new Map(result.program.functions.map((fn) => [fn.id, fn] as const));
    const main = byId.get("main")!;
    const work = byId.get("work")!;
    expect(occupiesNoBytes(main), "main is only a fall-through").toBe(true);
    expect(main.origin, "main shares work's address").toBe(work.origin);
    expect(work.blocks.at(-1)!.terminator).toEqual({
      kind: "fallthrough",
      target: "startup.restore",
    });
    expect(restoreOrigin(result), "the restoration follows work").toBe(work.origin! + 5);
    expect(byId.get("helper")!.origin, "other bodies come after the chain").toBeGreaterThan(
      restoreOrigin(result),
    );
  });

  it("starts no chain from a fixed body, whose restoration could only extend the program", () => {
    const fixed = Object.freeze({ at: 0x3000, align: 1, noCross: null, region: null });
    const result = layout([
      body("main", 2, jump("work", true)),
      body("work", 5, jump("startup.restore", true), { placement: fixed }),
    ]);
    const main = result.program.functions.find(({ id }) => id === "main")!;
    const work = result.program.functions.find(({ id }) => id === "work")!;
    expect(main.blocks.at(-1)!.terminator).toMatchObject({ kind: "jump", target: "work" });
    expect(length(main)).toBe(5);
    expect(fallsIntoAnotherBody(main)).toBe(false);
    expect(work.blocks.at(-1)!.terminator).toMatchObject({
      kind: "jump",
      target: "startup.restore",
    });
    expect(restoreOrigin(result)).toBeLessThan(0x3000);
  });

  it("does not move the restoration for a jump that is not a continuation", () => {
    const marked = layout([
      body("main", 2, jump("startup.restore", false)),
      body("helper", 4, Object.freeze({ kind: "return" as const })),
    ]);
    const main = marked.program.functions.find(({ id }) => id === "main")!;
    const helper = marked.program.functions.find(({ id }) => id === "helper")!;
    expect(main.blocks.at(-1)!.terminator.kind).toBe("jump");
    expect(restoreOrigin(marked)).toBe(helper.origin! + length(helper));
  });

  it("emits a code interval for the chain without a zero-length piece", () => {
    const result = layout([
      body("main", 0, jump("work", true)),
      body("work", 3, jump("startup.restore", true)),
    ]);
    for (const interval of result.intervals)
      expect(interval.end, interval.id).toBeGreaterThanOrEqual(interval.start);
  });

  it("keeps the jump rather than place the restoration under BASIC ROM", () => {
    // The restoration banks BASIC back in while it runs, so it may not sit at
    // $A000-$BFFF. A fixed block of data pushes the chain up to just below it.
    const result = layout(
      [body("main", 0, jump("work", true)), body("work", 20, jump("startup.restore", true))],
      [
        Object.freeze({
          id: "data.filler",
          kind: "immutable" as const,
          alignment: 1,
          bytes: Object.freeze(new Array<number>(0x9fd0 - 0x0960).fill(0)),
          placement: Object.freeze({ at: 0x0960, align: 1, noCross: null, region: null }),
        }),
      ],
    );
    const work = result.program.functions.find(({ id }) => id === "work")!;
    expect(work.origin).toBeGreaterThanOrEqual(0x9fd0);
    expect(work.blocks.at(-1)!.terminator).toMatchObject({
      kind: "jump",
      target: "startup.restore",
    });
  });

  it("tells restoration ranges under BASIC ROM from the RAM around it", () => {
    expect(restorationVisible(0x9fe0, 0x20)).toBe(true);
    expect(restorationVisible(0x9fe1, 0x20)).toBe(false);
    expect(restorationVisible(0xbff0, 4)).toBe(false);
    expect(restorationVisible(0xc000, 26)).toBe(true);
  });

  it("places NMI publication before any chain takes the gap it needs", () => {
    // The wrapper must sit at a $xx47 address without a three-byte adapter. The
    // restoration of a program that publishes NMI is larger than the gap left
    // before that address, so the entry keeps its jump rather than take it.
    const result = layout([
      body("main", 2, jump("startup.restore", true)),
      body("nmi", 10, Object.freeze({ kind: "return" as const }), { nmiPublicationEntry: true }),
    ]);
    const nmi = result.program.functions.find(({ id }) => id === "nmi")!;
    const main = result.program.functions.find(({ id }) => id === "main")!;
    expect(nmi.origin! & 0xff).toBe(0x47);
    expect(nmi.blocks.some(({ label }) => label.endsWith(".nmi-publication"))).toBe(false);
    expect(main.blocks.at(-1)!.terminator.kind).toBe("jump");
    expect(restoreOrigin(result)).toBeGreaterThan(nmi.origin!);
  });
});
