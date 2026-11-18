import { describe, expect, it } from "vitest";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import type { MachineLoweringInput } from "./machine-types.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import { closeSource } from "./low-byte-write-forwarding-test-support.js";

/** Opt in without changing the original exported function's required arity. */
const select: (
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  includeNamedArithmeticStores?: boolean,
) => ReadonlySet<string> = selectAnonymousByteWriteValues;

const source = `module Main;
function main(): void {
  let value: byte = 165;
  let step: byte = 37;
  while (true) { value = value + step; poke($D005, value); }
}`;

/** Locate the one source assignment without relying on generated value names. */
function candidate(blocks: readonly SemanticBlock[]) {
  const windows = blocks.flatMap((block) =>
    block.operations.flatMap((operation, index) => {
      const store = block.operations[index + 1];
      return operation.kind === "binary" &&
        operation.operator === "+" &&
        store?.kind === "store" &&
        store.value === operation.result
        ? [{ block, operation, store, index }]
        : [];
    }),
  );
  expect(windows).toHaveLength(1);
  return windows[0]!;
}

/** Deliberately overstate single-use information to exercise independent proof. */
function uses(blocks: readonly SemanticBlock[]): ReadonlySet<string> {
  return new Set(
    blocks.flatMap((block) =>
      block.operations.flatMap((operation) =>
        "result" in operation && operation.result !== null ? [operation.result] : [],
      ),
    ),
  );
}

describe("named byte assignment proof barriers", () => {
  const observers = [
    {
      name: "global destination",
      text: source.replace(
        "function main(): void {\n  let value: byte = 165;",
        "let value: byte = 165;\nfunction main(): void {",
      ),
    },
    {
      name: "runtime global initializer",
      text: source.replace("module Main;", "module Main;\nlet seed: byte = peek($D012);"),
    },
    {
      name: "source interrupt",
      text: source
        .replace(
          "module Main;",
          "module Main;\nimport { setIRQ } from c64.system;\ninterrupt function observe(): void { poke($D020, 1); }",
        )
        .replace("  while (true)", "  setIRQ(&observe);\n  while (true)"),
    },
    {
      name: "helper call",
      text: source
        .replace("module Main;", "module Main;\nfunction sample(): byte { return peek($D012); }")
        .replace("poke($D005, value);", "poke($D005, value); poke($D007, sample());"),
    },
    {
      name: "escaped named address",
      text: source
        .replace("  while (true)", "  let address: word = word(&value);\n  while (true)")
        .replace("poke($D005, value);", "poke($D005, value); poke($D007, peek(address));"),
    },
    {
      name: "raw private-window read",
      text: source.replace("poke($D005, value);", "poke($D005, value); poke($D007, peek($2455));"),
    },
    {
      name: "unknown raw address",
      text: source
        .replace("  while (true)", "  let address: word = word(peek($D012));\n  while (true)")
        .replace("poke($D005, value);", "poke($D005, value); poke($D007, peek(address));"),
    },
    {
      name: "CIA routing write",
      text: source.replace("poke($D005, value);", "poke($D005, value); poke($DD00, 0);"),
    },
    {
      name: "firmware low-memory write",
      text: source.replace("poke($D005, value);", "poke($D005, value); poke($00D1, 0);"),
    },
  ];
  for (const observer of observers) {
    it(`should decline selection when the program contains ${observer.name}`, async () => {
      const fixture = await closeSource(observer.text);
      const window = candidate(fixture.source.blocks);
      expect(
        select(
          fixture.input,
          fixture.source,
          fixture.source.blocks,
          uses(fixture.source.blocks),
          true,
        ).has(window.operation.result),
      ).toBe(false);
    });
  }

  for (const missing of [
    "executionDomains",
    "interruptContextAnalysis",
    "metadataOnly",
    "source",
    "foreign-main",
    "unreachable-main",
    "missing-main-domain",
    "irq-domain",
    "source-clone",
    "block-clone",
    "block-order",
  ] as const) {
    it(`should decline selection when provenance is ${missing}`, async () => {
      const fixture = await closeSource(source);
      const window = candidate(fixture.source.blocks);
      let input = fixture.input;
      let selectedSource: SemanticFunction | undefined = fixture.source;
      let blocks = fixture.source.blocks;
      if (missing === "executionDomains") {
        const { executionDomains: omitted, ...program } = input.program;
        void omitted;
        input = { ...input, program };
      } else if (missing === "interruptContextAnalysis") {
        const { interruptContextAnalysis: omitted, ...program } = input.program;
        void omitted;
        input = { ...input, program };
      } else if (missing === "metadataOnly") {
        input = { ...input, metadataOnly: true };
      } else if (missing === "source") {
        selectedSource = undefined;
      } else if (missing === "unreachable-main") {
        input = {
          ...input,
          program: { ...input.program, reachableFunctions: [] },
        };
      } else if (missing === "missing-main-domain") {
        input = {
          ...input,
          program: { ...input.program, executionDomains: [] },
        };
      } else if (missing === "irq-domain") {
        const domains = input.program.executionDomains;
        expect(domains).toBeDefined();
        if (!domains) {
          throw new Error("Closed fixture must provide execution domains");
        }
        input = {
          ...input,
          program: {
            ...input.program,
            executionDomains: domains.map((domain) => ({
              ...domain,
              domains: ["irq"],
            })),
          },
        };
      } else if (missing === "foreign-main") {
        input = {
          ...input,
          program: {
            ...input.program,
            semantic: {
              ...input.program.semantic,
              main: { ...fixture.source.id, sourceId: "foreign-source" },
            },
          },
        };
      } else if (missing === "source-clone") {
        selectedSource = { ...fixture.source };
      } else if (missing === "block-clone") {
        blocks = blocks.map((block) => ({
          ...block,
          operations: [...block.operations],
        }));
      } else {
        expect(blocks.length).toBeGreaterThan(1);
        blocks = [...blocks].reverse();
      }
      expect(
        select(input, selectedSource, blocks, uses(blocks), true).has(window.operation.result),
      ).toBe(false);
    });
  }

  it("should retain a capture when the destination is parameter storage", async () => {
    const fixture = await closeSource(source);
    const window = candidate(fixture.source.blocks);
    const parameterSource: SemanticFunction = {
      ...fixture.source,
      parameters: [
        ...fixture.source.parameters,
        { id: window.store.place.root, type: window.store.type },
      ],
    };
    const input: MachineLoweringInput = {
      ...fixture.input,
      program: {
        ...fixture.input.program,
        semantic: {
          ...fixture.input.program.semantic,
          functions: fixture.input.program.semantic.functions.map((fn) =>
            fn === fixture.source ? parameterSource : fn,
          ),
        },
      },
    };
    expect(
      select(
        input,
        parameterSource,
        parameterSource.blocks,
        uses(parameterSource.blocks),
        true,
      ).has(window.operation.result),
    ).toBe(false);
  });
});
