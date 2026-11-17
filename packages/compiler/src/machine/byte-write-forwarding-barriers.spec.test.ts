import { beforeAll, describe, expect, it } from "vitest";
import type { SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import {
  alter,
  fixture,
  replaceBlocks,
  select,
  sourceText,
  witness,
} from "./byte-write-forwarding-test-support.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";

type Fixture = Awaited<ReturnType<typeof fixture>>;

describe("anonymous byte-write usage and observer barriers", () => {
  let base: Fixture;
  beforeAll(async () => {
    base = await fixture(sourceText);
  });

  it.each(["second write", "repeated operand", "merge", "branch", "return", "cold use"])(
    "should count a %s despite a forged single-use set",
    (mode) => {
      const found = witness(base.source);
      const value = found.operation.result;
      const extra: SemanticOperation =
        mode === "second write"
          ? { ...found.write }
          : mode === "merge"
            ? {
                ...found.operation,
                kind: "merge",
                result: "extra.merge",
                incoming: [{ block: found.block.id, value }],
              }
            : { ...found.operation, result: "extra.binary", left: value, right: value };
      let changed = alter(base, (operations) => [...operations, extra]);
      if (mode === "branch" || mode === "return")
        changed = replaceBlocks(
          base,
          base.source.blocks.map((block) =>
            block === found.block
              ? {
                  ...block,
                  terminator:
                    mode === "branch"
                      ? {
                          kind: "branch",
                          condition: value,
                          whenTrue: block.id,
                          whenFalse: block.id,
                        }
                      : { kind: "return", value },
                }
              : block,
          ),
        );
      if (mode === "cold use")
        changed = replaceBlocks(base, [
          ...base.source.blocks,
          { id: "cold.extra", operations: [extra], terminator: { kind: "unreachable" } },
        ]);
      expect(select(changed, new Set([value])).size).toBe(0);
    },
  );

  it.each(["conversion", "unary", "aggregate element", "aggregate fill"])(
    "should count a second %s operand occurrence",
    (mode) => {
      const found = witness(base.source);
      const value = found.operation.result;
      const extra: SemanticOperation =
        mode === "conversion"
          ? {
              ...found.operation,
              kind: "convert",
              result: "extra.convert",
              operand: value,
              conversion: "identity",
            }
          : mode === "unary"
            ? {
                ...found.operation,
                kind: "unary",
                result: "extra.unary",
                operator: "~",
                operand: value,
              }
            : {
                kind: "aggregate",
                result: "extra.aggregate",
                type: { kind: "array", element: found.operation.type, length: 1, size: 1 },
                integer: null,
                span: found.operation.span,
                elements: mode === "aggregate element" ? [{ field: null, value }] : [],
                fill: mode === "aggregate fill" ? value : null,
              };
      const changed = alter(base, (operations) => [...operations, extra]);
      expect(select(changed, new Set([value])).size).toBe(0);
    },
  );

  it("should decline when the supplied single-use set omits the producer", () => {
    expect(select(base, new Set()).size).toBe(0);
  });

  it("should decline a sole write in another block even when it is the next executed operation", () => {
    const found = witness(base.source);
    const continuation: SemanticBlock = {
      id: "write.continuation",
      operations: found.block.operations.slice(found.index + 1),
      terminator: found.block.terminator,
    };
    const changed = replaceBlocks(base, [
      ...base.source.blocks.map((block) =>
        block === found.block
          ? {
              ...block,
              operations: block.operations.slice(0, found.index + 1),
              terminator: { kind: "jump", target: continuation.id } as const,
            }
          : block,
      ),
      continuation,
    ]);
    expect(select(changed, new Set([found.operation.result])).size).toBe(0);
  });

  it.each([
    "missing source",
    "foreign source",
    "cloned block",
    "metadata only",
    "missing domains",
    "missing context",
    "wrong main",
    "cold candidate",
  ])("should decline %s evidence", (mode) => {
    let { input, source } = base;
    let blocks = source.blocks;
    if (mode === "foreign source") source = { ...source };
    if (mode === "cloned block") blocks = blocks.map((block) => ({ ...block }));
    if (mode === "metadata only") input = { ...input, metadataOnly: true };
    if (mode === "missing domains") {
      const { executionDomains: _domains, ...program } = input.program;
      input = { ...input, program };
    }
    if (mode === "missing context") {
      const { interruptContextAnalysis: _context, ...program } = input.program;
      input = { ...input, program };
    }
    if (mode === "wrong main")
      input = {
        ...input,
        program: {
          ...input.program,
          semantic: {
            ...input.program.semantic,
            main: { ...source.id, sourceId: "foreign.blend" },
          },
        },
      };
    if (mode === "cold candidate") {
      const changed = replaceBlocks(
        base,
        base.source.blocks.map((block) =>
          block.id === base.source.entry
            ? { ...block, terminator: { kind: "return", value: null } }
            : block,
        ),
      );
      input = changed.input;
      source = changed.source;
      blocks = source.blocks;
    }
    expect(
      selectAnonymousByteWriteValues(
        input,
        mode === "missing source" ? undefined : source,
        blocks,
        new Set([witness(base.source).operation.result]),
      ).size,
    ).toBe(0);
  });

  const observers = [
    [
      "IRQ",
      `module Main; import {setIRQ} from c64.system; interrupt function observe():void{poke($D020,1);} function main():void{let counter:byte=0;setIRQ(&observe);while(true){poke($D005,counter+21);counter+=1;}}`,
    ],
    [
      "initializer",
      `module Main; let seed:byte=peek($D012); function main():void{let counter:byte=seed;while(true){poke($D005,counter+21);counter+=1;}}`,
    ],
    [
      "alias",
      `module Main; function main():void{let counter:byte=0;let address:word=word(&counter);while(true){poke($D005,counter+21);poke($D007,peek(address));counter+=1;}}`,
    ],
    ["raw window read", sourceText.replace("counter+=1;", "poke($D007,peek($2455));counter+=1;")],
    ["CIA routing write", sourceText.replace("counter+=1;", "poke($DD00,0);counter+=1;")],
    ["firmware workspace write", sourceText.replace("counter+=1;", "poke($00D1,0);counter+=1;")],
    [
      "helper",
      `module Main; function sample():byte{return peek($D012);} function main():void{let counter:byte=0;while(true){counter=sample();poke($D005,counter+21);counter+=1;}}`,
    ],
  ] as const;
  it.each(observers)(
    "should decline the complete program with a %s observer",
    async (_name, text) => {
      expect(select(await fixture(text)).size).toBe(0);
    },
  );
});
