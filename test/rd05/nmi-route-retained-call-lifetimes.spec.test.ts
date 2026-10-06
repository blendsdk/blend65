import { buildProject } from "@blend65/compiler";
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

// A retained caller's live byte must survive every selected helper call, while
// compatible observed helper bodies remain shared instead of acquiring extra frames.
const HELPERS = {
  direct: `function H(x: byte): void {
    let inside: byte = peek($c024);
    setNMI(&C);
    poke($c012, x);
    poke($c026, inside);
    restoreNMI();
  }`,
  transitive: `function G(x: byte): void {
    let inside: byte = peek($c024);
    setNMI(&C);
    poke($c012, x);
    poke($c026, inside);
    restoreNMI();
  }
  function H(x: byte): void {
    let held: byte = peek($c028);
    G(x);
    poke($c02a, held);
  }`,
  finite: `function H(x: byte): void {
    let inside: byte = peek($c024);
    setNMI(&C);
    poke($c012, x);
    poke($c026, inside);
    restoreNMI();
  }
  function J(x: byte): void {
    let inside: byte = peek($c02c);
    setNMI(&C);
    poke($c012, x);
    poke($c02e, inside);
    restoreNMI();
  }`,
};

/** Keep the caller read before its call and its observable use after the call. */
function fixture(kind: keyof typeof HELPERS): string {
  const call =
    kind === "finite"
      ? `let target: fn(byte): void = &H;
         if (peek($c021) != 0) { target = &J; }
         target(9);`
      : "H(9);";
  return `module Game;
  import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
  interrupt function B(): void {}
  interrupt function C(): void {}
  ${HELPERS[kind]}
  interrupt function Q(): void {
    let saved: byte = peek($c020);
    ${call}
    poke($c022, saved);
  }
  function main(): void {
    setNMI(&B);
    H(7);
    ${kind === "finite" ? "J(8);" : ""}
    asm_php(); asm_sei(); asm_nop();
    setIRQ(&Q);
    pokew($c000, word(&Q));
    restoreIRQ();
    asm_plp();
    restoreNMI();
  }`;
}

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { address: number; opcode: number; operand: number };

// Zero marks an illegal NMOS opcode. This table supplies boundaries only; no
// instruction is executed and no generated value is used as a behavior oracle.
const WIDTHS = new Map<number, number>();
[
  "00 08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8",
  "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6",
  "0d 0e 19 1d 1e 20 2c 2d 2e 39 3d 3e 4c 4d 4e 59 5d 5e 6c 6d 6e 79 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
].forEach((opcodes, index) => {
  for (const opcode of opcodes.split(" ")) WIDTHS.set(Number.parseInt(opcode, 16), index + 1);
});

/** Resolve a public entry label without relying on compiler identity spelling. */
function labelAddress(artifacts: Artifacts, label: string): number {
  const line = artifacts.labels.split("\n").find((candidate) => {
    const match = candidate.match(/^\s*(\S+)\s*=\s*\$([\da-f]+)/i);
    return match?.[1] === label;
  });
  const match = line?.match(/=\s*\$([\da-f]+)/i);
  if (!match) throw new Error(`Missing published entry label: ${label}`);
  return Number.parseInt(match[1]!, 16);
}

/** Read only instruction-aligned final ranges associated with this source function. */
function functionEvidence(artifacts: Artifacts, name: string) {
  const owner = `src/game.blend::Game.${name}`;
  const matches = profileRecords(artifacts.debug.functions).filter(
    (record) => record.qualifiedName === owner,
  );
  expect(matches, `one public source identity for ${name}`).toHaveLength(1);
  const record = matches[0]!;
  const entries = profileRecords(record.entryVariants).map((entry) => {
    expect(typeof entry.label).toBe("string");
    return labelAddress(artifacts, String(entry.label));
  });
  const ranges = profileRecords(artifacts.debug.ranges);
  if (!Array.isArray(record.rangeIndexes)) throw new Error("Missing function ranges");
  const selected = record.rangeIndexes.map((index) => {
    expect(typeof index).toBe("number");
    return profileRecord(ranges[Number(index)]);
  });
  const load = artifacts.prg.readUInt16LE(0);
  const instructions = new Map<number, Instruction>();
  for (const range of selected) {
    const machine = profileRecord(range.machine);
    expect(typeof machine.start).toBe("number");
    expect(typeof machine.end).toBe("number");
    for (let address = Number(machine.start); address < Number(machine.end); ) {
      const offset = address - load + 2;
      expect(offset).toBeGreaterThanOrEqual(2);
      const opcode = artifacts.prg[offset]!;
      const width = WIDTHS.get(opcode) ?? 0;
      expect(width, `legal opcode at ${address}`).toBeGreaterThan(0);
      expect(address + width).toBeLessThanOrEqual(Number(machine.end));
      const operand =
        width === 3
          ? artifacts.prg.readUInt16LE(offset + 1)
          : width === 2
            ? artifacts.prg[offset + 1]!
            : 0;
      instructions.set(address, { address, opcode, operand });
      address += width;
    }
  }
  return {
    owner,
    entries,
    ranges: selected,
    instructions: [...instructions.values()].sort((a, b) => a.address - b.address),
  };
}

