import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
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

describe("observable global selection scaling", () => {
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
