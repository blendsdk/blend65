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

// Retained bytes survive every helper call while compatible helper bodies keep shared storage.
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

/** One context's actual aligned instructions and its published variant entry. */
type EmittedBody = { entry: number; instructions: Map<number, Instruction> };

/** Instruction widths supply boundaries, not behavior expectations from generated values. */
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
  const functions = profileRecords(artifacts.debug.functions);
  const matches = functions.filter((record) => record.qualifiedName === owner);
  expect(matches, `one public source identity for ${name}`).toHaveLength(1);
  const record = matches[0]!;
  const variants = profileRecords(record.entryVariants);
  const entries = variants.map((entry) => {
    expect(typeof entry.label).toBe("string");
    return labelAddress(artifacts, String(entry.label));
  });
  const ranges = profileRecords(artifacts.debug.ranges);
  const contexts = profileRecords(artifacts.debug.contexts);
  const spaces = profileRecords(artifacts.debug.addressSpaces);
  if (!Array.isArray(record.rangeIndexes)) throw new Error("Missing function ranges");
  const selected = record.rangeIndexes.map((index) => {
    expect(typeof index).toBe("number");
    return profileRecord(ranges[Number(index)]);
  });
  const load = artifacts.prg.readUInt16LE(0);
  const instructions = new Map<number, Instruction>();
  const bodies = new Map<number, EmittedBody>();
  for (const range of selected) {
    const machine = profileRecord(range.machine);
    expect(range.owner).toMatchObject({
      kind: "function",
      functionIndex: functions.indexOf(record),
    });
    expect(Number.isInteger(range.contextIndex)).toBe(true);
    const context = profileRecord(contexts[Number(range.contextIndex)]);
    expect(context).toMatchObject({ kind: "entry", functionIndex: functions.indexOf(record) });
    expect(Number.isInteger(context.entryVariantIndex)).toBe(true);
    expect(variants[Number(context.entryVariantIndex)]).toBeDefined();
    expect(variants[Number(context.entryVariantIndex)]!.rangeIndexes).toContain(
      ranges.indexOf(range),
    );
    const contextIndex = Number(range.contextIndex);
    const body = bodies.get(contextIndex) ?? {
      entry: entries[Number(context.entryVariantIndex)]!,
      instructions: new Map<number, Instruction>(),
    };
    bodies.set(contextIndex, body);
    expect(Number.isInteger(machine.addressSpaceIndex)).toBe(true);
    expect(spaces[Number(machine.addressSpaceIndex)]).toMatchObject({
      id: "cpu16",
      kind: "cpu",
      sizeBytes: 65536,
      banks: [],
    });
    expect(typeof machine.start).toBe("number");
    expect(typeof machine.end).toBe("number");
    expect(Number.isInteger(machine.start)).toBe(true);
    expect(Number.isInteger(machine.end)).toBe(true);
    expect(Number(machine.start)).toBeGreaterThanOrEqual(0);
    expect(Number(machine.end)).toBeGreaterThan(Number(machine.start));
    expect(Number(machine.end)).toBeLessThanOrEqual(65536);
    for (let address = Number(machine.start); address < Number(machine.end); ) {
      const offset = address - load + 2;
      expect(offset).toBeGreaterThanOrEqual(2);
      const opcode = artifacts.prg[offset]!;
      const width = WIDTHS.get(opcode) ?? 0;
      expect(width, `legal opcode at ${address}`).toBeGreaterThan(0);
      expect(address + width).toBeLessThanOrEqual(Number(machine.end));
      expect(offset + width).toBeLessThanOrEqual(artifacts.prg.length);
      const operand =
        width === 3
          ? artifacts.prg.readUInt16LE(offset + 1)
          : width === 2
            ? artifacts.prg[offset + 1]!
            : 0;
      const decoded = { address, opcode, operand };
      const instruction = instructions.get(address) ?? decoded;
      expect(instruction).toEqual(decoded);
      instructions.set(address, instruction);
      body.instructions.set(address, instruction);
      address += width;
    }
  }
  for (const entry of entries) {
    const matches = [...bodies.values()].filter((body) => body.entry === entry);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.instructions.has(entry)).toBe(true);
  }
  const retained = retainedEntries(bodies, [...instructions.values()]);
  return {
    owner,
    entries: retained,
    bodies,
    sourceInstructions: [...bodies.values()]
      .filter((body) => retained.includes(body.entry))
      .flatMap((body) => [...body.instructions.values()]),
    ranges: selected,
    instructions: [...instructions.values()].sort((a, b) => a.address - b.address),
  };
}

