import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Select operation provenance, not an enclosing declaration's broader span. */
function sourceRanges(a: Artifacts, source: string, expression: string) {
  const span = profileSpan(source, expression);
  const sourceIndex = profileRecords(a.debug.sources).findIndex((s) => s.path === "src/game.blend");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  return profileRecords(a.debug.ranges).filter((r) => {
    const origin = profileRecord(r.origin);
    if (origin.kind !== "source") return false;
    const s = profileRecord(origin.span);
    const machine = profileRecord(r.machine);
    return (
      s.sourceIndex === sourceIndex &&
      Number(s.startByte) >= span.start &&
      Number(s.endByte) <= span.end &&
      Number(machine.end) > Number(machine.start)
    );
  });
}

/** Join only adjacent instruction ranges from this one source/context operation. */
function operationBytes(a: Artifacts, source: string, expression: string) {
  const selected = sourceRanges(a, source, expression);
  expect(selected.length).toBeGreaterThan(0);
  for (const range of selected) {
    expect(range.contextIndex).toBe(selected[0]!.contextIndex);
    expect(range.owner).toEqual(selected[0]!.owner);
    expect(profileRecord(range.machine).addressSpaceIndex).toBe(
      profileRecord(selected[0]!.machine).addressSpaceIndex,
    );
  }
  const unique = new Map(selected.map((r) => [Number(profileRecord(r.machine).start), r]));
  const ordered = [...unique.values()].sort(
    (x, y) => Number(profileRecord(x.machine).start) - Number(profileRecord(y.machine).start),
  );
  for (let i = 0; i < ordered.length; i++) {
    expect(ordered[i]!.contextIndex).toBe(ordered[0]!.contextIndex);
    expect(ordered[i]!.owner).toEqual(ordered[0]!.owner);
    if (i > 0)
      expect(profileRecord(ordered[i]!.machine).start).toBe(
        profileRecord(ordered[i - 1]!.machine).end,
      );
  }
  return Buffer.concat(ordered.map((r) => bytes(a, r)));
}

function bytes(a: Artifacts, range: Record<string, unknown>) {
  const machine = profileRecord(range.machine);
  const load = a.prg.readUInt16LE(0);
  return a.prg.subarray(Number(machine.start) - load + 2, Number(machine.end) - load + 2);
}

function address(a: Artifacts, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = a.labels.match(new RegExp(`^\\s*${escaped}\\s*=\\s*\\$([0-9a-f]+)`, "im"));
  expect(match).not.toBeNull();
  return parseInt(match![1]!, 16);
}

