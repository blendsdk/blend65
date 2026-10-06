import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { ProjectSnapshot } from "../project/types.js";
import { selectTargetProfile } from "../target/profile.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { interruptWriteAddresses } from "./interrupt-address-facts.js";
import {
  interruptCaptureFailure,
  interruptLinkObservers,
  interruptVectorStateKey,
} from "./interrupt-context-facts.js";
import type { LinkCapture, VectorState } from "./interrupt-context-facts.js";
import { buildSemanticProgram } from "./lower.js";
import { closeWholeProgram } from "./whole-program.js";

/** Lower real source in memory; these semantic tests need neither ACME nor a host project. */
function lowerSource(text: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const target = "c64-pal-prg-kernal-6581";
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "nmi-lifetime",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: hash("{}"),
      byteLength: 2,
      resolvedPath: "/probe/blend65.json",
    },
    sources: [
      {
        sourceId: "src/game.blend",
        text,
        sha256: hash(text),
        byteLength: Buffer.byteLength(text),
        resolvedPath: "/probe/src/game.blend",
      },
    ],
    inputSha256: hash(text),
    projectRoot: "/probe",
    sourceRoot: "/probe/src",
    assetPaths: [],
    outDir: "/probe/out",
    overrides: { target: null, entry: null },
    effectiveTarget: target,
    effectiveEntry: "Game",
  };
  const selected = selectTargetProfile(target);
  if (selected.kind !== "complete") throw new Error("Missing selected profile");
  const analyzed = analyzeProject(snapshot);
  expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
  if (analyzed.kind !== "complete") throw new Error("Frontend rejected the source");
  const lowered = buildSemanticProgram(analyzed);
  expect(lowered.kind, JSON.stringify(lowered.diagnostics)).toBe("complete");
  if (lowered.kind !== "complete") throw new Error("Semantic lowering rejected the source");
  return { semantic: lowered.program, profile: selected.profile };
}

describe("initializer callee storage domains", () => {
  it("retains main and IRQ homes for a helper reached from an initializer and a handler", () => {
    const { semantic, profile } = lowerSource(`module Game;
import {setIRQ,restoreIRQ} from c64.system;
let first:byte=peek($c010);
let out:byte=choose(first,inner(7));
function inner(x:byte):byte{return x;}
function choose(a:byte,b:byte):byte{return a;}
interrupt function handler():void {poke($c018,inner(9));}
function main():void {setIRQ(&handler);restoreIRQ();poke($c016,out);}`);
    const closed = closeWholeProgram(semantic, profile.interrupts, profile.storage);
    expect(closed.kind).toBe("complete");
    if (closed.kind !== "complete") throw new Error("Initializer call graph did not close");
    const inner = semantic.functions.find((fn) => fn.name === "Game.inner");
    if (inner === undefined) throw new Error("Missing source helper");
    const inventory = inventoryStorage(closed.program);
    const parameters = inventory.requests.filter(
      (request) =>
        request.storageClass === "parameter" &&
        bindingIdentityKey(request.owner) === bindingIdentityKey(inner.id),
    );
    expect(parameters.map(({ domain }) => domain).sort()).toEqual(["irq", "main"]);
    const staged = inventory.requests.find((request) =>
      request.id.includes("argument-stage:initializer:"),
    );
    if (staged === undefined) throw new Error("Missing live outer argument");
    const graph = buildInterference(inventory);
    for (const parameter of parameters) {
      expect(
        graph.some(
          ({ left, right }) =>
            (left === staged.id && right === parameter.id) ||
            (right === staged.id && left === parameter.id),
        ),
      ).toBe(true);
    }
  });
});

