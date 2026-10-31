import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { validateSizeObservers } from "./size-observers.js";
import { lowerMachineProgram } from "../machine/lower.js";
import { inventoryStorage } from "../storage/inventory.js";
import { closeStorage } from "../storage/closure.js";
import { closeSharedStorage } from "./shared-storage.js";
import { checkLayout } from "./size-observer-raw-layout.js";
import type { RawSite } from "./size-observer-raw-layout.js";
import type { MachineBlock } from "../machine/machine-types.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { typeBytes } from "../machine/lower-control.js";

/** Find the real loop and both certified counter homes using source bindings, not request names. */
function counterHomes(input: ReturnType<typeof effectFixture>) {
  const source = input.candidate.lowered.program.storageSelection!.sourceFacts;
  const loop = [...source.functions.values()].flatMap((packet) => packet.loops)[0]!;
  const key = bindingIdentityKey(loop.counter);
  return [input.reference.shared, input.candidate.shared].map((shared) => {
    const request = shared.certificate.inventory.requests.find(
      (request) =>
        request.binding !== null &&
        bindingIdentityKey(request.binding) === key &&
        bindingIdentityKey(request.owner) === bindingIdentityKey(loop.function.id),
    );
    const home = shared.certificate.certificate.homes.find(
      (home) => home.requestId === request?.id,
    );
    if (home === undefined) throw new Error("Expected the actual Original counter home");
    return home;
  });
}

/** Use the producer's conditional envelope for the single byte read in these geometry cases. */
function rawReadSite(input: ReturnType<typeof effectFixture>): RawSite {
  const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
  const loop = [...facts.functions.values()].flatMap((packet) => packet.loops)[0]!;
  for (const block of loop.function.blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "memory-read" || operation.width !== 1) continue;
      const observation = facts.functions
        .get(loop.function)!
        .objects.observations.find((entry) => entry.operation === operation);
      if (observation?.target.kind !== "raw" || observation.target.ranges === null)
        throw new Error("Expected the genuine source-derived raw envelope");
      return { operation, owner: loop.function.id, block, ranges: observation.target.ranges };
    }
  }
  throw new Error("Expected one source byte read");
}

/** Locate actual shared fallthrough aliases at this loop's exit or update entry. */
function sharedAliases(input: ReturnType<typeof effectFixture>, update = false) {
  const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
  const loop = [...facts.functions.values()].flatMap((packet) => packet.loops)[0]!;
  const fn = input.candidate.shared.layout.program.functions.find(
    (fn) => fn.sourceFunction === loop.function.id,
  )!;
  const label = fn.observerBlocks!.find(
    ([source]) => source === (update ? loop.update : loop.exit),
  )![1][0]!;
  const target = fn.blocks.find((block) => block.label === label)!;
  const aliases = fn.blocks.filter(
    (block) =>
      block.origin === target.origin &&
      block.instructions.length === 0 &&
      block.terminator.kind === "fallthrough",
  );
  if (aliases.length < 2) throw new Error("Expected a genuine shared zero-byte alias chain");
  for (const [index, alias] of aliases.entries()) {
    if (
      alias.terminator.kind !== "fallthrough" ||
      alias.terminator.target !== (aliases[index + 1]?.label ?? target.label)
    )
      throw new Error("Expected actual consecutive same-PC fallthrough aliases");
  }
  return { fn, target, aliases, loop };
}

