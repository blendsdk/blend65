import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { bindMachineProgram } from "../machine/bind.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticBlock, SemanticFunction, SemanticProgram } from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { closeStorage } from "./closure.js";
import type {
  StorageBinder,
  StorageInventory,
  StorageProfile,
  StorageRequest,
} from "./storage-types.js";

const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
const VOID: SemanticType = Object.freeze({ kind: "scalar", name: "void" });

function span(start: number): SourceSpan {
  return Object.freeze({ sourceId: "src/closure-integration.blend", start, end: start + 1 });
}

function binding(start: number): BindingId {
  return Object.freeze({ sourceId: "src/closure-integration.blend", span: span(start) });
}

function fn(id: BindingId, callees: readonly BindingId[] = []): SemanticFunction {
  const operations = callees.map((callee, index) =>
    Object.freeze({
      kind: "call" as const,
      result: null,
      callee,
      arguments: Object.freeze([]),
      type: VOID,
      span: span(id.span.start + index + 20),
    }),
  );
  const block: SemanticBlock = Object.freeze({
    id: `fn-${id.span.start}:entry`,
    operations: Object.freeze(operations),
    terminator: Object.freeze({ kind: "return" as const, value: null }),
  });
  return Object.freeze({
    id,
    name: `fn${id.span.start}`,
    parameters: Object.freeze([]),
    result: VOID,
    entry: block.id,
    blocks: Object.freeze([block]),
    source: id.span,
  });
}

function wholeProgram(functions: readonly SemanticFunction[]): WholeProgram {
  const semantic: SemanticProgram = Object.freeze({
    main: functions[0]!.id,
    globals: Object.freeze([]),
    functions: Object.freeze(functions),
    assets: Object.freeze([]),
    initializerOrder: Object.freeze([]),
  });
  return Object.freeze({
    semantic,
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: functions[0]!.id }),
    ]),
    callGraph: Object.freeze(
      functions.map((functionValue) =>
        Object.freeze({
          function: functionValue.id,
          callees: Object.freeze(
            functionValue.blocks[0]!.operations.flatMap((operation) =>
              operation.kind === "call" ? [operation.callee] : [],
            ),
          ),
        }),
      ),
    ),
    effects: Object.freeze([]),
    lifetimes: Object.freeze([]),
    reachableFunctions: Object.freeze(functions.map(({ id }) => id)),
    reachableAssets: Object.freeze([]),
  });
}

function lifetime(owner: BindingId, value: string): ValueLifetime {
  return Object.freeze({
    function: owner,
    value,
    definition: Object.freeze({ block: "main:entry", operation: 0 }),
    liveAt: Object.freeze([Object.freeze({ block: "main:entry", operation: 1 })]),
    callsCrossed: Object.freeze([]),
  });
}

function inventory(program: WholeProgram, requests: readonly StorageRequest[]): StorageInventory {
  return Object.freeze({
    program,
    requests: Object.freeze(requests),
    results: Object.freeze([]),
  });
}

function profile(interruptStackBytes = 0): StorageProfile {
  return Object.freeze({
    profileId: "c64-pal-prg-kernal-6581",
    zeroPage: Object.freeze([Object.freeze({ start: 0x02, end: 0x7f })]),
    ram: Object.freeze([Object.freeze({ start: 0x2000, end: 0x20ff })]),
    hardwareStackCapacity: 0x100,
    hardwareStackReserve: 16,
    interruptStackBytes,
  });
}

describe("machine storage closure integration", () => {
  // One finite late spill causes one re-close and the following stable round freezes it.
  it("should add one declared spill and bind it only after a stable closure certificate", () => {
    const main = fn(binding(1));
    const program = wholeProgram([main]);
    const spill: StorageRequest = Object.freeze({
      id: "spill:main:add",
      storageClass: "spill",
      owner: main.id,
      binding: null,
      value: "add-result",
      type: BYTE,
      bytes: 1,
      alignment: 1,
      region: "ram",
      lifetime: lifetime(main.id, "add-result"),
      source: span(30),
      reason: "Accumulator value must survive resource binding",
    });
    const rounds: number[] = [];
    const binder: StorageBinder = Object.freeze({
      candidateRequestIds: Object.freeze([spill.id]),
      helperCalls: Object.freeze([]),
      discover: (_placement, round) => {
        rounds.push(round);
        return Object.freeze([spill]);
      },
    });

    const closure = closeStorage(inventory(program, []), profile(), binder);

    expect(closure.kind).toBe("complete");
    if (closure.kind !== "complete") throw new Error("Expected storage closure to stabilize");
    expect(rounds).toEqual([0, 1]);
    expect(closure.inventory.requests).toEqual([spill]);
    expect(closure.certificate.closed).toBe(true);
    expect(closure.certificate.homes).toHaveLength(1);

    const machineProgram = Object.freeze({
      functions: Object.freeze([
        Object.freeze({
          id: "main",
          blocks: Object.freeze([
            Object.freeze({
              label: "main.entry",
              instructions: Object.freeze([
                Object.freeze({
                  opcode: "lda",
                  mode: "storage",
                  operand: Object.freeze({ kind: "storage", requestId: spill.id }),
                  uses: Object.freeze({ registers: Object.freeze([]), flags: Object.freeze([]) }),
                  defines: Object.freeze({
                    registers: Object.freeze(["a"]),
                    flags: Object.freeze(["n", "z"]),
                  }),
                  memory: Object.freeze([]),
                  cost: Object.freeze({ bytes: 2, minCycles: 3, maxCycles: 3 }),
                  source: span(30),
                }),
              ]),
              terminator: Object.freeze({ kind: "return" }),
            }),
          ]),
        }),
      ]),
      data: Object.freeze([]),
      startup: Object.freeze({ id: "startup", blocks: Object.freeze([]) }),
      requiredStorage: Object.freeze([spill]),
    });
    const bound = bindMachineProgram(machineProgram, closure.certificate);

    expect(bound.kind).toBe("complete");
    if (bound.kind !== "complete") throw new Error("Expected certified storage to bind");
    expect(JSON.stringify(bound.program)).not.toContain('"kind":"storage"');
    expect(JSON.stringify(bound.program)).toContain(String(closure.certificate.homes[0]!.address));
    expect(bound.program.requiredStorage).toEqual([spill]);
  });

  // Stack proof combines real nested return addresses with the cooperative IRQ save margin.
  it("should include direct call nesting and the cooperative interrupt margin in stack peak", () => {
    const leaf = fn(binding(103));
    const middle = fn(binding(102), [leaf.id]);
    const main = fn(binding(101), [middle.id]);

    const result = closeStorage(
      inventory(wholeProgram([main, middle, leaf]), []),
      profile(9),
      Object.freeze({
        candidateRequestIds: Object.freeze([]),
        helperCalls: Object.freeze([]),
        discover: () => Object.freeze([]),
      }),
    );

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected stack proof to close");
    expect(result.certificate.hardwareStackPeak).toBe(13);
    expect(result.certificate.hardwareStackPeak).toBeLessThanOrEqual(0x100 - 16);
  });
});
