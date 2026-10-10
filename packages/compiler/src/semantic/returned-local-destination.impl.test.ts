import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ArrayType } from "../frontend/semantic-types.js";
import { appendConstantConstruction } from "../machine/lower-aggregate-members.js";
import { machineInstruction } from "../machine/lower-control.js";
import type { MachineInstruction } from "../machine/machine-types.js";
import {
  BYTE,
  WORD,
  VOID,
  selectedProfile,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
  wholeProgramFor,
} from "../machine/lowering-test-support.js";
import { inventoryStorage } from "../storage/inventory.js";
import type { SemanticOperation, SemanticProgram } from "./operations.js";
import {
  freshReturnedLocalCallers,
  proveReturnedLocalDestinations,
  returnedLocalCandidate,
} from "./returned-local-destination.js";
import { closeWholeProgram } from "./whole-program.js";

const TYPE: ArrayType = { kind: "array", element: BYTE, length: 2, size: 2 };
const LOCAL = sourceBinding(100);
const RECEIVED = sourceBinding(200);
const PLACE = { root: LOCAL, rootType: TYPE, path: [] };
const SPAN = sourceSpan(4);
const POINTER = "make:pointer:aggregate-return-destination";

/** Use official instruction metadata for the certified private construction consumer. */
function immediate(opcode: "lda" | "ldy", value: number): MachineInstruction {
  return machineInstruction(
    selectedProfile().cpu,
    opcode,
    "immediate",
    { kind: "immediate", value },
    [],
    SPAN,
  );
}

/** Keep the destination pointer identity explicit independently of instruction spelling. */
function pointerOperation(
  opcode: "sta" | "inc" | "dec",
  requestId = POINTER,
  offset = 1,
): MachineInstruction {
  return machineInstruction(
    selectedProfile().cpu,
    opcode,
    opcode === "sta" ? "indirect-indexed-y" : "storage",
    opcode === "sta"
      ? { kind: "indirect-y", requestId, offset: 0 }
      : { kind: "storage", requestId, offset },
    [],
    SPAN,
  );
}

/** Build real semantic records with a complete or deliberately partial literal. */
function fixture(partial = false, extra: readonly SemanticOperation[] = []): SemanticProgram {
  const make = semanticFunction(10, "make", [], TYPE, [
    semanticBlock(
      "make",
      [
        { kind: "constant", result: "zero", value: 7n, type: BYTE, integer: null, span: SPAN },
        {
          kind: "aggregate",
          result: "literal",
          type: TYPE,
          elements: Array.from({ length: partial ? 1 : 2 }, () => ({ field: null, value: "zero" })),
          fill: null,
          destination: { kind: "place", place: PLACE, freshLocal: true, freshConstant: true },
          integer: null,
          span: SPAN,
        },
        { kind: "store", place: PLACE, value: "literal", type: TYPE, span: SPAN },
        ...extra,
        {
          kind: "place-address",
          result: "return",
          place: PLACE,
          type: TYPE,
          integer: null,
          span: SPAN,
        },
      ],
      { kind: "return", value: "return" },
    ),
  ]);
  const destination = {
    kind: "place" as const,
    place: { root: RECEIVED, rootType: TYPE, path: [] },
    freshLocal: true as const,
  };
  const main = semanticFunction(0, "main", [], VOID, [
    semanticBlock(
      "main",
      [
        {
          kind: "call",
          result: "received",
          callee: make.id,
          arguments: [],
          type: TYPE,
          aggregateDestination: destination,
          span: SPAN,
        },
        { kind: "store", place: destination.place, value: "received", type: TYPE, span: SPAN },
      ],
      { kind: "return", value: null },
    ),
  ]);
  const program = wholeProgramFor([main, make]).semantic;
  return {
    ...program,
    effects: [main, make].map((fn) => ({
      function: fn.id,
      reads: [],
      writes: [],
      operationEffects: [],
      opaque: extra.some(({ kind }) => kind === "memory-read" || kind === "memory-write"),
    })),
  };
}

/** Select the real closed profile/domain facts; a failed closure is not a proof pass. */
function close(input: SemanticProgram) {
  const profile = selectedProfile();
  const result = closeWholeProgram(input, profile.interrupts, profile.storage);
  if (result.kind !== "complete") throw new Error(JSON.stringify(result));
  return result.program;
}

