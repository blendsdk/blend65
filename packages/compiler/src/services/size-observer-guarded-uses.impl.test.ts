import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { serializeAcme } from "../artifacts/acme-serializer.js";
import { ordinalBoundsForFunction } from "../machine/lower-bounds.js";
import { placeUses } from "../semantic/aggregate-place-proof.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateSizeObservers } from "./size-observers.js";

/** Each guarded index is a normal mutable local, not a compile-time input replacement. */
const GUARDED = [
  [
    "unsigned shift",
    "let ordinal:byte=seed;if(ordinal>=64){return;}let column:byte=ordinal>>3;data[column]=42;",
  ],
  ["local reload", "let column:byte=seed;if(column>=8){return;}data[column]=42;"],
  [
    "short-circuit guard",
    "let ordinal:byte=seed;if(stop!=0||ordinal>=64){return;}let column:byte=ordinal>>3;data[column]=42;",
  ],
] as const;

/** The same access must close both with and without conditional induction premises. */
function source(body: string, induction: boolean, functions = ""): string {
  const loop = induction ? "for(let i:word=0;i<8;i+=1){data[i]=byte(i);}" : "";
  return `module Game;let data:byte[8]=[;0];let seed:byte=63;let stop:byte=0;${functions}function main():void{${loop}${body}}`;
}

