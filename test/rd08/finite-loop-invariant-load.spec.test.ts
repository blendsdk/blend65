import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";
import {
  clobbersAccumulator,
  decodeLine,
  findInnermostLoop,
  globalAddress,
  innermostLoop,
  readMnemonics,
  readsStoredValue,
  routine,
  routineBytes,
  routineCycles,
} from "./emitted-routine-support.js";
import type { Decoded, Loop, StoredValue } from "./emitted-routine-support.js";

/** The one selected target every witness and control below is built for. */
const target = "c64-pal-prg-kernal-6581";

/**
 * Build a module that fills successive elements of an array held inside an object.
 *
 * The padding field in front of the array decides the displacement the generated
 * store has to carry, which is the point of these witnesses: the stored byte must
 * be loaded once whether the destination starts at the object's own home or well
 * inside it.
 */
function sheetSource(padding: string, bound: number, rhs: string, globals = ""): string {
  return `module Game;
struct Sheet { pad: ${padding}; row: byte[8]; }
let sheet: Sheet;
${globals}function work(): void {
  for (let i: word = 0; i < ${bound}; i += 1) { sheet.row[i] = ${rhs}; }
}
function main(): void { work(); }
`;
}

/**
 * Build a module whose `work` function fills a plain module array.
 *
 * This is the undisplaced destination, and the shared shape for the controls:
 * they differ from an eligible witness only in the value being stored, so
 * nothing else in the program can explain a difference in the emitted routine.
 */
function arraySource(bound: number, body: string, globals = ""): string {
  return `module Game;
let rows: byte[8] = [;0];
${globals}function work(): void {
  for (let i: word = 0; i < ${bound}; i += 1) { ${body} }
}
function main(): void { work(); }
`;
}

/**
 * The loop owner, its exit read as the return it stands for.
 *
 * `work` is the last thing `main` calls, so it may continue into the startup
 * restoration instead of returning: by a jump that lands on the restoration, or
 * by ending exactly where the restoration begins. Either form is read here as
 * the `rts` it replaced, so the shape, size and cycle figures below keep
 * measuring the routine's own work. Anything else is left as emitted.
 */
function owner(artifacts: Parameters<typeof routine>[0]): ReturnType<typeof routine> {
  const found = routine(artifacts);
  const { decoded, labels } = found;
  const restorationSuffix = `_${Buffer.from("startup.restore").toString("hex")}`;
  const restoration = [...labels].find(([label]) => label.endsWith(restorationSuffix))?.[1];
  const last = decoded.at(-1);
  const owned = [...labels].filter(([label]) => label.startsWith("b65_Game_work_"));
  const entry = owned.length === 0 ? undefined : Math.min(...owned.map(([, address]) => address));
  const returning = decodeLine("  rts", labels);
  if (restoration === undefined || last === undefined || returning === undefined) return found;
  if (last.instruction.mnemonic === "jmp" && last.instruction.address === restoration)
    return { ...found, decoded: [...decoded.slice(0, -1), { ...last, instruction: returning }] };
  if (
    !["rts", "rti", "jmp"].includes(last.instruction.mnemonic) &&
    entry !== undefined &&
    entry + routineBytes(decoded) === restoration
  )
    return {
      ...found,
      decoded: [
        ...decoded,
        { lineIndex: last.lineIndex + 1, instruction: returning, address: undefined },
      ],
    };
  return found;
}

/** Declaration of the module byte global that the global-valued witnesses store. */
function valueGlobal(initial: number): string {
  return `let value: byte = ${initial};\n`;
}

/** The register-indexed shape one fill witness must be emitted as. */
interface FillShape {
  readonly bound: number;
  readonly firstElement: number;
  readonly value: StoredValue;
}

/**
 * Require the hoisted fill shape.
 *
 * The counter is initialized, the stored byte is loaded once, and only then is
 * the loop entered. The repeated span is the element store with the counter's
 * own step, compare and branch, none of which writes the accumulator, so the
 * byte survives every trip and is never read a second time.
 */
