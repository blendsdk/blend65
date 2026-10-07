import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CIA2_PROFILES, cia2Source } from "./cia2-fixture.js";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  profileSpan,
} from "./profile-fixture.js";
import {
  CIA2_SHUTDOWN,
  cia2FunctionVariants,
  cia2Instructions,
  cia2OperationGroups,
  cia2PrgBytes,
  expectCia2ExternalUncertainty,
  expectCia2NoPrivateHomes,
} from "./cia2-output-fixture.js";
import type { Cia2Artifacts, Cia2CodeSlice } from "./cia2-output-fixture.js";

/** Ordinary helpers keep their ABI while selecting the release policy proved at each call. */
const releaseHelpers = `function release(): void { restoreNMI(); }
function releaseWrapper(): void { release(); }`;

/** A clean pop reads the saved high byte and never touches the outer device epoch. */
function expectCleanPop(group: Cia2CodeSlice): void {
  const instructions = cia2Instructions(group.bytes);
  expect(instructions.filter(({ operand }) => operand === 0x0318)).toEqual([]);
  const stores = instructions.filter(
    ({ opcode, operand }) => opcode === 0x8d && operand === 0x0319,
  );
  expect(stores).toHaveLength(1);
  const publicationIndex = instructions.indexOf(stores[0]!);
  const load = instructions[publicationIndex - 1]!;
  expect([0xa5, 0xad]).toContain(load.opcode);
  expect(load.operand).not.toBe(0x0319);
  expect(
    instructions.filter(
      ({ operand }) => operand !== null && operand >= 0xdd00 && operand <= 0xddff,
    ),
  ).toEqual([]);
  expect(instructions.filter(({ opcode }) => [0x85, 0x8d, 0x86, 0x8e].includes(opcode))).toEqual(
    stores,
  );
}

/** Bind an unconstrained link address from its required coherent capture instruction. */
function capturedHigh(artifacts: Cia2Artifacts, source: string, proof: string): number {
  const groups = cia2OperationGroups(artifacts, source, proof);
  expect(groups).toHaveLength(1);
  const instructions = cia2Instructions(groups[0]!.bytes);
  const capture = instructions.findIndex(
    ({ opcode, operand }) => opcode === 0xad && operand === 0x0319,
  );
  expect(capture).toBeGreaterThanOrEqual(0);
  const store = instructions[capture + 1]!;
  expect([0x85, 0x8d]).toContain(store.opcode);
  return store.operand!;
}

/** The clean body must read the exact predecessor captured for the lease it pops. */
function expectCleanPredecessor(artifacts: Cia2Artifacts, source: string, address: number): void {
  const groups = cia2OperationGroups(artifacts, source, "restoreNMI()", "release");
  const clean = groups.find(({ bytes }) => !bytes.equals(CIA2_SHUTDOWN))!;
  const instructions = cia2Instructions(clean.bytes);
  const publication = instructions.findIndex(
    ({ opcode, operand }) => opcode === 0x8d && operand === 0x0319,
  );
  expect(instructions[publication - 1]!.operand).toBe(address);
}

/** Classify actual complete helper bodies by their source-correlated restore bytes. */
function releasePolicies(
  artifacts: Cia2Artifacts,
  source: string,
): Map<number, "clean" | "shutdown"> {
  const groups = cia2OperationGroups(artifacts, source, "restoreNMI()", "release");
  expect(groups).toHaveLength(2);
  const variants = cia2FunctionVariants(artifacts, "release");
  expect(variants).toHaveLength(2);
  const policies = new Map<number, "clean" | "shutdown">();
  for (const group of groups) {
    const variant = variants.find(({ variantIndex }) => variantIndex === group.variantIndex)!;
    expect(variant.bytes).toEqual(Buffer.concat([group.bytes, Buffer.from([0x60])]));
    if (group.bytes.equals(CIA2_SHUTDOWN)) policies.set(variant.start, "shutdown");
    else {
      expectCleanPop(group);
      policies.set(variant.start, "clean");
    }
  }
  expect([...policies.values()].sort()).toEqual(["clean", "shutdown"]);
  return policies;
}