describe("operation-specific guarded containment", () => {
  describe.each([0, 7, 8, 255, 256, 65535])("generic word start=%i", (seed) => {
    it.each([false, true])(
      "should retain complete generic homes without conditional induction, bounds=%s",
      (bounds) => {
        const text = `module Game;let data:byte[8];function scan(seed:word):void{for(let i:word=seed;i<8;i+=1){data[i]=byte(i);}}function main():void{scan(${seed});}`;
        const input = effectFixture(text, "size", bounds, "original");
        const scan = input.checked.program.semantic.functions.find(
          (fn) => fn.id !== input.checked.program.semantic.main,
        )!;
        const facts =
          input.candidate.lowered.program.storageSelection!.sourceFacts.functions.get(scan)!;
        expect(facts.loops).toEqual([]);
        expect(facts.objects.rangeObservers).toEqual([]);
        for (const shared of [input.reference.shared, input.candidate.shared]) {
          const counter = shared.certificate.inventory.requests.find(
            (request) =>
              request.owner === scan.id &&
              request.binding !== null &&
              input.checked.bindingNames.get(bindingIdentityKey(request.binding)) === "i",
          );
          const home = shared.certificate.certificate.homes.find(
            (home) => home.requestId === counter?.id,
          );
          expect(counter?.bytes).toBe(2);
          expect(home?.bytes).toBe(2);
          const fn = shared.layout.program.functions.find((fn) => fn.sourceFunction === scan.id)!;
          expect(fn.fixedCounterProofs ?? []).toEqual([]);
          expect(fn.fixedLoopProofs ?? []).toEqual([]);
          expect(
            serializeAcme({
              layout: shared.layout,
              certificate: shared.certificate.certificate,
              profile: input.checked.profile,
            }).kind,
          ).toBe("complete");
        }
        const result = validateResidualEffects(input);
        expect(result.kind).toBe("complete");
        if (result.kind !== "complete") throw new Error(result.reason);
        expect(result.loops.size).toBe(0);
        expect(result.bounds.size).toBe(0);
        expect(validateSizeObservers(input).kind).toBe("complete");
      },
    );
  });

  describe.each(GUARDED)("%s", (_name, body) => {
    describe.each([false, true])("induction=%s", (induction) => {
      it.each([false, true])("should close only the guarded typed use with bounds=%s", (bounds) => {
        const input = effectFixture(source(body, induction), "size", bounds, "original");
        expect(input.candidate.shared).not.toBe(input.reference.shared);
        expect(validateResidualEffects(input).kind).toBe("complete");
        expect(validateSizeObservers(input).kind).toBe("complete");
      });
    });
  });

  describe.each(GUARDED)("%s across a closed call", (_name, body) => {
    describe.each([false, true])("induction=%s", (induction) => {
      it.each([false, true])("should close only the Original use with bounds=%s", (bounds) => {
        const text = source(
          body.replace("data[", "touch();data["),
          induction,
          "function touch():void{stop+=1;}",
        );
        const input = effectFixture(text, "size", bounds, "original");
        const fn = input.checked.program.semantic.functions.find(
          (fn) => fn.id === input.checked.program.semantic.main,
        )!;
        const use = fn.blocks
          .flatMap((block) => block.operations)
          .find((operation) => operation.span.start === text.lastIndexOf("data["))!;
        const ordinal = placeUses(use)
          .flatMap(({ place }) => place.path)
          .find((part) => part.kind === "index");
        if (ordinal?.kind !== "index") throw new Error("Expected the final indexed store");
        const query = ordinalBoundsForFunction(fn.blocks, {
          program: input.checked.program,
          profile: input.checked.profile,
        });
        // Validation must not change either real artifact or its closed resource demand.
        const snapshot = () =>
          JSON.stringify(
            [input.reference.shared, input.candidate.shared].map((shared) => [
              serializeAcme({
                layout: shared.layout,
                certificate: shared.certificate.certificate,
                profile: input.checked.profile,
              }),
              shared.certificate.inventory.requests,
              shared.certificate.certificate,
            ]),
            (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          );
        const before = snapshot();
        expect(query.get(use)?.get(ordinal.value)).toBeUndefined();
        const result = validateResidualEffects(input);
        expect(result.kind).toBe("complete");
        if (result.kind !== "complete") throw new Error(result.reason);
        expect(result.originalCallGuards?.get(use)?.get(ordinal.value)).toBe(
          induction ? 7n : undefined,
        );
        expect(result.bounds.get(fn.id)?.get(ordinal.value)).not.toBe(7n);
        expect(validateSizeObservers(input).kind).toBe(induction ? "complete" : "rejected");
        expect(snapshot()).toBe(before);
      });
    });
  });

  it.each(["poke(peekw($C140),1);", "poke($080D,1);"])(
    "should retain callee raw exclusion: %s",
    (write) => {
      const body = GUARDED[1][1].replace("data[", "touch();data[");
      const input = effectFixture(
        source(body, true, `function touch():void{${write}}`),
        "size",
        false,
        "original",
      );
      const result = validateResidualEffects(input);
      expect(result.kind).toBe("rejected");
      if (result.kind !== "complete") expect(result.reason).toMatch(/Raw|overlaps/);
      expect(validateSizeObservers(input).kind).toBe("rejected");
    },
  );

  describe.each([
    ["unknown shift", "let column:byte=seed>>3;data[column]=42;", ""],
    [
      "unknown mutation",
      "let column:byte=seed;if(column>=8){return;}column=stop;data[column]=42;",
      "",
    ],
    [
      "incomplete join",
      "let column:byte=seed;if(stop!=0){if(column>=8){return;}}data[column]=42;",
      "",
    ],
    ["shared reload", "if(seed>=8){return;}data[seed]=42;", ""],
    [
      "exposed reload",
      "let column:byte=seed;if(column>=8){return;}let address:word=&column;data[column]=42;",
      "",
    ],
    ["pre-guard use", "let column:byte=seed;data[column]=42;if(column>=8){return;}", ""],
  ])("%s remains unknown", (_name, body, functions) => {
    it.each([false, true])(
      "should not manufacture a guarded use with induction=%s",
      (induction) => {
        const input = effectFixture(source(body, induction, functions), "size", false, "original");
        const fn = input.checked.program.semantic.functions.find(
          (fn) => fn.id === input.checked.program.semantic.main,
        )!;
        const query = ordinalBoundsForFunction(
          fn.blocks,
          { program: input.checked.program, profile: input.checked.profile },
          [],
        );
        const use = fn.blocks
          .flatMap((block) => block.operations)
          .find(
            (operation) =>
              operation.span.start === source(body, induction, functions).lastIndexOf("data["),
          )!;
        const ordinal = placeUses(use)
          .flatMap(({ place }) => place.path)
          .find((part) => part.kind === "index");
        expect(ordinal?.kind).toBe("index");
        if (ordinal?.kind !== "index") throw new Error("Expected the actual indexed source use");
        expect(query.get(use)?.get(ordinal.value)).toBeUndefined();
        expect(validateSizeObservers(input).kind).toBe("rejected");
      },
    );
  });

  it.each([false, true])(
    "should not export a use-site maximum as an induction fact with bounds=%s",
    (bounds) => {
      const input = effectFixture(source(GUARDED[0][1], true), "size", bounds, "original");
      const fn = input.checked.program.semantic.functions.find(
        (fn) => fn.id === input.checked.program.semantic.main,
      )!;
      const use = fn.blocks
        .flatMap((block) => block.operations)
        .find(
          (operation) =>
            operation.kind === "store" &&
            operation.span.start === source(GUARDED[0][1], true).lastIndexOf("data["),
        )!;
      const ordinal = placeUses(use)
        .flatMap(({ place }) => place.path)
        .find((part) => part.kind === "index");
      if (ordinal?.kind !== "index") throw new Error("Expected the guarded store");
      const before = ordinalBoundsForFunction(
        fn.blocks,
        { program: input.checked.program, profile: input.checked.profile },
        [],
      );
      expect(before.get(use)?.get(ordinal.value)).toBe(7n);
      const result = validateResidualEffects(input);
      expect(result.kind).toBe("complete");
      if (result.kind !== "complete") throw new Error(result.reason);
      expect(result.bounds.get(fn.id)?.get(ordinal.value)).toBe(255n);
      expect(validateSizeObservers(input).kind).toBe("complete");
    },
  );

  it.each([false, true])(
    "should retain an immutable captured index after a different local changes, induction=%s",
    (induction) => {
      const body =
        "let column:byte=seed;if(column>=8){return;}let index:byte=column;column=stop;data[index]=42;";
      expect(
        validateSizeObservers(effectFixture(source(body, induction), "size", true, "original"))
          .kind,
      ).toBe("complete");
    },
  );

  it.each([false, true])(
    "should not lend typed-use guards to a raw address, induction=%s",
    (induction) => {
      const body = "let column:byte=seed;if(column>=8){return;}poke($CFF8+word(column),42);";
      const input = effectFixture(source(body, induction), "size", false, "original");
      const result = validateSizeObservers(input);
      expect(result.kind).toBe("rejected");
      if (result.kind !== "complete") expect(result.reason).toMatch(/Raw|ordinary-RAM|device/);
    },
  );

  describe.each(GUARDED)("%s resources", (_name, body) => {
    it.each([false, true])(
      "should leave both serialized constructions and closed resources unchanged, bounds=%s",
      (bounds) => {
        const input = effectFixture(source(body, true), "size", bounds, "original");
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
          expect(snapshots[index]!.assembly.kind).toBe("complete");
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
      },
    );
  });
});
