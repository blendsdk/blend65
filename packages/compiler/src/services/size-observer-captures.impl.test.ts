import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateCapturedAggregates } from "./size-observer-captures.js";
import type { MachineFunction } from "../machine/machine-types.js";
import type { StorageRequest } from "../storage/storage-types.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Actual independently built reference/candidate fixture, never a manufactured success. */
type Fixture = ReturnType<typeof effectFixture>;
/** Layout identity remains explicit in every negative contrast. */
type Side = "before" | "after";

/** Locate evidence only through the actual producer record, not a generated request prefix. */
function captureSide(input: Fixture, side: Side) {
  const lowered = side === "before" ? input.reference.checked.lowered : input.candidate.lowered;
  const shared = side === "before" ? input.reference.shared : input.candidate.shared;
  const body = lowered.program.functions.find((fn) => fn.observerCaptures?.length === 1);
  const record = body?.observerCaptures?.[0];
  if (body === undefined || record === undefined)
    throw new Error("Expected actual capture evidence");
  const request = shared.certificate.inventory.requests.find((row) => row.id === record.requestId);
  const home = shared.certificate.certificate.homes.find(
    (row) => row.requestId === record.requestId,
  );
  if (request === undefined || home === undefined) throw new Error("Expected full capture storage");
  return { lowered, shared, body, record, request, home };
}

/** Replace exactly one symbolic producer to test the direct checker and atomic provenance guard. */
function withBody(input: Fixture, side: Side, update: (body: MachineFunction) => MachineFunction) {
  const saved = captureSide(input, side);
  const program = {
    ...saved.lowered.program,
    functions: saved.lowered.program.functions.map((body) =>
      body === saved.body ? update(body) : body,
    ),
  };
  const lowered = { ...saved.lowered, program };
  return side === "before"
    ? {
        ...input,
        reference: { ...input.reference, checked: { ...input.reference.checked, lowered } },
      }
    : { ...input, candidate: { ...input.candidate, lowered } };
}

/** Replace only the selected actual closure; no copied object becomes an authenticated producer. */
function withShared(input: Fixture, side: Side, shared: FinalObserverInput["candidate"]["shared"]) {
  return side === "before"
    ? { ...input, reference: { ...input.reference, shared } }
    : { ...input, candidate: { ...input.candidate, shared } };
}

/** Keep request corruption separate from evidence identity and actual placement corruption. */
function withRequest(
  input: Fixture,
  side: Side,
  update: (request: StorageRequest) => StorageRequest,
) {
  const saved = captureSide(input, side);
  return withShared(input, side, {
    ...saved.shared,
    certificate: {
      ...saved.shared.certificate,
      inventory: {
        ...saved.shared.certificate.inventory,
        requests: saved.shared.certificate.inventory.requests.map((request) =>
          request.id === saved.request.id ? update(request) : request,
        ),
      },
    },
  });
}

/** Neither direct source premises nor the atomic observer may bless these damaged constructions. */
function expectInvalid(input: FinalObserverInput): void {
  expect(validateCapturedAggregates(input).kind).toBe("rejected");
  expect(validateSizeObservers(input).kind).toBe("error");
}

/** A member is evaluated before a later argument mutates its original object. */
function capturedMember(width: number): string {
  const rows =
    width === 255
      ? Array.from({ length: width }, (_unused, index) => (index * 17 + 3) & 255).join(",")
      : ";7";
  return `module Game;struct Packet{rows:byte[${width}];marker:byte;}
let original:byte[${width}]=[${rows}];
function mutate():byte{original[0]=99;return 5;}
function read(p:const Packet):byte{return p.rows[0];}
function main():void{let saved:Packet={rows:original,marker:mutate()};
poke($C100,read(saved));poke($C101,saved.marker);poke($C102,original[0]);}`;
}

