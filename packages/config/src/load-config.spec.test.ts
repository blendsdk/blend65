/**
 * Specification tests for `loadConfig()` — discovery integration (ST-1..ST-4),
 * loader-level parse handling (ST-7..ST-9), and the API/E2E contract
 * (ST-28..ST-31 + the RD §4.4 examples).
 *
 * Traceability: RD-16 R3/R4/R26/R28, §4.3 + its edge table, AC-01..AC-03,
 * AC-11/AC-12, AR-P2/AR-P4, via 07-testing-strategy.md. Uses real temp-dir
 * trees per AR-P7 (repo precedent: runtime-asm.spec.test.ts). Written before
 * the implementation exists (immutable-oracle rule).
 */

import { Buffer } from "node:buffer";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDiagnosticBag } from "@blend65/core";
import { afterAll, describe, expect, it } from "vitest";
import { CONFIG_SOURCE_ID } from "./types.js";
import { loadConfig } from "./load-config.js";

/** All temp roots created by this file, removed in afterAll. */
const tempRoots: string[] = [];

/** Creates a fresh temp tree and registers it for cleanup. */
function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "blend65-config-spec-"));
  tempRoots.push(dir);
  return dir;
}

/** Writes `content` as `<dir>/blend65.json` (creating `dir` if needed). */
function writeConfig(dir: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "blend65.json");
  writeFileSync(path, content, "utf8");
  return path;
}

afterAll(() => {
  for (const dir of tempRoots) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("discovery integration (ST-1..ST-4 / R3, R4)", () => {
  it("ST-1: walks up to the nearest blend65.json and derives projectRoot from it (AC-02)", () => {
    const root = makeTempDir();
    const configPath = writeConfig(root, '{"platform":"c64"}');
    const nested = join(root, "b", "c");
    mkdirSync(nested, { recursive: true });

    const bag = createDiagnosticBag();
    const { config } = loadConfig({ bag, cwd: nested });
    expect(config.configPath).toBe(configPath);
    expect(config.projectRoot).toBe(root);
  });

  it("ST-1: the nearest file wins when an ancestor also has one (R4)", () => {
    const root = makeTempDir();
    writeConfig(root, '{"platform":"c64"}');
    const mid = join(root, "b");
    const midConfig = writeConfig(mid, '{"platform":"cx16"}');
    const nested = join(mid, "c");
    mkdirSync(nested, { recursive: true });

    const bag = createDiagnosticBag();
    const { config } = loadConfig({ bag, cwd: nested });
    expect(config.configPath).toBe(midConfig);
    expect(config.projectRoot).toBe(mid);
    expect(config.platform).toBe("cx16");
  });

  it("ST-2: a discovery miss is not an error — defaults + overrides apply (R3/AC-03)", () => {
    const dir = makeTempDir();
    const bag = createDiagnosticBag();
    const { config, hasErrors } = loadConfig({
      bag,
      cwd: dir,
      overrides: { platform: "c64" },
    });
    expect(hasErrors).toBe(false);
    expect(config.configPath).toBeNull();
    expect(config.projectRoot).toBe(dir);
    expect(config.platform).toBe("c64");
    expect(config.outDir).toBe("./build/");
    expect(config.maxErrors).toBe(20);
  });

  it("ST-3: a missing EXPLICIT configPath is E10240 with populated defaults (AC-11)", () => {
    const dir = makeTempDir();
    const missing = join(dir, "nope.json");
    const bag = createDiagnosticBag();
    let result: ReturnType<typeof loadConfig> | undefined;
    expect(() => {
      result = loadConfig({ bag, configPath: missing });
    }).not.toThrow();
    const notFound = bag.getErrors().filter((d) => d.code === "E10240");
    expect(notFound.length).toBe(1);
    expect(notFound[0]!.message).toContain(missing);
    expect(result!.hasErrors).toBe(true);
    expect(result!.config.outDir).toBe("./build/");
    expect(result!.config.maxErrors).toBe(20);
  });

  it("ST-4: an explicit configPath bypasses discovery entirely (R4)", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"platform":"cx16"}'); // decoy in cwd
    const other = join(dir, "other");
    mkdirSync(other, { recursive: true });
    const explicit = join(other, "cfg.json");
    writeFileSync(explicit, '{"platform":"c64"}', "utf8");

    const bag = createDiagnosticBag();
    const { config } = loadConfig({ bag, configPath: explicit, cwd: dir });
    expect(config.configPath).toBe(explicit);
    expect(config.projectRoot).toBe(other);
    expect(config.platform).toBe("c64");
  });
});

