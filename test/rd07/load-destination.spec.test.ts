import { describe, expect, it } from "vitest";
import { checkProject } from "@blend65/compiler";
import type { ProjectDiagnostic } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

const HEADER = ["module Game;", "", "loadable const DATA: byte[4] = [1, 2, 3, 4];", ""].join("\n");

/** Check one D64-profile source and return its error diagnostics. */
async function diagnose(body: string): Promise<readonly ProjectDiagnostic[]> {
  return withProject(
    `${HEADER}${body}\n`,
    [],
    async (project) => {
      const checked = await checkProject({ project });
      return checked.kind === "success"
        ? []
        : checked.diagnostics.filter(({ severity }) => severity === "error");
    },
    "c64-pal-d64-kernal-6581",
  );
}

/** Check one source and return only its error codes. */
async function errors(body: string): Promise<readonly string[]> {
  return (await diagnose(body)).map(({ code }) => code);
}

describe("load destination forms", () => {
  // A struct-valued unit may target a complete module object of the exact nominal type.
  it("should accept a complete module object of the exact unit type", async () => {
    expect(
      await errors(
        [
          "struct Level { map: byte[2]; charset: byte[2]; }",
          "loadable const LEVEL: Level = { map: [1, 2], charset: [3, 4] };",
          "let current: Level;",
          "function main(): void { if (c64.loader.load(LEVEL, current)) { let x: byte = current.map[0]; } }",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A field of a larger object is a legal destination; no root-only restriction applies.
  it("should accept a struct field destination", async () => {
    expect(
      await errors(
        [
          "struct Holder { data: byte[4]; tag: byte; }",
          "let holder: Holder;",
          "function main(): void { if (c64.loader.load(DATA, holder.data)) { let x: byte = holder.data[0]; } }",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // Nested field paths compose normally.
  it("should accept a nested field destination", async () => {
    expect(
      await errors(
        [
          "struct Inner { data: byte[4]; }",
          "struct Outer { inner: Inner; }",
          "let outer: Outer;",
          "function main(): void { if (c64.loader.load(DATA, outer.inner.data)) { let x: byte = outer.inner.data[0]; } }",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A function-local destination has a complete interval.
  it("should accept a local destination", async () => {
    expect(
      await errors(
        "function main(): void { let local: byte[4]; if (c64.loader.load(DATA, local)) { let x: byte = local[0]; } }",
      ),
    ).toEqual([]);
  });

  // A mutable parameter place is a legal destination.
  it("should accept a mutable parameter destination", async () => {
    expect(
      await errors(
        [
          "function transfer(buffer: byte[4]): void {",
          "  if (c64.loader.load(DATA, buffer)) { let x: byte = buffer[0]; }",
          "}",
          "function main(): void { let buffer: byte[4]; transfer(buffer); }",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A constant array index selects one exact candidate.
  it("should accept a constant array-element destination", async () => {
    expect(
      await errors(
        [
          "struct Slot { data: byte[4]; }",
          "let slots: Slot[2];",
          "function main(): void { if (c64.loader.load(DATA, slots[1].data)) { let x: byte = slots[1].data[0]; } }",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A runtime index over a fixed exact-type array is a finite candidate set.
  it("should accept a runtime-indexed fixed-array destination", async () => {
    expect(
      await errors(
        [
          "struct Slot { data: byte[4]; }",
          "let slots: Slot[2];",
          "function loadInto(index: byte): void {",
          "  if (c64.loader.load(DATA, slots[index].data)) { let x: byte = slots[index].data[0]; }",
          "}",
          "function main(): void { loadInto(1); }",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A constant has no mutable storage.
  it("should reject a constant destination with the constant reason", async () => {
    const [diagnostic] = await diagnose("function main(): void { c64.loader.load(DATA, 0); }");
    expect(diagnostic?.code).toBe("E10275");
    expect(diagnostic?.message).toMatch(/mutable fixed place/u);
  });

  // A named constant is read-only.
  it("should reject a named constant destination", async () => {
    const found = await diagnose(
      [
        "const FIXED: byte[4] = [1, 2, 3, 4];",
        "function main(): void { c64.loader.load(DATA, FIXED); }",
        "",
      ].join("\n"),
    );
    expect(found.map(({ code }) => code)).toEqual(["E10275"]);
    expect(found[0]?.message).toMatch(/constant has no mutable storage/u);
  });

  // Different nominal struct types are rejected even when their sizes match.
  it("should reject a same-size nominal type mismatch with both type names", async () => {
    const found = await diagnose(
      [
        "struct A { x: byte[4]; }",
        "struct B { y: byte[4]; }",
        "loadable const UNIT: A = { x: [1, 2, 3, 4] };",
        "let target: B;",
        "function main(): void { c64.loader.load(UNIT, target); }",
        "",
      ].join("\n"),
    );
    expect(found.map(({ code }) => code)).toEqual(["E10275"]);
    expect(found[0]?.message).toMatch(/'A'.*not exactly 'B'|'B'.*not exactly 'A'/u);
    expect(found[0]?.message).toMatch(/both are 4 bytes/u);
  });

  // Different extents are rejected with both sizes.
  it("should reject a size mismatch with both byte counts", async () => {
    const found = await diagnose(
      ["let small: byte[3];", "function main(): void { c64.loader.load(DATA, small); }", ""].join(
        "\n",
      ),
    );
    expect(found.map(({ code }) => code)).toEqual(["E10275"]);
    expect(found[0]?.message).toMatch(/destination is 3 byte\(s\).*unit is 4 byte\(s\)/u);
  });

  // The resident C64 profiles keep their terminal E10275 rejection.
  it("should reject the load form on a resident PRG profile", async () => {
    const found = await withProject(
      `${HEADER}let dest: byte[4];\nfunction main(): void { c64.loader.load(DATA, dest); }\n`,
      [],
      async (project) => {
        const checked = await checkProject({ project });
        return checked.kind === "success"
          ? []
          : checked.diagnostics.filter(({ severity }) => severity === "error");
      },
      "c64-pal-prg-kernal-6581",
    );
    expect(found.map(({ code }) => code)).toEqual(["E10275"]);
    expect(found[0]?.message).toMatch(/resident C64 profile has no load operation/u);
  });
});
