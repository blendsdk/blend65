import { describe, expect, it } from "vitest";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import type { MachineLoweringInput } from "./machine-types.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import { closeSource } from "./low-byte-write-forwarding-test-support.js";

/**
 * The optional argument must remain compatible with callers using the original
 * four-argument interface. Only an explicit opt-in admits named assignments.
 */
const select: (
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  includeNamedArithmeticStores?: boolean,
) => ReadonlySet<string> = selectAnonymousByteWriteValues;

/** Supply an optimistic hint so the selector must prove actual uses itself. */
function optimisticUses(blocks: readonly SemanticBlock[]): ReadonlySet<string> {
  return new Set(
    blocks.flatMap((block) =>
      block.operations.flatMap((operation) =>
        "result" in operation && operation.result !== null ? [operation.result] : [],
      ),
    ),
  );
}

/** Find arithmetic results immediately assigned to a whole named byte. */
function assignments(blocks: readonly SemanticBlock[]) {
  return blocks.flatMap((block) =>
    block.operations.flatMap((operation, index) => {
      const next = block.operations[index + 1];
      return operation.kind === "binary" &&
        (operation.operator === "+" || operation.operator === "-") &&
        next?.kind === "store" &&
        next.value === operation.result &&
        next.type.kind === "scalar" &&
        next.type.name === "byte" &&
        next.place.rootType?.kind === "scalar" &&
        next.place.rootType.name === "byte" &&
        next.place.path.length === 0
        ? [{ operation, store: next }]
        : [];
    }),
  );
}

/** Keep all observed arithmetic inside a reachable, private main loop. */
function sourceFor(operator: string, rhs: string, destination = "value"): string {
  return `module Main;
function main(): void {
  let value: byte = 165;
  let step: byte = 37;
  let output: byte = 0;
  while (true) {
    ${destination} = value ${operator} ${rhs};
    poke($D005, ${destination});
  }
}`;
}

