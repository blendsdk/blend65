import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const PRELUDE = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {} interrupt function C(): void {}
function helper(): void { setNMI(&C); poke($0400, 7); restoreNMI(); }`;
const MASKED = `function main(): void { setNMI(&B); asm_php(); asm_sei(); asm_nop();
setIRQ(&Q); restoreIRQ(); asm_plp(); restoreNMI(); }`;
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { address: number; bytes: number[]; index: number };

/** Require both public acceptance and a fresh reconciled assembled generation. */
async function build(source: string, profile: string) {
  return withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected complete publication");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    return artifacts;
  });
}

/** Public debug boundaries identify the actual instruction bytes, excluding the PRG load word. */
function allInstructions(artifacts: Artifacts): Instruction[] {
  const load = artifacts.prg.readUInt16LE(0);
  return profileRecords(artifacts.debug.ranges).map((range, index) => {
    const machine = profileRecord(range.machine);
    const start = Number(machine.start);
    const end = Number(machine.end);
    expect(start).toBeGreaterThanOrEqual(load);
    expect(end).toBeGreaterThan(start);
    expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
    return {
      address: start,
      index,
      bytes: [...artifacts.prg.subarray(start - load + 2, end - load + 2)],
    };
  });
}

/** Exact source spans keep install, restore and source-body observations distinct. */
function operation(artifacts: Artifacts, source: string, proof: string, occurrence = 0) {
  const span = profileSpan(source, proof, occurrence);
  const ranges = profileRecords(artifacts.debug.ranges);
  const sources = profileRecords(artifacts.debug.sources);
  return allInstructions(artifacts)
    .filter(({ index }) => {
      const origin = profileRecord(ranges[index]!.origin);
      if (origin.kind !== "source") return false;
      const actual = profileRecord(origin.span);
      return (
        sources[Number(actual.sourceIndex)]?.path === span.sourceId &&
        actual.startByte === span.start &&
        actual.endByte === span.end
      );
    })
    .sort((left, right) => left.address - right.address);
}

/** Read the actual absolute or zero-page operand rather than a label-name convention. */
function operand(instruction: Instruction) {
  expect([2, 3]).toContain(instruction.bytes.length);
  return instruction.bytes[1]! | ((instruction.bytes[2] ?? 0) << 8);
}

/** The two vector writes select an actual entry associated with the source handler. */
function selected(artifacts: Artifacts, source: string, occurrence = 0) {
  const install = operation(artifacts, source, "setIRQ(&Q)", occurrence);
  const immediateLoads = new Map([
    [0x8d, 0xa9],
    [0x8e, 0xa2],
    [0x8c, 0xa0],
  ]);
  const stores = install.filter(
    (instruction) =>
      immediateLoads.has(instruction.bytes[0]!) && [0x0314, 0x0315].includes(operand(instruction)),
  );
  expect(stores.map(operand)).toEqual([0x0314, 0x0315]);
  const values = stores.map((store) => {
    const previous = install[install.indexOf(store) - 1];
    expect(previous?.bytes[0]).toBe(immediateLoads.get(store.bytes[0]!));
    expect(previous?.bytes).toHaveLength(2);
    return previous!.bytes[1]!;
  });
  const address = values[0]! | (values[1]! << 8);
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex((fn) => fn.qualifiedName === "src/game.blend::Game.Q");
  expect(functionIndex).toBeGreaterThanOrEqual(0);
  const variants = profileRecords(functions[functionIndex]!.entryVariants);
  expect(variants).toHaveLength(1);
  const entry = variants[0]!;
  const label = String(entry.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(artifacts.labels).toMatch(
    new RegExp(`^\\s*${label}\\s*=\\s*\\$${address.toString(16)}\\b`, "im"),
  );
  const rangeIndexes = entry.rangeIndexes;
  if (!Array.isArray(rangeIndexes)) throw new TypeError("Missing selected entry ranges");
  const ranges = profileRecords(artifacts.debug.ranges);
  for (const index of rangeIndexes) {
    expect(Number.isInteger(index)).toBe(true);
    expect(ranges[Number(index)]!.owner).toMatchObject({ kind: "function", functionIndex });
  }
  const code = allInstructions(artifacts)
    .filter(({ index }) => rangeIndexes.includes(index))
    .sort((left, right) => left.address - right.address);
  expect(code.length).toBeGreaterThan(0);
  expect(code[0]!.address).toBe(address);
  return { address, code, install };
}

/** Capture and restoration must use the same proved two-byte predecessor read from CINV. */
function expectCapturedLink(
  artifacts: Artifacts,
  source: string,
  install: Instruction[],
  home: number,
) {
  const loads = [0xa5, 0xa6, 0xa4, 0xad, 0xae, 0xac];
  const stores = [0x85, 0x86, 0x84, 0x8d, 0x8e, 0x8c];
  const accesses = (code: Instruction[], opcodes: number[], addresses: number[]) =>
    code
      .filter(
        (instruction) =>
          opcodes.includes(instruction.bytes[0]!) && addresses.includes(operand(instruction)),
      )
      .map(operand);
  expect(accesses(install, loads, [0x0314, 0x0315])).toEqual([0x0314, 0x0315]);
  expect(accesses(install, stores, [home, home + 1])).toEqual([home, home + 1]);
  const restore = operation(artifacts, source, "restoreIRQ()");
  expect(accesses(restore, loads, [home, home + 1])).toEqual([home, home + 1]);
  expect(accesses(restore, stores, [0x0314, 0x0315])).toEqual([0x0314, 0x0315]);
  expect(home & 0xff).toBeLessThanOrEqual(0xfe);
  const homes = profileRecords(artifacts.memory.intervals).filter((interval) =>
    ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
  );
  expect(
    homes.some((interval) => Number(interval.start) <= home && Number(interval.end) >= home + 2),
  ).toBe(true);
  // Main's two live installations require only their two-byte predecessor words.
  expect(homes.reduce((sum, interval) => sum + Number(interval.size), 0)).toBe(4);
}

describe.each(PROFILES)("reference-only selected IRQ bytes on %s", (profile) => {
  for (const fixture of [
    { name: "empty handler", body: "" },
    { name: "handler with an unreachable ordinary helper", body: "helper();" },
    { name: "nonreturning handler", body: "while (true) {}" },
  ]) {
    it(`should emit only the captured-CINV jump for a masked ${fixture.name}`, async () => {
      // No invocation is fabricated: the address exists, but IRQ cannot enter this lifetime.
      const source = `${PRELUDE}
