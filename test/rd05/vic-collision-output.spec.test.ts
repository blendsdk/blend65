import { buildProject } from "@blend65/compiler";
import { beforeAll, describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

const operations = [
  { name: "readAndClearSpriteSpriteCollisions", address: 0xd01e },
  { name: "readAndClearSpriteBackgroundCollisions", address: 0xd01f },
] as const;

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { opcode: string; operand: string };

/** Delimit only the source operation slice; marker NOPs are charged outside its expert cost. */
function sourceWithBody(body: string): string {
  return `module Game;
function main(): void {
  asm_nop();
  ${body}
  asm_nop();
}`;
}

/** Inspect artifacts returned by a real public build using the selected profile and ACME. */
async function build(body: string, target: string): Promise<Artifacts> {
  return withProfileProject(sourceWithBody(body), target, async (project) => {
    const result = await buildProject({ project, optimization: "none" });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected a complete collision-read build");
    const artifacts = await readProfileArtifacts(result);
    expect(artifacts.memory.profileId).toBe(target);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const inputs = profileRecord(artifacts.build.semanticInputs);
    expect(profileRecord(inputs.target)).toMatchObject({ profileId: target, cpuId: "nmos6510" });
    expect(profileRecords(artifacts.build.portableTools)).toContainEqual(
      expect.objectContaining({ name: "acme", version: "0.97" }),
    );
    return artifacts;
  });
}

/** Preserve emitted instruction order while ignoring comments, labels and assembler directives. */
function instructions(assembly: string): Instruction[] {
  return assembly.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([a-z]{3})\b\s*(.*?)\s*$/iu.exec(line.split(";")[0]!);
    return match
      ? [
          {
            opcode: match[1]!.toLowerCase(),
            operand: match[2]!.replace(/^\+[12]\s+/u, "").toLowerCase(),
          },
        ]
      : [];
  });
}

/** A direct absolute LDA reads once, changes A/N/Z, and preserves X/Y/S/C/V/D/I. */
function directRead(address: number): Instruction {
  return { opcode: "lda", operand: `$${address.toString(16)}` };
}

/** Count complete program bytes from both the actual PRG payload and independent report entries. */
function programBytes(artifacts: Artifacts): number {
  const actual = artifacts.prg.length - 2;
  expect(profileRecord(artifacts.costs.totals).programBytes).toBe(actual);
  expect(
    profileRecords(artifacts.costs.entries)
      .filter(({ kind, accounting }) => kind === "bytes" && accounting === "program")
      .reduce((total, entry) => total + Number(entry.bytes), 0),
  ).toBe(actual);
  return actual;
}

