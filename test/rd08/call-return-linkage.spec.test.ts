/**
 * Call and return linkage in optimized builds.
 *
 * A call is in tail position when its caller does nothing after it returns
 * except return itself. Such a call becomes a transfer into the callee, or
 * nothing at all when the callee is placed directly after the caller, so the
 * callee's own return goes straight back to the caller's caller. A result the
 * caller discards, or narrows to the byte the callee already leaves in A, is
 * still in tail position, because no instruction runs between the call and the
 * return.
 *
 * The program entry has no caller, and its continuation is the startup
 * restoration. Where the entry function's last act calls a wrapper, control may
 * instead continue into that wrapper, provided it never returns past the
 * restoration.
 *
 * Some calls keep their call: a call followed by more work, a result that needs
 * converting after the call, and a call inside an interrupt handler. A word
 * result whose high byte goes straight to X is not also stored. The unoptimized
 * reference keeps the ordinary call form throughout.
 *
 * These checks read the published assembly and labels. Results that need
 * control to cross routines are left to emulator execution: the values callers
 * finally store, stack balance, and the restoration actually running.
 */
import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";
import { cost, globalAddress, routineBytes } from "./emitted-routine-support.js";
import { inputWordHome, isMemoryWrite, namedRoutine, wordMemory } from "./word-update-support.js";
import {
  callReturnPairs,
  calls,
  exits,
  expectContinuation,
  expectLeavesThrough,
  interruptRoutine,
  labelAddress,
  linkedRoutine,
  restorationLabel,
  returnedRegisters,
  unreadStores,
} from "./call-linkage-support.js";
import type { LinkedRoutine } from "./call-linkage-support.js";

/** Selected NMOS C64 target. */
const target = "c64-pal-prg-kernal-6581";

/** Optimizing goals that must apply tail transfers. */
const optimizing = ["balanced", "size"] as const;

/** Build one witness for the selected target. */
function build(source: string, mode: "none" | "balanced" | "size") {
  return buildProfileSource(source, target, mode);
}

/** Show a routine's emitted lines in a failure message. */
function shown(routine: { readonly lines: readonly string[] }): string {
  return routine.lines.join("\n");
}

/**
 * Every unconditional jump whose destination is the address directly after it.
 *
 * Such a jump does what falling through does, for three bytes and three
 * cycles. Addresses are followed from the routine's entry and re-anchored at
 * each origin directive, since a routine's blocks may be placed separately. An
 * instruction whose size the cost model cannot state leaves the address
 * unknown until the next origin directive, and a jump at an unknown address is
 * not judged rather than guessed at.
 */
function jumpsToNext(routine: LinkedRoutine): string[] {
  const found: string[] = [];
  let address: number | undefined = routine.entry;
  for (const entry of routine.decoded) {
    const { instruction } = entry;
    const here = entry.address ?? address;
    if (
      instruction.mnemonic === "jmp" &&
      instruction.mode !== "other" &&
      here !== undefined &&
      instruction.address === here + 3
    )
      found.push(instruction.text);
    let size: number | undefined;
    try {
      size = cost(instruction).bytes;
    } catch {
      size = undefined;
    }
    address = here === undefined || size === undefined ? undefined : here + size;
  }
  return found;
}

/**
 * Positions of branches and jumps that close a loop inside the routine.
 *
 * A loop closes with a transfer back to a place defined at or before the
 * transfer itself, written either as a named label or as an anonymous
 * backward label.
 */
function loopClosings(routine: LinkedRoutine): number[] {
  return routine.decoded.flatMap(({ instruction, lineIndex }, position) => {
    const transfer = instruction.mode === "relative" || instruction.mnemonic === "jmp";
    const label = instruction.target;
    if (!transfer || label === undefined) return [];
    if (/^-+$/u.test(label)) return [position];
    const definition = routine.lines.findIndex((line) => {
      const text = line.replace(/;.*$/u, "").trim();
      return text === label || text.startsWith(`${label}:`);
    });
    return definition >= 0 && definition <= lineIndex ? [position] : [];
  });
}

