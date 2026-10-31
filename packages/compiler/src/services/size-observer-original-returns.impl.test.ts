import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import { failure } from "./size-observer-raw-layout.js";
import { isOriginalSharedByteReturn } from "./size-observer-original-returns.js";

/** Repeated typed constants produce real shared returns, including multi-alias chains. */
const SOURCES = [
  [
    "shared byte returns",
    "module Game;let data:byte[8]=[;0];let seed:byte=1;let answer:byte=0;function work():byte{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}if(seed==0){return 0;}if(seed==1){return 127;}if(seed==2){return 255;}if(seed==3){return 0;}if(seed==4){return 127;}if(seed==5){return 255;}if(seed==6){return 0;}if(seed==7){return 127;}return 255;}function main():void{answer=work();}",
  ],
  [
    "shared signed byte returns",
    "module Game;const LOW:sbyte=-128;const MIDDLE:sbyte=-1;const HIGH:sbyte=127;let data:byte[8]=[;0];let seed:byte=1;let answer:sbyte=0;function work():sbyte{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}if(seed==0){return LOW;}if(seed==1){return MIDDLE;}if(seed==2){return HIGH;}if(seed==3){return LOW;}if(seed==4){return MIDDLE;}if(seed==5){return HIGH;}if(seed==6){return LOW;}if(seed==7){return MIDDLE;}return HIGH;}function main():void{answer=work();}",
  ],
  [
    "shared enum returns",
    "module Game;enum Status{ZERO=0,MIDDLE=127,HIGH=255}let data:byte[8]=[;0];let seed:byte=1;let answer:Status=Status.ZERO;function work():Status{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}if(seed==0){return Status.ZERO;}if(seed==1){return Status.MIDDLE;}if(seed==2){return Status.HIGH;}if(seed==3){return Status.ZERO;}if(seed==4){return Status.MIDDLE;}if(seed==5){return Status.HIGH;}if(seed==6){return Status.ZERO;}if(seed==7){return Status.MIDDLE;}return Status.HIGH;}function main():void{answer=work();}",
  ],
] as const;

describe.each(SOURCES)("%s fragment", (_name, text) => {
  it.each([
    "valid",
    "return ID",
    "return type",
    "enum identity",
    "extra source",
    "underflow",
    "overflow",
    "Boolean value",
    "word ABI",
    "aggregate ABI",
    "terminal value",
    "terminal mode",
    "terminal memory",
    "terminal instruction",
    "alias instruction",
    "alias JMP",
    "alias origin",
    "alias cycle",
  ])("should enforce the exact typed contract: %s", (damage) => {
    const input = effectFixture(text, "size", false, "original");
    const semantic = input.checked.program.semantic;
    const functions = semantic.functions.filter((fn) => fn.id !== semantic.main);
    expect(functions).toHaveLength(1);
    const fn = functions[0]!;
    for (const shared of [input.reference.shared, input.candidate.shared]) {
      const machine = shared.layout.program.functions.find(
        (actual) => actual.sourceFunction === fn.id,
      )!;
      const actual = new Map(machine.blocks.map((block) => [block.label, block]));
      const [source, labels] = machine.observerBlocks!.find(
        ([body, labels]) =>
          body.terminator.kind === "return" &&
          body.operations.length === 1 &&
          body.operations[0]!.kind === "constant" &&
          actual.get(labels[0]!)?.instructions.length === 0,
      )!;
      const block = actual.get(labels[0]!)!,
        value = source.operations[0]!;
      if (value.kind !== "constant" || block.terminator.kind !== "fallthrough")
        throw new Error("Expected a real shared return");
      /** Resolve real aliases, without treating jumps or displaced origins as transparent. */
      const canonical = (label: string) => {
        const seen = new Set<string>();
        let current = actual.get(label);
        while (current?.instructions.length === 0 && current.terminator.kind === "fallthrough") {
          const next = actual.get(current.terminator.target);
          if (seen.has(current.label) || next === undefined || current.origin !== next.origin)
            return failure("error", "Invalid actual alias");
          seen.add(current.label);
          current = next;
        }
        return current?.label ?? failure("error", "Missing actual label");
      };
      const endpoint = canonical(block.label);
      if (typeof endpoint !== "string") throw new Error(endpoint.reason);
      const terminal = actual.get(endpoint)!,
        load = terminal.instructions[0]!;
      expect(actual.get(block.terminator.target)!.instructions.length).toBe(0);
      expect(
        isOriginalSharedByteReturn(source, fn.result, block, endpoint, actual, canonical),
      ).toBe(true);
      let type: SemanticType = value.type,
        raw = value.value;
      const signed = type.kind === "scalar" && type.name === "sbyte";
      if (damage === "underflow") raw = signed ? -129n : -1n;
      if (damage === "overflow") raw = signed ? 128n : 256n;
      if (damage === "Boolean value") {
        type = { kind: "scalar", name: "boolean" };
        raw = 1n;
      }
      if (damage === "word ABI") {
        type = { kind: "scalar", name: "word" };
        raw = 0n;
      }
      if (damage === "aggregate ABI")
        type = { kind: "array", element: { kind: "scalar", name: "byte" }, length: 1, size: 1 };
      let expected: SemanticType =
        damage === "return type" ? { kind: "scalar", name: "word" } : type;
      if (damage === "enum identity")
        expected =
          type.kind === "enum"
            ? {
                ...type,
                binding: {
                  ...type.binding,
                  span: { ...type.binding.span, start: type.binding.span.start + 1 },
                },
              }
            : { kind: "scalar", name: "word" };
      const modified = {
        ...source,
        operations: damage === "extra source" ? [value, value] : [{ ...value, type, value: raw }],
        terminator:
          damage === "return ID"
            ? { kind: "return" as const, value: "unrelated" }
            : source.terminator,
      };
      const encoded =
        typeof raw === "boolean"
          ? Number(raw)
          : typeof raw === "bigint"
            ? Number(BigInt.asUintN(8, raw))
            : 0;
      const changedLoad = {
        ...load,
        mode: damage === "terminal mode" ? "absolute" : load.mode,
        operand: {
          kind: "immediate" as const,
          value: damage === "terminal value" ? (encoded + 1) & 255 : encoded,
        },
        memory:
          damage === "terminal memory"
            ? [
                {
                  kind: "read" as const,
                  address: { kind: "absolute" as const, value: 0 },
                  width: 1 as const,
                  volatile: false,
                  order: 0,
                },
              ]
            : load.memory,
      };
      actual.set(endpoint, {
        ...terminal,
        instructions:
          damage === "terminal instruction" ? [changedLoad, changedLoad] : [changedLoad],
      });
      const changedBlock = {
        ...block,
        instructions: damage === "alias instruction" ? [load] : block.instructions,
        ...(damage === "alias origin" ? { origin: block.origin! + 1 } : {}),
        terminator:
          damage === "alias JMP"
            ? {
                kind: "jump" as const,
                opcode: "jmp" as const,
                target: endpoint,
                cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
              }
            : damage === "alias cycle"
              ? { kind: "fallthrough" as const, target: block.label }
              : block.terminator,
      };
      actual.set(block.label, changedBlock);
      expect(
        isOriginalSharedByteReturn(modified, expected, changedBlock, endpoint, actual, canonical),
      ).toBe(damage === "valid");
    }
  });
});