describe("loader-level parse handling (ST-7..ST-9 / AR-P4)", () => {
  it("ST-7: a malformed file emits E10241 with an in-file CONFIG_SOURCE_ID span and still returns a config", () => {
    const dir = makeTempDir();
    const text = '{"platform": }';
    writeConfig(dir, text);
    const bag = createDiagnosticBag();
    const { config } = loadConfig({ bag, cwd: dir });
    const parseErrors = bag.getErrors().filter((d) => d.code === "E10241");
    expect(parseErrors.length).toBeGreaterThanOrEqual(1);
    const byteLength = Buffer.byteLength(text, "utf8");
    for (const diagnostic of parseErrors) {
      expect(diagnostic.primarySpan?.sourceId).toBe(CONFIG_SOURCE_ID);
      expect(diagnostic.primarySpan?.start).toBeGreaterThanOrEqual(0);
      expect(diagnostic.primarySpan?.start).toBeLessThan(byteLength);
    }
    expect(config.outDir).toBe("./build/");
  });

  it("ST-8: two distinct syntax errors both survive dedup (AR-P2)", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"a": , "b": }');
    const bag = createDiagnosticBag();
    loadConfig({ bag, cwd: dir });
    const parseErrors = bag.getErrors().filter((d) => d.code === "E10241");
    expect(parseErrors.length).toBe(2);
    expect(parseErrors[0]!.primarySpan?.start).not.toBe(parseErrors[1]!.primarySpan?.start);
  });

  it.each(["[]", '"x"'])(
    "ST-9: top-level %s is E10242 and the file contributes no values",
    (text) => {
      const dir = makeTempDir();
      writeConfig(dir, text);
      const bag = createDiagnosticBag();
      const { config, hasErrors } = loadConfig({
        bag,
        cwd: dir,
        overrides: { platform: "c64" },
      });
      expect(hasErrors).toBe(true);
      expect(bag.getErrors().some((d) => d.code === "E10242")).toBe(true);
      expect(config.platform).toBe("c64"); // override survives
      expect(config.outDir).toBe("./build/"); // defaults intact
    },
  );
});