/** Follow the actual ordinary JSR edge from each wrapper body to its selected release body. */
function wrapperPolicies(
  artifacts: Cia2Artifacts,
  release: ReadonlyMap<number, "clean" | "shutdown">,
): Map<number, "clean" | "shutdown"> {
  const variants = cia2FunctionVariants(artifacts, "releaseWrapper");
  expect(variants).toHaveLength(2);
  const policies = new Map<number, "clean" | "shutdown">();
  for (const variant of variants) {
    expect(variant.bytes.length).toBe(4);
    expect(variant.bytes[0]).toBe(0x20);
    expect(variant.bytes[3]).toBe(0x60);
    const target = variant.bytes.readUInt16LE(1);
    const policy = release.get(target);
    expect(policy).toBeDefined();
    if (policy === undefined) throw new Error("Wrapper targets an unrelated release body");
    policies.set(variant.start, policy);
  }
  expect([...policies.values()].sort()).toEqual(["clean", "shutdown"]);
  return policies;
}

/** Every direct call uses the body required by that source call's actual ownership state. */
function expectCallPolicy(
  artifacts: Cia2Artifacts,
  source: string,
  proof: string,
  occurrence: number,
  policies: ReadonlyMap<number, "clean" | "shutdown">,
  expected: "clean" | "shutdown",
): void {
  const groups = cia2OperationGroups(artifacts, source, proof, "main", occurrence);
  expect(groups).toHaveLength(1);
  const calls = cia2Instructions(groups[0]!.bytes).filter(({ opcode }) => opcode === 0x20);
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) expect(policies.get(call.operand!)).toBe(expected);
}

/** Verify only actually selected finite-call bodies, leaving retained stable entries distinct. */
function expectFiniteCallPolicy(
  artifacts: Cia2Artifacts,
  source: string,
  occurrence: number,
  expected: "clean" | "shutdown",
): void {
  const callSpan = profileSpan(source, "pop()", occurrence);
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    ({ path }) => path === callSpan.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const main = profileRecords(artifacts.debug.functions).find(
    ({ qualifiedName }) => qualifiedName === "src/game.blend::Game.main",
  );
  if (main === undefined) throw new Error("Missing emitted main function");
  const variants = profileRecords(main.entryVariants);
  expect(variants).toHaveLength(1);
  const indexes = variants[0]!.rangeIndexes;
  if (!Array.isArray(indexes)) throw new Error("Missing main variant ranges");
  const ranges = profileRecords(artifacts.debug.ranges);
  const candidates = indexes.flatMap((index: unknown) => {
    if (typeof index !== "number" || !Number.isInteger(index))
      throw new Error("Invalid main range index");
    const row = ranges[index];
    if (row === undefined) throw new Error("Missing main range");
    const origin = profileRecord(row.origin);
    const value = origin.kind === "source" ? origin.span : origin.sourceSpan;
    if (value === undefined) return [];
    const span = profileRecord(value);
    if (typeof span.startByte !== "number" || typeof span.endByte !== "number")
      throw new Error("Invalid source range bounds");
    return span.sourceIndex === sourceIndex &&
      span.startByte <= callSpan.start &&
      callSpan.end <= span.endByte
      ? [{ row, width: span.endByte - span.startByte }]
      : [];
  });
  expect(candidates.length).toBeGreaterThan(0);
  const width = Math.min(...candidates.map((candidate) => candidate.width));
  // A finite dispatch crosses generated branches with broader source spans.
  // Decode each narrow source-owned range separately, not the intervening bytes.
  const calls = candidates
    .filter((candidate) => candidate.width === width)
    .flatMap(({ row }) => {
      const machine = profileRecord(row.machine);
      if (
        typeof machine.start !== "number" ||
        typeof machine.end !== "number" ||
        !Number.isInteger(machine.start) ||
        !Number.isInteger(machine.end)
      )
        throw new Error("Invalid machine range bounds");
      return cia2Instructions(cia2PrgBytes(artifacts, machine.start, machine.end)).filter(
        ({ opcode }) => opcode === 0x20,
      );
    });
  expect(calls.length).toBeGreaterThan(0);
  const releases = cia2FunctionVariants(artifacts, "release");
  const wrappers = cia2FunctionVariants(artifacts, "releaseWrapper");
  for (const call of calls) {
    let selected = releases.find(({ start }) => start === call.operand);
    if (selected === undefined) {
      const wrapper = wrappers.find(({ start }) => start === call.operand);
      expect(wrapper).toBeDefined();
      if (wrapper === undefined)
        throw new Error("Finite call does not select a source target body");
      expect(wrapper.bytes.length).toBe(4);
      expect(wrapper.bytes[0]).toBe(0x20);
      expect(wrapper.bytes[3]).toBe(0x60);
      selected = releases.find(({ start }) => start === wrapper.bytes.readUInt16LE(1));
    }
    expect(selected).toBeDefined();
    if (selected === undefined) throw new Error("Missing finite-call release target");
    const operations = cia2OperationGroups(artifacts, source, "restoreNMI()", "release").filter(
      ({ variantIndex }) => variantIndex === selected.variantIndex,
    );
    expect(operations).toHaveLength(1);
    const operation = operations[0]!;
    expect(selected.bytes).toEqual(Buffer.concat([operation.bytes, Buffer.from([0x60])]));
    if (expected === "shutdown") expect(operation.bytes).toEqual(CIA2_SHUTDOWN);
    else {
      expectCleanPop(operation);
      const instructions = cia2Instructions(operation.bytes);
      const store = instructions.findIndex(
        ({ opcode, operand }) => opcode === 0x8d && operand === 0x0319,
      );
      expect(instructions[store - 1]!.operand).toBe(
        capturedHigh(artifacts, source, "setNMI(&handler)"),
      );
    }
  }
}

