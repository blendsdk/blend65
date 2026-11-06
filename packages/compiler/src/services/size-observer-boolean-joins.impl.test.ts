import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import type { MachineFunction } from "../machine/machine-types.js";
import { validateByteWindowObservers } from "./size-observer-byte-windows.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateSizeObservers } from "./size-observers.js";
import type { FinalObserverInput } from "./size-observers.js";

const SOURCE = `module Game;let value:byte=3;let other:byte=1;let answer:byte;
function leaf():boolean{return (value&other)!=0;}
function guarded():boolean{return value!=other&&leaf();}
function main():void{if(guarded()){answer=7;}else{answer=9;}}`;

/** Resolve a real selected callee through its source name, never a guessed physical address. */
function guarded(input: FinalObserverInput): MachineFunction {
  const fn = input.candidate.shared.layout.program.functions.find(
    (body) => body.sourceName === "Game.guarded",
  );
  if (fn === undefined) throw new Error("Expected the captured Boolean caller");
  return fn;
}

/** Alter only final machine evidence after the actual symbolic certificate already exists. */
function withFinalBody(input: FinalObserverInput, body: MachineFunction): FinalObserverInput {
  const shared = input.candidate.shared;
  return {
    ...input,
    candidate: {
      ...input.candidate,
      shared: {
        ...shared,
        layout: {
          ...shared.layout,
          program: {
            ...shared.layout.program,
            functions: shared.layout.program.functions.map((fn) => (fn.id === body.id ? body : fn)),
          },
        },
      },
    },
  };
}

describe("final captured Boolean return proofs", () => {
  it.each([false, true])(
    "should independently close actual private merge homes with bounds=%s",
    (bounds) => {
      const input = effectFixture(SOURCE, "size", bounds, "original");
      const proofs = input.candidate.lowered.program.functions.flatMap(
        (fn) => fn.booleanCallProofs ?? [],
      );
      expect(proofs).toHaveLength(1);
      expect(proofs[0]?.kind).toBe("certified");
      const body = guarded(input);
      // Certification must preserve the actual memory traffic instead of hiding
      // the merge through a new return-shaping or allocation transformation.
      expect(
        body.blocks.flatMap((block) => block.instructions).filter(({ opcode }) => opcode === "sta")
          .length,
      ).toBeGreaterThanOrEqual(3);
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      expect(validateByteWindowObservers(input, effects)).toBeNull();
      expect(validateSizeObservers(input).kind).toBe("complete");
    },
  );

  it.each(["redirected reload", "wrong owner", "changed binding"] as const)(
    "should reject %s after symbolic certification",
    (mutation) => {
      const input = effectFixture(SOURCE, "size", false, "original");
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      const body = guarded(input);
      let changed: FinalObserverInput;
      if (mutation === "redirected reload") {
        changed = withFinalBody(input, {
          ...body,
          blocks: body.blocks.map((block) => {
            if (block.terminator.kind !== "return") return block;
            return {
              ...block,
              instructions: block.instructions.map((instruction) => {
                if (instruction.opcode !== "lda" || instruction.operand?.kind !== "absolute")
                  return instruction;
                return {
                  ...instruction,
                  operand: { ...instruction.operand, value: instruction.operand.value + 1 },
                };
              }),
            };
          }),
        });
      } else {
        const certificate = input.candidate.shared.certificate;
        const request = certificate.inventory.requests.find(
          (value) =>
            value.owner === body.sourceFunction &&
            value.bytes === 1 &&
            value.id.includes(":merge:"),
        );
        if (request === undefined) throw new Error("Expected the actual private merge request");
        const inventory =
          mutation === "wrong owner"
            ? {
                ...certificate.inventory,
                requests: certificate.inventory.requests.map((value) =>
                  value === request
                    ? { ...value, owner: input.checked.program.semantic.main }
                    : value,
                ),
              }
            : certificate.inventory;
        const closure =
          mutation === "changed binding"
            ? {
                ...certificate.certificate,
                homes: certificate.certificate.homes.map((home) =>
                  home.requestId === request.id ? { ...home, address: home.address + 1 } : home,
                ),
              }
            : certificate.certificate;
        changed = {
          ...input,
          candidate: {
            ...input.candidate,
            shared: {
              ...input.candidate.shared,
              certificate: { ...certificate, inventory, certificate: closure },
            },
          },
        };
      }
      expect(validateByteWindowObservers(changed, effects)?.kind).toBe("rejected");
      expect(validateSizeObservers(changed).kind).toBe("error");
    },
  );
});
