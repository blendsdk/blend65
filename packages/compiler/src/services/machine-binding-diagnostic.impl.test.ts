import { describe, expect, it } from "vitest";
import { bindMachineProgram } from "../machine/bind.js";
import { machineProgramDefect } from "../machine/machine-defect.js";
import type {
  MachineFunction,
  MachineInstruction,
  MachineOperand,
  MachineProgram,
} from "../machine/machine-types.js";
import type { StorageClosureCertificate, StorageRequest } from "../storage/storage-types.js";
import type { SourceSpan } from "../project/types.js";
import { machineBindingDiagnostic } from "./machine-binding-diagnostic.js";

/**
 * When the compiler gives up on a program it still has to say where.
 *
 * An author working on a machine with no debugger cannot act on a stage name, and cannot report
 * a defect they are unable to locate. These cases judge the refusal an author actually receives:
 * that it carries the construct's own location, names the failing instruction, and says plainly
 * that it reports a limitation of the compiler rather than a mistake on the line it points at.
 *
 * They are written against the presence and the content of the location rather than an exact
 * offset. Which internal check reports first follows a work-list order — deterministic for a
 * given program, but not canonical — so pinning an offset would make an unrelated and correct
 * change look like a regression.
 */

/** A span proves the refusal points at the construct rather than at a default location. */
const span: SourceSpan = { sourceId: "src/game.blend", start: 125, end: 140 };

/** The function an author wrote, named as the source spells it. */
const owner: MachineFunction = { id: "fn.main", sourceName: "Game.main", blocks: [] };

const program: MachineProgram = {
  startup: { id: "startup", blocks: [] },
  functions: [owner],
  data: [],
  requiredStorage: [],
};

/**
 * The refusal for a flag consumer whose producer no path establishes.
 *
 * This is the shape a real failure takes: an addition selected from the author's source, in a
 * generated block, with the flag it reads named in the reason.
 */
function flagProofRefusal() {
  return machineBindingDiagnostic({
    program,
    defect: machineProgramDefect({
      stage: "machine flag proof",
      reason: "the selected 'adc' has no proved producer for its decimal flag",
      functionId: owner.id,
      label: "fn.main.entry",
      instruction: { opcode: "adc", source: span },
    }),
    fallbackSpan: null,
  });
}

describe("a machine-stage refusal reports where it gave up", () => {
  it("should carry the failing construct's own source location", () => {
    const diagnostic = flagProofRefusal();

    expect(diagnostic.code).toBe("COMPILER_INCOMPLETE");
    expect(
      diagnostic.primarySpan,
      "a refusal with no location leaves nothing to act on",
    ).not.toBeNull();
    expect(diagnostic.primarySpan).toEqual(span);
  });

  it("should name the construct it failed on rather than only the stage", () => {
    // Naming the owning function and the selected instruction is what makes the message
    // actionable. A bare stage name could describe any program at all.
    const { message } = flagProofRefusal();

    expect(message).toContain("main");
    expect(message.toLowerCase()).toContain("adc");
  });

  it("should say plainly that it reports a compiler limitation, not a bad line", () => {
    // A caret under correct source invites the author to edit a line that is not wrong, so the
    // message has to carry that disclaimer with it.
    const { help } = flagProofRefusal();

    expect(help, "a located limitation must explain that the line is not at fault").not.toBeNull();
    expect((help ?? "").toLowerCase()).toContain("compiler limitation");
  });

  it("should keep the generated block identity out of the primary sentence", () => {
    // A generated label is evidence for whoever receives a bug report and means nothing to
    // whoever wrote the program, so it belongs in the help line and nowhere else.
    const diagnostic = flagProofRefusal();

    expect(diagnostic.message).not.toContain("fn.main.entry");
    expect(diagnostic.help ?? "").toContain("fn.main.entry");
  });

  it("should name no internal planning identifier in anything the author reads", () => {
    const diagnostic = flagProofRefusal();
    const shown = `${diagnostic.message} ${diagnostic.help ?? ""} ${diagnostic.pointer ?? ""}`;

    expect(shown, "user-facing text must not leak an internal tracking identifier").not.toMatch(
      /\b(?:RD|AR|T)-\d+|\bissues?\/\d+|#\d{2,}/u,
    );
  });

  it("should still report the stage when a refusal carries no failed check", () => {
    // A storage refusal records its witness elsewhere, so this one has no construct to name.
    // What it may not do is change which code an author sees for a compiler that gave up.
    const diagnostic = machineBindingDiagnostic({ program, defect: undefined, fallbackSpan: null });

    expect(diagnostic.code).toBe("COMPILER_INCOMPLETE");
    expect(diagnostic.message).toContain("machine storage binding");
  });
});