describe("anonymous byte results assigned to named storage", () => {
  for (const operator of ["+", "-"]) {
    for (const rhs of ["step", "0", "37", "255"]) {
      for (const destination of ["value", "output"]) {
        it(`should forward ${operator} ${rhs} when explicitly enabled for ${destination}`, async () => {
          const fixture = await closeSource(sourceFor(operator, rhs, destination));
          const windows = assignments(fixture.source.blocks);
          expect(windows).toHaveLength(1);
          const window = windows[0]!;
          expect(window.operation.type).toEqual({ kind: "scalar", name: "byte" });
          expect(window.operation.integer).toEqual({
            width: 8,
            signed: false,
            wrap: true,
          });
          const selected = select(
            fixture.input,
            fixture.source,
            fixture.source.blocks,
            optimisticUses(fixture.source.blocks),
            true,
          );
          expect(selected.has(window.operation.result)).toBe(true);
          expect(selected.has(window.operation.left)).toBe(false);
          expect(selected.has(window.operation.right)).toBe(false);
          expect(fixture.source.blocks.flatMap((block) => block.operations)).toContain(
            window.store,
          );
        });
      }
    }
  }

  for (const enabled of [undefined, false]) {
    it(`should retain the anonymous capture when opt-in is ${String(enabled)}`, async () => {
      const fixture = await closeSource(sourceFor("+", "step"));
      const window = assignments(fixture.source.blocks)[0];
      expect(window).toBeDefined();
      const uses = optimisticUses(fixture.source.blocks);
      const selected =
        enabled === undefined
          ? select(fixture.input, fixture.source, fixture.source.blocks, uses)
          : select(fixture.input, fixture.source, fixture.source.blocks, uses, enabled);
      expect(selected.has(window!.operation.result)).toBe(false);
    });
  }

  it("should retain the capture when the supplied single-use set omits its result", async () => {
    const fixture = await closeSource(sourceFor("+", "step"));
    const window = assignments(fixture.source.blocks)[0]!;
    const uses = new Set(optimisticUses(fixture.source.blocks));
    uses.delete(window.operation.result);
    expect(
      select(fixture.input, fixture.source, fixture.source.blocks, uses, true).has(
        window.operation.result,
      ),
    ).toBe(false);
  });

  for (const expression of ["value + 37", "value - 37", "value + step", "lo(wide)"]) {
    it(`should preserve the raw-write boundary when the source writes ${expression}`, async () => {
      const fixture = await closeSource(`module Main;
function main(): void {
  let value: byte = 165;
  let step: byte = 37;
  let wide: word = 4660;
  while (true) { poke($D005, ${expression}); }
}`);
      const writes = fixture.source.blocks.flatMap((block) =>
        block.operations.filter((operation) => operation.kind === "memory-write"),
      );
      expect(writes).toHaveLength(1);
      const write = writes[0]!;
      if (write.kind !== "memory-write") throw new Error("Expected a raw write");
      const expected = expression === "value + 37" || expression === "lo(wide)";
      for (const enabled of [false, true]) {
        expect(
          select(
            fixture.input,
            fixture.source,
            fixture.source.blocks,
            optimisticUses(fixture.source.blocks),
            enabled,
          ).has(write.value),
        ).toBe(expected);
      }
    });
  }

  it("should retain a lo capture when its consumer is a named store", async () => {
    const fixture = await closeSource(`module Main;
function main(): void {
  let wide: word = 4660;
  let value: byte = 0;
  while (true) { value = lo(wide); poke($D005, value); }
}`);
    const writes = fixture.source.blocks.flatMap((block) =>
      block.operations.flatMap((operation, index) => {
        const next = block.operations[index + 1];
        return "result" in operation &&
          operation.result !== null &&
          next?.kind === "store" &&
          next.value === operation.result &&
          next.type.kind === "scalar" &&
          next.type.name === "byte" &&
          operation.kind !== "constant"
          ? [next]
          : [];
      }),
    );
    expect(writes).toHaveLength(1);
    expect(
      select(
        fixture.input,
        fixture.source,
        fixture.source.blocks,
        optimisticUses(fixture.source.blocks),
        true,
      ).has(writes[0]!.value),
    ).toBe(false);
  });

  it("should retain all four high-byte branch captures and word arithmetic staging when enabled", async () => {
    const text = `module Main;
function main(): void {
  let x: word = word(peek($D012));
  let xr: word = x + 24;
  let msb: byte = 0;
  let right: boolean = true;
  if (hi(x) != 0) { msb = msb | 5; }
  if (hi(xr) != 0) { msb = msb | 10; }
  poke($D010, msb);
  while (true) {
    if (right) { x = x + 2; } else { x = x - 2; }
    xr = x + 24;
    msb = 0;
    if (hi(x) != 0) { msb = msb | 5; }
    if (hi(xr) != 0) { msb = msb | 10; }
    poke($D010, msb);
  }
}`;
    const fixture = await closeSource(text);
    const operations = fixture.source.blocks.flatMap((block) => block.operations);
    const highBytes = operations.filter(
      (operation) =>
        "result" in operation &&
        operation.result !== null &&
        /^hi\((?:x|xr)\)$/.test(text.slice(operation.span.start, operation.span.end)),
    );
    expect(highBytes).toHaveLength(4);
    const wordArithmetic = operations.filter(
      (operation) =>
        operation.kind === "binary" &&
        operation.type.kind === "scalar" &&
        operation.type.name === "word",
    );
    expect(wordArithmetic).toHaveLength(4);
    const selected = select(
      fixture.input,
      fixture.source,
      fixture.source.blocks,
      optimisticUses(fixture.source.blocks),
      true,
    );
    for (const operation of [...highBytes, ...wordArithmetic]) {
      if (!("result" in operation) || operation.result === null) {
        throw new Error("Expected a captured expression result");
      }
      expect(selected.has(operation.result)).toBe(false);
    }
  });
});
