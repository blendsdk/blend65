import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import type { MachineBlock, MachineFunction } from "../machine/machine-types.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateSizeObservers } from "./size-observers.js";

/** A literal left operand keeps the explicit count-zero comparison. */
const BOUNDED_SHIFT_SOURCE =
  "module Game;let data:byte[8]=[;0];let seed:byte=3;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}let count:byte=seed&7;answer=1<<count;}";
/** Private operands allow the final X load to supply fresh count-zero flags. */
const FRESH_SHIFT_SOURCE =
  "module Game;let data:byte[8]=[;0];let seed:byte=3;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}let value:byte=seed;let count:byte=seed&7;answer=value<<count;}";

describe.each(["reference", "candidate"] as const)("%s shift rejection", (side) => {
  it.each([
    "reload X",
    "flag clobber",
    "wrong branch",
    "wrong shift",
    "wrong span",
    "wrong zero",
    "stale zero",
    "count origin",
    "zero bypass",
    "foreign entry",
    "foreign successor",
    "extra backedge",
    "alias instruction",
    "alias displacement",
    "alias cycle",
    "duplicate owner",
    "reordered blocks",
  ])("should reject %s locally and atomically", (damage) => {
    const fresh = damage === "stale zero" || damage === "count origin";
    const input = effectFixture(
      fresh ? FRESH_SHIFT_SOURCE : BOUNDED_SHIFT_SOURCE,
      "size",
      false,
      "original",
    );
    const shared = side === "reference" ? input.reference.shared : input.candidate.shared;
    const functions = shared.layout.program.functions.map<MachineFunction>((fn) => {
      if (fn.sourceFunction !== input.checked.program.semantic.main) return fn;
      const kernel = fn.blocks.find(
        (block) =>
          block.terminator.kind === "branch" &&
          block.terminator.target === block.label &&
          block.instructions.some((item) => item.opcode === "dex"),
      )!;
      const edge = kernel.terminator;
      if (edge.kind !== "branch") throw new Error("Expected the real counted kernel");
      const zero = fn.blocks.find(
        (block) =>
          block.terminator.kind === "branch" &&
          block.terminator.opcode === "beq" &&
          block.terminator.fallthrough === kernel.label,
      )!;
      const alias = fn.blocks.find(
        (block) =>
          block.instructions.length === 0 &&
          block.terminator.kind === "fallthrough" &&
          block.terminator.target === zero.label,
      )!;
      const entry = fn.blocks.find(
        (block) =>
          block.instructions.some((item) => item.opcode === "ldx") &&
          block.terminator.kind === "fallthrough" &&
          [alias.label, zero.label].includes(block.terminator.target),
      )!;
      return {
        ...fn,
        observerBlocks: fn.observerBlocks!.map(
          ([source, labels], index) =>
            [
              source,
              damage === "duplicate owner" && index === 0
                ? [...labels, kernel.label]
                : damage === "reordered blocks" && labels.includes(kernel.label)
                  ? labels.map((label) =>
                      label === zero.label
                        ? kernel.label
                        : label === kernel.label
                          ? zero.label
                          : label,
                    )
                  : labels,
            ] as const,
        ),
        blocks: fn.blocks.map<MachineBlock>((block) => {
          if (block === alias) {
            if (damage === "alias instruction")
              return { ...block, instructions: [kernel.instructions[0]!] };
            if (damage === "alias displacement") return { ...block, origin: block.origin! + 1 };
            if (damage === "alias cycle")
              return { ...block, terminator: { kind: "fallthrough", target: block.label } };
          }
          if (block === fn.blocks[0] && damage === "foreign entry")
            return {
              ...block,
              terminator: {
                kind: "jump",
                opcode: "jmp",
                target: kernel.label,
                cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
              },
            };
          if (block === zero && damage === "wrong zero")
            return {
              ...block,
              instructions: [
                { ...block.instructions[0]!, operand: { kind: "immediate", value: 1 } },
              ],
            };
          if (block === entry) {
            if (damage === "zero bypass")
              return { ...block, terminator: { kind: "fallthrough", target: kernel.label } };
            const instructions = [...block.instructions];
            if (damage === "stale zero")
              instructions.push({
                ...kernel.instructions[0]!,
                opcode: "lda",
                mode: "immediate",
                operand: { kind: "immediate", value: 1 },
              });
            if (damage === "count origin")
              instructions[instructions.length - 1] = {
                ...instructions.at(-1)!,
                source:
                  kernel.instructions[0]!.source === null
                    ? null
                    : { ...kernel.instructions[0]!.source!, start: 0 },
              };
            return { ...block, instructions };
          }
          if (block !== kernel) return block;
          const instructions = [...block.instructions];
          if (damage === "reload X")
            instructions.splice(1, 0, {
              ...instructions[1]!,
              opcode: "ldx",
              mode: "immediate",
              operand: { kind: "immediate", value: 7 },
            });
          if (damage === "flag clobber")
            instructions.push({
              ...instructions[0]!,
              opcode: "lda",
              mode: "immediate",
              operand: { kind: "immediate", value: 1 },
            });
          if (damage === "wrong shift") instructions[0] = { ...instructions[0]!, opcode: "lsr" };
          if (damage === "wrong span")
            instructions[0] = {
              ...instructions[0]!,
              source: {
                ...instructions[0]!.source!,
                start: 0,
              },
            };
          return {
            ...block,
            instructions,
            terminator:
              damage === "wrong branch"
                ? { ...edge, opcode: "beq" }
                : damage === "foreign successor"
                  ? { ...edge, fallthrough: fn.blocks[0]!.label }
                  : damage === "extra backedge"
                    ? { ...edge, fallthrough: kernel.label }
                    : edge,
          };
        }),
      };
    });
    const damaged = {
      ...shared,
      layout: { ...shared.layout, program: { ...shared.layout.program, functions } },
    };
    const changed =
      side === "reference"
        ? { ...input, reference: { ...input.reference, shared: damaged } }
        : { ...input, candidate: { ...input.candidate, shared: damaged } };
    expect(validateResidualEffects(changed).kind).not.toBe("complete");
    expect(validateSizeObservers(changed).kind).toBe("error");
  });
});
