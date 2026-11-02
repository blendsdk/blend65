import { describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { hasDisplayIndependentStartup } from "./lower-startup.js";

const span = { sourceId: "src/startup.blend", start: 0, end: 1 };
const main = { sourceId: span.sourceId, span };
const BYTE = { kind: "scalar", name: "byte" } as const;
const WORD = { kind: "scalar", name: "word" } as const;
const VOID = { kind: "scalar", name: "void" } as const;

/** Minimal closed identity facts; tests do not infer new call or alias information. */
function program(operations: readonly SemanticOperation[]): WholeProgram {
  return {
    semantic: {
      main,
      globals: [],
      assets: [],
      initializerOrder: [],
      functions: [
        {
          id: main,
          parameters: [],
          result: VOID,
          entry: "entry",
          source: span,
          blocks: [{ id: "entry", operations, terminator: { kind: "return", value: null } }],
        },
      ],
    },
    roots: [],
    callGraph: [],
    effects: [],
    lifetimes: [],
    reachableFunctions: [main],
    reachableAssets: [],
  };
}

function access(
  address: bigint | undefined,
  write: boolean,
  width: 1 | 2 = 1,
): readonly SemanticOperation[] {
  return [
    ...(address === undefined
      ? []
      : [
          {
            kind: "constant" as const,
            result: "address",
            type: WORD,
            integer: { width: 16 as const, signed: false, wrap: true },
            value: address,
            span,
          },
        ]),
    ...(write
      ? [
          {
            kind: "memory-write" as const,
            address: "address",
            value: "value",
            width,
            byteOrder: "low-first" as const,
            volatile: true as const,
            span,
          },
        ]
      : [
          {
            kind: "memory-read" as const,
            result: "value",
            type: BYTE,
            integer: { width: 8 as const, signed: false, wrap: true },
            address: "address",
            width,
            byteOrder: "low-first" as const,
            volatile: true as const,
            span,
          },
        ]),
  ];
}

describe("Display-independent startup selection", () => {
  it.each(["single", "duplicate", "merge", "branch", "return"] as const)(
    "admits a whole global borrow only with a sole direct consumer: %s",
    (useKind) => {
      const array = { kind: "array", element: BYTE, length: 2, size: 2 } as const;
      const global = { sourceId: span.sourceId, span: { ...span, start: 10, end: 11 } };
      const callee = { sourceId: span.sourceId, span: { ...span, start: 20, end: 21 } };
      const operations: SemanticOperation[] = [
        {
          kind: "place-address",
          result: "borrow",
          place: { root: global, rootType: array, path: [] },
          type: array,
          integer: null,
          span,
        },
        {
          kind: "call",
          result: null,
          callee,
          arguments: useKind === "duplicate" ? ["borrow", "borrow"] : ["borrow"],
          type: VOID,
          span,
        },
      ];
      if (useKind === "merge")
        operations.push({
          kind: "merge",
          result: "merged",
          incoming: [{ block: "entry", value: "borrow" }],
          type: array,
          integer: null,
          span,
        });
      const base = program(operations);
      const caller = base.semantic.functions[0]!;
      const input: WholeProgram = {
        ...base,
        reachableFunctions: [main, callee],
        semantic: {
          ...base.semantic,
          globals: [
            {
              id: global,
              storage: "module",
              type: array,
              initialBytes: null,
              runtimeInitialBytes: null,
              entry: null,
              blocks: [],
              source: global.span,
            },
          ],
          functions: [
            {
              ...caller,
              blocks: [
                {
                  ...caller.blocks[0]!,
                  terminator:
                    useKind === "branch"
                      ? {
                          kind: "branch",
                          condition: "borrow",
                          whenTrue: "entry",
                          whenFalse: "entry",
                        }
                      : { kind: "return", value: useKind === "return" ? "borrow" : null },
                },
              ],
            },
            {
              ...caller,
              id: callee,
              parameters: [{ id: callee, type: array }],
              blocks: [
                { id: "entry", operations: [], terminator: { kind: "return", value: null } },
              ],
            },
          ],
        },
      };
      expect(hasDisplayIndependentStartup(input)).toBe(useKind === "single");
    },
  );

  it("accepts an empty closed main", () => {
    expect(hasDisplayIndependentStartup(program([]))).toBe(true);
  });

  it.each([0x0400n, 0x2000n, 0xd018n, 0xd060n, 0xd800n, undefined])(
    "retains full startup for screen/display/unknown reads at %s",
    (address) => {
      expect(hasDisplayIndependentStartup(program(access(address, false)))).toBe(false);
    },
  );

  it.each([0n, 1n, 0x0400n, 0xc100n, 0xdd00n, 0xdd02n, 0xddf2n, undefined])(
    "retains full startup for mapping/RAM/unknown writes at %s",
    (address) => {
      expect(hasDisplayIndependentStartup(program(access(address, true)))).toBe(false);
    },
  );

  it.each([0xc100n, 0xdc00n, 0xdd04n, 0xd400n, 0xe000n])(
    "accepts an exact disjoint fixed read at %s",
    (address) => {
      expect(hasDisplayIndependentStartup(program(access(address, false)))).toBe(true);
    },
  );

  it.each([0xcfffn, 0xffffn, 0xdcffn])("checks the second byte of word reads at %s", (address) => {
    expect(hasDisplayIndependentStartup(program(access(address, false, 2)))).toBe(false);
  });

  it("does not add a new call-target solver", () => {
    const callee = { sourceId: span.sourceId, span: { ...span, start: 5, end: 6 } };
    expect(
      hasDisplayIndependentStartup(
        program([{ kind: "call", callee, result: null, arguments: [], type: VOID, span }]),
      ),
    ).toBe(false);
  });

  it("checks declared interrupt owners even when they are not reached", () => {
    const base = program([]);
    const handler = {
      ...base.semantic.functions[0]!,
      entryKind: "interrupt" as const,
      id: { sourceId: span.sourceId, span: { ...span, start: 5, end: 6 } },
      blocks: [
        {
          id: "entry",
          operations: access(0xd020n, true),
          terminator: { kind: "return" as const, value: null },
        },
      ],
    };
    expect(
      hasDisplayIndependentStartup({
        ...base,
        semantic: { ...base.semantic, functions: [...base.semantic.functions, handler] },
      }),
    ).toBe(false);
  });

  it.each(["c64.vic.setBorderColor", "c64.video.waitNextFrame", "future.unprovedOperation"])(
    "retains full startup for %s",
    (capability) => {
      expect(
        hasDisplayIndependentStartup(
          program([
            {
              kind: "platform",
              result: null,
              arguments: [],
              type: VOID,
              capability,
              effect: "volatile-write",
              span,
            },
          ]),
        ),
      ).toBe(false);
    },
  );
});

const BOOLEAN = { kind: "scalar", name: "boolean" } as const;
const UNSIGNED16 = { width: 16 as const, signed: false as const, wrap: true };
const UNSIGNED8 = { width: 8 as const, signed: false as const, wrap: true };

/** Build a guarded unsigned index into a literal base address. */
function boundedAccess(
  base: bigint,
  bound: bigint,
  write: boolean,
  width: 1 | 2 = 1,
): WholeProgram {
  const index = { sourceId: span.sourceId, span: { ...span, start: 20, end: 21 } };
  const blocks = [
    {
      id: "entry",
      operations: [
        {
          kind: "convert" as const,
          result: "index",
          operand: index,
          conversion: "zero-extend" as const,
          type: WORD,
          integer: UNSIGNED16,
          span,
        },
        {
          kind: "constant" as const,
          result: "limit",
          value: bound,
          type: WORD,
          integer: UNSIGNED16,
          span,
        },
        {
          kind: "binary" as const,
          result: "guard",
          operator: "<",
          left: "index",
          right: "limit",
          type: BOOLEAN,
          integer: null,
          span,
        },
      ],
      terminator: {
        kind: "branch" as const,
        condition: "guard",
        whenTrue: "body",
        whenFalse: "exit",
      },
    },
    {
      id: "body",
      operations: [
        {
          kind: "constant" as const,
          result: "base",
          value: base,
          type: WORD,
          integer: UNSIGNED16,
          span,
        },
        {
          kind: "binary" as const,
          result: "address",
          operator: "+",
          left: "base",
          right: "index",
          type: WORD,
          integer: UNSIGNED16,
          span,
        },
        ...(write
          ? [
              {
                kind: "memory-write" as const,
                address: "address",
                value: "index",
                width,
                byteOrder: "low-first" as const,
                volatile: true as const,
                span,
              },
            ]
          : [
              {
                kind: "memory-read" as const,
                result: "value",
                type: BYTE,
                integer: UNSIGNED8,
                address: "address",
                width,
                byteOrder: "low-first" as const,
                volatile: true as const,
                span,
              },
            ]),
      ],
      terminator: { kind: "return" as const, value: null },
    },
    { id: "exit", operations: [], terminator: { kind: "return" as const, value: null } },
  ];
  const skeleton = program([]);
  return {
    ...skeleton,
    semantic: {
      ...skeleton.semantic,
      functions: [
        {
          ...skeleton.semantic.functions[0]!,
          parameters: [{ id: index, type: BYTE }],
          blocks,
        },
      ],
    },
  };
}

describe("Bounded raw startup independence", () => {
  it("accepts a guarded read whose whole range stays in ordinary RAM", () => {
    expect(hasDisplayIndependentStartup(boundedAccess(0xc110n, 8n, false))).toBe(true);
    expect(hasDisplayIndependentStartup(boundedAccess(0xc110n, 8n, false, 2))).toBe(true);
  });

  it("rejects a guarded read whose range reaches display registers", () => {
    expect(hasDisplayIndependentStartup(boundedAccess(0xd000n, 8n, false))).toBe(false);
    expect(hasDisplayIndependentStartup(boundedAccess(0xcfffn, 2n, false, 2))).toBe(false);
  });

  it("admits bounded ordinary-RAM writes only through the explicit size choice", () => {
    expect(hasDisplayIndependentStartup(boundedAccess(0xc103n, 2n, true))).toBe(false);
    expect(hasDisplayIndependentStartup(boundedAccess(0xc103n, 2n, true), true)).toBe(true);
    expect(hasDisplayIndependentStartup(boundedAccess(0x0000n, 2n, true), true)).toBe(false);
  });
});

describe("Whole aggregate parameter borrow", () => {
  const array = { kind: "array" as const, element: BYTE, length: 2, size: 2 };
  const middleId = { sourceId: span.sourceId, span: { ...span, start: 30, end: 31 } };
  const innerId = { sourceId: span.sourceId, span: { ...span, start: 40, end: 41 } };
  const parameter = { sourceId: span.sourceId, span: { ...span, start: 50, end: 51 } };

  function parameterBorrow(outerUnsized: boolean): WholeProgram {
    const base = program([]);
    const caller = base.semantic.functions[0]!;
    const middle = {
      ...caller,
      id: middleId,
      parameters: [
        { id: parameter, type: array, ...(outerUnsized ? { outerUnsized: true as const } : {}) },
      ],
      blocks: [
        {
          id: "entry",
          operations: [
            {
              kind: "place-address" as const,
              result: "borrow",
              place: { root: parameter, rootType: array, path: [] },
              type: array,
              integer: null,
              span,
            },
            {
              kind: "call" as const,
              result: null,
              callee: innerId,
              arguments: ["borrow"],
              type: VOID,
              span,
            },
          ],
          terminator: { kind: "return" as const, value: null },
        },
      ],
    };
    const inner = {
      ...caller,
      id: innerId,
      parameters: [{ id: innerId, type: array }],
      blocks: [
        { id: "entry", operations: [], terminator: { kind: "return" as const, value: null } },
      ],
    };
    return {
      ...base,
      reachableFunctions: [main, middleId, innerId],
      callGraph: [
        { function: main, callees: [middleId] },
        { function: middleId, callees: [innerId] },
        { function: innerId, callees: [] },
      ],
      semantic: {
        ...base.semantic,
        functions: [caller, middle, inner],
      },
    };
  }

  it("accepts a whole const aggregate parameter borrowed at one direct call", () => {
    expect(hasDisplayIndependentStartup(parameterBorrow(false))).toBe(true);
  });

  it("rejects an outer-unsized parameter borrow", () => {
    expect(hasDisplayIndependentStartup(parameterBorrow(true))).toBe(false);
  });
});