/**
 * Binding a value to storage can fail before any instruction is implicated: the demand exists
 * and the certificate supplies no usable home for it. Those refusals have no failing instruction
 * to point at, but the demand itself knows which source asked for the storage, so the refusal an
 * author receives must still say where.
 *
 * These programs are built by hand because no source program reaches these checks — both guard
 * the agreement between a program and its own storage certificate, which the compiler constructs.
 * That is why they are judged here rather than through a build.
 */

/** The declaration that asked for storage, which is what the refusal has to point at. */
const declaration: SourceSpan = { sourceId: "src/game.blend", start: 61, end: 67 };

/** Source identity shared by the request's owner and the machine body that carries it. */
const ownerId = { sourceId: declaration.sourceId, span: declaration };

/** One ordinary demand for a byte of storage, owned by a function an author wrote. */
function storageRequest(source: SourceSpan | null): StorageRequest {
  return {
    id: "local.i",
    storageClass: "local",
    owner: ownerId,
    binding: null,
    value: "i",
    type: null,
    bytes: 1,
    alignment: 1,
    region: "ram",
    lifetime: {
      function: ownerId,
      value: "i",
      definition: { block: "entry", operation: 0 },
      liveAt: [],
      callsCrossed: [],
    },
    source,
    reason: "Static local home",
  };
}

/** A program whose only function is the one that owns the demand. */
function programFor(request: StorageRequest, certified: readonly StorageRequest[]): MachineProgram {
  return {
    functions: [{ id: "fn.main", sourceName: "Game.main", sourceFunction: ownerId, blocks: [] }],
    data: [],
    startup: { id: "startup", blocks: [] },
    requiredStorage: [request],
    certifiedStorage: certified,
  };
}

/** A closed certificate offering exactly the homes it is given. */
function certificateWith(homes: StorageClosureCertificate["homes"]): StorageClosureCertificate {
  return {
    inventoryHash: "inventory",
    graphHash: "graph",
    profileId: "c64-pal-prg-kernal-6581",
    homes,
    interference: [],
    helperCalls: [],
    staticBytes: { ram: homes.length, zeroPage: 0 },
    peakBytes: { ram: homes.length, zeroPage: 0 },
    hardwareStackPeak: 0,
    hardwareStackProgramPeak: 0,
    hardwareStackSystemPeak: 0,
    hardwareStackRoute: [],
    closed: true,
  };
}

/** Bind a program that cannot bind, and format the refusal an author would receive. */
function refusalFor(program: MachineProgram, certificate: StorageClosureCertificate) {
  const bound = bindMachineProgram(program, certificate);
  expect(bound.kind, "this program is expected to be refused, not bound").toBe("error");
  if (bound.kind !== "error") throw new Error("The program bound");
  return {
    bound,
    diagnostic: machineBindingDiagnostic({
      program,
      defect: bound.defect,
      fallbackSpan: null,
    }),
  };
}

/** A demand the certificate never gave a home at all. */
function withoutAHome(source: SourceSpan | null = declaration) {
  const request = storageRequest(source);
  return refusalFor(programFor(request, []), certificateWith([]));
}

/** A demand whose home does not supply the width it asked for. */
function withAnUnusableHome() {
  const request = storageRequest(declaration);
  return refusalFor(
    programFor(request, [request]),
    certificateWith([{ requestId: request.id, address: 0x3000, bytes: 2, region: "ram" }]),
  );
}

describe("a storage-binding refusal names the demand it failed on", () => {
  it("should point at the declaration that asked for storage it never received", () => {
    const { bound, diagnostic } = withoutAHome();

    expect(bound.reason).toBe("missing-storage");
    expect(diagnostic.code).toBe("COMPILER_INCOMPLETE");
    expect(diagnostic.primarySpan, "a refusal with no location leaves nothing to act on").toEqual(
      declaration,
    );
    expect(diagnostic.message).toContain("main");
    expect(diagnostic.message).toContain("Static local home");
  });

  it("should point at the declaration whose home cannot satisfy it", () => {
    const { bound, diagnostic } = withAnUnusableHome();

    expect(bound.reason).toBe("invalid-storage");
    expect(diagnostic.primarySpan).toEqual(declaration);
    expect(diagnostic.message).toContain("main");
    expect(diagnostic.message).toContain("Static local home");
  });

  it("should say plainly that it reports a compiler limitation, not a bad line", () => {
    for (const { diagnostic } of [withoutAHome(), withAnUnusableHome()]) {
      expect((diagnostic.help ?? "").toLowerCase()).toContain("compiler limitation");
      expect(diagnostic.help ?? "").toContain("not an error on this line");
    }
  });

  it("should name no internal planning identifier in anything the author reads", () => {
    for (const { diagnostic } of [withoutAHome(), withAnUnusableHome()]) {
      const shown = `${diagnostic.message} ${diagnostic.help ?? ""} ${diagnostic.pointer ?? ""}`;

      expect(shown, "user-facing text must not leak an internal tracking identifier").not.toMatch(
        /\b(?:RD|AR|T)-\d+|\bissues?\/\d+|#\d{2,}/u,
      );
    }
  });

  it("should still name the demand when it carries no source of its own", () => {
    // Target-created scratch need not come from anything the author wrote. The refusal then has
    // no line to point at and must not claim one, but it can still say which demand failed.
    const { diagnostic } = withoutAHome(null);

    expect(diagnostic.primarySpan).toBeNull();
    expect(diagnostic.message).toContain("Static local home");
    expect((diagnostic.help ?? "").toLowerCase()).toContain("compiler limitation");
    expect(diagnostic.help ?? "").not.toContain("not an error on this line");
  });
});