/** Bind every retained call to the context owning the volatile capture, not a forwarding adapter. */
function retainedEntries(
  bodies: ReadonlyMap<number, EmittedBody>,
  instructions: readonly Instruction[],
): number[] {
  const variants = [...bodies.values()];
  const reads = instructions.filter(({ opcode, operand }) => opcode === 0xad && operand === 0xc020);
  if (reads.length === 0) return variants.map((body) => body.entry);
  expect(reads).toHaveLength(1);
  const owners = variants.filter((body) => body.instructions.has(reads[0]!.address));
  expect(owners).toHaveLength(1);
  for (const call of instructions.filter(({ opcode }) => opcode === 0x20)) {
    const matches = variants.filter((body) => body.instructions.has(call.address));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(owners[0]);
  }
  return [owners[0]!.entry];
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
    expect(availability.kind).toBe("available");
    for (const piece of profileRecords(availability.pieces)) {
      if (piece.kind !== "memory") continue;
      const machine = profileRecord(piece.machine);
      expect(Number.isInteger(machine.addressSpaceIndex)).toBe(true);
      expect(
        profileRecords(artifacts.debug.addressSpaces)[Number(machine.addressSpaceIndex)],
      ).toMatchObject({ id: "cpu16", kind: "cpu", sizeBytes: 65536, banks: [] });
      expect(typeof machine.start).toBe("number");
      expect(Number.isInteger(machine.start)).toBe(true);
      expect(Number(machine.end) - Number(machine.start)).toBe(1);
      expect(piece.byteLength).toBe(1);
      expect(piece.valueOffset).toBe(0);
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

/** These instructions leave A unchanged; control transfers are checked separately. */
const PRESERVES_A = new Set([
  0x08, 0x18, 0x24, 0x28, 0x2c, 0x38, 0x48, 0x58, 0x78, 0x84, 0x85, 0x86, 0x88, 0x8c, 0x8d, 0x8e,
  0x9a, 0xa0, 0xa2, 0xa4, 0xa6, 0xa8, 0xaa, 0xac, 0xae, 0xb4, 0xb6, 0xb8, 0xba, 0xbc, 0xbe, 0xc0,
  0xc1, 0xc4, 0xc5, 0xc8, 0xc9, 0xca, 0xcc, 0xcd, 0xd1, 0xd5, 0xd8, 0xd9, 0xdd, 0xe0, 0xe4, 0xe8,
  0xea, 0xec, 0xf8,
]);

/** Unresolved writes cannot prove that the saved byte remains intact. */
const UNRESOLVED_WRITES = new Set([
  0x06, 0x0e, 0x16, 0x1e, 0x26, 0x2e, 0x36, 0x3e, 0x46, 0x4e, 0x56, 0x5e, 0x66, 0x6e, 0x76, 0x7e,
  0x81, 0x91, 0x94, 0x95, 0x96, 0x99, 0x9d, 0xc6, 0xce, 0xd6, 0xde, 0xe6, 0xee, 0xf6, 0xfe,
]);

/** Branches, indirect transfers, calls and returns are not straight continuations. */
const UNSUPPORTED_TRANSFERS = new Set([
  0x00, 0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x6c, 0x70, 0x90, 0xb0, 0xd0, 0xf0,
]);

/** Reject duplicate or overlapping instruction boundaries before following a path. */
function instructionMap(instructions: readonly Instruction[]): Map<number, Instruction> {
  const result = new Map<number, Instruction>();
  const occupied = new Set<number>();
  for (const instruction of instructions) {
    const width = WIDTHS.get(instruction.opcode);
    if (width === undefined) throw new Error("Illegal instruction in published ranges");
    for (let offset = 0; offset < width; offset += 1) {
      const address = instruction.address + offset;
      if (occupied.has(address)) throw new Error("Overlapping instruction boundaries");
      occupied.add(address);
    }
    result.set(instruction.address, instruction);
  }
  return result;
}

/** Follow direct byte copies from the volatile input into its retained source home. */
function requireCapture(
  instructions: readonly Instruction[],
  read: Instruction,
  saved: number,
): Instruction {
  const byAddress = instructionMap(instructions);
  const visited = new Set<number>();
  const copies = new Set<number>();
  let originalInA = true;
  let pc = read.address + 3;
  while (!visited.has(pc)) {
    visited.add(pc);
    const instruction = byAddress.get(pc);
    if (!instruction) throw new Error("Missing aligned input-capture instruction");
    const { opcode, operand } = instruction;
    if (opcode === 0x4c) {
      pc = operand;
      continue;
    }
    if (UNSUPPORTED_TRANSFERS.has(opcode) || UNRESOLVED_WRITES.has(opcode)) {
      throw new Error("Unsupported transfer before input capture");
    }
    if ([0x85, 0x8d].includes(opcode)) {
      if (operand === saved) {
        if (!originalInA) throw new Error("Input changed before reaching its saved home");
        return instruction;
      }
      if (originalInA) copies.add(operand);
      else copies.delete(operand);
    } else if ([0x84, 0x86, 0x8c, 0x8e].includes(opcode)) {
      copies.delete(operand);
    } else if ([0xa5, 0xad].includes(opcode)) {
      originalInA = copies.has(operand);
    } else if (!PRESERVES_A.has(opcode)) {
      originalInA = false;
    }
    pc += WIDTHS.get(opcode)!;
  }
  throw new Error("Cycle before input capture");
}

/** Follow actual return paths; physical PC order and unreachable reloads are not proof. */
function requireContinuation(
  instructions: readonly Instruction[],
  call: Instruction,
  saved: number,
  output: Instruction,
): void {
  const byAddress = instructionMap(instructions);
  if (call.opcode !== 0x20 || byAddress.get(call.address) !== call) {
    throw new Error("Expected the actual selected JSR");
  }
  const visited = new Set<number>();
  let reloaded = false;
  let pc = call.address + 3;
  while (!visited.has(pc)) {
    visited.add(pc);
    const instruction = byAddress.get(pc);
    if (!instruction) throw new Error("Missing or misaligned continuation target");
    const { opcode, operand } = instruction;
    if (instruction === output) {
      if (opcode !== 0x8d || operand !== 0xc022 || !reloaded) {
        throw new Error("Output did not receive the retained caller byte");
      }
      return;
    }
    if (opcode === 0x4c) {
      pc = operand;
      continue;
    }
    if (UNSUPPORTED_TRANSFERS.has(opcode)) throw new Error("Unsupported continuation transfer");
    if (UNRESOLVED_WRITES.has(opcode)) throw new Error("Unresolved continuation memory write");
    if ([0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(opcode) && operand === saved) {
      throw new Error("Saved caller home overwritten after the call");
    }
    if ([0xa5, 0xad].includes(opcode) && operand === saved) {
      reloaded = true;
    } else if (reloaded && !PRESERVES_A.has(opcode)) {
      throw new Error("Accumulator changed after the saved-home reload");
    }
    pc += WIDTHS.get(opcode)!;
  }
  throw new Error("Revisited continuation instruction");
}

/** Protect the captured byte through argument staging, prefix re-entry and every call. */
function requireRetainedCaller(
  instructions: readonly Instruction[],
  entries: readonly number[],
  read: Instruction,
  saved: number,
  output: Instruction,
): void {
  const privateRam =
    Number.isInteger(saved) &&
    ((saved >= 0x02 && saved <= 0x8f) ||
      (saved >= 0x0801 && saved <= 0x9fff) ||
      (saved >= 0xc000 && saved <= 0xcfff));
  if (!privateRam) {
    throw new Error("Retained caller home must be private RAM outside the hardware stack");
  }
  const byAddress = instructionMap(instructions);
  expect(byAddress.get(read.address)).toBe(read);
  expect(read).toMatchObject({ opcode: 0xad, operand: 0xc020 });
  const capture = requireCapture(instructions, read, saved);
  const writes = instructions.filter(
    ({ opcode, operand }) =>
      [0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(opcode) && operand === saved,
  );
  expect(writes, "Only the proved input capture may write the retained caller home").toHaveLength(
    1,
  );
  expect(writes[0]).toBe(capture);
  if (instructions.some(({ opcode }) => UNRESOLVED_WRITES.has(opcode))) {
    throw new Error("Unresolved caller memory write");
  }
  expect(entries.length).toBeGreaterThan(0);
  const prefix = new Set<number>();
  for (const entry of entries) {
    let pc = entry;
    let sawRead = false;
    const visited = new Set<number>();
    while (true) {
      if (visited.has(pc)) throw new Error("Cycle before retained input capture");
      visited.add(pc);
      const instruction = byAddress.get(pc);
      if (!instruction) throw new Error("Missing aligned caller-entry instruction");
      const width = WIDTHS.get(instruction.opcode)!;
      // Include operands so a call into the middle of a prefix instruction is rejected too.
      for (let byte = pc; byte < pc + width; byte += 1) prefix.add(byte);
      if (instruction === capture) {
        if (!sawRead) throw new Error("Caller entry bypasses the volatile input");
        break;
      }
      if (instruction === read) sawRead = true;
      if (instruction.opcode === 0x4c) pc = instruction.operand;
      else {
        if (UNSUPPORTED_TRANSFERS.has(instruction.opcode)) {
          throw new Error("Caller entry can transfer before retained input capture");
        }
        pc += width;
      }
    }
  }
  for (const { address, opcode, operand } of instructions) {
    if ([0x00, 0x6c].includes(opcode) || (opcode === 0x20 && prefix.has(operand)))
      throw new Error("Unsupported caller transfer");
    if (prefix.has(address) || [0x20, 0x40, 0x60].includes(opcode)) continue;
    const next = address + WIDTHS.get(opcode)!;
    const targets = opcode === 0x4c ? [operand] : [next];
    // All NMOS conditional branches have low opcode bits $10 and a signed byte offset.
    if ((opcode & 0x1f) === 0x10) targets.push(next + (operand < 0x80 ? operand : operand - 0x100));
    for (const target of targets) {
      if (!byAddress.has(target) || prefix.has(target))
        throw new Error("Unproved retained-prefix control edge");
    }
  }
  const calls = instructions.filter(({ opcode }) => opcode === 0x20);
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) requireContinuation(instructions, call, saved, output);
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
        const { sourceInstructions, entries } = caller;
        requireRetainedCaller(sourceInstructions, entries, reads[0]!, saved, writes[0]!);
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

/** Decode small synthetic byte tables without executing any instruction. */
function fixtureCode(start: number, hex: string): Instruction[] {
  const bytes = hex.split(" ").map((byte) => Number.parseInt(byte, 16));
  const instructions: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const width = WIDTHS.get(opcode);
    if (!width || offset + width > bytes.length) throw new Error("Invalid synthetic instruction");
    let operand = width > 1 ? bytes[offset + 1]! : 0;
    if (width === 3) operand |= bytes[offset + 2]! << 8;
    instructions.push({ address: start + offset, opcode, operand });
    offset += width;
  }
  return instructions;
}

/** Small instruction inputs qualify only the observer, not the compiler. */
function continuationFixture(backward = false): Instruction[] {
  return backward
    ? fixtureCode(0x1000, "20 00 40 4c 00 09").concat(fixtureCode(0x0900, "a5 40 8d 22 c0"))
    : fixtureCode(0x1000, "20 00 40 a5 40 8d 22 c0");
}

/** Qualify every arm against the same unique output, including broken later arms. */
function verifyContinuations(instructions: Instruction[]): void {
  const calls = instructions.filter(({ opcode }) => opcode === 0x20);
  const outputs = instructions.filter(
    ({ opcode, operand }) => opcode === 0x8d && operand === 0xc022,
  );
  expect(calls.length).toBeGreaterThan(0);
  expect(outputs).toHaveLength(1);
  for (const call of calls) requireContinuation(instructions, call, 0x40, outputs[0]!);
}

describe("retained-call continuation observer", () => {
  it("rejects argument marshalling that overwrites the captured caller byte before JSR", () => {
    const homes = { saved: 0x40, parameter: 0x41 };
    const hex = "ad 20 c0 85 40 a9 09 85 41 20 00 40 a5 40 8d 22 c0 40";
    const instructions = fixtureCode(0x0800, hex);
    const read = instructions[0]!;
    const marshal = instructions[3]!;
    const observe = () => {
      expect(homes.parameter).not.toBe(homes.saved);
      requireRetainedCaller(instructions, [read.address], read, homes.saved, instructions.at(-2)!);
    };
    expect(observe).not.toThrow();
    const body = { entry: read.address, instructions: instructionMap(instructions) };
    const contexts = new Map<number, EmittedBody>([[0, body]]);
    expect(retainedEntries(contexts, instructions)).toEqual([read.address]);
    const call = instructions[4]!;
    body.instructions.delete(call.address);
    contexts.set(1, { entry: call.address, instructions: instructionMap([call]) });
    expect(() => retainedEntries(contexts, instructions)).toThrow();
    // Declared homes stay distinct; only the actual marshal destination changes.
    marshal.operand = homes.saved;
    expect(observe).toThrow();
  });

  it("rejects re-entering the proved capture after replacing the sampled value", () => {
    const hex = "a2 01 ad 20 c0 85 40 ca 30 05 a9 09 4c 05 08 20 00 40 a5 40 8d 22 c0 40";
    const instructions = fixtureCode(0x0800, hex);
    const body = { entry: 0x0800, instructions: instructionMap(instructions) };
    const entries = retainedEntries(new Map([[0, body]]), instructions);
    expect(() =>
      requireRetainedCaller(instructions, entries, instructions[1]!, 0x40, instructions.at(-2)!),
    ).toThrow();
  });

  it("rejects an unresolved argument write that could alias the captured byte", () => {
    const instructions = fixtureCode(0x0ff7, "ad 20 c0 85 40 a9 09 91 42 20 00 40 a5 40 8d 22 c0");
    expect(() =>
      requireRetainedCaller(instructions, [0x0ff7], instructions[0]!, 0x40, instructions.at(-1)!),
    ).toThrow("Unresolved caller memory write");
  });

  it("rejects a published caller entry that bypasses the input capture", () => {
    const instructions = fixtureCode(0x0ffb, "ad 20 c0 85 40 20 00 40 a5 40 8d 22 c0");
    expect(() =>
      requireRetainedCaller(instructions, [0x1000], instructions[0]!, 0x40, instructions.at(-1)!),
    ).toThrow("Caller entry can transfer before retained input capture");
  });

  it("accepts input capture through an intermediate byte home", () => {
    const instructions = fixtureCode(0x0800, "ad 20 c0 85 41 a5 41 85 40");
    expect(() => requireCapture(instructions, instructions[0]!, 0x40)).not.toThrow();
  });

  it.each([false, true])("accepts a real continuation with backward jump=%s", (backward) => {
    expect(() => verifyContinuations(continuationFixture(backward))).not.toThrow();
  });

  it("rejects one broken arm even when another arm is correct", () => {
    const code = continuationFixture(true).concat(fixtureCode(0x2000, "20 00 50 4c 02 09"));
    expect(() => verifyContinuations(code)).toThrow(
      "Output did not receive the retained caller byte",
    );
  });

  it("rejects a wrong-home reload despite an unreachable correct decoy", () => {
    const instructions = continuationFixture();
    instructions[1]!.operand = 0x41;
    instructions.push({ address: 0x0800, opcode: 0xa5, operand: 0x40 });
    expect(() => verifyContinuations(instructions)).toThrow(
      "Output did not receive the retained caller byte",
    );
  });

  it("rejects an accumulator clobber after the correct reload", () => {
    const instructions = continuationFixture();
    instructions[2]!.address = 0x1007;
    instructions.push({ address: 0x1005, opcode: 0xa9, operand: 0 });
    expect(() => verifyContinuations(instructions)).toThrow(
      "Accumulator changed after the saved-home reload",
    );
  });

  it.each([
    ["jump straight to output", 0x4c, 0x1005, "Output did not receive the retained caller byte"],
    ["missing target", 0x4c, 0x3000, "Missing or misaligned continuation target"],
    ["misaligned target", 0x4c, 0x1004, "Missing or misaligned continuation target"],
    ["cycle", 0x4c, 0x1003, "Revisited continuation instruction"],
    ["indirect transfer", 0x6c, 0x3000, "Unsupported continuation transfer"],
    ["unexpected return", 0x60, 0, "Unsupported continuation transfer"],
    ["unexpected call", 0x20, 0x4000, "Unsupported continuation transfer"],
    ["saved-home overwrite", 0x85, 0x40, "Saved caller home overwritten after the call"],
  ] as const)("rejects %s", (_name, opcode, operand, message) => {
    const instructions = continuationFixture();
    instructions[1] = { address: 0x1003, opcode, operand };
    instructions[2]!.address = 0x1003 + WIDTHS.get(opcode)!;
    if (_name === "jump straight to output") instructions[1]!.operand = instructions[2]!.address;
    expect(() => verifyContinuations(instructions)).toThrow(message);
  });
});
