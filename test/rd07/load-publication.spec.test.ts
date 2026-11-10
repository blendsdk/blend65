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

  // A partial-overlap read on the failed edge is rejected; a disjoint sibling stays readable.
  it("should reject a partial-overlap read and allow a disjoint sibling", async () => {
    const base = [
      "struct Guard { data: byte[4]; canary: byte[2]; }",
      "let guard: Guard = { data: [0, 0, 0, 0], canary: [170, 187] };",
    ].join("\n");
    expect(
      await errors(
        `${base}\nfunction main(): void { if (!c64.loader.load(DATA, guard.data)) { let copy: Guard = guard; } }`,
      ),
    ).toEqual(["E10276"]);
    expect(
      await errors(
        `${base}\nfunction main(): void { if (!c64.loader.load(DATA, guard.data)) { let flag: byte = guard.canary[0]; } }`,
      ),
    ).toEqual([]);
  });

  // A prior-initialized static candidate is disjoint from a failed load into another
  // candidate, so it remains readable after the failure edge.
  it("should keep a provably unselected initialized candidate readable", async () => {
    expect(
      await errors(
        [
          "struct Slot { data: byte[4]; }",
          "let slots: Slot[2];",
          "function main(): void {",
          "  slots[0].data[0] = 1;",
          "  slots[0].data[1] = 2;",
          "  slots[0].data[2] = 3;",
          "  slots[0].data[3] = 4;",
          "  if (!c64.loader.load(DATA, slots[1].data)) { let x: byte = slots[0].data[0]; }",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
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

const DYNAMIC_HEADER = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "struct Slot { data: byte[4]; }",
  "let slots: Slot[2];",
  "",
].join("\n");

/** Check one dynamic-destination source and return its error codes. */
async function dynamicErrors(body: string): Promise<readonly string[]> {
  return withProject(
    `${DYNAMIC_HEADER}${body}\n`,
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

describe("dynamic destination publication", () => {
  // The same stable runtime index is a must-alias with the captured candidate.
  it("should allow a read through the same runtime index", async () => {
    expect(
      await dynamicErrors(
        "function loadAndRead(i: byte): byte { if (c64.loader.load(DATA, slots[i].data)) { return slots[i].data[0]; } return 0; } function main(): void { let x: byte = loadAndRead(1); }",
      ),
    ).toEqual([]);
  });

  // A different runtime index is only a may-alias and receives no publication credit.
  it("should reject a read through a different runtime index", async () => {
    expect(
      await dynamicErrors(
        "function loadAndRead(i: byte, j: byte): byte { if (c64.loader.load(DATA, slots[i].data)) { return slots[j].data[0]; } return 0; } function main(): void { let x: byte = loadAndRead(1, 0); }",
      ),
    ).toEqual(["E10276"]);
  });

  // A changed unknown index cannot prove which candidate was selected.
  it("should reject a read after an unknown runtime index changes", async () => {
    expect(
      await dynamicErrors(
        "function loadAndRead(i: byte, next: byte): byte { if (c64.loader.load(DATA, slots[i].data)) { i = next; return slots[i].data[0]; } return 0; } function main(): void { let x: byte = loadAndRead(1, 0); }",
      ),
    ).toEqual(["E10276"]);
  });

  // A runtime index with a proved value selects exactly one candidate; a prior
  // initialized sibling candidate stays readable after the failure edge.
  it("should keep a provably different known candidate readable after failure", async () => {
    expect(
      await dynamicErrors(
        [
          "function main(): void {",
          "  slots[0].data[0] = 1;",
          "  slots[0].data[1] = 2;",
          "  slots[0].data[2] = 3;",
          "  slots[0].data[3] = 4;",
          "  let i: byte = 1;",
          "  if (!c64.loader.load(DATA, slots[i].data)) { let x: byte = slots[0].data[0]; }",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // The selected known candidate may have been partially written on failure.
  it("should reject a read of the selected known candidate after failure", async () => {
    expect(
      await dynamicErrors(
        "function main(): void { let i: byte = 1; if (!c64.loader.load(DATA, slots[i].data)) { let x: byte = slots[i].data[0]; } }",
      ),
    ).toEqual(["E10276"]);
  });

  // Changing a proved index to a different initialized candidate is a disjoint read.
  it("should allow a changed proved index targeting an initialized candidate", async () => {
    expect(
      await dynamicErrors(
        [
          "function main(): void {",
          "  slots[0].data[0] = 1;",
          "  slots[0].data[1] = 2;",
          "  slots[0].data[2] = 3;",
          "  slots[0].data[3] = 4;",
          "  let i: byte = 1;",
          "  if (c64.loader.load(DATA, slots[i].data)) { i = 0; let x: byte = slots[i].data[0]; }",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  // A static candidate load publishes only that candidate; a disjoint candidate is
  // unaffected by the load and is judged by ordinary initialization rules.
  it("should allow the same static candidate and keep a disjoint candidate separate", async () => {
    expect(
      await dynamicErrors(
        "function main(): void { if (c64.loader.load(DATA, slots[1].data)) { let x: byte = slots[1].data[0]; } }",
      ),
    ).toEqual([]);
    expect(
      await dynamicErrors(
        "function main(): void { if (c64.loader.load(DATA, slots[1].data)) { let x: byte = slots[0].data[0]; } }",
      ),
    ).toEqual([]);
  });
});

describe("retry and loop publication", () => {
  // A retry loop exits only through the successful load edge.
  it("should allow a read after a retry loop that breaks on success", async () => {
    expect(
      await errors(
        "function main(): void { while (true) { if (c64.loader.load(DATA, target)) { break; } } let x: byte = target[0]; }",
      ),
    ).toEqual([]);
  });

  // A loop that may run zero times does not publish the destination after the loop.
  it("should reject a read after a non-covering loop", async () => {
    expect(
      await errors(
        "function main(): void { let i: byte = 0; while (i < 2) { c64.loader.load(DATA, target); i = i + 1; } let x: byte = target[0]; }",
      ),
    ).toEqual(["E10276"]);
  });

  // An unbounded for loop with a success break has the same exit proof.
  it("should allow a read after an unbounded for loop that breaks on success", async () => {
    expect(
      await errors(
        "function main(): void { for (;;) { if (c64.loader.load(DATA, target)) { break; } } let x: byte = target[0]; }",
      ),
    ).toEqual([]);
  });

  // A read inside the successful body iteration is legal.
  it("should allow a read inside a covering loop body", async () => {
    expect(
      await errors(
        "function main(): void { for (let i: byte = 0; i < 2; i = i + 1) { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } } }",
      ),
    ).toEqual([]);
  });
});