/** Alter only one function's operations while preserving all other fixture records. */
function replaceOperations(
  input: SemanticProgram,
  name: string,
  replace: (operations: readonly SemanticOperation[]) => readonly SemanticOperation[],
): SemanticProgram {
  return {
    ...input,
    functions: input.functions.map((fn) =>
      fn.name !== name
        ? fn
        : {
            ...fn,
            blocks: fn.blocks.map((block) => ({ ...block, operations: replace(block.operations) })),
          },
    ),
  };
}

describe("returned-local body and storage guard internals", () => {
  it("should omit only the certified local while retaining the caller and pointer", () => {
    const program = close(fixture());
    expect(program.returnedLocalDestinations).toEqual([
      { function: sourceBinding(10), local: LOCAL },
    ]);
    expect(Object.isFrozen(program.returnedLocalDestinations)).toBe(true);
    const requests = inventoryStorage(program).requests;
    expect(
      requests.some(
        ({ binding }) =>
          binding !== null && bindingIdentityKey(binding) === bindingIdentityKey(LOCAL),
      ),
    ).toBe(false);
    expect(requests).toContainEqual(
      expect.objectContaining({ binding: RECEIVED, bytes: 2, storageClass: "local" }),
    );
    expect(requests).toContainEqual(
      expect.objectContaining({ owner: sourceBinding(10), bytes: 2, storageClass: "pointer" }),
    );
  });

  it("should preserve partial semantic operations and the complete original local inventory", () => {
    const input = fixture(true);
    const make = input.functions[1]!;
    const before = structuredClone(make.blocks);
    const program = close(input);
    expect(program.returnedLocalDestinations).toBeUndefined();
    expect(program.semantic.functions.find(({ name }) => name === "make")?.blocks).toBe(
      make.blocks,
    );
    expect(make.blocks).toEqual(before);
    expect(inventoryStorage(program).requests).toContainEqual(
      expect.objectContaining({ binding: LOCAL, storageClass: "local", bytes: 2 }),
    );
  });

  it.each(["freshLocal", "freshConstant"] as const)(
    "should retain fallback without %s body metadata",
    (field) => {
      const input = replaceOperations(fixture(), "make", (operations) =>
        operations.map((operation) => {
          if (operation.kind !== "aggregate" || operation.destination?.kind !== "place")
            return operation;
          const destination = { ...operation.destination };
          delete destination[field];
          return { ...operation, destination };
        }),
      );
      expect(close(input).returnedLocalDestinations).toBeUndefined();
    },
  );

  it("should reject a returned-address merge even when it eventually stays local", () => {
    const input = replaceOperations(fixture(), "make", (operations) => [
      ...operations,
      {
        kind: "merge",
        result: "aliased",
        incoming: [{ block: "make", value: "return" }],
        type: TYPE,
        integer: null,
        span: SPAN,
      },
    ]);
    expect(returnedLocalCandidate(input.functions[1]!)).toBeUndefined();
  });
});

