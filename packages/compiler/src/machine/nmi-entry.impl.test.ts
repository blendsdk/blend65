import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { inventoryStorage } from "../storage/inventory.js";
import { nmiPrivateStorageRoute } from "../storage/nmi-private-storage.js";
import type { StorageRequest } from "../storage/storage-types.js";
import { machineInstruction } from "./lower-control.js";
import { selectedProfile, sourceBinding } from "./lowering-test-support.js";
import type { MachineFunction, MachineInstruction } from "./machine-types.js";
import { createC64NmiEntries } from "./nmi-entry.js";

const profile = selectedProfile();
const variant = profile.interrupts.variants.find(({ id }) => id === "c64_kernal_nminv_chain")!;
const context = { domain: "nmi", irq: 0, nmi: 1 } as const;

/** Use documented instruction effects, not invented register-clobber annotations. */
function instruction(opcode: string, value?: number): MachineInstruction {
  return machineInstruction(
    profile.cpu,
    opcode,
    value === undefined ? "implied" : "immediate",
    value === undefined ? null : { kind: "immediate", value },
  );
}

/** A complete selected body with a real return edge for the wrapper to replace. */
function body(id: string, instructions: readonly MachineInstruction[]): MachineFunction {
  return { id, blocks: [{ label: `${id}.entry`, instructions, terminator: { kind: "return" } }] };
}

/** Exercise the completed machine catalogue and exact selected predecessor binding. */
function wrap(
  instructions: readonly MachineInstruction[],
  callees: readonly MachineFunction[] = [],
  invoked = true,
) {
  return createC64NmiEntries(
    [
      {
        body: body("body", instructions),
        id: "entry",
        variant,
        linkRequestId: "tail",
        handler: sourceBinding(1),
        contexts: invoked ? [context] : [],
      },
    ],
    callees,
    profile,
  );
}

/** Close a real source before injecting a late machine-selected helper demand. */
function scratchInventory() {
  const text = [
    "module Game;",
    "import {setNMI, restoreNMI} from c64.system;",
    "function helper(): void { poke($0400, 7); }",
    "interrupt function handler(): void { helper(); }",
    "function main(): void { setNMI(&handler); restoreNMI(); }",
  ].join("\n");
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "nmi-entry",
      sourceRoot: "src",
      entry: "Game",
      target: profile.id,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: hash("{}"),
      byteLength: 2,
      resolvedPath: "/probe/blend65.json",
    },
    sources: [
      {
        sourceId: "src/game.blend",
        text,
        sha256: hash(text),
        byteLength: Buffer.byteLength(text),
        resolvedPath: "/probe/src/game.blend",
      },
    ],
    inputSha256: hash(text),
    projectRoot: "/probe",
    sourceRoot: "/probe/src",
    assetPaths: [],
    outDir: "/probe/out",
    overrides: { target: null, entry: null },
    effectiveTarget: profile.id,
    effectiveEntry: "Game",
  };
  const analyzed = analyzeProject(snapshot);
  expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
  const semantic = buildSemanticProgram(analyzed);
  expect(semantic.kind).toBe("complete");
  if (semantic.kind !== "complete") throw new Error("Expected semantic source");
  const closed = closeWholeProgram(semantic.program, profile.interrupts, profile.storage);
  expect(closed.kind).toBe("complete");
  if (closed.kind !== "complete") throw new Error("Expected closed source");
  const inventory = inventoryStorage(closed.program);
  const helper = semantic.program.functions.find(
    ({ source }) => source.start === text.indexOf("function helper"),
  );
  expect(helper).toBeDefined();
  if (helper === undefined) throw new Error("Missing source helper");
  const reached = closed.program.interruptContextAnalysis?.contexts
    .get(bindingIdentityKey(helper.id))
    ?.find(({ domain }) => domain === "nmi");
  expect(reached?.activationRoot).toBeDefined();
  const scratch: StorageRequest = {
    id: "late.scratch",
    storageClass: "helper-scratch",
    owner: helper.id,
    domain: "nmi",
    activationRoot: reached!.activationRoot,
    binding: null,
    value: "late.scratch",
    type: null,
    bytes: 2,
    alignment: 1,
    region: "ram",
    lifetime: {
      function: helper.id,
      value: "late.scratch",
      definition: { block: helper.entry, operation: 0 },
      liveAt: [],
      callsCrossed: [],
    },
    source: helper.source,
    reason: "Machine-selected helper scratch",
  };
  return { inventory, scratch };
}

