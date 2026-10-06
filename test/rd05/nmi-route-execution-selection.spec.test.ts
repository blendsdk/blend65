import { access } from "node:fs/promises";
import { join } from "node:path";
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
const IMPORTS = "module Game; import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;";
const MASKED = `setNMI(&B); asm_php(); asm_sei(); asm_nop();
setIRQ(&Q); restoreIRQ(); asm_plp(); restoreNMI();`;
const TERMINAL = `${IMPORTS}
interrupt function B(): void {}
function terminal(): void { while (true) {} }
function later(address: word): void { setNMI(&B); poke(address, 7); restoreNMI(); }`;
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { address: number; bytes: number[]; range: Record<string, unknown> };

/** Acceptance includes real assembly and publication, even when a reached call has no return edge. */
async function build(source: string, profile: string): Promise<Artifacts> {
  return withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected accepted source");
    expect(checked.profileId).toBe(profile);
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected complete publication");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory.profileId).toBe(profile);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    return artifacts;
  });
}

/** Retain actual assembled instruction boundaries and exact public source provenance. */
function instructions(artifacts: Artifacts, source: string, proof: string, occurrence = 0) {
  const span = profileSpan(source, proof, occurrence);
  const sources = profileRecords(artifacts.debug.sources);
  const load = artifacts.prg.readUInt16LE(0);
  const result: Instruction[] = [];
  for (const range of profileRecords(artifacts.debug.ranges)) {
    const origin = profileRecord(range.origin);
    if (origin.kind !== "source") continue;
    const actual = profileRecord(origin.span);
    if (
      sources[Number(actual.sourceIndex)]?.path !== span.sourceId ||
      actual.startByte !== span.start ||
      actual.endByte !== span.end
    )
      continue;
    const machine = profileRecord(range.machine);
    const start = Number(machine.start);
    const end = Number(machine.end);
    expect(start).toBeGreaterThanOrEqual(load);
    expect(end).toBeGreaterThan(start);
    expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
    result.push({
      address: start,
      bytes: [...artifacts.prg.subarray(start - load + 2, end - load + 2)],
      range,
    });
  }
  return result.sort((left, right) => left.address - right.address);
}

/** Match absolute register stores and their preceding immediate loads in the assembled source operation. */
function literalStores(code: Instruction[], addresses: number[]) {
  const loads = new Map([
    [0x8d, 0xa9],
    [0x8e, 0xa2],
    [0x8c, 0xa0],
  ]);
  return code.flatMap((instruction, index) => {
    const load = loads.get(instruction.bytes[0]!);
    if (load === undefined) return [];
    expect(instruction.bytes).toHaveLength(3);
    const address = instruction.bytes[1]! | (instruction.bytes[2]! << 8);
    if (!addresses.includes(address)) return [];
    const previous = code[index - 1];
    expect(previous?.bytes[0]).toBe(load);
    expect(previous?.bytes).toHaveLength(2);
    return [{ address, value: previous!.bytes[1]!, instruction }];
  });
}