/** The array-filling loop the witnesses share, so the entry function has work of its own. */
const fill = "for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }";

/** A word result computed from a word parameter and stored by the caller. */
const wordReturnSource = `module Game;
let data: byte[8] = [;0];
let total: word = 0;
function next(value: word): word { return value + 1; }
function main(): void {
  ${fill}
  total = next($12FF);
}
`;

/** The byte counterpart, already lowered as an expert would; kept as a control. */
const byteReturnSource = `module Game;
let data: byte[8] = [;0];
let total: byte = 0;
function next(value: byte): byte { return value + 1; }
function main(): void {
  ${fill}
  total = next(7);
}
`;

/**
 * A byte function whose last act is the multiply helper.
 *
 * The helper is emitted inside the function's own routine, after the code that
 * stages its operands, and ends in the routine's return.
 */
const helperSource = `module Game;
let data: byte[8] = [;0];
let total: byte = 0;
function calculate(a: byte, b: byte): byte { return a * b; }
function main(): void {
  ${fill}
  total = calculate(3, 4);
}
`;

/**
 * A void wrapper around a void child, as authored: the entry function's last act calls it.
 *
 * Because the wrapper has a single call site at the end of the entry function,
 * either the wrapper's own call becomes a transfer, or control continues from
 * the entry function into the wrapper. Both are correct.
 */
const wrapperSource = `module Game;
let data: byte[8] = [;0];
let total: word = 0;
function child(): void { total += 1; }
function touch(): void { child(); }
function main(): void {
  ${fill}
  touch();
}
`;

/**
 * The same wrapper called before the entry function's own work.
 *
 * The entry function no longer ends with the call, so only the wrapper's own
 * tail call can change.
 */
const earlyWrapperSource = `module Game;
let data: byte[8] = [;0];
let total: word = 0;
function child(): void { total += 1; }
function touch(): void { child(); }
function main(): void {
  touch();
  ${fill}
}
`;

/** A wrapper that does more work after its call, so the call is not in tail position. */
const trailingWorkSource = `module Game;
let data: byte[8] = [;0];
let total: word = 0;
let count: byte = 0;
function child(): void { total += 1; }
function touch(): void { child(); count += 1; }
function main(): void {
  touch();
  ${fill}
}
`;

/** A function that returns its callee's result unchanged, in the same shape. */
function forwardingSource(type: "byte" | "word", argument: string): string {
  return `module Game;
let data: byte[8] = [;0];
let total: ${type} = 0;
function inner(value: ${type}): ${type} { return value + 3; }
function outer(value: ${type}): ${type} { return inner(value); }
function main(): void {
  total = outer(${argument});
  ${fill}
}
`;
}

/**
 * Callers whose result shape differs from their callee's without needing any code.
 *
 * Discarding a result leaves nothing to do, and narrowing a word result to a
 * byte keeps the low byte the callee already leaves in A. Either way no
 * instruction runs between the call and the return.
 */
const tailShapeChanges = [
  {
    label: "a void caller discards a byte result",
    source: `module Game;
let data: byte[8] = [;0];
let total: byte = 0;
function inner(): byte { total += 1; return total; }
function outer(): void { inner(); }
function main(): void {
  outer();
  ${fill}
}
`,
  },
  {
    label: "a byte caller narrows a word result",
    source: `module Game;
let data: byte[8] = [;0];
let total: word = 0;
let small: byte = 0;
function inner(): word { total += 1; return total; }
function outer(): byte { return byte(inner()); }
function main(): void {
  small = outer();
  ${fill}
}
`,
  },
] as const;

/**
 * A word caller widening a byte result.
 *
 * The high byte of the widened result has to be produced after the callee
 * returns, so the call is followed by work of the caller's own.
 */
const wideningSource = `module Game;
let data: byte[8] = [;0];
let total: byte = 0;
let wide: word = 0;
function inner(): byte { total += 1; return total; }
function outer(): word { return word(inner()); }
function main(): void {
  wide = outer();
  ${fill}
}
`;

