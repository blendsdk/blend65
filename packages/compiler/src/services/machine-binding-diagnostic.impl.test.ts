import { describe, expect, it } from "vitest";
import { bindMachineProgram } from "../machine/bind.js";
import { machineProgramDefect } from "../machine/machine-defect.js";
import type { MachineFunction, MachineProgram } from "../machine/machine-types.js";
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
