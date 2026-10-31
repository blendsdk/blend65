import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateFieldComplements } from "./size-observer-complement-fields.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { machineInstruction } from "../machine/lower-control.js";
import { findNamedObjectBacking } from "./size-observer-backing.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { MachineFunction } from "../machine/machine-types.js";
import type { ByteComplementProof } from "../machine/byte-value-availability.js";
import type { StorageRequest } from "../storage/storage-types.js";

/** Genuine independently lowered and closed constructions. */
type Fixture = ReturnType<typeof effectFixture>;
/** Each damaged premise belongs to its own original or selected layout. */
type Side = "before" | "after";

/** Exact ordinary source migrated from its former unsupported-Original rejection. */
const FIELD_SOURCE = `module Game;struct Cell{pad:word;value:byte;}let cell:Cell={pad:0,value:7};let mask:byte=5;let answers:byte[4];
function work(p:const Cell):void{let inverse:byte=~p.value;for(let i:word=0;i<4;i+=1){answers[i]=mask&~inverse;}}
function main():void{work(cell);}`;

/** The same ordinary object resides in its caller rather than in module data. */
const PRIVATE_SOURCE = FIELD_SOURCE.replace("let cell:Cell={pad:0,value:7};", "").replace(
  "function main():void{",
  "function main():void{let cell:Cell={pad:0,value:7};",
);

/** Locate original selections only through actual producer records. */
function field(input: Fixture) {
  const selected = input.candidate.lowered.program.functions.find((fn) =>
    fn.byteComplementProofs?.some((proof) => proof.kind === "original"),
  );
  const proof = selected?.byteComplementProofs?.[0];
  const packet = [
    ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
  ].find((packet) => packet.function.id === selected?.sourceFunction);
  if (selected === undefined || proof?.selection === undefined || packet === undefined)
    throw new Error("Expected real Original field construction");
  const parameter = [...packet.storage!.parameters.values()][0]!;
  return { selected, proof, packet, parameter, recipe: proof.selection[1] };
}

/** Reference AND operands identify the actual RHS capture without request-prefix parsing. */
function rhsId(input: Fixture): string {
  const before = input.reference.checked.lowered.program.functions.find(
    (fn) => fn.id === field(input).selected.id,
  )!;
  const operand = before.blocks
    .flatMap((block) => block.instructions)
    .find((instruction) => instruction.opcode === "and")?.operand;
  if (operand?.kind !== "storage") throw new Error("Expected actual RHS capture operand");
  return operand.requestId;
}

/** Change one function on both sides, without minting successful provenance. */
function withBody(
  input: Fixture,
  side: Side,
  owner: BindingId,
  update: (fn: MachineFunction, physical: boolean) => MachineFunction,
): Fixture {
  const original = side === "before" ? input.reference.checked.lowered : input.candidate.lowered;
  const shared = side === "before" ? input.reference.shared : input.candidate.shared;
  const lowered = {
    ...original,
    program: {
      ...original.program,
      functions: original.program.functions.map((fn) =>
        fn.sourceFunction === owner ? update(fn, false) : fn,
      ),
    },
  };
  const changed = {
    ...shared,
    layout: {
      ...shared.layout,
      program: {
        ...shared.layout.program,
        functions: shared.layout.program.functions.map((fn) =>
          fn.sourceFunction === owner ? update(fn, true) : fn,
        ),
      },
    },
  };
  return side === "before"
    ? {
        ...input,
        reference: {
          ...input.reference,
          checked: { ...input.reference.checked, lowered },
          shared: changed,
        },
      }
    : { ...input, candidate: { lowered, shared: changed } };
}

/** Tamper a request premise; outer authentication remains a separate failure boundary. */
function withRequest(
  input: Fixture,
  side: Side,
  id: string,
  update: (request: StorageRequest) => StorageRequest,
): Fixture {
  const shared = side === "before" ? input.reference.shared : input.candidate.shared;
  const changed = {
    ...shared,
    certificate: {
      ...shared.certificate,
      inventory: {
        ...shared.certificate.inventory,
        requests: shared.certificate.inventory.requests.map((request) =>
          request.id === id ? update(request) : request,
        ),
      },
    },
  };
  return side === "before"
    ? { ...input, reference: { ...input.reference, shared: changed } }
    : { ...input, candidate: { ...input.candidate, shared: changed } };
}

