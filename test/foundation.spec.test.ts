import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
const baseline = "3c993529f55cfe880426a35c09c8f9b456487ff5";
const finalV3 = "4c2f27f54273a713c0bbf398bf6c56be45f4aae3";
const authorityCommit = "5deb2a5341bea00cf6050a0aba4668315198d91a";
const frozenDigest = "5c6bac04a56b91d7d55ff570fbbf0dde5f521e2edce8901279dfa39a32c7acfa";
const temporaryRoots: string[] = [];

/** Each negative structural input is an ordinary real directory, not a mock filesystem. */
async function fixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-foundation-"));
  temporaryRoots.push(root);
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  return root;
}

/** Hash raw bytes; UTF-8 decoding or newline normalization must not hide authority changes. */
function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Compare repository authority records with the single frozen identity. */
function identityViolations(record: Readonly<Record<string, string>>): readonly string[] {
  const expected = {
    base: finalV3,
    authority: authorityCommit,
    specification: frozenDigest,
    expertVersion: "2.0.0",
    expertContent: "c9e70fab6039e9ced3108e88f0ea9730d4fd3007",
    router: "e3d3f8f570a7fa8b3c197208ede2f7b41878f29494fc1824fcfabd2c11f53304",
    release: "4ae79fd224a328226ef149104ca44f7d1ab1f62cadc9fc6fc33ceadd7a67c80a",
  };
  return Object.entries(expected)
    .filter(([key, value]) => record[key] !== value)
    .map(([key]) => key);
}

