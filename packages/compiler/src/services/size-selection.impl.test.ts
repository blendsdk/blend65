import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { lowerMachineProgram } from "../machine/lower.js";
import { bindMachineProgram } from "../machine/bind.js";
import {
  domainStorageRequest,
  provisionalDeclarationAliases,
} from "../machine/interrupt-specialize.js";
import type { ProjectSnapshot } from "../project/types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { closeStorage } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import { projectMachineStorage, selectClosedObjectStorage } from "../storage/selection.js";
import { closeSharedStorage } from "./shared-storage.js";
import { machineInstruction } from "../machine/lower-control.js";
import { reserveZeroPageGlobals } from "./zero-page-globals.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import { deriveLocalStorageLifetimes } from "../semantic/local-storage-lifetimes.js";
import {
  collectSourceLoopNesting,
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
} from "../semantic/fixed-loop-facts.js";
import { deriveByteComplementFacts } from "../machine/byte-value-availability.js";
import type {
  MachineSourceFacts,
  MachineFunctionSourceFacts,
  FixedLoopPolicy,
} from "../machine/machine-types.js";

/** Keep source parsing, semantic closure and logical storage real; no filesystem is needed. */
function prepared(text: string) {
  const profileId = "c64-pal-prg-kernal-6581";
  const sha256 = createHash("sha256").update(text).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "selected-storage",
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
  const selected = selectTargetProfile(profileId);
  if (selected.kind !== "complete") throw new Error("Expected a fixture profile");
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis.diagnostics));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const program = closed.program;
  const inventory = inventoryStorage(program);
  const input = {
    program,
    profile: selected.profile,
    logicalStorage: inventory,
    boundsCheck: true,
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
  };
  return { input, inventory, analysis };
}

/** Install existing whole-function facts once; this does not construct or select a candidate. */
function withRecipes(
  fixture: ReturnType<typeof prepared>,
  policy: FixedLoopPolicy,
  fixedObjects = false,
) {
  const { program, profile } = fixture.input;
  const loops = deriveFixedLoopFacts(
    program,
    collectSourceLoopNesting(program, fixture.analysis.program),
  );
  const objects = deriveClosedObjectFacts(
    program,
    profile.storage,
    fixedLoopValueBounds(program, loops),
  );
  const lives = deriveLocalStorageLifetimes(program);
  const storage = fixedObjects ? selectClosedObjectStorage(objects) : new Map();
  const functions = new Map(
    program.semantic.functions.map((fn) => {
      const facts: MachineFunctionSourceFacts = {
        function: fn,
        objects,
        loops: loops.filter((loop) => loop.function === fn),
        lifetimes: new Map([...lives].filter(([, life]) => life.function === fn.id)),
        ...(storage.has(fn) ? { storage: storage.get(fn) } : {}),
      };
      return [fn, { ...facts, complements: deriveByteComplementFacts(facts, profile) }] as const;
    }),
  );
  const sourceFacts: MachineSourceFacts = {
    program,
    functions,
    nonLoopBundle: "closed",
    loopPolicy: policy,
  };
  return { ...fixture.input, sourceFacts };
}

