import { describe, expect, it } from "vitest";
import { analyzeProfileSource, buildProfileSource } from "../rd05/profile-fixture.js";

const target = "c64-pal-prg-kernal-6581";

/** Return the exact instruction lines of one named routine in generated assembly. */
function routineInstructions(assembly: string, name: string): string[] {
  const start = assembly.indexOf(`; routine "${name}"`);
  expect(start).toBeGreaterThanOrEqual(0);
  const body: string[] = [];
  for (const line of assembly.slice(start).split("\n").slice(1)) {
    if (line.startsWith("; routine ")) break;
    if (line.startsWith("  ")) body.push(line.trim());
  }
  return body;
}

describe("declaration-order and block scope", () => {
  // A use before a same-named local declaration resolves to the module constant,
  // never to the local's not-yet-initialized frame home.
  it("should resolve a pre-declaration use to the module constant", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
const N: byte = 4;
function main(): void {
  poke($D020, N);
  let N: byte = 1;
}`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.main");
    expect(body.slice(0, 3)).toEqual(["lda #$04", "sta $d020", "lda #$01"]);
    expect(body[3]).toMatch(/^sta \$(?:[0-9a-f]{2}|[0-9a-f]{4})$/u);
    expect(body.join("\n")).not.toMatch(/lda \$[0-9a-f]+\n\s+sta \$d020/u);
  });

  // The same rule holds when the shadowing declaration is nested inside a block.
  it("should not let a nested local capture an earlier top-level use", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
const N: byte = 4;
function main(): void {
  poke($D020, N);
  if (peek($D012) == 3) { let N: byte = 1; }
}`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.main");
    expect(body[0]).toBe("lda #$04");
    expect(body[1]).toBe("sta $d020");
  });

  // A word constant must keep both bytes; the shadowing local may not truncate it.
  it("should keep both bytes of a pre-declaration word constant", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
const N: word = 300;
function main(): void {
  pokew($D020, N);
  let N: word = 1;
}`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.main");
    expect(body.slice(0, 4)).toEqual(["lda #$2c", "sta $d020", "lda #$01", "sta $d021"]);
  });

  // The same word read through a byte destination is a normal width diagnostic,
  // never a one-byte silent read of the shadowing local.
  it("should reject an implicit word-to-byte narrowing instead of truncating", async () => {
    const source = `module Game;
const N: word = 300;
function main(): void {
  poke($D020, N);
  let N: word = 1;
}`;
    const result = await analyzeProfileSource(source, target);
    expect(result.kind).toBe("error");
    expect(
      result.kind === "error"
        ? result.diagnostics.filter(({ severity }) => severity === "error")
        : [],
    ).toMatchObject([{ code: "E10082" }]);
  });

  // A local's lifetime ends with its declaring block. The out-of-block use is a
  // diagnostic, not a fallback to an unrelated sibling declaration.
  it("should reject a use after its declaring block", async () => {
    const source = `module Game;
function main(): void {
  let c: boolean = true;
  if (c) { let t: word = 300; } else { let t: byte = 5; }
  pokew($D000, t);
}`;
    const result = await analyzeProfileSource(source, target);
    expect(result.kind).toBe("error");
    expect(
      result.kind === "error"
        ? result.diagnostics.filter(({ severity }) => severity === "error")
        : [],
    ).toMatchObject([
      {
        code: "E10239",
        message: "'t' is not declared in this scope",
      },
    ]);
  });

  // When an outer binding exists, the out-of-block use resolves to that binding
  // rather than to the inner sibling with the same spelling.
  it("should resolve an out-of-block use to the outer binding", async () => {
    const artifacts = await buildProfileSource(
      `module Game;
function main(): void {
  let t: byte = 7;
  if (peek($D012) == 3) { let t: word = 300; }
  poke($D020, t);
}`,
      target,
    );
    const body = routineInstructions(artifacts.assembly, "Game.main");
    const store = body.findIndex((line) => line === "sta $d020");
    expect(store).toBeGreaterThan(0);
    expect(body[0]).toBe("lda #$07");
    const home = body[1]!;
    expect(home).toMatch(/^sta \$(?:[0-9a-f]{2}|[0-9a-f]{4})$/u);
    expect(body.slice(store - 1, store + 1)).toEqual([`lda ${home.slice(4)}`, "sta $d020"]);
  });
});
