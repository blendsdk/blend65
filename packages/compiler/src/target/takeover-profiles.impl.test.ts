import { describe, expect, it } from "vitest";
import { createC64InterruptEntry } from "../machine/lower-c64-interrupt.js";
import type { MachineFunction } from "../machine/machine-types.js";
import { createC64Startup } from "../layout/startup.js";
import { C64_RESIDENT_PROFILES } from "../profile/c64-kernal.js";
import { selectTargetProfile } from "./profile.js";

const takeover = C64_RESIDENT_PROFILES.filter(({ ownership }) => ownership === "takeover");

/** Select one complete profile, failing locally instead of hiding a bad fixture. */
function selected(id: string) {
  const result = selectTargetProfile(id);
  if (result.kind !== "complete") throw new Error(`Expected complete profile ${id}`);
  return result.profile;
}

/** Flatten every instruction mnemonic in one machine function. */
function opcodes(
  blocks: readonly { readonly instructions: readonly { readonly opcode: string }[] }[],
) {
  return blocks.flatMap((block) => block.instructions.map(({ opcode }) => opcode));
}

describe.each(takeover)("takeover startup internals for $id", (facts) => {
  it("composes the raw ownership delta without changing video or SID facts", () => {
    const profile = selected(facts.id);
    expect(profile.machine.ownership).toBe("takeover");
    expect(profile.machine.processorPortMapping).toBe(0x05);
    expect(profile.storage.hardwareStackReserve).toBe(0);
    expect(profile.storage.defaultIrqStackBytes).toBe(4);
    expect(profile.storage.defaultNmiStackBytes).toBe(3);
    expect(profile.storage.interruptStackBytes).toBeUndefined();
    expect(profile.interrupts.variants.map(({ id }) => id)).toEqual(["c64_raw_irq"]);
    expect(facts.rasterLines).toBe(facts.video === "pal" ? 312 : 263);
    expect(facts.sidModel).toBe(facts.id.endsWith("6581") ? 6581 : 8580);
  });

  it("emits the complete vector-before-mapping constructor and returning epilogue", () => {
    const profile = selected(facts.id);
    const result = createC64Startup({
      profile,
      initializerLabels: ["init.demo"],
      mainLabel: "main",
    });
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error(result.reason);
    const entry = result.startup.blocks.find(({ label }) => label === "startup.entry");
    const restore = result.startup.blocks.find(({ label }) => label === "startup.restore");
    expect(entry).toBeDefined();
    expect(restore).toBeDefined();
    expect(result.entries?.map(({ id }) => id)).toEqual([
      "startup.rawIrqDefault.fn",
      "startup.rawNmiDefault.fn",
    ]);
    expect(result.stackDemand).toEqual({ heldBytes: 0, transientPeakBytes: 1 });

    const writes = (entry?.instructions ?? []).flatMap((instruction) =>
      instruction.opcode === "sta" && instruction.operand?.kind === "absolute"
        ? [instruction.operand.value]
        : [],
    );
    expect(writes.slice(0, 7)).toEqual([0xfffa, 0xfffb, 0xfffe, 0xffff, 0x0001, 0x0000, 0xdd02]);
    const loads = (entry?.instructions ?? []).filter(
      (instruction) =>
        instruction.opcode === "lda" &&
        instruction.mode === "immediate" &&
        instruction.operand?.kind === "label",
    );
    expect(loads).toHaveLength(4);
    expect(opcodes([entry!]).filter((opcode) => opcode === "jsr")).toHaveLength(1);
    expect(opcodes([entry!])).toContain("cli");
    expect(opcodes([restore!])).toContain("sei");
    expect(restore?.terminator).toMatchObject({ kind: "return", opcode: "rts" });
    expect(result.startup.blocks.at(-1)?.label).toBe("startup.restore");
    const blockBytes = (block: typeof entry) =>
      (block?.instructions ?? []).reduce(
        (total, instruction) => total + instruction.cost.bytes,
        0,
      ) + (block?.terminator.kind === "return" ? 1 : 0);
    const blockCycles = (block: typeof entry) =>
      (block?.instructions ?? []).reduce(
        (total, instruction) => total + instruction.cost.maxCycles,
        0,
      ) + (block?.terminator.kind === "return" ? 6 : 0);
    expect(blockBytes(entry)).toBe(80);
    expect(blockCycles(entry)).toBe(113);
    expect(blockBytes(restore)).toBe(36);
    expect(blockCycles(restore)).toBe(59);
    const empty = createC64Startup({ profile, initializerLabels: [], mainLabel: "main" });
    if (empty.kind !== "complete") throw new Error(empty.reason);
    const emptyEntry = empty.startup.blocks.find(({ label }) => label === "startup.entry");
    expect(blockBytes(emptyEntry)).toBe(77);
    expect(blockCycles(emptyEntry)).toBe(107);
  });

  it("places the default NMI entry at the shared low publication byte", () => {
    const profile = selected(facts.id);
    const result = createC64Startup({ profile, initializerLabels: [], mainLabel: "main" });
    if (result.kind !== "complete") throw new Error(result.reason);
    const nmi = result.entries?.find(({ id }) => id === "startup.rawNmiDefault.fn");
    expect(nmi?.nmiPublicationEntry).toBe(true);
    const instructions = nmi?.blocks.flatMap((block) => block.instructions) ?? [];
    expect(instructions.map(({ opcode }) => opcode)).toEqual(["bit", "rti"]);
    expect(instructions[0]?.operand).toEqual({ kind: "absolute", value: 0xdd0d });
    const irq = result.entries?.find(({ id }) => id === "startup.rawIrqDefault.fn");
    const irqInstructions = irq?.blocks.flatMap((block) => block.instructions) ?? [];
    expect(irqInstructions.map(({ opcode }) => opcode)).toEqual([
      "pha",
      "lda",
      "lda",
      "sta",
      "pla",
      "rti",
    ]);
    const bytes = (instructions: readonly { readonly cost: { readonly bytes: number } }[]) =>
      instructions.reduce((total, instruction) => total + instruction.cost.bytes, 0);
    const cycles = (
      instructions: readonly {
        readonly cost: { readonly minCycles: number; readonly maxCycles: number };
      }[],
    ) => instructions.reduce((total, instruction) => total + instruction.cost.maxCycles, 0);
    expect(bytes(irqInstructions)).toBe(12);
    expect(cycles(irqInstructions)).toBe(25);
    expect(bytes(instructions)).toBe(4);
    expect(cycles(instructions)).toBe(10);
  });
});