describe("allocation-independent logical storage", () => {
  it("should preserve actual shared mainline and IRQ private namespaces through closure", () => {
    const fixture = prepared(`module Game;import {setIRQ,restoreIRQ} from c64.system;
function shared():void{let value:word=peekw($C110);pokew($C100,value+1);}
interrupt function handler():void{shared();}
function main():void{setIRQ(&handler);shared();restoreIRQ();}`);
    const lowered = lowerMachineProgram(fixture.input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    const shared = fixture.input.program.semantic.functions.find(
      (fn) => fn.name === "Game.shared",
    )!;
    const homes = fixture.inventory.requests.filter(
      (request) => bindingIdentityKey(request.owner) === bindingIdentityKey(shared.id),
    );
    expect(new Set(homes.map((request) => request.domain))).toEqual(new Set(["main", "irq"]));
    const closed = closeStorage(fixture.inventory, fixture.input.profile.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  });

  it("should retain the existing comparison-chain fallback without a physical indirect pointer", () => {
    const fixture = prepared(`module Game;
function left():byte{return 7;}function right():byte{return 9;}
function main():void{let target:fn():byte=peek($C110)!=0?&left:&right;poke($C100,target());}`);
    const lowered = lowerMachineProgram(fixture.input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    const main = lowered.program.functions.find((fn) => fn.sourceName === "Game.main")!;
    expect(
      main.blocks
        .flatMap((block) => block.instructions)
        .some((instruction) => instruction.opcode === "jmp" && instruction.mode === "indirect"),
    ).toBe(false);
    expect(main.blocks.some((block) => block.terminator.kind === "branch")).toBe(true);
    const closed = closeStorage(fixture.inventory, fixture.input.profile.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  });

  it.each(["low-byte", "x-first", "y-first", "flat-eight-x-first", "flat-eight-y-first"] as const)(
    "should preserve exact source counter and complement recipes under %s without homes",
    (policy) => {
      const fixture =
        prepared(`module Game;place(at:$3200)let value:byte;place(at:$3400)let answers:byte[8]=[;0];
function work():void{for(let row:word=0;row<4;row+=1){answers[row]=~value;}for(let row:word=4;row<8;row+=1){answers[row]=~value;}}
function main():void{work();}`);
      const input = withRecipes(fixture, policy);
      const lowered = lowerMachineProgram(input);
      expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
      if (lowered.kind !== "complete") return;
      expect(
        lowered.program.requiredStorage.some((request) => request.id.includes(":byte-complement:")),
      ).toBe(true);
      expect(lowered.program.functions.some((fn) => (fn.fixedCounterProofs?.length ?? 0) > 0)).toBe(
        true,
      );
      const allocation = allocateStorage(
        fixture.inventory,
        buildInterference(fixture.inventory),
        input.profile.storage,
      );
      expect(allocation.kind).toBe("complete");
      if (allocation.kind !== "complete") return;
      const { logicalStorage: _declarations, ...physical } = input;
      const reference = lowerMachineProgram({ ...physical, placement: allocation.placement });
      expect(reference.kind).toBe("complete");
      if (reference.kind !== "complete") return;
      // Demand projection deliberately changes inventory, not these selected operations.
      expect([
        lowered.program.functions,
        lowered.program.data,
        lowered.program.startup,
        lowered.program.c64Startup,
      ]).toEqual([
        reference.program.functions,
        reference.program.data,
        reference.program.startup,
        reference.program.c64Startup,
      ]);
    },
  );

  it("should preserve locals, staged conversions, nested calls and volatile word reads without homes", () => {
    const fixture = prepared(`module Game;
function add(first:word,second:word):word{return first+second;}
function work():word{
  let item:byte=7;let converted:word=word(item);
  let address:word=peekw($C112);
  return add(converted,add(peekw(address),word(item)));
}
function main():void{pokew($C100,work());}`);
    expect(
      fixture.inventory.requests.some((request) => request.id.includes(":argument-stage:")),
    ).toBe(true);
    expect(
      fixture.inventory.requests.some((request) =>
        request.id.includes(":temporary:word-read-low:"),
      ),
    ).toBe(true);
    const lowered = lowerMachineProgram(fixture.input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    const allocated = allocateStorage(
      fixture.inventory,
      buildInterference(fixture.inventory),
      fixture.input.profile.storage,
    );
    expect(allocated.kind).toBe("complete");
    if (allocated.kind !== "complete") return;
    const reference = lowerMachineProgram({
      ...fixture.input,
      logicalStorage: undefined,
      placement: allocated.placement,
    });
    expect(reference.kind).toBe("complete");
    if (reference.kind !== "complete") return;
    expect(lowered.program).toEqual(reference.program);
    const closed = closeStorage(fixture.inventory, fixture.input.profile.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  });

  it("should keep fresh local aggregate and caller-result identities without physical placement", () => {
    const fixture = prepared(`module Game;struct Pair{left:byte;right:byte;}
function pair():Pair{let item:Pair={left:7,right:9};return item;}
function main():void{let result:Pair=pair();poke($C100,result.left);poke($C101,result.right);}`);
    const lowered = lowerMachineProgram(fixture.input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    const instructions = lowered.program.functions.flatMap((fn) =>
      fn.blocks.flatMap((block) => block.instructions),
    );
    expect(
      instructions.some(
        (instruction) =>
          instruction.operand?.kind === "label" &&
          instruction.operand.label.startsWith("global.") &&
          instruction.operand.label !== "global.Game",
      ),
    ).toBe(false);
    const closed = closeStorage(fixture.inventory, fixture.input.profile.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  });

  it("should construct symbolic returned-pair lowering even when canonical pointer allocation rejects it", () => {
    const chain = Array.from(
      { length: 72 },
      (_, index) =>
        `function pair${index}():Pair{return ${index === 71 ? "{left:7,right:9}" : `pair${index + 1}()`};}`,
    ).join("\n");
    const fixture = prepared(`module Game;struct Pair{left:byte;right:byte;}\n${chain}
function main():void{let result:Pair=pair0();poke($C100,result.left);}`);
    const allocated = allocateStorage(
      fixture.inventory,
      buildInterference(fixture.inventory),
      fixture.input.profile.storage,
    );
    expect(allocated.kind).toBe("error");
    const lowered = lowerMachineProgram(fixture.input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    // This proves symbolic construction, not selected allocation or a public size build.
  });

  it("should reject missing or altered logical declarations instead of treating locals as globals", () => {
    const fixture = prepared(
      "module Game;function main():void{let value:byte=7;poke($C100,value);}",
    );
    expect(fixture.inventory.requests.length).toBeGreaterThan(0);
    const logicalStorage = { ...fixture.inventory, requests: [] };
    const lowered = lowerMachineProgram({ ...fixture.input, logicalStorage });
    expect(lowered).toMatchObject({
      kind: "error",
      reason: expect.stringContaining("logical storage"),
    });
  });

  it("should provide domain/root logical aliases without inventing any address or placement", () => {
    const fixture = prepared(
      "module Game;function main():void{let value:byte=7;poke($C100,value);}",
    );
    const original = fixture.inventory.requests[0]!;
    const root = "installation-root";
    const irq = domainStorageRequest(original, "irq", fixture.input.program, root);
    const inventory = { ...fixture.inventory, requests: [irq] };
    const aliased = provisionalDeclarationAliases(inventory, fixture.input.program, root);
    const alias = aliased.requests.find((request) => request.id === original.id);
    expect(alias).toMatchObject({ id: original.id, bytes: original.bytes, activationRoot: root });
    expect(alias).not.toHaveProperty("address");
    expect(alias?.lifetime).toBe(original.lifetime);
    expect(inventory.requests).toEqual([irq]);
    expect(
      provisionalDeclarationAliases(inventory, fixture.input.program, "other-root").requests.some(
        (request) => request.id === original.id,
      ),
    ).toBe(false);
  });
});

describe("explicit selected storage projection", () => {
  it("should close the seventy-two returned-pair chain through the selected inventory without canonical homes", () => {
    const chain = Array.from(
      { length: 72 },
      (_, index) =>
        `function pair${index}():Pair{return ${index === 71 ? "{left:7,right:9}" : `pair${index + 1}()`};}`,
    ).join("\n");
    const fixture = prepared(`module Game;struct Pair{left:byte;right:byte;}\n${chain}
function main():void{let result:Pair=pair0();poke($C100,result.left);poke($C101,result.right);}`);
    const input = withRecipes(fixture, "original", true);
    const lowered = lowerMachineProgram(input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(lowered.inventory).toBeDefined();
    expect(
      lowered.inventory.requests.some((request) =>
        request.id.endsWith(":pointer:aggregate-return-destination"),
      ),
    ).toBe(false);
    expect(lowered.inventory.results).toHaveLength(72);
    expect(lowered.inventory.results.every((row) => row.location.kind === "fixed-object")).toBe(
      true,
    );
    const closed = closeStorage(lowered.inventory, input.profile.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    expect(closed.certificate.staticBytes.zeroPage).toBe(0);
    expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
    expect(closeSharedStorage(lowered.program, lowered.binder, closed, input.profile).kind).toBe(
      "complete",
    );
  });

  it("should record fixed global results and parameter origins without dangling hidden-pointer result rows", () => {
    const fixture = prepared(`module Game;struct Pair{left:byte;right:byte;}
place(at:$3400)let answer:Pair;
function pair():Pair{return {left:7,right:9};}
function read(value:const Pair):byte{return value.left;}
function main():void{answer=pair();poke($C100,read(answer));}`);
    const input = withRecipes(fixture, "original", true);
    const lowered = lowerMachineProgram(input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    expect(lowered.inventory).toBeDefined();
    const object = input.program.semantic.globals.find(
      (global) => global.placement?.at === 0x3400,
    )!;
    expect(lowered.inventory.results[0]?.location).toEqual({
      kind: "fixed-object",
      objectBindingId: object.id,
      owner: null,
      bytes: 2,
      backingRequestId: null,
    });
    expect(
      lowered.inventory.requests.filter((request) => request.storageClass === "parameter"),
    ).toEqual([]);
    const closed = closeStorage(lowered.inventory, input.profile.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  });

  it.each(["low-byte", "x-first", "y-first", "flat-eight-x-first"] as const)(
    "should omit only the explicitly replaced counter under %s",
    (policy) => {
      const limit = policy.startsWith("flat-eight") ? 8 : 4;
      const fixture = prepared(`module Game;place(at:$3400)let answers:byte[8]=[;0];
function work():void{for(let row:word=0;row<${limit};row+=1){answers[row]=peek($C110);}}
function main():void{work();}`);
      const input = withRecipes(fixture, policy);
      const lowered = lowerMachineProgram(input);
      expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
      if (lowered.kind !== "complete") return;
      expect(lowered.inventory).toBeDefined();
      const counter = fixture.inventory.requests.find(
        (request) => request.storageClass === "local",
      )!;
      expect(lowered.inventory.requests.some((request) => request.id === counter.id)).toBe(false);
      expect(lowered.program.storageSelection?.omitted.map((request) => request.id)).toContain(
        counter.id,
      );
      const replacements = lowered.inventory.requests.filter((request) =>
        request.id.includes(":fixed-counter:"),
      );
      expect(replacements.map((request) => request.bytes)).toEqual(
        policy === "low-byte" ? [1] : [],
      );
      // Capture requests without their own elimination proof must stay inventoried.
      const untouched = lowered.program.storageSelection!.originalInventory.requests.filter(
        (request) => request.id !== counter.id,
      );
      expect(lowered.inventory.requests).toEqual(untouched);
      const closed = closeStorage(lowered.inventory, input.profile.storage, lowered.binder);
      expect(closed.kind).toBe("complete");
      if (closed.kind !== "complete") return;
      expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
    },
  );

  it("should remove a proved native capture without resurrecting it during discovery or deleting the variable", () => {
    const fixture = prepared(`module Game;place(at:$3400)let answers:byte[8]=[;0];
function work():void{let value:byte=120;for(let row:word=0;row<4;row+=1){asm_php();asm_plp();value+=120;answers[row]=value;}}
function main():void{work();}`);
    const input = withRecipes(fixture, "x-first");
    const lowered = lowerMachineProgram(input);
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    const proof = lowered.program.functions.flatMap((fn) => fn.nativeStoreProofs ?? [])[0]!;
    expect(proof).toBeDefined();
    expect(lowered.inventory).toBeDefined();
    expect(
      lowered.inventory.requests.some((request) => request.id === proof.captureRequestId),
    ).toBe(false);
    expect(
      lowered.program.requiredStorage.some((request) => request.id === proof.captureRequestId),
    ).toBe(false);
    expect(lowered.binder.candidateRequestIds).not.toContain(proof.captureRequestId);
    expect(
      lowered.inventory.requests.some((request) => request.id === proof.variableRequestId),
    ).toBe(true);
    const closed = closeStorage(lowered.inventory, input.profile.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    expect(closed.inventory.requests.some((request) => request.id === proof.captureRequestId)).toBe(
      false,
    );
    expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  });

  it.each(["operand", "effect", "address-byte", "indirect"] as const)(
    "should retain replaced demand with a surviving startup %s reference",
    (kind) => {
      const fixture = prepared(`module Game;place(at:$3400)let answers:byte[8]=[;0];
function main():void{for(let row:word=0;row<4;row+=1){answers[row]=peek($C110);}}`);
      const input = withRecipes(fixture, "x-first");
      const lowered = lowerMachineProgram(input);
      expect(lowered.kind).toBe("complete");
      if (lowered.kind !== "complete") return;
      const counter = fixture.inventory.requests.find(
        (request) => request.storageClass === "local",
      )!;
      const address = { kind: "storage" as const, requestId: counter.id };
      const instruction = machineInstruction(
        input.profile.cpu,
        "lda",
        "storage",
        kind === "indirect"
          ? { kind: "indirect-y", requestId: counter.id }
          : kind === "address-byte"
            ? { ...address, addressByte: "low" }
            : kind === "effect"
              ? null
              : address,
        kind === "effect" ? [{ kind: "read", address, width: 1, volatile: false, order: 0 }] : [],
        input.program.semantic.main.span,
      );
      const first = lowered.program.startup.blocks[0]!;
      const startup = {
        ...lowered.program.startup,
        blocks: [
          { ...first, instructions: [...first.instructions, instruction] },
          ...lowered.program.startup.blocks.slice(1),
        ],
      };
      const projection = projectMachineStorage(
        input,
        fixture.inventory,
        lowered.program.functions,
        startup,
        lowered.program.requiredStorage,
      );
      expect(projection.kind).toBe("complete");
      if (projection.kind !== "complete") return;
      expect(projection.inventory.requests.some((request) => request.id === counter.id)).toBe(true);
    },
  );
});

/** Close actual selected demand while keeping invalid-source errors distinct from allocation. */
function bindingClosure(text: string, direct = false, objects = false) {
  const fixture = prepared(text);
  const selected = withRecipes(fixture, "original", objects);
  const input = {
    ...selected,
    sourceFacts: {
      ...selected.sourceFacts,
      nonLoopBundle: direct ? ("direct" as const) : ("closed" as const),
    },
  };
  const lowered = lowerMachineProgram(input);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closed = closeStorage(lowered.inventory, input.profile.storage, lowered.binder);
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed));
  return { fixture, input, lowered, closed };
}

describe("covered private binding occupancy", () => {
  it("should exclude only proved dead covered bindings from an actual helper call", () => {
    const text = `module Game;function work():void{let retired:byte=peek($C110);poke($C100,retired);let left:byte=peek($C111);let right:byte=peek($C112);let product:byte=left*right;poke($C101,product);}function main():void{work();}`;
    const selected = bindingClosure(text),
      direct = bindingClosure(text, true);
    const named = (name: string) =>
      selected.lowered.inventory.requests.find(
        (request) =>
          request.binding !== null &&
          selected.input.bindingNames
            .get(bindingIdentityKey(request.binding))
            ?.split(".")
            .at(-1) === name,
      )!;
    const helper = selected.lowered.binder.helperCalls[0]!;
    expect(helper).toBeDefined();
    expect(named("retired")).toBeDefined();
    expect(helper.liveRequestIds).not.toContain(named("retired").id);
    expect(helper.liveRequestIds).toContain(named("left").id);
    expect(helper.liveRequestIds).toContain(named("right").id);
    const conservative = selected.lowered.inventory.requests.filter(
      (request) => request.binding === null && !helper.helperRequestIds.includes(request.id),
    );
    expect(conservative.every((request) => helper.liveRequestIds.includes(request.id))).toBe(true);
    expect(direct.lowered.binder.helperCalls[0]?.liveRequestIds).toContain(named("retired").id);
  });

  it("should validate lifetime seals against the original source after real zero-page reservation", () => {
    const fixture = prepared(`module Game;zeropage { shared:byte=7; }
function work():void{let item:byte=shared;poke($C100,item);}function main():void{work();}`);
    const input = withRecipes(fixture, "original");
    const reserved = reserveZeroPageGlobals(input.program, input.profile.storage);
    expect(reserved.kind).toBe("complete");
    if (reserved.kind !== "complete") return;
    const program = reserved.program;
    expect(program).not.toBe(input.sourceFacts.program);
    const lowered = lowerMachineProgram({
      ...input,
      program,
      profile: { ...input.profile, storage: reserved.storage },
      logicalStorage: inventoryStorage(program),
    });
    expect(lowered.kind, lowered.kind === "error" ? lowered.reason : undefined).toBe("complete");
    if (lowered.kind !== "complete") return;
    const closed = closeStorage(lowered.inventory, reserved.storage, lowered.binder);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") return;
    // SFA sees the reserved window; final global layout sees the full platform.
    expect(
      closeSharedStorage(lowered.program, lowered.binder, closed, fixture.input.profile).kind,
    ).toBe("complete");
  });

  it("should overlay disjoint bindings only in Closed while Direct retains canonical occupancy", () => {
    const text = `module Game;function work():void{
let first:byte=peek($C110);poke($C100,first);let second:byte=peek($C111);poke($C101,second);}
function main():void{work();}`;
    const selected = bindingClosure(text);
    const direct = bindingClosure(text, true);
    const locals = selected.lowered.inventory.requests.filter(
      (request) => request.storageClass === "local",
    );
    expect(locals).toHaveLength(2);
    expect(
      locals.every(
        (request) =>
          request.lifetime !==
          selected.fixture.inventory.requests.find((original) => original.id === request.id)
            ?.lifetime,
      ),
    ).toBe(true);
    const addresses = locals.map(
      (request) =>
        selected.closed.certificate.homes.find((home) => home.requestId === request.id)?.address,
    );
    expect(new Set(addresses).size).toBe(1);
    expect(selected.closed.certificate.staticBytes.ram).toBe(1);
    expect(direct.closed.certificate.staticBytes.ram).toBe(2);
  });

  it("should keep incoming parameter writes simultaneous and a later surviving dead store away from a live parameter", () => {
    const result = bindingClosure(`module Game;
function work(first:byte,second:byte):void{poke($C100,first);let dead:byte=0;poke($C101,second);}
function main():void{work(7,9);}`);
    const parameters = result.lowered.inventory.requests.filter(
      (request) => request.storageClass === "parameter",
    );
    expect(parameters).toHaveLength(2);
    const homes = parameters.map(
      (request) =>
        result.closed.certificate.homes.find((home) => home.requestId === request.id)?.address,
    );
    expect(new Set(homes).size).toBe(2);
    expect(
      parameters.every(
        (request) =>
          request.lifetime !==
          result.fixture.inventory.requests.find((original) => original.id === request.id)
            ?.lifetime,
      ),
    ).toBe(true);
    expect(result.closed.certificate.staticBytes.ram).toBe(2);
  });

  it("should reject altered supplied lifetime content before lowering can use it", () => {
    const fixture = prepared("module Game;function main():void{let item:byte=7;poke($C100,item);}");
    const input = withRecipes(fixture, "original");
    const fn = input.program.semantic.functions.find((entry) => entry.name === "Game.main")!;
    const facts = input.sourceFacts.functions.get(fn)!;
    const [key, lifetime] = [...facts.lifetimes][0]!;
    const functions = new Map(input.sourceFacts.functions);
    functions.set(fn, { ...facts, lifetimes: new Map([[key, { ...lifetime, liveAt: [] }]]) });
    const invalid = lowerMachineProgram({
      ...input,
      sourceFacts: { ...input.sourceFacts, functions },
    });
    expect(invalid.kind).toBe("error");
    if (invalid.kind === "error") expect(invalid.reason).toContain("facts");
  });

  it("should keep cross-owner fixed-object backing at its original conservative occupancy", () => {
    const result = bindingClosure(
      `module Game;
function use(value:const byte[2]):byte{return value[0];}
function work():void{let items:byte[2]=[7,9];let other:byte=3;poke($C100,use(items));poke($C101,other);}
function main():void{work();}`,
      false,
      true,
    );
    expect(
      [...result.input.sourceFacts.functions.values()].some(
        (facts) => (facts.storage?.parameters.size ?? 0) > 0,
      ),
    ).toBe(true);
    const original = result.fixture.inventory.requests.find(
      (request) => request.storageClass === "local" && request.type?.kind === "array",
    )!;
    expect(
      result.lowered.inventory.requests.find((request) => request.id === original.id)?.lifetime,
    ).toBe(original.lifetime);
  });
});
