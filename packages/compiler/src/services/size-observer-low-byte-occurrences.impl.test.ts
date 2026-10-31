import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import type { MachineFunction, MachineInstruction } from "../machine/machine-types.js";
import { body, side } from "./size-observer-complement-field-layout.js";
import { matchLowByteReadInputs } from "./size-observer-low-byte-read-inputs.js";

/** The real public caller exercises both direct and forwarded aggregate arguments. */
const SAVED = readFileSync(
  new URL("../../../../test/rd05/fixtures/input-saved-caller.blend", import.meta.url),
  "utf8",
);

/** Bind a real reader without requiring the still-separate whole-group admission. */
function reader(bounds: boolean, name: string) {
  const input = effectFixture(SAVED, "size", bounds, "low-byte");
  const packet = [
    ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
  ].find((packet) => packet.function.name === name);
  if (packet === undefined) throw new Error(`Missing source reader ${name}`);
  const before = body(
    side(input.reference.shared, input.reference.checked.lowered.program.functions),
    packet.function.id,
    packet.function,
  );
  const after = body(
    side(input.candidate.shared, input.candidate.lowered.program.functions),
    packet.function.id,
    packet.function,
  );
  if (before === null || after === null)
    throw new Error("Expected independent real reader bindings");
  return { input, packet, before, after };
}