/** Compare reserved execution storage without prescribing its addresses, labels or frame topology. */
function executionStorage(artifacts: Artifacts) {
  return profileRecords(artifacts.memory.intervals)
    .filter(({ kind }) => kind === "sfa" || kind === "zeroPage" || kind === "scratch")
    .map(({ kind, size, owner }) => ({ kind, size, ownerKind: profileRecord(owner).kind }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** These slices declare no local homes; their operations cannot add hidden runtime storage. */
function expectResources(artifacts: Artifacts, scaffold: Artifacts) {
  expect(executionStorage(artifacts)).toEqual(executionStorage(scaffold));
  const resources = profileRecords(profileRecord(artifacts.costs.totals).resources);
  const baseline = profileRecords(profileRecord(scaffold.costs.totals).resources);
  for (const id of ["zeroPage", "hardwareStack", "scratch"]) {
    const resource = resources.find((entry) => entry.id === id);
    expect(resource, `Missing complete-program resource ${id}`).toBeDefined();
    expect(resource?.value).toBe(baseline.find((entry) => entry.id === id)?.value);
  }
}

/**
 * Check the exact straight-line body and its real assembled bytes, not mnemonic appearance alone.
 * LDA absolute is AD low high (3 bytes, 4 nominal cycles); the caller's STA absolute is
 * 8D low high (3 bytes, 4 nominal cycles). VIC bus contention is not a wall-clock claim here.
 */
function expectSlice(
  artifacts: Artifacts,
  scaffold: Artifacts,
  expected: readonly Instruction[],
  expectedCost: {
    deviceBytes: number;
    deviceCycles: number;
    callerBytes: number;
    callerCycles: number;
  },
) {
  const code = instructions(artifacts.assembly);
  const firstRead = code.findIndex(({ operand }) => operand === "$d01e" || operand === "$d01f");
  expect(firstRead).toBeGreaterThanOrEqual(0);
  const before = code.findLastIndex(({ opcode }, index) => index < firstRead && opcode === "nop");
  const after = code.findIndex(({ opcode }, index) => index > firstRead && opcode === "nop");
  expect(before).toBeGreaterThanOrEqual(0);
  expect(after).toBeGreaterThan(firstRead);
  expect(code.slice(before + 1, after)).toEqual(expected);
  // Only each consuming latch is touched; neither IRQ acknowledgement nor a device write is implied.
  expect(code.filter(({ operand }) => /^\$0*d01[9ef]$/u.test(operand))).toEqual(
    expected.filter(({ operand }) => operand === "$d01e" || operand === "$d01f"),
  );
  const bytes: number[] = [];
  let deviceBytes = 0;
  let deviceCycles = 0;
  let callerBytes = 0;
  let callerCycles = 0;
  for (const instruction of expected) {
    const address = Number.parseInt(instruction.operand.slice(1), 16);
    expect(instruction.opcode === "lda" || instruction.opcode === "sta").toBe(true);
    bytes.push(instruction.opcode === "lda" ? 0xad : 0x8d, address & 0xff, address >>> 8);
    if (instruction.opcode === "lda") {
      deviceBytes += 3;
      deviceCycles += 4;
    } else {
      callerBytes += 3;
      callerCycles += 4;
    }
  }
  expect({ deviceBytes, deviceCycles, callerBytes, callerCycles }).toEqual(expectedCost);
  const marked = Buffer.from([0xea, ...bytes, 0xea]);
  const payload = artifacts.prg.subarray(2);
  const offset = payload.indexOf(marked);
  expect(offset, "Missing exact direct-read bytes in the assembled PRG").toBeGreaterThanOrEqual(0);
  expect(payload.indexOf(marked, offset + 1)).toBe(-1);
  expect([...payload.subarray(offset + 1, offset + 1 + bytes.length)]).toEqual(bytes);
  expect(programBytes(artifacts) - programBytes(scaffold)).toBe(deviceBytes + callerBytes);
  expectResources(artifacts, scaffold);
}

describe.each(profiles)("VIC collision output on %s", (target) => {
  let scaffold: Artifacts;
  beforeAll(async () => {
    scaffold = await build("", target);
  }, 60_000);

  // Retaining the full participation mask needs one direct read and one source-requested destination store.
  it.each(operations)(
    "should retain every sampled bit when $name is used as a byte value",
    async ({ name, address }) => {
      const artifacts = await build(`poke($0400, c64.vic.${name}());`, target);
      expectSlice(artifacts, scaffold, [directRead(address), { opcode: "sta", operand: "$0400" }], {
        deviceBytes: 3,
        deviceCycles: 4,
        callerBytes: 3,
        callerCycles: 4,
      });
    },
    60_000,
  );

  // An unused return value still consumes the latch exactly once with the expert direct-load floor.
  it.each(operations)(
    "should keep one direct read when the result of $name is discarded",
    async ({ name, address }) => {
      const artifacts = await build(`c64.vic.${name}();`, target);
      expectSlice(artifacts, scaffold, [directRead(address)], {
        deviceBytes: 3,
        deviceCycles: 4,
        callerBytes: 0,
        callerCycles: 0,
      });
    },
    60_000,
  );

  // Consuming reads remain three distinct observations even when all three return values are unused.
  it.each(operations)(
    "should keep three ordered reads when a discarded $name call is followed by two repeats",
    async ({ name, address }) => {
      const artifacts = await build(
        `c64.vic.${name}(); c64.vic.${name}(); c64.vic.${name}();`,
        target,
      );
      expectSlice(
        artifacts,
        scaffold,
        [directRead(address), directRead(address), directRead(address)],
        {
          deviceBytes: 9,
          deviceCycles: 12,
          callerBytes: 0,
          callerCycles: 0,
        },
      );
    },
    60_000,
  );

  // Reading one latch does not touch the other latch or acknowledge either collision IRQ bit.
  it.each([
    { order: "sprite then background", calls: [operations[0], operations[1]] },
    { order: "background then sprite", calls: [operations[1], operations[0]] },
  ])(
    "should preserve the exact register sequence when the calls run $order",
    async ({ calls }) => {
      const artifacts = await build(
        calls.map(({ name }) => `c64.vic.${name}();`).join(" "),
        target,
      );
      expectSlice(
        artifacts,
        scaffold,
        calls.map(({ address }) => directRead(address)),
        {
          deviceBytes: 6,
          deviceCycles: 8,
          callerBytes: 0,
          callerCycles: 0,
        },
      );
    },
    60_000,
  );
});
