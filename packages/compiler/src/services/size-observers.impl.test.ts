import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { lowerMachineProgram, validLoweringProvenance } from "../machine/lower.js";
import { createLoweringProducer } from "../machine/lowering-provenance.js";
import { validateMachineProgram } from "../machine/bind.js";
import {
  createC64InterruptEntry,
  createC64ReferenceInterruptEntry,
  RAW_HANDLER_ENTRY,
} from "../machine/lower-c64-interrupt.js";
import type { MachineFunction, MachineSourceFacts } from "../machine/machine-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import { deriveLocalStorageLifetimes } from "../semantic/local-storage-lifetimes.js";
import {
  collectSourceLoopNesting,
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
} from "../semantic/fixed-loop-facts.js";
import { inventoryStorage } from "../storage/inventory.js";
import { closeStorage } from "../storage/closure.js";
import { selectClosedObjectStorage } from "../storage/selection.js";
import { selectTargetProfile } from "../target/profile.js";
import { resourceSourceSpans } from "./resource-diagnostics.js";
import { closeCanonicalReference, closeCanonicalStorage } from "./size-selection.js";
import type { CheckedSourceInput } from "./size-selection.js";
import { closeSharedStorage } from "./shared-storage.js";
import { reserveZeroPageGlobals } from "./zero-page-globals.js";
import { validateSizeObservers } from "./size-observers.js";

/** Exercise the same immutable source and both real closure paths without filesystem fixtures. */
function selectedCandidate(
  text: string,
  axes: Pick<MachineSourceFacts, "nonLoopBundle" | "loopPolicy"> = {
    nonLoopBundle: "closed",
    loopPolicy: "original",
  },
) {
  const target = "c64-pal-prg-kernal-6581";
  const sha256 = createHash("sha256").update(text).digest("hex");
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "observer",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
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
    effectiveTarget: target,
    effectiveEntry: "Game",
  };
  const selected = selectTargetProfile(target);
  if (selected.kind !== "complete") throw new Error("Missing selected profile");
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
  const checked: CheckedSourceInput = {
    snapshot: { ...snapshot, ...analysis.inputs },
    profile: selected.profile,
    program,
    bindingNames: new Map(
      analysis.program.bindings.map((binding) => [
        bindingIdentityKey(binding.id),
        binding.qualifiedName ?? binding.name,
      ]),
    ),
    resourceSpans: resourceSourceSpans(analysis.program),
    diagnostics: [],
    sourceText: (span) => {
      const source = analysis.inputs.sources.find((entry) => entry.sourceId === span.sourceId);
      return source === undefined
        ? ""
        : Buffer.from(source.text).subarray(span.start, span.end).toString();
    },
  };
  const loops = deriveFixedLoopFacts(program, collectSourceLoopNesting(program, analysis.program));
  const objects = deriveClosedObjectFacts(
    program,
    selected.profile.storage,
    fixedLoopValueBounds(program, loops),
  );
  const lifetimes = deriveLocalStorageLifetimes(program);
  const selections = selectClosedObjectStorage(objects);
  const sourceFacts = {
    program,
    ...axes,
    functions: new Map(
      program.semantic.functions.map((fn) => [
        fn,
        {
          function: fn,
          objects,
          loops: loops.filter((loop) => loop.function === fn),
          lifetimes: new Map([...lifetimes].filter(([, life]) => life.function === fn.id)),
          ...(selections.has(fn) ? { storage: selections.get(fn)! } : {}),
        },
      ]),
    ),
  };
  const reserved = reserveZeroPageGlobals(program, selected.profile.storage);
  if (reserved.kind !== "complete") throw new Error("Invalid zero-page fixture");
  const allocationProfile = {
    ...selected.profile,
    storage: { ...reserved.storage, profileId: selected.profile.id },
  };
  const lowered = lowerMachineProgram({
    program: reserved.program,
    profile: allocationProfile,
    logicalStorage: inventoryStorage(reserved.program),
    sourceFacts,
    bindingNames: checked.bindingNames,
    boundsCheck: true,
    divisionZeroCheck: true,
  });
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const storage = closeStorage(lowered.inventory, allocationProfile.storage, lowered.binder);
  if (storage.kind !== "complete") throw new Error(JSON.stringify(storage));
  const shared = closeSharedStorage(lowered.program, lowered.binder, storage, selected.profile);
  if (shared.kind !== "complete") throw new Error(JSON.stringify(shared));
  const direct = closeCanonicalStorage(checked);
  if (direct.kind === "failure") throw new Error(JSON.stringify(direct.failure));
  const reference = direct.kind === "complete" ? closeCanonicalReference(direct.value) : direct;
  if (reference.kind === "failure") throw new Error(JSON.stringify(reference.failure));
  return { checked, reference, candidate: { lowered, shared }, sourceFacts };
}