describe("returned-local caller and observer internals", () => {
  it.each(["caller", "helper", "initializer"])(
    "should retain fallback for persistent hardware publication in the %s",
    (context) => {
      const publication: SemanticOperation[] = [
        {
          kind: "constant",
          result: "selector",
          value: 0xd018n,
          type: WORD,
          integer: null,
          span: SPAN,
        },
        {
          kind: "constant",
          result: "selection",
          value: 0x28n,
          type: BYTE,
          integer: null,
          span: SPAN,
        },
        {
          kind: "memory-write",
          address: "selector",
          value: "selection",
          width: 1,
          byteOrder: "low-first",
          volatile: true,
          span: SPAN,
        },
      ];
      let input = fixture();
      if (context === "caller") {
        input = replaceOperations(input, "main", (operations) => [...publication, ...operations]);
      } else if (context === "helper") {
        const helper = semanticFunction(30, "configure", [], VOID, [
          semanticBlock("configure", publication, { kind: "return", value: null }),
        ]);
        input = replaceOperations(input, "main", (operations) => [
          { kind: "call", result: null, callee: helper.id, arguments: [], type: VOID, span: SPAN },
          ...operations,
        ]);
        input = {
          ...input,
          functions: [...input.functions, helper],
          effects: [
            ...input.effects!,
            { function: helper.id, reads: [], writes: [], operationEffects: [], opaque: true },
          ],
        };
      } else {
        const id = sourceBinding(30);
        input = {
          ...input,
          globals: [
            {
              id,
              storage: "module",
              exported: false,
              type: BYTE,
              initialBytes: null,
              runtimeInitialBytes: null,
              entry: "configure",
              blocks: [semanticBlock("configure", publication, { kind: "return", value: null })],
              source: SPAN,
            },
          ],
          initializerOrder: [id],
        };
      }
      expect(close(input).returnedLocalDestinations).toBeUndefined();
    },
  );

  it("should reject additional address uses and captured terminal bytes", () => {
    const extra: SemanticOperation = {
      kind: "place-address",
      result: "address",
      place: PLACE,
      type: TYPE,
      integer: null,
      span: SPAN,
    };
    expect(close(fixture(false, [extra])).returnedLocalDestinations).toBeUndefined();
    const input = replaceOperations(fixture(), "make", (operations) =>
      operations.map((operation) =>
        operation.kind === "place-address" ? { ...operation, captureValue: true } : operation,
      ),
    );
    expect(close(input).returnedLocalDestinations).toBeUndefined();
  });

  it("should reject the whole callee for one caller missing fresh origin", () => {
    const input = replaceOperations(fixture(), "main", (operations) =>
      operations.flatMap<SemanticOperation>((operation) =>
        operation.kind !== "call"
          ? [operation]
          : [
              operation,
              {
                ...operation,
                result: "second",
                aggregateDestination: {
                  kind: "place",
                  place: { root: sourceBinding(201), rootType: TYPE, path: [] },
                },
              },
            ],
      ),
    );
    expect(close(input).returnedLocalDestinations).toBeUndefined();
  });

  it("should reject unknown and cyclic argument definitions rather than assuming no alias", () => {
    for (const cyclic of [false, true]) {
      const input = replaceOperations(fixture(), "main", (operations) => [
        ...(cyclic
          ? [
              {
                kind: "convert" as const,
                result: "cycle",
                operand: "cycle",
                conversion: "identity" as const,
                type: BYTE,
                integer: null,
                span: SPAN,
              },
            ]
          : []),
        ...operations.map((operation) =>
          operation.kind === "call"
            ? { ...operation, arguments: [cyclic ? "cycle" : "missing"] }
            : operation,
        ),
      ]);
      const closed = close(input);
      expect(freshReturnedLocalCallers(closed).has(bindingIdentityKey(sourceBinding(10)))).toBe(
        false,
      );
    }
  });

  it("should distinguish known disjoint MMIO from an unknown raw observer", () => {
    const read: SemanticOperation = {
      kind: "memory-read",
      result: "observed",
      address: "address",
      width: 1,
      byteOrder: "low-first",
      volatile: true,
      type: BYTE,
      integer: null,
      span: SPAN,
    };
    expect(close(fixture(false, [read])).returnedLocalDestinations).toBeUndefined();
    const address: SemanticOperation = {
      kind: "constant",
      result: "address",
      value: 0xd020n,
      type: WORD,
      integer: null,
      span: SPAN,
    };
    expect(close(fixture(false, [address, read])).returnedLocalDestinations).toHaveLength(1);
  });

  it("should retain every current entry domain's pointer but not invent a destination variant", () => {
    const closed = close(fixture());
    const program = {
      ...closed,
      executionDomains: closed.executionDomains!.map((entry) =>
        bindingIdentityKey(entry.function) === bindingIdentityKey(sourceBinding(10))
          ? { ...entry, domains: ["main" as const, "irq" as const] }
          : entry,
      ),
    };
    const requests = inventoryStorage(program).requests.filter(
      ({ owner }) => bindingIdentityKey(owner) === bindingIdentityKey(sourceBinding(10)),
    );
    expect(
      requests
        .filter(({ storageClass }) => storageClass === "pointer")
        .map(({ domain }) => domain)
        .sort(),
    ).toEqual(["irq", "main"]);
    expect(
      requests.some(
        ({ binding }) =>
          binding !== null && bindingIdentityKey(binding) === bindingIdentityKey(LOCAL),
      ),
    ).toBe(false);
    expect(program.returnedLocalDestinations).toBe(closed.returnedLocalDestinations);
  });

  it("should keep proof order stable and preserve fallback when closure/profile facts are absent", () => {
    const input = fixture();
    const first = close(input);
    expect(close(input).returnedLocalDestinations).toEqual(first.returnedLocalDestinations);
    const profile = selectedProfile();
    expect(proveReturnedLocalDestinations(first)).toEqual([]);
    expect(
      proveReturnedLocalDestinations({ ...first, executionDomains: undefined }, profile.storage),
    ).toEqual([]);
    expect(
      proveReturnedLocalDestinations(
        { ...first, interruptContextAnalysis: undefined },
        profile.storage,
      ),
    ).toEqual([]);
    expect(
      proveReturnedLocalDestinations(first, {
        ram: profile.storage.ram,
        zeroPage: profile.storage.zeroPage,
      }),
    ).toEqual([]);
  });
});

