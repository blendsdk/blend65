import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
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
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { opcode: string; operand: string; forcedBytes?: number };
type Access = { direction: "read" | "write"; address: number; value: number };

const handler = `interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  if ((pending & c64.cia1.sourceTimerA) != 0) { poke($0401, 1); }
  if ((pending & c64.cia1.sourceTimerB) != 0) { poke($0402, 1); }
}`;
const timerUse = `c64.cia1.writeTimerALatch($1234);
  c64.cia1.configureTimerA(c64.cia1.timerLoad | c64.cia1.timerStart);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);`;
const entry = `asm_php(); asm_sei();
  asm_nop(); c64.system.setIRQExclusive(&onIRQ); asm_nop();
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let pending: byte = c64.cia1.readAndClearPendingSources();
  poke($0400, pending);
  asm_plp();`;

/** Build a real project and retain only its independently inspectable published artifacts. */
async function build(source: string, target: string): Promise<Artifacts> {
  return withProfileProject(source, target, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete CIA1 output build");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory).toMatchObject({ profileId: target, acmeReconciled: true });
    return artifacts;
  });
}

/** Retain instruction order and explicit address-size overrides, ignoring only comments. */
function instructions(assembly: string): Instruction[] {
  return assembly.split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([a-z]{3})\b\s*(.*?)\s*$/iu.exec(line.split(";")[0]!);
    if (match === null) return [];
    const override = /^\+([12])\s+/u.exec(match[2]!);
    return [
      {
        opcode: match[1]!.toLowerCase(),
        operand: match[2]!.replace(/^\+[12]\s+/u, "").toLowerCase(),
        ...(override === null ? {} : { forcedBytes: Number(override[1]) }),
      },
    ];
  });
}

/** Resolve arbitrary emitted symbol spellings from the actual ACME symbol report. */
function symbols(artifacts: Artifacts): Map<string, number> {
  return new Map(
    [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!.toLowerCase(),
      Number.parseInt(match[2]!, 16),
    ]),
  );
}

/** Resolve a direct numeric or relocated byte address without guessing a private label. */
function address(operand: string, labels: ReadonlyMap<string, number>): number {
  const expression = operand.replace(/\s/gu, "");
  if (/^\$[0-9a-f]+$/u.test(expression)) return Number.parseInt(expression.slice(1), 16);
  if (/^[0-9]+$/u.test(expression)) return Number(expression);
  const match = /^([a-z_][a-z_0-9]*)(?:\+(\$[0-9a-f]+|[0-9]+))?$/u.exec(expression);
  const base = match === null ? undefined : labels.get(match[1]!);
  if (base === undefined) throw new Error(`Unresolved direct operand: ${operand}`);
  return base + (match?.[2] === undefined ? 0 : address(match[2], labels));
}

/** Select one public source-function entry, stopping at its ordinary or firmware terminal. */
function body(artifacts: Artifacts, name: string): Instruction[] {
  const functions = profileRecords(artifacts.debug.functions).filter(
    ({ qualifiedName }) => qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functions, name).toHaveLength(1);
  const variants = profileRecords(functions[0]!.entryVariants);
  expect(variants).toHaveLength(1);
  const label = variants[0]!.label;
  if (typeof label !== "string") throw new Error(`Missing published entry for ${name}`);
  const lines = artifacts.assembly.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `${label}:`);
  expect(start, label).toBeGreaterThanOrEqual(0);
  const end = lines.findIndex(
    (line, index) =>
      index > start && /^\s*(?:rts|jmp\s+(?:\$ea81|\([^)]*\)))\s*(?:;.*)?$/iu.test(line),
  );
  expect(end, `Missing terminal for ${name}`).toBeGreaterThan(start);
  return instructions(lines.slice(start + 1, end + 1).join("\n"));
}

/** Source NOP pairs delimit only the explicit transactions, excluding setup and epilogue. */
function transactions(artifacts: Artifacts, count: number): Instruction[][] {
  const code = body(artifacts, "main");
  const markers = code.flatMap(({ opcode }, index) => (opcode === "nop" ? [index] : []));
  expect(markers).toHaveLength(count * 2);
  return Array.from({ length: count }, (_, index) =>
    code.slice(markers[index * 2]! + 1, markers[index * 2 + 1]!),
  );
}

/** Identify the two captured predecessor bytes by their source vector reads and next stores. */
function savedLink(install: readonly Instruction[], labels: ReadonlyMap<string, number>): number[] {
  return [0x0314, 0x0315].map((vector) => {
    const read = install.findIndex(
      ({ opcode, operand }) =>
        /^ld[axy]$/u.test(opcode) &&
        !operand.startsWith("#") &&
        address(operand, labels) === vector,
    );
    expect(read).toBeGreaterThanOrEqual(0);
    const register = install[read]!.opcode.at(-1);
    const store = install.slice(read + 1).find(({ opcode }) => opcode === `st${register}`);
    expect(store).toBeDefined();
    if (store === undefined) throw new Error("Missing captured predecessor byte");
    return address(store.operand, labels);
  });
}

