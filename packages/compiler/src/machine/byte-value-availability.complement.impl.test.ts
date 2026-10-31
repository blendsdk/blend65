import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import {
  collectSourceLoopNesting,
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
} from "../semantic/fixed-loop-facts.js";
import { deriveLocalStorageLifetimes } from "../semantic/local-storage-lifetimes.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectClosedObjectStorage } from "../storage/selection.js";
import { selectTargetProfile } from "../target/profile.js";
import {
  byteComplementNoCode,
  deriveByteComplementFacts,
  validByteComplementFacts,
} from "./byte-value-availability.js";
import { lowerMachineProgram } from "./lower.js";
import type {
  MachineFunction,
  MachineFunctionSourceFacts,
  MachineSourceFacts,
} from "./machine-types.js";

/** Use the real frontend, source effects and loop facts; only host filesystem input is in memory. */
function prepared(text: string, objectBounds = true) {
  const profileId = "c64-pal-prg-kernal-6581";
  const sha256 = createHash("sha256").update(text).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "complement-implementation",
      sourceRoot: "src",
      entry: "Game",
      target: profileId,
      assetPaths: [],
      outDir: "out",
      optimization: "size",
      boundsCheck: true,
      divisionZeroCheck: true,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      byteLength: 2,
      sha256: createHash("sha256").update("{}").digest("hex"),
      resolvedPath: "/checkout/blend65.json",
    },
    sources: [
      {
        sourceId: "src/game.blend",
        text,
        sha256,
        byteLength: Buffer.byteLength(text),
        resolvedPath: "/checkout/src/game.blend",
      },
    ],
    inputSha256: sha256,
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: [],
    outDir: "/checkout/out",
    overrides: { target: null, entry: null },
    effectiveTarget: profileId,
    effectiveEntry: "Game",
  };
  const target = selectTargetProfile(profileId);
  if (target.kind !== "complete") throw new Error("Expected fixture profile");
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const closed = closeWholeProgram(
    semantic.program,
    target.profile.interrupts,
    target.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const program = closed.program;
  const loops = deriveFixedLoopFacts(program, collectSourceLoopNesting(program, analysis.program));
  const objects = deriveClosedObjectFacts(
    program,
    target.profile.storage,
    objectBounds ? fixedLoopValueBounds(program, loops) : undefined,
  );
  const lives = deriveLocalStorageLifetimes(program);
  const selections = selectClosedObjectStorage(objects);
  const functions = new Map(
    program.semantic.functions.map((fn) => {
      const source: MachineFunctionSourceFacts = {
        function: fn,
        objects,
        loops: loops.filter((loop) => loop.function === fn),
        lifetimes: new Map([...lives].filter(([, life]) => life.function === fn.id)),
        ...(selections.has(fn) ? { storage: selections.get(fn) } : {}),
      };
      return [
        fn,
        { ...source, complements: deriveByteComplementFacts(source, target.profile) },
      ] as const;
    }),
  );
  const sourceFacts: MachineSourceFacts = { program, functions, nonLoopBundle: "closed" };
  const inventory = inventoryStorage(program);
  const allocated = allocateStorage(
    inventory,
    buildInterference(inventory),
    target.profile.storage,
  );
  if (allocated.kind !== "complete") throw new Error("Expected provisional fixture homes");
  const lowered = lowerMachineProgram({
    program,
    profile: target.profile,
    placement: allocated.placement,
    sourceFacts,
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
    boundsCheck: true,
  });
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered));
  return {
    sourceFacts,
    profile: target.profile,
    placement: allocated.placement,
    lowered,
    source: (name: string) =>
      [...functions.values()].find((value) => value.function.name === `Game.${name}`)!,
    machine: (name: string) =>
      lowered.program.functions.find((value) => value.sourceName === `Game.${name}`)!,
  };
}

/** Count actual selected complement instructions, not source spellings. */
function complementCount(fn: MachineFunction): number {
  return fn.blocks
    .flatMap((block) => block.instructions)
    .filter(
      (instruction) =>
        instruction.opcode === "eor" &&
        instruction.operand?.kind === "immediate" &&
        instruction.operand.value === 255,
    ).length;
}

const declarations = `module Game; place(at: $3200) let x: byte;
place(at: $3400) let answers: byte[16] = [; 0];`;
const stable = `${declarations}
function stable(): void {
  for (let i: word = 0; i < 4; i += 1) { answers[i] = ~x; }
  for (let i: word = 4; i < 8; i += 1) { answers[i] = ~x; }
}
function main(): void { stable(); }`;

