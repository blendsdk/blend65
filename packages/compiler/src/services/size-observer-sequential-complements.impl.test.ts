import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { machineInstruction } from "../machine/lower-control.js";
import type { MachineFunction } from "../machine/machine-types.js";
import { validateByteComplementObservers } from "./size-observer-byte-complements.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateSizeObservers } from "./size-observers.js";

const SOURCE = `module Game;let sample:byte=7;let answers:byte[8];
function stable():void{
  for(let i:word=0;i<4;i+=1){answers[i]=~sample;}
  for(let j:word=4;j<8;j+=1){answers[j]=~sample;}
}
function main():void{stable();}`;

/** Keep symbolic and bound corruption consistent so binding checks cannot mask a later-loop gap. */
function corruptBody(
  input: ReturnType<typeof effectFixture>,
  update: (body: MachineFunction, physical: boolean) => MachineFunction,
) {
  const rewrite = (functions: readonly MachineFunction[], physical: boolean) =>
    functions.map((fn) => (fn.sourceName === "Game.stable" ? update(fn, physical) : fn));
  return {
    ...input,
    candidate: {
      lowered: {
        ...input.candidate.lowered,
        program: {
          ...input.candidate.lowered.program,
          functions: rewrite(input.candidate.lowered.program.functions, false),
        },
      },
      shared: {
        ...input.candidate.shared,
        layout: {
          ...input.candidate.shared.layout,
          program: {
            ...input.candidate.shared.layout.program,
            functions: rewrite(input.candidate.shared.layout.program.functions, true),
          },
        },
      },
    },
  };
}

describe("sequential stable-byte complement closure", () => {
  it.each([false, true])(
    "should close one unchanged byte cache across two loops with bounds=%s",
    (bounds) => {
      const input = effectFixture(SOURCE, "size", bounds, "original");
      const fn = input.candidate.lowered.program.functions.find(
        (body) => body.sourceName === "Game.stable",
      );
      const proofs = fn?.byteComplementProofs;
      expect(proofs).toHaveLength(2);
      expect(new Set(proofs?.map((proof) => proof.cacheRequestId)).size).toBe(1);
      const actual = input.candidate.shared.layout.program.functions.find(
        (body) => body.id === fn?.id,
      );
      expect(
        actual?.blocks
          .flatMap((block) => block.instructions)
          .filter(({ opcode }) => opcode === "eor"),
      ).toHaveLength(1);
      expect(validateSizeObservers(input)).toMatchObject({ kind: "complete" });
    },
  );

  it.each(["later reload", "source overwrite", "cache overwrite"] as const)(
    "should reject a %s in the second loop even when the first loop is valid",
    (mutation) => {
      const input = effectFixture(SOURCE, "size", false, "original");
      const selected = input.candidate.lowered.program.functions.find(
        (fn) => fn.sourceName === "Game.stable",
      );
      const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
      const packet = [...facts.functions.values()].find(
        (value) => value.function.id === selected?.sourceFunction,
      );
      const loop = packet?.loops[1];
      const id = selected?.byteComplementProofs?.[0]?.cacheRequestId;
      const home = input.candidate.shared.certificate.certificate.homes.find(
        (value) => value.requestId === id,
      );
      const object = input.candidate.shared.layout.program.data.find(
        (value) => value.sourceName === "Game.sample",
      );
      const global = input.candidate.shared.layout.intervals.find(
        (value) => value.id === object?.id,
      );
      if (
        selected === undefined ||
        loop === undefined ||
        id == null ||
        home === undefined ||
        global === undefined
      )
        throw new Error("Expected the real two-loop cache, source and homes");
      const labels = new Map(selected.observerBlocks);
      const label = labels.get(mutation === "later reload" ? loop.body : loop.preheader)?.[0];
      const modified = corruptBody(input, (fn, physical) => ({
        ...fn,
        blocks: fn.blocks.map((block) => {
          if (block.label !== label) return block;
          const instructions =
            mutation === "later reload"
              ? block.instructions.map((instruction) => {
                  const operand = instruction.operand;
                  if (instruction.opcode !== "lda") return instruction;
                  if (!physical && operand?.kind === "storage" && operand.requestId === id)
                    return { ...instruction, operand: { ...operand, offset: 1 } };
                  if (physical && operand?.kind === "absolute" && operand.value === home.address)
                    return { ...instruction, operand: { ...operand, value: operand.value + 1 } };
                  return instruction;
                })
              : [
                  ...block.instructions,
                  machineInstruction(input.checked.profile.cpu, "sta", "absolute", {
                    kind: "absolute",
                    value: mutation === "source overwrite" ? global.start : home.address,
                  }),
                ];
          return { ...block, instructions };
        }),
      }));
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      expect(validateByteComplementObservers(modified, effects)).toMatchObject({
        kind: "rejected",
      });
      expect(validateSizeObservers(modified).kind).toBe("error");
    },
  );
});