function expectHoistedFill(
  lines: readonly string[],
  decoded: readonly Decoded[],
  loop: Loop,
  shape: FillShape,
): void {
  const emitted = `emitted as:\n${lines.join("\n")}`;
  expect(decoded, emitted).toHaveLength(7);
  const [init, load, store, step, compare, branch, exit] = decoded.map(
    (entry) => entry.instruction,
  );

  expect(init!.mnemonic, `counter init, ${emitted}`).toBe("ldx");
  expect(init!.mode, "counter init mode").toBe("immediate");
  expect(init!.immediate, "first element index").toBe(0);

  expect(load!.mnemonic, `stored byte load, ${emitted}`).toBe("lda");
  if (shape.value.kind === "immediate") {
    expect(load!.mode, "stored byte load mode").toBe("immediate");
    expect(load!.immediate, "stored constant").toBe(shape.value.literal);
  } else {
    expect(load!.mode, "stored byte load mode").toBe("absolute");
    expect(load!.address, "stored global home").toBe(shape.value.address);
  }

  expect(store!.mnemonic, "element store").toBe("sta");
  expect(store!.mode, "element store mode").toBe("absoluteIndexed");
  expect(store!.index, "element store index register").toBe("x");
  expect(store!.address, "first stored element, including its displacement").toBe(
    shape.firstElement,
  );

  expect(step!.mnemonic, "counter step").toBe("inx");
  expect(step!.mode, "counter step mode").toBe("implied");
  expect(compare!.mnemonic, "bound compare").toBe("cpx");
  expect(compare!.mode, "bound compare mode").toBe("immediate");
  expect(compare!.immediate, "loop bound").toBe(shape.bound);
  expect(branch!.mnemonic, "loop branch").toBe("bcc");
  expect(exit!.mnemonic, "routine return").toBe("rts");

  // Soft, so a wrongly placed load still reports the cycle cost it causes.
  expect.soft(loop, `repeated span, ${emitted}`).toEqual({ start: 2, end: 5 });
  const body = decoded.slice(loop.start, loop.end + 1);
  expect
    .soft(
      body.filter((entry) => clobbersAccumulator(entry.instruction)).map((e) => e.instruction.text),
      "accumulator rewritten inside the loop",
    )
    .toEqual([]);
  expect
    .soft(
      body
        .filter((entry) => readsStoredValue(entry.instruction, shape.value))
        .map((e) => e.instruction.text),
      "stored byte read again inside the loop",
    )
    .toEqual([]);
}

/**
 * Require that the stored byte is still read inside the repeated span.
 *
 * This is the shared obligation of every control: the value may change between
 * trips, so it has to be read again on each one and may not be held in a
 * register across the loop.
 */
function expectReadKeptInLoop(
  lines: readonly string[],
  decoded: readonly Decoded[],
  loop: Loop,
  value: StoredValue,
): void {
  const body = decoded.slice(loop.start, loop.end + 1);
  expect(
    body
      .filter((entry) => readsStoredValue(entry.instruction, value))
      .map((e) => e.instruction.text),
    `reads of the stored byte inside the loop, emitted as:\n${lines.join("\n")}`,
  ).not.toEqual([]);
}

/** Require that the stored byte is produced inside the loop, whatever produces it. */
function expectAccumulatorWorkInLoop(
  lines: readonly string[],
  decoded: readonly Decoded[],
  loop: Loop,
): void {
  const body = decoded.slice(loop.start, loop.end + 1);
  expect(
    body.filter((entry) => clobbersAccumulator(entry.instruction)).map((e) => e.instruction.text),
    `accumulator work inside the loop, emitted as:\n${lines.join("\n")}`,
  ).not.toEqual([]);
}