/** Read only the inventory table and check the ten required substantive fields. */
function inventoryViolations(text: string): readonly string[] {
  const violations: string[] = [];
  const rows = text
    .split("\n")
    .filter(
      (line) =>
        line.startsWith("| ") && /`(?:port|adapt|rewrite|discard|reference-only)`/.test(line),
    );
  for (const row of rows) {
    const fields = row
      .split("|")
      .slice(1, -1)
      .map((field) => field.trim());
    if (fields.length !== 10 || fields.some((field) => field === ""))
      violations.push("missing inventory field");
    if (
      !["`port`", "`adapt`", "`rewrite`", "`discard`", "`reference-only`"].includes(fields[8] ?? "")
    ) {
      violations.push("invalid disposition");
    }
    if (
      ["`port`", "`adapt`"].includes(fields[8] ?? "") &&
      /pending|inspection only|no proof/i.test(fields[6] ?? "")
    ) {
      violations.push("retained unit lacks focused proof");
    }
    if (
      ["`port`", "`adapt`"].includes(fields[8] ?? "") &&
      /discarded dependency/i.test(fields[5] ?? "")
    ) {
      violations.push("retained unit depends on discarded code");
    }
  }
  if (rows.length === 0) violations.push("empty inventory");
  return violations;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("frozen execution authority and salvage ownership", () => {
  // Frozen bytes and repository lineage apply to ordinary clones, independent of local worktrees.
  it("should preserve repository lineage and frozen specification/expert identities", async () => {
    const git = async (...args: string[]) =>
      (await execute("git", args, { cwd: repository })).stdout.trim();
    await execute("git", ["merge-base", "--is-ancestor", finalV3, "HEAD"], { cwd: repository });
    await execute("git", ["merge-base", "--is-ancestor", authorityCommit, "HEAD"], {
      cwd: repository,
    });
    const inventory = await readFile(join(repository, "spec/00-normative-inventory.md"), "utf8");
    const normative =
      inventory.split("## Normative Files\n")[1]?.split("## Non-Normative Files")[0] ?? "";
    const names = [...normative.matchAll(/\| `([^`]+)` \|/g)].map((match) => match[1]!);
    expect(names).toHaveLength(18);
    const records = await Promise.all(
      names
        .sort()
        .map(
          async (name) => `${sha256(await readFile(join(repository, "spec", name)))}  ${name}\n`,
        ),
    );
    const skill = join(repository, ".agents/skills/blend65-domain-expert");
    const release = await readFile(join(skill, "qualification/release.md"));
    const record = {
      base: await git("rev-parse", `${finalV3}^{commit}`),
      authority: await git("rev-parse", `${authorityCommit}^{commit}`),
      specification: sha256(records.join("")),
      expertVersion: release
        .toString()
        .includes("Expert `2.0.0` is the single active qualified baseline")
        ? "2.0.0"
        : "missing",
      expertContent: release.toString().includes("c9e70fab6039e9ced3108e88f0ea9730d4fd3007")
        ? "c9e70fab6039e9ced3108e88f0ea9730d4fd3007"
        : "missing",
      router: sha256(await readFile(join(skill, "SKILL.md"))),
      release: sha256(release),
    };
    expect(identityViolations(record)).toEqual([]);
    for (const key of Object.keys(record)) {
      const root = await fixture({
        "identity.json": JSON.stringify({ ...record, [key]: "mismatch" }),
      });
      expect(
        identityViolations(JSON.parse(await readFile(join(root, "identity.json"), "utf8"))),
      ).toEqual([key]);
    }
    expect(
      await git("diff", authorityCommit, "--", "spec", ".agents/skills/blend65-domain-expert"),
    ).toBe("");
  });

  // Every baseline path belongs to one reviewed unit, including non-production fixture families.
  it("should assign every inherited tracked family exactly one complete inventory decision", async () => {
    const path =
      "codeops/features/blend65-v4/plans/rd-02-clean-v4-foundation-and-deterministic-project-model/04-salvage-inventory.md";
    const text = await readFile(join(repository, path), "utf8");
    expect(inventoryViolations(text)).toEqual([]);
    const table =
      text
        .split("## Complete Tracked Component Partition")[1]
        ?.split("## Landing and Checkpoint Proof")[0] ?? "";
    const rows = [...table.matchAll(/^\| `([^`]+)` \((\d+)\) \|/gm)].map((match) => ({
      path: match[1]!,
      count: Number(match[2]),
    }));
    expect(rows.length).toBeGreaterThan(0);
    const tracked = (
      await execute("git", ["ls-tree", "-r", "--name-only", baseline], { cwd: repository })
    ).stdout
      .trim()
      .split("\n");
    const counts = new Map(rows.map((row) => [row.path, 0]));
    for (const file of tracked) {
      const owner = rows
        .filter((row) => file === row.path || file.startsWith(`${row.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0];
      expect(owner, `No inventory owner for ${file}`).toBeDefined();
      counts.set(owner!.path, counts.get(owner!.path)! + 1);
    }
    for (const row of rows) expect(counts.get(row.path), row.path).toBe(row.count);
    const invalid =
      "| `unit` | responsibility | owner | compatibility | evidence | closure | no proof | risk | `port` | destination |";
    const root = await fixture({ "inventory.md": invalid });
    expect(inventoryViolations(await readFile(join(root, "inventory.md"), "utf8"))).toContain(
      "retained unit lacks focused proof",
    );
    const missing = await fixture({ "inventory.md": invalid.replace("| owner |", "| |") });
    expect(inventoryViolations(await readFile(join(missing, "inventory.md"), "utf8"))).toContain(
      "missing inventory field",
    );
    const dependent = await fixture({
      "inventory.md": invalid.replace("| closure |", "| discarded dependency |"),
    });
    expect(inventoryViolations(await readFile(join(dependent, "inventory.md"), "utf8"))).toContain(
      "retained unit depends on discarded code",
    );
  });
});

describe("minimal truthful foundation toolchain", () => {
  // The compiler, CLI and two diagnostics-only editor consumers are the complete workspace set.
  it("should contain exactly the compiler CLI language-server and VS Code workspaces", async () => {
    const directories = (await readdir(join(repository, "packages"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(directories).toEqual(["cli", "compiler", "language-server", "vscode"]);
    for (const name of directories) {
      const manifest = JSON.parse(
        await readFile(join(repository, "packages", name, "package.json"), "utf8"),
      );
      expect(manifest.name).toBe(`@blend65/${name}`);
      expect(manifest.type).toBe("module");
      expect(manifest.exports["."]).toBeDefined();
      expect(manifest.scripts.build).toMatch(/\btsc\b.*(?:--build|-b)\b/);
      expect(manifest.scripts.test).toContain("vitest");
      expect(manifest.scripts.test).not.toContain("passWithNoTests");
      expect(
        Object.values(manifest.dependencies ?? {}).every(
          (version) => !String(version).startsWith("workspace:"),
        ),
      ).toBe(true);
    }
  });

  // Installation and task ownership are distinct: Yarn links, TypeScript references compile, Turbo orders.
  it("should pin stable TypeScript 7 and retain Node 22 Yarn classic Turbo and strict mapped declarations", async () => {
    const manifest = JSON.parse(await readFile(join(repository, "package.json"), "utf8"));
    const options = JSON.parse(
      await readFile(join(repository, "tsconfig.base.json"), "utf8"),
    ).compilerOptions;
    const turbo = JSON.parse(await readFile(join(repository, "turbo.json"), "utf8"));
    expect(manifest.packageManager).toBe("yarn@1.22.22");
    expect(manifest.engines.node).toBe(">=22 <23");
    expect((await readFile(join(repository, ".nvmrc"), "utf8")).trim()).toBe("22");
    expect(manifest.devDependencies.typescript).toMatch(/^7\.\d+\.\d+$/);
    expect(manifest.devDependencies.turbo).toBeDefined();
    expect(manifest.devDependencies.vitest).toBeDefined();
    expect(manifest.scripts.build).toBe("turbo run build");
    expect(manifest.scripts.typecheck).toBe("turbo run typecheck");
    expect(manifest.scripts.test).toContain("turbo run test");
    expect(turbo.tasks.build.dependsOn).toContain("^build");
    expect(turbo.tasks.typecheck.dependsOn).toContain("^build");
    expect(turbo.tasks.test.dependsOn).toContain("^build");
    expect(options).toMatchObject({
      strict: true,
      target: "ES2023",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      composite: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    });
    const installed = JSON.parse(
      await readFile(join(repository, "node_modules/typescript/package.json"), "utf8"),
    );
    expect(installed.version).toMatch(/^7\.\d+\.\d+$/);
    const version = await execute(join(repository, "node_modules/.bin/tsc"), ["--version"], {
      cwd: repository,
    });
    expect(version.stdout.trim()).toMatch(/^Version 7\.\d+\.\d+$/);
  });

  // Vite belongs only to the two editor bundles; no general linter or other bundler is introduced.
  it("should confine Vite to editor workspaces and reject other forbidden configuration", async () => {
    const forbidden =
      /eslint|typescript-eslint|biome|oxlint|webpack|rollup|parcel|native-preview|tsgo|readiness|scoreboard|\bvice\b|passWithNoTests|\blint\b/i;
    const check = (text: string) => forbidden.test(text);
    const configuration = [
      "package.json",
      "turbo.json",
      "tsconfig.json",
      ".github/workflows/ci.yml",
    ];
    const packages = (await readdir(join(repository, "packages"), { withFileTypes: true })).filter(
      (entry) => entry.isDirectory(),
    );
    const viteOwners: string[] = [];
    for (const entry of packages) {
      const path = `packages/${entry.name}/package.json`;
      configuration.push(path);
      const text = await readFile(join(repository, path), "utf8");
      const manifest = JSON.parse(text);
      const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
      if (/\bvite\b/i.test(text)) {
        expect(Object.hasOwn(dependencies, "vite"), path).toBe(true);
        viteOwners.push(entry.name);
      }
    }
    for (const path of configuration)
      expect(check(await readFile(join(repository, path), "utf8")), path).toBe(false);
    for (const path of configuration.filter((path) => path !== ".github/workflows/ci.yml")) {
      expect(await readFile(join(repository, path), "utf8"), path).not.toMatch(/\bacme\b/i);
    }
    for (const path of [
      "package.json",
      "turbo.json",
      "tsconfig.json",
      ".github/workflows/ci.yml",
    ]) {
      expect(await readFile(join(repository, path), "utf8"), path).not.toMatch(/\bvite\b/i);
    }
    expect(viteOwners.sort()).toEqual(["language-server", "vscode"]);
    for (const owner of viteOwners) {
      await expect(
        access(join(repository, `packages/${owner}/vite.config.ts`)),
      ).resolves.toBeUndefined();
    }
    for (const surface of [
      "eslint",
      "webpack",
      "readiness",
      "lint",
      "passWithNoTests",
      "@typescript/native-preview",
    ]) {
      const root = await fixture({
        "package.json": JSON.stringify({ scripts: { test: surface } }),
        "README.md": "Historical readiness and ESLint evidence",
      });
      expect(check(await readFile(join(root, "package.json"), "utf8"))).toBe(true);
    }
  });

  // Rejected operational paths are absent; local untracked build output is permitted.
  it("should remove inherited tests rejected packages generated tracked output and legacy copies", async () => {
    const tracked = (
      await execute("git", ["ls-files", "--cached", "--", "."], { cwd: repository })
    ).stdout
      .trim()
      .split("\n");
    const present: string[] = [];
    for (const path of tracked) {
      try {
        await access(join(repository, path));
        present.push(path);
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      }
    }
    const rejected = (paths: readonly string[]) =>
      paths.filter(
        (path) =>
          (/(?:^|\/)(?:legacy|readiness|readiness-execution|dist|\.turbo|node_modules)(?:\/|$)|(?:^|\/)eslint\.config\.|\.tsbuildinfo$/.test(
            path,
          ) ||
            (/(?:^|\/)vite\.config\./.test(path) &&
              ![
                "packages/language-server/vite.config.ts",
                "packages/vscode/vite.config.ts",
              ].includes(path))) &&
          !path.startsWith("codeops/"),
      );
    expect(rejected(present)).toEqual([]);
    const old = (
      await execute("git", ["ls-tree", "-r", "--name-only", baseline, "packages", "test"], {
        cwd: repository,
      })
    ).stdout
      .trim()
      .split("\n")
      .filter((path) => path.endsWith(".test.ts"));
    expect(present.filter((path) => old.includes(path))).toEqual([]);
    for (const path of [
      "packages/readiness/package.json",
      "packages/readiness-execution/package.json",
      "legacy/compiler.ts",
      "packages/compiler/dist/index.js",
      "packages/compiler/vite.config.ts",
      "eslint.config.mjs",
    ]) {
      const root = await fixture({ [path]: "rejected operational surface" });
      expect(await readFile(join(root, path), "utf8")).toBe("rejected operational surface");
      expect(rejected([path])).toEqual([path]);
    }
  });

  // Rebuilding references twice is stable; a changed dependency cannot hide behind its old declarations.
  it("should rebuild referenced dependencies rather than accept deliberately stale declarations", async () => {
    const root = await fixture({
      "package.json": '{"private":true,"type":"module"}',
      "tsconfig.json": JSON.stringify({
        files: [],
        references: [{ path: "library" }, { path: "consumer" }],
      }),
      "library/tsconfig.json": JSON.stringify({
        compilerOptions: { composite: true, strict: true, declaration: true, outDir: "dist" },
        include: ["index.ts"],
      }),
      "library/index.ts": "export const value: number = 1;",
      "consumer/tsconfig.json": JSON.stringify({
        compilerOptions: { composite: true, strict: true, outDir: "dist" },
        references: [{ path: "../library" }],
        include: ["index.ts"],
      }),
      "consumer/index.ts":
        'import { value } from "../library/index"; const score: number = value; export { score };',
    });
    const tsc = join(repository, "node_modules/.bin/tsc");
    await execute(tsc, ["--build", root], { cwd: root });
    const declarations = await readFile(join(root, "library/dist/index.d.ts"), "utf8");
    await execute(tsc, ["--build", root], { cwd: root });
    expect(await readFile(join(root, "library/dist/index.d.ts"), "utf8")).toBe(declarations);
    await writeFile(join(root, "library/index.ts"), 'export const value: string = "changed";');
    await expect(execute(tsc, ["--build", root], { cwd: root })).rejects.toMatchObject({
      stdout: expect.stringContaining("not assignable to type 'number'"),
    });
  });
});

describe("native foundation qualification configuration", () => {
  // Both hosts run the foundation commands; only Linux provisions the pinned terminal assembler.
  it("should run Node 22 commands on both hosts and provision ACME only on Linux", async () => {
    const workflow = await readFile(join(repository, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toMatch(/runs-on:\s*\$\{\{\s*matrix\./);
    const versions = [...workflow.matchAll(/node-version:\s*["']?(\d+)["']?/g)].map(
      (match) => match[1],
    );
    expect(versions.length).toBeGreaterThan(0);
    expect(versions.every((version) => version === "22")).toBe(true);
    const actions = [...workflow.matchAll(/^\s*-\s*uses:\s*(\S+)/gm)].map((match) => match[1]);
    expect(actions.sort()).toEqual(["actions/checkout@v4", "actions/setup-node@v4"]);
    const steps = workflow.split(/\n(?=\s{6}-\s)/);
    const acmeSteps = steps.filter((step) => /\bacme\b/i.test(step));
    expect(acmeSteps).toHaveLength(1);
    expect(acmeSteps[0]).toMatch(/if:\s*\$\{\{\s*matrix\.os\s*==\s*['"]ubuntu-latest['"]\s*\}\}/);
    expect(acmeSteps[0]).toMatch(/\b0\.97\b/);
    expect(acmeSteps[0]).toMatch(/\b[0-9a-f]{64}\b/i);
    expect(acmeSteps[0]).toMatch(/sha256sum|shasum/i);
    expect(acmeSteps[0]).not.toMatch(/windows-latest/i);
    const ordinaryCommands = steps
      .filter((step) => !/\bacme\b/i.test(step))
      .flatMap((step) => [...step.matchAll(/^\s*run:\s*(.+)$/gm)].map((match) => match[1]!.trim()));
    expect(ordinaryCommands).toEqual([
      "corepack enable",
      "yarn install --frozen-lockfile",
      "yarn build",
      "yarn typecheck",
      "yarn test",
    ]);
    expect(workflow).not.toMatch(
      /\b(?:lint|vice|readiness|scoreboard|benchmark|services)\b|TURBO_TOKEN|TURBO_TEAM|remote[-_ ]cache/i,
    );
  });

  // The completed graph has four actual owners and no future-stage placeholders.
  it("should own exactly the compiler CLI language-server and VS Code workspaces", async () => {
    const directories = (await readdir(join(repository, "packages"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(directories).toEqual(["cli", "compiler", "language-server", "vscode"]);
    const cli = JSON.parse(await readFile(join(repository, "packages/cli/package.json"), "utf8"));
    const library = JSON.parse(
      await readFile(join(repository, "packages/compiler/package.json"), "utf8"),
    );
    expect(Object.keys(cli.dependencies)).toEqual(["@blend65/compiler"]);
    expect(Object.keys(library.dependencies)).toEqual(["jsonc-parser"]);
    expect(cli.bin.blendc).toBe("dist/bin.js");
  });

  // Current guidance distinguishes active v4 ownership from retained historical reference evidence.
  it("should keep current ownership and historical status labels truthful without claiming compilation", async () => {
    const guidance = await readFile(join(repository, "AGENTS.md"), "utf8");
    const readme = await readFile(join(repository, "README.md"), "utf8");
    expect(guidance).toMatch(/current implementation ownership is[\s\S]*?blend65-v4/i);
    expect(guidance).toMatch(/inherited v3 roadmaps are historical\s+reference only/i);
    expect(readme).toMatch(/does not compile Blend65 source/i);
    expect(readme).toMatch(/reference evidence,\s*not current implementation status/i);
  });
});