describe.each(CIA2_PROFILES)("CIA2 context-selected release bytes on %s", (target) => {
  // Nested ownership and equal-depth sequential ownership need different physical policies.
  it.each([
    ["nested", "release"],
    ["nested", "releaseWrapper"],
    ["equal-depth sequential", "release"],
    ["equal-depth sequential", "releaseWrapper"],
  ] as const)(
    "should select correct %s policies through %s",
    async (scenario, callName) => {
      const nested = scenario === "nested";
      const main = nested
        ? `setNMIExclusive(&handler); disableInterruptSources($1F);
setNMIExclusive(&successor); ${callName}(); ${callName}();`
        : `setNMI(&handler); ${callName}();
setNMIExclusive(&handler); disableInterruptSources($1F); ${callName}();`;
      const helpers =
        callName === "release" ? "function release(): void { restoreNMI(); }" : releaseHelpers;
      const source = cia2Source(main, "", helpers);
      const artifacts = await buildProfileSource(source, target);
      const releases = releasePolicies(artifacts, source);
      const predecessor = capturedHigh(
        artifacts,
        source,
        nested ? "setNMIExclusive(&successor)" : "setNMI(&handler)",
      );
      expectCleanPredecessor(artifacts, source, predecessor);
      if (nested)
        expect(predecessor).not.toBe(capturedHigh(artifacts, source, "setNMIExclusive(&handler)"));
      const calls = callName === "release" ? releases : wrapperPolicies(artifacts, releases);
      expectCallPolicy(artifacts, source, `${callName}();`, 0, calls, "clean");
      expectCallPolicy(artifacts, source, `${callName}();`, 1, calls, "shutdown");
      expectCia2NoPrivateHomes(artifacts, ["handler", "successor", "release", "releaseWrapper"]);
      expectCia2ExternalUncertainty(artifacts);
    },
    60_000,
  );

  // A finite source function value may choose either direct or wrapped release without a runtime token.
  it("should bind each finite call target to its actual release policy", async () => {
    const source = cia2Source(
      `let pop: fn(): void = (peek($0400) != 0) ? &release : &releaseWrapper;
setNMI(&handler); pop();
setNMIExclusive(&handler); disableInterruptSources($1F); pop();`,
      "",
      releaseHelpers,
    );
    const artifacts = await buildProfileSource(source, target);
    expectFiniteCallPolicy(artifacts, source, 0, "clean");
    expectFiniteCallPolicy(artifacts, source, 1, "shutdown");
    // All published bytes, including any retained stable entry, belong to the bound artifact.
    const primary = profileRecords(artifacts.build.artifacts).filter(
      ({ kind }) => kind === "primary",
    );
    expect(primary).toHaveLength(1);
    expect(primary[0]!.bytes).toBe(artifacts.prg.length);
    expect(primary[0]!.sha256).toBe(createHash("sha256").update(artifacts.prg).digest("hex"));
    expectCia2NoPrivateHomes(artifacts, ["handler", "release", "releaseWrapper"]);
    expectCia2ExternalUncertainty(artifacts);
  }, 60_000);
});