describe("invariant byte stores in finite counted loops", () => {
  it.each(["balanced", "size"] as const)(
    "loads the stored constant once before a displaced four-element fill in %s mode",
    async (mode) => {
      const source = sheetSource("byte", 4, "7");
      const artifacts = await buildProfileSource(source, target, mode);
      expect(artifacts.debug).toMatchObject({ profileId: target, optimization: mode });
      expect(artifacts.costs.mode).toBe(mode);

      const { lines, decoded, labels } = owner(artifacts);
      const loop = innermostLoop(lines, decoded);
      expectHoistedFill(lines, decoded, loop, {
        bound: 4,
        firstElement: globalAddress(labels, "sheet") + 1,
        value: { kind: "immediate", literal: 7 },
      });
      // Moving the load out of the loop changes where it runs, not how much code
      // is emitted, so the routine stays the same size and runs four trips
      // without reloading.
      expect(routineBytes(decoded), "routine bytes").toBe(13);
      expect(routineCycles(decoded, loop, 4), "routine cycles").toBe(57);
    },
    180_000,
  );

  it("loads a byte global once before an eight-element fill", async () => {
    const source = sheetSource("byte[255]", 8, "value", valueGlobal(255));
    const artifacts = await buildProfileSource(source, target, "balanced");

    const { lines, decoded, labels } = owner(artifacts);
    const loop = innermostLoop(lines, decoded);
    expectHoistedFill(lines, decoded, loop, {
      bound: 8,
      firstElement: globalAddress(labels, "sheet") + 255,
      value: { kind: "global", address: globalAddress(labels, "value") },
    });
    expect(routineBytes(decoded), "routine bytes").toBe(14);
    expect(routineCycles(decoded, loop, 8), "routine cycles").toBe(107);
  }, 180_000);

  it("loads a byte global once before a four-element fill", async () => {
    const source = sheetSource("byte[127]", 4, "value", valueGlobal(128));
    const artifacts = await buildProfileSource(source, target, "balanced");

    const { lines, decoded, labels } = owner(artifacts);
    const loop = innermostLoop(lines, decoded);
    expectHoistedFill(lines, decoded, loop, {
      bound: 4,
      firstElement: globalAddress(labels, "sheet") + 127,
      value: { kind: "global", address: globalAddress(labels, "value") },
    });
    expect(routineBytes(decoded), "routine bytes").toBe(14);
    expect(routineCycles(decoded, loop, 4), "routine cycles").toBe(59);
  }, 180_000);

  it("loads the stored constant once for an undisplaced fill", async () => {
    // A destination that starts at its own home needs the same treatment: the
    // displacement decides the store's operand, never how often the stored
    // byte is read. The size and cycle figures follow from that one shape.
    const artifacts = await buildProfileSource(arraySource(4, "rows[i] = 7;"), target, "balanced");

    const { lines, decoded, labels } = owner(artifacts);
    const loop = innermostLoop(lines, decoded);
    expectHoistedFill(lines, decoded, loop, {
      bound: 4,
      firstElement: globalAddress(labels, "rows"),
      value: { kind: "immediate", literal: 7 },
    });
    expect(routineBytes(decoded), "routine bytes").toBe(13);
    expect(routineCycles(decoded, loop, 4), "routine cycles").toBe(57);
  }, 180_000);

  it("keeps the reload when the body changes the stored global", async () => {
    // The stored byte is not the same on every trip, so nothing may be kept in
    // the accumulator across the loop. The check stays deliberately general:
    // a running value may legitimately be carried in a register and updated
    // there, which is still not the same as holding one value across trips.
    const source = arraySource(4, "rows[i] = value; value += 1;", valueGlobal(1));
    const artifacts = await buildProfileSource(source, target, "balanced");

    const { lines, decoded } = owner(artifacts);
    const loop = innermostLoop(lines, decoded);
    const body = decoded.slice(loop.start, loop.end + 1);
    expect(
      body.filter((entry) => clobbersAccumulator(entry.instruction)).map((e) => e.instruction.text),
      `accumulator work inside the loop, emitted as:\n${lines.join("\n")}`,
    ).not.toEqual([]);
  }, 180_000);

  it("keeps the hardware read inside the loop", async () => {
    // A hardware read can answer differently on every trip, so it stays in the
    // repeated part of the routine. Where exactly it lands within that part is
    // the lowering's business; being lifted out of it is not.
    const artifacts = await buildProfileSource(
      arraySource(4, "rows[i] = peek($D012);"),
      target,
      "balanced",
    );

    const { lines, decoded } = owner(artifacts);
    const loop = innermostLoop(lines, decoded);
    const emitted = `emitted as:\n${lines.join("\n")}`;
    const reads = decoded.filter((entry) => entry.instruction.address === 0xd012);
    expect
      .soft(
        reads.map((entry) => entry.instruction.text),
        `hardware reads, ${emitted}`,
      )
      .toHaveLength(1);
    const repeated = reads.filter((entry) => {
      const position = decoded.indexOf(entry);
      return position >= loop.start && position <= loop.end;
    });
    expect(
      repeated.map((entry) => entry.instruction.text),
      `hardware reads inside the loop, ${emitted}`,
    ).not.toEqual([]);
    expect
      .soft(
        repeated.map((entry) => readMnemonics.has(entry.instruction.mnemonic)),
        "hardware read into a register",
      )
      .not.toContain(false);
  }, 180_000);

  it("keeps a counter-dependent value computed on every trip", async () => {
    // The stored byte is derived from the counter, so it differs on every trip
    // and has to be produced inside the loop however it is produced.
    const artifacts = await buildProfileSource(
      arraySource(4, "rows[i] = lo(i);"),
      target,
      "balanced",
    );

    const { lines, decoded } = owner(artifacts);
    expectAccumulatorWorkInLoop(lines, decoded, innermostLoop(lines, decoded));
  }, 180_000);

  it("keeps the reload while a handler that writes the stored global is installed", async () => {
    // The handler can run between two trips and write the byte the loop stores,
    // so the loop cannot treat it as unchanged even though the loop itself never
    // writes it. A stored literal would be a different case: nothing can write a
    // literal, so an expert hoists one whatever is installed.
    const source = `module Game;
import { setNMI, restoreNMI } from c64.system;
let rows: byte[8] = [;0];
let value: byte = 255;
interrupt function handler(): void { value = 1; }
function work(): void {
  for (let i: word = 0; i < 4; i += 1) { rows[i] = value; }
}
function main(): void { setNMI(&handler); work(); restoreNMI(); }
`;
    const artifacts = await buildProfileSource(source, target, "balanced");

    const { lines, decoded, labels } = owner(artifacts);
    const loop = innermostLoop(lines, decoded);
    expectReadKeptInLoop(lines, decoded, loop, {
      kind: "global",
      address: globalAddress(labels, "value"),
    });
  }, 180_000);

  it.each([
    { label: "a stored constant", padding: "byte", bound: 4, rhs: "7", globals: "", literal: 7 },
    {
      label: "a byte global",
      padding: "byte[255]",
      bound: 8,
      rhs: "value",
      globals: valueGlobal(255),
      literal: undefined,
    },
    {
      label: "a byte global",
      padding: "byte[127]",
      bound: 4,
      rhs: "value",
      globals: valueGlobal(128),
      literal: undefined,
    },
  ])(
    "keeps the per-trip read when no optimization is selected: $label, bound $bound",
    async (witness) => {
      // Keeping a byte in a register across a loop depends on the loop already
      // being register-counted, which an unoptimized build does not do, so the
      // stored byte is still read on every trip.
      const source = sheetSource(witness.padding, witness.bound, witness.rhs, witness.globals);
      const artifacts = await buildProfileSource(source, target, "none");
      expect(artifacts.costs.mode).toBe("none");

      const { lines, decoded, labels } = owner(artifacts);
      const loop = innermostLoop(lines, decoded);
      expectReadKeptInLoop(
        lines,
        decoded,
        loop,
        witness.literal === undefined
          ? { kind: "global", address: globalAddress(labels, "value") }
          : { kind: "immediate", literal: witness.literal },
      );
    },
    180_000,
  );

  it("leaves a single-trip fill with only the read it already needs", async () => {
    // A loop that runs once has no repeated read to remove, so there is nothing
    // for a hoist to save: exactly one read of the stored byte and one store,
    // wherever the lowering decides to place them. Stated as that property
    // rather than as an artifact digest, because the shape a single trip lowers
    // to is free to change while the property holds.
    const artifacts = await buildProfileSource(arraySource(1, "rows[i] = 7;"), target, "balanced");

    const { lines, decoded } = owner(artifacts);
    const emitted = `emitted as:\n${lines.join("\n")}`;
    const value: StoredValue = { kind: "immediate", literal: 7 };
    const reads = decoded.filter((entry) => readsStoredValue(entry.instruction, value));
    expect(
      reads.map((e) => e.instruction.text),
      `reads of the stored byte, ${emitted}`,
    ).toHaveLength(1);
    expect(
      decoded
        .filter((entry) => entry.instruction.mnemonic === "sta")
        .map((e) => e.instruction.text),
      `element stores, ${emitted}`,
    ).toHaveLength(1);
    const loop = findInnermostLoop(lines, decoded);
    if (loop !== undefined) {
      const position = decoded.indexOf(reads[0]!);
      expect(position, `read inside the single trip, ${emitted}`).toBeGreaterThanOrEqual(
        loop.start,
      );
      expect(position, `read inside the single trip, ${emitted}`).toBeLessThanOrEqual(loop.end);
    }
  }, 180_000);
});
