import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { serializeAcme } from "../artifacts/acme-serializer.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateFieldComplements } from "./size-observer-complement-fields.js";
import type { MachineFunction, MachineInstruction } from "../machine/machine-types.js";
import { machineInstruction } from "../machine/lower-control.js";
import { validateByteWindowObservers } from "./size-observer-byte-windows.js";

/** Prefix returns and nested ordinals exercise two different left-value constructions. */
const COMPOSED = `module Game;
struct Cell{rows:byte[8];value:byte;}
let cell:Cell={rows:[;3],value:7};let mode:byte=0;
let answers:byte[8]=[;0];let observed:boolean=false;
function work(p:const Cell):boolean{
  let inverse:byte=~p.value;if(mode!=0){return false;}
  for(let i:word=0;i<8;i+=1){
    let left:byte=p.rows[i];if(left==0){return false;}
    answers[i]=left&~inverse;
    for(let j:word=i+1;j<8;j+=1){answers[j]=~p.rows[j]&~inverse;}
  }
  return true;
}
function relay(p:const Cell):boolean{return work(p);}
function main():void{observed=relay(cell);poke($C100,answers[0]);}`;

/** Reuse the exact ordinary acquisition-independent caller without changing its source. */
const SAVED = readFileSync(
  new URL("../../../../test/rd05/fixtures/input-saved-caller.blend", import.meta.url),
  "utf8",
);

