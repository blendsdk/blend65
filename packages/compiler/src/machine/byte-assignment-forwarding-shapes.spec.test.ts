import { describe, expect, it } from "vitest";
import type {
  BinaryOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
} from "../semantic/operations.js";
import type { MachineLoweringInput } from "./machine-types.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import { closeSource, replaceBlocks } from "./low-byte-write-forwarding-test-support.js";

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

describe("named byte assignment shape barriers", () => {
  const mutations = [
    "gap",
    "convert-chain",
    "second-use",
    "cold-use",
    "branch-use",
    "return-use",
    "branch-consumer",
    "return-consumer",
    "hidden-index-use",
    "duplicate-block",
    "missing-successor",
    "cold-producer",
    "signed",
    "word",
    "nonwrapping",
    "other-operator",
    "bcd",
    "indexed-destination",
    "field-destination",
    "word-store",
    "word-root",
  ] as const;
  for (const mutation of mutations) {
    it(`should retain the capture when the original window changes through ${mutation}`, async () => {
      const fixture = await closeSource(source);
      const window = candidate(fixture.source.blocks);
      const result = window.operation.result;
      const binary: BinaryOperation = window.operation;
      let operations: readonly SemanticOperation[] = window.block.operations;
      let blocks: readonly SemanticBlock[] = fixture.source.blocks;
      let terminator = window.block.terminator;
      if (mutation === "gap") {
        operations = [
          ...operations.slice(0, window.index + 1),
          { kind: "cpu-control", control: "asm_nop", span: binary.span },
          ...operations.slice(window.index + 1),
        ];
      } else if (mutation === "convert-chain") {
        operations = [
          ...operations.slice(0, window.index + 1),
          {
            ...binary,
            kind: "convert",
            conversion: "identity",
            operand: result,
            result: `${result}.converted`,
          },
          { ...window.store, value: `${result}.converted` },
          ...operations.slice(window.index + 2),
        ];
      } else if (mutation === "second-use") {
        operations = [...operations, { ...window.store }];
      } else if (mutation === "cold-use") {
        blocks = [
          ...blocks,
          {
            id: "cold.extra-use",
            operations: [{ ...window.store }],
            terminator: { kind: "unreachable" },
          },
        ];
      } else if (mutation === "branch-use") {
        terminator = {
          kind: "branch",
          condition: result,
          whenTrue: window.block.id,
          whenFalse: window.block.id,
        };
      } else if (mutation === "return-use") {
        terminator = { kind: "return", value: result };
      } else if (mutation === "branch-consumer" || mutation === "return-consumer") {
        operations = operations.filter((_, index) => index !== window.index + 1);
        terminator =
          mutation === "return-consumer"
            ? { kind: "return", value: result }
            : {
                kind: "branch",
                condition: result,
                whenTrue: window.block.id,
                whenFalse: window.block.id,
              };
      } else if (mutation === "hidden-index-use") {
        operations = [
          ...operations,
          {
            ...window.store,
            place: {
              ...window.store.place,
              path: [{ kind: "index", value: result }],
            },
          },
        ];
      } else if (mutation === "duplicate-block") {
        blocks = [...blocks, { ...window.block }];
      } else if (mutation === "missing-successor") {
        terminator = { kind: "jump", target: "absent.successor" };
      } else if (mutation === "cold-producer") {
        blocks = blocks.map((block) =>
          block.id === fixture.source.entry
            ? { ...block, terminator: { kind: "return", value: null } }
            : block,
        );
      } else {
        operations = operations.map((operation, index): SemanticOperation => {
          if (index === window.index) {
            if (mutation === "signed") {
              return {
                ...binary,
                type: { kind: "scalar", name: "sbyte" },
                integer: { width: 8, signed: true, wrap: true },
              };
            }
            if (mutation === "word") {
              return {
                ...binary,
                type: { kind: "scalar", name: "word" },
                integer: { width: 16, signed: false, wrap: true },
              };
            }
            if (mutation === "nonwrapping") {
              return {
                ...binary,
                integer: { width: 8, signed: false, wrap: false },
              };
            }
            if (mutation === "other-operator") {
              return { ...binary, operator: "^" };
            }
            if (mutation === "bcd") {
              return {
                ...binary,
                kind: "bcd",
                operator: "add",
                width: 1,
                validLeft: true,
                validRight: true,
                flagEffects: "owned-decimal-region",
              };
            }
          }
          if (index === window.index + 1) {
            if (mutation === "indexed-destination") {
              return {
                ...window.store,
                place: {
                  ...window.store.place,
                  path: [{ kind: "index", value: binary.right }],
                },
              };
            }
            if (mutation === "field-destination") {
              return {
                ...window.store,
                place: {
                  ...window.store.place,
                  path: [{ kind: "field", name: "member" }],
                },
              };
            }
            if (mutation === "word-store") {
              return { ...window.store, type: { kind: "scalar", name: "word" } };
            }
            if (mutation === "word-root") {
              return {
                ...window.store,
                place: {
                  ...window.store.place,
                  rootType: { kind: "scalar", name: "word" },
                },
              };
            }
          }
          return operation;
        });
      }
      blocks = blocks.map((block) =>
        block === window.block ? { ...block, operations, terminator } : block,
      );
      const changed = replaceBlocks(fixture, blocks);
      expect(
        select(
          changed.input,
          changed.source,
          changed.source.blocks,
          uses(changed.source.blocks),
          true,
        ).has(result),
      ).toBe(false);
    });
  }
});
