import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { validFixedLoopFacts } from "../semantic/aggregate-place-proof.js";
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
import { closeStorage } from "../storage/closure.js";
import { closeSharedStorage } from "../services/shared-storage.js";
import { selectTargetProfile } from "../target/profile.js";
import { lowerMachineProgram } from "./lower.js";
import { bindFixedLoopContext, prepareFixedLoops } from "./fixed-loop-selection.js";
import type { FixedLoopPolicy, MachineLoweringInput } from "./machine-types.js";

/** Counter fixtures use the actual frontend, source proof producer, staging and binder discovery. */
function prepared(text: string, policy: FixedLoopPolicy = "low-byte") {
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (selected.kind !== "complete") throw new Error("Expected fixture profile");
  const profile = selected.profile;
  const sha256 = createHash("sha256").update(text).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "counter-selection",
      sourceRoot: "src",
      entry: "Game",
      target: profile.id,
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
    effectiveTarget: profile.id,
    effectiveEntry: "Game",
  };
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const closed = closeWholeProgram(semantic.program, profile.interrupts, profile.storage);
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const program = closed.program;
  const loops = deriveFixedLoopFacts(program, collectSourceLoopNesting(program, analysis.program));
  const objects = deriveClosedObjectFacts(
    program,
    profile.storage,
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
  const allocated = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocated.kind !== "complete") throw new Error("Expected fixture homes");
  const input: MachineLoweringInput = {
    program,
    profile,
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
  };
  const lowered = lowerMachineProgram(input);
  if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered));
  return {
    input,
    lowered,
    loops,
    functions,
    machine: lowered.program.functions.find((fn) => fn.sourceName === "Game.work")!,
  };
}

const declarations = `module Game;place(at:$3400)let answers:byte[8]=[;0];`;