/**
 * Binding can also fail on an instruction, and three unrelated checks produce that failure.
 *
 * The demand may have no home at all, the byte reached may lie outside the home that was
 * selected, or the home chosen for an indirect pointer may end at the last byte of a page, where
 * this processor reads the high byte from the start of the same page rather than the next one.
 * Collapsing all three into one sentence would state a cause that did not fire, so each refusal
 * names the check that did and points at the instruction that provoked it.
 *
 * The demand check one step earlier has already proved every required demand has a home, so
 * "no storage home was selected" is the wrong sentence for most of these.
 */

/** The instruction an author's source selected, which is what these refusals must point at. */
const selected: SourceSpan = { sourceId: "src/game.blend", start: 204, end: 219 };

/** One load through a storage operand, which is all these cases need in order to fail binding. */
function loadThrough(operand: MachineOperand, mode = "storage"): MachineInstruction {
  return {
    opcode: "lda",
    mode,
    operand,
    uses: { registers: [], flags: [] },
    defines: { registers: [], flags: [] },
    memory: [],
    cost: { bytes: 3, minCycles: 4, maxCycles: 4 },
    source: selected,
  };
}

/** A body holding that one instruction, under the label a bug report would quote. */
function bodyWith(id: string, instruction: MachineInstruction): MachineFunction {
  return {
    id,
    sourceName: id === "fn.main" ? "Game.main" : undefined,
    sourceFunction: ownerId,
    blocks: [
      {
        label: `${id}.entry`,
        instructions: [instruction],
        terminator: { kind: "return", opcode: "rts" },
      },
    ],
  };
}

/** Refuse a program whose one instruction cannot bind, and format what an author receives. */
function unboundRefusal(
  instruction: MachineInstruction,
  requests: readonly StorageRequest[],
  homes: StorageClosureCertificate["homes"],
  inStartup = false,
) {
  const body = bodyWith(inStartup ? "startup" : "fn.main", instruction);
  const program: MachineProgram = {
    functions: inStartup ? [] : [body],
    data: [],
    startup: inStartup ? body : { id: "startup", blocks: [] },
    requiredStorage: requests,
  };
  return refusalFor(program, certificateWith(homes));
}

/** A pointer-sized demand, for the cases that need a home the operand can resolve. */
function pointerRequest(bytes: 1 | 2): StorageRequest {
  return { ...storageRequest(declaration), id: "local.p", bytes };
}

