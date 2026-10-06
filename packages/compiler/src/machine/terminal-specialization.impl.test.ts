import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { IndirectCallOperation, SemanticFunction } from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { contextFunctionLabel } from "./interrupt-specialize.js";
import {
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

/** A minimal ordinary terminal leaf exposes no homes, calls, links or exit duties. */
function leaf(start = 900): SemanticFunction {
  return {
    ...semanticFunction(start, `terminal${start}`, [], VOID, [
      semanticBlock("loop", [], { kind: "jump", target: "loop" }),
    ]),
    entryKind: "ordinary",
  };
}

/** Supply the already-proved returning summary without adding analysis to machine selection. */
function programFor(fn: SemanticFunction): WholeProgram {
  return {
    ...wholeProgramFor([fn]),
    interruptOwnership: {
      diagnostics: [],
      cia1Handbacks: new Set(),
      maxDepth: { irq: 0, nmi: 0 },
      relativeDepths: new Map(),
      mainEntryDepth: { irq: 0, nmi: 0 },
      initializerEntryDepths: new Map(),
      returningBodies: new Map([[bindingIdentityKey(fn.id), false]]),
    },
  };
}

/** Select one independently entering IRQ context; only equivalent leaves may keep the canonical label. */
function selected(fn: SemanticFunction, program = programFor(fn)) {
  const key = bindingIdentityKey(fn.id);
  return contextFunctionLabel(
    `fn.${key}`,
    { domain: "irq", irq: 1, nmi: 0 },
    new Map([
      [
        key,
        [
          { domain: "main", irq: 0, nmi: 0 },
          { domain: "irq", irq: 1, nmi: 0 },
        ],
      ],
    ]),
    program,
  );
}

describe("ordinary terminal body sharing", () => {
  it("shares the canonical body only within one source function", () => {
    const first = leaf();
    const second = leaf(910);
    expect(selected(first)).toBe(`fn.${bindingIdentityKey(first.id)}`);
    expect(selected(second)).toBe(`fn.${bindingIdentityKey(second.id)}`);
    expect(selected(first)).not.toBe(selected(second));
  });

  it("keeps parameter-bearing code specialized", () => {
    const fn = { ...leaf(), parameters: [sourceParameter(920, BYTE)] };
    expect(selected(fn)).toBe(`fn.${bindingIdentityKey(fn.id)}.irq`);
  });

  it("does not infer terminality from missing returning facts", () => {
    const fn = leaf();
    expect(selected(fn, wholeProgramFor([fn]))).toBe(`fn.${bindingIdentityKey(fn.id)}.irq`);
  });

  it("keeps code with ordinary exit duties specialized", () => {
    const fn = { ...leaf(), blocks: [semanticBlock("loop", [], { kind: "return", value: null })] };
    expect(selected(fn)).toBe(`fn.${bindingIdentityKey(fn.id)}.irq`);
  });

  it("keeps explicit machine effects specialized", () => {
    const fn = {
      ...leaf(),
      blocks: [
        semanticBlock(
          "loop",
          [{ kind: "cpu-control", control: "asm_nop", span: sourceSpan(950) }],
          { kind: "jump", target: "loop" },
        ),
      ],
    };
    expect(selected(fn)).toBe(`fn.${bindingIdentityKey(fn.id)}.irq`);
  });

  it("preserves the existing entry selection of finite function-word consumers", () => {
    const fn = leaf();
    const call: IndirectCallOperation = {
      kind: "indirect-call",
      result: null,
      target: "target",
      arguments: [],
      signature: { kind: "function", parameters: [], returnType: VOID },
      type: VOID,
      span: sourceSpan(960),
    };
    const program = { ...programFor(fn), indirectTargets: new Map([[call, [fn.id]]]) };
    expect(selected(fn, program)).toBe(`fn.${bindingIdentityKey(fn.id)}.irq`);
  });
});