/** Resolve each published variant through ACME, without guessing private label names or entry bytes. */
function entries(artifacts: Artifacts, name: string) {
  const functions = profileRecords(artifacts.debug.functions);
  const index = functions.findIndex((fn) => fn.qualifiedName === `src/game.blend::Game.${name}`);
  expect(index).toBeGreaterThanOrEqual(0);
  return profileRecords(functions[index]!.entryVariants).map((entry) => {
    expect(typeof entry.label).toBe("string");
    const label = String(entry.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = artifacts.labels.match(
      new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)\\b`, "im"),
    );
    expect(match).not.toBeNull();
    const address = Number.parseInt(match![1]!, 16);
    const load = artifacts.prg.readUInt16LE(0);
    expect(address).toBeGreaterThanOrEqual(load);
    expect(address).toBeLessThan(load + artifacts.prg.length - 2);
    return { entry, index, address };
  });
}

/** The vector operation must publish the actual selected handler entry, not an undefined label. */
function selectedEntry(artifacts: Artifacts, source: string) {
  const stores = literalStores(instructions(artifacts, source, "setIRQ(&Q)"), [0x0314, 0x0315]);
  expect(stores.map(({ address }) => address)).toEqual([0x0314, 0x0315]);
  const address = stores[0]!.value | (stores[1]!.value << 8);
  const selected = entries(artifacts, "Q").filter((entry) => entry.address === address);
  expect(selected).toHaveLength(1);
  return selected[0]!;
}

/** Unreached operations cannot retain an executable range merely because their declaration exists. */
function expectDead(artifacts: Artifacts, source: string, proofs: string[]) {
  for (const proof of proofs) expect(instructions(artifacts, source, proof), proof).toEqual([]);
}

describe.each(PROFILES)("NMI route execution selection on %s", (profile) => {
  for (const helper of [false, true]) {
    it(`should materialize a masked selected IRQ entry with ${helper ? "an unreachable helper" : "an empty body"}`, async () => {
      // IRQ is masked throughout this installation; an ordinary helper is legal but never invoked here.
      const source = `${IMPORTS}
interrupt function B(): void {} interrupt function C(): void {}
function helper(): void { setNMI(&C); poke($0400, 7); restoreNMI(); }
place(at: $2000) interrupt function Q(): void { ${helper ? "helper();" : ""} }
function main(): void { ${MASKED} }`;
      const artifacts = await build(source, profile);
      const selected = selectedEntry(artifacts, source);
      expect(selected.address).toBe(0x2000);
      expectDead(artifacts, source, ["setNMI(&C)", "poke($0400, 7)", "restoreNMI()"]);
      if (helper) expect(instructions(artifacts, source, "helper()", 1)).toEqual([]);
      const homes = profileRecords(artifacts.memory.intervals).filter((interval) =>
        ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
      );
      // Only the live mainline NMI and IRQ installations require two-byte predecessor words.
      expect(homes.reduce((sum, interval) => sum + Number(interval.size), 0)).toBe(4);
    }, 60_000);
  }

  it("should retain the separately materialized raw handler body while its selected IRQ entry is inactive", async () => {
    // Numeric exposure retains the raw source dependency but claims no external calling-convention proof.
    const source = `${IMPORTS} interrupt function B(): void {}
place(align: 256) interrupt function Q(): void { poke($0400, 7); }
function main(): void { setNMI(&B); asm_php(); asm_sei(); asm_nop();
setIRQ(&Q); pokew($c000, word(&Q)); restoreIRQ(); asm_plp(); restoreNMI(); }`;
    const artifacts = await build(source, profile);
    const selected = selectedEntry(artifacts, source);
    const pointer = literalStores(
      instructions(artifacts, source, "pokew($c000, word(&Q))"),
      [0xc000, 0xc001],
    );
    expect(pointer.map(({ address }) => address)).toEqual([0xc000, 0xc001]);
    const rawAddress = pointer[0]!.value | (pointer[1]!.value << 8);
    const raw = entries(artifacts, "Q").filter((entry) => entry.address === rawAddress);
    expect(raw).toHaveLength(1);
    expect(rawAddress).not.toBe(selected.address);
    expect(rawAddress % 256).toBe(0);
    const stores = literalStores(instructions(artifacts, source, "poke($0400, 7)"), [0x0400]);
    expect(stores.map(({ address, value }) => ({ address, value }))).toEqual([
      { address: 0x0400, value: 7 },
    ]);
    const store = stores[0]!.instruction;
    expect(store.range.owner).toMatchObject({ kind: "function", functionIndex: raw[0]!.index });
    const ranges = profileRecords(artifacts.debug.ranges);
    const index = ranges.findIndex(
      (range) => Number(profileRecord(range.machine).start) === store.address,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    expect(raw[0]!.entry.rangeIndexes).toContain(index);
    expect(selected.entry.rangeIndexes).not.toContain(index);
  }, 60_000);

  for (const finite of [false, true]) {
    it(`should omit executable successors after ${finite ? "all finite indirect targets terminate" : "a direct terminal call"}`, async () => {
      // Neither the later call nor its unsafe writer can execute after a call without a return edge.
      const source = `${TERMINAL}
function terminalOther(): void { while (true) {} }
function main(): void { setNMI(&B);
${finite ? "let target: fn(): void = peek($0400) == 0 ? &terminal : &terminalOther; target();" : "terminal();"}
later($d020); poke($0402, 11); }`;
      const artifacts = await build(source, profile);
      expect(
        instructions(artifacts, source, finite ? "target()" : "terminal()", finite ? 0 : 1).length,
      ).toBeGreaterThan(0);
      expectDead(artifacts, source, ["later($d020)", "poke($0402, 11)", "poke(address, 7)"]);
    }, 60_000);
  }

  it("should preserve returning-arm effects and ownership while omitting a terminal arm's dead suffix", async () => {
    // One terminal arm cannot erase the other arm's effects or its required final ownership restoration.
    const source = `${TERMINAL}
function returning(): void { poke($0401, 9); }
function main(): void { setNMI(&B);
if (peek($0400) == 0) { terminal(); later($d020); poke($0403, 13); }
else { returning(); }
poke($0402, 11); restoreNMI(); }`;
    const artifacts = await build(source, profile);
    expectDead(artifacts, source, ["later($d020)", "poke($0403, 13)", "poke(address, 7)"]);
    for (const [proof, address, value] of [
      ["poke($0401, 9)", 0x0401, 9],
      ["poke($0402, 11)", 0x0402, 11],
    ] as const) {
      expect(
        literalStores(instructions(artifacts, source, proof), [address]).map(
          ({ address, value }) => ({ address, value }),
        ),
      ).toEqual([{ address, value }]);
    }
    const call = instructions(artifacts, source, "returning()", 1).filter(
      ({ bytes }) => bytes[0] === 0x20,
    );
    expect(call).toHaveLength(1);
    const returning = entries(artifacts, "returning");
    expect(returning).toHaveLength(1);
    expect(call[0]!.bytes.slice(1)).toEqual([
      returning[0]!.address & 0xff,
      returning[0]!.address >> 8,
    ]);
    const successor = instructions(artifacts, source, "poke($0402, 11)");
    const restoration = instructions(artifacts, source, "restoreNMI()", 1);
    expect(restoration.length).toBeGreaterThan(0);
    expect(call[0]!.address).toBeLessThan(successor[0]!.address);
    expect(successor.at(-1)!.address).toBeLessThan(restoration[0]!.address);
  }, 60_000);

  it("should reject a reachable opaque writer after a conditional returning alternative without generation", async () => {
    // A possible normal return reaches the opaque writer while the NMI installation is still live.
    const source = `${TERMINAL} function returning(): void {}
function main(): void { setNMI(&B);
if (peek($0400) == 0) { terminal(); } else { returning(); }
later(peekw($0401)); restoreNMI(); }`;
    await withProfileProject(source, profile, async (project, root) => {
      const span = profileSpan(source, "poke(address, 7)");
      for (const result of [
        await checkProject({ project }),
        await buildProject({ project, optimization: "none" }),
      ]) {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
        expect(result.diagnostics).toContainEqual(
          expect.objectContaining({ code: "E10278", severity: "error", primarySpan: span }),
        );
        expect(result).not.toHaveProperty("generation");
      }
      await expect(access(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
    });
  }, 60_000);
});