/** Recount direct NMOS forms; a branch, call, or unaccounted operation cannot hide its cost. */
function cost(code: readonly Instruction[], labels: ReadonlyMap<string, number>) {
  const implied = new Map([
    ["php", 3],
    ["pha", 3],
    ["sei", 2],
    ["pla", 4],
    ["plp", 4],
    ["cld", 2],
    ["tax", 2],
    ["tay", 2],
    ["txa", 2],
    ["tya", 2],
  ]);
  return code.reduce(
    (total, instruction) => {
      const fixed = implied.get(instruction.opcode);
      let bytes: number;
      let cycles: number;
      if (fixed !== undefined) {
        bytes = 1;
        cycles = fixed;
      } else if (/^(?:ld[axy]|st[axy]|and|ora)$/u.test(instruction.opcode)) {
        if (instruction.operand.startsWith("#")) {
          bytes = 2;
          cycles = 2;
        } else {
          const zeroPage =
            instruction.forcedBytes === 1 ||
            (instruction.forcedBytes !== 2 && address(instruction.operand, labels) <= 0xff);
          bytes = zeroPage ? 2 : 3;
          cycles = zeroPage ? 3 : 4;
        }
      } else if (instruction.opcode === "jmp") {
        bytes = 3;
        cycles = instruction.operand.startsWith("(") ? 5 : 3;
      } else throw new Error(`Unaccounted NMOS cost: ${instruction.opcode} ${instruction.operand}`);
      return { bytes: total.bytes + bytes, cycles: total.cycles + cycles };
    },
    { bytes: 0, cycles: 0 },
  );
}

/** Evaluate the small straight-line restore protocol, recording every direct memory effect. */
function accesses(
  code: readonly Instruction[],
  labels: ReadonlyMap<string, number>,
  initialCRA: number,
  link: readonly number[],
  saved = [0x57, 0xa6],
): Access[] {
  const memory = new Map([
    [0xdc0e, initialCRA],
    [0xdc0d, 0x83],
    [link[0]!, saved[0]!],
    [link[1]!, saved[1]!],
  ]);
  const registers = new Map<string, number>([
    ["x", 0x36],
    ["y", 0x92],
  ]);
  const trace: Access[] = [];
  for (const { opcode, operand } of code) {
    if (["php", "pha", "sei", "pla", "plp"].includes(opcode)) continue;
    if (["tax", "tay", "txa", "tya"].includes(opcode)) {
      const value = registers.get(opcode[1]!);
      if (value === undefined) throw new Error("Unproved register transfer");
      registers.set(opcode[2]!, value);
      continue;
    }
    if (/^ld[axy]$/u.test(opcode)) {
      let value: number;
      if (operand.startsWith("#")) value = address(operand.slice(1), labels);
      else {
        const location = address(operand, labels);
        const loaded = memory.get(location);
        if (loaded === undefined) throw new Error(`Unproved restore read at ${operand}`);
        value = loaded;
        trace.push({ direction: "read", address: location, value });
      }
      registers.set(opcode[2]!, value);
    } else if (opcode === "and" || opcode === "ora") {
      const accumulator = registers.get("a");
      if (accumulator === undefined || !operand.startsWith("#"))
        throw new Error("Unproved mask input");
      const mask = address(operand.slice(1), labels);
      registers.set("a", opcode === "and" ? accumulator & mask : accumulator | mask);
    } else if (/^st[axy]$/u.test(opcode)) {
      const value = registers.get(opcode[2]!);
      if (value === undefined) throw new Error("Unproved restore store");
      const location = address(operand, labels);
      trace.push({ direction: "write", address: location, value });
      // ICR writes change its write-only mask, never the pending byte subsequently read.
      if (location !== 0xdc0d) memory.set(location, value);
    } else throw new Error(`Unexpected restore operation: ${opcode} ${operand}`);
  }
  expect(registers.get("x")).toBe(0x36);
  expect(registers.get("y")).toBe(0x92);
  return trace;
}

