import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateNamedBorrows } from "./size-observer-borrows.js";
import { lowerMachineProgram } from "../machine/lower.js";
import { inventoryStorage } from "../storage/inventory.js";
import { closeStorage } from "../storage/closure.js";
import { closeSharedStorage } from "./shared-storage.js";

/** A real copied value, then source mutation, forwarded across two calls. */
const SNAPSHOT = `module Game;struct Packet{rows:byte[8];marker:word;}let data:byte[8];
function scan(p:const Packet):void{for(let i:word=0;i<8;i+=1){data[i]=p.rows[i];}pokew($C210,p.marker);}
function relay(p:const Packet):void{scan(p);}
function main():void{let original:Packet={rows:[17,34,51,68,85,102,119,136],marker:$1234};
let saved:Packet=original;original.rows[0]=99;original.marker=$BEEF;let live:word=$A55A;
relay(saved);pokew($C200,live);poke($C202,original.rows[0]);pokew($C203,original.marker);}`;

/** A complete returned local is delivered into named caller bytes, not its ABI pointer. */
const RETURNED = `module Game;struct Packet{rows:byte[8];marker:word;}let data:byte[8];
function make():Packet{let local:Packet={rows:[17,34,51,68,85,102,119,136],marker:$1234};local.rows[0]+=1;return local;}
function scan(p:const Packet):void{for(let i:word=0;i<8;i+=1){data[i]=p.rows[i];}pokew($C210,p.marker);}
function relay(p:const Packet):void{scan(p);}
function main():void{let live:word=peekw($C110);let saved:Packet=make();relay(saved);pokew($C200,live);}`;

/** Locate declared data through its source binding, never a pointer-sized temporary. */
function namedHome(
  input: ReturnType<typeof effectFixture>,
  side: "before" | "after",
  name: string,
) {
  const shared = side === "before" ? input.reference.shared : input.candidate.shared;
  const requests = shared.certificate.inventory.requests.filter(
    (request) =>
      request.storageClass === "local" &&
      request.binding !== null &&
      bindingIdentityKey(request.owner) ===
        bindingIdentityKey(input.checked.program.semantic.main) &&
      input.checked.bindingNames.get(bindingIdentityKey(request.binding))?.split(".").at(-1) ===
        name,
  );
  if (requests.length !== 1) throw new Error(`Expected one actual named local: ${name}`);
  const request = requests[0]!;
  const home = shared.certificate.certificate.homes.find((home) => home.requestId === request.id);
  if (home === undefined) throw new Error(`Expected actual object bytes: ${name}`);
  return { shared, request, home };
}