describe("Original induction observer closure", () => {
  describe.each([
    ["typed-only", "let data:byte[8];", "data[i]=byte(i);"],
    ["raw read", "let data:byte[8];", "data[i]=peek($C110+i);"],
    ["raw write", "", "poke($C110+i,byte(i));"],
    ["word crossing", "let data:word[8];", "data[i]=peekw($C1FF+i);"],
  ])("%s", (_name, declaration, body) => {
    it.each([true, false])("should close the Original range with bounds=%s", (bounds) => {
      const input = effectFixture(
        `module Game;${declaration}function main():void{
for(let i:word=0;i<8;i+=1){${body}}}`,
        "size",
        bounds,
        "original",
      );
      expect(input.candidate.shared).not.toBe(input.reference.shared);
      expect(counterHomes(input).every(({ bytes }) => bytes === 2)).toBe(true);
      const result = validateSizeObservers(input);
      expect(result.kind, `${body}: ${result.kind === "complete" ? "" : result.reason}`).toBe(
        "complete",
      );
    });
  });

  it("should reject writes of either actual counter byte", () => {
    const source = (address: string) => `module Game;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){data[i]=byte(i);poke($${address},0);}}`;
    const pilot = effectFixture(source("C130"), "size", false, "original");
    for (const home of counterHomes(pilot))
      for (const byte of [0, 1]) {
        const address = home.address + byte;
        const input = effectFixture(
          source(address.toString(16).padStart(4, "0")),
          "size",
          false,
          "original",
        );
        expect(
          counterHomes(input).some(
            (actual) => address >= actual.address && address < actual.address + actual.bytes,
          ),
        ).toBe(true);
        expect(validateSizeObservers(input).kind).toBe("rejected");
      }
  });

  describe.each([0, 1])("counter byte %i", (byte) => {
    it.each([true, false])(
      "should reject bounded reads at the rebuilt home with bounds=%s",
      (bounds) => {
        const source = (address: number) => `module Game;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){data[i]=peek($${address.toString(16).padStart(4, "0")}+i);}}`;
        const pilot = effectFixture(source(0xc130), "size", bounds, "original");
        const address = counterHomes(pilot)[0]!.address + byte;
        const input = effectFixture(source(address), "size", bounds, "original");
        const homes = counterHomes(input);
        expect(homes.map((home) => home.address)).toEqual(
          counterHomes(pilot).map((home) => home.address),
        );
        expect(homes.every((home) => address === home.address + byte)).toBe(true);
        const site = rawReadSite(input);
        expect(site.ranges).toEqual([{ start: address, end: address + 7 }]);
        const result = validateSizeObservers(input);
        expect(result.kind).toBe("rejected");
        if (result.kind !== "complete") {
          expect(result.reason).toContain("overlaps an actual original or selected object");
          expect(result.objectId).toBe(homes[1]!.requestId);
        }
      },
    );
  });

  it.each(["original", "selected"] as const)(
    "should check a byte occupied only in the %s interval union",
    (side) => {
      const source = (
        address: number,
      ) => `module Game;let mask:byte=7;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){${"data[i]=~mask;".repeat(8)}peek($${address.toString(16).padStart(4, "0")}+i);}}`;
      const pilot = effectFixture(source(0xc130), "size", false, "original");
      const original = counterHomes(pilot)[0]!;
      const extra = pilot.candidate.shared.certificate.certificate.homes.find(
        (home) =>
          home.region === "zero-page" &&
          home.bytes === 1 &&
          !pilot.reference.shared.layout.intervals.some(
            ({ start, end }) => home.address <= end && home.address >= start,
          ),
      );
      if (extra === undefined) throw new Error("Expected an actual selected-only byte home");
      const address = side === "original" ? original.address : extra.address;
      const input = effectFixture(source(address), "size", false, "original");
      const site = rawReadSite(input);
      const layouts = [input.reference.shared, input.candidate.shared];
      expect(counterHomes(input).map((home) => home.address)).toEqual(
        counterHomes(pilot).map((home) => home.address),
      );
      expect(site.ranges).toEqual([{ start: address, end: address + 7 }]);
      const overlaps = layouts.map((shared) =>
        shared.layout.intervals.some(({ start, end }) => address <= end && address + 7 >= start),
      );
      expect(overlaps).toEqual(side === "original" ? [true, false] : [false, true]);
      const before = checkLayout(
        input,
        layouts[0]!,
        input.reference.checked.lowered.program,
        [site],
        new Set(),
      );
      const after = checkLayout(
        input,
        layouts[1]!,
        input.candidate.lowered.program,
        [site],
        new Set(),
      );
      expect(side === "original" ? after : before).toBeNull();
      const rejected = side === "original" ? before : after;
      expect(rejected?.kind).toBe("rejected");
      expect(rejected?.reason).toContain("overlaps an actual original or selected object");
      expect(rejected?.objectId).toBe(side === "original" ? original.requestId : extra.requestId);
      // The selected-only byte is in zero page. This isolates the layout checker;
      // the whole-program gate must still reject that unsupported raw domain earlier.
      const result = validateSizeObservers(input);
      expect(result.kind).toBe("rejected");
      if (result.kind !== "complete")
        expect(result.reason).toContain(
          side === "original"
            ? "overlaps an actual original or selected object"
            : "device, bank, stack or hardware-publication proof",
        );
    },
  );

  it.each(["peek", "peekw"])("should reject an interior loop observation with %s", (read) => {
    const input = effectFixture(
      `module Game;place(at:$3200)let marker:byte;
let data:word[8];function main():void{for(let i:word=0;i<8;i+=1){data[i]=marker;data[i]=${read}($31FC+i);}}`,
      "size",
      false,
      "original",
    );
    for (const shared of [input.reference.shared, input.candidate.shared]) {
      const occupied = (address: number) =>
        shared.layout.intervals.some(({ start, end }) => start <= address && end >= address);
      expect(occupied(0x31fc)).toBe(false);
      expect(occupied(read === "peek" ? 0x3203 : 0x3204)).toBe(false);
      expect(occupied(0x3200)).toBe(true);
    }
    const result = validateSizeObservers(input);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toContain("overlaps an actual original or selected object");
  });

  it.each([
    "data[peek($C110)]=byte(i);",
    "poke(peekw($C110),byte(i));",
    "data[i]=peek(peekw($C110));",
    "data[i]=peek($CFFF+i);",
  ])("should retain unknown alias or unsafe-domain rejection for %s", (body) => {
    const input = effectFixture(
      `module Game;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){${body}}}`,
      "size",
      false,
      "original",
    );
    expect(validateSizeObservers(input).kind).toBe("rejected");
  });

  it("should reject a stale conditional maximum and recover only after restoration", () => {
    const input = effectFixture(
      "module Game;let data:byte[8];function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}}",
      "size",
      false,
      "original",
    );
    const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
    const loop = [...facts.functions.values()].flatMap((packet) => packet.loops)[0]!;
    if (!(loop.valueBounds instanceof Map))
      throw new Error("Expected the actual retained range Map");
    const [value, maximum] = [...loop.valueBounds][0]!;
    try {
      loop.valueBounds.set(value, maximum + 1n);
      expect(validateSizeObservers(input).kind).toBe("error");
    } finally {
      loop.valueBounds.set(value, maximum);
    }
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it("should reject genuine lowering without block evidence instead of inventing its mappings", () => {
    const input = effectFixture(
      "module Game;let data:byte[8];function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}}",
      "size",
      false,
      "original",
    );
    const original = input.candidate.lowered;
    // Preserve the actual allocated windows; only a matching target ID may
    // supply the selected profile's required storage identity.
    const allocatedStorage = original.program.storageProfile!;
    if (allocatedStorage.profileId !== input.checked.profile.id)
      throw new Error("Expected allocation for the selected target profile");
    const profile = {
      ...input.checked.profile,
      storage: { ...allocatedStorage, profileId: input.checked.profile.id },
    };
    const lowered = lowerMachineProgram({
      program: original.inventory.program,
      profile,
      logicalStorage: inventoryStorage(original.inventory.program),
      sourceFacts: original.program.storageSelection!.sourceFacts,
      observerEvidence: false,
      bindingNames: input.checked.bindingNames,
      boundsCheck: false,
      divisionZeroCheck: true,
    });
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const storage = closeStorage(lowered.inventory, profile.storage, lowered.binder);
    if (storage.kind !== "complete") throw new Error("Expected real storage closure");
    const shared = closeSharedStorage(
      lowered.program,
      lowered.binder,
      storage,
      input.checked.profile,
    );
    if (shared.kind !== "complete") throw new Error("Expected real final closure");
    const result = validateSizeObservers({ ...input, candidate: { lowered, shared } });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete") expect(result.reason).toContain("source-block associations");
  });

  it.each(["for(let i:word=8;i<8;i+=1){data[0]=1;}"])(
    "should retain generic fallback for an unqualified induction shape",
    (loop) => {
      const input = effectFixture(
        `module Game;let data:byte[8];function main():void{${loop}}`,
        "size",
        false,
        "original",
      );
      expect(validateSizeObservers(input).kind).toBe("rejected");
    },
  );
});

describe("ordinary call composition around Original induction", () => {
  it.each([true, false])("should close a direct caller of a raw loop with bounds=%s", (bounds) => {
    const input = effectFixture(
      `module Game;let data:byte[8];
function scan():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}}
function main():void{scan();}`,
      "size",
      bounds,
      "original",
    );
    expect(input.candidate.shared).not.toBe(input.reference.shared);
    const result = validateSizeObservers(input);
    expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
  });

  it("should close a raw read and result delivery through nested direct callers", () => {
    const input = effectFixture(
      `module Game;
function sample():byte{return peek($C110);}
function relay():byte{return sample();}
function main():void{poke($C100,relay());}`,
      "size",
      false,
      "original",
    );
    const result = validateSizeObservers(input);
    expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
  });

  it("should retain rejection when a loop body calls a potentially interfering function", () => {
    const input = effectFixture(
      `module Game;let data:byte[8];
function touch():void{poke($C130,0);}
function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);touch();}}`,
      "size",
      false,
      "original",
    );
    const result = validateSizeObservers(input);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete") expect(result.reason).toContain("Opaque induction effects");
  });

  it("should not hide an unknown raw target behind a direct call", () => {
    const input = effectFixture(
      `module Game;
function sample():byte{return peek(peekw($C110));}
function main():void{poke($C100,sample());}`,
      "size",
      false,
      "original",
    );
    const result = validateSizeObservers(input);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toContain("no proved ordinary-RAM envelope");
  });
});

describe("Original induction with source control exits", () => {
  describe.each([
    ["break", "if(i==3){break;}data[i]=byte(i+1);"],
    ["shared break exit", "if(i==2){break;}if(i==3){break;}data[i]=byte(i+1);"],
    ["second shared break exit", "if(i==3){break;}if(i==2){break;}data[i]=byte(i+1);"],
    [
      "long shared break exit",
      "if(i==2){break;}if(i==3){break;}if(i==4){break;}data[i]=byte(i+1);",
    ],
    ["continue", "if(i==3){continue;}data[i]=byte(i+1);"],
    ["shared continue exit", "if(i==2){continue;}if(i==3){continue;}data[i]=byte(i+1);"],
    ["return", "if(i==3){return;}data[i]=byte(i+1);"],
    ["conditional raw read", "if(i<3){data[i]=peek($C110+i);}else{data[i]=byte(i+1);}"],
  ])("%s", (_name, body) => {
    it.each([true, false])("should preserve the source edge with bounds=%s", (bounds) => {
      const input = effectFixture(
        `module Game;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){${body}}poke($C100,99);}`,
        "size",
        bounds,
        "original",
      );
      const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
      const loops = [...facts.functions.values()].flatMap((packet) => packet.loops);
      expect(loops).toHaveLength(1);
      expect(loops[0]!.members.size).toBeGreaterThan(2);
      expect(counterHomes(input).every((home) => home.bytes === 2)).toBe(true);
      if (_name.includes("shared")) {
        const { aliases } = sharedAliases(input, _name.includes("continue"));
        expect(aliases.length).toBeGreaterThanOrEqual(_name.startsWith("long") ? 3 : 2);
      }
      const result = validateSizeObservers(input);
      expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
    });
  });

  it("should not discharge an unknown write on a conditional path", () => {
    const input = effectFixture(
      `module Game;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){if(i==3){poke(peekw($C110),0);}data[i]=byte(i);}}`,
      "size",
      false,
      "original",
    );
    const result = validateSizeObservers(input);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toContain("no proved ordinary-RAM envelope");
  });

  it("should reject a conditional write to the rebuilt counter home", () => {
    const source = (address: number) => `module Game;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){if(i==1){poke($${address.toString(16).padStart(4, "0")}+i,1);}data[i]=byte(i);}}`;
    const pilot = effectFixture(source(0xc130), "size", false, "original");
    const address = counterHomes(pilot)[0]!.address;
    const input = effectFixture(source(address), "size", false, "original");
    expect(counterHomes(input).map((home) => home.address)).toEqual(
      counterHomes(pilot).map((home) => home.address),
    );
    expect(counterHomes(input).some((home) => address + 1 === home.address + home.bytes - 1)).toBe(
      true,
    );
    const result = validateSizeObservers(input);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toContain("overlaps an actual original or selected object");
  });
});

describe("malformed final continuation evidence", () => {
  it.each([
    "cycle",
    "missing label",
    "missing origin",
    "unequal origin",
    "jump",
    "instruction",
  ] as const)("should reject %s instead of treating it as a transparent alias", (kind) => {
    const input = effectFixture(
      `module Game;let data:byte[8];function main():void{
for(let i:word=0;i<8;i+=1){if(i==2){break;}if(i==3){break;}data[i]=byte(i+1);}poke($C100,99);}`,
      "size",
      false,
      "original",
    );
    const { fn, target, aliases, loop } = sharedAliases(input);
    const alias = aliases[0]!;
    let blocks: readonly MachineBlock[];
    if (kind === "jump" || kind === "instruction") {
      const label = fn.observerBlocks!.find(([source]) => source === loop.body)![1][0]!;
      const branch = fn.blocks.find((block) => block.label === label)!;
      const edge = branch.terminator;
      if (edge.kind !== "branch") throw new Error("Expected the real conditional predecessor");
      const injected: MachineBlock = {
        label: "negative.alias",
        origin: target.origin!,
        instructions: kind === "instruction" ? [target.instructions[0]!] : [],
        terminator:
          kind === "jump"
            ? {
                kind: "jump",
                opcode: "jmp",
                target: target.label,
                cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
              }
            : { kind: "fallthrough", target: target.label },
      };
      const sharedPc = (label: string) =>
        fn.blocks.find((block) => block.label === label)?.origin === target.origin;
      expect(Number(sharedPc(edge.target)) + Number(sharedPc(edge.fallthrough))).toBe(1);
      blocks = [
        ...fn.blocks.map((block) =>
          block !== branch
            ? block
            : {
                ...block,
                terminator: {
                  ...edge,
                  target: sharedPc(edge.target) ? injected.label : edge.target,
                  fallthrough: sharedPc(edge.fallthrough) ? injected.label : edge.fallthrough,
                },
              },
        ),
        injected,
      ];
    } else {
      const { origin: _origin, ...withoutOrigin } = alias;
      const changed: MachineBlock =
        kind === "missing origin"
          ? withoutOrigin
          : kind === "unequal origin"
            ? { ...alias, origin: alias.origin! + 1 }
            : {
                ...alias,
                terminator: {
                  kind: "fallthrough",
                  target: kind === "cycle" ? alias.label : "negative.missing",
                },
              };
      blocks = fn.blocks.map((block) => (block === alias ? changed : block));
    }
    // These deliberately invalid copies exercise only rejection paths. They
    // never acquire or substitute a valid producer receipt.
    const shared = input.candidate.shared;
    const modified = {
      ...input,
      candidate: {
        ...input.candidate,
        shared: {
          ...shared,
          layout: {
            ...shared.layout,
            program: {
              ...shared.layout.program,
              functions: shared.layout.program.functions.map((body) =>
                body === fn ? { ...fn, blocks } : body,
              ),
            },
          },
        },
      },
    };
    const result = validateResidualEffects(modified);
    expect(result.kind).toBe("error");
    if (result.kind !== "complete") expect(result.reason).toMatch(/continuation|physical origins/);
    expect(validateSizeObservers(modified).kind).toBe("error");
  });
});

describe("Original induction with by-value parameters", () => {
  describe.each([
    [
      "byte",
      "let data:byte[8];",
      "function scan(seed:byte):void{for(let i:word=0;i<8;i+=1){data[i]=byte(i)+seed;}}",
      "scan(7);",
    ],
    [
      "word",
      "let data:word[8];",
      "function scan(seed:word):void{for(let i:word=0;i<8;i+=1){data[i]=seed+i;}}",
      "scan($12F9);",
    ],
    [
      "multiple",
      "let data:word[8];",
      "function scan(seed:byte,step:byte,base:word):void{for(let i:word=0;i<8;i+=1){data[i]=base+word(seed)+word(step)+i;}}",
      "scan(7,2,$12F0);",
    ],
    [
      "enum",
      "enum Bias{SEVEN=7,NINE=9}let data:byte[8];",
      "function scan(seed:Bias):void{for(let i:word=0;i<8;i+=1){data[i]=byte(seed)+byte(i);}}",
      "scan(Bias.SEVEN);",
    ],
    [
      "forwarded",
      "let data:byte[8];",
      "function scan(seed:byte):void{for(let i:word=0;i<8;i+=1){data[i]=byte(i)+seed;}}function relay(seed:byte):void{scan(seed);}",
      "relay(7);",
    ],
    [
      "sequential",
      "let data:byte[8];",
      "function scan(seed:byte):void{for(let i:word=0;i<8;i+=1){data[i]=byte(i)+seed;}}",
      "scan(7);scan(9);",
    ],
  ])("%s", (_name, declarations, functions, calls) => {
    it.each([true, false])("should close independent scalar entry with bounds=%s", (bounds) => {
      const input = effectFixture(
        `module Game;${declarations}${functions}function main():void{${calls}}`,
        "size",
        bounds,
        "original",
      );
      expect(input.candidate.shared).not.toBe(input.reference.shared);
      const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
      const loop = [...facts.functions.values()].flatMap((packet) => packet.loops)[0]!;
      const counters = counterHomes(input);
      for (const [index, shared] of [input.reference.shared, input.candidate.shared].entries()) {
        for (const parameter of loop.function.parameters) {
          const request = shared.certificate.inventory.requests.find(
            (request) =>
              request.binding !== null &&
              bindingIdentityKey(request.binding) === bindingIdentityKey(parameter.id) &&
              bindingIdentityKey(request.owner) === bindingIdentityKey(loop.function.id),
          );
          const home = shared.certificate.certificate.homes.find(
            (home) => home.requestId === request?.id,
          );
          if (home === undefined) throw new Error("Expected the actual by-value parameter home");
          expect(home.bytes).toBe(typeBytes(parameter.type));
          const counter = counters[index]!;
          expect(
            home.address + home.bytes <= counter.address ||
              counter.address + counter.bytes <= home.address,
          ).toBe(true);
        }
      }
      const result = validateSizeObservers(input);
      expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
    });
  });

  it.each([
    [
      "parameter counter",
      "",
      "function scan(i:word):void{for(i=0;i<8;i+=1){data[i]=byte(i);}}",
      "scan(0);",
      "rejected",
    ],
    [
      "nonconstant start",
      "",
      "function scan(seed:word):void{for(let i:word=seed;i<8;i+=1){data[i]=byte(i);}}",
      "scan(0);",
      "complete",
    ],
    [
      "unknown address",
      "",
      "function scan(address:word):void{for(let i:word=0;i<8;i+=1){data[i]=peek(address+i);}}",
      "scan($C110);",
      "rejected",
    ],
    [
      "aggregate",
      "let input:byte[8]=[;7];",
      "function scan(p:const byte[8]):void{for(let i:word=0;i<8;i+=1){data[i]=p[i];}}",
      "scan(input);",
      "complete",
    ],
    [
      "forwarded aggregate",
      "let input:byte[8]=[;7];",
      "function scan(p:const byte[8]):void{for(let i:word=0;i<8;i+=1){data[i]=p[i];}}function relay(p:const byte[8]):void{scan(p);}",
      "relay(input);",
      "complete",
    ],
    [
      "multiple aggregate origins",
      "let first:byte[8]=[;7];let second:byte[8]=[;9];",
      "function scan(p:const byte[8]):void{for(let i:word=0;i<8;i+=1){data[i]=p[i];}}",
      "scan(first);scan(second);",
      "rejected",
    ],
  ])(
    "should enforce the entry proof boundary for %s",
    (_name, declarations, functions, calls, expected) => {
      const input = effectFixture(
        `module Game;let data:byte[8];${declarations}${functions}function main():void{${calls}}`,
        "size",
        false,
        "original",
      );
      if (_name.includes("aggregate")) {
        const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
        const objects = [...facts.functions.values()][0]!.objects;
        const count = _name === "aggregate" ? 1 : _name === "forwarded aggregate" ? 2 : 0;
        expect(objects.parameters.size).toBe(count);
        expect(objects.stableParameters.size).toBe(count);
      }
      expect(validateSizeObservers(input).kind).toBe(expected);
    },
  );
});