describe("takeover raw IRQ wrapper cost", () => {
  it("emits the fixed compiler save/restore/RTI shape for one empty body", () => {
    const profile = selected("c64-pal-prg-takeover-6581");
    const variant = profile.interrupts.variants.find(({ id }) => id === "c64_raw_irq");
    if (variant === undefined) throw new Error("Missing raw IRQ variant");
    const body: MachineFunction = {
      id: "handler",
      blocks: [
        {
          label: "handler.entry",
          instructions: [],
          terminator: { kind: "return" },
        },
      ],
    };
    const wrapper = createC64InterruptEntry(body, "handler.raw", variant, null, profile);
    const instructions = wrapper.blocks.flatMap((block) => block.instructions);
    expect(instructions.map(({ opcode }) => opcode)).toEqual([
      "pha",
      "txa",
      "pha",
      "tya",
      "pha",
      "cld",
      "pla",
      "tay",
      "pla",
      "tax",
      "pla",
      "rti",
    ]);
    expect(instructions.reduce((total, instruction) => total + instruction.cost.bytes, 0)).toBe(12);
    expect(instructions.reduce((total, instruction) => total + instruction.cost.maxCycles, 0)).toBe(
      37,
    );
  });
});

describe("takeover startup rejects unknown ownership composition", () => {
  it("keeps the cooperative constructor for a cooperative row", () => {
    const profile = selected("c64-pal-prg-kernal-6581");
    const result = createC64Startup({ profile, initializerLabels: [], mainLabel: "main" });
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error(result.reason);
    expect(result.entries).toBeUndefined();
    expect(result.startup.blocks.map(({ label }) => label)).toEqual([
      "startup.entry",
      "startup.restore",
    ]);
  });
});
