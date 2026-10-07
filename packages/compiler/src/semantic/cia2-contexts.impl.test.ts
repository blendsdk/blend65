import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { loadProject } from "../index.js";
import { selectTargetProfile } from "../target/profile.js";
import { buildSemanticProgram } from "./lower.js";
import { interruptExecutionKey } from "./interrupt-context-facts.js";
import { closeWholeProgram } from "./whole-program.js";

/** Exercise the existing ordered proof on real source, without a second analysis or assembler. */
async function closeSource(main: string, handler = "", helpers = "") {
  const root = await mkdtemp(join(tmpdir(), "blend65-cia2-context-"));
  try {
    await mkdir(join(root, "src"));
    const target = "c64-pal-prg-kernal-6581";
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "cia2-context",
        sourceRoot: "src",
        entry: "Game",
        target,
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      `module Game;
import {setNMI, setNMIExclusive, restoreNMI} from c64.system;
import {configureTimerA, disableInterruptSources, enableInterruptSources} from c64.cia2;
interrupt function handler(): void {${handler}}
${helpers}
function main(): void {${main}}`,
    );
    const loaded = await loadProject({ cwd: root });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    const analyzed = analyzeProject(loaded.snapshot);
    if (analyzed.kind !== "complete") throw new Error(JSON.stringify(analyzed.diagnostics));
    const lowered = buildSemanticProgram(analyzed);
    if (lowered.kind !== "complete") throw new Error(JSON.stringify(lowered.diagnostics));
    const selected = selectTargetProfile(target);
    if (selected.kind !== "complete") throw new Error("Missing test profile");
    return closeWholeProgram(
      lowered.program,
      selected.profile.interrupts,
      selected.profile.storage,
    );
  } finally {
    await rm(root, { recursive: true });
  }
}