place(at: $2000) interrupt function Q(): void { ${fixture.body} }
${MASKED}`;
      const artifacts = await build(source, profile);
      const entry = selected(artifacts, source);
      expect(entry.address).toBe(0x2000);
      expect(entry.code).toHaveLength(1);
      const instruction = entry.code[0]!;
      expect(instruction.bytes).toHaveLength(3);
      expect(instruction.bytes[0]).toBe(0x6c);
      const home = operand(instruction);
      expect(instruction.bytes).toEqual([0x6c, home & 0xff, home >> 8]);
      // NMOS JMP indirect is exactly 3 bytes / 5 nominal cycles and touches no stack or flags.
      expectCapturedLink(artifacts, source, entry.install, home);
      const objects = profileRecords(artifacts.memory.intervals).filter(
        (interval) =>
          interval.kind === "code" && profileRecord(interval.owner).id === "src/game.blend::Game.Q",
      );
      expect(objects).toHaveLength(1);
      expect(objects[0]).toMatchObject({
        start: 0x2000,
        end: 0x2003,
        size: 3,
        owner: { kind: "function", id: "src/game.blend::Game.Q" },
      });
      expect(operation(artifacts, source, "setNMI(&C)")).toEqual([]);
      expect(operation(artifacts, source, "poke($0400, 7)")).toEqual([]);
    }, 60_000);
  }

  it("should keep the real nonreturning body when the same selected identity later becomes IRQ-eligible", async () => {
    // A real observed context takes precedence over the earlier masked reference to the same identity.
    const source = `${PRELUDE}
place(at: $2000) interrupt function Q(): void { poke($0400, 7); while (true) {} }
function main(): void { setNMI(&B); asm_php(); asm_sei(); asm_nop();
setIRQ(&Q); restoreIRQ(); setIRQ(&Q); asm_cli(); asm_nop(); asm_sei();
restoreIRQ(); asm_plp(); restoreNMI(); }`;
    const artifacts = await build(source, profile);
    const first = selected(artifacts, source);
    const observed = selected(artifacts, source, 1);
    expect(first.address).toBe(0x2000);
    expect(observed.address).toBe(first.address);
    const body = operation(artifacts, source, "poke($0400, 7)", 1);
    const immediateLoads = new Map([
      [0x8d, 0xa9],
      [0x8e, 0xa2],
      [0x8c, 0xa0],
    ]);
    const stores = body.filter(
      (instruction) => immediateLoads.has(instruction.bytes[0]!) && operand(instruction) === 0x0400,
    );
    expect(stores).toHaveLength(1);
    const previous = body[body.indexOf(stores[0]!) - 1]!;
    expect(previous.bytes).toEqual([immediateLoads.get(stores[0]!.bytes[0]!), 7]);
    expect(observed.code.map(({ index }) => index)).toContain(stores[0]!.index);
    expect(observed.code.flatMap(({ bytes }) => bytes).length).toBeGreaterThan(3);
    // This source never returns, so its real body has no generated predecessor-chain tail.
    expect(observed.code.some(({ bytes }) => bytes[0] === 0x6c)).toBe(false);
  }, 60_000);
});