describe("loadConfig API contract (ST-28..ST-31)", () => {
  it("ST-28: a minimal config populates EVERY BlendConfig field with its §4.1 default (AC-11/AC-12)", () => {
    const dir = makeTempDir();
    const configPath = writeConfig(dir, '{ "platform": "c64" }');
    const bag = createDiagnosticBag();
    const { config, hasErrors } = loadConfig({ bag, cwd: dir, knownPlatforms: ["c64"] });
    expect(hasErrors).toBe(false);
    expect(config.configPath).toBe(configPath);
    expect(config.projectRoot).toBe(dir);
    expect(config.platform).toBe("c64");
    expect(config.include).toEqual(["**/*.blend"]);
    expect(config.exclude).toEqual(["node_modules/**"]);
    expect(config.outDir).toBe("./build/");
    expect(config.outName).toBe("");
    expect(config.acmePath).toBe("");
    expect(config.maxErrors).toBe(20);
    expect(config.warnAsError).toBe(false);
    expect(config.suppressWarnings).toEqual([]);
    expect(config.diagnosticsFormat).toBe("terminal");
    expect(config.optimize).toBe(true);
    expect(config.quiet).toBe(false);
    expect(config.startup).toBe("auto");
  });

  it("ST-29: hasErrors reflects only THIS call's errors, not the bag's prior state (§4.2)", () => {
    const dir = makeTempDir();
    // Error scenario over a pre-populated bag → still true.
    const dirtyBag = createDiagnosticBag();
    dirtyBag.addError("E10001", null, "unrelated pre-existing error");
    const errored = loadConfig({ bag: dirtyBag, configPath: join(dir, "nope.json") });
    expect(errored.hasErrors).toBe(true);

    // Clean load over a dirty bag → false despite the bag containing errors.
    writeConfig(dir, '{"platform":"c64"}');
    const dirtyBag2 = createDiagnosticBag();
    dirtyBag2.addError("E10001", null, "unrelated pre-existing error");
    const clean = loadConfig({ bag: dirtyBag2, cwd: dir });
    expect(clean.hasErrors).toBe(false);
  });

  it("ST-30: loadConfig is synchronous and never throws on garbled input (R28/R26)", () => {
    const dir = makeTempDir();
    writeConfig(dir, " {{{{[[[");
    const bag = createDiagnosticBag();
    let result: ReturnType<typeof loadConfig> | undefined;
    expect(() => {
      result = loadConfig({ bag, cwd: dir });
    }).not.toThrow();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result!.hasErrors).toBe("boolean");
    expect(result!.config).toBeDefined();
  });

  it("ST-31: all diagnostics land in the caller's bag with CONFIG_SOURCE_ID by default (R26/AR-P2)", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"platform": }');
    const bag = createDiagnosticBag();
    loadConfig({ bag, cwd: dir });
    expect(bag.count()).toBeGreaterThanOrEqual(1);
    for (const diagnostic of bag.getAll()) {
      if (diagnostic.primarySpan !== null && diagnostic.primarySpan.start >= 0) {
        expect(diagnostic.primarySpan.sourceId).toBe(CONFIG_SOURCE_ID);
      }
    }
  });

  it("ST-31: a caller-supplied sourceId replaces the sentinel (AR-P2)", () => {
    const dir = makeTempDir();
    writeConfig(dir, '{"platform": }');
    const bag = createDiagnosticBag();
    loadConfig({ bag, cwd: dir, sourceId: 7 });
    const fileAnchored = bag
      .getAll()
      .filter((d) => d.primarySpan !== null && d.primarySpan.start >= 0);
    expect(fileAnchored.length).toBeGreaterThanOrEqual(1);
    for (const diagnostic of fileAnchored) {
      expect(diagnostic.primarySpan?.sourceId).toBe(7);
    }
  });
});

describe("RD §4.4 example configs end-to-end (AC-12)", () => {
  it("loads the full-project example verbatim with zero diagnostics", () => {
    const dir = makeTempDir();
    writeConfig(
      dir,
      `{
  // Blend65 project configuration
  "platform": "c64",
  "include": ["src/**/*.blend"],
  "exclude": ["src/test/**"],

  "outDir": "./dist/",
  "outName": "mygame",

  // ACME assembler (only needed for build, not check)
  "acmePath": "/usr/local/bin/acme",

  // Diagnostics
  "maxErrors": 50,
  "warnAsError": ["W10130"],  // unreachable code is an error in this project
  "suppressWarnings": ["W10180"],  // we know our stack is fine

  // Build
  "optimize": true,
  "quiet": false,
  "startup": "auto"
}`,
    );
    const bag = createDiagnosticBag();
    const { config, hasErrors } = loadConfig({ bag, cwd: dir, knownPlatforms: ["c64"] });
    expect(hasErrors).toBe(false);
    expect(bag.count()).toBe(0);
    expect(config.platform).toBe("c64");
    expect(config.include).toEqual(["src/**/*.blend"]);
    expect(config.exclude).toEqual(["src/test/**"]);
    expect(config.outDir).toBe("./dist/");
    expect(config.outName).toBe("mygame");
    expect(config.acmePath).toBe("/usr/local/bin/acme");
    expect(config.maxErrors).toBe(50);
    expect(config.warnAsError).toEqual(["W10130"]);
    expect(config.suppressWarnings).toEqual(["W10180"]);
    expect(config.optimize).toBe(true);
    expect(config.quiet).toBe(false);
    expect(config.startup).toBe("auto");
  });

  it("loads the Commander X16 example verbatim with zero diagnostics", () => {
    const dir = makeTempDir();
    writeConfig(
      dir,
      `{
  "platform": "cx16",
  "include": ["**/*.blend"],
  "outDir": "./build/",
  "startup": "terminating"
}`,
    );
    const bag = createDiagnosticBag();
    const { config, hasErrors } = loadConfig({ bag, cwd: dir, knownPlatforms: ["c64", "cx16"] });
    expect(hasErrors).toBe(false);
    expect(bag.count()).toBe(0);
    expect(config.platform).toBe("cx16");
    expect(config.startup).toBe("terminating");
  });
});