describe("conditional complement availability", () => {
  it("should sample and complement one stable global before two positive fixed loops", () => {
    const fixture = prepared(stable);
    const source = fixture.source("stable");
    expect(source.complements.replacements.size).toBe(2);
    expect(complementCount(fixture.machine("stable"))).toBe(1);
    const requests = fixture.lowered.program.requiredStorage.filter((request) =>
      request.id.includes(":byte-complement:"),
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      bytes: 1,
      region: "zero-page-preferred",
      storageClass: "temporary",
    });
    expect(fixture.machine("stable").byteComplementProofs).toHaveLength(2);
    expect(
      fixture.machine("stable").byteComplementProofs?.every((proof) => proof.pendingObservers),
    ).toBe(true);
  });

  it.each([
    "x = byte(i); answers[i] = ~x;",
    "poke(peekw($C120), byte(i)); answers[i] = ~x;",
    "answers[i] = ~peek($C110);",
  ])("should retain ordinary recomputation for mutation or volatile producer %s", (body) => {
    const fixture = prepared(`${declarations}
function work(): void { for (let i: word = 0; i < 4; i += 1) { ${body} }
  for (let i: word = 4; i < 8; i += 1) { ${body} } }
function main(): void { work(); }`);
    expect(fixture.source("work").complements.replacements.size).toBe(0);
    expect(complementCount(fixture.machine("work"))).toBe(2);
  });

  it("should use the original stable field behind a complemented local with its packed offset", () => {
    const fixture = prepared(`module Game; struct Cell { pad: word; value: byte; }
place(at: $3200) let cell: Cell = { pad: 0, value: 7 };
place(at: $3300) let left: byte = 5; place(at: $3400) let answers: byte[8];
function work(p: const Cell): void { let inverse: byte = ~p.value;
  for (let i: word = 0; i < 8; i += 1) { answers[i] = left & ~inverse; } }
function main(): void { work(cell); }`);
    expect(complementCount(fixture.machine("work"))).toBe(1);
    expect(
      fixture.lowered.program.requiredStorage.some((request) =>
        request.id.includes(":byte-complement:"),
      ),
    ).toBe(false);
    expect(
      fixture
        .machine("work")
        .blocks.flatMap((block) => block.instructions)
        .some(
          (instruction) =>
            instruction.opcode === "and" &&
            instruction.operand?.kind === "label" &&
            instruction.operand.offset === 2,
        ),
    ).toBe(true);
    expect(fixture.machine("work").byteComplementProofs?.[0]).toMatchObject({
      kind: "original",
      cacheRequestId: null,
      pendingObservers: true,
    });
  });

  it("should not treat readonly as stability when another source alias writes the field", () => {
    const fixture = prepared(`module Game; struct Cell { value: byte; }
let cell: Cell = { value: 7 }; let answers: byte[8];
function work(p: const Cell): void { let inverse: byte = ~p.value;
  for (let i: word = 0; i < 8; i += 1) { cell.value = byte(i); answers[i] = ~inverse; } }
function main(): void { work(cell); }`);
    expect(fixture.source("work").complements.replacements.size).toBe(0);
  });

  it("should bind complete maps and reject stale profiles or source identities", () => {
    const fixture = prepared(stable);
    const source = fixture.source("stable");
    const facts = source.complements;
    expect(validByteComplementFacts(facts, source, fixture.profile.id)).toBe(true);
    expect(
      validByteComplementFacts({ ...facts, replacements: new Map() }, source, fixture.profile.id),
    ).toBe(false);
    expect(
      validByteComplementFacts(
        facts,
        { ...source, function: { ...source.function } },
        fixture.profile.id,
      ),
    ).toBe(false);
    expect(validByteComplementFacts(facts, source, "c64-ntsc-prg-kernal-6581")).toBe(false);
    expect(
      validByteComplementFacts(
        { ...facts, profileId: "c64-ntsc-prg-kernal-6581" },
        source,
        "c64-ntsc-prg-kernal-6581",
      ),
    ).toBe(false);
    const [operation, recipe] = [...facts.replacements][0]!;
    const staged = {
      ...fixture.placement,
      homes: [
        ...fixture.placement.homes,
        {
          ...fixture.placement.homes[0]!,
          requestId: `${bindingIdentityKey(source.function.id)}:argument-stage:${recipe.input.result}`,
        },
      ],
    };
    expect(
      byteComplementNoCode(facts, staged, source.function.blocks).noCode.has(recipe.input),
    ).toBe(false);
    expect(
      byteComplementNoCode(facts, fixture.placement, source.function.blocks).noCode.has(operation),
    ).toBe(true);
  });

  it("should retain each volatile left value whose baseline capture may disappear", () => {
    const fixture = prepared(`${declarations}
function work(): void {
  for (let i: word = 0; i < 4; i += 1) { answers[i] = peek($C110) & ~x; }
  for (let i: word = 4; i < 8; i += 1) { answers[i] = peek($C110) & ~x; }
}
function main(): void { work(); }`);
    const left = fixture
      .source("work")
      .function.blocks.flatMap((block) => block.operations)
      .filter((operation) => operation.kind === "memory-read")
      .map((operation) => operation.result);
    expect(
      fixture.machine("work").byteComplementProofs?.map((proof) => proof.preservedLeft),
    ).toEqual(left);
  });

  it("should retain the admitting positive-trip counter even without object-range facts", () => {
    const fixture = prepared(
      `${declarations}
function work(): void {
  for (let i: word = 0; i < 4; i += 1) { poke($C100, ~x); }
  for (let i: word = 4; i < 8; i += 1) { poke($C101, ~x); }
}
function main(): void { work(); }`,
      false,
    );
    const source = fixture.source("work");
    expect(source.objects.rangeObservers).toHaveLength(0);
    expect(source.complements.replacements.size).toBe(2);
    const counter = source.loops.find(
      (loop) => loop.preheader.id === source.function.entry,
    )!.counter;
    expect(
      fixture
        .machine("work")
        .byteComplementProofs?.every((proof) =>
          proof.rangeCounters.some(
            (binding) => bindingIdentityKey(binding) === bindingIdentityKey(counter),
          ),
        ),
    ).toBe(true);
  });
});