describe("selected NMI machine entries", () => {
  it.each([
    ["empty", [], "jmp", 3, 5, 3],
    ["A", [instruction("lda", 7)], "php pha cld lda pla plp jmp", 8, 21, 5],
    ["X", [instruction("ldx", 7)], "php pha txa pha cld ldx pla tax pla plp jmp", 12, 32, 6],
    ["Y", [instruction("ldy", 7)], "php pha tya pha cld ldy pla tay pla plp jmp", 12, 32, 6],
    [
      "A/X/Y",
      [instruction("lda", 1), instruction("ldx", 2), instruction("ldy", 3)],
      "php pha txa pha tya pha cld lda ldx ldy pla tay pla tax pla plp jmp",
      16,
      43,
      7,
    ],
  ] as const)(
    "saves only the required registers for %s",
    (_name, source, opcodes, bytes, cycles, stack) => {
      const result = wrap(source);
      const entry = result.functions[0]!;
      const code = entry.blocks.flatMap(({ instructions }) => instructions);
      expect(code.map(({ opcode }) => opcode)).toEqual(opcodes.split(" "));
      expect(
        code.reduce((sum, { cost }) => sum + cost.bytes, 0) -
          source.reduce((sum, { cost }) => sum + cost.bytes, 0),
      ).toBe(bytes);
      expect(
        code.reduce((sum, { cost }) => sum + cost.minCycles, 0) -
          source.reduce((sum, { cost }) => sum + cost.minCycles, 0),
      ).toBe(cycles);
      expect(code.at(-1)).toMatchObject({
        opcode: "jmp",
        mode: "indirect",
        operand: { kind: "storage", requestId: "tail", offset: 0 },
      });
      expect(entry.nmiPublicationEntry).toBe(true);
      expect(entry.nmiEntryStackBytes).toBe(stack);
      expect(result.stackDemands).toEqual([
        { id: "entry", handler: sourceBinding(1), contexts: [context], entryStackBytes: stack },
      ]);
      expect(code.filter(({ operand }) => operand?.kind === "storage")).toHaveLength(1);
    },
  );

  it("preserves P and binary mode even when the nonempty body changes no register", () => {
    const code = wrap([instruction("nop")]).functions[0]!.blocks[0]!.instructions;
    expect(code.map(({ opcode }) => opcode)).toEqual(["php", "cld", "nop", "plp", "jmp"]);
  });

  it("finds transitive ordinary callees through both function and block labels", () => {
    const call = (label: string) =>
      machineInstruction(profile.cpu, "jsr", "absolute", { kind: "label", label });
    const result = wrap(
      [call("first.entry")],
      [body("first", [call("second")]), body("second", [instruction("ldx", 9)])],
    );
    expect(result.functions[0]!.blocks[0]!.instructions.map(({ opcode }) => opcode)).toEqual([
      "php",
      "pha",
      "txa",
      "pha",
      "cld",
      "jsr",
      "pla",
      "tax",
      "pla",
      "plp",
      "jmp",
    ]);
    expect(result.stackDemands[0]?.entryStackBytes).toBe(6);
  });

  it.each(["jsr", "jmp"])("conservatively saves A/X/Y for an unknown %s target", (opcode) => {
    const transfer = machineInstruction(
      profile.cpu,
      opcode,
      opcode === "jmp" ? "indirect" : "absolute",
      { kind: "absolute", value: 0x2000 },
    );
    const result = wrap([transfer]);
    expect(
      result.functions[0]!.blocks[0]!.instructions.slice(0, 7).map(({ opcode }) => opcode),
    ).toEqual(["php", "pha", "txa", "pha", "tya", "pha", "cld"]);
    expect(result.stackDemands[0]?.entryStackBytes).toBe(7);
  });

  it("does not invent an invocation demand for a retained address-only entry", () => {
    const result = wrap([], [], false);
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0]?.nmiEntryStackBytes).toBe(3);
    expect(result.stackDemands).toEqual([]);
  });

  it("carries source placement on the complete wrapper", () => {
    const placement = { at: 0x2000, align: 256, noCross: 256, region: null };
    const result = createC64NmiEntries(
      [
        {
          body: { ...body("body", []), placement },
          id: "entry",
          variant,
          linkRequestId: "tail",
          handler: sourceBinding(1),
          contexts: [context],
        },
      ],
      [],
      profile,
    );
    expect(result.functions[0]?.placement).toEqual(placement);
  });

  it("rejects late selected private scratch without confusing a persistent home with a link", () => {
    const { inventory, scratch } = scratchInventory();
    expect(nmiPrivateStorageRoute(inventory)).toBeNull();
    const route = inventory.program.interruptRoutes?.find(({ sink }) => sink.domain === "nmi");
    expect(route).toBeDefined();
    for (const request of [
      scratch,
      { ...scratch, persistent: true },
      { ...scratch, id: inventory.program.interruptContextAnalysis!.bindings.keys().next().value! },
    ]) {
      expect(
        nmiPrivateStorageRoute({ ...inventory, requests: [...inventory.requests, request] }),
      ).toBe(route);
    }
    expect(
      nmiPrivateStorageRoute({
        ...inventory,
        requests: [...inventory.requests, { ...scratch, bytes: 0 }],
      }),
    ).toBeNull();
    expect(
      nmiPrivateStorageRoute({
        ...inventory,
        requests: [...inventory.requests, { ...scratch, activationRoot: "unentered" }],
      }),
    ).toBeNull();
  });
});