describe("a refusal whose function failed binding names the instruction", () => {
  it("should report storage the certificate gave no home at all", () => {
    const { bound, diagnostic } = unboundRefusal(
      loadThrough({ kind: "storage", requestId: "scratch.0" }),
      [],
      [],
    );

    expect(bound.reason).toBe("invalid-storage");
    expect(diagnostic.code).toBe("COMPILER_INCOMPLETE");
    expect(diagnostic.primarySpan, "a refusal with no location leaves nothing to act on").toEqual(
      selected,
    );
    expect(diagnostic.message).toContain("main");
    expect(diagnostic.message).toContain("no home for the storage");
  });

  it("should report a byte reached outside the home that was selected", () => {
    // The demand has a home and the instruction asks for a byte past its end, so naming a
    // missing home would describe a check that passed one step earlier.
    const request = pointerRequest(1);
    const { diagnostic } = unboundRefusal(
      loadThrough({ kind: "storage", requestId: request.id, offset: 1 }),
      [request],
      [{ requestId: request.id, address: 0x3000, bytes: 1, region: "ram" }],
    );

    expect(diagnostic.primarySpan).toEqual(selected);
    expect(diagnostic.message).toContain("outside the home selected");
  });

  it("should report an indirect pointer whose home ends a page", () => {
    // The 6502 reads the high byte of an indirect pointer from the start of the same page, so a
    // pointer at $xxFF reads an address the program never formed. An author can act on this one
    // by moving the object, which is why the refusal says what the hardware does.
    const request = pointerRequest(2);
    const { diagnostic } = unboundRefusal(
      loadThrough({ kind: "storage", requestId: request.id }, "indirect"),
      [request],
      [{ requestId: request.id, address: 0x30ff, bytes: 2, region: "ram" }],
    );

    expect(diagnostic.primarySpan).toEqual(selected);
    expect(diagnostic.message).toContain("last byte of a page");
  });

  it("should name generated startup code rather than inventing a function", () => {
    const { diagnostic } = unboundRefusal(
      loadThrough({ kind: "storage", requestId: "scratch.0" }),
      [],
      [],
      true,
    );

    expect(diagnostic.message).toContain("generated startup code");
    expect(diagnostic.message).toContain("no home for the storage");
  });

  it("should keep the generated block identity and the opcode out of the primary sentence", () => {
    const { diagnostic } = unboundRefusal(
      loadThrough({ kind: "storage", requestId: "scratch.0" }),
      [],
      [],
    );

    expect(diagnostic.message).not.toContain("fn.main.entry");
    expect(diagnostic.help ?? "").toContain("fn.main.entry");
    expect(diagnostic.help ?? "").toContain("lda");
  });

  it("should say plainly that it reports a compiler limitation, not a bad line", () => {
    const { diagnostic } = unboundRefusal(
      loadThrough({ kind: "storage", requestId: "scratch.0" }),
      [],
      [],
    );

    expect((diagnostic.help ?? "").toLowerCase()).toContain("compiler limitation");
    expect(diagnostic.help ?? "").toContain("not an error on this line");
  });

  it("should name no internal planning identifier in anything the author reads", () => {
    const { diagnostic } = unboundRefusal(
      loadThrough({ kind: "storage", requestId: "scratch.0" }),
      [],
      [],
    );
    const shown = `${diagnostic.message} ${diagnostic.help ?? ""} ${diagnostic.pointer ?? ""}`;

    expect(shown, "user-facing text must not leak an internal tracking identifier").not.toMatch(
      /\b(?:RD|AR|T)-\d+|\bissues?\/\d+|#\d{2,}/u,
    );
  });
});

/**
 * A refusal that disagrees with the program as a whole has no construct to name.
 *
 * The certificate's own closed marker and a certificate whose identity does not match the program
 * implicate no demand, no function and no instruction, so naming one would be an invention. What
 * such a refusal can do is point at the program it was asked about: every caller already hands the
 * main function's span over, and discarding it left the refusal pointing nowhere.
 */

/** Refuse a program whose certificate identity does not match it, which names no demand. */
function wholeProgramRefusal(fallbackSpan: SourceSpan | null) {
  const program: MachineProgram = {
    functions: [{ id: "fn.main", sourceName: "Game.main", sourceFunction: ownerId, blocks: [] }],
    data: [],
    startup: { id: "startup", blocks: [] },
    requiredStorage: [],
    storageProfileId: "a-different-profile",
  };
  const bound = bindMachineProgram(program, certificateWith([]));
  expect(bound.kind, "this program is expected to be refused, not bound").toBe("error");
  if (bound.kind !== "error") throw new Error("The program bound");
  expect(bound.requestId, "a whole-program disagreement names no single demand").toBeNull();
  expect(bound.defect, "there is no construct for this refusal to carry").toBeUndefined();
  return machineBindingDiagnostic({ program, defect: bound.defect, fallbackSpan });
}

describe("a refusal that can name no construct still points where it is told", () => {
  it("should carry the location its caller supplies", () => {
    const diagnostic = wholeProgramRefusal(declaration);

    expect(diagnostic.code).toBe("COMPILER_INCOMPLETE");
    expect(diagnostic.primarySpan, "the caller already knows which program failed").toEqual(
      declaration,
    );
    expect((diagnostic.help ?? "").toLowerCase()).toContain("compiler limitation");
    expect(diagnostic.help ?? "").toContain("not an error on this line");
  });

  it("should claim no location when its caller supplies none", () => {
    // Pointing at a default location is worse than pointing nowhere: it sends an author off to
    // edit a line that is not involved in the refusal at all.
    const diagnostic = wholeProgramRefusal(null);

    expect(diagnostic.primarySpan).toBeNull();
    expect(diagnostic.message).toContain("machine storage binding");
    expect(diagnostic.help ?? "").not.toContain("not an error on this line");
  });
});
