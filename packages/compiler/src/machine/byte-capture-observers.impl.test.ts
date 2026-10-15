import { describe, expect, it } from "vitest";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { MemoryReadOperation, SemanticOperation } from "../semantic/operations.js";
import { analyzeInterruptContexts } from "../semantic/interrupt-contexts.js";
import { analyzeInterruptDomains } from "../semantic/interrupt-domains.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { hasUnobservedByteCapture } from "./byte-capture-observers.js";
import {
  BYTE,
  VOID,
  WORD,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

/** Real domain/context producers distinguish an ordinary observer from an IRQ observer. */
function fixture(
  operations: readonly SemanticOperation[] = [],
  asynchronous = false,
  initializer = false,
) {
  const profile = selectedProfile();
  const capture: MemoryReadOperation = {
    kind: "memory-read",
    result: "sample",
    address: "input",
    width: 1,
    byteOrder: "low-first",
    volatile: true,
    type: BYTE,
    integer: null,
    span: sourceSpan(10001),
  };
  const source = semanticFunction(10000, "choose", [], BYTE, [
    semanticBlock(
      "choose",
      [
        {
          kind: "constant",
          result: "input",
          value: 0x3300n,
          type: WORD,
          integer: null,
          span: sourceSpan(10002),
        },
        capture,
      ],
      { kind: "return", value: "sample" },
    ),
  ]);
  const observer = {
    ...semanticFunction(10003, "observer", [], VOID, [
      semanticBlock("observer", initializer ? [] : operations, { kind: "return", value: null }),
    ]),
    ...(asynchronous ? { entryKind: "interrupt" as const } : {}),
  };
  const main = semanticFunction(10004, "main", [], VOID, [
    semanticBlock(
      "main",
      [
        {
          kind: "call",
          result: null,
          callee: source.id,
          arguments: [],
          type: BYTE,
          span: sourceSpan(10005),
        },
        ...(!asynchronous
          ? [
              {
                kind: "call" as const,
                result: null,
                callee: observer.id,
                arguments: [],
                type: VOID,
                span: sourceSpan(10006),
              },
            ]
          : []),
      ],
      { kind: "return", value: null },
    ),
  ]);
  const functions = [main, source, observer];
  const base = wholeProgramFor(functions, functions.flatMap(valueLifetimes));
  const globals = initializer
    ? [
        {
          id: sourceBinding(10007),
          storage: "module" as const,
          type: BYTE,
          initialBytes: null,
          runtimeInitialBytes: null,
          entry: "initializer",
          blocks: [semanticBlock("initializer", operations, { kind: "return", value: null })],
          source: sourceSpan(10007),
        },
      ]
    : [];
  const root = {
    ...base,
    semantic: { ...base.semantic, globals },
    roots: [
      ...base.roots,
      ...(asynchronous
        ? [
            {
              kind: "interrupt" as const,
              function: observer.id,
              domain: "irq" as const,
              variant: "c64_kernal_cinv_chain",
            },
          ]
        : []),
    ],
  };
  const program = {
    ...root,
    executionDomains: analyzeInterruptDomains(root.semantic, root.roots, root.callGraph).functions,
    interruptContextAnalysis: analyzeInterruptContexts(root, profile.storage),
  };
  const inventory = inventoryStorage(program);
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected real test allocation");
  return {
    input: { profile, program, placement: allocation.placement },
    source,
    capture,
    observer,
  };
}

/** A known literal address or an intentionally unresolved runtime address exercises existing queries. */
function raw(
  address: number | undefined,
  write = false,
  width: 1 | 2 = 1,
): readonly SemanticOperation[] {
  return [
    ...(address === undefined
      ? []
      : [
          {
            kind: "constant" as const,
            result: "address",
            value: BigInt(address),
            type: WORD,
            integer: null,
            span: sourceSpan(10010),
          },
        ]),
    ...(write
      ? [
          {
            kind: "constant" as const,
            result: "value",
            value: 0x55n,
            type: BYTE,
            integer: null,
            span: sourceSpan(10011),
          },
        ]
      : []),
    write
      ? {
          kind: "memory-write",
          address: "address",
          value: "value",
          width,
          byteOrder: "low-first",
          volatile: true,
          span: sourceSpan(10012),
        }
      : {
          kind: "memory-read",
          result: "observed",
          address: "address",
          width,
          byteOrder: "low-first",
          volatile: true,
          type: width === 1 ? BYTE : WORD,
          integer: null,
          span: sourceSpan(10012),
        },
  ];
}

describe("captured private byte observer eligibility", () => {
  it("admits only the exact initial fixed read with complete main-domain facts", () => {
    const { input, source, capture } = fixture();
    expect(hasUnobservedByteCapture(input, source, capture)).toBe(true);
    expect(hasUnobservedByteCapture(input, { ...source }, capture)).toBe(false);
    expect(hasUnobservedByteCapture(input, source, { ...capture })).toBe(false);
    expect(hasUnobservedByteCapture(input, source, { ...capture, width: 2 })).toBe(false);
  });

  it("retains fallback for missing domains, context proof, coverage and proof diagnostics", () => {
    const { input, source, capture } = fixture();
    const program = input.program;
    for (const changed of [
      { ...program, executionDomains: undefined },
      { ...program, interruptContextAnalysis: undefined },
      { ...program, executionDomains: program.executionDomains.slice(0, -1) },
      {
        ...program,
        executionDomains: program.executionDomains.map((entry) =>
          entry.function === source.id ? { ...entry, domains: ["main", "irq"] as const } : entry,
        ),
      },
      {
        ...program,
        interruptContextAnalysis: {
          ...program.interruptContextAnalysis,
          diagnostics: [projectDiagnostic("TEST", "Unproved route", null)],
        },
      },
    ])
      expect(hasUnobservedByteCapture({ ...input, program: changed }, source, capture)).toBe(false);
  });

  it.each([undefined, 0xc000])("retains other ordinary raw reads at %s", (address) => {
    const { input, source, capture } = fixture(raw(address));
    expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
  });

  it("retains a second same-address read instead of exempting matching addresses or spans", () => {
    const { input, source, capture } = fixture(raw(0x3300));
    expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
  });

  it.each([undefined, 0xc000])(
    "retains asynchronous raw writes at %s across all SFA windows",
    (address) => {
      const { input, source, capture } = fixture(raw(address, true), true);
      expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
    },
  );

  it("allows known non-publishing ordinary writes and disjoint device operations", () => {
    for (const [address, write, asynchronous] of [
      [0xc000, true, false],
      [0xd021, true, true],
      [0xdc00, false, true],
    ] as const) {
      const { input, source, capture } = fixture(raw(address, write), asynchronous);
      expect(hasUnobservedByteCapture(input, source, capture)).toBe(true);
    }
  });

  it.each([0xd018, 0xd058, 0xdd00, 0xdd10, 0, 1])(
    "retains RAM publication or banking write $%s",
    (address) => {
      const { input, source, capture } = fixture(raw(address, true));
      expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
    },
  );

  it("checks every byte of a wrapping word write", () => {
    const { input, source, capture } = fixture(raw(0xffff, true, 2));
    expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
  });

  it("retains persistent publication from an executable global initializer", () => {
    const { input, source, capture } = fixture(raw(0xd018, true), false, true);
    expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
  });

  it("checks unchecked indexed reads in main and writes in IRQ without assuming bounds", () => {
    const rootType = { kind: "array" as const, element: BYTE, length: 4, size: 4 };
    const place = {
      root: sourceBinding(10020),
      rootType,
      path: [{ kind: "index" as const, value: "index" }],
    };
    for (const [write, asynchronous] of [
      [false, false],
      [true, true],
    ] as const) {
      const operation: SemanticOperation = write
        ? { kind: "store", place, value: "value", type: BYTE, span: sourceSpan(10021) }
        : {
            kind: "load",
            result: "observed",
            place,
            type: BYTE,
            integer: null,
            span: sourceSpan(10021),
          };
      const { input, source, capture } = fixture([operation], asynchronous);
      expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
      const bounded = fixture(
        [
          {
            kind: "constant",
            result: "index",
            value: 3n,
            type: WORD,
            integer: null,
            span: sourceSpan(10022),
          },
          operation,
        ],
        asynchronous,
      );
      expect(hasUnobservedByteCapture(bounded.input, bounded.source, bounded.capture)).toBe(true);
    }
  });
});