describe("captured aggregate member observers", () => {
  it("should keep a stale checked-source handoff terminal before capture eligibility", () => {
    const input = effectFixture(capturedMember(8), "size", true, "original");
    const stale = {
      ...input,
      checked: { ...input.checked, program: { ...input.checked.program } },
    };
    expect(validateSizeObservers(stale).kind).toBe("error");
  });
  it.each([2, 8, 255])("should retain a complete %i-byte snapshot across a later call", (width) => {
    for (const bounds of [true, false]) {
      const input = effectFixture(capturedMember(width), "size", bounds, "original");
      const before = captureSide(input, "before"),
        after = captureSide(input, "after");
      expect(before.home.bytes).toBe(width);
      expect(after.home.bytes).toBe(width);
      expect(before.home.address).not.toBe(after.home.address);
      expect(before.record.operation).toBe(after.record.operation);
      expect(before.request.value).not.toBe(before.record.operation.result);
      expect(after.request.value).toBe(before.request.value);
      expect(Object.isFrozen(after.body.observerCaptures)).toBe(true);
      expect(Object.isFrozen(after.record)).toBe(true);
      expect(validateCapturedAggregates(input).kind).toBe("complete");
      expect(validateSizeObservers(input).kind).toBe("complete");
    }
  });

  it.each(["before", "after"] as const)(
    "should reject absent or cloned %s source associations",
    (side) => {
      const input = effectFixture(capturedMember(8), "size", true, "original");
      expectInvalid(withBody(input, side, (body) => ({ ...body, observerCaptures: [] })));
      expectInvalid(
        withBody(input, side, (body) => ({
          ...body,
          observerCaptures: body.observerCaptures!.map((record) => ({
            ...record,
            operation: { ...record.operation },
          })),
        })),
      );
      expectInvalid(
        withBody(input, side, (body) => ({
          ...body,
          observerCaptures: body.observerCaptures!.map((record) => ({
            ...record,
            requestId: "absent-object",
          })),
        })),
      );
    },
  );

  it.each(["before", "after"] as const)("should require complete full-width %s backing", (side) => {
    const input = effectFixture(capturedMember(8), "size", true, "original");
    const saved = captureSide(input, side);
    for (const missing of [true, false]) {
      const homes = missing
        ? saved.shared.certificate.certificate.homes.filter(
            (home) => home.requestId !== saved.request.id,
          )
        : saved.shared.certificate.certificate.homes.map((home) =>
            home.requestId === saved.request.id ? { ...home, bytes: 2 } : home,
          );
      expectInvalid(
        withShared(input, side, {
          ...saved.shared,
          certificate: {
            ...saved.shared.certificate,
            certificate: { ...saved.shared.certificate.certificate, homes },
          },
        }),
      );
    }
    expectInvalid(withRequest(input, side, (request) => ({ ...request, storageClass: "pointer" })));
    expectInvalid(
      withRequest(input, side, (request) => ({ ...request, activationRoot: "unproved-entry" })),
    );
  });

  it.each(["before", "after"] as const)(
    "should distinguish a two-byte %s snapshot from a pointer",
    (side) => {
      const input = effectFixture(capturedMember(2), "size", false, "original");
      expectInvalid(
        withRequest(input, side, (request) => ({ ...request, storageClass: "pointer" })),
      );
    },
  );

  it.each(["before", "after"] as const)(
    "should retain %s consumption occupancy and crossed calls",
    (side) => {
      const input = effectFixture(capturedMember(8), "size", false, "original");
      expectInvalid(
        withRequest(input, side, (request) => ({
          ...request,
          lifetime: { ...request.lifetime, liveAt: [] },
        })),
      );
      expectInvalid(
        withRequest(input, side, (request) => ({
          ...request,
          lifetime: { ...request.lifetime, callsCrossed: [] },
        })),
      );
      const saved = captureSide(input, side);
      const source = input.checked.program.semantic.functions
        .flatMap((fn) => fn.blocks)
        .find((block) => block.operations.includes(saved.record.operation));
      if (source === undefined) throw new Error("Expected the capture's source block");
      const gap = source.operations.indexOf(saved.record.operation) + 1;
      expect(
        saved.request.lifetime.liveAt.some(
          (position) => position.block === source.id && position.operation === gap,
        ),
      ).toBe(true);
      const modified = withRequest(input, side, (request) => ({
        ...request,
        lifetime: {
          ...request.lifetime,
          liveAt: request.lifetime.liveAt.filter(
            (position) => position.block !== source.id || position.operation !== gap,
          ),
        },
      }));
      expect(validateCapturedAggregates(modified)).toMatchObject({
        kind: "rejected",
        reason: "Capture occupancy ends before its complete consumption",
      });
      expect(validateSizeObservers(modified).kind).toBe("error");
    },
  );

  it.each(["before", "after"] as const)(
    "should require %s live-scalar conflict even at disjoint addresses",
    (side) => {
      const input = effectFixture(capturedMember(8), "size", false, "original");
      const saved = captureSide(input, side);
      const marker = saved.shared.certificate.inventory.requests.find(
        (request) =>
          request.storageClass === "temporary" &&
          request.bytes === 1 &&
          request.owner === saved.request.owner,
      );
      if (marker === undefined) throw new Error("Expected the later marker's actual retained byte");
      const edges = saved.shared.certificate.certificate.interference;
      const interference = edges.filter(
        (edge) =>
          !(
            (edge.left === marker.id && edge.right === saved.request.id) ||
            (edge.right === marker.id && edge.left === saved.request.id)
          ),
      );
      expect(interference.length).toBe(edges.length - 1);
      expectInvalid(
        withShared(input, side, {
          ...saved.shared,
          certificate: {
            ...saved.shared.certificate,
            certificate: { ...saved.shared.certificate.certificate, interference },
          },
        }),
      );
    },
  );

  it.each(["before", "after"] as const)(
    "should reject incomplete %s small copies and large counts",
    (side) => {
      for (const width of [2, 8]) {
        const input = effectFixture(capturedMember(width), "size", false, "original");
        const saved = captureSide(input, side);
        let changed = 0;
        const modified = withBody(input, side, (body) => ({
          ...body,
          blocks: body.blocks.map((block) => ({
            ...block,
            instructions: block.instructions.map((instruction) => {
              if (instruction.source !== saved.record.operation.span) return instruction;
              if (width === 8 && instruction.opcode === "cpy") {
                changed += 1;
                return { ...instruction, operand: { kind: "immediate" as const, value: 7 } };
              }
              if (
                width === 2 &&
                instruction.opcode === "lda" &&
                instruction.operand?.kind === "label" &&
                instruction.operand.offset === 1
              ) {
                changed += 1;
                return { ...instruction, operand: { ...instruction.operand, offset: 0 } };
              }
              return instruction;
            }),
          })),
        }));
        expect(changed).toBe(1);
        expectInvalid(modified);
      }
    },
  );

  it.each(["before", "after"] as const)(
    "should forbid a %s mutation call before snapshot completion",
    (side) => {
      const input = effectFixture(capturedMember(8), "size", false, "original");
      const saved = captureSide(input, side);
      const call = saved.body.blocks
        .flatMap((block) => block.instructions)
        .find((instruction) => instruction.opcode === "jsr");
      if (call === undefined) throw new Error("Expected an actual later mutation call");
      const modified = withBody(input, side, (body) => ({
        ...body,
        blocks: body.blocks.map((block, index) => ({
          ...block,
          instructions: [
            ...(index === 0 ? [call] : []),
            ...block.instructions.filter((instruction) => instruction !== call),
          ],
        })),
      }));
      expectInvalid(modified);
    },
  );

  it("should keep none evidence-free and preserve the ordinary canonical observer", () => {
    const input = effectFixture(capturedMember(8), "none", true);
    expect(
      input.candidate.lowered.program.functions.every((fn) => fn.observerCaptures === undefined),
    ).toBe(true);
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each(["before", "after"] as const)("should require complete %s member delivery", (side) => {
    for (const width of [2, 8]) {
      const input = effectFixture(capturedMember(width), "size", false, "original");
      const saved = captureSide(input, side);
      let changed = 0;
      const modified = withBody(input, side, (body) => ({
        ...body,
        blocks: body.blocks.map((block) => ({
          ...block,
          instructions: block.instructions
            .filter((instruction) => {
              const remove =
                width === 2 &&
                instruction.opcode === "lda" &&
                instruction.operand?.kind === "storage" &&
                instruction.operand.requestId === saved.request.id &&
                instruction.operand.offset === 1;
              if (remove) changed += 1;
              return !remove;
            })
            .map((instruction) => {
              if (
                width === 8 &&
                instruction.source !== saved.record.operation.span &&
                instruction.opcode === "cpy" &&
                instruction.operand?.kind === "immediate" &&
                instruction.operand.value === 8
              ) {
                changed += 1;
                return { ...instruction, operand: { kind: "immediate" as const, value: 7 } };
              }
              return instruction;
            }),
        })),
      }));
      expect(changed).toBe(1);
      expectInvalid(modified);
    }
  });

  it.each(["before", "after"] as const)("should reject an early %s counted-copy exit", (side) => {
    const input = effectFixture(capturedMember(8), "size", false, "original");
    const saved = captureSide(input, side);
    let changed = 0;
    const modified = withBody(input, side, (body) => ({
      ...body,
      blocks: body.blocks.map((block) => {
        if (
          block.instructions.length === 4 &&
          block.instructions[0]?.source === saved.record.operation.span &&
          block.terminator.kind === "branch"
        ) {
          changed += 1;
          return {
            ...block,
            terminator: { kind: "fallthrough" as const, target: block.terminator.fallthrough },
          };
        }
        return block;
      }),
    }));
    expect(changed).toBe(1);
    expectInvalid(modified);
  });

  it("should keep a non-first captured member legal while rejecting its unproved displacement", () => {
    const source = capturedMember(8)
      .replace(
        "struct Packet{rows:byte[8];marker:byte;}",
        "struct Packet{head:byte;rows:byte[8];marker:byte;}",
      )
      .replace("{rows:original,marker:mutate()}", "{head:1,rows:original,marker:mutate()}");
    const input = effectFixture(source, "size", true, "original");
    expect(validateCapturedAggregates(input)).toMatchObject({
      kind: "rejected",
      reason: "Captured member extent or displacement is unproved",
    });
    expect(validateSizeObservers(effectFixture(source, "none", true)).kind).toBe("complete");
  });

  it("should reject an additional captured-value consumer before inspecting machine metadata", () => {
    const input = effectFixture(capturedMember(8), "size", false, "original");
    const saved = captureSide(input, "after");
    const fn = input.checked.program.semantic.functions.find((fn) =>
      fn.blocks.some((block) => block.operations.includes(saved.record.operation)),
    );
    const block = fn?.blocks[0];
    const aggregate = block?.operations.find(
      (operation) =>
        operation.kind === "aggregate" &&
        operation.elements.some(({ value }) => value === saved.record.operation.result),
    );
    const selection = input.candidate.lowered.program.storageSelection;
    const facts = selection?.sourceFacts;
    if (
      fn === undefined ||
      block === undefined ||
      aggregate?.kind !== "aggregate" ||
      selection === undefined ||
      facts === undefined
    )
      throw new Error("Expected the checked direct member construction");
    const extra = { ...aggregate, result: `${aggregate.result}:extra-consumer` };
    const changed = { ...fn, blocks: [{ ...block, operations: [...block.operations, extra] }] };
    const program = {
      ...input.checked.program,
      semantic: {
        ...input.checked.program.semantic,
        functions: input.checked.program.semantic.functions.map((body) =>
          body === fn ? changed : body,
        ),
      },
    };
    // This damaged source packet is not an authenticated new program. It must fail at both gates.
    const modified = {
      ...input,
      checked: { ...input.checked, program },
      candidate: {
        ...input.candidate,
        lowered: {
          ...input.candidate.lowered,
          program: {
            ...input.candidate.lowered.program,
            storageSelection: { ...selection, sourceFacts: { ...facts, program } },
          },
        },
      },
    };
    expect(validateCapturedAggregates(modified)).toMatchObject({
      kind: "rejected",
      reason: "Multiple captured deliveries need a stronger ordering proof",
    });
    expect(validateSizeObservers(modified).kind).toBe("error");
  });

  it("should reuse only side-specific indexes across independent captured functions", () => {
    const source = `module Game;struct Packet{rows:byte[8];marker:byte;}
let original:byte[8]=[;7];function mutate():byte{original[0]=99;return 5;}
${Array.from(
  { length: 4 },
  (_unused, index) => `function read${index}(p:const Packet):byte{return p.rows[0];}
function run${index}():void{let saved:Packet={rows:original,marker:mutate()};poke($C100,read${index}(saved));}`,
).join("\n")}
function main():void{run0();run1();run2();run3();}`;
    const input = effectFixture(source, "size", false, "original");
    expect(validateCapturedAggregates(input).kind).toBe("complete");
    for (const side of ["before", "after"] as const) {
      const lowered = side === "before" ? input.reference.checked.lowered : input.candidate.lowered;
      const shared = side === "before" ? input.reference.shared : input.candidate.shared;
      const captures = lowered.program.functions.flatMap((fn) => fn.observerCaptures ?? []);
      expect(captures).toHaveLength(4);
      const last = captures.at(-1)!;
      const homes = shared.certificate.certificate.homes.filter(
        (home) => home.requestId !== last.requestId,
      );
      expect(homes.length).toBe(shared.certificate.certificate.homes.length - 1);
      expectInvalid(
        withShared(input, side, {
          ...shared,
          certificate: {
            ...shared.certificate,
            certificate: { ...shared.certificate.certificate, homes },
          },
        }),
      );
    }
  });
});
