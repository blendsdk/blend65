import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { beforeAll, describe, expect, it } from "vitest";

/** Existing ledger fields consumed by the direct expiry check. */
interface Limitation {
  readonly id: string;
  readonly status: "deferred" | "retired";
  readonly diagnostic: string;
  readonly owner: string;
  readonly reason: string;
}

/** Public build outcome reduced to the acceptance and diagnostic facts under test. */
interface Observation {
  readonly kind: string;
  readonly errors: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Reject malformed ledger input before interpreting its recorded restriction status. */
async function readLimitations(): Promise<readonly Limitation[]> {
  const document: unknown = JSON.parse(
    await readFile(new URL("./expressiveness-ledger.json", import.meta.url), "utf8"),
  );
  if (!isRecord(document) || !Array.isArray(document.limitations)) {
    throw new Error("The ledger must contain limitation rows");
  }
  const rows: readonly unknown[] = document.limitations;
  return rows.map((row) => {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      (row.status !== "deferred" && row.status !== "retired") ||
      typeof row.diagnostic !== "string" ||
      typeof row.owner !== "string" ||
      typeof row.reason !== "string"
    ) {
      throw new Error("The ledger contains a malformed limitation");
    }
    return {
      id: row.id,
      status: row.status,
      diagnostic: row.diagnostic,
      owner: row.owner,
      reason: row.reason,
    };
  });
}

