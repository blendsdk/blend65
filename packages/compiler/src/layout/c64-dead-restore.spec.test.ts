import { describe, expect, it } from "vitest";
import { machineCost, machineInstruction } from "../machine/lower-control.js";
import type { MachineBlock, MachineProgram } from "../machine/machine-types.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { layoutC64Program } from "./c64-layout.js";
import { createC64Startup, createC64StartupStateData } from "./startup.js";

/** Use one real cooperative profile throughout construction and certification. */
function profileFor() {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (result.kind !== "complete") throw new Error("Fixture profile must exist");
  return result.profile;
}

/** No function homes are requested by the direct, storage-free machine fixture. */
function certificateFor(): StorageClosureCertificate {
  return {
    inventoryHash: "fixture-empty-inventory",
    graphHash: "fixture-empty-graph",
    profileId: profileFor().id,
    homes: [],
    interference: [],
    helperCalls: [],
    staticBytes: { ram: 0, zeroPage: 0 },
    peakBytes: { ram: 0, zeroPage: 0 },
    hardwareStackPeak: 0,
    hardwareStackProgramPeak: 0,
    hardwareStackSystemPeak: 0,
    hardwareStackRoute: [],
    closed: true,
  };
}

/** Metadata is supplied only in tests which intend final startup regeneration. */
function programFor(restoreRequired?: boolean): MachineProgram {
  const profile = profileFor();
  const configuration = {
    initializerLabels: [],
    mainLabel: "main",
    startupPolicy: "full" as const,
    ...(restoreRequired === undefined ? {} : { restoreRequired }),
  };
  const result = createC64Startup({ ...configuration, profile });
  if (result.kind !== "complete") throw new Error("Startup fixture must construct");
  return {
    startup: result.startup,
    c64Startup: configuration,
    functions: [
      {
        id: "main",
        blocks: [
          {
            label: "main.entry",
            instructions: [],
            terminator: {
              kind: "jump",
              opcode: "jmp",
              target: "main.entry",
              cost: machineCost(profile.cpu, "jmp", "absolute"),
            },
          },
        ],
      },
    ],
    data: [createC64StartupStateData(configuration)],
    requiredStorage: [],
  };
}

/** Keep direct malformed inputs distinct from inputs that startup rebinding repairs. */
function withoutMetadata(program: MachineProgram): MachineProgram {
  const { c64Startup: omitted, ...direct } = program;
  void omitted;
  return direct;
}

/** The entire restore family is absent, not merely its first entry label. */
function isRestore(block: MachineBlock): boolean {
  return block.label === "startup.restore" || block.label.startsWith("startup.restore.");
}

/** Run only the layout boundary; this helper never invokes an assembler or emulator. */
function layout(program: MachineProgram) {
  return layoutC64Program({ program, certificate: certificateFor(), profile: profileFor() });
}

describe("C64 layout without an unreachable restore partition", () => {
  it("should lay out valid false metadata without restore code or empty intervals", () => {
    const result = layout(programFor(false));
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Selected layout must complete");
    expect(result.program.c64Startup).toMatchObject({ restoreRequired: false });
    expect(result.program.startup.blocks.some(isRestore)).toBe(false);
    expect(result.program.startup.blocks[0]?.label).toBe("startup.entry");
    expect(result.intervals.length).toBeGreaterThan(0);
    for (const interval of result.intervals) {
      expect(interval.start).toBeLessThanOrEqual(interval.end);
      if (interval.bytes !== null) {
        expect(interval.bytes.length).toBe(interval.end - interval.start + 1);
      }
    }
    expect(result.intervals.some((interval) => interval.id.startsWith("startup.restore"))).toBe(
      false,
    );
    const state = result.program.data.find((data) => data.id === "platform.startup-state");
    expect(state?.bytes).toHaveLength(49);
    expect(result.program.requiredStorage).toEqual([]);
  });

  it("should retain ordinary restoration when metadata is absent", () => {
    const result = layout(withoutMetadata(programFor()));
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Ordinary direct layout must complete");
    expect(result.program.startup.blocks.some(isRestore)).toBe(true);
  });

  it.each(["missing-restore", "duplicate-restore", "empty-restore", "missing-entry", "empty"])(
    "should reject a direct malformed startup when its partition is %s",
    (damage) => {
      const original = withoutMetadata(programFor());
      const restore = original.startup.blocks.find(isRestore);
      if (restore === undefined) throw new Error("Ordinary fixture must contain restoration");
      let blocks: readonly MachineBlock[];
      switch (damage) {
        case "missing-restore":
          blocks = original.startup.blocks.filter((block) => !isRestore(block));
          break;
        case "duplicate-restore":
          blocks = [...original.startup.blocks, restore];
          break;
        case "empty-restore":
          blocks = [
            ...original.startup.blocks.filter((block) => !isRestore(block)),
            { label: "startup.restore", instructions: [], terminator: { kind: "unreachable" } },
          ];
          break;
        case "missing-entry":
          blocks = original.startup.blocks.filter((block) => block.label !== "startup.entry");
          break;
        default:
          blocks = [];
      }
      expect(layout({ ...original, startup: { ...original.startup, blocks } }).kind).toBe("error");
    },
  );

  it.each(["startup.restore", "startup.restore.borrow", "startup.restore.tail"])(
    "should reject a dangling function jump to %s under false metadata",
    (target) => {
      const original = programFor(false);
      const main = original.functions[0];
      const block = main?.blocks[0];
      if (main === undefined || block === undefined) throw new Error("Fixture needs main");
      const replacement: MachineBlock = {
        ...block,
        terminator: {
          kind: "jump",
          opcode: "jmp",
          target,
          cost: machineCost(profileFor().cpu, "jmp", "absolute"),
        },
      };
      expect(layout({ ...original, functions: [{ ...main, blocks: [replacement] }] }).kind).toBe(
        "error",
      );
    },
  );

  it.each(["startup.restore", "startup.restore.tail"])(
    "should reject a dangling address operand for %s under false metadata",
    (label) => {
      const original = programFor(false);
      const main = original.functions[0];
      const block = main?.blocks[0];
      if (main === undefined || block === undefined) throw new Error("Fixture needs main");
      const instruction = machineInstruction(profileFor().cpu, "lda", "immediate", {
        kind: "label",
        label,
        addressByte: "low",
      });
      const replacement = { ...block, instructions: [instruction] };
      expect(layout({ ...original, functions: [{ ...main, blocks: [replacement] }] }).kind).toBe(
        "error",
      );
    },
  );
});
