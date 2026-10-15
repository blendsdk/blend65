import { describe, expect, it } from "vitest";
import { repairMachineBranches } from "./block-layout.js";
import { machineInstruction } from "./lower-control.js";
import { nop, selectedProfile } from "./lowering-test-support.js";
import type { MachineFunction } from "./machine-types.js";

/** Explicit structured edges make alias labels and loop/back-edge obligations visible. */
const jump = (target: string) => ({
  kind: "jump" as const,
  opcode: "jmp" as const,
  target,
  cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
});
const branch = (target: string, fallthrough: string) => ({
  kind: "branch" as const,
  opcode: "beq",
  target,
  fallthrough,
  uses: { registers: [], flags: ["z" as const] },
  cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
});

/** Fail loudly instead of treating an incomplete layout as an empty successful result. */
function repair(fn: MachineFunction) {
  const result = repairMachineBranches(fn, 0x2000);
  if (result.kind !== "complete") throw new Error(result.reason);
  return result;
}

describe("instruction-empty alias layout", () => {
  it("preserves every alias and schedules both guarded arms before their common return", () => {
    const reject = machineInstruction(selectedProfile().cpu, "lda", "immediate", {
      kind: "immediate",
      value: 0,
    });
    const fn: MachineFunction = {
      id: "joined",
      blocks: [
        { label: "entry", instructions: [], terminator: branch("zero", "nonzero") },
        { label: "zero", instructions: [], terminator: branch("zero-reject", "zero-alias") },
        {
          label: "nonzero",
          instructions: [],
          terminator: branch("nonzero-reject", "nonzero-alias"),
        },
        { label: "zero-alias", instructions: [], terminator: jump("zero-end") },
        { label: "zero-end", instructions: [], terminator: jump("read") },
        { label: "nonzero-alias", instructions: [], terminator: jump("read") },
        {
          label: "read",
          instructions: Array.from({ length: 10 }, nop),
          terminator: { kind: "return" },
        },
        { label: "zero-reject", instructions: [reject], terminator: { kind: "return" } },
        { label: "nonzero-reject", instructions: [reject], terminator: { kind: "return" } },
      ],
    };
    const result = repair(fn);
    // Both pure zero returns now share their existing load/RTS as well.
    expect(result.byteLength).toBe(20);
    const labels = result.function.blocks.map(({ label }) => label);
    expect(new Set(labels).size).toBe(fn.blocks.length);
    expect([...labels].sort()).toEqual(fn.blocks.map(({ label }) => label).sort());
    expect(labels.indexOf("read")).toBeGreaterThan(labels.indexOf("zero"));
    expect(labels.indexOf("read")).toBeGreaterThan(labels.indexOf("nonzero"));
    expect(result.function.blocks.some(({ terminator }) => terminator.kind === "jump")).toBe(false);
    const origin = result.function.blocks.find(({ label }) => label === "read")!.origin;
    for (const label of ["zero-alias", "zero-end", "nonzero-alias"])
      expect(result.function.blocks.find((block) => block.label === label)!.origin).toBe(origin);
  });

  it("does not resolve through an instruction or an external target", () => {
    const instruction = nop();
    const result = repair({
      id: "barriers",
      blocks: [
        { label: "entry", instructions: [], terminator: jump("work") },
        { label: "work", instructions: [instruction], terminator: jump("external") },
      ],
    });
    expect(result.byteLength).toBe(4);
    expect(result.function.blocks.map(({ label }) => label)).toEqual(["entry", "work"]);
    expect(result.function.blocks[1]!.instructions).toEqual([instruction]);
    expect(result.function.blocks[1]!.terminator).toEqual(jump("external"));
  });

  it("keeps cyclic aliases finite and retains the required backward jump", () => {
    const result = repair({
      id: "cyclic",
      blocks: [
        { label: "entry", instructions: [], terminator: jump("a") },
        { label: "a", instructions: [], terminator: jump("b") },
        { label: "b", instructions: [], terminator: jump("a") },
      ],
    });
    expect(result.byteLength).toBe(3);
    expect(result.function.blocks.map(({ label }) => label)).toEqual(["entry", "a", "b"]);
    expect(result.function.blocks[2]!.terminator).toEqual(jump("a"));
  });

  it("retains missing and duplicate branch-label validation", () => {
    const entry = { label: "entry", instructions: [], terminator: branch("missing", "return") };
    const fn: MachineFunction = {
      id: "invalid",
      blocks: [entry, { label: "return", instructions: [], terminator: { kind: "return" } }],
    };
    expect(repairMachineBranches(fn, 0x2000)).toEqual({ kind: "error", reason: "missing-label" });
    expect(repairMachineBranches({ ...fn, blocks: [...fn.blocks, entry] }, 0x2000)).toEqual({
      kind: "error",
      reason: "missing-label",
    });
  });

  it("reserves prior bridge labels even when re-layout turns them into empty aliases", () => {
    const first = repair({
      id: "repeated",
      blocks: [
        { label: "start", instructions: [], terminator: branch("T", "F") },
        { label: "F", instructions: [], terminator: { kind: "return" } },
        { label: "T", instructions: [nop()], terminator: jump("entry") },
        { label: "entry", instructions: [nop()], terminator: branch("F", "T") },
      ],
    });
    expect(first.function.blocks.some(({ label }) => label === "entry.fallthrough.0")).toBe(true);
    const second = repair(first.function);
    const labels = second.function.blocks.map(({ label }) => label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const block of first.function.blocks) expect(labels).toContain(block.label);
  });
});
