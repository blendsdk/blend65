import { describe, expect, it, vi } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { FunctionType, StructType } from "../frontend/semantic-types.js";
import type { SemanticGlobal, SemanticOperation } from "./operations.js";
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
import { retainObservableGlobals } from "./reachable-globals.js";
import { closeWholeProgram } from "./whole-program.js";

describe("observable global selection scaling", () => {
  it("should avoid global-prefix cross-products in complete closure of cold exported callers", () => {
    const globalCount = 120;
    const wrapperCount = 24;
    const globals: SemanticGlobal[] = Array.from({ length: globalCount }, (_, index) => {
      const identity = sourceBinding(100 + index);
      return {
        id: identity,
        storage: "module",
        exported: false,
        type: BYTE,
        initialBytes: null,
        runtimeInitialBytes: null,
        entry: null,
        blocks: [],
        source: identity.span,
      };
    });
    const main = semanticFunction(0, "main", [], VOID, [
      semanticBlock("main", [], { kind: "return", value: null }),
    ]);
    const helper = semanticFunction(1, "helper", [], VOID, [
      semanticBlock("helper", [], { kind: "return", value: null }),
    ]);
    const wrappers = Array.from({ length: wrapperCount }, (_, index) => ({
      ...semanticFunction(10 + index, `wrapper${index}`, [], VOID, [
        semanticBlock(
          `wrapper${index}`,
          [
            {
              kind: "call",
              result: null,
              callee: helper.id,
              arguments: [],
              type: VOID,
              span: sourceSpan(10 + index),
            },
          ],
          { kind: "return", value: null },
        ),
      ]),
      exported: true,
    }));
    const input = { ...wholeProgramFor([main, helper, ...wrappers]).semantic, globals };
    // Observe the real native method without replacing its behavior. This counts
    // root-prefix work independently of machine load and includes the target solver.
    const prefixChecks = vi.spyOn(String.prototype, "startsWith");
    try {
      const result = closeWholeProgram(input, undefined, selectedProfile().storage);
      expect(result.kind).toBe("complete");
      if (result.kind !== "complete") throw new Error("Expected complete closure");
      expect(result.program.reachableFunctions).toEqual([main.id]);
      expect(result.program.semantic.globals).toEqual([]);
      const rootChecks = prefixChecks.mock.calls.filter(([prefix]) => prefix.endsWith("\0"));
      expect(rootChecks.length).toBeLessThanOrEqual(globalCount * wrapperCount * 4);
    } finally {
      prefixChecks.mockRestore();
    }
  });

  it("should preserve aggregate-field global assignment facts at an ordinary exported call", () => {
    const signature: FunctionType = { kind: "function", parameters: [], returnType: VOID };
    const box: StructType = {
      kind: "struct",
      binding: sourceBinding(80),
      size: 2,
      fields: [{ name: "callback", offset: 0, type: signature }],
    };
    const identity = sourceBinding(90);
    const global: SemanticGlobal = {
      id: identity,
      storage: "module",
      exported: false,
      type: box,
      initialBytes: null,
      runtimeInitialBytes: null,
      entry: null,
      blocks: [],
      source: identity.span,
    };
    const chosen = semanticFunction(2, "chosen", [], VOID, [
      semanticBlock("chosen", [], { kind: "return", value: null }),
    ]);
    const place = {
      root: identity,
      rootType: box,
      path: [{ kind: "field" as const, name: "callback" }],
    };
    const invoke = {
      ...semanticFunction(1, "invoke", [], VOID, [
        semanticBlock(
          "invoke",
          [
            {
              kind: "load",
              result: "callback",
              place,
              type: signature,
              integer: null,
              span: sourceSpan(4),
            },
            {
              kind: "indirect-call",
              result: null,
              target: "callback",
              arguments: [],
              signature,
              type: VOID,
              span: sourceSpan(5),
            },
          ],
          { kind: "return", value: null },
        ),
      ]),
      exported: true,
    };
    const main = semanticFunction(0, "main", [], VOID, [
      semanticBlock(
        "main",
        [
          {
            kind: "function-address",
            result: "chosen",
            function: chosen.id,
            type: signature,
            integer: null,
            span: sourceSpan(6),
          },
          { kind: "store", place, value: "chosen", type: signature, span: sourceSpan(7) },
          {
            kind: "call",
            result: null,
            callee: invoke.id,
            arguments: [],
            type: VOID,
            span: sourceSpan(8),
          },
        ],
        { kind: "return", value: null },
      ),
    ]);
    const input = {
      ...wholeProgramFor([main, invoke, chosen]).semantic,
      globals: [global],
      effects: [
        {
          function: main.id,
          reads: [{ binding: identity, path: ["callback"], readonly: false }],
          writes: [{ binding: identity, path: ["callback"], readonly: false }],
          operationEffects: [],
          opaque: false,
        },
        {
          function: invoke.id,
          reads: [{ binding: identity, path: ["callback"], readonly: false }],
          writes: [],
          operationEffects: [],
          opaque: false,
        },
      ],
    };
    const result = closeWholeProgram(input, undefined, selectedProfile().storage);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected finite field target");
    expect(result.program.reachableFunctions).toEqual([main.id, invoke.id, chosen.id]);
    expect(
      result.program.callGraph.find(
        ({ function: id }) => bindingIdentityKey(id) === bindingIdentityKey(invoke.id),
      )?.callees,
    ).toEqual([chosen.id]);
    expect(result.program.semantic.globals).toEqual([global]);
  });

  it("should resolve long shared conversion chains iteratively with bounded identity and definition work", () => {
    let identityReads = 0;
    let conversionReads = 0;
    const integer = { width: 16 as const, signed: false, wrap: true };
    const globals: SemanticGlobal[] = Array.from({ length: 2000 }, (_, index) => {
      const identity = sourceBinding(100 + index);
      return {
        storage: "module",
        exported: false,
        type: BYTE,
        initialBytes: null,
        runtimeInitialBytes: null,
        entry: null,
        blocks: [],
        source: identity.span,
        get id() {
          identityReads += 1;
          return identity;
        },
      };
    });
    const operations: SemanticOperation[] = [
      {
        kind: "constant",
        result: "address",
        value: 0xd020n,
        type: WORD,
        integer,
        span: sourceSpan(1),
      },
    ];
    let value = "address";
    for (let index = 0; index < 8000; index += 1) {
      const next = `conversion:${index}`;
      operations.push({
        kind: "convert",
        result: next,
        operand: value,
        conversion: "identity",
        type: WORD,
        span: sourceSpan(2),
        get integer() {
          conversionReads += 1;
          return integer;
        },
      });
      value = next;
    }
    for (let index = 0; index < 2000; index += 1)
      operations.push({
        kind: "memory-read",
        result: `read:${index}`,
        address: value,
        width: 1,
        byteOrder: "low-first",
        volatile: true,
        type: BYTE,
        integer: null,
        span: sourceSpan(3),
      });
    const main = semanticFunction(0, "main", [], VOID, [
      semanticBlock("entry", operations, { kind: "return", value: null }),
    ]);
    const input = { ...wholeProgramFor([main]).semantic, globals };
    const result = retainObservableGlobals(
      input,
      new Set([bindingIdentityKey(input.main)]),
      selectedProfile().storage,
    );
    expect(result.globals).toEqual([]);
    // Deterministic work counters catch cross-products and lost memoization without
    // imposing a machine-load-sensitive wall-clock deadline.
    expect(identityReads).toBeLessThanOrEqual(globals.length * 4);
    expect(conversionReads).toBeLessThanOrEqual(8000 * 4);
    expect(input.globals).toHaveLength(2000);
  });
});
