/**
 * Specification tests — entry-label `_main` + non-entry sanitization, and the
 * `assembleProgram` preamble/shape contract.
 *
 * Every expectation below is derived exclusively from the specification —
 * NEVER by running `assembleProgram` or reading its body. If a test fails
 * after implementation, the implementation is wrong, not the test.
 *
 * Package-boundary rule: `@blend65/codegen` tests use only codegen's own
 * dependency closure (`@blend65/core`, `@blend65/frontend`). The `PlatformPlugin`
 * *type* lives in `@blend65/core`, so these tests drive `assembleProgram` with a
 * minimal **inline fake plugin** — no edge to `@blend65/platforms` (which would form
 * a build cycle). The real-`c64Plugin` end-to-end golden lives in `@blend65/compiler`
 * (the integration layer that already depends on both codegen and platforms).
 */

import { describe, expect, it } from "vitest";
import { createDiagnosticBag } from "@blend65/core";
import type {
  AcmeDirective,
  MainTerminationPolicy,
  PlatformPlugin,
  PlatformProfile,
  PreambleOptions,
  ShimVariant,
  StreamEntry,
  ValidationError,
} from "@blend65/core/platform";
import { directive, instr, isLabel, label, none, symbolRef } from "@blend65/core/platform";

import { lowerToIL } from "../il/lower.js";
import { addFixture, gateFixture } from "../il/test-fixtures.js";
import { printInstr } from "./print-instr.js";
import { assembleProgram, generateInstr } from "./instr-program.js";

/**
 * A minimal in-package fake `PlatformPlugin`: NMOS CPU + a deterministic,
 * distinctive two-entry preamble (`!to` directive + a `__startup:` label). Only the
 * fields `assembleProgram` reads (`profile.cpu`, `emitPreamble`) carry meaningful
 * data; the rest satisfy the interface. This keeps codegen tests free of any
 * cross-package dependency while still exercising the real wrapper end-to-end.
 */
const fakeProfile = { cpu: "nmos6502" } as unknown as PlatformProfile;

/** The fixed preamble the fake emits — the wrapper must thread it through verbatim. */
function fakePreamble(): StreamEntry[] {
  return [
    directive({ kind: "outputFile", name: "fake.prg", format: "cbm" }),
    label("__startup"),
    instr("JSR", "Absolute", symbolRef("_main")),
    instr("RTS", "Implied", none()),
  ];
}

const fakePlugin: PlatformPlugin = {
  id: "fake",
  displayName: "Fake Test Platform",
  profile: fakeProfile,
  intrinsics: [],
  runtimeModules: [],
  emitPreamble: (_options: PreambleOptions): StreamEntry[] => fakePreamble(),
  emitStartupShim: (_variant: ShimVariant): StreamEntry[] => [],
  getOutputDirective: (projectName: string): AcmeDirective => ({
    kind: "outputFile",
    name: `${projectName}.prg`,
    format: "cbm",
  }),
  encodeString: (text: string): number[] => [...text].map((c) => c.charCodeAt(0)),
  encodeChar: (char: string): number => char.charCodeAt(0),
  getMainTerminationPolicy: (): MainTerminationPolicy => ({ canReturn: true }),
  validateProfile: (): ValidationError[] => [],
};

