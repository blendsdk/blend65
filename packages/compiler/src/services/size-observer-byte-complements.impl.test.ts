import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateByteComplementObservers } from "./size-observer-byte-complements.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { machineInstruction } from "../machine/lower-control.js";
import type { MachineFunction } from "../machine/machine-types.js";
import type { ByteComplementProof } from "../machine/byte-value-availability.js";
import type { StorageRequest } from "../storage/storage-types.js";

/** Genuine independent constructions; negatives never manufacture a successful receipt. */
type Fixture = ReturnType<typeof effectFixture>;
/** Every damaged premise names its independently closed side. */
type Side = "before" | "after";

/** Ordinary repeated complements whose one cache must remain valid through the complete loop. */
const CACHE_SOURCE = `module Game;let sample:byte=7;let left:byte[4];let right:byte[4];
function work():void{for(let i:word=0;i<4;i+=1){left[i]=~sample;right[i]=~sample;}}
function main():void{work();}`;

/** Locate the actual selected owner and source loop without request-prefix matching. */
function cache(input: Fixture) {
  const selected = input.candidate.lowered.program.functions.find(
    (fn) => fn.byteComplementProofs?.length,
  );
  const proof = selected?.byteComplementProofs?.[0];
  const packet = [
    ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
  ].find((packet) => packet.function.id === selected?.sourceFunction);
  if (selected === undefined || proof?.cacheRequestId == null || packet === undefined)
    throw new Error("Expected actual cache construction");
  return { selected, proof, packet, loop: packet.loops[0]! };
}

/** Store delivery reveals its actual capture request without parsing a generated ID. */
function captureId(input: Fixture): string {
  const { selected, proof, packet } = cache(input);
  const unary = proof.selection![0];
  const source = packet.function.blocks
    .flatMap((block) => block.operations)
    .find((operation) => operation.kind === "store" && operation.value === unary.result);
  const fn = input.reference.checked.lowered.program.functions.find((fn) => fn.id === selected.id)!;
  for (const block of fn.blocks) {
    const index = block.instructions.findIndex((instruction) =>
      instruction.observerOrigins?.some((origin) => origin.operation === source),
    );
    const operand = block.instructions[index - 1]?.operand;
    if (index >= 0 && operand?.kind === "storage") return operand.requestId;
  }
  throw new Error("Expected anchored reference capture");
}