/** Return forwarding creates a real stack route and, at 72 functions, a rejected canonical SFA. */
function returnedCandidate(count = 2) {
  const functions = Array.from({ length: count }, (_, index) => {
    const value = index === 0 ? "{a:7,b:9}" : `f${index - 1}()`;
    return `function f${index}():Pair{return ${value};}`;
  }).join("");
  return selectedCandidate(`module Game;struct Pair{a:byte;b:byte;}let answer:Pair;
${functions}function main():void{answer=f${count - 1}();}`);
}

describe("selected source execution provenance", () => {
  it.each(["IRQ", "NMI"])(
    "should retain executed %s wrapper provenance through final layout without changing code",
    (sink) => {
      const fixture =
        selectedCandidate(`module Game;import {set${sink},restore${sink}} from c64.system;
interrupt function handler():void{}
function main():void{set${sink}(&handler);restore${sink}();}`);
      const source = fixture.checked.program.semantic.functions.find(
        (fn) => fixture.checked.bindingNames.get(bindingIdentityKey(fn.id)) === "Game.handler",
      )!;
      expect(fixture.reference.kind).toBe("feasible");
      if (fixture.reference.kind !== "feasible") throw new Error("Expected reference");
      for (const [actual, reference] of [
        [fixture.candidate.lowered.program, fixture.reference.checked.lowered.program],
        [fixture.candidate.shared.machine.program, fixture.reference.shared.machine.program],
        [fixture.candidate.shared.layout.program, fixture.reference.shared.layout.program],
      ]) {
        const entries = actual!.functions.filter((fn) => fn.sourceFunction === source.id);
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of entries) {
          expect(entry.executionContext?.domain).toBe(sink.toLowerCase());
          expect(Object.isFrozen(entry.executionContext)).toBe(true);
          const unchanged = reference!.functions.find((fn) => fn.id === entry.id)!;
          expect(unchanged).toBeDefined();
          expect(entry.blocks).toEqual(unchanged.blocks);
          expect(entry.origin).toBe(unchanged.origin);
          expect(entry.nmiEntryStackBytes).toBe(unchanged.nmiEntryStackBytes);
          expect(entry.nmiPublicationEntry).toBe(unchanged.nmiPublicationEntry);
        }
      }
      expect(fixture.candidate.shared.certificate.certificate.homes).toEqual(
        fixture.reference.shared.certificate.certificate.homes,
      );
      expect(fixture.candidate.shared.certificate.certificate.hardwareStackPeak).toBe(
        fixture.reference.shared.certificate.certificate.hardwareStackPeak,
      );
    },
  );

  it("should preserve only supplied raw-body association and leave reference-only shells context-free", () => {
    const fixture = selectedCandidate(`module Game;import {setIRQ,restoreIRQ} from c64.system;
interrupt function handler():void{}
function main():void{setIRQ(&handler);restoreIRQ();}`);
    const source = fixture.checked.program.semantic.functions.find(
      (fn) => fixture.checked.bindingNames.get(bindingIdentityKey(fn.id)) === "Game.handler",
    )!;
    const body: MachineFunction = {
      id: "body",
      sourceFunction: source.id,
      sourceName: "display-only",
      blocks: [{ label: "body.entry", instructions: [], terminator: { kind: "return" } }],
    };
    const context = Object.freeze({ domain: "main" as const, irq: 0, nmi: 0 });
    const original = createC64InterruptEntry(
      body,
      "raw",
      RAW_HANDLER_ENTRY,
      null,
      fixture.checked.profile,
    );
    const selected = createC64InterruptEntry(
      { ...body, executionContext: context },
      "raw",
      RAW_HANDLER_ENTRY,
      null,
      fixture.checked.profile,
    );
    expect(selected.sourceFunction).toBe(source.id);
    expect(selected.executionContext).toBe(context);
    expect(selected.blocks).toEqual(original.blocks);
    expect(Object.hasOwn(selected, "sourceName")).toBe(false);
    expect(Object.hasOwn(original, "sourceFunction")).toBe(false);
    expect(Object.hasOwn(original, "executionContext")).toBe(false);
    const variant = fixture.checked.program.interruptRoutes![0]!.variant;
    const shell = createC64ReferenceInterruptEntry(
      source,
      "reference",
      variant,
      "link",
      fixture.checked.profile,
    );
    const selectedShell = createC64ReferenceInterruptEntry(
      source,
      "reference",
      variant,
      "link",
      fixture.checked.profile,
      true,
    );
    expect(selectedShell.sourceFunction).toBe(source.id);
    expect(Object.hasOwn(selectedShell, "executionContext")).toBe(false);
    expect(Object.hasOwn(shell, "sourceFunction")).toBe(false);
    expect(selectedShell.blocks).toEqual(shell.blocks);
  });

  it.each([{ nonLoopBundle: "closed" }, { loopPolicy: "original" }, {}] as const)(
    "should retain raw and reference-only identities only for explicit axes %j",
    (axes) => {
      const fixture = selectedCandidate(
        `module Game;import {setNMI,restoreNMI,setIRQ,restoreIRQ} from c64.system;
interrupt function B():void{} interrupt function Q():void{}
function main():void{setNMI(&B);asm_php();asm_sei();asm_nop();setIRQ(&Q);
pokew($C010,word(&Q));restoreIRQ();asm_plp();restoreNMI();}`,
        axes,
      );
      const source = fixture.checked.program.semantic.functions.find(
        (fn) => fixture.checked.bindingNames.get(bindingIdentityKey(fn.id)) === "Game.Q",
      )!;
      const explicit = Object.keys(axes).length > 0;
      const before = fixture.checked.program.interruptContextAnalysis;
      expect(before).toBeDefined();
      expect(before?.contexts.get(bindingIdentityKey(source.id)) ?? []).toEqual([]);
      for (const program of [
        fixture.candidate.lowered.program,
        fixture.candidate.shared.machine.program,
        fixture.candidate.shared.layout.program,
      ]) {
        const entries = program.functions.filter((fn) => fn.sourceFunction === source.id);
        expect(entries).toHaveLength(explicit ? 2 : 0);
        if (explicit) {
          expect(entries.filter((fn) => fn.executionContext !== undefined)).toHaveLength(1);
          expect(entries.filter((fn) => !Object.hasOwn(fn, "executionContext"))).toHaveLength(1);
        }
      }
      expect(fixture.checked.program.interruptContextAnalysis).toBe(before);
      expect(before?.contexts.get(bindingIdentityKey(source.id)) ?? []).toEqual([]);
    },
  );

  it("should retain actual main and IRQ contexts through binding and final placement", () => {
    const fixture = selectedCandidate(`module Game;import {setIRQ,restoreIRQ} from c64.system;
function shared():void{poke($C100,peek($C110));}
interrupt function handler():void{shared();}
function main():void{setIRQ(&handler);shared();restoreIRQ();}`);
    const source = fixture.checked.program.semantic.functions.find(
      (fn) => fixture.checked.bindingNames.get(bindingIdentityKey(fn.id)) === "Game.shared",
    );
    expect(source).toBeDefined();
    expect(fixture.reference.kind).toBe("feasible");
    if (fixture.reference.kind !== "feasible") throw new Error("Expected a canonical reference");
    expect(
      fixture.reference.shared.layout.program.functions.every(
        (fn) => !Object.hasOwn(fn, "executionContext"),
      ),
    ).toBe(true);
    for (const program of [
      fixture.candidate.lowered.program,
      fixture.candidate.shared.machine.program,
      fixture.candidate.shared.layout.program,
    ]) {
      const functions = program.functions.filter((fn) => fn.sourceFunction === source!.id);
      expect(functions).toHaveLength(2);
      expect(functions.map((fn) => fn.executionContext?.domain).sort()).toEqual(["irq", "main"]);
      expect(functions.every((fn) => Object.isFrozen(fn.executionContext))).toBe(true);
    }
  });
});

