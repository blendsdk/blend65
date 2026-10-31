import { describe, expect, it } from "vitest";
import { machineInstruction } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import { NMOS_6510 } from "../target/nmos6510.js";
import { instructionAccessEnvelope } from "./nmos6510-access.js";

/** Use the real opcode constructor without its optional memory annotations. */
function instruction(opcode: string, mode: string, address: number): MachineInstruction {
  return machineInstruction(NMOS_6510, opcode, mode, { kind: "absolute", value: address });
}

/** Inspect possible addresses, not an ordered runtime bus trace. */
function ranges(
  result: ReturnType<typeof instructionAccessEnvelope>,
  role: "fetch" | "pointer" | "dummy" | "data",
  kind: "read" | "write" = "read",
) {
  return result
    ?.filter((access) => access.role === role && access.kind === kind)
    .flatMap((access) => access.ranges);
}

describe("selected NMOS instruction access envelopes", () => {
  it("should reject a missing immediate operand rather than approving its fetches", () => {
    const immediate = machineInstruction(NMOS_6510, "lda", "immediate", {
      kind: "immediate",
      value: 7,
    });
    expect(
      instructionAccessEnvelope({
        cpu: NMOS_6510,
        instruction: { ...immediate, operand: null },
        pc: 0x900,
      }),
    ).toBeNull();
  });

  it("should not freeze caller-owned pointer ranges", () => {
    const pointee = { start: 0xc000, end: 0xc001 };
    const pointees = [pointee];
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("lda", "indexed-indirect-x", 2),
      pc: 0x900,
      pointees,
    });
    expect(result).not.toBeNull();
    expect(Object.isFrozen(pointee)).toBe(false);
    expect(Object.isFrozen(pointees)).toBe(false);
    expect(ranges(result, "data")).toEqual([{ start: 0xc000, end: 0xc001 }]);
    expect(
      result?.every(
        (access) =>
          Object.isFrozen(access) &&
          Object.isFrozen(access.ranges) &&
          access.ranges.every((range) => Object.isFrozen(range)),
      ),
    ).toBe(true);
  });

  it.each(["constructor", "toString", "__proto__"])(
    "should reject inherited opcode name %s without throwing",
    (opcode) => {
      const selected = { ...instruction("lda", "absolute", 0xc000), opcode };
      expect(
        instructionAccessEnvelope({ cpu: NMOS_6510, instruction: selected, pc: 0x900 }),
      ).toBeNull();
    },
  );

  it("should include indexed-store dummy reads even without a page crossing or annotations", () => {
    const selected = instruction("sta", "absolute-x", 0xc010);
    expect(selected.memory).toEqual([]);
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: selected,
      pc: 0x900,
      index: { start: 3, end: 3 },
    });
    expect(ranges(result, "dummy")).toEqual([{ start: 0xc013, end: 0xc013 }]);
    expect(ranges(result, "data", "write")).toEqual([{ start: 0xc013, end: 0xc013 }]);
  });

  it.each(["absolute-x", "absolute-y"])(
    "should retain the uncorrected-high dummy address separately in %s",
    (mode) => {
      const result = instructionAccessEnvelope({
        cpu: NMOS_6510,
        instruction: instruction("lda", mode, 0xd0ff),
        pc: 0x900,
        index: { start: 1, end: 1 },
      });
      expect(ranges(result, "dummy")).toEqual([{ start: 0xd000, end: 0xd000 }]);
      expect(ranges(result, "data")).toEqual([{ start: 0xd100, end: 0xd100 }]);
    },
  );

  it("should omit a read dummy only when the complete index range cannot cross", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("lda", "absolute-x", 0xc010),
      pc: 0x900,
      index: { start: 0, end: 8 },
    });
    expect(ranges(result, "dummy")).toEqual([]);
    expect(ranges(result, "data")).toEqual([{ start: 0xc010, end: 0xc018 }]);
  });

  it("should retain all byte indices when no narrower premise is supplied", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("sta", "absolute-y", 0xc0ff),
      pc: 0x900,
    });
    expect(ranges(result, "dummy")).toEqual([{ start: 0xc000, end: 0xc0ff }]);
    expect(ranges(result, "data", "write")).toEqual([{ start: 0xc0ff, end: 0xc1fe }]);
  });

  it("should wrap the effective address without correcting the dummy high byte", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("lda", "absolute-x", 0xffff),
      pc: 0x900,
      index: { start: 1, end: 1 },
    });
    expect(ranges(result, "dummy")).toEqual([{ start: 0xff00, end: 0xff00 }]);
    expect(ranges(result, "data")).toEqual([{ start: 0, end: 0 }]);
  });

  it("should read the high pointer byte from zero when an indirect pointer begins at FF", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("lda", "indirect-indexed-y", 0xff),
      pc: 0x900,
      index: { start: 1, end: 1 },
      pointees: [{ start: 0xc0ff, end: 0xc0ff }],
    });
    expect(ranges(result, "pointer")).toEqual([
      { start: 0xff, end: 0xff },
      { start: 0, end: 0 },
    ]);
    expect(ranges(result, "dummy")).toEqual([{ start: 0xc000, end: 0xc000 }]);
    expect(ranges(result, "data")).toEqual([{ start: 0xc100, end: 0xc100 }]);
  });

  it("should wrap indexed-indirect pointer selection before reading both bytes", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("sta", "indexed-indirect-x", 0xfe),
      pc: 0x900,
      index: { start: 2, end: 2 },
      pointees: [{ start: 0xc123, end: 0xc123 }],
    });
    expect(ranges(result, "dummy")).toEqual([{ start: 0xfe, end: 0xfe }]);
    expect(ranges(result, "pointer")).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
    ]);
    expect(ranges(result, "data", "write")).toEqual([{ start: 0xc123, end: 0xc123 }]);
  });

  it("should keep an unavailable indirect pointee unknown, not an empty access set", () => {
    for (const mode of ["indexed-indirect-x", "indirect-indexed-y"])
      expect(
        instructionAccessEnvelope({
          cpu: NMOS_6510,
          instruction: instruction("lda", mode, 2),
          pc: 0x900,
        }),
      ).toBeNull();
  });

  it("should include the original-base dummy for zero-page indexed access", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("lda", "zero-page-x", 0xff),
      pc: 0x900,
      index: { start: 2, end: 2 },
    });
    expect(ranges(result, "dummy")).toEqual([{ start: 0xff, end: 0xff }]);
    expect(ranges(result, "data")).toEqual([{ start: 1, end: 1 }]);
  });

  it("should retain both NMOS RMW writes independently from its effective read", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("inc", "absolute-x", 0xc0ff),
      pc: 0x900,
      index: { start: 1, end: 1 },
    });
    expect(ranges(result, "data")).toEqual([{ start: 0xc100, end: 0xc100 }]);
    expect(ranges(result, "data", "write")).toEqual([
      { start: 0xc100, end: 0xc100 },
      { start: 0xc100, end: 0xc100 },
    ]);
    expect(ranges(result, "dummy")).toEqual([{ start: 0xc000, end: 0xc000 }]);
  });

  it("should preserve the NMOS indirect-JMP page-wrap read", () => {
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("jmp", "indirect", 0x12ff),
      pc: 0x900,
    });
    expect(ranges(result, "pointer")).toEqual([
      { start: 0x12ff, end: 0x12ff },
      { start: 0x1200, end: 0x1200 },
    ]);
  });

  it("should resolve final label origins and wrap instruction fetches", () => {
    const selected = machineInstruction(NMOS_6510, "lda", "absolute", {
      kind: "label",
      label: "data",
      offset: 1,
    });
    expect(
      instructionAccessEnvelope({ cpu: NMOS_6510, instruction: selected, pc: 0x900 }),
    ).toBeNull();
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: selected,
      pc: 0xffff,
      labels: new Map([["data", 0xc000]]),
    });
    expect(ranges(result, "data")).toEqual([{ start: 0xc001, end: 0xc001 }]);
    expect(ranges(result, "fetch")).toEqual([
      { start: 0, end: 1 },
      { start: 0xffff, end: 0xffff },
    ]);
  });

  it.each([
    { start: -1, end: 1 },
    { start: 1, end: 256 },
    { start: 2, end: 1 },
    { start: 0, end: 0.5 },
  ])("should reject malformed index range %j", (index) => {
    expect(
      instructionAccessEnvelope({
        cpu: NMOS_6510,
        instruction: instruction("lda", "absolute-x", 0xc000),
        pc: 0x900,
        index,
      }),
    ).toBeNull();
  });

  it("should leave stack/control and unresolved storage to their own proofs", () => {
    const stack = machineInstruction(NMOS_6510, "php", "implied", null);
    const symbolic = machineInstruction(NMOS_6510, "lda", "storage", {
      kind: "storage",
      requestId: "unbound",
    });
    expect(instructionAccessEnvelope({ cpu: NMOS_6510, instruction: stack, pc: 0x900 })).toBeNull();
    expect(
      instructionAccessEnvelope({ cpu: NMOS_6510, instruction: symbolic, pc: 0x900 }),
    ).toBeNull();
  });

  it("should match independent effective and discarded addresses for every low byte", () => {
    for (let low = 0; low < 256; low += 1) {
      for (const index of [0, 1, 127, 255]) {
        const base = 0xff00 + low;
        for (const opcode of ["lda", "sta"]) {
          const result = instructionAccessEnvelope({
            cpu: NMOS_6510,
            instruction: instruction(opcode, "absolute-x", base),
            pc: 0x900,
            index: { start: index, end: index },
          });
          const effective = (base + index) & 0xffff;
          const discarded = 0xff00 + ((low + index) & 0xff);
          expect(ranges(result, "data", opcode === "sta" ? "write" : "read")).toEqual([
            { start: effective, end: effective },
          ]);
          expect(ranges(result, "dummy")).toEqual(
            opcode === "sta" || low + index > 255 ? [{ start: discarded, end: discarded }] : [],
          );
        }
      }
    }
  });

  it("should cover independently enumerated indirect domains across page and address wraps", () => {
    const bases = { start: 0xfffa, end: 0xffff };
    const index = { start: 0, end: 8 };
    const result = instructionAccessEnvelope({
      cpu: NMOS_6510,
      instruction: instruction("lda", "indirect-indexed-y", 2),
      pc: 0x900,
      index,
      pointees: [bases],
    });
    const addresses = (role: "data" | "dummy") =>
      new Set(
        (ranges(result, role) ?? []).flatMap((range) =>
          Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset),
        ),
      );
    const effective = new Set<number>(),
      discarded = new Set<number>();
    for (let base = bases.start; base <= bases.end; base += 1) {
      for (let value = index.start; value <= index.end; value += 1) {
        effective.add((base + value) & 0xffff);
        if ((base & 255) + value > 255) discarded.add((base & 0xff00) | ((base + value) & 255));
      }
    }
    expect(addresses("data")).toEqual(effective);
    expect(addresses("dummy")).toEqual(discarded);
  });

  it("should reject malformed physical or pointer facts rather than dropping them", () => {
    const selected = instruction("lda", "indirect-indexed-y", 2);
    for (const pointees of [[], [{ start: 0, end: 65536 }], [{ start: 2, end: 1 }]])
      expect(
        instructionAccessEnvelope({ cpu: NMOS_6510, instruction: selected, pc: 0x900, pointees }),
      ).toBeNull();
    for (const pc of [-1, 65536, Number.NaN, 0.5])
      expect(instructionAccessEnvelope({ cpu: NMOS_6510, instruction: selected, pc })).toBeNull();
    const wrongCost = { ...selected, cost: { ...selected.cost, bytes: 3 } };
    expect(
      instructionAccessEnvelope({
        cpu: NMOS_6510,
        instruction: wrongCost,
        pc: 0x900,
        pointees: [{ start: 0xc000, end: 0xc000 }],
      }),
    ).toBeNull();
  });
});