/** Match a source declaration and require one shared byte home in its emitted bodies. */
function byteHome(
  artifacts: Artifacts,
  owner: string,
  name: string,
  instructions: readonly Instruction[],
  source: string,
): number {
  const functionStart = source.indexOf(`function ${owner.split(".").at(-1)}(`);
  const start = source.indexOf(`${name}: byte`, functionStart);
  expect(start).toBeGreaterThanOrEqual(0);
  const declaredByte = Buffer.byteLength(source.slice(0, start));
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((s) => s.path === "src/game.blend");
  const symbols = profileRecords(artifacts.debug.symbols);
  const candidates = new Set<number>();
  for (const location of profileRecords(artifacts.debug.locations)) {
    const symbol = symbols[Number(location.symbolIndex)];
    if (symbol?.scope !== owner || symbol.kind !== (name === "x" ? "parameter" : "local")) continue;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") continue;
    const span = profileRecord(origin.span);
    if (
      span.sourceIndex !== sourceIndex ||
      Number(span.startByte) > declaredByte ||
      Number(span.endByte) < declaredByte + Buffer.byteLength(name)
    )
      continue;
    const availability = profileRecord(location.availability);
    for (const piece of profileRecords(availability.pieces)) {
      if (piece.kind !== "memory") continue;
      const machine = profileRecord(piece.machine);
      expect(Number(machine.end) - Number(machine.start)).toBe(1);
      candidates.add(Number(machine.start));
    }
  }
  const accesses = instructions.filter(({ opcode }) =>
    [0xa5, 0xad, 0x85, 0x8d, 0xa6, 0xae, 0x86, 0x8e, 0xa4, 0xac, 0x84, 0x8c].includes(opcode),
  );
  const homes = [...candidates].filter((home) => accesses.some(({ operand }) => operand === home));
  expect(homes, `one emitted byte home for ${owner}.${name}`).toHaveLength(1);
  return homes[0]!;
}
/** Require final source correlation for the read and later use, separately from coloring. */
function sourceObservation(source: string, ranges: Record<string, unknown>[], proof: string) {
  const expected = profileSpan(source, proof);
  expect(
    ranges.some((range) => {
      const origin = profileRecord(range.origin);
      if (origin.kind !== "source") return false;
      const span = profileRecord(origin.span);
      return Number(span.startByte) < expected.end && Number(span.endByte) > expected.start;
    }),
    `emitted source observation: ${proof}`,
  ).toBe(true);
}

describe.each(PROFILES)("retained call lifetimes on %s", (profile) => {
  it.each(["direct", "transitive", "finite"] as const)(
    "should preserve caller bytes and reuse compatible helpers for %s calls",
    async (kind) => {
      const source = fixture(kind);
      await withProfileProject(source, profile, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("No final generation");
        const artifacts = await readProfileArtifacts(built);
        const caller = functionEvidence(artifacts, "Q");
        const main = functionEvidence(artifacts, "main");
        sourceObservation(source, caller.ranges, "peek($c020)");
        sourceObservation(source, caller.ranges, "poke($c022, saved)");
        const saved = byteHome(artifacts, caller.owner, "saved", caller.instructions, source);
        const reads = caller.instructions.filter(
          ({ opcode, operand }) => opcode === 0xad && operand === 0xc020,
        );
        const writes = caller.instructions.filter(
          ({ opcode, operand }) => opcode === 0x8d && operand === 0xc022,
        );
        expect(reads, "one volatile caller input read").toHaveLength(1);
        expect(writes, "one volatile caller output write").toHaveLength(1);
        const calls = caller.instructions.filter(({ opcode }) => opcode === 0x20);
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls.at(-1)!;
        expect(reads[0]!.address).toBeLessThan(lastCall.address);
        expect(lastCall.address).toBeLessThan(writes[0]!.address);
        expect(
          caller.instructions.some(
            ({ address, opcode, operand }) =>
              address > lastCall.address &&
              address < writes[0]!.address &&
              [0xa5, 0xad].includes(opcode) &&
              operand === saved,
          ),
          "reload the retained caller byte after the call",
        ).toBe(true);
        const helpers = kind === "transitive" ? ["H", "G"] : kind === "finite" ? ["H", "J"] : ["H"];
        for (const name of helpers) {
          const callee = functionEvidence(artifacts, name);
          expect(saved, `caller survives ${name}'s parameter store`).not.toBe(
            byteHome(artifacts, callee.owner, "x", callee.instructions, source),
          );
          expect(saved, `caller survives ${name}'s local store`).not.toBe(
            byteHome(
              artifacts,
              callee.owner,
              name === "H" && kind === "transitive" ? "held" : "inside",
              callee.instructions,
              source,
            ),
          );
          if (name === "H" || name === "J") {
            expect(
              main.instructions.some(
                ({ opcode, operand }) => opcode === 0x20 && callee.entries.includes(operand),
              ),
            ).toBe(true);
          }
          const parent = name === "G" ? functionEvidence(artifacts, "H") : caller;
          expect(
            parent.instructions.some(
              ({ opcode, operand }) => opcode === 0x20 && callee.entries.includes(operand),
            ),
          ).toBe(true);
        }
        if (kind === "transitive") {
          const h = functionEvidence(artifacts, "H");
          const g = functionEvidence(artifacts, "G");
          const held = byteHome(artifacts, h.owner, "held", h.instructions, source);
          for (const name of ["x", "inside"]) {
            expect(held, `transitive caller survives G.${name}`).not.toBe(
              byteHome(artifacts, g.owner, name, g.instructions, source),
            );
          }
        }
      });
    },
    30_000,
  );
});
