import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateByteWindowObservers } from "./size-observer-byte-windows.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { machineInstruction } from "../machine/lower-control.js";
import type { ByteAvailabilityProof, MachineFunction } from "../machine/machine-types.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Actual reference/candidate constructions, not manufactured successful proofs. */
type Fixture = ReturnType<typeof effectFixture>;
/** Every physical corruption contrast identifies its independently built layout. */
type Side = "before" | "after";

/** The complete ordinary source whose byte-edge admission must compose with Boolean returns. */
const BYTE_SOURCE = `module Game;let value:byte=3;let other:byte=1;let answer:byte;
function predicate():boolean{return value!=other&&(value&other)!=0;}
function main():void{if(predicate()){answer=7;}else{answer=9;}}`;

/** Scalar parameters exercise actual SFA identities rather than resident global symbols. */
const HOME_SOURCE = BYTE_SOURCE.replace(
  "function predicate():boolean",
  "function predicate(value:byte,other:byte):boolean",
).replace("if(predicate())", "if(predicate(value,other))");

/** Raw reads are separately closed; only the Boolean call's machine-state window changes. */
const BOOLEAN_RAW_SOURCE = `module Game;let seed:byte=1;let data:byte[8]=[;0];let answer:byte=0;
function predicate():boolean{return seed!=0;}
function work():byte{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}if(predicate()){return 7;}return 9;}
function main():void{answer=work();}`;
/** A fixed const borrow remains an object obligation, not an observation of returned carry. */
const BOOLEAN_BORROW_SOURCE = BOOLEAN_RAW_SOURCE.replace(
  "let seed:byte=1;",
  "struct Flag{value:byte;}let seed:Flag={value:1};",
)
  .replace(
    "predicate():boolean{return seed!=0;}",
    "predicate(value:const Flag):boolean{return value.value!=0;}",
  )
  .replace("if(predicate())", "if(predicate(seed))");

/** Locate a window only through its actual producer record. */
function window(input: Fixture, side: Side) {
  const symbolic = input.candidate.lowered.program.functions.find(
    (fn) => fn.byteAvailabilityProofs?.length === 1,
  );
  const proof = symbolic?.byteAvailabilityProofs?.[0];
  const shared = side === "before" ? input.reference.shared : input.candidate.shared;
  const body = shared.layout.program.functions.find((fn) => fn.id === symbolic?.id);
  if (symbolic === undefined || proof === undefined || body === undefined)
    throw new Error("Expected real byte-window construction");
  return { symbolic, proof, shared, body };
}

/** This direct result tests the focused checker; it never authenticates a changed tuple. */
function focused(input: FinalObserverInput) {
  const effects = validateResidualEffects(input);
  if (effects.kind !== "complete") throw new Error("Expected separately discharged source effects");
  return validateByteWindowObservers(input, effects);
}

/** Replace one actual final body without modifying its source or symbolic proof. */
function withBody(
  input: Fixture,
  side: Side,
  update: (body: MachineFunction, proof: ByteAvailabilityProof) => MachineFunction,
) {
  const saved = window(input, side);
  const shared = {
    ...saved.shared,
    layout: {
      ...saved.shared.layout,
      program: {
        ...saved.shared.layout.program,
        functions: saved.shared.layout.program.functions.map((fn) =>
          fn === saved.body ? update(fn, saved.proof) : fn,
        ),
      },
    },
  };
  return side === "before"
    ? { ...input, reference: { ...input.reference, shared } }
    : { ...input, candidate: { ...input.candidate, shared } };
}

/** Tamper only the symbolic association to distinguish byte identity from coincident addresses. */
function withProof(
  input: Fixture,
  update: (proof: ByteAvailabilityProof) => ByteAvailabilityProof,
) {
  const saved = window(input, "after");
  return {
    ...input,
    candidate: {
      ...input.candidate,
      lowered: {
        ...input.candidate.lowered,
        program: {
          ...input.candidate.lowered.program,
          functions: input.candidate.lowered.program.functions.map((fn) =>
            fn === saved.symbolic
              ? { ...fn, byteAvailabilityProofs: fn.byteAvailabilityProofs!.map(update) }
              : fn,
          ),
        },
      },
    },
  };
}

/** A damaged focused premise and an unauthenticated tuple fail at their separate boundaries. */
function expectInvalid(input: FinalObserverInput, reason: string): void {
  expect(focused(input)).toMatchObject({ kind: "rejected", reason });
  expect(validateSizeObservers(input).kind).toBe("error");
}