describe("composed Original field correspondence", () => {
  it.each([false, true])("should close the unchanged saved caller with bounds=%s", (bounds) => {
    const input = effectFixture(SAVED, "size", bounds, "original");
    expect(validateResidualEffects(input).kind).toBe("complete");
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each([false, true])("should close both named backing classes with bounds=%s", (bounds) => {
    const privateSource = COMPOSED.replace("let cell:Cell={rows:[;3],value:7};", "").replace(
      "function main():void{",
      "function main():void{let cell:Cell={rows:[;3],value:7};",
    );
    for (const source of [COMPOSED, privateSource]) {
      const input = effectFixture(source, "size", bounds, "original");
      const proofs = input.candidate.lowered.program.functions.flatMap(
        (fn) => fn.byteComplementProofs ?? [],
      );
      expect(proofs.filter((proof) => proof.kind === "original")).toHaveLength(2);
      const effects = validateResidualEffects(input);
      expect(effects.kind).toBe("complete");
      if (effects.kind !== "complete") throw new Error(effects.reason);
      expect(effects.loops.size).toBe(2);
      const snapshots = [input.reference.shared, input.candidate.shared].map((shared) => ({
        assembly: serializeAcme({
          layout: shared.layout,
          certificate: shared.certificate.certificate,
          profile: input.checked.profile,
        }),
        resources: JSON.stringify(
          [shared.certificate.inventory.requests, shared.certificate.certificate],
          (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        ),
      }));
      expect(validateSizeObservers(input).kind).toBe("complete");
      for (const [index, shared] of [input.reference.shared, input.candidate.shared].entries()) {
        expect(
          serializeAcme({
            layout: shared.layout,
            certificate: shared.certificate.certificate,
            profile: input.checked.profile,
          }),
        ).toEqual(snapshots[index]!.assembly);
        expect(
          JSON.stringify(
            [shared.certificate.inventory.requests, shared.certificate.certificate],
            (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          ),
        ).toBe(snapshots[index]!.resources);
      }
    }
  });

  it.each([false, true])("should reject exact occurrence corruptions with bounds=%s", (bounds) => {
    for (const fault of [
      "index-carry",
      "index-base",
      "and-opcode",
      "held-store",
      "unrelated",
      "caller-high",
      "caller-init",
      "extra-call",
    ] as const) {
      const input = effectFixture(COMPOSED, "size", bounds, "original");
      const selected = input.candidate.lowered.program.functions.find(
        (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
      )!;
      const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
      const packet = [...facts.functions.values()].find(
        (p) => p.function.id === selected.sourceFunction,
      )!;
      const caller = [...packet.storage!.parameters.values()][0]!.calls[0]!;
      const reference = fault !== "and-opcode" && fault !== "unrelated";
      const owner =
        fault.startsWith("caller-") || fault === "extra-call" ? caller.owner : packet.function.id;
      const lowered = reference ? input.reference.checked.lowered : input.candidate.lowered;
      const shared = reference ? input.reference.shared : input.candidate.shared;
      const fn = lowered.program.functions.find((fn) => fn.sourceFunction === owner)!;
      const proof = selected.byteComplementProofs!.find((proof) =>
        packet.function.blocks.some((b) =>
          b.operations.some((op) => op.kind === "unary" && op.result === proof.preservedLeft),
        ),
      )!;
      const unary = packet.function.blocks
        .flatMap((b) => b.operations)
        .find((op) => "result" in op && op.result === proof.preservedLeft)!;
      const update = packet.function.blocks
        .flatMap((b) => b.operations)
        .find((op) => op.kind === "binary" && op.operator === "+")!;
      let label = "",
        at = -1;
      for (const block of fn.blocks) {
        let index = -1;
        if (fault === "index-carry" || fault === "index-base") {
          const read = block.instructions.findIndex((j) =>
            j.observerOrigins?.some(
              (o) =>
                o.kind === "typed" &&
                o.operation.kind === "load" &&
                o.operation.place.path.some((p) => p.kind === "index"),
            ),
          );
          if (read >= 8) index = read - (fault === "index-carry" ? 7 : 6);
        } else if (fault === "and-opcode")
          index = block.instructions.findIndex((j) => j.opcode === "and");
        else if (fault === "held-store")
          index = block.instructions.findIndex(
            (j) => j.opcode === "sta" && j.source === unary.span,
          );
        else if (fault === "unrelated")
          index = block.instructions.findIndex(
            (j) => j.opcode === "adc" && j.source === update.span,
          );
        else {
          const call = block.instructions.findIndex(
            (j) => j.opcode === "jsr" && j.source === caller.operation.span,
          );
          if (call >= 8)
            index = call - (fault === "caller-high" ? 6 : fault === "caller-init" ? 7 : 0);
        }
        if (index >= 0) {
          label = block.label;
          at = index;
          break;
        }
      }
      expect(at, fault).toBeGreaterThanOrEqual(0);
      let edits = 0;
      // This local edit changes one named occurrence on both actual representations.
      // It is not allowed to mint a new construction receipt or repair its geometry.
      const corrupt = (functions: readonly MachineFunction[]) =>
        functions.map((current) =>
          current.sourceFunction !== owner
            ? current
            : {
                ...current,
                blocks: current.blocks.map((block) =>
                  block.label !== label
                    ? block
                    : {
                        ...block,
                        instructions: block.instructions.flatMap(
                          (item, index): readonly MachineInstruction[] => {
                            if (index !== at) return [item];
                            edits += 1;
                            if (fault === "caller-init") return [];
                            if (fault === "extra-call") return [item, item];
                            if (fault === "index-carry") return [{ ...item, opcode: "sec" }];
                            if (fault === "and-opcode") return [{ ...item, opcode: "ora" }];
                            if (fault === "held-store") return [{ ...item, opcode: "stx" }];
                            if (fault === "unrelated") return [{ ...item, opcode: "sbc" }];
                            const operand = item.operand;
                            const delta = fault === "caller-high" ? -1 : 1;
                            if (operand?.kind === "storage")
                              return [
                                {
                                  ...item,
                                  operand: { ...operand, offset: (operand.offset ?? 0) + delta },
                                },
                              ];
                            if (operand?.kind === "absolute")
                              return [
                                { ...item, operand: { ...operand, value: operand.value + delta } },
                              ];
                            throw new Error("Expected a real bound or symbolic byte-copy operand");
                          },
                        ),
                      },
                ),
              },
        );
      const changedLowered = {
        ...lowered,
        program: { ...lowered.program, functions: corrupt(lowered.program.functions) },
      };
      const changedShared = {
        ...shared,
        layout: {
          ...shared.layout,
          program: {
            ...shared.layout.program,
            functions: corrupt(shared.layout.program.functions),
          },
        },
      };
      const modified = reference
        ? {
            ...input,
            reference: {
              ...input.reference,
              checked: { ...input.reference.checked, lowered: changedLowered },
              shared: changedShared,
            },
          }
        : { ...input, candidate: { lowered: changedLowered, shared: changedShared } };
      expect(edits, fault).toBe(2);
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      const actual = modified.candidate.lowered.program.functions.find(
        (f) => f.sourceFunction === packet.function.id,
      )!;
      expect(validateFieldComplements(modified, effects, actual, packet), fault).not.toBeNull();
      expect(validateSizeObservers(modified).kind, fault).toBe("error");
    }
  });
  it.each([false, true])("should require an actual indirect load with bounds=%s", (bounds) => {
    const source = COMPOSED.replace("let cell:Cell={rows:[;3],value:7};", "").replace(
      "function main():void{",
      "function main():void{let cell:Cell={rows:[;3],value:255};",
    );
    const input = effectFixture(source, "size", bounds, "original");
    expect(validateSizeObservers(input).kind).toBe("complete");
    const selected = input.candidate.lowered.program.functions.find(
      (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
    )!;
    const packet = [
      ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
    ].find((p) => p.function.id === selected.sourceFunction)!;
    const block = selected.blocks.find((b) =>
      b.instructions.some(
        (j) =>
          j.opcode === "lda" &&
          j.mode === "indirect-indexed-y" &&
          j.observerOrigins?.some(
            (o) =>
              o.kind === "typed" &&
              o.operation.kind === "load" &&
              o.operation.place.path.some((p) => p.kind === "index"),
          ),
      ),
    )!;
    const at = block.instructions.findIndex(
      (j) => j.opcode === "lda" && j.mode === "indirect-indexed-y",
    );
    expect(at).toBeGreaterThanOrEqual(0);
    let edits = 0;
    /** Change only this admitted read; correct ORA state metadata must not conceal it. */
    const corrupt = (functions: readonly MachineFunction[]) =>
      functions.map((fn) =>
        fn.id !== selected.id
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((b) =>
                b.label !== block.label
                  ? b
                  : {
                      ...b,
                      instructions: b.instructions.map((item, index) => {
                        if (index !== at) return item;
                        edits += 1;
                        return {
                          ...item,
                          ...machineInstruction(
                            input.checked.profile.cpu,
                            "ora",
                            item.mode,
                            item.operand,
                            item.memory,
                            item.source,
                          ),
                        };
                      }),
                    },
              ),
            },
      );
    const candidate = {
      lowered: {
        ...input.candidate.lowered,
        program: {
          ...input.candidate.lowered.program,
          functions: corrupt(input.candidate.lowered.program.functions),
        },
      },
      shared: {
        ...input.candidate.shared,
        layout: {
          ...input.candidate.shared.layout,
          program: {
            ...input.candidate.shared.layout.program,
            functions: corrupt(input.candidate.shared.layout.program.functions),
          },
        },
      },
    };
    const modified = { ...input, candidate };
    expect(edits).toBe(2);
    const effects = validateResidualEffects(input);
    if (effects.kind !== "complete") throw new Error(effects.reason);
    expect(
      validateFieldComplements(
        modified,
        effects,
        candidate.lowered.program.functions.find((fn) => fn.id === selected.id)!,
        packet,
      ),
    ).not.toBeNull();
    expect(validateSizeObservers(modified).kind).toBe("error");
  });

  it.each(
    [false, true].flatMap((bounds) =>
      [true, false].flatMap((reference) =>
        [
          "startup-numeric",
          "startup-label",
          "startup-offset",
          "main-numeric",
          "main-interior",
          "main-offset-alias",
          "jump",
          "fallthrough",
          "branch",
          "branch-fallthrough",
          "long-branch",
        ].map((entry) => ({ bounds, reference, entry })),
      ),
    ),
  )("should reject an unrecorded actual entry %j", ({ bounds, reference, entry }) => {
    const input = effectFixture(COMPOSED, "size", bounds, "original");
    expect(validateSizeObservers(input).kind).toBe("complete");
    const selected = input.candidate.lowered.program.functions.find(
      (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
    )!;
    const packet = [
      ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
    ].find((p) => p.function.id === selected.sourceFunction)!;
    const main = input.checked.program.semantic.functions.find(
      (fn) => fn.id.span.start === COMPOSED.indexOf("function main"),
    )!;
    const effects = validateResidualEffects(input);
    if (effects.kind !== "complete") throw new Error(effects.reason);
    const shared = reference ? input.reference.shared : input.candidate.shared;
    const program = shared.layout.program;
    const target = program.functions.find((fn) => fn.id === selected.id)!;
    const caller = program.functions.find((fn) => fn.sourceFunction === main.id)!;
    const owner = entry.startsWith("startup") ? program.startup : caller;
    expect(Number.isSafeInteger(target.origin)).toBe(true);
    let edits = 0;
    const changed = {
      ...owner,
      blocks: owner.blocks.map((block, index) => {
        if (index !== 0) return block;
        edits += 1;
        if (entry === "jump")
          return {
            ...block,
            terminator: {
              kind: "jump" as const,
              opcode: "jmp" as const,
              target: target.id,
              cost: machineInstruction(input.checked.profile.cpu, "jmp", "absolute", {
                kind: "label",
                label: target.id,
              }).cost,
            },
          };
        if (entry === "fallthrough")
          return { ...block, terminator: { kind: "fallthrough" as const, target: target.id } };
        if (entry === "branch" || entry === "branch-fallthrough") {
          const branch = machineInstruction(input.checked.profile.cpu, "beq", "relative", {
            kind: "label",
            label: target.id,
          });
          return {
            ...block,
            terminator: {
              kind: "branch" as const,
              opcode: "beq",
              target: entry === "branch" ? target.id : block.label,
              fallthrough: entry === "branch" ? block.label : target.id,
              uses: branch.uses,
              cost: branch.cost,
            },
          };
        }
        if (entry === "long-branch") {
          const jump = machineInstruction(input.checked.profile.cpu, "jmp", "absolute", {
            kind: "label",
            label: target.id,
          });
          const inverse = machineInstruction(input.checked.profile.cpu, "bne", "relative", {
            kind: "label",
            label: block.label,
          });
          const pc =
            block.origin! + block.instructions.reduce((bytes, item) => bytes + item.cost.bytes, 0);
          const bytes = inverse.cost.bytes + jump.cost.bytes;
          const taken = 3 + (((pc + 2) & 0xff00) !== ((pc + bytes) & 0xff00) ? 1 : 0);
          const untaken = inverse.cost.minCycles + jump.cost.minCycles;
          return {
            ...block,
            terminator: {
              kind: "long-branch" as const,
              opcode: inverse.opcode,
              fallthrough: block.label,
              jump: { opcode: "jmp" as const, target: target.id, cost: jump.cost },
              uses: inverse.uses,
              cost: {
                bytes,
                minCycles: Math.min(taken, untaken),
                maxCycles: Math.max(taken, untaken),
              },
            },
          };
        }
        const operand: MachineInstruction["operand"] =
          entry === "startup-label"
            ? { kind: "label", label: target.id }
            : entry === "startup-offset"
              ? { kind: "label", label: target.id, offset: 1 }
              : entry === "main-offset-alias"
                ? { kind: "label", label: caller.id, offset: target.origin! - caller.origin! + 1 }
                : { kind: "absolute", value: target.origin! + (entry === "main-interior" ? 1 : 0) };
        return {
          ...block,
          instructions: [
            ...block.instructions,
            machineInstruction(input.checked.profile.cpu, "jsr", "absolute", operand),
          ],
        };
      }),
    };
    const changedProgram =
      owner === program.startup
        ? { ...program, startup: changed }
        : { ...program, functions: program.functions.map((fn) => (fn === owner ? changed : fn)) };
    const modifiedShared = { ...shared, layout: { ...shared.layout, program: changedProgram } };
    const modified = reference
      ? { ...input, reference: { ...input.reference, shared: modifiedShared } }
      : { ...input, candidate: { ...input.candidate, shared: modifiedShared } };
    expect(edits, entry).toBe(1);
    expect(validateFieldComplements(modified, effects, selected, packet), entry).not.toBeNull();
    expect(validateSizeObservers(modified).kind, entry).toBe("error");
  });
  it.each(
    [false, true].flatMap((bounds) =>
      [true, false].flatMap((reference) =>
        [
          "jump",
          "numeric-call",
          "offset-call",
          "interior-read",
          "byte-reference",
          "direct-label",
        ].map((entry) => ({ bounds, reference, entry })),
      ),
    ),
  )("should retain sole ownership of the real caller bridge %j", ({ bounds, reference, entry }) => {
    const input = effectFixture(SAVED, "size", bounds, "original");
    expect(validateSizeObservers(input).kind).toBe("complete");
    const selected = input.candidate.lowered.program.functions.find(
      (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
    )!;
    const packet = [
      ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
    ].find((p) => p.function.id === selected.sourceFunction)!;
    const owners = new Set(
      [...packet.storage!.parameters.values()][0]!.calls.map((call) => call.owner),
    );
    const shared = reference ? input.reference.shared : input.candidate.shared;
    const symbolic = reference
      ? input.reference.checked.lowered.program
      : input.candidate.lowered.program;
    const program = shared.layout.program;
    const caller = program.functions.find((fn) => {
      const old = symbolic.functions.find((old) => old.id === fn.id);
      return (
        fn.sourceFunction !== undefined &&
        owners.has(fn.sourceFunction) &&
        old !== undefined &&
        fn.blocks.some(
          (block) =>
            !old.blocks.some((old) => old.label === block.label) &&
            block.instructions.length === 0 &&
            block.terminator.kind === "jump",
        )
      );
    });
    if (caller === undefined)
      throw new Error("Expected a real recorded caller with a layout-created bridge");
    const original = symbolic.functions.find((fn) => fn.id === caller.id)!;
    const bridge = caller.blocks.find(
      (block) =>
        !original.blocks.some((old) => old.label === block.label) &&
        block.instructions.length === 0 &&
        block.terminator.kind === "jump",
    )!;
    expect(bridge.terminator).toMatchObject({
      kind: "jump",
      opcode: "jmp",
      cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
    });
    expect(Number.isSafeInteger(bridge.origin)).toBe(true);
    const startup = {
      ...program.startup,
      blocks: program.startup.blocks.map((block, index) => {
        if (index !== 0) return block;
        if (entry === "jump")
          return {
            ...block,
            terminator: {
              kind: "jump" as const,
              opcode: "jmp" as const,
              target: bridge.label,
              cost: machineInstruction(input.checked.profile.cpu, "jmp", "absolute", {
                kind: "label",
                label: bridge.label,
              }).cost,
            },
          };
        const operand: MachineInstruction["operand"] =
          entry === "numeric-call" || entry === "interior-read"
            ? { kind: "absolute", value: bridge.origin! + (entry === "interior-read" ? 1 : 0) }
            : entry === "direct-label"
              ? { kind: "label", label: bridge.label }
              : {
                  kind: "label",
                  label: caller.id,
                  offset:
                    bridge.origin! -
                    (caller.origin ?? caller.blocks[0]!.origin!) +
                    (entry === "byte-reference" ? 2 : 0),
                  ...(entry === "byte-reference" ? { addressByte: "high" as const } : {}),
                };
        const instruction = machineInstruction(
          input.checked.profile.cpu,
          entry === "interior-read" || entry === "byte-reference" ? "lda" : "jsr",
          entry === "byte-reference" ? "immediate" : "absolute",
          operand,
        );
        return { ...block, instructions: [...block.instructions, instruction] };
      }),
    };
    const changed = { ...shared, layout: { ...shared.layout, program: { ...program, startup } } };
    const modified = reference
      ? { ...input, reference: { ...input.reference, shared: changed } }
      : { ...input, candidate: { ...input.candidate, shared: changed } };
    const effects = validateResidualEffects(modified);
    expect(effects.kind).toBe("complete");
    if (effects.kind !== "complete") throw new Error(effects.reason);
    expect(validateByteWindowObservers(modified, effects)).toBeNull();
    expect(validateFieldComplements(modified, effects, selected, packet)).not.toBeNull();
    expect(validateSizeObservers(modified).kind).toBe("error");
  });
  it.each(
    [false, true].flatMap((bounds) =>
      ["binding", "lifetime", "selected-demand"].map((fault) => ({ bounds, fault })),
    ),
  )("should retain unary-left capture obligations %j", ({ bounds, fault }) => {
    const input = effectFixture(COMPOSED, "size", bounds, "original");
    expect(validateSizeObservers(input).kind).toBe("complete");
    const selected = input.candidate.lowered.program.functions.find(
      (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
    )!;
    const packet = [
      ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
    ].find((p) => p.function.id === selected.sourceFunction)!;
    const unary = packet.function.blocks
      .flatMap((b) => b.operations)
      .find(
        (op) =>
          op.kind === "unary" &&
          selected.byteComplementProofs!.some((proof) => proof.preservedLeft === op.result),
      )!;
    const original = input.reference.checked.lowered.program.functions.find(
      (fn) => fn.id === selected.id,
    )!;
    const operand = original.blocks
      .flatMap((b) => b.instructions)
      .find((item) => item.opcode === "sta" && item.source === unary.span)?.operand;
    if (operand?.kind !== "storage") throw new Error("Expected the real held unary-left store");
    const declared = input.reference.shared.certificate.inventory.requests.find(
      (r) => r.id === operand.requestId,
    )!;
    expect(declared).toMatchObject({ storageClass: "temporary", binding: null, bytes: 1 });
    const side = fault === "selected-demand" ? input.candidate.shared : input.reference.shared;
    const requests =
      fault === "selected-demand"
        ? [...side.certificate.inventory.requests, declared]
        : side.certificate.inventory.requests.map((r) =>
            r !== declared
              ? r
              : fault === "binding"
                ? { ...r, binding: selected.byteComplementProofs![0]!.binding }
                : { ...r, lifetime: { ...r.lifetime, liveAt: [] } },
          );
    const changed = {
      ...side,
      certificate: { ...side.certificate, inventory: { ...side.certificate.inventory, requests } },
    };
    const modified =
      fault === "selected-demand"
        ? { ...input, candidate: { ...input.candidate, shared: changed } }
        : { ...input, reference: { ...input.reference, shared: changed } };
    const effects = validateResidualEffects(input);
    if (effects.kind !== "complete") throw new Error(effects.reason);
    expect(validateFieldComplements(modified, effects, selected, packet)).not.toBeNull();
    expect(validateSizeObservers(modified).kind).toBe("error");
  });
  it.each(
    [false, true].flatMap((bounds) => ["missing", "duplicate"].map((fault) => ({ bounds, fault }))),
  )("should account for the actual retained byte window %j", ({ bounds, fault }) => {
    const input = effectFixture(SAVED, "size", bounds, "original");
    expect(validateSizeObservers(input).kind).toBe("complete");
    const selected = input.candidate.lowered.program.functions.find(
      (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
    )!;
    const packet = [
      ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
    ].find((p) => p.function.id === selected.sourceFunction)!;
    const proofs = selected.byteAvailabilityProofs ?? [];
    expect(proofs.length).toBeGreaterThan(0);
    const changed = {
      ...selected,
      byteAvailabilityProofs: fault === "missing" ? [] : [...proofs, proofs[0]!],
    };
    const modified = {
      ...input,
      candidate: {
        ...input.candidate,
        lowered: {
          ...input.candidate.lowered,
          program: {
            ...input.candidate.lowered.program,
            functions: input.candidate.lowered.program.functions.map((fn) =>
              fn === selected ? changed : fn,
            ),
          },
        },
      },
    };
    const effects = validateResidualEffects(input);
    if (effects.kind !== "complete") throw new Error(effects.reason);
    expect(validateFieldComplements(modified, effects, changed, packet)).not.toBeNull();
    expect(validateSizeObservers(modified).kind).toBe("error");
  });
});
