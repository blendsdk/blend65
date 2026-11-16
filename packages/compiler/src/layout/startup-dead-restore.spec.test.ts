import { describe, expect, it } from "vitest";
import { machineCost } from "../machine/lower-control.js";
import type { MachineProgram } from "../machine/machine-types.js";
import type { StorageHome } from "../storage/storage-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { bindC64StartupState, createC64Startup, createC64StartupStateData } from "./startup.js";

const COOPERATIVE = "c64-pal-prg-kernal-6581";
const TAKEOVER = "c64-pal-prg-takeover-6581";

/** Resolve real platform facts rather than reproducing CPU or storage tables. */
function profileFor(id = COOPERATIVE) {
  const result = selectTargetProfile(id);
  if (result.kind !== "complete") throw new Error("Fixture profile must exist");
  return result.profile;
}

/** Omission is deliberately distinct from supplying either Boolean value. */
function configuration(restoreRequired?: boolean, takeover = false) {
  return {
    initializerLabels: [],
    mainLabel: "main",
    startupPolicy: takeover ? ("takeover" as const) : ("full" as const),
    ...(restoreRequired === undefined ? {} : { restoreRequired }),
  };
}

/** Keep construction failures separate from a failed behavioral assertion. */
function construct(restoreRequired?: boolean, takeover = false) {
  const input = {
    ...configuration(restoreRequired, takeover),
    profile: profileFor(takeover ? TAKEOVER : COOPERATIVE),
  };
  const result = createC64Startup(input);
  if (result.kind !== "complete") throw new Error("Startup fixture must construct");
  return result;
}

/** The entry partition ends where restoration begins, including any restore tail blocks. */
function entryBlocks(program: MachineProgram["startup"]) {
  const index = program.blocks.findIndex((block) => block.label === "startup.restore");
  return index < 0 ? program.blocks : program.blocks.slice(0, index);
}

/** Restore tails belong to restoration too; checking only its first block would be incomplete. */
function restoreBlocks(program: MachineProgram["startup"]) {
  return program.blocks.filter(
    (block) => block.label === "startup.restore" || block.label.startsWith("startup.restore."),
  );
}

/** A storage-free main loop isolates startup rebinding from function-storage allocation. */
function programFor(restoreRequired?: boolean): MachineProgram {
  const profile = profileFor();
  return {
    startup: construct(restoreRequired).startup,
    c64Startup: configuration(restoreRequired),
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
    data: [createC64StartupStateData(configuration(restoreRequired))],
    requiredStorage: [],
  };
}

describe("cooperative startup with unreachable restoration", () => {
  it("should omit only restoration when the internal fact is false", () => {
    const ordinary = construct();
    const selected = construct(false);
    expect(restoreBlocks(ordinary.startup).length).toBeGreaterThan(0);
    expect(restoreBlocks(selected.startup)).toEqual([]);
    expect(entryBlocks(selected.startup)).toEqual(entryBlocks(ordinary.startup));
    expect(selected.startup.origin).toBe(0x080d);
    expect(selected.stub).toEqual(ordinary.stub);
    expect(selected.stackDemand).toEqual(ordinary.stackDemand);
    expect(selected.entries).toEqual(ordinary.entries);
  });

  it("should preserve the ordinary constructor when the fact is omitted or true", () => {
    expect(construct(true)).toEqual(construct());
    expect(restoreBlocks(construct().startup).length).toBeGreaterThan(0);
  });

  it("should preserve all snapshot bytes when restoration alone is omitted", () => {
    const ordinary = createC64StartupStateData(configuration());
    const selected = createC64StartupStateData(configuration(false));
    expect(ordinary.bytes).toHaveLength(49);
    expect(selected).toEqual(ordinary);
  });

  it("should leave takeover construction unchanged when the fact is false", () => {
    expect(construct(false, true)).toEqual(construct(undefined, true));
    expect(createC64StartupStateData(configuration(false, true), "takeover")).toEqual(
      createC64StartupStateData(configuration(undefined, true), "takeover"),
    );
  });

  it("should retain the fact and absent restoration through borrowed-home rebinding", () => {
    const profile = profileFor();
    const range = profile.storage.zeroPage[0];
    if (range === undefined) throw new Error("Fixture needs a zero-page window");
    const homes: readonly StorageHome[] = [
      { requestId: "fixture.borrow", address: range.start, bytes: 1, region: "zero-page" },
    ];
    const ordinary = bindC64StartupState(programFor(), homes, profile);
    const selected = bindC64StartupState(programFor(false), homes, profile);
    expect(ordinary).not.toBeNull();
    expect(selected).not.toBeNull();
    if (ordinary === null || selected === null) throw new Error("Valid state must bind");
    expect(selected.c64Startup).toMatchObject({ restoreRequired: false });
    expect(restoreBlocks(selected.startup)).toEqual([]);
    expect(entryBlocks(selected.startup)).toEqual(entryBlocks(ordinary.startup));
    expect(selected.data).toEqual(ordinary.data);
    expect(selected.requiredStorage).toEqual(ordinary.requiredStorage);
  });

  it.each([undefined, true])(
    "should repair a removed restore partition before rebinding when the fact is %s",
    (fact) => {
      const original = programFor(fact);
      const damaged = {
        ...original,
        startup: { ...original.startup, blocks: entryBlocks(original.startup) },
      };
      const rebound = bindC64StartupState(damaged, [], profileFor());
      expect(rebound).not.toBeNull();
      if (rebound === null) throw new Error("Valid snapshots must allow regeneration");
      expect(restoreBlocks(rebound.startup).length).toBeGreaterThan(0);
      expect(rebound.startup).toEqual(original.startup);
    },
  );

  it.each(["short", "long", "invalid-byte"] as const)(
    "should reject malformed snapshot data when it is %s despite the false fact",
    (damage) => {
      const original = programFor(false);
      const state = original.data[0];
      if (state === undefined) throw new Error("Fixture needs startup state");
      const bytes =
        damage === "short"
          ? state.bytes.slice(1)
          : damage === "long"
            ? [...state.bytes, 0]
            : [256, ...state.bytes.slice(1)];
      expect(
        bindC64StartupState({ ...original, data: [{ ...state, bytes }] }, [], profileFor()),
      ).toBeNull();
    },
  );
});
