import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "../index.js";

describe("interrupt machine domains", () => {
  it("materializes a handler's explicit raw word address", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-handler-word-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "handler-word",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "interrupt function handler(): void { poke($D019, 1); }",
          "let raw: word = word(&handler);",
          "function main(): void { pokew($0400, raw); pokew($0402, word(&handler)); }",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") return;
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      expect(assembly).toMatch(/\brti\b/mu);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("selects one of two proved CINV entries from a runtime handler value", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-handler-selection-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "handler-selection",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function first(): void { poke($D019, 1); }",
          "interrupt function second(): void { poke($D019, 2); }",
          "function main(): void { setIRQ(peek($0400) != 0 ? &first : &second); restoreIRQ(); }",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") return;
      const debug = JSON.parse(
        await readFile(join(result.generation.directory, ".debug.json"), "utf8"),
      ) as {
        functions: { kind: string; entryVariants: { id: string; label: string }[] }[];
      };
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      const entries = debug.functions
        .filter(({ kind }) => kind === "interrupt")
        .flatMap(({ entryVariants }) =>
          entryVariants
            .filter(({ id }) => id.includes("c64_kernal_cinv_chain"))
            .map(({ label }) => label),
        );
      expect(entries).toHaveLength(2);
      expect(
        debug.functions
          .filter(({ kind }) => kind === "interrupt")
          .flatMap(({ entryVariants }) => entryVariants),
      ).toHaveLength(2);
      for (const label of entries) expect(assembly).toContain(label);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("rejects a handler whose repeated entries grow vector ownership", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-irq-growth-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "irq-growth",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function handler(): void { setIRQ(&handler); }",
          "function main(): void { setIRQ(&handler); restoreIRQ(); }",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind).toBe("failure");
      if (result.kind === "failure") {
        expect(result.diagnostics.map(({ code }) => code)).toContain("E10245");
      }
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("rejects the selected profile's unbounded NMI re-entry before unsafe vector lowering", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-nmi-bound-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "nmi-bound",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setNMI, restoreNMI } from c64.system;",
          "interrupt function handler(): void {}",
          "function main(): void { setNMI(&handler); restoreNMI(); }",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind).toBe("failure");
      if (result.kind === "failure") {
        expect(result.diagnostics.map(({ code }) => code)).toContain("E10245");
      }
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("uses separate fixed homes and call targets for a helper shared with IRQ", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-domain-machine-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "domain-machine",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setIRQ, restoreIRQ } from c64.system;",
          "let shared: byte = 0;",
          "function helper(value: byte): byte { let temporary: byte = value + 1; return temporary; }",
          "interrupt function handler(): void { shared = helper(shared); }",
          "function main(): void { setIRQ(&handler); shared = helper(shared); restoreIRQ(); }",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") return;
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      const debug = JSON.parse(
        await readFile(join(result.generation.directory, ".debug.json"), "utf8"),
      );
      const helper = debug.functions.find((fn: { qualifiedName: string }) =>
        fn.qualifiedName.endsWith(".helper"),
      );
      expect(helper?.entryVariants).toHaveLength(2);
      for (const variant of helper.entryVariants) {
        expect(assembly).toContain(`jsr+2 ${variant.label}`);
      }
      const homes = debug.symbols
        .map((symbol: { qualifiedName: string }, index: number) => ({
          symbol,
          location: debug.locations[index],
        }))
        .filter(
          ({ symbol }: { symbol: { qualifiedName: string } }) =>
            symbol.qualifiedName.includes(".helper::") &&
            symbol.qualifiedName.includes(":parameter:"),
        )
        .map(
          ({
            location,
          }: {
            location: { availability: { pieces: { machine: { start: number } }[] } };
          }) => location.availability.pieces[0].machine.start,
        );
      expect(new Set(homes).size).toBe(2);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("keeps two calls to an installing helper's predecessor links distinct", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-nested-install-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "nested-install",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function handler(): void {}",
          "function install(): void { let mark: byte = peek($0400); if (mark != 0) { poke($0401, mark); } setIRQ(&handler); }",
          "function main(): void { install(); install(); restoreIRQ(); restoreIRQ(); }",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") return;
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      const calls = assembly.match(/^\s*jsr\+2 (\S+)\n\s*jsr\+2 (\S+)/mu);
      expect(calls).not.toBeNull();
      expect(calls?.[1]).not.toBe(calls?.[2]);
      const debug = JSON.parse(
        await readFile(join(result.generation.directory, ".debug.json"), "utf8"),
      ) as {
        symbols: {
          qualifiedName: string;
          locationIndexes: number[];
        }[];
        locations: {
          availability: { pieces?: { machine: { start: number } }[] };
        }[];
        functions: {
          kind: string;
          entryVariants: unknown[];
        }[];
      };
      const links = debug.symbols.filter(({ qualifiedName }) =>
        qualifiedName.includes("interrupt-link:irq:"),
      );
      expect(links).toHaveLength(2);
      for (const link of links) {
        const address =
          debug.locations[link.locationIndexes[0]!]!.availability.pieces?.[0]?.machine.start;
        expect(address).toBeDefined();
        expect(address! & 0xff).not.toBe(0xff);
      }
      expect(debug.functions.find(({ kind }) => kind === "interrupt")?.entryVariants).toHaveLength(
        2,
      );
      const local = debug.symbols.find(
        ({ qualifiedName }) =>
          qualifiedName.includes(".install::") && qualifiedName.includes(":local:"),
      );
      expect(local?.locationIndexes).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("keeps function-value identity while indirect calls select fixed install depths", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-indirect-install-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "indirect-install",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function handler(): void {}",
          "function installShared(): void { setIRQ(&handler); }",
          "function installFirst(): void { installShared(); }",
          "function installSecond(): void { installShared(); }",
          "function main(): void {",
          "  let install: fn(): void = peek($0400) != 0 ? &installFirst : &installSecond;",
          "  install(); install(); restoreIRQ(); restoreIRQ();",
          "}",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") return;
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      const debug = JSON.parse(
        await readFile(join(result.generation.directory, ".debug.json"), "utf8"),
      ) as {
        functions: {
          qualifiedName: string;
          entryVariants: { label: string }[];
        }[];
      };
      const first = debug.functions.find(({ qualifiedName }) =>
        qualifiedName.endsWith(".installFirst"),
      );
      expect(first?.entryVariants).toHaveLength(2);
      if (first === undefined) return;
      const [canonical, secondDepth] = first.entryVariants;
      expect(assembly).toContain(`cmp #<(${canonical!.label})`);
      expect(assembly).toContain(`cmp #>(${canonical!.label})`);
      expect(assembly).toContain(`jsr+2 ${secondDepth!.label}`);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("selects different installer bodies from ordered global initializers", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-initializer-install-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "initializer-install",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function handler(): void {}",
          "function install(): byte { setIRQ(&handler); return 1; }",
          "let first: byte = install();",
          "let second: byte = install();",
          "function main(): void { restoreIRQ(); restoreIRQ(); }",
        ].join("\n"),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") return;
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      const debug = JSON.parse(
        await readFile(join(result.generation.directory, ".debug.json"), "utf8"),
      ) as {
        functions: {
          qualifiedName: string;
          entryVariants: { label: string }[];
        }[];
      };
      const install = debug.functions.find(({ qualifiedName }) =>
        qualifiedName.endsWith(".install"),
      );
      expect(install?.entryVariants).toHaveLength(2);
      for (const variant of install?.entryVariants ?? []) {
        expect(assembly).toContain(`jsr+2 ${variant.label}`);
      }
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