describe("word counters represented by one byte", () => {
  it.each(["x-first", "y-first", "flat-eight-x-first", "flat-eight-y-first"] as const)(
    "should hold the proved counter in the selected register under %s",
    (policy) => {
      const fixture = prepared(
        `${declarations}
function work():void{for(let row:word=0;row<4;row+=1){answers[row]=peek($C110);}}
function main():void{work();}`,
        policy,
      );
      const register = policy.includes("y-first") ? "y" : "x";
      expect(fixture.machine.fixedCounterProofs?.[0]).toMatchObject({
        representation: register,
        requestId: null,
      });
      const instructions = fixture.machine.blocks.flatMap((block) => block.instructions);
      expect(instructions.some((instruction) => instruction.opcode === `in${register}`)).toBe(true);
      expect(
        instructions.some(
          (instruction) =>
            instruction.opcode === "sta" && instruction.mode === `absolute-${register}`,
        ),
      ).toBe(true);
      expect(
        instructions.some(
          (instruction) => instruction.opcode === "sta" && instruction.operand?.kind === "storage",
        ),
      ).toBe(false);
    },
  );

  it("should assign opposite registers jointly across a two-level nest", () => {
    const fixture = prepared(
      `${declarations}
function work():void{for(let col:word=0;col<4;col+=1){for(let other:word=col+1;other<4;other+=1){answers[other]=byte(col);}}}
function main():void{work();}`,
      "y-first",
    );
    expect(fixture.machine.fixedCounterProofs?.map((proof) => proof.representation)).toEqual([
      "y",
      "x",
    ]);
  });

  it("should keep a clobbered nest ordinary while selecting an unrelated safe loop", () => {
    const fixture = prepared(
      `${declarations}
function helper():void{asm_nop();}
function work():void{for(let col:word=0;col<4;col+=1){for(let other:word=col+1;other<4;other+=1){helper();}}
for(let safe:word=0;safe<4;safe+=1){answers[safe]=peek($C110);}}
function main():void{work();}`,
      "x-first",
    );
    expect(fixture.machine.fixedCounterProofs).toHaveLength(1);
    expect(fixture.machine.fixedCounterProofs?.[0]?.loop.depth).toBe(0);
  });

  it("should retain ordinary Y counters when a converted index still needs generic Y setup", () => {
    const fixture = prepared(
      `${declarations}
function work():void{for(let row:word=0;row<4;row+=1){answers[byte(row)]=peek($C110);}}
function main():void{work();}`,
      "y-first",
    );
    expect(fixture.machine.fixedCounterProofs).toBeUndefined();
  });

  it("should retain an ordinary Y counter across an unproved whole-array copy", () => {
    const fixture = prepared(
      `${declarations}
let original:byte[8]=[;7];let copied:byte[8]=[;0];
function work():void{for(let row:word=0;row<4;row+=1){copied=original;answers[row]=copied[0];}}
function main():void{work();}`,
      "y-first",
    );
    expect(fixture.machine.fixedCounterProofs).toBeUndefined();
  });

  it.each(["x-first", "y-first"] as const)(
    "should reject overlapping third-level register assignments under %s",
    (policy) => {
      const fixture = prepared(
        `${declarations}
function work():void{for(let outer:word=0;outer<4;outer+=1){for(let middle:word=0;middle<4;middle+=1){for(let inner:word=0;inner<4;inner+=1){answers[inner]=byte(outer);}}}}
function main():void{work();}`,
        policy,
      );
      expect(fixture.machine.fixedCounterProofs).toBeUndefined();
    },
  );

  it.each([
    ["x-first", "answers[row]=byte(1<<byte(row));", false],
    ["y-first", "answers[row]=byte(1<<byte(row));", true],
    ["y-first", "let index:byte=byte(peek($C111));answers[index]=byte(row);", false],
    ["x-first", "let index:byte=byte(peek($C111));answers[index]=byte(row);", true],
    ["x-first", "answers[row]=byte(peekw($C110));", false],
    ["y-first", "poke($C100+row,7);", false],
  ] as const)("should select %s only with proved body clobbers: %s", (policy, body, selected) => {
    const fixture = prepared(
      `${declarations}function work():void{for(let row:word=0;row<4;row+=1){${body}}}function main():void{work();}`,
      policy,
    );
    expect((fixture.machine.fixedCounterProofs?.length ?? 0) > 0).toBe(selected);
  });

  it.each(["x-first", "y-first"] as const)(
    "should preserve word snapshots and high-byte reconstruction under %s",
    (policy) => {
      const fixture = prepared(
        `${declarations}
function work():void{for(let row:word=0;row<4;row+=1){let saved:word=row;answers[row]=byte(saved+257);poke($C100,hi(row));}}
function main():void{work();}`,
        policy,
      );
      expect(fixture.machine.fixedCounterProofs).toHaveLength(1);
      const proof = fixture.machine.fixedCounterProofs![0]!;
      const bound = bindFixedLoopContext(
        { ...fixture.machine, id: `${fixture.machine.id}.main.depth1` },
        fixture.machine.id,
        (id) => `selected:${id}`,
      );
      expect(bound.fixedCounterProofs?.[0]).toMatchObject({
        requestId: null,
        originalRequestId: `selected:${proof.originalRequestId}`,
      });
    },
  );

  it("should keep a full-width shift nest ordinary but select an unrelated Y counter", () => {
    const fixture = prepared(
      `${declarations}
function work(count:word):void{for(let row:word=0;row<4;row+=1){answers[row]=byte(1)<<count;}
for(let safe:word=0;safe<4;safe+=1){answers[safe]=peek($C110);}}
function main():void{work(word(peek($C111)));}`,
      "y-first",
    );
    expect(fixture.machine.fixedCounterProofs).toHaveLength(1);
    expect(fixture.machine.fixedCounterProofs?.[0]?.loop).toBe(fixture.loops[1]);
  });

  it("should still hold Y when the existing shift proof bounds the complete word count", () => {
    const fixture = prepared(
      `${declarations}
function work(count:word):void{for(let row:word=0;row<4;row+=1){answers[row]=byte(1)<<(count&7);}}
function main():void{work(word(peek($C111)));}`,
      "y-first",
    );
    expect(fixture.machine.fixedCounterProofs?.[0]?.representation).toBe("y");
  });

  it("should preserve native X indexing when the array root is bound from an SFA home", () => {
    const fixture = prepared(
      `${declarations}
function work():void{let items:byte[4]=[;0];for(let row:word=0;row<4;row+=1){items[row]=byte(row);}answers[0]=items[3];}
function main():void{work();}`,
      "x-first",
    );
    const inventory = inventoryStorage(fixture.input.program);
    const closed = closeStorage(inventory, fixture.input.profile.storage, fixture.lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    const shared = closeSharedStorage(
      fixture.lowered.program,
      fixture.lowered.binder,
      closed,
      fixture.input.profile,
    );
    expect(shared.kind).toBe("complete");
  });

  it("should attach each selected counter snapshot to its exact original source lifetime", () => {
    const fixture = prepared(
      `${declarations}
function work():void{for(let row:word=0;row<4;row+=1){poke($C100,lo(row));poke($C101,lo(row));}}
function main():void{work();}`,
      "x-first",
    );
    const reads = fixture.machine.fixedCounterProofs![0]!.reads;
    expect(reads).toHaveLength(2);
    for (const read of reads) {
      const request = fixture.lowered.program.requiredStorage.find((value) =>
        value.id.endsWith(`retained-value:${read.value}`),
      );
      const lifetime = fixture.input.program.lifetimes.find((value) => value.value === read.value);
      expect(lifetime).toBeDefined();
      expect(request?.lifetime).toBe(lifetime);
    }
  });

  it("should keep overlapping converted counter views in distinct snapshot homes", () => {
    const fixture = prepared(
      `${declarations}
function work():void{for(let col:word=0;col<4;col+=1){for(let row:word=0;row<4;row+=1){answers[row]=byte(col)+byte(row);}}}
function main():void{work();}`,
      "x-first",
    );
    const reads = fixture.machine.fixedCounterProofs!.flatMap((proof) =>
      proof.reads.map((read) => read.value),
    );
    const requests = fixture.lowered.program.requiredStorage.filter((request) =>
      reads.some((value) => request.id.endsWith(`retained-value:${value}`)),
    );
    expect(requests).toHaveLength(2);
    const closed = closeStorage(
      inventoryStorage(fixture.input.program),
      fixture.input.profile.storage,
      fixture.lowered.binder,
    );
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    const homes = requests.map(
      (request) => closed.certificate.homes.find((home) => home.requestId === request.id)?.address,
    );
    expect(homes.every((address) => address !== undefined)).toBe(true);
    expect(new Set(homes).size).toBe(2);
  });

  it.each(["x-first", "y-first"] as const)(
    "should bypass only the state-dead first test of a positive straight-line loop under %s",
    (policy) => {
      const fixture = prepared(
        `${declarations}
function work():void{for(let row:word=0;row<4;row+=1){answers[row]=peek($C110);}}
function main():void{work();}`,
        policy,
      );
      const loop = fixture.machine.fixedCounterProofs![0]!.loop;
      const entry = fixture.machine.blocks.find((block) => block.label === loop.preheader.id)!;
      expect(entry.terminator).toMatchObject({ target: loop.body.id });
      const inventory = inventoryStorage(fixture.input.program);
      const closed = closeStorage(inventory, fixture.input.profile.storage, fixture.lowered.binder);
      expect(closed.kind).toBe("complete");
      if (closed.kind !== "complete") return;
      const shared = closeSharedStorage(
        fixture.lowered.program,
        fixture.lowered.binder,
        closed,
        fixture.input.profile,
      );
      expect(shared.kind).toBe("complete");
      if (shared.kind !== "complete") return;
      const work = shared.layout.program.functions.find((fn) => fn.id === fixture.machine.id)!;
      const bytes = work.blocks.reduce(
        (total, block) =>
          total +
          block.instructions.reduce((sum, instruction) => sum + instruction.cost.bytes, 0) +
          ("cost" in block.terminator ? block.terminator.cost.bytes : 0),
        0,
      );
      expect(bytes).toBe(14);
    },
  );

  it.each([false, true])(
    "should retain exact native-store window flags when observed=%s",
    (observe) => {
      const fixture = prepared(
        `${declarations}
function work():void{let value:byte=120;for(let row:word=0;row<4;row+=1){asm_php();asm_plp();value+=120;answers[row]=value;${observe ? "asm_php();asm_plp();" : ""}}}
function main():void{work();}`,
        "x-first",
      );
      const loop = fixture.machine.fixedCounterProofs![0]!.loop;
      const header = fixture.machine.blocks.find((block) => block.label === loop.header.id)!;
      expect(header.instructions.at(-1)?.opcode).toBe("clv");
      expect(
        fixture.machine.blocks.find((block) => block.label === loop.preheader.id)?.terminator,
      ).toMatchObject({ target: loop.header.id });
      const body = fixture.machine.blocks.find((block) =>
        block.instructions.some((instruction) => instruction.opcode === "adc"),
      )!;
      const arithmetic = body.instructions.findIndex((instruction) => instruction.opcode === "adc");
      expect(
        body.instructions.slice(arithmetic + 1).map((instruction) => instruction.opcode),
      ).toEqual(observe ? ["ora", "sta", "sta", "php", "plp"] : ["sta", "sta"]);
      const proof = fixture.machine.nativeStoreProofs![0]!;
      expect(proof).toMatchObject({
        domain: "main",
        context: fixture.machine.id,
        block: body.label,
        restoresFlags: observe,
        pendingObservers: true,
      });
      expect(proof.removed.map((instruction) => instruction.opcode)).toEqual(["sta", "lda", "lda"]);
      expect(
        fixture.lowered.program.requiredStorage.some(
          (request) => request.id === proof.captureRequestId,
        ),
      ).toBe(true);
    },
  );

  it("should bind native-store homes and removed operands to the actual code context", () => {
    const fixture = prepared(
      `${declarations}
function work():void{let value:byte=120;for(let row:word=0;row<4;row+=1){value+=120;answers[row]=value;}}
function main():void{work();}`,
      "x-first",
    );
    const fn = fixture.machine;
    const suffix = ".main.depth1";
    const blocks = fn.blocks.map((block) => {
      const edge = block.terminator;
      const terminator =
        edge.kind === "branch"
          ? { ...edge, target: edge.target + suffix, fallthrough: edge.fallthrough + suffix }
          : edge.kind === "jump" || edge.kind === "fallthrough"
            ? { ...edge, target: edge.target + suffix }
            : edge;
      return { ...block, label: block.label + suffix, terminator };
    });
    const bound = bindFixedLoopContext(
      { ...fn, id: fn.id + suffix, blocks },
      fn.id,
      (id) => `selected:${id}`,
    );
    const original = fn.nativeStoreProofs![0]!;
    const proof = bound.nativeStoreProofs![0]!;
    expect(proof).toMatchObject({
      context: bound.id,
      block: original.block + suffix,
      captureRequestId: `selected:${original.captureRequestId}`,
      variableRequestId: `selected:${original.variableRequestId}`,
    });
    expect(
      proof.removed.every(
        (instruction) =>
          instruction.operand?.kind === "storage" &&
          instruction.operand.requestId.startsWith("selected:"),
      ),
    ).toBe(true);
    expect(proof.arithmetic).toBe(original.arithmetic);
  });

  it("should retain the expanded occurrence on a selected flag-restoration instruction", () => {
    const fixture = prepared(
      `${declarations}
function work():void{let value:byte=120;for(let col:word=0;col<4;col+=1){for(let row:word=0;row<8;row+=1){value+=120;answers[col]=value;}asm_php();asm_plp();}}
function main():void{work();}`,
      "flat-eight-x-first",
    );
    const proof = fixture.machine.nativeStoreProofs?.find((value) => value.restoresFlags);
    expect(proof).toBeDefined();
    const block = fixture.machine.blocks.find((value) => value.label === proof?.block)!;
    const restore = block.instructions.find((instruction) => instruction.opcode === "ora");
    expect(proof?.removed[0]?.sourceIteration).toBe(7);
    expect(restore?.sourceIteration).toBe(7);
  });
  it("should retain word source meaning while declaring one byte and using direct typed indexing", () => {
    const fixture = prepared(`${declarations}
function work():void{for(let row:word=0;row<8;row+=1){answers[row]=byte(row);poke($C100,hi(row));}}
function main():void{work();}`);
    const proof = fixture.machine.fixedCounterProofs?.[0];
    expect(proof).toMatchObject({
      representation: "low-byte",
      pendingObservers: true,
      loop: { type: { kind: "scalar", name: "word" } },
    });
    expect(
      fixture.lowered.program.requiredStorage.find((request) => request.id === proof?.requestId),
    ).toMatchObject({
      bytes: 1,
      region: "zero-page-preferred",
      type: { kind: "scalar", name: "byte" },
    });
    expect(
      fixture.lowered.program.certifiedStorage?.find(
        (request) => request.id === proof?.originalRequestId,
      ),
    ).toMatchObject({ bytes: 2 });
    const instructions = fixture.machine.blocks.flatMap((block) => block.instructions);
    expect(
      instructions.some(
        (instruction) =>
          instruction.opcode === "inc" &&
          instruction.operand?.kind === "storage" &&
          instruction.operand.requestId === proof?.requestId,
      ),
    ).toBe(true);
    expect(
      instructions.some(
        (instruction) => instruction.opcode === "sta" && instruction.mode === "absolute-y",
      ),
    ).toBe(true);
    expect(instructions.some((instruction) => instruction.mode === "indirect-y")).toBe(false);
    expect(proof?.changedState).toEqual(["a", "x", "y", "n", "z", "c", "v"]);
  });

  it("should narrow both independently proved nested counters including parent-plus-one initialization", () => {
    const fixture = prepared(`${declarations}
function work():void{for(let col:word=0;col<4;col+=1){for(let other:word=col+1;other<4;other+=1){answers[other]=byte(col);}}}
function main():void{work();}`);
    expect(fixture.machine.fixedCounterProofs).toHaveLength(2);
    expect(
      fixture.machine.fixedCounterProofs?.some(
        (proof) => proof.loop.initial.kind === "parent-next",
      ),
    ).toBe(true);
    expect(new Set(fixture.machine.fixedCounterProofs?.map((proof) => proof.requestId)).size).toBe(
      2,
    );
  });

  it("should keep complete word-comparison flags when PHP observes the loop entry", () => {
    const fixture = prepared(`${declarations}
function work():void{let value:byte=120;for(let row:word=0;row<8;row+=1){asm_php();asm_plp();value+=120;answers[row]=value;}}
function main():void{work();}`);
    const proof = fixture.machine.fixedCounterProofs![0]!;
    const header = fixture.machine.blocks.find((block) => block.label === proof.loop.header.id)!;
    expect(header.instructions.at(-1)?.opcode).toBe("clv");
    expect(proof.changedState).toContain("v");
  });

  it("should keep source break and continue edges while replacing only the designated update", () => {
    const fixture = prepared(`${declarations}
function work():void{for(let row:word=0;row<8;row+=1){if(row==3){continue;}if(row==6){break;}answers[row]=byte(row);}}
function main():void{work();}`);
    const proof = fixture.machine.fixedCounterProofs?.[0];
    expect(proof?.loop.exits.some((exit) => exit.kind === "break")).toBe(true);
    expect(proof?.loop.exits.filter((exit) => exit.kind === "update").length).toBeGreaterThan(1);
    expect(
      fixture.machine.blocks.filter((block) =>
        block.instructions.some((instruction) => instruction.opcode === "inc"),
      ),
    ).toHaveLength(1);
  });

  it("should preserve a zero-trip header and all source return exits", () => {
    const empty = prepared(`${declarations}
function work():void{for(let row:word=8;row<8;row+=1){poke($C100,byte(row));}}
function main():void{work();}`).machine;
    expect(empty.fixedCounterProofs?.[0]?.loop.tripDomain.maximum).toBe(0);
    const early = prepared(`${declarations}
function work():boolean{for(let row:word=0;row<8;row+=1){if(row==3){return true;}}return false;}
function main():void{if(work()){poke($C100,1);}}`).machine;
    expect(early.fixedCounterProofs?.[0]?.loop.exits.some((exit) => exit.kind === "return")).toBe(
      true,
    );
  });

  it("should preserve source word-initialization state observed before the first condition", () => {
    const fixture = prepared(`${declarations}
function work():void{let row:word=8;asm_php();asm_plp();for(;row<8;row+=1){poke($C100,byte(row));}}
function main():void{work();}`);
    const entry = fixture.machine.blocks[0]!;
    const php = entry.instructions.findIndex((instruction) => instruction.opcode === "php");
    expect(entry.instructions[php - 1]).toMatchObject({
      opcode: "lda",
      operand: { kind: "immediate", value: 0 },
    });
  });

  it.each([
    "let row:word=0;for(;row<8;row+=1){}pokew($C100,row);",
    "for(let row:word=0;row<8;row+=1){answers[row]=byte(peekw(&row));}",
    "for(let row:word=254;row<258;row+=1){poke($C100,byte(row));}",
  ])(
    "should retain ordinary word storage for observable, addressed or wider counters: %s",
    (body) => {
      const fixture = prepared(
        `${declarations}function work():void{${body}}function main():void{work();}`,
      );
      expect(fixture.machine.fixedCounterProofs).toBeUndefined();
    },
  );

  it("should reject copied domains and edited member/range containers without rederiving source facts", () => {
    const fixture = prepared(
      `${declarations}function work():void{for(let row:word=0;row<8;row+=1){answers[row]=byte(row);}}function main():void{work();}`,
    );
    const loop = fixture.loops[0]!;
    expect(validFixedLoopFacts(loop)).toBe(true);
    for (const invalid of [
      { ...loop, bound: 7 },
      { ...loop, members: new Set([...loop.members, "foreign"]) },
      { ...loop, valueBounds: new Map([...loop.valueBounds, ["invented", 7n]]) },
    ]) {
      expect(validFixedLoopFacts(invalid)).toBe(false);
      const functions = new Map(
        [...fixture.functions].map(([fn, facts]) => [
          fn,
          { ...facts, loops: facts.loops.map((value) => (value === loop ? invalid : value)) },
        ]),
      );
      expect(
        lowerMachineProgram({
          ...fixture.input,
          sourceFacts: { ...fixture.input.sourceFacts!, functions },
        }).kind,
      ).toBe("error");
    }
  });

  it("should bind counter homes and argument stages to the actual selected code context", () => {
    const fixture = prepared(
      `${declarations}function work():void{for(let row:word=0;row<8;row+=1){answers[row]=byte(row);}}function main():void{work();}`,
    );
    const fn = fixture.machine;
    const bound = bindFixedLoopContext(
      { ...fn, id: `${fn.id}.main.depth1` },
      fn.id,
      (id) => `selected:${id}`,
    );
    expect(bound.fixedCounterProofs?.[0]).toMatchObject({
      context: bound.id,
      originalRequestId: `selected:${fn.fixedCounterProofs![0]!.originalRequestId}`,
      requestId: `selected:${fn.fixedCounterProofs![0]!.requestId}`,
    });
  });

  it("should retain ordinary counters when the execution context omits source loop blocks", () => {
    const fixture = prepared(
      `${declarations}function work():void{for(let row:word=0;row<8;row+=1){answers[row]=byte(row);}}function main():void{work();}`,
    );
    const loop = fixture.loops[0]!;
    const blocks = loop.function.blocks.filter((block) => block !== loop.body);
    const runtime = prepareFixedLoops(blocks, fixture.input, loop.function.id, "main");
    expect(runtime.counterFacts).toHaveLength(0);
    expect(runtime.blocks).toEqual(blocks);
  });
});