describe("final byte-window observers", () => {
  it.each([false, true])("should compose raw effects with both windows (%s)", (bounds) => {
    const source = BOOLEAN_RAW_SOURCE.replace(
      "let seed:byte=1;",
      "let seed:byte=3;let other:byte=1;",
    ).replace("return seed!=0;", "return seed!=other&&(seed&other)!=0;");
    const input = effectFixture(source, "size", bounds, "original");
    expect(validateResidualEffects(input)).toHaveProperty("operations.size", 1);
    const functions = input.candidate.lowered.program.functions;
    expect(functions.flatMap((fn) => fn.booleanCallProofs ?? [])).toHaveLength(1);
    expect(functions.flatMap((fn) => fn.byteAvailabilityProofs ?? [])).toHaveLength(1);
    expect(focused(input)).toBeNull();
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each([BOOLEAN_RAW_SOURCE, BOOLEAN_BORROW_SOURCE])(
    "should compose discharged raw and borrow effects with returned Boolean flags in %s",
    (source) => {
      for (const bounds of [false, true])
        for (const negated of [false, true]) {
          const text = source.replace(
            "if(predicate(",
            negated ? "if(!predicate(" : "if(predicate(",
          );
          const input = effectFixture(text, "size", bounds, "original");
          const functions = input.candidate.lowered.program.functions;
          const proofs = functions.flatMap((fn) => fn.booleanCallProofs ?? []);
          expect(proofs).toHaveLength(1);
          expect(proofs[0]!.removed).toHaveLength(negated ? 1 : 0);
          expect(functions.flatMap((fn) => fn.byteAvailabilityProofs ?? [])).toHaveLength(0);
          const effects = validateResidualEffects(input);
          expect(effects.kind).toBe("complete");
          if (effects.kind !== "complete") throw new Error(effects.reason);
          expect(effects.operations.size).toBeGreaterThan(0);
          const certificate = input.candidate.shared.certificate;
          expect(focused(input)).toBeNull();
          expect(validateSizeObservers(input).kind).toBe("complete");
          expect(input.candidate.shared.certificate).toBe(certificate);
          expect(validateSizeObservers(effectFixture(text, "none", bounds)).kind).toBe("complete");
        }
    },
  );

  it.each(["target", "fallthrough"])(
    "should reject carry observation on the Boolean %s continuation",
    (successor) => {
      const input = effectFixture(
        BOOLEAN_RAW_SOURCE.replace("if(predicate())", "if(!predicate())"),
        "size",
        false,
        "original",
      );
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      expect(validateByteWindowObservers(input, effects)).toBeNull();
      const symbolic = input.candidate.lowered.program.functions.find(
        (fn) => fn.booleanCallProofs?.length === 1,
      )!;
      const proof = symbolic.booleanCallProofs![0]!;
      expect(proof.removed).toHaveLength(1);
      const shared = input.candidate.shared;
      const caller = shared.layout.program.functions.find((fn) => fn.id === symbolic.id)!;
      const edge = caller.blocks.find((block) => block.label === proof.block)!.terminator;
      if (edge.kind !== "branch" && edge.kind !== "long-branch")
        throw new Error("Expected the actual Boolean branch");
      const label =
        successor === "fallthrough"
          ? edge.fallthrough
          : edge.kind === "branch"
            ? edge.target
            : edge.jump.target;
      for (const opcode of ["php", "adc"] as const) {
        const instruction =
          opcode === "php"
            ? machineInstruction(input.checked.profile.cpu, opcode, "implied", null)
            : machineInstruction(input.checked.profile.cpu, opcode, "immediate", {
                kind: "immediate",
                value: 0,
              });
        const modified = {
          ...input,
          candidate: {
            ...input.candidate,
            shared: {
              ...shared,
              layout: {
                ...shared.layout,
                program: {
                  ...shared.layout.program,
                  functions: shared.layout.program.functions.map((fn) =>
                    fn !== caller
                      ? fn
                      : {
                          ...fn,
                          blocks: fn.blocks.map((block) =>
                            block.label !== label
                              ? block
                              : { ...block, instructions: [instruction, ...block.instructions] },
                          ),
                        },
                  ),
                },
              },
            },
          },
        };
        expect(validateByteWindowObservers(modified, effects)).toMatchObject({
          kind: "rejected",
          reason: "Actual Boolean continuation can observe changed carry",
        });
        expect(validateSizeObservers(modified).kind).toBe("error");
      }
    },
  );

  it("should close the original comparison/AND source together with its Boolean call", () => {
    const input = effectFixture(BYTE_SOURCE, "size", true, "original");
    const functions = input.candidate.lowered.program.functions;
    expect(functions.flatMap((fn) => fn.byteAvailabilityProofs ?? [])).toHaveLength(1);
    expect(functions.flatMap((fn) => fn.booleanCallProofs ?? [])).toHaveLength(1);
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each([BYTE_SOURCE, HOME_SOURCE])(
    "should resolve both actual backing classes with bounds on/off",
    (source) => {
      for (const bounds of [true, false]) {
        const input = effectFixture(source, "size", bounds, "original");
        expect(focused(input)).toBeNull();
        expect(validateSizeObservers(input).kind).toBe("complete");
        const before = window(input, "before"),
          after = window(input, "after");
        expect(after.proof.left.kind).toBe(source === HOME_SOURCE ? "home" : "symbol");
        const sourceRead = before.body.blocks.find((block) => block.label === before.proof.to)!;
        const selectedRead = after.body.blocks.find((block) => block.label === after.proof.to)!;
        expect(sourceRead.instructions.slice(0, 2).map(({ opcode }) => opcode)).toEqual([
          "lda",
          "and",
        ]);
        expect(selectedRead.instructions[0]?.opcode).toBe("and");
        const producer = after.body.blocks.find((block) => block.label === after.proof.from)!;
        const reference = before.body.blocks.find((block) => block.label === before.proof.from)!;
        expect(producer.instructions.slice(-2).map(({ opcode }) => opcode)).toEqual(["lda", "cmp"]);
        expect(reference.instructions.slice(-2).map(({ opcode }) => opcode)).toEqual([
          "lda",
          "eor",
        ]);
        const selectedWindow = [...producer.instructions.slice(-2), selectedRead.instructions[0]!];
        const originalWindow = [
          ...reference.instructions.slice(-2),
          ...sourceRead.instructions.slice(0, 2),
        ];
        expect(selectedWindow.map(({ mode }) => mode)).toEqual([
          "absolute",
          "absolute",
          "absolute",
        ]);
        expect(selectedWindow.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(
          9,
        );
        expect(originalWindow.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(
          12,
        );
        expect(
          selectedWindow.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0),
        ).toBe(12);
        expect(
          originalWindow.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0),
        ).toBe(16);
      }
    },
  );

  it("should reject absent, displaced and different byte identities", () => {
    for (const source of [BYTE_SOURCE, HOME_SOURCE]) {
      const input = effectFixture(source, "size", true, "original");
      expectInvalid(
        withProof(input, (proof) => ({ ...proof, left: { ...proof.left, id: "missing-byte" } })),
        "Byte window has no complete actual backing identity",
      );
      expectInvalid(
        withProof(input, (proof) => ({ ...proof, left: { ...proof.left, offset: 1 } })),
        "Byte window has no complete actual backing identity",
      );
      expectInvalid(
        withProof(input, (proof) => ({ ...proof, left: proof.right })),
        "Byte final copy-free template or resolved reads disagree",
      );
    }
  });

  it.each(["before", "after"] as const)("should reject a wrong %s effective read", (side) => {
    const input = effectFixture(BYTE_SOURCE, "size", false, "original");
    expectInvalid(
      withBody(input, side, (body, proof) => ({
        ...body,
        blocks: body.blocks.map((block) =>
          block.label === proof.from
            ? {
                ...block,
                instructions: block.instructions.map((instruction, index) =>
                  index === block.instructions.length - 2
                    ? { ...instruction, operand: { kind: "absolute" as const, value: 0xc200 } }
                    : instruction,
                ),
              }
            : block,
        ),
      })),
      "Byte final copy-free template or resolved reads disagree",
    );
  });

  it.each(["before", "after"] as const)("should reject wrong %s branch polarity", (side) => {
    const input = effectFixture(BYTE_SOURCE, "size", true, "original");
    expectInvalid(
      withBody(input, side, (body, proof) => ({
        ...body,
        blocks: body.blocks.map((block) =>
          block.label === proof.from && block.terminator.kind === "branch"
            ? {
                ...block,
                terminator: {
                  ...block.terminator,
                  opcode: block.terminator.opcode === "beq" ? ("bne" as const) : ("beq" as const),
                },
              }
            : block,
        ),
      })),
      "Byte final branch does not preserve its source successors",
    );
  });

  it.each(["before", "after"] as const)("should reject an alternate %s consumer entry", (side) => {
    const input = effectFixture(BYTE_SOURCE, "size", false, "original");
    expectInvalid(
      withBody(input, side, (body, proof) => ({
        ...body,
        blocks: [
          ...body.blocks,
          {
            label: "unchecked-entry",
            origin: body.blocks[0]!.origin!,
            instructions: [],
            terminator: { kind: "fallthrough" as const, target: proof.to },
          },
        ],
      })),
      "Byte consumer has an alternate or addressed entry",
    );
  });

  it.each(["before", "after"] as const)(
    "should reject %s code between the retained byte and AND",
    (side) => {
      const input = effectFixture(BYTE_SOURCE, "size", false, "original");
      expectInvalid(
        withBody(input, side, (body, proof) => ({
          ...body,
          blocks: body.blocks.map((block) =>
            block.label === proof.to
              ? {
                  ...block,
                  instructions: [
                    machineInstruction(
                      input.checked.profile.cpu,
                      "nop",
                      "implied",
                      null,
                      [],
                      proof.consumer,
                    ),
                    ...block.instructions,
                  ],
                }
              : block,
          ),
        })),
        "Byte final copy-free template or resolved reads disagree",
      );
    },
  );

  it.each(["after-and", "sibling-a", "sibling-status", "sibling-adc"])(
    "should reject changed-state observation at %s",
    (where) => {
      const input = effectFixture(BYTE_SOURCE, "size", false, "original");
      const modified = withBody(input, "after", (body, proof) => {
        const producer = body.blocks.find((block) => block.label === proof.from)!;
        const edge = producer.terminator;
        if (edge.kind !== "branch") throw new Error("Expected actual short byte edge");
        const sibling = edge.target === proof.to ? edge.fallthrough : edge.target;
        const instruction =
          where === "sibling-a"
            ? machineInstruction(input.checked.profile.cpu, "sta", "absolute", {
                kind: "absolute",
                value: 0xc200,
              })
            : where === "sibling-adc"
              ? machineInstruction(input.checked.profile.cpu, "adc", "immediate", {
                  kind: "immediate",
                  value: 0,
                })
              : machineInstruction(input.checked.profile.cpu, "php", "implied", null);
        return {
          ...body,
          blocks: body.blocks.map((block) => {
            if (block.label === (where === "after-and" ? proof.to : sibling)) {
              const first = where === "after-and" ? 1 : 0;
              return {
                ...block,
                instructions: [
                  ...block.instructions.slice(0, first),
                  instruction,
                  ...block.instructions.slice(first),
                ],
              };
            }
            return block;
          }),
        };
      });
      expectInvalid(modified, "Byte continuation can observe changed accumulator or flags");
    },
  );

  it("should preserve Boolean-first rejection even when its byte window is complete", () => {
    const input = effectFixture(BYTE_SOURCE, "size", true, "original");
    const modified = {
      ...input,
      candidate: {
        ...input.candidate,
        lowered: {
          ...input.candidate.lowered,
          program: {
            ...input.candidate.lowered.program,
            functions: input.candidate.lowered.program.functions.map((fn) => ({
              ...fn,
              ...(fn.booleanCallProofs === undefined
                ? {}
                : {
                    booleanCallProofs: fn.booleanCallProofs.map((proof) => ({
                      ...proof,
                      kind: "retest" as const,
                    })),
                  }),
            })),
          },
        },
      },
    };
    expectInvalid(modified, "Boolean suffix needs a stronger machine-state proof");
  });

  it.each(["asm_php();asm_plp();", "poke($C100,value);", "poke($D020,value);"])(
    "should retain source observation barrier %s",
    (prefix) => {
      const source = BYTE_SOURCE.replace(
        "function predicate():boolean{",
        `function predicate():boolean{${prefix}`,
      );
      const input = effectFixture(source, "size", true, "original");
      expect(validateSizeObservers(input).kind).toBe("rejected");
      expect(validateSizeObservers(effectFixture(source, "none", true)).kind).toBe("complete");
    },
  );

  it("should retain the asynchronous source boundary", () => {
    const source = BYTE_SOURCE.replace(
      "module Game;",
      "module Game;import {setIRQ,restoreIRQ} from c64.system;",
    )
      .replace(
        "function main():void{",
        "interrupt function handler():void{}function main():void{setIRQ(&handler);",
      )
      .replace("answer=9;}}", "answer=9;}restoreIRQ();}");
    expect(validateSizeObservers(effectFixture(source, "size", true, "original")).kind).toBe(
      "rejected",
    );
  });
});