describe("closed typed-storage observer outcomes", () => {
  it.each(["empty", "comparison", "long"])(
    "should close the register-only Boolean call (%s)",
    (kind) => {
      const compare = kind === "comparison",
        long = kind === "long";
      const text = `module Game;let value:byte=3;let answer:byte;
function predicate():boolean{return value!=0;}
${compare ? "function choose():byte{if(!predicate()){return 7;}return 9;}" : ""}
function main():void{${compare ? "answer=choose();" : `if(predicate()){answer=7;${long ? "answer=7;".repeat(60) : ""}}else{answer=9;${long ? "answer=9;".repeat(60) : ""}}`}}`;
      const fixture = selectedCandidate(text);
      const proofs = fixture.candidate.lowered.program.functions.flatMap(
        (fn) => fn.booleanCallProofs ?? [],
      );
      expect(proofs).toHaveLength(1);
      expect(proofs[0]?.kind).toBe("certified");
      expect(proofs[0]?.added).toEqual([]);
      expect(proofs[0]?.removed.map(({ opcode }) => opcode)).toEqual(compare ? ["cmp"] : []);
      expect(
        fixture.candidate.shared.layout.program.functions.some((fn) =>
          fn.blocks.some((block) => block.terminator.kind === "long-branch"),
        ),
      ).toBe(long);
      expect(validateSizeObservers(fixture).kind).toBe("complete");
      if (fixture.reference.kind !== "feasible") throw new Error("Expected actual reference");
      expect(
        validateSizeObservers({
          ...fixture,
          candidate: {
            lowered: fixture.reference.checked.lowered,
            shared: fixture.reference.shared,
          },
        }).kind,
      ).toBe("complete");
      const functions = fixture.candidate.shared.layout.program.functions.map((fn) => ({
        ...fn,
        blocks: fn.blocks.map((block) => ({ ...block, instructions: [] })),
      }));
      const shared = {
        ...fixture.candidate.shared,
        layout: {
          ...fixture.candidate.shared.layout,
          program: { ...fixture.candidate.shared.layout.program, functions },
        },
      };
      expect(
        validateSizeObservers({ ...fixture, candidate: { ...fixture.candidate, shared } }).kind,
      ).toBe("error");
    },
  );

  it.each([
    "asm_php();asm_plp();return value!=0;",
    "poke($C100,value);return value!=0;",
    "poke($D020,value);return value!=0;",
  ])("should retain stronger Boolean observation barriers for %s", (body) => {
    const fixture =
      selectedCandidate(`module Game;let value:byte=3;let other:byte=1;let answer:byte;
function predicate():boolean{${body}}
function main():void{if(predicate()){answer=7;}else{answer=9;}}`);
    expect(validateSizeObservers(fixture).kind).toBe("rejected");
  });

  it("should reject zeroed stack totals even when inventory and arithmetic stay consistent", () => {
    const fixture = returnedCandidate();
    const actual = fixture.candidate.shared.certificate;
    expect(actual.certificate.hardwareStackPeak).toBe(5);
    const certificate = {
      ...actual.certificate,
      hardwareStackPeak: 0,
      hardwareStackProgramPeak: 0,
      hardwareStackSystemPeak: 0,
    };
    const shared = { ...fixture.candidate.shared, certificate: { ...actual, certificate } };
    expect(
      validateSizeObservers({ ...fixture, candidate: { ...fixture.candidate, shared } }).kind,
    ).toBe("error");
  });

  it("should reject donor closure members and changed final machine bytes", () => {
    const fixture = returnedCandidate();
    const donor = returnedCandidate(3);
    const actual = fixture.candidate.shared;
    for (const shared of [
      { ...actual, certificate: donor.candidate.shared.certificate },
      { ...actual, machine: donor.candidate.shared.machine },
      { ...actual, layout: donor.candidate.shared.layout },
    ])
      expect(
        validateSizeObservers({ ...fixture, candidate: { ...fixture.candidate, shared } }).kind,
      ).toBe("error");
    const functions = actual.layout.program.functions.map((fn) => ({
      ...fn,
      blocks: fn.blocks.map((block) => ({
        ...block,
        instructions: block.instructions.map((instruction) =>
          instruction.opcode === "sta" && instruction.operand?.kind === "label"
            ? {
                ...instruction,
                operand: { ...instruction.operand, offset: (instruction.operand.offset ?? 0) + 1 },
                memory: instruction.memory.map((effect) => ({
                  ...effect,
                  address:
                    effect.address.kind === "symbolic"
                      ? { ...effect.address, offset: (effect.address.offset ?? 0) + 1 }
                      : effect.address.kind === "absolute"
                        ? { ...effect.address, value: effect.address.value + 1 }
                        : effect.address,
                })),
              }
            : instruction,
        ),
      })),
    }));
    const program = { ...actual.layout.program, functions };
    expect(validateMachineProgram(program)).toBe(true);
    const shared = { ...actual, layout: { ...actual.layout, program } };
    expect(
      validateSizeObservers({ ...fixture, candidate: { ...fixture.candidate, shared } }).kind,
    ).toBe("error");
  });

  it("should reject binder changes made before another successful shared closure", () => {
    const fixture = returnedCandidate();
    const { lowered, shared: before } = fixture.candidate;
    const binder = { ...lowered.binder, startupStack: { heldBytes: 0, transientPeakBytes: 2 } };
    const shared = closeSharedStorage(
      lowered.program,
      binder,
      before.certificate,
      fixture.checked.profile,
    );
    expect(shared.kind).toBe("complete");
    if (shared.kind !== "complete") throw new Error("Expected geometric closure");
    expect(
      validLoweringProvenance(lowered.program, binder, lowered.inventory, fixture.checked.profile),
    ).toBe(false);
    expect(
      validateSizeObservers({ ...fixture, candidate: { lowered: { ...lowered, binder }, shared } })
        .kind,
    ).toBe("error");
  });

  it("should reject closure performed under a temporarily substituted allocation window", () => {
    const fixture = selectedCandidate(
      "module Game;struct Pair{a:byte;b:byte;}let left:Pair;let right:Pair;function make():Pair{return {a:7,b:9};}function main():void{left=make();right=make();}",
    );
    const { lowered } = fixture.candidate;
    const profile = lowered.program.storageProfile;
    if (profile === undefined) throw new Error("Expected actual allocation profile");
    const original = profile.zeroPage;
    let shared: ReturnType<typeof closeSharedStorage> | undefined;
    try {
      expect(Reflect.set(profile, "zeroPage", [{ start: 0x90, end: 0xff }])).toBe(true);
      const provisional = closeStorage(lowered.inventory, profile, lowered.binder);
      expect(provisional.kind).toBe("complete");
      if (provisional.kind !== "complete") throw new Error("Expected temporary geometric SFA");
      shared = closeSharedStorage(
        lowered.program,
        lowered.binder,
        provisional,
        fixture.checked.profile,
      );
    } finally {
      expect(Reflect.set(profile, "zeroPage", original)).toBe(true);
    }
    expect(shared?.kind).toBe("complete");
    if (shared?.kind !== "complete") throw new Error("Expected actual temporary closure");
    expect(
      shared.certificate.certificate.homes.some(
        (home) => home.region === "zero-page" && home.address >= 0x90,
      ),
    ).toBe(true);
    expect(validateSizeObservers({ ...fixture, candidate: { lowered, shared } }).kind).toBe(
      "error",
    );
  });

  it("should reject receipts created by an unrelated producer factory", () => {
    const fixture = returnedCandidate();
    const other = createLoweringProducer(() => fixture.candidate.lowered);
    const fake = other.produce({
      program: fixture.candidate.lowered.inventory.program,
      logicalStorage: fixture.candidate.lowered.inventory,
      profile: fixture.checked.profile,
    });
    expect(fake.kind).toBe("complete");
    if (fake.kind !== "complete") throw new Error("Expected foreign producer result");
    expect(
      validLoweringProvenance(fake.program, fake.binder, fake.inventory, fixture.checked.profile),
    ).toBe(false);
  });

  it("should detect same-size site substitutions and restored genuine membership", () => {
    const fixture = returnedCandidate();
    const { lowered } = fixture.candidate;
    const sites = lowered.binder.instructionSites;
    if (!(sites instanceof Set)) throw new Error("Expected actual producer site Set");
    const original = [...sites];
    expect(original.length).toBeGreaterThan(0);
    const replacement = { ...original[0]! };
    sites.delete(original[0]!);
    sites.add(replacement);
    expect(sites.size).toBe(original.length);
    expect(validateSizeObservers(fixture).kind).toBe("error");
    sites.clear();
    for (const site of original) sites.add(site);
    expect(validateSizeObservers(fixture).kind).toBe("complete");
  });

  it("should detect same-size source-fact Map substitutions and restored original records", () => {
    const fixture = returnedCandidate();
    const [fn, packet] = [...fixture.sourceFacts.functions][0]!;
    const count = fixture.sourceFacts.functions.size;
    fixture.sourceFacts.functions.set(fn, { ...packet });
    expect(fixture.sourceFacts.functions.size).toBe(count);
    expect(validateSizeObservers(fixture).kind).toBe("error");
    fixture.sourceFacts.functions.set(fn, packet);
    expect(validateSizeObservers(fixture).kind).toBe("complete");
  });

  it("should reject every cloned finite binder demand family before closure", () => {
    const fixture = returnedCandidate();
    const { lowered } = fixture.candidate;
    const caller = fixture.checked.program.semantic.main;
    for (const binder of [
      {
        ...lowered.binder,
        candidateRequestIds: [...lowered.binder.candidateRequestIds, "unselected"],
      },
      {
        ...lowered.binder,
        helperCalls: [
          ...lowered.binder.helperCalls,
          { id: "unselected", caller, liveRequestIds: [], helperRequestIds: [], stackBytes: 2 },
        ],
      },
      {
        ...lowered.binder,
        nmiEntries: [{ id: "unselected", handler: caller, contexts: [], entryStackBytes: 3 }],
      },
    ])
      expect(
        validLoweringProvenance(
          lowered.program,
          binder,
          lowered.inventory,
          fixture.checked.profile,
        ),
      ).toBe(false);
  });

  it("should prevent or detect actual nested operand and data mutation", () => {
    const fixture = returnedCandidate();
    const program = fixture.candidate.shared.layout.program;
    const operand = program.functions
      .flatMap((fn) => fn.blocks.flatMap((block) => block.instructions))
      .find((instruction) => instruction.operand?.kind === "immediate")?.operand;
    if (operand?.kind !== "immediate") throw new Error("Expected actual immediate operand");
    const value = operand.value;
    if (Reflect.set(operand, "value", value ^ 1)) {
      expect(validateSizeObservers(fixture).kind).toBe("error");
      expect(Reflect.set(operand, "value", value)).toBe(true);
    } else expect(Object.isFrozen(operand)).toBe(true);
    const bytes = program.data.find((object) => object.bytes.length > 0)!.bytes;
    const original = bytes[0]!;
    if (Reflect.set(bytes, "0", original ^ 1)) {
      expect(validateSizeObservers(fixture).kind).toBe("error");
      expect(Reflect.set(bytes, "0", original)).toBe(true);
    } else expect(Object.isFrozen(bytes)).toBe(true);
    expect(validateSizeObservers(fixture).kind).toBe("complete");
  });

  it("should reject copied receipt properties on a changed root", () => {
    const fixture = returnedCandidate();
    const original = fixture.candidate.shared;
    const copy = { ...original };
    for (const symbol of Object.getOwnPropertySymbols(original)) {
      const descriptor = Object.getOwnPropertyDescriptor(original, symbol);
      if (descriptor !== undefined) Object.defineProperty(copy, symbol, descriptor);
    }
    expect(
      validateSizeObservers({ ...fixture, candidate: { ...fixture.candidate, shared: copy } }).kind,
    ).toBe("error");
    expect(validateSizeObservers({ ...fixture, candidate: { ...fixture.candidate } }).kind).toBe(
      "complete",
    );
  });

  it("should reject actual startup return code/state hidden by restoring BASIC banking", () => {
    const count = 1180;
    const declarations = Array.from(
      { length: count },
      (_, index) => `function f${index}():void{answer+=1;}`,
    ).join("");
    const calls = Array.from({ length: count }, (_, index) => `f${index}();`).join("");
    const fixture = selectedCandidate(
      `module Game;let answer:word;${declarations}function main():void{${calls}}`,
    );
    const block = fixture.candidate.shared.layout.program.startup.blocks.find(
      (block) => block.label === "startup.restore",
    );
    expect(block?.origin).toBe(0xa057);
    expect(
      fixture.candidate.shared.layout.intervals.find(
        (interval) => interval.id === "platform.startup-state",
      ),
    ).toMatchObject({ start: 0xa073, end: 0xa075 });
    expect(validateSizeObservers(fixture).kind).toBe("rejected");
    if (fixture.reference.kind !== "feasible") throw new Error("Expected genuine canonical layout");
    const candidate = {
      lowered: fixture.reference.checked.lowered,
      shared: fixture.reference.shared,
    };
    expect(validateSizeObservers({ ...fixture, candidate }).kind).toBe("rejected");
  }, 120_000);

  it.each([2, 72])(
    "should prove a %i-function returned object with its actual reference outcome",
    (count) => {
      const fixture = returnedCandidate(count);
      expect(fixture.reference.kind).toBe(count === 72 ? "resource-rejected" : "feasible");
      const result = validateSizeObservers(fixture);
      expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
      if (result.kind === "complete") expect(result.candidate).toBe(fixture.candidate);
      const certificate = {
        ...fixture.candidate.shared.certificate.certificate,
        inventoryHash: "stale",
      };
      const shared = {
        ...fixture.candidate.shared,
        certificate: { ...fixture.candidate.shared.certificate, certificate },
      };
      expect(
        validateSizeObservers({ ...fixture, candidate: { ...fixture.candidate, shared } }).kind,
      ).toBe("error");
    },
  );

  it("should reject an unknown raw observer without removing the feasible canonical result", () => {
    const fixture = selectedCandidate(
      "module Game;let answer:byte;function main():void{answer=peek(peekw($C110));}",
    );
    expect(validateSizeObservers(fixture).kind).toBe("rejected");
    expect(fixture.reference.kind).toBe("feasible");
    if (fixture.reference.kind !== "feasible") throw new Error("Expected reference");
    const candidate = {
      lowered: fixture.reference.checked.lowered,
      shared: fixture.reference.shared,
    };
    expect(validateSizeObservers({ ...fixture, candidate })).toMatchObject({
      kind: "complete",
      candidate,
    });
  });
});