describe("Specification: RD-07c entry label & sanitization (ST-A6..A8)", () => {
  // The gate program's entry function (`Main.main`) is labelled `_main`,
  // not `Main.main`.
  it("labels the entry function stream `_main` (ST-A6)", () => {
    // Arrange
    const bag = createDiagnosticBag();
    const il = lowerToIL(gateFixture, bag);

    // Act
    const program = generateInstr(il, "nmos6502", bag);
    const first = program.streams[0]?.entries[0];

    // Assert — first entry is a label named exactly `_main`.
    expect(first).toBeDefined();
    expect(first !== undefined && isLabel(first)).toBe(true);
    if (first !== undefined && isLabel(first)) {
      expect(first.name).toBe("_main");
    }
  });

  // A non-entry function `Math.add` is relabelled `Math_add` (`.`→`_`).
  it("sanitizes a non-entry function label `Math.add` → `Math_add` (ST-A7)", () => {
    // Arrange
    const bag = createDiagnosticBag();
    const il = lowerToIL(addFixture, bag);

    // Act
    const program = generateInstr(il, "nmos6502", bag);
    const first = program.streams[0]?.entries[0];

    // Assert
    expect(first !== undefined && isLabel(first)).toBe(true);
    if (first !== undefined && isLabel(first)) {
      expect(first.name).toBe("Math_add");
    }
  });

  // `printInstr` of the gate entry stream renders `_main:` as its first line.
  it("renders the gate entry stream's first line as `_main:` (ST-A8)", () => {
    // Arrange
    const bag = createDiagnosticBag();
    const il = lowerToIL(gateFixture, bag);

    // Act
    const program = generateInstr(il, "nmos6502", bag);
    const firstStream = program.streams[0];
    const firstLine =
      firstStream !== undefined ? printInstr(firstStream).split("\n")[0] : undefined;

    // Assert
    expect(firstLine).toBe("_main:");
  });
});

describe("Specification: RD-07c assembleProgram preamble & shape (ST-A1..A5)", () => {
  // `assembleProgram` populates `.preamble` with exactly the plugin's
  // `emitPreamble` output.
  it("populates the preamble from the plugin's emitPreamble hook (ST-A1)", () => {
    // Arrange
    const bag = createDiagnosticBag();
    const il = lowerToIL(gateFixture, bag);

    // Act
    const program = assembleProgram(il, fakePlugin, bag);

    // Assert — deep-equals the plugin's documented output (here, the fake's).
    expect(program.preamble.length).toBeGreaterThan(0);
    expect([...program.preamble]).toEqual(fakePreamble());
  });

  // The wrapper does not alter the function streams: they are identical to
  // `generateInstr`'s streams for the same IL + CPU variant.
  it("leaves the function streams unchanged vs generateInstr (ST-A2)", () => {
    // Arrange
    const bag = createDiagnosticBag();
    const il = lowerToIL(gateFixture, bag);

    // Act
    const assembled = assembleProgram(il, fakePlugin, bag);
    const direct = generateInstr(il, fakePlugin.profile.cpu, createDiagnosticBag());

    // Assert
    expect(assembled.streams).toEqual(direct.streams);
  });

  // The allocation plan is carried through unchanged (same reference as the
  // IL program's plan).
  it("carries the allocation plan through unchanged (ST-A3)", () => {
    // Arrange
    const bag = createDiagnosticBag();
    const il = lowerToIL(gateFixture, bag);

    // Act
    const program = assembleProgram(il, fakePlugin, bag);

    // Assert — identical reference.
    expect(program.allocationPlan).toBe(il.allocationPlan);
  });

  // Assembling the same IL + plugin twice renders byte-identical ACME output
  // (determinism).
  it("is deterministic across two assembles (ST-A4)", () => {
    // Arrange
    const il = lowerToIL(gateFixture, createDiagnosticBag());

    // Act
    const a = assembleProgram(il, fakePlugin, createDiagnosticBag());
    const b = assembleProgram(il, fakePlugin, createDiagnosticBag());
    const render = (p: typeof a): string =>
      [
        printInstr({ symbol: "_pre", segment: "code", entries: [...p.preamble] }),
        ...p.streams.map(printInstr),
      ].join("\n");

    // Assert
    expect(render(a)).toBe(render(b));
  });

  // Assembling the gate program raises no diagnostics errors (live ops
  // only; no ICE).
  it("raises no errors assembling the gate program (ST-A5)", () => {
    // Arrange
    const bag = createDiagnosticBag();
    const il = lowerToIL(gateFixture, bag);

    // Act
    assembleProgram(il, fakePlugin, bag);

    // Assert
    expect(bag.hasErrors()).toBe(false);
  });
});
