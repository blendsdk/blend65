import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { BUILD_INFO } from "@blend65/compiler";
import { afterEach, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
/** The complete release record exceeds Git's default subprocess buffer; never truncate authority. */
const committedBytes = (path: string, commit = releaseCommit): Buffer =>
  execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: repository,
    maxBuffer: 2 * 1024 * 1024,
  });
const baseline = "3c993529f55cfe880426a35c09c8f9b456487ff5";
const finalV3 = "4c2f27f54273a713c0bbf398bf6c56be45f4aae3";
const authorityCommit = "5deb2a5341bea00cf6050a0aba4668315198d91a";
const frozenDigest = "1c2a2d7544e263020c6b7c5b40dc15aa23178d15e6b12b4e0224b18667e48dcf";
/** Immutable activation checkpoint; every specification and expert file stays byte-exact. */
const releaseCommit = "e063ef575d13c02c076c94e24616dd27ae4a75e2";
/** Historical last checkpoint before migration, retained only for the earlier freeze proof. */
const initialHead = "29df75554854dcdc43279308867a8c6725b08180";
/** Immutable qualified content; only its release bookkeeping may change during activation. */
const contentCommit = "13b995d0ddacc304aa066e015c14c63678e99dcc";
const skillPath = ".agents/skills/blend65-domain-expert";
const inactiveStatus =
  "> **Status**: Documentary qualification complete; inactive — whole-task review and content binding pending";
const activeStatus =
  "> **Status**: Active qualified and frozen — exact approval, byte-identical migration and immutable content binding complete";
/** Independently qualified raw-byte identities; these are not read from release declarations. */
const candidateIdentity = {
  specificationFiles: "45",
  specification: "d6c6e8f15e70be4dca9d623ef42257498b4567995b5b92bb2d4b33e4827d39d5",
  normativeFiles: "18",
  normative: "566da991146be7ef6a09efa63449421e27c4873cde9788c84220d187460586f7",
  expertFiles: "22",
  expert: "16fc1cfe0161a4834d6ead608326cbf85dedf817943936c0320c1abf6b13bd66",
  runtimeFiles: "15",
  runtime: "5a422482f1c82d1ed15f61d35e447f9cd6e9af80bd930841a82a4c0de8128bef",
  router: "74b1c0b90aac9999f556e7dd4530c035c8c4456de1f0a57f660c3dc4ab00d43f",
  release: "1e2c67c3aaa5b68d6a094136e6b415280636d543e7280958770fca5ff4dfaea7",
  state: "active",
};
/** The fixed content checkpoint is inactive, not an open-ended permission for pending releases. */
const inactiveIdentity = {
  ...candidateIdentity,
  expert: "a56c667b12450307b676c3f188e9a3898bb3852cff1fd0b14a8048a19a9f27ca",
  release: "7a8f7b8f993c04795eca6a7c791de8c94bccf64a9221468ceeb12c4b45d37b1b",
  state: "inactive",
};
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
    expertVersion: "2.0.1",
    expertContent: "1ce4852016e2a883cf1f733c6014c45e176bfc69",
    router: "8111b2ebc7584ee427a16951be0bfafce199ae6166094de8befa9f092848ce68",
    release: "8a681fdefa7ef524ec4f21193521fde7d6d82760158f759d9836a9d4def9227b",
  };
  return Object.entries(expected)
    .filter(([key, value]) => record[key] !== value)
    .map(([key]) => key);
}

/** Enumerate every actual file, including untracked additions; links cannot conceal membership. */
async function authorityFiles(root: string, prefix = ""): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const [name, bytes] of await authorityFiles(root, path)) files.set(name, bytes);
    } else if (entry.isFile()) {
      files.set(path, await readFile(join(root, path)));
    } else {
      throw new Error(`Authority member is not a regular file: ${path}`);
    }
  }
  return files;
}

/** GNU-style records bind both raw file bytes and exact membership in byte-sorted path order. */
function recordDigest(files: ReadonlyMap<string, Buffer>): string {
  const names = [...files.keys()].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  return sha256(names.map((name) => `${sha256(files.get(name)!)}  ${name}\n`).join(""));
}

/** Read only the fixed authority roots from a commit, with the same record format as disk bytes. */
function committedAuthorityFiles(root: string, commit: string): Map<string, Buffer> {
  const names = execFileSync("git", ["ls-tree", "-r", "--name-only", commit, "--", root], {
    cwd: repository,
  })
    .toString()
    .trim()
    .split("\n");
  return new Map(names.map((name) => [name.slice(root.length + 1), committedBytes(name, commit)]));
}

