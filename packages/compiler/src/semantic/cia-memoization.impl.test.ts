import { describe, expect, it, vi } from "vitest";
import { bindingIdentityKey, type BindingId } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import { checkCiaOwnership } from "./cia-ownership.js";
import type {
  CallOperation,
  CpuControlOperation,
  IndirectCallOperation,
  PlatformOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticProgram,
} from "./operations.js";

const voidType = { kind: "scalar", name: "void" } as const;
const span = { sourceId: "memo.blend", start: 0, end: 1 };

/** Supply a typed platform effect without runtime device state. */
function platform(capability: string, source = span): PlatformOperation {
  return {
    kind: "platform",
    result: null,
    capability,
    arguments: [],
    type: voidType,
    effect: "volatile-write",
    span: source,
  };
}

/** Keep CPU masking effects explicit in the semantic input. */
function control(name: CpuControlOperation["control"]): CpuControlOperation {
  return { kind: "cpu-control", control: name, span };
}

/** Build an ordinary, already-resolved no-argument helper call. */
function call(callee: BindingId): CallOperation {
  return { kind: "call", result: null, callee, arguments: [], type: voidType, span };
}

/** Count only ownership-cache key construction; no wall-clock threshold or production counter. */
function analyze(
  program: SemanticProgram,
  targets = new Map<IndirectCallOperation, readonly BindingId[]>(),
) {
  const stringify = JSON.stringify;
  let evaluations = 0;
  const spy = vi.spyOn(JSON, "stringify").mockImplementation((value: unknown) => {
    if (
      Array.isArray(value) &&
      value.length === 8 &&
      typeof value[0] === "string" &&
      Array.isArray(value[1]) &&
      typeof value[3] === "boolean"
    )
      evaluations += 1;
    return stringify(value);
  });
  try {
    const handbacks = new Set<SemanticOperation>();
    const diagnostics = checkCiaOwnership(
      program,
      new Set(program.functions.map(({ id }) => bindingIdentityKey(id))),
      targets,
      [],
      handbacks,
    );
    return { diagnostics, evaluations, handbacks };
  } finally {
    spy.mockRestore();
  }
}

/** Make two mutation histories per layer while keeping the source graph linear in depth. */
function diamond(
  depth: number,
  unmask: "none" | "asm_cli" | "asm_plp" = "none",
  indirect = false,
  masked = true,
) {
  const ids: BindingId[] = Array.from({ length: depth + 2 }, (_, index) => ({
    sourceId: span.sourceId,
    span: { ...span, start: index, end: index + 1 },
  }));
  const targets = new Map<IndirectCallOperation, readonly BindingId[]>();
  const functions: SemanticFunction[] = ids.map((id, index) => {
    const next = ids[index + 1];
    let blocks: SemanticBlock[];
    if (index === 0) {
      blocks = [
        {
          id: "entry",
          operations: [
            ...(masked ? [control("asm_sei")] : []),
            platform("c64.system.setIRQExclusive"),
            call(ids[1]!),
          ],
          terminator: { kind: "return", value: null },
        },
      ];
    } else if (next === undefined) {
      blocks = [
        {
          id: "entry",
          operations:
            unmask === "none"
              ? []
              : unmask === "asm_plp"
                ? [control("asm_php"), control("asm_plp")]
                : [control("asm_cli")],
          terminator: { kind: "jump", target: "wait" },
        },
        { id: "wait", operations: [], terminator: { kind: "jump", target: "wait" } },
      ];
    } else {
      blocks = [
        {
          id: "entry",
          operations: [],
          terminator: { kind: "branch", condition: "condition", whenTrue: "yes", whenFalse: "no" },
        },
        ...["yes", "no"].map((name): SemanticBlock => {
          const invocation: CallOperation | IndirectCallOperation = indirect
            ? {
                kind: "indirect-call",
                result: null,
                target: "target",
                arguments: [],
                signature: { kind: "function", parameters: [], returnType: voidType },
                type: voidType,
                span,
              }
            : call(next);
          if (invocation.kind === "indirect-call") targets.set(invocation, [next]);
          return {
            id: name,
            operations: [
              ...(name === "yes" ? [platform("c64.cia1.writeTimerALatch")] : []),
              platform("c64.system.setIRQExclusive"),
              invocation,
            ],
            terminator: { kind: "return", value: null },
          };
        }),
      ];
    }
    return { id, parameters: [], result: voidType, entry: "entry", blocks, source: id.span };
  });
  const program: SemanticProgram = {
    main: ids[0]!,
    globals: [],
    functions,
    assets: [],
    initializerOrder: [],
  };
  return { program, targets };
}

