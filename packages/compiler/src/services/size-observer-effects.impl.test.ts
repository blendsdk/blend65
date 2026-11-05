import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { deriveFixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import {
  byteContinuationQuery,
  BYTE_WINDOW_CHANGED,
  machineInstruction,
} from "../machine/lower-control.js";
import { validSharedStorageProvenance } from "./shared-storage.js";
import {
  rawAccessFootprint,
  valueDefinitions,
  literalResolver,
} from "../semantic/aggregate-place-proof.js";
import type { MachineProgram } from "../machine/machine-types.js";
import { bindMachineProgram } from "../machine/bind.js";
import { selectTargetProfile } from "../target/profile.js";
import { validateSizeObservers } from "./size-observers.js";

/** Selected, bound and final access origins must all retain the same original operation nodes. */
function instructions(program: MachineProgram) {
  return program.functions.flatMap((fn) => fn.blocks.flatMap((block) => block.instructions));
}

/** Compare actual target operations, not observer-only proof data. */
function executable(program: MachineProgram) {
  return [program.startup, ...program.functions].map((fn) => ({
    id: fn.id,
    origin: fn.origin,
    blocks: fn.blocks.map((block) => ({
      label: block.label,
      origin: block.origin,
      instructions: block.instructions.map(
        ({ opcode, mode, operand, uses, defines, cost, memory, source, sourceIteration }) => ({
          opcode,
          mode,
          operand,
          uses,
          defines,
          cost,
          memory,
          source,
          sourceIteration,
        }),
      ),
      terminator: block.terminator,
    })),
  }));
}

/** Compare source-function instruction shape without physical layout addresses. */
function codeShape(program: MachineProgram) {
  return program.functions.map((fn) => ({
    id: fn.id,
    blocks: fn.blocks.map((block) => ({
      label: block.label,
      instructions: block.instructions.map((instruction) => ({
        opcode: instruction.opcode,
        uses: instruction.uses,
        defines: instruction.defines,
        memory: instruction.memory.map((effect) => ({
          kind: effect.kind,
          width: effect.width,
          volatile: effect.volatile,
          addressKind: effect.address.kind,
        })),
      })),
      terminator: block.terminator.kind,
    })),
  }));
}

describe("source-associated raw and platform access evidence", () => {
  it("should bind new access-bound Maps into the existing producer evidence", () => {
    const fixture = effectFixture(
      "module Game;let data:byte[8];function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110);}}",
      "size",
      true,
      "x-first",
    );
    const { lowered, shared } = fixture.candidate;
    const bounds = instructions(shared.layout.program)
      .flatMap((instruction) => instruction.observerOrigins ?? [])
      .find((origin) => (origin.indexBounds?.size ?? 0) > 0)?.indexBounds;
    if (!(bounds instanceof Map)) throw new Error("Expected the actual source-bound Map");
    const [key, maximum] = [...bounds][0]!;
    expect(
      validSharedStorageProvenance(
        lowered.program,
        lowered.binder,
        shared,
        fixture.checked.profile,
      ),
    ).toBe(true);
    try {
      bounds.set(key, maximum + 1n);
      expect(
        validSharedStorageProvenance(
          lowered.program,
          lowered.binder,
          shared,
          fixture.checked.profile,
        ),
      ).toBe(false);
    } finally {
      bounds.set(key, maximum);
    }
    expect(
      validSharedStorageProvenance(
        lowered.program,
        lowered.binder,
        shared,
        fixture.checked.profile,
      ),
    ).toBe(true);
  });

  it.each(["x-first", "y-first"] as const)(
    "should retain the consumed native index views for %s",
    (policy) => {
      const fixture = effectFixture(
        "module Game;let data:byte[8];function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110);}}",
        "size",
        true,
        policy,
      );
      const fn = fixture.candidate.lowered.program.functions.find(
        (fn) => fn.fixedCounterProofs !== undefined,
      )!;
      const proof = fn.fixedCounterProofs![0]!;
      expect(proof.representation).toBe(policy === "x-first" ? "x" : "y");
      expect(proof.indexUses?.length).toBeGreaterThan(0);
      for (const view of proof.indexUses ?? []) {
        expect(
          proof.loop.function.blocks.some((block) => block.operations.includes(view.consumer)),
        ).toBe(true);
        const access = fn.blocks
          .flatMap((block) => block.instructions)
          .flatMap((instruction) => instruction.observerOrigins ?? [])
          .find((origin) => origin.kind === "typed" && origin.operation === view.consumer);
        expect(access?.indexRegister).toBe(proof.representation);
      }
    },
  );

  it("should preserve all eight connected raw/typed occurrences after expansion", () => {
    const fixture = effectFixture(
      "module Game;let data:byte[8];function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110);}}",
      "size",
      true,
      "flat-eight-x-first",
    );
    const fn = fixture.candidate.lowered.program.functions.find(
      (fn) => fn.fixedLoopProofs !== undefined,
    )!;
    const proof = fn.fixedLoopProofs![0]!;
    expect(proof.occurrences.map((entry) => entry.iteration)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const occurrence of proof.occurrences) {
      const blocks = occurrence.blocks.map(
        (label) => fn.blocks.find((block) => block.label === label)!,
      );
      const selected = blocks.flatMap((block) => block.instructions);
      const raw = selected.filter((instruction) =>
        instruction.observerOrigins?.some((origin) => origin.kind === "raw" && origin.byte === 0),
      );
      const typed = selected.filter((instruction) =>
        instruction.observerOrigins?.some((origin) => origin.kind === "typed" && origin.byte === 0),
      );
      expect(raw).toHaveLength(1);
      expect(typed).toHaveLength(1);
      expect(
        [...raw, ...typed].every(
          (instruction) => instruction.sourceIteration === occurrence.iteration,
        ),
      ).toBe(true);
      if (occurrence.iteration < 7) {
        const target = proof.occurrences[occurrence.iteration + 1]!.blocks[0]!;
        const terminal = blocks.at(-1)!.terminator;
        expect(
          terminal.kind === "jump" || terminal.kind === "fallthrough" ? terminal.target : null,
        ).toBe(target);
      }
    }
  });

  it("should retain the actual non-code complement recipe rather than its shared span", () => {
    const fixture = effectFixture(
      `module Game;struct Cell{pad:word;value:byte;}
let cell:Cell={pad:0,value:7};let left:byte=5;let answers:byte[8];
function work(p:const Cell):void{let inverse:byte=~p.value;for(let i:word=0;i<8;i+=1){answers[i]=left&~inverse;}}
function main():void{work(cell);}`,
      "size",
      true,
      "original",
    );
    const proofs = fixture.candidate.lowered.program.functions.flatMap(
      (fn) => fn.byteComplementProofs ?? [],
    );
    expect(proofs.length).toBeGreaterThan(0);
    const facts = fixture.candidate.lowered.program.storageSelection!.sourceFacts;
    for (const proof of proofs) {
      expect(proof.selection).toBeDefined();
      const [operation, recipe] = proof.selection!;
      const owner = fixture.checked.program.semantic.functions.find(
        (fn) => fn.id === proof.function,
      )!;
      expect(facts.functions.get(owner)?.complements?.replacements.get(operation)).toBe(recipe);
    }
  });

  it("should retain source-block associations even when an induction loop remains Original", () => {
    const fixture = effectFixture(
      "module Game;let data:byte[8];function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}}",
      "size",
      true,
      "original",
    );
    const source = fixture.checked.program.semantic.functions.find(
      (fn) => fixture.checked.bindingNames.get(bindingIdentityKey(fn.id)) === "Game.main",
    )!;
    for (const program of [
      fixture.candidate.lowered.program,
      fixture.candidate.shared.machine.program,
      fixture.candidate.shared.layout.program,
    ]) {
      const fn = program.functions.find((fn) => fn.sourceFunction === source.id)!;
      expect(fn.observerBlocks?.length).toBeGreaterThan(0);
      for (const [block, labels] of fn.observerBlocks ?? []) {
        expect(source.blocks).toContain(block);
        expect(labels.every((label) => fn.blocks.some((actual) => actual.label === label))).toBe(
          true,
        );
      }
    }
  });

  it("should retain a proved raw base instead of widening it to zero", () => {
    const fixture = effectFixture(
      "module Game;function main():void{for(let i:word=0;i<8;i+=1){poke($C100,peek($C110+i));}}",
    );
    const [loop] = deriveFixedLoopFacts(fixture.checked.program);
    expect(loop).toBeDefined();
    const read = loop!.body.operations.find((operation) => operation.kind === "memory-read")!;
    if (read.kind !== "memory-read") throw new Error("Expected original read");
    const definitions = valueDefinitions(loop!.function.blocks);
    expect(
      rawAccessFootprint(read, definitions, literalResolver(definitions), (value) =>
        loop!.valueBounds.get(value),
      ),
    ).toEqual([{ start: 0xc110, end: 0xc117 }]);
  });

  it("should check a changed Y use before its definition in the existing bounded prefix", () => {
    const cpu = selectTargetProfile("c64-pal-prg-kernal-6581");
    if (cpu.kind !== "complete") throw new Error("Expected target");
    const store = machineInstruction(cpu.profile.cpu, "sty", "absolute", {
      kind: "absolute",
      value: 0xc100,
    });
    const load = machineInstruction(cpu.profile.cpu, "ldy", "immediate", {
      kind: "immediate",
      value: 7,
    });
    const query = (selected: readonly (typeof store)[]) =>
      byteContinuationQuery(
        new Map([
          [
            "entry",
            {
              label: "entry",
              instructions: selected,
              terminator: { kind: "return" as const },
            },
          ],
        ]),
        { registers: [], flags: [] },
      )("entry", 0, BYTE_WINDOW_CHANGED.y);
    expect(query([store])).toBe(false);
    expect(query([load, store])).toBe(true);
  });

  it("should distinguish typed object accesses from their borrowed pointer homes", () => {
    const source = `module Game;let data:byte[8]=[;7];
function read(p:const byte[8],i:byte):byte{return p[i&7];}
function main():void{data[peek($C111)&7]=peek($C112);poke($C100,read(data,peek($C110)));}`;
    const fixture = effectFixture(source);
    const typed = fixture.checked.program.semantic.functions
      .flatMap((fn) => fn.blocks.flatMap((block) => block.operations))
      .filter(
        (operation) =>
          (operation.kind === "load" || operation.kind === "store") &&
          operation.place.path.length > 0,
      );
    expect(typed.length).toBeGreaterThan(1);
    for (const program of [
      fixture.reference.checked.lowered.program,
      fixture.reference.shared.machine.program,
      fixture.reference.shared.layout.program,
    ]) {
      for (const operation of typed) {
        const origins = instructions(program)
          .flatMap((instruction) => instruction.observerOrigins ?? [])
          .filter((origin) => origin.kind === "typed" && origin.operation === operation);
        expect(origins).toHaveLength(1);
        expect(origins[0]!.place).toBe(operation.place);
        expect(origins[0]!.byte).toBe(0);
      }
    }
    // Startup policy and physical addresses are separate axes; typed object
    // accesses must not change the source-function instruction shape.
    expect(codeShape(fixture.reference.shared.layout.program)).toEqual(
      codeShape(effectFixture(source, "none").reference.shared.layout.program),
    );
  });

  it("should preserve both unmerged NMI-context bodies and legacy sharing associations", () => {
    const source = `module Game;import {setNMI,restoreNMI,setIRQ,restoreIRQ} from c64.system;
function shared():void{poke($C100,7);}
interrupt function N():void{} interrupt function A():void{shared();} interrupt function B():void{shared();}
function main():void{setNMI(&N);setIRQ(&A);restoreIRQ();setIRQ(&B);restoreIRQ();restoreNMI();}`;
    const selected = effectFixture(source);
    const direct = effectFixture(source, "none");
    const owner = selected.checked.program.semantic.functions.find(
      (fn) => selected.checked.bindingNames.get(bindingIdentityKey(fn.id)) === "Game.shared",
    )!;
    const original = selected.reference.checked.lowered.program.functions.filter(
      (fn) => fn.sourceFunction === owner.id,
    );
    expect(original).toHaveLength(2);
    expect(
      direct.reference.shared.machine.program.functions.filter(
        (fn) => fn.sourceName === "Game.shared",
      ),
    ).toHaveLength(2);
    for (const program of [
      selected.reference.shared.machine.program,
      selected.reference.shared.layout.program,
    ]) {
      const shared = program.functions.filter((fn) => fn.sourceFunction === owner.id);
      expect(shared).toHaveLength(2);
      expect(new Set(shared.map((body) => body.executionContext?.activationRoot)).size).toBe(2);
    }
    expect(executable(selected.reference.shared.layout.program)).toEqual(
      executable(direct.reference.shared.layout.program),
    );
    // Exercise the binder's existing legacy namespace separately. These extra,
    // unreachable bodies are a geometry unit, never a claimed source execution
    // context or an authenticated observer-complete candidate.
    const ids = ["fn.observer-unit.irq.root61.depth0", "fn.observer-unit.irq.root62.depth0"];
    const variants = original.map((fn, index) => ({
      ...fn,
      id: ids[index]!,
      blocks: fn.blocks.map((block) => ({ ...block, label: `${ids[index]}.entry` })),
    }));
    const lowered = selected.reference.checked.lowered;
    const bound = bindMachineProgram(
      { ...lowered.program, functions: [...lowered.program.functions, ...variants] },
      selected.reference.shared.certificate.certificate,
    );
    expect(bound.kind).toBe("complete");
    if (bound.kind !== "complete") throw new Error("Expected legacy geometric binding");
    const shared = bound.program.functions.filter((fn) => ids.includes(fn.id));
    expect(shared).toHaveLength(1);
    expect(shared[0]!.observerBodies).toHaveLength(2);
    expect(
      new Set(shared[0]!.observerBodies?.map((body) => body.executionContext.activationRoot)).size,
    ).toBe(2);
    expect(shared[0]!.observerBodies?.every((body) => body.sourceFunction === owner.id)).toBe(true);
  });

  it("should retain effective-byte order and actual raw operations through both physical endpoints", () => {
    const fixture = effectFixture(
      "module Game;function main():void{poke($C100,peek($C110));pokew($C104,peekw($FFFF));}",
    );
    const operations = fixture.checked.program.semantic.functions
      .flatMap((fn) => fn.blocks.flatMap((block) => block.operations))
      .filter((operation) => operation.kind === "memory-read" || operation.kind === "memory-write");
    expect(operations).toHaveLength(4);
    for (const program of [
      fixture.reference.checked.lowered.program,
      fixture.reference.shared.machine.program,
      fixture.reference.shared.layout.program,
    ]) {
      const origins = instructions(program)
        .flatMap((instruction) => instruction.observerOrigins ?? [])
        .filter((origin) => origin.kind === "raw");
      for (const operation of operations) {
        const effective = origins.filter(
          (origin) => origin.operation === operation && origin.byte !== null,
        );
        expect(effective.map((origin) => origin.byte)).toEqual(
          operation.width === 1 ? [0] : [0, 1],
        );
        expect(effective.every((origin) => Object.isFrozen(origin))).toBe(true);
      }
    }
  });

  it("should preserve a deferred second raw read when LDA becomes an ALU read", () => {
    const fixture = effectFixture(
      "module Game;function main():void{poke($C100,peek($C110)&peek($C111));}",
    );
    const reads = fixture.checked.program.semantic.functions
      .flatMap((fn) => fn.blocks.flatMap((block) => block.operations))
      .filter((operation) => operation.kind === "memory-read");
    expect(reads).toHaveLength(2);
    for (const program of [
      fixture.reference.checked.lowered.program,
      fixture.reference.shared.machine.program,
      fixture.reference.shared.layout.program,
    ]) {
      const consumers = instructions(program).filter((instruction) =>
        instruction.observerOrigins?.some((origin) => origin.operation === reads[1]),
      );
      expect(consumers.map((instruction) => instruction.opcode)).toEqual(["and"]);
      expect(consumers[0]!.observerOrigins?.[0]?.operation).toBe(reads[1]);
    }
  });

  it("should associate complete platform sequences without altering none output or metadata", () => {
    const source = `module Game;import {setIRQ,restoreIRQ} from c64.system;
interrupt function handler():void{}function main():void{setIRQ(&handler);restoreIRQ();}`;
    const selected = effectFixture(source);
    const direct = effectFixture(source, "none");
    const operations = selected.checked.program.semantic.functions
      .flatMap((fn) => fn.blocks.flatMap((block) => block.operations))
      .filter((operation) => operation.kind === "platform");
    expect(operations).toHaveLength(2);
    for (const program of [
      selected.reference.checked.lowered.program,
      selected.reference.shared.machine.program,
      selected.reference.shared.layout.program,
    ]) {
      for (const operation of operations) {
        const origins = instructions(program)
          .flatMap((instruction) => instruction.observerOrigins ?? [])
          .filter((origin) => origin.operation === operation);
        expect(origins.length).toBeGreaterThan(0);
        expect(origins.map((origin) => origin.position)).toEqual(
          Array.from({ length: origins[0]!.length }, (_, index) => index),
        );
      }
    }
    expect(executable(selected.reference.shared.layout.program)).toEqual(
      executable(direct.reference.shared.layout.program),
    );
    expect(selected.reference.shared.certificate.certificate).toEqual(
      direct.reference.shared.certificate.certificate,
    );
    expect(
      instructions(direct.reference.shared.layout.program).every(
        (instruction) => !Object.hasOwn(instruction, "observerOrigins"),
      ),
    ).toBe(true);
  });
});

describe("fixed ordinary-RAM residual closure", () => {
  it.each([
    ["byte read", "poke($C100,peek($C1FF+word(peek($C120)&7)));", "complete"],
    ["byte write", "poke($C1FF+word(peek($C120)&7),peek($C121));", "complete"],
    ["word read", "pokew($C100,peekw($C1FF+word(peek($C120)&7)));", "complete"],
    ["word write", "pokew($C1FF+word(peek($C120)&7),peekw($C130));", "complete"],
    ["device crossing", "pokew($C100,peekw($CFFF+word(peek($C120)&7)));", "rejected"],
  ])(
    "should close source-bounded %s only with the actual pointer template",
    (_name, body, expected) => {
      const fixture = effectFixture(
        `module Game;function main():void{${body}}`,
        "size",
        true,
        "original",
      );
      const result = validateSizeObservers(fixture);
      expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe(expected);
    },
  );

  it("should reject an occupied byte inside a wider raw interval", () => {
    const source = `module Game;place(at:$3200)let marker:byte;
function main():void{poke($C100,peek($31F8+word(peek($C120)&15)));poke($C101,marker);}`;
    const fixture = effectFixture(source, "size", true, "original");
    const occupied = fixture.reference.shared.layout.intervals;
    expect(occupied.some(({ start, end }) => start <= 0x3200 && end >= 0x3200)).toBe(true);
    expect(occupied.some(({ start, end }) => start <= 0x31f8 && end >= 0x31f8)).toBe(false);
    expect(occupied.some(({ start, end }) => start <= 0x3207 && end >= 0x3207)).toBe(false);
    const result = validateSizeObservers(fixture);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toContain("overlaps an actual original or selected object");
  });

  it("should validate ordered low/high bytes in both genuine final layouts", () => {
    const fixture = effectFixture(
      "module Game;function main():void{pokew($C100,peekw($C110));}",
      "size",
      true,
      "original",
    );
    const result = validateSizeObservers(fixture);
    expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
    if (result.kind === "complete") expect(result.candidate).toBe(fixture.candidate);
    expect(fixture.reference.kind).toBe("feasible");
  });

  it("should reject a raw read of a real final home rather than erasing its observer", () => {
    const text = (address: string) =>
      `module Game;function main():void{let value:word=peekw($C110);pokew($C100,value);peek($${address});}`;
    const pilot = effectFixture(text("C130"), "size", true, "original");
    const home = pilot.reference.shared.certificate.certificate.homes.find(
      (home) => home.region === "ram" && home.bytes > 0,
    );
    if (home === undefined) throw new Error("Expected actual retained word storage");
    const fixture = effectFixture(
      text(home.address.toString(16).padStart(4, "0")),
      "size",
      true,
      "original",
    );
    expect(
      fixture.reference.shared.certificate.certificate.homes.some(
        (actual) => actual.region === "ram" && actual.address === home.address,
      ),
    ).toBe(true);
    const result = validateSizeObservers(fixture);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toContain("overlaps an actual original or selected object");
  });

  it("should keep an unproved raw footprint as a whole-tuple rejection", () => {
    const fixture = effectFixture(
      "module Game;function main():void{poke($C100,peek(peekw($C110)));}",
      "size",
      true,
      "original",
    );
    expect(validateSizeObservers(fixture).kind).toBe("rejected");
  });

  it("should admit known device windows under the raw site proof", () => {
    const fixture = effectFixture(
      "module Game;function main():void{poke($D020,peek($DC00));}",
      "size",
      true,
      "original",
    );
    expect(validateSizeObservers(fixture).kind).toBe("complete");
  });
});