describe("certified constant construction selection", () => {
  it("should retain exact consecutive Y offsets across the private page step", () => {
    const selected = [
      immediate("ldy", 254),
      pointerOperation("sta"),
      immediate("ldy", 255),
      pointerOperation("sta"),
      pointerOperation("inc"),
      immediate("lda", 0),
      immediate("ldy", 0),
      pointerOperation("sta"),
      immediate("ldy", 1),
      pointerOperation("sta"),
      pointerOperation("dec"),
    ];
    const before = structuredClone(selected);
    const target: MachineInstruction[] = [];
    expect(appendConstantConstruction(target, selected, 0, POINTER)).toBe(0);
    expect(target.map(({ opcode }) => opcode)).toEqual([
      "ldy",
      "sta",
      "iny",
      "sta",
      "inc",
      "iny",
      "sta",
      "iny",
      "sta",
      "dec",
    ]);
    const expected = machineInstruction(selectedProfile().cpu, "iny", "implied", null, [], SPAN);
    expect(target.filter(({ opcode }) => opcode === "iny")).toEqual([expected, expected, expected]);
    expect(target.filter(({ opcode }) => opcode === "sta")).toEqual(
      selected.filter(({ opcode }) => opcode === "sta"),
    );
    expect(selected).toEqual(before);
  });

  it.each(["status", "foreign-store", "wrong-pointer-byte", "volatile-store"])(
    "should discard both facts at the %s barrier",
    (kind) => {
      const barrier =
        kind === "status"
          ? machineInstruction(selectedProfile().cpu, "clc", "implied", null, [], SPAN)
          : kind === "foreign-store"
            ? pointerOperation("sta", "foreign")
            : kind === "wrong-pointer-byte"
              ? pointerOperation("inc", POINTER, 0)
              : {
                  ...pointerOperation("sta"),
                  memory: [
                    {
                      kind: "write" as const,
                      address: { kind: "indirect-y" as const, requestId: POINTER, offset: 0 },
                      width: 1 as const,
                      volatile: true,
                      order: 0,
                    },
                  ],
                };
      const target: MachineInstruction[] = [];
      appendConstantConstruction(
        target,
        [
          immediate("lda", 0),
          immediate("ldy", 0),
          pointerOperation("sta"),
          barrier,
          immediate("lda", 0),
          immediate("ldy", 1),
          pointerOperation("sta"),
        ],
        null,
        POINTER,
      );
      expect(target.filter(({ opcode }) => opcode === "lda")).toHaveLength(2);
      expect(target.filter(({ opcode }) => opcode === "ldy")).toHaveLength(2);
      expect(target.some(({ opcode }) => opcode === "iny")).toBe(false);
    },
  );

  it("should keep unrelated targets and separate selections conservative", () => {
    const target: MachineInstruction[] = [];
    appendConstantConstruction(target, [immediate("ldy", 0)], null, POINTER);
    appendConstantConstruction(target, [immediate("ldy", 1)], null, POINTER);
    appendConstantConstruction(target, [immediate("ldy", 0), immediate("ldy", 1)], null, "direct");
    expect(target.map(({ opcode }) => opcode)).toEqual(["ldy", "ldy", "ldy", "ldy"]);
  });

  it("should keep nonadjacent offsets as explicit loads", () => {
    const target: MachineInstruction[] = [];
    appendConstantConstruction(
      target,
      [immediate("ldy", 0), pointerOperation("sta"), immediate("ldy", 2)],
      null,
      POINTER,
    );
    expect(target.map(({ opcode }) => opcode)).toEqual(["ldy", "sta", "ldy"]);
  });
});