/** Obtain real selected entries, including two bindings of the same callback to different tails. */
function captures() {
  const { semantic, profile } = lowerSource(`module Game;
import {setNMI,restoreNMI} from c64.system;
interrupt function B():void {}
interrupt function C():void {}
function main():void {setNMI(&B);setNMI(&C);setNMI(&B);restoreNMI();restoreNMI();restoreNMI();}`);
  const closed = closeWholeProgram(semantic, profile.interrupts, profile.storage);
  expect(closed.kind, JSON.stringify(closed.kind === "error" ? closed.diagnostics : [])).toBe(
    "complete",
  );
  if (closed.kind !== "complete") throw new Error("The finite chain did not close");
  const program = closed.program;
  const entries = [...(program.interruptContextAnalysis?.bindings.values() ?? [])]
    .flatMap((binding) => binding.captures.map((capture) => capture.entry))
    .sort(
      (left, right) => left.route.installation.span.start - right.route.installation.span.start,
    );
  expect(entries).toHaveLength(3);
  const [b, c, repeatedB] = entries;
  if (b?.tail === undefined || c?.tail === undefined || repeatedB?.tail === undefined)
    throw new Error("A returning chain lacks its predecessor word");
  const stock: LinkCapture = { entry: null, path: [] };
  const first: LinkCapture = { entry: b, path: [b.route.installation.span] };
  const second: LinkCapture = { entry: c, path: [c.route.installation.span] };
  const state: VectorState = {
    vectors: { irq: null, nmi: null },
    words: new Map([
      [b.tail, stock],
      [c.tail, first],
      [repeatedB.tail, second],
    ]),
    owners: { irq: [], nmi: [] },
    enabled: false,
    eligible: false,
    saved: [],
    path: [],
  };
  return { program, b, c, repeatedB, stock, first, state };
}

/** Recover the exact address of one genuine source write, independently of vector admission. */
function writeFact(statements: string, declarations = "") {
  const lowered = lowerSource(`module Game;
import {setNMI,restoreNMI} from c64.system;
${declarations}
interrupt function B():void {}
function main():void {setNMI(&B);${statements}restoreNMI();}`);
  const main = lowered.semantic.functions.find((fn) => fn.name === "Game.main");
  if (main === undefined) throw new Error("Missing source main");
  const writes = main.blocks
    .flatMap((block) => block.operations)
    .filter((operation) => operation.kind === "memory-write");
  expect(writes).toHaveLength(1);
  const operation = writes[0]!;
  const addresses = interruptWriteAddresses(
    lowered.semantic,
    main.entry,
    main.blocks,
    true,
    { irq: new Set(), nmi: new Set() },
    lowered.profile.storage,
  );
  return { ...lowered, operation, address: addresses.get(operation) };
}

describe("immutable predecessor observer lifetime", () => {
  it("should permit equal complete captures despite different object or path identity", () => {
    const { b, c, first } = captures();
    const equal: LinkCapture = { entry: { ...b }, path: [c.route.installation.span] };
    expect(
      interruptCaptureFailure(c.tail!, equal, new Map([[c.tail!, first]]), c.route),
    ).toBeNull();
    expect(
      interruptCaptureFailure(
        b.tail!,
        { entry: null, path: [] },
        new Map([[b.tail!, { entry: null, path: [b.route.installation.span] }]]),
        b.route,
      ),
    ).toBeNull();
  });

  it("should reject a changed continuation even when the source callback is the same", () => {
    const { b, c, repeatedB, first } = captures();
    expect(bindingIdentityKey(b.route.handler)).toBe(bindingIdentityKey(repeatedB.route.handler));
    expect(b.id).not.toBe(repeatedB.id);
    expect(b.tail).not.toBe(repeatedB.tail);
    const next: LinkCapture = {
      entry: repeatedB,
      path: [c.route.installation.span, repeatedB.route.installation.span],
    };
    const failure = interruptCaptureFailure(c.tail!, next, new Map([[c.tail!, first]]), c.route);
    expect(failure).toMatchObject({
      code: "E10245",
      severity: "error",
      primarySpan: c.route.installation.span,
    });
    expect(failure!.related.map(({ span }) => span)).toEqual(next.path);
  });

  it("should retain complete chain readers after logical owners have popped", () => {
    const { program, b, c, first, stock, state } = captures();
    expect(state.owners.nmi).toHaveLength(0);
    const readers = interruptLinkObservers(state, new Map(), c, program);
    expect([...readers.keys()].sort()).toEqual([b.tail!, c.tail!].sort());
    expect(readers.get(c.tail!)).toBe(first);
    expect(readers.get(b.tail!)).toBe(stock);
    expect(interruptCaptureFailure(c.tail!, stock, readers, c.route)?.code).toBe("E10245");
  });

  it("should retain inherited suspended readers until the last continuation ends", () => {
    const { program, c, stock, state } = captures();
    const suspended = interruptLinkObservers(state, new Map(), c, program);
    const afterPop = interruptLinkObservers(state, suspended, undefined, program);
    expect([...afterPop]).toEqual([...suspended]);
    expect(interruptCaptureFailure(c.tail!, stock, afterPop, c.route)?.code).toBe("E10245");
    const ended = interruptLinkObservers(state, new Map(), undefined, program);
    expect(ended.size).toBe(0);
    expect(interruptCaptureFailure(c.tail!, stock, ended, c.route)).toBeNull();
  });

  it("should close transitive tails inherited through a suspended reader", () => {
    const { program, b, c, first, stock, state } = captures();
    const readers = interruptLinkObservers(state, new Map([[c.tail!, first]]), undefined, program);
    expect([...readers.keys()].sort()).toEqual([b.tail!, c.tail!].sort());
    expect(readers.get(b.tail!)).toBe(stock);
  });

  it("should protect published entries independently of logical owners", () => {
    const { program, b, c, state } = captures();
    const published = { ...state, vectors: { irq: null, nmi: c } };
    const readers = interruptLinkObservers(published, new Map(), undefined, program);
    expect([...readers.keys()].sort()).toEqual([b.tail!, c.tail!].sort());
  });
});