/** Build through the public service so late storage proof participates in the observed result. */
async function observe(source: string): Promise<Observation> {
  const root = await mkdtemp(join(tmpdir(), "blend65-ledger-spec-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "ledger-probe",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    return {
      kind: result.kind,
      errors: result.diagnostics
        .filter(({ severity }) => severity === "error")
        .map(({ code }) => code),
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** A balanced save span makes stack pressure explicit without introducing recursion. */
function saves(count: number): string {
  return `${"asm_php(); ".repeat(count)}${"asm_plp(); ".repeat(count)}`;
}

/** Keep the balanced and unmatched forms byte-for-byte identical across their separate oracles. */
const handlerIrqSources = [
  "setIRQ(&next); restoreIRQ();",
  "setIRQExclusive(&next); restoreIRQ();",
  "restoreIRQ();",
].map(
  (update) => `module Game;
import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;
interrupt function next(): void {}
interrupt function handler(): void { ${update} }
function main(): void { asm_cli(); asm_nop(); setIRQ(&handler); asm_nop(); restoreIRQ(); }`,
);

const probes = [
  {
    id: "v4-nmi-installation",
    sources: ["setNMIExclusive"].map(
      (installer) => `module Game;
import { ${installer}, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { ${installer}(&handler); restoreNMI(); }`,
    ),
  },
  {
    id: "v4-nmi-chained-installation",
    sources: ["setNMI"].map(
      (installer) => `module Game;
import { ${installer}, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { ${installer}(&handler); restoreNMI(); }`,
    ),
  },
  {
    id: "v4-handler-irq-update",
    sources: handlerIrqSources.slice(0, 2),
  },
  {
    id: "v4-stack-route-overestimate",
    sources: [
      "leaf(); setIRQ(&handler); restoreIRQ();",
      "setIRQ(&handler); restoreIRQ(); leaf();",
    ].map(
      (main) => `module Game;
import { setIRQ, restoreIRQ } from c64.system;
interrupt function handler(): void { ${saves(10)} }
function leaf(): void { ${saves(226)} }
function main(): void { asm_cli(); asm_nop(); ${main} }`,
    ),
  },
];

/**
 * A deferred row must still reproduce its exact error; a retired row must now build successfully.
 * Requiring an owner and reason keeps remaining restrictions actionable after this closeout.
 */
function limitationViolations(
  row: Limitation,
  observations: readonly Observation[],
  closedOwner: string,
): readonly string[] {
  const violations: string[] = [];
  if (row.owner.trim() === "") violations.push("missing owner");
  if (row.reason.trim() === "") violations.push("missing reason");
  if (row.status === "deferred" && row.owner.trim().split(/\s+/u)[0] === closedOwner) {
    violations.push("deferred work belongs to the closing owner");
  }
  if (observations.length === 0) violations.push("missing compiler probe");
  for (const observation of observations) {
    if (row.status === "deferred") {
      if (observation.kind === "success" && observation.errors.length === 0) {
        violations.push("supported restriction needs retirement");
      } else if (
        observation.kind !== "failure" ||
        observation.errors.length === 0 ||
        observation.errors.some((code) => code !== row.diagnostic)
      ) {
        violations.push("probe failed for a different reason");
      }
    } else if (observation.kind !== "success" || observation.errors.length !== 0) {
      violations.push("retired restriction still fails");
    }
  }
  return violations;
}

describe("expressiveness restriction expiry", () => {
  let rows: readonly Limitation[];
  let closedOwner: string;
  const observations = new Map<string, readonly Observation[]>();

  beforeAll(async () => {
    rows = await readLimitations();
    // The retired correction records the owner completing this gate; active rows must move onward.
    const retired = rows.find(({ id }) => id === "v4-stack-route-overestimate");
    if (retired === undefined) throw new Error("Missing retired stack restriction");
    const owner = retired.owner.trim().split(/\s+/u)[0];
    if (!owner) throw new Error("Missing closing owner");
    closedOwner = owner;
    for (const probe of probes) {
      const results: Observation[] = [];
      for (const source of probe.sources) results.push(await observe(source));
      observations.set(probe.id, results);
    }
  }, 60_000);

  // Each recorded restriction has a real compiler probe; removal or an unprobed addition fails.
  it("should retain exactly the restrictions covered by live compiler probes", () => {
    expect(rows.map(({ id }) => id).sort()).toEqual(probes.map(({ id }) => id).sort());
  });

  // Successful compilation expires a deferral; a retired correction must remain accepted.
  it.each(probes)("should reconcile $id with current compiler behavior", ({ id }) => {
    const row = rows.find((entry) => entry.id === id);
    const results = observations.get(id);
    if (row === undefined || results === undefined) throw new Error("Missing ledger probe");
    expect(limitationViolations(row, results, closedOwner), JSON.stringify(results)).toEqual([]);
  });

  // A handler cannot consume a predecessor that belongs to suspended mainline code.
  it("should reject the unmatched handler-only restore after the balanced IRQ restriction retires", async () => {
    const result = await observe(handlerIrqSources[2]!);
    expect(result.kind).toBe("failure");
    expect(result.errors).toEqual(["E10278"]);
  });

  // Alter one ledger or observation fact after proving that the unmodified row passes the gate.
  it.each([
    ["a supported deferred restriction", "supported restriction needs retirement"],
    ["a failing retired restriction", "retired restriction still fails"],
    ["a missing owner", "missing owner"],
    ["a missing reason", "missing reason"],
    ["active work assigned to the closing owner", "deferred work belongs to the closing owner"],
  ])("should reject %s", (mutation, violation) => {
    const id =
      mutation === "a failing retired restriction"
        ? "v4-stack-route-overestimate"
        : "v4-nmi-installation";
    const row = rows.find((entry) => entry.id === id);
    const results = observations.get(id);
    if (row === undefined || results === undefined) throw new Error("Missing mutation baseline");
    expect(limitationViolations(row, results, closedOwner)).toEqual([]);
    let changed = row;
    let changedResults = results;
    if (mutation === "a supported deferred restriction")
      changedResults = [{ kind: "success", errors: [] }];
    if (mutation === "a failing retired restriction")
      changedResults = [{ kind: "failure", errors: [row.diagnostic] }];
    if (mutation === "a missing owner") changed = { ...row, owner: "" };
    if (mutation === "a missing reason") changed = { ...row, reason: "" };
    if (mutation === "active work assigned to the closing owner")
      changed = { ...row, owner: closedOwner };
    expect(limitationViolations(changed, changedResults, closedOwner)).toEqual([violation]);
  });
});
