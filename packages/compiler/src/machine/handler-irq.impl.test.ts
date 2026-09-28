import { describe, expect, it } from "vitest";
import type { PlatformOperation } from "../semantic/operations.js";
import type { StorageClosureCertificate, StorageRequest } from "../storage/storage-types.js";
import { bindMachineProgram } from "./bind.js";
import { createC64InterruptEntry, lowerC64InterruptOperation } from "./lower-c64-interrupt.js";
import { machineInstruction } from "./lower-control.js";
import { selectedProfile, sourceBinding, sourceSpan, VOID } from "./lowering-test-support.js";
import type { MachineFunction, MachineProgram } from "./machine-types.js";

const profile = selectedProfile();

/** Model the fixed scratch used by each private helper body. */
function scratchRequest(id: string): StorageRequest {
  const owner = sourceBinding(1);
  return {
    id,
    storageClass: "helper-scratch",
    owner,
    domain: "irq",
    binding: null,
    value: id,
    type: null,
    bytes: 2,
    alignment: 1,
    region: "ram",
    lifetime: {
      function: owner,
      value: id,
      definition: { block: "entry", operation: 0 },
      liveAt: [],
      callsCrossed: [],
    },
    source: owner.span,
    reason: "Handler-private helper scratch",
  };
}

/** Supply only the final-home facts used by the existing machine binder. */
function certificate(
  homes: readonly { readonly requestId: string; readonly address: number }[],
): StorageClosureCertificate {
  return {
    inventoryHash: "handler-inventory",
    graphHash: "handler-graph",
    profileId: profile.id,
    homes: homes.map((home) => ({ ...home, bytes: 2, region: "ram" })),
    interference: [],
    helperCalls: [],
    staticBytes: {
      ram: new Set(homes.flatMap(({ address }) => [address, address + 1])).size,
      zeroPage: 0,
    },
    peakBytes: { ram: 2, zeroPage: 0 },
    hardwareStackPeak: 0,
    hardwareStackProgramPeak: 0,
    hardwareStackSystemPeak: 0,
    hardwareStackRoute: [],
    closed: true,
  };
}

describe("handler IRQ machine binding", () => {
  it("keeps the selected entry and vector transaction on the same exact predecessor word", () => {
    const slot = "interrupt-link:irq:handler-a:0";
    const entry = "interrupt.handler-b.slot-a";
    const operation: PlatformOperation = {
      kind: "platform",
      result: null,
      capability: "c64.system.setIRQ",
      arguments: ["handler"],
      type: VOID,
      effect: "volatile-write",
      span: sourceSpan(10),
    };
    const lowered = lowerC64InterruptOperation(operation, profile, {
      requestScratch: () => {
        throw new Error("Vector update must not allocate scratch");
      },
      interruptBinding: () => ({ linkRequestId: slot, entryLabel: entry }),
    });
    expect(lowered).not.toBeNull();
    if (lowered === null) throw new Error("Expected selected vector transaction");
    expect(lowered.instructions.map(({ opcode }) => opcode)).toEqual([
      "php",
      "pha",
      "sei",
      "lda",
      "sta",
      "lda",
      "sta",
      "lda",
      "sta",
      "lda",
      "sta",
      "pla",
      "plp",
    ]);
    expect(
      lowered.instructions
        .filter(({ operand }) => operand?.kind === "storage")
        .map(({ operand }) => operand),
    ).toEqual([
      { kind: "storage", requestId: slot, offset: 0 },
      { kind: "storage", requestId: slot, offset: 1 },
    ]);
    expect(
      lowered.instructions
        .filter(({ operand }) => operand?.kind === "label")
        .map(({ operand }) => operand),
    ).toEqual([
      { kind: "label", label: entry, addressByte: "low" },
      { kind: "label", label: entry, addressByte: "high" },
    ]);
    expect(
      lowered.instructions.flatMap(({ memory }) => memory).filter(({ volatile }) => volatile),
    ).toHaveLength(4);
    expect(lowered.instructions.every(({ source }) => source === operation.span)).toBe(true);

    const body: MachineFunction = {
      id: "fn.handler-b",
      blocks: [{ label: "fn.handler-b.entry", instructions: [], terminator: { kind: "return" } }],
    };
    const variant = profile.interrupts.variants.find(({ id }) => id === "c64_kernal_cinv_chain");
    if (variant === undefined) throw new Error("Missing selected chain entry");
    const wrapped = createC64InterruptEntry(body, entry, variant, slot, profile);
    expect(wrapped.blocks[0]!.instructions.at(-1)).toMatchObject({
      opcode: "jmp",
      mode: "indirect",
      operand: { kind: "storage", requestId: slot, offset: 0 },
    });
  });

  it("shares bound root bodies only when their physical scratch homes match", () => {
    const first = "helper-scratch:root-a";
    const second = "helper-scratch:root-b";
    const labels = ["fn.helper.irq.root61.depth0", "fn.helper.irq.root62.depth0"];
    const helper = (id: string, requestId: string): MachineFunction => ({
      id,
      sourceName: "helper",
      blocks: [
        {
          label: `${id}.entry`,
          instructions: [
            machineInstruction(
              profile.cpu,
              "lda",
              "storage",
              { kind: "storage", requestId, offset: 0 },
              [
                {
                  kind: "read",
                  address: { kind: "storage", requestId, offset: 0 },
                  width: 1,
                  volatile: false,
                  order: 0,
                },
              ],
            ),
          ],
          terminator: { kind: "return" },
        },
      ],
    });
    const caller: MachineFunction = {
      id: "fn.caller",
      blocks: [
        {
          label: "fn.caller.entry",
          instructions: labels.map((label) =>
            machineInstruction(profile.cpu, "jsr", "absolute", { kind: "label", label }),
          ),
          terminator: { kind: "return" },
        },
      ],
    };
    const symbolic: MachineProgram = {
      startup: { id: "startup", blocks: [] },
      functions: [caller, helper(labels[0]!, first), helper(labels[1]!, second)],
      data: [],
      requiredStorage: [scratchRequest(first), scratchRequest(second)],
    };
    const distinct = bindMachineProgram(
      symbolic,
      certificate([
        { requestId: first, address: 0x3000 },
        { requestId: second, address: 0x3002 },
      ]),
    );
    expect(distinct.kind).toBe("complete");
    if (distinct.kind !== "complete") throw new Error("Distinct homes should bind");
    expect(distinct.program.functions).toHaveLength(3);
    expect(
      distinct.program.functions.slice(1).map((fn) => fn.blocks[0]?.instructions[0]?.operand),
    ).toEqual([
      { kind: "absolute", value: 0x3000 },
      { kind: "absolute", value: 0x3002 },
    ]);

    const shared = bindMachineProgram(
      symbolic,
      certificate([
        { requestId: first, address: 0x3000 },
        { requestId: second, address: 0x3000 },
      ]),
    );
    expect(shared.kind).toBe("complete");
    if (shared.kind !== "complete") throw new Error("Identical homes should bind");
    expect(shared.program.functions).toHaveLength(2);
    expect(
      shared.program.functions[0]!.blocks[0]!.instructions.map(({ operand }) => operand),
    ).toEqual([
      { kind: "label", label: labels[0] },
      { kind: "label", label: labels[0] },
    ]);
    expect(symbolic.functions).toHaveLength(3);
  });
});