/** An interrupt handler whose only statement calls an ordinary function. */
function interruptSource(installer: "setIRQ" | "setIRQExclusive"): string {
  return `module Game;
import { ${installer}, restoreIRQ } from c64.system;
let data: byte[8] = [;0];
let ticks: byte = 0;
function child(): void { ticks += 1; }
interrupt function handler(): void { child(); }
function main(): void {
  ${installer}(&handler);
  ${fill}
  restoreIRQ();
}
`;
}

describe("a call in tail position becomes a transfer into its callee", () => {
  it.each(optimizing)(
    "leaves a void wrapper through its child in %s mode",
    async (mode) => {
      const artifacts = await build(earlyWrapperSource, mode);
      const main = linkedRoutine(artifacts, "main");
      const touch = linkedRoutine(artifacts, "touch");
      const child = linkedRoutine(artifacts, "child");
      expectLeavesThrough(touch, child.entry);
      expect(routineBytes(touch.decoded), `wrapper bytes:\n${shown(touch)}`).toBeLessThanOrEqual(3);
      expect(
        calls(main).filter(({ instruction }) =>
          [touch.entry, child.entry].includes(instruction.address!),
        ),
        `the entry function still calls the wrapper before its own work:\n${shown(main)}`,
      ).toHaveLength(1);
      expect(
        exits(child).map((exit) => exit.kind),
        `the child still returns to the entry function:\n${shown(child)}`,
      ).toSatisfy(
        (kinds: string[]) => kinds.length > 0 && kinds.every((kind) => kind === "return"),
      );
    },
    180_000,
  );

  it.each(optimizing)(
    "leaves no call-then-return in the authored wrapper program in %s mode",
    async (mode) => {
      const reference = await build(wrapperSource, "none");
      const artifacts = await build(wrapperSource, mode);
      const main = linkedRoutine(artifacts, "main");
      const touch = linkedRoutine(artifacts, "touch");
      const child = linkedRoutine(artifacts, "child");
      for (const routine of [main, touch, child])
        expect(
          callReturnPairs(routine),
          `call immediately followed by return in ${routine.name}:\n${shown(routine)}`,
        ).toEqual([]);
      if (calls(main, touch.entry).length > 0) {
        expectLeavesThrough(touch, child.entry);
        expect(routineBytes(touch.decoded), `wrapper bytes:\n${shown(touch)}`).toBeLessThanOrEqual(
          3,
        );
      } else {
        const restoration = labelAddress(main, restorationLabel(reference));
        expect(
          [...expectContinuation(main, restoration, [touch, child])],
          "the entry function continues into the wrapper",
        ).toContain("touch");
      }
    },
    180_000,
  );

  it.each(optimizing)(
    "falls from the byte function into the multiply helper placed after it in %s mode",
    async (mode) => {
      const artifacts = await build(helperSource, mode);
      const main = linkedRoutine(artifacts, "main");
      const calculate = linkedRoutine(artifacts, "calculate");
      expect(
        calls(calculate).map(({ instruction }) => instruction.text),
        `no call to the helper remains:\n${shown(calculate)}`,
      ).toEqual([]);
      expect(
        callReturnPairs(calculate),
        `no call immediately followed by return:\n${shown(calculate)}`,
      ).toEqual([]);
      const leaving = exits(calculate);
      expect(
        leaving.map((exit) => exit.kind),
        `the routine leaves only through the helper's single return:\n${shown(calculate)}`,
      ).toEqual(["return"]);
      const closings = loopClosings(calculate);
      expect(
        closings.some((position) => position < leaving[0]!.position),
        `the return is reached only after the helper's loop:\n${shown(calculate)}`,
      ).toBe(true);
      expect(
        jumpsToNext(calculate),
        `a transfer to the next address is omitted:\n${shown(calculate)}`,
      ).toEqual([]);
      expect(
        calls(main, calculate.entry),
        `the entry function still calls the function whose result it stores:\n${shown(main)}`,
      ).toHaveLength(1);
    },
    180_000,
  );

  it.each(
    [
      { type: "byte", argument: "4" },
      { type: "word", argument: "$1234" },
    ].flatMap((witness) => optimizing.map((mode) => ({ ...witness, mode }))),
  )(
    "forwards a $type result through its callee in $mode mode",
    async ({ type, argument, mode }) => {
      const artifacts = await build(forwardingSource(type as "byte" | "word", argument), mode);
      const main = linkedRoutine(artifacts, "main");
      const outer = linkedRoutine(artifacts, "outer");
      const inner = linkedRoutine(artifacts, "inner");
      expectLeavesThrough(outer, inner.entry);
      expect(
        calls(main, outer.entry),
        `the entry function still calls the forwarder:\n${shown(main)}`,
      ).toHaveLength(1);
    },
    180_000,
  );

  it.each(tailShapeChanges.flatMap((witness) => optimizing.map((mode) => ({ ...witness, mode }))))(
    "leaves through the callee when $label in $mode mode",
    async ({ source, mode }) => {
      const artifacts = await build(source, mode);
      const main = linkedRoutine(artifacts, "main");
      const outer = linkedRoutine(artifacts, "outer");
      const inner = linkedRoutine(artifacts, "inner");
      expectLeavesThrough(outer, inner.entry);
      expect(
        calls(main, outer.entry),
        `the entry function still calls the caller:\n${shown(main)}`,
      ).toHaveLength(1);
    },
    180_000,
  );
});

