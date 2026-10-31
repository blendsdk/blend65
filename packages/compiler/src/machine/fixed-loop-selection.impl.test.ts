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
import { selectTargetProfile } from "../target/profile.js";
import type { FixedLoopPolicy } from "./fixed-loop-selection.js";
import { bindFixedLoopContext } from "./fixed-loop-selection.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import { lowerMachineProgram } from "./lower.js";
import { foldFixedLoopOrdinal } from "./lower-bounds.js";
import type { LoweredValue } from "./lower-control.js";
import { sourceSpan } from "./lowering-test-support.js";

/** Real frontend, source facts and lowering; the filesystem alone is represented by a snapshot. */
function prepared(
  text: string,
  policy: FixedLoopPolicy = "flat-eight-x-first",
  rewriteLoops?: (loops: readonly FixedLoopFacts[]) => readonly FixedLoopFacts[],
) {
  const target = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (target.kind !== "complete") throw new Error("Expected fixture profile");
  const sha256 = createHash("sha256").update(text).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "loop-selection",
      sourceRoot: "src",
      entry: "Game",
      target: target.profile.id,
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
    effectiveTarget: target.profile.id,
    effectiveEntry: "Game",
  };
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
  const derived = deriveFixedLoopFacts(
    program,
    collectSourceLoopNesting(program, analysis.program),
  );
  const loops = rewriteLoops?.(derived) ?? derived;
  const objects = deriveClosedObjectFacts(
    program,
    target.profile.storage,
    fixedLoopValueBounds(program, loops),
  );
  const lives = deriveLocalStorageLifetimes(program);
  const functions = new Map(
    program.semantic.functions.map((fn) => [
      fn,
      {
        function: fn,
        objects,
        loops: loops.filter((loop) => loop.function === fn),
        lifetimes: new Map([...lives].filter(([, life]) => life.function === fn.id)),
      },
    ]),
  );
  const inventory = inventoryStorage(program);
  const allocated = allocateStorage(
    inventory,
    buildInterference(inventory),
    target.profile.storage,
  );
  if (allocated.kind !== "complete") throw new Error("Expected fixture homes");
  const lowered = lowerMachineProgram({
    program,
    profile: target.profile,
    placement: allocated.placement,
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
    sourceFacts: { program, functions, nonLoopBundle: "closed", loopPolicy: policy },
    boundsCheck: true,
    divisionZeroCheck: true,
  });
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered));
  return {
    lowered,
    loops,
    program,
    machine: lowered.program.functions.find((fn) => fn.sourceName === "Game.work")!,
  };
}

const declarations = `module Game;
place(at:$3200)let count:byte;
place(at:$3400)let answers:byte[8]=[;0];`;