/** Change symbolic and final code together so binding cannot mask later proof checks. */
function withBody(
  input: Fixture,
  side: Side,
  update: (fn: MachineFunction, physical: boolean) => MachineFunction,
): Fixture {
  const id = cache(input).selected.id;
  const original = side === "before" ? input.reference.checked.lowered : input.candidate.lowered;
  const shared = side === "before" ? input.reference.shared : input.candidate.shared;
  const lowered = {
    ...original,
    program: {
      ...original.program,
      functions: original.program.functions.map((fn) => (fn.id === id ? update(fn, false) : fn)),
    },
  };
  const changed = {
    ...shared,
    layout: {
      ...shared.layout,
      program: {
        ...shared.layout.program,
        functions: shared.layout.program.functions.map((fn) =>
          fn.id === id ? update(fn, true) : fn,
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

/** Tamper a symbolic obligation without changing its original source facts. */
function withProofs(
  input: Fixture,
  update: (proofs: readonly ByteComplementProof[]) => readonly ByteComplementProof[],
): Fixture {
  const owner = cache(input).selected;
  return {
    ...input,
    candidate: {
      ...input.candidate,
      lowered: {
        ...input.candidate.lowered,
        program: {
          ...input.candidate.lowered.program,
          functions: input.candidate.lowered.program.functions.map((fn) =>
            fn === owner ? { ...fn, byteComplementProofs: update(fn.byteComplementProofs!) } : fn,
          ),
        },
      },
    },
  };
}

/** Change a declared byte's premise while retaining actual homes for the focused negative. */
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

/** Isolate the new obligation after genuine original checks; outer authentication still rejects tampering. */
function expectInvalid(original: Fixture, modified: Fixture, reason: string): void {
  const effects = validateResidualEffects(original);
  if (effects.kind !== "complete") throw new Error("Expected genuine prior source/loop checks");
  expect(validateByteComplementObservers(modified, effects)).toMatchObject({
    kind: "rejected",
    reason,
  });
  expect(validateSizeObservers(modified).kind).toBe("error");
}

describe("final byte-complement observers", () => {
  it.each([true, false])(
    "should close both actual cache constructions with bounds=%s",
    (bounds) => {
      const input = effectFixture(CACHE_SOURCE, "size", bounds, "original");
      expect(
        input.candidate.lowered.program.functions.flatMap((fn) => fn.byteComplementProofs ?? []),
      ).toHaveLength(2);
      expect(validateSizeObservers(input).kind).toBe("complete");
      const { selected, proof } = cache(input);
      const actual = input.candidate.shared.layout.program.functions.find(
        (fn) => fn.id === selected.id,
      )!;
      const reference = input.reference.shared.layout.program.functions.find(
        (fn) => fn.id === selected.id,
      )!;
      const complement = (fn: MachineFunction) =>
        fn.blocks
          .flatMap((block) => block.instructions)
          .filter(
            (instruction) =>
              instruction.opcode === "eor" &&
              instruction.operand?.kind === "immediate" &&
              instruction.operand.value === 255,
          );
      expect(complement(actual)).toHaveLength(1);
      expect(complement(reference)).toHaveLength(2);
      const demand = input.candidate.shared.certificate.inventory.requests.find(
        (request) => request.id === proof.cacheRequestId,
      )!;
      expect(demand).toMatchObject({
        bytes: 1,
        storageClass: "temporary",
        owner: selected.sourceFunction,
      });
      const setup = actual.blocks[0]!.instructions.slice(-3);
      expect(setup.map(({ opcode }) => opcode)).toEqual(["lda", "eor", "sta"]);
      expect(setup.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(7);
      expect(setup.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(9);
      const stores = actual.blocks.flatMap((block) =>
        block.instructions.flatMap((instruction, index) =>
          instruction.observerOrigins?.some(
            (origin) =>
              origin.operation.kind === "store" && origin.operation.place.path.length === 1,
          )
            ? [block.instructions[index - 1]!]
            : [],
        ),
      );
      expect(stores).toHaveLength(2);
      expect(
        stores.every(
          (instruction) => instruction.opcode === "lda" && instruction.mode === "zero-page",
        ),
      ).toBe(true);
      expect(stores.reduce((sum, instruction) => sum + instruction.cost.bytes, 0)).toBe(4);
      expect(stores.reduce((sum, instruction) => sum + instruction.cost.minCycles, 0)).toBe(6);
    },
  );
  it.each(["missing", "duplicate", "selection", "cache-id", "source-id"])(
    "should reject damaged %s obligation",
    (kind) => {
      const input = effectFixture(CACHE_SOURCE, "size", true, "original");
      const modified = withProofs(input, (proofs) =>
        kind === "missing"
          ? proofs.slice(1)
          : kind === "duplicate"
            ? [proofs[0]!, proofs[0]!]
            : proofs.map((proof) =>
                kind === "selection"
                  ? { ...proof, selection: [proof.selection![0], { ...proof.selection![1] }] }
                  : kind === "cache-id"
                    ? { ...proof, cacheRequestId: "unknown-cache" }
                    : { ...proof, source: { ...proof.source, id: "unknown-source" } },
              ),
      );
      const reason = ["missing", "duplicate"].includes(kind)
        ? "Complement class needs a stronger source or mixed-window proof"
        : kind === "selection"
          ? "Complement cache group or source identity is unresolved"
          : "Complement source or cache backing is incomplete";
      expectInvalid(input, modified, reason);
    },
  );

  it("should validate the complete sealed source replacement map", () => {
    const input = effectFixture(CACHE_SOURCE, "size", false, "original");
    const { packet } = cache(input);
    const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
    const replacements = new Map(packet.complements!.replacements);
    const [operation, recipe] = [...replacements][0]!;
    replacements.set(operation, { ...recipe });
    const functions = new Map(facts.functions);
    functions.set(packet.function, {
      ...packet,
      complements: { ...packet.complements!, replacements },
    });
    const modified = {
      ...input,
      candidate: {
        ...input.candidate,
        lowered: {
          ...input.candidate.lowered,
          program: {
            ...input.candidate.lowered.program,
            storageSelection: {
              ...input.candidate.lowered.program.storageSelection!,
              sourceFacts: { ...facts, functions },
            },
          },
        },
      },
    };
    expectInvalid(input, modified, "Complement source selection is stale");
  });

  it.each(["before", "after"] as const)("should reject incomplete %s private occupancy", (side) => {
    const input = effectFixture(CACHE_SOURCE, "size", true, "original");
    const id = side === "before" ? captureId(input) : cache(input).proof.cacheRequestId!;
    expectInvalid(
      input,
      withRequest(input, side, id, (request) => ({
        ...request,
        lifetime: { ...request.lifetime, liveAt: request.lifetime.liveAt.slice(1) },
      })),
      side === "before"
        ? "Complement reference capture or selected delivery disagrees"
        : "Complement source or cache backing is incomplete",
    );
  });

  it.each(["owner", "domain", "width"])("should reject wrong cache %s", (kind) => {
    const input = effectFixture(CACHE_SOURCE, "size", false, "original");
    const id = cache(input).proof.cacheRequestId!;
    expectInvalid(
      input,
      withRequest(input, "after", id, (request) =>
        kind === "owner"
          ? { ...request, owner: input.checked.program.semantic.main }
          : kind === "domain"
            ? { ...request, domain: "irq" }
            : { ...request, bytes: 2 },
      ),
      "Complement source or cache backing is incomplete",
    );
  });

  it.each(["missing", "wrong-value", "duplicate"])(
    "should reject %s cache initialization",
    (kind) => {
      const input = effectFixture(CACHE_SOURCE, "size", true, "original");
      const modified = withBody(input, "after", (fn) => ({
        ...fn,
        blocks: fn.blocks.map((block, index) =>
          index !== 0
            ? block
            : {
                ...block,
                instructions:
                  kind === "missing"
                    ? [...block.instructions.slice(0, -3), ...block.instructions.slice(-2)]
                    : kind === "duplicate"
                      ? [...block.instructions, ...block.instructions.slice(-3)]
                      : block.instructions.map((instruction, at) =>
                          at === block.instructions.length - 2
                            ? { ...instruction, operand: { kind: "immediate", value: 254 } }
                            : instruction,
                        ),
              },
        ),
      }));
      expectInvalid(
        input,
        modified,
        kind === "duplicate"
          ? "Complement source or private backing has an intervening write"
          : "Complement cache initialization is unresolved",
      );
    },
  );

  it.each(["before", "after"] as const)("should reject an alternate %s body entry", (side) => {
    const input = effectFixture(CACHE_SOURCE, "size", false, "original");
    const label = cache(input).loop.body.id;
    expectInvalid(
      input,
      withBody(input, side, (fn) => ({
        ...fn,
        blocks: [
          ...fn.blocks,
          {
            label: "alternate-entry",
            origin: fn.blocks[0]!.origin ?? 0x900,
            instructions: [],
            terminator: { kind: "fallthrough", target: label },
          },
        ],
      })),
      "Complement use chain has an alternate entry or control path",
    );
  });

  it("should reject a function-entry reference that bypasses initialization", () => {
    const input = effectFixture(CACHE_SOURCE, "size", true, "original");
    const id = cache(input).selected.id,
      target = cache(input).loop.body.id;
    const shared = input.candidate.shared;
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
              functions: shared.layout.program.functions.map((fn) => ({
                ...fn,
                blocks: fn.blocks.map((block) => ({
                  ...block,
                  instructions: block.instructions.map((instruction) =>
                    instruction.opcode === "jsr" &&
                    instruction.operand?.kind === "label" &&
                    instruction.operand.label === id
                      ? { ...instruction, operand: { ...instruction.operand, label: target } }
                      : instruction,
                  ),
                })),
              })),
            },
          },
        },
      },
    };
    expectInvalid(input, modified, "Complement final code or entry binding disagrees");
  });

  it("should reject a wrong reference complement without depending on its source span", () => {
    const input = effectFixture(CACHE_SOURCE, "size", false, "original");
    expectInvalid(
      input,
      withBody(input, "before", (fn) => ({
        ...fn,
        blocks: fn.blocks.map((block) => ({
          ...block,
          instructions: block.instructions.map((instruction) =>
            instruction.opcode === "eor"
              ? { ...instruction, operand: { kind: "immediate", value: 254 } }
              : instruction,
          ),
        })),
      })),
      "Complement reference capture or selected delivery disagrees",
    );
  });

  it.each(["before", "after"] as const)(
    "should reject an unexplained %s capture/cache write",
    (side) => {
      const input = effectFixture(CACHE_SOURCE, "size", true, "original");
      const id = side === "before" ? captureId(input) : cache(input).proof.cacheRequestId!;
      const shared = side === "before" ? input.reference.shared : input.candidate.shared;
      const home = shared.certificate.certificate.homes.find((home) => home.requestId === id)!;
      const update = cache(input).loop.update.id;
      const modified = withBody(input, side, (fn, physical) => ({
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label !== update
            ? block
            : {
                ...block,
                instructions: [
                  ...block.instructions,
                  machineInstruction(
                    input.checked.profile.cpu,
                    "sta",
                    physical ? (home.region === "zero-page" ? "zero-page" : "absolute") : "storage",
                    physical
                      ? { kind: "absolute", value: home.address }
                      : { kind: "storage", requestId: id, offset: 0 },
                  ),
                ],
              },
        ),
      }));
      expectInvalid(
        input,
        modified,
        "Complement source or private backing has an intervening write",
      );
    },
  );

  it.each(["initialization", "removed", "selected"])(
    "should reject status observation after %s computation",
    (where) => {
      const input = effectFixture(CACHE_SOURCE, "size", true, "original");
      const { loop } = cache(input);
      const label = where === "initialization" ? loop.header.id : loop.body.id;
      const modified = withBody(input, where === "removed" ? "before" : "after", (fn) => ({
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label !== label
            ? block
            : {
                ...block,
                instructions: [
                  ...block.instructions.slice(0, where === "removed" ? 3 : 0),
                  machineInstruction(input.checked.profile.cpu, "php", "implied", null),
                  ...block.instructions.slice(where === "removed" ? 3 : 0),
                ],
              },
        ),
      }));
      expectInvalid(
        input,
        modified,
        where === "initialization"
          ? "Complement initialization exposes changed accumulator or flags"
          : where === "removed"
            ? "Complement removed computation exposes accumulator or flags"
            : "Complement selected continuation exposes accumulator or flags",
      );
    },
  );

  it("should reject a changed actual branch polarity", () => {
    const input = effectFixture(CACHE_SOURCE, "size", false, "original");
    const header = cache(input).loop.header.id;
    expectInvalid(
      input,
      withBody(input, "after", (fn) => ({
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label === header && block.terminator.kind === "branch"
            ? {
                ...block,
                terminator: {
                  ...block.terminator,
                  opcode: block.terminator.opcode === "bcc" ? "bcs" : "bcc",
                },
              }
            : block,
        ),
      })),
      "Complement unchanged control or setup disagrees",
    );
  });

  it.each(["asm_php();asm_plp();", "poke($C100,7);", "poke($D020,7);"])(
    "should retain source barrier %s",
    (prefix) => {
      const source = CACHE_SOURCE.replace(
        "function main():void{",
        `function main():void{${prefix}`,
      );
      expect(validateSizeObservers(effectFixture(source, "size", true, "original")).kind).toBe(
        "rejected",
      );
      expect(validateSizeObservers(effectFixture(source, "none", true)).kind).toBe("complete");
    },
  );

  it("should retain the cached preserved-left proof boundary", () => {
    const left = CACHE_SOURCE.replace("left[i]=~sample", "left[i]=byte(i)&~sample");
    expect(validateSizeObservers(effectFixture(left, "size", true, "original")).kind).toBe(
      "rejected",
    );
  });

  it.each(["capture-store", "exit-eor"])(
    "should reject a repeated reference %s occurrence",
    (kind) => {
      const source = CACHE_SOURCE.replace("let sample", "let answer:byte;let sample")
        .replace("work():void", "work():byte")
        .replace("right[i]=~sample;}}", "right[i]=~sample;}return 0;}")
        .replace("{work();}", "{answer=work();}");
      for (const bounds of [true, false]) {
        const input = effectFixture(source, "size", bounds, "original");
        expect(validateSizeObservers(input).kind).toBe("complete");
        const { selected, packet, loop } = cache(input);
        const unary = selected.byteComplementProofs!.at(-1)!.selection![0];
        const store = packet.function.blocks
          .flatMap((block) => block.operations)
          .find((operation) => operation.kind === "store" && operation.value === unary.result);
        const before = input.reference.checked.lowered.program.functions.find(
          (fn) => fn.id === selected.id,
        )!;
        const anchored = before.blocks.find((block) =>
          block.instructions.some((instruction) =>
            instruction.observerOrigins?.some((origin) => origin.operation === store),
          ),
        )!;
        const reload =
          anchored.instructions.findIndex((instruction) =>
            instruction.observerOrigins?.some((origin) => origin.operation === store),
          ) - 1;
        const operand = anchored.instructions[reload]!.operand;
        if (operand?.kind !== "storage") throw new Error("Expected actual capture operand");
        const original = before.blocks
          .flatMap((block) =>
            block.instructions.map((instruction, index) => ({ block, instruction, index })),
          )
          .find(({ instruction }) =>
            kind === "exit-eor"
              ? instruction.opcode === "eor"
              : instruction.opcode === "sta" &&
                instruction.operand?.kind === "storage" &&
                instruction.operand.requestId === operand.requestId,
          )!;
        const label = kind === "exit-eor" ? loop.exit.id : anchored.label;
        const modified = withBody(input, "before", (fn) => {
          const repeated = fn.blocks.find((block) => block.label === original.block.label)!
            .instructions[original.index]!;
          return {
            ...fn,
            blocks: fn.blocks.map((block) => {
              if (block.label !== label) return block;
              const index = kind === "exit-eor" ? block.instructions.length : reload;
              return {
                ...block,
                instructions: [
                  ...block.instructions.slice(0, index),
                  repeated,
                  ...block.instructions.slice(index),
                ],
              };
            }),
          };
        });
        expectInvalid(
          input,
          modified,
          kind === "exit-eor"
            ? "Complement unchanged instruction or cache use disagrees"
            : "Complement source or private backing has an intervening write",
        );
      }
    },
  );

  it("should not impose a new restriction when mutation retains ordinary computation", () => {
    const source = CACHE_SOURCE.replace("left[i]=~sample", "sample=byte(i);left[i]=~sample");
    const input = effectFixture(source, "size", false, "original");
    expect(
      input.candidate.lowered.program.functions.flatMap((fn) => fn.byteComplementProofs ?? []),
    ).toEqual([]);
    expect(validateSizeObservers(input).kind).toBe("complete");
  });
});