describe("fixed-width vector write addresses", () => {
  it("should normalize unsigned word arithmetic before checking vector aliasing", () => {
    const result = writeFact("let address:word=$ffff;address+=$0319;pokew(address,0);");
    expect(result.address).toBe(0x0318n);
    expect(result.operation.width).toBe(2);
    const closed = closeWholeProgram(
      result.semantic,
      result.profile.interrupts,
      result.profile.storage,
    );
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("A live vector overwrite was admitted");
    expect(
      closed.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
    ).toEqual(["E10278"]);
  });

  it("should include the second byte of a word write in vector ownership", () => {
    const result = writeFact("let address:word=$0317;pokew(address,0);");
    expect(result.address).toBe(0x0317n);
    expect(result.operation.width).toBe(2);
    const closed = closeWholeProgram(
      result.semantic,
      result.profile.interrupts,
      result.profile.storage,
    );
    expect(closed.kind).toBe("error");
    if (closed.kind !== "error") throw new Error("The second vector byte was ignored");
    expect(closed.diagnostics.some(({ code }) => code === "E10278")).toBe(true);
  });

  it("should preserve ordinary known-global arithmetic at a disjoint address", () => {
    const result = writeFact(
      "let address:word=destination;address+=1;poke(address,9);",
      "let destination:word=$0400;",
    );
    expect(result.address).toBe(0x0401n);
    expect(result.operation.width).toBe(1);
    expect(
      closeWholeProgram(result.semantic, result.profile.interrupts, result.profile.storage).kind,
    ).toBe("complete");
  });

  it("should ignore only unobserved capture history in proof equality", () => {
    const { program, state } = captures();
    const readers = interruptLinkObservers(state, new Map(), undefined, program);
    expect(readers.size).toBe(0);
    expect(interruptVectorStateKey(state, readers)).toBe(
      interruptVectorStateKey({ ...state, words: new Map() }, readers),
    );
    expect(state.words.size).toBe(3);
  });

  it("should keep every transitive active-entry capture distinct in proof equality", () => {
    const { program, state, repeatedB, b, first } = captures();
    const readers = interruptLinkObservers(state, new Map(), repeatedB, program);
    expect(readers.size).toBe(3);
    const changed = { ...state, words: new Map([...state.words, [b.tail!, first]]) };
    expect(interruptVectorStateKey(state, readers)).not.toBe(
      interruptVectorStateKey(changed, readers),
    );
  });

  it("should retain a protected suspended reader while ignoring unrelated old captures", () => {
    const { program, state, b, stock, c } = captures();
    const readers = interruptLinkObservers(state, new Map([[b.tail!, stock]]), undefined, program);
    expect(readers.size).toBe(1);
    const changed = { ...state, words: new Map([...state.words, [c.tail!, stock]]) };
    expect(interruptVectorStateKey(state, readers)).toBe(interruptVectorStateKey(changed, readers));
  });

  it("should retain uncertainty for an opaque runtime address", () => {
    const result = writeFact("let address:word=peekw($0400);poke(address,7);");
    expect(result.address).toBeUndefined();
  });
});