describe("calls outside tail position keep their call", () => {
  it.each(optimizing)(
    "keeps a call that is followed by more work in %s mode",
    async (mode) => {
      const artifacts = await build(trailingWorkSource, mode);
      const touch = linkedRoutine(artifacts, "touch");
      const child = linkedRoutine(artifacts, "child");
      const count = globalAddress(touch.labels, "count");
      const call = touch.decoded.findIndex(
        ({ instruction }) => instruction.mnemonic === "jsr" && instruction.address === child.entry,
      );
      expect(call, `the wrapper calls the child:\n${shown(touch)}`).toBeGreaterThanOrEqual(0);
      expect(
        touch.decoded
          .slice(call + 1)
          .some(({ instruction }) => isMemoryWrite(instruction) && instruction.address === count),
        `the counter is written after the call returns:\n${shown(touch)}`,
      ).toBe(true);
      expect(
        exits(touch)
          .filter((exit) => exit.address === child.entry)
          .map((exit) => exit.text),
        `no transfer into the child:\n${shown(touch)}`,
      ).toEqual([]);
    },
    180_000,
  );

  it.each(optimizing)(
    "keeps the call when a word caller widens a byte result in %s mode",
    async (mode) => {
      const artifacts = await build(wideningSource, mode);
      const outer = linkedRoutine(artifacts, "outer");
      const inner = linkedRoutine(artifacts, "inner");
      expect(calls(outer, inner.entry), `the caller still calls:\n${shown(outer)}`).toHaveLength(1);
      expect(
        exits(outer)
          .filter((exit) => exit.address === inner.entry)
          .map((exit) => exit.text),
        `no transfer into a callee whose result still needs widening:\n${shown(outer)}`,
      ).toEqual([]);
      expect(
        exits(outer).some((exit) => exit.kind === "return"),
        `the caller returns by itself:\n${shown(outer)}`,
      ).toBe(true);
    },
    180_000,
  );

  it.each(
    (["setIRQ", "setIRQExclusive"] as const).flatMap((installer) =>
      optimizing.map((mode) => ({ installer, mode })),
    ),
  )(
    "keeps the call inside a handler installed by $installer in $mode mode",
    async ({ installer, mode }) => {
      const artifacts = await build(interruptSource(installer), mode);
      const handler = interruptRoutine(artifacts);
      const child = linkedRoutine(artifacts, "child");
      expect(
        calls(handler, child.entry),
        `the handler calls the child:\n${shown(handler)}`,
      ).toHaveLength(1);
      expect(
        handler.decoded
          .filter(({ instruction }) => instruction.mnemonic === "rts")
          .map(({ instruction }) => instruction.text),
        `the handler never leaves by an ordinary return:\n${shown(handler)}`,
      ).toEqual([]);
      expect(
        exits(handler)
          .filter((exit) => exit.address === child.entry)
          .map((exit) => exit.text),
        `no transfer from the handler into the child:\n${shown(handler)}`,
      ).toEqual([]);
    },
    180_000,
  );
});