/** Executing variants end at the terminal call; masked firmware shells only chain. */
function noSuccessor(a: Artifacts, source: string, name: string, expression: string, raw?: number) {
  const f = profileRecords(a.debug.functions).find(
    (f) => f.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(f).toBeDefined();
  const ranges = profileRecords(a.debug.ranges);
  const calls = sourceRanges(a, source, expression).map((r) => profileRecord(r.machine));
  for (const variant of profileRecords(f!.entryVariants)) {
    if (raw !== undefined && address(a, String(variant.label)) !== raw) {
      const indexes = variant.rangeIndexes as number[];
      expect(indexes).toHaveLength(1);
      const code = bytes(a, ranges[indexes[0]!]!);
      expect(code).toHaveLength(3);
      expect(code[0]).toBe(0x6c);
      const link = code.readUInt16LE(1);
      expect(link & 255).toBeLessThanOrEqual(254);
      const capture = operationBytes(a, source, "setIRQ(&Q)");
      const restore = operationBytes(a, source, "restoreIRQ()");
      const firmware = address(a, String(variant.label));
      expect(
        capture.includes(
          Buffer.from([
            0xa9,
            firmware & 255,
            0x8d,
            0x14,
            0x03,
            0xa9,
            firmware >> 8,
            0x8d,
            0x15,
            0x03,
          ]),
        ),
      ).toBe(true);
      for (const [vector, home] of [
        [0x0314, link],
        [0x0315, link + 1],
      ]) {
        expect(
          capture.includes(
            Buffer.from([0xad, vector! & 255, vector! >> 8, 0x8d, home! & 255, home! >> 8]),
          ),
        ).toBe(true);
        expect(
          restore.includes(
            Buffer.from([0xad, home! & 255, home! >> 8, 0x8d, vector! & 255, vector! >> 8]),
          ),
        ).toBe(true);
      }
      continue;
    }
    const machine = (variant.rangeIndexes as number[]).map((index) =>
      profileRecord(ranges[index]!.machine),
    );
    const start = Math.min(...machine.map((r) => Number(r.start)));
    const end = Math.max(...machine.map((r) => Number(r.end)));
    const contained = calls.filter((r) => Number(r.start) >= start && Number(r.end) <= end);
    expect(contained.length).toBeGreaterThan(0);
    expect(Math.max(...contained.map((r) => Number(r.end)))).toBe(end);
  }
}

/** Check whole emitted H bodies too, so absent provenance cannot hide dead stores. */
function noDeadEffects(a: Artifacts) {
  const functions = profileRecords(a.debug.functions);
  const h = functions.find((f) => f.qualifiedName === "src/game.blend::Game.H");
  expect(h).toBeDefined();
  const ranges = profileRecords(a.debug.ranges);
  const code = (h!.rangeIndexes as number[]).map((index) => bytes(a, ranges[index]!));
  for (const target of [0x0318, 0x0319, 0xc014]) {
    expect(code.some((b) => b.includes(Buffer.from([0x8d, target & 255, target >> 8])))).toBe(
      false,
    );
  }
  expect(functions.some((f) => f.qualifiedName === "src/game.blend::Game.C")).toBe(false);
}

const prefix = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function C(): void {}
`;
const suffix = `interrupt function Q(): void { H(); }
function main(): void {
  setNMI(&B); asm_php(); asm_sei(); asm_nop();
  setIRQ(&Q); pokew($c010, word(&Q)); restoreIRQ(); asm_plp(); restoreNMI();
}`;

describe("retained nonreturning ordinary paths", () => {
  it.each(profiles)(
    "retains the terminal call and independent raw address while omitting its unreachable suffix on %s",
    async (profile) => {
      const source = `${prefix}
function terminal(): void { while (true) {} }
function H(): void { terminal(); setNMI(&C); restoreNMI(); poke($c014, 11); }
${suffix}`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        const functions = profileRecords(a.debug.functions);
        const terminal = functions.find((f) => f.qualifiedName === "src/game.blend::Game.terminal");
        expect(terminal).toBeDefined();
        const targets = profileRecords(terminal!.entryVariants).map((v) =>
          address(a, String(v.label)),
        );
        const calls = sourceRanges(a, source, "terminal();").map((r) => bytes(a, r));
        expect(
          calls.some((b) =>
            targets.some((target) => b.includes(Buffer.from([0x20, target & 255, target >> 8]))),
          ),
        ).toBe(true);
        expect(sourceRanges(a, source, "setNMI(&C)")).toHaveLength(0);
        expect(sourceRanges(a, source, "restoreNMI()")).toHaveLength(0);
        expect(sourceRanges(a, source, "poke($c014, 11)")).toHaveLength(0);
        noDeadEffects(a);
        const q = functions.find((f) => f.qualifiedName === "src/game.blend::Game.Q");
        expect(q).toBeDefined();
        const entries = profileRecords(q!.entryVariants).map((v) => address(a, String(v.label)));
        expect(new Set(entries).size).toBe(entries.length);
        const retained = operationBytes(a, source, "pokew($c010, word(&Q))");
        const raw = entries.filter((entry) =>
          retained.includes(
            Buffer.from([0xa9, entry & 255, 0x8d, 0x10, 0xc0, 0xa9, entry >> 8, 0x8d, 0x11, 0xc0]),
          ),
        );
        expect(raw).toHaveLength(1);
        expect(sourceRanges(a, source, "H();").length).toBeGreaterThan(0);
        noSuccessor(a, source, "H", "terminal();");
        noSuccessor(a, source, "Q", "H();", raw[0]!);
      });
    },
  );

  it.each(profiles)(
    "keeps reachable installs and effects after a returning helper on %s",
    async (profile) => {
      const source = `${prefix}
function terminal(): void { poke($c015, 4); }
function H(): void { terminal(); setNMI(&C); restoreNMI(); poke($c014, 11); }
${suffix}`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        for (const operation of ["terminal();", "setNMI(&C)", "restoreNMI()", "poke($c014, 11)"]) {
          expect(sourceRanges(a, source, operation).length).toBeGreaterThan(0);
        }
        expect(
          sourceRanges(a, source, "poke($c014, 11)").some((r) =>
            bytes(a, r).includes(Buffer.from([0x8d, 0x14, 0xc0])),
          ),
        ).toBe(true);
      });
    },
  );

  it.each(profiles)(
    "keeps the suffix when a finite call has a returning target on %s",
    async (profile) => {
      const source = `${prefix}
function terminal(): void { while (true) {} }
function returning(): void { poke($c015, 4); }
function H(): void {
  let target: fn(): void = peek($c012) != 0 ? &terminal : &returning;
  target(); setNMI(&C); restoreNMI(); poke($c014, 11);
}
${suffix}`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        for (const operation of ["target()", "setNMI(&C)", "restoreNMI()", "poke($c014, 11)"]) {
          expect(sourceRanges(a, source, operation).length).toBeGreaterThan(0);
        }
        expect(
          sourceRanges(a, source, "poke($c014, 11)").some((r) =>
            bytes(a, r).includes(Buffer.from([0x8d, 0x14, 0xc0])),
          ),
        ).toBe(true);
      });
    },
  );

  it.each(profiles)(
    "omits the suffix when every finite target is nonreturning on %s",
    async (profile) => {
      const source = `${prefix}
function terminal(): void { while (true) {} }
function anotherTerminal(): void { while (true) {} }
function H(): void {
  let target: fn(): void = peek($c012) != 0 ? &terminal : &anotherTerminal;
  target(); setNMI(&C); restoreNMI(); poke($c014, 11);
}
${suffix}`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        expect(sourceRanges(a, source, "target()").length).toBeGreaterThan(0);
        for (const operation of ["setNMI(&C)", "restoreNMI()", "poke($c014, 11)"]) {
          expect(sourceRanges(a, source, operation)).toHaveLength(0);
        }
        noDeadEffects(a);
      });
    },
  );
});