/** Check semantics and access order independently of which register loads carry constants. */
function expectHandback(
  code: readonly Instruction[],
  labels: ReadonlyMap<string, number>,
  link: readonly number[],
  target: string,
) {
  expect(code.slice(0, 3).map(({ opcode }) => opcode)).toEqual(["php", "pha", "sei"]);
  expect(code.slice(-2).map(({ opcode }) => opcode)).toEqual(["pla", "plp"]);
  expect(code.filter(({ opcode }) => opcode === "jsr" || /^b[a-z]{2}$/u.test(opcode))).toEqual([]);
  const reload = target.includes("-pal-") ? [0x25, 0x40] : [0x95, 0x42];
  for (const saved of [
    [0x57, 0xa6],
    [0xff, 0x00],
  ]) {
    for (let initialCRA = 0; initialCRA <= 0xff; initialCRA += 1) {
      const trace = accesses(code, labels, initialCRA, link, saved);
      expect(trace.filter(({ address }) => !link.includes(address))).toEqual([
        { direction: "write", address: 0xdc0d, value: 0x1f },
        { direction: "read", address: 0xdc0e, value: initialCRA },
        { direction: "write", address: 0xdc0e, value: initialCRA & 0x80 },
        { direction: "write", address: 0xdc0f, value: 0x08 },
        { direction: "read", address: 0xdc0d, value: 0x83 },
        { direction: "write", address: 0xdc04, value: reload[0] },
        { direction: "write", address: 0xdc05, value: reload[1] },
        { direction: "write", address: 0x0314, value: saved[0] },
        { direction: "write", address: 0x0315, value: saved[1] },
        { direction: "write", address: 0xdc0d, value: 0x81 },
        { direction: "read", address: 0xdc0e, value: initialCRA & 0x80 },
        { direction: "write", address: 0xdc0e, value: (initialCRA & 0x80) | 0x11 },
      ]);
      expect(trace.filter(({ address }) => link.includes(address))).toEqual([
        { direction: "read", address: link[0], value: saved[0] },
        { direction: "read", address: link[1], value: saved[1] },
      ]);
    }
  }
  const measured = cost(code, labels);
  expect(measured.bytes).toBeLessThanOrEqual(61);
  expect(measured.cycles).toBeLessThanOrEqual(86);
}

/** Fixture bodies retain complete masked entry and source-owned IRQ acknowledgement. */
function source(body: string, declarations = handler): string {
  return `module Game;
${declarations}
function main(): void {
  ${body}
}`;
}

describe.each(profiles)("CIA1 final-release output on %s", (target) => {
  // All device writes and consuming reads must follow the stock-service transaction exactly.
  it("should emit the ordered stock handback after typed Timer A use", async () => {
    const artifacts = await build(
      source(`${entry}\n  ${timerUse}
  asm_nop(); c64.system.restoreIRQ(); asm_nop();`),
      target,
    );
    const [install, restore] = transactions(artifacts, 2);
    const labels = symbols(artifacts);
    expectHandback(restore!, labels, savedLink(install!, labels), target);
  }, 60_000);

  // Skipping the prior KERNAL handler incurs handback even without source configuration writes.
  it.each(["no typed write", "counter-only work"])(
    "should emit one handback for an exclusive route with %s",
    async (scenario) => {
      const observe =
        scenario === "counter-only work" ? "pokew($0406, c64.cia1.readTimerACounter());" : "";
      const artifacts = await build(
        source(
          `asm_php(); asm_sei();
  asm_nop(); c64.system.setIRQExclusive(&onIRQ); asm_nop();
  ${observe}
  asm_nop(); c64.system.restoreIRQ(); asm_nop();
  asm_plp();`,
          "interrupt function onIRQ(): void {}",
        ),
        target,
      );
      const [install, restore] = transactions(artifacts, 2);
      const labels = symbols(artifacts);
      expectHandback(restore!, labels, savedLink(install!, labels), target);
    },
    60_000,
  );
});