describe("fixed-eight occurrence lowering", () => {
  it("should retain the runtime bounds stop for a counter-derived final out-of-extent index", () => {
    const fixture = prepared(`${declarations}
place(at:$3408)let marker:byte=$5A;
function work():void{for(let row:word=0;row<8;row+=1){answers[row+1]=1;}}
function main():void{work();}`);
    expect(fixture.machine.fixedLoopProofs).toBeUndefined();
    expect(
      fixture.machine.blocks.some(
        (block) =>
          block.terminator.kind === "jump" &&
          block.terminator.target === block.label &&
          block.instructions.some((instruction) => instruction.opcode === "sei"),
      ),
    ).toBe(true);
  });
  it.each([8, 16] as const)(
    "should interpret %i-bit signed constant representations before a right shift",
    (width) => {
      const values = new Map<string, LoweredValue>([
        [
          "sample",
          { kind: "constant", value: width === 8 ? 0x81 : 0xff81, bytes: width / 8, signed: true },
        ],
        ["count", { kind: "constant", value: 1, bytes: 1, signed: false }],
      ]);
      const value = foldFixedLoopOrdinal(
        {
          kind: "binary",
          result: "answer",
          operator: ">>",
          left: "sample",
          right: "count",
          type: { kind: "scalar", name: width === 8 ? "sbyte" : "sword" },
          integer: { width, signed: true, wrap: true },
          span: sourceSpan(1),
          rightSpan: sourceSpan(2),
        },
        values,
      );
      expect(value).toMatchObject({ kind: "constant", value: -64, signed: true });
    },
  );
  it("should reject copied facts which pretend a four-trip source loop has eight iterations", () => {
    expect(() =>
      prepared(
        `${declarations}
function work():void{for(let row:word=0;row<4;row+=1){poke($C100,byte(row));}}
function main():void{work();}`,
        "flat-eight-x-first",
        (loops) => loops.map((loop) => ({ ...loop, flatEight: true, exactIterations: 8 })),
      ),
    ).toThrow("Flat-eight facts do not match");
  });
  it("should replay the complete dispatcher with distinct runtime-shift and bounds continuations", () => {
    const source = `${declarations}
function work():void{for(let row:word=0;row<8;row+=1){
  let value:byte=peek($C110); answers[row]=value<<count;
  poke($C100,answers[row]); answers[byte(peek($C111))]=byte(row);
}}
function main():void{work();}`;
    const fixture = prepared(source);
    const fn = fixture.machine;
    const proof = fn.fixedLoopProofs?.[0];
    expect(proof).toMatchObject({ representation: "flat-eight", pendingObservers: true });
    expect(proof?.occurrences.map((occurrence) => occurrence.iteration)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    const labels = new Set(fn.blocks.map((block) => block.label));
    expect(labels.size).toBe(fn.blocks.length);
    for (const occurrence of proof?.occurrences ?? []) {
      expect(occurrence.blocks.length).toBeGreaterThan(2);
      for (const label of occurrence.blocks) {
        const block = fn.blocks.find((block) => block.label === label)!;
        expect(
          block.instructions.every(
            (instruction) => instruction.sourceIteration === occurrence.iteration,
          ),
        ).toBe(true);
      }
    }
    for (const block of fn.blocks) {
      const edge = block.terminator;
      const targets =
        edge.kind === "jump" || edge.kind === "fallthrough"
          ? [edge.target]
          : edge.kind === "branch"
            ? [edge.target, edge.fallthrough]
            : [];
      expect(targets.every((target) => labels.has(target))).toBe(true);
    }
    const effects = fn.blocks
      .flatMap((block) => block.instructions)
      .flatMap((instruction) => instruction.memory);
    for (const [kind, address] of [
      ["read", 0xc110],
      ["read", 0xc111],
      ["write", 0xc100],
    ] as const)
      expect(
        effects.filter(
          (effect) =>
            effect.kind === kind &&
            effect.address.kind === "absolute" &&
            effect.address.value === address,
        ),
      ).toHaveLength(8);
    expect(
      fixture.lowered.program.requiredStorage.every(
        (request) => !request.id.includes(".iteration."),
      ),
    ).toBe(true);
    expect(
      fixture.lowered.program.requiredStorage.every(
        (request) =>
          request.lifetime?.liveAt.every((position) => !position.block.includes(".iteration.")) ??
          true,
      ),
    ).toBe(true);
    expect(labels.has(proof!.loop.header.id)).toBe(false);
    expect(labels.has(proof!.loop.update.id)).toBe(false);
  });

  it("should specialize counter-dependent masks before ordinary fixed-shift selection", () => {
    const source = `${declarations}
function work():void{for(let row:word=0;row<8;row+=1){poke($C100,byte(1<<byte(row)));}}
function main():void{work();}`;
    const fn = prepared(source).machine;
    const loads = fn.blocks
      .flatMap((block) => block.instructions)
      .filter(
        (instruction) => instruction.opcode === "lda" && instruction.operand?.kind === "immediate",
      );
    expect(
      loads.map((instruction) =>
        instruction.operand?.kind === "immediate" ? instruction.operand.value : null,
      ),
    ).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(
      fn.blocks
        .flatMap((block) => block.instructions)
        .some((instruction) => instruction.opcode === "asl"),
    ).toBe(false);
  });

  it("should bind every generated occurrence to the actual specialized code context", () => {
    const fn = prepared(`${declarations}
function work():void{for(let row:word=0;row<8;row+=1){poke($C100,byte(row));}}
function main():void{work();}`).machine;
    const suffix = ".main.depth1";
    const specialized = {
      ...fn,
      id: `${fn.id}${suffix}`,
      blocks: fn.blocks.map((block) => ({ ...block, label: `${block.label}${suffix}` })),
    };
    const bound = bindFixedLoopContext(specialized, fn.id);
    const labels = new Set(bound.blocks.map((block) => block.label));
    expect(
      bound.fixedLoopProofs?.every(
        (proof) =>
          proof.context === specialized.id &&
          proof.occurrences.every((occurrence) =>
            occurrence.blocks.every((label) => labels.has(label)),
          ),
      ),
    ).toBe(true);
    expect(() => bindFixedLoopContext({ ...specialized, blocks: [] }, fn.id)).toThrow(
      "Fixed-loop occurrence was lost",
    );
  });

  it.each(["original", "low-byte", "x-first", "y-first"] as const)(
    "should not expand the body under %s",
    (policy) => {
      const fn = prepared(
        `${declarations}
function work():void{for(let row:word=0;row<8;row+=1){poke($C100,byte(row));}}
function main():void{work();}`,
        policy,
      ).machine;
      expect(fn.fixedLoopProofs).toBeUndefined();
    },
  );

  it("should retain a raw ordinal-dependent input loop and early-exit loop", () => {
    const fn = prepared(`${declarations}
function work():void{for(let row:word=0;row<8;row+=1){answers[row]=peek($C110+row);}
  for(let other:word=0;other<8;other+=1){if(other==3){return;}poke($C100,byte(other));}}
function main():void{work();}`).machine;
    expect(fn.fixedLoopProofs).toBeUndefined();
  });
});