describe("a word result reaches A and X without a dead store", () => {
  it.each(optimizing)(
    "stores no byte it never reads back in %s mode",
    async (mode) => {
      const view = namedRoutine(await build(wordReturnSource, mode), "next");
      expect(
        unreadStores(view).map((instruction) => instruction.text),
        `stores the function never reads:\n${view.lines.join("\n")}`,
      ).toEqual([]);
    },
    180_000,
  );

  it.each(optimizing)(
    "returns the incremented word in A and X, carrying and wrapping, in %s mode",
    async (mode) => {
      const view = namedRoutine(await build(wordReturnSource, mode), "next");
      const input = inputWordHome(view);
      for (const [value, result] of [
        [0x12ff, 0x1300],
        [0x00ff, 0x0100],
        [0xffff, 0x0000],
        [0x1234, 0x1235],
        [0x0000, 0x0001],
      ] as const) {
        const { registers } = returnedRegisters(view, wordMemory(input, value), ["a", "x"]);
        expect(registers, `next($${value.toString(16)})`).toEqual({
          a: result & 0xff,
          x: result >>> 8,
        });
      }
    },
    180_000,
  );

  it.each(optimizing)(
    "keeps the byte result in A with no memory write in %s mode",
    async (mode) => {
      const view = namedRoutine(await build(byteReturnSource, mode), "next");
      expect(
        view.decoded.length,
        `byte result instructions:\n${view.lines.join("\n")}`,
      ).toBeLessThanOrEqual(4);
      const input = inputWordHome(view);
      for (const [value, result] of [
        [7, 8],
        [0xff, 0x00],
        [0x00, 0x01],
      ] as const) {
        const { registers, writes } = returnedRegisters(view, new Map([[input, value]]), ["a"]);
        expect(registers, `next(${value})`).toEqual({ a: result });
        expect(writes, `memory writes for next(${value})`).toEqual([]);
      }
    },
    180_000,
  );
});

describe("reference lowering keeps the ordinary call form", () => {
  it("keeps the wrapper's call to its child and its own return", async () => {
    const artifacts = await build(wrapperSource, "none");
    expect(artifacts.costs.mode).toBe("none");
    const main = linkedRoutine(artifacts, "main");
    const touch = linkedRoutine(artifacts, "touch");
    const child = linkedRoutine(artifacts, "child");
    expect(
      calls(main, touch.entry),
      `the entry function calls the wrapper:\n${shown(main)}`,
    ).toHaveLength(1);
    expect(calls(touch, child.entry), `the wrapper calls the child:\n${shown(touch)}`).toHaveLength(
      1,
    );
    expect(
      exits(touch).some((exit) => exit.kind === "return"),
      `the wrapper returns:\n${shown(touch)}`,
    ).toBe(true);
    expect(
      exits(touch)
        .filter((exit) => exit.address === child.entry)
        .map((exit) => exit.text),
      `no transfer into the child:\n${shown(touch)}`,
    ).toEqual([]);
  }, 180_000);

  it("keeps the byte function's helper call and its own return", async () => {
    const artifacts = await build(helperSource, "none");
    expect(artifacts.costs.mode).toBe("none");
    const calculate = linkedRoutine(artifacts, "calculate");
    expect(calls(calculate), `the function calls its helper:\n${shown(calculate)}`).toHaveLength(1);
    expect(
      exits(calculate).map((exit) => exit.kind),
      `the function leaves only by returning:\n${shown(calculate)}`,
    ).toSatisfy((kinds: string[]) => kinds.length > 0 && kinds.every((kind) => kind === "return"));
  }, 180_000);
});