/** Independently bind the full trees, declared normative members and non-qualification runtime. */
function candidateRecord(
  specification: ReadonlyMap<string, Buffer>,
  expert: ReadonlyMap<string, Buffer>,
): Record<string, string> {
  const inventory = specification.get("00-normative-inventory.md")?.toString() ?? "";
  const section =
    inventory.split(/## Normative Files\r?\n/u)[1]?.split("## Non-Normative Files")[0] ?? "";
  const names = [...section.matchAll(/\| `([^`]+)` \|/g)].map((match) => match[1]!);
  const normative = new Map<string, Buffer>();
  for (const name of names) {
    const bytes = specification.get(name);
    if (!bytes || normative.has(name)) throw new Error(`Invalid normative member: ${name}`);
    normative.set(name, bytes);
  }
  const runtime = new Map([...expert].filter(([name]) => !name.startsWith("qualification/")));
  const release = expert.get("qualification/release.md") ?? Buffer.alloc(0);
  const current = release.toString().split("## Historical 2.0.1 release record")[0] ?? "";
  const inactive =
    current.startsWith("# Blend65 Domain Expert Release Record\n") &&
    current.includes("## Current 2.0.2 authority-maintenance candidate\n") &&
    current.split("\n").includes(inactiveStatus) &&
    current.includes("Candidate migration is not activation;");
  const active =
    current.startsWith("# Blend65 Domain Expert Release Record\n") &&
    current.includes("## Current 2.0.2 release\n") &&
    current.split("\n").includes(activeStatus) &&
    current.includes("Expert `2.0.2` is the single active") &&
    current.includes(contentCommit);
  return {
    specificationFiles: String(specification.size),
    specification: recordDigest(specification),
    normativeFiles: String(names.length),
    normative: recordDigest(normative),
    expertFiles: String(expert.size),
    expert: recordDigest(expert),
    runtimeFiles: String(runtime.size),
    runtime: recordDigest(runtime),
    router: sha256(expert.get("SKILL.md") ?? Buffer.alloc(0)),
    release: sha256(release),
    state: active ? "active" : inactive ? "inactive" : "missing",
  };
}

/** Report every candidate mismatch rather than trusting a release file's self-declared hashes. */
function candidateViolations(
  record: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>> = candidateIdentity,
): readonly string[] {
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
  // Public build metadata identifies the exact frozen specification and qualified expert baseline.
  it("should expose the frozen specification and expert identities in public build metadata", () => {
    expect(BUILD_INFO.specificationId).toBe(
      "BLEND65-SPEC-4-566da991146be7ef6a09efa63449421e27c4873cde9788c84220d187460586f7",
    );
    expect(BUILD_INFO.expertVersion).toBe("2.0.2");
    expect(BUILD_INFO.expertContentCommit).toBe(contentCommit);
  });

  // Frozen bytes and repository lineage apply to ordinary clones, independent of local worktrees.
  it("should preserve repository lineage and frozen specification/expert identities", async () => {
    const git = async (...args: string[]) =>
      (await execute("git", args, { cwd: repository })).stdout.trim();
    await execute("git", ["merge-base", "--is-ancestor", finalV3, "HEAD"], { cwd: repository });
    await execute("git", ["merge-base", "--is-ancestor", authorityCommit, "HEAD"], {
      cwd: repository,
    });
    const inventory = committedBytes("spec/00-normative-inventory.md").toString();
    const normative =
      inventory.split(/## Normative Files\r?\n/u)[1]?.split("## Non-Normative Files")[0] ?? "";
    const names = [...normative.matchAll(/\| `([^`]+)` \|/g)].map((match) => match[1]!);
    expect(names).toHaveLength(18);
    const records = await Promise.all(
      names.sort().map(async (name) => `${sha256(committedBytes(`spec/${name}`))}  ${name}\n`),
    );
    const release = committedBytes(`${skillPath}/qualification/release.md`);
    const record = {
      base: await git("rev-parse", `${finalV3}^{commit}`),
      authority: await git("rev-parse", `${authorityCommit}^{commit}`),
      specification: sha256(records.join("")),
      expertVersion: release
        .toString()
        .includes("Expert `2.0.1` is the single active qualified and frozen baseline")
        ? "2.0.1"
        : "missing",
      expertContent: release.toString().includes("1ce4852016e2a883cf1f733c6014c45e176bfc69")
        ? "1ce4852016e2a883cf1f733c6014c45e176bfc69"
        : "missing",
      router: sha256(committedBytes(".agents/skills/blend65-domain-expert/SKILL.md")),
      release: sha256(
        committedBytes(".agents/skills/blend65-domain-expert/qualification/release.md"),
      ),
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
    expect(await git("diff", releaseCommit, initialHead, "--", "spec", skillPath)).toBe("");
    expect(inventory).toContain(frozenDigest);
  });

  // Activation changes only pinned release bookkeeping, never the qualified content it selects.
  it("should bind the exact active authority to immutable qualified content", async () => {
    for (const key of Object.keys(candidateIdentity)) {
      const root = await fixture({
        "identity.json": JSON.stringify({ ...candidateIdentity, [key]: "mismatch" }),
      });
      expect(
        candidateViolations(JSON.parse(await readFile(join(root, "identity.json"), "utf8"))),
      ).toEqual([key]);
    }
    const contentSpec = committedAuthorityFiles("spec", contentCommit);
    const contentExpert = committedAuthorityFiles(skillPath, contentCommit);
    expect(
      candidateViolations(candidateRecord(contentSpec, contentExpert), inactiveIdentity),
    ).toEqual([]);
    const diskSpec = await authorityFiles(join(repository, "spec"));
    const diskExpert = await authorityFiles(join(repository, skillPath));
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository }).toString().trim();
    const headSpec = committedAuthorityFiles("spec", head);
    const headExpert = committedAuthorityFiles(skillPath, head);
    expect(
      candidateViolations(
        candidateRecord(headSpec, headExpert),
        head === contentCommit ? inactiveIdentity : candidateIdentity,
      ),
    ).toEqual([]);
    for (const specification of [diskSpec, headSpec]) {
      expect([...specification.keys()].sort()).toEqual([...contentSpec.keys()].sort());
      for (const [name, bytes] of contentSpec) {
        expect(specification.get(name)?.equals(bytes), name).toBe(true);
      }
    }
    for (const expert of [diskExpert, headExpert]) {
      expect([...expert.keys()].sort()).toEqual([...contentExpert.keys()].sort());
      for (const [name, bytes] of contentExpert) {
        if (name !== "qualification/release.md") {
          expect(expert.get(name)?.equals(bytes), name).toBe(true);
        }
      }
    }
    expect(candidateViolations(candidateRecord(diskSpec, diskExpert))).toEqual([]);
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
  it("should require at least Node 22 and retain stable TypeScript 7, Yarn classic, Turbo and strict mapped declarations", async () => {
    const manifest = JSON.parse(await readFile(join(repository, "package.json"), "utf8"));
    const options = JSON.parse(
      await readFile(join(repository, "tsconfig.base.json"), "utf8"),
    ).compilerOptions;
    const turbo = JSON.parse(await readFile(join(repository, "turbo.json"), "utf8"));
    expect(manifest.packageManager).toBe("yarn@1.22.22");
    expect(manifest.engines.node).toBe(">=22");
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
    const tsc = join(repository, "node_modules/typescript/bin/tsc");
    const version = await execute(process.execPath, [tsc, "--version"], {
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
    const tsc = join(repository, "node_modules/typescript/bin/tsc");
    await execute(process.execPath, [tsc, "--build", root], { cwd: root });
    const declarations = await readFile(join(root, "library/dist/index.d.ts"), "utf8");
    await execute(process.execPath, [tsc, "--build", root], { cwd: root });
    expect(await readFile(join(root, "library/dist/index.d.ts"), "utf8")).toBe(declarations);
    await writeFile(join(root, "library/index.ts"), 'export const value: string = "changed";');
    await expect(
      execute(process.execPath, [tsc, "--build", root], { cwd: root }),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("not assignable to type 'number'"),
    });
  });
});

describe("native foundation qualification configuration", () => {
  // Both hosts run the same commands with their own checksum-pinned ACME 0.97 binary.
  it("should run Node 22 commands and provision pinned ACME on both hosts", async () => {
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
    expect(acmeSteps).toHaveLength(2);
    const linuxAcme = acmeSteps.find((step) =>
      /if:\s*\$\{\{\s*matrix\.os\s*==\s*['"]ubuntu-latest['"]\s*\}\}/.test(step),
    );
    const windowsAcme = acmeSteps.find((step) =>
      /if:\s*\$\{\{\s*matrix\.os\s*==\s*['"]windows-latest['"]\s*\}\}/.test(step),
    );
    expect(linuxAcme).toMatch(/\b0\.97\b/);
    expect(linuxAcme).toMatch(/\b[0-9a-f]{64}\b/i);
    expect(linuxAcme).toMatch(/sha256sum|shasum/i);
    expect(windowsAcme).toMatch(/\b0\.97\b/);
    expect(windowsAcme).toMatch(/\b[0-9a-f]{64}\b/i);
    expect(windowsAcme).toMatch(/Get-FileHash/);
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
