import { describe, expect, it } from "vitest";
import { checkProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

const HEADER = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "let target: byte[4];",
  "",
].join("\n");

/** Check one D64-profile source and return its error codes. */
async function errors(body: string): Promise<readonly string[]> {
  return withProject(
    `${HEADER}${body}\n`,
    [],
    async (project) => {
      const checked = await checkProject({ project });
      return checked.kind === "success"
        ? []
        : checked.diagnostics
            .filter(({ severity }) => severity === "error")
            .map(({ code }) => code);
    },
    "c64-pal-d64-kernal-6581",
  );
}

describe("load publication", () => {
  // The successful edge publishes the captured destination range.
  it("should allow a read on the successful load edge", async () => {
    expect(
      await errors(
        "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
      ),
    ).toEqual([]);
  });

  // The false edge leaves the captured range indeterminate.
  it("should reject a read on the failed load edge with E10276", async () => {
    expect(
      await errors(
        "function main(): void { if (!c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
      ),
    ).toEqual(["E10276"]);
  });

  // A join without a successful load on every path keeps the range indeterminate.
  it("should reject a read after a non-covering load join with E10276", async () => {
    expect(
      await errors(
        "function main(): void { if (c64.loader.load(DATA, target)) {} let x: byte = target[0]; }",
      ),
    ).toEqual(["E10276"]);
  });

  // Both branches initialize the destination, so the joined read is legal.
  it("should allow a read when both branches initialize the destination", async () => {
    expect(
      await errors(
        "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } else { if (c64.loader.load(DATA, target)) { let z: byte = target[0]; } } }",
      ),
    ).toEqual([]);
  });

  // A stored result carries the capture through the true edge.
  it("should allow a read guarded by a stored load result", async () => {
    expect(
      await errors(
        "function main(): void { let ok: boolean = c64.loader.load(DATA, target); if (ok) { let x: byte = target[0]; } }",
      ),
    ).toEqual([]);
  });

  // The inverted stored result exposes the failed edge.
  it("should reject a read guarded by an inverted stored result with E10276", async () => {
    expect(
      await errors(
        "function main(): void { let ok: boolean = c64.loader.load(DATA, target); if (!ok) { let x: byte = target[0]; } }",
      ),
    ).toEqual(["E10276"]);
  });

  // A read before checking the stored result remains unsafe.
  it("should reject a read before the stored result is checked", async () => {
    expect(
      await errors(
        "function main(): void { let ok: boolean = c64.loader.load(DATA, target); let x: byte = target[0]; }",
      ),
    ).toEqual(["E10276"]);
  });

  // A full ordinary assignment on the false edge establishes its own value.
  it("should allow a read after the false edge is fully reassigned", async () => {
    expect(
      await errors(
        "function main(): void { if (!c64.loader.load(DATA, target)) { target[0] = 1; target[1] = 2; target[2] = 3; target[3] = 4; } let x: byte = target[0]; }",
      ),
    ).toEqual([]);
  });
});