/** Exercise a cached returning helper beneath an older route whose mutation later changes. */
function returningHelper(mutation: "clean" | "typed" | "raw", popsCaller: boolean) {
  const main = { sourceId: span.sourceId, span };
  const helper = { sourceId: span.sourceId, span: { ...span, start: 1, end: 2 } };
  const install = platform("c64.system.setIRQExclusive");
  const finalSpan: SourceSpan = { ...span, start: 20, end: 21 };
  const release = platform("c64.system.restoreIRQ", finalSpan);
  const effect: SemanticOperation[] =
    mutation === "clean"
      ? []
      : mutation === "typed"
        ? [platform("c64.cia1.writeTimerALatch")]
        : [
            {
              kind: "constant",
              result: "address",
              value: 0xdc04n,
              type: { kind: "scalar", name: "word" },
              integer: { width: 16, signed: false },
              span,
            },
            {
              kind: "memory-write",
              address: "address",
              value: "value",
              width: 1,
              byteOrder: "low-first",
              volatile: true,
              span,
            },
          ];
  const inner = popsCaller ? [call(helper)] : [call(helper), platform("c64.system.restoreIRQ")];
  const program: SemanticProgram = {
    main,
    globals: [],
    assets: [],
    initializerOrder: [],
    functions: [
      {
        id: main,
        parameters: [],
        result: voidType,
        source: span,
        entry: "entry",
        blocks: [
          {
            id: "entry",
            operations: [
              control("asm_sei"),
              install,
              install,
              install,
              ...inner,
              ...effect,
              install,
              ...inner,
              release,
              platform("c64.system.restoreIRQ"),
            ],
            terminator: { kind: "return", value: null },
          },
        ],
      },
      {
        id: helper,
        parameters: [],
        result: voidType,
        source: helper.span,
        entry: "entry",
        blocks: [
          {
            id: "entry",
            operations: popsCaller ? [platform("c64.system.restoreIRQ")] : [],
            terminator: { kind: "return", value: null },
          },
        ],
      },
    ],
  };
  return { program, finalSpan };
}

describe("CIA call-cache context sharing", () => {
  it.each([8, 16, 24])(
    "should check a masked depth-%i mutation diamond with linear key evaluations",
    (depth) => {
      const { program, targets } = diamond(depth);
      const result = analyze(program, targets);
      expect(result.diagnostics).toEqual([]);
      expect(result.evaluations).toBe(2 * depth + 2);
    },
  );

  it("should share nonreturning finite indirect helper contexts", () => {
    const { program, targets } = diamond(16, "none", true);
    const result = analyze(program, targets);
    expect(result.diagnostics).toEqual([]);
    expect(result.evaluations).toBe(34);
  });

  it.each([false, true])(
    "should preserve the current caller prefix when the helper pops it %s",
    (popsCaller) => {
      for (const mutation of ["clean", "typed", "raw"] as const) {
        const { program, finalSpan } = returningHelper(mutation, popsCaller);
        const result = analyze(program);
        if (mutation === "clean") {
          expect(result.diagnostics).toEqual([]);
          expect(result.handbacks.size).toBe(1);
        } else {
          expect(result.diagnostics).toMatchObject([{ code: "E10278", primarySpan: finalSpan }]);
        }
      }
    },
  );

  it.each(["asm_cli", "asm_plp"] as const)(
    "should retain exact contexts when a transitive helper uses %s",
    (unmask) => {
      for (const indirect of [false, true]) {
        const { program, targets } = diamond(6, unmask, indirect);
        const result = analyze(program, targets);
        expect(result.diagnostics).toEqual([]);
        expect(result.evaluations).toBe(128);
      }
    },
  );

  it("should retain exact contexts while IRQ entry is already allowed", () => {
    const { program, targets } = diamond(6, "none", false, false);
    const result = analyze(program, targets);
    expect(result.diagnostics).toEqual([]);
    expect(result.evaluations).toBe(128);
  });
});