/** Substitute a symbolic proof while retaining its original source facts. */
function withProof(
  input: Fixture,
  update: (proof: ByteComplementProof) => ByteComplementProof,
): Fixture {
  const { selected } = field(input);
  return {
    ...input,
    candidate: {
      ...input.candidate,
      lowered: {
        ...input.candidate.lowered,
        program: {
          ...input.candidate.lowered.program,
          functions: input.candidate.lowered.program.functions.map((fn) =>
            fn === selected
              ? { ...fn, byteComplementProofs: fn.byteComplementProofs!.map(update) }
              : fn,
          ),
        },
      },
    },
  };
}

/** Isolate the new proof after genuine source checks, then require separate provenance failure. */
function reject(original: Fixture, modified: Fixture, expected: string): void {
  const effects = validateResidualEffects(original),
    context = field(modified);
  if (effects.kind !== "complete")
    throw new Error("Expected genuine prior borrow and induction checks");
  const reason = validateFieldComplements(modified, effects, context.selected, context.packet);
  expect(reason).not.toBeNull();
  expect(reason).toContain(expected);
  expect(validateSizeObservers(modified).kind).toBe("error");
}

describe("final Original-field complement observers", () => {
  it.each([true, false])(
    "should close the exact migrated field source with bounds=%s",
    (bounds) => {
      const input = effectFixture(FIELD_SOURCE, "size", bounds, "original");
      expect(
        input.candidate.lowered.program.functions.flatMap((fn) => fn.byteComplementProofs ?? []),
      ).toHaveLength(1);
      expect(validateSizeObservers(input).kind).toBe("complete");
    },
  );
  it.each([true, false])("should use real caller-private backing with bounds=%s", (bounds) => {
    const input = effectFixture(PRIVATE_SOURCE, "size", bounds, "original");
    const { proof, parameter } = field(input);
    expect(proof.source.kind).toBe("home");
    expect(parameter.origin.owner).not.toBeNull();
    expect(validateSizeObservers(input).kind).toBe("complete");
    for (const shared of [input.reference.shared, input.candidate.shared]) {
      const homes = new Map(
        shared.certificate.certificate.homes.map((home) => [home.requestId, home]),
      );
      const type = parameter.origin.type;
      if (type.kind !== "struct") throw new Error("Expected packed struct origin");
      const backing = findNamedObjectBacking(
        { binding: parameter.origin.place.root, owner: parameter.origin.owner, type },
        shared,
        homes,
      );
      expect(backing).not.toBeNull();
      expect(backing!.range.end - backing!.range.start + 1).toBe(3);
    }
  });

  it("should account for every repeated direct call", () => {
    const source = FIELD_SOURCE.replace("{work(cell);}", "{work(cell);work(cell);}");
    const input = effectFixture(source, "size", true, "original");
    expect(field(input).parameter.calls).toHaveLength(2);
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it("should retain the exact field and AND shapes without adding target storage", () => {
    const input = effectFixture(FIELD_SOURCE, "size", true, "original");
    const { selected, parameter } = field(input);
    const before = input.reference.shared.layout.program.functions.find(
      (fn) => fn.id === selected.id,
    )!;
    const after = input.candidate.shared.layout.program.functions.find(
      (fn) => fn.id === selected.id,
    )!;
    expect(before.blocks[0]!.instructions.slice(0, 11).map(({ opcode }) => opcode)).toEqual([
      "ldy",
      "lda",
      "clc",
      "adc",
      "sta",
      "tya",
      "adc",
      "sta",
      "lda",
      "eor",
      "sta",
    ]);
    expect(after.blocks[0]!.instructions.slice(0, 3).map(({ opcode }) => opcode)).toEqual([
      "lda",
      "eor",
      "sta",
    ]);
    expect(
      before.blocks.flatMap((block) => block.instructions).filter(({ opcode }) => opcode === "eor"),
    ).toHaveLength(2);
    expect(
      after.blocks.flatMap((block) => block.instructions).filter(({ opcode }) => opcode === "eor"),
    ).toHaveLength(1);
    expect(
      input.reference.shared.certificate.inventory.requests.filter(
        (request) => request.binding === parameter.parameter,
      ),
    ).toHaveLength(1);
    expect(
      input.candidate.shared.certificate.inventory.requests.filter(
        (request) => request.binding === parameter.parameter,
      ),
    ).toEqual([]);
    const windows = after.blocks.flatMap((block) =>
      block.instructions.flatMap((instruction, index) =>
        instruction.opcode === "and" ? [block.instructions.slice(index - 1, index + 1)] : [],
      ),
    );
    expect(windows).toHaveLength(1);
    expect(windows[0]!.map(({ mode }) => mode)).toEqual(["absolute", "absolute"]);
    expect(windows[0]!.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(6);
    expect(windows[0]!.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(8);
  });

  it.each(["offset", "source", "selection"])(
    "should reject damaged Original %s evidence",
    (kind) => {
      const input = effectFixture(FIELD_SOURCE, "size", true, "original");
      const modified = withProof(input, (proof) =>
        kind === "offset"
          ? { ...proof, source: { ...proof.source, offset: 1 } }
          : kind === "source"
            ? { ...proof, source: { ...proof.source, id: "unknown-field" } }
            : { ...proof, selection: [proof.selection![0], { ...proof.selection![1] }] },
      );
      reject(input, modified, kind === "selection" ? "recipe" : "backing");
    },
  );

  it.each(["width", "owner", "lifetime"])("should reject wrong reference parameter %s", (kind) => {
    const input = effectFixture(FIELD_SOURCE, "size", true, "original");
    const { parameter } = field(input);
    const demand = input.reference.shared.certificate.inventory.requests.find(
      (request) => request.binding === parameter.parameter,
    )!;
    const modified = withRequest(input, "before", demand.id, (request) =>
      kind === "width"
        ? { ...request, bytes: 1 }
        : kind === "owner"
          ? { ...request, owner: parameter.calls[0]!.owner }
          : { ...request, lifetime: { ...request.lifetime, liveAt: [] } },
    );
    reject(input, modified, kind === "lifetime" ? "occupancy" : "parameter");
  });

  it.each(["before", "after"] as const)(
    "should reject insufficient %s inverse occupancy",
    (side) => {
      const input = effectFixture(FIELD_SOURCE, "size", false, "original");
      const shared = side === "before" ? input.reference.shared : input.candidate.shared;
      const id = shared.certificate.inventory.requests.find(
        (request) => request.binding === field(input).proof.binding,
      )!.id;
      reject(
        input,
        withRequest(input, side, id, (request) => ({
          ...request,
          lifetime: { ...request.lifetime, liveAt: [] },
        })),
        "occupancy",
      );
    },
  );

  it("should reject insufficient reference RHS capture occupancy", () => {
    const input = effectFixture(FIELD_SOURCE, "size", true, "original");
    reject(
      input,
      withRequest(input, "before", rhsId(input), (request) => ({
        ...request,
        lifetime: { ...request.lifetime, liveAt: [] },
      })),
      "RHS capture",
    );
  });

  it.each(["before", "after"] as const)("should reject a wrong %s field read", (side) => {
    const input = effectFixture(FIELD_SOURCE, "size", true, "original");
    const { selected, recipe } = field(input);
    const modified = withBody(input, side, selected.sourceFunction!, (fn) => ({
      ...fn,
      blocks: fn.blocks.map((block) => ({
        ...block,
        instructions: block.instructions.map((instruction) =>
          instruction.observerOrigins?.some((origin) => origin.operation === recipe.load)
            ? { ...instruction, opcode: "ora" }
            : instruction,
        ),
      })),
    }));
    reject(input, modified, "template");
  });

  it.each([false, true])("should reject wrong pointer delivery for private=%s", (local) => {
    const input = effectFixture(local ? PRIVATE_SOURCE : FIELD_SOURCE, "size", true, "original");
    const call = field(input).parameter.calls[0]!;
    const modified = withBody(input, "before", call.owner, (fn, physical) => ({
      ...fn,
      blocks: fn.blocks.map((block) => ({
        ...block,
        instructions: block.instructions.map((instruction) => {
          if (
            instruction.source !== call.operation.span ||
            instruction.opcode !== "lda" ||
            instruction.mode !== "immediate"
          )
            return instruction;
          const operand = instruction.operand;
          if (operand?.kind === "label" && operand.addressByte === "low")
            return { ...instruction, operand: { ...operand, offset: 1 } };
          if (operand?.kind === "storage" && operand.addressByte === "low")
            return { ...instruction, operand: { ...operand, offset: 1 } };
          if (physical && operand?.kind === "immediate")
            return { ...instruction, operand: { ...operand, value: (operand.value + 1) & 255 } };
          return instruction;
        }),
      })),
    }));
    reject(input, modified, local ? "ownership" : "delivery");
  });

  it("should reject a missing recorded call association", () => {
    const input = effectFixture(FIELD_SOURCE, "size", true, "original");
    const call = field(input).parameter.calls[0]!;
    const modified = withBody(input, "before", call.owner, (fn) => ({
      ...fn,
      blocks: fn.blocks.map((block) => ({
        ...block,
        instructions: block.instructions.map((instruction) =>
          instruction.opcode === "jsr" ? { ...instruction, source: null } : instruction,
        ),
      })),
    }));
    reject(input, modified, "call occurrence");
  });

  it.each(["first", "RHS"])("should reject an altered %s complement computation", (which) => {
    const input = effectFixture(FIELD_SOURCE, "size", false, "original");
    const owner = field(input).packet.function.id;
    const modified = withBody(input, "before", owner, (fn) => {
      let seen = 0;
      return {
        ...fn,
        blocks: fn.blocks.map((block) => ({
          ...block,
          instructions: block.instructions.map((instruction) => {
            if (instruction.opcode !== "eor") return instruction;
            seen += 1;
            return seen === (which === "first" ? 1 : 2)
              ? { ...instruction, operand: { kind: "immediate", value: 254 } }
              : instruction;
          }),
        })),
      };
    });
    reject(input, modified, which === "first" ? "inverse template" : "RHS capture");
  });

  it("should reject an observed caller accumulator before the actual JSR", () => {
    const input = effectFixture(FIELD_SOURCE, "size", false, "original");
    const call = field(input).parameter.calls[0]!;
    const modified = withBody(input, "before", call.owner, (fn) => ({
      ...fn,
      blocks: fn.blocks.map((block) => {
        const index = block.instructions.findIndex((instruction) => instruction.opcode === "jsr");
        return index < 0
          ? block
          : {
              ...block,
              instructions: [
                ...block.instructions.slice(0, index),
                machineInstruction(input.checked.profile.cpu, "sta", "absolute", {
                  kind: "absolute",
                  value: 0xc100,
                }),
                ...block.instructions.slice(index),
              ],
            };
      }),
    }));
    reject(input, modified, "call-entry state");
  });

  it.each([true, false])("should close a byte at packed offset zero with bounds=%s", (bounds) => {
    const source = FIELD_SOURCE.replace(
      "struct Cell{pad:word;value:byte;}",
      "struct Cell{value:byte;pad:word;}",
    ).replace("{pad:0,value:7}", "{value:7,pad:0}");
    const input = effectFixture(source, "size", bounds, "original");
    expect(field(input).proof.source.offset).toBe(0);
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each(["before", "after"] as const)(
    "should reject a %s pointer read before its overwrite",
    (side) => {
      const input = effectFixture(FIELD_SOURCE, "size", false, "original");
      const { packet, recipe } = field(input);
      const old = input.reference.checked.lowered.program.functions.find(
        (fn) => fn.sourceFunction === packet.function.id,
      )!;
      const operand = old.blocks
        .flatMap((block) => block.instructions)
        .find((instruction) =>
          instruction.observerOrigins?.some((origin) => origin.operation === recipe.load),
        )!.operand;
      if (operand?.kind !== "indirect-y") throw new Error("Expected actual pointer request");
      const shared = side === "before" ? input.reference.shared : input.candidate.shared;
      const home = shared.certificate.certificate.homes.find(
        (home) => home.requestId === operand.requestId,
      )!;
      const modified = withBody(input, side, packet.function.id, (fn, physical) => ({
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label !== packet.loops[0]!.body.id
            ? block
            : {
                ...block,
                instructions: [
                  machineInstruction(
                    input.checked.profile.cpu,
                    "lda",
                    physical ? "zero-page" : "storage",
                    physical
                      ? { kind: "absolute", value: home.address }
                      : { kind: "storage", requestId: operand.requestId, offset: 0 },
                  ),
                  ...block.instructions,
                ],
              },
        ),
      }));
      reject(input, modified, "pointer state");
    },
  );

  it.each(["before", "after"] as const)(
    "should reject observed %s entry carry/overflow state",
    (side) => {
      const input = effectFixture(FIELD_SOURCE, "size", true, "original");
      const { packet, recipe } = field(input);
      const modified = withBody(input, side, packet.function.id, (fn) => ({
        ...fn,
        blocks: fn.blocks.map((block) => {
          const index = block.instructions.findIndex((instruction) =>
            instruction.observerOrigins?.some((origin) => origin.operation === recipe.load),
          );
          return index < 0
            ? block
            : {
                ...block,
                instructions: [
                  ...block.instructions.slice(0, index + 3),
                  machineInstruction(input.checked.profile.cpu, "php", "implied", null),
                  ...block.instructions.slice(index + 3),
                ],
              };
        }),
      }));
      reject(input, modified, "entry addressing");
    },
  );

  it("should retain caller-private initialization before removing only argument delivery", () => {
    const input = effectFixture(PRIVATE_SOURCE, "size", false, "original");
    const call = field(input).parameter.calls[0]!;
    const modified = withBody(input, "after", call.owner, (fn) => ({
      ...fn,
      blocks: fn.blocks.map((block) => {
        const index = block.instructions.findIndex(
          (instruction) =>
            instruction.opcode === "sta" && instruction.source !== call.operation.span,
        );
        return index < 0
          ? block
          : { ...block, instructions: block.instructions.filter((_, at) => at !== index) };
      }),
    }));
    reject(input, modified, "initialization");
  });

  it("should reject a reused removed EOR at an unrelated exit occurrence", () => {
    const input = effectFixture(FIELD_SOURCE, "size", true, "original");
    const { packet } = field(input);
    const modified = withBody(input, "before", packet.function.id, (fn) => {
      const repeated = fn.blocks
        .flatMap((block) => block.instructions)
        .filter((instruction) => instruction.opcode === "eor")
        .at(-1)!;
      return {
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label === packet.loops[0]!.exit.id
            ? { ...block, instructions: [...block.instructions, repeated] }
            : block,
        ),
      };
    });
    reject(input, modified, "unchanged callee");
  });

  it("should reject an actual write to the stable named field", () => {
    const input = effectFixture(FIELD_SOURCE, "size", false, "original");
    const { packet, proof } = field(input);
    if (proof.source.kind !== "symbol") throw new Error("Expected named resident object");
    const operand = { kind: "label" as const, label: proof.source.id, offset: proof.source.offset };
    const modified = withBody(input, "after", packet.function.id, (fn) => ({
      ...fn,
      blocks: fn.blocks.map((block) =>
        block.label !== packet.loops[0]!.update.id
          ? block
          : {
              ...block,
              instructions: [
                ...block.instructions,
                machineInstruction(input.checked.profile.cpu, "sta", "absolute", operand),
              ],
            },
      ),
    }));
    reject(input, modified, "selected field or private write");
  });

  it.each([true, false])(
    "should reject an immediate address-byte reference AND with bounds=%s",
    (bounds) => {
      const source = FIELD_SOURCE.replace("let mask:byte=5;", "let mask:byte=255;");
      const input = effectFixture(source, "size", bounds, "original");
      const { packet } = field(input),
        id = rhsId(input);
      const home = input.reference.shared.certificate.certificate.homes.find(
        (home) => home.requestId === id,
      )!;
      expect(home.address & 255 & 255).not.toBe(7 & 255);
      const modified = withBody(input, "before", packet.function.id, (fn, physical) => ({
        ...fn,
        blocks: fn.blocks.map((block) => ({
          ...block,
          instructions: block.instructions.map((instruction) =>
            instruction.opcode !== "and"
              ? instruction
              : {
                  ...instruction,
                  ...machineInstruction(
                    input.checked.profile.cpu,
                    "and",
                    "immediate",
                    physical
                      ? { kind: "immediate", value: home.address & 255 }
                      : { kind: "storage", requestId: id, offset: 0, addressByte: "low" },
                    [],
                    instruction.source,
                  ),
                },
          ),
        })),
      }));
      reject(input, modified, "RHS capture");
    },
  );

  it("should retain ordinary computation when an alias changes the field", () => {
    const source = FIELD_SOURCE.replace(
      "answers[i]=mask&~inverse;",
      "cell.value=byte(i);answers[i]=mask&~inverse;",
    );
    const input = effectFixture(source, "size", false, "original");
    expect(
      input.candidate.lowered.program.functions.flatMap((fn) => fn.byteComplementProofs ?? []),
    ).toEqual([]);
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each(["asm_php();asm_plp();", "poke($C100,7);", "poke($D020,7);"])(
    "should discharge only the qualified source observation %s",
    (prefix) => {
      const source = FIELD_SOURCE.replace(
        "function main():void{",
        `function main():void{${prefix}`,
      );
      expect(validateSizeObservers(effectFixture(source, "size", true, "original")).kind).toBe(
        prefix === "poke($C100,7);" ? "complete" : "rejected",
      );
      expect(validateSizeObservers(effectFixture(source, "none", true)).kind).toBe("complete");
    },
  );
});
