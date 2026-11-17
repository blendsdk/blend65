import { beforeAll, describe, expect, it } from "vitest";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import {
  BASE,
  changeWindow,
  closeSource,
  replaceBlocks,
  select,
  windowOf,
} from "./low-byte-write-forwarding-test-support.js";
import type { ClosedSource } from "./low-byte-write-forwarding-test-support.js";
import type { MachineLoweringInput } from "./machine-types.js";

describe("ordinary-word low-byte write forwarding barriers", () => {
  let base: ClosedSource;
  beforeAll(async () => {
    base = await closeSource();
  });

  it.each(["load", "extraction"] as const)(
    "requires supplied single-use membership for %s",
    (which) => {
      const { load, lo } = windowOf(base);
      expect(select(base, new Set([which === "load" ? lo.result : load.result]))).toEqual(
        new Set(),
      );
    },
  );

  it.each(["load", "extraction"] as const)(
    "recounts %s uses in cold operations, branches and returns",
    (which) => {
      const { load, lo } = windowOf(base);
      const value = which === "load" ? load.result : lo.result;
      const coldBlocks: SemanticBlock[] = [
        {
          id: "cold-operation",
          operations: [{ ...lo, result: "cold-copy", operand: value }],
          terminator: { kind: "unreachable" },
        },
        {
          id: "cold-branch",
          operations: [],
          terminator: {
            kind: "branch",
            condition: value,
            whenTrue: base.source.entry,
            whenFalse: base.source.entry,
          },
        },
        { id: "cold-return", operations: [], terminator: { kind: "return", value } },
      ];
      for (const cold of coldBlocks)
        expect(select(replaceBlocks(base, [...base.source.blocks, cold])), cold.id).toEqual(
          new Set(),
        );
    },
  );

  it.each(["before extraction", "before write"])("rejects even a pure gap %s", (where) => {
    const { lo } = windowOf(base);
    const fixture = changeWindow(base, (operations, index) =>
      operations.splice(index + (where === "before write" ? 1 : 0), 0, {
        kind: "constant",
        result: "gap",
        value: 0n,
        type: lo.type,
        integer: lo.integer,
        span: lo.span,
      }),
    );
    const { load, lo: original } = windowOf(base);
    expect(
      selectAnonymousByteWriteValues(
        fixture.input,
        fixture.source,
        fixture.source.blocks,
        new Set([load.result, original.result]),
      ),
    ).toEqual(new Set());
  });

  it.each(["named store", "comparison", "branch", "return"] as const)(
    "declines %s consumer metadata",
    (kind) => {
      const { block, index, load, lo } = windowOf(base);
      const operations = [...block.operations];
      operations.splice(index + 1, 1);
      let terminator = block.terminator;
      if (kind === "named store")
        operations.push({
          kind: "store",
          place: load.place,
          value: lo.result,
          type: lo.type,
          span: lo.span,
        });
      if (kind === "comparison")
        operations.push({
          kind: "binary",
          operator: "==",
          result: "comparison",
          left: lo.result,
          right: lo.result,
          type: { kind: "scalar", name: "boolean" },
          integer: null,
          span: lo.span,
        });
      if (kind === "branch")
        terminator = {
          kind: "branch",
          condition: lo.result,
          whenTrue: base.source.entry,
          whenFalse: base.source.entry,
        };
      if (kind === "return") terminator = { kind: "return", value: lo.result };
      const fixture = replaceBlocks(
        base,
        base.source.blocks.map((candidate) =>
          candidate === block ? { ...block, operations, terminator } : candidate,
        ),
      );
      expect(
        selectAnonymousByteWriteValues(
          fixture.input,
          fixture.source,
          fixture.source.blocks,
          new Set([load.result, lo.result]),
        ),
      ).toEqual(new Set());
    },
  );

  it("requires actual source/main identity and original block identity/order", () => {
    const { load, lo } = windowOf(base);
    const uses = new Set([load.result, lo.result]);
    const invoke = (
      input: MachineLoweringInput,
      source: SemanticFunction | undefined,
      blocks = base.source.blocks,
    ) => selectAnonymousByteWriteValues(input, source, blocks, uses);
    expect(invoke(base.input, undefined)).toEqual(new Set());
    expect(invoke(base.input, { ...base.source })).toEqual(new Set());
    expect(
      invoke(
        base.input,
        base.source,
        base.source.blocks.map((block) => ({ ...block })),
      ),
    ).toEqual(new Set());
    expect(invoke(base.input, base.source, [...base.source.blocks].reverse())).toEqual(new Set());
    const program = base.input.program;
    expect(
      invoke(
        {
          ...base.input,
          program: { ...program, semantic: { ...program.semantic, main: load.place.root } },
        },
        base.source,
      ),
    ).toEqual(new Set());
    expect(
      invoke(
        {
          ...base.input,
          program: { ...program, semantic: { ...program.semantic, functions: [] } },
        },
        base.source,
      ),
    ).toEqual(new Set());
  });

  it("fails closed for absent execution domains or interrupt context", () => {
    const { executionDomains, ...withoutDomains } = base.input.program;
    const { interruptContextAnalysis, ...withoutContext } = base.input.program;
    void executionDomains;
    void interruptContextAnalysis;
    expect(select({ ...base, input: { ...base.input, program: withoutDomains } })).toEqual(
      new Set(),
    );
    expect(select({ ...base, input: { ...base.input, program: withoutContext } })).toEqual(
      new Set(),
    );
  });

  it("does not select an unreachable producer", () => {
    const deadEntry: SemanticBlock = {
      id: "replacement-entry",
      operations: [],
      terminator: { kind: "return", value: null },
    };
    const changed = replaceBlocks(base, [deadEntry, ...base.source.blocks]);
    const source = { ...changed.source, entry: deadEntry.id };
    const fixture = {
      source,
      input: {
        ...changed.input,
        program: {
          ...changed.input.program,
          semantic: { ...changed.input.program.semantic, functions: [source] },
        },
      },
    };
    expect(select(fixture)).toEqual(new Set());
  });

  it.each([
    [
      "helper",
      `module Main; function sample():byte{return peek($D012);} function main():void{let value:word=$12A5;while(true){poke($D005,lo(value));value=word(sample());}}`,
    ],
    [
      "initializer",
      `module Main; let seed:byte=peek($D012); function main():void{let value:word=word(seed);while(true){poke($D005,lo(value));value+=257;}}`,
    ],
    [
      "IRQ",
      `module Main; import {setIRQ} from c64.system; interrupt function observe():void{poke($D020,1);} function main():void{let value:word=$12A5;setIRQ(&observe);while(true){poke($D005,lo(value));value+=257;}}`,
    ],
    [
      "address escape",
      `module Main; function main():void{let value:word=$12A5;let address:word=word(&value);while(true){poke($D005,lo(value));poke($D007,peek(address));value+=257;}}`,
    ],
    [
      "raw private-window access",
      BASE.replace("poke($D005,lo(value));", "poke($D005,lo(value));poke($D007,peek($2455));"),
    ],
    ["CIA routing", BASE.replace("poke($D005,lo(value));", "poke($D005,lo(value));poke($DD00,0);")],
    [
      "firmware workspace",
      BASE.replace("poke($D005,lo(value));", "poke($D005,lo(value));poke($00D1,0);"),
    ],
  ])("accepts %s source but declines its low-byte forwarding", async (_name, text) => {
    expect(select(await closeSource(text))).toEqual(new Set());
  });
});