describe("named aggregate borrow closure", () => {
  it.each([true, false])(
    "should preserve a copied caller-local snapshot with bounds=%s",
    (bounds) => {
      const input = effectFixture(SNAPSHOT, "size", bounds, "original");
      expect(input.candidate.shared).not.toBe(input.reference.shared);
      const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
      const loop = [...facts.functions.values()].flatMap((packet) => packet.loops)[0]!;
      for (const side of ["before", "after"] as const) {
        const original = namedHome(input, side, "original");
        const saved = namedHome(input, side, "saved");
        expect(original.home.bytes).toBe(10);
        expect(saved.home.bytes).toBe(10);
        expect(
          original.home.address + 10 <= saved.home.address ||
            saved.home.address + 10 <= original.home.address,
        ).toBe(true);
        expect(
          saved.shared.certificate.certificate.interference.some(
            (edge) =>
              (edge.left === saved.request.id && edge.right === original.request.id) ||
              (edge.right === saved.request.id && edge.left === original.request.id),
          ),
        ).toBe(true);
        const counter = saved.shared.certificate.inventory.requests.find(
          (request) =>
            request.binding !== null &&
            bindingIdentityKey(request.binding) === bindingIdentityKey(loop.counter) &&
            bindingIdentityKey(request.owner) === bindingIdentityKey(loop.function.id),
        );
        const counterHome = saved.shared.certificate.certificate.homes.find(
          (home) => home.requestId === counter?.id,
        )!;
        expect(counterHome.bytes).toBe(2);
        expect(
          saved.home.address + 10 <= counterHome.address ||
            counterHome.address + 2 <= saved.home.address,
        ).toBe(true);
        expect(saved.request.lifetime.callsCrossed.length).toBeGreaterThan(0);
      }
      const origins = [...facts.functions.values()].flatMap((packet) => [
        ...(packet.storage?.parameters.values() ?? []),
      ]);
      expect(origins).toHaveLength(2);
      expect(
        origins.every(
          (parameter) =>
            parameter.origin.owner === input.checked.program.semantic.main &&
            input.checked.bindingNames
              .get(bindingIdentityKey(parameter.origin.place.root))
              ?.split(".")
              .at(-1) === "saved",
        ),
      ).toBe(true);
      const result = validateSizeObservers(input);
      expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
    },
  );

  it.each([
    ["global array", "let input:byte[8]=[;7];", "", "read(input)"],
    ["caller-local array", "", "let input:byte[8]=[;7];", "read(input)"],
  ])("should close a non-loop %s borrow", (_name, declaration, local, expression) => {
    const input = effectFixture(
      `module Game;${declaration}
function read(p:const byte[8]):byte{return p[1];}function main():void{${local}poke($C100,${expression});}`,
      "size",
      true,
      "original",
    );
    const result = validateSizeObservers(input);
    expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
  });

  it("should preserve the previously admitted literal and direct-call result class", () => {
    const input = effectFixture(
      `module Game;struct Pair{a:byte;b:byte;}
function make():Pair{return {a:7,b:9};}function main():void{let result:Pair=make();poke($C100,result.a);}`,
      "size",
      true,
      "original",
    );
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each([true, false])("should close a complete returned local with bounds=%s", (bounds) => {
    const input = effectFixture(RETURNED, "size", bounds, "original");
    for (const side of ["before", "after"] as const) {
      const saved = namedHome(input, side, "saved");
      expect(saved.home.bytes).toBe(10);
      expect(saved.request.lifetime.callsCrossed.length).toBeGreaterThan(0);
      expect(saved.shared.certificate.inventory.program.returnedLocalDestinations).toHaveLength(1);
      const result = saved.shared.certificate.inventory.results.find(
        (row) => input.checked.bindingNames.get(bindingIdentityKey(row.function)) === "Game.make",
      )!;
      if (side === "before") {
        expect(result.location.kind).toBe("storage");
        if (result.location.kind !== "storage") throw new Error("Expected the canonical ABI");
        const location = result.location;
        const pointer = saved.shared.certificate.inventory.requests.find(
          (request) => request.id === location.requestId,
        )!;
        expect(pointer.bytes).toBe(2);
        expect(pointer.id).not.toBe(saved.request.id);
      } else {
        expect(result.location).toMatchObject({
          kind: "fixed-object",
          backingRequestId: saved.request.id,
          bytes: 10,
        });
      }
    }
    const result = validateSizeObservers(input);
    expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
  });

  it("should preserve an already admitted anonymous direct-call result", () => {
    const input = effectFixture(
      `module Game;struct Packet{rows:byte[8];marker:word;}
function make():Packet{return {rows:[17,34,51,68,85,102,119,136],marker:$1234};}
function read(p:const Packet):byte{return p.rows[1];}function main():void{poke($C100,read(make()));}`,
      "size",
      true,
      "original",
    );
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each(["before", "after"] as const)(
    "should require complete returned data in the %s layout independently",
    (side) => {
      const input = effectFixture(RETURNED, "size", false, "original");
      const saved = namedHome(input, side, "saved");
      const other = namedHome(input, side === "before" ? "after" : "before", "saved");
      expect(saved.home.bytes).toBe(10);
      expect(other.home.bytes).toBe(10);
      expect(saved.home.address).not.toBe(other.home.address);
      for (const missing of [true, false]) {
        const homes = missing
          ? saved.shared.certificate.certificate.homes.filter(
              (home) => home.requestId !== saved.request.id,
            )
          : saved.shared.certificate.certificate.homes.map((home) =>
              home.requestId === saved.request.id ? { ...home, bytes: 2 } : home,
            );
        const shared = {
          ...saved.shared,
          certificate: {
            ...saved.shared.certificate,
            certificate: { ...saved.shared.certificate.certificate, homes },
          },
        };
        const modified =
          side === "before"
            ? { ...input, reference: { ...input.reference, shared } }
            : { ...input, candidate: { ...input.candidate, shared } };
        expect(validateNamedBorrows(modified).kind).toBe("rejected");
        expect(validateSizeObservers(modified).kind).toBe("error");
      }
    },
  );

  it.each(["before", "after"] as const)(
    "should retain returned-data interference with a caller scalar in the %s layout",
    (side) => {
      const input = effectFixture(RETURNED, "size", false, "original");
      const saved = namedHome(input, side, "saved");
      const live = namedHome(input, side, "live");
      const edges = saved.shared.certificate.certificate.interference;
      const interference = edges.filter(
        (edge) =>
          !(
            (edge.left === saved.request.id && edge.right === live.request.id) ||
            (edge.right === saved.request.id && edge.left === live.request.id)
          ),
      );
      expect(interference.length).toBe(edges.length - 1);
      const shared = {
        ...saved.shared,
        certificate: {
          ...saved.shared.certificate,
          certificate: { ...saved.shared.certificate.certificate, interference },
        },
      };
      const modified =
        side === "before"
          ? { ...input, reference: { ...input.reference, shared } }
          : { ...input, candidate: { ...input.candidate, shared } };
      const result = validateNamedBorrows(modified);
      expect(result.kind).toBe("rejected");
      if (result.kind !== "complete") expect(result.reason).toContain("conflict proof");
      expect(validateSizeObservers(modified).kind).toBe("error");
    },
  );

  it.each([
    ["different destinations", "", "", "let a:Pair=make();let b:Pair=make();poke($C100,a.a+b.b);"],
    [
      "forwarded destination",
      "",
      "function relay():Pair{return make();}",
      "let a:Pair=relay();poke($C100,a.a);",
    ],
    [
      "member destination",
      "struct Box{p:Pair;}",
      "",
      "let box:Box={p:{a:1,b:2}};box.p=make();poke($C100,box.p.a);",
    ],
    [
      "anonymous returned-local destination",
      "",
      "function read(p:const Pair):byte{return p.a;}",
      "poke($C100,read(make()));",
    ],
  ])("should retain a tuple rejection for a %s", (_name, declarations, functions, body) => {
    const input = effectFixture(
      `module Game;struct Pair{a:byte;b:byte;}${declarations}
function make():Pair{let local:Pair={a:7,b:9};return local;}${functions}
function main():void{${body}}`,
      "size",
      false,
      "original",
    );
    expect(validateSizeObservers(input).kind).toBe("rejected");
  });

  it("should admit a resident global destination the callee never observes", () => {
    const input = effectFixture(
      `module Game;struct Pair{a:byte;b:byte;}
let output:Pair;
function make():Pair{let local:Pair={a:7,b:9};return local;}
function main():void{output=make();poke($C100,output.a);}`,
      "size",
      false,
      "original",
    );
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it("should reject a resident global destination the callee observes", () => {
    const input = effectFixture(
      `module Game;struct Pair{a:byte;b:byte;}
let output:Pair;
function make():Pair{let local:Pair={a:7,b:9};poke($C100,output.a);return local;}
function main():void{output=make();poke($C100,output.a);}`,
      "size",
      false,
      "original",
    );
    expect(validateSizeObservers(input).kind).toBe("rejected");
  });

  it("should not activate fixed borrowing from facts in a Direct construction", () => {
    const input = effectFixture(SNAPSHOT, "size", false, "original");
    const original = input.candidate.lowered;
    const storage = original.program.storageProfile!;
    if (storage.profileId !== input.checked.profile.id)
      throw new Error("Expected the actual selected profile");
    const profile = {
      ...input.checked.profile,
      storage: { ...storage, profileId: input.checked.profile.id },
    };
    const sourceFacts = original.program.storageSelection!.sourceFacts;
    const functions = new Map(
      [...sourceFacts.functions].map(([fn, packet]) => {
        const { storage: _storage, complements: _complements, ...direct } = packet;
        return [fn, direct] as const;
      }),
    );
    const lowered = lowerMachineProgram({
      program: original.inventory.program,
      profile,
      logicalStorage: inventoryStorage(original.inventory.program),
      observerEvidence: true,
      sourceFacts: { ...sourceFacts, functions, nonLoopBundle: "direct" },
      bindingNames: input.checked.bindingNames,
      boundsCheck: false,
      divisionZeroCheck: true,
    });
    if (lowered.kind !== "complete") throw new Error(lowered.reason);
    const certificate = closeStorage(lowered.inventory, profile.storage, lowered.binder);
    if (certificate.kind !== "complete") throw new Error("Expected real Direct storage closure");
    const shared = closeSharedStorage(
      lowered.program,
      lowered.binder,
      certificate,
      input.checked.profile,
    );
    if (shared.kind !== "complete") throw new Error("Expected real Direct layout");
    const result = validateSizeObservers({ ...input, candidate: { lowered, shared } });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete") expect(result.reason).toContain("active Closed recipes");
  });

  it.each(["missing", "pointer width"])("should reject %s private object backing", (kind) => {
    const input = effectFixture(SNAPSHOT, "size", false, "original");
    const saved = namedHome(input, "after", "saved");
    const shared = input.candidate.shared;
    const homes =
      kind === "missing"
        ? shared.certificate.certificate.homes.filter((home) => home.requestId !== saved.request.id)
        : shared.certificate.certificate.homes.map((home) =>
            home.requestId === saved.request.id ? { ...home, bytes: 2 } : home,
          );
    // Invalid copies reach only the rejection boundary. They do not mint a
    // successful producer association or change the genuine fixture objects.
    const modified = {
      ...input,
      candidate: {
        ...input.candidate,
        shared: {
          ...shared,
          certificate: {
            ...shared.certificate,
            certificate: { ...shared.certificate.certificate, homes },
          },
        },
      },
    };
    const result = validateNamedBorrows(modified);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete") expect(result.reason).toContain("complete backing");
    expect(validateSizeObservers(modified).kind).toBe("error");
  });

  it("should require the actual caller-to-counter conflict, not just separated current homes", () => {
    const input = effectFixture(SNAPSHOT, "size", false, "original");
    const saved = namedHome(input, "after", "saved");
    const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
    const loop = [...facts.functions.values()].flatMap((packet) => packet.loops)[0]!;
    const counter = saved.shared.certificate.inventory.requests.find(
      (request) =>
        request.binding !== null &&
        bindingIdentityKey(request.binding) === bindingIdentityKey(loop.counter) &&
        bindingIdentityKey(request.owner) === bindingIdentityKey(loop.function.id),
    )!;
    const edges = saved.shared.certificate.certificate.interference;
    const interference = edges.filter(
      (edge) =>
        !(
          (edge.left === saved.request.id && edge.right === counter.id) ||
          (edge.right === saved.request.id && edge.left === counter.id)
        ),
    );
    expect(interference.length).toBe(edges.length - 1);
    const shared = input.candidate.shared;
    const modified = {
      ...input,
      candidate: {
        ...input.candidate,
        shared: {
          ...shared,
          certificate: {
            ...shared.certificate,
            certificate: { ...shared.certificate.certificate, interference },
          },
        },
      },
    };
    const result = validateNamedBorrows(modified);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete") expect(result.reason).toContain("conflict proof");
    expect(validateSizeObservers(modified).kind).toBe("error");
  });

  it("should diagnose a stale selected root and recover only after exact restoration", () => {
    const input = effectFixture(SNAPSHOT, "size", false, "original");
    const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
    const selected = [...facts.functions.values()].find(
      (packet) => (packet.storage?.parameters.size ?? 0) > 0,
    )!.storage!;
    const parameters = selected.parameters;
    if (!(parameters instanceof Map)) throw new Error("Expected the genuine parameter Map");
    const [key, parameter] = [...parameters][0]!;
    try {
      parameters.delete(key);
      expect(validateNamedBorrows(input).kind).toBe("error");
      expect(validateSizeObservers(input).kind).toBe("error");
    } finally {
      parameters.set(key, parameter);
    }
    expect(validateSizeObservers(input).kind).toBe("complete");
  });

  it.each([
    [
      "numeric publication",
      "module Game;let input:byte[8]=[;7];function main():void{let address:word=&input;pokew($C100,address);}",
      "rejected",
    ],
    [
      "anonymous member capture",
      `module Game;struct Packet{rows:byte[8];marker:byte;}let original:byte[8]=[;7];
function mutate():byte{original[0]=99;return 5;}function read(p:const Packet):byte{return p.rows[0];}
function main():void{let saved:Packet={rows:original,marker:mutate()};poke($C100,read(saved));}`,
      "complete",
    ],
    [
      "returned-local address",
      "module Game;struct Pair{a:byte;b:byte;}function make():Pair{let local:Pair={a:7,b:9};return local;}function main():void{let result:Pair=make();poke($C100,result.a);}",
      "complete",
    ],
    [
      "multiple borrowed roots",
      "module Game;let data:byte[8];function scan(p:const byte[8]):void{for(let i:word=0;i<8;i+=1){data[i]=p[i];}}function main():void{let a:byte[8]=[;7];let b:byte[8]=[;9];scan(a);scan(b);}",
      "rejected",
    ],
    [
      "escaping bounds",
      "module Game;let data:byte[8];function scan(p:const byte[8]):void{for(let i:word=0;i<8;i+=1){data[i]=p[peek($C110)];}}function main():void{let input:byte[8]=[;7];scan(input);}",
      "rejected",
    ],
  ])("should enforce the aggregate transport boundary for %s", (_name, text, expected) => {
    const input = effectFixture(text, "size", false, "original");
    expect(validateSizeObservers(input).kind).toBe(expected);
  });
});