describe("CIA2 ordered caller and handler contexts", () => {
  it("should invalidate a freshly reassigned mask after a second possible home write", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); clear($1F); enableInterruptSources($01); restoreNMI();",
      "",
      "function clear(mask: byte): void { poke(&mask, $01); mask = $1F; poke(&mask, $01); disableInterruptSources(mask); }",
    );
    expect(result.kind).toBe("error");
    expect(result.diagnostics.some(({ code }) => code === "E10278")).toBe(true);
  });

  it("should preserve a fresh assignment after an earlier write and a read-only call", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); clear($01); enableInterruptSources($01); restoreNMI();",
      "",
      "function readHome(address: word): void { peek(address); } function clear(mask: byte): void { poke(&mask, $01); mask = $1F; readHome(&mask); disableInterruptSources(mask); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  });

  it("should close a balanced loop with possible writes and exact reassignments", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); clear($1F); enableInterruptSources($01); restoreNMI();",
      "",
      "function clear(mask: byte): void { while (peek($0400) != 0) { poke(&mask, $01); mask = $1F; } disableInterruptSources(mask); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  });

  it.each(["mask = $01;", "mask = peek($0400);", "if (peek($0400) != 0) { mask = $01; }"])(
    "should not retain an original exact helper mask after %s",
    async (assignment) => {
      const result = await closeSource(
        "setNMIExclusive(&handler); clear($1F); enableInterruptSources($01); restoreNMI();",
        "",
        `function clear(mask: byte): void { ${assignment} disableInterruptSources(mask); }`,
      );
      expect(result.kind).toBe("error");
      expect(result.diagnostics.some(({ code }) => code === "E10278")).toBe(true);
    },
  );

  it("should establish a new exact copied parameter value after assignment", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); clear($01); enableInterruptSources($01); restoreNMI();",
      "",
      "function clear(mask: byte): void { mask = $1F; disableInterruptSources(mask); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  });

  it("should distinguish exact arguments at repeated ordinary helper calls", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); clear($01); clear($1F); enableInterruptSources($01); restoreNMI();",
      "",
      "function clear(mask: byte): void { disableInterruptSources(mask); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  });

  it("should preserve equal physical lease captures through repeated handler installs", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); restoreNMI();",
      "setNMIExclusive(&successor); restoreNMI(); setNMIExclusive(&successor); restoreNMI();",
      "interrupt function successor(): void {}",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  });

  it("should carry actual caller ownership through mainline and selected-handler helpers", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); work(); restoreNMI();",
      "work();",
      "function work(): void { configureTimerA($19); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected proved helper contexts");
    const helper = result.program.semantic.functions.find(({ name }) => name === "Game.work")!;
    const proof = result.program.interruptContextAnalysis!;
    expect(
      new Set(proof.contexts.get(bindingIdentityKey(helper.id))?.map(({ domain }) => domain)),
    ).toEqual(new Set(["main", "nmi"]));
    expect([...proof.cia2Restores!.values()].some((restores) => restores.size === 1)).toBe(true);
  });

  it("should distinguish clean and shutdown policies at the same helper entry depth", async () => {
    const result = await closeSource(
      "setNMI(&handler); wrapper(); setNMIExclusive(&handler); disableInterruptSources($1F); wrapper();",
      "",
      "function release(): void { restoreNMI(); } function wrapper(): void { release(); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected distinct proved code policies");
    const proof = result.program.interruptContextAnalysis!;
    for (const name of ["Game.release", "Game.wrapper"]) {
      const fn = result.program.semantic.functions.find((fn) => fn.name === name)!;
      const contexts = proof.contexts.get(bindingIdentityKey(fn.id))!;
      expect(new Set(contexts.map(({ nmi }) => nmi))).toEqual(new Set([1]));
      expect(new Set(contexts.map(({ releaseVariant }) => releaseVariant)).size).toBe(2);
    }
    const release = result.program.semantic.functions.find(({ name }) => name === "Game.release")!;
    const releaseContexts = proof.contexts.get(bindingIdentityKey(release.id))!;
    expect(
      releaseContexts
        .map((context) => proof.cia2Restores!.get(interruptExecutionKey(release.id, context))!.size)
        .sort(),
    ).toEqual([0, 1]);
  });

  it("should derive finite-call target ownership only from actual source call edges", async () => {
    const result = await closeSource(
      `let pop: fn(): void = peek($0400) != 0 ? &release : &wrapper;
setNMI(&handler); pop(); setNMIExclusive(&handler); disableInterruptSources($1F); pop();`,
      "",
      "function release(): void { restoreNMI(); } function wrapper(): void { release(); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected closed finite target calls");
    const proof = result.program.interruptContextAnalysis!;
    for (const name of ["Game.release", "Game.wrapper"]) {
      const fn = result.program.semantic.functions.find((fn) => fn.name === name)!;
      const key = bindingIdentityKey(fn.id);
      expect(
        result.program.roots.some(
          (root) => root.kind === "callable" && bindingIdentityKey(root.function) === key,
        ),
      ).toBe(true);
      expect(proof.contexts.get(key)?.every(({ nmi }) => nmi === 1)).toBe(true);
      expect(
        new Set(proof.contexts.get(key)?.map(({ releaseVariant }) => releaseVariant)).size,
      ).toBe(2);
    }
    const targets = [...proof.cia2Calls!.values()].flatMap((calls) =>
      [...calls].filter(([operation]) => operation.kind === "indirect-call"),
    );
    expect(targets).toHaveLength(2);
    expect(targets.every(([, selections]) => selections.size === 2)).toBe(true);
  });

  it("should select shutdown for a branch which may mutate the final stock epoch", async () => {
    const result = await closeSource(
      "setNMIExclusive(&handler); if (peek($0400) != 0) { configureTimerA($19); } restoreNMI();",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected safe final joined shutdown");
    expect(
      [...result.program.interruptContextAnalysis!.cia2Restores!.values()].reduce(
        (sum, restores) => sum + restores.size,
        0,
      ),
    ).toBe(1);
  });

  it("should close balanced loop leases without allocating an external-depth device stack", async () => {
    const result = await closeSource(
      "while (peek($0400) != 0) { setNMIExclusive(&handler); disableInterruptSources($1F); restoreNMI(); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected finite balanced loop proof");
    const proof = result.program.interruptContextAnalysis!;
    expect(proof.bindings.size).toBe(1);
    const handler = result.program.semantic.functions.find(({ name }) => name === "Game.handler")!;
    expect(proof.contexts.get(bindingIdentityKey(handler.id))).toHaveLength(1);
  });

  it.each([
    [
      "unowned later helper",
      "setNMIExclusive(&handler); restoreNMI(); work();",
      "",
      "function work(): void {configureTimerA($19);}",
    ],
    ["returning raw handler", "setNMIExclusive(&handler); restoreNMI();", "poke($DDFD, 0);", ""],
  ])("should reject actual unsafe history from %s", async (_name, main, handler, helpers) => {
    const result = await closeSource(main!, handler, helpers);
    expect(result.kind).toBe("error");
    expect(
      result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
    ).toEqual(["E10278"]);
  });
});
