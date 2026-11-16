import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { analyzeProjectOverlay, loadProject } from "../frontend/index.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import type { SemanticFunction } from "../semantic/operations.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import { machineCost, machineInstruction } from "./lower-control.js";
import { lowerMachineProgram } from "./lower.js";
import { omitUnreachableRestore } from "./lower-startup.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineLoweringInput,
  MachineTerminator,
} from "./machine-types.js";

/** A real closed source certificate is shared; each graph mutation remains test-owned. */
interface Fixture {
  /** Closed source, profile and original storage declarations. */
  readonly input: MachineLoweringInput;
  /** Actual immutable main body from that source program. */
  readonly source: SemanticFunction;
  /** Selected machine body before test-owned graph mutations. */
  readonly main: MachineFunction;
}

let fixture: Fixture | undefined;

beforeAll(async () => {
  const project = fileURLToPath(
    new URL("../../../../examples/boing-ball/blend65.json", import.meta.url),
  );
  const loaded = await loadProject({ project });
  if (loaded.kind !== "success") throw new Error("Expected example input");
  const analyzed = await analyzeProjectOverlay(loaded.snapshot, []);
  if (analyzed.kind !== "complete") throw new Error("Expected frontend result");
  const semantic = buildSemanticProgram(analyzed);
  if (semantic.kind !== "complete") throw new Error("Expected semantic program");
  const selected = selectTargetProfile(loaded.snapshot.effectiveTarget);
  if (selected.kind !== "complete") throw new Error("Expected selected profile");
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error("Expected closed program");
  const logicalStorage = inventoryStorage(closed.program);
  const allocation = allocateStorage(
    logicalStorage,
    buildInterference(logicalStorage),
    selected.profile.storage,
  );
  if (allocation.kind !== "complete") throw new Error("Expected provisional allocation");
  const input: MachineLoweringInput = {
    program: closed.program,
    profile: selected.profile,
    logicalStorage,
    placement: allocation.placement,
  };
  const lowered = lowerMachineProgram(input);
  if (lowered.kind !== "complete") throw new Error("Expected selected machine program");
  const key = bindingIdentityKey(closed.program.semantic.main);
  const source = closed.program.semantic.functions.find((fn) => bindingIdentityKey(fn.id) === key);
  const main = lowered.program.functions[0];
  if (source === undefined || main === undefined) throw new Error("Expected actual main");
  fixture = { input, source, main };
});

/** Require successful setup without casting an uninitialized test variable. */
function current(): Fixture {
  if (fixture === undefined) throw new Error("Fixture was not initialized");
  return fixture;
}

/** Replace only one selected entry edge; source returnability is intentionally unchanged. */
function withEntry(terminator: MachineTerminator): MachineFunction {
  const { main } = current();
  return {
    ...main,
    blocks: main.blocks.map((block, index) => (index === 0 ? { ...block, terminator } : block)),
  };
}

/** Form one ordinary absolute edge using real CPU cost facts. */
function jump(target: string): MachineTerminator {
  return {
    kind: "jump",
    opcode: "jmp",
    target,
    cost: machineCost(current().input.profile.cpu, "jmp", "absolute"),
  };
}

describe("selected-machine dead restore boundaries", () => {
  it("should preserve input identities and instructions while replacing only a cold return edge", () => {
    const { input, source, main } = current();
    const cold: MachineBlock = {
      label: "cold.return",
      instructions: [],
      terminator: jump("startup.restore"),
    };
    const selected = { ...main, blocks: [...main.blocks, cold] };
    const result = omitUnreachableRestore(input, source, [selected]);
    expect(result).not.toBeNull();
    expect(result?.[0]?.blocks.at(-1)?.terminator.kind).toBe("unreachable");
    expect(cold.terminator.kind).toBe("jump");
    expect(source).toBe(input.program.semantic.functions.find((fn) => fn === source));
    for (const [index, block] of main.blocks.entries()) {
      expect(result?.[0]?.blocks[index]).toBe(block);
      expect(result?.[0]?.blocks[index]?.instructions).toBe(block.instructions);
    }
  });

  it.each(["startup.restore", "startup.restore.borrow", "startup.restore.tail", "unknown.edge"])(
    "should retain restoration when a reachable selected edge names %s",
    (target) => {
      const { input, source } = current();
      expect(omitUnreachableRestore(input, source, [withEntry(jump(target))])).toBeNull();
    },
  );

  it("should not let a false source summary override a selected return or branch edge", () => {
    const { input, source, main } = current();
    expect(omitUnreachableRestore(input, source, [withEntry({ kind: "return" })])).toBeNull();
    expect(
      omitUnreachableRestore(input, source, [
        withEntry({
          kind: "branch",
          opcode: "bne",
          target: main.blocks[0]!.label,
          fallthrough: "startup.restore",
          cost: machineCost(input.profile.cpu, "bne", "relative"),
        }),
      ]),
    ).toBeNull();
  });

  it("should decline metadata-only, cloned-source, missing-entry and duplicate-label inputs", () => {
    const { input, source, main } = current();
    expect(omitUnreachableRestore({ ...input, metadataOnly: true }, source, [main])).toBeNull();
    expect(omitUnreachableRestore(input, { ...source }, [main])).toBeNull();
    expect(omitUnreachableRestore(input, source, [{ ...main, blocks: [] }])).toBeNull();
    expect(
      omitUnreachableRestore(input, source, [
        { ...main, blocks: [...main.blocks, main.blocks[0]!] },
      ]),
    ).toBeNull();
    expect(omitUnreachableRestore(input, source, [{ ...main, id: "another.main" }])).toBeNull();
    expect(omitUnreachableRestore(input, source, [main, { id: "helper", blocks: [] }])).toBeNull();
  });

  it.each(["startup.restore", "startup.restore.tail"])(
    "should retain an address operand naming %s even in an unreachable block",
    (label) => {
      const { input, source, main } = current();
      const cold: MachineBlock = {
        label: "cold.address",
        instructions: [
          machineInstruction(input.profile.cpu, "lda", "immediate", {
            kind: "label",
            label,
            addressByte: "low",
          }),
        ],
        terminator: { kind: "unreachable" },
      };
      expect(
        omitUnreachableRestore(input, source, [{ ...main, blocks: [...main.blocks, cold] }]),
      ).toBeNull();
    },
  );

  it("should keep compiler-generated calls outside the single-body specialization", () => {
    const { input, source, main } = current();
    const cold: MachineBlock = {
      label: "cold.call",
      instructions: [
        machineInstruction(input.profile.cpu, "jsr", "absolute", {
          kind: "label",
          label: "helper",
        }),
      ],
      terminator: { kind: "unreachable" },
    };
    expect(
      omitUnreachableRestore(input, source, [{ ...main, blocks: [...main.blocks, cold] }]),
    ).toBeNull();
  });

  it("should walk a long finite graph without recursion or a guessed iteration cap", () => {
    const { input, source, main } = current();
    const blocks: MachineBlock[] = Array.from({ length: 6000 }, (_, index) => ({
      label: `long.${index}`,
      instructions: [],
      terminator: jump(`long.${Math.min(index + 1, 5999)}`),
    }));
    blocks.push({ label: "long.cold", instructions: [], terminator: jump("startup.restore") });
    const result = omitUnreachableRestore(input, source, [{ ...main, blocks }]);
    expect(result?.[0]?.blocks).toHaveLength(6001);
    expect(result?.[0]?.blocks.at(-1)?.terminator.kind).toBe("unreachable");
  });
});