describe("composed aggregate read inputs", () => {
  it.each([false, true])(
    "should reject displaced consumers and indexed pointer words with bounds=%s",
    (bounds) => {
      const { input, packet, before, after } = reader(bounds, "c64.input.snapshotCompatible");
      expect(typeof matchLowByteReadInputs(input, packet, before, after, new Map())).not.toBe(
        "string",
      );
      const reads = before.items.filter(
        (item) => item.source.opcode === "lda" && item.source.operand?.kind === "indirect-y",
      );
      expect(reads).toHaveLength(4);
      const cases = [{ owner: packet.function, item: reads[0]!, fault: "consumer-offset" }];
      for (const read of reads) {
        // Read prefixes must consume the exact low/high bytes whose values are proved.
        const prefix = before.items.filter(
          (item) =>
            item.block === read.block && item.index >= read.index - 8 && item.index < read.index,
        );
        for (const item of prefix.filter(
          (item) =>
            ["lda", "adc"].includes(item.source.opcode) && item.source.operand?.kind === "storage",
        ))
          cases.push({
            owner: packet.function,
            item,
            fault: `read-prefix:${read.index}:${item.index}`,
          });
      }
      const parameter = [...packet.storage!.parameters.values()][0]!;
      const formal = [...before.view.requests.values()].find(
        (value) => value.owner === packet.function.id && value.binding === parameter.parameter,
      )!;
      for (const call of parameter.calls) {
        const caller = input.checked.program.semantic.functions.find(
          (source) => source.id === call.owner,
        )!;
        const pair = body(before.view, caller.id, caller);
        if (pair === null) throw new Error("Expected the actual incoming pointer caller");
        const delivery = pair.items.filter((item) => item.source.source === call.operation.span);
        for (const item of delivery.filter(
          (item) =>
            item.source.operand?.kind === "storage" &&
            (item.source.operand.requestId === formal.id || item.source.opcode === "lda"),
        ))
          cases.push({ owner: caller, item, fault: `delivery:${caller.name}:${item.index}` });
        if (caller.id === input.checked.program.semantic.main) continue;
        const argument = caller.blocks
          .flatMap((block) => block.operations)
          .find(
            (operation) =>
              "result" in operation &&
              operation.result ===
                call.operation.arguments[
                  packet.function.parameters.findIndex((value) => value.id === parameter.parameter)
                ],
          );
        expect(argument?.kind).toBe("place-address");
        for (const item of pair.items.filter(
          (item) =>
            item.source.source === argument?.span &&
            item.source.opcode === "lda" &&
            item.source.operand?.kind === "storage",
        ))
          cases.push({ owner: caller, item, fault: `forwarding:${caller.name}:${item.index}` });
      }
      expect(cases.some(({ fault }) => fault.startsWith("forwarding:"))).toBe(true);
      for (const { owner, item: target, fault } of cases) {
        let edits = 0;
        const corrupt = (functions: readonly MachineFunction[]) =>
          functions.map((fn) =>
            fn.sourceFunction !== owner.id
              ? fn
              : {
                  ...fn,
                  blocks: fn.blocks.map((block) =>
                    block.label !== target.block.label
                      ? block
                      : {
                          ...block,
                          instructions: block.instructions.map(
                            (item, index): MachineInstruction => {
                              if (index !== target.index) return item;
                              edits += 1;
                              if (fault === "consumer-offset") {
                                if (item.operand?.kind === "indirect-y")
                                  return { ...item, operand: { ...item.operand, offset: 1 } };
                                if (item.operand?.kind !== "absolute")
                                  throw new Error("Expected bound pointer bytes");
                                return {
                                  ...item,
                                  operand: { ...item.operand, value: item.operand.value + 1 },
                                };
                              }
                              expect(["absolute", "zero-page"]).toContain(target.instruction.mode);
                              return {
                                ...item,
                                mode:
                                  target.instruction.mode === "zero-page"
                                    ? "zero-page-x"
                                    : "absolute-x",
                              };
                            },
                          ),
                        },
                  ),
                },
          );
        const reference = {
          ...input.reference,
          checked: {
            ...input.reference.checked,
            lowered: {
              ...input.reference.checked.lowered,
              program: {
                ...input.reference.checked.lowered.program,
                functions: corrupt(input.reference.checked.lowered.program.functions),
              },
            },
          },
          shared: {
            ...input.reference.shared,
            layout: {
              ...input.reference.shared.layout,
              program: {
                ...input.reference.shared.layout.program,
                functions: corrupt(input.reference.shared.layout.program.functions),
              },
            },
          },
        };
        expect(edits, fault).toBe(2);
        const changed = body(
          side(reference.shared, reference.checked.lowered.program.functions),
          packet.function.id,
          packet.function,
        );
        if (changed === null) throw new Error("Expected unchanged reader geometry");
        expect(body(changed.view, owner.id, owner), fault).not.toBeNull();
        expect
          .soft(
            typeof matchLowByteReadInputs(
              { ...input, reference },
              packet,
              changed,
              after,
              new Map(),
            ),
            fault,
          )
          .toBe("string");
      }
    },
  );

  it.each([false, true])(
    "should reject an actual overwrite of a live incoming pointer with bounds=%s",
    (bounds) => {
      const { input, packet, before, after } = reader(bounds, "c64.input.snapshotCompatible");
      expect(typeof matchLowByteReadInputs(input, packet, before, after, new Map())).not.toBe(
        "string",
      );
      const parameter = [...packet.storage!.parameters.values()][0]!;
      const formal = [...before.view.requests.values()].find(
        (value) => value.owner === packet.function.id && value.binding === parameter.parameter,
      )!;
      const home = before.view.homes.get(formal.id)!;
      const inverse = after.symbolic.byteComplementProofs![0]!.binding;
      const store = packet.function.blocks
        .flatMap((block) => block.operations)
        .find((operation) => operation.kind === "store" && operation.place.root === inverse)!;
      for (const fault of ["low", "high", "rmw", "indexed"] as const) {
        let edits = 0;
        const corrupt = (functions: readonly MachineFunction[]) =>
          functions.map((fn) =>
            fn.sourceFunction !== packet.function.id
              ? fn
              : {
                  ...fn,
                  blocks: fn.blocks.map((block) => ({
                    ...block,
                    instructions: block.instructions.map((item): MachineInstruction => {
                      if (item.opcode !== "sta" || item.source !== store.span) return item;
                      edits += 1;
                      const offset = fault === "low" ? 0 : 1;
                      const opcode = fault === "rmw" ? "inc" : "sta";
                      if (fault === "indexed")
                        return {
                          ...item,
                          opcode,
                          mode: "absolute-x",
                          operand: { kind: "absolute", value: home.address - 1 },
                        };
                      // Exercise real stores and memory updates at the same width.
                      // Source spans and optional annotations cannot exclude a write.
                      if (item.operand?.kind === "storage")
                        return {
                          ...item,
                          opcode,
                          operand: { kind: "storage", requestId: formal.id, offset },
                        };
                      expect(item.mode).toBe("absolute");
                      expect(home.region).toBe("ram");
                      return {
                        ...item,
                        opcode,
                        operand: { kind: "absolute", value: home.address + offset },
                      };
                    }),
                  })),
                },
          );
        const reference = {
          ...input.reference,
          checked: {
            ...input.reference.checked,
            lowered: {
              ...input.reference.checked.lowered,
              program: {
                ...input.reference.checked.lowered.program,
                functions: corrupt(input.reference.checked.lowered.program.functions),
              },
            },
          },
          shared: {
            ...input.reference.shared,
            layout: {
              ...input.reference.shared.layout,
              program: {
                ...input.reference.shared.layout.program,
                functions: corrupt(input.reference.shared.layout.program.functions),
              },
            },
          },
        };
        expect(edits).toBe(2);
        const changed = body(
          side(reference.shared, reference.checked.lowered.program.functions),
          packet.function.id,
          packet.function,
        );
        if (changed === null) throw new Error("Expected unchanged pointer-reader geometry");
        expect(
          typeof matchLowByteReadInputs({ ...input, reference }, packet, changed, after, new Map()),
        ).toBe("string");
      }
    },
  );

  it.each([false, true])(
    "should close descendant, unknown-writer and caller-suffix obligations with bounds=%s",
    (bounds) => {
      for (const fault of ["descendant", "unknown-indirect", "caller-suffix"] as const) {
        const { input, packet, before, after } = reader(
          bounds,
          fault === "unknown-indirect" ? "c64.input.snapshotCompatible" : "c64.input.keyState",
        );
        expect(
          typeof matchLowByteReadInputs(input, packet, before, after, new Map()),
          fault,
        ).not.toBe("string");
        const parameter = [...packet.storage!.parameters.values()][0]!;
        const formal = [...before.view.requests.values()].find(
          (value) => value.owner === packet.function.id && value.binding === parameter.parameter,
        )!;
        const home = before.view.homes.get(formal.id)!;
        let owner = packet.function,
          label = "",
          at = -1,
          pointer = "";
        if (fault === "descendant") {
          owner = input.checked.program.semantic.functions.find(
            (source) => source.name === "c64.input.snapshotCompatible",
          )!;
          const selected = after.view.functions.find((fn) => fn.sourceFunction === owner.id)!;
          const inverse = selected.byteComplementProofs![0]!.binding;
          const store = owner.blocks
            .flatMap((block) => block.operations)
            .find((operation) => operation.kind === "store" && operation.place.root === inverse)!;
          const child = body(before.view, owner.id, owner)!;
          const item = child.items.find(
            (item) => item.source.opcode === "sta" && item.source.source === store.span,
          )!;
          label = item.block.label;
          at = item.index;
        } else if (fault === "unknown-indirect") {
          const firstRead = before.items.findIndex(
            (item) =>
              item.source.opcode === "lda" && item.instruction.mode === "indirect-indexed-y",
          );
          const item = before.items.find(
            (item, index) =>
              index > firstRead &&
              item.source.opcode === "sta" &&
              item.source.operand?.kind === "storage" &&
              before.view.requests.get(item.source.operand.requestId)?.storageClass === "pointer",
          )!;
          if (item.source.operand?.kind !== "storage")
            throw new Error("Expected a real pointer setup store");
          expect(item.instruction.cost.bytes).toBe(2);
          pointer = item.source.operand.requestId;
          label = item.block.label;
          at = item.index;
        } else {
          owner = input.checked.program.semantic.functions.find(
            (source) => source.id === input.checked.program.semantic.main,
          )!;
          const caller = body(before.view, owner.id, owner)!;
          const call = parameter.calls.find((call) => call.owner === owner.id)!;
          const items = caller.items.filter((item) => item.source.source === call.operation.span);
          const high = items.find(
            (item) =>
              item.source.opcode === "sta" &&
              item.source.operand?.kind === "storage" &&
              item.source.operand.requestId === formal.id &&
              item.source.operand.offset === 1,
          )!;
          const invoke = items.at(-1)!;
          const item = items.find(
            (item) =>
              item.block === invoke.block &&
              item.index > high.index &&
              item.index < invoke.index &&
              item.instruction.cost.bytes === 3,
          )!;
          expect(item, "actual intervening caller suffix").toBeDefined();
          label = item.block.label;
          at = item.index;
        }
        let edits = 0;
        const corrupt = (functions: readonly MachineFunction[]) =>
          functions.map((fn) =>
            fn.sourceFunction !== owner.id
              ? fn
              : {
                  ...fn,
                  blocks: fn.blocks.map((block) =>
                    block.label !== label
                      ? block
                      : {
                          ...block,
                          instructions: block.instructions.map(
                            (item, index): MachineInstruction => {
                              if (index !== at) return item;
                              edits += 1;
                              if (fault === "caller-suffix")
                                return {
                                  ...item,
                                  opcode: "jsr",
                                  mode: "absolute",
                                  operand: { kind: "label", label: before.symbolic.id },
                                };
                              if (fault === "unknown-indirect")
                                return {
                                  ...item,
                                  mode: "indirect-indexed-y",
                                  operand:
                                    item.operand?.kind === "storage"
                                      ? { kind: "indirect-y", requestId: pointer, offset: 0 }
                                      : {
                                          kind: "absolute",
                                          value: before.view.homes.get(pointer)!.address,
                                        },
                                };
                              if (item.operand?.kind === "storage")
                                return {
                                  ...item,
                                  operand: { kind: "storage", requestId: formal.id, offset: 1 },
                                };
                              expect(item.mode).toBe("absolute");
                              return {
                                ...item,
                                operand: { kind: "absolute", value: home.address + 1 },
                              };
                            },
                          ),
                        },
                  ),
                },
          );
        const reference = {
          ...input.reference,
          checked: {
            ...input.reference.checked,
            lowered: {
              ...input.reference.checked.lowered,
              program: {
                ...input.reference.checked.lowered.program,
                functions: corrupt(input.reference.checked.lowered.program.functions),
              },
            },
          },
          shared: {
            ...input.reference.shared,
            layout: {
              ...input.reference.shared.layout,
              program: {
                ...input.reference.shared.layout.program,
                functions: corrupt(input.reference.shared.layout.program.functions),
              },
            },
          },
        };
        expect(edits, fault).toBe(2);
        const changed = body(
          side(reference.shared, reference.checked.lowered.program.functions),
          packet.function.id,
          packet.function,
        );
        if (changed === null) throw new Error("Expected unchanged reader geometry");
        expect(
          matchLowByteReadInputs({ ...input, reference }, packet, changed, after, new Map()),
          fault,
        ).toBe("Typed pointer's incoming value is unproved");
      }
    },
  );

  it.each([false, true])(
    "should reject failed selected-access coverage despite an unchanged sealed lifetime with bounds=%s",
    (bounds) => {
      const { input, packet, before, after } = reader(bounds, "c64.input.keyState");
      const original = matchLowByteReadInputs(input, packet, before, after, new Map());
      expect(typeof original).not.toBe("string");
      if (typeof original === "string") throw new Error(original);
      const operations = packet.function.blocks.flatMap((block) => block.operations);
      const consumer = operations.find(
        (operation) => operation.kind === "load" && operation.span.start === 9184,
      );
      if (consumer?.kind !== "load")
        throw new Error("Expected the exact post-call element consumer");
      const index = consumer.place.path.find((part) => part.kind === "index");
      if (index?.kind !== "index") throw new Error("Expected the post-call index value");
      expect(original.callGuards.get(consumer)?.get(index.value)).toBe(7n);
      const definition = operations.find(
        (operation) => "result" in operation && operation.result === index.value,
      );
      if (definition?.kind !== "load") throw new Error("Expected the guarded column reload");
      const demand = [...after.view.requests.values()].find(
        (value) => value.owner === packet.function.id && value.binding === definition.place.root,
      );
      if (demand === undefined) throw new Error("Expected the actual selected column home");
      for (const fault of ["missing", "ambiguous"] as const) {
        let edits = 0;
        const functions = after.view.functions.map((fn) =>
          fn.sourceFunction !== packet.function.id
            ? fn
            : {
                ...fn,
                blocks: fn.blocks.map((block) => ({
                  ...block,
                  instructions: block.instructions.map((item) => {
                    if (
                      item.opcode !== "lda" ||
                      item.operand?.kind !== "storage" ||
                      item.operand.requestId !== demand.id
                    )
                      return item;
                    edits += 1;
                    return {
                      ...item,
                      source: fault === "missing" ? null : packet.function.id.span,
                    };
                  }),
                })),
              },
        );
        expect(edits, fault).toBeGreaterThan(0);
        // Keep the very same sealed lifetime and physical layout. Only the
        // source association needed by access coverage is now unprovable.
        const changed = body({ ...after.view, functions }, packet.function.id, packet.function);
        if (changed === null) throw new Error("Expected unchanged bound geometry");
        expect(changed.view.requests.get(demand.id)?.lifetime).toBe(demand.lifetime);
        const outcome = matchLowByteReadInputs(input, packet, before, changed, new Map());
        expect.soft(typeof outcome, fault).toBe("string");
      }
    },
  );

  it.each([false, true])(
    "should prove every reference reader including zero-counter joystick with bounds=%s",
    (bounds) => {
      for (const [name, count] of [
        ["c64.input.snapshotCompatible", 4],
        ["c64.input.joystickState", 5],
      ] as const) {
        const { input, packet, before, after } = reader(bounds, name);
        const result = matchLowByteReadInputs(input, packet, before, after, new Map());
        expect(typeof result, name).not.toBe("string");
        if (typeof result === "string") throw new Error(result);
        expect(result.before).toHaveLength(count);
        for (const access of result.before) {
          expect(access.envelope.some((bus) => bus.role === "pointer")).toBe(true);
          expect(access.envelope.some((bus) => bus.role === "data")).toBe(true);
          expect(
            access.pointees?.every((range) => range.start >= 0x200 && range.end <= 0xcfff),
          ).toBe(true);
        }
      }
    },
  );

  it.each([false, true])(
    "should reject actual pointer/value window faults with bounds=%s",
    (bounds) => {
      for (const fault of [
        "formal-low",
        "formal-high",
        "forward-stage",
        "pointer-carry",
        "read-y",
        "reader-opcode",
      ] as const) {
        const { input, packet, before, after } = reader(bounds, "c64.input.snapshotCompatible");
        // A positive component precondition prevents an unrelated group rejection
        // from making any negative case pass without reaching the read-input proof.
        expect(
          typeof matchLowByteReadInputs(input, packet, before, after, new Map()),
          fault,
        ).not.toBe("string");
        const parameter = [...packet.storage!.parameters.values()][0]!;
        const forwarding = parameter.calls.find(
          (call) => call.owner !== input.checked.program.semantic.main,
        )!;
        const owner = ["formal-low", "formal-high", "forward-stage"].includes(fault)
          ? forwarding.owner
          : packet.function.id;
        const fn = input.reference.checked.lowered.program.functions.find(
          (fn) => fn.sourceFunction === owner,
        )!;
        const callerSource = input.checked.program.semantic.functions.find(
          (source) => source.id === owner,
        )!;
        const argument = callerSource.blocks
          .flatMap((block) => block.operations)
          .find(
            (operation) =>
              "result" in operation &&
              operation.result ===
                forwarding.operation.arguments[
                  packet.function.parameters.findIndex(
                    (formal) => formal.id === parameter.parameter,
                  )
                ],
          );
        const formal = [...before.view.requests.values()].find(
          (value) => value.owner === packet.function.id && value.binding === parameter.parameter,
        )!;
        let label = "",
          at = -1;
        for (const block of fn.blocks) {
          if (fault === "formal-low" || fault === "formal-high") {
            const delivery = block.instructions.findIndex(
              (item) =>
                item.opcode === "sta" &&
                item.operand?.kind === "storage" &&
                item.operand.requestId === formal.id &&
                (item.operand.offset ?? 0) === 0 &&
                item.source === forwarding.operation.span,
            );
            if (delivery >= 1) at = delivery + (fault === "formal-low" ? -1 : 1);
          } else if (fault === "forward-stage") {
            at = block.instructions.findIndex(
              (item) =>
                item.opcode === "sta" &&
                item.source === argument?.span &&
                item.operand?.kind === "storage" &&
                before.view.requests.get(item.operand.requestId)?.storageClass === "pointer",
            );
          } else {
            const read = block.instructions.findIndex(
              (item) => item.opcode === "lda" && item.mode === "indirect-indexed-y",
            );
            if (read >= 8) at = read - (fault === "pointer-carry" ? 6 : fault === "read-y" ? 8 : 0);
          }
          if (at >= 0) {
            label = block.label;
            break;
          }
        }
        expect(at, fault).toBeGreaterThanOrEqual(0);
        let edits = 0;
        const corrupt = (functions: readonly MachineFunction[]) =>
          functions.map((current) =>
            current.sourceFunction !== owner
              ? current
              : {
                  ...current,
                  blocks: current.blocks.map((block) =>
                    block.label !== label
                      ? block
                      : {
                          ...block,
                          instructions: block.instructions.map(
                            (item, index): MachineInstruction => {
                              if (index !== at) return item;
                              edits += 1;
                              const opcode =
                                fault === "pointer-carry"
                                  ? "sec"
                                  : fault === "reader-opcode"
                                    ? "ora"
                                    : fault === "forward-stage"
                                      ? "stx"
                                      : "ldx";
                              return { ...item, opcode };
                            },
                          ),
                        },
                  ),
                },
          );
        const reference = {
          ...input.reference,
          checked: {
            ...input.reference.checked,
            lowered: {
              ...input.reference.checked.lowered,
              program: {
                ...input.reference.checked.lowered.program,
                functions: corrupt(input.reference.checked.lowered.program.functions),
              },
            },
          },
          shared: {
            ...input.reference.shared,
            layout: {
              ...input.reference.shared.layout,
              program: {
                ...input.reference.shared.layout.program,
                functions: corrupt(input.reference.shared.layout.program.functions),
              },
            },
          },
        };
        expect(edits, fault).toBe(2);
        const modified = { ...input, reference };
        const rebound = body(
          side(reference.shared, reference.checked.lowered.program.functions),
          packet.function.id,
          packet.function,
        );
        expect(rebound, fault).not.toBeNull();
        if (rebound === null) throw new Error("Expected unchanged reader geometry");
        expect(
          typeof matchLowByteReadInputs(modified, packet, rebound, after, new Map()),
          fault,
        ).toBe("string");
      }
    },
  );
});