describe("CIA1 output boundaries and resources", () => {
  // Observation without an exclusive lease and plain chaining acquire no stock reset.
  it.each(["observation only", "plain chain"])(
    "should emit no handback for %s",
    async (scenario) => {
      const main =
        scenario === "plain chain"
          ? "asm_nop(); c64.system.setIRQ(&onIRQ); asm_nop(); c64.system.restoreIRQ(); asm_nop();"
          : "asm_nop(); pokew($0406, c64.cia1.readTimerACounter()); asm_nop();";
      const artifacts = await build(
        source(main, "interrupt function onIRQ(): void {}"),
        profiles[0],
      );
      const code = body(artifacts, "main");
      const writes = code.filter(
        ({ opcode, operand }) => /^st[axy]$/u.test(opcode) && /^\$0*dc/iu.test(operand),
      );
      expect(writes).toEqual([]);
      expect(code.filter(({ operand }) => operand === "$dc0d")).toEqual([]);
    },
    60_000,
  );

  // A clean temporary successor restores only its vector; the final outer release owns handback.
  it("should keep clean inner restore vector-only with exact LIFO predecessor links", async () => {
    const declarations = `${handler}\n${handler.replace("onIRQ", "otherIRQ")}`;
    const artifacts = await build(
      source(
        `${entry}\n  ${timerUse}
  asm_nop(); c64.system.setIRQExclusive(&otherIRQ); asm_nop();
  asm_nop(); c64.system.restoreIRQ(); asm_nop();
  asm_nop(); c64.system.restoreIRQ(); asm_nop();`,
        declarations,
      ),
      profiles[0],
    );
    const [outerInstall, innerInstall, innerRestore, outerRestore] = transactions(artifacts, 4);
    const labels = symbols(artifacts);
    const outerLink = savedLink(outerInstall!, labels);
    const innerLink = savedLink(innerInstall!, labels);
    expect(new Set([...outerLink, ...innerLink]).size).toBe(4);
    const innerTrace = accesses(innerRestore!, labels, 0xff, innerLink);
    expect(innerTrace).toEqual([
      { direction: "read", address: innerLink[0], value: 0x57 },
      { direction: "write", address: 0x0314, value: 0x57 },
      { direction: "read", address: innerLink[1], value: 0xa6 },
      { direction: "write", address: 0x0315, value: 0xa6 },
    ]);
    expectHandback(outerRestore!, labels, outerLink, profiles[0]);
  }, 60_000);

  // Inline handback adds no function, frame, scratch, runtime flag, or permanent RAM/ZP resource.
  it("should retain existing storage resources and exclusive IRQ wrapper costs", async () => {
    const prefix = source(`${entry}\n  ${timerUse}\n  for (;;) { asm_nop(); }`);
    const returning = source(`${entry}\n  ${timerUse}
  asm_nop(); c64.system.restoreIRQ(); asm_nop();`);
    const baseline = await build(prefix, profiles[0]);
    const artifacts = await build(returning, profiles[0]);
    const [install, restore] = transactions(artifacts, 2);
    const labels = symbols(artifacts);
    const link = savedLink(install!, labels);
    expectHandback(restore!, labels, link, profiles[0]);
    expect(link[1]).toBe(link[0]! + 1);
    expect(link[0]! & 0xff).toBeLessThanOrEqual(0xfe);
    expect(
      profileRecords(artifacts.debug.functions)
        .map(({ qualifiedName }) => qualifiedName)
        .sort(),
    ).toEqual(["src/game.blend::Game.main", "src/game.blend::Game.onIRQ"]);
    // Compare logical storage classes, since larger code can move the same physical homes.
    const functionStorage = (generation: Artifacts) =>
      profileRecords(generation.memory.intervals)
        .filter(
          (interval) =>
            ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)) &&
            ["function", "helper"].includes(String(profileRecord(interval.owner).kind)),
        )
        .reduce<Record<string, number>>((totals, interval) => {
          const key = `${String(interval.kind)}:${String(profileRecord(interval.owner).kind)}`;
          expect(interval.size).toBeTypeOf("number");
          totals[key] = (totals[key] ?? 0) + Number(interval.size);
          return totals;
        }, {});
    expect(Object.keys(functionStorage(baseline)).length).toBeGreaterThan(0);
    expect(functionStorage(artifacts)).toEqual(functionStorage(baseline));
    expect(artifacts.memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/u);
    const extraResources = (generation: Artifacts) =>
      profileRecords(profileRecord(generation.costs.totals).resources)
        .filter(({ kind, id }) => kind === "standard" && (id === "zeroPage" || id === "scratch"))
        .map(({ id, value }) => ({ id, value }))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    expect(extraResources(artifacts)).toHaveLength(2);
    expect(extraResources(artifacts)).toEqual(extraResources(baseline));
    const irq = body(artifacts, "onIRQ");
    expect(irq[0]).toEqual({ opcode: "cld", operand: "" });
    expect(irq.at(-1)).toEqual({ opcode: "jmp", operand: "$ea81" });
    expect(
      irq.filter(({ opcode }) => ["php", "pha", "pla", "plp", "rti"].includes(opcode)),
    ).toEqual([]);
    const wrapper = cost([irq[0]!, irq.at(-1)!], labels);
    expect(wrapper).toEqual({ bytes: 4, cycles: 5 });
    // Existing ROM entry and restore tail add cycles, while contributing zero output bytes.
    const entryROM = { bytes: 16, cycles: 29 };
    const tailROM = { bytes: 6, cycles: 22 };
    expect(7 + entryROM.cycles + wrapper.cycles + tailROM.cycles).toBe(63);
    expect(profileRecord(artifacts.costs.totals).programBytes).toBe(artifacts.prg.length - 2);
    expect(profileRecords(artifacts.memory.stackDomains).length).toBeGreaterThan(0);
  }, 60_000);
});
